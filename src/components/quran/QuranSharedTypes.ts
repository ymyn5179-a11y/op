import type {
  InternalAgeBand,
  QuranActivityEvent,
  QuranAudioProbeDiagnostics,
  QuranChildSettings,
  QuranContentVerificationRecord,
  QuranMannerProgress,
  QuranMannerSpec,
  QuranPhraseAudioAssetConfig,
  QuranReciterSpec,
  QuranReleaseReadinessSummary,
  QuranStoryProgress,
  QuranStoryProgressDetails,
  QuranStorySpec,
  QuranSurahProgress,
  QuranSurahSpec,
} from '../../types/nonoland';

export interface QuranPlaybackResolution {
  requestedReciter: QuranReciterSpec;
  activeReciter: QuranReciterSpec | null;
  usedAdultFallback: boolean;
  audioAvailable: boolean;
}

export interface QuranCatalogPayload {
  quranSchemaReady: boolean;
  featureEnabled: boolean;
  attributionNotice?: string;
  surahs: QuranSurahSpec[];
  reciters: QuranReciterSpec[];
  stories: QuranStorySpec[];
  manners: QuranMannerSpec[];
  playbackDefaultResolution: QuranPlaybackResolution;
  phraseAssets?: {
    basmala: QuranPhraseAudioAssetConfig;
    closing: QuranPhraseAudioAssetConfig;
  };
}

export interface ChildQuranSummaryPayload {
  quranSchemaReady: boolean;
  childId: string;
  internalAgeBand: InternalAgeBand;
  featureEnabled: boolean;
  settings: QuranChildSettings;
  playbackResolution: QuranPlaybackResolution;
  minutesUsedToday: number;
  dailyLimitReached: boolean;
  surahProgress: QuranSurahProgress[];
  storyProgress: QuranStoryProgress[];
  storyProgressDetails?: QuranStoryProgressDetails[];
  mannerProgress: QuranMannerProgress[];
  recentEvents: QuranActivityEvent[];
  growthSummary: {
    listenedSurahsCount: number;
    practicedSurahsCount: number;
    familiarSurahsCount: number;
    parentConfirmedCount: number;
    storiesReadCount: number;
    mannersPracticedCount: number;
  };
}

export interface AdminQuranVerificationsPayload {
  quranSchemaReady?: boolean;
  surahTexts: Array<{
    contentKey: string;
    contentType: 'surah_text';
    nameAr: string;
    nameEn: string;
    ayahCount: number;
    textSource: string;
    textSourceUrl: string;
    textSha256: string;
    verificationStatus: string;
  }>;
  reciters: QuranReciterSpec[];
  customRecords: QuranContentVerificationRecord[];
  phraseAssets?: {
    basmala: QuranPhraseAudioAssetConfig;
    closing: QuranPhraseAudioAssetConfig;
  };
  releaseReadiness?: QuranReleaseReadinessSummary;
  basmalaCandidate?: {
    audioUrl: string | null;
    verseKey: string;
    recitationId: number;
    reciterName: string;
    source: 'phrase_record' | 'reciter_record' | 'provider_cache' | 'qf_public_api_v4' | 'none';
    probe?: QuranAudioProbeDiagnostics | null;
    configuredMirrorUrl?: string | null;
    configuredMirrorProbe?: QuranAudioProbeDiagnostics | null;
    authorizedFallbackUrl?: string | null;
  };
  licenseAndAttribution?: {
    sourceName: string;
    attributionText: string;
    usageRestrictions: string[];
    commercialUsePermittedForIntegratedApp?: boolean;
    commercialUseClaimed: boolean;
    paidApiLicenseRequired?: boolean;
    adminConfirmationRequired?: boolean;
    termsVersion?: string;
  };
}
