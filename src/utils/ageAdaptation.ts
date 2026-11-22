import {
  AgeGroupId,
  ChildProfile,
  InternalAgeBand,
  Language,
  LegacyAgeGroupId,
  RecommendedAgeRange,
  SkillProgress,
  StoredAgeGroupId,
} from '../types/nonoland';

export const UNIFIED_STAGE_ID: AgeGroupId = '1-4';

export const UNIFIED_STAGE_NAME = {
  ar: 'المستكشفون الصغار',
  en: 'Little Explorers',
};

export const UNIFIED_STAGE_AGE_RANGE = {
  ar: '١ – ٤ سنوات',
  en: '1–4 Years',
};

export const UNIFIED_STAGE_BADGE = {
  ar: 'المستكشفون الصغار · ١ – ٤ سنوات',
  en: 'Little Explorers · 1–4 Years',
};

export const INTERNAL_AGE_BAND_LABELS: Record<RecommendedAgeRange, { ar: string; en: string }> = {
  '1-4': { ar: 'كل المستكشفين الصغار (١ – ٤ سنوات)', en: 'All Little Explorers (1–4 yrs)' },
  '1-2': { ar: 'استكشاف حسي مبكر (١ – ٢ سنة)', en: 'Sensory Exploration (1–2 yrs)' },
  '2-3': { ar: 'مفردات ومطابقة وعد (٢ – ٣ سنوات)', en: 'Vocabulary, Matching & Counting (2–3 yrs)' },
  '3-4': { ar: 'حروف وأصوات وأنماط (٣ – ٤ سنوات)', en: 'Letters, Phonics, Numbers & Logic (3–4 yrs)' },
};

const LEGACY_5_TO_8_GROUPS = new Set<string>(['5-6', '7', '8']);

export function isLegacyFiveToEight(ageGroup: unknown): ageGroup is Exclude<LegacyAgeGroupId, '3-4'> {
  return typeof ageGroup === 'string' && LEGACY_5_TO_8_GROUPS.has(ageGroup);
}

export function isLegacyChild(child: { ageGroup?: string | null; birthYear?: number; birthMonth?: number } | null | undefined): boolean {
  if (!child) return false;
  if (isLegacyFiveToEight(child.ageGroup)) return true;
  return false;
}

export function getChildAgeMonths(
  child?: { birthYear?: number; birthMonth?: number } | null,
  refDate: Date = new Date(),
): number {
  if (!child || typeof child.birthYear !== 'number' || !Number.isFinite(child.birthYear)) return 36;
  const month =
    typeof child.birthMonth === 'number' && Number.isFinite(child.birthMonth)
      ? Math.min(12, Math.max(1, child.birthMonth))
      : 1;
  const totalMonths = (refDate.getFullYear() - child.birthYear) * 12 + (refDate.getMonth() + 1 - month);
  return Math.max(12, Math.min(120, totalMonths));
}

export function getChildAgeYears(
  child?: { birthYear?: number; birthMonth?: number } | null,
  refDate: Date = new Date(),
): number {
  const months = getChildAgeMonths(child, refDate);
  return Math.max(1, Math.floor(months / 12));
}

/**
 * Internal developmental band used silently by the adaptive engine and content selectors.
 * NEVER rendered as a separate educational stage or level selector card.
 */
export function getInternalAgeBand(
  child?: {
    birthYear?: number;
    birthMonth?: number;
    ageGroup?: StoredAgeGroupId | string;
    skillProgress?: Partial<Record<string, SkillProgress>>;
  } | null,
  refDate: Date = new Date(),
): InternalAgeBand {
  if (!child) return '2-3';
  const months = getChildAgeMonths(child, refDate);
  if (months < 28) return '1-2';
  if (months < 40) return '2-3';
  return '3-4';
}

export function getAverageDemonstratedAccuracy(
  skillProgress?: Partial<Record<string, SkillProgress>>,
): number | null {
  if (!skillProgress) return null;
  const entries = Object.values(skillProgress).filter(
    (s): s is SkillProgress => Boolean(s && s.attempts > 0),
  );
  if (entries.length === 0) return null;
  const totalAcc = entries.reduce((sum, s) => sum + s.accuracy, 0);
  return Math.round(totalAcc / entries.length);
}

/**
 * Determines whether a content item is developmentally appropriate for the active child.
 * - Never exposes 5–8 content to Little Explorers (1–4) children.
 * - Adapts internally across 1–2, 2–3, and 3–4 without creating visible stages.
 */
export function isContentAppropriateForChild(
  item: {
    ageEligibility?: StoredAgeGroupId[];
    ageGroups?: StoredAgeGroupId[];
    recommendedAgeRange?: RecommendedAgeRange;
    difficulty?: 1 | 2 | 3 | 'easy' | 'medium' | 'challenging' | 'advanced';
  },
  child?: {
    ageGroup?: StoredAgeGroupId | string;
    birthYear?: number;
    birthMonth?: number;
    skillProgress?: Partial<Record<string, SkillProgress>>;
  } | null,
): boolean {
  const groups = item.ageEligibility || item.ageGroups;
  const childAgeGroup = child?.ageGroup;

  if (child && isLegacyFiveToEight(childAgeGroup)) {
    // Legacy preserved 5-8 profile keeps backward compatibility with tagged items or unified content
    if (!groups || groups.length === 0) return true;
    return groups.includes(childAgeGroup) || groups.includes('1-4');
  }

  // Active unified stage (1-4): never serve 5-8-only content
  if (groups && groups.length > 0 && !groups.includes('1-4') && !groups.includes('3-4')) {
    return false;
  }

  const band = getInternalAgeBand(child);
  const rec = item.recommendedAgeRange;
  if (!rec || rec === '1-4') {
    // For 1-2 toddlers, gently avoid high difficulty (3 / challenging / advanced) if explicitly tagged
    if (
      band === '1-2' &&
      (item.difficulty === 3 || item.difficulty === 'challenging' || item.difficulty === 'advanced')
    ) {
      return false;
    }
    return true;
  }

  if (band === '1-2') {
    return rec === '1-2';
  }
  if (band === '2-3') {
    return rec === '1-2' || rec === '2-3';
  }
  // band === '3-4' can access foundational 2-3 and 3-4 as well as 1-2 sensory refreshers
  return rec === '1-2' || rec === '2-3' || rec === '3-4';
}

/**
 * Formats the child's actual chronological age within the 1–4 launch audience.
 */
export function formatChildActualAgeLabel(
  child?: { birthYear?: number; birthMonth?: number } | null,
  language: Language = 'ar',
  refDate: Date = new Date(),
): string {
  const years = Math.max(1, Math.min(4, getChildAgeYears(child, refDate)));
  if (language === 'ar') {
    if (years === 1) return 'سنة واحدة';
    if (years === 2) return 'سنتان';
    if (years === 3) return '٣ سنوات';
    return '٤ سنوات';
  }
  return years === 1 ? '1 Year' : `${years} Years`;
}

/**
 * Formats the child profile option inside the top header child selector.
 * Never exposes removed 5–6, 7, or 8 educational stages as selectable options.
 */
export function getHeaderChildSelectorLabel(
  child: { displayName: string; ageGroup?: StoredAgeGroupId | string | null; birthYear?: number; birthMonth?: number },
  language: Language,
): string {
  if (isLegacyFiveToEight(child.ageGroup)) {
    return language === 'ar'
      ? `${child.displayName} · سجل محفوظ`
      : `${child.displayName} · Archived Record`;
  }
  const actualAge = formatChildActualAgeLabel(child, language);
  return `${child.displayName} · ${actualAge} · ${UNIFIED_STAGE_NAME[language]} (${UNIFIED_STAGE_AGE_RANGE[language]})`;
}

/**
 * Returns a clean localized stage label. For all active children ('1-4' or migrated '3-4'),
 * always returns the single unified stage "Little Explorers (1–4 Years)".
 * For preserved legacy records, returns an archived label without exposing obsolete stage numbers.
 */
export function getSafeStageDisplay(
  ageGroup: StoredAgeGroupId | string | undefined | null,
  language: Language,
): string {
  if (!ageGroup || ageGroup === '1-4' || ageGroup === '3-4') {
    return UNIFIED_STAGE_BADGE[language];
  }
  if (isLegacyFiveToEight(ageGroup)) {
    return language === 'ar' ? 'سجل تعليمي سابق محفوظ' : 'Archived Learning Record';
  }
  return UNIFIED_STAGE_BADGE[language];
}

export function getSafeStageShortLabel(
  ageGroup: StoredAgeGroupId | string | undefined | null,
  language: Language,
): string {
  if (!ageGroup || ageGroup === '1-4' || ageGroup === '3-4') {
    return UNIFIED_STAGE_AGE_RANGE[language];
  }
  if (isLegacyFiveToEight(ageGroup)) {
    return language === 'ar' ? 'سجل محفوظ' : 'Archived';
  }
  return UNIFIED_STAGE_AGE_RANGE[language];
}

export function getRecommendedAgeLabel(
  recommended: RecommendedAgeRange | undefined,
  language: Language,
): string {
  const key: RecommendedAgeRange = recommended || '1-4';
  return INTERNAL_AGE_BAND_LABELS[key]?.[language] || INTERNAL_AGE_BAND_LABELS['1-4'][language];
}

/**
 * Safely migrates a stored ChildProfile without ever reassigning older children to 1–4.
 * - Existing '3-4' children -> migrated cleanly to '1-4'
 * - Existing legacy accounts -> left completely untouched
 * - All completed lessons, achievements, rewards, and historical progress are preserved.
 */
export function migrateChildProfileSafely<T extends Pick<ChildProfile, 'ageGroup'>>(child: T): T {
  if (!child) return child;
  if (child.ageGroup === '3-4') {
    return { ...child, ageGroup: '1-4' as StoredAgeGroupId };
  }
  return child;
}
