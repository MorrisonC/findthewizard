/**
 * Procedural Web Audio Sound Effects for VEILKEEP
 * Zero external asset dependencies — 100% synthesized in real time.
 */

class SoundFXManager {
  private ctx: AudioContext | null = null;
  private initialized = false;

  private init(): AudioContext | null {
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

  public ensureInit(): void {
    if (!this.initialized) {
      this.init();
      this.initialized = true;
    }
  }

  /**
   * Blade attack whoosh / slash
   */
  public playSlash(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Filtered noise swoosh + downward pitch sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Flesh & armor impact thud when striking a guard
   */
  public playHit(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Punchy low-frequency thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Heavy damage sound when player gets hurt
   */
  public playPlayerHurt(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  /**
   * Sparkly two-tone chime when collecting items (e.g. Iron Nail)
   */
  public playPickup(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  /**
   * Low metallic clank when interacting with a locked door
   */
  public playLocked(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110, now);
    osc2.frequency.setValueAtTime(73, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.17);
    osc2.stop(now + 0.17);
  }

  /**
   * Harmonious chime chord when solving a puzzle or unlocking a gate
   */
  public playPuzzleSolved(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant celestial chord (D4, F#4, A4, D5)
    const notes = [293.66, 369.99, 440.0, 587.33];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.16, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }

  /**
   * Footstep heel tap on flagstone
   */
  public playFootstep(isSprint = false): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    const pitch = isSprint ? 120 + Math.random() * 20 : 90 + Math.random() * 15;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    const vol = isSprint ? 0.09 : 0.05;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Dialogue click / page rustle
   */
  public playDialogueNext(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Inventory satchel buckle / latch sound
   */
  public playInventoryToggle(open: boolean): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(open ? 220 : 330, now);
    osc.frequency.exponentialRampToValueAtTime(open ? 330 : 180, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Resonant crystalline chime for Echo Bell ([F])
   */
  public playEchoBell(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [880.0, 1320.0, 1760.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const peakVol = 0.18 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peakVol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2 + idx * 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.6);
    });
  }

  private truthOsc: OscillatorNode | null = null;
  private truthGain: GainNode | null = null;

  /**
   * Continuous ethereal hum for Truth Lens ([Q])
   */
  public startTruthLensHum(): void {
    const ctx = this.init();
    if (!ctx || this.truthOsc) return;
    const now = ctx.currentTime;

    this.truthOsc = ctx.createOscillator();
    this.truthGain = ctx.createGain();

    this.truthOsc.type = 'sine';
    this.truthOsc.frequency.setValueAtTime(216, now);

    this.truthGain.gain.setValueAtTime(0.001, now);
    this.truthGain.gain.linearRampToValueAtTime(0.07, now + 0.3);

    this.truthOsc.connect(this.truthGain);
    this.truthGain.connect(ctx.destination);

    this.truthOsc.start(now);
  }

  public stopTruthLensHum(): void {
    if (!this.ctx || !this.truthGain || !this.truthOsc) return;
    const now = this.ctx.currentTime;
    this.truthGain.gain.linearRampToValueAtTime(0.001, now + 0.2);
    setTimeout(() => {
      try {
        this.truthOsc?.stop();
        this.truthOsc?.disconnect();
      } catch {}
      this.truthOsc = null;
      this.truthGain = null;
    }, 250);
  }

  /**
   * Arcane Spells & Critical Combat SFX
   */
  public playDecoyCast(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [350, 520, 780, 1040];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0.001, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.4);
    });
  }

  public playShadowStep(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playGlassDart(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playGlassShatter(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    [1200, 1800, 2400, 3100].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq + Math.random() * 200, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  public playCriticalHit(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    subOsc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.3);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.36);
    subOsc.stop(now + 0.36);
  }

  /**
   * Procedural Atmospheric Victorian Gothic Music Engine
   */
  private musicStarted = false;
  private musicPadGain: GainNode | null = null;
  private musicPulseGain: GainNode | null = null;
  private pulseInterval: number | null = null;

  public startAmbientMusic(): void {
    if (this.musicStarted) return;
    const ctx = this.init();
    if (!ctx) return;
    this.musicStarted = true;

    // Exploration Pad: D-minor celestial cathedral drone
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.001, ctx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.038, ctx.currentTime + 3.0);
    padGain.connect(ctx.destination);
    this.musicPadGain = padGain;

    const droneNotes = [73.42, 110.0, 146.83, 174.61]; // D2, A2, D3, F3
    droneNotes.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.connect(padGain);
      osc.start();
    });

    // Combat Clockwork Pulse channel
    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(0.001, ctx.currentTime);
    pulseGain.connect(ctx.destination);
    this.musicPulseGain = pulseGain;

    // Rhythmic 120BPM Clockwork Tick
    let step = 0;
    this.pulseInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicPulseGain || this.musicPulseGain.gain.value < 0.005) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const isDownbeat = step % 4 === 0;
      osc.frequency.setValueAtTime(isDownbeat ? 65 : 120, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
      g.gain.setValueAtTime(isDownbeat ? 0.12 : 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g);
      g.connect(this.musicPulseGain);
      osc.start(t);
      osc.stop(t + 0.1);
      step++;
    }, 250);
  }

  public setMusicState(mode: 'explore' | 'combat'): void {
    if (!this.ctx || !this.musicPadGain || !this.musicPulseGain) return;
    const now = this.ctx.currentTime;
    if (mode === 'combat') {
      this.musicPadGain.gain.linearRampToValueAtTime(0.02, now + 1.0);
      this.musicPulseGain.gain.linearRampToValueAtTime(0.08, now + 0.8);
    } else {
      this.musicPadGain.gain.linearRampToValueAtTime(0.038, now + 1.5);
      this.musicPulseGain.gain.linearRampToValueAtTime(0.001, now + 1.2);
    }
  }

  public stopAmbientMusic(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
    this.musicStarted = false;
  }

  /**
   * Harmonic Parry metallic clash & spark sound
   */
  public playParry(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant high-grade steel impact
    const freqs = [1050, 1575, 2100, 3150];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25 / (idx + 1), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 + idx * 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  public playMirrorBolt(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playWraithTeleport(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playLoreInspect(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.05);
      gain.gain.setValueAtTime(0.001, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.55);
    });
  }

  public setMusicVolume(val: number): void {
    if (!this.ctx || !this.musicPadGain) return;
    this.musicPadGain.gain.setValueAtTime(Math.max(0.0001, val * 0.038), this.ctx.currentTime);
  }
}

export const SoundFX = new SoundFXManager();
