import { soundEngine } from './soundEngine';

/**
 * Lightweight, procedural Web Audio API sound designer for the NonoLand Cinematic Intro.
 * Zero external audio files required, zero overlapping soundtracks, strictly respects
 * browser autoplay policies (requires explicit user gesture) and parent mute preferences.
 */
class CinematicSoundController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Array<{ osc?: OscillatorNode; gain?: GainNode }> = [];
  private activeTimers: number[] = [];
  private playbackToken = 0;
  private enabled = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public unlockAndEnable(muted: boolean): boolean {
    if (muted || typeof window === 'undefined') {
      this.stopAll();
      return false;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.22;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.enabled = true;
    return true;
  }

  public setMuted(muted: boolean) {
    if (muted) {
      this.enabled = false;
      this.stopAll();
    }
  }

  public stopAll() {
    this.playbackToken += 1;
    if (typeof window !== 'undefined') {
      for (const t of this.activeTimers) {
        window.clearTimeout(t);
      }
    }
    this.activeTimers = [];
    for (const item of this.activeNodes) {
      try {
        item.osc?.stop();
        item.osc?.disconnect();
        item.gain?.disconnect();
      } catch {
        // already stopped
      }
    }
    this.activeNodes = [];
  }

  private playTone(
    freq: number,
    durationSec: number,
    options?: {
      type?: OscillatorType;
      delaySec?: number;
      peak?: number;
      attackSec?: number;
      filterHz?: number;
      slideToHz?: number;
    },
  ) {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime + (options?.delaySec ?? 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const peak = options?.peak ?? 0.25;
    const attack = options?.attackSec ?? 0.04;

    osc.type = options?.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (options?.slideToHz) {
      osc.frequency.exponentialRampToValueAtTime(options.slideToHz, now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    if (options?.filterHz) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(options.filterHz, now);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
    this.activeNodes.push({ osc, gain });
  }

  public playCueForScene(scene: 1 | 2 | 3 | 4 | 5 | 6, muted: boolean) {
    if (muted || !this.enabled) return;
    this.stopAll();
    this.enabled = true;

    if (scene === 1) {
      // Scene 1: Mysterious First Spark — celesta shimmer + spark glide
      this.playTone(523.25, 0.9, { type: 'sine', peak: 0.18, slideToHz: 1046.5 });
      this.playTone(783.99, 0.45, { type: 'triangle', delaySec: 0.25, peak: 0.14 });
      this.playTone(1318.51, 0.6, { type: 'sine', delaySec: 0.45, peak: 0.15 });
      this.playTone(261.63, 1.4, { type: 'sine', delaySec: 0.1, peak: 0.12, filterHz: 600 });
    } else if (scene === 2) {
      // Scene 2: Book Comes Alive — fluttering page turns + magic glow chord
      const flutterNotes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      flutterNotes.forEach((f, idx) => {
        this.playTone(f, 0.22, { type: 'triangle', delaySec: idx * 0.13, peak: 0.14 });
      });
      this.playTone(392.0, 1.3, { type: 'sine', delaySec: 0.4, peak: 0.16, filterHz: 900 });
    } else if (scene === 3) {
      // Scene 3: Portal Explosion — warm orchestral pad swell + sweeping harp
      [130.81, 196.0, 261.63].forEach((f) => {
        this.playTone(f, 1.9, { type: 'triangle', peak: 0.16, attackSec: 0.28, filterHz: 750 });
      });
      [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51].forEach((f, idx) => {
        this.playTone(f, 0.45, { type: 'sine', delaySec: 0.15 + idx * 0.1, peak: 0.14 });
      });
    } else if (scene === 4) {
      // Scene 4: Nono's Grand Entrance — joyful playful motif
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        this.playTone(f, 0.3, { type: 'triangle', delaySec: idx * 0.11, peak: 0.16 });
      });
      this.playTone(261.63, 1.4, { type: 'sine', peak: 0.13, filterHz: 650 });
    } else if (scene === 5) {
      // Scene 5: World & Logo Reveal — grand warm Cmaj9 orchestral cadence
      [130.81, 261.63, 329.63, 392.0, 493.88, 587.33].forEach((f, idx) => {
        this.playTone(f, 1.8, {
          type: idx < 2 ? 'triangle' : 'sine',
          delaySec: idx * 0.04,
          peak: 0.13,
          attackSec: 0.18,
          filterHz: 1100,
        });
      });
      this.playTone(1046.5, 0.9, { type: 'sine', delaySec: 0.22, peak: 0.18 });
    } else if (scene === 6) {
      // Scene 6: Invitation — soft warm resolving bell chime
      soundEngine.playMusicNote(4);
      this.playTone(523.25, 1.1, { type: 'sine', peak: 0.1, attackSec: 0.12 });
    }
  }
}

export const cinematicSound = new CinematicSoundController();
