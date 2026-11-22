import { REWARD_BADGES } from '../data/rewardsAndRoom';
import {
  DEFAULT_NEXT_MONTH_PLAN,
  REPORT_SUBJECT_LABELS,
} from '../data/worldCatalog';
import {
  ChildProfile,
  LocalizedText,
  MonthlyReportData,
  MonthlyReportSubjectSummary,
  MonthlySnapshot,
  MonthlySubjectSnapshot,
  ReportSubjectKey,
} from '../types/nonoland';

export function getCurrentMonthKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getTodayDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function calculateStreakDays(activeDays: string[] = []): number {
  if (!activeDays || activeDays.length === 0) return 0;
  const uniqueSorted = Array.from(new Set(activeDays.map((d) => d.slice(0, 10)))).sort();
  if (uniqueSorted.length === 0) return 0;
  let streak = 1;
  for (let i = uniqueSorted.length - 1; i > 0; i -= 1) {
    const curr = new Date(`${uniqueSorted[i]}T00:00:00Z`).getTime();
    const prev = new Date(`${uniqueSorted[i - 1]}T00:00:00Z`).getTime();
    const diffDays = Math.round((curr - prev) / 86400_000);
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) break;
  }
  return streak;
}

export interface QuranGrowthMetricsInput {
  listenedSurahsCount: number;
  practicedSurahsCount: number;
  familiarSurahsCount: number;
  parentConfirmedCount: number;
  storiesReadCount: number;
  mannersPracticedCount: number;
}

export function computeChildSubjectMetrics(
  child: ChildProfile,
  quranGrowth?: QuranGrowthMetricsInput | null,
): Record<
  ReportSubjectKey,
  {
    completedCount: number;
    demonstratedCount: number;
    practicingCount: number;
    needsRevisionCount: number;
    accuracyPct: number | null;
    levelLabel: LocalizedText;
  }
> {
  const l1 = Object.values(child.level1Progress || {});
  const l2 = Object.values(child.level2Progress || {});
  const attempts = child.attempts || [];
  const labCount = (child.completedLabIds || []).length;
  const storyCount = (child.completedStoryIds || []).length;
  const creativeCount = (child.creativeProjects || []).length + (child.savedDrawings || []).length;

  const evalBucket = (
    key: ReportSubjectKey,
    l1Subs: string[],
    l2Subs: string[],
    worldIds: string[],
    skillIds: string[],
    extraCount = 0,
  ) => {
    const matchingL1 = l1.filter((p) => l1Subs.includes(p.subject));
    const matchingL2 = l2.filter((p) => l2Subs.includes(p.subject));
    const matchingAttempts = attempts.filter(
      (a) => worldIds.includes(a.worldId) || skillIds.includes(a.skillId),
    );

    const demonstratedCount =
      matchingL1.filter((p) => p.status === 'demonstrated').length +
      matchingL2.filter((p) => p.status === 'demonstrated').length +
      matchingAttempts.filter((a) => a.accuracy >= 80).length;

    const needsRevisionCount =
      matchingL1.filter((p) => p.status === 'needs-revision').length +
      matchingL2.filter((p) => p.status === 'needs-revision').length;

    const practicingCount =
      matchingL1.filter((p) => ['learning', 'practicing', 'improving'].includes(p.status)).length +
      matchingL2.filter((p) => ['learning', 'practicing', 'improving'].includes(p.status)).length +
      matchingAttempts.filter((a) => a.accuracy >= 45 && a.accuracy < 80).length;

    const completedCount =
      matchingL1.length + matchingL2.length + matchingAttempts.length + extraCount;

    const accuracySamples: number[] = [];
    matchingL1.forEach((p) => {
      if (typeof p.lastScore === 'number' && typeof p.lastTotal === 'number' && p.lastTotal > 0) {
        accuracySamples.push(Math.round((p.lastScore / p.lastTotal) * 100));
      } else if (p.correctCount + p.mistakesCount > 0) {
        accuracySamples.push(
          Math.round((p.correctCount / (p.correctCount + p.mistakesCount)) * 100),
        );
      }
    });
    matchingL2.forEach((p) => {
      if (typeof p.lastScore === 'number' && typeof p.lastTotal === 'number' && p.lastTotal > 0) {
        accuracySamples.push(Math.round((p.lastScore / p.lastTotal) * 100));
      } else if (p.correctCount + p.mistakesCount > 0) {
        accuracySamples.push(
          Math.round((p.correctCount / (p.correctCount + p.mistakesCount)) * 100),
        );
      }
    });
    matchingAttempts.forEach((a) => accuracySamples.push(a.accuracy));
    skillIds.forEach((sk) => {
      const sp = child.skillProgress?.[sk as keyof typeof child.skillProgress];
      if (sp && sp.attempts > 0) accuracySamples.push(sp.accuracy);
    });

    const accuracyPct =
      accuracySamples.length > 0
        ? Math.round(accuracySamples.reduce((s, n) => s + n, 0) / accuracySamples.length)
        : null;

    let levelLabel: LocalizedText = { ar: 'لم يبدأ بعد', en: 'Not Started Yet' };
    if (completedCount === 0 && accuracyPct === null) {
      levelLabel = { ar: 'لا توجد أنشطة كافية', en: 'Not Enough Activity Yet' };
    } else if (needsRevisionCount > demonstratedCount) {
      levelLabel = { ar: 'يحتاج إلى مراجعة', en: 'Needs Gentle Revision' };
    } else if (demonstratedCount >= 2 && (accuracyPct ?? 0) >= 80) {
      levelLabel = { ar: 'تم إظهار الفهم', en: 'Demonstrated Understanding' };
    } else if (practicingCount > 0 || completedCount > 0) {
      levelLabel = { ar: 'قيد التدريب والتطور', en: 'Practicing & Developing' };
    }

    return {
      key,
      completedCount,
      demonstratedCount,
      practicingCount,
      needsRevisionCount,
      accuracyPct,
      levelLabel,
    };
  };

  const timelineQuranCount = (child.activityTimeline || []).filter((e) => e.category === 'quran').length;
  const quranCompletedCount = quranGrowth
    ? quranGrowth.listenedSurahsCount +
      quranGrowth.practicedSurahsCount +
      quranGrowth.storiesReadCount +
      quranGrowth.mannersPracticedCount
    : timelineQuranCount;
  const quranDemonstratedCount = quranGrowth
    ? quranGrowth.parentConfirmedCount + quranGrowth.familiarSurahsCount
    : 0;
  const quranPracticingCount = Math.max(0, quranCompletedCount - quranDemonstratedCount);
  let quranLevelLabel: LocalizedText = { ar: 'رحلة هادئة بانتظارك', en: 'Waiting Gently to Begin' };
  if (quranCompletedCount > 0 || quranDemonstratedCount > 0) {
    if (quranGrowth && quranGrowth.parentConfirmedCount > 0) {
      quranLevelLabel = { ar: 'حفظ مؤكد من ولي الأمر', en: 'Parent-Confirmed Memorization' };
    } else if (quranGrowth && quranGrowth.familiarSurahsCount > 0) {
      quranLevelLabel = { ar: 'ألفة قرآنية متنامية', en: 'Growing Quran Familiarity' };
    } else {
      quranLevelLabel = { ar: 'استماع وقيم إسلامية', en: 'Gentle Listening & Values' };
    }
  }

  return {
    arabic: evalBucket('arabic', ['arabic'], ['arabic'], ['arabic-letters'], ['arabic-literacy']),
    english: evalBucket('english', ['english'], ['english'], ['english-letters'], ['english-literacy']),
    math: evalBucket('math', ['numbers'], ['math'], ['numbers-kingdom'], ['numeracy', 'math-reasoning']),
    logic: evalBucket(
      'logic',
      [],
      ['logic'],
      ['intelligence-castle'],
      ['logic-patterns', 'memory-focus', 'early-recognition'],
    ),
    creative: evalBucket(
      'creative',
      ['colors'],
      ['colors-shapes'],
      ['colors-shapes', 'creativity-island'],
      ['creativity-expression'],
      storyCount + creativeCount,
    ),
    general: evalBucket(
      'general',
      [],
      ['world-around-me'],
      ['animal-jungle', 'science-galaxy', 'healthy-body', 'life-skills'],
      ['science-discovery', 'life-health'],
      labCount,
    ),
    'quran-values': {
      completedCount: quranCompletedCount,
      demonstratedCount: quranDemonstratedCount,
      practicingCount: quranPracticingCount,
      needsRevisionCount: 0,
      accuracyPct: null,
      levelLabel: quranLevelLabel,
    },
  };
}

export function buildMonthlySnapshotForChild(child: ChildProfile, monthKey: string): MonthlySnapshot {
  const metrics = computeChildSubjectMetrics(child);
  const subjectBaseline = {} as Record<ReportSubjectKey, MonthlySubjectSnapshot>;
  (Object.keys(metrics) as ReportSubjectKey[]).forEach((k) => {
    subjectBaseline[k] = {
      subjectKey: k,
      completedCount: metrics[k].completedCount,
      accuracyPct: metrics[k].accuracyPct,
      levelLabel: metrics[k].levelLabel.en,
    };
  });

  const activeDays = (child.activeDaysHistory || []).filter((d) => d.startsWith(monthKey));
  const l1Count = Object.keys(child.level1Progress || {}).length;
  const l2Count = Object.keys(child.level2Progress || {}).length;

  return {
    monthKey,
    recordedAt: new Date().toISOString(),
    learningDays: activeDays,
    totalMinutes: child.totalLearningMinutes || 0,
    completedLessons: l1Count + l2Count + (child.completedDeepLessons?.length || 0),
    completedActivities: child.completedActivityIds.length,
    completedLabIds: [...(child.completedLabIds || [])],
    completedStoryIds: [...(child.completedStoryIds || [])],
    stars: child.stars,
    subjectBaseline,
  };
}

export function buildMonthlyReport(
  child: ChildProfile,
  monthKey = getCurrentMonthKey(),
  compareWithMonthKey?: string,
  quranGrowth?: QuranGrowthMetricsInput | null,
): MonthlyReportData {
  const metrics = computeChildSubjectMetrics(child, quranGrowth);
  const snapshots = child.monthlySnapshots || {};
  const monthSnapshot = snapshots[monthKey];
  const baselineAvailable = Boolean(monthSnapshot);

  const l1All = Object.values(child.level1Progress || {});
  const l2All = Object.values(child.level2Progress || {});
  const monthPrefix = `${monthKey}-`;

  const activeDaysInMonth = Array.from(
    new Set([
      ...(child.activeDaysHistory || []).filter((d) => d.startsWith(monthPrefix)).map((d) => d.slice(0, 10)),
      ...child.attempts.filter((a) => a.completedAt.startsWith(monthPrefix)).map((a) => a.completedAt.slice(0, 10)),
      ...l1All.filter((p) => p.lastPracticedAt?.startsWith(monthPrefix)).map((p) => p.lastPracticedAt.slice(0, 10)),
      ...l2All.filter((p) => p.lastPracticedAt?.startsWith(monthPrefix)).map((p) => p.lastPracticedAt.slice(0, 10)),
    ]),
  );

  const subjectBreakdown: MonthlyReportSubjectSummary[] = (
    Object.keys(REPORT_SUBJECT_LABELS) as ReportSubjectKey[]
  ).map((subjectKey) => {
    const curr = metrics[subjectKey];
    const base = monthSnapshot?.subjectBaseline?.[subjectKey];
    const hasSubjectBaseline =
      Boolean(base) && base!.accuracyPct !== null && curr.accuracyPct !== null;
    const delta = hasSubjectBaseline ? curr.accuracyPct! - base!.accuracyPct! : null;

    let note: LocalizedText;
    if (subjectKey === 'quran-values') {
      if (curr.completedCount === 0 && curr.demonstratedCount === 0) {
        note = {
          ar: 'مسار مستقل عن درجات الاختبارات — لم تُسجل جلسات استماع أو قصص قرآنية بعد في هذه الفترة.',
          en: 'Tracked independently from exam scores — no Quran listening or values sessions logged yet in this period.',
        };
      } else if (quranGrowth) {
        note = {
          ar: `مسار مستقل عن الاختبارات: ${quranGrowth.listenedSurahsCount} سور مسموعة · ${quranGrowth.parentConfirmedCount} محفوظة بتأكيد الأهل · ${quranGrowth.storiesReadCount} قصص · ${quranGrowth.mannersPracticedCount} آداب.`,
          en: `Independent from exam scores: ${quranGrowth.listenedSurahsCount} Surahs heard · ${quranGrowth.parentConfirmedCount} parent-confirmed · ${quranGrowth.storiesReadCount} stories · ${quranGrowth.mannersPracticedCount} manners.`,
        };
      } else {
        note = {
          ar: `مسار مستقل عن درجات الاختبارات: ${curr.completedCount} تفاعل هادئ في عالم القرآن والآداب.`,
          en: `Tracked independently from exam scores: ${curr.completedCount} peaceful Quran & values moments.`,
        };
      }
    } else if (curr.completedCount === 0) {
      note = {
        ar: 'لا توجد أنشطة مسجلة في هذا المجال بعد خلال هذه الفترة.',
        en: 'Not enough activity recorded in this domain yet for this period.',
      };
    } else if (curr.needsRevisionCount > 0) {
      note = {
        ar: `أظهر تقدماً جيداً، وننصح بمراجعة لطيفة في ${curr.needsRevisionCount} نشاطاً لترسيخ الفهم.`,
        en: `Showing active progress; ${curr.needsRevisionCount} item(s) flagged for gentle review.`,
      };
    } else if (curr.demonstratedCount >= 2) {
      note = {
        ar: `أداء متميز في ${REPORT_SUBJECT_LABELS[subjectKey].ar} مع إظهار فهم واضح.`,
        en: `Strong consistency in ${REPORT_SUBJECT_LABELS[subjectKey].en} with demonstrated mastery.`,
      };
    } else {
      note = {
        ar: 'يواصل التمرين وبناء الثقة خطوة بخطوة.',
        en: 'Steadily practicing and building confidence step by step.',
      };
    }

    return {
      subjectKey,
      title: REPORT_SUBJECT_LABELS[subjectKey],
      completedLessonsAndActivities: curr.completedCount,
      demonstratedCount: curr.demonstratedCount,
      practicingCount: curr.practicingCount,
      needsRevisionCount: curr.needsRevisionCount,
      baselineAccuracyPct: base?.accuracyPct ?? null,
      currentAccuracyPct: curr.accuracyPct,
      improvementDeltaPct: delta,
      baselineAvailable: Boolean(base && base.accuracyPct !== null),
      currentLevelLabel: curr.levelLabel,
      note,
    };
  });

  const strengths: LocalizedText[] = [];
  const areasNeedingAttention: LocalizedText[] = [];

  subjectBreakdown.forEach((s) => {
    if (s.subjectKey === 'quran-values') {
      if (s.demonstratedCount >= 1 || s.completedLessonsAndActivities >= 2) {
        strengths.push({
          ar: `${s.title.ar}: تفاعل هادئ وإيجابي (${s.completedLessonsAndActivities} نشاطاً، مستقل عن درجات الاختبارات).`,
          en: `${s.title.en}: Calm, steady engagement (${s.completedLessonsAndActivities} moments, independent of exam scores).`,
        });
      }
      return;
    }
    if (s.demonstratedCount >= 2 || (s.currentAccuracyPct !== null && s.currentAccuracyPct >= 80)) {
      strengths.push({
        ar: `${s.title.ar}: أظهر فهماً جيداً (${s.currentAccuracyPct ?? 100}% دقة عبر ${s.completedLessonsAndActivities} أنشطة).`,
        en: `${s.title.en}: Demonstrated strong understanding (${s.currentAccuracyPct ?? 100}% accuracy across ${s.completedLessonsAndActivities} activities).`,
      });
    } else if (s.needsRevisionCount > 0 || (s.currentAccuracyPct !== null && s.currentAccuracyPct < 70)) {
      areasNeedingAttention.push({
        ar: `${s.title.ar}: فرصة رائعة للتدريب اللطيف والمراجعة القصيرة لزيادة الثقة.`,
        en: `${s.title.en}: Benefits from short, encouraging practice sessions to build fluency.`,
      });
    }
  });

  if (strengths.length === 0) {
    strengths.push({
      ar: 'حماس رائع للاستكشاف؛ شجع طفلك على إكمال نشاطين جديدين هذا الأسبوع لرصد نقاط التميز بدقة.',
      en: 'Great curiosity to explore! Complete 2–3 guided lessons to highlight top strengths clearly.',
    });
  }
  if (areasNeedingAttention.length === 0) {
    areasNeedingAttention.push({
      ar: 'لا توجد نقاط صعوبة حرجة حالياً — حافظ على التنوع بين القراءة والرياضيات والعلوم.',
      en: 'No major revision flags right now — keep enjoying balanced practice across domains.',
    });
  }

  const recommendations: LocalizedText[] = [
    {
      ar: '١٠–١٥ دقيقة يومياً في القراءة الصوتية أو لعبة ذاكرة لطيفة تدعم التركيز والاستمرارية.',
      en: 'Short 10–15 minute daily sessions combining read-along stories and memory games boost retention.',
    },
    ...(areasNeedingAttention[0]
      ? [
          {
            ar: `التركيز المقترح للشهر القادم: ${areasNeedingAttention[0].ar}`,
            en: `Suggested focus for next month: ${areasNeedingAttention[0].en}`,
          },
        ]
      : []),
  ];

  const achievementsEarned = (child.unlockedBadges || []).map((bid) => {
    const found = REWARD_BADGES.find((b) => b.id === bid);
    return found
      ? { id: bid, title: found.title, emoji: found.emoji }
      : { id: bid, title: { ar: bid, en: bid }, emoji: '🏅' };
  });

  const completedLessonsCount =
    l1All.filter((p) => p.status === 'demonstrated').length +
    l2All.filter((p) => p.status === 'demonstrated').length +
    (child.completedDeepLessons?.length || 0);

  const availableMonths = Array.from(
    new Set([getCurrentMonthKey(), monthKey, ...Object.keys(snapshots)]),
  )
    .sort()
    .reverse();

  let comparison: MonthlyReportData['comparison'] = null;
  if (compareWithMonthKey && snapshots[compareWithMonthKey]) {
    const comp = snapshots[compareWithMonthKey];
    comparison = {
      compareMonthKey: compareWithMonthKey,
      learningDaysDelta: activeDaysInMonth.length - (comp.learningDays?.length || 0),
      lessonsDelta: completedLessonsCount - (comp.completedLessons || 0),
      activitiesDelta: child.completedActivityIds.length - (comp.completedActivities || 0),
      minutesDelta: (child.totalLearningMinutes || 0) - (comp.totalMinutes || 0),
      baselineAvailable: true,
    };
  } else if (compareWithMonthKey) {
    comparison = {
      compareMonthKey: compareWithMonthKey,
      learningDaysDelta: 0,
      lessonsDelta: 0,
      activitiesDelta: 0,
      minutesDelta: 0,
      baselineAvailable: false,
    };
  }

  return {
    monthKey,
    childId: child.id,
    childName: child.displayName,
    ageGroup: child.ageGroup,
    learningDaysCount: activeDaysInMonth.length,
    learningStreakDays: child.learningStreakDays ?? calculateStreakDays(child.activeDaysHistory),
    totalLearningMinutes: child.totalLearningMinutes || 0,
    completedLessonsCount,
    completedActivitiesCount: child.completedActivityIds.length,
    completedLabCount: (child.completedLabIds || []).length,
    completedStoriesCount: (child.completedStoryIds || []).length,
    assessmentsCount: (child.assessmentHistory || []).length + (child.examHistory || []).length,
    starsEarnedTotal: child.stars || 0,
    unlockedBadgesCount: (child.unlockedBadges || []).length,
    certificatesCount: (child.certificates || []).length,
    baselineAvailable,
    subjects: subjectBreakdown,
    subjectBreakdown,
    achievementsEarned,
    strengths,
    areasNeedingAttention,
    recommendations,
    nextMonthPlan: child.nextMonthPlan || DEFAULT_NEXT_MONTH_PLAN,
    availableMonths,
    comparison,
  };
}
