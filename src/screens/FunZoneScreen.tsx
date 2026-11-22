import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  ExternalLink,
  Film,
  Gamepad2,
  Lock,
  Music,
  Palette,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Theater,
  Trees,
  Tv,
  Volume2,
  X,
} from 'lucide-react';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import {
  DEFAULT_CHARACTER_OUTFITS,
  DRESS_UP_OPTIONS,
  FUN_CHARACTERS,
  FUNNY_MOMENTS,
  OFFICIAL_YOUTUBE_CHANNEL,
  SPOT_DIFFERENCE_PUZZLES,
} from '../data/funZoneData';
import { formatNumber, t } from '../i18n/translations';
import { CuratedYouTubeVideo, YouTubeCategory } from '../types/nonoland';
import { soundEngine } from '../utils/soundEngine';

type FunTab =
  | 'mini-games'
  | 'music-dance'
  | 'funny-moments'
  | 'dress-up'
  | 'playground'
  | 'youtube';

const INITIAL_SLIDER_SOLVED = ['🦊', '🐰', '🦁', '🐻', '🐘', '🐢', '🌟', '🎈', ''];

function isAdjacent(a: number, b: number) {
  const rowA = Math.floor(a / 3);
  const colA = a % 3;
  const rowB = Math.floor(b / 3);
  const colB = b % 3;
  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
}

export const FunZoneScreen: React.FC = () => {
  const { activeChild, language, updateCharacterOutfit, grantFunReward, curatedVideos, navigate } =
    useNonoLand();
  const [tab, setTab] = useState<FunTab>('mini-games');

  // --- MINI GAMES STATE ---
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [foundDiffs, setFoundDiffs] = useState<number[]>([]);
  const [diffFeedback, setDiffFeedback] = useState('');
  const currentPuzzle = SPOT_DIFFERENCE_PUZZLES[puzzleIdx];

  // Star Popper Reaction Mini-Game
  const [popScore, setPopScore] = useState(0);
  const [popTargetIdx, setPopTargetIdx] = useState(4);
  const [popMessage, setPopMessage] = useState('');

  // 3x3 Sliding Tile Puzzle
  const [tiles, setTiles] = useState<string[]>(['🦊', '🐰', '🦁', '🐻', '🐘', '🐢', '🌟', '', '🎈']);
  const isSliderSolved = tiles.every((val, idx) => val === INITIAL_SLIDER_SOLVED[idx]);

  // --- MUSIC & DANCE STATE ---
  const [instrument, setInstrument] = useState<'xylophone' | 'drum' | 'flute' | 'bell'>('xylophone');
  const [isDancing, setIsDancing] = useState(false);
  const [autoJam, setAutoJam] = useState(false);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!autoJam) return;
    let step = 0;
    const notes = [0, 2, 4, 2, 5, 4, 3, 1];
    const id = window.setInterval(() => {
      const note = notes[step % notes.length];
      soundEngine.playInstrument(instrument, note);
      setActiveNoteIdx(note);
      setIsDancing(true);
      step += 1;
    }, 450);
    return () => {
      window.clearInterval(id);
      setActiveNoteIdx(null);
    };
  }, [autoJam, instrument]);

  // --- FUNNY MOMENTS SKIT STATE ---
  const [skitIdx, setSkitIdx] = useState(0);
  const [beatIdx, setBeatIdx] = useState(0);
  const currentSkit = FUNNY_MOMENTS[skitIdx];
  const currentBeat = currentSkit.beats[beatIdx];

  // --- DRESS UP STUDIO STATE ---
  const [dressCharId, setDressCharId] = useState<'nono' | 'lolo' | 'leo' | 'bobo' | 'ellie' | 'titi'>('nono');
  const outfitsMap = activeChild?.characterOutfits || DEFAULT_CHARACTER_OUTFITS;
  const activeOutfit = outfitsMap[dressCharId] || DEFAULT_CHARACTER_OUTFITS[dressCharId];
  const selectedFunChar = FUN_CHARACTERS.find((c) => c.id === dressCharId) || FUN_CHARACTERS[0];

  // --- VIRTUAL PLAYGROUND STATE ---
  const [playgroundMessage, setPlaygroundMessage] = useState<{ ar: string; en: string } | null>(null);
  const [playgroundActiveZone, setPlaygroundActiveZone] = useState<string | null>(null);

  // --- YOUTUBE CHANNEL SECTION STATE ---
  const [ytCategory, setYtCategory] = useState<'all' | YouTubeCategory>('all');
  const [activeVideo, setActiveVideo] = useState<CuratedYouTubeVideo | null>(null);
  const [showChannelGate, setShowChannelGate] = useState(false);
  const [channelGateInput, setChannelGateInput] = useState('');
  const [channelGateError, setChannelGateError] = useState(false);
  const [channelGateUnlocked, setChannelGateUnlocked] = useState(false);
  const [ytApiStatus, setYtApiStatus] = useState<{
    configured: boolean;
    videos: CuratedYouTubeVideo[];
  }>({ configured: false, videos: [] });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/youtube/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setYtApiStatus({
            configured: Boolean(data.configured),
            videos: Array.isArray(data.videos) ? data.videos : [],
          });
        }
      })
      .catch(() => {
        // Offline or static preview fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const approvedVideos = useMemo(() => {
    const merged = [...curatedVideos.filter((v) => v.approvedByParent)];
    ytApiStatus.videos.forEach((apiVid) => {
      if (!merged.some((m) => m.videoId === apiVid.videoId)) {
        merged.push(apiVid);
      }
    });
    if (ytCategory === 'all') return merged;
    return merged.filter((v) => v.category === ytCategory);
  }, [curatedVideos, ytApiStatus.videos, ytCategory]);

  if (!activeChild) return null;

  const handleSpotTap = (idx: number) => {
    if (currentPuzzle.diffIndices.includes(idx)) {
      if (!foundDiffs.includes(idx)) {
        const next = [...foundDiffs, idx];
        setFoundDiffs(next);
        soundEngine.playSuccess();
        if (next.length === currentPuzzle.diffIndices.length) {
          grantFunReward(2, `spot-${currentPuzzle.id}`);
          setDiffFeedback(
            language === 'ar'
              ? 'رائع! وجدت كل الاختلافات وحصلت على نجمتين! ⭐'
              : 'Awesome! You spotted every difference (+2 stars)!',
          );
        } else {
          setDiffFeedback(
            language === 'ar' ? 'أحسنت! بقي اختلاف واحد!' : 'Nice eye! One more difference to spot!',
          );
        }
      }
    } else {
      soundEngine.playPop();
      setDiffFeedback(
        language === 'ar' ? 'هذا متطابق! جرّب مقارنة مربع آخر.' : 'Those two match! Compare another spot.',
      );
    }
  };

  const handleStarPop = (idx: number) => {
    if (idx === popTargetIdx) {
      soundEngine.playInstrument('bell', popScore % 6);
      const nextScore = popScore + 1;
      setPopScore(nextScore);
      setPopTargetIdx((idx + 3 + Math.floor(Math.random() * 5)) % 9);
      if (nextScore % 5 === 0) {
        grantFunReward(1);
        setPopMessage(
          language === 'ar'
            ? `ممتاز! جمعت ${formatNumber(nextScore, language)} نجمة ضاحكة (+١ نجمة لملفك)!`
            : `Woohoo! ${nextScore} giggling stars caught (+1 profile star)!`,
        );
      } else {
        setPopMessage('');
      }
    } else {
      soundEngine.playPop();
    }
  };

  const handleSlideTile = (idx: number) => {
    const emptyIdx = tiles.indexOf('');
    if (!isAdjacent(idx, emptyIdx)) return;
    soundEngine.playPop();
    const copy = [...tiles];
    copy[emptyIdx] = copy[idx];
    copy[idx] = '';
    setTiles(copy);
    if (copy.every((val, i) => val === INITIAL_SLIDER_SOLVED[i])) {
      soundEngine.playCelebration();
      grantFunReward(2, 'slider-puzzle');
    }
  };

  const shuffleSlider = () => {
    soundEngine.playPop();
    setTiles(['🦊', '🦁', '🐰', '🐻', '', '🐢', '🌟', '🐘', '🎈']);
  };

  const handleZoneTap = (
    zoneId: string,
    msg: { ar: string; en: string },
    sound: 'xylophone' | 'flute' | 'bell' | 'drum',
    rewardId?: string,
  ) => {
    setPlaygroundActiveZone(zoneId);
    setPlaygroundMessage(msg);
    soundEngine.playInstrument(sound, Math.floor(Math.random() * 5));
    soundEngine.speak(t(msg, language), language);
    if (rewardId && !(activeChild.unlockedFunRewards || []).includes(rewardId)) {
      grantFunReward(1, rewardId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-[2rem] bg-gradient-to-br from-[#FF78B7] via-[#FF9360] to-[#FFD84D] text-[#27345C] p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="space-y-2 text-center md:text-start">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-extrabold text-[#27345C]/80">
              <NonoLandLogo variant="badge" size="xs" language={language} />
              <span>
                {language === 'ar' ? 'نونو وأصدقاؤه الستة' : 'Nono & All 6 Friends'} ·{' '}
                {language === 'ar' ? 'لعب وموسيقى وأفلام آمنة' : 'Games, Music, Dress-Up & Safe Videos'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center justify-center md:justify-start gap-2.5">
              <Sparkles className="w-8 h-8 text-white drop-shadow-sm" />
              <span>{language === 'ar' ? 'منطقة المرح مع نونو وأصدقائه' : "Nono's Fun Zone"}</span>
            </h1>
            <p className="text-sm sm:text-base font-semibold text-[#27345C]/85 max-w-2xl">
              {language === 'ar'
                ? 'ألغاز مصورة، آلات موسيقية، مسرح اللحظات المضحكة، تلبيس الأبطال الستة، وحديقة الألعاب التفاعلية!'
                : 'Spot-the-difference puzzles, music & dance band, comedy skits, 6-character dress-up, and an interactive playground!'}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/75 backdrop-blur-sm px-4 py-3 rounded-3xl shadow-sm">
            {FUN_CHARACTERS.map((ch) => (
              <span
                key={ch.id}
                title={t(ch.name, language)}
                className="text-3xl hover:scale-125 transition-transform cursor-default"
              >
                {ch.emoji}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-[#27345C]/12">
        {[
          { id: 'mini-games' as const, icon: <Gamepad2 className="w-4 h-4" />, ar: 'ألعاب وألغاز', en: 'Mini Games' },
          { id: 'music-dance' as const, icon: <Music className="w-4 h-4" />, ar: 'الموسيقى والرقص', en: 'Music & Dance' },
          { id: 'funny-moments' as const, icon: <Theater className="w-4 h-4" />, ar: 'مسرح المرح والقصص', en: 'Funny Moments' },
          { id: 'dress-up' as const, icon: <Palette className="w-4 h-4" />, ar: 'تلبيس الأبطال (٦)', en: 'Dress Up (6)' },
          { id: 'playground' as const, icon: <Trees className="w-4 h-4" />, ar: 'الحديقة التفاعلية', en: 'Playground' },
          { id: 'youtube' as const, icon: <Tv className="w-4 h-4" />, ar: 'قناة نونو على يوتيوب', en: 'NonoLand YouTube' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              soundEngine.playPop();
              if (item.id !== 'music-dance') setAutoJam(false);
              setTab(item.id);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              tab === item.id ? 'bg-[#FF78B7] text-white shadow-sm' : 'text-[#27345C]/75 hover:bg-[#FFF8E9]'
            }`}
          >
            {item.icon}
            <span>{language === 'ar' ? item.ar : item.en}</span>
          </button>
        ))}
      </div>

      {/* ===================================================
          TAB 1: MINI GAMES (Spot Diff, Star Popper, 3x3 Puzzle)
      =================================================== */}
      {tab === 'mini-games' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Spot the Difference */}
          <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'ابحث عن الاختلافين!' : 'Spot the 2 Differences!'}
                </h2>
                <p className="text-xs font-bold text-[#8054D9]">{t(currentPuzzle.title, language)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPuzzleIdx((puzzleIdx + 1) % SPOT_DIFFERENCE_PUZZLES.length);
                  setFoundDiffs([]);
                  setDiffFeedback('');
                }}
                className="px-3 py-1.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/12 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'لغز آخر' : 'Next Scene'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-2xl bg-[#E5F6FF]/60 border border-[#39BDF2]/25">
                <p className="text-[11px] font-extrabold text-center mb-2">
                  {language === 'ar' ? 'الصورة الأصلية' : 'Original Scene'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {currentPuzzle.leftGrid.map((emoji, idx) => (
                    <div
                      key={idx}
                      className="h-16 rounded-xl bg-white flex items-center justify-center text-3xl shadow-sm"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#FFE6F2]/60 border border-[#FF78B7]/25">
                <p className="text-[11px] font-extrabold text-center mb-2">
                  {language === 'ar' ? 'اضغط على المختلف هنا' : 'Tap Differences Here'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {currentPuzzle.rightGrid.map((emoji, idx) => {
                    const isFound = foundDiffs.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSpotTap(idx)}
                        className={`h-16 rounded-xl flex items-center justify-center text-3xl border-2 cursor-pointer transition-all ${
                          isFound
                            ? 'bg-[#55D98B]/25 border-[#55D98B] scale-105'
                            : 'bg-white border-transparent hover:border-[#FF78B7]'
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {diffFeedback && (
              <p className="text-sm font-extrabold text-[#8054D9] bg-[#F3E8FF] px-4 py-2.5 rounded-2xl">
                {diffFeedback}
              </p>
            )}
          </div>

          {/* Right Column: Star Popper + Sliding Tile Puzzle */}
          <div className="lg:col-span-5 space-y-5">
            {/* Giggling Star Popper */}
            <div className="nono-card rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'اصطد النجمة الضاحكة!' : 'Catch the Giggling Star!'}
                </h3>
                <span className="font-mono-num text-xs font-extrabold px-2.5 py-1 rounded-xl bg-[#FFD84D]/40">
                  ⭐ {formatNumber(popScore, language)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, idx) => {
                  const isTarget = idx === popTargetIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStarPop(idx)}
                      className={`h-14 rounded-2xl text-2xl font-extrabold flex items-center justify-center cursor-pointer transition-transform ${
                        isTarget
                          ? 'bg-[#FFD84D] scale-105 shadow-md'
                          : 'bg-[#FFF8E9] border border-[#27345C]/10'
                      }`}
                    >
                      {isTarget ? '🌟' : '☁️'}
                    </button>
                  );
                })}
              </div>
              {popMessage && <p className="text-xs font-extrabold text-[#55D98B]">{popMessage}</p>}
            </div>

            {/* 3x3 Sliding Puzzle */}
            <div className="nono-card rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'بازل الترتيب السريع' : '3×3 Sliding Tile Puzzle'}
                </h3>
                <button
                  type="button"
                  onClick={shuffleSlider}
                  className="text-xs font-bold text-[#8054D9] hover:underline cursor-pointer"
                >
                  {language === 'ar' ? 'خلط' : 'Shuffle'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-w-[230px] mx-auto" dir="ltr">
                {tiles.map((tile, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSlideTile(idx)}
                    disabled={!tile}
                    className={`h-16 rounded-2xl text-2xl flex items-center justify-center border-2 transition-all ${
                      tile
                        ? 'bg-[#FFF8E9] border-[#27345C]/12 hover:border-[#8054D9] cursor-pointer shadow-sm'
                        : 'bg-slate-100 border-dashed border-slate-300'
                    }`}
                  >
                    {tile}
                  </button>
                ))}
              </div>
              {isSliderSolved && (
                <p className="text-center text-xs font-extrabold text-[#55D98B]">
                  {language === 'ar' ? 'أحسنت! رتّبت كل الأصدقاء بنجاح! 🎉' : 'Solved! All friends aligned! 🎉'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 2: MUSIC & DANCE BAND
      =================================================== */}
      {tab === 'music-dance' && (
        <div className="nono-card rounded-3xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'فرقة نونو الموسيقية والرقص' : "Nono's Music & Dance Band"}
              </h2>
              <p className="text-sm text-[#27345C]/75">
                {language === 'ar'
                  ? 'اختر آلة موسيقية واضغط النغمات لتشاهد الأصدقاء الستة يرقصون على الإيقاع!'
                  : 'Pick an instrument and tap notes to make all 6 friends dance to your melody!'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setAutoJam(!autoJam);
                if (autoJam) setIsDancing(false);
              }}
              className={`nono-btn-tactile px-5 py-2.5 rounded-2xl text-sm font-extrabold flex items-center gap-2 cursor-pointer ${
                autoJam ? 'bg-[#55D98B] text-[#27345C]' : 'bg-[#8054D9] text-white'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>
                {autoJam
                  ? language === 'ar'
                    ? 'إيقاف الإيقاع التلقائي'
                    : 'Stop Dance Beat'
                  : language === 'ar'
                    ? 'تشغيل حفلة الرقص'
                    : 'Start Dance Party'}
              </span>
            </button>
          </div>

          {/* Instrument Selector */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'xylophone' as const, emoji: '🎹', ar: 'إكسيلوفون', en: 'Xylophone' },
              { id: 'drum' as const, emoji: '🥁', ar: 'طبلة مرحة', en: 'Bongo Drum' },
              { id: 'flute' as const, emoji: '🪈', ar: 'ناي لطيف', en: 'Flute' },
              { id: 'bell' as const, emoji: '🔔', ar: 'أجراس سحرية', en: 'Magic Bells' },
            ].map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => {
                  setInstrument(inst.id);
                  soundEngine.playInstrument(inst.id, 2);
                }}
                className={`px-4 py-2.5 rounded-2xl border-2 text-sm font-extrabold flex items-center gap-2 cursor-pointer ${
                  instrument === inst.id
                    ? 'bg-[#FFD84D] border-[#27345C] text-[#27345C]'
                    : 'bg-[#FFF8E9] border-transparent text-[#27345C]/80'
                }`}
              >
                <span>{inst.emoji}</span>
                <span>{language === 'ar' ? inst.ar : inst.en}</span>
              </button>
            ))}
          </div>

          {/* 6 Musical Keys */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3" dir="ltr">
            {[
              { note: 'Do', color: '#FF4D6D' },
              { note: 'Re', color: '#FF9360' },
              { note: 'Mi', color: '#FFD84D' },
              { note: 'Fa', color: '#55D98B' },
              { note: 'Sol', color: '#39BDF2' },
              { note: 'La', color: '#8054D9' },
            ].map((key, idx) => (
              <button
                key={key.note}
                type="button"
                onClick={() => {
                  soundEngine.playInstrument(instrument, idx);
                  setActiveNoteIdx(idx);
                  setIsDancing(true);
                  window.setTimeout(() => setActiveNoteIdx(null), 320);
                }}
                style={{ backgroundColor: key.color }}
                className={`nono-btn-tactile h-24 rounded-3xl text-white font-extrabold text-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-transform ${
                  activeNoteIdx === idx ? 'scale-105 ring-4 ring-white' : ''
                }`}
              >
                <span>🎵</span>
                <span>{key.note}</span>
              </button>
            ))}
          </div>

          {/* Live 6-Character Dance Stage */}
          <div className="rounded-3xl bg-gradient-to-r from-[#E5F6FF] via-[#F3E8FF] to-[#FFE6F2] p-6 border border-[#27345C]/10">
            <p className="text-xs font-extrabold text-center text-[#27345C]/70 mb-4">
              {language === 'ar' ? 'مسرح رقص الأصدقاء الستة' : 'Six Friends Dance Stage'}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {FUN_CHARACTERS.map((ch, idx) => (
                <motion.button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playInstrument(instrument, idx);
                    soundEngine.speak(t(ch.name, language), language);
                    setIsDancing(true);
                  }}
                  animate={
                    isDancing
                      ? { y: [0, -12, 0], rotate: [0, idx % 2 === 0 ? 8 : -8, 0] }
                      : { y: 0, rotate: 0 }
                  }
                  transition={
                    isDancing
                      ? { repeat: Infinity, duration: 0.55, delay: idx * 0.08 }
                      : { duration: 0.2 }
                  }
                  className="p-3 rounded-2xl bg-white/85 shadow-sm flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span className="text-4xl">{ch.emoji}</span>
                  <span className="text-xs font-extrabold text-[#27345C]">{t(ch.name, language)}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 3: FUNNY MOMENTS & STORY TIME THEATER
      =================================================== */}
      {tab === 'funny-moments' && (
        <div className="space-y-5">
          <div className="nono-card rounded-3xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'مسرح اللحظات المضحكة' : 'Funny Moments Comedy Theater'}
                </h2>
                <p className="text-sm text-[#27345C]/75">
                  {language === 'ar'
                    ? 'شاهد مواقف نونو وأصدقائه الكوميدية واضغط للاستماع والمؤثرات!'
                    : 'Watch animated skits with Nono & friends — tap to hear narration & comedy effects!'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('stories')}
                className="px-4 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                {language === 'ar' ? 'افتح القصص التفاعلية 📖' : 'Open Interactive Stories 📖'}
              </button>
            </div>

            {/* Skit Selector */}
            <div className="flex flex-wrap gap-2">
              {FUNNY_MOMENTS.map((sk, idx) => (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => {
                    setSkitIdx(idx);
                    setBeatIdx(0);
                    soundEngine.playPop();
                  }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 cursor-pointer ${
                    skitIdx === idx
                      ? 'bg-[#FF78B7] text-white border-[#FF78B7]'
                      : 'bg-[#FFF8E9] text-[#27345C] border-transparent'
                  }`}
                >
                  {sk.characters.join('')} {t(sk.title, language)}
                </button>
              ))}
            </div>

            {/* Skit Stage */}
            <motion.div
              key={`${currentSkit.id}-${beatIdx}`}
              initial={{ opacity: 0.7, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl bg-gradient-to-br from-[#FFF8E9] to-[#E5F6FF] p-8 border-2 border-[#27345C]/10 text-center space-y-4"
            >
              <div className="text-6xl sm:text-7xl tracking-wider">{currentBeat.emojiScene}</div>
              <p className="text-lg sm:text-xl font-extrabold text-[#27345C] max-w-xl mx-auto">
                {t(currentBeat.caption, language)}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentBeat.sound === 'drum') soundEngine.playInstrument('drum', 1);
                    else if (currentBeat.sound === 'bell') soundEngine.playInstrument('bell', 3);
                    else if (currentBeat.sound === 'success') soundEngine.playSuccess();
                    else soundEngine.playPop();
                    soundEngine.speak(t(currentBeat.caption, language), language);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#27345C]/15 font-bold text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-[#8054D9]" />
                  <span>{language === 'ar' ? 'اسمع المشهد' : 'Hear Scene'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = (beatIdx + 1) % currentSkit.beats.length;
                    setBeatIdx(next);
                    soundEngine.playPop();
                    if (next === currentSkit.beats.length - 1) {
                      grantFunReward(1);
                    }
                  }}
                  className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#FFD84D] text-[#27345C] font-extrabold text-sm cursor-pointer"
                >
                  {beatIdx < currentSkit.beats.length - 1
                    ? language === 'ar'
                      ? 'المشهد التالي →'
                      : 'Next Beat →'
                    : language === 'ar'
                      ? 'إعادة العرض ↺'
                      : 'Replay Skit ↺'}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 4: DRESS UP & CHARACTER CUSTOMIZATION (ALL 6)
      =================================================== */}
      {tab === 'dress-up' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Character Preview Stage */}
          <div className="lg:col-span-5 nono-card rounded-3xl p-6 flex flex-col items-center justify-between space-y-5">
            <div className="flex flex-wrap justify-center gap-2">
              {FUN_CHARACTERS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setDressCharId(ch.id);
                    soundEngine.playPop();
                  }}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    dressCharId === ch.id
                      ? 'border-[#8054D9] bg-[#F3E8FF] text-[#27345C]'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="text-lg">{ch.emoji}</span>
                  <span>{t(ch.name, language)}</span>
                </button>
              ))}
            </div>

            {/* Layered Dress-Up Stage */}
            <div
              className="w-full max-w-xs aspect-square rounded-[2rem] border-4 border-white shadow-inner flex flex-col items-center justify-center relative overflow-hidden"
              style={{ backgroundColor: activeOutfit.backdropColor }}
            >
              {/* Hat */}
              <div className="text-4xl h-10 flex items-center justify-center">
                {DRESS_UP_OPTIONS.hats.find((h) => h.id === activeOutfit.hat)?.emoji}
              </div>
              {/* Character + Accessory */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-7xl drop-shadow-sm">{selectedFunChar.emoji}</span>
                <span className="text-4xl">
                  {DRESS_UP_OPTIONS.accessories.find((a) => a.id === activeOutfit.accessory)?.emoji}
                </span>
              </div>
              {/* Outfit */}
              <div className="text-4xl mt-1">
                {DRESS_UP_OPTIONS.outfits.find((o) => o.id === activeOutfit.outfit)?.emoji}
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-[#27345C]">
                {t(selectedFunChar.name, language)}
              </h3>
              <p className="text-xs font-bold text-[#8054D9]">{t(selectedFunChar.tagline, language)}</p>
            </div>
          </div>

          {/* Customization Controls */}
          <div className="lg:col-span-7 nono-card rounded-3xl p-6 space-y-5">
            <h2 className="text-xl font-extrabold text-[#27345C]">
              {language === 'ar'
                ? `اختر ملابس وإكسسوارات ${t(selectedFunChar.name, language)}`
                : `Customize ${t(selectedFunChar.name, language)}'s Look`}
            </h2>

            {/* Hats */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#27345C]/70">
                {language === 'ar' ? 'القبعة:' : 'Hat:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {DRESS_UP_OPTIONS.hats.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => updateCharacterOutfit(dressCharId, { hat: h.id })}
                    className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer ${
                      activeOutfit.hat === h.id
                        ? 'border-[#8054D9] bg-[#F3E8FF]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {h.emoji} {t(h.label, language)}
                  </button>
                ))}
              </div>
            </div>

            {/* Outfits */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#27345C]/70">
                {language === 'ar' ? 'الزي:' : 'Outfit:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {DRESS_UP_OPTIONS.outfits.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => updateCharacterOutfit(dressCharId, { outfit: o.id })}
                    className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer ${
                      activeOutfit.outfit === o.id
                        ? 'border-[#FF78B7] bg-[#FFE6F2]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {o.emoji} {t(o.label, language)}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#27345C]/70">
                {language === 'ar' ? 'الإكسسوار:' : 'Accessory:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {DRESS_UP_OPTIONS.accessories.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => updateCharacterOutfit(dressCharId, { accessory: a.id })}
                    className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer ${
                      activeOutfit.accessory === a.id
                        ? 'border-[#39BDF2] bg-[#E5F6FF]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {a.emoji} {t(a.label, language)}
                  </button>
                ))}
              </div>
            </div>

            {/* Backdrops */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[#27345C]/70">
                {language === 'ar' ? 'لون الخلفية:' : 'Backdrop Color:'}
              </p>
              <div className="flex flex-wrap gap-3">
                {DRESS_UP_OPTIONS.backdrops.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    aria-label={bg}
                    onClick={() => updateCharacterOutfit(dressCharId, { backdropColor: bg })}
                    style={{ backgroundColor: bg }}
                    className={`w-10 h-10 rounded-full border-4 cursor-pointer ${
                      activeOutfit.backdropColor === bg ? 'border-[#27345C] scale-110' : 'border-white shadow'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 5: INTERACTIVE VIRTUAL PLAYGROUND
      =================================================== */}
      {tab === 'playground' && (
        <div className="nono-card rounded-3xl p-6 space-y-5 bg-gradient-to-b from-[#E5F6FF] via-[#FFF8E9] to-[#E2F9EC]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-extrabold text-[#27345C]">
                {language === 'ar' ? 'حديقة نونو التفاعلية' : "Nono's Virtual Playground"}
              </h2>
              <p className="text-sm text-[#27345C]/75">
                {language === 'ar'
                  ? 'اضغط على أي مكان أو صديق في الحديقة لتكتشف المفاجآت المضحكة!'
                  : 'Tap any playground spot or character to trigger cheerful surprises!'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: 'swing',
                emoji: '🛝🦊',
                title: { ar: 'أرجوحة وزحليقة نونو', en: 'Swing & Slide' },
                msg: { ar: 'ويييي! انزلق نونو ولولو في قوس قزح!', en: 'Wheee! Nono and Lolo zoomed down the slide!' },
                sound: 'xylophone' as const,
                rewardId: 'pg-swing',
              },
              {
                id: 'treehouse',
                emoji: '🌳🎶',
                title: { ar: 'بيت الشجرة الموسيقي', en: 'Music Treehouse' },
                msg: { ar: 'تغرد العصافير مع عزف بوبو وإيلي!', en: 'Little birds sang along with Bobo & Ellie!' },
                sound: 'flute' as const,
                rewardId: 'pg-tree',
              },
              {
                id: 'picnic',
                emoji: '🧺🍓',
                title: { ar: 'بساط النزهة السري', en: 'Secret Picnic Blanket' },
                msg: { ar: 'مفاجأة! فراولة وعسل يتقاسمهما الأصدقاء!', en: 'Surprise! Fresh strawberries and honey to share!' },
                sound: 'drum' as const,
                rewardId: 'pg-picnic',
              },
              {
                id: 'fountain',
                emoji: '⛲⭐',
                title: { ar: 'نافورة النجوم السحرية', en: 'Magic Star Fountain' },
                msg: { ar: 'تششش! فقاعات النجوم تطير حول تيتي وليو!', en: 'Splash! Golden star bubbles floated around Titi & Leo!' },
                sound: 'bell' as const,
                rewardId: 'pg-fountain',
              },
            ].map((zone) => (
              <motion.button
                key={zone.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleZoneTap(zone.id, zone.msg, zone.sound, zone.rewardId)}
                className={`p-6 rounded-3xl bg-white border-2 text-center space-y-3 cursor-pointer shadow-sm transition-all ${
                  playgroundActiveZone === zone.id ? 'border-[#8054D9] scale-[1.02]' : 'border-[#27345C]/10'
                }`}
              >
                <div className="text-5xl">{zone.emoji}</div>
                <p className="font-extrabold text-base text-[#27345C]">{t(zone.title, language)}</p>
              </motion.button>
            ))}
          </div>

          {playgroundMessage && (
            <div className="p-4 rounded-2xl bg-white border-2 border-[#FFD84D] text-center font-extrabold text-[#27345C]">
              ✨ {t(playgroundMessage, language)}
            </div>
          )}

          {/* Say Hello to Friends */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {FUN_CHARACTERS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  soundEngine.speak(
                    language === 'ar'
                      ? `مرحباً! أنا ${ch.name.ar}`
                      : `Hi friend! I am ${ch.name.en}!`,
                    language,
                  );
                }}
                className="px-4 py-2 rounded-2xl bg-white border border-[#27345C]/12 font-bold text-xs sm:text-sm flex items-center gap-2 hover:border-[#8054D9] cursor-pointer"
              >
                <span className="text-2xl">{ch.emoji}</span>
                <span>{t(ch.name, language)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================
          TAB 6: NONOLAND ON YOUTUBE — WATCH & ENJOY (@Future-p6l)
      =================================================== */}
      {tab === 'youtube' && (
        <div className="space-y-5">
          <div className="nono-card rounded-3xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#27345C] flex items-center gap-2.5">
                  <NonoLandLogo variant="compact" size="sm" showWordmark={false} language={language} />
                  <Film className="w-7 h-7 text-[#FF4D6D]" />
                  <span>
                    {language === 'ar'
                      ? 'نونو لاند على يوتيوب — شاهد واستمتع'
                      : 'NonoLand on YouTube — Watch & Enjoy'}
                  </span>
                </h2>
                <p className="text-sm font-bold text-[#8054D9]">
                  {t(OFFICIAL_YOUTUBE_CHANNEL.channelName, language)} ·{' '}
                  <span dir="ltr">{OFFICIAL_YOUTUBE_CHANNEL.handle}</span>
                </p>
              </div>

              {/* Parent-Gated Visit Official Channel Action */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  setShowChannelGate(true);
                  setChannelGateInput('');
                  setChannelGateError(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#27345C] text-white text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#FFD84D]" />
                <span>
                  {language === 'ar'
                    ? 'زيارة القناة الرسمية (بموافقة الأهل)'
                    : 'Visit Official Channel (Parent Gate)'}
                </span>
              </button>
            </div>

            {/* Child-Safety Notice */}
            <div className="p-4 rounded-2xl bg-[#E2F9EC] border border-[#55D98B]/50 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#27345C] shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-[#27345C]/85 leading-relaxed">
                {t(OFFICIAL_YOUTUBE_CHANNEL.safetyNotice, language)}
              </p>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all' as const, ar: 'الكل', en: 'All' },
                { id: 'stories' as const, ar: 'قصص', en: 'Stories' },
                { id: 'cartoons' as const, ar: 'رسوم تعليمية', en: 'Educational Cartoons' },
                { id: 'songs' as const, ar: 'أغاني أصلية', en: 'Original Songs' },
                { id: 'adventures' as const, ar: 'مغامرات', en: 'Adventures' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setYtCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${
                    ytCategory === cat.id
                      ? 'bg-[#FF4D6D] text-white'
                      : 'bg-[#FFF8E9] text-[#27345C]/80'
                  }`}
                >
                  {language === 'ar' ? cat.ar : cat.en}
                </button>
              ))}
            </div>

            {/* Approved Curated Videos Grid (NEVER fabricated!) */}
            {approvedVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvedVideos.map((vid) => (
                  <div
                    key={vid.id}
                    className="rounded-3xl bg-[#FFF8E9] border border-[#27345C]/12 overflow-hidden flex flex-col justify-between"
                  >
                    <div className="aspect-video bg-[#27345C] relative flex items-center justify-center">
                      <img
                        src={`https://i.ytimg.com/vi/${encodeURIComponent(vid.videoId)}/hqdefault.jpg`}
                        alt={t(vid.title, language)}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveVideo(vid)}
                        aria-label={t(vid.title, language)}
                        className="absolute inset-0 bg-black/25 hover:bg-black/35 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="w-14 h-14 rounded-full bg-[#FF4D6D] text-white flex items-center justify-center shadow-lg">
                          <Play className="w-6 h-6 fill-white" />
                        </span>
                      </button>
                    </div>
                    <div className="p-4 space-y-2">
                      {vid.featured && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FF9360]">
                          <Star className="w-3.5 h-3.5 fill-[#FFD84D]" />
                          {language === 'ar' ? 'فيديو مميز' : 'Featured'}
                        </span>
                      )}
                      <h3 className="font-extrabold text-sm text-[#27345C]">
                        {t(vid.title, language)}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveVideo(vid)}
                        className="w-full py-2 rounded-xl bg-[#8054D9] text-white text-xs font-bold cursor-pointer"
                      >
                        {language === 'ar' ? 'شاهد في المشغل الآمن' : 'Watch in Safe Player'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#FFF8E9] border-2 border-dashed border-[#27345C]/20 p-7 text-center space-y-3">
                <Tv className="w-10 h-10 text-[#8054D9] mx-auto" />
                <h3 className="text-lg font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? 'لم يضف الأهل فيديوهات معتمدة بعد'
                    : 'No Parent-Approved Videos Added Yet'}
                </h3>
                <p className="text-sm text-[#27345C]/75 max-w-xl mx-auto leading-relaxed">
                  {ytApiStatus.configured
                    ? language === 'ar'
                      ? 'تم الاتصال بخدمة يوتيوب، ويمكن للأهل الآن اعتماد الفيديوهات من منطقة الأهل.'
                      : 'YouTube API is configured; parents can review and approve channel uploads from the Parent Dashboard.'
                    : language === 'ar'
                      ? 'حفاظاً على المصداقية وسلامة طفلك، لا نعرض مقاطع أو إحصائيات وهمية. يمكن للأهل إضافة معرّفات الفيديوهات الحقيقية من قناة @Future-p6l (أو تفعيل YOUTUBE_API_KEY على الخادم) من داخل منطقة الأهل.'
                      : 'To keep content authentic and child-safe, NonoLand never displays invented videos or channel stats. Parents can add verified video IDs from @Future-p6l (or configure YOUTUBE_API_KEY on the server) inside the Parent Dashboard.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('parent-dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-[#27345C] text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {language === 'ar' ? 'فتح إدارة الفيديوهات في منطقة الأهل' : 'Manage Curated Videos in Parent Area'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safe Embedded Video Player Modal (No comments / No related videos / Privacy-Enhanced) */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#27345C] text-white">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <CheckCircle2 className="w-4 h-4 text-[#55D98B]" />
                <span>{t(activeVideo.title, language)}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                aria-label="Close video"
                className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                title={t(activeVideo.title, language)}
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(activeVideo.videoId)}?rel=0&modestbranding=1`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Parent-Gated Channel Visit Modal */}
      {showChannelGate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md nono-card rounded-3xl p-6 space-y-4 text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowChannelGate(false);
                  setChannelGateUnlocked(false);
                }}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!channelGateUnlocked ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#27345C] text-[#FFD84D] flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'بوابة الأهل قبل مغادرة التطبيق' : 'Parental Gate Before External Visit'}
                </h3>
                <p className="text-xs text-[#27345C]/75">
                  {t(OFFICIAL_YOUTUBE_CHANNEL.safetyNotice, language)}
                </p>
                <div className="p-3 rounded-2xl bg-[#FFF8E9] font-mono-num text-xl font-extrabold">
                  6 × 3 = ?
                </div>
                <input
                  type="number"
                  value={channelGateInput}
                  onChange={(e) => setChannelGateInput(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل الناتج' : 'Enter answer'}
                  className="w-full h-11 px-4 rounded-xl border-2 border-[#27345C]/15 text-center font-mono-num font-bold"
                />
                {channelGateError && (
                  <p className="text-xs font-bold text-[#FF4D6D]">
                    {language === 'ar' ? 'حاول مجدداً!' : 'Please try again!'}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (Number(channelGateInput.trim()) === 18) {
                      soundEngine.playSuccess();
                      setChannelGateUnlocked(true);
                      setChannelGateError(false);
                    } else {
                      soundEngine.playEncourage();
                      setChannelGateError(true);
                    }
                  }}
                  className="w-full nono-btn-tactile h-11 rounded-xl bg-[#27345C] text-white font-bold text-sm cursor-pointer"
                >
                  {language === 'ar' ? 'تأكيد الأهل' : 'Verify Parent'}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <CheckCircle2 className="w-12 h-12 text-[#55D98B] mx-auto" />
                <h3 className="text-xl font-extrabold text-[#27345C]">
                  {language === 'ar' ? 'تم التحقق — رابط القناة الرسمية' : 'Verified — Official Channel Link'}
                </h3>
                <p className="text-xs text-[#27345C]/75">
                  {OFFICIAL_YOUTUBE_CHANNEL.url}
                </p>
                <a
                  href={OFFICIAL_YOUTUBE_CHANNEL.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nono-btn-tactile w-full h-12 rounded-2xl bg-[#FF4D6D] text-white font-extrabold text-sm flex items-center justify-center gap-2"
                >
                  <span>{language === 'ar' ? 'افتح قناة @Future-p6l على يوتيوب' : 'Open @Future-p6l on YouTube'}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
