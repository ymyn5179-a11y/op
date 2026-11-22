import crypto from 'crypto';
import type express from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db as pgDb, pool } from '../src/db/index';
import { webauthnChallenges, webauthnCredentials } from '../src/db/schema';
import type { PasskeySummary } from '../src/types/nonoland';
import { normalizeEmail, sanitizeShortText, validateEmail } from '../src/utils/validation';
import type { AuthenticatedRequest, ServerDb } from './dbTypes';
import { ensureFamilyForUser, isChildOrStudentRole, recordFamilyEvent } from './familyHelpers';
import { checkRateLimitPg, isUsingInMemoryDevFallback } from './pgStore';
import {
  appendSecurityLog,
  getClientIp,
  getDashboardRouteForRole,
  hashToken,
  parseCookies,
  SESSION_COOKIE_NAME,
  StoredUserRecord,
  verifyPassword,
} from './security';

export interface StoredPasskeyCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string; // base64url COSE public key
  counter: number;
  transports: string[];
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  aaguid: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface StoredWebAuthnChallenge {
  id: string;
  challenge: string;
  purpose: 'registration' | 'authentication';
  userId: string | null;
  expectedOrigin: string;
  expectedRpId: string;
  expiresAt: number;
  usedAt: number | null;
  createdAt: string;
}

interface PasskeyRouteDeps {
  app: express.Express;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
  createSessionForUser: (
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
  ) => string;
  toSafeUser: (user: StoredUserRecord) => Record<string, unknown>;
}

const CHALLENGE_TTL_MS = 5 * 60_000;
const REAUTH_WINDOW_MS = 5 * 60_000;
const RP_NAME = 'NonoLand';

// Server-side recent password re-authentication tracker keyed by session tokenHash
const passwordReauthWindows = new Map<string, { userId: string; expiresAt: number }>();

// Dev in-memory store used ONLY when PostgreSQL is explicitly not configured in dev mode
const devCredentials = new Map<string, StoredPasskeyCredential>(); // key: id
const devChallenges = new Map<string, StoredWebAuthnChallenge>(); // key: challenge

export function clearPasswordReauth(tokenHash?: string): void {
  if (!tokenHash) return;
  passwordReauthWindows.delete(tokenHash);
}

export function clearPasswordReauthForUser(userId: string): void {
  for (const [hash, entry] of passwordReauthWindows.entries()) {
    if (entry.userId === userId) {
      passwordReauthWindows.delete(hash);
    }
  }
}

function getReauthRemainingSeconds(tokenHash: string, userId: string): number {
  const entry = passwordReauthWindows.get(tokenHash);
  if (!entry || entry.userId !== userId) return 0;
  const rem = entry.expiresAt - Date.now();
  if (rem <= 0) {
    passwordReauthWindows.delete(tokenHash);
    return 0;
  }
  return Math.ceil(rem / 1000);
}

export function clearWebAuthnDevMemoryForTests(): void {
  devCredentials.clear();
  devChallenges.clear();
  passwordReauthWindows.clear();
}

function normalizeOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function rpIdMatchesOriginHost(rpId: string, originHostname: string): boolean {
  const cleanRpId = rpId.trim().toLowerCase();
  const cleanHost = originHostname.trim().toLowerCase();
  if (!cleanRpId || !cleanHost) return false;
  if (cleanRpId === cleanHost) return true;
  if (cleanHost.endsWith(`.${cleanRpId}`) && cleanRpId.includes('.')) return true;
  return false;
}

export function resolveWebAuthnContext(req: express.Request):
  | { ok: true; rpName: string; rpId: string; expectedOrigin: string; allowedOrigins: string[] }
  | { ok: false; status: number; error: string } {
  const isProd = process.env.NODE_ENV === 'production';
  const configuredOriginsRaw = [
    process.env.WEBAUTHN_ALLOWED_ORIGINS || '',
    process.env.APP_URL || '',
  ]
    .join(',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const configuredOrigins: string[] = [];
  for (const item of configuredOriginsRaw) {
    const norm = normalizeOrigin(item);
    if (!norm) continue;
    const u = new URL(norm);
    if (isProd) {
      if (u.protocol !== 'https:' || isLocalhostHostname(u.hostname)) continue;
    }
    if (!configuredOrigins.includes(norm)) configuredOrigins.push(norm);
  }

  const reqOriginRaw = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const reqOriginNorm = reqOriginRaw ? normalizeOrigin(reqOriginRaw) : null;

  if (isProd) {
    if (configuredOrigins.length === 0) {
      return {
        ok: false,
        status: 503,
        error:
          'WebAuthn production origin is not configured. Configure an HTTPS WEBAUTHN_ALLOWED_ORIGINS or APP_URL.',
      };
    }

    if (reqOriginRaw) {
      if (!reqOriginNorm || !configuredOrigins.includes(reqOriginNorm)) {
        return {
          ok: false,
          status: 403,
          error: 'Untrusted WebAuthn origin.',
        };
      }
    }

    const expectedOrigin = reqOriginNorm || configuredOrigins[0];
    const originHost = new URL(expectedOrigin).hostname;
    const configuredRpId = (process.env.WEBAUTHN_RP_ID || '').trim().toLowerCase();
    const rpId = configuredRpId || originHost;

    if (!rpIdMatchesOriginHost(rpId, originHost) || isLocalhostHostname(rpId)) {
      return {
        ok: false,
        status: 503,
        error: 'Invalid WebAuthn RP ID configuration for production origin.',
      };
    }

    return {
      ok: true,
      rpName: RP_NAME,
      rpId,
      expectedOrigin,
      allowedOrigins: configuredOrigins,
    };
  }

  // Development / test environment
  const devOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    ...configuredOrigins,
  ];
  const uniqueDevOrigins = Array.from(new Set(devOrigins));

  if (reqOriginRaw) {
    if (!reqOriginNorm) {
      return { ok: false, status: 403, error: 'Malformed WebAuthn origin.' };
    }
    const u = new URL(reqOriginNorm);
    const isLocalHttp = u.protocol === 'http:' && isLocalhostHostname(u.hostname);
    if (!uniqueDevOrigins.includes(reqOriginNorm) && !isLocalHttp) {
      return { ok: false, status: 403, error: 'Untrusted WebAuthn origin.' };
    }
  }

  const hostHeader = String(req.headers.host || '').split(':')[0]?.trim().toLowerCase();
  const fallbackOrigin =
    hostHeader === '127.0.0.1' ? 'http://127.0.0.1:3000' : 'http://localhost:3000';
  const expectedOrigin = reqOriginNorm || uniqueDevOrigins[0] || fallbackOrigin;
  const originHost = new URL(expectedOrigin).hostname;
  const configuredRpId = (process.env.WEBAUTHN_RP_ID || '').trim().toLowerCase();
  const rpId = configuredRpId || originHost;

  if (!rpIdMatchesOriginHost(rpId, originHost)) {
    return {
      ok: false,
      status: 403,
      error: 'WebAuthn RP ID does not match request origin.',
    };
  }

  return {
    ok: true,
    rpName: RP_NAME,
    rpId,
    expectedOrigin,
    allowedOrigins: uniqueDevOrigins,
  };
}

function toSafePasskeySummary(cred: StoredPasskeyCredential): PasskeySummary {
  return {
    id: cred.id,
    label: cred.label,
    deviceType: cred.deviceType,
    backedUp: cred.backedUp,
    transports: Array.isArray(cred.transports) ? cred.transports : [],
    createdAt: cred.createdAt,
    lastUsedAt: cred.lastUsedAt,
    revokedAt: cred.revokedAt,
  };
}

function decodeChallengeFromClientData(clientDataJSON: unknown): string | null {
  if (typeof clientDataJSON !== 'string' || !clientDataJSON) return null;
  try {
    const raw = Buffer.from(clientDataJSON, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { challenge?: unknown };
    return typeof parsed?.challenge === 'string' && parsed.challenge.length >= 16
      ? parsed.challenge
      : null;
  } catch {
    return null;
  }
}

async function listCredentialsForUser(userId: string): Promise<StoredPasskeyCredential[]> {
  if (isUsingInMemoryDevFallback()) {
    return Array.from(devCredentials.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  const rows = await pgDb
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .orderBy(desc(webauthnCredentials.createdAt));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: Number(r.counter ?? 0),
    transports: Array.isArray(r.transports) ? r.transports : [],
    deviceType: r.deviceType,
    backedUp: Boolean(r.backedUp),
    aaguid: r.aaguid || '',
    label: r.label,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt ?? null,
    revokedAt: r.revokedAt ?? null,
  }));
}

async function findCredentialByCredentialId(credentialId: string): Promise<StoredPasskeyCredential | null> {
  if (isUsingInMemoryDevFallback()) {
    for (const c of devCredentials.values()) {
      if (c.credentialId === credentialId) return { ...c };
    }
    return null;
  }
  const rows = await pgDb
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, credentialId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: Number(r.counter ?? 0),
    transports: Array.isArray(r.transports) ? r.transports : [],
    deviceType: r.deviceType,
    backedUp: Boolean(r.backedUp),
    aaguid: r.aaguid || '',
    label: r.label,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt ?? null,
    revokedAt: r.revokedAt ?? null,
  };
}

async function findCredentialById(id: string): Promise<StoredPasskeyCredential | null> {
  if (isUsingInMemoryDevFallback()) {
    const c = devCredentials.get(id);
    return c ? { ...c } : null;
  }
  const rows = await pgDb
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.id, id))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: Number(r.counter ?? 0),
    transports: Array.isArray(r.transports) ? r.transports : [],
    deviceType: r.deviceType,
    backedUp: Boolean(r.backedUp),
    aaguid: r.aaguid || '',
    label: r.label,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt ?? null,
    revokedAt: r.revokedAt ?? null,
  };
}

async function saveNewCredential(cred: StoredPasskeyCredential): Promise<void> {
  if (isUsingInMemoryDevFallback()) {
    devCredentials.set(cred.id, { ...cred });
    return;
  }
  await pgDb.insert(webauthnCredentials).values({
    id: cred.id,
    userId: cred.userId,
    credentialId: cred.credentialId,
    publicKey: cred.publicKey,
    counter: cred.counter,
    transports: cred.transports,
    deviceType: cred.deviceType,
    backedUp: cred.backedUp,
    aaguid: cred.aaguid,
    label: cred.label,
    createdAt: cred.createdAt,
    lastUsedAt: cred.lastUsedAt,
    revokedAt: cred.revokedAt,
  });
}

async function updateCredentialUsage(id: string, newCounter: number, lastUsedAt: string): Promise<void> {
  if (isUsingInMemoryDevFallback()) {
    const existing = devCredentials.get(id);
    if (existing) {
      existing.counter = newCounter;
      existing.lastUsedAt = lastUsedAt;
    }
    return;
  }
  await pgDb
    .update(webauthnCredentials)
    .set({ counter: newCounter, lastUsedAt })
    .where(and(eq(webauthnCredentials.id, id), isNull(webauthnCredentials.revokedAt)));
}

async function revokeCredentialById(id: string, userId: string, revokedAt: string): Promise<StoredPasskeyCredential | null> {
  if (isUsingInMemoryDevFallback()) {
    const existing = devCredentials.get(id);
    if (!existing || existing.userId !== userId || existing.revokedAt) return null;
    existing.revokedAt = revokedAt;
    return { ...existing };
  }
  const rows = await pgDb
    .update(webauthnCredentials)
    .set({ revokedAt })
    .where(
      and(
        eq(webauthnCredentials.id, id),
        eq(webauthnCredentials.userId, userId),
        isNull(webauthnCredentials.revokedAt),
      ),
    )
    .returning();
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    userId: r.userId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: Number(r.counter ?? 0),
    transports: Array.isArray(r.transports) ? r.transports : [],
    deviceType: r.deviceType,
    backedUp: Boolean(r.backedUp),
    aaguid: r.aaguid || '',
    label: r.label,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt ?? null,
    revokedAt: r.revokedAt ?? null,
  };
}

async function saveChallenge(entry: StoredWebAuthnChallenge): Promise<void> {
  if (isUsingInMemoryDevFallback()) {
    // Prune expired challenges cleanly
    const now = Date.now();
    for (const [k, v] of devChallenges.entries()) {
      if (v.expiresAt < now || v.usedAt !== null) {
        devChallenges.delete(k);
      }
    }
    devChallenges.set(entry.challenge, { ...entry });
    return;
  }
  await pgDb.insert(webauthnChallenges).values({
    id: entry.id,
    challenge: entry.challenge,
    purpose: entry.purpose,
    userId: entry.userId,
    expectedOrigin: entry.expectedOrigin,
    expectedRpId: entry.expectedRpId,
    expiresAt: entry.expiresAt,
    usedAt: entry.usedAt,
    createdAt: entry.createdAt,
  });
}

async function consumeChallengeAtomically(
  challenge: string,
  purpose: 'registration' | 'authentication',
  requiredUserId: string | null,
): Promise<StoredWebAuthnChallenge | null> {
  const now = Date.now();
  if (isUsingInMemoryDevFallback()) {
    const rec = devChallenges.get(challenge);
    if (!rec) return null;
    if (rec.purpose !== purpose || rec.usedAt !== null || rec.expiresAt <= now) return null;
    if (requiredUserId !== null && rec.userId !== requiredUserId) return null;
    rec.usedAt = now;
    return { ...rec };
  }

  const sqlQuery =
    requiredUserId !== null
      ? `UPDATE webauthn_challenges
         SET used_at = $1
         WHERE challenge = $2
           AND purpose = $3
           AND used_at IS NULL
           AND expires_at > $1
           AND user_id = $4
         RETURNING id, challenge, purpose, user_id, expected_origin, expected_rp_id, expires_at, used_at, created_at`
      : `UPDATE webauthn_challenges
         SET used_at = $1
         WHERE challenge = $2
           AND purpose = $3
           AND used_at IS NULL
           AND expires_at > $1
         RETURNING id, challenge, purpose, user_id, expected_origin, expected_rp_id, expires_at, used_at, created_at`;

  const params =
    requiredUserId !== null ? [now, challenge, purpose, requiredUserId] : [now, challenge, purpose];

  const result = await pool.query<{
    id: string;
    challenge: string;
    purpose: 'registration' | 'authentication';
    user_id: string | null;
    expected_origin: string;
    expected_rp_id: string;
    expires_at: string | number;
    used_at: string | number | null;
    created_at: string;
  }>(sqlQuery, params);

  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    challenge: row.challenge,
    purpose: row.purpose,
    userId: row.user_id,
    expectedOrigin: row.expected_origin,
    expectedRpId: row.expected_rp_id,
    expiresAt: Number(row.expires_at),
    usedAt: row.used_at !== null ? Number(row.used_at) : null,
    createdAt: row.created_at,
  };
}

function assertActiveParentSession(req: AuthenticatedRequest, res: express.Response, db: ServerDb): StoredUserRecord | null {
  const auth = req.authSession;
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const { user, session } = auth;
  if (
    user.role !== 'parent' ||
    user.status !== 'active' ||
    isChildOrStudentRole(user.role) ||
    session.sessionKind === 'child'
  ) {
    appendSecurityLog(db.securityLogs, {
      eventType: 'ACCESS_DENIED',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: `Blocked non-parent (${user.role}) from Passkey endpoint`,
    });
    res.status(403).json({
      error: 'Passkeys are only supported for active parent accounts.',
    });
    return null;
  }
  return user;
}

function ensureRecentPasswordReauth(
  req: AuthenticatedRequest,
  res: express.Response,
  db: ServerDb,
  user: StoredUserRecord,
): boolean {
  const session = req.authSession!.session;
  const rem = getReauthRemainingSeconds(session.tokenHash, user.id);
  if (rem > 0) return true;

  const inlinePassword =
    typeof (req.body as { currentPassword?: unknown })?.currentPassword === 'string'
      ? String((req.body as { currentPassword?: string }).currentPassword)
      : '';
  if (inlinePassword) {
    if (verifyPassword(inlinePassword, user.passwordHash)) {
      passwordReauthWindows.set(session.tokenHash, {
        userId: user.id,
        expiresAt: Date.now() + REAUTH_WINDOW_MS,
      });
      return true;
    }
    appendSecurityLog(db.securityLogs, {
      eventType: 'PASSWORD_REAUTH_FAIL',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: 'Failed inline password re-authentication for Passkey action',
    });
    res.status(403).json({
      error: 'Incorrect password. Recent password confirmation is required.',
      code: 'PASSWORD_REAUTH_REQUIRED',
    });
    return false;
  }

  res.status(403).json({
    error: 'Recent password confirmation is required before adding or revoking a Passkey.',
    code: 'PASSWORD_REAUTH_REQUIRED',
  });
  return false;
}

export function registerPasskeyRoutes({
  app,
  getDb,
  saveDb,
  requireAuth,
  createSessionForUser,
  toSafeUser,
}: PasskeyRouteDeps) {
  // 1. Recent Password Re-Authentication Endpoint (Parent only, CSRF-enforced)
  app.post('/api/auth/reauthenticate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = assertActiveParentSession(req, res, db);
    if (!user) {
      saveDb(db);
      return;
    }
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`reauth:${user.id}:${ip}`, 12, 10 * 60_000))) {
      return res.status(429).json({ error: 'Too many password confirmation attempts. Please wait a few minutes.' });
    }

    const { password } = (req.body || {}) as { password?: string };
    if (typeof password !== 'string' || !password || password.length > 128) {
      return res.status(400).json({ error: 'Current password is required.' });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'PASSWORD_REAUTH_FAIL',
        actorId: user.id,
        role: user.role,
        ip,
        summary: 'Failed password re-authentication for sensitive security settings',
      });
      saveDb(db);
      return res.status(403).json({ error: 'Incorrect password.' });
    }

    const session = req.authSession!.session;
    passwordReauthWindows.set(session.tokenHash, {
      userId: user.id,
      expiresAt: Date.now() + REAUTH_WINDOW_MS,
    });

    appendSecurityLog(db.securityLogs, {
      eventType: 'PASSWORD_REAUTH_SUCCESS',
      actorId: user.id,
      role: user.role,
      ip,
      summary: 'Parent re-authenticated with password for Passkey management',
    });
    saveDb(db);

    res.json({
      reauthenticated: true,
      expiresInSeconds: Math.floor(REAUTH_WINDOW_MS / 1000),
    });
  });

  // 2. List Registered Passkeys for Active Parent
  app.get('/api/auth/passkeys', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = assertActiveParentSession(req, res, db);
    if (!user) {
      saveDb(db);
      return;
    }

    try {
      const creds = await listCredentialsForUser(user.id);
      const reauthRemainingSeconds = getReauthRemainingSeconds(req.authSession!.session.tokenHash, user.id);
      res.json({
        supported: true,
        passkeys: creds.map(toSafePasskeySummary),
        reauthenticated: reauthRemainingSeconds > 0,
        reauthRemainingSeconds,
      });
    } catch (err) {
      console.error('Failed to load parent passkeys:', (err as Error)?.message || err);
      res.status(503).json({
        error: 'Database unavailable. Failing closed for data safety.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  // 3. Passkey Registration Options (Active Parent + Recent Password Re-auth)
  app.post('/api/auth/passkeys/register/options', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = assertActiveParentSession(req, res, db);
    if (!user) {
      saveDb(db);
      return;
    }

    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`pk-reg-opt:${user.id}:${ip}`, 20, 10 * 60_000))) {
      return res.status(429).json({ error: 'Too many Passkey registration attempts. Please try again shortly.' });
    }

    if (!ensureRecentPasswordReauth(req, res, db, user)) {
      saveDb(db);
      return;
    }

    const ctx = resolveWebAuthnContext(req);
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    try {
      const existing = await listCredentialsForUser(user.id);
      const activeCreds = existing.filter((c) => !c.revokedAt);
      const challengeBytes = crypto.randomBytes(32);

      const options = await generateRegistrationOptions({
        rpName: ctx.rpName,
        rpID: ctx.rpId,
        userName: user.normalizedEmail,
        userID: new TextEncoder().encode(user.id),
        userDisplayName: user.displayName,
        challenge: new Uint8Array(challengeBytes),
        timeout: 60_000,
        attestationType: 'none',
        excludeCredentials: activeCreds.map((c) => ({
          id: c.credentialId,
          transports: c.transports as AuthenticatorTransport[],
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'required',
        },
      });

      const nowIso = new Date().toISOString();
      await saveChallenge({
        id: `wch_${crypto.randomBytes(8).toString('hex')}`,
        challenge: options.challenge,
        purpose: 'registration',
        userId: user.id,
        expectedOrigin: ctx.expectedOrigin,
        expectedRpId: ctx.rpId,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
        usedAt: null,
        createdAt: nowIso,
      });

      res.json({ options });
    } catch (err) {
      console.error('Passkey registration options failed:', (err as Error)?.message || err);
      res.status(503).json({
        error: 'Unable to prepare Passkey registration challenge right now.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  // 4. Passkey Registration Verification & Storage
  app.post('/api/auth/passkeys/register/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = assertActiveParentSession(req, res, db);
    if (!user) {
      saveDb(db);
      return;
    }

    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`pk-reg-ver:${user.id}:${ip}`, 20, 10 * 60_000))) {
      return res.status(429).json({ error: 'Too many Passkey verification requests.' });
    }

    if (!ensureRecentPasswordReauth(req, res, db, user)) {
      saveDb(db);
      return;
    }

    const ctx = resolveWebAuthnContext(req);
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const body = (req.body || {}) as {
      response?: RegistrationResponseJSON;
      label?: string;
    };

    if (!body.response || typeof body.response !== 'object') {
      return res.status(400).json({ error: 'WebAuthn registration response is required.' });
    }

    const decodedChallenge = decodeChallengeFromClientData(body.response?.response?.clientDataJSON);
    if (!decodedChallenge) {
      return res.status(400).json({ error: 'Malformed Passkey clientDataJSON challenge.' });
    }

    try {
      const challengeRow = await consumeChallengeAtomically(decodedChallenge, 'registration', user.id);
      if (!challengeRow) {
        return res.status(400).json({ error: 'Passkey registration challenge is invalid, expired, or already used.' });
      }

      if (
        !ctx.allowedOrigins.includes(challengeRow.expectedOrigin) ||
        challengeRow.expectedOrigin !== ctx.expectedOrigin ||
        challengeRow.expectedRpId !== ctx.rpId
      ) {
        return res.status(403).json({ error: 'Passkey origin or RP ID mismatch.' });
      }

      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: challengeRow.expectedOrigin,
        expectedRPID: challengeRow.expectedRpId,
        requireUserPresence: true,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Passkey registration verification failed.' });
      }

      const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;
      const existingDup = await findCredentialByCredentialId(credential.id);
      if (existingDup) {
        return res.status(409).json({ error: 'This Passkey credential is already registered.' });
      }

      const cleanLabel =
        sanitizeShortText(body.label, 60) ||
        (credentialDeviceType === 'multiDevice' ? 'Synced Passkey' : 'Device Passkey');
      const nowIso = new Date().toISOString();

      const saved: StoredPasskeyCredential = {
        id: `pk_${crypto.randomBytes(8).toString('hex')}`,
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: Number(credential.counter ?? 0),
        transports: Array.isArray(credential.transports)
          ? credential.transports.map((t) => sanitizeShortText(t, 32)).filter(Boolean)
          : [],
        deviceType: credentialDeviceType === 'singleDevice' ? 'singleDevice' : 'multiDevice',
        backedUp: Boolean(credentialBackedUp),
        aaguid: sanitizeShortText(aaguid || '', 64),
        label: cleanLabel,
        createdAt: nowIso,
        lastUsedAt: null,
        revokedAt: null,
      };

      await saveNewCredential(saved);

      const family = ensureFamilyForUser(db, user);
      recordFamilyEvent(db, {
        familyId: family.id,
        category: 'auth',
        actionType: 'PASSKEY_REGISTERED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        metadata: { passkeyId: saved.id },
        title: { ar: 'إضافة مفتاح مرور (Passkey)', en: 'Passkey registered' },
        description: {
          ar: `أضاف ${user.displayName} مفتاح مرور جديد (${saved.label})`,
          en: `${user.displayName} registered a new Passkey (${saved.label})`,
        },
        ip,
        securityEventType: 'PASSKEY_REGISTERED',
      });
      saveDb(db);

      return res.status(201).json({ passkey: toSafePasskeySummary(saved) });
    } catch (err) {
      const msg = (err as Error)?.message || 'Passkey verification failed';
      if (/postgres|database|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|SSL/i.test(msg)) {
        return res.status(503).json({
          error: 'Database unavailable. Failing closed for data safety.',
          code: 'DB_UNAVAILABLE',
        });
      }
      return res.status(400).json({ error: 'Passkey registration could not be verified.' });
    }
  });

  // 5. Passkey Authentication Options (Public, CSRF-exempt, Anti-enumeration)
  app.post('/api/auth/passkeys/login/options', async (req, res) => {
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`pk-login-opt:${ip}`, 30, 10 * 60_000))) {
      return res.status(429).json({ error: 'Too many Passkey sign-in requests. Please wait a few minutes.' });
    }

    const ctx = resolveWebAuthnContext(req);
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const db = getDb();
    const body = (req.body || {}) as { email?: string };
    let scopedParent: StoredUserRecord | undefined;
    let allowCredentials: Array<{ id: string; transports?: AuthenticatorTransport[] }> = [];

    if (typeof body.email === 'string' && body.email.trim()) {
      const emailCheck = validateEmail(body.email);
      if (emailCheck.ok) {
        const uid = db.emailIndex[emailCheck.normalized];
        const candidate = uid ? db.users[uid] : undefined;
        if (candidate && candidate.role === 'parent' && candidate.status === 'active') {
          scopedParent = candidate;
        }
      }
    }

    try {
      if (scopedParent) {
        const creds = await listCredentialsForUser(scopedParent.id);
        allowCredentials = creds
          .filter((c) => !c.revokedAt)
          .map((c) => ({
            id: c.credentialId,
            transports: c.transports as AuthenticatorTransport[],
          }));
      }

      const challengeBytes = crypto.randomBytes(32);
      const options = await generateAuthenticationOptions({
        rpID: ctx.rpId,
        challenge: new Uint8Array(challengeBytes),
        timeout: 60_000,
        userVerification: 'required',
        ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
      });

      await saveChallenge({
        id: `wch_${crypto.randomBytes(8).toString('hex')}`,
        challenge: options.challenge,
        purpose: 'authentication',
        userId: scopedParent?.id ?? null,
        expectedOrigin: ctx.expectedOrigin,
        expectedRpId: ctx.rpId,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
        usedAt: null,
        createdAt: new Date().toISOString(),
      });

      res.json({ options });
    } catch (err) {
      console.error('Passkey authentication options error:', (err as Error)?.message || err);
      res.status(503).json({
        error: 'Database unavailable. Failing closed for data safety.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  // 6. Passkey Authentication Verification & Session Issue (Public, CSRF-exempt)
  app.post('/api/auth/passkeys/login/verify', async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`pk-login-ip:${ip}`, 40, 15 * 60_000))) {
      return res.status(429).json({ error: 'Too many login requests. Please wait a few minutes.' });
    }

    const ctx = resolveWebAuthnContext(req);
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const body = (req.body || {}) as {
      response?: AuthenticationResponseJSON;
      rememberMe?: boolean;
    };

    if (!body.response || typeof body.response !== 'object' || typeof body.response.id !== 'string') {
      return res.status(400).json({ error: 'Passkey assertion response is required.' });
    }

    const credId = body.response.id;
    if (!(await checkRateLimitPg(`pk-login-cred:${hashToken(credId)}`, 20, 5 * 60_000))) {
      return res.status(429).json({ error: 'Too many Passkey attempts. Please try again later.' });
    }

    const decodedChallenge = decodeChallengeFromClientData(body.response?.response?.clientDataJSON);
    if (!decodedChallenge) {
      return res.status(401).json({ error: 'Passkey verification failed.' });
    }

    try {
      const challengeRow = await consumeChallengeAtomically(decodedChallenge, 'authentication', null);
      if (!challengeRow) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          ip,
          reason: 'INVALID_OR_REPLAYED_CHALLENGE',
          outcome: 'denied',
          summary: 'Rejected Passkey login with invalid, expired, or reused challenge',
        });
        saveDb(db);
        return res.status(401).json({ error: 'Passkey verification failed.' });
      }

      if (
        !ctx.allowedOrigins.includes(challengeRow.expectedOrigin) ||
        challengeRow.expectedOrigin !== ctx.expectedOrigin ||
        challengeRow.expectedRpId !== ctx.rpId
      ) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          ip,
          reason: 'ORIGIN_OR_RPID_MISMATCH',
          outcome: 'denied',
          summary: 'Rejected Passkey login due to origin or RP ID mismatch',
        });
        saveDb(db);
        return res.status(403).json({ error: 'Passkey origin or RP ID mismatch.' });
      }

      const credential = await findCredentialByCredentialId(credId);
      if (!credential || credential.revokedAt) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          ip,
          reason: credential?.revokedAt ? 'CREDENTIAL_REVOKED' : 'UNKNOWN_CREDENTIAL',
          outcome: 'denied',
          summary: 'Rejected Passkey login for unknown or revoked credential',
        });
        saveDb(db);
        return res.status(401).json({ error: 'Passkey verification failed.' });
      }

      if (challengeRow.userId && challengeRow.userId !== credential.userId) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          actorId: credential.userId,
          ip,
          reason: 'CHALLENGE_USER_MISMATCH',
          outcome: 'denied',
          summary: 'Rejected Passkey login because credential user did not match scoped challenge',
        });
        saveDb(db);
        return res.status(401).json({ error: 'Passkey verification failed.' });
      }

      const user = db.users[credential.userId];
      if (!user || user.role !== 'parent' || user.status !== 'active') {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          actorId: credential.userId,
          role: user?.role,
          ip,
          reason: 'ROLE_OR_STATUS_NOT_ELIGIBLE',
          outcome: 'denied',
          summary: 'Blocked Passkey login for non-parent or inactive account',
        });
        saveDb(db);
        return res.status(401).json({ error: 'Passkey verification failed.' });
      }

      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        return res.status(429).json({
          error: 'Account temporarily locked. Please wait a few minutes and try again.',
          locked: true,
        });
      }

      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: challengeRow.expectedOrigin,
        expectedRPID: challengeRow.expectedRpId,
        requireUserVerification: true,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
          counter: credential.counter,
          transports: credential.transports as AuthenticatorTransport[],
        },
      });

      if (!verification.verified) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          actorId: user.id,
          role: user.role,
          ip,
          reason: 'SIGNATURE_INVALID',
          outcome: 'denied',
          summary: 'Passkey signature verification returned false',
        });
        saveDb(db);
        return res.status(401).json({ error: 'Passkey verification failed.' });
      }

      const newCounter = Number(verification.authenticationInfo.newCounter ?? 0);
      // Synced passkeys keep counter at 0 (0 -> 0 allowed). Any positive stored counter must advance.
      if (credential.counter > 0 && newCounter <= credential.counter) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'PASSKEY_LOGIN_FAIL',
          actorId: user.id,
          role: user.role,
          ip,
          reason: 'COUNTER_REPLAY_DETECTED',
          outcome: 'denied',
          summary: 'Blocked potential cloned authenticator due to non-advancing counter',
        });
        saveDb(db);
        return res.status(401).json({ error: 'Passkey verification failed.' });
      }

      const nowIso = new Date().toISOString();
      await updateCredentialUsage(credential.id, newCounter, nowIso);

      // Success: reset failure counters, ensure family, rotate session cookie
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      user.updatedAt = nowIso;
      const family = ensureFamilyForUser(db, user);

      const oldCookies = parseCookies(req.headers.cookie);
      if (oldCookies[SESSION_COOKIE_NAME]) {
        const oldHash = hashToken(oldCookies[SESSION_COOKIE_NAME]);
        delete db.sessions[oldHash];
        clearPasswordReauth(oldHash);
      }

      const csrfToken = createSessionForUser(user, req, res, {
        rememberMe: Boolean(body.rememberMe),
        sessionKind: 'parent',
        familyId: family.id,
      });

      recordFamilyEvent(db, {
        familyId: family.id,
        category: 'auth',
        actionType: 'PASSKEY_LOGIN_SUCCESS',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        metadata: { passkeyId: credential.id },
        title: { ar: 'تسجيل الدخول بمفتاح المرور', en: 'Signed in with Passkey' },
        description: {
          ar: `سجّل ${user.displayName} الدخول باستخدام مفتاح المرور (${credential.label})`,
          en: `${user.displayName} signed in using Passkey (${credential.label})`,
        },
        ip,
        securityEventType: 'PASSKEY_LOGIN_SUCCESS',
      });
      saveDb(db);

      return res.json({
        user: toSafeUser(user),
        dashboardRoute: getDashboardRouteForRole(user.role),
        csrfToken,
      });
    } catch (err) {
      const msg = String((err as Error)?.message || '');
      if (/postgres|database|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|SSL/i.test(msg)) {
        return res.status(503).json({
          error: 'Database unavailable. Failing closed for data safety.',
          code: 'DB_UNAVAILABLE',
        });
      }
      appendSecurityLog(db.securityLogs, {
        eventType: 'PASSKEY_LOGIN_FAIL',
        ip,
        reason: /counter/i.test(msg) ? 'COUNTER_REPLAY_DETECTED' : 'VERIFICATION_ERROR',
        outcome: 'denied',
        summary: 'Passkey login rejected during cryptographic verification',
      });
      saveDb(db);
      return res.status(401).json({ error: 'Passkey verification failed.' });
    }
  });

  // 7. Revoke Registered Passkey (Active Parent + Recent Password Re-auth + Ownership)
  app.post('/api/auth/passkeys/:id/revoke', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = assertActiveParentSession(req, res, db);
    if (!user) {
      saveDb(db);
      return;
    }

    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`pk-revoke:${user.id}:${ip}`, 20, 10 * 60_000))) {
      return res.status(429).json({ error: 'Too many requests.' });
    }

    if (!ensureRecentPasswordReauth(req, res, db, user)) {
      saveDb(db);
      return;
    }

    const passkeyId = sanitizeShortText(req.params.id, 64);
    if (!passkeyId) {
      return res.status(400).json({ error: 'Invalid Passkey ID.' });
    }

    try {
      const existing = await findCredentialById(passkeyId);
      if (!existing) {
        return res.status(404).json({ error: 'Passkey not found.' });
      }
      if (existing.userId !== user.id) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'ACCESS_DENIED',
          actorId: user.id,
          role: user.role,
          ip,
          summary: `Blocked IDOR Passkey revocation attempt for ${passkeyId}`,
        });
        saveDb(db);
        return res.status(403).json({ error: 'Forbidden: you do not own this Passkey.' });
      }
      if (existing.revokedAt) {
        return res.status(409).json({ error: 'Passkey has already been revoked.' });
      }

      const nowIso = new Date().toISOString();
      const updated = await revokeCredentialById(passkeyId, user.id, nowIso);
      if (!updated) {
        return res.status(409).json({ error: 'Passkey has already been revoked.' });
      }

      const family = ensureFamilyForUser(db, user);
      recordFamilyEvent(db, {
        familyId: family.id,
        category: 'auth',
        actionType: 'PASSKEY_REVOKED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        metadata: { passkeyId: updated.id },
        title: { ar: 'إلغاء مفتاح مرور (Passkey)', en: 'Passkey revoked' },
        description: {
          ar: `ألغى ${user.displayName} مفتاح المرور (${updated.label})`,
          en: `${user.displayName} revoked Passkey (${updated.label})`,
        },
        ip,
        securityEventType: 'PASSKEY_REVOKED',
      });
      saveDb(db);

      return res.json({ revoked: true, passkey: toSafePasskeySummary(updated) });
    } catch (err) {
      console.error('Passkey revoke failed:', (err as Error)?.message || err);
      return res.status(503).json({
        error: 'Database unavailable. Failing closed for data safety.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });
}

export function clearSessionReauthOnPasswordChange(userId: string) {
  clearPasswordReauthForUser(userId);
}

export function normalizePasskeyEmail(email: string): string {
  return normalizeEmail(email);
}
