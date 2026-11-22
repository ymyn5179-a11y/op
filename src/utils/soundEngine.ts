import { Language, ParentSettings } from '../types/nonoland';

class NonoSoundEngine {
  private ctx: AudioContext | null = null;
  private settings: ParentSettings = {
    language: 'ar',
    musicEnabled: true,
    sfxVolume: 0.7,
    voiceNarration: true,
    muted: false,
    dailyScreenTimeMinutes: 45,
    allowLocalAudioSynthesis: true,
    offlineSyncEnabled: true,
  };

  updateSettings(next: ParentSettings) {
    this.settings = next;
    if (next.muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.settings.allowLocalAudioSynthesis || this.settings.muted || this.settings.sfxVolume <= 0) {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0, gainPeak = 0.16) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = gainPeak * this.settings.sfxVolume;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, vol), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPop() {
    this.playTone(520, 0.09, 'sine', 0, 0.12);
    this.playTone(680, 0.08, 'triangle', 0.04, 0.1);
  }

  playSuccess() {
    this.playTone(523.25, 0.14, 'triangle', 0, 0.15); // C5
    this.playTone(659.25, 0.14, 'triangle', 0.09, 0.15); // E5
    this.playTone(783.99, 0.24, 'sine', 0.18, 0.18); // G5
  }

  playEncourage() {
    // Gentle warm soft double-note (never harsh or punitive!)
    this.playTone(392, 0.16, 'sine', 0, 0.1);
    this.playTone(440, 0.18, 'sine', 0.12, 0.1);
  }

  playCelebration() {
    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', idx * 0.09, 0.16);
    });
  }

  playMusicNote(index: number) {
    const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const freq = pentatonic[index % pentatonic.length];
    this.playTone(freq, 0.35, 'sine', 0, 0.2);
    this.playTone(freq * 2, 0.2, 'triangle', 0.02, 0.05);
  }

  playInstrument(instrument: 'xylophone' | 'drum' | 'flute' | 'bell', noteIdx = 0) {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const freq = scale[noteIdx % scale.length];
    if (instrument === 'drum') {
      this.playTone(110 + noteIdx * 18, 0.16, 'sine', 0, 0.25);
      this.playTone(75, 0.12, 'triangle', 0.01, 0.18);
    } else if (instrument === 'flute') {
      this.playTone(freq * 1.5, 0.4, 'sine', 0, 0.15);
    } else if (instrument === 'bell') {
      this.playTone(freq * 2, 0.48, 'sine', 0, 0.14);
      this.playTone(freq * 3, 0.28, 'sine', 0.01, 0.06);
    } else {
      this.playMusicNote(noteIdx);
    }
  }

  private activeTimers: number[] = [];
  private activePlaybackId = 0;

  stopAllAudio() {
    this.activePlaybackId += 1;
    if (typeof window !== 'undefined') {
      for (const timer of this.activeTimers) {
        window.clearTimeout(timer);
      }
      this.activeTimers = [];
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  playMelodySequence(
    notes: Array<{ noteIdx: number; instrument?: 'xylophone' | 'drum' | 'flute' | 'bell'; delayMs: number }>,
    onStep?: (stepIdx: number) => void,
    onDone?: () => void,
  ): () => void {
    this.stopAllAudio();
    const runId = this.activePlaybackId;
    if (typeof window === 'undefined') return () => {};

    let maxDelay = 0;
    notes.forEach((n, idx) => {
      maxDelay = Math.max(maxDelay, n.delayMs);
      const t = window.setTimeout(() => {
        if (this.activePlaybackId !== runId) return;
        this.playInstrument(n.instrument || 'xylophone', n.noteIdx);
        onStep?.(idx);
      }, n.delayMs);
      this.activeTimers.push(t);
    });

    const endTimer = window.setTimeout(() => {
      if (this.activePlaybackId !== runId) return;
      onDone?.();
    }, maxDelay + 360);
    this.activeTimers.push(endTimer);

    return () => {
      if (this.activePlaybackId === runId) {
        this.stopAllAudio();
      }
    };
  }

  playStorySfx(
    cue: 'birds' | 'waves' | 'whale' | 'stars' | 'river' | 'forest' | 'dawn' | 'cave' | 'chime',
    sfxMuted = false,
  ) {
    if (sfxMuted || this.settings.muted || !this.settings.allowLocalAudioSynthesis) return;
    switch (cue) {
      case 'birds':
        this.playTone(880, 0.08, 'sine', 0, 0.09);
        this.playTone(1046.5, 0.08, 'sine', 0.09, 0.09);
        this.playTone(987.77, 0.12, 'triangle', 0.2, 0.08);
        break;
      case 'waves':
        this.playTone(220, 0.35, 'sine', 0, 0.08);
        this.playTone(293.66, 0.38, 'sine', 0.14, 0.07);
        break;
      case 'whale':
        this.playTone(146.83, 0.45, 'sine', 0, 0.11);
        this.playTone(196, 0.38, 'triangle', 0.18, 0.07);
        break;
      case 'stars':
        this.playTone(783.99, 0.16, 'sine', 0, 0.08);
        this.playTone(1046.5, 0.2, 'sine', 0.12, 0.08);
        this.playTone(1318.5, 0.24, 'sine', 0.24, 0.07);
        break;
      case 'river':
        this.playTone(440, 0.14, 'sine', 0, 0.08);
        this.playTone(523.25, 0.16, 'sine', 0.09, 0.08);
        this.playTone(587.33, 0.2, 'sine', 0.18, 0.07);
        break;
      case 'forest':
        this.playTone(392, 0.24, 'triangle', 0, 0.08);
        this.playTone(523.25, 0.26, 'sine', 0.12, 0.08);
        break;
      case 'dawn':
        this.playTone(329.63, 0.24, 'sine', 0, 0.08);
        this.playTone(392, 0.26, 'sine', 0.11, 0.08);
        this.playTone(523.25, 0.3, 'triangle', 0.22, 0.09);
        break;
      case 'cave':
        this.playTone(261.63, 0.32, 'sine', 0, 0.09);
        this.playTone(392, 0.35, 'sine', 0.16, 0.07);
        break;
      case 'chime':
      default:
        this.playSuccess();
        break;
    }
  }

  speak(text: string, lang: Language, options?: { slow?: boolean }) {
    if (this.settings.muted || !this.settings.voiceNarration) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
      utter.rate = options?.slow ? 0.62 : 0.92;
      utter.pitch = 1.1;
      utter.volume = Math.min(1, Math.max(0.2, this.settings.sfxVolume));
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis gracefully skipped if unavailable in headless environment
    }
  }

  stopSpeech() {
    this.stopAllAudio();
  }
}

export const soundEngine = new NonoSoundEngine();
