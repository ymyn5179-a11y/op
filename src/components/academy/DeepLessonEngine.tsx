import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Ear,
  HeartHandshake,
  Paintbrush,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { ACADEMY_COLORS } from '../../data/academyData';
import {
  buildArabicDeepJourney,
  buildColorDeepJourney,
  buildEnglishDeepJourney,
  MATH_DEEP_UNITS,
} from '../../data/deepCurriculum';
import { t } from '../../i18n/translations';
import { ConceptDomain, LocalizedText, NonoMood } from '../../types/nonoland';
import { getInternalAgeBand } from '../../utils/ageAdaptation';
import { useAcademyAudio } from '../../utils/academyAudioController';
import { soundEngine } from '../../utils/soundEngine';
import { NonoCharacter } from '../NonoCharacter';
import { AcademyAudioBar } from './AcademyAudioBar';
import { TracingPad } from './TracingPad';

export type DeepLessonTarget =
  | { type: 'color'; colorId: string }
  | { type: 'arabic'; letterId: string }
  | { type: 'english'; letterId: string }
  | { type: 'math'; unitId: string };

interface DeepLessonEngineProps {
  target: DeepLessonTarget;
  onExit: () => void;
}

export const DeepLessonEngine: React.FC<DeepLessonEngineProps> = ({ target, onExit }) => {
  const { activeChild, authSession, language, parentSettings, recordConceptInteraction, completeDeepLesson } = useNonoLand();
  const academyAudio = useAcademyAudio(language, {
    csrfToken: authSession?.csrfToken,
    muted: parentSettings?.muted,
  });
  const [stageIdx, setStageIdx] = useState(0);
  const [nonoMood, setNonoMood] = useState<NonoMood>('waving');
  const [stageDone, setStageDone] = useState(false);
  const [mistakesInLesson, setMistakesInLesson] = useState(0);
  const [needsReteach, setNeedsReteach] = useState(false);
  const [finished, setFinished] = useState(false);

  // Interactive per-stage local states
  const [coloredShape, setColoredShape] = useState(false);
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [sortedItems, setSortedItems] = useState<Record<string, boolean>>({});
  const [matchedItems, setMatchedItems] = useState<string[]>([]);
  const [memoryPhase, setMemoryPhase] = useState<'preview' | 'hidden' | 'done'>('preview');
  const [builtWord, setBuiltWord] = useState('');
  const [feedback, setFeedback] = useState<string>('');

  const colorData = useMemo(
    () => (target.type === 'color' ? buildColorDeepJourney(target.colorId) : null),
    [target],
  );
  const arabicData = useMemo(
    () => (target.type === 'arabic' ? buildArabicDeepJourney(target.letterId) : null),
    [target],
  );
  const englishData = useMemo(
    () => (target.type === 'english' ? buildEnglishDeepJourney(target.letterId) : null),
    [target],
  );
  const mathData = useMemo(
    () =>
      target.type === 'math'
        ? MATH_DEEP_UNITS.find((u) => u.id === target.unitId) || MATH_DEEP_UNITS[0]
        : null,
    [target],
  );

  const totalStages =
    target.type === 'color'
      ? 10
      : target.type === 'arabic' || target.type === 'english'
        ? 11
        : 6;

  const meta: {
    lessonId: string;
    conceptId: string;
    domain: ConceptDomain;
    label: LocalizedText;
  } = useMemo(() => {
    if (colorData) {
      return {
        lessonId: `deep-color-${colorData.colorId}`,
        conceptId: `color-${colorData.colorId}`,
        domain: 'colors-shapes',
        label: colorData.title,
      };
    }
    if (arabicData) {
      return {
        lessonId: `deep-ar-${arabicData.letterId}`,
        conceptId: `ar-${arabicData.letterId}`,
        domain: 'arabic',
        label: { ar: `حرف ${arabicData.char} (${arabicData.nameAr})`, en: `Arabic ${arabicData.char}` },
      };
    }
    if (englishData) {
      return {
        lessonId: `deep-en-${englishData.letterId}`,
        conceptId: englishData.letterId,
        domain: 'english',
        label: { ar: `حرف ${englishData.upper}`, en: `English ${englishData.upper}` },
      };
    }
    return {
      lessonId: mathData!.id,
      conceptId: mathData!.id,
      domain: 'numbers',
      label: mathData!.title,
    };
  }, [colorData, arabicData, englishData, mathData]);

  // Reset per-stage transient UI and stop active audio when stage changes
  useEffect(() => {
    academyAudio.stop();
    setStageDone(false);
    setFeedback('');
    setNeedsReteach(false);
    setColoredShape(false);
    setFoundIds([]);
    setSortedItems({});
    setMatchedItems([]);
    setBuiltWord('');
    setMemoryPhase('preview');
  }, [stageIdx, target, finished]);

  // Memory Challenge preview timer (stage 9 for color = idx 8)
  useEffect(() => {
    if (target.type === 'color' && stageIdx === 8 && memoryPhase === 'preview') {
      const id = window.setTimeout(() => setMemoryPhase('hidden'), 2600);
      return () => window.clearTimeout(id);
    }
  }, [target.type, stageIdx, memoryPhase]);

  const markSuccess = (
    stageType: 'exposed' | 'recognized' | 'recalled' | 'applied',
    msgAr: string,
    msgEn: string,
    isIndependent = false,
  ) => {
    soundEngine.playSuccess();
    setNonoMood('celebrating');
    setStageDone(true);
    setNeedsReteach(false);
    setFeedback(language === 'ar' ? msgAr : msgEn);
    recordConceptInteraction({
      conceptId: meta.conceptId,
      domain: meta.domain,
      label: meta.label,
      stage: stageType,
      isCorrect: true,
      lessonStageNum: stageIdx + 1,
      isIndependent,
    });
  };

  const markMistake = (msgAr: string, msgEn: string) => {
    soundEngine.playEncourage();
    setNonoMood('encouraging');
    setMistakesInLesson((m) => m + 1);
    setNeedsReteach(true);
    setFeedback(language === 'ar' ? msgAr : msgEn);
    recordConceptInteraction({
      conceptId: meta.conceptId,
      domain: meta.domain,
      label: meta.label,
      stage: 'exposed',
      isCorrect: false,
      lessonStageNum: stageIdx + 1,
    });
  };

  const handleNextStage = () => {
    if (stageIdx + 1 < totalStages) {
      soundEngine.playPop();
      setStageIdx((s) => s + 1);
    } else {
      completeDeepLesson({
        lessonId: meta.lessonId,
        conceptId: meta.conceptId,
        domain: meta.domain,
        label: meta.label,
        starsReward: 5,
        mistakesCount: mistakesInLesson,
      });
      setFinished(true);
    }
  };

  // Shuffled positions per stage so child doesn't memorize placement
  const shuffledColors = useMemo(() => {
    if (!colorData) return [];
    const targetColor = ACADEMY_COLORS.find((c) => c.id === colorData.colorId) || ACADEMY_COLORS[0];
    const others = ACADEMY_COLORS.filter((c) => c.id !== targetColor.id).slice(0, 3);
    const pool = [targetColor, ...others];
    const shift = (stageIdx + (activeChild?.stars || 0)) % pool.length;
    return [...pool.slice(shift), ...pool.slice(0, shift)];
  }, [colorData, stageIdx, activeChild?.stars]);

  if (!activeChild) return null;

  if (finished) {
    return (
      <div className="nono-card rounded-[2rem] p-8 text-center space-y-5 max-w-2xl mx-auto">
        <NonoCharacter mood="celebrating" scarfColor={activeChild.companionScarfColor} size="lg" language={language} />
        <h2 className="text-3xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'أتممت رحلة التعلّم الكاملة! 🎉' : 'Complete Learning Journey Mastered! 🎉'}
        </h2>
        <p className="text-base text-[#27345C]/80">
          {language === 'ar'
            ? `أحسنت يا ${activeChild.displayName}! لقد شاهدت، استمعت، تدرّبت، وطبّقت "${t(meta.label, 'ar')}" في ${totalStages} مراحل كاملة (+٥ نجوم).`
            : `Awesome ${activeChild.displayName}! You explored, practiced, and applied "${t(meta.label, 'en')}" across all ${totalStages} stages (+5 stars).`}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onExit}
            className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'العودة للأكاديمية' : 'Back to Academy'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Progress Header */}
      <div className="nono-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onExit}
          className="px-3.5 py-2 rounded-xl bg-[#FFF8E9] border border-[#27345C]/12 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          {language === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{language === 'ar' ? 'خروج من الدرس' : 'Back to Academy'}</span>
        </button>

        <div className="flex-1 min-w-[200px] max-w-md space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-[#27345C]">
            <span>{t(meta.label, language)}</span>
            <span className="font-mono-num text-[#8054D9]">
              {stageIdx + 1} / {totalStages}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#FFF8E9] overflow-hidden border border-[#27345C]/10">
            <div
              className="h-full bg-gradient-to-r from-[#8054D9] to-[#55D98B] transition-all"
              style={{ width: `${Math.round(((stageIdx + 1) / totalStages) * 100)}%` }}
            />
          </div>
        </div>

        <NonoCharacter mood={nonoMood} scarfColor={activeChild.companionScarfColor} size="sm" language={language} />
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

      {/* Adaptive Supportive Re-Teach Banner when a child struggles */}
      {needsReteach && (
        <div className="rounded-3xl bg-[#FFF3D1] border-2 border-[#FFD84D] p-4 flex items-start gap-3">
          <HeartHandshake className="w-6 h-6 text-[#FF9360] shrink-0 mt-0.5" />
          <div className="text-sm font-bold text-[#27345C]">
            {language === 'ar'
              ? 'مساعدة لطيفة من نونو: لا بأس بالخطأ أثناء التعلّم! شاهد المثال مرة أخرى ببطء ثم جرّب بثقة.'
              : "Nono's Gentle Help: Mistakes help our brain grow! Look closely at the example, hear it slowly, and try once more."}
          </div>
        </div>
      )}

      {/* =================================================================
          A. COMPLETE 10-STAGE COLOR JOURNEY (e.g. Discover the Color Red)
      ================================================================= */}
      {colorData && (
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
          {/* Stage 1: Introduction */}
          {stageIdx === 0 && (
            <div className="text-center space-y-5">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ١: التعرّف' : 'Stage 1: Introduction'}
              </span>
              <h2 className="text-3xl font-extrabold text-[#27345C]">{t(colorData.title, language)}</h2>
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
                className="w-36 h-36 rounded-full mx-auto border-8 border-white shadow-xl"
                style={{ backgroundColor: colorData.hex }}
              />
              <p className="text-lg font-bold text-[#27345C]/85 max-w-xl mx-auto">
                {t(colorData.introLine, language)}
              </p>
              <button
                type="button"
                onClick={() => {
                  void academyAudio.speak(t(colorData.introLine, language), language, {
                    label: t(colorData.title, language),
                  });
                  markSuccess('exposed', 'ممتاز! تعرّفنا على اللون!', 'Awesome! Color introduced!');
                }}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                <span>{language === 'ar' ? 'اسمع نطق اللون' : 'Hear Color Pronunciation'}</span>
              </button>
            </div>
          )}

          {/* Stage 2: Real-World Examples */}
          {stageIdx === 1 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٢: أمثلة من حياتنا اليومية' : 'Stage 2: Real-World Examples'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? 'انظر! كل هذه الأشياء المختلفة تشترك في نفس اللون:'
                  : 'Look! Different everyday objects share this exact same color:'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {colorData.realWorldExamples.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      void academyAudio.speak(t(ex.label, language), language);
                      setStageDone(true);
                    }}
                    className="p-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/10 hover:border-[#8054D9] text-center space-y-2 cursor-pointer"
                  >
                    <div className="text-4xl">{ex.emoji}</div>
                    <div className="text-xs font-extrabold text-[#27345C]">{t(ex.label, language)}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'اضغط على أي صورة لسماع اسمها!' : 'Tap any object to hear its name!'}
              </p>
            </div>
          )}

          {/* Stage 3: Listening */}
          {stageIdx === 2 && (
            <div className="space-y-5 text-center">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٣: الاستماع والتمييز' : 'Stage 3: Listening'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'استمع للاسم ثم اضغط على اللون الصحيح!' : 'Listen to the name, then tap the matching color!'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  const colorName =
                    ACADEMY_COLORS.find((c) => c.id === colorData.colorId)?.name[language] || '';
                  if (colorName) {
                    void academyAudio.speak(colorName, language, { slow: true });
                  }
                }}
                className="px-5 py-3 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Ear className="w-5 h-5" />
                <span>{language === 'ar' ? 'تشغيل الصوت' : 'Play Audio Cue'}</span>
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                {shuffledColors.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      if (col.id === colorData.colorId) {
                        markSuccess('recognized', 'رائع! ميزت اللون من صوته!', 'Spot on! You identified it by listening!');
                      } else {
                        markMistake('حاول الاستماع مجدداً والبحث عن اللون الصحيح!', 'Listen once more and find the matching color!');
                      }
                    }}
                    className="p-5 rounded-3xl bg-white border-2 border-[#27345C]/12 hover:scale-105 transition-transform cursor-pointer space-y-2"
                  >
                    <div className="w-16 h-16 rounded-full mx-auto border-4 border-white shadow" style={{ backgroundColor: col.hex }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stage 4: Visual Recognition */}
          {stageIdx === 3 && (
            <div className="space-y-5 text-center">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٤: التمييز البصري' : 'Stage 4: Visual Recognition'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `اختر البطاقة التي تمثل اللون (${ACADEMY_COLORS.find((c) => c.id === colorData.colorId)?.name.ar})`
                  : `Find and select ${ACADEMY_COLORS.find((c) => c.id === colorData.colorId)?.name.en} (shuffled positions)`}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                {shuffledColors.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      col.id === colorData.colorId
                        ? markSuccess('recognized', 'أحسنت! تمييز بصري دقيق!', 'Great visual recognition!')
                        : markMistake('هذا لون آخر، جرب البطاقة الصحيحة!', 'That is a different color, try another!')
                    }
                    className="p-5 rounded-3xl bg-[#FFF8E9] border-2 border-[#27345C]/10 hover:border-[#8054D9] cursor-pointer space-y-2"
                  >
                    <div className="w-16 h-16 rounded-2xl mx-auto shadow" style={{ backgroundColor: col.hex }} />
                    <div className="text-xs font-extrabold">{t(col.name, language)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stage 5: Matching */}
          {stageIdx === 4 && (
            <div className="space-y-4 text-center">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٥: المطابقة' : 'Stage 5: Object-to-Color Matching'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? 'اضغط على جميع الأشياء التي تناسب بطاقة هذا اللون:'
                  : 'Tap every object that matches this color card:'}
              </h2>
              <div className="w-20 h-12 rounded-2xl mx-auto border-4 border-white shadow" style={{ backgroundColor: colorData.hex }} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {colorData.matchingPairs.map((pair, idx) => {
                  const picked = matchedItems.includes(String(idx));
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (pair.isTarget) {
                          const next = Array.from(new Set([...matchedItems, String(idx)]));
                          setMatchedItems(next);
                          soundEngine.playPop();
                          const totalTargets = colorData.matchingPairs.filter((p) => p.isTarget).length;
                          if (next.length >= totalTargets) {
                            markSuccess('recognized', 'طابقت كل العناصر الصحيحة!', 'All matching objects paired!');
                          }
                        } else {
                          markMistake('انتبه! هذا الشيء لونه مختلف.', 'Careful! That object is a different color.');
                        }
                      }}
                      className={`p-4 rounded-2xl border-2 cursor-pointer ${
                        picked ? 'bg-[#55D98B]/20 border-[#55D98B]' : 'bg-[#FFF8E9] border-[#27345C]/10'
                      }`}
                    >
                      <div className="text-4xl">{pair.emoji}</div>
                      <div className="text-xs font-bold mt-1">{t(pair.label, language)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage 6: Sorting */}
          {stageIdx === 5 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٦: التصنيف في السلال' : 'Stage 6: Basket Sorting'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'صنّف كل عنصر في سلته اللونية المناسبة:' : 'Sort each item into its matching color basket:'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorData.sortItems.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{item.emoji}</span>
                      <span className="text-sm font-bold">{t(item.label, language)}</span>
                    </div>
                    <div className="flex gap-2">
                      {colorData.sortBaskets.map((basket) => (
                        <button
                          key={basket.id}
                          type="button"
                          onClick={() => {
                            if (basket.id === item.basketId) {
                              const next = { ...sortedItems, [String(idx)]: true };
                              setSortedItems(next);
                              soundEngine.playPop();
                              if (Object.keys(next).length >= colorData.sortItems.length) {
                                markSuccess('recalled', 'رائع! صنّفت كل السلال بدقة!', 'All baskets sorted accurately!');
                              }
                            } else {
                              markMistake('جرّب السلة التي تطابق لون الصورة!', 'Try the basket that matches its color!');
                            }
                          }}
                          style={{ backgroundColor: basket.hex }}
                          className={`w-9 h-9 rounded-xl border-2 cursor-pointer ${
                            sortedItems[String(idx)] && basket.id === item.basketId
                              ? 'border-[#27345C] ring-2 ring-[#55D98B]'
                              : 'border-white shadow'
                          }`}
                          title={t(basket.label, language)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage 7: Creative Coloring Practice */}
          {stageIdx === 6 && (
            <div className="space-y-4 text-center">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٧: التلوين الإبداعي' : 'Stage 7: Creative Coloring Practice'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `اضغط بالفرشاة لتلوين الرسمة بلون الدرس!`
                  : `Tap with the brush to paint the illustration!`}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setColoredShape(true);
                  markSuccess('recalled', 'لوحة جميلة جداً!', 'Beautiful artwork!');
                }}
                className="mx-auto block p-8 rounded-3xl bg-[#FFF8E9] border-2 border-dashed border-[#8054D9] cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <svg viewBox="0 0 120 120" className="w-36 h-36 mx-auto">
                  <path d="M60 22 C60 12, 72 8, 76 14 C72 22, 64 24, 60 22 Z" fill="#55D98B" />
                  <rect x="57" y="14" width="6" height="16" rx="3" fill="#8B5E3C" />
                  <circle
                    cx="60"
                    cy="68"
                    r="38"
                    fill={coloredShape ? colorData.hex : '#E2E8F0'}
                    stroke="#27345C"
                    strokeWidth="4"
                  />
                </svg>
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#27345C]/12 text-xs font-extrabold">
                  <Paintbrush className="w-4 h-4 text-[#8054D9]" />
                  <span>{coloredShape ? '✓' : language === 'ar' ? 'لوّن الآن' : 'Paint Now'}</span>
                </div>
              </button>
            </div>
          )}

          {/* Stage 8: Scene Discovery */}
          {stageIdx === 7 && (
            <div className="space-y-4 text-center">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٨: الاكتشاف داخل المشهد' : 'Stage 8: Scene Discovery'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'اكتشف واضغط على كل الأشياء التي تحمل هذا اللون:' : 'Discover and tap ALL items of this color in the scene:'}
              </h2>
              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto p-5 rounded-3xl bg-gradient-to-b from-[#E5F6FF] to-[#E2F9EC]">
                {colorData.discoverySceneItems.map((it) => {
                  const found = foundIds.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        if (it.isTarget) {
                          const next = Array.from(new Set([...foundIds, it.id]));
                          setFoundIds(next);
                          soundEngine.playPop();
                          const total = colorData.discoverySceneItems.filter((x) => x.isTarget).length;
                          if (next.length >= total) {
                            markSuccess('applied', 'مكتشف بارع! وجدت كل العناصر!', 'Super discoverer! You found them all!');
                          }
                        } else {
                          markMistake('هذا الشيء ليس من اللون المطلوب.', 'That item has a different color.');
                        }
                      }}
                      className={`p-4 rounded-2xl border-2 cursor-pointer ${
                        found ? 'bg-white border-[#55D98B] scale-105' : 'bg-white/80 border-transparent'
                      }`}
                    >
                      <div className="text-4xl">{it.emoji}</div>
                      <div className="text-[11px] font-bold mt-1">{t(it.label, language)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage 9: Memory Challenge */}
          {stageIdx === 8 && (
            <div className="space-y-4 text-center">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٩: تحدي الذاكرة' : 'Stage 9: Memory Challenge'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {memoryPhase === 'preview'
                  ? language === 'ar'
                    ? 'احفظ مكان العنصر الذي يحمل لون الدرس قبل أن يختفي!'
                    : 'Remember which card holds our target color before they flip!'
                  : language === 'ar'
                    ? 'الآن تذكّر واضغط على البطاقة الصحيحة!'
                    : 'Now tap the hidden card that matches our color!'}
              </h2>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {colorData.memoryItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (memoryPhase === 'preview') return;
                      if (m.isTarget) {
                        setMemoryPhase('done');
                        markSuccess('recalled', 'ذاكرة قوية! تذكرت المكان الصحيح!', 'Sharp memory! You remembered!');
                      } else {
                        markMistake('جرّب تذكر مكان البطاقة الأخرى!', 'Oops, try another hidden card!');
                      }
                    }}
                    className="h-28 rounded-3xl bg-[#FFF8E9] border-2 border-[#8054D9]/30 flex flex-col items-center justify-center cursor-pointer"
                  >
                    {memoryPhase === 'preview' || memoryPhase === 'done' ? (
                      <>
                        <span className="text-4xl">{m.emoji}</span>
                        <span className="text-[11px] font-bold mt-1">{t(m.label, language)}</span>
                      </>
                    ) : (
                      <span className="text-3xl font-extrabold text-[#8054D9]">❓</span>
                    )}
                  </button>
                ))}
              </div>
              {memoryPhase !== 'preview' && (
                <button
                  type="button"
                  onClick={() => setMemoryPhase('preview')}
                  className="text-xs font-bold text-[#8054D9] underline cursor-pointer"
                >
                  {language === 'ar' ? 'إظهار سريع مرة أخرى' : 'Peek Again'}
                </button>
              )}
            </div>
          )}

          {/* Stage 10: Independent Assessment (Unseen examples) */}
          {stageIdx === 9 && (
            <div className="space-y-5 text-center">
              <span className="text-xs font-extrabold text-[#55D98B]">
                {language === 'ar' ? 'المرحلة ١٠: التقييم المستقل (أمثلة جديدة)' : 'Stage 10: Independent Assessment'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {t(colorData.unseenAssessment[0].prompt, language)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                {colorData.unseenAssessment[0].options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      opt.isCorrect
                        ? markSuccess('applied', 'تقييم ممتاز! أتقنت اللون بأمثلة جديدة!', 'Passed independently with new examples!', true)
                        : markMistake('تذكر الأشياء التي رأيناها ثم جرب مثالاً آخر!', 'Think carefully about the color and try again!')
                    }
                    className="p-5 rounded-3xl bg-[#FFF8E9] border-2 border-[#27345C]/12 hover:border-[#8054D9] cursor-pointer space-y-2"
                  >
                    <div className="text-5xl">{opt.visual}</div>
                    <div className="text-sm font-extrabold text-[#27345C]">{t(opt.label, language)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          B. COMPLETE 11-STAGE ARABIC LETTER JOURNEY (Alif & All 28 Letters)
      ================================================================= */}
      {arabicData && (
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
          {stageIdx === 0 && (
            <div className="text-center space-y-5">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ١: لقاء الحرف' : 'Stage 1: Meet the Letter'}
              </span>
              <h2 className="text-3xl font-extrabold text-[#27345C]">{t(arabicData.introLine, language)}</h2>
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-32 h-32 rounded-3xl mx-auto bg-gradient-to-br from-[#8054D9] to-[#FF78B7] text-white text-7xl font-extrabold flex items-center justify-center shadow-xl"
              >
                {arabicData.char}
              </motion.div>
              <button
                type="button"
                onClick={() => {
                  void academyAudio.speak(arabicData.introLine.ar, 'ar', { label: arabicData.nameAr });
                  markSuccess('exposed', 'تعرفت على الحرف!', 'Letter introduced!');
                }}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                <span>{language === 'ar' ? 'استمع لصوت نونو' : 'Hear Nono Introduce Letter'}</span>
              </button>
            </div>
          )}

          {stageIdx === 1 && (
            <div className="text-center space-y-5">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٢: الاسم والصوت الصحيح' : 'Stage 2: Name vs. Sound'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {arabicData.nameAr} ({arabicData.nameEn})
              </h2>
              <p className="text-lg font-bold text-[#8054D9]">{t(arabicData.phoneticHint, language)}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void academyAudio.speak(arabicData.nameAr, 'ar');
                    setStageDone(true);
                  }}
                  className="px-5 py-3 rounded-2xl bg-[#8054D9] text-white font-bold cursor-pointer"
                >
                  🔊 {language === 'ar' ? 'اسم الحرف' : 'Letter Name'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void academyAudio.speak(arabicData.examples[0].word, 'ar', { slow: true });
                    markSuccess('exposed', 'ممتاز! رددت النطق الصحيح!', 'Great listening & repeating!');
                  }}
                  className="px-5 py-3 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
                >
                  🐢 {language === 'ar' ? 'النطق البطيء في الكلمة' : 'Slow Word Sound'}
                </button>
              </div>
            </div>
          )}

          {stageIdx === 2 && (
            <div className="text-center space-y-5">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٣: التمييز عبر خطوط وأشكال مختلفة' : 'Stage 3: Multi-Font Visual Recognition'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `اضغط على حرف (${arabicData.char}) حتى لو تغيّر شكل الخط:`
                  : `Tap (${arabicData.char}) even across different font styles:`}
              </h2>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto" dir="rtl">
                {[
                  { ch: arabicData.char, font: 'font-serif', ok: true },
                  { ch: arabicData.distractorChars[0], font: 'font-sans', ok: false },
                  { ch: arabicData.distractorChars[1], font: 'font-mono', ok: false },
                ]
                  .sort((a, b) => a.ch.localeCompare(b.ch))
                  .map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        item.ok
                          ? markSuccess('recognized', 'تمييز ممتاز لخط الحرف!', 'Identified across styles!')
                          : markMistake('ركّز على النقاط وشكل الحرف وجرب ثانية!', 'Look closely at dots and curves!')
                      }
                      className={`h-24 rounded-3xl bg-[#FFF8E9] border-2 border-[#27345C]/12 hover:border-[#8054D9] text-5xl font-bold cursor-pointer ${item.font}`}
                    >
                      {item.ch}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {stageIdx === 3 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٤: كتابة وتتبع الحرف' : 'Stage 4: Guided Letter Writing'}
              </span>
              <div className="grid grid-cols-4 gap-2 text-center" dir="rtl">
                {[
                  { l: { ar: 'منفصل', en: 'Isolated' }, v: arabicData.forms.isolated },
                  { l: { ar: 'أول', en: 'Initial' }, v: arabicData.forms.initial },
                  { l: { ar: 'وسط', en: 'Medial' }, v: arabicData.forms.medial },
                  { l: { ar: 'آخر', en: 'Final' }, v: arabicData.forms.final },
                ].map((f, i) => (
                  <div key={i} className="p-2.5 rounded-2xl bg-[#FFF8E9]">
                    <div className="text-2xl font-extrabold text-[#8054D9]">{f.v}</div>
                    <div className="text-[10px] font-bold">{t(f.l, language)}</div>
                  </div>
                ))}
              </div>
              <TracingPad
                guideChar={arabicData.char}
                hintText={t(arabicData.writingTip, language)}
                language={language}
                onCompleteTrace={() =>
                  markSuccess('recalled', 'تدريب كتابة رائع! استمر في التمرّن.', 'Great guided tracing practice!')
                }
              />
            </div>
          )}

          {stageIdx === 4 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٥: كلمات تبدأ بالحرف' : 'Stage 5: Example Words'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {arabicData.examples.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      void academyAudio.speak(ex.word, 'ar');
                      setStageDone(true);
                    }}
                    className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 hover:border-[#8054D9] text-center space-y-1 cursor-pointer"
                  >
                    <div className="text-4xl">{ex.emoji}</div>
                    <div className="text-lg font-extrabold text-[#27345C]">{ex.word}</div>
                    <div className="text-xs text-[#27345C]/65">{ex.meaningEn}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stageIdx === 5 && (
            <div className="text-center space-y-5">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٦: استمع وميّز' : 'Stage 6: Listen & Identify'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `هل تبدأ كلمة "${arabicData.examples[0].word}" ${arabicData.examples[0].emoji} بحرف (${arabicData.char})؟`
                  : `Does "${arabicData.examples[0].word}" ${arabicData.examples[0].emoji} start with ${arabicData.char}?`}
              </h2>
              <button
                type="button"
                onClick={() => void academyAudio.speak(arabicData.examples[0].word, 'ar', { slow: true })}
                className="px-4 py-2 rounded-xl bg-[#FFD84D]/50 text-sm font-bold cursor-pointer"
              >
                🔊 {language === 'ar' ? 'اسمع الكلمة' : 'Hear Word'}
              </button>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => markSuccess('recognized', 'نعم! إجابة صحيحة!', 'Yes, correct!')}
                  className="nono-btn-tactile px-8 py-3 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'نعم ✓' : 'Yes ✓'}
                </button>
                <button
                  type="button"
                  onClick={() => markMistake('اسمع أول صوت في الكلمة مرة أخرى!', 'Listen closely to the very first sound!')}
                  className="px-8 py-3 rounded-2xl bg-slate-100 font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'لا ✗' : 'No ✗'}
                </button>
              </div>
            </div>
          )}

          {stageIdx === 6 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٧: ابحث عن الحرف داخل الكلمة' : 'Stage 7: Find Letter in Word'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `اضغط على الحرف (${arabicData.char}) داخل كلمة "${arabicData.examples[0].word}":`
                  : `Tap (${arabicData.char}) inside "${arabicData.examples[0].word}":`}
              </h2>
              <div className="flex justify-center gap-3" dir="rtl">
                {Array.from(arabicData.examples[0].word).map((ch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      idx === 0 || ch === arabicData.char
                        ? markSuccess('recognized', 'التقطت مكان الحرف بدقة!', 'You spotted it!')
                        : markMistake('هذا حرف آخر في الكلمة، ابحث عن حرفنا!', 'That is another letter in the word!')
                    }
                    className="w-16 h-16 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/15 hover:border-[#8054D9] text-3xl font-extrabold cursor-pointer"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stageIdx === 7 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٨: الحرف الناقص' : 'Stage 8: Missing Letter'}
              </span>
              <div className="text-4xl">{arabicData.missingWordPrompt.emoji}</div>
              <div className="text-4xl font-extrabold tracking-widest text-[#8054D9]" dir="rtl">
                {arabicData.missingWordPrompt.masked}
              </div>
              <div className="flex justify-center gap-3" dir="rtl">
                {[arabicData.missingWordPrompt.answerChar, ...arabicData.distractorChars]
                  .sort()
                  .map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() =>
                        ch === arabicData.missingWordPrompt.answerChar
                          ? markSuccess('recalled', `أكملت الكلمة: ${arabicData.missingWordPrompt.fullWord}!`, `Completed: ${arabicData.missingWordPrompt.fullWord}!`)
                          : markMistake('جرب الحرف الذي يبدأ به الصوت!', 'Try the letter matching the starting sound!')
                      }
                      className="w-16 h-16 rounded-2xl bg-white border-2 border-[#27345C]/15 hover:border-[#8054D9] text-3xl font-extrabold cursor-pointer"
                    >
                      {ch}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {stageIdx === 8 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ٩: بناء الكلمة' : 'Stage 9: Build the Word'}
              </span>
              <div className="text-4xl">{arabicData.buildWordTiles.emoji}</div>
              <div className="h-14 rounded-2xl bg-[#FFF8E9] border-2 border-dashed border-[#8054D9] flex items-center justify-center text-2xl font-extrabold tracking-widest max-w-xs mx-auto" dir="rtl">
                {builtWord || '...'}
              </div>
              <div className="flex justify-center flex-wrap gap-2" dir="rtl">
                {arabicData.buildWordTiles.tiles.map((lt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const next = builtWord + lt;
                      setBuiltWord(next);
                      soundEngine.playPop();
                      if (next === arabicData.buildWordTiles.targetWord) {
                        markSuccess('applied', `بنيت الكلمة بنجاح: ${next}!`, `Word built: ${next}!`);
                      } else if (next.length >= arabicData.buildWordTiles.targetWord.length) {
                        setBuiltWord('');
                        markMistake('أعد ترتيب الحروف بالترتيب الصحيح!', 'Try arranging the letters in the right order!');
                      }
                    }}
                    className="w-14 h-14 rounded-2xl bg-white border-2 border-[#27345C]/15 text-2xl font-extrabold cursor-pointer"
                  >
                    {lt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stageIdx === 9 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#8054D9]">
                {language === 'ar' ? 'المرحلة ١٠: تدريب القراءة المناسب لعمرك' : 'Stage 10: Age-Adapted Reading Practice'}
              </span>
              <div className="p-6 rounded-3xl bg-[#FFF8E9] border border-[#27345C]/10 text-xl sm:text-2xl font-extrabold text-[#27345C]">
                {t(arabicData.readingSentences[getInternalAgeBand(activeChild)], language)}
              </div>
              <button
                type="button"
                onClick={() => {
                  const rawSentence = arabicData.readingSentences[getInternalAgeBand(activeChild)].ar;
                  void academyAudio.speak(rawSentence, 'ar', { slow: true, label: rawSentence });
                  markSuccess('applied', 'قراءة رائعة!', 'Wonderful reading practice!');
                }}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                <span>{language === 'ar' ? 'استمع واقرأ مع نونو' : 'Listen & Read with Nono'}</span>
              </button>
            </div>
          )}

          {stageIdx === 10 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#55D98B]">
                {language === 'ar' ? 'المرحلة ١١: التقييم المستقل النهائي' : 'Stage 11: Independent Assessment'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `في كلمة "${arabicData.unseenAssessmentWord.word}" ${arabicData.unseenAssessmentWord.emoji} — هل يظهر حرف (${arabicData.char})؟`
                  : `In "${arabicData.unseenAssessmentWord.word}" ${arabicData.unseenAssessmentWord.emoji} — do you spot ${arabicData.char}?`}
              </h2>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    markSuccess('applied', 'ممتاز! أكملت جميع المراحل الـ١١ بنجاح!', 'Independent mastery verified across all 11 stages!', true)
                  }
                  className="nono-btn-tactile px-8 py-3 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? `نعم، يبدأ بحرف ${arabicData.char} ✓` : `Yes, I see ${arabicData.char} ✓`}
                </button>
                <button
                  type="button"
                  onClick={() => markMistake('انظر إلى أول حرف في الكلمة جيداً!', 'Look closely at the beginning of the word!')}
                  className="px-8 py-3 rounded-2xl bg-slate-100 font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'غير متأكد' : 'Not sure'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          C. COMPLETE 11-STAGE ENGLISH LETTER JOURNEY (A-Z)
      ================================================================= */}
      {englishData && (
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
          {stageIdx <= 1 && (
            <div className="text-center space-y-4" dir="ltr">
              <span className="text-xs font-extrabold text-[#39BDF2]">
                Stage {stageIdx + 1}: {stageIdx === 0 ? 'Meet the Letter' : 'Name vs. Phonetic Sound'}
              </span>
              <div className="w-32 h-32 rounded-3xl mx-auto bg-gradient-to-br from-[#39BDF2] to-[#55D98B] text-white text-6xl font-extrabold flex items-center justify-center shadow-lg">
                {englishData.upper}{englishData.lower}
              </div>
              <p className="text-lg font-extrabold text-[#27345C]">
                Name: "{englishData.nameSound}" · Sound: {englishData.phoneticSound}
              </p>
              <button
                type="button"
                onClick={() => {
                  void academyAudio.speak(`${englishData.upper}. ${englishData.word}`, 'en', {
                    slow: stageIdx === 1,
                  });
                  markSuccess('exposed', 'سمعت نطق الحرف!', 'Heard name and sound!');
                }}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#39BDF2] text-white font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5" />
                <span>Hear {englishData.upper} & {englishData.word}</span>
              </button>
            </div>
          )}

          {stageIdx === 2 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#39BDF2]">Stage 3: Uppercase / Lowercase Matching</span>
              <h2 className="text-2xl font-extrabold">Match "{englishData.upper}" to its lowercase twin:</h2>
              <div className="flex justify-center gap-3" dir="ltr">
                {[englishData.lower, ...englishData.distractorLowers].sort().map((lw) => (
                  <button
                    key={lw}
                    type="button"
                    onClick={() =>
                      lw === englishData.lower
                        ? markSuccess('recognized', 'طابقت الحرف الكبير والصغير!', 'Matched!')
                        : markMistake('جرب حرفاً آخر!', 'Try another lowercase letter!')
                    }
                    className="w-16 h-16 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 text-3xl font-extrabold cursor-pointer"
                  >
                    {lw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stageIdx === 3 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-[#39BDF2]">Stage 4: Guided Tracing Practice</span>
              <TracingPad
                guideChar={`${englishData.upper} ${englishData.lower}`}
                strokeColor="#39BDF2"
                language={language}
                onCompleteTrace={() => markSuccess('recalled', 'تتبع ممتاز!', 'Great tracing!')}
              />
            </div>
          )}

          {stageIdx >= 4 && stageIdx <= 9 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#39BDF2]">
                Stage {stageIdx + 1}: Phonics, Words & Reading Application
              </span>
              <div className="text-5xl">{englishData.emoji}</div>
              <p className="text-xl font-extrabold text-[#27345C]" dir="ltr">
                {stageIdx === 4 && `${englishData.word} (${englishData.wordAr})`}
                {stageIdx === 5 && `Which word starts with ${englishData.upper}?`}
                {stageIdx === 6 && `Find ${englishData.upper} inside "${englishData.word.toUpperCase()}"`}
                {stageIdx === 7 && `Missing letter: _${englishData.word.slice(1)}`}
                {stageIdx === 8 && `CVC Word: ${englishData.cvcWord}`}
                {stageIdx === 9 && t(englishData.readingSentence[getInternalAgeBand(activeChild)], language)}
              </p>
              <button
                type="button"
                onClick={() => {
                  void academyAudio.speak(
                    stageIdx === 9
                      ? englishData.readingSentence[getInternalAgeBand(activeChild)].en
                      : englishData.word,
                    'en',
                    { slow: true },
                  );
                  markSuccess('recalled', 'أحسنت في هذه المرحلة!', 'Stage completed!');
                }}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#39BDF2] text-white font-bold cursor-pointer"
              >
                🔊 {language === 'ar' ? 'تأكيد والاستماع' : 'Practice & Confirm'}
              </button>
            </div>
          )}

          {stageIdx === 10 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#55D98B]">Stage 11: Independent Assessment</span>
              <h2 className="text-2xl font-extrabold text-[#27345C]" dir="ltr">
                Pick the word that matches sound {englishData.phoneticSound}:
              </h2>
              <div className="flex justify-center gap-3" dir="ltr">
                {[
                  { w: englishData.word, e: englishData.emoji, ok: true },
                  { w: 'Zebra', e: '🦓', ok: englishData.upper === 'Z' },
                ].map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      opt.ok
                        ? markSuccess('applied', 'إتقان مستقل للحرف!', 'Independent English letter mastery verified!', true)
                        : markMistake('استمع لصوت بداية الكلمة!', 'Check the beginning sound!')
                    }
                    className="p-5 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 font-extrabold cursor-pointer"
                  >
                    <span className="text-3xl block mb-1">{opt.e}</span>
                    {opt.w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          D. DEEP MULTI-STAGE MATH UNIT JOURNEY
      ================================================================= */}
      {mathData && (
        <div className="nono-card rounded-[2rem] p-6 sm:p-8 space-y-6">
          {stageIdx === 0 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#FF9360]">
                {language === 'ar' ? 'المرحلة ١: مقدمة المفهوم' : 'Stage 1: Concept Introduction'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">{t(mathData.title, language)}</h2>
              <p className="text-base text-[#27345C]/80 max-w-xl mx-auto">{t(mathData.explanation, language)}</p>
              <button
                type="button"
                onClick={() => {
                  void academyAudio.speak(t(mathData.explanation, language), language, {
                    label: t(mathData.title, language),
                  });
                  markSuccess('exposed', 'فهمنا الفكرة الأساسية!', 'Great start!');
                }}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#FF9360] text-white font-bold cursor-pointer"
              >
                🔊 {language === 'ar' ? 'استمع للشرح' : 'Hear Explanation'}
              </button>
            </div>
          )}

          {stageIdx === 1 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#FF9360]">
                {language === 'ar' ? 'المرحلة ٢: رؤية الكمية الحقيقية' : 'Stage 2: Visual Quantity'}
              </span>
              <div className="text-4xl tracking-widest">
                {mathData.emoji.repeat(Math.min(12, mathData.targetNumber))}
              </div>
              <button
                type="button"
                onClick={() => markSuccess('exposed', 'ربطت الرمز بالكمية!', 'Quantity connected!')}
                className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
              >
                {language === 'ar' ? `عددهم = ${mathData.targetNumber} ✓` : `Total = ${mathData.targetNumber} ✓`}
              </button>
            </div>
          )}

          {stageIdx === 2 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-[#FF9360]">
                {language === 'ar' ? 'المرحلة ٣: كتابة العدد' : 'Stage 3: Guided Number Tracing'}
              </span>
              <TracingPad
                guideChar={String(mathData.targetNumber)}
                strokeColor="#FF9360"
                language={language}
                onCompleteTrace={() => markSuccess('recalled', 'كتابة رائعة!', 'Great tracing!')}
              />
            </div>
          )}

          {stageIdx === 3 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#FF9360]">
                {language === 'ar' ? 'المرحلة ٤: تدريب تفاعلي' : 'Stage 4: Guided Math Practice'}
              </span>
              <h2 className="text-2xl font-extrabold text-[#27345C]">{t(mathData.operationPrompt, language)}</h2>
              <button
                type="button"
                onClick={() => void academyAudio.speak(t(mathData.operationPrompt, language), language, { slow: true })}
                className="px-4 py-2 rounded-xl bg-[#FFD84D]/50 text-[#27345C] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>{language === 'ar' ? 'استمع للسؤال' : 'Hear Prompt'}</span>
              </button>
              <div className="flex justify-center gap-3" dir="ltr">
                {mathData.operationChoices.map((ch) => (
                  <button
                    key={ch.label}
                    type="button"
                    onClick={() =>
                      ch.isCorrect
                        ? markSuccess('recognized', 'حساب دقيق!', 'Accurate!')
                        : markMistake('احسب الكمية مرة أخرى بهدوء!', 'Count carefully and try again!')
                    }
                    className="px-6 py-3 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 font-mono-num text-xl font-extrabold cursor-pointer"
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stageIdx >= 4 && (
            <div className="text-center space-y-4">
              <span className="text-xs font-extrabold text-[#55D98B]">
                {stageIdx === 4
                  ? language === 'ar'
                    ? 'المرحلة ٥: مسألة حياتية'
                    : 'Stage 5: Word Problem Application'
                  : language === 'ar'
                    ? 'المرحلة ٦: التقييم المستقل'
                    : 'Stage 6: Independent Assessment'}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C] max-w-xl mx-auto">
                {t(mathData.wordProblem.prompt, language)}
              </h2>
              <button
                type="button"
                onClick={() => void academyAudio.speak(t(mathData.wordProblem.prompt, language), language, { slow: true })}
                className="px-4 py-2 rounded-xl bg-[#FFD84D]/50 text-[#27345C] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>{language === 'ar' ? 'استمع للمسألة' : 'Hear Word Problem'}</span>
              </button>
              <div className="flex justify-center gap-3" dir="ltr">
                {mathData.wordProblem.choices.map((ch) => (
                  <button
                    key={ch.label}
                    type="button"
                    onClick={() =>
                      ch.isCorrect
                        ? markSuccess('applied', 'بطل الرياضيات!', 'Math champion!', stageIdx === 5)
                        : markMistake('اقرأ المسألة خطوة بخطوة مع نونو!', 'Read step by step with Nono!')
                    }
                    className="px-6 py-3 rounded-2xl bg-white border-2 border-[#27345C]/15 font-mono-num text-xl font-extrabold cursor-pointer"
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Stage Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-[#8054D9] flex items-center gap-2">
          {feedback && (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#55D98B]" />
              <span>{feedback}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {stageIdx > 0 && (
            <button
              type="button"
              onClick={() => setStageIdx((s) => Math.max(0, s - 1))}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold cursor-pointer"
            >
              {language === 'ar' ? 'السابق' : 'Previous'}
            </button>
          )}
          <button
            type="button"
            onClick={handleNextStage}
            className={`nono-btn-tactile px-6 py-2.5 rounded-2xl font-extrabold text-sm flex items-center gap-2 cursor-pointer ${
              stageDone ? 'bg-[#55D98B] text-[#27345C]' : 'bg-[#8054D9] text-white'
            }`}
          >
            {stageIdx + 1 === totalStages ? (
              <>
                <Award className="w-4 h-4" />
                <span>{language === 'ar' ? 'إنهاء الرحلة' : 'Complete Journey'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{language === 'ar' ? 'المرحلة التالية' : 'Next Stage'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
