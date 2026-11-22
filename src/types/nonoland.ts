export type Language = 'ar' | 'en';

export type AgeGroupId = '1-4';
export type LegacyAgeGroupId = '3-4' | '5-6' | '7' | '8';
export type StoredAgeGroupId = AgeGroupId | LegacyAgeGroupId;
export type InternalAgeBand = '1-2' | '2-3' | '3-4';
export type RecommendedAgeRange = InternalAgeBand | '1-4';

export type WorldId =
  | 'arabic-letters'
  | 'english-letters'
  | 'numbers-kingdom'
  | 'animal-jungle'
  | 'colors-shapes'
  | 'intelligence-castle'
  | 'science-galaxy'
  | 'healthy-body'
  | 'life-skills'
  | 'creativity-island';

export type SkillId =
  | 'early-recognition'
  | 'arabic-literacy'
  | 'english-literacy'
  | 'numeracy'
  | 'math-reasoning'
  | 'logic-patterns'
  | 'science-discovery'
  | 'memory-focus'
  | 'life-health'
  | 'creativity-expression';

export type GameMechanic =
  | 'visual-tap'
  | 'memory-match'
  | 'sequence-builder'
  | 'math-lab'
  | 'maze-explorer'
  | 'drawing-studio'
  | 'music-rhythm'
  | 'sort-classify';

export type OfficialCharacterId = 'nono' | 'lolo' | 'leo' | 'bobo' | 'ellie' | 'titi';

export type NonoMood =
  | 'idle'
  | 'walking'
  | 'waving'
  | 'jumping'
  | 'thinking'
  | 'excited'
  | 'encouraging'
  | 'laughing'
  | 'celebrating'
  | 'sleeping'
  | 'listening'
  | 'dancing'
  | 'surprised';

export type AppScreen =
  | 'splash'
  | 'onboarding'
  | 'parent-auth'
  | 'create-child'
  | 'child-welcome'
  | 'baseline-assessment'
  | 'home'
  | 'academy'
  | 'exams'
  | 'homework'
  | 'fun-zone'
  | 'map'
  | 'world-detail'
  | 'game'
  | 'game-results'
  | 'discovery-lab'
  | 'assessment-results'
  | 'stories'
  | 'story-reader'
  | 'my-room'
  | 'my-avatar'
  | 'my-pet'
  | 'brain-games'
  | 'creative-studio'
  | 'reward-shop'
  | 'monthly-report'
  | 'achievements'
  | 'parent-dashboard'
  | 'teacher-dashboard'
  | 'admin-dashboard'
  | 'nono-ai'
  | 'reading-adventure'
  | 'family-activities'
  | 'entertainment-hub'
  | 'quran-world';

export type ConceptDomain = 'arabic' | 'english' | 'numbers' | 'colors-shapes' | 'science';

export type ConceptMasteryStage = 'exposed' | 'recognized' | 'recalled' | 'applied';

export type ConceptStatus =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'improving'
  | 'well-understood'
  | 'needs-revision';

export interface ConceptRecord {
  conceptId: string;
  domain: ConceptDomain;
  label: LocalizedText;
  stage: ConceptMasteryStage;
  status?: ConceptStatus;
  introduced?: boolean;
  explained?: boolean;
  practiced?: boolean;
  correctlyIdentified?: boolean;
  independentlyCompleted?: boolean;
  appliedInNewContext?: boolean;
  retainedAfterReview?: boolean;
  needsRevision?: boolean;
  completedLessonStages?: number[];
  exposures: number;
  correctCount: number;
  mistakesCount: number;
  lastPracticedAt: string;
}

export type ExamSubject = 'comprehensive' | 'arabic' | 'english' | 'math' | 'colors-science';

export type ExamQuestionType =
  | 'recognition'
  | 'listening'
  | 'matching'
  | 'missing-letter'
  | 'quantity'
  | 'sequence'
  | 'reading'
  | 'problem-solving';

export interface ExamQuestionItem {
  id: string;
  subject: Exclude<ExamSubject, 'comprehensive'>;
  ageGroups: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  type: ExamQuestionType;
  difficulty: 1 | 2 | 3;
  lessonRefId: string;
  lessonTitle: LocalizedText;
  prompt: LocalizedText;
  audioText?: string;
  audioLang?: Language;
  visualCue?: string;
  options: Array<{ id: string; label: LocalizedText; visual: string }>;
  correctOptionId: string;
  explanation: LocalizedText;
  published?: boolean;
}

export interface ExamConfig {
  examPriceEgp: number;
  currency: 'EGP';
  passingPercentage: number;
  questionsPerExam: number;
  paymentGatewayMode: 'development-test-verification' | 'live-gateway';
}

export interface ExamAttemptSummary {
  id: string;
  childId: string;
  childName: string;
  ageGroup: StoredAgeGroupId;
  subject: ExamSubject;
  mode: 'practice' | 'official';
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  passingPercentage: number;
  weakLessonTitles: LocalizedText[];
  certificateCode?: string;
  completedAt: string;
  paymentVerified: boolean;
  amountPaidEgp: number;
}

export interface CmsLessonRecord {
  id: string;
  domain: ConceptDomain;
  title: LocalizedText;
  summary: LocalizedText;
  ageGroups: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  targetSymbol: string;
  colorHex?: string;
  imageUrl?: string;
  audioUrl?: string;
  examples: Array<{ visual: string; label: LocalizedText }>;
  level?: 1 | 2;
  subject?: string;
  published: boolean;
  updatedAt: string;
}

export interface CharacterOutfit {
  characterId: 'nono' | 'lolo' | 'leo' | 'bobo' | 'ellie' | 'titi';
  hat: string;
  outfit: string;
  accessory: string;
  backdropColor: string;
}

export type YouTubeCategory = 'stories' | 'cartoons' | 'songs' | 'adventures';

export interface CuratedYouTubeVideo {
  id: string;
  videoId: string;
  title: LocalizedText;
  category: YouTubeCategory;
  ageGroups: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  approvedByParent: boolean;
  featured: boolean;
  addedAt: string;
}

export interface LocalizedText {
  ar: string;
  en: string;
}

export type UserRole =
  | 'parent'
  | 'child'
  | 'student'
  | 'teacher'
  | 'admin'
  | 'super_admin'
  | 'content_admin'
  | 'curriculum_manager'
  | 'support_agent'
  | 'finance_admin';

export type AccountStatus = 'active' | 'pending' | 'suspended' | 'rejected';

export type TeacherPermission =
  | 'manage_classes'
  | 'manage_questions'
  | 'manage_exams'
  | 'assign_exams'
  | 'view_results'
  | 'bulk_import';

export interface TeacherProfile {
  userId: string;
  displayName: string;
  email: string;
  phone?: string;
  bio?: string;
  subjects: string[];
  permissions: TeacherPermission[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  suspendedBy?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  status: AccountStatus;
}

export interface ParentAccount {
  id: string;
  name: string;
  displayName?: string;
  email: string;
  normalizedEmail?: string;
  role?: UserRole;
  status?: AccountStatus;
  phone?: string;
  emailVerified?: boolean;
  policyVersion?: string;
  termsAcceptedAt?: string;
  linkedChildId?: string;
  familyId?: string;
  guardianRole?: GuardianRole;
  teacherProfile?: TeacherProfile;
  createdAt: string;
  isDemoMode: boolean;
}

export interface PasskeySummary {
  id: string;
  label: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface SecurityEventLog {
  id: string;
  eventType:
    | 'AUTH_REGISTER'
    | 'AUTH_LOGIN_SUCCESS'
    | 'AUTH_LOGIN_FAIL'
    | 'AUTH_LOCKOUT'
    | 'EMAIL_VERIFIED'
    | 'PASSWORD_RESET'
    | 'PASSWORD_CHANGED'
    | 'PASSWORD_REAUTH_SUCCESS'
    | 'PASSWORD_REAUTH_FAIL'
    | 'PASSKEY_REGISTERED'
    | 'PASSKEY_LOGIN_SUCCESS'
    | 'PASSKEY_LOGIN_FAIL'
    | 'PASSKEY_REVOKED'
    | 'LOGOUT_ALL'
    | 'PARENT_GATE_FAIL'
    | 'PAYMENT_VERIFIED'
    | 'EXAM_COMPLETED'
    | 'CERT_ISSUED'
    | 'ADMIN_ACTION'
    | 'TEACHER_ACTION'
    | 'BULK_IMPORT'
    | 'STUDENT_PROGRESS_VIEW'
    | 'ACCESS_DENIED'
    | 'CONTENT_REVIEW'
    | 'CONTENT_VERSION'
    | 'FEATURE_FLAG_CHANGE'
    | 'HOMEWORK_ACTION'
    | 'BACKUP_RESTORE'
    | 'OFFLINE_SYNC'
    | 'AI_CHAT'
    | 'AI_SAFETY_BLOCK'
    | 'PARENT_SETTING_CHANGE'
    | 'REWARD_REDEEM'
    | 'CHILD_PROFILE_CHANGE'
    | 'READING_STAGE_COMPLETE'
    | 'FAMILY_ACTIVITY'
    | 'SMART_ASSESSMENT'
    | 'ENTERTAINMENT_SAVE'
    | 'CHILD_LOGIN'
    | 'CHILD_LOGIN_SUCCESS'
    | 'CHILD_LOGIN_FAIL'
    | 'CHILD_LOGIN_FAILED'
    | 'CHILD_LOGOUT'
    | 'CHILD_CREDENTIALS_UPDATE'
    | 'PARENT_GATE_VERIFY'
    | 'LOGOUT'
    | 'SESSION_REVOKED'
    | 'DEVICE_REGISTERED'
    | 'DEVICE_TRUSTED'
    | 'DEVICE_TRUST_CHANGED'
    | 'DEVICE_REVOKED'
    | 'GUARDIAN_INVITED'
    | 'GUARDIAN_ACCEPTED'
    | 'GUARDIAN_UPDATED'
    | 'GUARDIAN_REVOKED'
    | 'PRIVACY_SETTING_CHANGE'
    | 'PRIVACY_EXPORT'
    | 'PRIVACY_DELETE_REQUEST'
    | 'CONSENT_RECORDED'
    | 'CONSENT_UPDATED'
    | 'GARDEN_REWARD';
  familyId?: string;
  actorId?: string;
  actorRole?: string;
  role?: string;
  actionType?: string;
  recordType?: string;
  recordId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  outcome?: 'success' | 'denied' | 'blocked' | 'error';
  ip?: string;
  summary: string;
  createdAt: string;
}

export type Level1Subject = 'arabic' | 'english' | 'numbers' | 'colors';

export type Level1LessonStatus =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'improving'
  | 'demonstrated'
  | 'needs-revision';

export interface Level1VocabItem {
  id: string;
  text: string;
  secondaryText?: string;
  emoji: string;
  audioStatus: 'speech_synthesis_fallback' | 'pregenerated_pending' | 'verified_audio';
}

export type Level1ActivityFormat =
  | 'tap-select'
  | 'listen-select'
  | 'match-picture'
  | 'match-case'
  | 'find-hidden'
  | 'sort-drag'
  | 'count-collect'
  | 'color-picture'
  | 'memory-challenge'
  | 'visual-pattern'
  | 'independent-challenge';

export interface Level1LessonDefinition {
  id: string; // e.g., AR01..AR28, EN01..EN26, NM01..NM11, CL01..CL10
  subject: Level1Subject;
  level: 1;
  ageRange: '1-4';
  recommendedAgeRange?: RecommendedAgeRange;
  unit: string;
  order: number;
  title: LocalizedText;
  learningObjective: LocalizedText;
  characterIntro: LocalizedText;
  explanation: LocalizedText;
  targetSymbol: string;
  secondarySymbol?: string;
  colorHex?: string;
  numberValue?: number;
  teachingVocab: Level1VocabItem[];
  unseenVocab: Level1VocabItem[];
  activityFormats: Level1ActivityFormat[];
  prerequisiteIds: string[];
  suggestedMinutes: number;
  revisionIntervalHours: number;
  audioStatus: 'speech_synthesis_fallback' | 'pregenerated_pending' | 'verified_audio';
}

export interface Level1QuestionItem {
  id: string; // e.g., AR01-Q01 .. AR01-Q10
  lessonId: string;
  subject: Level1Subject;
  qType:
    | 'visual-id'
    | 'audio-id'
    | 'picture-match'
    | 'initial-sound'
    | 'finder'
    | 'letter-picture'
    | 'listen-choose'
    | 'odd-one-out'
    | 'new-example'
    | 'independent';
  prompt: LocalizedText;
  audioText?: string;
  audioLang?: Language;
  visualCue?: string;
  options: Array<{ id: string; label: LocalizedText; visual: string; colorHex?: string }>;
  correctOptionId: string;
  feedbackOnWrong: LocalizedText;
}

export interface Level1LessonProgress {
  lessonId: string;
  subject: Level1Subject;
  startedAt: string;
  explanationViewed: boolean;
  completedActivityIds: string[];
  correctCount: number;
  mistakesCount: number;
  lastScore?: number;
  lastTotal?: number;
  attemptsCount: number;
  status: Level1LessonStatus;
  lastPracticedAt: string;
  revisionDueAt?: string;
}

export interface ParentSettings {
  language: Language;
  musicEnabled: boolean;
  sfxVolume: number; // 0 to 1
  voiceNarration: boolean;
  muted: boolean;
  dailyScreenTimeMinutes: number;
  allowLocalAudioSynthesis: boolean;
  offlineSyncEnabled: boolean;
  reducedMotion?: boolean;
}

export interface SubscriptionState {
  tier: 'free' | 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'preview';
  renewsAt?: string;
}

export type AdaptiveDifficultyTier = 'easy' | 'medium' | 'advanced';

export interface SkillProgress {
  skillId: SkillId;
  attempts: number;
  correctCount: number;
  accuracy: number; // 0 - 100
  streak: number;
  sustainedStreak?: number;
  difficultyTier?: AdaptiveDifficultyTier;
  masteryLevel: 'exploring' | 'growing' | 'confident' | 'mastered';
  lastPracticedAt?: string;
  nextReviewDueAt?: string;
  reviewIntervalDays?: number;
  masteryReason?: LocalizedText;
  evidenceSummary?: {
    assessmentsCount: number;
    activitiesCount: number;
    unseenItemsCorrect: number;
    retentionPassed: boolean;
  };
}

export interface LearningAttempt {
  id: string;
  idempotencyKey?: string;
  activityId: string;
  worldId: WorldId;
  skillId: SkillId;
  ageGroup: StoredAgeGroupId;
  score: number;
  maxScore: number;
  accuracy: number;
  durationSeconds: number;
  starsEarned: number;
  completedAt: string;
  synced: boolean;
}

export interface OfflineSyncItem {
  idempotencyKey: string;
  childId: string;
  kind: 'game-attempt' | 'level1-progress' | 'level2-progress';
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'local-only' | 'synced';
}

export interface AssessmentResult {
  id: string;
  childId: string;
  ageGroup: StoredAgeGroupId;
  mode: 'baseline' | 'lab';
  date: string;
  questionsCompleted: number;
  correctAnswers: number;
  skillBreakdown: Partial<Record<SkillId, { correct: number; total: number }>>;
  recommendedWorldId: WorldId;
  recommendedActivityId: string;
  starsEarned: number;
}

export interface PlacedRoomItem {
  instanceId: string;
  itemId: string;
  x: number; // percentage 10-90
  y: number; // percentage 15-85
}

export interface SavedDrawing {
  id: string;
  title: string;
  dataUrl: string;
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  displayName: string;
  birthYear: number;
  birthMonth: number;
  ageMonths?: number;
  ageGroup: StoredAgeGroupId;
  language: Language;
  interests: string[];
  companionId: string;
  companionScarfColor: string;
  stars: number;
  level: number;
  completedBaseline: boolean;
  favoriteWorldId?: WorldId;
  recentActivityId?: string;
  unlockedWorlds: WorldId[];
  completedActivityIds: string[];
  unlockedCharacters: string[];
  unlockedBadges: string[];
  unlockedRoomItems: string[];
  placedRoomItems: PlacedRoomItem[];
  savedDrawings: SavedDrawing[];
  certificates: Certificate[];
  skillProgress: Record<SkillId, SkillProgress>;
  conceptMastery?: Record<string, ConceptRecord>;
  level1Progress?: Record<string, Level1LessonProgress>;
  level2Progress?: Record<string, Level2LessonProgress>;
  level2Unlocked?: boolean;
  studentUserId?: string;
  completedDeepLessons?: string[];
  examHistory?: ExamAttemptSummary[];
  characterOutfits?: Record<string, CharacterOutfit>;
  unlockedFunRewards?: string[];
  attempts: LearningAttempt[];
  assessmentHistory: AssessmentResult[];
  completedStoryIds: string[];
  completedMissionsToday: string[];
  totalLearningMinutes: number;
  downloadedWorldIds: WorldId[];
  avatarConfig?: ChildAvatarConfig;
  roomConfig?: RoomConfig;
  petState?: PetState;
  completedLabIds?: string[];
  labHistory?: LabCompletionRecord[];
  customStories?: CustomStory[];
  creativeProjects?: CreativeProject[];
  ownedShopItemIds?: string[];
  rewardTransactions?: RewardTransaction[];
  claimedMissionsDate?: string;
  claimedMissionIdsToday?: string[];
  learningStreakDays?: number;
  activeDaysHistory?: string[];
  monthlySnapshots?: Record<string, MonthlySnapshot>;
  parentSchedule?: ParentSchedulePreferences;
  nextMonthPlan?: LearningPlanGoal[];
  activityTimeline?: ActivityTimelineEvent[];
  aiAssistantEnabled?: boolean;
  readingStageProgress?: Record<number, ReadingStageProgress>;
  familyActivitiesCompleted?: SharedFamilyActivityRecord[];
  musicCompositions?: MusicComposition[];
  buildConstructions?: BuildConstruction[];
  completedDiscoveryThemes?: string[];
  completedRecipes?: string[];
  completedTheaterScenes?: string[];
  familyId?: string;
  hasChildCredentials?: boolean;
  accessCodeMasked?: string;
  learningGarden?: LearningGardenState;
}

export interface LearningWorld {
  id: WorldId;
  name: LocalizedText;
  subtitle: LocalizedText;
  description: LocalizedText;
  guardianName: LocalizedText;
  guardianEmoji: string;
  primaryColor: string;
  secondaryColor: string;
  bgGradient: string;
  mapPosition: { x: number; y: number }; // percentage on adventure map
  primarySkill: SkillId;
  isPremium?: boolean;
  unlockRequirementStars: number;
  levelsCount: number;
  certificateTitle: LocalizedText;
}

export interface GameChoiceOption {
  id: string;
  label: LocalizedText;
  visual: string; // emoji, Arabic/English letter, number, or color swatch hex
  isColorSwatch?: boolean;
  isCorrect?: boolean;
  audioCue?: LocalizedText;
  category?: string;
}

export interface GameQuestion {
  id: string;
  prompt: LocalizedText;
  hint: LocalizedText;
  visualCue?: string;
  options?: GameChoiceOption[];
  targetCount?: number;
  countEmoji?: string;
  sequenceItems?: string[]; // ordered sequence
  sequenceAnswer?: string[];
  pairs?: Array<{ id: string; left: string; right: string; label?: LocalizedText }>;
  sortBuckets?: Array<{ id: string; label: LocalizedText; emoji: string }>;
  sortItems?: Array<{ id: string; label: LocalizedText; visual: string; bucketId: string }>;
  mazeGrid?: number[][]; // 0 path, 1 wall, 2 start, 3 goal
  musicSequence?: number[]; // indices 0..4
}

export interface GameActivity {
  id: string;
  worldId: WorldId;
  level: number;
  title: LocalizedText;
  objective: LocalizedText;
  instructions: LocalizedText;
  mechanic: GameMechanic;
  skillId: SkillId;
  ageEligibility: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  difficulty: 1 | 2 | 3;
  estimatedMinutes: number;
  isPremium?: boolean;
  questions: GameQuestion[];
  drawingPrompt?: LocalizedText;
}

export interface StoryChoice {
  id: string;
  label: LocalizedText;
  nextSceneId: string;
  educationalTag?: LocalizedText;
}

export interface StoryScene {
  id: string;
  text: LocalizedText;
  illustrationEmoji: string;
  bgMood: string;
  nonoLine: LocalizedText;
  castCharacters?: OfficialCharacterId[];
  sceneKey?: string;
  predictionPrompt?: LocalizedText;
  choices?: StoryChoice[];
  isEnding?: boolean;
  rewardStars?: number;
}

export type StoryCategory =
  | 'interactive'
  | 'bedtime'
  | 'originals'
  | 'prediction'
  | 'values';

export interface Story {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  category?: StoryCategory;
  ageEligibility: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  worldId: WorldId;
  coverEmoji: string;
  accentColor: string;
  featuredCharacters?: OfficialCharacterId[];
  moralValue?: LocalizedText;
  isBedtime?: boolean;
  audioStatus?: 'speech_synthesis_fallback' | 'verified_audio';
  isPremium?: boolean;
  scenes: Record<string, StoryScene>;
  startSceneId: string;
}

export interface RoomItem {
  id: string;
  name: LocalizedText;
  category: 'furniture' | 'plant' | 'toy' | 'trophy' | 'companion';
  emoji: string;
  unlockHint: LocalizedText;
  starsCost?: number;
  earnedByWorld?: WorldId;
}

export interface CharacterCompanion {
  id: string;
  name: LocalizedText;
  role: LocalizedText;
  worldId: WorldId;
  emoji: string;
  color: string;
  personality: LocalizedText;
}

export interface RewardBadge {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  emoji: string;
  color: string;
  ruleDescription: LocalizedText;
}

export interface Certificate {
  id: string;
  uniqueCode: string;
  childName: string;
  worldId: WorldId;
  worldName: LocalizedText;
  achievementTitle: LocalizedText;
  issuedAt: string;
  levelCompleted: number;
  isOfficialExam?: boolean;
  examSubject?: ExamSubject;
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  passingPercentage?: number;
  ageGroup?: StoredAgeGroupId;
  verificationUrl?: string;
  revoked?: boolean;
}

export interface DailyMission {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  targetWorldId: WorldId;
  targetActivityId: string;
  rewardStars: number;
  icon: string;
}

export interface ParentInsight {
  id: string;
  type: 'strength' | 'practice' | 'recommendation';
  text: LocalizedText;
}

// =========================================================================
// TEACHER PORTAL, CLASSES, QUESTION BANK & ASSIGNED EXAMS
// =========================================================================

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  level: 1 | 2 | 'all';
  description?: string;
  ageGroup?: StoredAgeGroupId;
  recommendedAgeRange?: RecommendedAgeRange;
  teacherId: string;
  studentIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TeacherQuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'picture-id'
  | 'audio-id'
  | 'matching'
  | 'fill-blank'
  | 'short-answer'
  | 'ordering';

export type TeacherQuestionDifficulty = 'easy' | 'medium' | 'hard';

export type TeacherSubject =
  | 'arabic'
  | 'english'
  | 'math'
  | 'colors-shapes'
  | 'logic'
  | 'world-around-me'
  | 'colors-science'
  | 'numbers';

export interface TeacherQuestionOption {
  id: string;
  textAr: string;
  textEn: string;
  visual?: string;
}

export type ContentGovernanceStatus =
  | 'draft'
  | 'pending-review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'suspended'
  | 'archived';

export interface ContentVersionEntry {
  version: number;
  editedBy: string;
  editedByName?: string;
  editedAt: string;
  reason: string;
  snapshot: Record<string, unknown>;
}

export interface QuestionQualityFlag {
  code:
    | 'MISSING_AR_OR_EN'
    | 'MISSING_AUDIO_CUE'
    | 'MISSING_VISUAL'
    | 'DUPLICATE_PROMPT'
    | 'DUPLICATE_OPTIONS'
    | 'LOW_OPTION_COUNT'
    | 'SUBJECT_LESSON_MISMATCH'
    | 'BROKEN_MEDIA_REF'
    | 'INVALID_MARKS';
  severity: 'warning' | 'error';
  message: string;
}

export interface TeacherQuestion {
  id: string;
  teacherId: string;
  subject: TeacherSubject;
  level: 1 | 2;
  lessonId: string;
  questionType: TeacherQuestionType;
  promptAr: string;
  promptEn: string;
  imageUrl?: string;
  audioUrl?: string;
  audioText?: string;
  options: TeacherQuestionOption[];
  correctOptionId?: string;
  correctOptionIds?: string[]; // only when multiple correct answers explicitly supported
  allowMultipleCorrect?: boolean;
  matchingPairs?: Array<{ id: string; left: string; right: string }>;
  correctOrder?: string[];
  acceptedAnswers?: string[]; // for fill-blank / short-answer
  marks: number;
  difficulty: TeacherQuestionDifficulty;
  recommendedAgeRange?: RecommendedAgeRange;
  explanation: LocalizedText;
  feedbackCorrect: LocalizedText;
  feedbackIncorrect: LocalizedText;
  active: boolean;
  approvalStatus?: ContentGovernanceStatus;
  adminFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  qualityFlags?: QuestionQualityFlag[];
  version: number;
  versions?: ContentVersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ExamStatus =
  | 'draft'
  | 'pending-review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'archived';

export interface TeacherExam {
  id: string;
  teacherId: string;
  title: LocalizedText;
  description: LocalizedText;
  subject: TeacherSubject | 'comprehensive';
  level: 1 | 2;
  ageGroup: StoredAgeGroupId;
  recommendedAgeRange?: RecommendedAgeRange;
  lessonIds: string[];
  questionIds: string[];
  questionSnapshots?: Record<string, TeacherQuestion>;
  totalQuestions: number;
  totalMarks: number;
  passingPercentage: number;
  durationMinutes: number;
  startDate: string;
  endDate: string;
  allowedAttempts: number;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  status: ExamStatus;
  adminReviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  version: number;
  versions?: ContentVersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamAssignment {
  id: string;
  examId: string;
  studentId: string;
  teacherId: string;
  classId?: string;
  assignedAt: string;
  availableStartDate: string;
  deadline: string;
  extendedDeadline?: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'expired';
}

export interface AssignedExamReviewItem {
  questionId: string;
  questionType: TeacherQuestionType;
  prompt: LocalizedText;
  submittedAnswer: string | string[] | Record<string, string>;
  correctAnswer?: string | string[] | Record<string, string>;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  explanation?: LocalizedText;
  feedback?: LocalizedText;
}

export interface AssignedExamAttempt {
  id: string;
  assignmentId: string;
  examId: string;
  studentId: string;
  teacherId: string;
  attemptNumber: number;
  questionIds: string[];
  optionOrderMap: Record<string, string[]>;
  answers: Record<string, string | string[] | Record<string, string>>;
  status: 'in-progress' | 'submitted';
  score?: number;
  totalMarks?: number;
  percentage?: number;
  passed?: boolean;
  startedAt: string;
  submittedAt?: string;
  review?: AssignedExamReviewItem[];
}

// =========================================================================
// LEVEL 2 COMPLETE CURRICULUM TYPES ("Little Explorers — المستكشفون")
// =========================================================================

export type Level2Subject =
  | 'arabic'
  | 'english'
  | 'math'
  | 'colors-shapes'
  | 'logic'
  | 'world-around-me';

export type Level2LessonStatus =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'improving'
  | 'demonstrated'
  | 'needs-revision';

export type Level2ActivityType =
  | 'story-intro'
  | 'visual-examples'
  | 'listen-observe'
  | 'guided-practice'
  | 'matching-pairs'
  | 'word-builder'
  | 'fill-blank'
  | 'sorting-classify'
  | 'tracing-writing'
  | 'pattern-sequence'
  | 'maze-spatial'
  | 'memory-cards'
  | 'independent-challenge';

export interface Level2VocabItem {
  id: string;
  wordAr: string;
  wordEn: string;
  emoji: string;
  phoneticHint?: string;
  audioText?: string;
  audioLang?: Language;
}

export interface Level2ActivitySpec {
  id: string;
  type: Level2ActivityType;
  title: LocalizedText;
  instruction: LocalizedText;
  prompt?: LocalizedText;
  visual?: string;
  audioText?: string;
  audioLang?: Language;
  options?: Array<{ id: string; label: LocalizedText; visual: string; colorHex?: string }>;
  correctOptionId?: string;
  pairs?: Array<{ id: string; left: string; right: string; label?: LocalizedText }>;
  sequenceItems?: string[];
  targetWord?: string;
  wordLetters?: string[];
  sortBuckets?: Array<{ id: string; label: LocalizedText; emoji: string }>;
  sortItems?: Array<{ id: string; label: LocalizedText; visual: string; bucketId: string }>;
  traceTarget?: string;
  feedbackCorrect: LocalizedText;
  feedbackIncorrect: LocalizedText;
}

export interface Level2LessonDefinition {
  id: string; // e.g., L2-AR01 .. L2-WA08
  subject: Level2Subject;
  level: 2;
  ageRange: '1-4';
  recommendedAgeRange?: RecommendedAgeRange;
  lessonNumber: number;
  title: LocalizedText;
  learningObjective: LocalizedText;
  prerequisiteIds: string[];
  characterName: LocalizedText;
  characterEmoji: string;
  characterIntro: LocalizedText;
  teachingContent: LocalizedText;
  examples: Array<{ title: LocalizedText; visual: string; detail: LocalizedText }>;
  vocabulary: Level2VocabItem[];
  imageVisual: string;
  audioCue: { text: string; lang: Language };
  activities: Level2ActivitySpec[];
  completionCriteria: LocalizedText;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'challenging';
  recommendedReviewDays: number[];
}

export interface Level2QuestionItem {
  id: string;
  lessonId: string;
  subject: Level2Subject;
  level: 2;
  kind: 'practice' | 'independent';
  qType:
    | 'multiple-choice'
    | 'true-false'
    | 'picture-id'
    | 'audio-id'
    | 'matching'
    | 'fill-blank'
    | 'ordering';
  difficulty: 1 | 2 | 3;
  prompt: LocalizedText;
  audioText?: string;
  audioLang?: Language;
  visualCue?: string;
  options: Array<{ id: string; label: LocalizedText; visual: string; colorHex?: string }>;
  correctOptionId: string;
  explanation: LocalizedText;
  feedbackCorrect: LocalizedText;
  feedbackIncorrect: LocalizedText;
}

export interface Level2LessonProgress {
  lessonId: string;
  subject: Level2Subject;
  startedAt: string;
  completedSteps: number[];
  completedActivityIds: string[];
  correctCount: number;
  mistakesCount: number;
  timeSpentSeconds: number;
  lastScore?: number;
  lastTotal?: number;
  attemptsCount: number;
  status: Level2LessonStatus;
  skillsDemonstrated: string[];
  lastPracticedAt: string;
  revisionDueAt?: string;
  reviewIntervalStep: number; // 0->1d, 1->3d, 2->7d
}

export interface Level2ProgressionConfig {
  allowOpenExploration: boolean;
  minLevel1DemonstratedForBadge: number;
  requirePlacementOrMasteryForOfficialExam: boolean;
}

// =========================================================================
// HOMEWORK & ASSIGNMENTS, FEATURE FLAGS & OPERATIONAL GOVERNANCE
// =========================================================================

export type HomeworkType =
  | 'multiple-choice'
  | 'picture-matching'
  | 'audio-activity'
  | 'reading-practice'
  | 'writing-practice'
  | 'math-exercise'
  | 'interactive-game'
  | 'teacher-questions';

export interface HomeworkAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'audio' | 'document';
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface HomeworkAssignment {
  id: string;
  teacherId: string;
  title: LocalizedText;
  instructions: LocalizedText;
  subject: TeacherSubject | 'comprehensive';
  level: 1 | 2;
  recommendedAgeRange?: RecommendedAgeRange;
  lessonIds: string[];
  homeworkType: HomeworkType;
  questionIds: string[];
  questionSnapshots?: Record<string, TeacherQuestion>;
  attachments: HomeworkAttachment[];
  assignedClassIds: string[];
  assignedStudentIds: string[];
  startDate: string;
  deadline: string;
  maxAttempts: number;
  passingPercentage: number;
  status: ContentGovernanceStatus;
  adminFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  version: number;
  versions?: ContentVersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export type HomeworkSubmissionStatus =
  | 'assigned'
  | 'opened'
  | 'in-progress'
  | 'submitted'
  | 'completed'
  | 'overdue';

export interface HomeworkStudentSubmission {
  id: string;
  assignmentId: string;
  homeworkVersion: number;
  studentId: string;
  teacherId: string;
  openedAt?: string;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  attemptCount: number;
  extendedDeadline?: string;
  extensionReason?: string;
  status: HomeworkSubmissionStatus;
  answers: Record<string, string | string[] | Record<string, string>>;
  textResponse?: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  passed?: boolean;
  teacherFeedback?: string;
  gradedAt?: string;
  review?: AssignedExamReviewItem[];
}

export interface FeatureFlags {
  level2Enabled: boolean;
  teacherHomeworkEnabled: boolean;
  paidAssessmentsEnabled: boolean;
  certificatesEnabled: boolean;
  offlineLearningEnabled: boolean;
  newSubjectsEnabled: boolean;
  newGameModulesEnabled: boolean;
  requireTeacherContentApproval: boolean;
  quranWorldEnabled: boolean;
}

// =========================================================================
// IMMERSIVE WORLDS: AVATAR, ROOM + GARDEN, PET, LAB, STORIES, CREATIVE, SHOP & REPORTS
// =========================================================================

export interface ChildAvatarConfig {
  hairStyle: 'curly' | 'bob' | 'spiky' | 'braids' | 'cap-hair' | 'classic';
  hairColor: string;
  skinTone: string;
  outfit: 'explorer' | 'astronaut' | 'artist' | 'scientist' | 'royal' | 'sporty';
  outfitColor: string;
  accessory: 'none' | 'glasses' | 'star-pin' | 'headband' | 'cape' | 'backpack';
  expression: 'happy' | 'curious' | 'proud' | 'silly';
  unlockedCosmetics: string[];
}

export interface GardenPlant {
  id: string;
  slotIndex: number;
  speciesId: 'sunflower' | 'lavender' | 'strawberry' | 'star-cactus';
  stage: 0 | 1 | 2 | 3; // 0: seed, 1: sprout, 2: bud, 3: bloom
  waterCount: number;
  lastWateredAt?: string;
}

export interface RoomConfig {
  theme: 'sunny' | 'garden' | 'starry' | 'cozy-pink' | 'space';
  wallColor: string;
  wallpaper: 'solid' | 'stars' | 'clouds' | 'stripes';
  floorStyle: 'wood' | 'pastel-tile' | 'star-carpet';
  curtains: 'mint' | 'violet' | 'gold' | 'none';
  rug: 'cloud' | 'rainbow' | 'star' | 'none';
  lighting: 'daylight' | 'warm-lamp' | 'nightlight';
  gardenPlants: GardenPlant[];
  toyTapsCount?: number;
}

export type PetSpeciesId =
  | 'star-puppy'
  | 'cloud-kitten'
  | 'honey-bunny'
  | 'cosmic-dragon'
  | 'garden-turtle';

export interface PetState {
  adopted: boolean;
  speciesId: PetSpeciesId;
  presetNameId: string;
  mood: 'happy' | 'playful' | 'cozy';
  accessories: string[];
  habitatDecor: string[];
  careCount: number;
  playCount: number;
  lastInteractionAt?: string;
}

export type CreativeProjectKind =
  | 'drawing'
  | 'coloring'
  | 'shapes'
  | 'stickers'
  | 'character-decor'
  | 'picture-story';

export interface CreativeProject {
  id: string;
  kind: CreativeProjectKind;
  title: string;
  dataUrl?: string;
  sceneJson?: Record<string, unknown>;
  createdAt: string;
}

export interface CustomStoryPage {
  id: string;
  title: string;
  text: string;
  emojiScene: string;
  characterId: OfficialCharacterId;
  backdrop: string;
}

export interface CustomStory {
  id: string;
  title: string;
  characterId: OfficialCharacterId;
  setting: string;
  pages: CustomStoryPage[];
  createdAt: string;
}

export interface RewardShopItem {
  id: string;
  category: 'avatar' | 'pet' | 'room' | 'island' | 'character';
  name: LocalizedText;
  description: LocalizedText;
  emoji: string;
  costStars: number;
  badgeUnlockReq?: string;
}

export interface RewardTransaction {
  id: string;
  idempotencyKey: string;
  itemId: string;
  category: string;
  starsSpent: number;
  redeemedAt: string;
}

export interface LabCompletionRecord {
  experimentId: string;
  completedAt: string;
  attempts: number;
  starsAwarded: number;
  ageGroup: StoredAgeGroupId;
}

export type ReportSubjectKey =
  | 'arabic'
  | 'english'
  | 'math'
  | 'logic'
  | 'creative'
  | 'general'
  | 'quran-values';

export interface MonthlySubjectSnapshot {
  subjectKey: ReportSubjectKey;
  completedCount: number;
  accuracyPct: number | null;
  levelLabel: string;
}

export interface MonthlySnapshot {
  monthKey: string; // YYYY-MM
  recordedAt: string;
  learningDays: string[];
  totalMinutes: number;
  completedLessons: number;
  completedActivities: number;
  completedLabIds: string[];
  completedStoryIds: string[];
  stars: number;
  subjectBaseline: Record<ReportSubjectKey, MonthlySubjectSnapshot>;
}

export interface ParentSchedulePreferences {
  preferredDays: string[];
  dailyGoalMinutes: number;
  reminderTime: string;
  weeklySummaryEmail: boolean;
  achievementAlerts: boolean;
  focusAreas: ReportSubjectKey[];
}

export interface LearningPlanGoal {
  id: string;
  subject: ReportSubjectKey;
  title: LocalizedText;
  targetCount: number;
  focusNote: LocalizedText;
  enabled: boolean;
}

export interface ActivityTimelineEvent {
  id: string;
  timestamp: string;
  category:
    | 'lesson'
    | 'game'
    | 'lab'
    | 'story'
    | 'creative'
    | 'pet'
    | 'reward'
    | 'exam'
    | 'reading'
    | 'family'
    | 'entertainment'
    | 'quran';
  title: LocalizedText;
  detail: LocalizedText;
  starsEarned?: number;
}

export interface MonthlyReportSubjectSummary {
  subjectKey: ReportSubjectKey;
  title: LocalizedText;
  completedLessonsAndActivities: number;
  demonstratedCount: number;
  practicingCount: number;
  needsRevisionCount: number;
  baselineAccuracyPct: number | null;
  currentAccuracyPct: number | null;
  improvementDeltaPct: number | null;
  baselineAvailable: boolean;
  currentLevelLabel: LocalizedText;
  note: LocalizedText;
}

export interface MonthlyReportData {
  monthKey: string; // YYYY-MM
  childId: string;
  childName: string;
  ageGroup: StoredAgeGroupId;
  learningDaysCount: number;
  learningStreakDays: number;
  totalLearningMinutes: number;
  completedLessonsCount: number;
  completedActivitiesCount: number;
  completedLabCount: number;
  completedStoriesCount: number;
  assessmentsCount: number;
  starsEarnedTotal: number;
  unlockedBadgesCount: number;
  certificatesCount: number;
  baselineAvailable: boolean;
  subjects: MonthlySubjectSnapshot[] | MonthlyReportSubjectSummary[];
  subjectBreakdown: MonthlyReportSubjectSummary[];
  achievementsEarned: Array<{ id: string; title: LocalizedText; emoji: string }>;
  strengths: LocalizedText[];
  areasNeedingAttention: LocalizedText[];
  recommendations: LocalizedText[];
  nextMonthPlan: LearningPlanGoal[];
  availableMonths: string[];
  comparison?: {
    compareMonthKey: string;
    learningDaysDelta: number;
    lessonsDelta: number;
    activitiesDelta: number;
    minutesDelta: number;
    baselineAvailable: boolean;
  } | null;
}

// =========================================================================
// PHASE 1-6: NONO AI, SMART ASSESSMENT, EMOTIONAL FEEDBACK, READING, CREATIVE & FAMILY
// =========================================================================

export interface NonoAiChatRequest {
  childId: string;
  message: string;
  mode?: 'explain' | 'hint' | 'question' | 'encourage';
  language?: Language;
  currentTopic?: string;
  currentQuestionPrompt?: string;
  attemptCount?: number;
}

export interface NonoAiChatResponse {
  reply: string;
  hint?: string;
  explanation?: string;
  followUpQuestion?: string;
  recommendedScreen?: AppScreen;
  mood: NonoMood;
  blocked?: boolean;
  safeRedirect?: boolean;
  usageRemaining?: number;
}

export type SmartAssessmentFormat =
  | 'mcq'
  | 'image-recognition'
  | 'listening'
  | 'matching'
  | 'sorting'
  | 'sequencing'
  | 'memory'
  | 'phonics'
  | 'counting-math'
  | 'age-challenge';

export interface SmartAssessmentQuestionPublic {
  id: string;
  format: SmartAssessmentFormat;
  domain: 'arabic' | 'english' | 'math' | 'colors-shapes' | 'logic' | 'science';
  skillId: SkillId;
  difficulty: AdaptiveDifficultyTier;
  ageGroups: StoredAgeGroupId[];
  recommendedAgeRange?: RecommendedAgeRange;
  prompt: LocalizedText;
  audioText?: string;
  audioLang?: Language;
  visualCue?: string;
  options?: Array<{ id: string; label: LocalizedText; visual: string; colorHex?: string }>;
  pairs?: Array<{ id: string; left: string; rightOptions: string[] }>;
  sortBuckets?: Array<{ id: string; label: LocalizedText; emoji: string }>;
  sortItems?: Array<{ id: string; label: LocalizedText; visual: string }>;
  sequencePool?: string[];
  memoryTiles?: Array<{ id: string; visual: string; pairKey: string }>;
  countingPrompt?: { emoji: string; groupA: number; groupB?: number; op?: '+' | '-' | 'count' };
}

export interface EmotionalFeedbackPayload {
  tone: 'celebrate' | 'encourage' | 'simplify';
  characterId: OfficialCharacterId;
  title: LocalizedText;
  message: LocalizedText;
  hintStep?: LocalizedText;
  workedExample?: {
    visual: string;
    explanation: LocalizedText;
  };
  simplifiedSteps?: LocalizedText[];
  recommendedRevisionScreen?: AppScreen;
}

export interface SmartAssessmentStartResponse {
  sessionId: string;
  childId: string;
  difficultyTier: AdaptiveDifficultyTier;
  totalQuestions: number;
  currentIndex: number;
  question: SmartAssessmentQuestionPublic;
}

export interface SmartAssessmentSubmitResponse {
  correct: boolean;
  difficultyTier: AdaptiveDifficultyTier;
  streak: number;
  consecutiveMistakes: number;
  emotionalFeedback: EmotionalFeedbackPayload;
  finished: boolean;
  nextIndex?: number;
  nextQuestion?: SmartAssessmentQuestionPublic;
  summary?: {
    score: number;
    totalQuestions: number;
    percentage: number;
    starsEarned: number;
    avgResponseMs: number;
    strengths: SkillId[];
    weakSkills: SkillId[];
    recommendedRevision: Array<{ screen: AppScreen; label: LocalizedText; reason: LocalizedText }>;
    updatedSkillProgress: Record<SkillId, SkillProgress>;
  };
}

export type ReadingStageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ReadingStageProgress {
  stage: ReadingStageId;
  mastered: boolean;
  bestAccuracy: number;
  attempts: number;
  completedAt?: string;
}

export interface MusicNoteEvent {
  noteIdx: number;
  instrument: 'xylophone' | 'drum' | 'flute' | 'bell';
  step: number;
}

export interface MusicComposition {
  id: string;
  title: string;
  notes: MusicNoteEvent[];
  createdAt: string;
}

export interface BuildBlockItem {
  id: string;
  shape: 'square' | 'triangle' | 'arch' | 'pillar' | 'window' | 'tree' | 'bridge';
  color: string;
  x: number;
  y: number;
}

export interface BuildConstruction {
  id: string;
  title: string;
  templateId: 'house' | 'bridge' | 'tower' | 'free';
  blocks: BuildBlockItem[];
  createdAt: string;
}

export interface SharedFamilyActivityRecord {
  id: string;
  activityKey: string;
  title: LocalizedText;
  durationMinutes: number;
  guardianId?: string;
  guardianName?: string;
  reflectionNote?: string;
  completedAt: string;
}

// =========================================================================
// FAMILY ECOSYSTEM: GUARDIANS, TRUSTED DEVICES, PARENT GATE, ADAPTIVE, REPORTS, PRIVACY & GARDEN
// =========================================================================

export type GuardianRole = 'primary_guardian' | 'secondary_guardian' | 'caregiver';

export type GuardianPermission =
  | 'view_profiles'
  | 'view_progress'
  | 'view_reports'
  | 'manage_learning_settings'
  | 'manage_credentials'
  | 'manage_screen_time'
  | 'approve_content'
  | 'manage_devices'
  | 'manage_guardians';

export interface FamilyAccount {
  id: string;
  name: string;
  primaryGuardianId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuardianMembership {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  email: string;
  role: GuardianRole;
  permissions: GuardianPermission[];
  status: 'active' | 'revoked';
  invitedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface GuardianInvitation {
  id: string;
  familyId: string;
  email: string;
  role: Exclude<GuardianRole, 'primary_guardian'>;
  permissions: GuardianPermission[];
  invitedByUserId: string;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface TrustedDeviceRecord {
  id: string;
  familyId: string;
  userId: string;
  deviceName: string;
  deviceType: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  browser: string;
  os: string;
  trusted: boolean;
  revoked: boolean;
  firstRegisteredAt: string;
  lastActiveAt: string;
  revokedAt?: string;
  isCurrentDevice?: boolean;
}

export interface FamilyAuditEvent {
  id: string;
  familyId: string;
  category:
    | 'auth'
    | 'security'
    | 'device'
    | 'guardian'
    | 'profile'
    | 'content'
    | 'privacy'
    | 'ai'
    | 'learning';
  actionType: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  childId?: string;
  childName?: string;
  deviceId?: string;
  severity?: 'info' | 'warning' | 'critical';
  title: LocalizedText;
  description: LocalizedText;
  metadata?: Record<string, string | number | boolean>;
  ip?: string;
  createdAt: string;
}

export type AdaptiveSkillStatus =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'improving'
  | 'demonstrated'
  | 'needs-revision';

export interface AdaptiveSkillBreakdown {
  skillId: SkillId;
  label: LocalizedText;
  status: AdaptiveSkillStatus;
  accuracy: number;
  attempts: number;
  evidenceCount: number;
  completedLessonsCount: number;
  lastPracticedAt?: string;
  note: LocalizedText;
}

export interface AdaptiveLearningProfileData {
  childId: string;
  stageLabel: LocalizedText;
  generatedAt: string;
  skills: AdaptiveSkillBreakdown[];
  strongAreas: SkillId[];
  supportAreas: SkillId[];
  nextRecommendedActivity: {
    lessonId: string;
    worldId: WorldId;
    skillId: SkillId;
    title: LocalizedText;
    reason: LocalizedText;
  };
}

export interface WeeklyReportData {
  childId: string;
  childName: string;
  weekStart: string; // YYYY-MM-DD (Monday UTC)
  weekEnd: string;   // YYYY-MM-DD (Sunday UTC)
  timezone: string;
  generatedAt: string;
  metrics: {
    totalMinutes: number;
    activeDaysCount: number;
    lessonsCompleted: number;
    lessonsAttempted: number;
    assessmentsCompleted: number;
    storiesCompleted: number;
    creativeActivitiesCount: number;
    togetherActivitiesCount: number;
    starsEarned: number;
  };
  strongSkills: SkillId[];
  supportSkills: SkillId[];
  recommendedFocus: {
    skillId: SkillId;
    label: LocalizedText;
    suggestion: LocalizedText;
  };
  dailyBreakdown: Array<{
    date: string;
    activitiesCount: number;
    minutes: number;
    stars: number;
  }>;
  comparisonPreviousWeek: {
    previousWeekStart: string;
    lessonsDelta: number;
    minutesDelta: number;
    starsDelta: number;
  };
  summaryMessage: LocalizedText;
}

export interface ContentPermissionPolicy {
  familyId: string;
  allowStories: boolean;
  allowSongsAudio: boolean;
  allowVideos: boolean;
  allowGamesCreative: boolean;
  aiCompanionEnabled: boolean;
  voiceInteractionEnabled: boolean;
  ageStrictMode: boolean;
  allowExternalContent: boolean;
  allowedStoryCategories: string[];
  blockedVideoIds: string[];
  allowedVideoIds: string[];
  updatedAt: string;
  updatedBy?: string;
}

export type PrivacyConsentType =
  | 'essential_terms'
  | 'ai_features'
  | 'voice_interaction'
  | 'learning_analytics'
  | 'notifications';

export interface PrivacyConsentRecord {
  id: string;
  familyId: string;
  consentKey: PrivacyConsentType;
  granted: boolean;
  policyVersion: string;
  grantedByUserId: string;
  grantedByName: string;
  grantedAt: string;
  withdrawnAt?: string;
}

export interface FamilyPrivacySettings {
  familyId: string;
  childProfileVisibility: 'private';
  aiFeaturesConsent: boolean;
  voiceInteractionConsent: boolean;
  analyticsConsent: boolean;
  essentialTermsConsent: boolean;
  policyVersion: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface DataGovernanceRequest {
  id: string;
  familyId: string;
  type: 'export' | 'deletion';
  status: 'completed' | 'requested' | 'scheduled';
  requestedByUserId: string;
  requestedByName: string;
  note?: string;
  requestedAt: string;
  completedAt?: string;
}

export interface AiUsageRecord {
  id: string;
  childId: string;
  familyId?: string;
  actorId?: string;
  mode: string;
  language: Language;
  topic?: string;
  blocked: boolean;
  voiceUsed: boolean;
  createdAt: string;
}

export interface GardenItemDefinition {
  id: string;
  category: 'flower' | 'tree' | 'butterfly' | 'stone' | 'decor' | 'plant';
  name: LocalizedText;
  emoji: string;
  milestoneHint: LocalizedText;
}

export interface GardenPlacement {
  instanceId: string;
  itemId: string;
  x: number;
  y: number;
  growthStage: 1 | 2 | 3;
}

export interface GardenRewardEvent {
  id: string;
  childId: string;
  milestoneKey: string;
  itemUnlockedId: string;
  reason: LocalizedText;
  awardedAt: string;
}

export interface LearningGardenState {
  unlockedItemIds: string[];
  placements: GardenPlacement[];
  wateringCount: number;
  lastWateredAt?: string;
  theme: 'sunny-meadow' | 'spring-rain' | 'starlight-garden';
  milestonesUnlocked: string[];
}

// =========================================================================
// QURAN WORLD (عالم القرآن الكريم — اسمع، ردد، واتعلم مع نونو)
// =========================================================================

export type QuranVerificationStatus = 'verified' | 'pending_verification' | 'unavailable';

export type QuranMemorizationStatus =
  | 'not_started'
  | 'heard'
  | 'practiced'
  | 'familiar'
  | 'parent_confirmed';

export interface QuranAyahSpec {
  number: number;
  verseKey: string;
  textUthmani: string;
  ageMeaning: {
    young: LocalizedText;
    mid: LocalizedText;
    older: LocalizedText;
  };
}

export interface QuranSurahSpec {
  id: string;
  number: number;
  nameAr: string;
  nameEn: string;
  englishMeaning: string;
  revelationType: 'meccan' | 'medinan';
  ayahCount: number;
  recommendedMinBand: InternalAgeBand;
  hasOpeningBasmalah: boolean;
  textSource: string;
  textSourceUrl: string;
  textVerificationStatus: QuranVerificationStatus;
  textSha256: string;
  ayahs: QuranAyahSpec[];
  ageSummary: {
    young: LocalizedText;
    mid: LocalizedText;
    older: LocalizedText;
  };
  gentleValue: LocalizedText;
}

export interface QuranReciterSpec {
  id: string;
  canonicalSlug?: string;
  name: LocalizedText;
  reciterType: 'adult' | 'child';
  riwayah?: LocalizedText;
  style: LocalizedText;
  sourceName: string;
  licenseOrPermission: string;
  attributionText?: LocalizedText;
  tajweedReviewedBy?: string;
  tajweedReviewedAt?: string;
  sourceVerificationStatus?: 'confirmed' | 'pending' | 'revoked';
  sourceVerifiedAt?: string;
  sourceEvidenceVersion?: string;
  verificationStatus: QuranVerificationStatus;
  surahAudioUrls?: Record<string, string>;
  ayahAudioUrls?: Record<string, string>;
  basmalaAudioUrl?: string;
  closingPhraseAudioUrl?: string;
  unavailableReason?: LocalizedText;
}

export type QuranPhraseAssetStatus =
  | 'not_configured'
  | 'configured_pending_approval'
  | 'approved';

export interface QuranPhraseAudioAssetConfig {
  phraseKey: 'basmala' | 'closing';
  phraseAr: string;
  labelEn: string;
  isQuranVerse: boolean;
  audioUrl: string | null;
  status: QuranPhraseAssetStatus;
  verificationStatus: QuranVerificationStatus;
  sourceName: string;
  licenseOrPermission: string;
  licenseConfirmed: boolean;
  humanListeningApproved: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export type QuranStorySymbolicTheme =
  | 'birds-protection'
  | 'olive-ark'
  | 'whale-sea'
  | 'kind-brothers'
  | 'river-basket'
  | 'little-ant'
  | 'starry-sky'
  | 'light-cave';

export type QuranStorySfxCue =
  | 'birds'
  | 'waves'
  | 'whale'
  | 'stars'
  | 'river'
  | 'forest'
  | 'dawn'
  | 'cave'
  | 'chime';

export interface QuranStorySurahReference {
  surahNumber: number;
  surahNameAr: string;
  surahNameEn: string;
  ayahRange: string;
}

export type QuranStoryActivitySpec =
  | {
      id: string;
      type: 'tap-targets';
      title: LocalizedText;
      instruction: LocalizedText;
      successMessage: LocalizedText;
      retryMessage: LocalizedText;
      requiredCount: number;
      items: Array<{
        id: string;
        label: LocalizedText;
        emoji: string;
        xPct: number;
        yPct: number;
        isTarget: boolean;
      }>;
    }
  | {
      id: string;
      type: 'place-pairs';
      title: LocalizedText;
      instruction: LocalizedText;
      successMessage: LocalizedText;
      retryMessage: LocalizedText;
      destinationLabel: LocalizedText;
      items: Array<{
        id: string;
        label: LocalizedText;
        emoji: string;
        pairCountLabel: LocalizedText;
      }>;
    }
  | {
      id: string;
      type: 'sequence-cards';
      title: LocalizedText;
      instruction: LocalizedText;
      successMessage: LocalizedText;
      retryMessage: LocalizedText;
      steps: Array<{
        id: string;
        order: number;
        label: LocalizedText;
        emoji: string;
      }>;
    }
  | {
      id: string;
      type: 'match-kindness';
      title: LocalizedText;
      instruction: LocalizedText;
      successMessage: LocalizedText;
      retryMessage: LocalizedText;
      choices: Array<{
        id: string;
        label: LocalizedText;
        emoji: string;
        isKindMatch: boolean;
      }>;
    };

export interface QuranStorySceneSpec {
  id: string;
  order: number;
  phase: 'intro' | 'middle' | 'ending';
  title: LocalizedText;
  durationSeconds: number;
  illustrationKey: string;
  sfxCue: QuranStorySfxCue;
  narrationAudioUrl?: string | null;
  narration: {
    young: LocalizedText;
    mid: LocalizedText;
    older: LocalizedText;
  };
  activity?: QuranStoryActivitySpec;
}

export interface QuranStorySpec {
  id: string;
  order: number;
  title: LocalizedText;
  description: LocalizedText;
  durationSeconds: number;
  recommendedMinBand: InternalAgeBand;
  coverImage: string;
  symbolicTheme: QuranStorySymbolicTheme;
  symbolicElements: string[];
  prohibitsProphetDepiction: true;
  surahReferences: QuranStorySurahReference[];
  establishedQuranicFacts: LocalizedText[];
  simplifiedExplanation: LocalizedText;
  ageSummary: {
    young: LocalizedText;
    mid: LocalizedText;
    older: LocalizedText;
  };
  narrationNote: LocalizedText;
  quotedVerse?: {
    surahId: string;
    verseKey: string;
    textUthmani: string;
  };
  moralLesson: LocalizedText;
  publishedStatus: 'published' | 'draft';
  enabled: boolean;
  scenes: QuranStorySceneSpec[];
  closingQuiz: {
    question: LocalizedText;
    options: Array<{
      id: string;
      label: LocalizedText;
      emoji: string;
      isCorrect: boolean;
    }>;
    successFeedback: LocalizedText;
    retryFeedback: LocalizedText;
  };
  closingActivity: {
    prompt: LocalizedText;
    actionLabel: LocalizedText;
    rewardEmoji: string;
    completionPhrase: LocalizedText;
  };
  completionBadge: {
    id: string;
    title: LocalizedText;
    icon: string;
  };
}

export interface QuranStorySceneOverride {
  id: string;
  order?: number;
  title?: LocalizedText;
  durationSeconds?: number;
  illustrationKey?: string;
  sfxCue?: QuranStorySfxCue;
  narrationAudioUrl?: string | null;
  narration?: {
    young: LocalizedText;
    mid: LocalizedText;
    older: LocalizedText;
  };
}

export interface QuranStoryAdminOverride {
  storyId: string;
  enabled?: boolean;
  publishedStatus?: 'published' | 'draft';
  title?: LocalizedText;
  description?: LocalizedText;
  moralLesson?: LocalizedText;
  simplifiedExplanation?: LocalizedText;
  coverImage?: string;
  surahReferences?: QuranStorySurahReference[];
  sceneOrder?: string[];
  sceneOverrides?: Record<string, QuranStorySceneOverride>;
  updatedByUserId?: string;
  updatedAt: string;
}

export interface QuranStoryProgressDetails {
  id: string;
  childId: string;
  storyId: string;
  startedAt: string;
  lastSceneIndex: number;
  totalScenes: number;
  scenesCompleted: string[];
  listenedSeconds: number;
  audioCompleted: boolean;
  interactionsCompleted: string[];
  quizCompleted: boolean;
  closingActivityCompleted: boolean;
  completed: boolean;
  completedCount: number;
  completedAt?: string;
  completionBadgeAwarded?: string;
  lastReadAt: string;
  lastCompletionToken?: string;
}

export interface QuranMannerSpec {
  id: string;
  title: LocalizedText;
  phraseAr: string;
  transliteration: string;
  icon: string;
  whenToUse: LocalizedText;
  agePractice: {
    young: LocalizedText;
    mid: LocalizedText;
    older: LocalizedText;
  };
  togetherPrompt: LocalizedText;
}

export interface QuranChildSettings {
  childId: string;
  enabled: boolean;
  allowedSurahIds: string[];
  surahOrder: string[];
  preferredReciterId: string;
  preferChildReciterFallback: boolean;
  repeatCount: number;
  listenOnlyMode: boolean;
  dailyMaxMinutes: number;
  gentleReminderEnabled: boolean;
  updatedByUserId?: string;
  updatedAt: string;
}

export interface QuranSurahProgress {
  id: string;
  childId: string;
  surahId: string;
  listenCount: number;
  repeatSessionsCount: number;
  ayahsPracticed: number[];
  status: QuranMemorizationStatus;
  parentConfirmedMemorization: boolean;
  parentConfirmedAt?: string;
  parentConfirmedByUserId?: string;
  parentNote?: string;
  lastListenedAt?: string;
  updatedAt: string;
}

export interface QuranStoryProgress {
  id: string;
  childId: string;
  storyId: string;
  completedCount: number;
  lastReadAt: string;
}

export interface QuranMannerProgress {
  id: string;
  childId: string;
  mannerId: string;
  practicedCount: number;
  lastPracticedAt: string;
}

export interface QuranActivityEvent {
  id: string;
  childId: string;
  eventType: 'listen' | 'repeat' | 'story' | 'manner' | 'parent_confirm';
  targetId: string;
  durationSeconds: number;
  ayahCount: number;
  reciterId?: string;
  recordedByUserId?: string;
  occurredAt: string;
}

export type QuranSurahReviewResult = 'pending' | 'passed' | 'issues_found';

export interface QuranSurahHumanReviewEntry {
  surahId: string;
  chapterNumber: number;
  ayahCount: number;
  reviewedAyahNumbers: number[];
  reviewerName: string;
  reviewDate: string;
  reviewResult: QuranSurahReviewResult;
  notes: string;
}

export interface QuranConfirmationItemRecord {
  confirmed: boolean;
  confirmedBy?: string;
  confirmedByUserId?: string;
  confirmedAt?: string;
  policyVersion?: string;
}

export interface QuranAdminConfirmations {
  qfDeveloperTermsAndCommercialUse: QuranConfirmationItemRecord;
  qfAttributionAndReciterCredit: QuranConfirmationItemRecord;
  sevenDayCachePolicy: QuranConfirmationItemRecord;
  privacyAndTermsReadiness: QuranConfirmationItemRecord;
  basmalaAudioApproval: QuranConfirmationItemRecord;
  // Backward-compatible combined alias synced from qfDeveloperTermsAndCommercialUse + qfAttributionAndReciterCredit
  qfAttributionAndTerms?: QuranConfirmationItemRecord;
}

export interface QuranAudioProbeDiagnostics {
  url: string;
  finalUrl?: string;
  redirected: boolean;
  ok: boolean;
  httpStatus: number;
  contentType: string;
  byteLength: number;
  magicFormat: string;
  browserPlayable: boolean;
  checkedAt: string;
  reason?: string;
}

export type QuranSourceVerificationCheckKey =
  | 'provider'
  | 'reciterId'
  | 'reciterIdentity'
  | 'recitationStyle'
  | 'riwayah'
  | 'curatedTextIntegrity'
  | 'audioCoverage'
  | 'audioTechnicalValidation';

export interface QuranSourceVerificationChecklistItem {
  key: QuranSourceVerificationCheckKey;
  order: number;
  labelEn: string;
  labelAr: string;
  expectedEn: string;
  expectedAr: string;
  status: 'passed' | 'failed' | 'pending';
  evidenceEn: string;
  evidenceAr: string;
  checkedAt?: string;
}

export interface QuranSourceVerificationRecord {
  status: 'confirmed' | 'pending' | 'revoked';
  confirmed: boolean;
  confirmedBy?: string;
  confirmedByUserId?: string;
  confirmedAt?: string;
  revokedBy?: string;
  revokedByUserId?: string;
  revokedAt?: string;
  provider: string;
  reciterId: number;
  reciterIdentity: string;
  recitationStyle: string;
  riwayah: string;
  evidenceVersion: string;
  evaluatedAt?: string;
  urlSetHash?: string;
  providerMetadataVerified?: boolean;
  textSha256VerifiedCount?: number;
  textSha256TotalCount?: number;
  textAyahsVerifiedCount?: number;
  surahUrlsPresentCount?: number;
  ayahUrlsPresentCount?: number;
  audioProbePassedCount?: number;
  audioProbeTotalCount?: number;
  audioProbeInvalidCount?: number;
  audioProbeDuplicateCount?: number;
  audioProbeError?: string;
  statusMessage: string;
}

export interface QuranReleaseReadinessSummary {
  familyAccessEnabled: boolean;
  reciterVerified: boolean;
  reciterStatus: QuranVerificationStatus;
  adminConfirmationsCount: number;
  adminConfirmationsTotal: number;
  allAdminConfirmationsComplete: boolean;
  sourceVerificationConfirmed: boolean;
  sourceVerificationStatus: 'confirmed' | 'pending' | 'revoked';
  sourceVerificationChecklistPassed: boolean;
  sourceVerificationChecklistPassedCount: number;
  sourceVerificationChecklistTotalCount: number;
  sourceVerificationChecklist: QuranSourceVerificationChecklistItem[];
  sourceVerification: QuranSourceVerificationRecord;
  sourceVerificationMessage: string;
  textIntegrityVerified: boolean;
  audioUrlsComplete: boolean;
  audioTechnicalIntegrityVerified: boolean;
  basmalaStatus: QuranPhraseAssetStatus;
  basmalaApproved: boolean;
  basmalaPlayable: boolean;
  closingStatus: QuranPhraseAssetStatus;
  closingDisabled: boolean;
  closingBlocksRelease: false;
  integrityChecksReady: boolean;
  textIntegrityConfirmed: boolean;
  audioIntegrityConfirmed: boolean;
  reciterIdentityConfirmed: boolean;
  surahAudioUrlsCount: number;
  ayahAudioUrlsCount: number;
  canApproveFamilyRelease: boolean;
  confirmations: QuranAdminConfirmations;
  pendingApprovals: Array<{
    key: string;
    labelEn: string;
    labelAr: string;
    actionRequiredEn?: string;
    actionRequiredAr?: string;
  }>;
}

export interface QuranContentVerificationRecord {
  id: string;
  contentType: 'surah_text' | 'reciter_audio';
  contentKey: string;
  sourceName: string;
  licenseOrPermission: string;
  tajweedReviewedBy?: string;
  tajweedReviewedAt?: string;
  textIntegrityConfirmed?: boolean;
  audioIntegrityConfirmed?: boolean;
  reciterIdentityConfirmed?: boolean;
  tajweedListeningConfirmed?: boolean;
  licenseTermsConfirmed?: boolean;
  licenseConfirmedBy?: string;
  licenseConfirmedAt?: string;
  surahChecklist?: Record<string, QuranSurahHumanReviewEntry>;
  adminConfirmations?: QuranAdminConfirmations;
  sourceVerification?: QuranSourceVerificationRecord;
  basmalaCandidateProbe?: QuranAudioProbeDiagnostics;
  verificationStatus: QuranVerificationStatus;
  audioUrlsJson?: Record<string, string>;
  ayahAudioUrlsJson?: Record<string, string>;
  notes?: string;
  updatedByUserId?: string;
  updatedAt: string;
}





