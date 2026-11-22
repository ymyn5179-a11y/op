import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  InternalAgeBand,
  Language,
  QuranStoryProgressDetails,
  QuranStorySpec,
} from '../../types/nonoland';
import { formatNumber } from '../../i18n/translations';
import { soundEngine } from '../../utils/soundEngine';
import {
  StoryAudioController,
  type StoryAudioStateSnapshot,
} from '../../utils/storyAudioController';
import { QuranStoryActivities } from './QuranStoryActivities';
import { QuranSymbolicScene } from './QuranSymbolicScene';

interface Props {
  story: QuranStorySpec;
  language: Language;
  internalBand: InternalAgeBand;
  initialProgress?: QuranStoryProgressDetails;
  previewMode?: boolean;
  savingAction?: boolean;
  childEnabled?: boolean;
  onClose: () => void;
  onExploreAnotherStory?: () => void;
  onRecordProgress: (payload: {
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

function formatClock(seconds: number, language: Language): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const raw = `${mins}:${secs.toString().padStart(2, '0')}`;
  return language === 'ar' ? formatNumber(mins, 'ar') + ':' + formatNumber(secs, 'ar').padStart(2, '٠') : raw;
}

export const QuranStoryPlayer: React.FC<Props> = ({
  story,
  language,
  internalBand,
  initialProgress,
  previewMode = false,
  savingAction = false,
  childEnabled = true,
  onClose,
  onExploreAnotherStory,
  onRecordProgress,
}) => {
  const scenes = story.scenes || [];
  const totalScenes = scenes.length;
  const resumeIndex =
    initialProgress &&
    !initialProgress.completed &&
    initialProgress.lastSceneIndex > 0 &&
    initialProgress.lastSceneIndex < totalScenes
      ? initialProgress.lastSceneIndex
      : 0;

  const [sceneIndex, setSceneIndex] = useState<number>(resumeIndex);
  const [inEnding, setInEnding] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [sfxMuted, setSfxMuted] = useState<boolean>(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [completedInteractions, setCompletedInteractions] = useState<Set<string>>(
    () => new Set(initialProgress?.interactionsCompleted || []),
  );
  const [quizAnsweredCorrect, setQuizAnsweredCorrect] = useState<boolean>(
    Boolean(initialProgress?.quizCompleted),
  );
  const [quizFeedback, setQuizFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [closingDone, setClosingDone] = useState<boolean>(
    Boolean(initialProgress?.closingActivityCompleted),
  );
  const [storyCompletedSaved, setStoryCompletedSaved] = useState<boolean>(false);
  const [audioSnap, setAudioSnap] = useState<StoryAudioStateSnapshot>({
    status: 'unavailable',
    currentTime: 0,
    duration: scenes[resumeIndex]?.durationSeconds || 35,
  });

  const audioCtrlRef = useRef<StoryAudioController | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const sceneEnteredAtRef = useRef<number>(Date.now());
  const completionTokenRef = useRef<string>(
    `st_${story.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  );

  if (!audioCtrlRef.current) {
    audioCtrlRef.current = new StoryAudioController();
  }

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const currentScene = scenes[sceneIndex] || scenes[0];
  const bandKey: 'young' | 'mid' | 'older' =
    internalBand === '1-2' ? 'young' : internalBand === '2-3' ? 'mid' : 'older';

  // Record story start once when player mounts cleanly
  useEffect(() => {
    setImgFailed(false);
    if (!previewMode && childEnabled) {
      void onRecordProgress({
        storyId: story.id,
        action: 'start',
        sceneIndex: resumeIndex,
        sceneId: scenes[resumeIndex]?.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // Cleanup ALL audio and timers on unmount or close so zero overlap or background leak occurs
  useEffect(() => {
    const ctrl = audioCtrlRef.current;
    return () => {
      clearAutoAdvanceTimer();
      ctrl?.stop();
      soundEngine.stopAllAudio();
    };
  }, [clearAutoAdvanceTimer]);

  const handleNextSceneRef = useRef<() => void>(() => {});

  const buildSceneAudioCallbacks = useCallback(
    (sc: NonNullable<typeof currentScene>, idx: number) => ({
      onStateChange: (snap: StoryAudioStateSnapshot) => setAudioSnap(snap),
      onEnded: () => {
        if (!previewMode && childEnabled) {
          void onRecordProgress({
            storyId: story.id,
            action: 'scene_progress',
            sceneIndex: idx,
            sceneId: sc.id,
            listenedSecondsDelta: Math.min(60, Math.round(sc.durationSeconds || 30)),
            audioCompleted: true,
          });
        }
        if (autoAdvance) {
          clearAutoAdvanceTimer();
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            handleNextSceneRef.current();
          }, 600);
        }
      },
    }),
    [autoAdvance, childEnabled, clearAutoAdvanceTimer, onRecordProgress, previewMode, story.id],
  );

  // Prepare audio state when active scene changes (NEVER auto-play on screen open!)
  useEffect(() => {
    const ctrl = audioCtrlRef.current;
    clearAutoAdvanceTimer();
    if (!ctrl || !currentScene || inEnding) {
      ctrl?.stop();
      return;
    }
    sceneEnteredAtRef.current = Date.now();
    ctrl.prepareScene(
      currentScene.narrationAudioUrl,
      currentScene.durationSeconds,
      buildSceneAudioCallbacks(currentScene, sceneIndex),
    );
    return () => {
      clearAutoAdvanceTimer();
      ctrl.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex, inEnding, story.id, currentScene?.id, currentScene?.narrationAudioUrl]);

  const flushCurrentSceneElapsed = useCallback(() => {
    if (previewMode || !childEnabled || !currentScene || inEnding) return;
    const elapsed = Math.min(45, Math.max(0, Math.round((Date.now() - sceneEnteredAtRef.current) / 1000)));
    void onRecordProgress({
      storyId: story.id,
      action: 'scene_progress',
      sceneIndex,
      sceneId: currentScene.id,
      listenedSecondsDelta: elapsed > 2 ? elapsed : 0,
    });
  }, [previewMode, childEnabled, currentScene, inEnding, onRecordProgress, story.id, sceneIndex]);

  const handleClosePlayer = () => {
    clearAutoAdvanceTimer();
    audioCtrlRef.current?.stop();
    soundEngine.stopAllAudio();
    flushCurrentSceneElapsed();
    onClose();
  };

  const handleNextScene = useCallback(() => {
    clearAutoAdvanceTimer();
    audioCtrlRef.current?.stop();
    flushCurrentSceneElapsed();
    if (sceneIndex + 1 < totalScenes) {
      const nextIdx = sceneIndex + 1;
      setSceneIndex(nextIdx);
      const nextScene = scenes[nextIdx];
      if (nextScene && !sfxMuted) {
        soundEngine.playStorySfx(nextScene.sfxCue, sfxMuted);
      }
    } else {
      setInEnding(true);
      if (!sfxMuted) soundEngine.playCelebration();
    }
  }, [clearAutoAdvanceTimer, flushCurrentSceneElapsed, sceneIndex, totalScenes, scenes, sfxMuted]);

  handleNextSceneRef.current = handleNextScene;

  const handlePrevScene = () => {
    clearAutoAdvanceTimer();
    audioCtrlRef.current?.stop();
    if (inEnding) {
      setInEnding(false);
      return;
    }
    if (sceneIndex > 0) {
      setSceneIndex(sceneIndex - 1);
    }
  };

  const handleReplayAll = () => {
    clearAutoAdvanceTimer();
    audioCtrlRef.current?.stop();
    setInEnding(false);
    setSceneIndex(0);
    setQuizFeedback(null);
    setStoryCompletedSaved(false);
    completionTokenRef.current = `st_${story.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  };

  const handlePlayPauseAudio = async () => {
    const ctrl = audioCtrlRef.current;
    if (!ctrl || !currentScene) return;
    clearAutoAdvanceTimer();
    if (audioSnap.status === 'playing') {
      ctrl.pause();
      return;
    }
    if (audioSnap.status === 'paused') {
      await ctrl.resume();
      return;
    }
    if (audioSnap.status === 'ended') {
      await ctrl.replay();
      return;
    }
    if (currentScene.narrationAudioUrl) {
      await ctrl.playScene(
        currentScene.narrationAudioUrl,
        currentScene.durationSeconds,
        buildSceneAudioCallbacks(currentScene, sceneIndex),
      );
    }
  };

  const handleFinishAndSave = async () => {
    if (previewMode) {
      setStoryCompletedSaved(true);
      return;
    }
    await onRecordProgress({
      storyId: story.id,
      action: 'complete',
      sceneIndex: Math.max(0, totalScenes - 1),
      sceneId: scenes[totalScenes - 1]?.id,
      quizCompleted: quizAnsweredCorrect,
      closingActivityCompleted: closingDone,
      completionToken: completionTokenRef.current,
    });
    setStoryCompletedSaved(true);
    if (!sfxMuted) soundEngine.playCelebration();
  };

  const handleInteractionCompleted = (interactionId: string) => {
    setCompletedInteractions((prev) => {
      const next = new Set(prev);
      next.add(interactionId);
      return next;
    });
    if (!previewMode && childEnabled) {
      void onRecordProgress({
        storyId: story.id,
        action: 'interaction',
        sceneIndex,
        sceneId: currentScene?.id,
        interactionId,
      });
    }
  };

  const sceneProgressPct = useMemo(() => {
    if (totalScenes <= 0) return 100;
    if (inEnding) return 100;
    return Math.round(((sceneIndex + 1) / totalScenes) * 100);
  }, [totalScenes, inEnding, sceneIndex]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={story.title[language]}
      className="fixed inset-0 z-50 bg-[#FFFDF8] flex flex-col overflow-hidden"
    >
      {/* Compact Sticky Top Control Bar (<= 12% Mobile Viewport Height) */}
      <header className="shrink-0 bg-white border-b border-[#B4862C]/20 px-4 py-2.5 sm:px-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleClosePlayer}
          className="nono-btn-tactile min-h-[44px] px-3.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
          <span>{language === 'ar' ? 'إغلاق القصة' : 'Exit Story'}</span>
        </button>

        <div className="min-w-0 text-center flex-1">
          <h2 className="text-sm sm:text-lg font-extrabold text-[#27345C] truncate">
            {story.title[language]}
            {previewMode && (
              <span className="ms-2 text-xs font-bold text-[#8054D9]">
                ({language === 'ar' ? 'معاينة المشرف' : 'Admin Preview'})
              </span>
            )}
          </h2>
          <p className="text-[11px] sm:text-xs font-bold text-[#27345C]/65 tabular-nums">
            {inEnding
              ? language === 'ar'
                ? 'نهاية القصة والتطبيق'
                : 'Story Ending & Closing Activity'
              : language === 'ar'
                ? `المشهد ${formatNumber(sceneIndex + 1, 'ar')} من ${formatNumber(totalScenes, 'ar')} · ${formatNumber(sceneProgressPct, 'ar')}٪`
                : `Scene ${sceneIndex + 1} of ${totalScenes} · ${sceneProgressPct}%`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSfxMuted((m) => !m)}
            aria-label={sfxMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            {sfxMuted ? <VolumeX className="w-4 h-4 text-[#DC2626]" /> : <Volume2 className="w-4 h-4 text-[#047857]" />}
            <span className="hidden sm:inline">{language === 'ar' ? (sfxMuted ? 'المؤثرات صامتة' : 'مؤثرات لطيفة') : (sfxMuted ? 'SFX Off' : 'SFX On')}</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content Area (Two-Zone Balanced Layout) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {/* Scene Dots Progress Rail */}
          <div className="flex items-center gap-1.5" aria-label="Scene progress">
            {scenes.map((sc, idx) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  setInEnding(false);
                  setSceneIndex(idx);
                }}
                aria-label={`${language === 'ar' ? 'المشهد' : 'Scene'} ${idx + 1}`}
                className={`h-2.5 flex-1 rounded-full transition-colors cursor-pointer ${
                  !inEnding && idx === sceneIndex
                    ? 'bg-[#047857]'
                    : inEnding || idx < sceneIndex
                      ? 'bg-[#10B981]/60'
                      : 'bg-[#27345C]/12'
                }`}
              />
            ))}
            <button
              type="button"
              onClick={() => setInEnding(true)}
              aria-label={language === 'ar' ? 'خاتمة القصة' : 'Story Ending'}
              className={`h-2.5 w-8 rounded-full transition-colors cursor-pointer ${
                inEnding ? 'bg-[#D97706]' : 'bg-[#27345C]/12'
              }`}
            />
          </div>

          {/* ACTIVE SCENE VIEW */}
          {!inEnding && currentScene && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Zone 1: Visual Illustrated Stage + Embedded Activity (7/12 on desktop) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative rounded-3xl overflow-hidden border border-[#B4862C]/30 bg-white shadow-sm">
                  {!imgFailed && story.coverImage ? (
                    <div className="relative aspect-video bg-[#FFF8E9]">
                      <img
                        src={story.coverImage}
                        alt={currentScene.title[language]}
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover block"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
                        <div>
                          <p className="text-[11px] font-bold text-white/85">
                            {story.narrationNote[language]}
                          </p>
                          <h3 className="text-base sm:text-xl font-extrabold">
                            {currentScene.title[language]}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => soundEngine.playStorySfx(currentScene.sfxCue, sfxMuted)}
                          disabled={sfxMuted}
                          className="min-h-[40px] px-3 rounded-xl bg-white/90 text-[#27345C] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
                          <span>{language === 'ar' ? 'صوت المشهد' : 'Scene Sound'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      <QuranSymbolicScene
                        theme={story.symbolicTheme}
                        title={currentScene.title[language]}
                        className="w-full h-56 sm:h-64 block"
                      />
                      <h3 className="text-lg font-extrabold text-[#27345C]">
                        {currentScene.title[language]}
                      </h3>
                    </div>
                  )}
                </div>

                {/* Embedded Interactive Activity for This Scene */}
                {currentScene.activity && (
                  <QuranStoryActivities
                    activity={currentScene.activity}
                    language={language}
                    alreadyCompleted={completedInteractions.has(currentScene.activity.id)}
                    sfxMuted={sfxMuted}
                    onComplete={handleInteractionCompleted}
                  />
                )}
              </div>

              {/* Zone 2: Storytelling Narration, Audio Deck, and Verified Quran Reference (5/12 on desktop) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Narration Card */}
                <div className="rounded-3xl bg-white border border-[#27345C]/12 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#27345C]/65">
                    <span>{language === 'ar' ? 'السرد القصصي المبسّط للأطفال' : 'Child-Friendly Story Narration'}</span>
                    <span className="tabular-nums">
                      ~{formatClock(currentScene.durationSeconds, language)}
                    </span>
                  </div>

                  <p className="text-base sm:text-lg font-extrabold text-[#27345C] leading-relaxed">
                    {currentScene.narration[bandKey][language]}
                  </p>

                  {/* Real Audio Narration Player / Honest Unavailable State */}
                  <div className="rounded-2xl bg-[#FFF8E9] border border-[#B4862C]/25 p-3.5 space-y-3">
                    {currentScene.narrationAudioUrl && audioSnap.status !== 'unavailable' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handlePlayPauseAudio()}
                            className="nono-btn-tactile min-h-[46px] flex-1 px-4 rounded-xl bg-[#047857] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {audioSnap.status === 'playing' ? (
                              <>
                                <Pause className="w-4 h-4" />
                                <span>{language === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
                              </>
                            ) : audioSnap.status === 'paused' ? (
                              <>
                                <Play className="w-4 h-4" />
                                <span>{language === 'ar' ? 'متابعة السرد' : 'Resume'}</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                <span>{language === 'ar' ? 'استماع للمشهد' : 'Play Narration'}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              clearAutoAdvanceTimer();
                              void audioCtrlRef.current?.replay();
                            }}
                            aria-label={language === 'ar' ? 'إعادة تشغيل المشهد' : 'Replay Scene Audio'}
                            className="min-h-[46px] min-w-[46px] rounded-xl bg-white border border-[#27345C]/15 text-[#27345C] flex items-center justify-center cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <input
                            type="range"
                            min={0}
                            max={Math.max(1, Math.round(audioSnap.duration || currentScene.durationSeconds))}
                            value={Math.min(
                              Math.max(0, Math.round(audioSnap.currentTime)),
                              Math.max(1, Math.round(audioSnap.duration || currentScene.durationSeconds)),
                            )}
                            aria-label={language === 'ar' ? 'تقديم أو ترجيع الصوت' : 'Seek story audio'}
                            onChange={(e) => audioCtrlRef.current?.seek(Number(e.target.value))}
                            className="w-full h-2.5 accent-[#047857] cursor-pointer"
                          />
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#27345C]/70 tabular-nums">
                            <span>{formatClock(audioSnap.currentTime, language)}</span>
                            <span>{formatClock(audioSnap.duration, language)}</span>
                          </div>
                        </div>

                        {audioSnap.errorMessage && (
                          <p
                            className={`text-xs font-bold flex items-center gap-1.5 ${
                              audioSnap.status === 'error' ? 'text-[#991B1B]' : 'text-[#92400E]'
                            }`}
                          >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{audioSnap.errorMessage}</span>
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-start gap-2.5 text-xs font-bold text-[#92400E]">
                        <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706] mt-0.5" />
                        <div className="space-y-1">
                          <p>
                            {language === 'ar'
                              ? 'ملف السرد الصوتي غير متوفر لهذا المشهد بعد — وضع القراءة التفاعلية نشط ولا يتم محاكاة تشغيل وهمي.'
                              : 'Recorded narration audio is not uploaded for this scene yet — interactive read-along & gentle SFX are active.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center justify-between gap-2 text-xs font-bold text-[#27345C]/80 pt-1 border-t border-[#B4862C]/15 cursor-pointer">
                      <span>{language === 'ar' ? 'الانتقال التلقائي بعد انتهاء الصوت' : 'Auto-advance after audio finishes'}</span>
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={(e) => setAutoAdvance(e.target.checked)}
                        className="w-4 h-4 accent-[#047857]"
                      />
                    </label>
                  </div>

                  {/* Toddler-Sized Scene Navigation */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={sceneIndex === 0}
                      onClick={handlePrevScene}
                      className="nono-btn-tactile min-h-[48px] px-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                      <span>{language === 'ar' ? 'المشهد السابق' : 'Previous'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextScene}
                      className="nono-btn-tactile min-h-[48px] px-4 rounded-2xl bg-[#047857] text-white text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>
                        {sceneIndex + 1 < totalScenes
                          ? language === 'ar'
                            ? 'المشهد التالي'
                            : 'Next Scene'
                          : language === 'ar'
                            ? 'خاتمة القصة'
                            : 'Finish Story'}
                      </span>
                      <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                    </button>
                  </div>
                </div>

                {/* Separated Verified Quranic Reference & Optional Exact Ayah */}
                <div className="rounded-3xl bg-white border border-[#B4862C]/25 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#92400E]">
                    <BookOpen className="w-4 h-4" />
                    <span>
                      {language === 'ar'
                        ? 'المرجع القرآني الموثق (منفصل عن السرد القصصي)'
                        : 'Verified Quranic Reference (Separate from Narration)'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#27345C]/80">
                    {story.surahReferences
                      .map((ref) =>
                        language === 'ar'
                          ? `${ref.surahNameAr} (${ref.ayahRange})`
                          : `${ref.surahNameEn} (${ref.ayahRange})`,
                      )
                      .join(' · ')}
                  </p>

                  {story.quotedVerse && (
                    <div className="quran-mushaf-surface rounded-2xl p-3 space-y-1">
                      <p className="text-[11px] font-extrabold text-[#92400E]">
                        {language === 'ar'
                          ? `آية موثّقة (${story.quotedVerse.verseKey}):`
                          : `Verified Ayah (${story.quotedVerse.verseKey}):`}
                      </p>
                      <p
                        dir="rtl"
                        lang="ar"
                        translate="no"
                        className="notranslate font-quran-uthmani text-xl text-[#064E3B] text-right"
                      >
                        {story.quotedVerse.textUthmani}
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] font-semibold text-[#27345C]/70 space-y-1">
                    {story.establishedQuranicFacts.map((fact, idx) => (
                      <p key={idx}>{fact[language]}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* END-OF-STORY COMPLETION & CLOSING ACTIVITY SCREEN */}
          {inEnding && (
            <div className="rounded-3xl bg-white border border-[#10B981]/35 p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-[#ECFDF5] border border-[#10B981]/30 flex items-center justify-center text-4xl mx-auto">
                  {story.completionBadge.icon}
                </div>
                <p className="text-xs font-extrabold text-[#047857]">
                  {story.completionBadge.title[language]}
                </p>
                <h3 className="text-2xl font-extrabold text-[#27345C]">
                  {language === 'ar'
                    ? `أحسنت! وصلت لنهاية «${story.title.ar}»`
                    : `MashaAllah! End of “${story.title.en}”`}
                </h3>
                <p className="text-sm sm:text-base font-bold text-[#065F46] max-w-2xl mx-auto">
                  {story.moralLesson[language]}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual Closing Question */}
                <div className="rounded-2xl bg-[#FFF8E9] border border-[#B4862C]/25 p-4 space-y-3">
                  <p className="text-sm font-extrabold text-[#27345C]">
                    {story.closingQuiz.question[language]}
                  </p>
                  <div className="space-y-2">
                    {story.closingQuiz.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (opt.isCorrect) {
                            if (!sfxMuted) soundEngine.playSuccess();
                            setQuizAnsweredCorrect(true);
                            setQuizFeedback({
                              ok: true,
                              text: story.closingQuiz.successFeedback[language],
                            });
                            handleInteractionCompleted(`${story.id}:closing-quiz`);
                          } else {
                            if (!sfxMuted) soundEngine.playEncourage();
                            setQuizFeedback({
                              ok: false,
                              text: story.closingQuiz.retryFeedback[language],
                            });
                          }
                        }}
                        className={`nono-btn-tactile min-h-[52px] w-full px-4 rounded-xl border flex items-center gap-3 text-start cursor-pointer ${
                          quizAnsweredCorrect && opt.isCorrect
                            ? 'bg-[#DCFCE7] border-[#10B981] text-[#065F46]'
                            : 'bg-white border-[#27345C]/15 text-[#27345C]'
                        }`}
                      >
                        <span className="text-2xl" aria-hidden="true">
                          {opt.emoji}
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold">{opt.label[language]}</span>
                      </button>
                    ))}
                  </div>
                  {quizFeedback && (
                    <p
                      className={`text-xs font-extrabold ${
                        quizFeedback.ok ? 'text-[#047857]' : 'text-[#92400E]'
                      }`}
                    >
                      {quizFeedback.text}
                    </p>
                  )}
                </div>

                {/* Gentle Closing Mini-Activity */}
                <div className="rounded-2xl bg-[#ECFDF5]/60 border border-[#10B981]/30 p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-sm font-extrabold text-[#064E3B]">
                      {story.closingActivity.prompt[language]}
                    </p>
                    <p className="text-xs font-bold text-[#065F46]/80">
                      {story.simplifiedExplanation[language]}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!sfxMuted) soundEngine.playSuccess();
                      setClosingDone(true);
                      handleInteractionCompleted(`${story.id}:closing-activity`);
                    }}
                    className={`nono-btn-tactile min-h-[54px] px-4 rounded-2xl font-extrabold text-sm cursor-pointer ${
                      closingDone
                        ? 'bg-[#DCFCE7] text-[#166534] border border-[#10B981]'
                        : 'bg-[#FFD84D] text-[#27345C]'
                    }`}
                  >
                    {closingDone
                      ? story.closingActivity.completionPhrase[language]
                      : story.closingActivity.actionLabel[language]}
                  </button>
                </div>
              </div>

              {/* Save Completion / Replay / Explore Another */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingAction || !childEnabled}
                  onClick={() => void handleFinishAndSave()}
                  className="nono-btn-tactile min-h-[52px] px-6 rounded-2xl bg-[#047857] text-white text-sm sm:text-base font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {storyCompletedSaved ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {previewMode
                          ? language === 'ar'
                            ? 'تمت معاينة الخاتمة بنجاح'
                            : 'Preview Complete'
                          : language === 'ar'
                            ? 'تم حفظ إتمام القصة ✓'
                            : 'Story Completion Saved ✓'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Award className="w-5 h-5" />
                      <span>
                        {previewMode
                          ? language === 'ar'
                            ? 'تأكيد جاهزية المعاينة'
                            : 'Confirm Preview Readiness'
                          : language === 'ar'
                            ? 'أتممت القصة واحفظ الوسام ★'
                            : 'Complete Story & Save Badge ★'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReplayAll}
                  className="nono-btn-tactile min-h-[48px] px-5 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] text-sm font-extrabold flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{language === 'ar' ? 'إعادة القصة من البداية' : 'Replay Story'}</span>
                </button>

                {onExploreAnotherStory && (
                  <button
                    type="button"
                    onClick={() => {
                      audioCtrlRef.current?.stop();
                      soundEngine.stopAllAudio();
                      onExploreAnotherStory();
                    }}
                    className="nono-btn-tactile min-h-[48px] px-5 rounded-2xl bg-[#27345C] text-white text-sm font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'استكشف قصة أخرى' : 'Explore Another Story'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
