import { useCallback, useEffect, useMemo, useState } from 'react';
import academyAudioLookup from '../data/academyAudioLookup.json';
import {
  type AcademyAudioLang,
  getAcademyAudioUrlFromAssetId,
  normalizeAcademyAudioText,
} from './academyAudioText';

export type AcademyAudioStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type AcademyAudioErrorCode =
  | 'NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'DAILY_QUOTA'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'INVALID_AUDIO'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNAVAILABLE';

export interface AcademyAudioSnapshot {
  status: AcademyAudioStatus;
  label: string;
  lang: 'ar' | 'en';
  slow: boolean;
  currentUrl: string | null;
  currentTime: number;
  duration: number;
  errorMessage?: string;
  errorCode?: AcademyAudioErrorCode;
  canRetry: boolean;
}

export interface PlayAcademyAudioOptions {
  slow?: boolean;
  label?: string;
  audioUrl?: string;
  csrfToken?: string | null;
}

interface LastPlayRequest {
  text: string;
  lang: 'ar' | 'en';
  options: PlayAcademyAudioOptions;
}

const lookupData = academyAudioLookup as {
  ar: Record<string, string>;
  en: Record<string, string>;
};

export function resolveAcademyRecordingUrl(
  text: string,
  lang: AcademyAudioLang,
  explicitAudioUrl?: string,
): string | null {
  if (isSafeAcademyAudioUrl(explicitAudioUrl)) {
    return explicitAudioUrl.trim();
  }
  const clean = normalizeAcademyAudioText(text);
  if (!clean) return null;
  const langMap = lang === 'en' ? lookupData.en : lookupData.ar;
  const assetId = langMap?.[clean];
  if (!assetId) return null;
  return getAcademyAudioUrlFromAssetId(assetId, lang);
}

function isSafeAcademyAudioUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if ((trimmed.startsWith('/assets/') || trimmed.startsWith('/api/')) && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function localizedError(
  uiLang: 'ar' | 'en',
  code: AcademyAudioErrorCode,
): string {
  switch (code) {
    case 'NOT_ALLOWED':
      return uiLang === 'ar'
        ? 'اضغط على زر إعادة المحاولة لتشغيل الصوت على جهازك.'
        : 'Tap Retry to start audio playback on this device.';
    case 'TIMEOUT':
      return uiLang === 'ar'
        ? 'استغرق تحميل التسجيل الصوتي وقتاً أطول من المعتاد. اضغط إعادة المحاولة.'
        : 'Audio loading timed out. Tap Retry to try again.';
    case 'INVALID_AUDIO':
      return uiLang === 'ar'
        ? 'تعذر تشغيل ملف التسجيل الصوتي على هذا الجهاز.'
        : 'Could not decode or play the stored audio recording on this device.';
    case 'NETWORK':
      return uiLang === 'ar'
        ? 'تعذر تحميل ملف الصوت. تأكد من الاتصال واضغط إعادة المحاولة.'
        : 'Network error loading stored audio. Check connection and tap Retry.';
    case 'TEMPORARILY_UNAVAILABLE':
    case 'UNAVAILABLE':
    default:
      return uiLang === 'ar'
        ? 'التسجيل الصوتي غير متوفر لهذا العنصر حالياً.'
        : 'Pre-recorded audio is not available for this item yet.';
  }
}

export class AcademyAudioController {
  private audio: HTMLAudioElement | null = null;
  private token = 0;
  private cleanupListeners: (() => void) | null = null;
  private lastRequest: LastPlayRequest | null = null;
  private listeners = new Set<(snap: AcademyAudioSnapshot) => void>();
  private uiLang: 'ar' | 'en' = 'ar';
  private playbackUrlCache = new Map<string, string>();

  private snapshot: AcademyAudioSnapshot = {
    status: 'idle',
    label: '',
    lang: 'ar',
    slow: false,
    currentUrl: null,
    currentTime: 0,
    duration: 0,
    canRetry: false,
  };

  setContext(uiLang: 'ar' | 'en', _csrfToken?: string | null) {
    this.uiLang = uiLang;
  }

  subscribe(listener: (snap: AcademyAudioSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.snapshot });
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AcademyAudioSnapshot {
    return { ...this.snapshot };
  }

  private emit(patch?: Partial<AcademyAudioSnapshot>) {
    if (patch) {
      this.snapshot = { ...this.snapshot, ...patch };
    }
    const copy = { ...this.snapshot };
    this.listeners.forEach((fn) => fn(copy));
  }

  private teardownAudioElement() {
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {
        // ignore headless cleanup errors
      }
      this.audio = null;
    }
  }

  async playText(
    text: string,
    lang: 'ar' | 'en',
    options: PlayAcademyAudioOptions = {},
  ): Promise<boolean> {
    const cleanText = normalizeAcademyAudioText(text);
    const explicitUrl = isSafeAcademyAudioUrl(options.audioUrl) ? options.audioUrl.trim() : undefined;
    if (!cleanText && !explicitUrl) {
      return false;
    }

    this.teardownAudioElement();
    const myToken = ++this.token;
    const slow = Boolean(options.slow);
    const label = options.label?.trim() || cleanText;

    this.lastRequest = { text: cleanText, lang, options: { ...options } };

    const cacheKey = `${lang}|${cleanText}`;
    const resolvedUrl =
      explicitUrl ||
      this.playbackUrlCache.get(cacheKey) ||
      resolveAcademyRecordingUrl(cleanText, lang, explicitUrl);

    if (!resolvedUrl) {
      this.emit({
        status: 'error',
        label,
        lang,
        slow,
        currentUrl: null,
        currentTime: 0,
        duration: 0,
        errorCode: 'UNAVAILABLE',
        errorMessage: localizedError(this.uiLang, 'UNAVAILABLE'),
        canRetry: false,
      });
      return false;
    }

    this.playbackUrlCache.set(cacheKey, resolvedUrl);

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      this.emit({
        status: 'error',
        label,
        lang,
        slow,
        currentUrl: resolvedUrl,
        currentTime: 0,
        duration: 0,
        errorCode: 'UNAVAILABLE',
        errorMessage: localizedError(this.uiLang, 'UNAVAILABLE'),
        canRetry: false,
      });
      return false;
    }

    // Prepare audio element synchronously inside gesture stack for Android WebView / Median
    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    this.audio = audio;

    this.emit({
      status: 'loading',
      label,
      lang,
      slow,
      currentUrl: resolvedUrl,
      currentTime: 0,
      duration: 0,
      errorCode: undefined,
      errorMessage: undefined,
      canRetry: false,
    });

    let hadElementError = false;
    const rate = slow ? 0.78 : 1.0;

    const handleLoadedMetadata = () => {
      if (this.token !== myToken) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.emit({ duration: audio.duration });
      }
    };
    const handleCanPlay = () => {
      if (this.token !== myToken) return;
      if (this.snapshot.status === 'loading' && !audio.paused) {
        this.emit({ status: 'playing' });
      }
    };
    const handleTimeUpdate = () => {
      if (this.token !== myToken) return;
      this.emit({
        currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
        duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : this.snapshot.duration,
      });
    };
    const handleEnded = () => {
      if (this.token !== myToken) return;
      this.emit({
        status: 'ended',
        currentTime: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : this.snapshot.duration,
      });
    };
    const handleError = () => {
      if (this.token !== myToken) return;
      hadElementError = true;
      this.emit({
        status: 'error',
        errorCode: 'INVALID_AUDIO',
        errorMessage: localizedError(this.uiLang, 'INVALID_AUDIO'),
        canRetry: true,
      });
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    this.cleanupListeners = () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };

    audio.src = resolvedUrl;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;

    try {
      await audio.play();
      if (this.token !== myToken) {
        audio.pause();
        return false;
      }
      audio.playbackRate = rate;
      this.emit({ status: 'playing', errorCode: undefined, errorMessage: undefined, canRetry: false });
      return true;
    } catch (playErr) {
      if (this.token !== myToken || hadElementError) return false;
      const errName = playErr instanceof DOMException ? playErr.name : (playErr as { name?: string })?.name;
      const code: AcademyAudioErrorCode = errName === 'NotAllowedError' ? 'NOT_ALLOWED' : 'INVALID_AUDIO';
      this.emit({
        status: 'error',
        errorCode: code,
        errorMessage: localizedError(this.uiLang, code),
        canRetry: true,
      });
      return false;
    }
  }

  pause() {
    if (!this.audio) return;
    if (this.snapshot.status === 'playing' || this.snapshot.status === 'loading') {
      try {
        this.audio.pause();
      } catch {
        // ignore
      }
      this.emit({ status: 'paused' });
    }
  }

  async resume(): Promise<boolean> {
    if (!this.audio || !this.snapshot.currentUrl) return false;
    const myToken = this.token;
    try {
      this.audio.playbackRate = this.snapshot.slow ? 0.78 : 1.0;
      await this.audio.play();
      if (this.token !== myToken) return false;
      this.emit({ status: 'playing', errorCode: undefined, errorMessage: undefined });
      return true;
    } catch {
      if (this.token !== myToken) return false;
      this.emit({
        status: 'error',
        errorCode: 'NOT_ALLOWED',
        errorMessage: localizedError(this.uiLang, 'NOT_ALLOWED'),
        canRetry: true,
      });
      return false;
    }
  }

  async replay(): Promise<boolean> {
    if (!this.lastRequest) return false;
    return this.playText(this.lastRequest.text, this.lastRequest.lang, this.lastRequest.options);
  }

  async retryLast(): Promise<boolean> {
    return this.replay();
  }

  stop() {
    this.token += 1;
    this.teardownAudioElement();
    this.emit({
      status: 'idle',
      currentUrl: null,
      currentTime: 0,
      duration: 0,
      errorCode: undefined,
      errorMessage: undefined,
      canRetry: false,
    });
  }

  dismissFeedback() {
    if (this.snapshot.status === 'error' || this.snapshot.status === 'ended') {
      this.stop();
    }
  }
}

export function useAcademyAudio(
  uiLang: 'ar' | 'en',
  opts?: { csrfToken?: string | null; muted?: boolean },
) {
  const controller = useMemo(() => new AcademyAudioController(), []);
  const [snapshot, setSnapshot] = useState<AcademyAudioSnapshot>(() => controller.getSnapshot());

  useEffect(() => {
    controller.setContext(uiLang, opts?.csrfToken);
  }, [controller, uiLang, opts?.csrfToken]);

  useEffect(() => {
    const unsub = controller.subscribe(setSnapshot);
    const onVisibilityChange = () => {
      if (document.hidden) {
        controller.pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsub();
      controller.stop();
    };
  }, [controller]);

  useEffect(() => {
    if (opts?.muted) {
      controller.stop();
    }
  }, [controller, opts?.muted]);

  const speak = useCallback(
    (text: string, lang: 'ar' | 'en', options?: PlayAcademyAudioOptions) => {
      if (opts?.muted) return Promise.resolve(false);
      return controller.playText(text, lang, options);
    },
    [controller, opts?.muted],
  );

  const pause = useCallback(() => controller.pause(), [controller]);
  const resume = useCallback(() => controller.resume(), [controller]);
  const replay = useCallback(() => controller.replay(), [controller]);
  const retry = useCallback(() => controller.retryLast(), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  const dismiss = useCallback(() => controller.dismissFeedback(), [controller]);

  return {
    snapshot,
    speak,
    pause,
    resume,
    replay,
    retry,
    stop,
    dismiss,
  };
}
