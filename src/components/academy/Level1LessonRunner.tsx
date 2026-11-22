import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Ear,
  PauseCircle,
  RefreshCw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { NonoCharacter } from '../NonoCharacter';
import { AcademyAudioBar } from './AcademyAudioBar';
import { useNonoLand } from '../../context/NonoLandContext';
import { ALL_LEVEL1_LESSONS } from '../../data/level1Curriculum';
import { formatNumber, t } from '../../i18n/translations';
import {
  Level1LessonDefinition,
  Level1LessonProgress,
  Level1QuestionItem,
  NonoMood,
} from '../../types/nonoland';
import { useAcademyAudio } from '../../utils/academyAudioController';
import { resolveLevel1VocabSpokenText } from '../../utils/academyAudioText';
import { soundEngine } from '../../utils/soundEngine';

type ClientL1Question = Omit<Level1QuestionItem, 'correctOptionId' | 'feedbackOnWrong'>;

interface L1ReviewRow {
  questionId: string;
  prompt: { ar: string; en: string };
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  feedbackOnWrong: { ar: string; en: string };
}

interface Level1LessonRunnerProps {
  lesson: Level1LessonDefinition;
  onExit: () => void;
  onSelectNextLesson?: (lesson: Level1LessonDefinition) => void;
}

export const Level1LessonRunner: React.FC<Level1LessonRunnerProps> = ({
  lesson,
  onExit,
  onSelectNextLesson,
}) => {
  const { activeChild, authSession, language, parentSettings, recordLevel1Progress } = useNonoLand();
  const academyAudio = useAcademyAudio(language, {
    csrfToken: authSession?.csrfToken,
    muted: parentSettings?.muted,
  });
  const existingProg = activeChild?.level1Progress?.[lesson.id];

  // 10 structured stages
  const totalStages = 10;
  const [stage, setStage] = useState(1);
  const [nonoMood, setNonoMood] = useState<NonoMood>('idle');
  const [completedActs, setCompletedActs] = useState<string[]>(
    existingProg?.completedActivityIds || [],
  );
  const [mistakes, setMistakes] = useState(0);
  const [corrects, setCorrects] = useState(0);
  const [stageFeedback, setStageFeedback] = useState<string>('');
  const [stagePassed, setStagePassed] = useState(false);

  // Interactive widget states
  const [countBasket, setCountBasket] = useState(0);
  const [coloredShape, setColoredShape] = useState(false);
  const [foundIndices, setFoundIndices] = useState<number[]>([]);
  const [sortedItems, setSortedItems] = useState<Record<string, 'match' | 'other'>>({});
  const [memoryFlipped, setMemoryFlipped] = useState<number[]>([]);
  const [memoryMatched, setMemoryMatched] = useState<number[]>([]);

  // Backend-graded final assessment state (Stage 10)
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<ClientL1Question[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [finalResult, setFinalResult] = useState<{
    score: number;
    totalQuestions: number;
    percentage: number;
    demonstrated: boolean;
    status: Level1LessonProgress['status'];
    revisionDueAt: string;
    review: L1ReviewRow[];
  } | null>(null);

  const cueLang: 'ar' | 'en' =
    lesson.subject === 'english' ? 'en' : lesson.subject === 'arabic' ? 'ar' : language;
  const primaryLang = cueLang;
  const ArrowNext = language === 'ar' ? ArrowLeft : ArrowRight;

  // Same-subject distractors
  const distractors = useMemo(() => {
    const pool = ALL_LEVEL1_LESSONS.filter(
      (l) => l.subject === lesson.subject && l.id !== lesson.id,
    );
    const step = Math.max(1, Math.floor(pool.length / 4));
    return [
      pool[0 % pool.length],
      pool[step % pool.length],
      pool[(step * 2) % pool.length],
    ].filter(Boolean);
  }, [lesson]);

  // Memory cards (2 matching target cards + 2 distractor cards)
  const memoryCards = useMemo(() => {
    const d1 = distractors[0] || lesson;
    const raw = [
      { key: 't1', label: lesson.targetSymbol, isTarget: true },
      { key: 'd1a', label: d1.targetSymbol, isTarget: false },
      { key: 't2', label: lesson.teachingVocab[0]?.emoji || lesson.targetSymbol, isTarget: true },
      { key: 'd1b', label: d1.teachingVocab[0]?.emoji || d1.targetSymbol, isTarget: false },
    ];
    return raw;
  }, [lesson, distractors]);

  // 6-grid find-hidden cards
  const hiddenGrid = useMemo(() => {
    const d1 = distractors[0]?.targetSymbol || '⭐';
    const d2 = distractors[1]?.targetSymbol || '🌙';
    return [
      { sym: d1, isTarget: false },
      { sym: lesson.targetSymbol, isTarget: true },
      { sym: d2, isTarget: false },
      { sym: d1, isTarget: false },
      { sym: lesson.targetSymbol, isTarget: true },
      { sym: d2, isTarget: false },
    ];
  }, [lesson, distractors]);

  // Sortable items
  const sortableItems = useMemo(() => {
    const v1 = lesson.teachingVocab[0];
    const v2 = lesson.teachingVocab[1] || v1;
    const other1 = distractors[0]?.teachingVocab[0];
    return [
      { id: 's1', emoji: v1?.emoji || '🌟', label: v1?.text || lesson.targetSymbol, isMatch: true },
      { id: 's2', emoji: other1?.emoji || '🪵', label: other1?.text || 'Other', isMatch: false },
      { id: 's3', emoji: v2?.emoji || '✨', label: v2?.text || lesson.targetSymbol, isMatch: true },
    ];
  }, [lesson, distractors]);

  const speakCue = (text: string, slow = false, audioUrl?: string) => {
    void academyAudio.speak(text, cueLang, { slow, audioUrl, label: text });
  };

  const resolveTargetSpokenCue = () => {
    if (lesson.subject === 'colors') {
      return cueLang === 'en' ? lesson.secondarySymbol || lesson.targetSymbol : lesson.targetSymbol;
    }
    if (lesson.subject === 'numbers') {
      return cueLang === 'ar'
        ? lesson.secondarySymbol || String(lesson.numberValue ?? lesson.targetSymbol)
        : String(lesson.numberValue ?? lesson.targetSymbol);
    }
    return lesson.targetSymbol;
  };

  const resolveSlowCombinedCue = () => {
    const targetWord = resolveTargetSpokenCue();
    const first = lesson.teachingVocab[0]
      ? resolveLevel1VocabSpokenText(
          lesson.subject,
          lesson.teachingVocab[0],
          cueLang,
          lesson.numberValue,
          lesson.secondarySymbol,
        )
      : '';
    if (!first || first === targetWord) return targetWord;
    return cueLang === 'en' ? `${targetWord}. ${first}` : `${targetWord}، ${first}`;
  };

  const markActivityDone = (actId: string, correct = true) => {
    setCompletedActs((prev) => (prev.includes(actId) ? prev : [...prev, actId]));
    if (correct) {
      setCorrects((c) => c + 1);
      setNonoMood('celebrating');
      soundEngine.playSuccess();
    } else {
      setMistakes((m) => m + 1);
      setNonoMood('encouraging');
      soundEngine.playEncourage();
    }
  };

  const savePartialAndPause = () => {
    academyAudio.stop();
    const status: Level1LessonProgress['status'] =
      completedActs.length >= 3 ? 'practicing' : 'learning';
    recordLevel1Progress(
      {
        lessonId: lesson.id,
        subject: lesson.subject,
        startedAt: existingProg?.startedAt || new Date().toISOString(),
        explanationViewed: stage >= 2,
        completedActivityIds: completedActs,
        correctCount: (existingProg?.correctCount || 0) + corrects,
        mistakesCount: (existingProg?.mistakesCount || 0) + mistakes,
        attemptsCount: existingProg?.attemptsCount || 0,
        status: existingProg?.status === 'demonstrated' ? 'demonstrated' : status,
        lastPracticedAt: new Date().toISOString(),
      },
      1,
      2,
    );
    onExit();
  };

  const advanceStage = () => {
    academyAudio.stop();
    soundEngine.playPop();
    setStageFeedback('');
    setStagePassed(false);
    setNonoMood('idle');
    if (stage < totalStages) {
      const next = stage + 1;
      setStage(next);
      if (next === 10 && !attemptId) {
        void startBackendAssessment();
      }
    }
  };

  const startBackendAssessment = async () => {
    if (!activeChild) return;
    setLoadingQuiz(true);
    setQuizError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch('/api/level1/assessment/start', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          childId: activeChild.id,
          lessonId: lesson.id,
          questionCount: 6,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuizError(data.error || 'Could not load assessment');
        setLoadingQuiz(false);
        return;
      }
      setAttemptId(data.attemptId);
      setQuizQuestions(data.questions || []);
      setQuizIdx(0);
      setQuizAnswers({});
    } catch {
      setQuizError(language === 'ar' ? 'تعذر الاتصال بالخادم لتجهيز الاختبار.' : 'Unable to reach assessment server.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const submitBackendAssessment = async () => {
    if (!attemptId) return;
    setLoadingQuiz(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch('/api/level1/assessment/submit', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ attemptId, answers: quizAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuizError(data.error || 'Assessment submit failed');
        setLoadingQuiz(false);
        return;
      }
      setFinalResult(data);
      if (data.demonstrated) {
        soundEngine.playCelebration();
        setNonoMood('celebrating');
      } else {
        soundEngine.playEncourage();
        setNonoMood('encouraging');
      }
      recordLevel1Progress(
        {
          lessonId: lesson.id,
          subject: lesson.subject,
          startedAt: existingProg?.startedAt || new Date().toISOString(),
          explanationViewed: true,
          completedActivityIds: completedActs,
          correctCount: (existingProg?.correctCount || 0) + data.score,
          mistakesCount: (existingProg?.mistakesCount || 0) + (data.totalQuestions - data.score),
          lastScore: data.score,
          lastTotal: data.totalQuestions,
          attemptsCount: (existingProg?.attemptsCount || 0) + 1,
          status: data.status,
          lastPracticedAt: new Date().toISOString(),
          revisionDueAt: data.revisionDueAt,
        },
        data.demonstrated ? 4 : 2,
        lesson.suggestedMinutes,
      );
    } catch {
      setQuizError(language === 'ar' ? 'تعذر إرسال الإجابات للخادم.' : 'Failed to submit assessment.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const nextLessonInSubject = useMemo(() => {
    const same = ALL_LEVEL1_LESSONS.filter((l) => l.subject === lesson.subject);
    const idx = same.findIndex((l) => l.id === lesson.id);
    return idx >= 0 && idx + 1 < same.length ? same[idx + 1] : null;
  }, [lesson]);

  if (!activeChild) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Progress Bar + Pause Button */}
      <div className="nono-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <button
            type="button"
            onClick={savePartialAndPause}
            className="h-11 px-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <PauseCircle className="w-4 h-4 text-[#8054D9]" />
            <span>{language === 'ar' ? 'إيقاف وحفظ' : 'Pause & Save'}</span>
          </button>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#27345C]">
              <span>{t(lesson.title, language)}</span>
              <span className="font-mono-num text-[#8054D9]">
                {formatNumber(stage, language)} / {formatNumber(totalStages, language)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#FFF8E9] overflow-hidden">
              <div
                className="h-full bg-[#8054D9] transition-all"
                style={{ width: `${Math.round((stage / totalStages) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/10 text-[11px] font-bold text-[#27345C]/75">
          {language === 'ar' ? 'تسجيلات صوتية معتمدة' : 'Studio Recorded Audio'}
        </span>
      </div>

      <AcademyAudioBar
        snapshot={academyAudio.snapshot}
        language={language}
        onPause={academyAudio.pause}
        onResume={() => void academyAudio.resume()}
        onReplay={() => void academyAudio.replay()}
        onStop={academyAudio.stop}
        onRetry={() => void academyAudio.retry()}
        onDismiss={academyAudio.dismiss}
      />

      {/* Main Stage Card */}
      <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
        {/* STAGE 1: WELCOME & LEARNING OBJECTIVE */}
        {stage === 1 && (
          <div className="text-center space-y-5">
            <NonoCharacter
              mood="waving"
              scarfColor={activeChild.companionScarfColor}
              size="lg"
              speechBubble={t(lesson.characterIntro, language)}
              language={language}
            />
            <div className="space-y-2">
              <span className="text-xs font-extrabold text-[#8054D9] uppercase">
                {lesson.id} · {language === 'ar' ? 'المستوى الأول (٣–٤ سنوات)' : 'Level 1 · Little Discoverers'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
                {t(lesson.title, language)}
              </h2>
              <p className="text-sm sm:text-base text-[#27345C]/80 max-w-xl mx-auto">
                {t(lesson.learningObjective, language)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => speakCue(t(lesson.characterIntro, primaryLang), false)}
                className="h-12 px-5 rounded-2xl bg-[#FFD84D]/50 text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                <span>{language === 'ar' ? 'استمع لنونو' : 'Hear Nono'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  markActivityDone('welcome-intro', true);
                  advanceStage();
                }}
                className="nono-btn-tactile h-12 px-7 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
              >
                <span>{language === 'ar' ? 'هيا نبدأ الدرس!' : 'Start Lesson!'}</span>
                <ArrowNext className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: VISUAL EXPLANATION & EXAMPLES */}
        {stage === 2 && (
          <div className="space-y-6 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div
                className="w-36 h-36 rounded-[2rem] flex items-center justify-center text-6xl font-extrabold shadow-lg border-4 border-white"
                style={{
                  backgroundColor: lesson.colorHex || '#8054D9',
                  color: lesson.colorHex === '#FFFFFF' ? '#27345C' : '#FFFFFF',
                }}
              >
                {lesson.subject === 'colors' ? '🎨' : lesson.targetSymbol}
              </div>
              <div className="text-start max-w-md space-y-2">
                <h3 className="text-xl font-extrabold text-[#27345C]">{t(lesson.title, language)}</h3>
                <p className="text-sm text-[#27345C]/80 leading-relaxed">{t(lesson.explanation, language)}</p>
                <button
                  type="button"
                  onClick={() => speakCue(t(lesson.explanation, primaryLang), false)}
                  className="h-9 px-3.5 rounded-xl bg-[#F3ECFF] text-[#8054D9] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'استمع للشرح' : 'Hear Explanation'}</span>
                </button>
                {lesson.subject === 'numbers' && (
                  <div className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex flex-wrap items-center gap-2">
                    {lesson.numberValue === 0 ? (
                      <span className="text-xs font-extrabold text-[#8054D9]">
                        {language === 'ar' ? '🧺 سلة فارغة تماماً = ٠ (لا يوجد شيء!)' : '🧺 Completely Empty Basket = 0 (None!)'}
                      </span>
                    ) : (
                      Array.from({ length: lesson.numberValue || 0 }).map((_, i) => (
                        <span key={i} className="text-2xl">🍎</span>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {lesson.teachingVocab.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    const spoken = resolveLevel1VocabSpokenText(
                      lesson.subject,
                      v,
                      cueLang,
                      lesson.numberValue,
                      lesson.secondarySymbol,
                    );
                    speakCue(spoken, false);
                  }}
                  className="p-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 hover:border-[#8054D9] text-center space-y-1.5 cursor-pointer"
                >
                  <div className="text-4xl">{v.emoji}</div>
                  <div className="font-extrabold text-sm text-[#27345C]">{v.text}</div>
                  {v.secondaryText && (
                    <div className="text-xs text-[#27345C]/65">{v.secondaryText}</div>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                markActivityDone('visual-see', true);
                advanceStage();
              }}
              className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{language === 'ar' ? 'شاهدت الأمثلة! التالي' : 'I Saw Them! Next'}</span>
              <ArrowNext className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STAGE 3: AUDIO LISTENING & SLOW PRONUNCIATION */}
        {stage === 3 && (
          <div className="text-center space-y-6">
            <h3 className="text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'اسمع الصوت بوضوح وببطء' : 'Hear It Clearly & Slowly'}
            </h3>
            <div className="text-6xl font-extrabold text-[#8054D9] py-2">
              {lesson.subject === 'colors' ? (
                <span
                  className="inline-block w-24 h-24 rounded-full border-4 border-[#27345C]/15 shadow"
                  style={{ backgroundColor: lesson.colorHex }}
                />
              ) : (
                lesson.targetSymbol
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => speakCue(`${t(lesson.title, primaryLang)}`, false)}
                className="h-14 px-6 rounded-2xl bg-[#39BDF2] text-white font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                <span>{language === 'ar' ? 'نطق عادي' : 'Normal Voice'}</span>
              </button>
              <button
                type="button"
                onClick={() => speakCue(resolveSlowCombinedCue(), true)}
                className="h-14 px-6 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <Ear className="w-5 h-5" />
                <span>{language === 'ar' ? 'نطق بطيء وواضح' : 'Slow Clear Voice'}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                markActivityDone('audio-hear', true);
                advanceStage();
              }}
              className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{language === 'ar' ? 'سمعت جيداً! لنتدرب' : 'Ready to Practice!'}</span>
              <ArrowNext className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STAGE 4: PRACTICE 1 — TAP & SELECT VISUAL RECOGNITION */}
        {stage === 4 && (
          <div className="text-center space-y-5">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `النشاط ١: اضغط على (${lesson.targetSymbol}) من بين الخيارات!`
                : `Activity 1: Tap (${lesson.targetSymbol})!`}
            </h3>
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {[lesson, distractors[0], distractors[1]].map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    const ok = item.id === lesson.id;
                    if (ok) {
                      markActivityDone('tap-select', true);
                      setStagePassed(true);
                      setStageFeedback(language === 'ar' ? 'أحسنت! اختيار صحيح!' : 'Great job! Exact match!');
                    } else {
                      markActivityDone('tap-select', false);
                      setStageFeedback(language === 'ar' ? 'قريب جداً! انظر لشكل الهدف وحاول ثانية' : 'Close! Look at the target and try again');
                    }
                  }}
                  className="min-h-[96px] p-4 rounded-3xl bg-[#FFF8E9] border-2 border-[#27345C]/15 hover:border-[#8054D9] flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  {lesson.subject === 'colors' ? (
                    <span
                      className="w-12 h-12 rounded-full border-2 border-[#27345C]/15"
                      style={{ backgroundColor: item.colorHex }}
                    />
                  ) : (
                    <span className="text-4xl font-extrabold text-[#27345C]">{item.targetSymbol}</span>
                  )}
                </button>
              ))}
            </div>
            {stageFeedback && <p className="text-sm font-extrabold text-[#8054D9]">{stageFeedback}</p>}
            {stagePassed && (
              <button
                type="button"
                onClick={advanceStage}
                className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'النشاط التالي' : 'Next Activity'}
              </button>
            )}
          </div>
        )}

        {/* STAGE 5: PRACTICE 2 — LISTEN & SELECT AUDIO MATCH */}
        {stage === 5 && (
          <div className="text-center space-y-5">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'النشاط ٢: استمع جيداً ثم اختر البطاقة الصحيحة!' : 'Activity 2: Listen & Pick the Right Card!'}
            </h3>
            <button
              type="button"
              onClick={() => speakCue(resolveTargetSpokenCue(), true)}
              className="h-14 px-6 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <Volume2 className="w-5 h-5" />
              <span>{language === 'ar' ? 'تشغيل الصوت' : 'Play Sound'}</span>
            </button>
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {[distractors[0], lesson, distractors[2] || distractors[1]].map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    const ok = item.id === lesson.id;
                    if (ok) {
                      markActivityDone('listen-select', true);
                      setStagePassed(true);
                      setStageFeedback(language === 'ar' ? 'أذن ذكية! ممتاز!' : 'Super listening!');
                    } else {
                      markActivityDone('listen-select', false);
                      setStageFeedback(language === 'ar' ? 'اسمع الصوت مرة أخرى وجرب!' : 'Replay the sound and try again!');
                    }
                  }}
                  className="min-h-[96px] p-4 rounded-3xl bg-[#E5F6FF] border-2 border-[#39BDF2]/30 hover:border-[#8054D9] flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  {lesson.subject === 'colors' ? (
                    <span className="w-12 h-12 rounded-full border" style={{ backgroundColor: item.colorHex }} />
                  ) : (
                    <span className="text-4xl font-extrabold text-[#27345C]">{item.targetSymbol}</span>
                  )}
                  <span className="text-xs font-bold text-[#27345C]/70">{item.teachingVocab[0]?.emoji}</span>
                </button>
              ))}
            </div>
            {stageFeedback && <p className="text-sm font-extrabold text-[#8054D9]">{stageFeedback}</p>}
            {stagePassed && (
              <button
                type="button"
                onClick={advanceStage}
                className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'النشاط التالي' : 'Next Activity'}
              </button>
            )}
          </div>
        )}

        {/* STAGE 6: PRACTICE 3 — SUBJECT-TAILORED MATCHING OR COUNTING BASKET */}
        {stage === 6 && (
          <div className="text-center space-y-5">
            {lesson.subject === 'numbers' ? (
              <>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
                  {lesson.numberValue === 0
                    ? language === 'ar'
                      ? 'النشاط ٣: تأكد أن السلة فارغة تماماً للرقم (٠) ثم اضغط تحقق!'
                      : 'Activity 3: Keep the basket completely empty for ZERO (0) and tap Check!'
                    : language === 'ar'
                      ? `النشاط ٣: ضع (${lesson.numberValue}) تفاحات داخل السلة!`
                      : `Activity 3: Put (${lesson.numberValue}) apples in the basket!`}
                </h3>
                <div className="p-6 rounded-3xl bg-[#FFF8E9] border-2 border-dashed border-[#FF9360] max-w-md mx-auto min-h-[110px] flex flex-wrap items-center justify-center gap-2">
                  {countBasket === 0 ? (
                    <span className="text-sm font-bold text-[#27345C]/55">
                      {language === 'ar' ? '🧺 السلة فارغة (٠)' : '🧺 Empty Basket (0)'}
                    </span>
                  ) : (
                    Array.from({ length: countBasket }).map((_, idx) => (
                      <span key={idx} className="text-3xl">🍎</span>
                    ))
                  )}
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setCountBasket((c) => Math.max(0, c - 1));
                    }}
                    className="h-12 px-5 rounded-2xl bg-slate-100 font-extrabold cursor-pointer"
                  >
                    − 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setCountBasket((c) => Math.min(12, c + 1));
                    }}
                    className="h-12 px-5 rounded-2xl bg-[#FF9360] text-white font-extrabold cursor-pointer"
                  >
                    + 1 🍎
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = countBasket === (lesson.numberValue ?? 0);
                      if (ok) {
                        markActivityDone('count-collect', true);
                        setStagePassed(true);
                        setStageFeedback(language === 'ar' ? 'عدّ مثالي!' : 'Exact count!');
                      } else {
                        markActivityDone('count-collect', false);
                        setStageFeedback(language === 'ar' ? `العدد الآن ${countBasket}، المطلوب ${lesson.numberValue}!` : `You have ${countBasket}, try ${lesson.numberValue}!`);
                      }
                    }}
                    className="nono-btn-tactile h-12 px-6 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'تحقق' : 'Check'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
                  {lesson.subject === 'english'
                    ? language === 'ar'
                      ? `النشاط ٣: طابق الحرف الكبير (${lesson.targetSymbol}) مع الحرف الصغير!`
                      : `Activity 3: Match (${lesson.targetSymbol}) with its lowercase twin!`
                    : language === 'ar'
                      ? `النشاط ٣: أي صورة تناسب درس (${lesson.targetSymbol})؟`
                      : `Activity 3: Which picture belongs to (${lesson.targetSymbol})?`}
                </h3>
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                  {[distractors[1], lesson, distractors[0]].map((item, idx) => (
                    <button
                      key={`${item.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        const ok = item.id === lesson.id;
                        if (ok) {
                          markActivityDone('match-picture', true);
                          setStagePassed(true);
                          setStageFeedback(language === 'ar' ? 'مطابقة رائعة!' : 'Perfect match!');
                        } else {
                          markActivityDone('match-picture', false);
                          setStageFeedback(language === 'ar' ? 'جرب الصورة الأخرى!' : 'Try another option!');
                        }
                      }}
                      className="min-h-[104px] p-4 rounded-3xl bg-[#FFF8E9] border-2 border-[#27345C]/15 hover:border-[#8054D9] flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="text-4xl">
                        {lesson.subject === 'english'
                          ? item.secondarySymbol || item.targetSymbol
                          : item.teachingVocab[0]?.emoji}
                      </span>
                      <span className="text-xs font-extrabold text-[#27345C]">
                        {lesson.subject === 'english'
                          ? item.teachingVocab[0]?.emoji
                          : item.teachingVocab[0]?.text}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {stageFeedback && <p className="text-sm font-extrabold text-[#8054D9]">{stageFeedback}</p>}
            {stagePassed && (
              <button
                type="button"
                onClick={advanceStage}
                className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'النشاط التالي' : 'Next Activity'}
              </button>
            )}
          </div>
        )}

        {/* STAGE 7: PRACTICE 4 — FIND THE HIDDEN TARGET IN 6 CARDS */}
        {stage === 7 && (
          <div className="text-center space-y-5">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `النشاط ٤: اعثر على المرتين المختبئتين لـ (${lesson.targetSymbol})!`
                : `Activity 4: Find both hidden (${lesson.targetSymbol}) cards!`}
            </h3>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              {hiddenGrid.map((cell, idx) => {
                const isFound = foundIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (isFound) return;
                      if (cell.isTarget) {
                        const next = [...foundIndices, idx];
                        setFoundIndices(next);
                        soundEngine.playPop();
                        if (next.length >= 2) {
                          markActivityDone('find-hidden', true);
                          setStagePassed(true);
                          setStageFeedback(language === 'ar' ? 'وجدتهما جميعاً! عينان صقريتان!' : 'Found them all!');
                        }
                      } else {
                        markActivityDone('find-hidden', false);
                        setStageFeedback(language === 'ar' ? 'ابحث أكثر عن الهدف!' : 'Keep looking for the target!');
                      }
                    }}
                    className={`h-20 rounded-2xl border-2 text-3xl font-extrabold cursor-pointer transition-all ${
                      isFound
                        ? 'bg-[#55D98B] border-[#55D98B] text-[#27345C] scale-105'
                        : 'bg-[#FFF8E9] border-[#27345C]/12'
                    }`}
                  >
                    {cell.sym}
                  </button>
                );
              })}
            </div>
            {stageFeedback && <p className="text-sm font-extrabold text-[#8054D9]">{stageFeedback}</p>}
            {stagePassed && (
              <button
                type="button"
                onClick={advanceStage}
                className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'النشاط التالي' : 'Next Activity'}
              </button>
            )}
          </div>
        )}

        {/* STAGE 8: PRACTICE 5 — COLOR STUDIO (FOR COLORS) OR SORTING */}
        {stage === 8 && (
          <div className="text-center space-y-5">
            {lesson.subject === 'colors' ? (
              <>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? `النشاط ٥: اضغط على الشكل لتلوينه باللون (${lesson.targetSymbol})!`
                    : `Activity 5: Tap the shape to paint it (${lesson.targetSymbol})!`}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setColoredShape(true);
                    markActivityDone('color-picture', true);
                    setStagePassed(true);
                    setStageFeedback(language === 'ar' ? 'تلوين جميل جداً!' : 'Lovely coloring!');
                  }}
                  className="w-44 h-44 mx-auto rounded-[2.5rem] border-4 border-dashed border-[#27345C]/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-inner"
                  style={{ backgroundColor: coloredShape ? lesson.colorHex : '#FFFFFF' }}
                >
                  <span className="text-5xl">{lesson.teachingVocab[0]?.emoji || '🌟'}</span>
                  <span className="text-xs font-extrabold text-[#27345C] bg-white/85 px-2.5 py-1 rounded-lg">
                    {coloredShape ? lesson.targetSymbol : language === 'ar' ? 'اضغط للتلوين' : 'Tap to Color'}
                  </span>
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? `النشاط ٥: صنّف الكلمات — هل تناسب (${lesson.targetSymbol})؟`
                    : `Activity 5: Classify — does it belong to (${lesson.targetSymbol})?`}
                </h3>
                <div className="space-y-3 max-w-lg mx-auto">
                  {sortableItems.map((it) => {
                    const placed = sortedItems[it.id];
                    return (
                      <div
                        key={it.id}
                        className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 font-extrabold text-base">
                          <span className="text-2xl">{it.emoji}</span>
                          <span>{it.label}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const ok = it.isMatch;
                              const next = { ...sortedItems, [it.id]: 'match' as const };
                              setSortedItems(next);
                              markActivityDone('sort-drag', ok);
                              if (Object.keys(next).length >= sortableItems.length) {
                                setStagePassed(true);
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                              placed === 'match' ? 'bg-[#55D98B] text-[#27345C]' : 'bg-white border border-[#27345C]/15'
                            }`}
                          >
                            {language === 'ar' ? 'يناسب ✓' : 'Match ✓'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ok = !it.isMatch;
                              const next = { ...sortedItems, [it.id]: 'other' as const };
                              setSortedItems(next);
                              markActivityDone('sort-drag', ok);
                              if (Object.keys(next).length >= sortableItems.length) {
                                setStagePassed(true);
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                              placed === 'other' ? 'bg-[#FFD84D] text-[#27345C]' : 'bg-white border border-[#27345C]/15'
                            }`}
                          >
                            {language === 'ar' ? 'مختلف' : 'Other'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {stageFeedback && <p className="text-sm font-extrabold text-[#8054D9]">{stageFeedback}</p>}
            {stagePassed && (
              <button
                type="button"
                onClick={advanceStage}
                className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'لعبة الذاكرة' : 'Memory Challenge'}
              </button>
            )}
          </div>
        )}

        {/* STAGE 9: PRACTICE 6 — MEMORY MATCH */}
        {stage === 9 && (
          <div className="text-center space-y-5">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {language === 'ar'
                ? 'النشاط ٦: تحدي الذاكرة — اختر البطاقتين الخاصتين بهذا الدرس!'
                : 'Activity 6: Memory Challenge — Find both target cards!'}
            </h3>
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {memoryCards.map((card, idx) => {
                const flipped = memoryFlipped.includes(idx) || memoryMatched.includes(idx);
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      if (flipped) return;
                      const nextFlipped = [...memoryFlipped, idx];
                      setMemoryFlipped(nextFlipped);
                      soundEngine.playPop();
                      if (card.isTarget) {
                        const nextMatched = [...memoryMatched, idx];
                        setMemoryMatched(nextMatched);
                        if (nextMatched.length >= 2) {
                          markActivityDone('memory-challenge', true);
                          setStagePassed(true);
                          setStageFeedback(language === 'ar' ? 'ذاكرة خارقة! جاهز للتقييم المستقل؟' : 'Great memory! Ready for your quiz?');
                        }
                      } else {
                        markActivityDone('memory-challenge', false);
                      }
                    }}
                    className={`h-24 rounded-2xl border-2 text-3xl font-extrabold cursor-pointer transition-all ${
                      flipped
                        ? card.isTarget
                          ? 'bg-[#E2F9EC] border-[#55D98B]'
                          : 'bg-[#FFF3D1] border-[#FF9360]'
                        : 'bg-[#8054D9] text-white border-[#8054D9]'
                    }`}
                  >
                    {flipped ? card.label : '❓'}
                  </button>
                );
              })}
            </div>
            {stageFeedback && <p className="text-sm font-extrabold text-[#8054D9]">{stageFeedback}</p>}
            {stagePassed && (
              <button
                type="button"
                onClick={advanceStage}
                className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#FF9360] text-white font-extrabold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'التقييم المستقل النهائي' : 'Independent Mini Quiz'}
              </button>
            )}
          </div>
        )}

        {/* STAGE 10: SERVER-GRADED INDEPENDENT ASSESSMENT & FEEDBACK */}
        {stage === 10 && (
          <div className="space-y-5 text-center">
            {finalResult ? (
              <div className="space-y-5">
                <NonoCharacter
                  mood={finalResult.demonstrated ? 'celebrating' : 'encouraging'}
                  scarfColor={activeChild.companionScarfColor}
                  size="lg"
                  language={language}
                />
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
                  {finalResult.demonstrated
                    ? language === 'ar'
                      ? `ممتاز يا ${activeChild.displayName}! أتممت الدرس بنجاح!`
                      : `Awesome ${activeChild.displayName}! Concept Demonstrated!`
                    : language === 'ar'
                      ? 'رائع! هذا الدرس مجدول لمراجعة لطيفة لاحقاً'
                      : 'Good try! Scheduled for a gentle spaced revision'}
                </h3>
                <div className="inline-flex items-center gap-5 px-6 py-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 font-mono-num">
                  <span className="text-2xl font-extrabold text-[#8054D9]">
                    {finalResult.score} / {finalResult.totalQuestions}
                  </span>
                  <span className="text-xl font-extrabold text-[#27345C]">
                    ({finalResult.percentage}%)
                  </span>
                </div>

                {finalResult.review.some((r) => !r.isCorrect) && (
                  <div className="text-start space-y-2 max-w-lg mx-auto">
                    {finalResult.review
                      .filter((r) => !r.isCorrect)
                      .map((r) => (
                        <div key={r.questionId} className="p-3 rounded-2xl bg-[#FFF3D1] border border-[#FFD84D] text-xs">
                          <p className="font-extrabold text-[#27345C]">{t(r.prompt, language)}</p>
                          <p className="text-[#27345C]/80 mt-0.5">{t(r.feedbackOnWrong, language)}</p>
                        </div>
                      ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      academyAudio.stop();
                      onExit();
                    }}
                    className="h-12 px-6 rounded-2xl bg-white border-2 border-[#27345C]/15 font-extrabold text-sm cursor-pointer"
                  >
                    {language === 'ar' ? 'العودة لخريطة الدروس' : 'Back to Lessons Map'}
                  </button>
                  {!finalResult.demonstrated && (
                    <button
                      type="button"
                      onClick={() => {
                        setFinalResult(null);
                        setAttemptId(null);
                        void startBackendAssessment();
                      }}
                      className="nono-btn-tactile h-12 px-6 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{language === 'ar' ? 'إعادة المحاولة الآن' : 'Try Assessment Again'}</span>
                    </button>
                  )}
                  {nextLessonInSubject && onSelectNextLesson && (
                    <button
                      type="button"
                      onClick={() => {
                        academyAudio.stop();
                        onSelectNextLesson(nextLessonInSubject);
                      }}
                      className="nono-btn-tactile h-12 px-6 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{t(nextLessonInSubject.title, language)}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : loadingQuiz ? (
              <p className="py-12 font-bold text-[#8054D9]">
                {language === 'ar' ? 'جاري تجهيز أسئلة التقييم من الخادم...' : 'Preparing server-verified quiz...'}
              </p>
            ) : quizError ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-[#FF4D6D]">{quizError}</p>
                <button
                  type="button"
                  onClick={() => void startBackendAssessment()}
                  className="px-5 py-2.5 rounded-xl bg-[#8054D9] text-white font-bold text-sm cursor-pointer"
                >
                  {language === 'ar' ? 'إعادة التحميل' : 'Retry'}
                </button>
              </div>
            ) : quizQuestions.length > 0 ? (
              (() => {
                const q = quizQuestions[quizIdx];
                const picked = quizAnswers[q.id];
                return (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between text-xs font-extrabold text-[#27345C]/70">
                      <span>
                        {language === 'ar'
                          ? `سؤال التقييم المستقل ${quizIdx + 1} من ${quizQuestions.length}`
                          : `Independent Check ${quizIdx + 1} of ${quizQuestions.length}`}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#FFF8E9] text-[#8054D9]">{q.qType}</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
                      {t(q.prompt, language)}
                    </h3>

                    {q.visualCue && <div className="text-4xl py-1">{q.visualCue}</div>}

                    {q.audioText && (
                      <button
                        type="button"
                        onClick={() =>
                          void academyAudio.speak(q.audioText!, q.audioLang || language, {
                            slow: true,
                            label: q.audioText,
                          })
                        }
                        className="h-11 px-4 rounded-xl bg-[#FFD84D]/50 text-[#27345C] font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>{language === 'ar' ? 'استمع' : 'Listen'}</span>
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto">
                      {q.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playPop();
                            setQuizAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                          }}
                          className={`min-h-[88px] p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-1.5 ${
                            picked === opt.id
                              ? 'bg-[#8054D9]/12 border-[#8054D9] scale-[1.03]'
                              : 'bg-[#FFF8E9] border-[#27345C]/12 hover:border-[#8054D9]/50'
                          }`}
                        >
                          {opt.colorHex ? (
                            <span
                              className="inline-block w-10 h-10 rounded-full border border-[#27345C]/15"
                              style={{ backgroundColor: opt.colorHex }}
                            />
                          ) : (
                            <div className="text-3xl font-extrabold">{opt.visual}</div>
                          )}
                          <div className="text-xs font-extrabold text-[#27345C]">
                            {t(opt.label, language)}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-center gap-3 pt-2">
                      {quizIdx + 1 < quizQuestions.length ? (
                        <button
                          type="button"
                          disabled={!picked}
                          onClick={() => {
                            academyAudio.stop();
                            setQuizIdx((i) => i + 1);
                          }}
                          className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm disabled:opacity-40 cursor-pointer"
                        >
                          {language === 'ar' ? 'السؤال التالي' : 'Next Question'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!picked || loadingQuiz}
                          onClick={() => void submitBackendAssessment()}
                          className="nono-btn-tactile h-12 px-8 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>{language === 'ar' ? 'اعتماد وإرسال التقييم' : 'Submit Assessment'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
