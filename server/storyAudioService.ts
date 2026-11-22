import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { GoogleGenAI } from '@google/genai';
import type {
  QuranStoryAdminOverride,
  QuranStorySpec,
} from '../src/types/nonoland';
import { loadStoryAudioBlobPg, saveStoryAudioBlobPg } from './pgStore';

const execFileAsync = promisify(execFile);

export const STORY_AUDIO_PUBLIC_DIR = path.resolve(process.cwd(), 'public', 'assets', 'audio', 'stories');
const PUBLIC_ASSETS_ROOT = path.resolve(process.cwd(), 'public', 'assets');

export const STORY_NARRATION_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
export const STORY_NARRATION_FALLBACK_TTS_MODEL = 'gemini-3.8-flash-tts';
export const STORY_NARRATION_VOICE_NAME = 'Zephyr';

export const RELIGIOUS_REVIEW_FLAGS: Record<string, { reasonAr: string; reasonEn: string }> = {
  'ibrahim-s1': {
    reasonAr: 'تمت مراجعة الصياغة تحريرياً وتوضيحها كسرد قصصي تعليمي للأطفال دون نسب قولٍ مُعاد صياغته، مع الحفاظ على المعنى الموثق لسورة الأنعام (76).',
    reasonEn: 'Editorially reviewed and clarified as third-person child storytelling without a paraphrased direct quote, preserving Surah Al-Anam 6:76 meaning separately from recitation.',
  },
  'cave-s5': {
    reasonAr: 'تمت مراجعة الصياغة تحريرياً لضمان بقاء السرد القصصي منفصلاً تماماً عن التلاوة القرآنية مع الإحالة لسورة الكهف.',
    reasonEn: 'Editorially reviewed to keep conversational storytelling narration strictly distinct from Quranic recitation while referencing Surah Al-Kahf.',
  },
};

export interface StoryAudioAssetValidation {
  valid: boolean;
  url: string;
  kind: 'local' | 'remote' | 'invalid';
  status: 'valid' | 'missing' | 'invalid';
  mimeType: string | null;
  bytes: number;
  durationSeconds: number | null;
  reason?: string;
}

export interface StorySceneAudioManifestItem {
  storyId: string;
  storyTitleAr: string;
  storyTitleEn: string;
  sceneId: string;
  sceneOrder: number;
  sceneTitleAr: string;
  sceneTitleEn: string;
  narrationTextAr: string;
  narrationTextEn: string;
  expectedLocalPath: string;
  attachedUrl: string | null;
  assetStatus: 'valid' | 'missing' | 'invalid';
  bytes: number;
  durationSeconds: number | null;
  validationReason?: string;
  reviewFlag?: { reasonAr: string; reasonEn: string };
}

export interface StoryAudioManifestSummary {
  totalStories: number;
  totalScenes: number;
  totalRequiredAssets: number;
  validAudioCount: number;
  missingAudioCount: number;
  invalidAudioCount: number;
  ttsConfigured: boolean;
  ttsModel: string;
  voiceName: string;
  encodingTarget: string;
  items: StorySceneAudioManifestItem[];
}

export function hasValidAudioMagicBytes(buf: Buffer): { ok: boolean; mimeType: string | null } {
  if (buf.length < 12) return { ok: false, mimeType: null };
  // MP3 with ID3 tag or MPEG frame sync
  if (buf.subarray(0, 3).toString('ascii') === 'ID3') {
    return { ok: true, mimeType: 'audio/mpeg' };
  }
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return { ok: true, mimeType: 'audio/mpeg' };
  }
  // RIFF WAVE
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return { ok: true, mimeType: 'audio/wav' };
  }
  // Ogg
  if (buf.subarray(0, 4).toString('ascii') === 'OggS') {
    return { ok: true, mimeType: 'audio/ogg' };
  }
  // MP4 / M4A ftyp
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { ok: true, mimeType: 'audio/mp4' };
  }
  return { ok: false, mimeType: null };
}

function isPrivateOrBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    return (
      low === '::1' ||
      low === '::' ||
      low.startsWith('fc') ||
      low.startsWith('fd') ||
      low.startsWith('fe80') ||
      low.startsWith('::ffff:127.') ||
      low.startsWith('::ffff:10.') ||
      low.startsWith('::ffff:192.168.') ||
      low.startsWith('::ffff:169.254.')
    );
  }
  return true;
}

export function resolveSafePublicAssetFile(assetUrl: string): string | null {
  if (!assetUrl || !assetUrl.startsWith('/assets/') || assetUrl.startsWith('//')) return null;
  if (assetUrl.includes('\0') || assetUrl.includes('..')) return null;
  const relUnderAssets = assetUrl.replace(/^\/assets\//, '');
  const resolved = path.resolve(PUBLIC_ASSETS_ROOT, relUnderAssets);
  if (!resolved.startsWith(PUBLIC_ASSETS_ROOT + path.sep)) return null;
  return resolved;
}

export function parseLocalStoryAudioUrl(assetUrl: string): { storyId: string; sceneId: string } | null {
  const clean = String(assetUrl || '').trim().split('?')[0];
  const m = /^\/assets\/audio\/stories\/([a-z0-9-]+)\/([a-z0-9-]+)\.mp3$/i.exec(clean);
  if (!m) return null;
  return { storyId: m[1], sceneId: m[2] };
}

export function getExpectedStoryAudioUrl(storyId: string, sceneId: string): string {
  return `/assets/audio/stories/${storyId}/${sceneId}.mp3`;
}

export async function ensureStoryAudioOnDiskFromDb(
  storyId: string,
  sceneId: string,
): Promise<boolean> {
  const url = getExpectedStoryAudioUrl(storyId, sceneId);
  const destPath = resolveSafePublicAssetFile(url);
  if (!destPath) return false;

  // Check if file already exists on disk
  if (fs.existsSync(destPath)) {
    try {
      const stat = fs.statSync(destPath);
      if (stat.isFile() && stat.size >= 1024) {
        const raw = fs.readFileSync(destPath);
        const magic = hasValidAudioMagicBytes(raw);
        if (magic.ok && magic.mimeType === 'audio/mpeg') {
          return true;
        }
        // Repair WAV/OGG/M4A mis-saved with .mp3 extension without losing audio
        if (magic.ok && magic.mimeType !== 'audio/mpeg') {
          await transcodeAudioBufferToMp3File(raw, destPath, magic.mimeType || undefined);
          const repaired = fs.readFileSync(destPath);
          await saveStoryAudioBlobPg(storyId, sceneId, repaired).catch(() => undefined);
          return true;
        }
      }
    } catch {
      // fall through to DB hydration
    }
  }

  const blob = await loadStoryAudioBlobPg(storyId, sceneId);
  if (!blob || blob.length < 1024) return false;
  const magic = hasValidAudioMagicBytes(blob);
  if (!magic.ok) return false;

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (magic.mimeType === 'audio/mpeg') {
    const tmpPath = path.join(path.dirname(destPath), `.tmp-${crypto.randomUUID()}.mp3`);
    fs.writeFileSync(tmpPath, blob);
    fs.renameSync(tmpPath, destPath);
    return true;
  }

  await transcodeAudioBufferToMp3File(blob, destPath, magic.mimeType || undefined);
  const repaired = fs.readFileSync(destPath);
  await saveStoryAudioBlobPg(storyId, sceneId, repaired).catch(() => undefined);
  return true;
}

export function localStoryAudioExistsSync(assetUrl: string | null | undefined): boolean {
  if (!assetUrl) return false;
  if (!assetUrl.startsWith('/assets/')) return true; // remote URL verified separately on save
  const filePath = resolveSafePublicAssetFile(assetUrl);
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < 1024) return false;
    const fd = fs.openSync(filePath, 'r');
    try {
      const head = Buffer.alloc(16);
      const read = fs.readSync(fd, head, 0, 16, 0);
      if (read < 12) return false;
      return hasValidAudioMagicBytes(head).ok;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

export async function probeLocalAudioDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 6000 },
    );
    const parsed = Number.parseFloat(stdout.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 10) / 10;
    }
  } catch {
    // fallback if WAV RIFF container
  }

  try {
    const buf = fs.readFileSync(filePath);
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.length > 44) {
      const byteRate = buf.readUInt32LE(28);
      if (byteRate > 0) {
        return Math.round(((buf.length - 44) / byteRate) * 10) / 10;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function validateStoryAudioAsset(rawUrl: string): Promise<StoryAudioAssetValidation> {
  const url = String(rawUrl || '').trim();
  if (!url) {
    return {
      valid: false,
      url: '',
      kind: 'invalid',
      status: 'missing',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      reason: 'Audio URL is empty.',
    };
  }

  if (url.startsWith('/assets/')) {
    const filePath = resolveSafePublicAssetFile(url);
    if (!filePath) {
      return {
        valid: false,
        url,
        kind: 'local',
        status: 'invalid',
        mimeType: null,
        bytes: 0,
        durationSeconds: null,
        reason: 'Invalid local /assets/ audio path.',
      };
    }
    const parsedStory = parseLocalStoryAudioUrl(url);
    if (parsedStory) {
      await ensureStoryAudioOnDiskFromDb(parsedStory.storyId, parsedStory.sceneId).catch(() => false);
    }
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        url,
        kind: 'local',
        status: 'missing',
        mimeType: null,
        bytes: 0,
        durationSeconds: null,
        reason: 'Audio file does not exist on disk.',
      };
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < 1024 || stat.size > 15 * 1024 * 1024) {
      return {
        valid: false,
        url,
        kind: 'local',
        status: 'invalid',
        mimeType: null,
        bytes: stat.size,
        durationSeconds: null,
        reason: 'Local audio file is empty or outside valid size limits (1 KB – 15 MB).',
      };
    }
    const fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(16);
    try {
      fs.readSync(fd, head, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }
    const magic = hasValidAudioMagicBytes(head);
    if (!magic.ok) {
      return {
        valid: false,
        url,
        kind: 'local',
        status: 'invalid',
        mimeType: null,
        bytes: stat.size,
        durationSeconds: null,
        reason: 'File header is not a recognized audio format (MP3/WAV/OGG/M4A).',
      };
    }
    const duration = await probeLocalAudioDurationSeconds(filePath);
    if (duration !== null && (duration < 0.4 || duration > 300)) {
      return {
        valid: false,
        url,
        kind: 'local',
        status: 'invalid',
        mimeType: magic.mimeType,
        bytes: stat.size,
        durationSeconds: duration,
        reason: `Measured audio duration (${duration}s) is outside allowed story scene range (0.4s–300s).`,
      };
    }
    return {
      valid: true,
      url,
      kind: 'local',
      status: 'valid',
      mimeType: magic.mimeType,
      bytes: stat.size,
      durationSeconds: duration,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      valid: false,
      url,
      kind: 'invalid',
      status: 'invalid',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      reason: 'Malformed URL.',
    };
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return {
      valid: false,
      url,
      kind: 'invalid',
      status: 'invalid',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      reason: 'Only clean HTTPS URLs or /assets/... paths are permitted.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) {
    return {
      valid: false,
      url,
      kind: 'remote',
      status: 'invalid',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      reason: 'Private or localhost URLs are blocked.',
    };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length || records.some((r) => isPrivateOrBlockedIp(r.address))) {
      return {
        valid: false,
        url,
        kind: 'remote',
        status: 'invalid',
        mimeType: null,
        bytes: 0,
        durationSeconds: null,
        reason: 'Remote host resolves to a restricted IP address.',
      };
    }
  } catch {
    return {
      valid: false,
      url,
      kind: 'remote',
      status: 'invalid',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      reason: 'Remote hostname could not be resolved.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-16383' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        valid: false,
        url,
        kind: 'remote',
        status: 'missing',
        mimeType: res.headers.get('content-type'),
        bytes: 0,
        durationSeconds: null,
        reason: `Remote audio URL returned HTTP ${res.status}.`,
      };
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    const magic = hasValidAudioMagicBytes(buf);
    if (!magic.ok && !contentType.startsWith('audio/')) {
      return {
        valid: false,
        url,
        kind: 'remote',
        status: 'invalid',
        mimeType: contentType || null,
        bytes: buf.length,
        durationSeconds: null,
        reason: `Remote URL did not return valid audio data (content-type=${contentType || 'unknown'}).`,
      };
    }
    const contentLen = Number(res.headers.get('content-length') || buf.length);
    return {
      valid: true,
      url,
      kind: 'remote',
      status: 'valid',
      mimeType: magic.mimeType || contentType || 'audio/mpeg',
      bytes: Number.isFinite(contentLen) && contentLen > 0 ? contentLen : buf.length,
      durationSeconds: null,
    };
  } catch (err) {
    return {
      valid: false,
      url,
      kind: 'remote',
      status: 'invalid',
      mimeType: null,
      bytes: 0,
      durationSeconds: null,
      reason: err instanceof Error ? err.message : 'Remote audio probe failed.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildStoryAudioManifest(
  baseStories: QuranStorySpec[],
  overrides: Record<string, QuranStoryAdminOverride>,
): Promise<StoryAudioManifestSummary> {
  const items: StorySceneAudioManifestItem[] = [];
  let validAudioCount = 0;
  let missingAudioCount = 0;
  let invalidAudioCount = 0;

  for (const story of baseStories) {
    const ov = overrides[story.id];
    const orderList = ov?.sceneOrder && ov.sceneOrder.length > 0 ? ov.sceneOrder : story.scenes.map((s) => s.id);
    const sceneMap = new Map(story.scenes.map((s) => [s.id, s]));
    const orderedScenes = orderList
      .map((id) => sceneMap.get(id))
      .filter((sc): sc is QuranStorySpec['scenes'][number] => Boolean(sc));

    for (const sc of orderedScenes) {
      const scOv = ov?.sceneOverrides?.[sc.id];
      const expectedLocalPath = getExpectedStoryAudioUrl(story.id, sc.id);
      const explicitUrl = scOv?.narrationAudioUrl;
      let candidateUrl: string | null = null;
      if (explicitUrl === null) {
        candidateUrl = null;
      } else if (typeof explicitUrl === 'string' && explicitUrl.trim()) {
        candidateUrl = explicitUrl.trim();
      } else if (sc.narrationAudioUrl) {
        candidateUrl = sc.narrationAudioUrl;
      } else if (localStoryAudioExistsSync(expectedLocalPath)) {
        candidateUrl = expectedLocalPath;
      }

      let assetStatus: 'valid' | 'missing' | 'invalid' = 'missing';
      let bytes = 0;
      let durationSeconds: number | null = null;
      let validationReason: string | undefined;

      if (candidateUrl) {
        if (candidateUrl.startsWith('/assets/')) {
          const v = await validateStoryAudioAsset(candidateUrl);
          assetStatus = v.status;
          bytes = v.bytes;
          durationSeconds = v.durationSeconds;
          validationReason = v.reason;
        } else {
          // For pre-validated remote URLs saved via Admin PUT, treat format check fast in manifest
          assetStatus = 'valid';
          durationSeconds = scOv?.durationSeconds ?? sc.durationSeconds;
        }
      } else {
        assetStatus = 'missing';
        validationReason = 'No validated Arabic narration recording attached yet.';
      }

      if (assetStatus === 'valid') validAudioCount++;
      else if (assetStatus === 'invalid') invalidAudioCount++;
      else missingAudioCount++;

      items.push({
        storyId: story.id,
        storyTitleAr: ov?.title?.ar || story.title.ar,
        storyTitleEn: ov?.title?.en || story.title.en,
        sceneId: sc.id,
        sceneOrder: sc.order,
        sceneTitleAr: scOv?.title?.ar || sc.title.ar,
        sceneTitleEn: scOv?.title?.en || sc.title.en,
        narrationTextAr: scOv?.narration?.mid?.ar || sc.narration.mid.ar,
        narrationTextEn: scOv?.narration?.mid?.en || sc.narration.mid.en,
        expectedLocalPath,
        attachedUrl: candidateUrl,
        assetStatus,
        bytes,
        durationSeconds,
        validationReason,
        reviewFlag: RELIGIOUS_REVIEW_FLAGS[sc.id],
      });
    }
  }

  return {
    totalStories: baseStories.length,
    totalScenes: items.length,
    totalRequiredAssets: items.length,
    validAudioCount,
    missingAudioCount,
    invalidAudioCount,
    ttsConfigured: Boolean(process.env.GEMINI_API_KEY),
    ttsModel: STORY_NARRATION_TTS_MODEL,
    voiceName: STORY_NARRATION_VOICE_NAME,
    encodingTarget: 'MP3 64kbps mono 24kHz',
    items,
  };
}

function prepareGeminiAudioInputBuffer(
  base64Audio: string,
  mimeType?: string,
): { buffer: Buffer; detectedMimeType: string } {
  const raw = Buffer.from(base64Audio, 'base64');
  const detected = hasValidAudioMagicBytes(raw);
  if (detected.ok && detected.mimeType) {
    return { buffer: raw, detectedMimeType: detected.mimeType };
  }
  // Raw signed 16-bit LE PCM fallback -> wrap with RIFF WAVE header
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
  return { buffer: Buffer.concat([header, raw]), detectedMimeType: 'audio/wav' };
}

export async function transcodeAudioBufferToMp3File(
  inputBuffer: Buffer,
  destMp3Path: string,
  mimeHint?: string,
): Promise<{ bytes: number; durationSeconds: number | null }> {
  const destDir = path.dirname(destMp3Path);
  fs.mkdirSync(destDir, { recursive: true });
  const magic = hasValidAudioMagicBytes(inputBuffer);
  const resolvedMime = magic.mimeType || mimeHint || 'audio/wav';
  const ext =
    resolvedMime === 'audio/mpeg'
      ? '.mp3'
      : resolvedMime === 'audio/ogg'
        ? '.ogg'
        : resolvedMime === 'audio/mp4'
          ? '.m4a'
          : '.wav';
  const tmpIn = path.join(destDir, `.tmp-${crypto.randomUUID()}${ext}`);
  const tmpMp3 = path.join(destDir, `.tmp-${crypto.randomUUID()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        tmpIn,
        '-ar',
        '24000',
        '-ac',
        '1',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '64k',
        tmpMp3,
      ],
      { timeout: 25000 },
    );
    const stat = fs.statSync(tmpMp3);
    if (stat.size < 1024) {
      throw new Error('Encoded MP3 audio is unexpectedly small.');
    }
    const head = fs.readFileSync(tmpMp3).subarray(0, 16);
    const outMagic = hasValidAudioMagicBytes(head);
    if (!outMagic.ok || outMagic.mimeType !== 'audio/mpeg') {
      throw new Error('Transcoded output does not contain a valid MP3 signature.');
    }
    const durationSeconds = await probeLocalAudioDurationSeconds(tmpMp3);
    fs.renameSync(tmpMp3, destMp3Path);
    return { bytes: stat.size, durationSeconds };
  } finally {
    if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
    if (fs.existsSync(tmpMp3)) fs.unlinkSync(tmpMp3);
  }
}

export async function transcodeWavBufferToMp3File(
  wavBuffer: Buffer,
  destMp3Path: string,
): Promise<{ bytes: number; durationSeconds: number | null }> {
  return transcodeAudioBufferToMp3File(wavBuffer, destMp3Path, 'audio/wav');
}

export async function generateSceneNarrationAudio(opts: {
  storyId: string;
  sceneId: string;
  narrationTextAr: string;
  voiceName?: string;
  model?: string;
}): Promise<{
  url: string;
  bytes: number;
  durationSeconds: number | null;
  mimeType: string;
  model: string;
  voiceName: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Server narration audio generation requires GEMINI_API_KEY.') as Error & {
      code?: string;
      statusCode?: number;
    };
    err.code = 'TTS_PROVIDER_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }

  const cleanText = String(opts.narrationTextAr || '').trim();
  if (!cleanText || cleanText.length > 900) {
    const err = new Error('Scene Arabic narration text must be 1–900 characters.') as Error & {
      code?: string;
      statusCode?: number;
    };
    err.code = 'INVALID_NARRATION_TEXT';
    err.statusCode = 400;
    throw err;
  }

  const allowedVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
  const chosenVoice = opts.voiceName && allowedVoices.has(opts.voiceName) ? opts.voiceName : STORY_NARRATION_VOICE_NAME;
  const allowedModels = new Set([STORY_NARRATION_TTS_MODEL, STORY_NARRATION_FALLBACK_TTS_MODEL]);
  const explicitModel = opts.model && allowedModels.has(opts.model) ? opts.model : null;
  const candidateModels = explicitModel
    ? [explicitModel]
    : [STORY_NARRATION_TTS_MODEL, STORY_NARRATION_FALLBACK_TTS_MODEL];

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  let selectedModel = candidateModels[0];
  let inlinePart: { data?: string; mimeType?: string } | undefined;
  let lastTtsErr: unknown;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    selectedModel = candidateModels[mIdx];
    const maxAttempts = 2;
    let tryNextModel = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style:
                      'Warm, gentle, loving Arabic storyteller with clear Egyptian-friendly pronunciation for toddlers ages 1 to 4. Calm joyful conversational narration, clear articulation, never chanting or Quran recitation.',
                  },
                },
              ],
            },
          ],
          config: {
            abortSignal: controller.signal,
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: chosenVoice },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        inlinePart = parts.find((p) => Boolean(p?.inlineData?.data))?.inlineData;
        if (inlinePart?.data) {
          break;
        }
        lastTtsErr = new Error('Audio synthesis returned an empty payload.');
      } catch (err) {
        lastTtsErr = err;
        const diag = summarizeSafeTtsError(err);
        if (diag.isQuota429) {
          if (diag.isDailyExhausted && mIdx + 1 < candidateModels.length) {
            tryNextModel = true;
            break;
          }
          const qErr = new Error(
            diag.isDailyExhausted
              ? `Gemini TTS daily free-tier quota exhausted (GenerateRequestsPerDayPerProjectPerModel-FreeTier on ${selectedModel}). Use a billing-enabled GEMINI_API_KEY in Settings > Secrets or wait for daily quota reset.`
              : `Gemini TTS rate limit reached on ${selectedModel}; retry after ${Math.round(diag.retryDelayMs / 1000)}s.`,
          ) as Error & { code?: string; statusCode?: number };
          qErr.code = diag.isDailyExhausted ? 'TTS_DAILY_QUOTA_EXCEEDED' : 'TTS_RATE_LIMITED';
          qErr.statusCode = 429;
          throw qErr;
        }
        const msg = String((err as Error)?.message || '');
        const isTransient = /500|502|503|504|timeout|abort|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);
        if (!isTransient || attempt >= maxAttempts) {
          throw err;
        }
      } finally {
        clearTimeout(timeout);
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }

    if (inlinePart?.data || !tryNextModel) {
      break;
    }
  }

  if (!inlinePart?.data) {
      const err = (
        lastTtsErr instanceof Error
          ? lastTtsErr
          : new Error('Audio synthesis returned an empty payload.')
      ) as Error & {
        code?: string;
        statusCode?: number;
      };
      err.code = err.code || 'TTS_EMPTY_AUDIO';
      err.statusCode = err.statusCode || 502;
      throw err;
    }

    const prepared = prepareGeminiAudioInputBuffer(inlinePart.data, inlinePart.mimeType);
    if (prepared.buffer.length < 256) {
      const err = new Error('Audio synthesis returned an undersized audio buffer.') as Error & {
        code?: string;
        statusCode?: number;
      };
      err.code = 'TTS_INVALID_AUDIO';
      err.statusCode = 502;
      throw err;
    }

    const expectedUrl = getExpectedStoryAudioUrl(opts.storyId, opts.sceneId);
    const destPath = resolveSafePublicAssetFile(expectedUrl);
    if (!destPath) {
      throw new Error('Invalid destination audio path.');
    }

    const encoded = await transcodeAudioBufferToMp3File(
      prepared.buffer,
      destPath,
      prepared.detectedMimeType,
    );
    const check = await validateStoryAudioAsset(expectedUrl);
    if (!check.valid) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      throw new Error(check.reason || 'Generated MP3 failed post-write validation.');
    }

    const persistedMp3 = fs.readFileSync(destPath);
    await saveStoryAudioBlobPg(opts.storyId, opts.sceneId, persistedMp3);

    return {
      url: expectedUrl,
      bytes: encoded.bytes,
      durationSeconds: check.durationSeconds ?? encoded.durationSeconds,
    mimeType: 'audio/mpeg',
    model: selectedModel,
    voiceName: chosenVoice,
  };
}

function summarizeSafeTtsError(err: unknown): {
  isQuota429: boolean;
  isDailyExhausted: boolean;
  retryDelayMs: number;
  summary: string;
} {
  let rawText = String((err as Error)?.message || err || 'Unknown TTS error');
  try {
    const extra = JSON.stringify(err);
    if (extra && extra.length > rawText.length && extra !== '{}') {
      rawText = `${rawText} ${extra}`;
    }
  } catch {
    // ignore circular error serialization
  }
  const redacted = rawText.replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]');
  const isQuota429 = /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(redacted);

  const quotaIdMatches = [...redacted.matchAll(/"quotaId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  const hasPerMinute = quotaIdMatches.some((id) => /PerMinute/i.test(id));
  const hasPerDay =
    quotaIdMatches.some((id) => /PerDay/i.test(id)) ||
    (/RequestsPerDay|GenerateRequestsPerDay/i.test(redacted) && !hasPerMinute);
  const isDailyExhausted = isQuota429 && hasPerDay && !hasPerMinute;

  let retryDelayMs = 62_000;
  const retryDelayJson = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i.exec(redacted);
  const retryInText = /retry\s+in\s+(\d+(?:\.\d+)?)s/i.exec(redacted);
  const parsedSec = Number(retryDelayJson?.[1] || retryInText?.[1] || 0);
  if (Number.isFinite(parsedSec) && parsedSec > 0) {
    retryDelayMs = Math.min(95_000, Math.max(15_000, Math.ceil((parsedSec + 2.5) * 1000)));
  }

  const quotaMetric = quotaIdMatches.length ? `quota=[${quotaIdMatches.join(',')}] ` : '';
  const delayNote = isQuota429 ? `retryWait=${Math.round(retryDelayMs / 1000)}s ` : '';
  const summary = `${quotaMetric}${delayNote}${redacted}`.slice(0, 420);
  return { isQuota429, isDailyExhausted, retryDelayMs, summary };
}

export interface StoryAudioBackfillStatus {
  state: 'idle' | 'running' | 'completed' | 'partial_error' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  attemptedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedValidCount: number;
  currentSceneKey: string | null;
  lastError: string | null;
}

const storyAudioBackfillStatus: StoryAudioBackfillStatus = {
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  attemptedCount: 0,
  succeededCount: 0,
  failedCount: 0,
  skippedValidCount: 0,
  currentSceneKey: null,
  lastError: null,
};

let activeBackfillPromise: Promise<StoryAudioBackfillStatus> | null = null;

export function getStoryAudioBackfillStatus(): StoryAudioBackfillStatus {
  return { ...storyAudioBackfillStatus };
}

export async function runMissingStoryAudioBackfill(opts: {
  stories: QuranStorySpec[];
  getCmsSnapshot: () => Promise<Record<string, QuranStoryAdminOverride>>;
  persistSceneAudio: (
    storyId: string,
    sceneId: string,
    url: string,
    durationSeconds: number | null,
  ) => Promise<void>;
}): Promise<StoryAudioBackfillStatus> {
  if (activeBackfillPromise) {
    return activeBackfillPromise;
  }

  activeBackfillPromise = (async () => {
    if (!process.env.GEMINI_API_KEY) {
      storyAudioBackfillStatus.state = 'idle';
      storyAudioBackfillStatus.lastError = 'GEMINI_API_KEY not configured';
      return getStoryAudioBackfillStatus();
    }

    storyAudioBackfillStatus.state = 'running';
    storyAudioBackfillStatus.startedAt = new Date().toISOString();
    storyAudioBackfillStatus.finishedAt = null;
    storyAudioBackfillStatus.attemptedCount = 0;
    storyAudioBackfillStatus.succeededCount = 0;
    storyAudioBackfillStatus.failedCount = 0;
    storyAudioBackfillStatus.skippedValidCount = 0;
    storyAudioBackfillStatus.currentSceneKey = null;
    storyAudioBackfillStatus.lastError = null;

    try {
      const cms = await opts.getCmsSnapshot();
      const manifest = await buildStoryAudioManifest(opts.stories, cms);

      // Prioritize scenes that already had an attachedUrl but failed disk/format validation, then remaining missing scenes
      const missingItems = manifest.items
        .filter((item) => item.assetStatus !== 'valid')
        .sort((a, b) => {
          const aAttached = a.attachedUrl ? 0 : 1;
          const bAttached = b.attachedUrl ? 0 : 1;
          return aAttached - bAttached;
        });

      storyAudioBackfillStatus.skippedValidCount = manifest.validAudioCount;

      if (missingItems.length === 0) {
        storyAudioBackfillStatus.state = 'completed';
        storyAudioBackfillStatus.finishedAt = new Date().toISOString();
        return getStoryAudioBackfillStatus();
      }

      console.log(
        `[StoryAudioBackfill] Starting manifest-verified generation for ${missingItems.length} missing scenes (${manifest.validAudioCount}/${manifest.totalRequiredAssets} already valid).`,
      );

      let pacingMs = missingItems.length > 6 ? 6500 : 1500;
      let totalCooldownsUsed = 0;
      const maxTotalCooldowns = 12;
      let consecutiveHardQuotaErrors = 0;
      let activeModel = STORY_NARRATION_TTS_MODEL;
      let switchedToFallbackModel = false;

      for (const item of missingItems) {
        // Re-check right before generating to avoid duplicates
        const alreadyNow = await validateStoryAudioAsset(item.expectedLocalPath);
        if (alreadyNow.valid) {
          storyAudioBackfillStatus.skippedValidCount++;
          if (!item.attachedUrl) {
            await opts.persistSceneAudio(
              item.storyId,
              item.sceneId,
              item.expectedLocalPath,
              alreadyNow.durationSeconds,
            );
          }
          continue;
        }

        const sceneKey = `${item.storyId}/${item.sceneId}`;
        storyAudioBackfillStatus.currentSceneKey = sceneKey;

        let sceneSucceeded = false;
        let sceneRateLimitRetries = 0;
        const maxRateLimitRetriesPerScene = 2;

        while (!sceneSucceeded) {
          storyAudioBackfillStatus.attemptedCount++;
          try {
            const generated = await generateSceneNarrationAudio({
              storyId: item.storyId,
              sceneId: item.sceneId,
              narrationTextAr: item.narrationTextAr,
              model: activeModel,
            });
            await opts.persistSceneAudio(
              item.storyId,
              item.sceneId,
              generated.url,
              generated.durationSeconds,
            );
            storyAudioBackfillStatus.succeededCount++;
            storyAudioBackfillStatus.lastError = null;
            consecutiveHardQuotaErrors = 0;
            sceneSucceeded = true;
            console.log(
              `[StoryAudioBackfill] Generated ${sceneKey} via ${generated.model} (${generated.bytes} bytes, ${generated.durationSeconds ?? 'n/a'}s)`,
            );
          } catch (err) {
            const diag = summarizeSafeTtsError(err);
            storyAudioBackfillStatus.lastError = `${sceneKey} [${activeModel}]: ${diag.summary}`;
            if (diag.isQuota429) {
              console.warn(`[StoryAudioBackfill] Quota notice on ${sceneKey} [${activeModel}]: ${diag.summary}`);
            } else {
              console.error(`[StoryAudioBackfill] Error on ${sceneKey} [${activeModel}]: ${diag.summary}`);
            }

            // Stop immediately on permanent config/model errors
            if (/API_KEY_INVALID|PERMISSION_DENIED|NOT_FOUND|\b403\b|\b404\b/i.test(diag.summary)) {
              storyAudioBackfillStatus.failedCount++;
              storyAudioBackfillStatus.state = 'failed';
              storyAudioBackfillStatus.finishedAt = new Date().toISOString();
              storyAudioBackfillStatus.currentSceneKey = null;
              return getStoryAudioBackfillStatus();
            }

            if (diag.isQuota429 && diag.isDailyExhausted && !switchedToFallbackModel) {
              switchedToFallbackModel = true;
              activeModel = STORY_NARRATION_FALLBACK_TTS_MODEL;
              console.warn(
                `[StoryAudioBackfill] Daily per-model quota hit on ${STORY_NARRATION_TTS_MODEL}; switching to fallback TTS model ${activeModel} for ${sceneKey}.`,
              );
              continue;
            }

            if (
              diag.isQuota429 &&
              !diag.isDailyExhausted &&
              sceneRateLimitRetries < maxRateLimitRetriesPerScene &&
              totalCooldownsUsed < maxTotalCooldowns
            ) {
              sceneRateLimitRetries++;
              totalCooldownsUsed++;
              pacingMs = Math.max(pacingMs, 12_500);
              console.warn(
                `[StoryAudioBackfill] RPM rate limit on ${sceneKey}; cooling down ${Math.round(diag.retryDelayMs / 1000)}s (cooldown ${totalCooldownsUsed}/${maxTotalCooldowns}), raising inter-scene pacing to ${pacingMs}ms.`,
              );
              await new Promise((r) => setTimeout(r, diag.retryDelayMs));
              continue;
            }

            storyAudioBackfillStatus.failedCount++;
            if (diag.isQuota429) {
              consecutiveHardQuotaErrors++;
              if (diag.isDailyExhausted || consecutiveHardQuotaErrors >= 2) {
                storyAudioBackfillStatus.state = 'partial_error';
                storyAudioBackfillStatus.finishedAt = new Date().toISOString();
                storyAudioBackfillStatus.currentSceneKey = null;
                return getStoryAudioBackfillStatus();
              }
            }
            break;
          }
        }

        // Respectful pacing between TTS synthesis requests to stay inside RPM limits
        await new Promise((r) => setTimeout(r, pacingMs));
      }

      storyAudioBackfillStatus.currentSceneKey = null;
      storyAudioBackfillStatus.finishedAt = new Date().toISOString();
      storyAudioBackfillStatus.state =
        storyAudioBackfillStatus.failedCount > 0 ? 'partial_error' : 'completed';
      console.log(
        `[StoryAudioBackfill] Finished state=${storyAudioBackfillStatus.state} succeeded=${storyAudioBackfillStatus.succeededCount} failed=${storyAudioBackfillStatus.failedCount} skippedValid=${storyAudioBackfillStatus.skippedValidCount}`,
      );
      return getStoryAudioBackfillStatus();
    } catch (err) {
      const safeMsg = String((err as Error)?.message || err || 'Backfill failed')
        .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
        .slice(0, 240);
      storyAudioBackfillStatus.state = 'failed';
      storyAudioBackfillStatus.lastError = safeMsg;
      storyAudioBackfillStatus.finishedAt = new Date().toISOString();
      storyAudioBackfillStatus.currentSceneKey = null;
      return getStoryAudioBackfillStatus();
    } finally {
      activeBackfillPromise = null;
    }
  })();

  return activeBackfillPromise;
}

