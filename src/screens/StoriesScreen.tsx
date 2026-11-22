import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Moon,
  Pause,
  PenTool,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  Volume2,
} from 'lucide-react';
import storyForestImg from '../assets/images/story_enchanted_forest_1794739849090.jpg';
import { CharacterActor } from '../components/CharacterCast';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { INTERACTIVE_STORIES } from '../data/stories';
import { getWorldById } from '../data/worlds';
import { getAgeGroupMeta, t, UI_COPY } from '../i18n/translations';
import { CustomStory, OfficialCharacterId, StoryCategory } from '../types/nonoland';
import { isContentAppropriateForChild } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';

const CATEGORY_TABS: Array<{ id: 'all' | StoryCategory; ar: string; en: string; emoji: string }> = [
  { id: 'all', ar: 'جميع القصص', en: 'All Stories', emoji: '📚' },
  { id: 'interactive', ar: 'مغامرات تفاعلية', en: 'Interactive', emoji: '🌟' },
  { id: 'bedtime', ar: 'قصص ما قبل النوم', en: 'Bedtime', emoji: '🌙' },
  { id: 'originals', ar: 'إنتاج نونو لاند', en: 'Originals', emoji: '✨' },
  { id: 'prediction', ar: 'توقّع القادم', en: 'Predictions', emoji: '🔮' },
  { id: 'values', ar: 'قصص القيم', en: 'Values', emoji: '💚' },
];

export const StoriesScreen: React.FC = () => {
  const { activeChild, language, navigate, createCustomStory, deleteCustomStory } = useNonoLand();
  const [categoryFilter, setCategoryFilter] = useState<'all' | StoryCategory>('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeCustomStory, setActiveCustomStory] = useState<CustomStory | null>(null);

  // Story builder form state
  const [customTitle, setCustomTitle] = useState('');
  const [customChar, setCustomChar] = useState<OfficialCharacterId>('nono');
  const [customSetting, setCustomSetting] = useState('Rainbow Forest');
  const [page1Text, setPage1Text] = useState('');
  const [page2Text, setPage2Text] = useState('');
  const [savingStory, setSavingStory] = useState(false);

  const filteredStories = useMemo(() => {
    if (categoryFilter === 'all') return INTERACTIVE_STORIES;
    return INTERACTIVE_STORIES.filter((st) => st.category === categoryFilter);
  }, [categoryFilter]);

  if (!activeChild) return null;

  const customStories = activeChild.customStories || [];

  const handleSaveCustomStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !page1Text.trim()) return;
    setSavingStory(true);
    try {
      await createCustomStory({
        title: customTitle.trim(),
        characterId: customChar,
        setting: customSetting,
        pages: [
          {
            id: 'pg-1',
            title: language === 'ar' ? 'الفصل الأول' : 'Page 1',
            text: page1Text.trim(),
            emojiScene: '🌟🌳',
            characterId: customChar,
            backdrop: 'from-[#FFF8E9] to-[#E6F7FF]',
          },
          {
            id: 'pg-2',
            title: language === 'ar' ? 'النهاية السعيدة' : 'Happy Ending',
            text: page2Text.trim() || (language === 'ar' ? 'وعاش الأصدقاء بسعادة وتعلموا أشياء رائعة معاً!' : 'And all the friends celebrated a joyful new discovery together!'),
            emojiScene: '🎉✨🏆',
            characterId: customChar,
            backdrop: 'from-[#E2F9EC] to-[#FFF3D1]',
          },
        ],
      });
      soundEngine.playCelebration();
      setShowBuilder(false);
      setCustomTitle('');
      setPage1Text('');
      setPage2Text('');
    } finally {
      setSavingStory(false);
    }
  };

  if (activeCustomStory) {
    return (
      <CustomStoryViewer
        story={activeCustomStory}
        language={language}
        onBack={() => setActiveCustomStory(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Illustrated Story World Header */}
      <div className="relative rounded-[2rem] overflow-hidden border-2 border-white shadow-lg">
        <img
          src={storyForestImg}
          alt={t(UI_COPY.nav.stories, language)}
          referrerPolicy="no-referrer"
          className="w-full h-48 sm:h-60 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#27345C]/90 via-[#27345C]/40 to-transparent flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
          <div className="text-white max-w-2xl space-y-2">
            <NonoLandLogo variant="badge" size="xs" tone="dark" language={language} />
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center gap-2.5">
              <BookOpen className="w-8 h-8 text-[#FFD84D]" />
              <span>{language === 'ar' ? 'عالم القصص السحري' : 'Magical Story World'}</span>
            </h1>
            <p className="text-sm sm:text-base text-white/90 mt-1">
              {language === 'ar'
                ? 'قصص تفاعلية، حكايات ما قبل النوم الهادئة، قصص القيم، وتوقع الأحداث مع أصدقاء نونو لاند!'
                : 'Interactive adventures, cozy bedtime tales, NonoLand originals, predictions, plus Create Your Own Story!'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              setShowBuilder((v) => !v);
            }}
            className="nono-btn-tactile min-h-[48px] px-5 py-2.5 rounded-2xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
          >
            <PenTool className="w-4 h-4" />
            <span>{language === 'ar' ? 'اصنع قصتك بنفسك ✨' : 'Create Your Own Story ✨'}</span>
          </button>
        </div>
      </div>

      {/* Create Your Own Story Builder Drawer */}
      {showBuilder && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => void handleSaveCustomStory(e)}
          className="nono-card rounded-3xl p-6 border-2 border-[#8054D9]/30 bg-gradient-to-br from-[#FFF8E9] to-[#F3ECFF] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar' ? 'استوديو تأليف قصتي الخاصة' : 'My Story Author Studio'}
            </h2>
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="text-xs font-extrabold text-[#27345C]/65 cursor-pointer"
            >
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-extrabold mb-1">
                {language === 'ar' ? 'عنوان القصة' : 'Story Title'}
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={language === 'ar' ? 'مغامرة نونو في القمر' : 'Nono’s Moon Adventure'}
                className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#27345C]/15 font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1">
                {language === 'ar' ? 'البطل الرئيسي' : 'Lead Character'}
              </label>
              <select
                value={customChar}
                onChange={(e) => setCustomChar(e.target.value as OfficialCharacterId)}
                className="w-full h-11 px-3 rounded-xl bg-white border border-[#27345C]/15 font-bold text-sm"
              >
                <option value="nono">{language === 'ar' ? 'نونو (ثعلب النجوم)' : 'Nono'}</option>
                <option value="lolo">{language === 'ar' ? 'لولو (أرنوبة لطيفة)' : 'Lolo'}</option>
                <option value="leo">{language === 'ar' ? 'ليو (الأسد الشجاع)' : 'Leo'}</option>
                <option value="bobo">{language === 'ar' ? 'بوبو (القرد المرح)' : 'Bobo'}</option>
                <option value="ellie">{language === 'ar' ? 'إيلي (الفيلة الذكية)' : 'Ellie'}</option>
                <option value="titi">{language === 'ar' ? 'تيتي (العصفور المغرد)' : 'Titi'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold mb-1">
                {language === 'ar' ? 'المكان السحري' : 'Story Setting'}
              </label>
              <select
                value={customSetting}
                onChange={(e) => setCustomSetting(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-white border border-[#27345C]/15 font-bold text-sm"
              >
                <option value="Rainbow Forest">{language === 'ar' ? 'غابة قوس قزح' : 'Rainbow Forest'}</option>
                <option value="Starlight Castle">{language === 'ar' ? 'قلعة النجوم' : 'Starlight Castle'}</option>
                <option value="Crystal Ocean">{language === 'ar' ? 'المحيط الكريستالي' : 'Crystal Ocean'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold mb-1">
                {language === 'ar' ? 'بداية القصة (الصفحة ١)' : 'Page 1 — Story Opening'}
              </label>
              <textarea
                required
                rows={3}
                maxLength={350}
                value={page1Text}
                onChange={(e) => setPage1Text(e.target.value)}
                placeholder={language === 'ar' ? 'ذات صباح مشمس، قرر بطلنا استكشاف...' : 'One sunny morning, our hero decided to explore...'}
                className="w-full p-3 rounded-xl bg-white border border-[#27345C]/15 font-semibold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold mb-1">
                {language === 'ar' ? 'نهاية القصة (الصفحة ٢)' : 'Page 2 — Happy Ending'}
              </label>
              <textarea
                rows={3}
                maxLength={350}
                value={page2Text}
                onChange={(e) => setPage2Text(e.target.value)}
                placeholder={language === 'ar' ? 'وفي النهاية عاد الجميع بسعادة...' : 'And finally, everyone celebrated under the stars...'}
                className="w-full p-3 rounded-xl bg-white border border-[#27345C]/15 font-semibold text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingStory}
            className="nono-btn-tactile min-h-[48px] px-6 py-2.5 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{savingStory ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'احفظ واقرأ قصتي!' : 'Save & Read My Story!')}</span>
          </button>
        </motion.form>
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => {
          const active = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setCategoryFilter(tab.id);
              }}
              className={`min-h-[44px] px-4 py-2 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                active
                  ? 'bg-[#8054D9] text-white border-[#8054D9]'
                  : 'bg-white text-[#27345C] border-[#27345C]/12 hover:border-[#8054D9]/50'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{language === 'ar' ? tab.ar : tab.en}</span>
            </button>
          );
        })}
      </div>

      {/* Illustrated Story Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStories.map((story) => {
          const isAgeFit = isContentAppropriateForChild(story, activeChild);
          const completed = activeChild.completedStoryIds.includes(story.id);
          const world = getWorldById(story.worldId);

          return (
            <div
              key={story.id}
              className={`nono-card rounded-3xl p-6 flex flex-col justify-between gap-4 border-2 ${
                story.isBedtime ? 'bg-gradient-to-b from-[#1D2448] to-[#2C285C] text-white border-[#6366F1]/50' : 'border-white'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{story.coverEmoji}</span>
                  <div className="flex items-center gap-2">
                    {story.isBedtime && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FFD84D]">
                        <Moon className="w-3.5 h-3.5" />
                        {language === 'ar' ? 'نوم هادئ' : 'Bedtime'}
                      </span>
                    )}
                    {completed && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#55D98B]">
                        <CheckCircle2 className="w-4 h-4" />
                        {language === 'ar' ? 'مقروءة' : 'Read'}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs font-bold" style={{ color: story.isBedtime ? '#FFD84D' : story.accentColor }}>
                  {t(world.name, language)} ·{' '}
                  {isAgeFit
                    ? language === 'ar'
                      ? 'مناسبة لعمرك'
                      : 'Great for your age'
                    : t(getAgeGroupMeta('1-4').label, language)}
                </p>

                <h2 className={`text-xl font-extrabold ${story.isBedtime ? 'text-white' : 'text-[#27345C]'}`}>
                  {t(story.title, language)}
                </h2>
                <p className={`text-sm leading-relaxed ${story.isBedtime ? 'text-white/80' : 'text-[#27345C]/75'}`}>
                  {t(story.summary, language)}
                </p>

                {story.moralValue && (
                  <p className={`text-xs font-extrabold ${story.isBedtime ? 'text-[#39BDF2]' : 'text-[#8054D9]'}`}>
                    ✨ {story.moralValue[language]}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('story-reader', { storyId: story.id })}
                className="nono-btn-tactile w-full min-h-[48px] py-3 rounded-2xl text-white font-bold cursor-pointer"
                style={{ backgroundColor: story.accentColor }}
              >
                {story.isBedtime
                  ? language === 'ar'
                    ? 'افتح قصة النوم 🌙'
                    : 'Open Bedtime Story 🌙'
                  : language === 'ar'
                    ? 'افتح القصة واختر'
                    : 'Read & Choose'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Child's Saved Custom Stories Shelf */}
      {customStories.length > 0 && (
        <div className="nono-card rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <span>📖</span>
            <span>{language === 'ar' ? `قصص ${activeChild.displayName} المؤلَّفة` : `${activeChild.displayName}'s Own Stories`}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customStories.map((cs) => (
              <div key={cs.id} className="rounded-2xl bg-[#FFF8E9] border border-[#27345C]/12 p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-[#27345C]">{cs.title}</h3>
                    <p className="text-xs font-bold text-[#8054D9] mt-0.5">{cs.setting} · {cs.pages.length} {language === 'ar' ? 'صفحات' : 'pages'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCustomStory(cs.id)}
                    aria-label="Delete custom story"
                    className="p-2 text-[#FF4D6D] hover:bg-white rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCustomStory(cs)}
                  className="nono-btn-tactile min-h-[44px] w-full rounded-xl bg-[#8054D9] text-white text-xs font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'اقرأ قصتي' : 'Read My Story'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const StoryReaderScreen: React.FC = () => {
  const { selectedStoryId, activeChild, language, navigate, completeStory } = useNonoLand();
  const story = INTERACTIVE_STORIES.find((s) => s.id === selectedStoryId) || INTERACTIVE_STORIES[0];
  const [sceneId, setSceneId] = useState(story.startSceneId);
  const [rewarded, setRewarded] = useState(false);
  const [isPlayingNarration, setIsPlayingNarration] = useState(false);
  const [highlightedWordIdx, setHighlightedWordIdx] = useState<number>(-1);
  const [predictionGuessed, setPredictionGuessed] = useState<string | null>(null);

  const scene = story.scenes[sceneId] || story.scenes[story.startSceneId];
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;
  const isBedtime = Boolean(story.isBedtime);
  const sceneText = t(scene.text, language);
  const words = useMemo(() => sceneText.split(/\s+/).filter(Boolean), [sceneText]);

  useEffect(() => {
    setSceneId(story.startSceneId);
    setRewarded(false);
    setPredictionGuessed(null);
  }, [story.id, story.startSceneId]);

  useEffect(() => {
    setPredictionGuessed(null);
    setHighlightedWordIdx(-1);
    setIsPlayingNarration(true);
    soundEngine.speak(sceneText, language);

    if (scene.isEnding && !rewarded) {
      setRewarded(true);
      completeStory(story.id, scene.rewardStars || 4, story.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  // Read-along word highlighting timer synced to active playback
  useEffect(() => {
    if (!isPlayingNarration) return;
    const interval = setInterval(() => {
      setHighlightedWordIdx((prev) => {
        if (prev + 1 >= words.length) {
          setIsPlayingNarration(false);
          return -1;
        }
        return prev + 1;
      });
    }, isBedtime ? 420 : 320);
    return () => clearInterval(interval);
  }, [isPlayingNarration, words.length, isBedtime]);

  if (!activeChild) return null;

  const togglePlayPause = () => {
    if (isPlayingNarration) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingNarration(false);
    } else {
      setHighlightedWordIdx(0);
      setIsPlayingNarration(true);
      soundEngine.speak(sceneText, language);
    }
  };

  const replayNarration = () => {
    setHighlightedWordIdx(0);
    setIsPlayingNarration(true);
    soundEngine.speak(sceneText, language);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          navigate('stories');
        }}
        className="inline-flex items-center gap-2 text-sm font-bold text-[#27345C]/80 hover:text-[#27345C] cursor-pointer"
      >
        <BackIcon className="w-4 h-4" />
        <span>{language === 'ar' ? 'العودة إلى القصص' : 'Back to Stories'}</span>
      </button>

      <motion.div
        key={scene.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-[2rem] p-6 sm:p-8 border-2 shadow-xl bg-gradient-to-br ${scene.bgMood} ${
          isBedtime ? 'border-[#6366F1]/50 text-white' : 'border-white text-[#27345C]'
        } space-y-6`}
      >
        {/* Header + Narration Play/Pause/Replay Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {isBedtime && (
              <p className="text-xs font-extrabold text-[#FFD84D] flex items-center gap-1 mb-0.5">
                <Moon className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'وضع حكايات ما قبل النوم الهادئ' : 'Calm Bedtime Story Theater'}</span>
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-extrabold">{t(story.title, language)}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayPause}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white text-[#27345C] border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              {isPlayingNarration ? <Pause className="w-4 h-4 text-[#8054D9]" /> : <Play className="w-4 h-4 text-[#8054D9]" />}
              <span>
                {isPlayingNarration
                  ? language === 'ar'
                    ? 'إيقاف مؤقت'
                    : 'Pause'
                  : language === 'ar'
                    ? 'تشغيل القراءة'
                    : 'Play Read-Along'}
              </span>
            </button>
            <button
              type="button"
              onClick={replayNarration}
              aria-label="Replay narration"
              className="min-h-[44px] px-3 py-2 rounded-xl bg-white text-[#27345C] border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#8054D9]" />
              <Volume2 className="w-4 h-4 text-[#8054D9]" />
            </button>
          </div>
        </div>

        {/* Illustrated Cast + Animated Theater Stage */}
        <div
          className={`rounded-3xl p-6 text-center border shadow-inner space-y-4 ${
            isBedtime ? 'bg-[#121733]/70 border-white/15' : 'bg-white/80 border-[#27345C]/10'
          }`}
        >
          <div className="text-5xl sm:text-6xl tracking-widest animate-float-slow">
            {scene.illustrationEmoji}
          </div>
          {scene.castCharacters && scene.castCharacters.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              {scene.castCharacters.map((charId) => (
                <CharacterActor
                  key={charId}
                  characterId={charId}
                  mood={scene.isEnding ? 'celebrating' : isBedtime ? 'idle' : 'waving'}
                  size="sm"
                  language={language}
                />
              ))}
            </div>
          )}
        </div>

        {/* Read-Along Highlighted Story Text */}
        <p className="text-lg sm:text-xl font-bold leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
          {words.map((word, wIdx) => (
            <span
              key={wIdx}
              className={`rounded px-0.5 transition-colors ${
                wIdx === highlightedWordIdx
                  ? isBedtime
                    ? 'bg-[#FFD84D]/35 text-[#FFD84D]'
                    : 'bg-[#FFD84D]/55 text-[#27345C]'
                  : ''
              }`}
            >
              {word}
            </span>
          ))}
        </p>

        {/* Nono Companion Cue */}
        <div
          className={`flex items-center gap-4 rounded-2xl p-4 ${
            isBedtime ? 'bg-white/10' : 'bg-white/75'
          }`}
        >
          <NonoCharacter
            mood={scene.isEnding ? 'celebrating' : isBedtime ? 'sleeping' : 'excited'}
            scarfColor={activeChild.companionScarfColor}
            size="sm"
            language={language}
          />
          <p className={`font-bold text-sm sm:text-base ${isBedtime ? 'text-[#FFD84D]' : 'text-[#8054D9]'}`}>
            {t(scene.nonoLine, language)}
          </p>
        </div>

        {/* Prediction Pause ("Choose What Happens Next") */}
        {scene.predictionPrompt && !scene.isEnding && (
          <div className="rounded-2xl bg-[#FFF3D1] text-[#27345C] p-4 border-2 border-[#FFD84D] space-y-2">
            <p className="text-xs font-extrabold text-[#B45309]">
              🔮 {language === 'ar' ? 'توقّع الأحداث قبل الاختيار:' : 'Story Prediction Pause:'}
            </p>
            <p className="text-sm font-bold">{scene.predictionPrompt[language]}</p>
            {!predictionGuessed ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setPredictionGuessed('discover');
                  }}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white text-xs font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'أتوقع اكتشاف مفاجأة جديدة ✨' : 'I predict a joyful surprise! ✨'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setPredictionGuessed('team');
                  }}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white text-xs font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'أتوقع تعاون الأصدقاء لحل اللغز 🤝' : 'I predict teamwork solves it! 🤝'}
                </button>
              </div>
            ) : (
              <p className="text-xs font-extrabold text-[#1E7E48]">
                ✓ {language === 'ar' ? 'توقّع رائع! لنرَ الآن ماذا سيحدث عندما نختار!' : 'Great prediction! Pick a choice below to see what happens!'}
              </p>
            )}
          </div>
        )}

        {/* Branching Decisions OR Ending Rewards */}
        {scene.choices && scene.choices.length > 0 ? (
          <div className="space-y-3 pt-2">
            <p className={`text-xs font-extrabold ${isBedtime ? 'text-white/80' : 'text-[#27345C]/70'}`}>
              {language === 'ar' ? 'اختر ماذا سيحدث الآن:' : 'Choose what happens next:'}
            </p>
            <div className="grid grid-cols-1 gap-3">
              {scene.choices.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setSceneId(ch.nextSceneId);
                  }}
                  className="nono-btn-tactile min-h-[52px] p-4 rounded-2xl bg-white border-2 border-[#8054D9]/30 hover:border-[#8054D9] text-start font-extrabold text-[#27345C] flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span>{t(ch.label, language)}</span>
                  <Sparkles className="w-4 h-4 text-[#8054D9] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#55D98B]/25 border-2 border-[#55D98B] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-extrabold">
              <Star className="w-6 h-6 fill-[#FFD84D] text-[#FF9360]" />
              <span>
                {language === 'ar'
                  ? `أحسنت! أنهيت القصة وحصلت على +${scene.rewardStars || 4} نجوم!`
                  : `Story Complete! You earned +${scene.rewardStars || 4} stars!`}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRewarded(false);
                  setSceneId(story.startSceneId);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-[#27345C] font-bold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'جرّب مساراً آخر' : 'Try Another Path'}
              </button>
              <button
                type="button"
                onClick={() => navigate('stories')}
                className="nono-btn-tactile min-h-[44px] px-5 py-2 rounded-xl bg-[#8054D9] text-white font-bold text-sm cursor-pointer"
              >
                {language === 'ar' ? 'المزيد من القصص' : 'More Stories'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const CustomStoryViewer: React.FC<{
  story: CustomStory;
  language: 'ar' | 'en';
  onBack: () => void;
}> = ({ story, language, onBack }) => {
  const [pageIdx, setPageIdx] = useState(0);
  const page = story.pages[pageIdx] || story.pages[0];

  return (
    <div className="max-w-2xl mx-auto nono-card rounded-[2rem] p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-3 rounded-xl bg-[#FFF8E9] text-xs font-extrabold cursor-pointer"
        >
          ← {language === 'ar' ? 'رجوع للقصص' : 'Back to Stories'}
        </button>
        <span className="text-xs font-extrabold text-[#8054D9] tabular-nums">
          {pageIdx + 1} / {story.pages.length}
        </span>
      </div>

      <h1 className="text-2xl font-extrabold text-[#27345C]">{story.title}</h1>
      <div className={`rounded-3xl p-6 bg-gradient-to-br ${page.backdrop || 'from-[#FFF8E9] to-[#E6F7FF]'} text-center space-y-3`}>
        <div className="text-5xl">{page.emojiScene}</div>
        <div className="flex justify-center">
          <CharacterActor characterId={page.characterId} mood="excited" size="sm" language={language} />
        </div>
      </div>

      <p className="text-lg font-bold text-[#27345C] leading-relaxed">{page.text}</p>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => soundEngine.speak(page.text, language)}
          className="min-h-[44px] px-4 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <Volume2 className="w-4 h-4 text-[#8054D9]" />
          <span>{language === 'ar' ? 'اقرأ الصفحة' : 'Read Page'}</span>
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pageIdx === 0}
            onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
            className="min-h-[44px] px-4 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold disabled:opacity-40 cursor-pointer"
          >
            {language === 'ar' ? 'السابق' : 'Prev'}
          </button>
          <button
            type="button"
            disabled={pageIdx >= story.pages.length - 1}
            onClick={() => setPageIdx((p) => Math.min(story.pages.length - 1, p + 1))}
            className="min-h-[44px] px-4 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer"
          >
            {language === 'ar' ? 'التالي' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
