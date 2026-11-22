import {
  AgeGroupId,
  FeatureFlags,
  HomeworkType,
  Language,
  QuestionQualityFlag,
  RecommendedAgeRange,
  TeacherPermission,
  TeacherQuestion,
  TeacherQuestionDifficulty,
  TeacherQuestionOption,
  TeacherQuestionType,
  TeacherSubject,
} from '../types/nonoland';

export const ALLOWED_RECOMMENDED_AGE_RANGES: RecommendedAgeRange[] = ['1-4', '1-2', '2-3', '3-4'];

export function sanitizeRecommendedAgeRange(raw: unknown, fallback: RecommendedAgeRange = '1-4'): RecommendedAgeRange {
  return ALLOWED_RECOMMENDED_AGE_RANGES.includes(raw as RecommendedAgeRange)
    ? (raw as RecommendedAgeRange)
    : fallback;
}

export const DEFAULT_TEACHER_PERMISSIONS: TeacherPermission[] = [
  'manage_classes',
  'manage_questions',
  'manage_exams',
  'assign_exams',
  'view_results',
  'bulk_import',
];

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  level2Enabled: false,
  teacherHomeworkEnabled: true,
  paidAssessmentsEnabled: true,
  certificatesEnabled: true,
  offlineLearningEnabled: true,
  newSubjectsEnabled: true,
  newGameModulesEnabled: true,
  requireTeacherContentApproval: false,
  quranWorldEnabled: true,
};

export const ALLOWED_HOMEWORK_TYPES: HomeworkType[] = [
  'multiple-choice',
  'picture-matching',
  'audio-activity',
  'reading-practice',
  'writing-practice',
  'math-exercise',
  'interactive-game',
  'teacher-questions',
];

export const POLICY_VERSION = '2026.1';

const COMPROMISED_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  'password1234',
  'password123456',
  'qwertyuiop12',
  'admin1234567',
  'letmein12345',
  'welcome12345',
  'nonoland1234',
  'nonoland2026',
  '000000000000',
  '111111111111',
  'abcdefghijkl',
]);

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

export function validateEmail(raw: unknown): { ok: boolean; normalized: string; error?: string } {
  const normalized = normalizeEmail(raw);
  if (!normalized) {
    return { ok: false, normalized: '', error: 'Email is required' };
  }
  if (normalized.length > 254) {
    return { ok: false, normalized, error: 'Email must be 254 characters or fewer' };
  }
  if (CONTROL_CHAR_REGEX.test(normalized) || /\s/.test(normalized)) {
    return { ok: false, normalized, error: 'Email contains invalid characters or spaces' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(normalized)) {
    return { ok: false, normalized, error: 'Invalid email address format' };
  }
  return { ok: true, normalized };
}

export function validateParentName(raw: unknown): { ok: boolean; clean: string; error?: string } {
  if (typeof raw !== 'string') {
    return { ok: false, clean: '', error: 'Parent name is required' };
  }
  const clean = raw.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) {
    return { ok: false, clean, error: 'Parent name must be at least 2 characters' };
  }
  if (clean.length > 80) {
    return { ok: false, clean, error: 'Parent name must be 80 characters or fewer' };
  }
  if (CONTROL_CHAR_REGEX.test(clean)) {
    return { ok: false, clean, error: 'Parent name contains invalid control characters' };
  }
  // Allow Arabic/Latin letters, combining marks, spaces, hyphens/dashes, apostrophes, dots
  const validNameRegex = /^[\p{L}\p{M}\s.'\p{Pd}]+$/u;
  if (!validNameRegex.test(clean)) {
    return { ok: false, clean, error: 'Parent name contains unsupported characters' };
  }
  return { ok: true, clean };
}

export function validatePassword(
  raw: unknown,
  email?: string,
  displayName?: string,
): {
  ok: boolean;
  strength: 'weak' | 'fair' | 'strong' | 'excellent';
  score: number;
  error?: string;
} {
  if (typeof raw !== 'string' || !raw) {
    return { ok: false, strength: 'weak', score: 0, error: 'Password is required' };
  }
  if (raw.length < 12) {
    return {
      ok: false,
      strength: 'weak',
      score: 1,
      error: 'Password must be at least 12 characters long',
    };
  }
  if (raw.length > 128) {
    return {
      ok: false,
      strength: 'weak',
      score: 1,
      error: 'Password must be 128 characters or fewer',
    };
  }
  const lower = raw.trim().toLowerCase();
  if (COMPROMISED_PASSWORDS.has(lower) || /^(.)\1+$/.test(raw)) {
    return {
      ok: false,
      strength: 'weak',
      score: 1,
      error: 'This password is too common or predictable. Choose a longer passphrase.',
    };
  }

  if (email) {
    const localPart = email.trim().toLowerCase().split('@')[0];
    if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
      return {
        ok: false,
        strength: 'weak',
        score: 1,
        error: 'Password must not contain your email address.',
      };
    }
  }
  if (displayName) {
    const cleanName = displayName.trim().toLowerCase();
    if (cleanName && cleanName.length >= 3 && lower.includes(cleanName)) {
      return {
        ok: false,
        strength: 'weak',
        score: 1,
        error: 'Password must not contain your display name.',
      };
    }
  }

  const hasLetter = /\p{L}/u.test(raw);
  const hasDigitOrSymbol = /\d|[^\p{L}\s]/u.test(raw);
  if (!hasLetter || !hasDigitOrSymbol) {
    return {
      ok: false,
      strength: 'weak',
      score: 1,
      error: 'Password must include both letters and at least one number or symbol.',
    };
  }

  let score = 2;
  if (raw.length >= 16) score += 1;
  if (/[a-z]/.test(raw) && /[A-Z]/.test(raw)) score += 1;
  if (/\d/.test(raw) && /[^A-Za-z0-9\s]/.test(raw)) score += 1;
  else if (/\d/.test(raw) || /[^A-Za-z0-9]/.test(raw) || /\s/.test(raw)) score += 1;

  const strength =
    score >= 5 ? 'excellent' : score >= 4 ? 'strong' : score >= 3 ? 'fair' : 'weak';

  return { ok: true, strength, score };
}

export function validateChildProfileInput(input: {
  displayName?: unknown;
  ageGroup?: unknown;
  language?: unknown;
  birthYear?: unknown;
  birthMonth?: unknown;
}): {
  ok: boolean;
  clean?: {
    displayName: string;
    ageGroup: AgeGroupId;
    language: Language;
    birthYear: number;
    birthMonth: number;
  };
  error?: string;
} {
  if (typeof input.displayName !== 'string') {
    return { ok: false, error: 'Child display name is required' };
  }
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');
  if (displayName.length < 1 || displayName.length > 50) {
    return { ok: false, error: 'Child name must be between 1 and 50 characters' };
  }
  if (CONTROL_CHAR_REGEX.test(displayName) || /[<>]/.test(displayName)) {
    return { ok: false, error: 'Child name contains invalid characters' };
  }

  const validAges: AgeGroupId[] = ['1-4'];
  const requestedAge = input.ageGroup ?? '1-4';
  if (!validAges.includes(requestedAge as AgeGroupId)) {
    return {
      ok: false,
      error: 'Only the unified Little Explorers (1–4 Years) stage is available',
    };
  }

  const lang: Language = input.language === 'en' ? 'en' : 'ar';

  const nowYear = new Date().getFullYear();
  const birthYear = Number(input.birthYear ?? nowYear - 3);
  const birthMonth = Number(input.birthMonth ?? 1);
  if (
    !Number.isInteger(birthYear) ||
    birthYear < nowYear - 4 ||
    birthYear > nowYear - 1
  ) {
    return { ok: false, error: 'Invalid birth year for Little Explorers (ages 1–4)' };
  }
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    return { ok: false, error: 'Invalid birth month (1–12)' };
  }

  return {
    ok: true,
    clean: {
      displayName,
      ageGroup: '1-4',
      language: lang,
      birthYear,
      birthMonth,
    },
  };
}

export function sanitizeShortText(raw: unknown, maxLen = 200): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(CONTROL_CHAR_REGEX, '').replace(/[<>]/g, '').trim().slice(0, maxLen);
}

export function sanitizeLongText(raw: unknown, maxLen = 1500): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(CONTROL_CHAR_REGEX, '').replace(/[<>]/g, '').trim().slice(0, maxLen);
}

export function isValidSafeUrl(raw: unknown): boolean {
  if (!raw) return true;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length > 500) return false;
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/uploads/')) {
    return !trimmed.includes('..');
  }
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidSafeId(raw: unknown, maxLen = 64): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLen) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

export const ALLOWED_TEACHER_SUBJECTS: TeacherSubject[] = [
  'arabic',
  'english',
  'math',
  'colors-shapes',
  'logic',
  'world-around-me',
  'colors-science',
  'numbers',
];

export const ALLOWED_TEACHER_QUESTION_TYPES: TeacherQuestionType[] = [
  'multiple-choice',
  'true-false',
  'picture-id',
  'audio-id',
  'matching',
  'fill-blank',
  'short-answer',
  'ordering',
];

export const ALLOWED_DIFFICULTIES: TeacherQuestionDifficulty[] = ['easy', 'medium', 'hard'];

export interface QuestionValidationInput {
  id?: unknown;
  subject?: unknown;
  level?: unknown;
  lessonId?: unknown;
  questionType?: unknown;
  promptAr?: unknown;
  promptEn?: unknown;
  imageUrl?: unknown;
  audioUrl?: unknown;
  audioText?: unknown;
  options?: unknown;
  correctOptionId?: unknown;
  correctOptionIds?: unknown;
  allowMultipleCorrect?: unknown;
  matchingPairs?: unknown;
  correctOrder?: unknown;
  acceptedAnswers?: unknown;
  marks?: unknown;
  difficulty?: unknown;
  explanation?: unknown;
  feedbackCorrect?: unknown;
  feedbackIncorrect?: unknown;
}

export function validateTeacherQuestionInput(
  input: QuestionValidationInput,
  validLessonIds: Set<string>,
  lessonLevelSubjectMap: Map<string, { level: 1 | 2; subject: string }>,
): { ok: boolean; error?: string } {
  const subject = input.subject as TeacherSubject;
  if (!ALLOWED_TEACHER_SUBJECTS.includes(subject)) {
    return { ok: false, error: 'Invalid subject selected' };
  }

  const level = Number(input.level);
  if (level !== 1 && level !== 2) {
    return { ok: false, error: 'Curriculum level must be 1 or 2' };
  }

  const lessonId = typeof input.lessonId === 'string' ? input.lessonId.trim() : '';
  if (!lessonId || !validLessonIds.has(lessonId)) {
    return { ok: false, error: 'Question must reference a valid existing lesson ID' };
  }
  const lessonMeta = lessonLevelSubjectMap.get(lessonId);
  if (lessonMeta && lessonMeta.level !== level) {
    return { ok: false, error: `Lesson ${lessonId} belongs to Level ${lessonMeta.level}, not Level ${level}` };
  }

  const qType = input.questionType as TeacherQuestionType;
  if (!ALLOWED_TEACHER_QUESTION_TYPES.includes(qType)) {
    return { ok: false, error: 'Unsupported question type' };
  }

  const promptAr = sanitizeLongText(input.promptAr, 600);
  const promptEn = sanitizeLongText(input.promptEn, 600);
  if (!promptAr && !promptEn) {
    return { ok: false, error: 'Question text (Arabic or English) cannot be empty' };
  }

  const marks = Number(input.marks);
  if (!Number.isFinite(marks) || marks <= 0 || marks > 20) {
    return { ok: false, error: 'Marks must be a positive number between 0.5 and 20' };
  }

  const difficulty = input.difficulty as TeacherQuestionDifficulty;
  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    return { ok: false, error: 'Difficulty must be easy, medium, or hard' };
  }

  if (!isValidSafeUrl(input.imageUrl)) {
    return { ok: false, error: 'Invalid or unsafe image URL' };
  }
  if (!isValidSafeUrl(input.audioUrl)) {
    return { ok: false, error: 'Invalid or unsafe audio URL' };
  }

  if (qType === 'picture-id' && !sanitizeShortText(input.imageUrl, 500) && !promptAr.match(/\p{Emoji}/u)) {
    // Allow emoji/visual cue or imageUrl, check at least visual/prompt exists
  }

  if (qType === 'audio-id' && !sanitizeShortText(input.audioUrl, 500) && !sanitizeShortText(input.audioText, 300)) {
    return { ok: false, error: 'Audio Identification questions require audioUrl or audioText' };
  }

  if (
    qType === 'multiple-choice' ||
    qType === 'true-false' ||
    qType === 'picture-id' ||
    qType === 'audio-id'
  ) {
    const opts = Array.isArray(input.options) ? (input.options as TeacherQuestionOption[]) : [];
    const minOpts = qType === 'true-false' ? 2 : 2;
    if (opts.length < minOpts || opts.length > 6) {
      return { ok: false, error: 'Choice questions must have between 2 and 6 options' };
    }

    const optIds = new Set<string>();
    const optLabels = new Set<string>();
    for (const opt of opts) {
      const id = sanitizeShortText(opt?.id, 32);
      const ar = sanitizeShortText(opt?.textAr, 200);
      const en = sanitizeShortText(opt?.textEn, 200);
      const vis = sanitizeShortText(opt?.visual, 64);
      if (!id || (!ar && !en && !vis)) {
        return { ok: false, error: 'Every option must have an ID and non-empty text or visual' };
      }
      if (optIds.has(id)) {
        return { ok: false, error: 'Duplicate option IDs are not allowed' };
      }
      optIds.add(id);
      const normLabel = `${ar.toLowerCase()}|${en.toLowerCase()}|${vis.toLowerCase()}`;
      if (optLabels.has(normLabel)) {
        return { ok: false, error: 'Duplicate answer options are not allowed' };
      }
      optLabels.add(normLabel);
    }

    if (input.allowMultipleCorrect) {
      const ids = Array.isArray(input.correctOptionIds) ? input.correctOptionIds : [];
      if (ids.length === 0 || ids.some((c) => !optIds.has(String(c)))) {
        return { ok: false, error: 'All correctOptionIds must match available options' };
      }
    } else {
      const correctId = typeof input.correctOptionId === 'string' ? input.correctOptionId.trim() : '';
      if (!correctId || !optIds.has(correctId)) {
        return { ok: false, error: 'Correct answer must belong to the available options' };
      }
    }
  } else if (qType === 'matching') {
    const pairs = Array.isArray(input.matchingPairs) ? input.matchingPairs : [];
    if (pairs.length < 2 || pairs.length > 6) {
      return { ok: false, error: 'Matching questions must have 2 to 6 pairs' };
    }
    const lefts = new Set<string>();
    for (const p of pairs) {
      const l = sanitizeShortText(p?.left, 120);
      const r = sanitizeShortText(p?.right, 120);
      if (!l || !r) return { ok: false, error: 'Each matching pair requires both left and right values' };
      if (lefts.has(l.toLowerCase())) return { ok: false, error: 'Duplicate matching keys are not allowed' };
      lefts.add(l.toLowerCase());
    }
  } else if (qType === 'ordering') {
    const order = Array.isArray(input.correctOrder) ? input.correctOrder : [];
    if (order.length < 2 || order.length > 8) {
      return { ok: false, error: 'Ordering questions must have 2 to 8 sequence items' };
    }
    if (order.some((x) => !sanitizeShortText(x, 120))) {
      return { ok: false, error: 'All ordering items must be non-empty' };
    }
  } else if (qType === 'fill-blank' || qType === 'short-answer') {
    const accepted = Array.isArray(input.acceptedAnswers) ? input.acceptedAnswers : [];
    if (accepted.length === 0 || accepted.some((a) => !sanitizeShortText(a, 120))) {
      return { ok: false, error: 'Fill-in-the-blank and short-answer questions require at least one accepted answer' };
    }
  }

  return { ok: true };
}

export function validateExamScheduleAndConfig(input: {
  titleAr?: unknown;
  titleEn?: unknown;
  passingPercentage?: unknown;
  durationMinutes?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  allowedAttempts?: unknown;
}): { ok: boolean; error?: string } {
  const titleAr = sanitizeShortText(input.titleAr, 160);
  const titleEn = sanitizeShortText(input.titleEn, 160);
  if (!titleAr && !titleEn) {
    return { ok: false, error: 'Exam title is required' };
  }
  const pass = Number(input.passingPercentage);
  if (!Number.isFinite(pass) || pass < 1 || pass > 100) {
    return { ok: false, error: 'Passing percentage must be between 1 and 100' };
  }
  const duration = Number(input.durationMinutes);
  if (!Number.isFinite(duration) || duration < 1 || duration > 180) {
    return { ok: false, error: 'Duration must be between 1 and 180 minutes' };
  }
  const attempts = Number(input.allowedAttempts);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) {
    return { ok: false, error: 'Allowed attempts must be an integer between 1 and 20' };
  }
  const startMs = Date.parse(String(input.startDate || ''));
  const endMs = Date.parse(String(input.endDate || ''));
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { ok: false, error: 'Valid startDate and endDate are required' };
  }
  if (startMs >= endMs) {
    return { ok: false, error: 'Start date must be strictly before end date' };
  }
  return { ok: true };
}

export function validateHomeworkInput(input: {
  titleAr?: unknown;
  titleEn?: unknown;
  homeworkType?: unknown;
  subject?: unknown;
  level?: unknown;
  startDate?: unknown;
  deadline?: unknown;
  maxAttempts?: unknown;
}): { ok: boolean; error?: string } {
  const titleAr = sanitizeShortText(input.titleAr, 160);
  const titleEn = sanitizeShortText(input.titleEn, 160);
  if (!titleAr && !titleEn) {
    return { ok: false, error: 'Homework title (Arabic or English) is required' };
  }
  if (!ALLOWED_HOMEWORK_TYPES.includes(input.homeworkType as HomeworkType)) {
    return { ok: false, error: 'Invalid homework type' };
  }
  const subj = String(input.subject || '');
  if (subj !== 'comprehensive' && !ALLOWED_TEACHER_SUBJECTS.includes(subj as TeacherSubject)) {
    return { ok: false, error: 'Invalid homework subject' };
  }
  const level = Number(input.level);
  if (level !== 1 && level !== 2) {
    return { ok: false, error: 'Homework level must be 1 or 2' };
  }
  const startMs = Date.parse(String(input.startDate || ''));
  const deadlineMs = Date.parse(String(input.deadline || ''));
  if (Number.isNaN(startMs) || Number.isNaN(deadlineMs)) {
    return { ok: false, error: 'Valid startDate and deadline are required' };
  }
  if (startMs >= deadlineMs) {
    return { ok: false, error: 'Assignment startDate must be before deadline' };
  }
  const maxAttempts = Number(input.maxAttempts ?? 3);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    return { ok: false, error: 'Max attempts must be an integer between 1 and 20' };
  }
  return { ok: true };
}

function normalizeSubjectFamily(s: string): string {
  if (s === 'numbers' || s === 'math') return 'math';
  if (s === 'colors' || s === 'colors-shapes' || s === 'colors-science') return 'colors-shapes';
  return s;
}

export function checkQuestionQuality(
  q: Pick<
    TeacherQuestion,
    | 'id'
    | 'subject'
    | 'level'
    | 'lessonId'
    | 'questionType'
    | 'promptAr'
    | 'promptEn'
    | 'imageUrl'
    | 'audioUrl'
    | 'audioText'
    | 'options'
    | 'marks'
  >,
  existingQuestions: TeacherQuestion[],
  lessonLevelSubjectMap: Map<string, { level: 1 | 2; subject: string }>,
): QuestionQualityFlag[] {
  const flags: QuestionQualityFlag[] = [];

  if (!q.promptAr?.trim() || !q.promptEn?.trim()) {
    flags.push({
      code: 'MISSING_AR_OR_EN',
      severity: 'warning',
      message: 'Bilingual parity check: question is missing either Arabic or English text.',
    });
  }

  if (q.questionType === 'audio-id' && !q.audioUrl && !q.audioText) {
    flags.push({
      code: 'MISSING_AUDIO_CUE',
      severity: 'error',
      message: 'Audio question is missing both audioUrl and speech audioText.',
    });
  }

  if (q.questionType === 'picture-id' && !q.imageUrl && !q.options?.some((o) => o.visual)) {
    flags.push({
      code: 'MISSING_VISUAL',
      severity: 'warning',
      message: 'Picture identification question has no imageUrl or visual emoji cues.',
    });
  }

  if (q.imageUrl && !isValidSafeUrl(q.imageUrl)) {
    flags.push({
      code: 'BROKEN_MEDIA_REF',
      severity: 'error',
      message: 'Invalid or unsafe imageUrl reference.',
    });
  }
  if (q.audioUrl && !isValidSafeUrl(q.audioUrl)) {
    flags.push({
      code: 'BROKEN_MEDIA_REF',
      severity: 'error',
      message: 'Invalid or unsafe audioUrl reference.',
    });
  }

  if (
    (q.questionType === 'multiple-choice' || q.questionType === 'picture-id' || q.questionType === 'audio-id') &&
    (q.options?.length || 0) < 3
  ) {
    flags.push({
      code: 'LOW_OPTION_COUNT',
      severity: 'warning',
      message: 'Recommended at least 3 choices for this question type.',
    });
  }

  const seenOpts = new Set<string>();
  for (const opt of q.options || []) {
    const key = `${(opt.textAr || '').trim().toLowerCase()}|${(opt.textEn || '').trim().toLowerCase()}`;
    if (key !== '|' && seenOpts.has(key)) {
      flags.push({
        code: 'DUPLICATE_OPTIONS',
        severity: 'error',
        message: 'Two answer options appear identical.',
      });
      break;
    }
    seenOpts.add(key);
  }

  if (!Number.isFinite(q.marks) || q.marks <= 0 || q.marks > 10) {
    flags.push({
      code: 'INVALID_MARKS',
      severity: 'warning',
      message: 'Marks value is unusually high (>10) or invalid; verify grading weight.',
    });
  }

  const lessonMeta = lessonLevelSubjectMap.get(q.lessonId);
  if (
    lessonMeta &&
    normalizeSubjectFamily(lessonMeta.subject) !== normalizeSubjectFamily(q.subject)
  ) {
    flags.push({
      code: 'SUBJECT_LESSON_MISMATCH',
      severity: 'warning',
      message: `Selected lesson (${q.lessonId}, subject ${lessonMeta.subject}) differs from question subject (${q.subject}).`,
    });
  }

  const normPrompt = (q.promptAr || q.promptEn || '').trim().toLowerCase();
  if (
    normPrompt &&
    existingQuestions.some(
      (other) =>
        other.id !== q.id &&
        other.active &&
        other.lessonId === q.lessonId &&
        (other.promptAr || other.promptEn || '').trim().toLowerCase() === normPrompt,
    )
  ) {
    flags.push({
      code: 'DUPLICATE_PROMPT',
      severity: 'warning',
      message: 'A very similar or identical question already exists for this lesson.',
    });
  }

  return flags;
}

export function validateStrictAdminPassword(
  raw: unknown,
  email?: string,
  displayName?: string,
): { ok: boolean; error?: string } {
  const base = validatePassword(raw, email, displayName);
  if (!base.ok) return base;
  const str = String(raw);
  if (!/[a-z]/.test(str)) {
    return {
      ok: false,
      error: 'Admin password must include at least one lowercase English letter (a-z).',
    };
  }
  if (!/[A-Z]/.test(str)) {
    return {
      ok: false,
      error: 'Admin password must include at least one uppercase English letter (A-Z).',
    };
  }
  if (!/\d/.test(str)) {
    return {
      ok: false,
      error: 'Admin password must include at least one number (0-9).',
    };
  }
  if (!/[^A-Za-z0-9\s]/.test(str)) {
    return {
      ok: false,
      error: 'Admin password must include at least one special symbol (e.g. !@#$%).',
    };
  }
  return { ok: true };
}

export function formatApiErrorMessage(
  status: number,
  data: { error?: string; code?: string } | null | undefined,
  language: Language,
  fallbackEn: string,
  fallbackAr: string,
): string {
  const code = data?.code || '';
  const rawErr = data?.error || '';
  if (
    code === 'DB_UNAVAILABLE' ||
    code === 'DB_COMMIT_FAILED' ||
    (status === 503 && /database unavailable|database commit failed/i.test(rawErr))
  ) {
    return language === 'ar'
      ? 'قاعدة البيانات غير متاحة حالياً. تم إيقاف العملية لحماية سلامة البيانات، يرجى التحقق من اتصال قاعدة البيانات والمحاولة مرة أخرى.'
      : 'Database unavailable. Operation paused safely to protect data integrity. Please verify database connectivity and retry.';
  }
  return rawErr || (language === 'ar' ? fallbackAr : fallbackEn);
}

export function sanitizeQuranNote(raw: unknown, maxLength = 280): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(CONTROL_CHAR_REGEX, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function clampQuranRepeatCount(raw: unknown, fallback = 2): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(5, Math.round(num)));
}

export function clampQuranDailyMinutes(raw: unknown, fallback = 15): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(5, Math.min(60, Math.round(num)));
}

export function isSafeQuranAudioUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith('/assets/quran/') && /\.(mp3|m4a|ogg|wav)$/i.test(trimmed) && !trimmed.includes('..')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

