import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { GoogleGenAI } from '@google/genai';
import { hasValidAudioMagicBytes } from './storyAudioService';

const execFileAsync = promisify(execFile);

export const PRIMARY_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
export const FALLBACK_TTS_MODEL = 'gemini-3.8-flash-tts';
export const ALLOWED_TTS_VOICES = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);

export const ACADEMY_AUDIO_PUBLIC_DIR = path.resolve(
  process.cwd(),
  'public',
  'assets',
  'audio',
  'academy',
);

export type TtsErrorCode =
  | 'AI_KEY_MISSING'
  | 'INVALID_TTS_INPUT'
  | 'AI_TIMEOUT'
  | 'TTS_DAILY_QUOTA_EXCEEDED'
  | 'TTS_RATE_LIMITED'
  | 'TTS_TEMPORARILY_UNAVAILABLE'
  | 'TTS_AUTH_ERROR'
  | 'TTS_EMPTY_AUDIO'
  | 'TTS_INVALID_AUDIO'
  | 'TTS_UPSTREAM_ERROR';

export interface TtsAttemptDiagnostic {
  model: string;
  attempt: number;
  outcome: 'success' | 'retry' | 'failover' | 'failed' | 'skipped_cooldown';
  httpStatus: number;
  errorCode?: TtsErrorCode;
  durationMs: number;
  reason?: string;
}

export interface TtsSynthesisSuccess {
  ok: true;
  requestId: string;
  model: string;
  voiceName: string;
  mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg';
  buffer: Buffer;
  audioBase64: string;
  bytes: number;
  cached: boolean;
  attempts: TtsAttemptDiagnostic[];
  clipId?: string;
  clipToken?: string;
}

export interface TtsSynthesisFailure {
  ok: false;
  requestId: string;
  httpStatus: number;
  code: TtsErrorCode;
  retryable: boolean;
  message: string;
  sanitizedDetail: string;
  model: string;
  attempts: TtsAttemptDiagnostic[];
}

export type TtsSynthesisResult = TtsSynthesisSuccess | TtsSynthesisFailure;

class TtsTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TtsTimeoutError';
  }
}

export function redactSensitiveText(raw: string): string {
  return String(raw || '')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED_KEY]')
    .replace(/(apiKey|api_key|token|secret|password|cookie)\s*[:=]\s*[^\s,;"]+/gi, '$1=[REDACTED]')
    .trim();
}

export function ensureWavContainerFromPcm(
  rawBuf: Buffer,
  upstreamMimeType?: string,
): { buffer: Buffer; mimeType: 'audio/wav' | 'audio/mpeg' | 'audio/ogg' } {
  const magic = hasValidAudioMagicBytes(rawBuf);
  if (magic.ok && (magic.mimeType === 'audio/wav' || magic.mimeType === 'audio/mpeg' || magic.mimeType === 'audio/ogg')) {
    return { buffer: rawBuf, mimeType: magic.mimeType };
  }

  const rateMatch = String(upstreamMimeType || '').match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Math.max(8000, Math.min(96000, Number(rateMatch[1]))) : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = rawBuf.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return {
    buffer: Buffer.concat([header, rawBuf]),
    mimeType: 'audio/wav',
  };
}

let ffmpegAvailableCache: boolean | null = null;

async function encodeBufferToMp3IfPossible(
  inputBuffer: Buffer,
  mimeHint: 'audio/wav' | 'audio/mpeg' | 'audio/ogg',
): Promise<{ buffer: Buffer; mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg' }> {
  if (mimeHint === 'audio/mpeg') {
    const check = hasValidAudioMagicBytes(inputBuffer);
    if (check.ok && check.mimeType === 'audio/mpeg' && inputBuffer.length >= 256) {
      return { buffer: inputBuffer, mimeType: 'audio/mpeg' };
    }
  }
  if (ffmpegAvailableCache === false) {
    return { buffer: inputBuffer, mimeType: mimeHint };
  }

  const tmpRoot = path.resolve('/tmp', 'nono-tts-tmp');
  fs.mkdirSync(tmpRoot, { recursive: true });
  const ext = mimeHint === 'audio/ogg' ? '.ogg' : '.wav';
  const id = crypto.randomUUID();
  const tmpIn = path.join(tmpRoot, `${id}${ext}`);
  const tmpOut = path.join(tmpRoot, `${id}.mp3`);

  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', tmpIn, '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', tmpOut],
      { timeout: 15_000 },
    );
    const outBuf = fs.readFileSync(tmpOut);
    const check = hasValidAudioMagicBytes(outBuf);
    if (check.ok && check.mimeType === 'audio/mpeg' && outBuf.length >= 256) {
      ffmpegAvailableCache = true;
      return { buffer: outBuf, mimeType: 'audio/mpeg' };
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      ffmpegAvailableCache = false;
    }
  } finally {
    if (fs.existsSync(tmpIn)) {
      try { fs.unlinkSync(tmpIn); } catch { /* ignore */ }
    }
    if (fs.existsSync(tmpOut)) {
      try { fs.unlinkSync(tmpOut); } catch { /* ignore */ }
    }
  }
  return { buffer: inputBuffer, mimeType: mimeHint };
}

export interface ClassifiedUpstreamTtsError {
  httpStatus: number;
  code: TtsErrorCode;
  retryable: boolean;
  isDailyExhausted: boolean;
  shouldFailoverModel: boolean;
  retryAfterMs: number;
  sanitizedDetail: string;
}

export function classifyUpstreamTtsError(err: unknown): ClassifiedUpstreamTtsError {
  if (err instanceof TtsTimeoutError) {
    return {
      httpStatus: 504,
      code: 'AI_TIMEOUT',
      retryable: true,
      isDailyExhausted: false,
      shouldFailoverModel: true,
      retryAfterMs: 1200,
      sanitizedDetail: redactSensitiveText(err.message).slice(0, 220),
    };
  }

  let raw = err instanceof Error ? err.message : String(err ?? 'Unknown upstream TTS error');
  const statusProp =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : typeof (err as { statusCode?: unknown })?.statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : undefined;

  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== '{}' && serialized.length > raw.length) {
      raw = `${raw} ${serialized}`;
    }
  } catch {
    // ignore circular error objects
  }

  const redacted = redactSensitiveText(raw);

  // Permanent auth / permission / key errors — NEVER retry
  if (
    statusProp === 401 ||
    statusProp === 403 ||
    /\b401\b|\b403\b|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED|API key not valid/i.test(redacted)
  ) {
    return {
      httpStatus: statusProp === 401 || statusProp === 403 ? statusProp : 502,
      code: 'TTS_AUTH_ERROR',
      retryable: false,
      isDailyExhausted: false,
      shouldFailoverModel: false,
      retryAfterMs: 0,
      sanitizedDetail: redacted.slice(0, 240),
    };
  }

  // Permanent invalid request — NEVER retry
  if (statusProp === 400 || /\b400\b|INVALID_ARGUMENT/i.test(redacted)) {
    return {
      httpStatus: 400,
      code: 'INVALID_TTS_INPUT',
      retryable: false,
      isDailyExhausted: false,
      shouldFailoverModel: false,
      retryAfterMs: 0,
      sanitizedDetail: redacted.slice(0, 240),
    };
  }

  // Quota / Rate Limit (429 / RESOURCE_EXHAUSTED)
  if (statusProp === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(redacted)) {
    const quotaIds = [...redacted.matchAll(/"quotaId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    const hasPerMin = quotaIds.some((id) => /PerMinute/i.test(id));
    const hasPerDay =
      quotaIds.some((id) => /PerDay/i.test(id)) ||
      (/GenerateRequestsPerDay|RequestsPerDay|free_tier_requests/i.test(redacted) && !hasPerMin);

    const retryMatch =
      /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i.exec(redacted) ||
      /retry\s+in\s+(\d+(?:\.\d+)?)s/i.exec(redacted);
    const parsedSec = retryMatch ? Number(retryMatch[1]) : 0;
    const isDaily = hasPerDay || (Number.isFinite(parsedSec) && parsedSec > 90);
    const boundedRetryMs =
      !isDaily && Number.isFinite(parsedSec) && parsedSec > 0
        ? Math.min(8_000, Math.max(1_000, Math.ceil(parsedSec * 1000)))
        : 2_000;

    return {
      httpStatus: 429,
      code: isDaily ? 'TTS_DAILY_QUOTA_EXCEEDED' : 'TTS_RATE_LIMITED',
      retryable: true,
      isDailyExhausted: isDaily,
      shouldFailoverModel: true,
      retryAfterMs: boundedRetryMs,
      sanitizedDetail: redacted.slice(0, 260),
    };
  }

  // Model not found / unsupported — fail over to alternate model, do not retry same model
  if (statusProp === 404 || /\b404\b|NOT_FOUND/i.test(redacted)) {
    return {
      httpStatus: 502,
      code: 'TTS_UPSTREAM_ERROR',
      retryable: true,
      isDailyExhausted: false,
      shouldFailoverModel: true,
      retryAfterMs: 0,
      sanitizedDetail: redacted.slice(0, 240),
    };
  }

  // Temporary 503 / 500 / 502 / transient network
  const isTransient =
    statusProp === 503 ||
    statusProp === 502 ||
    statusProp === 500 ||
    /\b503\b|\b502\b|\b500\b|UNAVAILABLE|high demand|overloaded|ECONNRESET|ETIMEDOUT|fetch failed|abort/i.test(
      redacted,
    );

  return {
    httpStatus: statusProp === 503 || /\b503\b|UNAVAILABLE/i.test(redacted) ? 503 : 502,
    code: isTransient ? 'TTS_TEMPORARILY_UNAVAILABLE' : 'TTS_UPSTREAM_ERROR',
    retryable: isTransient,
    isDailyExhausted: false,
    shouldFailoverModel: isTransient,
    retryAfterMs: 1_200,
    sanitizedDetail: redacted.slice(0, 240),
  };
}

// Per-model daily-exhaustion cooldown tracker so requests immediately use healthy fallback model
const modelCooldownUntil = new Map<string, number>();

export function _resetTtsCooldownsForTests() {
  modelCooldownUntil.clear();
  ttsMemoryCache.clear();
  inFlightSynthesis.clear();
}

// Ephemeral signed audio clip storage (used by Nono AI TTS HTTP streaming playback)
interface EphemeralClipEntry {
  buffer: Buffer;
  mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg';
  expiresAt: number;
}
const ephemeralClips = new Map<string, EphemeralClipEntry>();
const CLIP_HMAC_SECRET = crypto.randomBytes(32);

function signClipId(clipId: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', CLIP_HMAC_SECRET)
    .update(`${clipId}.${expiresAt}`)
    .digest('hex')
    .slice(0, 32);
}

export function storeEphemeralTtsClip(
  buffer: Buffer,
  mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg',
  ttlMs = 20 * 60_000,
): { clipId: string; clipToken: string; ext: string } {
  const now = Date.now();
  for (const [k, v] of ephemeralClips.entries()) {
    if (v.expiresAt <= now) ephemeralClips.delete(k);
  }
  if (ephemeralClips.size > 160) {
    const oldest = ephemeralClips.keys().next().value;
    if (oldest) ephemeralClips.delete(oldest);
  }
  const clipId = crypto.randomBytes(12).toString('hex');
  const expiresAt = now + ttlMs;
  ephemeralClips.set(clipId, { buffer, mimeType, expiresAt });
  const sig = signClipId(clipId, expiresAt);
  const ext = mimeType === 'audio/mpeg' ? 'mp3' : mimeType === 'audio/ogg' ? 'ogg' : 'wav';
  return { clipId, clipToken: `${expiresAt}.${sig}`, ext };
}

export function verifyAndGetEphemeralClip(
  clipId: string,
  token: string,
): { buffer: Buffer; mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg' } | null {
  if (!clipId || !token || !/^[a-f0-9]{16,40}$/i.test(clipId)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expiresAt = Number(parts[0]);
  const providedSig = parts[1];
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !providedSig) return null;
  const expectedSig = signClipId(clipId, expiresAt);
  if (providedSig.length !== expectedSig.length) return null;
  const ok = crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig));
  if (!ok) return null;
  const entry = ephemeralClips.get(clipId);
  if (!entry || entry.expiresAt < Date.now()) {
    ephemeralClips.delete(clipId);
    return null;
  }
  return { buffer: entry.buffer, mimeType: entry.mimeType };
}

// In-memory LRU TTS cache (avoid burning Gemini quota on duplicate repeats)
interface CachedTtsEntry {
  buffer: Buffer;
  mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg';
  model: string;
  voiceName: string;
  expiresAt: number;
}
const ttsMemoryCache = new Map<string, CachedTtsEntry>();
const inFlightSynthesis = new Map<string, Promise<TtsSynthesisResult>>();

export type GenerateAudioFn = (params: {
  model: string;
  text: string;
  voiceName: string;
  style?: string;
  abortSignal: AbortSignal;
}) => Promise<{ dataBase64?: string; mimeType?: string }>;

async function defaultGeminiTtsCaller(params: {
  model: string;
  text: string;
  voiceName: string;
  style?: string;
  abortSignal: AbortSignal;
}): Promise<{ dataBase64?: string; mimeType?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { status: 503 });
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const partPayload = params.style
    ? { text: params.text, speechMetadata: { style: params.style } }
    : { text: params.text };

  const response = await ai.models.generateContent({
    model: params.model,
    contents: [{ role: 'user', parts: [partPayload] }],
    config: {
      abortSignal: params.abortSignal,
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: params.voiceName },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  const inline = parts.find((p) => Boolean(p?.inlineData?.data))?.inlineData;
  return {
    dataBase64: inline?.data,
    mimeType: inline?.mimeType,
  };
}

export async function synthesizeSpeechAudio(opts: {
  text: string;
  voiceName?: string;
  language?: 'ar' | 'en';
  style?: string;
  requestId?: string;
  routeTag?: string;
  allowMemoryCache?: boolean;
  preferredModels?: string[];
  caller?: GenerateAudioFn;
  backoffBaseMs?: number;
  withEphemeralClip?: boolean;
}): Promise<TtsSynthesisResult> {
  const requestId = opts.requestId || `tts_${crypto.randomBytes(6).toString('hex')}`;
  const cleanText = String(opts.text || '').trim();
  const chosenVoice =
    opts.voiceName && ALLOWED_TTS_VOICES.has(opts.voiceName) ? opts.voiceName : 'Zephyr';
  const lang = opts.language === 'en' ? 'en' : 'ar';

  if (!cleanText || cleanText.length > 500) {
    return {
      ok: false,
      requestId,
      httpStatus: 400,
      code: 'INVALID_TTS_INPUT',
      retryable: false,
      message: 'Text must be between 1 and 500 characters.',
      sanitizedDetail: 'Empty or oversized TTS text input',
      model: PRIMARY_TTS_MODEL,
      attempts: [],
    };
  }

  if (!opts.caller && !process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      requestId,
      httpStatus: 503,
      code: 'AI_KEY_MISSING',
      retryable: false,
      message: 'Server voice synthesis requires GEMINI_API_KEY.',
      sanitizedDetail: 'GEMINI_API_KEY missing in runtime environment',
      model: PRIMARY_TTS_MODEL,
      attempts: [],
    };
  }

  const cacheKey = crypto
    .createHash('sha256')
    .update(`${chosenVoice}|${lang}|${cleanText}`)
    .digest('hex');

  if (opts.allowMemoryCache !== false) {
    const cached = ttsMemoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const clip = opts.withEphemeralClip
        ? storeEphemeralTtsClip(cached.buffer, cached.mimeType)
        : undefined;
      return {
        ok: true,
        requestId,
        model: cached.model,
        voiceName: cached.voiceName,
        mimeType: cached.mimeType,
        buffer: cached.buffer,
        audioBase64: cached.buffer.toString('base64'),
        bytes: cached.buffer.length,
        cached: true,
        attempts: [],
        ...(clip ? { clipId: clip.clipId, clipToken: clip.clipToken } : {}),
      };
    }
    const existingFlight = inFlightSynthesis.get(cacheKey);
    if (existingFlight && !opts.caller) {
      const flightRes = await existingFlight;
      if (flightRes.ok) {
        const clip = opts.withEphemeralClip
          ? storeEphemeralTtsClip(flightRes.buffer, flightRes.mimeType)
          : undefined;
        return {
          ...flightRes,
          requestId,
          cached: true,
          ...(clip ? { clipId: clip.clipId, clipToken: clip.clipToken } : {}),
        };
      }
      return { ...flightRes, requestId };
    }
  }

  const runPromise = (async (): Promise<TtsSynthesisResult> => {
    const candidateModels =
      opts.preferredModels && opts.preferredModels.length > 0
        ? opts.preferredModels
        : [PRIMARY_TTS_MODEL, FALLBACK_TTS_MODEL];
    const caller = opts.caller || defaultGeminiTtsCaller;
    const backoffBase = typeof opts.backoffBaseMs === 'number' ? opts.backoffBaseMs : 700;

    const attempts: TtsAttemptDiagnostic[] = [];
    let lastClassification: ClassifiedUpstreamTtsError | null = null;
    let lastModel = candidateModels[0];

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx += 1) {
      const model = candidateModels[mIdx];
      lastModel = model;

      // Skip model if recently known daily-exhausted (when another fallback exists)
      const cooldownUntil = modelCooldownUntil.get(model) || 0;
      if (!opts.caller && cooldownUntil > Date.now() && mIdx + 1 < candidateModels.length) {
        attempts.push({
          model,
          attempt: 0,
          outcome: 'skipped_cooldown',
          httpStatus: 429,
          errorCode: 'TTS_DAILY_QUOTA_EXCEEDED',
          durationMs: 0,
          reason: 'Model daily quota cooldown active; failing over immediately',
        });
        continue;
      }

      const maxAttemptsForModel = 2;
      for (let attempt = 1; attempt <= maxAttemptsForModel; attempt += 1) {
        const t0 = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 22_000);
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              'abort',
              () => reject(new TtsTimeoutError(`Gemini TTS (${model}) timed out after 22s`)),
              { once: true },
            );
          });

          const rawResult = await Promise.race([
            caller({
              model,
              text: cleanText,
              voiceName: chosenVoice,
              style: opts.style,
              abortSignal: controller.signal,
            }),
            timeoutPromise,
          ]);

          const dataBase64 = rawResult?.dataBase64?.trim();
          if (!dataBase64) {
            const elapsed = Date.now() - t0;
            const willRetry = attempt < maxAttemptsForModel;
            attempts.push({
              model,
              attempt,
              outcome: willRetry ? 'retry' : mIdx + 1 < candidateModels.length ? 'failover' : 'failed',
              httpStatus: 502,
              errorCode: 'TTS_EMPTY_AUDIO',
              durationMs: elapsed,
              reason: 'Gemini TTS returned no inlineData audio payload',
            });
            lastClassification = {
              httpStatus: 502,
              code: 'TTS_EMPTY_AUDIO',
              retryable: true,
              isDailyExhausted: false,
              shouldFailoverModel: true,
              retryAfterMs: backoffBase,
              sanitizedDetail: `Model ${model} returned empty audio payload`,
            };
            if (willRetry) {
              await new Promise((r) => setTimeout(r, backoffBase * attempt));
              continue;
            }
            break;
          }

          const decoded = Buffer.from(dataBase64, 'base64');
          if (decoded.length < 256) {
            const elapsed = Date.now() - t0;
            attempts.push({
              model,
              attempt,
              outcome: mIdx + 1 < candidateModels.length ? 'failover' : 'failed',
              httpStatus: 502,
              errorCode: 'TTS_INVALID_AUDIO',
              durationMs: elapsed,
              reason: `Audio buffer undersized (${decoded.length} bytes)`,
            });
            lastClassification = {
              httpStatus: 502,
              code: 'TTS_INVALID_AUDIO',
              retryable: true,
              isDailyExhausted: false,
              shouldFailoverModel: true,
              retryAfterMs: backoffBase,
              sanitizedDetail: `Undersized audio buffer (${decoded.length} bytes) from ${model}`,
            };
            break;
          }

          const wrapped = ensureWavContainerFromPcm(decoded, rawResult.mimeType);
          const finalAudio = await encodeBufferToMp3IfPossible(wrapped.buffer, wrapped.mimeType);
          const magicCheck = hasValidAudioMagicBytes(finalAudio.buffer);
          if (!magicCheck.ok || finalAudio.buffer.length < 256) {
            const elapsed = Date.now() - t0;
            attempts.push({
              model,
              attempt,
              outcome: 'failed',
              httpStatus: 502,
              errorCode: 'TTS_INVALID_AUDIO',
              durationMs: elapsed,
              reason: 'Output failed audio header validation',
            });
            return {
              ok: false,
              requestId,
              httpStatus: 502,
              code: 'TTS_INVALID_AUDIO',
              retryable: true,
              message: 'Synthesized audio container failed validation.',
              sanitizedDetail: `Invalid audio container from ${model}`,
              model,
              attempts,
            };
          }

          const elapsed = Date.now() - t0;
          attempts.push({
            model,
            attempt,
            outcome: 'success',
            httpStatus: 200,
            durationMs: elapsed,
          });

          if (opts.allowMemoryCache !== false) {
            if (ttsMemoryCache.size >= 150) {
              const oldest = ttsMemoryCache.keys().next().value;
              if (oldest) ttsMemoryCache.delete(oldest);
            }
            ttsMemoryCache.set(cacheKey, {
              buffer: finalAudio.buffer,
              mimeType: finalAudio.mimeType,
              model,
              voiceName: chosenVoice,
              expiresAt: Date.now() + 30 * 60_000,
            });
          }

          const clip = opts.withEphemeralClip
            ? storeEphemeralTtsClip(finalAudio.buffer, finalAudio.mimeType)
            : undefined;

          console.info(
            `[TTS-Diag] requestId=${requestId} route=${opts.routeTag || 'tts'} status=200 model=${model} mime=${finalAudio.mimeType} bytes=${finalAudio.buffer.length} ms=${elapsed} attempts=${attempts.length}`,
          );

          return {
            ok: true,
            requestId,
            model,
            voiceName: chosenVoice,
            mimeType: finalAudio.mimeType,
            buffer: finalAudio.buffer,
            audioBase64: finalAudio.buffer.toString('base64'),
            bytes: finalAudio.buffer.length,
            cached: false,
            attempts,
            ...(clip ? { clipId: clip.clipId, clipToken: clip.clipToken } : {}),
          };
        } catch (err) {
          const elapsed = Date.now() - t0;
          const classified = classifyUpstreamTtsError(err);
          lastClassification = classified;

          if (classified.isDailyExhausted && !opts.caller) {
            // Cache daily exhaustion for 10 minutes so we don't repeatedly hit dead free-tier quota
            modelCooldownUntil.set(model, Date.now() + 10 * 60_000);
          }

          // Fail fast immediately on permanent auth or bad-input errors
          if (!classified.retryable) {
            attempts.push({
              model,
              attempt,
              outcome: 'failed',
              httpStatus: classified.httpStatus,
              errorCode: classified.code,
              durationMs: elapsed,
              reason: classified.sanitizedDetail,
            });
            console.error(
              `[TTS-Diag] requestId=${requestId} route=${opts.routeTag || 'tts'} model=${model} httpStatus=${classified.httpStatus} code=${classified.code} detail=${classified.sanitizedDetail}`,
            );
            return {
              ok: false,
              requestId,
              httpStatus: classified.httpStatus,
              code: classified.code,
              retryable: false,
              message:
                classified.code === 'TTS_AUTH_ERROR'
                  ? 'TTS provider authentication or permission error.'
                  : 'Invalid TTS request parameters.',
              sanitizedDetail: classified.sanitizedDetail,
              model,
              attempts,
            };
          }

          const canRetrySameModel =
            !classified.isDailyExhausted && attempt < maxAttemptsForModel;

          attempts.push({
            model,
            attempt,
            outcome: canRetrySameModel
              ? 'retry'
              : mIdx + 1 < candidateModels.length
                ? 'failover'
                : 'failed',
            httpStatus: classified.httpStatus,
            errorCode: classified.code,
            durationMs: elapsed,
            reason: classified.sanitizedDetail,
          });

          if (canRetrySameModel) {
            const expWait = Math.min(
              8_000,
              Math.max(backoffBase * Math.pow(2, attempt - 1), classified.retryAfterMs),
            );
            const jitter = Math.floor(Math.random() * Math.min(250, Math.max(10, backoffBase)));
            await new Promise((r) => setTimeout(r, expWait + jitter));
            continue;
          }

          // Fail over immediately to next candidate model
          break;
        } finally {
          clearTimeout(timer);
        }
      }
    }

    const finalCode = lastClassification?.code || 'TTS_UPSTREAM_ERROR';
    const finalStatus = lastClassification?.httpStatus || 502;
    const finalDetail = lastClassification?.sanitizedDetail || 'All configured TTS models failed.';
    console.warn(
      `[TTS-Diag] requestId=${requestId} route=${opts.routeTag || 'tts'} status=${finalStatus} code=${finalCode} model=${lastModel} detail=${finalDetail}`,
    );

    return {
      ok: false,
      requestId,
      httpStatus: finalStatus,
      code: finalCode,
      retryable: lastClassification?.retryable ?? true,
      message:
        finalCode === 'TTS_DAILY_QUOTA_EXCEEDED'
          ? 'Voice synthesis daily quota reached. Please try again later.'
          : finalCode === 'TTS_RATE_LIMITED'
            ? 'Voice service is temporarily busy. Please try again in a few seconds.'
            : finalCode === 'AI_TIMEOUT'
              ? 'Voice synthesis timed out.'
              : 'Voice synthesis service is temporarily unavailable.',
      sanitizedDetail: finalDetail,
      model: lastModel,
      attempts,
    };
  })();

  if (opts.allowMemoryCache !== false && !opts.caller) {
    inFlightSynthesis.set(cacheKey, runPromise);
  }
  try {
    return await runPromise;
  } finally {
    inFlightSynthesis.delete(cacheKey);
  }
}

export function getAcademyAudioCacheKey(text: string, language: 'ar' | 'en'): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return crypto
    .createHash('sha256')
    .update(`academy|${language}|${normalized}`)
    .digest('hex')
    .slice(0, 28);
}

export async function getOrCreateAcademyAudio(opts: {
  text: string;
  language: 'ar' | 'en';
  requestId?: string;
}): Promise<
  | {
      ok: true;
      requestId: string;
      audioUrl: string;
      mimeType: string;
      bytes: number;
      cached: boolean;
      model: string;
    }
  | TtsSynthesisFailure
> {
  const requestId = opts.requestId || `acad_${crypto.randomBytes(6).toString('hex')}`;
  const cleanText = String(opts.text || '').trim();
  const lang = opts.language === 'en' ? 'en' : 'ar';

  if (!cleanText || cleanText.length > 320) {
    return {
      ok: false,
      requestId,
      httpStatus: 400,
      code: 'INVALID_TTS_INPUT',
      retryable: false,
      message: 'Academy audio text must be 1–320 characters.',
      sanitizedDetail: 'Empty or oversized Academy text',
      model: PRIMARY_TTS_MODEL,
      attempts: [],
    };
  }

  fs.mkdirSync(ACADEMY_AUDIO_PUBLIC_DIR, { recursive: true });
  const hashKey = getAcademyAudioCacheKey(cleanText, lang);
  const mp3Path = path.join(ACADEMY_AUDIO_PUBLIC_DIR, `${hashKey}.mp3`);
  const wavPath = path.join(ACADEMY_AUDIO_PUBLIC_DIR, `${hashKey}.wav`);

  for (const [candidatePath, expectedMime, ext] of [
    [mp3Path, 'audio/mpeg', 'mp3'],
    [wavPath, 'audio/wav', 'wav'],
  ] as const) {
    if (fs.existsSync(candidatePath)) {
      try {
        const stat = fs.statSync(candidatePath);
        if (stat.isFile() && stat.size >= 256) {
          const buf = fs.readFileSync(candidatePath);
          const magic = hasValidAudioMagicBytes(buf);
          if (magic.ok) {
            return {
              ok: true,
              requestId,
              audioUrl: `/assets/audio/academy/${hashKey}.${ext}`,
              mimeType: magic.mimeType || expectedMime,
              bytes: stat.size,
              cached: true,
              model: 'disk-cache',
            };
          }
        }
      } catch {
        // fall through to regenerate
      }
    }
  }

  const style =
    lang === 'ar'
      ? 'Warm, crystal-clear Modern Standard Arabic teacher voice for young children ages 1 to 4. Gentle pacing and clear letter/word articulation.'
      : 'Warm, crystal-clear cheerful English early-childhood teacher voice for ages 1 to 4. Clear phonics and gentle pacing.';

  const synthesized = await synthesizeSpeechAudio({
    text: cleanText,
    voiceName: 'Zephyr',
    language: lang,
    style,
    requestId,
    routeTag: '/api/academy/tts',
    allowMemoryCache: true,
  });

  if (!synthesized.ok) {
    return synthesized;
  }

  const ext = synthesized.mimeType === 'audio/mpeg' ? 'mp3' : 'wav';
  const destPath = path.join(ACADEMY_AUDIO_PUBLIC_DIR, `${hashKey}.${ext}`);
  const tmpPath = path.join(ACADEMY_AUDIO_PUBLIC_DIR, `.tmp-${crypto.randomUUID()}.${ext}`);
  fs.writeFileSync(tmpPath, synthesized.buffer);
  fs.renameSync(tmpPath, destPath);

  return {
    ok: true,
    requestId,
    audioUrl: `/assets/audio/academy/${hashKey}.${ext}`,
    mimeType: synthesized.mimeType,
    bytes: synthesized.bytes,
    cached: synthesized.cached,
    model: synthesized.model,
  };
}
