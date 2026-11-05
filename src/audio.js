// Tiny WebAudio synth: all SFX and music are generated at runtime.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicOn = false;
    this.stage = 1;
    this.step = 0;
    this.nextNote = 0;
    this.lastShoot = 0;
    this.lastHit = 0;
    this._noise = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.62;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
    this._makeNoise();
  }

  _makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.03);
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.1, slideTo = null, delay = 0, dest = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.04);
  }

  noise(dur, vol = 0.12, filterType = 'lowpass', freq = 1200, freqTo = null, delay = 0, dest = null) {
    if (!this.ctx || !this._noise) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest || this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  shoot() {
    const now = performance.now();
    if (now - this.lastShoot < 58) return;
    this.lastShoot = now;
    this.tone(1250, 0.05, 'square', 0.018, 640);
  }

  enemyShoot() {
    this.tone(250, 0.09, 'sawtooth', 0.022, 130);
  }

  rocket() {
    this.noise(0.45, 0.1, 'bandpass', 950, 210);
    this.tone(150, 0.36, 'sawtooth', 0.05, 55);
  }

  hit() {
    const now = performance.now();
    if (now - this.lastHit < 34) return;
    this.lastHit = now;
    this.tone(420, 0.04, 'square', 0.02, 190);
  }

  explode(big = 0) {
    this.noise(0.34 + big * 0.25, 0.16 + big * 0.08, 'lowpass', 1600, 110);
    this.tone(110, 0.3 + big * 0.2, 'sine', 0.11 + big * 0.05, 34);
    if (big > 0.5) this.tone(62, 0.65, 'triangle', 0.12, 24, 0.04);
  }

  playerHit() {
    this.noise(0.4, 0.2, 'lowpass', 2200, 120);
    this.tone(300, 0.5, 'sawtooth', 0.1, 45);
  }

  powerup() {
    this.tone(660, 0.09, 'triangle', 0.06, 990);
    this.tone(990, 0.1, 'triangle', 0.055, 1320, 0.07);
    this.tone(1320, 0.14, 'sine', 0.05, 1760, 0.14);
  }

  bomb() {
    this.noise(0.9, 0.24, 'lowpass', 2400, 70);
    this.tone(160, 0.8, 'sawtooth', 0.12, 28);
    this.tone(1200, 0.3, 'sine', 0.05, 240);
  }

  warning() {
    for (let i = 0; i < 4; i++) {
      this.tone(480, 0.22, 'square', 0.05, 740, i * 0.42);
      this.tone(740, 0.22, 'square', 0.04, 480, i * 0.42 + 0.22);
    }
    this.noise(1.8, 0.035, 'bandpass', 500, 260);
  }

  roar() {
    this.noise(1.1, 0.18, 'lowpass', 900, 90);
    this.tone(82, 1.05, 'sawtooth', 0.09, 36);
    this.tone(55, 1.15, 'triangle', 0.1, 30, 0.03);
  }

  beam() {
    this.noise(1.4, 0.14, 'bandpass', 1800, 400);
    this.tone(240, 1.2, 'sawtooth', 0.045, 90);
  }

  laser() {
    this.tone(1800, 0.35, 'sawtooth', 0.05, 540);
    this.noise(0.9, 0.08, 'highpass', 1400, 600);
  }

  stageClear() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.18, 'triangle', 0.07, n * 1.02, i * 0.12));
    this.noise(0.5, 0.08, 'lowpass', 1800, 200, 0.3);
  }

  victory() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => this.tone(n, 0.32, 'triangle', 0.075, n, i * 0.14));
    this.tone(261, 1.2, 'sine', 0.08, 261, 0.05);
    this.noise(0.8, 0.1, 'lowpass', 2400, 240, 0.5);
  }

  ui() {
    this.tone(720, 0.06, 'triangle', 0.045, 1080);
  }

  startMusic(stage) {
    this.init();
    if (!this.ctx) return;
    this.stopMusic();
    this.stage = stage;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.12;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.4);
    this.musicTimer = setInterval(() => this._schedule(), 110);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    }
  }

  pauseMusic(paused) {
    if (!this.musicOn || !this.ctx) return;
    this.musicGain.gain.setTargetAtTime(paused ? 0.12 : 0.55, this.ctx.currentTime, 0.12);
  }

  _schedule() {
    if (!this.ctx || !this.musicOn) return;
    const ahead = this.ctx.currentTime + 0.3;
    while (this.nextNote < ahead) {
      this._playStep(this.step, this.nextNote);
      this.step++;
      this.nextNote += 0.24;
    }
  }

  _playStep(step, time) {
    const stage = this.stage;
    const roots = stage === 1 ? [55, 65.41, 58.27, 73.42] : [49, 58.27, 65.41, 46.25];
    const chords = stage === 1
      ? [[220, 261.63, 329.63], [261.63, 329.63, 392], [233.08, 293.66, 349.23], [293.66, 349.23, 440]]
      : [[196, 233.08, 293.66], [233.08, 293.66, 349.23], [261.63, 311.13, 392], [185, 233.08, 277.18]];
    const root = roots[Math.floor(step / 8) % roots.length];
    const chord = chords[Math.floor(step / 8) % chords.length];
    const t = time - this.ctx.currentTime;
    if (t < -0.1) return;
    if (step % 8 === 0) {
      this.tone(root, 1.6, 'sine', 0.055, root * 0.99, Math.max(0, t), this.musicGain);
      this.tone(root * 2, 1.2, 'triangle', 0.022, root * 2, Math.max(0, t), this.musicGain);
    }
    if (step % 4 === 0) {
      this.noise(0.09, 0.012, 'highpass', 4800, 2400, Math.max(0, t), this.musicGain);
    }
    if (step % 2 === 1) {
      const note = chord[(Math.floor(step / 2) + step) % chord.length] * (stage === 1 ? 2 : 1.5);
      this.tone(note, 0.16, 'triangle', 0.014, note, Math.max(0, t), this.musicGain);
    }
    if (stage === 2 && step % 2 === 0) {
      this.noise(0.05, 0.009, 'bandpass', 7000, 4000, Math.max(0, t), this.musicGain);
    }
  }
}
