import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AccountStatus, SecurityEventLog, TeacherPermission, TeacherProfile, UserRole } from '../src/types/nonoland';
import { DEFAULT_TEACHER_PERMISSIONS } from '../src/utils/validation';
import { getSecret } from './secretProvider';

export { DEFAULT_TEACHER_PERMISSIONS };

export interface StoredUserRecord {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  status: AccountStatus;
  phone?: string;
  bio?: string;
  linkedChildId?: string;
  familyId?: string;
  teacherProfile?: TeacherProfile;
  policyVersion: string;
  termsAcceptedAt: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSessionRecord {
  tokenHash: string;
  userId: string;
  csrfToken: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  sessionKind?: 'parent' | 'child' | 'staff';
  childId?: string;
  familyId?: string;
  deviceId?: string;
  rememberMe?: boolean;
  parentGateVerifiedUntil?: number;
}

export interface StoredActionToken {
  tokenHash: string;
  userId: string;
  type: 'email-verify' | 'password-reset';
  expiresAt: number;
  used: boolean;
}

export const SESSION_COOKIE_NAME = 'nono_session';
export const DEVICE_COOKIE_NAME = 'nono_device';
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000; // 24h idle timeout
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7d absolute max
export const SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30d remember-me max
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 5 * 60 * 1000; // 5-min temporary lockout (never permanent)

// Strong scrypt password hashing (random 16-byte salt, constant-time verify)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexDigest] = parts;
  if (!salt || !hexDigest) return false;
  const expected = Buffer.from(hexDigest, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// In-memory sliding window rate limiter by key
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = rateBuckets.get(key) || [];
  const fresh = prev.filter((ts) => now - ts < windowMs);
  if (fresh.length >= maxRequests) {
    rateBuckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  rateBuckets.set(key, fresh);
  return true;
}

export function clearRateLimit(key: string): void {
  rateBuckets.delete(key);
}

export const ADMIN_ROLE_SET = new Set<UserRole>([
  'super_admin',
  'admin',
  'content_admin',
  'curriculum_manager',
  'finance_admin',
  'support_agent',
]);

export function isAdminRole(role?: UserRole): boolean {
  return Boolean(role && ADMIN_ROLE_SET.has(role));
}

export function verifySecretTimingSafe(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const h1 = crypto.createHash('sha256').update(provided).digest();
  const h2 = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(h1, h2);
}

export const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  parent: new Set(['own_family']),
  child: new Set(['own_child_learning']),
  student: new Set(['own_student_exams']),
  teacher: new Set(['teacher_portal']),
  support_agent: new Set(['view_support']),
  content_admin: new Set(['manage_lessons', 'manage_questions']),
  curriculum_manager: new Set(['manage_lessons', 'manage_questions', 'manage_exam_config']),
  finance_admin: new Set(['manage_exam_config', 'view_payments']),
  admin: new Set([
    'manage_lessons',
    'manage_questions',
    'manage_exam_config',
    'manage_certificates',
    'manage_teachers',
    'manage_classes',
    'manage_parents',
    'view_security_logs',
    'view_payments',
    'view_support',
  ]),
  super_admin: new Set([
    'manage_lessons',
    'manage_questions',
    'manage_exam_config',
    'manage_certificates',
    'manage_teachers',
    'manage_classes',
    'manage_parents',
    'manage_admins',
    'view_security_logs',
    'view_payments',
    'view_support',
  ]),
};

export function hasPermission(role: UserRole | undefined, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function hasTeacherPermission(
  user: StoredUserRecord | undefined,
  permission: TeacherPermission,
): boolean {
  if (!user || user.role !== 'teacher' || user.status !== 'active') return false;
  const perms = user.teacherProfile?.permissions ?? DEFAULT_TEACHER_PERMISSIONS;
  return perms.includes(permission);
}

export function getDashboardRouteForRole(role: UserRole): string {
  switch (role) {
    case 'teacher':
      return '/teacher-dashboard';
    case 'child':
      return '/home';
    case 'student':
      return '/exams';
    case 'super_admin':
    case 'admin':
    case 'content_admin':
    case 'curriculum_manager':
    case 'finance_admin':
    case 'support_agent':
      return '/admin-dashboard';
    default:
      return '/parent-dashboard';
  }
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api') || req.originalUrl.startsWith('/api')) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src 'self' https:; img-src 'self' data: https: blob:; media-src 'self' https: data: blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self';",
    );
  }
  res.removeHeader('X-Powered-By');
  next();
}

export function appendSecurityLog(
  logs: SecurityEventLog[],
  entry: Omit<SecurityEventLog, 'id' | 'createdAt'>,
) {
  const safeSummary = String(entry.summary || '')
    .replace(/(password|token|secret|csrf|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 300);
  logs.unshift({
    ...entry,
    summary: safeSummary,
    id: `sec_${crypto.randomBytes(5).toString('hex')}`,
    createdAt: new Date().toISOString(),
  });
  if (logs.length > 1000) {
    logs.length = 1000;
  }
}

export function isHttpsRequest(req?: Request, isProd = false): boolean {
  if (isProd) return true;
  if (!req) return false;
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === 'https') return true;
  const origin = String(req.headers.origin || req.headers.referer || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  return false;
}

function buildCookieAttributes(
  name: string,
  encodedValue: string,
  secure: boolean,
  maxAgeSeconds: number,
): string {
  const parts = [
    `${name}=${encodedValue}`,
    'Path=/',
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) {
    parts.push('Secure', 'Partitioned');
  }
  return parts.join('; ');
}

export function setSessionCookie(
  res: Response,
  rawToken: string,
  reqOrSecure: Request | boolean,
  maxAgeMs = SESSION_ABSOLUTE_MS,
  isProd = false,
) {
  const secure = typeof reqOrSecure === 'boolean' ? reqOrSecure : isHttpsRequest(reqOrSecure, isProd);
  res.append(
    'Set-Cookie',
    buildCookieAttributes(SESSION_COOKIE_NAME, encodeURIComponent(rawToken), secure, Math.floor(maxAgeMs / 1000)),
  );
}

export function clearSessionCookie(res: Response, reqOrSecure: Request | boolean = false, isProd = false) {
  const secure = typeof reqOrSecure === 'boolean' ? reqOrSecure : isHttpsRequest(reqOrSecure, isProd);
  res.append('Set-Cookie', buildCookieAttributes(SESSION_COOKIE_NAME, '', secure, 0));
}

export function setDeviceCookie(
  res: Response,
  rawToken: string,
  reqOrSecure: Request | boolean,
  isProd = false,
) {
  const secure = typeof reqOrSecure === 'boolean' ? reqOrSecure : isHttpsRequest(reqOrSecure, isProd);
  res.append(
    'Set-Cookie',
    buildCookieAttributes(DEVICE_COOKIE_NAME, encodeURIComponent(rawToken), secure, 365 * 24 * 60 * 60),
  );
}

export function clearDeviceCookie(res: Response, reqOrSecure: Request | boolean = false, isProd = false) {
  const secure = typeof reqOrSecure === 'boolean' ? reqOrSecure : isHttpsRequest(reqOrSecure, isProd);
  res.append('Set-Cookie', buildCookieAttributes(DEVICE_COOKIE_NAME, '', secure, 0));
}

let ephemeralDevFieldKey: Buffer | null = null;

export function getSessionSecret(): string | undefined {
  return getSecret('NONOLAND_SESSION_SECRET') || getSecret('SESSION_SECRET');
}

function getFieldCipherKey(): Buffer {
  const secretSeed = getSessionSecret();
  if (!secretSeed) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NONOLAND_SESSION_SECRET (or legacy SESSION_SECRET) is required in production mode to encrypt sensitive fields.',
      );
    }
    if (!ephemeralDevFieldKey) {
      ephemeralDevFieldKey = crypto.randomBytes(32);
    }
    return ephemeralDevFieldKey;
  }
  return crypto.createHash('sha256').update(secretSeed).digest();
}

export function encryptSensitiveField(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getFieldCipherKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`;
}

export function decryptSensitiveField(packed: string): string | null {
  try {
    const [ivHex, tagHex, encHex] = packed.split('.');
    if (!ivHex || !tagHex || !encHex) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getFieldCipherKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateChildAccessCode(): string {
  const bytes = crypto.randomBytes(8);
  let chars = '';
  for (let i = 0; i < 8; i += 1) {
    chars += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `NL-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function normalizeChildAccessCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

export function parseDeviceMetadata(userAgent: string): {
  deviceName: string;
  deviceType: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  browser: string;
  os: string;
} {
  const ua = String(userAgent || '');
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = /iPad/i.test(ua) ? 'iPadOS' : 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/node|undici|fetch/i.test(ua)) browser = 'API Client';

  let deviceType: 'desktop' | 'tablet' | 'mobile' | 'unknown' = 'desktop';
  if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet';
  else if (/Mobile|iPhone|Android/i.test(ua)) deviceType = 'mobile';
  else if (!ua) deviceType = 'unknown';

  return {
    deviceName: `${browser} on ${os}`,
    deviceType,
    browser,
    os,
  };
}

