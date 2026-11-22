import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { AcademyAudioManifestDocument } from '../server/academyAudioManifestBuilder';
import {
  ACADEMY_LOOKUP_FILE,
  ACADEMY_MANIFEST_FILE,
  validateAcademyMp3File,
} from '../server/academyAudioService';
import { STORY_AUDIO_PUBLIC_DIR, validateStoryAudioAsset } from '../server/storyAudioService';
import { ALL_LEVEL1_LESSONS } from '../src/data/level1Curriculum';
import { VALIDATED_EXAM_BANK } from '../src/data/deepCurriculum';
import { normalizeAcademyAudioText } from '../src/utils/academyAudioText';

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
  console.log('[1/5] Auditing Academy Audio Manifest & Coverage...');
  assert(fs.existsSync(ACADEMY_MANIFEST_FILE), 'data/academy-audio-manifest.json must exist');
  assert(fs.existsSync(ACADEMY_LOOKUP_FILE), 'src/data/academyAudioLookup.json must exist');

  const manifest = JSON.parse(
    fs.readFileSync(ACADEMY_MANIFEST_FILE, 'utf8'),
  ) as AcademyAudioManifestDocument;
  const lookup = JSON.parse(fs.readFileSync(ACADEMY_LOOKUP_FILE, 'utf8')) as {
    ar: Record<string, string>;
    en: Record<string, string>;
  };

  assert(manifest.totalAssets > 1400, `Expected full Academy manifest (>1400 assets), got ${manifest.totalAssets}`);
  assert.strictEqual(manifest.totalAssets, manifest.items.length, 'totalAssets must equal items.length');
  assert.strictEqual(
    manifest.arabicAssets + manifest.englishAssets,
    manifest.totalAssets,
    'arabicAssets + englishAssets must equal totalAssets',
  );

  // Deduplication check
  const seenKeys = new Set<string>();
  const screenSet = new Set<string>();
  const lessonSet = new Set<string>();
  for (const item of manifest.items) {
    const dedupKey = `${item.language}|${normalizeAcademyAudioText(item.text)}`;
    assert(!seenKeys.has(dedupKey), `Duplicate manifest entry for ${dedupKey}`);
    seenKeys.add(dedupKey);
    for (const s of item.screens) screenSet.add(s);
    for (const l of item.lessonIds) lessonSet.add(l);
  }

  for (const requiredScreen of [
    'AcademyScreen:arabic',
    'AcademyScreen:english',
    'AcademyScreen:numbers',
    'AcademyScreen:colors-shapes',
    'AcademyScreen:daily',
    'Level1LessonRunner',
    'Level1LessonRunner:stage10',
    'DeepLessonEngine:color',
    'DeepLessonEngine:arabic',
    'DeepLessonEngine:english',
    'DeepLessonEngine:math',
    'ExamsScreen',
  ]) {
    assert(screenSet.has(requiredScreen), `Manifest missing screen coverage: ${requiredScreen}`);
  }

  assert.strictEqual(ALL_LEVEL1_LESSONS.length, 75, 'Expected 75 Level 1 lessons');
  for (const lesson of ALL_LEVEL1_LESSONS) {
    assert(lessonSet.has(lesson.id), `Manifest missing Level 1 lessonId: ${lesson.id}`);
  }

  const uniqueExamTexts = new Set(
    VALIDATED_EXAM_BANK.filter((q) => Boolean(q.audioText)).map(
      (q) => `${q.audioLang || 'ar'}|${normalizeAcademyAudioText(q.audioText!)}`,
    ),
  );
  const manifestExamItems = manifest.items.filter((i) => i.screens.includes('ExamsScreen'));
  assert(
    manifestExamItems.length >= uniqueExamTexts.size,
    `Manifest missing exam bank audio coverage (${manifestExamItems.length} < ${uniqueExamTexts.size})`,
  );

  console.log(
    `   ✓ Manifest verified: ${manifest.totalAssets} unique items (${manifest.arabicAssets} AR, ${manifest.englishAssets} EN) across ${screenSet.size} screen buckets and all 75 Level 1 lessons.`,
  );

  console.log('[2/5] Validating Stored MP3 Files & Honesty of Client Lookup...');
  const validItems = manifest.items.filter((i) => i.validationStatus === 'valid');
  let lookupValidEntries = 0;
  for (const item of manifest.items) {
    const clean = normalizeAcademyAudioText(item.text);
    const mappedId = (item.language === 'en' ? lookup.en : lookup.ar)?.[clean];
    if (item.validationStatus === 'valid') {
      assert.strictEqual(item.generationStatus, 'ready', `Valid item ${item.assetId} must have generationStatus=ready`);
      assert.strictEqual(mappedId, item.assetId, `Lookup map must point to ${item.assetId}`);
      lookupValidEntries++;

      const absPath = path.resolve(process.cwd(), item.mp3Path);
      const check = await validateAcademyMp3File(absPath, true);
      assert(check.valid, `Valid manifest MP3 failed re-validation (${item.mp3Path}): ${check.reason}`);
      assert.strictEqual(check.mimeType, 'audio/mpeg');
      assert(check.durationSeconds !== null && check.durationSeconds >= 0.2);
      assert(check.maxVolumeDb === null || check.maxVolumeDb > -48, `Silent audio detected: ${item.assetId}`);
    } else {
      assert.strictEqual(
        mappedId,
        undefined,
        `Unrecorded item ${item.assetId} must NOT appear in client lookup (no fake audio)`,
      );
    }
  }
  assert.strictEqual(lookupValidEntries, validItems.length);
  console.log(
    `   ✓ On-disk audit: valid=${manifest.validCount}, missing=${manifest.missingCount}, invalid=${manifest.invalidCount} (lookup matches validCount exactly).`,
  );

  if (process.env.STRICT_ACADEMY_AUDIO_COMPLETE === '1') {
    assert.strictEqual(manifest.missingCount, 0, `STRICT mode: ${manifest.missingCount} Academy MP3 files missing`);
    assert.strictEqual(manifest.invalidCount, 0, `STRICT mode: ${manifest.invalidCount} Academy MP3 files invalid`);
  }

  console.log('[3/5] Auditing Academy Client Code for Zero speechSynthesis / Runtime TTS...');
  const academyFiles = [
    'src/screens/AcademyScreen.tsx',
    'src/components/academy/Level1LessonRunner.tsx',
    'src/components/academy/DeepLessonEngine.tsx',
    'src/components/academy/AcademyAudioBar.tsx',
    'src/screens/ExamsScreen.tsx',
    'src/utils/academyAudioController.ts',
  ];
  for (const rel of academyFiles) {
    const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert(!/speechSynthesis/.test(content), `${rel} must NOT reference window.speechSynthesis`);
    assert(!/soundEngine\.speak/.test(content), `${rel} must NOT call soundEngine.speak`);
    assert(!/\/api\/academy\/tts(?!-status)/.test(content), `${rel} must NOT call POST /api/academy/tts`);
  }
  console.log(`   ✓ Verified zero runtime TTS / speechSynthesis calls across all ${academyFiles.length} Academy audio modules.`);

  console.log('[4/5] Verifying Quran Story MP3s (41 assets) remain untouched & valid...');
  let storyValid = 0;
  for (const storyDir of fs.readdirSync(STORY_AUDIO_PUBLIC_DIR)) {
    const fullDir = path.join(STORY_AUDIO_PUBLIC_DIR, storyDir);
    if (!fs.statSync(fullDir).isDirectory()) continue;
    for (const file of fs.readdirSync(fullDir)) {
      if (!file.endsWith('.mp3')) continue;
      const v = await validateStoryAudioAsset(`/assets/audio/stories/${storyDir}/${file}`);
      assert(v.valid, `Quran story asset invalid: ${storyDir}/${file}: ${v.reason}`);
      storyValid++;
    }
  }
  assert.strictEqual(storyValid, 41, `Expected all 41 Quran story MP3s intact, found ${storyValid}`);
  console.log(`   ✓ All 41 Quran Story MP3 assets validated intact.`);

  console.log('[5/5] Verifying Offline / Quota-Exhausted Server Behavior & Nono AI Separation...');
  const port = 3197;
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      SKIP_VITE: '1',
      GEMINI_API_KEY: '', // Explicitly simulate exhausted/missing Gemini TTS key
      SQL_HOST: '',
      SQL_DB_NAME: '',
      SQL_USER: '',
      SQL_PASSWORD: '',
      DATABASE_URL: '',
      REQUIRE_POSTGRES: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForReady(baseUrl);

    // 1. tts-status reports pregenerated-mp3 mode even with GEMINI_API_KEY=""
    const statusRes = await fetch(`${baseUrl}/api/academy/tts-status`);
    assert.strictEqual(statusRes.status, 200);
    const statusJson = (await statusRes.json()) as {
      configured: boolean;
      academyAudioMode: string;
      runtimeTtsDisabledForAcademy: boolean;
      manifestSummary: { totalAssets: number; validCount: number };
    };
    assert.strictEqual(statusJson.configured, false);
    assert.strictEqual(statusJson.academyAudioMode, 'pregenerated-mp3');
    assert.strictEqual(statusJson.runtimeTtsDisabledForAcademy, true);
    assert.strictEqual(statusJson.manifestSummary.totalAssets, manifest.totalAssets);

    // 2. Runtime POST /api/academy/tts returns 410 Gone
    const disabledRes = await fetch(`${baseUrl}/api/academy/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'أسد', language: 'ar' }),
    });
    assert.strictEqual(disabledRes.status, 410, 'POST /api/academy/tts must return 410 Gone');

    // 3. Static MP3 delivery works via GET, HEAD, and Range: 206 even with GEMINI_API_KEY=""
    if (validItems.length > 0) {
      const sample = validItems[0];
      const relUrl = `/assets/audio/academy/${sample.language}/${sample.assetId}.mp3`;

      const headRes = await fetch(`${baseUrl}${relUrl}`, { method: 'HEAD' });
      assert.strictEqual(headRes.status, 200, `HEAD ${relUrl} failed`);
      assert.strictEqual(headRes.headers.get('content-type'), 'audio/mpeg');
      assert.strictEqual(headRes.headers.get('accept-ranges'), 'bytes');

      const getRes = await fetch(`${baseUrl}${relUrl}`);
      assert.strictEqual(getRes.status, 200, `GET ${relUrl} failed`);
      const buf = Buffer.from(await getRes.arrayBuffer());
      assert.strictEqual(buf.length, sample.bytes);

      const rangeRes = await fetch(`${baseUrl}${relUrl}`, {
        headers: { Range: 'bytes=0-1023' },
      });
      assert.strictEqual(rangeRes.status, 206, `Range request on ${relUrl} must return 206`);
      const slice = Buffer.from(await rangeRes.arrayBuffer());
      assert.strictEqual(slice.length, 1024);
    }

    // 4. Missing asset fails closed with 404 JSON
    const missingRes = await fetch(`${baseUrl}/assets/audio/academy/ar/does-not-exist.mp3`);
    assert.strictEqual(missingRes.status, 404);

    // 5. Nono AI /api/ai/status remains independent
    const nonoStatusRes = await fetch(`${baseUrl}/api/ai/status`);
    assert.strictEqual(nonoStatusRes.status, 200);
    const nonoSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/nonoAiRoutes.ts'), 'utf8');
    assert(nonoSrc.includes("app.post('/api/ai/tts'"), 'Nono AI TTS route must remain intact');
    assert(nonoSrc.includes("app.post('/api/ai/nono-chat'"), 'Nono AI chat route must remain intact');

    console.log('   ✓ Server offline/keyless MP3 delivery, HTTP 206 Range, 410 disabled runtime Academy TTS, 404 fail-closed, and Nono AI separation all verified.');
  } finally {
    stopChild(proc);
  }

  console.log('\n✅ Academy Audio Verification Suite PASSED');
  console.log(
    JSON.stringify({
      totalManifestItems: manifest.totalAssets,
      arabicItems: manifest.arabicAssets,
      englishItems: manifest.englishAssets,
      validRecordings: manifest.validCount,
      missingRecordings: manifest.missingCount,
      invalidRecordings: manifest.invalidCount,
      quranStoriesIntact: storyValid,
    }),
  );
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
