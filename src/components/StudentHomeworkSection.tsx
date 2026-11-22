import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Paperclip,
  Play,
  Send,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { NonoLandLogo } from './NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { formatNumber } from '../i18n/translations';
import type {
  HomeworkAttachment,
  HomeworkSubmissionStatus,
  HomeworkType,
  LocalizedText,
  TeacherQuestion,
} from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

interface StudentHomeworkCard {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  teacherName: string;
  title: LocalizedText;
  instructions: LocalizedText;
  subject: string;
  level: 1 | 2;
  homeworkType: HomeworkType;
  lessonTitles: Array<{ id: string; title: LocalizedText }>;
  attachments: HomeworkAttachment[];
  questions: Array<
    Pick<
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
      | 'allowMultipleCorrect'
      | 'marks'
    >
  >;
  startDate: string;
  deadline: string;
  hasExtension: boolean;
  maxAttempts: number;
  attemptCount: number;
  effectiveStatus: HomeworkSubmissionStatus;
  savedAnswers: Record<string, string | string[] | Record<string, string>>;
  textResponse?: string;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  passed?: boolean;
  teacherFeedback?: string;
  submittedAt?: string;
  completedAt?: string;
}

const HOMEWORK_TYPE_LABELS: Record<HomeworkType, LocalizedText> = {
  'multiple-choice': { ar: 'اختيار من متعدد', en: 'Multiple Choice' },
  'picture-matching': { ar: 'مطابقة الصور', en: 'Picture Matching' },
  'audio-activity': { ar: 'نشاط صوتي', en: 'Audio Activity' },
  'reading-practice': { ar: 'تدريب قراءة', en: 'Reading Practice' },
  'writing-practice': { ar: 'تدريب كتابة', en: 'Writing Practice' },
  'math-exercise': { ar: 'تمرين رياضيات', en: 'Math Exercise' },
  'interactive-game': { ar: 'نشاط تفاعلي', en: 'Interactive Activity' },
  'teacher-questions': { ar: 'أسئلة المعلم', en: 'Teacher Questions' },
};

export const StudentHomeworkSection: React.FC = () => {
  const { authSession, activeChild, language, navigate, featureFlags } = useNonoLand();
  const [data, setData] = useState<{
    newAssignments: StudentHomeworkCard[];
    inProgress: StudentHomeworkCard[];
    submitted: StudentHomeworkCard[];
    completed: StudentHomeworkCard[];
    overdue: StudentHomeworkCard[];
  }>({
    newAssignments: [],
    inProgress: [],
    submitted: [],
    completed: [],
    overdue: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeCard, setActiveCard] = useState<StudentHomeworkCard | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[] | Record<string, string>>>({});
  const [textResponse, setTextResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadHomework = useCallback(async () => {
    if (!authSession.authenticated || !featureFlags.teacherHomeworkEnabled || !activeChild) return;
    setLoading(true);
    try {
      const q =
        authSession.user?.role === 'student'
          ? ''
          : `?childId=${encodeURIComponent(activeChild.id)}`;
      const res = await fetch(`/api/student/homework${q}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setData({
          newAssignments: d.newAssignments || [],
          inProgress: d.inProgress || [],
          submitted: d.submitted || [],
          completed: d.completed || [],
          overdue: d.overdue || [],
        });
      }
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, [authSession.authenticated, authSession.user?.role, activeChild?.id, featureFlags.teacherHomeworkEnabled]);

  useEffect(() => {
    void loadHomework();
  }, [loadHomework]);

  if (!activeChild) return null;

  const apiPost = async (url: string, body: Record<string, unknown>) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
    });
  };

  const handleOpenHomework = async (card: StudentHomeworkCard) => {
    setErrorMsg('');
    setMessage('');
    setActiveCard(card);
    setAnswers(card.savedAnswers || {});
    setTextResponse(card.textResponse || '');
    if (card.effectiveStatus === 'assigned' || card.effectiveStatus === 'opened') {
      try {
        await apiPost(`/api/student/homework/${card.assignmentId}/open`, {
          studentId: card.studentId,
        });
        void loadHomework();
      } catch {
        // ignore open ping error
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!activeCard) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await apiPost(`/api/student/homework/${activeCard.assignmentId}/save`, {
        studentId: activeCard.studentId,
        answers,
        textResponse,
      });
      const resData = await res.json();
      if (!res.ok) {
        setErrorMsg(resData.error || 'Could not save progress');
      } else {
        soundEngine.playPop();
        setMessage(
          language === 'ar' ? 'تم حفظ إجاباتك بنجاح ✓' : 'Draft saved safely ✓',
        );
        await loadHomework();
      }
    } catch {
      setErrorMsg(language === 'ar' ? 'تعذر الحفظ الآن' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitHomework = async () => {
    if (!activeCard) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await apiPost(`/api/student/homework/${activeCard.assignmentId}/submit`, {
        studentId: activeCard.studentId,
        answers,
        textResponse,
      });
      const resData = await res.json();
      if (!res.ok) {
        setErrorMsg(resData.error || 'Submission blocked');
      } else {
        soundEngine.playCelebration();
        setMessage(
          language === 'ar'
            ? 'أحسنت! تم تسليم الواجب وحصلت على ٣ نجوم 🌟'
            : 'Awesome! Homework submitted (+3 stars) 🌟',
        );
        setActiveCard(null);
        await loadHomework();
      }
    } catch {
      setErrorMsg(language === 'ar' ? 'حدث خطأ أثناء التسليم' : 'Submission error');
    } finally {
      setSaving(false);
    }
  };

  if (!featureFlags.teacherHomeworkEnabled) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
        <Lock className="w-10 h-10 mx-auto text-[#27345C]/40" />
        <h2 className="text-xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'قسم الواجبات متوقف مؤقتاً' : 'Homework Feature Currently Paused'}
        </h2>
        <p className="text-xs font-bold text-[#27345C]/65">
          {language === 'ar'
            ? 'قام مدير النظام بإيقاف وحدة الواجبات مؤقتاً.'
            : 'The administrator has temporarily disabled teacher homework.'}
        </p>
      </div>
    );
  }

  if (!authSession.authenticated) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-4">
        <BookOpen className="w-12 h-12 mx-auto text-[#8054D9]" />
        <h2 className="text-xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'الواجبات المنزلية من معلمك' : 'Teacher Homework & Assignments'}
        </h2>
        <p className="text-xs sm:text-sm font-bold text-[#27345C]/70 max-w-md mx-auto">
          {language === 'ar'
            ? 'سجّل الدخول بحساب الطالب أو ولي الأمر لعرض واجبات الفصل وحلّها.'
            : 'Sign in with your student or parent account to open and complete assigned homework.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('parent-auth')}
          className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
        >
          {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
        </button>
      </div>
    );
  }

  if (activeCard) {
    const isReadOnly =
      activeCard.effectiveStatus === 'submitted' ||
      activeCard.effectiveStatus === 'completed' ||
      activeCard.effectiveStatus === 'overdue';

    return (
      <div className="space-y-5 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveCard(null)}
            className="min-h-[44px] px-4 rounded-xl bg-white border border-[#27345C]/15 font-extrabold text-xs cursor-pointer"
          >
            {language === 'ar' ? '← العودة لقائمة الواجبات' : '← Back to Homework List'}
          </button>
          <span className="text-xs font-extrabold text-[#8054D9] bg-[#8054D9]/10 px-3 py-1.5 rounded-lg">
            {HOMEWORK_TYPE_LABELS[activeCard.homeworkType][language]} · L{activeCard.level}
          </span>
        </div>

        <div className="nono-card rounded-3xl p-6 bg-white space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#27345C]/10 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#27345C]">
                {activeCard.title[language] || activeCard.title.ar || activeCard.title.en}
              </h2>
              <p className="text-xs font-bold text-[#27345C]/65 mt-1">
                {language === 'ar' ? 'المعلم' : 'Teacher'}: {activeCard.teacherName} ·{' '}
                {language === 'ar' ? 'آخر موعد' : 'Due'}:{' '}
                <span className="tabular-nums">
                  {new Date(activeCard.deadline).toLocaleString()}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                soundEngine.speak(
                  activeCard.instructions[language] || activeCard.title[language],
                  language,
                )
              }
              className="min-h-[44px] px-4 rounded-xl bg-[#39BDF2]/15 text-[#27345C] font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-[#39BDF2]" />
              <span>{language === 'ar' ? 'استمع للتعليمات' : 'Listen'}</span>
            </button>
          </div>

          <p className="text-sm font-bold text-[#27345C]/85 bg-[#FFF8E9] p-4 rounded-2xl border border-[#27345C]/10">
            {activeCard.instructions[language] ||
              activeCard.instructions.ar ||
              activeCard.instructions.en}
          </p>

          {activeCard.lessonTitles.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center text-xs font-bold text-[#27345C]/70">
              <BookOpen className="w-4 h-4 text-[#8054D9]" />
              <span>{language === 'ar' ? 'الدروس المرتبطة:' : 'Linked lessons:'}</span>
              {activeCard.lessonTitles.map((l) => (
                <span key={l.id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-[#27345C]">
                  {l.id}: {l.title[language] || l.title.en}
                </span>
              ))}
            </div>
          )}

          {activeCard.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#27345C] flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-[#8054D9]" />
                {language === 'ar' ? 'المرفقات المعتمدة:' : 'Approved Resources:'}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {activeCard.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl border border-[#27345C]/15 bg-[#FFFDF8] flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-bold truncate">{att.fileName}</span>
                    {att.kind === 'audio' ? (
                      <audio controls src={att.url} className="h-8 max-w-[180px]" />
                    ) : (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#8054D9] text-white text-xs font-bold shrink-0"
                      >
                        {language === 'ar' ? 'فتح' : 'Open'}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher Questions inside Homework */}
          {activeCard.questions.length > 0 && (
            <div className="space-y-4 pt-2">
              {activeCard.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl border-2 border-[#27345C]/10 bg-[#FFFDF9] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-sm text-[#27345C]">
                      <span className="tabular-nums text-[#8054D9] me-2">#{idx + 1}</span>
                      {language === 'ar' ? q.promptAr || q.promptEn : q.promptEn || q.promptAr}
                    </p>
                    {(q.audioText || q.audioUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          q.audioText && soundEngine.speak(q.audioText, language)
                        }
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-[#39BDF2]/15 flex items-center justify-center cursor-pointer"
                        aria-label="Replay audio"
                      >
                        <Volume2 className="w-4 h-4 text-[#39BDF2]" />
                      </button>
                    )}
                  </div>

                  {q.options && q.options.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                            }
                            className={`min-h-[48px] p-3 rounded-xl border-2 text-start font-bold text-sm flex items-center gap-2 transition-colors ${
                              selected
                                ? 'border-[#8054D9] bg-[#8054D9]/10 text-[#27345C]'
                                : 'border-[#27345C]/12 bg-white hover:border-[#8054D9]/40'
                            } ${isReadOnly ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                          >
                            {opt.visual && <span className="text-xl">{opt.visual}</span>}
                            <span>
                              {language === 'ar'
                                ? opt.textAr || opt.textEn
                                : opt.textEn || opt.textAr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder={
                        language === 'ar' ? 'اكتب إجابتك هنا...' : 'Type your answer...'
                      }
                      className="w-full min-h-[48px] px-4 rounded-xl border-2 border-[#27345C]/15 bg-white font-bold text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reading / Writing / Activity Response Box */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-[#27345C]">
              {language === 'ar'
                ? 'مساحة الكتابة / ملاحظات النشاط:'
                : 'Practice Writing / Activity Response:'}
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly}
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'اكتب جملتك أو ما تعلمته في هذا الواجب...'
                  : 'Write your response or reading summary here...'
              }
              className="w-full p-3.5 rounded-2xl border-2 border-[#27345C]/12 bg-white text-sm font-bold"
            />
          </div>

          {activeCard.teacherFeedback && (
            <div className="p-4 rounded-2xl bg-[#55D98B]/15 border border-[#55D98B] text-xs font-bold text-[#27345C]">
              <p className="font-extrabold mb-1">
                {language === 'ar' ? 'ملاحظات المعلم:' : 'Teacher Feedback:'}
              </p>
              <p>{activeCard.teacherFeedback}</p>
            </div>
          )}

          {errorMsg && (
            <p className="p-3 rounded-xl bg-[#FF6B6B]/12 text-[#B91C1C] text-xs font-extrabold">
              {errorMsg}
            </p>
          )}
          {message && (
            <p className="p-3 rounded-xl bg-[#55D98B]/20 text-[#166534] text-xs font-extrabold">
              {message}
            </p>
          )}

          {!isReadOnly ? (
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveDraft()}
                className="min-h-[48px] px-5 rounded-2xl bg-white border-2 border-[#27345C]/15 font-extrabold text-sm text-[#27345C] cursor-pointer"
              >
                {language === 'ar' ? 'حفظ التقدم' : 'Save Draft'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSubmitHomework()}
                className="nono-btn-tactile min-h-[48px] px-6 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{language === 'ar' ? 'إرسال الواجب' : 'Submit Homework'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-100 text-xs font-extrabold text-[#27345C] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#8054D9]" />
              <span>
                {activeCard.effectiveStatus === 'overdue'
                  ? language === 'ar'
                    ? 'انتهى موعد التسليم ولا يمكن الإرسال دون تمديد من المعلم.'
                    : 'Deadline passed; submission is locked unless extended by your teacher.'
                  : language === 'ar'
                    ? 'تم تسليم الواجب وحفظ إجاباتك ولا يمكن تعديلها.'
                    : 'Homework submitted and locked safely.'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const sections: Array<{
    key: string;
    title: LocalizedText;
    icon: React.ReactNode;
    badgeClass: string;
    items: StudentHomeworkCard[];
  }> = [
    {
      key: 'new',
      title: { ar: 'واجبات جديدة', en: 'New Assignments' },
      icon: <Sparkles className="w-4 h-4 text-[#8054D9]" />,
      badgeClass: 'bg-[#8054D9]/12 text-[#8054D9]',
      items: data.newAssignments,
    },
    {
      key: 'progress',
      title: { ar: 'قيد التنفيذ', en: 'In Progress' },
      icon: <Clock className="w-4 h-4 text-[#D97706]" />,
      badgeClass: 'bg-[#FFD84D]/35 text-[#92400E]',
      items: data.inProgress,
    },
    {
      key: 'submitted',
      title: { ar: 'بانتظار مراجعة المعلم', en: 'Submitted (Awaiting Review)' },
      icon: <FileText className="w-4 h-4 text-[#0284C7]" />,
      badgeClass: 'bg-[#39BDF2]/20 text-[#0369A1]',
      items: data.submitted,
    },
    {
      key: 'completed',
      title: { ar: 'مكتملة بنجاح', en: 'Completed' },
      icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />,
      badgeClass: 'bg-[#55D98B]/25 text-[#166534]',
      items: data.completed,
    },
    {
      key: 'overdue',
      title: { ar: 'فات موعدها', en: 'Overdue' },
      icon: <AlertTriangle className="w-4 h-4 text-[#DC2626]" />,
      badgeClass: 'bg-[#FF6B6B]/18 text-[#B91C1C]',
      items: data.overdue,
    },
  ];

  const totalCount =
    data.newAssignments.length +
    data.inProgress.length +
    data.submitted.length +
    data.completed.length +
    data.overdue.length;

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-4 rounded-2xl bg-[#55D98B]/20 border border-[#55D98B] text-sm font-extrabold text-[#166534]">
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
            {language === 'ar' ? 'واجباتي المدرسية' : 'My Homework & Assignments'}
          </h2>
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar'
              ? `إجمالي الواجبات المخصصة لـ ${activeChild.displayName}: ${formatNumber(totalCount, language)}`
              : `Total assignments for ${activeChild.displayName}: ${totalCount}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="nono-card rounded-3xl p-8 bg-white text-center text-sm font-bold text-[#27345C]/60 space-y-3">
          <div className="flex justify-center">
            <NonoLandLogo variant="compact" size="sm" language={language} />
          </div>
          <p>{language === 'ar' ? 'جارٍ تحميل الواجبات...' : 'Loading assignments...'}</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
          <div className="flex justify-center">
            <NonoLandLogo variant="compact" size="sm" language={language} />
          </div>
          <p className="font-extrabold text-[#27345C]">
            {language === 'ar'
              ? 'لا توجد واجبات جديدة الآن!'
              : 'No homework assigned right now!'}
          </p>
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar'
              ? 'ستظهر هنا كل الواجبات التي يرسلها معلم فصلك.'
              : 'Any homework assigned by your class teacher will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <div key={sec.key} className="space-y-3">
                <h3 className="text-sm font-extrabold text-[#27345C] flex items-center gap-2">
                  {sec.icon}
                  <span>{sec.title[language]}</span>
                  <span className="tabular-nums text-xs text-[#27345C]/60">
                    ({formatNumber(sec.items.length, language)})
                  </span>
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {sec.items.map((item) => (
                    <div
                      key={item.submissionId}
                      className="nono-card rounded-3xl p-5 bg-white flex flex-col justify-between gap-4 border-2 border-[#27345C]/10"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 ${sec.badgeClass}`}>
                            {sec.icon}
                            <span>{sec.title[language]}</span>
                          </span>
                          <span className="text-[11px] font-bold text-[#27345C]/60 tabular-nums">
                            {new Date(item.deadline).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-base text-[#27345C]">
                          {item.title[language] || item.title.ar || item.title.en}
                        </h4>
                        <p className="text-xs font-bold text-[#27345C]/70 line-clamp-2">
                          {item.instructions[language] || item.instructions.ar}
                        </p>
                        <p className="text-[11px] font-bold text-[#27345C]/60">
                          {HOMEWORK_TYPE_LABELS[item.homeworkType][language]} · {item.teacherName}
                          {item.percentage !== undefined && (
                            <span className="ms-2 font-extrabold text-[#166534] tabular-nums">
                              · {item.percentage}%
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleOpenHomework(item)}
                        className="min-h-[44px] w-full rounded-2xl bg-[#8054D9] text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>
                          {sec.key === 'completed' || sec.key === 'submitted'
                            ? language === 'ar'
                              ? 'عرض الحل والنتيجة'
                              : 'View Submission'
                            : language === 'ar'
                              ? 'افتح الواجب'
                              : 'Open Homework'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
