import React from 'react';
import { ArrowLeft, ArrowRight, Play, RotateCw, Sparkles, Star } from 'lucide-react';
import { GameEngineRouter } from '../components/games/GameEngineRouter';
import { NonoCharacter } from '../components/NonoCharacter';
import { useNonoLand } from '../context/NonoLandContext';
import { getActivityById } from '../data/activities';
import { getWorldById } from '../data/worlds';
import { getAdaptiveRecommendation } from '../engine/adaptiveEngine';
import { formatNumber, SKILL_LABELS, t, UI_COPY } from '../i18n/translations';

export const GameArenaScreen: React.FC = () => {
  const {
    selectedActivityId,
    selectedWorldId,
    activeChild,
    language,
    navigate,
    recordGameAttempt,
    saveDrawingToRoom,
  } = useNonoLand();

  const activity = getActivityById(selectedActivityId);
  const world = getWorldById(activity?.worldId || selectedWorldId);
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft;

  if (!activeChild) return null;

  if (!activity) {
    return (
      <div className="nono-card rounded-3xl p-8 text-center">
        <p className="font-bold">{language === 'ar' ? 'لم يتم العثور على النشاط' : 'Activity not found'}</p>
        <button
          type="button"
          onClick={() => navigate('map')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#8054D9] text-white font-bold cursor-pointer"
        >
          {t(UI_COPY.nav.map, language)}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('world-detail', { worldId: world.id })}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#27345C]/80 hover:text-[#27345C] cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(UI_COPY.games.backToWorld, language)} · {t(world.name, language)}</span>
        </button>

        <span className="text-xs font-extrabold text-[#8054D9]">
          {t(SKILL_LABELS[activity.skillId], language)}
        </span>
      </div>

      <div className="nono-card rounded-[2rem] p-5 sm:p-8">
        <div className="mb-6 pb-4 border-b border-[#27345C]/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
              {t(activity.title, language)}
            </h1>
            <p className="text-sm text-[#27345C]/75 mt-0.5">{t(activity.instructions, language)}</p>
          </div>
          <span className="text-2xl">{world.guardianEmoji}</span>
        </div>

        <GameEngineRouter
          activity={activity}
          language={language}
          scarfColor={activeChild.companionScarfColor}
          onSaveDrawing={(dataUrl, title) => saveDrawingToRoom({ dataUrl, title })}
          onComplete={({ score, maxScore, durationSeconds }) => {
            recordGameAttempt({
              activityId: activity.id,
              worldId: world.id,
              skillId: activity.skillId,
              score,
              maxScore,
              durationSeconds,
            });
          }}
        />
      </div>
    </div>
  );
};

export const GameResultsScreen: React.FC = () => {
  const { lastAttempt, activeChild, language, navigate } = useNonoLand();
  if (!activeChild) return null;
  const rec = getAdaptiveRecommendation(activeChild);
  const recWorld = getWorldById(rec.worldId);
  const currentActivity = lastAttempt ? getActivityById(lastAttempt.activityId) : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="nono-card rounded-[2rem] p-6 sm:p-10 text-center space-y-5">
        <div className="flex justify-center">
          <NonoCharacter
            mood="celebrating"
            scarfColor={activeChild.companionScarfColor}
            size="md"
            language={language}
          />
        </div>

        <h1 className="text-3xl font-extrabold text-[#27345C]">
          {language === 'ar'
            ? `مغامرة رائعة يا ${activeChild.displayName}!`
            : `Awesome Adventure, ${activeChild.displayName}!`}
        </h1>

        {lastAttempt && (
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
            <div className="rounded-2xl bg-[#FFF8E9] p-3 border border-[#27345C]/10">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'النجوم المكتسبة' : 'Stars Earned'}
              </p>
              <p className="text-2xl font-extrabold text-[#FF9360] mt-1 tabular-nums flex items-center justify-center gap-1">
                <Star className="w-5 h-5 fill-[#FFD84D] text-[#FF9360]" />+{lastAttempt.starsEarned}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FFF8E9] p-3 border border-[#27345C]/10">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'الإتقان' : 'Accuracy'}
              </p>
              <p className="text-2xl font-extrabold text-[#55D98B] mt-1 font-mono-num">
                {formatNumber(lastAttempt.accuracy, language)}%
              </p>
            </div>
            <div className="rounded-2xl bg-[#FFF8E9] p-3 border border-[#27345C]/10">
              <p className="text-xs font-bold text-[#27345C]/65">
                {language === 'ar' ? 'المدة' : 'Time'}
              </p>
              <p className="text-2xl font-extrabold text-[#8054D9] mt-1 font-mono-num">
                {lastAttempt.durationSeconds}s
              </p>
            </div>
          </div>
        )}

        {/* Adaptive Next Recommendation */}
        <div className="rounded-3xl bg-gradient-to-br from-[#8054D9]/10 to-[#39BDF2]/15 p-5 border-2 border-[#8054D9]/25 text-start">
          <p className="text-xs font-extrabold text-[#8054D9] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>{t(UI_COPY.games.nextRecommended, language)}</span>
          </p>
          <h2 className="text-xl font-extrabold text-[#27345C] mt-1">
            {t(rec.activity.title, language)} · {t(recWorld.name, language)}
          </h2>
          <p className="text-sm text-[#27345C]/75 mt-1">{t(rec.reason, language)}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                navigate('game', { worldId: rec.worldId, activityId: rec.activity.id })
              }
              className="nono-btn-tactile px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-bold flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{t(UI_COPY.games.playNow, language)}</span>
            </button>
            {currentActivity && (
              <button
                type="button"
                onClick={() =>
                  navigate('game', {
                    worldId: currentActivity.worldId,
                    activityId: currentActivity.id,
                  })
                }
                className="px-5 py-3 rounded-2xl bg-white border border-[#27345C]/15 font-bold flex items-center gap-2 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>{t(UI_COPY.games.playAgain, language)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
