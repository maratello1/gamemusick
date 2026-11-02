'use client';

import { VibeStateId } from '@/types/vibe';

class AdaptiveStemEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private masterGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private pulseGain: GainNode | null = null;
  private pulseTimer: number | null = null;
  private currentVibe: VibeStateId = 'EXPLORE';
  private masterVolume = 0.65;

  public start(initialVibe: VibeStateId = 'EXPLORE', volume = 0.65) {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isRunning) {
      this.setVibe(initialVibe);
      this.setVolume(volume);
      return;
    }

    this.isRunning = true;
    this.currentVibe = initialVibe;
    this.masterVolume = volume;

    const now = this.ctx.currentTime;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume * 0.35, now);
    this.masterGain.connect(this.ctx.destination);

    // Stem 1: Warm Ambient Pad (Explore / Victory)
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.4, now);
    this.padGain.connect(this.masterGain);

    const padOsc1 = this.ctx.createOscillator();
    const padOsc2 = this.ctx.createOscillator();
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(650, now);

    padOsc1.type = 'sine';
    padOsc2.type = 'triangle';
    padOsc1.frequency.setValueAtTime(110, now); // A2
    padOsc2.frequency.setValueAtTime(164.81, now); // E3

    padOsc1.connect(padFilter);
    padOsc2.connect(padFilter);
    padFilter.connect(this.padGain);
    padOsc1.start();
    padOsc2.start();

    // Stem 2: Dark Sub Bass (Stealth / Combat / Bossfight)
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.setValueAtTime(0.1, now);
    this.bassGain.connect(this.masterGain);

    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(180, now);
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(55, now); // A1
    bassOsc.connect(bassFilter);
    bassFilter.connect(this.bassGain);
    bassOsc.start();

    // Stem 3: Dynamic Arpeggio / Combat Pulse
    this.pulseGain = this.ctx.createGain();
    this.pulseGain.gain.setValueAtTime(0.05, now);
    this.pulseGain.connect(this.masterGain);

    this.setVibe(initialVibe);
    this.startRhythmLoop();
  }

  private startRhythmLoop() {
    if (this.pulseTimer) window.clearInterval(this.pulseTimer);

    let step = 0;
    const notesByVibe: Record<VibeStateId, number[]> = {
      EXPLORE: [220, 261.63, 329.63, 392.0],
      STEALTH: [110, 116.54, 110, 146.83],
      COMBAT: [110, 220, 130.81, 164.81, 110, 246.94, 130.81, 196.0],
      BOSSFIGHT: [55, 110, 116.54, 55, 130.81, 123.47, 55, 164.81],
      VICTORY: [220, 277.18, 329.63, 440.0],
    };

    this.pulseTimer = window.setInterval(() => {
      if (!this.isRunning || !this.ctx || !this.pulseGain) return;
      const now = this.ctx.currentTime;
      const notes = notesByVibe[this.currentVibe] || notesByVibe.EXPLORE;
      const freq = notes[step % notes.length];
      step++;

      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = this.currentVibe === 'BOSSFIGHT' || this.currentVibe === 'COMBAT' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const peak =
        this.currentVibe === 'BOSSFIGHT'
          ? 0.45
          : this.currentVibe === 'COMBAT'
          ? 0.32
          : this.currentVibe === 'STEALTH'
          ? 0.16
          : 0.12;

      env.gain.setValueAtTime(0.001, now);
      env.gain.exponentialRampToValueAtTime(peak, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(env);
      env.connect(this.pulseGain);
      osc.start(now);
      osc.stop(now + 0.24);
    }, 220);
  }

  public setVibe(vibe: VibeStateId) {
    this.currentVibe = vibe;
    if (!this.ctx || !this.padGain || !this.bassGain || !this.pulseGain) return;
    const now = this.ctx.currentTime;

    const mix: Record<VibeStateId, { pad: number; bass: number; pulse: number }> = {
      EXPLORE: { pad: 0.55, bass: 0.08, pulse: 0.15 },
      STEALTH: { pad: 0.2, bass: 0.45, pulse: 0.25 },
      COMBAT: { pad: 0.15, bass: 0.65, pulse: 0.65 },
      BOSSFIGHT: { pad: 0.1, bass: 0.85, pulse: 0.9 },
      VICTORY: { pad: 0.65, bass: 0.25, pulse: 0.4 },
    };

    const target = mix[vibe] || mix.EXPLORE;
    this.padGain.gain.setTargetAtTime(target.pad, now, 0.8);
    this.bassGain.gain.setTargetAtTime(target.bass, now, 0.8);
    this.pulseGain.gain.setTargetAtTime(target.pulse, now, 0.8);
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume * 0.35, this.ctx.currentTime, 0.2);
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.pulseTimer) {
      window.clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const stemSynth = new AdaptiveStemEngine();
