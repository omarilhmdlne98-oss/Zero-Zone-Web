class SoundFX {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
  }

  _ensure() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  _tone(freqStart, freqEnd, duration, type = 'triangle', gainVal = 0.12, delay = 0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  _noise(duration, filterType, filterFreq, gainVal = 0.16, delay = 0, q = 1.0) {
    const ctx = this._ensure();
    if (!ctx || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.Q.setValueAtTime(q, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.01);
  }

  fire(weaponId = 'rifle') {
    if (weaponId === 'railgun') {
      // Electromagnetic whine + hypersonic crack + sub-bass boom + echo tail
      this._tone(1600, 120, 0.22, 'sawtooth', 0.14);
      this._tone(140, 38, 0.34, 'sine', 0.22);
      this._noise(0.18, 'bandpass', 2400, 0.22, 0, 1.4);
      this._noise(0.32, 'lowpass', 720, 0.08, 0.08, 0.8);
      return;
    }
    if (weaponId === 'shotgun') {
      // Heavy ballistic blast + mechanical pump clack + room echo
      this._noise(0.22, 'lowpass', 1100, 0.28, 0, 0.7);
      this._tone(135, 36, 0.22, 'triangle', 0.22);
      this._noise(0.06, 'bandpass', 3200, 0.1, 0.18, 2.5); // pump pull
      this._noise(0.05, 'bandpass', 2600, 0.09, 0.28, 2.5); // pump lock
      this._noise(0.28, 'lowpass', 550, 0.07, 0.09, 0.6);
      return;
    }
    // VX-47 Assault Rifle: punchy transient + mechanical bolt click + distant echo
    this._noise(0.085, 'bandpass', 1750, 0.2, 0, 0.9);
    this._tone(210, 58, 0.09, 'sawtooth', 0.14);
    this._tone(3400, 1800, 0.025, 'square', 0.04, 0.035); // bolt click
    this._noise(0.18, 'lowpass', 680, 0.055, 0.06, 0.7);  // echo tail
  }

  hit() {
    this._tone(1280, 620, 0.055, 'triangle', 0.13);
  }

  headshot() {
    // Crisp metallic helmet crunch + high critical chime
    this._noise(0.05, 'highpass', 2800, 0.15);
    this._tone(1950, 2600, 0.09, 'sine', 0.16);
    this._tone(2800, 1400, 0.12, 'triangle', 0.11, 0.045);
  }

  ricochet() {
    const start = 1800 + Math.random() * 1100;
    this._tone(start, start * 0.35, 0.16, 'sine', 0.065);
  }

  reload() {
    // Mag release -> mag insert -> charging handle rack
    this._noise(0.045, 'bandpass', 2200, 0.09, 0.0, 2.2);
    this._tone(420, 260, 0.05, 'square', 0.05, 0.02);
    this._noise(0.05, 'bandpass', 1800, 0.11, 0.55, 1.8);
    this._tone(300, 520, 0.06, 'triangle', 0.07, 0.56);
    this._noise(0.06, 'bandpass', 3000, 0.1, 1.15, 2.4);
  }

  footstep(sprint = false, crouch = false) {
    const vol = crouch ? 0.025 : (sprint ? 0.085 : 0.05);
    const freq = sprint ? 420 : 300;
    this._noise(0.045, 'lowpass', freq, vol);
    this._tone(95, 45, 0.04, 'sine', vol * 0.7);
  }

  heartbeat() {
    this._tone(74, 42, 0.12, 'sine', 0.18, 0.0);
    this._tone(68, 38, 0.14, 'sine', 0.14, 0.19);
  }

  radioCue() {
    this._tone(1420, 1420, 0.05, 'sine', 0.07, 0.0);
    this._tone(1840, 1840, 0.07, 'sine', 0.07, 0.07);
  }

  jumpPad() {
    this._tone(180, 960, 0.26, 'triangle', 0.14);
    this._noise(0.18, 'bandpass', 900, 0.09, 0, 1.2);
  }

  ability() {
    this._tone(360, 980, 0.22, 'sine', 0.12);
    this._tone(540, 1320, 0.16, 'triangle', 0.07, 0.05);
  }

  crateBreak() {
    this._noise(0.24, 'lowpass', 620, 0.22);
    this._tone(150, 46, 0.22, 'square', 0.14);
  }

  explosion() {
    // Deep sub-bass detonation + roaring low-pass fireball rumble + debris crackle
    this._tone(110, 26, 0.55, 'sine', 0.32);
    this._tone(78, 22, 0.65, 'triangle', 0.24, 0.02);
    this._noise(0.55, 'lowpass', 520, 0.34, 0.0, 0.65);
    this._noise(0.32, 'bandpass', 1450, 0.14, 0.06, 1.1);
  }

  uavPulse() {
    // Tactical Sinai recon radar sweep ping + double confirm chirp
    this._tone(920, 1480, 0.18, 'sine', 0.11, 0.0);
    this._tone(1480, 1920, 0.24, 'sine', 0.08, 0.16);
    this._tone(680, 680, 0.07, 'triangle', 0.05, 0.36);
  }

  artilleryWhistle() {
    // Incoming 155mm shell descending whistle prior to detonation
    this._tone(1180, 320, 0.52, 'sine', 0.09, 0.0);
    this._noise(0.45, 'bandpass', 780, 0.06, 0.04, 2.2);
  }
}

export const sfx = new SoundFX();
