// Game audio: recorded sound effects (Kenney, CC0), background music (CC0 tracks) and soft procedural
// ambience (wind, fire, crickets, waves…) that follows the map's theme.
const BASE = import.meta.env.BASE_URL + 'assets/';
let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
let enabled = true;
const VOL = { music: 0.45, sfx: 0.85, amb: 0.5 };
try {
  enabled = localStorage.getItem('kv-sound') !== '0';
  for (const k of Object.keys(VOL)) { const v = localStorage.getItem('kv-vol-' + k); if (v != null) VOL[k] = +v; }
} catch { /* ignore */ }

// ---------- samples ----------
const range = (p, n) => Array.from({ length: n }, (_, i) => p + i);
const SAMPLES = [
  ...range('swing', 4).map((s, i) => 'swing' + (i + 1)), 'chop',
  ...range('hit', 5).map((s, i) => 'hit' + i), ...range('crit', 5).map((s, i) => 'crit' + i), ...range('metal', 5).map((s, i) => 'metal' + i),
  ...range('bone', 5).map((s, i) => 'bone' + i), ...range('hurt', 5).map((s, i) => 'hurt' + i), ...range('step', 5).map((s, i) => 'step' + i),
  ...range('snow', 5).map((s, i) => 'snow' + i), ...range('glass', 5).map((s, i) => 'glass' + i),
  ...[0, 1, 2].flatMap((i) => ['wood' + i, 'plate' + i, 'bell' + i, 'rock' + i, 'shatter' + i]),
  'coin1', 'coin2', 'leather1', 'leather2', 'drop', 'cloth1', 'cloth2', 'pot1', 'pot2', 'book',
  'click', 'select', 'error', 'confirm', 'rare', 'bong', 'open', 'close',
];
const buf = {};
async function loadSamples() {
  await Promise.all(SAMPLES.map(async (n) => {
    try { const r = await fetch(BASE + 'sfx/' + n + '.mp3'); buf[n] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch { /* missing sample: silent */ }
  }));
}
// Play one of a set of variations with a little random pitch so repeats don't sound mechanical.
function play(names, { vol = 1, rate = 1, vary = 0.08, when = 0 } = {}) {
  if (!ctx || !enabled) return;
  const list = Array.isArray(names) ? names : [names];
  const b = buf[list[Math.floor(Math.random() * list.length)]]; if (!b) return;
  const src = ctx.createBufferSource(); src.buffer = b;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(sfxBus); src.start(ctx.currentTime + when);
}
const set = (p, n, from = 0) => Array.from({ length: n }, (_, i) => p + (i + from));

// Soft filtered noise for magic whooshes (no beeps).
function whoosh(dur, { f0 = 800, f1 = 2400, q = 1.2, gain = 0.25, when = 0, type = 'bandpass' } = {}) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(sfxBus);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

export let stepKind = 'step';
export function setStepKind(k) { stepKind = k; }

export const sfx = {
  swing() { play(set('swing', 4, 1), { vol: 0.55, rate: 1.1 }); },
  heavySwing() { play(set('swing', 4, 1), { vol: 0.6, rate: 0.75 }); play('chop', { vol: 0.45, rate: 0.9, when: 0.08 }); },
  hit(crit) { play(crit ? set('crit', 5) : set('hit', 5), { vol: crit ? 0.8 : 0.6 }); if (crit) play(set('metal', 5), { vol: 0.35, rate: 1.2 }); },
  bone() { play(set('bone', 5), { vol: 0.45 }); },
  hurt() { play(set('hurt', 5), { vol: 0.7, rate: 0.9 }); },
  magic() { whoosh(0.45, { f0: 600, f1: 2600, gain: 0.22 }); whoosh(0.5, { f0: 2000, f1: 5000, type: 'highpass', gain: 0.08, when: 0.05 }); },
  boom(big) { play(set('rock', 3), { vol: big ? 1 : 0.8, rate: big ? 0.6 : 0.75 }); play(set('wood', 3), { vol: 0.6, rate: 0.5, when: 0.02 }); whoosh(big ? 1.1 : 0.7, { f0: 900, f1: 60, type: 'lowpass', gain: big ? 0.5 : 0.35 }); },
  frost() { play(set('glass', 5), { vol: 0.45, rate: 1.1 }); play(set('glass', 5), { vol: 0.3, rate: 1.4, when: 0.08 }); whoosh(0.7, { f0: 5000, f1: 2500, type: 'highpass', gain: 0.12 }); },
  spin() { for (let i = 0; i < 3; i++) play(set('swing', 4, 1), { vol: 0.4, rate: 1 + i * 0.1, when: i * 0.12 }); },
  shout() { play(set('bell', 3), { vol: 0.55, rate: 0.6 }); whoosh(0.6, { f0: 300, f1: 900, gain: 0.15 }); },
  coin() { play(['coin1', 'coin2'], { vol: 0.5 }); },
  pickup() { play(['leather1', 'leather2', 'cloth1', 'cloth2'], { vol: 0.6 }); },
  rare() { play('rare', { vol: 0.6 }); play(set('bell', 3), { vol: 0.25, rate: 1.6, when: 0.1 }); },
  levelUp() { play('confirm', { vol: 0.7 }); play(set('bell', 3), { vol: 0.5, rate: 1.2, when: 0.12 }); play('bong', { vol: 0.4, when: 0.25 }); },
  potion() { play(['pot1', 'pot2'], { vol: 0.5, rate: 1.4 }); },
  ui() { play('click', { vol: 0.5, vary: 0.03 }); },
  deny() { play('error', { vol: 0.45, vary: 0 }); },
  roar() { play(set('rock', 3), { vol: 0.8, rate: 0.45 }); whoosh(1.4, { f0: 500, f1: 120, type: 'lowpass', q: 2, gain: 0.45 }); },
  warn() { play('bong', { vol: 0.5, rate: 0.8 }); },
  enhanceTick() { play(set('metal', 5), { vol: 0.4 }); },
  enhanceOk() { play(set('bell', 3), { vol: 0.8 }); play('rare', { vol: 0.5, when: 0.1 }); },
  enhanceFail() { play(set('shatter', 3), { vol: 0.7 }); },
  death() { play(set('plate', 3), { vol: 0.7, rate: 0.8 }); play(set('hurt', 5), { vol: 0.6, rate: 0.7, when: 0.1 }); },
  step() { play(stepKind === 'snow' ? set('snow', 5) : set('step', 5), { vol: 0.22 }); },
  open() { play(['open', 'book'], { vol: 0.4 }); },
};

// ---------- music ----------
// Two <audio> elements cross-fade between tracks; files stream, so only the playing track is downloaded.
const music = { a: null, b: null, cur: null, key: null };
function musicEl() { const el = new Audio(); el.loop = true; el.preload = 'none'; el.volume = 0; return el; }
export function playMusic(key) {
  if (music.key === key) return;
  music.key = key;
  if (!music.a) { music.a = musicEl(); music.b = musicEl(); }
  const next = music.cur === music.a ? music.b : music.a, prev = music.cur;
  if (key) { next.src = BASE + 'music/' + key + '.mp3'; next.currentTime = 0; next.play().catch(() => {}); }
  music.cur = key ? next : null;
  const t0 = performance.now();
  const fade = () => {
    const k = Math.min(1, (performance.now() - t0) / 2500), v = enabled ? VOL.music : 0;
    if (key) next.volume = v * k;
    if (prev) prev.volume = Math.max(0, prev.volume * (1 - k));
    if (k < 1) requestAnimationFrame(fade); else if (prev && prev !== music.cur) prev.pause();
  };
  fade();
}
function musicVolume() { if (music.cur) music.cur.volume = enabled ? VOL.music : 0; }

// ---------- ambience ----------
const amb = { wind: null, fire: null, crickets: null, waves: null, rumble: null, theme: null, fireLevel: 0 };
function loopNoise(type, freq, q, gain) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = freq; flt.Q.value = q;
  // g = shaped/modulated level, out = on/off level for the current map.
  const g = ctx.createGain(); g.gain.value = gain; const out = ctx.createGain(); out.gain.value = 0;
  src.connect(flt); flt.connect(g); g.connect(out); out.connect(ambBus); src.start(0, Math.random());
  return { src, flt, g, out };
}
function lfo(target, rate, depth) { const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); }
function startAmbience() {
  amb.wind = loopNoise('lowpass', 380, 0.5, 1); lfo(amb.wind.flt.frequency, 0.06, 160); lfo(amb.wind.g.gain, 0.045, 0.45);
  amb.waves = loopNoise('lowpass', 600, 0.7, 0.55); lfo(amb.waves.g.gain, 0.11, 0.45); lfo(amb.waves.flt.frequency, 0.11, 250);
  amb.rumble = loopNoise('lowpass', 90, 1, 1);
  // Campfire crackle: short random clicks.
  setInterval(() => {
    if (!enabled || amb.fireLevel < 0.05 || Math.random() > 0.55) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 3000; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25 * amb.fireLevel * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
    src.connect(f); f.connect(g); g.connect(ambBus); src.start(t, Math.random()); src.stop(t + 0.1);
  }, 70);
  // Crickets: soft high chirp trains now and then.
  setInterval(() => {
    if (!enabled || !amb.cricketsOn || Math.random() > 0.35) return;
    const t0 = ctx.currentTime, base = 4200 + Math.random() * 800, n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.07, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      o.connect(g); g.connect(ambBus); o.start(t); o.stop(t + 0.06);
    }
  }, 900);
}
// Ambience per map theme: wind strength, crickets, sea waves, deep lava rumble.
const AMB = {
  bones: { wind: 0.05, crickets: true }, swamp: { wind: 0.03, crickets: true }, desert: { wind: 0.09 }, snow: { wind: 0.14 },
  lava: { wind: 0.04, rumble: 0.18 }, coast: { wind: 0.06, waves: 0.12 }, ghost: { wind: 0.06, crickets: true }, dragon: { wind: 0.08, rumble: 0.12 },
};
export function setAmbience(theme) {
  amb.theme = theme;
  if (!ctx) return;
  const a = AMB[theme] || AMB.bones, t = ctx.currentTime;
  amb.wind.out.gain.setTargetAtTime(a.wind || 0, t, 1.5);
  amb.waves.out.gain.setTargetAtTime(a.waves || 0, t, 1.5);
  amb.rumble.out.gain.setTargetAtTime(a.rumble || 0, t, 1.5);
  amb.cricketsOn = !!a.crickets;
}
// 0..1, how close the player is to a campfire.
export function setFireLevel(k) { amb.fireLevel = k; }

// ---------- setup & settings ----------
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 1 : 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(comp);
  ambBus = ctx.createGain(); ambBus.gain.value = VOL.amb; ambBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  loadSamples();
  startAmbience();
  if (amb.theme) setAmbience(amb.theme);
  if (music.key && music.cur?.paused) music.cur.play().catch(() => {});
}
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('kv-sound', on ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.value = on ? 1 : 0;
  musicVolume();
}
export const soundOn = () => enabled;
export const getVolume = (k) => VOL[k];
export function setVolume(k, v) {
  VOL[k] = v;
  try { localStorage.setItem('kv-vol-' + k, String(v)); } catch { /* ignore */ }
  if (k === 'sfx' && sfxBus) sfxBus.gain.value = v;
  if (k === 'amb' && ambBus) ambBus.gain.value = v;
  if (k === 'music') musicVolume();
}
// Browsers only allow sound after a tap: unlock on the first one anywhere.
addEventListener('pointerdown', () => initAudio(), { once: true });
// Pause music when the app goes to the background.
document.addEventListener('visibilitychange', () => {
  if (!music.cur) return;
  if (document.hidden) music.cur.pause(); else if (enabled) music.cur.play().catch(() => {});
});
