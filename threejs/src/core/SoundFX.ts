/**
 * Procedural Web Audio Sound Effects for VEILKEEP
 * Zero external asset dependencies — 100% synthesized in real time.
 */

class SoundFXManager {
  private ctx: AudioContext | null = null;
  private initialized = false;

  private init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
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
  public playSlash(tier: 1 | 2 | 3 = 1): void {
    this.playComboSlash(tier);
  }

  /**
   * Tier-scaled combo attack slash with escalating pitch, weight, and harmonic resonance
   */
  public playComboSlash(tier: 1 | 2 | 3 = 1): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const startFreq = tier === 3 ? 680 : tier === 2 ? 520 : 390;
    const endFreq = tier === 3 ? 50 : tier === 2 ? 80 : 100;
    const dur = tier === 3 ? 0.26 : tier === 2 ? 0.18 : 0.14;
    const volume = tier === 3 ? 0.35 : tier === 2 ? 0.26 : 0.2;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = tier === 3 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(tier === 3 ? 3200 : 2200, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + dur);
    if (tier === 3) filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.02);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + dur + 0.04);

    // Extra low-end bass drop for heavy finisher
    if (tier === 3) {
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(120, now);
      sub.frequency.exponentialRampToValueAtTime(38, now + 0.22);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.25);
    }
  }

  /**
   * Ethereal phase dash / tumble swoosh for dodge roll
   */
  public playDodgeRoll(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.2);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.2);
    filter.Q.setValueAtTime(1.8, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Metallic buckler deflection + crystalline ward hum on shield block
   */
  public playShieldBlock(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Metallic ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // Harmonic crystalline resonance ring
    const res = ctx.createOscillator();
    const resGain = ctx.createGain();
    res.type = 'sine';
    res.frequency.setValueAtTime(880, now);
    resGain.gain.setValueAtTime(0.18, now);
    resGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    res.connect(resGain);
    resGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
    res.start(now);
    res.stop(now + 0.3);
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
   * Heavy Victorian parchment unroll / fold rustle for Map ([M])
   */
  public playMapToggle(open: boolean): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.16);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(open ? 450 : 650, now);
    filter.frequency.exponentialRampToValueAtTime(open ? 850 : 350, now + 0.14);
    filter.Q.value = 3.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.16);
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

  public playBossPhaseShift(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    [150, 300, 600, 1200].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + idx * 0.05 + 0.35);
      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.45);
    });
  }

  public playMenuClick(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
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

  public playTreeGroan(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  public playFeastWaltz(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [330, 392, 493.88, 587.33];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      gain.gain.setValueAtTime(0.001, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.85);
    });
  }

  public playWitchGiggle(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [600, 780, 680, 920];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(0.08, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.12);
    });
  }

  // ---------- Generative Gothic Ambient & Combat Music Engine ----------
  private bgmActive = false;
  private bgmMuted = false;
  private bgmMasterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private combatGain: GainNode | null = null;
  private musicVolume = 0.65;
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private combatTimer: ReturnType<typeof setInterval> | null = null;
  private currentChordIndex = 0;
  private activePadOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private themeChords: Record<string, number[][]> = {
    gothic: [
      [110, 164.81, 220, 261.63], // A2, E3, A3, C4 (A minor)
      [87.31, 130.81, 174.61, 220], // F2, C3, F3, A3 (F major)
      [73.42, 110, 146.83, 174.61], // D2, A2, D3, F3 (D minor)
      [82.41, 123.47, 164.81, 207.65], // E2, B2, E3, G#3 (E major / dominant)
    ],
    sanctum: [
      [138.59, 207.65, 277.18, 329.63], // C#3, G#3, C#4, E4 (C# minor)
      [110, 164.81, 220, 277.18], // A2, E3, A3, C#4 (A major)
      [92.5, 138.59, 185, 220], // F#2, C#3, F#3, A3 (F# minor)
      [103.83, 155.56, 207.65, 246.94], // G#2, D#3, G#3, B3 (G# minor)
    ],
    feast: [
      [146.83, 220, 293.66, 349.23], // D3, A3, D4, F4 (D minor)
      [116.54, 174.61, 233.08, 293.66], // Bb2, F3, Bb3, D4 (Bb major)
      [98, 146.83, 196, 233.08], // G2, D3, G3, Bb3 (G minor)
      [110, 164.81, 220, 277.18], // A2, E3, A3, C#4 (A major)
    ],
    forest: [
      [82.41, 123.47, 164.81, 196], // E2, B2, E3, G3 (E minor)
      [65.41, 98, 130.81, 164.81], // C2, G2, C3, E3 (C major)
      [73.42, 110, 146.83, 185], // D2, A2, D3, F#3 (D major)
      [61.74, 92.5, 123.47, 146.83], // B1, F#2, B2, D3 (B minor)
    ],
    hearth: [
      [87.31, 130.81, 174.61, 220], // F2, C3, F3, A3 (F major)
      [65.41, 98, 130.81, 196], // C2, G2, C3, G3 (C major)
      [73.42, 110, 146.83, 174.61], // D2, A2, D3, F3 (D minor)
      [58.27, 87.31, 116.54, 174.61], // Bb1, F2, Bb2, F3 (Bb major)
    ],
  };
  private currentThemeName = 'gothic';

  public startBGM(): void {
    if (this.bgmActive) return;
    const ctx = this.init();
    if (!ctx) return;

    this.bgmActive = true;
    const now = ctx.currentTime;

    // Master BGM gain bus
    this.bgmMasterGain = ctx.createGain();
    this.bgmMasterGain.gain.setValueAtTime(this.bgmMuted ? 0 : this.musicVolume * 0.16, now);
    this.bgmMasterGain.connect(ctx.destination);

    // Ambient Pad bus
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(1.0, now);
    this.ambientGain.connect(this.bgmMasterGain);

    // Combat percussion bus
    this.combatGain = ctx.createGain();
    this.combatGain.gain.setValueAtTime(0.001, now);
    this.combatGain.connect(this.bgmMasterGain);

    // Initial chord swell
    this.triggerNextPadChord();

    // Pad chord cycle every 8 seconds
    this.chordTimer = setInterval(() => {
      this.triggerNextPadChord();
    }, 8000);

    // Combat beat pulse (120 BPM = 500ms step)
    this.combatTimer = setInterval(() => {
      this.triggerCombatPulse();
    }, 500);
  }

  public stopBGM(): void {
    if (this.chordTimer) {
      clearInterval(this.chordTimer);
      this.chordTimer = null;
    }
    if (this.combatTimer) {
      clearInterval(this.combatTimer);
      this.combatTimer = null;
    }
    this.bgmActive = false;
  }

  private triggerNextPadChord(): void {
    const ctx = this.init();
    if (!ctx || !this.ambientGain) return;
    const now = ctx.currentTime;

    // Fade out previous pad voices
    this.activePadOscs.forEach(({ osc, gain }) => {
      try {
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + 2.5);
        osc.stop(now + 2.6);
      } catch {
        // Voice already terminated
      }
    });
    this.activePadOscs = [];

    const chordList = this.themeChords[this.currentThemeName] || this.themeChords.gothic;
    const freqs = chordList[this.currentChordIndex % chordList.length];
    this.currentChordIndex++;

    // Lowpass filter for warm gothic organ/cello luster
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.linearRampToValueAtTime(850, now + 4.0);
    filter.frequency.linearRampToValueAtTime(500, now + 8.0);
    filter.Q.value = 2.5;
    filter.connect(this.ambientGain);

    freqs.forEach((freq, idx) => {
      // 2 detuned oscillators per note for lush chorusing
      [-2.5, 2.5].forEach((detuneVal) => {
        const osc = ctx.createOscillator();
        const voiceGain = ctx.createGain();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detuneVal, now);

        // Smooth swell envelope
        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(0.08 / freqs.length, now + 3.0);
        voiceGain.gain.setValueAtTime(0.08 / freqs.length, now + 5.5);
        voiceGain.gain.linearRampToValueAtTime(0.0001, now + 8.2);

        osc.connect(voiceGain);
        voiceGain.connect(filter);
        osc.start(now);
        this.activePadOscs.push({ osc, gain: voiceGain });
      });
    });
  }

  private triggerCombatPulse(): void {
    if (!this.combatGain || this.combatGain.gain.value < 0.05) return;
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub-bass kick & eerie clockwork ticking
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.combatGain);
    osc.start(now);
    osc.stop(now + 0.22);

    // Metallic clockwork tick on alternate beats
    const tickOsc = ctx.createOscillator();
    const tickGain = ctx.createGain();
    const tickFilter = ctx.createBiquadFilter();
    tickFilter.type = 'highpass';
    tickFilter.frequency.setValueAtTime(2200, now);

    tickOsc.type = 'triangle';
    tickOsc.frequency.setValueAtTime(1400, now);
    tickGain.gain.setValueAtTime(0.06, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    tickOsc.connect(tickFilter);
    tickFilter.connect(tickGain);
    tickGain.connect(this.combatGain);
    tickOsc.start(now);
    tickOsc.stop(now + 0.05);
  }

  public setCombatIntensity(level: number): void {
    if (!this.ctx || !this.combatGain) return;
    const clamped = Math.max(0, Math.min(1, level));
    const now = this.ctx.currentTime;
    // Ramp combat intensity smoothly over 1.2s
    this.combatGain.gain.setValueAtTime(this.combatGain.gain.value, now);
    this.combatGain.gain.linearRampToValueAtTime(clamped * 0.28, now + 1.2);
  }

  public setSceneTheme(theme: string): void {
    if (this.themeChords[theme]) {
      this.currentThemeName = theme;
      this.currentChordIndex = 0;
      this.triggerNextPadChord();
    }
  }

  public toggleMute(): boolean {
    this.bgmMuted = !this.bgmMuted;
    if (this.bgmMasterGain && this.ctx) {
      const target = this.bgmMuted ? 0.0001 : this.musicVolume * 0.16;
      this.bgmMasterGain.gain.setValueAtTime(this.bgmMasterGain.gain.value, this.ctx.currentTime);
      this.bgmMasterGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.3);
    }
    return this.bgmMuted;
  }

  public isMuted(): boolean {
    return this.bgmMuted;
  }

  public setMusicVolume(val: number): void {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.bgmMasterGain && !this.bgmMuted) {
      this.bgmMasterGain.gain.setValueAtTime(this.musicVolume * 0.16, this.ctx.currentTime);
    }
  }

  public playGlassShatter(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [1200, 1850, 2400, 3100, 4200];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.02);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, now + i * 0.02 + 0.25);
      gain.gain.setValueAtTime(0.12, now + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.02 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.02);
      osc.stop(now + i * 0.02 + 0.32);
    });
  }

  public playGravityFlip(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.7);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  public playChimeTune(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 bell harmonic
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.18, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 1.3);
    });
  }

  public playFolioToggle(): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }
}

export const SoundFX = new SoundFXManager();

