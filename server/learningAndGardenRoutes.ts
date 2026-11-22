import crypto from 'crypto';
import type express from 'express';
import { GARDEN_ITEMS_CATALOG, sanitizeLearningGarden } from '../src/data/gardenCatalog';
import { GAME_ACTIVITIES } from '../src/data/activities';
import { ALL_LEVEL1_LESSONS } from '../src/data/level1Curriculum';
import { SKILL_LABELS } from '../src/i18n/translations';
import { sanitizeShortText } from '../src/utils/validation';
import type {
  AdaptiveLearningProfileData,
  AdaptiveSkillStatus,
  LearningGardenState,
  Level1Subject,
  SkillId,
  WeeklyReportData,
} from '../src/types/nonoland';
import {
  awardGardenMilestoneIdempotent,
  canUserAccessChild,
  createDefaultContentPolicy,
  ensureChildFamilyAndGarden,
  ensureFamilyCollections,
  getAccessibleChildrenForUser,
  isChildOrStudentRole,
  recordFamilyEvent,
  requireParentGate,
  resolveFamilyIdForUser,
  toSafeChildProfile,
} from './familyHelpers';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import { getClientIp } from './security';
import { runWithPgDbLock } from './pgStore';

interface LearningAndGardenDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
  assertChildAccess: (
    req: AuthenticatedRequest,
    res: express.Response,
    childId: string,
  ) => StoredChildRecord | null | 'untracked-sample';
}

const ALL_SKILLS: SkillId[] = [
  'early-recognition',
  'arabic-literacy',
  'english-literacy',
  'numeracy',
  'math-reasoning',
  'logic-patterns',
  'science-discovery',
  'memory-focus',
  'life-health',
  'creativity-expression',
];

function level1SubjectToSkillId(subject: Level1Subject): SkillId {
  switch (subject) {
    case 'arabic':
      return 'arabic-literacy';
    case 'english':
      return 'english-literacy';
    case 'numbers':
      return 'numeracy';
    case 'colors':
    default:
      return 'early-recognition';
  }
}

function computeAdaptiveProfile(child: StoredChildRecord): AdaptiveLearningProfileData {
  const skills: AdaptiveLearningProfileData['skills'] = ALL_SKILLS.map((skillId) => {
    const stat = child.skillProgress?.[skillId] || {
      skillId,
      attempts: 0,
      correctCount: 0,
      accuracy: 0,
      streak: 0,
      masteryLevel: 'exploring' as const,
    };

    const linkedLevel1 = Object.values(child.level1Progress || {}).filter((lp) => {
      const lessonSpec = ALL_LEVEL1_LESSONS.find((l) => l.id === lp.lessonId);
      const mapped = lessonSpec ? level1SubjectToSkillId(lessonSpec.subject) : level1SubjectToSkillId(lp.subject);
      return mapped === skillId;
    });
    const completedLessonsCount = linkedLevel1.filter((l) => l.status === 'demonstrated').length;
    const needsRevisionLessons = linkedLevel1.some((l) => l.status === 'needs-revision');
    const summarySignals =
      (stat.evidenceSummary?.assessmentsCount || 0) +
      (stat.evidenceSummary?.activitiesCount || 0) +
      (stat.evidenceSummary?.retentionPassed ? 1 : 0);
    const evidenceCount = Math.max(summarySignals, linkedLevel1.length, stat.attempts >= 2 ? 2 : stat.attempts);

    let status: AdaptiveSkillStatus = 'not-started';
    if (stat.attempts === 0 && linkedLevel1.length === 0) {
      status = 'not-started';
    } else if (needsRevisionLessons || (stat.attempts >= 3 && stat.accuracy < 60)) {
      status = 'needs-revision';
    } else if (
      (stat.masteryLevel === 'mastered' || completedLessonsCount > 0) &&
      (evidenceCount >= 2 || Boolean(stat.evidenceSummary?.retentionPassed))
    ) {
      status = 'demonstrated';
    } else if (stat.attempts >= 2 && stat.accuracy >= 70) {
      status = 'improving';
    } else if (stat.attempts >= 1 || linkedLevel1.length >= 1) {
      status = 'practicing';
    } else {
      status = 'learning';
    }

    let noteAr = 'لم يبدأ الطفل هذا المجال بعد.';
    let noteEn = 'Your child has not explored this area yet.';
    if (status === 'demonstrated') {
      noteAr = `أتقن هذا المجال بدليل متعدد (${evidenceCount} أدلة، دقة ${stat.accuracy}%).`;
      noteEn = `Demonstrated with multiple evidence points (${evidenceCount} signals, ${stat.accuracy}% accuracy).`;
    } else if (status === 'needs-revision') {
      noteAr = 'يستفيد من مراجعة لطيفة مع أمثلة بصرية مريحة.';
      noteEn = 'Would benefit from a gentle playful refresher with visual cues.';
    } else if (status === 'improving') {
      noteAr = `تقدم ملحوظ في التمارين الأخيرة (${stat.accuracy}% دقة).`;
      noteEn = `Steady upward progress across recent practice (${stat.accuracy}% accuracy).`;
    } else if (status === 'practicing') {
      noteAr = 'يتدرب حالياً لبناء الثقة من خلال أكثر من نشاط.';
      noteEn = 'Currently practicing to build steady multi-activity confidence.';
    }

    return {
      skillId,
      label: SKILL_LABELS[skillId],
      status,
      accuracy: stat.accuracy || 0,
      attempts: stat.attempts || 0,
      evidenceCount,
      completedLessonsCount,
      lastPracticedAt: stat.lastPracticedAt,
      note: { ar: noteAr, en: noteEn },
    };
  });

  // Transparent deterministic explanation for next activity
  const prioritySkill =
    skills.find((s) => s.status === 'needs-revision') ||
    skills.find((s) => s.status === 'practicing') ||
    skills.find((s) => s.status === 'not-started') ||
    skills[0];

  const completedIds = child.completedActivityIds || [];
  const matchingActivity =
    GAME_ACTIVITIES.find((a) => a.skillId === prioritySkill.skillId && !completedIds.includes(a.id)) ||
    GAME_ACTIVITIES.find((a) => a.skillId === prioritySkill.skillId) ||
    GAME_ACTIVITIES[0];

  const strongAreas = skills.filter((s) => s.status === 'demonstrated' || s.status === 'improving').map((s) => s.skillId);
  const supportAreas = skills.filter((s) => s.status === 'needs-revision' || s.status === 'practicing').map((s) => s.skillId);

  const reasonAr =
    prioritySkill.status === 'needs-revision'
      ? `نقترح "${matchingActivity.title.ar}" لأن مهارة "${prioritySkill.label.ar}" تحتاج مراجعة هادئة بناءً على النتائج الأخيرة (${prioritySkill.accuracy}%).`
      : prioritySkill.status === 'not-started'
        ? `نقترح "${matchingActivity.title.ar}" لتعريف الطفل على مهارة جديدة ("${prioritySkill.label.ar}") ضمن مرحلة المستكشف الصغير (١–٤ سنوات).`
        : `نقترح "${matchingActivity.title.ar}" لترسيخ مهارة "${prioritySkill.label.ar}" بأدلة متعددة قبل تثبيت الإتقان.`;

  const reasonEn =
    prioritySkill.status === 'needs-revision'
      ? `Recommended "${matchingActivity.title.en}" because "${prioritySkill.label.en}" shows recent review cues (${prioritySkill.accuracy}% accuracy).`
      : prioritySkill.status === 'not-started'
        ? `Recommended "${matchingActivity.title.en}" to gently introduce "${prioritySkill.label.en}" for Little Explorers (1–4).`
        : `Recommended "${matchingActivity.title.en}" to gather a second confirming practice signal for "${prioritySkill.label.en}".`;

  return {
    childId: child.id,
    stageLabel: { ar: 'المستكشف الصغير (١–٤ سنوات)', en: 'Little Explorers (1–4 Years)' },
    generatedAt: new Date().toISOString(),
    skills,
    strongAreas,
    supportAreas,
    nextRecommendedActivity: {
      lessonId: matchingActivity.id,
      worldId: matchingActivity.worldId,
      skillId: prioritySkill.skillId,
      title: matchingActivity.title,
      reason: { ar: reasonAr, en: reasonEn },
    },
  };
}

function getMondayUtcStart(dateInput?: string): Date {
  const base = dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? new Date(`${dateInput}T00:00:00.000Z`)
    : new Date();
  const utcDay = base.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + diffToMonday));
  return monday;
}

function formatDayUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildWeeklyReportForChild(child: StoredChildRecord, weekStartDate: Date): WeeklyReportData {
  const startDay = formatDayUtc(weekStartDate);
  const endDate = new Date(weekStartDate.getTime() + 6 * 86400_000);
  const endDay = formatDayUtc(endDate);
  const startMs = weekStartDate.getTime();
  const endMs = endDate.getTime() + 86400_000 - 1;

  const inWindow = (iso?: string) => {
    if (!iso) return false;
    const ts = Date.parse(iso);
    return Number.isFinite(ts) && ts >= startMs && ts <= endMs;
  };

  const timelineInWeek = (child.activityTimeline || []).filter((evt) => inWindow(evt.timestamp));
  const attemptsInWeek = (child.attempts || []).filter((lh) => inWindow(lh.completedAt));
  const l1InWeek = Object.values(child.level1Progress || {}).filter((lp) => inWindow(lp.lastPracticedAt));
  const assessmentsInWeek = (child.assessmentHistory || []).filter((sa) => inWindow(sa.date));
  const familyInWeek = (child.familyActivitiesCompleted || []).filter((fa) => inWindow(fa.completedAt));
  const readingInWeek = Object.values(child.readingStageProgress || {}).filter((rs) => inWindow(rs.completedAt));
  const labInWeek = (child.labHistory || []).filter((lh) => inWindow(lh.completedAt));
  const creativeInWeek = [
    ...(child.creativeProjects || []),
    ...(child.musicCompositions || []),
    ...(child.buildConstructions || []),
  ].filter((c) => inWindow(c.createdAt));

  const daySet = new Set<string>();
  timelineInWeek.forEach((e) => daySet.add(e.timestamp.slice(0, 10)));
  attemptsInWeek.forEach((l) => daySet.add(l.completedAt.slice(0, 10)));
  l1InWeek.forEach((lp) => daySet.add(lp.lastPracticedAt.slice(0, 10)));
  familyInWeek.forEach((f) => daySet.add(f.completedAt.slice(0, 10)));
  assessmentsInWeek.forEach((a) => daySet.add(a.date.slice(0, 10)));
  (child.activeDaysHistory || []).forEach((d) => {
    if (d >= startDay && d <= endDay) daySet.add(d);
  });

  // Only sum genuine recorded durations in this week — never invent time
  const minutesFromHistory = attemptsInWeek.reduce((acc, l) => acc + Math.max(0, Math.round((l.durationSeconds || 0) / 60)), 0);
  const minutesFromFamily = familyInWeek.reduce((acc, f) => acc + Math.max(0, f.durationMinutes || 0), 0);
  const minutesFromLab = labInWeek.length * 3;
  const minutesFromReading = readingInWeek.length * 4;
  const totalMinutes = minutesFromHistory + minutesFromFamily + minutesFromLab + minutesFromReading;

  const lessonsCompleted =
    attemptsInWeek.filter((l) => l.accuracy >= 70).length +
    l1InWeek.filter((l) => l.status === 'demonstrated').length;
  const lessonsAttempted = Math.max(lessonsCompleted, attemptsInWeek.length + l1InWeek.length);

  const starsEarned = timelineInWeek.reduce((sum, e) => sum + (e.starsEarned || 0), 0);
  const storiesCompleted = timelineInWeek.filter((e) => e.category === 'story').length + readingInWeek.filter((r) => r.mastered).length;

  const dailyBreakdown: WeeklyReportData['dailyBreakdown'] = [];
  for (let i = 0; i < 7; i += 1) {
    const dayStr = formatDayUtc(new Date(startMs + i * 86400_000));
    const evts = timelineInWeek.filter((e) => e.timestamp.slice(0, 10) === dayStr);
    const lDay = attemptsInWeek.filter((l) => l.completedAt.slice(0, 10) === dayStr);
    const fDay = familyInWeek.filter((f) => f.completedAt.slice(0, 10) === dayStr);
    const mins =
      lDay.reduce((s, l) => s + Math.round((l.durationSeconds || 0) / 60), 0) +
      fDay.reduce((s, f) => s + (f.durationMinutes || 0), 0);
    dailyBreakdown.push({
      date: dayStr,
      activitiesCount: evts.length + lDay.length + fDay.length,
      minutes: mins,
      stars: evts.reduce((s, e) => s + (e.starsEarned || 0), 0),
    });
  }

  const adaptive = computeAdaptiveProfile(child);
  const strongSkills = adaptive.strongAreas;
  const supportSkills = adaptive.supportAreas;

  // Previous week comparison
  const prevStart = new Date(startMs - 7 * 86400_000);
  const prevEndMs = startMs - 1;
  const inPrev = (iso?: string) => {
    if (!iso) return false;
    const ts = Date.parse(iso);
    return Number.isFinite(ts) && ts >= prevStart.getTime() && ts <= prevEndMs;
  };
  const prevLessonsCompleted =
    (child.attempts || []).filter((l) => inPrev(l.completedAt) && l.accuracy >= 70).length +
    Object.values(child.level1Progress || {}).filter((lp) => inPrev(lp.lastPracticedAt) && lp.status === 'demonstrated').length;
  const prevTimeline = (child.activityTimeline || []).filter((e) => inPrev(e.timestamp));
  const prevMinutes =
    (child.attempts || []).filter((l) => inPrev(l.completedAt)).reduce((a, l) => a + Math.round((l.durationSeconds || 0) / 60), 0) +
    (child.familyActivitiesCompleted || []).filter((f) => inPrev(f.completedAt)).reduce((a, f) => a + (f.durationMinutes || 0), 0);

  const summaryMessage: WeeklyReportData['summaryMessage'] =
    daySet.size === 0 && lessonsAttempted === 0 && familyInWeek.length === 0
      ? {
          ar: 'لم تُسجَّل أنشطة مكتملة في هذا الأسبوع بعد — يمكنكم البدء بقصة قصيرة أو نشاط عائلي معاً.',
          en: 'No completed activities were recorded during this week yet — start gently with a short story or Together Time.',
        }
      : {
          ar: `أتمّ ${child.displayName} ${lessonsCompleted} دروس وأكمل ${familyInWeek.length} أنشطة عائلية خلال ${daySet.size} أيام نشطة.`,
          en: `${child.displayName} completed ${lessonsCompleted} lessons and ${familyInWeek.length} Together Time moments across ${daySet.size} active day(s).`,
        };

  return {
    childId: child.id,
    childName: child.displayName,
    weekStart: startDay,
    weekEnd: endDay,
    timezone: 'UTC',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalMinutes,
      activeDaysCount: daySet.size,
      lessonsCompleted,
      lessonsAttempted,
      assessmentsCompleted: assessmentsInWeek.length,
      storiesCompleted,
      creativeActivitiesCount: creativeInWeek.length,
      togetherActivitiesCount: familyInWeek.length,
      starsEarned,
    },
    strongSkills,
    supportSkills,
    recommendedFocus: {
      skillId: adaptive.nextRecommendedActivity.skillId,
      label: SKILL_LABELS[adaptive.nextRecommendedActivity.skillId],
      suggestion: adaptive.nextRecommendedActivity.reason,
    },
    dailyBreakdown,
    comparisonPreviousWeek: {
      previousWeekStart: formatDayUtc(prevStart),
      lessonsDelta: lessonsCompleted - prevLessonsCompleted,
      minutesDelta: totalMinutes - prevMinutes,
      starsDelta: starsEarned - prevTimeline.reduce((s, e) => s + (e.starsEarned || 0), 0),
    },
    summaryMessage,
  };
}

export function registerLearningAndGardenRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  assertChildAccess,
}: LearningAndGardenDeps) {
  // 1. ADAPTIVE LEARNING PROFILE
  app.get('/api/family/children/:childId/adaptive-profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, req.authSession!.user, child, 'view_progress')) {
      return res.status(403).json({ error: 'Not authorized to view adaptive learning profile for this child.' });
    }
    res.json(computeAdaptiveProfile(child));
  });

  app.get('/api/children/:id/adaptive-profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }
    res.json(computeAdaptiveProfile(child));
  });

  // 2. WEEKLY FAMILY PROGRESS REPORT (UTC week boundaries, honest zero-fabrication telemetry)
  app.get('/api/family/children/:childId/weekly-report', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, req.authSession!.user, child, 'view_reports')) {
      return res.status(403).json({ error: 'Not authorized to view weekly report for this child.' });
    }

    const weekStartParam = typeof req.query.weekStart === 'string' ? req.query.weekStart.trim() : undefined;
    const weekStartDate = getMondayUtcStart(weekStartParam);
    const currentMonday = getMondayUtcStart();

    const availableWeeks: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      availableWeeks.push(formatDayUtc(new Date(currentMonday.getTime() - i * 7 * 86400_000)));
    }

    res.json({
      report: buildWeeklyReportForChild(child, weekStartDate),
      availableWeeks,
    });
  });

  app.get('/api/family/weekly-summary', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    if (isChildOrStudentRole(user.role)) {
      return res.status(403).json({ error: 'Child sessions cannot access family summary reports.' });
    }
    const familyId = resolveFamilyIdForUser(db, user);
    if (!familyId) {
      return res.status(403).json({ error: 'No active family access.' });
    }
    const weekStartDate = getMondayUtcStart(typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined);
    const children = getAccessibleChildrenForUser(db, user);
    res.json({
      weekStart: formatDayUtc(weekStartDate),
      reports: children.map((c) => buildWeeklyReportForChild(c, weekStartDate)),
    });
  });

  // 3. PERSONAL LEARNING GARDEN (Server-validated, idempotent, non-punitive)
  app.get('/api/children/:id/garden', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }
    ensureChildFamilyAndGarden(db, child);
    res.json({
      garden: sanitizeLearningGarden(child.learningGarden),
      catalog: GARDEN_ITEMS_CATALOG,
      rewardEvents: (db.gardenRewardEvents?.[child.id] || []).slice(0, 30),
    });
  });

  app.post('/api/children/:id/garden/claim-milestone', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { milestoneKey } = (req.body || {}) as { milestoneKey?: string };
    const cleanKey = sanitizeShortText(milestoneKey || '', 64);

    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child not found' } };
        return null;
      }

      const rules: Record<
        string,
        { qualified: boolean; itemId: string; reason: { ar: string; en: string } }
      > = {
        'first-lesson': {
          qualified:
            (child.completedActivityIds?.length || 0) +
              (child.completedDeepLessons?.length || 0) +
              Object.keys(child.level1Progress || {}).length >=
            1,
          itemId: 'garden-sun-flower',
          reason: { ar: 'إكمال أول درس تعليمي', en: 'Completed first learning lesson' },
        },
        'two-lessons': {
          qualified:
            (child.completedActivityIds?.length || 0) +
              (child.completedDeepLessons?.length || 0) +
              Object.keys(child.level1Progress || {}).length >=
            2,
          itemId: 'garden-olive-tree',
          reason: { ar: 'إتمام درسين في الأكاديمية', en: 'Completed 2 academy lessons' },
        },
        'reading-stage': {
          qualified: Object.keys(child.readingStageProgress || {}).length >= 1,
          itemId: 'garden-blue-butterfly',
          reason: { ar: 'استكشاف مغامرة القراءة', en: 'Explored Reading Adventure' },
        },
        'creative-work': {
          qualified:
            (child.creativeProjects?.length || 0) +
              (child.musicCompositions?.length || 0) +
              (child.buildConstructions?.length || 0) >=
            1,
          itemId: 'garden-rainbow-tulip',
          reason: { ar: 'إنشاء عمل إبداعي جميل', en: 'Created a personal artwork or melody' },
        },
        'three-stories': {
          qualified: (child.completedStoryIds?.length || 0) >= 3,
          itemId: 'garden-story-stone',
          reason: { ar: 'إكمال ٣ قصص في عالم القصص', en: 'Finished 3 Story World adventures' },
        },
        'together-time': {
          qualified: (child.familyActivitiesCompleted?.length || 0) >= 1,
          itemId: 'garden-family-blossom',
          reason: { ar: 'إكمال نشاط وقتنا معاً مع العائلة', en: 'Completed a Parent-Child Together Time activity' },
        },
        'lab-experiment': {
          qualified: (child.completedLabIds?.length || 0) >= 1,
          itemId: 'garden-science-sprout',
          reason: { ar: 'إجراء تجربة في مختبر نونو', en: 'Completed a Discovery Lab experiment' },
        },
        'twelve-stars': {
          qualified: (child.stars || 0) >= 12,
          itemId: 'garden-star-lantern',
          reason: { ar: 'جمع ١٢ نجمة تعلم', en: 'Collected 12 learning stars' },
        },
        'care-three': {
          qualified: (child.learningGarden?.wateringCount || 0) >= 3,
          itemId: 'garden-ladybug',
          reason: { ar: 'سقي الحديقة برفق ٣ مرات', en: 'Watered the garden kindly 3 times' },
        },
        'five-milestones': {
          qualified: (child.activityTimeline?.length || 0) >= 5,
          itemId: 'garden-cherry-tree',
          reason: { ar: 'تحقيق ٥ خطوات تعلم ممتعة', en: 'Completed 5 joyful learning moments' },
        },
        'quran-first-listen': {
          qualified: Object.values(db.quranSurahProgress || {}).some((p) => p.childId === child.id && p.listenCount >= 1),
          itemId: 'garden-olive-tree',
          reason: { ar: 'أول لحظة استماع هادئة في عالم القرآن', en: 'First peaceful moment in Quran World' },
        },
        'quran-repeat-explorer': {
          qualified: Object.values(db.quranSurahProgress || {}).some((p) => p.childId === child.id && p.repeatSessionsCount >= 1),
          itemId: 'garden-star-lantern',
          reason: { ar: 'الترديد اللطيف لآيات القرآن الكريم', en: 'Gentle listen & repeat in Quran World' },
        },
        'quran-kind-manners': {
          qualified: Object.values(db.quranMannerProgress || {}).some((p) => p.childId === child.id && p.practicedCount >= 1),
          itemId: 'garden-family-blossom',
          reason: { ar: 'ممارسة أدب إسلامي جميل اليوم', en: 'Practiced a kind Islamic manner today' },
        },
      };

      const rule = rules[cleanKey];
      if (!rule) {
        return { status: 400, body: { error: 'Unknown garden milestone key.' } };
      }
      if (!rule.qualified) {
        return {
          status: 400,
          body: {
            error: 'Milestone requirements not yet completed.',
            code: 'MILESTONE_NOT_QUALIFIED',
          },
        };
      }

      const result = awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: cleanKey,
        preferredItemId: rule.itemId,
        reason: rule.reason,
      });

      if (result.awarded && child.familyId) {
        recordFamilyEvent(db, {
          familyId: child.familyId,
          category: 'learning',
          actionType: 'GARDEN_MILESTONE_AWARDED',
          actorId: req.authSession!.user.id,
          actorName: req.authSession!.user.displayName,
          actorRole: req.authSession!.user.role,
          childId: child.id,
          childName: child.displayName,
          title: { ar: 'نمو جديد في حديقة الطفل', en: 'Learning Garden milestone bloomed' },
          description: {
            ar: `حصل ${child.displayName} على مكافأة الحديقة: ${rule.reason.ar}`,
            en: `${child.displayName} unlocked a Learning Garden reward: ${rule.reason.en}`,
          },
          ip: getClientIp(req),
          securityEventType: 'GARDEN_REWARD',
        });
      }

      return {
        status: 200,
        body: {
          awarded: result.awarded,
          unlockedItemId: result.unlockedItemId,
          garden: child.learningGarden,
          child: toSafeChildProfile(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  });

  app.post('/api/children/:id/garden/water', requireAuth, async (req: AuthenticatedRequest, res) => {
    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      ensureFamilyCollections(db);
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child not found' } };
        return null;
      }

      ensureChildFamilyAndGarden(db, child);
      const garden = sanitizeLearningGarden(child.learningGarden);
      const nowIso = new Date().toISOString();
      garden.wateringCount += 1;
      garden.lastWateredAt = nowIso;

      const targetInstanceId = typeof req.body?.instanceId === 'string' ? req.body.instanceId : '';
      const target = garden.placements.find((p) => p.instanceId === targetInstanceId) || garden.placements[0];
      if (target) {
        target.growthStage = Math.min(3, target.growthStage + 1) as 1 | 2 | 3;
      }
      child.learningGarden = garden;

      if (garden.wateringCount >= 3) {
        awardGardenMilestoneIdempotent(db, child, {
          milestoneKey: 'care-three',
          preferredItemId: 'garden-ladybug',
          reason: { ar: 'سقي الحديقة برفق ٣ مرات', en: 'Watered the garden kindly 3 times' },
        });
      }

      return {
        status: 200,
        body: {
          garden: child.learningGarden,
          child: toSafeChildProfile(db, child),
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  });

  app.put('/api/children/:id/garden/arrange', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    ensureChildFamilyAndGarden(db, child);
    const current = sanitizeLearningGarden(child.learningGarden);
    const { theme, placements } = (req.body || {}) as Partial<LearningGardenState>;

    if (theme === 'sunny-meadow' || theme === 'spring-rain' || theme === 'starlight-garden') {
      current.theme = theme;
    }
    if (Array.isArray(placements)) {
      const unlockedSet = new Set(current.unlockedItemIds);
      current.placements = placements
        .filter((p) => p && unlockedSet.has(p.itemId))
        .slice(0, 18)
        .map((p, idx) => ({
          instanceId: sanitizeShortText(p.instanceId || `gp-${idx}`, 40),
          itemId: p.itemId,
          x: Math.min(90, Math.max(10, Math.round(Number(p.x) || 50))),
          y: Math.min(88, Math.max(24, Math.round(Number(p.y) || 64))),
          growthStage: ([1, 2, 3].includes(Number(p.growthStage)) ? Number(p.growthStage) : 1) as 1 | 2 | 3,
        }));
    }

    child.learningGarden = current;
    saveDb(db);
    res.json({ garden: current, child: toSafeChildProfile(db, child) });
  });

  // 4. AI USAGE SUMMARY & PARENT CONTROLS
  app.get('/api/family/children/:childId/ai-usage', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, req.authSession!.user, child, 'view_progress')) {
      return res.status(403).json({ error: 'Not authorized to view AI usage for this child.' });
    }
    const famId = ensureChildFamilyAndGarden(db, child);
    const policy = db.contentPolicies![famId] || createDefaultContentPolicy(famId);
    const todayKey = `${child.id}:${new Date().toISOString().slice(0, 10)}`;
    const usedToday = db.aiUsageDaily?.[todayKey] || 0;
    const records = (db.aiUsageRecords?.[child.id] || []).slice(0, 30);

    res.json({
      childId: child.id,
      aiAssistantEnabled: child.aiAssistantEnabled !== false && policy.aiCompanionEnabled,
      voiceEnabled: policy.voiceInteractionEnabled,
      usedToday,
      dailyLimit: 40,
      records,
    });
  });

  app.put('/api/family/children/:childId/ai-controls', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, user, child, 'approve_content')) {
      return res.status(403).json({ error: 'Not authorized to change AI controls for this child.' });
    }
    const famId = ensureChildFamilyAndGarden(db, child);
    const policy = db.contentPolicies![famId] || createDefaultContentPolicy(famId);

    const { aiAssistantEnabled, voiceInteractionEnabled } = (req.body || {}) as {
      aiAssistantEnabled?: boolean;
      voiceInteractionEnabled?: boolean;
    };

    if (typeof aiAssistantEnabled === 'boolean') {
      child.aiAssistantEnabled = aiAssistantEnabled;
    }
    if (typeof voiceInteractionEnabled === 'boolean') {
      policy.voiceInteractionEnabled = voiceInteractionEnabled;
      policy.updatedAt = new Date().toISOString();
      policy.updatedBy = user.displayName;
      db.contentPolicies![famId] = policy;
    }

    recordFamilyEvent(db, {
      familyId: famId,
      category: 'ai',
      actionType: 'AI_CONTROLS_UPDATED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      childId: child.id,
      childName: child.displayName,
      title: { ar: 'تحديث ضوابط المساعد الذكي نونو', en: 'Nono AI & voice controls updated' },
      description: {
        ar: `ضبط ${user.displayName} إعدادات نونو لـ ${child.displayName}`,
        en: `${user.displayName} updated Nono AI & voice settings for ${child.displayName}`,
      },
      ip: getClientIp(req),
      securityEventType: 'PARENT_SETTING_CHANGE',
    });
    saveDb(db);

    res.json({
      childId: child.id,
      aiAssistantEnabled: child.aiAssistantEnabled !== false,
      voiceInteractionEnabled: policy.voiceInteractionEnabled,
    });
  });
}
