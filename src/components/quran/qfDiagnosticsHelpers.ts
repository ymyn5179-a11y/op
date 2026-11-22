export interface QfOAuthAttemptDiag {
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

export interface QfEndpointDiag {
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
  oauthPrimary: QfOAuthAttemptDiag | null;
  chapterApi: {
    requiredScope: 'content.quran.read';
    scopeApproved: boolean;
    chaptersList: QfEndpointDiag & { chaptersCount?: number };
    verseSample?: QfEndpointDiag & { versesCount?: number };
    ok: boolean;
  } | null;
  reciterCheck: {
    verifiedHusaryId6: boolean;
    chapterReciter?: QfEndpointDiag & {
      matchedName?: string;
      style?: string;
      qirat?: string;
    };
    verseRecitation?: QfEndpointDiag & {
      matchedName?: string;
      style?: string;
    };
  } | null;
  audioApi: {
    requiredScope: 'content.audio.read';
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
  chapterAudios: QfEndpointDiag[];
  verseAudios: QfEndpointDiag[];
}

export type QfFailureStage =
  | 'NONE'
  | 'NETWORK_ERROR'
  | 'BACKEND_ROUTING_OR_STARTUP_HTML'
  | 'CREDENTIALS_NOT_CONFIGURED'
  | 'HTTP_AUTH_OR_PERMISSION_REJECTED'
  | 'SERVER_ERROR_NO_DIAGNOSTICS'
  | 'NO_DIAGNOSTICS_RETURNED'
  | 'OAUTH_SCOPES_INVALID_OR_MISSING'
  | 'OAUTH_SCOPE_NOT_APPROVED'
  | 'OAUTH_TOKEN_FAILED'
  | 'CHAPTER_API_SCOPE_NOT_APPROVED'
  | 'CHAPTER_API_FAILED'
  | 'AUDIO_SCOPE_NOT_APPROVED'
  | 'RECITER_CATALOG_API_FAILED'
  | 'RECITER_VERIFICATION_MISMATCH'
  | 'CHAPTER_OR_VERSE_AUDIO_API_FAILED'
  | 'NO_VALID_HTTPS_URLS_EXTRACTED'
  | 'PARTIAL_AUDIO_API_ERROR';

export interface QfSafeResponseSummary {
  contentType: string;
  expressHeaderPresent: boolean;
  htmlTitle?: string;
  topLevelKeys: string[];
  safeTextSnippet?: string;
}

export interface QfSurahTextValidationDetail {
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

export interface QfTextValidationResult {
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
  surahDetails: QfSurahTextValidationDetail[];
  totalMissingAyahs: number;
  totalDuplicateAyahs: number;
  totalUnexpectedAyahs: number;
  totalUthmaniMismatches: number;
  allLocalSha256Matched: boolean;
}

export interface QfInvalidAudioResource {
  targetKey: string;
  kind: 'surah' | 'ayah';
  url: string;
  httpStatus: number;
  contentType: string;
  byteLength: number;
  reason: string;
}

export interface QfDuplicateAudioMapping {
  url: string;
  keys: string[];
}

export interface QfAudioValidationResult {
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
  duplicateUrls: QfDuplicateAudioMapping[];
  invalidResources: QfInvalidAudioResource[];
}

export interface QfReciterValidationResult {
  status: 'passed' | 'failed';
  recitationId: number;
  identityConfirmedFromMetadata: boolean;
  matchedName?: string;
  style?: string;
  qirat?: string;
  sourceVerificationStatus: 'pending_source_verification' | 'confirmed' | 'revoked';
  note: string;
}

export interface QfValidationWorkflowStatuses {
  textIntegrity: 'passed' | 'failed' | 'pending';
  audioIntegrity: 'passed' | 'failed' | 'pending';
  reciterIdentity: 'passed' | 'failed' | 'pending';
  sourceVerification: 'pending_admin_confirmation' | 'confirmed' | 'revoked';
  licenseConfirmation: 'pending_admin_confirmation';
}

export interface QfFinalValidationReport {
  validationOnly: true;
  autoApproved: false;
  autoPublished: false;
  verificationStatus: 'pending_verification';
  workflowStatuses: QfValidationWorkflowStatuses;
  textCoverage: QfTextValidationResult | null;
  audioCoverage: QfAudioValidationResult | null;
  reciterVerification: QfReciterValidationResult | null;
  licenseAndAttribution: {
    sourceName: string;
    attributionText: string;
    usageRestrictions: string[];
    commercialUsePermittedForIntegratedApp: boolean;
    commercialUseClaimed: boolean;
    paidApiLicenseRequired: boolean;
    adminConfirmationRequired: true;
  };
  passedChecks: string[];
  failedChecks: string[];
  pendingChecks: string[];
}

export interface QfPreviewState {
  requestPath: string;
  httpStatus: number;
  resOk: boolean;
  ok: boolean;
  configured: boolean;
  attributionRequired: boolean;
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
  basmalaIncludedBySurah?: Record<string, boolean>;
  validHttpsSurahCount: number;
  validHttpsAyahCount: number;
  validHttpsTotalCount: number;
  reciterId: number | null;
  verificationStatus: string;
  diagnostics: QfDiagnosticsPayload | null;
  validation: QfFinalValidationReport | null;
  failureStage: QfFailureStage;
  safeResponseSummary: QfSafeResponseSummary;
  notice?: string;
  error?: string;
}

const SENSITIVE_KEY_PATTERN = /secret|token|password|authorization|cookie|credential/i;

export function redactSensitiveText(input: string, maxLen = 280): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]')
    .replace(/"?(access_token|client_secret|refresh_token|authorization|secret)"?\s*[:=]\s*"?[^"\s,}]+/gi, '$1=[REDACTED]')
    .trim()
    .slice(0, maxLen);
}

function asRecord(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : null;
}

function extractUrlMap(val: unknown): Record<string, string> {
  const rec = asRecord(val);
  if (!rec) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === 'string' && v.trim()) {
      out[k] = v.trim();
    }
  }
  return out;
}

function countValidHttpsUrls(map: Record<string, string>): number {
  return Object.values(map).filter((u) => /^https:\/\/\S+/i.test(u)).length;
}

function extractDiagnosticsObject(root: Record<string, unknown> | null): QfDiagnosticsPayload | null {
  if (!root) return null;
  const candidates: Array<unknown> = [
    root.diagnostics,
    asRecord(root.data)?.diagnostics,
    asRecord(root.preview)?.diagnostics,
    asRecord(root.result)?.diagnostics,
  ];
  for (const candidate of candidates) {
    const rec = asRecord(candidate);
    if (
      rec &&
      (typeof rec.oauthEndpoint === 'string' ||
        typeof rec.contentApiBaseUrl === 'string' ||
        'oauthPrimary' in rec ||
        'reciterCheck' in rec)
    ) {
      return {
        environment: rec.environment === 'custom' ? 'custom' : 'production',
        oauthEndpoint: typeof rec.oauthEndpoint === 'string' ? rec.oauthEndpoint : '',
        contentApiBaseUrl: typeof rec.contentApiBaseUrl === 'string' ? rec.contentApiBaseUrl : '',
        primaryAuthMethod: 'client_secret_basic',
        requestedScopes: Array.isArray(rec.requestedScopes)
          ? rec.requestedScopes.filter((s): s is string => typeof s === 'string')
          : [],
        scopeConfigSource: rec.scopeConfigSource === 'env' ? 'env' : 'default',
        grantedScopes: Array.isArray(rec.grantedScopes)
          ? rec.grantedScopes.filter((s): s is string => typeof s === 'string')
          : [],
        oauthPrimary: (asRecord(rec.oauthPrimary) as QfOAuthAttemptDiag | null) ?? null,
        chapterApi: (asRecord(rec.chapterApi) as QfDiagnosticsPayload['chapterApi']) ?? null,
        reciterCheck:
          (asRecord(rec.reciterCheck) as QfDiagnosticsPayload['reciterCheck']) ?? null,
        audioApi: (asRecord(rec.audioApi) as QfDiagnosticsPayload['audioApi']) ?? null,
        chapterAudios: Array.isArray(rec.chapterAudios)
          ? (rec.chapterAudios as QfEndpointDiag[])
          : [],
        verseAudios: Array.isArray(rec.verseAudios) ? (rec.verseAudios as QfEndpointDiag[]) : [],
      };
    }
  }
  return null;
}

function extractValidationReport(root: Record<string, unknown> | null): QfFinalValidationReport | null {
  if (!root) return null;
  const candidates: Array<unknown> = [
    root.validation,
    asRecord(root.data)?.validation,
    asRecord(root.preview)?.validation,
    asRecord(root.result)?.validation,
  ];
  for (const candidate of candidates) {
    const rec = asRecord(candidate);
    if (rec && asRecord(rec.workflowStatuses) && asRecord(rec.licenseAndAttribution)) {
      const ws = asRecord(rec.workflowStatuses)!;
      const lic = asRecord(rec.licenseAndAttribution)!;
      return {
        validationOnly: true,
        autoApproved: false,
        autoPublished: false,
        verificationStatus: 'pending_verification',
        workflowStatuses: {
          textIntegrity:
            ws.textIntegrity === 'passed' || ws.textIntegrity === 'failed' ? ws.textIntegrity : 'pending',
          audioIntegrity:
            ws.audioIntegrity === 'passed' || ws.audioIntegrity === 'failed' ? ws.audioIntegrity : 'pending',
          reciterIdentity:
            ws.reciterIdentity === 'passed' || ws.reciterIdentity === 'failed' ? ws.reciterIdentity : 'pending',
          sourceVerification:
            ws.sourceVerification === 'confirmed' || ws.sourceVerification === 'revoked'
              ? ws.sourceVerification
              : 'pending_admin_confirmation',
          licenseConfirmation: 'pending_admin_confirmation',
        },
        textCoverage: (asRecord(rec.textCoverage) as QfTextValidationResult | null) ?? null,
        audioCoverage: (asRecord(rec.audioCoverage) as QfAudioValidationResult | null) ?? null,
        reciterVerification: (asRecord(rec.reciterVerification) as QfReciterValidationResult | null) ?? null,
        licenseAndAttribution: {
          sourceName:
            typeof lic.sourceName === 'string'
              ? lic.sourceName
              : 'Quran Foundation Content API v4 & Official Audio CDN',
          attributionText: typeof lic.attributionText === 'string' ? lic.attributionText : '',
          usageRestrictions: Array.isArray(lic.usageRestrictions)
            ? lic.usageRestrictions.filter((u): u is string => typeof u === 'string')
            : [],
          commercialUsePermittedForIntegratedApp:
            lic.commercialUsePermittedForIntegratedApp !== false,
          commercialUseClaimed: lic.commercialUseClaimed !== false,
          paidApiLicenseRequired: lic.paidApiLicenseRequired === true,
          adminConfirmationRequired: true,
        },
        passedChecks: Array.isArray(rec.passedChecks)
          ? rec.passedChecks.filter((s): s is string => typeof s === 'string')
          : [],
        failedChecks: Array.isArray(rec.failedChecks)
          ? rec.failedChecks.filter((s): s is string => typeof s === 'string')
          : [],
        pendingChecks: Array.isArray(rec.pendingChecks)
          ? rec.pendingChecks.filter((s): s is string => typeof s === 'string')
          : [],
      };
    }
  }
  return null;
}

export function determineQfFailureStage(params: {
  httpStatus: number;
  resOk: boolean;
  configured: boolean;
  error?: string;
  diagnostics: QfDiagnosticsPayload | null;
  validHttpsTotalCount: number;
}): QfFailureStage {
  const { httpStatus, resOk, configured, error, diagnostics, validHttpsTotalCount } = params;

  if (httpStatus === 0) return 'NETWORK_ERROR';
  if (!configured || error === 'QF_CREDENTIALS_NOT_CONFIGURED' || (httpStatus === 503 && !diagnostics)) {
    if (!diagnostics && httpStatus === 503 && error !== 'QF_CREDENTIALS_NOT_CONFIGURED') {
      return 'SERVER_ERROR_NO_DIAGNOSTICS';
    }
    if (!configured || error === 'QF_CREDENTIALS_NOT_CONFIGURED') {
      return 'CREDENTIALS_NOT_CONFIGURED';
    }
  }

  if (!diagnostics) {
    if (httpStatus === 401 || httpStatus === 403) return 'HTTP_AUTH_OR_PERMISSION_REJECTED';
    if (!resOk || error) return 'SERVER_ERROR_NO_DIAGNOSTICS';
    return validHttpsTotalCount > 0 ? 'NONE' : 'NO_DIAGNOSTICS_RETURNED';
  }

  if (!diagnostics.oauthPrimary && error && /scope|QF_OAUTH_SCOPES/i.test(error)) {
    return 'OAUTH_SCOPES_INVALID_OR_MISSING';
  }

  const oauthPrimary = diagnostics.oauthPrimary;
  if (oauthPrimary && (!oauthPrimary.ok || !oauthPrimary.tokenReceived)) {
    if (oauthPrimary.errorCode === 'invalid_scope' || /scope/i.test(oauthPrimary.errorDescription || '')) {
      return 'OAUTH_SCOPE_NOT_APPROVED';
    }
    return 'OAUTH_TOKEN_FAILED';
  }

  const chapterApi = diagnostics.chapterApi;
  if (chapterApi && !chapterApi.ok) {
    if (!chapterApi.scopeApproved || chapterApi.chaptersList?.httpStatus === 403 || chapterApi.verseSample?.httpStatus === 403) {
      return 'CHAPTER_API_SCOPE_NOT_APPROVED';
    }
    return 'CHAPTER_API_FAILED';
  }

  const audioApi = diagnostics.audioApi;
  if (audioApi && !audioApi.scopeApproved) {
    return 'AUDIO_SCOPE_NOT_APPROVED';
  }

  const reciterCheck = diagnostics.reciterCheck;
  if (reciterCheck) {
    const chFailed = reciterCheck.chapterReciter && !reciterCheck.chapterReciter.ok;
    const vsFailed = reciterCheck.verseRecitation && !reciterCheck.verseRecitation.ok;
    if (chFailed || vsFailed) {
      if (reciterCheck.chapterReciter?.httpStatus === 403 || reciterCheck.verseRecitation?.httpStatus === 403) {
        return 'AUDIO_SCOPE_NOT_APPROVED';
      }
      return 'RECITER_CATALOG_API_FAILED';
    }
    if (!reciterCheck.verifiedHusaryId6) {
      return 'RECITER_VERIFICATION_MISMATCH';
    }
  }

  const anyChapterFailed = diagnostics.chapterAudios.some((c) => !c.ok);
  const anyVerseFailed = diagnostics.verseAudios.some((v) => !v.ok);
  if ((anyChapterFailed || anyVerseFailed) && validHttpsTotalCount === 0) {
    return 'CHAPTER_OR_VERSE_AUDIO_API_FAILED';
  }

  if (validHttpsTotalCount === 0) {
    return 'NO_VALID_HTTPS_URLS_EXTRACTED';
  }

  if (anyChapterFailed || anyVerseFailed || error) {
    return 'PARTIAL_AUDIO_API_ERROR';
  }

  return 'NONE';
}

export function isHtmlPayload(contentType: string, rawText: string): boolean {
  return /text\/html/i.test(contentType) || /^\s*(<!doctype\s+html|<html\b)/i.test(rawText);
}

export function extractHtmlTitle(rawText: string): string | undefined {
  const m = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return undefined;
  return redactSensitiveText(m[1].replace(/\s+/g, ' '), 120) || undefined;
}

export function normalizeQfPreviewResponse(params: {
  requestPath?: string;
  httpStatus: number;
  resOk: boolean;
  contentType?: string;
  expressHeaderPresent?: boolean;
  rawText: string;
}): QfPreviewState {
  const {
    requestPath = 'POST /api/admin/quran/qf-sync-preview',
    httpStatus,
    resOk,
    contentType = 'unknown',
    expressHeaderPresent = false,
    rawText,
  } = params;

  if (isHtmlPayload(contentType, rawText)) {
    const htmlTitle = extractHtmlTitle(rawText);
    return {
      requestPath,
      httpStatus,
      resOk: false,
      ok: false,
      configured: false,
      attributionRequired: true,
      surahAudioUrls: {},
      ayahAudioUrls: {},
      validHttpsSurahCount: 0,
      validHttpsAyahCount: 0,
      validHttpsTotalCount: 0,
      reciterId: null,
      verificationStatus: 'pending_verification',
      diagnostics: null,
      validation: null,
      failureStage: 'BACKEND_ROUTING_OR_STARTUP_HTML',
      safeResponseSummary: {
        contentType,
        expressHeaderPresent,
        ...(htmlTitle ? { htmlTitle } : {}),
        topLevelKeys: [],
        safeTextSnippet: redactSensitiveText(rawText, 240),
      },
      error: 'Backend routing/startup error: HTML received instead of API JSON',
    };
  }

  let parsedRoot: Record<string, unknown> | null = null;
  try {
    const parsed = rawText ? JSON.parse(rawText) : null;
    parsedRoot = asRecord(parsed);
  } catch {
    parsedRoot = null;
  }

  const nestedData = asRecord(parsedRoot?.data) || asRecord(parsedRoot?.preview) || asRecord(parsedRoot?.result);
  const effectiveSource = parsedRoot || {};

  const surahAudioUrls = extractUrlMap(effectiveSource.surahAudioUrls ?? nestedData?.surahAudioUrls);
  const ayahAudioUrls = extractUrlMap(effectiveSource.ayahAudioUrls ?? nestedData?.ayahAudioUrls);
  const rawBasmalaMap = asRecord(
    effectiveSource.basmalaIncludedBySurah ?? nestedData?.basmalaIncludedBySurah,
  );
  const basmalaIncludedBySurah: Record<string, boolean> = {};
  if (rawBasmalaMap) {
    for (const [k, v] of Object.entries(rawBasmalaMap)) {
      if (typeof v === 'boolean') basmalaIncludedBySurah[k] = v;
    }
  }
  const validHttpsSurahCount = countValidHttpsUrls(surahAudioUrls);
  const validHttpsAyahCount = countValidHttpsUrls(ayahAudioUrls);
  const validHttpsTotalCount = validHttpsSurahCount + validHttpsAyahCount;

  const diagnostics = extractDiagnosticsObject(parsedRoot);
  const validation = extractValidationReport(parsedRoot);

  const rawError =
    (typeof effectiveSource.error === 'string' && effectiveSource.error.trim()) ||
    (typeof nestedData?.error === 'string' && nestedData.error.trim()) ||
    (typeof effectiveSource.message === 'string' && effectiveSource.message.trim()) ||
    (typeof effectiveSource.error_description === 'string' && effectiveSource.error_description.trim()) ||
    '';

  const configuredVal = effectiveSource.configured ?? nestedData?.configured;
  const configured =
    typeof configuredVal === 'boolean'
      ? configuredVal
      : httpStatus !== 503 && rawError !== 'QF_CREDENTIALS_NOT_CONFIGURED';

  const reciterObj = asRecord(effectiveSource.reciter ?? nestedData?.reciter);
  const reciterIdRaw = reciterObj?.quranFoundationChapterReciterId;
  const reciterId =
    typeof reciterIdRaw === 'number' && Number.isFinite(reciterIdRaw)
      ? reciterIdRaw
      : diagnostics?.reciterCheck
        ? 6
        : null;

  const finalError =
    redactSensitiveText(rawError, 320) ||
    (!resOk
      ? `Server returned HTTP ${httpStatus} without an explicit error message.`
      : validHttpsTotalCount === 0
        ? 'No valid HTTPS recitation audio URLs were returned.'
        : undefined);

  const failureStage = determineQfFailureStage({
    httpStatus,
    resOk,
    configured,
    error: finalError,
    diagnostics,
    validHttpsTotalCount,
  });

  const topLevelKeys = parsedRoot
    ? Object.keys(parsedRoot).filter((k) => !SENSITIVE_KEY_PATTERN.test(k)).slice(0, 20)
    : [];

  const safeResponseSummary: QfSafeResponseSummary = {
    contentType,
    expressHeaderPresent,
    topLevelKeys,
    ...(!parsedRoot && rawText.trim()
      ? { safeTextSnippet: redactSensitiveText(rawText, 240) }
      : {}),
  };

  const okFlag =
    Boolean(resOk) &&
    effectiveSource.ok !== false &&
    !rawError &&
    validHttpsTotalCount > 0;

  return {
    requestPath,
    httpStatus,
    resOk,
    ok: okFlag,
    configured,
    attributionRequired: Boolean(effectiveSource.attributionRequired ?? true),
    surahAudioUrls,
    ayahAudioUrls,
    basmalaIncludedBySurah,
    validHttpsSurahCount,
    validHttpsAyahCount,
    validHttpsTotalCount,
    reciterId,
    verificationStatus:
      typeof effectiveSource.verificationStatus === 'string'
        ? effectiveSource.verificationStatus
        : 'pending_verification',
    diagnostics,
    validation,
    failureStage,
    safeResponseSummary,
    notice:
      typeof effectiveSource.notice === 'string'
        ? redactSensitiveText(effectiveSource.notice, 260)
        : undefined,
    error: okFlag ? undefined : finalError,
  };
}

export function summarizeEndpointStatuses(items: QfEndpointDiag[]): string {
  if (!items || items.length === 0) return 'Not executed';
  const okCount = items.filter((i) => i.ok).length;
  const statusCounts = new Map<number, number>();
  let firstErr = '';
  for (const item of items) {
    statusCounts.set(item.httpStatus, (statusCounts.get(item.httpStatus) || 0) + 1);
    if (!item.ok && !firstErr) {
      firstErr = item.errorCode || item.errorMessage || '';
    }
  }
  const statusSummary = Array.from(statusCounts.entries())
    .map(([status, count]) => `HTTP ${status} (${count})`)
    .join(', ');
  return `${okCount}/${items.length} ok [${statusSummary}]${firstErr ? ` — ${redactSensitiveText(firstErr, 120)}` : ''}`;
}

export function formatSafeDiagnosticsCopyText(preview: QfPreviewState): string {
  const diag = preview.diagnostics;
  const lines: string[] = [
    '=== Quran Foundation Diagnostics ===',
    `Request route: ${preview.requestPath}`,
    `HTTP status: ${preview.httpStatus}`,
    `Response content-type: ${preview.safeResponseSummary.contentType}`,
    `Express API header present: ${preview.safeResponseSummary.expressHeaderPresent}`,
    `Failure stage: ${preview.failureStage}`,
    `Final error: ${preview.error || 'None'}`,
    `Valid HTTPS audio URLs found: ${preview.validHttpsTotalCount} (Surahs: ${preview.validHttpsSurahCount}, Ayahs: ${preview.validHttpsAyahCount})`,
    `Verification status: ${preview.verificationStatus}`,
  ];

  if (!diag) {
    lines.push('Diagnostics status: Diagnostics were not returned by the server');
    if (preview.safeResponseSummary.htmlTitle) {
      lines.push(`HTML title: ${preview.safeResponseSummary.htmlTitle}`);
    }
    lines.push(
      `Safe response keys: ${
        preview.safeResponseSummary.topLevelKeys.length > 0
          ? preview.safeResponseSummary.topLevelKeys.join(', ')
          : 'none (non-JSON or empty body)'
      }`,
    );
    if (preview.safeResponseSummary.safeTextSnippet) {
      lines.push(`Safe response snippet: ${preview.safeResponseSummary.safeTextSnippet}`);
    }
    return lines.join('\n');
  }

  const oauth = diag.oauthPrimary;
  const chApi = diag.chapterApi;
  const audApi = diag.audioApi;
  const rc = diag.reciterCheck;
  const requestedStr =
    diag.requestedScopes.length > 0
      ? diag.requestedScopes.join(' ')
      : oauth?.scopeRequested || 'None';
  const grantedStr =
    diag.grantedScopes.length > 0
      ? diag.grantedScopes.join(' ')
      : oauth?.grantedScope || (oauth?.tokenReceived ? 'Not returned by OAuth server' : 'None');

  lines.push(`Environment: ${diag.environment}`);
  lines.push(`API base URL: ${diag.contentApiBaseUrl || 'N/A'}`);
  lines.push(`OAuth endpoint: ${diag.oauthEndpoint || 'N/A'}`);
  lines.push(`Requested scopes (${diag.scopeConfigSource}): ${requestedStr}`);
  lines.push(`Actual granted scopes: ${grantedStr}`);
  lines.push(
    `OAuth status: ${
      oauth
        ? `HTTP ${oauth.httpStatus} · ok=${oauth.ok} · method=${oauth.authMethod} · tokenReceived=${oauth.tokenReceived}`
        : 'Not executed'
    }`,
  );
  lines.push(
    `OAuth error code / description: ${
      oauth?.errorCode || oauth?.errorDescription
        ? `${oauth.errorCode || 'N/A'} — ${oauth.errorDescription || 'N/A'}`
        : 'None'
    }`,
  );
  lines.push(
    `Chapter API status (${chApi?.requiredScope || 'content.quran.read'}): ${
      chApi
        ? `ok=${chApi.ok} · scopeApproved=${chApi.scopeApproved} · chapters HTTP ${chApi.chaptersList.httpStatus} (count=${chApi.chaptersList.chaptersCount ?? 0})${
            chApi.verseSample
              ? ` · verses HTTP ${chApi.verseSample.httpStatus} (count=${chApi.verseSample.versesCount ?? 0})`
              : ''
          }`
        : 'Not executed'
    }`,
  );
  lines.push(
    `Reciter ID & verification: ID=${preview.reciterId ?? 6} · verifiedHusaryId6=${
      rc ? String(rc.verifiedHusaryId6) : 'Not executed'
    }${
      rc?.chapterReciter
        ? ` · chapter_reciters HTTP ${rc.chapterReciter.httpStatus}${
            rc.chapterReciter.matchedName ? ` ("${rc.chapterReciter.matchedName}")` : ''
          }`
        : ''
    }${
      rc?.verseRecitation
        ? ` · recitations HTTP ${rc.verseRecitation.httpStatus}${
            rc.verseRecitation.matchedName ? ` ("${rc.verseRecitation.matchedName}")` : ''
          }`
        : ''
    }`,
  );
  lines.push(
    `Audio API status (${audApi?.requiredScope || 'content.audio.read'}): ${
      audApi
        ? `ok=${audApi.ok} · scopeApproved=${audApi.scopeApproved} · validHttps=${audApi.validHttpsTotalCount} (Surahs: ${audApi.validHttpsSurahCount}, Ayahs: ${audApi.validHttpsAyahCount})`
        : 'Not executed'
    }`,
  );
  lines.push(`Chapter audio request status: ${summarizeEndpointStatuses(diag.chapterAudios)}`);
  lines.push(`Verse audio request status: ${summarizeEndpointStatuses(diag.verseAudios)}`);

  const val = preview.validation;
  if (val) {
    lines.push('');
    lines.push('=== Final Validation Stage (Validation-Only / Auto-Approve Disabled) ===');
    lines.push(
      `Workflow statuses: textIntegrity=${val.workflowStatuses.textIntegrity} · audioIntegrity=${val.workflowStatuses.audioIntegrity} · reciterIdentity=${val.workflowStatuses.reciterIdentity} · sourceVerification=${val.workflowStatuses.sourceVerification} · licenseConfirmation=${val.workflowStatuses.licenseConfirmation}`,
    );
    if (val.textCoverage) {
      lines.push(
        `Text coverage: providerChapters=${val.textCoverage.providerChaptersCount}/${val.textCoverage.authoritativeTotalChapters} · curatedSurahs=${val.textCoverage.curatedChaptersCount} · curatedAyahs=${val.textCoverage.curatedAyahsCount} (out of ${val.textCoverage.authoritativeTotalAyahs}) · missingAyahs=${val.textCoverage.totalMissingAyahs} · duplicateAyahs=${val.textCoverage.totalDuplicateAyahs} · unexpectedAyahs=${val.textCoverage.totalUnexpectedAyahs} · uthmaniMismatches=${val.textCoverage.totalUthmaniMismatches} · sha256Matched=${val.textCoverage.allLocalSha256Matched}`,
      );
      lines.push(`Scope note: ${val.textCoverage.scopeExplanation}`);
    }
    if (val.audioCoverage) {
      lines.push(
        `Audio playability: playableUrls=${val.audioCoverage.playableValidUrlCount}/${val.audioCoverage.uniqueUrlsChecked} · playableSurahs=${val.audioCoverage.playableSurahCount}/${val.audioCoverage.expectedSurahCount} · playableAyahs=${val.audioCoverage.playableAyahCount}/${val.audioCoverage.expectedAyahCount} · duplicates=${val.audioCoverage.duplicateUrls.length} · invalid=${val.audioCoverage.invalidResources.length}`,
      );
    }
    if (val.reciterVerification) {
      lines.push(
        `Reciter verification: ID=${val.reciterVerification.recitationId} · identityConfirmed=${val.reciterVerification.identityConfirmedFromMetadata} · sourceVerificationStatus=${val.reciterVerification.sourceVerificationStatus}`,
      );
    }
    lines.push(
      `License & commercial notice: commercialUsePermittedForIntegratedApp=${val.licenseAndAttribution.commercialUsePermittedForIntegratedApp} · paidApiLicenseRequired=${val.licenseAndAttribution.paidApiLicenseRequired} · adminConfirmationRequired=${val.licenseAndAttribution.adminConfirmationRequired}`,
    );
    lines.push(`Passed checks (${val.passedChecks.length}): ${val.passedChecks.join(' | ') || 'None'}`);
    lines.push(`Failed checks (${val.failedChecks.length}): ${val.failedChecks.join(' | ') || 'None'}`);
    lines.push(`Pending checks (${val.pendingChecks.length}): ${val.pendingChecks.join(' | ') || 'None'}`);
  }

  return lines.join('\n');
}
