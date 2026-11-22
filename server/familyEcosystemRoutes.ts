import crypto from 'crypto';
import type express from 'express';
import {
  clearDeviceCookie,
  DEVICE_COOKIE_NAME,
  generateSecureToken,
  getClientIp,
  hashToken,
  parseCookies,
  parseDeviceMetadata,
  setDeviceCookie,
} from './security';
import {
  ALL_GUARDIAN_PERMISSIONS,
  createDefaultContentPolicy,
  createDefaultPrivacySettings,
  DEFAULT_GUARDIAN_PERMISSIONS_BY_ROLE,
  ensureFamilyCollections,
  ensureFamilyForUser,
  getAccessibleChildrenForUser,
  hasGuardianPermission,
  isChildOrStudentRole,
  recordFamilyEvent,
  requireParentGate,
  resolveFamilyIdForUser,
} from './familyHelpers';
import type { AuthenticatedRequest, ServerDb } from './dbTypes';
import type {
  ContentPermissionPolicy,
  DataGovernanceRequest,
  FamilyPrivacySettings,
  GuardianPermission,
  GuardianRole,
  PrivacyConsentRecord,
} from '../src/types/nonoland';
import { normalizeEmail, POLICY_VERSION, sanitizeShortText, validateEmail } from '../src/utils/validation';

interface FamilyEcosystemDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
  isProd: boolean;
}

export function registerFamilyEcosystemRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  isProd,
}: FamilyEcosystemDeps) {
  function requireGuardianAccess(
    req: AuthenticatedRequest,
    res: express.Response,
    permission?: GuardianPermission,
  ): { db: ServerDb; familyId: string } | null {
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    if (isChildOrStudentRole(user.role) || req.authSession!.session.sessionKind === 'child') {
      res.status(403).json({ error: 'Child accounts cannot access parent family management endpoints.' });
      return null;
    }
    if (user.role !== 'parent' && user.role !== 'super_admin') {
      res.status(403).json({ error: 'Parent or guardian role required.' });
      return null;
    }
    const familyId = resolveFamilyIdForUser(db, user);
    if (!familyId || !db.families![familyId]) {
      res.status(403).json({ error: 'Family access has been revoked or is unavailable.' });
      return null;
    }
    if (permission && !hasGuardianPermission(db, user, familyId, permission)) {
      res.status(403).json({
        error: `You do not have the "${permission}" permission in this family.`,
        code: 'GUARDIAN_PERMISSION_DENIED',
      });
      return null;
    }
    return { db, familyId };
  }

  // =========================================================================
  // 1. TRUSTED FAMILY DEVICES & SESSION REVOCATION
  // =========================================================================
  app.get('/api/family/devices', requireAuth, (req: AuthenticatedRequest, res) => {
    const ctx = requireGuardianAccess(req, res, 'view_profiles');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const cookies = parseCookies(req.headers.cookie);
    const currentDeviceHash = cookies[DEVICE_COOKIE_NAME] ? hashToken(cookies[DEVICE_COOKIE_NAME]) : null;
    const currentSessionDeviceId = req.authSession!.session.deviceId;

    const devices = Object.values(db.trustedDevices!)
      .filter((d) => d.familyId === familyId)
      .sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''))
      .map((d) => ({
        id: d.id,
        familyId: d.familyId,
        userId: d.userId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        firstRegisteredAt: d.firstRegisteredAt,
        lastActiveAt: d.lastActiveAt,
        trusted: d.trusted && !d.revoked,
        revoked: d.revoked,
        revokedAt: d.revokedAt,
        isCurrentDevice: Boolean(
          (currentDeviceHash && d.tokenHash === currentDeviceHash) ||
            (currentSessionDeviceId && d.id === currentSessionDeviceId),
        ),
      }));

    res.json({
      devices,
      activeSessionsCount: Object.values(db.sessions).filter(
        (s) => s.familyId === familyId && s.expiresAt > Date.now(),
      ).length,
    });
  });

  app.post('/api/family/devices/register-current', requireAuth, (req: AuthenticatedRequest, res) => {
    const ctx = requireGuardianAccess(req, res, 'manage_devices');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const ip = getClientIp(req);
    const ua = String(req.headers['user-agent'] || '');
    const meta = parseDeviceMetadata(ua);
    const customName = sanitizeShortText(req.body?.deviceName || '', 48);
    const trusted = req.body?.trusted !== false;

    const cookies = parseCookies(req.headers.cookie);
    const existingRaw = cookies[DEVICE_COOKIE_NAME];
    const existingHash = existingRaw ? hashToken(existingRaw) : null;
    let device = existingHash
      ? Object.values(db.trustedDevices!).find((d) => d.tokenHash === existingHash && d.familyId === familyId && !d.revoked)
      : undefined;

    const nowIso = new Date().toISOString();
    if (!device) {
      const rawDeviceToken = generateSecureToken(32);
      const devId = `dev_${crypto.randomBytes(6).toString('hex')}`;
      device = {
        id: devId,
        familyId,
        userId: user.id,
        deviceName: customName || meta.deviceName,
        deviceType: meta.deviceType,
        browser: meta.browser,
        os: meta.os,
        firstRegisteredAt: nowIso,
        lastActiveAt: nowIso,
        trusted,
        revoked: false,
        tokenHash: hashToken(rawDeviceToken),
        userAgent: ua.slice(0, 180),
        ip,
      };
      db.trustedDevices![devId] = device;
      setDeviceCookie(res, rawDeviceToken, req, isProd);
    } else {
      if (customName) device.deviceName = customName;
      device.trusted = trusted;
      device.lastActiveAt = nowIso;
    }

    req.authSession!.session.deviceId = device.id;

    recordFamilyEvent(db, {
      familyId,
      category: 'device',
      actionType: trusted ? 'DEVICE_TRUSTED' : 'DEVICE_REGISTERED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      deviceId: device.id,
      title: { ar: 'تسجيل جهاز عائلي موثوق', en: 'Trusted family device saved' },
      description: {
        ar: `تم اعتماد الجهاز "${device.deviceName}" بواسطة ${user.displayName}`,
        en: `Device "${device.deviceName}" registered as trusted=${trusted} by ${user.displayName}`,
      },
      ip,
      securityEventType: 'DEVICE_TRUSTED',
    });
    saveDb(db);

    res.status(201).json({
      device: {
        id: device.id,
        familyId: device.familyId,
        userId: device.userId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        firstRegisteredAt: device.firstRegisteredAt,
        lastActiveAt: device.lastActiveAt,
        trusted: device.trusted,
        revoked: device.revoked,
        isCurrentDevice: true,
      },
    });
  });

  app.patch('/api/family/devices/:deviceId', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_devices');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const device = db.trustedDevices![req.params.deviceId];
    if (!device || device.familyId !== familyId) {
      return res.status(404).json({ error: 'Device not found in this family.' });
    }
    if (typeof req.body?.deviceName === 'string' && req.body.deviceName.trim()) {
      device.deviceName = sanitizeShortText(req.body.deviceName, 48);
    }
    if (typeof req.body?.trusted === 'boolean') {
      device.trusted = req.body.trusted;
      if (!device.trusted) {
        // Untrusting removes quick-pick privilege immediately
        device.lastActiveAt = new Date().toISOString();
      }
    }
    saveDb(db);
    res.json({
      device: {
        id: device.id,
        familyId: device.familyId,
        deviceName: device.deviceName,
        trusted: device.trusted && !device.revoked,
        revoked: device.revoked,
      },
    });
  });

  app.post('/api/family/devices/:deviceId/revoke', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_devices');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const device = db.trustedDevices![req.params.deviceId];
    if (!device || device.familyId !== familyId) {
      return res.status(404).json({ error: 'Device not found in this family.' });
    }

    device.revoked = true;
    device.trusted = false;
    device.revokedAt = new Date().toISOString();

    let revokedSessions = 0;
    for (const [hash, s] of Object.entries(db.sessions)) {
      if (s.deviceId === device.id && hash !== req.authSession!.session.tokenHash) {
        delete db.sessions[hash];
        revokedSessions += 1;
      }
    }
    if (req.authSession!.session.deviceId === device.id) {
      req.authSession!.session.deviceId = undefined;
    }

    const cookies = parseCookies(req.headers.cookie);
    if (cookies[DEVICE_COOKIE_NAME] && hashToken(cookies[DEVICE_COOKIE_NAME]) === device.tokenHash) {
      clearDeviceCookie(res, req, isProd);
    }

    recordFamilyEvent(db, {
      familyId,
      category: 'device',
      actionType: 'DEVICE_REVOKED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      deviceId: device.id,
      severity: 'warning',
      title: { ar: 'إزالة وسحب ثقة جهاز', en: 'Device access revoked' },
      description: {
        ar: `تم سحب الثقة من الجهاز "${device.deviceName}" وإنهاء ${revokedSessions} جلسة مرتبطة به`,
        en: `Revoked trust for "${device.deviceName}" and terminated ${revokedSessions} linked session(s)`,
      },
      ip: getClientIp(req),
      securityEventType: 'DEVICE_REVOKED',
    });
    saveDb(db);

    res.json({ revoked: true, deviceId: device.id, revokedSessions });
  });

  app.post('/api/family/sessions/sign-out-others', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_devices');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const currentHash = req.authSession!.session.tokenHash;

    let terminated = 0;
    for (const [hash, s] of Object.entries(db.sessions)) {
      if (hash !== currentHash && (s.userId === user.id || s.familyId === familyId)) {
        delete db.sessions[hash];
        terminated += 1;
      }
    }

    recordFamilyEvent(db, {
      familyId,
      category: 'security',
      actionType: 'SIGN_OUT_OTHER_SESSIONS',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      severity: 'info',
      title: { ar: 'تسجيل الخروج من جميع الأجهزة الأخرى', en: 'Signed out all other sessions' },
      description: {
        ar: `أنهى ${user.displayName} عدد ${terminated} جلسة نشطة على الأجهزة الأخرى`,
        en: `${user.displayName} signed out ${terminated} other active session(s)`,
      },
      ip: getClientIp(req),
      securityEventType: 'SESSION_REVOKED',
    });
    saveDb(db);

    res.json({ terminated });
  });

  // =========================================================================
  // 2. MULTIPLE GUARDIANS & CAREGIVERS
  // =========================================================================
  app.get('/api/family/guardians', requireAuth, (req: AuthenticatedRequest, res) => {
    const ctx = requireGuardianAccess(req, res, 'view_profiles');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const family = db.families![familyId];

    const members = Object.values(db.guardianMemberships!).filter(
      (m) => m.familyId === familyId && m.status === 'active',
    );
    const invitations = Object.values(db.guardianInvitations!)
      .filter((inv) => inv.familyId === familyId && inv.status === 'pending')
      .map((inv) => ({
        id: inv.id,
        familyId: inv.familyId,
        email: inv.email,
        role: inv.role,
        permissions: inv.permissions,
        invitedByName: inv.invitedByName,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      }));

    res.json({
      family,
      members,
      invitations,
      currentUserPermissions:
        members.find((m) => m.userId === req.authSession!.user.id)?.permissions ||
        (family.primaryGuardianId === req.authSession!.user.id ? ALL_GUARDIAN_PERMISSIONS : []),
    });
  });

  app.post('/api/family/guardians/invite', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_guardians');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;

    const { email, role, permissions } = (req.body || {}) as {
      email?: string;
      role?: GuardianRole;
      permissions?: GuardianPermission[];
    };

    const emailCheck = validateEmail(email || '');
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error || 'Invalid email address.' });
    }
    const normalized = emailCheck.normalized;
    if (normalized === user.normalizedEmail) {
      return res.status(400).json({ error: 'You are already a guardian in this family.' });
    }

    const assignedRole: GuardianRole =
      role === 'caregiver' ? 'caregiver' : 'secondary_guardian';
    const allowedSet = new Set<GuardianPermission>(ALL_GUARDIAN_PERMISSIONS);
    const cleanPerms: GuardianPermission[] = Array.isArray(permissions) && permissions.length > 0
      ? Array.from(new Set(permissions.filter((p) => allowedSet.has(p))))
      : [...DEFAULT_GUARDIAN_PERMISSIONS_BY_ROLE[assignedRole]];

    const rawInviteToken = generateSecureToken(20);
    const invId = `ginv_${crypto.randomBytes(5).toString('hex')}`;
    const now = Date.now();
    const inv = {
      id: invId,
      familyId,
      email: normalized,
      role: assignedRole,
      permissions: cleanPerms,
      invitedByUserId: user.id,
      invitedByName: user.displayName,
      status: 'pending' as const,
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now).toISOString(),
      tokenHash: hashToken(rawInviteToken),
    };
    db.guardianInvitations![invId] = inv;

    recordFamilyEvent(db, {
      familyId,
      category: 'guardian',
      actionType: 'GUARDIAN_INVITED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'دعوة ولي أمر أو مقدم رعاية', en: 'Guardian invitation sent' },
      description: {
        ar: `أرسل ${user.displayName} دعوة إلى ${normalized} بدور ${assignedRole}`,
        en: `${user.displayName} invited ${normalized} as ${assignedRole}`,
      },
      ip: getClientIp(req),
      securityEventType: 'GUARDIAN_INVITED',
    });
    saveDb(db);

    res.status(201).json({
      invitation: {
        id: inv.id,
        familyId: inv.familyId,
        email: inv.email,
        role: inv.role,
        permissions: inv.permissions,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      },
      inviteToken: rawInviteToken,
    });
  });

  app.post('/api/family/guardians/accept', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    if (isChildOrStudentRole(user.role)) {
      return res.status(403).json({ error: 'Child accounts cannot accept guardian invitations.' });
    }
    const { inviteToken } = (req.body || {}) as { inviteToken?: string };
    if (!inviteToken || typeof inviteToken !== 'string') {
      return res.status(400).json({ error: 'inviteToken is required' });
    }

    const tokenHash = hashToken(inviteToken.trim());
    const inv = Object.values(db.guardianInvitations!).find(
      (i) => i.tokenHash === tokenHash && i.status === 'pending',
    );
    if (!inv || new Date(inv.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invitation is invalid or expired.' });
    }
    if (normalizeEmail(inv.email) !== user.normalizedEmail) {
      return res.status(403).json({
        error: 'This invitation was issued for a different email address.',
        code: 'INVITE_EMAIL_MISMATCH',
      });
    }

    const nowIso = new Date().toISOString();
    inv.status = 'accepted';
    user.familyId = inv.familyId;
    req.authSession!.session.familyId = inv.familyId;

    const memId = `gm_${inv.familyId}_${user.id}`;
    db.guardianMemberships![memId] = {
      id: memId,
      familyId: inv.familyId,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: inv.role,
      permissions: inv.permissions,
      status: 'active',
      invitedByUserId: inv.invitedByUserId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    recordFamilyEvent(db, {
      familyId: inv.familyId,
      category: 'guardian',
      actionType: 'GUARDIAN_ACCEPTED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'انضمام ولي أمر جديد للعائلة', en: 'Guardian accepted invitation' },
      description: {
        ar: `انضم ${user.displayName} (${user.email}) إلى حساب العائلة بدور ${inv.role}`,
        en: `${user.displayName} (${user.email}) joined the family account as ${inv.role}`,
      },
      ip: getClientIp(req),
      securityEventType: 'GUARDIAN_ACCEPTED',
    });
    saveDb(db);

    res.json({
      accepted: true,
      familyId: inv.familyId,
      membership: db.guardianMemberships![memId],
    });
  });

  app.patch('/api/family/guardians/:membershipId', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_guardians');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const mem = db.guardianMemberships![req.params.membershipId];
    if (!mem || mem.familyId !== familyId) {
      return res.status(404).json({ error: 'Guardian membership not found.' });
    }
    const family = db.families![familyId];
    if (mem.userId === family.primaryGuardianId || mem.role === 'primary_guardian') {
      return res.status(400).json({ error: 'Primary guardian role cannot be downgraded.' });
    }

    if (req.body?.role === 'secondary_guardian' || req.body?.role === 'caregiver') {
      mem.role = req.body.role;
    }
    if (Array.isArray(req.body?.permissions)) {
      const valid = new Set<GuardianPermission>(ALL_GUARDIAN_PERMISSIONS);
      mem.permissions = Array.from(new Set(req.body.permissions.filter((p: GuardianPermission) => valid.has(p))));
    }
    mem.updatedAt = new Date().toISOString();

    recordFamilyEvent(db, {
      familyId,
      category: 'guardian',
      actionType: 'GUARDIAN_PERMISSIONS_UPDATED',
      actorId: req.authSession!.user.id,
      actorName: req.authSession!.user.displayName,
      actorRole: req.authSession!.user.role,
      title: { ar: 'تحديث صلاحيات ولي أمر مشارك', en: 'Guardian permissions updated' },
      description: {
        ar: `تم تحديث صلاحيات ${mem.displayName} (${mem.role})`,
        en: `Updated permissions for ${mem.displayName} (${mem.role})`,
      },
      ip: getClientIp(req),
      securityEventType: 'PARENT_SETTING_CHANGE',
    });
    saveDb(db);

    res.json({ membership: mem });
  });

  app.delete('/api/family/guardians/:membershipId', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_guardians');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const mem = db.guardianMemberships![req.params.membershipId];
    if (!mem || mem.familyId !== familyId) {
      return res.status(404).json({ error: 'Guardian membership not found.' });
    }
    const family = db.families![familyId];
    if (mem.userId === family.primaryGuardianId || mem.role === 'primary_guardian') {
      return res.status(400).json({ error: 'Primary guardian cannot be removed.' });
    }

    mem.status = 'revoked';
    mem.revokedAt = new Date().toISOString();
    mem.updatedAt = mem.revokedAt;

    const targetUser = db.users[mem.userId];
    if (targetUser && targetUser.familyId === familyId) {
      delete targetUser.familyId;
    }
    for (const [hash, s] of Object.entries(db.sessions)) {
      if (s.userId === mem.userId && s.familyId === familyId) {
        delete db.sessions[hash];
      }
    }

    recordFamilyEvent(db, {
      familyId,
      category: 'guardian',
      actionType: 'GUARDIAN_REVOKED',
      actorId: req.authSession!.user.id,
      actorName: req.authSession!.user.displayName,
      actorRole: req.authSession!.user.role,
      severity: 'warning',
      title: { ar: 'إلغاء صلاحية ولي أمر مشارك', en: 'Guardian access revoked' },
      description: {
        ar: `تم إلغاء وصول ${mem.displayName} (${mem.email}) إلى العائلة فوراً`,
        en: `Revoked family access for ${mem.displayName} (${mem.email})`,
      },
      ip: getClientIp(req),
      securityEventType: 'GUARDIAN_REVOKED',
    });
    saveDb(db);

    res.json({ revoked: true, membershipId: mem.id });
  });

  app.delete('/api/family/guardians/invitations/:invitationId', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_guardians');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const inv = db.guardianInvitations![req.params.invitationId];
    if (!inv || inv.familyId !== familyId) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }
    inv.status = 'revoked';
    saveDb(db);
    res.json({ revoked: true });
  });

  // =========================================================================
  // 3. FAMILY ACTIVITY & SECURITY LOG
  // =========================================================================
  app.get('/api/family/activity-logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const ctx = requireGuardianAccess(req, res, 'view_reports');
    if (!ctx) return;
    const { db, familyId } = ctx;

    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const severity = typeof req.query.severity === 'string' ? req.query.severity.trim() : '';
    const childId = typeof req.query.childId === 'string' ? req.query.childId.trim() : '';
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate.trim() : '';
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const limit = Math.max(10, Math.min(200, Number(req.query.limit || 80)));

    const events = (db.familyAuditEvents || []).filter((evt) => {
      if (evt.familyId !== familyId) return false;
      if (category && category !== 'all' && evt.category !== category) return false;
      if (severity && severity !== 'all' && evt.severity !== severity) return false;
      if (childId && childId !== 'all' && evt.childId !== childId) return false;
      if (fromDate && evt.createdAt.slice(0, 10) < fromDate) return false;
      if (toDate && evt.createdAt.slice(0, 10) > toDate) return false;
      if (search) {
        const hay = `${evt.title.ar} ${evt.title.en} ${evt.description.ar} ${evt.description.en} ${evt.actorName || ''} ${evt.childName || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    res.json({
      events: events.slice(0, limit),
      totalCount: events.length,
    });
  });

  // =========================================================================
  // 4. CONTENT APPROVAL & PRIVACY CENTER
  // =========================================================================
  app.get('/api/family/content-policy', requireAuth, (req: AuthenticatedRequest, res) => {
    const ctx = requireGuardianAccess(req, res, 'view_profiles');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const policy = db.contentPolicies![familyId] || createDefaultContentPolicy(familyId);
    db.contentPolicies![familyId] = policy;
    res.json({ policy });
  });

  app.put('/api/family/content-policy', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'approve_content');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const prev = db.contentPolicies![familyId] || createDefaultContentPolicy(familyId);
    const body = (req.body || {}) as Partial<ContentPermissionPolicy>;

    const next: ContentPermissionPolicy = {
      familyId,
      allowStories: typeof body.allowStories === 'boolean' ? body.allowStories : prev.allowStories,
      allowSongsAudio: typeof body.allowSongsAudio === 'boolean' ? body.allowSongsAudio : prev.allowSongsAudio,
      allowVideos: typeof body.allowVideos === 'boolean' ? body.allowVideos : prev.allowVideos,
      allowGamesCreative: typeof body.allowGamesCreative === 'boolean' ? body.allowGamesCreative : prev.allowGamesCreative,
      aiCompanionEnabled: typeof body.aiCompanionEnabled === 'boolean' ? body.aiCompanionEnabled : prev.aiCompanionEnabled,
      voiceInteractionEnabled: typeof body.voiceInteractionEnabled === 'boolean' ? body.voiceInteractionEnabled : prev.voiceInteractionEnabled,
      ageStrictMode: typeof body.ageStrictMode === 'boolean' ? body.ageStrictMode : prev.ageStrictMode,
      allowExternalContent: typeof body.allowExternalContent === 'boolean' ? body.allowExternalContent : prev.allowExternalContent,
      allowedStoryCategories: Array.isArray(body.allowedStoryCategories)
        ? body.allowedStoryCategories.map((c) => sanitizeShortText(c, 32)).filter(Boolean).slice(0, 12)
        : prev.allowedStoryCategories,
      blockedVideoIds: Array.isArray(body.blockedVideoIds)
        ? body.blockedVideoIds.map((v) => sanitizeShortText(v, 48)).filter(Boolean).slice(0, 50)
        : prev.blockedVideoIds,
      allowedVideoIds: Array.isArray(body.allowedVideoIds)
        ? body.allowedVideoIds.map((v) => sanitizeShortText(v, 48)).filter(Boolean).slice(0, 50)
        : prev.allowedVideoIds,
      updatedAt: new Date().toISOString(),
      updatedBy: user.displayName,
    };

    db.contentPolicies![familyId] = next;

    // Sync child-level aiAssistantEnabled cleanly if aiCompanionEnabled toggled globally
    if (typeof body.aiCompanionEnabled === 'boolean') {
      for (const c of getAccessibleChildrenForUser(db, user)) {
        if (c.familyId === familyId) {
          c.aiAssistantEnabled = body.aiCompanionEnabled;
        }
      }
    }

    recordFamilyEvent(db, {
      familyId,
      category: 'content',
      actionType: 'CONTENT_POLICY_UPDATED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'تحديث ضوابط المحتوى والموافقات', en: 'Content & media approval policy updated' },
      description: {
        ar: `عدّل ${user.displayName} صلاحيات القصص والفيديوهات والمساعد الذكي والصوت للعائلة`,
        en: `${user.displayName} updated stories, video allowlist, AI companion, and voice settings`,
      },
      ip: getClientIp(req),
      securityEventType: 'PARENT_SETTING_CHANGE',
    });
    saveDb(db);

    res.json({ policy: next });
  });

  app.get('/api/family/privacy', requireAuth, (req: AuthenticatedRequest, res) => {
    const ctx = requireGuardianAccess(req, res, 'view_profiles');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const settings = db.privacySettings![familyId] || createDefaultPrivacySettings(familyId);
    db.privacySettings![familyId] = settings;
    const consents = db.privacyConsents![familyId] || [];
    const dataRequests = db.dataRequests![familyId] || [];
    res.json({ settings, consents, dataRequests });
  });

  app.put('/api/family/privacy', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'approve_content');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const prev = db.privacySettings![familyId] || createDefaultPrivacySettings(familyId);
    const body = (req.body || {}) as Partial<FamilyPrivacySettings>;
    const nowIso = new Date().toISOString();

    const next: FamilyPrivacySettings = {
      familyId,
      childProfileVisibility: 'private', // Always strictly private per family isolation
      aiFeaturesConsent: typeof body.aiFeaturesConsent === 'boolean' ? body.aiFeaturesConsent : prev.aiFeaturesConsent,
      voiceInteractionConsent: typeof body.voiceInteractionConsent === 'boolean' ? body.voiceInteractionConsent : prev.voiceInteractionConsent,
      analyticsConsent: typeof body.analyticsConsent === 'boolean' ? body.analyticsConsent : prev.analyticsConsent,
      essentialTermsConsent: true,
      policyVersion: POLICY_VERSION,
      updatedAt: nowIso,
      updatedBy: user.displayName,
    };
    db.privacySettings![familyId] = next;

    // Update content policy alignment when AI or voice consents are withdrawn
    const policy = db.contentPolicies![familyId] || createDefaultContentPolicy(familyId);
    if (!next.aiFeaturesConsent) {
      policy.aiCompanionEnabled = false;
      for (const c of Object.values(db.children)) {
        if (c.familyId === familyId) {
          c.aiAssistantEnabled = false;
        }
      }
    }
    if (!next.voiceInteractionConsent) {
      policy.voiceInteractionEnabled = false;
    }
    policy.updatedAt = nowIso;
    policy.updatedBy = user.displayName;
    db.contentPolicies![familyId] = policy;

    // Append immutable consent history records for changes
    const history = db.privacyConsents![familyId] || [];
    const checks: Array<{ key: PrivacyConsentRecord['consentKey']; prevVal: boolean; nextVal: boolean }> = [
      { key: 'ai_features', prevVal: prev.aiFeaturesConsent, nextVal: next.aiFeaturesConsent },
      { key: 'voice_interaction', prevVal: prev.voiceInteractionConsent, nextVal: next.voiceInteractionConsent },
      { key: 'learning_analytics', prevVal: prev.analyticsConsent, nextVal: next.analyticsConsent },
    ];
    for (const c of checks) {
      if (c.prevVal !== c.nextVal) {
        history.unshift({
          id: `con_${crypto.randomBytes(4).toString('hex')}`,
          familyId,
          consentKey: c.key,
          granted: c.nextVal,
          policyVersion: POLICY_VERSION,
          grantedByUserId: user.id,
          grantedByName: user.displayName,
          grantedAt: nowIso,
          withdrawnAt: c.nextVal ? undefined : nowIso,
        });
      }
    }
    db.privacyConsents![familyId] = history.slice(0, 60);

    recordFamilyEvent(db, {
      familyId,
      category: 'privacy',
      actionType: 'PRIVACY_CONSENTS_UPDATED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'تحديث إعدادات الخصوصية والموافقات', en: 'Privacy & consent settings updated' },
      description: {
        ar: `حدّث ${user.displayName} الموافقات (الذكاء الاصطناعي=${next.aiFeaturesConsent}، الصوت=${next.voiceInteractionConsent})`,
        en: `${user.displayName} updated consents (AI=${next.aiFeaturesConsent}, Voice=${next.voiceInteractionConsent})`,
      },
      ip: getClientIp(req),
      securityEventType: 'CONSENT_UPDATED',
    });
    saveDb(db);

    res.json({
      settings: next,
      policy,
      consents: db.privacyConsents![familyId],
    });
  });

  app.post('/api/family/privacy/export', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'view_reports');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const nowIso = new Date().toISOString();

    const familyChildren = getAccessibleChildrenForUser(db, user).filter((c) => c.familyId === familyId);
    const reqRec: DataGovernanceRequest = {
      id: `dreq_${crypto.randomBytes(4).toString('hex')}`,
      familyId,
      type: 'export',
      status: 'completed',
      requestedByUserId: user.id,
      requestedByName: user.displayName,
      requestedAt: nowIso,
      completedAt: nowIso,
    };
    db.dataRequests![familyId] = [reqRec, ...(db.dataRequests![familyId] || [])].slice(0, 30);

    recordFamilyEvent(db, {
      familyId,
      category: 'privacy',
      actionType: 'FAMILY_DATA_EXPORTED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'تصدير نسخة بيانات العائلة', en: 'Family data archive exported' },
      description: {
        ar: `قام ${user.displayName} بتصدير نسخة منظمة من بيانات العائلة والأطفال`,
        en: `${user.displayName} exported a structured archive of their family data`,
      },
      ip: getClientIp(req),
      securityEventType: 'PRIVACY_EXPORT',
    });
    saveDb(db);

    res.json({
      request: reqRec,
      exportPackage: {
        exportedAt: nowIso,
        family: db.families![familyId],
        children: familyChildren.map((c) => ({
          id: c.id,
          displayName: c.displayName,
          ageGroup: c.ageGroup,
          ageMonths: c.ageMonths,
          stars: c.stars,
          level: c.level,
          completedActivityIds: c.completedActivityIds,
          completedDeepLessons: c.completedDeepLessons,
          level1Progress: c.level1Progress,
          level2Progress: c.level2Progress,
          skillProgress: c.skillProgress,
          learningGarden: c.learningGarden,
          familyActivitiesCompleted: c.familyActivitiesCompleted,
          activityTimeline: c.activityTimeline,
          quranSettings: db.quranChildSettings?.[c.id] || null,
          quranSurahProgress: Object.values(db.quranSurahProgress || {}).filter((p) => p.childId === c.id),
          quranStoryProgress: Object.values(db.quranStoryProgress || {}).filter((p) => p.childId === c.id),
          quranMannerProgress: Object.values(db.quranMannerProgress || {}).filter((p) => p.childId === c.id),
        })),
        privacySettings: db.privacySettings![familyId],
        consents: db.privacyConsents![familyId] || [],
        contentPolicy: db.contentPolicies![familyId],
      },
    });
  });

  app.post('/api/family/privacy/delete-request', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const ctx = requireGuardianAccess(req, res, 'manage_guardians');
    if (!ctx) return;
    const { db, familyId } = ctx;
    const user = req.authSession!.user;
    const fam = db.families![familyId];
    if (fam.primaryGuardianId !== user.id) {
      return res.status(403).json({ error: 'Only the primary guardian may submit an account deletion request.' });
    }
    const nowIso = new Date().toISOString();
    const note = sanitizeShortText(req.body?.note || '', 220);
    const reqRec: DataGovernanceRequest = {
      id: `dreq_${crypto.randomBytes(4).toString('hex')}`,
      familyId,
      type: 'deletion',
      status: 'requested',
      requestedByUserId: user.id,
      requestedByName: user.displayName,
      note: note || undefined,
      requestedAt: nowIso,
    };
    db.dataRequests![familyId] = [reqRec, ...(db.dataRequests![familyId] || [])].slice(0, 30);

    recordFamilyEvent(db, {
      familyId,
      category: 'privacy',
      actionType: 'FAMILY_DELETE_REQUESTED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      severity: 'warning',
      title: { ar: 'طلب حذف بيانات أو حساب العائلة', en: 'Family data deletion request recorded' },
      description: {
        ar: `سجّل ولي الأمر الأساسي ${user.displayName} طلب مراجعة حذف البيانات`,
        en: `Primary guardian ${user.displayName} submitted a data deletion request`,
      },
      ip: getClientIp(req),
      securityEventType: 'PRIVACY_DELETE_REQUEST',
    });
    saveDb(db);

    res.status(201).json({ request: reqRec });
  });
}
