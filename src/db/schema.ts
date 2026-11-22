import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  ActivityTimelineEvent,
  AdaptiveDifficultyTier,
  AiUsageRecord,
  AssessmentResult,
  AssignedExamReviewItem,
  BuildConstruction,
  Certificate,
  CharacterOutfit,
  ChildAvatarConfig,
  CmsLessonRecord,
  ConceptRecord,
  ContentGovernanceStatus,
  ContentPermissionPolicy,
  ContentVersionEntry,
  CreativeProject,
  CustomStory,
  ExamQuestionItem,
  ExamStatus,
  ExamSubject,
  FamilyAuditEvent,
  GardenPlacement,
  GardenRewardEvent,
  GuardianPermission,
  GuardianRole,
  HomeworkAttachment,
  HomeworkSubmissionStatus,
  HomeworkType,
  LabCompletionRecord,
  Language,
  LearningAttempt,
  LearningGardenState,
  LearningPlanGoal,
  Level1LessonProgress,
  Level2LessonProgress,
  LocalizedText,
  MonthlySnapshot,
  MusicComposition,
  ParentSchedulePreferences,
  PetState,
  PlacedRoomItem,
  PrivacyConsentType,
  QuestionQualityFlag,
  QuranMemorizationStatus,
  QuranVerificationStatus,
  ReadingStageProgress,
  RecommendedAgeRange,
  RewardTransaction,
  RoomConfig,
  SavedDrawing,
  SharedFamilyActivityRecord,
  SkillId,
  SkillProgress,
  SmartAssessmentFormat,
  StoredAgeGroupId,
  TeacherExam,
  TeacherProfile,
  TeacherQuestion,
  TeacherQuestionDifficulty,
  TeacherQuestionOption,
  TeacherQuestionType,
  TeacherSubject,
  WorldId,
} from '../types/nonoland.ts';

// 1. Families
export const families = pgTable(
  'families',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    primaryGuardianId: text('primary_guardian_id').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('families_primary_guardian_idx').on(table.primaryGuardianId)],
);

// 2. Users (Parent, Child, Student, Teacher, Admin roles)
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull().unique(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    status: text('status').notNull().default('active'),
    phone: text('phone'),
    bio: text('bio'),
    linkedChildId: text('linked_child_id'),
    familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
    teacherProfile: jsonb('teacher_profile').$type<TeacherProfile | null>(),
    policyVersion: text('policy_version').notNull().default('2026.04'),
    termsAcceptedAt: text('terms_accepted_at').notNull(),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('users_role_status_idx').on(table.role, table.status),
    index('users_family_id_idx').on(table.familyId),
    index('users_linked_child_id_idx').on(table.linkedChildId),
  ],
);

// 3. Guardian Memberships
export const guardianMemberships = pgTable(
  'guardian_memberships',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    email: text('email').notNull(),
    role: text('role').$type<GuardianRole>().notNull(),
    permissions: jsonb('permissions').$type<GuardianPermission[]>().notNull(),
    status: text('status').$type<'active' | 'revoked'>().notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    uniqueIndex('guardian_memberships_family_user_uidx').on(table.familyId, table.userId),
    index('guardian_memberships_user_idx').on(table.userId),
  ],
);

// 4. Guardian Invitations
export const guardianInvitations = pgTable(
  'guardian_invitations',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').$type<Exclude<GuardianRole, 'primary_guardian'>>().notNull(),
    permissions: jsonb('permissions').$type<GuardianPermission[]>().notNull(),
    invitedByUserId: text('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedByName: text('invited_by_name').notNull(),
    status: text('status').$type<'pending' | 'accepted' | 'revoked' | 'expired'>().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
  },
  (table) => [index('guardian_invitations_family_idx').on(table.familyId)],
);

// 5. Trusted Devices
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceName: text('device_name').notNull(),
    deviceType: text('device_type').$type<'desktop' | 'tablet' | 'mobile' | 'unknown'>().notNull(),
    browser: text('browser').notNull(),
    os: text('os').notNull(),
    userAgent: text('user_agent').notNull(),
    ip: text('ip').notNull(),
    trusted: boolean('trusted').notNull().default(false),
    revoked: boolean('revoked').notNull().default(false),
    firstRegisteredAt: text('first_registered_at').notNull(),
    lastActiveAt: text('last_active_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [index('trusted_devices_family_idx').on(table.familyId)],
);

// 6. Sessions (Shared across all app instances)
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    lastActiveAt: bigint('last_active_at', { mode: 'number' }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    ip: text('ip').notNull(),
    userAgent: text('user_agent').notNull(),
    sessionKind: text('session_kind').$type<'parent' | 'child' | 'staff' | null>(),
    childId: text('child_id'),
    familyId: text('family_id').references(() => families.id, { onDelete: 'set null' }),
    deviceId: text('device_id'),
    rememberMe: boolean('remember_me').default(false),
    parentGateVerifiedUntil: bigint('parent_gate_verified_until', { mode: 'number' }),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

// 7. Action Tokens (Email verify, password reset)
export const actionTokens = pgTable(
  'action_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'email-verify' | 'password-reset'>().notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    used: boolean('used').notNull().default(false),
  },
  (table) => [index('action_tokens_user_id_idx').on(table.userId)],
);

// 8. Parent Gate Credentials
export const parentGateCredentials = pgTable(
  'parent_gate_credentials',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    pinHash: text('pin_hash').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('parent_gate_family_idx').on(table.familyId)],
);

// 9. Children
export const children = pgTable(
  'children',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
    studentUserId: text('student_user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    birthYear: integer('birth_year').notNull(),
    birthMonth: integer('birth_month').notNull(),
    ageMonths: integer('age_months'),
    ageGroup: text('age_group').$type<StoredAgeGroupId>().notNull(),
    language: text('language').$type<Language>().notNull().default('ar'),
    interests: jsonb('interests').$type<string[]>().notNull().default([]),
    companionId: text('companion_id').notNull().default('nono'),
    companionScarfColor: text('companion_scarf_color').notNull().default('#FF9360'),
    stars: integer('stars').notNull().default(0),
    level: integer('level').notNull().default(1),
    completedBaseline: boolean('completed_baseline').notNull().default(false),
    favoriteWorldId: text('favorite_world_id').$type<WorldId | null>(),
    recentActivityId: text('recent_activity_id'),
    unlockedWorlds: jsonb('unlocked_worlds').$type<WorldId[]>().notNull().default([]),
    completedActivityIds: jsonb('completed_activity_ids').$type<string[]>().notNull().default([]),
    unlockedCharacters: jsonb('unlocked_characters').$type<string[]>().notNull().default([]),
    unlockedBadges: jsonb('unlocked_badges').$type<string[]>().notNull().default([]),
    unlockedRoomItems: jsonb('unlocked_room_items').$type<string[]>().notNull().default([]),
    placedRoomItems: jsonb('placed_room_items').$type<PlacedRoomItem[]>().notNull().default([]),
    savedDrawings: jsonb('saved_drawings').$type<SavedDrawing[]>().notNull().default([]),
    certificates: jsonb('certificates').$type<Certificate[]>().notNull().default([]),
    skillProgress: jsonb('skill_progress').$type<Record<SkillId, SkillProgress>>().notNull(),
    conceptMastery: jsonb('concept_mastery').$type<Record<string, ConceptRecord> | null>(),
    level1Progress: jsonb('level1_progress').$type<Record<string, Level1LessonProgress> | null>(),
    level2Progress: jsonb('level2_progress').$type<Record<string, Level2LessonProgress> | null>(),
    level2Unlocked: boolean('level2_unlocked').default(false),
    completedDeepLessons: jsonb('completed_deep_lessons').$type<string[] | null>(),
    examHistory: jsonb('exam_history').$type<any[] | null>(),
    characterOutfits: jsonb('character_outfits').$type<Record<string, CharacterOutfit> | null>(),
    unlockedFunRewards: jsonb('unlocked_fun_rewards').$type<string[] | null>(),
    attempts: jsonb('attempts').$type<LearningAttempt[]>().notNull().default([]),
    assessmentHistory: jsonb('assessment_history').$type<AssessmentResult[]>().notNull().default([]),
    completedStoryIds: jsonb('completed_story_ids').$type<string[]>().notNull().default([]),
    completedMissionsToday: jsonb('completed_missions_today').$type<string[]>().notNull().default([]),
    totalLearningMinutes: integer('total_learning_minutes').notNull().default(0),
    downloadedWorldIds: jsonb('downloaded_world_ids').$type<WorldId[]>().notNull().default([]),
    avatarConfig: jsonb('avatar_config').$type<ChildAvatarConfig | null>(),
    roomConfig: jsonb('room_config').$type<RoomConfig | null>(),
    petState: jsonb('pet_state').$type<PetState | null>(),
    completedLabIds: jsonb('completed_lab_ids').$type<string[] | null>(),
    labHistory: jsonb('lab_history').$type<LabCompletionRecord[] | null>(),
    customStories: jsonb('custom_stories').$type<CustomStory[] | null>(),
    creativeProjects: jsonb('creative_projects').$type<CreativeProject[] | null>(),
    ownedShopItemIds: jsonb('owned_shop_item_ids').$type<string[] | null>(),
    rewardTransactions: jsonb('reward_transactions').$type<RewardTransaction[] | null>(),
    claimedMissionsDate: text('claimed_missions_date'),
    claimedMissionIdsToday: jsonb('claimed_mission_ids_today').$type<string[] | null>(),
    learningStreakDays: integer('learning_streak_days').default(0),
    activeDaysHistory: jsonb('active_days_history').$type<string[] | null>(),
    monthlySnapshots: jsonb('monthly_snapshots').$type<Record<string, MonthlySnapshot> | null>(),
    parentSchedule: jsonb('parent_schedule').$type<ParentSchedulePreferences | null>(),
    nextMonthPlan: jsonb('next_month_plan').$type<LearningPlanGoal[] | null>(),
    activityTimeline: jsonb('activity_timeline').$type<ActivityTimelineEvent[] | null>(),
    aiAssistantEnabled: boolean('ai_assistant_enabled').default(true),
    readingStageProgress: jsonb('reading_stage_progress').$type<Record<number, ReadingStageProgress> | null>(),
    familyActivitiesCompleted: jsonb('family_activities_completed').$type<SharedFamilyActivityRecord[] | null>(),
    musicCompositions: jsonb('music_compositions').$type<MusicComposition[] | null>(),
    buildConstructions: jsonb('build_constructions').$type<BuildConstruction[] | null>(),
    completedDiscoveryThemes: jsonb('completed_discovery_themes').$type<string[] | null>(),
    completedRecipes: jsonb('completed_recipes').$type<string[] | null>(),
    completedTheaterScenes: jsonb('completed_theater_scenes').$type<string[] | null>(),
    learningGarden: jsonb('learning_garden').$type<LearningGardenState | null>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('children_parent_id_idx').on(table.parentId),
    index('children_family_id_idx').on(table.familyId),
    index('children_student_user_id_idx').on(table.studentUserId),
    check('children_stars_non_negative', sql`${table.stars} >= 0`),
    check('children_level_positive', sql`${table.level} >= 1`),
  ],
);

// 10. Child Credentials (replaces childCredentials + childAccessCodeIndex)
export const childCredentials = pgTable(
  'child_credentials',
  {
    childId: text('child_id')
      .primaryKey()
      .references(() => children.id, { onDelete: 'cascade' }),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    accessCodeHash: text('access_code_hash').notNull().unique(),
    accessCodeEncrypted: text('access_code_encrypted').notNull(),
    accessCodeLast4: text('access_code_last4').notNull(),
    pinHash: text('pin_hash').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    rotatedAt: text('rotated_at'),
    lastLoginAt: text('last_login_at'),
  },
  (table) => [index('child_credentials_family_idx').on(table.familyId)],
);

// 11. Archived Children (Soft deletion / governance record)
export const archivedChildren = pgTable(
  'archived_children',
  {
    childId: text('child_id').primaryKey(),
    familyId: text('family_id').notNull(),
    parentId: text('parent_id').notNull(),
    displayName: text('display_name').notNull(),
    deletedByUserId: text('deleted_by_user_id').notNull(),
    deletedAt: text('deleted_at').notNull(),
    reason: text('reason'),
  },
  (table) => [index('archived_children_family_idx').on(table.familyId)],
);

// 12. Content Permission Policies
export const contentPolicies = pgTable('content_policies', {
  familyId: text('family_id')
    .primaryKey()
    .references(() => families.id, { onDelete: 'cascade' }),
  allowStories: boolean('allow_stories').notNull().default(true),
  allowSongsAudio: boolean('allow_songs_audio').notNull().default(true),
  allowVideos: boolean('allow_videos').notNull().default(true),
  allowGamesCreative: boolean('allow_games_creative').notNull().default(true),
  aiCompanionEnabled: boolean('ai_companion_enabled').notNull().default(true),
  voiceInteractionEnabled: boolean('voice_interaction_enabled').notNull().default(true),
  ageStrictMode: boolean('age_strict_mode').notNull().default(true),
  allowExternalContent: boolean('allow_external_content').notNull().default(false),
  allowedStoryCategories: jsonb('allowed_story_categories').$type<string[]>().notNull(),
  blockedVideoIds: jsonb('blocked_video_ids').$type<string[]>().notNull(),
  allowedVideoIds: jsonb('allowed_video_ids').$type<string[]>().notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

// 13. Privacy Settings
export const privacySettings = pgTable('privacy_settings', {
  familyId: text('family_id')
    .primaryKey()
    .references(() => families.id, { onDelete: 'cascade' }),
  childProfileVisibility: text('child_profile_visibility').$type<'private'>().notNull().default('private'),
  aiFeaturesConsent: boolean('ai_features_consent').notNull().default(true),
  voiceInteractionConsent: boolean('voice_interaction_consent').notNull().default(true),
  analyticsConsent: boolean('analytics_consent').notNull().default(true),
  essentialTermsConsent: boolean('essential_terms_consent').notNull().default(true),
  policyVersion: text('policy_version').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

// 14. Privacy Consents
export const privacyConsents = pgTable(
  'privacy_consents',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    consentKey: text('consent_key').$type<PrivacyConsentType>().notNull(),
    granted: boolean('granted').notNull(),
    policyVersion: text('policy_version').notNull(),
    grantedByUserId: text('granted_by_user_id').notNull(),
    grantedByName: text('granted_by_name').notNull(),
    grantedAt: text('granted_at').notNull(),
    withdrawnAt: text('withdrawn_at'),
  },
  (table) => [index('privacy_consents_family_idx').on(table.familyId)],
);

// 15. Data Governance Requests
export const dataRequests = pgTable(
  'data_requests',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    type: text('type').$type<'export' | 'deletion'>().notNull(),
    status: text('status').$type<'completed' | 'requested' | 'scheduled'>().notNull(),
    requestedByUserId: text('requested_by_user_id').notNull(),
    requestedByName: text('requested_by_name').notNull(),
    note: text('note'),
    requestedAt: text('requested_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [index('data_requests_family_idx').on(table.familyId)],
);

// 16. Family Audit Events
export const familyAuditEvents = pgTable(
  'family_audit_events',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    category: text('category').$type<FamilyAuditEvent['category']>().notNull(),
    actionType: text('action_type').notNull(),
    actorId: text('actor_id'),
    actorName: text('actor_name'),
    actorRole: text('actor_role'),
    childId: text('child_id'),
    childName: text('child_name'),
    deviceId: text('device_id'),
    severity: text('severity').$type<'info' | 'warning' | 'critical'>(),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    description: jsonb('description').$type<LocalizedText>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean> | null>(),
    ip: text('ip'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('family_audit_events_family_created_idx').on(table.familyId, table.createdAt),
  ],
);

// 17. Security Logs
export const securityLogs = pgTable(
  'security_logs',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    familyId: text('family_id'),
    actorId: text('actor_id'),
    actorRole: text('actor_role'),
    role: text('role'),
    actionType: text('action_type'),
    recordType: text('record_type'),
    recordId: text('record_id'),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    reason: text('reason'),
    outcome: text('outcome'),
    ip: text('ip'),
    summary: text('summary').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('security_logs_created_idx').on(table.createdAt),
    index('security_logs_family_idx').on(table.familyId),
  ],
);

// 18. AI Usage Records & Daily Counters
export const aiUsageRecords = pgTable(
  'ai_usage_records',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    familyId: text('family_id'),
    actorId: text('actor_id'),
    mode: text('mode').notNull(),
    language: text('language').$type<Language>().notNull(),
    topic: text('topic'),
    blocked: boolean('blocked').notNull().default(false),
    voiceUsed: boolean('voice_used').notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('ai_usage_records_child_idx').on(table.childId)],
);

export const aiUsageDaily = pgTable('ai_usage_daily', {
  usageKey: text('usage_key').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

// 19. Garden Reward Events (note: preserves archived children history cleanly)
export const gardenRewardEvents = pgTable(
  'garden_reward_events',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    milestoneKey: text('milestone_key').notNull(),
    itemUnlockedId: text('item_unlocked_id').notNull(),
    reason: jsonb('reason').$type<LocalizedText>().notNull(),
    awardedAt: text('awarded_at').notNull(),
  },
  (table) => [
    uniqueIndex('garden_reward_child_milestone_uidx').on(table.childId, table.milestoneKey),
    index('garden_reward_child_idx').on(table.childId),
  ],
);

// 20. CMS Custom Lessons & Questions
export const customLessons = pgTable('custom_lessons', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull(),
  title: jsonb('title').$type<LocalizedText>().notNull(),
  summary: jsonb('summary').$type<LocalizedText>().notNull(),
  ageGroups: jsonb('age_groups').$type<StoredAgeGroupId[]>().notNull(),
  recommendedAgeRange: text('recommended_age_range').$type<RecommendedAgeRange | null>(),
  targetSymbol: text('target_symbol').notNull(),
  colorHex: text('color_hex'),
  imageUrl: text('image_url'),
  audioUrl: text('audio_url'),
  examples: jsonb('examples').$type<CmsLessonRecord['examples']>().notNull(),
  level: integer('level'),
  subject: text('subject'),
  published: boolean('published').notNull().default(true),
  updatedAt: text('updated_at').notNull(),
});

export const customQuestions = pgTable('custom_questions', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  ageGroups: jsonb('age_groups').$type<StoredAgeGroupId[]>().notNull(),
  recommendedAgeRange: text('recommended_age_range').$type<RecommendedAgeRange | null>(),
  type: text('type').notNull(),
  difficulty: integer('difficulty').notNull(),
  lessonRefId: text('lesson_ref_id').notNull(),
  lessonTitle: jsonb('lesson_title').$type<LocalizedText>().notNull(),
  prompt: jsonb('prompt').$type<LocalizedText>().notNull(),
  audioText: text('audio_text'),
  audioLang: text('audio_lang').$type<Language | null>(),
  visualCue: text('visual_cue'),
  options: jsonb('options').$type<ExamQuestionItem['options']>().notNull(),
  correctOptionId: text('correct_option_id').notNull(),
  explanation: jsonb('explanation').$type<LocalizedText>().notNull(),
  published: boolean('published').default(true),
});

// 21. Checkout Sessions & Exam Attempts
export const checkoutSessions = pgTable(
  'checkout_sessions',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    parentId: text('parent_id'),
    subject: text('subject').$type<ExamSubject>().notNull(),
    amountEgp: integer('amount_egp').notNull(),
    status: text('status').$type<'pending' | 'verified'>().notNull(),
    paymentToken: text('payment_token'),
    tokenConsumed: boolean('token_consumed').default(false),
    createdAt: text('created_at').notNull(),
    verifiedAt: text('verified_at'),
  },
  (table) => [index('checkout_sessions_child_idx').on(table.childId)],
);

export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    parentId: text('parent_id'),
    childName: text('child_name').notNull(),
    ageGroup: text('age_group').$type<StoredAgeGroupId>().notNull(),
    subject: text('subject').$type<ExamSubject>().notNull(),
    mode: text('mode').$type<'practice' | 'official'>().notNull(),
    questionIds: jsonb('question_ids').$type<string[]>().notNull(),
    paymentVerified: boolean('payment_verified').notNull(),
    amountPaidEgp: integer('amount_paid_egp').notNull(),
    passingPercentage: integer('passing_percentage').notNull(),
    submitted: boolean('submitted').notNull().default(false),
    summary: jsonb('summary').$type<any | null>(),
    certificateCode: text('certificate_code'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('exam_attempts_child_idx').on(table.childId)],
);

export const level1Attempts = pgTable(
  'level1_attempts',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    parentId: text('parent_id'),
    lessonId: text('lesson_id').notNull(),
    questionIds: jsonb('question_ids').$type<string[]>().notNull(),
    submitted: boolean('submitted').notNull().default(false),
    result: jsonb('result').$type<any | null>(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('level1_attempts_child_idx').on(table.childId)],
);

export const level2Attempts = pgTable(
  'level2_attempts',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    parentId: text('parent_id'),
    lessonId: text('lesson_id').notNull(),
    questionIds: jsonb('question_ids').$type<string[]>().notNull(),
    submitted: boolean('submitted').notNull().default(false),
    result: jsonb('result').$type<any | null>(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('level2_attempts_child_idx').on(table.childId)],
);

export const smartAssessmentSessions = pgTable(
  'smart_assessment_sessions',
  {
    id: text('id').primaryKey(),
    childId: text('child_id').notNull(),
    parentId: text('parent_id'),
    ageGroup: text('age_group').$type<StoredAgeGroupId>().notNull(),
    difficultyTier: text('difficulty_tier').$type<AdaptiveDifficultyTier>().notNull(),
    totalQuestions: integer('total_questions').notNull(),
    askedQuestionIds: jsonb('asked_question_ids').$type<string[]>().notNull(),
    results: jsonb('results').$type<Array<{
      questionId: string;
      format: SmartAssessmentFormat;
      skillId: SkillId;
      correct: boolean;
      responseTimeMs: number;
      difficulty: AdaptiveDifficultyTier;
    }>>().notNull(),
    streak: integer('streak').notNull(),
    consecutiveMistakes: integer('consecutive_mistakes').notNull(),
    hintsUsed: integer('hints_used').notNull(),
    finished: boolean('finished').notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('smart_assessment_child_idx').on(table.childId)],
);

export const certificates = pgTable('certificates', {
  uniqueCode: text('unique_code').primaryKey(),
  id: text('id').notNull(),
  childName: text('child_name').notNull(),
  worldId: text('world_id').$type<WorldId>().notNull(),
  worldName: jsonb('world_name').$type<LocalizedText>().notNull(),
  achievementTitle: jsonb('achievement_title').$type<LocalizedText>().notNull(),
  issuedAt: text('issued_at').notNull(),
  levelCompleted: integer('level_completed').notNull(),
  isOfficialExam: boolean('is_official_exam'),
  examSubject: text('exam_subject').$type<ExamSubject | null>(),
  score: integer('score'),
  totalQuestions: integer('total_questions'),
  percentage: integer('percentage'),
  passingPercentage: integer('passing_percentage'),
  ageGroup: text('age_group').$type<StoredAgeGroupId | null>(),
  verificationUrl: text('verification_url'),
  revoked: boolean('revoked').default(false),
});

export const processedSyncKeys = pgTable(
  'processed_sync_keys',
  {
    idempotencyKey: text('idempotency_key').primaryKey(),
    childId: text('child_id').notNull(),
    processedAt: text('processed_at').notNull(),
    summary: text('summary').notNull(),
  },
  (table) => [index('processed_sync_keys_child_idx').on(table.childId)],
);

// 22. Teacher Classes, Questions, Exams, Assignments, Homework
export const classes = pgTable(
  'classes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    level: text('level').notNull(),
    description: text('description'),
    ageGroup: text('age_group').$type<StoredAgeGroupId | null>(),
    recommendedAgeRange: text('recommended_age_range').$type<RecommendedAgeRange | null>(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentIds: jsonb('student_ids').$type<string[]>().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('classes_teacher_idx').on(table.teacherId)],
);

export const teacherQuestions = pgTable(
  'teacher_questions',
  {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subject: text('subject').$type<TeacherSubject>().notNull(),
    level: integer('level').notNull(),
    lessonId: text('lesson_id').notNull(),
    questionType: text('question_type').$type<TeacherQuestionType>().notNull(),
    promptAr: text('prompt_ar').notNull(),
    promptEn: text('prompt_en').notNull(),
    imageUrl: text('image_url'),
    audioUrl: text('audio_url'),
    audioText: text('audio_text'),
    options: jsonb('options').$type<TeacherQuestionOption[]>().notNull(),
    correctOptionId: text('correct_option_id'),
    correctOptionIds: jsonb('correct_option_ids').$type<string[] | null>(),
    allowMultipleCorrect: boolean('allow_multiple_correct'),
    matchingPairs: jsonb('matching_pairs').$type<Array<{ id: string; left: string; right: string }> | null>(),
    correctOrder: jsonb('correct_order').$type<string[] | null>(),
    acceptedAnswers: jsonb('accepted_answers').$type<string[] | null>(),
    marks: integer('marks').notNull(),
    difficulty: text('difficulty').$type<TeacherQuestionDifficulty>().notNull(),
    recommendedAgeRange: text('recommended_age_range').$type<RecommendedAgeRange | null>(),
    explanation: jsonb('explanation').$type<LocalizedText>().notNull(),
    feedbackCorrect: jsonb('feedback_correct').$type<LocalizedText>().notNull(),
    feedbackIncorrect: jsonb('feedback_incorrect').$type<LocalizedText>().notNull(),
    active: boolean('active').notNull().default(true),
    approvalStatus: text('approval_status').$type<ContentGovernanceStatus | null>(),
    adminFeedback: text('admin_feedback'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    qualityFlags: jsonb('quality_flags').$type<QuestionQualityFlag[] | null>(),
    version: integer('version').notNull().default(1),
    versions: jsonb('versions').$type<ContentVersionEntry[] | null>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('teacher_questions_teacher_idx').on(table.teacherId)],
);

export const teacherExams = pgTable(
  'teacher_exams',
  {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    description: jsonb('description').$type<LocalizedText>().notNull(),
    subject: text('subject').$type<TeacherSubject | 'comprehensive'>().notNull(),
    level: integer('level').notNull(),
    ageGroup: text('age_group').$type<StoredAgeGroupId>().notNull(),
    recommendedAgeRange: text('recommended_age_range').$type<RecommendedAgeRange | null>(),
    lessonIds: jsonb('lesson_ids').$type<string[]>().notNull(),
    questionIds: jsonb('question_ids').$type<string[]>().notNull(),
    questionSnapshots: jsonb('question_snapshots').$type<Record<string, TeacherQuestion> | null>(),
    totalQuestions: integer('total_questions').notNull(),
    totalMarks: integer('total_marks').notNull(),
    passingPercentage: integer('passing_percentage').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    allowedAttempts: integer('allowed_attempts').notNull(),
    randomizeQuestions: boolean('randomize_questions').notNull(),
    randomizeAnswers: boolean('randomize_answers').notNull(),
    showResults: boolean('show_results').notNull(),
    showCorrectAnswers: boolean('show_correct_answers').notNull(),
    status: text('status').$type<ExamStatus>().notNull(),
    adminReviewNote: text('admin_review_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    version: integer('version').notNull().default(1),
    versions: jsonb('versions').$type<ContentVersionEntry[] | null>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('teacher_exams_teacher_idx').on(table.teacherId)],
);

export const examAssignments = pgTable(
  'exam_assignments',
  {
    id: text('id').primaryKey(),
    examId: text('exam_id')
      .notNull()
      .references(() => teacherExams.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: text('class_id'),
    assignedAt: text('assigned_at').notNull(),
    availableStartDate: text('available_start_date').notNull(),
    deadline: text('deadline').notNull(),
    extendedDeadline: text('extended_deadline'),
    status: text('status').$type<'assigned' | 'in-progress' | 'completed' | 'expired'>().notNull(),
  },
  (table) => [
    index('exam_assignments_student_idx').on(table.studentId),
    index('exam_assignments_exam_idx').on(table.examId),
  ],
);

export const assignedExamAttempts = pgTable(
  'assigned_exam_attempts',
  {
    id: text('id').primaryKey(),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => examAssignments.id, { onDelete: 'cascade' }),
    examId: text('exam_id')
      .notNull()
      .references(() => teacherExams.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    questionIds: jsonb('question_ids').$type<string[]>().notNull(),
    optionOrderMap: jsonb('option_order_map').$type<Record<string, string[]>>().notNull(),
    answers: jsonb('answers').$type<Record<string, string | string[] | Record<string, string>>>().notNull(),
    status: text('status').$type<'in-progress' | 'submitted'>().notNull(),
    score: integer('score'),
    totalMarks: integer('total_marks'),
    percentage: integer('percentage'),
    passed: boolean('passed'),
    startedAt: text('started_at').notNull(),
    submittedAt: text('submitted_at'),
    review: jsonb('review').$type<AssignedExamReviewItem[] | null>(),
  },
  (table) => [
    index('assigned_exam_attempts_assignment_idx').on(table.assignmentId),
    index('assigned_exam_attempts_student_idx').on(table.studentId),
  ],
);

export const homeworks = pgTable(
  'homeworks',
  {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    instructions: jsonb('instructions').$type<LocalizedText>().notNull(),
    subject: text('subject').$type<TeacherSubject | 'comprehensive'>().notNull(),
    level: integer('level').notNull(),
    recommendedAgeRange: text('recommended_age_range').$type<RecommendedAgeRange | null>(),
    lessonIds: jsonb('lesson_ids').$type<string[]>().notNull(),
    homeworkType: text('homework_type').$type<HomeworkType>().notNull(),
    questionIds: jsonb('question_ids').$type<string[]>().notNull(),
    questionSnapshots: jsonb('question_snapshots').$type<Record<string, TeacherQuestion> | null>(),
    attachments: jsonb('attachments').$type<HomeworkAttachment[]>().notNull(),
    assignedClassIds: jsonb('assigned_class_ids').$type<string[]>().notNull(),
    assignedStudentIds: jsonb('assigned_student_ids').$type<string[]>().notNull(),
    startDate: text('start_date').notNull(),
    deadline: text('deadline').notNull(),
    maxAttempts: integer('max_attempts').notNull(),
    passingPercentage: integer('passing_percentage').notNull(),
    status: text('status').$type<ContentGovernanceStatus>().notNull(),
    adminFeedback: text('admin_feedback'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    version: integer('version').notNull().default(1),
    versions: jsonb('versions').$type<ContentVersionEntry[] | null>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('homeworks_teacher_idx').on(table.teacherId)],
);

export const homeworkSubmissions = pgTable(
  'homework_submissions',
  {
    id: text('id').primaryKey(),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => homeworks.id, { onDelete: 'cascade' }),
    homeworkVersion: integer('homework_version').notNull(),
    studentId: text('student_id').notNull(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    openedAt: text('opened_at'),
    startedAt: text('started_at'),
    submittedAt: text('submitted_at'),
    completedAt: text('completed_at'),
    attemptCount: integer('attempt_count').notNull(),
    extendedDeadline: text('extended_deadline'),
    extensionReason: text('extension_reason'),
    status: text('status').$type<HomeworkSubmissionStatus>().notNull(),
    answers: jsonb('answers').$type<Record<string, string | string[] | Record<string, string>>>().notNull(),
    textResponse: text('text_response'),
    score: integer('score'),
    totalMarks: integer('total_marks'),
    percentage: integer('percentage'),
    passed: boolean('passed'),
    teacherFeedback: text('teacher_feedback'),
    gradedAt: text('graded_at'),
    review: jsonb('review').$type<AssignedExamReviewItem[] | null>(),
  },
  (table) => [
    index('homework_submissions_assignment_idx').on(table.assignmentId),
    index('homework_submissions_student_idx').on(table.studentId),
  ],
);

export const homeworkAttachments = pgTable('homework_attachments', {
  id: text('id').primaryKey(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  kind: text('kind').$type<'image' | 'audio' | 'document'>().notNull(),
  url: text('url').notNull(),
  storedPath: text('stored_path').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: text('uploaded_at').notNull(),
});

export const importBatches = pgTable(
  'import_batches',
  {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    format: text('format').$type<'csv' | 'xlsx'>().notNull(),
    storedUploadPath: text('stored_upload_path').notNull(),
    validRows: jsonb('valid_rows').$type<any[]>().notNull(),
    invalidRows: jsonb('invalid_rows').$type<any[]>().notNull(),
    committed: boolean('committed').notNull().default(false),
    createdAt: text('created_at').notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  (table) => [index('import_batches_teacher_idx').on(table.teacherId)],
);

// 23. App Configs, Shared Rate Limits, Migration History
export const appConfigs = pgTable('app_configs', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  timestamps: jsonb('timestamps').$type<number[]>().notNull().default([]),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  description: text('description').notNull(),
  checksum: text('checksum').notNull(),
  appliedAt: text('applied_at').notNull(),
});

// 24. WebAuthn Passkey Credentials & Single-Use Challenges (Parent Accounts Only)
export const webauthnCredentials = pgTable(
  'webauthn_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: jsonb('transports').$type<string[]>().notNull().default([]),
    deviceType: text('device_type').$type<'singleDevice' | 'multiDevice'>().notNull(),
    backedUp: boolean('backed_up').notNull().default(false),
    aaguid: text('aaguid').notNull().default(''),
    label: text('label').notNull(),
    createdAt: text('created_at').notNull(),
    lastUsedAt: text('last_used_at'),
    revokedAt: text('revoked_at'),
  },
  (table) => [index('webauthn_credentials_user_id_idx').on(table.userId)],
);

export const webauthnChallenges = pgTable(
  'webauthn_challenges',
  {
    id: text('id').primaryKey(),
    challenge: text('challenge').notNull().unique(),
    purpose: text('purpose').$type<'registration' | 'authentication'>().notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    expectedOrigin: text('expected_origin').notNull(),
    expectedRpId: text('expected_rp_id').notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    usedAt: bigint('used_at', { mode: 'number' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('webauthn_challenges_expires_at_idx').on(table.expiresAt),
    index('webauthn_challenges_user_id_idx').on(table.userId),
  ],
);

// Drizzle Relations
export const familiesRelations = relations(families, ({ many }) => ({
  users: many(users),
  children: many(children),
  guardianMemberships: many(guardianMemberships),
  trustedDevices: many(trustedDevices),
  auditEvents: many(familyAuditEvents),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  family: one(families, { fields: [users.familyId], references: [families.id] }),
  sessions: many(sessions),
  children: many(children),
  webauthnCredentials: many(webauthnCredentials),
  webauthnChallenges: many(webauthnChallenges),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  parent: one(users, { fields: [children.parentId], references: [users.id] }),
  family: one(families, { fields: [children.familyId], references: [families.id] }),
  credentials: one(childCredentials, { fields: [children.id], references: [childCredentials.childId] }),
  quranSettings: one(quranChildSettings, { fields: [children.id], references: [quranChildSettings.childId] }),
  quranSurahProgress: many(quranSurahProgress),
  quranStoryProgress: many(quranStoryProgress),
  quranMannerProgress: many(quranMannerProgress),
  quranActivityEvents: many(quranActivityEvents),
}));

// 25. Quran World — Per-Child Settings, Progress, Activity & Verification Provenance (Strictly Additive)
export const quranChildSettings = pgTable(
  'quran_child_settings',
  {
    childId: text('child_id')
      .primaryKey()
      .references(() => children.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    allowedSurahIds: jsonb('allowed_surah_ids').$type<string[]>().notNull().default([]),
    surahOrder: jsonb('surah_order').$type<string[]>().notNull().default([]),
    preferredReciterId: text('preferred_reciter_id').notNull().default('adult-husary-muallim'),
    preferChildReciterFallback: boolean('prefer_child_reciter_fallback').notNull().default(true),
    repeatCount: integer('repeat_count').notNull().default(2),
    listenOnlyMode: boolean('listen_only_mode').notNull().default(false),
    dailyMaxMinutes: integer('daily_max_minutes').notNull().default(15),
    gentleReminderEnabled: boolean('gentle_reminder_enabled').notNull().default(false),
    updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check('quran_settings_repeat_range', sql`${table.repeatCount} >= 1 AND ${table.repeatCount} <= 5`),
    check('quran_settings_minutes_range', sql`${table.dailyMaxMinutes} >= 5 AND ${table.dailyMaxMinutes} <= 60`),
  ],
);

export const quranSurahProgress = pgTable(
  'quran_surah_progress',
  {
    id: text('id').primaryKey(),
    childId: text('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    surahId: text('surah_id').notNull(),
    listenCount: integer('listen_count').notNull().default(0),
    repeatSessionsCount: integer('repeat_sessions_count').notNull().default(0),
    ayahsPracticed: jsonb('ayahs_practiced').$type<number[]>().notNull().default([]),
    status: text('status').$type<QuranMemorizationStatus>().notNull().default('not_started'),
    parentConfirmedMemorization: boolean('parent_confirmed_memorization').notNull().default(false),
    parentConfirmedAt: text('parent_confirmed_at'),
    parentConfirmedByUserId: text('parent_confirmed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    parentNote: text('parent_note'),
    lastListenedAt: text('last_listened_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('quran_surah_progress_child_surah_uidx').on(table.childId, table.surahId),
    index('quran_surah_progress_child_idx').on(table.childId),
    check('quran_surah_listen_non_negative', sql`${table.listenCount} >= 0`),
    check('quran_surah_repeat_non_negative', sql`${table.repeatSessionsCount} >= 0`),
  ],
);

export const quranStoryProgress = pgTable(
  'quran_story_progress',
  {
    id: text('id').primaryKey(),
    childId: text('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    storyId: text('story_id').notNull(),
    completedCount: integer('completed_count').notNull().default(0),
    lastReadAt: text('last_read_at').notNull(),
  },
  (table) => [
    uniqueIndex('quran_story_progress_child_story_uidx').on(table.childId, table.storyId),
    index('quran_story_progress_child_idx').on(table.childId),
    check('quran_story_completed_non_negative', sql`${table.completedCount} >= 0`),
  ],
);

export const quranMannerProgress = pgTable(
  'quran_manners_progress',
  {
    id: text('id').primaryKey(),
    childId: text('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    mannerId: text('manner_id').notNull(),
    practicedCount: integer('practiced_count').notNull().default(0),
    lastPracticedAt: text('last_practiced_at').notNull(),
  },
  (table) => [
    uniqueIndex('quran_manners_progress_child_manner_uidx').on(table.childId, table.mannerId),
    index('quran_manners_progress_child_idx').on(table.childId),
    check('quran_manners_practiced_non_negative', sql`${table.practicedCount} >= 0`),
  ],
);

export const quranActivityEvents = pgTable(
  'quran_activity_events',
  {
    id: text('id').primaryKey(),
    childId: text('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    eventType: text('event_type').$type<'listen' | 'repeat' | 'story' | 'manner' | 'parent_confirm'>().notNull(),
    targetId: text('target_id').notNull(),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    ayahCount: integer('ayah_count').notNull().default(0),
    reciterId: text('reciter_id'),
    recordedByUserId: text('recorded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: text('occurred_at').notNull(),
  },
  (table) => [
    index('quran_activity_events_child_idx').on(table.childId),
    index('quran_activity_events_occurred_idx').on(table.occurredAt),
    check('quran_event_duration_non_negative', sql`${table.durationSeconds} >= 0`),
    check('quran_event_ayahs_non_negative', sql`${table.ayahCount} >= 0`),
  ],
);

export const quranContentVerifications = pgTable('quran_content_verifications', {
  id: text('id').primaryKey(),
  contentType: text('content_type').$type<'surah_text' | 'reciter_audio'>().notNull(),
  contentKey: text('content_key').notNull().unique(),
  sourceName: text('source_name').notNull(),
  licenseOrPermission: text('license_or_permission').notNull(),
  tajweedReviewedBy: text('tajweed_reviewed_by'),
  tajweedReviewedAt: text('tajweed_reviewed_at'),
  verificationStatus: text('verification_status').$type<QuranVerificationStatus>().notNull(),
  audioUrlsJson: jsonb('audio_urls_json').$type<Record<string, string> | null>(),
  notes: text('notes'),
  updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: text('updated_at').notNull(),
});


