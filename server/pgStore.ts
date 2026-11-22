import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq, inArray, like, notLike, sql } from 'drizzle-orm';
import { db as pgDb, getPgConnectionDiagnostics, type PgConfigSource, pool } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';
import { DEFAULT_FEATURE_FLAGS } from '../src/utils/validation.ts';
import { migrateChildProfileSafely } from '../src/utils/ageAdaptation.ts';
import type {
  ArchivedChildRecord,
  CheckoutSession,
  ImportBatchRecord,
  OperationalMetrics,
  ServerDb,
  StoredChildCredential,
  StoredChildRecord,
  StoredExamAttempt,
  StoredGuardianInvitation,
  StoredHomeworkAttachment,
  StoredLevel1Attempt,
  StoredLevel2Attempt,
  StoredParentGateCredential,
  StoredSmartAssessmentSession,
  StoredTrustedDevice,
} from './dbTypes.ts';
import type { StoredActionToken, StoredSessionRecord, StoredUserRecord } from './security.ts';
import { ensureFamilyCollections } from './familyHelpers.ts';
import type {
  AiUsageRecord,
  AssignedExamAttempt,
  Certificate,
  Classroom,
  CmsLessonRecord,
  ContentPermissionPolicy,
  DataGovernanceRequest,
  ExamAssignment,
  ExamConfig,
  ExamQuestionItem,
  FamilyAccount,
  FamilyAuditEvent,
  FamilyPrivacySettings,
  FeatureFlags,
  GardenRewardEvent,
  GuardianMembership,
  HomeworkAssignment,
  HomeworkStudentSubmission,
  Level2ProgressionConfig,
  PrivacyConsentRecord,
  QuranAdminConfirmations,
  QuranAudioProbeDiagnostics,
  QuranSourceVerificationRecord,
  QuranSurahHumanReviewEntry,
  SecurityEventLog,
  TeacherExam,
  TeacherQuestion,
} from '../src/types/nonoland.ts';

type PgRunner = Pick<typeof pgDb, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

export interface PgRequestContext {
  db: ServerDb;
  serializedCache: Map<string, Map<string, string>>;
  configHashes: Map<string, string>;
  pendingCommit: Promise<void> | null;
  inTransaction?: boolean;
  quranSchemaReady?: boolean;
}

export function isQuranSchemaReady(): boolean {
  const ctx = pgRequestAls.getStore();
  if (!ctx) return true;
  return ctx.quranSchemaReady !== false;
}

async function checkQuranTablesReady(runner: PgRunner): Promise<boolean> {
  const res = await runner.execute(sql`
    SELECT
      to_regclass('public.quran_child_settings') IS NOT NULL AS s1,
      to_regclass('public.quran_surah_progress') IS NOT NULL AS s2,
      to_regclass('public.quran_story_progress') IS NOT NULL AS s3,
      to_regclass('public.quran_manners_progress') IS NOT NULL AS s4,
      to_regclass('public.quran_activity_events') IS NOT NULL AS s5,
      to_regclass('public.quran_content_verifications') IS NOT NULL AS s6
  `);
  const row = (res as unknown as { rows?: Array<Record<string, unknown>> })?.rows?.[0];
  return Boolean(row?.s1 && row?.s2 && row?.s3 && row?.s4 && row?.s5 && row?.s6);
}

const pgRequestAls = new AsyncLocalStorage<PgRequestContext>();

export function getDefaultServerDb(): ServerDb {
  return {
    examConfig: {
      examPriceEgp: 50,
      currency: 'EGP',
      passingPercentage: 70,
      questionsPerExam: 40,
      paymentGatewayMode:
        process.env.STRIPE_SECRET_KEY || process.env.PAYMOB_API_KEY
          ? 'live-gateway'
          : 'development-test-verification',
    },
    featureFlags: { ...DEFAULT_FEATURE_FLAGS },
    adminBootstrap: { initialized: false, secretConsumed: false },
    users: {},
    emailIndex: {},
    sessions: {},
    actionTokens: {},
    children: {},
    families: {},
    guardianMemberships: {},
    guardianInvitations: {},
    trustedDevices: {},
    parentGateCredentials: {},
    childCredentials: {},
    childAccessCodeIndex: {},
    archivedChildren: {},
    familyAuditEvents: [],
    contentPolicies: {},
    privacySettings: {},
    privacyConsents: {},
    dataRequests: {},
    aiUsageRecords: {},
    gardenRewardEvents: {},
    customLessons: [],
    customQuestions: [],
    checkoutSessions: {},
    examAttempts: {},
    level1Attempts: {},
    level2Attempts: {},
    level2ProgressionConfig: {
      allowOpenExploration: true,
      minLevel1DemonstratedForBadge: 10,
      requirePlacementOrMasteryForOfficialExam: false,
    },
    classes: {},
    teacherQuestions: {},
    teacherExams: {},
    examAssignments: {},
    assignedExamAttempts: {},
    homeworks: {},
    homeworkSubmissions: {},
    homeworkAttachments: {},
    importBatches: {},
    certificates: {},
    processedSyncKeys: {},
    smartAssessmentSessions: {},
    aiUsageDaily: {},
    quranChildSettings: {},
    quranSurahProgress: {},
    quranStoryProgress: {},
    quranStoryDetails: {},
    quranStoryCms: {},
    quranMannerProgress: {},
    quranActivityEvents: [],
    quranContentVerifications: {},
    operationalMetrics: {
      totalApiRequests: 0,
      apiFailures5xx: 0,
      apiClientErrors4xx: 0,
      syncFailures: 0,
      lastErrors: [],
    },
    securityLogs: [],
  };
}

let inMemoryDb: ServerDb | null = null;
let devSeedLoaded = false;
const devSeedIds = {
  users: new Set<string>(),
  families: new Set<string>(),
  children: new Set<string>(),
  classes: new Set<string>(),
  teacherExams: new Set<string>(),
  securityLogs: new Set<string>(),
};
const inMemoryRateLimits = new Map<string, number[]>();
let inMemoryLockChain: Promise<unknown> = Promise.resolve();

export function isPgConfigured(): boolean {
  return getPgConnectionDiagnostics().configured;
}

function assertPgConfiguredOrThrow(): void {
  const diag = getPgConnectionDiagnostics();
  if (!diag.configured) {
    const missing =
      diag.missingEnvVars.length > 0
        ? diag.missingEnvVars.join(', ')
        : 'SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD';
    throw new Error(`PostgreSQL is required in this mode, but missing required secret(s): ${missing}`);
  }
}

export function shouldUsePgOrFailClosed(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (process.env.REQUIRE_POSTGRES === 'true') return true;
  if (
    process.env.SQL_HOST?.trim() ||
    process.env.SQL_DB_NAME?.trim() ||
    process.env.SQL_USER?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.NONOLAND_DB_HOST?.trim() ||
    process.env.NONOLAND_DB_NAME?.trim() ||
    process.env.NONOLAND_DB_USER?.trim()
  ) {
    return true;
  }
  return false;
}

function allowDevInMemoryFallback(): boolean {
  return !shouldUsePgOrFailClosed();
}

export function isUsingInMemoryDevFallback(): boolean {
  return allowDevInMemoryFallback();
}

export function getDbStorageInfo() {
  const usingPg = shouldUsePgOrFailClosed();
  return {
    storageBackend: usingPg ? ('postgresql' as const) : ('in-memory-dev' as const),
    devSeedEnabled: !usingPg && devSeedLoaded,
    isDevSeedRecord: (
      collection: 'users' | 'families' | 'children' | 'classes' | 'teacherExams' | 'securityLogs',
      id: string,
    ): boolean => {
      if (usingPg || !devSeedLoaded) return false;
      return devSeedIds[collection].has(id);
    },
  };
}

function getInMemoryDb(): ServerDb {
  if (!allowDevInMemoryFallback()) {
    throw new Error('In-memory JSON fallback is strictly disabled in production and PostgreSQL-required modes.');
  }
  if (inMemoryDb) {
    return inMemoryDb;
  }

  let loaded: ServerDb | null = null;
  devSeedLoaded = false;
  devSeedIds.users.clear();
  devSeedIds.families.clear();
  devSeedIds.children.clear();
  devSeedIds.classes.clear();
  devSeedIds.teacherExams.clear();
  devSeedIds.securityLogs.clear();

  const seedPath = path.resolve(process.cwd(), 'data', 'nonoland-server-db.json');
  const skipDevSeed = process.env.DISABLE_DEV_SEED === 'true';
  try {
    if (!skipDevSeed && fs.existsSync(seedPath)) {
      const raw = fs.readFileSync(seedPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ServerDb>;
      const defaults = getDefaultServerDb();
      loaded = {
        ...defaults,
        ...parsed,
        examConfig: { ...defaults.examConfig, ...(parsed.examConfig || {}) },
        featureFlags: { ...defaults.featureFlags, ...(parsed.featureFlags || {}) },
        level2ProgressionConfig: {
          ...defaults.level2ProgressionConfig,
          ...(parsed.level2ProgressionConfig || {}),
        },
        operationalMetrics: {
          ...defaults.operationalMetrics,
          ...(parsed.operationalMetrics || {}),
          lastErrors: parsed.operationalMetrics?.lastErrors || [],
        },
      };
      devSeedLoaded = true;
      for (const id of Object.keys(parsed.users || {})) devSeedIds.users.add(id);
      for (const id of Object.keys(parsed.families || {})) devSeedIds.families.add(id);
      for (const id of Object.keys(parsed.children || {})) devSeedIds.children.add(id);
      for (const id of Object.keys(parsed.classes || {})) devSeedIds.classes.add(id);
      for (const id of Object.keys(parsed.teacherExams || {})) devSeedIds.teacherExams.add(id);
      for (const log of parsed.securityLogs || []) {
        if (log?.id) devSeedIds.securityLogs.add(log.id);
      }
      console.log(
        '[Dev Mode] PostgreSQL not configured — using explicit dev in-memory store with read-only seed baseline from data/nonoland-server-db.json (seed records separated from real stats).',
      );
    }
  } catch (err) {
    console.warn('[Dev Mode] Could not load data/nonoland-server-db.json — starting with empty dev in-memory DB:', err);
  }

  if (!loaded) {
    loaded = getDefaultServerDb();
    console.log('[Dev Mode] PostgreSQL not configured — using fresh dev in-memory store');
  }

  ensureFamilyCollections(loaded);
  for (const [childId, child] of Object.entries(loaded.children || {})) {
    loaded.children[childId] = migrateChildProfileSafely(child) as StoredChildRecord;
  }

  inMemoryDb = loaded;
  return inMemoryDb;
}

export type PgErrorClassification =
  | 'none'
  | 'missing_env_vars'
  | 'auth_failed'
  | 'schema_not_initialized'
  | 'tls_error'
  | 'connection_failed';

export interface QuranMigrationReport {
  classification: 'A' | 'B' | 'C' | 'D' | 'in_memory' | 'unavailable';
  action: 'applied_0002' | 'already_applied' | 'skipped_partial' | 'skipped_unsafe' | 'skipped_core_missing' | 'not_applicable';
  tablesPresentCount: number;
  indexesPresentCount: number;
  constraintsPresentCount: number;
  migration0002RecordedCount: number;
  pendingMigrationsCount: number;
  coreTablesIntact: boolean;
  recordedHistoryBefore: Array<{ id: number; createdAt: string }>;
  error?: string;
}

export interface PgHealthDetails {
  healthy: boolean;
  database: 'postgresql' | 'in-memory-dev' | 'unavailable';
  databaseName: string | null;
  configSource: PgConfigSource;
  configComplete: boolean;
  reason?: 'missing_env_vars' | 'auth_failed' | 'connection_failed' | 'schema_not_initialized' | 'tls_error';
  missingEnvVars?: string[];
  sslEnabled: boolean;
  isNeonHost: boolean;
  isPooledEndpoint: boolean;
  schemaReady: boolean;
  quranSchemaReady?: boolean;
  quranMigration?: QuranMigrationReport;
  errorCode?: string;
  userEqualsDbName?: boolean;
}

const EXPECTED_QURAN_TABLES = [
  'quran_child_settings',
  'quran_surah_progress',
  'quran_story_progress',
  'quran_manners_progress',
  'quran_activity_events',
  'quran_content_verifications',
] as const;

const EXPECTED_QURAN_INDEXES = [
  'quran_surah_progress_child_surah_uidx',
  'quran_surah_progress_child_idx',
  'quran_story_progress_child_story_uidx',
  'quran_story_progress_child_idx',
  'quran_manners_progress_child_manner_uidx',
  'quran_manners_progress_child_idx',
  'quran_activity_events_child_idx',
  'quran_activity_events_occurred_idx',
] as const;

const EXPECTED_QURAN_CONSTRAINTS = [
  'quran_child_settings_child_id_children_id_fk',
  'quran_child_settings_updated_by_user_id_users_id_fk',
  'quran_settings_repeat_range',
  'quran_settings_minutes_range',
  'quran_surah_progress_child_id_children_id_fk',
  'quran_surah_progress_parent_confirmed_by_user_id_users_id_fk',
  'quran_surah_listen_non_negative',
  'quran_surah_repeat_non_negative',
  'quran_story_progress_child_id_children_id_fk',
  'quran_story_completed_non_negative',
  'quran_manners_progress_child_id_children_id_fk',
  'quran_manners_practiced_non_negative',
  'quran_activity_events_child_id_children_id_fk',
  'quran_activity_events_recorded_by_user_id_users_id_fk',
  'quran_event_duration_non_negative',
  'quran_event_ayahs_non_negative',
  'quran_content_verifications_content_key_unique',
  'quran_content_verifications_updated_by_user_id_users_id_fk',
] as const;

let cachedQuranMigrationReport: QuranMigrationReport | null = null;

export function getLastQuranMigrationReport(): QuranMigrationReport | null {
  return cachedQuranMigrationReport;
}

function parseSafeAdditiveMigration0002(): {
  ok: boolean;
  statements: string[];
  hash: string;
  folderMillis: number;
  reason?: string;
} {
  const journalPath = path.resolve(process.cwd(), 'drizzle', 'meta', '_journal.json');
  const sqlPath = path.resolve(process.cwd(), 'drizzle', '0002_quran_world.sql');
  if (!fs.existsSync(journalPath) || !fs.existsSync(sqlPath)) {
    return { ok: false, statements: [], hash: '', folderMillis: 0, reason: 'Missing migration 0002 or journal file' };
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
    entries?: Array<{ tag: string; when: number }>;
  };
  const entry = (journal.entries || []).find((e) => e.tag === '0002_quran_world');
  if (!entry || !Number.isFinite(entry.when)) {
    return { ok: false, statements: [], hash: '', folderMillis: 0, reason: 'Journal entry 0002_quran_world missing' };
  }
  const rawSql = fs.readFileSync(sqlPath, 'utf-8');
  const hash = crypto.createHash('sha256').update(rawSql).digest('hex');
  const rawChunks = rawSql.split('--> statement-breakpoint');
  const statements: string[] = [];
  for (const chunk of rawChunks) {
    const cleaned = chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
    if (!cleaned) continue;
    const allowedPrefix =
      /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"quran_/i.test(cleaned) ||
      /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+"quran_/i.test(cleaned);
    const bodyWithoutReferentialClauses = cleaned
      .replace(/ON\s+DELETE\s+(?:cascade|set\s+null|no\s+action)/gi, '')
      .replace(/ON\s+UPDATE\s+no\s+action/gi, '')
      .replace(/;\s*$/, '');
    if (
      !allowedPrefix ||
      bodyWithoutReferentialClauses.includes(';') ||
      /\b(DROP|TRUNCATE|DELETE|UPDATE|ALTER)\b/i.test(bodyWithoutReferentialClauses)
    ) {
      return {
        ok: false,
        statements: [],
        hash,
        folderMillis: entry.when,
        reason: `Disallowed or potentially destructive SQL in 0002_quran_world.sql: ${cleaned.slice(0, 80)}`,
      };
    }
    statements.push(cleaned);
  }
  if (statements.length !== 14) {
    return {
      ok: false,
      statements: [],
      hash,
      folderMillis: entry.when,
      reason: `Expected 14 additive DDL statements in 0002_quran_world.sql, found ${statements.length}`,
    };
  }
  return { ok: true, statements, hash, folderMillis: entry.when };
}

export async function inspectAndApplyQuranMigration0002Pg(): Promise<QuranMigrationReport> {
  if (allowDevInMemoryFallback()) {
    const rep: QuranMigrationReport = {
      classification: 'in_memory',
      action: 'not_applicable',
      tablesPresentCount: 6,
      indexesPresentCount: 8,
      constraintsPresentCount: 18,
      migration0002RecordedCount: 1,
      pendingMigrationsCount: 0,
      coreTablesIntact: true,
      recordedHistoryBefore: [],
    };
    cachedQuranMigrationReport = rep;
    return rep;
  }

  const parsedSql = parseSafeAdditiveMigration0002();
  if (!parsedSql.ok) {
    const rep: QuranMigrationReport = {
      classification: 'D',
      action: 'skipped_unsafe',
      tablesPresentCount: 0,
      indexesPresentCount: 0,
      constraintsPresentCount: 0,
      migration0002RecordedCount: 0,
      pendingMigrationsCount: 1,
      coreTablesIntact: false,
      recordedHistoryBefore: [],
      error: parsedSql.reason,
    };
    cachedQuranMigrationReport = rep;
    return rep;
  }

  const journalPath = path.resolve(process.cwd(), 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
    entries?: Array<{ tag: string; when: number }>;
  };
  const allEntries = journal.entries || [];

  try {
    const result = await pgDb.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(90210002)`);

      const coreRes = await tx.execute(sql`
        SELECT
          to_regclass('public.users') IS NOT NULL AS has_users,
          to_regclass('public.children') IS NOT NULL AS has_children,
          to_regclass('public.sessions') IS NOT NULL AS has_sessions,
          to_regclass('public.families') IS NOT NULL AS has_families,
          to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_mig_table
      `);
      const coreRow = (coreRes as unknown as { rows?: Array<Record<string, unknown>> })?.rows?.[0] || {};
      const coreTablesIntact = Boolean(
        coreRow.has_users && coreRow.has_children && coreRow.has_sessions && coreRow.has_families,
      );
      if (!coreRow.has_users || !coreRow.has_children) {
        return {
          classification: 'C' as const,
          action: 'skipped_core_missing' as const,
          tablesPresentCount: 0,
          indexesPresentCount: 0,
          constraintsPresentCount: 0,
          migration0002RecordedCount: 0,
          pendingMigrationsCount: 1,
          coreTablesIntact: false,
          recordedHistoryBefore: [],
          error: 'Core tables public.users or public.children do not exist.',
        };
      }

      const tblRes = await tx.execute(sql`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'quran\_%'
      `);
      const existingTables = new Set(
        ((tblRes as unknown as { rows?: Array<{ tablename: string }> })?.rows || []).map((r) => r.tablename),
      );
      const quranTablesBefore = EXPECTED_QURAN_TABLES.filter((t) => existingTables.has(t)).length;

      const idxRes = await tx.execute(sql`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE 'quran\_%'
      `);
      const existingIndexes = new Set(
        ((idxRes as unknown as { rows?: Array<{ indexname: string }> })?.rows || []).map((r) => r.indexname),
      );
      const quranIndexesBefore = EXPECTED_QURAN_INDEXES.filter((i) => existingIndexes.has(i)).length;

      let recordedHistoryBefore: Array<{ id: number; createdAt: string }> = [];
      let recorded0002Before = 0;
      if (coreRow.has_mig_table) {
        const migRes = await tx.execute(
          sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC`,
        );
        const rows = (migRes as unknown as { rows?: Array<{ id: number; hash: string; created_at: string | number }> })?.rows || [];
        recordedHistoryBefore = rows.map((r) => ({ id: Number(r.id), createdAt: String(r.created_at) }));
        recorded0002Before = rows.filter(
          (r) => r.hash === parsedSql.hash || Number(r.created_at) === parsedSql.folderMillis,
        ).length;
      }

      if (
        quranTablesBefore === EXPECTED_QURAN_TABLES.length &&
        quranIndexesBefore === EXPECTED_QURAN_INDEXES.length
      ) {
        const cRes = await tx.execute(sql`
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND table_name LIKE 'quran\_%'
        `);
        const existingConstraints = new Set(
          ((cRes as unknown as { rows?: Array<{ constraint_name: string }> })?.rows || []).map((r) => r.constraint_name),
        );
        const constraintsPresentCount = EXPECTED_QURAN_CONSTRAINTS.filter((c) => existingConstraints.has(c)).length;
        const maxCreatedAt = recordedHistoryBefore.reduce(
          (m, r) => Math.max(m, Number(r.createdAt) || 0),
          0,
        );
        return {
          classification: 'B' as const,
          action: 'already_applied' as const,
          tablesPresentCount: quranTablesBefore,
          indexesPresentCount: quranIndexesBefore,
          constraintsPresentCount,
          migration0002RecordedCount: recorded0002Before,
          pendingMigrationsCount: allEntries.filter((e) => e.when > maxCreatedAt).length,
          coreTablesIntact,
          recordedHistoryBefore,
        };
      }

      if (quranTablesBefore > 0 || quranIndexesBefore > 0 || recorded0002Before > 0) {
        return {
          classification: 'C' as const,
          action: 'skipped_partial' as const,
          tablesPresentCount: quranTablesBefore,
          indexesPresentCount: quranIndexesBefore,
          constraintsPresentCount: 0,
          migration0002RecordedCount: recorded0002Before,
          pendingMigrationsCount: 1,
          coreTablesIntact,
          recordedHistoryBefore,
          error: `Partial Quran schema detected before migration (tables=${quranTablesBefore}/6, indexes=${quranIndexesBefore}/8, recorded0002=${recorded0002Before}).`,
        };
      }

      // Classification A confirmed: execute ONLY additive migration 0002 inside this transaction
      await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      for (const stmt of parsedSql.statements) {
        await tx.execute(sql.raw(stmt));
      }

      await tx.execute(
        sql`INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES (${parsedSql.hash}, ${parsedSql.folderMillis})`,
      );

      // Post-migration verification inside same transaction (and re-verified on pgDb below)
      const afterTblRes = await tx.execute(sql`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'quran\_%'
      `);
      const afterTables = new Set(
        ((afterTblRes as unknown as { rows?: Array<{ tablename: string }> })?.rows || []).map((r) => r.tablename),
      );
      const tablesPresentCount = EXPECTED_QURAN_TABLES.filter((t) => afterTables.has(t)).length;

      const afterIdxRes = await tx.execute(sql`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE 'quran\_%'
      `);
      const afterIndexes = new Set(
        ((afterIdxRes as unknown as { rows?: Array<{ indexname: string }> })?.rows || []).map((r) => r.indexname),
      );
      const indexesPresentCount = EXPECTED_QURAN_INDEXES.filter((i) => afterIndexes.has(i)).length;

      const afterConstRes = await tx.execute(sql`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name LIKE 'quran\_%'
      `);
      const afterConstraints = new Set(
        ((afterConstRes as unknown as { rows?: Array<{ constraint_name: string }> })?.rows || []).map(
          (r) => r.constraint_name,
        ),
      );
      const constraintsPresentCount = EXPECTED_QURAN_CONSTRAINTS.filter((c) => afterConstraints.has(c)).length;

      const afterMigRes = await tx.execute(
        sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC`,
      );
      const afterMigRows =
        (afterMigRes as unknown as { rows?: Array<{ id: number; hash: string; created_at: string | number }> })?.rows || [];
      const migration0002RecordedCount = afterMigRows.filter(
        (r) => r.hash === parsedSql.hash || Number(r.created_at) === parsedSql.folderMillis,
      ).length;
      const maxCreatedAt = afterMigRows.reduce(
        (m, r) => Math.max(m, Number(r.created_at) || 0),
        0,
      );

      return {
        classification: 'A' as const,
        action: 'applied_0002' as const,
        tablesPresentCount,
        indexesPresentCount,
        constraintsPresentCount,
        migration0002RecordedCount,
        pendingMigrationsCount: allEntries.filter((e) => e.when > maxCreatedAt).length,
        coreTablesIntact,
        recordedHistoryBefore,
      };
    });

    cachedQuranMigrationReport = result;
    return result;
  } catch (err) {
    const safeMsg = scrubSafePgMessage((err as Error)?.message || String(err));
    console.error('[QuranMigration0002] Inspection/execution failed cleanly (rolled back):', safeMsg);
    const rep: QuranMigrationReport = {
      classification: 'C',
      action: 'skipped_unsafe',
      tablesPresentCount: 0,
      indexesPresentCount: 0,
      constraintsPresentCount: 0,
      migration0002RecordedCount: 0,
      pendingMigrationsCount: 1,
      coreTablesIntact: false,
      recordedHistoryBefore: [],
      error: safeMsg,
    };
    cachedQuranMigrationReport = rep;
    return rep;
  }
}

function scrubSafePgMessage(message?: string): string {
  return String(message || 'Unknown PostgreSQL error').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[REDACTED]');
}

function classifyPgError(err: unknown): {
  code: string;
  reason: 'auth_failed' | 'tls_error' | 'connection_failed' | 'schema_not_initialized';
} {
  const safeErr = err as { code?: string; cause?: { code?: string }; message?: string };
  const code = safeErr?.code || safeErr?.cause?.code || 'CONN_ERROR';
  const msg = String(safeErr?.message || '');
  if (code === '28P01' || code === '28000') {
    return { code, reason: 'auth_failed' };
  }
  if (code === '42P01') {
    return { code, reason: 'schema_not_initialized' };
  }
  if (
    /SELF_SIGNED_CERT|DEPTH_ZERO_SELF_SIGNED_CERT|ERR_TLS|UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(code) ||
    /SSL|TLS|certificate/i.test(msg)
  ) {
    return { code, reason: 'tls_error' };
  }
  return { code, reason: 'connection_failed' };
}

export async function checkPgHealthDetailed(): Promise<PgHealthDetails> {
  if (allowDevInMemoryFallback()) {
    getInMemoryDb();
    return {
      healthy: true,
      database: 'in-memory-dev',
      databaseName: null,
      configSource: 'none',
      configComplete: false,
      sslEnabled: false,
      isNeonHost: false,
      isPooledEndpoint: false,
      schemaReady: true,
      quranSchemaReady: true,
    };
  }

  const diag = getPgConnectionDiagnostics();
  const effectiveDbName = diag.databaseName || (process.env.NONOLAND_DB_NAME || process.env.SQL_DB_NAME || '').trim() || 'neondb';
  const effectiveUser = (process.env.NONOLAND_DB_USER || process.env.SQL_USER || '').trim();
  const sameUserAndDb = Boolean(effectiveUser) && effectiveUser === effectiveDbName;

  if (!diag.configured) {
    return {
      healthy: false,
      database: 'unavailable',
      databaseName: diag.databaseName,
      configSource: diag.configSource,
      configComplete: diag.configComplete,
      reason: 'missing_env_vars',
      missingEnvVars: diag.missingEnvVars,
      sslEnabled: diag.sslEnabled,
      isNeonHost: diag.isNeonHost,
      isPooledEndpoint: diag.isPooledEndpoint,
      schemaReady: false,
      userEqualsDbName: sameUserAndDb,
    };
  }

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    const safeErr = err as { message?: string };
    const classified = classifyPgError(err);
    console.error(
      `PostgreSQL connectivity check failed [${classified.code}]:`,
      scrubSafePgMessage(safeErr?.message),
      classified.reason === 'auth_failed' && diag.isNeonHost && sameUserAndDb
        ? '(Hint: SQL_USER currently equals SQL_DB_NAME; on Neon, the default role is usually "neondb_owner" while the database is "neondb".)'
        : '',
    );
    return {
      healthy: false,
      database: 'unavailable',
      databaseName: diag.databaseName,
      configSource: diag.configSource,
      configComplete: diag.configComplete,
      reason: classified.reason,
      sslEnabled: diag.sslEnabled,
      isNeonHost: diag.isNeonHost,
      isPooledEndpoint: diag.isPooledEndpoint,
      schemaReady: false,
      errorCode: classified.code,
      userEqualsDbName: sameUserAndDb,
    };
  }

  try {
    const tableCheck = await pool.query<{ users_table: string | null }>(
      "SELECT to_regclass('public.users') AS users_table",
    );
    const schemaReady = Boolean(tableCheck.rows?.[0]?.users_table);
    if (!schemaReady) {
      console.error('PostgreSQL connected, but required table public.users is missing (migrations not applied).');
      return {
        healthy: false,
        database: 'unavailable',
        databaseName: diag.databaseName,
        configSource: diag.configSource,
        configComplete: diag.configComplete,
        reason: 'schema_not_initialized',
        sslEnabled: diag.sslEnabled,
        isNeonHost: diag.isNeonHost,
        isPooledEndpoint: diag.isPooledEndpoint,
        schemaReady: false,
        quranSchemaReady: false,
        userEqualsDbName: sameUserAndDb,
      };
    }
    const quranSchemaReady = await checkQuranTablesReady(pgDb).catch(() => false);
    return {
      healthy: true,
      database: 'postgresql',
      databaseName: diag.databaseName,
      configSource: diag.configSource,
      configComplete: diag.configComplete,
      sslEnabled: diag.sslEnabled,
      isNeonHost: diag.isNeonHost,
      isPooledEndpoint: diag.isPooledEndpoint,
      schemaReady: true,
      quranSchemaReady,
      ...(cachedQuranMigrationReport ? { quranMigration: cachedQuranMigrationReport } : {}),
      userEqualsDbName: sameUserAndDb,
    };
  } catch (err) {
    const safeErr = err as { code?: string; message?: string };
    console.error(
      `PostgreSQL schema check failed [${safeErr?.code || 'SCHEMA_ERROR'}]:`,
      scrubSafePgMessage(safeErr?.message),
    );
    return {
      healthy: false,
      database: 'unavailable',
      databaseName: diag.databaseName,
      configSource: diag.configSource,
      configComplete: diag.configComplete,
      reason: 'connection_failed',
      sslEnabled: diag.sslEnabled,
      isNeonHost: diag.isNeonHost,
      isPooledEndpoint: diag.isPooledEndpoint,
      schemaReady: false,
      errorCode: safeErr?.code || 'SCHEMA_ERROR',
      userEqualsDbName: sameUserAndDb,
    };
  }
}

export async function checkPgHealth(): Promise<boolean> {
  const details = await checkPgHealthDetailed();
  return details.healthy;
}

export async function checkRateLimitPg(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  if (allowDevInMemoryFallback()) {
    const now = Date.now();
    const prev = inMemoryRateLimits.get(key) || [];
    const fresh = prev.filter((ts) => now - ts < windowMs);
    if (fresh.length >= maxRequests) {
      inMemoryRateLimits.set(key, fresh);
      return false;
    }
    fresh.push(now);
    inMemoryRateLimits.set(key, fresh);
    return true;
  }
  if (!isPgConfigured()) {
    return false;
  }
  try {
    return await pgDb.transaction(async (tx) => {
      const now = Date.now();
      const rows = await tx
        .select()
        .from(schema.rateLimits)
        .where(eq(schema.rateLimits.key, key))
        .for('update');
      const prev = Array.isArray(rows[0]?.timestamps) ? rows[0].timestamps : [];
      const fresh = prev.filter((ts) => now - ts < windowMs);
      if (fresh.length >= maxRequests) {
        await tx
          .insert(schema.rateLimits)
          .values({ key, timestamps: fresh, updatedAt: now })
          .onConflictDoUpdate({
            target: schema.rateLimits.key,
            set: { timestamps: fresh, updatedAt: now },
          });
        return false;
      }
      fresh.push(now);
      await tx
        .insert(schema.rateLimits)
        .values({ key, timestamps: fresh, updatedAt: now })
        .onConflictDoUpdate({
          target: schema.rateLimits.key,
          set: { timestamps: fresh, updatedAt: now },
        });
      return true;
    });
  } catch (err) {
    console.error('PostgreSQL rate limit check failed:', err);
    return false;
  }
}

export async function clearRateLimitPg(key: string): Promise<void> {
  if (allowDevInMemoryFallback()) {
    inMemoryRateLimits.delete(key);
    return;
  }
  if (!isPgConfigured()) {
    return;
  }
  try {
    await pgDb.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));
  } catch (err) {
    console.error('PostgreSQL clearRateLimit failed:', err);
  }
}

function stableHashValue(val: unknown): string {
  return JSON.stringify(val);
}

function rowToUser(r: typeof schema.users.$inferSelect): StoredUserRecord {
  return {
    id: r.id,
    email: r.email,
    normalizedEmail: r.normalizedEmail,
    displayName: r.displayName,
    passwordHash: r.passwordHash,
    role: r.role as StoredUserRecord['role'],
    emailVerified: r.emailVerified,
    status: r.status as StoredUserRecord['status'],
    phone: r.phone ?? undefined,
    bio: r.bio ?? undefined,
    linkedChildId: r.linkedChildId ?? undefined,
    familyId: r.familyId ?? undefined,
    teacherProfile: r.teacherProfile ?? undefined,
    policyVersion: r.policyVersion,
    termsAcceptedAt: r.termsAcceptedAt,
    failedLoginAttempts: r.failedLoginAttempts,
    lockedUntil: r.lockedUntil ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function rowToChild(r: typeof schema.children.$inferSelect): StoredChildRecord {
  const raw: StoredChildRecord = {
    id: r.id,
    parentId: r.parentId,
    familyId: r.familyId ?? undefined,
    studentUserId: r.studentUserId ?? undefined,
    displayName: r.displayName,
    birthYear: r.birthYear,
    birthMonth: r.birthMonth,
    ageMonths: r.ageMonths ?? undefined,
    ageGroup: r.ageGroup,
    language: r.language,
    interests: r.interests || [],
    companionId: r.companionId,
    companionScarfColor: r.companionScarfColor,
    stars: r.stars,
    level: r.level,
    completedBaseline: r.completedBaseline,
    favoriteWorldId: r.favoriteWorldId ?? undefined,
    recentActivityId: r.recentActivityId ?? undefined,
    unlockedWorlds: r.unlockedWorlds || [],
    completedActivityIds: r.completedActivityIds || [],
    unlockedCharacters: r.unlockedCharacters || [],
    unlockedBadges: r.unlockedBadges || [],
    unlockedRoomItems: r.unlockedRoomItems || [],
    placedRoomItems: r.placedRoomItems || [],
    savedDrawings: r.savedDrawings || [],
    certificates: r.certificates || [],
    skillProgress: r.skillProgress,
    conceptMastery: r.conceptMastery ?? undefined,
    level1Progress: r.level1Progress ?? undefined,
    level2Progress: r.level2Progress ?? undefined,
    level2Unlocked: r.level2Unlocked ?? false,
    completedDeepLessons: r.completedDeepLessons ?? undefined,
    examHistory: r.examHistory ?? undefined,
    characterOutfits: r.characterOutfits ?? undefined,
    unlockedFunRewards: r.unlockedFunRewards ?? undefined,
    attempts: r.attempts || [],
    assessmentHistory: r.assessmentHistory || [],
    completedStoryIds: r.completedStoryIds || [],
    completedMissionsToday: r.completedMissionsToday || [],
    totalLearningMinutes: r.totalLearningMinutes,
    downloadedWorldIds: r.downloadedWorldIds || [],
    avatarConfig: r.avatarConfig ?? undefined,
    roomConfig: r.roomConfig ?? undefined,
    petState: r.petState ?? undefined,
    completedLabIds: r.completedLabIds ?? undefined,
    labHistory: r.labHistory ?? undefined,
    customStories: r.customStories ?? undefined,
    creativeProjects: r.creativeProjects ?? undefined,
    ownedShopItemIds: r.ownedShopItemIds ?? undefined,
    rewardTransactions: r.rewardTransactions ?? undefined,
    claimedMissionsDate: r.claimedMissionsDate ?? undefined,
    claimedMissionIdsToday: r.claimedMissionIdsToday ?? undefined,
    learningStreakDays: r.learningStreakDays ?? 0,
    activeDaysHistory: r.activeDaysHistory ?? undefined,
    monthlySnapshots: r.monthlySnapshots ?? undefined,
    parentSchedule: r.parentSchedule ?? undefined,
    nextMonthPlan: r.nextMonthPlan ?? undefined,
    activityTimeline: r.activityTimeline ?? undefined,
    aiAssistantEnabled: r.aiAssistantEnabled ?? true,
    readingStageProgress: r.readingStageProgress ?? undefined,
    familyActivitiesCompleted: r.familyActivitiesCompleted ?? undefined,
    musicCompositions: r.musicCompositions ?? undefined,
    buildConstructions: r.buildConstructions ?? undefined,
    completedDiscoveryThemes: r.completedDiscoveryThemes ?? undefined,
    completedRecipes: r.completedRecipes ?? undefined,
    completedTheaterScenes: r.completedTheaterScenes ?? undefined,
    learningGarden: r.learningGarden ?? undefined,
  };
  return migrateChildProfileSafely(raw) as StoredChildRecord;
}

function buildContextCaches(snapshot: ServerDb): {
  serializedCache: Map<string, Map<string, string>>;
  configHashes: Map<string, string>;
} {
  const serializedCache = new Map<string, Map<string, string>>();
  const recordMap = (name: string, rec: Record<string, unknown> | undefined) => {
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries(rec || {})) {
      m.set(k, stableHashValue(v));
    }
    serializedCache.set(name, m);
  };
  const recordArrayById = (name: string, arr: Array<{ id: string }> | undefined) => {
    const m = new Map<string, string>();
    for (const item of arr || []) {
      m.set(item.id, stableHashValue(item));
    }
    serializedCache.set(name, m);
  };
  const recordGroupedById = (
    name: string,
    grouped: Record<string, Array<{ id: string }>> | undefined,
  ) => {
    const m = new Map<string, string>();
    for (const items of Object.values(grouped || {})) {
      for (const item of items) {
        m.set(item.id, stableHashValue(item));
      }
    }
    serializedCache.set(name, m);
  };

  recordMap('families', snapshot.families);
  recordMap('users', snapshot.users);
  recordMap('guardianMemberships', snapshot.guardianMemberships);
  recordMap('guardianInvitations', snapshot.guardianInvitations);
  recordMap('trustedDevices', snapshot.trustedDevices);
  recordMap('sessions', snapshot.sessions);
  recordMap('actionTokens', snapshot.actionTokens);
  recordMap('parentGateCredentials', snapshot.parentGateCredentials);
  recordMap('children', snapshot.children);
  recordMap('childCredentials', snapshot.childCredentials);
  recordMap('archivedChildren', snapshot.archivedChildren);
  recordMap('contentPolicies', snapshot.contentPolicies);
  recordMap('privacySettings', snapshot.privacySettings);
  recordGroupedById('privacyConsents', snapshot.privacyConsents);
  recordGroupedById('dataRequests', snapshot.dataRequests);
  recordArrayById('familyAuditEvents', snapshot.familyAuditEvents);
  recordArrayById('securityLogs', snapshot.securityLogs);
  recordGroupedById('aiUsageRecords', snapshot.aiUsageRecords);
  recordMap('aiUsageDaily', snapshot.aiUsageDaily);
  recordGroupedById('gardenRewardEvents', snapshot.gardenRewardEvents);
  recordArrayById('customLessons', snapshot.customLessons);
  recordArrayById('customQuestions', snapshot.customQuestions);
  recordMap('checkoutSessions', snapshot.checkoutSessions);
  recordMap('examAttempts', snapshot.examAttempts);
  recordMap('level1Attempts', snapshot.level1Attempts);
  recordMap('level2Attempts', snapshot.level2Attempts);
  recordMap('smartAssessmentSessions', snapshot.smartAssessmentSessions);
  recordMap('certificates', snapshot.certificates);
  recordMap('processedSyncKeys', snapshot.processedSyncKeys);
  recordMap('classes', snapshot.classes);
  recordMap('teacherQuestions', snapshot.teacherQuestions);
  recordMap('teacherExams', snapshot.teacherExams);
  recordMap('examAssignments', snapshot.examAssignments);
  recordMap('assignedExamAttempts', snapshot.assignedExamAttempts);
  recordMap('homeworks', snapshot.homeworks);
  recordMap('homeworkSubmissions', snapshot.homeworkSubmissions);
  recordMap('homeworkAttachments', snapshot.homeworkAttachments);
  recordMap('importBatches', snapshot.importBatches);
  recordMap('quranChildSettings', snapshot.quranChildSettings);
  recordMap('quranSurahProgress', snapshot.quranSurahProgress);
  recordMap('quranStoryProgress', snapshot.quranStoryProgress);
  recordMap('quranMannerProgress', snapshot.quranMannerProgress);
  recordArrayById('quranActivityEvents', snapshot.quranActivityEvents);
  recordMap('quranContentVerifications', snapshot.quranContentVerifications);

  const configHashes = new Map<string, string>();
  configHashes.set('examConfig', stableHashValue(snapshot.examConfig));
  configHashes.set('featureFlags', stableHashValue(snapshot.featureFlags));
  configHashes.set('level2ProgressionConfig', stableHashValue(snapshot.level2ProgressionConfig));
  configHashes.set('operationalMetrics', stableHashValue(snapshot.operationalMetrics));
  configHashes.set('adminBootstrap', stableHashValue(snapshot.adminBootstrap || { initialized: false, secretConsumed: false }));
  configHashes.set('quranStoryDetails', stableHashValue(snapshot.quranStoryDetails || {}));
  configHashes.set('quranStoryCms', stableHashValue(snapshot.quranStoryCms || {}));

  return { serializedCache, configHashes };
}

export async function loadServerDbSnapshotPg(runner: PgRunner = pgDb): Promise<PgRequestContext> {
  if (allowDevInMemoryFallback()) {
    const snapshot = structuredClone(getInMemoryDb());
    ensureFamilyCollections(snapshot);
    return {
      db: snapshot,
      serializedCache: new Map(),
      configHashes: new Map(),
      pendingCommit: null,
      quranSchemaReady: true,
    };
  }
  assertPgConfiguredOrThrow();

  let loadedRows;
  let quranSchemaReady = false;
  let quranLoadedRows: [
    Array<typeof schema.quranChildSettings.$inferSelect>,
    Array<typeof schema.quranSurahProgress.$inferSelect>,
    Array<typeof schema.quranStoryProgress.$inferSelect>,
    Array<typeof schema.quranMannerProgress.$inferSelect>,
    Array<typeof schema.quranActivityEvents.$inferSelect>,
    Array<typeof schema.quranContentVerifications.$inferSelect>,
  ] = [[], [], [], [], [], []];
  try {
    // Preflight a single lightweight query so auth/network errors fail once instead of logging 39 Failed query traces
    await runner.execute(sql`SELECT 1`);
    loadedRows = await Promise.all([
      runner.select().from(schema.families),
      runner.select().from(schema.users),
      runner.select().from(schema.guardianMemberships),
      runner.select().from(schema.guardianInvitations),
      runner.select().from(schema.trustedDevices),
      runner.select().from(schema.sessions),
      runner.select().from(schema.actionTokens),
      runner.select().from(schema.parentGateCredentials),
      runner.select().from(schema.children),
      runner.select().from(schema.childCredentials),
      runner.select().from(schema.archivedChildren),
      runner.select().from(schema.contentPolicies),
      runner.select().from(schema.privacySettings),
      runner.select().from(schema.privacyConsents),
      runner.select().from(schema.dataRequests),
      runner.select().from(schema.familyAuditEvents),
      runner.select().from(schema.securityLogs),
      runner.select().from(schema.aiUsageRecords),
      runner.select().from(schema.aiUsageDaily),
      runner.select().from(schema.gardenRewardEvents),
      runner.select().from(schema.customLessons),
      runner.select().from(schema.customQuestions),
      runner.select().from(schema.checkoutSessions),
      runner.select().from(schema.examAttempts),
      runner.select().from(schema.level1Attempts),
      runner.select().from(schema.level2Attempts),
      runner.select().from(schema.smartAssessmentSessions),
      runner.select().from(schema.certificates),
      runner.select().from(schema.processedSyncKeys),
      runner.select().from(schema.classes),
      runner.select().from(schema.teacherQuestions),
      runner.select().from(schema.teacherExams),
      runner.select().from(schema.examAssignments),
      runner.select().from(schema.assignedExamAttempts),
      runner.select().from(schema.homeworks),
      runner.select().from(schema.homeworkSubmissions),
      runner.select().from(schema.homeworkAttachments),
      runner.select().from(schema.importBatches),
      runner
        .select()
        .from(schema.appConfigs)
        .where(notLike(schema.appConfigs.key, 'story_audio_blob:%')),
    ]);
    quranSchemaReady = await checkQuranTablesReady(runner);
    if (quranSchemaReady) {
      quranLoadedRows = await Promise.all([
        runner.select().from(schema.quranChildSettings),
        runner.select().from(schema.quranSurahProgress),
        runner.select().from(schema.quranStoryProgress),
        runner.select().from(schema.quranMannerProgress),
        runner.select().from(schema.quranActivityEvents),
        runner.select().from(schema.quranContentVerifications),
      ]);
    }
  } catch (err) {
    const pgCode = (err as { code?: string; cause?: { code?: string } })?.code ||
      (err as { cause?: { code?: string } })?.cause?.code;
    if (pgCode === '28P01' || pgCode === '28000') {
      const authErr = new Error(
        'PostgreSQL authentication failed (28P01). Verify SQL_USER (on Neon default role is typically "neondb_owner") and SQL_PASSWORD in Secrets.',
      ) as Error & { code?: string };
      authErr.code = 'PG_AUTH_FAILED';
      throw authErr;
    }
    if (pgCode === '42P01') {
      const schemaErr = new Error(
        'PostgreSQL connected, but schema tables do not exist yet. Run "npm run db:migrate" with Neon Secrets configured.',
      ) as Error & { code?: string };
      schemaErr.code = 'SCHEMA_NOT_INITIALIZED';
      throw schemaErr;
    }
    throw err;
  }

  const [
    familiesRows,
    usersRows,
    membershipRows,
    invitationRows,
    deviceRows,
    sessionRows,
    actionTokenRows,
    gateCredRows,
    childRows,
    childCredRows,
    archivedChildRows,
    contentPolicyRows,
    privacySettingRows,
    privacyConsentRows,
    dataRequestRows,
    familyAuditRows,
    securityLogRows,
    aiUsageRows,
    aiUsageDailyRows,
    gardenRewardRows,
    customLessonRows,
    customQuestionRows,
    checkoutRows,
    examAttemptRows,
    level1AttemptRows,
    level2AttemptRows,
    smartSessionRows,
    certificateRows,
    processedSyncRows,
    classRows,
    teacherQuestionRows,
    teacherExamRows,
    examAssignmentRows,
    assignedExamAttemptRows,
    homeworkRows,
    homeworkSubmissionRows,
    homeworkAttachmentRows,
    importBatchRows,
    appConfigRows,
  ] = loadedRows;
  const [
    quranSettingsRows,
    quranSurahProgRows,
    quranStoryProgRows,
    quranMannerProgRows,
    quranActivityRows,
    quranVerificationRows,
  ] = quranLoadedRows;

  const snap = getDefaultServerDb();

  for (const r of familiesRows) {
    snap.families![r.id] = {
      id: r.id,
      name: r.name,
      primaryGuardianId: r.primaryGuardianId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of usersRows) {
    const u = rowToUser(r);
    snap.users[u.id] = u;
    snap.emailIndex[u.normalizedEmail] = u.id;
  }

  for (const r of membershipRows) {
    snap.guardianMemberships![r.id] = {
      id: r.id,
      familyId: r.familyId,
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      role: r.role,
      permissions: r.permissions || [],
      status: r.status,
      invitedByUserId: r.invitedByUserId ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      revokedAt: r.revokedAt ?? undefined,
    };
  }

  for (const r of invitationRows) {
    snap.guardianInvitations![r.id] = {
      id: r.id,
      familyId: r.familyId,
      email: r.email,
      role: r.role,
      permissions: r.permissions || [],
      invitedByUserId: r.invitedByUserId,
      invitedByName: r.invitedByName,
      status: r.status,
      tokenHash: r.tokenHash,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt ?? undefined,
    };
  }

  for (const r of deviceRows) {
    snap.trustedDevices![r.id] = {
      id: r.id,
      familyId: r.familyId,
      userId: r.userId,
      tokenHash: r.tokenHash,
      deviceName: r.deviceName,
      deviceType: r.deviceType,
      browser: r.browser,
      os: r.os,
      userAgent: r.userAgent,
      ip: r.ip,
      trusted: r.trusted,
      revoked: r.revoked,
      firstRegisteredAt: r.firstRegisteredAt,
      lastActiveAt: r.lastActiveAt,
      revokedAt: r.revokedAt ?? undefined,
    };
  }

  for (const r of sessionRows) {
    snap.sessions[r.tokenHash] = {
      tokenHash: r.tokenHash,
      userId: r.userId,
      csrfToken: r.csrfToken,
      createdAt: r.createdAt,
      lastActiveAt: r.lastActiveAt,
      expiresAt: r.expiresAt,
      ip: r.ip,
      userAgent: r.userAgent,
      sessionKind: r.sessionKind ?? undefined,
      childId: r.childId ?? undefined,
      familyId: r.familyId ?? undefined,
      deviceId: r.deviceId ?? undefined,
      rememberMe: r.rememberMe ?? false,
      parentGateVerifiedUntil: r.parentGateVerifiedUntil ?? undefined,
    };
  }

  for (const r of actionTokenRows) {
    snap.actionTokens[r.tokenHash] = {
      tokenHash: r.tokenHash,
      userId: r.userId,
      type: r.type,
      expiresAt: r.expiresAt,
      used: r.used,
    };
  }

  for (const r of gateCredRows) {
    snap.parentGateCredentials![r.userId] = {
      userId: r.userId,
      familyId: r.familyId,
      pinHash: r.pinHash,
      failedAttempts: r.failedAttempts,
      lockedUntil: r.lockedUntil ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of childRows) {
    snap.children[r.id] = rowToChild(r);
  }

  for (const r of childCredRows) {
    snap.childCredentials![r.childId] = {
      childId: r.childId,
      familyId: r.familyId,
      accessCodeHash: r.accessCodeHash,
      accessCodeEncrypted: r.accessCodeEncrypted,
      accessCodeLast4: r.accessCodeLast4,
      pinHash: r.pinHash,
      failedAttempts: r.failedAttempts,
      lockedUntil: r.lockedUntil ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      rotatedAt: r.rotatedAt ?? undefined,
      lastLoginAt: r.lastLoginAt ?? undefined,
    };
    snap.childAccessCodeIndex![r.accessCodeHash] = r.childId;
  }

  for (const r of archivedChildRows) {
    snap.archivedChildren![r.childId] = {
      childId: r.childId,
      familyId: r.familyId,
      parentId: r.parentId,
      displayName: r.displayName,
      deletedByUserId: r.deletedByUserId,
      deletedAt: r.deletedAt,
      reason: r.reason ?? undefined,
    };
  }

  for (const r of contentPolicyRows) {
    snap.contentPolicies![r.familyId] = {
      familyId: r.familyId,
      allowStories: r.allowStories,
      allowSongsAudio: r.allowSongsAudio,
      allowVideos: r.allowVideos,
      allowGamesCreative: r.allowGamesCreative,
      aiCompanionEnabled: r.aiCompanionEnabled,
      voiceInteractionEnabled: r.voiceInteractionEnabled,
      ageStrictMode: r.ageStrictMode,
      allowExternalContent: r.allowExternalContent,
      allowedStoryCategories: r.allowedStoryCategories || [],
      blockedVideoIds: r.blockedVideoIds || [],
      allowedVideoIds: r.allowedVideoIds || [],
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy ?? undefined,
    };
  }

  for (const r of privacySettingRows) {
    snap.privacySettings![r.familyId] = {
      familyId: r.familyId,
      childProfileVisibility: r.childProfileVisibility,
      aiFeaturesConsent: r.aiFeaturesConsent,
      voiceInteractionConsent: r.voiceInteractionConsent,
      analyticsConsent: r.analyticsConsent,
      essentialTermsConsent: r.essentialTermsConsent,
      policyVersion: r.policyVersion,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy ?? undefined,
    };
  }

  for (const r of privacyConsentRows) {
    const arr = (snap.privacyConsents![r.familyId] ||= []);
    arr.push({
      id: r.id,
      familyId: r.familyId,
      consentKey: r.consentKey,
      granted: r.granted,
      policyVersion: r.policyVersion,
      grantedByUserId: r.grantedByUserId,
      grantedByName: r.grantedByName,
      grantedAt: r.grantedAt,
      withdrawnAt: r.withdrawnAt ?? undefined,
    });
  }

  for (const r of dataRequestRows) {
    const arr = (snap.dataRequests![r.familyId] ||= []);
    arr.push({
      id: r.id,
      familyId: r.familyId,
      type: r.type,
      status: r.status,
      requestedByUserId: r.requestedByUserId,
      requestedByName: r.requestedByName,
      note: r.note ?? undefined,
      requestedAt: r.requestedAt,
      completedAt: r.completedAt ?? undefined,
    });
  }

  snap.familyAuditEvents = familyAuditRows
    .map((r) => ({
      id: r.id,
      familyId: r.familyId,
      category: r.category,
      actionType: r.actionType,
      actorId: r.actorId ?? undefined,
      actorName: r.actorName ?? undefined,
      actorRole: r.actorRole ?? undefined,
      childId: r.childId ?? undefined,
      childName: r.childName ?? undefined,
      deviceId: r.deviceId ?? undefined,
      severity: r.severity ?? undefined,
      title: r.title,
      description: r.description,
      metadata: r.metadata ?? undefined,
      ip: r.ip ?? undefined,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  snap.securityLogs = securityLogRows
    .map((r) => ({
      id: r.id,
      eventType: r.eventType as SecurityEventLog['eventType'],
      familyId: r.familyId ?? undefined,
      actorId: r.actorId ?? undefined,
      actorRole: r.actorRole ?? undefined,
      role: r.role ?? undefined,
      actionType: r.actionType ?? undefined,
      recordType: r.recordType ?? undefined,
      recordId: r.recordId ?? undefined,
      previousValue: r.previousValue ?? undefined,
      newValue: r.newValue ?? undefined,
      reason: r.reason ?? undefined,
      outcome: (r.outcome as SecurityEventLog['outcome']) ?? undefined,
      ip: r.ip ?? undefined,
      summary: r.summary,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  for (const r of aiUsageRows) {
    const arr = (snap.aiUsageRecords![r.childId] ||= []);
    arr.push({
      id: r.id,
      childId: r.childId,
      familyId: r.familyId ?? undefined,
      actorId: r.actorId ?? undefined,
      mode: r.mode,
      language: r.language,
      topic: r.topic ?? undefined,
      blocked: r.blocked,
      voiceUsed: r.voiceUsed,
      createdAt: r.createdAt,
    });
  }

  for (const r of aiUsageDailyRows) {
    snap.aiUsageDaily![r.usageKey] = r.count;
  }

  for (const r of gardenRewardRows) {
    const arr = (snap.gardenRewardEvents![r.childId] ||= []);
    arr.push({
      id: r.id,
      childId: r.childId,
      milestoneKey: r.milestoneKey,
      itemUnlockedId: r.itemUnlockedId,
      reason: r.reason,
      awardedAt: r.awardedAt,
    });
  }

  snap.customLessons = customLessonRows.map((r) => ({
    id: r.id,
    domain: r.domain as CmsLessonRecord['domain'],
    title: r.title,
    summary: r.summary,
    ageGroups: r.ageGroups,
    recommendedAgeRange: r.recommendedAgeRange ?? undefined,
    targetSymbol: r.targetSymbol,
    colorHex: r.colorHex ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    audioUrl: r.audioUrl ?? undefined,
    examples: r.examples,
    level: (r.level as 1 | 2 | undefined) ?? undefined,
    subject: r.subject ?? undefined,
    published: r.published,
    updatedAt: r.updatedAt,
  }));

  snap.customQuestions = customQuestionRows.map((r) => ({
    id: r.id,
    subject: r.subject as ExamQuestionItem['subject'],
    ageGroups: r.ageGroups,
    recommendedAgeRange: r.recommendedAgeRange ?? undefined,
    type: r.type as ExamQuestionItem['type'],
    difficulty: r.difficulty as 1 | 2 | 3,
    lessonRefId: r.lessonRefId,
    lessonTitle: r.lessonTitle,
    prompt: r.prompt,
    audioText: r.audioText ?? undefined,
    audioLang: r.audioLang ?? undefined,
    visualCue: r.visualCue ?? undefined,
    options: r.options,
    correctOptionId: r.correctOptionId,
    explanation: r.explanation,
    published: r.published ?? true,
  }));

  for (const r of checkoutRows) {
    snap.checkoutSessions[r.id] = {
      id: r.id,
      childId: r.childId,
      parentId: r.parentId ?? undefined,
      subject: r.subject,
      amountEgp: r.amountEgp,
      status: r.status,
      paymentToken: r.paymentToken ?? undefined,
      tokenConsumed: r.tokenConsumed ?? false,
      createdAt: r.createdAt,
      verifiedAt: r.verifiedAt ?? undefined,
    };
  }

  for (const r of examAttemptRows) {
    snap.examAttempts[r.id] = {
      id: r.id,
      childId: r.childId,
      parentId: r.parentId ?? undefined,
      childName: r.childName,
      ageGroup: r.ageGroup,
      subject: r.subject,
      mode: r.mode,
      questionIds: r.questionIds,
      paymentVerified: r.paymentVerified,
      amountPaidEgp: r.amountPaidEgp,
      passingPercentage: r.passingPercentage,
      submitted: r.submitted,
      summary: r.summary ?? undefined,
      certificateCode: r.certificateCode ?? undefined,
      createdAt: r.createdAt,
    };
  }

  for (const r of level1AttemptRows) {
    snap.level1Attempts[r.id] = {
      id: r.id,
      childId: r.childId,
      parentId: r.parentId ?? undefined,
      lessonId: r.lessonId,
      questionIds: r.questionIds,
      submitted: r.submitted,
      result: r.result ?? undefined,
      createdAt: r.createdAt,
    };
  }

  for (const r of level2AttemptRows) {
    snap.level2Attempts[r.id] = {
      id: r.id,
      childId: r.childId,
      parentId: r.parentId ?? undefined,
      lessonId: r.lessonId,
      questionIds: r.questionIds,
      submitted: r.submitted,
      result: r.result ?? undefined,
      createdAt: r.createdAt,
    };
  }

  for (const r of smartSessionRows) {
    snap.smartAssessmentSessions![r.id] = {
      id: r.id,
      childId: r.childId,
      parentId: r.parentId ?? undefined,
      ageGroup: r.ageGroup,
      difficultyTier: r.difficultyTier,
      totalQuestions: r.totalQuestions,
      askedQuestionIds: r.askedQuestionIds,
      results: r.results,
      streak: r.streak,
      consecutiveMistakes: r.consecutiveMistakes,
      hintsUsed: r.hintsUsed,
      finished: r.finished,
      createdAt: r.createdAt,
    };
  }

  for (const r of certificateRows) {
    snap.certificates[r.uniqueCode] = {
      uniqueCode: r.uniqueCode,
      id: r.id,
      childName: r.childName,
      worldId: r.worldId,
      worldName: r.worldName,
      achievementTitle: r.achievementTitle,
      issuedAt: r.issuedAt,
      levelCompleted: r.levelCompleted,
      isOfficialExam: r.isOfficialExam ?? undefined,
      examSubject: r.examSubject ?? undefined,
      score: r.score ?? undefined,
      totalQuestions: r.totalQuestions ?? undefined,
      percentage: r.percentage ?? undefined,
      passingPercentage: r.passingPercentage ?? undefined,
      ageGroup: r.ageGroup ?? undefined,
      verificationUrl: r.verificationUrl ?? undefined,
      revoked: r.revoked ?? false,
    };
  }

  for (const r of processedSyncRows) {
    snap.processedSyncKeys[r.idempotencyKey] = {
      childId: r.childId,
      processedAt: r.processedAt,
      summary: r.summary,
    };
  }

  for (const r of classRows) {
    snap.classes[r.id] = {
      id: r.id,
      name: r.name,
      subject: r.subject,
      level: r.level === '1' ? 1 : r.level === '2' ? 2 : 'all',
      description: r.description ?? undefined,
      ageGroup: r.ageGroup ?? undefined,
      recommendedAgeRange: r.recommendedAgeRange ?? undefined,
      teacherId: r.teacherId,
      studentIds: r.studentIds,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of teacherQuestionRows) {
    snap.teacherQuestions[r.id] = {
      id: r.id,
      teacherId: r.teacherId,
      subject: r.subject,
      level: r.level as 1 | 2,
      lessonId: r.lessonId,
      questionType: r.questionType,
      promptAr: r.promptAr,
      promptEn: r.promptEn,
      imageUrl: r.imageUrl ?? undefined,
      audioUrl: r.audioUrl ?? undefined,
      audioText: r.audioText ?? undefined,
      options: r.options,
      correctOptionId: r.correctOptionId ?? undefined,
      correctOptionIds: r.correctOptionIds ?? undefined,
      allowMultipleCorrect: r.allowMultipleCorrect ?? undefined,
      matchingPairs: r.matchingPairs ?? undefined,
      correctOrder: r.correctOrder ?? undefined,
      acceptedAnswers: r.acceptedAnswers ?? undefined,
      marks: r.marks,
      difficulty: r.difficulty,
      recommendedAgeRange: r.recommendedAgeRange ?? undefined,
      explanation: r.explanation,
      feedbackCorrect: r.feedbackCorrect,
      feedbackIncorrect: r.feedbackIncorrect,
      active: r.active,
      approvalStatus: r.approvalStatus ?? undefined,
      adminFeedback: r.adminFeedback ?? undefined,
      reviewedBy: r.reviewedBy ?? undefined,
      reviewedAt: r.reviewedAt ?? undefined,
      qualityFlags: r.qualityFlags ?? undefined,
      version: r.version,
      versions: r.versions ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of teacherExamRows) {
    snap.teacherExams[r.id] = {
      id: r.id,
      teacherId: r.teacherId,
      title: r.title,
      description: r.description,
      subject: r.subject,
      level: r.level as 1 | 2,
      ageGroup: r.ageGroup,
      recommendedAgeRange: r.recommendedAgeRange ?? undefined,
      lessonIds: r.lessonIds,
      questionIds: r.questionIds,
      questionSnapshots: r.questionSnapshots ?? undefined,
      totalQuestions: r.totalQuestions,
      totalMarks: r.totalMarks,
      passingPercentage: r.passingPercentage,
      durationMinutes: r.durationMinutes,
      startDate: r.startDate,
      endDate: r.endDate,
      allowedAttempts: r.allowedAttempts,
      randomizeQuestions: r.randomizeQuestions,
      randomizeAnswers: r.randomizeAnswers,
      showResults: r.showResults,
      showCorrectAnswers: r.showCorrectAnswers,
      status: r.status,
      adminReviewNote: r.adminReviewNote ?? undefined,
      reviewedBy: r.reviewedBy ?? undefined,
      reviewedAt: r.reviewedAt ?? undefined,
      version: r.version,
      versions: r.versions ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of examAssignmentRows) {
    snap.examAssignments[r.id] = {
      id: r.id,
      examId: r.examId,
      studentId: r.studentId,
      teacherId: r.teacherId,
      classId: r.classId ?? undefined,
      assignedAt: r.assignedAt,
      availableStartDate: r.availableStartDate,
      deadline: r.deadline,
      extendedDeadline: r.extendedDeadline ?? undefined,
      status: r.status,
    };
  }

  for (const r of assignedExamAttemptRows) {
    snap.assignedExamAttempts[r.id] = {
      id: r.id,
      assignmentId: r.assignmentId,
      examId: r.examId,
      studentId: r.studentId,
      teacherId: r.teacherId,
      attemptNumber: r.attemptNumber,
      questionIds: r.questionIds,
      optionOrderMap: r.optionOrderMap,
      answers: r.answers,
      status: r.status,
      score: r.score ?? undefined,
      totalMarks: r.totalMarks ?? undefined,
      percentage: r.percentage ?? undefined,
      passed: r.passed ?? undefined,
      startedAt: r.startedAt,
      submittedAt: r.submittedAt ?? undefined,
      review: r.review ?? undefined,
    };
  }

  for (const r of homeworkRows) {
    snap.homeworks[r.id] = {
      id: r.id,
      teacherId: r.teacherId,
      title: r.title,
      instructions: r.instructions,
      subject: r.subject,
      level: r.level as 1 | 2,
      recommendedAgeRange: r.recommendedAgeRange ?? undefined,
      lessonIds: r.lessonIds,
      homeworkType: r.homeworkType,
      questionIds: r.questionIds,
      questionSnapshots: r.questionSnapshots ?? undefined,
      attachments: r.attachments,
      assignedClassIds: r.assignedClassIds,
      assignedStudentIds: r.assignedStudentIds,
      startDate: r.startDate,
      deadline: r.deadline,
      maxAttempts: r.maxAttempts,
      passingPercentage: r.passingPercentage,
      status: r.status,
      adminFeedback: r.adminFeedback ?? undefined,
      reviewedBy: r.reviewedBy ?? undefined,
      reviewedAt: r.reviewedAt ?? undefined,
      version: r.version,
      versions: r.versions ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of homeworkSubmissionRows) {
    snap.homeworkSubmissions[r.id] = {
      id: r.id,
      assignmentId: r.assignmentId,
      homeworkVersion: r.homeworkVersion,
      studentId: r.studentId,
      teacherId: r.teacherId,
      openedAt: r.openedAt ?? undefined,
      startedAt: r.startedAt ?? undefined,
      submittedAt: r.submittedAt ?? undefined,
      completedAt: r.completedAt ?? undefined,
      attemptCount: r.attemptCount,
      extendedDeadline: r.extendedDeadline ?? undefined,
      extensionReason: r.extensionReason ?? undefined,
      status: r.status,
      answers: r.answers,
      textResponse: r.textResponse ?? undefined,
      score: r.score ?? undefined,
      totalMarks: r.totalMarks ?? undefined,
      percentage: r.percentage ?? undefined,
      passed: r.passed ?? undefined,
      teacherFeedback: r.teacherFeedback ?? undefined,
      gradedAt: r.gradedAt ?? undefined,
      review: r.review ?? undefined,
    };
  }

  for (const r of homeworkAttachmentRows) {
    snap.homeworkAttachments[r.id] = {
      id: r.id,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      kind: r.kind,
      url: r.url,
      storedPath: r.storedPath,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt,
    };
  }

  for (const r of importBatchRows) {
    snap.importBatches[r.id] = {
      id: r.id,
      teacherId: r.teacherId,
      fileName: r.fileName,
      format: r.format,
      storedUploadPath: r.storedUploadPath,
      validRows: r.validRows,
      invalidRows: r.invalidRows,
      committed: r.committed,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    };
  }

  for (const cfg of appConfigRows) {
    if (cfg.key === 'examConfig' && cfg.value && typeof cfg.value === 'object') {
      snap.examConfig = { ...snap.examConfig, ...(cfg.value as Partial<ExamConfig>) };
    } else if (cfg.key === 'featureFlags' && cfg.value && typeof cfg.value === 'object') {
      snap.featureFlags = { ...snap.featureFlags, ...(cfg.value as Partial<FeatureFlags>) };
    } else if (cfg.key === 'level2ProgressionConfig' && cfg.value && typeof cfg.value === 'object') {
      snap.level2ProgressionConfig = {
        ...snap.level2ProgressionConfig,
        ...(cfg.value as Partial<Level2ProgressionConfig>),
      };
    } else if (cfg.key === 'operationalMetrics' && cfg.value && typeof cfg.value === 'object') {
      const val = cfg.value as Partial<OperationalMetrics>;
      snap.operationalMetrics = {
        ...snap.operationalMetrics,
        ...val,
        lastErrors: val.lastErrors || [],
      };
    } else if (cfg.key === 'adminBootstrap' && cfg.value && typeof cfg.value === 'object') {
      snap.adminBootstrap = {
        initialized: false,
        secretConsumed: false,
        ...(cfg.value as Partial<NonNullable<ServerDb['adminBootstrap']>>),
      };
    } else if (cfg.key === 'quranStoryDetails' && cfg.value && typeof cfg.value === 'object') {
      snap.quranStoryDetails = cfg.value as ServerDb['quranStoryDetails'];
    } else if (cfg.key === 'quranStoryCms' && cfg.value && typeof cfg.value === 'object') {
      snap.quranStoryCms = cfg.value as ServerDb['quranStoryCms'];
    }
  }

  for (const r of quranSettingsRows) {
    snap.quranChildSettings![r.childId] = {
      childId: r.childId,
      enabled: Boolean(r.enabled),
      allowedSurahIds: r.allowedSurahIds || [],
      surahOrder: r.surahOrder || [],
      preferredReciterId: r.preferredReciterId,
      preferChildReciterFallback: Boolean(r.preferChildReciterFallback),
      repeatCount: Number(r.repeatCount || 2),
      listenOnlyMode: Boolean(r.listenOnlyMode),
      dailyMaxMinutes: Number(r.dailyMaxMinutes || 15),
      gentleReminderEnabled: Boolean(r.gentleReminderEnabled),
      updatedByUserId: r.updatedByUserId ?? undefined,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of quranSurahProgRows) {
    snap.quranSurahProgress![r.id] = {
      id: r.id,
      childId: r.childId,
      surahId: r.surahId,
      listenCount: Number(r.listenCount || 0),
      repeatSessionsCount: Number(r.repeatSessionsCount || 0),
      ayahsPracticed: r.ayahsPracticed || [],
      status: r.status,
      parentConfirmedMemorization: Boolean(r.parentConfirmedMemorization),
      parentConfirmedAt: r.parentConfirmedAt ?? undefined,
      parentConfirmedByUserId: r.parentConfirmedByUserId ?? undefined,
      parentNote: r.parentNote ?? undefined,
      lastListenedAt: r.lastListenedAt ?? undefined,
      updatedAt: r.updatedAt,
    };
  }

  for (const r of quranStoryProgRows) {
    snap.quranStoryProgress![r.id] = {
      id: r.id,
      childId: r.childId,
      storyId: r.storyId,
      completedCount: Number(r.completedCount || 0),
      lastReadAt: r.lastReadAt,
    };
  }

  for (const r of quranMannerProgRows) {
    snap.quranMannerProgress![r.id] = {
      id: r.id,
      childId: r.childId,
      mannerId: r.mannerId,
      practicedCount: Number(r.practicedCount || 0),
      lastPracticedAt: r.lastPracticedAt,
    };
  }

  snap.quranActivityEvents = quranActivityRows
    .map((r) => ({
      id: r.id,
      childId: r.childId,
      eventType: r.eventType,
      targetId: r.targetId,
      durationSeconds: Number(r.durationSeconds || 0),
      ayahCount: Number(r.ayahCount || 0),
      reciterId: r.reciterId ?? undefined,
      recordedByUserId: r.recordedByUserId ?? undefined,
      occurredAt: r.occurredAt,
    }))
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  for (const r of quranVerificationRows) {
    const rawJson = (r.audioUrlsJson ?? {}) as Record<string, unknown>;
    const cleanAudioUrls: Record<string, string> = {};
    for (const [k, val] of Object.entries(rawJson)) {
      if (!k.startsWith('_') && typeof val === 'string') {
        cleanAudioUrls[k] = val;
      }
    }
    const metaConfs = (
      rawJson._confirmations && typeof rawJson._confirmations === 'object'
        ? rawJson._confirmations
        : {}
    ) as Record<string, unknown>;

    snap.quranContentVerifications![r.contentKey] = {
      id: r.id,
      contentType: r.contentType,
      contentKey: r.contentKey,
      sourceName: r.sourceName,
      licenseOrPermission: r.licenseOrPermission,
      tajweedReviewedBy: r.tajweedReviewedBy ?? undefined,
      tajweedReviewedAt: r.tajweedReviewedAt ?? undefined,
      textIntegrityConfirmed:
        typeof metaConfs.textIntegrityConfirmed === 'boolean'
          ? metaConfs.textIntegrityConfirmed
          : undefined,
      audioIntegrityConfirmed:
        typeof metaConfs.audioIntegrityConfirmed === 'boolean'
          ? metaConfs.audioIntegrityConfirmed
          : undefined,
      reciterIdentityConfirmed:
        typeof metaConfs.reciterIdentityConfirmed === 'boolean'
          ? metaConfs.reciterIdentityConfirmed
          : undefined,
      tajweedListeningConfirmed:
        typeof metaConfs.tajweedListeningConfirmed === 'boolean'
          ? metaConfs.tajweedListeningConfirmed
          : undefined,
      licenseTermsConfirmed:
        typeof metaConfs.licenseTermsConfirmed === 'boolean'
          ? metaConfs.licenseTermsConfirmed
          : undefined,
      licenseConfirmedBy:
        typeof metaConfs.licenseConfirmedBy === 'string'
          ? metaConfs.licenseConfirmedBy
          : undefined,
      licenseConfirmedAt:
        typeof metaConfs.licenseConfirmedAt === 'string'
          ? metaConfs.licenseConfirmedAt
          : undefined,
      surahChecklist:
        rawJson._surahChecklist && typeof rawJson._surahChecklist === 'object'
          ? (rawJson._surahChecklist as Record<string, QuranSurahHumanReviewEntry>)
          : undefined,
      adminConfirmations:
        rawJson._adminConfirmations && typeof rawJson._adminConfirmations === 'object'
          ? (rawJson._adminConfirmations as QuranAdminConfirmations)
          : undefined,
      sourceVerification:
        rawJson._sourceVerification && typeof rawJson._sourceVerification === 'object'
          ? (rawJson._sourceVerification as QuranSourceVerificationRecord)
          : undefined,
      basmalaCandidateProbe:
        rawJson._basmalaCandidateProbe && typeof rawJson._basmalaCandidateProbe === 'object'
          ? (rawJson._basmalaCandidateProbe as QuranAudioProbeDiagnostics)
          : undefined,
      verificationStatus: r.verificationStatus,
      audioUrlsJson: Object.keys(cleanAudioUrls).length > 0 ? cleanAudioUrls : undefined,
      ayahAudioUrlsJson:
        rawJson._ayahAudioUrls && typeof rawJson._ayahAudioUrls === 'object'
          ? (rawJson._ayahAudioUrls as Record<string, string>)
          : undefined,
      notes: r.notes ?? undefined,
      updatedByUserId: r.updatedByUserId ?? undefined,
      updatedAt: r.updatedAt,
    };
  }

  ensureFamilyCollections(snap);
  const { serializedCache, configHashes } = buildContextCaches(snap);
  return {
    db: snap,
    serializedCache,
    configHashes,
    pendingCommit: null,
    quranSchemaReady,
  };
}

function diffRecordMap<T>(
  prev: Map<string, string> | undefined,
  currentRecord: Record<string, T> | undefined,
): { upserts: Array<{ key: string; value: T; hash: string }>; deletes: string[] } {
  const prevMap = prev || new Map<string, string>();
  const cur = currentRecord || {};
  const upserts: Array<{ key: string; value: T; hash: string }> = [];
  const deletes: string[] = [];

  for (const [k, v] of Object.entries(cur)) {
    const h = stableHashValue(v);
    if (prevMap.get(k) !== h) {
      upserts.push({ key: k, value: v, hash: h });
    }
  }
  for (const oldKey of prevMap.keys()) {
    if (!(oldKey in cur)) {
      deletes.push(oldKey);
    }
  }
  return { upserts, deletes };
}

function diffArrayById<T extends { id: string }>(
  prev: Map<string, string> | undefined,
  items: T[] | undefined,
): { upserts: Array<{ key: string; value: T; hash: string }>; deletes: string[] } {
  const rec: Record<string, T> = {};
  for (const item of items || []) {
    rec[item.id] = item;
  }
  return diffRecordMap(prev, rec);
}

function diffGroupedById<T extends { id: string }>(
  prev: Map<string, string> | undefined,
  grouped: Record<string, T[]> | undefined,
): { upserts: Array<{ key: string; value: T; hash: string }>; deletes: string[] } {
  const rec: Record<string, T> = {};
  for (const arr of Object.values(grouped || {})) {
    for (const item of arr) {
      rec[item.id] = item;
    }
  }
  return diffRecordMap(prev, rec);
}

export async function commitServerDbDiffPg(
  ctx: PgRequestContext,
  after: ServerDb,
  txRunner?: PgRunner,
): Promise<void> {
  ensureFamilyCollections(after);
  if (allowDevInMemoryFallback()) {
    const write = inMemoryLockChain.then(() => {
      inMemoryDb = structuredClone(after);
    });
    inMemoryLockChain = write.catch(() => undefined);
    await write;
    return;
  }
  assertPgConfiguredOrThrow();
  const nowIso = new Date().toISOString();

  const dFamilies = diffRecordMap(ctx.serializedCache.get('families'), after.families);
  const dUsers = diffRecordMap(ctx.serializedCache.get('users'), after.users);
  const dMemberships = diffRecordMap(ctx.serializedCache.get('guardianMemberships'), after.guardianMemberships);
  const dInvitations = diffRecordMap(ctx.serializedCache.get('guardianInvitations'), after.guardianInvitations);
  const dDevices = diffRecordMap(ctx.serializedCache.get('trustedDevices'), after.trustedDevices);
  const dSessions = diffRecordMap(ctx.serializedCache.get('sessions'), after.sessions);
  const dActionTokens = diffRecordMap(ctx.serializedCache.get('actionTokens'), after.actionTokens);
  const dGateCreds = diffRecordMap(ctx.serializedCache.get('parentGateCredentials'), after.parentGateCredentials);
  const dChildren = diffRecordMap(ctx.serializedCache.get('children'), after.children);
  const dChildCreds = diffRecordMap(ctx.serializedCache.get('childCredentials'), after.childCredentials);
  const dArchivedChildren = diffRecordMap(ctx.serializedCache.get('archivedChildren'), after.archivedChildren);
  const dContentPolicies = diffRecordMap(ctx.serializedCache.get('contentPolicies'), after.contentPolicies);
  const dPrivacySettings = diffRecordMap(ctx.serializedCache.get('privacySettings'), after.privacySettings);
  const dPrivacyConsents = diffGroupedById(ctx.serializedCache.get('privacyConsents'), after.privacyConsents);
  const dDataRequests = diffGroupedById(ctx.serializedCache.get('dataRequests'), after.dataRequests);
  const dFamilyAudit = diffArrayById(ctx.serializedCache.get('familyAuditEvents'), after.familyAuditEvents);
  const dSecurityLogs = diffArrayById(ctx.serializedCache.get('securityLogs'), after.securityLogs);
  const dAiUsage = diffGroupedById(ctx.serializedCache.get('aiUsageRecords'), after.aiUsageRecords);
  const dAiDaily = diffRecordMap(ctx.serializedCache.get('aiUsageDaily'), after.aiUsageDaily);
  const dGardenEvents = diffGroupedById(ctx.serializedCache.get('gardenRewardEvents'), after.gardenRewardEvents);
  const dCustomLessons = diffArrayById(ctx.serializedCache.get('customLessons'), after.customLessons);
  const dCustomQuestions = diffArrayById(ctx.serializedCache.get('customQuestions'), after.customQuestions);
  const dCheckouts = diffRecordMap(ctx.serializedCache.get('checkoutSessions'), after.checkoutSessions);
  const dExamAttempts = diffRecordMap(ctx.serializedCache.get('examAttempts'), after.examAttempts);
  const dLevel1Attempts = diffRecordMap(ctx.serializedCache.get('level1Attempts'), after.level1Attempts);
  const dLevel2Attempts = diffRecordMap(ctx.serializedCache.get('level2Attempts'), after.level2Attempts);
  const dSmartSessions = diffRecordMap(ctx.serializedCache.get('smartAssessmentSessions'), after.smartAssessmentSessions);
  const dCerts = diffRecordMap(ctx.serializedCache.get('certificates'), after.certificates);
  const dSyncKeys = diffRecordMap(ctx.serializedCache.get('processedSyncKeys'), after.processedSyncKeys);
  const dClasses = diffRecordMap(ctx.serializedCache.get('classes'), after.classes);
  const dTeacherQs = diffRecordMap(ctx.serializedCache.get('teacherQuestions'), after.teacherQuestions);
  const dTeacherExams = diffRecordMap(ctx.serializedCache.get('teacherExams'), after.teacherExams);
  const dExamAssignments = diffRecordMap(ctx.serializedCache.get('examAssignments'), after.examAssignments);
  const dAssignedAttempts = diffRecordMap(ctx.serializedCache.get('assignedExamAttempts'), after.assignedExamAttempts);
  const dHomeworks = diffRecordMap(ctx.serializedCache.get('homeworks'), after.homeworks);
  const dHomeworkSubs = diffRecordMap(ctx.serializedCache.get('homeworkSubmissions'), after.homeworkSubmissions);
  const dHomeworkAtts = diffRecordMap(ctx.serializedCache.get('homeworkAttachments'), after.homeworkAttachments);
  const dImportBatches = diffRecordMap(ctx.serializedCache.get('importBatches'), after.importBatches);
  const dQuranSettings = diffRecordMap(ctx.serializedCache.get('quranChildSettings'), after.quranChildSettings);
  const dQuranSurahProg = diffRecordMap(ctx.serializedCache.get('quranSurahProgress'), after.quranSurahProgress);
  const dQuranStoryProg = diffRecordMap(ctx.serializedCache.get('quranStoryProgress'), after.quranStoryProgress);
  const dQuranMannerProg = diffRecordMap(ctx.serializedCache.get('quranMannerProgress'), after.quranMannerProgress);
  const dQuranEvents = diffArrayById(ctx.serializedCache.get('quranActivityEvents'), after.quranActivityEvents);
  const dQuranVerifications = diffRecordMap(
    ctx.serializedCache.get('quranContentVerifications'),
    after.quranContentVerifications,
  );

  const configChanges: Array<{ key: string; value: unknown; hash: string }> = [];
  for (const [k, val] of [
    ['examConfig', after.examConfig],
    ['featureFlags', after.featureFlags],
    ['level2ProgressionConfig', after.level2ProgressionConfig],
    ['operationalMetrics', after.operationalMetrics],
    ['adminBootstrap', after.adminBootstrap || { initialized: false, secretConsumed: false }],
    ['quranStoryDetails', after.quranStoryDetails || {}],
    ['quranStoryCms', after.quranStoryCms || {}],
  ] as const) {
    const h = stableHashValue(val);
    if (ctx.configHashes.get(k) !== h) {
      configChanges.push({ key: k, value: val, hash: h });
    }
  }

  const hasChanges =
    configChanges.length > 0 ||
    [
      dFamilies,
      dUsers,
      dMemberships,
      dInvitations,
      dDevices,
      dSessions,
      dActionTokens,
      dGateCreds,
      dChildren,
      dChildCreds,
      dArchivedChildren,
      dContentPolicies,
      dPrivacySettings,
      dPrivacyConsents,
      dDataRequests,
      dFamilyAudit,
      dSecurityLogs,
      dAiUsage,
      dAiDaily,
      dGardenEvents,
      dCustomLessons,
      dCustomQuestions,
      dCheckouts,
      dExamAttempts,
      dLevel1Attempts,
      dLevel2Attempts,
      dSmartSessions,
      dCerts,
      dSyncKeys,
      dClasses,
      dTeacherQs,
      dTeacherExams,
      dExamAssignments,
      dAssignedAttempts,
      dHomeworks,
      dHomeworkSubs,
      dHomeworkAtts,
      dImportBatches,
      dQuranSettings,
      dQuranSurahProg,
      dQuranStoryProg,
      dQuranMannerProg,
      dQuranEvents,
      dQuranVerifications,
    ].some((d) => d.upserts.length > 0 || d.deletes.length > 0);

  if (!hasChanges) return;

  const hasQuranChanges = [
    dQuranSettings,
    dQuranSurahProg,
    dQuranStoryProg,
    dQuranMannerProg,
    dQuranEvents,
    dQuranVerifications,
  ].some((d) => d.upserts.length > 0 || d.deletes.length > 0);

  const execCommit = async (tx: PgRunner) => {
    if (hasQuranChanges && ctx.quranSchemaReady === false) {
      const readyNow = await checkQuranTablesReady(tx);
      if (!readyNow) {
        const err = new Error(
          'Quran World tables are pending additive migration 0002_quran_world.sql.',
        ) as Error & { code?: string };
        err.code = 'QURAN_SCHEMA_PENDING';
        throw err;
      }
      ctx.quranSchemaReady = true;
    }
    // DELETES (reverse FK order)
    if (dAssignedAttempts.deletes.length) {
      await tx.delete(schema.assignedExamAttempts).where(inArray(schema.assignedExamAttempts.id, dAssignedAttempts.deletes));
    }
    if (dExamAssignments.deletes.length) {
      await tx.delete(schema.examAssignments).where(inArray(schema.examAssignments.id, dExamAssignments.deletes));
    }
    if (dHomeworkSubs.deletes.length) {
      await tx.delete(schema.homeworkSubmissions).where(inArray(schema.homeworkSubmissions.id, dHomeworkSubs.deletes));
    }
    if (dHomeworkAtts.deletes.length) {
      await tx.delete(schema.homeworkAttachments).where(inArray(schema.homeworkAttachments.id, dHomeworkAtts.deletes));
    }
    if (dImportBatches.deletes.length) {
      await tx.delete(schema.importBatches).where(inArray(schema.importBatches.id, dImportBatches.deletes));
    }
    if (dHomeworks.deletes.length) {
      await tx.delete(schema.homeworks).where(inArray(schema.homeworks.id, dHomeworks.deletes));
    }
    if (dTeacherExams.deletes.length) {
      await tx.delete(schema.teacherExams).where(inArray(schema.teacherExams.id, dTeacherExams.deletes));
    }
    if (dTeacherQs.deletes.length) {
      await tx.delete(schema.teacherQuestions).where(inArray(schema.teacherQuestions.id, dTeacherQs.deletes));
    }
    if (dClasses.deletes.length) {
      await tx.delete(schema.classes).where(inArray(schema.classes.id, dClasses.deletes));
    }
    if (dSyncKeys.deletes.length) {
      await tx.delete(schema.processedSyncKeys).where(inArray(schema.processedSyncKeys.idempotencyKey, dSyncKeys.deletes));
    }
    if (dCerts.deletes.length) {
      await tx.delete(schema.certificates).where(inArray(schema.certificates.uniqueCode, dCerts.deletes));
    }
    if (dSmartSessions.deletes.length) {
      await tx.delete(schema.smartAssessmentSessions).where(inArray(schema.smartAssessmentSessions.id, dSmartSessions.deletes));
    }
    if (dLevel2Attempts.deletes.length) {
      await tx.delete(schema.level2Attempts).where(inArray(schema.level2Attempts.id, dLevel2Attempts.deletes));
    }
    if (dLevel1Attempts.deletes.length) {
      await tx.delete(schema.level1Attempts).where(inArray(schema.level1Attempts.id, dLevel1Attempts.deletes));
    }
    if (dExamAttempts.deletes.length) {
      await tx.delete(schema.examAttempts).where(inArray(schema.examAttempts.id, dExamAttempts.deletes));
    }
    if (dCheckouts.deletes.length) {
      await tx.delete(schema.checkoutSessions).where(inArray(schema.checkoutSessions.id, dCheckouts.deletes));
    }
    if (dCustomQuestions.deletes.length) {
      await tx.delete(schema.customQuestions).where(inArray(schema.customQuestions.id, dCustomQuestions.deletes));
    }
    if (dCustomLessons.deletes.length) {
      await tx.delete(schema.customLessons).where(inArray(schema.customLessons.id, dCustomLessons.deletes));
    }
    if (dGardenEvents.deletes.length) {
      await tx.delete(schema.gardenRewardEvents).where(inArray(schema.gardenRewardEvents.id, dGardenEvents.deletes));
    }
    if (dAiDaily.deletes.length) {
      await tx.delete(schema.aiUsageDaily).where(inArray(schema.aiUsageDaily.usageKey, dAiDaily.deletes));
    }
    if (dAiUsage.deletes.length) {
      await tx.delete(schema.aiUsageRecords).where(inArray(schema.aiUsageRecords.id, dAiUsage.deletes));
    }
    if (dChildCreds.deletes.length) {
      await tx.delete(schema.childCredentials).where(inArray(schema.childCredentials.childId, dChildCreds.deletes));
    }
    if (dArchivedChildren.deletes.length) {
      await tx.delete(schema.archivedChildren).where(inArray(schema.archivedChildren.childId, dArchivedChildren.deletes));
    }
    if (dQuranEvents.deletes.length) {
      await tx.delete(schema.quranActivityEvents).where(inArray(schema.quranActivityEvents.id, dQuranEvents.deletes));
    }
    if (dQuranMannerProg.deletes.length) {
      await tx.delete(schema.quranMannerProgress).where(inArray(schema.quranMannerProgress.id, dQuranMannerProg.deletes));
    }
    if (dQuranStoryProg.deletes.length) {
      await tx.delete(schema.quranStoryProgress).where(inArray(schema.quranStoryProgress.id, dQuranStoryProg.deletes));
    }
    if (dQuranSurahProg.deletes.length) {
      await tx.delete(schema.quranSurahProgress).where(inArray(schema.quranSurahProgress.id, dQuranSurahProg.deletes));
    }
    if (dQuranSettings.deletes.length) {
      await tx.delete(schema.quranChildSettings).where(inArray(schema.quranChildSettings.childId, dQuranSettings.deletes));
    }
    if (dQuranVerifications.deletes.length) {
      await tx.delete(schema.quranContentVerifications).where(inArray(schema.quranContentVerifications.contentKey, dQuranVerifications.deletes));
    }
    if (dChildren.deletes.length) {
      await tx.delete(schema.children).where(inArray(schema.children.id, dChildren.deletes));
    }
    if (dDataRequests.deletes.length) {
      await tx.delete(schema.dataRequests).where(inArray(schema.dataRequests.id, dDataRequests.deletes));
    }
    if (dPrivacyConsents.deletes.length) {
      await tx.delete(schema.privacyConsents).where(inArray(schema.privacyConsents.id, dPrivacyConsents.deletes));
    }
    if (dPrivacySettings.deletes.length) {
      await tx.delete(schema.privacySettings).where(inArray(schema.privacySettings.familyId, dPrivacySettings.deletes));
    }
    if (dContentPolicies.deletes.length) {
      await tx.delete(schema.contentPolicies).where(inArray(schema.contentPolicies.familyId, dContentPolicies.deletes));
    }
    if (dGateCreds.deletes.length) {
      await tx.delete(schema.parentGateCredentials).where(inArray(schema.parentGateCredentials.userId, dGateCreds.deletes));
    }
    if (dActionTokens.deletes.length) {
      await tx.delete(schema.actionTokens).where(inArray(schema.actionTokens.tokenHash, dActionTokens.deletes));
    }
    if (dSessions.deletes.length) {
      await tx.delete(schema.sessions).where(inArray(schema.sessions.tokenHash, dSessions.deletes));
    }
    if (dDevices.deletes.length) {
      await tx.delete(schema.trustedDevices).where(inArray(schema.trustedDevices.id, dDevices.deletes));
    }
    if (dInvitations.deletes.length) {
      await tx.delete(schema.guardianInvitations).where(inArray(schema.guardianInvitations.id, dInvitations.deletes));
    }
    if (dMemberships.deletes.length) {
      await tx.delete(schema.guardianMemberships).where(inArray(schema.guardianMemberships.id, dMemberships.deletes));
    }
    if (dUsers.deletes.length) {
      await tx.delete(schema.users).where(inArray(schema.users.id, dUsers.deletes));
    }
    if (dFamilies.deletes.length) {
      await tx.delete(schema.families).where(inArray(schema.families.id, dFamilies.deletes));
    }

    // UPSERTS (dependency order: families -> users -> memberships/sessions/children -> credentials -> teacher -> logs)
    for (const { value: f } of dFamilies.upserts) {
      await tx
        .insert(schema.families)
        .values({
          id: f.id,
          name: f.name,
          primaryGuardianId: f.primaryGuardianId,
          createdAt: f.createdAt || nowIso,
          updatedAt: f.updatedAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.families.id,
          set: {
            name: f.name,
            primaryGuardianId: f.primaryGuardianId,
            updatedAt: f.updatedAt || nowIso,
          },
        });
    }

    for (const { value: u } of dUsers.upserts) {
      await tx
        .insert(schema.users)
        .values({
          id: u.id,
          email: u.email,
          normalizedEmail: u.normalizedEmail,
          displayName: u.displayName,
          passwordHash: u.passwordHash,
          role: u.role,
          emailVerified: Boolean(u.emailVerified),
          status: u.status,
          phone: u.phone ?? null,
          bio: u.bio ?? null,
          linkedChildId: u.linkedChildId ?? null,
          familyId: u.familyId ?? null,
          teacherProfile: u.teacherProfile ?? null,
          policyVersion: u.policyVersion || '2026.04',
          termsAcceptedAt: u.termsAcceptedAt || nowIso,
          failedLoginAttempts: Number(u.failedLoginAttempts || 0),
          lockedUntil: u.lockedUntil ?? null,
          createdAt: u.createdAt || nowIso,
          updatedAt: u.updatedAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            email: u.email,
            normalizedEmail: u.normalizedEmail,
            displayName: u.displayName,
            passwordHash: u.passwordHash,
            role: u.role,
            emailVerified: Boolean(u.emailVerified),
            status: u.status,
            phone: u.phone ?? null,
            bio: u.bio ?? null,
            linkedChildId: u.linkedChildId ?? null,
            familyId: u.familyId ?? null,
            teacherProfile: u.teacherProfile ?? null,
            policyVersion: u.policyVersion || '2026.04',
            failedLoginAttempts: Number(u.failedLoginAttempts || 0),
            lockedUntil: u.lockedUntil ?? null,
            updatedAt: u.updatedAt || nowIso,
          },
        });
    }

    for (const { value: m } of dMemberships.upserts) {
      await tx
        .insert(schema.guardianMemberships)
        .values({
          id: m.id,
          familyId: m.familyId,
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
          role: m.role,
          permissions: m.permissions || [],
          status: m.status,
          invitedByUserId: m.invitedByUserId ?? null,
          createdAt: m.createdAt || nowIso,
          updatedAt: m.updatedAt || nowIso,
          revokedAt: m.revokedAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.guardianMemberships.id,
          set: {
            displayName: m.displayName,
            email: m.email,
            role: m.role,
            permissions: m.permissions || [],
            status: m.status,
            updatedAt: m.updatedAt || nowIso,
            revokedAt: m.revokedAt ?? null,
          },
        });
    }

    for (const { value: inv } of dInvitations.upserts) {
      await tx
        .insert(schema.guardianInvitations)
        .values({
          id: inv.id,
          familyId: inv.familyId,
          email: inv.email,
          role: inv.role,
          permissions: inv.permissions || [],
          invitedByUserId: inv.invitedByUserId,
          invitedByName: inv.invitedByName,
          status: inv.status,
          tokenHash: inv.tokenHash,
          createdAt: inv.createdAt || nowIso,
          expiresAt: inv.expiresAt,
          acceptedAt: inv.acceptedAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.guardianInvitations.id,
          set: {
            status: inv.status,
            permissions: inv.permissions || [],
            acceptedAt: inv.acceptedAt ?? null,
          },
        });
    }

    for (const { value: d } of dDevices.upserts) {
      await tx
        .insert(schema.trustedDevices)
        .values({
          id: d.id,
          familyId: d.familyId,
          userId: d.userId,
          tokenHash: d.tokenHash,
          deviceName: d.deviceName,
          deviceType: d.deviceType,
          browser: d.browser,
          os: d.os,
          userAgent: d.userAgent || '',
          ip: d.ip || '127.0.0.1',
          trusted: Boolean(d.trusted),
          revoked: Boolean(d.revoked),
          firstRegisteredAt: d.firstRegisteredAt || nowIso,
          lastActiveAt: d.lastActiveAt || nowIso,
          revokedAt: d.revokedAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.trustedDevices.id,
          set: {
            tokenHash: d.tokenHash,
            deviceName: d.deviceName,
            trusted: Boolean(d.trusted),
            revoked: Boolean(d.revoked),
            lastActiveAt: d.lastActiveAt || nowIso,
            revokedAt: d.revokedAt ?? null,
          },
        });
    }

    for (const { value: s } of dSessions.upserts) {
      await tx
        .insert(schema.sessions)
        .values({
          tokenHash: s.tokenHash,
          userId: s.userId,
          csrfToken: s.csrfToken,
          createdAt: s.createdAt,
          lastActiveAt: s.lastActiveAt,
          expiresAt: s.expiresAt,
          ip: s.ip || '127.0.0.1',
          userAgent: s.userAgent || '',
          sessionKind: s.sessionKind ?? null,
          childId: s.childId ?? null,
          familyId: s.familyId ?? null,
          deviceId: s.deviceId ?? null,
          rememberMe: Boolean(s.rememberMe),
          parentGateVerifiedUntil: s.parentGateVerifiedUntil ?? null,
        })
        .onConflictDoUpdate({
          target: schema.sessions.tokenHash,
          set: {
            lastActiveAt: s.lastActiveAt,
            expiresAt: s.expiresAt,
            parentGateVerifiedUntil: s.parentGateVerifiedUntil ?? null,
          },
        });
    }

    for (const { value: t } of dActionTokens.upserts) {
      await tx
        .insert(schema.actionTokens)
        .values({
          tokenHash: t.tokenHash,
          userId: t.userId,
          type: t.type,
          expiresAt: t.expiresAt,
          used: Boolean(t.used),
        })
        .onConflictDoUpdate({
          target: schema.actionTokens.tokenHash,
          set: { used: Boolean(t.used) },
        });
    }

    for (const { value: g } of dGateCreds.upserts) {
      await tx
        .insert(schema.parentGateCredentials)
        .values({
          userId: g.userId,
          familyId: g.familyId,
          pinHash: g.pinHash,
          failedAttempts: Number(g.failedAttempts || 0),
          lockedUntil: g.lockedUntil ?? null,
          createdAt: g.createdAt || nowIso,
          updatedAt: g.updatedAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.parentGateCredentials.userId,
          set: {
            pinHash: g.pinHash,
            failedAttempts: Number(g.failedAttempts || 0),
            lockedUntil: g.lockedUntil ?? null,
            updatedAt: g.updatedAt || nowIso,
          },
        });
    }

    for (const { value: cp } of dContentPolicies.upserts) {
      await tx
        .insert(schema.contentPolicies)
        .values({
          familyId: cp.familyId,
          allowStories: Boolean(cp.allowStories),
          allowSongsAudio: Boolean(cp.allowSongsAudio),
          allowVideos: Boolean(cp.allowVideos),
          allowGamesCreative: Boolean(cp.allowGamesCreative),
          aiCompanionEnabled: Boolean(cp.aiCompanionEnabled),
          voiceInteractionEnabled: Boolean(cp.voiceInteractionEnabled),
          ageStrictMode: Boolean(cp.ageStrictMode),
          allowExternalContent: Boolean(cp.allowExternalContent),
          allowedStoryCategories: cp.allowedStoryCategories || [],
          blockedVideoIds: cp.blockedVideoIds || [],
          allowedVideoIds: cp.allowedVideoIds || [],
          updatedAt: cp.updatedAt || nowIso,
          updatedBy: cp.updatedBy ?? null,
        })
        .onConflictDoUpdate({
          target: schema.contentPolicies.familyId,
          set: {
            allowStories: Boolean(cp.allowStories),
            allowSongsAudio: Boolean(cp.allowSongsAudio),
            allowVideos: Boolean(cp.allowVideos),
            allowGamesCreative: Boolean(cp.allowGamesCreative),
            aiCompanionEnabled: Boolean(cp.aiCompanionEnabled),
            voiceInteractionEnabled: Boolean(cp.voiceInteractionEnabled),
            ageStrictMode: Boolean(cp.ageStrictMode),
            allowExternalContent: Boolean(cp.allowExternalContent),
            allowedStoryCategories: cp.allowedStoryCategories || [],
            blockedVideoIds: cp.blockedVideoIds || [],
            allowedVideoIds: cp.allowedVideoIds || [],
            updatedAt: cp.updatedAt || nowIso,
            updatedBy: cp.updatedBy ?? null,
          },
        });
    }

    for (const { value: ps } of dPrivacySettings.upserts) {
      await tx
        .insert(schema.privacySettings)
        .values({
          familyId: ps.familyId,
          childProfileVisibility: ps.childProfileVisibility || 'private',
          aiFeaturesConsent: Boolean(ps.aiFeaturesConsent),
          voiceInteractionConsent: Boolean(ps.voiceInteractionConsent),
          analyticsConsent: Boolean(ps.analyticsConsent),
          essentialTermsConsent: Boolean(ps.essentialTermsConsent),
          policyVersion: ps.policyVersion || '2026.04',
          updatedAt: ps.updatedAt || nowIso,
          updatedBy: ps.updatedBy ?? null,
        })
        .onConflictDoUpdate({
          target: schema.privacySettings.familyId,
          set: {
            aiFeaturesConsent: Boolean(ps.aiFeaturesConsent),
            voiceInteractionConsent: Boolean(ps.voiceInteractionConsent),
            analyticsConsent: Boolean(ps.analyticsConsent),
            essentialTermsConsent: Boolean(ps.essentialTermsConsent),
            policyVersion: ps.policyVersion || '2026.04',
            updatedAt: ps.updatedAt || nowIso,
            updatedBy: ps.updatedBy ?? null,
          },
        });
    }

    for (const { value: pc } of dPrivacyConsents.upserts) {
      await tx
        .insert(schema.privacyConsents)
        .values({
          id: pc.id,
          familyId: pc.familyId,
          consentKey: pc.consentKey,
          granted: Boolean(pc.granted),
          policyVersion: pc.policyVersion || '2026.04',
          grantedByUserId: pc.grantedByUserId,
          grantedByName: pc.grantedByName,
          grantedAt: pc.grantedAt || nowIso,
          withdrawnAt: pc.withdrawnAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.privacyConsents.id,
          set: {
            granted: Boolean(pc.granted),
            withdrawnAt: pc.withdrawnAt ?? null,
          },
        });
    }

    for (const { value: dr } of dDataRequests.upserts) {
      await tx
        .insert(schema.dataRequests)
        .values({
          id: dr.id,
          familyId: dr.familyId,
          type: dr.type,
          status: dr.status,
          requestedByUserId: dr.requestedByUserId,
          requestedByName: dr.requestedByName,
          note: dr.note ?? null,
          requestedAt: dr.requestedAt || nowIso,
          completedAt: dr.completedAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.dataRequests.id,
          set: {
            status: dr.status,
            note: dr.note ?? null,
            completedAt: dr.completedAt ?? null,
          },
        });
    }

    for (const { value: c } of dChildren.upserts) {
      const childPayload = {
        id: c.id,
        parentId: c.parentId,
        familyId: c.familyId ?? null,
        studentUserId: c.studentUserId ?? null,
        displayName: c.displayName,
        birthYear: Number(c.birthYear || 2023),
        birthMonth: Number(c.birthMonth || 1),
        ageMonths: c.ageMonths ?? null,
        ageGroup: c.ageGroup,
        language: c.language || 'ar',
        interests: c.interests || [],
        companionId: c.companionId || 'nono',
        companionScarfColor: c.companionScarfColor || '#FF9360',
        stars: Math.max(0, Number(c.stars || 0)),
        level: Math.max(1, Number(c.level || 1)),
        completedBaseline: Boolean(c.completedBaseline),
        favoriteWorldId: c.favoriteWorldId ?? null,
        recentActivityId: c.recentActivityId ?? null,
        unlockedWorlds: c.unlockedWorlds || [],
        completedActivityIds: c.completedActivityIds || [],
        unlockedCharacters: c.unlockedCharacters || [],
        unlockedBadges: c.unlockedBadges || [],
        unlockedRoomItems: c.unlockedRoomItems || [],
        placedRoomItems: c.placedRoomItems || [],
        savedDrawings: c.savedDrawings || [],
        certificates: c.certificates || [],
        skillProgress: c.skillProgress || ({} as any),
        conceptMastery: c.conceptMastery ?? null,
        level1Progress: c.level1Progress ?? null,
        level2Progress: c.level2Progress ?? null,
        level2Unlocked: Boolean(c.level2Unlocked),
        completedDeepLessons: c.completedDeepLessons ?? null,
        examHistory: c.examHistory ?? null,
        characterOutfits: c.characterOutfits ?? null,
        unlockedFunRewards: c.unlockedFunRewards ?? null,
        attempts: c.attempts || [],
        assessmentHistory: c.assessmentHistory || [],
        completedStoryIds: c.completedStoryIds || [],
        completedMissionsToday: c.completedMissionsToday || [],
        totalLearningMinutes: Number(c.totalLearningMinutes || 0),
        downloadedWorldIds: c.downloadedWorldIds || [],
        avatarConfig: c.avatarConfig ?? null,
        roomConfig: c.roomConfig ?? null,
        petState: c.petState ?? null,
        completedLabIds: c.completedLabIds ?? null,
        labHistory: c.labHistory ?? null,
        customStories: c.customStories ?? null,
        creativeProjects: c.creativeProjects ?? null,
        ownedShopItemIds: c.ownedShopItemIds ?? null,
        rewardTransactions: c.rewardTransactions ?? null,
        claimedMissionsDate: c.claimedMissionsDate ?? null,
        claimedMissionIdsToday: c.claimedMissionIdsToday ?? null,
        learningStreakDays: Number(c.learningStreakDays || 0),
        activeDaysHistory: c.activeDaysHistory ?? null,
        monthlySnapshots: c.monthlySnapshots ?? null,
        parentSchedule: c.parentSchedule ?? null,
        nextMonthPlan: c.nextMonthPlan ?? null,
        activityTimeline: c.activityTimeline ?? null,
        aiAssistantEnabled: c.aiAssistantEnabled ?? true,
        readingStageProgress: c.readingStageProgress ?? null,
        familyActivitiesCompleted: c.familyActivitiesCompleted ?? null,
        musicCompositions: c.musicCompositions ?? null,
        buildConstructions: c.buildConstructions ?? null,
        completedDiscoveryThemes: c.completedDiscoveryThemes ?? null,
        completedRecipes: c.completedRecipes ?? null,
        completedTheaterScenes: c.completedTheaterScenes ?? null,
        learningGarden: c.learningGarden ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const { id: _cid, createdAt: _ca, ...updateSet } = childPayload;
      await tx
        .insert(schema.children)
        .values(childPayload)
        .onConflictDoUpdate({
          target: schema.children.id,
          set: updateSet,
        });
    }

    for (const { value: ac } of dArchivedChildren.upserts) {
      await tx
        .insert(schema.archivedChildren)
        .values({
          childId: ac.childId,
          familyId: ac.familyId,
          parentId: ac.parentId,
          displayName: ac.displayName,
          deletedByUserId: ac.deletedByUserId,
          deletedAt: ac.deletedAt,
          reason: ac.reason ?? null,
        })
        .onConflictDoNothing();
    }

    for (const { value: cc } of dChildCreds.upserts) {
      await tx
        .insert(schema.childCredentials)
        .values({
          childId: cc.childId,
          familyId: cc.familyId,
          accessCodeHash: cc.accessCodeHash,
          accessCodeEncrypted: cc.accessCodeEncrypted,
          accessCodeLast4: cc.accessCodeLast4,
          pinHash: cc.pinHash,
          failedAttempts: Number(cc.failedAttempts || 0),
          lockedUntil: cc.lockedUntil ?? null,
          createdAt: cc.createdAt || nowIso,
          updatedAt: cc.updatedAt || nowIso,
          rotatedAt: cc.rotatedAt ?? null,
          lastLoginAt: cc.lastLoginAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.childCredentials.childId,
          set: {
            accessCodeHash: cc.accessCodeHash,
            accessCodeEncrypted: cc.accessCodeEncrypted,
            accessCodeLast4: cc.accessCodeLast4,
            pinHash: cc.pinHash,
            failedAttempts: Number(cc.failedAttempts || 0),
            lockedUntil: cc.lockedUntil ?? null,
            updatedAt: cc.updatedAt || nowIso,
            rotatedAt: cc.rotatedAt ?? null,
            lastLoginAt: cc.lastLoginAt ?? null,
          },
        });
    }

    for (const { value: a } of dAiUsage.upserts) {
      await tx
        .insert(schema.aiUsageRecords)
        .values({
          id: a.id,
          childId: a.childId,
          familyId: a.familyId ?? null,
          actorId: a.actorId ?? null,
          mode: a.mode,
          language: a.language,
          topic: a.topic ?? null,
          blocked: Boolean(a.blocked),
          voiceUsed: Boolean(a.voiceUsed),
          createdAt: a.createdAt || nowIso,
        })
        .onConflictDoNothing();
    }

    for (const { key: usageKey, value: cnt } of dAiDaily.upserts) {
      await tx
        .insert(schema.aiUsageDaily)
        .values({ usageKey, count: Number(cnt || 0), updatedAt: nowIso })
        .onConflictDoUpdate({
          target: schema.aiUsageDaily.usageKey,
          set: { count: Number(cnt || 0), updatedAt: nowIso },
        });
    }

    for (const { value: gr } of dGardenEvents.upserts) {
      await tx
        .insert(schema.gardenRewardEvents)
        .values({
          id: gr.id,
          childId: gr.childId,
          milestoneKey: gr.milestoneKey,
          itemUnlockedId: gr.itemUnlockedId,
          reason: gr.reason,
          awardedAt: gr.awardedAt || nowIso,
        })
        .onConflictDoNothing();
    }

    for (const { value: cl } of dCustomLessons.upserts) {
      await tx
        .insert(schema.customLessons)
        .values({
          id: cl.id,
          domain: cl.domain,
          title: cl.title,
          summary: cl.summary,
          ageGroups: cl.ageGroups,
          recommendedAgeRange: cl.recommendedAgeRange ?? null,
          targetSymbol: cl.targetSymbol,
          colorHex: cl.colorHex ?? null,
          imageUrl: cl.imageUrl ?? null,
          audioUrl: cl.audioUrl ?? null,
          examples: cl.examples || [],
          level: cl.level ?? null,
          subject: cl.subject ?? null,
          published: Boolean(cl.published),
          updatedAt: cl.updatedAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.customLessons.id,
          set: {
            title: cl.title,
            summary: cl.summary,
            ageGroups: cl.ageGroups,
            recommendedAgeRange: cl.recommendedAgeRange ?? null,
            targetSymbol: cl.targetSymbol,
            colorHex: cl.colorHex ?? null,
            published: Boolean(cl.published),
            updatedAt: cl.updatedAt || nowIso,
          },
        });
    }

    for (const { value: cq } of dCustomQuestions.upserts) {
      await tx
        .insert(schema.customQuestions)
        .values({
          id: cq.id,
          subject: cq.subject,
          ageGroups: cq.ageGroups,
          recommendedAgeRange: cq.recommendedAgeRange ?? null,
          type: cq.type,
          difficulty: Number(cq.difficulty),
          lessonRefId: cq.lessonRefId,
          lessonTitle: cq.lessonTitle,
          prompt: cq.prompt,
          audioText: cq.audioText ?? null,
          audioLang: cq.audioLang ?? null,
          visualCue: cq.visualCue ?? null,
          options: cq.options,
          correctOptionId: cq.correctOptionId,
          explanation: cq.explanation,
          published: cq.published ?? true,
        })
        .onConflictDoUpdate({
          target: schema.customQuestions.id,
          set: {
            prompt: cq.prompt,
            options: cq.options,
            correctOptionId: cq.correctOptionId,
            explanation: cq.explanation,
            published: cq.published ?? true,
          },
        });
    }

    for (const { value: cs } of dCheckouts.upserts) {
      await tx
        .insert(schema.checkoutSessions)
        .values({
          id: cs.id,
          childId: cs.childId,
          parentId: cs.parentId ?? null,
          subject: cs.subject,
          amountEgp: Number(cs.amountEgp),
          status: cs.status,
          paymentToken: cs.paymentToken ?? null,
          tokenConsumed: Boolean(cs.tokenConsumed),
          createdAt: cs.createdAt || nowIso,
          verifiedAt: cs.verifiedAt ?? null,
        })
        .onConflictDoUpdate({
          target: schema.checkoutSessions.id,
          set: {
            status: cs.status,
            paymentToken: cs.paymentToken ?? null,
            tokenConsumed: Boolean(cs.tokenConsumed),
            verifiedAt: cs.verifiedAt ?? null,
          },
        });
    }

    for (const { value: ea } of dExamAttempts.upserts) {
      await tx
        .insert(schema.examAttempts)
        .values({
          id: ea.id,
          childId: ea.childId,
          parentId: ea.parentId ?? null,
          childName: ea.childName,
          ageGroup: ea.ageGroup,
          subject: ea.subject,
          mode: ea.mode,
          questionIds: ea.questionIds,
          paymentVerified: Boolean(ea.paymentVerified),
          amountPaidEgp: Number(ea.amountPaidEgp),
          passingPercentage: Number(ea.passingPercentage),
          submitted: Boolean(ea.submitted),
          summary: ea.summary ?? null,
          certificateCode: ea.certificateCode ?? null,
          createdAt: ea.createdAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.examAttempts.id,
          set: {
            submitted: Boolean(ea.submitted),
            summary: ea.summary ?? null,
            certificateCode: ea.certificateCode ?? null,
          },
        });
    }

    for (const { value: la } of dLevel1Attempts.upserts) {
      await tx
        .insert(schema.level1Attempts)
        .values({
          id: la.id,
          childId: la.childId,
          parentId: la.parentId ?? null,
          lessonId: la.lessonId,
          questionIds: la.questionIds,
          submitted: Boolean(la.submitted),
          result: la.result ?? null,
          createdAt: la.createdAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.level1Attempts.id,
          set: { submitted: Boolean(la.submitted), result: la.result ?? null },
        });
    }

    for (const { value: la } of dLevel2Attempts.upserts) {
      await tx
        .insert(schema.level2Attempts)
        .values({
          id: la.id,
          childId: la.childId,
          parentId: la.parentId ?? null,
          lessonId: la.lessonId,
          questionIds: la.questionIds,
          submitted: Boolean(la.submitted),
          result: la.result ?? null,
          createdAt: la.createdAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.level2Attempts.id,
          set: { submitted: Boolean(la.submitted), result: la.result ?? null },
        });
    }

    for (const { value: sa } of dSmartSessions.upserts) {
      await tx
        .insert(schema.smartAssessmentSessions)
        .values({
          id: sa.id,
          childId: sa.childId,
          parentId: sa.parentId ?? null,
          ageGroup: sa.ageGroup,
          difficultyTier: sa.difficultyTier,
          totalQuestions: Number(sa.totalQuestions),
          askedQuestionIds: sa.askedQuestionIds || [],
          results: sa.results || [],
          streak: Number(sa.streak || 0),
          consecutiveMistakes: Number(sa.consecutiveMistakes || 0),
          hintsUsed: Number(sa.hintsUsed || 0),
          finished: Boolean(sa.finished),
          createdAt: sa.createdAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.smartAssessmentSessions.id,
          set: {
            difficultyTier: sa.difficultyTier,
            askedQuestionIds: sa.askedQuestionIds || [],
            results: sa.results || [],
            streak: Number(sa.streak || 0),
            consecutiveMistakes: Number(sa.consecutiveMistakes || 0),
            hintsUsed: Number(sa.hintsUsed || 0),
            finished: Boolean(sa.finished),
          },
        });
    }

    for (const { value: cert } of dCerts.upserts) {
      await tx
        .insert(schema.certificates)
        .values({
          uniqueCode: cert.uniqueCode,
          id: cert.id,
          childName: cert.childName,
          worldId: cert.worldId,
          worldName: cert.worldName,
          achievementTitle: cert.achievementTitle,
          issuedAt: cert.issuedAt,
          levelCompleted: Number(cert.levelCompleted || 1),
          isOfficialExam: cert.isOfficialExam ?? null,
          examSubject: cert.examSubject ?? null,
          score: cert.score ?? null,
          totalQuestions: cert.totalQuestions ?? null,
          percentage: cert.percentage ?? null,
          passingPercentage: cert.passingPercentage ?? null,
          ageGroup: cert.ageGroup ?? null,
          verificationUrl: cert.verificationUrl ?? null,
          revoked: Boolean(cert.revoked),
        })
        .onConflictDoUpdate({
          target: schema.certificates.uniqueCode,
          set: { revoked: Boolean(cert.revoked) },
        });
    }

    for (const { key: idempotencyKey, value: sv } of dSyncKeys.upserts) {
      await tx
        .insert(schema.processedSyncKeys)
        .values({
          idempotencyKey,
          childId: sv.childId,
          processedAt: sv.processedAt,
          summary: sv.summary,
        })
        .onConflictDoNothing();
    }

    for (const { value: cls } of dClasses.upserts) {
      await tx
        .insert(schema.classes)
        .values({
          id: cls.id,
          name: cls.name,
          subject: cls.subject,
          level: String(cls.level),
          description: cls.description ?? null,
          ageGroup: cls.ageGroup ?? null,
          recommendedAgeRange: cls.recommendedAgeRange ?? null,
          teacherId: cls.teacherId,
          studentIds: cls.studentIds || [],
          active: Boolean(cls.active),
          createdAt: cls.createdAt || nowIso,
          updatedAt: cls.updatedAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.classes.id,
          set: {
            name: cls.name,
            subject: cls.subject,
            level: String(cls.level),
            description: cls.description ?? null,
            teacherId: cls.teacherId,
            studentIds: cls.studentIds || [],
            active: Boolean(cls.active),
            updatedAt: cls.updatedAt || nowIso,
          },
        });
    }

    for (const { value: tq } of dTeacherQs.upserts) {
      const payload = {
        id: tq.id,
        teacherId: tq.teacherId,
        subject: tq.subject,
        level: Number(tq.level),
        lessonId: tq.lessonId,
        questionType: tq.questionType,
        promptAr: tq.promptAr,
        promptEn: tq.promptEn,
        imageUrl: tq.imageUrl ?? null,
        audioUrl: tq.audioUrl ?? null,
        audioText: tq.audioText ?? null,
        options: tq.options || [],
        correctOptionId: tq.correctOptionId ?? null,
        correctOptionIds: tq.correctOptionIds ?? null,
        allowMultipleCorrect: tq.allowMultipleCorrect ?? null,
        matchingPairs: tq.matchingPairs ?? null,
        correctOrder: tq.correctOrder ?? null,
        acceptedAnswers: tq.acceptedAnswers ?? null,
        marks: Number(tq.marks),
        difficulty: tq.difficulty,
        recommendedAgeRange: tq.recommendedAgeRange ?? null,
        explanation: tq.explanation,
        feedbackCorrect: tq.feedbackCorrect,
        feedbackIncorrect: tq.feedbackIncorrect,
        active: Boolean(tq.active),
        approvalStatus: tq.approvalStatus ?? null,
        adminFeedback: tq.adminFeedback ?? null,
        reviewedBy: tq.reviewedBy ?? null,
        reviewedAt: tq.reviewedAt ?? null,
        qualityFlags: tq.qualityFlags ?? null,
        version: Number(tq.version || 1),
        versions: tq.versions ?? null,
        createdAt: tq.createdAt || nowIso,
        updatedAt: tq.updatedAt || nowIso,
      };
      const { id: _id, createdAt: _ca, ...updateSet } = payload;
      await tx.insert(schema.teacherQuestions).values(payload).onConflictDoUpdate({
        target: schema.teacherQuestions.id,
        set: updateSet,
      });
    }

    for (const { value: te } of dTeacherExams.upserts) {
      const payload = {
        id: te.id,
        teacherId: te.teacherId,
        title: te.title,
        description: te.description,
        subject: te.subject,
        level: Number(te.level),
        ageGroup: te.ageGroup,
        recommendedAgeRange: te.recommendedAgeRange ?? null,
        lessonIds: te.lessonIds || [],
        questionIds: te.questionIds || [],
        questionSnapshots: te.questionSnapshots ?? null,
        totalQuestions: Number(te.totalQuestions),
        totalMarks: Number(te.totalMarks),
        passingPercentage: Number(te.passingPercentage),
        durationMinutes: Number(te.durationMinutes),
        startDate: te.startDate,
        endDate: te.endDate,
        allowedAttempts: Number(te.allowedAttempts),
        randomizeQuestions: Boolean(te.randomizeQuestions),
        randomizeAnswers: Boolean(te.randomizeAnswers),
        showResults: Boolean(te.showResults),
        showCorrectAnswers: Boolean(te.showCorrectAnswers),
        status: te.status,
        adminReviewNote: te.adminReviewNote ?? null,
        reviewedBy: te.reviewedBy ?? null,
        reviewedAt: te.reviewedAt ?? null,
        version: Number(te.version || 1),
        versions: te.versions ?? null,
        createdAt: te.createdAt || nowIso,
        updatedAt: te.updatedAt || nowIso,
      };
      const { id: _id, createdAt: _ca, ...updateSet } = payload;
      await tx.insert(schema.teacherExams).values(payload).onConflictDoUpdate({
        target: schema.teacherExams.id,
        set: updateSet,
      });
    }

    for (const { value: hw } of dHomeworks.upserts) {
      const payload = {
        id: hw.id,
        teacherId: hw.teacherId,
        title: hw.title,
        instructions: hw.instructions,
        subject: hw.subject,
        level: Number(hw.level),
        recommendedAgeRange: hw.recommendedAgeRange ?? null,
        lessonIds: hw.lessonIds || [],
        homeworkType: hw.homeworkType,
        questionIds: hw.questionIds || [],
        questionSnapshots: hw.questionSnapshots ?? null,
        attachments: hw.attachments || [],
        assignedClassIds: hw.assignedClassIds || [],
        assignedStudentIds: hw.assignedStudentIds || [],
        startDate: hw.startDate,
        deadline: hw.deadline,
        maxAttempts: Number(hw.maxAttempts),
        passingPercentage: Number(hw.passingPercentage),
        status: hw.status,
        adminFeedback: hw.adminFeedback ?? null,
        reviewedBy: hw.reviewedBy ?? null,
        reviewedAt: hw.reviewedAt ?? null,
        version: Number(hw.version || 1),
        versions: hw.versions ?? null,
        createdAt: hw.createdAt || nowIso,
        updatedAt: hw.updatedAt || nowIso,
      };
      const { id: _id, createdAt: _ca, ...updateSet } = payload;
      await tx.insert(schema.homeworks).values(payload).onConflictDoUpdate({
        target: schema.homeworks.id,
        set: updateSet,
      });
    }

    for (const { value: ha } of dHomeworkAtts.upserts) {
      await tx
        .insert(schema.homeworkAttachments)
        .values({
          id: ha.id,
          fileName: ha.fileName,
          mimeType: ha.mimeType,
          sizeBytes: Number(ha.sizeBytes),
          kind: ha.kind,
          url: ha.url,
          storedPath: ha.storedPath,
          uploadedBy: ha.uploadedBy,
          uploadedAt: ha.uploadedAt,
        })
        .onConflictDoNothing();
    }

    for (const { value: ib } of dImportBatches.upserts) {
      await tx
        .insert(schema.importBatches)
        .values({
          id: ib.id,
          teacherId: ib.teacherId,
          fileName: ib.fileName,
          format: ib.format,
          storedUploadPath: ib.storedUploadPath,
          validRows: ib.validRows || [],
          invalidRows: ib.invalidRows || [],
          committed: Boolean(ib.committed),
          createdAt: ib.createdAt || nowIso,
          expiresAt: Number(ib.expiresAt),
        })
        .onConflictDoUpdate({
          target: schema.importBatches.id,
          set: { committed: Boolean(ib.committed) },
        });
    }

    for (const { value: ea } of dExamAssignments.upserts) {
      await tx
        .insert(schema.examAssignments)
        .values({
          id: ea.id,
          examId: ea.examId,
          studentId: ea.studentId,
          teacherId: ea.teacherId,
          classId: ea.classId ?? null,
          assignedAt: ea.assignedAt,
          availableStartDate: ea.availableStartDate,
          deadline: ea.deadline,
          extendedDeadline: ea.extendedDeadline ?? null,
          status: ea.status,
        })
        .onConflictDoUpdate({
          target: schema.examAssignments.id,
          set: {
            extendedDeadline: ea.extendedDeadline ?? null,
            status: ea.status,
          },
        });
    }

    for (const { value: hs } of dHomeworkSubs.upserts) {
      const payload = {
        id: hs.id,
        assignmentId: hs.assignmentId,
        homeworkVersion: Number(hs.homeworkVersion),
        studentId: hs.studentId,
        teacherId: hs.teacherId,
        openedAt: hs.openedAt ?? null,
        startedAt: hs.startedAt ?? null,
        submittedAt: hs.submittedAt ?? null,
        completedAt: hs.completedAt ?? null,
        attemptCount: Number(hs.attemptCount || 0),
        extendedDeadline: hs.extendedDeadline ?? null,
        extensionReason: hs.extensionReason ?? null,
        status: hs.status,
        answers: hs.answers || {},
        textResponse: hs.textResponse ?? null,
        score: hs.score ?? null,
        totalMarks: hs.totalMarks ?? null,
        percentage: hs.percentage ?? null,
        passed: hs.passed ?? null,
        teacherFeedback: hs.teacherFeedback ?? null,
        gradedAt: hs.gradedAt ?? null,
        review: hs.review ?? null,
      };
      const { id: _id, ...updateSet } = payload;
      await tx.insert(schema.homeworkSubmissions).values(payload).onConflictDoUpdate({
        target: schema.homeworkSubmissions.id,
        set: updateSet,
      });
    }

    for (const { value: aa } of dAssignedAttempts.upserts) {
      const payload = {
        id: aa.id,
        assignmentId: aa.assignmentId,
        examId: aa.examId,
        studentId: aa.studentId,
        teacherId: aa.teacherId,
        attemptNumber: Number(aa.attemptNumber),
        questionIds: aa.questionIds || [],
        optionOrderMap: aa.optionOrderMap || {},
        answers: aa.answers || {},
        status: aa.status,
        score: aa.score ?? null,
        totalMarks: aa.totalMarks ?? null,
        percentage: aa.percentage ?? null,
        passed: aa.passed ?? null,
        startedAt: aa.startedAt,
        submittedAt: aa.submittedAt ?? null,
        review: aa.review ?? null,
      };
      const { id: _id, ...updateSet } = payload;
      await tx.insert(schema.assignedExamAttempts).values(payload).onConflictDoUpdate({
        target: schema.assignedExamAttempts.id,
        set: updateSet,
      });
    }

    for (const { value: ev } of dFamilyAudit.upserts) {
      await tx
        .insert(schema.familyAuditEvents)
        .values({
          id: ev.id,
          familyId: ev.familyId,
          category: ev.category,
          actionType: ev.actionType,
          actorId: ev.actorId ?? null,
          actorName: ev.actorName ?? null,
          actorRole: ev.actorRole ?? null,
          childId: ev.childId ?? null,
          childName: ev.childName ?? null,
          deviceId: ev.deviceId ?? null,
          severity: ev.severity ?? null,
          title: ev.title,
          description: ev.description,
          metadata: ev.metadata ?? null,
          ip: ev.ip ?? null,
          createdAt: ev.createdAt || nowIso,
        })
        .onConflictDoNothing();
    }

    for (const { value: sl } of dSecurityLogs.upserts) {
      await tx
        .insert(schema.securityLogs)
        .values({
          id: sl.id,
          eventType: sl.eventType,
          familyId: sl.familyId ?? null,
          actorId: sl.actorId ?? null,
          actorRole: sl.actorRole ?? null,
          role: sl.role ?? null,
          actionType: sl.actionType ?? null,
          recordType: sl.recordType ?? null,
          recordId: sl.recordId ?? null,
          previousValue: sl.previousValue ?? null,
          newValue: sl.newValue ?? null,
          reason: sl.reason ?? null,
          outcome: sl.outcome ?? null,
          ip: sl.ip ?? null,
          summary: sl.summary,
          createdAt: sl.createdAt || nowIso,
        })
        .onConflictDoNothing();
    }

    for (const cfg of configChanges) {
      await tx
        .insert(schema.appConfigs)
        .values({ key: cfg.key, value: cfg.value as any, updatedAt: nowIso })
        .onConflictDoUpdate({
          target: schema.appConfigs.key,
          set: { value: cfg.value as any, updatedAt: nowIso },
        });
    }

    for (const { value: qs } of dQuranSettings.upserts) {
      const payload = {
        childId: qs.childId,
        enabled: Boolean(qs.enabled),
        allowedSurahIds: qs.allowedSurahIds || [],
        surahOrder: qs.surahOrder || [],
        preferredReciterId: qs.preferredReciterId || 'adult-husary-muallim',
        preferChildReciterFallback: Boolean(qs.preferChildReciterFallback),
        repeatCount: Number(qs.repeatCount || 2),
        listenOnlyMode: Boolean(qs.listenOnlyMode),
        dailyMaxMinutes: Number(qs.dailyMaxMinutes || 15),
        gentleReminderEnabled: Boolean(qs.gentleReminderEnabled),
        updatedByUserId: qs.updatedByUserId ?? null,
        updatedAt: qs.updatedAt || nowIso,
      };
      const { childId: _qcid, ...updateSet } = payload;
      await tx
        .insert(schema.quranChildSettings)
        .values(payload)
        .onConflictDoUpdate({ target: schema.quranChildSettings.childId, set: updateSet });
    }

    for (const { value: qp } of dQuranSurahProg.upserts) {
      const payload = {
        id: qp.id,
        childId: qp.childId,
        surahId: qp.surahId,
        listenCount: Number(qp.listenCount || 0),
        repeatSessionsCount: Number(qp.repeatSessionsCount || 0),
        ayahsPracticed: qp.ayahsPracticed || [],
        status: qp.status || 'not_started',
        parentConfirmedMemorization: Boolean(qp.parentConfirmedMemorization),
        parentConfirmedAt: qp.parentConfirmedAt ?? null,
        parentConfirmedByUserId: qp.parentConfirmedByUserId ?? null,
        parentNote: qp.parentNote ?? null,
        lastListenedAt: qp.lastListenedAt ?? null,
        updatedAt: qp.updatedAt || nowIso,
      };
      const { id: _qid, ...updateSet } = payload;
      await tx
        .insert(schema.quranSurahProgress)
        .values(payload)
        .onConflictDoUpdate({ target: schema.quranSurahProgress.id, set: updateSet });
    }

    for (const { value: qst } of dQuranStoryProg.upserts) {
      await tx
        .insert(schema.quranStoryProgress)
        .values({
          id: qst.id,
          childId: qst.childId,
          storyId: qst.storyId,
          completedCount: Number(qst.completedCount || 0),
          lastReadAt: qst.lastReadAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.quranStoryProgress.id,
          set: {
            completedCount: Number(qst.completedCount || 0),
            lastReadAt: qst.lastReadAt || nowIso,
          },
        });
    }

    for (const { value: qm } of dQuranMannerProg.upserts) {
      await tx
        .insert(schema.quranMannerProgress)
        .values({
          id: qm.id,
          childId: qm.childId,
          mannerId: qm.mannerId,
          practicedCount: Number(qm.practicedCount || 0),
          lastPracticedAt: qm.lastPracticedAt || nowIso,
        })
        .onConflictDoUpdate({
          target: schema.quranMannerProgress.id,
          set: {
            practicedCount: Number(qm.practicedCount || 0),
            lastPracticedAt: qm.lastPracticedAt || nowIso,
          },
        });
    }

    for (const { value: qe } of dQuranEvents.upserts) {
      await tx
        .insert(schema.quranActivityEvents)
        .values({
          id: qe.id,
          childId: qe.childId,
          eventType: qe.eventType,
          targetId: qe.targetId,
          durationSeconds: Number(qe.durationSeconds || 0),
          ayahCount: Number(qe.ayahCount || 0),
          reciterId: qe.reciterId ?? null,
          recordedByUserId: qe.recordedByUserId ?? null,
          occurredAt: qe.occurredAt || nowIso,
        })
        .onConflictDoNothing();
    }

    for (const { value: qv } of dQuranVerifications.upserts) {
      const packedAudioJson: Record<string, unknown> = {
        ...(qv.audioUrlsJson || {}),
      };
      if (qv.ayahAudioUrlsJson && Object.keys(qv.ayahAudioUrlsJson).length > 0) {
        packedAudioJson._ayahAudioUrls = qv.ayahAudioUrlsJson;
      }
      if (qv.surahChecklist && Object.keys(qv.surahChecklist).length > 0) {
        packedAudioJson._surahChecklist = qv.surahChecklist;
      }
      if (qv.adminConfirmations) {
        packedAudioJson._adminConfirmations = qv.adminConfirmations;
      }
      if (qv.sourceVerification) {
        packedAudioJson._sourceVerification = qv.sourceVerification;
      }
      if (qv.basmalaCandidateProbe) {
        packedAudioJson._basmalaCandidateProbe = qv.basmalaCandidateProbe;
      }
      if (
        qv.textIntegrityConfirmed !== undefined ||
        qv.audioIntegrityConfirmed !== undefined ||
        qv.reciterIdentityConfirmed !== undefined ||
        qv.tajweedListeningConfirmed !== undefined ||
        qv.licenseTermsConfirmed !== undefined ||
        qv.licenseConfirmedBy ||
        qv.licenseConfirmedAt
      ) {
        packedAudioJson._confirmations = {
          ...(qv.textIntegrityConfirmed !== undefined ? { textIntegrityConfirmed: qv.textIntegrityConfirmed } : {}),
          ...(qv.audioIntegrityConfirmed !== undefined ? { audioIntegrityConfirmed: qv.audioIntegrityConfirmed } : {}),
          ...(qv.reciterIdentityConfirmed !== undefined ? { reciterIdentityConfirmed: qv.reciterIdentityConfirmed } : {}),
          ...(qv.tajweedListeningConfirmed !== undefined ? { tajweedListeningConfirmed: qv.tajweedListeningConfirmed } : {}),
          ...(qv.licenseTermsConfirmed !== undefined ? { licenseTermsConfirmed: qv.licenseTermsConfirmed } : {}),
          ...(qv.licenseConfirmedBy ? { licenseConfirmedBy: qv.licenseConfirmedBy } : {}),
          ...(qv.licenseConfirmedAt ? { licenseConfirmedAt: qv.licenseConfirmedAt } : {}),
        };
      }
      const serializedAudioUrlsJson =
        Object.keys(packedAudioJson).length > 0
          ? (packedAudioJson as unknown as Record<string, string>)
          : null;

      const payload = {
        id: qv.id,
        contentType: qv.contentType,
        contentKey: qv.contentKey,
        sourceName: qv.sourceName,
        licenseOrPermission: qv.licenseOrPermission,
        tajweedReviewedBy: qv.tajweedReviewedBy ?? null,
        tajweedReviewedAt: qv.tajweedReviewedAt ?? null,
        verificationStatus: qv.verificationStatus,
        audioUrlsJson: serializedAudioUrlsJson,
        notes: qv.notes ?? null,
        updatedByUserId: qv.updatedByUserId ?? null,
        updatedAt: qv.updatedAt || nowIso,
      };
      const { id: _qvid, contentKey: _qvck, ...updateSet } = payload;
      await tx
        .insert(schema.quranContentVerifications)
        .values(payload)
        .onConflictDoUpdate({ target: schema.quranContentVerifications.contentKey, set: updateSet });
    }
  };

  if (txRunner) {
    await execCommit(txRunner);
  } else {
    await pgDb.transaction(async (tx) => {
      await execCommit(tx);
    });
  }

  // Refresh context cache so subsequent saveDb calls in the same request only diff new changes
  const nextCaches = buildContextCaches(after);
  ctx.serializedCache = nextCaches.serializedCache;
  ctx.configHashes = nextCaches.configHashes;
}

export function runWithPgRequestContext<T>(ctx: PgRequestContext, fn: () => T): T {
  return pgRequestAls.run(ctx, fn);
}

export function getPgContextDb(): ServerDb {
  const ctx = pgRequestAls.getStore();
  if (!ctx) {
    throw new Error('PostgreSQL request context is not initialized for this operation.');
  }
  return ctx.db;
}

export function setPgContextDb(next: ServerDb): void {
  const ctx = pgRequestAls.getStore();
  if (!ctx) {
    throw new Error('PostgreSQL request context is not initialized.');
  }
  ctx.db = next;
}

export function enqueuePgContextSave(nextDb: ServerDb): void {
  const ctx = pgRequestAls.getStore();
  if (!ctx) {
    throw new Error('PostgreSQL request context is not initialized.');
  }
  ctx.db = nextDb;
  if (ctx.inTransaction) {
    return;
  }
  const prev = ctx.pendingCommit || Promise.resolve();
  ctx.pendingCommit = prev.then(() => commitServerDbDiffPg(ctx, ctx.db));
}

export function getActivePgContext(): PgRequestContext | undefined {
  return pgRequestAls.getStore();
}

export async function runWithPgDbLock<T>(
  lockKey: string,
  fn: (lockedDb: ServerDb, tx: PgRunner) => Promise<T>,
): Promise<T> {
  const outerCtx = pgRequestAls.getStore();
  if (outerCtx?.pendingCommit) {
    await outerCtx.pendingCommit.catch(() => undefined);
    outerCtx.pendingCommit = null;
  }
  if (allowDevInMemoryFallback()) {
    const run = inMemoryLockChain.then(async () => {
      const freshSnapshot = structuredClone(getInMemoryDb());
      ensureFamilyCollections(freshSnapshot);
      const freshCtx: PgRequestContext = {
        db: freshSnapshot,
        serializedCache: new Map(),
        configHashes: new Map(),
        pendingCommit: null,
        inTransaction: true,
      };
      const result = await pgRequestAls.run(freshCtx, () => fn(freshCtx.db, pgDb as PgRunner));
      ensureFamilyCollections(freshCtx.db);
      inMemoryDb = structuredClone(freshCtx.db);
      if (outerCtx) {
        outerCtx.db = freshCtx.db;
        outerCtx.pendingCommit = null;
      }
      return result;
    });
    inMemoryLockChain = run.catch(() => undefined);
    return run;
  }
  assertPgConfiguredOrThrow();
  return pgDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const freshCtx = await loadServerDbSnapshotPg(tx);
    freshCtx.inTransaction = true;
    const result = await pgRequestAls.run(freshCtx, () => fn(freshCtx.db, tx));
    await commitServerDbDiffPg(freshCtx, freshCtx.db, tx);
    if (outerCtx) {
      outerCtx.db = freshCtx.db;
      outerCtx.serializedCache = freshCtx.serializedCache;
      outerCtx.configHashes = freshCtx.configHashes;
      outerCtx.quranSchemaReady = freshCtx.quranSchemaReady;
      outerCtx.pendingCommit = null;
    }
    return result;
  });
}

export async function recordOperationalErrorPg(metrics: OperationalMetrics): Promise<void> {
  if (allowDevInMemoryFallback()) {
    getInMemoryDb().operationalMetrics = structuredClone(metrics);
    return;
  }
  if (!isPgConfigured()) {
    return;
  }
  try {
    await pgDb
      .insert(schema.appConfigs)
      .values({ key: 'operationalMetrics', value: metrics as any, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.appConfigs.key,
        set: { value: metrics as any, updatedAt: new Date().toISOString() },
      });
  } catch (err) {
    console.error('Failed to persist operationalMetrics:', err);
  }
}

export async function replaceAllDbFromRestorePg(restored: ServerDb): Promise<void> {
  if (allowDevInMemoryFallback()) {
    ensureFamilyCollections(restored);
    inMemoryDb = structuredClone(restored);
    const activeCtx = pgRequestAls.getStore();
    if (activeCtx) {
      activeCtx.db = structuredClone(restored);
      activeCtx.pendingCommit = null;
    }
    return;
  }
  assertPgConfiguredOrThrow();
  await pgDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('global-restore'))`);
    const currentCtx = await loadServerDbSnapshotPg(tx);
    await commitServerDbDiffPg(currentCtx, restored, tx);
    const activeCtx = pgRequestAls.getStore();
    if (activeCtx) {
      const rebuilt = buildContextCaches(restored);
      activeCtx.db = restored;
      activeCtx.serializedCache = rebuilt.serializedCache;
      activeCtx.configHashes = rebuilt.configHashes;
      activeCtx.pendingCommit = null;
    }
  });
}

const STORY_AUDIO_BLOB_PREFIX = 'story_audio_blob:';
const inMemoryStoryAudioBlobs = new Map<string, Buffer>();

export function getStoryAudioBlobKey(storyId: string, sceneId: string): string {
  return `${STORY_AUDIO_BLOB_PREFIX}${storyId}:${sceneId}`;
}

function isSafeStorySegment(segment: string): boolean {
  return /^[a-z0-9-]+$/i.test(segment) && segment.length <= 64;
}

function isValidMp3OrAudioHeader(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.subarray(0, 3).toString('ascii') === 'ID3') return true;
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE') {
    return true;
  }
  return false;
}

export async function saveStoryAudioBlobPg(
  storyId: string,
  sceneId: string,
  mp3Buffer: Buffer,
): Promise<void> {
  if (!isSafeStorySegment(storyId) || !isSafeStorySegment(sceneId)) {
    throw new Error('Invalid story or scene identifier for audio blob storage.');
  }
  if (!mp3Buffer || mp3Buffer.length < 1024 || mp3Buffer.length > 15 * 1024 * 1024) {
    throw new Error('Audio blob buffer size is outside valid bounds.');
  }
  const key = getStoryAudioBlobKey(storyId, sceneId);
  if (allowDevInMemoryFallback()) {
    inMemoryStoryAudioBlobs.set(key, Buffer.from(mp3Buffer));
    return;
  }
  if (!isPgConfigured()) return;
  await pgDb
    .insert(schema.appConfigs)
    .values({
      key,
      value: {
        storyId,
        sceneId,
        mimeType: 'audio/mpeg',
        bytes: mp3Buffer.length,
        base64: mp3Buffer.toString('base64'),
        updatedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: schema.appConfigs.key,
      set: {
        value: {
          storyId,
          sceneId,
          mimeType: 'audio/mpeg',
          bytes: mp3Buffer.length,
          base64: mp3Buffer.toString('base64'),
          updatedAt: new Date().toISOString(),
        } as any,
        updatedAt: new Date().toISOString(),
      },
    });
}

export async function loadStoryAudioBlobPg(
  storyId: string,
  sceneId: string,
): Promise<Buffer | null> {
  if (!isSafeStorySegment(storyId) || !isSafeStorySegment(sceneId)) {
    return null;
  }
  const key = getStoryAudioBlobKey(storyId, sceneId);
  if (allowDevInMemoryFallback()) {
    const buf = inMemoryStoryAudioBlobs.get(key);
    return buf ? Buffer.from(buf) : null;
  }
  if (!isPgConfigured()) return null;
  try {
    const rows = await pgDb
      .select()
      .from(schema.appConfigs)
      .where(eq(schema.appConfigs.key, key));
    const val = rows[0]?.value as { base64?: string } | undefined;
    if (!val || typeof val.base64 !== 'string' || !val.base64) {
      return null;
    }
    const decoded = Buffer.from(val.base64, 'base64');
    return isValidMp3OrAudioHeader(decoded) ? decoded : null;
  } catch (err) {
    console.error(`[StoryAudioBlob] Failed loading ${key}:`, err);
    return null;
  }
}

export async function hydrateAllStoryAudioBlobsPg(
  publicStoriesDir: string,
): Promise<{ hydratedCount: number; totalBlobs: number; blobSceneKeys: string[] }> {
  const blobSceneKeys: string[] = [];
  let hydratedCount = 0;

  const writeIfNeeded = (storyId: string, sceneId: string, buf: Buffer) => {
    if (!isSafeStorySegment(storyId) || !isSafeStorySegment(sceneId)) return;
    if (buf.length < 1024 || !isValidMp3OrAudioHeader(buf)) return;
    blobSceneKeys.push(`${storyId}/${sceneId}`);
    const destDir = path.join(publicStoriesDir, storyId);
    const destPath = path.join(destDir, `${sceneId}.mp3`);
    if (fs.existsSync(destPath)) {
      try {
        const st = fs.statSync(destPath);
        if (st.isFile() && st.size >= 1024) {
          const head = Buffer.alloc(16);
          const fd = fs.openSync(destPath, 'r');
          try {
            fs.readSync(fd, head, 0, 16, 0);
          } finally {
            fs.closeSync(fd);
          }
          if (isValidMp3OrAudioHeader(head)) return;
        }
      } catch {
        // overwrite broken local copy from DB blob
      }
    }
    fs.mkdirSync(destDir, { recursive: true });
    const tmpPath = path.join(destDir, `.tmp-${crypto.randomBytes(4).toString('hex')}.mp3`);
    fs.writeFileSync(tmpPath, buf);
    fs.renameSync(tmpPath, destPath);
    hydratedCount++;
  };

  if (allowDevInMemoryFallback()) {
    for (const [key, buf] of inMemoryStoryAudioBlobs.entries()) {
      const m = /^story_audio_blob:([a-z0-9-]+):([a-z0-9-]+)$/i.exec(key);
      if (m) writeIfNeeded(m[1], m[2], buf);
    }
    return { hydratedCount, totalBlobs: blobSceneKeys.length, blobSceneKeys };
  }

  if (!isPgConfigured()) {
    return { hydratedCount: 0, totalBlobs: 0, blobSceneKeys: [] };
  }

  try {
    const rows = await pgDb
      .select()
      .from(schema.appConfigs)
      .where(like(schema.appConfigs.key, `${STORY_AUDIO_BLOB_PREFIX}%`));
    for (const row of rows) {
      const m = /^story_audio_blob:([a-z0-9-]+):([a-z0-9-]+)$/i.exec(row.key);
      if (!m) continue;
      const val = row.value as { base64?: string } | undefined;
      if (!val || typeof val.base64 !== 'string') continue;
      const buf = Buffer.from(val.base64, 'base64');
      writeIfNeeded(m[1], m[2], buf);
    }
  } catch (err) {
    console.error('[StoryAudioBlob] Startup hydration failed cleanly:', scrubSafePgMessage((err as Error)?.message));
  }

  return { hydratedCount, totalBlobs: blobSceneKeys.length, blobSceneKeys };
}

export async function inspectLiveStoryCmsAudioSummaryPg(): Promise<{
  attachedAudioScenes: Array<{ storyId: string; sceneId: string; url: string; durationSeconds?: number }>;
  dbBlobKeys: string[];
}> {
  const attachedAudioScenes: Array<{ storyId: string; sceneId: string; url: string; durationSeconds?: number }> = [];
  const dbBlobKeys: string[] = [];

  if (allowDevInMemoryFallback()) {
    const cms = getInMemoryDb().quranStoryCms || {};
    for (const [storyId, ov] of Object.entries(cms)) {
      for (const [sceneId, scOv] of Object.entries(ov?.sceneOverrides || {})) {
        if (typeof scOv?.narrationAudioUrl === 'string' && scOv.narrationAudioUrl.trim()) {
          attachedAudioScenes.push({
            storyId,
            sceneId,
            url: scOv.narrationAudioUrl.trim(),
            durationSeconds: scOv.durationSeconds,
          });
        }
      }
    }
    for (const k of inMemoryStoryAudioBlobs.keys()) {
      dbBlobKeys.push(k.replace(STORY_AUDIO_BLOB_PREFIX, ''));
    }
    return { attachedAudioScenes, dbBlobKeys };
  }

  if (!isPgConfigured()) {
    return { attachedAudioScenes, dbBlobKeys };
  }

  try {
    const [cmsRows, blobRows] = await Promise.all([
      pgDb.select().from(schema.appConfigs).where(eq(schema.appConfigs.key, 'quranStoryCms')),
      pgDb
        .select({ key: schema.appConfigs.key })
        .from(schema.appConfigs)
        .where(like(schema.appConfigs.key, `${STORY_AUDIO_BLOB_PREFIX}%`)),
    ]);
    const cms = (cmsRows[0]?.value || {}) as NonNullable<ServerDb['quranStoryCms']>;
    for (const [storyId, ov] of Object.entries(cms)) {
      for (const [sceneId, scOv] of Object.entries(ov?.sceneOverrides || {})) {
        if (typeof scOv?.narrationAudioUrl === 'string' && scOv.narrationAudioUrl.trim()) {
          attachedAudioScenes.push({
            storyId,
            sceneId,
            url: scOv.narrationAudioUrl.trim(),
            durationSeconds: scOv.durationSeconds,
          });
        }
      }
    }
    for (const b of blobRows) {
      dbBlobKeys.push(b.key.replace(STORY_AUDIO_BLOB_PREFIX, ''));
    }
  } catch (err) {
    console.error('[StoryAudioInspect] Query failed cleanly:', scrubSafePgMessage((err as Error)?.message));
  }

  return { attachedAudioScenes, dbBlobKeys };
}

