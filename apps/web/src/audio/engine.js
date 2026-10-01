// A small generative music engine on top of the Web Audio API. Nothing is downloaded: every sound is
// synthesized in your browser while it plays, so there are no files, no copyright problems and it works offline.
//
// Pieces: noise generators (rain, ocean, brown noise...), instrument voices (pad, piano-like, bells, electric
// piano, saw arp, bass, drums), a bar-by-bar "composer" that plays a chord progression with a little randomness so
// it never repeats exactly, binaural-beat tones, and an "8D" spinner (a 3D panner circling your head).

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FLOOR = 0.0001;

// ---------- noise ----------
// Looping noise buffers. The end is cross-faded into the start so the loop point never clicks.
function makeNoise(ac, kind, secs = 6) {
  const rate = ac.sampleRate, N = Math.floor(secs * rate), X = Math.floor(0.6 * rate), len = N + X;
  const raw = new Float32Array(len);
  if (kind === "white") for (let i = 0; i < len; i++) raw[i] = Math.random() * 2 - 1;
  else if (kind === "pink") { // Paul Kellet's filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  } else { // brown
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; raw[i] = last * 3.5; }
  }
  const buf = ac.createBuffer(1, N, rate), out = buf.getChannelData(0);
  for (let i = 0; i < N; i++) {
    if (i < X) { const p = (i / X) * Math.PI / 2; out[i] = raw[i] * Math.sin(p) + raw[N + i] * Math.cos(p); } else out[i] = raw[i];
  }
  return buf;
}

// a soft, long reverb tail made from decaying noise
function makeImpulse(ac, secs = 2.8, decay = 3.2) {
  const rate = ac.sampleRate, len = Math.floor(secs * rate), buf = ac.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, fadeIn = Math.min(1, i / (0.02 * rate));
      lp += (Math.random() * 2 - 1 - lp) * 0.45; // gentle low-pass so the tail is warm, not hissy
      d[i] = lp * (1 - t) ** decay * fadeIn;
    }
  }
  return buf;
}

// 8D paths. x is left/right, z is front/back, y is up/down (all in the panner's units; the largest reach is about 3.8).
export const SPIN_SHAPES = [["circle", "Circle"], ["wide", "Wide"], ["bob", "Floating"], ["sweep", "Left and right"], ["eight", "Figure 8"]];
const SHAPES = {
  circle: { gx: 2.2, gz: 2.2, gy: 0, fz: 1, fy: 1, cos: true },
  wide: { gx: 3.8, gz: 3.8, gy: 0, fz: 1, fy: 1, cos: true },
  bob: { gx: 2.4, gz: 2.4, gy: 1.3, fz: 1, fy: 2, cos: true },
  sweep: { gx: 3.6, gz: 0.7, gy: 0, fz: 1, fy: 1, cos: true },
  eight: { gx: 2.6, gz: 2.0, gy: 0, fz: 2, fy: 1, cos: false },
};

export class Engine {
  constructor() {
    this.ac = null; this.main = null; this.layer = null; this.listeners = new Set();
    this.volume = 0.8; this.layerVolume = 0.5; this.spatial = false; this.spatialPeriod = 10; this.spatialShape = "circle";
    this.playing = false; this.track = null; this.layerId = null; this.sleepTimer = null; this.sleepAt = 0;
  }
  get supported() { return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.snapshot()); }
  snapshot() { return { playing: this.playing, track: this.track, layerId: this.layerId, volume: this.volume, layerVolume: this.layerVolume, ctxState: this.ac ? this.ac.state : "none", spatial: this.spatial, period: this.spatialPeriod, shape: this.spatialShape, sleepAt: this.sleepAt }; }

  // must be called from a click (browsers block sound until you interact). `ctx` lets tests pass an offline context.
  init(ctx) {
    if (this.ac) return this.ac;
    const ac = ctx || new (window.AudioContext || window.webkitAudioContext)();
    this.ac = ac;
    this.master = ac.createGain(); this.master.gain.value = this.volume ** 1.6;
    this.makeup = ac.createGain(); this.makeup.gain.value = 2.2; // the tracks are mixed gently; this brings them to normal listening loudness
    this.comp = ac.createDynamicsCompressor(); // keeps layers (and the louder level) from clipping
    this.comp.threshold.value = -14; this.comp.knee.value = 14; this.comp.ratio.value = 8; this.comp.attack.value = 0.004; this.comp.release.value = 0.25;
    this.master.connect(this.makeup); this.makeup.connect(this.comp); this.comp.connect(ac.destination);
    ac.onstatechange = () => this.emit(); // so the player can say when the browser pauses or blocks sound
    this.analyser = ac.createAnalyser(); this.analyser.fftSize = 128; this.analyser.smoothingTimeConstant = 0.8; this.comp.connect(this.analyser); // lets the player draw what is playing
    this.noise = { white: makeNoise(ac, "white"), pink: makeNoise(ac, "pink"), brown: makeNoise(ac, "brown") };
    this.impulse = makeImpulse(ac);
    return ac;
  }

  // ---------- transport ----------
  async play(track) {
    this.init();
    const wake = this.ac.state !== "running" ? this.ac.resume().catch(() => {}) : null; // must start inside the click, so it is not awaited before anything else
    this._replace("main", track);
    this.track = track; this.playing = true; this.emit();
    if (wake) { await wake; this.emit(); }
  }
  // a short, clear tone straight to the speakers, so a person can tell "no sound at all" from "the music is quiet"
  async beep() {
    this.init();
    try { await this.ac.resume(); } catch { /* reported below through the state */ }
    const ac = this.ac, t = ac.currentTime, g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    for (const f of [523.25, 659.25]) { const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 1); }
    g.connect(ac.destination);
    this.emit();
    return ac.state;
  }
  async toggle() {
    if (!this.ac || !this.track) return;
    if (this.playing) { await this.ac.suspend(); this.playing = false; } else { this.playing = true; await this.ac.resume(); }
    this.emit();
  }
  stop() {
    this._end("main"); this._end("layer"); this.track = null; this.layerId = null; this.playing = false;
    this.setSleep(0); if (this.ac?.state === "suspended") this.ac.resume();
    this.emit();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v ** 1.6, this.ac.currentTime, 0.05); this.emit(); }
  async setLayer(id, def) {
    this.layerId = id;
    if (!id) this._end("layer");
    else { this.init(); if (this.ac.state === "suspended" && this.playing) await this.ac.resume(); this._replace("layer", def); }
    this.emit();
  }
  setLayerVolume(v) { this.layerVolume = v; if (this.layer) this.layer.level.gain.setTargetAtTime(v ** 1.6, this.ac.currentTime, 0.05); this.emit(); }
  setSpatial(on, period, shape) {
    if (this.main?.spin) this._advance(this.main.spin); // keep the position tracking right across a speed change
    this.spatial = on; if (period) this.spatialPeriod = period; if (shape && SHAPES[shape]) this.spatialShape = shape;
    if (this.main && this.main.canSpin) this._wireSpin(this.main);
    this.emit();
  }
  // where the sound is right now (-1..1 each), for the little radar in the player. null when not spinning.
  spinPos() {
    const sp = this.main?.spin;
    if (!sp || !this.spatial || !this.main.canSpin) return null;
    this._advance(sp);
    const sh = SHAPES[this.spatialShape], p = sp.phase;
    const x = sh.gx * Math.sin(p), z = sh.cos ? sh.gz * Math.cos(p) : sh.gz * Math.sin(sh.fz * p), y = sh.gy * Math.sin(sh.fy * p);
    return { x: x / 3.8, z: z / 3.8, y: y / 3.8 };
  }
  _advance(sp) { const t = this.ac.currentTime; sp.phase += (2 * Math.PI * (t - sp.lastT)) / sp.period; sp.lastT = t; sp.period = this.spatialPeriod; }
  setSleep(minutes) {
    clearTimeout(this.sleepTimer); this.sleepTimer = null; this.sleepAt = 0;
    if (minutes > 0) {
      this.sleepAt = Date.now() + minutes * 60000;
      this.sleepTimer = setTimeout(() => { this._fadeAll(4); setTimeout(() => this.stop(), 4200); }, minutes * 60000);
    }
    this.emit();
  }
  _fadeAll(s) { for (const k of ["main", "layer"]) { const x = this[k]; if (x) x.bus.gain.setTargetAtTime(0, this.ac.currentTime, s / 4); } }

  // ---------- sessions ----------
  _replace(slot, def) {
    const old = this[slot];
    const ac = this.ac, now = ac.currentTime;
    const level = ac.createGain(); level.gain.value = slot === "layer" ? this.layerVolume ** 1.6 : 1;
    const bus = ac.createGain(); bus.gain.setValueAtTime(FLOOR, now); bus.gain.linearRampToValueAtTime(1, now + 2.2);
    bus.connect(level); level.connect(this.master);
    const s = { bus, level, stops: [], timers: [], ticks: [], canSpin: false, def };
    build(this, s, def, bus);
    // schedule the first second right away, then keep topping it up
    const run = () => { const until = ac.currentTime + 1.6; for (const t of s.ticks) t(until); };
    run(); s.timers.push(setInterval(run, 120));
    this[slot] = s;
    if (slot === "main" && s.canSpin) this._wireSpin(s);
    if (old) this._retire(old);
  }
  _end(slot) { const s = this[slot]; if (s) { this._retire(s); this[slot] = null; } }
  _retire(s, fade = 1.4) {
    const ac = this.ac, now = ac.currentTime;
    s.timers.forEach(clearInterval); s.ticks.length = 0;
    s.bus.gain.cancelScheduledValues(now); s.bus.gain.setValueAtTime(Math.max(s.bus.gain.value, FLOOR), now); s.bus.gain.linearRampToValueAtTime(FLOOR, now + fade);
    setTimeout(() => { for (const f of s.stops) { try { f(); } catch { /* already stopped */ } } try { s.level.disconnect(); s.bus.disconnect(); s.spin?.panner.disconnect(); s.spin?.makeup.disconnect(); } catch { /* ok */ } }, fade * 1000 + 100);
  }

  // 8D: the sound circles your head. Needs headphones to be felt.
  _wireSpin(s) {
    const ac = this.ac;
    if (!s.spin) {
      const panner = ac.createPanner();
      panner.panningModel = "HRTF"; panner.distanceModel = "inverse"; panner.refDistance = 1; panner.rolloffFactor = 0.4;
      const x = ac.createOscillator(), z = ac.createOscillator(), y = ac.createOscillator(), gx = ac.createGain(), gz = ac.createGain(), gy = ac.createGain();
      x.type = "sine"; y.type = "sine";
      x.connect(gx); z.connect(gz); y.connect(gy);
      if (panner.positionX) { gx.connect(panner.positionX); gz.connect(panner.positionZ); gy.connect(panner.positionY); }
      x.start(); z.start(); y.start();
      s.stops.push(() => { x.stop(); z.stop(); y.stop(); });
      const makeup = ac.createGain(); makeup.gain.value = 3.2; // 3D (HRTF) processing loses a lot of level, mostly in the bass, so give it back
      panner.connect(makeup);
      s.spin = { panner, makeup, x, z, y, gx, gz, gy, phase: 0, lastT: ac.currentTime, period: this.spatialPeriod };
    }
    const sp = s.spin, sh = SHAPES[this.spatialShape], f = 1 / this.spatialPeriod;
    sp.gx.gain.value = sh.gx; sp.gz.gain.value = sh.gz; sp.gy.gain.value = sh.gy;
    sp.x.frequency.value = f; sp.z.frequency.value = f * sh.fz; sp.y.frequency.value = f * sh.fy;
    if (sh.cos) sp.z.setPeriodicWave(ac.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]))); else sp.z.type = "sine"; // cosine for loops, sine for the figure 8
    s.level.disconnect(); s.bus.disconnect();
    if (this.spatial) { s.bus.connect(sp.panner); sp.makeup.connect(s.level); } else s.bus.connect(s.level);
    s.level.connect(this.master);
  }
}

// ---------- building a session from a track definition ----------
function build(engine, s, def, out) {
  const ac = engine.ac;
  const loop = (kind, dest, gain = 1, rate = 1) => {
    const src = ac.createBufferSource(); src.buffer = engine.noise[kind]; src.loop = true; src.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(dest); src.start(0, Math.random() * 5); s.stops.push(() => src.stop());
    return g;
  };
  const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const lfo = (freq, depth, target) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); s.stops.push(() => o.stop());
  };
  const burst = (t, dest, { f = 3000, q = 1, dur = 0.02, gain = 0.1, type = "bandpass" } = {}) => { // a tiny noise burst: a drop, a crackle
    const src = ac.createBufferSource(); src.buffer = engine.noise.white; const b = filt(type, f, q), g = ac.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
    src.connect(b); b.connect(g); g.connect(dest); src.start(t, Math.random() * 4, dur + 0.05);
  };
  const every = (minGap, maxGap, fn) => { let next = ac.currentTime + rnd(0.2, minGap); s.ticks.push((until) => { while (next < until) { fn(next); next += rnd(minGap, maxGap); } }); };

  if (def.kind === "noise") return buildNoise(def.noise, { ac, s, out, loop, filt, lfo, burst, every, engine });
  if (def.kind === "beats") return buildBeats(def, { ac, s, out, loop, filt, lfo, burst, every, engine });
  return buildMusic(def, { ac, s, out, loop, filt, burst, every, engine });
}

function buildNoise(kind, { ac, out, loop, filt, lfo, burst, every, engine, s }) {
  s.canSpin = true;
  if (kind === "white") { const f = filt("lowpass", 9500); f.connect(out); loop("white", f, 0.22); return; }
  if (kind === "pink") { const f = filt("lowpass", 9000); f.connect(out); loop("pink", f, 0.55); return; }
  if (kind === "brown") { const f = filt("lowpass", 1400); f.connect(out); loop("brown", f, 0.6); return; }
  if (kind === "fan") { const f = filt("lowpass", 900); f.connect(out); loop("brown", f, 0.7); const h = filt("bandpass", 2200, 0.5); h.connect(out); loop("pink", h, 0.1); return; }
  const wind = (level = 0.7) => { const bp = filt("bandpass", 520, 0.9), g = ac.createGain(); g.gain.value = level; bp.connect(g); g.connect(out); loop("pink", bp, 1); lfo(0.06, 260, bp.frequency); lfo(0.09, level * 0.4, g.gain); };
  const crickets = () => {
    const bed = filt("lowpass", 1800); bed.connect(out); loop("pink", bed, 0.05);
    every(0.1, 0.5, (t) => { // each cricket: a quick burst of 3 to 4 pulses of a high tone
      const f = rnd(4200, 5200), pulses = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < pulses; i++) {
        const o = ac.createOscillator(), e = ac.createGain(), st = t + i * 0.045;
        o.type = "sine"; o.frequency.value = f; e.gain.setValueAtTime(FLOOR, st); e.gain.exponentialRampToValueAtTime(rnd(0.022, 0.045), st + 0.008); e.gain.exponentialRampToValueAtTime(FLOOR, st + 0.04);
        o.connect(e); e.connect(out); o.start(st); o.stop(st + 0.06);
      }
    });
  };
  if (kind === "crickets") { crickets(); return; }
  if (kind === "night") { crickets(); wind(0.6); return; }
  if (kind === "stream") {
    const bp = filt("bandpass", 950, 0.5), g = ac.createGain(); g.gain.value = 0.55; bp.connect(g); g.connect(out); loop("pink", bp, 1); lfo(0.4, 0.06, g.gain);
    const hi = filt("highpass", 2600), hg = ac.createGain(); hg.gain.value = 0.06; hi.connect(hg); hg.connect(out); loop("white", hi, 1);
    every(0.04, 0.22, (t) => burst(t, out, { f: rnd(450, 1500), q: 7, dur: rnd(0.03, 0.08), gain: rnd(0.05, 0.14) })); // bubbles
    return;
  }
  if (kind === "waterfall") {
    const lp = filt("lowpass", 6500), g = ac.createGain(); g.gain.value = 0.2; lp.connect(g); g.connect(out); loop("white", lp, 1); lfo(0.05, 0.03, g.gain);
    const bp = filt("bandpass", 700, 0.5); bp.connect(out); loop("pink", bp, 0.33);
    return;
  }
  if (kind === "rain" || kind === "storm" || kind === "downpour") {
    const body = filt("bandpass", 1800, 0.35), hiss = filt("highpass", 5500);
    body.connect(out); hiss.connect(out);
    const bg = loop("pink", body, 0.9), hg = loop("white", hiss, 0.05);
    lfo(0.07, 0.15, bg.gain); lfo(0.11, 0.015, hg.gain);
    if (kind === "downpour") { const g2 = filt("lowpass", 2200); g2.connect(out); loop("brown", g2, 0.5); }
    every(kind === "downpour" ? 0.008 : 0.03, kind === "downpour" ? 0.03 : 0.09, (t) => burst(t, out, { f: rnd(2500, 7000), q: 3, dur: 0.012, gain: rnd(0.02, 0.08) })); // drops
    if (kind === "storm") {
      every(22, 48, (t) => { // distant thunder
        const src = ac.createBufferSource(); src.buffer = engine.noise.brown; const lp = filt("lowpass", rnd(110, 200)), g = ac.createGain();
        g.gain.setValueAtTime(FLOOR, t); g.gain.linearRampToValueAtTime(rnd(0.9, 1.4), t + rnd(0.6, 1.4)); g.gain.exponentialRampToValueAtTime(FLOOR, t + rnd(5, 8));
        src.connect(lp); lp.connect(g); g.connect(out); src.start(t, Math.random() * 4, 9);
      });
    }
    return;
  }
  if (kind === "ocean") {
    const lp = filt("lowpass", 650), wave = ac.createGain(); wave.gain.value = 0.45; lp.connect(wave); wave.connect(out); loop("brown", lp, 1.2);
    lfo(0.085, 0.35, wave.gain);
    const hs = filt("bandpass", 1300, 0.6), foam = ac.createGain(); foam.gain.value = 0.05; hs.connect(foam); foam.connect(out); loop("pink", hs, 1);
    lfo(0.085, 0.045, foam.gain);
    return;
  }
  if (kind === "wind") { wind(0.7); return; }
  if (kind === "fire") {
    const lp = filt("lowpass", 320); lp.connect(out); loop("brown", lp, 0.6);
    every(0.04, 0.35, (t) => burst(t, out, { f: rnd(1200, 4200), q: 0.8, dur: rnd(0.008, 0.04), gain: rnd(0.04, 0.18), type: "highpass" }));
    return;
  }
  if (kind === "forest") {
    const bp = filt("bandpass", 450, 0.8), g = ac.createGain(); g.gain.value = 1.1; bp.connect(g); g.connect(out); loop("pink", bp, 1);
    lfo(0.05, 150, bp.frequency);
    every(3, 9, (t) => { // birds: short rising chirps
      const base = rnd(2400, 4200), n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const o = ac.createOscillator(), e = ac.createGain(), st = t + i * 0.13;
        o.type = "sine"; o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * rnd(1.15, 1.5), st + 0.08);
        e.gain.setValueAtTime(FLOOR, st); e.gain.exponentialRampToValueAtTime(0.018, st + 0.015); e.gain.exponentialRampToValueAtTime(FLOOR, st + 0.1);
        o.connect(e); e.connect(out); o.start(st); o.stop(st + 0.12);
      }
    });
    return;
  }
}

// binaural beats: slightly different pure tones in each ear. Headphones are required, and the evidence for the
// effect is mixed, so this is offered as something to try, not a treatment.
function buildBeats(def, { ac, s, out, loop, filt, lfo, burst, every, engine }) {
  const merger = ac.createChannelMerger(2), tones = ac.createGain(); tones.gain.value = 0.11;
  for (const [ch, f] of [[0, def.carrier], [1, def.carrier + def.beat]]) {
    const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(merger, 0, ch); o.start(); s.stops.push(() => o.stop());
  }
  merger.connect(tones); tones.connect(out);
  // a calm bed under the tones so they are not harsh on their own
  const bed = def.bed || "drone";
  if (bed === "brown") { const f = filt("lowpass", 800); f.connect(out); loop("brown", f, 0.55); }
  else if (bed !== "drone") { const g = ac.createGain(); g.gain.value = 0.7; g.connect(out); buildNoise(bed, { ac, s, out: g, loop, filt, lfo, burst, every, engine }); s.canSpin = false; }
  const root = def.drone || 45; // low D
  const lp = filt("lowpass", 520), dg = ac.createGain(); dg.gain.value = 0.16; lp.connect(dg); dg.connect(out);
  for (const [semi, det] of [[0, -6], [7, 5], [12, 0], [19, -4]]) {
    const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = hz(root + semi); o.detune.value = det; const g = ac.createGain(); g.gain.value = semi === 0 ? 0.5 : 0.25;
    o.connect(g); g.connect(lp); o.start(); s.stops.push(() => o.stop());
  }
  lfo(0.05, 160, lp.frequency);
}

// ---------- the composer ----------
function buildMusic(def, { ac, s, out, loop, filt, burst, every, engine }) {
  s.canSpin = true;
  const scale = SCALES[def.scale || "major"], beats = def.beats || 4, beatDur = 60 / def.bpm, barDur = beatDur * beats;
  const note = (deg, oct) => { const n = scale.length, o = Math.floor(deg / n); return def.tonic + 12 * (oct - 4 + o) + scale[((deg % n) + n) % n]; };

  // reverb shared by the voices of this track
  const conv = ac.createConvolver(); conv.buffer = engine.impulse;
  const wet = ac.createGain(); wet.gain.value = def.rev ?? 0.4; wet.connect(conv); conv.connect(out);
  const dry = ac.createGain(); dry.connect(out);

  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(FLOOR, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, FLOOR * 2), t + a); g.gain.exponentialRampToValueAtTime(FLOOR, t + a + d); };
  const osc = (type, f, t, end, detune = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t); o.stop(end); return o; };
  const send = (node, amt = 1) => { node.connect(dry); if (amt > 0) { const w = ac.createGain(); w.gain.value = amt; node.connect(w); w.connect(wet); } };

  // --- voices ---
  const padNote = (t, f, dur, level, cutoff, wave) => {
    const g = ac.createGain(), lp = filt("lowpass", cutoff, 0.4), a = Math.min(1.8, dur * 0.4), r = Math.min(2.2, dur * 0.6), end = t + dur + r;
    g.gain.setValueAtTime(FLOOR, t); g.gain.linearRampToValueAtTime(level, t + a); g.gain.setValueAtTime(level, t + dur); g.gain.linearRampToValueAtTime(FLOOR, end);
    lp.frequency.setValueAtTime(cutoff * 0.55, t); lp.frequency.linearRampToValueAtTime(cutoff * 1.08, t + a + dur * 0.3); lp.frequency.linearRampToValueAtTime(cutoff * 0.7, end); // the tone opens and closes slowly
    for (const d of [-7, 6]) osc(wave, f, t, end + 0.1, d).connect(lp);
    osc("sine", f / 2, t, end + 0.1).connect(lp);
    lp.connect(g); send(g, 0.7);
  };
  const pluck = (t, f, dur, vel, bright = 1) => { // soft piano / music-box feel
    const g = ac.createGain(), lp = filt("lowpass", 1800 + bright * 2600, 0.3), d = Math.min(dur, 3.2);
    env(g, t, 0.006, vel * 0.5, d);
    const o1 = osc("sine", f, t, t + d + 0.1), o2 = osc("triangle", f * 2, t, t + d * 0.5 + 0.1, 3), g2 = ac.createGain(); g2.gain.value = 0.22 * bright;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); send(g, 0.6);
  };
  const bell = (t, f, dur, vel) => {
    const d = Math.min(dur, 4);
    [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.93, 0.08]].forEach(([r, a], i) => { const g = ac.createGain(); env(g, t, 0.004, vel * 0.3 * a, d / (1 + i * 0.6)); osc("sine", f * r, t, t + d + 0.1).connect(g); send(g, 0.9); });
  };
  const harp = (t, f, dur, vel) => { // a plucked string with a long, glowing tail
    const d = Math.min(dur, 4.2), g = ac.createGain(), lp = filt("lowpass", 4200, 0.3);
    env(g, t, 0.003, vel * 0.42, d);
    osc("sine", f, t, t + d + 0.1).connect(lp);
    const b = osc("triangle", f, t, t + d * 0.6 + 0.1, 5), bg = ac.createGain(); bg.gain.value = 0.3; b.connect(bg); bg.connect(lp);
    const c = osc("sine", f * 2, t, t + d * 0.35 + 0.1), cg = ac.createGain(); cg.gain.value = 0.15; c.connect(cg); cg.connect(lp);
    lp.connect(g); send(g, 0.9);
  };
  const kalimba = (t, f, dur, vel) => { // a thumb piano: quick, round and woody
    const d = Math.min(dur, 1.6), g = ac.createGain();
    env(g, t, 0.002, vel * 0.5, d);
    osc("sine", f, t, t + d + 0.1).connect(g);
    const o = osc("sine", f * 5.4, t, t + 0.3, 0), og = ac.createGain(); og.gain.setValueAtTime(0.22, t); og.gain.exponentialRampToValueAtTime(FLOOR, t + 0.18); o.connect(og); og.connect(g);
    send(g, 0.6);
  };
  const strings = (t, f, dur, vel) => { // a slow bowed swell
    const g = ac.createGain(), lp = filt("lowpass", 1500, 0.5), a = Math.min(1.3, dur * 0.45), r = Math.min(1.8, dur * 0.6), end = t + dur + r;
    g.gain.setValueAtTime(FLOOR, t); g.gain.linearRampToValueAtTime(vel * 0.075, t + a); g.gain.setValueAtTime(vel * 0.075, t + dur); g.gain.linearRampToValueAtTime(FLOOR, end);
    for (const det of [-9, 0, 9]) osc("sawtooth", f, t, end + 0.1, det).connect(lp);
    lp.connect(g); send(g, 0.7);
  };
  const choir = (t, f, dur, vel) => { // an "ah" made from a saw wave through vowel filters, with a little vibrato
    const g = ac.createGain(), a = Math.min(1.0, dur * 0.4), r = Math.min(1.6, dur * 0.6), end = t + dur + r, sum = ac.createGain();
    g.gain.setValueAtTime(FLOOR, t); g.gain.linearRampToValueAtTime(vel * 0.1, t + a); g.gain.setValueAtTime(vel * 0.1, t + dur); g.gain.linearRampToValueAtTime(FLOOR, end);
    const vib = osc("sine", 5.2, t, end + 0.1), vg = ac.createGain(); vg.gain.value = 7; vib.connect(vg);
    for (const det of [-6, 6]) { const o = osc("sawtooth", f, t, end + 0.1, det); vg.connect(o.detune); for (const [ff, gg] of [[800, 1], [1150, 0.5], [2900, 0.18]]) { const b = filt("bandpass", ff, 6), bg = ac.createGain(); bg.gain.value = gg; o.connect(b); b.connect(bg); bg.connect(sum); } }
    sum.connect(g); send(g, 0.85);
  };
  const keys = (t, f, dur, vel) => { // electric piano: a sine with a decaying FM "bite"
    const d = Math.min(dur, 2.8), g = ac.createGain(), car = osc("sine", f, t, t + d + 0.1), mod = osc("sine", f * 2, t, t + d + 0.1), mg = ac.createGain();
    mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(FLOOR + 1, t + 0.5); mod.connect(mg); mg.connect(car.frequency);
    env(g, t, 0.008, vel * 0.42, d);
    const lp = filt("lowpass", 2600, 0.5); car.connect(lp); lp.connect(g); send(g, 0.45);
  };
  const saw = (t, f, dur, vel) => {
    const g = ac.createGain(), lp = filt("lowpass", 2400, 2), d = Math.min(dur, 0.5);
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(380, t + d);
    env(g, t, 0.005, vel * 0.22, d);
    for (const det of [-9, 9]) osc("sawtooth", f, t, t + d + 0.1, det).connect(lp);
    lp.connect(g); send(g, 0.35);
  };
  const bassNote = (t, f, dur, vel, style) => {
    const g = ac.createGain(), d = Math.min(dur, 1.6), synth = style === "synth";
    env(g, t, synth ? 0.004 : 0.02, vel * 0.5, d);
    const o = osc(synth ? "sawtooth" : "sine", f, t, t + d + 0.1);
    if (synth) { const lp = filt("lowpass", 520, 1); o.connect(lp); lp.connect(g); } else o.connect(g);
    const h = osc("triangle", f * 2, t, t + d + 0.1), hg = ac.createGain(); hg.gain.value = 0.28; h.connect(hg); hg.connect(g); // the 2nd harmonic lets small speakers hear the note
    g.connect(dry);
  };
  const kick = (t, vel = 1) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.7 * vel, t); g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.28); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.3);
  };
  const snare = (t, vel = 1, hard = false) => {
    burst(t, dry, { f: hard ? 2200 : 1500, q: 0.7, dur: hard ? 0.16 : 0.12, gain: 0.32 * vel });
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 185; g.gain.setValueAtTime(0.16 * vel, t); g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.09); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.1);
  };
  const hat = (t, vel = 1) => burst(t, dry, { f: 7500, q: 0.5, dur: 0.035, gain: 0.08 * vel, type: "highpass" });

  // texture under the music (vinyl crackle, rain, wind) for the moods that want it
  if (def.bed === "vinyl") {
    const h = filt("highpass", 3500); h.connect(out); loop("pink", h, 0.03);
    every(0.1, 0.9, (t) => burst(t, out, { f: rnd(1500, 5000), q: 0.6, dur: rnd(0.003, 0.012), gain: rnd(0.02, 0.1), type: "highpass" }));
  } else if (def.bed === "rain") { const f = filt("bandpass", 1800, 0.4); f.connect(out); loop("pink", f, 0.22); }
  else if (def.bed === "wind") { const f = filt("bandpass", 600, 0.8); f.connect(out); loop("pink", f, 0.14); }

  let nextBar = ac.currentTime + 0.2, barIdx = 0;
  const L = def.lead || {}, P = def.pad, B = def.bass, D = def.drums;

  const scheduleBar = (t, i) => {
    const deg = def.prog[i % def.prog.length] - 1;
    const chord = [deg, deg + 2, deg + 4]; if (def.sev) chord.push(deg + 6); if (def.ninth) chord.push(deg + 8);
    if (P) chord.forEach((d, k) => padNote(t + k * 0.03, hz(note(d, P.oct ?? 3)), barDur * (P.hold ?? 1.05), (P.level ?? 0.05) / (1 + k * 0.08), P.cutoff ?? 900, P.wave ?? "triangle"));
    if (B) {
      const f = hz(note(deg, B.oct ?? 2));
      if (B.style === "pulse") for (let k = 0; k < beats * 2; k++) bassNote(t + k * beatDur / 2, f, beatDur * 0.45, (B.level ?? 0.6) * (k % 2 ? 0.7 : 1), "synth");
      else if (B.style === "walk") [0, beats / 2].forEach((b) => bassNote(t + b * beatDur, hz(note(b ? deg + 4 : deg, B.oct ?? 2)), beatDur * 1.6, B.level ?? 0.6, "sub"));
      else bassNote(t, f, barDur * 0.95, B.level ?? 0.6, "sub");
    }
    if (L.type) {
      const v = L.level ?? 0.6, oct = L.oct ?? 4;
      const play = (tt, d, vel, dur) => {
        const f = hz(note(d, oct)), vv = v * vel;
        if (L.type === "bell") bell(tt, f, dur, vv); else if (L.type === "harp") harp(tt, f, dur, vv); else if (L.type === "kalimba") kalimba(tt, f, dur, vv); else if (L.type === "strings") strings(tt, f, dur, vv); else if (L.type === "choir") choir(tt, f, dur, vv); else if (L.type === "keys") keys(tt, f, dur, vv); else if (L.type === "saw") saw(tt, f, dur, vv); else pluck(tt, f, dur, vv, L.bright ?? 1);
      };
      const human = () => rnd(-0.012, 0.012);
      if (L.pattern === "arp") {
        const steps = beats * (L.fast ? 4 : 2), gap = beatDur * (L.fast ? 0.25 : 0.5), tones = chord.slice(0, L.tones ?? 4);
        for (let k = 0; k < steps; k++) {
          if (Math.random() > (L.density ?? 0.8) && k % 4) continue;
          const n = tones.length, cyc = L.updown ? 2 * n - 2 : n, p = k % cyc, idx = p < n ? p : cyc - p;
          const up = !L.updown && Math.floor(k / n) % 2 ? 7 : 0; // second pass sits an octave higher
          play(t + k * gap + human(), tones[idx] + up, k % 4 === 0 ? 1 : rnd(0.5, 0.8), beatDur * 3);
        }
      } else if (L.pattern === "cascade") {
        const n = beats * 2 + 2, top = deg + 11;
        for (let k = 0; k < n; k++) { if (Math.random() > (L.density ?? 0.9)) continue; play(t + k * beatDur * 0.4 + human(), top - k * (L.step ?? 1), Math.max(0.3, 1 - k * 0.07), beatDur * 4); }
      } else if (L.pattern === "rolled") {
        chord.forEach((d, k) => play(t + k * 0.11 + human(), d, 0.8 - k * 0.07, barDur));
        if (Math.random() < 0.7) [chord[2], chord[1] + 7].forEach((d, k) => play(t + beatDur * (beats / 2) + k * 0.12, d, 0.5, barDur * 0.6));
      } else if (L.pattern === "melody") {
        const rhythms = [[0, 1.5, 2.5], [0.5, 2, 3], [0, 2, 3.5], [1, 2.5], [0, 1, 2, 3], [0.5, 1.5, 3]].map((r) => r.filter((x) => x < beats));
        let cur = L.cur ?? (L.cur = deg + 4);
        for (const b of pick(rhythms)) {
          if (Math.random() > (L.density ?? 0.75)) continue;
          if (b % 2 === 0 && Math.random() < 0.55) cur = pick(chord) + 7 * (Math.random() < 0.4 ? 1 : 0); else cur += pick([-2, -1, -1, 1, 1, 2]);
          cur = Math.max(deg + 1, Math.min(deg + 9, cur));
          play(t + b * beatDur + human(), cur, rnd(0.55, 0.95), beatDur * rnd(2, 4));
        }
        L.cur = cur;
      } else { // "sparse": a few long, quiet notes
        const n = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) play(t + rnd(0, barDur * 0.85), pick([...chord, deg + 7, deg + 9]), rnd(0.4, 0.8), barDur);
      }
    }
    if (D) {
      const lv = D.level ?? 0.5, sw = D.swing ?? 0, fill = i % 8 === 7;
      const at = (b) => t + b * beatDur;
      if (D.style === "synth") {
        for (let b = 0; b < beats; b++) kick(at(b), lv); [1, 3].forEach((b) => b < beats && snare(at(b), lv, true));
        for (let b = 0; b < beats; b++) hat(at(b + 0.5), lv);
      } else { // lofi: lazy kick, backbeat snare, swung hats
        kick(at(0), lv); if (beats === 4) kick(at(i % 2 ? 2.5 : 2.25), lv * 0.8);
        [1, 3].forEach((b) => b < beats && snare(at(b) + rnd(0, 0.02), lv * 0.7));
        for (let k = 0; k < beats * 2; k++) if (!(fill && k > 5 && k % 2)) hat(at(k * 0.5) + (k % 2 ? sw * beatDur * 0.5 : 0) + rnd(0, 0.012), lv * (k % 2 ? 0.45 : 0.8) * rnd(0.7, 1));
      }
    }
  };
  s.ticks.push((until) => { while (nextBar < until) { scheduleBar(nextBar, barIdx++); nextBar += barDur; } });
}
