// Sons de cassino (Kenney Casino Audio, CC0). Variações sorteadas para não soar repetitivo.
const SETS = {
  slide: ['card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-4'],
  place: ['card-place-1', 'card-place-2'],
  shuffle: ['card-shuffle'],
  fan: ['card-fan-1'],
  chip: ['chip-lay-1', 'chip-lay-2', 'chip-lay-3'],
  chips: ['chips-collide-1', 'chips-collide-2'],
  stack: ['chips-stack-1', 'chips-stack-2'],
  handle: ['chips-handle-1'],
  ball: ['dice-throw-1'],
};
const KEY = '21world.mute';
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch {}
const cache = {};
export function play(name, vol = 0.6) {
  if (muted) return;
  const list = SETS[name]; if (!list) return;
  const file = list[Math.floor(Math.random() * list.length)];
  const base = cache[file] ??= new Audio(`assets/sfx/${file}.ogg`);
  const a = base.cloneNode();
  a.volume = vol;
  a.play().catch(() => {});
}
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
  return muted;
}

// dinheiro entrando: "ka-ching" de registradora (dois toques de sino + moedas), sintetizado, ~0,6 s.
// big = versão mais cheia (mais moedas) para valores altos. Nunca toca duas vezes em 1,5 s (lançamentos em sequência).
let lastCash = 0;
export function cash(big = false) {
  if (muted || Date.now() - lastCash < 1500) return;
  lastCash = Date.now();
  try {
    ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.01, out = ctx.createGain(); out.gain.value = big ? 0.3 : 0.22; out.connect(ctx.destination);
    const bell = (f, at, dur, v) => { for (const [m, g] of [[1, 1], [2.76, 0.3], [5.4, 0.1]]) {
      const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m;
      e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(v * g, at + 0.005); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(e).connect(out); o.start(at); o.stop(at + dur + 0.05); } };
    bell(1318.5, t0, 0.45, 0.45); bell(1975.5, t0 + 0.08, 0.85, 0.6);   // ka-ching (mi e si, quinta acima)
    const n = big ? 7 : 3;
    for (let i = 0; i < n; i++) bell(2500 + Math.random() * 1500, t0 + 0.15 + i * (big ? 0.05 : 0.07) + Math.random() * 0.02, 0.22, 0.16);   // moedas caindo
  } catch {}
}

// torcida do canódromo: ruído filtrado cujo volume sobe na reta final
let ctx, crowdSrc, crowdGain;
export function crowd(on, level = 0.5) {
  try {
    ctx ??= new AudioContext();
    if (on && !muted && !crowdSrc) {
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.5; }
      crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = buf; crowdSrc.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
      crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
      crowdSrc.connect(f).connect(crowdGain).connect(ctx.destination); crowdSrc.start();
    }
    if (crowdGain) crowdGain.gain.linearRampToValueAtTime(on ? 0.12 * level : 0, ctx.currentTime + (on ? 0.8 : 1.2));
    if (!on && crowdSrc) { const s = crowdSrc; crowdSrc = null; setTimeout(() => { try { s.stop(); } catch {} }, 1400); }
  } catch {}
}

// zumbido do avião no Aviator, sintetizado (sem arquivo)
let osc, gain;
export function engine(on, pitch = 1) {
  if (muted && on) return;
  try {
    ctx ??= new AudioContext();
    if (on && !osc) {
      osc = ctx.createOscillator(); gain = ctx.createGain();
      osc.type = 'sawtooth'; gain.gain.value = 0.025;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      osc.connect(f).connect(gain).connect(ctx.destination); osc.start();
    }
    if (osc) osc.frequency.value = 70 + pitch * 30;
    if (!on && osc) { osc.stop(); osc = null; }
  } catch {}
}

// roleta: estalo de cada pino que passa pelo ponteiro (v = 0 a 1, mais forte quando a roda está rápida)
export function tick(v = 0.6) {
  if (muted) return;
  try {
    ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(1300 + Math.random() * 500, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.03);
    g.gain.setValueAtTime(0.07 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.05);
  } catch {}
}
// a roleta estoura: estrondo grave com chiado
export function boom() {
  if (muted) return;
  try {
    ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * 0.7), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
    n.buffer = buf; f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.6);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    n.connect(f).connect(g).connect(ctx.destination); o.connect(og).connect(ctx.destination); n.start(t); o.start(t); o.stop(t + 0.6);
  } catch {}
}
// ganhou a carta: três notas subindo
export function fanfare() {
  if (muted) return;
  try {
    ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume();
    [523, 659, 784, 1047].forEach((hz, i) => {
      const t = ctx.currentTime + i * 0.11, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(hz, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.55);
    });
  } catch {}
}
