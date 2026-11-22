import type express from 'express';
import type {
  AdaptiveDifficultyTier,
  AgeGroupId,
  AiUsageRecord,
  AssignedExamAttempt,
  Certificate,
  ChildProfile,
  Classroom,
  CmsLessonRecord,
  ContentPermissionPolicy,
  DataGovernanceRequest,
  ExamAssignment,
  ExamAttemptSummary,
  ExamConfig,
  ExamQuestionItem,
  ExamSubject,
  FamilyAccount,
  FamilyAuditEvent,
  FamilyPrivacySettings,
  FeatureFlags,
  GardenRewardEvent,
  GuardianInvitation,
  GuardianMembership,
  HomeworkAssignment,
  HomeworkAttachment,
  HomeworkStudentSubmission,
  Level1LessonProgress,
  Level2LessonProgress,
  Level2ProgressionConfig,
  PrivacyConsentRecord,
  QuranActivityEvent,
  QuranChildSettings,
  QuranContentVerificationRecord,
  QuranMannerProgress,
  QuranStoryAdminOverride,
  QuranStoryProgress,
  QuranStoryProgressDetails,
  QuranSurahProgress,
  SecurityEventLog,
  SkillId,
  SmartAssessmentFormat,
  StoredAgeGroupId,
  TeacherExam,
  TeacherQuestion,
  TrustedDeviceRecord,
} from '../src/types/nonoland';
import type { StoredActionToken, StoredSessionRecord, StoredUserRecord } from './security';

export interface StoredChildCredential {
  childId: string;
  familyId: string;
  accessCodeHash: string;
  accessCodeEncrypted: string;
  accessCodeLast4: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
  rotatedAt?: string;
  lastLoginAt?: string;
}

export interface StoredParentGateCredential {
  userId: string;
  familyId: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredTrustedDevice extends TrustedDeviceRecord {
  tokenHash: string;
  userAgent: string;
  ip: string;
}

export interface StoredGuardianInvitation extends GuardianInvitation {
  tokenHash: string;
}

export interface ArchivedChildRecord {
  childId: string;
  familyId: string;
  parentId: string;
  displayName: string;
  deletedByUserId: string;
  deletedAt: string;
  reason?: string;
}

export interface StoredSmartAssessmentSession {
  id: string;
  childId: string;
  parentId?: string;
  ageGroup: StoredAgeGroupId;
  difficultyTier: AdaptiveDifficultyTier;
  totalQuestions: number;
  askedQuestionIds: string[];
  results: Array<{
    questionId: string;
    format: SmartAssessmentFormat;
    skillId: SkillId;
    correct: boolean;
    responseTimeMs: number;
    difficulty: AdaptiveDifficultyTier;
  }>;
  streak: number;
  consecutiveMistakes: number;
  hintsUsed: number;
  finished: boolean;
  createdAt: string;
}

export interface CheckoutSession {
  id: string;
  childId: string;
  parentId?: string;
  subject: ExamSubject;
  amountEgp: number;
  status: 'pending' | 'verified';
  paymentToken?: string;
  tokenConsumed?: boolean;
  createdAt: string;
  verifiedAt?: string;
}

export interface StoredExamAttempt {
  id: string;
  childId: string;
  parentId?: string;
  childName: string;
  ageGroup: StoredAgeGroupId;
  subject: ExamSubject;
  mode: 'practice' | 'official';
  questionIds: string[];
  paymentVerified: boolean;
  amountPaidEgp: number;
  passingPercentage: number;
  submitted: boolean;
  summary?: ExamAttemptSummary;
  certificateCode?: string;
  createdAt: string;
}

export interface StoredLevel1Attempt {
  id: string;
  childId: string;
  parentId?: string;
  lessonId: string;
  questionIds: string[];
  submitted: boolean;
  result?: {
    score: number;
    totalQuestions: number;
    percentage: number;
    demonstrated: boolean;
    status: Level1LessonProgress['status'];
    revisionDueAt: string;
  };
  createdAt: string;
}

export interface StoredLevel2Attempt {
  id: string;
  childId: string;
  parentId?: string;
  lessonId: string;
  questionIds: string[];
  submitted: boolean;
  result?: {
    score: number;
    totalQuestions: number;
    percentage: number;
    demonstrated: boolean;
    status: Level2LessonProgress['status'];
    revisionDueAt: string;
    reviewIntervalStep: number;
  };
  createdAt: string;
}

export interface ImportBatchRecord {
  id: string;
  teacherId: string;
  fileName: string;
  format: 'csv' | 'xlsx';
  storedUploadPath: string;
  validRows: Array<{
    rowNumber: number;
    question: Omit<TeacherQuestion, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'version'>;
  }>;
  invalidRows: Array<{ rowNumber: number; errors: string[] }>;
  committed: boolean;
  createdAt: string;
  expiresAt: number;
}

export interface StoredHomeworkAttachment extends HomeworkAttachment {
  storedPath: string;
}

export interface OperationalMetrics {
  totalApiRequests: number;
  apiFailures5xx: number;
  apiClientErrors4xx: number;
  syncFailures: number;
  lastErrors: Array<{ route: string; status: number; message: string; timestamp: string }>;
}

export interface AdminBootstrapState {
  initialized: boolean;
  initializedAt?: string;
  initializedByUserId?: string;
  secretConsumed?: boolean;
}

export type StoredChildRecord = ChildProfile & { parentId: string; familyId?: string };

export interface ServerDb {
  examConfig: ExamConfig;
  featureFlags: FeatureFlags;
  adminBootstrap?: AdminBootstrapState;
  users: Record<string, StoredUserRecord>;
  emailIndex: Record<string, string>;
  sessions: Record<string, StoredSessionRecord>;
  actionTokens: Record<string, StoredActionToken>;
  children: Record<string, StoredChildRecord>;
  families?: Record<string, FamilyAccount>;
  guardianMemberships?: Record<string, GuardianMembership>;
  guardianInvitations?: Record<string, StoredGuardianInvitation>;
  trustedDevices?: Record<string, StoredTrustedDevice>;
  parentGateCredentials?: Record<string, StoredParentGateCredential>;
  childCredentials?: Record<string, StoredChildCredential>;
  childAccessCodeIndex?: Record<string, string>;
  archivedChildren?: Record<string, ArchivedChildRecord>;
  familyAuditEvents?: FamilyAuditEvent[];
  contentPolicies?: Record<string, ContentPermissionPolicy>;
  privacySettings?: Record<string, FamilyPrivacySettings>;
  privacyConsents?: Record<string, PrivacyConsentRecord[]>;
  dataRequests?: Record<string, DataGovernanceRequest[]>;
  aiUsageRecords?: Record<string, AiUsageRecord[]>;
  gardenRewardEvents?: Record<string, GardenRewardEvent[]>;
  customLessons: CmsLessonRecord[];
  customQuestions: ExamQuestionItem[];
  checkoutSessions: Record<string, CheckoutSession>;
  examAttempts: Record<string, StoredExamAttempt>;
  level1Attempts: Record<string, StoredLevel1Attempt>;
  level2Attempts: Record<string, StoredLevel2Attempt>;
  level2ProgressionConfig: Level2ProgressionConfig;
  classes: Record<string, Classroom>;
  teacherQuestions: Record<string, TeacherQuestion>;
  teacherExams: Record<string, TeacherExam>;
  examAssignments: Record<string, ExamAssignment>;
  assignedExamAttempts: Record<string, AssignedExamAttempt>;
  homeworks: Record<string, HomeworkAssignment>;
  homeworkSubmissions: Record<string, HomeworkStudentSubmission>;
  homeworkAttachments: Record<string, StoredHomeworkAttachment>;
  importBatches: Record<string, ImportBatchRecord>;
  certificates: Record<string, Certificate & { revoked?: boolean }>;
  processedSyncKeys: Record<string, { childId: string; processedAt: string; summary: string }>;
  smartAssessmentSessions?: Record<string, StoredSmartAssessmentSession>;
  aiUsageDaily?: Record<string, number>;
  quranChildSettings?: Record<string, QuranChildSettings>;
  quranSurahProgress?: Record<string, QuranSurahProgress>;
  quranStoryProgress?: Record<string, QuranStoryProgress>;
  quranStoryDetails?: Record<string, QuranStoryProgressDetails>;
  quranStoryCms?: Record<string, QuranStoryAdminOverride>;
  quranMannerProgress?: Record<string, QuranMannerProgress>;
  quranActivityEvents?: QuranActivityEvent[];
  quranContentVerifications?: Record<string, QuranContentVerificationRecord>;
  operationalMetrics: OperationalMetrics;
  securityLogs: SecurityEventLog[];
}

export interface AuthenticatedRequest extends express.Request {
  authSession?: {
    user: StoredUserRecord;
    session: StoredSessionRecord;
  };
}
