import React from 'react';
import { Loader2, Pause, Play, RefreshCw, RotateCcw, Square, Volume2, X } from 'lucide-react';
import type { AcademyAudioSnapshot } from '../../utils/academyAudioController';

interface AcademyAudioBarProps {
  snapshot: AcademyAudioSnapshot;
  language: 'ar' | 'en';
  onPause: () => void;
  onResume: () => void;
  onReplay: () => void;
  onStop: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

export const AcademyAudioBar: React.FC<AcademyAudioBarProps> = ({
  snapshot,
  language,
  onPause,
  onResume,
  onReplay,
  onStop,
  onRetry,
  onDismiss,
}) => {
  if (snapshot.status === 'idle') return null;

  const isError = snapshot.status === 'error';
  const isLoading = snapshot.status === 'loading';
  const isPlaying = snapshot.status === 'playing';
  const isPaused = snapshot.status === 'paused';
  const isEnded = snapshot.status === 'ended';

  return (
    <div
      className={`rounded-2xl border-2 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-all ${
        isError
          ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          : 'bg-white border-[#8054D9]/25 text-[#27345C] shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isError ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#F3ECFF] text-[#8054D9]'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold truncate max-w-[220px] sm:max-w-[340px]">
              {isError
                ? snapshot.errorMessage ||
                  (language === 'ar' ? 'تعذر تشغيل الصوت' : 'Audio playback error')
                : snapshot.label}
            </span>
            {snapshot.slow && !isError && (
              <span className="px-2 py-0.5 rounded-lg bg-[#FFD84D]/45 text-[10px] font-extrabold text-[#27345C] shrink-0">
                {language === 'ar' ? 'بطيء' : 'Slow'}
              </span>
            )}
          </div>
          {!isError && (
            <p className="text-[11px] font-bold text-[#27345C]/65">
              {isLoading
                ? language === 'ar'
                  ? 'جاري تحميل التسجيل الصوتي...'
                  : 'Loading studio recording...'
                : isPlaying
                  ? language === 'ar'
                    ? 'جاري التشغيل'
                    : 'Playing'
                  : isPaused
                    ? language === 'ar'
                      ? 'متوقف مؤقتاً'
                      : 'Paused'
                    : language === 'ar'
                      ? 'انتهى النطق'
                      : 'Finished'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isPlaying && (
          <button
            type="button"
            onClick={onPause}
            className="h-9 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
          </button>
        )}
        {isPaused && (
          <button
            type="button"
            onClick={onResume}
            className="h-9 px-3 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{language === 'ar' ? 'متابعة' : 'Resume'}</span>
          </button>
        )}
        {(isPlaying || isPaused || isEnded) && (
          <button
            type="button"
            onClick={onReplay}
            className="h-9 px-3 rounded-xl bg-[#F3ECFF] text-[#8054D9] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إعادة' : 'Replay'}</span>
          </button>
        )}
        {(isLoading || isPlaying || isPaused) && (
          <button
            type="button"
            onClick={onStop}
            className="h-9 px-3 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إيقاف' : 'Stop'}</span>
          </button>
        )}
        {isError && snapshot.canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-9 px-3 rounded-xl bg-[#991B1B] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        )}
        {(isError || isEnded) && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
            className="w-9 h-9 rounded-xl bg-white/80 border border-current/15 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
