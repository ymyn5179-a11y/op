import crypto from 'crypto';
import type express from 'express';
import {
  DEFAULT_ALLOWED_SURAH_IDS,
  QURAN_MANNERS,
  QURAN_RECITERS,
  QURAN_STORIES,
  QURAN_SURAHS,
  getQuranMannerById,
  getQuranReciterById,
  getQuranStoryById,
  getQuranSurahById,
  mergeStoryWithAdminOverride,
} from '../src/data/quranCatalog';
import {
  buildMonthlySnapshotForChild,
  calculateStreakDays,
  getCurrentMonthKey,
  getTodayDayKey,
} from '../src/engine/monthlyReportEngine';
import { getInternalAgeBand } from '../src/utils/ageAdaptation';
import {
  clampQuranDailyMinutes,
  clampQuranRepeatCount,
  sanitizeQuranNote,
  sanitizeShortText,
} from '../src/utils/validation';
import type {
  ActivityTimelineEvent,
  QuranActivityEvent,
  QuranAdminConfirmations,
  QuranAudioProbeDiagnostics,
  QuranChildSettings,
  QuranConfirmationItemRecord,
  QuranContentVerificationRecord,
  QuranMannerProgress,
  QuranMemorizationStatus,
  QuranPhraseAssetStatus,
  QuranPhraseAudioAssetConfig,
  QuranReciterSpec,
  QuranReleaseReadinessSummary,
  QuranSourceVerificationChecklistItem,
  QuranSourceVerificationRecord,
  QuranStoryAdminOverride,
  QuranStoryProgress,
  QuranStoryProgressDetails,
  QuranStorySceneOverride,
  QuranStorySfxCue,
  QuranStorySpec,
  QuranSurahProgress,
  QuranVerificationStatus,
} from '../src/types/nonoland';
import { recordAuditEvent } from './auditLog';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import {
  awardGardenMilestoneIdempotent,
  canUserAccessChild,
  ensureChildFamilyAndGarden,
  ensureFamilyCollections,
  isChildOrStudentRole,
  recordFamilyEvent,
  requireParentGate,
} from './familyHelpers';
import { isQuranSchemaReady, runWithPgDbLock } from './pgStore';
import {
  HUSARY_MURATTAL_SPEC,
  MAX_QF_SERVER_CACHE_DAYS,
  MAX_QF_SERVER_CACHE_MS,
  TESTING_AUDIO_CACHE_TTL_MS,
  fetchAuthorizedQfReciter6BasmalaUrl,
  fetchHusaryRecitationMetadata,
  fetchHusaryTestingAudioUrls,
  fetchPublicQuranFoundationReciter6Data,
  getCachedHusaryBasmalaCandidateUrl,
  isAllowedQuranFoundationAudioHost,
  isQuranFoundationConfigured,
  normalizeQuranAudioUrl,
  resolveConfiguredQuranFoundationScopes,
} from './quranAudioProvider';
import {
  QURAN_FOUNDATION_LICENSE_INFO,
  probePlayableAudioUrl,
  validateQuranAudioCoverage,
  verifyLocalCatalogSha256Integrity,
} from './quranValidation';
import {
  buildStoryAudioManifest,
  generateSceneNarrationAudio,
  getExpectedStoryAudioUrl,
  localStoryAudioExistsSync,
  validateStoryAudioAsset,
} from './storyAudioService';
import { getClientIp } from './security';

interface QuranRoutesDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
  assertChildAccess: (
    req: AuthenticatedRequest,
    res: express.Response,
    childId: string,
  ) => StoredChildRecord | null | 'untracked-sample';
  requireAdminPermission: (permission: string) => express.RequestHandler;
}

const VALID_SURAH_ID_SET = new Set(QURAN_SURAHS.map((s) => s.id));
const VALID_RECITER_ID_SET = new Set(QURAN_RECITERS.map((r) => r.id));

function normalizeReciterIdInput(rawId: unknown): string {
  const clean = typeof rawId === 'string' ? rawId.trim() : '';
  if (clean === 'adult-husary-murattal') return 'adult-husary-muallim';
  return clean;
}

function recordQuranActiveDay(
  child: StoredChildRecord,
  event: Omit<ActivityTimelineEvent, 'id' | 'timestamp'>,
) {
  const today = getTodayDayKey();
  const monthKey = getCurrentMonthKey();

  child.monthlySnapshots = child.monthlySnapshots || {};
  if (!child.monthlySnapshots[monthKey]) {
    child.monthlySnapshots[monthKey] = buildMonthlySnapshotForChild(child, monthKey);
  }

  const days = new Set(child.activeDaysHistory || []);
  days.add(today);
  child.activeDaysHistory = Array.from(days).sort().slice(-90);
  child.learningStreakDays = calculateStreakDays(child.activeDaysHistory);

  child.activityTimeline = [
    {
      id: `evt_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...event,
    },
    ...(child.activityTimeline || []),
  ].slice(0, 120);
}

export function getEffectiveQuranChildSettings(
  db: ServerDb,
  childId: string,
): QuranChildSettings {
  ensureFamilyCollections(db);
  const existing = db.quranChildSettings![childId];
  const nowIso = new Date().toISOString();
  if (existing) {
    const validAllowed = (existing.allowedSurahIds || []).filter((id) => VALID_SURAH_ID_SET.has(id));
    const validOrder = (existing.surahOrder || []).filter((id) => VALID_SURAH_ID_SET.has(id));
    for (const id of DEFAULT_ALLOWED_SURAH_IDS) {
      if (!validOrder.includes(id)) validOrder.push(id);
    }
    return {
      ...existing,
      allowedSurahIds: validAllowed.length > 0 ? validAllowed : [...DEFAULT_ALLOWED_SURAH_IDS],
      surahOrder: validOrder,
      preferredReciterId: VALID_RECITER_ID_SET.has(existing.preferredReciterId)
        ? existing.preferredReciterId
        : 'adult-husary-muallim',
      repeatCount: clampQuranRepeatCount(existing.repeatCount, 2),
      dailyMaxMinutes: clampQuranDailyMinutes(existing.dailyMaxMinutes, 15),
    };
  }
  return {
    childId,
    enabled: true,
    allowedSurahIds: [...DEFAULT_ALLOWED_SURAH_IDS],
    surahOrder: [...DEFAULT_ALLOWED_SURAH_IDS],
    preferredReciterId: 'adult-husary-muallim',
    preferChildReciterFallback: true,
    repeatCount: 2,
    listenOnlyMode: false,
    dailyMaxMinutes: 15,
    gentleReminderEnabled: false,
    updatedAt: nowIso,
  };
}

const PHRASE_ASSET_DEFAULTS: Record<
  'basmala' | 'closing',
  {
    contentKey: 'phrase:basmala' | 'phrase:closing';
    phraseAr: string;
    labelEn: string;
    isQuranVerse: boolean;
    defaultSourceName: string;
    defaultLicense: string;
    envUrl?: string;
  }
> = {
  basmala: {
    contentKey: 'phrase:basmala',
    phraseAr: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    labelEn: 'Opening Basmala (Pre-Surah)',
    isQuranVerse: true,
    defaultSourceName: 'Quran Foundation Recitation ID 6 (Al-Husary Murattal) — 1:1',
    defaultLicense: 'Pending administrator confirmation of playable recording, Quran Foundation source, and usage rights.',
    envUrl: process.env.QF_BASMALA_AUDIO_URL,
  },
  closing: {
    contentKey: 'phrase:closing',
    phraseAr: 'صَدَقَ اللَّهُ الْعَظِيمُ',
    labelEn: 'Closing Phrase — Sadaq Allah Al-Azeem (Non-Verse Post-Surah)',
    isQuranVerse: false,
    defaultSourceName: 'Not Configured (Optional — Disabled & Non-Blocking)',
    defaultLicense: 'No closing phrase recording configured or licensed yet. Kept disabled and non-blocking.',
    envUrl: process.env.QF_CLOSING_PHRASE_AUDIO_URL,
  },
};

export function getPhraseAssetConfigs(db: ServerDb): {
  basmala: QuranPhraseAudioAssetConfig;
  closing: QuranPhraseAudioAssetConfig;
} {
  ensureFamilyCollections(db);
  const overrides = db.quranContentVerifications || {};

  const resolveOne = (phraseKey: 'basmala' | 'closing'): QuranPhraseAudioAssetConfig => {
    const def = PHRASE_ASSET_DEFAULTS[phraseKey];
    const record = overrides[def.contentKey];
    const metaJson = (record?.audioUrlsJson || {}) as Record<string, string>;
    const rawUrl = metaJson.url ?? def.envUrl ?? '';
    const safeUrl = normalizeQuranAudioUrl(rawUrl);

    const licenseConfirmed =
      record?.licenseTermsConfirmed === true || metaJson.licenseConfirmed === 'true';
    const humanListeningApproved =
      record?.tajweedListeningConfirmed === true || metaJson.humanListeningApproved === 'true';
    const verificationStatus: QuranVerificationStatus = record?.verificationStatus || 'pending_verification';
    const licenseOrPermission = record?.licenseOrPermission || def.defaultLicense;
    const reviewedBy = record?.tajweedReviewedBy || undefined;
    const probeOk =
      phraseKey !== 'basmala' ||
      (record?.basmalaCandidateProbe?.ok === true &&
        record?.basmalaCandidateProbe?.browserPlayable === true &&
        record?.basmalaCandidateProbe?.url === safeUrl);

    let status: QuranPhraseAssetStatus = 'not_configured';
    if (safeUrl && verificationStatus !== 'unavailable') {
      const fullyApproved =
        verificationStatus === 'verified' &&
        licenseConfirmed &&
        humanListeningApproved &&
        probeOk &&
        Boolean(licenseOrPermission.trim()) &&
        Boolean(reviewedBy?.trim());
      status = fullyApproved ? 'approved' : 'configured_pending_approval';
    }

    return {
      phraseKey,
      phraseAr: def.phraseAr,
      labelEn: def.labelEn,
      isQuranVerse: def.isQuranVerse,
      audioUrl: verificationStatus === 'unavailable' ? null : safeUrl,
      status,
      verificationStatus:
        verificationStatus === 'unavailable'
          ? 'unavailable'
          : status === 'approved'
            ? 'verified'
            : safeUrl
              ? 'pending_verification'
              : 'unavailable',
      sourceName: record?.sourceName || def.defaultSourceName,
      licenseOrPermission,
      licenseConfirmed,
      humanListeningApproved,
      reviewedBy,
      reviewedAt: record?.tajweedReviewedAt || undefined,
      notes: record?.notes || undefined,
    };
  };

  return {
    basmala: resolveOne('basmala'),
    closing: resolveOne('closing'),
  };
}

export const ADMIN_CONFIRMATION_POLICY_VERSIONS = {
  qfDeveloperTermsAndCommercialUse: 'QF-Terms-2026-11-20',
  qfAttributionAndReciterCredit: 'Quran.Foundation-Credit-v4',
  sevenDayCachePolicy: 'QF-7-Day-Cache-Policy',
  privacyAndTermsReadiness: 'NonoLand-Policy-2026.04',
  basmalaAudioApproval: 'QF-Reciter-6-1:1',
} as const;

export const SOURCE_VERIFICATION_EVIDENCE_VERSION = 'QF-Reciter-6-Source-v1';
export const SOURCE_VERIFICATION_STATUS_TEXT =
  'Reciter and recitation source verified against Quran Foundation provider metadata and technical audio integrity checks.';

export function createEmptyAdminConfirmations(): QuranAdminConfirmations {
  return {
    qfDeveloperTermsAndCommercialUse: { confirmed: false },
    qfAttributionAndReciterCredit: { confirmed: false },
    sevenDayCachePolicy: { confirmed: false },
    privacyAndTermsReadiness: { confirmed: false },
    basmalaAudioApproval: { confirmed: false },
    qfAttributionAndTerms: { confirmed: false },
  };
}

export function normalizeConfirmationEntry(
  checked: boolean,
  prev: QuranConfirmationItemRecord | undefined,
  actorName: string,
  nowIso: string,
  actorUserId?: string,
  policyVersion?: string,
): QuranConfirmationItemRecord {
  if (!checked) {
    return { confirmed: false };
  }
  if (prev?.confirmed && prev.confirmedBy && prev.confirmedAt) {
    return {
      confirmed: true,
      confirmedBy: prev.confirmedBy,
      ...(prev.confirmedByUserId || actorUserId
        ? { confirmedByUserId: prev.confirmedByUserId || actorUserId }
        : {}),
      confirmedAt: prev.confirmedAt,
      ...(policyVersion || prev.policyVersion
        ? { policyVersion: policyVersion || prev.policyVersion }
        : {}),
    };
  }
  return {
    confirmed: true,
    confirmedBy: actorName,
    ...(actorUserId ? { confirmedByUserId: actorUserId } : {}),
    confirmedAt: nowIso,
    ...(policyVersion ? { policyVersion } : {}),
  };
}

export function computeAudioUrlSetHash(
  surahAudioUrls: Record<string, string>,
  ayahAudioUrls: Record<string, string>,
): string {
  const payload = {
    surah: Object.keys(surahAudioUrls)
      .sort()
      .map((k) => [k, surahAudioUrls[k]]),
    ayah: Object.keys(ayahAudioUrls)
      .sort()
      .map((k) => [k, ayahAudioUrls[k]]),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export function extractValidReciterUrlMaps(record?: QuranContentVerificationRecord): {
  surahAudioUrls: Record<string, string>;
  ayahAudioUrls: Record<string, string>;
} {
  const surahAudioUrls: Record<string, string> = {};
  for (const s of QURAN_SURAHS) {
    const normalized = normalizeQuranAudioUrl(record?.audioUrlsJson?.[s.id]);
    if (normalized && isAllowedQuranFoundationAudioHost(normalized)) {
      surahAudioUrls[s.id] = normalized;
    }
  }
  const ayahAudioUrls: Record<string, string> = {};
  for (const s of QURAN_SURAHS) {
    for (const a of s.ayahs) {
      const normalized = normalizeQuranAudioUrl(record?.ayahAudioUrlsJson?.[a.verseKey]);
      if (normalized && isAllowedQuranFoundationAudioHost(normalized)) {
        ayahAudioUrls[a.verseKey] = normalized;
      }
    }
  }
  return { surahAudioUrls, ayahAudioUrls };
}

export function buildSourceVerificationState(db: ServerDb): {
  checklist: QuranSourceVerificationChecklistItem[];
  checklistPassed: boolean;
  checklistPassedCount: number;
  checklistTotalCount: number;
  sourceVerification: QuranSourceVerificationRecord;
  textIntegrityVerified: boolean;
  audioUrlsComplete: boolean;
  audioTechnicalIntegrityVerified: boolean;
  surahAudioUrlsCount: number;
  ayahAudioUrlsCount: number;
} {
  ensureFamilyCollections(db);
  const record = db.quranContentVerifications?.[HUSARY_MURATTAL_SPEC.reciterId];
  const savedSv = record?.sourceVerification;
  const { surahAudioUrls, ayahAudioUrls } = extractValidReciterUrlMaps(record);
  const surahAudioUrlsCount = Object.keys(surahAudioUrls).length;
  const ayahAudioUrlsCount = Object.keys(ayahAudioUrls).length;
  const totalCuratedAyahs = QURAN_SURAHS.reduce((sum, s) => sum + s.ayahCount, 0);
  const urlSetHash = computeAudioUrlSetHash(surahAudioUrls, ayahAudioUrls);

  const localTextCheck = verifyLocalCatalogSha256Integrity();
  const providerVerified = Boolean(
    savedSv?.providerMetadataVerified === true && savedSv.provider === 'Quran Foundation',
  );
  const reciterIdVerified = providerVerified && Number(savedSv?.reciterId) === 6;
  const reciterIdentityVerified =
    providerVerified && /husar[yi]/i.test(savedSv?.reciterIdentity || '');
  const styleVerified =
    providerVerified && /murattal/i.test(savedSv?.recitationStyle || '');
  const riwayahVerified =
    providerVerified && /hafs/i.test(savedSv?.riwayah || '');

  const audioUrlsComplete =
    surahAudioUrlsCount === QURAN_SURAHS.length && ayahAudioUrlsCount === totalCuratedAyahs;

  const probeMatchesCurrentUrls =
    Boolean(savedSv?.urlSetHash) && savedSv?.urlSetHash === urlSetHash;
  const probePassedCount = Number(savedSv?.audioProbePassedCount ?? 0);
  const probeTotalCount = Number(savedSv?.audioProbeTotalCount ?? 0);
  const probeInvalidCount = Number(savedSv?.audioProbeInvalidCount ?? 0);
  const probeDuplicateCount = Number(savedSv?.audioProbeDuplicateCount ?? 0);
  const audioTechnicalIntegrityVerified =
    audioUrlsComplete &&
    probeMatchesCurrentUrls &&
    probeTotalCount === QURAN_SURAHS.length + totalCuratedAyahs &&
    probePassedCount === probeTotalCount &&
    probeInvalidCount === 0 &&
    probeDuplicateCount === 0;

  const evaluatedAt = savedSv?.evaluatedAt;

  const checklist: QuranSourceVerificationChecklistItem[] = [
    {
      key: 'provider',
      order: 1,
      labelEn: 'Provider',
      labelAr: 'المزود',
      expectedEn: 'Quran Foundation',
      expectedAr: 'Quran Foundation',
      status: providerVerified ? 'passed' : savedSv?.evaluatedAt ? 'failed' : 'pending',
      evidenceEn: providerVerified
        ? 'Verified against Quran Foundation Content API v4 metadata.'
        : 'Run technical & provider evaluation to confirm Quran Foundation provider metadata.',
      evidenceAr: providerVerified
        ? 'تم التحقق عبر بيانات مزود Quran Foundation Content API v4.'
        : 'شغّل الفحص التقني للتحقق من بيانات مزود Quran Foundation.',
      checkedAt: evaluatedAt,
    },
    {
      key: 'reciterId',
      order: 2,
      labelEn: 'Reciter ID',
      labelAr: 'معرف القارئ',
      expectedEn: '6',
      expectedAr: '6',
      status: reciterIdVerified ? 'passed' : savedSv?.evaluatedAt ? 'failed' : 'pending',
      evidenceEn: reciterIdVerified
        ? 'Provider chapter_reciters[6] & recitations[6] matched Reciter ID 6.'
        : 'Reciter ID 6 provider metadata check has not completed.',
      evidenceAr: reciterIdVerified
        ? 'طابق سجل chapter_reciters[6] و recitations[6] معرف القارئ 6.'
        : 'لم يكتمل فحص معرف القارئ 6 لدى المزود بعد.',
      checkedAt: evaluatedAt,
    },
    {
      key: 'reciterIdentity',
      order: 3,
      labelEn: 'Reciter Identity',
      labelAr: 'هوية القارئ',
      expectedEn: 'Sheikh Mahmoud Khalil Al-Husary',
      expectedAr: 'الشيخ محمود خليل الحصري',
      status: reciterIdentityVerified ? 'passed' : savedSv?.evaluatedAt ? 'failed' : 'pending',
      evidenceEn: reciterIdentityVerified
        ? `Provider metadata confirmed: ${savedSv?.reciterIdentity || 'Sheikh Mahmoud Khalil Al-Husary'}.`
        : 'Reciter identity metadata has not been verified from Quran Foundation.',
      evidenceAr: reciterIdentityVerified
        ? 'تأكدت هوية الشيخ محمود خليل الحصري من بيانات المزود.'
        : 'لم يتم التحقق من هوية القارئ من بيانات المزود بعد.',
      checkedAt: evaluatedAt,
    },
    {
      key: 'recitationStyle',
      order: 4,
      labelEn: 'Recitation Style',
      labelAr: 'نمط التلاوة',
      expectedEn: 'Murattal',
      expectedAr: 'مرتل (Murattal)',
      status: styleVerified ? 'passed' : savedSv?.evaluatedAt ? 'failed' : 'pending',
      evidenceEn: styleVerified
        ? `Provider style confirmed: ${savedSv?.recitationStyle || 'Murattal'}.`
        : 'Recitation style metadata (Murattal) not yet verified.',
      evidenceAr: styleVerified
        ? 'تأكد نمط التلاوة (Murattal) من بيانات المزود.'
        : 'لم يتم التحقق من نمط التلاوة (Murattal) بعد.',
      checkedAt: evaluatedAt,
    },
    {
      key: 'riwayah',
      order: 5,
      labelEn: 'Riwayah',
      labelAr: 'الرواية',
      expectedEn: "Hafs 'an Asim",
      expectedAr: 'حفص عن عاصم',
      status: riwayahVerified ? 'passed' : savedSv?.evaluatedAt ? 'failed' : 'pending',
      evidenceEn: riwayahVerified
        ? `Provider Qirat/Riwayah confirmed: ${savedSv?.riwayah || "Hafs 'an Asim"}.`
        : "Riwayah metadata (Hafs 'an Asim) not yet verified.",
      evidenceAr: riwayahVerified
        ? 'تأكدت رواية حفص عن عاصم من بيانات المزود.'
        : 'لم يتم التحقق من الرواية (حفص عن عاصم) بعد.',
      checkedAt: evaluatedAt,
    },
    {
      key: 'curatedTextIntegrity',
      order: 6,
      labelEn: 'Curated Quran Text Integrity (SHA-256)',
      labelAr: 'سلامة النص القرآني العثماني (SHA-256)',
      expectedEn: '9 Surahs · 40 Ayahs match Uthmani SHA-256 hashes',
      expectedAr: '٩ سور · ٤٠ آية تطابق بصمات SHA-256 العثمانية',
      status: localTextCheck.allMatched ? 'passed' : 'failed',
      evidenceEn: localTextCheck.allMatched
        ? `${localTextCheck.verifiedSurahsCount}/${localTextCheck.totalSurahsCount} Surahs and ${localTextCheck.verifiedAyahsCount}/${localTextCheck.totalAyahsCount} Ayahs matched stored SHA-256 integrity hashes.`
        : `SHA-256 mismatch detected (${localTextCheck.verifiedSurahsCount}/${localTextCheck.totalSurahsCount} Surahs matched).`,
      evidenceAr: localTextCheck.allMatched
        ? `طابقت ${localTextCheck.verifiedSurahsCount}/${localTextCheck.totalSurahsCount} سور و${localTextCheck.verifiedAyahsCount}/${localTextCheck.totalAyahsCount} آية بصمات SHA-256 المحفوظة.`
        : 'يوجد عدم تطابق في بصمات SHA-256 للنص القرآني.',
      checkedAt: localTextCheck.checkedAt,
    },
    {
      key: 'audioCoverage',
      order: 7,
      labelEn: 'Audio Coverage (9 Surahs · 40 Ayahs)',
      labelAr: 'اكتمال ملفات التلاوة (٩ سور · ٤٠ آية)',
      expectedEn: '9 Surah recordings & 40 Ayah recordings present',
      expectedAr: '٩ تسجيلات سور و٤٠ تسجيل آية متوفرة',
      status: audioUrlsComplete ? 'passed' : 'pending',
      evidenceEn: `${surahAudioUrlsCount}/${QURAN_SURAHS.length} Surah URLs and ${ayahAudioUrlsCount}/${totalCuratedAyahs} Ayah URLs stored on QF allowlisted HTTPS hosts.`,
      evidenceAr: `${surahAudioUrlsCount}/${QURAN_SURAHS.length} رابط سورة و${ayahAudioUrlsCount}/${totalCuratedAyahs} رابط آية مسجلة على نطاقات QF المسموحة.`,
      checkedAt: evaluatedAt,
    },
    {
      key: 'audioTechnicalValidation',
      order: 8,
      labelEn: 'Audio Technical Validation (49 URLs)',
      labelAr: 'الفحص التقني للصوت (٤٩ رابطاً)',
      expectedEn: 'All 49 URLs pass HTTPS, host, HTTP 200/206, MIME & signature checks',
      expectedAr: 'اجتياز ٤٩ رابطاً لفحوصات HTTPS والمضيف وحالة HTTP ونوع MIME والتوقيع الصوتي',
      status: audioTechnicalIntegrityVerified
        ? 'passed'
        : probeMatchesCurrentUrls && savedSv?.evaluatedAt && probeInvalidCount > 0
          ? 'failed'
          : 'pending',
      evidenceEn: audioTechnicalIntegrityVerified
        ? `49/49 URLs (${surahAudioUrlsCount} Surahs + ${ayahAudioUrlsCount} Ayahs) passed live HTTP, MIME type, and audio signature probes (0 invalid, 0 duplicates).`
        : probeMatchesCurrentUrls && savedSv?.evaluatedAt
          ? `${probePassedCount}/${probeTotalCount} URLs passed (invalid=${probeInvalidCount}, duplicates=${probeDuplicateCount})${savedSv.audioProbeError ? `: ${savedSv.audioProbeError}` : ''}.`
          : 'Live 49-URL HTTP, MIME type, and audio binary signature probe has not passed for the current URL set.',
      evidenceAr: audioTechnicalIntegrityVerified
        ? 'اجتاز ٤٩/٤٩ رابطاً فحص HTTP ونوع MIME والتوقيع الصوتي الفعلي دون أخطاء.'
        : 'لم يكتمل الفحص التقني المباشر لروابط الصوت الحالية (٤٩ رابطاً).',
      checkedAt: evaluatedAt,
    },
  ];

  const checklistPassedCount = checklist.filter((item) => item.status === 'passed').length;
  const checklistTotalCount = checklist.length;
  const checklistPassed = checklistPassedCount === checklistTotalCount;

  const isRevoked = savedSv?.status === 'revoked';
  const isConfirmed =
    Boolean(savedSv?.confirmed) &&
    savedSv?.status === 'confirmed' &&
    Boolean(savedSv?.confirmedByUserId) &&
    Boolean(savedSv?.confirmedAt) &&
    checklistPassed;

  const status: 'confirmed' | 'pending' | 'revoked' = isConfirmed
    ? 'confirmed'
    : isRevoked
      ? 'revoked'
      : 'pending';

  const statusMessage =
    status === 'confirmed'
      ? SOURCE_VERIFICATION_STATUS_TEXT
      : status === 'revoked'
        ? 'Reciter & Recitation Source Verification has been revoked. Family audio access is blocked until re-confirmed by an authorized administrator.'
        : checklistPassed
          ? `${SOURCE_VERIFICATION_STATUS_TEXT} Awaiting explicit administrator confirmation ("Confirm Reciter & Recitation Source").`
          : 'Run provider & 49-URL technical audio verification, then explicitly confirm Reciter & Recitation Source.';

  const normalizedRecord: QuranSourceVerificationRecord = {
    status,
    confirmed: isConfirmed,
    confirmedBy: isConfirmed ? savedSv?.confirmedBy : undefined,
    confirmedByUserId: isConfirmed ? savedSv?.confirmedByUserId : undefined,
    confirmedAt: isConfirmed ? savedSv?.confirmedAt : undefined,
    revokedBy: status === 'revoked' ? savedSv?.revokedBy : undefined,
    revokedByUserId: status === 'revoked' ? savedSv?.revokedByUserId : undefined,
    revokedAt: status === 'revoked' ? savedSv?.revokedAt : undefined,
    provider: 'Quran Foundation',
    reciterId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
    reciterIdentity: 'Sheikh Mahmoud Khalil Al-Husary',
    recitationStyle: 'Murattal',
    riwayah: "Hafs 'an Asim",
    evidenceVersion: savedSv?.evidenceVersion || SOURCE_VERIFICATION_EVIDENCE_VERSION,
    evaluatedAt,
    urlSetHash,
    providerMetadataVerified: providerVerified,
    textSha256VerifiedCount: localTextCheck.verifiedSurahsCount,
    textSha256TotalCount: localTextCheck.totalSurahsCount,
    textAyahsVerifiedCount: localTextCheck.verifiedAyahsCount,
    surahUrlsPresentCount: surahAudioUrlsCount,
    ayahUrlsPresentCount: ayahAudioUrlsCount,
    audioProbePassedCount: probeMatchesCurrentUrls ? probePassedCount : 0,
    audioProbeTotalCount: probeMatchesCurrentUrls ? probeTotalCount : 0,
    audioProbeInvalidCount: probeMatchesCurrentUrls ? probeInvalidCount : 0,
    audioProbeDuplicateCount: probeMatchesCurrentUrls ? probeDuplicateCount : 0,
    audioProbeError: savedSv?.audioProbeError,
    statusMessage,
  };

  return {
    checklist,
    checklistPassed,
    checklistPassedCount,
    checklistTotalCount,
    sourceVerification: normalizedRecord,
    textIntegrityVerified: localTextCheck.allMatched,
    audioUrlsComplete,
    audioTechnicalIntegrityVerified,
    surahAudioUrlsCount,
    ayahAudioUrlsCount,
  };
}

export function getBasmalaCandidateInfo(db: ServerDb): {
  audioUrl: string | null;
  verseKey: string;
  recitationId: number;
  reciterName: string;
  source: 'phrase_record' | 'reciter_record' | 'provider_cache' | 'qf_public_api_v4' | 'none';
  probe: QuranAudioProbeDiagnostics | null;
  configuredMirrorUrl: string | null;
  configuredMirrorProbe: QuranAudioProbeDiagnostics | null;
  authorizedFallbackUrl: string | null;
} {
  ensureFamilyCollections(db);
  const phraseRecord = db.quranContentVerifications?.['phrase:basmala'];
  const phraseMeta = (phraseRecord?.audioUrlsJson || {}) as Record<string, string>;
  const phraseUrl = normalizeQuranAudioUrl(phraseMeta.url ?? PHRASE_ASSET_DEFAULTS.basmala.envUrl ?? '');
  const reciterRecord = db.quranContentVerifications?.[HUSARY_MURATTAL_SPEC.reciterId];
  const fromReciterRecord = normalizeQuranAudioUrl(reciterRecord?.ayahAudioUrlsJson?.['1:1']);
  const fromCache = normalizeQuranAudioUrl(getCachedHusaryBasmalaCandidateUrl());
  const probe = phraseRecord?.basmalaCandidateProbe || reciterRecord?.basmalaCandidateProbe || null;

  if (phraseUrl && isAllowedQuranFoundationAudioHost(phraseUrl)) {
    return {
      audioUrl: phraseUrl,
      verseKey: '1:1',
      recitationId: HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
      reciterName: HUSARY_MURATTAL_SPEC.nameEn,
      source: 'phrase_record',
      probe,
      configuredMirrorUrl: phraseUrl,
      configuredMirrorProbe: probe && probe.url === phraseUrl ? probe : null,
      authorizedFallbackUrl:
        fromReciterRecord && fromReciterRecord !== phraseUrl ? fromReciterRecord : null,
    };
  }
  if (fromReciterRecord && isAllowedQuranFoundationAudioHost(fromReciterRecord)) {
    return {
      audioUrl: fromReciterRecord,
      verseKey: '1:1',
      recitationId: HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
      reciterName: HUSARY_MURATTAL_SPEC.nameEn,
      source: 'reciter_record',
      probe,
      configuredMirrorUrl: fromReciterRecord,
      configuredMirrorProbe: probe && probe.url === fromReciterRecord ? probe : null,
      authorizedFallbackUrl: null,
    };
  }
  if (fromCache && isAllowedQuranFoundationAudioHost(fromCache)) {
    return {
      audioUrl: fromCache,
      verseKey: '1:1',
      recitationId: HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
      reciterName: HUSARY_MURATTAL_SPEC.nameEn,
      source: 'provider_cache',
      probe,
      configuredMirrorUrl: fromCache,
      configuredMirrorProbe: probe && probe.url === fromCache ? probe : null,
      authorizedFallbackUrl: null,
    };
  }
  return {
    audioUrl: null,
    verseKey: '1:1',
    recitationId: HUSARY_MURATTAL_SPEC.quranFoundationVerseRecitationId,
    reciterName: HUSARY_MURATTAL_SPEC.nameEn,
    source: 'none',
    probe,
    configuredMirrorUrl: null,
    configuredMirrorProbe: null,
    authorizedFallbackUrl: null,
  };
}

function hydrateConfirmations(raw?: QuranAdminConfirmations): QuranAdminConfirmations {
  const legacyCombined = raw?.qfAttributionAndTerms;
  const qfDevTerms: QuranConfirmationItemRecord =
    raw?.qfDeveloperTermsAndCommercialUse ||
    (legacyCombined?.confirmed ? { ...legacyCombined } : { confirmed: false });
  const qfAttribution: QuranConfirmationItemRecord =
    raw?.qfAttributionAndReciterCredit ||
    (legacyCombined?.confirmed ? { ...legacyCombined } : { confirmed: false });
  const sevenDay = raw?.sevenDayCachePolicy || { confirmed: false };
  const privacy = raw?.privacyAndTermsReadiness || { confirmed: false };
  const basmala = raw?.basmalaAudioApproval || { confirmed: false };
  return {
    qfDeveloperTermsAndCommercialUse: qfDevTerms,
    qfAttributionAndReciterCredit: qfAttribution,
    sevenDayCachePolicy: sevenDay,
    privacyAndTermsReadiness: privacy,
    basmalaAudioApproval: basmala,
    qfAttributionAndTerms: {
      confirmed: qfDevTerms.confirmed && qfAttribution.confirmed,
      confirmedBy: qfAttribution.confirmedBy || qfDevTerms.confirmedBy,
      confirmedByUserId: qfAttribution.confirmedByUserId || qfDevTerms.confirmedByUserId,
      confirmedAt: qfAttribution.confirmedAt || qfDevTerms.confirmedAt,
      policyVersion: qfDevTerms.policyVersion,
    },
  };
}

export function buildReleaseReadinessSummary(db: ServerDb, nowMs = Date.now()): QuranReleaseReadinessSummary {
  ensureFamilyCollections(db);
  const reciters = mergeRecitersWithVerifications(db, nowMs);
  const husary = reciters.find((r) => r.id === HUSARY_MURATTAL_SPEC.reciterId) || reciters[0];
  const record = db.quranContentVerifications?.[HUSARY_MURATTAL_SPEC.reciterId];
  const phraseAssets = getPhraseAssetConfigs(db);
  const confirmations = hydrateConfirmations(record?.adminConfirmations);
  const svState = buildSourceVerificationState(db);

  const fourAdminKeys = [
    confirmations.qfDeveloperTermsAndCommercialUse,
    confirmations.qfAttributionAndReciterCredit,
    confirmations.sevenDayCachePolicy,
    confirmations.privacyAndTermsReadiness,
  ];
  const adminConfirmationsCount = fourAdminKeys.filter((c) => c.confirmed).length;
  const adminConfirmationsTotal = fourAdminKeys.length;
  const allAdminConfirmationsComplete = adminConfirmationsCount === adminConfirmationsTotal;

  const basmalaProbe = db.quranContentVerifications?.['phrase:basmala']?.basmalaCandidateProbe;
  const basmalaPlayable = Boolean(
    phraseAssets.basmala.audioUrl &&
      basmalaProbe?.ok === true &&
      basmalaProbe?.browserPlayable === true &&
      basmalaProbe?.url === phraseAssets.basmala.audioUrl,
  );
  const basmalaApproved = phraseAssets.basmala.status === 'approved' && basmalaPlayable;
  const closingDisabled = phraseAssets.closing.status !== 'approved';
  const featureEnabled = db.featureFlags?.quranWorldEnabled !== false;
  const reciterVerified = husary.verificationStatus === 'verified';
  const familyAccessEnabled =
    reciterVerified &&
    basmalaApproved &&
    svState.sourceVerification.confirmed &&
    svState.checklistPassed &&
    allAdminConfirmationsComplete &&
    featureEnabled;

  const integrityChecksReady =
    svState.textIntegrityVerified &&
    svState.audioUrlsComplete &&
    svState.audioTechnicalIntegrityVerified &&
    svState.sourceVerification.confirmed;

  const pendingApprovals: QuranReleaseReadinessSummary['pendingApprovals'] = [];
  if (!confirmations.qfDeveloperTermsAndCommercialUse.confirmed) {
    pendingApprovals.push({
      key: 'conf_qf_developer_terms',
      labelEn: 'Admin confirmation: Quran Foundation Developer Terms & permitted integrated commercial use',
      labelAr: 'تأكيد المشرف: شروط مطوري Quran Foundation والاستخدام التجاري المدمج المصرح به',
      actionRequiredEn: 'Click "Confirm Requirement" on the Developer Terms card in Section 1.',
      actionRequiredAr: 'انقر على "Confirm Requirement" في بطاقة شروط المطورين بالقسم ١.',
    });
  }
  if (!confirmations.qfAttributionAndReciterCredit.confirmed) {
    pendingApprovals.push({
      key: 'conf_qf_attribution',
      labelEn: 'Admin confirmation: Quran Foundation attribution and Reciter ID 6 (Al-Husary) credit',
      labelAr: 'تأكيد المشرف: إسناد Quran Foundation وذكر اسم القارئ الشيخ محمود خليل الحصري',
      actionRequiredEn: 'Click "Confirm Requirement" on the Attribution & Reciter Credit card in Section 1.',
      actionRequiredAr: 'انقر على "Confirm Requirement" في بطاقة الإسناد وذكر القارئ بالقسم ١.',
    });
  }
  if (!confirmations.sevenDayCachePolicy.confirmed) {
    pendingApprovals.push({
      key: 'conf_cache_policy',
      labelEn: 'Admin confirmation: Seven-day audio URL server cache policy',
      labelAr: 'تأكيد المشرف: سياسة التخزين المؤقت لروابط الصوت (٧ أيام)',
      actionRequiredEn: 'Click "Confirm Requirement" on the Seven-Day Audio URL Cache Policy card in Section 1.',
      actionRequiredAr: 'انقر على "Confirm Requirement" في بطاقة سياسة التخزين المؤقت (٧ أيام) بالقسم ١.',
    });
  }
  if (!confirmations.privacyAndTermsReadiness.confirmed) {
    pendingApprovals.push({
      key: 'conf_privacy_terms',
      labelEn: 'Admin confirmation: Privacy Policy and Terms of Use readiness',
      labelAr: 'تأكيد المشرف: جاهزية سياسة الخصوصية وشروط الاستخدام',
      actionRequiredEn: 'Click "Confirm Requirement" on the Privacy Policy & Terms card in Section 1.',
      actionRequiredAr: 'انقر على "Confirm Requirement" في بطاقة سياسة الخصوصية بالقسم ١.',
    });
  }
  if (!svState.checklistPassed) {
    pendingApprovals.push({
      key: 'source_verification_checklist',
      labelEn: `Reciter & Recitation Source Verification checklist (${svState.checklistPassedCount}/${svState.checklistTotalCount} checks passed)`,
      labelAr: `قائمة التحقق من مصدر القارئ والتسجيلات (${svState.checklistPassedCount}/${svState.checklistTotalCount})`,
      actionRequiredEn: 'Run "Verify Provider & Probe 49 Audio URLs" in Section 3 until all 8 provider, SHA-256, and audio checks pass.',
      actionRequiredAr: 'شغّل فحص المزود و٤٩ رابطاً صوتياً في القسم ٣ حتى تجتاز جميع البنود الـ ٨.',
    });
  }
  if (!svState.sourceVerification.confirmed) {
    pendingApprovals.push({
      key: 'source_verification_confirmation',
      labelEn:
        svState.sourceVerification.status === 'revoked'
          ? 'Reciter & Recitation Source Verification (Revoked — Re-confirmation Required)'
          : 'Administrator action: Confirm Reciter & Recitation Source',
      labelAr: 'التحقق من مصدر القارئ والتسجيلات — بانتظار تأكيد المشرف المصرّح له',
      actionRequiredEn: 'Authenticated administrator (manage_lessons) must click "Confirm Reciter & Recitation Source" in Section 3.',
      actionRequiredAr: 'يجب على مشرف مسجّل بصلاحية manage_lessons النقر على "Confirm Reciter & Recitation Source" في القسم ٣.',
    });
  }
  if (!basmalaApproved) {
    pendingApprovals.push({
      key: 'basmala_audio',
      labelEn: `Basmala asset approval (QF Reciter ID 6 1:1 — status: ${phraseAssets.basmala.status}, playable: ${String(basmalaPlayable)})`,
      labelAr: `اعتماد صوت البسملة (1:1 للقارئ رقم ٦ — الحالة: ${phraseAssets.basmala.status})`,
      actionRequiredEn: 'Probe/resolve a playable QF Reciter ID 6 (1:1) URL, verify source & usage rights, and approve Basmala in Section 2.',
      actionRequiredAr: 'افحص رابط البسملة (1:1) للتأكد من قابليته للتشغيل ثم أكّد المصدر والحقوق واعتمده في القسم ٢.',
    });
  }
  if (!reciterVerified) {
    pendingApprovals.push({
      key: 'reciter_release',
      labelEn: `Final release action: Approve Quran World for Families (${husary.verificationStatus} -> verified)`,
      labelAr: `الإجراء النهائي للإطلاق: اعتماد عالم القرآن للعائلات (${husary.verificationStatus} -> verified)`,
      actionRequiredEn: 'Once all requirements pass, click "Approve Quran World for Families" in Section 4.',
      actionRequiredAr: 'بعد اكتمال جميع المتطلبات، انقر على "Approve Quran World for Families" في القسم ٤.',
    });
  }
  if (!featureEnabled) {
    pendingApprovals.push({
      key: 'feature_flag_disabled',
      labelEn: 'Platform feature flag: quranWorldEnabled is currently disabled',
      labelAr: 'مفتاح ميزة المنصة quranWorldEnabled معطّل حالياً',
      actionRequiredEn: 'Enable the Quran World feature flag in Platform Settings.',
      actionRequiredAr: 'فعّل مفتاح ميزة عالم القرآن من إعدادات المنصة.',
    });
  }

  const canApproveFamilyRelease =
    allAdminConfirmationsComplete &&
    svState.checklistPassed &&
    svState.sourceVerification.confirmed &&
    svState.textIntegrityVerified &&
    svState.audioUrlsComplete &&
    svState.audioTechnicalIntegrityVerified &&
    basmalaApproved &&
    featureEnabled;

  return {
    familyAccessEnabled,
    reciterVerified,
    reciterStatus: husary.verificationStatus,
    adminConfirmationsCount,
    adminConfirmationsTotal,
    allAdminConfirmationsComplete,
    sourceVerificationConfirmed: svState.sourceVerification.confirmed,
    sourceVerificationStatus: svState.sourceVerification.status,
    sourceVerificationChecklistPassed: svState.checklistPassed,
    sourceVerificationChecklistPassedCount: svState.checklistPassedCount,
    sourceVerificationChecklistTotalCount: svState.checklistTotalCount,
    sourceVerificationChecklist: svState.checklist,
    sourceVerification: svState.sourceVerification,
    sourceVerificationMessage: svState.sourceVerification.statusMessage,
    textIntegrityVerified: svState.textIntegrityVerified,
    audioUrlsComplete: svState.audioUrlsComplete,
    audioTechnicalIntegrityVerified: svState.audioTechnicalIntegrityVerified,
    basmalaStatus: phraseAssets.basmala.status,
    basmalaApproved,
    basmalaPlayable,
    closingStatus: phraseAssets.closing.status,
    closingDisabled,
    closingBlocksRelease: false,
    integrityChecksReady,
    textIntegrityConfirmed: svState.textIntegrityVerified,
    audioIntegrityConfirmed: svState.audioTechnicalIntegrityVerified,
    reciterIdentityConfirmed: svState.sourceVerification.providerMetadataVerified === true,
    surahAudioUrlsCount: svState.surahAudioUrlsCount,
    ayahAudioUrlsCount: svState.ayahAudioUrlsCount,
    canApproveFamilyRelease,
    confirmations,
    pendingApprovals,
  };
}

export function mergeRecitersWithVerifications(
  db: ServerDb,
  nowMs = Date.now(),
): QuranReciterSpec[] {
  ensureFamilyCollections(db);
  const overrides = db.quranContentVerifications || {};
  const phraseAssets = getPhraseAssetConfigs(db);
  const basmalaProbe = overrides['phrase:basmala']?.basmalaCandidateProbe;
  const basmalaPlayableAndApproved =
    phraseAssets.basmala.status === 'approved' &&
    Boolean(phraseAssets.basmala.audioUrl) &&
    basmalaProbe?.ok === true &&
    basmalaProbe?.browserPlayable === true &&
    basmalaProbe?.url === phraseAssets.basmala.audioUrl;

  const approvedBasmalaUrl = basmalaPlayableAndApproved
    ? phraseAssets.basmala.audioUrl || undefined
    : undefined;
  const approvedClosingUrl =
    phraseAssets.closing.status === 'approved' ? phraseAssets.closing.audioUrl || undefined : undefined;

  return QURAN_RECITERS.map((reciter) => {
    const v = overrides[reciter.id];
    if (!v || v.contentType !== 'reciter_audio') return reciter;
    const safeSurahUrls: Record<string, string> = {};
    for (const [k, url] of Object.entries(v.audioUrlsJson || {})) {
      if (k.startsWith('_')) continue;
      const normalized = normalizeQuranAudioUrl(url);
      if (normalized) safeSurahUrls[k] = normalized;
    }
    const safeAyahUrls: Record<string, string> = {};
    for (const [k, url] of Object.entries(v.ayahAudioUrlsJson || {})) {
      const normalized = normalizeQuranAudioUrl(url);
      if (normalized) safeAyahUrls[k] = normalized;
    }

    const usesExternalQfStream =
      /quran\s*foundation/i.test(v.sourceName || reciter.sourceName || '') ||
      Object.values(safeSurahUrls).some((u) => u.startsWith('https://')) ||
      Object.values(safeAyahUrls).some((u) => u.startsWith('https://'));

    const updatedAtMs = v.updatedAt ? Date.parse(v.updatedAt) : NaN;
    const qfCacheExpired =
      usesExternalQfStream &&
      (!Number.isFinite(updatedAtMs) || nowMs - updatedAtMs > MAX_QF_SERVER_CACHE_MS);

    const activeSurahUrls = qfCacheExpired ? {} : safeSurahUrls;
    const activeAyahUrls = qfCacheExpired ? {} : safeAyahUrls;

    const hasAudioUrls =
      Object.keys(activeSurahUrls).length > 0 || Object.keys(activeAyahUrls).length > 0;

    let releaseGatesSatisfied = true;
    if (reciter.id === HUSARY_MURATTAL_SPEC.reciterId) {
      const svState = buildSourceVerificationState(db);
      const confs = hydrateConfirmations(v.adminConfirmations);
      const all4AdminConfirmed =
        confs.qfDeveloperTermsAndCommercialUse.confirmed &&
        confs.qfAttributionAndReciterCredit.confirmed &&
        confs.sevenDayCachePolicy.confirmed &&
        confs.privacyAndTermsReadiness.confirmed;
      releaseGatesSatisfied =
        svState.checklistPassed &&
        svState.sourceVerification.confirmed &&
        all4AdminConfirmed &&
        basmalaPlayableAndApproved;
    }

    const effectiveStatus: QuranVerificationStatus = qfCacheExpired
      ? 'pending_verification'
      : v.verificationStatus === 'verified' && !hasAudioUrls
        ? 'unavailable'
        : v.verificationStatus === 'verified' && !releaseGatesSatisfied
          ? 'pending_verification'
          : v.verificationStatus;

    const exposedSurahUrls =
      effectiveStatus === 'verified' && Object.keys(activeSurahUrls).length > 0
        ? activeSurahUrls
        : undefined;
    const exposedAyahUrls =
      effectiveStatus === 'verified' && Object.keys(activeAyahUrls).length > 0
        ? activeAyahUrls
        : undefined;

    return {
      ...reciter,
      sourceName: v.sourceName || reciter.sourceName,
      licenseOrPermission: v.licenseOrPermission || reciter.licenseOrPermission,
      sourceVerificationStatus: v.sourceVerification?.status || 'pending',
      sourceVerifiedAt: v.sourceVerification?.confirmedAt,
      sourceEvidenceVersion: v.sourceVerification?.evidenceVersion,
      verificationStatus: effectiveStatus,
      surahAudioUrls: exposedSurahUrls,
      ayahAudioUrls: exposedAyahUrls,
      basmalaAudioUrl: effectiveStatus === 'verified' ? approvedBasmalaUrl : undefined,
      closingPhraseAudioUrl: effectiveStatus === 'verified' ? approvedClosingUrl : undefined,
      unavailableReason: qfCacheExpired
        ? {
            ar: 'انتهت صلاحية التخزين المؤقت لروابط Quran Foundation (الحد الأقصى ٧ أيام) — يلزم إعادة المزامنة.',
            en: 'Quran Foundation cached URLs exceeded the 7-day compliance window and require re-sync.',
          }
        : effectiveStatus === 'verified'
          ? undefined
          : reciter.unavailableReason,
    };
  });
}

export function resolveReciterForPlayback(
  reciters: QuranReciterSpec[],
  preferredReciterId: string,
  preferChildFallback = true,
): {
  requestedReciter: QuranReciterSpec;
  activeReciter: QuranReciterSpec | null;
  usedAdultFallback: boolean;
  audioAvailable: boolean;
} {
  const requested =
    reciters.find((r) => r.id === preferredReciterId) ||
    reciters.find((r) => r.reciterType === 'adult') ||
    reciters[0];

  const isPlayableVerified = (r: QuranReciterSpec | undefined): boolean =>
    Boolean(
      r &&
        r.verificationStatus === 'verified' &&
        ((r.surahAudioUrls && Object.keys(r.surahAudioUrls).length > 0) ||
          (r.ayahAudioUrls && Object.keys(r.ayahAudioUrls).length > 0)),
    );

  if (isPlayableVerified(requested)) {
    return {
      requestedReciter: requested,
      activeReciter: requested,
      usedAdultFallback: false,
      audioAvailable: true,
    };
  }

  // Child reciter unavailable/pending -> fall back strictly to a verified adult reciter (never TTS)
  if (requested.reciterType === 'child' && preferChildFallback) {
    const verifiedAdult = reciters.find((r) => r.reciterType === 'adult' && isPlayableVerified(r));
    if (verifiedAdult) {
      return {
        requestedReciter: requested,
        activeReciter: verifiedAdult,
        usedAdultFallback: true,
        audioAvailable: true,
      };
    }
  } else {
    const otherVerifiedAdult = reciters.find((r) => r.reciterType === 'adult' && isPlayableVerified(r));
    if (otherVerifiedAdult) {
      return {
        requestedReciter: requested,
        activeReciter: otherVerifiedAdult,
        usedAdultFallback: true,
        audioAvailable: true,
      };
    }
  }

  return {
    requestedReciter: requested,
    activeReciter: null,
    usedAdultFallback: false,
    audioAvailable: false,
  };
}

export function computeNaturalSurahStatus(
  listenCount: number,
  repeatSessionsCount: number,
  ayahsPracticedCount: number,
  totalAyahs: number,
): Exclude<QuranMemorizationStatus, 'parent_confirmed'> {
  if (listenCount >= 3 && ayahsPracticedCount >= totalAyahs && totalAyahs > 0) {
    return 'familiar';
  }
  if (repeatSessionsCount >= 1 || ayahsPracticedCount >= 1) {
    return 'practiced';
  }
  if (listenCount >= 1) {
    return 'heard';
  }
  return 'not_started';
}

export function getChildQuranMinutesUsedToday(db: ServerDb, childId: string): number {
  const today = getTodayDayKey();
  const totalSeconds = (db.quranActivityEvents || [])
    .filter((ev) => ev.childId === childId && ev.occurredAt.slice(0, 10) === today)
    .reduce((sum, ev) => sum + Math.max(0, Number(ev.durationSeconds || 0)), 0);
  return Math.round((totalSeconds / 60) * 10) / 10;
}

function isSafeStoryAssetUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith('/assets/') && !trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('/src/assets/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getMergedQuranStories(db: ServerDb, includeAllForAdmin = false): QuranStorySpec[] {
  ensureFamilyCollections(db);
  const overrides = db.quranStoryCms || {};
  const merged = QURAN_STORIES.map((story) => {
    const ov = overrides[story.id];
    const baseMerged = mergeStoryWithAdminOverride(story, ov);
    const verifiedScenes = baseMerged.scenes.map((sc) => {
      const explicitSceneOv = ov?.sceneOverrides?.[sc.id];
      let url = sc.narrationAudioUrl ?? null;

      if (explicitSceneOv && explicitSceneOv.narrationAudioUrl === null) {
        url = null;
      } else if (!url) {
        const expectedLocal = getExpectedStoryAudioUrl(baseMerged.id, sc.id);
        if (localStoryAudioExistsSync(expectedLocal)) {
          url = expectedLocal;
        }
      } else if (url.startsWith('/assets/') && !localStoryAudioExistsSync(url)) {
        // Never mark a missing/corrupt local audio file as available
        url = null;
      }

      return {
        ...sc,
        narrationAudioUrl: url,
      };
    });
    return {
      ...baseMerged,
      scenes: verifiedScenes,
    };
  }).sort((a, b) => a.order - b.order);

  if (includeAllForAdmin) return merged;
  return merged.filter((s) => s.enabled !== false && s.publishedStatus === 'published');
}

export function buildChildStoryProgressDetails(
  db: ServerDb,
  childId: string,
): QuranStoryProgressDetails[] {
  ensureFamilyCollections(db);
  const legacyMap = new Map<string, QuranStoryProgress>();
  for (const row of Object.values(db.quranStoryProgress || {})) {
    if (row.childId === childId) {
      legacyMap.set(row.storyId, row);
    }
  }

  const detailsMap = new Map<string, QuranStoryProgressDetails>();
  for (const row of Object.values(db.quranStoryDetails || {})) {
    if (row.childId === childId) {
      detailsMap.set(row.storyId, row);
    }
  }

  const allStoryIds = new Set<string>([...legacyMap.keys(), ...detailsMap.keys()]);
  const result: QuranStoryProgressDetails[] = [];

  for (const storyId of allStoryIds) {
    const legacy = legacyMap.get(storyId);
    const detail = detailsMap.get(storyId);
    const spec = getQuranStoryById(storyId);
    const totalScenes = Math.max(1, spec?.scenes?.length || detail?.totalScenes || 5);
    const completedCount = Math.max(detail?.completedCount || 0, legacy?.completedCount || 0);
    const completed = Boolean(detail?.completed || completedCount > 0);
    result.push({
      id: detail?.id || legacy?.id || `${childId}__${storyId}`,
      childId,
      storyId,
      startedAt: detail?.startedAt || legacy?.lastReadAt || new Date().toISOString(),
      lastSceneIndex: Math.max(0, Math.min(totalScenes - 1, detail?.lastSceneIndex ?? 0)),
      totalScenes,
      scenesCompleted: Array.isArray(detail?.scenesCompleted) ? detail.scenesCompleted : [],
      listenedSeconds: Math.max(0, Number(detail?.listenedSeconds || 0)),
      audioCompleted: Boolean(detail?.audioCompleted),
      interactionsCompleted: Array.isArray(detail?.interactionsCompleted)
        ? detail.interactionsCompleted
        : [],
      quizCompleted: Boolean(detail?.quizCompleted),
      closingActivityCompleted: Boolean(detail?.closingActivityCompleted),
      completed,
      completedCount,
      completedAt: detail?.completedAt || (completed ? legacy?.lastReadAt : undefined),
      completionBadgeAwarded:
        detail?.completionBadgeAwarded || (completed ? spec?.completionBadge?.id : undefined),
      lastReadAt: detail?.lastReadAt || legacy?.lastReadAt || new Date().toISOString(),
      lastCompletionToken: detail?.lastCompletionToken,
    });
  }

  return result;
}

export function buildChildQuranSummary(db: ServerDb, child: StoredChildRecord) {
  ensureFamilyCollections(db);
  const settings = getEffectiveQuranChildSettings(db, child.id);
  const reciters = mergeRecitersWithVerifications(db);
  const playback = resolveReciterForPlayback(
    reciters,
    settings.preferredReciterId,
    settings.preferChildReciterFallback,
  );

  const surahProgressList = Object.values(db.quranSurahProgress || {}).filter(
    (p) => p.childId === child.id,
  );
  const storyProgressList = Object.values(db.quranStoryProgress || {}).filter(
    (p) => p.childId === child.id,
  );
  const storyProgressDetails = buildChildStoryProgressDetails(db, child.id);
  const mannerProgressList = Object.values(db.quranMannerProgress || {}).filter(
    (p) => p.childId === child.id,
  );
  const recentEvents = (db.quranActivityEvents || [])
    .filter((ev) => ev.childId === child.id)
    .slice(0, 40);

  const minutesUsedToday = getChildQuranMinutesUsedToday(db, child.id);

  return {
    childId: child.id,
    internalAgeBand: getInternalAgeBand(child),
    featureEnabled: db.featureFlags?.quranWorldEnabled !== false,
    settings,
    playbackResolution: playback,
    minutesUsedToday,
    dailyLimitReached: minutesUsedToday >= settings.dailyMaxMinutes,
    surahProgress: surahProgressList,
    storyProgress: storyProgressList,
    storyProgressDetails,
    mannerProgress: mannerProgressList,
    recentEvents,
    growthSummary: {
      listenedSurahsCount: surahProgressList.filter((s) => s.listenCount > 0).length,
      practicedSurahsCount: surahProgressList.filter((s) => s.repeatSessionsCount > 0).length,
      familiarSurahsCount: surahProgressList.filter(
        (s) => s.status === 'familiar' || s.status === 'parent_confirmed',
      ).length,
      parentConfirmedCount: surahProgressList.filter((s) => s.parentConfirmedMemorization).length,
      storiesReadCount: storyProgressDetails.filter((s) => s.completed || s.completedCount > 0).length,
      mannersPracticedCount: mannerProgressList.reduce((acc, m) => acc + m.practicedCount, 0),
    },
  };
}

export function registerQuranRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  assertChildAccess,
  requireAdminPermission,
}: QuranRoutesDeps) {
  const asyncRoute =
    (
      fn: (
        req: AuthenticatedRequest,
        res: express.Response,
        next: express.NextFunction,
      ) => unknown,
    ): express.RequestHandler =>
    (req, res, next) => {
      Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
    };

  // 1. Authenticated Catalog & Verified Provenance Registry
  app.get('/api/quran/catalog', requireAuth, (_req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const reciters = mergeRecitersWithVerifications(db);
    const rawPhraseAssets = getPhraseAssetConfigs(db);
    // Strip unapproved phrase URLs from family/child catalog responses
    const sanitizeForFamily = (asset: QuranPhraseAudioAssetConfig): QuranPhraseAudioAssetConfig => ({
      ...asset,
      audioUrl: asset.status === 'approved' ? asset.audioUrl : null,
    });
    return res.json({
      quranSchemaReady: isQuranSchemaReady(),
      featureEnabled: db.featureFlags?.quranWorldEnabled !== false,
      attributionNotice: 'Quran data provided by Quran.Foundation.',
      surahs: QURAN_SURAHS,
      reciters,
      stories: getMergedQuranStories(db, false),
      manners: QURAN_MANNERS,
      playbackDefaultResolution: resolveReciterForPlayback(reciters, 'adult-husary-muallim', true),
      phraseAssets: {
        basmala: sanitizeForFamily(rawPhraseAssets.basmala),
        closing: sanitizeForFamily(rawPhraseAssets.closing),
      },
    });
  });

  // 1c. Authenticated Published Quran Stories Library (respects admin publish/enable state)
  app.get('/api/quran/stories', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const includePreview =
      req.query.preview === '1' &&
      (req.authSession?.user.role === 'super_admin' ||
        req.authSession?.user.role === 'content_admin');
    return res.json({
      quranSchemaReady: isQuranSchemaReady(),
      featureEnabled: db.featureFlags?.quranWorldEnabled !== false,
      stories: getMergedQuranStories(db, includePreview),
    });
  });

  // 1b. Read-only Quran Audio Provider & Single-Reciter Verification Status
  app.get('/api/quran/audio/status', requireAuth, (_req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const db = getDb();
    ensureFamilyCollections(db);
    const reciters = mergeRecitersWithVerifications(db);
    const defaultReciter = reciters.find((r) => r.id === HUSARY_MURATTAL_SPEC.reciterId) || reciters[0];
    const scopeConfig = resolveConfiguredQuranFoundationScopes();
    const phraseAssets = getPhraseAssetConfigs(db);
    const releaseReadiness = buildReleaseReadinessSummary(db);
    return res.json({
      provider: 'quran-foundation',
      quranFoundationConfigured: isQuranFoundationConfigured(),
      oauthAuthMethod: 'client_secret_basic',
      configuredScopes: scopeConfig.scopes,
      scopeConfigSource: scopeConfig.source,
      attributionRequired: true,
      compliancePolicy: {
        termsUpdatedDate: '2026-11-20',
        maxServerCacheDays: MAX_QF_SERVER_CACHE_DAYS,
        testingCacheTtlMinutes: Math.round(TESTING_AUDIO_CACHE_TTL_MS / 60_000),
        directStreamingOnly: true,
        rehostingProhibited: true,
        rawUrlPackageExposed: false,
        requiredAttribution: 'Quran data provided by Quran.Foundation.',
        commercialEndUserUsePermitted: true,
        standaloneRedistributionAllowed: false,
        paidApiLicenseRequired: false,
        closingPhraseStatus: phraseAssets.closing.status,
        basmalaStatus: phraseAssets.basmala.status,
        familyAccessEnabled: releaseReadiness.familyAccessEnabled,
        pendingApprovalsCount: releaseReadiness.pendingApprovals.length,
        privacyPolicyUrl: '/privacy',
        termsOfUseUrl: '/terms',
      },
      singleDefaultReciter: {
        id: defaultReciter.id,
        canonicalSlug: HUSARY_MURATTAL_SPEC.canonicalSlug,
        nameAr: defaultReciter.name.ar,
        nameEn: defaultReciter.name.en,
        verificationStatus: defaultReciter.verificationStatus,
        verifiedSurahCount: Object.keys(defaultReciter.surahAudioUrls || {}).length,
        verifiedAyahCount: Object.keys(defaultReciter.ayahAudioUrls || {}).length,
        attribution: HUSARY_MURATTAL_SPEC.attribution,
      },
      technicalDiagnosticSampleUrl: '/assets/audio/technical-test-chime.wav',
    });
  });

  // 2. Child's Quran Settings, Progress & Age-Adapted Summary
  app.get('/api/children/:id/quran', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child profile not found' });
      return;
    }
    if (!canUserAccessChild(db, req.authSession!.user, child, 'view_progress')) {
      return res.status(403).json({ error: 'Forbidden: missing permission to view child Quran progress.' });
    }
    return res.json({
      quranSchemaReady: isQuranSchemaReady(),
      ...buildChildQuranSummary(db, child),
    });
  });

  // 3. Record Listen / Listen & Repeat Activity (NEVER confirms memorization!)
  app.post('/api/children/:id/quran/listen', requireAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child profile not found' } };
        return null;
      }

      if (!isQuranSchemaReady()) {
        return {
          status: 409,
          body: {
            error: 'Quran World storage tables are pending additive migration 0002_quran_world.sql.',
            code: 'QURAN_SCHEMA_PENDING',
          },
        };
      }
      if (db.featureFlags?.quranWorldEnabled === false) {
        return {
          status: 403,
          body: { error: 'Quran World is currently disabled by platform administrators.', code: 'FEATURE_DISABLED' },
        };
      }

      const user = req.authSession!.user;
      if (!isChildOrStudentRole(user.role) && !canUserAccessChild(db, user, child, 'view_progress')) {
        return { status: 403, body: { error: 'Forbidden: cannot record activity for this child.' } };
      }

      const settings = getEffectiveQuranChildSettings(db, child.id);
      if (!settings.enabled) {
        return {
          status: 403,
          body: { error: 'Quran World is currently paused by a parent for this child.', code: 'QURAN_DISABLED_FOR_CHILD' },
        };
      }

      const body = (req.body || {}) as {
        surahId?: string;
        mode?: 'listen' | 'repeat';
        ayahNumbers?: number[];
        durationSeconds?: number;
        reciterId?: string;
      };

      const surahId = sanitizeShortText(body.surahId || '', 32);
      const surah = getQuranSurahById(surahId);
      if (!surah) {
        return { status: 400, body: { error: 'Invalid Surah identifier.' } };
      }
      if (!settings.allowedSurahIds.includes(surah.id)) {
        return {
          status: 403,
          body: { error: 'This Surah is not currently enabled in this child’s Quran plan.', code: 'SURAH_NOT_ALLOWED_FOR_CHILD' },
        };
      }

      const minutesUsedToday = getChildQuranMinutesUsedToday(db, child.id);
      if (minutesUsedToday >= settings.dailyMaxMinutes) {
        return {
          status: 429,
          body: {
            error: 'Daily Quran listening time limit reached. Let’s take a peaceful break!',
            code: 'QURAN_DAILY_LIMIT_REACHED',
            dailyLimitReached: true,
            minutesUsedToday,
            dailyMaxMinutes: settings.dailyMaxMinutes,
          },
        };
      }

      const mode: 'listen' | 'repeat' = body.mode === 'repeat' && !settings.listenOnlyMode ? 'repeat' : 'listen';
      const validAyahs = Array.isArray(body.ayahNumbers)
        ? Array.from(
            new Set(
              body.ayahNumbers
                .map((n) => Math.round(Number(n)))
                .filter((n) => Number.isFinite(n) && n >= 1 && n <= surah.ayahCount),
            ),
          )
        : [];
      const durationSeconds = Math.max(0, Math.min(1800, Math.round(Number(body.durationSeconds || 20))));
      const reciterId = VALID_RECITER_ID_SET.has(String(body.reciterId || ''))
        ? String(body.reciterId)
        : settings.preferredReciterId;

      const key = `${child.id}__${surah.id}`;
      const nowIso = new Date().toISOString();
      const prev = db.quranSurahProgress![key];
      const mergedAyahs = Array.from(
        new Set([...(prev?.ayahsPracticed || []), ...validAyahs]),
      ).sort((a, b) => a - b);

      const nextListenCount = (prev?.listenCount || 0) + 1;
      const nextRepeatSessions = (prev?.repeatSessionsCount || 0) + (mode === 'repeat' ? 1 : 0);
      const naturalStatus = computeNaturalSurahStatus(
        nextListenCount,
        nextRepeatSessions,
        mergedAyahs.length,
        surah.ayahCount,
      );

      // Preserve prior explicit parent confirmation if already confirmed; NEVER confirm automatically
      const parentConfirmed = Boolean(prev?.parentConfirmedMemorization);
      const nextStatus: QuranMemorizationStatus = parentConfirmed ? 'parent_confirmed' : naturalStatus;

      const updatedProgress: QuranSurahProgress = {
        id: key,
        childId: child.id,
        surahId: surah.id,
        listenCount: nextListenCount,
        repeatSessionsCount: nextRepeatSessions,
        ayahsPracticed: mergedAyahs,
        status: nextStatus,
        parentConfirmedMemorization: parentConfirmed,
        parentConfirmedAt: prev?.parentConfirmedAt,
        parentConfirmedByUserId: prev?.parentConfirmedByUserId,
        parentNote: prev?.parentNote,
        lastListenedAt: nowIso,
        updatedAt: nowIso,
      };
      db.quranSurahProgress![key] = updatedProgress;

      const event: QuranActivityEvent = {
        id: `qevt_${crypto.randomBytes(5).toString('hex')}`,
        childId: child.id,
        eventType: mode,
        targetId: surah.id,
        durationSeconds,
        ayahCount: validAyahs.length || surah.ayahCount,
        reciterId,
        recordedByUserId: user.id,
        occurredAt: nowIso,
      };
      db.quranActivityEvents = [event, ...(db.quranActivityEvents || [])].slice(0, 2000);

      ensureChildFamilyAndGarden(db, child);
      child.totalLearningMinutes = (child.totalLearningMinutes || 0) + Math.max(0, Math.round(durationSeconds / 60));
      recordQuranActiveDay(child, {
        category: 'quran',
        title: { ar: `الاستماع إلى ${surah.nameAr}`, en: `Quran Time: ${surah.nameEn}` },
        detail:
          mode === 'repeat'
            ? { ar: 'استماع وترديد هادئ في عالم القرآن', en: 'Calm listen & repeat session' }
            : { ar: 'جلسة استماع هادئة في عالم القرآن', en: 'Calm Quran listening moment' },
      });

      awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: 'quran-first-listen',
        preferredItemId: 'garden-olive-tree',
        reason: { ar: 'أول لحظة استماع هادئة في عالم القرآن', en: 'First peaceful moment in Quran World' },
      });
      if (mode === 'repeat') {
        awardGardenMilestoneIdempotent(db, child, {
          milestoneKey: 'quran-repeat-explorer',
          preferredItemId: 'garden-star-lantern',
          reason: { ar: 'الترديد اللطيف لآيات القرآن الكريم', en: 'Gentle listen & repeat in Quran World' },
        });
      }

      return {
        status: 200,
        body: {
          progress: updatedProgress,
          summary: buildChildQuranSummary(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  }));

  // 4. Record Quran Story Engagement (Symbolic only, non-competitive)
  app.post('/api/children/:id/quran/story', requireAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child profile not found' } };
        return null;
      }
      if (!isQuranSchemaReady()) {
        return { status: 409, body: { error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' } };
      }
      if (db.featureFlags?.quranWorldEnabled === false) {
        return { status: 403, body: { error: 'Quran World is disabled.', code: 'FEATURE_DISABLED' } };
      }

      const settings = getEffectiveQuranChildSettings(db, child.id);
      if (!settings.enabled) {
        return { status: 403, body: { error: 'Quran World is disabled for this child.', code: 'QURAN_DISABLED_FOR_CHILD' } };
      }

      const storyId = sanitizeShortText(req.body?.storyId || '', 64);
      const story = getQuranStoryById(storyId);
      if (!story) {
        return { status: 400, body: { error: 'Invalid Quran story identifier.' } };
      }

      const key = `${child.id}__${story.id}`;
      const nowIso = new Date().toISOString();
      const prev = db.quranStoryProgress![key];
      const next: QuranStoryProgress = {
        id: key,
        childId: child.id,
        storyId: story.id,
        completedCount: (prev?.completedCount || 0) + 1,
        lastReadAt: nowIso,
      };
      db.quranStoryProgress![key] = next;

      const qEvent: QuranActivityEvent = {
        id: `qevt_${crypto.randomBytes(5).toString('hex')}`,
        childId: child.id,
        eventType: 'story',
        targetId: story.id,
        durationSeconds: 30,
        ayahCount: 0,
        recordedByUserId: req.authSession!.user.id,
        occurredAt: nowIso,
      };
      db.quranActivityEvents = [qEvent, ...(db.quranActivityEvents || [])].slice(0, 2000);

      ensureChildFamilyAndGarden(db, child);
      recordQuranActiveDay(child, {
        category: 'quran',
        title: story.title,
        detail: { ar: 'قصة قرآنية مصوّرة برموز هادئة', en: 'Completed a symbolic Quran story' },
      });

      return {
        status: 200,
        body: {
          storyProgress: next,
          summary: buildChildQuranSummary(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  }));

  // 4b. Rich Quran Story Progress (Start, Scene Progress, Interactive Activities, Idempotent Completion)
  app.post('/api/children/:id/quran/story/progress', requireAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child profile not found' } };
        return null;
      }
      if (!isQuranSchemaReady()) {
        return { status: 409, body: { error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' } };
      }
      if (db.featureFlags?.quranWorldEnabled === false) {
        return { status: 403, body: { error: 'Quran World is disabled.', code: 'FEATURE_DISABLED' } };
      }

      const user = req.authSession!.user;
      if (!isChildOrStudentRole(user.role) && !canUserAccessChild(db, user, child, 'view_progress')) {
        return { status: 403, body: { error: 'Forbidden: cannot record story progress for this child.' } };
      }

      const settings = getEffectiveQuranChildSettings(db, child.id);
      if (!settings.enabled) {
        return { status: 403, body: { error: 'Quran World is disabled for this child.', code: 'QURAN_DISABLED_FOR_CHILD' } };
      }

      const body = (req.body || {}) as {
        storyId?: string;
        action?: 'start' | 'scene_progress' | 'interaction' | 'complete';
        sceneIndex?: number;
        sceneId?: string;
        interactionId?: string;
        quizCompleted?: boolean;
        closingActivityCompleted?: boolean;
        listenedSecondsDelta?: number;
        audioCompleted?: boolean;
        completionToken?: string;
      };

      const storyId = sanitizeShortText(body.storyId || '', 64);
      const publishedStories = getMergedQuranStories(db, false);
      const story = publishedStories.find((s) => s.id === storyId);
      if (!story) {
        return { status: 404, body: { error: 'Story is unavailable or not published.' } };
      }

      const action = body.action || 'scene_progress';
      if (!['start', 'scene_progress', 'interaction', 'complete'].includes(action)) {
        return { status: 400, body: { error: 'Invalid story progress action.' } };
      }

      const secondsDelta = Math.max(0, Math.min(180, Math.round(Number(body.listenedSecondsDelta || 0))));
      if (secondsDelta > 0) {
        const usedToday = getChildQuranMinutesUsedToday(db, child.id);
        if (usedToday >= settings.dailyMaxMinutes) {
          return {
            status: 429,
            body: {
              error: 'Daily Quran listening limit reached.',
              code: 'QURAN_DAILY_LIMIT_REACHED',
            },
          };
        }
      }

      const key = `${child.id}__${story.id}`;
      const nowIso = new Date().toISOString();
      const totalScenes = Math.max(1, story.scenes.length);
      const safeSceneIndex = Math.max(
        0,
        Math.min(totalScenes - 1, Math.round(Number(body.sceneIndex ?? 0))),
      );

      const legacyPrev = db.quranStoryProgress![key];
      const existing = db.quranStoryDetails![key];

      const scenesCompleted = new Set<string>(existing?.scenesCompleted || []);
      if (typeof body.sceneId === 'string' && story.scenes.some((sc) => sc.id === body.sceneId)) {
        scenesCompleted.add(body.sceneId);
      }

      const interactionsCompleted = new Set<string>(existing?.interactionsCompleted || []);
      if (typeof body.interactionId === 'string') {
        const validInteractionIds = new Set<string>(
          story.scenes.map((sc) => sc.activity?.id).filter((id): id is string => Boolean(id)),
        );
        validInteractionIds.add(`${story.id}:closing-quiz`);
        validInteractionIds.add(`${story.id}:closing-activity`);
        const cleanInteraction = sanitizeShortText(body.interactionId, 80);
        if (validInteractionIds.has(cleanInteraction)) {
          interactionsCompleted.add(cleanInteraction);
        }
      }

      const completionToken = body.completionToken
        ? sanitizeShortText(body.completionToken, 64)
        : undefined;
      const isDuplicateCompletion = Boolean(
        action === 'complete' &&
          completionToken &&
          existing?.lastCompletionToken === completionToken,
      );

      let completedCount = Math.max(existing?.completedCount || 0, legacyPrev?.completedCount || 0);
      if (action === 'complete' && !isDuplicateCompletion) {
        completedCount += 1;
      }

      const completed = Boolean(existing?.completed || action === 'complete' || completedCount > 0);
      const nextDetail: QuranStoryProgressDetails = {
        id: key,
        childId: child.id,
        storyId: story.id,
        startedAt: existing?.startedAt || legacyPrev?.lastReadAt || nowIso,
        lastSceneIndex:
          action === 'complete'
            ? totalScenes - 1
            : Math.max(0, safeSceneIndex),
        totalScenes,
        scenesCompleted: Array.from(scenesCompleted),
        listenedSeconds: Math.max(0, (existing?.listenedSeconds || 0) + secondsDelta),
        audioCompleted: Boolean(existing?.audioCompleted || body.audioCompleted),
        interactionsCompleted: Array.from(interactionsCompleted),
        quizCompleted: Boolean(existing?.quizCompleted || body.quizCompleted || action === 'complete'),
        closingActivityCompleted: Boolean(
          existing?.closingActivityCompleted || body.closingActivityCompleted || action === 'complete',
        ),
        completed,
        completedCount,
        completedAt:
          action === 'complete'
            ? existing?.completedAt || nowIso
            : existing?.completedAt,
        completionBadgeAwarded:
          completed ? existing?.completionBadgeAwarded || story.completionBadge.id : undefined,
        lastReadAt: nowIso,
        lastCompletionToken: completionToken || existing?.lastCompletionToken,
      };

      db.quranStoryDetails![key] = nextDetail;

      const nextLegacy: QuranStoryProgress = {
        id: key,
        childId: child.id,
        storyId: story.id,
        completedCount,
        lastReadAt: nowIso,
      };
      db.quranStoryProgress![key] = nextLegacy;

      if (secondsDelta > 0 || (action === 'complete' && !isDuplicateCompletion)) {
        const qEvent: QuranActivityEvent = {
          id: `qevt_${crypto.randomBytes(5).toString('hex')}`,
          childId: child.id,
          eventType: 'story',
          targetId: story.id,
          durationSeconds: secondsDelta > 0 ? secondsDelta : 20,
          ayahCount: 0,
          recordedByUserId: user.id,
          occurredAt: nowIso,
        };
        db.quranActivityEvents = [qEvent, ...(db.quranActivityEvents || [])].slice(0, 2000);
      }

      ensureChildFamilyAndGarden(db, child);
      if (action === 'complete' && !isDuplicateCompletion) {
        recordQuranActiveDay(child, {
          category: 'quran',
          title: story.title,
          detail: { ar: 'أتمّ حكاية تفاعلية من القرآن', en: 'Completed an interactive Quran story' },
        });
        awardGardenMilestoneIdempotent(db, child, {
          milestoneKey: `quran-story-${story.id}`,
          preferredItemId: 'garden-family-blossom',
          reason: {
            ar: `إتمام قصة «${story.title.ar}» في حكايات من القرآن`,
            en: `Completed Quran story “${story.title.en}”`,
          },
        });
      }

      return {
        status: 200,
        body: {
          storyProgress: nextLegacy,
          storyProgressDetails: nextDetail,
          summary: buildChildQuranSummary(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  }));

  // 5. Record Islamic Manner Practice
  app.post('/api/children/:id/quran/manner', requireAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child profile not found' } };
        return null;
      }
      if (!isQuranSchemaReady()) {
        return { status: 409, body: { error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' } };
      }
      if (db.featureFlags?.quranWorldEnabled === false) {
        return { status: 403, body: { error: 'Quran World is disabled.', code: 'FEATURE_DISABLED' } };
      }

      const settings = getEffectiveQuranChildSettings(db, child.id);
      if (!settings.enabled) {
        return { status: 403, body: { error: 'Quran World is disabled for this child.', code: 'QURAN_DISABLED_FOR_CHILD' } };
      }

      const mannerId = sanitizeShortText(req.body?.mannerId || '', 64);
      const manner = getQuranMannerById(mannerId);
      if (!manner) {
        return { status: 400, body: { error: 'Invalid Islamic manner identifier.' } };
      }

      const key = `${child.id}__${manner.id}`;
      const nowIso = new Date().toISOString();
      const prev = db.quranMannerProgress![key];
      const next: QuranMannerProgress = {
        id: key,
        childId: child.id,
        mannerId: manner.id,
        practicedCount: (prev?.practicedCount || 0) + 1,
        lastPracticedAt: nowIso,
      };
      db.quranMannerProgress![key] = next;

      const qEvent: QuranActivityEvent = {
        id: `qevt_${crypto.randomBytes(5).toString('hex')}`,
        childId: child.id,
        eventType: 'manner',
        targetId: manner.id,
        durationSeconds: 15,
        ayahCount: 0,
        recordedByUserId: req.authSession!.user.id,
        occurredAt: nowIso,
      };
      db.quranActivityEvents = [qEvent, ...(db.quranActivityEvents || [])].slice(0, 2000);

      ensureChildFamilyAndGarden(db, child);
      recordQuranActiveDay(child, {
        category: 'quran',
        title: manner.title,
        detail: { ar: `تطبيق أدب إسلامي جميل: ${manner.phraseAr}`, en: `Practiced daily manner: ${manner.transliteration}` },
      });

      awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: 'quran-kind-manners',
        preferredItemId: 'garden-family-blossom',
        reason: { ar: 'ممارسة أدب إسلامي جميل اليوم', en: 'Practiced a kind Islamic manner today' },
      });

      return {
        status: 200,
        body: {
          mannerProgress: next,
          summary: buildChildQuranSummary(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  }));

  // 6. Parent-Gated Quran Settings Update (Parent / Authorized Guardian Only)
  app.put('/api/children/:id/quran/settings', requireAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;

    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child profile not found' } };
        return null;
      }

      if (!isQuranSchemaReady()) {
        return { status: 409, body: { error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' } };
      }

      const user = req.authSession!.user;
      if (!canUserAccessChild(db, user, child, 'manage_learning_settings')) {
        return {
          status: 403,
          body: { error: 'Forbidden: manage_learning_settings permission required.', code: 'GUARDIAN_PERMISSION_DENIED' },
        };
      }

      const current = getEffectiveQuranChildSettings(db, child.id);
      const body = (req.body || {}) as Partial<QuranChildSettings>;

      const nextAllowed = Array.isArray(body.allowedSurahIds)
        ? body.allowedSurahIds.filter((id) => typeof id === 'string' && VALID_SURAH_ID_SET.has(id))
        : current.allowedSurahIds;

      const rawOrder = Array.isArray(body.surahOrder)
        ? body.surahOrder.filter((id) => typeof id === 'string' && VALID_SURAH_ID_SET.has(id))
        : current.surahOrder;
      const dedupOrder = Array.from(new Set(rawOrder));
      for (const id of DEFAULT_ALLOWED_SURAH_IDS) {
        if (!dedupOrder.includes(id)) dedupOrder.push(id);
      }

      const normalizedReciter = normalizeReciterIdInput(body.preferredReciterId);
      const preferredReciterId =
        normalizedReciter && VALID_RECITER_ID_SET.has(normalizedReciter)
          ? normalizedReciter
          : current.preferredReciterId;

      const nowIso = new Date().toISOString();
      const updated: QuranChildSettings = {
        childId: child.id,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
        allowedSurahIds: nextAllowed.length > 0 ? Array.from(new Set(nextAllowed)) : current.allowedSurahIds,
        surahOrder: dedupOrder,
        preferredReciterId,
        preferChildReciterFallback:
          typeof body.preferChildReciterFallback === 'boolean'
            ? body.preferChildReciterFallback
            : current.preferChildReciterFallback,
        repeatCount:
          body.repeatCount !== undefined ? clampQuranRepeatCount(body.repeatCount, current.repeatCount) : current.repeatCount,
        listenOnlyMode: typeof body.listenOnlyMode === 'boolean' ? body.listenOnlyMode : current.listenOnlyMode,
        dailyMaxMinutes:
          body.dailyMaxMinutes !== undefined
            ? clampQuranDailyMinutes(body.dailyMaxMinutes, current.dailyMaxMinutes)
            : current.dailyMaxMinutes,
        gentleReminderEnabled:
          typeof body.gentleReminderEnabled === 'boolean'
            ? body.gentleReminderEnabled
            : current.gentleReminderEnabled,
        updatedByUserId: user.id,
        updatedAt: nowIso,
      };
      db.quranChildSettings![child.id] = updated;

      if (child.familyId) {
        recordFamilyEvent(db, {
          familyId: child.familyId,
          category: 'learning',
          actionType: 'QURAN_SETTINGS_UPDATED',
          actorId: user.id,
          actorName: user.displayName,
          actorRole: user.role,
          childId: child.id,
          childName: child.displayName,
          title: { ar: 'تحديث إعدادات عالم القرآن الكريم', en: 'Quran World settings updated' },
          description: {
            ar: `حدّث ${user.displayName} إعدادات عالم القرآن للطفل ${child.displayName} (مفعّل=${updated.enabled}، الحد اليومي=${updated.dailyMaxMinutes} د)`,
            en: `${user.displayName} updated Quran World settings for ${child.displayName} (enabled=${updated.enabled}, max=${updated.dailyMaxMinutes}m)`,
          },
          ip: getClientIp(req),
        });
      }

      return {
        status: 200,
        body: {
          settings: updated,
          summary: buildChildQuranSummary(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  }));

  // 7. Parent-Only Explicit Memorization Confirmation (Parent Gate + approve_content)
  app.post('/api/children/:id/quran/memorization-confirm', requireAuth, asyncRoute(async (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;

    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child profile not found' } };
        return null;
      }

      if (!isQuranSchemaReady()) {
        return { status: 409, body: { error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' } };
      }

      const user = req.authSession!.user;
      if (!canUserAccessChild(db, user, child, 'approve_content')) {
        return {
          status: 403,
          body: { error: 'Forbidden: approve_content permission required to confirm memorization.', code: 'GUARDIAN_PERMISSION_DENIED' },
        };
      }

      const body = (req.body || {}) as {
        surahId?: string;
        confirmed?: boolean;
        parentNote?: string;
      };

      const surahId = sanitizeShortText(body.surahId || '', 32);
      const surah = getQuranSurahById(surahId);
      if (!surah) {
        return { status: 400, body: { error: 'Invalid Surah identifier.' } };
      }

      const confirmed = Boolean(body.confirmed);
      const cleanNote = body.parentNote !== undefined ? sanitizeQuranNote(body.parentNote, 280) : undefined;
      const key = `${child.id}__${surah.id}`;
      const prev = db.quranSurahProgress![key];
      const nowIso = new Date().toISOString();

      const naturalStatus = computeNaturalSurahStatus(
        prev?.listenCount || 0,
        prev?.repeatSessionsCount || 0,
        (prev?.ayahsPracticed || []).length,
        surah.ayahCount,
      );

      const updated: QuranSurahProgress = {
        id: key,
        childId: child.id,
        surahId: surah.id,
        listenCount: prev?.listenCount || 0,
        repeatSessionsCount: prev?.repeatSessionsCount || 0,
        ayahsPracticed: prev?.ayahsPracticed || [],
        status: confirmed ? 'parent_confirmed' : naturalStatus,
        parentConfirmedMemorization: confirmed,
        parentConfirmedAt: confirmed ? nowIso : undefined,
        parentConfirmedByUserId: confirmed ? user.id : undefined,
        parentNote: cleanNote !== undefined ? cleanNote || undefined : prev?.parentNote,
        lastListenedAt: prev?.lastListenedAt,
        updatedAt: nowIso,
      };
      db.quranSurahProgress![key] = updated;

      const qEvent: QuranActivityEvent = {
        id: `qevt_${crypto.randomBytes(5).toString('hex')}`,
        childId: child.id,
        eventType: 'parent_confirm',
        targetId: surah.id,
        durationSeconds: 0,
        ayahCount: surah.ayahCount,
        recordedByUserId: user.id,
        occurredAt: nowIso,
      };
      db.quranActivityEvents = [qEvent, ...(db.quranActivityEvents || [])].slice(0, 2000);

      if (child.familyId) {
        recordFamilyEvent(db, {
          familyId: child.familyId,
          category: 'learning',
          actionType: confirmed ? 'QURAN_MEMORIZATION_CONFIRMED' : 'QURAN_MEMORIZATION_UNCONFIRMED',
          actorId: user.id,
          actorName: user.displayName,
          actorRole: user.role,
          childId: child.id,
          childName: child.displayName,
          title: confirmed
            ? { ar: `اعتماد حفظ ${surah.nameAr} بواسطة ولي الأمر`, en: `Parent confirmed ${surah.nameEn} memorization` }
            : { ar: `إلغاء اعتماد حفظ ${surah.nameAr}`, en: `Parent cleared ${surah.nameEn} confirmation` },
          description: {
            ar: confirmed
              ? `أكّد ${user.displayName} حفظ الطفل ${child.displayName} لسورة ${surah.nameAr}`
              : `أعاد ${user.displayName} حالة حفظ ${surah.nameAr} للمتابعة المستمرة`,
            en: confirmed
              ? `${user.displayName} confirmed ${child.displayName} memorized ${surah.nameEn}`
              : `${user.displayName} reset parent memorization confirmation for ${surah.nameEn}`,
          },
          ip: getClientIp(req),
        });
      }

      return {
        status: 200,
        body: {
          progress: updated,
          summary: buildChildQuranSummary(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  }));

  // 8. Admin Provenance & Recitation Verification Registry (manage_lessons RBAC)
  app.get('/api/admin/quran/verifications', requireAdminPermission('manage_lessons'), (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const db = getDb();
    ensureFamilyCollections(db);
    const phraseAssets = getPhraseAssetConfigs(db);
    const releaseReadiness = buildReleaseReadinessSummary(db);
    return res.json({
      quranSchemaReady: isQuranSchemaReady(),
      surahTexts: QURAN_SURAHS.map((s) => ({
        contentKey: s.id,
        contentType: 'surah_text' as const,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        ayahCount: s.ayahCount,
        textSource: s.textSource,
        textSourceUrl: s.textSourceUrl,
        textSha256: s.textSha256,
        verificationStatus: s.textVerificationStatus,
      })),
      reciters: mergeRecitersWithVerifications(db),
      phraseAssets,
      releaseReadiness,
      basmalaCandidate: getBasmalaCandidateInfo(db),
      customRecords: Object.values(db.quranContentVerifications || {}),
      licenseAndAttribution: QURAN_FOUNDATION_LICENSE_INFO,
      compliancePolicy: {
        termsUpdatedDate: '2026-11-20',
        maxServerCacheDays: MAX_QF_SERVER_CACHE_DAYS,
        testingCacheTtlMinutes: Math.round(TESTING_AUDIO_CACHE_TTL_MS / 60_000),
        directStreamingOnly: true,
        rehostingProhibited: true,
        rawUrlPackageExposed: false,
        requiredAttribution: 'Quran data provided by Quran.Foundation.',
        commercialEndUserUsePermitted: true,
        standaloneRedistributionAllowed: false,
        paidApiLicenseRequired: false,
        closingPhraseStatus: phraseAssets.closing.status,
        basmalaStatus: phraseAssets.basmala.status,
        familyAccessEnabled: releaseReadiness.familyAccessEnabled,
        privacyPolicyUrl: '/privacy',
        termsOfUseUrl: '/terms',
      },
    });
  });

  // 8a-1. Persist Individual Administrator Confirmation (manage_lessons RBAC + Atomic PG Lock)
  app.put('/api/admin/quran/release-confirmations/:confirmationKey', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isQuranSchemaReady()) {
      return res.status(409).json({
        error: 'Quran World PostgreSQL tables are pending additive migration 0002_quran_world.sql. Confirmations cannot be persisted until migration 0002_quran_world.sql is applied.',
        code: 'QURAN_SCHEMA_PENDING',
      });
    }
    if (!req.authSession?.user) {
      return res.status(401).json({
        error:
          'Authenticated administrator session with manage_lessons permission is required to confirm or revoke release compliance requirements.',
        code: 'ADMIN_SESSION_REQUIRED',
      });
    }
    const rawConfKey = sanitizeShortText(req.params.confirmationKey || '', 64);
    const allowedConfKeys = new Set([
      'qfDeveloperTermsAndCommercialUse',
      'qfAttributionAndReciterCredit',
      'sevenDayCachePolicy',
      'privacyAndTermsReadiness',
    ] as const);
    type EditableConfKey =
      | 'qfDeveloperTermsAndCommercialUse'
      | 'qfAttributionAndReciterCredit'
      | 'sevenDayCachePolicy'
      | 'privacyAndTermsReadiness';

    if (!allowedConfKeys.has(rawConfKey as EditableConfKey)) {
      return res.status(404).json({ error: 'Unknown Quran release confirmation key.', code: 'UNKNOWN_CONFIRMATION_KEY' });
    }
    const confKey = rawConfKey as EditableConfKey;

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Request body must be a JSON object containing boolean "confirmed".',
        code: 'INVALID_CONFIRMATION_PAYLOAD',
      });
    }
    const body = req.body as { confirmed?: unknown; policyVersion?: unknown };
    if (typeof body.confirmed !== 'boolean') {
      return res.status(400).json({
        error: 'Request body must include boolean "confirmed" (true or false).',
        code: 'INVALID_CONFIRMATION_VALUE',
      });
    }
    const confirmed = body.confirmed;
    const customPolicyVersion =
      typeof body.policyVersion === 'string' && body.policyVersion.trim()
        ? sanitizeShortText(body.policyVersion.trim(), 64)
        : ADMIN_CONFIRMATION_POLICY_VERSIONS[confKey];

    const actorUser = req.authSession.user;
    const actorUserId = actorUser.id;
    const actorName = sanitizeShortText(
      actorUser.displayName || actorUser.email || actorUserId,
      120,
    );

    try {
      const outcome = await runWithPgDbLock('quran-release-approval', async (db) => {
        ensureFamilyCollections(db);
        const reciterId = HUSARY_MURATTAL_SPEC.reciterId;
        const reciter = getQuranReciterById(reciterId)!;
        const prevRecord = db.quranContentVerifications?.[reciterId];
        const nowIso = new Date().toISOString();

        const hydratedPrev = hydrateConfirmations(prevRecord?.adminConfirmations);
        const updatedItem: QuranConfirmationItemRecord = confirmed
          ? {
              confirmed: true,
              confirmedBy: actorName,
              confirmedByUserId: actorUserId,
              confirmedAt: nowIso,
              policyVersion: customPolicyVersion,
            }
          : { confirmed: false };

        const nextConfirmations: QuranAdminConfirmations = {
          ...hydratedPrev,
          [confKey]: updatedItem,
        };
        const bothTermsAndCredit =
          nextConfirmations.qfDeveloperTermsAndCommercialUse.confirmed &&
          nextConfirmations.qfAttributionAndReciterCredit.confirmed;
        nextConfirmations.qfAttributionAndTerms = {
          confirmed: bothTermsAndCredit,
          ...(bothTermsAndCredit
            ? {
                confirmedBy: actorName,
                confirmedByUserId: actorUserId,
                confirmedAt: nowIso,
                policyVersion: nextConfirmations.qfDeveloperTermsAndCommercialUse.policyVersion,
              }
            : {}),
        };

        const all4Confirmed =
          bothTermsAndCredit &&
          nextConfirmations.sevenDayCachePolicy.confirmed &&
          nextConfirmations.privacyAndTermsReadiness.confirmed;

        // Fail-closed: revoking any mandatory confirmation automatically moves verification back to pending_verification
        const nextVerificationStatus: QuranVerificationStatus =
          !all4Confirmed && prevRecord?.verificationStatus === 'verified'
            ? 'pending_verification'
            : prevRecord?.verificationStatus || 'pending_verification';

        const record: QuranContentVerificationRecord = {
          id: prevRecord?.id || `qver_${reciterId}`,
          contentType: 'reciter_audio',
          contentKey: reciterId,
          sourceName: prevRecord?.sourceName || reciter.sourceName,
          licenseOrPermission: prevRecord?.licenseOrPermission || reciter.licenseOrPermission,
          textIntegrityConfirmed: prevRecord?.textIntegrityConfirmed,
          audioIntegrityConfirmed: prevRecord?.audioIntegrityConfirmed,
          reciterIdentityConfirmed: prevRecord?.reciterIdentityConfirmed,
          licenseTermsConfirmed: all4Confirmed,
          licenseConfirmedBy: all4Confirmed ? actorName : undefined,
          licenseConfirmedAt: all4Confirmed ? nowIso : undefined,
          adminConfirmations: nextConfirmations,
          sourceVerification: prevRecord?.sourceVerification,
          basmalaCandidateProbe: prevRecord?.basmalaCandidateProbe,
          verificationStatus: nextVerificationStatus,
          audioUrlsJson: prevRecord?.audioUrlsJson,
          ayahAudioUrlsJson: prevRecord?.ayahAudioUrlsJson,
          notes: prevRecord?.notes,
          updatedByUserId: actorUserId,
          updatedAt: nowIso,
        };
        db.quranContentVerifications![reciterId] = record;

        recordAuditEvent(db, {
          eventType: 'CONTENT_REVIEW',
          actorId: actorUserId,
          actorRole: actorUser.role,
          actionType: 'QURAN_ADMIN_CONFIRMATION_UPDATED',
          recordType: 'quran_content_verification',
          recordId: reciterId,
          newValue: {
            confirmationKey: confKey,
            confirmed,
            policyVersion: updatedItem.policyVersion,
            verificationStatus: record.verificationStatus,
          },
          summary: `Updated Quran release confirmation ${confKey}=${confirmed} by ${actorName}`,
          ip: getClientIp(req),
        });

        const releaseReadiness = buildReleaseReadinessSummary(db);
        if (releaseReadiness.confirmations[confKey]?.confirmed !== confirmed) {
          throw new Error(`Release confirmation ${confKey} state did not match expected persisted value.`);
        }

        return {
          status: 200,
          body: {
            ok: true,
            persisted: true,
            confirmationKey: confKey,
            confirmation: updatedItem,
            verification: record,
            confirmations: nextConfirmations,
            releaseReadiness,
          },
        };
      });

      if (!outcome) {
        return res.status(503).json({
          error: 'Database lock did not return a persisted confirmation result.',
          code: 'QURAN_CONFIRMATION_PERSISTENCE_FAILED',
        });
      }

      return res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error('[QuranReleaseConfirmation] Persistence failed:', err);
      return res.status(503).json({
        error:
          err instanceof Error
            ? `Failed to persist confirmation (${confKey}): ${err.message}`
            : `Failed to persist confirmation (${confKey}) to database.`,
        code: 'QURAN_CONFIRMATION_PERSISTENCE_FAILED',
      });
    }
  }));

  // 8a-2. Evaluate Verifiable Provider Metadata, SHA-256 Text Integrity, and 49 Audio URLs (Never Auto-Confirms or Auto-Publishes)
  app.post('/api/admin/quran/source-verification/evaluate', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isQuranSchemaReady()) {
      return res.status(409).json({ error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' });
    }

    const body = (req.body || {}) as {
      refreshFromQf?: boolean;
      audioUrlsJson?: Record<string, string>;
      ayahAudioUrlsJson?: Record<string, string>;
    };

    const existingDb = getDb();
    ensureFamilyCollections(existingDb);
    const existingRecord = existingDb.quranContentVerifications?.[HUSARY_MURATTAL_SPEC.reciterId];
    const existingMaps = extractValidReciterUrlMaps(existingRecord);

    let nextSurahAudioUrls: Record<string, string> = { ...existingMaps.surahAudioUrls };
    let nextAyahAudioUrls: Record<string, string> = { ...existingMaps.ayahAudioUrls };

    if (body.audioUrlsJson && typeof body.audioUrlsJson === 'object') {
      const cleaned: Record<string, string> = {};
      for (const [surahId, rawUrl] of Object.entries(body.audioUrlsJson)) {
        if (!VALID_SURAH_ID_SET.has(surahId)) continue;
        const normalizedUrl = normalizeQuranAudioUrl(rawUrl);
        if (!normalizedUrl || !isAllowedQuranFoundationAudioHost(normalizedUrl)) {
          return res.status(400).json({
            error: `Unsafe or non-Quran-Foundation Surah audio URL for ${surahId}.`,
          });
        }
        cleaned[surahId] = normalizedUrl;
      }
      nextSurahAudioUrls = cleaned;
    }

    if (body.ayahAudioUrlsJson && typeof body.ayahAudioUrlsJson === 'object') {
      const cleaned: Record<string, string> = {};
      for (const [verseKey, rawUrl] of Object.entries(body.ayahAudioUrlsJson)) {
        if (!/^\d{1,3}:\d{1,3}$/.test(verseKey)) continue;
        const normalizedUrl = normalizeQuranAudioUrl(rawUrl);
        if (!normalizedUrl || !isAllowedQuranFoundationAudioHost(normalizedUrl)) {
          return res.status(400).json({
            error: `Unsafe or non-Quran-Foundation Ayah audio URL for ${verseKey}.`,
          });
        }
        cleaned[verseKey] = normalizedUrl;
      }
      nextAyahAudioUrls = cleaned;
    }

    const chapterNumbers = QURAN_SURAHS.map((s) => s.number);
    const needFetchFromQf =
      body.refreshFromQf === true ||
      Object.keys(nextSurahAudioUrls).length < QURAN_SURAHS.length ||
      Object.keys(nextAyahAudioUrls).length < 40 ||
      existingRecord?.sourceVerification?.providerMetadataVerified !== true;

    let providerMetadataVerified =
      existingRecord?.sourceVerification?.providerMetadataVerified === true;
    let reciterStyle = 'Murattal';
    let reciterRiwayah = "Hafs 'an Asim";
    let fetchError: string | undefined;

    if (needFetchFromQf) {
      let fetchedViaOAuth = false;
      if (isQuranFoundationConfigured()) {
        const oauthPreview = await fetchHusaryRecitationMetadata(chapterNumbers);
        if (
          oauthPreview.diagnostics.reciterCheck?.verifiedHusaryId6 &&
          Object.keys(oauthPreview.surahAudioUrls).length > 0
        ) {
          fetchedViaOAuth = true;
          providerMetadataVerified = true;
          reciterStyle =
            oauthPreview.diagnostics.reciterCheck.chapterReciter?.style || 'Murattal';
          reciterRiwayah =
            oauthPreview.diagnostics.reciterCheck.chapterReciter?.qirat || "Hafs 'an Asim";
          if (!body.audioUrlsJson) {
            nextSurahAudioUrls = { ...oauthPreview.surahAudioUrls };
          }
          if (!body.ayahAudioUrlsJson) {
            nextAyahAudioUrls = { ...oauthPreview.ayahAudioUrls };
          }
        }
      }

      if (!fetchedViaOAuth) {
        const publicQf = await fetchPublicQuranFoundationReciter6Data(chapterNumbers);
        providerMetadataVerified = publicQf.providerMetadataVerified;
        reciterStyle = publicQf.recitationStyle || 'Murattal';
        reciterRiwayah = publicQf.riwayah || "Hafs 'an Asim";
        if (publicQf.error) {
          fetchError = publicQf.error;
        }
        if (!body.audioUrlsJson && Object.keys(publicQf.surahAudioUrls).length > 0) {
          nextSurahAudioUrls = { ...publicQf.surahAudioUrls };
        }
        if (!body.ayahAudioUrlsJson && Object.keys(publicQf.ayahAudioUrls).length > 0) {
          nextAyahAudioUrls = { ...publicQf.ayahAudioUrls };
        }
      }
    }

    const localTextCheck = verifyLocalCatalogSha256Integrity();
    const audioCoverage = await validateQuranAudioCoverage({
      surahAudioUrls: nextSurahAudioUrls,
      ayahAudioUrls: nextAyahAudioUrls,
      curatedChapterNumbers: chapterNumbers,
    });
    const urlSetHash = computeAudioUrlSetHash(nextSurahAudioUrls, nextAyahAudioUrls);
    const totalExpectedAudio = QURAN_SURAHS.length + localTextCheck.totalAyahsCount;
    const basmala1to1Url = nextAyahAudioUrls['1:1'];
    const basmalaProbe = basmala1to1Url ? await probePlayableAudioUrl(basmala1to1Url) : null;

    const outcome = await runWithPgDbLock('quran-release-approval', async (db) => {
      ensureFamilyCollections(db);
      const reciterId = HUSARY_MURATTAL_SPEC.reciterId;
      const reciter = getQuranReciterById(reciterId)!;
      const prevRecord = db.quranContentVerifications?.[reciterId];
      const nowIso = new Date().toISOString();
      const actorUserId = req.authSession?.user.id;
      const prevSv = prevRecord?.sourceVerification;

      // Invalidate any prior confirmation if the underlying URL set changed or technical checks failed
      const allTechnicalNowOk =
        providerMetadataVerified &&
        localTextCheck.allMatched &&
        audioCoverage.status === 'passed';
      const keepExistingConfirm =
        Boolean(prevSv?.confirmed) &&
        prevSv?.status === 'confirmed' &&
        prevSv?.urlSetHash === urlSetHash &&
        allTechnicalNowOk;

      const audioProbeError =
        fetchError ||
        (audioCoverage.invalidResources.length > 0
          ? audioCoverage.invalidResources
              .slice(0, 3)
              .map((inv) => `${inv.targetKey}: ${inv.reason}`)
              .join('; ')
          : audioCoverage.duplicateUrls.length > 0
            ? `${audioCoverage.duplicateUrls.length} duplicate URLs detected`
            : undefined);

      const nextSourceVerification: QuranSourceVerificationRecord = {
        status: keepExistingConfirm
          ? 'confirmed'
          : prevSv?.status === 'revoked' && !allTechnicalNowOk
            ? 'revoked'
            : 'pending',
        confirmed: keepExistingConfirm,
        ...(keepExistingConfirm
          ? {
              confirmedBy: prevSv?.confirmedBy,
              confirmedByUserId: prevSv?.confirmedByUserId,
              confirmedAt: prevSv?.confirmedAt,
            }
          : {}),
        provider: 'Quran Foundation',
        reciterId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
        reciterIdentity: 'Sheikh Mahmoud Khalil Al-Husary',
        recitationStyle: reciterStyle,
        riwayah: reciterRiwayah,
        evidenceVersion: SOURCE_VERIFICATION_EVIDENCE_VERSION,
        evaluatedAt: nowIso,
        urlSetHash,
        providerMetadataVerified,
        textSha256VerifiedCount: localTextCheck.verifiedSurahsCount,
        textSha256TotalCount: localTextCheck.totalSurahsCount,
        textAyahsVerifiedCount: localTextCheck.verifiedAyahsCount,
        surahUrlsPresentCount: Object.keys(nextSurahAudioUrls).length,
        ayahUrlsPresentCount: Object.keys(nextAyahAudioUrls).length,
        audioProbePassedCount:
          audioCoverage.playableSurahCount + audioCoverage.playableAyahCount,
        audioProbeTotalCount: totalExpectedAudio,
        audioProbeInvalidCount: audioCoverage.invalidResources.length,
        audioProbeDuplicateCount: audioCoverage.duplicateUrls.length,
        ...(audioProbeError ? { audioProbeError } : {}),
        statusMessage: keepExistingConfirm
          ? SOURCE_VERIFICATION_STATUS_TEXT
          : 'Reciter & Recitation Source evaluation completed — awaiting explicit administrator confirmation.',
      };

      const nextVerificationStatus: QuranVerificationStatus =
        !keepExistingConfirm && prevRecord?.verificationStatus === 'verified'
          ? 'pending_verification'
          : prevRecord?.verificationStatus || 'pending_verification';

      const record: QuranContentVerificationRecord = {
        id: prevRecord?.id || `qver_${reciterId}`,
        contentType: 'reciter_audio',
        contentKey: reciterId,
        sourceName: prevRecord?.sourceName || reciter.sourceName,
        licenseOrPermission: prevRecord?.licenseOrPermission || reciter.licenseOrPermission,
        textIntegrityConfirmed: localTextCheck.allMatched,
        audioIntegrityConfirmed: audioCoverage.status === 'passed',
        reciterIdentityConfirmed: providerMetadataVerified,
        licenseTermsConfirmed: prevRecord?.licenseTermsConfirmed,
        licenseConfirmedBy: prevRecord?.licenseConfirmedBy,
        licenseConfirmedAt: prevRecord?.licenseConfirmedAt,
        adminConfirmations: prevRecord?.adminConfirmations,
        sourceVerification: nextSourceVerification,
        basmalaCandidateProbe: basmalaProbe || prevRecord?.basmalaCandidateProbe,
        verificationStatus: nextVerificationStatus,
        audioUrlsJson:
          Object.keys(nextSurahAudioUrls).length > 0 ? nextSurahAudioUrls : prevRecord?.audioUrlsJson,
        ayahAudioUrlsJson:
          Object.keys(nextAyahAudioUrls).length > 0 ? nextAyahAudioUrls : prevRecord?.ayahAudioUrlsJson,
        notes: prevRecord?.notes,
        updatedByUserId: actorUserId,
        updatedAt: nowIso,
      };
      db.quranContentVerifications![reciterId] = record;

      recordAuditEvent(db, {
        eventType: 'CONTENT_REVIEW',
        actorId: actorUserId || 'admin',
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'QURAN_SOURCE_VERIFICATION_EVALUATED',
        recordType: 'quran_content_verification',
        recordId: reciterId,
        newValue: {
          providerMetadataVerified,
          textSha256VerifiedCount: localTextCheck.verifiedSurahsCount,
          surahUrlsCount: Object.keys(nextSurahAudioUrls).length,
          ayahUrlsCount: Object.keys(nextAyahAudioUrls).length,
          audioProbePassedCount: audioCoverage.playableSurahCount + audioCoverage.playableAyahCount,
          audioProbeTotalCount: totalExpectedAudio,
          invalidCount: audioCoverage.invalidResources.length,
        },
        summary: `Evaluated QF Reciter ID 6 source & 49 audio URLs (passed=${audioCoverage.playableSurahCount + audioCoverage.playableAyahCount}/${totalExpectedAudio})`,
        ip: getClientIp(req),
      });

      const releaseReadiness = buildReleaseReadinessSummary(db);
      return {
        status: 200,
        body: {
          evaluationPassed: allTechnicalNowOk,
          audioCoverage,
          localTextCheck,
          verification: record,
          reciters: mergeRecitersWithVerifications(db),
          basmalaCandidate: getBasmalaCandidateInfo(db),
          releaseReadiness,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  // 8a-3. Explicit Administrator Action: Confirm or Revoke Reciter & Recitation Source
  // Requires authenticated administrator session with manage_lessons permission.
  app.put('/api/admin/quran/source-verification', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isQuranSchemaReady()) {
      return res.status(409).json({ error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' });
    }
    if (!req.authSession?.user) {
      return res.status(401).json({
        error: 'Authenticated administrator session with manage_lessons permission is required to confirm or revoke Reciter & Recitation Source Verification.',
      });
    }

    const body = (req.body || {}) as { confirmed?: boolean };
    const confirmed = body.confirmed === true;
    const actorUser = req.authSession.user;
    const actorUserId = actorUser.id;
    const actorName = sanitizeShortText(
      actorUser.displayName || actorUser.email || actorUserId,
      120,
    );

    const outcome = await runWithPgDbLock('quran-release-approval', async (db) => {
      ensureFamilyCollections(db);
      const reciterId = HUSARY_MURATTAL_SPEC.reciterId;
      const reciter = getQuranReciterById(reciterId)!;
      const prevRecord = db.quranContentVerifications?.[reciterId];
      const nowIso = new Date().toISOString();
      const svState = buildSourceVerificationState(db);

      if (confirmed && !svState.checklistPassed) {
        const failedOrPending = svState.checklist
          .filter((item) => item.status !== 'passed')
          .map((item) => `${item.order}. ${item.labelEn} (${item.status})`);
        return {
          status: 400,
          body: {
            error: `Cannot confirm Reciter & Recitation Source until all 8 verification checks pass with live evidence: ${failedOrPending.join(', ')}.`,
            releaseReadiness: buildReleaseReadinessSummary(db),
          },
        };
      }

      const nextSourceVerification: QuranSourceVerificationRecord = confirmed
        ? {
            ...svState.sourceVerification,
            status: 'confirmed',
            confirmed: true,
            confirmedBy: actorName,
            confirmedByUserId: actorUserId,
            confirmedAt: nowIso,
            revokedBy: undefined,
            revokedByUserId: undefined,
            revokedAt: undefined,
            provider: 'Quran Foundation',
            reciterId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
            reciterIdentity: 'Sheikh Mahmoud Khalil Al-Husary',
            recitationStyle: prevRecord?.sourceVerification?.recitationStyle || 'Murattal',
            riwayah: prevRecord?.sourceVerification?.riwayah || "Hafs 'an Asim",
            evidenceVersion: SOURCE_VERIFICATION_EVIDENCE_VERSION,
            statusMessage: SOURCE_VERIFICATION_STATUS_TEXT,
          }
        : {
            ...svState.sourceVerification,
            status: 'revoked',
            confirmed: false,
            confirmedBy: undefined,
            confirmedByUserId: undefined,
            confirmedAt: undefined,
            revokedBy: actorName,
            revokedByUserId: actorUserId,
            revokedAt: nowIso,
            provider: 'Quran Foundation',
            reciterId: HUSARY_MURATTAL_SPEC.quranFoundationChapterReciterId,
            reciterIdentity: 'Sheikh Mahmoud Khalil Al-Husary',
            recitationStyle: prevRecord?.sourceVerification?.recitationStyle || 'Murattal',
            riwayah: prevRecord?.sourceVerification?.riwayah || "Hafs 'an Asim",
            evidenceVersion: SOURCE_VERIFICATION_EVIDENCE_VERSION,
            statusMessage:
              'Reciter & Recitation Source Verification was revoked by an administrator. Family audio access is blocked.',
          };

      // Fail-closed: revoking Reciter & Recitation Source Verification immediately blocks family audio access
      const nextVerificationStatus: QuranVerificationStatus = confirmed
        ? prevRecord?.verificationStatus || 'pending_verification'
        : 'pending_verification';

      const record: QuranContentVerificationRecord = {
        id: prevRecord?.id || `qver_${reciterId}`,
        contentType: 'reciter_audio',
        contentKey: reciterId,
        sourceName: prevRecord?.sourceName || reciter.sourceName,
        licenseOrPermission: prevRecord?.licenseOrPermission || reciter.licenseOrPermission,
        textIntegrityConfirmed: svState.textIntegrityVerified,
        audioIntegrityConfirmed: svState.audioTechnicalIntegrityVerified,
        reciterIdentityConfirmed: svState.sourceVerification.providerMetadataVerified === true,
        licenseTermsConfirmed: prevRecord?.licenseTermsConfirmed,
        licenseConfirmedBy: prevRecord?.licenseConfirmedBy,
        licenseConfirmedAt: prevRecord?.licenseConfirmedAt,
        adminConfirmations: prevRecord?.adminConfirmations,
        sourceVerification: nextSourceVerification,
        basmalaCandidateProbe: prevRecord?.basmalaCandidateProbe,
        verificationStatus: nextVerificationStatus,
        audioUrlsJson: prevRecord?.audioUrlsJson,
        ayahAudioUrlsJson: prevRecord?.ayahAudioUrlsJson,
        notes: prevRecord?.notes,
        updatedByUserId: actorUserId,
        updatedAt: nowIso,
      };
      db.quranContentVerifications![reciterId] = record;

      recordAuditEvent(db, {
        eventType: 'CONTENT_REVIEW',
        actorId: actorUserId,
        actorRole: actorUser.role,
        actionType: confirmed
          ? 'QURAN_SOURCE_VERIFICATION_CONFIRMED'
          : 'QURAN_SOURCE_VERIFICATION_REVOKED',
        recordType: 'quran_content_verification',
        recordId: reciterId,
        newValue: {
          status: nextSourceVerification.status,
          confirmedBy: nextSourceVerification.confirmedBy,
          confirmedByUserId: nextSourceVerification.confirmedByUserId,
          confirmedAt: nextSourceVerification.confirmedAt,
          revokedAt: nextSourceVerification.revokedAt,
          evidenceVersion: nextSourceVerification.evidenceVersion,
          verificationStatus: record.verificationStatus,
        },
        summary: confirmed
          ? `Confirmed Reciter & Recitation Source Verification (ID 6, ${nextSourceVerification.evidenceVersion}) by ${actorName}`
          : `Revoked Reciter & Recitation Source Verification by ${actorName} (family access blocked)`,
        ip: getClientIp(req),
      });

      return {
        status: 200,
        body: {
          sourceVerification: nextSourceVerification,
          verification: record,
          reciters: mergeRecitersWithVerifications(db),
          releaseReadiness: buildReleaseReadinessSummary(db),
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  // 8a-4. Probe & Optionally Resolve Official QF Reciter ID 6 (1:1) Basmala Candidate URL (Never Auto-Approves)
  app.post('/api/admin/quran/basmala/probe', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isQuranSchemaReady()) {
      return res.status(409).json({ error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' });
    }

    const body = (req.body || {}) as {
      candidateUrl?: string;
      resolveAuthorizedSource?: boolean;
    };

    let requestedCandidate: string | null = null;
    if (typeof body.candidateUrl === 'string' && body.candidateUrl.trim()) {
      const normalized = normalizeQuranAudioUrl(body.candidateUrl.trim());
      if (!normalized || !isAllowedQuranFoundationAudioHost(normalized)) {
        return res.status(400).json({
          error: 'Candidate Basmala URL must be a valid HTTPS URL on an allowlisted Quran Foundation audio host.',
        });
      }
      requestedCandidate = normalized;
    }

    const snapshot = getDb();
    ensureFamilyCollections(snapshot);
    const currentInfo = getBasmalaCandidateInfo(snapshot);
    const initialUrl = requestedCandidate || currentInfo.audioUrl;
    const initialProbe = initialUrl ? await probePlayableAudioUrl(initialUrl) : null;

    let resolvedUrl: string | null = null;
    let resolvedProbe = null as Awaited<ReturnType<typeof probePlayableAudioUrl>> | null;
    let resolverError: string | undefined;

    if (body.resolveAuthorizedSource || !initialProbe?.ok || !initialProbe?.browserPlayable) {
      const qf1to1 = await fetchAuthorizedQfReciter6BasmalaUrl();
      if (qf1to1.url) {
        resolvedUrl = qf1to1.url;
        resolvedProbe = await probePlayableAudioUrl(qf1to1.url);
      } else {
        resolverError = qf1to1.error;
      }
    }

    const chosenUrl =
      body.resolveAuthorizedSource && resolvedProbe?.ok && resolvedProbe?.browserPlayable
        ? resolvedUrl
        : initialProbe?.ok && initialProbe?.browserPlayable
          ? initialUrl
          : initialUrl || resolvedUrl;
    const chosenProbe =
      body.resolveAuthorizedSource && resolvedProbe?.ok && resolvedProbe?.browserPlayable
        ? resolvedProbe
        : initialProbe?.ok && initialProbe?.browserPlayable
          ? initialProbe
          : initialProbe || resolvedProbe;

    const outcome = await runWithPgDbLock('quran-release-approval', async (db) => {
      ensureFamilyCollections(db);
      const nowIso = new Date().toISOString();
      const actorUserId = req.authSession?.user.id;
      const prevPhrase = db.quranContentVerifications?.['phrase:basmala'];
      const prevMeta = (prevPhrase?.audioUrlsJson || {}) as Record<string, string>;

      if (chosenUrl && chosenProbe) {
        const shouldUpdateUrlToAuthorized =
          Boolean(body.resolveAuthorizedSource && resolvedProbe?.ok && resolvedProbe?.browserPlayable);
        const storedUrl = shouldUpdateUrlToAuthorized
          ? resolvedUrl!
          : normalizeQuranAudioUrl(prevMeta.url) || chosenUrl;
        const storedProbe = shouldUpdateUrlToAuthorized
          ? resolvedProbe!
          : chosenProbe;

        const sameApprovedUrl =
          prevPhrase?.verificationStatus === 'verified' &&
          prevMeta.url === storedUrl &&
          storedProbe.ok &&
          storedProbe.browserPlayable;

        db.quranContentVerifications!['phrase:basmala'] = {
          id: prevPhrase?.id || 'qver_phrase_basmala',
          contentType: 'reciter_audio',
          contentKey: 'phrase:basmala',
          sourceName:
            prevPhrase?.sourceName || PHRASE_ASSET_DEFAULTS.basmala.defaultSourceName,
          licenseOrPermission:
            prevPhrase?.licenseOrPermission || PHRASE_ASSET_DEFAULTS.basmala.defaultLicense,
          tajweedReviewedBy: prevPhrase?.tajweedReviewedBy,
          tajweedReviewedAt: prevPhrase?.tajweedReviewedAt,
          tajweedListeningConfirmed: sameApprovedUrl
            ? prevPhrase?.tajweedListeningConfirmed
            : false,
          licenseTermsConfirmed: sameApprovedUrl ? prevPhrase?.licenseTermsConfirmed : false,
          basmalaCandidateProbe: storedProbe,
          verificationStatus: sameApprovedUrl ? 'verified' : 'pending_verification',
          audioUrlsJson: {
            url: storedUrl,
            licenseConfirmed: String(sameApprovedUrl ? prevPhrase?.licenseTermsConfirmed === true : false),
            humanListeningApproved: String(
              sameApprovedUrl ? prevPhrase?.tajweedListeningConfirmed === true : false,
            ),
          },
          notes: prevPhrase?.notes,
          updatedByUserId: actorUserId,
          updatedAt: nowIso,
        };
      }

      return {
        status: 200,
        body: {
          initialUrl,
          initialProbe,
          resolvedAuthorizedUrl: resolvedUrl,
          resolvedProbe,
          resolverError,
          basmalaCandidate: getBasmalaCandidateInfo(db),
          phraseAssets: getPhraseAssetConfigs(db),
          releaseReadiness: buildReleaseReadinessSummary(db),
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  app.put('/api/admin/quran/verifications/:key', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isQuranSchemaReady()) {
      return res.status(409).json({ error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' });
    }
    const rawKey = sanitizeShortText(req.params.key || '', 64);
    const key = normalizeReciterIdInput(rawKey);
    const reciter = getQuranReciterById(key);
    if (!reciter) {
      return res.status(404).json({
        error: 'Unknown Quran reciter verification key. Quran Surah text cannot be edited via admin verification.',
      });
    }

    const body = (req.body || {}) as {
      sourceName?: string;
      licenseOrPermission?: string;
      textIntegrityConfirmed?: boolean;
      audioIntegrityConfirmed?: boolean;
      reciterIdentityConfirmed?: boolean;
      licenseTermsConfirmed?: boolean;
      licenseConfirmedBy?: string;
      adminConfirmations?: Partial<{
        qfDeveloperTermsAndCommercialUse: boolean;
        qfAttributionAndReciterCredit: boolean;
        qfAttributionAndTerms: boolean;
        sevenDayCachePolicy: boolean;
        privacyAndTermsReadiness: boolean;
        basmalaAudioApproval: boolean;
      }>;
      verificationStatus?: QuranVerificationStatus;
      audioUrlsJson?: Record<string, string>;
      ayahAudioUrlsJson?: Record<string, string>;
      notes?: string;
    };

    const allowedStatuses: QuranVerificationStatus[] = ['verified', 'pending_verification', 'unavailable'];
    const nextStatus = allowedStatuses.includes(body.verificationStatus as QuranVerificationStatus)
      ? (body.verificationStatus as QuranVerificationStatus)
      : 'pending_verification';

    const cleanUrls: Record<string, string> = {};
    if (body.audioUrlsJson && typeof body.audioUrlsJson === 'object') {
      for (const [surahId, rawUrl] of Object.entries(body.audioUrlsJson)) {
        if (!VALID_SURAH_ID_SET.has(surahId)) continue;
        const normalizedUrl = normalizeQuranAudioUrl(rawUrl);
        if (!normalizedUrl) {
          return res.status(400).json({
            error: `Unsafe or invalid audio URL for ${surahId}. Only https:// or /assets/quran/ paths are permitted.`,
          });
        }
        cleanUrls[surahId] = normalizedUrl;
      }
    }

    const cleanAyahUrls: Record<string, string> = {};
    if (body.ayahAudioUrlsJson && typeof body.ayahAudioUrlsJson === 'object') {
      for (const [verseKey, rawUrl] of Object.entries(body.ayahAudioUrlsJson)) {
        if (!/^\d{1,3}:\d{1,3}$/.test(verseKey)) continue;
        const normalizedUrl = normalizeQuranAudioUrl(rawUrl);
        if (!normalizedUrl) {
          return res.status(400).json({
            error: `Unsafe or invalid ayah audio URL for ${verseKey}. Only https:// or /assets/quran/ paths are permitted.`,
          });
        }
        cleanAyahUrls[verseKey] = normalizedUrl;
      }
    }

    const outcome = await runWithPgDbLock('quran-release-approval', async (db) => {
      ensureFamilyCollections(db);
      const prevRecord = db.quranContentVerifications?.[reciter.id];
      const nowIso = new Date().toISOString();
      const actorName = sanitizeShortText(
        req.authSession?.user.displayName || req.authSession?.user.email || req.authSession?.user.id || 'admin',
        120,
      );

      const finalSurahUrls =
        Object.keys(cleanUrls).length > 0 ? cleanUrls : prevRecord?.audioUrlsJson || {};
      const finalAyahUrls =
        Object.keys(cleanAyahUrls).length > 0 ? cleanAyahUrls : prevRecord?.ayahAudioUrlsJson || {};

      const phraseAssets = getPhraseAssetConfigs(db);
      const actorUserId = req.authSession?.user.id;
      const prevConfs = hydrateConfirmations(prevRecord?.adminConfirmations);
      const reqConfs = (body.adminConfirmations || {}) as Record<string, unknown>;

      const qfDevTermsChecked =
        typeof reqConfs.qfDeveloperTermsAndCommercialUse === 'boolean'
          ? reqConfs.qfDeveloperTermsAndCommercialUse
          : typeof reqConfs.qfAttributionAndTerms === 'boolean'
            ? reqConfs.qfAttributionAndTerms
            : body.licenseTermsConfirmed === true
              ? true
              : prevConfs.qfDeveloperTermsAndCommercialUse.confirmed;
      const qfAttributionChecked =
        typeof reqConfs.qfAttributionAndReciterCredit === 'boolean'
          ? reqConfs.qfAttributionAndReciterCredit
          : typeof reqConfs.qfAttributionAndTerms === 'boolean'
            ? reqConfs.qfAttributionAndTerms
            : body.licenseTermsConfirmed === true
              ? true
              : prevConfs.qfAttributionAndReciterCredit.confirmed;
      const sevenDayCacheChecked =
        typeof reqConfs.sevenDayCachePolicy === 'boolean'
          ? reqConfs.sevenDayCachePolicy
          : Boolean(prevConfs.sevenDayCachePolicy?.confirmed);
      const privacyTermsChecked =
        typeof reqConfs.privacyAndTermsReadiness === 'boolean'
          ? reqConfs.privacyAndTermsReadiness
          : Boolean(prevConfs.privacyAndTermsReadiness?.confirmed);
      const basmalaApprovalChecked =
        phraseAssets.basmala.status === 'approved'
          ? true
          : typeof reqConfs.basmalaAudioApproval === 'boolean'
            ? reqConfs.basmalaAudioApproval
            : Boolean(prevConfs.basmalaAudioApproval?.confirmed);

      if (basmalaApprovalChecked && phraseAssets.basmala.status !== 'approved') {
        return {
          status: 400,
          body: {
            error: 'Cannot confirm Basmala audio approval until the QF Reciter ID 6 Basmala (1:1) candidate is verified playable, source/usage rights confirmed, and saved as approved.',
          },
        };
      }

      const qfDeveloperTermsAndCommercialUse = normalizeConfirmationEntry(
        qfDevTermsChecked,
        prevConfs.qfDeveloperTermsAndCommercialUse,
        actorName,
        nowIso,
        actorUserId,
        ADMIN_CONFIRMATION_POLICY_VERSIONS.qfDeveloperTermsAndCommercialUse,
      );
      const qfAttributionAndReciterCredit = normalizeConfirmationEntry(
        qfAttributionChecked,
        prevConfs.qfAttributionAndReciterCredit,
        actorName,
        nowIso,
        actorUserId,
        ADMIN_CONFIRMATION_POLICY_VERSIONS.qfAttributionAndReciterCredit,
      );

      const adminConfirmations: QuranAdminConfirmations = {
        qfDeveloperTermsAndCommercialUse,
        qfAttributionAndReciterCredit,
        sevenDayCachePolicy: normalizeConfirmationEntry(
          sevenDayCacheChecked,
          prevConfs.sevenDayCachePolicy,
          actorName,
          nowIso,
          actorUserId,
          ADMIN_CONFIRMATION_POLICY_VERSIONS.sevenDayCachePolicy,
        ),
        privacyAndTermsReadiness: normalizeConfirmationEntry(
          privacyTermsChecked,
          prevConfs.privacyAndTermsReadiness,
          actorName,
          nowIso,
          actorUserId,
          ADMIN_CONFIRMATION_POLICY_VERSIONS.privacyAndTermsReadiness,
        ),
        basmalaAudioApproval: normalizeConfirmationEntry(
          basmalaApprovalChecked,
          prevConfs.basmalaAudioApproval,
          actorName,
          nowIso,
          actorUserId,
          ADMIN_CONFIRMATION_POLICY_VERSIONS.basmalaAudioApproval,
        ),
        qfAttributionAndTerms: normalizeConfirmationEntry(
          qfDevTermsChecked && qfAttributionChecked,
          prevConfs.qfAttributionAndTerms,
          actorName,
          nowIso,
          actorUserId,
          ADMIN_CONFIRMATION_POLICY_VERSIONS.qfDeveloperTermsAndCommercialUse,
        ),
      };

      const cleanSource = sanitizeShortText(body.sourceName || prevRecord?.sourceName || reciter.sourceName, 160);
      const cleanLicense = sanitizeShortText(
        body.licenseOrPermission || prevRecord?.licenseOrPermission || reciter.licenseOrPermission,
        200,
      );

      const licenseTermsConfirmed =
        adminConfirmations.qfDeveloperTermsAndCommercialUse.confirmed &&
        adminConfirmations.qfAttributionAndReciterCredit.confirmed &&
        adminConfirmations.sevenDayCachePolicy.confirmed &&
        adminConfirmations.privacyAndTermsReadiness.confirmed;

      // Temporarily assign URLs onto a working copy to evaluate current source verification state
      const priorRecord = db.quranContentVerifications![reciter.id];
      const svBeforeSave = buildSourceVerificationState({
        ...db,
        quranContentVerifications: {
          ...(db.quranContentVerifications || {}),
          [reciter.id]: {
            id: priorRecord?.id || `qver_${reciter.id}`,
            contentType: 'reciter_audio',
            contentKey: reciter.id,
            sourceName: cleanSource,
            licenseOrPermission: cleanLicense,
            sourceVerification: priorRecord?.sourceVerification,
            verificationStatus: priorRecord?.verificationStatus || 'pending_verification',
            audioUrlsJson: finalSurahUrls,
            ayahAudioUrlsJson: finalAyahUrls,
            updatedAt: nowIso,
          },
        },
      });

      const basmalaProbe = db.quranContentVerifications?.['phrase:basmala']?.basmalaCandidateProbe;
      const basmalaPlayableAndApproved =
        phraseAssets.basmala.status === 'approved' &&
        Boolean(phraseAssets.basmala.audioUrl) &&
        basmalaProbe?.ok === true &&
        basmalaProbe?.browserPlayable === true &&
        basmalaProbe?.url === phraseAssets.basmala.audioUrl;

      if (nextStatus === 'verified') {
        const missingConfirmations: string[] = [];
        if (!adminConfirmations.qfDeveloperTermsAndCommercialUse.confirmed) {
          missingConfirmations.push('qfDeveloperTermsAndCommercialUse');
        }
        if (!adminConfirmations.qfAttributionAndReciterCredit.confirmed) {
          missingConfirmations.push('qfAttributionAndReciterCredit');
        }
        if (!adminConfirmations.sevenDayCachePolicy.confirmed) {
          missingConfirmations.push('sevenDayCachePolicy');
        }
        if (!adminConfirmations.privacyAndTermsReadiness.confirmed) {
          missingConfirmations.push('privacyAndTermsReadiness');
        }

        if (!svBeforeSave.checklistPassed) {
          return {
            status: 400,
            body: {
              error: `Cannot verify/release Reciter ID 6 until all 8 Reciter & Recitation Source Verification checks pass (${svBeforeSave.checklistPassedCount}/${svBeforeSave.checklistTotalCount} passed).`,
            },
          };
        }
        if (!svBeforeSave.sourceVerification.confirmed) {
          return {
            status: 400,
            body: {
              error: 'Cannot verify/release Reciter ID 6 until an authenticated administrator with manage_lessons permission completes "Confirm Reciter & Recitation Source".',
            },
          };
        }
        if (!basmalaPlayableAndApproved) {
          return {
            status: 400,
            body: {
              error: 'Cannot verify/release Reciter ID 6 until a playable QF Reciter ID 6 Basmala (1:1) audio asset is approved.',
            },
          };
        }
        if (!cleanLicense || missingConfirmations.length > 0) {
          return {
            status: 400,
            body: {
              error:
                missingConfirmations.length > 0
                  ? `Cannot mark reciter audio as verified until all 4 administrator confirmations are completed: ${missingConfirmations.join(', ')}.`
                  : 'Cannot mark reciter audio as verified without licenseOrPermission.',
            },
          };
        }
      }

      const cleanLicenseConfirmedBy = licenseTermsConfirmed
        ? sanitizeShortText(body.licenseConfirmedBy || actorName, 120)
        : undefined;

      const record: QuranContentVerificationRecord = {
        id: `qver_${reciter.id}`,
        contentType: 'reciter_audio',
        contentKey: reciter.id,
        sourceName: cleanSource,
        licenseOrPermission: cleanLicense,
        textIntegrityConfirmed: svBeforeSave.textIntegrityVerified,
        audioIntegrityConfirmed: svBeforeSave.audioTechnicalIntegrityVerified,
        reciterIdentityConfirmed: svBeforeSave.sourceVerification.providerMetadataVerified === true,
        licenseTermsConfirmed,
        licenseConfirmedBy: cleanLicenseConfirmedBy,
        licenseConfirmedAt: licenseTermsConfirmed
          ? prevRecord?.licenseTermsConfirmed && prevRecord?.licenseConfirmedAt
            ? prevRecord.licenseConfirmedAt
            : nowIso
          : undefined,
        adminConfirmations,
        sourceVerification: svBeforeSave.sourceVerification,
        basmalaCandidateProbe: prevRecord?.basmalaCandidateProbe,
        verificationStatus: nextStatus,
        audioUrlsJson: Object.keys(finalSurahUrls).length > 0 ? finalSurahUrls : undefined,
        ayahAudioUrlsJson: Object.keys(finalAyahUrls).length > 0 ? finalAyahUrls : undefined,
        notes: body.notes !== undefined ? sanitizeQuranNote(body.notes, 280) : prevRecord?.notes,
        updatedByUserId: req.authSession?.user.id,
        updatedAt: nowIso,
      };
      db.quranContentVerifications![reciter.id] = record;

      recordAuditEvent(db, {
        eventType: 'CONTENT_REVIEW',
        actorId: req.authSession?.user.id || 'admin',
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'QURAN_VERIFICATION_UPDATED',
        recordType: 'quran_content_verification',
        recordId: reciter.id,
        newValue: {
          verificationStatus: record.verificationStatus,
          sourceName: record.sourceName,
          surahUrlsCount: Object.keys(finalSurahUrls).length,
          ayahUrlsCount: Object.keys(finalAyahUrls).length,
          sourceVerificationStatus: svBeforeSave.sourceVerification.status,
          adminConfirmations,
        },
        summary: `Updated Quran verification for ${reciter.id} -> ${record.verificationStatus} (source=${svBeforeSave.sourceVerification.status})`,
        ip: getClientIp(req),
      });

      return {
        status: 200,
        body: {
          verification: record,
          reciters: mergeRecitersWithVerifications(db),
          releaseReadiness: buildReleaseReadinessSummary(db),
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  // 8b. Admin Opening Basmala & Closing Phrase Audio Configuration (never auto-verifies or modifies reciter status)
  app.put('/api/admin/quran/phrase-assets/:phraseKey', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isQuranSchemaReady()) {
      return res.status(409).json({ error: 'Quran World tables are pending migration.', code: 'QURAN_SCHEMA_PENDING' });
    }
    const rawPhraseKey = sanitizeShortText(req.params.phraseKey || '', 32);
    if (rawPhraseKey !== 'basmala' && rawPhraseKey !== 'closing') {
      return res.status(404).json({ error: 'Unknown Quran phrase asset key. Expected "basmala" or "closing".' });
    }
    const phraseKey = rawPhraseKey;
    const def = PHRASE_ASSET_DEFAULTS[phraseKey];

    const body = (req.body || {}) as {
      audioUrl?: string;
      sourceName?: string;
      licenseOrPermission?: string;
      licenseConfirmed?: boolean;
      humanListeningApproved?: boolean;
      reviewedBy?: string;
      reviewedAt?: string;
      verificationStatus?: QuranVerificationStatus;
      notes?: string;
    };

    const rawUrl = typeof body.audioUrl === 'string' ? body.audioUrl.trim() : '';
    let cleanAudioUrl: string | null = null;
    if (rawUrl) {
      cleanAudioUrl = normalizeQuranAudioUrl(rawUrl);
      if (!cleanAudioUrl) {
        return res.status(400).json({
          error: `Unsafe or invalid ${phraseKey} audio URL. Only https:// or /assets/quran/ paths are permitted.`,
        });
      }
      if (phraseKey === 'basmala') {
        if (!isAllowedQuranFoundationAudioHost(cleanAudioUrl)) {
          return res.status(400).json({
            error: 'Basmala audio must use the verified Quran Foundation Reciter ID 6 (Al-Husary 1:1) HTTPS candidate URL.',
          });
        }
        if (!/\/001001\.mp3(?:[?#]|$)/i.test(cleanAudioUrl)) {
          return res.status(400).json({
            error: 'Basmala audio URL must point strictly to chapter 1, verse 1 (001001.mp3) for Reciter ID 6.',
          });
        }
      }
    }

    const licenseConfirmed = body.licenseConfirmed === true;
    const humanListeningApproved = body.humanListeningApproved === true;
    const cleanSource = sanitizeShortText(body.sourceName || def.defaultSourceName, 160);
    const cleanLicense = sanitizeShortText(body.licenseOrPermission || def.defaultLicense, 240);
    const cleanReviewer = body.reviewedBy ? sanitizeShortText(body.reviewedBy, 120) : undefined;
    const rawReviewedAt = typeof body.reviewedAt === 'string' ? body.reviewedAt.trim() : '';
    const cleanReviewedAt = /^\d{4}-\d{2}-\d{2}$/.test(rawReviewedAt) ? rawReviewedAt : undefined;
    const requestedStatus: QuranVerificationStatus =
      body.verificationStatus === 'verified' || body.verificationStatus === 'unavailable'
        ? body.verificationStatus
        : 'pending_verification';

    if (requestedStatus === 'verified') {
      const missing: string[] = [];
      if (!cleanAudioUrl) missing.push('audioUrl');
      if (!licenseConfirmed) missing.push('licenseConfirmed');
      if (!humanListeningApproved) missing.push('humanListeningApproved');
      if (!cleanLicense) missing.push('licenseOrPermission');
      if (!cleanReviewer) missing.push('reviewedBy');
      if (missing.length > 0) {
        return res.status(400).json({
          error: `Cannot mark ${phraseKey} audio asset as approved/verified until required fields are completed: ${missing.join(', ')}.`,
        });
      }
    }

    // Live audio probe for Basmala whenever a URL is supplied (do not assume HTTPS == playable!)
    const liveProbe =
      phraseKey === 'basmala' && cleanAudioUrl
        ? await probePlayableAudioUrl(cleanAudioUrl)
        : undefined;

    if (phraseKey === 'basmala' && requestedStatus === 'verified') {
      if (!liveProbe?.ok || !liveProbe.browserPlayable) {
        return res.status(400).json({
          error: `Cannot approve Basmala asset: recording is not playable (${liveProbe?.reason || `HTTP ${liveProbe?.httpStatus ?? 0}, ${liveProbe?.contentType || 'unknown'}`}). Resolve a playable Quran Foundation Reciter ID 6 (1:1) recording first.`,
          probe: liveProbe,
        });
      }
    }

    const outcome = await runWithPgDbLock('quran-release-approval', async (db) => {
      ensureFamilyCollections(db);
      const nowIso = new Date().toISOString();
      const prevPhrase = db.quranContentVerifications?.[def.contentKey];

      const record: QuranContentVerificationRecord = {
        id: `qver_phrase_${phraseKey}`,
        contentType: 'reciter_audio',
        contentKey: def.contentKey,
        sourceName: cleanSource,
        licenseOrPermission: cleanLicense,
        tajweedReviewedBy: cleanReviewer,
        tajweedReviewedAt: cleanReviewer ? cleanReviewedAt || nowIso.slice(0, 10) : undefined,
        tajweedListeningConfirmed: humanListeningApproved,
        licenseTermsConfirmed: licenseConfirmed,
        basmalaCandidateProbe: liveProbe || prevPhrase?.basmalaCandidateProbe,
        verificationStatus: cleanAudioUrl ? requestedStatus : 'unavailable',
        audioUrlsJson: {
          ...(cleanAudioUrl ? { url: cleanAudioUrl } : {}),
          licenseConfirmed: String(licenseConfirmed),
          humanListeningApproved: String(humanListeningApproved),
        },
        notes: body.notes ? sanitizeQuranNote(body.notes, 280) : undefined,
        updatedByUserId: req.authSession?.user.id,
        updatedAt: nowIso,
      };
      db.quranContentVerifications![def.contentKey] = record;

      // Sync Basmala approval confirmation onto Reciter ID 6 record cleanly
      const rec = db.quranContentVerifications?.[HUSARY_MURATTAL_SPEC.reciterId];
      if (phraseKey === 'basmala' && rec) {
        if (requestedStatus === 'verified' && cleanAudioUrl) {
          rec.adminConfirmations = {
            ...hydrateConfirmations(rec.adminConfirmations),
            basmalaAudioApproval: {
              confirmed: true,
              confirmedBy: cleanReviewer || 'admin',
              confirmedByUserId: req.authSession?.user.id,
              confirmedAt: nowIso,
              policyVersion: ADMIN_CONFIRMATION_POLICY_VERSIONS.basmalaAudioApproval,
            },
          };
        } else {
          if (rec.adminConfirmations?.basmalaAudioApproval?.confirmed) {
            rec.adminConfirmations.basmalaAudioApproval = { confirmed: false };
          }
          if (rec.verificationStatus === 'verified') {
            rec.verificationStatus = 'pending_verification';
          }
        }
      }

      recordAuditEvent(db, {
        eventType: 'CONTENT_REVIEW',
        actorId: req.authSession?.user.id || 'admin',
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'QURAN_PHRASE_ASSET_UPDATED',
        recordType: 'quran_content_verification',
        recordId: def.contentKey,
        newValue: {
          phraseKey,
          hasAudioUrl: Boolean(cleanAudioUrl),
          licenseConfirmed,
          humanListeningApproved,
          reviewedBy: cleanReviewer,
          verificationStatus: record.verificationStatus,
          probeOk: liveProbe?.ok ?? null,
        },
        summary: `Updated Quran ${phraseKey} phrase audio config (status=${record.verificationStatus})`,
        ip: getClientIp(req),
      });

      const phraseAssets = getPhraseAssetConfigs(db);
      return {
        status: 200,
        body: {
          phraseKey,
          asset: phraseAssets[phraseKey],
          phraseAssets,
          basmalaCandidate: getBasmalaCandidateInfo(db),
          probe: liveProbe,
          releaseReadiness: buildReleaseReadinessSummary(db),
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  // 9. Admin Quran Foundation Metadata Preview (strictly server-side credentials, never auto-verifies)
  app.post('/api/admin/quran/qf-sync-preview', requireAdminPermission('manage_lessons'), asyncRoute(async (_req: AuthenticatedRequest, res) => {
    const chapterNumbers = QURAN_SURAHS.map((s) => s.number);
    console.info(`[QF-Preview] Handler invoked: route=/api/admin/quran/qf-sync-preview chapters=${chapterNumbers.length}`);
    const preview = await fetchHusaryRecitationMetadata(chapterNumbers);
    const surahCount = Object.keys(preview.surahAudioUrls).length;
    const ayahCount = Object.keys(preview.ayahAudioUrls).length;
    const hasAudio = surahCount > 0 || ayahCount > 0;
    const oauthHttpStatus = preview.diagnostics.oauthPrimary?.httpStatus ?? 'none';
    const chapterOk = preview.diagnostics.chapterApi?.ok ?? false;
    const reciterVerified = preview.diagnostics.reciterCheck?.verifiedHusaryId6 ?? 'none';
    const requestedScopesStr = preview.diagnostics.requestedScopes.join(' ') || 'none';
    const grantedScopesStr = preview.diagnostics.grantedScopes.join(' ') || 'none';

    if (!preview.configured) {
      console.info(
        `[QF-Preview] Handler returning JSON: status=200 ok=false upstreamHttpStatus=503 configured=false surahs=${surahCount} ayahs=${ayahCount}`,
      );
      return res.status(200).json({
        ...preview,
        ok: false,
        upstreamHttpStatus: 503,
        error: preview.error || 'QF_CREDENTIALS_NOT_CONFIGURED',
        verificationStatus: 'pending_verification',
        licenseAndAttribution: preview.validation.licenseAndAttribution,
        notice:
          'QF_CLIENT_ID and QF_CLIENT_SECRET are not configured on the server.',
      });
    }

    if (preview.error || !hasAudio) {
      console.info(
        `[QF-Preview] Handler returning JSON: status=200 ok=false upstreamHttpStatus=502 configured=true requestedScopes="${requestedScopesStr}" grantedScopes="${grantedScopesStr}" oauthHttpStatus=${oauthHttpStatus} chapterOk=${chapterOk} reciterVerified=${reciterVerified} surahs=${surahCount} ayahs=${ayahCount}`,
      );
      return res.status(200).json({
        ...preview,
        ok: false,
        upstreamHttpStatus: 502,
        error: preview.error || 'NO_RECITATION_AUDIO_FOUND',
        verificationStatus: 'pending_verification',
        licenseAndAttribution: preview.validation.licenseAndAttribution,
        notice:
          'Preview failed. Inspect diagnostics (requested scopes, granted scopes, OAuth status, Chapter API status, Reciter verification, and Audio API status). No audio was verified.',
      });
    }

    console.info(
      `[QF-Preview] Handler returning JSON: status=200 configured=true ok=true requestedScopes="${requestedScopesStr}" grantedScopes="${grantedScopesStr}" oauthHttpStatus=${oauthHttpStatus} chapterOk=${chapterOk} reciterVerified=${reciterVerified} surahs=${surahCount} ayahs=${ayahCount}`,
    );
    return res.status(200).json({
      ...preview,
      ok: true,
      verificationStatus: 'pending_verification',
      licenseAndAttribution: preview.validation.licenseAndAttribution,
      notice:
        'Validation preview only (auto-approve disabled). Admin must complete Reciter & Recitation Source Verification, Basmala asset approval, and compliance confirmations before family release.',
    });
  }));

  // 10. Admin Controlled Internal Testing Audio URLs (ADMIN/INTERNAL TESTING ONLY, never auto-verifies, never exposed to children/families)
  app.get('/api/admin/quran/internal-testing-audio', requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const phraseAssets = getPhraseAssetConfigs(db);
    const chapterNumbers = QURAN_SURAHS.map((s) => s.number);
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const result = await fetchHusaryTestingAudioUrls(chapterNumbers, forceRefresh);
    const basmalaIncludedBySurah: Record<string, boolean> = {
      ...result.basmalaIncludedBySurah,
    };
    for (const s of QURAN_SURAHS) {
      if (basmalaIncludedBySurah[s.id] === undefined) {
        // Surah 1 (Al-Fatihah) includes 1:1 Basmala in its recording; other 8 Surahs start at Ayah 1 without Basmala
        basmalaIncludedBySurah[s.id] = !s.hasOpeningBasmalah;
      }
    }
    const testingBasmalaUrl = phraseAssets.basmala.audioUrl || result.basmalaCandidateAudioUrl || null;
    const testingBasmalaSource = phraseAssets.basmala.audioUrl
      ? 'admin_configured'
      : result.basmalaCandidateAudioUrl
        ? 'qf_1_1_candidate'
        : 'none';
    const testingClosingUrl = phraseAssets.closing.audioUrl || null;

    return res.status(200).json({
      ...result,
      basmalaIncludedBySurah,
      phraseAssets,
      testingBasmalaUrl,
      testingBasmalaSource,
      testingClosingUrl,
      verificationStatus: 'pending_verification',
      autoApproved: false,
      autoPublished: false,
      releasedToFamilies: false,
      testingMode: 'ADMIN_INTERNAL_TESTING_ONLY',
      displayedAttribution:
        "Quran data provided by Quran.Foundation. · Recitation: Sheikh Mahmoud Khalil Al-Husary – Hafs 'an Asim – Murattal",
      curatedSurahsCount: QURAN_SURAHS.length,
      curatedAyahsCount: QURAN_SURAHS.reduce((sum, s) => sum + s.ayahCount, 0),
    });
  }));

  // 11. Admin Quran Stories CMS — List & Preview All Stories + Complete Audio Manifest
  app.get('/api/admin/quran/stories', requireAuth, requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const audioManifest = await buildStoryAudioManifest(QURAN_STORIES, db.quranStoryCms || {});
    return res.json({
      stories: getMergedQuranStories(db, true),
      overrides: db.quranStoryCms || {},
      audioManifest,
    });
  }));

  // 11b. Admin Quran Stories — Detailed 8-Story / 41-Scene Audio Manifest
  app.get('/api/admin/quran/stories/audio-manifest', requireAuth, requireAdminPermission('manage_lessons'), asyncRoute(async (_req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const audioManifest = await buildStoryAudioManifest(QURAN_STORIES, db.quranStoryCms || {});
    return res.json(audioManifest);
  }));

  // 11c. Admin Quran Stories — Validate Any Scene Audio Asset URL Before Saving/Publishing
  app.post('/api/admin/quran/stories/validate-audio', requireAuth, requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    const rawUrl = String((req.body as { url?: unknown })?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'Audio URL is required.' });
    }
    if (!isSafeStoryAssetUrl(rawUrl)) {
      return res.status(400).json({
        error: 'Unsafe or invalid audio URL. Only clean https:// or /assets/ paths are permitted.',
      });
    }
    const validation = await validateStoryAudioAsset(rawUrl);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.reason || 'Audio asset failed validation.',
        validation,
      });
    }
    return res.json({ validation });
  }));

  // 11d. Admin Quran Stories — Generate & Persist Verified Arabic Storytelling Audio via Gemini TTS (Single Scene)
  app.post('/api/admin/quran/stories/:storyId/scenes/:sceneId/generate-audio', requireAuth, requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    const storyId = sanitizeShortText(req.params.storyId || '', 64);
    const sceneId = sanitizeShortText(req.params.sceneId || '', 64);
    const baseStory = QURAN_STORIES.find((s) => s.id === storyId);
    const baseScene = baseStory?.scenes.find((sc) => sc.id === sceneId);
    if (!baseStory || !baseScene) {
      return res.status(404).json({ error: 'Quran story or scene not found.' });
    }

    const body = (req.body || {}) as { ageBand?: 'young' | 'mid' | 'older'; voiceName?: string };
    const bandKey: 'young' | 'mid' | 'older' =
      body.ageBand === 'young' || body.ageBand === 'older' ? body.ageBand : 'mid';

    const dbSnapshot = getDb();
    ensureFamilyCollections(dbSnapshot);
    const mergedStory = getMergedQuranStories(dbSnapshot, true).find((s) => s.id === storyId) || baseStory;
    const mergedScene = mergedStory.scenes.find((sc) => sc.id === sceneId) || baseScene;
    const narrationTextAr = mergedScene.narration[bandKey].ar;

    let generated: Awaited<ReturnType<typeof generateSceneNarrationAudio>>;
    try {
      generated = await generateSceneNarrationAudio({
        storyId,
        sceneId,
        narrationTextAr,
        voiceName: typeof body.voiceName === 'string' ? body.voiceName : undefined,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number; code?: string };
      return res.status(e.statusCode || 502).json({
        error: e.message || 'Audio generation failed.',
        code: e.code || 'AUDIO_GENERATION_FAILED',
      });
    }

    const outcome = await runWithPgDbLock(`admin:quran-story:${storyId}`, async (db) => {
      ensureFamilyCollections(db);
      const prev = db.quranStoryCms![storyId] || { storyId, updatedAt: new Date().toISOString() };
      const prevSceneOverrides = { ...(prev.sceneOverrides || {}) };
      const prevSc = prevSceneOverrides[sceneId] || { id: sceneId };
      const nowIso = new Date().toISOString();

      prevSceneOverrides[sceneId] = {
        ...prevSc,
        id: sceneId,
        narrationAudioUrl: generated.url,
        durationSeconds: generated.durationSeconds
          ? Math.max(10, Math.min(180, Math.round(generated.durationSeconds)))
          : prevSc.durationSeconds,
      };

      const nextOverride: QuranStoryAdminOverride = {
        ...prev,
        storyId,
        sceneOverrides: prevSceneOverrides,
        updatedByUserId: req.authSession!.user.id,
        updatedAt: nowIso,
      };
      db.quranStoryCms![storyId] = nextOverride;

      recordAuditEvent(db, {
        eventType: 'CONTENT_REVIEW',
        actorId: req.authSession!.user.id,
        actorRole: req.authSession!.user.role,
        actionType: 'GENERATE_STORY_AUDIO',
        recordType: 'quran_story_audio',
        recordId: `${storyId}:${sceneId}`,
        outcome: 'success',
        ip: getClientIp(req),
        summary: `Generated storytelling MP3 audio for "${storyId}/${sceneId}" (${generated.bytes} bytes, ${generated.durationSeconds ?? 'unknown'}s)`,
      });

      const audioManifest = await buildStoryAudioManifest(QURAN_STORIES, db.quranStoryCms || {});
      return {
        status: 200,
        body: {
          asset: generated,
          story: getMergedQuranStories(db, true).find((s) => s.id === storyId),
          stories: getMergedQuranStories(db, true),
          overrides: db.quranStoryCms || {},
          audioManifest,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  // 11e. Admin Quran Stories — Generate All Missing Narration Audio Clips for One Story
  app.post('/api/admin/quran/stories/:storyId/generate-all-audio', requireAuth, requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    const storyId = sanitizeShortText(req.params.storyId || '', 64);
    const baseStory = QURAN_STORIES.find((s) => s.id === storyId);
    if (!baseStory) {
      return res.status(404).json({ error: 'Quran story not found.' });
    }
    const force = Boolean((req.body as { force?: boolean })?.force);

    const dbInit = getDb();
    ensureFamilyCollections(dbInit);
    const merged = getMergedQuranStories(dbInit, true).find((s) => s.id === storyId) || baseStory;
    const generatedMap: Record<string, Awaited<ReturnType<typeof generateSceneNarrationAudio>>> = {};
    let generationError: (Error & { statusCode?: number; code?: string; failedSceneId?: string }) | null = null;

    for (const sc of merged.scenes) {
      const alreadyValid =
        !force && Boolean(sc.narrationAudioUrl && localStoryAudioExistsSync(sc.narrationAudioUrl));
      if (alreadyValid) continue;
      try {
        generatedMap[sc.id] = await generateSceneNarrationAudio({
          storyId,
          sceneId: sc.id,
          narrationTextAr: sc.narration.mid.ar,
        });
      } catch (err) {
        const e = err as Error & { statusCode?: number; code?: string; failedSceneId?: string };
        e.failedSceneId = sc.id;
        generationError = e;
        break;
      }
    }

    if (Object.keys(generatedMap).length === 0 && generationError) {
      return res.status(generationError.statusCode || 502).json({
        error: `Stopped at scene ${generationError.failedSceneId}: ${generationError.message || 'Audio generation failed.'}`,
        code: generationError.code || 'AUDIO_GENERATION_FAILED',
        partialGeneratedIds: [],
      });
    }

    const outcome = await runWithPgDbLock(`admin:quran-story:${storyId}`, async (db) => {
      ensureFamilyCollections(db);
      const prev = db.quranStoryCms![storyId] || { storyId, updatedAt: new Date().toISOString() };
      const nextSceneOverrides = { ...(prev.sceneOverrides || {}) };
      const nowIso = new Date().toISOString();

      for (const [scId, asset] of Object.entries(generatedMap)) {
        const prevSc = nextSceneOverrides[scId] || { id: scId };
        nextSceneOverrides[scId] = {
          ...prevSc,
          id: scId,
          narrationAudioUrl: asset.url,
          durationSeconds: asset.durationSeconds
            ? Math.max(10, Math.min(180, Math.round(asset.durationSeconds)))
            : prevSc.durationSeconds,
        };
      }

      db.quranStoryCms![storyId] = {
        ...prev,
        storyId,
        sceneOverrides: nextSceneOverrides,
        updatedByUserId: req.authSession!.user.id,
        updatedAt: nowIso,
      };

      const audioManifest = await buildStoryAudioManifest(QURAN_STORIES, db.quranStoryCms || {});
      if (generationError) {
        return {
          status: generationError.statusCode || 502,
          body: {
            error: `Stopped at scene ${generationError.failedSceneId}: ${generationError.message || 'Audio generation failed.'}`,
            code: generationError.code || 'AUDIO_GENERATION_FAILED',
            partialGeneratedIds: Object.keys(generatedMap),
            generatedCount: Object.keys(generatedMap).length,
            story: getMergedQuranStories(db, true).find((s) => s.id === storyId),
            audioManifest,
          },
        };
      }

      return {
        status: 200,
        body: {
          generatedCount: Object.keys(generatedMap).length,
          story: getMergedQuranStories(db, true).find((s) => s.id === storyId),
          stories: getMergedQuranStories(db, true),
          overrides: db.quranStoryCms || {},
          audioManifest,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));

  // 12. Admin Quran Stories CMS — Update Enable/Disable, Publish Status, Texts, Scenes & Audio Refs
  app.put('/api/admin/quran/stories/:storyId', requireAuth, requireAdminPermission('manage_lessons'), asyncRoute(async (req: AuthenticatedRequest, res) => {
    const storyId = sanitizeShortText(req.params.storyId || '', 64);
    const baseStory = QURAN_STORIES.find((s) => s.id === storyId);
    if (!baseStory) {
      return res.status(404).json({ error: 'Quran story not found.' });
    }

    // Pre-validate any non-empty narrationAudioUrl before committing to PostgreSQL
    const rawBody = (req.body || {}) as Partial<QuranStoryAdminOverride> & {
      sceneOverrides?: Record<string, QuranStorySceneOverride>;
    };
    const validSceneIdSet = new Set(baseStory.scenes.map((s) => s.id));
    if (rawBody.sceneOverrides && typeof rawBody.sceneOverrides === 'object') {
      for (const [scId, rawOv] of Object.entries(rawBody.sceneOverrides)) {
        if (!validSceneIdSet.has(scId) || !rawOv || typeof rawOv !== 'object') continue;
        if (rawOv.narrationAudioUrl !== undefined && rawOv.narrationAudioUrl !== null && rawOv.narrationAudioUrl !== '') {
          if (!isSafeStoryAssetUrl(rawOv.narrationAudioUrl)) {
            return res.status(400).json({
              error: `Unsafe or invalid narrationAudioUrl for scene ${scId}. Only HTTPS or /assets/ paths are permitted.`,
            });
          }
          const validation = await validateStoryAudioAsset(rawOv.narrationAudioUrl);
          if (!validation.valid) {
            return res.status(400).json({
              error: `Audio validation failed for scene ${scId}: ${validation.reason || 'Asset could not be verified.'}`,
            });
          }
        }
      }
    }

    const outcome = await runWithPgDbLock(`admin:quran-story:${storyId}`, async (db) => {
      ensureFamilyCollections(db);
      const body = rawBody;
      const prev = db.quranStoryCms![storyId] || { storyId, updatedAt: new Date().toISOString() };
      const nowIso = new Date().toISOString();

      const validSceneIds = new Set(baseStory.scenes.map((s) => s.id));
      let nextSceneOrder = prev.sceneOrder;
      if (Array.isArray(body.sceneOrder)) {
        const cleanedOrder = body.sceneOrder
          .map((id) => sanitizeShortText(String(id), 64))
          .filter((id) => validSceneIds.has(id));
        if (cleanedOrder.length > 0) {
          for (const sid of baseStory.scenes.map((s) => s.id)) {
            if (!cleanedOrder.includes(sid)) cleanedOrder.push(sid);
          }
          nextSceneOrder = cleanedOrder;
        }
      }

      const nextSceneOverrides: Record<string, QuranStorySceneOverride> = {
        ...(prev.sceneOverrides || {}),
      };
      if (body.sceneOverrides && typeof body.sceneOverrides === 'object') {
        const allowedCues = new Set<QuranStorySfxCue>([
          'birds',
          'waves',
          'whale',
          'stars',
          'river',
          'forest',
          'dawn',
          'cave',
          'chime',
        ]);
        for (const [scId, rawOv] of Object.entries(body.sceneOverrides)) {
          if (!validSceneIds.has(scId) || !rawOv || typeof rawOv !== 'object') continue;
          const prevSc = nextSceneOverrides[scId] || { id: scId };
          const nextSc: QuranStorySceneOverride = { ...prevSc, id: scId };

          if (rawOv.title && typeof rawOv.title.ar === 'string' && typeof rawOv.title.en === 'string') {
            nextSc.title = {
              ar: sanitizeShortText(rawOv.title.ar, 120),
              en: sanitizeShortText(rawOv.title.en, 120),
            };
          }
          if (rawOv.durationSeconds !== undefined) {
            nextSc.durationSeconds = Math.max(10, Math.min(180, Math.round(Number(rawOv.durationSeconds) || 35)));
          }
          if (typeof rawOv.illustrationKey === 'string' && rawOv.illustrationKey.trim()) {
            nextSc.illustrationKey = sanitizeShortText(rawOv.illustrationKey, 80);
          }
          if (rawOv.sfxCue && allowedCues.has(rawOv.sfxCue)) {
            nextSc.sfxCue = rawOv.sfxCue;
          }
          if (rawOv.narrationAudioUrl !== undefined) {
            if (rawOv.narrationAudioUrl === null || rawOv.narrationAudioUrl === '') {
              nextSc.narrationAudioUrl = null;
            } else if (isSafeStoryAssetUrl(rawOv.narrationAudioUrl)) {
              nextSc.narrationAudioUrl = rawOv.narrationAudioUrl.trim();
            } else {
              return {
                status: 400,
                body: { error: `Unsafe or invalid narrationAudioUrl for scene ${scId}. Only HTTPS or /assets/ paths are permitted.` },
              };
            }
          }
          if (rawOv.narration && typeof rawOv.narration === 'object') {
            const baseSc = baseStory.scenes.find((s) => s.id === scId)!;
            nextSc.narration = {
              young: {
                ar: sanitizeQuranNote(rawOv.narration.young?.ar ?? baseSc.narration.young.ar),
                en: sanitizeQuranNote(rawOv.narration.young?.en ?? baseSc.narration.young.en),
              },
              mid: {
                ar: sanitizeQuranNote(rawOv.narration.mid?.ar ?? baseSc.narration.mid.ar),
                en: sanitizeQuranNote(rawOv.narration.mid?.en ?? baseSc.narration.mid.en),
              },
              older: {
                ar: sanitizeQuranNote(rawOv.narration.older?.ar ?? baseSc.narration.older.ar),
                en: sanitizeQuranNote(rawOv.narration.older?.en ?? baseSc.narration.older.en),
              },
            };
          }
          nextSceneOverrides[scId] = nextSc;
        }
      }

      if (body.coverImage !== undefined && body.coverImage !== '' && !isSafeStoryAssetUrl(body.coverImage)) {
        return { status: 400, body: { error: 'Invalid coverImage URL.' } };
      }

      const nextOverride: QuranStoryAdminOverride = {
        ...prev,
        storyId,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : prev.enabled,
        publishedStatus:
          body.publishedStatus === 'draft' || body.publishedStatus === 'published'
            ? body.publishedStatus
            : prev.publishedStatus,
        title:
          body.title && typeof body.title.ar === 'string' && typeof body.title.en === 'string'
            ? { ar: sanitizeShortText(body.title.ar, 120), en: sanitizeShortText(body.title.en, 120) }
            : prev.title,
        description:
          body.description && typeof body.description.ar === 'string' && typeof body.description.en === 'string'
            ? { ar: sanitizeQuranNote(body.description.ar), en: sanitizeQuranNote(body.description.en) }
            : prev.description,
        moralLesson:
          body.moralLesson && typeof body.moralLesson.ar === 'string' && typeof body.moralLesson.en === 'string'
            ? { ar: sanitizeQuranNote(body.moralLesson.ar), en: sanitizeQuranNote(body.moralLesson.en) }
            : prev.moralLesson,
        simplifiedExplanation:
          body.simplifiedExplanation && typeof body.simplifiedExplanation.ar === 'string' && typeof body.simplifiedExplanation.en === 'string'
            ? { ar: sanitizeQuranNote(body.simplifiedExplanation.ar), en: sanitizeQuranNote(body.simplifiedExplanation.en) }
            : prev.simplifiedExplanation,
        coverImage: body.coverImage ? body.coverImage.trim() : prev.coverImage,
        sceneOrder: nextSceneOrder,
        sceneOverrides: nextSceneOverrides,
        updatedByUserId: req.authSession!.user.id,
        updatedAt: nowIso,
      };

      db.quranStoryCms![storyId] = nextOverride;

      recordAuditEvent(db, {
        eventType: 'CONTENT_REVIEW',
        actorId: req.authSession!.user.id,
        actorRole: req.authSession!.user.role,
        actionType: 'UPDATE_STORY',
        recordType: 'quran_story_cms',
        recordId: storyId,
        outcome: 'success',
        ip: getClientIp(req),
        summary: `Updated Quran story "${storyId}" (status=${nextOverride.publishedStatus ?? 'published'}, enabled=${nextOverride.enabled ?? true})`,
      });

      const audioManifest = await buildStoryAudioManifest(QURAN_STORIES, db.quranStoryCms || {});
      return {
        status: 200,
        body: {
          story: getMergedQuranStories(db, true).find((s) => s.id === storyId) || mergeStoryWithAdminOverride(baseStory, nextOverride),
          override: nextOverride,
          overrides: db.quranStoryCms || {},
          stories: getMergedQuranStories(db, true),
          audioManifest,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  }));
}
