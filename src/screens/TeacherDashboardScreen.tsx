import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { TeacherHomeworkPanel } from '../components/TeacherHomeworkPanel';
import { useNonoLand } from '../context/NonoLandContext';
import { t } from '../i18n/translations';
import type {
  AgeGroupId,
  Classroom,
  ExamStatus,
  LocalizedText,
  StoredAgeGroupId,
  TeacherExam,
  TeacherQuestion,
  TeacherQuestionDifficulty,
  TeacherQuestionType,
  TeacherSubject,
} from '../types/nonoland';
import { getSafeStageShortLabel, UNIFIED_STAGE_ID } from '../utils/ageAdaptation';
import {
  ALLOWED_TEACHER_QUESTION_TYPES,
  ALLOWED_TEACHER_SUBJECTS,
  validatePassword,
} from '../utils/validation';

type TeacherSection =
  | 'overview'
  | 'classes'
  | 'students'
  | 'homework'
  | 'create-exam'
  | 'my-exams'
  | 'question-bank'
  | 'assign-exams'
  | 'exam-results'
  | 'draft-exams'
  | 'published-exams'
  | 'student-performance'
  | 'profile';

interface LessonOption {
  id: string;
  level: 1 | 2;
  subject: string;
  title: LocalizedText;
}

interface TeacherStudentRow {
  id: string;
  displayName: string;
  ageGroup: StoredAgeGroupId;
  language: string;
  level: number;
  stars: number;
  classes: string[];
  level1MasteredCount: number;
  level2MasteredCount: number;
  completedTeacherExams: number;
  averageExamPercentage: number | null;
}

export const TeacherDashboardScreen: React.FC = () => {
  const { authSession, language, navigate, logoutParent, refreshAuthSession } = useNonoLand();
  const [section, setSection] = useState<TeacherSection>('overview');
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Server data states
  const [dashboard, setDashboard] = useState<{
    stats: Record<string, number>;
    recentResults: Array<{
      attemptId: string;
      examId: string;
      examTitle: LocalizedText;
      studentName: string;
      percentage: number;
      passed: boolean;
      submittedAt: string;
    }>;
    recentActivity: Array<{ id: string; summary: string; createdAt: string }>;
  } | null>(null);
  const [classes, setClasses] = useState<Array<Classroom & { students: Array<{ id: string; displayName: string; ageGroup: StoredAgeGroupId }> }>>([]);
  const [students, setStudents] = useState<TeacherStudentRow[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [questions, setQuestions] = useState<TeacherQuestion[]>([]);
  const [exams, setExams] = useState<Array<TeacherExam & { assignmentCount?: number; completedCount?: number }>>([]);
  const [results, setResults] = useState<Array<{
    id: string;
    examId: string;
    examTitle: LocalizedText;
    studentName: string;
    className?: string;
    score?: number;
    totalMarks?: number;
    percentage?: number;
    passed?: boolean;
    submittedAt?: string;
  }>>([]);

  // Student filters & drilldown
  const [studentSearch, setStudentSearch] = useState('');
  const [studentLevelFilter, setStudentLevelFilter] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentDrilldown, setStudentDrilldown] = useState<{
    student: { id: string; displayName: string; ageGroup: string; level: number; stars: number };
    level1Progress: Record<string, { status: string; lastScore?: number; lastTotal?: number }>;
    level2Progress: Record<string, { status: string; lastScore?: number; lastTotal?: number }>;
    examAttempts: Array<{ attemptId: string; examTitle: LocalizedText; score?: number; totalMarks?: number; percentage?: number; passed?: boolean; submittedAt?: string }>;
  } | null>(null);

  // Question Bank filters & builder state
  const [qFilterSubject, setQFilterSubject] = useState('');
  const [qFilterLevel, setQFilterLevel] = useState('');
  const [qFilterType, setQFilterType] = useState('');
  const [qSearch, setQSearch] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<TeacherQuestion | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [qSubject, setQSubject] = useState<TeacherSubject>('arabic');
  const [qLevel, setQLevel] = useState<1 | 2>(1);
  const [qLessonId, setQLessonId] = useState('L1-AR01');
  const [qType, setQType] = useState<TeacherQuestionType>('multiple-choice');
  const [qPromptAr, setQPromptAr] = useState('');
  const [qPromptEn, setQPromptEn] = useState('');
  const [qAudioText, setQAudioText] = useState('');
  const [qImageUrl, setQImageUrl] = useState('');
  const [qOptAAr, setQOptAAr] = useState('');
  const [qOptAEn, setQOptAEn] = useState('');
  const [qOptBAr, setQOptBAr] = useState('');
  const [qOptBEn, setQOptBEn] = useState('');
  const [qOptCAr, setQOptCAr] = useState('');
  const [qOptCEn, setQOptCEn] = useState('');
  const [qCorrectId, setQCorrectId] = useState('a');
  const [qAcceptedAnswers, setQAcceptedAnswers] = useState('');
  const [qMatchingRaw, setQMatchingRaw] = useState('أ => 🦁 أسد\nب => 🦆 بطة');
  const [qOrderRaw, setQOrderRaw] = useState('1\n2\n3');
  const [qMarks, setQMarks] = useState(2);
  const [qDiff, setQDiff] = useState<TeacherQuestionDifficulty>('medium');
  const [qExplainAr, setQExplainAr] = useState('');
  const [qExplainEn, setQExplainEn] = useState('');

  // Bulk import state
  const [importPreview, setImportPreview] = useState<{
    importBatchId: string;
    totalRows: number;
    validCount: number;
    invalidCount: number;
    validRows: Array<{ rowNumber: number; question: { lessonId: string; promptAr: string; promptEn: string; questionType: string } }>;
    invalidRows: Array<{ rowNumber: number; errors: string[] }>;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  // Exam builder state
  const [exTitleAr, setExTitleAr] = useState('');
  const [exTitleEn, setExTitleEn] = useState('');
  const [exDescAr, setExDescAr] = useState('');
  const [exDescEn, setExDescEn] = useState('');
  const [exSubject, setExSubject] = useState<TeacherExam['subject']>('arabic');
  const [exLevel, setExLevel] = useState<1 | 2>(1);
  const [exAgeGroup, setExAgeGroup] = useState<AgeGroupId>(UNIFIED_STAGE_ID);
  const [exQuestionIds, setExQuestionIds] = useState<string[]>([]);
  const [exPassingPct, setExPassingPct] = useState(70);
  const [exDurationMin, setExDurationMin] = useState(20);
  const [exStartDate, setExStartDate] = useState(() => new Date(Date.now() - 60_000).toISOString().slice(0, 16));
  const [exEndDate, setExEndDate] = useState(() => new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 16));
  const [exAttempts, setExAttempts] = useState(2);
  const [exRandQ, setExRandQ] = useState(true);
  const [exRandA, setExRandA] = useState(true);
  const [exShowRes, setExShowRes] = useState(true);
  const [exShowCorr, setExShowCorr] = useState(true);
  const [exStatus, setExStatus] = useState<ExamStatus>('draft');

  // Assign exams state
  const [assignExamId, setAssignExamId] = useState('');
  const [assignClassIds, setAssignClassIds] = useState<string[]>([]);
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [assignPublishNow, setAssignPublishNow] = useState(true);
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);

  // Profile & password state
  const [profName, setProfName] = useState(authSession.user?.name || '');
  const [profBio, setProfBio] = useState(authSession.user?.teacherProfile?.bio || '');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');

  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
      };
      if (authSession.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init.method || 'GET')) {
        headers['x-csrf-token'] = authSession.csrfToken;
      }
      return fetch(url, { ...init, credentials: 'include', headers });
    },
    [authSession.csrfToken],
  );

  const loadAll = useCallback(async () => {
    try {
      const [dRes, cRes, sRes, lRes, qRes, eRes, rRes] = await Promise.all([
        apiFetch('/api/teacher/dashboard'),
        apiFetch('/api/teacher/classes'),
        apiFetch('/api/teacher/students'),
        apiFetch('/api/teacher/lessons'),
        apiFetch('/api/teacher/questions'),
        apiFetch('/api/teacher/exams'),
        apiFetch('/api/teacher/results'),
      ]);
      if (dRes.ok) setDashboard(await dRes.json());
      if (cRes.ok) setClasses((await cRes.json()).classes || []);
      if (sRes.ok) setStudents((await sRes.json()).students || []);
      if (lRes.ok) setLessons((await lRes.json()).lessons || []);
      if (qRes.ok) setQuestions((await qRes.json()).questions || []);
      if (eRes.ok) setExams((await eRes.json()).exams || []);
      if (rRes.ok) setResults((await rRes.json()).results || []);
    } catch {
      // handled cleanly
    }
  }, [apiFetch]);

  useEffect(() => {
    if (authSession.authenticated && authSession.user?.role === 'teacher') {
      void loadAll();
      setProfName(authSession.user.name || '');
    }
  }, [authSession.authenticated, authSession.user, loadAll]);

  const lessonsForLevel = useMemo(
    () => lessons.filter((l) => l.level === qLevel),
    [lessons, qLevel],
  );

  useEffect(() => {
    if (lessonsForLevel.length > 0 && !lessonsForLevel.some((l) => l.id === qLessonId)) {
      setQLessonId(lessonsForLevel[0].id);
    }
  }, [lessonsForLevel, qLessonId]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (qFilterSubject && q.subject !== qFilterSubject) return false;
      if (qFilterLevel && String(q.level) !== qFilterLevel) return false;
      if (qFilterType && q.questionType !== qFilterType) return false;
      if (
        qSearch &&
        !q.promptAr.toLowerCase().includes(qSearch.toLowerCase()) &&
        !q.promptEn.toLowerCase().includes(qSearch.toLowerCase()) &&
        !q.lessonId.toLowerCase().includes(qSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [questions, qFilterSubject, qFilterLevel, qFilterType, qSearch]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (studentSearch && !s.displayName.toLowerCase().includes(studentSearch.toLowerCase())) return false;
      if (studentLevelFilter && String(s.level) !== studentLevelFilter) return false;
      return true;
    });
  }, [students, studentSearch, studentLevelFilter]);

  const selectedExamMarksTotal = useMemo(() => {
    return exQuestionIds.reduce((sum, id) => {
      const q = questions.find((x) => x.id === id);
      return sum + (q?.marks || 0);
    }, 0);
  }, [exQuestionIds, questions]);

  if (!authSession.authenticated || authSession.user?.role !== 'teacher') {
    return (
      <div className="max-w-xl mx-auto my-12 nono-card p-8 bg-white text-center space-y-4">
        <GraduationCap className="w-12 h-12 mx-auto text-[#8054D9]" />
        <h2 className="text-2xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'بوابة المعلم المحمية' : 'Protected Teacher Portal'}
        </h2>
        <p className="text-sm font-bold text-[#27345C]/70">
          {language === 'ar'
            ? 'هذه المساحة مخصصة للمعلمين المعتمدين من الإدارة فقط. يرجى تسجيل الدخول بحساب معلم نشط.'
            : 'This portal requires an active, admin-approved Teacher account.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('parent-auth')}
            className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'تسجيل دخول المعلم' : 'Sign In as Teacher'}
          </button>
          <button
            type="button"
            onClick={() => navigate('parent-auth')}
            className="px-6 py-3 rounded-2xl bg-[#27345C]/10 font-bold cursor-pointer"
          >
            {language === 'ar' ? 'العودة للدخول' : 'Back to Login'}
          </button>
        </div>
      </div>
    );
  }

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');

    const payload: Record<string, unknown> = {
      subject: qSubject,
      level: qLevel,
      lessonId: qLessonId,
      questionType: qType,
      promptAr: qPromptAr,
      promptEn: qPromptEn,
      audioText: qAudioText || undefined,
      imageUrl: qImageUrl || undefined,
      marks: Number(qMarks),
      difficulty: qDiff,
      explanation: { ar: qExplainAr, en: qExplainEn },
    };

    if (qType === 'true-false') {
      payload.options = [
        { id: 'a', textAr: qOptAAr || 'صح', textEn: qOptAEn || 'True' },
        { id: 'b', textAr: qOptBAr || 'خطأ', textEn: qOptBEn || 'False' },
      ];
      payload.correctOptionId = qCorrectId === 'b' ? 'b' : 'a';
    } else if (qType === 'multiple-choice' || qType === 'picture-id' || qType === 'audio-id') {
      const opts = [
        { id: 'a', textAr: qOptAAr, textEn: qOptAEn },
        { id: 'b', textAr: qOptBAr, textEn: qOptBEn },
      ];
      if (qOptCAr || qOptCEn) opts.push({ id: 'c', textAr: qOptCAr, textEn: qOptCEn });
      payload.options = opts;
      payload.correctOptionId = qCorrectId;
    } else if (qType === 'matching') {
      payload.matchingPairs = qMatchingRaw
        .split('\n')
        .map((line, i) => {
          const [left, right] = line.split('=>').map((x) => x.trim());
          return { id: `p${i + 1}`, left: left || '', right: right || '' };
        })
        .filter((p) => p.left && p.right);
    } else if (qType === 'ordering') {
      payload.correctOrder = qOrderRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    } else {
      payload.acceptedAnswers = qAcceptedAnswers.split('|').map((s) => s.trim()).filter(Boolean);
    }

    const url = editingQuestionId ? `/api/teacher/questions/${editingQuestionId}` : '/api/teacher/questions';
    const method = editingQuestionId ? 'PATCH' : 'POST';
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Could not save question');
      return;
    }

    setNotice(editingQuestionId ? (language === 'ar' ? 'تم تحديث السؤال' : 'Question updated') : (language === 'ar' ? 'تم حفظ السؤال في البنك' : 'Question added to Question Bank'));
    setEditingQuestionId(null);
    setQPromptAr('');
    setQPromptEn('');
    setQOptAAr('');
    setQOptAEn('');
    setQOptBAr('');
    setQOptBEn('');
    setQOptCAr('');
    setQOptCEn('');
    await loadAll();
  };

  const handleBulkFile = async (file: File) => {
    setErrorMsg('');
    setNotice('');
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/teacher/questions/import/preview', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Bulk import validation failed');
        return;
      }
      setImportPreview(data);
    } catch {
      setErrorMsg('Failed to upload file');
    } finally {
      setImporting(false);
    }
  };

  const handleCommitBulkImport = async () => {
    if (!importPreview?.importBatchId) return;
    const res = await apiFetch('/api/teacher/questions/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importBatchId: importPreview.importBatchId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Import commit failed');
      return;
    }
    setNotice(
      language === 'ar'
        ? `تم استيراد ${data.importedCount} سؤالاً بنجاح!`
        : `Successfully imported ${data.importedCount} questions!`,
    );
    setImportPreview(null);
    await loadAll();
  };

  const handleCreateExam = async (e: React.FormEvent, desiredStatus?: ExamStatus) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    const res = await apiFetch('/api/teacher/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: { ar: exTitleAr, en: exTitleEn },
        description: { ar: exDescAr, en: exDescEn },
        subject: exSubject,
        level: exLevel,
        ageGroup: exAgeGroup,
        questionIds: exQuestionIds,
        totalMarks: selectedExamMarksTotal,
        passingPercentage: Number(exPassingPct),
        durationMinutes: Number(exDurationMin),
        startDate: new Date(exStartDate).toISOString(),
        endDate: new Date(exEndDate).toISOString(),
        allowedAttempts: Number(exAttempts),
        randomizeQuestions: exRandQ,
        randomizeAnswers: exRandA,
        showResults: exShowRes,
        showCorrectAnswers: exShowCorr,
        status: desiredStatus || exStatus,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Failed to save exam');
      return;
    }
    setNotice(
      language === 'ar'
        ? `تم إنشاء الامتحان (${data.exam.status})`
        : `Exam created cleanly (${data.exam.status})`,
    );
    setExTitleAr('');
    setExTitleEn('');
    setExQuestionIds([]);
    await loadAll();
    setSection('my-exams');
  };

  const handleConfirmAssign = async () => {
    if (!assignExamId) return;
    setErrorMsg('');
    setNotice('');
    const res = await apiFetch(`/api/teacher/exams/${assignExamId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classIds: assignClassIds,
        studentIds: assignStudentIds,
        publishNow: assignPublishNow,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Assignment failed');
      return;
    }
    setAssignConfirmOpen(false);
    setNotice(
      language === 'ar'
        ? `تم إسناد الامتحان إلى ${data.assignedCount} طالباً`
        : `Exam assigned to ${data.assignedCount} student(s) (skipped ${data.skippedDuplicates} duplicate(s)).`,
    );
    await loadAll();
  };

  const loadStudentDrilldown = async (studentId: string) => {
    setSelectedStudentId(studentId);
    const res = await apiFetch(`/api/teacher/students/${studentId}/progress`);
    if (res.ok) {
      setStudentDrilldown(await res.json());
      setSection('student-performance');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    const res = await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: profName, bio: profBio }),
    });
    const data = await res.json();
    if (!res.ok) return setErrorMsg(data.error || 'Profile update failed');
    await refreshAuthSession();
    setNotice(language === 'ar' ? 'تم تحديث بيانات الحساب' : 'Profile updated cleanly');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    const pwEval = validatePassword(newPw, authSession.user?.email, profName);
    if (!pwEval.ok) return setErrorMsg(pwEval.error || 'Weak password');
    if (newPw !== confPw) return setErrorMsg('Passwords do not match');

    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw, confirmPassword: confPw }),
    });
    const data = await res.json();
    if (!res.ok) return setErrorMsg(data.error || 'Password change failed');
    setCurPw('');
    setNewPw('');
    setConfPw('');
    await refreshAuthSession();
    setNotice(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed & sessions rotated');
  };

  const navButtons: Array<{ id: TeacherSection; ar: string; en: string; icon: React.ReactNode }> = [
    { id: 'overview', ar: 'نظرة عامة', en: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'classes', ar: 'فصولي', en: 'My Classes', icon: <Layers className="w-4 h-4" /> },
    { id: 'students', ar: 'طلابي', en: 'My Students', icon: <Users className="w-4 h-4" /> },
    { id: 'homework', ar: 'الواجبات والمهام', en: 'Homework & Assignments', icon: <FileText className="w-4 h-4" /> },
    { id: 'question-bank', ar: 'بنك الأسئلة والاستيراد', en: 'Question Bank', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'create-exam', ar: 'إنشاء امتحان', en: 'Create Exam', icon: <Plus className="w-4 h-4" /> },
    { id: 'my-exams', ar: 'كل امتحاناتي', en: 'My Exams', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'draft-exams', ar: 'المسودات', en: 'Draft Exams', icon: <FileText className="w-4 h-4" /> },
    { id: 'published-exams', ar: 'الامتحانات المنشورة', en: 'Published Exams', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'assign-exams', ar: 'تعيين للطلاب', en: 'Assign Exams', icon: <Send className="w-4 h-4" /> },
    { id: 'exam-results', ar: 'نتائج الامتحانات', en: 'Exam Results', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'student-performance', ar: 'أداء الطالب', en: 'Student Performance', icon: <Search className="w-4 h-4" /> },
    { id: 'profile', ar: 'إعدادات الحساب', en: 'Profile Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const draftExams = exams.filter((e) => e.status === 'draft' || e.status === 'pending-review');
  const publishedExams = exams.filter((e) => e.status === 'published' || e.status === 'active' || e.status === 'scheduled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[2rem] bg-gradient-to-br from-[#27345C] via-[#41398B] to-[#8054D9] text-white p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <NonoLandLogo variant="compact" size="lg" showWordmark={false} tone="dark" language={language} />
          <div>
            <p className="text-xs font-extrabold text-[#FFD84D]">
              {language === 'ar' ? 'بوابة المعلم المعتمدة · نونو لاند' : 'Verified Teacher Portal · NonoLand'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
              {language === 'ar' ? `أهلاً ${authSession.user.name}` : `Welcome, ${authSession.user.name}`}
            </h1>
            <p className="text-xs text-white/80 mt-0.5">{authSession.user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLogoutModalOpen(true)}
          className="h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
        </button>
      </div>

      {/* Sidebar / Nav Chips across all 12 Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-1.5 nono-card p-3 bg-white h-fit">
          <div className="px-2 py-2 mb-1 border-b border-[#27345C]/10 flex items-center justify-between">
            <NonoLandLogo variant="compact" size="xs" language={language} />
          </div>
          {navButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                setSection(btn.id);
                setErrorMsg('');
                setNotice('');
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2.5 transition-all cursor-pointer ${
                section === btn.id
                  ? 'bg-[#8054D9] text-white shadow-sm'
                  : 'text-[#27345C]/80 hover:bg-[#FFF8E9]'
              }`}
            >
              {btn.icon}
              <span>{language === 'ar' ? btn.ar : btn.en}</span>
            </button>
          ))}
        </aside>

        <div className="lg:col-span-9 space-y-5">
          {notice && (
            <div className="p-3.5 rounded-2xl bg-[#55D98B]/20 border border-[#55D98B] text-[#14532D] font-bold text-sm">
              {notice}
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#FF6B6B]/15 border border-[#FF6B6B] text-[#991B1B] font-bold text-sm">
              {errorMsg}
            </div>
          )}

          {/* 1. OVERVIEW */}
          {section === 'overview' && dashboard && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: language === 'ar' ? 'فصولي المسندة' : 'Assigned Classes', val: dashboard.stats.classesCount },
                  { label: language === 'ar' ? 'طلابي' : 'Assigned Students', val: dashboard.stats.assignedStudentsCount },
                  { label: language === 'ar' ? 'أسئلتي' : 'My Questions', val: dashboard.stats.totalQuestions },
                  { label: language === 'ar' ? 'امتحانات منشورة' : 'Published Exams', val: dashboard.stats.publishedExamsCount },
                  { label: language === 'ar' ? 'مسودات' : 'Draft Exams', val: dashboard.stats.draftExamsCount },
                  { label: language === 'ar' ? 'مهام مسندة' : 'Assigned Tasks', val: dashboard.stats.totalAssignedExams },
                  { label: language === 'ar' ? 'محاولات مكتملة' : 'Completed Submissions', val: dashboard.stats.completedAttemptsCount },
                  { label: language === 'ar' ? 'متوسط الدرجات' : 'Average Score', val: `${dashboard.stats.averageScorePercentage}%` },
                ].map((stat, idx) => (
                  <div key={idx} className="nono-card p-4 bg-white">
                    <p className="text-xs font-bold text-[#27345C]/65">{stat.label}</p>
                    <p className="text-2xl font-extrabold text-[#27345C] mt-1 tabular-nums">{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="nono-card p-5 bg-white space-y-3">
                  <h3 className="font-extrabold text-base text-[#27345C]">
                    {language === 'ar' ? 'أحدث نتائج الطلاب' : 'Recent Student Results'}
                  </h3>
                  {dashboard.recentResults.length === 0 ? (
                    <p className="text-xs font-bold text-[#27345C]/60">
                      {language === 'ar' ? 'لا توجد محاولات مكتملة بعد.' : 'No completed exam attempts yet.'}
                    </p>
                  ) : (
                    dashboard.recentResults.map((r) => (
                      <div key={r.attemptId} className="p-3 rounded-xl bg-[#FFF8E9] flex items-center justify-between text-xs font-bold">
                        <div>
                          <p className="font-extrabold text-[#27345C]">{r.studentName}</p>
                          <p className="text-[#27345C]/70">{t(r.examTitle, language)}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg ${r.passed ? 'bg-[#55D98B]/25 text-[#14532D]' : 'bg-[#FF9360]/25 text-[#9A3412]'}`}>
                          {r.percentage}%
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="nono-card p-5 bg-white space-y-3">
                  <h3 className="font-extrabold text-base text-[#27345C]">
                    {language === 'ar' ? 'سجل نشاطي الأخير' : 'Recent Activity'}
                  </h3>
                  {dashboard.recentActivity.length === 0 ? (
                    <p className="text-xs font-bold text-[#27345C]/60">
                      {language === 'ar' ? 'لا يوجد نشاط مسجل بعد.' : 'No recent audit events yet.'}
                    </p>
                  ) : (
                    dashboard.recentActivity.slice(0, 6).map((act) => (
                      <div key={act.id} className="p-2.5 rounded-xl bg-[#27345C]/5 text-xs font-bold text-[#27345C]">
                        <p>{act.summary}</p>
                        <p className="text-[10px] text-[#27345C]/55 mt-0.5">{new Date(act.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. MY CLASSES */}
          {section === 'classes' && (
            <div className="nono-card p-5 bg-white space-y-4">
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'فصولي الدراسية المسندة من الإدارة' : 'My Assigned Classes'}
              </h2>
              {classes.length === 0 ? (
                <p className="text-sm font-bold text-[#27345C]/65">
                  {language === 'ar' ? 'لم تسند الإدارة فصولاً بعد.' : 'No classes assigned to you by Admin yet.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map((cls) => (
                    <div key={cls.id} className="p-4 rounded-2xl border-2 border-[#27345C]/10 bg-[#FFF8E9]/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-base text-[#27345C]">{cls.name}</h3>
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-[#8054D9]/15 text-[#8054D9]">
                          {cls.subject} · {language === 'ar' ? 'التأسيس (١–٤)' : 'Foundations (1–4)'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#27345C]/70">
                        {cls.students.length} {language === 'ar' ? 'طالب مسجل' : 'Assigned Student(s)'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cls.students.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => void loadStudentDrilldown(st.id)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#27345C]/15 text-xs font-bold hover:border-[#8054D9] cursor-pointer"
                          >
                            {st.displayName} ({getSafeStageShortLabel(st.ageGroup, language)})
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. MY STUDENTS */}
          {section === 'students' && (
            <div className="nono-card p-5 bg-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'طلابي المصرّح لي بمتابعتهم' : 'My Assigned Students'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder={language === 'ar' ? 'ابحث باسم الطالب...' : 'Search student...'}
                    className="h-10 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold"
                  />
                  <select
                    value={studentLevelFilter}
                    onChange={(e) => setStudentLevelFilter(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
                  >
                    <option value="">{language === 'ar' ? 'كل المسار التأسيسي (١–٤)' : 'All Foundations (1–4)'}</option>
                    <option value="1">{language === 'ar' ? 'التأسيس (١–٤ سنوات)' : 'Foundations (1–4)'}</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-bold">
                  <thead>
                    <tr className="border-b border-[#27345C]/12 text-[#27345C]/65">
                      <th className="py-2 text-start">{language === 'ar' ? 'الطالب' : 'Student'}</th>
                      <th className="py-2 text-start">{language === 'ar' ? 'العمر' : 'Age'}</th>
                      <th className="py-2 text-start">{language === 'ar' ? 'الفصول' : 'Classes'}</th>
                      <th className="py-2 text-start">{language === 'ar' ? 'دروس التأسيس' : 'Foundations'}</th>
                      <th className="py-2 text-start">{language === 'ar' ? 'الامتحانات' : 'Exams Avg'}</th>
                      <th className="py-2 text-start">{language === 'ar' ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((st) => (
                      <tr key={st.id} className="border-b border-[#27345C]/8">
                        <td className="py-2.5 font-extrabold">{st.displayName}</td>
                        <td>{getSafeStageShortLabel(st.ageGroup, language)}</td>
                        <td>{st.classes.join(', ')}</td>
                        <td>{st.level1MasteredCount} / 75</td>
                        <td>{st.averageExamPercentage !== null ? `${st.averageExamPercentage}%` : '—'}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => void loadStudentDrilldown(st.id)}
                            className="px-3 py-1 rounded-lg bg-[#8054D9] text-white cursor-pointer"
                          >
                            {language === 'ar' ? 'التفاصيل' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3B. HOMEWORK & ASSIGNMENTS */}
          {section === 'homework' && (
            <TeacherHomeworkPanel
              apiFetch={apiFetch}
              classes={classes}
              students={students}
              lessons={lessons}
              questions={questions}
              onNotice={setNotice}
              onError={setErrorMsg}
            />
          )}

          {/* 4. QUESTION BANK & BULK IMPORT */}
          {section === 'question-bank' && (
            <div className="space-y-5">
              {/* Bulk CSV / Excel Import Panel */}
              <div className="nono-card p-5 bg-gradient-to-br from-[#E5F6FF] to-white border-2 border-[#39BDF2]/30 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-base text-[#27345C] flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-[#39BDF2]" />
                      <span>{language === 'ar' ? 'استيراد جماعي من Excel / CSV' : 'Bulk Import Questions (CSV / Excel .xlsx)'}</span>
                    </h3>
                    <p className="text-xs font-bold text-[#27345C]/70">
                      {language === 'ar'
                        ? 'حمّل القالب الرسمي، ارفع الملف للمعاينة، راجع الأخطاء إن وجدت ثم اعتمد الاستيراد.'
                        : 'Download official template, upload for row-by-row validation preview, then commit safely.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="/api/teacher/questions/import/template?format=csv"
                      download
                      className="h-9 px-3 rounded-xl bg-white border border-[#27345C]/20 text-xs font-extrabold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV Template
                    </a>
                    <a
                      href="/api/teacher/questions/import/template?format=xlsx"
                      download
                      className="h-9 px-3 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Excel (.xlsx) Template
                    </a>
                  </div>
                </div>

                <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-[#39BDF2] bg-white cursor-pointer hover:bg-[#E5F6FF]/40 text-xs font-extrabold">
                  <Upload className="w-4 h-4 text-[#8054D9]" />
                  <span>{importing ? 'Validating uploaded file...' : language === 'ar' ? 'اختر ملف CSV أو XLSX للمعاينة والتحقق' : 'Choose .csv or .xlsx file to validate & preview'}</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleBulkFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>

                {importPreview && (
                  <div className="p-4 rounded-2xl bg-white border border-[#27345C]/15 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-extrabold">
                        Valid: <span className="text-[#166534]">{importPreview.validCount}</span> · Invalid:{' '}
                        <span className="text-[#991B1B]">{importPreview.invalidCount}</span> / Total {importPreview.totalRows}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setImportPreview(null)}
                          className="px-3 py-1.5 rounded-lg bg-[#27345C]/10 font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                        {importPreview.validCount > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleCommitBulkImport()}
                            className="px-4 py-1.5 rounded-lg bg-[#8054D9] text-white font-extrabold cursor-pointer"
                          >
                            Confirm & Import {importPreview.validCount} Question(s)
                          </button>
                        )}
                      </div>
                    </div>
                    {importPreview.invalidRows.length > 0 && (
                      <div className="max-h-36 overflow-y-auto space-y-1 bg-[#FF6B6B]/10 p-2.5 rounded-xl">
                        {importPreview.invalidRows.map((errRow) => (
                          <p key={errRow.rowNumber} className="font-bold text-[#991B1B]">
                            Row {errRow.rowNumber}: {errRow.errors.join('; ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add / Edit Question Form */}
              <form onSubmit={(e) => void handleSaveQuestion(e)} className="nono-card p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-lg text-[#27345C]">
                    {editingQuestionId
                      ? language === 'ar'
                        ? 'تعديل سؤال'
                        : 'Edit Question'
                      : language === 'ar'
                        ? 'إضافة سؤال جديد إلى البنك'
                        : 'Add New Question to Bank'}
                  </h3>
                  {editingQuestionId && (
                    <button
                      type="button"
                      onClick={() => setEditingQuestionId(null)}
                      className="text-xs font-bold text-[#8054D9] underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                  <div>
                    <label className="block mb-1">Level</label>
                    <select
                      value={qLevel}
                      onChange={() => setQLevel(1)}
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 bg-white"
                    >
                      <option value={1}>Track 1 · Foundations (Ages 1–4)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Subject</label>
                    <select
                      value={qSubject}
                      onChange={(e) => setQSubject(e.target.value as TeacherSubject)}
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 bg-white"
                    >
                      {ALLOWED_TEACHER_SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Lesson</label>
                    <select
                      value={qLessonId}
                      onChange={(e) => setQLessonId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 bg-white"
                    >
                      {lessonsForLevel.map((ls) => (
                        <option key={ls.id} value={ls.id}>
                          {ls.id} — {t(ls.title, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                  <div>
                    <label className="block mb-1">Question Type</label>
                    <select
                      value={qType}
                      onChange={(e) => setQType(e.target.value as TeacherQuestionType)}
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 bg-white"
                    >
                      {ALLOWED_TEACHER_QUESTION_TYPES.map((qt) => (
                        <option key={qt} value={qt}>
                          {qt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Difficulty</label>
                    <select
                      value={qDiff}
                      onChange={(e) => setQDiff(e.target.value as TeacherQuestionDifficulty)}
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 bg-white"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Marks</label>
                    <input
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={qMarks}
                      onChange={(e) => setQMarks(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                  <div>
                    <label className="block mb-1">Prompt (Arabic)</label>
                    <input
                      type="text"
                      value={qPromptAr}
                      onChange={(e) => setQPromptAr(e.target.value)}
                      placeholder="اكتب نص السؤال بالعربية..."
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Prompt (English)</label>
                    <input
                      type="text"
                      value={qPromptEn}
                      onChange={(e) => setQPromptEn(e.target.value)}
                      placeholder="Question text in English..."
                      className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20"
                    />
                  </div>
                </div>

                {(qType === 'audio-id' || qType === 'picture-id') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                    <input
                      type="text"
                      value={qAudioText}
                      onChange={(e) => setQAudioText(e.target.value)}
                      placeholder="Audio Speech Text (required for audio-id)"
                      className="h-10 px-3 rounded-xl border border-[#27345C]/20"
                    />
                    <input
                      type="text"
                      value={qImageUrl}
                      onChange={(e) => setQImageUrl(e.target.value)}
                      placeholder="Optional safe image URL (/assets/... or https://...)"
                      className="h-10 px-3 rounded-xl border border-[#27345C]/20"
                    />
                  </div>
                )}

                {(qType === 'multiple-choice' || qType === 'picture-id' || qType === 'audio-id') && (
                  <div className="space-y-2 text-xs font-bold">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input type="text" placeholder="Option A (Arabic)" value={qOptAAr} onChange={(e) => setQOptAAr(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                      <input type="text" placeholder="Option A (English)" value={qOptAEn} onChange={(e) => setQOptAEn(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                      <input type="text" placeholder="Option B (Arabic)" value={qOptBAr} onChange={(e) => setQOptBAr(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                      <input type="text" placeholder="Option B (English)" value={qOptBEn} onChange={(e) => setQOptBEn(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                      <input type="text" placeholder="Option C (Arabic - optional)" value={qOptCAr} onChange={(e) => setQOptCAr(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                      <input type="text" placeholder="Option C (English - optional)" value={qOptCEn} onChange={(e) => setQOptCEn(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                    </div>
                    <select value={qCorrectId} onChange={(e) => setQCorrectId(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20 bg-white">
                      <option value="a">Correct Option: A</option>
                      <option value="b">Correct Option: B</option>
                      {(qOptCAr || qOptCEn) && <option value="c">Correct Option: C</option>}
                    </select>
                  </div>
                )}

                {qType === 'true-false' && (
                  <select value={qCorrectId} onChange={(e) => setQCorrectId(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20 bg-white text-xs font-bold">
                    <option value="a">Correct Answer: True / صح</option>
                    <option value="b">Correct Answer: False / خطأ</option>
                  </select>
                )}

                {(qType === 'fill-blank' || qType === 'short-answer') && (
                  <input
                    type="text"
                    value={qAcceptedAnswers}
                    onChange={(e) => setQAcceptedAnswers(e.target.value)}
                    placeholder="Accepted answers separated by | (e.g. cat|CAT|قطة)"
                    className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold"
                  />
                )}

                {qType === 'matching' && (
                  <textarea
                    rows={3}
                    value={qMatchingRaw}
                    onChange={(e) => setQMatchingRaw(e.target.value)}
                    placeholder="One pair per line: Left => Right"
                    className="w-full p-3 rounded-xl border border-[#27345C]/20 text-xs font-bold"
                  />
                )}

                {qType === 'ordering' && (
                  <textarea
                    rows={3}
                    value={qOrderRaw}
                    onChange={(e) => setQOrderRaw(e.target.value)}
                    placeholder="One step per line in exact correct sequence"
                    className="w-full p-3 rounded-xl border border-[#27345C]/20 text-xs font-bold"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                  <input type="text" placeholder="Explanation AR (optional)" value={qExplainAr} onChange={(e) => setQExplainAr(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                  <input type="text" placeholder="Explanation EN (optional)" value={qExplainEn} onChange={(e) => setQExplainEn(e.target.value)} className="h-9 px-3 rounded-xl border border-[#27345C]/20" />
                </div>

                <button type="submit" className="nono-btn-tactile px-6 py-2.5 rounded-xl bg-[#8054D9] text-white font-extrabold text-xs cursor-pointer">
                  {editingQuestionId ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Updates') : (language === 'ar' ? 'إضافة لبنك الأسئلة' : 'Save to Question Bank')}
                </button>
              </form>

              {/* Question Bank List */}
              <div className="nono-card p-5 bg-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold text-base text-[#27345C]">
                    {language === 'ar' ? `بنك أسئلتي (${filteredQuestions.length})` : `My Question Bank (${filteredQuestions.length})`}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={qSearch}
                      onChange={(e) => setQSearch(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-[#27345C]/20"
                    />
                    <select value={qFilterLevel} onChange={(e) => setQFilterLevel(e.target.value)} className="h-9 px-2.5 rounded-xl border border-[#27345C]/20 bg-white">
                      <option value="">All Tracks</option>
                      <option value="1">Foundations (1–4)</option>
                    </select>
                    <select value={qFilterSubject} onChange={(e) => setQFilterSubject(e.target.value)} className="h-9 px-2.5 rounded-xl border border-[#27345C]/20 bg-white">
                      <option value="">All Subjects</option>
                      {ALLOWED_TEACHER_SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select value={qFilterType} onChange={(e) => setQFilterType(e.target.value)} className="h-9 px-2.5 rounded-xl border border-[#27345C]/20 bg-white">
                      <option value="">All Types</option>
                      {ALLOWED_TEACHER_QUESTION_TYPES.map((qt) => (
                        <option key={qt} value={qt}>{qt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {filteredQuestions.map((q) => (
                    <div key={q.id} className="p-3.5 rounded-2xl border border-[#27345C]/12 flex flex-wrap items-center justify-between gap-3 bg-[#FFF8E9]/40">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                          <span className="px-2 py-0.5 rounded bg-[#8054D9]/15 text-[#8054D9]">{q.lessonId}</span>
                          <span className="px-2 py-0.5 rounded bg-[#39BDF2]/15 text-[#0369A1]">{q.questionType}</span>
                          <span className="px-2 py-0.5 rounded bg-[#FFD84D]/35">{q.marks} pts</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100">{q.difficulty}</span>
                          <span className="px-2 py-0.5 rounded bg-[#27345C] text-white">
                            {q.approvalStatus || 'published'} · v{q.version || 1}
                          </span>
                          {(q.qualityFlags || []).map((fl) => (
                            <span key={fl.code} title={fl.message} className="px-2 py-0.5 rounded bg-[#FF6B6B]/20 text-[#991B1B]">
                              ⚠ {fl.code}
                            </span>
                          ))}
                        </div>
                        <p className="font-extrabold text-sm text-[#27345C]">{q.promptAr || q.promptEn}</p>
                        {q.promptAr && q.promptEn && <p className="text-xs font-bold text-[#27345C]/65">{q.promptEn}</p>}
                        {q.adminFeedback && (
                          <p className="text-xs font-bold text-[#9A3412]">Admin note: {q.adminFeedback}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {(q.approvalStatus === 'draft' || q.approvalStatus === 'rejected') && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/teacher/content/question/${q.id}/submit-review`, { method: 'POST' });
                              setNotice('Question submitted for Admin review.');
                              await loadAll();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
                          >
                            Submit Review
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewQuestion(previewQuestion?.id === q.id ? null : q)}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#27345C]/15 cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/teacher/questions/${q.id}/duplicate`, { method: 'POST' });
                            await loadAll();
                          }}
                          className="p-1.5 rounded-lg bg-white border border-[#27345C]/15 cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/teacher/questions/${q.id}`, { method: 'DELETE' });
                            await loadAll();
                          }}
                          className="p-1.5 rounded-lg bg-[#FF6B6B]/15 text-[#991B1B] cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {previewQuestion && (
                  <div className="p-4 rounded-2xl bg-[#E5F6FF] border border-[#39BDF2] space-y-2 text-xs">
                    <p className="font-extrabold text-[#27345C]">Preview ({previewQuestion.questionType}): {previewQuestion.promptAr} / {previewQuestion.promptEn}</p>
                    <div className="flex flex-wrap gap-2">
                      {previewQuestion.options.map((o) => (
                        <span key={o.id} className={`px-3 py-1 rounded-xl border ${o.id === previewQuestion.correctOptionId ? 'bg-[#55D98B] font-extrabold' : 'bg-white'}`}>
                          {o.textAr} / {o.textEn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. CREATE EXAM */}
          {section === 'create-exam' && (
            <form onSubmit={(e) => void handleCreateExam(e)} className="nono-card p-5 bg-white space-y-4">
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'إنشاء امتحان جديد وتحديد إعداداته' : 'Create & Configure Exam'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                <input required placeholder="Exam Title (Arabic)" value={exTitleAr} onChange={(e) => setExTitleAr(e.target.value)} className="h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <input required placeholder="Exam Title (English)" value={exTitleEn} onChange={(e) => setExTitleEn(e.target.value)} className="h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <input placeholder="Description (Arabic)" value={exDescAr} onChange={(e) => setExDescAr(e.target.value)} className="h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <input placeholder="Description (English)" value={exDescEn} onChange={(e) => setExDescEn(e.target.value)} className="h-10 px-3 rounded-xl border border-[#27345C]/20" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold">
                <div>
                  <label className="block mb-1">Subject</label>
                  <select value={exSubject} onChange={(e) => setExSubject(e.target.value as TeacherExam['subject'])} className="w-full h-10 px-2.5 rounded-xl border border-[#27345C]/20 bg-white">
                    <option value="comprehensive">comprehensive</option>
                    {ALLOWED_TEACHER_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Level</label>
                  <select value={exLevel} onChange={() => setExLevel(1)} className="w-full h-10 px-2.5 rounded-xl border border-[#27345C]/20 bg-white">
                    <option value={1}>Foundations (Ages 1–4)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Stage</label>
                  <select value={exAgeGroup} onChange={(e) => setExAgeGroup(e.target.value as AgeGroupId)} className="w-full h-10 px-2.5 rounded-xl border border-[#27345C]/20 bg-white">
                    <option value="1-4">Little Explorers (1–4 Years)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Passing %</label>
                  <input type="number" min={1} max={100} value={exPassingPct} onChange={(e) => setExPassingPct(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                </div>
                <div>
                  <label className="block mb-1">Duration (min)</label>
                  <input type="number" min={1} max={180} value={exDurationMin} onChange={(e) => setExDurationMin(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                </div>
                <div>
                  <label className="block mb-1">Allowed Attempts</label>
                  <input type="number" min={1} max={20} value={exAttempts} onChange={(e) => setExAttempts(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                </div>
                <div>
                  <label className="block mb-1">Start Date</label>
                  <input type="datetime-local" value={exStartDate} onChange={(e) => setExStartDate(e.target.value)} className="w-full h-10 px-2 rounded-xl border border-[#27345C]/20" />
                </div>
                <div>
                  <label className="block mb-1">End Date / Deadline</label>
                  <input type="datetime-local" value={exEndDate} onChange={(e) => setExEndDate(e.target.value)} className="w-full h-10 px-2 rounded-xl border border-[#27345C]/20" />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={exRandQ} onChange={(e) => setExRandQ(e.target.checked)} /> Randomize Questions</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={exRandA} onChange={(e) => setExRandA(e.target.checked)} /> Randomize Answers</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={exShowRes} onChange={(e) => setExShowRes(e.target.checked)} /> Show Results Immediately</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={exShowCorr} onChange={(e) => setExShowCorr(e.target.checked)} /> Show Correct Answers in Review</label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-extrabold text-[#27345C]">
                  Select Questions from Question Bank ({exQuestionIds.length} selected · Total Marks: {selectedExamMarksTotal})
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1.5 border border-[#27345C]/12 rounded-2xl p-3">
                  {questions.map((q) => {
                    const checked = exQuestionIds.includes(q.id);
                    return (
                      <label key={q.id} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs font-bold ${checked ? 'bg-[#F4EEFF] border border-[#8054D9]' : 'bg-[#FFF8E9]/40'}`}>
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setExQuestionIds((prev) =>
                                e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id),
                              )
                            }
                          />
                          <span>[{q.lessonId} · {q.questionType}] {q.promptAr || q.promptEn}</span>
                        </span>
                        <span>{q.marks} pts</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  onClick={() => setExStatus('draft')}
                  className="px-5 py-2.5 rounded-xl bg-[#27345C]/12 font-extrabold text-xs cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={(e) => void handleCreateExam(e, 'published')}
                  className="nono-btn-tactile px-6 py-2.5 rounded-xl bg-[#8054D9] text-white font-extrabold text-xs cursor-pointer"
                >
                  Save & Publish Exam
                </button>
              </div>
            </form>
          )}

          {/* 6, 7, 8: MY EXAMS / DRAFT EXAMS / PUBLISHED EXAMS */}
          {(section === 'my-exams' || section === 'draft-exams' || section === 'published-exams') && (
            <div className="nono-card p-5 bg-white space-y-4">
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {section === 'draft-exams'
                  ? language === 'ar' ? 'مسودات الامتحانات' : 'Draft Exams'
                  : section === 'published-exams'
                    ? language === 'ar' ? 'الامتحانات المنشورة' : 'Published Exams'
                    : language === 'ar' ? 'كل امتحاناتي' : 'All My Exams'}
              </h2>
              {(section === 'draft-exams' ? draftExams : section === 'published-exams' ? publishedExams : exams).map((ex) => (
                <div key={ex.id} className="p-4 rounded-2xl border border-[#27345C]/12 bg-[#FFF8E9]/45 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-extrabold">
                      <span className="px-2 py-0.5 rounded bg-[#8054D9] text-white">{ex.status}</span>
                      <span className="px-2 py-0.5 rounded bg-white border">v{ex.version || 1}</span>
                      <span>{language === 'ar' ? 'التأسيس (١–٤)' : 'Foundations'} · {ex.subject}</span>
                      <span>{ex.totalQuestions} Qs · {ex.totalMarks} pts</span>
                    </div>
                    <h3 className="font-extrabold text-base text-[#27345C] mt-1">{t(ex.title, language)}</h3>
                    <p className="text-xs font-bold text-[#27345C]/65">
                      Assignments: {ex.assignmentCount ?? 0} · Completed: {ex.completedCount ?? 0}
                    </p>
                    {ex.adminReviewNote && (
                      <p className="text-xs font-bold text-[#9A3412] mt-0.5">Admin feedback: {ex.adminReviewNote}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    {(ex.status === 'draft' || ex.status === 'rejected') && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/teacher/content/exam/${ex.id}/submit-review`, {
                            method: 'POST',
                          });
                          setNotice('Exam submitted for Admin approval.');
                          await loadAll();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
                      >
                        Submit for Review
                      </button>
                    )}
                    {ex.status === 'draft' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/teacher/exams/${ex.id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'published' }),
                          });
                          await loadAll();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
                      >
                        Publish Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAssignExamId(ex.id);
                        setSection('assign-exams');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#8054D9] text-white font-extrabold cursor-pointer"
                    >
                      Assign to Students
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/teacher/exams/${ex.id}`, { method: 'DELETE' });
                        await loadAll();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FF6B6B]/15 text-[#991B1B] cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 9. ASSIGN EXAMS */}
          {section === 'assign-exams' && (
            <div className="nono-card p-5 bg-white space-y-4">
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'تعيين امتحان لفصول أو طلاب محددين' : 'Assign Exam to Classes & Students'}
              </h2>
              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="block mb-1">Select Exam</label>
                  <select value={assignExamId} onChange={(e) => setAssignExamId(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20 bg-white">
                    <option value="">-- Choose an exam --</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {t(ex.title, language)} ({ex.status} · {ex.totalQuestions} Qs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1">Assign to Whole Classes (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {classes.map((cls) => {
                      const picked = assignClassIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() =>
                            setAssignClassIds((prev) =>
                              picked ? prev.filter((x) => x !== cls.id) : [...prev, cls.id],
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl border cursor-pointer ${picked ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-[#FFF8E9]'}`}
                        >
                          {cls.name} ({cls.students.length})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block mb-1">Or Select Individual Assigned Students</label>
                  <div className="flex flex-wrap gap-2">
                    {students.map((st) => {
                      const picked = assignStudentIds.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() =>
                            setAssignStudentIds((prev) =>
                              picked ? prev.filter((x) => x !== st.id) : [...prev, st.id],
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl border cursor-pointer ${picked ? 'bg-[#39BDF2] text-white border-[#39BDF2]' : 'bg-white'}`}
                        >
                          {st.displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={assignPublishNow} onChange={(e) => setAssignPublishNow(e.target.checked)} />
                  <span>Automatically publish exam if currently draft</span>
                </label>

                <button
                  type="button"
                  disabled={!assignExamId || (assignClassIds.length === 0 && assignStudentIds.length === 0)}
                  onClick={() => setAssignConfirmOpen(true)}
                  className="nono-btn-tactile px-6 py-2.5 rounded-xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer disabled:opacity-40"
                >
                  Review & Confirm Assignment
                </button>
              </div>

              {assignConfirmOpen && (
                <div className="p-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#FFD84D] space-y-2 text-xs">
                  <p className="font-extrabold text-sm text-[#27345C]">Confirm Assignment</p>
                  <p className="font-bold">
                    Classes selected: {assignClassIds.length} · Individual students selected: {assignStudentIds.length}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAssignConfirmOpen(false)} className="px-4 py-1.5 rounded-lg bg-white border font-bold cursor-pointer">Back</button>
                    <button type="button" onClick={() => void handleConfirmAssign()} className="px-5 py-1.5 rounded-lg bg-[#8054D9] text-white font-extrabold cursor-pointer">Confirm & Send to Students</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 10. EXAM RESULTS */}
          {section === 'exam-results' && (
            <div className="nono-card p-5 bg-white space-y-3">
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'نتائج امتحانات الطلاب' : 'Student Exam Results'}
              </h2>
              {results.length === 0 ? (
                <p className="text-xs font-bold text-[#27345C]/65">No submitted attempts yet.</p>
              ) : (
                <div className="space-y-2">
                  {results.map((r) => (
                    <div key={r.id} className="p-3.5 rounded-2xl bg-[#FFF8E9]/60 border border-[#27345C]/10 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                      <div>
                        <p className="font-extrabold text-sm text-[#27345C]">{r.studentName} {r.className ? `· ${r.className}` : ''}</p>
                        <p>{t(r.examTitle, language)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums">{r.score}/{r.totalMarks} ({r.percentage}%)</span>
                        <span className={`px-2.5 py-1 rounded-lg ${r.passed ? 'bg-[#55D98B]/25 text-[#166534]' : 'bg-[#FF6B6B]/20 text-[#991B1B]'}`}>
                          {r.passed ? 'Passed' : 'Needs Review'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 11. STUDENT PERFORMANCE DRILLDOWN */}
          {section === 'student-performance' && (
            <div className="nono-card p-5 bg-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'تفاصيل أداء الطالب' : 'Student Performance Breakdown'}
                </h2>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    if (e.target.value) void loadStudentDrilldown(e.target.value);
                  }}
                  className="h-10 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
                >
                  <option value="">-- Pick Assigned Student --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>{st.displayName}</option>
                  ))}
                </select>
              </div>
              {studentDrilldown && (
                <div className="space-y-4 text-xs font-bold">
                  <div className="p-4 rounded-2xl bg-[#F4EEFF] flex flex-wrap justify-between items-center">
                    <div>
                      <p className="text-lg font-extrabold text-[#27345C]">{studentDrilldown.student.displayName}</p>
                      <p>{getSafeStageShortLabel(studentDrilldown.student.ageGroup, language)} · Stars ⭐ {studentDrilldown.student.stars}</p>
                    </div>
                    <div className="text-end">
                      <p>{language === 'ar' ? 'دروس التأسيس:' : 'Foundations Tracked:'} {Object.keys(studentDrilldown.level1Progress).length}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm">Assigned Teacher Exams Taken:</h4>
                    {studentDrilldown.examAttempts.length === 0 ? (
                      <p className="text-[#27345C]/65">No completed attempts yet.</p>
                    ) : (
                      studentDrilldown.examAttempts.map((a) => (
                        <div key={a.attemptId} className="p-3 rounded-xl bg-[#FFF8E9] flex justify-between">
                          <span>{t(a.examTitle, language)}</span>
                          <span>{a.score}/{a.totalMarks} ({a.percentage}%)</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 12. PROFILE & ACCOUNT SETTINGS */}
          {section === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <form onSubmit={(e) => void handleSaveProfile(e)} className="nono-card p-5 bg-white space-y-3 text-xs font-bold">
                <h3 className="text-base font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'تحديث الملف الشخصي' : 'Profile Settings'}
                </h3>
                <input required value={profName} onChange={(e) => setProfName(e.target.value)} placeholder="Display Name" className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <textarea rows={3} value={profBio} onChange={(e) => setProfBio(e.target.value)} placeholder="Short Teaching Bio" className="w-full p-3 rounded-xl border border-[#27345C]/20" />
                <button type="submit" className="nono-btn-tactile px-5 py-2 rounded-xl bg-[#8054D9] text-white font-extrabold cursor-pointer">Save Profile</button>
              </form>

              <form onSubmit={(e) => void handleChangePassword(e)} className="nono-card p-5 bg-white space-y-3 text-xs font-bold">
                <h3 className="text-base font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                </h3>
                <input type="password" required value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="Current Password" className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <input type="password" required value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New Password (min 12 chars)" className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <input type="password" required value={confPw} onChange={(e) => setConfPw(e.target.value)} placeholder="Confirm New Password" className="w-full h-10 px-3 rounded-xl border border-[#27345C]/20" />
                <button type="submit" className="nono-btn-tactile px-5 py-2 rounded-xl bg-[#27345C] text-white font-extrabold cursor-pointer">Update Password</button>
              </form>
            </div>
          )}
        </div>
      </div>
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="nono-card rounded-3xl p-6 bg-white max-w-sm w-full space-y-4 text-center">
            <h2 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'تأكيد تسجيل الخروج' : 'Confirm Log Out'}
            </h2>
            <p className="text-xs font-bold text-[#27345C]/75">
              {language === 'ar'
                ? 'هل تريد تسجيل الخروج من حساب المعلم؟ سيتم إنهاء الجلسة الحالية بأمان.'
                : 'Are you sure you want to log out of your Teacher Account?'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold text-xs cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLogoutModalOpen(false);
                  await logoutParent();
                  navigate('parent-auth');
                }}
                className="flex-1 h-11 rounded-2xl bg-[#FF4D6D] text-white font-extrabold text-xs cursor-pointer"
              >
                {language === 'ar' ? 'نعم، تسجيل الخروج' : 'Yes, Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
