import crypto from 'crypto';
import type express from 'express';
import { isLegacyFiveToEight } from '../src/utils/ageAdaptation';
import { evaluateSkillUpdate } from '../src/engine/adaptiveEngine';
import { sanitizeShortText } from '../src/utils/validation';
import type {
  BuildConstruction,
  LocalizedText,
  MusicComposition,
  ReadingStageId,
  SharedFamilyActivityRecord,
} from '../src/types/nonoland';
import {
  awardGardenMilestoneIdempotent,
  ensureChildFamilyAndGarden,
  isChildOrStudentRole,
  recordFamilyEvent,
} from './familyHelpers';
import { recordAuditEvent } from './auditLog';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import { getClientIp } from './security';

interface ReadingAndFamilyDeps {
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

export function registerReadingAndFamilyRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  assertChildAccess,
}: ReadingAndFamilyDeps) {
  // =========================================================================
  // PHASE 4: 8-STAGE READING ADVENTURE WITH PREREQUISITE GATING
  // =========================================================================
  app.post('/api/children/:id/reading/complete-stage', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot submit child reading adventures' });
    }

    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { stage, correctCount, totalCount } = (req.body || {}) as {
      stage?: number;
      correctCount?: number;
      totalCount?: number;
    };

    const stageNum = Number(stage) as ReadingStageId;
    if (!Number.isInteger(stageNum) || stageNum < 1 || stageNum > 8) {
      return res.status(400).json({ error: 'stage must be an integer from 1 to 8' });
    }

    const progressMap = child.readingStageProgress || {};
    // Enforce sequential prerequisite gating (Stage N requires Stage N-1 mastered unless older placement Stage <= 2)
    if (stageNum > 1) {
      const prevStage = progressMap[stageNum - 1];
      const allowPlacementSkip = isLegacyFiveToEight(child.ageGroup) && stageNum <= 2;
      if (!prevStage?.mastered && !allowPlacementSkip) {
        return res.status(400).json({
          error: `Please master Reading Stage ${stageNum - 1} before unlocking Stage ${stageNum}.`,
          code: 'READING_PREREQUISITE_LOCKED',
          requiredStage: stageNum - 1,
        });
      }
    }

    const total = Math.max(1, Math.min(20, Number(totalCount || 4)));
    const correct = Math.max(0, Math.min(total, Number(correctCount || 0)));
    const accuracy = Math.round((correct / total) * 100);
    const mastered = accuracy >= 75;

    const existing = progressMap[stageNum];
    const firstTimeMastery = mastered && !existing?.mastered;
    const starsAdded = firstTimeMastery ? 4 : mastered ? 1 : 0;

    progressMap[stageNum] = {
      stage: stageNum,
      mastered: Boolean(existing?.mastered || mastered),
      bestAccuracy: Math.max(existing?.bestAccuracy || 0, accuracy),
      attempts: (existing?.attempts || 0) + 1,
      completedAt: mastered ? new Date().toISOString() : existing?.completedAt,
    };
    child.readingStageProgress = progressMap;
    child.stars = (child.stars || 0) + starsAdded;
    child.level = Math.max(1, Math.floor(child.stars / 6) + 1);
    child.totalLearningMinutes = (child.totalLearningMinutes || 0) + 4;

    // Update reading skill honestly through multi-evidence evaluator
    const nowIso = new Date().toISOString();
    child.skillProgress['arabic-literacy'] = evaluateSkillUpdate(child.skillProgress['arabic-literacy'], {
      accuracy,
      isAssessment: stageNum >= 7,
      isUnseenCheck: stageNum >= 5,
      nowIso,
    });
    child.skillProgress['english-literacy'] = evaluateSkillUpdate(child.skillProgress['english-literacy'], {
      accuracy,
      isAssessment: stageNum >= 7,
      isUnseenCheck: stageNum >= 5,
      nowIso,
    });

    child.activityTimeline = [
      {
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: nowIso,
        category: 'reading' as const,
        title: { ar: `مغامرة القراءة — المرحلة ${stageNum}`, en: `Reading Adventure — Stage ${stageNum}` },
        detail: {
          ar: `الدقة: ${accuracy}%`,
          en: `Accuracy: ${accuracy}%`,
        },
        starsEarned: starsAdded,
      },
      ...(child.activityTimeline || []),
    ].slice(0, 120);

    if (mastered) {
      awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: 'reading-stage',
        preferredItemId: 'garden-blue-butterfly',
        reason: { ar: 'استكشاف مغامرة القراءة', en: 'Explored Reading Adventure' },
      });
    }

    recordAuditEvent(db, {
      eventType: 'READING_STAGE_COMPLETE',
      actorId: user.id,
      actorRole: user.role,
      actionType: 'COMPLETE_READING_STAGE',
      recordType: 'reading_stage',
      recordId: `${child.id}:stage-${stageNum}`,
      previousValue: existing || null,
      newValue: progressMap[stageNum],
      reason: mastered ? 'Reading stage mastered' : 'Reading stage practiced',
      ip: getClientIp(req),
      summary: `Child ${child.id} completed Reading Stage ${stageNum} (${accuracy}%, mastered=${mastered})`,
    });
    saveDb(db);

    res.json({
      stage: stageNum,
      mastered,
      accuracy,
      starsAdded,
      readingStageProgress: child.readingStageProgress,
      child,
    });
  });

  // =========================================================================
  // PHASE 6: PARENT-CHILD SHARED ACTIVITIES (NEVER INFLATES VERIFIED SKILL MASTERY!)
  // =========================================================================
  app.get('/api/children/:id/family-activity', requireAuth, (req: AuthenticatedRequest, res) => {
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }
    res.json({
      familyActivitiesCompleted: child.familyActivitiesCompleted || [],
    });
  });

  app.post('/api/children/:id/family-activity', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot log family-only shared activities' });
    }

    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { activityKey, title, durationMinutes, reflectionNote } = (req.body || {}) as {
      activityKey?: string;
      title?: LocalizedText;
      durationMinutes?: number;
      reflectionNote?: string;
    };

    const cleanKey = sanitizeShortText(activityKey || '', 64);
    if (!cleanKey) {
      return res.status(400).json({ error: 'activityKey is required' });
    }

    const mins = Math.max(3, Math.min(60, Math.round(Number(durationMinutes || 10))));
    const safeTitle: LocalizedText = {
      ar: sanitizeShortText(title?.ar || 'نشاط عائلي مشترك', 100),
      en: sanitizeShortText(title?.en || 'Parent-Child Shared Activity', 100),
    };
    const nowIso = new Date().toISOString();
    const rec: SharedFamilyActivityRecord = {
      id: `fam_${crypto.randomBytes(5).toString('hex')}`,
      activityKey: cleanKey,
      title: safeTitle,
      durationMinutes: mins,
      reflectionNote: reflectionNote ? sanitizeShortText(reflectionNote, 200) : undefined,
      guardianId: isChildOrStudentRole(user.role) ? undefined : user.id,
      guardianName: isChildOrStudentRole(user.role) ? undefined : user.displayName,
      completedAt: nowIso,
    };

    // IMPORTANT INTEGRITY INVARIANT:
    // Shared family activities enrich bonding & timeline, NEVER inflate verified skillProgress!
    child.familyActivitiesCompleted = [rec, ...(child.familyActivitiesCompleted || [])].slice(0, 60);
    child.totalLearningMinutes = (child.totalLearningMinutes || 0) + mins;
    child.stars = (child.stars || 0) + 2;
    child.level = Math.max(1, Math.floor(child.stars / 6) + 1);

    child.activityTimeline = [
      {
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: nowIso,
        category: 'family' as const,
        title: safeTitle,
        detail: {
          ar: `وقت عائلي تفاعلي (${mins} دقيقة) — لا يُحتسب كتقييم فردي`,
          en: `Shared family co-play (${mins} min) — recorded separately from independent mastery`,
        },
        starsEarned: 2,
      },
      ...(child.activityTimeline || []),
    ].slice(0, 120);

    const familyId = ensureChildFamilyAndGarden(db, child);
    const gardenReward = awardGardenMilestoneIdempotent(db, child, {
      milestoneKey: 'together-time',
      preferredItemId: 'garden-family-blossom',
      reason: { ar: 'إكمال نشاط وقتنا معاً مع العائلة', en: 'Completed a Parent-Child Together Time activity' },
    });

    recordFamilyEvent(db, {
      familyId,
      category: 'learning',
      actionType: 'TOGETHER_TIME_COMPLETED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      childId: child.id,
      childName: child.displayName,
      title: { ar: 'نشاط وقتنا معاً مكتمل', en: 'Together Time activity completed' },
      description: {
        ar: `أكمل ${user.displayName} مع ${child.displayName} نشاط "${safeTitle.ar}" (${mins} دقائق)`,
        en: `${user.displayName} completed "${safeTitle.en}" with ${child.displayName} (${mins} min)`,
      },
      ip: getClientIp(req),
      securityEventType: 'FAMILY_ACTIVITY',
    });

    recordAuditEvent(db, {
      eventType: 'FAMILY_ACTIVITY',
      actorId: user.id,
      actorRole: user.role,
      actionType: 'LOG_FAMILY_ACTIVITY',
      recordType: 'family_activity',
      recordId: rec.id,
      newValue: { activityKey: cleanKey, durationMinutes: mins },
      reason: 'Parent-child shared activity completed (skillProgress untouched)',
      ip: getClientIp(req),
      summary: `Logged shared family activity ${cleanKey} for child ${child.id}`,
    });
    saveDb(db);

    res.status(201).json({
      record: rec,
      starsAdded: 2,
      gardenRewardAwarded: gardenReward.awarded,
      familyActivitiesCompleted: child.familyActivitiesCompleted,
      child,
    });
  });

  // =========================================================================
  // PHASE 5: MUSIC COMPOSITIONS, BUILD & CREATE, LITTLE CHEF, THEATER & DISCOVERY SAVE
  // =========================================================================
  app.post('/api/children/:id/entertainment/save', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot save student entertainment creations' });
    }

    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { kind, payload } = (req.body || {}) as {
      kind?: 'music' | 'build' | 'chef' | 'theater' | 'discovery';
      payload?: Record<string, unknown>;
    };

    const nowIso = new Date().toISOString();
    let starsAdded = 0;

    if (kind === 'music') {
      const title = sanitizeShortText(payload?.title || 'ألحاني الجميلة', 64) || 'My Melody';
      const notesRaw = Array.isArray(payload?.notes) ? payload.notes.slice(0, 32) : [];
      const comp: MusicComposition = {
        id: `mus_${crypto.randomBytes(4).toString('hex')}`,
        title,
        notes: notesRaw.map((n: Record<string, unknown>, idx: number) => ({
          noteIdx: Math.max(0, Math.min(5, Number(n.noteIdx || 0))),
          instrument: (['xylophone', 'drum', 'flute', 'bell'].includes(String(n.instrument))
            ? String(n.instrument)
            : 'xylophone') as MusicComposition['notes'][number]['instrument'],
          step: Math.max(0, Math.min(31, Number(n.step ?? idx))),
        })),
        createdAt: nowIso,
      };
      child.musicCompositions = [comp, ...(child.musicCompositions || [])].slice(0, 20);
      starsAdded = 2;
    } else if (kind === 'build') {
      const title = sanitizeShortText(payload?.title || 'بنائي الذكي', 64) || 'My Build';
      const templateId = (['house', 'bridge', 'tower', 'free'].includes(String(payload?.templateId))
        ? String(payload?.templateId)
        : 'free') as BuildConstruction['templateId'];
      const blocksRaw = Array.isArray(payload?.blocks) ? payload.blocks.slice(0, 40) : [];
      const build: BuildConstruction = {
        id: `bld_${crypto.randomBytes(4).toString('hex')}`,
        title,
        templateId,
        blocks: blocksRaw.map((b: Record<string, unknown>, idx: number) => ({
          id: sanitizeShortText(b.id || `b-${idx}`, 24),
          shape: (['square', 'triangle', 'arch', 'pillar', 'window', 'tree', 'bridge'].includes(String(b.shape))
            ? String(b.shape)
            : 'square') as BuildConstruction['blocks'][number]['shape'],
          color: /^#[0-9A-Fa-f]{6}$/.test(String(b.color || '')) ? String(b.color) : '#39BDF2',
          x: Math.max(0, Math.min(11, Math.round(Number(b.x || 0)))),
          y: Math.max(0, Math.min(7, Math.round(Number(b.y || 0)))),
        })),
        createdAt: nowIso,
      };
      child.buildConstructions = [build, ...(child.buildConstructions || [])].slice(0, 20);
      starsAdded = 2;
    } else if (kind === 'chef') {
      const recipeId = sanitizeShortText(payload?.recipeId || '', 48);
      if (!recipeId) return res.status(400).json({ error: 'recipeId required' });
      const prev = new Set(child.completedRecipes || []);
      starsAdded = prev.has(recipeId) ? 0 : 2;
      prev.add(recipeId);
      child.completedRecipes = Array.from(prev);
    } else if (kind === 'theater') {
      const sceneId = sanitizeShortText(payload?.sceneId || '', 48);
      if (!sceneId) return res.status(400).json({ error: 'sceneId required' });
      const prev = new Set(child.completedTheaterScenes || []);
      starsAdded = prev.has(sceneId) ? 0 : 2;
      prev.add(sceneId);
      child.completedTheaterScenes = Array.from(prev);
    } else if (kind === 'discovery') {
      const themeId = sanitizeShortText(payload?.themeId || '', 48);
      if (!themeId) return res.status(400).json({ error: 'themeId required' });
      const prev = new Set(child.completedDiscoveryThemes || []);
      starsAdded = prev.has(themeId) ? 0 : 2;
      prev.add(themeId);
      child.completedDiscoveryThemes = Array.from(prev);
    } else {
      return res.status(400).json({ error: 'Invalid entertainment save kind' });
    }

    child.stars = (child.stars || 0) + starsAdded;
    child.level = Math.max(1, Math.floor(child.stars / 6) + 1);
    child.activityTimeline = [
      {
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: nowIso,
        category: 'entertainment' as const,
        title: { ar: `نشاط إبداعي (${kind})`, en: `Creative Activity (${kind})` },
        detail: { ar: 'حفظ في معرض الطفل الخاص', en: 'Saved privately to child portfolio' },
        starsEarned: starsAdded,
      },
      ...(child.activityTimeline || []),
    ].slice(0, 120);

    recordAuditEvent(db, {
      eventType: 'ENTERTAINMENT_SAVE',
      actorId: user.id,
      actorRole: user.role,
      actionType: `SAVE_${kind.toUpperCase()}`,
      recordType: 'entertainment',
      recordId: child.id,
      newValue: { kind, starsAdded },
      ip: getClientIp(req),
      summary: `Saved ${kind} creation for child ${child.id}`,
    });
    saveDb(db);

    res.status(201).json({ starsAdded, child });
  });
}
