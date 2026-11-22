import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import ExcelJS from 'exceljs';
import multer from 'multer';
import {
  ALL_CURRICULUM_LESSONS_INDEX,
  getLevel2LessonById,
} from '../src/data/level2Curriculum';
import { getQuestionsForLevel2Lesson, LEVEL2_QUESTION_BANK } from '../src/data/level2QuestionBank';
import type {
  AccountStatus,
  AgeGroupId,
  AssignedExamAttempt,
  AssignedExamReviewItem,
  Classroom,
  ExamAssignment,
  ExamStatus,
  Level2LessonProgress,
  Level2ProgressionConfig,
  TeacherExam,
  TeacherPermission,
  TeacherQuestion,
  TeacherQuestionDifficulty,
  TeacherQuestionOption,
  TeacherQuestionType,
  TeacherSubject,
} from '../src/types/nonoland';
import {
  ALLOWED_TEACHER_SUBJECTS,
  checkQuestionQuality,
  isValidSafeId,
  normalizeEmail,
  POLICY_VERSION,
  sanitizeLongText,
  sanitizeShortText,
  validateEmail,
  validateExamScheduleAndConfig,
  validateParentName,
  validatePassword,
  validateTeacherQuestionInput,
} from '../src/utils/validation';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import { recordAuditEvent } from './auditLog';
import {
  appendSecurityLog,
  DEFAULT_TEACHER_PERMISSIONS,
  getClientIp,
  hashPassword,
  hasTeacherPermission,
  StoredUserRecord,
  verifyPassword,
} from './security';
import { checkRateLimitPg, getDbStorageInfo, runWithPgDbLock } from './pgStore';

export interface TeacherRoutesDeps {
  app: express.Application;
  getDb: () => ServerDb;
  saveDb: (db: ServerDb) => void;
  requireAuth: express.RequestHandler;
  requireAdminPermission: (permission: string) => express.RequestHandler;
  assertChildAccess: (
    req: AuthenticatedRequest,
    res: express.Response,
    childId: string,
  ) => StoredChildRecord | null | 'untracked-sample';
  createSessionForUser: (user: StoredUserRecord, req: express.Request, res: express.Response) => string;
  revokeAllUserSessions: (userId: string) => void;
  toSafeUser: (user: StoredUserRecord) => Record<string, unknown>;
}

const UPLOAD_STORAGE_DIR = path.join(process.cwd(), 'server_uploads');
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

const TEMPLATE_HEADERS = [
  'subject',
  'level',
  'lessonId',
  'questionType',
  'promptAr',
  'promptEn',
  'optionA_ar',
  'optionA_en',
  'optionB_ar',
  'optionB_en',
  'optionC_ar',
  'optionC_en',
  'optionD_ar',
  'optionD_en',
  'correctOption',
  'acceptedAnswers',
  'matchingPairs',
  'correctOrder',
  'marks',
  'difficulty',
  'explanationAr',
  'explanationEn',
  'audioText',
];

function buildValidLessonRegistry(db: ServerDb): {
  validIds: Set<string>;
  levelSubjectMap: Map<string, { level: 1 | 2; subject: string }>;
} {
  const validIds = new Set<string>();
  const levelSubjectMap = new Map<string, { level: 1 | 2; subject: string }>();

  for (const l of ALL_CURRICULUM_LESSONS_INDEX) {
    validIds.add(l.id);
    levelSubjectMap.set(l.id, { level: l.level, subject: l.subject });
  }
  for (const c of db.customLessons) {
    validIds.add(c.id);
    levelSubjectMap.set(c.id, { level: c.level === 2 ? 2 : 1, subject: c.subject || c.domain });
  }
  return { validIds, levelSubjectMap };
}

function getTeacherAssignedStudentIds(db: ServerDb, teacherId: string): Set<string> {
  const ids = new Set<string>();
  for (const cls of Object.values(db.classes)) {
    if (cls.teacherId === teacherId && cls.active) {
      for (const sid of cls.studentIds) {
        ids.add(sid);
      }
    }
  }
  return ids;
}

function normalizeAnswerForMatch(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // strip Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function resolveAuthorizedStudentChildIds(
  req: AuthenticatedRequest,
  db: ServerDb,
  requestedChildId?: string,
): { ok: true; childIds: string[] } | { ok: false; status: number; error: string } {
  const user = req.authSession?.user;
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  if (user.role === 'student' || user.role === 'child') {
    if (!user.linkedChildId || !db.children[user.linkedChildId]) {
      return { ok: false, status: 403, error: 'No child profile linked to this student account' };
    }
    if (requestedChildId && requestedChildId !== user.linkedChildId) {
      return { ok: false, status: 403, error: 'Forbidden: students can only access their own exams' };
    }
    return { ok: true, childIds: [user.linkedChildId] };
  }

  if (user.role === 'parent') {
    const owned = Object.values(db.children)
      .filter((c) => c.parentId === user.id)
      .map((c) => c.id);
    if (requestedChildId) {
      if (!owned.includes(requestedChildId)) {
        return { ok: false, status: 403, error: 'Forbidden: you do not own this child profile' };
      }
      return { ok: true, childIds: [requestedChildId] };
    }
    return { ok: true, childIds: owned };
  }

  if (user.role === 'super_admin') {
    if (requestedChildId && db.children[requestedChildId]) {
      return { ok: true, childIds: [requestedChildId] };
    }
    return { ok: true, childIds: Object.keys(db.children) };
  }

  return { ok: false, status: 403, error: 'Forbidden for this account role' };
}

function parseCsvMatrix(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r') {
        if (clean[i + 1] === '\n') i++;
        row.push(field.trim());
        if (row.some((cell) => cell.length > 0)) rows.push(row);
        row = [];
        field = '';
      } else if (ch === '\n') {
        row.push(field.trim());
        if (row.some((cell) => cell.length > 0)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function hasDisallowedBinaryHeader(buf: Buffer): boolean {
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return true; // PE / EXE ('MZ')
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true; // ELF
  if (buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21) return true; // '#!' script
  return false;
}

function buildSanitizedQuestionDraft(
  raw: Record<string, unknown>,
  validIds: Set<string>,
  levelSubjectMap: Map<string, { level: 1 | 2; subject: string }>,
): {
  ok: true;
  draft: Omit<TeacherQuestion, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'version'>;
} | { ok: false; error: string } {
  const optsRaw = Array.isArray(raw.options) ? raw.options : [];
  const options: TeacherQuestionOption[] = optsRaw.map((o: Record<string, unknown>) => ({
    id: sanitizeShortText(o?.id, 32),
    textAr: sanitizeShortText(o?.textAr, 200),
    textEn: sanitizeShortText(o?.textEn, 200),
    visual: sanitizeShortText(o?.visual, 64) || undefined,
    colorHex:
      typeof o?.colorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(o.colorHex)
        ? o.colorHex
        : undefined,
  }));

  const matchingPairs = Array.isArray(raw.matchingPairs)
    ? (raw.matchingPairs as Array<Record<string, unknown>>).map((p, idx) => ({
        id: sanitizeShortText(p?.id || `pair-${idx + 1}`, 32),
        left: sanitizeShortText(p?.left, 120),
        right: sanitizeShortText(p?.right, 120),
      }))
    : undefined;

  const correctOrder = Array.isArray(raw.correctOrder)
    ? raw.correctOrder.map((x) => sanitizeShortText(x, 120)).filter(Boolean)
    : undefined;

  const acceptedAnswers = Array.isArray(raw.acceptedAnswers)
    ? raw.acceptedAnswers.map((x) => sanitizeShortText(x, 120)).filter(Boolean)
    : undefined;

  const candidate = {
    subject: sanitizeShortText(raw.subject, 40) as TeacherSubject,
    level: Number(raw.level) === 2 ? (2 as const) : (1 as const),
    lessonId: sanitizeShortText(raw.lessonId, 48),
    questionType: sanitizeShortText(raw.questionType, 40) as TeacherQuestionType,
    promptAr: sanitizeLongText(raw.promptAr, 600),
    promptEn: sanitizeLongText(raw.promptEn, 600),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : undefined,
    audioUrl: typeof raw.audioUrl === 'string' ? raw.audioUrl.trim() : undefined,
    audioText: sanitizeShortText(raw.audioText, 300) || undefined,
    options,
    correctOptionId: typeof raw.correctOptionId === 'string' ? raw.correctOptionId.trim() : undefined,
    correctOptionIds: Array.isArray(raw.correctOptionIds)
      ? raw.correctOptionIds.map((x) => sanitizeShortText(x, 32))
      : undefined,
    allowMultipleCorrect: Boolean(raw.allowMultipleCorrect),
    matchingPairs,
    correctOrder,
    acceptedAnswers,
    marks: Number(raw.marks),
    difficulty: sanitizeShortText(raw.difficulty || 'medium', 20) as TeacherQuestionDifficulty,
    explanation: {
      ar: sanitizeLongText((raw.explanation as Record<string, unknown>)?.ar ?? raw.explanationAr, 500),
      en: sanitizeLongText((raw.explanation as Record<string, unknown>)?.en ?? raw.explanationEn, 500),
    },
    feedbackCorrect: {
      ar: sanitizeShortText(
        (raw.feedbackCorrect as Record<string, unknown>)?.ar || 'أحسنت! إجابة صحيحة',
        200,
      ),
      en: sanitizeShortText(
        (raw.feedbackCorrect as Record<string, unknown>)?.en || 'Great job! Correct answer!',
        200,
      ),
    },
    feedbackIncorrect: {
      ar: sanitizeShortText(
        (raw.feedbackIncorrect as Record<string, unknown>)?.ar || 'راجع القاعدة وحاول مجدداً',
        200,
      ),
      en: sanitizeShortText(
        (raw.feedbackIncorrect as Record<string, unknown>)?.en || 'Review the lesson tip and try again.',
        200,
      ),
    },
    active: raw.active !== false,
  };

  const check = validateTeacherQuestionInput(candidate, validIds, levelSubjectMap);
  if (!check.ok) {
    return { ok: false, error: check.error || 'Invalid question' };
  }
  return { ok: true, draft: candidate };
}

function rowObjectToQuestionRaw(rowObj: Record<string, string>): Record<string, unknown> {
  const qType = (rowObj.questionType || 'multiple-choice').trim();
  const options: Array<Record<string, unknown>> = [];
  const letters = ['A', 'B', 'C', 'D'];
  for (const l of letters) {
    const ar = rowObj[`option${l}_ar`] || '';
    const en = rowObj[`option${l}_en`] || '';
    if (ar || en) {
      options.push({
        id: l.toLowerCase(),
        textAr: ar || en,
        textEn: en || ar,
      });
    }
  }

  let correctOptionId = (rowObj.correctOption || '').trim().toLowerCase();
  if (qType === 'true-false' && options.length === 0) {
    options.push(
      { id: 'a', textAr: 'صح', textEn: 'True' },
      { id: 'b', textAr: 'خطأ', textEn: 'False' },
    );
    if (correctOptionId === 'true' || correctOptionId === 't') correctOptionId = 'a';
    if (correctOptionId === 'false' || correctOptionId === 'f') correctOptionId = 'b';
  }

  const acceptedAnswers = (rowObj.acceptedAnswers || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const matchingPairs = (rowObj.matchingPairs || '')
    .split('|')
    .map((pair, idx) => {
      const [left, right] = pair.split('=>').map((s) => s?.trim() || '');
      return { id: `p${idx + 1}`, left, right };
    })
    .filter((p) => p.left || p.right);

  const correctOrder = (rowObj.correctOrder || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    subject: rowObj.subject,
    level: Number(rowObj.level || 1),
    lessonId: rowObj.lessonId,
    questionType: qType,
    promptAr: rowObj.promptAr,
    promptEn: rowObj.promptEn,
    audioText: rowObj.audioText || undefined,
    options,
    correctOptionId,
    acceptedAnswers,
    matchingPairs,
    correctOrder,
    marks: Number(rowObj.marks || 1),
    difficulty: rowObj.difficulty || 'medium',
    explanationAr: rowObj.explanationAr || '',
    explanationEn: rowObj.explanationEn || '',
  };
}

function sanitizeQuestionForStudent(
  q: TeacherQuestion,
  optionOrder?: string[],
): Record<string, unknown> {
  let orderedOptions = [...q.options];
  if (optionOrder && optionOrder.length > 0) {
    const map = new Map(orderedOptions.map((o) => [o.id, o]));
    const mapped = optionOrder.map((id) => map.get(id)).filter(Boolean) as TeacherQuestionOption[];
    if (mapped.length === orderedOptions.length) orderedOptions = mapped;
  }

  // Strip correct answers, acceptedAnswers, correctOrder, explanation, feedback
  const matchingLefts = q.matchingPairs?.map((p) => ({ id: p.id, left: p.left })) || [];
  const matchingRights = q.matchingPairs
    ? [...q.matchingPairs.map((p) => p.right)].sort(() => Math.random() - 0.5)
    : [];
  const shuffledOrderItems = q.correctOrder
    ? [...q.correctOrder].sort(() => Math.random() - 0.5)
    : [];

  return {
    id: q.id,
    subject: q.subject,
    level: q.level,
    lessonId: q.lessonId,
    questionType: q.questionType,
    promptAr: q.promptAr,
    promptEn: q.promptEn,
    imageUrl: q.imageUrl,
    audioUrl: q.audioUrl,
    audioText: q.audioText,
    options: orderedOptions,
    allowMultipleCorrect: Boolean(q.allowMultipleCorrect),
    matchingLefts,
    matchingRights,
    shuffledOrderItems,
    marks: q.marks,
    difficulty: q.difficulty,
  };
}

export function registerTeacherAndLevel2Routes(deps: TeacherRoutesDeps): void {
  const {
    app,
    getDb,
    saveDb,
    requireAuth,
    requireAdminPermission,
    assertChildAccess,
    createSessionForUser,
    revokeAllUserSessions,
    toSafeUser,
  } = deps;

  function requireTeacherPermission(permission?: TeacherPermission): express.RequestHandler {
    return (req: AuthenticatedRequest, res, next) => {
      if (!req.authSession) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const user = req.authSession.user;
      if (user.role !== 'teacher') {
        const db = getDb();
        appendSecurityLog(db.securityLogs, {
          eventType: 'ACCESS_DENIED',
          actorId: user.id,
          role: user.role,
          ip: getClientIp(req),
          summary: `Non-teacher role ${user.role} blocked from teacher endpoint`,
        });
        saveDb(db);
        return res.status(403).json({ error: 'Forbidden: Teacher role required' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({
          error:
            user.status === 'pending'
              ? 'Teacher account pending admin approval'
              : user.status === 'rejected'
                ? 'Teacher application was rejected by administrator'
                : 'Teacher account is suspended',
        });
      }
      if (permission && !hasTeacherPermission(user, permission)) {
        return res.status(403).json({ error: `Forbidden: missing teacher permission (${permission})` });
      }
      next();
    };
  }

  // =========================================================================
  // 1. AUTH EXTENSIONS: TEACHER REGISTRATION, PROFILE, PASSWORD, STUDENT ACCT
  // =========================================================================
  app.post('/api/auth/register-teacher', async (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const ip = getClientIp(req);
    if (!(await checkRateLimitPg(`reg-teacher:${ip}`, 15, 15 * 60_000))) {
      return res.status(429).json({ error: 'Too many registration requests. Try again later.' });
    }

    const body = req.body as {
      displayName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      subjects?: string[];
      bio?: string;
      role?: string;
      termsAccepted?: boolean;
      policyVersion?: string;
    };

    if (body.role !== undefined && body.role !== 'teacher') {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        ip,
        summary: `Blocked privilege escalation attempt on /api/auth/register-teacher with role=${String(body.role)}`,
      });
      saveDb(db);
      return res.status(403).json({ error: 'Privilege escalation is not permitted during registration.' });
    }

    const nameCheck = validateParentName(body.displayName || '');
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });

    const emailCheck = validateEmail(body.email || '');
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

    if (body.confirmPassword !== undefined && body.password !== body.confirmPassword) {
      return res.status(400).json({ error: 'Password and confirm password do not match' });
    }

    const pwCheck = validatePassword(body.password || '', emailCheck.normalized, nameCheck.clean);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });

    if (body.termsAccepted !== true) {
      return res.status(400).json({ error: 'You must accept the Platform Policies and Terms.' });
    }

    if (db.emailIndex[emailCheck.normalized]) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const subjects = Array.isArray(body.subjects)
      ? body.subjects
          .filter((s) => ALLOWED_TEACHER_SUBJECTS.includes(s as TeacherSubject))
          .slice(0, 6)
      : ['arabic', 'english', 'math'];

    const nowIso = new Date().toISOString();
    const userId = `tch_${crypto.randomBytes(6).toString('hex')}`;
    const user: StoredUserRecord = {
      id: userId,
      email: (body.email || '').trim(),
      normalizedEmail: emailCheck.normalized,
      displayName: nameCheck.clean,
      passwordHash: hashPassword(body.password || ''),
      role: 'teacher', // fixed strictly on server; pending admin approval
      emailVerified: false,
      status: 'pending',
      bio: sanitizeLongText(body.bio, 400) || undefined,
      teacherProfile: {
        userId,
        displayName: nameCheck.clean,
        email: (body.email || '').trim(),
        bio: sanitizeLongText(body.bio, 400) || undefined,
        subjects: subjects.length > 0 ? subjects : ['arabic'],
        permissions: [...DEFAULT_TEACHER_PERMISSIONS],
        status: 'pending',
      },
      policyVersion: sanitizeShortText(body.policyVersion || POLICY_VERSION, 24) || POLICY_VERSION,
      termsAcceptedAt: nowIso,
      failedLoginAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users[userId] = user;
    db.emailIndex[emailCheck.normalized] = userId;
    recordAuditEvent(db, {
      eventType: 'AUTH_REGISTER',
      actorId: userId,
      actorRole: 'teacher',
      actionType: 'TEACHER_REGISTER',
      recordType: 'user',
      recordId: userId,
      newValue: `${user.normalizedEmail}:pending`,
      outcome: 'success',
      ip,
      summary: `Teacher registration requested (pending admin approval): ${user.normalizedEmail}`,
    });
    saveDb(db);

    res.status(201).json({
      pendingApproval: true,
      status: 'pending',
      user: toSafeUser(user),
      message: 'Teacher account request submitted and awaiting administrator approval.',
      messageAr: 'تم استلام طلب حساب المعلم بنجاح! الحساب قيد مراجعة وموافقة الإدارة قبل التفعيل.',
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(403).json({ error: 'Current password is incorrect' });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match' });
    }
    const pwCheck = validatePassword(newPassword || '', user.normalizedEmail, user.displayName);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'New password must be different from your current password' });
    }

    user.passwordHash = hashPassword(newPassword || '');
    user.updatedAt = new Date().toISOString();
    revokeAllUserSessions(user.id);
    const csrfToken = createSessionForUser(user, req, res);

    appendSecurityLog(db.securityLogs, {
      eventType: 'PASSWORD_CHANGED',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: 'User updated password and rotated sessions',
    });
    saveDb(db);

    res.json({ updated: true, csrfToken });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    const body = req.body as Record<string, unknown>;

    // Explicit mass-assignment rejection
    if (
      'role' in body ||
      'status' in body ||
      'permissions' in body ||
      'emailVerified' in body ||
      'linkedChildId' in body
    ) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: user.id,
        role: user.role,
        ip: getClientIp(req),
        summary: 'Blocked mass-assignment privilege escalation attempt on /api/auth/profile',
      });
      saveDb(db);
      return res.status(403).json({ error: 'Forbidden: cannot modify protected account fields' });
    }

    if (body.displayName !== undefined) {
      const nc = validateParentName(String(body.displayName));
      if (!nc.ok) return res.status(400).json({ error: nc.error });
      user.displayName = nc.clean;
      if (user.teacherProfile) user.teacherProfile.displayName = nc.clean;
    }

    if (body.bio !== undefined) {
      const cleanBio = sanitizeLongText(body.bio, 400);
      user.bio = cleanBio || undefined;
      if (user.teacherProfile) user.teacherProfile.bio = cleanBio || undefined;
    }

    if (body.subjects !== undefined && user.role === 'teacher' && Array.isArray(body.subjects)) {
      const cleanSubjects = body.subjects
        .filter((s) => ALLOWED_TEACHER_SUBJECTS.includes(s as TeacherSubject))
        .slice(0, 6);
      if (cleanSubjects.length > 0 && user.teacherProfile) {
        user.teacherProfile.subjects = cleanSubjects as string[];
      }
    }

    user.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ user: toSafeUser(user) });
  });

  app.post('/api/parent/children/:childId/student-account', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    if (user.role !== 'parent' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only parents or admins can create child student logins' });
    }
    const child = assertChildAccess(req, res, req.params.childId);
    if (!child || child === 'untracked-sample') {
      if (child === 'untracked-sample') return res.status(404).json({ error: 'Child profile not found' });
      return;
    }

    const { email, password } = req.body as { email?: string; password?: string };
    const emailCheck = validateEmail(email || '');
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

    const pwCheck = validatePassword(password || '', emailCheck.normalized, child.displayName);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });

    const existingOwnerId = db.emailIndex[emailCheck.normalized];
    if (existingOwnerId && existingOwnerId !== child.studentUserId) {
      return res.status(409).json({ error: 'Email already belongs to another user' });
    }

    const nowIso = new Date().toISOString();
    if (child.studentUserId && db.users[child.studentUserId]) {
      const stu = db.users[child.studentUserId];
      if (stu.normalizedEmail !== emailCheck.normalized) {
        delete db.emailIndex[stu.normalizedEmail];
        db.emailIndex[emailCheck.normalized] = stu.id;
      }
      stu.email = emailCheck.normalized;
      stu.normalizedEmail = emailCheck.normalized;
      stu.displayName = child.displayName;
      stu.passwordHash = hashPassword(password || '');
      stu.status = 'active';
      stu.updatedAt = nowIso;
      saveDb(db);
      return res.json({ studentUser: toSafeUser(stu) });
    }

    const studentId = `stu_${crypto.randomBytes(6).toString('hex')}`;
    const studentUser: StoredUserRecord = {
      id: studentId,
      email: emailCheck.normalized,
      normalizedEmail: emailCheck.normalized,
      displayName: child.displayName,
      passwordHash: hashPassword(password || ''),
      role: 'student',
      emailVerified: true,
      status: 'active',
      linkedChildId: child.id,
      policyVersion: POLICY_VERSION,
      termsAcceptedAt: nowIso,
      failedLoginAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users[studentId] = studentUser;
    db.emailIndex[emailCheck.normalized] = studentId;
    child.studentUserId = studentId;
    appendSecurityLog(db.securityLogs, {
      eventType: 'AUTH_REGISTER',
      actorId: user.id,
      role: user.role,
      ip: getClientIp(req),
      summary: `Parent created student login (${emailCheck.normalized}) for child ${child.id}`,
    });
    saveDb(db);
    res.status(201).json({ studentUser: toSafeUser(studentUser) });
  });

  // =========================================================================
  // 2. ADMIN: TEACHER MANAGEMENT, CLASSES, STUDENTS, EXAM REVIEW & PROGRESSION
  // =========================================================================
  app.get('/api/admin/teachers', requireAdminPermission('manage_lessons'), (_req, res) => {
    const db = getDb();
    const storageInfo = getDbStorageInfo();
    const teachers = Object.values(db.users)
      .filter((u) => u.role === 'teacher')
      .map((u) => {
        const assignedClasses = Object.values(db.classes)
          .filter((c) => c.teacherId === u.id)
          .map((c) => ({ id: c.id, name: c.name, subject: c.subject, studentCount: c.studentIds.length }));
        return {
          ...toSafeUser(u),
          bio: u.bio || u.teacherProfile?.bio || '',
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          assignedClasses,
          classesCount: assignedClasses.length,
          questionsCount: Object.values(db.teacherQuestions).filter((q) => q.teacherId === u.id).length,
          examsCount: Object.values(db.teacherExams).filter((e) => e.teacherId === u.id).length,
          isDevSeed: storageInfo.isDevSeedRecord('users', u.id),
        };
      })
      .sort((a, b) => (String(a.createdAt || '') < String(b.createdAt || '') ? 1 : -1));
    res.json({ teachers });
  });

  app.post('/api/admin/teachers', requireAdminPermission('manage_lessons'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const {
      displayName,
      email,
      password,
      subjects,
      permissions,
      status = 'active',
    } = req.body as {
      displayName?: string;
      email?: string;
      password?: string;
      subjects?: string[];
      permissions?: TeacherPermission[];
      status?: AccountStatus;
    };

    const nameCheck = validateParentName(displayName || '');
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });

    const emailCheck = validateEmail(email || '');
    if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

    const pwCheck = validatePassword(password || '', emailCheck.normalized, nameCheck.clean);
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error });

    if (db.emailIndex[emailCheck.normalized]) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const cleanStatus: AccountStatus = ['active', 'pending', 'suspended'].includes(status)
      ? status
      : 'active';
    const cleanPerms = Array.isArray(permissions)
      ? permissions.filter((p) => DEFAULT_TEACHER_PERMISSIONS.includes(p))
      : [...DEFAULT_TEACHER_PERMISSIONS];
    const cleanSubjects = Array.isArray(subjects)
      ? subjects.filter((s) => ALLOWED_TEACHER_SUBJECTS.includes(s as TeacherSubject))
      : ['arabic', 'english', 'math'];

    const nowIso = new Date().toISOString();
    const userId = `tch_${crypto.randomBytes(6).toString('hex')}`;
    const teacher: StoredUserRecord = {
      id: userId,
      email: emailCheck.normalized,
      normalizedEmail: emailCheck.normalized,
      displayName: nameCheck.clean,
      passwordHash: hashPassword(password || ''),
      role: 'teacher',
      emailVerified: true,
      status: cleanStatus,
      teacherProfile: {
        userId,
        displayName: nameCheck.clean,
        email: emailCheck.normalized,
        subjects: cleanSubjects.length > 0 ? cleanSubjects : ['arabic'],
        permissions: cleanPerms,
        approvedBy: req.authSession?.user.id || 'admin-pin',
        approvedAt: cleanStatus === 'active' ? nowIso : undefined,
        status: cleanStatus,
      },
      policyVersion: POLICY_VERSION,
      termsAcceptedAt: nowIso,
      failedLoginAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users[userId] = teacher;
    db.emailIndex[emailCheck.normalized] = userId;
    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role,
      ip: getClientIp(req),
      actionType: 'TEACHER_CREATE',
      recordType: 'user',
      recordId: userId,
      newValue: `${emailCheck.normalized}:${cleanStatus}`,
      outcome: 'success',
      summary: `Admin created teacher ${emailCheck.normalized} (status=${cleanStatus})`,
    });
    saveDb(db);
    res.status(201).json({ teacher: toSafeUser(teacher) });
  });

  app.patch('/api/admin/teachers/:userId', requireAdminPermission('manage_lessons'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = db.users[req.params.userId];
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ error: 'Teacher account not found' });
    }

    const { status, permissions, subjects, reason } = req.body as {
      status?: AccountStatus;
      permissions?: TeacherPermission[];
      subjects?: string[];
      reason?: string;
    };

    const nowIso = new Date().toISOString();
    const prevStatus = teacher.status;
    if (status && ['active', 'pending', 'suspended', 'rejected'].includes(status)) {
      teacher.status = status;
      if (!teacher.teacherProfile) {
        teacher.teacherProfile = {
          userId: teacher.id,
          displayName: teacher.displayName,
          email: teacher.email,
          subjects: ['arabic'],
          permissions: [...DEFAULT_TEACHER_PERMISSIONS],
          status,
        };
      }
      teacher.teacherProfile.status = status;
      if (status === 'active') {
        teacher.emailVerified = true;
        teacher.teacherProfile.approvedBy = req.authSession?.user.id || 'admin';
        teacher.teacherProfile.approvedAt = nowIso;
        delete teacher.teacherProfile.rejectedBy;
        delete teacher.teacherProfile.rejectedAt;
        delete teacher.teacherProfile.rejectionReason;
        delete teacher.teacherProfile.suspendedBy;
        delete teacher.teacherProfile.suspendedAt;
        delete teacher.teacherProfile.suspensionReason;
      } else {
        if (status === 'rejected') {
          teacher.teacherProfile.rejectedBy = req.authSession?.user.id || 'admin';
          teacher.teacherProfile.rejectedAt = nowIso;
          if (reason) teacher.teacherProfile.rejectionReason = sanitizeShortText(reason, 300);
        } else if (status === 'suspended') {
          teacher.teacherProfile.suspendedBy = req.authSession?.user.id || 'admin';
          teacher.teacherProfile.suspendedAt = nowIso;
          if (reason) teacher.teacherProfile.suspensionReason = sanitizeShortText(reason, 300);
        }
        revokeAllUserSessions(teacher.id);
      }
    }

    if (Array.isArray(permissions) && teacher.teacherProfile) {
      teacher.teacherProfile.permissions = permissions.filter((p) =>
        DEFAULT_TEACHER_PERMISSIONS.includes(p),
      );
    }

    if (Array.isArray(subjects) && teacher.teacherProfile) {
      const cleanSubjects = subjects.filter((s) =>
        ALLOWED_TEACHER_SUBJECTS.includes(s as TeacherSubject),
      );
      if (cleanSubjects.length > 0) teacher.teacherProfile.subjects = cleanSubjects;
    }

    teacher.updatedAt = nowIso;
    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role || 'admin',
      actionType: 'TEACHER_STATUS_UPDATE',
      recordType: 'user',
      recordId: teacher.id,
      previousValue: { status: prevStatus },
      newValue: { status: teacher.status },
      reason: reason ? sanitizeShortText(reason, 300) : undefined,
      outcome: 'success',
      ip: getClientIp(req),
      summary: `Admin updated teacher ${teacher.id}: status=${teacher.status}`,
    });
    saveDb(db);
    res.json({ teacher: toSafeUser(teacher) });
  });

  app.get('/api/admin/teachers/:userId/activity', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    const teacher = db.users[req.params.userId];
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ error: 'Teacher account not found' });
    }
    const logs = db.securityLogs.filter((l) => l.actorId === teacher.id).slice(0, 60);
    res.json({ logs });
  });

  app.get('/api/admin/students', requireAdminPermission('manage_lessons'), (_req, res) => {
    const db = getDb();
    const storageInfo = getDbStorageInfo();
    const students = Object.values(db.children).map((ch) => {
      const parent = db.users[ch.parentId];
      const studentUser = ch.studentUserId ? db.users[ch.studentUserId] : undefined;
      return {
        id: ch.id,
        displayName: ch.displayName,
        ageGroup: ch.ageGroup,
        language: ch.language,
        parentId: ch.parentId,
        parentName: parent?.displayName || '',
        studentUserEmail: studentUser?.email || '',
        stars: ch.stars,
        level: ch.level,
        isDevSeed: storageInfo.isDevSeedRecord('children', ch.id),
      };
    });
    res.json({ students });
  });

  app.get('/api/admin/classes', requireAdminPermission('manage_lessons'), (_req, res) => {
    const db = getDb();
    const storageInfo = getDbStorageInfo();
    const classes = Object.values(db.classes).map((cls) => ({
      ...cls,
      teacherName: db.users[cls.teacherId]?.displayName || '',
      studentNames: cls.studentIds.map((sid) => db.children[sid]?.displayName || sid),
      isDevSeed: storageInfo.isDevSeedRecord('classes', cls.id),
    }));
    res.json({ classes });
  });

  app.post('/api/admin/classes', requireAdminPermission('manage_lessons'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const { name, subject, level, teacherId, studentIds = [] } = req.body as {
      name?: string;
      subject?: string;
      level?: 1 | 2 | 'all';
      teacherId?: string;
      studentIds?: string[];
    };

    const cleanName = sanitizeShortText(name, 100);
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Class name (2-100 chars) is required' });
    }

    const teacher = teacherId ? db.users[teacherId] : undefined;
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({ error: 'Valid teacherId is required' });
    }

    const uniqueStudents = Array.from(
      new Set(
        (Array.isArray(studentIds) ? studentIds : []).filter(
          (sid) => typeof sid === 'string' && Boolean(db.children[sid]),
        ),
      ),
    );

    const nowIso = new Date().toISOString();
    const cls: Classroom = {
      id: `cls_${crypto.randomBytes(5).toString('hex')}`,
      name: cleanName,
      subject: sanitizeShortText(subject || 'comprehensive', 40) || 'comprehensive',
      level: level === 1 || level === 2 ? level : 'all',
      teacherId: teacher.id,
      studentIds: uniqueStudents,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.classes[cls.id] = cls;
    appendSecurityLog(db.securityLogs, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      role: req.authSession?.user.role,
      ip: getClientIp(req),
      summary: `Created class ${cls.name} assigned to teacher ${teacher.id}`,
    });
    saveDb(db);
    res.status(201).json({ classroom: cls });
  });

  app.patch('/api/admin/classes/:classId', requireAdminPermission('manage_lessons'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const cls = db.classes[req.params.classId];
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const { name, subject, level, teacherId, active, studentIds } = req.body as Partial<Classroom>;
    if (name !== undefined) {
      const cleanName = sanitizeShortText(name, 100);
      if (cleanName.length < 2) return res.status(400).json({ error: 'Invalid class name' });
      cls.name = cleanName;
    }
    if (subject !== undefined) cls.subject = sanitizeShortText(subject, 40) || cls.subject;
    if (level !== undefined && (level === 1 || level === 2 || level === 'all')) cls.level = level;
    if (teacherId !== undefined) {
      const t = db.users[teacherId];
      if (!t || t.role !== 'teacher') return res.status(400).json({ error: 'Invalid teacherId' });
      cls.teacherId = teacherId;
    }
    if (active !== undefined) cls.active = Boolean(active);
    if (Array.isArray(studentIds)) {
      cls.studentIds = Array.from(new Set(studentIds.filter((sid) => Boolean(db.children[sid]))));
    }
    cls.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ classroom: cls });
  });

  app.delete('/api/admin/classes/:classId', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    if (!db.classes[req.params.classId]) return res.status(404).json({ error: 'Class not found' });
    delete db.classes[req.params.classId];
    saveDb(db);
    res.json({ deleted: true });
  });

  app.post('/api/admin/classes/:classId/students', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    const cls = db.classes[req.params.classId];
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const { studentId } = req.body as { studentId?: string };
    if (!studentId || !db.children[studentId]) {
      return res.status(400).json({ error: 'Valid student childId is required' });
    }
    if (cls.studentIds.includes(studentId)) {
      return res.status(409).json({ error: 'Student is already assigned to this class' });
    }
    cls.studentIds.push(studentId);
    cls.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ classroom: cls });
  });

  app.delete('/api/admin/classes/:classId/students/:studentId', requireAdminPermission('manage_lessons'), (req, res) => {
    const db = getDb();
    const cls = db.classes[req.params.classId];
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    cls.studentIds = cls.studentIds.filter((s) => s !== req.params.studentId);
    cls.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ classroom: cls });
  });

  app.get('/api/admin/exams', requireAdminPermission('manage_lessons'), (_req, res) => {
    const db = getDb();
    const storageInfo = getDbStorageInfo();
    const exams = Object.values(db.teacherExams).map((e) => ({
      ...e,
      teacherName: db.users[e.teacherId]?.displayName || '',
      isDevSeed: storageInfo.isDevSeedRecord('teacherExams', e.id),
    }));
    res.json({ exams });
  });

  app.patch('/api/admin/exams/:examId/review', requireAdminPermission('manage_lessons'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const exam = db.teacherExams[req.params.examId];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const { status, adminReviewNote } = req.body as { status?: ExamStatus; adminReviewNote?: string };
    const allowed: ExamStatus[] = ['published', 'active', 'suspended', 'archived', 'draft', 'pending-review'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid exam status' });
    }
    const prevExamStatus = exam.status;
    exam.status = status;
    if (adminReviewNote !== undefined) exam.adminReviewNote = sanitizeShortText(adminReviewNote, 300);
    exam.updatedAt = new Date().toISOString();
    recordAuditEvent(db, {
      eventType: 'ADMIN_ACTION',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role,
      ip: getClientIp(req),
      actionType: 'EXAM_REVIEW',
      recordType: 'exam',
      recordId: exam.id,
      previousValue: prevExamStatus,
      newValue: status,
      reason: adminReviewNote,
      outcome: 'success',
      summary: `Admin reviewed exam ${exam.id} -> ${status}`,
    });
    saveDb(db);
    res.json({ exam });
  });

  app.get('/api/admin/progression-config', requireAdminPermission('manage_exam_config'), (_req, res) => {
    const db = getDb();
    res.json(db.level2ProgressionConfig);
  });

  app.put('/api/admin/progression-config', requireAdminPermission('manage_exam_config'), (req, res) => {
    const db = getDb();
    const body = req.body as Partial<Level2ProgressionConfig>;
    if (typeof body.allowOpenExploration === 'boolean') {
      db.level2ProgressionConfig.allowOpenExploration = body.allowOpenExploration;
    }
    if (
      typeof body.minLevel1DemonstratedForBadge === 'number' &&
      body.minLevel1DemonstratedForBadge >= 0 &&
      body.minLevel1DemonstratedForBadge <= 75
    ) {
      db.level2ProgressionConfig.minLevel1DemonstratedForBadge = Math.round(
        body.minLevel1DemonstratedForBadge,
      );
    }
    if (typeof body.requirePlacementOrMasteryForOfficialExam === 'boolean') {
      db.level2ProgressionConfig.requirePlacementOrMasteryForOfficialExam =
        body.requirePlacementOrMasteryForOfficialExam;
    }
    saveDb(db);
    res.json(db.level2ProgressionConfig);
  });

  // =========================================================================
  // 3. TEACHER PORTAL: DASHBOARD, CLASSES, STUDENTS, QUESTIONS, BULK IMPORT, EXAMS
  // =========================================================================
  app.get('/api/teacher/dashboard', requireTeacherPermission(), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const assignedStudentIds = getTeacherAssignedStudentIds(db, teacher.id);
    const myClasses = Object.values(db.classes).filter((c) => c.teacherId === teacher.id);
    const myQuestions = Object.values(db.teacherQuestions).filter((q) => q.teacherId === teacher.id && q.active);
    const myExams = Object.values(db.teacherExams).filter((e) => e.teacherId === teacher.id);
    const myAssignments = Object.values(db.examAssignments).filter((a) => a.teacherId === teacher.id);
    const myAttempts = Object.values(db.assignedExamAttempts).filter(
      (att) => att.teacherId === teacher.id && att.status === 'submitted',
    );

    const avgPct =
      myAttempts.length > 0
        ? Math.round(myAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / myAttempts.length)
        : 0;

    const recentResults = myAttempts
      .slice()
      .sort((a, b) => Date.parse(b.submittedAt || b.startedAt) - Date.parse(a.submittedAt || a.startedAt))
      .slice(0, 8)
      .map((a) => ({
        attemptId: a.id,
        examId: a.examId,
        examTitle: db.teacherExams[a.examId]?.title || { ar: 'امتحان', en: 'Exam' },
        studentId: a.studentId,
        studentName: db.children[a.studentId]?.displayName || 'Student',
        percentage: a.percentage ?? 0,
        passed: Boolean(a.passed),
        submittedAt: a.submittedAt,
      }));

    const recentActivity = db.securityLogs.filter((l) => l.actorId === teacher.id).slice(0, 12);

    res.json({
      stats: {
        classesCount: myClasses.length,
        assignedStudentsCount: assignedStudentIds.size,
        totalQuestions: myQuestions.length,
        totalExams: myExams.length,
        publishedExamsCount: myExams.filter((e) => e.status === 'published' || e.status === 'active').length,
        draftExamsCount: myExams.filter((e) => e.status === 'draft').length,
        totalAssignedExams: myAssignments.length,
        completedAttemptsCount: myAttempts.length,
        averageScorePercentage: avgPct,
      },
      recentResults,
      recentActivity,
    });
  });

  app.get('/api/teacher/classes', requireTeacherPermission(), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const classes = Object.values(db.classes)
      .filter((c) => c.teacherId === teacher.id)
      .map((c) => ({
        ...c,
        students: c.studentIds
          .map((sid) => db.children[sid])
          .filter(Boolean)
          .map((ch) => ({
            id: ch.id,
            displayName: ch.displayName,
            ageGroup: ch.ageGroup,
            language: ch.language,
            level: ch.level,
            stars: ch.stars,
          })),
      }));
    res.json({ classes });
  });

  app.get('/api/teacher/students', requireTeacherPermission(), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const assignedIds = getTeacherAssignedStudentIds(db, teacher.id);
    const search = String(req.query.search || '').trim().toLowerCase();
    const levelFilter = req.query.level ? Number(req.query.level) : null;
    const ageFilter = req.query.ageGroup ? String(req.query.ageGroup) : null;

    const classesByStudent = new Map<string, string[]>();
    for (const cls of Object.values(db.classes)) {
      if (cls.teacherId !== teacher.id || !cls.active) continue;
      for (const sid of cls.studentIds) {
        const list = classesByStudent.get(sid) || [];
        list.push(cls.name);
        classesByStudent.set(sid, list);
      }
    }

    const students = Array.from(assignedIds)
      .map((sid) => db.children[sid])
      .filter(Boolean)
      .filter((ch) => {
        if (search && !ch.displayName.toLowerCase().includes(search)) return false;
        if (ageFilter && ch.ageGroup !== ageFilter) return false;
        if (levelFilter === 1 && ch.level !== 1) return false;
        if (levelFilter === 2 && !ch.level2Progress && ch.level < 2) return false;
        return true;
      })
      .map((ch) => {
        const l1Done = Object.values(ch.level1Progress || {}).filter(
          (p) => p.status === 'demonstrated',
        ).length;
        const l2Done = Object.values(ch.level2Progress || {}).filter(
          (p) => p.status === 'demonstrated',
        ).length;
        const myAttempts = Object.values(db.assignedExamAttempts).filter(
          (a) => a.studentId === ch.id && a.teacherId === teacher.id && a.status === 'submitted',
        );
        const avgExamPct =
          myAttempts.length > 0
            ? Math.round(myAttempts.reduce((acc, a) => acc + (a.percentage ?? 0), 0) / myAttempts.length)
            : null;
        return {
          id: ch.id,
          displayName: ch.displayName,
          ageGroup: ch.ageGroup,
          language: ch.language,
          level: ch.level,
          stars: ch.stars,
          classes: classesByStudent.get(ch.id) || [],
          level1MasteredCount: l1Done,
          level2MasteredCount: l2Done,
          completedTeacherExams: myAttempts.length,
          averageExamPercentage: avgExamPct,
        };
      });

    res.json({ students });
  });

  app.get('/api/teacher/students/:studentId/progress', requireTeacherPermission(), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const studentId = req.params.studentId;
    if (!isValidSafeId(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID format' });
    }
    const assignedIds = getTeacherAssignedStudentIds(db, teacher.id);
    if (!assignedIds.has(studentId)) {
      appendSecurityLog(db.securityLogs, {
        eventType: 'ACCESS_DENIED',
        actorId: teacher.id,
        role: teacher.role,
        ip: getClientIp(req),
        summary: `Blocked teacher ${teacher.id} from viewing unassigned student ${studentId}`,
      });
      saveDb(db);
      return res.status(403).json({ error: 'Forbidden: student is not in your assigned classes' });
    }

    const ch = db.children[studentId];
    if (!ch) return res.status(404).json({ error: 'Student not found' });

    const examAttempts = Object.values(db.assignedExamAttempts)
      .filter((a) => a.studentId === studentId && a.teacherId === teacher.id && a.status === 'submitted')
      .map((a) => ({
        attemptId: a.id,
        examId: a.examId,
        examTitle: db.teacherExams[a.examId]?.title || { ar: 'امتحان', en: 'Exam' },
        score: a.score,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        passed: a.passed,
        submittedAt: a.submittedAt,
      }));

    appendSecurityLog(db.securityLogs, {
      eventType: 'STUDENT_PROGRESS_VIEW',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Teacher viewed progress for assigned student ${studentId}`,
    });
    saveDb(db);

    res.json({
      student: {
        id: ch.id,
        displayName: ch.displayName,
        ageGroup: ch.ageGroup,
        language: ch.language,
        level: ch.level,
        stars: ch.stars,
      },
      level1Progress: ch.level1Progress || {},
      level2Progress: ch.level2Progress || {},
      examAttempts,
    });
  });

  app.get('/api/teacher/lessons', requireTeacherPermission(), (_req, res) => {
    const db = getDb();
    const custom = db.customLessons
      .filter((c) => c.published)
      .map((c) => ({
        id: c.id,
        level: (c.level === 2 ? 2 : 1) as 1 | 2,
        subject: c.subject || c.domain,
        title: c.title,
      }));
    res.json({ lessons: [...ALL_CURRICULUM_LESSONS_INDEX, ...custom] });
  });

  // -------------------------------------------------------------------------
  // QUESTION BANK CRUD
  // -------------------------------------------------------------------------
  app.get('/api/teacher/questions', requireTeacherPermission('manage_questions'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const subjectFilter = req.query.subject ? String(req.query.subject) : '';
    const levelFilter = req.query.level ? Number(req.query.level) : null;
    const lessonFilter = req.query.lessonId ? String(req.query.lessonId) : '';
    const typeFilter = req.query.questionType ? String(req.query.questionType) : '';
    const diffFilter = req.query.difficulty ? String(req.query.difficulty) : '';
    const search = String(req.query.search || '').trim().toLowerCase();

    const questions = Object.values(db.teacherQuestions)
      .filter((q) => q.teacherId === teacher.id && q.active)
      .filter((q) => {
        if (subjectFilter && q.subject !== subjectFilter) return false;
        if (levelFilter && q.level !== levelFilter) return false;
        if (lessonFilter && q.lessonId !== lessonFilter) return false;
        if (typeFilter && q.questionType !== typeFilter) return false;
        if (diffFilter && q.difficulty !== diffFilter) return false;
        if (
          search &&
          !q.promptAr.toLowerCase().includes(search) &&
          !q.promptEn.toLowerCase().includes(search) &&
          !q.lessonId.toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    res.json({ questions });
  });

  app.post('/api/teacher/questions', requireTeacherPermission('manage_questions'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const { validIds, levelSubjectMap } = buildValidLessonRegistry(db);
    const parsed = buildSanitizedQuestionDraft(req.body as Record<string, unknown>, validIds, levelSubjectMap);
    if ('error' in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const nowIso = new Date().toISOString();
    const qId = `tq_${crypto.randomBytes(6).toString('hex')}`;
    const qualityFlags = checkQuestionQuality(
      { ...parsed.draft, id: qId },
      Object.values(db.teacherQuestions),
      levelSubjectMap,
    );
    const q: TeacherQuestion = {
      ...parsed.draft,
      id: qId,
      teacherId: teacher.id,
      approvalStatus: db.featureFlags.requireTeacherContentApproval ? 'pending-review' : 'published',
      qualityFlags,
      version: 1,
      versions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.teacherQuestions[q.id] = q;
    appendSecurityLog(db.securityLogs, {
      eventType: 'TEACHER_ACTION',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Created question ${q.id} (${q.lessonId}, ${q.questionType}, flags=${qualityFlags.length})`,
    });
    saveDb(db);
    res.status(201).json({ question: q });
  });

  app.patch('/api/teacher/questions/:id', requireTeacherPermission('manage_questions'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const existing = db.teacherQuestions[req.params.id];
    if (!existing) return res.status(404).json({ error: 'Question not found' });
    if (existing.teacherId !== teacher.id) {
      return res.status(403).json({ error: 'Forbidden: you cannot modify another teacher question' });
    }

    const { validIds, levelSubjectMap } = buildValidLessonRegistry(db);
    const merged = { ...existing, ...(req.body as Record<string, unknown>) };
    const parsed = buildSanitizedQuestionDraft(merged, validIds, levelSubjectMap);
    if ('error' in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const nowIso = new Date().toISOString();
    const prevSnapshot = JSON.parse(
      JSON.stringify({ ...existing, versions: undefined }),
    ) as Record<string, unknown>;
    const versions = [
      ...(existing.versions || []),
      {
        version: existing.version,
        editedBy: teacher.id,
        editedByName: teacher.displayName,
        editedAt: nowIso,
        reason: sanitizeShortText((req.body as Record<string, unknown>).editReason || 'Teacher question edit', 200),
        snapshot: prevSnapshot,
      },
    ].slice(-30);

    const qualityFlags = checkQuestionQuality(
      { ...parsed.draft, id: existing.id },
      Object.values(db.teacherQuestions),
      levelSubjectMap,
    );

    const updated: TeacherQuestion = {
      ...existing,
      ...parsed.draft,
      id: existing.id,
      teacherId: existing.teacherId,
      createdAt: existing.createdAt,
      approvalStatus: db.featureFlags.requireTeacherContentApproval
        ? 'pending-review'
        : existing.approvalStatus || 'published',
      qualityFlags,
      version: existing.version + 1,
      versions,
      updatedAt: nowIso,
    };
    db.teacherQuestions[existing.id] = updated;
    appendSecurityLog(db.securityLogs, {
      eventType: 'CONTENT_VERSION',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Updated question ${existing.id} -> v${updated.version}`,
    });
    saveDb(db);
    res.json({ question: updated });
  });

  app.delete('/api/teacher/questions/:id', requireTeacherPermission('manage_questions'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const existing = db.teacherQuestions[req.params.id];
    if (!existing) return res.status(404).json({ error: 'Question not found' });
    if (existing.teacherId !== teacher.id) {
      return res.status(403).json({ error: 'Forbidden: you cannot delete another teacher question' });
    }

    const usedInExam = Object.values(db.teacherExams).some((e) => e.questionIds.includes(existing.id));
    if (usedInExam) {
      existing.active = false;
      existing.updatedAt = new Date().toISOString();
    } else {
      delete db.teacherQuestions[existing.id];
    }
    saveDb(db);
    res.json({ deleted: true, softArchived: usedInExam });
  });

  app.post('/api/teacher/questions/:id/duplicate', requireTeacherPermission('manage_questions'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const existing = db.teacherQuestions[req.params.id];
    if (!existing) return res.status(404).json({ error: 'Question not found' });
    if (existing.teacherId !== teacher.id) {
      return res.status(403).json({ error: 'Forbidden: cannot duplicate another teacher question' });
    }
    const nowIso = new Date().toISOString();
    const copy: TeacherQuestion = {
      ...JSON.parse(JSON.stringify(existing)),
      id: `tq_${crypto.randomBytes(6).toString('hex')}`,
      promptAr: existing.promptAr ? `${existing.promptAr} (نسخة)` : '',
      promptEn: existing.promptEn ? `${existing.promptEn} (Copy)` : '',
      active: true,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.teacherQuestions[copy.id] = copy;
    saveDb(db);
    res.status(201).json({ question: copy });
  });

  // -------------------------------------------------------------------------
  // BULK IMPORT: TEMPLATE DOWNLOAD, VALIDATED PREVIEW & SAFE COMMIT
  // -------------------------------------------------------------------------
  app.get('/api/teacher/questions/import/template', requireTeacherPermission('bulk_import'), async (req, res) => {
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const sample1 = [
      'arabic',
      '2',
      'L2-AR01',
      'multiple-choice',
      'ما صوت حرف الجيم في جمل؟',
      'What sound does Jeem make in Jamal?',
      'جَ',
      'Ja',
      'حَ',
      'Ha',
      'خَ',
      'Kha',
      '',
      '',
      'a',
      '',
      '',
      '',
      '2',
      'easy',
      'الجيم لها نقطة تحتها وصوتها جَ.',
      'Jeem has one dot below and makes the Ja sound.',
      'جَ جَمَل',
    ];
    const sample2 = [
      'math',
      '2',
      'L2-MA04',
      'short-answer',
      'كم ناتج ٣ + ٥؟',
      'What is 3 + 5?',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '8|٨|eight',
      '',
      '',
      '2',
      'easy',
      'نعد بعد ٥ ثلاث خطوات: ٦، ٧، ٨.',
      'Count 3 steps after 5: 6, 7, 8.',
      '',
    ];

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('QuestionsTemplate');
      ws.addRow(TEMPLATE_HEADERS);
      ws.addRow(sample1);
      ws.addRow(sample2);
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="nonoland-questions-template.xlsx"');
      return res.send(Buffer.from(buf));
    }

    const csvEscape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' +
      [TEMPLATE_HEADERS, sample1, sample2].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nonoland-questions-template.csv"');
    return res.send(csvContent);
  });

  app.post(
    '/api/teacher/questions/import/preview',
    requireTeacherPermission('bulk_import'),
    memoryUpload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Upload file is required (.csv or .xlsx)' });
      }

      const ext = path.extname(file.originalname || '').toLowerCase();
      if (ext !== '.csv' && ext !== '.xlsx') {
        return res.status(400).json({ error: 'Unsupported file format. Only .csv and .xlsx files are accepted.' });
      }

      if (hasDisallowedBinaryHeader(file.buffer)) {
        return res.status(400).json({ error: 'Rejected executable or unsafe file signature.' });
      }

      const allowedMimes = new Set([
        'text/csv',
        'application/csv',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
      ]);
      if (file.mimetype && !allowedMimes.has(file.mimetype)) {
        return res.status(400).json({ error: `Disallowed MIME type: ${file.mimetype}` });
      }

      let rawRows: string[][] = [];
      if (ext === '.xlsx') {
        // Must have ZIP local header magic bytes (PK\x03\x04)
        if (
          file.buffer.length < 4 ||
          file.buffer[0] !== 0x50 ||
          file.buffer[1] !== 0x4b ||
          file.buffer[2] !== 0x03 ||
          file.buffer[3] !== 0x04
        ) {
          return res.status(400).json({ error: 'Invalid Excel (.xlsx) file structure.' });
        }
        try {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
          const ws = wb.worksheets[0];
          if (!ws) return res.status(400).json({ error: 'Excel workbook has no worksheets' });
          ws.eachRow((row) => {
            const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
            const strRow = vals.map((cell) => {
              if (cell === null || cell === undefined) return '';
              if (typeof cell === 'object' && 'text' in cell) return String((cell as { text: unknown }).text || '');
              return String(cell).trim();
            });
            if (strRow.some((s) => s.length > 0)) rawRows.push(strRow);
          });
        } catch {
          return res.status(400).json({ error: 'Failed to parse Excel (.xlsx) workbook' });
        }
      } else {
        if (file.buffer.includes(0x00)) {
          return res.status(400).json({ error: 'Binary null bytes rejected in CSV upload.' });
        }
        const csvText = file.buffer.toString('utf-8');
        if (/<!doctype|<html|<script/i.test(csvText)) {
          return res.status(400).json({ error: 'HTML/script payloads are not allowed inside CSV files.' });
        }
        rawRows = parseCsvMatrix(csvText);
      }

      if (rawRows.length < 2) {
        return res.status(400).json({ error: 'File must contain a header row and at least one question row.' });
      }
      if (rawRows.length > 501) {
        return res.status(400).json({ error: 'Maximum 500 questions per import batch.' });
      }

      const headers = rawRows[0].map((h) => h.trim());
      if (!headers.includes('lessonId') || !headers.includes('subject')) {
        return res.status(400).json({ error: 'Missing required columns (subject, lessonId). Use the official template.' });
      }

      if (!fs.existsSync(UPLOAD_STORAGE_DIR)) {
        fs.mkdirSync(UPLOAD_STORAGE_DIR, { recursive: true });
      }
      const safeFilename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      const storedPath = path.join(UPLOAD_STORAGE_DIR, safeFilename);
      fs.writeFileSync(storedPath, file.buffer);

      const { validIds, levelSubjectMap } = buildValidLessonRegistry(db);
      const existingPrompts = new Set(
        Object.values(db.teacherQuestions)
          .filter((q) => q.teacherId === teacher.id && q.active)
          .map((q) => `${q.lessonId}|${(q.promptAr || q.promptEn).toLowerCase()}`),
      );
      const batchPrompts = new Set<string>();

      const validRows: Array<{
        rowNumber: number;
        question: Omit<TeacherQuestion, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'version'>;
      }> = [];
      const invalidRows: Array<{ rowNumber: number; errors: string[] }> = [];

      for (let i = 1; i < rawRows.length; i++) {
        const rowNumber = i + 1;
        const rowArr = rawRows[i];
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = rowArr[idx] ?? '';
        });

        const rawCandidate = rowObjectToQuestionRaw(rowObj);
        const parsed = buildSanitizedQuestionDraft(rawCandidate, validIds, levelSubjectMap);
        if ('error' in parsed) {
          invalidRows.push({ rowNumber, errors: [parsed.error] });
          continue;
        }

        const promptKey = `${parsed.draft.lessonId}|${(parsed.draft.promptAr || parsed.draft.promptEn).toLowerCase()}`;
        if (existingPrompts.has(promptKey) || batchPrompts.has(promptKey)) {
          invalidRows.push({
            rowNumber,
            errors: ['Duplicate question prompt for this lesson already exists or appears twice in this file.'],
          });
          continue;
        }
        batchPrompts.add(promptKey);
        validRows.push({ rowNumber, question: parsed.draft });
      }

      const batchId = `imp_${crypto.randomBytes(6).toString('hex')}`;
      db.importBatches[batchId] = {
        id: batchId,
        teacherId: teacher.id,
        fileName: sanitizeShortText(file.originalname, 120),
        format: ext === '.xlsx' ? 'xlsx' : 'csv',
        storedUploadPath: storedPath,
        validRows,
        invalidRows,
        committed: false,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 20 * 60_000,
      };
      saveDb(db);

      res.json({
        importBatchId: batchId,
        totalRows: rawRows.length - 1,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
      });
    },
  );

  app.post('/api/teacher/questions/import/commit', requireTeacherPermission('bulk_import'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const { importBatchId } = req.body as { importBatchId?: string };
    const batch = importBatchId ? db.importBatches[importBatchId] : undefined;
    if (!batch) return res.status(404).json({ error: 'Import batch not found' });
    if (batch.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });
    if (batch.committed) return res.status(409).json({ error: 'Import batch has already been committed' });
    if (batch.expiresAt < Date.now()) return res.status(410).json({ error: 'Import preview expired. Please re-upload.' });
    if (batch.validRows.length === 0) {
      return res.status(400).json({ error: 'No valid rows available to import' });
    }

    const nowIso = new Date().toISOString();
    const { levelSubjectMap } = buildValidLessonRegistry(db);
    const createdIds: string[] = [];
    for (const item of batch.validRows) {
      const qId = `tq_${crypto.randomBytes(6).toString('hex')}`;
      const qualityFlags = checkQuestionQuality(
        { ...item.question, id: qId },
        Object.values(db.teacherQuestions),
        levelSubjectMap,
      );
      const q: TeacherQuestion = {
        ...item.question,
        id: qId,
        teacherId: teacher.id,
        approvalStatus: db.featureFlags.requireTeacherContentApproval ? 'pending-review' : 'published',
        qualityFlags,
        version: 1,
        versions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.teacherQuestions[q.id] = q;
      createdIds.push(q.id);
    }

    batch.committed = true;
    appendSecurityLog(db.securityLogs, {
      eventType: 'BULK_IMPORT',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Committed bulk import ${batch.id} (${createdIds.length} questions, skipped ${batch.invalidRows.length})`,
    });
    saveDb(db);

    res.status(201).json({
      committed: true,
      importedCount: createdIds.length,
      skippedInvalidCount: batch.invalidRows.length,
      createdIds,
    });
  });

  // -------------------------------------------------------------------------
  // TEACHER EXAM BUILDER, STATUS WORKFLOW, ASSIGNMENTS & RESULTS
  // -------------------------------------------------------------------------
  function validateAndSnapshotTeacherExam(
    db: ServerDb,
    teacherId: string,
    payload: Record<string, unknown>,
  ): { ok: true; examData: Omit<TeacherExam, 'id' | 'teacherId' | 'createdAt' | 'updatedAt' | 'version'> } | { ok: false; error: string } {
    const scheduleCheck = validateExamScheduleAndConfig({
      titleAr: (payload.title as Record<string, unknown>)?.ar ?? payload.titleAr,
      titleEn: (payload.title as Record<string, unknown>)?.en ?? payload.titleEn,
      passingPercentage: payload.passingPercentage,
      durationMinutes: payload.durationMinutes,
      startDate: payload.startDate,
      endDate: payload.endDate,
      allowedAttempts: payload.allowedAttempts,
    });
    if (!scheduleCheck.ok) return { ok: false, error: scheduleCheck.error || 'Invalid exam config' };

    const subject = sanitizeShortText(payload.subject, 40) as TeacherExam['subject'];
    if (subject !== 'comprehensive' && !ALLOWED_TEACHER_SUBJECTS.includes(subject)) {
      return { ok: false, error: 'Invalid exam subject' };
    }
    const level: 1 | 2 = Number(payload.level) === 2 ? 2 : 1;
    if (payload.ageGroup && !['1-4', '3-4'].includes(String(payload.ageGroup))) {
      return { ok: false, error: 'Only Little Explorers (1-4) stage is supported for new exams' };
    }
    const ageGroup: AgeGroupId = '1-4';

    const questionIds = Array.from(
      new Set(Array.isArray(payload.questionIds) ? payload.questionIds.map((x) => String(x)) : []),
    );
    if (questionIds.length === 0) {
      return { ok: false, error: 'An exam must contain at least 1 question' };
    }

    const questionSnapshots: Record<string, TeacherQuestion> = {};
    const derivedLessonIds = new Set<string>(
      Array.isArray(payload.lessonIds) ? payload.lessonIds.map((x) => String(x)) : [],
    );
    let calculatedMarks = 0;

    for (const qId of questionIds) {
      const q = db.teacherQuestions[qId];
      if (!q || !q.active) {
        return { ok: false, error: `Selected question ${qId} does not exist or is inactive` };
      }
      if (q.teacherId !== teacherId) {
        return { ok: false, error: `Forbidden: question ${qId} belongs to another teacher` };
      }
      questionSnapshots[qId] = JSON.parse(JSON.stringify(q)) as TeacherQuestion;
      derivedLessonIds.add(q.lessonId);
      calculatedMarks += q.marks;
    }

    if (payload.totalMarks !== undefined && Math.abs(Number(payload.totalMarks) - calculatedMarks) > 0.01) {
      return {
        ok: false,
        error: `Total marks (${payload.totalMarks}) must match sum of selected question marks (${calculatedMarks})`,
      };
    }

    const requestedStatus = sanitizeShortText(payload.status || 'draft', 30) as ExamStatus;
    const allowedInitial: ExamStatus[] = [
      'draft',
      'pending-review',
      'published',
      'scheduled',
      'active',
    ];
    const status: ExamStatus = allowedInitial.includes(requestedStatus) ? requestedStatus : 'draft';

    const titleObj = payload.title as Record<string, unknown> | undefined;
    const descObj = payload.description as Record<string, unknown> | undefined;
    return {
      ok: true,
      examData: {
        title: {
          ar: sanitizeShortText(titleObj?.ar ?? payload.titleAr, 160),
          en: sanitizeShortText(titleObj?.en ?? payload.titleEn, 160),
        },
        description: {
          ar: sanitizeLongText(descObj?.ar ?? payload.descriptionAr, 600),
          en: sanitizeLongText(descObj?.en ?? payload.descriptionEn, 600),
        },
        subject,
        level,
        ageGroup,
        lessonIds: Array.from(derivedLessonIds),
        questionIds,
        questionSnapshots,
        totalQuestions: questionIds.length,
        totalMarks: calculatedMarks,
        passingPercentage: Number(payload.passingPercentage),
        durationMinutes: Number(payload.durationMinutes),
        startDate: new Date(String(payload.startDate)).toISOString(),
        endDate: new Date(String(payload.endDate)).toISOString(),
        allowedAttempts: Number(payload.allowedAttempts),
        randomizeQuestions: Boolean(payload.randomizeQuestions),
        randomizeAnswers: Boolean(payload.randomizeAnswers),
        showResults: payload.showResults !== false,
        showCorrectAnswers: payload.showCorrectAnswers !== false,
        status,
      },
    };
  }

  app.get('/api/teacher/exams', requireTeacherPermission('manage_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const exams = Object.values(db.teacherExams)
      .filter((e) => e.teacherId === teacher.id)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((e) => ({
        ...e,
        assignmentCount: Object.values(db.examAssignments).filter((a) => a.examId === e.id).length,
        completedCount: Object.values(db.assignedExamAttempts).filter(
          (att) => att.examId === e.id && att.status === 'submitted',
        ).length,
      }));
    res.json({ exams });
  });

  app.post('/api/teacher/exams', requireTeacherPermission('manage_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const validated = validateAndSnapshotTeacherExam(db, teacher.id, req.body as Record<string, unknown>);
    if ('error' in validated) return res.status(400).json({ error: validated.error });

    const nowIso = new Date().toISOString();
    const examStatus =
      db.featureFlags.requireTeacherContentApproval &&
      (validated.examData.status === 'published' || validated.examData.status === 'active')
        ? 'pending-review'
        : validated.examData.status;

    const exam: TeacherExam = {
      ...validated.examData,
      status: examStatus,
      id: `tex_${crypto.randomBytes(6).toString('hex')}`,
      teacherId: teacher.id,
      version: 1,
      versions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.teacherExams[exam.id] = exam;
    appendSecurityLog(db.securityLogs, {
      eventType: 'TEACHER_ACTION',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Created exam ${exam.id} (${exam.totalQuestions} Qs, status=${exam.status})`,
    });
    saveDb(db);
    res.status(201).json({ exam });
  });

  app.patch('/api/teacher/exams/:id', requireTeacherPermission('manage_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const existing = db.teacherExams[req.params.id];
    if (!existing) return res.status(404).json({ error: 'Exam not found' });
    if (existing.teacherId !== teacher.id) {
      return res.status(403).json({ error: 'Forbidden: you cannot edit another teacher exam' });
    }

    const merged = { ...existing, ...(req.body as Record<string, unknown>) };
    const validated = validateAndSnapshotTeacherExam(db, teacher.id, merged);
    if ('error' in validated) return res.status(400).json({ error: validated.error });

    const nowIso = new Date().toISOString();
    const prevSnapshot = JSON.parse(
      JSON.stringify({ ...existing, versions: undefined }),
    ) as Record<string, unknown>;
    const versions = [
      ...(existing.versions || []),
      {
        version: existing.version,
        editedBy: teacher.id,
        editedByName: teacher.displayName,
        editedAt: nowIso,
        reason: sanitizeShortText((req.body as Record<string, unknown>).editReason || 'Teacher exam edit', 200),
        snapshot: prevSnapshot,
      },
    ].slice(-30);

    const nextStatus =
      db.featureFlags.requireTeacherContentApproval &&
      (validated.examData.status === 'published' || validated.examData.status === 'active')
        ? 'pending-review'
        : validated.examData.status;

    const updated: TeacherExam = {
      ...existing,
      ...validated.examData,
      status: nextStatus,
      id: existing.id,
      teacherId: existing.teacherId,
      createdAt: existing.createdAt,
      version: existing.version + 1,
      versions,
      updatedAt: nowIso,
    };
    db.teacherExams[existing.id] = updated;
    appendSecurityLog(db.securityLogs, {
      eventType: 'CONTENT_VERSION',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Updated exam ${existing.id} -> v${updated.version}`,
    });
    saveDb(db);
    res.json({ exam: updated });
  });

  app.patch('/api/teacher/exams/:id/status', requireTeacherPermission('manage_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const existing = db.teacherExams[req.params.id];
    if (!existing) return res.status(404).json({ error: 'Exam not found' });
    if (existing.teacherId !== teacher.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { status } = req.body as { status?: ExamStatus };
    const allowed: ExamStatus[] = ['draft', 'pending-review', 'published', 'scheduled', 'active', 'archived'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }
    if (
      db.featureFlags.requireTeacherContentApproval &&
      (status === 'published' || status === 'active')
    ) {
      existing.status = 'pending-review';
      existing.updatedAt = new Date().toISOString();
      saveDb(db);
      return res.json({
        exam: existing,
        requiresAdminApproval: true,
        message: 'Content approval is enabled: exam moved to pending-review for Admin approval.',
      });
    }
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ exam: existing });
  });

  app.delete('/api/teacher/exams/:id', requireTeacherPermission('manage_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const existing = db.teacherExams[req.params.id];
    if (!existing) return res.status(404).json({ error: 'Exam not found' });
    if (existing.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });
    delete db.teacherExams[existing.id];
    saveDb(db);
    res.json({ deleted: true });
  });

  app.post('/api/teacher/exams/:id/assign', requireTeacherPermission('assign_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const exam = db.teacherExams[req.params.id];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== teacher.id) {
      return res.status(403).json({ error: 'Forbidden: you cannot assign another teacher exam' });
    }

    const { studentIds = [], classIds = [], availableStartDate, deadline, publishNow } = req.body as {
      studentIds?: string[];
      classIds?: string[];
      availableStartDate?: string;
      deadline?: string;
      publishNow?: boolean;
    };

    const assignedSet = getTeacherAssignedStudentIds(db, teacher.id);
    const targets = new Map<string, string | undefined>(); // studentId -> classId

    for (const cid of Array.isArray(classIds) ? classIds : []) {
      const cls = db.classes[cid];
      if (!cls || cls.teacherId !== teacher.id) {
        return res.status(403).json({ error: `Forbidden: class ${cid} is not assigned to you` });
      }
      for (const sid of cls.studentIds) {
        targets.set(sid, cid);
      }
    }

    for (const sid of Array.isArray(studentIds) ? studentIds : []) {
      if (!assignedSet.has(sid)) {
        return res.status(403).json({
          error: `Forbidden: student ${sid} does not belong to any of your assigned classes`,
        });
      }
      if (!targets.has(sid)) targets.set(sid, undefined);
    }

    if (targets.size === 0) {
      return res.status(400).json({ error: 'Select at least one assigned student or class' });
    }

    const startIso = availableStartDate ? new Date(availableStartDate).toISOString() : exam.startDate;
    const endIso = deadline ? new Date(deadline).toISOString() : exam.endDate;
    if (Date.parse(startIso) >= Date.parse(endIso)) {
      return res.status(400).json({ error: 'Available start date must be before deadline' });
    }

    const created: ExamAssignment[] = [];
    let skippedDuplicates = 0;

    for (const [sid, classId] of targets.entries()) {
      const dup = Object.values(db.examAssignments).find(
        (a) => a.examId === exam.id && a.studentId === sid && a.status !== 'expired',
      );
      if (dup) {
        skippedDuplicates++;
        continue;
      }
      const assignment: ExamAssignment = {
        id: `asgn_${crypto.randomBytes(6).toString('hex')}`,
        examId: exam.id,
        studentId: sid,
        teacherId: teacher.id,
        classId,
        assignedAt: new Date().toISOString(),
        availableStartDate: startIso,
        deadline: endIso,
        status: 'assigned',
      };
      db.examAssignments[assignment.id] = assignment;
      created.push(assignment);
    }

    if (publishNow && (exam.status === 'draft' || exam.status === 'scheduled')) {
      exam.status = db.featureFlags.requireTeacherContentApproval ? 'pending-review' : 'published';
      exam.updatedAt = new Date().toISOString();
    }

    appendSecurityLog(db.securityLogs, {
      eventType: 'TEACHER_ACTION',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Assigned exam ${exam.id} to ${created.length} students (publishNow=${Boolean(publishNow)})`,
    });
    saveDb(db);

    res.status(201).json({
      assignments: created,
      assignedCount: created.length,
      skippedDuplicates,
      examStatus: exam.status,
    });
  });

  app.get('/api/teacher/exams/:id/assignments', requireTeacherPermission('assign_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const exam = db.teacherExams[req.params.id];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });

    const list = Object.values(db.examAssignments)
      .filter((a) => a.examId === exam.id)
      .map((a) => ({
        ...a,
        studentName: db.children[a.studentId]?.displayName || a.studentId,
        className: a.classId ? db.classes[a.classId]?.name : undefined,
      }));
    res.json({ assignments: list });
  });

  app.delete('/api/teacher/exams/:id/assignments/:assignmentId', requireTeacherPermission('assign_exams'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const assignment = db.examAssignments[req.params.assignmentId];
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (assignment.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });
    delete db.examAssignments[assignment.id];
    saveDb(db);
    res.json({ deleted: true });
  });

  app.get('/api/teacher/results', requireTeacherPermission('view_results'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const results = Object.values(db.assignedExamAttempts)
      .filter((a) => a.teacherId === teacher.id && a.status === 'submitted')
      .sort((a, b) => Date.parse(b.submittedAt || b.startedAt) - Date.parse(a.submittedAt || a.startedAt))
      .map((a) => {
        const exam = db.teacherExams[a.examId];
        const assignment = db.examAssignments[a.assignmentId];
        return {
          ...a,
          examTitle: exam?.title || { ar: 'امتحان', en: 'Exam' },
          subject: exam?.subject || 'comprehensive',
          studentName: db.children[a.studentId]?.displayName || a.studentId,
          className: assignment?.classId ? db.classes[assignment.classId]?.name : undefined,
        };
      });
    res.json({ results });
  });

  // =========================================================================
  // 4. STUDENT ASSIGNED EXAMS: VIEW, START/RESUME, SAVE ANSWER, GRADE SUBMIT
  // =========================================================================
  app.get('/api/student/exams', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const authRes = resolveAuthorizedStudentChildIds(
      req,
      db,
      req.query.childId ? String(req.query.childId) : undefined,
    );
    if ('error' in authRes) {
      return res.status(authRes.status).json({ error: authRes.error });
    }

    const childSet = new Set(authRes.childIds);
    const now = Date.now();
    const available: unknown[] = [];
    const upcoming: unknown[] = [];
    const inProgress: unknown[] = [];
    const completed: unknown[] = [];

    for (const asgn of Object.values(db.examAssignments)) {
      if (!childSet.has(asgn.studentId)) continue;
      const exam = db.teacherExams[asgn.examId];
      const allowedExamStatuses = db.featureFlags.requireTeacherContentApproval
        ? ['approved', 'published', 'active']
        : ['published', 'active', 'approved'];
      if (!exam || !allowedExamStatuses.includes(exam.status)) {
        continue;
      }

      const attempts = Object.values(db.assignedExamAttempts).filter(
        (a) => a.assignmentId === asgn.id && a.studentId === asgn.studentId,
      );
      const activeAttempt = attempts.find((a) => a.status === 'in-progress');
      const submittedAttempts = attempts.filter((a) => a.status === 'submitted');
      const startMs = Date.parse(asgn.availableStartDate || exam.startDate);
      const endMs = Date.parse(asgn.extendedDeadline || asgn.deadline || exam.endDate);
      const canRetake = submittedAttempts.length < exam.allowedAttempts && now <= endMs && now >= startMs;

      const card = {
        assignmentId: asgn.id,
        examId: exam.id,
        studentId: asgn.studentId,
        studentName: db.children[asgn.studentId]?.displayName || '',
        teacherName: db.users[exam.teacherId]?.displayName || '',
        title: exam.title,
        description: exam.description,
        subject: exam.subject,
        level: exam.level,
        ageGroup: exam.ageGroup,
        totalQuestions: exam.totalQuestions,
        totalMarks: exam.totalMarks,
        passingPercentage: exam.passingPercentage,
        durationMinutes: exam.durationMinutes,
        allowedAttempts: exam.allowedAttempts,
        usedAttempts: submittedAttempts.length,
        availableStartDate: asgn.availableStartDate,
        deadline: asgn.extendedDeadline || asgn.deadline,
        status: asgn.status,
        showResults: exam.showResults,
        inProgressAttemptId: activeAttempt?.id,
        latestResult:
          submittedAttempts.length > 0
            ? (() => {
                const last = submittedAttempts[submittedAttempts.length - 1];
                return {
                  attemptId: last.id,
                  submittedAt: last.submittedAt,
                  resultsReleased: exam.showResults,
                  score: exam.showResults ? last.score : undefined,
                  totalMarks: exam.showResults ? last.totalMarks : undefined,
                  percentage: exam.showResults ? last.percentage : undefined,
                  passed: exam.showResults ? last.passed : undefined,
                };
              })()
            : undefined,
      };

      if (activeAttempt) {
        inProgress.push(card);
      } else if (now < startMs) {
        upcoming.push(card);
      } else if ((exam.status === 'published' || exam.status === 'active') && canRetake) {
        available.push(card);
      }
      if (submittedAttempts.length > 0) {
        completed.push(card);
      }
    }

    res.json({ available, upcoming, inProgress, completed });
  });

  app.post('/api/student/exams/:assignmentId/start', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const asgn = db.examAssignments[req.params.assignmentId];
    if (!asgn) return res.status(404).json({ error: 'Exam assignment not found' });

    const authRes = resolveAuthorizedStudentChildIds(req, db, asgn.studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    const exam = db.teacherExams[asgn.examId];
    const allowedStartStatuses = ['published', 'active', 'approved'];
    if (!exam || !allowedStartStatuses.includes(exam.status)) {
      return res.status(403).json({ error: 'Exam is not currently published or approved for students' });
    }

    const now = Date.now();
    const startMs = Date.parse(asgn.availableStartDate || exam.startDate);
    const endMs = Date.parse(asgn.extendedDeadline || asgn.deadline || exam.endDate);
    if (now < startMs) {
      return res.status(403).json({ error: 'Exam has not started yet according to schedule' });
    }
    if (now > endMs) {
      return res.status(403).json({ error: 'Exam deadline has already passed' });
    }

    const existingInProgress = Object.values(db.assignedExamAttempts).find(
      (a) => a.assignmentId === asgn.id && a.studentId === asgn.studentId && a.status === 'in-progress',
    );
    const snapMap = new Map<string, TeacherQuestion>();
    for (const qId of exam.questionIds) {
      const q = exam.questionSnapshots?.[qId] || db.teacherQuestions[qId];
      if (q) snapMap.set(qId, q);
    }

    if (existingInProgress) {
      const elapsedSec = Math.floor((now - Date.parse(existingInProgress.startedAt)) / 1000);
      const remainingSeconds = Math.max(0, exam.durationMinutes * 60 - elapsedSec);
      const sanitizedQuestions = existingInProgress.questionIds
        .map((qId) => snapMap.get(qId))
        .filter(Boolean)
        .map((q) => sanitizeQuestionForStudent(q!, existingInProgress.optionOrderMap[q!.id]));
      return res.json({
        attemptId: existingInProgress.id,
        resumed: true,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          durationMinutes: exam.durationMinutes,
          totalMarks: exam.totalMarks,
          passingPercentage: exam.passingPercentage,
        },
        remainingSeconds,
        savedAnswers: existingInProgress.answers,
        questions: sanitizedQuestions,
      });
    }

    const submittedCount = Object.values(db.assignedExamAttempts).filter(
      (a) => a.assignmentId === asgn.id && a.studentId === asgn.studentId && a.status === 'submitted',
    ).length;
    if (submittedCount >= exam.allowedAttempts) {
      return res.status(403).json({ error: 'Maximum allowed attempts reached for this exam' });
    }

    const questionIds = exam.randomizeQuestions
      ? [...exam.questionIds].sort(() => Math.random() - 0.5)
      : [...exam.questionIds];

    const optionOrderMap: Record<string, string[]> = {};
    for (const qId of questionIds) {
      const q = snapMap.get(qId);
      if (q && q.options.length > 0) {
        const ids = q.options.map((o) => o.id);
        optionOrderMap[qId] = exam.randomizeAnswers ? [...ids].sort(() => Math.random() - 0.5) : ids;
      }
    }

    const attempt: AssignedExamAttempt = {
      id: `att_${crypto.randomBytes(6).toString('hex')}`,
      assignmentId: asgn.id,
      examId: exam.id,
      studentId: asgn.studentId,
      teacherId: exam.teacherId,
      attemptNumber: submittedCount + 1,
      questionIds,
      optionOrderMap,
      answers: {},
      status: 'in-progress',
      startedAt: new Date().toISOString(),
    };
    db.assignedExamAttempts[attempt.id] = attempt;
    asgn.status = 'in-progress';
    saveDb(db);

    const sanitizedQuestions = questionIds
      .map((qId) => snapMap.get(qId))
      .filter(Boolean)
      .map((q) => sanitizeQuestionForStudent(q!, optionOrderMap[q!.id]));

    res.json({
      attemptId: attempt.id,
      resumed: false,
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        passingPercentage: exam.passingPercentage,
      },
      remainingSeconds: exam.durationMinutes * 60,
      savedAnswers: {},
      questions: sanitizedQuestions,
    });
  });

  app.post('/api/student/exams/attempts/:attemptId/answer', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const attempt = db.assignedExamAttempts[req.params.attemptId];
    if (!attempt) return res.status(404).json({ error: 'Exam attempt not found' });

    const authRes = resolveAuthorizedStudentChildIds(req, db, attempt.studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    if (attempt.status !== 'in-progress') {
      return res.status(409).json({ error: 'Cannot edit answers after exam submission' });
    }

    const { questionId, answer } = req.body as {
      questionId?: string;
      answer?: string | string[] | Record<string, string>;
    };
    if (!questionId || !attempt.questionIds.includes(questionId)) {
      return res.status(400).json({ error: 'Invalid questionId for this attempt' });
    }
    if (answer !== undefined) {
      attempt.answers[questionId] = answer;
    }
    saveDb(db);
    res.json({ saved: true, answeredCount: Object.keys(attempt.answers).length });
  });

  app.post('/api/student/exams/attempts/:attemptId/submit', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const attempt = db.assignedExamAttempts[req.params.attemptId];
    if (!attempt) return res.status(404).json({ error: 'Exam attempt not found' });

    const authRes = resolveAuthorizedStudentChildIds(req, db, attempt.studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    if (attempt.status === 'submitted') {
      return res.status(409).json({
        error: 'Duplicate submission blocked: this exam attempt was already submitted.',
        duplicateBlocked: true,
      });
    }

    const exam = db.teacherExams[attempt.examId];
    const asgn = db.examAssignments[attempt.assignmentId];
    if (!exam || !asgn) return res.status(404).json({ error: 'Assigned exam not found' });

    const now = Date.now();
    const deadlineMs = Date.parse(asgn.extendedDeadline || asgn.deadline || exam.endDate);
    if (now > deadlineMs + 90_000) {
      return res.status(403).json({ error: 'Submission window expired past exam deadline' });
    }

    const { answers = {} } = req.body as {
      answers?: Record<string, string | string[] | Record<string, string>>;
    };
    const mergedAnswers = { ...attempt.answers, ...answers };
    attempt.answers = mergedAnswers;

    const snapMap = new Map<string, TeacherQuestion>();
    for (const qId of attempt.questionIds) {
      const q = exam.questionSnapshots?.[qId] || db.teacherQuestions[qId];
      if (q) snapMap.set(qId, q);
    }

    let score = 0;
    let totalMarks = 0;
    const review: AssignedExamReviewItem[] = [];

    for (const qId of attempt.questionIds) {
      const q = snapMap.get(qId);
      if (!q) continue;
      totalMarks += q.marks;
      const submitted = mergedAnswers[qId] ?? '';
      let isCorrect = false;
      let correctAnswer: AssignedExamReviewItem['correctAnswer'];

      if (q.questionType === 'matching' && q.matchingPairs) {
        const subMap = (typeof submitted === 'object' && !Array.isArray(submitted) ? submitted : {}) as Record<
          string,
          string
        >;
        isCorrect =
          q.matchingPairs.length > 0 &&
          q.matchingPairs.every(
            (p) => normalizeAnswerForMatch(subMap[p.id] || '') === normalizeAnswerForMatch(p.right),
          );
        const canonMap: Record<string, string> = {};
        q.matchingPairs.forEach((p) => {
          canonMap[p.id] = p.right;
        });
        correctAnswer = canonMap;
      } else if (q.questionType === 'ordering' && q.correctOrder) {
        const subArr = Array.isArray(submitted) ? submitted : [];
        isCorrect =
          subArr.length === q.correctOrder.length &&
          q.correctOrder.every((val, i) => normalizeAnswerForMatch(val) === normalizeAnswerForMatch(subArr[i] || ''));
        correctAnswer = q.correctOrder;
      } else if (
        (q.questionType === 'fill-blank' || q.questionType === 'short-answer') &&
        q.acceptedAnswers
      ) {
        const subNorm = normalizeAnswerForMatch(typeof submitted === 'string' ? submitted : '');
        isCorrect = subNorm.length > 0 && q.acceptedAnswers.some((ans) => normalizeAnswerForMatch(ans) === subNorm);
        correctAnswer = q.acceptedAnswers[0];
      } else if (q.allowMultipleCorrect && q.correctOptionIds) {
        const subArr = Array.isArray(submitted)
          ? [...submitted].sort()
          : typeof submitted === 'string' && submitted
            ? [submitted]
            : [];
        const expArr = [...q.correctOptionIds].sort();
        isCorrect = subArr.length === expArr.length && subArr.every((v, i) => v === expArr[i]);
        correctAnswer = q.correctOptionIds;
      } else {
        const subId = typeof submitted === 'string' ? submitted.trim() : '';
        isCorrect = Boolean(q.correctOptionId && subId === q.correctOptionId);
        correctAnswer = q.correctOptionId;
      }

      const marksAwarded = isCorrect ? q.marks : 0;
      score += marksAwarded;

      review.push({
        questionId: q.id,
        questionType: q.questionType,
        prompt: { ar: q.promptAr, en: q.promptEn },
        submittedAnswer: submitted,
        correctAnswer: exam.showCorrectAnswers ? correctAnswer : undefined,
        isCorrect,
        marksAwarded,
        maxMarks: q.marks,
        explanation: exam.showCorrectAnswers ? q.explanation : undefined,
        feedback: isCorrect ? q.feedbackCorrect : q.feedbackIncorrect,
      });
    }

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = percentage >= exam.passingPercentage;
    const nowIso = new Date().toISOString();

    attempt.status = 'submitted';
    attempt.score = score;
    attempt.totalMarks = totalMarks;
    attempt.percentage = percentage;
    attempt.passed = passed;
    attempt.submittedAt = nowIso;
    attempt.review = review;
    asgn.status = 'completed';

    const child = db.children[attempt.studentId];
    if (child && passed) {
      child.stars = (child.stars || 0) + 5;
    }

    recordAuditEvent(db, {
      eventType: 'EXAM_COMPLETED',
      actorId: req.authSession?.user.id,
      actorRole: req.authSession?.user.role,
      ip: getClientIp(req),
      actionType: 'EXAM_SUBMIT',
      recordType: 'exam_attempt',
      recordId: attempt.id,
      newValue: `${score}/${totalMarks} (${percentage}%)`,
      outcome: 'success',
      summary: `Student ${attempt.studentId} submitted teacher exam ${exam.id}: ${score}/${totalMarks} (${percentage}%)`,
    });
    saveDb(db);

    res.json({
      attemptId: attempt.id,
      submittedAt: nowIso,
      showResults: exam.showResults,
      showCorrectAnswers: exam.showCorrectAnswers,
      ...(exam.showResults
        ? {
            score,
            totalMarks,
            percentage,
            passed,
            passingPercentage: exam.passingPercentage,
            review: review.map((r) => ({
              ...r,
              correctAnswer: exam.showCorrectAnswers ? r.correctAnswer : undefined,
              explanation: exam.showCorrectAnswers ? r.explanation : undefined,
            })),
          }
        : {}),
    });
  });

  app.get('/api/student/exams/attempts/:attemptId/result', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const attempt = db.assignedExamAttempts[req.params.attemptId];
    if (!attempt) return res.status(404).json({ error: 'Exam attempt not found' });

    const authRes = resolveAuthorizedStudentChildIds(req, db, attempt.studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    const exam = db.teacherExams[attempt.examId];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (!exam.showResults) {
      return res.json({
        attemptId: attempt.id,
        submittedAt: attempt.submittedAt,
        showResults: false,
        message: 'Results are pending release by your teacher.',
      });
    }

    res.json({
      attemptId: attempt.id,
      examTitle: exam.title,
      submittedAt: attempt.submittedAt,
      showResults: true,
      showCorrectAnswers: exam.showCorrectAnswers,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      passed: attempt.passed,
      passingPercentage: exam.passingPercentage,
      review: (attempt.review || []).map((r) => ({
        ...r,
        correctAnswer: exam.showCorrectAnswers ? r.correctAnswer : undefined,
        explanation: exam.showCorrectAnswers ? r.explanation : undefined,
      })),
    });
  });

  // =========================================================================
  // 5. LEVEL 2 PROGRESS, BACKEND-GRADED ASSESSMENT & PARENT OVERVIEW
  // =========================================================================
  app.get('/api/level2/progression', (_req, res) => {
    const db = getDb();
    res.json(db.level2ProgressionConfig);
  });

  app.post('/api/level2/progress', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (!db.featureFlags.level2Enabled) {
      return res.status(403).json({ error: 'Level 2 curriculum is currently disabled', featureDisabled: 'level2Enabled' });
    }
    const {
      childId,
      lessonId,
      completedSteps = [],
      completedActivityIds = [],
      correctCount = 0,
      mistakesCount = 0,
      timeSpentSeconds = 0,
    } = req.body as {
      childId?: string;
      lessonId?: string;
      completedSteps?: number[];
      completedActivityIds?: string[];
      correctCount?: number;
      mistakesCount?: number;
      timeSpentSeconds?: number;
    };

    if (!childId || !lessonId) return res.status(400).json({ error: 'childId and lessonId required' });
    const access = assertChildAccess(req, res, childId);
    if (!access) return;

    const lesson = getLevel2LessonById(lessonId);
    if (!lesson) return res.status(404).json({ error: 'Level 2 lesson not found' });

    if (access === 'untracked-sample') {
      return res.json({ saved: true, sample: true });
    }

    if (!access.level2Progress) access.level2Progress = {};
    const existing = access.level2Progress[lessonId];
    const nowIso = new Date().toISOString();
    const nextStatus =
      existing?.status === 'demonstrated'
        ? 'demonstrated'
        : completedActivityIds.length >= 2
          ? 'practicing'
          : 'learning';

    const mergedSteps = Array.from(
      new Set([...(existing?.completedSteps || []), ...completedSteps]),
    );
    const mergedActs = Array.from(
      new Set([...(existing?.completedActivityIds || []), ...completedActivityIds]),
    );

    const record: Level2LessonProgress = {
      lessonId,
      subject: lesson.subject,
      startedAt: existing?.startedAt || nowIso,
      completedSteps: mergedSteps,
      completedActivityIds: mergedActs,
      correctCount: Math.max(existing?.correctCount || 0, Number(correctCount) || 0),
      mistakesCount: Math.max(existing?.mistakesCount || 0, Number(mistakesCount) || 0),
      timeSpentSeconds: (existing?.timeSpentSeconds || 0) + Math.max(0, Number(timeSpentSeconds) || 0),
      lastScore: existing?.lastScore,
      lastTotal: existing?.lastTotal,
      attemptsCount: existing?.attemptsCount || 0,
      status: nextStatus,
      skillsDemonstrated: existing?.skillsDemonstrated || [],
      lastPracticedAt: nowIso,
      revisionDueAt: existing?.revisionDueAt,
      reviewIntervalStep: existing?.reviewIntervalStep ?? 0,
    };

    access.level2Progress[lessonId] = record;
    saveDb(db);
    res.json({ progress: record });
  });

  app.post('/api/level2/assessment/start', (req: AuthenticatedRequest, res) => {
    const db = getDb();
    if (!db.featureFlags.level2Enabled) {
      return res.status(403).json({ error: 'Level 2 curriculum is currently disabled', featureDisabled: 'level2Enabled' });
    }
    const { childId, lessonId, questionCount } = req.body as {
      childId?: string;
      lessonId?: string;
      questionCount?: number;
    };
    if (!childId || !lessonId) {
      return res.status(400).json({ error: 'childId and lessonId are required' });
    }
    const access = assertChildAccess(req, res, childId);
    if (!access) return;

    const lesson = getLevel2LessonById(lessonId);
    if (!lesson) return res.status(404).json({ error: 'Level 2 lesson not found' });

    const pool = getQuestionsForLevel2Lesson(lessonId);
    if (pool.length === 0) return res.status(404).json({ error: 'No questions for this Level 2 lesson' });

    const ind = pool.filter((q) => q.kind === 'independent');
    const prac = pool.filter((q) => q.kind === 'practice').sort(() => Math.random() - 0.5);
    const target = Math.min(pool.length, Math.max(4, questionCount || 5));
    const selected = [...ind.slice(0, 3), ...prac].slice(0, target);

    const attemptId = `l2_${crypto.randomBytes(6).toString('hex')}`;
    db.level2Attempts[attemptId] = {
      id: attemptId,
      childId,
      parentId: req.authSession?.user.id,
      lessonId,
      questionIds: selected.map((q) => q.id),
      submitted: false,
      createdAt: new Date().toISOString(),
    };
    saveDb(db);

    const sanitized = selected.map(({ correctOptionId: _c, ...rest }) => rest);
    res.json({
      attemptId,
      lessonId,
      totalQuestions: sanitized.length,
      passingPercentage: 75,
      questions: sanitized,
    });
  });

  app.post('/api/level2/assessment/submit', async (req: AuthenticatedRequest, res) => {
    const { attemptId, answers = {} } = req.body as {
      attemptId?: string;
      answers?: Record<string, string>;
    };
    const outcome = await runWithPgDbLock(`level2:${attemptId || 'none'}`, async (db) => {
      const attempt = attemptId ? db.level2Attempts[attemptId] : undefined;
      if (!attempt) return { status: 404, body: { error: 'Level 2 assessment attempt not found' } };

      if (attempt.parentId) {
        if (!req.authSession) return { status: 401, body: { error: 'Authentication required' } };
        const user = req.authSession.user;
        const isStudentOwner = (user.role === 'student' || user.role === 'child') && user.linkedChildId === attempt.childId;
        if (attempt.parentId !== user.id && !isStudentOwner && user.role !== 'super_admin') {
          return { status: 403, body: { error: 'Forbidden' } };
        }
      }

      if (attempt.submitted && attempt.result) {
        return { status: 200, body: { ...attempt.result, review: [], duplicateBlocked: true } };
      }

      const bankMap = new Map(LEVEL2_QUESTION_BANK.map((q) => [q.id, q]));
      let score = 0;

      const review = attempt.questionIds.map((qId) => {
        const q = bankMap.get(qId);
        const selectedId = typeof answers[qId] === 'string' ? answers[qId] : '';
        const validOpt = q?.options.some((o) => o.id === selectedId);
        const cleanSelected = validOpt ? selectedId : '';
        const isCorrect = Boolean(q && cleanSelected === q.correctOptionId);
        if (isCorrect) score++;
        return {
          questionId: qId,
          selectedOptionId: cleanSelected,
          correctOptionId: q?.correctOptionId || '',
          isCorrect,
          explanation: q?.explanation,
        };
      });

      const total = attempt.questionIds.length;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      const demonstrated = percentage >= 75;
      const now = Date.now();
      const child = db.children[attempt.childId];
      const prevStep = child?.level2Progress?.[attempt.lessonId]?.reviewIntervalStep ?? 0;

      const REVIEW_DAYS = [1, 3, 7];
      const nextStep = demonstrated ? Math.min(prevStep + 1, 2) : 0;
      const intervalHours = demonstrated ? REVIEW_DAYS[prevStep] * 24 : 12;
      const revisionDueAt = new Date(now + intervalHours * 3600_000).toISOString();
      const status: Level2LessonProgress['status'] = demonstrated ? 'demonstrated' : 'needs-revision';

      if (child) {
        const lesson = getLevel2LessonById(attempt.lessonId);
        if (!child.level2Progress) child.level2Progress = {};
        const existing = child.level2Progress[attempt.lessonId];
        const newlyDemonstrated = demonstrated && existing?.status !== 'demonstrated';
        child.level2Progress[attempt.lessonId] = {
          lessonId: attempt.lessonId,
          subject: lesson?.subject || 'arabic',
          startedAt: existing?.startedAt || new Date(now).toISOString(),
          completedSteps: existing?.completedSteps || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          completedActivityIds: existing?.completedActivityIds || [],
          correctCount: (existing?.correctCount || 0) + score,
          mistakesCount: (existing?.mistakesCount || 0) + (total - score),
          timeSpentSeconds: existing?.timeSpentSeconds || 0,
          lastScore: score,
          lastTotal: total,
          attemptsCount: (existing?.attemptsCount || 0) + 1,
          status,
          skillsDemonstrated: demonstrated && lesson ? [lesson.learningObjective.en] : existing?.skillsDemonstrated || [],
          lastPracticedAt: new Date(now).toISOString(),
          revisionDueAt,
          reviewIntervalStep: nextStep,
        };
        if (newlyDemonstrated) {
          child.stars = (child.stars || 0) + 3;
        }
      }

      const result = {
        score,
        totalQuestions: total,
        percentage,
        demonstrated,
        status,
        revisionDueAt,
        reviewIntervalStep: nextStep,
      };
      attempt.submitted = true;
      attempt.result = result;

      return { status: 200, body: { ...result, review } };
    });

    return res.status(outcome.status).json(outcome.body);
  });

  app.get('/api/parent/children/:childId/overview', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const access = assertChildAccess(req, res, req.params.childId);
    if (!access || access === 'untracked-sample') {
      if (access === 'untracked-sample') return res.status(404).json({ error: 'Child not found' });
      return;
    }

    const l2Map = access.level2Progress || {};
    const l2Entries = Object.values(l2Map);
    const l2Demonstrated = l2Entries.filter((p) => p.status === 'demonstrated').map((p) => p.lessonId);
    const l2Revision = l2Entries.filter((p) => p.status === 'needs-revision').map((p) => p.lessonId);

    // Assigned teacher exams and permitted released results (never exposing private teacher admin notes)
    const assignedExams = Object.values(db.examAssignments)
      .filter((a) => a.studentId === access.id)
      .sort((a, b) => (a.assignedAt || '').localeCompare(b.assignedAt || ''))
      .map((asgn) => {
        const exam = db.teacherExams[asgn.examId];
        if (!exam || exam.status === 'draft' || exam.status === 'suspended') return null;
        const attempts = Object.values(db.assignedExamAttempts)
          .filter((att) => att.assignmentId === asgn.id && att.studentId === access.id && att.status === 'submitted')
          .sort((a, b) => a.attemptNumber - b.attemptNumber || (a.submittedAt || '').localeCompare(b.submittedAt || ''));
        const latest = attempts[attempts.length - 1];
        return {
          assignmentId: asgn.id,
          examId: exam.id,
          examTitle: exam.title,
          subject: exam.subject,
          level: exam.level,
          teacherName: db.users[exam.teacherId]?.displayName || '',
          deadline: asgn.extendedDeadline || asgn.deadline,
          status: asgn.status,
          resultsReleased: exam.showResults,
          score: exam.showResults && latest ? latest.score : undefined,
          totalMarks: exam.showResults && latest ? latest.totalMarks : exam.totalMarks,
          percentage: exam.showResults && latest ? latest.percentage : undefined,
          passed: exam.showResults && latest ? latest.passed : undefined,
          submittedAt: latest?.submittedAt,
        };
      })
      .filter(Boolean);

    const assignedHomeworks = Object.values(db.homeworkSubmissions)
      .filter((s) => s.studentId === access.id)
      .map((s) => {
        const hw = db.homeworks[s.assignmentId];
        if (!hw || hw.status === 'draft' || hw.status === 'suspended' || hw.status === 'rejected') return null;
        const effectiveDeadline = Date.parse(s.extendedDeadline || hw.deadline);
        const effStatus =
          s.status !== 'completed' && s.status !== 'submitted' && Date.now() > effectiveDeadline
            ? 'overdue'
            : s.status;
        return {
          submissionId: s.id,
          assignmentId: hw.id,
          title: hw.title,
          subject: hw.subject,
          homeworkType: hw.homeworkType,
          teacherName: db.users[hw.teacherId]?.displayName || '',
          deadline: s.extendedDeadline || hw.deadline,
          status: effStatus,
          score: s.score,
          totalMarks: s.totalMarks,
          percentage: s.percentage,
          passed: s.passed,
          teacherFeedback: s.teacherFeedback,
          submittedAt: s.submittedAt,
        };
      })
      .filter(Boolean);

    res.json({
      child: {
        id: access.id,
        displayName: access.displayName,
        ageGroup: access.ageGroup,
        level: access.level,
        stars: access.stars,
        studentUserEmail: access.studentUserId ? db.users[access.studentUserId]?.email : undefined,
      },
      level2Summary: {
        totalStarted: l2Entries.length,
        demonstratedCount: l2Demonstrated.length,
        needsRevisionCount: l2Revision.length,
        demonstratedLessonIds: l2Demonstrated,
        needsRevisionLessonIds: l2Revision,
      },
      assignedExams,
      assignedHomeworks,
    });
  });
}
