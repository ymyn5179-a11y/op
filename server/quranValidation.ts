import crypto from 'node:crypto';
import { QURAN_SURAHS } from '../src/data/quranCatalog';
import { isSafeQuranAudioUrl } from '../src/utils/validation';

export const AUTHORITATIVE_QURAN_CHAPTER_COUNT = 114;
export const AUTHORITATIVE_QURAN_TOTAL_AYAHS = 6236;

export const QURAN_FOUNDATION_LICENSE_INFO = {
  sourceName: 'Quran Foundation Content API v4 & Official Audio CDN (Terms Updated Nov 20, 2026)',
  attributionText:
    "Quran data provided by Quran.Foundation. — Recitation: Sheikh Mahmoud Khalil Al-Husary (Hafs 'an 'Asim, Murattal).",
  usageRestrictions: [
    'Commercial and freemium applications (subscriptions, in-app purchases, ads, donations) are permitted when Quran Foundation Content is integrated into the end-user experience — do not request or invent an additional paid API license.',
    'Do not sell, sublicense, or redistribute Quran Foundation Content or raw audio URLs as a standalone package, bulk download, or independent API feed.',
    'Stream audio directly from approved Quran Foundation CDN URLs only (never rehost files locally); server-side URL caching must not exceed 7 days without Content Sync refresh.',
    'Quranic Uthmani text must remain unaltered and protected from automated translation; no AI/ML model training on QF content or user content without explicit consent.',
    'Commercial API permission never substitutes for Reciter & Recitation Source Verification, technical audio integrity checks, Basmala asset approval, and explicit administrator confirmations required before family release.',
  ],
  commercialUsePermittedForIntegratedApp: true,
  commercialUseClaimed: true,
  paidApiLicenseRequired: false,
} as const;

export interface ProviderChapterInfo {
  id: number;
  nameSimple?: string;
  nameArabic?: string;
  versesCount?: number;
}

export interface ProviderVerseInfo {
  verseNumber?: number;
  verseKey?: string;
  textUthmani?: string;
}

export interface SurahTextValidationDetail {
  surahId: string;
  chapterNumber: number;
  nameEn: string;
  expectedAyahCount: number;
  providerDeclaredVersesCount: number | null;
  providerRetrievedAyahCount: number;
  localCatalogAyahCount: number;
  localSha256Match: boolean;
  missingAyahKeys: string[];
  duplicateAyahKeys: string[];
  unexpectedAyahKeys: string[];
  uthmaniMismatchCount: number;
  status: 'passed' | 'failed';
}

export interface QuranTextValidationResult {
  status: 'passed' | 'failed';
  authoritativeTotalChapters: number;
  authoritativeTotalAyahs: number;
  providerChaptersCount: number;
  curatedChaptersCount: number;
  curatedAyahsCount: number;
  uncoveredChaptersCount: number;
  scopeExplanation: string;
  missingChaptersFrom114: number[];
  duplicateChapterIds: number[];
  unexpectedChapterIds: number[];
  surahDetails: SurahTextValidationDetail[];
  totalMissingAyahs: number;
  totalDuplicateAyahs: number;
  totalUnexpectedAyahs: number;
  totalUthmaniMismatches: number;
  allLocalSha256Matched: boolean;
}

export interface InvalidAudioResource {
  targetKey: string;
  kind: 'surah' | 'ayah';
  url: string;
  httpStatus: number;
  contentType: string;
  byteLength: number;
  reason: string;
}

export interface DuplicateAudioMapping {
  url: string;
  keys: string[];
}

export interface AudioUrlProbeResult {
  url: string;
  finalUrl?: string;
  redirected: boolean;
  ok: boolean;
  httpStatus: number;
  contentType: string;
  byteLength: number;
  magicFormat: string;
  browserPlayable: boolean;
  checkedAt: string;
  reason?: string;
}

export interface QuranAudioValidationResult {
  status: 'passed' | 'failed';
  expectedSurahCount: number;
  expectedAyahCount: number;
  returnedSurahCount: number;
  returnedAyahCount: number;
  uniqueUrlsChecked: number;
  playableValidUrlCount: number;
  playableSurahCount: number;
  playableAyahCount: number;
  missingSurahAudioIds: string[];
  missingAyahKeys: string[];
  unexpectedSurahAudioIds: string[];
  unexpectedAyahKeys: string[];
  duplicateUrls: DuplicateAudioMapping[];
  invalidResources: InvalidAudioResource[];
}

export interface QuranReciterValidationResult {
  status: 'passed' | 'failed';
  recitationId: number;
  identityConfirmedFromMetadata: boolean;
  matchedName?: string;
  style?: string;
  qirat?: string;
  sourceVerificationStatus: 'pending_source_verification';
  note: string;
}

export interface QuranValidationWorkflowStatuses {
  textIntegrity: 'passed' | 'failed' | 'pending';
  audioIntegrity: 'passed' | 'failed' | 'pending';
  reciterIdentity: 'passed' | 'failed' | 'pending';
  sourceVerification: 'pending_admin_confirmation';
  licenseConfirmation: 'pending_admin_confirmation';
}

export interface QuranFinalValidationReport {
  validationOnly: true;
  autoApproved: false;
  autoPublished: false;
  verificationStatus: 'pending_verification';
  workflowStatuses: QuranValidationWorkflowStatuses;
  textCoverage: QuranTextValidationResult | null;
  audioCoverage: QuranAudioValidationResult | null;
  reciterVerification: QuranReciterValidationResult | null;
  licenseAndAttribution: {
    sourceName: string;
    attributionText: string;
    usageRestrictions: string[];
    commercialUsePermittedForIntegratedApp: true;
    commercialUseClaimed: boolean;
    paidApiLicenseRequired: false;
    adminConfirmationRequired: true;
  };
  passedChecks: string[];
  failedChecks: string[];
  pendingChecks: string[];
}

function normalizeArabicComparison(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export interface LocalCatalogSha256IntegrityResult {
  allMatched: boolean;
  verifiedSurahsCount: number;
  totalSurahsCount: number;
  verifiedAyahsCount: number;
  totalAyahsCount: number;
  checkedAt: string;
  details: Array<{
    surahId: string;
    chapterNumber: number;
    ayahCount: number;
    expectedSha256: string;
    computedSha256: string;
    matched: boolean;
  }>;
}

export function verifyLocalCatalogSha256Integrity(): LocalCatalogSha256IntegrityResult {
  const details: LocalCatalogSha256IntegrityResult['details'] = [];
  let verifiedSurahsCount = 0;
  let verifiedAyahsCount = 0;
  let totalAyahsCount = 0;

  for (const surah of QURAN_SURAHS) {
    totalAyahsCount += surah.ayahCount;
    const computedSha256 = crypto
      .createHash('sha256')
      .update(surah.ayahs.map((a) => a.textUthmani).join('\n'), 'utf8')
      .digest('hex');
    const allAyahsPresent =
      surah.ayahs.length === surah.ayahCount &&
      surah.ayahs.every((a) => Boolean(a.textUthmani && a.textUthmani.trim().length > 0));
    const matched = computedSha256 === surah.textSha256 && allAyahsPresent;
    if (matched) {
      verifiedSurahsCount += 1;
      verifiedAyahsCount += surah.ayahCount;
    }
    details.push({
      surahId: surah.id,
      chapterNumber: surah.number,
      ayahCount: surah.ayahCount,
      expectedSha256: surah.textSha256,
      computedSha256,
      matched,
    });
  }

  return {
    allMatched: verifiedSurahsCount === QURAN_SURAHS.length && verifiedAyahsCount === totalAyahsCount,
    verifiedSurahsCount,
    totalSurahsCount: QURAN_SURAHS.length,
    verifiedAyahsCount,
    totalAyahsCount,
    checkedAt: new Date().toISOString(),
    details,
  };
}

export function validateQuranTextCoverage(params: {
  providerChapters: ProviderChapterInfo[];
  providerVersesByChapter: Map<number, ProviderVerseInfo[]>;
  curatedChapterNumbers: number[];
}): QuranTextValidationResult {
  const { providerChapters, providerVersesByChapter, curatedChapterNumbers } = params;

  const seenChapterIds = new Set<number>();
  const duplicateChapterSet = new Set<number>();
  const unexpectedChapterSet = new Set<number>();
  const chapterMap = new Map<number, ProviderChapterInfo>();

  for (const ch of providerChapters) {
    if (!Number.isInteger(ch.id) || ch.id < 1 || ch.id > AUTHORITATIVE_QURAN_CHAPTER_COUNT) {
      unexpectedChapterSet.add(ch.id);
      continue;
    }
    if (seenChapterIds.has(ch.id)) {
      duplicateChapterSet.add(ch.id);
    } else {
      seenChapterIds.add(ch.id);
      chapterMap.set(ch.id, ch);
    }
  }

  const missingChaptersFrom114: number[] = [];
  for (let n = 1; n <= AUTHORITATIVE_QURAN_CHAPTER_COUNT; n++) {
    if (!seenChapterIds.has(n)) {
      missingChaptersFrom114.push(n);
    }
  }

  const targetSurahs = QURAN_SURAHS.filter((s) => curatedChapterNumbers.includes(s.number));
  const surahDetails: SurahTextValidationDetail[] = [];

  let totalMissingAyahs = 0;
  let totalDuplicateAyahs = 0;
  let totalUnexpectedAyahs = 0;
  let totalUthmaniMismatches = 0;
  let allLocalSha256Matched = true;

  for (const surah of targetSurahs) {
    const providerChapter = chapterMap.get(surah.number) ?? null;
    const providerDeclaredVersesCount =
      providerChapter && typeof providerChapter.versesCount === 'number'
        ? providerChapter.versesCount
        : null;

    const localSha256 = crypto
      .createHash('sha256')
      .update(surah.ayahs.map((a) => a.textUthmani).join('\n'), 'utf8')
      .digest('hex');
    const localSha256Match = localSha256 === surah.textSha256;
    if (!localSha256Match) {
      allLocalSha256Matched = false;
    }

    const retrievedVerses = providerVersesByChapter.get(surah.number) ?? [];
    const seenKeys = new Set<string>();
    const duplicateKeySet = new Set<string>();
    const unexpectedKeySet = new Set<string>();
    const verseByKey = new Map<string, ProviderVerseInfo>();

    for (const v of retrievedVerses) {
      const key = typeof v.verseKey === 'string' ? v.verseKey.trim() : '';
      const expectedPattern = new RegExp(`^${surah.number}:(\\d+)$`);
      const match = key.match(expectedPattern);
      const num = match ? Number(match[1]) : Number(v.verseNumber);
      if (
        !match ||
        !Number.isInteger(num) ||
        num < 1 ||
        num > surah.ayahCount ||
        (v.verseNumber !== undefined && v.verseNumber !== num)
      ) {
        unexpectedKeySet.add(key || `${surah.number}:unknown`);
        continue;
      }
      if (seenKeys.has(key)) {
        duplicateKeySet.add(key);
      } else {
        seenKeys.add(key);
        verseByKey.set(key, v);
      }
    }

    const missingAyahKeys: string[] = [];
    let uthmaniMismatchCount = 0;

    for (let i = 1; i <= surah.ayahCount; i++) {
      const expectedKey = `${surah.number}:${i}`;
      const localAyah = surah.ayahs.find((a) => a.number === i && a.verseKey === expectedKey);
      const retrieved = verseByKey.get(expectedKey);
      if (!retrieved || !localAyah) {
        missingAyahKeys.push(expectedKey);
        continue;
      }
      if (typeof retrieved.textUthmani === 'string' && retrieved.textUthmani.trim()) {
        if (
          normalizeArabicComparison(retrieved.textUthmani) !==
          normalizeArabicComparison(localAyah.textUthmani)
        ) {
          uthmaniMismatchCount++;
        }
      }
    }

    const duplicateAyahKeys = Array.from(duplicateKeySet);
    const unexpectedAyahKeys = Array.from(unexpectedKeySet);
    const declaredCountMismatch =
      providerDeclaredVersesCount !== null && providerDeclaredVersesCount !== surah.ayahCount;

    totalMissingAyahs += missingAyahKeys.length;
    totalDuplicateAyahs += duplicateAyahKeys.length;
    totalUnexpectedAyahs += unexpectedAyahKeys.length;
    totalUthmaniMismatches += uthmaniMismatchCount;

    const surahPassed =
      localSha256Match &&
      !declaredCountMismatch &&
      surah.ayahs.length === surah.ayahCount &&
      missingAyahKeys.length === 0 &&
      duplicateAyahKeys.length === 0 &&
      unexpectedAyahKeys.length === 0 &&
      uthmaniMismatchCount === 0;

    surahDetails.push({
      surahId: surah.id,
      chapterNumber: surah.number,
      nameEn: surah.nameEn,
      expectedAyahCount: surah.ayahCount,
      providerDeclaredVersesCount,
      providerRetrievedAyahCount: retrievedVerses.length,
      localCatalogAyahCount: surah.ayahs.length,
      localSha256Match,
      missingAyahKeys,
      duplicateAyahKeys,
      unexpectedAyahKeys,
      uthmaniMismatchCount,
      status: surahPassed ? 'passed' : 'failed',
    });
  }

  const curatedAyahsCount = targetSurahs.reduce((sum, s) => sum + s.ayahCount, 0);
  const uncoveredChaptersCount = Math.max(
    0,
    AUTHORITATIVE_QURAN_CHAPTER_COUNT - targetSurahs.length,
  );

  const passed =
    missingChaptersFrom114.length === 0 &&
    duplicateChapterSet.size === 0 &&
    unexpectedChapterSet.size === 0 &&
    allLocalSha256Matched &&
    totalMissingAyahs === 0 &&
    totalDuplicateAyahs === 0 &&
    totalUnexpectedAyahs === 0 &&
    totalUthmaniMismatches === 0 &&
    surahDetails.length > 0 &&
    surahDetails.every((d) => d.status === 'passed');

  return {
    status: passed ? 'passed' : 'failed',
    authoritativeTotalChapters: AUTHORITATIVE_QURAN_CHAPTER_COUNT,
    authoritativeTotalAyahs: AUTHORITATIVE_QURAN_TOTAL_AYAHS,
    providerChaptersCount: providerChapters.length,
    curatedChaptersCount: targetSurahs.length,
    curatedAyahsCount,
    uncoveredChaptersCount,
    scopeExplanation: `The full Quran has ${AUTHORITATIVE_QURAN_CHAPTER_COUNT} chapters (${AUTHORITATIVE_QURAN_TOTAL_AYAHS} ayahs). NonoLand's Little Explorers curriculum intentionally scopes this preview to ${targetSurahs.length} curated Surahs totaling ${curatedAyahsCount} ayahs (${uncoveredChaptersCount} chapters are outside the curated early-childhood catalog).`,
    missingChaptersFrom114,
    duplicateChapterIds: Array.from(duplicateChapterSet),
    unexpectedChapterIds: Array.from(unexpectedChapterSet),
    surahDetails,
    totalMissingAyahs,
    totalDuplicateAyahs,
    totalUnexpectedAyahs,
    totalUthmaniMismatches,
    allLocalSha256Matched,
  };
}

export function detectAudioMagicFormat(bytes: Uint8Array): {
  valid: boolean;
  format: string;
} {
  if (bytes.length < 4) {
    return { valid: false, format: 'empty_or_too_short' };
  }

  // Reject obvious text / HTML / JSON responses even when served with HTTP 200
  const prefixText = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(64, bytes.length)))
    .trimStart()
    .toLowerCase();
  if (
    prefixText.startsWith('<!doctype') ||
    prefixText.startsWith('<html') ||
    prefixText.startsWith('<?xml') ||
    prefixText.startsWith('{') ||
    prefixText.startsWith('[')
  ) {
    return { valid: false, format: 'text_or_html_payload' };
  }

  // ID3v2 tag ("ID3")
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { valid: true, format: 'mp3_id3v2' };
  }
  // MPEG Audio frame sync (MP3 / ADTS AAC)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { valid: true, format: 'mpeg_or_aac_frame' };
  }
  // Ogg container ("OggS")
  if (
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return { valid: true, format: 'ogg' };
  }
  // RIFF/WAVE
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return { valid: true, format: 'wav_riff' };
  }
  // ISO BMFF / MP4 / M4A ("ftyp" at offset 4)
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return { valid: true, format: 'mp4_m4a' };
  }
  // FLAC ("fLaC")
  if (
    bytes[0] === 0x66 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x61 &&
    bytes[3] === 0x43
  ) {
    return { valid: true, format: 'flac' };
  }

  return { valid: false, format: 'unknown_binary_header' };
}

function isAudioMimeType(contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  if (!ct) return false;
  if (ct.startsWith('audio/')) return true;
  if (ct === 'application/ogg') return true;
  return false;
}

function isBrowserPlayableMimeAndFormat(contentType: string, magicFormat: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  const validFormats = new Set([
    'mp3_id3v2',
    'mpeg_or_aac_frame',
    'ogg',
    'wav_riff',
    'mp4_m4a',
    'flac',
  ]);
  if (!validFormats.has(magicFormat)) return false;
  if (
    ct === 'audio/mpeg' ||
    ct === 'audio/mp3' ||
    ct === 'audio/mp4' ||
    ct === 'audio/aac' ||
    ct === 'audio/x-aac' ||
    ct === 'audio/ogg' ||
    ct === 'application/ogg' ||
    ct === 'audio/wav' ||
    ct === 'audio/x-wav' ||
    ct === 'audio/flac' ||
    ct.startsWith('audio/')
  ) {
    return true;
  }
  return false;
}

export async function probePlayableAudioUrl(
  url: string,
  timeoutMs = 8000,
): Promise<AudioUrlProbeResult> {
  const checkedAt = new Date().toISOString();
  if (!isSafeQuranAudioUrl(url) || !url.startsWith('https://')) {
    return {
      url,
      redirected: false,
      ok: false,
      httpStatus: 0,
      contentType: 'invalid',
      byteLength: 0,
      magicFormat: 'invalid_url',
      browserPlayable: false,
      checkedAt,
      reason: 'URL is not a valid HTTPS audio URL',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Range: 'bytes=0-2047',
        Accept: 'audio/*,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    const finalUrl = res.url || url;
    const redirected = Boolean(res.redirected || (finalUrl && finalUrl !== url));
    const contentType = (res.headers.get('content-type') || 'unknown').trim();
    const contentLengthHeader = Number(res.headers.get('content-length') || '0');

    // Read up to 2048 bytes only (avoid downloading full Surah MP3 files)
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let collected = 0;
    if (reader) {
      while (collected < 2048) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const needed = Math.min(value.byteLength, 2048 - collected);
        chunks.push(value.subarray(0, needed));
        collected += needed;
      }
      await reader.cancel().catch(() => {});
    }

    const combined = new Uint8Array(collected);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const effectiveBytes = Math.max(collected, Number.isFinite(contentLengthHeader) ? contentLengthHeader : 0);
    const magic = detectAudioMagicFormat(combined);
    const mimeIsAudio = isAudioMimeType(contentType);
    const mimeIsOctet = contentType.split(';')[0].trim().toLowerCase() === 'application/octet-stream';
    const browserPlayable = isBrowserPlayableMimeAndFormat(contentType, magic.format);

    if (redirected && (!isSafeQuranAudioUrl(finalUrl) || !finalUrl.startsWith('https://'))) {
      return {
        url,
        finalUrl,
        redirected,
        ok: false,
        httpStatus: res.status,
        contentType,
        byteLength: effectiveBytes,
        magicFormat: magic.format,
        browserPlayable: false,
        checkedAt,
        reason: `Unsafe redirect target: ${finalUrl}`,
      };
    }

    if (!(res.status === 200 || res.status === 206)) {
      return {
        url,
        finalUrl,
        redirected,
        ok: false,
        httpStatus: res.status,
        contentType,
        byteLength: effectiveBytes,
        magicFormat: magic.format,
        browserPlayable: false,
        checkedAt,
        reason: `HTTP status ${res.status} is not 200/206`,
      };
    }

    if (collected === 0) {
      return {
        url,
        finalUrl,
        redirected,
        ok: false,
        httpStatus: res.status,
        contentType,
        byteLength: effectiveBytes,
        magicFormat: magic.format,
        browserPlayable: false,
        checkedAt,
        reason: 'Empty response body (0 bytes received)',
      };
    }

    if (!magic.valid) {
      return {
        url,
        finalUrl,
        redirected,
        ok: false,
        httpStatus: res.status,
        contentType,
        byteLength: effectiveBytes,
        magicFormat: magic.format,
        browserPlayable: false,
        checkedAt,
        reason: `Non-playable payload signature (${magic.format}) with content-type "${contentType}"`,
      };
    }

    if (!mimeIsAudio && !mimeIsOctet) {
      return {
        url,
        finalUrl,
        redirected,
        ok: false,
        httpStatus: res.status,
        contentType,
        byteLength: effectiveBytes,
        magicFormat: magic.format,
        browserPlayable: false,
        checkedAt,
        reason: `Unexpected non-audio content-type "${contentType}"`,
      };
    }

    return {
      url,
      finalUrl,
      redirected,
      ok: true,
      httpStatus: res.status,
      contentType,
      byteLength: effectiveBytes,
      magicFormat: magic.format,
      browserPlayable,
      checkedAt,
    };
  } catch (err) {
    return {
      url,
      redirected: false,
      ok: false,
      httpStatus: 0,
      contentType: 'network_error',
      byteLength: 0,
      magicFormat: 'network_error',
      browserPlayable: false,
      checkedAt,
      reason: err instanceof Error ? err.message.slice(0, 140) : 'Audio probe network failure',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIdx = 0;

  async function runWorker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () =>
    runWorker(),
  );
  await Promise.all(workers);
  return results;
}

export async function validateQuranAudioCoverage(params: {
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
  curatedChapterNumbers: number[];
  probeUrlFn?: (url: string) => Promise<AudioUrlProbeResult>;
}): Promise<QuranAudioValidationResult> {
  const { surahAudioUrls, ayahAudioUrls, curatedChapterNumbers, probeUrlFn = probePlayableAudioUrl } = params;

  const targetSurahs = QURAN_SURAHS.filter((s) => curatedChapterNumbers.includes(s.number));
  const expectedSurahIds = new Set(targetSurahs.map((s) => s.id));
  const expectedAyahKeys = new Set<string>();
  for (const s of targetSurahs) {
    for (const a of s.ayahs) {
      expectedAyahKeys.add(a.verseKey);
    }
  }

  const missingSurahAudioIds = Array.from(expectedSurahIds).filter(
    (id) => !surahAudioUrls[id],
  );
  const missingAyahKeys = Array.from(expectedAyahKeys).filter(
    (key) => !ayahAudioUrls[key],
  );
  const unexpectedSurahAudioIds = Object.keys(surahAudioUrls).filter(
    (id) => !expectedSurahIds.has(id),
  );
  const unexpectedAyahKeys = Object.keys(ayahAudioUrls).filter(
    (key) => !expectedAyahKeys.has(key),
  );

  // Detect duplicate URLs across mapped targets
  const urlToKeys = new Map<string, string[]>();
  for (const [id, url] of Object.entries(surahAudioUrls)) {
    const arr = urlToKeys.get(url) || [];
    arr.push(id);
    urlToKeys.set(url, arr);
  }
  for (const [key, url] of Object.entries(ayahAudioUrls)) {
    const arr = urlToKeys.get(url) || [];
    arr.push(key);
    urlToKeys.set(url, arr);
  }
  const duplicateUrls: DuplicateAudioMapping[] = [];
  for (const [url, keys] of urlToKeys.entries()) {
    if (keys.length > 1) {
      duplicateUrls.push({ url, keys });
    }
  }

  const uniqueUrls = Array.from(urlToKeys.keys());
  const probeResults = await runWithConcurrency(uniqueUrls, 8, probeUrlFn);
  const probeByUrl = new Map<string, AudioUrlProbeResult>();
  for (const p of probeResults) {
    probeByUrl.set(p.url, p);
  }

  const invalidResources: InvalidAudioResource[] = [];
  let playableSurahCount = 0;
  let playableAyahCount = 0;

  for (const [id, url] of Object.entries(surahAudioUrls)) {
    const p = probeByUrl.get(url);
    if (p?.ok) {
      playableSurahCount++;
    } else {
      invalidResources.push({
        targetKey: id,
        kind: 'surah',
        url,
        httpStatus: p?.httpStatus ?? 0,
        contentType: p?.contentType ?? 'unknown',
        byteLength: p?.byteLength ?? 0,
        reason: p?.reason || 'Failed audio validation',
      });
    }
  }

  for (const [key, url] of Object.entries(ayahAudioUrls)) {
    const p = probeByUrl.get(url);
    if (p?.ok) {
      playableAyahCount++;
    } else {
      invalidResources.push({
        targetKey: key,
        kind: 'ayah',
        url,
        httpStatus: p?.httpStatus ?? 0,
        contentType: p?.contentType ?? 'unknown',
        byteLength: p?.byteLength ?? 0,
        reason: p?.reason || 'Failed audio validation',
      });
    }
  }

  const playableValidUrlCount = probeResults.filter((p) => p.ok).length;
  const passed =
    missingSurahAudioIds.length === 0 &&
    missingAyahKeys.length === 0 &&
    unexpectedSurahAudioIds.length === 0 &&
    unexpectedAyahKeys.length === 0 &&
    duplicateUrls.length === 0 &&
    invalidResources.length === 0 &&
    playableSurahCount === expectedSurahIds.size &&
    playableAyahCount === expectedAyahKeys.size;

  return {
    status: passed ? 'passed' : 'failed',
    expectedSurahCount: expectedSurahIds.size,
    expectedAyahCount: expectedAyahKeys.size,
    returnedSurahCount: Object.keys(surahAudioUrls).length,
    returnedAyahCount: Object.keys(ayahAudioUrls).length,
    uniqueUrlsChecked: uniqueUrls.length,
    playableValidUrlCount,
    playableSurahCount,
    playableAyahCount,
    missingSurahAudioIds,
    missingAyahKeys,
    unexpectedSurahAudioIds,
    unexpectedAyahKeys,
    duplicateUrls,
    invalidResources,
  };
}

export function buildFinalValidationReport(params: {
  textCoverage: QuranTextValidationResult | null;
  audioCoverage: QuranAudioValidationResult | null;
  reciterVerification: QuranReciterValidationResult | null;
}): QuranFinalValidationReport {
  const { textCoverage, audioCoverage, reciterVerification } = params;

  const textStatus: QuranValidationWorkflowStatuses['textIntegrity'] = !textCoverage
    ? 'pending'
    : textCoverage.status;
  const audioStatus: QuranValidationWorkflowStatuses['audioIntegrity'] = !audioCoverage
    ? 'pending'
    : audioCoverage.status;
  const reciterStatus: QuranValidationWorkflowStatuses['reciterIdentity'] = !reciterVerification
    ? 'pending'
    : reciterVerification.status;

  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const pendingChecks: string[] = [];

  if (textCoverage) {
    if (textCoverage.status === 'passed') {
      passedChecks.push(
        `Quran text integrity verified: ${textCoverage.providerChaptersCount}/114 chapters from provider; ${textCoverage.curatedChaptersCount} curated Surahs (${textCoverage.curatedAyahsCount} ayahs) matched SHA-256 and Uthmani numbering with 0 missing/duplicate/unexpected entries.`,
      );
    } else {
      failedChecks.push(
        `Quran text integrity check failed: missingFrom114=${textCoverage.missingChaptersFrom114.length}, missingAyahs=${textCoverage.totalMissingAyahs}, duplicateAyahs=${textCoverage.totalDuplicateAyahs}, unexpectedAyahs=${textCoverage.totalUnexpectedAyahs}, uthmaniMismatches=${textCoverage.totalUthmaniMismatches}.`,
      );
    }
  } else {
    pendingChecks.push('Quran text coverage validation has not executed yet.');
  }

  if (audioCoverage) {
    if (audioCoverage.status === 'passed') {
      passedChecks.push(
        `Audio coverage & playability verified: ${audioCoverage.playableSurahCount}/${audioCoverage.expectedSurahCount} surahs and ${audioCoverage.playableAyahCount}/${audioCoverage.expectedAyahCount} ayahs (${audioCoverage.playableValidUrlCount}/${audioCoverage.uniqueUrlsChecked} unique HTTPS URLs passed HTTP status, audio MIME, and binary header signature checks; 0 duplicates).`,
      );
    } else {
      failedChecks.push(
        `Audio coverage check failed: missingSurahs=${audioCoverage.missingSurahAudioIds.length}, missingAyahs=${audioCoverage.missingAyahKeys.length}, duplicates=${audioCoverage.duplicateUrls.length}, invalidResources=${audioCoverage.invalidResources.length}.`,
      );
    }
  } else {
    pendingChecks.push('Audio coverage and playable binary header validation has not executed yet.');
  }

  if (reciterVerification) {
    if (reciterVerification.status === 'passed') {
      passedChecks.push(
        `Reciter ID ${reciterVerification.recitationId} confirmed from provider metadata: "${reciterVerification.matchedName || 'Mahmoud Khalil Al-Husary'}" (${reciterVerification.style || 'Murattal'} / ${reciterVerification.qirat || 'Hafs'}).`,
      );
    } else {
      failedChecks.push(
        `Reciter ID ${reciterVerification.recitationId} metadata verification failed.`,
      );
    }
  } else {
    pendingChecks.push('Reciter ID 6 metadata check has not executed yet.');
  }

  pendingChecks.push(
    'Reciter & Recitation Source Verification confirmation by an authenticated administrator with manage_lessons permission is required.',
  );
  pendingChecks.push(
    'Explicit administrator confirmation of Quran Foundation attribution, 7-day URL cache compliance, Privacy Policy readiness, and usage terms is pending (commercial/freemium integrated end-user app use is permitted without an additional paid license).',
  );
  pendingChecks.push(
    'verificationStatus remains pending_verification until an authorized administrator completes all confirmations.',
  );

  return {
    validationOnly: true,
    autoApproved: false,
    autoPublished: false,
    verificationStatus: 'pending_verification',
    workflowStatuses: {
      textIntegrity: textStatus,
      audioIntegrity: audioStatus,
      reciterIdentity: reciterStatus,
      sourceVerification: 'pending_admin_confirmation',
      licenseConfirmation: 'pending_admin_confirmation',
    },
    textCoverage,
    audioCoverage,
    reciterVerification,
    licenseAndAttribution: {
      sourceName: QURAN_FOUNDATION_LICENSE_INFO.sourceName,
      attributionText: QURAN_FOUNDATION_LICENSE_INFO.attributionText,
      usageRestrictions: [...QURAN_FOUNDATION_LICENSE_INFO.usageRestrictions],
      commercialUsePermittedForIntegratedApp: true,
      commercialUseClaimed: true,
      paidApiLicenseRequired: false,
      adminConfirmationRequired: true,
    },
    passedChecks,
    failedChecks,
    pendingChecks,
  };
}
