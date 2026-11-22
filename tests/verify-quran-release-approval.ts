import assert from 'node:assert';
import crypto from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';

class IsolatedClient {
  private cookies = new Map<string, string>();
  public csrfToken: string | null = null;

  private storeCookies(res: Response) {
    const hdrs = res.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = typeof hdrs.getSetCookie === 'function' ? hdrs.getSetCookie() : [];
    const fallback = res.headers.get('set-cookie');
    const all = setCookies.length > 0 ? setCookies : fallback ? [fallback] : [];
    for (const raw of all) {
      const [nv] = raw.split(';');
      const idx = nv.indexOf('=');
      if (idx > 0) {
        const name = nv.slice(0, idx).trim();
        const val = nv.slice(idx + 1).trim();
        if (!val || /Max-Age=0/i.test(raw)) this.cookies.delete(name);
        else this.cookies.set(name, val);
      }
    }
  }

  async req<T = Record<string, unknown>>(
    baseUrl: string,
    method: string,
    urlPath: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ status: number; data: T; rawText: string; headers: Headers }> {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    const cookieStr = Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieStr) headers['cookie'] = cookieStr;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.storeCookies(res);
    const rawText = await res.text();
    let data = {} as T & { csrfToken?: string };
    try {
      data = rawText
        ? (JSON.parse(rawText) as T & { csrfToken?: string })
        : ({} as T & { csrfToken?: string });
    } catch {
      data = {} as T & { csrfToken?: string };
    }
    if (data && typeof data === 'object' && typeof data.csrfToken === 'string') {
      this.csrfToken = data.csrfToken;
    }
    return { status: res.status, data, rawText, headers: res.headers };
  }
}

async function waitForReady(baseUrl: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${baseUrl}/api/auth/admin-bootstrap/status`);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Isolated test server at ${baseUrl} did not become ready`);
}

function stopChild(proc: ChildProcess) {
  try {
    if (proc.pid) process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

async function run() {
  const port = 3195;
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtimeSetupSecret = crypto.randomBytes(24).toString('hex');
  const explicitPin = `pin_${crypto.randomBytes(8).toString('hex')}`;

  const proc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      SKIP_VITE: '1',
      SQL_HOST: '',
      SQL_DB_NAME: '',
      SQL_USER: '',
      SQL_PASSWORD: '',
      DATABASE_URL: '',
      REQUIRE_POSTGRES: '',
      ADMIN_PIN: explicitPin,
      NONOLAND_ADMIN_SETUP_SECRET: runtimeSetupSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForReady(baseUrl);

    // 1. Bootstrap isolated Admin session (manage_lessons)
    const admin = new IsolatedClient();
    const adminEmail = `adm.quran.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const adminPw = `Adm1n!${crypto.randomBytes(8).toString('hex')}9Z`;
    const boot = await admin.req(baseUrl, 'POST', '/api/auth/admin-bootstrap', {
      setupSecret: runtimeSetupSecret,
      displayName: 'Quran Release Admin',
      email: adminEmail,
      password: adminPw,
      confirmPassword: adminPw,
    });
    assert.strictEqual(boot.status, 201, `Admin bootstrap failed: ${boot.rawText}`);

    // 2. Register isolated Parent + create Child profile for release-gate verification
    const parent = new IsolatedClient();
    const parentEmail = `par.quran.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const parentPw = `Par3nt!${crypto.randomBytes(8).toString('hex')}7Q`;
    const reg = await parent.req(baseUrl, 'POST', '/api/auth/register', {
      displayName: 'Test Family Parent',
      email: parentEmail,
      password: parentPw,
      termsAccepted: true,
    });
    assert.strictEqual(reg.status, 201, `Parent register failed: ${reg.rawText}`);

    const childRes = await parent.req<{ child?: { id: string }; id?: string }>(
      baseUrl,
      'POST',
      '/api/children',
      {
        displayName: 'Amina',
        language: 'ar',
        birthYear: new Date().getUTCFullYear() - 3,
        birthMonth: 5,
      },
    );
    assert.strictEqual(childRes.status, 201, `Child creation failed: ${childRes.rawText}`);
    const childId = childRes.data.child?.id || childRes.data.id || '';
    assert.ok(childId, 'Created child ID must be returned');

    // Confirm fail-closed child catalog & child quran endpoint before release approval
    const preCatalog = await parent.req<{
      surahs: Array<{ id: string; hasOpeningBasmalah: boolean }>;
      reciters: Array<{ id: string; verificationStatus: string; surahAudioUrls?: Record<string, string> }>;
      phraseAssets: { basmala: { audioUrl: string | null }; closing: { status: string; audioUrl: string | null } };
      playbackDefaultResolution: { audioAvailable: boolean };
    }>(baseUrl, 'GET', '/api/quran/catalog');
    assert.strictEqual(preCatalog.status, 200);
    assert.strictEqual(preCatalog.data.playbackDefaultResolution.audioAvailable, false);
    const fatihah = preCatalog.data.surahs.find((s) => s.id === 'surah-1');
    assert.strictEqual(fatihah?.hasOpeningBasmalah, false, 'Al-Fatihah must preserve hasOpeningBasmalah: false');
    assert.strictEqual(preCatalog.data.phraseAssets.closing.status, 'not_configured');
    assert.strictEqual(preCatalog.data.phraseAssets.closing.audioUrl, null);
    const preReciter = preCatalog.data.reciters.find((r) => r.id === 'adult-husary-muallim');
    assert.strictEqual(preReciter?.verificationStatus, 'pending_verification');
    assert.strictEqual(preReciter?.surahAudioUrls, undefined);

    const preChildQuran = await parent.req<{
      playbackResolution: { audioAvailable: boolean };
    }>(baseUrl, 'GET', `/api/children/${encodeURIComponent(childId)}/quran`);
    assert.strictEqual(preChildQuran.status, 200);
    assert.strictEqual(preChildQuran.data.playbackResolution.audioAvailable, false);

    // 3. Initial Admin Verification State — no fabricated passes, no Human Tajweed review
    const initVer = await admin.req<{
      releaseReadiness: {
        adminConfirmationsCount: number;
        adminConfirmationsTotal: number;
        sourceVerificationConfirmed: boolean;
        sourceVerificationStatus: string;
        sourceVerificationChecklistPassedCount: number;
        sourceVerificationChecklist: Array<{ key: string; status: string }>;
        basmalaApproved: boolean;
        closingDisabled: boolean;
        closingBlocksRelease: boolean;
        familyAccessEnabled: boolean;
      };
    }>(baseUrl, 'GET', '/api/admin/quran/verifications');
    assert.strictEqual(initVer.status, 200);
    assert.strictEqual(initVer.headers.get('cache-control'), 'no-store');
    assert.strictEqual(initVer.data.releaseReadiness.adminConfirmationsCount, 0);
    assert.strictEqual(initVer.data.releaseReadiness.adminConfirmationsTotal, 4);
    assert.strictEqual(initVer.data.releaseReadiness.sourceVerificationConfirmed, false);
    assert.strictEqual(initVer.data.releaseReadiness.closingDisabled, true);
    assert.strictEqual(initVer.data.releaseReadiness.closingBlocksRelease, false);
    // Audio coverage & technical probe must be pending initially (not falsely marked passed)
    const initAudioTech = initVer.data.releaseReadiness.sourceVerificationChecklist.find(
      (i) => i.key === 'audioTechnicalValidation',
    );
    assert.strictEqual(initAudioTech?.status, 'pending');
    assert.ok(
      !initVer.rawText.includes('Human Tajweed Review'),
      'API response must not present Human Tajweed Review as release requirement',
    );
    console.log('PASS [1]: Initial state fail-closed, 0/4 confirmations, no fabricated technical checks.');

    // 4. Test Administrator Confirmations persistence starting with sevenDayCachePolicy
    const keys: Array<{ key: string; policyVersion: string }> = [
      { key: 'sevenDayCachePolicy', policyVersion: 'QF-7-Day-Cache-Policy' },
      { key: 'qfDeveloperTermsAndCommercialUse', policyVersion: 'QF-Terms-2026-11-20' },
      { key: 'qfAttributionAndReciterCredit', policyVersion: 'Quran.Foundation-Credit-v4' },
      { key: 'privacyAndTermsReadiness', policyVersion: 'NonoLand-Policy-2026.04' },
    ];

    for (let idx = 0; idx < keys.length; idx++) {
      const item = keys[idx];
      const putRes = await admin.req<{
        confirmation: { confirmed: boolean; confirmedBy?: string; confirmedByUserId?: string };
        releaseReadiness: {
          adminConfirmationsCount: number;
          confirmations: Record<string, { confirmed: boolean }>;
        };
      }>(baseUrl, 'PUT', `/api/admin/quran/release-confirmations/${item.key}`, {
        confirmed: true,
        policyVersion: item.policyVersion,
      });
      assert.strictEqual(putRes.status, 200, `Failed confirmation ${item.key}: ${putRes.rawText}`);
      assert.strictEqual(putRes.data.confirmation.confirmed, true);
      assert.strictEqual(putRes.data.releaseReadiness.adminConfirmationsCount, idx + 1);
      assert.strictEqual(putRes.data.releaseReadiness.confirmations[item.key].confirmed, true);

      // Fresh reload from GET endpoint must match persisted state immediately
      const reloadRes = await admin.req<{
        releaseReadiness: {
          adminConfirmationsCount: number;
          confirmations: Record<string, { confirmed: boolean }>;
        };
      }>(baseUrl, 'GET', '/api/admin/quran/verifications');
      assert.strictEqual(reloadRes.status, 200);
      assert.strictEqual(reloadRes.data.releaseReadiness.adminConfirmationsCount, idx + 1);
      assert.strictEqual(reloadRes.data.releaseReadiness.confirmations[item.key].confirmed, true);
    }

    // Revoke & re-confirm sevenDayCachePolicy to ensure decrement + persistence works both ways
    const revokeCacheRes = await admin.req<{
      confirmation: { confirmed: boolean };
      releaseReadiness: { adminConfirmationsCount: number };
    }>(baseUrl, 'PUT', '/api/admin/quran/release-confirmations/sevenDayCachePolicy', {
      confirmed: false,
      policyVersion: 'QF-7-Day-Cache-Policy',
    });
    assert.strictEqual(revokeCacheRes.status, 200);
    assert.strictEqual(revokeCacheRes.data.confirmation.confirmed, false);
    assert.strictEqual(revokeCacheRes.data.releaseReadiness.adminConfirmationsCount, 3);

    const reconfirmCacheRes = await admin.req<{
      confirmation: { confirmed: boolean };
      releaseReadiness: { adminConfirmationsCount: number };
    }>(baseUrl, 'PUT', '/api/admin/quran/release-confirmations/sevenDayCachePolicy', {
      confirmed: true,
      policyVersion: 'QF-7-Day-Cache-Policy',
    });
    assert.strictEqual(reconfirmCacheRes.status, 200);
    assert.strictEqual(reconfirmCacheRes.data.releaseReadiness.adminConfirmationsCount, 4);
    console.log('PASS [2]: sevenDayCachePolicy & all 4/4 admin confirmations persist and reload cleanly.');

    // 5. Basmala Candidate Probe: broken 404 mirror rejected, official QF v4 source verified playable & stays pending until approved
    const brokenUrl = 'https://verses.quran.foundation/Husary/mp3/001001.mp3';
    const probeBroken = await admin.req<{
      initialProbe: { ok: boolean; httpStatus: number; contentType: string; browserPlayable: boolean };
      resolvedAuthorizedUrl?: string;
      resolvedProbe?: { ok: boolean; httpStatus: number; contentType: string; browserPlayable: boolean; magicFormat: string };
      phraseAssets: { basmala: { status: string } };
    }>(baseUrl, 'POST', '/api/admin/quran/basmala/probe', {
      candidateUrl: brokenUrl,
      resolveAuthorizedSource: false,
    });
    assert.strictEqual(probeBroken.status, 200);
    assert.strictEqual(probeBroken.data.initialProbe.ok, false);
    assert.strictEqual(probeBroken.data.initialProbe.httpStatus, 404);
    assert.strictEqual(probeBroken.data.initialProbe.browserPlayable, false);

    // Attempting to approve the broken 404 HTML URL must fail with HTTP 400
    const rejectBrokenApprove = await admin.req(
      baseUrl,
      'PUT',
      '/api/admin/quran/phrase-assets/basmala',
      {
        audioUrl: brokenUrl,
        sourceName: 'Quran Foundation Recitation ID 6 (Al-Husary 1:1 Basmala)',
        licenseOrPermission: 'QF Terms',
        reviewedBy: 'Quran Release Admin',
        reviewedAt: '2026-11-21',
        licenseConfirmed: true,
        humanListeningApproved: true,
        verificationStatus: 'verified',
      },
    );
    assert.strictEqual(
      rejectBrokenApprove.status,
      400,
      'Approving a 404 HTML Basmala URL MUST return 400',
    );

    // Resolve official QF v4 Reciter 6 (1:1) URL
    const resolveBasmala = await admin.req<{
      resolvedAuthorizedUrl: string;
      resolvedProbe: { ok: boolean; httpStatus: number; contentType: string; browserPlayable: boolean; magicFormat: string };
      phraseAssets: { basmala: { status: string; audioUrl: string } };
      releaseReadiness: { basmalaApproved: boolean };
    }>(baseUrl, 'POST', '/api/admin/quran/basmala/probe', {
      resolveAuthorizedSource: true,
    });
    assert.strictEqual(resolveBasmala.status, 200);
    assert.ok(
      resolveBasmala.data.resolvedAuthorizedUrl.includes('001001.mp3'),
      'Resolved URL must point to Reciter 6 001001.mp3',
    );
    assert.strictEqual(resolveBasmala.data.resolvedProbe.ok, true);
    assert.strictEqual(resolveBasmala.data.resolvedProbe.browserPlayable, true);
    assert.strictEqual(resolveBasmala.data.phraseAssets.basmala.status, 'configured_pending_approval');
    assert.strictEqual(resolveBasmala.data.releaseReadiness.basmalaApproved, false);
    console.log(
      `PASS [3]: Broken Basmala (${probeBroken.data.initialProbe.httpStatus} ${probeBroken.data.initialProbe.contentType}) rejected; official QF Reciter 6 1:1 (${resolveBasmala.data.resolvedAuthorizedUrl}) resolved & kept pending until explicit approval.`,
    );

    // 6. Authorization checks on PUT /api/admin/quran/source-verification before evaluation & confirmation
    const anonClient = new IsolatedClient();
    const unauthSv = await anonClient.req(baseUrl, 'PUT', '/api/admin/quran/source-verification', {
      confirmed: true,
    });
    assert.strictEqual(unauthSv.status, 401);

    // PIN-only without authenticated admin session must be rejected (401)
    const pinOnlySv = await anonClient.req(
      baseUrl,
      'PUT',
      '/api/admin/quran/source-verification',
      { confirmed: true },
      { 'x-admin-pin': explicitPin },
    );
    assert.strictEqual(pinOnlySv.status, 401);

    // Parent user must receive 403
    const parentSv = await parent.req(baseUrl, 'PUT', '/api/admin/quran/source-verification', {
      confirmed: true,
    });
    assert.strictEqual(parentSv.status, 403);

    // Confirm cannot succeed before 8-point technical evaluation completes
    const earlyConfirm = await admin.req(baseUrl, 'PUT', '/api/admin/quran/source-verification', {
      confirmed: true,
    });
    assert.strictEqual(earlyConfirm.status, 400);

    // 7. Run live 8-point Source Verification evaluation (metadata + 9/9 SHA-256 + 49/49 audio probe)
    const evalRes = await admin.req<{
      evaluationPassed: boolean;
      audioCoverage: { playableSurahCount: number; playableAyahCount: number; invalidResources: unknown[] };
      localTextCheck: { allMatched: boolean; verifiedSurahsCount: number; verifiedAyahsCount: number };
      releaseReadiness: {
        sourceVerificationConfirmed: boolean;
        sourceVerificationChecklistPassed: boolean;
        sourceVerificationChecklistPassedCount: number;
      };
    }>(baseUrl, 'POST', '/api/admin/quran/source-verification/evaluate', {
      refreshFromQf: true,
    });
    assert.strictEqual(evalRes.status, 200, `Evaluation failed: ${evalRes.rawText}`);
    assert.strictEqual(evalRes.data.evaluationPassed, true);
    assert.strictEqual(evalRes.data.localTextCheck.allMatched, true);
    assert.strictEqual(evalRes.data.localTextCheck.verifiedSurahsCount, 9);
    assert.strictEqual(evalRes.data.localTextCheck.verifiedAyahsCount, 40);
    assert.strictEqual(evalRes.data.audioCoverage.playableSurahCount, 9);
    assert.strictEqual(evalRes.data.audioCoverage.playableAyahCount, 40);
    assert.strictEqual(evalRes.data.audioCoverage.invalidResources.length, 0);
    assert.strictEqual(evalRes.data.releaseReadiness.sourceVerificationChecklistPassed, true);
    assert.strictEqual(evalRes.data.releaseReadiness.sourceVerificationChecklistPassedCount, 8);
    // Must NEVER auto-confirm
    assert.strictEqual(evalRes.data.releaseReadiness.sourceVerificationConfirmed, false);
    console.log('PASS [4]: 8/8 technical & provider source verification checks passed without auto-confirming.');

    // 8. Explicit Administrator Confirmation of Reciter & Recitation Source
    const confirmSv = await admin.req<{
      sourceVerification: {
        status: string;
        confirmed: boolean;
        confirmedBy?: string;
        confirmedByUserId?: string;
        confirmedAt?: string;
        reciterId: number;
        provider: string;
        recitationStyle: string;
        riwayah: string;
        evidenceVersion: string;
        statusMessage: string;
      };
      releaseReadiness: {
        sourceVerificationConfirmed: boolean;
        sourceVerificationMessage: string;
        canApproveFamilyRelease: boolean;
      };
    }>(baseUrl, 'PUT', '/api/admin/quran/source-verification', { confirmed: true });
    assert.strictEqual(confirmSv.status, 200, `Confirm source verification failed: ${confirmSv.rawText}`);
    assert.strictEqual(confirmSv.data.sourceVerification.status, 'confirmed');
    assert.strictEqual(confirmSv.data.sourceVerification.confirmed, true);
    assert.ok(confirmSv.data.sourceVerification.confirmedBy);
    assert.ok(confirmSv.data.sourceVerification.confirmedByUserId);
    assert.ok(confirmSv.data.sourceVerification.confirmedAt?.endsWith('Z'));
    assert.strictEqual(confirmSv.data.sourceVerification.reciterId, 6);
    assert.strictEqual(confirmSv.data.sourceVerification.provider, 'Quran Foundation');
    assert.strictEqual(confirmSv.data.sourceVerification.recitationStyle, 'Murattal');
    assert.ok(confirmSv.data.sourceVerification.riwayah.includes('Hafs'));
    assert.ok(confirmSv.data.sourceVerification.evidenceVersion);
    assert.strictEqual(
      confirmSv.data.sourceVerification.statusMessage,
      'Reciter and recitation source verified against Quran Foundation provider metadata and technical audio integrity checks.',
    );
    // Basmala is STILL not approved, so family release must still be blocked
    assert.strictEqual(confirmSv.data.releaseReadiness.canApproveFamilyRelease, false);

    // 9. Approve resolved playable Basmala asset -> now ALL 6 updated release gates are ready (WITHOUT Human Tajweed Review)
    const approveBasmala = await admin.req<{
      asset: { status: string; audioUrl: string };
      releaseReadiness: { basmalaApproved: boolean; basmalaPlayable: boolean; canApproveFamilyRelease: boolean };
    }>(baseUrl, 'PUT', '/api/admin/quran/phrase-assets/basmala', {
      audioUrl: resolveBasmala.data.resolvedAuthorizedUrl,
      sourceName: 'Quran Foundation Recitation ID 6 (Al-Husary 1:1 Basmala)',
      licenseOrPermission:
        'Quran Foundation Developer Terms (integrated app use, Reciter ID 6 Al-Husary 1:1)',
      reviewedBy: 'Quran Release Admin',
      reviewedAt: '2026-11-21',
      licenseConfirmed: true,
      humanListeningApproved: true,
      verificationStatus: 'verified',
      notes: 'Playability and QF source verified.',
    });
    assert.strictEqual(approveBasmala.status, 200, `Basmala approval failed: ${approveBasmala.rawText}`);
    assert.strictEqual(approveBasmala.data.asset.status, 'approved');
    assert.strictEqual(approveBasmala.data.releaseReadiness.basmalaApproved, true);
    assert.strictEqual(approveBasmala.data.releaseReadiness.basmalaPlayable, true);
    assert.strictEqual(approveBasmala.data.releaseReadiness.canApproveFamilyRelease, true);

    // 10. Approve Family Release & confirm Child Account unlocks audio
    const releaseRes = await admin.req<{
      verification: { verificationStatus: string };
      releaseReadiness: { familyAccessEnabled: boolean };
    }>(baseUrl, 'PUT', '/api/admin/quran/verifications/adult-husary-muallim', {
      verificationStatus: 'verified',
    });
    assert.strictEqual(releaseRes.status, 200, `Final release failed: ${releaseRes.rawText}`);
    assert.strictEqual(releaseRes.data.releaseReadiness.familyAccessEnabled, true);

    const unlockedChildQuran = await parent.req<{
      playbackResolution: {
        audioAvailable: boolean;
        activeReciter: {
          id: string;
          verificationStatus: string;
          sourceVerificationStatus?: string;
          surahAudioUrls?: Record<string, string>;
          ayahAudioUrls?: Record<string, string>;
        } | null;
      };
    }>(baseUrl, 'GET', `/api/children/${encodeURIComponent(childId)}/quran`);
    assert.strictEqual(unlockedChildQuran.status, 200);
    assert.strictEqual(unlockedChildQuran.data.playbackResolution.audioAvailable, true);
    assert.strictEqual(unlockedChildQuran.data.playbackResolution.activeReciter?.verificationStatus, 'verified');
    assert.strictEqual(unlockedChildQuran.data.playbackResolution.activeReciter?.sourceVerificationStatus, 'confirmed');
    assert.strictEqual(
      Object.keys(unlockedChildQuran.data.playbackResolution.activeReciter?.surahAudioUrls || {}).length,
      9,
    );
    assert.strictEqual(
      Object.keys(unlockedChildQuran.data.playbackResolution.activeReciter?.ayahAudioUrls || {}).length,
      40,
    );
    console.log('PASS [5]: Family & child audio unlocked once Source Verification, 49 URLs, playable Basmala, and 4/4 admin confirmations succeeded.');

    // 11. Revoke Source Verification -> MUST immediately block family/child audio (fail-closed)
    const revokeSv = await admin.req<{
      sourceVerification: { status: string; confirmed: boolean; revokedAt?: string };
      releaseReadiness: {
        familyAccessEnabled: boolean;
        sourceVerificationConfirmed: boolean;
        reciterStatus: string;
      };
    }>(baseUrl, 'PUT', '/api/admin/quran/source-verification', { confirmed: false });
    assert.strictEqual(revokeSv.status, 200);
    assert.strictEqual(revokeSv.data.sourceVerification.status, 'revoked');
    assert.strictEqual(revokeSv.data.sourceVerification.confirmed, false);
    assert.ok(revokeSv.data.sourceVerification.revokedAt);
    assert.strictEqual(revokeSv.data.releaseReadiness.familyAccessEnabled, false);
    assert.strictEqual(revokeSv.data.releaseReadiness.reciterStatus, 'pending_verification');

    const reblockedChildQuran = await parent.req<{
      playbackResolution: { audioAvailable: boolean; activeReciter: unknown };
    }>(baseUrl, 'GET', `/api/children/${encodeURIComponent(childId)}/quran`);
    assert.strictEqual(reblockedChildQuran.status, 200);
    assert.strictEqual(reblockedChildQuran.data.playbackResolution.audioAvailable, false);
    assert.strictEqual(reblockedChildQuran.data.playbackResolution.activeReciter, null);
    console.log('PASS [6]: Revoking Reciter & Recitation Source Verification immediately fails closed and blocks child audio.');
  } finally {
    stopChild(proc);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
