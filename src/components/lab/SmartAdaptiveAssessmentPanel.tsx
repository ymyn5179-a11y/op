import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Compass, FlaskConical, HelpCircle, Sparkles, Star, Volume2 } from 'lucide-react';
import { EmotionalFeedbackBanner } from '../EmotionalFeedbackBanner';
import { NonoCharacter } from '../NonoCharacter';
import { NonoLandLogo } from '../NonoLandLogo';
import { useNonoLand } from '../../context/NonoLandContext';
import { SKILL_LABELS, t, UI_COPY } from '../../i18n/translations';
import {
  AdaptiveDifficultyTier,
  EmotionalFeedbackPayload,
  Language,
  LocalizedText,
  SmartAssessmentQuestionPublic,
  SmartAssessmentStartResponse,
  SmartAssessmentSubmitResponse,
} from '../../types/nonoland';
import { trackedFetch } from '../../utils/perfMonitor';
import { soundEngine } from '../../utils/soundEngine';

const DIFF_LABELS: Record<AdaptiveDifficultyTier, LocalizedText> = {
  easy: { ar: 'مستوى لطيف', en: 'Gentle Level' },
  medium: { ar: 'مستوى متنامٍ', en: 'Growing Level' },
  advanced: { ar: 'مستوى التحدي', en: 'Smart Challenge' },
};

export const SmartAdaptiveAssessmentPanel: React.FC<{ isBaseline?: boolean }> = ({
  isBaseline = false,
}) => {
  const { activeChild, language, navigate, syncUpdatedChildFromServer } = useNonoLand();
  const [phase, setPhase] = useState<'intro' | 'active' | 'summary'>('intro');
  const [sessionId, setSessionId] = useState<string>('');
  const [difficultyTier, setDifficultyTier] = useState<AdaptiveDifficultyTier>('easy');
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [question, setQuestion] = useState<SmartAssessmentQuestionPublic | null>(null);
  const [feedback, setFeedback] = useState<EmotionalFeedbackPayload | null>(null);
  const [hintPayload, setHintPayload] = useState<{ hint?: LocalizedText; simplifiedSteps?: LocalizedText[] } | null>(null);
  const [summary, setSummary] = useState<SmartAssessmentSubmitResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const questionStartRef = useRef<number>(Date.now());

  if (!activeChild) return null;

  const startAssessment = async (mode: 'diagnostic' | 'practice') => {
    soundEngine.playPop();
    setLoading(true);
    setErrorMsg('');
    setFeedback(null);
    setHintPayload(null);
    setSummary(null);
    try {
      const res = await trackedFetch('/api/assessment/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: activeChild.id,
          ageGroup: activeChild.ageGroup,
          mode,
          questionCount: 8,
        }),
      });
      const data = (await res.json()) as SmartAssessmentStartResponse & { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not start smart assessment');
        return;
      }
      setSessionId(data.sessionId);
      setDifficultyTier(data.difficultyTier);
      setTotalQuestions(data.totalQuestions);
      setCurrentIdx(data.currentIndex);
      setQuestion(data.question);
      setPhase('active');
      questionStartRef.current = Date.now();
      soundEngine.speak(data.question.prompt[language], language);
    } catch {
      setErrorMsg(language === 'ar' ? 'خطأ في الاتصال بالخادم.' : 'Network error starting assessment.');
    } finally {
      setLoading(false);
    }
  };

  const requestHint = async () => {
    if (!sessionId || !question) return;
    soundEngine.playPop();
    try {
      const res = await trackedFetch('/api/assessment/hint', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: question.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setHintPayload({ hint: d.hint, simplifiedSteps: d.simplifiedSteps });
      }
    } catch {
      // ignore
    }
  };

  const submitAnswer = async (answerPayload: unknown) => {
    if (!sessionId || !question || loading) return;
    setLoading(true);
    const responseTimeMs = Math.max(400, Date.now() - questionStartRef.current);
    try {
      const res = await trackedFetch('/api/assessment/submit-item', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: question.id,
          answer: answerPayload,
          responseTimeMs,
        }),
      });
      const data = (await res.json()) as SmartAssessmentSubmitResponse & { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to grade item');
        return;
      }

      setDifficultyTier(data.difficultyTier);
      setFeedback(data.emotionalFeedback);
      setHintPayload(null);
      if (data.correct) soundEngine.playSuccess();
      else soundEngine.playEncourage();

      if (data.finished && data.summary) {
        if (data.summary.updatedSkillProgress && Object.keys(data.summary.updatedSkillProgress).length > 0) {
          syncUpdatedChildFromServer({
            ...activeChild,
            skillProgress: data.summary.updatedSkillProgress,
            stars: activeChild.stars + data.summary.starsEarned,
            completedBaseline: true,
          });
        }
        setSummary(data.summary);
        setPhase('summary');
        soundEngine.playCelebration();
      } else if (data.nextQuestion) {
        const nextQ = data.nextQuestion;
        const nextI = data.nextIndex ?? currentIdx + 1;
        window.setTimeout(() => {
          setQuestion(nextQ);
          setCurrentIdx(nextI);
          setFeedback(null);
          questionStartRef.current = Date.now();
          soundEngine.speak(nextQ.prompt[language], language);
        }, data.correct ? 700 : 1800);
      }
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'intro') {
    return (
      <div className="max-w-4xl mx-auto nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <NonoCharacter mood="thinking" scarfColor={activeChild.companionScarfColor} size="md" language={language} />
          <div className="space-y-2 text-center sm:text-start">
            <div className="flex justify-center sm:justify-start">
              <NonoLandLogo variant="compact" size="xs" language={language} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#27345C]">
              {isBaseline
                ? language === 'ar' ? 'رحلة اكتشاف المهارات الأولية' : 'Smart Baseline Discovery'
                : language === 'ar' ? 'محرك التقييم الذكي المتكيّف' : 'Smart Adaptive Assessment'}
            </h2>
            <p className="text-sm font-bold text-[#27345C]/75">
              {language === 'ar'
                ? 'تقييم تفاعلي يضم ١٠ أنواع من الأسئلة المتنوعة: اختيارات، صور، استماع، مطابقة، تصنيف، ترتيب، ذاكرة، صوتيات، عدّ، وتحدي ذكاء!'
                : 'Interactive 10-format adaptive engine: MCQ, Images, Listening, Matching, Sorting, Sequencing, Memory, Phonics, Counting & Logic Challenges!'}
            </p>
          </div>
        </div>

        {errorMsg && <p className="text-xs font-extrabold text-[#DC2626]">{errorMsg}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => void startAssessment('diagnostic')}
            className="nono-btn-tactile p-5 rounded-3xl bg-[#8054D9] text-white text-start cursor-pointer"
          >
            <div className="flex items-center gap-2 font-extrabold text-lg">
              <FlaskConical className="w-5 h-5 text-[#FFD84D]" />
              <span>{t(UI_COPY.lab.diagnosticMode, language)}</span>
            </div>
            <p className="text-xs text-white/85 mt-1.5">
              {language === 'ar'
                ? 'تصحيح آمن على الخادم مع تكيّف تلقائي للصعوبة'
                : 'Server-graded adaptive challenge without exposing answer keys'}
            </p>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void startAssessment('practice')}
            className="nono-btn-tactile p-5 rounded-3xl bg-[#39BDF2] text-[#27345C] text-start cursor-pointer"
          >
            <div className="flex items-center gap-2 font-extrabold text-lg">
              <Sparkles className="w-5 h-5" />
              <span>{t(UI_COPY.lab.practiceMode, language)}</span>
            </div>
            <p className="text-xs text-[#27345C]/85 mt-1.5 font-semibold">
              {language === 'ar'
                ? 'مع أمثلة موضّحة وتشجيع لطيف خطوة بخطوة'
                : 'Includes worked examples & encouraging step-by-step hints'}
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'summary' && summary) {
    return (
      <div className="max-w-3xl mx-auto nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <NonoCharacter mood="celebrating" scarfColor={activeChild.companionScarfColor} size="md" language={language} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
            {language === 'ar'
              ? `تقريرك الذكي يا ${activeChild.displayName}!`
              : `Smart Discovery Summary, ${activeChild.displayName}!`}
          </h2>
          <p className="text-sm font-bold text-[#27345C]/75">
            {language === 'ar'
              ? `النتيجة: ${summary.score}/${summary.totalQuestions} (${summary.percentage}%) · +${summary.starsEarned} نجوم ⭐`
              : `Score: ${summary.score}/${summary.totalQuestions} (${summary.percentage}%) · +${summary.starsEarned} Stars ⭐`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#55D98B] space-y-2">
            <p className="text-xs font-extrabold text-[#15803D]">
              {language === 'ar' ? 'نقاط القوة الملحوظة:' : 'Observed Strengths:'}
            </p>
            {summary.strengths.length > 0 ? (
              summary.strengths.map((sk) => (
                <span key={sk} className="inline-block me-1.5 px-2.5 py-1 rounded-lg bg-white text-xs font-extrabold text-[#27345C]">
                  ✓ {t(SKILL_LABELS[sk], language)}
                </span>
              ))
            ) : (
              <p className="text-xs font-bold text-[#27345C]/70">
                {language === 'ar' ? 'خطوات أولى شجاعة!' : 'Brave exploration across new skills!'}
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#FFD84D] space-y-2">
            <p className="text-xs font-extrabold text-[#B45309]">
              {language === 'ar' ? 'مهارات تستحق تدريبًا إضافيًا:' : 'Areas for Gentle Practice:'}
            </p>
            {summary.weakSkills.length > 0 ? (
              summary.weakSkills.map((sk) => (
                <span key={sk} className="inline-block me-1.5 px-2.5 py-1 rounded-lg bg-white text-xs font-extrabold text-[#27345C]">
                  💡 {t(SKILL_LABELS[sk], language)}
                </span>
              ))
            ) : (
              <p className="text-xs font-bold text-[#15803D]">
                {language === 'ar' ? 'توازن ممتاز في جميع المهارات!' : 'Strong balance across every tested skill!'}
              </p>
            )}
          </div>
        </div>

        {summary.recommendedRevision.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-extrabold text-[#27345C]/75">
              {language === 'ar' ? 'مغامرات المراجعة المقترحة لك:' : 'Recommended Revision Adventures:'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summary.recommendedRevision.map((rec, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigate(rec.screen)}
                  className="p-4 rounded-2xl bg-[#F3ECFF] hover:bg-[#E9D5FF] text-start space-y-1 cursor-pointer"
                >
                  <p className="text-sm font-extrabold text-[#27345C] flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-[#8054D9]" />
                    <span>{rec.label[language]}</span>
                  </p>
                  <p className="text-xs font-bold text-[#27345C]/75">{rec.reason[language]}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setPhase('intro')}
            className="min-h-[46px] px-6 rounded-2xl bg-[#8054D9] text-white font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'تحدٍّ ذكي جديد' : 'Start Another Session'}
          </button>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="min-h-[46px] px-5 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold cursor-pointer"
          >
            {t(UI_COPY.nav.home, language)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto nono-card rounded-[2rem] p-6 sm:p-8 space-y-5">
      {question && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#8054D9] tabular-nums">
              {currentIdx + 1} / {totalQuestions} · {t(SKILL_LABELS[question.skillId], language)}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#E5F6FF] text-[#0369A1] text-xs font-extrabold">
              {DIFF_LABELS[difficultyTier][language]}
            </span>
          </div>

          <div className="flex gap-1.5">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <div
                key={i}
                className={`h-2.5 flex-1 rounded-full ${
                  i < currentIdx ? 'bg-[#55D98B]' : i === currentIdx ? 'bg-[#8054D9]' : 'bg-[#27345C]/12'
                }`}
              />
            ))}
          </div>

          <div className="p-5 rounded-3xl bg-[#FFF8E9] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-2 text-center sm:text-start">
              <h2 className="text-xl font-extrabold text-[#27345C]">{question.prompt[language]}</h2>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    soundEngine.speak(
                      question.audioText || question.prompt[language],
                      question.audioLang || language,
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-[#8054D9]" />
                  <span>{language === 'ar' ? 'استمع' : 'Listen'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void requestHint()}
                  className="px-3 py-1.5 rounded-xl bg-[#FFD84D]/40 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>{language === 'ar' ? 'تلميح لطيف' : 'Gentle Hint'}</span>
                </button>
              </div>
            </div>
            <NonoCharacter mood="thinking" scarfColor={activeChild.companionScarfColor} size="sm" language={language} />
          </div>

          {question.visualCue && (
            <div className="text-center text-3xl sm:text-4xl font-extrabold text-[#8054D9] py-1">
              {question.visualCue}
            </div>
          )}

          {question.countingPrompt && (
            <div className="p-4 rounded-2xl bg-[#F8FAFC] text-center text-3xl space-x-2">
              <span>{question.countingPrompt.emoji.repeat(question.countingPrompt.groupA)}</span>
              {question.countingPrompt.groupB !== undefined && (
                <>
                  <span className="font-extrabold text-[#8054D9] mx-2">{question.countingPrompt.op || '+'}</span>
                  <span>{question.countingPrompt.emoji.repeat(question.countingPrompt.groupB)}</span>
                </>
              )}
            </div>
          )}

          {hintPayload?.hint && (
            <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FFD84D] text-xs sm:text-sm font-bold text-[#27345C]">
              💡 {hintPayload.hint[language]}
            </div>
          )}

          <SmartQuestionInteractiveBody
            key={question.id}
            question={question}
            language={language}
            disabled={loading}
            onSubmit={submitAnswer}
          />

          <EmotionalFeedbackBanner feedback={feedback} language={language} onNavigate={navigate} />
        </>
      )}
    </div>
  );
};

const SmartQuestionInteractiveBody: React.FC<{
  question: SmartAssessmentQuestionPublic;
  language: Language;
  disabled: boolean;
  onSubmit: (ans: unknown) => void;
}> = ({ question, language, disabled, onSubmit }) => {
  const [pairsAns, setPairsAns] = useState<Record<string, string>>({});
  const [sortAns, setSortAns] = useState<Record<string, string>>({});
  const [seqPicked, setSeqPicked] = useState<string[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);

  useEffect(() => {
    setPairsAns({});
    setSortAns({});
    setSeqPicked([]);
    setFlippedIds([]);
    setMatchedPairs([]);
  }, [question.id]);

  // Options-based formats: mcq, image-recognition, listening, phonics, counting-math, age-challenge
  if (question.options && question.options.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {question.options.map((opt) => (
          <motion.button
            key={opt.id}
            type="button"
            disabled={disabled}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSubmit(opt.id)}
            className="nono-btn-tactile rounded-3xl p-5 bg-white border-2 border-[#27345C]/15 hover:border-[#8054D9] flex flex-col items-center justify-center gap-2 min-h-[125px] cursor-pointer"
          >
            <span className="text-4xl font-extrabold">{opt.visual}</span>
            <span className="font-extrabold text-base text-[#27345C]">{opt.label[language]}</span>
          </motion.button>
        ))}
      </div>
    );
  }

  // Matching format
  if (question.format === 'matching' && question.pairs) {
    const allChosen = question.pairs.every((p) => Boolean(pairsAns[p.id]));
    return (
      <div className="space-y-3">
        {question.pairs.map((pair) => (
          <div key={pair.id} className="p-3.5 rounded-2xl bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">
            <span className="text-base font-extrabold text-[#27345C]">{pair.left}</span>
            <div className="flex flex-wrap gap-2">
              {pair.rightOptions.map((ro) => (
                <button
                  key={ro}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setPairsAns((prev) => ({ ...prev, [pair.id]: ro }));
                  }}
                  className={`min-h-[40px] px-3 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                    pairsAns[pair.id] === ro ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15 text-[#27345C]'
                  }`}
                >
                  {ro}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={!allChosen || disabled}
          onClick={() => onSubmit(pairsAns)}
          className="min-h-[46px] px-6 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer disabled:opacity-50"
        >
          {language === 'ar' ? 'تأكيد المطابقة ✓' : 'Check Matches ✓'}
        </button>
      </div>
    );
  }

  // Sorting format
  if (question.format === 'sorting' && question.sortItems && question.sortBuckets) {
    const allSorted = question.sortItems.every((it) => Boolean(sortAns[it.visual]));
    return (
      <div className="space-y-3">
        {question.sortItems.map((it) => (
          <div key={it.id} className="p-3 rounded-2xl bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-extrabold">
              {it.visual} {it.label[language]}
            </span>
            <div className="flex gap-2">
              {question.sortBuckets!.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setSortAns((prev) => ({ ...prev, [it.visual]: b.id }));
                  }}
                  className={`min-h-[40px] px-3 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                    sortAns[it.visual] === b.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                  }`}
                >
                  {b.emoji} {b.label[language]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={!allSorted || disabled}
          onClick={() => onSubmit(sortAns)}
          className="min-h-[46px] px-6 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer disabled:opacity-50"
        >
          {language === 'ar' ? 'تأكيد التصنيف ✓' : 'Check Sorting ✓'}
        </button>
      </div>
    );
  }

  // Sequencing format
  if (question.format === 'sequencing' && question.sequencePool) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center gap-2">
          {question.sequencePool.map((_, i) => (
            <div key={i} className="min-w-[56px] h-12 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 flex items-center justify-center font-extrabold text-lg">
              {seqPicked[i] || '?'}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {question.sequencePool.map((item) => (
            <button
              key={item}
              type="button"
              disabled={seqPicked.includes(item) || disabled}
              onClick={() => {
                soundEngine.playPop();
                const next = [...seqPicked, item];
                setSeqPicked(next);
                if (next.length === question.sequencePool!.length) {
                  onSubmit(next);
                }
              }}
              className="nono-btn-tactile px-5 py-3 rounded-2xl bg-white border-2 border-[#8054D9]/30 font-extrabold text-xl cursor-pointer disabled:opacity-35"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Memory format
  if (question.format === 'memory' && question.memoryTiles) {
    const tiles = question.memoryTiles;
    const handleTileTap = (tileId: string) => {
      if (flippedIds.includes(tileId) || matchedPairs.includes(tileId)) return;
      soundEngine.playPop();
      const next = [...flippedIds, tileId];
      setFlippedIds(next);
      if (next.length === 2) {
        const a = tiles.find((t) => t.id === next[0]);
        const b = tiles.find((t) => t.id === next[1]);
        if (a && b && a.pairKey === b.pairKey) {
          const nextMatched = [...matchedPairs, a.id, b.id];
          setMatchedPairs(nextMatched);
          setFlippedIds([]);
          if (nextMatched.length === tiles.length) {
            onSubmit({ completed: true });
          }
        } else {
          window.setTimeout(() => setFlippedIds([]), 600);
        }
      }
    };

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((t) => {
          const open = flippedIds.includes(t.id) || matchedPairs.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTileTap(t.id)}
              className={`h-24 rounded-2xl border-2 text-3xl font-extrabold flex items-center justify-center cursor-pointer ${
                open ? 'bg-[#DCFCE7] border-[#22C55E]' : 'bg-[#F3ECFF] border-[#8054D9]/30'
              }`}
            >
              {open ? t.visual : '❓'}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};
