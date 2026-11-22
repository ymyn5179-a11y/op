import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Beaker,
  BookOpen,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Ear,
  FlaskConical,
  GraduationCap,
  Layers,
  Palette,
  Play,
  RefreshCw,
  Shapes,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { AcademyAudioBar } from '../components/academy/AcademyAudioBar';
import { DeepLessonEngine, DeepLessonTarget } from '../components/academy/DeepLessonEngine';
import { Level1LessonRunner } from '../components/academy/Level1LessonRunner';
import { TracingPad } from '../components/academy/TracingPad';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import {
  ACADEMY_COLORS,
  ACADEMY_SHAPES,
  ARABIC_ALPHABET,
  COLOR_MIX_RECIPES,
  ENGLISH_ALPHABET,
  NUMBER_TIERS,
  PARENT_OFFLINE_ACTIVITIES,
} from '../data/academyData';
import { AGE_CURRICULUM_OUTCOMES, MATH_DEEP_UNITS } from '../data/deepCurriculum';
import {
  ALL_LEVEL1_LESSONS,
  getLevel1LessonsBySubject,
  LEVEL1_REVIEW_UNITS,
} from '../data/level1Curriculum';
import { formatNumber, getAgeGroupMeta, t } from '../i18n/translations';
import {
  CmsLessonRecord,
  Level1LessonDefinition,
  Level1Subject,
  NonoMood,
} from '../types/nonoland';
import {
  getInternalAgeBand,
  isContentAppropriateForChild,
} from '../utils/ageAdaptation';
import { useAcademyAudio } from '../utils/academyAudioController';
import { soundEngine } from '../utils/soundEngine';

type AcademyTab = 'level1' | 'daily' | 'arabic' | 'english' | 'numbers' | 'colors-shapes';

export const AcademyScreen: React.FC = () => {
  const { activeChild, authSession, language, parentSettings, recordConceptInteraction, navigate } = useNonoLand();
  const academyAudio = useAcademyAudio(language, {
    csrfToken: authSession?.csrfToken,
    muted: parentSettings?.muted,
  });
  const internalBand = activeChild ? getInternalAgeBand(activeChild) : '3-4';
  const [tab, setTab] = useState<AcademyTab>('level1');
  const [nonoMood, setNonoMood] = useState<NonoMood>('idle');
  const [deepTarget, setDeepTarget] = useState<DeepLessonTarget | null>(null);
  const [activeL1Lesson, setActiveL1Lesson] = useState<Level1LessonDefinition | null>(null);
  const [l1WorldFilter, setL1WorldFilter] = useState<Level1Subject>('arabic');
  const [cmsLessons, setCmsLessons] = useState<CmsLessonRecord[]>([]);

  useEffect(() => {
    academyAudio.stop();
  }, [tab, activeL1Lesson, deepTarget]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cms/content')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.lessons)) {
          setCmsLessons(
            data.lessons.filter(
              (ls: CmsLessonRecord) =>
                ls.published && (!activeChild || isContentAppropriateForChild(ls, activeChild)),
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeChild]);

  // Arabic Alphabet state
  const [arIndex, setArIndex] = useState(0);
  const [arChallengeResult, setArChallengeResult] = useState<'none' | 'correct' | 'retry'>('none');
  const currentAr = ARABIC_ALPHABET[arIndex];

  // English Alphabet & CVC Builder state
  const [enIndex, setEnIndex] = useState(0);
  const [enCaseMatchResult, setEnCaseMatchResult] = useState<'none' | 'correct' | 'retry'>('none');
  const currentEn = ENGLISH_ALPHABET[enIndex];
  const cvcTargets = useMemo(
    () => [
      { word: 'CAT', emoji: '🐱', letters: ['T', 'C', 'A', 'B'] },
      { word: 'SUN', emoji: '☀️', letters: ['N', 'U', 'S', 'M'] },
      { word: 'DOG', emoji: '🐶', letters: ['G', 'D', 'O', 'P'] },
      { word: 'HAT', emoji: '👒', letters: ['A', 'H', 'T', 'R'] },
    ],
    [],
  );
  const [cvcIdx, setCvcIdx] = useState(0);
  const [cvcBuilt, setCvcBuilt] = useState<string>('');
  const currentCvc = cvcTargets[cvcIdx];

  // Basket Counting state (Ages 1-4)
  const [groupRows, setGroupRows] = useState(2);
  const [groupCols, setGroupCols] = useState(3);

  // Numbers Academy state (internally adapted 1-5 / 1-10 / 1-20 within Little Explorers)
  const defaultTierId: '1-5' | '1-10' | '1-20' =
    internalBand === '1-2' ? '1-5' : internalBand === '2-3' ? '1-10' : '1-20';
  const [numTierId, setNumTierId] = useState<'1-5' | '1-10' | '1-20'>(defaultTierId);
  const currentTier = NUMBER_TIERS.find((nt) => nt.id === numTierId) || NUMBER_TIERS[0];
  const [selectedNumber, setSelectedNumber] = useState<number>(currentTier.numbers[0]);
  const [compareLeft, setCompareLeft] = useState(4);
  const [compareRight, setCompareRight] = useState(7);
  const [compareFeedback, setCompareFeedback] = useState<string>('');

  // Colors & Mixing Lab state
  const [mixA, setMixA] = useState<string>('red');
  const [mixB, setMixB] = useState<string>('blue');
  const [selectedColorId, setSelectedColorId] = useState<string>('red');

  // Daily Learning Adventure (1 Letter + 1 Number + 1 Color/Shape + 1 Logic/Creative + 1 Real-World Discovery)
  const dailyStarsSeed = activeChild?.stars || 0;
  const dailyLetter = ARABIC_ALPHABET[(dailyStarsSeed + 2) % ARABIC_ALPHABET.length];
  const dailyEn = ENGLISH_ALPHABET[(dailyStarsSeed + 3) % ENGLISH_ALPHABET.length];
  const dailyNumber = currentTier.numbers[dailyStarsSeed % currentTier.numbers.length];
  const dailyColor = ACADEMY_COLORS[dailyStarsSeed % ACADEMY_COLORS.length];
  const dailyOffline = PARENT_OFFLINE_ACTIVITIES[dailyStarsSeed % PARENT_OFFLINE_ACTIVITIES.length];

  // Arabic similar-letter distractor options
  const arDistractors = useMemo(() => {
    const group = currentAr.similarGroup.filter((g) => g !== currentAr.char);
    const pool = [currentAr.char, ...group.slice(0, 2)];
    while (pool.length < 3) {
      const alt = ARABIC_ALPHABET[(arIndex + pool.length * 3) % ARABIC_ALPHABET.length].char;
      if (!pool.includes(alt)) pool.push(alt);
    }
    return [...pool].sort();
  }, [arIndex, currentAr]);

  // English lowercase distractor options
  const enLowerOptions = useMemo(() => {
    const alt1 = ENGLISH_ALPHABET[(enIndex + 4) % ENGLISH_ALPHABET.length].lower;
    const alt2 = ENGLISH_ALPHABET[(enIndex + 9) % ENGLISH_ALPHABET.length].lower;
    return [currentEn.lower, alt1, alt2].sort();
  }, [enIndex, currentEn]);

  // Color mixing lookup
  const mixRecipe = COLOR_MIX_RECIPES.find(
    (r) => (r.a === mixA && r.b === mixB) || (r.a === mixB && r.b === mixA),
  );
  const colorObjA = ACADEMY_COLORS.find((c) => c.id === mixA) || ACADEMY_COLORS[0];
  const colorObjB = ACADEMY_COLORS.find((c) => c.id === mixB) || ACADEMY_COLORS[1];

  const speakSlowOrNormal = (text: string, lang: 'ar' | 'en', slow = false, label?: string) => {
    void academyAudio.speak(text, lang, { slow, label: label || text });
  };

  const conceptStats = useMemo(() => {
    const entries = Object.values(activeChild?.conceptMastery || {});
    return {
      total: entries.length,
      needsRevision: entries.filter((e) => e.mistakesCount > e.correctCount).slice(0, 3),
    };
  }, [activeChild?.conceptMastery]);

  if (!activeChild) return null;

  const handleCompareChoice = (op: '<' | '>' | '=') => {
    const ok =
      (op === '<' && compareLeft < compareRight) ||
      (op === '>' && compareLeft > compareRight) ||
      (op === '=' && compareLeft === compareRight);

    if (ok) {
      soundEngine.playSuccess();
      setNonoMood('celebrating');
      setCompareFeedback(language === 'ar' ? 'إجابة صحيحة! أحسنت!' : 'Spot on! Great comparison!');
      recordConceptInteraction({
        conceptId: `num-compare-${compareLeft}-${compareRight}`,
        domain: 'numbers',
        label: { ar: `مقارنة ${compareLeft} و ${compareRight}`, en: `Compare ${compareLeft} & ${compareRight}` },
        stage: 'applied',
        isCorrect: true,
      });
      setTimeout(() => {
        setCompareLeft(Math.floor(Math.random() * 12) + 1);
        setCompareRight(Math.floor(Math.random() * 12) + 1);
        setCompareFeedback('');
        setNonoMood('idle');
      }, 1100);
    } else {
      soundEngine.playEncourage();
      setNonoMood('encouraging');
      setCompareFeedback(
        language === 'ar'
          ? 'تذكر: فم التمساح ينفتح دائماً نحو العدد الأكبر!'
          : 'Tip: The wide side always opens toward the bigger quantity!',
      );
      recordConceptInteraction({
        conceptId: `num-compare-${compareLeft}-${compareRight}`,
        domain: 'numbers',
        label: { ar: `مقارنة ${compareLeft} و ${compareRight}`, en: `Compare ${compareLeft} & ${compareRight}` },
        stage: 'exposed',
        isCorrect: false,
      });
    }
  };

  const ageCurriculum = AGE_CURRICULUM_OUTCOMES['1-4'];
  const completedDeepCount = (activeChild.completedDeepLessons || []).length;

  const l1ProgressMap = activeChild.level1Progress || {};
  const l1DemonstratedCount = Object.values(l1ProgressMap).filter(
    (p) => p.status === 'demonstrated',
  ).length;
  const l1VisibleLessons = getLevel1LessonsBySubject(l1WorldFilter);
  const l1VisibleReviews = LEVEL1_REVIEW_UNITS.filter((r) => r.subject === l1WorldFilter);

  if (activeL1Lesson) {
    return (
      <Level1LessonRunner
        lesson={activeL1Lesson}
        onExit={() => setActiveL1Lesson(null)}
        onSelectNextLesson={(nextLs) => setActiveL1Lesson(nextLs)}
      />
    );
  }

  if (deepTarget) {
    return (
      <DeepLessonEngine
        target={deepTarget}
        onExit={() => setDeepTarget(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[2rem] bg-gradient-to-br from-[#8054D9] via-[#5F45C9] to-[#39BDF2] text-white p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-start">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-extrabold text-[#FFD84D]">
              <NonoLandLogo variant="badge" size="xs" tone="dark" language={language} />
              <span>
                {t(getAgeGroupMeta(activeChild.ageGroup).label, language)} ·{' '}
                {language === 'ar' ? 'تعلّم متعدد الحواس' : 'Multi-Sensory Learning'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center justify-center md:justify-start gap-2.5">
              <GraduationCap className="w-8 h-8 text-[#FFD84D]" />
              <span>{language === 'ar' ? 'أكاديمية نونو للتعلّم المبكر' : "Nono's Learning Academy"}</span>
            </h1>
            <p className="text-sm sm:text-base text-white/90 max-w-2xl">
              {language === 'ar'
                ? 'شاهد، اسمع بوضوح وببطء، تتبع بإصبعك، امزج الألوان، واربط كل رمز بكميته ومعناه الحقيقي.'
                : 'See, hear (with slow replay), finger-trace, mix colors, and connect every symbol to real-world meaning.'}
            </p>
          </div>
          <NonoCharacter
            mood={nonoMood}
            scarfColor={activeChild.companionScarfColor}
            size="md"
            language={language}
          />
        </div>
      </div>

      {/* Academy Section Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-[#27345C]/12">
        {[
          { id: 'level1' as const, icon: <GraduationCap className="w-4 h-4" />, ar: 'المسار التأسيسي (٧٥ درساً)', en: 'Foundations Track (75)' },
          { id: 'daily' as const, icon: <Sparkles className="w-4 h-4" />, ar: 'رحلة اليوم والدليل', en: 'Daily Path & Guide' },
          { id: 'arabic' as const, icon: <BookOpen className="w-4 h-4" />, ar: 'الحروف العربية (٢٨)', en: 'Arabic (28)' },
          { id: 'english' as const, icon: <Ear className="w-4 h-4" />, ar: 'الحروف الإنجليزية (A-Z)', en: 'English (A-Z)' },
          { id: 'numbers' as const, icon: <Calculator className="w-4 h-4" />, ar: 'الأرقام والرياضيات', en: 'Numbers & Math' },
          { id: 'colors-shapes' as const, icon: <Palette className="w-4 h-4" />, ar: 'الألوان والأشكال والمختبر', en: 'Colors, Shapes & Lab' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setTab(item.id);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              tab === item.id ? 'bg-[#8054D9] text-white shadow-sm' : 'text-[#27345C]/75 hover:bg-[#FFF8E9]'
            }`}
          >
            {item.icon}
            <span>{language === 'ar' ? item.ar : item.en}</span>
          </button>
        ))}
      </div>

      {/* Active Academy Audio Playback Controls */}
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

      {/* =========================================
          TAB 0: LEVEL 1 COMPLETE CURRICULUM (75 LESSONS + 12 REVIEWS)
      ========================================= */}
      {tab === 'level1' && (
        <div className="space-y-5">
          <div className="nono-card rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-[#FFF3D1]/60 via-white to-[#E5F6FF]/60 border-2 border-[#8054D9]/15 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold text-[#8054D9]">
                  {language === 'ar' ? 'المستكشفون الصغار · المسار التأسيسي (١–٤ سنوات)' : 'Little Explorers · Foundations Track (Ages 1–4)'}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C] mt-1">
                  {language === 'ar'
                    ? 'عوالم التعلم الأربعة — ٧٥ درساً حقيقياً و١٢ وحدة مراجعة'
                    : '4 Subject Worlds — 75 Real Lessons & 12 Review Units'}
                </h2>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-white border border-[#27345C]/12 text-xs font-extrabold text-[#27345C] font-mono-num">
                {formatNumber(l1DemonstratedCount, language)} / {formatNumber(ALL_LEVEL1_LESSONS.length, language)}{' '}
                {language === 'ar' ? 'مكتمل' : 'Demonstrated'}
              </div>
            </div>

            {/* 4 Subject Worlds Switcher */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: 'arabic' as const, emoji: '📖', count: 28, ar: 'عالم الحروف العربية', en: 'Arabic Letters World', color: '#8054D9' },
                { id: 'english' as const, emoji: '🔤', count: 26, ar: 'عالم الحروف الإنجليزية', en: 'English Alphabet World', color: '#39BDF2' },
                { id: 'numbers' as const, emoji: '🔢', count: 11, ar: 'عالم الأرقام (٠–١٠)', en: 'Numbers World (0–10)', color: '#FF9360' },
                { id: 'colors' as const, emoji: '🎨', count: 10, ar: 'عالم الألوان العشرة', en: 'Colors World (10)', color: '#FF4D6D' },
              ].map((w) => {
                const worldDone = getLevel1LessonsBySubject(w.id).filter(
                  (ls) => l1ProgressMap[ls.id]?.status === 'demonstrated',
                ).length;
                const active = l1WorldFilter === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setL1WorldFilter(w.id);
                    }}
                    className={`p-4 rounded-2xl border-2 text-start space-y-1.5 cursor-pointer transition-all ${
                      active ? 'bg-white shadow-md scale-[1.02]' : 'bg-white/75 border-[#27345C]/10'
                    }`}
                    style={{ borderColor: active ? w.color : undefined }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{w.emoji}</span>
                      <span className="text-xs font-extrabold font-mono-num" style={{ color: w.color }}>
                        {worldDone}/{w.count}
                      </span>
                    </div>
                    <p className="font-extrabold text-sm text-[#27345C]">
                      {language === 'ar' ? w.ar : w.en}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lessons Grid for Selected World (No Locking — Any Lesson Playable & Reviewable) */}
          <div className="nono-card rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `الدروس التفاعلية (${formatNumber(l1VisibleLessons.length, language)} درساً)`
                : `Interactive Lessons (${l1VisibleLessons.length} Lessons)`}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {l1VisibleLessons.map((ls) => {
                const prog = l1ProgressMap[ls.id];
                const status = prog?.status || 'not-started';
                const statusBadge =
                  status === 'demonstrated'
                    ? { ar: 'مُتقن ✓', en: 'Demonstrated ✓', cls: 'bg-[#55D98B]/25 text-[#27345C]' }
                    : status === 'needs-revision'
                      ? { ar: 'مراجعة مجدولة ↺', en: 'Needs Revision ↺', cls: 'bg-[#FF9360]/25 text-[#27345C]' }
                      : status === 'practicing' || status === 'learning' || status === 'improving'
                        ? { ar: 'قيد التعلّم', en: 'In Progress', cls: 'bg-[#FFD84D]/35 text-[#27345C]' }
                        : { ar: 'ابدأ', en: 'Start', cls: 'bg-slate-100 text-[#27345C]/70' };
                return (
                  <button
                    key={ls.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      setActiveL1Lesson(ls);
                    }}
                    className="p-4 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/12 hover:border-[#8054D9] text-start space-y-2 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-xl border border-[#27345C]/10"
                        style={{
                          backgroundColor: ls.colorHex || '#FFFFFF',
                          color: ls.colorHex && ls.colorHex !== '#FFFFFF' ? '#FFFFFF' : '#27345C',
                        }}
                      >
                        {ls.subject === 'colors' ? ls.teachingVocab[0]?.emoji : ls.targetSymbol}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap shrink-0 ${statusBadge.cls}`}>
                        {language === 'ar' ? statusBadge.ar : statusBadge.en}
                      </span>
                    </div>
                    <p className="font-extrabold text-sm text-[#27345C] leading-snug">
                      {ls.id} · {t(ls.title, language)}
                    </p>
                    <p className="text-[11px] text-[#27345C]/70">
                      {ls.teachingVocab.map((v) => `${v.emoji} ${v.text}`).slice(0, 2).join(' · ')}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Review Units for This World */}
            {l1VisibleReviews.length > 0 && (
              <div className="pt-4 border-t border-[#27345C]/10 space-y-3">
                <h4 className="text-sm font-extrabold text-[#8054D9]">
                  {language === 'ar' ? 'وحدات المراجعة والتثبيت' : 'Spaced Review Units'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {l1VisibleReviews.map((rv) => (
                    <div
                      key={rv.id}
                      className="p-3.5 rounded-2xl bg-[#F3E8FF]/60 border border-[#8054D9]/20 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-extrabold text-xs text-[#27345C]">{t(rv.title, language)}</p>
                        <p className="text-[11px] text-[#27345C]/70 mt-0.5">
                          {rv.lessonIds[0]} – {rv.lessonIds[rv.lessonIds.length - 1]} ({rv.lessonIds.length})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const targetLs =
                            l1VisibleLessons.find(
                              (l) => rv.lessonIds.includes(l.id) && l1ProgressMap[l.id]?.status === 'needs-revision',
                            ) || l1VisibleLessons.find((l) => l.id === rv.lessonIds[0]);
                          if (targetLs) setActiveL1Lesson(targetLs);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold cursor-pointer shrink-0"
                      >
                        {language === 'ar' ? 'مراجعة' : 'Review'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================
          TAB 1: DAILY LEARNING ADVENTURE + REVISION
      ========================================= */}
      {tab === 'daily' && (
        <div className="space-y-5">
          {/* Smart Age-Adapted Curriculum Overview */}
          <div className="nono-card rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-[#F3E8FF]/60 via-white to-[#E5F6FF]/60 border-2 border-[#8054D9]/15 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold text-[#8054D9]">
                  {t(ageCurriculum.guidanceStyle, language)}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C] mt-1">
                  {t(ageCurriculum.title, language)}
                </h2>
                <p className="text-xs sm:text-sm text-[#27345C]/75 mt-1">
                  {t(ageCurriculum.expectedOutcome, language)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/12 text-xs font-extrabold text-[#27345C] tabular-nums">
                  {formatNumber(completedDeepCount, language)}{' '}
                  {language === 'ar' ? 'رحلة عميقة مكتملة' : 'Deep Lessons Done'}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('exams')}
                  className="nono-btn-tactile px-4 py-2 rounded-xl bg-[#FF9360] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{language === 'ar' ? 'امتحانات نونو (٤٠ سؤالاً)' : 'Official Exams (40 Q)'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {ageCurriculum.focusAreas.map((area, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-white border border-[#27345C]/10 text-xs font-bold text-[#27345C] flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#55D98B] shrink-0 mt-0.5" />
                  <span>{t(area, language)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Deep Multi-Stage Concept Journeys (9-11 Stages Each) */}
          <div className="nono-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#8054D9]" />
                  <span>
                    {language === 'ar'
                      ? 'رحلات التعلّم العميق الكاملة (٩ – ١١ مرحلة لكل مفهوم)'
                      : 'Complete Deep Concept Journeys (9–11 Stages Each)'}
                  </span>
                </h2>
                <p className="text-xs text-[#27345C]/70 mt-0.5">
                  {language === 'ar'
                    ? 'تقديم، شرح، أمثلة واقعية، استماع، تمييز بصري، فرز، تلوين أو كتابة، ذاكرة، وتقييم مستقل!'
                    : 'Intro, explanation, real-world examples, audio, recognition, sorting, coloring/tracing, memory & independent assessment.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setDeepTarget({ type: 'color', colorId: 'red' })}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#FF4D6D]/15 to-white border-2 border-[#FF4D6D]/30 hover:border-[#FF4D6D] text-start space-y-2 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🍎🍓🎈</span>
                  <span className="text-[11px] font-extrabold text-[#FF4D6D]">10 {language === 'ar' ? 'مراحل' : 'Stages'}</span>
                </div>
                <p className="font-extrabold text-sm text-[#27345C]">
                  {language === 'ar' ? 'رحلة اكتشاف اللون الأحمر' : 'Discover the Color Red'}
                </p>
                <p className="text-[11px] text-[#27345C]/70">
                  {language === 'ar' ? 'تلوين، فرز سلال، ذاكرة واختبار مستقل' : 'Coloring, basket sorting, memory & quiz'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDeepTarget({ type: 'arabic', letterId: 'ar-alif' })}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#8054D9]/15 to-white border-2 border-[#8054D9]/30 hover:border-[#8054D9] text-start space-y-2 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold text-[#8054D9]">أ</span>
                  <span className="text-[11px] font-extrabold text-[#8054D9]">11 {language === 'ar' ? 'مرحلة' : 'Stages'}</span>
                </div>
                <p className="font-extrabold text-sm text-[#27345C]">
                  {language === 'ar' ? 'رحلة اكتشاف حرف الألف — أ' : 'Arabic Letter Alif (أ) Journey'}
                </p>
                <p className="text-[11px] text-[#27345C]/70">
                  {language === 'ar' ? 'الأشكال الأربعة، كتابة، بناء كلمة وقراءة' : 'Forms, tracing, word building & reading'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDeepTarget({ type: 'english', letterId: currentEn.id })}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#39BDF2]/15 to-white border-2 border-[#39BDF2]/30 hover:border-[#39BDF2] text-start space-y-2 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold text-[#39BDF2]">{currentEn.upper}{currentEn.lower}</span>
                  <span className="text-[11px] font-extrabold text-[#39BDF2]">11 {language === 'ar' ? 'مرحلة' : 'Stages'}</span>
                </div>
                <p className="font-extrabold text-sm text-[#27345C]">
                  {language === 'ar' ? `رحلة الحرف الإنجليزي ${currentEn.upper}` : `Letter ${currentEn.upper} Full Journey`}
                </p>
                <p className="text-[11px] text-[#27345C]/70">
                  {language === 'ar' ? 'الاسم والصوت الصوتي، تتبع و CVC' : 'Name vs phonics, tracing & CVC words'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  const unit =
                    MATH_DEEP_UNITS.find((u) => isContentAppropriateForChild(u, activeChild)) ||
                    MATH_DEEP_UNITS[0];
                  setDeepTarget({ type: 'math', unitId: unit.id });
                }}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#FF9360]/15 to-white border-2 border-[#FF9360]/30 hover:border-[#FF9360] text-start space-y-2 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🧮</span>
                  <span className="text-[11px] font-extrabold text-[#FF9360]">6 {language === 'ar' ? 'مراحل' : 'Stages'}</span>
                </div>
                <p className="font-extrabold text-sm text-[#27345C]">
                  {language === 'ar' ? 'رحلة الرياضيات المناسبة لعمرك' : 'Age-Matched Math Unit'}
                </p>
                <p className="text-[11px] text-[#27345C]/70">
                  {language === 'ar' ? 'كميات حقيقية، عمليات ومسألة حياتية' : 'Real quantities, operations & word problem'}
                </p>
              </button>
            </div>
          </div>

          <div className="nono-card rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `رحلة ${activeChild.displayName} التعليمية المتنوعة اليوم`
                : `${activeChild.displayName}'s Daily Multi-Sensory Adventure`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Letter */}
              <button
                type="button"
                onClick={() => {
                  setArIndex(ARABIC_ALPHABET.findIndex((a) => a.id === dailyLetter.id));
                  setTab('arabic');
                }}
                className="p-4 rounded-2xl bg-[#F3E8FF] border border-[#8054D9]/25 text-start hover:scale-[1.02] transition-transform cursor-pointer"
              >
                <span className="text-xs font-extrabold text-[#8054D9]">
                  {language === 'ar' ? '١. حرف اليوم' : '1. Letter'}
                </span>
                <div className="text-3xl font-extrabold mt-2">{dailyLetter.char} · {dailyEn.upper}</div>
                <p className="text-xs font-bold text-[#27345C]/75 mt-1">
                  {dailyLetter.word} {dailyLetter.emoji}
                </p>
              </button>

              {/* 2. Number */}
              <button
                type="button"
                onClick={() => {
                  setSelectedNumber(dailyNumber);
                  setTab('numbers');
                }}
                className="p-4 rounded-2xl bg-[#FFF3D1] border border-[#FF9360]/30 text-start hover:scale-[1.02] transition-transform cursor-pointer"
              >
                <span className="text-xs font-extrabold text-[#FF9360]">
                  {language === 'ar' ? '٢. رقم اليوم' : '2. Number'}
                </span>
                <div className="text-3xl font-extrabold mt-2 font-mono-num">{dailyNumber}</div>
                <p className="text-xs font-bold text-[#27345C]/75 mt-1">
                  {language === 'ar' ? 'الكمية والعد التفاعلي' : 'Quantity & Counting'}
                </p>
              </button>

              {/* 3. Color & Shape */}
              <button
                type="button"
                onClick={() => {
                  setSelectedColorId(dailyColor.id);
                  setTab('colors-shapes');
                }}
                className="p-4 rounded-2xl bg-[#FFE6F2] border border-[#FF78B7]/30 text-start hover:scale-[1.02] transition-transform cursor-pointer"
              >
                <span className="text-xs font-extrabold text-[#FF78B7]">
                  {language === 'ar' ? '٣. لون وشكل' : '3. Color & Shape'}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-7 h-7 rounded-full border-2 border-white shadow" style={{ backgroundColor: dailyColor.hex }} />
                  <span className="text-lg font-extrabold">{t(dailyColor.name, language)}</span>
                </div>
                <p className="text-xs font-bold text-[#27345C]/75 mt-1">{dailyColor.emojis}</p>
              </button>

              {/* 4. Logic/Creative */}
              <button
                type="button"
                onClick={() => navigate('game', { worldId: 'intelligence-castle', activityId: 'act-maze-7' })}
                className="p-4 rounded-2xl bg-[#E5F6FF] border border-[#39BDF2]/30 text-start hover:scale-[1.02] transition-transform cursor-pointer"
              >
                <span className="text-xs font-extrabold text-[#39BDF2]">
                  {language === 'ar' ? '٤. تحدي الذكاء' : '4. Logic Quest'}
                </span>
                <div className="text-3xl mt-2">🧩</div>
                <p className="text-xs font-bold text-[#27345C]/75 mt-1">
                  {language === 'ar' ? 'متاهة الكنز والمنطق' : 'Maze & Pattern Play'}
                </p>
              </button>

              {/* 5. Real-World Discovery */}
              <div className="p-4 rounded-2xl bg-[#E2F9EC] border border-[#55D98B]/40 text-start flex flex-col justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold text-[#27345C]">
                    {language === 'ar' ? '٥. اكتشاف واقعي' : '5. Real-World'}
                  </span>
                  <p className="font-extrabold text-sm text-[#27345C] mt-2">{t(dailyOffline.title, language)}</p>
                  <p className="text-[11px] text-[#27345C]/75 mt-1 leading-snug">{t(dailyOffline.desc, language)}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    speakSlowOrNormal(
                      `${t(dailyOffline.title, language)}. ${t(dailyOffline.desc, language)}`,
                      language,
                      false,
                      t(dailyOffline.title, language),
                    )
                  }
                  className="self-start px-2.5 py-1 rounded-lg bg-white/90 border border-[#27345C]/15 text-[11px] font-extrabold text-[#27345C] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#55D98B]" />
                  <span>{language === 'ar' ? 'استمع' : 'Listen'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Adaptive Concept Revision Section */}
          <div className="nono-card rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#8054D9]" />
                <span>{language === 'ar' ? 'المفاهيم المتعلمة والمراجعة الذكية' : 'Concept Memory & Adaptive Revision'}</span>
              </h3>
              <span className="text-xs font-bold text-[#8054D9] font-mono-num">
                {formatNumber(conceptStats.total, language)} {language === 'ar' ? 'مفاهيم مسجلة' : 'concepts tracked'}
              </span>
            </div>

            {conceptStats.needsRevision.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {conceptStats.needsRevision.map((c) => (
                  <div key={c.conceptId} className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#FFD84D] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-[#27345C]">{t(c.label, language)}</p>
                      <p className="text-xs text-[#27345C]/65">
                        {language === 'ar' ? 'مراجعة لطيفة مقترحة' : 'Gentle revision recommended'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab(c.domain === 'arabic' ? 'arabic' : c.domain === 'english' ? 'english' : c.domain === 'numbers' ? 'numbers' : 'colors-shapes')}
                      className="px-3 py-1.5 rounded-xl bg-[#8054D9] text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'ar' ? 'راجع' : 'Review'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#27345C]/75">
                {language === 'ar'
                  ? 'ابدأ باستكشاف الحروف والأرقام والألوان بالأعلى وسيسجل النظام تقدمك تلقائياً!'
                  : 'Explore any letter, number, or color tab above — your multi-sensory mastery will build automatically!'}
              </p>
            )}
          </div>

          {/* Admin CMS Published Custom Lessons */}
          {cmsLessons.length > 0 && (
            <div className="nono-card rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#55D98B]" />
                <span>{language === 'ar' ? 'دروس إضافية من مناهج نونو لاند' : 'Additional Published Lessons'}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cmsLessons.map((ls) => (
                  <div
                    key={ls.id}
                    className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#8054D9] uppercase">
                          {ls.domain}
                        </span>
                        <h4 className="font-extrabold text-base text-[#27345C]">
                          {ls.targetSymbol ? `${ls.targetSymbol} · ` : ''}{t(ls.title, language)}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void academyAudio.speak(
                            `${t(ls.title, language)}. ${t(ls.summary, language)}`,
                            language,
                            {
                              audioUrl: ls.audioUrl,
                              label: t(ls.title, language),
                            },
                          );
                          recordConceptInteraction({
                            conceptId: `cms-${ls.id}`,
                            domain: ls.domain,
                            label: ls.title,
                            stage: 'exposed',
                            isCorrect: true,
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-[#8054D9]" />
                        <span>{language === 'ar' ? 'استمع' : 'Listen'}</span>
                      </button>
                    </div>
                    {ls.imageUrl && (
                      <img
                        src={ls.imageUrl}
                        alt={t(ls.title, language)}
                        className="w-full h-36 object-cover rounded-xl border border-[#27345C]/10"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <p className="text-xs text-[#27345C]/80 leading-relaxed">
                      {t(ls.summary, language)}
                    </p>
                    {ls.examples.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ls.examples.map((ex, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#27345C]/10 text-xs font-bold text-[#27345C]"
                          >
                            {ex.visual ? `${ex.visual} ` : ''}{t(ex.label, language)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================
          TAB 2: ARABIC ALPHABET (ALL 28 LETTERS)
      ========================================= */}
      {tab === 'arabic' && (
        <div className="space-y-5">
          {/* 28 Letter Selector */}
          <div className="nono-card rounded-3xl p-4 sm:p-5">
            <p className="text-xs font-bold text-[#27345C]/70 mb-3">
              {language === 'ar' ? 'اختر أي حرف من الحروف العربية الثمانية والعشرين:' : 'Select any of the 28 Arabic letters:'}
            </p>
            <div className="flex flex-wrap gap-2" dir="rtl">
              {ARABIC_ALPHABET.map((item, idx) => {
                const isSelected = idx === arIndex;
                const mastered = activeChild.conceptMastery?.[`ar-${item.id}`];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setArIndex(idx);
                      setArChallengeResult('none');
                      soundEngine.playPop();
                      speakSlowOrNormal(`${item.nameAr}، ${item.word}`, 'ar');
                      recordConceptInteraction({
                        conceptId: `ar-${item.id}`,
                        domain: 'arabic',
                        label: { ar: `حرف ${item.char} (${item.nameAr})`, en: `Arabic ${item.char} (${item.nameEn})` },
                        stage: 'exposed',
                        isCorrect: true,
                      });
                    }}
                    className={`w-11 h-11 rounded-xl font-extrabold text-lg border-2 cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-[#8054D9] text-white border-[#8054D9] scale-110 shadow'
                        : mastered
                          ? 'bg-[#55D98B]/20 text-[#27345C] border-[#55D98B]/50'
                          : 'bg-[#FFF8E9] text-[#27345C] border-[#27345C]/10 hover:border-[#8054D9]'
                    }`}
                  >
                    {item.char}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Sensory Arabic Letter Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* SEE + HEAR + FORMS */}
            <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#8054D9] to-[#FF78B7] text-white text-6xl font-extrabold flex items-center justify-center shadow-lg">
                    {currentAr.char}
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#27345C]">
                      {currentAr.nameAr} · {currentAr.nameEn}
                    </h2>
                    <p className="text-sm font-bold text-[#8054D9] mt-0.5">{t(currentAr.phoneticHint, language)}</p>
                    <p className="text-lg font-extrabold mt-1">
                      {currentAr.emoji} {currentAr.word} <span className="text-xs text-[#27345C]/65">({currentAr.wordMeaningEn})</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Audio Controls + 11-Stage Deep Journey Launch */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDeepTarget({ type: 'arabic', letterId: currentAr.id })}
                  className="nono-btn-tactile px-4 py-2.5 rounded-xl bg-[#FF9360] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {language === 'ar'
                      ? `ابدأ رحلة الـ١١ مرحلة الكاملة لحرف (${currentAr.char})`
                      : `Start 11-Stage Journey (${currentAr.char})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => speakSlowOrNormal(`${currentAr.nameAr}، ${currentAr.word}`, 'ar', false)}
                  className="px-4 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{language === 'ar' ? 'استمع للنطق' : 'Hear Pronunciation'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakSlowOrNormal(`${currentAr.nameAr}، ${currentAr.word}`, 'ar', true)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFD84D]/40 text-[#27345C] text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Ear className="w-4 h-4" />
                  <span>{language === 'ar' ? 'تشغيل بطيء وواضح' : 'Slow Replay'}</span>
                </button>
              </div>

              {/* Initial / Medial / Final / Isolated Forms */}
              <div className="space-y-2">
                <p className="text-xs font-extrabold text-[#27345C]/70">
                  {language === 'ar' ? 'أشكال الحرف حسب موقعه في الكلمة:' : 'Letter Forms by Word Position:'}
                </p>
                <div className="grid grid-cols-4 gap-2 text-center" dir="rtl">
                  {[
                    { k: 'isolated', label: { ar: 'منفصل', en: 'Isolated' }, val: currentAr.forms.isolated },
                    { k: 'initial', label: { ar: 'أول الكلمة', en: 'Initial' }, val: currentAr.forms.initial },
                    { k: 'medial', label: { ar: 'وسط الكلمة', en: 'Medial' }, val: currentAr.forms.medial },
                    { k: 'final', label: { ar: 'آخر الكلمة', en: 'Final' }, val: currentAr.forms.final },
                  ].map((f) => (
                    <div key={f.k} className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10">
                      <div className="text-2xl font-extrabold text-[#8054D9]">{f.val}</div>
                      <div className="text-[10px] font-bold text-[#27345C]/70 mt-1">{t(f.label, language)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distinguish Visually Similar Letters Mini-Challenge */}
              <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 space-y-3">
                <p className="text-sm font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? `تحدي التمييز: اضغط على حرف (${currentAr.nameAr}) بين الحروف المتشابهة!`
                    : `Spot the Letter: Tap ${currentAr.char} (${currentAr.nameEn}) among similar shapes!`}
                </p>
                <div className="flex gap-3">
                  {arDistractors.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        const ok = ch === currentAr.char;
                        if (ok) {
                          soundEngine.playSuccess();
                          setArChallengeResult('correct');
                          setNonoMood('celebrating');
                        } else {
                          soundEngine.playEncourage();
                          setArChallengeResult('retry');
                          setNonoMood('encouraging');
                        }
                        recordConceptInteraction({
                          conceptId: `ar-${currentAr.id}`,
                          domain: 'arabic',
                          label: { ar: `حرف ${currentAr.char}`, en: `Arabic ${currentAr.char}` },
                          stage: 'recognized',
                          isCorrect: ok,
                        });
                      }}
                      className="flex-1 h-14 rounded-2xl bg-white border-2 border-[#27345C]/12 hover:border-[#8054D9] text-2xl font-extrabold cursor-pointer"
                    >
                      {ch}
                    </button>
                  ))}
                </div>
                {arChallengeResult === 'correct' && (
                  <p className="text-xs font-extrabold text-[#55D98B] flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {language === 'ar' ? 'ممتاز! ميّزت الحرف بدقة!' : 'Great! You recognized the exact letter!'}
                  </p>
                )}
                {arChallengeResult === 'retry' && (
                  <p className="text-xs font-bold text-[#FF9360]">
                    {language === 'ar' ? 'انتبه لعدد النقاط ومكانها وجرب ثانية!' : 'Check the dots carefully and try again!'}
                  </p>
                )}
              </div>
            </div>

            {/* TRACE ARABIC LETTER */}
            <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-4">
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? `اكتب وتتبع حرف (${currentAr.char})` : `Trace Arabic Letter (${currentAr.char})`}
              </h3>
              <TracingPad
                guideChar={currentAr.char}
                language={language}
                hintText={t(currentAr.writingTip, language)}
                onCompleteTrace={() =>
                  recordConceptInteraction({
                    conceptId: `ar-${currentAr.id}`,
                    domain: 'arabic',
                    label: { ar: `حرف ${currentAr.char}`, en: `Arabic ${currentAr.char}` },
                    stage: 'recalled',
                    isCorrect: true,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          TAB 3: ENGLISH ALPHABET (A-Z)
      ========================================= */}
      {tab === 'english' && (
        <div className="space-y-5">
          <div className="nono-card rounded-3xl p-4 sm:p-5">
            <div className="flex flex-wrap gap-1.5" dir="ltr">
              {ENGLISH_ALPHABET.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEnIndex(idx);
                    setEnCaseMatchResult('none');
                    soundEngine.playPop();
                    speakSlowOrNormal(`${item.upper}. ${item.word}`, 'en');
                    recordConceptInteraction({
                      conceptId: item.id,
                      domain: 'english',
                      label: { ar: `حرف ${item.upper}`, en: `Letter ${item.upper}` },
                      stage: 'exposed',
                      isCorrect: true,
                    });
                  }}
                  className={`w-10 h-10 rounded-xl font-extrabold text-sm border-2 cursor-pointer transition-all ${
                    idx === enIndex
                      ? 'bg-[#39BDF2] text-white border-[#39BDF2] scale-110 shadow'
                      : 'bg-[#FFF8E9] text-[#27345C] border-[#27345C]/10 hover:border-[#39BDF2]'
                  }`}
                >
                  {item.upper}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-5">
              <div className="flex items-center gap-4" dir="ltr">
                <div className="px-5 h-24 rounded-3xl bg-gradient-to-br from-[#39BDF2] to-[#55D98B] text-white text-5xl font-extrabold flex items-center justify-center shadow-lg">
                  {currentEn.upper}{currentEn.lower}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#27345C]">
                    {currentEn.emoji} {currentEn.word}
                  </h2>
                  <p className="text-xs font-bold text-[#27345C]/70">
                    {language === 'ar' ? `المعنى: ${currentEn.wordAr}` : `CVC Practice: ${currentEn.cvcExample}`}
                  </p>
                  <p className="text-xs font-bold text-[#39BDF2] mt-1">
                    Name: "{currentEn.nameSound}" · Phonetic Sound: {currentEn.phoneticSound}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDeepTarget({ type: 'english', letterId: currentEn.id })}
                  className="nono-btn-tactile px-4 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {language === 'ar'
                      ? `رحلة الـ١١ مرحلة لحرف (${currentEn.upper})`
                      : `Start 11-Stage Journey (${currentEn.upper})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => speakSlowOrNormal(`${currentEn.upper}. ${currentEn.word}`, 'en', false)}
                  className="px-4 py-2.5 rounded-xl bg-[#39BDF2] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{language === 'ar' ? 'استمع بالصوت الإنجليزي' : 'Hear Letter & Word'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => speakSlowOrNormal(`${currentEn.upper}. ${currentEn.word}`, 'en', true)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFD84D]/40 text-[#27345C] text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Ear className="w-4 h-4" />
                  <span>{language === 'ar' ? 'نطق بطيء' : 'Slow Replay'}</span>
                </button>
              </div>

              {/* Uppercase to Lowercase Matching */}
              <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 space-y-3">
                <p className="text-sm font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? `اختر الحرف الصغير (Lowercase) المطابق للحرف (${currentEn.upper}):`
                    : `Match uppercase "${currentEn.upper}" to its lowercase twin:`}
                </p>
                <div className="flex gap-3" dir="ltr">
                  {enLowerOptions.map((lw) => (
                    <button
                      key={lw}
                      type="button"
                      onClick={() => {
                        const ok = lw === currentEn.lower;
                        if (ok) {
                          soundEngine.playSuccess();
                          setEnCaseMatchResult('correct');
                          setNonoMood('celebrating');
                        } else {
                          soundEngine.playEncourage();
                          setEnCaseMatchResult('retry');
                          setNonoMood('encouraging');
                        }
                        recordConceptInteraction({
                          conceptId: currentEn.id,
                          domain: 'english',
                          label: { ar: `حرف ${currentEn.upper}`, en: `Letter ${currentEn.upper}` },
                          stage: 'recognized',
                          isCorrect: ok,
                        });
                      }}
                      className="flex-1 h-14 rounded-2xl bg-white border-2 border-[#27345C]/12 hover:border-[#39BDF2] text-2xl font-extrabold cursor-pointer"
                    >
                      {lw}
                    </button>
                  ))}
                </div>
                {enCaseMatchResult === 'correct' && (
                  <p className="text-xs font-extrabold text-[#55D98B]">
                    {language === 'ar' ? 'صحيح! طابقت الحرف الكبير والصغير!' : 'Correct! Uppercase & lowercase matched!'}
                  </p>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-4">
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? `تتبع وكتابة (${currentEn.upper} ${currentEn.lower})` : `Trace ${currentEn.upper} & ${currentEn.lower}`}
              </h3>
              <TracingPad
                guideChar={`${currentEn.upper} ${currentEn.lower}`}
                strokeColor="#39BDF2"
                language={language}
                onCompleteTrace={() =>
                  recordConceptInteraction({
                    conceptId: currentEn.id,
                    domain: 'english',
                    label: { ar: `حرف ${currentEn.upper}`, en: `Letter ${currentEn.upper}` },
                    stage: 'recalled',
                    isCorrect: true,
                  })
                }
              />
            </div>
          </div>

          {/* Interactive CVC Word Builder */}
          <div className="nono-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'بناء كلمات إنجليزية بسيطة (CVC)' : 'Interactive CVC Word Builder'}
                </h3>
                <p className="text-xs text-[#27345C]/70">
                  {language === 'ar'
                    ? 'اضغط على الحروف بالترتيب لتكوين الكلمة المطابقة للصورة!'
                    : 'Tap the letters in order to build the word matching the picture!'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCvcIdx((cvcIdx + 1) % cvcTargets.length);
                  setCvcBuilt('');
                }}
                className="px-3.5 py-2 rounded-xl bg-[#FFF8E9] border border-[#27345C]/12 text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'كلمة تالية' : 'Next Word'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5" dir="ltr">
              <div className="w-24 h-24 rounded-3xl bg-[#E5F6FF] flex items-center justify-center text-5xl">
                {currentCvc.emoji}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((pos) => (
                    <div
                      key={pos}
                      className="w-14 h-14 rounded-2xl bg-[#FFF8E9] border-2 border-dashed border-[#39BDF2] flex items-center justify-center text-2xl font-extrabold text-[#27345C]"
                    >
                      {cvcBuilt[pos] || '_'}
                    </div>
                  ))}
                  {cvcBuilt && (
                    <button
                      type="button"
                      onClick={() => setCvcBuilt('')}
                      className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold cursor-pointer"
                    >
                      ↺
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentCvc.letters.map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => {
                        if (cvcBuilt.length >= 3) return;
                        const next = cvcBuilt + lt;
                        setCvcBuilt(next);
                        soundEngine.playPop();
                        if (next === currentCvc.word) {
                          soundEngine.playSuccess();
                          speakSlowOrNormal(currentCvc.word, 'en');
                          recordConceptInteraction({
                            conceptId: `cvc-${currentCvc.word}`,
                            domain: 'english',
                            label: { ar: `كلمة ${currentCvc.word}`, en: `Word ${currentCvc.word}` },
                            stage: 'applied',
                            isCorrect: true,
                          });
                        }
                      }}
                      className="w-12 h-12 rounded-2xl bg-white border-2 border-[#27345C]/15 hover:border-[#39BDF2] font-extrabold text-xl cursor-pointer"
                    >
                      {lt}
                    </button>
                  ))}
                </div>
                {cvcBuilt === currentCvc.word && (
                  <p className="text-xs font-extrabold text-[#55D98B]">
                    ✓ {currentCvc.word}! Great reading!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          TAB 4: NUMBERS & MATHEMATICS ACADEMY
      ========================================= */}
      {tab === 'numbers' && (
        <div className="space-y-5">
          {/* Deep Multi-Stage Math Units tailored by Age */}
          <div className="nono-card rounded-3xl p-5 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-[#27345C]">
                {language === 'ar' ? 'وحدات الرياضيات العميقة (٦ مراحل لكل وحدة)' : 'Deep Interactive Math Units (6 Stages Each)'}
              </h2>
              <button
                type="button"
                onClick={() => navigate('exams')}
                className="px-3.5 py-2 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'امتحان الرياضيات (٤٠ سؤالاً)' : 'Math Official Exam'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {MATH_DEEP_UNITS.filter((u) =>
                isContentAppropriateForChild(u, activeChild),
              ).map((unit) => {
                const ageMatch = isContentAppropriateForChild(unit, activeChild);
                const done = (activeChild.completedDeepLessons || []).includes(unit.id);
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => setDeepTarget({ type: 'math', unitId: unit.id })}
                    className={`p-4 rounded-2xl border-2 text-start space-y-1.5 cursor-pointer transition-all ${
                      ageMatch
                        ? 'bg-[#FFF3D1]/60 border-[#FF9360]/50 hover:border-[#FF9360]'
                        : 'bg-white border-[#27345C]/12 hover:border-[#8054D9]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{unit.emoji}</span>
                      <span className="text-[11px] font-extrabold text-[#FF9360]">
                        {done
                          ? language === 'ar'
                            ? 'مكتمل ✓'
                            : 'Completed ✓'
                          : ageMatch
                            ? language === 'ar'
                              ? 'موصى لعمرك'
                              : 'For Your Age'
                            : language === 'ar'
                              ? '٦ مراحل'
                              : '6 Stages'}
                      </span>
                    </div>
                    <p className="font-extrabold text-sm text-[#27345C] leading-snug">
                      {t(unit.title, language)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier Switcher */}
          <div className="flex flex-wrap gap-2">
            {NUMBER_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => {
                  setNumTierId(tier.id);
                  setSelectedNumber(tier.numbers[0]);
                  soundEngine.playPop();
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 cursor-pointer ${
                  numTierId === tier.id
                    ? 'bg-[#FF9360] text-white border-[#FF9360]'
                    : 'bg-white text-[#27345C] border-[#27345C]/12'
                }`}
              >
                {t(tier.label, language)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Quantity Representation + Number Picker */}
            <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                {currentTier.numbers.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setSelectedNumber(num);
                      soundEngine.playPop();
                      speakSlowOrNormal(String(num), language);
                      recordConceptInteraction({
                        conceptId: `num-${num}`,
                        domain: 'numbers',
                        label: { ar: `العدد ${num}`, en: `Number ${num}` },
                        stage: 'exposed',
                        isCorrect: true,
                      });
                    }}
                    className={`min-w-[48px] px-3 h-11 rounded-xl font-mono-num font-extrabold border-2 cursor-pointer ${
                      selectedNumber === num
                        ? 'bg-[#FF9360] text-white border-[#FF9360] scale-105'
                        : 'bg-[#FFF8E9] text-[#27345C] border-[#27345C]/10'
                    }`}
                  >
                    {formatNumber(num, language)}
                  </button>
                ))}
              </div>

              {/* Quantity Visualization (NEVER teach symbol without quantity!) */}
              <div className="rounded-3xl bg-[#FFF8E9] p-5 border border-[#27345C]/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-extrabold text-[#FF9360] font-mono-num">
                    {formatNumber(selectedNumber, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakSlowOrNormal(String(selectedNumber), language, true)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-[#FF9360]" />
                    <span>{language === 'ar' ? 'استمع للعدد' : 'Hear Number'}</span>
                  </button>
                </div>

                <p className="text-xs font-bold text-[#27345C]/70">
                  {language === 'ar'
                    ? `ماذا يمثل العدد ${formatNumber(selectedNumber, language)}؟ (${Math.floor(selectedNumber / 10)} عشرات و ${selectedNumber % 10} آحاد):`
                    : `Visual Quantity (${Math.floor(selectedNumber / 10)} tens + ${selectedNumber % 10} ones):`}
                </p>

                {/* Tens bundles + single units */}
                <div className="flex flex-wrap gap-2 items-center">
                  {Array.from({ length: Math.floor(selectedNumber / 10) }).map((_, i) => (
                    <div
                      key={`ten-${i}`}
                      className="px-2.5 py-1.5 rounded-xl bg-[#FFD84D]/50 border border-[#FF9360] text-xs font-extrabold text-[#27345C]"
                    >
                      🧺 10
                    </div>
                  ))}
                  {Array.from({ length: selectedNumber % 10 }).map((_, i) => (
                    <span key={`one-${i}`} className="text-2xl">
                      🍎
                    </span>
                  ))}
                </div>
              </div>

              {/* Greater / Less / Equal Comparison Mini-Lab */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#27345C]/10 space-y-3">
                <p className="text-sm font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'مقارنة الكميات (أكبر، أصغر، يساوي):' : 'Compare Quantities (<, =, >):'}
                </p>
                <div className="flex items-center justify-center gap-4 text-2xl font-extrabold font-mono-num" dir="ltr">
                  <div className="px-4 py-2 rounded-2xl bg-[#E5F6FF]">{compareLeft}</div>
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#8054D9] flex items-center justify-center text-[#8054D9]">?</div>
                  <div className="px-4 py-2 rounded-2xl bg-[#FFE6F2]">{compareRight}</div>
                </div>
                <div className="flex justify-center gap-3" dir="ltr">
                  {(['<', '=', '>'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => handleCompareChoice(op)}
                      className="nono-btn-tactile w-14 h-12 rounded-2xl bg-[#8054D9] text-white text-xl font-extrabold cursor-pointer"
                    >
                      {op}
                    </button>
                  ))}
                </div>
                {compareFeedback && (
                  <p className="text-center text-xs font-extrabold text-[#8054D9]">{compareFeedback}</p>
                )}
              </div>
            </div>

            {/* Trace Number */}
            <div className="lg:col-span-5 nono-card rounded-3xl p-6 space-y-4">
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {language === 'ar' ? `تتبع كتابة العدد (${formatNumber(selectedNumber, language)})` : `Trace Number ${selectedNumber}`}
              </h3>
              <TracingPad
                guideChar={String(selectedNumber)}
                strokeColor="#FF9360"
                language={language}
                onCompleteTrace={() =>
                  recordConceptInteraction({
                    conceptId: `num-${selectedNumber}`,
                    domain: 'numbers',
                    label: { ar: `العدد ${selectedNumber}`, en: `Number ${selectedNumber}` },
                    stage: 'recalled',
                    isCorrect: true,
                  })
                }
              />
            </div>
          </div>

          {/* Visual Math Play: Gentle Counting & Sharing for Ages 1-4 */}
          <div className="nono-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'سلة العد والجمع البسيط (١–٥)' : 'Little Explorers Basket Counting (1–5)'}
                </h3>
                <span className="text-xs font-extrabold text-[#8054D9]">
                  {language === 'ar' ? 'عدّ وأضف واحدة تلو الأخرى' : 'Count & add apples step by step'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm font-bold" dir="ltr">
                <label className="flex items-center gap-2">
                  <span>{language === 'ar' ? 'السلة الأولى:' : 'Basket 1:'}</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={Math.min(5, groupRows)}
                    onChange={(e) => setGroupRows(Number(e.target.value))}
                    className="accent-[#8054D9]"
                  />
                  <span className="font-mono-num">{Math.min(5, groupRows)}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span>{language === 'ar' ? 'السلة الثانية:' : 'Basket 2:'}</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={Math.min(5, groupCols)}
                    onChange={(e) => setGroupCols(Number(e.target.value))}
                    className="accent-[#FF9360]"
                  />
                  <span className="font-mono-num">{Math.min(5, groupCols)}</span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-[#FFF8E9]">
                <div className="flex gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#27345C]/10">
                  {Array.from({ length: Math.min(5, groupRows) }).map((_, idx) => (
                    <span key={idx} className="text-2xl">🍎</span>
                  ))}
                </div>
                <span className="text-xl font-extrabold text-[#8054D9]">+</span>
                <div className="flex gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#27345C]/10">
                  {Array.from({ length: Math.min(5, groupCols) }).map((_, idx) => (
                    <span key={idx} className="text-2xl">🍐</span>
                  ))}
                </div>
                <span className="text-xl font-extrabold text-[#27345C]">=</span>
                <span className="px-4 py-2 rounded-xl bg-[#55D98B]/25 font-extrabold text-xl text-[#27345C] font-mono-num">
                  {formatNumber(Math.min(5, groupRows) + Math.min(5, groupCols), language)}
                </span>
              </div>
            </div>
        </div>
      )}

      {/* =========================================
          TAB 5: COLORS, SHAPES & COLOR MIXING LAB
      ========================================= */}
      {tab === 'colors-shapes' && (
        <div className="space-y-6">
          {/* Interactive Color Mixing Laboratory */}
          <div className="nono-card rounded-3xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-[#27345C] flex items-center gap-2">
                  <FlaskConical className="w-6 h-6 text-[#8054D9]" />
                  <span>{language === 'ar' ? 'مختبر مزج الألوان التفاعلي' : 'Interactive Color Mixing Laboratory'}</span>
                </h2>
                <p className="text-sm text-[#27345C]/75">
                  {language === 'ar'
                    ? 'اختر لونين من الأنابيب وشاهد اللون السحري الناتج عن دمجهما!'
                    : 'Pick two colors to pour together and discover what new color appears!'}
                </p>
              </div>
              <Beaker className="w-8 h-8 text-[#FF78B7]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-4 space-y-2">
                <p className="text-xs font-extrabold text-[#27345C]/70">
                  {language === 'ar' ? 'اللون الأول:' : 'First Color:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACADEMY_COLORS.filter((c) => ['red', 'blue', 'yellow', 'white'].includes(c.id)).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setMixA(c.id);
                      }}
                      className={`px-3 py-2 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        mixA === c.id ? 'border-[#27345C] bg-[#FFF8E9]' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.hex }} />
                      <span>{t(c.name, language)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-4 space-y-2">
                <p className="text-xs font-extrabold text-[#27345C]/70">
                  {language === 'ar' ? 'اللون الثاني:' : 'Second Color:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACADEMY_COLORS.filter((c) => ['red', 'blue', 'yellow', 'white'].includes(c.id)).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playPop();
                        setMixB(c.id);
                      }}
                      className={`px-3 py-2 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        mixB === c.id ? 'border-[#27345C] bg-[#FFF8E9]' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.hex }} />
                      <span>{t(c.name, language)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resulting Mixed Potion */}
              <motion.div
                key={`${mixA}-${mixB}`}
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                className="md:col-span-4 rounded-3xl p-5 bg-[#FFF8E9] border-2 border-[#27345C]/12 text-center space-y-2"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="w-7 h-7 rounded-full border-2 border-white shadow" style={{ backgroundColor: colorObjA.hex }} />
                  <span className="font-extrabold">+</span>
                  <span className="w-7 h-7 rounded-full border-2 border-white shadow" style={{ backgroundColor: colorObjB.hex }} />
                  <span className="font-extrabold">=</span>
                  <span
                    className="w-12 h-12 rounded-full border-4 border-white shadow-lg"
                    style={{ backgroundColor: mixRecipe ? mixRecipe.resultHex : colorObjA.hex }}
                  />
                </div>
                <p className="font-extrabold text-base text-[#27345C]">
                  {mixRecipe
                    ? t(mixRecipe.resultName, language)
                    : t(colorObjA.name, language)}
                </p>
                <p className="text-xs text-[#27345C]/75">
                  {mixRecipe
                    ? t(mixRecipe.explanation, language)
                    : language === 'ar'
                      ? 'جرّب دمج لونين مختلفين (مثل الأحمر والأصفر أو الأزرق والأصفر)!'
                      : 'Try combining two different colors (like Red + Yellow or Blue + Yellow)!'}
                </p>
                {mixRecipe && (
                  <button
                    type="button"
                    onClick={() =>
                      speakSlowOrNormal(
                        t(mixRecipe.explanation, language),
                        language,
                        false,
                        t(mixRecipe.resultName, language),
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold text-[#8054D9] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'اسمع النتيجة' : 'Hear Result'}</span>
                  </button>
                )}
              </motion.div>
            </div>
          </div>

          {/* Colors Real-World Gallery + Shapes Explorer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="nono-card rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'الألوان في عالمنا اليومي' : 'Colors in Everyday Life'}
                </h3>
                <button
                  type="button"
                  onClick={() => setDeepTarget({ type: 'color', colorId: selectedColorId })}
                  className="nono-btn-tactile px-4 py-2 rounded-xl bg-[#FF4D6D] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>
                    {language === 'ar'
                      ? `ابدأ رحلة الـ١٠ مراحل للون (${t(ACADEMY_COLORS.find((c) => c.id === selectedColorId)?.name || ACADEMY_COLORS[0].name, language)})`
                      : `Start 10-Stage Journey (${t(ACADEMY_COLORS.find((c) => c.id === selectedColorId)?.name || ACADEMY_COLORS[0].name, language)})`}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ACADEMY_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      setSelectedColorId(col.id);
                      soundEngine.playPop();
                      speakSlowOrNormal(`${t(col.name, language)}`, language);
                      recordConceptInteraction({
                        conceptId: `color-${col.id}`,
                        domain: 'colors-shapes',
                        label: col.name,
                        stage: 'recognized',
                        isCorrect: true,
                      });
                    }}
                    className={`p-3 rounded-2xl border-2 text-center cursor-pointer transition-transform ${
                      selectedColorId === col.id ? 'border-[#27345C] scale-105 bg-white shadow' : 'border-slate-100 bg-[#FFF8E9]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full mx-auto border-2 border-white shadow" style={{ backgroundColor: col.hex }} />
                    <p className="text-xs font-extrabold mt-2">{t(col.name, language)}</p>
                    <p className="text-sm mt-0.5">{col.emojis}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="nono-card rounded-3xl p-6 space-y-4">
              <h3 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
                <Shapes className="w-5 h-5 text-[#39BDF2]" />
                <span>{language === 'ar' ? 'الأشكال الهندسية وأمثلتها' : 'Geometric Shapes & Real Examples'}</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ACADEMY_SHAPES.map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      speakSlowOrNormal(t(sh.name, language), language);
                      recordConceptInteraction({
                        conceptId: `shape-${sh.id}`,
                        domain: 'colors-shapes',
                        label: sh.name,
                        stage: 'recognized',
                        isCorrect: true,
                      });
                    }}
                    className="p-3.5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 hover:border-[#39BDF2] text-center cursor-pointer"
                  >
                    <div className="text-3xl">{sh.emoji}</div>
                    <p className="font-extrabold text-sm text-[#27345C] mt-1">{t(sh.name, language)}</p>
                    <p className="text-[11px] text-[#27345C]/65 mt-0.5">{t(sh.realWorld, language)}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
