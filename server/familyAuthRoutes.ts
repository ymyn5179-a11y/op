import crypto from 'crypto';
import type express from 'express';
import {
  clearSessionCookie,
  decryptSensitiveField,
  DEVICE_COOKIE_NAME,
  encryptSensitiveField,
  generateChildAccessCode,
  generateSecureToken,
  getClientIp,
  hashPassword,
  hashToken,
  LOCKOUT_MS,
  MAX_FAILED_LOGINS,
  normalizeChildAccessCode,
  parseCookies,
  verifyPassword,
  StoredUserRecord,
} from './security';
import { checkRateLimitPg, clearRateLimitPg, runWithPgDbLock } from './pgStore';
import {
  canUserAccessChild,
  ensureChildFamilyAndGarden,
  ensureFamilyCollections,
  ensureFamilyForUser,
  isChildOrStudentRole,
  recordFamilyEvent,
  requireParentGate,
  resolveFamilyIdForUser,
  toSafeChildProfile,
} from './familyHelpers';
import type { AuthenticatedRequest, ServerDb, StoredChildCredential } from './dbTypes';

interface FamilyAuthRouteDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
  createSessionForUser: (
    user: StoredUserRecord,
    req: express.Request,
    res: express.Response,
    opts?: { rememberMe?: boolean; sessionKind?: 'parent' | 'child' | 'staff'; childId?: string; familyId?: string; deviceId?: string },
  ) => string;
  revokeAllUserSessions: (userId: string) => void;
  toSafeUser: (user: StoredUserRecord) => Record<string, unknown>;
  isProd?: boolean;
}

function normalizeCodeVariants(raw: string): string {
  const cleaned = normalizeChildAccessCode(raw);
  if (!cleaned.includes('-') && cleaned.startsWith('NL') && cleaned.length === 10) {
    return `NL-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
  }
  return cleaned;
}

export function ensureLinkedChildUserAccount(db: ServerDb, childId: string, familyId: string, displayName: string): StoredUserRecord {
  const existing = Object.values(db.users).find(
    (u) => isChildOrStudentRole(u.role) && u.linkedChildId === childId,
  );
  if (existing) {
    existing.familyId = familyId;
    existing.displayName = displayName;
    existing.role = 'child';
    existing.status = 'active';
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const nowIso = new Date().toISOString();
  const userId = `u_child_${childId}`;
  const internalEmail = `child.${childId}@child.nonoland.internal`;
  const rec: StoredUserRecord = {
    id: userId,
    email: internalEmail,
    normalizedEmail: internalEmail,
    displayName,
    passwordHash: hashPassword(generateSecureToken(24)),
    role: 'child',
    emailVerified: true,
    status: 'active',
    linkedChildId: childId,
    familyId,
    policyVersion: '2026.04',
    termsAcceptedAt: nowIso,
    failedLoginAttempts: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  db.users[userId] = rec;
  db.emailIndex[internalEmail] = userId;
  return rec;
}

export function registerFamilyAuthRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  createSessionForUser,
  revokeAllUserSessions,
  toSafeUser,
  isProd = false,
}: FamilyAuthRouteDeps) {
  // 1. CHILD LOGIN USING ACCESS CODE + PIN (CSRF-exempt public login route)
  app.post('/api/auth/child-login', async (req, res) => {
    const ip = getClientIp(req);
    const { accessCode, pin } = (req.body || {}) as { accessCode?: string; pin?: string };

    if (!(await checkRateLimitPg(`child-login:${ip}`, 15, 10 * 60_000))) {
      return res.status(429).json({
        error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
        code: 'RATE_LIMITED',
      });
    }

    const normalizedCode = normalizeCodeVariants(accessCode || '');
    const pinStr = String(pin || '').trim();
    if (!normalizedCode || !/^\d{4,6}$/.test(pinStr)) {
      return res.status(401).json({ error: 'Invalid child access code or PIN.' });
    }

    try {
      const outcome = await runWithPgDbLock(`child-login:${normalizedCode}`, async (db) => {
        ensureFamilyCollections(db);
        const codeHash = hashToken(normalizedCode);
        const childId = db.childAccessCodeIndex?.[codeHash];
        const cred = childId ? db.childCredentials?.[childId] : undefined;
        const child = childId ? db.children[childId] : undefined;

        if (!cred || !child) {
          return { status: 401, body: { error: 'Invalid child access code or PIN.' } };
        }

        if (cred.lockedUntil && new Date(cred.lockedUntil).getTime() > Date.now()) {
          return {
            status: 423,
            body: {
              error: 'Child access is temporarily paused for 5 minutes to stay safe. Ask a parent to check or try shortly.',
              code: 'CHILD_PIN_LOCKED',
            },
          };
        }

        if (!verifyPassword(pinStr, cred.pinHash)) {
          cred.failedAttempts = (cred.failedAttempts || 0) + 1;
          if (cred.failedAttempts >= MAX_FAILED_LOGINS) {
            cred.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
          }
          cred.updatedAt = new Date().toISOString();
          const familyId = ensureChildFamilyAndGarden(db, child);
          recordFamilyEvent(db, {
            familyId,
            category: 'auth',
            actionType: 'CHILD_LOGIN_FAILED',
            childId: child.id,
            childName: child.displayName,
            severity: cred.failedAttempts >= MAX_FAILED_LOGINS ? 'warning' : 'info',
            title: { ar: 'محاولة دخول غير صحيحة للطفل', en: 'Failed child PIN attempt' },
            description: {
              ar: `محاولة دخول برمز سري غير صحيح لحساب الطفل ${child.displayName}`,
              en: `Incorrect PIN entered for child profile ${child.displayName}`,
            },
            ip,
            securityEventType: 'CHILD_LOGIN_FAILED',
          });
          return { status: 401, body: { error: 'Invalid child access code or PIN.' } };
        }

        cred.failedAttempts = 0;
        cred.lockedUntil = undefined;
        cred.lastLoginAt = new Date().toISOString();
        cred.updatedAt = cred.lastLoginAt;
        await clearRateLimitPg(`child-login:${ip}`);

        const familyId = ensureChildFamilyAndGarden(db, child);
        const childUser = ensureLinkedChildUserAccount(db, child.id, familyId, child.displayName);

        // Optional trusted device association if cookie present & valid for this family
        const cookies = parseCookies(req.headers.cookie);
        const rawDeviceToken = cookies[DEVICE_COOKIE_NAME];
        let deviceId: string | undefined;
        if (rawDeviceToken) {
          const devTokenHash = hashToken(rawDeviceToken);
          const dev = Object.values(db.trustedDevices || {}).find(
            (d) => d.tokenHash === devTokenHash && !d.revoked && d.trusted && d.familyId === familyId,
          );
          if (dev) {
            dev.lastActiveAt = new Date().toISOString();
            deviceId = dev.id;
          }
        }

        const csrfToken = createSessionForUser(childUser, req, res, {
          sessionKind: 'child',
          childId: child.id,
          familyId,
          deviceId,
        });

        recordFamilyEvent(db, {
          familyId,
          category: 'auth',
          actionType: 'CHILD_LOGIN_SUCCESS',
          actorId: childUser.id,
          actorName: child.displayName,
          actorRole: 'child',
          childId: child.id,
          childName: child.displayName,
          deviceId,
          title: { ar: 'دخول الطفل إلى عالمه التعليمي', en: 'Child signed into learning world' },
          description: {
            ar: `دخل الطفل ${child.displayName} باستخدام رمز الدخول والرقم السري`,
            en: `Child ${child.displayName} signed in using Access Code and PIN`,
          },
          ip,
          securityEventType: 'CHILD_LOGIN',
        });

        return {
          status: 200,
          body: {
            user: toSafeUser(childUser),
            child: toSafeChildProfile(db, child),
            csrfToken,
          },
        };
      });

      return res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error('Child login DB lock error (failing closed):', (err as Error)?.message || err);
      return res.status(503).json({
        error: 'Database unavailable. Failing closed for data safety.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  // 2. TRUSTED FAMILY DEVICE PROFILES (Read ONLY server-issued nono_device cookie, strictly scoped to that family)
  app.get('/api/auth/trusted-device-profiles', (req, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const cookies = parseCookies(req.headers.cookie);
    const rawDeviceToken = cookies[DEVICE_COOKIE_NAME];
    if (!rawDeviceToken) {
      return res.json({ trusted: false, profiles: [] });
    }
    const devHash = hashToken(rawDeviceToken);
    const device = Object.values(db.trustedDevices || {}).find(
      (d) => d.tokenHash === devHash && !d.revoked && d.trusted,
    );
    if (!device) {
      return res.json({ trusted: false, profiles: [] });
    }

    device.lastActiveAt = new Date().toISOString();
    const familyProfiles = Object.values(db.children)
      .filter((c) => {
        const cFam = ensureChildFamilyAndGarden(db, c);
        return cFam === device.familyId && Boolean(db.childCredentials?.[c.id]);
      })
      .map((c) => ({
        id: c.id,
        displayName: c.displayName,
        avatar: c.avatarConfig,
        ageGroup: c.ageGroup,
        requiresPin: true,
      }));
    saveDb(db);

    res.json({
      trusted: true,
      deviceId: device.id,
      deviceName: device.deviceName,
      profiles: familyProfiles,
    });
  });

  // 3. CHILD QUICK LOGIN ON TRUSTED DEVICE (Requires valid nono_device cookie + exact Child PIN)
  app.post('/api/auth/child-quick-login', async (req, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`child-quick:${ip}`, 15, 10 * 60_000))) {
      return res.status(429).json({ error: 'Too many sign-in attempts. Please wait a few minutes.' });
    }

    const cookies = parseCookies(req.headers.cookie);
    const rawDeviceToken = cookies[DEVICE_COOKIE_NAME];
    if (!rawDeviceToken) {
      return res.status(403).json({ error: 'This device is not trusted for quick family selection.' });
    }
    const devHash = hashToken(rawDeviceToken);
    const device = Object.values(db.trustedDevices || {}).find(
      (d) => d.tokenHash === devHash && !d.revoked && d.trusted,
    );
    if (!device) {
      return res.status(403).json({ error: 'This device trust token is expired or revoked.' });
    }

    const { childId, pin } = (req.body || {}) as { childId?: string; pin?: string };
    const cleanChildId = String(childId || '').trim();
    const pinStr = String(pin || '').trim();
    const child = cleanChildId ? db.children[cleanChildId] : undefined;
    const cred = cleanChildId ? db.childCredentials?.[cleanChildId] : undefined;

    if (!child || !cred || ensureChildFamilyAndGarden(db, child) !== device.familyId) {
      return res.status(401).json({ error: 'Invalid child selection or PIN.' });
    }

    if (cred.lockedUntil && new Date(cred.lockedUntil).getTime() > Date.now()) {
      return res.status(423).json({ error: 'Child PIN is temporarily paused for 5 minutes for safety.' });
    }

    if (!/^\d{4,6}$/.test(pinStr) || !verifyPassword(pinStr, cred.pinHash)) {
      cred.failedAttempts = (cred.failedAttempts || 0) + 1;
      if (cred.failedAttempts >= MAX_FAILED_LOGINS) {
        cred.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
      }
      saveDb(db);
      return res.status(401).json({ error: 'Invalid child selection or PIN.' });
    }

    cred.failedAttempts = 0;
    cred.lockedUntil = undefined;
    cred.lastLoginAt = new Date().toISOString();
    device.lastActiveAt = cred.lastLoginAt;

    const childUser = ensureLinkedChildUserAccount(db, child.id, device.familyId, child.displayName);
    const csrfToken = createSessionForUser(childUser, req, res, {
      sessionKind: 'child',
      childId: child.id,
      familyId: device.familyId,
      deviceId: device.id,
    });

    recordFamilyEvent(db, {
      familyId: device.familyId,
      category: 'auth',
      actionType: 'CHILD_QUICK_LOGIN',
      actorId: childUser.id,
      actorName: child.displayName,
      actorRole: 'child',
      childId: child.id,
      childName: child.displayName,
      deviceId: device.id,
      title: { ar: 'دخول سريع للطفل من جهاز عائلي موثوق', en: 'Child quick sign-in on trusted device' },
      description: {
        ar: `دخل الطفل ${child.displayName} من الجهاز الموثوق ${device.deviceName}`,
        en: `Child ${child.displayName} signed in on trusted device ${device.deviceName}`,
      },
      ip,
      securityEventType: 'CHILD_LOGIN',
    });
    saveDb(db);

    res.json({
      user: toSafeUser(childUser),
      child: toSafeChildProfile(db, child),
      csrfToken,
    });
  });

  // 4. PARENT GATE STATUS, VERIFICATION & PIN MANAGEMENT
  app.get('/api/parent/gate/status', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const { user, session } = req.authSession!;
    if (isChildOrStudentRole(user.role) || session.sessionKind === 'child') {
      return res.json({
        verified: false,
        remainingSeconds: 0,
        hasParentPin: false,
        isChildSession: true,
      });
    }

    const cred = db.parentGateCredentials?.[user.id];
    const remainingMs = Math.max(0, (session.parentGateVerifiedUntil || 0) - Date.now());
    res.json({
      verified: remainingMs > 0,
      remainingSeconds: Math.floor(remainingMs / 1000),
      hasParentPin: Boolean(cred),
      isChildSession: false,
      lockedUntil: cred?.lockedUntil,
    });
  });

  app.post('/api/parent/gate/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const { user, session } = req.authSession!;
    const ip = getClientIp(req);

    if (isChildOrStudentRole(user.role) || session.sessionKind === 'child') {
      return res.status(403).json({
        error: 'Child sessions cannot unlock the Parent Gate. Please sign in with a Parent account.',
        code: 'CHILD_SESSION_FORBIDDEN',
      });
    }
    if (user.role !== 'parent' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Parent role required' });
    }

    if (!(await checkRateLimitPg(`parent-gate:${user.id}:${ip}`, 10, 5 * 60_000))) {
      return res.status(429).json({ error: 'Too many verification attempts. Please wait 5 minutes.' });
    }

    const { pin, password } = (req.body || {}) as { pin?: string; password?: string };
    const gateCred = db.parentGateCredentials?.[user.id];
    const familyId = resolveFamilyIdForUser(db, user) || `fam_${user.id}`;

    if (gateCred?.lockedUntil && new Date(gateCred.lockedUntil).getTime() > Date.now() && !password) {
      return res.status(423).json({
        error: 'Parent PIN temporarily locked for 5 minutes. You may verify with your account password instead.',
        code: 'PARENT_PIN_LOCKED',
      });
    }

    let ok = false;
    if (typeof pin === 'string' && pin.trim().length > 0) {
      if (gateCred) {
        ok = verifyPassword(pin.trim(), gateCred.pinHash);
      }
    }
    if (!ok && typeof password === 'string' && password.length > 0) {
      ok = verifyPassword(password, user.passwordHash);
    }

    if (!ok) {
      if (gateCred) {
        gateCred.failedAttempts = (gateCred.failedAttempts || 0) + 1;
        if (gateCred.failedAttempts >= MAX_FAILED_LOGINS) {
          gateCred.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
        }
        gateCred.updatedAt = new Date().toISOString();
      }
      recordFamilyEvent(db, {
        familyId,
        category: 'security',
        actionType: 'PARENT_GATE_FAILED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        severity: 'warning',
        title: { ar: 'فشل التحقق في بوابة ولي الأمر', en: 'Parent Gate verification failed' },
        description: {
          ar: `محاولة غير صحيحة لفتح بوابة ولي الأمر لحساب ${user.displayName}`,
          en: `Incorrect Parent Gate PIN or password attempt by ${user.displayName}`,
        },
        ip,
        securityEventType: 'PARENT_GATE_FAIL',
      });
      saveDb(db);
      return res.status(401).json({ error: 'Invalid Parent PIN or account password.' });
    }

    if (gateCred) {
      gateCred.failedAttempts = 0;
      gateCred.lockedUntil = undefined;
    }
    session.parentGateVerifiedUntil = Date.now() + 15 * 60_000;
    await clearRateLimitPg(`parent-gate:${user.id}:${ip}`);

    recordFamilyEvent(db, {
      familyId,
      category: 'security',
      actionType: 'PARENT_GATE_UNLOCKED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'تم فتح بوابة ولي الأمر', en: 'Parent Gate verified' },
      description: {
        ar: `تحقق ${user.displayName} من هويته بنجاح لفتح الإعدادات الحساسة`,
        en: `${user.displayName} unlocked the Parent Gate for 15 minutes`,
      },
      ip,
      securityEventType: 'PARENT_GATE_VERIFY',
    });
    saveDb(db);

    res.json({
      verified: true,
      remainingSeconds: 15 * 60,
      hasParentPin: Boolean(gateCred),
    });
  });

  app.post('/api/parent/gate/pin', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    ensureFamilyCollections(db);
    const { user, session } = req.authSession!;
    const ip = getClientIp(req);

    if (isChildOrStudentRole(user.role) || session.sessionKind === 'child') {
      return res.status(403).json({ error: 'Child sessions cannot set Parent PIN.' });
    }
    if (user.role !== 'parent' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only parents can set a Parent PIN.' });
    }

    const { currentPassword, newPin } = (req.body || {}) as { currentPassword?: string; newPin?: string };
    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Current account password is incorrect.' });
    }
    const cleanPin = String(newPin || '').trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      return res.status(400).json({ error: 'Parent PIN must be 4 to 6 numeric digits.' });
    }

    const fam = ensureFamilyForUser(db, user);
    const nowIso = new Date().toISOString();
    db.parentGateCredentials![user.id] = {
      userId: user.id,
      familyId: fam.id,
      pinHash: hashPassword(cleanPin),
      failedAttempts: 0,
      createdAt: db.parentGateCredentials![user.id]?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    session.parentGateVerifiedUntil = Date.now() + 15 * 60_000;

    recordFamilyEvent(db, {
      familyId: fam.id,
      category: 'security',
      actionType: 'PARENT_PIN_UPDATED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      title: { ar: 'تحديث رمز الحماية الأبوي (PIN)', en: 'Parent Gate PIN configured' },
      description: {
        ar: `قام ${user.displayName} بتعيين أو تحديث رمز الحماية الأبوي`,
        en: `${user.displayName} configured or rotated their Parent Gate PIN`,
      },
      ip,
      securityEventType: 'PARENT_SETTING_CHANGE',
    });
    saveDb(db);

    res.json({
      hasParentPin: true,
      verified: true,
      remainingSeconds: 15 * 60,
    });
  });

  app.post('/api/parent/gate/lock', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    req.authSession!.session.parentGateVerifiedUntil = 0;
    saveDb(db);
    res.json({ verified: false });
  });

  // 5. PARENT-MANAGED CHILD ACCESS CODE & HASHED PIN (Parent Gate Protected)
  app.get('/api/family/children/:childId/credentials', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, user, child, 'manage_credentials')) {
      return res.status(403).json({ error: 'Not authorized to manage credentials for this child.' });
    }

    const cred = db.childCredentials?.[child.id];
    if (!cred) {
      return res.json({
        childId: child.id,
        hasCredentials: false,
      });
    }

    const accessCode = decryptSensitiveField(cred.accessCodeEncrypted);
    res.json({
      childId: child.id,
      hasCredentials: true,
      accessCode,
      accessCodeMasked: `NL-••••-${cred.accessCodeLast4}`,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
      rotatedAt: cred.rotatedAt,
      lastLoginAt: cred.lastLoginAt,
      lockedUntil: cred.lockedUntil,
    });
  });

  app.post('/api/family/children/:childId/credentials', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    const ip = getClientIp(req);
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, user, child, 'manage_credentials')) {
      return res.status(403).json({ error: 'Not authorized to manage credentials for this child.' });
    }

    const { pin, rotateAccessCode } = (req.body || {}) as { pin?: string; rotateAccessCode?: boolean };
    const existing = db.childCredentials?.[child.id];

    const cleanPin = typeof pin === 'string' ? pin.trim() : '';
    if (!existing && !/^\d{4,6}$/.test(cleanPin)) {
      return res.status(400).json({ error: 'A 4 to 6 digit numeric PIN is required when setting up child login.' });
    }
    if (cleanPin && !/^\d{4,6}$/.test(cleanPin)) {
      return res.status(400).json({ error: 'Child PIN must be 4 to 6 numeric digits.' });
    }

    const familyId = ensureChildFamilyAndGarden(db, child);
    const nowIso = new Date().toISOString();

    let accessCode: string | null = existing ? decryptSensitiveField(existing.accessCodeEncrypted) : null;
    let rotated = false;
    if (!existing || !accessCode || rotateAccessCode) {
      if (existing?.accessCodeHash) {
        delete db.childAccessCodeIndex![existing.accessCodeHash];
      }
      // Generate guaranteed unique non-guessable Access Code
      let candidate = generateChildAccessCode();
      while (db.childAccessCodeIndex![hashToken(candidate)]) {
        candidate = generateChildAccessCode();
      }
      accessCode = candidate;
      rotated = Boolean(existing);
    }

    const nextHash = hashToken(accessCode);
    db.childAccessCodeIndex![nextHash] = child.id;

    const nextCred: StoredChildCredential = {
      childId: child.id,
      familyId,
      accessCodeHash: nextHash,
      accessCodeEncrypted: encryptSensitiveField(accessCode),
      accessCodeLast4: accessCode.slice(-4),
      pinHash: cleanPin ? hashPassword(cleanPin) : existing!.pinHash,
      failedAttempts: 0,
      lockedUntil: undefined,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      rotatedAt: rotated ? nowIso : existing?.rotatedAt,
      lastLoginAt: existing?.lastLoginAt,
    };
    db.childCredentials![child.id] = nextCred;
    ensureLinkedChildUserAccount(db, child.id, familyId, child.displayName);

    recordFamilyEvent(db, {
      familyId,
      category: 'security',
      actionType: existing ? (rotated ? 'CHILD_CREDENTIALS_ROTATED' : 'CHILD_PIN_RESET') : 'CHILD_CREDENTIALS_CREATED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      childId: child.id,
      childName: child.displayName,
      title: {
        ar: existing ? 'تحديث بيانات دخول الطفل' : 'إنشاء رمز دخول ورقم سري للطفل',
        en: existing ? 'Child login credentials updated' : 'Child Access Code & PIN created',
      },
      description: {
        ar: `قام ${user.displayName} بتحديث بيانات دخول الطفل ${child.displayName}`,
        en: `${user.displayName} ${existing ? 'updated' : 'created'} login credentials for ${child.displayName}`,
      },
      ip,
      securityEventType: 'CHILD_CREDENTIALS_UPDATE',
    });
    saveDb(db);

    res.status(existing ? 200 : 201).json({
      childId: child.id,
      hasCredentials: true,
      accessCode,
      accessCodeMasked: `NL-••••-${nextCred.accessCodeLast4}`,
      pinSet: true,
      updatedAt: nextCred.updatedAt,
      rotatedAt: nextCred.rotatedAt,
    });
  });

  // 6. SAFE CHILD REMOVAL WITH AUDIT TRAIL PRESERVATION
  app.post('/api/family/children/:childId/delete', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!requireParentGate(req, res)) return;
    const db = getDb();
    ensureFamilyCollections(db);
    const user = req.authSession!.user;
    const ip = getClientIp(req);
    const child = db.children[req.params.childId];
    if (!child || !canUserAccessChild(db, user, child, 'manage_credentials')) {
      return res.status(403).json({ error: 'Not authorized to remove this child profile.' });
    }

    const familyId = ensureChildFamilyAndGarden(db, child);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 180) : 'Parent removed child profile';

    db.archivedChildren![child.id] = {
      childId: child.id,
      familyId,
      parentId: child.parentId,
      displayName: child.displayName,
      deletedByUserId: user.id,
      deletedAt: new Date().toISOString(),
      reason,
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
        linkedUser.updatedAt = new Date().toISOString();
      }
    }

    delete db.children[child.id];

    recordFamilyEvent(db, {
      familyId,
      category: 'profile',
      actionType: 'CHILD_PROFILE_DELETED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      childId: child.id,
      childName: child.displayName,
      severity: 'warning',
      title: { ar: 'حذف ملف طفل بأمان', en: 'Child profile safely removed' },
      description: {
        ar: `تم حذف ملف الطفل ${child.displayName} وإبطال جلساته مع حفظ سجل التدقيق`,
        en: `Child profile ${child.displayName} removed, sessions revoked, and audit record preserved`,
      },
      ip,
      securityEventType: 'PARENT_SETTING_CHANGE',
    });
    saveDb(db);

    res.json({ deleted: true, childId: child.id });
  });

  // 7. SAFE EXIT FROM CHILD SESSION (Clears cookie cleanly so parent login can happen cleanly)
  app.post('/api/auth/exit-child-mode', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const { session, user } = req.authSession!;
    delete db.sessions[session.tokenHash];
    clearSessionCookie(res, req, isProd);
    if (user.familyId) {
      recordFamilyEvent(db, {
        familyId: user.familyId,
        category: 'auth',
        actionType: 'CHILD_SESSION_EXITED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        childId: user.linkedChildId,
        title: { ar: 'تسجيل خروج من جلسة الطفل', en: 'Signed out of child session' },
        description: {
          ar: `تم إغلاق جلسة الطفل ${user.displayName} بأمان`,
          en: `Child session for ${user.displayName} ended safely`,
        },
        ip: getClientIp(req),
        securityEventType: 'LOGOUT',
      });
    }
    saveDb(db);
    res.json({ signedOut: true });
  });
}
