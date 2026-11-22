import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import type {
  InternalAgeBand,
  Language,
  QuranStoryProgressDetails,
  QuranStorySpec,
} from '../../types/nonoland';
import { formatNumber } from '../../i18n/translations';
import { QuranStoryPlayer } from './QuranStoryPlayer';
import { QuranSymbolicScene } from './QuranSymbolicScene';

interface Props {
  stories: QuranStorySpec[];
  language: Language;
  internalBand: InternalAgeBand;
  storyProgressDetails: QuranStoryProgressDetails[];
  legacyStoryCounts: Map<string, number>;
  childEnabled: boolean;
  quranSchemaReady: boolean;
  savingAction: boolean;
  onRecordStoryProgress: (payload: {
    storyId: string;
    action: 'start' | 'scene_progress' | 'interaction' | 'complete';
    sceneIndex: number;
    sceneId?: string;
    interactionId?: string;
    quizCompleted?: boolean;
    closingActivityCompleted?: boolean;
    listenedSecondsDelta?: number;
    audioCompleted?: boolean;
    completionToken?: string;
  }) => Promise<void> | void;
}

function formatDurationMinutes(seconds: number, language: Language): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return language === 'ar'
    ? `~${formatNumber(mins, 'ar')} دقائق`
    : `~${mins} min`;
}

export const QuranStoriesWorld: React.FC<Props> = ({
  stories,
  language,
  internalBand,
  storyProgressDetails,
  legacyStoryCounts,
  childEnabled,
  quranSchemaReady,
  savingAction,
  onRecordStoryProgress,
}) => {
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const detailMap = useMemo(() => {
    const map = new Map<string, QuranStoryProgressDetails>();
    for (const d of storyProgressDetails) {
      map.set(d.storyId, d);
    }
    return map;
  }, [storyProgressDetails]);

  const activeStory = useMemo(
    () => stories.find((s) => s.id === activeStoryId) || null,
    [stories, activeStoryId],
  );

  const completedCountTotal = useMemo(
    () =>
      stories.filter((s) => {
        const d = detailMap.get(s.id);
        const leg = legacyStoryCounts.get(s.id) || 0;
        return Boolean(d?.completed || (d?.completedCount || 0) > 0 || leg > 0);
      }).length,
    [stories, detailMap, legacyStoryCounts],
  );

  return (
    <div className="space-y-5">
      {/* Main Header Banner */}
      <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white border border-[#B4862C]/25 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] text-balance">
            حكايات من القرآن
          </h2>
          <p className="text-xs sm:text-sm font-bold text-[#27345C]/75">
            {language === 'ar'
              ? 'قصص هادئة من القرآن الكريم برسوم رمزية دافئة وتفاعلات ممتعة لعمر ١–٤ سنوات.'
              : 'Stories from the Quran — warm symbolic storytelling with gentle toddler activities (ages 1–4).'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#047857] tabular-nums">
          <BookOpen className="w-5 h-5" />
          <span>
            {language === 'ar'
              ? `${formatNumber(completedCountTotal, 'ar')} / ${formatNumber(stories.length, 'ar')} قصص مكتملة`
              : `${completedCountTotal} / ${stories.length} Stories Completed`}
          </span>
        </div>
      </div>

      {/* Curated 8-Story Illustrated Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {stories.map((story) => {
          const detail = detailMap.get(story.id);
          const legacyCompleted = legacyStoryCounts.get(story.id) || 0;
          const isCompleted = Boolean(
            detail?.completed || (detail?.completedCount || 0) > 0 || legacyCompleted > 0,
          );
          const totalScenes = Math.max(1, story.scenes?.length || 5);
          const isUnfinished = Boolean(
            detail && !isCompleted && (detail.startedAt || detail.lastSceneIndex > 0),
          );
          const pct = isCompleted
            ? 100
            : isUnfinished && detail
              ? Math.min(95, Math.max(15, Math.round(((detail.lastSceneIndex + 1) / totalScenes) * 100)))
              : 0;

          const surahRefText = story.surahReferences
            .map((r) => (language === 'ar' ? r.surahNameAr : r.surahNameEn))
            .slice(0, 1)
            .join('');

          return (
            <article
              key={story.id}
              className="nono-card rounded-3xl bg-white border border-[#B4862C]/25 overflow-hidden flex flex-col justify-between shadow-sm"
            >
              <div>
                {/* Large Illustrated Artwork Header */}
                <div className="relative aspect-video bg-[#FFF8E9] overflow-hidden">
                  {!failedImages[story.id] && story.coverImage ? (
                    <img
                      src={story.coverImage}
                      alt={story.title[language]}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [story.id]: true }))
                      }
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <QuranSymbolicScene
                      theme={story.symbolicTheme}
                      title={story.title[language]}
                      className="w-full h-full block"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
                </div>

                {/* Story Details */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-extrabold text-[#27345C] leading-snug">
                      {story.title[language]}
                    </h3>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#047857] shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{language === 'ar' ? 'مكتملة' : 'Completed'}</span>
                      </span>
                    )}
                  </div>

                  {/* Clean Metadata Row with Typographic Separators */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#27345C]/65 tabular-nums">
                    <span>{formatDurationMinutes(story.durationSeconds, language)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {language === 'ar'
                        ? `${formatNumber(totalScenes, 'ar')} مشاهد`
                        : `${totalScenes} scenes`}
                    </span>
                    {surahRefText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{surahRefText}</span>
                      </>
                    )}
                  </div>

                  <p className="text-sm font-bold text-[#27345C]/80 leading-relaxed">
                    {story.description[language]}
                  </p>

                  {/* Story Completion Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#27345C]/70 tabular-nums">
                      <span>
                        {isCompleted
                          ? language === 'ar'
                            ? `أتممتها ${formatNumber(Math.max(1, detail?.completedCount || legacyCompleted), 'ar')}×`
                            : `Completed ${Math.max(1, detail?.completedCount || legacyCompleted)}×`
                          : isUnfinished && detail
                            ? language === 'ar'
                              ? `توقفت عند المشهد ${formatNumber(detail.lastSceneIndex + 1, 'ar')} من ${formatNumber(totalScenes, 'ar')}`
                              : `Scene ${detail.lastSceneIndex + 1} of ${totalScenes}`
                            : language === 'ar'
                              ? 'قصة جديدة جاهزة للاستماع'
                              : 'Ready to begin'}
                      </span>
                      <span>
                        {language === 'ar' ? `${formatNumber(pct, 'ar')}٪` : `${pct}%`}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#27345C]/10 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isCompleted ? 'bg-[#047857]' : 'bg-[#D97706]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Toddler-Friendly Action Controls */}
              <div className="px-5 pb-5 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!childEnabled || !quranSchemaReady}
                  onClick={() => setActiveStoryId(story.id)}
                  className={`nono-btn-tactile min-h-[48px] flex-1 px-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 ${
                    isUnfinished
                      ? 'bg-[#D97706] text-white'
                      : isCompleted
                        ? 'bg-[#ECFDF5] border border-[#10B981]/35 text-[#065F46]'
                        : 'bg-[#047857] text-white'
                  }`}
                >
                  {isCompleted ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>
                    {isUnfinished
                      ? language === 'ar'
                        ? 'متابعة القصة'
                        : 'Continue Story'
                      : isCompleted
                        ? language === 'ar'
                          ? 'أعد الاستماع واللعب'
                          : 'Replay Story'
                        : language === 'ar'
                          ? 'تشغيل القصة'
                          : 'Play Story'}
                  </span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Dedicated Full-Screen Story Player */}
      {activeStory && (
        <QuranStoryPlayer
          story={activeStory}
          language={language}
          internalBand={internalBand}
          initialProgress={detailMap.get(activeStory.id)}
          savingAction={savingAction}
          childEnabled={childEnabled}
          onClose={() => setActiveStoryId(null)}
          onExploreAnotherStory={() => setActiveStoryId(null)}
          onRecordProgress={onRecordStoryProgress}
        />
      )}
    </div>
  );
};
