import { isSafeQuranAudioUrl } from '../src/utils/validation';
import {
  buildFinalValidationReport,
  type ProviderChapterInfo,
  type ProviderVerseInfo,
  type QuranAudioValidationResult,
  type QuranFinalValidationReport,
  type QuranReciterValidationResult,
  type QuranTextValidationResult,
  validateQuranAudioCoverage,
  validateQuranTextCoverage,
} from './quranValidation';

/**
 * Official Backend-Only Quran Foundation Content API / Audio CDN Client
 *
 * Security & Licensing Rules:
 * 1. Credentials (QF_CLIENT_ID / QF_CLIENT_SECRET) are read ONLY from server process.env.
 *    Never exposed to React frontend, Median APK bundle, or API logs.
 * 2. OAuth uses client_secret_basic ONLY with configurable granular space-separated scopes
 *    (default: `content.quran.read content.audio.read`). Never falls back to legacy `content`.
 * 3. Never automatically marks any reciter or recording as `verified`.
 *    Admin verification requires Reciter & Recitation Source Verification, technical
 *    audio integrity checks, Basmala asset approval, and compliance confirmations.
 * 4. Only ONE default reciter is configured for this phase:
 *    Sheikh Mahmoud Khalil Al-Husary – Hafs 'an 'Asim – Murattal (ID 6).
 */

export const HUSARY_MURATTAL_SPEC = {
  reciterId: 'adult-husary-muallim',
  canonicalSlug: 'adult-husary-murattal',
  nameAr: 'الشيخ محمود خليل الحصري – رواية حفص عن عاصم – تلاوة مرتلة',
  nameEn: "Sheikh Mahmoud Khalil Al-Husary – Hafs 'an 'Asim – Murattal",
  riwayah: 'Hafs an Asim',
  style: 'Murattal',
  quranFoundationChapterReciterId: 6,
  quranFoundationVerseRecitationId: 6,
  attribution: {
    ar: 'بيانات القرآن مقدمة من Quran.Foundation. — التلاوة للشيخ محمود خليل الحصري (رواية حفص عن عاصم - مرتلة).',
    en: "Quran data provided by Quran.Foundation. — Recitation by Sheikh Mahmoud Khalil Al-Husary (Hafs 'an 'Asim – Murattal).",
  },
} as const;

export const QF_SCOPE_QURAN_READ = 'content.quran.read';
export const QF_SCOPE_AUDIO_READ = 'content.audio.read';
export const DEFAULT_QF_OAUTH_SCOPES = [
  QF_SCOPE_QURAN_READ,
  QF_SCOPE_AUDIO_READ,
] as const;

const DEFAULT_QF_OAUTH_URL = 'https://oauth2.quran.foundation/oauth2/token';
const DEFAULT_QF_API_BASE = 'https://apis.quran.foundation/content/api/v4';

const QF_OAUTH_TOKEN_URL =
  process.env.QF_OAUTH_URL?.trim() || DEFAULT_QF_OAUTH_URL;
const QF_CONTENT_API_BASE =
  process.env.QF_API_BASE_URL?.trim() || DEFAULT_QF_API_BASE;

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
  scopeString: string;
  grantedScope?: string;
}

let cachedQfToken: CachedToken | null = null;

interface CachedTestingAudioPayload {
  fetchedAt: string;
  fetchedAtMs: number;
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
  basmalaIncludedBySurah: Record<string, boolean>;
}

export const MAX_QF_SERVER_CACHE_DAYS = 7;
export const MAX_QF_SERVER_CACHE_MS = MAX_QF_SERVER_CACHE_DAYS * 24 * 60 * 60 * 1000;
export const TESTING_AUDIO_CACHE_TTL_MS = 15 * 60 * 1000;
let cachedTestingAudio: CachedTestingAudioPayload | null = null;

/**
 * Determines from chapter_recitations metadata whether a Surah recording already begins with the Basmala:
 * - For Al-Fatihah (chapter 1), the Basmala IS Verse 1:1 itself -> always true (must never duplicate).
 * - For all other Surahs, checks segments/timestamps if provided: only returns true if a pre-1st-verse
 *   segment exists (timestamp_from > 1500ms before `${chapterNum}:1` or verse_key ending `:0`).
 */
export function detectBasmalaIncludedInChapterAudio(
  chapterNum: number,
  audioFileObj?: {
    timestamps?: Array<{ verse_key?: unknown; timestamp_from?: unknown }>;
  } | null,
): boolean {
  if (chapterNum === 1) return true;
  const timestamps = Array.isArray(audioFileObj?.timestamps) ? audioFileObj.timestamps : [];
  if (timestamps.length === 0) return false;
  const first = timestamps[0];
  const firstKey = typeof first?.verse_key === 'string' ? first.verse_key : '';
  const firstFrom = typeof first?.timestamp_from === 'number' ? first.timestamp_from : 0;
  if (firstKey.endsWith(':0')) return true;
  if (firstKey === `${chapterNum}:1` && firstFrom >= 1500) return true;
  return false;
}

export function isQuranFoundationConfigured(): boolean {
  return Boolean(process.env.QF_CLIENT_ID?.trim() && process.env.QF_CLIENT_SECRET?.trim());
}

export interface QfScopeConfig {
  scopes: string[];
  scopeString: string;
  source: 'env' | 'default';
  valid: boolean;
  missingRequired: string[];
  error?: string;
}

export function resolveConfiguredQuranFoundationScopes(): QfScopeConfig {
  const rawEnv =
    process.env.QF_OAUTH_SCOPES !== undefined
      ? process.env.QF_OAUTH_SCOPES
      : process.env.QF_OAUTH_SCOPE;

  const source: 'env' | 'default' = rawEnv !== undefined ? 'env' : 'default';
  const rawTokens =
    rawEnv !== undefined
      ? rawEnv
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
      : [...DEFAULT_QF_OAUTH_SCOPES];

  const scopes = Array.from(new Set(rawTokens));
  const scopeString = scopes.join(' ');

  if (scopes.length === 0) {
    return {
      scopes: [],
      scopeString: '',
      source,
      valid: false,
      missingRequired: [QF_SCOPE_QURAN_READ, QF_SCOPE_AUDIO_READ],
      error:
        'QF_OAUTH_SCOPES is empty. Configure space-separated scopes approved in Quran Foundation Developer Console (e.g. "content.quran.read content.audio.read").',
    };
  }

  if (scopes.includes('content') && !scopes.includes(QF_SCOPE_QURAN_READ)) {
    return {
      scopes,
      scopeString,
      source,
      valid: false,
      missingRequired: [QF_SCOPE_QURAN_READ],
      error:
        'Legacy scope "content" is not supported for this Backend/Server OAuth client. Configure granular scopes approved in Quran Foundation Developer Console (e.g. "content.quran.read content.audio.read").',
    };
  }

  if (!scopes.includes(QF_SCOPE_QURAN_READ)) {
    return {
      scopes,
      scopeString,
      source,
      valid: false,
      missingRequired: [QF_SCOPE_QURAN_READ],
      error:
        `Required scope "${QF_SCOPE_QURAN_READ}" is missing from QF_OAUTH_SCOPES ("${scopeString}"). Request/approve "${QF_SCOPE_QURAN_READ}" in Quran Foundation Developer Console and include it in QF_OAUTH_SCOPES.`,
    };
  }

  const missingOptionalAudio = scopes.includes(QF_SCOPE_AUDIO_READ) ? [] : [QF_SCOPE_AUDIO_READ];
  return {
    scopes,
    scopeString,
    source,
    valid: true,
    missingRequired: missingOptionalAudio,
  };
}

function parseSpaceSeparatedScopes(scopeStr?: string): string[] {
  if (!scopeStr || typeof scopeStr !== 'string') return [];
  return Array.from(new Set(scopeStr.trim().split(/\s+/).filter(Boolean)));
}

/**
 * Normalizes Quran Foundation / QuranicAudio URLs:
 * - Converts protocol-relative `//mirrors...` to `https://mirrors...`
 * - Rejects anything failing `isSafeQuranAudioUrl` (HTTPS or `/assets/quran/` only).
 * - Never invents or guesses domains for bare relative paths.
 */
export function normalizeQuranAudioUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let cleaned = raw.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('//')) {
    cleaned = `https:${cleaned}`;
  }
  return isSafeQuranAudioUrl(cleaned) ? cleaned : null;
}

export interface QfOAuthDiagnosticAttempt {
  authMethod: 'client_secret_basic';
  endpoint: string;
  scopeRequested: string;
  httpStatus: number;
  ok: boolean;
  tokenReceived: boolean;
  grantedScope?: string;
  errorCode?: string;
  errorDescription?: string;
  responseKeys?: string[];
}

export interface QfEndpointDiagnostic {
  endpoint: string;
  httpStatus: number;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  responseKeys?: string[];
}

export interface QfDiagnosticsPayload {
  environment: 'production' | 'custom';
  oauthEndpoint: string;
  contentApiBaseUrl: string;
  primaryAuthMethod: 'client_secret_basic';
  requestedScopes: string[];
  scopeConfigSource: 'env' | 'default';
  grantedScopes: string[];
  oauthPrimary: QfOAuthDiagnosticAttempt | null;
  chapterApi: {
    requiredScope: typeof QF_SCOPE_QURAN_READ;
    scopeApproved: boolean;
    chaptersList: QfEndpointDiagnostic & { chaptersCount?: number };
    verseSample?: QfEndpointDiagnostic & { versesCount?: number };
    ok: boolean;
  } | null;
  reciterCheck: {
    verifiedHusaryId6: boolean;
    chapterReciter?: QfEndpointDiagnostic & {
      matchedName?: string;
      style?: string;
      qirat?: string;
    };
    verseRecitation?: QfEndpointDiagnostic & {
      matchedName?: string;
      style?: string;
    };
  } | null;
  audioApi: {
    requiredScope: typeof QF_SCOPE_AUDIO_READ;
    scopeApproved: boolean;
    ok: boolean;
    chapterAudiosOkCount: number;
    chapterAudiosTotalCount: number;
    verseAudiosOkCount: number;
    verseAudiosTotalCount: number;
    validHttpsSurahCount: number;
    validHttpsAyahCount: number;
    validHttpsTotalCount: number;
  } | null;
  chapterAudios: QfEndpointDiagnostic[];
  verseAudios: QfEndpointDiagnostic[];
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeParseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => '');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { rawNonJson: true };
  }
}

function extractSafeErrorFields(body: Record<string, unknown>): {
  errorCode?: string;
  errorMessage?: string;
} {
  const code =
    typeof body.error === 'string'
      ? body.error.slice(0, 80)
      : typeof body.code === 'string'
        ? body.code.slice(0, 80)
        : undefined;
  const msg =
    typeof body.error_description === 'string'
      ? body.error_description.slice(0, 220)
      : typeof body.message === 'string'
        ? body.message.slice(0, 220)
        : typeof body.error === 'string'
          ? body.error.slice(0, 220)
          : undefined;
  return { errorCode: code, errorMessage: msg };
}

async function requestOAuthTokenBasic(
  clientId: string,
  clientSecret: string,
  scopeString: string,
): Promise<{
  attempt: QfOAuthDiagnosticAttempt;
  accessToken: string | null;
  expiresIn: number;
}> {
  const params = new URLSearchParams();
  params.set('grant_type', 'client_credentials');
  params.set('scope', scopeString);

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    Authorization: `Basic ${basicAuth}`,
  };

  try {
    const res = await fetchWithTimeout(QF_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers,
      body: params.toString(),
    });
    const body = await safeParseJson(res);
    const { errorCode, errorMessage } = extractSafeErrorFields(body);
    const accessToken =
      res.ok && typeof body.access_token === 'string' && body.access_token.trim()
        ? body.access_token.trim()
        : null;
    const expiresIn = Math.max(60, Number(body.expires_in || 3600));
    const grantedScope = typeof body.scope === 'string' && body.scope.trim() ? body.scope.trim() : undefined;
    const safeKeys = Object.keys(body)
      .filter((k) => !/access_token|refresh_token|secret/i.test(k))
      .slice(0, 12);

    return {
      accessToken,
      expiresIn,
      attempt: {
        authMethod: 'client_secret_basic',
        endpoint: QF_OAUTH_TOKEN_URL,
        scopeRequested: scopeString,
        httpStatus: res.status,
        ok: Boolean(res.ok && accessToken),
        tokenReceived: Boolean(accessToken),
        grantedScope,
        ...(errorCode ? { errorCode } : {}),
        ...(errorMessage ? { errorDescription: errorMessage } : {}),
        responseKeys: safeKeys,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth network failure';
    return {
      accessToken: null,
      expiresIn: 0,
      attempt: {
        authMethod: 'client_secret_basic',
        endpoint: QF_OAUTH_TOKEN_URL,
        scopeRequested: scopeString,
        httpStatus: 0,
        ok: false,
        tokenReceived: false,
        errorCode: 'NETWORK_ERROR',
        errorDescription: msg.slice(0, 160),
      },
    };
  }
}

function buildMissingScopeInstruction(
  requestedScopes: string[],
  errorCode?: string,
  errorDescription?: string,
): string {
  const details = errorDescription || errorCode || 'Scope not approved';
  if (errorCode === 'invalid_scope' || /scope/i.test(details)) {
    return `Quran Foundation OAuth rejected the requested scopes ("${requestedScopes.join(' ')}") with ${errorCode || 'invalid_scope'}: ${details}. Request and approve the required scope(s) (${QF_SCOPE_QURAN_READ}, ${QF_SCOPE_AUDIO_READ}) for this Production Backend/Server client in the Quran Foundation Developer Console, or set QF_OAUTH_SCOPES to the exact approved space-separated scopes.`;
  }
  return `Quran Foundation OAuth failed with client_secret_basic (${details}).`;
}

async function getQuranFoundationAccessToken(scopeConfig: QfScopeConfig): Promise<{
  token: string | null;
  clientId: string | null;
  grantedScopes: string[];
  oauthPrimary: QfOAuthDiagnosticAttempt | null;
  error?: string;
}> {
  const clientId = process.env.QF_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.QF_CLIENT_SECRET?.trim() || '';
  if (!clientId || !clientSecret) {
    return {
      token: null,
      clientId: null,
      grantedScopes: [],
      oauthPrimary: null,
      error: 'QF_CLIENT_ID and QF_CLIENT_SECRET are not configured on the server.',
    };
  }

  if (!scopeConfig.valid || !scopeConfig.scopeString) {
    return {
      token: null,
      clientId: null,
      grantedScopes: [],
      oauthPrimary: null,
      error: scopeConfig.error || 'Configured Quran Foundation OAuth scopes are invalid or missing.',
    };
  }

  if (
    cachedQfToken &&
    cachedQfToken.scopeString === scopeConfig.scopeString &&
    Date.now() < cachedQfToken.expiresAtMs - 30_000
  ) {
    const grantedScopes = parseSpaceSeparatedScopes(cachedQfToken.grantedScope);
    return {
      token: cachedQfToken.accessToken,
      clientId,
      grantedScopes,
      oauthPrimary: {
        authMethod: 'client_secret_basic',
        endpoint: QF_OAUTH_TOKEN_URL,
        scopeRequested: scopeConfig.scopeString,
        httpStatus: 200,
        ok: true,
        tokenReceived: true,
        grantedScope: cachedQfToken.grantedScope,
      },
    };
  }

  // Use client_secret_basic ONLY — never fall back to client_secret_post or legacy `content` scope
  const primary = await requestOAuthTokenBasic(clientId, clientSecret, scopeConfig.scopeString);

  if (primary.accessToken) {
    cachedQfToken = {
      accessToken: primary.accessToken,
      expiresAtMs: Date.now() + primary.expiresIn * 1000,
      scopeString: scopeConfig.scopeString,
      grantedScope: primary.attempt.grantedScope,
    };
    return {
      token: cachedQfToken.accessToken,
      clientId,
      grantedScopes: parseSpaceSeparatedScopes(primary.attempt.grantedScope),
      oauthPrimary: primary.attempt,
    };
  }

  const errMsg = buildMissingScopeInstruction(
    scopeConfig.scopes,
    primary.attempt.errorCode,
    primary.attempt.errorDescription || `HTTP ${primary.attempt.httpStatus}`,
  );

  return {
    token: null,
    clientId: null,
    grantedScopes: [],
    oauthPrimary: primary.attempt,
    error: `Quran Foundation OAuth failed (HTTP ${primary.attempt.httpStatus}): ${errMsg}`,
  };
}

export interface QfHusaryMetadataResult {
  configured: boolean;
  reciter: typeof HUSARY_MURATTAL_SPEC;
  attributionRequired: boolean;
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
  basmalaIncludedBySurah: Record<string, boolean>;
  diagnostics: QfDiagnosticsPayload;
  validation: QuranFinalValidationReport;
  error?: string;
}

/**
 * Fetches chapter + per-verse recitation URLs for Sheikh Mahmoud Khalil Al-Husary (Hafs 'an 'Asim, Murattal)
 * from the official Quran Foundation Production Content API v4 when server credentials are configured.
 *
 * Execution sequence:
 * 1. Validate configured space-separated scopes before requesting token (never falls back to `content`).
 * 2. Request OAuth token using `client_secret_basic` only.
 * 3. Inspect granted scopes & verify Quran chapters/verses retrieval FIRST (`content.quran.read`) + validate text coverage.
 * 4. Check `content.audio.read`, verify Reciter ID 6 against provider catalog, fetch audio URLs, and probe real playable audio.
 *
 * Returns preview URLs + validation-only report + safe diagnostics — never auto-approves or auto-publishes.
 */
export async function fetchHusaryRecitationMetadata(
  chapterNumbers: number[],
): Promise<QfHusaryMetadataResult> {
  const envType =
    QF_OAUTH_TOKEN_URL === DEFAULT_QF_OAUTH_URL && QF_CONTENT_API_BASE === DEFAULT_QF_API_BASE
      ? 'production'
      : 'custom';
  const scopeConfig = resolveConfiguredQuranFoundationScopes();
  const uniqueChapters = Array.from(
    new Set(chapterNumbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= 114)),
  );

  let textCoverage: QuranTextValidationResult | null = null;
  let audioCoverage: QuranAudioValidationResult | null = null;
  let reciterVerification: QuranReciterValidationResult | null = null;

  const baseResult: QfHusaryMetadataResult = {
    configured: isQuranFoundationConfigured(),
    reciter: HUSARY_MURATTAL_SPEC,
    attributionRequired: true,
    surahAudioUrls: {},
    ayahAudioUrls: {},
    basmalaIncludedBySurah: {},
    diagnostics: {
      environment: envType,
      oauthEndpoint: QF_OAUTH_TOKEN_URL,
      contentApiBaseUrl: QF_CONTENT_API_BASE,
      primaryAuthMethod: 'client_secret_basic',
      requestedScopes: scopeConfig.scopes,
      scopeConfigSource: scopeConfig.source,
      grantedScopes: [],
      oauthPrimary: null,
      chapterApi: null,
      reciterCheck: null,
      audioApi: null,
      chapterAudios: [],
      verseAudios: [],
    },
    validation: buildFinalValidationReport({
      textCoverage: null,
      audioCoverage: null,
      reciterVerification: null,
    }),
  };

  if (!baseResult.configured) {
    return {
      ...baseResult,
      error: 'QF_CREDENTIALS_NOT_CONFIGURED',
    };
  }

  if (!scopeConfig.valid) {
    return {
      ...baseResult,
      error: scopeConfig.error || 'Configured OAuth scopes are invalid or missing.',
    };
  }

  try {
    const auth = await getQuranFoundationAccessToken(scopeConfig);
    baseResult.diagnostics.oauthPrimary = auth.oauthPrimary;
    baseResult.diagnostics.grantedScopes = auth.grantedScopes;

    if (!auth.token || !auth.clientId) {
      return {
        ...baseResult,
        error: auth.error || 'Unable to authenticate with Quran Foundation Content API.',
      };
    }

    const grantedKnown = auth.grantedScopes.length > 0;
    const quranReadApproved =
      scopeConfig.scopes.includes(QF_SCOPE_QURAN_READ) &&
      (!grantedKnown || auth.grantedScopes.includes(QF_SCOPE_QURAN_READ));

    if (!quranReadApproved) {
      baseResult.diagnostics.chapterApi = {
        requiredScope: QF_SCOPE_QURAN_READ,
        scopeApproved: false,
        chaptersList: {
          endpoint: `${QF_CONTENT_API_BASE}/chapters?language=en`,
          httpStatus: 0,
          ok: false,
          errorCode: 'MISSING_GRANTED_SCOPE',
          errorMessage: `Token granted scopes [${auth.grantedScopes.join(' ')}] do not include "${QF_SCOPE_QURAN_READ}".`,
        },
        ok: false,
      };
      return {
        ...baseResult,
        error: `Missing approved permission "${QF_SCOPE_QURAN_READ}". OAuth granted "${auth.grantedScopes.join(' ')}". Request/approve "${QF_SCOPE_QURAN_READ}" in the Quran Foundation Developer Console.`,
      };
    }

    const headers = {
      'x-auth-token': auth.token,
      'x-client-id': auth.clientId,
      Accept: 'application/json',
    };

    // 1. Verify Chapter & Verse retrieval FIRST (`content.quran.read`) across all previewed chapters
    const chaptersEndpoint = `${QF_CONTENT_API_BASE}/chapters?language=en`;
    const sampleChapter = uniqueChapters[0] ?? 1;
    const sampleVerseEndpoint = `${QF_CONTENT_API_BASE}/verses/by_chapter/${sampleChapter}?fields=text_uthmani&language=en&per_page=100`;

    const chaptersResPromise = fetchWithTimeout(chaptersEndpoint, { method: 'GET', headers });
    const verseChapterPromises = uniqueChapters.map(async (ch) => {
      const ep = `${QF_CONTENT_API_BASE}/verses/by_chapter/${ch}?fields=text_uthmani&language=en&per_page=100`;
      const res = await fetchWithTimeout(ep, { method: 'GET', headers });
      const json = await safeParseJson(res);
      return { ch, ep, res, json };
    });

    const [chaptersRes, verseResponses] = await Promise.all([
      chaptersResPromise,
      Promise.all(verseChapterPromises),
    ]);

    const chaptersJson = await safeParseJson(chaptersRes);
    const chaptersErr = extractSafeErrorFields(chaptersJson);
    const chaptersListRaw = Array.isArray(chaptersJson.chapters)
      ? (chaptersJson.chapters as Array<Record<string, unknown>>)
      : [];

    const firstVerseResp = verseResponses[0];
    const versesSampleJson = firstVerseResp?.json || {};
    const versesSampleErr = extractSafeErrorFields(versesSampleJson);
    const sampleVersesRaw = Array.isArray(versesSampleJson.verses) ? versesSampleJson.verses : [];
    const allVerseResponsesOk =
      verseResponses.length > 0 && verseResponses.every((vr) => vr.res.ok);

    const chapterApiOk =
      chaptersRes.ok &&
      chaptersListRaw.length > 0 &&
      allVerseResponsesOk &&
      sampleVersesRaw.length > 0;

    baseResult.diagnostics.chapterApi = {
      requiredScope: QF_SCOPE_QURAN_READ,
      scopeApproved:
        chaptersRes.status !== 403 &&
        verseResponses.every((vr) => vr.res.status !== 403) &&
        quranReadApproved,
      chaptersList: {
        endpoint: chaptersEndpoint,
        httpStatus: chaptersRes.status,
        ok: chaptersRes.ok && chaptersListRaw.length > 0,
        chaptersCount: chaptersListRaw.length,
        ...(chaptersErr.errorCode ? { errorCode: chaptersErr.errorCode } : {}),
        ...(chaptersErr.errorMessage ? { errorMessage: chaptersErr.errorMessage } : {}),
        responseKeys: Object.keys(chaptersJson).slice(0, 10),
      },
      verseSample: {
        endpoint: firstVerseResp?.ep || sampleVerseEndpoint,
        httpStatus: firstVerseResp?.res.status ?? 0,
        ok: allVerseResponsesOk && sampleVersesRaw.length > 0,
        versesCount: verseResponses.reduce(
          (sum, vr) => sum + (Array.isArray(vr.json.verses) ? vr.json.verses.length : 0),
          0,
        ),
        ...(versesSampleErr.errorCode ? { errorCode: versesSampleErr.errorCode } : {}),
        ...(versesSampleErr.errorMessage ? { errorMessage: versesSampleErr.errorMessage } : {}),
        responseKeys: Object.keys(versesSampleJson).slice(0, 10),
      },
      ok: chapterApiOk,
    };

    if (!chapterApiOk) {
      if (chaptersRes.status === 401 || verseResponses.some((vr) => vr.res.status === 401)) {
        cachedQfToken = null;
      }
      if (chaptersRes.status === 403 || verseResponses.some((vr) => vr.res.status === 403)) {
        return {
          ...baseResult,
          error: `Chapter/Verse API rejected request (HTTP 403). Verify that "${QF_SCOPE_QURAN_READ}" is approved for this Production client in the Quran Foundation Developer Console.`,
        };
      }
      const failedVerse = verseResponses.find((vr) => !vr.res.ok);
      const failStatus = !chaptersRes.ok ? chaptersRes.status : failedVerse?.res.status ?? 0;
      const failMsg = !chaptersRes.ok
        ? chaptersErr.errorMessage || chaptersErr.errorCode || `chaptersCount=${chaptersListRaw.length}`
        : extractSafeErrorFields(failedVerse?.json || {}).errorMessage ||
          `versesCount=${sampleVersesRaw.length}`;
      return {
        ...baseResult,
        error: `Quran Chapter/Verse API verification failed (HTTP ${failStatus}${failMsg ? `: ${failMsg}` : ''}).`,
      };
    }

    // Validate Quran text coverage against authoritative 114-chapter Quran structure & SHA-256 catalog
    const providerChapters: ProviderChapterInfo[] = chaptersListRaw.map((c) => ({
      id: Number(c.id),
      nameSimple: typeof c.name_simple === 'string' ? c.name_simple : undefined,
      nameArabic: typeof c.name_arabic === 'string' ? c.name_arabic : undefined,
      versesCount: typeof c.verses_count === 'number' ? c.verses_count : undefined,
    }));
    const providerVersesByChapter = new Map<number, ProviderVerseInfo[]>();
    for (const vr of verseResponses) {
      const list = Array.isArray(vr.json.verses)
        ? (vr.json.verses as Array<Record<string, unknown>>)
        : [];
      providerVersesByChapter.set(
        vr.ch,
        list.map((v) => ({
          verseNumber: typeof v.verse_number === 'number' ? v.verse_number : undefined,
          verseKey: typeof v.verse_key === 'string' ? v.verse_key : undefined,
          textUthmani: typeof v.text_uthmani === 'string' ? v.text_uthmani : undefined,
        })),
      );
    }
    textCoverage = validateQuranTextCoverage({
      providerChapters,
      providerVersesByChapter,
      curatedChapterNumbers: uniqueChapters,
    });
    baseResult.validation = buildFinalValidationReport({
      textCoverage,
      audioCoverage,
      reciterVerification,
    });

    // 2. Check `content.audio.read` before calling audio/reciter endpoints
    const audioScopeRequested = scopeConfig.scopes.includes(QF_SCOPE_AUDIO_READ);
    const audioScopeApproved =
      audioScopeRequested && (!grantedKnown || auth.grantedScopes.includes(QF_SCOPE_AUDIO_READ));

    if (!audioScopeApproved) {
      baseResult.diagnostics.audioApi = {
        requiredScope: QF_SCOPE_AUDIO_READ,
        scopeApproved: false,
        ok: false,
        chapterAudiosOkCount: 0,
        chapterAudiosTotalCount: 0,
        verseAudiosOkCount: 0,
        verseAudiosTotalCount: 0,
        validHttpsSurahCount: 0,
        validHttpsAyahCount: 0,
        validHttpsTotalCount: 0,
      };
      const reason = !audioScopeRequested
        ? `Scope "${QF_SCOPE_AUDIO_READ}" is not configured in QF_OAUTH_SCOPES (current: "${scopeConfig.scopeString}").`
        : `Token granted scopes ("${auth.grantedScopes.join(' ')}") do not include "${QF_SCOPE_AUDIO_READ}".`;
      return {
        ...baseResult,
        error: `Chapter/Verse API succeeded, but audio retrieval requires "${QF_SCOPE_AUDIO_READ}". ${reason} Request/approve "${QF_SCOPE_AUDIO_READ}" in the Quran Foundation Developer Console and include it in QF_OAUTH_SCOPES.`,
      };
    }

    // 3. Verify Reciter ID 6 explicitly maps to Sheikh Mahmoud Khalil Al-Husary (Hafs / Murattal)
    const chapterRecitersEndpoint = `${QF_CONTENT_API_BASE}/resources/chapter_reciters`;
    const verseRecitationsEndpoint = `${QF_CONTENT_API_BASE}/resources/recitations`;

    const [crRes, vrRes] = await Promise.all([
      fetchWithTimeout(chapterRecitersEndpoint, { method: 'GET', headers }),
      fetchWithTimeout(verseRecitationsEndpoint, { method: 'GET', headers }),
    ]);

    const [crJson, vrJson] = await Promise.all([safeParseJson(crRes), safeParseJson(vrRes)]);
    const crErr = extractSafeErrorFields(crJson);
    const vrErr = extractSafeErrorFields(vrJson);

    const chapterReciterList = Array.isArray(crJson.reciters)
      ? (crJson.reciters as Array<Record<string, unknown>>)
      : [];
    const verseRecitationList = Array.isArray(vrJson.recitations)
      ? (vrJson.recitations as Array<Record<string, unknown>>)
      : [];

    const matchedCr = chapterReciterList.find(
      (item) => Number(item.id) === HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
    );
    const matchedVr = verseRecitationList.find(
      (item) => Number(item.id) === HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
    );

    const crName = String(matchedCr?.name || '');
    const crStyle =
      typeof matchedCr?.style === 'object' && matchedCr.style
        ? String((matchedCr.style as Record<string, unknown>).name || '')
        : String(matchedCr?.style || '');
    const crQirat =
      typeof matchedCr?.qirat === 'object' && matchedCr.qirat
        ? String((matchedCr.qirat as Record<string, unknown>).name || '')
        : String(matchedCr?.qirat || '');
    const vrName = String(matchedVr?.reciter_name || matchedVr?.name || '');
    const vrStyle = String(matchedVr?.style || '');

    const crMatchesHusary =
      crRes.ok &&
      Boolean(matchedCr) &&
      /husar[yi]|حصري/i.test(crName) &&
      (!crStyle || /murattal/i.test(crStyle)) &&
      (!crQirat || /hafs/i.test(crQirat));
    const vrMatchesHusary =
      vrRes.ok &&
      Boolean(matchedVr) &&
      /husar[yi]|حصري/i.test(vrName) &&
      !/muallim/i.test(vrStyle);

    baseResult.diagnostics.reciterCheck = {
      verifiedHusaryId6: crMatchesHusary && vrMatchesHusary,
      chapterReciter: {
        endpoint: chapterRecitersEndpoint,
        httpStatus: crRes.status,
        ok: crRes.ok,
        ...(crErr.errorCode ? { errorCode: crErr.errorCode } : {}),
        ...(crErr.errorMessage ? { errorMessage: crErr.errorMessage } : {}),
        responseKeys: Object.keys(crJson).slice(0, 10),
        ...(matchedCr ? { matchedName: crName, style: crStyle || undefined, qirat: crQirat || undefined } : {}),
      },
      verseRecitation: {
        endpoint: verseRecitationsEndpoint,
        httpStatus: vrRes.status,
        ok: vrRes.ok,
        ...(vrErr.errorCode ? { errorCode: vrErr.errorCode } : {}),
        ...(vrErr.errorMessage ? { errorMessage: vrErr.errorMessage } : {}),
        responseKeys: Object.keys(vrJson).slice(0, 10),
        ...(matchedVr ? { matchedName: vrName, style: vrStyle || undefined } : {}),
      },
    };

    reciterVerification = {
      status: crMatchesHusary && vrMatchesHusary ? 'passed' : 'failed',
      recitationId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
      identityConfirmedFromMetadata: crMatchesHusary && vrMatchesHusary,
      matchedName: crName || vrName || undefined,
      style: crStyle || vrStyle || undefined,
      qirat: crQirat || undefined,
      sourceVerificationStatus: 'pending_source_verification',
      note:
        crMatchesHusary && vrMatchesHusary
          ? 'Reciter and recitation source verified against Quran Foundation provider metadata and technical audio integrity checks.'
          : `Reciter ID 6 verification failed against Content API catalog (chapter_reciters[6]="${crName}", recitations[6]="${vrName}").`,
    };
    baseResult.validation = buildFinalValidationReport({
      textCoverage,
      audioCoverage,
      reciterVerification,
    });

    if (!crRes.ok || !vrRes.ok) {
      if (crRes.status === 401 || vrRes.status === 401) {
        cachedQfToken = null;
      }
      const audioDenied = crRes.status === 403 || vrRes.status === 403;
      baseResult.diagnostics.audioApi = {
        requiredScope: QF_SCOPE_AUDIO_READ,
        scopeApproved: !audioDenied,
        ok: false,
        chapterAudiosOkCount: 0,
        chapterAudiosTotalCount: 0,
        verseAudiosOkCount: 0,
        verseAudiosTotalCount: 0,
        validHttpsSurahCount: 0,
        validHttpsAyahCount: 0,
        validHttpsTotalCount: 0,
      };
      if (audioDenied) {
        return {
          ...baseResult,
          error: `Audio reciter catalog rejected request (HTTP 403). Request/approve "${QF_SCOPE_AUDIO_READ}" for this Production client in the Quran Foundation Developer Console.`,
        };
      }
      const failStatus = !crRes.ok ? crRes.status : vrRes.status;
      const failMsg = !crRes.ok
        ? crErr.errorMessage || crErr.errorCode
        : vrErr.errorMessage || vrErr.errorCode;
      return {
        ...baseResult,
        error: `Content API reciter catalog failed (HTTP ${failStatus}${failMsg ? `: ${failMsg}` : ''}).`,
      };
    }

    if (!crMatchesHusary || !vrMatchesHusary) {
      baseResult.diagnostics.audioApi = {
        requiredScope: QF_SCOPE_AUDIO_READ,
        scopeApproved: true,
        ok: false,
        chapterAudiosOkCount: 0,
        chapterAudiosTotalCount: 0,
        verseAudiosOkCount: 0,
        verseAudiosTotalCount: 0,
        validHttpsSurahCount: 0,
        validHttpsAyahCount: 0,
        validHttpsTotalCount: 0,
      };
      return {
        ...baseResult,
        error: `Reciter ID 6 verification failed against Content API catalog (chapter_reciters[6]="${crName}", recitations[6]="${vrName}").`,
      };
    }

    // 4. Fetch Surah and Ayah audio URLs for verified Reciter ID 6
    let failedEndpointMsg: string | null = null;
    let sawAudio403 = false;

    for (const chapterNum of uniqueChapters) {
      const surahId = `surah-${chapterNum}`;
      const chEndpoint = `${QF_CONTENT_API_BASE}/chapter_recitations/${HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId}/${chapterNum}?segments=true`;
      const vsEndpoint = `${QF_CONTENT_API_BASE}/recitations/${HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId}/by_chapter/${chapterNum}?per_page=100`;

      const [chapterRes, versesRes] = await Promise.all([
        fetchWithTimeout(chEndpoint, { method: 'GET', headers }),
        fetchWithTimeout(vsEndpoint, { method: 'GET', headers }),
      ]);

      if (chapterRes.status === 403 || versesRes.status === 403) {
        sawAudio403 = true;
      }

      const [cData, vData] = await Promise.all([
        safeParseJson(chapterRes),
        safeParseJson(versesRes),
      ]);
      const cErr = extractSafeErrorFields(cData);
      const vErr = extractSafeErrorFields(vData);

      baseResult.diagnostics.chapterAudios.push({
        endpoint: chEndpoint,
        httpStatus: chapterRes.status,
        ok: chapterRes.ok,
        ...(cErr.errorCode ? { errorCode: cErr.errorCode } : {}),
        ...(cErr.errorMessage ? { errorMessage: cErr.errorMessage } : {}),
        responseKeys: Object.keys(cData).slice(0, 10),
      });

      baseResult.diagnostics.verseAudios.push({
        endpoint: vsEndpoint,
        httpStatus: versesRes.status,
        ok: versesRes.ok,
        ...(vErr.errorCode ? { errorCode: vErr.errorCode } : {}),
        ...(vErr.errorMessage ? { errorMessage: vErr.errorMessage } : {}),
        responseKeys: Object.keys(vData).slice(0, 10),
      });

      if (chapterRes.ok) {
        const audioFileObj =
          cData.audio_file && typeof cData.audio_file === 'object'
            ? (cData.audio_file as {
                audio_url?: unknown;
                timestamps?: Array<{ verse_key?: unknown; timestamp_from?: unknown }>;
              })
            : undefined;
        const safeChapterUrl = normalizeQuranAudioUrl(audioFileObj?.audio_url);
        if (safeChapterUrl) {
          baseResult.surahAudioUrls[surahId] = safeChapterUrl;
        }
        baseResult.basmalaIncludedBySurah[surahId] = detectBasmalaIncludedInChapterAudio(
          chapterNum,
          audioFileObj,
        );
      } else if (!failedEndpointMsg) {
        failedEndpointMsg = `Chapter audio HTTP ${chapterRes.status}${cErr.errorMessage ? `: ${cErr.errorMessage}` : ''}`;
      }

      if (versesRes.ok) {
        const audioFiles = Array.isArray(vData.audio_files)
          ? (vData.audio_files as Array<{ verse_key?: unknown; url?: unknown }>)
          : [];
        for (const item of audioFiles) {
          if (typeof item.verse_key !== 'string' || !item.url) continue;
          const safeVerseUrl = normalizeQuranAudioUrl(item.url);
          if (safeVerseUrl) {
            baseResult.ayahAudioUrls[item.verse_key] = safeVerseUrl;
          }
        }
      } else if (!failedEndpointMsg) {
        failedEndpointMsg = `Verse audio HTTP ${versesRes.status}${vErr.errorMessage ? `: ${vErr.errorMessage}` : ''}`;
      }
    }

    // 5. Final Validation Stage: probe every returned HTTPS URL for playability, content-type, duplicates, and mapping
    audioCoverage = await validateQuranAudioCoverage({
      surahAudioUrls: baseResult.surahAudioUrls,
      ayahAudioUrls: baseResult.ayahAudioUrls,
      curatedChapterNumbers: uniqueChapters,
    });
    baseResult.validation = buildFinalValidationReport({
      textCoverage,
      audioCoverage,
      reciterVerification,
    });

    const totalSurahs = Object.keys(baseResult.surahAudioUrls).length;
    const totalAyahs = Object.keys(baseResult.ayahAudioUrls).length;
    const totalValid = totalSurahs + totalAyahs;
    const chapterAudiosOkCount = baseResult.diagnostics.chapterAudios.filter((x) => x.ok).length;
    const verseAudiosOkCount = baseResult.diagnostics.verseAudios.filter((x) => x.ok).length;

    baseResult.diagnostics.audioApi = {
      requiredScope: QF_SCOPE_AUDIO_READ,
      scopeApproved: !sawAudio403,
      ok: totalValid > 0 && !failedEndpointMsg && audioCoverage.status === 'passed',
      chapterAudiosOkCount,
      chapterAudiosTotalCount: baseResult.diagnostics.chapterAudios.length,
      verseAudiosOkCount,
      verseAudiosTotalCount: baseResult.diagnostics.verseAudios.length,
      validHttpsSurahCount: totalSurahs,
      validHttpsAyahCount: totalAyahs,
      validHttpsTotalCount: totalValid,
    };

    if (sawAudio403 && totalValid === 0) {
      baseResult.error = `Audio API rejected request (HTTP 403). Request/approve "${QF_SCOPE_AUDIO_READ}" for this Production client in the Quran Foundation Developer Console.`;
    } else if (totalValid === 0) {
      baseResult.error =
        failedEndpointMsg ||
        'Content API returned HTTP 200 but zero valid HTTPS Surah or Ayah audio URLs matched the response schema.';
    } else if (textCoverage && textCoverage.status === 'failed') {
      baseResult.error =
        'Quran text coverage validation detected missing, duplicate, or mismatched chapters/ayahs.';
    } else if (audioCoverage.status === 'failed') {
      baseResult.error = `Audio validation detected issues (missingSurahs=${audioCoverage.missingSurahAudioIds.length}, missingAyahs=${audioCoverage.missingAyahKeys.length}, duplicates=${audioCoverage.duplicateUrls.length}, invalidResources=${audioCoverage.invalidResources.length}).`;
    }

    if (totalSurahs > 0 || totalAyahs > 0) {
      cachedTestingAudio = {
        fetchedAt: new Date().toISOString(),
        fetchedAtMs: Date.now(),
        surahAudioUrls: { ...baseResult.surahAudioUrls },
        ayahAudioUrls: { ...baseResult.ayahAudioUrls },
        basmalaIncludedBySurah: { ...baseResult.basmalaIncludedBySurah },
      };
    }

    return baseResult;
  } catch (err) {
    return {
      ...baseResult,
      error: err instanceof Error ? err.message : 'Quran Foundation API request failed.',
    };
  }
}

export interface QfTestingAudioResult {
  ok: boolean;
  configured: boolean;
  testingMode: 'ADMIN_INTERNAL_TESTING_ONLY';
  releasedToFamilies: false;
  verificationStatus: 'pending_verification';
  autoApproved: false;
  autoPublished: false;
  reciter: typeof HUSARY_MURATTAL_SPEC;
  attributionRequired: true;
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
  basmalaIncludedBySurah: Record<string, boolean>;
  basmalaCandidateAudioUrl: string | null;
  surahCount: number;
  ayahCount: number;
  totalResources: number;
  fetchedAt: string | null;
  fromCache: boolean;
  error?: string;
}

/**
 * Fetches exact HTTPS Surah and Ayah audio URLs for Reciter ID 6 directly from
 * Quran Foundation Content API v4 for ADMIN / INTERNAL TESTING MODE ONLY.
 *
 * - Never invents, constructs, or substitutes audio URLs.
 * - Never marks verificationStatus as 'verified' (remains 'pending_verification').
 * - Never writes to database or exposes OAuth credentials/tokens.
 */
export async function fetchHusaryTestingAudioUrls(
  chapterNumbers: number[],
  forceRefresh = false,
): Promise<QfTestingAudioResult> {
  const configured = isQuranFoundationConfigured();
  const basePayload: QfTestingAudioResult = {
    ok: false,
    configured,
    testingMode: 'ADMIN_INTERNAL_TESTING_ONLY',
    releasedToFamilies: false,
    verificationStatus: 'pending_verification',
    autoApproved: false,
    autoPublished: false,
    reciter: HUSARY_MURATTAL_SPEC,
    attributionRequired: true,
    surahAudioUrls: {},
    ayahAudioUrls: {},
    basmalaIncludedBySurah: {},
    basmalaCandidateAudioUrl: null,
    surahCount: 0,
    ayahCount: 0,
    totalResources: 0,
    fetchedAt: null,
    fromCache: false,
  };

  if (!configured) {
    return {
      ...basePayload,
      error: 'QF_CREDENTIALS_NOT_CONFIGURED',
    };
  }

  const uniqueChapters = Array.from(
    new Set(chapterNumbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= 114)),
  );

  if (
    !forceRefresh &&
    cachedTestingAudio &&
    Date.now() - cachedTestingAudio.fetchedAtMs < TESTING_AUDIO_CACHE_TTL_MS &&
    uniqueChapters.every((ch) => Boolean(cachedTestingAudio?.surahAudioUrls[`surah-${ch}`]))
  ) {
    const surahCount = Object.keys(cachedTestingAudio.surahAudioUrls).length;
    const ayahCount = Object.keys(cachedTestingAudio.ayahAudioUrls).length;
    return {
      ...basePayload,
      ok: surahCount > 0 || ayahCount > 0,
      surahAudioUrls: { ...cachedTestingAudio.surahAudioUrls },
      ayahAudioUrls: { ...cachedTestingAudio.ayahAudioUrls },
      basmalaIncludedBySurah: { ...cachedTestingAudio.basmalaIncludedBySurah },
      basmalaCandidateAudioUrl: cachedTestingAudio.ayahAudioUrls['1:1'] || null,
      surahCount,
      ayahCount,
      totalResources: surahCount + ayahCount,
      fetchedAt: cachedTestingAudio.fetchedAt,
      fromCache: true,
    };
  }

  const scopeConfig = resolveConfiguredQuranFoundationScopes();
  if (!scopeConfig.valid) {
    return {
      ...basePayload,
      error: scopeConfig.error || 'Configured OAuth scopes are invalid or missing.',
    };
  }

  try {
    const auth = await getQuranFoundationAccessToken(scopeConfig);
    if (!auth.token || !auth.clientId) {
      return {
        ...basePayload,
        error: auth.error || 'Unable to authenticate with Quran Foundation Content API.',
      };
    }

    const grantedKnown = auth.grantedScopes.length > 0;
    const audioApproved =
      scopeConfig.scopes.includes(QF_SCOPE_AUDIO_READ) &&
      (!grantedKnown || auth.grantedScopes.includes(QF_SCOPE_AUDIO_READ));
    if (!audioApproved) {
      return {
        ...basePayload,
        error: `Missing approved permission "${QF_SCOPE_AUDIO_READ}".`,
      };
    }

    const headers = {
      'x-auth-token': auth.token,
      'x-client-id': auth.clientId,
      Accept: 'application/json',
    };

    // Confirm Reciter ID 6 matches Al-Husary Murattal / Hafs before fetching audio URLs
    const chapterRecitersEndpoint = `${QF_CONTENT_API_BASE}/resources/chapter_reciters`;
    const verseRecitationsEndpoint = `${QF_CONTENT_API_BASE}/resources/recitations`;
    const [crRes, vrRes] = await Promise.all([
      fetchWithTimeout(chapterRecitersEndpoint, { method: 'GET', headers }),
      fetchWithTimeout(verseRecitationsEndpoint, { method: 'GET', headers }),
    ]);

    if (!crRes.ok || !vrRes.ok) {
      if (crRes.status === 401 || vrRes.status === 401) {
        cachedQfToken = null;
      }
      return {
        ...basePayload,
        error: `Content API reciter verification failed (HTTP ${!crRes.ok ? crRes.status : vrRes.status}).`,
      };
    }

    const [crJson, vrJson] = await Promise.all([safeParseJson(crRes), safeParseJson(vrRes)]);
    const chapterReciterList = Array.isArray(crJson.reciters)
      ? (crJson.reciters as Array<Record<string, unknown>>)
      : [];
    const verseRecitationList = Array.isArray(vrJson.recitations)
      ? (vrJson.recitations as Array<Record<string, unknown>>)
      : [];

    const matchedCr = chapterReciterList.find(
      (item) => Number(item.id) === HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
    );
    const matchedVr = verseRecitationList.find(
      (item) => Number(item.id) === HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
    );
    const crName = String(matchedCr?.name || '');
    const vrName = String(matchedVr?.reciter_name || matchedVr?.name || '');
    if (!matchedCr || !matchedVr || !/husar[yi]|حصري/i.test(crName) || !/husar[yi]|حصري/i.test(vrName)) {
      return {
        ...basePayload,
        error: 'Reciter ID 6 verification mismatch against Quran Foundation Content API.',
      };
    }

    const surahAudioUrls: Record<string, string> = {};
    const ayahAudioUrls: Record<string, string> = {};
    const basmalaIncludedBySurah: Record<string, boolean> = {};
    let firstErr: string | undefined;

    await Promise.all(
      uniqueChapters.map(async (chapterNum) => {
        const surahId = `surah-${chapterNum}`;
        const chEndpoint = `${QF_CONTENT_API_BASE}/chapter_recitations/${HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId}/${chapterNum}?segments=true`;
        const vsEndpoint = `${QF_CONTENT_API_BASE}/recitations/${HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId}/by_chapter/${chapterNum}?per_page=100`;

        const [chapterRes, versesRes] = await Promise.all([
          fetchWithTimeout(chEndpoint, { method: 'GET', headers }),
          fetchWithTimeout(vsEndpoint, { method: 'GET', headers }),
        ]);

        if (chapterRes.ok) {
          const cData = await safeParseJson(chapterRes);
          const audioFileObj =
            cData.audio_file && typeof cData.audio_file === 'object'
              ? (cData.audio_file as {
                  audio_url?: unknown;
                  timestamps?: Array<{ verse_key?: unknown; timestamp_from?: unknown }>;
                })
              : undefined;
          const safeChapterUrl = normalizeQuranAudioUrl(audioFileObj?.audio_url);
          if (safeChapterUrl) {
            surahAudioUrls[surahId] = safeChapterUrl;
          }
          basmalaIncludedBySurah[surahId] = detectBasmalaIncludedInChapterAudio(
            chapterNum,
            audioFileObj,
          );
        } else if (!firstErr) {
          firstErr = `Chapter audio HTTP ${chapterRes.status}`;
        }

        if (versesRes.ok) {
          const vData = await safeParseJson(versesRes);
          const audioFiles = Array.isArray(vData.audio_files)
            ? (vData.audio_files as Array<{ verse_key?: unknown; url?: unknown }>)
            : [];
          for (const item of audioFiles) {
            if (typeof item.verse_key !== 'string' || !item.url) continue;
            const safeVerseUrl = normalizeQuranAudioUrl(item.url);
            if (safeVerseUrl) {
              ayahAudioUrls[item.verse_key] = safeVerseUrl;
            }
          }
        } else if (!firstErr) {
          firstErr = `Verse audio HTTP ${versesRes.status}`;
        }
      }),
    );

    const surahCount = Object.keys(surahAudioUrls).length;
    const ayahCount = Object.keys(ayahAudioUrls).length;
    const totalResources = surahCount + ayahCount;
    const fetchedAt = new Date().toISOString();

    if (totalResources > 0) {
      cachedTestingAudio = {
        fetchedAt,
        fetchedAtMs: Date.now(),
        surahAudioUrls: { ...surahAudioUrls },
        ayahAudioUrls: { ...ayahAudioUrls },
        basmalaIncludedBySurah: { ...basmalaIncludedBySurah },
      };
    }

    return {
      ...basePayload,
      ok: totalResources > 0,
      surahAudioUrls,
      ayahAudioUrls,
      basmalaIncludedBySurah,
      basmalaCandidateAudioUrl: ayahAudioUrls['1:1'] || null,
      surahCount,
      ayahCount,
      totalResources,
      fetchedAt,
      fromCache: false,
      ...(totalResources === 0 ? { error: firstErr || 'NO_RECITATION_AUDIO_FOUND' } : {}),
    };
  } catch (err) {
    return {
      ...basePayload,
      error: err instanceof Error ? err.message : 'Quran Foundation testing audio fetch failed.',
    };
  }
}

const VERIFIED_QF_AUDIO_HOSTS = new Set([
  'verses.quran.foundation',
  'audio.qurancdn.com',
  'mirrors.quranicaudio.com',
  'download.quranicaudio.com',
]);

export function isAllowedQuranFoundationAudioHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && VERIFIED_QF_AUDIO_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getCachedHusaryBasmalaCandidateUrl(): string | null {
  if (!cachedTestingAudio) return null;
  if (Date.now() - cachedTestingAudio.fetchedAtMs >= TESTING_AUDIO_CACHE_TTL_MS) {
    return null;
  }
  return cachedTestingAudio.ayahAudioUrls['1:1'] || null;
}

const QF_PUBLIC_API_V4_BASE = 'https://api.quran.com/api/v4';

export interface PublicQfReciter6FetchResult {
  ok: boolean;
  provider: 'Quran Foundation';
  reciterId: number;
  reciterIdentity: string;
  recitationStyle: string;
  riwayah: string;
  providerMetadataVerified: boolean;
  matchedChapterReciterName?: string;
  matchedVerseReciterName?: string;
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
  basmalaIncludedBySurah: Record<string, boolean>;
  basmalaCandidateAudioUrl: string | null;
  error?: string;
}

/**
 * Fetches verified Reciter ID 6 metadata and official CDN audio URLs directly from
 * Quran Foundation's public Content API v4 (`api.quran.com/api/v4`) when OAuth
 * production client credentials are not set or as an official metadata cross-check.
 * Never substitutes another reciter and never generates/synthesizes audio.
 */
export async function fetchPublicQuranFoundationReciter6Data(
  chapterNumbers: number[],
): Promise<PublicQfReciter6FetchResult> {
  const uniqueChapters = Array.from(
    new Set(chapterNumbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= 114)),
  );
  const base: PublicQfReciter6FetchResult = {
    ok: false,
    provider: 'Quran Foundation',
    reciterId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
    reciterIdentity: 'Sheikh Mahmoud Khalil Al-Husary',
    recitationStyle: 'Murattal',
    riwayah: "Hafs 'an Asim",
    providerMetadataVerified: false,
    surahAudioUrls: {},
    ayahAudioUrls: {},
    basmalaIncludedBySurah: {},
    basmalaCandidateAudioUrl: null,
  };

  try {
    const headers = { Accept: 'application/json' };
    const [crRes, vrRes] = await Promise.all([
      fetchWithTimeout(`${QF_PUBLIC_API_V4_BASE}/resources/chapter_reciters`, { method: 'GET', headers }),
      fetchWithTimeout(`${QF_PUBLIC_API_V4_BASE}/resources/recitations`, { method: 'GET', headers }),
    ]);

    if (!crRes.ok || !vrRes.ok) {
      return {
        ...base,
        error: `Quran Foundation public v4 metadata lookup failed (HTTP ${!crRes.ok ? crRes.status : vrRes.status}).`,
      };
    }

    const [crJson, vrJson] = await Promise.all([safeParseJson(crRes), safeParseJson(vrRes)]);
    const chapterReciters = Array.isArray(crJson.reciters)
      ? (crJson.reciters as Array<Record<string, unknown>>)
      : [];
    const verseRecitations = Array.isArray(vrJson.recitations)
      ? (vrJson.recitations as Array<Record<string, unknown>>)
      : [];

    const matchedCr = chapterReciters.find(
      (item) => Number(item.id) === HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
    );
    const matchedVr = verseRecitations.find(
      (item) => Number(item.id) === HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
    );

    const crName = String(matchedCr?.name || '');
    const crStyle =
      typeof matchedCr?.style === 'object' && matchedCr.style
        ? String((matchedCr.style as Record<string, unknown>).name || '')
        : String(matchedCr?.style || '');
    const crQirat =
      typeof matchedCr?.qirat === 'object' && matchedCr.qirat
        ? String((matchedCr.qirat as Record<string, unknown>).name || '')
        : String(matchedCr?.qirat || '');
    const vrName = String(matchedVr?.reciter_name || matchedVr?.name || '');
    const vrStyle = String(matchedVr?.style || '');

    const crOk =
      Boolean(matchedCr) &&
      /husar[yi]|حصري/i.test(crName) &&
      (!crStyle || /murattal/i.test(crStyle)) &&
      (!crQirat || /hafs/i.test(crQirat));
    const vrOk =
      Boolean(matchedVr) &&
      /husar[yi]|حصري/i.test(vrName) &&
      !/muallim/i.test(vrStyle);

    if (!crOk || !vrOk) {
      return {
        ...base,
        matchedChapterReciterName: crName || undefined,
        matchedVerseReciterName: vrName || undefined,
        error: `Reciter ID 6 metadata check failed on QF Content API v4 (chapter_reciters="${crName}", recitations="${vrName}").`,
      };
    }

    const surahAudioUrls: Record<string, string> = {};
    const ayahAudioUrls: Record<string, string> = {};
    const basmalaIncludedBySurah: Record<string, boolean> = {};

    await Promise.all(
      uniqueChapters.map(async (chapterNum) => {
        const surahId = `surah-${chapterNum}`;
        const [chRes, vsRes] = await Promise.all([
          fetchWithTimeout(
            `${QF_PUBLIC_API_V4_BASE}/chapter_recitations/${HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId}/${chapterNum}?segments=true`,
            { method: 'GET', headers },
          ),
          fetchWithTimeout(
            `${QF_PUBLIC_API_V4_BASE}/recitations/${HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId}/by_chapter/${chapterNum}?per_page=100`,
            { method: 'GET', headers },
          ),
        ]);

        if (chRes.ok) {
          const cData = await safeParseJson(chRes);
          const audioFileObj =
            cData.audio_file && typeof cData.audio_file === 'object'
              ? (cData.audio_file as {
                  audio_url?: unknown;
                  timestamps?: Array<{ verse_key?: unknown; timestamp_from?: unknown }>;
                })
              : undefined;
          const safeUrl = normalizeQuranAudioUrl(audioFileObj?.audio_url);
          if (safeUrl && isAllowedQuranFoundationAudioHost(safeUrl)) {
            surahAudioUrls[surahId] = safeUrl;
          }
          basmalaIncludedBySurah[surahId] = detectBasmalaIncludedInChapterAudio(
            chapterNum,
            audioFileObj,
          );
        }

        if (vsRes.ok) {
          const vData = await safeParseJson(vsRes);
          const files = Array.isArray(vData.audio_files)
            ? (vData.audio_files as Array<{ verse_key?: unknown; url?: unknown }>)
            : [];
          for (const item of files) {
            if (typeof item.verse_key !== 'string' || !item.url) continue;
            const safeUrl = normalizeQuranAudioUrl(item.url);
            if (safeUrl && isAllowedQuranFoundationAudioHost(safeUrl)) {
              ayahAudioUrls[item.verse_key] = safeUrl;
            }
          }
        }
      }),
    );

    return {
      ok: Object.keys(surahAudioUrls).length > 0 && Object.keys(ayahAudioUrls).length > 0,
      provider: 'Quran Foundation',
      reciterId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
      reciterIdentity: 'Sheikh Mahmoud Khalil Al-Husary',
      recitationStyle: crStyle || vrStyle || 'Murattal',
      riwayah: crQirat || "Hafs 'an Asim",
      providerMetadataVerified: true,
      matchedChapterReciterName: crName,
      matchedVerseReciterName: vrName,
      surahAudioUrls,
      ayahAudioUrls,
      basmalaIncludedBySurah,
      basmalaCandidateAudioUrl: ayahAudioUrls['1:1'] || null,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : 'Failed to query Quran Foundation Content API v4.',
    };
  }
}

export async function fetchAuthorizedQfReciter6BasmalaUrl(): Promise<{
  url: string | null;
  reciterVerified: boolean;
  error?: string;
}> {
  try {
    const headers = { Accept: 'application/json' };
    const [recRes, ayahRes] = await Promise.all([
      fetchWithTimeout(`${QF_PUBLIC_API_V4_BASE}/resources/recitations`, { method: 'GET', headers }),
      fetchWithTimeout(
        `${QF_PUBLIC_API_V4_BASE}/recitations/${HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId}/by_ayah/1:1`,
        { method: 'GET', headers },
      ),
    ]);
    if (!recRes.ok || !ayahRes.ok) {
      return {
        url: null,
        reciterVerified: false,
        error: `QF v4 lookup returned HTTP ${!recRes.ok ? recRes.status : ayahRes.status}`,
      };
    }
    const [recJson, ayahJson] = await Promise.all([safeParseJson(recRes), safeParseJson(ayahRes)]);
    const list = Array.isArray(recJson.recitations)
      ? (recJson.recitations as Array<Record<string, unknown>>)
      : [];
    const matched = list.find(
      (r) => Number(r.id) === HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
    );
    const recName = String(matched?.reciter_name || matched?.name || '');
    const recStyle = String(matched?.style || '');
    const reciterVerified = Boolean(matched && /husar[yi]|حصري/i.test(recName) && !/muallim/i.test(recStyle));
    if (!reciterVerified) {
      return {
        url: null,
        reciterVerified: false,
        error: 'Reciter ID 6 verification failed in QF recitations catalog.',
      };
    }
    const audioFiles = Array.isArray(ayahJson.audio_files)
      ? (ayahJson.audio_files as Array<{ verse_key?: unknown; url?: unknown }>)
      : [];
    const entry = audioFiles.find((f) => f.verse_key === '1:1') || audioFiles[0];
    const normalized = normalizeQuranAudioUrl(entry?.url);
    if (!normalized || !isAllowedQuranFoundationAudioHost(normalized)) {
      return {
        url: null,
        reciterVerified,
        error: 'QF v4 1:1 response did not include an allowed HTTPS audio URL.',
      };
    }
    return { url: normalized, reciterVerified };
  } catch (err) {
    return {
      url: null,
      reciterVerified: false,
      error: err instanceof Error ? err.message : 'Failed fetching QF v4 1:1 Basmala URL.',
    };
  }
}
