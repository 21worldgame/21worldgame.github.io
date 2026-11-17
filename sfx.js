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
