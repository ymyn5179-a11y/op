/**
 * Dedicated Story Audio Controller for "حكايات من القرآن"
 * - Wraps HTMLAudioElement for recorded/approved story narration tracks.
 * - Never fabricates playback state when a narration audio file is absent.
 * - Prevents overlapping audio, stale callbacks, or orphaned playback on exit/switch.
 */

export type StoryAudioStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'unavailable'
  | 'error';

export interface StoryAudioStateSnapshot {
  status: StoryAudioStatus;
  currentTime: number;
  duration: number;
  errorMessage?: string;
}

export interface StoryAudioCallbacks {
  onStateChange: (snapshot: StoryAudioStateSnapshot) => void;
  onEnded?: () => void;
}

export function isSafeStoryAudioUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/assets/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export class StoryAudioController {
  private audio: HTMLAudioElement | null = null;
  private token = 0;
  private currentUrl: string | null = null;
  private status: StoryAudioStatus = 'idle';
  private duration = 0;
  private currentTime = 0;
  private pendingSeekSeconds: number | null = null;
  private callbacks: StoryAudioCallbacks | null = null;
  private cleanupListeners: (() => void) | null = null;

  private emit(errorMessage?: string) {
    this.callbacks?.onStateChange({
      status: this.status,
      currentTime: this.currentTime,
      duration: this.duration,
      errorMessage,
    });
  }

  private teardownElement() {
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
        // Ignore cleanup failures in headless environments
      }
      this.audio = null;
    }
  }

  getSnapshot(): StoryAudioStateSnapshot {
    return {
      status: this.status,
      currentTime: this.currentTime,
      duration: this.duration,
    };
  }

  prepareScene(
    url: string | null | undefined,
    expectedDurationSeconds: number,
    callbacks: StoryAudioCallbacks,
  ) {
    this.stop();
    this.callbacks = callbacks;
    this.duration = Math.max(0, expectedDurationSeconds || 0);
    this.currentTime = 0;
    this.pendingSeekSeconds = null;

    if (!isSafeStoryAudioUrl(url)) {
      this.currentUrl = null;
      this.status = 'unavailable';
      this.emit();
      return;
    }

    this.currentUrl = url.trim();
    this.status = 'idle';
    this.emit();
  }

  async playScene(
    url: string | null | undefined,
    expectedDurationSeconds: number,
    callbacks: StoryAudioCallbacks,
  ): Promise<boolean> {
    const preservedSeek = this.pendingSeekSeconds;
    this.stop();
    const myToken = ++this.token;
    this.callbacks = callbacks;
    this.duration = Math.max(0, expectedDurationSeconds || 0);
    this.currentTime = preservedSeek ?? 0;
    this.pendingSeekSeconds = preservedSeek;

    if (!isSafeStoryAudioUrl(url)) {
      this.currentUrl = null;
      this.pendingSeekSeconds = null;
      this.status = 'unavailable';
      this.emit();
      return false;
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      this.currentUrl = url.trim();
      this.status = 'unavailable';
      this.emit('Audio playback requires a browser environment.');
      return false;
    }

    const cleanUrl = url.trim();
    this.currentUrl = cleanUrl;
    this.status = 'loading';
    this.emit();

    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.src = cleanUrl;
    this.audio = audio;

    let hadElementError = false;

    const applyPendingSeek = () => {
      if (this.pendingSeekSeconds === null) return;
      const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : this.duration;
      const target = Math.max(0, Math.min(maxDur || this.pendingSeekSeconds, this.pendingSeekSeconds));
      try {
        audio.currentTime = target;
        this.currentTime = target;
      } catch {
        // ignore if metadata not yet seekable
      }
      this.pendingSeekSeconds = null;
    };

    const handleLoadedMetadata = () => {
      if (this.token !== myToken) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.duration = audio.duration;
      }
      applyPendingSeek();
      this.emit();
    };

    const handleDurationChange = () => {
      if (this.token !== myToken) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.duration = audio.duration;
        this.emit();
      }
    };

    const handleTimeUpdate = () => {
      if (this.token !== myToken) return;
      this.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.duration = audio.duration;
      }
      this.emit();
    };

    const handleEnded = () => {
      if (this.token !== myToken) return;
      this.status = 'ended';
      this.currentTime = this.duration;
      this.emit();
      this.callbacks?.onEnded?.();
    };

    const handleError = () => {
      if (this.token !== myToken) return;
      hadElementError = true;
      this.status = 'error';
      this.emit('تعذّر تشغيل الملف الصوتي لهذا المشهد.');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    this.cleanupListeners = () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };

    try {
      await audio.play();
      if (this.token !== myToken) {
        audio.pause();
        return false;
      }
      applyPendingSeek();
      this.status = 'playing';
      this.emit();
      return true;
    } catch (err) {
      if (this.token !== myToken) return false;
      if (hadElementError || (this.status as StoryAudioStatus) === 'error') {
        return false;
      }
      const errName = err instanceof DOMException ? err.name : (err as { name?: string })?.name;
      if (errName === 'NotAllowedError') {
        this.status = 'idle';
        this.emit('اضغط زر الاستماع لتشغيل صوت القصة على جهازك.');
        return false;
      }
      this.status = 'error';
      this.emit('تعذّر تشغيل الملف الصوتي لهذا المشهد.');
      return false;
    }
  }

  pause() {
    if (!this.audio) return;
    if (this.status === 'playing' || this.status === 'loading') {
      try {
        this.audio.pause();
      } catch {
        // ignore
      }
      this.status = 'paused';
      this.emit();
    }
  }

  async resume(): Promise<boolean> {
    if (!this.audio || !this.currentUrl) return false;
    const myToken = this.token;
    try {
      await this.audio.play();
      if (this.token !== myToken) return false;
      this.status = 'playing';
      this.emit();
      return true;
    } catch {
      if (this.token !== myToken) return false;
      this.status = 'error';
      this.emit('تعذّر استئناف الصوت.');
      return false;
    }
  }

  async replay(): Promise<boolean> {
    if (!this.currentUrl || !this.callbacks) return false;
    this.pendingSeekSeconds = null;
    return this.playScene(this.currentUrl, this.duration, this.callbacks);
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds) || this.status === 'unavailable') return;
    const maxDur =
      this.audio && Number.isFinite(this.audio.duration) && this.audio.duration > 0
        ? this.audio.duration
        : this.duration;
    const clamped = Math.max(0, Math.min(maxDur || seconds, seconds));
    if (!this.audio) {
      this.pendingSeekSeconds = clamped;
      this.currentTime = clamped;
      this.emit();
      return;
    }
    try {
      this.audio.currentTime = clamped;
      this.currentTime = clamped;
      if (this.status === 'ended') {
        this.status = 'paused';
      }
      this.emit();
    } catch {
      // ignore seek failure on unbuffered stream
    }
  }

  stop() {
    this.token += 1;
    this.teardownElement();
    this.currentUrl = null;
    this.currentTime = 0;
    this.pendingSeekSeconds = null;
    if (this.status !== 'unavailable') {
      this.status = 'idle';
    }
  }
}
