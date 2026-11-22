import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import {
  createInitialSkillProgress,
  createSampleChildProfiles,
  ROOM_ITEMS,
} from '../data/rewardsAndRoom';
import { getWorldById } from '../data/worlds';
import { DEFAULT_CHARACTER_OUTFITS, INITIAL_CURATED_VIDEOS } from '../data/funZoneData';
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_NEXT_MONTH_PLAN,
  DEFAULT_PARENT_SCHEDULE,
  DEFAULT_PET_STATE,
  DEFAULT_ROOM_CONFIG,
  REWARD_SHOP_ITEMS,
} from '../data/worldCatalog';
import { getCurrentMonthKey, getTodayDayKey } from '../engine/monthlyReportEngine';
import { evaluateSkillUpdate } from '../engine/adaptiveEngine';
import {
  AgeGroupId,
  AppScreen,
  AssessmentResult,
  BuildBlockItem,
  BuildConstruction,
  Certificate,
  CharacterOutfit,
  ChildAvatarConfig,
  ChildProfile,
  ConceptDomain,
  ConceptMasteryStage,
  ConceptStatus,
  CreativeProject,
  CuratedYouTubeVideo,
  CustomStory,
  ExamAttemptSummary,
  FeatureFlags,
  Language,
  LearningAttempt,
  LearningPlanGoal,
  Level1LessonProgress,
  Level2LessonProgress,
  LocalizedText,
  MusicNoteEvent,
  OfflineSyncItem,
  ParentAccount,
  ParentSchedulePreferences,
  ParentSettings,
  PetSpeciesId,
  PlacedRoomItem,
  ReadingStageId,
  RoomConfig,
  SavedDrawing,
  SharedFamilyActivityRecord,
  SkillId,
  SubscriptionState,
  WorldId,
} from '../types/nonoland';
import { migrateChildProfileSafely } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';
import { DEFAULT_FEATURE_FLAGS, formatApiErrorMessage } from '../utils/validation';

export interface AuthSessionState {
  authenticated: boolean;
  user: ParentAccount | null;
  csrfToken: string | null;
}

export interface PasswordLoginResult {
  ok: boolean;
  destination?: AppScreen;
  error?: string;
}

const VALID_AUTH_ROLES = new Set([
  'parent',
  'child',
  'student',
  'teacher',
  'admin',
  'super_admin',
  'content_admin',
  'curriculum_manager',
  'finance_admin',
  'support_agent',
]);

function resolveDestinationForRole(role?: string | null): AppScreen | null {
  if (!role || !VALID_AUTH_ROLES.has(role)) return null;
  if (role === 'teacher') return 'teacher-dashboard';
  if (role === 'student') return 'exams';
  if (role === 'child') return 'home';
  if (role === 'parent') return 'parent-dashboard';
  return 'admin-dashboard';
}

const STORAGE_KEY = 'nonoland_universe_state_v1';
const LEGACY_DEMO_IDS = new Set([
  'demo-layla-34',
  'demo-omar-56',
  'demo-zain-7',
  'demo-salma-8',
  'sample-layla-34',
  'sample-omar-23',
  'sample-maya-12',
]);

interface PersistedState {
  sampleSchemaVersion?: number;
  parentAccount: ParentAccount | null;
  parentSettings: ParentSettings;
  subscription: SubscriptionState;
  children: ChildProfile[];
  activeChildId: string | null;
  simulatedOffline: boolean;
  curatedVideos?: CuratedYouTubeVideo[];
  offlineQueue?: OfflineSyncItem[];
  lastSyncedAt?: string;
}

const DEFAULT_SETTINGS: ParentSettings = {
  language: 'ar',
  musicEnabled: true,
  sfxVolume: 0.75,
  voiceNarration: true,
  muted: false,
  dailyScreenTimeMinutes: 45,
  allowLocalAudioSynthesis: true,
  offlineSyncEnabled: true,
  reducedMotion: false,
};

function getInitialPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed && Array.isArray(parsed.children) && parsed.children.length > 0) {
        const cleanedRealOrCurrent = parsed.children
          .filter((c) => {
            const isBuiltInDemo =
              LEGACY_DEMO_IDS.has(c.id) ||
              (c.id.startsWith('demo-') && c.ageGroup !== '1-4' && c.ageGroup !== '3-4') ||
              (c.id.startsWith('sample-') && parsed.sampleSchemaVersion !== 2);
            return !isBuiltInDemo;
          })
          .map(migrateChildProfileSafely);

        const nextActiveId = cleanedRealOrCurrent.some((c) => c.id === parsed.activeChildId)
          ? parsed.activeChildId
          : cleanedRealOrCurrent[0]?.id ?? null;

        return {
          ...parsed,
          sampleSchemaVersion: 2,
          children: cleanedRealOrCurrent,
          activeChildId: nextActiveId,
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return {
    sampleSchemaVersion: 2,
    parentAccount: null,
    parentSettings: DEFAULT_SETTINGS,
    subscription: { tier: 'free', status: 'preview' },
    children: [],
    activeChildId: null,
    simulatedOffline: false,
    curatedVideos: INITIAL_CURATED_VIDEOS,
  };
}

interface NonoLandContextValue {
  screen: AppScreen;
  navigate: (screen: AppScreen, opts?: { worldId?: WorldId; activityId?: string; storyId?: string }) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  parentAccount: ParentAccount | null;
  setParentAccount: (account: ParentAccount) => void;
  authSession: AuthSessionState;
  authResolved: boolean;
  dbUnavailable: boolean;
  isChildSession: boolean;
  refreshAuthSession: () => Promise<AuthSessionState | null>;
  refreshChildrenList: () => Promise<void>;
  enterSampleDemoMode: () => void;
  loginWithPassword: (input: {
    email: string;
    password: string;
    rememberMe?: boolean;
    portal: 'parent' | 'teacher' | 'admin';
  }) => Promise<PasswordLoginResult>;
  loginWithPasskey: (input?: { email?: string; rememberMe?: boolean }) => Promise<PasswordLoginResult>;
  childLogin: (accessCode: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  childQuickLogin: (childId: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  exitChildMode: () => Promise<void>;
  logoutParent: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  parentSettings: ParentSettings;
  updateParentSettings: (patch: Partial<ParentSettings>) => void;
  subscription: SubscriptionState;
  updateSubscription: (tier: SubscriptionState['tier']) => void;
  childrenList: ChildProfile[];
  activeChild: ChildProfile | null;
  selectChild: (childId: string) => void;
  createChildProfile: (input: {
    displayName: string;
    ageGroup: AgeGroupId;
    language: Language;
    birthYear: number;
    birthMonth: number;
    interests: string[];
    companionId: string;
    companionScarfColor: string;
    pin?: string;
  }) => Promise<{ child: ChildProfile; accessCode?: string }>;
  updateChildProfile: (childId: string, patch: Partial<ChildProfile>) => void;
  selectedWorldId: WorldId;
  selectedActivityId: string;
  selectedStoryId: string;
  lastAttempt: LearningAttempt | null;
  lastNewlyUnlockedBadge: string | null;
  lastNewlyIssuedCert: Certificate | null;
  lastAssessment: AssessmentResult | null;
  showCelebration: boolean;
  dismissCelebration: () => void;
  recordGameAttempt: (input: {
    activityId: string;
    worldId: WorldId;
    skillId: SkillId;
    score: number;
    maxScore: number;
    durationSeconds: number;
  }) => void;
  recordAssessmentResult: (result: Omit<AssessmentResult, 'id' | 'date'>) => AssessmentResult;
  completeStory: (storyId: string, rewardStars: number, title?: LocalizedText) => void;
  saveDrawingToRoom: (drawing: Omit<SavedDrawing, 'id' | 'createdAt'>) => void;
  placeRoomItem: (itemId: string) => void;
  moveRoomItem: (instanceId: string, x: number, y: number) => void;
  removePlacedRoomItem: (instanceId: string) => void;
  saveRoomState: (roomConfig: RoomConfig, placedRoomItems?: PlacedRoomItem[]) => Promise<void>;
  saveAvatarConfig: (avatarConfig: ChildAvatarConfig) => Promise<void>;
  interactWithPet: (input: {
    action: 'adopt' | 'rename' | 'feed' | 'play' | 'decorate';
    speciesId?: PetSpeciesId;
    presetNameId?: string;
    accessoryId?: string;
    habitatId?: string;
  }) => Promise<void>;
  completeLabExperiment: (experimentId: string, starsReward?: number) => Promise<{ starsAdded: number }>;
  createCustomStory: (input: Omit<CustomStory, 'id' | 'createdAt'>) => Promise<void>;
  deleteCustomStory: (storyId: string) => Promise<void>;
  saveCreativeProject: (input: Omit<CreativeProject, 'id' | 'createdAt'>) => Promise<void>;
  deleteCreativeProject: (projectId: string) => Promise<void>;
  redeemShopItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  claimDailyMission: (missionId: string) => Promise<{ ok: boolean; error?: string; starsAdded?: number }>;
  saveLearningPlan: (input: {
    parentSchedule?: ParentSchedulePreferences;
    nextMonthPlan?: LearningPlanGoal[];
  }) => Promise<void>;
  toggleDownloadWorld: (worldId: WorldId) => void;
  isOnline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (val: boolean) => void;
  pendingSyncCount: number;
  offlineQueue: OfflineSyncItem[];
  lastSyncedAt?: string;
  syncOfflineQueue: () => Promise<void>;
  featureFlags: FeatureFlags;
  refreshFeatureFlags: () => Promise<void>;
  resetAllData: () => void;
  recordConceptInteraction: (input: {
    conceptId: string;
    domain: ConceptDomain;
    label: LocalizedText;
    stage: ConceptMasteryStage;
    isCorrect: boolean;
    lessonStageNum?: number;
    isIndependent?: boolean;
    isRetentionReview?: boolean;
  }) => void;
  recordLevel1Progress: (progress: Level1LessonProgress, starsAdd?: number, minutesAdd?: number) => void;
  recordLevel2Progress: (progress: Level2LessonProgress, starsAdd?: number, minutesAdd?: number) => void;
  completeDeepLesson: (input: {
    lessonId: string;
    conceptId: string;
    domain: ConceptDomain;
    label: LocalizedText;
    starsReward?: number;
    mistakesCount?: number;
  }) => void;
  recordExamCompletion: (summary: ExamAttemptSummary, issuedCert?: Certificate) => void;
  updateCharacterOutfit: (characterId: CharacterOutfit['characterId'], patch: Partial<CharacterOutfit>) => void;
  grantFunReward: (stars: number, rewardId?: string) => void;
  curatedVideos: CuratedYouTubeVideo[];
  addCuratedVideo: (video: Omit<CuratedYouTubeVideo, 'id' | 'addedAt'>) => void;
  toggleApproveVideo: (id: string) => void;
  toggleFeatureVideo: (id: string) => void;
  removeCuratedVideo: (id: string) => void;
  syncUpdatedChildFromServer: (serverChild: ChildProfile) => void;
  toggleChildAiAssistant: (childId: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  recordReadingStage: (input: {
    stage: ReadingStageId;
    correctCount: number;
    totalCount: number;
  }) => Promise<{ ok: boolean; mastered: boolean; starsAdded: number; error?: string }>;
  completeFamilyActivity: (input: {
    activityKey: string;
    title: LocalizedText;
    durationMinutes: number;
    reflectionNote?: string;
  }) => Promise<{ ok: boolean; starsAdded: number; record?: SharedFamilyActivityRecord }>;
  saveEntertainmentCreation: (input: {
    kind: 'music' | 'build' | 'chef' | 'theater' | 'discovery';
    payload: Record<string, unknown>;
  }) => Promise<{ ok: boolean; starsAdded: number }>;
}

const NonoLandContext = createContext<NonoLandContextValue | null>(null);

export const NonoLandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persisted, setPersisted] = useState<PersistedState>(getInitialPersistedState);
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [selectedWorldId, setSelectedWorldId] = useState<WorldId>('arabic-letters');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('act-ar-letter-tap-34');
  const [selectedStoryId, setSelectedStoryId] = useState<string>('story-lost-starlight-34');
  const [lastAttempt, setLastAttempt] = useState<LearningAttempt | null>(null);
  const [lastNewlyUnlockedBadge, setLastNewlyUnlockedBadge] = useState<string | null>(null);
  const [lastNewlyIssuedCert, setLastNewlyIssuedCert] = useState<Certificate | null>(null);
  const [lastAssessment, setLastAssessment] = useState<AssessmentResult | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSessionState>({
    authenticated: false,
    user: null,
    csrfToken: null,
  });
  const [authResolved, setAuthResolved] = useState(false);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const refreshFeatureFlags = async () => {
    try {
      const res = await fetch('/api/config/features');
      if (res.ok) {
        const d = (await res.json()) as { featureFlags?: FeatureFlags };
        if (d.featureFlags) setFeatureFlags(d.featureFlags);
      }
    } catch {
      // Offline / cached fallback keeps defaults
    }
  };

  const refreshChildrenList = async () => {
    try {
      const chRes = await fetch('/api/children', { credentials: 'include' });
      if (!chRes.ok) return;
      const chData = (await chRes.json()) as { children?: ChildProfile[] };
      if (Array.isArray(chData.children)) {
        const migratedServer = chData.children.map(migrateChildProfileSafely);
        setPersisted((prev) => ({
          ...prev,
          children: migratedServer,
          activeChildId: migratedServer.some((c) => c.id === prev.activeChildId)
            ? prev.activeChildId
            : migratedServer[0]?.id ?? null,
        }));
      }
    } catch {
      // ignore offline
    }
  };

  const refreshAuthSession = async (): Promise<AuthSessionState | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 503) {
          setDbUnavailable(true);
          return null;
        }
        setDbUnavailable(false);
        if (res.status === 401 || res.status === 403) {
          const cleared: AuthSessionState = { authenticated: false, user: null, csrfToken: null };
          setAuthSession(cleared);
          return cleared;
        }
        return null;
      }
      setDbUnavailable(false);
      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();
      if (/text\/html/i.test(contentType) || /^\s*(<!doctype\s+html|<html\b)/i.test(rawText)) {
        return null;
      }
      const data = (rawText.trim() ? JSON.parse(rawText) : {}) as {
        authenticated: boolean;
        user: ParentAccount | null;
        csrfToken: string | null;
        child?: ChildProfile | null;
      };
      const validDestination =
        data.authenticated && data.user ? resolveDestinationForRole(data.user.role) : null;

      if (data.authenticated && data.user && validDestination) {
        const isChildRole = data.user.role === 'child' || data.user.role === 'student';
        const nextAuth: AuthSessionState = {
          authenticated: true,
          user: data.user,
          csrfToken: data.csrfToken || null,
        };

        if (isChildRole && data.child) {
          const singleChild = migrateChildProfileSafely(data.child);
          setPersisted((prev) => ({
            ...prev,
            parentAccount: data.user,
            children: [singleChild],
            activeChildId: singleChild.id,
          }));
        } else {
          let loadedChildren: ChildProfile[] | null = null;
          try {
            const chRes = await fetch('/api/children', { credentials: 'include' });
            if (chRes.ok) {
              const chData = (await chRes.json()) as { children?: ChildProfile[] };
              if (Array.isArray(chData.children)) {
                loadedChildren = chData.children.map(migrateChildProfileSafely);
              }
            }
          } catch {
            // keep existing if transient fetch fails; authSession still reflects server session
          }
          setPersisted((prev) => ({
            ...prev,
            parentAccount: data.user,
            ...(loadedChildren !== null
              ? {
                  children: loadedChildren,
                  activeChildId: loadedChildren.some((c) => c.id === prev.activeChildId)
                    ? prev.activeChildId
                    : loadedChildren[0]?.id ?? null,
                }
              : {}),
          }));
        }
        setAuthSession(nextAuth);
        return nextAuth;
      }

      const unauthState: AuthSessionState = { authenticated: false, user: null, csrfToken: null };
      setAuthSession(unauthState);
      setPersisted((prev) => {
        const hadPrivateData =
          (prev.parentAccount && !prev.parentAccount.isDemoMode) ||
          prev.children.some((c) => c.id.startsWith('ch_'));
        if (!hadPrivateData) return prev;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        return {
          ...prev,
          parentAccount: null,
          children: [],
          activeChildId: null,
          offlineQueue: [],
          lastSyncedAt: undefined,
        };
      });
      return unauthState;
    } catch {
      return null;
    } finally {
      setAuthResolved(true);
    }
  };

  useEffect(() => {
    void refreshAuthSession();
    void refreshFeatureFlags();

    let lastResumeCheckAt = Date.now();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastResumeCheckAt > 30_000) {
          lastResumeCheckAt = now;
          void refreshAuthSession();
        }
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || '');
      if (/NotAllowedError|AbortError|play\(\) failed/i.test(msg)) {
        event.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const activeChild = useMemo<ChildProfile | null>(() => {
    if (persisted.children.length === 0) return null;
    return (
      persisted.children.find((c) => c.id === persisted.activeChildId) ||
      persisted.children[0] ||
      null
    );
  }, [persisted.children, persisted.activeChildId]);

  const language: Language = activeChild?.language || persisted.parentSettings.language || 'ar';
  const isOnline = browserOnline && !persisted.simulatedOffline;

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Storage quota fallback
    }
  }, [persisted]);

  // Sync HTML dir/lang, reduced-motion class & sound engine
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle(
      'reduced-motion',
      Boolean(persisted.parentSettings.reducedMotion),
    );
    soundEngine.updateSettings({ ...persisted.parentSettings, language });
  }, [language, persisted.parentSettings]);

  // Listen to real online/offline browser events
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const navigate = useCallback((
    nextScreen: AppScreen,
    opts?: { worldId?: WorldId; activityId?: string; storyId?: string },
  ) => {
    soundEngine.playPop();
    soundEngine.stopSpeech();
    if (opts?.worldId) setSelectedWorldId(opts.worldId);
    if (opts?.activityId) setSelectedActivityId(opts.activityId);
    if (opts?.storyId) setSelectedStoryId(opts.storyId);
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setLanguage = (lang: Language) => {
    soundEngine.playPop();
    setPersisted((prev) => ({
      ...prev,
      parentSettings: { ...prev.parentSettings, language: lang },
      children: activeChild
        ? prev.children.map((c) => (c.id === activeChild.id ? { ...c, language: lang } : c))
        : prev.children,
    }));
  };

  const setParentAccount = (account: ParentAccount) => {
    setPersisted((prev) => ({ ...prev, parentAccount: account }));
  };

  const updateParentSettings = (patch: Partial<ParentSettings>) => {
    setPersisted((prev) => ({
      ...prev,
      parentSettings: { ...prev.parentSettings, ...patch },
    }));
  };

  const updateSubscription = (tier: SubscriptionState['tier']) => {
    setPersisted((prev) => ({
      ...prev,
      subscription: { tier, status: 'preview' },
    }));
  };

  const isChildSession = Boolean(
    authSession.authenticated &&
      (authSession.user?.role === 'child' || authSession.user?.role === 'student'),
  );

  const selectChild = (childId: string) => {
    if (isChildSession) return;
    soundEngine.playPop();
    setPersisted((prev) => ({ ...prev, activeChildId: childId }));
  };

  const clearPrivateSessionCache = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setAuthSession({ authenticated: false, user: null, csrfToken: null });
    setLastAttempt(null);
    setLastAssessment(null);
    setLastNewlyUnlockedBadge(null);
    setLastNewlyIssuedCert(null);
    setShowCelebration(false);
    setPersisted((prev) => ({
      sampleSchemaVersion: 2,
      parentAccount: null,
      parentSettings: prev.parentSettings,
      subscription: { tier: 'free', status: 'preview' },
      children: [],
      activeChildId: null,
      simulatedOffline: false,
      curatedVideos: prev.curatedVideos || INITIAL_CURATED_VIDEOS,
      offlineQueue: [],
      lastSyncedAt: undefined,
    }));
  };

  const enterSampleDemoMode = () => {
    if (authSession.authenticated) return;
    const sampleChildren = createSampleChildProfiles();
    setPersisted((prev) => ({
      ...prev,
      parentAccount: {
        id: 'parent-demo-1',
        name: 'عائلة نونو',
        email: 'family@nonoland.local',
        createdAt: new Date().toISOString(),
        isDemoMode: true,
      },
      children: sampleChildren,
      activeChildId: sampleChildren[0].id,
      offlineQueue: [],
    }));
    navigate('home');
  };

  const childLogin: NonoLandContextValue['childLogin'] = async (accessCode, pin) => {
    try {
      const res = await fetch('/api/auth/child-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, pin }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: ParentAccount;
        child?: ChildProfile;
        csrfToken?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.user || !data.child) {
        return {
          ok: false,
          error: formatApiErrorMessage(
            res.status,
            data,
            language,
            'Invalid child access code or PIN.',
            'رمز دخول الطفل أو الرقم السري غير صحيح.',
          ),
        };
      }
      const migratedChild = migrateChildProfileSafely(data.child);
      setAuthSession({
        authenticated: true,
        user: data.user,
        csrfToken: data.csrfToken || null,
      });
      setPersisted((prev) => ({
        ...prev,
        parentAccount: data.user!,
        children: [migratedChild],
        activeChildId: migratedChild.id,
        offlineQueue: [],
      }));
      soundEngine.playCelebration();
      setScreen('home');
      return { ok: true };
    } catch {
      return {
        ok: false,
        error:
          language === 'ar'
            ? 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.'
            : 'Connection failed. Please try again.',
      };
    }
  };

  const childQuickLogin: NonoLandContextValue['childQuickLogin'] = async (childId, pin) => {
    try {
      const res = await fetch('/api/auth/child-quick-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, pin }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: ParentAccount;
        child?: ChildProfile;
        csrfToken?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.user || !data.child) {
        return {
          ok: false,
          error: formatApiErrorMessage(
            res.status,
            data,
            language,
            'Invalid child PIN.',
            'الرقم السري للطفل غير صحيح.',
          ),
        };
      }
      const migratedChild = migrateChildProfileSafely(data.child);
      setAuthSession({
        authenticated: true,
        user: data.user,
        csrfToken: data.csrfToken || null,
      });
      setPersisted((prev) => ({
        ...prev,
        parentAccount: data.user!,
        children: [migratedChild],
        activeChildId: migratedChild.id,
        offlineQueue: [],
      }));
      soundEngine.playCelebration();
      setScreen('home');
      return { ok: true };
    } catch {
      return {
        ok: false,
        error:
          language === 'ar'
            ? 'تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.'
            : 'Connection failed. Please try again.',
      };
    }
  };

  const loginWithPassword: NonoLandContextValue['loginWithPassword'] = async (input) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          rememberMe: Boolean(input.rememberMe),
          portal: input.portal,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: ParentAccount;
        csrfToken?: string;
        dashboardRoute?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          error: formatApiErrorMessage(
            res.status,
            data,
            language,
            res.status >= 500
              ? 'Authentication server is unavailable right now. Please try again.'
              : 'Invalid email or password.',
            res.status >= 500
              ? 'خادم المصادقة غير متاح حالياً. يرجى المحاولة مرة أخرى.'
              : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
          ),
        };
      }
      if (!data.user || !resolveDestinationForRole(data.user.role)) {
        return {
          ok: false,
          error: 'Account role is missing or invalid. Access rejected safely.',
        };
      }

      // Confirm cookie session persisted & load authoritative user + family children
      const verified = await refreshAuthSession();
      if (verified === null) {
        return {
          ok: false,
          error: 'Backend session verification unavailable. Please retry in a moment.',
        };
      }
      if (!verified.authenticated || !verified.user) {
        return {
          ok: false,
          error:
            'Signed in, but the session cookie could not be confirmed. Please enable site cookies and try again.',
        };
      }

      const destination = resolveDestinationForRole(verified.user.role);
      if (!destination) {
        await logoutParent();
        return {
          ok: false,
          error: 'Session account role is invalid or unauthorized.',
        };
      }

      soundEngine.playSuccess();
      setScreen(destination);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { ok: true, destination };
    } catch {
      return {
        ok: false,
        error: 'Unable to connect to the authentication server. Please check your connection.',
      };
    }
  };

  const loginWithPasskey: NonoLandContextValue['loginWithPasskey'] = async (input) => {
    try {
      if (typeof window === 'undefined' || !browserSupportsWebAuthn()) {
        return {
          ok: false,
          error:
            language === 'ar'
              ? 'هذا المتصفح لا يدعم مفاتيح المرور (Passkeys). يمكنك تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.'
              : 'Passkeys are not supported in this browser. Sign in with Email and Password instead.',
        };
      }

      const optRes = await fetch('/api/auth/passkeys/login/options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: input?.email?.trim() ? input.email.trim() : undefined,
        }),
      });
      const optData = (await optRes.json().catch(() => ({}))) as {
        options?: Parameters<typeof startAuthentication>[0]['optionsJSON'];
        error?: string;
        code?: string;
      };
      if (!optRes.ok || !optData.options) {
        return {
          ok: false,
          error: formatApiErrorMessage(
            optRes.status,
            optData,
            language,
            'Could not start Passkey sign-in.',
            'تعذر بدء تسجيل الدخول بمفتاح المرور.',
          ),
        };
      }

      const assertion = await startAuthentication({ optionsJSON: optData.options });

      const verRes = await fetch('/api/auth/passkeys/login/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: assertion,
          rememberMe: Boolean(input?.rememberMe),
        }),
      });
      const verData = (await verRes.json().catch(() => ({}))) as {
        user?: ParentAccount;
        csrfToken?: string;
        dashboardRoute?: string;
        error?: string;
        code?: string;
      };
      if (!verRes.ok || !verData.user || verData.user.role !== 'parent') {
        return {
          ok: false,
          error: formatApiErrorMessage(
            verRes.status,
            verData,
            language,
            'Passkey verification failed. Use Email + Password if needed.',
            'فشل التحقق من مفتاح المرور. يمكنك استخدام البريد الإلكتروني وكلمة المرور.',
          ),
        };
      }

      const verified = await refreshAuthSession();
      if (!verified || !verified.authenticated || !verified.user) {
        return {
          ok: false,
          error:
            language === 'ar'
              ? 'تم التحقق من مفتاح المرور ولكن تعذر تأكيد الجلسة.'
              : 'Passkey verified, but session confirmation failed.',
        };
      }

      const destination = resolveDestinationForRole(verified.user.role) || 'parent-dashboard';
      soundEngine.playSuccess();
      setScreen(destination);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { ok: true, destination };
    } catch (err) {
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'NotAllowedError') {
        return {
          ok: false,
          error:
            language === 'ar'
              ? 'تم إلغاء طلب مفتاح المرور أو تعذر الوصول إليه في هذا السياق. يمكنك التسجيل بكلمة المرور.'
              : 'Passkey prompt was cancelled or unavailable here. You can always sign in with your password.',
        };
      }
      if (errName === 'SecurityError') {
        return {
          ok: false,
          error:
            language === 'ar'
              ? 'مفاتيح المرور غير مسموح بها داخل هذه النافذة المضمنة. افتح الصفحة مباشرة أو استخدم كلمة المرور.'
              : 'Passkeys cannot run inside this embedded frame. Open the app directly or sign in with your password.',
        };
      }
      return {
        ok: false,
        error:
          language === 'ar'
            ? 'تعذر إكمال تسجيل الدخول بمفتاح المرور. استخدم كلمة المرور كبديل دائم.'
            : 'Unable to complete Passkey sign-in. Your email and password remain available.',
      };
    }
  };

  const exitChildMode = async () => {
    try {
      await fetch('/api/auth/exit-child-mode', {
        method: 'POST',
        credentials: 'include',
        headers: authSession.csrfToken ? { 'x-csrf-token': authSession.csrfToken } : {},
      });
    } catch {
      // ignore
    }
    clearPrivateSessionCache();
    setScreen('parent-auth');
  };

  const logoutParent = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: authSession.csrfToken ? { 'x-csrf-token': authSession.csrfToken } : {},
      });
    } catch {
      // ignore
    }
    clearPrivateSessionCache();
    setScreen('parent-auth');
  };

  const logoutAllDevices = async () => {
    try {
      await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
        headers: authSession.csrfToken ? { 'x-csrf-token': authSession.csrfToken } : {},
      });
    } catch {
      // ignore
    }
    clearPrivateSessionCache();
    setScreen('parent-auth');
  };

  const createChildProfile: NonoLandContextValue['createChildProfile'] = async (input) => {
    if (authSession.authenticated && authSession.csrfToken) {
      const res = await fetch('/api/children', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': authSession.csrfToken,
        },
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => ({}))) as {
        child?: ChildProfile;
        accessCode?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.child) {
        throw new Error(
          formatApiErrorMessage(
            res.status,
            data,
            language,
            'Failed to create child profile',
            'تعذر إنشاء ملف الطفل',
          ),
        );
      }
      const migratedChild = migrateChildProfileSafely(data.child);
      setPersisted((prev) => ({
        ...prev,
        parentSettings: { ...prev.parentSettings, language: input.language },
        children: [migratedChild, ...prev.children.filter((c) => c.id !== migratedChild.id)],
        activeChildId: migratedChild.id,
      }));
      return { child: migratedChild, accessCode: data.accessCode };
    }

    const newChild: ChildProfile = {
      id: `child-${Date.now()}`,
      displayName: input.displayName.trim() || (input.language === 'ar' ? 'بطل نونو' : 'Explorer'),
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      ageGroup: input.ageGroup || '1-4',
      language: input.language,
      interests: input.interests,
      companionId: input.companionId || 'nono',
      companionScarfColor: input.companionScarfColor || '#8054D9',
      stars: 3,
      level: 1,
      completedBaseline: false,
      unlockedWorlds: [
        'arabic-letters',
        'english-letters',
        'numbers-kingdom',
        'animal-jungle',
        'colors-shapes',
        'intelligence-castle',
        'science-galaxy',
        'healthy-body',
        'life-skills',
        'creativity-island',
      ],
      completedActivityIds: [],
      unlockedCharacters: ['nono', input.companionId || 'nono'],
      unlockedBadges: [],
      unlockedRoomItems: ['cloud-bed', 'sun-plant'],
      placedRoomItems: [
        { instanceId: `init-1-${Date.now()}`, itemId: 'cloud-bed', x: 28, y: 68 },
        { instanceId: `init-2-${Date.now()}`, itemId: 'sun-plant', x: 72, y: 65 },
      ],
      savedDrawings: [],
      certificates: [],
      skillProgress: createInitialSkillProgress(),
      attempts: [],
      assessmentHistory: [],
      completedStoryIds: [],
      completedMissionsToday: [],
      totalLearningMinutes: 0,
      downloadedWorldIds: ['arabic-letters', 'colors-shapes'],
      level1Progress: {},
    };

    setPersisted((prev) => ({
      ...prev,
      parentSettings: { ...prev.parentSettings, language: input.language },
      children: [...prev.children, newChild],
      activeChildId: newChild.id,
    }));
    return { child: newChild };
  };

  const updateChildProfile = (childId: string, patch: Partial<ChildProfile>) => {
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === childId ? { ...c, ...patch } : c)),
    }));
    if (authSession.authenticated && authSession.csrfToken && !childId.startsWith('demo-')) {
      void fetch(`/api/children/${encodeURIComponent(childId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': authSession.csrfToken,
        },
        body: JSON.stringify(patch),
      }).catch(() => {});
    }
  };

  const recordGameAttempt: NonoLandContextValue['recordGameAttempt'] = (input) => {
    if (!activeChild) return;
    const accuracy = input.maxScore > 0 ? Math.round((input.score / input.maxScore) * 100) : 100;
    const isFirstCompletion = !activeChild.completedActivityIds.includes(input.activityId);
    const starsEarned = isFirstCompletion ? (accuracy >= 80 ? 3 : 2) : 1;

    const idempotencyKey = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const attempt: LearningAttempt = {
      id: `att-${Date.now()}`,
      idempotencyKey,
      activityId: input.activityId,
      worldId: input.worldId,
      skillId: input.skillId,
      ageGroup: activeChild.ageGroup,
      score: input.score,
      maxScore: input.maxScore,
      accuracy,
      durationSeconds: Math.max(10, input.durationSeconds),
      starsEarned,
      completedAt: new Date().toISOString(),
      synced: isOnline && !authSession.authenticated,
    };

    const queueItem: OfflineSyncItem | null =
      authSession.authenticated && !activeChild.id.startsWith('demo-')
        ? {
            idempotencyKey,
            childId: activeChild.id,
            kind: 'game-attempt',
            payload: {
              activityId: input.activityId,
              worldId: input.worldId,
              skillId: input.skillId,
              starsEarned,
              durationSeconds: Math.max(10, input.durationSeconds),
              accuracy,
            },
            createdAt: attempt.completedAt,
            status: 'local-only',
          }
        : null;

    let unlockedBadge: string | null = null;
    let issuedCert: Certificate | null = null;

    setPersisted((prev) => ({
      ...prev,
      offlineQueue: queueItem
        ? [queueItem, ...(prev.offlineQueue || [])].slice(0, 120)
        : prev.offlineQueue,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;

        const nextStars = c.stars + starsEarned;
        const nextLevel = Math.max(1, Math.floor(nextStars / 6) + 1);
        const completedIds = c.completedActivityIds.includes(input.activityId)
          ? c.completedActivityIds
          : [...c.completedActivityIds, input.activityId];

        const prevSkill = c.skillProgress[input.skillId];
        const nextSkill = evaluateSkillUpdate(prevSkill, {
          accuracy,
          isAssessment: false,
          nowIso: attempt.completedAt,
        });

        const nextBadges = [...c.unlockedBadges];
        if (!nextBadges.includes('first-spark')) {
          nextBadges.push('first-spark');
          unlockedBadge = 'first-spark';
        }
        if (completedIds.length >= 5 && !nextBadges.includes('five-adventures')) {
          nextBadges.push('five-adventures');
          unlockedBadge = 'five-adventures';
        }
        if (nextStars >= 20 && !nextBadges.includes('star-collector')) {
          nextBadges.push('star-collector');
          unlockedBadge = 'star-collector';
        }

        // Unlock room items earned by star thresholds
        const nextRoomItems = [...c.unlockedRoomItems];
        ROOM_ITEMS.forEach((item) => {
          if (item.starsCost && nextStars >= item.starsCost && !nextRoomItems.includes(item.id)) {
            nextRoomItems.push(item.id);
          }
        });

        // Issue world certificate if 2+ activities completed in this world & no duplicate certificate exists
        const worldAttemptsCount = [...c.attempts, attempt].filter(
          (a) => a.worldId === input.worldId && a.accuracy >= 60,
        ).length;
        const alreadyHasWorldCert = c.certificates.some((cert) => cert.worldId === input.worldId);
        const nextCerts = [...c.certificates];
        if (worldAttemptsCount >= 2 && !alreadyHasWorldCert) {
          const world = getWorldById(input.worldId);
          const cert: Certificate = {
            id: `cert-${input.worldId}-${Date.now()}`,
            uniqueCode: `NL-${input.worldId.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
            childName: c.displayName,
            worldId: input.worldId,
            worldName: world.name,
            achievementTitle: world.certificateTitle,
            issuedAt: new Date().toISOString(),
            levelCompleted: nextLevel,
          };
          nextCerts.push(cert);
          issuedCert = cert;
        }

        // Unlock world companion if applicable
        const nextChars = [...c.unlockedCharacters];
        if (input.worldId === 'animal-jungle' && !nextChars.includes('coco')) nextChars.push('coco');
        if (input.worldId === 'intelligence-castle' && !nextChars.includes('lumi')) nextChars.push('lumi');
        if (input.worldId === 'arabic-letters' && !nextChars.includes('faseeh')) nextChars.push('faseeh');
        if (input.worldId === 'science-galaxy' && !nextChars.includes('astra')) nextChars.push('astra');

        return {
          ...c,
          stars: nextStars,
          level: nextLevel,
          favoriteWorldId: c.favoriteWorldId || input.worldId,
          recentActivityId: input.activityId,
          completedActivityIds: completedIds,
          unlockedBadges: nextBadges,
          unlockedRoomItems: nextRoomItems,
          unlockedCharacters: nextChars,
          certificates: nextCerts,
          attempts: [attempt, ...c.attempts],
          totalLearningMinutes: c.totalLearningMinutes + Math.max(1, Math.round(input.durationSeconds / 60)),
          skillProgress: {
            ...c.skillProgress,
            [input.skillId]: nextSkill,
          },
        };
      }),
    }));

    setLastAttempt(attempt);
    setLastNewlyUnlockedBadge(unlockedBadge);
    setLastNewlyIssuedCert(issuedCert);
    setShowCelebration(true);
    soundEngine.playCelebration();
  };

  const recordAssessmentResult: NonoLandContextValue['recordAssessmentResult'] = (input) => {
    const result: AssessmentResult = {
      ...input,
      id: `assess-${Date.now()}`,
      date: new Date().toISOString(),
    };

    if (activeChild) {
      setPersisted((prev) => ({
        ...prev,
        children: prev.children.map((c) => {
          if (c.id !== activeChild.id) return c;
        const nextBadges = c.unlockedBadges.includes('lab-explorer')
          ? c.unlockedBadges
          : [...c.unlockedBadges, 'lab-explorer'];

        const updatedSkills = { ...c.skillProgress };
        (Object.keys(result.skillBreakdown) as SkillId[]).forEach((skillId) => {
          const item = result.skillBreakdown[skillId];
          if (!item || item.total === 0) return;
          const pct = Math.round((item.correct / item.total) * 100);
          updatedSkills[skillId] = evaluateSkillUpdate(updatedSkills[skillId], {
            accuracy: pct,
            isAssessment: true,
            isUnseenCheck: true,
            nowIso: result.date,
          });
        });

        return {
          ...c,
          completedBaseline: true,
          stars: c.stars + result.starsEarned,
          unlockedBadges: nextBadges,
          assessmentHistory: [result, ...c.assessmentHistory],
          skillProgress: updatedSkills,
        };
      }),
      }));
    }

    setLastAssessment(result);
    soundEngine.playCelebration();
    return result;
  };

  const isServerChild = (childId: string) =>
    Boolean(
      authSession.authenticated &&
        authSession.csrfToken &&
        !childId.startsWith('sample-') &&
        !childId.startsWith('demo-'),
    );

  const replaceServerChild = (serverChild?: ChildProfile) => {
    if (!serverChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === serverChild.id ? serverChild : c)),
    }));
  };

  const completeStory = (storyId: string, rewardStars: number, title?: LocalizedText) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const alreadyCompleted = c.completedStoryIds.includes(storyId);
        const starsAdd = alreadyCompleted ? 0 : rewardStars;
        const nextBadges = c.unlockedBadges.includes('story-weaver')
          ? c.unlockedBadges
          : [...c.unlockedBadges, 'story-weaver'];
        const days = Array.from(new Set([...(c.activeDaysHistory || []), getTodayDayKey()]));
        return {
          ...c,
          stars: c.stars + starsAdd,
          completedStoryIds: alreadyCompleted ? c.completedStoryIds : [...c.completedStoryIds, storyId],
          unlockedBadges: nextBadges,
          activeDaysHistory: days,
        };
      }),
    }));
    soundEngine.playCelebration();
    if (isServerChild(activeChild.id)) {
      void fetch(`/api/children/${encodeURIComponent(activeChild.id)}/stories/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': authSession.csrfToken!,
        },
        body: JSON.stringify({ storyId, title }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.child && replaceServerChild(d.child))
        .catch(() => {});
    }
  };

  const saveDrawingToRoom = (drawing: Omit<SavedDrawing, 'id' | 'createdAt'>) => {
    if (!activeChild) return;
    const fullDrawing: SavedDrawing = {
      ...drawing,
      id: `draw-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const nextBadges = c.unlockedBadges.includes('creative-artist')
          ? c.unlockedBadges
          : [...c.unlockedBadges, 'creative-artist'];
        return {
          ...c,
          stars: c.stars + 2,
          unlockedBadges: nextBadges,
          savedDrawings: [fullDrawing, ...c.savedDrawings].slice(0, 12),
        };
      }),
    }));
    soundEngine.playSuccess();
    if (isServerChild(activeChild.id)) {
      void fetch(`/api/children/${encodeURIComponent(activeChild.id)}/creative-projects`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': authSession.csrfToken!,
        },
        body: JSON.stringify({ kind: 'drawing', title: drawing.title, dataUrl: drawing.dataUrl }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.child && replaceServerChild(d.child))
        .catch(() => {});
    }
  };

  const syncRoomToServer = (roomConfig: RoomConfig | undefined, placedRoomItems: PlacedRoomItem[]) => {
    if (!activeChild || !isServerChild(activeChild.id)) return;
    void fetch(`/api/children/${encodeURIComponent(activeChild.id)}/room`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': authSession.csrfToken!,
      },
      body: JSON.stringify({ roomConfig, placedRoomItems }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.child && replaceServerChild(d.child))
      .catch(() => {});
  };

  const placeRoomItem = (itemId: string) => {
    if (!activeChild) return;
    soundEngine.playPop();
    let nextPlaced: PlacedRoomItem[] = [];
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const offset = (c.placedRoomItems.length * 13) % 55;
        nextPlaced = [
          ...c.placedRoomItems,
          {
            instanceId: `rm-${Date.now()}`,
            itemId,
            x: 20 + offset,
            y: 55 + (c.placedRoomItems.length % 2) * 14,
          },
        ];
        return { ...c, placedRoomItems: nextPlaced };
      }),
    }));
    syncRoomToServer(activeChild.roomConfig, nextPlaced);
  };

  const moveRoomItem = (instanceId: string, x: number, y: number) => {
    if (!activeChild) return;
    let nextPlaced: PlacedRoomItem[] = [];
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        nextPlaced = c.placedRoomItems.map((p) => (p.instanceId === instanceId ? { ...p, x, y } : p));
        return { ...c, placedRoomItems: nextPlaced };
      }),
    }));
    syncRoomToServer(activeChild.roomConfig, nextPlaced);
  };

  const removePlacedRoomItem = (instanceId: string) => {
    if (!activeChild) return;
    soundEngine.playPop();
    let nextPlaced: PlacedRoomItem[] = [];
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        nextPlaced = c.placedRoomItems.filter((p) => p.instanceId !== instanceId);
        return { ...c, placedRoomItems: nextPlaced };
      }),
    }));
    syncRoomToServer(activeChild.roomConfig, nextPlaced);
  };

  const saveRoomState: NonoLandContextValue['saveRoomState'] = async (roomConfig, placedRoomItems) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === activeChild.id
          ? { ...c, roomConfig, placedRoomItems: placedRoomItems ?? c.placedRoomItems }
          : c,
      ),
    }));
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/room`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify({ roomConfig, placedRoomItems }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.child) replaceServerChild(d.child);
        }
      } catch {
        // local state kept
      }
    }
  };

  const saveAvatarConfig: NonoLandContextValue['saveAvatarConfig'] = async (avatarConfig) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === activeChild.id ? { ...c, avatarConfig } : c)),
    }));
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/avatar`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify(avatarConfig),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.child) replaceServerChild(d.child);
        }
      } catch {
        // local fallback
      }
    }
  };

  const interactWithPet: NonoLandContextValue['interactWithPet'] = async (input) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const pet = { ...(c.petState || DEFAULT_PET_STATE) };
        if (input.action === 'adopt') {
          pet.adopted = true;
          if (input.speciesId) pet.speciesId = input.speciesId;
          if (input.presetNameId) pet.presetNameId = input.presetNameId;
          pet.mood = 'happy';
        } else if (input.action === 'rename' && input.presetNameId) {
          pet.presetNameId = input.presetNameId;
        } else if (input.action === 'feed') {
          pet.adopted = true;
          pet.careCount += 1;
          pet.mood = 'cozy';
        } else if (input.action === 'play') {
          pet.adopted = true;
          pet.playCount += 1;
          pet.mood = 'playful';
        } else if (input.action === 'decorate') {
          pet.adopted = true;
          if (input.accessoryId) {
            pet.accessories = pet.accessories.includes(input.accessoryId)
              ? pet.accessories.filter((a) => a !== input.accessoryId)
              : [...pet.accessories, input.accessoryId];
          }
          if (input.habitatId) {
            pet.habitatDecor = pet.habitatDecor.includes(input.habitatId)
              ? pet.habitatDecor.filter((h) => h !== input.habitatId)
              : [...pet.habitatDecor, input.habitatId];
          }
        }
        return { ...c, petState: pet };
      }),
    }));
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/pet`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.child) replaceServerChild(d.child);
        }
      } catch {
        // local state kept
      }
    }
  };

  const completeLabExperiment: NonoLandContextValue['completeLabExperiment'] = async (
    experimentId,
    starsReward = 4,
  ) => {
    if (!activeChild) return { starsAdded: 0 };
    const alreadyDone = (activeChild.completedLabIds || []).includes(experimentId);
    const localAdded = alreadyDone ? 0 : starsReward;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const doneSet = Array.from(new Set([...(c.completedLabIds || []), experimentId]));
        const nextBadges = c.unlockedBadges.includes('lab-explorer')
          ? c.unlockedBadges
          : [...c.unlockedBadges, 'lab-explorer'];
        return {
          ...c,
          stars: c.stars + localAdded,
          completedLabIds: doneSet,
          unlockedBadges: nextBadges,
          totalLearningMinutes: c.totalLearningMinutes + 3,
          activeDaysHistory: Array.from(new Set([...(c.activeDaysHistory || []), getTodayDayKey()])),
        };
      }),
    }));
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/lab/complete`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify({
            experimentId,
            idempotencyKey: `${experimentId}_${getCurrentMonthKey()}_${Date.now()}`,
          }),
        });
        if (res.ok) {
          const d = (await res.json()) as { starsAdded?: number; child?: ChildProfile };
          if (d.child) replaceServerChild(d.child);
          return { starsAdded: d.starsAdded ?? localAdded };
        }
      } catch {
        // local fallback
      }
    }
    return { starsAdded: localAdded };
  };

  const createCustomStory: NonoLandContextValue['createCustomStory'] = async (input) => {
    if (!activeChild) return;
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/custom-stories`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.child) replaceServerChild(d.child);
          return;
        }
      } catch {
        // local fallback below
      }
    }
    const created: CustomStory = {
      ...input,
      id: `cs-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === activeChild.id
          ? { ...c, customStories: [created, ...(c.customStories || [])].slice(0, 20) }
          : c,
      ),
    }));
  };

  const deleteCustomStory: NonoLandContextValue['deleteCustomStory'] = async (storyId) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === activeChild.id
          ? { ...c, customStories: (c.customStories || []).filter((s) => s.id !== storyId) }
          : c,
      ),
    }));
    if (isServerChild(activeChild.id)) {
      void fetch(
        `/api/children/${encodeURIComponent(activeChild.id)}/custom-stories/${encodeURIComponent(storyId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'x-csrf-token': authSession.csrfToken! },
        },
      ).catch(() => {});
    }
  };

  const saveCreativeProject: NonoLandContextValue['saveCreativeProject'] = async (input) => {
    if (!activeChild) return;
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/creative-projects`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.child) replaceServerChild(d.child);
          return;
        }
      } catch {
        // local fallback
      }
    }
    const proj: CreativeProject = {
      ...input,
      id: `art-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const nextList = [proj, ...(c.creativeProjects || [])].slice(0, 24);
        const nextDrawings = input.dataUrl
          ? [{ id: proj.id, title: input.title, dataUrl: input.dataUrl, createdAt: proj.createdAt }, ...c.savedDrawings].slice(0, 12)
          : c.savedDrawings;
        return {
          ...c,
          stars: c.stars + (nextList.length <= 3 ? 2 : 0),
          creativeProjects: nextList,
          savedDrawings: nextDrawings,
        };
      }),
    }));
  };

  const deleteCreativeProject: NonoLandContextValue['deleteCreativeProject'] = async (projectId) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === activeChild.id
          ? {
              ...c,
              creativeProjects: (c.creativeProjects || []).filter((p) => p.id !== projectId),
              savedDrawings: c.savedDrawings.filter((d) => d.id !== projectId),
            }
          : c,
      ),
    }));
    if (isServerChild(activeChild.id)) {
      void fetch(
        `/api/children/${encodeURIComponent(activeChild.id)}/creative-projects/${encodeURIComponent(projectId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'x-csrf-token': authSession.csrfToken! },
        },
      ).catch(() => {});
    }
  };

  const redeemShopItem: NonoLandContextValue['redeemShopItem'] = async (itemId) => {
    if (!activeChild) return { ok: false, error: 'No active child profile' };
    const item = REWARD_SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: 'Item not found' };
    if ((activeChild.ownedShopItemIds || []).includes(itemId)) {
      return { ok: false, error: language === 'ar' ? 'تم الحصول على هذا العنصر بالفعل!' : 'Already unlocked!' };
    }
    if (activeChild.stars < item.costStars) {
      return {
        ok: false,
        error:
          language === 'ar'
            ? `تحتاج إلى ${item.costStars} نجوم لفتح هذا العنصر`
            : `Need ${item.costStars} stars to unlock`,
      };
    }

    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/shop/redeem`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify({ itemId, idempotencyKey: `redeem_${itemId}_${Date.now()}` }),
        });
        const d = await res.json();
        if (!res.ok) return { ok: false, error: d.error || 'Failed to redeem' };
        if (d.child) replaceServerChild(d.child);
        soundEngine.playCelebration();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    }

    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const owned = [...(c.ownedShopItemIds || []), item.id];
        const unlockedRoomItems =
          item.category === 'room' ? Array.from(new Set([...c.unlockedRoomItems, item.id])) : c.unlockedRoomItems;
        const avatarConfig = { ...(c.avatarConfig || DEFAULT_AVATAR_CONFIG) };
        if (item.category === 'avatar') {
          avatarConfig.unlockedCosmetics = Array.from(new Set([...avatarConfig.unlockedCosmetics, item.id]));
        }
        const petState = { ...(c.petState || DEFAULT_PET_STATE) };
        if (item.category === 'pet') {
          petState.habitatDecor = Array.from(new Set([...petState.habitatDecor, item.id]));
        }
        return {
          ...c,
          stars: c.stars - item.costStars,
          ownedShopItemIds: owned,
          unlockedRoomItems,
          avatarConfig,
          petState,
        };
      }),
    }));
    soundEngine.playCelebration();
    return { ok: true };
  };

  const claimDailyMission: NonoLandContextValue['claimDailyMission'] = async (missionId) => {
    if (!activeChild) return { ok: false, error: 'No active child profile' };
    const today = getTodayDayKey();
    if (
      activeChild.claimedMissionsDate === today &&
      (activeChild.claimedMissionIdsToday || []).includes(missionId)
    ) {
      return { ok: false, error: language === 'ar' ? 'تم استلام المكافأة اليوم بالفعل' : 'Already claimed today' };
    }

    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/missions/claim`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify({ missionId }),
        });
        const d = await res.json();
        if (!res.ok) return { ok: false, error: d.error || 'Mission prerequisite not met' };
        if (d.child) replaceServerChild(d.child);
        soundEngine.playCelebration();
        return { ok: true, starsAdded: d.starsAdded || 3 };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    }

    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const baseClaimed = c.claimedMissionsDate === today ? c.claimedMissionIdsToday || [] : [];
        return {
          ...c,
          stars: c.stars + 3,
          claimedMissionsDate: today,
          claimedMissionIdsToday: Array.from(new Set([...baseClaimed, missionId])),
        };
      }),
    }));
    soundEngine.playCelebration();
    return { ok: true, starsAdded: 3 };
  };

  const saveLearningPlan: NonoLandContextValue['saveLearningPlan'] = async (input) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === activeChild.id
          ? {
              ...c,
              parentSchedule: input.parentSchedule ?? c.parentSchedule ?? DEFAULT_PARENT_SCHEDULE,
              nextMonthPlan: input.nextMonthPlan ?? c.nextMonthPlan ?? DEFAULT_NEXT_MONTH_PLAN,
            }
          : c,
      ),
    }));
    if (isServerChild(activeChild.id)) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/learning-plan`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken!,
          },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          const d = await res.json();
          if (d?.child) replaceServerChild(d.child);
        }
      } catch {
        // local state kept
      }
    }
  };

  const toggleDownloadWorld = (worldId: WorldId) => {
    if (!activeChild) return;
    soundEngine.playPop();
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const exists = c.downloadedWorldIds.includes(worldId);
        return {
          ...c,
          downloadedWorldIds: exists
            ? c.downloadedWorldIds.filter((id) => id !== worldId)
            : [...c.downloadedWorldIds, worldId],
        };
      }),
    }));
  };

  const offlineQueue = persisted.offlineQueue || [];

  const pendingSyncCount = useMemo(() => {
    const queuePending = (persisted.offlineQueue || []).filter((i) => i.status === 'local-only').length;
    const attemptPending = persisted.children.reduce(
      (sum, c) => sum + c.attempts.filter((a) => !a.synced).length,
      0,
    );
    return Math.max(queuePending, attemptPending);
  }, [persisted.children, persisted.offlineQueue]);

  const syncOfflineQueue = async () => {
    if (!isOnline || !persisted.parentSettings.offlineSyncEnabled) return;
    const localQueue = (persisted.offlineQueue || []).filter((i) => i.status === 'local-only');

    if (authSession.authenticated && authSession.csrfToken && localQueue.length > 0) {
      const byChild = new Map<string, OfflineSyncItem[]>();
      for (const item of localQueue) {
        const list = byChild.get(item.childId) || [];
        list.push(item);
        byChild.set(item.childId, list);
      }

      const confirmedKeys = new Set<string>();
      for (const [cid, items] of byChild.entries()) {
        try {
          const res = await fetch('/api/student/sync', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': authSession.csrfToken,
            },
            body: JSON.stringify({ childId: cid, items }),
          });
          if (res.ok) {
            const data = (await res.json()) as { syncedKeys?: string[]; duplicateKeys?: string[] };
            (data.syncedKeys || []).forEach((k) => confirmedKeys.add(k));
            (data.duplicateKeys || []).forEach((k) => confirmedKeys.add(k));
          }
        } catch {
          // Leave items marked local-only until connectivity restores
        }
      }

      if (confirmedKeys.size > 0) {
        soundEngine.playSuccess();
        const nowIso = new Date().toISOString();
        setPersisted((prev) => ({
          ...prev,
          lastSyncedAt: nowIso,
          offlineQueue: (prev.offlineQueue || []).map((i) =>
            confirmedKeys.has(i.idempotencyKey) ? { ...i, status: 'synced' } : i,
          ),
          children: prev.children.map((c) => ({
            ...c,
            attempts: c.attempts.map((a) =>
              !a.idempotencyKey || confirmedKeys.has(a.idempotencyKey)
                ? { ...a, synced: true }
                : a,
            ),
          })),
        }));
      }
      return;
    }

    // Demo/unauthenticated local mode
    soundEngine.playSuccess();
    const nowIso = new Date().toISOString();
    setPersisted((prev) => ({
      ...prev,
      lastSyncedAt: nowIso,
      offlineQueue: (prev.offlineQueue || []).map((i) => ({ ...i, status: 'synced' })),
      children: prev.children.map((c) => ({
        ...c,
        attempts: c.attempts.map((a) => ({ ...a, synced: true })),
      })),
    }));
  };

  // Auto-sync queued items when connectivity comes back online
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0) {
      void syncOfflineQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingSyncCount, authSession.authenticated]);

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = getInitialPersistedState();
    setPersisted(fresh);
    setScreen('splash');
  };

  const recordConceptInteraction: NonoLandContextValue['recordConceptInteraction'] = ({
    conceptId,
    domain,
    label,
    stage,
    isCorrect,
    lessonStageNum,
    isIndependent,
    isRetentionReview,
  }) => {
    if (!activeChild) return;
    const stageRank: Record<ConceptMasteryStage, number> = {
      exposed: 1,
      recognized: 2,
      recalled: 3,
      applied: 4,
    };

    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const map = c.conceptMastery || {};
        const existing = map[conceptId];
        const nextStage =
          existing && stageRank[existing.stage] > stageRank[stage]
            ? existing.stage
            : isCorrect
              ? stage
              : existing?.stage || 'exposed';

        const nextCorrect = (existing?.correctCount || 0) + (isCorrect ? 1 : 0);
        const nextMistakes = (existing?.mistakesCount || 0) + (isCorrect ? 0 : 1);
        const nextExposures = (existing?.exposures || 0) + 1;

        const completedStages = Array.from(
          new Set([
            ...(existing?.completedLessonStages || []),
            ...(lessonStageNum ? [lessonStageNum] : []),
          ]),
        );

        const introduced = existing?.introduced || nextExposures >= 1;
        const explained = existing?.explained || stage !== 'exposed' || completedStages.includes(2);
        const practiced = existing?.practiced || nextExposures >= 2 || completedStages.length >= 3;
        const correctlyIdentified =
          existing?.correctlyIdentified || (isCorrect && (stage === 'recognized' || stage === 'recalled' || stage === 'applied'));
        const independentlyCompleted =
          existing?.independentlyCompleted || Boolean(isIndependent && isCorrect);
        const appliedInNewContext =
          existing?.appliedInNewContext || (isCorrect && stage === 'applied');
        const retainedAfterReview =
          existing?.retainedAfterReview || Boolean(isRetentionReview && isCorrect);
        const needsRevision = nextMistakes > nextCorrect || (!isCorrect && nextMistakes >= 2);

        let status: ConceptStatus = 'learning';
        if (needsRevision) status = 'needs-revision';
        else if (independentlyCompleted && appliedInNewContext && nextCorrect >= 3) status = 'well-understood';
        else if (nextCorrect >= 2 && correctlyIdentified) status = 'improving';
        else if (practiced) status = 'practicing';

        return {
          ...c,
          stars: isCorrect && !existing ? c.stars + 1 : c.stars,
          conceptMastery: {
            ...map,
            [conceptId]: {
              conceptId,
              domain,
              label,
              stage: nextStage,
              status,
              introduced,
              explained,
              practiced,
              correctlyIdentified,
              independentlyCompleted,
              appliedInNewContext,
              retainedAfterReview,
              needsRevision,
              completedLessonStages: completedStages,
              exposures: nextExposures,
              correctCount: nextCorrect,
              mistakesCount: nextMistakes,
              lastPracticedAt: new Date().toISOString(),
            },
          },
        };
      }),
    }));
  };

  const completeDeepLesson: NonoLandContextValue['completeDeepLesson'] = ({
    lessonId,
    conceptId,
    domain,
    label,
    starsReward = 4,
    mistakesCount = 0,
  }) => {
    if (!activeChild) return;
    soundEngine.playCelebration();
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const completed = c.completedDeepLessons || [];
        const alreadyDone = completed.includes(lessonId);
        const nextCompleted = alreadyDone ? completed : [...completed, lessonId];
        const map = c.conceptMastery || {};
        const existing = map[conceptId];
        const needsRev = mistakesCount >= 3;
        return {
          ...c,
          stars: c.stars + (alreadyDone ? 1 : starsReward),
          totalLearningMinutes: c.totalLearningMinutes + 4,
          completedDeepLessons: nextCompleted,
          conceptMastery: {
            ...map,
            [conceptId]: {
              conceptId,
              domain,
              label,
              stage: 'applied',
              status: needsRev ? 'improving' : 'well-understood',
              introduced: true,
              explained: true,
              practiced: true,
              correctlyIdentified: true,
              independentlyCompleted: true,
              appliedInNewContext: true,
              retainedAfterReview: alreadyDone || existing?.retainedAfterReview || false,
              needsRevision: needsRev,
              completedLessonStages: existing?.completedLessonStages || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
              exposures: (existing?.exposures || 0) + 1,
              correctCount: (existing?.correctCount || 0) + 3,
              mistakesCount: (existing?.mistakesCount || 0) + mistakesCount,
              lastPracticedAt: new Date().toISOString(),
            },
          },
        };
      }),
    }));
  };

  const recordLevel1Progress: NonoLandContextValue['recordLevel1Progress'] = (
    progress,
    starsAdd = 0,
    minutesAdd = 0,
  ) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const prevMap = c.level1Progress || {};
        const existing = prevMap[progress.lessonId];
        const mergedActs = Array.from(
          new Set([...(existing?.completedActivityIds || []), ...progress.completedActivityIds]),
        );
        return {
          ...c,
          stars: c.stars + starsAdd,
          totalLearningMinutes: c.totalLearningMinutes + minutesAdd,
          level1Progress: {
            ...prevMap,
            [progress.lessonId]: {
              ...progress,
              startedAt: existing?.startedAt || progress.startedAt,
              completedActivityIds: mergedActs,
            },
          },
        };
      }),
    }));
  };

  const recordLevel2Progress: NonoLandContextValue['recordLevel2Progress'] = (
    progress,
    starsAdd = 0,
    minutesAdd = 0,
  ) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const prevMap = c.level2Progress || {};
        const existing = prevMap[progress.lessonId];
        const mergedActs = Array.from(
          new Set([...(existing?.completedActivityIds || []), ...progress.completedActivityIds]),
        );
        const mergedSteps = Array.from(
          new Set([...(existing?.completedSteps || []), ...(progress.completedSteps || [])]),
        );
        return {
          ...c,
          stars: c.stars + starsAdd,
          totalLearningMinutes: c.totalLearningMinutes + minutesAdd,
          level2Progress: {
            ...prevMap,
            [progress.lessonId]: {
              ...progress,
              startedAt: existing?.startedAt || progress.startedAt,
              completedSteps: mergedSteps,
              completedActivityIds: mergedActs,
            },
          },
        };
      }),
    }));
  };

  const recordExamCompletion: NonoLandContextValue['recordExamCompletion'] = (
    summary,
    issuedCert,
  ) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const prevHistory = c.examHistory || [];
        const alreadyHasCert =
          issuedCert && c.certificates.some((cert) => cert.uniqueCode === issuedCert.uniqueCode);
        const nextCerts =
          issuedCert && !alreadyHasCert ? [issuedCert, ...c.certificates] : c.certificates;

        return {
          ...c,
          stars: c.stars + (summary.passed ? 10 : 3),
          examHistory: [summary, ...prevHistory],
          certificates: nextCerts,
        };
      }),
    }));
    if (summary.passed) soundEngine.playCelebration();
    else soundEngine.playEncourage();
  };

  const updateCharacterOutfit: NonoLandContextValue['updateCharacterOutfit'] = (
    characterId,
    patch,
  ) => {
    if (!activeChild) return;
    soundEngine.playPop();
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const outfits = c.characterOutfits || DEFAULT_CHARACTER_OUTFITS;
        const current = outfits[characterId] || DEFAULT_CHARACTER_OUTFITS[characterId];
        return {
          ...c,
          characterOutfits: {
            ...outfits,
            [characterId]: { ...current, ...patch },
          },
        };
      }),
    }));
  };

  const grantFunReward = (stars: number, rewardId?: string) => {
    if (!activeChild) return;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        const unlocked = c.unlockedFunRewards || [];
        const nextRewards =
          rewardId && !unlocked.includes(rewardId) ? [...unlocked, rewardId] : unlocked;
        return {
          ...c,
          stars: c.stars + stars,
          unlockedFunRewards: nextRewards,
        };
      }),
    }));
  };

  const curatedVideos = persisted.curatedVideos || INITIAL_CURATED_VIDEOS;

  const addCuratedVideo = (video: Omit<CuratedYouTubeVideo, 'id' | 'addedAt'>) => {
    const newVid: CuratedYouTubeVideo = {
      ...video,
      id: `yt-${Date.now()}`,
      addedAt: new Date().toISOString(),
    };
    setPersisted((prev) => ({
      ...prev,
      curatedVideos: [newVid, ...(prev.curatedVideos || INITIAL_CURATED_VIDEOS)],
    }));
  };

  const toggleApproveVideo = (id: string) => {
    setPersisted((prev) => ({
      ...prev,
      curatedVideos: (prev.curatedVideos || []).map((v) =>
        v.id === id ? { ...v, approvedByParent: !v.approvedByParent } : v,
      ),
    }));
  };

  const toggleFeatureVideo = (id: string) => {
    setPersisted((prev) => ({
      ...prev,
      curatedVideos: (prev.curatedVideos || []).map((v) =>
        v.id === id ? { ...v, featured: !v.featured } : v,
      ),
    }));
  };

  const removeCuratedVideo = (id: string) => {
    setPersisted((prev) => ({
      ...prev,
      curatedVideos: (prev.curatedVideos || []).filter((v) => v.id !== id),
    }));
  };

  const syncUpdatedChildFromServer = (serverChild: ChildProfile) => {
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === serverChild.id ? serverChild : c)),
    }));
  };

  const toggleChildAiAssistant: NonoLandContextValue['toggleChildAiAssistant'] = async (
    childId,
    enabled,
  ) => {
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === childId ? { ...c, aiAssistantEnabled: enabled } : c,
      ),
    }));

    if (authSession.authenticated && authSession.csrfToken && !childId.startsWith('demo-')) {
      try {
        const res = await fetch(`/api/parent/children/${encodeURIComponent(childId)}/ai-settings`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken,
          },
          body: JSON.stringify({ aiAssistantEnabled: enabled }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error || 'Failed to update AI setting' };
        if (data.child) syncUpdatedChildFromServer(data.child);
      } catch {
        return { ok: false, error: 'Network error updating AI setting' };
      }
    }
    return { ok: true };
  };

  const recordReadingStage: NonoLandContextValue['recordReadingStage'] = async ({
    stage,
    correctCount,
    totalCount,
  }) => {
    if (!activeChild) return { ok: false, mastered: false, starsAdded: 0, error: 'No active child profile' };
    if (authSession.authenticated && authSession.csrfToken && !activeChild.id.startsWith('demo-')) {
      try {
        const res = await fetch(
          `/api/children/${encodeURIComponent(activeChild.id)}/reading/complete-stage`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': authSession.csrfToken,
            },
            body: JSON.stringify({ stage, correctCount, totalCount }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, mastered: false, starsAdded: 0, error: data.error || 'Stage locked' };
        }
        if (data.child) syncUpdatedChildFromServer(data.child);
        if (data.mastered) soundEngine.playCelebration();
        return {
          ok: true,
          mastered: Boolean(data.mastered),
          starsAdded: Number(data.starsAdded || 0),
        };
      } catch {
        return { ok: false, mastered: false, starsAdded: 0, error: 'Network error' };
      }
    }

    // Local demo preview progression check
    const progressMap = { ...(activeChild.readingStageProgress || {}) };
    if (stage > 1 && !progressMap[stage - 1]?.mastered && activeChild.ageGroup !== '7' && activeChild.ageGroup !== '8') {
      return {
        ok: false,
        mastered: false,
        starsAdded: 0,
        error: language === 'ar'
          ? `أكمل المرحلة ${stage - 1} أولاً لفتح هذه المرحلة!`
          : `Master Stage ${stage - 1} first to unlock this stage!`,
      };
    }
    const accuracy = Math.round((correctCount / Math.max(1, totalCount)) * 100);
    const mastered = accuracy >= 75;
    const prev = progressMap[stage];
    const starsAdded = mastered && !prev?.mastered ? 4 : mastered ? 1 : 0;
    progressMap[stage] = {
      stage,
      mastered: Boolean(prev?.mastered || mastered),
      bestAccuracy: Math.max(prev?.bestAccuracy || 0, accuracy),
      attempts: (prev?.attempts || 0) + 1,
      completedAt: mastered ? new Date().toISOString() : prev?.completedAt,
    };
    setPersisted((prevState) => ({
      ...prevState,
      children: prevState.children.map((c) =>
        c.id === activeChild.id
          ? {
              ...c,
              stars: c.stars + starsAdded,
              readingStageProgress: progressMap,
            }
          : c,
      ),
    }));
    if (mastered) soundEngine.playCelebration();
    return { ok: true, mastered, starsAdded };
  };

  const completeFamilyActivity: NonoLandContextValue['completeFamilyActivity'] = async ({
    activityKey,
    title,
    durationMinutes,
    reflectionNote,
  }) => {
    if (!activeChild) return { ok: false, starsAdded: 0 };
    if (authSession.authenticated && authSession.csrfToken && !activeChild.id.startsWith('demo-')) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/family-activity`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken,
          },
          body: JSON.stringify({ activityKey, title, durationMinutes, reflectionNote }),
        });
        const data = await res.json();
        if (res.ok && data.child) {
          syncUpdatedChildFromServer(data.child);
          soundEngine.playCelebration();
          return { ok: true, starsAdded: Number(data.starsAdded || 2), record: data.record };
        }
      } catch {
        // fallback local record
      }
    }

    const rec: SharedFamilyActivityRecord = {
      id: `fam-${Date.now()}`,
      activityKey,
      title,
      durationMinutes,
      reflectionNote,
      completedAt: new Date().toISOString(),
    };
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) =>
        c.id === activeChild.id
          ? {
              ...c,
              stars: c.stars + 2,
              totalLearningMinutes: c.totalLearningMinutes + durationMinutes,
              familyActivitiesCompleted: [rec, ...(c.familyActivitiesCompleted || [])].slice(0, 60),
              activityTimeline: [
                {
                  id: `evt-${Date.now()}`,
                  timestamp: rec.completedAt,
                  category: 'family' as const,
                  title,
                  detail: {
                    ar: `نشاط عائلي مشترك (${durationMinutes} دقيقة)`,
                    en: `Shared family co-play (${durationMinutes} min)`,
                  },
                  starsEarned: 2,
                },
                ...(c.activityTimeline || []),
              ].slice(0, 120),
            }
          : c,
      ),
    }));
    soundEngine.playCelebration();
    return { ok: true, starsAdded: 2, record: rec };
  };

  const saveEntertainmentCreation: NonoLandContextValue['saveEntertainmentCreation'] = async ({
    kind,
    payload,
  }) => {
    if (!activeChild) return { ok: false, starsAdded: 0 };
    if (authSession.authenticated && authSession.csrfToken && !activeChild.id.startsWith('demo-')) {
      try {
        const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/entertainment/save`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': authSession.csrfToken,
          },
          body: JSON.stringify({ kind, payload }),
        });
        const data = await res.json();
        if (res.ok && data.child) {
          syncUpdatedChildFromServer(data.child);
          soundEngine.playCelebration();
          return { ok: true, starsAdded: Number(data.starsAdded || 0) };
        }
      } catch {
        // fallback local save
      }
    }

    const nowIso = new Date().toISOString();
    let starsAdded = 2;
    setPersisted((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== activeChild.id) return c;
        if (kind === 'music') {
          const notes = (payload.notes as MusicNoteEvent[]) || [];
          const title = String(payload.title || 'My Melody');
          const next = [{ id: `mus-${Date.now()}`, title, notes, createdAt: nowIso }, ...(c.musicCompositions || [])].slice(0, 20);
          return { ...c, stars: c.stars + 2, musicCompositions: next };
        }
        if (kind === 'build') {
          const blocks = (payload.blocks as BuildBlockItem[]) || [];
          const title = String(payload.title || 'My Build');
          const templateId = (payload.templateId as BuildConstruction['templateId']) || 'free';
          const next = [{ id: `bld-${Date.now()}`, title, templateId, blocks, createdAt: nowIso }, ...(c.buildConstructions || [])].slice(0, 20);
          return { ...c, stars: c.stars + 2, buildConstructions: next };
        }
        if (kind === 'chef') {
          const rid = String(payload.recipeId || '');
          const set = new Set(c.completedRecipes || []);
          starsAdded = set.has(rid) ? 0 : 2;
          set.add(rid);
          return { ...c, stars: c.stars + starsAdded, completedRecipes: Array.from(set) };
        }
        if (kind === 'theater') {
          const sid = String(payload.sceneId || '');
          const set = new Set(c.completedTheaterScenes || []);
          starsAdded = set.has(sid) ? 0 : 2;
          set.add(sid);
          return { ...c, stars: c.stars + starsAdded, completedTheaterScenes: Array.from(set) };
        }
        const tid = String(payload.themeId || '');
        const set = new Set(c.completedDiscoveryThemes || []);
        starsAdded = set.has(tid) ? 0 : 2;
        set.add(tid);
        return { ...c, stars: c.stars + starsAdded, completedDiscoveryThemes: Array.from(set) };
      }),
    }));
    soundEngine.playCelebration();
    return { ok: true, starsAdded };
  };

  return (
    <NonoLandContext.Provider
      value={{
        screen,
        navigate,
        language,
        setLanguage,
        parentAccount: persisted.parentAccount,
        setParentAccount,
        authSession,
        authResolved,
        dbUnavailable,
        isChildSession,
        refreshAuthSession,
        refreshChildrenList,
        enterSampleDemoMode,
        loginWithPassword,
        loginWithPasskey,
        childLogin,
        childQuickLogin,
        exitChildMode,
        logoutParent,
        logoutAllDevices,
        parentSettings: persisted.parentSettings,
        updateParentSettings,
        subscription: persisted.subscription,
        updateSubscription,
        childrenList: persisted.children,
        activeChild,
        selectChild,
        createChildProfile,
        updateChildProfile,
        selectedWorldId,
        selectedActivityId,
        selectedStoryId,
        lastAttempt,
        lastNewlyUnlockedBadge,
        lastNewlyIssuedCert,
        lastAssessment,
        showCelebration,
        dismissCelebration: () => setShowCelebration(false),
        recordGameAttempt,
        recordAssessmentResult,
        completeStory,
        saveDrawingToRoom,
        placeRoomItem,
        moveRoomItem,
        removePlacedRoomItem,
        saveRoomState,
        saveAvatarConfig,
        interactWithPet,
        completeLabExperiment,
        createCustomStory,
        deleteCustomStory,
        saveCreativeProject,
        deleteCreativeProject,
        redeemShopItem,
        claimDailyMission,
        saveLearningPlan,
        toggleDownloadWorld,
        isOnline,
        simulatedOffline: persisted.simulatedOffline,
        setSimulatedOffline: (val) =>
          setPersisted((prev) => ({ ...prev, simulatedOffline: val })),
        pendingSyncCount,
        offlineQueue,
        lastSyncedAt: persisted.lastSyncedAt,
        syncOfflineQueue,
        featureFlags,
        refreshFeatureFlags,
        resetAllData,
        recordConceptInteraction,
        recordLevel1Progress,
        recordLevel2Progress,
        completeDeepLesson,
        recordExamCompletion,
        updateCharacterOutfit,
        grantFunReward,
        curatedVideos,
        addCuratedVideo,
        toggleApproveVideo,
        toggleFeatureVideo,
        removeCuratedVideo,
        syncUpdatedChildFromServer,
        toggleChildAiAssistant,
        recordReadingStage,
        completeFamilyActivity,
        saveEntertainmentCreation,
      }}
    >
      {children}
    </NonoLandContext.Provider>
  );
};

export function useNonoLand() {
  const ctx = useContext(NonoLandContext);
  if (!ctx) throw new Error('useNonoLand must be used inside NonoLandProvider');
  return ctx;
}
