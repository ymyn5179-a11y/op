import crypto from 'crypto';
import type express from 'express';
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_NEXT_MONTH_PLAN,
  DEFAULT_PARENT_SCHEDULE,
  DEFAULT_PET_STATE,
  DEFAULT_ROOM_CONFIG,
  PET_PRESET_NAMES,
  PET_SPECIES,
  REWARD_SHOP_ITEMS,
  VALID_LAB_EXPERIMENT_IDS,
  LAB_EXPERIMENTS,
} from '../src/data/worldCatalog';
import {
  buildMonthlyReport,
  buildMonthlySnapshotForChild,
  calculateStreakDays,
  getCurrentMonthKey,
  getTodayDayKey,
} from '../src/engine/monthlyReportEngine';
import { sanitizeShortText } from '../src/utils/validation';
import { recordAuditEvent } from './auditLog';
import { awardGardenMilestoneIdempotent } from './familyHelpers';
import { buildChildQuranSummary } from './quranRoutes';
import { appendSecurityLog, getClientIp } from './security';
import { runWithPgDbLock } from './pgStore';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import type {
  ActivityTimelineEvent,
  ChildAvatarConfig,
  CreativeProject,
  CustomStory,
  LearningPlanGoal,
  OfficialCharacterId,
  ParentSchedulePreferences,
  PetSpeciesId,
  PlacedRoomItem,
  RoomConfig,
} from '../src/types/nonoland';

interface WorldRouteDeps {
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

function recordActiveDayAndSnapshot(child: StoredChildRecord, event?: Omit<ActivityTimelineEvent, 'id' | 'timestamp'>) {
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

  if (event) {
    child.activityTimeline = [
      {
        id: `evt_${crypto.randomBytes(4).toString('hex')}`,
        timestamp: new Date().toISOString(),
        ...event,
      },
      ...(child.activityTimeline || []),
    ].slice(0, 120);
  }
}

function isSafeImageDataUrl(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  if (val.length > 350_000) return false;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(val);
}

export function registerWorldExperienceRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  assertChildAccess,
}: WorldRouteDeps) {
  // 1. AVATAR CUSTOMIZATION
  app.put('/api/children/:id/avatar', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot modify student avatars' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const body = (req.body || {}) as Partial<ChildAvatarConfig>;
    const current = child.avatarConfig || { ...DEFAULT_AVATAR_CONFIG };

    const validHair = ['curly', 'bob', 'spiky', 'braids', 'cap-hair', 'classic'] as const;
    const validOutfits = ['explorer', 'astronaut', 'artist', 'scientist', 'royal', 'sporty'] as const;
    const validAcc = ['none', 'glasses', 'star-pin', 'headband', 'cape', 'backpack'] as const;
    const validExpr = ['happy', 'curious', 'proud', 'silly'] as const;

    const nextAvatar: ChildAvatarConfig = {
      hairStyle: validHair.includes(body.hairStyle as typeof validHair[number])
        ? (body.hairStyle as ChildAvatarConfig['hairStyle'])
        : current.hairStyle,
      hairColor: /^#[0-9A-Fa-f]{6}$/.test(body.hairColor || '') ? body.hairColor! : current.hairColor,
      skinTone: /^#[0-9A-Fa-f]{6}$/.test(body.skinTone || '') ? body.skinTone! : current.skinTone,
      outfit: validOutfits.includes(body.outfit as typeof validOutfits[number])
        ? (body.outfit as ChildAvatarConfig['outfit'])
        : current.outfit,
      outfitColor: /^#[0-9A-Fa-f]{6}$/.test(body.outfitColor || '')
        ? body.outfitColor!
        : current.outfitColor,
      accessory: validAcc.includes(body.accessory as typeof validAcc[number])
        ? (body.accessory as ChildAvatarConfig['accessory'])
        : current.accessory,
      expression: validExpr.includes(body.expression as typeof validExpr[number])
        ? (body.expression as ChildAvatarConfig['expression'])
        : current.expression,
      unlockedCosmetics: current.unlockedCosmetics || ['explorer', 'classic', 'happy'],
    };

    child.avatarConfig = nextAvatar;
    saveDb(db);
    res.json({ avatarConfig: nextAvatar, child });
  });

  // 2. MY ROOM & GARDEN PERSISTENCE
  app.put('/api/children/:id/room', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot modify student rooms' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { roomConfig, placedRoomItems } = req.body as {
      roomConfig?: Partial<RoomConfig>;
      placedRoomItems?: PlacedRoomItem[];
    };

    const currentRoom = child.roomConfig || { ...DEFAULT_ROOM_CONFIG };
    if (roomConfig) {
      const validThemes = ['sunny', 'garden', 'starry', 'cozy-pink', 'space'] as const;
      const validWallpapers = ['solid', 'stars', 'clouds', 'stripes'] as const;
      const validFloors = ['wood', 'pastel-tile', 'star-carpet'] as const;
      const validCurtains = ['mint', 'violet', 'gold', 'none'] as const;
      const validRugs = ['cloud', 'rainbow', 'star', 'none'] as const;
      const validLights = ['daylight', 'warm-lamp', 'nightlight'] as const;

      child.roomConfig = {
        theme: validThemes.includes(roomConfig.theme as typeof validThemes[number])
          ? roomConfig.theme!
          : currentRoom.theme,
        wallColor: /^#[0-9A-Fa-f]{6}$/.test(roomConfig.wallColor || '')
          ? roomConfig.wallColor!
          : currentRoom.wallColor,
        wallpaper: validWallpapers.includes(roomConfig.wallpaper as typeof validWallpapers[number])
          ? roomConfig.wallpaper!
          : currentRoom.wallpaper,
        floorStyle: validFloors.includes(roomConfig.floorStyle as typeof validFloors[number])
          ? roomConfig.floorStyle!
          : currentRoom.floorStyle,
        curtains: validCurtains.includes(roomConfig.curtains as typeof validCurtains[number])
          ? roomConfig.curtains!
          : currentRoom.curtains,
        rug: validRugs.includes(roomConfig.rug as typeof validRugs[number])
          ? roomConfig.rug!
          : currentRoom.rug,
        lighting: validLights.includes(roomConfig.lighting as typeof validLights[number])
          ? roomConfig.lighting!
          : currentRoom.lighting,
        gardenPlants: Array.isArray(roomConfig.gardenPlants)
          ? roomConfig.gardenPlants.slice(0, 6).map((gp, idx) => ({
              id: sanitizeShortText(gp.id || `gp-${idx}`, 32),
              slotIndex: Number.isFinite(gp.slotIndex) ? Math.max(0, Math.min(5, gp.slotIndex)) : idx,
              speciesId: ['sunflower', 'lavender', 'strawberry', 'star-cactus'].includes(gp.speciesId)
                ? gp.speciesId
                : 'sunflower',
              stage: ([0, 1, 2, 3].includes(gp.stage) ? gp.stage : 0) as 0 | 1 | 2 | 3,
              waterCount: Math.max(0, Math.min(50, Number(gp.waterCount) || 0)),
              lastWateredAt: gp.lastWateredAt,
            }))
          : currentRoom.gardenPlants,
        toyTapsCount:
          typeof roomConfig.toyTapsCount === 'number'
            ? Math.max(0, roomConfig.toyTapsCount)
            : currentRoom.toyTapsCount || 0,
      };
    }

    if (Array.isArray(placedRoomItems)) {
      const sanitizedItems: PlacedRoomItem[] = placedRoomItems
        .slice(0, 24)
        .filter((item) => item && typeof item.itemId === 'string' && typeof item.instanceId === 'string')
        .map((item) => ({
          instanceId: sanitizeShortText(item.instanceId, 48),
          itemId: sanitizeShortText(item.itemId, 48),
          x: Math.min(90, Math.max(10, Math.round(Number(item.x) || 50))),
          y: Math.min(86, Math.max(16, Math.round(Number(item.y) || 60))),
        }));
      child.placedRoomItems = sanitizedItems;
    }

    saveDb(db);
    res.json({ roomConfig: child.roomConfig, placedRoomItems: child.placedRoomItems, child });
  });

  // 3. VIRTUAL PET SANCTUARY (Positive care only — no negative punishment!)
  app.post('/api/children/:id/pet', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot modify student pets' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { action, speciesId, presetNameId, accessoryId, habitatId } = req.body as {
      action?: 'adopt' | 'rename' | 'feed' | 'play' | 'decorate';
      speciesId?: PetSpeciesId;
      presetNameId?: string;
      accessoryId?: string;
      habitatId?: string;
    };

    const pet = child.petState || { ...DEFAULT_PET_STATE };
    const validSpecies = new Set(PET_SPECIES.map((s) => s.id));
    const validNames = new Set(PET_PRESET_NAMES.map((n) => n.id));

    if (action === 'adopt') {
      if (speciesId && validSpecies.has(speciesId)) pet.speciesId = speciesId;
      if (presetNameId && validNames.has(presetNameId)) pet.presetNameId = presetNameId;
      pet.adopted = true;
      pet.mood = 'happy';
      recordActiveDayAndSnapshot(child, {
        category: 'pet',
        title: { ar: 'تبنّي صديق أليف جديد!', en: 'Adopted a Virtual Pet!' },
        detail: { ar: `صديق جديد: ${pet.speciesId}`, en: `New companion: ${pet.speciesId}` },
      });
    } else if (action === 'rename') {
      if (presetNameId && validNames.has(presetNameId)) {
        pet.presetNameId = presetNameId;
      }
    } else if (action === 'feed') {
      pet.adopted = true;
      pet.careCount = (pet.careCount || 0) + 1;
      pet.mood = 'cozy';
      pet.lastInteractionAt = new Date().toISOString();
    } else if (action === 'play') {
      pet.adopted = true;
      pet.playCount = (pet.playCount || 0) + 1;
      pet.mood = 'playful';
      pet.lastInteractionAt = new Date().toISOString();
    } else if (action === 'decorate') {
      pet.adopted = true;
      if (accessoryId && typeof accessoryId === 'string') {
        const cleanAcc = sanitizeShortText(accessoryId, 40);
        pet.accessories = pet.accessories.includes(cleanAcc)
          ? pet.accessories.filter((a) => a !== cleanAcc)
          : [...pet.accessories, cleanAcc].slice(0, 6);
      }
      if (habitatId && typeof habitatId === 'string') {
        const cleanHab = sanitizeShortText(habitatId, 40);
        pet.habitatDecor = pet.habitatDecor.includes(cleanHab)
          ? pet.habitatDecor.filter((h) => h !== cleanHab)
          : [...pet.habitatDecor, cleanHab].slice(0, 6);
      }
    } else {
      return res.status(400).json({ error: 'Invalid pet action' });
    }

    child.petState = pet;
    saveDb(db);
    res.json({ petState: pet, child });
  });

  // 4. NONO'S LAB EXPERIMENT COMPLETION (Anti-duplicate star guard)
  app.post('/api/children/:id/lab/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot submit child lab experiments' });
    }
    const { experimentId, idempotencyKey } = req.body as {
      experimentId?: string;
      idempotencyKey?: string;
    };
    if (!experimentId || !VALID_LAB_EXPERIMENT_IDS.has(experimentId)) {
      return res.status(400).json({ error: 'Unknown Lab experiment ID' });
    }

    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child not found' } };
        return null;
      }

      const spec = LAB_EXPERIMENTS.find((e) => e.id === experimentId)!;
      const syncKey = idempotencyKey ? `lab:${child.id}:${idempotencyKey}` : null;
      if (syncKey && db.processedSyncKeys[syncKey]) {
        return { status: 200, body: { duplicateBlocked: true, starsAdded: 0, child } };
      }

      const completedSet = new Set(child.completedLabIds || []);
      const isFirstTime = !completedSet.has(experimentId);
      completedSet.add(experimentId);
      child.completedLabIds = Array.from(completedSet);

      const starsAdded = isFirstTime ? spec.starsReward : 0;
      child.stars += starsAdded;
      child.level = Math.max(1, Math.floor(child.stars / 6) + 1);
      child.totalLearningMinutes = (child.totalLearningMinutes || 0) + 3;

      if (!child.unlockedBadges.includes('lab-explorer')) {
        child.unlockedBadges.push('lab-explorer');
      }
      if (child.completedLabIds.length >= 4 && !child.unlockedBadges.includes('little-scientist')) {
        child.unlockedBadges.push('little-scientist');
      }

      const prevHistory = child.labHistory || [];
      const existingRec = prevHistory.find((h) => h.experimentId === experimentId);
      if (existingRec) {
        existingRec.attempts += 1;
        existingRec.completedAt = new Date().toISOString();
      } else {
        prevHistory.unshift({
          experimentId,
          completedAt: new Date().toISOString(),
          attempts: 1,
          starsAwarded: starsAdded,
          ageGroup: child.ageGroup,
        });
      }
      child.labHistory = prevHistory;

      if (syncKey) {
        db.processedSyncKeys[syncKey] = {
          childId: child.id,
          processedAt: new Date().toISOString(),
          summary: `Lab experiment ${experimentId}`,
        };
      }

      awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: 'lab-experiment',
        preferredItemId: 'garden-science-sprout',
        reason: { ar: 'إجراء تجربة في مختبر نونو', en: 'Completed a Discovery Lab experiment' },
      });

      recordActiveDayAndSnapshot(child, {
        category: 'lab',
        title: spec.title,
        detail: spec.shortTag,
        starsEarned: starsAdded,
      });

      return { status: 200, body: { starsAdded, isFirstTime, child } };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  });

  // 5. STORY WORLD COMPLETION & CREATE-YOUR-OWN STORY
  app.post('/api/children/:id/stories/complete', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot submit child stories' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { storyId, title } = req.body as { storyId?: string; title?: { ar?: string; en?: string } };
    if (!storyId || typeof storyId !== 'string') {
      return res.status(400).json({ error: 'storyId is required' });
    }

    const alreadyCompleted = child.completedStoryIds.includes(storyId);
    const starsAdded = alreadyCompleted ? 0 : 4;
    if (!alreadyCompleted) {
      child.completedStoryIds.push(storyId);
      child.stars += starsAdded;
      child.level = Math.max(1, Math.floor(child.stars / 6) + 1);
    }
    if (!child.unlockedBadges.includes('story-weaver')) {
      child.unlockedBadges.push('story-weaver');
    }

    recordActiveDayAndSnapshot(child, {
      category: 'story',
      title: {
        ar: sanitizeShortText(title?.ar || 'قصة تفاعلية', 80),
        en: sanitizeShortText(title?.en || 'Interactive Story', 80),
      },
      detail: { ar: 'قراءة وفهم القصة', en: 'Story completed' },
      starsEarned: starsAdded,
    });

    if (child.completedStoryIds.length >= 1) {
      awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: 'first-lesson',
        preferredItemId: 'garden-sun-flower',
        reason: { ar: 'إكمال أول درس أو قصة', en: 'Completed your first lesson or story' },
      });
    }
    if (child.completedStoryIds.length >= 3) {
      awardGardenMilestoneIdempotent(db, child, {
        milestoneKey: 'three-stories',
        preferredItemId: 'garden-story-stone',
        reason: { ar: 'إكمال ٣ قصص في عالم القصص', en: 'Finished 3 Story World adventures' },
      });
    }

    saveDb(db);
    res.json({ starsAdded, alreadyCompleted, child });
  });

  app.post('/api/children/:id/custom-stories', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot create student custom stories' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { title, characterId, setting, pages } = req.body as Partial<CustomStory>;
    const cleanTitle = sanitizeShortText(title || '', 80);
    if (!cleanTitle || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'Story title and at least one page are required' });
    }

    const validChars = ['nono', 'lolo', 'leo', 'bobo', 'ellie', 'titi'] as const;
    const safeChar: OfficialCharacterId = validChars.includes(characterId as OfficialCharacterId)
      ? (characterId as OfficialCharacterId)
      : 'nono';

    const newStory: CustomStory = {
      id: `cs_${crypto.randomBytes(5).toString('hex')}`,
      title: cleanTitle,
      characterId: safeChar,
      setting: sanitizeShortText(setting || 'forest', 32) || 'forest',
      pages: pages.slice(0, 6).map((p, idx) => ({
        id: `p_${idx + 1}`,
        title: sanitizeShortText(p.title || `Page ${idx + 1}`, 60),
        text: sanitizeShortText(p.text || '', 240),
        emojiScene: sanitizeShortText(p.emojiScene || '🦊✨', 24),
        characterId: validChars.includes(p.characterId) ? p.characterId : safeChar,
        backdrop: sanitizeShortText(p.backdrop || 'from-[#E5F6FF] to-[#FFF8E9]', 60),
      })),
      createdAt: new Date().toISOString(),
    };

    child.customStories = [newStory, ...(child.customStories || [])].slice(0, 20);
    recordActiveDayAndSnapshot(child, {
      category: 'creative',
      title: { ar: `ألّف قصة: ${cleanTitle}`, en: `Created Story: ${cleanTitle}` },
      detail: { ar: 'استوديو تأليف القصص', en: 'Story World Creator' },
    });

    saveDb(db);
    res.status(201).json({ customStory: newStory, child });
  });

  app.delete('/api/children/:id/custom-stories/:storyId', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }
    child.customStories = (child.customStories || []).filter((s) => s.id !== req.params.storyId);
    saveDb(db);
    res.json({ deleted: true, child });
  });

  // 6. CREATIVE STUDIO PRIVATE PROJECTS
  app.post('/api/children/:id/creative-projects', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot create student projects' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { kind, title, dataUrl, sceneJson } = req.body as Partial<CreativeProject>;
    const validKinds = ['drawing', 'coloring', 'shapes', 'stickers', 'character-decor', 'picture-story'] as const;
    if (!kind || !validKinds.includes(kind)) {
      return res.status(400).json({ error: 'Valid creative project kind is required' });
    }
    if (dataUrl !== undefined && !isSafeImageDataUrl(dataUrl)) {
      return res.status(400).json({ error: 'Invalid or oversized image dataUrl' });
    }

    const cleanTitle = sanitizeShortText(title || 'NonoLand Art', 60) || 'NonoLand Art';
    const project: CreativeProject = {
      id: `art_${crypto.randomBytes(5).toString('hex')}`,
      kind,
      title: cleanTitle,
      dataUrl,
      sceneJson: sceneJson && typeof sceneJson === 'object' ? sceneJson : undefined,
      createdAt: new Date().toISOString(),
    };

    child.creativeProjects = [project, ...(child.creativeProjects || [])].slice(0, 24);
    if (dataUrl) {
      child.savedDrawings = [
        { id: project.id, title: cleanTitle, dataUrl, createdAt: project.createdAt },
        ...(child.savedDrawings || []),
      ].slice(0, 12);
    }
    if (!child.unlockedBadges.includes('creative-artist')) {
      child.unlockedBadges.push('creative-artist');
    }

    // Grant up to 2 bonus stars only on first 3 creative saves to avoid spam farming
    const bonusStars = child.creativeProjects.length <= 3 ? 2 : 0;
    child.stars += bonusStars;

    recordActiveDayAndSnapshot(child, {
      category: 'creative',
      title: { ar: `مشروع إبداعي: ${cleanTitle}`, en: `Creative Project: ${cleanTitle}` },
      detail: { ar: kind, en: kind },
      starsEarned: bonusStars,
    });

    saveDb(db);
    res.status(201).json({ project, bonusStars, child });
  });

  app.delete('/api/children/:id/creative-projects/:projectId', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }
    child.creativeProjects = (child.creativeProjects || []).filter((p) => p.id !== req.params.projectId);
    child.savedDrawings = (child.savedDrawings || []).filter((d) => d.id !== req.params.projectId);
    saveDb(db);
    res.json({ deleted: true, child });
  });

  // 7. REWARD SHOP REDEMPTION (Authoritative server-side star balance + idempotent duplicate protection)
  app.post('/api/children/:id/shop/redeem', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot spend student stars' });
    }
    const { itemId, idempotencyKey } = req.body as { itemId?: string; idempotencyKey?: string };
    const item = REWARD_SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Reward Shop item not found' });
    }

    const outcome = await runWithPgDbLock(`child:${req.params.id}`, async (db) => {
      const child = assertChildAccess(req, res, req.params.id);
      if (!child || child === 'untracked-sample') {
        if (child === 'untracked-sample') return { status: 404, body: { error: 'Child not found' } };
        return null;
      }

      const owned = new Set(child.ownedShopItemIds || []);
      if (owned.has(item.id)) {
        return { status: 409, body: { error: 'Item already unlocked', alreadyOwned: true, child } };
      }

      const txList = child.rewardTransactions || [];
      if (idempotencyKey && txList.some((tx) => tx.idempotencyKey === idempotencyKey)) {
        return { status: 200, body: { duplicateBlocked: true, child } };
      }

      if (child.stars < item.costStars) {
        return {
          status: 400,
          body: {
            error: 'Not enough stars earned yet',
            requiredStars: item.costStars,
            currentStars: child.stars,
          },
        };
      }

      // Authoritative server deduction
      child.stars -= item.costStars;
      owned.add(item.id);
      child.ownedShopItemIds = Array.from(owned);

      // Apply corresponding unlock automatically
      if (item.category === 'room') {
        const rSet = new Set(child.unlockedRoomItems || []);
        rSet.add(item.id);
        child.unlockedRoomItems = Array.from(rSet);
      } else if (item.category === 'avatar') {
        const av = child.avatarConfig || { ...DEFAULT_AVATAR_CONFIG };
        av.unlockedCosmetics = Array.from(new Set([...(av.unlockedCosmetics || []), item.id]));
        child.avatarConfig = av;
      } else if (item.category === 'pet') {
        const pet = child.petState || { ...DEFAULT_PET_STATE };
        pet.habitatDecor = Array.from(new Set([...(pet.habitatDecor || []), item.id]));
        child.petState = pet;
      }

      const tx = {
        id: `rtx_${crypto.randomBytes(5).toString('hex')}`,
        idempotencyKey: sanitizeShortText(idempotencyKey || `${item.id}_${Date.now()}`, 64),
        itemId: item.id,
        category: item.category,
        starsSpent: item.costStars,
        redeemedAt: new Date().toISOString(),
      };
      child.rewardTransactions = [tx, ...txList].slice(0, 60);

      recordActiveDayAndSnapshot(child, {
        category: 'reward',
        title: item.name,
        detail: { ar: `تم الاستبدال مقابل ${item.costStars} نجوم`, en: `Redeemed for ${item.costStars} stars` },
      });

      recordAuditEvent(db, {
        eventType: 'REWARD_REDEEM',
        actorId: req.authSession!.user.id,
        actorRole: req.authSession!.user.role,
        actionType: 'REDEEM_REWARD_ITEM',
        recordType: 'reward_transaction',
        recordId: tx.id,
        previousValue: { stars: child.stars + item.costStars },
        newValue: { itemId: item.id, starsSpent: item.costStars, starsRemaining: child.stars },
        reason: 'Child redeemed star balance for shop item',
        ip: getClientIp(req),
        summary: `Redeemed ${item.id} (${item.costStars} stars) for child ${child.id}`,
      });

      return { status: 200, body: { redeemed: true, transaction: tx, child } };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  });

  // 8. DAILY MISSIONS VERIFIED CLAIM (Requires real completed prerequisite)
  app.post('/api/children/:id/missions/claim', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { missionId } = req.body as { missionId?: string };
    const today = getTodayDayKey();
    if (child.claimedMissionsDate !== today) {
      child.claimedMissionsDate = today;
      child.claimedMissionIdsToday = [];
    }

    const claimed = new Set(child.claimedMissionIdsToday || []);
    if (!missionId) {
      return res.status(400).json({ error: 'missionId is required' });
    }
    if (claimed.has(missionId)) {
      return res.status(409).json({ error: 'Mission reward already claimed today', duplicateBlocked: true });
    }

    // Verify real educational prerequisite rather than trusting client button click
    const hasArabic =
      Object.values(child.level1Progress || {}).some((p) => p.subject === 'arabic') ||
      Object.values(child.level2Progress || {}).some((p) => p.subject === 'arabic') ||
      child.attempts.some((a) => a.worldId === 'arabic-letters');
    const hasMath =
      Object.values(child.level1Progress || {}).some((p) => p.subject === 'numbers') ||
      Object.values(child.level2Progress || {}).some((p) => p.subject === 'math') ||
      child.attempts.some((a) => a.worldId === 'numbers-kingdom');
    const hasMemory = child.attempts.some(
      (a) => a.skillId === 'memory-focus' || a.worldId === 'intelligence-castle',
    );
    const hasStory = (child.completedStoryIds || []).length > 0;
    const hasCreativeOrLab =
      (child.completedLabIds || []).length > 0 || (child.creativeProjects || []).length > 0;

    const eligibility: Record<string, { ok: boolean; stars: number; label: { ar: string; en: string } }> = {
      'dm-arabic': { ok: hasArabic, stars: 3, label: { ar: 'مهمة اللغة العربية اليومية', en: 'Daily Arabic Mission' } },
      'dm-memory': { ok: hasMemory, stars: 3, label: { ar: 'مهمة تحدي الذاكرة', en: 'Daily Memory Mission' } },
      'dm-story': { ok: hasStory, stars: 3, label: { ar: 'مهمة الاستماع لقصة', en: 'Daily Story Mission' } },
      'dm-math': { ok: hasMath, stars: 3, label: { ar: 'مهمة العد والأرقام', en: 'Daily Math Mission' } },
      'dm-creative': { ok: hasCreativeOrLab, stars: 3, label: { ar: 'مهمة الإبداع أو المختبر', en: 'Daily Creative/Lab Mission' } },
    };

    const mission = eligibility[missionId];
    if (!mission) {
      return res.status(404).json({ error: 'Unknown missionId' });
    }
    if (!mission.ok) {
      return res.status(400).json({ error: 'Complete the mission learning activity first before claiming stars' });
    }

    claimed.add(missionId);
    child.claimedMissionIdsToday = Array.from(claimed);
    child.stars += mission.stars;

    recordActiveDayAndSnapshot(child, {
      category: 'reward',
      title: mission.label,
      detail: { ar: 'إنجاز مهمة يومية', en: 'Daily mission completed' },
      starsEarned: mission.stars,
    });

    saveDb(db);
    res.json({ claimed: true, starsAdded: mission.stars, child });
  });

  // 9. MONTHLY CHILD DEVELOPMENT REPORT
  app.get('/api/children/:id/monthly-report', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const monthParam =
      typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : getCurrentMonthKey();
    const compareParam =
      typeof req.query.compareWith === 'string' && /^\d{4}-\d{2}$/.test(req.query.compareWith)
        ? req.query.compareWith
        : undefined;

    appendSecurityLog(db.securityLogs, {
      eventType: 'STUDENT_PROGRESS_VIEW',
      actorId: req.authSession!.user.id,
      role: req.authSession!.user.role,
      ip: getClientIp(req),
      summary: `Viewed monthly report (${monthParam}) for child ${child.id}`,
    });
    saveDb(db);

    const quranSummary = buildChildQuranSummary(db, child);
    const report = buildMonthlyReport(child, monthParam, compareParam, quranSummary.growthSummary);
    res.json({ report });
  });

  // 10. PARENT LEARNING PLAN & SCHEDULE CONTROLS (Parent/Admin Only!)
  app.put('/api/children/:id/learning-plan', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession!.user.role === 'child' || req.authSession!.user.role === 'student' || req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Only parents may modify learning plans and schedules' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const { parentSchedule, nextMonthPlan } = req.body as {
      parentSchedule?: Partial<ParentSchedulePreferences>;
      nextMonthPlan?: LearningPlanGoal[];
    };

    if (parentSchedule) {
      const currentSched = child.parentSchedule || { ...DEFAULT_PARENT_SCHEDULE };
      const validDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      child.parentSchedule = {
        preferredDays: Array.isArray(parentSchedule.preferredDays)
          ? parentSchedule.preferredDays.filter((d) => validDays.includes(d))
          : currentSched.preferredDays,
        dailyGoalMinutes:
          typeof parentSchedule.dailyGoalMinutes === 'number'
            ? Math.min(90, Math.max(10, Math.round(parentSchedule.dailyGoalMinutes)))
            : currentSched.dailyGoalMinutes,
        reminderTime: /^\d{2}:\d{2}$/.test(parentSchedule.reminderTime || '')
          ? parentSchedule.reminderTime!
          : currentSched.reminderTime,
        weeklySummaryEmail:
          typeof parentSchedule.weeklySummaryEmail === 'boolean'
            ? parentSchedule.weeklySummaryEmail
            : currentSched.weeklySummaryEmail,
        achievementAlerts:
          typeof parentSchedule.achievementAlerts === 'boolean'
            ? parentSchedule.achievementAlerts
            : currentSched.achievementAlerts,
        focusAreas: Array.isArray(parentSchedule.focusAreas)
          ? parentSchedule.focusAreas.slice(0, 6)
          : currentSched.focusAreas,
      };
    }

    if (Array.isArray(nextMonthPlan)) {
      const allowedSubjects = new Set(['arabic', 'english', 'math', 'logic', 'creative', 'general']);
      child.nextMonthPlan = nextMonthPlan.slice(0, 8).map((g, i) => ({
        id: sanitizeShortText(g.id || `goal-${i}`, 32),
        subject: allowedSubjects.has(g.subject) ? g.subject : 'arabic',
        title: {
          ar: sanitizeShortText(g.title?.ar || DEFAULT_NEXT_MONTH_PLAN[0].title.ar, 120),
          en: sanitizeShortText(g.title?.en || DEFAULT_NEXT_MONTH_PLAN[0].title.en, 120),
        },
        targetCount: Math.max(1, Math.min(30, Number(g.targetCount) || 4)),
        focusNote: {
          ar: sanitizeShortText(g.focusNote?.ar || '', 180),
          en: sanitizeShortText(g.focusNote?.en || '', 180),
        },
        enabled: Boolean(g.enabled),
      }));
    }

    recordAuditEvent(db, {
      eventType: 'PARENT_SETTING_CHANGE',
      actorId: req.authSession!.user.id,
      actorRole: req.authSession!.user.role,
      actionType: 'UPDATE_LEARNING_PLAN',
      recordType: 'child_learning_plan',
      recordId: child.id,
      newValue: {
        dailyGoalMinutes: child.parentSchedule?.dailyGoalMinutes,
        goalsCount: child.nextMonthPlan?.length || 0,
      },
      reason: 'Parent updated schedule preferences or monthly goals',
      ip: getClientIp(req),
      summary: `Updated learning plan and schedule for child ${child.id}`,
    });

    saveDb(db);
    res.json({
      parentSchedule: child.parentSchedule || DEFAULT_PARENT_SCHEDULE,
      nextMonthPlan: child.nextMonthPlan || DEFAULT_NEXT_MONTH_PLAN,
      child,
    });
  });
}
