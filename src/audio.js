// Procedural sound effects + ambience with WebAudio (no audio files needed).
let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
let enabled = true;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 0.8 : 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.22; ambBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
}
export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.8 : 0; }
export const soundOn = () => enabled;

function noise(dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.5, attack = 0.005, when = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(sfxBus);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function tone(dur, { type = 'sine', f0 = 440, f1 = f0, gain = 0.3, attack = 0.005, when = 0, dest } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  swing() { noise(0.18, { f0: 2400, f1: 600, q: 0.8, gain: 0.35 }); },
  heavySwing() { noise(0.35, { f0: 1800, f1: 300, q: 0.7, gain: 0.5 }); tone(0.3, { type: 'triangle', f0: 160, f1: 70, gain: 0.15 }); },
  hit(crit) {
    tone(0.12, { type: 'triangle', f0: crit ? 260 : 180, f1: 60, gain: 0.45 });
    noise(0.09, { type: 'highpass', f0: 3000, f1: 1500, gain: crit ? 0.35 : 0.22 });
    if (crit) tone(0.25, { type: 'square', f0: 900, f1: 1400, gain: 0.06, when: 0.02 });
  },
  bone() { noise(0.07, { type: 'bandpass', f0: 2600, q: 6, gain: 0.25 }); noise(0.06, { type: 'bandpass', f0: 1700, q: 8, gain: 0.2, when: 0.05 }); },
  hurt() { tone(0.18, { type: 'sawtooth', f0: 200, f1: 90, gain: 0.12 }); noise(0.12, { f0: 800, f1: 300, gain: 0.25 }); },
  magic() { tone(0.35, { type: 'sine', f0: 500, f1: 1300, gain: 0.18 }); tone(0.35, { type: 'triangle', f0: 750, f1: 1900, gain: 0.08, when: 0.03 }); },
  boom(big) {
    noise(big ? 1.2 : 0.6, { type: 'lowpass', f0: big ? 1200 : 1800, f1: 60, gain: big ? 0.9 : 0.6, attack: 0.01 });
    tone(big ? 0.9 : 0.4, { type: 'sine', f0: big ? 110 : 140, f1: 35, gain: big ? 0.7 : 0.45 });
  },
  frost() { noise(0.7, { type: 'highpass', f0: 6000, f1: 2500, gain: 0.3 }); tone(0.6, { type: 'sine', f0: 1600, f1: 900, gain: 0.08 }); },
  spin() { for (let i = 0; i < 3; i++) noise(0.2, { f0: 2000, f1: 500, q: 0.9, gain: 0.3, when: i * 0.14 }); },
  shout() { tone(0.6, { type: 'sawtooth', f0: 140, f1: 220, gain: 0.12 }); tone(0.6, { type: 'sawtooth', f0: 210, f1: 330, gain: 0.08 }); },
  coin() { tone(0.08, { type: 'square', f0: 1320, gain: 0.07 }); tone(0.16, { type: 'square', f0: 1760, gain: 0.07, when: 0.07 }); },
  pickup() { tone(0.12, { type: 'triangle', f0: 660, f1: 990, gain: 0.15 }); tone(0.18, { type: 'triangle', f0: 990, f1: 1320, gain: 0.12, when: 0.08 }); },
  rare() { [523, 659, 784, 1047].forEach((f, i) => tone(0.4, { type: 'triangle', f0: f, gain: 0.12, when: i * 0.07 })); },
  levelUp() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(0.55, { type: 'triangle', f0: f, gain: 0.16, when: i * 0.09 }));
    tone(1.4, { type: 'sine', f0: 1568, gain: 0.08, when: 0.45 }); noise(1.2, { type: 'highpass', f0: 5000, f1: 9000, gain: 0.12, when: 0.3 });
  },
  potion() { for (let i = 0; i < 4; i++) tone(0.07, { type: 'sine', f0: 500 + Math.random() * 500, gain: 0.12, when: i * 0.05 }); },
  ui() { tone(0.05, { type: 'triangle', f0: 880, gain: 0.08 }); },
  deny() { tone(0.12, { type: 'square', f0: 180, gain: 0.07 }); },
  roar() {
    tone(1.4, { type: 'sawtooth', f0: 90, f1: 55, gain: 0.35, attack: 0.08 }); tone(1.3, { type: 'sawtooth', f0: 133, f1: 70, gain: 0.2, attack: 0.1 });
    noise(1.4, { type: 'lowpass', f0: 900, f1: 200, gain: 0.4, attack: 0.1 });
  },
  warn() { [0, 0.25].forEach((w) => tone(0.2, { type: 'square', f0: 330, f1: 300, gain: 0.08, when: w })); },
  enhanceTick() { tone(0.06, { type: 'square', f0: 1200 + Math.random() * 300, gain: 0.04 }); },
  enhanceOk() { [784, 988, 1175, 1568].forEach((f, i) => tone(0.5, { type: 'triangle', f0: f, gain: 0.15, when: i * 0.06 })); noise(0.8, { type: 'highpass', f0: 6000, gain: 0.15 }); },
  enhanceFail() { tone(0.6, { type: 'sawtooth', f0: 300, f1: 70, gain: 0.18 }); noise(0.3, { type: 'bandpass', f0: 2500, q: 3, gain: 0.3 }); },
  death() { tone(1.2, { type: 'sawtooth', f0: 220, f1: 50, gain: 0.2 }); tone(1.5, { type: 'sine', f0: 110, f1: 40, gain: 0.3 }); },
  step() { noise(0.05, { type: 'lowpass', f0: 500, f1: 200, gain: 0.05 }); },
};

function startAmbience() {
  // Soft wind: looping noise through slowly modulated low-pass filter.
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 420; flt.Q.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 220; lfo.connect(lfoG); lfoG.connect(flt.frequency);
  const g = ctx.createGain(); g.gain.value = 0.5;
  src.connect(flt); flt.connect(g); g.connect(ambBus); src.start(); lfo.start();
  // Dark drone pad.
  [55, 82.4, 110.2].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine'; o.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = 0.06 / (i + 1);
    const l = ctx.createOscillator(); l.frequency.value = 0.05 + i * 0.03; const lg = ctx.createGain(); lg.gain.value = 0.03 / (i + 1);
    l.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(ambBus); o.start(); l.start();
  });
}
