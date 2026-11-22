import crypto from 'crypto';
import type express from 'express';
import {
  POLICY_VERSION,
  sanitizeShortText,
  validateEmail,
  validateParentName,
  validatePassword,
  validateStrictAdminPassword,
} from '../src/utils/validation';
import type { AccountStatus, UserRole } from '../src/types/nonoland';
import { recordAuditEvent } from './auditLog';
import type { AuthenticatedRequest, ServerDb } from './dbTypes';
import { checkRateLimitPg, getDbStorageInfo, runWithPgDbLock } from './pgStore';
import { getSecret } from './secretProvider';
import {
  appendSecurityLog,
  getClientIp,
  hashPassword,
  isAdminRole,
  StoredUserRecord,
  verifyPassword,
  verifySecretTimingSafe,
} from './security';

export interface AdminRoutesDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  isProd: boolean;
  requireAdminPermission: (permission: string) => express.RequestHandler;
  createSessionForUser: (
    user: StoredUserRecord,
    req: express.Request,
    res: express.Response,
    opts?: { rememberMe?: boolean; familyId?: string; sessionKind?: 'parent' | 'child' },
  ) => string;
  revokeAllUserSessions: (userId: string) => void;
  toSafeUser: (user: StoredUserRecord) => Record<string, unknown>;
}

const ASSIGNABLE_SUBORDINATE_ADMIN_ROLES: UserRole[] = [
  'admin',
  'content_admin',
  'curriculum_manager',
  'finance_admin',
  'support_agent',
];

function isBootstrapDone(db: ServerDb): boolean {
  if (db.adminBootstrap?.initialized || db.adminBootstrap?.secretConsumed) {
    return true;
  }
  return Object.values(db.users).some((u) => u.role === 'super_admin');
}

export function registerAdminRoutes(deps: AdminRoutesDeps): void {
  const {
    app,
    getDb,
    saveDb,
    isProd,
    requireAdminPermission,
    createSessionForUser,
    revokeAllUserSessions,
    toSafeUser,
  } = deps;

  // =========================================================================
  // 1. SECURE ONE-TIME FIRST SUPER ADMIN BOOTSTRAP
  // =========================================================================
  app.get('/api/auth/admin-bootstrap/status', (_req, res) => {
    const db = getDb();
    const initialized = isBootstrapDone(db);
    const hasEnvSecret = Boolean(getSecret('NONOLAND_ADMIN_SETUP_SECRET'));
    res.json({
      initialized,
      setupConfigured: !initialized && hasEnvSecret,
    });
  });

  app.post('/api/auth/admin-bootstrap', async (req: AuthenticatedRequest, res) => {
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`admin-bootstrap:${ip}`, 10, 15 * 60_000))) {
      return res.status(429).json({
        error: 'Too many bootstrap attempts. Please wait a few minutes and try again.',
      });
    }

    const body = (req.body || {}) as {
      setupSecret?: string;
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    try {
      const outcome = await runWithPgDbLock('admin-bootstrap', async (db) => {
        if (isBootstrapDone(db)) {
          appendSecurityLog(db.securityLogs, {
            eventType: 'ACCESS_DENIED',
            ip,
            summary: 'Blocked reuse attempt on /api/auth/admin-bootstrap after initialization',
          });
          return {
            ok: false as const,
            status: 403,
            payload: {
              error: 'First Super Admin bootstrap has already been completed and is permanently disabled.',
              initialized: true,
            },
          };
        }

        const expectedSecret = getSecret('NONOLAND_ADMIN_SETUP_SECRET') || '';
        if (!expectedSecret) {
          return {
            ok: false as const,
            status: 503,
            payload: {
              error:
                'Admin bootstrap secret (NONOLAND_ADMIN_SETUP_SECRET) is not configured in server environment or Secret Manager.',
              initialized: false,
            },
          };
        }

        const providedSecret = typeof body.setupSecret === 'string' ? body.setupSecret.trim() : '';
        if (!providedSecret || !verifySecretTimingSafe(providedSecret, expectedSecret)) {
          appendSecurityLog(db.securityLogs, {
            eventType: 'ACCESS_DENIED',
            ip,
            summary: 'Invalid setup secret submitted to /api/auth/admin-bootstrap',
          });
          return {
            ok: false as const,
            status: 403,
            payload: { error: 'Invalid setup secret.' },
          };
        }

        const nameCheck = validateParentName(body.displayName || '');
        if (!nameCheck.ok) {
          return { ok: false as const, status: 400, payload: { error: nameCheck.error } };
        }

        const emailCheck = validateEmail(body.email || '');
        if (!emailCheck.ok) {
          return { ok: false as const, status: 400, payload: { error: emailCheck.error } };
        }

        if (db.emailIndex[emailCheck.normalized]) {
          return {
            ok: false as const,
            status: 409,
            payload: { error: 'An account with this email already exists.' },
          };
        }

        if (body.confirmPassword !== undefined && body.password !== body.confirmPassword) {
          return {
            ok: false as const,
            status: 400,
            payload: { error: 'Password and confirm password do not match.' },
          };
        }

        const pwCheck = validatePassword(body.password || '', emailCheck.normalized, nameCheck.clean);
        if (!pwCheck.ok) {
          return { ok: false as const, status: 400, payload: { error: pwCheck.error } };
        }

        const nowIso = new Date().toISOString();
        const userId = `sup_${crypto.randomBytes(6).toString('hex')}`;
        const superAdmin: StoredUserRecord = {
          id: userId,
          email: (body.email || '').trim(),
          normalizedEmail: emailCheck.normalized,
          displayName: nameCheck.clean,
          passwordHash: hashPassword(body.password || ''),
          role: 'super_admin',
          emailVerified: true,
          status: 'active',
          policyVersion: POLICY_VERSION,
          termsAcceptedAt: nowIso,
          failedLoginAttempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        db.users[userId] = superAdmin;
        db.emailIndex[emailCheck.normalized] = userId;
        db.adminBootstrap = {
          initialized: true,
          initializedAt: nowIso,
          initializedByUserId: userId,
          secretConsumed: true,
        };

        recordAuditEvent(db, {
          eventType: 'ADMIN_ACTION',
          actorId: userId,
          actorRole: 'super_admin',
          actionType: 'ADMIN_BOOTSTRAP',
          recordType: 'user',
          recordId: userId,
          newValue: `${emailCheck.normalized}:super_admin`,
          outcome: 'success',
          ip,
          summary: `First Super Admin initialized via one-time setup bootstrap (${emailCheck.normalized})`,
        });

        const csrfToken = createSessionForUser(superAdmin, req, res);
        return {
          ok: true as const,
          status: 201,
          payload: {
            initialized: true,
            user: toSafeUser(superAdmin),
            csrfToken,
            dashboardRoute: '/admin-dashboard',
          },
        };
      });

      if (!outcome.ok) {
        return res.status(outcome.status).json(outcome.payload);
      }
      return res.status(outcome.status).json(outcome.payload);
    } catch (err) {
      console.error('Admin bootstrap error:', err);
      return res.status(500).json({ error: 'Unable to complete Super Admin bootstrap.' });
    }
  });

  // =========================================================================
  // 2. ADMIN OVERVIEW STATS (Any authorized Admin role)
  // =========================================================================
  app.get('/api/admin/overview-stats', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (req.authSession) {
      if (!isAdminRole(req.authSession.user.role)) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'ACCESS_DENIED',
          actorId: req.authSession.user.id,
          role: req.authSession.user.role,
          ip: getClientIp(req),
          summary: `Non-admin role ${req.authSession.user.role} blocked from /api/admin/overview-stats`,
        });
        saveDb(db);
        return res.status(403).json({ error: 'Forbidden: Administrator role required' });
      }
    } else {
      const configuredPin = String(process.env.ADMIN_PIN || '').trim();
      const providedPin = String(req.header('x-admin-pin') || '').trim();
      if (!configuredPin || !providedPin || !verifySecretTimingSafe(providedPin, configuredPin)) {
        return res.status(401).json({ error: 'Administrator authentication required' });
      }
    }

    const storageInfo = getDbStorageInfo();
    const users = Object.values(db.users);
    const realUsers = users.filter((u) => !storageInfo.isDevSeedRecord('users', u.id));
    const seedUsers = users.filter((u) => storageInfo.isDevSeedRecord('users', u.id));

    const teachers = realUsers.filter((u) => u.role === 'teacher');
    const parents = realUsers.filter((u) => u.role === 'parent');
    const admins = realUsers.filter((u) => isAdminRole(u.role));
    const realFamilies = Object.keys(db.families || {}).filter((id) => !storageInfo.isDevSeedRecord('families', id));
    const realChildren = Object.keys(db.children || {}).filter((id) => !storageInfo.isDevSeedRecord('children', id));
    const classes = Object.values(db.classes || {}).filter((c) => !storageInfo.isDevSeedRecord('classes', c.id));
    const exams = Object.values(db.teacherExams || {}).filter((e) => !storageInfo.isDevSeedRecord('teacherExams', e.id));
    const realAuditLogsCount = db.securityLogs.filter((l) => !storageInfo.isDevSeedRecord('securityLogs', l.id)).length;

    const seedStats = storageInfo.devSeedEnabled
      ? {
          totalParents: seedUsers.filter((u) => u.role === 'parent').length,
          totalFamilies: Object.keys(db.families || {}).filter((id) => storageInfo.isDevSeedRecord('families', id)).length,
          totalChildren: Object.keys(db.children || {}).filter((id) => storageInfo.isDevSeedRecord('children', id)).length,
          totalTeachers: seedUsers.filter((u) => u.role === 'teacher').length,
          totalClasses: Object.values(db.classes || {}).filter((c) => storageInfo.isDevSeedRecord('classes', c.id)).length,
          totalExams: Object.values(db.teacherExams || {}).filter((e) => storageInfo.isDevSeedRecord('teacherExams', e.id)).length,
          auditLogsCount: db.securityLogs.filter((l) => storageInfo.isDevSeedRecord('securityLogs', l.id)).length,
        }
      : null;

    res.json({
      storageBackend: storageInfo.storageBackend,
      devSeedEnabled: storageInfo.devSeedEnabled,
      stats: {
        totalParents: parents.length,
        totalFamilies: realFamilies.length || parents.length,
        totalChildren: realChildren.length,
        totalTeachers: teachers.length,
        pendingTeachers: teachers.filter((t) => t.status === 'pending').length,
        activeTeachers: teachers.filter((t) => t.status === 'active').length,
        rejectedTeachers: teachers.filter((t) => t.status === 'rejected').length,
        suspendedTeachers: teachers.filter((t) => t.status === 'suspended').length,
        totalClasses: classes.length,
        activeClasses: classes.filter((c) => c.active).length,
        totalExams: exams.length,
        auditLogsCount: realAuditLogsCount,
        adminCount: admins.length,
      },
      seedStats,
    });
  });

  // =========================================================================
  // 3. TEACHER APPROVAL, REJECTION, SUSPENSION & REACTIVATION WORKFLOWS
  // =========================================================================
  app.post(
    '/api/admin/teachers/:userId/approve',
    requireAdminPermission('manage_teachers'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = db.users[req.params.userId];
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(404).json({ error: 'Teacher account not found' });
      }

      const nowIso = new Date().toISOString();
      const prevStatus = teacher.status;
      teacher.status = 'active';
      teacher.emailVerified = true;
      teacher.updatedAt = nowIso;

      if (!teacher.teacherProfile) {
        teacher.teacherProfile = {
          userId: teacher.id,
          displayName: teacher.displayName,
          email: teacher.email,
          subjects: ['arabic'],
          permissions: ['manage_classes', 'manage_questions', 'manage_exams', 'assign_exams', 'view_results', 'bulk_import'],
          status: 'active',
        };
      }
      teacher.teacherProfile.status = 'active';
      teacher.teacherProfile.approvedBy = req.authSession?.user.id || 'admin';
      teacher.teacherProfile.approvedAt = nowIso;
      delete teacher.teacherProfile.rejectedBy;
      delete teacher.teacherProfile.rejectedAt;
      delete teacher.teacherProfile.rejectionReason;
      delete teacher.teacherProfile.suspendedBy;
      delete teacher.teacherProfile.suspendedAt;
      delete teacher.teacherProfile.suspensionReason;

      recordAuditEvent(db, {
        eventType: 'ADMIN_ACTION',
        actorId: req.authSession?.user.id,
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'TEACHER_APPROVED',
        recordType: 'user',
        recordId: teacher.id,
        previousValue: { status: prevStatus },
        newValue: { status: 'active' },
        outcome: 'success',
        ip: getClientIp(req),
        summary: `Admin approved teacher account ${teacher.normalizedEmail}`,
      });
      saveDb(db);

      res.json({
        approved: true,
        teacher: toSafeUser(teacher),
      });
    },
  );

  app.post(
    '/api/admin/teachers/:userId/reject',
    requireAdminPermission('manage_teachers'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = db.users[req.params.userId];
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(404).json({ error: 'Teacher account not found' });
      }

      const body = (req.body || {}) as { reason?: string };
      const reason =
        sanitizeShortText(body.reason, 300) ||
        'Application did not meet verification requirements at this time.';
      const nowIso = new Date().toISOString();
      const prevStatus = teacher.status;

      teacher.status = 'rejected';
      teacher.updatedAt = nowIso;
      if (!teacher.teacherProfile) {
        teacher.teacherProfile = {
          userId: teacher.id,
          displayName: teacher.displayName,
          email: teacher.email,
          subjects: ['arabic'],
          permissions: [],
          status: 'rejected',
        };
      }
      teacher.teacherProfile.status = 'rejected';
      teacher.teacherProfile.rejectedBy = req.authSession?.user.id || 'admin';
      teacher.teacherProfile.rejectedAt = nowIso;
      teacher.teacherProfile.rejectionReason = reason;

      revokeAllUserSessions(teacher.id);

      recordAuditEvent(db, {
        eventType: 'ADMIN_ACTION',
        actorId: req.authSession?.user.id,
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'TEACHER_REJECTED',
        recordType: 'user',
        recordId: teacher.id,
        previousValue: { status: prevStatus },
        newValue: { status: 'rejected', rejectionReason: reason },
        reason,
        outcome: 'success',
        ip: getClientIp(req),
        summary: `Admin rejected teacher application ${teacher.normalizedEmail}: ${reason}`,
      });
      saveDb(db);

      res.json({
        rejected: true,
        teacher: toSafeUser(teacher),
      });
    },
  );

  app.post(
    '/api/admin/teachers/:userId/suspend',
    requireAdminPermission('manage_teachers'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = db.users[req.params.userId];
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(404).json({ error: 'Teacher account not found' });
      }

      const body = (req.body || {}) as { reason?: string };
      const reason = sanitizeShortText(body.reason, 300) || 'Suspended by administrator.';
      const nowIso = new Date().toISOString();
      const prevStatus = teacher.status;

      teacher.status = 'suspended';
      teacher.updatedAt = nowIso;
      if (teacher.teacherProfile) {
        teacher.teacherProfile.status = 'suspended';
        teacher.teacherProfile.suspendedBy = req.authSession?.user.id || 'admin';
        teacher.teacherProfile.suspendedAt = nowIso;
        teacher.teacherProfile.suspensionReason = reason;
      }

      revokeAllUserSessions(teacher.id);

      recordAuditEvent(db, {
        eventType: 'ADMIN_ACTION',
        actorId: req.authSession?.user.id,
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'TEACHER_SUSPENDED',
        recordType: 'user',
        recordId: teacher.id,
        previousValue: { status: prevStatus },
        newValue: { status: 'suspended' },
        reason,
        outcome: 'success',
        ip: getClientIp(req),
        summary: `Admin suspended teacher ${teacher.normalizedEmail}: ${reason}`,
      });
      saveDb(db);

      res.json({
        suspended: true,
        teacher: toSafeUser(teacher),
      });
    },
  );

  app.post(
    '/api/admin/teachers/:userId/reactivate',
    requireAdminPermission('manage_teachers'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = db.users[req.params.userId];
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(404).json({ error: 'Teacher account not found' });
      }

      const nowIso = new Date().toISOString();
      const prevStatus = teacher.status;
      teacher.status = 'active';
      teacher.emailVerified = true;
      teacher.updatedAt = nowIso;
      if (teacher.teacherProfile) {
        teacher.teacherProfile.status = 'active';
        teacher.teacherProfile.approvedBy = req.authSession?.user.id || 'admin';
        teacher.teacherProfile.approvedAt = nowIso;
        delete teacher.teacherProfile.suspendedBy;
        delete teacher.teacherProfile.suspendedAt;
        delete teacher.teacherProfile.suspensionReason;
        delete teacher.teacherProfile.rejectedBy;
        delete teacher.teacherProfile.rejectedAt;
        delete teacher.teacherProfile.rejectionReason;
      }

      recordAuditEvent(db, {
        eventType: 'ADMIN_ACTION',
        actorId: req.authSession?.user.id,
        actorRole: req.authSession?.user.role || 'admin',
        actionType: 'TEACHER_REACTIVATED',
        recordType: 'user',
        recordId: teacher.id,
        previousValue: { status: prevStatus },
        newValue: { status: 'active' },
        outcome: 'success',
        ip: getClientIp(req),
        summary: `Admin reactivated teacher ${teacher.normalizedEmail}`,
      });
      saveDb(db);

      res.json({
        reactivated: true,
        teacher: toSafeUser(teacher),
      });
    },
  );

  // =========================================================================
  // 4. PARENT & CHILD VISIBILITY FOR ADMIN (Safe Redacted Fields Only)
  // =========================================================================
  app.get('/api/admin/parents', requireAdminPermission('manage_parents'), (_req, res) => {
    const db = getDb();
    const storageInfo = getDbStorageInfo();
    const parents = Object.values(db.users)
      .filter((u) => u.role === 'parent')
      .map((parent) => {
        const linkedChildren = Object.values(db.children)
          .filter((ch) => ch.parentId === parent.id || (parent.familyId && ch.familyId === parent.familyId))
          .map((ch) => ({
            id: ch.id,
            displayName: ch.displayName,
            ageGroup: ch.ageGroup,
            language: ch.language,
            level: ch.level,
            stars: ch.stars,
            isDevSeed: storageInfo.isDevSeedRecord('children', ch.id),
          }));
        return {
          id: parent.id,
          name: parent.displayName,
          email: parent.email,
          status: parent.status,
          emailVerified: parent.emailVerified,
          familyId: parent.familyId || null,
          createdAt: parent.createdAt,
          childrenCount: linkedChildren.length,
          children: linkedChildren,
          isDevSeed: storageInfo.isDevSeedRecord('users', parent.id),
        };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    res.json({ parents });
  });

  // =========================================================================
  // 5. ADMIN TEAM MANAGEMENT (Strictly super_admin authenticated session ONLY)
  // =========================================================================
  function requireStrictSuperAdmin(
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction,
  ) {
    if (!req.authSession) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.authSession.user.role !== 'super_admin') {
      const db = getDb();
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: req.authSession.user.id,
        role: req.authSession.user.role,
        ip: getClientIp(req),
        summary: `Blocked non-super_admin role (${req.authSession.user.role}) from Super Admin endpoint`,
      });
      saveDb(db);
      return res.status(403).json({
        error: 'Forbidden: Only Super Administrators can manage administrator accounts.',
      });
    }
    next();
  }

  app.get('/api/admin/admins', requireStrictSuperAdmin, (_req, res) => {
    const db = getDb();
    const storageInfo = getDbStorageInfo();
    const admins = Object.values(db.users)
      .filter((u) => isAdminRole(u.role))
      .map((u) => ({
        ...toSafeUser(u),
        isDevSeed: storageInfo.isDevSeedRecord('users', u.id),
      }));
    res.json({ admins });
  });

  app.post('/api/admin/admins', requireStrictSuperAdmin, async (req: AuthenticatedRequest, res) => {
    const actorUser = req.authSession!.user;
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`admin-create:${actorUser.id}`, 15, 15 * 60_000))) {
      return res.status(429).json({ error: 'Too many admin creation attempts.' });
    }

    const body = (req.body || {}) as {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      creatorCurrentPassword?: string;
      role?: UserRole;
    };

    const allowedRoles: UserRole[] = ['super_admin', ...ASSIGNABLE_SUBORDINATE_ADMIN_ROLES];
    const requestedRole = body.role || 'admin';
    if (!allowedRoles.includes(requestedRole)) {
      return res.status(400).json({ error: 'Invalid administrator role requested.' });
    }

    const nameCheck = validateParentName(body.displayName || '');
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });

    const emailCheck = validateEmail(body.email || '');
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

    if (requestedRole === 'super_admin' || body.confirmPassword !== undefined) {
      if (typeof body.confirmPassword !== 'string' || body.password !== body.confirmPassword) {
        return res.status(400).json({ error: 'Password and password confirmation do not match.' });
      }
    }

    const pwCheck =
      requestedRole === 'super_admin'
        ? validateStrictAdminPassword(body.password || '', emailCheck.normalized, nameCheck.clean)
        : validatePassword(body.password || '', emailCheck.normalized, nameCheck.clean);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });

    if (requestedRole === 'super_admin') {
      if (typeof body.creatorCurrentPassword !== 'string' || !body.creatorCurrentPassword) {
        return res.status(400).json({
          error: 'Current Super Admin password confirmation is required to create a Super Admin account.',
        });
      }
    }

    try {
      const outcome = await runWithPgDbLock(`admin-create:${emailCheck.normalized}`, async (lockedDb) => {
        const freshActor = lockedDb.users[actorUser.id];
        if (!freshActor || freshActor.role !== 'super_admin' || freshActor.status !== 'active') {
          return {
            ok: false as const,
            status: 403,
            payload: { error: 'Forbidden: Active Super Administrator session required.' },
          };
        }

        if (requestedRole === 'super_admin' || body.creatorCurrentPassword !== undefined) {
          const okCreatorPw = verifyPassword(body.creatorCurrentPassword || '', freshActor.passwordHash);
          if (!okCreatorPw) {
            appendSecurityLog(lockedDb.securityLogs, {
              eventType: 'ACCESS_DENIED',
              actorId: freshActor.id,
              role: freshActor.role,
              ip,
              summary: `Invalid creator password confirmation while creating ${requestedRole} (${emailCheck.normalized})`,
            });
            return {
              ok: false as const,
              status: 403,
              payload: { error: 'Current Super Admin password verification failed.' },
            };
          }
        }

        if (lockedDb.emailIndex[emailCheck.normalized]) {
          return {
            ok: false as const,
            status: 409,
            payload: { error: 'An account with this email already exists.' },
          };
        }

        const nowIso = new Date().toISOString();
        const userId =
          requestedRole === 'super_admin'
            ? `sup_${crypto.randomBytes(6).toString('hex')}`
            : `adm_${crypto.randomBytes(6).toString('hex')}`;

        const adminUser: StoredUserRecord = {
          id: userId,
          email: (body.email || '').trim(),
          normalizedEmail: emailCheck.normalized,
          displayName: nameCheck.clean,
          passwordHash: hashPassword(body.password || ''),
          role: requestedRole,
          emailVerified: true,
          status: 'active',
          policyVersion: POLICY_VERSION,
          termsAcceptedAt: nowIso,
          failedLoginAttempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        lockedDb.users[userId] = adminUser;
        lockedDb.emailIndex[emailCheck.normalized] = userId;
        if (requestedRole === 'super_admin') {
          lockedDb.adminBootstrap = {
            ...(lockedDb.adminBootstrap || { initialized: true, secretConsumed: true }),
            initialized: true,
            secretConsumed: true,
          };
        }

        recordAuditEvent(lockedDb, {
          eventType: 'ADMIN_ACTION',
          actorId: freshActor.id,
          actorRole: freshActor.role,
          actionType: requestedRole === 'super_admin' ? 'SUPER_ADMIN_CREATED' : 'ADMIN_ACCOUNT_CREATED',
          recordType: 'user',
          recordId: userId,
          newValue: `${emailCheck.normalized}:${requestedRole}`,
          outcome: 'success',
          ip,
          summary: `Super Admin created ${requestedRole} account (${emailCheck.normalized})`,
        });

        return {
          ok: true as const,
          status: 201,
          payload: { admin: toSafeUser(adminUser) },
        };
      });

      return res.status(outcome.status).json(outcome.payload);
    } catch (err) {
      console.error('Admin creation error:', (err as Error)?.message || err);
      return res.status(503).json({
        error: 'Database unavailable. Failing closed for data safety.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  app.patch('/api/admin/admins/:userId/status', requireStrictSuperAdmin, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const target = db.users[req.params.userId];
    if (!target || !isAdminRole(target.role)) {
      return res.status(404).json({ error: 'Administrator account not found' });
    }
    if (target.id === req.authSession!.user.id) {
      return res.status(403).json({ error: 'You cannot suspend or deactivate your own administrator account.' });
    }
    const { status } = (req.body || {}) as { status?: AccountStatus };
    if (status !== 'active' && status !== 'suspended') {
      return res.status(400).json({ error: 'Status must be active or suspended.' });
    }
    if (target.role === 'super_admin' && status === 'suspended') {
      const otherActiveSupers = Object.values(db.users).filter(
        (u) => u.id !== target.id && u.role === 'super_admin' && u.status === 'active',
      );
      if (otherActiveSupers.length === 0) {
        return res.status(403).json({
          error: 'Cannot suspend the last remaining active Super Admin account.',
        });
      }
    }
    const prev = target.status;
    target.status = status;
    target.updatedAt = new Date().toISOString();
    if (status === 'suspended') {
      revokeAllUserSessions(target.id);
    }

    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession!.user.id,
      actorRole: req.authSession!.user.role,
      actionType: 'ADMIN_STATUS_UPDATED',
      recordType: 'user',
      recordId: target.id,
      previousValue: { status: prev },
      newValue: { status },
      outcome: 'success',
      ip: getClientIp(req),
      summary: `Super Admin set admin ${target.normalizedEmail} status to ${status}`,
    });
    saveDb(db);
    res.json({ admin: toSafeUser(target) });
  });
}
