import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { VALIDATED_EXAM_BANK } from './src/data/deepCurriculum';
import { getLevel1LessonById } from './src/data/level1Curriculum';
import { getQuestionsForLevel1Lesson, LEVEL1_QUESTION_BANK } from './src/data/level1QuestionBank';
import { createInitialSkillProgress } from './src/data/rewardsAndRoom';
import {
  normalizeEmail,
  POLICY_VERSION,
  sanitizeRecommendedAgeRange,
  sanitizeShortText,
  validateChildProfileInput,
  validateEmail,
  validateParentName,
  validatePassword,
} from './src/utils/validation';
import {
  isContentAppropriateForChild,
  isLegacyFiveToEight,
  UNIFIED_STAGE_ID,
} from './src/utils/ageAdaptation';
import {
  appendSecurityLog,
  clearSessionCookie,
  encryptSensitiveField,
  generateChildAccessCode,
  generateSecureToken,
  getClientIp,
  getDashboardRouteForRole,
  hashPassword,
  hashToken,
  hasPermission,
  isAdminRole,
  LOCKOUT_MS,
  MAX_FAILED_LOGINS,
  parseCookies,
  securityHeadersMiddleware,
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
  SESSION_REMEMBER_MS,
  setSessionCookie,
  StoredUserRecord,
  verifyPassword,
  verifySecretTimingSafe,
} from './server/security';
import type { AuthenticatedRequest, CheckoutSession, StoredChildRecord } from './server/dbTypes';
import { registerAdminRoutes } from './server/adminRoutes';
import { recordAuditEvent, registerImmutableAuditGuards } from './server/auditLog';
import {
  canUserAccessChild,
  ensureChildFamilyAndGarden,
  ensureFamilyCollections,
  ensureFamilyForUser,
  getAccessibleChildrenForUser,
  isChildOrStudentRole,
  recordFamilyEvent,
  requireParentGate,
  toSafeChildProfile,
} from './server/familyHelpers';
import { ensureLinkedChildUserAccount, registerFamilyAuthRoutes } from './server/familyAuthRoutes';
import { registerFamilyEcosystemRoutes } from './server/familyEcosystemRoutes';
import { registerGovernanceAndHomeworkRoutes } from './server/governanceAndHomeworkRoutes';
import { registerLearningAndGardenRoutes } from './server/learningAndGardenRoutes';
import { registerAcademyAudioRoutes } from './server/academyAudioRoutes';
import { registerNonoAiRoutes } from './server/nonoAiRoutes';
import {
  clearPasswordReauth,
  clearPasswordReauthForUser,
  registerPasskeyRoutes,
} from './server/passkeyRoutes';
import { registerReadingAndFamilyRoutes } from './server/readingAndFamilyRoutes';
import { registerQuranRoutes } from './server/quranRoutes';
import { registerLegalRoutes } from './server/legalRoutes';
import { registerSmartAssessmentRoutes } from './server/smartAssessmentRoutes';
import { registerTeacherAndLevel2Routes } from './server/teacherRoutes';
import { registerWorldExperienceRoutes } from './server/worldExperienceRoutes';
import {
  checkPgHealth,
  checkPgHealthDetailed,
  checkRateLimitPg,
  clearRateLimitPg,
  enqueuePgContextSave,
  getPgContextDb,
  hydrateAllStoryAudioBlobsPg,
  inspectAndApplyQuranMigration0002Pg,
  inspectLiveStoryCmsAudioSummaryPg,
  isPgConfigured,
  loadServerDbSnapshotPg,
  shouldUsePgOrFailClosed,
  PgRequestContext,
  recordOperationalErrorPg,
  runWithPgDbLock,
  runWithPgRequestContext,
  setPgContextDb,
} from './server/pgStore';
import {
  STORY_AUDIO_PUBLIC_DIR,
  ensureStoryAudioOnDiskFromDb,
  getStoryAudioBackfillStatus,
  hasValidAudioMagicBytes,
  parseLocalStoryAudioUrl,
  resolveSafePublicAssetFile,
  runMissingStoryAudioBackfill,
} from './server/storyAudioService';
import { QURAN_STORIES } from './src/data/quranCatalog';
import {
  getNonSensitiveDbSettings,
  getSecret,
  getSecretProviderSnapshotSync,
  initializeSecretProvider,
} from './server/secretProvider';
import { getPgConnectionDiagnostics, resetPoolForResolvedSecrets } from './src/db/index';
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_NEXT_MONTH_PLAN,
  DEFAULT_PARENT_SCHEDULE,
  DEFAULT_PET_STATE,
  DEFAULT_ROOM_CONFIG,
} from './src/data/worldCatalog';
import type {
  AgeGroupId,
  Certificate,
  ChildProfile,
  CmsLessonRecord,
  ExamAttemptSummary,
  ExamConfig,
  ExamQuestionItem,
  ExamSubject,
  Language,
  Level1LessonProgress,
  LocalizedText,
  StoredAgeGroupId,
  UserRole,
  WorldId,
} from './src/types/nonoland';

dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';



function toSafeUser(user: StoredUserRecord) {
  return {
    id: user.id,
    name: user.displayName,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    role: user.role,
    status: user.status,
    bio: user.bio,
    linkedChildId: user.linkedChildId,
    familyId: user.familyId,
    teacherProfile: user.teacherProfile,
    dashboardRoute: getDashboardRouteForRole(user.role),
    emailVerified: user.emailVerified,
    policyVersion: user.policyVersion,
    termsAcceptedAt: user.termsAcceptedAt,
    createdAt: user.createdAt,
    isDemoMode: false,
  };
}

function subjectToWorld(subject: ExamSubject): { worldId: WorldId; worldName: LocalizedText } {
  switch (subject) {
    case 'arabic':
      return { worldId: 'arabic-letters', worldName: { ar: 'جزيرة الحروف العربية', en: 'Arabic Letters Island' } };
    case 'english':
      return { worldId: 'english-letters', worldName: { ar: 'مدينة الإنجليزية', en: 'English Alphabet City' } };
    case 'math':
      return { worldId: 'numbers-kingdom', worldName: { ar: 'مملكة الأرقام والرياضيات', en: 'Numbers & Math Kingdom' } };
    case 'colors-science':
      return { worldId: 'science-galaxy', worldName: { ar: 'مجرة العلوم والألوان', en: 'Colors & Science Galaxy' } };
    default:
      return { worldId: 'intelligence-castle', worldName: { ar: 'امتحان نونو لاند الشامل', en: 'NonoLand Comprehensive Academy' } };
  }
}

async function startServer() {
  const secretStartupSnap = await initializeSecretProvider();
  if (secretStartupSnap.secretSource === 'secret-manager' || secretStartupSnap.secretSource === 'mixed') {
    resetPoolForResolvedSecrets();
  }
  console.log(
    `[SecretProvider] source=${secretStartupSnap.secretSource} present=${secretStartupSnap.presentRequired.length}/${secretStartupSnap.presentRequired.length + secretStartupSnap.missingRequired.length} missing=${secretStartupSnap.missingRequired.join(',') || 'none'} smStatus=${secretStartupSnap.secretManager.status}`,
  );

  const quranMigReport = await inspectAndApplyQuranMigration0002Pg();
  console.log(
    `[QuranMigration0002] classification=${quranMigReport.classification} action=${quranMigReport.action} tables=${quranMigReport.tablesPresentCount}/6 indexes=${quranMigReport.indexesPresentCount}/8 constraints=${quranMigReport.constraintsPresentCount}/18 recorded0002=${quranMigReport.migration0002RecordedCount} pending=${quranMigReport.pendingMigrationsCount} coreTablesIntact=${quranMigReport.coreTablesIntact}${quranMigReport.error ? ` note=${quranMigReport.error}` : ''}`,
  );

  const storyHydration = await hydrateAllStoryAudioBlobsPg(STORY_AUDIO_PUBLIC_DIR);
  const storyCmsSnap = await inspectLiveStoryCmsAudioSummaryPg();
  console.log(
    `[StoryAudioStartup] attachedScenes=${storyCmsSnap.attachedAudioScenes.length} dbBlobs=${storyHydration.totalBlobs} hydratedToDisk=${storyHydration.hydratedCount}`,
  );

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const SERVER_INSTANCE_ID = `nono_${crypto.randomBytes(6).toString('hex')}`;
  let actualListeningPort: number | null = null;
  let apiRoutesReady = false;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeadersMiddleware);

  // Tag every /api response with an Express marker and safely log PID/port/instanceId per request
  app.use('/api', (req, res, next) => {
    const safePath = req.originalUrl.split('?')[0];
    res.setHeader('X-NonoLand-API', 'express');
    res.setHeader('X-NonoLand-Instance', SERVER_INSTANCE_ID);
    console.info(
      `[API-Request] pid=${process.pid} port=${actualListeningPort ?? PORT} instanceId=${SERVER_INSTANCE_ID} method=${req.method} path=${safePath}`,
    );
    if (
      !apiRoutesReady &&
      req.path !== '/health' &&
      req.path !== '/runtime-diagnostics'
    ) {
      return res.status(503).json({
        error: 'Express API server is still starting up. Please retry shortly.',
        code: 'SERVER_STARTING',
        serverReady: false,
      });
    }
    if (req.path === '/admin/quran/qf-sync-preview') {
      console.info(
        `[QF-Preview] Request reached Express: pid=${process.pid} port=${actualListeningPort ?? PORT} instanceId=${SERVER_INSTANCE_ID} method=${req.method} path=${safePath} serverReady=${apiRoutesReady}`,
      );
      res.on('finish', () => {
        const ct = String(res.getHeader('content-type') || 'unknown');
        const format = /json/i.test(ct) ? 'json' : /html/i.test(ct) ? 'html' : 'other';
        console.info(
          `[QF-Preview] Express response finished: status=${res.statusCode} contentType=${ct} format=${format}`,
        );
      });
    }
    next();
  });

  app.use('/api/admin/ops/restore', express.json({ limit: '4mb' }));
  app.use(express.json({ limit: '512kb' }));

  // Clean 413 / 400 error handler for oversized or malformed JSON payloads
  app.use(
    (
      err: { status?: number; type?: string; message?: string },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (err?.type === 'entity.too.large' || err?.status === 413) {
        return res.status(413).json({ error: 'Request payload exceeds maximum allowed size' });
      }
      if (err instanceof SyntaxError || err?.status === 400) {
        return res.status(400).json({ error: 'Malformed JSON request body' });
      }
      next(err);
    },
  );

  const getDb = getPgContextDb;
  const saveDb = enqueuePgContextSave;

  function createSessionForUser(
    user: StoredUserRecord,
    req: express.Request,
    res: express.Response,
    opts?: {
      rememberMe?: boolean;
      sessionKind?: 'parent' | 'child' | 'staff';
      childId?: string;
      familyId?: string;
      deviceId?: string;
    },
  ): string {
    const db = getDb();
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const csrfToken = generateSecureToken(24);
    const now = Date.now();
    const maxAgeMs = opts?.rememberMe ? SESSION_REMEMBER_MS : SESSION_ABSOLUTE_MS;
    const sessionKind =
      opts?.sessionKind || (isChildOrStudentRole(user.role) ? 'child' : user.role === 'parent' ? 'parent' : 'staff');
    db.sessions[tokenHash] = {
      tokenHash,
      userId: user.id,
      csrfToken,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: now + maxAgeMs,
      ip: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
      sessionKind,
      childId: opts?.childId || user.linkedChildId,
      familyId: opts?.familyId || user.familyId,
      deviceId: opts?.deviceId,
      rememberMe: Boolean(opts?.rememberMe),
    };
    setSessionCookie(res, rawToken, req, maxAgeMs, IS_PROD);
    return csrfToken;
  }

  function revokeAllUserSessions(userId: string) {
    const db = getDb();
    clearPasswordReauthForUser(userId);
    for (const [hash, s] of Object.entries(db.sessions)) {
      if (s.userId === userId) {
        delete db.sessions[hash];
      }
    }
  }

  app.get('/api/health', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const health = await checkPgHealthDetailed();
    if (!health.healthy) {
      return res.status(503).json({
        status: 'error',
        service: 'nonoland-express',
        serverReady: apiRoutesReady,
        database: 'unavailable',
        code: 'DB_UNAVAILABLE',
        reason: health.reason || 'connection_failed',
        ...(health.errorCode ? { errorCode: health.errorCode } : {}),
        missingEnvVars: health.missingEnvVars,
        databaseName: health.databaseName,
        configSource: health.configSource,
        configComplete: health.configComplete,
        isNeonHost: health.isNeonHost,
        isPooledEndpoint: health.isPooledEndpoint,
        sslEnabled: health.sslEnabled,
        schemaReady: health.schemaReady,
        quranSchemaReady: health.quranSchemaReady ?? false,
        ...(health.quranMigration ? { quranMigration: health.quranMigration } : {}),
      });
    }
    let storyAudioHealth: Record<string, unknown> = {
      ttsConfigured: Boolean(process.env.GEMINI_API_KEY),
    };
    try {
      const liveSummary = await inspectLiveStoryCmsAudioSummaryPg();
      const dbBlobSet = new Set(liveSummary.dbBlobKeys);
      const attachedScenes = liveSummary.attachedAudioScenes.map((item) => {
        const safePath = resolveSafePublicAssetFile(item.url);
        let fileExistsOnDisk = false;
        let bytes = 0;
        let validAudioSignature = false;
        let detectedMimeType: string | null = null;
        if (safePath && fs.existsSync(safePath)) {
          try {
            const st = fs.statSync(safePath);
            if (st.isFile()) {
              fileExistsOnDisk = true;
              bytes = st.size;
              if (bytes >= 12) {
                const fd = fs.openSync(safePath, 'r');
                try {
                  const head = Buffer.alloc(16);
                  fs.readSync(fd, head, 0, 16, 0);
                  const magic = hasValidAudioMagicBytes(head);
                  validAudioSignature = magic.ok;
                  detectedMimeType = magic.mimeType;
                } finally {
                  fs.closeSync(fd);
                }
              }
            }
          } catch {
            // keep defaults
          }
        }
        return {
          storyId: item.storyId,
          sceneId: item.sceneId,
          url: item.url,
          fileExistsOnDisk,
          validAudioSignature,
          mimeType: detectedMimeType,
          bytes,
          hasDbBlob: dbBlobSet.has(`${item.storyId}:${item.sceneId}`),
          durationSeconds: item.durationSeconds ?? null,
        };
      });
      storyAudioHealth = {
        ttsConfigured: Boolean(process.env.GEMINI_API_KEY),
        attachedCount: attachedScenes.length,
        dbBlobCount: liveSummary.dbBlobKeys.length,
        dbBlobKeys: liveSummary.dbBlobKeys,
        attachedScenes,
        backfill: getStoryAudioBackfillStatus(),
      };
    } catch {
      storyAudioHealth = {
        ttsConfigured: Boolean(process.env.GEMINI_API_KEY),
        error: 'unavailable',
        backfill: getStoryAudioBackfillStatus(),
      };
    }

    res.json({
      status: 'ok',
      service: 'nonoland-express',
      serverReady: apiRoutesReady,
      database: health.database,
      databaseName: health.databaseName,
      configSource: health.configSource,
      configComplete: health.configComplete,
      isNeonHost: health.isNeonHost,
      isPooledEndpoint: health.isPooledEndpoint,
      sslEnabled: health.sslEnabled,
      schemaReady: health.schemaReady,
      quranSchemaReady: health.quranSchemaReady ?? true,
      ...(health.quranMigration ? { quranMigration: health.quranMigration } : {}),
      storyAudioHealth,
    });
  });

  // Session attachment + CSRF enforcement on cookie-authenticated mutations
  const CSRF_EXEMPT_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/child-login',
    '/api/auth/child-quick-login',
    '/api/auth/register',
    '/api/auth/register-teacher',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/passkeys/login/options',
    '/api/auth/passkeys/login/verify',
  ]);

  app.get('/api/admin/diagnostics', async (req: AuthenticatedRequest, res) => {
    let authorizedAdmin = false;

    try {
      const ctx = await loadServerDbSnapshotPg();
      const cookies = parseCookies(req.headers.cookie);
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (rawToken) {
        const tokenHash = hashToken(rawToken);
        const session = ctx.db.sessions[tokenHash];
        const now = Date.now();
        const idleLimit = session?.rememberMe ? SESSION_REMEMBER_MS : SESSION_IDLE_MS;
        const linkedDeviceRevoked =
          session?.deviceId && ctx.db.trustedDevices?.[session.deviceId]?.revoked === true;
        if (
          session &&
          !linkedDeviceRevoked &&
          now < session.expiresAt &&
          now - session.lastActiveAt < idleLimit
        ) {
          const user = ctx.db.users[session.userId];
          if (user && user.status === 'active') {
            if (!isAdminRole(user.role)) {
              return res.status(403).json({ error: 'Forbidden: Administrator role required.' });
            }
            authorizedAdmin = true;
          }
        }
      }
    } catch {
      // Database may be unavailable; allow emergency admin header authentication below
    }

    if (!authorizedAdmin) {
      const expectedSetupSecret = getSecret('NONOLAND_ADMIN_SETUP_SECRET') || '';
      const providedSetupSecret = String(req.header('x-admin-setup-secret') || '').trim();
      const configuredPin = String(process.env.ADMIN_PIN || '').trim();
      const providedPin = String(req.header('x-admin-pin') || '').trim();

      const validSetupSecret =
        Boolean(expectedSetupSecret && providedSetupSecret) &&
        verifySecretTimingSafe(providedSetupSecret, expectedSetupSecret);
      const validAdminPin =
        Boolean(configuredPin && providedPin) &&
        verifySecretTimingSafe(providedPin, configuredPin);

      if (!validSetupSecret && !validAdminPin) {
        return res.status(401).json({ error: 'Administrator authentication required.' });
      }
    }

    let secretSnap = getSecretProviderSnapshotSync();
    if (secretSnap.secretManager.status === 'not_probed') {
      secretSnap = await initializeSecretProvider({ forceProbeSecretManager: true });
    }
    const health = await checkPgHealthDetailed();
    const dbDefaults = getNonSensitiveDbSettings();

    return res.json({
      secretSource: secretSnap.secretSource,
      secretManager: secretSnap.secretManager,
      requiredVariables: {
        present: secretSnap.presentRequired,
        missing: secretSnap.missingRequired,
        sources: secretSnap.sources,
        nonSensitiveDefaults: dbDefaults,
      },
      database: {
        status: health.healthy
          ? health.database === 'in-memory-dev'
            ? 'in-memory-dev'
            : 'connected'
          : 'unavailable',
        healthy: health.healthy,
        sslEnabled: health.sslEnabled,
        isNeonHost: health.isNeonHost,
        isPooledEndpoint: health.isPooledEndpoint,
      },
      postgresError: {
        classification: health.healthy ? 'none' : health.reason || 'connection_failed',
        errorCode: health.errorCode || null,
        userEqualsDbName: Boolean(health.userEqualsDbName),
      },
      schemaReady: health.schemaReady,
    });
  });

  app.get('/api/runtime-diagnostics', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const parsedEnvPort = process.env.PORT ? Number(process.env.PORT) : null;
    return res.status(200).json({
      pid: process.pid,
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      envPort: parsedEnvPort !== null && Number.isFinite(parsedEnvPort) ? parsedEnvPort : null,
      listeningPort: actualListeningPort ?? PORT,
      serverReady: apiRoutesReady,
      runtimeEnvironment: process.env.NODE_ENV || 'unknown',
      instanceId: SERVER_INSTANCE_ID,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', async (req: AuthenticatedRequest, res, next) => {
    if (
      req.path === '/health' ||
      req.path === '/runtime-diagnostics' ||
      req.path === '/admin/diagnostics' ||
      req.path === '/legal/policies' ||
      req.path.startsWith('/ai/tts-clip/')
    ) {
      return next();
    }

    let ctx: PgRequestContext;
    try {
      ctx = await loadServerDbSnapshotPg();
    } catch (err) {
      const diag = getPgConnectionDiagnostics();
      const errObj = err as { code?: string; message?: string };
      const reason = !diag.configured
        ? 'missing_env_vars'
        : errObj?.code === 'PG_AUTH_FAILED'
          ? 'auth_failed'
          : errObj?.code === 'SCHEMA_NOT_INITIALIZED'
            ? 'schema_not_initialized'
            : 'connection_failed';
      console.error(`PostgreSQL request snapshot load failed (failing closed) [${reason}]:`, errObj?.message || err);
      return res.status(503).json({
        error: 'Database unavailable. Failing closed for data safety.',
        code: 'DB_UNAVAILABLE',
        reason,
        ...(diag.missingEnvVars.length > 0 ? { missingEnvVars: diag.missingEnvVars } : {}),
      });
    }

    return runWithPgRequestContext(ctx, () => {
      const origJson = res.json.bind(res);
      const origSend = res.send.bind(res);
      let responseFlushed = false;

      const flushAndSend = (invoke: () => express.Response) => {
        if (responseFlushed) {
          return invoke();
        }
        responseFlushed = true;
        if (!ctx.pendingCommit) {
          return invoke();
        }
        const commitPromise = ctx.pendingCommit;
        ctx.pendingCommit = null;
        commitPromise
          .then(() => {
            invoke();
          })
          .catch((commitErr) => {
            console.error('PostgreSQL commit failed:', commitErr);
            if (!res.headersSent) {
              res.status(503);
              origJson({
                error: 'Database commit failed. Failing closed for data safety.',
                code: 'DB_COMMIT_FAILED',
              });
            }
          });
        return res;
      };

      res.json = ((body?: unknown) => flushAndSend(() => origJson(body))) as express.Response['json'];
      res.send = ((body?: unknown) => flushAndSend(() => origSend(body))) as express.Response['send'];

      res.on('finish', () => {
        if (res.statusCode >= 500) {
          ctx.db.operationalMetrics.totalApiRequests = (ctx.db.operationalMetrics.totalApiRequests || 0) + 1;
          ctx.db.operationalMetrics.apiFailures5xx = (ctx.db.operationalMetrics.apiFailures5xx || 0) + 1;
          ctx.db.operationalMetrics.lastErrors.unshift({
            route: `${req.method} ${req.originalUrl.split('?')[0]}`,
            status: res.statusCode,
            message: 'Server error response',
            timestamp: new Date().toISOString(),
          });
          if (ctx.db.operationalMetrics.lastErrors.length > 25) ctx.db.operationalMetrics.lastErrors.length = 25;
          void recordOperationalErrorPg(ctx.db.operationalMetrics);
        }
      });

      const db = ctx.db;
      const cookies = parseCookies(req.headers.cookie);
      const rawToken = cookies[SESSION_COOKIE_NAME];

      if (rawToken) {
        const tokenHash = hashToken(rawToken);
        const session = db.sessions[tokenHash];
        const now = Date.now();
        const idleLimit = session?.rememberMe ? SESSION_REMEMBER_MS : SESSION_IDLE_MS;

        // Also check whether linked trusted device was revoked
        const linkedDeviceRevoked =
          session?.deviceId && db.trustedDevices?.[session.deviceId]?.revoked === true;

        if (
          session &&
          !linkedDeviceRevoked &&
          now < session.expiresAt &&
          now - session.lastActiveAt < idleLimit
        ) {
          const user = db.users[session.userId];
          if (user && user.status === 'active') {
            req.authSession = { user, session };
            if (now - session.lastActiveAt > 60_000) {
              session.lastActiveAt = now;
              saveDb(db);
            }
          }
        } else if (session) {
          delete db.sessions[tokenHash];
          clearSessionCookie(res, req, IS_PROD);
          saveDb(db);
        }
      }

      // Enforce CSRF token on any state-changing request from an authenticated cookie session
      if (
        req.authSession &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        !CSRF_EXEMPT_PATHS.has(req.originalUrl.split('?')[0])
      ) {
        const headerCsrf = req.header('x-csrf-token');
        if (!headerCsrf || headerCsrf !== req.authSession.session.csrfToken) {
          appendSecurityLog(db.securityLogs, {
            eventType: 'ACCESS_DENIED',
            actorId: req.authSession.user.id,
            role: req.authSession.user.role,
            ip: getClientIp(req),
            summary: `CSRF mismatch on ${req.method} ${req.originalUrl}`,
          });
          saveDb(db);
          return res.status(403).json({ error: 'Invalid or missing CSRF token' });
        }
      }

      next();
    });
  });

  function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
    if (!req.authSession) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  }

  function assertChildAccess(
    req: AuthenticatedRequest,
    res: express.Response,
    childId: string,
  ): StoredChildRecord | null | 'untracked-sample' {
    const db = getDb();
    const storedChild = db.children[childId];
    if (!storedChild) {
      if (!req.authSession && (childId.startsWith('child-') || childId.startsWith('demo-'))) {
        return 'untracked-sample';
      }
      if (!req.authSession) {
        res.status(401).json({ error: 'Authentication required for unknown child profile' });
        return null;
      }
      res.status(404).json({ error: 'Child profile not found' });
      return null;
    }

    if (!req.authSession) {
      res.status(401).json({ error: 'Authentication required to access this child profile' });
      return null;
    }

    const authUser = req.authSession.user;
    if (!canUserAccessChild(db, authUser, storedChild, 'view_profiles')) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: authUser.id,
        role: authUser.role,
        ip: getClientIp(req),
        summary: `Blocked IDOR access to child ${childId}`,
      });
      saveDb(db);
      res.status(403).json({ error: 'Forbidden: you do not own this child profile' });
      return null;
    }

    return storedChild;
  }

  function requireAdminPermission(permission: string) {
    return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
      const db = getDb();
      // 1. Authenticated session check first (strict RBAC: logged-in parents MUST be rejected 403!)
      if (req.authSession) {
        if (!hasPermission(req.authSession.user.role, permission)) {
          appendSecurityLog(db.securityLogs, {
            eventType: 'ACCESS_DENIED',
            actorId: req.authSession.user.id,
            role: req.authSession.user.role,
            ip: getClientIp(req),
            summary: `RBAC denied ${permission} for role ${req.authSession.user.role}`,
          });
          saveDb(db);
          return res.status(403).json({ error: `Forbidden: requires permission ${permission}` });
        }
        return next();
      }

      // 2. Fallback Admin PIN (fail-closed unless ADMIN_PIN is explicitly configured)
      const configuredPin = String(process.env.ADMIN_PIN || '').trim();
      const providedPin = String(req.header('x-admin-pin') || '').trim();
      if (configuredPin && providedPin && verifySecretTimingSafe(providedPin, configuredPin)) {
        return next();
      }

      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        ip: getClientIp(req),
        summary: `Unauthorized admin access attempt for ${permission}`,
      });
      saveDb(db);
      return res.status(401).json({ error: 'Admin authentication or valid Admin PIN required' });
    };
  }

  // ------------------------------------------------------------------
  // 0. AUTHENTICATION, SESSIONS, EMAIL VERIFICATION & PASSWORD RECOVERY
  // ------------------------------------------------------------------
  app.post('/api/auth/register', async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`reg:${ip}`, 20, 15 * 60_000))) {
      return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
    }

    const { displayName, email, password, termsAccepted, policyVersion, role: requestedRole } = req.body as {
      displayName?: string;
      email?: string;
      password?: string;
      termsAccepted?: boolean;
      policyVersion?: string;
      role?: string;
    };

    if (requestedRole !== undefined && requestedRole !== 'parent') {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        ip,
        summary: `Blocked privilege escalation attempt on /api/auth/register with role=${String(requestedRole)}`,
      });
      saveDb(db);
      return res.status(403).json({ error: 'Privilege escalation is not permitted during registration.' });
    }

    const nameCheck = validateParentName(displayName || '');
    if (!nameCheck.ok) {
      return res.status(400).json({ error: nameCheck.error });
    }

    const emailCheck = validateEmail(email || '');
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error });
    }

    const pwCheck = validatePassword(password || '', emailCheck.normalized, nameCheck.clean);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.error });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({ error: 'You must explicitly accept the Privacy Policy and Terms of Use.' });
    }

    if (db.emailIndex[emailCheck.normalized]) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const nowIso = new Date().toISOString();
    const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const user: StoredUserRecord = {
      id: userId,
      email: (email || '').trim(),
      normalizedEmail: emailCheck.normalized,
      displayName: nameCheck.clean,
      passwordHash: hashPassword(password || ''),
      role: 'parent',
      emailVerified: false,
      status: 'active',
      policyVersion: sanitizeShortText(policyVersion || POLICY_VERSION, 24) || POLICY_VERSION,
      termsAcceptedAt: nowIso,
      failedLoginAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users[userId] = user;
    db.emailIndex[emailCheck.normalized] = userId;
    const family = ensureFamilyForUser(db, user);

    // Issue single-use 24h email verification token
    const rawVerifyToken = generateSecureToken(24);
    db.actionTokens[hashToken(rawVerifyToken)] = {
      tokenHash: hashToken(rawVerifyToken),
      userId,
      type: 'email-verify',
      expiresAt: Date.now() + 24 * 60 * 60_000,
      used: false,
    };

    const csrfToken = createSessionForUser(user, req, res, {
      sessionKind: 'parent',
      familyId: family.id,
    });
    recordFamilyEvent(db, {
      familyId: family.id,
      category: 'auth',
      actionType: 'PARENT_REGISTERED',
      actorId: userId,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'إنشاء حساب عائلي لولي الأمر', en: 'Parent family account created' },
      description: {
        ar: `أنشأ ${user.displayName} حساباً عائلياً جديداً (${user.normalizedEmail})`,
        en: `${user.displayName} registered a private parent family account (${user.normalizedEmail})`,
      },
      ip,
      securityEventType: 'AUTH_REGISTER',
    });
    saveDb(db);

    res.status(201).json({
      user: toSafeUser(user),
      csrfToken,
      dashboardRoute: getDashboardRouteForRole(user.role),
      emailVerificationRequired: true,
      ...(!IS_PROD ? { devVerificationToken: rawVerifyToken } : {}),
    });
  });

  app.post('/api/auth/login', async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const ip = getClientIp(req);
    const { email, password, rememberMe, portal } = req.body as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
      portal?: 'parent' | 'teacher' | 'child' | 'admin';
    };
    const normEmail = normalizeEmail(email || '');

    if (!(await checkRateLimitPg(`login-ip:${ip}`, 40, 15 * 60_000)) || !(await checkRateLimitPg(`login-email:${normEmail}`, 15, 5 * 60_000))) {
      return res.status(429).json({ error: 'Too many login requests. Please wait a few minutes.' });
    }

    if (!normEmail || typeof password !== 'string' || password.length === 0 || password.length > 128) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userId = db.emailIndex[normEmail];
    const user = userId ? db.users[userId] : undefined;

    if (!user) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'AUTH_LOGIN_FAIL',
        ip,
        summary: `Failed login for unknown email`,
      });
      saveDb(db);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Teacher account is pending administrator approval.',
        status: 'pending',
      });
    }
    if (user.status === 'rejected') {
      const reason = user.teacherProfile?.rejectionReason;
      return res.status(403).json({
        error: reason
          ? `Teacher application was rejected: ${reason}`
          : 'This teacher account request was rejected by administration.',
        status: 'rejected',
        rejectionReason: reason || undefined,
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is suspended.', status: 'suspended' });
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      const waitSeconds = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000);
      return res.status(429).json({
        error: `Account temporarily locked due to failed attempts. Try again in ${waitSeconds}s.`,
        locked: true,
        retryAfterSeconds: waitSeconds,
      });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.updatedAt = new Date().toISOString();

      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
        appendSecurityLog(db.securityLogs, {
          eventType: 'AUTH_LOCKOUT',
          actorId: user.id,
          role: user.role,
          ip,
          summary: `Temporary 5-minute lockout after ${user.failedLoginAttempts} failed logins`,
        });
        saveDb(db);
        return res.status(429).json({
          error: 'Account temporarily locked for 5 minutes due to repeated failed attempts.',
          locked: true,
          retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
        });
      }

      appendSecurityLog(db.securityLogs, {
        eventType: 'AUTH_LOGIN_FAIL',
        actorId: user.id,
        role: user.role,
        ip,
        summary: `Failed password attempt (${user.failedLoginAttempts}/${MAX_FAILED_LOGINS})`,
      });
      saveDb(db);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (portal === 'admin' && !isAdminRole(user.role)) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: user.id,
        role: user.role,
        ip,
        summary: `Blocked non-admin role (${user.role}) from Admin Portal login`,
      });
      saveDb(db);
      return res.status(403).json({
        error: 'Access denied: Only authorized Administrator accounts can sign in to the Admin Portal.',
      });
    }
    if (portal === 'teacher' && user.role !== 'teacher') {
      return res.status(403).json({
        error: 'This tab is for Teacher accounts only. Please use the appropriate portal tab to sign in.',
      });
    }
    if (portal === 'parent' && user.role === 'teacher') {
      return res.status(403).json({
        error: 'Teacher accounts must sign in using the Teacher tab.',
      });
    }
    if (portal === 'parent' && isAdminRole(user.role)) {
      return res.status(403).json({
        error: 'Administrator accounts must sign in using the Admin tab.',
      });
    }
    if (portal === 'parent' && isChildOrStudentRole(user.role)) {
      return res.status(403).json({
        error: 'Child and student accounts must sign in via the Child tab.',
      });
    }
    if (!isAdminRole(user.role) && !['parent', 'teacher', 'child', 'student'].includes(user.role)) {
      return res.status(403).json({
        error: 'Account role is missing or invalid. Please contact support.',
      });
    }

    // Success: reset failure counters & rotate session
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.updatedAt = new Date().toISOString();
    await clearRateLimitPg(`login-email:${normEmail}`);

    if (user.role === 'parent') {
      ensureFamilyForUser(db, user);
    }

    // Revoke previous cookie session if present (session rotation)
    const oldCookies = parseCookies(req.headers.cookie);
    if (oldCookies[SESSION_COOKIE_NAME]) {
      delete db.sessions[hashToken(oldCookies[SESSION_COOKIE_NAME])];
    }

    const csrfToken = createSessionForUser(user, req, res, {
      rememberMe: Boolean(rememberMe),
      familyId: user.familyId,
    });
    if (user.familyId) {
      recordFamilyEvent(db, {
        familyId: user.familyId,
        category: 'auth',
        actionType: 'PARENT_LOGIN_SUCCESS',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        title: { ar: 'تسجيل دخول ولي الأمر', en: 'Parent signed in' },
        description: {
          ar: `سجّل ${user.displayName} الدخول إلى حساب العائلة بنجاح`,
          en: `${user.displayName} signed into the family account`,
        },
        ip,
        securityEventType: 'AUTH_LOGIN_SUCCESS',
      });
    } else {
      recordAuditEvent(db, {
        eventType: 'AUTH_LOGIN_SUCCESS',
        actorId: user.id,
        actorRole: user.role,
        actionType: isAdminRole(user.role) ? 'ADMIN_LOGIN_SUCCESS' : 'USER_LOGIN_SUCCESS',
        recordType: 'session',
        recordId: user.id,
        outcome: 'success',
        ip,
        summary: `${user.role} signed in cleanly (${user.normalizedEmail})`,
      });
    }
    saveDb(db);

    res.json({
      user: toSafeUser(user),
      dashboardRoute: getDashboardRouteForRole(user.role),
      csrfToken,
    });
  });

  app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
    if (!req.authSession) {
      return res.json({ authenticated: false, user: null, csrfToken: null, child: null });
    }
    const db = getDb();
    const user = req.authSession.user;
    let child = null;
    if (isChildOrStudentRole(user.role) && user.linkedChildId && db.children[user.linkedChildId]) {
      child = toSafeChildProfile(db, db.children[user.linkedChildId]);
    }
    res.json({
      authenticated: true,
      user: toSafeUser(user),
      csrfToken: req.authSession.session.csrfToken,
      child,
    });
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const db = getDb();
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required.' });
    }
    const record = db.actionTokens[hashToken(token.trim())];
    if (!record || record.type !== 'email-verify' || record.used || record.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Verification link is invalid or expired.' });
    }
    const user = db.users[record.userId];
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    record.used = true;
    user.emailVerified = true;
    user.updatedAt = new Date().toISOString();
    appendSecurityLog(db.securityLogs, {
      eventType: 'EMAIL_VERIFIED',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: `Email verified`,
    });
    saveDb(db);
    res.json({ verified: true, user: toSafeUser(user) });
  });

  app.post('/api/auth/resend-verification', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (!(await checkRateLimitPg(`resend-ver:${user.id}`, 3, 10 * 60_000))) {
      return res.status(429).json({ error: 'Verification requests are rate limited. Try again later.' });
    }
    const rawVerifyToken = generateSecureToken(24);
    db.actionTokens[hashToken(rawVerifyToken)] = {
      tokenHash: hashToken(rawVerifyToken),
      userId: user.id,
      type: 'email-verify',
      expiresAt: Date.now() + 24 * 60 * 60_000,
      used: false,
    };
    saveDb(db);
    res.json({
      sent: true,
      ...(!IS_PROD ? { devVerificationToken: rawVerifyToken } : {}),
    });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const db = getDb();
    const ip = getClientIp(req);
    const { email } = req.body as { email?: string };
    const norm = normalizeEmail(email || '');

    if (!(await checkRateLimitPg(`forgot-ip:${ip}`, 10, 15 * 60_000))) {
      return res.status(429).json({ error: 'Too many recovery requests.' });
    }

    let devResetToken: string | undefined;
    const userId = norm ? db.emailIndex[norm] : undefined;
    if (userId && db.users[userId]) {
      const raw = generateSecureToken(24);
      db.actionTokens[hashToken(raw)] = {
        tokenHash: hashToken(raw),
        userId,
        type: 'password-reset',
        expiresAt: Date.now() + 30 * 60_000,
        used: false,
      };
      saveDb(db);
      if (!IS_PROD) devResetToken = raw;
    }

    // Generic anti-enumeration response regardless of whether email exists
    res.json({
      ok: true,
      message: 'If an account matches this email, recovery instructions have been prepared.',
      ...(devResetToken ? { devResetToken } : {}),
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const db = getDb();
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required.' });
    }
    const record = db.actionTokens[hashToken(token.trim())];
    if (!record || record.type !== 'password-reset' || record.used || record.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Password reset token is invalid or expired.' });
    }

    const user = db.users[record.userId];
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const pwCheck = validatePassword(newPassword || '', user.normalizedEmail, user.displayName);
    if (!pwCheck.ok) {
      return res.status(400).json({ error: pwCheck.error });
    }

    record.used = true;
    user.passwordHash = hashPassword(newPassword || '');
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.updatedAt = new Date().toISOString();

    // Critical security guarantee: revoke ALL active sessions on password reset
    revokeAllUserSessions(user.id);
    clearSessionCookie(res, req, IS_PROD);
    appendSecurityLog(db.securityLogs, {
      eventType: 'PASSWORD_RESET',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: `Password reset completed and all active sessions revoked`,
    });
    saveDb(db);

    res.json({ reset: true });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[SESSION_COOKIE_NAME];
    if (raw) {
      const tokenH = hashToken(raw);
      clearPasswordReauth(tokenH);
      const sess = db.sessions[tokenH];
      const sessUser = sess ? db.users[sess.userId] : undefined;
      delete db.sessions[tokenH];
      if (sessUser) {
        recordAuditEvent(db, {
          eventType: 'LOGOUT',
          actorId: sessUser.id,
          actorRole: sessUser.role,
          actionType: isAdminRole(sessUser.role) ? 'ADMIN_LOGOUT' : 'USER_LOGOUT',
          recordType: 'session',
          recordId: sessUser.id,
          outcome: 'success',
          ip: getClientIp(req),
          summary: `${sessUser.role} logged out and session invalidated`,
        });
      }
      saveDb(db);
    }
    clearSessionCookie(res, req, IS_PROD);
    res.json({ loggedOut: true });
  });

  app.post('/api/auth/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    revokeAllUserSessions(user.id);
    clearSessionCookie(res, req, IS_PROD);
    appendSecurityLog(db.securityLogs, {
      eventType: 'LOGOUT_ALL',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: `Logged out of all devices`,
    });
    saveDb(db);
    res.json({ loggedOutAll: true });
  });

  app.post('/api/parent/verify-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const { password } = req.body as { password?: string };
    const { user, session } = req.authSession!;
    if (isChildOrStudentRole(user.role) || session.sessionKind === 'child') {
      return res.status(403).json({ verified: false, error: 'Child accounts cannot unlock the Parent Gate.' });
    }
    if (!password || !verifyPassword(password, user.passwordHash)) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'PARENT_GATE_FAIL',
        actorId: user.id,
        role: user.role,
        ip: getClientIp(req),
        summary: `Failed Parent Gate password confirmation`,
      });
      saveDb(db);
      return res.status(403).json({ verified: false, error: 'Incorrect parent password' });
    }
    session.parentGateVerifiedUntil = Date.now() + 15 * 60_000;
    saveDb(db);
    res.json({ verified: true, remainingSeconds: 15 * 60 });
  });

  app.get('/api/parent/security-logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (isChildOrStudentRole(user.role)) {
      return res.status(403).json({ error: 'Child accounts cannot view parent security logs' });
    }
    const activeSessionsCount = Object.values(db.sessions).filter(
      (s) => s.userId === user.id && s.expiresAt > Date.now(),
    ).length;
    const logs = db.securityLogs.filter((l) => l.actorId === user.id || (user.familyId && l.familyId === user.familyId)).slice(0, 30);
    res.json({ activeSessionsCount, logs });
  });

  // ------------------------------------------------------------------
  // 0B. CHILD PROFILES WITH OWNERSHIP & STRICT VALIDATION (IDOR SAFE)
  // ------------------------------------------------------------------
  app.get('/api/children', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const authUser = req.authSession!.user;
    const list = getAccessibleChildrenForUser(db, authUser).map((c) => toSafeChildProfile(db, c));
    res.json({ children: list });
  });

  app.post('/api/children', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authSession!.user;
    if (isChildOrStudentRole(user.role) || user.role === 'teacher') {
      return res.status(403).json({ error: 'Only parents or administrators can create child profiles' });
    }

    const body = req.body as {
      displayName?: string;
      ageGroup?: AgeGroupId;
      language?: Language;
      birthYear?: number;
      birthMonth?: number;
      interests?: string[];
      companionId?: string;
      companionScarfColor?: string;
      pin?: string;
    };

    const requestedAge = body.ageGroup ?? UNIFIED_STAGE_ID;
    const check = validateChildProfileInput({
      displayName: body.displayName || '',
      ageGroup: requestedAge,
      language: body.language || 'ar',
      birthYear: Number(body.birthYear),
      birthMonth: Number(body.birthMonth),
    });
    if (!check.ok || !check.clean) {
      return res.status(400).json({ error: check.error });
    }

    const rawPin = body.pin !== undefined ? String(body.pin).trim() : '';
    if (body.pin !== undefined && rawPin !== '' && !/^\d{4,6}$/.test(rawPin)) {
      return res.status(400).json({ error: 'Child PIN must be 4 to 6 numeric digits.' });
    }

    const lockFamilyKey = user.familyId || `fam_${user.id}`;
    const outcome = await runWithPgDbLock(`family:${lockFamilyKey}:create-child`, async (lockedDb) => {
      ensureFamilyCollections(lockedDb);
      const lockedUser = lockedDb.users[user.id] || user;
      const family = ensureFamilyForUser(lockedDb, lockedUser);
      const ownedCount = Object.values(lockedDb.children).filter(
        (c) => c.parentId === lockedUser.id || c.familyId === family.id,
      ).length;
      if (ownedCount >= 8) {
        return { status: 400, body: { error: 'Maximum 8 child profiles allowed per family account.' } };
      }

      const childId = `ch_${crypto.randomBytes(6).toString('hex')}`;
      const child: StoredChildRecord = {
        id: childId,
        parentId: lockedUser.id,
        familyId: family.id,
        displayName: check.clean!.displayName,
        birthYear: check.clean!.birthYear,
        birthMonth: check.clean!.birthMonth,
        ageGroup: check.clean!.ageGroup,
        language: body.language === 'en' ? 'en' : 'ar',
        interests: Array.isArray(body.interests)
          ? body.interests.slice(0, 6).map((x) => sanitizeShortText(String(x), 24))
          : [],
        companionId: sanitizeShortText(body.companionId || 'nono', 24) || 'nono',
        companionScarfColor: /^#[0-9A-Fa-f]{6}$/.test(body.companionScarfColor || '')
          ? body.companionScarfColor!
          : '#8054D9',
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
        unlockedCharacters: ['nono', sanitizeShortText(body.companionId || 'nono', 24) || 'nono'],
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
        level2Progress: {},
        avatarConfig: { ...DEFAULT_AVATAR_CONFIG },
        roomConfig: { ...DEFAULT_ROOM_CONFIG },
        petState: { ...DEFAULT_PET_STATE },
        completedLabIds: [],
        labHistory: [],
        customStories: [],
        creativeProjects: [],
        ownedShopItemIds: [],
        rewardTransactions: [],
        parentSchedule: { ...DEFAULT_PARENT_SCHEDULE },
        nextMonthPlan: DEFAULT_NEXT_MONTH_PLAN,
        activeDaysHistory: [],
        activityTimeline: [],
        aiAssistantEnabled: true,
        readingStageProgress: {},
        familyActivitiesCompleted: [],
        musicCompositions: [],
        buildConstructions: [],
      };

      ensureChildFamilyAndGarden(lockedDb, child);
      lockedDb.children[childId] = child;

      let generatedAccessCode: string | undefined;
      if (rawPin) {
        let code = generateChildAccessCode();
        let codeHash = hashToken(code);
        while (lockedDb.childAccessCodeIndex![codeHash]) {
          code = generateChildAccessCode();
          codeHash = hashToken(code);
        }
        const nowIso = new Date().toISOString();
        lockedDb.childCredentials![childId] = {
          childId,
          familyId: family.id,
          accessCodeHash: codeHash,
          accessCodeEncrypted: encryptSensitiveField(code),
          accessCodeLast4: code.slice(-4),
          pinHash: hashPassword(rawPin),
          failedAttempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        lockedDb.childAccessCodeIndex![codeHash] = childId;
        ensureLinkedChildUserAccount(lockedDb, childId, family.id, child.displayName);
        generatedAccessCode = code;
      }

      recordFamilyEvent(lockedDb, {
        familyId: family.id,
        category: 'profile',
        actionType: 'CHILD_PROFILE_CREATED',
        actorId: lockedUser.id,
        actorName: lockedUser.displayName,
        actorRole: lockedUser.role,
        childId,
        childName: child.displayName,
        title: { ar: 'إضافة ملف طفل جديد', en: 'Child profile added' },
        description: {
          ar: `أضاف ${lockedUser.displayName} ملف الطفل ${child.displayName}`,
          en: `${lockedUser.displayName} created child profile ${child.displayName}`,
        },
        ip: getClientIp(req),
        securityEventType: 'CHILD_PROFILE_CHANGE',
      });
      recordAuditEvent(lockedDb, {
        eventType: 'CHILD_PROFILE_CHANGE',
        actorId: lockedUser.id,
        actorRole: lockedUser.role,
        actionType: 'CREATE_CHILD_PROFILE',
        recordType: 'child_profile',
        recordId: childId,
        newValue: {
          displayName: child.displayName,
          ageGroup: child.ageGroup,
          language: child.language,
          credentialsConfigured: Boolean(generatedAccessCode),
        },
        ip: getClientIp(req),
        summary: `Created child profile ${childId} (${child.displayName})`,
      });

      return {
        status: 201,
        body: {
          child: toSafeChildProfile(lockedDb, child),
          ...(generatedAccessCode ? { accessCode: generatedAccessCode } : {}),
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  });


  app.patch('/api/children/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (isChildOrStudentRole(req.authSession!.user.role) || req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Forbidden: only parents may modify child profiles' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') {
        return res.status(404).json({ error: 'Child profile not found' });
      }
      return;
    }

    const patch = req.body as Partial<ChildProfile>;
    const nextName = patch.displayName !== undefined ? patch.displayName : child.displayName;
    const nextAge = patch.ageGroup || child.ageGroup;
    const nextLang = patch.language || child.language;
    const nextYear = patch.birthYear !== undefined ? Number(patch.birthYear) : child.birthYear;
    const nextMonth = patch.birthMonth !== undefined ? Number(patch.birthMonth) : child.birthMonth;

    // Preserve legacy 5-8 accounts safely when updating name/language/prefs without re-assigning stage
    const preservingLegacyStage = isLegacyFiveToEight(child.ageGroup) && nextAge === child.ageGroup;
    if (preservingLegacyStage) {
      const cleanName = sanitizeShortText(nextName, 50);
      if (!cleanName) {
        return res.status(400).json({ error: 'Child display name is required' });
      }
      child.displayName = cleanName;
      child.language = nextLang === 'en' ? 'en' : 'ar';
      if (Number.isInteger(nextYear)) child.birthYear = nextYear;
      if (Number.isInteger(nextMonth) && nextMonth >= 1 && nextMonth <= 12) child.birthMonth = nextMonth;
    } else {
      const check = validateChildProfileInput({
        displayName: nextName,
        ageGroup: nextAge,
        language: nextLang,
        birthYear: nextYear,
        birthMonth: nextMonth,
      });
      if (!check.ok || !check.clean) {
        return res.status(400).json({ error: check.error });
      }
      child.displayName = check.clean.displayName;
      child.ageGroup = check.clean.ageGroup;
      child.language = check.clean.language;
      child.birthYear = check.clean.birthYear;
      child.birthMonth = check.clean.birthMonth;
    }

    const prevSnapshot = {
      displayName: child.displayName,
      ageGroup: child.ageGroup,
      language: child.language,
      aiAssistantEnabled: child.aiAssistantEnabled !== false,
    };
    if (patch.companionScarfColor && /^#[0-9A-Fa-f]{6}$/.test(patch.companionScarfColor)) {
      child.companionScarfColor = patch.companionScarfColor;
    }
    if (typeof patch.aiAssistantEnabled === 'boolean') {
      child.aiAssistantEnabled = patch.aiAssistantEnabled;
    }
    recordAuditEvent(db, {
      eventType: 'CHILD_PROFILE_CHANGE',
      actorId: req.authSession!.user.id,
      actorRole: req.authSession!.user.role,
      actionType: 'UPDATE_CHILD_PROFILE',
      recordType: 'child_profile',
      recordId: child.id,
      previousValue: prevSnapshot,
      newValue: {
        displayName: child.displayName,
        ageGroup: child.ageGroup,
        language: child.language,
        aiAssistantEnabled: child.aiAssistantEnabled !== false,
      },
      ip: getClientIp(req),
      summary: `Updated child profile ${child.id}`,
    });
    saveDb(db);
    res.json({ child: toSafeChildProfile(db, child) });
  });

  app.delete('/api/children/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (!requireParentGate(req, res)) return;
    if (isChildOrStudentRole(req.authSession!.user.role) || req.authSession!.user.role === 'teacher') {
      return res.status(403).json({ error: 'Forbidden: only parents may delete child profiles' });
    }
    const child = assertChildAccess(req, res, req.params.id);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child profile not found' });
      return;
    }
    const famId = ensureChildFamilyAndGarden(db, child);
    ensureFamilyCollections(db);
    db.archivedChildren![child.id] = {
      childId: child.id,
      familyId: famId,
      parentId: child.parentId,
      displayName: child.displayName,
      deletedByUserId: req.authSession!.user.id,
      deletedAt: new Date().toISOString(),
      reason: 'Parent deleted child profile',
    };
    const cred = db.childCredentials?.[child.id];
    if (cred) {
      delete db.childAccessCodeIndex![cred.accessCodeHash];
      delete db.childCredentials![child.id];
    }
    for (const linkedUser of Object.values(db.users)) {
      if (isChildOrStudentRole(linkedUser.role) && linkedUser.linkedChildId === child.id) {
        revokeAllUserSessions(linkedUser.id);
        linkedUser.status = 'suspended';
      }
    }
    recordAuditEvent(db, {
      eventType: 'CHILD_PROFILE_CHANGE',
      actorId: req.authSession!.user.id,
      actorRole: req.authSession!.user.role,
      actionType: 'DELETE_CHILD_PROFILE',
      recordType: 'child_profile',
      recordId: child.id,
      previousValue: { displayName: child.displayName, ageGroup: child.ageGroup },
      reason: 'Parent deleted child profile',
      ip: getClientIp(req),
      summary: `Deleted child profile ${child.id} (${child.displayName})`,
    });
    delete db.children[child.id];
    saveDb(db);
    res.json({ deleted: true });
  });

  // ------------------------------------------------------------------
  // 1. PUBLIC EXAM CONFIG & PUBLISHED CMS CONTENT
  // ------------------------------------------------------------------
  app.get('/api/config/exams', (_req, res) => {
    const db = getDb();
    res.json(db.examConfig);
  });

  app.get('/api/cms/content', (_req, res) => {
    const db = getDb();
    res.json({
      lessons: db.customLessons.filter((l) => l.published),
      customQuestionsCount: db.customQuestions.filter((q) => q.published !== false).length,
    });
  });

  // ------------------------------------------------------------------
  // 1B. LEVEL 1 BACKEND-GRADED ASSESSMENT ENGINE (75 LESSONS / 750 QS)
  // ------------------------------------------------------------------
  app.post('/api/level1/assessment/start', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const authUser = req.authSession!.user;
    if (
      authUser.status !== 'active' ||
      (authUser.role !== 'parent' && !isChildOrStudentRole(authUser.role) && authUser.role !== 'super_admin')
    ) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: authUser.id,
        role: authUser.role,
        ip: getClientIp(req),
        summary: `Blocked Level 1 assessment start for unauthorized role ${authUser.role}`,
      });
      saveDb(db);
      return res.status(403).json({ error: 'Forbidden: not authorized to start child assessments' });
    }

    const { childId, lessonId, questionCount } = req.body as {
      childId?: string;
      lessonId?: string;
      questionCount?: number;
    };

    if (!childId || typeof childId !== 'string') {
      return res.status(400).json({ error: 'childId is required' });
    }

    const access = assertChildAccess(req, res, childId);
    if (!access || access === 'untracked-sample') {
      if (access === 'untracked-sample') {
        return res.status(404).json({ error: 'Child profile not found' });
      }
      return;
    }

    if (!lessonId || typeof lessonId !== 'string') {
      return res.status(400).json({ error: 'lessonId is required' });
    }

    const lesson = getLevel1LessonById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Level 1 lesson not found' });
    }

    const pool = getQuestionsForLevel1Lesson(lessonId);
    if (pool.length === 0) {
      return res.status(404).json({ error: 'No assessment items found for this lesson' });
    }

    // Include unseen-example + independent challenge, plus shuffled core items without duplicates
    const core = pool.filter((q) => q.qType !== 'new-example' && q.qType !== 'independent');
    const extras = pool.filter((q) => q.qType === 'new-example' || q.qType === 'independent');
    const shuffledCore = [...core].sort(() => Math.random() - 0.5);
    const target = Math.min(pool.length, Math.max(4, questionCount || 6));
    const selected = [...shuffledCore.slice(0, Math.max(2, target - extras.length)), ...extras].slice(0, target);

    const attemptId = `l1_${crypto.randomBytes(6).toString('hex')}`;
    db.level1Attempts[attemptId] = {
      id: attemptId,
      childId,
      parentId: req.authSession?.user.id,
      lessonId,
      questionIds: selected.map((q) => q.id),
      submitted: false,
      createdAt: new Date().toISOString(),
    };
    saveDb(db);

    const sanitized = selected.map(({ correctOptionId: _c, feedbackOnWrong: _f, ...rest }) => rest);
    res.json({
      attemptId,
      lessonId,
      totalQuestions: sanitized.length,
      passingPercentage: 80,
      questions: sanitized,
    });
  });

  app.post('/api/level1/assessment/submit', async (req: AuthenticatedRequest, res) => {
    const { attemptId, answers = {} } = req.body as {
      attemptId?: string;
      answers?: Record<string, string>;
    };

    const outcome = await runWithPgDbLock(`l1:${attemptId || 'none'}`, async (db) => {
      if (!attemptId || !db.level1Attempts[attemptId]) {
        return { status: 404, body: { error: 'Level 1 assessment attempt not found' } };
      }

      const attempt = db.level1Attempts[attemptId];
      if (attempt.parentId) {
        if (!req.authSession) {
          return { status: 401, body: { error: 'Authentication required' } };
        }
        if (attempt.parentId !== req.authSession.user.id && req.authSession.user.role !== 'super_admin') {
          return { status: 403, body: { error: 'Forbidden: assessment belongs to another parent' } };
        }
      }

      if (attempt.submitted && attempt.result) {
        return { status: 200, body: { ...attempt.result, review: [], duplicateBlocked: true } };
      }

      const bankMap = new Map(LEVEL1_QUESTION_BANK.map((q) => [q.id, q]));
      let score = 0;

      const review = attempt.questionIds.map((qId) => {
        const q = bankMap.get(qId);
        const rawSelected = typeof answers[qId] === 'string' ? answers[qId] : '';
        const validOpt = q?.options.some((o) => o.id === rawSelected);
        const selectedOptionId = validOpt ? rawSelected : '';
        const isCorrect = Boolean(q && selectedOptionId === q.correctOptionId);
        if (isCorrect) score += 1;
        return {
          questionId: qId,
          prompt: q?.prompt || { ar: '', en: '' },
          selectedOptionId,
          correctOptionId: q?.correctOptionId || '',
          isCorrect,
          feedbackOnWrong: q?.feedbackOnWrong || { ar: '', en: '' },
        };
      });

      const totalQuestions = attempt.questionIds.length || 1;
      const percentage = Math.round((score / totalQuestions) * 100);
      const demonstrated = percentage >= 80;
      const status: Level1LessonProgress['status'] = demonstrated ? 'demonstrated' : 'needs-revision';
      const revisionHours = demonstrated ? 48 : 12;
      const revisionDueAt = new Date(Date.now() + revisionHours * 3600_000).toISOString();

      const result = {
        score,
        totalQuestions,
        percentage,
        demonstrated,
        status,
        revisionDueAt,
      };

      attempt.submitted = true;
      attempt.result = result;

      // Persist progress to stored child record if applicable
      const storedChild = db.children[attempt.childId];
      const lesson = getLevel1LessonById(attempt.lessonId);
      if (storedChild && lesson) {
        const prevMap = storedChild.level1Progress || {};
        const prev = prevMap[lesson.id];
        const mistakesInThis = totalQuestions - score;
        storedChild.level1Progress = {
          ...prevMap,
          [lesson.id]: {
            lessonId: lesson.id,
            subject: lesson.subject,
            startedAt: prev?.startedAt || attempt.createdAt,
            explanationViewed: true,
            completedActivityIds: prev?.completedActivityIds || lesson.activityFormats,
            correctCount: (prev?.correctCount || 0) + score,
            mistakesCount: (prev?.mistakesCount || 0) + mistakesInThis,
            lastScore: score,
            lastTotal: totalQuestions,
            attemptsCount: (prev?.attemptsCount || 0) + 1,
            status:
              prev?.status === 'demonstrated' && !demonstrated
                ? 'needs-revision'
                : status,
            lastPracticedAt: new Date().toISOString(),
            revisionDueAt,
          },
        };
        storedChild.stars += demonstrated ? 4 : 2;
      }

      return { status: 200, body: { ...result, review } };
    });

    return res.status(outcome.status).json(outcome.body);
  });

  // ------------------------------------------------------------------
  // 2. SECURE BACKEND PAYMENT CHECKOUT & VERIFICATION (50 EGP default)
  // ------------------------------------------------------------------
  app.post('/api/payments/create-checkout', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const authUser = req.authSession!.user;
    if (
      authUser.status !== 'active' ||
      isChildOrStudentRole(authUser.role) ||
      req.authSession!.session.sessionKind === 'child' ||
      (authUser.role !== 'parent' && authUser.role !== 'super_admin')
    ) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: authUser.id,
        role: authUser.role,
        ip: getClientIp(req),
        summary: `Blocked non-parent checkout attempt by role ${authUser.role}`,
      });
      saveDb(db);
      return res.status(403).json({ error: 'Forbidden: only active parents may create payment checkouts' });
    }

    if (!db.featureFlags.paidAssessmentsEnabled) {
      return res.status(403).json({
        error: 'Paid assessments are currently disabled by administrator',
        featureDisabled: 'paidAssessmentsEnabled',
      });
    }

    const { childId, subject, parentConfirmed } = req.body as {
      childId?: string;
      subject?: ExamSubject;
      parentConfirmed?: boolean;
    };

    if (!childId || typeof childId !== 'string') {
      return res.status(400).json({ error: 'childId is required' });
    }

    const access = assertChildAccess(req, res, childId);
    if (!access || access === 'untracked-sample') {
      if (access === 'untracked-sample') {
        return res.status(404).json({ error: 'Child profile not found' });
      }
      return;
    }

    if (authUser.role !== 'super_admin' && !canUserAccessChild(db, authUser, access, 'manage_learning_settings')) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: authUser.id,
        role: authUser.role,
        ip: getClientIp(req),
        summary: `Blocked checkout without guardian manage_learning_settings permission for child ${childId}`,
      });
      saveDb(db);
      return res.status(403).json({ error: 'Forbidden: insufficient guardian permissions to create checkout' });
    }

    if (parentConfirmed !== true) {
      return res.status(400).json({ error: 'Parental confirmation is required' });
    }

    const allowedSubjects: ExamSubject[] = ['comprehensive', 'arabic', 'english', 'math', 'colors-science'];
    const safeSubject: ExamSubject = allowedSubjects.includes(subject as ExamSubject)
      ? (subject as ExamSubject)
      : 'comprehensive';

    const sessionId = `chk_${crypto.randomBytes(6).toString('hex')}`;
    const session: CheckoutSession = {
      id: sessionId,
      childId,
      parentId: authUser.id,
      subject: safeSubject,
      amountEgp: db.examConfig.examPriceEgp, // Always authoritative from server DB!
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.checkoutSessions[sessionId] = session;
    saveDb(db);

    res.json({
      checkoutSessionId: sessionId,
      amountEgp: session.amountEgp,
      currency: db.examConfig.currency,
      gatewayMode: db.examConfig.paymentGatewayMode,
    });
  });

  app.post('/api/payments/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
    const preDb = getDb();
    const authUser = req.authSession!.user;
    if (
      authUser.status !== 'active' ||
      isChildOrStudentRole(authUser.role) ||
      req.authSession!.session.sessionKind === 'child' ||
      (authUser.role !== 'parent' && authUser.role !== 'super_admin')
    ) {
      appendSecurityLog(preDb.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: authUser.id,
        role: authUser.role,
        ip: getClientIp(req),
        summary: `Blocked non-parent payment verification attempt by role ${authUser.role}`,
      });
      saveDb(preDb);
      return res.status(403).json({ error: 'Forbidden: only active parents may verify payment checkouts' });
    }

    if (!preDb.featureFlags.paidAssessmentsEnabled) {
      return res.status(403).json({
        error: 'Paid assessments are currently disabled by administrator',
        featureDisabled: 'paidAssessmentsEnabled',
      });
    }

    const { checkoutSessionId } = req.body as { checkoutSessionId?: string };
    if (!checkoutSessionId || typeof checkoutSessionId !== 'string') {
      return res.status(400).json({ error: 'checkoutSessionId is required' });
    }

    const outcome = await runWithPgDbLock(`chk:${checkoutSessionId}`, async (db) => {
      const session = db.checkoutSessions[checkoutSessionId];
      if (!session) {
        return { status: 404, body: { error: 'Checkout session not found' } };
      }

      if (!session.parentId || (session.parentId !== authUser.id && authUser.role !== 'super_admin')) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'ACCESS_DENIED',
          actorId: authUser.id,
          role: authUser.role,
          ip: getClientIp(req),
          summary: `Blocked cross-parent payment verification for checkout ${checkoutSessionId}`,
        });
        return { status: 403, body: { error: 'Forbidden: checkout belongs to another parent' } };
      }

      const child = db.children[session.childId];
      if (authUser.role !== 'super_admin' && (!child || !canUserAccessChild(db, authUser, child, 'manage_learning_settings'))) {
        return { status: 403, body: { error: 'Forbidden: insufficient guardian permissions for this child' } };
      }

      if (db.examConfig.paymentGatewayMode === 'live-gateway') {
        return {
          status: 501,
          body: {
            error: 'Live payment gateway signature/provider verification is not configured on this server',
            code: 'LIVE_GATEWAY_NOT_CONFIGURED',
          },
        };
      }

      if (session.tokenConsumed || session.status === 'verified' || session.paymentToken) {
        return { status: 409, body: { error: 'Checkout session has already been verified or consumed' } };
      }

      session.status = 'verified';
      session.verifiedAt = new Date().toISOString();
      session.paymentToken = `paytok_${crypto.randomBytes(12).toString('hex')}`;
      appendSecurityLog(db.securityLogs, {
        eventType: 'PAYMENT_VERIFIED',
        actorId: authUser.id,
        ip: getClientIp(req),
        summary: `Verified ${session.amountEgp} ${db.examConfig.currency} exam checkout ${session.id}`,
      });

      return {
        status: 200,
        body: {
          verified: true,
          checkoutSessionId: session.id,
          amountPaidEgp: session.amountEgp,
          paymentVerificationToken: session.paymentToken,
          gatewayMode: db.examConfig.paymentGatewayMode,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  });

  // ------------------------------------------------------------------
  // 3. BACKEND-VERIFIED 40-QUESTION EXAM ENGINE & GRADING
  // ------------------------------------------------------------------
  app.post('/api/exams/start', async (req: AuthenticatedRequest, res) => {
    const {
      childId,
      childName,
      ageGroup: rawAgeGroup,
      subject = 'comprehensive',
      mode = 'practice',
      questionCount,
      paymentVerificationToken,
      studiedConceptIds = [],
    } = req.body as {
      childId?: string;
      childName?: string;
      ageGroup?: StoredAgeGroupId;
      subject?: ExamSubject;
      mode?: 'practice' | 'official';
      questionCount?: number;
      paymentVerificationToken?: string;
      studiedConceptIds?: string[];
    };

    if (!childId) {
      return res.status(400).json({ error: 'childId is required' });
    }

    const outcome = await runWithPgDbLock(`exam-start:${childId}`, async (db) => {
      const access = assertChildAccess(req, res, childId);
      if (!access) return null;

      const childRecord = access !== 'untracked-sample' ? access : undefined;
      const resolvedAge: StoredAgeGroupId =
        rawAgeGroup === '3-4'
          ? UNIFIED_STAGE_ID
          : rawAgeGroup || childRecord?.ageGroup || UNIFIED_STAGE_ID;

      let paidAmount = 0;
      let paymentVerified = false;

      if (mode === 'official') {
        const matchedSession = Object.values(db.checkoutSessions).find(
          (s) =>
            s.status === 'verified' &&
            s.paymentToken === paymentVerificationToken &&
            !s.tokenConsumed &&
            s.childId === childId,
        );
        if (!matchedSession) {
          return {
            status: 402,
            body: { error: 'Official exam requires verified server payment confirmation' },
          };
        }
        matchedSession.tokenConsumed = true;
        paymentVerified = true;
        paidAmount = matchedSession.amountEgp;
      }

      const fullBank = [
        ...db.customQuestions.filter((q) => q.published !== false),
        ...VALIDATED_EXAM_BANK.filter((q) => q.published !== false),
      ];

      const ageFiltered = fullBank.filter(
        (q) =>
          q.ageGroups.includes(resolvedAge) &&
          (subject === 'comprehensive' ? true : q.subject === subject),
      );

      const seen = new Set<string>();
      const uniquePool: ExamQuestionItem[] = [];
      for (const q of ageFiltered) {
        if (!seen.has(q.id)) {
          seen.add(q.id);
          uniquePool.push(q);
        }
      }

      const safeStudied = Array.isArray(studiedConceptIds) ? studiedConceptIds : [];
      const prioritized = uniquePool.sort((a, b) => {
        if (childRecord) {
          const aFit = isContentAppropriateForChild(a, childRecord) ? -1 : 0;
          const bFit = isContentAppropriateForChild(b, childRecord) ? -1 : 0;
          if (aFit !== bFit) return aFit - bFit;
        }
        const aStudied = safeStudied.some((id) => a.lessonRefId.includes(id)) ? -1 : 0;
        const bStudied = safeStudied.some((id) => b.lessonRefId.includes(id)) ? -1 : 0;
        if (aStudied !== bStudied) return aStudied - bStudied;
        return Math.random() - 0.5;
      });

      const targetCount =
        mode === 'official'
          ? db.examConfig.questionsPerExam
          : Math.min(questionCount || 10, db.examConfig.questionsPerExam);

      const selected = prioritized.slice(0, Math.min(targetCount, prioritized.length));

      const attemptId = `ex_${crypto.randomBytes(6).toString('hex')}`;
      db.examAttempts[attemptId] = {
        id: attemptId,
        childId,
        parentId: req.authSession?.user.id,
        childName: sanitizeShortText(childName || 'Explorer', 60) || 'Explorer',
        ageGroup: resolvedAge,
        subject,
        mode,
        questionIds: selected.map((q) => q.id),
        paymentVerified,
        amountPaidEgp: paidAmount,
        passingPercentage: db.examConfig.passingPercentage,
        submitted: false,
        createdAt: new Date().toISOString(),
      };

      const sanitizedQuestions = selected.map(({ correctOptionId: _c, explanation: _e, ...rest }) => rest);

      return {
        status: 200,
        body: {
          attemptId,
          mode,
          subject,
          ageGroup: resolvedAge,
          totalQuestions: sanitizedQuestions.length,
          passingPercentage: db.examConfig.passingPercentage,
          questions: sanitizedQuestions,
        },
      };
    });

    if (!outcome) return;
    return res.status(outcome.status).json(outcome.body);
  });

  app.post('/api/exams/submit', async (req: AuthenticatedRequest, res) => {
    const { attemptId, answers = {} } = req.body as {
      attemptId?: string;
      answers?: Record<string, string>;
    };

    const outcome = await runWithPgDbLock(`exam-submit:${attemptId || 'none'}`, async (db) => {
      if (!attemptId || !db.examAttempts[attemptId]) {
        return { status: 404, body: { error: 'Exam attempt not found' } };
      }

      const attempt = db.examAttempts[attemptId];
      if (attempt.parentId) {
        if (!req.authSession) {
          return { status: 401, body: { error: 'Authentication required' } };
        }
        if (attempt.parentId !== req.authSession.user.id && req.authSession.user.role !== 'super_admin') {
          return { status: 403, body: { error: 'Forbidden: exam attempt belongs to another parent' } };
        }
      }

      if (attempt.submitted && attempt.summary) {
        const existingCert = attempt.certificateCode ? db.certificates[attempt.certificateCode] : undefined;
        return {
          status: 200,
          body: {
            summary: attempt.summary,
            certificate: existingCert,
            review: [],
            duplicateBlocked: true,
          },
        };
      }

      const fullBank = [...db.customQuestions, ...VALIDATED_EXAM_BANK];
      const bankMap = new Map(fullBank.map((q) => [q.id, q]));

      let correctCount = 0;
      const weakLessonsMap = new Map<string, LocalizedText>();

      const review = attempt.questionIds.map((qId) => {
        const q = bankMap.get(qId);
        const rawSelected = typeof answers[qId] === 'string' ? answers[qId] : '';
        const validOpt = q?.options.some((o) => o.id === rawSelected);
        const selectedOptionId = validOpt ? rawSelected : '';
        const isCorrect = Boolean(q && selectedOptionId === q.correctOptionId);
        if (isCorrect) {
          correctCount += 1;
        } else if (q) {
          weakLessonsMap.set(q.lessonRefId, q.lessonTitle);
        }
        return {
          questionId: qId,
          prompt: q?.prompt || { ar: '', en: '' },
          selectedOptionId,
          correctOptionId: q?.correctOptionId || '',
          isCorrect,
          explanation: q?.explanation || { ar: '', en: '' },
          lessonTitle: q?.lessonTitle || { ar: '', en: '' },
        };
      });

      const total = attempt.questionIds.length || 1;
      const percentage = Math.round((correctCount / total) * 100);
      const passed = percentage >= attempt.passingPercentage;
      const weakLessonTitles = Array.from(weakLessonsMap.values()).slice(0, 6);

      let issuedCert: Certificate | undefined;

      if (attempt.mode === 'official' && attempt.paymentVerified && passed && db.featureFlags.certificatesEnabled) {
        const uniqueCode = `NLC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const meta = subjectToWorld(attempt.subject);
        issuedCert = {
          id: `cert-${attempt.id}`,
          uniqueCode,
          childName: attempt.childName,
          worldId: meta.worldId,
          worldName: meta.worldName,
          achievementTitle: {
            ar: `شهادة اجتياز الامتحان الرسمي — ${meta.worldName.ar}`,
            en: `Official Certified Exam — ${meta.worldName.en}`,
          },
          issuedAt: new Date().toISOString(),
          levelCompleted: attempt.ageGroup === '8' ? 4 : attempt.ageGroup === '7' ? 3 : attempt.ageGroup === '5-6' ? 2 : 1,
          isOfficialExam: true,
          examSubject: attempt.subject,
          score: correctCount,
          totalQuestions: total,
          percentage,
          passingPercentage: attempt.passingPercentage,
          ageGroup: attempt.ageGroup,
          verificationUrl: `/api/certificates/verify/${uniqueCode}`,
        };
        db.certificates[uniqueCode] = issuedCert;
        attempt.certificateCode = uniqueCode;
        appendSecurityLog(db.securityLogs, {
          eventType: 'CERT_ISSUED',
          actorId: attempt.parentId,
          ip: getClientIp(req),
          summary: `Issued certificate ${uniqueCode} (${correctCount}/${total})`,
        });
      }

      const summary: ExamAttemptSummary = {
        id: attempt.id,
        childId: attempt.childId,
        childName: attempt.childName,
        ageGroup: attempt.ageGroup,
        subject: attempt.subject,
        mode: attempt.mode,
        score: correctCount,
        totalQuestions: total,
        percentage,
        passed,
        passingPercentage: attempt.passingPercentage,
        weakLessonTitles,
        certificateCode: issuedCert?.uniqueCode,
        completedAt: new Date().toISOString(),
        paymentVerified: attempt.paymentVerified,
        amountPaidEgp: attempt.amountPaidEgp,
      };

      attempt.submitted = true;
      attempt.summary = summary;
      appendSecurityLog(db.securityLogs, {
        eventType: 'EXAM_COMPLETED',
        actorId: attempt.parentId,
        ip: getClientIp(req),
        summary: `Completed ${attempt.mode} exam (${correctCount}/${total} = ${percentage}%)`,
      });

      return {
        status: 200,
        body: {
          summary,
          certificate: issuedCert,
          review,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  });

  // ------------------------------------------------------------------
  // 4. CERTIFICATE VERIFICATION ENDPOINT
  // ------------------------------------------------------------------
  app.get('/api/certificates/verify/:code', (req, res) => {
    const db = getDb();
    const code = (req.params.code || '').trim().toUpperCase();
    const cert = db.certificates[code];
    if (!cert) {
      return res.status(404).json({ valid: false, error: 'Certificate not found' });
    }
    res.json({
      valid: !cert.revoked,
      revoked: Boolean(cert.revoked),
      certificate: cert,
    });
  });

  // ------------------------------------------------------------------
  // 5. ADMIN CONTENT MANAGEMENT SYSTEM & RBAC APIs
  // ------------------------------------------------------------------
  app.get('/api/admin/overview', requireAdminPermission('manage_lessons'), (_req, res) => {
    const db = getDb();
    const attempts = Object.values(db.examAttempts)
      .filter((a) => a.submitted && a.summary)
      .map((a) => a.summary!);
    const certificates = Object.values(db.certificates);
    res.json({
      examConfig: db.examConfig,
      customLessons: db.customLessons,
      customQuestions: db.customQuestions,
      builtInQuestionsCount: VALIDATED_EXAM_BANK.length,
      certificates,
      examAttempts: attempts,
    });
  });

  app.get('/api/admin/security-logs', requireAdminPermission('view_security_logs'), (_req, res) => {
    const db = getDb();
    res.json({ logs: db.securityLogs.slice(0, 100) });
  });

  app.post('/api/admin/users/role', requireAdminPermission('view_security_logs'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const { userId, role } = req.body as { userId?: string; role?: UserRole };
    const allowed: UserRole[] = [
      'parent',
      'student',
      'teacher',
      'support_agent',
      'content_admin',
      'curriculum_manager',
      'finance_admin',
      'admin',
      'super_admin',
    ];
    if (!userId || !db.users[userId] || !role || !allowed.includes(role)) {
      return res.status(400).json({ error: 'Valid userId and role are required' });
    }
    if ((role === 'super_admin' || role === 'admin') && req.authSession && req.authSession.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Administrators can assign admin or super_admin roles.' });
    }
    const prevRole = db.users[userId].role;
    db.users[userId].role = role;
    db.users[userId].updatedAt = new Date().toISOString();
    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role || 'admin',
      actionType: 'UPDATE_USER_ROLE',
      recordType: 'user_role',
      recordId: userId,
      previousValue: { role: prevRole },
      newValue: { role },
      reason: 'Administrator updated user role',
      ip: getClientIp(req),
      summary: `Updated role for ${userId}: ${prevRole} -> ${role}`,
    });
    saveDb(db);
    res.json({ user: toSafeUser(db.users[userId]) });
  });

  app.put('/api/admin/exam-config', requireAdminPermission('manage_exam_config'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const prevCfg = { ...db.examConfig };
    const { examPriceEgp, passingPercentage, questionsPerExam } = req.body as Partial<ExamConfig>;
    if (typeof examPriceEgp === 'number' && examPriceEgp >= 0 && examPriceEgp <= 5000) {
      db.examConfig.examPriceEgp = Math.round(examPriceEgp);
    }
    if (typeof passingPercentage === 'number' && passingPercentage >= 50 && passingPercentage <= 100) {
      db.examConfig.passingPercentage = Math.round(passingPercentage);
    }
    if (typeof questionsPerExam === 'number' && questionsPerExam >= 10 && questionsPerExam <= 60) {
      db.examConfig.questionsPerExam = Math.round(questionsPerExam);
    }
    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role || 'admin',
      actionType: 'UPDATE_EXAM_CONFIG',
      recordType: 'exam_config',
      recordId: 'global',
      previousValue: prevCfg,
      newValue: db.examConfig,
      ip: getClientIp(req),
      summary: `Updated exam config (price=${db.examConfig.examPriceEgp}, pass=${db.examConfig.passingPercentage}%)`,
    });
    saveDb(db);
    res.json(db.examConfig);
  });

  app.post('/api/admin/lessons', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    const body = req.body as Omit<CmsLessonRecord, 'id' | 'updatedAt'>;
    if (!body?.title?.ar || !body?.title?.en) {
      return res.status(400).json({ error: 'Lesson title (ar and en) is required' });
    }
    const lesson: CmsLessonRecord = {
      ...body,
      ageGroups: ['1-4'],
      recommendedAgeRange: sanitizeRecommendedAgeRange(body.recommendedAgeRange),
      title: {
        ar: sanitizeShortText(body.title.ar, 120),
        en: sanitizeShortText(body.title.en, 120),
      },
      summary: {
        ar: sanitizeShortText(body.summary?.ar || body.title.ar, 500),
        en: sanitizeShortText(body.summary?.en || body.title.en, 500),
      },
      id: `cms-lesson-${crypto.randomBytes(4).toString('hex')}`,
      updatedAt: new Date().toISOString(),
    };
    db.customLessons.unshift(lesson);
    saveDb(db);
    res.json(lesson);
  });

  app.patch('/api/admin/lessons/:id', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    const idx = db.customLessons.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Lesson not found' });
    const nextRecRange = req.body?.recommendedAgeRange
      ? sanitizeRecommendedAgeRange(req.body.recommendedAgeRange)
      : db.customLessons[idx].recommendedAgeRange || '1-4';
    db.customLessons[idx] = {
      ...db.customLessons[idx],
      ...req.body,
      ageGroups: ['1-4'],
      recommendedAgeRange: nextRecRange,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json(db.customLessons[idx]);
  });

  app.delete('/api/admin/lessons/:id', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    db.customLessons = db.customLessons.filter((l) => l.id !== req.params.id);
    saveDb(db);
    res.json({ deleted: true });
  });

  app.post('/api/admin/questions', requireAdminPermission('manage_questions'), (req, res) => {
    const db = getDb();
    const body = req.body as Omit<ExamQuestionItem, 'id'>;
    if (!body?.prompt?.ar || !Array.isArray(body.options) || body.options.length < 2) {
      return res.status(400).json({ error: 'Question prompt and at least 2 options are required' });
    }
    const question: ExamQuestionItem = {
      ...body,
      ageGroups: ['1-4'],
      recommendedAgeRange: sanitizeRecommendedAgeRange(body.recommendedAgeRange),
      id: `cms-q-${crypto.randomBytes(4).toString('hex')}`,
      published: body.published ?? true,
    };
    db.customQuestions.unshift(question);
    saveDb(db);
    res.json(question);
  });

  app.patch('/api/admin/questions/:id', requireAdminPermission('manage_questions'), (req, res) => {
    const db = getDb();
    const idx = db.customQuestions.findIndex((q) => q.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Question not found' });
    const nextRecRange = req.body?.recommendedAgeRange
      ? sanitizeRecommendedAgeRange(req.body.recommendedAgeRange)
      : db.customQuestions[idx].recommendedAgeRange || '1-4';
    db.customQuestions[idx] = {
      ...db.customQuestions[idx],
      ...req.body,
      ageGroups: ['1-4'],
      recommendedAgeRange: nextRecRange,
    };
    saveDb(db);
    res.json(db.customQuestions[idx]);
  });

  app.delete('/api/admin/questions/:id', requireAdminPermission('manage_questions'), (req, res) => {
    const db = getDb();
    db.customQuestions = db.customQuestions.filter((q) => q.id !== req.params.id);
    saveDb(db);
    res.json({ deleted: true });
  });

  app.patch('/api/admin/certificates/:code', requireAdminPermission('manage_certificates'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const cert = db.certificates[req.params.code];
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    const prevRevoked = Boolean(cert.revoked);
    cert.revoked = Boolean(req.body.revoked);
    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role || 'admin',
      actionType: cert.revoked ? 'REVOKE_CERTIFICATE' : 'RESTORE_CERTIFICATE',
      recordType: 'certificate',
      recordId: cert.uniqueCode,
      previousValue: { revoked: prevRevoked },
      newValue: { revoked: cert.revoked },
      ip: getClientIp(req),
      summary: `Certificate ${cert.uniqueCode} revoked=${cert.revoked}`,
    });
    saveDb(db);
    res.json(cert);
  });

  // ------------------------------------------------------------------
  // 6. SERVER-SIDE YOUTUBE STATUS (@Future-p6l)
  // ------------------------------------------------------------------
  app.get('/api/youtube/status', async (_req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const channelHandle = '@Future-p6l';
    const channelUrl = 'https://www.youtube.com/@Future-p6l';

    if (!apiKey) {
      return res.json({
        configured: false,
        channelHandle,
        channelUrl,
        videos: [],
      });
    }

    try {
      const chUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
      chUrl.searchParams.set('part', 'contentDetails,snippet');
      chUrl.searchParams.set('forHandle', 'Future-p6l');
      chUrl.searchParams.set('key', apiKey);

      const chRes = await fetch(chUrl.toString());
      if (!chRes.ok) {
        return res.json({ configured: true, error: 'YouTube API request failed', channelHandle, channelUrl, videos: [] });
      }
      const chData = (await chRes.json()) as {
        items?: Array<{
          contentDetails?: { relatedPlaylists?: { uploads?: string } };
        }>;
      };
      const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        return res.json({ configured: true, channelHandle, channelUrl, videos: [] });
      }

      const plUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      plUrl.searchParams.set('part', 'snippet');
      plUrl.searchParams.set('maxResults', '12');
      plUrl.searchParams.set('playlistId', uploadsPlaylistId);
      plUrl.searchParams.set('key', apiKey);

      const plRes = await fetch(plUrl.toString());
      if (!plRes.ok) {
        return res.json({ configured: true, channelHandle, channelUrl, videos: [] });
      }
      const plData = (await plRes.json()) as {
        items?: Array<{
          snippet?: {
            title?: string;
            publishedAt?: string;
            resourceId?: { videoId?: string };
          };
        }>;
      };

      const videos = (plData.items || [])
        .filter((item) => item.snippet?.resourceId?.videoId)
        .map((item) => {
          const vid = item.snippet!.resourceId!.videoId!;
          const rawTitle = item.snippet!.title || 'NonoLand Video';
          return {
            id: `yt-api-${vid}`,
            videoId: vid,
            title: { ar: rawTitle, en: rawTitle },
            category: 'adventures',
            ageGroups: ['1-4'],
            approvedByParent: true,
            featured: false,
            addedAt: item.snippet!.publishedAt || new Date().toISOString(),
          };
        });

      return res.json({
        configured: true,
        channelHandle,
        channelUrl,
        videos,
      });
    } catch {
      return res.json({
        configured: true,
        channelHandle,
        channelUrl,
        videos: [],
      });
    }
  });

  registerAdminRoutes({
    app,
    getDb,
    saveDb,
    isProd: IS_PROD,
    requireAdminPermission,
    createSessionForUser,
    revokeAllUserSessions,
    toSafeUser,
  });

  registerTeacherAndLevel2Routes({
    app,
    getDb,
    saveDb,
    requireAuth,
    requireAdminPermission,
    assertChildAccess,
    createSessionForUser,
    revokeAllUserSessions,
    toSafeUser,
  });

  registerGovernanceAndHomeworkRoutes({
    app,
    getDb,
    setDb: setPgContextDb,
    saveDb,
    requireAuth,
    requireAdminPermission,
  });

  registerWorldExperienceRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    assertChildAccess,
  });

  registerImmutableAuditGuards(app, requireAdminPermission);

  registerNonoAiRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    assertChildAccess,
  });

  registerAcademyAudioRoutes({ app });

  registerSmartAssessmentRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    assertChildAccess,
  });

  registerFamilyAuthRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    createSessionForUser,
    revokeAllUserSessions,
    toSafeUser,
    isProd: IS_PROD,
  });

  registerPasskeyRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    createSessionForUser,
    toSafeUser,
  });

  registerFamilyEcosystemRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    isProd: IS_PROD,
  });

  registerLearningAndGardenRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    assertChildAccess,
  });

  registerReadingAndFamilyRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    assertChildAccess,
  });

  registerQuranRoutes({
    app,
    getDb,
    saveDb,
    requireAuth,
    assertChildAccess,
    requireAdminPermission,
  });

  registerLegalRoutes(app);

  app.use('/api', (_req, res) => {
    return res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use(
    '/api',
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('Unhandled /api error:', (err as Error)?.message || err);
      if (res.headersSent) return;
      const msg = String((err as Error)?.message || '');
      if (/postgres|database|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|SSL|28P01|42P01/i.test(msg)) {
        return res.status(503).json({
          error: 'Database unavailable. Failing closed for data safety.',
          code: 'DB_UNAVAILABLE',
        });
      }
      return res.status(500).json({ error: 'Internal server error.' });
    },
  );

  apiRoutesReady = true;
  const httpServer = http.createServer(app);

  // Dedicated /assets handler: enforces safe paths, strict MIME types, GET/HEAD + RFC-7233 byte-range 206,
  // DB-to-disk story audio hydration/repair, and fail-closed 404 JSON (never falling through to SPA HTML).
  const ASSET_MIME_MAP: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
    '.json': 'application/json; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };

  const publicAssetsRoot = path.resolve(process.cwd(), 'public', 'assets');
  const distAssetsRoot = path.resolve(process.cwd(), 'dist', 'assets');

  app.use('/assets', async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let decodedRelPath = '';
    try {
      decodedRelPath = decodeURIComponent(req.path || '/');
    } catch {
      return res.status(400).json({ error: 'Malformed asset path' });
    }

    if (!decodedRelPath || decodedRelPath.includes('\0') || decodedRelPath.includes('\\') || decodedRelPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid asset path' });
    }

    const relClean = decodedRelPath.replace(/^\/+/, '');
    if (!relClean) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Attempt DB hydration / container repair on-demand for story narration MP3s
    const storyMatch = parseLocalStoryAudioUrl(`/assets/${relClean}`);
    if (storyMatch) {
      await ensureStoryAudioOnDiskFromDb(storyMatch.storyId, storyMatch.sceneId).catch(() => false);
    }

    const resolveExistingUnderRoot = (rootDir: string): string | null => {
      const candidate = path.resolve(rootDir, relClean);
      if (!candidate.startsWith(rootDir + path.sep)) return null;
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        return null;
      }
      return null;
    };

    const publicFile = resolveExistingUnderRoot(publicAssetsRoot);
    const distFile = !publicFile && IS_PROD ? resolveExistingUnderRoot(distAssetsRoot) : null;
    const targetFile = publicFile || distFile;

    if (!targetFile) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(404).json({ error: 'Asset not found' });
    }

    const ext = path.extname(targetFile).toLowerCase();
    const mimeType = ASSET_MIME_MAP[ext] || 'application/octet-stream';
    const stat = fs.statSync(targetFile);
    const fileSize = stat.size;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Cache-Control',
      distFile ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    );

    const rangeHeader = req.headers.range;
    if (typeof rangeHeader === 'string' && rangeHeader.trim()) {
      const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!m || (!m[1] && !m[2])) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      let start = m[1] ? Number.parseInt(m[1], 10) : 0;
      let end = m[2] ? Number.parseInt(m[2], 10) : fileSize - 1;
      if (!m[1] && m[2]) {
        const suffixLen = Number.parseInt(m[2], 10);
        start = Math.max(0, fileSize - suffixLen);
        end = fileSize - 1;
      }
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end < start ||
        start >= fileSize ||
        fileSize === 0
      ) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(chunkSize));
      if (req.method === 'HEAD') {
        return res.end();
      }
      const stream = fs.createReadStream(targetFile, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      return stream.pipe(res);
    }

    res.status(200);
    res.setHeader('Content-Length', String(fileSize));
    if (req.method === 'HEAD') {
      return res.end();
    }
    const stream = fs.createReadStream(targetFile);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    return stream.pipe(res);
  });

  if (!IS_PROD && process.env.SKIP_VITE !== '1') {
    let resolvedVite: Awaited<ReturnType<typeof createViteServer>> | null = null;
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    })
      .then((vite) => {
        resolvedVite = vite;
        return vite;
      })
      .catch((err) => {
        console.error('Vite middleware initialization failed:', err);
        throw err;
      });

    app.use(async (req, res, next) => {
      if (/^\/api(?:\/|$)/i.test(req.path)) {
        return next();
      }
      try {
        const vite = resolvedVite ?? (await vitePromise);
        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  } else if (IS_PROD) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (/^\/api(?:\/|$)/i.test(req.path)) {
        return next();
      }
      return res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err) => {
    console.error('[ServerListenError] Express HTTP server error:', err);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    const addr = httpServer.address();
    actualListeningPort = typeof addr === 'object' && addr !== null ? addr.port : PORT;
    const rawEnvPort = process.env.PORT ? Number(process.env.PORT) : null;
    console.log(
      `[ServerListening] pid=${process.pid} envPort=${rawEnvPort !== null && Number.isFinite(rawEnvPort) ? rawEnvPort : 'unset'} listeningPort=${actualListeningPort} instanceId=${SERVER_INSTANCE_ID} serverReady=${apiRoutesReady} url=http://0.0.0.0:${actualListeningPort}`,
    );
    void checkPgHealthDetailed().then((health) => {
      if (health.healthy) {
        console.log(
          `[Startup DB] backend=${health.database} ssl=${health.sslEnabled} neon=${health.isNeonHost} pooled=${health.isPooledEndpoint} schemaReady=${health.schemaReady} quranSchemaReady=${health.quranSchemaReady ?? true}`,
        );
        if (
          process.env.GEMINI_API_KEY &&
          process.env.SKIP_VITE !== '1' &&
          process.env.SKIP_STORY_AUDIO_BACKFILL !== '1'
        ) {
          void runMissingStoryAudioBackfill({
            stories: QURAN_STORIES,
            getCmsSnapshot: async () => {
              const snap = await loadServerDbSnapshotPg();
              return snap.db.quranStoryCms || {};
            },
            persistSceneAudio: async (storyId, sceneId, url, durationSeconds) => {
              await runWithPgDbLock(`admin:quran-story:${storyId}`, async (lockedDb) => {
                ensureFamilyCollections(lockedDb);
                const prev = lockedDb.quranStoryCms![storyId] || {
                  storyId,
                  updatedAt: new Date().toISOString(),
                };
                const nextSceneOverrides = { ...(prev.sceneOverrides || {}) };
                const prevSc = nextSceneOverrides[sceneId] || { id: sceneId };
                nextSceneOverrides[sceneId] = {
                  ...prevSc,
                  id: sceneId,
                  narrationAudioUrl: url,
                  durationSeconds: durationSeconds
                    ? Math.max(10, Math.min(180, Math.round(durationSeconds)))
                    : prevSc.durationSeconds,
                };
                lockedDb.quranStoryCms![storyId] = {
                  ...prev,
                  storyId,
                  sceneOverrides: nextSceneOverrides,
                  updatedAt: new Date().toISOString(),
                };
              });
            },
          });
        }
      } else {
        console.error(
          `[Startup DB] UNAVAILABLE (fail-closed active): reason=${health.reason} errorCode=${health.errorCode || 'none'} missingEnvVars=${(health.missingEnvVars || []).join(',') || 'none'} ssl=${health.sslEnabled} schemaReady=${health.schemaReady} quranSchemaReady=${health.quranSchemaReady ?? false}`,
        );
      }
    });
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[ServerUnhandledRejection]', reason instanceof Error ? reason.stack || reason.message : reason);
});

startServer().catch((err) => {
  console.error('[ServerStartupFatal]', err);
  process.exitCode = 1;
});
