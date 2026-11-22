import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { GoogleGenAI } from '@google/genai';
import {
  type AcademyAudioManifestDocument,
  type AcademyAudioManifestItem,
  buildFullAcademyAudioManifest,
} from './academyAudioManifestBuilder';
import {
  hasValidAudioMagicBytes,
  probeLocalAudioDurationSeconds,
  transcodeAudioBufferToMp3File,
} from './storyAudioService';
import { type AcademyAudioLang, normalizeAcademyAudioText } from '../src/utils/academyAudioText';

const execFileAsync = promisify(execFile);

export const ACADEMY_AUDIO_ROOT_DIR = path.resolve(process.cwd(), 'public', 'assets', 'audio', 'academy');
export const ACADEMY_AUDIO_AR_DIR = path.join(ACADEMY_AUDIO_ROOT_DIR, 'ar');
export const ACADEMY_AUDIO_EN_DIR = path.join(ACADEMY_AUDIO_ROOT_DIR, 'en');
export const ACADEMY_MANIFEST_FILE = path.resolve(process.cwd(), 'data', 'academy-audio-manifest.json');
export const ACADEMY_LOOKUP_FILE = path.resolve(process.cwd(), 'src', 'data', 'academyAudioLookup.json');

export const ACADEMY_TTS_PRIMARY_MODEL = 'gemini-3.8-flash-lite-tts';
export const ACADEMY_TTS_FALLBACK_MODEL = 'gemini-3.8-flash-tts';
export const ACADEMY_TTS_VOICE = 'Zephyr';

export interface AcademyMp3ValidationResult {
  valid: boolean;
  status: 'valid' | 'missing' | 'invalid';
  mimeType: string | null;
  bytes: number;
  durationSeconds: number | null;
  maxVolumeDb: number | null;
  reason?: string;
}

export async function probeAudioMaxVolumeDb(filePath: string): Promise<number | null> {
  try {
    const { stderr } = await execFileAsync(
      'ffmpeg',
      ['-hide_banner', '-nostats', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'],
      { timeout: 10_000 },
    );
    const m = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(stderr || '');
    if (m) {
      const val = Number.parseFloat(m[1]);
      if (Number.isFinite(val)) return val;
    }
    if (/max_volume:\s*-inf\s*dB/i.test(stderr || '')) {
      return -120;
    }
  } catch (err) {
    const stderr = (err as { stderr?: string })?.stderr || '';
    const m = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(stderr);
    if (m) {
      const val = Number.parseFloat(m[1]);
      if (Number.isFinite(val)) return val;
    }
  }
  return null;
}

export async function validateAcademyMp3File(
  absPath: string,
  checkVolume = true,
): Promise<AcademyMp3ValidationResult> {
  if (!fs.existsSync(absPath)) {
    return {
      valid: false,
      status: 'missing',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      maxVolumeDb: null,
      reason: 'MP3 file does not exist on disk.',
    };
  }

  const stat = fs.statSync(absPath);
  if (!stat.isFile() || stat.size < 1024 || stat.size > 5 * 1024 * 1024) {
    return {
      valid: false,
      status: 'invalid',
      mimeType: null,
      bytes: stat.size,
      durationSeconds: null,
      maxVolumeDb: null,
      reason: `MP3 size (${stat.size} bytes) is outside valid range (1KB–5MB).`,
    };
  }

  const fd = fs.openSync(absPath, 'r');
  const head = Buffer.alloc(16);
  try {
    fs.readSync(fd, head, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }

  const magic = hasValidAudioMagicBytes(head);
  if (!magic.ok || magic.mimeType !== 'audio/mpeg') {
    return {
      valid: false,
      status: 'invalid',
      mimeType: magic.mimeType,
      bytes: stat.size,
      durationSeconds: null,
      maxVolumeDb: null,
      reason: `File signature is not audio/mpeg (detected=${magic.mimeType || 'unknown'}).`,
    };
  }

  const durationSeconds = await probeLocalAudioDurationSeconds(absPath);
  if (durationSeconds === null || durationSeconds < 0.2 || durationSeconds > 90) {
    return {
      valid: false,
      status: 'invalid',
      mimeType: 'audio/mpeg',
      bytes: stat.size,
      durationSeconds,
      maxVolumeDb: null,
      reason: `Measured duration (${durationSeconds ?? 'null'}s) is outside allowed range (0.2s–90s).`,
    };
  }

  let maxVolumeDb: number | null = null;
  if (checkVolume) {
    maxVolumeDb = await probeAudioMaxVolumeDb(absPath);
    if (maxVolumeDb !== null && maxVolumeDb <= -48) {
      return {
        valid: false,
        status: 'invalid',
        mimeType: 'audio/mpeg',
        bytes: stat.size,
        durationSeconds,
        maxVolumeDb,
        reason: `Audio appears silent (max_volume=${maxVolumeDb} dB).`,
      };
    }
  }

  return {
    valid: true,
    status: 'valid',
    mimeType: 'audio/mpeg',
    bytes: stat.size,
    durationSeconds,
    maxVolumeDb,
  };
}

export function loadExistingManifestFromDisk(): AcademyAudioManifestItem[] {
  if (!fs.existsSync(ACADEMY_MANIFEST_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ACADEMY_MANIFEST_FILE, 'utf8')) as Partial<AcademyAudioManifestDocument>;
    return Array.isArray(raw.items) ? raw.items : [];
  } catch {
    return [];
  }
}

export function recomputeManifestCounts(items: AcademyAudioManifestItem[]): AcademyAudioManifestDocument {
  const arabicAssets = items.filter((i) => i.language === 'ar').length;
  const englishAssets = items.filter((i) => i.language === 'en').length;
  const readyCount = items.filter((i) => i.generationStatus === 'ready').length;
  const validCount = items.filter((i) => i.validationStatus === 'valid').length;
  const missingCount = items.filter((i) => i.validationStatus === 'missing' || i.validationStatus === 'pending').length;
  const invalidCount = items.filter((i) => i.validationStatus === 'invalid').length;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalAssets: items.length,
    arabicAssets,
    englishAssets,
    readyCount,
    validCount,
    missingCount,
    invalidCount,
    items,
  };
}

export function saveManifestAndClientLookup(doc: AcademyAudioManifestDocument): void {
  fs.mkdirSync(path.dirname(ACADEMY_MANIFEST_FILE), { recursive: true });
  const tmpManifest = `${ACADEMY_MANIFEST_FILE}.tmp`;
  fs.writeFileSync(tmpManifest, JSON.stringify(doc, null, 2));
  fs.renameSync(tmpManifest, ACADEMY_MANIFEST_FILE);

  // Build compact client lookup mapping only for valid assets (never fake unrecorded assets)
  const arMap: Record<string, string> = {};
  const enMap: Record<string, string> = {};
  for (const item of doc.items) {
    if (item.validationStatus === 'valid' && item.generationStatus === 'ready') {
      const key = normalizeAcademyAudioText(item.text);
      if (item.language === 'ar') {
        arMap[key] = item.assetId;
      } else {
        enMap[key] = item.assetId;
      }
    }
  }

  fs.mkdirSync(path.dirname(ACADEMY_LOOKUP_FILE), { recursive: true });
  const tmpLookup = `${ACADEMY_LOOKUP_FILE}.tmp`;
  fs.writeFileSync(tmpLookup, JSON.stringify({ ar: arMap, en: enMap }, null, 2));
  fs.renameSync(tmpLookup, ACADEMY_LOOKUP_FILE);
}

export async function syncAndValidateAcademyManifest(opts?: {
  checkVolume?: boolean;
  migrateLegacy?: boolean;
}): Promise<AcademyAudioManifestDocument> {
  fs.mkdirSync(ACADEMY_AUDIO_AR_DIR, { recursive: true });
  fs.mkdirSync(ACADEMY_AUDIO_EN_DIR, { recursive: true });

  const prev = loadExistingManifestFromDisk();
  const doc = buildFullAcademyAudioManifest(prev);
  const checkVolume = opts?.checkVolume !== false;
  const migrateLegacy = opts?.migrateLegacy !== false;

  for (const item of doc.items) {
    const destPath = path.resolve(process.cwd(), item.mp3Path);

    // Preserve & reuse any already-generated valid legacy file matching legacyCacheKey
    if (migrateLegacy && !fs.existsSync(destPath)) {
      const legacyMp3 = path.join(ACADEMY_AUDIO_ROOT_DIR, `${item.legacyCacheKey}.mp3`);
      if (fs.existsSync(legacyMp3)) {
        const legacyCheck = await validateAcademyMp3File(legacyMp3, true);
        if (legacyCheck.valid) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(legacyMp3, destPath);
        }
      }
    }

    if (!fs.existsSync(destPath)) {
      item.generationStatus = item.generationStatus === 'failed' ? 'failed' : 'pending';
      item.validationStatus = 'missing';
      item.bytes = 0;
      item.durationSeconds = null;
      item.maxVolumeDb = null;
      continue;
    }

    // Fast path: if already validated & size matches on disk, skip heavy ffprobe/ffmpeg unless forced
    const stat = fs.statSync(destPath);
    if (
      !checkVolume &&
      item.validationStatus === 'valid' &&
      item.generationStatus === 'ready' &&
      item.bytes === stat.size &&
      stat.size >= 1024
    ) {
      continue;
    }

    const res = await validateAcademyMp3File(destPath, checkVolume);
    if (res.valid) {
      item.generationStatus = 'ready';
      item.validationStatus = 'valid';
      item.bytes = res.bytes;
      item.durationSeconds = res.durationSeconds;
      if (res.maxVolumeDb !== null) item.maxVolumeDb = res.maxVolumeDb;
      item.lastError = undefined;
    } else {
      item.generationStatus = 'failed';
      item.validationStatus = res.status;
      item.bytes = res.bytes;
      item.durationSeconds = res.durationSeconds;
      item.maxVolumeDb = res.maxVolumeDb;
      item.lastError = res.reason;
    }
  }

  const finalDoc = recomputeManifestCounts(doc.items);
  saveManifestAndClientLookup(finalDoc);
  return finalDoc;
}

function wrapPcmOrAudioToBuffer(base64Audio: string, mimeType?: string): { buffer: Buffer; mimeType: string } {
  const raw = Buffer.from(base64Audio, 'base64');
  const magic = hasValidAudioMagicBytes(raw);
  if (magic.ok && magic.mimeType) {
    return { buffer: raw, mimeType: magic.mimeType };
  }
  const mt = (mimeType || '').toLowerCase();
  let sampleRate = 24000;
  const rateMatch = mt.match(/rate=(\d+)/);
  if (rateMatch) {
    const parsed = Number(rateMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 8000 && parsed <= 48000) sampleRate = parsed;
  }
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + raw.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(raw.length, 40);
  return { buffer: Buffer.concat([header, raw]), mimeType: 'audio/wav' };
}

function parseTtsError(err: unknown): {
  isQuota429: boolean;
  isDailyExhausted: boolean;
  isTransient: boolean;
  isFatalAuth: boolean;
  retryDelayMs: number;
  summary: string;
} {
  let raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  try {
    const extra = JSON.stringify(err);
    if (extra && extra.length > raw.length && extra !== '{}') raw = `${raw} ${extra}`;
  } catch {
    // ignore
  }
  const redacted = raw.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]');
  const isFatalAuth = /\b401\b|\b403\b|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/i.test(redacted);
  const isQuota429 = /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(redacted);
  const quotaIds = [...redacted.matchAll(/"quotaId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  const hasPerMin = quotaIds.some((id) => /PerMinute/i.test(id));
  const hasPerDay =
    quotaIds.some((id) => /PerDay/i.test(id)) ||
    (/GenerateRequestsPerDay|RequestsPerDay/i.test(redacted) && !hasPerMin);
  const isDailyExhausted = isQuota429 && hasPerDay && !hasPerMin;

  let retryDelayMs = 12_000;
  const r1 = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i.exec(redacted);
  const r2 = /retry\s+in\s+(\d+(?:\.\d+)?)s/i.exec(redacted);
  const sec = Number(r1?.[1] || r2?.[1] || 0);
  if (Number.isFinite(sec) && sec > 0) {
    retryDelayMs = Math.min(75_000, Math.max(4_000, Math.ceil((sec + 1.5) * 1000)));
  }

  const isTransient =
    isQuota429 ||
    /\b500\b|\b502\b|\b503\b|\b504\b|UNAVAILABLE|timeout|abort|ECONNRESET|ETIMEDOUT|fetch failed/i.test(redacted);

  const quotaMetric = quotaIds.length ? `quota=[${quotaIds.join(',')}] ` : '';
  return {
    isQuota429,
    isDailyExhausted,
    isTransient,
    isFatalAuth,
    retryDelayMs,
    summary: `${quotaMetric}${redacted}`.slice(0, 1500),
  };
}

export async function generateAcademyAudioItem(
  item: AcademyAudioManifestItem,
  opts?: { preferredModel?: string; skipModels?: Set<string> },
): Promise<{
  ok: true;
  model: string;
  bytes: number;
  durationSeconds: number | null;
  maxVolumeDb: number | null;
} | {
  ok: false;
  isQuota429: boolean;
  isDailyExhausted: boolean;
  isFatalAuth: boolean;
  retryDelayMs: number;
  dailyExhaustedModels: string[];
  error: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      isQuota429: false,
      isDailyExhausted: false,
      isFatalAuth: true,
      retryDelayMs: 0,
      dailyExhaustedModels: [],
      error: 'GEMINI_API_KEY not configured.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const baseOrder = opts?.preferredModel
    ? Array.from(new Set([opts.preferredModel, ACADEMY_TTS_PRIMARY_MODEL, ACADEMY_TTS_FALLBACK_MODEL]))
    : [ACADEMY_TTS_PRIMARY_MODEL, ACADEMY_TTS_FALLBACK_MODEL];
  const models = opts?.skipModels?.size
    ? baseOrder.filter((m) => !opts.skipModels!.has(m))
    : baseOrder;

  if (models.length === 0) {
    return {
      ok: false,
      isQuota429: true,
      isDailyExhausted: true,
      isFatalAuth: false,
      retryDelayMs: 0,
      dailyExhaustedModels: baseOrder,
      error: 'All configured TTS models reached daily quota limit.',
    };
  }

  const isArLetterChar = item.activityOrStageIds.includes('letter-char');
  const isArLetterName = item.activityOrStageIds.includes('letter-name');
  const isEnLetter =
    item.activityOrStageIds.includes('letter-upper') || item.activityOrStageIds.includes('letter-lower');
  const isNumberItem = item.screens.includes('AcademyScreen:numbers');

  const style =
    item.language === 'ar'
      ? isArLetterChar || isArLetterName
        ? 'Warm, gentle, consistent Egyptian-friendly Arabic early-childhood teacher voice for ages 1 to 4. Pronounce ONLY the exact Arabic letter name clearly and distinctly, with no extra words, no chanting, and no long pauses.'
        : isNumberItem
          ? 'Warm, gentle, consistent Arabic early-childhood teacher voice for ages 1 to 4. Say ONLY this Arabic number clearly and naturally, with no extra commentary.'
          : 'Warm, gentle, consistent, child-directed Egyptian-friendly Arabic early-childhood teacher voice for ages 1 to 4. Clear, cheerful articulation, no long pauses, never chanting or Quran recitation.'
      : isEnLetter
        ? 'Warm, cheerful, natural English early-childhood teacher voice for ages 1 to 4. Pronounce ONLY the English alphabet letter name clearly and distinctly, with no extra words or pauses.'
        : isNumberItem
          ? 'Warm, cheerful, natural English early-childhood teacher voice for ages 1 to 4. Say ONLY this English number clearly and naturally, with no extra commentary.'
          : 'Warm, cheerful, natural, consistent English early-childhood teacher voice for ages 1 to 4. Clear phonics and gentle pacing, no long pauses.';

  let lastDiag = {
    isQuota429: false,
    isDailyExhausted: false,
    isFatalAuth: false,
    retryDelayMs: 5000,
    summary: 'Synthesis did not complete.',
  };
  const dailyExhaustedModels: string[] = [];

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28_000);
    try {
      const partPayload = /^gemini-3\.8-/i.test(model)
        ? { text: item.text, speechMetadata: { style } }
        : { text: `${item.language === 'ar' ? 'انطق بلطف ووضوح للأطفال' : 'Speak clearly and warmly for a young child'}: ${item.text}` };
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [partPayload],
          },
        ],
        config: {
          abortSignal: controller.signal,
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: ACADEMY_TTS_VOICE },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const inline = parts.find((p) => Boolean(p?.inlineData?.data))?.inlineData;
      if (!inline?.data) {
        lastDiag = {
          isQuota429: false,
          isDailyExhausted: false,
          isFatalAuth: false,
          retryDelayMs: 2500,
          summary: `Model ${model} returned empty audio payload.`,
        };
        continue;
      }

      const wrapped = wrapPcmOrAudioToBuffer(inline.data, inline.mimeType);
      if (wrapped.buffer.length < 256) {
        lastDiag = {
          isQuota429: false,
          isDailyExhausted: false,
          isFatalAuth: false,
          retryDelayMs: 2500,
          summary: `Model ${model} returned undersized buffer (${wrapped.buffer.length} bytes).`,
        };
        continue;
      }

      const destPath = path.resolve(process.cwd(), item.mp3Path);
      const tmpDest = path.join(path.dirname(destPath), `.tmp-${crypto.randomUUID()}.mp3`);
      await transcodeAudioBufferToMp3File(wrapped.buffer, tmpDest, wrapped.mimeType);
      const val = await validateAcademyMp3File(tmpDest, true);
      if (!val.valid) {
        if (fs.existsSync(tmpDest)) fs.unlinkSync(tmpDest);
        lastDiag = {
          isQuota429: false,
          isDailyExhausted: false,
          isFatalAuth: false,
          retryDelayMs: 2500,
          summary: val.reason || 'Generated MP3 failed audio/silence validation.',
        };
        continue;
      }

      fs.renameSync(tmpDest, destPath);
      return {
        ok: true,
        model,
        bytes: val.bytes,
        durationSeconds: val.durationSeconds,
        maxVolumeDb: val.maxVolumeDb,
      };
    } catch (err) {
      const diag = parseTtsError(err);
      lastDiag = {
        ...diag,
        summary: `[${model}] ${diag.summary}`,
      };
      if (diag.isDailyExhausted) {
        dailyExhaustedModels.push(model);
      }
      if (diag.isFatalAuth) break;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    isQuota429: lastDiag.isQuota429,
    isDailyExhausted:
      lastDiag.isDailyExhausted ||
      (dailyExhaustedModels.length > 0 && dailyExhaustedModels.length >= models.length),
    isFatalAuth: lastDiag.isFatalAuth,
    retryDelayMs: lastDiag.retryDelayMs,
    dailyExhaustedModels,
    error: lastDiag.summary,
  };
}

export interface AcademyBatchStatus {
  running: boolean;
  state: 'idle' | 'running' | 'completed' | 'partial' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  totalAssets: number;
  validCount: number;
  pendingCount: number;
  failedCount: number;
  attemptedThisRun: number;
  succeededThisRun: number;
  currentAssetId: string | null;
  currentText: string | null;
  activeModel: string;
  delayMs: number;
  lastError: string | null;
}

const batchStatus: AcademyBatchStatus = {
  running: false,
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  totalAssets: 0,
  validCount: 0,
  pendingCount: 0,
  failedCount: 0,
  attemptedThisRun: 0,
  succeededThisRun: 0,
  currentAssetId: null,
  currentText: null,
  activeModel: ACADEMY_TTS_PRIMARY_MODEL,
  delayMs: 1200,
  lastError: null,
};

let activeBatchPromise: Promise<AcademyBatchStatus> | null = null;
let stopRequested = false;

export function getAcademyBatchStatus(): AcademyBatchStatus {
  return { ...batchStatus };
}

export function requestStopAcademyBatch(): void {
  stopRequested = true;
}

export async function diagnoseGeminiTtsAvailability(): Promise<{
  configured: boolean;
  listedTtsAndAudioModels: Array<{
    name: string;
    displayName?: string;
    supportedActions?: string[];
  }>;
  modelProbes: Array<{
    model: string;
    available: boolean;
    httpStatus: number;
    outcome: 'ok' | 'rate_limit_rpm' | 'daily_quota_exhausted' | 'quota_zero' | 'not_found' | 'auth_error' | 'error';
    quotaId?: string;
    quotaMetric?: string;
    quotaLimit?: string;
    retryDelay?: string;
    sampleBytes?: number;
    detail: string;
  }>;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      configured: false,
      listedTtsAndAudioModels: [],
      modelProbes: [],
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const listedTtsAndAudioModels: Array<{
    name: string;
    displayName?: string;
    supportedActions?: string[];
  }> = [];

  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const name = String(m.name || '');
      if (/tts|audio|live|2\.5-flash|3\.8-flash/i.test(name)) {
        listedTtsAndAudioModels.push({
          name,
          displayName: m.displayName,
          supportedActions: m.supportedActions,
        });
      }
    }
  } catch (err) {
    listedTtsAndAudioModels.push({
      name: 'LIST_ERROR',
      displayName: parseTtsError(err).summary.slice(0, 300),
    });
  }

  const candidateModels = [
    ACADEMY_TTS_PRIMARY_MODEL,
    ACADEMY_TTS_FALLBACK_MODEL,
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ];

  const modelProbes: Array<{
    model: string;
    available: boolean;
    httpStatus: number;
    outcome: 'ok' | 'rate_limit_rpm' | 'daily_quota_exhausted' | 'quota_zero' | 'not_found' | 'auth_error' | 'error';
    quotaId?: string;
    quotaMetric?: string;
    quotaLimit?: string;
    retryDelay?: string;
    sampleBytes?: number;
    detail: string;
  }> = [];

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const probePart = /^gemini-3\.8-/i.test(model)
        ? { text: 'أهلاً', speechMetadata: { style: 'Warm child-friendly Arabic voice.' } }
        : { text: 'Say clearly in a warm, child-friendly voice: Apple' };
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [probePart],
          },
        ],
        config: {
          abortSignal: controller.signal,
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: ACADEMY_TTS_VOICE },
            },
          },
        },
      });
      const inline = response.candidates?.[0]?.content?.parts?.find((p) => Boolean(p?.inlineData?.data))?.inlineData;
      const bytes = inline?.data ? Buffer.from(inline.data, 'base64').length : 0;
      modelProbes.push({
        model,
        available: bytes > 0,
        httpStatus: 200,
        outcome: bytes > 0 ? 'ok' : 'error',
        sampleBytes: bytes,
        detail: bytes > 0 ? `Returned ${bytes} bytes (${inline?.mimeType || 'audio'})` : 'Empty audio response',
      });
    } catch (err) {
      const raw = (() => {
        let s = err instanceof Error ? err.message : String(err ?? '');
        try {
          const ex = JSON.stringify(err);
          if (ex && ex.length > s.length) s = `${s} ${ex}`;
        } catch {
          // ignore
        }
        return s.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]');
      })();
      const statusProp =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : /\b429\b/.test(raw)
            ? 429
            : /\b404\b/.test(raw)
              ? 404
              : /\b403\b|\b401\b/.test(raw)
                ? 403
                : 500;
      const qIdMatch = /"quotaId"\s*:\s*"([^"]+)"/.exec(raw);
      const qMetricMatch = /"quotaMetric"\s*:\s*"([^"]+)"/.exec(raw);
      const qValMatch = /"quotaValue"\s*:\s*"([^"]+)"/.exec(raw);
      const retryMatch = /"retryDelay"\s*:\s*"([^"]+)"/.exec(raw);

      const quotaId = qIdMatch?.[1];
      const quotaMetric = qMetricMatch?.[1];
      const quotaLimit = qValMatch?.[1];
      const retryDelay = retryMatch?.[1];

      let outcome: 'rate_limit_rpm' | 'daily_quota_exhausted' | 'quota_zero' | 'not_found' | 'auth_error' | 'error' = 'error';
      if (statusProp === 404 || /NOT_FOUND/i.test(raw)) {
        outcome = 'not_found';
      } else if (statusProp === 401 || statusProp === 403 || /PERMISSION_DENIED|API_KEY_INVALID/i.test(raw)) {
        outcome = 'auth_error';
      } else if (statusProp === 429 || /RESOURCE_EXHAUSTED/i.test(raw)) {
        if (quotaLimit === '0' || /limit:\s*0\b/i.test(raw)) {
          outcome = 'quota_zero';
        } else if (quotaId && /PerDay/i.test(quotaId)) {
          outcome = 'daily_quota_exhausted';
        } else {
          outcome = 'rate_limit_rpm';
        }
      }

      modelProbes.push({
        model,
        available: statusProp !== 404 && outcome !== 'quota_zero' && outcome !== 'auth_error',
        httpStatus: statusProp,
        outcome,
        quotaId,
        quotaMetric,
        quotaLimit,
        retryDelay,
        detail: raw.slice(0, 700),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    configured: true,
    listedTtsAndAudioModels,
    modelProbes,
  };
}

function getAcademyItemPriorityScore(item: AcademyAudioManifestItem): number {
  const len = item.text.length;
  const screens = item.screens;
  const stages = item.activityOrStageIds;

  // 1. Arabic and English alphabet
  if (screens.includes('AcademyScreen:arabic') && stages.includes('letter-name')) {
    return 100 + len;
  }
  if (screens.includes('AcademyScreen:english') && stages.includes('letter-upper')) {
    return 115 + len;
  }
  if (screens.includes('AcademyScreen:arabic') && stages.includes('letter-char')) {
    return 130 + len;
  }
  if (screens.includes('AcademyScreen:english') && stages.includes('letter-lower')) {
    return 145 + len;
  }

  // 2. Arabic and English numbers
  if (screens.includes('AcademyScreen:numbers')) {
    return 200 + len;
  }

  // 3. Colors and shapes
  if (
    screens.includes('AcademyScreen:colors-shapes') &&
    (stages.includes('color-card') || stages.includes('shape-card'))
  ) {
    return 300 + len;
  }
  if (screens.includes('AcademyScreen:colors-shapes')) {
    return 330 + len;
  }

  // 4. Basic vocabulary and animal/object names
  if (stages.some((s) => s === 'letter-word' || s === 'letter-word-pair' || s === 'cvc-builder')) {
    return 400 + len;
  }
  if (stages.some((s) => s.startsWith('vocab-'))) {
    return 440 + len;
  }

  // 5. Core Level 1 lesson instructions and questions
  if (
    screens.includes('Level1LessonRunner') &&
    stages.some(
      (s) =>
        s === 'stage5-listen-select' ||
        s === 'stage3-normal-title' ||
        s === 'stage3-slow-cue' ||
        s === 'stage1-intro' ||
        s === 'stage2-explanation',
    )
  ) {
    return 500 + Math.min(90, len);
  }
  if (screens.includes('Level1LessonRunner:stage10')) {
    return 560 + Math.min(90, len);
  }

  // 6. Remaining Level 1 lessons & Daily Path
  if (screens.includes('Level1LessonRunner') || screens.includes('AcademyScreen:daily')) {
    return 650 + Math.min(90, len);
  }

  // 7. Deep Journey modules
  if (screens.some((s) => s.startsWith('DeepLessonEngine:'))) {
    return 750 + Math.min(90, len);
  }

  // 8. Exams and remaining Academy content
  return 850 + Math.min(90, len);
}

export async function startAcademyAudioBatchGeneration(opts?: {
  limit?: number;
  delayMs?: number;
  validateExisting?: boolean;
  preferredModel?: string;
  singleModelOnly?: boolean;
  stopOn429?: boolean;
  language?: 'ar' | 'en';
  minTextLength?: number;
}): Promise<AcademyBatchStatus> {
  if (activeBatchPromise) {
    return activeBatchPromise;
  }

  stopRequested = false;
  activeBatchPromise = (async () => {
    batchStatus.running = true;
    batchStatus.state = 'running';
    batchStatus.startedAt = new Date().toISOString();
    batchStatus.finishedAt = null;
    batchStatus.attemptedThisRun = 0;
    batchStatus.succeededThisRun = 0;
    batchStatus.lastError = null;
    batchStatus.delayMs = Math.max(250, opts?.delayMs ?? 4500);

    try {
      const doc = await syncAndValidateAcademyManifest({
        checkVolume: Boolean(opts?.validateExisting),
        migrateLegacy: true,
      });

      const refreshCounts = (items: AcademyAudioManifestItem[]) => {
        batchStatus.totalAssets = items.length;
        batchStatus.validCount = items.filter((i) => i.validationStatus === 'valid').length;
        batchStatus.failedCount = items.filter((i) => i.validationStatus === 'invalid' || i.generationStatus === 'failed').length;
        batchStatus.pendingCount = items.filter((i) => i.validationStatus !== 'valid').length;
      };

      refreshCounts(doc.items);

      // Prioritize strictly by curriculum order (alphabet -> numbers -> colors/shapes -> vocab -> Level 1 -> Deep -> Exams)
      const minLen = typeof opts?.minTextLength === 'number' ? Math.max(1, opts.minTextLength) : 1;
      const queue = doc.items
        .filter(
          (i) =>
            i.validationStatus !== 'valid' &&
            (!opts?.language || i.language === opts.language) &&
            i.text.length >= minLen,
        )
        .sort((a, b) => getAcademyItemPriorityScore(a) - getAcademyItemPriorityScore(b));

      const maxToProcess = opts?.limit && opts.limit > 0 ? Math.min(queue.length, opts.limit) : queue.length;

      let preferredModel = opts?.preferredModel || ACADEMY_TTS_PRIMARY_MODEL;
      const skipModels = new Set<string>();
      if (opts?.singleModelOnly) {
        for (const m of [ACADEMY_TTS_PRIMARY_MODEL, ACADEMY_TTS_FALLBACK_MODEL]) {
          if (m !== preferredModel) skipModels.add(m);
        }
      }
      const stopOn429 = opts?.stopOn429 !== false; // Strict default: stop & save progress on HTTP 429

      for (let idx = 0; idx < maxToProcess; idx++) {
        if (stopRequested) break;
        const item = queue[idx];
        const absPath = path.resolve(process.cwd(), item.mp3Path);

        // Resume safety: never overwrite or regenerate if valid on disk
        if (fs.existsSync(absPath)) {
          const check = await validateAcademyMp3File(absPath, true);
          if (check.valid) {
            item.generationStatus = 'ready';
            item.validationStatus = 'valid';
            item.bytes = check.bytes;
            item.durationSeconds = check.durationSeconds;
            if (check.maxVolumeDb !== null) item.maxVolumeDb = check.maxVolumeDb;
            item.lastError = undefined;
            refreshCounts(doc.items);
            continue;
          }
        }

        batchStatus.currentAssetId = item.assetId;
        batchStatus.currentText = item.text;
        batchStatus.activeModel = preferredModel;

        batchStatus.attemptedThisRun++;
        const res = await generateAcademyAudioItem(item, { preferredModel, skipModels });

        if (res.ok) {
          item.generationStatus = 'ready';
          item.validationStatus = 'valid';
          item.bytes = res.bytes;
          item.durationSeconds = res.durationSeconds;
          item.maxVolumeDb = res.maxVolumeDb;
          item.model = res.model;
          item.voiceName = ACADEMY_TTS_VOICE;
          item.lastError = undefined;
          item.updatedAt = new Date().toISOString();
          batchStatus.succeededThisRun++;
          batchStatus.lastError = null;
          if (res.model !== preferredModel && !opts?.singleModelOnly) {
            preferredModel = res.model;
          }
        } else {
          item.generationStatus = 'failed';
          item.validationStatus = fs.existsSync(absPath) ? 'invalid' : 'missing';
          item.lastError = res.error;
          item.updatedAt = new Date().toISOString();
          batchStatus.lastError = `${item.assetId}: ${res.error}`;

          if (res.isFatalAuth || (res.isQuota429 && stopOn429)) {
            saveManifestAndClientLookup(recomputeManifestCounts(doc.items));
            refreshCounts(doc.items);
            batchStatus.state = res.isFatalAuth ? 'failed' : 'partial';
            batchStatus.running = false;
            batchStatus.finishedAt = new Date().toISOString();
            batchStatus.currentAssetId = null;
            batchStatus.currentText = null;
            return getAcademyBatchStatus();
          }
        }

        refreshCounts(doc.items);

        // Save after every single successful item so progress resumes cleanly without duplication
        saveManifestAndClientLookup(recomputeManifestCounts(doc.items));

        if (idx + 1 < maxToProcess && !stopRequested) {
          await new Promise((r) => setTimeout(r, batchStatus.delayMs));
        }
      }

      const finalDoc = recomputeManifestCounts(doc.items);
      saveManifestAndClientLookup(finalDoc);
      refreshCounts(finalDoc.items);

      batchStatus.state = finalDoc.missingCount === 0 && finalDoc.invalidCount === 0 ? 'completed' : 'partial';
      batchStatus.finishedAt = new Date().toISOString();
      batchStatus.currentAssetId = null;
      batchStatus.currentText = null;
      return getAcademyBatchStatus();
    } catch (err) {
      batchStatus.state = 'failed';
      batchStatus.lastError = String((err as Error)?.message || err);
      batchStatus.finishedAt = new Date().toISOString();
      return getAcademyBatchStatus();
    } finally {
      batchStatus.running = false;
      activeBatchPromise = null;
    }
  })();

  return activeBatchPromise;
}
