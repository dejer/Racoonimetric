// All audio is synthesized with WebAudio: a reactive "sneaky jazz" score + positional SFX.
import { clamp, rand } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [38, [0, 3, 7, 10]], [38, [0, 3, 7, 10]], [43, [0, 3, 7, 10]], [45, [0, 4, 7, 10]],
  [38, [0, 3, 7, 10]], [46, [0, 4, 7, 11]], [40, [0, 3, 6, 10]], [45, [0, 4, 7, 10]],
];
const MELODY = [
  [[0, 74, 2], [3, 77, 1], [4, 76, 1], [6, 74, 1], [8, 69, 2], [11, 72, 1], [12, 69, 1], [14, 68, 1]],
  [[0, 69, 2], [4, 65, 1], [6, 69, 1], [8, 74, 3], [12, 73, 1], [13, 74, 1], [14, 76, 1]],
  [[0, 77, 2], [3, 74, 1], [4, 70, 2], [8, 67, 1], [10, 70, 1], [12, 74, 2], [14, 73, 1]],
  [[0, 73, 1], [2, 76, 1], [4, 79, 2], [8, 77, 1], [9, 76, 1], [10, 74, 1], [11, 73, 1], [12, 69, 3]],
  [[0, 74, 1], [2, 74, 1], [3, 77, 1], [4, 81, 2], [8, 79, 1], [9, 77, 1], [10, 76, 1], [12, 74, 2]],
  [[0, 74, 2], [4, 77, 1], [6, 81, 1], [8, 82, 2], [12, 81, 1], [14, 77, 1]],
  [[0, 79, 1], [2, 76, 1], [4, 70, 2], [8, 74, 1], [10, 76, 1], [12, 79, 2]],
  [[0, 81, 1], [1, 79, 1], [2, 77, 1], [3, 76, 1], [4, 73, 2], [8, 69, 2], [12, 64, 1], [14, 67, 1]],
];
const RADIO = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, 71];

export class AudioEngine {
  constructor() {
    this.ctx = null; this.musicVol = 0.7; this.sfxVol = 0.85;
    this.intensity = 0; this.tempo = 96; this.listener = { x: 0, z: 0 };
    this.radio = null; this.sprinkler = null; this.birdT = 3; this.enabled = true;
  }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(1.8, 2.8);
    const rv = c.createGain(); rv.gain.value = 0.5; this.reverb.connect(rv); rv.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVol * 0.55; this.music.connect(this.master);
    this.musicRev = c.createGain(); this.musicRev.gain.value = 0.22; this.music.connect(this.musicRev); this.musicRev.connect(this.reverb);
    this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    const sr = c.createGain(); sr.gain.value = 0.12; this.sfx.connect(sr); sr.connect(this.reverb);
    this.L = {};
    for (const k of ['bass', 'comp', 'mel', 'celesta', 'perc', 'chase']) { const g = c.createGain(); g.gain.value = 0; g.connect(this.music); this.L[k] = g; }
    this.L.bass.gain.value = 0.9; this.L.comp.gain.value = 0.5; this.L.celesta.gain.value = 0.35; this.L.perc.gain.value = 0.5;
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.step = 0; this.bar = 0; this.loop = 0; this.nextTime = c.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  setMusic(v) { this.musicVol = v; if (this.ctx) this.music.gain.setTargetAtTime(v * 0.55, this.ctx.currentTime, 0.1); }
  setSfx(v) { this.sfxVol = v; if (this.ctx) this.sfx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }
  setIntensity(level) {
    if (!this.ctx || level === this.intensity) return;
    this.intensity = level;
    const t = this.ctx.currentTime, L = this.L;
    L.mel.gain.setTargetAtTime(level >= 1 ? 0.55 : 0, t, 0.4);
    L.celesta.gain.setTargetAtTime(level === 0 ? 0.35 : 0, t, 0.4);
    L.chase.gain.setTargetAtTime(level >= 2 ? 0.8 : 0, t, 0.15);
    L.comp.gain.setTargetAtTime(level >= 2 ? 0.3 : 0.5, t, 0.3);
  }
  // ------------------------------------------------------------------ scheduler
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.nextTime < c.currentTime - 0.3) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.nextTime);
      const target = this.intensity >= 2 ? 128 : 96;
      this.tempo += (target - this.tempo) * 0.08;
      this.nextTime += 60 / this.tempo / 4;
      this.step++;
      if (this.step >= 16) { this.step = 0; this.bar = (this.bar + 1) % 8; if (this.bar === 0) this.loop++; }
    }
  }
  playStep(t) {
    const s = this.step, [root, q] = CHORDS[this.bar], next = CHORDS[(this.bar + 1) % 8][0];
    const sd = 60 / this.tempo / 4;
    // walking pizzicato bass
    if (s % 4 === 0) {
      const walk = [root, root + q[1], root + 7, next + (this.bar % 2 ? 1 : -1)];
      this.pluck(t, walk[s / 4], 0.32, 0.5, this.L.bass);
    } else if (s === 14 && this.bar % 2 === 1) this.pluck(t, root + 12, 0.18, 0.28, this.L.bass);
    // piano comp stabs
    if (s === 6 || s === 14 || (s === 3 && this.bar % 4 === 2)) {
      for (const iv of [q[1], q[3], q[1] === 3 ? 14 : 14]) this.piano(t, root + 12 + iv, 0.35, 0.09, this.L.comp);
    }
    // melody
    for (const [st, m, len] of MELODY[this.bar]) {
      if (st !== s) continue;
      if (this.intensity >= 1) this.clarinet(t, m - (this.intensity >= 2 ? 0 : 12), len * sd * 0.85, 0.16, this.L.mel);
      if (((this.loop + st + this.bar) % 3) !== 0) this.piano(t, m + 12, 0.6, 0.07, this.L.celesta);
    }
    // percussion
    if (s === 4 || s === 12) this.snap(t, 0.35);
    if (this.intensity >= 1 && s % 2 === 0) this.hat(t, s % 4 === 0 ? 0.05 : 0.09, 0.045);
    if (this.intensity >= 2) {
      if (s === 0 || s === 8 || s === 10) this.kick(t, this.L.chase);
      if (s === 4 || s === 12) this.snare(t, this.L.chase);
      this.hat(t, 0.06, 0.03, this.L.chase);
      if (s === 0) this.brass(t, [root + 24 + q[1], root + 24 + q[2], root + 24 + q[3]], 0.3, this.L.chase);
      if (s === 7) this.brass(t, [root + 24 + q[1], root + 24 + q[3]], 0.12, this.L.chase);
    }
    // radio + sprinkler (world-positioned loops)
    if (this.radio && this.radio.on) {
      const v = this.spatial(this.radio.x, this.radio.z, 16);
      if (v.g > 0.01 && s % 2 === 0) this.radioNote(t, RADIO[(s / 2 + this.bar * 8) % 16], v, s % 4 === 0);
    }
    if (this.sprinkler && this.sprinkler.on && s % 2 === 0) {
      const v = this.spatial(this.sprinkler.x, this.sprinkler.z, 14);
      if (v.g > 0.01) this.noise(t, 0.08, 0.12 * v.g, 'highpass', 4000, v.pan, this.sfx);
    }
    // ambient birds
    if (s === 0) {
      this.birdT -= 1;
      if (this.birdT <= 0) { this.birdT = 2 + Math.random() * 4; this.bird(t + Math.random() * 0.5); }
    }
  }
  // ------------------------------------------------------------------ instruments
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  osc(type, f, t, dur, dest) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
  pluck(t, m, dur, vol, dest) {
    const c = this.ctx, f = mtof(m), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur);
    this.env(g, t, 0.004, vol, dur); lp.connect(g); g.connect(dest);
    this.osc('triangle', f, t, dur, lp); this.osc('sine', f / 2, t, dur, lp);
  }
  piano(t, m, dur, vol, dest) {
    const c = this.ctx, f = mtof(m), g = c.createGain();
    this.env(g, t, 0.005, vol, dur); g.connect(dest);
    this.osc('sine', f, t, dur, g);
    const g2 = c.createGain(); g2.gain.value = 0.35; g2.connect(g); this.osc('sine', f * 2.01, t, dur * 0.6, g2);
    const g3 = c.createGain(); g3.gain.value = 0.12; g3.connect(g); this.osc('triangle', f * 3, t, dur * 0.3, g3);
  }
  clarinet(t, m, dur, vol, dest) {
    const c = this.ctx, f = mtof(m), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = f * 2.6; lp.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + Math.max(0.04, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    const o = this.osc('square', f, t, dur + 0.1, lp);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    lp.connect(g); g.connect(dest);
  }
  brass(t, ms, dur, dest) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.04); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    this.env(g, t, 0.02, 0.09, dur + 0.1); lp.connect(g); g.connect(dest);
    for (const m of ms) this.osc('sawtooth', mtof(m), t, dur + 0.1, lp);
  }
  noise(t, dur, vol, type, freq, pan = 0, dest = this.sfx, q = 1) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, 0.003, vol, dur);
    src.connect(f); f.connect(g);
    this.out(g, pan, dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    return f;
  }
  out(node, pan, dest) {
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(dest); }
    else node.connect(dest);
  }
  snap(t, vol) { this.noise(t, 0.05, vol, 'bandpass', 2200, 0, this.L.perc, 1.8); }
  hat(t, vol, dur, dest = this.L.perc) { this.noise(t, dur, vol, 'highpass', 7000, 0, dest); }
  kick(t, dest) {
    const c = this.ctx, g = c.createGain(); this.env(g, t, 0.002, 0.9, 0.28); g.connect(dest);
    const o = this.osc('sine', 150, t, 0.3, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  }
  snare(t, dest) { this.noise(t, 0.16, 0.45, 'bandpass', 1600, 0, dest, 0.8); const g = this.ctx.createGain(); this.env(g, t, 0.002, 0.25, 0.1); g.connect(dest); this.osc('triangle', 190, t, 0.1, g); }
  radioNote(t, m, v, accent) {
    const c = this.ctx, g = c.createGain(), bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.4;
    this.env(g, t, 0.005, 0.18 * v.g, 0.16); bp.connect(g); this.out(g, v.pan, this.sfx);
    this.osc('square', mtof(m), t, 0.16, bp);
    if (accent) this.osc('square', mtof(m - 24), t, 0.12, bp);
  }
  bird(t) {
    const c = this.ctx, n = 2 + ((Math.random() * 3) | 0), base = 2600 + Math.random() * 1600, pan = rand(-0.8, 0.8);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.11, g = c.createGain(); this.env(g, tt, 0.01, 0.035, 0.08); this.out(g, pan, this.sfx);
      const o = this.osc('sine', base, tt, 0.09, g); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), tt + 0.06);
    }
  }
  spatial(x, z, range = 20) {
    const dx = x - this.listener.x, dz = z - this.listener.z;
    const d = Math.hypot(dx, dz);
    return { g: clamp(1 - d / range, 0, 1) ** 1.5, pan: clamp(dx / 9, -0.9, 0.9) };
  }
  // ------------------------------------------------------------------ sound effects
  play(name, x = null, z = null, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    let pan = 0, g = vol;
    if (x !== null) { const s = this.spatial(x, z, 24); g *= s.g; pan = s.pan; if (g < 0.02) return; }
    const t = this.ctx.currentTime + 0.005, c = this.ctx, S = this.sfx;
    const tone = (type, f0, f1, dur, v, dt = 0) => {
      const gg = c.createGain(); this.env(gg, t + dt, 0.005, v * g, dur); this.out(gg, pan, S);
      const o = this.osc(type, f0, t + dt, dur, gg); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dt + dur); return o;
    };
    switch (name) {
      case 'step': this.noise(t, 0.035, 0.05 * g, 'lowpass', 900, pan); break;
      case 'stepHard': this.noise(t, 0.03, 0.06 * g, 'bandpass', 2400, pan, S, 2); break;
      case 'grab': tone('sine', 420, 980, 0.09, 0.3); this.noise(t, 0.03, 0.08 * g, 'highpass', 3000, pan); break;
      case 'drop': tone('sine', 240, 80, 0.14, 0.35); this.noise(t, 0.06, 0.12 * g, 'lowpass', 700, pan); break;
      case 'chitter': for (let i = 0; i < 7; i++) { const f = 2300 + Math.random() * 1300; tone(i % 2 ? 'square' : 'triangle', f, f * (0.8 + Math.random() * 0.5), 0.035, i % 2 ? 0.05 : 0.11, i * 0.047); } break;
      case 'crash':
        [320, 587, 843, 1220, 1690, 2270, 3130].forEach((f, i) => tone('square', f * rand(0.97, 1.03), f * 0.9, 0.5 + i * 0.08, 0.035));
        this.noise(t, 0.5, 0.45 * g, 'highpass', 1800, pan); tone('sine', 160, 50, 0.3, 0.5);
        for (let i = 1; i < 4; i++) { this.noise(t + i * 0.13, 0.12, 0.2 * g / i, 'bandpass', 2500, pan, S, 3); tone('square', 900 + i * 300, 700, 0.12, 0.03, i * 0.13); }
        break;
      case 'splash': { const f = this.noise(t, 0.5, 0.35 * g, 'lowpass', 3000, pan); f.frequency.exponentialRampToValueAtTime(400, t + 0.45); break; }
      case 'bark': for (let i = 0; i < 2; i++) { tone('sawtooth', 520, 240, 0.12, 0.12, i * 0.18); this.noise(t + i * 0.18, 0.1, 0.25 * g, 'bandpass', 700, pan, S, 2); } break;
      case 'alert': tone('sawtooth', 392, 0, 0.08, 0.1); tone('sawtooth', 784, 0, 0.25, 0.12, 0.09); tone('square', 1175, 0, 0.2, 0.05, 0.09); break;
      case 'question': tone('sine', 660, 0, 0.12, 0.18); tone('sine', 880, 990, 0.2, 0.18, 0.13); break;
      case 'objective': [72, 76, 79, 84, 88].forEach((m, i) => { this.piano(t + i * 0.08, m, 0.9, 0.12 * g, S); }); break;
      case 'unlock': [60, 64, 67, 72].forEach((m, i) => this.brass(t + i * 0.1, [m + 12, m + 16], 0.18, S)); [84, 88, 91, 96].forEach((m, i) => this.piano(t + 0.4 + i * 0.06, m, 0.8, 0.1, S)); break;
      case 'fanfare': [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]].forEach((ch, i) => this.brass(t + i * 0.22, ch.map((m) => m + 12), i === 3 ? 1.2 : 0.2, S)); break;
      case 'dig': for (let i = 0; i < 8; i++) this.noise(t + i * 0.12, 0.08, 0.2 * g, 'bandpass', 900 + Math.random() * 900, pan, S, 1.5); break;
      case 'slip': tone('sine', 1400, 250, 0.55, 0.2); tone('sine', 140, 60, 0.25, 0.5, 0.55); this.noise(t + 0.55, 0.15, 0.3 * g, 'lowpass', 600, pan); break;
      case 'bonk': tone('sine', 220, 70, 0.2, 0.5); this.noise(t, 0.08, 0.25 * g, 'lowpass', 1200, pan); tone('sine', 900, 1800, 0.25, 0.08, 0.1); break;
      case 'rustle': { const f = this.noise(t, 0.35, 0.16 * g, 'bandpass', 2600, pan, S, 0.6); f.frequency.linearRampToValueAtTime(1500, t + 0.3); break; }
      case 'creak': { const o = tone('sawtooth', 110, 150, 0.45, 0.05); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 18; lg.gain.value = 20; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.5); break; }
      case 'click': tone('sine', 900, 700, 0.04, 0.15); break;
      case 'munch': for (let i = 0; i < 5; i++) this.noise(t + i * 0.13, 0.06, 0.2 * g, 'bandpass', 1200, pan, S, 2); break;
      case 'pop': tone('sine', 300, 1200, 0.1, 0.25); break;
      case 'sparkle': [96, 100, 103].forEach((m, i) => this.piano(t + i * 0.05, m, 0.5, 0.05 * g, S)); break;
      case 'tap': tone('square', 200, 120, 0.06, 0.08); this.noise(t, 0.05, 0.1 * g, 'highpass', 2000, pan); break;
      case 'grumble': { for (let i = 0; i < 3; i++) { const o = tone('sawtooth', 130 + Math.random() * 40, 100, 0.12, 0.07, i * 0.12); void o; } break; }
      case 'whistle': tone('sine', 1800, 2400, 0.12, 0.08); tone('sine', 2400, 1600, 0.2, 0.08, 0.14); break;
    }
  }
}
