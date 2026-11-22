import type { QuranReciterSpec, QuranSurahSpec } from '../types/nonoland';

export type QuranPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'repeat-window'
  | 'paused'
  | 'completed'
  | 'unavailable'
  | 'error';

export type QuranPlaybackErrorCode =
  | 'NOT_ALLOWED'
  | 'NETWORK'
  | 'MEDIA_UNSUPPORTED'
  | 'TIMEOUT'
  | 'UNVERIFIED'
  | 'PLAYBACK_FAILED';

export type QuranSequencePhase = 'basmala' | 'surah' | 'closing';

export interface QuranSequenceStep {
  phase: QuranSequencePhase;
  url: string;
  labelAr: string;
  labelEn: string;
}

export interface QuranSurahPlaybackPlan {
  surahId: string;
  basmalaAlreadyIncluded: boolean;
  willPlayBasmala: boolean;
  willPlayClosing: boolean;
  basmalaMissingRequired?: boolean;
  steps: QuranSequenceStep[];
}

export interface QuranPlayerState {
  status: QuranPlaybackStatus;
  playbackMode: 'surah' | 'ayah' | 'technical-sample' | null;
  surahId: string | null;
  ayahNumber: number | null;
  currentRepeatIndex: number;
  totalRepeats: number;
  repeatWindowSecondsLeft: number;
  currentTimeSeconds?: number;
  durationSeconds?: number;
  activeUrl?: string | null;
  sequencePhase?: QuranSequencePhase | null;
  sequenceStepIndex?: number;
  sequenceTotalSteps?: number;
  sequenceStepPhases?: QuranSequencePhase[];
  errorCode?: QuranPlaybackErrorCode;
  errorMessage?: string;
}

export function formatAudioTime(seconds?: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface QuranStopPosition {
  surahId: string;
  ayahNumber: number;
  updatedAt: string;
}

const STOP_POS_STORAGE_PREFIX = 'nonoland_quran_stop_pos_v1_';

export function saveQuranStopPosition(childId: string, surahId: string, ayahNumber: number): void {
  if (!childId || typeof localStorage === 'undefined') return;
  try {
    const payload: QuranStopPosition = {
      surahId,
      ayahNumber: Math.max(1, Math.round(ayahNumber)),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${STOP_POS_STORAGE_PREFIX}${childId}`, JSON.stringify(payload));
  } catch {
    // Ignore storage restriction in private WebView mode
  }
}

export function loadQuranStopPosition(childId: string): QuranStopPosition | null {
  if (!childId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STOP_POS_STORAGE_PREFIX}${childId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuranStopPosition>;
    if (
      typeof parsed?.surahId === 'string' &&
      typeof parsed?.ayahNumber === 'number' &&
      Number.isFinite(parsed.ayahNumber) &&
      parsed.ayahNumber >= 1
    ) {
      return {
        surahId: parsed.surahId,
        ayahNumber: Math.round(parsed.ayahNumber),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearQuranStopPosition(childId: string): void {
  if (!childId || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(`${STOP_POS_STORAGE_PREFIX}${childId}`);
  } catch {
    // Ignore
  }
}

/**
 * Resolve verified audio URL for a Surah or Ayah from a verified & licensed reciter.
 * Strictly prohibits synthetic voices or unverified reciters.
 */
export function resolveVerifiedAudioUrl(
  reciter: QuranReciterSpec | null | undefined,
  surahId: string,
  ayahNumber?: number,
): string | null {
  if (!reciter || reciter.verificationStatus !== 'verified') {
    return null;
  }
  if (ayahNumber !== undefined && reciter.ayahAudioUrls) {
    const surahPrefix = surahId.replace('surah-', '');
    const key = `${surahPrefix}:${ayahNumber}`;
    const ayahUrl = reciter.ayahAudioUrls[key];
    if (ayahUrl && (ayahUrl.startsWith('https://') || ayahUrl.startsWith('/assets/quran/'))) {
      return ayahUrl;
    }
  }
  if (ayahNumber === undefined && reciter.surahAudioUrls) {
    const surahUrl = reciter.surahAudioUrls[surahId];
    if (surahUrl && (surahUrl.startsWith('https://') || surahUrl.startsWith('/assets/quran/'))) {
      return surahUrl;
    }
  }
  if (ayahNumber !== undefined && !reciter.ayahAudioUrls) {
    // If reciter only supplies Surah-level audio and no ayahAudioUrls map exists, return null when explicitly asking for a single Ayah
    return null;
  }
  const surahUrl = reciter.surahAudioUrls?.[surahId];
  if (surahUrl && (surahUrl.startsWith('https://') || surahUrl.startsWith('/assets/quran/'))) {
    return surahUrl;
  }
  return null;
}

export function isValidSafeQuranAudioUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('/assets/quran/');
}

/**
 * Builds the exact pre-Surah -> Surah -> post-Surah playback sequence without altering or
 * concatenating original audio files:
 * 1. Opening Basmala (ONLY if not already included in the Surah recording — Al-Fatihah 1:1 is preserved and NEVER duplicated).
 * 2. Original Quran Foundation Surah recitation.
 * 3. Approved Closing Phrase ("صَدَقَ اللَّهُ الْعَظِيمُ"), ONLY when an authentic approved asset is configured.
 */
export function buildSurahRecitationSequence(opts: {
  surah: Pick<QuranSurahSpec, 'id' | 'number' | 'hasOpeningBasmalah'>;
  surahAudioUrl: string | null | undefined;
  basmalaAudioUrl?: string | null;
  closingPhraseAudioUrl?: string | null;
  basmalaAlreadyIncludedInRecording?: boolean;
  requireApprovedBasmala?: boolean;
}): QuranSurahPlaybackPlan {
  const basmalaAlreadyIncluded =
    opts.surah.number === 1 ||
    !opts.surah.hasOpeningBasmalah ||
    opts.basmalaAlreadyIncludedInRecording === true;

  if (!isValidSafeQuranAudioUrl(opts.surahAudioUrl)) {
    return {
      surahId: opts.surah.id,
      basmalaAlreadyIncluded,
      willPlayBasmala: false,
      willPlayClosing: false,
      basmalaMissingRequired: false,
      steps: [],
    };
  }

  const hasValidBasmala = isValidSafeQuranAudioUrl(opts.basmalaAudioUrl);
  if (!basmalaAlreadyIncluded && !hasValidBasmala && opts.requireApprovedBasmala !== false) {
    return {
      surahId: opts.surah.id,
      basmalaAlreadyIncluded: false,
      willPlayBasmala: false,
      willPlayClosing: false,
      basmalaMissingRequired: true,
      steps: [],
    };
  }

  const steps: QuranSequenceStep[] = [];
  const willPlayBasmala = !basmalaAlreadyIncluded && hasValidBasmala;
  if (willPlayBasmala && opts.basmalaAudioUrl) {
    steps.push({
      phase: 'basmala',
      url: opts.basmalaAudioUrl.trim(),
      labelAr: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      labelEn: 'Opening Basmala',
    });
  }

  steps.push({
    phase: 'surah',
    url: opts.surahAudioUrl.trim(),
    labelAr: 'تلاوة السورة الأصلية (Quran Foundation)',
    labelEn: 'Surah Recitation (Quran Foundation)',
  });

  const willPlayClosing = isValidSafeQuranAudioUrl(opts.closingPhraseAudioUrl);
  if (willPlayClosing && opts.closingPhraseAudioUrl) {
    steps.push({
      phase: 'closing',
      url: opts.closingPhraseAudioUrl.trim(),
      labelAr: 'صَدَقَ اللَّهُ الْعَظِيمُ',
      labelEn: 'Closing Phrase (Sadaq Allah Al-Azeem)',
    });
  }

  return {
    surahId: opts.surah.id,
    basmalaAlreadyIncluded,
    willPlayBasmala,
    willPlayClosing,
    basmalaMissingRequired: false,
    steps,
  };
}

/**
 * ADMIN / INTERNAL TESTING ONLY:
 * Strictly looks up an existing HTTPS URL returned by the backend Quran Foundation endpoint.
 * Never constructs, guesses, or invents URLs, and never uses TTS or synthetic audio.
 */
export function resolveControlledTestingAudioUrl(
  surahAudioUrls: Record<string, string> | null | undefined,
  ayahAudioUrls: Record<string, string> | null | undefined,
  surahId: string,
  ayahNumber?: number,
): string | null {
  if (ayahNumber !== undefined) {
    const surahPrefix = surahId.replace('surah-', '');
    const key = `${surahPrefix}:${ayahNumber}`;
    const ayahUrl = ayahAudioUrls?.[key];
    if (isValidSafeQuranAudioUrl(ayahUrl)) {
      return ayahUrl.trim();
    }
    return null;
  }
  const surahUrl = surahAudioUrls?.[surahId];
  if (isValidSafeQuranAudioUrl(surahUrl)) {
    return surahUrl.trim();
  }
  return null;
}

export class QuranAudioController {
  private audio: HTMLAudioElement | null = null;
  private detachActiveListeners: (() => void) | null = null;
  private cancelActivePlayback: (() => void) | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private loadTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelled = false;
  private activeRunId = 0;
  private state: QuranPlayerState = {
    status: 'idle',
    playbackMode: null,
    surahId: null,
    ayahNumber: null,
    currentRepeatIndex: 1,
    totalRepeats: 1,
    repeatWindowSecondsLeft: 0,
    currentTimeSeconds: 0,
    durationSeconds: 0,
    activeUrl: null,
    sequencePhase: null,
    sequenceStepIndex: undefined,
    sequenceTotalSteps: undefined,
    sequenceStepPhases: undefined,
  };
  private onState: (next: QuranPlayerState) => void;
  private visibilityHandler: (() => void) | null = null;

  constructor(onState: (next: QuranPlayerState) => void) {
    this.onState = onState;
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.hidden && (this.state.status === 'playing' || this.state.status === 'loading')) {
          this.pause();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private emit(patch: Partial<QuranPlayerState>) {
    this.state = { ...this.state, ...patch };
    this.onState({ ...this.state });
  }

  private clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.loadTimeoutTimer) {
      clearTimeout(this.loadTimeoutTimer);
      this.loadTimeoutTimer = null;
    }
  }

  private cleanupAudio() {
    if (this.detachActiveListeners) {
      this.detachActiveListeners();
      this.detachActiveListeners = null;
    }
    if (this.cancelActivePlayback) {
      const cancel = this.cancelActivePlayback;
      this.cancelActivePlayback = null;
      cancel();
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
  }

  public stop() {
    this.activeRunId += 1;
    this.cancelled = true;
    this.clearTimers();
    this.cleanupAudio();
    this.emit({
      status: 'idle',
      playbackMode: null,
      currentRepeatIndex: 1,
      repeatWindowSecondsLeft: 0,
      currentTimeSeconds: 0,
      durationSeconds: 0,
      activeUrl: null,
      sequencePhase: null,
      sequenceStepIndex: undefined,
      sequenceTotalSteps: undefined,
      sequenceStepPhases: undefined,
      errorCode: undefined,
      errorMessage: undefined,
    });
  }

  public pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.emit({
        status: 'paused',
        currentTimeSeconds: this.audio.currentTime || 0,
        durationSeconds: Number.isFinite(this.audio.duration) ? this.audio.duration : this.state.durationSeconds || 0,
      });
    }
  }

  public resume() {
    if (this.audio && this.state.status === 'paused') {
      void this.audio
        .play()
        .then(() => {
          this.emit({ status: 'playing', errorCode: undefined, errorMessage: undefined });
        })
        .catch((err) => {
          const isNotAllowed = err instanceof Error && err.name === 'NotAllowedError';
          this.emit({
            status: 'error',
            errorCode: isNotAllowed ? 'NOT_ALLOWED' : 'PLAYBACK_FAILED',
            errorMessage: isNotAllowed
              ? 'Tap Play again to allow audio playback on this device.'
              : 'Unable to resume audio playback.',
          });
        });
    }
  }

  public seek(targetSeconds: number) {
    if (!this.audio) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    if (duration <= 0) return;
    const clamped = Math.max(0, Math.min(duration, targetSeconds));
    this.audio.currentTime = clamped;
    this.emit({
      currentTimeSeconds: clamped,
      durationSeconds: duration,
    });
  }

  private classifyMediaError(audio: HTMLAudioElement): {
    code: QuranPlaybackErrorCode;
    message: string;
  } {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return {
        code: 'NETWORK',
        message: 'Network connection lost while loading Quran audio. Check your internet connection and retry.',
      };
    }
    const mediaErr = audio.error;
    if (!mediaErr) {
      return {
        code: 'PLAYBACK_FAILED',
        message: 'Audio file could not be loaded.',
      };
    }
    if (mediaErr.code === mediaErr.MEDIA_ERR_NETWORK) {
      return {
        code: 'NETWORK',
        message: 'Network interruption while loading audio. Check your connection and retry.',
      };
    }
    if (
      mediaErr.code === mediaErr.MEDIA_ERR_DECODE ||
      mediaErr.code === mediaErr.MEDIA_ERR_SRC_NOT_SUPPORTED
    ) {
      return {
        code: 'MEDIA_UNSUPPORTED',
        message: 'This audio format or URL is unavailable on the current device.',
      };
    }
    return {
      code: 'PLAYBACK_FAILED',
      message: 'Audio playback stopped unexpectedly.',
    };
  }

  private playSingleUrl(
    url: string,
    runId: number,
  ): Promise<{ ok: boolean; errorCode?: QuranPlaybackErrorCode; errorMessage?: string }> {
    return new Promise((resolve) => {
      if (this.cancelled || this.activeRunId !== runId || typeof Audio === 'undefined') {
        resolve({ ok: false });
        return;
      }
      this.cleanupAudio();
      if (this.loadTimeoutTimer) {
        clearTimeout(this.loadTimeoutTimer);
        this.loadTimeoutTimer = null;
      }

      const audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.src = url;
      this.audio = audio;

      let settled = false;
      const finish = (result: {
        ok: boolean;
        errorCode?: QuranPlaybackErrorCode;
        errorMessage?: string;
      }) => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        if (this.detachActiveListeners === cleanupListeners) {
          this.detachActiveListeners = null;
        }
        if (this.cancelActivePlayback === cancelCurrent) {
          this.cancelActivePlayback = null;
        }
        if (this.loadTimeoutTimer) {
          clearTimeout(this.loadTimeoutTimer);
          this.loadTimeoutTimer = null;
        }
        resolve(result);
      };

      const cancelCurrent = () => {
        finish({ ok: false });
      };
      this.cancelActivePlayback = cancelCurrent;

      const syncTime = () => {
        if (this.activeRunId !== runId || this.cancelled) return;
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        this.emit({
          currentTimeSeconds: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
          durationSeconds: duration,
        });
      };

      const onPlaying = () => {
        if (this.loadTimeoutTimer) {
          clearTimeout(this.loadTimeoutTimer);
          this.loadTimeoutTimer = null;
        }
        if (this.activeRunId === runId && !this.cancelled) {
          this.emit({
            status: 'playing',
            activeUrl: url,
            durationSeconds: Number.isFinite(audio.duration) ? audio.duration : this.state.durationSeconds || 0,
            errorCode: undefined,
            errorMessage: undefined,
          });
        }
      };

      const onWaiting = () => {
        if (this.activeRunId === runId && !this.cancelled && !audio.paused && audio.readyState < 3) {
          this.emit({ status: 'loading' });
        }
      };

      const onOffline = () => {
        if (this.activeRunId === runId && !this.cancelled && audio.readyState < 4) {
          this.cleanupAudio();
          finish({
            ok: false,
            errorCode: 'NETWORK',
            errorMessage: 'Network connection interrupted while streaming recitation audio.',
          });
        }
      };

      const onEnded = () => {
        syncTime();
        finish({ ok: true });
      };

      const onError = () => {
        const classified = this.classifyMediaError(audio);
        finish({
          ok: false,
          errorCode: classified.code,
          errorMessage: classified.message,
        });
      };

      const cleanupListeners = () => {
        audio.removeEventListener('loadedmetadata', syncTime);
        audio.removeEventListener('durationchange', syncTime);
        audio.removeEventListener('timeupdate', syncTime);
        audio.removeEventListener('waiting', onWaiting);
        audio.removeEventListener('stalled', onWaiting);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        if (typeof window !== 'undefined') {
          window.removeEventListener('offline', onOffline);
        }
      };

      this.detachActiveListeners = cleanupListeners;
      audio.addEventListener('loadedmetadata', syncTime);
      audio.addEventListener('durationchange', syncTime);
      audio.addEventListener('timeupdate', syncTime);
      audio.addEventListener('waiting', onWaiting);
      audio.addEventListener('stalled', onWaiting);
      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      if (typeof window !== 'undefined') {
        window.addEventListener('offline', onOffline);
      }

      // Guard against Android WebView hanging indefinitely in buffering state
      this.loadTimeoutTimer = setTimeout(() => {
        if (!settled && audio.readyState < 2) {
          this.cleanupAudio();
          finish({
            ok: false,
            errorCode: 'TIMEOUT',
            errorMessage: 'Audio loading timed out. Please check your network and tap Play again.',
          });
        }
      }, 15_000);

      void audio
        .play()
        .then(() => {
          if (this.loadTimeoutTimer) {
            clearTimeout(this.loadTimeoutTimer);
            this.loadTimeoutTimer = null;
          }
          if (this.activeRunId === runId && !this.cancelled && !audio.paused) {
            this.emit({
              status: 'playing',
              activeUrl: url,
              durationSeconds: Number.isFinite(audio.duration) ? audio.duration : this.state.durationSeconds || 0,
            });
          }
        })
        .catch((err) => {
          const isNotAllowed = err instanceof Error && err.name === 'NotAllowedError';
          finish({
            ok: false,
            errorCode: isNotAllowed ? 'NOT_ALLOWED' : 'PLAYBACK_FAILED',
            errorMessage: isNotAllowed
              ? 'Device requires a direct tap on Play to start audio.'
              : 'Unable to start audio playback on this device.',
          });
        });
    });
  }

  private waitRepeatWindow(seconds: number, runId: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.cancelled || this.activeRunId !== runId || seconds <= 0) {
        resolve(!this.cancelled && this.activeRunId === runId);
        return;
      }
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      let remaining = seconds;
      this.emit({
        status: 'repeat-window',
        repeatWindowSecondsLeft: remaining,
      });

      this.countdownTimer = setInterval(() => {
        if (this.cancelled || this.activeRunId !== runId) {
          if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
          }
          resolve(false);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
          }
          this.emit({ repeatWindowSecondsLeft: 0 });
          resolve(true);
        } else {
          this.emit({ repeatWindowSecondsLeft: remaining });
        }
      }, 1000);
    });
  }

  public async playWithRepeat(opts: {
    reciter: QuranReciterSpec | null | undefined;
    surahId: string;
    ayahNumber?: number;
    repeatCount?: number;
    repeatPauseSeconds?: number;
  }): Promise<boolean> {
    this.stop();
    this.cancelled = false;
    const runId = this.activeRunId;

    const url = resolveVerifiedAudioUrl(opts.reciter, opts.surahId, opts.ayahNumber);
    if (!url) {
      this.emit({
        status: 'unavailable',
        playbackMode: opts.ayahNumber !== undefined ? 'ayah' : 'surah',
        surahId: opts.surahId,
        ayahNumber: opts.ayahNumber ?? null,
        totalRepeats: 1,
        currentRepeatIndex: 1,
        repeatWindowSecondsLeft: 0,
        errorCode: 'UNVERIFIED',
      });
      return false;
    }

    const totalRepeats = Math.max(1, Math.min(5, Math.round(opts.repeatCount ?? 1)));
    const pauseSecs = Math.max(0, Math.min(8, Math.round(opts.repeatPauseSeconds ?? 0)));

    for (let i = 1; i <= totalRepeats; i += 1) {
      if (this.cancelled || this.activeRunId !== runId) return false;
      this.emit({
        status: 'loading',
        playbackMode: opts.ayahNumber !== undefined ? 'ayah' : 'surah',
        surahId: opts.surahId,
        ayahNumber: opts.ayahNumber ?? null,
        currentRepeatIndex: i,
        totalRepeats,
        repeatWindowSecondsLeft: 0,
        errorCode: undefined,
        errorMessage: undefined,
      });

      const res = await this.playSingleUrl(url, runId);
      if (this.cancelled || this.activeRunId !== runId) return false;
      if (!res.ok) {
        this.emit({
          status: 'error',
          errorCode: res.errorCode || 'PLAYBACK_FAILED',
          errorMessage: res.errorMessage || 'Audio file could not be loaded.',
        });
        return false;
      }

      if (pauseSecs > 0) {
        const waited = await this.waitRepeatWindow(pauseSecs, runId);
        if (!waited) return false;
      }
    }

    this.emit({
      status: 'completed',
      repeatWindowSecondsLeft: 0,
    });
    return true;
  }

  public async playAyahSequence(opts: {
    reciter: QuranReciterSpec | null | undefined;
    surahId: string;
    ayahNumbers: number[];
    repeatPerAyah?: number;
    repeatPauseSeconds?: number;
    onAyahProgress?: (ayahNumber: number) => void;
  }): Promise<boolean> {
    this.stop();
    this.cancelled = false;
    const runId = this.activeRunId;

    const repeatPerAyah = Math.max(1, Math.min(5, Math.round(opts.repeatPerAyah ?? 1)));
    const pauseSecs = Math.max(0, Math.min(8, Math.round(opts.repeatPauseSeconds ?? 0)));

    for (const ayahNum of opts.ayahNumbers) {
      if (this.cancelled || this.activeRunId !== runId) return false;
      const url = resolveVerifiedAudioUrl(opts.reciter, opts.surahId, ayahNum);
      if (!url) {
        this.emit({
          status: 'unavailable',
          playbackMode: 'ayah',
          surahId: opts.surahId,
          ayahNumber: ayahNum,
          errorCode: 'UNVERIFIED',
        });
        return false;
      }

      opts.onAyahProgress?.(ayahNum);

      for (let i = 1; i <= repeatPerAyah; i += 1) {
        if (this.cancelled || this.activeRunId !== runId) return false;
        this.emit({
          status: 'loading',
          playbackMode: 'ayah',
          surahId: opts.surahId,
          ayahNumber: ayahNum,
          currentRepeatIndex: i,
          totalRepeats: repeatPerAyah,
          repeatWindowSecondsLeft: 0,
          errorCode: undefined,
          errorMessage: undefined,
        });

        const res = await this.playSingleUrl(url, runId);
        if (this.cancelled || this.activeRunId !== runId) return false;
        if (!res.ok) {
          this.emit({
            status: 'error',
            errorCode: res.errorCode || 'PLAYBACK_FAILED',
            errorMessage: res.errorMessage || 'Audio file could not be loaded.',
          });
          return false;
        }

        if (pauseSecs > 0) {
          const waited = await this.waitRepeatWindow(pauseSecs, runId);
          if (!waited) return false;
        }
      }
    }

    this.emit({
      status: 'completed',
      repeatWindowSecondsLeft: 0,
    });
    return true;
  }

  /**
   * Plays ONLY a licensed non-Quran technical sample chime for Android WebView / browser audio diagnostics.
   */
  public async playTechnicalSample(sampleUrl: string): Promise<boolean> {
    if (!sampleUrl.startsWith('/assets/audio/')) {
      this.emit({
        status: 'error',
        playbackMode: 'technical-sample',
        errorCode: 'UNVERIFIED',
        errorMessage: 'Only approved /assets/audio/ diagnostic sample files are allowed.',
      });
      return false;
    }

    this.stop();
    this.cancelled = false;
    const runId = this.activeRunId;

    this.emit({
      status: 'loading',
      playbackMode: 'technical-sample',
      surahId: null,
      ayahNumber: null,
      currentRepeatIndex: 1,
      totalRepeats: 1,
      repeatWindowSecondsLeft: 0,
      errorCode: undefined,
      errorMessage: undefined,
    });

    const res = await this.playSingleUrl(sampleUrl, runId);
    if (this.cancelled || this.activeRunId !== runId) return false;
    if (!res.ok) {
      this.emit({
        status: 'error',
        playbackMode: 'technical-sample',
        errorCode: res.errorCode || 'PLAYBACK_FAILED',
        errorMessage: res.errorMessage || 'Technical sample audio failed to play.',
      });
      return false;
    }

    this.emit({
      status: 'completed',
      playbackMode: 'technical-sample',
      repeatWindowSecondsLeft: 0,
    });
    return true;
  }

  /**
   * ADMIN / INTERNAL TESTING ONLY:
   * Plays an exact HTTPS audio URL returned by the backend Quran Foundation endpoint.
   * Stops any prior audio before starting, never autoplays, never constructs URLs,
   * and never falls back to TTS or synthetic voice.
   */
  public async playControlledTestingUrl(opts: {
    url: string | null | undefined;
    mode: 'surah' | 'ayah';
    surahId: string;
    ayahNumber?: number;
    repeatCount?: number;
    repeatPauseSeconds?: number;
  }): Promise<boolean> {
    this.stop();
    this.cancelled = false;
    const runId = this.activeRunId;

    const cleanUrl = typeof opts.url === 'string' ? opts.url.trim() : '';
    if (!cleanUrl || (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('/assets/quran/'))) {
      this.emit({
        status: 'unavailable',
        playbackMode: opts.mode,
        surahId: opts.surahId,
        ayahNumber: opts.ayahNumber ?? null,
        totalRepeats: 1,
        currentRepeatIndex: 1,
        repeatWindowSecondsLeft: 0,
        currentTimeSeconds: 0,
        durationSeconds: 0,
        activeUrl: null,
        errorCode: 'UNVERIFIED',
        errorMessage: 'No valid server-returned Quran Foundation HTTPS audio URL is available for this selection.',
      });
      return false;
    }

    const totalRepeats = Math.max(1, Math.min(5, Math.round(opts.repeatCount ?? 1)));
    const pauseSecs = Math.max(0, Math.min(8, Math.round(opts.repeatPauseSeconds ?? 0)));

    for (let i = 1; i <= totalRepeats; i += 1) {
      if (this.cancelled || this.activeRunId !== runId) return false;
      this.emit({
        status: 'loading',
        playbackMode: opts.mode,
        surahId: opts.surahId,
        ayahNumber: opts.ayahNumber ?? null,
        currentRepeatIndex: i,
        totalRepeats,
        repeatWindowSecondsLeft: 0,
        currentTimeSeconds: 0,
        durationSeconds: 0,
        activeUrl: cleanUrl,
        errorCode: undefined,
        errorMessage: undefined,
      });

      const res = await this.playSingleUrl(cleanUrl, runId);
      if (this.cancelled || this.activeRunId !== runId) return false;
      if (!res.ok) {
        this.emit({
          status: 'error',
          errorCode: res.errorCode || 'PLAYBACK_FAILED',
          errorMessage: res.errorMessage || 'Audio file could not be loaded.',
        });
        return false;
      }

      if (i < totalRepeats && pauseSecs > 0) {
        const waited = await this.waitRepeatWindow(pauseSecs, runId);
        if (!waited) return false;
      }
    }

    this.emit({
      status: 'completed',
      repeatWindowSecondsLeft: 0,
    });
    return true;
  }

  /**
   * Plays an ordered multi-step Surah sequence (e.g., Basmala -> Quran Foundation Surah -> Closing Phrase).
   * - Never overlaps or modifies/re-encodes audio files.
   * - Supports pause, resume, seek, stop, repeat, and track navigation mid-sequence.
   * - Marks playback 'completed' and triggers `onSequenceCompleted` ONLY after the final step finishes.
   */
  public async playSurahSequence(opts: {
    surahId: string;
    steps: QuranSequenceStep[];
    repeatCount?: number;
    repeatPauseSeconds?: number;
    onStepChange?: (step: QuranSequenceStep, stepIndex: number, totalSteps: number) => void;
    onSequenceCompleted?: () => void;
  }): Promise<boolean> {
    this.stop();
    this.cancelled = false;
    const runId = this.activeRunId;

    const validSteps = (opts.steps || []).filter((s) => isValidSafeQuranAudioUrl(s.url));
    if (validSteps.length === 0 || validSteps.length !== (opts.steps || []).length) {
      this.emit({
        status: 'unavailable',
        playbackMode: 'surah',
        surahId: opts.surahId,
        ayahNumber: null,
        totalRepeats: 1,
        currentRepeatIndex: 1,
        repeatWindowSecondsLeft: 0,
        currentTimeSeconds: 0,
        durationSeconds: 0,
        activeUrl: null,
        sequencePhase: null,
        sequenceStepIndex: undefined,
        sequenceTotalSteps: undefined,
        sequenceStepPhases: undefined,
        errorCode: 'UNVERIFIED',
        errorMessage: 'No valid Surah recitation sequence URLs are available.',
      });
      return false;
    }

    const totalRepeats = Math.max(1, Math.min(5, Math.round(opts.repeatCount ?? 1)));
    const pauseSecs = Math.max(0, Math.min(8, Math.round(opts.repeatPauseSeconds ?? 0)));
    const stepPhases = validSteps.map((s) => s.phase);

    for (let cycle = 1; cycle <= totalRepeats; cycle += 1) {
      if (this.cancelled || this.activeRunId !== runId) return false;

      for (let i = 0; i < validSteps.length; i += 1) {
        if (this.cancelled || this.activeRunId !== runId) return false;
        const step = validSteps[i];
        const stepNumber = i + 1;

        this.emit({
          status: 'loading',
          playbackMode: 'surah',
          surahId: opts.surahId,
          ayahNumber: null,
          currentRepeatIndex: cycle,
          totalRepeats,
          repeatWindowSecondsLeft: 0,
          currentTimeSeconds: 0,
          durationSeconds: 0,
          activeUrl: step.url,
          sequencePhase: step.phase,
          sequenceStepIndex: stepNumber,
          sequenceTotalSteps: validSteps.length,
          sequenceStepPhases: stepPhases,
          errorCode: undefined,
          errorMessage: undefined,
        });

        opts.onStepChange?.(step, stepNumber, validSteps.length);

        const res = await this.playSingleUrl(step.url, runId);
        if (this.cancelled || this.activeRunId !== runId) return false;
        if (!res.ok) {
          this.emit({
            status: 'error',
            errorCode: res.errorCode || 'PLAYBACK_FAILED',
            errorMessage: res.errorMessage || 'Audio file could not be loaded.',
          });
          return false;
        }
      }

      if (cycle < totalRepeats && pauseSecs > 0) {
        const waited = await this.waitRepeatWindow(pauseSecs, runId);
        if (!waited) return false;
      }
    }

    if (this.cancelled || this.activeRunId !== runId) return false;
    this.emit({
      status: 'completed',
      repeatWindowSecondsLeft: 0,
    });
    opts.onSequenceCompleted?.();
    return true;
  }

  public dispose() {
    this.stop();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}
