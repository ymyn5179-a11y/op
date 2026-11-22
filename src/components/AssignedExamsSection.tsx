import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  Play,
  RefreshCw,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import { NonoLandLogo } from './NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { t } from '../i18n/translations';
import type {
  AssignedExamReviewItem,
  LocalizedText,
  TeacherQuestionDifficulty,
  TeacherQuestionOption,
  TeacherQuestionType,
  TeacherSubject,
} from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

export interface AssignedExamCard {
  assignmentId: string;
  examId: string;
  studentId: string;
  studentName: string;
  teacherName: string;
  title: LocalizedText;
  description: LocalizedText;
  subject: TeacherSubject | 'comprehensive';
  level: 1 | 2;
  ageGroup: string;
  totalQuestions: number;
  totalMarks: number;
  passingPercentage: number;
  durationMinutes: number;
  allowedAttempts: number;
  usedAttempts: number;
  availableStartDate: string;
  deadline: string;
  status: string;
  showResults: boolean;
  inProgressAttemptId?: string;
  latestResult?: {
    attemptId: string;
    submittedAt?: string;
    resultsReleased: boolean;
    score?: number;
    totalMarks?: number;
    percentage?: number;
    passed?: boolean;
  };
}

interface SanitizedTeacherQuestion {
  id: string;
  subject: TeacherSubject;
  level: 1 | 2;
  lessonId: string;
  questionType: TeacherQuestionType;
  promptAr: string;
  promptEn: string;
  imageUrl?: string;
  audioUrl?: string;
  audioText?: string;
  options: TeacherQuestionOption[];
  allowMultipleCorrect: boolean;
  matchingLefts: Array<{ id: string; left: string }>;
  matchingRights: string[];
  shuffledOrderItems: string[];
  marks: number;
  difficulty: TeacherQuestionDifficulty;
}

type AnswerValue = string | string[] | Record<string, string>;

interface AssignedExamResultPayload {
  attemptId: string;
  examTitle?: LocalizedText;
  submittedAt?: string;
  showResults: boolean;
  showCorrectAnswers?: boolean;
  message?: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  passed?: boolean;
  passingPercentage?: number;
  review?: AssignedExamReviewItem[];
}

export const AssignedExamsSection: React.FC<{
  onCountChange?: (count: number) => void;
}> = ({ onCountChange }) => {
  const { activeChild, authSession, language, refreshAuthSession } = useNonoLand();
  const [available, setAvailable] = useState<AssignedExamCard[]>([]);
  const [upcoming, setUpcoming] = useState<AssignedExamCard[]>([]);
  const [inProgress, setInProgress] = useState<AssignedExamCard[]>([]);
  const [completed, setCompleted] = useState<AssignedExamCard[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Active Attempt Runner State
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [examMeta, setExamMeta] = useState<{
    id: string;
    title: LocalizedText;
    description: LocalizedText;
    durationMinutes: number;
    totalMarks: number;
    passingPercentage: number;
  } | null>(null);
  const [questions, setQuestions] = useState<SanitizedTeacherQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [lastSavedQId, setLastSavedQId] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Result View State
  const [resultView, setResultView] = useState<AssignedExamResultPayload | null>(null);

  const canFetchStudentExams =
    authSession.authenticated &&
    (authSession.user?.role === 'student' ||
      authSession.user?.role === 'parent' ||
      authSession.user?.role === 'super_admin');

  const fetchAssignedExams = useCallback(async () => {
    if (!canFetchStudentExams) return;
    setLoadingList(true);
    setErrorMsg('');
    try {
      const query =
        authSession.user?.role === 'student'
          ? ''
          : `?childId=${encodeURIComponent(activeChild?.id || '')}`;
      const res = await fetch(`/api/student/exams${query}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not load assigned exams');
        return;
      }
      const avail = (data.available || []) as AssignedExamCard[];
      const inProg = (data.inProgress || []) as AssignedExamCard[];
      setAvailable(avail);
      setUpcoming((data.upcoming || []) as AssignedExamCard[]);
      setInProgress(inProg);
      setCompleted((data.completed || []) as AssignedExamCard[]);
      onCountChange?.(avail.length + inProg.length);
    } catch {
      setErrorMsg(
        language === 'ar' ? 'تعذر تحميل الامتحانات المعينة.' : 'Unable to fetch assigned exams.',
      );
    } finally {
      setLoadingList(false);
    }
  }, [activeChild?.id, authSession.user?.role, canFetchStudentExams, language, onCountChange]);

  useEffect(() => {
    void fetchAssignedExams();
  }, [fetchAssignedExams]);

  const handleSubmitAttempt = useCallback(async () => {
    if (!activeAttemptId || submitting) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);
    setErrorMsg('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(`/api/student/exams/attempts/${activeAttemptId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit exam');
        setSubmitting(false);
        return;
      }
      soundEngine.playSuccess();
      setResultView(data as AssignedExamResultPayload);
      setActiveAttemptId(null);
      setQuestions([]);
      await refreshAuthSession();
      await fetchAssignedExams();
    } catch {
      setErrorMsg(
        language === 'ar' ? 'حدث خطأ أثناء تسليم الامتحان.' : 'Error submitting exam to server.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    activeAttemptId,
    answers,
    authSession.csrfToken,
    fetchAssignedExams,
    language,
    refreshAuthSession,
    submitting,
  ]);

  // Countdown timer
  useEffect(() => {
    if (!activeAttemptId || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void handleSubmitAttempt();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeAttemptId, remainingSeconds, handleSubmitAttempt]);

  if (!activeChild) return null;

  const handleStartOrResume = async (assignmentId: string) => {
    setErrorMsg('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(`/api/student/exams/${assignmentId}/start`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not start assigned exam');
        return;
      }

      const qs = (data.questions || []) as SanitizedTeacherQuestion[];
      const saved = (data.savedAnswers || {}) as Record<string, AnswerValue>;
      // Seed ordering questions with their shuffled items if not answered yet
      const seededAnswers: Record<string, AnswerValue> = { ...saved };
      for (const q of qs) {
        if (q.questionType === 'ordering' && !seededAnswers[q.id] && q.shuffledOrderItems?.length) {
          seededAnswers[q.id] = [...q.shuffledOrderItems];
        }
      }

      setActiveAttemptId(data.attemptId);
      setExamMeta(data.exam);
      setQuestions(qs);
      setAnswers(seededAnswers);
      setCurrentIdx(0);
      setRemainingSeconds(Number(data.remainingSeconds || 600));
      setResultView(null);
      soundEngine.playPop();
    } catch {
      setErrorMsg(language === 'ar' ? 'تعذر بدء الامتحان.' : 'Failed to start assigned exam.');
    }
  };

  const persistAnswer = async (questionId: string, answer: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (!activeAttemptId) return;
    setSavingAnswer(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(`/api/student/exams/attempts/${activeAttemptId}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ questionId, answer }),
      });
      if (res.ok) setLastSavedQId(questionId);
    } catch {
      // keep local answer intact so final submit still carries it
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleViewPastResult = async (attemptId: string) => {
    setErrorMsg('');
    try {
      const res = await fetch(`/api/student/exams/attempts/${attemptId}/result`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not load result');
        return;
      }
      setResultView(data as AssignedExamResultPayload);
    } catch {
      setErrorMsg(language === 'ar' ? 'تعذر عرض النتيجة.' : 'Could not load exam result.');
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // -------------------------------------------------------------------------
  // 1. SUBMITTED RESULT VIEW
  // -------------------------------------------------------------------------
  if (resultView) {
    return (
      <div className="space-y-5 max-w-4xl mx-auto">
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-[#8054D9]/15 text-[#8054D9] flex items-center justify-center mx-auto">
            <Award className="w-9 h-9" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
            {resultView.examTitle
              ? t(resultView.examTitle, language)
              : language === 'ar'
                ? 'تم تسليم الامتحان بنجاح'
                : 'Exam Submitted Successfully'}
          </h2>

          {!resultView.showResults ? (
            <div className="p-5 rounded-3xl bg-[#FFF8E9] border border-[#27345C]/12 max-w-lg mx-auto space-y-2">
              <p className="font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? 'تم حفظ إجاباتك بأمان على الخادم ✓'
                  : 'Your answers have been saved securely ✓'}
              </p>
              <p className="text-sm text-[#27345C]/75">
                {language === 'ar'
                  ? 'سيقوم المعلم بإتاحة الدرجات التفصيلية بعد المراجعة.'
                  : resultView.message || 'Results will appear once released by your teacher.'}
              </p>
            </div>
          ) : (
            <div className="inline-flex flex-wrap items-center justify-center gap-6 px-6 py-4 rounded-3xl bg-[#FFF8E9] border border-[#27345C]/12 font-mono-num">
              <div>
                <div className="text-xs text-[#27345C]/65">{language === 'ar' ? 'الدرجة' : 'Score'}</div>
                <div className="text-3xl font-extrabold text-[#8054D9]">
                  {resultView.score} / {resultView.totalMarks}
                </div>
              </div>
              <div className="w-px h-10 bg-[#27345C]/15" />
              <div>
                <div className="text-xs text-[#27345C]/65">{language === 'ar' ? 'النسبة' : 'Percentage'}</div>
                <div className="text-3xl font-extrabold text-[#27345C]">{resultView.percentage}%</div>
              </div>
              <div className="w-px h-10 bg-[#27345C]/15" />
              <div>
                <div className="text-xs text-[#27345C]/65">{language === 'ar' ? 'الحالة' : 'Status'}</div>
                <div
                  className={`text-xl font-extrabold ${
                    resultView.passed ? 'text-[#55D98B]' : 'text-[#FF9360]'
                  }`}
                >
                  {resultView.passed
                    ? language === 'ar'
                      ? 'ناجح ✓'
                      : 'Passed ✓'
                    : language === 'ar'
                      ? 'يحتاج مراجعة'
                      : 'Needs Review'}
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setResultView(null)}
            className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
          >
            {language === 'ar' ? 'العودة لقائمة الامتحانات' : 'Back to Assigned Exams'}
          </button>
        </div>

        {resultView.showResults && resultView.review && resultView.review.length > 0 && (
          <div className="nono-card rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'مراجعة الأسئلة' : 'Question Review'}
            </h3>
            <div className="space-y-3">
              {resultView.review.map((row, i) => (
                <div
                  key={row.questionId}
                  className={`p-4 rounded-2xl border ${
                    row.isCorrect
                      ? 'bg-[#E2F9EC]/50 border-[#55D98B]'
                      : 'bg-[#FFF3D1]/60 border-[#FF9360]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-sm text-[#27345C]">
                      {i + 1}. {t(row.prompt, language)}
                    </p>
                    <span className="text-xs font-mono-num font-extrabold shrink-0">
                      {row.marksAwarded} / {row.maxMarks}
                    </span>
                  </div>
                  {row.feedback && (
                    <p className="text-xs font-bold text-[#8054D9] mt-1">{t(row.feedback, language)}</p>
                  )}
                  {row.explanation && (row.explanation.ar || row.explanation.en) && (
                    <p className="text-xs text-[#27345C]/75 mt-1">{t(row.explanation, language)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. ACTIVE ASSIGNED EXAM RUNNER (SUPPORTS ALL 8 QUESTION TYPES)
  // -------------------------------------------------------------------------
  if (activeAttemptId && questions.length > 0 && examMeta) {
    const q = questions[currentIdx];
    const currentAns = answers[q.id];
    const answeredCount = questions.filter((item) => {
      const a = answers[item.id];
      if (Array.isArray(a)) return a.length > 0;
      if (a && typeof a === 'object') return Object.keys(a).length > 0;
      return typeof a === 'string' && a.trim().length > 0;
    }).length;

    const promptText = language === 'ar' ? q.promptAr || q.promptEn : q.promptEn || q.promptAr;

    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#FF4D6D]/12 text-[#FF4D6D] text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* Top Progress & Countdown Timer Bar */}
        <div className="nono-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#27345C]">
              <span>
                {t(examMeta.title, language)} ·{' '}
                {language === 'ar'
                  ? `السؤال ${currentIdx + 1} من ${questions.length}`
                  : `Question ${currentIdx + 1} of ${questions.length}`}
              </span>
              <span className="font-mono-num text-[#8054D9]">
                {answeredCount}/{questions.length} {language === 'ar' ? 'مجاب' : 'answered'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#FFF8E9] overflow-hidden">
              <div
                className="h-full bg-[#8054D9] transition-all"
                style={{ width: `${Math.round(((currentIdx + 1) / questions.length) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-3 py-1.5 rounded-xl font-mono-num text-xs font-extrabold flex items-center gap-1 ${
                remainingSeconds <= 60
                  ? 'bg-[#FF4D6D]/15 text-[#FF4D6D]'
                  : 'bg-[#FFF8E9] text-[#27345C]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {formatTimer(remainingSeconds)}
            </span>
            <span className="px-2.5 py-1.5 rounded-xl bg-[#E2F9EC] text-[11px] font-extrabold text-[#27345C]">
              {savingAnswer
                ? language === 'ar'
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : lastSavedQId === q.id
                  ? language === 'ar'
                    ? 'تم الحفظ ✓'
                    : 'Saved ✓'
                  : `${q.marks} ${language === 'ar' ? 'درجة' : 'pts'}`}
            </span>
          </div>
        </div>

        {/* Question Card */}
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-3">
            <span className="inline-block px-3 py-1 rounded-xl bg-[#F3E8FF] text-[#8054D9] text-xs font-extrabold">
              {q.questionType} · {q.lessonId}
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C] leading-snug">
              {promptText}
            </h2>

            {q.imageUrl && (
              <img
                src={q.imageUrl}
                alt={promptText}
                className="max-h-52 mx-auto rounded-2xl border border-[#27345C]/10 object-contain"
              />
            )}

            {(q.audioText || q.audioUrl) && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (q.audioUrl) {
                      const audio = new Audio(q.audioUrl);
                      void audio.play().catch(() => {});
                    } else if (q.audioText) {
                      soundEngine.speak(q.audioText, language, { slow: true });
                    }
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-[#FFD84D]/55 text-[#27345C] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{language === 'ar' ? 'استمع للسؤال' : 'Play Audio'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Choice / True-False / Picture-ID / Audio-ID */}
          {(q.questionType === 'multiple-choice' ||
            q.questionType === 'true-false' ||
            q.questionType === 'picture-id' ||
            q.questionType === 'audio-id') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {q.options.map((opt) => {
                const selectedList = Array.isArray(currentAns) ? currentAns : [];
                const isSelected = q.allowMultipleCorrect
                  ? selectedList.includes(opt.id)
                  : currentAns === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      if (q.allowMultipleCorrect) {
                        const next = isSelected
                          ? selectedList.filter((id) => id !== opt.id)
                          : [...selectedList, opt.id];
                        void persistAnswer(q.id, next);
                      } else {
                        void persistAnswer(q.id, opt.id);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#8054D9]/12 border-[#8054D9] shadow-md'
                        : 'bg-[#FFF8E9] border-[#27345C]/12 hover:border-[#8054D9]/50'
                    }`}
                  >
                    {opt.visual && <span className="text-3xl shrink-0">{opt.visual}</span>}
                    <span className="text-sm sm:text-base font-extrabold text-[#27345C]">
                      {language === 'ar' ? opt.textAr || opt.textEn : opt.textEn || opt.textAr}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill-blank or Short-answer */}
          {(q.questionType === 'fill-blank' || q.questionType === 'short-answer') && (
            <div className="max-w-md mx-auto space-y-2">
              <label className="block text-xs font-extrabold text-[#27345C]/70 text-center">
                {language === 'ar' ? 'اكتب إجابتك هنا:' : 'Type your answer:'}
              </label>
              <input
                type="text"
                value={typeof currentAns === 'string' ? currentAns : ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                onBlur={(e) => void persistAnswer(q.id, e.target.value)}
                placeholder={language === 'ar' ? 'اكتب الإجابة...' : 'Enter your answer...'}
                className="w-full h-12 px-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/20 focus:border-[#8054D9] outline-none text-center font-bold text-base"
              />
            </div>
          )}

          {/* Matching Pairs */}
          {q.questionType === 'matching' && (
            <div className="space-y-3">
              {q.matchingLefts.map((item) => {
                const pairMap =
                  currentAns && typeof currentAns === 'object' && !Array.isArray(currentAns)
                    ? (currentAns as Record<string, string>)
                    : {};
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="font-extrabold text-sm sm:text-base text-[#27345C]">
                      {item.left}
                    </span>
                    <select
                      value={pairMap[item.id] || ''}
                      onChange={(e) => {
                        const updated = { ...pairMap, [item.id]: e.target.value };
                        void persistAnswer(q.id, updated);
                      }}
                      className="h-10 px-3 rounded-xl bg-white border border-[#27345C]/20 text-sm font-bold text-[#27345C] min-w-[160px]"
                    >
                      <option value="">
                        {language === 'ar' ? '-- اختر المطابق --' : '-- Select match --'}
                      </option>
                      {q.matchingRights.map((r, rIdx) => (
                        <option key={`${r}-${rIdx}`} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ordering / Sequence */}
          {q.questionType === 'ordering' && (
            <div className="space-y-2.5 max-w-md mx-auto">
              <p className="text-xs font-bold text-center text-[#27345C]/70">
                {language === 'ar'
                  ? 'رتّب العناصر بالترتيب الصحيح من الأعلى للأسفل:'
                  : 'Arrange items in the correct order from top to bottom:'}
              </p>
              {(Array.isArray(currentAns) ? currentAns : q.shuffledOrderItems).map((val, idx, arr) => (
                <div
                  key={`${val}-${idx}`}
                  className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex items-center justify-between gap-2"
                >
                  <span className="w-7 h-7 rounded-lg bg-[#8054D9] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-extrabold text-sm text-[#27345C] flex-1 text-center">
                    {val}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const next = [...arr];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        void persistAnswer(q.id, next);
                      }}
                      className="p-1.5 rounded-lg bg-white border border-[#27345C]/15 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === arr.length - 1}
                      onClick={() => {
                        const next = [...arr];
                        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                        void persistAnswer(q.id, next);
                      }}
                      className="p-1.5 rounded-lg bg-white border border-[#27345C]/15 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation / Submit Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="px-5 py-2.5 rounded-2xl bg-white border border-[#27345C]/15 font-bold text-sm disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            {language === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{language === 'ar' ? 'السابق' : 'Previous'}</span>
          </button>

          {currentIdx + 1 < questions.length ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="nono-btn-tactile px-6 py-2.5 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'ar' ? 'التالي' : 'Next'}</span>
              {language === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowSubmitConfirm(true)}
              className="nono-btn-tactile px-7 py-3 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{language === 'ar' ? 'تسليم الامتحان' : 'Submit Exam'}</span>
            </button>
          )}
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md nono-card rounded-3xl p-6 space-y-4 text-center">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#8054D9]">
                  {language === 'ar' ? 'تأكيد التسليم' : 'Confirm Submission'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="p-1.5 rounded-full bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? 'هل أنت متأكد من تسليم إجاباتك؟'
                  : 'Are you sure you want to submit this exam?'}
              </h3>
              <p className="text-xs font-bold text-[#27345C]/75">
                {language === 'ar'
                  ? `أجبت على ${answeredCount} من أصل ${questions.length} أسئلة. لا يمكن تعديل الإجابات بعد التسليم.`
                  : `You answered ${answeredCount} of ${questions.length} questions. Answers cannot be edited after submitting.`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 h-11 rounded-2xl bg-slate-100 font-bold text-sm cursor-pointer"
                >
                  {language === 'ar' ? 'مراجعة الإجابات' : 'Review Answers'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmitAttempt()}
                  className="flex-1 nono-btn-tactile h-11 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm cursor-pointer"
                >
                  {submitting
                    ? language === 'ar'
                      ? 'جاري التسليم...'
                      : 'Submitting...'
                    : language === 'ar'
                      ? 'تأكيد التسليم ✓'
                      : 'Confirm Submit ✓'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. ASSIGNED EXAMS LISTING (AVAILABLE / IN-PROGRESS / UPCOMING / COMPLETED)
  // -------------------------------------------------------------------------
  if (!canFetchStudentExams) {
    return (
      <div className="nono-card rounded-3xl p-8 text-center space-y-3">
        <ClipboardList className="w-10 h-10 text-[#8054D9] mx-auto" />
        <h3 className="text-xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'الامتحانات المدرسية المعينة' : 'Teacher-Assigned Exams'}
        </h3>
        <p className="text-sm text-[#27345C]/75 max-w-md mx-auto">
          {language === 'ar'
            ? 'سجّل الدخول بحساب الطالب أو ولي الأمر لعرض الامتحانات المرسلة من معلمك.'
            : 'Sign in with a Student or Parent account to view exams assigned by your teacher.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-[#27345C] flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#8054D9]" />
            <span>{language === 'ar' ? 'الامتحانات المعينة من المعلم' : 'Teacher-Assigned Exams'}</span>
          </h2>
          <p className="text-xs text-[#27345C]/70">
            {language === 'ar'
              ? `الامتحانات المخصصة للطالب: ${activeChild.displayName}`
              : `Assignments scoped to student: ${activeChild.displayName}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchAssignedExams()}
          disabled={loadingList}
          className="px-3.5 py-2 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-[#FF4D6D]/12 text-[#FF4D6D] text-xs font-bold">{errorMsg}</div>
      )}

      {/* In-Progress + Available */}
      {(inProgress.length > 0 || available.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inProgress.map((card) => (
            <div
              key={card.assignmentId}
              className="nono-card rounded-3xl p-5 border-2 border-[#FFD84D] bg-gradient-to-br from-[#FFF8E9] to-white space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-xl bg-[#FFD84D] text-[#27345C] text-xs font-extrabold">
                  {language === 'ar' ? 'قيد التنفيذ ⏳' : 'In Progress ⏳'}
                </span>
                <span className="text-xs font-bold text-[#27345C]/65">
                  {card.durationMinutes}m · {card.totalQuestions} Qs
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#27345C]">{t(card.title, language)}</h3>
              <p className="text-xs text-[#27345C]/75">
                {card.teacherName} · {card.subject}
              </p>
              <button
                type="button"
                onClick={() => void handleStartOrResume(card.assignmentId)}
                className="w-full nono-btn-tactile py-2.5 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{language === 'ar' ? 'استكمال الامتحان' : 'Resume Exam'}</span>
              </button>
            </div>
          ))}

          {available.map((card) => (
            <div key={card.assignmentId} className="nono-card rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-xl bg-[#55D98B]/25 text-[#27345C] text-xs font-extrabold">
                  {language === 'ar' ? 'متاح الآن' : 'Available Now'}
                </span>
                <span className="text-xs font-mono-num font-bold text-[#27345C]/65">
                  {card.durationMinutes}m · {card.totalQuestions} Qs · {card.totalMarks} pts
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#27345C]">{t(card.title, language)}</h3>
              <p className="text-xs text-[#27345C]/75">
                {card.teacherName} · {language === 'ar' ? 'النجاح' : 'Pass'} ≥ {card.passingPercentage}% ·{' '}
                {language === 'ar'
                  ? `المحاولات ${card.usedAttempts}/${card.allowedAttempts}`
                  : `Attempts ${card.usedAttempts}/${card.allowedAttempts}`}
              </p>
              <button
                type="button"
                onClick={() => void handleStartOrResume(card.assignmentId)}
                className="w-full nono-btn-tactile py-2.5 rounded-2xl bg-[#39BDF2] text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{language === 'ar' ? 'ابدأ الامتحان' : 'Start Exam'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {inProgress.length === 0 && available.length === 0 && !loadingList && (
        <div className="nono-card rounded-3xl p-6 text-center text-sm text-[#27345C]/70 space-y-3">
          <div className="flex justify-center">
            <NonoLandLogo variant="compact" size="xs" language={language} />
          </div>
          <p>
            {language === 'ar'
              ? 'لا توجد امتحانات نشطة معينة لك حالياً.'
              : 'No active assigned exams right now.'}
          </p>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="nono-card rounded-3xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-[#27345C]">
            {language === 'ar' ? 'امتحانات مجدولة قادمة' : 'Upcoming Scheduled Exams'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((card) => (
              <div key={card.assignmentId} className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 text-xs space-y-1">
                <p className="font-extrabold text-sm text-[#27345C]">{t(card.title, language)}</p>
                <p className="text-[#27345C]/70">
                  {card.teacherName} · {new Date(card.availableStartDate).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="nono-card rounded-3xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-[#27345C] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#55D98B]" />
            <span>{language === 'ar' ? 'الامتحانات المكتملة' : 'Completed Teacher Exams'}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {completed.map((card) => (
              <div
                key={card.assignmentId}
                className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-extrabold text-sm text-[#27345C]">{t(card.title, language)}</p>
                  <p className="text-[#27345C]/65">
                    {card.latestResult?.resultsReleased
                      ? `${card.latestResult.score}/${card.latestResult.totalMarks} (${card.latestResult.percentage}%)`
                      : language === 'ar'
                        ? 'بانتظار إعلان النتيجة من المعلم'
                        : 'Pending teacher result release'}
                  </p>
                </div>
                {card.latestResult && (
                  <button
                    type="button"
                    onClick={() => void handleViewPastResult(card.latestResult!.attemptId)}
                    className="px-3 py-1.5 rounded-xl bg-[#27345C] text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'التفاصيل' : 'View'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
