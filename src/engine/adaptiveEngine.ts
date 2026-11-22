import { GAME_ACTIVITIES } from '../data/activities';
import { LEARNING_WORLDS } from '../data/worlds';
import { SKILL_LABELS } from '../i18n/translations';
import {
  AdaptiveDifficultyTier,
  ChildProfile,
  GameActivity,
  GameQuestion,
  LocalizedText,
  ParentInsight,
  SkillId,
  SkillProgress,
  StoredAgeGroupId,
  WorldId,
  LearningWorld,
} from '../types/nonoland';
import { isContentAppropriateForChild } from '../utils/ageAdaptation';

export const SPACED_REVIEW_DAYS = [1, 3, 7, 14] as const;

export interface AdaptiveRecommendation {
  activity: GameActivity;
  worldId: WorldId;
  reason: LocalizedText;
  focusSkill: SkillId;
  suggestedDifficulty: AdaptiveDifficultyTier;
}

/**
 * Computes an adaptive skill update grounded in multi-evidence mastery:
 * - Never marks a skill 'mastered' from 1 correct answer.
 * - Requires sustained accuracy across multiple attempts (activities + assessments/unseen items).
 * - Adjusts difficulty gradually (easy -> medium -> advanced) after sustained success.
 * - Schedules non-punitive spaced repetition intervals (1d -> 3d -> 7d -> 14d).
 */
export function evaluateSkillUpdate(
  prev: SkillProgress,
  input: {
    accuracy: number;
    isAssessment?: boolean;
    isUnseenCheck?: boolean;
    isRetentionReview?: boolean;
    nowIso?: string;
  },
): SkillProgress {
  const nowIso = input.nowIso || new Date().toISOString();
  const prevEvidence = prev.evidenceSummary || {
    assessmentsCount: 0,
    activitiesCount: 0,
    unseenItemsCorrect: 0,
    retentionPassed: false,
  };

  const totalAttempts = prev.attempts + 1;
  const passed = input.accuracy >= 70;
  const totalCorrect = prev.correctCount + (passed ? 1 : 0);
  const avgAcc =
    prev.attempts === 0
      ? Math.round(input.accuracy)
      : Math.round((prev.accuracy * prev.attempts + input.accuracy) / totalAttempts);

  const nextStreak = passed ? prev.streak + 1 : 0;
  const sustainedStreak = input.accuracy >= 75 ? (prev.sustainedStreak || 0) + 1 : Math.max(0, (prev.sustainedStreak || 0) - 1);

  const nextEvidence = {
    assessmentsCount: prevEvidence.assessmentsCount + (input.isAssessment ? 1 : 0),
    activitiesCount: prevEvidence.activitiesCount + (input.isAssessment ? 0 : 1),
    unseenItemsCorrect: prevEvidence.unseenItemsCorrect + (input.isUnseenCheck && passed ? 1 : 0),
    retentionPassed: prevEvidence.retentionPassed || Boolean(input.isRetentionReview && passed),
  };

  // Gradual difficulty tier adjustments (requires sustained streak, never jumps on 1 try)
  const currentTier: AdaptiveDifficultyTier = prev.difficultyTier || 'easy';
  let nextTier: AdaptiveDifficultyTier = currentTier;
  if (currentTier === 'easy' && sustainedStreak >= 2 && avgAcc >= 75) {
    nextTier = 'medium';
  } else if (currentTier === 'medium' && sustainedStreak >= 4 && avgAcc >= 85) {
    nextTier = 'advanced';
  } else if (input.accuracy < 55 && currentTier === 'advanced') {
    nextTier = 'medium';
  } else if (input.accuracy < 50 && currentTier === 'medium') {
    nextTier = 'easy';
  }

  // Multi-evidence mastery rule: never mastered on 1 attempt!
  let masteryLevel: SkillProgress['masteryLevel'] = 'exploring';
  let masteryReason: LocalizedText = {
    ar: 'بداية الاستكشاف — نواصل التدريب اللطيف لبناء الثقة.',
    en: 'Early exploration — gentle practice continues to build confidence.',
  };

  const hasMultiEvidence =
    totalAttempts >= 3 &&
    (nextEvidence.assessmentsCount >= 1 || nextEvidence.activitiesCount >= 3 || nextEvidence.unseenItemsCorrect >= 1);

  if (hasMultiEvidence && avgAcc >= 85 && totalCorrect >= 3) {
    masteryLevel = 'mastered';
    masteryReason = {
      ar: `أظهر الطفل إتقاناً ثابتاً (${avgAcc}%) عبر ${totalAttempts} محاولات متنوعة ومراجعة دورية.`,
      en: `Demonstrated steady mastery (${avgAcc}%) across ${totalAttempts} varied attempts and checks.`,
    };
  } else if (totalAttempts >= 2 && avgAcc >= 75) {
    masteryLevel = 'confident';
    masteryReason = {
      ar: `تقدم واثق (${avgAcc}%) عبر ${totalAttempts} محاولات؛ ينصح بتحدٍّ إضافي جديد لتثبيت الإتقان.`,
      en: `Confident progress (${avgAcc}%) across ${totalAttempts} attempts; one more fresh check confirms mastery.`,
    };
  } else if (totalAttempts >= 1 && (passed || avgAcc >= 55)) {
    masteryLevel = 'growing';
    masteryReason = {
      ar: `مهارة متنامية (${avgAcc}%) — خطوات متدرجة مناسبة لعمر الطفل.`,
      en: `Growing skill (${avgAcc}%) — advancing smoothly at a child-friendly pace.`,
    };
  }

  // Spaced repetition interval: 1d -> 3d -> 7d -> 14d (non-punitive)
  const prevInterval = prev.reviewIntervalDays || 1;
  let nextIntervalDays = 1;
  if (passed) {
    if (prevInterval < 3 && totalAttempts >= 2) nextIntervalDays = 3;
    else if (prevInterval === 3 && masteryLevel === 'confident') nextIntervalDays = 7;
    else if (prevInterval >= 7 && masteryLevel === 'mastered') nextIntervalDays = 14;
    else nextIntervalDays = prevInterval;
  } else {
    nextIntervalDays = 1; // gentle next-day review, never reset mastery harshly
  }

  const nextReviewDueAt = new Date(
    Date.parse(nowIso) + nextIntervalDays * 24 * 3600_000,
  ).toISOString();

  return {
    skillId: prev.skillId,
    attempts: totalAttempts,
    correctCount: totalCorrect,
    accuracy: avgAcc,
    streak: nextStreak,
    sustainedStreak,
    difficultyTier: nextTier,
    masteryLevel,
    lastPracticedAt: nowIso,
    nextReviewDueAt,
    reviewIntervalDays: nextIntervalDays,
    masteryReason,
    evidenceSummary: nextEvidence,
  };
}

/**
 * Transparent rule-based adaptive learning engine:
 * 1. Checks spaced repetition due skills first (non-punitive gentle review).
 * 2. Filters activities eligible for the child's age group & gradual difficulty tier.
 * 3. Avoids immediate repetition of the most recent completed activity.
 * 4. Returns a tailored recommendation + human-readable explanation for Parent/Teacher & Child.
 */
export function getAdaptiveRecommendation(child: ChildProfile): AdaptiveRecommendation {
  const ageActivities = GAME_ACTIVITIES.filter((a) => isContentAppropriateForChild(a, child));
  const pool =
    ageActivities.length > 0
      ? ageActivities
      : GAME_ACTIVITIES.filter((a) => a.ageEligibility.includes('1-4'));
  const nowMs = Date.now();

  // Score skills by review due date, low attempt count, or lower accuracy
  const skillEntries = Object.values(child.skillProgress);
  const prioritizedSkills = [...skillEntries].sort((a, b) => {
    const aDue = a.nextReviewDueAt && Date.parse(a.nextReviewDueAt) <= nowMs ? 1 : 0;
    const bDue = b.nextReviewDueAt && Date.parse(b.nextReviewDueAt) <= nowMs ? 1 : 0;
    if (aDue !== bDue) return bDue - aDue;
    if (a.attempts === 0 && b.attempts > 0) return -1;
    if (b.attempts === 0 && a.attempts > 0) return 1;
    return a.accuracy - b.accuracy;
  });

  for (const skill of prioritizedSkills) {
    const tier: AdaptiveDifficultyTier = skill.difficultyTier || 'easy';
    const maxDiff = tier === 'advanced' ? 3 : tier === 'medium' ? 2 : 1;
    const candidates = pool.filter(
      (a) =>
        a.skillId === skill.skillId &&
        a.id !== child.recentActivityId &&
        a.difficulty <= maxDiff,
    );
    const fallbackCandidates = pool.filter(
      (a) => a.skillId === skill.skillId && a.id !== child.recentActivityId,
    );
    const chosenList = candidates.length > 0 ? candidates : fallbackCandidates;
    const uncompleted = chosenList.find((c) => !child.completedActivityIds.includes(c.id)) || chosenList[0];

    if (uncompleted) {
      const skillName = SKILL_LABELS[skill.skillId];
      const isDue = skill.nextReviewDueAt && Date.parse(skill.nextReviewDueAt) <= nowMs;
      const reason: LocalizedText = isDue
        ? {
            ar: `مراجعة متباعدة هادئة لتثبيت مهارة ${skillName.ar} (${skill.accuracy}%)`,
            en: `Gentle spaced review to lock in ${skillName.en} (${skill.accuracy}% accuracy)`,
          }
        : skill.attempts === 0
          ? {
              ar: `فرصة جديدة لاكتشاف مهارة ${skillName.ar} بمستوى ${tier === 'easy' ? 'مبدئي لطيف' : 'متدرج'}`,
              en: `A fresh ${tier} adventure to start building ${skillName.en}`,
            }
          : skill.accuracy < 75
            ? {
                ar: `تدريب متدرج (${tier === 'easy' ? 'سهل' : 'متوسط'}) لتعزيز الثقة في ${skillName.ar}`,
                en: `Supportive ${tier} practice to strengthen confidence in ${skillName.en}`,
              }
            : {
                ar: `استمرار التألق في ${skillName.ar} مع خطوة ${tier === 'advanced' ? 'متقدمة' : 'متدرجة'} جديدة`,
                en: `Keep shining in ${skillName.en} with a new ${tier} challenge`,
              };

      return {
        activity: uncompleted,
        worldId: uncompleted.worldId,
        reason,
        focusSkill: skill.skillId,
        suggestedDifficulty: tier,
      };
    }
  }

  const fallback =
    pool.find((a) => !child.completedActivityIds.includes(a.id)) ||
    pool.find((a) => a.worldId === child.favoriteWorldId) ||
    pool[0];

  return {
    activity: fallback,
    worldId: fallback.worldId,
    reason: {
      ar: 'نشاط ممتع اختاره نونو خصيصاً لرحلتك اليوم',
      en: 'A playful adventure Nono picked for your journey today',
    },
    focusSkill: fallback.skillId,
    suggestedDifficulty: 'easy',
  };
}

export interface DiscoveryLabQuestion {
  id: string;
  skillId: SkillId;
  difficulty: 1 | 2 | 3;
  question: GameQuestion;
  sourceWorldId: WorldId;
}

export function buildAgeAssessmentDeck(
  ageGroup: StoredAgeGroupId,
  child?: Pick<ChildProfile, 'ageGroup' | 'birthYear' | 'birthMonth' | 'skillProgress'> | null,
): DiscoveryLabQuestion[] {
  const eligibleActivities = GAME_ACTIVITIES.filter((a) => {
    const isTapOrSeq = a.mechanic === 'visual-tap' || a.mechanic === 'sequence-builder';
    if (!isTapOrSeq || a.questions.length === 0) return false;
    if (child) return isContentAppropriateForChild(a, child);
    return a.ageEligibility.includes(ageGroup === '3-4' ? '1-4' : ageGroup);
  });

  const deck: DiscoveryLabQuestion[] = [];
  const seenSkills = new Set<SkillId>();

  for (const act of eligibleActivities) {
    if (!seenSkills.has(act.skillId) && act.questions[0]) {
      seenSkills.add(act.skillId);
      deck.push({
        id: `lab-${act.id}-0`,
        skillId: act.skillId,
        difficulty: act.difficulty,
        question: act.questions[0],
        sourceWorldId: act.worldId,
      });
    }
    if (deck.length >= 6) break;
  }

  if (deck.length < 5) {
    for (const act of eligibleActivities) {
      for (let i = 0; i < act.questions.length; i++) {
        const qId = `lab-${act.id}-${i}`;
        if (!deck.some((d) => d.id === qId)) {
          deck.push({
            id: qId,
            skillId: act.skillId,
            difficulty: act.difficulty,
            question: act.questions[i],
            sourceWorldId: act.worldId,
          });
        }
        if (deck.length >= 5) break;
      }
      if (deck.length >= 5) break;
    }
  }

  return deck.sort((a, b) => a.difficulty - b.difficulty);
}

/**
 * Generates plain-language, data-grounded parent & teacher insights.
 */
export function generateParentInsights(child: ChildProfile): ParentInsight[] {
  const insights: ParentInsight[] = [];
  const practicedSkills = Object.values(child.skillProgress).filter((s) => s.attempts > 0);
  const l1Count = Object.values(child.level1Progress || {}).filter((p) => p.status === 'demonstrated').length;
  const totalCompletedLessons = l1Count;

  if (practicedSkills.length === 0 && totalCompletedLessons === 0) {
    insights.push({
      id: 'insight-empty',
      type: 'recommendation',
      text: {
        ar: `لم يكمل ${child.displayName} دروساً أو أنشطة مسجلة بعد. ابدأ بدرس واحد من الأكاديمية أو نشاط من الخريطة.`,
        en: `${child.displayName} has not recorded lessons or activities yet. Try one Academy lesson or Map island to begin.`,
      },
    });
    return insights;
  }

  insights.push({
    id: 'insight-lessons-count',
    type: 'strength',
    text: {
      ar: `أتمّ ${child.displayName} ${l1Count} من أصل ٧٥ درساً في مرحلة التأسيس (١–٤ سنوات).`,
      en: `${child.displayName} has completed ${l1Count} of 75 Foundations (Ages 1–4) lessons.`,
    },
  });

  const strongest = [...practicedSkills].sort((a, b) => b.accuracy - a.accuracy)[0];
  if (strongest) {
    const label = SKILL_LABELS[strongest.skillId];
    insights.push({
      id: 'insight-strong',
      type: 'strength',
      text: {
        ar: `نقطة القوة الأبرز: "${label.ar}" بدقة ${strongest.accuracy}% عبر ${strongest.attempts} محاولات.`,
        en: `Strongest area: "${label.en}" with ${strongest.accuracy}% accuracy across ${strongest.attempts} recorded attempts.`,
      },
    });
  }

  const needsPractice = [...practicedSkills].sort((a, b) => a.accuracy - b.accuracy)[0];
  if (needsPractice && needsPractice.skillId !== strongest?.skillId && needsPractice.accuracy < 85) {
    const label = SKILL_LABELS[needsPractice.skillId];
    insights.push({
      id: 'insight-practice',
      type: 'practice',
      text: {
        ar: `مهارة تحتاج إلى ممارسة لطيفة: "${label.ar}" (الدقة الحالية ${needsPractice.accuracy}%).`,
        en: `Area for gentle practice: "${label.en}" (currently ${needsPractice.accuracy}% accuracy).`,
      },
    });
  }

  const rec = getAdaptiveRecommendation(child);
  const world = LEARNING_WORLDS.find((w) => w.id === rec.worldId);
  if (world) {
    insights.push({
      id: 'insight-rec',
      type: 'recommendation',
      text: {
        ar: `التوصية التالية: "${rec.activity.title.ar}" (${rec.reason.ar}).`,
        en: `Next step: "${rec.activity.title.en}" (${rec.reason.en}).`,
      },
    });
  }

  return insights;
}

export interface WorldProgressionEntry {
  world: LearningWorld;
  status: 'completed' | 'available' | 'upcoming';
  isUnlocked: boolean;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  unlockRequirementLabel: LocalizedText;
}

/**
 * Computes Adventure Map progression tied strictly to real activities & curriculum progress.
 * Islands requiring prerequisites remain 'upcoming' until the child demonstrates real activity progress
 * (never unlocked merely by opening the app).
 */
export function getAdventureMapProgress(
  child: ChildProfile,
  options?: { minActivitiesForIntermediate?: number; minStarsForScience?: number },
): WorldProgressionEntry[] {
  const minActivities = options?.minActivitiesForIntermediate ?? 2;
  const minStarsForScience = options?.minStarsForScience ?? 5;

  const demonstratedLessonsCount =
    Object.values(child.level1Progress || {}).filter((p) => p.status === 'demonstrated').length +
    Object.values(child.level2Progress || {}).filter((p) => p.status === 'demonstrated').length;
  const realProgressActions =
    child.completedActivityIds.length + demonstratedLessonsCount + child.attempts.length;

  const starterWorlds = new Set<WorldId>([
    'arabic-letters',
    'english-letters',
    'numbers-kingdom',
    'animal-jungle',
    'colors-shapes',
  ]);

  return LEARNING_WORLDS.map((world) => {
    const worldActivities = GAME_ACTIVITIES.filter((a) => a.worldId === world.id);
    const totalCount = Math.max(1, worldActivities.length);
    const completedCount = worldActivities.filter((a) =>
      child.completedActivityIds.includes(a.id),
    ).length;
    const progressPercent = Math.min(100, Math.round((completedCount / totalCount) * 100));

    let isUnlocked = starterWorlds.has(world.id);
    let unlockRequirementLabel: LocalizedText = {
      ar: 'جزيرة متاحة للبدء فوراً',
      en: 'Ready to explore right away',
    };

    if (!isUnlocked) {
      if (world.id === 'science-galaxy') {
        isUnlocked = realProgressActions >= minActivities && child.stars >= minStarsForScience;
        unlockRequirementLabel = {
          ar: `أكمل ${minActivities} نشاطاً/درساً واجمع ${minStarsForScience} نجوم للفتح`,
          en: `Complete ${minActivities} lessons/activities & earn ${minStarsForScience} stars to unlock`,
        };
      } else {
        isUnlocked = realProgressActions >= 1;
        unlockRequirementLabel = {
          ar: 'أكمل نشاطاً واحداً أو درساً في الجزر الأولى للفتح',
          en: 'Complete 1 starter activity or lesson to unlock',
        };
      }
    }

    const status: WorldProgressionEntry['status'] = !isUnlocked
      ? 'upcoming'
      : completedCount >= totalCount
        ? 'completed'
        : 'available';

    return {
      world,
      status,
      isUnlocked,
      completedCount,
      totalCount,
      progressPercent,
      unlockRequirementLabel,
    };
  });
}
