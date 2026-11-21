class SoundFX {
  constructor() {
    this.ctx = null;
  }

  _ensure() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _tone(freqStart, freqEnd, duration, type = 'triangle', gainVal = 0.12) {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  fire() { this._tone(780, 180, 0.09, 'sawtooth', 0.09); }
  hit() { this._tone(1100, 520, 0.07, 'sine', 0.12); }
  jumpPad() { this._tone(220, 920, 0.24, 'triangle', 0.14); }
  ability() { this._tone(420, 840, 0.18, 'sine', 0.11); }
  crateBreak() { this._tone(160, 55, 0.2, 'square', 0.14); }
}

export const sfx = new SoundFX();
