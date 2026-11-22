// Giro de roleta de verdade (usado na roda do dia e no giro da sorte): arranque rápido, freada longa, estalo e chicotada do ponteiro
// a cada pino que passa, passa um pouquinho do ponto e volta ao parar. `to` é o ângulo final (graus, sentido horário).
import * as sfx from './sfx.js';
const easeOut = p => 1 - Math.pow(1 - p, 4);
const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
export function spinWheel(rot, { from = 0, to, ms = 5600, pin = null, seg = 36, reduced = false, onTick = null }) {
  return new Promise(res => {
    if (reduced) { rot.style.transform = `rotate(${to}deg)`; return res(); }
    const over = Math.min(3, seg * 0.1), settle = 520, t0 = performance.now();
    let last = Math.floor((from + seg / 2) / seg), prevA = from, prevT = t0;
    const frame = now => {
      const t = now - t0;
      const a = t < ms ? from + (to + over - from) * easeOut(t / ms) : t < ms + settle ? to + over * (1 - easeInOut((t - ms) / settle)) : to;
      rot.style.transform = `rotate(${a}deg)`;
      const k = Math.floor((a + seg / 2) / seg);
      if (k !== last) {
        const speed = Math.abs(a - prevA) / Math.max(1, now - prevT);   // graus por ms
        last = k; sfx.tick(Math.max(0.25, Math.min(1, speed / 1.4)));
        if (speed > 0.03) navigator.vibrate?.(6);
        pin?.animate([{ transform: `rotate(${-Math.min(34, 10 + speed * 22)}deg)` }, { transform: 'rotate(0deg)' }], { duration: Math.min(220, 90 + 60 / Math.max(0.15, speed)), easing: 'ease-out' });
        onTick?.(k);
      }
      prevA = a; prevT = now;
      if (t < ms + settle) requestAnimationFrame(frame); else res();
    };
    requestAnimationFrame(frame);
  });
}
// ângulo final para parar a fatia `i` embaixo do ponteiro (topo), girando `turns` voltas completas; jitter = quanto dentro da fatia (0 a 1)
export const landAt = (from, i, n, turns = 6, jitter = 0.5) => {
  const seg = 360 / n, want = ((360 - i * seg - (from % 360)) % 360 + 360) % 360;
  return from + 360 * turns + want + (jitter - 0.5) * seg * 0.7;
};
