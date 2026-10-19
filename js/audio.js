// All sound and music is synthesised with the Web Audio API.
import { Save } from './save.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---- Songs -----------------------------------------------------------------

const GAME_CHORDS = [
  { bass: 36, tones: [60, 64, 67] },
  { bass: 43, tones: [59, 62, 67] },
  { bass: 45, tones: [57, 60, 64] },
  { bass: 41, tones: [57, 60, 65] },
];
const GAME_MEL = [
  [
    [76, 0, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0],
    [74, 0, 0, 0, 71, 0, 67, 0, 71, 0, 74, 0, 79, 0, 0, 0],
    [72, 0, 0, 0, 76, 0, 72, 0, 69, 0, 72, 0, 76, 0, 77, 0],
    [77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 0, 67, 0, 0, 0],
  ],
  [
    [79, 0, 0, 0, 76, 0, 79, 0, 84, 0, 0, 0, 83, 0, 79, 0],
    [81, 0, 79, 0, 74, 0, 0, 0, 71, 0, 74, 0, 79, 0, 0, 0],
    [76, 0, 0, 0, 72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 72, 0],
    [74, 0, 72, 0, 69, 0, 72, 0, 72, 0, 0, 0, 0, 0, 0, 0],
  ],
];
const BASS_STEPS = { 0: 0, 2: 12, 4: 0, 6: 7, 8: 0, 10: 12, 12: 0, 14: 7 };

const MENU_CHORDS = [
  { bass: 48, tones: [60, 64, 67, 72] },
  { bass: 45, tones: [57, 60, 64, 69] },
  { bass: 41, tones: [57, 60, 65, 69] },
  { bass: 43, tones: [55, 59, 62, 67] },
];
const MENU_MEL = [
  [72, 0, 0, 0, 0, 0, 0, 0, 76, 0, 0, 0, 74, 0, 0, 0],
  [72, 0, 0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0],
  [69, 0, 0, 0, 72, 0, 0, 0, 77, 0, 0, 0, 76, 0, 0, 0],
  [74, 0, 0, 0, 0, 0, 0, 0, 71, 0, 0, 0, 74, 0, 0, 0],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];

function noteLength(bar, i) {
  let n = 1;
  while (n < 4 && i + n < 16 && bar[i + n] === 0) n++;
  return n;
}

const SONGS = {
  game: {
    bpm: 132,
    play(a, step, t, sd) {
      const s = step % 16;
      const barIdx = Math.floor(step / 16) % 4;
      const phrase = Math.floor(step / 64) % 2;
      const ch = GAME_CHORDS[barIdx];
      if (s in BASS_STEPS) {
        a.tone(midi(ch.bass + BASS_STEPS[s]), t, sd * 1.6, { type: 'triangle', vol: 0.32, bus: a.music });
        a.tone(midi(ch.bass + BASS_STEPS[s]), t, sd * 0.9, { type: 'square', vol: 0.05, filter: 600, bus: a.music });
      }
      if (s % 4 === 2) {
        for (const n of ch.tones) a.tone(midi(n), t, sd * 1.2, { type: 'square', vol: 0.035, filter: 1800, bus: a.music });
      }
      const bar = GAME_MEL[phrase][barIdx];
      if (bar[s]) {
        const len = noteLength(bar, s) * sd;
        a.tone(midi(bar[s]), t, len * 0.95, { type: 'square', vol: 0.06, filter: 2600, attack: 0.01, bus: a.music });
        a.tone(midi(bar[s]), t, len * 0.95, { type: 'triangle', vol: 0.09, attack: 0.01, bus: a.music });
      }
      if (s === 0 || s === 8 || (phrase === 1 && (s === 6 || s === 14))) a.kick(t, 0.75);
      if (s === 4 || s === 12) a.snare(t, 0.35);
      if (a.tension ? true : s % 2 === 0) a.hat(t, s === 14 ? 0.18 : 0.04, a.tension ? 0.07 : 0.06);
    },
  },
  menu: {
    bpm: 104,
    play(a, step, t, sd) {
      const s = step % 16;
      const barIdx = Math.floor(step / 16) % 4;
      const ch = MENU_CHORDS[barIdx];
      if (s === 0 || s === 8) {
        a.tone(midi(ch.bass), t, sd * 7, { type: 'triangle', vol: 0.4, attack: 0.02, bus: a.music });
      }
      const tone = ch.tones[ARP[s] % ch.tones.length];
      a.tone(midi(tone + 12), t, sd * 1.5, { type: 'triangle', vol: 0.1, attack: 0.004, bus: a.music });
      const bar = MENU_MEL[barIdx];
      if (bar[s]) {
        a.tone(midi(bar[s]), t, sd * noteLength(bar, s) * 0.9, { type: 'sine', vol: 0.18, attack: 0.03, bus: a.music });
        a.tone(midi(bar[s] + 12), t, sd * noteLength(bar, s) * 0.6, { type: 'triangle', vol: 0.05, attack: 0.03, bus: a.music });
      }
      if (s === 0 || s === 10) a.kick(t, 0.45);
      if (s === 4 || s === 12) a.snare(t, 0.12);
      if (s % 2 === 1) a.hat(t, 0.03, 0.035);
    },
  },
};

// ---- Engine ------------------------------------------------------------------

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.adMuted = false;
    this.hidden = false;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.tension = false;
    this.engine = null;
    this.lastPlayed = {};
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // Called from the first user gesture (and every gesture after, cheaply).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
        return;
      }
      this.build();
    }
    if (this.ctx.state !== 'running' && !this.hidden) this.ctx.resume().catch(() => {});
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.music = c.createGain();
    this.music.connect(this.master);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes(true);
    this.nextTime = c.currentTime + 0.1;
    setInterval(() => this.schedule(), 25);
  }

  applyVolumes(instant) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (g, v) => {
      g.gain.cancelScheduledValues(t);
      if (instant) g.gain.setValueAtTime(v, t);
      else g.gain.setTargetAtTime(v, t, 0.06);
    };
    set(this.master, this.adMuted ? 0 : 0.9);
    set(this.music, Save.data.music ? 0.4 : 0);
    set(this.sfx, Save.data.sound ? 0.85 : 0);
  }

  setAdMuted(m) {
    this.adMuted = m;
    this.applyVolumes(m);
  }

  get masterLevel() {
    return this.ctx ? this.master.gain.value : 0;
  }

  setHidden(h) {
    this.hidden = h;
    if (!this.ctx) return;
    if (h) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  playSong(name) {
    if (this.song === name) return;
    this.song = name;
    this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.12;
  }

  schedule() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const song = SONGS[this.song];
    const sd = 60 / song.bpm / 4;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.15) {
      if (Save.data.music) song.play(this, this.step, this.nextTime, sd);
      this.step++;
      this.nextTime += sd;
    }
  }

  // ---- Building blocks ----

  tone(freq, t, dur, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const osc = c.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    const atk = o.attack ?? 0.005;
    const vol = o.vol ?? 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dur);
    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filterType || 'lowpass';
      f.frequency.value = o.filter;
      if (o.q) f.Q.value = o.q;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || this.sfx);
    osc.start(t);
    osc.stop(t + atk + dur + 0.05);
  }

  noise(t, dur, o = {}) {
    const c = this.ctx;
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    const atk = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + atk + dur + 0.05);
  }

  kick(t, vol) {
    this.tone(150, t, 0.22, { type: 'sine', vol, to: 42, glide: 0.12, bus: this.music });
  }

  snare(t, vol) {
    this.noise(t, 0.13, { type: 'highpass', freq: 1400, vol: vol * 0.7, bus: this.music });
    this.tone(190, t, 0.07, { type: 'triangle', vol: vol * 0.5, bus: this.music });
  }

  hat(t, dur, vol) {
    this.noise(t, dur, { type: 'highpass', freq: 7500, vol, bus: this.music });
  }

  // Throttle repeated effects so stacked events don't clip.
  gate(name, gap) {
    if (!this.ready) return false;
    const now = this.ctx.currentTime;
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return false;
    this.lastPlayed[name] = now;
    return true;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---- Sound effects ----

  click() {
    if (!this.gate('click', 0.04)) return;
    this.tone(660, this.now, 0.06, { type: 'square', vol: 0.09, to: 990, glide: 0.05, filter: 3000 });
  }

  back() {
    if (!this.gate('back', 0.04)) return;
    this.tone(560, this.now, 0.07, { type: 'square', vol: 0.08, to: 380, glide: 0.06, filter: 2500 });
  }

  whoosh() {
    if (!this.gate('whoosh', 0.08)) return;
    this.noise(this.now, 0.25, { freq: 400, to: 1800, q: 1.5, vol: 0.12, attack: 0.05 });
  }

  throwSfx() {
    if (!this.gate('throw', 0.05)) return;
    const t = this.now;
    this.noise(t, 0.26, { freq: 600, to: 2600, q: 2, vol: 0.3, attack: 0.02 });
    this.tone(300, t, 0.1, { type: 'triangle', vol: 0.15, to: 520, glide: 0.08 });
  }

  thud() {
    if (!this.gate('thud', 0.05)) return;
    const t = this.now;
    this.tone(170, t, 0.16, { type: 'sine', vol: 0.55, to: 55, glide: 0.12 });
    this.noise(t, 0.08, { type: 'lowpass', freq: 700, vol: 0.35 });
  }

  perfect(combo = 0) {
    if (!this.gate('perfect', 0.05)) return;
    const t = this.now;
    const up = Math.min(combo, 6);
    [72, 76, 79, 84].forEach((n, i) => {
      this.tone(midi(n + up), t + i * 0.06, 0.16, { type: 'square', vol: 0.07, filter: 4000 });
      this.tone(midi(n + up + 12), t + i * 0.06, 0.2, { type: 'triangle', vol: 0.08 });
    });
  }

  good() {
    if (!this.gate('good', 0.05)) return;
    const t = this.now;
    this.tone(midi(76), t, 0.1, { type: 'triangle', vol: 0.14 });
    this.tone(midi(79), t + 0.08, 0.16, { type: 'triangle', vol: 0.14 });
  }

  miss() {
    if (!this.gate('miss', 0.05)) return;
    const t = this.now;
    this.tone(420, t, 0.18, { type: 'square', vol: 0.08, to: 300, filter: 1200 });
    this.tone(330, t + 0.18, 0.3, { type: 'square', vol: 0.08, to: 190, filter: 1000 });
  }

  splash() {
    if (!this.gate('splash', 0.05)) return;
    const t = this.now;
    this.noise(t, 0.45, { type: 'lowpass', freq: 3500, to: 300, vol: 0.45, q: 0.7 });
    for (let i = 0; i < 4; i++) {
      this.tone(700 + Math.random() * 900, t + 0.05 + i * 0.06, 0.05, { type: 'sine', vol: 0.08, to: 1500 + Math.random() * 600 });
    }
  }

  leaves() {
    if (!this.gate('leaves', 0.05)) return;
    const t = this.now;
    for (let i = 0; i < 5; i++) this.noise(t + i * 0.04, 0.06, { freq: 3200, q: 0.8, vol: 0.14 });
  }

  crash(intensity) {
    if (!this.gate('crash', 0.08)) return;
    const t = this.now;
    const k = Math.min(1, intensity);
    this.noise(t, 0.25, { type: 'lowpass', freq: 1400, to: 300, vol: 0.35 + 0.3 * k });
    this.tone(95, t, 0.18, { type: 'sine', vol: 0.4 + 0.3 * k, to: 40 });
    this.tone(260, t, 0.12, { type: 'square', vol: 0.05 * k, filter: 2200, detune: 15 });
    this.tone(390, t, 0.1, { type: 'square', vol: 0.04 * k, filter: 2200 });
  }

  bump() {
    if (!this.gate('bump', 0.06)) return;
    this.tone(120, this.now, 0.1, { type: 'sine', vol: 0.25, to: 60 });
  }

  honk(pitch = 1) {
    if (!this.gate('honk', 0.35)) return;
    const t = this.now;
    this.tone(330 * pitch, t, 0.22, { type: 'square', vol: 0.06, filter: 1600, attack: 0.01 });
    this.tone(415 * pitch, t, 0.22, { type: 'square', vol: 0.05, filter: 1600, attack: 0.01 });
  }

  nearMiss() {
    if (!this.gate('near', 0.15)) return;
    this.noise(this.now, 0.22, { freq: 2600, to: 700, q: 3, vol: 0.22 });
  }

  coin() {
    if (!this.gate('coin', 0.05)) return;
    const t = this.now;
    this.tone(midi(83), t, 0.05, { type: 'square', vol: 0.07, filter: 5000 });
    this.tone(midi(88), t + 0.05, 0.14, { type: 'square', vol: 0.07, filter: 5000 });
  }

  load(i) {
    this.tone(midi(67 + i * 2), this.now, 0.07, { type: 'square', vol: 0.06, filter: 3000 });
  }

  tick(urgent) {
    if (!this.gate('tick', 0.2)) return;
    this.tone(urgent ? 1400 : 1100, this.now, 0.04, { type: 'sine', vol: 0.18 });
  }

  timeUp() {
    const t = this.now;
    this.tone(220, t, 0.55, { type: 'square', vol: 0.08, filter: 1200 });
    this.tone(233, t, 0.55, { type: 'square', vol: 0.08, filter: 1200 });
  }

  buy() {
    const t = this.now;
    this.tone(midi(84), t, 0.06, { type: 'square', vol: 0.06, filter: 5000 });
    this.tone(midi(88), t + 0.06, 0.06, { type: 'square', vol: 0.06, filter: 5000 });
    this.tone(midi(91), t + 0.12, 0.2, { type: 'triangle', vol: 0.14 });
    this.noise(t + 0.12, 0.2, { type: 'highpass', freq: 6000, vol: 0.08 });
  }

  denied() {
    if (!this.gate('denied', 0.1)) return;
    const t = this.now;
    this.tone(150, t, 0.09, { type: 'square', vol: 0.08, filter: 900 });
    this.tone(130, t + 0.11, 0.12, { type: 'square', vol: 0.08, filter: 900 });
  }

  jump() {
    if (!this.gate('jump', 0.1)) return;
    this.tone(220, this.now, 0.2, { type: 'sine', vol: 0.25, to: 700, glide: 0.16 });
  }

  land() {
    if (!this.gate('land', 0.1)) return;
    const t = this.now;
    this.tone(140, t, 0.14, { type: 'sine', vol: 0.4, to: 50 });
    this.noise(t, 0.1, { type: 'lowpass', freq: 900, vol: 0.2 });
  }

  quack() {
    if (!this.gate('quack', 0.4)) return;
    const t = this.now;
    for (let i = 0; i < 2; i++) {
      this.tone(560, t + i * 0.15, 0.1, { type: 'sawtooth', vol: 0.06, to: 380, filter: 1100, filterType: 'bandpass', q: 3 });
    }
  }

  flutter() {
    if (!this.gate('flutter', 0.3)) return;
    const t = this.now;
    for (let i = 0; i < 7; i++) this.noise(t + i * 0.035, 0.025, { freq: 2200, q: 1.2, vol: 0.1 });
  }

  pop() {
    if (!this.gate('pop', 0.03)) return;
    this.noise(this.now, 0.05, { type: 'highpass', freq: 3000, vol: 0.15 });
  }

  count() {
    if (!this.gate('count', 0.045)) return;
    this.tone(1250, this.now, 0.025, { type: 'square', vol: 0.035, filter: 4000 });
  }

  fanfare() {
    const t = this.now;
    [60, 64, 67, 72].forEach((n, i) => {
      this.tone(midi(n + 12), t + i * 0.09, i === 3 ? 0.5 : 0.12, { type: 'square', vol: 0.06, filter: 3500 });
      this.tone(midi(n + 12), t + i * 0.09, i === 3 ? 0.6 : 0.14, { type: 'triangle', vol: 0.1 });
    });
  }

  expressWarn() {
    if (!this.gate('warn', 0.5)) return;
    this.tone(880, this.now, 0.06, { type: 'square', vol: 0.05, filter: 3000 });
  }

  // ---- Continuous engine and skid loops ----

  engineStart() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = c.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 27;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.3);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    const ns = c.createBufferSource();
    ns.buffer = this.noiseBuf;
    ns.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1100;
    nf.Q.value = 1.4;
    const ng = c.createGain();
    ng.gain.value = 0;
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(this.sfx);
    o1.start(t);
    o2.start(t);
    ns.start(t);
    this.engine = { o1, o2, f, g, ns, ng };
  }

  engineUpdate(speedFrac, throttle, skid) {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    const f = 52 + speedFrac * 100 + Math.sin(t * 9) * 2;
    e.o1.frequency.setTargetAtTime(f, t, 0.06);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    e.f.frequency.setTargetAtTime(280 + speedFrac * 900 + throttle * 200, t, 0.08);
    e.g.gain.setTargetAtTime(0.03 + throttle * 0.025 + speedFrac * 0.015, t, 0.1);
    e.ng.gain.setTargetAtTime(skid * 0.11, t, 0.05);
  }

  engineStop() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.g.gain.cancelScheduledValues(t);
    e.g.gain.setTargetAtTime(0, t, 0.08);
    e.ng.gain.cancelScheduledValues(t);
    e.ng.gain.setTargetAtTime(0, t, 0.05);
    e.o1.stop(t + 0.5);
    e.o2.stop(t + 0.5);
    e.ns.stop(t + 0.5);
  }
}

export const Sound = new AudioEngine();
