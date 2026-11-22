import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import multer from 'multer';
import { getLevel1LessonById } from '../src/data/level1Curriculum';
import {
  ALL_CURRICULUM_LESSONS_INDEX,
  getLevel2LessonById,
} from '../src/data/level2Curriculum';
import type {
  ContentGovernanceStatus,
  ContentVersionEntry,
  FeatureFlags,
  HomeworkAssignment,
  HomeworkAttachment,
  HomeworkStudentSubmission,
  HomeworkSubmissionStatus,
  HomeworkType,
  TeacherExam,
  TeacherQuestion,
  TeacherSubject,
} from '../src/types/nonoland';
import {
  ALLOWED_TEACHER_SUBJECTS,
  checkQuestionQuality,
  DEFAULT_FEATURE_FLAGS,
  isValidSafeId,
  sanitizeLongText,
  sanitizeShortText,
  validateHomeworkInput,
} from '../src/utils/validation';
import type {
  AuthenticatedRequest,
  ServerDb,
  StoredChildRecord,
  StoredHomeworkAttachment,
} from './dbTypes';
import { appendSecurityLog, getClientIp, hasTeacherPermission } from './security';
import { replaceAllDbFromRestorePg, runWithPgDbLock } from './pgStore';

export interface GovernanceHomeworkDeps {
  app: express.Application;
  getDb: () => ServerDb;
  setDb: (next: ServerDb) => void;
  saveDb: (db: ServerDb) => void;
  requireAuth: express.RequestHandler;
  requireAdminPermission: (permission: string) => express.RequestHandler;
}

const HOMEWORK_UPLOADS_DIR = path.join(process.cwd(), 'server_uploads', 'homework');
const MAX_HW_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

const hwMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_HW_UPLOAD_BYTES, files: 1 },
});

function hasValidAttachmentSignature(ext: string, buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // Block executable headers (MZ, ELF, shebang, HTML/script)
  if (buf[0] === 0x4d && buf[1] === 0x5a) return false;
  if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return false;
  if (buf[0] === 0x23 && buf[1] === 0x21) return false;

  if (ext === '.png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === '.webp') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (ext === '.pdf') {
    return buf.subarray(0, 4).toString('ascii') === '%PDF';
  }
  if (ext === '.mp3') {
    return (
      buf.subarray(0, 3).toString('ascii') === 'ID3' ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    );
  }
  if (ext === '.wav') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WAVE'
    );
  }
  return false;
}

function buildLessonRegistry(db: ServerDb) {
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

function getTeacherStudentIds(db: ServerDb, teacherId: string): Set<string> {
  const ids = new Set<string>();
  for (const cls of Object.values(db.classes)) {
    if (cls.teacherId === teacherId && cls.active) {
      for (const sid of cls.studentIds) ids.add(sid);
    }
  }
  return ids;
}

function resolveStudentChildren(
  req: AuthenticatedRequest,
  db: ServerDb,
  requestedChildId?: string,
): { ok: true; childIds: string[] } | { ok: false; status: number; error: string } {
  const user = req.authSession?.user;
  if (!user) return { ok: false, status: 401, error: 'Authentication required' };

  if (user.role === 'student' || user.role === 'child') {
    if (!user.linkedChildId || !db.children[user.linkedChildId]) {
      return { ok: false, status: 403, error: 'No child profile linked to student account' };
    }
    if (requestedChildId && requestedChildId !== user.linkedChildId) {
      return { ok: false, status: 403, error: 'Forbidden: students can only access their own homework' };
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

function computeSubmissionEffectiveStatus(
  sub: HomeworkStudentSubmission,
  hw: HomeworkAssignment,
  nowMs: number,
): HomeworkSubmissionStatus {
  if (sub.status === 'completed' || sub.status === 'submitted') return sub.status;
  const effectiveDeadline = Date.parse(sub.extendedDeadline || hw.deadline);
  if (!Number.isNaN(effectiveDeadline) && nowMs > effectiveDeadline) {
    return 'overdue';
  }
  return sub.status;
}

function appendContentVersion(
  target: { version: number; versions?: ContentVersionEntry[] },
  editorId: string,
  editorName: string,
  reason: string,
  snapshotObj: Record<string, unknown>,
) {
  if (!Array.isArray(target.versions)) target.versions = [];
  const cleanSnapshot = JSON.parse(
    JSON.stringify({ ...snapshotObj, versions: undefined }),
  ) as Record<string, unknown>;
  target.versions.push({
    version: target.version,
    editedBy: editorId,
    editedByName: editorName,
    editedAt: new Date().toISOString(),
    reason: sanitizeShortText(reason, 200) || 'Content update',
    snapshot: cleanSnapshot,
  });
  if (target.versions.length > 30) {
    target.versions = target.versions.slice(-30);
  }
}

export function registerGovernanceAndHomeworkRoutes(deps: GovernanceHomeworkDeps): void {
  const { app, getDb, setDb, saveDb, requireAuth, requireAdminPermission } = deps;

  function requireTeacher(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
    if (!req.authSession) return res.status(401).json({ error: 'Authentication required' });
    const u = req.authSession.user;
    if (u.role !== 'teacher' || u.status !== 'active') {
      return res.status(403).json({ error: 'Active Teacher account required' });
    }
    next();
  }

  function requireHomeworkFeatureEnabled(
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const db = getDb();
    if (!db.featureFlags.teacherHomeworkEnabled) {
      return res.status(403).json({
        error: 'Teacher homework feature is currently disabled by administrator',
        featureDisabled: 'teacherHomeworkEnabled',
      });
    }
    next();
  }

  // =========================================================================
  // 1. FEATURE FLAGS (PUBLIC READ + ADMIN CONTROL)
  // =========================================================================
  app.get('/api/config/features', (_req, res) => {
    const db = getDb();
    res.json({ featureFlags: db.featureFlags });
  });

  app.put(
    '/api/admin/feature-flags',
    requireAdminPermission('manage_exam_config'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const body = req.body as Partial<FeatureFlags>;
      const keys = Object.keys(DEFAULT_FEATURE_FLAGS) as Array<keyof FeatureFlags>;
      const changed: string[] = [];

      for (const k of keys) {
        if (typeof body[k] === 'boolean' && db.featureFlags[k] !== body[k]) {
          db.featureFlags[k] = body[k]!;
          changed.push(`${k}=${String(body[k])}`);
        }
      }

      if (changed.length > 0) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'FEATURE_FLAG_CHANGE',
          actorId: req.authSession?.user.id || 'admin-pin',
          role: req.authSession?.user.role || 'super_admin',
          ip: getClientIp(req),
          summary: `Updated feature flags: ${changed.join(', ')}`,
        });
        saveDb(db);
      }

      res.json({ featureFlags: db.featureFlags, changed });
    },
  );

  // =========================================================================
  // 2. CONTENT APPROVAL WORKFLOW, QUALITY AUDIT & VERSION HISTORY
  // =========================================================================
  app.post(
    '/api/admin/questions/quality-audit',
    requireAdminPermission('manage_questions'),
    (req, res) => {
      const db = getDb();
      const { levelSubjectMap } = buildLessonRegistry(db);
      const allQs = Object.values(db.teacherQuestions).filter((q) => q.active);
      let flaggedCount = 0;

      const audited = allQs.map((q) => {
        const flags = checkQuestionQuality(q, allQs, levelSubjectMap);
        q.qualityFlags = flags;
        if (flags.length > 0) flaggedCount++;
        return {
          id: q.id,
          teacherId: q.teacherId,
          lessonId: q.lessonId,
          subject: q.subject,
          promptAr: q.promptAr,
          promptEn: q.promptEn,
          approvalStatus: q.approvalStatus || 'published',
          qualityFlags: flags,
        };
      });

      saveDb(db);
      void req;
      res.json({
        totalChecked: allQs.length,
        flaggedCount,
        questions: audited.filter((a) => a.qualityFlags.length > 0),
        allResults: audited,
      });
    },
  );

  app.get(
    '/api/admin/content/review-queue',
    requireAdminPermission('manage_lessons'),
    (req, res) => {
      const db = getDb();
      const statusFilter = req.query.status ? String(req.query.status) : '';
      const { levelSubjectMap } = buildLessonRegistry(db);
      const allQs = Object.values(db.teacherQuestions).filter((q) => q.active);

      const questions = allQs
        .filter((q) => {
          const st = q.approvalStatus || 'published';
          if (statusFilter) return st === statusFilter;
          return true;
        })
        .map((q) => ({
          ...q,
          teacherName: db.users[q.teacherId]?.displayName || q.teacherId,
          qualityFlags: q.qualityFlags || checkQuestionQuality(q, allQs, levelSubjectMap),
        }));

      const exams = Object.values(db.teacherExams)
        .filter((e) => (statusFilter ? e.status === statusFilter : true))
        .map((e) => ({
          ...e,
          teacherName: db.users[e.teacherId]?.displayName || e.teacherId,
        }));

      const homeworks = Object.values(db.homeworks)
        .filter((h) => (statusFilter ? h.status === statusFilter : true))
        .map((h) => ({
          ...h,
          teacherName: db.users[h.teacherId]?.displayName || h.teacherId,
        }));

      res.json({ questions, exams, homeworks });
    },
  );

  app.patch(
    '/api/admin/content/:kind/:id/review',
    requireAdminPermission('manage_lessons'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const { kind, id } = req.params;
      const { status, feedback } = req.body as {
        status?: ContentGovernanceStatus;
        feedback?: string;
      };

      const allowed: ContentGovernanceStatus[] = [
        'draft',
        'pending-review',
        'approved',
        'rejected',
        'published',
        'suspended',
        'archived',
      ];
      if (!status || !allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid governance status' });
      }

      const reviewerId = req.authSession?.user.id || 'admin-pin';
      const reviewerName = req.authSession?.user.displayName || 'Administrator';
      const cleanFeedback = sanitizeLongText(feedback, 500);
      const nowIso = new Date().toISOString();

      if (kind === 'question') {
        const q = db.teacherQuestions[id];
        if (!q) return res.status(404).json({ error: 'Question not found' });
        appendContentVersion(q, reviewerId, reviewerName, `Admin review -> ${status}`, q as unknown as Record<string, unknown>);
        q.version += 1;
        q.approvalStatus = status;
        if (cleanFeedback) q.adminFeedback = cleanFeedback;
        q.reviewedBy = reviewerId;
        q.reviewedAt = nowIso;
        q.updatedAt = nowIso;
        appendSecurityLog(db.securityLogs, {
          eventType: 'CONTENT_REVIEW',
          actorId: reviewerId,
          role: req.authSession?.user.role || 'super_admin',
          ip: getClientIp(req),
          summary: `Reviewed question ${q.id} -> ${status}`,
        });
        saveDb(db);
        return res.json({ item: q });
      }

      if (kind === 'exam') {
        const ex = db.teacherExams[id];
        if (!ex) return res.status(404).json({ error: 'Exam not found' });
        appendContentVersion(ex, reviewerId, reviewerName, `Admin review -> ${status}`, ex as unknown as Record<string, unknown>);
        ex.version += 1;
        ex.status = status;
        if (cleanFeedback) ex.adminReviewNote = cleanFeedback;
        ex.reviewedBy = reviewerId;
        ex.reviewedAt = nowIso;
        ex.updatedAt = nowIso;
        appendSecurityLog(db.securityLogs, {
          eventType: 'CONTENT_REVIEW',
          actorId: reviewerId,
          role: req.authSession?.user.role || 'super_admin',
          ip: getClientIp(req),
          summary: `Reviewed exam ${ex.id} -> ${status}`,
        });
        saveDb(db);
        return res.json({ item: ex });
      }

      if (kind === 'homework') {
        const hw = db.homeworks[id];
        if (!hw) return res.status(404).json({ error: 'Homework not found' });
        appendContentVersion(hw, reviewerId, reviewerName, `Admin review -> ${status}`, hw as unknown as Record<string, unknown>);
        hw.version += 1;
        hw.status = status;
        if (cleanFeedback) hw.adminFeedback = cleanFeedback;
        hw.reviewedBy = reviewerId;
        hw.reviewedAt = nowIso;
        hw.updatedAt = nowIso;
        appendSecurityLog(db.securityLogs, {
          eventType: 'CONTENT_REVIEW',
          actorId: reviewerId,
          role: req.authSession?.user.role || 'super_admin',
          ip: getClientIp(req),
          summary: `Reviewed homework ${hw.id} -> ${status}`,
        });
        saveDb(db);
        return res.json({ item: hw });
      }

      return res.status(400).json({ error: 'Invalid content kind. Use question, exam, or homework.' });
    },
  );

  app.get(
    '/api/content/:kind/:id/versions',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const user = req.authSession!.user;
      const { kind, id } = req.params;
      const isAdmin = ['super_admin', 'content_admin', 'curriculum_manager'].includes(user.role);

      let item: (TeacherQuestion | TeacherExam | HomeworkAssignment) | undefined;
      if (kind === 'question') item = db.teacherQuestions[id];
      else if (kind === 'exam') item = db.teacherExams[id];
      else if (kind === 'homework') item = db.homeworks[id];
      else return res.status(400).json({ error: 'Invalid content kind' });

      if (!item) return res.status(404).json({ error: 'Content item not found' });
      if (!isAdmin && item.teacherId !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json({
        id: item.id,
        currentVersion: item.version,
        versions: item.versions || [],
      });
    },
  );

  // Teacher submits question / exam / homework for admin review (or updates & records version)
  app.post(
    '/api/teacher/content/:kind/:id/submit-review',
    requireTeacher,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const { kind, id } = req.params;

      if (kind === 'question') {
        const q = db.teacherQuestions[id];
        if (!q || q.teacherId !== teacher.id) return res.status(404).json({ error: 'Question not found' });
        const { levelSubjectMap } = buildLessonRegistry(db);
        q.qualityFlags = checkQuestionQuality(
          q,
          Object.values(db.teacherQuestions),
          levelSubjectMap,
        );
        q.approvalStatus = 'pending-review';
        q.updatedAt = new Date().toISOString();
        saveDb(db);
        return res.json({ question: q });
      }
      if (kind === 'exam') {
        const ex = db.teacherExams[id];
        if (!ex || ex.teacherId !== teacher.id) return res.status(404).json({ error: 'Exam not found' });
        ex.status = 'pending-review';
        ex.updatedAt = new Date().toISOString();
        saveDb(db);
        return res.json({ exam: ex });
      }
      if (kind === 'homework') {
        const hw = db.homeworks[id];
        if (!hw || hw.teacherId !== teacher.id) return res.status(404).json({ error: 'Homework not found' });
        hw.status = 'pending-review';
        hw.updatedAt = new Date().toISOString();
        saveDb(db);
        return res.json({ homework: hw });
      }
      return res.status(400).json({ error: 'Invalid content kind' });
    },
  );

  // =========================================================================
  // 3. TEACHER HOMEWORK: ATTACHMENTS, CRUD, ASSIGN, TRACKING & GRADING
  // =========================================================================
  app.post(
    '/api/teacher/homework/attachments',
    requireTeacher,
    requireHomeworkFeatureEnabled,
    hwMemoryUpload.single('file'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Attachment file is required' });

      const ext = path.extname(file.originalname || '').toLowerCase();
      const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.pdf']);
      if (!allowedExt.has(ext)) {
        return res.status(400).json({
          error: 'Only .png, .jpg, .webp, .mp3, .wav, and .pdf files are permitted.',
        });
      }
      if (!hasValidAttachmentSignature(ext, file.buffer)) {
        return res.status(400).json({ error: 'File signature failed security verification.' });
      }

      if (!fs.existsSync(HOMEWORK_UPLOADS_DIR)) {
        fs.mkdirSync(HOMEWORK_UPLOADS_DIR, { recursive: true });
      }
      const attId = `attf_${crypto.randomBytes(6).toString('hex')}`;
      const safeName = `${attId}${ext}`;
      const storedPath = path.join(HOMEWORK_UPLOADS_DIR, safeName);
      fs.writeFileSync(storedPath, file.buffer);

      const kind: HomeworkAttachment['kind'] =
        ext === '.mp3' || ext === '.wav' ? 'audio' : ext === '.pdf' ? 'document' : 'image';

      const stored: StoredHomeworkAttachment = {
        id: attId,
        fileName: sanitizeShortText(path.basename(file.originalname), 100) || safeName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        kind,
        url: `/api/homework/attachments/${attId}`,
        uploadedBy: teacher.id,
        uploadedAt: new Date().toISOString(),
        storedPath,
      };
      db.homeworkAttachments[attId] = stored;
      saveDb(db);

      const { storedPath: _p, ...publicMeta } = stored;
      res.status(201).json({ attachment: publicMeta });
    },
  );

  // Authorized download/serve endpoint for uploaded homework media (prevents unauthenticated leaks)
  app.get('/api/homework/attachments/:attId', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authSession!.user;
    const att = db.homeworkAttachments[req.params.attId];
    if (!att || !fs.existsSync(att.storedPath)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const isAdmin = ['super_admin', 'content_admin', 'curriculum_manager'].includes(user.role);
    const isUploader = att.uploadedBy === user.id;
    let isAuthorizedStudentOrParent = false;
    if (!isAdmin && !isUploader) {
      const childIds =
        (user.role === 'student' || user.role === 'child') && user.linkedChildId
          ? [user.linkedChildId]
          : Object.values(db.children)
              .filter((c) => c.parentId === user.id || (user.familyId && c.familyId === user.familyId))
              .map((c) => c.id);
      isAuthorizedStudentOrParent = Object.values(db.homeworkSubmissions).some(
        (sub) =>
          childIds.includes(sub.studentId) &&
          db.homeworks[sub.assignmentId]?.attachments?.some((a) => a.id === att.id),
      );
    }

    if (!isAdmin && !isUploader && !isAuthorizedStudentOrParent) {
      return res.status(403).json({ error: 'Forbidden: you are not authorized to access this media' });
    }

    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.fileName.replace(/"/g, '')}"`);
    fs.createReadStream(att.storedPath).pipe(res);
  });

  app.get('/api/teacher/homework', requireTeacher, requireHomeworkFeatureEnabled, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    const nowMs = Date.now();

    const homeworks = Object.values(db.homeworks)
      .filter((h) => h.teacherId === teacher.id)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((h) => {
        const subs = Object.values(db.homeworkSubmissions).filter((s) => s.assignmentId === h.id);
        return {
          ...h,
          stats: {
            assigned: subs.length,
            opened: subs.filter((s) => Boolean(s.openedAt)).length,
            started: subs.filter((s) => Boolean(s.startedAt)).length,
            submitted: subs.filter((s) => s.status === 'submitted' || s.status === 'completed').length,
            completed: subs.filter((s) => s.status === 'completed').length,
            overdue: subs.filter((s) => computeSubmissionEffectiveStatus(s, h, nowMs) === 'overdue').length,
          },
        };
      });

    res.json({ homeworks });
  });

  app.post('/api/teacher/homework', requireTeacher, requireHomeworkFeatureEnabled, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const teacher = req.authSession!.user;
    if (!hasTeacherPermission(teacher, 'assign_exams') && !hasTeacherPermission(teacher, 'manage_exams')) {
      return res.status(403).json({ error: 'Forbidden: missing teacher assignment permission' });
    }

    const body = req.body as Record<string, unknown>;
    const titleObj = (body.title as Record<string, unknown>) || {};
    const instObj = (body.instructions as Record<string, unknown>) || {};

    const check = validateHomeworkInput({
      titleAr: titleObj.ar ?? body.titleAr,
      titleEn: titleObj.en ?? body.titleEn,
      homeworkType: body.homeworkType,
      subject: body.subject,
      level: body.level,
      startDate: body.startDate,
      deadline: body.deadline,
      maxAttempts: body.maxAttempts ?? 3,
    });
    if (!check.ok) return res.status(400).json({ error: check.error });

    const { validIds } = buildLessonRegistry(db);
    const lessonIds = Array.isArray(body.lessonIds)
      ? Array.from(new Set(body.lessonIds.map((x) => String(x)).filter((id) => validIds.has(id))))
      : [];
    if (lessonIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one valid curriculum lesson ID' });
    }

    const questionIds = Array.isArray(body.questionIds)
      ? Array.from(new Set(body.questionIds.map((x) => String(x))))
      : [];
    const questionSnapshots: Record<string, TeacherQuestion> = {};
    for (const qId of questionIds) {
      const q = db.teacherQuestions[qId];
      if (!q || !q.active || q.teacherId !== teacher.id) {
        return res.status(400).json({ error: `Invalid or unauthorized questionId: ${qId}` });
      }
      questionSnapshots[qId] = JSON.parse(JSON.stringify(q)) as TeacherQuestion;
    }

    // Validate attachments belong to this teacher or public approved assets
    const rawAttachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds.map(String) : [];
    const attachments: HomeworkAttachment[] = [];
    for (const aid of rawAttachmentIds) {
      const stored = db.homeworkAttachments[aid];
      if (!stored || stored.uploadedBy !== teacher.id) {
        return res.status(400).json({ error: `Invalid or unauthorized attachment ID: ${aid}` });
      }
      const { storedPath: _p, ...meta } = stored;
      attachments.push(meta);
    }

    // Validate target classes & students strictly belong to this teacher
    const authorizedStudents = getTeacherStudentIds(db, teacher.id);
    const targetStudents = new Set<string>();
    const assignedClassIds: string[] = [];

    for (const cid of Array.isArray(body.classIds) ? body.classIds.map(String) : []) {
      const cls = db.classes[cid];
      if (!cls || cls.teacherId !== teacher.id) {
        return res.status(403).json({ error: `Forbidden: class ${cid} is not assigned to you` });
      }
      assignedClassIds.push(cid);
      cls.studentIds.forEach((sid) => targetStudents.add(sid));
    }

    for (const sid of Array.isArray(body.studentIds) ? body.studentIds.map(String) : []) {
      if (!authorizedStudents.has(sid)) {
        return res.status(403).json({ error: `Forbidden: student ${sid} is not in your classes` });
      }
      targetStudents.add(sid);
    }

    const publishRequested = body.publish === true || body.status === 'published';
    let finalStatus: ContentGovernanceStatus = 'draft';
    if (publishRequested) {
      finalStatus = db.featureFlags.requireTeacherContentApproval ? 'pending-review' : 'published';
    } else if (body.status === 'pending-review') {
      finalStatus = 'pending-review';
    }

    const nowIso = new Date().toISOString();
    const hwId = `hw_${crypto.randomBytes(6).toString('hex')}`;
    const homework: HomeworkAssignment = {
      id: hwId,
      teacherId: teacher.id,
      title: {
        ar: sanitizeShortText(titleObj.ar ?? body.titleAr, 160),
        en: sanitizeShortText(titleObj.en ?? body.titleEn, 160),
      },
      instructions: {
        ar: sanitizeLongText(instObj.ar ?? body.instructionsAr ?? '', 800),
        en: sanitizeLongText(instObj.en ?? body.instructionsEn ?? '', 800),
      },
      subject: String(body.subject) as TeacherSubject | 'comprehensive',
      level: Number(body.level) === 2 ? 2 : 1,
      lessonIds,
      homeworkType: body.homeworkType as HomeworkType,
      questionIds,
      questionSnapshots,
      attachments,
      assignedClassIds,
      assignedStudentIds: Array.from(targetStudents),
      startDate: new Date(String(body.startDate)).toISOString(),
      deadline: new Date(String(body.deadline)).toISOString(),
      maxAttempts: Number(body.maxAttempts ?? 3),
      passingPercentage: Math.min(100, Math.max(1, Number(body.passingPercentage ?? 70))),
      status: finalStatus,
      version: 1,
      versions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.homeworks[hwId] = homework;

    // Create initial submission tracking records (deduplicated per student)
    for (const sid of homework.assignedStudentIds) {
      const subId = `hws_${crypto.randomBytes(6).toString('hex')}`;
      db.homeworkSubmissions[subId] = {
        id: subId,
        assignmentId: hwId,
        homeworkVersion: homework.version,
        studentId: sid,
        teacherId: teacher.id,
        attemptCount: 0,
        status: 'assigned',
        answers: {},
      };
    }

    appendSecurityLog(db.securityLogs, {
      eventType: 'HOMEWORK_ACTION',
      actorId: teacher.id,
      role: teacher.role,
      ip: getClientIp(req),
      summary: `Created homework ${hwId} (${homework.homeworkType}, status=${finalStatus}, students=${homework.assignedStudentIds.length})`,
    });
    saveDb(db);

    res.status(201).json({
      homework,
      requiresAdminApproval: db.featureFlags.requireTeacherContentApproval && publishRequested,
    });
  });

  app.post(
    '/api/teacher/homework/:id/assign',
    requireTeacher,
    requireHomeworkFeatureEnabled,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const hw = db.homeworks[req.params.id];
      if (!hw) return res.status(404).json({ error: 'Homework not found' });
      if (hw.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });

      const { studentIds = [], classIds = [], publishNow } = req.body as {
        studentIds?: string[];
        classIds?: string[];
        publishNow?: boolean;
      };

      const authorizedStudents = getTeacherStudentIds(db, teacher.id);
      const targets = new Set<string>();
      for (const cid of Array.isArray(classIds) ? classIds : []) {
        const cls = db.classes[cid];
        if (!cls || cls.teacherId !== teacher.id) {
          return res.status(403).json({ error: `Forbidden: class ${cid} is not yours` });
        }
        if (!hw.assignedClassIds.includes(cid)) hw.assignedClassIds.push(cid);
        cls.studentIds.forEach((sid) => targets.add(sid));
      }
      for (const sid of Array.isArray(studentIds) ? studentIds : []) {
        if (!authorizedStudents.has(sid)) {
          return res.status(403).json({ error: `Forbidden: student ${sid} is not in your classes` });
        }
        targets.add(sid);
      }

      if (targets.size === 0) {
        return res.status(400).json({ error: 'Select at least one authorized student or class' });
      }

      let addedCount = 0;
      let skippedDuplicates = 0;
      for (const sid of targets) {
        const exists = Object.values(db.homeworkSubmissions).some(
          (s) => s.assignmentId === hw.id && s.studentId === sid,
        );
        if (exists) {
          skippedDuplicates++;
          continue;
        }
        const subId = `hws_${crypto.randomBytes(6).toString('hex')}`;
        db.homeworkSubmissions[subId] = {
          id: subId,
          assignmentId: hw.id,
          homeworkVersion: hw.version,
          studentId: sid,
          teacherId: teacher.id,
          attemptCount: 0,
          status: 'assigned',
          answers: {},
        };
        if (!hw.assignedStudentIds.includes(sid)) hw.assignedStudentIds.push(sid);
        addedCount++;
      }

      if (publishNow) {
        if (db.featureFlags.requireTeacherContentApproval && hw.status !== 'approved' && hw.status !== 'published') {
          hw.status = 'pending-review';
        } else {
          hw.status = 'published';
        }
      }
      hw.updatedAt = new Date().toISOString();
      saveDb(db);

      res.status(201).json({
        homework: hw,
        addedCount,
        skippedDuplicates,
      });
    },
  );

  app.get(
    '/api/teacher/homework/:id/tracking',
    requireTeacher,
    requireHomeworkFeatureEnabled,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const hw = db.homeworks[req.params.id];
      if (!hw) return res.status(404).json({ error: 'Homework not found' });
      if (hw.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });

      const nowMs = Date.now();
      const rows = Object.values(db.homeworkSubmissions)
        .filter((s) => s.assignmentId === hw.id)
        .map((s) => ({
          ...s,
          effectiveStatus: computeSubmissionEffectiveStatus(s, hw, nowMs),
          studentName: db.children[s.studentId]?.displayName || s.studentId,
        }));

      res.json({ homework: hw, tracking: rows });
    },
  );

  app.patch(
    '/api/teacher/homework/submissions/:subId/extend',
    requireTeacher,
    requireHomeworkFeatureEnabled,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const sub = db.homeworkSubmissions[req.params.subId];
      if (!sub) return res.status(404).json({ error: 'Submission record not found' });
      if (sub.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });

      const { extendedDeadline, reason } = req.body as {
        extendedDeadline?: string;
        reason?: string;
      };
      const extMs = Date.parse(String(extendedDeadline || ''));
      if (Number.isNaN(extMs)) {
        return res.status(400).json({ error: 'Valid extendedDeadline ISO date is required' });
      }
      sub.extendedDeadline = new Date(extMs).toISOString();
      sub.extensionReason = sanitizeShortText(reason || 'Teacher extension', 200);
      if (sub.status === 'overdue') sub.status = 'assigned';

      appendSecurityLog(db.securityLogs, {
        eventType: 'HOMEWORK_ACTION',
        actorId: teacher.id,
        role: teacher.role,
        ip: getClientIp(req),
        summary: `Extended homework deadline for student ${sub.studentId} on ${sub.assignmentId}`,
      });
      saveDb(db);
      res.json({ submission: sub });
    },
  );

  app.patch(
    '/api/teacher/homework/submissions/:subId/grade',
    requireTeacher,
    requireHomeworkFeatureEnabled,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const teacher = req.authSession!.user;
      const sub = db.homeworkSubmissions[req.params.subId];
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      if (sub.teacherId !== teacher.id) return res.status(403).json({ error: 'Forbidden' });

      const { percentage, teacherFeedback, markCompleted } = req.body as {
        percentage?: number;
        teacherFeedback?: string;
        markCompleted?: boolean;
      };

      if (percentage !== undefined) {
        const pct = Math.min(100, Math.max(0, Math.round(Number(percentage))));
        sub.percentage = pct;
        sub.score = pct;
        sub.totalMarks = 100;
        const hw = db.homeworks[sub.assignmentId];
        sub.passed = pct >= (hw?.passingPercentage ?? 70);
      }
      if (teacherFeedback !== undefined) {
        sub.teacherFeedback = sanitizeLongText(teacherFeedback, 500);
      }
      if (markCompleted !== false) {
        sub.status = 'completed';
        sub.completedAt = new Date().toISOString();
      }
      sub.gradedAt = new Date().toISOString();
      saveDb(db);
      res.json({ submission: sub });
    },
  );

  // =========================================================================
  // 4. STUDENT HOMEWORK: VIEW, OPEN, SAVE PROGRESS, SUBMIT (DEADLINE/EDIT GUARD)
  // =========================================================================
  app.get('/api/student/homework', requireAuth, requireHomeworkFeatureEnabled, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const authRes = resolveStudentChildren(
      req,
      db,
      req.query.childId ? String(req.query.childId) : undefined,
    );
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    const childSet = new Set(authRes.childIds);
    const nowMs = Date.now();
    const newAssignments: unknown[] = [];
    const inProgress: unknown[] = [];
    const submitted: unknown[] = [];
    const completed: unknown[] = [];
    const overdue: unknown[] = [];

    for (const sub of Object.values(db.homeworkSubmissions)) {
      if (!childSet.has(sub.studentId)) continue;
      const hw = db.homeworks[sub.assignmentId];
      if (!hw) continue;

      // Never expose unapproved/draft/suspended/rejected homework to students
      const isPublishedOrApproved = db.featureFlags.requireTeacherContentApproval
        ? hw.status === 'approved' || hw.status === 'published'
        : hw.status === 'published' || hw.status === 'approved';
      if (!isPublishedOrApproved) continue;

      const startMs = Date.parse(hw.startDate);
      if (!Number.isNaN(startMs) && nowMs < startMs) continue;

      const effectiveStatus = computeSubmissionEffectiveStatus(sub, hw, nowMs);
      const lessonTitles = hw.lessonIds.map((lid) => {
        const l2 = getLevel2LessonById(lid);
        if (l2) return { id: lid, title: l2.title };
        const l1 = getLevel1LessonById(lid);
        if (l1) return { id: lid, title: l1.title };
        return { id: lid, title: { ar: lid, en: lid } };
      });

      const questions = hw.questionIds
        .map((qid) => hw.questionSnapshots?.[qid] || db.teacherQuestions[qid])
        .filter(Boolean)
        .map((q) => ({
          id: q!.id,
          subject: q!.subject,
          level: q!.level,
          lessonId: q!.lessonId,
          questionType: q!.questionType,
          promptAr: q!.promptAr,
          promptEn: q!.promptEn,
          imageUrl: q!.imageUrl,
          audioUrl: q!.audioUrl,
          audioText: q!.audioText,
          options: q!.options,
          allowMultipleCorrect: Boolean(q!.allowMultipleCorrect),
          matchingLefts: q!.matchingPairs?.map((p) => ({ id: p.id, left: p.left })) || [],
          matchingRights: q!.matchingPairs?.map((p) => p.right) || [],
          shuffledOrderItems: q!.correctOrder ? [...q!.correctOrder].sort() : [],
          marks: q!.marks,
        }));

      const card = {
        submissionId: sub.id,
        assignmentId: hw.id,
        studentId: sub.studentId,
        studentName: db.children[sub.studentId]?.displayName || '',
        teacherName: db.users[hw.teacherId]?.displayName || '',
        title: hw.title,
        instructions: hw.instructions,
        subject: hw.subject,
        level: hw.level,
        homeworkType: hw.homeworkType,
        lessonTitles,
        attachments: hw.attachments,
        questions,
        startDate: hw.startDate,
        deadline: sub.extendedDeadline || hw.deadline,
        hasExtension: Boolean(sub.extendedDeadline),
        maxAttempts: hw.maxAttempts,
        attemptCount: sub.attemptCount,
        effectiveStatus,
        savedAnswers: sub.answers,
        textResponse: sub.textResponse,
        score: sub.score,
        totalMarks: sub.totalMarks,
        percentage: sub.percentage,
        passed: sub.passed,
        teacherFeedback: sub.teacherFeedback,
        submittedAt: sub.submittedAt,
        completedAt: sub.completedAt,
      };

      if (effectiveStatus === 'completed') completed.push(card);
      else if (effectiveStatus === 'submitted') submitted.push(card);
      else if (effectiveStatus === 'overdue') overdue.push(card);
      else if (effectiveStatus === 'in-progress') inProgress.push(card);
      else newAssignments.push(card);
    }

    res.json({ newAssignments, inProgress, submitted, completed, overdue });
  });

  app.post('/api/student/homework/:assignmentId/open', requireAuth, requireHomeworkFeatureEnabled, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const hw = db.homeworks[req.params.assignmentId];
    if (!hw) return res.status(404).json({ error: 'Homework assignment not found' });

    const { studentId } = req.body as { studentId?: string };
    const authRes = resolveStudentChildren(req, db, studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    const sub = Object.values(db.homeworkSubmissions).find(
      (s) => s.assignmentId === hw.id && authRes.childIds.includes(s.studentId),
    );
    if (!sub) return res.status(403).json({ error: 'Homework is not assigned to this student' });

    const nowIso = new Date().toISOString();
    if (!sub.openedAt) sub.openedAt = nowIso;
    if (sub.status === 'assigned') sub.status = 'opened';
    saveDb(db);
    res.json({ submission: sub });
  });

  app.post('/api/student/homework/:assignmentId/save', requireAuth, requireHomeworkFeatureEnabled, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const hw = db.homeworks[req.params.assignmentId];
    if (!hw) return res.status(404).json({ error: 'Homework not found' });

    const { studentId, answers, textResponse } = req.body as {
      studentId?: string;
      answers?: Record<string, string | string[] | Record<string, string>>;
      textResponse?: string;
    };
    const authRes = resolveStudentChildren(req, db, studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    const sub = Object.values(db.homeworkSubmissions).find(
      (s) => s.assignmentId === hw.id && authRes.childIds.includes(s.studentId),
    );
    if (!sub) return res.status(403).json({ error: 'Homework is not assigned to this student' });

    if (sub.status === 'submitted' || sub.status === 'completed') {
      return res.status(409).json({ error: 'Cannot modify a submitted homework assignment without authorization' });
    }

    const nowMs = Date.now();
    const effectiveDeadline = Date.parse(sub.extendedDeadline || hw.deadline);
    if (nowMs > effectiveDeadline) {
      sub.status = 'overdue';
      saveDb(db);
      return res.status(403).json({ error: 'Homework deadline has passed without an active extension' });
    }

    const nowIso = new Date().toISOString();
    if (!sub.openedAt) sub.openedAt = nowIso;
    if (!sub.startedAt) sub.startedAt = nowIso;
    sub.status = 'in-progress';
    if (answers && typeof answers === 'object') {
      sub.answers = { ...sub.answers, ...answers };
    }
    if (textResponse !== undefined) {
      sub.textResponse = sanitizeLongText(textResponse, 2000);
    }
    saveDb(db);
    res.json({ submission: sub });
  });

  app.post('/api/student/homework/:assignmentId/submit', requireAuth, requireHomeworkFeatureEnabled, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const hw = db.homeworks[req.params.assignmentId];
    if (!hw) return res.status(404).json({ error: 'Homework assignment not found' });

    const { studentId, answers = {}, textResponse } = req.body as {
      studentId?: string;
      answers?: Record<string, string | string[] | Record<string, string>>;
      textResponse?: string;
    };
    const authRes = resolveStudentChildren(req, db, studentId);
    if ('error' in authRes) return res.status(authRes.status).json({ error: authRes.error });

    const sub = Object.values(db.homeworkSubmissions).find(
      (s) => s.assignmentId === hw.id && authRes.childIds.includes(s.studentId),
    );
    if (!sub) return res.status(403).json({ error: 'Homework is not assigned to this student' });

    if (sub.status === 'submitted' || sub.status === 'completed') {
      return res.status(409).json({
        error: 'Duplicate submission blocked: homework has already been submitted.',
        duplicateBlocked: true,
      });
    }

    const nowMs = Date.now();
    const effectiveDeadline = Date.parse(sub.extendedDeadline || hw.deadline);
    if (nowMs > effectiveDeadline) {
      sub.status = 'overdue';
      saveDb(db);
      return res.status(403).json({
        error: 'Submission rejected: homework deadline has passed without an extension.',
      });
    }

    const nowIso = new Date().toISOString();
    if (!sub.openedAt) sub.openedAt = nowIso;
    if (!sub.startedAt) sub.startedAt = nowIso;
    sub.attemptCount = (sub.attemptCount || 0) + 1;
    sub.answers = { ...sub.answers, ...answers };
    if (textResponse !== undefined) sub.textResponse = sanitizeLongText(textResponse, 2000);
    sub.submittedAt = nowIso;

    // Auto-grade attached teacher questions if present
    if (hw.questionIds.length > 0) {
      let score = 0;
      let totalMarks = 0;
      for (const qId of hw.questionIds) {
        const q = hw.questionSnapshots?.[qId] || db.teacherQuestions[qId];
        if (!q) continue;
        totalMarks += q.marks;
        const ans = sub.answers[qId];
        let ok = false;
        if (q.questionType === 'fill-blank' || q.questionType === 'short-answer') {
          const norm = String(ans || '').trim().toLowerCase();
          ok = Boolean(norm && q.acceptedAnswers?.some((a) => a.trim().toLowerCase() === norm));
        } else {
          ok = Boolean(q.correctOptionId && String(ans || '') === q.correctOptionId);
        }
        if (ok) score += q.marks;
      }
      const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 100;
      sub.score = score;
      sub.totalMarks = totalMarks;
      sub.percentage = pct;
      sub.passed = pct >= hw.passingPercentage;
      sub.status = 'completed';
      sub.completedAt = nowIso;
    } else if (hw.homeworkType === 'writing-practice' || hw.homeworkType === 'reading-practice') {
      // Teacher can optionally review or student completes practice response
      sub.status = 'submitted';
    } else {
      sub.score = 100;
      sub.totalMarks = 100;
      sub.percentage = 100;
      sub.passed = true;
      sub.status = 'completed';
      sub.completedAt = nowIso;
    }

    const child = db.children[sub.studentId];
    if (child) {
      child.stars = (child.stars || 0) + 3;
      child.totalLearningMinutes = (child.totalLearningMinutes || 0) + 5;
    }

    appendSecurityLog(db.securityLogs, {
      eventType: 'HOMEWORK_ACTION',
      actorId: req.authSession?.user.id,
      role: req.authSession?.user.role,
      ip: getClientIp(req),
      summary: `Student ${sub.studentId} submitted homework ${hw.id} (status=${sub.status})`,
    });
    saveDb(db);
    res.json({ submission: sub });
  });

  // =========================================================================
  // 5. IDEMPOTENT OFFLINE ACTIVITY SYNC & PARENT FEEDBACK READ
  // =========================================================================
  app.post('/api/student/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
    const initialDb = getDb();
    if (!initialDb.featureFlags.offlineLearningEnabled) {
      return res.status(403).json({
        error: 'Offline sync is currently disabled by administrator',
        featureDisabled: 'offlineLearningEnabled',
      });
    }

    const { childId, items = [] } = req.body as {
      childId?: string;
      items?: Array<{
        idempotencyKey?: string;
        kind?: 'game-attempt' | 'level1-progress' | 'level2-progress';
        payload?: Record<string, unknown>;
      }>;
    };

    const outcome = await runWithPgDbLock(`sync:${childId || req.authSession!.user.id}`, async (db) => {
      const authRes = resolveStudentChildren(req, db, childId);
      if ('error' in authRes) return { status: authRes.status, body: { error: authRes.error } };

      const targetChildId = authRes.childIds[0];
      const child = db.children[targetChildId] as StoredChildRecord | undefined;
      if (!child) return { status: 404, body: { error: 'Child profile not found' } };

      const syncedKeys: string[] = [];
      const duplicateKeys: string[] = [];

      for (const item of Array.isArray(items) ? items.slice(0, 100) : []) {
        const key = typeof item.idempotencyKey === 'string' ? item.idempotencyKey.trim() : '';
        if (!key || !isValidSafeId(key, 80)) continue;

        if (db.processedSyncKeys[key]) {
          duplicateKeys.push(key);
          continue;
        }

        const payload = item.payload || {};
        if (item.kind === 'game-attempt') {
          const stars = Math.min(5, Math.max(0, Number(payload.starsEarned ?? 1)));
          child.stars = (child.stars || 0) + stars;
          const mins = Math.min(60, Math.max(0, Math.round(Number(payload.durationSeconds ?? 60) / 60)));
          child.totalLearningMinutes = (child.totalLearningMinutes || 0) + mins;
          const actId = sanitizeShortText(payload.activityId, 64);
          if (actId && !child.completedActivityIds.includes(actId)) {
            child.completedActivityIds.push(actId);
          }
        }

        db.processedSyncKeys[key] = {
          childId: child.id,
          processedAt: new Date().toISOString(),
          summary: `${item.kind || 'activity'} synced`,
        };
        syncedKeys.push(key);
      }

      if (syncedKeys.length > 0) {
        appendSecurityLog(db.securityLogs, {
          eventType: 'OFFLINE_SYNC',
          actorId: req.authSession?.user.id,
          role: req.authSession?.user.role,
          ip: getClientIp(req),
          summary: `Synced ${syncedKeys.length} offline items for child ${child.id} (deduped ${duplicateKeys.length})`,
        });
      }

      return {
        status: 200,
        body: {
          syncedKeys,
          duplicateKeys,
          totalStars: child.stars,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  });

  // =========================================================================
  // 6. ADMIN AUDIT TRAIL (FILTERED), INTEGRITY CHECKS, BACKUP & RESTORE
  // =========================================================================
  app.get('/api/admin/audit-logs', requireAdminPermission('view_security_logs'), (req, res) => {
    const db = getDb();
    const eventType = req.query.eventType ? String(req.query.eventType) : '';
    const actionType = req.query.actionType ? String(req.query.actionType) : '';
    const recordType = req.query.recordType ? String(req.query.recordType) : '';
    const actorId = req.query.actorId ? String(req.query.actorId) : '';
    const actorRole = req.query.actorRole ? String(req.query.actorRole) : '';
    const outcome = req.query.outcome ? String(req.query.outcome) : '';
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const limit = Math.min(500, Math.max(10, Number(req.query.limit || 150)));

    const logs = db.securityLogs
      .filter((l) => {
        if (eventType && l.eventType !== eventType) return false;
        if (actionType && l.actionType !== actionType) return false;
        if (recordType && l.recordType !== recordType) return false;
        if (actorId && l.actorId !== actorId) return false;
        if (actorRole && (l.actorRole || l.role) !== actorRole) return false;
        if (outcome && l.outcome !== outcome) return false;
        if (q) {
          const hay = `${l.summary} ${l.eventType} ${l.actionType || ''} ${l.recordType || ''} ${l.recordId || ''} ${l.reason || ''} ${l.actorId || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, limit);

    res.json({ logs, totalCount: db.securityLogs.length });
  });

  app.get('/api/admin/ops/integrity', requireAdminPermission('view_security_logs'), (_req, res) => {
    const db = getDb();
    const issues: string[] = [];

    for (const [normEmail, uid] of Object.entries(db.emailIndex)) {
      if (!db.users[uid]) issues.push(`Orphan emailIndex pointer: ${normEmail} -> ${uid}`);
    }
    for (const child of Object.values(db.children)) {
      if (child.parentId && !db.users[child.parentId]) {
        issues.push(`Orphan child ${child.id}: missing parent ${child.parentId}`);
      }
    }
    for (const cls of Object.values(db.classes)) {
      if (!db.users[cls.teacherId]) {
        issues.push(`Class ${cls.id} references missing teacher ${cls.teacherId}`);
      }
      for (const sid of cls.studentIds) {
        if (!db.children[sid]) issues.push(`Class ${cls.id} references missing child ${sid}`);
      }
    }
    for (const sub of Object.values(db.homeworkSubmissions)) {
      if (!db.homeworks[sub.assignmentId]) {
        issues.push(`Homework submission ${sub.id} references missing homework ${sub.assignmentId}`);
      }
    }

    res.json({
      healthy: issues.length === 0,
      checkedAt: new Date().toISOString(),
      issueCount: issues.length,
      issues,
      counts: {
        users: Object.keys(db.users).length,
        children: Object.keys(db.children).length,
        classes: Object.keys(db.classes).length,
        teacherQuestions: Object.keys(db.teacherQuestions).length,
        teacherExams: Object.keys(db.teacherExams).length,
        homeworks: Object.keys(db.homeworks).length,
        homeworkSubmissions: Object.keys(db.homeworkSubmissions).length,
        auditLogs: db.securityLogs.length,
      },
      operationalMetrics: db.operationalMetrics,
    });
  });

  app.get('/api/admin/ops/backup', requireAdminPermission('view_security_logs'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    // Never export raw active session tokens or password hashes without explicit notice — redact active session tokens!
    const snapshot: Record<string, unknown> = {
      ...db,
      sessions: {}, // active session tokens excluded for zero session hijack risk
      backupExportedAt: new Date().toISOString(),
    };

    appendSecurityLog(db.securityLogs, {
      eventType: 'BACKUP_RESTORE',
      actorId: req.authSession?.user.id || 'admin-pin',
      role: req.authSession?.user.role || 'super_admin',
      ip: getClientIp(req),
      summary: 'Exported sanitized database backup snapshot',
    });
    saveDb(db);

    res.json({ backup: snapshot });
  });

  app.post('/api/admin/ops/restore', requireAdminPermission('view_security_logs'), async (req: AuthenticatedRequest, res) => {
    const currentDb = getDb();
    const { backup } = req.body as { backup?: Partial<ServerDb> };
    if (!backup || typeof backup !== 'object' || !backup.users || !backup.children || !backup.examConfig) {
      return res.status(400).json({ error: 'Invalid backup payload: required collections missing' });
    }

    const restored: ServerDb = {
      ...currentDb,
      ...backup,
      sessions: currentDb.sessions, // preserve current active admin/user sessions cleanly
      featureFlags: {
        ...DEFAULT_FEATURE_FLAGS,
        ...(backup.featureFlags || {}),
      },
      operationalMetrics: currentDb.operationalMetrics,
    };

    appendSecurityLog(restored.securityLogs, {
      eventType: 'BACKUP_RESTORE',
      actorId: req.authSession?.user.id || 'admin-pin',
      role: req.authSession?.user.role || 'super_admin',
      ip: getClientIp(req),
      summary: 'Restored database collections from verified backup snapshot',
    });
    await replaceAllDbFromRestorePg(restored);
    setDb(restored);
    res.json({ restored: true, restoredAt: new Date().toISOString() });
  });
}
