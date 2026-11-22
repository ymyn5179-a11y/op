import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Brain,
  Brush,
  ClipboardCheck,
  Compass,
  FileText,
  Flame,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  Palette,
  PawPrint,
  Play,
  ShoppingBag,
  Sparkles,
  Star,
  Volume2,
} from 'lucide-react';
import storyForestImg from '../assets/images/story_enchanted_forest_1794739849090.jpg';
import { ChildAvatarPreview } from '../components/CharacterCast';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { GAME_ACTIVITIES, getActivityById } from '../data/activities';
import { DEFAULT_AVATAR_CONFIG } from '../data/worldCatalog';
import { getWorldById, LEARNING_WORLDS } from '../data/worlds';
import { getAdaptiveRecommendation } from '../engine/adaptiveEngine';
import { calculateStreakDays, getTodayDayKey } from '../engine/monthlyReportEngine';
import { formatNumber, getAgeGroupMeta, t, UI_COPY } from '../i18n/translations';
import { NonoMood } from '../types/nonoland';
import {
  getInternalAgeBand,
  isContentAppropriateForChild,
} from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';

export const HomeScreen: React.FC = () => {
  const { activeChild, authSession, language, navigate, claimDailyMission } = useNonoLand();
  const [nonoMood, setNonoMood] = useState<NonoMood>('waving');
  const [hwCounts, setHwCounts] = useState<{ active: number; completed: number }>({ active: 0, completed: 0 });
  const [exCounts, setExCounts] = useState<{ active: number; completed: number }>({ active: 0, completed: 0 });
  const [missionFeedback, setMissionFeedback] = useState<string>('');

  useEffect(() => {
    if (!authSession.authenticated || !activeChild || (authSession.user?.role !== 'student' && authSession.user?.role !== 'parent')) {
      return;
    }
    const q = authSession.user.role === 'student' ? '' : `?childId=${encodeURIComponent(activeChild.id)}`;
    fetch(`/api/student/homework${q}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setHwCounts({
            active: (d.newAssignments?.length || 0) + (d.inProgress?.length || 0) + (d.overdue?.length || 0),
            completed: (d.submitted?.length || 0) + (d.completed?.length || 0),
          });
        }
      })
      .catch(() => {});
    fetch(`/api/student/exams${q}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setExCounts({
            active: (d.available?.length || 0) + (d.inProgress?.length || 0),
            completed: d.completed?.length || 0,
          });
        }
      })
      .catch(() => {});
  }, [authSession.authenticated, authSession.user?.role, activeChild]);

  if (!activeChild) return null;

  const recommendation = getAdaptiveRecommendation(activeChild);
  const recWorld = getWorldById(recommendation.worldId);
  const recentActivity = activeChild.recentActivityId
    ? getActivityById(activeChild.recentActivityId)
    : undefined;
  const ageMeta = getAgeGroupMeta(activeChild.ageGroup);
  const internalBand = getInternalAgeBand(activeChild);
  const ageActivities = GAME_ACTIVITIES.filter((a) =>
    isContentAppropriateForChild(
      { ageGroups: a.ageEligibility, recommendedAgeRange: a.recommendedAgeRange },
      activeChild,
    ),
  );
  const l1Done = Object.values(activeChild.level1Progress || {}).filter((p) => p.status === 'demonstrated').length;
  const totalLessonsDone = l1Done;
  const journeyPct = Math.min(100, Math.round((totalLessonsDone / 75) * 100));
  const streakDays = activeChild.learningStreakDays ?? calculateStreakDays(activeChild.activeDaysHistory);
  const revisionCount =
    Object.values(activeChild.level1Progress || {}).filter((p) => p.status === 'needs-revision').length;

  // Verified Daily Missions matching backend prerequisites
  const todayKey = getTodayDayKey();
  const claimedToday =
    activeChild.claimedMissionsDate === todayKey ? activeChild.claimedMissionIdsToday || [] : [];

  const hasArabic =
    Object.values(activeChild.level1Progress || {}).some((p) => p.subject === 'arabic') ||
    activeChild.attempts.some((a) => a.worldId === 'arabic-letters');
  const hasMath =
    Object.values(activeChild.level1Progress || {}).some((p) => p.subject === 'numbers') ||
    activeChild.attempts.some((a) => a.worldId === 'numbers-kingdom');
  const hasMemory = activeChild.attempts.some(
    (a) => a.skillId === 'memory-focus' || a.worldId === 'intelligence-castle',
  );
  const hasStory = (activeChild.completedStoryIds || []).length > 0;
  const hasCreativeOrLab =
    (activeChild.completedLabIds || []).length > 0 || (activeChild.creativeProjects || []).length > 0;

  const verifiedMissions = [
    {
      id: 'dm-arabic',
      icon: '🔤',
      title: { ar: 'مهمة الحروف العربية', en: 'Arabic Letters Quest' },
      desc: { ar: 'استكشف درساً في العربية ثم اجمع النجوم', en: 'Explore one Arabic activity or lesson' },
      ready: hasArabic,
      targetScreen: 'academy' as const,
    },
    {
      id: 'dm-memory',
      icon: '🧠',
      title: { ar: 'تحدي الذاكرة والتركيز', en: 'Memory & Focus Game' },
      desc: { ar: 'العب لعبة ذاكرة في ألعاب الذكاء', en: 'Play a quick Brain Games challenge' },
      ready: hasMemory,
      targetScreen: 'brain-games' as const,
    },
    {
      id: 'dm-story',
      icon: '📖',
      title: { ar: 'قصة قبل المنام أو المغامرة', en: 'Listen to a Story' },
      desc: { ar: 'أكمل قصة تفاعلية في عالم القصص', en: 'Finish a story in Story World' },
      ready: hasStory,
      targetScreen: 'stories' as const,
    },
    {
      id: 'dm-math',
      icon: '🔢',
      title: { ar: 'لغز الأرقام الذكي', en: 'Numbers & Math Mission' },
      desc: { ar: 'مارس نشاطاً في مملكة الأرقام', en: 'Practice Numbers Kingdom or Academy Math' },
      ready: hasMath,
      targetScreen: 'academy' as const,
    },
    {
      id: 'dm-creative',
      icon: '🔬',
      title: { ar: 'تجربة مختبر أو لوحة إبداعية', en: 'Lab Experiment or Art' },
      desc: { ar: 'أجرِ تجربة في مختبر نونو أو ارسم لوحة', en: 'Run a science sim or save artwork' },
      ready: hasCreativeOrLab,
      targetScreen: 'discovery-lab' as const,
    },
  ];

  // Personalized Nono greeting remembering favorite world & recent adventure
  const favWorld = activeChild.favoriteWorldId ? getWorldById(activeChild.favoriteWorldId) : null;
  const nonoGreeting = (() => {
    if (internalBand === '1-2') {
      return language === 'ar'
        ? `أهلاً يا ${activeChild.displayName}! اضغط على بالونة أو حيوان لنلعب ونستمع للأصوات معاً!`
        : `Hi ${activeChild.displayName}! Tap any big picture to play and hear joyful sounds!`;
    }
    if (internalBand === '2-3') {
      return language === 'ar'
        ? `مرحباً يا ${activeChild.displayName}! ${favWorld ? `أعلم أنك تحب ${favWorld.name.ar}، ` : ''}هل نطابق الألوان والأشكال والكلمات اليوم؟`
        : `Welcome back, ${activeChild.displayName}! ${favWorld ? `I remember you enjoy ${favWorld.name.en}! ` : ''}Ready to match colors, shapes & words?`;
    }
    return language === 'ar'
      ? `أهلاً بالمستكشف الصغير ${activeChild.displayName}! هيا نكتشف الحروف والأرقام والقصص التفاعلية!`
      : `Welcome, Little Explorer ${activeChild.displayName}! Ready for letters, numbers, patterns & stories?`;
  })();

  const handleNonoTap = () => {
    const moods: NonoMood[] = ['excited', 'jumping', 'dancing', 'waving'];
    setNonoMood(moods[Math.floor(Math.random() * moods.length)]);
    soundEngine.speak(nonoGreeting, language);
  };

  return (
    <div className="space-y-7">
      {/* HERO STAGE: Personalized Magical Welcome + Nono Companion */}
      <section className="relative rounded-[2rem] overflow-hidden border-2 border-[#27345C]/10 shadow-lg bg-gradient-to-br from-[#8054D9] via-[#6645C9] to-[#39BDF2] text-white p-6 sm:p-8">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img
            src={storyForestImg}
            alt=""
            decoding="async"
            className="w-full h-full object-cover mix-blend-overlay"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-bold text-[#FFD84D]">
              <NonoLandLogo variant="badge" size="xs" tone="dark" language={language} />
              <span>{t(ageMeta.badgeTitle, language)}</span>
              <span aria-hidden="true">·</span>
              <span>{t(ageMeta.label, language)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t(UI_COPY.home.levelLabel, language)} {formatNumber(activeChild.level, language)}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-balance">
              {language === 'ar'
                ? `مرحباً يا ${activeChild.displayName} في عالمك السحري!`
                : `Welcome to your world, ${activeChild.displayName}!`}
            </h1>

            <p className="text-white/90 text-base sm:text-lg max-w-2xl leading-relaxed">
              {nonoGreeting}
            </p>

            {/* Primary Hero Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  navigate('game', {
                    worldId: recommendation.worldId,
                    activityId: recommendation.activity.id,
                  })
                }
                className="nono-btn-tactile h-14 px-6 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-base flex items-center gap-2.5 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-[#27345C]" />
                <span>
                  {recentActivity
                    ? t(UI_COPY.home.continueAdventure, language)
                    : t(UI_COPY.startAdventure, language)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('map')}
                className="h-14 px-5 rounded-2xl bg-white/18 hover:bg-white/28 border border-white/30 text-white font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Compass className="w-5 h-5 text-[#FFD84D]" />
                <span>{t(UI_COPY.home.exploreWorlds, language)}</span>
              </button>

              <button
                type="button"
                onClick={() => soundEngine.speak(nonoGreeting, language)}
                className="h-14 px-4 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Volume2 className="w-5 h-5" />
                <span className="hidden sm:inline">{t(UI_COPY.home.listenToNono, language)}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-center justify-center">
            <NonoCharacter
              mood={nonoMood}
              scarfColor={activeChild.companionScarfColor}
              size="lg"
              language={language}
              onTap={handleNonoTap}
            />
            <span className="mt-2 text-xs font-bold text-white/85">
              {language === 'ar' ? 'اضغط على نونو للتفاعل!' : 'Tap Nono to say hello!'}
            </span>
          </div>
        </div>
      </section>

      {/* STUDENT DASHBOARD STRIP: LEARNING JOURNEY BAR + HOMEWORK + EXAMS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 nono-card rounded-3xl p-5 bg-white space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'شريط رحلتي التعليمية' : 'My Learning Journey'}
            </h2>
            <span className="text-xs font-extrabold text-[#8054D9] tabular-nums">
              {formatNumber(totalLessonsDone, language)} / {formatNumber(75, language)}{' '}
              {language === 'ar' ? 'درساً' : 'lessons'} ({journeyPct}%)
            </span>
          </div>
          <div className="h-3.5 rounded-full bg-[#FFF8E9] border border-[#27345C]/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8054D9] to-[#55D98B] transition-all"
              style={{ width: `${Math.max(4, journeyPct)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#27345C]/75">
            <span>
              {language === 'ar'
                ? `المسار التأسيسي (١–٤ سنوات): ${formatNumber(l1Done, language)}/٧٥`
                : `Foundations (Ages 1–4): ${l1Done}/75`}
            </span>
            <button
              type="button"
              onClick={() => navigate('academy')}
              className="min-h-[44px] px-4 rounded-xl bg-[#8054D9]/12 text-[#8054D9] font-extrabold cursor-pointer hover:bg-[#8054D9]/20"
            >
              {language === 'ar' ? 'استكمال الدروس' : 'Continue Lessons'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('homework')}
          className="lg:col-span-3 nono-card rounded-3xl p-5 text-start bg-gradient-to-br from-[#E5F6FF] to-white border-2 border-[#39BDF2]/25 hover:border-[#39BDF2] transition-all cursor-pointer flex flex-col justify-between min-h-[120px]"
        >
          <div className="flex items-center justify-between">
            <FileText className="w-6 h-6 text-[#39BDF2]" />
            <span className="px-2.5 py-0.5 rounded-lg bg-[#39BDF2]/15 text-[#0369A1] text-xs font-extrabold tabular-nums">
              {hwCounts.active} {language === 'ar' ? 'جديد' : 'Due'}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="font-extrabold text-base text-[#27345C]">
              {language === 'ar' ? 'واجباتي المدرسية' : 'My Homework'}
            </h3>
            <p className="text-xs font-bold text-[#27345C]/65 mt-0.5">
              {language === 'ar' ? `${hwCounts.completed} مكتمل` : `${hwCounts.completed} completed`}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('exams')}
          className="lg:col-span-3 nono-card rounded-3xl p-5 text-start bg-gradient-to-br from-[#FFF8E9] to-white border-2 border-[#FFD84D]/50 hover:border-[#FF9360] transition-all cursor-pointer flex flex-col justify-between min-h-[120px]"
        >
          <div className="flex items-center justify-between">
            <ClipboardCheck className="w-6 h-6 text-[#FF9360]" />
            <span className="px-2.5 py-0.5 rounded-lg bg-[#FFD84D]/40 text-[#78350F] text-xs font-extrabold tabular-nums">
              {exCounts.active} {language === 'ar' ? 'متاح' : 'Open'}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="font-extrabold text-base text-[#27345C]">
              {language === 'ar' ? 'امتحاناتي' : 'My Exams'}
            </h3>
            <p className="text-xs font-bold text-[#27345C]/65 mt-0.5">
              {language === 'ar' ? `${exCounts.completed} منجز` : `${exCounts.completed} taken`}
            </p>
          </div>
        </button>
      </section>

      {/* SMART LEARNING PATH: Transparent Adaptive Reasoning */}
      <section className="nono-card rounded-3xl p-5 bg-gradient-to-r from-[#FFF8E9] via-white to-[#E5F6FF] border-2 border-[#8054D9]/18 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-[#8054D9]">
            <Sparkles className="w-4 h-4" />
            <span>{language === 'ar' ? 'مسار التعلم الذكي المخصص لك' : 'Your Smart Learning Path'}</span>
            {streakDays > 0 && (
              <span className="inline-flex items-center gap-1 text-[#D97706]">
                <Flame className="w-3.5 h-3.5" />
                {formatNumber(streakDays, language)} {language === 'ar' ? 'أيام متواصلة' : 'day streak'}
              </span>
            )}
          </div>
          <p className="font-extrabold text-base sm:text-lg text-[#27345C]">
            {revisionCount > 0
              ? language === 'ar'
                ? `ننصح بمراجعة لطيفة لـ ${formatNumber(revisionCount, language)} مفهوم ثم تجربة نشاط ${t(recommendation.activity.title, language)}.`
                : `Gentle review ready for ${revisionCount} concept(s), followed by ${recommendation.activity.title.en}.`
              : language === 'ar'
                ? `الخطوة المناسبة الآن: ${t(recommendation.activity.title, language)} (${t(recommendation.reason, language)})`
                : `Recommended next: ${recommendation.activity.title.en} — ${recommendation.reason.en}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              navigate('game', {
                worldId: recommendation.worldId,
                activityId: recommendation.activity.id,
              })
            }
            className="nono-btn-tactile min-h-[44px] px-5 rounded-xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
          >
            {language === 'ar' ? 'ابدأ الخطوة المقترحة' : 'Start Suggested Step'}
          </button>
          <button
            type="button"
            onClick={() => navigate('brain-games')}
            className="min-h-[44px] px-4 rounded-xl bg-white border border-[#27345C]/15 text-[#27345C] font-extrabold text-xs cursor-pointer hover:border-[#39BDF2]"
          >
            {language === 'ar' ? 'ألعاب الذكاء' : 'Brain Games'}
          </button>
        </div>
      </section>

      {/* NEW SMART COMPANIONS & CREATIVE ENTERTAINMENT HUBS */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'رفيقك الذكي، القراءة، والترفيه العائلي' : 'Smart Companion, Reading & Family Play'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => navigate('nono-ai')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#F3E8FF] to-white border-2 border-[#8054D9]/25 hover:border-[#8054D9] cursor-pointer flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-3xl">🤖</span>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                  activeChild.aiAssistantEnabled === false
                    ? 'bg-slate-200 text-[#27345C]/70'
                    : 'bg-[#8054D9]/15 text-[#8054D9]'
                }`}
              >
                {activeChild.aiAssistantEnabled === false
                  ? language === 'ar'
                    ? 'متوقف من الأهل'
                    : 'Paused by Parent'
                  : language === 'ar'
                    ? 'آمن للأطفال'
                    : 'Child-Safe AI'}
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#27345C]">
                {language === 'ar' ? 'اسأل نونو الذكي' : 'Nono AI Assistant'}
              </h3>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? 'شروحات لطيفة، تلميحات ذكية، وقصص تعليمية بالعربي والإنجليزي'
                  : 'Friendly explanations, progressive hints & safe bilingual Q&A'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('reading-adventure')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#FFF3D1] to-white border-2 border-[#FF9360]/30 hover:border-[#FF9360] cursor-pointer flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-3xl">📖</span>
              <span className="px-2 py-0.5 rounded-lg bg-[#FF9360]/15 text-[#9A3412] text-[10px] font-extrabold tabular-nums">
                {Object.values(activeChild.readingStageProgress || {}).filter((s) => s.mastered).length} / 8
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#27345C]">
                {language === 'ar' ? 'مغامرة القراءة' : 'Reading Adventure'}
              </h3>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? '٨ مراحل من الحروف والأصوات إلى قراءة القصص القصيرة'
                  : '8 guided stages from sounds & phonics to mini-stories'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('entertainment-hub')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#FFE6F2] to-white border-2 border-[#FF78B7]/30 hover:border-[#FF78B7] cursor-pointer flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-3xl">🎭</span>
              <span className="px-2 py-0.5 rounded-lg bg-[#FF78B7]/15 text-[#9D174D] text-[10px] font-extrabold">
                {language === 'ar' ? '٦ عوالم' : '6 Studios'}
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#27345C]">
                {language === 'ar' ? 'مركز الترفيه والإبداع' : 'Entertainment Hub'}
              </h3>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? 'الموسيقى، الطاهي الصغير، البناء، الرسم، مسرح نونو، والاكتشاف'
                  : 'Music, Little Chef, Builder, Art Studio, Theater & Discovery'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('family-activities')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#E2F9EC] to-white border-2 border-[#55D98B]/35 hover:border-[#55D98B] cursor-pointer flex flex-col justify-between gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-3xl">👨‍👩‍👧</span>
              <span className="px-2 py-0.5 rounded-lg bg-[#55D98B]/25 text-[#14532D] text-[10px] font-extrabold tabular-nums">
                {(activeChild.familyActivitiesCompleted || []).length} {language === 'ar' ? 'منجز' : 'done'}
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#27345C]">
                {language === 'ar' ? 'أنشطة العائلة المشتركة' : 'Family Co-Play'}
              </h3>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? 'تحديات وطبخ وحكايات تفاعلية يشارك فيها الأهل مع الطفل'
                  : 'Guided shared reading, cooking & creative habits with parents'}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* INTERACTIVE WORLD EXPANSION: AVATAR, PET, BRAIN GAMES, STUDIO & REWARD SHOP */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-[#27345C]">
          {language === 'ar' ? 'عالمي التفاعلي وإبداعاتي' : 'Interactive World & Creations'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => navigate('my-avatar')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#F3E8FF] to-white border-2 border-[#8054D9]/20 hover:border-[#8054D9] cursor-pointer flex items-center gap-3"
          >
            <div className="w-12 h-12 shrink-0 flex items-center justify-center">
              <div className="scale-75 origin-center">
                <ChildAvatarPreview avatar={activeChild.avatarConfig || DEFAULT_AVATAR_CONFIG} size="sm" animated={false} />
              </div>
            </div>
            <div>
              <p className="font-extrabold text-sm text-[#27345C]">
                {language === 'ar' ? 'صورتي الرمزية' : 'My Avatar'}
              </p>
              <p className="text-[11px] text-[#27345C]/70">
                {language === 'ar' ? 'صمّم شخصيتك' : 'Customize look'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('my-pet')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#E2F9EC] to-white border-2 border-[#55D98B]/30 hover:border-[#55D98B] cursor-pointer flex items-center gap-3"
          >
            <span className="w-11 h-11 rounded-2xl bg-[#55D98B]/20 text-[#166534] flex items-center justify-center shrink-0">
              <PawPrint className="w-6 h-6" />
            </span>
            <div>
              <p className="font-extrabold text-sm text-[#27345C]">
                {language === 'ar' ? 'صديقي الأليف' : 'My Pet'}
              </p>
              <p className="text-[11px] text-[#27345C]/70">
                {language === 'ar' ? 'أطعمه والعب معه' : 'Care & play'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('brain-games')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#E5F6FF] to-white border-2 border-[#39BDF2]/30 hover:border-[#39BDF2] cursor-pointer flex items-center gap-3"
          >
            <span className="w-11 h-11 rounded-2xl bg-[#39BDF2]/20 text-[#0369A1] flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6" />
            </span>
            <div>
              <p className="font-extrabold text-sm text-[#27345C]">
                {language === 'ar' ? 'ألعاب الذكاء (٩)' : 'Brain Games (9)'}
              </p>
              <p className="text-[11px] text-[#27345C]/70">
                {language === 'ar' ? 'ذاكرة وألغاز ومنطق' : 'Memory & puzzles'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('creative-studio')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#FFE6F2] to-white border-2 border-[#FF78B7]/30 hover:border-[#FF78B7] cursor-pointer flex items-center gap-3"
          >
            <span className="w-11 h-11 rounded-2xl bg-[#FF78B7]/20 text-[#BE185D] flex items-center justify-center shrink-0">
              <Brush className="w-6 h-6" />
            </span>
            <div>
              <p className="font-extrabold text-sm text-[#27345C]">
                {language === 'ar' ? 'استوديو الإبداع' : 'Creative Studio'}
              </p>
              <p className="text-[11px] text-[#27345C]/70">
                {language === 'ar' ? 'رسم وتلوين وقصص' : 'Draw & create'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('reward-shop')}
            className="nono-card rounded-3xl p-4 text-start bg-gradient-to-br from-[#FFF3D1] to-white border-2 border-[#FFD84D]/60 hover:border-[#FF9360] cursor-pointer flex items-center gap-3 col-span-2 sm:col-span-1"
          >
            <span className="w-11 h-11 rounded-2xl bg-[#FFD84D]/40 text-[#92400E] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </span>
            <div>
              <p className="font-extrabold text-sm text-[#27345C]">
                {language === 'ar' ? 'متجر الجوائز' : 'Reward Shop'}
              </p>
              <p className="text-[11px] text-[#27345C]/70 tabular-nums">
                ⭐ {formatNumber(activeChild.stars, language)} {language === 'ar' ? 'متاح' : 'stars'}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* FEATURED QURAN WORLD BANNER */}
      <section>
        <button
          type="button"
          onClick={() => {
            soundEngine.playPop();
            navigate('quran-world');
          }}
          className="w-full nono-card rounded-3xl p-5 sm:p-6 text-start bg-gradient-to-br from-[#ECFDF5] via-[#FFFDF7] to-[#FEF3C7] border-2 border-[#047857]/25 hover:border-[#047857] transition-all cursor-pointer flex flex-wrap items-center justify-between gap-4"
        >
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#047857]">
              <span>🌙</span>
              <span>{language === 'ar' ? 'اسمع، ردد، واتعلم مع نونو' : 'Listen, Repeat & Learn with Nono'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'عالم القرآن الكريم — Quran World' : 'Quran World — عالم القرآن الكريم'}
            </h2>
            <p className="text-xs sm:text-sm text-[#27345C]/80">
              {language === 'ar'
                ? 'سور قصيرة موثّقة بالرسم العثماني، استمع وردد مع نونو، قصص القرآن الهادفة، الآداب الإسلامية، ورحلة الحفظ مع الأهل.'
                : 'Verified Uthmani short Surahs, calm Listen & Repeat, symbolic Quran stories, Islamic manners, and parent-confirmed memorization.'}
            </p>
          </div>
          <div className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#047857] text-white font-extrabold text-sm flex items-center gap-2 shrink-0 shadow-md">
            <span>📖</span>
            <span>{language === 'ar' ? 'افتح عالم القرآن' : 'Open Quran World'}</span>
          </div>
        </button>
      </section>

      {/* FEATURED HUBS: LEARNING ACADEMY, OFFICIAL EXAMS & FUN ZONE */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => navigate('academy')}
          className="nono-card rounded-3xl p-5 sm:p-6 text-start bg-gradient-to-br from-[#F3E8FF] via-white to-[#E5F6FF] border-2 border-[#8054D9]/20 hover:border-[#8054D9] transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#8054D9]">
              <GraduationCap className="w-4 h-4" />
              <span>{language === 'ar' ? 'رحلات تعليمية عميقة' : 'Deep Multi-Stage Learning'}</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'أكاديمية نونو للتعلّم' : "Nono's Learning Academy"}
            </h2>
            <p className="text-xs sm:text-sm text-[#27345C]/75">
              {language === 'ar'
                ? 'رحلات ١٠–١١ مرحلة للألوان والحروف والرياضيات، تتبع باللمس ومختبر الألوان!'
                : '10–11 stage concept journeys for colors, Arabic & English letters, math & tracing!'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#8054D9] text-white flex items-center justify-center text-2xl shrink-0 shadow-md">
            🎓
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('exams')}
          className="nono-card rounded-3xl p-5 sm:p-6 text-start bg-gradient-to-br from-[#FFF3D1] via-white to-[#E2F9EC] border-2 border-[#FFD84D]/50 hover:border-[#FF9360] transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#FF9360]">
              <ClipboardCheck className="w-4 h-4" />
              <span>{language === 'ar' ? '٤٠ سؤالاً · شهادة معتمدة' : '40 Questions · Verified Certificate'}</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'اختبارات نونو الرسمية' : 'NonoLand Official Exams'}
            </h2>
            <p className="text-xs sm:text-sm text-[#27345C]/75">
              {language === 'ar'
                ? 'تدريب مجاني أو امتحان رسمي من ٤٠ سؤالاً (نسبة النجاح ٧٠٪) مع شهادة برمز تحقق!'
                : 'Free practice or 40-question official assessment (70% pass) with verified certificate!'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FF9360] text-white flex items-center justify-center text-2xl shrink-0 shadow-md">
            🏅
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('fun-zone')}
          className="nono-card rounded-3xl p-5 sm:p-6 text-start bg-gradient-to-br from-[#FFE6F2] via-white to-[#FFF3D1] border-2 border-[#FF78B7]/25 hover:border-[#FF78B7] transition-all cursor-pointer flex items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#FF4D6D]">
              <Gamepad2 className="w-4 h-4" />
              <span>{language === 'ar' ? 'نونو ولولو وليو وبوبو وإيلي وتيتي' : 'Nono, Lolo, Leo, Bobo, Ellie & Titi'}</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'منطقة المرح ويوتيوب الآمن' : "Nono's Fun Zone & YouTube"}
            </h2>
            <p className="text-xs sm:text-sm text-[#27345C]/75">
              {language === 'ar'
                ? 'ألعاب، فرقة موسيقية، مسرح مضحك، تلبيس الأبطال، وفيديوهات معتمدة!'
                : 'Mini games, dance band, comedy skits, dress-up studio & parent-approved videos!'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FF78B7] text-white flex items-center justify-center text-2xl shrink-0 shadow-md">
            🎪
          </div>
        </button>
      </section>

      {/* INTERNALLY ADAPTED EXPERIENCE SECTION */}
      {internalBand === '1-2' ? (
        /* AGES 1-2: Sensory Large Visual Playground Tiles — Zero reading required */
        <section aria-label="Playful Playground" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'اختر لعبة بصورتها الكبيرة!' : 'Tap a Big Picture to Play!'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                emoji: '🎈',
                title: { ar: 'الألوان والبالونات', en: 'Red & Green Balloons' },
                bg: 'from-[#FF78B7] to-[#FF9360]',
                worldId: 'colors-shapes' as const,
                actId: 'act-red-balloon-34',
              },
              {
                emoji: '🐱',
                title: { ar: 'أصوات الحيوانات', en: 'Animal Sounds' },
                bg: 'from-[#55D98B] to-[#39BDF2]',
                worldId: 'animal-jungle' as const,
                actId: 'act-animal-sound-34',
              },
              {
                emoji: '🍎',
                title: { ar: 'عدّ التفاحات', en: 'Count Apples 1–5' },
                bg: 'from-[#FFD84D] to-[#FF9360]',
                worldId: 'numbers-kingdom' as const,
                actId: 'act-count-apples-34',
              },
              {
                emoji: '🎨',
                title: { ar: 'ارسم ولون', en: 'Free Drawing' },
                bg: 'from-[#8054D9] to-[#FF78B7]',
                worldId: 'creativity-island' as const,
                actId: 'act-free-drawing-all',
              },
            ].map((tile) => (
              <motion.button
                key={tile.actId}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  soundEngine.speak(t(tile.title, language), language);
                  navigate('game', { worldId: tile.worldId, activityId: tile.actId });
                }}
                className={`nono-btn-tactile rounded-3xl p-6 bg-gradient-to-br ${tile.bg} text-white text-center flex flex-col items-center justify-center gap-3 min-h-[190px] cursor-pointer`}
              >
                <span className="text-6xl drop-shadow-sm">{tile.emoji}</span>
                <span className="text-xl font-extrabold">{t(tile.title, language)}</span>
              </motion.button>
            ))}
          </div>
        </section>
      ) : (
        /* ADAPTIVE BANDS 2-3 & 3-4: Adaptive Recommendation + Quick World Cards */
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Adaptive Recommendation Card (7 cols) */}
          <div className="lg:col-span-7 nono-card rounded-3xl p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[#8054D9]">
                  {t(UI_COPY.home.recommendedForYou, language)} · {t(recWorld.name, language)}
                </span>
                <span className="text-xs font-bold text-[#27345C]/60 tabular-nums">
                  {recommendation.activity.estimatedMinutes} {language === 'ar' ? 'دقائق' : 'min'}
                </span>
              </div>

              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm"
                  style={{ backgroundColor: `${recWorld.primaryColor}20` }}
                >
                  {recWorld.guardianEmoji}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#27345C]">
                    {t(recommendation.activity.title, language)}
                  </h2>
                  <p className="text-sm text-[#27345C]/75 mt-1">
                    {t(recommendation.reason, language)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#27345C]/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#27345C]/65">
                {t(recommendation.activity.objective, language)}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate('game', {
                    worldId: recommendation.worldId,
                    activityId: recommendation.activity.id,
                  })
                }
                className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#8054D9] text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t(UI_COPY.games.playNow, language)}</span>
              </button>
            </div>
          </div>

          {/* Age-Specific Highlight Hub (5 cols) */}
          <div className="lg:col-span-5 nono-card rounded-3xl p-6 flex flex-col justify-between bg-gradient-to-br from-white to-[#FFF3D6]">
            <div>
              <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-[#39BDF2]" />
                <span>
                  {internalBand === '2-3'
                    ? language === 'ar'
                      ? 'ألعاب الكلمات والأشكال والعد'
                      : 'Words, Sorting & Shapes Quests'
                    : language === 'ar'
                      ? 'الحروف والأرقام والقصص التفاعلية'
                      : 'Letters, Patterns & Story Quests'}
                </span>
              </h3>
              <p className="text-sm text-[#27345C]/75 mt-1">
                {language === 'ar'
                  ? `لديك ${formatNumber(ageActivities.length, language)} نشاطاً مخصصاً لفئة ${t(ageMeta.label, language)}`
                  : `${formatNumber(ageActivities.length, language)} activities tailored specifically for ${t(ageMeta.label, language)}`}
              </p>

              <div className="mt-4 space-y-2">
                {ageActivities.slice(0, 3).map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => navigate('game', { worldId: act.worldId, activityId: act.id })}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-[#39BDF2]/10 border border-[#27345C]/10 flex items-center justify-between text-start transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-sm text-[#27345C] truncate">
                      {t(act.title, language)}
                    </span>
                    <span className="text-xs font-extrabold text-[#8054D9] shrink-0 ms-2">
                      {t(UI_COPY.games.playNow, language)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('discovery-lab')}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#39BDF2]/20 hover:bg-[#39BDF2]/30 text-[#27345C] font-extrabold text-sm cursor-pointer transition-colors"
            >
              {t(UI_COPY.home.visitDiscoveryLab, language)}
            </button>
          </div>
        </section>
      )}

      {/* GENTLE DAILY DISCOVERIES + QUICK DESTINATIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Discovery Missions (Verified Server Prerequisite Claims) */}
        <div className="lg:col-span-6 nono-card rounded-3xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {t(UI_COPY.home.dailyDiscovery, language)}
              </h3>
              <p className="text-xs text-[#27345C]/65 mt-0.5">
                {t(UI_COPY.home.noPressureNote, language)}
              </p>
            </div>
            <HeartHandshake className="w-6 h-6 text-[#55D98B] shrink-0" />
          </div>

          {missionFeedback && (
            <p className="text-xs font-extrabold px-3 py-2 rounded-xl bg-[#E2F9EC] text-[#14532D]">
              {missionFeedback}
            </p>
          )}

          <div className="space-y-2.5">
            {verifiedMissions.map((m) => {
              const claimed = claimedToday.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => navigate(m.targetScreen)}
                    className="flex items-center gap-3 text-start flex-1 cursor-pointer min-h-[44px]"
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="font-bold text-sm text-[#27345C]">{t(m.title, language)}</p>
                      <p className="text-xs text-[#27345C]/65">{t(m.desc, language)}</p>
                    </div>
                  </button>

                  {claimed ? (
                    <span className="px-3 py-1.5 rounded-xl bg-[#55D98B]/25 text-[#14532D] text-xs font-extrabold shrink-0">
                      {language === 'ar' ? 'مكتملة ✓' : 'Claimed ✓'}
                    </span>
                  ) : m.ready ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await claimDailyMission(m.id);
                        if (res.ok) {
                          soundEngine.playCelebration();
                          setMissionFeedback(
                            language === 'ar'
                              ? `أحسنت! أُضيفت +${res.starsAdded || 3} نجوم لمهمة اليوم ⭐`
                              : `Yay! Added +${res.starsAdded || 3} stars for today's mission ⭐`,
                          );
                        } else if (res.error) {
                          setMissionFeedback(res.error);
                        }
                      }}
                      className="nono-btn-tactile min-h-[40px] px-3 rounded-xl bg-[#FFD84D] text-[#27345C] text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 fill-[#27345C]" />
                      <span>{language === 'ar' ? 'استلم +٣' : 'Claim +3'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(m.targetScreen)}
                      className="min-h-[40px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-[#8054D9] text-xs font-extrabold shrink-0 cursor-pointer"
                    >
                      {language === 'ar' ? 'ابدأ' : 'Play'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* My World / My Room / Stories / Achievements Shortcuts */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => navigate('map')}
            className="nono-card rounded-3xl p-5 text-start hover:border-[#39BDF2] transition-colors cursor-pointer flex flex-col justify-between"
          >
            <Compass className="w-8 h-8 text-[#39BDF2]" />
            <div className="mt-4">
              <p className="font-extrabold text-lg text-[#27345C]">{t(UI_COPY.nav.map, language)}</p>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar' ? '١٠ عوالم تعليمية متحركة' : '10 interactive worlds'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('my-room')}
            className="nono-card rounded-3xl p-5 text-start hover:border-[#FF78B7] transition-colors cursor-pointer flex flex-col justify-between"
          >
            <Palette className="w-8 h-8 text-[#FF78B7]" />
            <div className="mt-4">
              <p className="font-extrabold text-lg text-[#27345C]">{t(UI_COPY.nav.room, language)}</p>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? `${formatNumber(activeChild.unlockedRoomItems.length, language)} عناصر متاحة`
                  : `${activeChild.unlockedRoomItems.length} unlocked items`}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('stories')}
            className="nono-card rounded-3xl p-5 text-start hover:border-[#55D98B] transition-colors cursor-pointer flex flex-col justify-between"
          >
            <BookOpen className="w-8 h-8 text-[#55D98B]" />
            <div className="mt-4">
              <p className="font-extrabold text-lg text-[#27345C]">{t(UI_COPY.nav.stories, language)}</p>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar' ? 'قصص باختياراتك الخاصة' : 'Branching interactive stories'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('achievements')}
            className="nono-card rounded-3xl p-5 text-start hover:border-[#FFD84D] transition-colors cursor-pointer flex flex-col justify-between"
          >
            <Award className="w-8 h-8 text-[#FF9360]" />
            <div className="mt-4">
              <p className="font-extrabold text-lg text-[#27345C]">{t(UI_COPY.nav.achievements, language)}</p>
              <p className="text-xs text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? `${formatNumber(activeChild.certificates.length, language)} شهادات · ${formatNumber(activeChild.unlockedBadges.length, language)} أوسمة`
                  : `${activeChild.certificates.length} certificates · ${activeChild.unlockedBadges.length} badges`}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* MINI WORLD PREVIEW STRIP */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-[#27345C]">
            {language === 'ar' ? 'اكتشف الجزر التعليمية' : 'Jump Into Any Learning Island'}
          </h3>
          <button
            type="button"
            onClick={() => navigate('map')}
            className="text-sm font-bold text-[#8054D9] hover:underline cursor-pointer"
          >
            {language === 'ar' ? 'عرض الخريطة الكاملة' : 'Open Full Map'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {LEARNING_WORLDS.slice(0, 5).map((world) => (
            <button
              key={world.id}
              type="button"
              onClick={() => navigate('world-detail', { worldId: world.id })}
              className="nono-card rounded-2xl p-4 text-start hover:-translate-y-0.5 transition-transform cursor-pointer"
            >
              <div className="text-3xl mb-2">{world.guardianEmoji}</div>
              <p className="font-extrabold text-sm text-[#27345C] leading-snug">
                {t(world.name, language)}
              </p>
              <p className="text-xs text-[#27345C]/65 mt-1 truncate">
                {t(world.subtitle, language)}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
