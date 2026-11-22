import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { AssignedExamsSection } from '../components/AssignedExamsSection';
import { CertificateModal } from '../components/CertificateModal';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { StudentHomeworkSection } from '../components/StudentHomeworkSection';
import { useNonoLand } from '../context/NonoLandContext';
import { AGE_CURRICULUM_OUTCOMES } from '../data/deepCurriculum';
import { formatNumber, getAgeGroupMeta, t } from '../i18n/translations';
import {
  Certificate,
  ExamAttemptSummary,
  ExamConfig,
  ExamQuestionItem,
  ExamSubject,
} from '../types/nonoland';
import { UNIFIED_STAGE_ID } from '../utils/ageAdaptation';
import { AcademyAudioBar } from '../components/academy/AcademyAudioBar';
import { useAcademyAudio } from '../utils/academyAudioController';
import { soundEngine } from '../utils/soundEngine';

type ClientExamQuestion = Omit<ExamQuestionItem, 'correctOptionId' | 'explanation'>;

interface ReviewRow {
  questionId: string;
  prompt: { ar: string; en: string };
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: { ar: string; en: string };
  lessonTitle: { ar: string; en: string };
}

export const ExamsScreen: React.FC = () => {
  const { activeChild, language, recordExamCompletion, navigate, authSession, featureFlags } = useNonoLand();
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    examPriceEgp: 50,
    currency: 'EGP',
    passingPercentage: 70,
    questionsPerExam: 40,
    paymentGatewayMode: 'development-test-verification',
  });

  const [subject, setSubject] = useState<ExamSubject>('comprehensive');
  const [examViewMode, setExamViewMode] = useState<'official' | 'assigned' | 'homework'>(
    authSession.user?.role === 'student' ? 'assigned' : 'official',
  );
  const [assignedCount, setAssignedCount] = useState(0);
  const [homeworkCount, setHomeworkCount] = useState(0);

  // Active Exam Runner State
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClientExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingExam, setLoadingExam] = useState(false);
  const [examError, setExamError] = useState('');

  // Results State
  const [resultSummary, setResultSummary] = useState<ExamAttemptSummary | null>(null);
  const [issuedCert, setIssuedCert] = useState<Certificate | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [showCertModal, setShowCertModal] = useState(false);

  // Parent-Gated Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [gateInput, setGateInput] = useState('');
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [gateError, setGateError] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const academyAudio = useAcademyAudio(language);

  useEffect(() => {
    academyAudio.stop();
  }, [currentIdx, attemptId, resultSummary, examViewMode]);

  useEffect(() => {
    fetch('/api/config/exams')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setExamConfig(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authSession.user?.role === 'student') {
      setExamViewMode('assigned');
    }
    if (
      authSession.authenticated &&
      activeChild &&
      (authSession.user?.role === 'student' || authSession.user?.role === 'parent')
    ) {
      const q =
        authSession.user.role === 'student'
          ? ''
          : `?childId=${encodeURIComponent(activeChild.id)}`;
      fetch(`/api/student/exams${q}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setAssignedCount((d.available?.length || 0) + (d.inProgress?.length || 0));
          }
        })
        .catch(() => {});
      fetch(`/api/student/homework${q}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setHomeworkCount((d.newAssignments?.length || 0) + (d.inProgress?.length || 0));
          }
        })
        .catch(() => {});
    }
  }, [authSession.authenticated, authSession.user?.role, activeChild]);

  if (!activeChild) return null;

  const studiedConceptIds = Object.keys(activeChild.conceptMastery || {});

  const startExamRequest = async (
    mode: 'practice' | 'official',
    questionCount?: number,
    paymentVerificationToken?: string,
  ) => {
    setLoadingExam(true);
    setExamError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch('/api/exams/start', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          childId: activeChild.id,
          childName: activeChild.displayName,
          ageGroup: UNIFIED_STAGE_ID,
          subject,
          mode,
          questionCount,
          paymentVerificationToken,
          studiedConceptIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExamError(data.error || 'Failed to start exam');
        setLoadingExam(false);
        return;
      }
      setAttemptId(data.attemptId);
      setQuestions(data.questions || []);
      setCurrentIdx(0);
      setAnswers({});
      setResultSummary(null);
      setIssuedCert(null);
      setReviewRows([]);
      soundEngine.playPop();
    } catch {
      setExamError(
        language === 'ar'
          ? 'تعذر الاتصال بخادم الامتحانات الآن.'
          : 'Unable to reach exam server right now.',
      );
    } finally {
      setLoadingExam(false);
    }
  };

  const handleParentConfirmPurchase = async () => {
    setPaymentProcessing(true);
    setExamError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const createRes = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          childId: activeChild.id,
          subject,
          parentConfirmed: true,
        }),
      });
      const checkout = await createRes.json();
      if (!createRes.ok) {
        throw new Error(checkout.error || 'Checkout creation failed');
      }

      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ checkoutSessionId: checkout.checkoutSessionId }),
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok || !verified.verified) {
        throw new Error('Payment verification failed');
      }

      setShowPaymentModal(false);
      setGateUnlocked(false);
      setGateInput('');
      await startExamRequest('official', examConfig.questionsPerExam, verified.paymentVerificationToken);
    } catch {
      setExamError(
        language === 'ar'
          ? 'تعذر إتمام التحقق من الدفع على الخادم.'
          : 'Could not verify payment on the server.',
      );
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleSubmitExam = async () => {
    if (!attemptId) return;
    setLoadingExam(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch('/api/exams/submit', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ attemptId, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExamError(data.error || 'Failed to grade exam');
        setLoadingExam(false);
        return;
      }
      setResultSummary(data.summary);
      setIssuedCert(data.certificate || null);
      setReviewRows(data.review || []);
      setAttemptId(null);
      setQuestions([]);
      recordExamCompletion(data.summary, data.certificate);
    } catch {
      setExamError(
        language === 'ar' ? 'حدث خطأ أثناء تصحيح الامتحان.' : 'Error grading exam on server.',
      );
    } finally {
      setLoadingExam(false);
    }
  };

  const ageOutcome = AGE_CURRICULUM_OUTCOMES['1-4'];

  // ---------------------------------------------------------------
  // VIEW 1: EXAM RESULTS SCREEN (PASS / REVISION PLAN / REVIEW)
  // ---------------------------------------------------------------
  if (resultSummary) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 text-center space-y-5">
          <NonoCharacter
            mood={resultSummary.passed ? 'celebrating' : 'encouraging'}
            scarfColor={activeChild.companionScarfColor}
            size="lg"
            language={language}
          />
          <div className="space-y-2">
            <span
              className={`inline-block px-4 py-1.5 rounded-full text-xs font-extrabold ${
                resultSummary.passed ? 'bg-[#55D98B] text-[#27345C]' : 'bg-[#FFD84D] text-[#27345C]'
              }`}
            >
              {resultSummary.mode === 'official'
                ? language === 'ar'
                  ? 'امتحان نونو لاند الرسمي المعتمد'
                  : 'NonoLand Official Certified Exam'
                : language === 'ar'
                  ? 'اختبار تدريبي مجاني'
                  : 'Free Practice Test'}
            </span>
            <h1 className="text-3xl font-extrabold text-[#27345C]">
              {resultSummary.passed
                ? language === 'ar'
                  ? `مبروك يا ${activeChild.displayName}! نجحت بتفوق! 🎉`
                  : `Congratulations ${activeChild.displayName}! You Passed! 🎉`
                : language === 'ar'
                  ? `خطوة رائعة يا ${activeChild.displayName}! لنراجع معاً ونحاول مجدداً`
                  : `Good Effort ${activeChild.displayName}! Let's Revise & Try Again`}
            </h1>
          </div>

          <div className="inline-flex flex-wrap items-center justify-center gap-6 px-6 py-4 rounded-3xl bg-[#FFF8E9] border border-[#27345C]/12 font-mono-num">
            <div>
              <div className="text-xs text-[#27345C]/65">{language === 'ar' ? 'الدرجة' : 'Score'}</div>
              <div className="text-3xl font-extrabold text-[#8054D9]">
                {resultSummary.score} / {resultSummary.totalQuestions}
              </div>
            </div>
            <div className="w-px h-10 bg-[#27345C]/15" />
            <div>
              <div className="text-xs text-[#27345C]/65">{language === 'ar' ? 'النسبة المئوية' : 'Percentage'}</div>
              <div className="text-3xl font-extrabold text-[#27345C]">{resultSummary.percentage}%</div>
            </div>
            <div className="w-px h-10 bg-[#27345C]/15" />
            <div>
              <div className="text-xs text-[#27345C]/65">{language === 'ar' ? 'شرط النجاح' : 'Passing Mark'}</div>
              <div className="text-xl font-extrabold text-[#55D98B]">≥ {resultSummary.passingPercentage}%</div>
            </div>
          </div>

          {issuedCert ? (
            <div className="p-5 rounded-3xl bg-[#E2F9EC] border-2 border-[#55D98B] space-y-3 max-w-xl mx-auto">
              <div className="flex items-center justify-center gap-2 font-extrabold text-[#27345C]">
                <Award className="w-6 h-6 text-[#FF9360]" />
                <span>
                  {language === 'ar'
                    ? `تم إصدار شهادتك الرسمية برقم: ${issuedCert.uniqueCode}`
                    : `Official Certificate Issued: ${issuedCert.uniqueCode}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCertModal(true)}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'عرض وطباعة / حفظ PDF للشهادة' : 'View, Print & Download Certificate (PDF)'}
              </button>
            </div>
          ) : (
            !resultSummary.passed && (
              <div className="p-5 rounded-3xl bg-[#FFF3D1] border border-[#FFD84D] text-start space-y-3 max-w-xl mx-auto">
                <p className="font-extrabold text-sm text-[#27345C]">
                  {language === 'ar'
                    ? `للحصول على الشهادة الرسمية يجب تحقيق ${resultSummary.passingPercentage}% على الأقل (٢٨ من ٤٠). لا تُصدر الشهادة قبل ذلك، ويمكنك الإعادة بعد مراجعة الدروس التالية:`
                    : `Official certificates require at least ${resultSummary.passingPercentage}% (28/40). Review these recommended lessons, then retake!`}
                </p>
                {resultSummary.weakLessonTitles.length > 0 && (
                  <ul className="list-disc ps-5 text-xs font-bold text-[#27345C]/80 space-y-1">
                    {resultSummary.weakLessonTitles.map((wl, i) => (
                      <li key={i}>{t(wl, language)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('academy')}
              className="px-5 py-3 rounded-2xl bg-[#39BDF2] text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>{language === 'ar' ? 'مراجعة الدروس في الأكاديمية' : 'Revise in Academy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setResultSummary(null)}
              className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{language === 'ar' ? 'العودة لمركز الامتحانات' : 'Back to Exam Center'}</span>
            </button>
          </div>
        </div>

        {/* Question-by-Question Review */}
        {reviewRows.length > 0 && (
          <div className="nono-card rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'مراجعة الإجابات الصحيحة' : 'Answer Review & Explanations'}
            </h2>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pe-1">
              {reviewRows.map((row, idx) => (
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
                      {idx + 1}. {t(row.prompt, language)}
                    </p>
                    <span className="text-xs font-extrabold shrink-0">
                      {row.isCorrect ? '✓' : '↺'}
                    </span>
                  </div>
                  <p className="text-xs text-[#27345C]/75 mt-1">{t(row.explanation, language)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCertModal && issuedCert && (
          <CertificateModal
            certificate={issuedCert}
            language={language}
            onClose={() => setShowCertModal(false)}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // VIEW 2: ACTIVE EXAM RUNNER (1..40 QUESTIONS)
  // ---------------------------------------------------------------
  if (attemptId && questions.length > 0) {
    const q = questions[currentIdx];
    const answeredCount = Object.keys(answers).length;
    const selectedOpt = answers[q.id];

    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="nono-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#27345C]">
              <span>
                {language === 'ar' ? `السؤال ${currentIdx + 1} من ${questions.length}` : `Question ${currentIdx + 1} of ${questions.length}`}
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
          <span className="px-3 py-1 rounded-xl bg-[#FFF8E9] text-[11px] font-extrabold text-[#8054D9]">
            {q.type}
          </span>
        </div>

        <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#27345C]/65">
            <span>{t(q.lessonTitle, language)}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
            {t(q.prompt, language)}
          </h2>

          {q.visualCue && (
            <div className="text-4xl sm:text-5xl py-2 tracking-wider">{q.visualCue}</div>
          )}

          {q.audioText && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  void academyAudio.speak(q.audioText!, q.audioLang || language, {
                    slow: true,
                    label: language === 'ar' ? 'استمع للسؤال بوضوح' : 'Listen to Question',
                  })
                }
                className="px-5 py-2.5 rounded-2xl bg-[#FFD84D]/50 text-[#27345C] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>{language === 'ar' ? 'استمع للسؤال بوضوح' : 'Listen to Question'}</span>
              </button>
              <div className="max-w-lg mx-auto text-start">
                <AcademyAudioBar
                  snapshot={academyAudio.snapshot}
                  language={language}
                  onPause={academyAudio.pause}
                  onResume={academyAudio.resume}
                  onReplay={academyAudio.replay}
                  onStop={academyAudio.stop}
                  onRetry={academyAudio.retry}
                  onDismiss={academyAudio.dismiss}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {q.options.map((opt) => {
              const isSelected = selectedOpt === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                  }}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[#8054D9]/12 border-[#8054D9] scale-[1.03] shadow-md'
                      : 'bg-[#FFF8E9] border-[#27345C]/12 hover:border-[#8054D9]/50'
                  }`}
                >
                  <div className="text-4xl font-extrabold">{opt.visual}</div>
                  <div className="text-sm font-extrabold text-[#27345C]">{t(opt.label, language)}</div>
                </button>
              );
            })}
          </div>
        </div>

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
              disabled={loadingExam}
              onClick={handleSubmitExam}
              className="nono-btn-tactile px-7 py-3 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{language === 'ar' ? 'تسليم الامتحان والتصحيح' : 'Submit & Grade Exam'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // VIEW 3: EXAM CENTER LANDING (PRACTICE VS OFFICIAL 50 EGP EXAM)
  // ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-[#27345C] via-[#4C3B96] to-[#8054D9] text-white p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-start">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-extrabold text-[#FFD84D]">
              <NonoLandLogo variant="badge" size="xs" tone="dark" language={language} />
              <span>
                {t(getAgeGroupMeta(activeChild.ageGroup).label, language)} ·{' '}
                {formatNumber(examConfig.questionsPerExam, language)} {language === 'ar' ? 'سؤالاً' : 'Questions'} ·{' '}
                {language === 'ar' ? `النجاح ≥ ${examConfig.passingPercentage}%` : `Pass ≥ ${examConfig.passingPercentage}%`}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center justify-center md:justify-start gap-2.5">
              <ClipboardCheck className="w-8 h-8 text-[#FFD84D]" />
              <span>{language === 'ar' ? 'امتحانات نونو لاند الرسمية' : 'NonoLand Official Exams'}</span>
            </h1>
            <p className="text-sm sm:text-base text-white/90 max-w-2xl">
              {language === 'ar'
                ? 'اختبارات شاملة من ٤٠ سؤالاً مصممة لعمر طفلك وما درسه فعلياً. اختبارات التدريب مجانية دائماً، والامتحان الرسمي المعتمد يُصدر شهادة موثّقة تلقائياً عند النجاح بنسبة ٧٠٪ فأعلى.'
                : 'Age-tailored 40-question assessments aligned with studied lessons. Practice exams are always free; Official Certified Exams automatically issue a verifiable certificate upon scoring 70%+.'}
            </p>
          </div>
          <NonoCharacter mood="excited" scarfColor={activeChild.companionScarfColor} size="md" language={language} />
        </div>
      </div>

      {/* Mode Switcher: Official/Practice vs Teacher-Assigned Exams vs Homework */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border border-[#27345C]/12 w-fit">
        <button
          type="button"
          onClick={() => setExamViewMode('official')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
            examViewMode === 'official'
              ? 'bg-[#27345C] text-white'
              : 'text-[#27345C]/75 hover:bg-slate-50'
          }`}
        >
          {language === 'ar' ? 'الامتحانات الرسمية والتدريبية (٤٠ سؤالاً)' : 'Official & Practice Exams'}
        </button>
        <button
          type="button"
          onClick={() => setExamViewMode('assigned')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
            examViewMode === 'assigned'
              ? 'bg-[#8054D9] text-white'
              : 'text-[#27345C]/75 hover:bg-slate-50'
          }`}
        >
          <span>{language === 'ar' ? 'الامتحانات المدرسية المعينة' : 'Teacher-Assigned Exams'}</span>
          {assignedCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-[#FFD84D] text-[#27345C] text-[11px] tabular-nums">
              {assignedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setExamViewMode('homework')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-colors ${
            examViewMode === 'homework'
              ? 'bg-[#39BDF2] text-white'
              : 'text-[#27345C]/75 hover:bg-slate-50'
          }`}
        >
          <span>{language === 'ar' ? 'واجباتي المدرسية' : 'My Homework'}</span>
          {homeworkCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-[#FFD84D] text-[#27345C] text-[11px] tabular-nums">
              {homeworkCount}
            </span>
          )}
        </button>
      </div>

      {examViewMode === 'homework' ? (
        <StudentHomeworkSection />
      ) : examViewMode === 'assigned' ? (
        <AssignedExamsSection onCountChange={setAssignedCount} />
      ) : (
        <>
      {/* Subject Selection */}
      <div className="nono-card rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#27345C]">
            {language === 'ar' ? '١. اختر مادة الامتحان:' : '1. Choose Exam Subject:'}
          </h2>
          <span className="text-xs font-bold text-[#8054D9]">
            {t(ageOutcome.title, language)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { id: 'comprehensive' as const, emoji: '🌟', ar: 'الامتحان الشامل', en: 'Comprehensive' },
            { id: 'arabic' as const, emoji: '📖', ar: 'اللغة العربية', en: 'Arabic' },
            { id: 'english' as const, emoji: '🔤', ar: 'اللغة الإنجليزية', en: 'English' },
            { id: 'math' as const, emoji: '🔢', ar: 'الرياضيات', en: 'Mathematics' },
            { id: 'colors-science' as const, emoji: '🔬', ar: 'الألوان والعلوم', en: 'Colors & Science' },
          ].map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setSubject(sub.id);
              }}
              className={`p-4 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                subject === sub.id
                  ? 'bg-[#8054D9] text-white border-[#8054D9] scale-[1.03] shadow'
                  : 'bg-[#FFF8E9] text-[#27345C] border-[#27345C]/10 hover:border-[#8054D9]'
              }`}
            >
              <div className="text-3xl mb-1">{sub.emoji}</div>
              <div className="text-xs font-extrabold">{language === 'ar' ? sub.ar : sub.en}</div>
            </button>
          ))}
        </div>
      </div>

      {examError && (
        <div className="p-4 rounded-2xl bg-[#FF4D6D]/12 text-[#FF4D6D] text-sm font-bold">{examError}</div>
      )}

      {/* Practice vs Official Certified Exam Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Free Practice Exam */}
        <div className="nono-card rounded-3xl p-6 flex flex-col justify-between space-y-5 bg-gradient-to-br from-white to-[#E5F6FF]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold">
                {language === 'ar' ? 'مجاني ١٠٠٪ دائماً' : '100% Free Always'}
              </span>
              <Sparkles className="w-6 h-6 text-[#39BDF2]" />
            </div>
            <h3 className="text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'اختبار تدريبي تحضيري' : 'Free Practice Test'}
            </h3>
            <p className="text-sm text-[#27345C]/75 leading-relaxed">
              {language === 'ar'
                ? 'تدرّب مجاناً على نمط أسئلة الامتحان المتنوعة (استماع، تمييز، مطابقة، مسائل) قبل التقدم للامتحان الرسمي.'
                : 'Practice mixed question formats (listening, matching, sequences, problem solving) for free before taking an official certified exam.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loadingExam}
              onClick={() => startExamRequest('practice', 10)}
              className="flex-1 nono-btn-tactile py-3 px-4 rounded-2xl bg-[#39BDF2] text-white font-extrabold text-sm cursor-pointer"
            >
              {language === 'ar' ? 'تدريب سريع (١٠ أسئلة)' : 'Quick Practice (10 Qs)'}
            </button>
            <button
              type="button"
              disabled={loadingExam}
              onClick={() => startExamRequest('practice', examConfig.questionsPerExam)}
              className="py-3 px-4 rounded-2xl bg-white border-2 border-[#39BDF2] text-[#27345C] font-extrabold text-sm cursor-pointer"
            >
              {language === 'ar' ? 'محاكاة كاملة (٤٠)' : 'Full 40-Q Practice'}
            </button>
          </div>
        </div>

        {/* Official Paid Exam (50 EGP default, Parent-Gated) */}
        <div className="nono-card rounded-3xl p-6 flex flex-col justify-between space-y-5 border-2 border-[#FFD84D] bg-gradient-to-br from-[#FFF8E9] to-[#F3E8FF]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-xl bg-[#27345C] text-[#FFD84D] text-xs font-extrabold font-mono-num">
                {examConfig.examPriceEgp} {examConfig.currency}
              </span>
              <Award className="w-7 h-7 text-[#8054D9]" />
            </div>
            <h3 className="text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'الامتحان الرسمي المعتمد (٤٠ سؤالاً)' : 'Official Certified Exam (40 Questions)'}
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-[#27345C]/80 font-semibold">
              <li>
                ✓{' '}
                {language === 'ar'
                  ? `٤٠ سؤالاً متدرجاً بدون تكرار ومصححاً من الخادم`
                  : `40 unique, multi-format, server-graded questions`}
              </li>
              <li>
                ✓{' '}
                {language === 'ar'
                  ? `شهادة رسمية برقم تحقق فريد وطباعة PDF عند تحقيق ${examConfig.passingPercentage}%+ (٢٨/٤٠)`
                  : `Automatic verifiable PDF/QR certificate upon scoring ${examConfig.passingPercentage}%+ (28/40)`}
              </li>
              <li>
                ✓{' '}
                {language === 'ar'
                  ? 'الدفع اختياري تماماً ويُدار حصرياً عبر بوابة الأهل'
                  : 'Optional & parent-gated only — never asks children for payment'}
              </li>
            </ul>
          </div>

          {!featureFlags.paidAssessmentsEnabled ? (
            <div className="p-3 rounded-2xl bg-[#27345C]/10 text-xs font-extrabold text-[#27345C] text-center">
              {language === 'ar'
                ? 'الامتحانات الرسمية المدفوعة متوقفة مؤقتاً من الإدارة.'
                : 'Official paid assessments are temporarily paused by administrator.'}
            </div>
          ) : (
            <button
              type="button"
              disabled={loadingExam}
              onClick={() => {
                soundEngine.playPop();
                setShowPaymentModal(true);
                setGateUnlocked(false);
                setGateInput('');
                setGateError(false);
              }}
              className="nono-btn-tactile w-full min-h-[44px] py-3.5 px-5 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4 text-[#FFD84D]" />
              <span>
                {language === 'ar'
                  ? `دخول الامتحان الرسمي (${examConfig.examPriceEgp} ج.م — موافقة الأهل)`
                  : `Take Official Exam (${examConfig.examPriceEgp} EGP — Parent Gate)`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Past Exam Attempts */}
      {(activeChild.examHistory || []).length > 0 && (
        <div className="nono-card rounded-3xl p-6 space-y-3">
          <h3 className="text-lg font-extrabold text-[#27345C]">
            {language === 'ar' ? 'سجل الامتحانات السابقة' : 'Recent Exam History'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(activeChild.examHistory || []).map((ex) => (
              <div key={ex.id} className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 text-sm space-y-1">
                <div className="flex items-center justify-between font-extrabold">
                  <span>{ex.subject}</span>
                  <span className={ex.passed ? 'text-[#55D98B]' : 'text-[#FF9360]'}>
                    {ex.score}/{ex.totalQuestions} ({ex.percentage}%)
                  </span>
                </div>
                <p className="text-xs text-[#27345C]/65">
                  {ex.mode === 'official' ? 'Official Certified' : 'Practice'}
                  {ex.certificateCode ? ` · Cert: ${ex.certificateCode}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}

      {/* Parent-Gated Payment Checkout Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md nono-card rounded-3xl p-6 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#8054D9] flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                {language === 'ar' ? 'بوابة الأهل للدفع الآمن' : 'Parent-Only Checkout Gate'}
              </span>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 rounded-full bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!gateUnlocked ? (
              <div className="space-y-4">
                <Lock className="w-10 h-10 text-[#27345C] mx-auto" />
                <h3 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'التحقق من ولي الأمر' : 'Verify Parent Access'}
                </h3>
                <p className="text-xs text-[#27345C]/75">
                  {language === 'ar'
                    ? 'عملية شراء الامتحان الرسمي مخصصة للأهل فقط.'
                    : 'Only parents or guardians may confirm an exam purchase.'}
                </p>
                {!authSession.authenticated && (
                  <div className="p-3 rounded-2xl bg-[#FFF8E9] font-mono-num text-2xl font-extrabold">
                    8 × 3 = ?
                  </div>
                )}
                <input
                  type={authSession.authenticated ? 'password' : 'number'}
                  value={gateInput}
                  onChange={(e) => setGateInput(e.target.value)}
                  placeholder={
                    authSession.authenticated
                      ? language === 'ar'
                        ? 'كلمة مرور ولي الأمر'
                        : 'Parent Password'
                      : language === 'ar'
                        ? 'أدخل الناتج'
                        : 'Enter answer'
                  }
                  className="w-full h-11 px-4 rounded-xl border-2 border-[#27345C]/15 text-center font-mono-num font-bold"
                />
                {gateError && (
                  <p className="text-xs font-bold text-[#FF4D6D]">
                    {language === 'ar' ? 'إجابة أو كلمة مرور غير صحيحة، حاول ثانية!' : 'Incorrect verification, try again!'}
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (authSession.authenticated && authSession.csrfToken) {
                      const res = await fetch('/api/parent/verify-password', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-csrf-token': authSession.csrfToken,
                        },
                        body: JSON.stringify({ password: gateInput }),
                      });
                      if (res.ok) {
                        soundEngine.playSuccess();
                        setGateUnlocked(true);
                        setGateError(false);
                        return;
                      }
                      soundEngine.playEncourage();
                      setGateError(true);
                      return;
                    }
                    if (Number(gateInput.trim()) === 24) {
                      soundEngine.playSuccess();
                      setGateUnlocked(true);
                      setGateError(false);
                    } else {
                      soundEngine.playEncourage();
                      setGateError(true);
                    }
                  }}
                  className="w-full nono-btn-tactile h-11 rounded-xl bg-[#27345C] text-white font-bold text-sm cursor-pointer"
                >
                  {language === 'ar' ? 'متابعة للدفع' : 'Continue as Parent'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-start">
                <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 space-y-2">
                  <div className="flex items-center justify-between font-extrabold text-base text-[#27345C]">
                    <span>{language === 'ar' ? 'رسوم الامتحان الرسمي' : 'Official Exam Fee'}</span>
                    <span className="font-mono-num text-[#8054D9]">
                      {examConfig.examPriceEgp} {examConfig.currency}
                    </span>
                  </div>
                  <p className="text-xs text-[#27345C]/75">
                    {language === 'ar'
                      ? `الطالب: ${activeChild.displayName} · ٤٠ سؤالاً · شهادة موثّقة عند النجاح (≥ ${examConfig.passingPercentage}٪)`
                      : `Child: ${activeChild.displayName} · 40 Qs · Certified upon passing (≥ ${examConfig.passingPercentage}%)`}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#E5F6FF] text-xs text-[#27345C]/85 leading-relaxed">
                  {examConfig.paymentGatewayMode === 'live-gateway'
                    ? language === 'ar'
                      ? 'سيتم التحقق من عملية الدفع عبر البوابة الإلكترونية المربوطة بالخادم.'
                      : 'Payment will be verified server-side via configured payment gateway.'
                    : language === 'ar'
                      ? 'ملاحظة بيئة التطوير: لم يتم ربط بوابة دفع بنكية حية (Stripe/Paymob) بعد؛ يقوم الخادم هنا بإصدار إيصال تحقق اختباري آمن لاختبار تدفق الدفع والامتحان.'
                      : 'Development Test Verification Mode: Live Stripe/Paymob gateway keys are not set; server issues a signed test receipt to verify the end-to-end payment and certification flow.'}
                </div>

                <button
                  type="button"
                  disabled={paymentProcessing}
                  onClick={handleParentConfirmPurchase}
                  className="w-full nono-btn-tactile h-12 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {paymentProcessing
                      ? language === 'ar'
                        ? 'جاري التحقق من الخادم...'
                        : 'Verifying on Server...'
                      : language === 'ar'
                        ? `تأكيد الدفع (${examConfig.examPriceEgp} ج.م) وبدء الامتحان`
                        : `Confirm ${examConfig.examPriceEgp} EGP & Start Exam`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
