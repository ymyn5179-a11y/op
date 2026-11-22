import assert from 'node:assert';
import crypto from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import { QURAN_SURAHS } from '../src/data/quranCatalog';
import { buildSurahRecitationSequence } from '../src/utils/quranAudioPlayer';

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
    opts?: { skipCsrf?: boolean; extraHeaders?: Record<string, string> },
  ): Promise<{ status: number; data: T; rawText: string }> {
    const headers: Record<string, string> = { ...(opts?.extraHeaders || {}) };
    const cookieStr = Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieStr) headers['cookie'] = cookieStr;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (!opts?.skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.csrfToken) {
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
    return { status: res.status, data, rawText };
  }
}

async function waitForReady(baseUrl: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${baseUrl}/api/health`);
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
  const port = 3196;
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

    // 1. Admin completes all 6 release gates cleanly
    const admin = new IsolatedClient();
    const adminEmail = `adm.e2e.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const adminPw = `Adm1n!${crypto.randomBytes(8).toString('hex')}9Z`;
    const boot = await admin.req(baseUrl, 'POST', '/api/auth/admin-bootstrap', {
      setupSecret: runtimeSetupSecret,
      displayName: 'Quran Release Admin',
      email: adminEmail,
      password: adminPw,
      confirmPassword: adminPw,
    });
    assert.strictEqual(boot.status, 201, `Admin bootstrap failed: ${boot.rawText}`);

    const confKeys = [
      'qfDeveloperTermsAndCommercialUse',
      'qfAttributionAndReciterCredit',
      'sevenDayCachePolicy',
      'privacyAndTermsReadiness',
    ] as const;
    for (const k of confKeys) {
      const r = await admin.req(baseUrl, 'PUT', `/api/admin/quran/release-confirmations/${k}`, {
        confirmed: true,
      });
      assert.strictEqual(r.status, 200);
    }

    const evalRes = await admin.req(baseUrl, 'POST', '/api/admin/quran/source-verification/evaluate', {
      refreshFromQf: true,
    });
    assert.strictEqual(evalRes.status, 200);

    const svConfirm = await admin.req(baseUrl, 'PUT', '/api/admin/quran/source-verification', {
      confirmed: true,
    });
    assert.strictEqual(svConfirm.status, 200);

    const basmalaProbe = await admin.req<{ resolvedAuthorizedUrl: string }>(
      baseUrl,
      'POST',
      '/api/admin/quran/basmala/probe',
      { resolveAuthorizedSource: true },
    );
    assert.strictEqual(basmalaProbe.status, 200);

    const basmalaApprove = await admin.req(baseUrl, 'PUT', '/api/admin/quran/phrase-assets/basmala', {
      audioUrl: basmalaProbe.data.resolvedAuthorizedUrl,
      sourceName: 'Quran Foundation Recitation ID 6 (Al-Husary 1:1 Basmala)',
      licenseOrPermission: 'Quran Foundation Developer Terms',
      reviewedBy: 'E2E Release Admin',
      reviewedAt: '2026-11-21',
      licenseConfirmed: true,
      humanListeningApproved: true,
      verificationStatus: 'verified',
    });
    assert.strictEqual(basmalaApprove.status, 200);

    const releaseRes = await admin.req<{ releaseReadiness: { familyAccessEnabled: boolean } }>(
      baseUrl,
      'PUT',
      '/api/admin/quran/verifications/adult-husary-muallim',
      { verificationStatus: 'verified' },
    );
    assert.strictEqual(releaseRes.status, 200);
    assert.strictEqual(releaseRes.data.releaseReadiness.familyAccessEnabled, true);
    console.log('PASS [1]: All 6 Admin release gates approved cleanly.');

    // 2. Parent registers, creates child (Age 3 / unified stage), generates child access code
    const parent = new IsolatedClient();
    const parentEmail = `par.e2e.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const parentPw = `Par3nt!${crypto.randomBytes(8).toString('hex')}7Q`;
    const reg = await parent.req(baseUrl, 'POST', '/api/auth/register', {
      displayName: 'Yusuf Parent',
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
        displayName: 'Yusuf',
        language: 'ar',
        birthYear: new Date().getUTCFullYear() - 3,
        birthMonth: 6,
      },
    );
    assert.strictEqual(childRes.status, 201);
    const childId = childRes.data.child?.id || childRes.data.id || '';
    assert.ok(childId);

    // CSRF rejection test on parent mutation without token
    const csrfFail = await parent.req(
      baseUrl,
      'POST',
      '/api/parent/verify-password',
      { password: parentPw },
      { skipCsrf: true },
    );
    assert.strictEqual(csrfFail.status, 403, 'Missing CSRF token must be rejected 403');

    const gateRes = await parent.req(baseUrl, 'POST', '/api/parent/verify-password', {
      password: parentPw,
    });
    assert.strictEqual(gateRes.status, 200);

    const credRes = await parent.req<{ credentials?: { accessCode?: string }; accessCode?: string }>(
      baseUrl,
      'POST',
      `/api/family/children/${encodeURIComponent(childId)}/credentials`,
      { pin: '4829' },
    );
    assert.ok(
      credRes.status === 201 || credRes.status === 200,
      `Child credentials issue failed: ${credRes.rawText}`,
    );
    const accessCode = credRes.data.credentials?.accessCode || credRes.data.accessCode || '';
    assert.ok(accessCode.startsWith('NL-'), `Expected NL- access code, got: ${credRes.rawText}`);

    // Parent customizes allowed Surahs + daily limit (5 mins)
    const setRes = await parent.req<{ settings: { dailyMaxMinutes: number; allowedSurahIds: string[] } }>(
      baseUrl,
      'PUT',
      `/api/children/${encodeURIComponent(childId)}/quran/settings`,
      {
        enabled: true,
        allowedSurahIds: ['surah-1', 'surah-112', 'surah-114'],
        surahOrder: ['surah-1', 'surah-112', 'surah-114'],
        repeatCount: 2,
        dailyMaxMinutes: 5,
      },
    );
    assert.strictEqual(setRes.status, 200);
    assert.strictEqual(setRes.data.settings.dailyMaxMinutes, 5);
    assert.deepStrictEqual(setRes.data.settings.allowedSurahIds, ['surah-1', 'surah-112', 'surah-114']);
    console.log('PASS [2]: Parent Gate, child credentials, and Quran settings verified (CSRF enforced).');

    // 3. Child signs in, inspects catalog/playback sequence (Al-Fatihah vs Al-Ikhlas Basmala rules), and completes activities
    const childClient = new IsolatedClient();
    const childLogin = await childClient.req(baseUrl, 'POST', '/api/auth/child-login', {
      accessCode,
      pin: '4829',
    });
    assert.strictEqual(childLogin.status, 200, `Child login failed: ${childLogin.rawText}`);

    const childCat = await childClient.req<{
      surahs: typeof QURAN_SURAHS;
      phraseAssets: {
        basmala: { status: string; audioUrl: string | null };
        closing: { status: string; audioUrl: string | null };
      };
    }>(baseUrl, 'GET', '/api/quran/catalog');
    assert.strictEqual(childCat.status, 200);
    assert.strictEqual(childCat.data.surahs.length, 9);
    assert.strictEqual(childCat.data.phraseAssets.basmala.status, 'approved');
    assert.ok(childCat.data.phraseAssets.basmala.audioUrl);
    assert.strictEqual(childCat.data.phraseAssets.closing.status, 'not_configured');
    assert.strictEqual(childCat.data.phraseAssets.closing.audioUrl, null);

    const childSummary = await childClient.req<{
      playbackResolution: {
        audioAvailable: boolean;
        activeReciter: {
          basmalaAudioUrl?: string;
          closingPhraseAudioUrl?: string;
          surahAudioUrls?: Record<string, string>;
          ayahAudioUrls?: Record<string, string>;
        } | null;
      };
    }>(baseUrl, 'GET', `/api/children/${encodeURIComponent(childId)}/quran`);
    assert.strictEqual(childSummary.status, 200);
    assert.strictEqual(childSummary.data.playbackResolution.audioAvailable, true);
    const activeReciter = childSummary.data.playbackResolution.activeReciter!;
    assert.ok(activeReciter.basmalaAudioUrl);
    assert.strictEqual(activeReciter.closingPhraseAudioUrl, undefined);

    // Verify Basmala ordering: Al-Fatihah NO duplicate Basmala; Al-Ikhlas YES Basmala before Surah
    const fatihahSpec = QURAN_SURAHS.find((s) => s.id === 'surah-1')!;
    const ikhlasSpec = QURAN_SURAHS.find((s) => s.id === 'surah-112')!;
    const fatihahPlan = buildSurahRecitationSequence({
      surah: fatihahSpec,
      surahAudioUrl: activeReciter.surahAudioUrls?.['surah-1'],
      basmalaAudioUrl: activeReciter.basmalaAudioUrl,
      closingPhraseAudioUrl: activeReciter.closingPhraseAudioUrl,
      requireApprovedBasmala: true,
    });
    assert.strictEqual(fatihahPlan.willPlayBasmala, false, 'Al-Fatihah must NOT duplicate Basmala');
    assert.strictEqual(fatihahPlan.willPlayClosing, false);
    assert.deepStrictEqual(fatihahPlan.steps.map((s) => s.phase), ['surah']);

    const ikhlasPlan = buildSurahRecitationSequence({
      surah: ikhlasSpec,
      surahAudioUrl: activeReciter.surahAudioUrls?.['surah-112'],
      basmalaAudioUrl: activeReciter.basmalaAudioUrl,
      closingPhraseAudioUrl: activeReciter.closingPhraseAudioUrl,
      requireApprovedBasmala: true,
    });
    assert.strictEqual(ikhlasPlan.willPlayBasmala, true, 'Al-Ikhlas MUST prepend approved Basmala');
    assert.strictEqual(ikhlasPlan.willPlayClosing, false);
    assert.deepStrictEqual(ikhlasPlan.steps.map((s) => s.phase), ['basmala', 'surah']);

    // Child logs listen, repeat, story, and manner activities
    const listenRes = await childClient.req<{
      progress: { status: string; parentConfirmedMemorization: boolean; listenCount: number };
    }>(baseUrl, 'POST', `/api/children/${encodeURIComponent(childId)}/quran/listen`, {
      surahId: 'surah-112',
      mode: 'listen',
      ayahNumbers: [1, 2, 3, 4],
      durationSeconds: 30,
      reciterId: 'adult-husary-muallim',
    });
    assert.strictEqual(listenRes.status, 200);
    assert.strictEqual(listenRes.data.progress.status, 'practiced');
    assert.strictEqual(
      listenRes.data.progress.parentConfirmedMemorization,
      false,
      'Listening alone must NEVER auto-confirm memorization',
    );

    const repeatRes = await childClient.req<{
      progress: { repeatSessionsCount: number; parentConfirmedMemorization: boolean };
    }>(baseUrl, 'POST', `/api/children/${encodeURIComponent(childId)}/quran/listen`, {
      surahId: 'surah-112',
      mode: 'repeat',
      ayahNumbers: [1, 2, 3, 4],
      durationSeconds: 30,
      reciterId: 'adult-husary-muallim',
    });
    assert.strictEqual(repeatRes.status, 200);
    assert.strictEqual(repeatRes.data.progress.repeatSessionsCount, 1);
    assert.strictEqual(repeatRes.data.progress.parentConfirmedMemorization, false);

    const storyRes = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story`,
      { storyId: 'qstory-gratitude-garden' },
    );
    assert.strictEqual(storyRes.status, 200);

    const mannerRes = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/manner`,
      { mannerId: 'manner-bismillah' },
    );
    assert.strictEqual(mannerRes.status, 200);

    // Child cannot self-confirm memorization!
    const childSelfConfirm = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/memorization-confirm`,
      { surahId: 'surah-112', confirmed: true },
    );
    assert.strictEqual(childSelfConfirm.status, 403, 'Child must NEVER bypass Parent Gate to confirm memorization');

    // Disallowed Surah blocked
    const disallowedSurah = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/listen`,
      { surahId: 'surah-108', mode: 'listen', ayahNumbers: [1], durationSeconds: 10 },
    );
    assert.strictEqual(disallowedSurah.status, 403);
    console.log('PASS [3]: Child sequence (Fatihah/Ikhlas Basmala), progress persistence, & child self-confirm block passed.');

    // 4. Parent confirms memorization cleanly
    const parentConfirm = await parent.req<{
      progress: { status: string; parentConfirmedMemorization: boolean; parentNote?: string };
      summary: { growthSummary: { parentConfirmedCount: number } };
    }>(baseUrl, 'POST', `/api/children/${encodeURIComponent(childId)}/quran/memorization-confirm`, {
      surahId: 'surah-112',
      confirmed: true,
      parentNote: 'Recited beautifully after Maghrib!',
    });
    assert.strictEqual(parentConfirm.status, 200);
    assert.strictEqual(parentConfirm.data.progress.status, 'parent_confirmed');
    assert.strictEqual(parentConfirm.data.progress.parentConfirmedMemorization, true);
    assert.strictEqual(parentConfirm.data.summary.growthSummary.parentConfirmedCount, 1);

    // 5. Daily time limit enforcement (reach 5 minutes, then verify 429)
    const fillLimit = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/listen`,
      { surahId: 'surah-1', mode: 'listen', ayahNumbers: [1], durationSeconds: 240 },
    );
    assert.strictEqual(fillLimit.status, 200);
    const hitLimit = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/listen`,
      { surahId: 'surah-1', mode: 'listen', ayahNumbers: [1], durationSeconds: 10 },
    );
    assert.strictEqual(hitLimit.status, 429, 'Daily Quran time limit must return HTTP 429');

    // 6. Parent disables Quran World -> immediate child block across endpoints
    const disableRes = await parent.req(
      baseUrl,
      'PUT',
      `/api/children/${encodeURIComponent(childId)}/quran/settings`,
      { enabled: false },
    );
    assert.strictEqual(disableRes.status, 200);
    const blockedWhenDisabled = await childClient.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story`,
      { storyId: 'qstory-gratitude-garden' },
    );
    assert.strictEqual(blockedWhenDisabled.status, 403, 'Disabling child Quran settings must block immediately');
    console.log('PASS [4]: Parent memorization confirmation, daily time limit (429), and immediate child pause block (403) passed.');

    // 7. Teacher isolation verification
    const teacher = new IsolatedClient();
    const teacherEmail = `tch.e2e.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const teacherPw = `Tch3r!${crypto.randomBytes(8).toString('hex')}5M`;
    const tReg = await teacher.req<{ user?: { id: string } }>(
      baseUrl,
      'POST',
      '/api/auth/register-teacher',
      {
        displayName: 'Arabic Language Teacher',
        email: teacherEmail,
        password: teacherPw,
        termsAccepted: true,
        subjects: ['arabic'],
      },
    );
    assert.strictEqual(tReg.status, 201, `Teacher register failed: ${tReg.rawText}`);
    const teacherUserId = tReg.data.user?.id || '';
    const tApprove = await admin.req(
      baseUrl,
      'POST',
      `/api/admin/teachers/${encodeURIComponent(teacherUserId)}/approve`,
      {},
    );
    assert.strictEqual(tApprove.status, 200, `Teacher approve failed: ${tApprove.rawText}`);

    const tLogin = await teacher.req(baseUrl, 'POST', '/api/auth/login', {
      email: teacherEmail,
      password: teacherPw,
      portal: 'teacher',
    });
    assert.strictEqual(tLogin.status, 200);

    const tReadChildQuran = await teacher.req(
      baseUrl,
      'GET',
      `/api/children/${encodeURIComponent(childId)}/quran`,
    );
    assert.strictEqual(tReadChildQuran.status, 403, 'Teacher MUST NOT read private family Quran data');
    const tConfirmMem = await teacher.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/memorization-confirm`,
      { surahId: 'surah-1', confirmed: true },
    );
    assert.strictEqual(tConfirmMem.status, 403);
    const tAdminQuran = await teacher.req(baseUrl, 'GET', '/api/admin/quran/verifications');
    assert.strictEqual(tAdminQuran.status, 403);
    console.log('PASS [5]: Teacher isolation (403 across family Quran & Admin endpoints) verified.');
  } finally {
    stopChild(proc);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
