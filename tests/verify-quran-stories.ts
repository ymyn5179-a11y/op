import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ChildProcess, spawn } from 'node:child_process';
import type { QuranStoryProgressDetails, QuranStorySpec } from '../src/types/nonoland';

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
    opts?: { skipCsrf?: boolean },
  ): Promise<{ status: number; data: T; rawText: string }> {
    const headers: Record<string, string> = {};
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
  const port = 3198;
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

    // 1. Bootstrap Super Admin
    const admin = new IsolatedClient();
    const adminEmail = `adm.st.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const adminPw = `Adm1n!${crypto.randomBytes(8).toString('hex')}9Z`;
    const boot = await admin.req(baseUrl, 'POST', '/api/auth/admin-bootstrap', {
      setupSecret: runtimeSetupSecret,
      displayName: 'Stories CMS Admin',
      email: adminEmail,
      password: adminPw,
      confirmPassword: adminPw,
    });
    assert.strictEqual(boot.status, 201, `Admin bootstrap failed: ${boot.rawText}`);

    // 2. Register Parent + Child + Child Login
    const parent = new IsolatedClient();
    const parentEmail = `par.st.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const parentPw = `Par3nt!${crypto.randomBytes(8).toString('hex')}7Q`;
    const reg = await parent.req(baseUrl, 'POST', '/api/auth/register', {
      displayName: 'Salma Parent',
      email: parentEmail,
      password: parentPw,
      termsAccepted: true,
    });
    assert.strictEqual(reg.status, 201);

    const childRes = await parent.req<{ child?: { id: string }; id?: string }>(
      baseUrl,
      'POST',
      '/api/children',
      {
        displayName: 'Salma',
        language: 'ar',
        birthYear: new Date().getUTCFullYear() - 3,
        birthMonth: 4,
      },
    );
    assert.strictEqual(childRes.status, 201);
    const childId = childRes.data.child?.id || childRes.data.id || '';
    assert.ok(childId);

    const gateRes = await parent.req(baseUrl, 'POST', '/api/parent/verify-password', {
      password: parentPw,
    });
    assert.strictEqual(gateRes.status, 200);

    const credRes = await parent.req<{ credentials?: { accessCode?: string }; accessCode?: string }>(
      baseUrl,
      'POST',
      `/api/family/children/${encodeURIComponent(childId)}/credentials`,
      { pin: '2468' },
    );
    assert.ok(credRes.status === 200 || credRes.status === 201);
    const accessCode = credRes.data.credentials?.accessCode || credRes.data.accessCode || '';
    assert.ok(accessCode.startsWith('NL-'));

    const child = new IsolatedClient();
    const childLogin = await child.req(baseUrl, 'POST', '/api/auth/child-login', {
      accessCode,
      pin: '2468',
    });
    assert.strictEqual(childLogin.status, 200);

    // 3. Verify 8 curated stories structure, religious safety, & durations
    const storiesRes = await child.req<{ stories: QuranStorySpec[] }>(
      baseUrl,
      'GET',
      '/api/quran/stories',
    );
    assert.strictEqual(storiesRes.status, 200);
    const stories = storiesRes.data.stories;
    assert.strictEqual(stories.length, 8, `Expected 8 curated stories, got ${stories.length}`);

    const expectedArabicTitles = [
      'أصحاب الفيل',
      'سفينة سيدنا نوح عليه السلام',
      'سيدنا يونس والحوت',
      'سيدنا يوسف عليه السلام',
      'سيدنا موسى عليه السلام',
      'سيدنا سليمان عليه السلام',
      'سيدنا إبراهيم عليه السلام',
      'أصحاب الكهف',
    ];
    for (const expectedTitle of expectedArabicTitles) {
      assert.ok(
        stories.some((s) => s.title.ar === expectedTitle),
        `Missing required Arabic story title: ${expectedTitle}`,
      );
    }

    const distinctDurations = new Set<number>();
    const existingStoryAudioUrls: string[] = [];
    for (const st of stories) {
      assert.strictEqual(st.prohibitsProphetDepiction, true, `${st.id} must enforce prohibitsProphetDepiction`);
      assert.ok(st.surahReferences.length >= 1, `${st.id} needs surahReferences`);
      assert.ok(st.establishedQuranicFacts.length >= 1, `${st.id} needs establishedQuranicFacts`);
      assert.ok(st.scenes.length >= 4, `${st.id} needs >= 4 multi-part scenes`);
      assert.ok(st.closingQuiz && st.closingQuiz.options.length >= 2, `${st.id} needs closingQuiz`);
      assert.ok(st.closingActivity, `${st.id} needs closingActivity`);
      const activityScenes = st.scenes.filter((sc) => Boolean(sc.activity));
      assert.ok(activityScenes.length >= 2, `${st.id} must contain at least 2 interactive scene activities`);
      distinctDurations.add(st.durationSeconds);
      for (const sc of st.scenes) {
        assert.ok(sc.narration.young.ar && sc.narration.mid.ar && sc.narration.older.ar);
        const expectedRelUrl = `/assets/audio/stories/${st.id}/${sc.id}.mp3`;
        const diskMp3Path = path.resolve(
          process.cwd(),
          'public',
          'assets',
          'audio',
          'stories',
          st.id,
          `${sc.id}.mp3`,
        );
        if (fs.existsSync(diskMp3Path)) {
          const stat = fs.statSync(diskMp3Path);
          const head = Buffer.alloc(12);
          const fd = fs.openSync(diskMp3Path, 'r');
          try {
            fs.readSync(fd, head, 0, 12, 0);
          } finally {
            fs.closeSync(fd);
          }
          const isMp3 =
            head.subarray(0, 3).toString('ascii') === 'ID3' ||
            (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
          assert.ok(stat.size >= 1024, `${diskMp3Path} unexpectedly small`);
          assert.ok(isMp3, `${diskMp3Path} must have valid MP3 magic bytes`);
          assert.strictEqual(
            sc.narrationAudioUrl,
            expectedRelUrl,
            `${st.id}:${sc.id} must return its verified local MP3 URL`,
          );
          existingStoryAudioUrls.push(expectedRelUrl);
        } else {
          assert.strictEqual(
            sc.narrationAudioUrl ?? null,
            null,
            `${st.id}:${sc.id} must not fake audio URL when file is missing`,
          );
        }
      }
    }
    assert.ok(distinctDurations.size >= 4, 'Stories should vary naturally in length rather than being identical');

    // Verify real HTTP GET, HEAD, Range 206, and missing 404 JSON (zero HTML fallback)
    if (existingStoryAudioUrls.length > 0) {
      const sampleUrl = existingStoryAudioUrls[0];
      const headRes = await fetch(`${baseUrl}${sampleUrl}`, { method: 'HEAD' });
      assert.strictEqual(headRes.status, 200, `HEAD ${sampleUrl} must return 200`);
      assert.ok((headRes.headers.get('content-type') || '').includes('audio/mpeg'));
      assert.ok(Number(headRes.headers.get('content-length') || 0) >= 1024);

      const getRes = await fetch(`${baseUrl}${sampleUrl}`, { method: 'GET' });
      assert.strictEqual(getRes.status, 200, `GET ${sampleUrl} must return 200`);
      assert.ok((getRes.headers.get('content-type') || '').includes('audio/mpeg'));

      const rangeRes = await fetch(`${baseUrl}${sampleUrl}`, {
        method: 'GET',
        headers: { Range: 'bytes=0-255' },
      });
      assert.strictEqual(rangeRes.status, 206, `Range request on ${sampleUrl} must return 206 Partial Content`);
      assert.ok((rangeRes.headers.get('content-range') || '').startsWith('bytes 0-255/'));
      const chunk = Buffer.from(await rangeRes.arrayBuffer());
      assert.strictEqual(chunk.length, 256);
    }

    const missingAudioRes = await fetch(`${baseUrl}/assets/audio/stories/qstory-elephant/does-not-exist.mp3`);
    assert.strictEqual(missingAudioRes.status, 404, 'Missing story MP3 must return 404 (not SPA HTML)');
    assert.ok(!(missingAudioRes.headers.get('content-type') || '').includes('text/html'));

    console.log(
      `PASS [1]: All 8 curated Quran stories verified (${existingStoryAudioUrls.length}/41 local MP3s verified via binary & HTTP Range 206; honest null for ungenerated scenes).`,
    );

    // 4. Child interactive playback progression & idempotent persistence
    const targetStory = stories[0];
    const firstActScene = targetStory.scenes.find((sc) => Boolean(sc.activity))!;
    const secondActScene = targetStory.scenes.filter((sc) => Boolean(sc.activity))[1];

    const startRes = await child.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      { storyId: targetStory.id, action: 'start', sceneIndex: 0 },
    );
    assert.strictEqual(startRes.status, 200);

    const sceneProgRes = await child.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      {
        storyId: targetStory.id,
        action: 'scene_progress',
        sceneIndex: 1,
        sceneId: targetStory.scenes[0].id,
        listenedSecondsDelta: 35,
      },
    );
    assert.strictEqual(sceneProgRes.status, 200);

    const act1Res = await child.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      {
        storyId: targetStory.id,
        action: 'interaction',
        sceneIndex: 1,
        interactionId: firstActScene.activity!.id,
      },
    );
    assert.strictEqual(act1Res.status, 200);

    const act2Res = await child.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      {
        storyId: targetStory.id,
        action: 'interaction',
        sceneIndex: 2,
        interactionId: secondActScene.activity!.id,
      },
    );
    assert.strictEqual(act2Res.status, 200);

    const token = `tok-${crypto.randomUUID()}`;
    const complete1 = await child.req<{ storyProgressDetails: QuranStoryProgressDetails }>(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      {
        storyId: targetStory.id,
        action: 'complete',
        sceneIndex: targetStory.scenes.length - 1,
        quizCompleted: true,
        closingActivityCompleted: true,
        listenedSecondsDelta: 40,
        completionToken: token,
      },
    );
    assert.strictEqual(complete1.status, 200);
    assert.strictEqual(complete1.data.storyProgressDetails.completedCount, 1);
    assert.strictEqual(
      complete1.data.storyProgressDetails.completionBadgeAwarded,
      targetStory.completionBadge.id,
    );

    // Retry with identical completionToken must remain idempotent
    const completeRetry = await child.req<{ storyProgressDetails: QuranStoryProgressDetails }>(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      {
        storyId: targetStory.id,
        action: 'complete',
        sceneIndex: targetStory.scenes.length - 1,
        quizCompleted: true,
        closingActivityCompleted: true,
        completionToken: token,
      },
    );
    assert.strictEqual(completeRetry.status, 200);
    assert.strictEqual(
      completeRetry.data.storyProgressDetails.completedCount,
      1,
      'Duplicate completionToken must not double-increment completedCount',
    );

    // Parent reloads child summary and inspects persistence + ensures zero memorization leakage
    const reloadSummary = await parent.req<{
      growthSummary: { storiesReadCount: number; parentConfirmedCount: number };
      storyProgressDetails: QuranStoryProgressDetails[];
    }>(baseUrl, 'GET', `/api/children/${encodeURIComponent(childId)}/quran`);
    assert.strictEqual(reloadSummary.status, 200);
    assert.strictEqual(reloadSummary.data.growthSummary.storiesReadCount, 1);
    assert.strictEqual(
      reloadSummary.data.growthSummary.parentConfirmedCount,
      0,
      'Story completion must NEVER confirm Quran Surah memorization',
    );
    const savedDetail = reloadSummary.data.storyProgressDetails.find(
      (d) => d.storyId === targetStory.id,
    );
    assert.ok(savedDetail, 'Persisted story detail missing in child summary');
    assert.strictEqual(savedDetail.completed, true);
    assert.ok(savedDetail.startedAt);
    assert.ok(savedDetail.completedAt);
    assert.strictEqual(savedDetail.listenedSeconds, 75);
    assert.strictEqual(savedDetail.interactionsCompleted.length, 2);
    console.log('PASS [2]: Interactive progression, activities, badge, idempotency, & parent summary persistence verified.');

    // 5. Security Isolation: Cross-family & Teacher RBAC + Admin CMS Protection
    const otherParent = new IsolatedClient();
    const otherReg = await otherParent.req(baseUrl, 'POST', '/api/auth/register', {
      displayName: 'Unrelated Parent',
      email: `oth.${crypto.randomBytes(4).toString('hex')}@example.com`,
      password: parentPw,
      termsAccepted: true,
    });
    assert.strictEqual(otherReg.status, 201);
    const crossRead = await otherParent.req(
      baseUrl,
      'GET',
      `/api/children/${encodeURIComponent(childId)}/quran`,
    );
    assert.ok(crossRead.status === 403 || crossRead.status === 404, 'Unrelated family must be blocked');

    const teacher = new IsolatedClient();
    const teacherEmail = `tch.st.${crypto.randomBytes(4).toString('hex')}@example.com`;
    const teacherPw = `Tch3r!${crypto.randomBytes(8).toString('hex')}5M`;
    const tReg = await teacher.req<{ user?: { id: string } }>(
      baseUrl,
      'POST',
      '/api/auth/register-teacher',
      {
        displayName: 'Arabic Teacher',
        email: teacherEmail,
        password: teacherPw,
        termsAccepted: true,
        subjects: ['arabic'],
      },
    );
    assert.strictEqual(tReg.status, 201);
    await admin.req(
      baseUrl,
      'POST',
      `/api/admin/teachers/${encodeURIComponent(tReg.data.user!.id)}/approve`,
      {},
    );
    await teacher.req(baseUrl, 'POST', '/api/auth/login', {
      email: teacherEmail,
      password: teacherPw,
      portal: 'teacher',
    });

    const tStoryBlock = await teacher.req(
      baseUrl,
      'POST',
      `/api/children/${encodeURIComponent(childId)}/quran/story/progress`,
      { storyId: targetStory.id, action: 'start', sceneIndex: 0 },
    );
    assert.strictEqual(tStoryBlock.status, 403, 'Teacher must get 403 on family Quran stories');

    const nonAdminCms = await parent.req(baseUrl, 'GET', '/api/admin/quran/stories');
    assert.strictEqual(nonAdminCms.status, 403, 'Parent must get 403 on Admin Stories CMS');
    console.log('PASS [3]: Family isolation, teacher 403 block, and non-admin CMS 403 verified.');

    // 6. Admin CMS Workflow: draft hiding, URL validation, scene reorder, republish
    const cmsList = await admin.req<{ stories: QuranStorySpec[] }>(
      baseUrl,
      'GET',
      '/api/admin/quran/stories',
    );
    assert.strictEqual(cmsList.status, 200);
    assert.strictEqual(cmsList.data.stories.length, 8);

    // Unsafe audio URL rejected
    const unsafeAudio = await admin.req(
      baseUrl,
      'PUT',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}`,
      {
        sceneOverrides: {
          [targetStory.scenes[0].id]: {
            id: targetStory.scenes[0].id,
            narrationAudioUrl: 'javascript:alert(1)',
          },
        },
      },
    );
    assert.strictEqual(unsafeAudio.status, 400, 'Unsafe javascript: narrationAudioUrl must be rejected 400');

    // Set story to draft & reorder scenes
    const reorderedIds = [...targetStory.scenes.map((s) => s.id)].reverse();
    const toDraft = await admin.req<{ story: QuranStorySpec }>(
      baseUrl,
      'PUT',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}`,
      {
        publishedStatus: 'draft',
        sceneOrder: reorderedIds,
      },
    );
    assert.strictEqual(toDraft.status, 200);
    assert.strictEqual(toDraft.data.story.publishedStatus, 'draft');
    assert.deepStrictEqual(
      toDraft.data.story.scenes.map((s) => s.id),
      reorderedIds,
    );

    // Child / Parent must NOT see draft even with ?preview=1
    const childPreviewAttempt = await child.req<{ stories: QuranStorySpec[] }>(
      baseUrl,
      'GET',
      '/api/quran/stories?preview=1',
    );
    assert.strictEqual(childPreviewAttempt.status, 200);
    assert.strictEqual(
      childPreviewAttempt.data.stories.length,
      7,
      'Non-admin ?preview=1 must never expose draft stories',
    );

    // Admin ?preview=1 sees all 8 including draft
    const adminPreviewRes = await admin.req<{ stories: QuranStorySpec[] }>(
      baseUrl,
      'GET',
      '/api/quran/stories?preview=1',
    );
    assert.strictEqual(adminPreviewRes.status, 200);
    assert.strictEqual(adminPreviewRes.data.stories.length, 8);

    // Restore published status and original order
    const restoreRes = await admin.req<{ story: QuranStorySpec }>(
      baseUrl,
      'PUT',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}`,
      {
        publishedStatus: 'published',
        sceneOrder: targetStory.scenes.map((s) => s.id),
      },
    );
    assert.strictEqual(restoreRes.status, 200);
    assert.strictEqual(restoreRes.data.story.publishedStatus, 'published');
    console.log('PASS [4]: Admin CMS draft gating, ?preview=1 RBAC, unsafe URL 400 block, and scene reorder verified.');

    // 7. Audio Manifest (8 stories / 41 scenes), RBAC, asset validation, and fake/missing audio prevention
    const parentManifestBlock = await parent.req(baseUrl, 'GET', '/api/admin/quran/stories/audio-manifest');
    assert.strictEqual(parentManifestBlock.status, 403, 'Parent must get 403 on audio manifest');

    const parentValidateBlock = await parent.req(baseUrl, 'POST', '/api/admin/quran/stories/validate-audio', {
      url: '/assets/audio/technical-test-chime.wav',
    });
    assert.strictEqual(parentValidateBlock.status, 403, 'Parent must get 403 on validate-audio');

    const parentGenBlock = await parent.req(
      baseUrl,
      'POST',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}/scenes/${encodeURIComponent(targetStory.scenes[0].id)}/generate-audio`,
      {},
    );
    assert.strictEqual(parentGenBlock.status, 403, 'Parent must get 403 on generate-audio');

    const manifestRes = await admin.req<{
      totalStories: number;
      totalScenes: number;
      totalRequiredAssets: number;
      validAudioCount: number;
      missingAudioCount: number;
      invalidAudioCount: number;
      items: Array<{
        storyId: string;
        sceneId: string;
        assetStatus: 'valid' | 'missing' | 'invalid';
        reviewFlag?: { reasonAr: string; reasonEn: string };
      }>;
    }>(baseUrl, 'GET', '/api/admin/quran/stories/audio-manifest');
    assert.strictEqual(manifestRes.status, 200);
    assert.strictEqual(manifestRes.data.totalStories, 8, 'Manifest must cover all 8 stories');
    assert.strictEqual(manifestRes.data.totalScenes, 41, 'Manifest must cover all 41 story scenes');
    assert.strictEqual(manifestRes.data.totalRequiredAssets, 41);
    assert.strictEqual(manifestRes.data.items.length, 41);
    const ibrahimFlagged = manifestRes.data.items.find((it) => it.sceneId === 'ibrahim-s1');
    const caveFlagged = manifestRes.data.items.find((it) => it.sceneId === 'cave-s5');
    assert.ok(ibrahimFlagged?.reviewFlag?.reasonEn, 'ibrahim-s1 must carry editorial review flag');
    assert.ok(caveFlagged?.reviewFlag?.reasonEn, 'cave-s5 must carry editorial review flag');

    // Nonexistent local file must be rejected 400 on both validate-audio and PUT
    const missingValidate = await admin.req(baseUrl, 'POST', '/api/admin/quran/stories/validate-audio', {
      url: '/assets/audio/stories/qstory-elephant/does-not-exist.mp3',
    });
    assert.strictEqual(missingValidate.status, 400, 'Nonexistent local audio file must fail validation 400');

    const missingAttach = await admin.req(
      baseUrl,
      'PUT',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}`,
      {
        sceneOverrides: {
          [targetStory.scenes[0].id]: {
            id: targetStory.scenes[0].id,
            narrationAudioUrl: '/assets/audio/stories/qstory-elephant/does-not-exist.mp3',
          },
        },
      },
    );
    assert.strictEqual(missingAttach.status, 400, 'Saving broken/nonexistent narrationAudioUrl must be rejected 400');

    // SSRF loopback URL must be rejected 400
    const ssrfAttempt = await admin.req(baseUrl, 'POST', '/api/admin/quran/stories/validate-audio', {
      url: 'https://127.0.0.1/test.mp3',
    });
    assert.strictEqual(ssrfAttempt.status, 400, 'SSRF loopback HTTPS URL must be rejected 400');

    // Real audio asset on disk passes validation, attaches, appears as valid in manifest, and cleans up cleanly
    const realValidate = await admin.req<{
      validation: { valid: boolean; bytes: number; durationSeconds: number | null; mimeType: string | null };
    }>(baseUrl, 'POST', '/api/admin/quran/stories/validate-audio', {
      url: '/assets/audio/technical-test-chime.wav',
    });
    assert.strictEqual(realValidate.status, 200, 'Real verified audio file must pass validate-audio');
    assert.strictEqual(realValidate.data.validation.valid, true);
    assert.ok(realValidate.data.validation.bytes > 1024);

    const attachReal = await admin.req<{ story: QuranStorySpec }>(
      baseUrl,
      'PUT',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}`,
      {
        sceneOverrides: {
          [targetStory.scenes[0].id]: {
            id: targetStory.scenes[0].id,
            narrationAudioUrl: '/assets/audio/technical-test-chime.wav',
          },
        },
      },
    );
    assert.strictEqual(attachReal.status, 200);
    assert.strictEqual(
      attachReal.data.story.scenes[0].narrationAudioUrl,
      '/assets/audio/technical-test-chime.wav',
    );

    const clearAttached = await admin.req<{ story: QuranStorySpec }>(
      baseUrl,
      'PUT',
      `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}`,
      {
        sceneOverrides: {
          [targetStory.scenes[0].id]: {
            id: targetStory.scenes[0].id,
            narrationAudioUrl: null,
          },
        },
      },
    );
    assert.strictEqual(clearAttached.status, 200);
    assert.strictEqual(clearAttached.data.story.scenes[0].narrationAudioUrl ?? null, null);

    // Without GEMINI_API_KEY in isolated env, generate-audio returns clean 503 (never fake audio)
    if (!process.env.GEMINI_API_KEY) {
      const noTtsGen = await admin.req(
        baseUrl,
        'POST',
        `/api/admin/quran/stories/${encodeURIComponent(targetStory.id)}/scenes/${encodeURIComponent(targetStory.scenes[0].id)}/generate-audio`,
        {},
      );
      assert.strictEqual(noTtsGen.status, 503, 'Missing GEMINI_API_KEY must fail closed 503 without creating fake audio');
    }

    console.log(
      `PASS [5]: 41-scene audio manifest (${manifestRes.data.validAudioCount} valid / ${manifestRes.data.missingAudioCount} missing), RBAC 403, missing/SSRF 400 blocks, real asset verification, and fail-closed TTS verified.`,
    );
  } finally {
    stopChild(proc);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
