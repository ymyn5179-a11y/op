import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, List, Lock, Map as MapIcon, Play, Sparkles, Star } from 'lucide-react';
import mapPanoramaImg from '../assets/images/adventure_map_panorama_1794739848578.jpg';
import { NonoCharacter } from '../components/NonoCharacter';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { getActivitiesForWorldAndAge } from '../data/activities';
import { getWorldById, LEARNING_WORLDS } from '../data/worlds';
import { getAdventureMapProgress } from '../engine/adaptiveEngine';
import { formatNumber, getAgeGroupMeta, t, UI_COPY } from '../i18n/translations';
import { soundEngine } from '../utils/soundEngine';

export const AdventureMapScreen: React.FC = () => {
  const { activeChild, language, navigate } = useNonoLand();
  const [hoveredWorldId, setHoveredWorldId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [lockedMessage, setLockedMessage] = useState<string>('');

  if (!activeChild) return null;

  const mapProgress = getAdventureMapProgress(activeChild);
  const progressByWorld = new Map(mapProgress.map((p) => [p.world.id, p]));

  const handleOpenWorld = (worldId: typeof LEARNING_WORLDS[number]['id']) => {
    const prog = progressByWorld.get(worldId);
    const world = getWorldById(worldId);
    if (prog && prog.status === 'upcoming') {
      const msg = t(prog.unlockRequirementLabel, language);
      setLockedMessage(msg);
      soundEngine.playEncourage();
      soundEngine.speak(msg, language);
      return;
    }
    setLockedMessage('');
    soundEngine.speak(t(world.name, language), language);
    navigate('world-detail', { worldId });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <NonoLandLogo variant="compact" size="md" showWordmark={false} language={language} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2.5">
              <Compass className="w-7 h-7 text-[#8054D9]" />
              <span>{t(UI_COPY.nav.map, language)}</span>
            </h1>
            <p className="text-sm text-[#27345C]/75 mt-0.5">
              {language === 'ar'
                ? 'استكشف الجزر المتاحة وأكمل مهاراتك لفتح المغامرات القادمة!'
                : 'Explore unlocked islands and build real skills to unlock new horizons!'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-[#27345C]/12">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'map' ? 'bg-[#8054D9] text-white' : 'text-[#27345C]/75'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>{language === 'ar' ? 'عرض الخريطة' : 'Map View'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list' ? 'bg-[#8054D9] text-white' : 'text-[#27345C]/75'
              }`}
            >
              <List className="w-4 h-4" />
              <span>{language === 'ar' ? 'عرض القائمة' : 'List View'}</span>
            </button>
          </div>
          <span className="text-xs sm:text-sm font-bold text-[#8054D9]">
            {t(getAgeGroupMeta(activeChild.ageGroup).label, language)} ·{' '}
            {formatNumber(LEARNING_WORLDS.length, language)} {language === 'ar' ? 'عوالم' : 'Worlds'}
          </span>
        </div>
      </div>

      {lockedMessage && (
        <div className="p-4 rounded-2xl bg-[#FFF3D1] border-2 border-[#FFD84D] text-[#78350F] text-sm font-extrabold flex items-center gap-2">
          <Lock className="w-5 h-5 shrink-0" />
          <span>{lockedMessage}</span>
        </div>
      )}

      {/* Panoramic Animated Archipelago Canvas (Shown in Map View) */}
      {viewMode === 'map' && (
        <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-xl bg-[#A3E4FF]">
          <div className="relative aspect-[16/9] min-h-[340px] w-full">
            <img
              src={mapPanoramaImg}
              alt={language === 'ar' ? 'خريطة عوالم نونو لاند العشرة' : 'NonoLand 10 Worlds Map'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />

            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div className="absolute top-6 start-8 text-2xl animate-drift-cloud opacity-85">☁️</div>
              <div className="absolute top-12 end-16 text-2xl animate-drift-cloud opacity-80" style={{ animationDelay: '-5s' }}>☁️</div>
              <div className="absolute bottom-8 start-1/3 text-xl animate-gentle-bob">⛵</div>
              <div className="absolute top-1/4 start-1/2 text-lg animate-twinkle">✨</div>
            </div>

            {/* Connected Adventure Trail SVG linking islands sequentially */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 w-full h-full z-[5]"
              aria-hidden="true"
            >
              {LEARNING_WORLDS.slice(0, -1).map((w, idx) => {
                const next = LEARNING_WORLDS[idx + 1];
                const wp = progressByWorld.get(next.id);
                const unlocked = !wp || wp.status !== 'upcoming';
                return (
                  <line
                    key={`${w.id}-${next.id}`}
                    x1={w.mapPosition.x}
                    y1={w.mapPosition.y}
                    x2={next.mapPosition.x}
                    y2={next.mapPosition.y}
                    stroke={unlocked ? '#FFD84D' : 'rgba(255,255,255,0.55)'}
                    strokeWidth="0.65"
                    strokeDasharray="1.8 1.4"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {LEARNING_WORLDS.map((world, idx) => {
              const wp = progressByWorld.get(world.id);
              const status = wp?.status || 'available';
              const isLocked = status === 'upcoming';
              const isDone = status === 'completed';
              const isHovered = hoveredWorldId === world.id;

              return (
                <motion.button
                  key={world.id}
                  type="button"
                  onClick={() => handleOpenWorld(world.id)}
                  onMouseEnter={() => setHoveredWorldId(world.id)}
                  onMouseLeave={() => setHoveredWorldId(null)}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, y: isLocked ? 0 : [0, -4, 0] }}
                  transition={{
                    y: { duration: 3 + (idx % 3), repeat: Infinity, ease: 'easeInOut' },
                    opacity: { duration: 0.3, delay: idx * 0.04 },
                  }}
                  style={{
                    left: `${world.mapPosition.x}%`,
                    top: `${world.mapPosition.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute z-10 group cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD84D] rounded-2xl"
                >
                  <div
                    className={`min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border-2 shadow-lg transition-transform ${
                      isLocked ? 'bg-slate-100/95 opacity-85' : 'bg-white/95'
                    } ${isHovered ? 'scale-110' : 'group-hover:scale-105'}`}
                    style={{ borderColor: isLocked ? '#94A3B8' : world.primaryColor }}
                  >
                    <span className="text-lg sm:text-xl leading-none">{world.guardianEmoji}</span>
                    <span className="hidden md:inline text-xs font-extrabold text-[#27345C] whitespace-nowrap">
                      {t(world.name, language)}
                    </span>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-extrabold text-[#8054D9] tabular-nums">
                        {wp?.progressPercent || 0}%
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Connected Interactive Destinations Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { screen: 'brain-games' as const, emoji: '🧠', ar: 'ألعاب الذكاء والتركيز', en: 'Brain Games (9)', bg: 'from-[#F3E8FF] to-white' },
          { screen: 'creative-studio' as const, emoji: '🎨', ar: 'استوديو الإبداع', en: 'Creative Studio', bg: 'from-[#FFE6F2] to-white' },
          { screen: 'my-pet' as const, emoji: '🐾', ar: 'صديقي الأليف', en: 'My Virtual Pet', bg: 'from-[#E2F9EC] to-white' },
          { screen: 'reward-shop' as const, emoji: '🛍️', ar: 'متجر الجوائز بالنجوم', en: 'Star Reward Shop', bg: 'from-[#FFF3D1] to-white' },
        ].map((dest) => (
          <button
            key={dest.screen}
            type="button"
            onClick={() => {
              soundEngine.playPop();
              navigate(dest.screen);
            }}
            className={`nono-card rounded-2xl p-3.5 bg-gradient-to-br ${dest.bg} flex items-center gap-3 text-start hover:border-[#8054D9] transition-colors cursor-pointer min-h-[56px]`}
          >
            <span className="text-2xl shrink-0">{dest.emoji}</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#27345C]">
              {language === 'ar' ? dest.ar : dest.en}
            </span>
          </button>
        ))}
      </div>

      {/* Accessible 10-World Grid / List Directory with Color + Icon + Label States */}
      <div className={viewMode === 'list' ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'}>
        {LEARNING_WORLDS.map((world) => {
          const ageActs = getActivitiesForWorldAndAge(world.id, activeChild.ageGroup);
          const wp = progressByWorld.get(world.id);
          const status = wp?.status || 'available';
          const isLocked = status === 'upcoming';
          const isDone = status === 'completed';

          const badge = isDone
            ? { bg: 'bg-[#55D98B]/25 text-[#14532D]', icon: <CheckCircle2 className="w-3.5 h-3.5" />, ar: 'مكتمل', en: 'Completed' }
            : isLocked
              ? { bg: 'bg-slate-200 text-slate-700', icon: <Lock className="w-3.5 h-3.5" />, ar: 'قادم', en: 'Upcoming' }
              : { bg: 'bg-[#8054D9]/15 text-[#8054D9]', icon: <Sparkles className="w-3.5 h-3.5" />, ar: 'متاح الآن', en: 'Available' };

          return (
            <button
              key={world.id}
              type="button"
              onClick={() => handleOpenWorld(world.id)}
              className={`nono-card rounded-3xl p-4 text-start bg-gradient-to-br ${
                isLocked ? 'from-slate-100 to-white opacity-85' : world.bgGradient
              } hover:-translate-y-0.5 transition-transform cursor-pointer flex ${
                viewMode === 'list' ? 'flex-row items-center justify-between gap-4' : 'flex-col justify-between'
              }`}
            >
              <div className={viewMode === 'list' ? 'flex items-center gap-4 flex-1' : ''}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-white shadow-sm border shrink-0"
                    style={{ borderColor: `${world.primaryColor}40` }}
                  >
                    {world.guardianEmoji}
                  </span>
                  {viewMode !== 'list' && (
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 ${badge.bg}`}>
                      {badge.icon}
                      <span>{language === 'ar' ? badge.ar : badge.en}</span>
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#27345C] mt-2">
                    {t(world.name, language)}
                  </h3>
                  <p className="text-xs text-[#27345C]/70 mt-0.5 line-clamp-2">
                    {isLocked && wp ? t(wp.unlockRequirementLabel, language) : t(world.subtitle, language)}
                  </p>
                </div>
              </div>

              <div className={`${viewMode === 'list' ? 'w-44 shrink-0' : 'mt-4 pt-2.5 border-t border-[#27345C]/10'} space-y-1.5`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span style={{ color: isLocked ? '#475569' : world.primaryColor }}>
                    {ageActs.length} {language === 'ar' ? 'أنشطة لعمرك' : 'for your age'}
                  </span>
                  <span className="tabular-nums text-[#27345C]">
                    {wp?.completedCount || 0}/{wp?.totalCount || 0} ({wp?.progressPercent || 0}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${wp?.progressPercent || 0}%`,
                      backgroundColor: isLocked ? '#94A3B8' : world.primaryColor,
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const WorldDetailScreen: React.FC = () => {
  const { selectedWorldId, activeChild, language, navigate } = useNonoLand();
  if (!activeChild) return null;
  const world = getWorldById(selectedWorldId);
  const ageActivities = getActivitiesForWorldAndAge(
    world.id,
    activeChild.ageGroup,
    activeChild.birthYear,
    activeChild.birthMonth,
  );
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('map')}
        className="inline-flex items-center gap-2 text-sm font-bold text-[#27345C]/80 hover:text-[#27345C] cursor-pointer"
      >
        <BackIcon className="w-4 h-4" />
        <span>{language === 'ar' ? 'العودة لخريطة العوالم' : 'Back to Adventure Map'}</span>
      </button>

      {/* World Hero Banner */}
      <section
        className={`rounded-[2rem] p-6 sm:p-8 border-2 border-white shadow-lg bg-gradient-to-br ${world.bgGradient}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold" style={{ color: world.primaryColor }}>
              <span>{world.guardianEmoji} {t(world.guardianName, language)}</span>
              <span>·</span>
              <span>{t(getAgeGroupMeta(activeChild.ageGroup).label, language)}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#27345C]">
              {t(world.name, language)}
            </h1>
            <p className="text-[#27345C]/80 text-base leading-relaxed">
              {t(world.description, language)}
            </p>
          </div>
          <div className="md:col-span-4 flex justify-center">
            <NonoCharacter
              mood="excited"
              scarfColor={world.primaryColor}
              size="md"
              speechBubble={
                language === 'ar'
                  ? `أهلاً بك في ${world.name.ar}!`
                  : `Welcome to ${world.name.en}!`
              }
              language={language}
            />
          </div>
        </div>
      </section>

      {/* Age-Tailored Levels & Activities */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#27345C] flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: world.primaryColor }} />
          <span>
            {language === 'ar'
              ? `مهام ومستويات مناسبة لـ ${t(getAgeGroupMeta(activeChild.ageGroup).label, language)}`
              : `Missions Tailored for ${t(getAgeGroupMeta(activeChild.ageGroup).label, language)}`}
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ageActivities.map((act) => {
            const done = activeChild.completedActivityIds.includes(act.id);
            return (
              <div
                key={act.id}
                className="nono-card rounded-3xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span style={{ color: world.primaryColor }}>
                      {t(UI_COPY.home.levelLabel, language)} {formatNumber(act.level, language)} ·{' '}
                      {t(UI_COPY.games.ageTailored, language)}
                    </span>
                    {done && (
                      <span className="inline-flex items-center gap-1 text-[#55D98B] font-extrabold">
                        <CheckCircle2 className="w-4 h-4" />
                        {t(UI_COPY.games.completedBadge, language)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold text-[#27345C]">{t(act.title, language)}</h3>
                  <p className="text-sm text-[#27345C]/75">{t(act.objective, language)}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#27345C]/10">
                  <span className="text-xs font-bold text-[#27345C]/65 flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#FFD84D] text-[#FF9360]" />
                    +{done ? 1 : 3} {t(UI_COPY.home.starsLabel, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('game', { worldId: world.id, activityId: act.id })}
                    className="nono-btn-tactile px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
                    style={{ backgroundColor: world.primaryColor }}
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{t(UI_COPY.games.playNow, language)}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};
