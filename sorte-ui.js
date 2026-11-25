// Tela do giro da sorte (a regra fica em sorte.js, que roda também nos testes).
import * as sfx from './sfx.js';
import { spinWheel, landAt } from './wheel.js';
import { G, $, int, save, badge, confetti, RM } from './store.js';
import { ensure, ready, monthsLeft, spin, yearOf, SLICES, CARD_SLICES } from './sorte.js';
export * from './sorte.js';

// ---------- tela ----------
let busy = false, angle = 0, notified = -1;
const wheelSVG = () => {
  const seg = 360 / SLICES, pt = (a, r) => [150 + r * Math.sin(a * Math.PI / 180), 150 - r * Math.cos(a * Math.PI / 180)];
  return `<svg viewBox="0 0 300 300" aria-label="roleta da sorte"><g id="so-rot">${Array.from({ length: SLICES }, (_, i) => {
    const [x1, y1] = pt(i * seg - seg / 2, 140), [x2, y2] = pt(i * seg + seg / 2, 140), [tx, ty] = pt(i * seg, 98), card = CARD_SLICES.includes(i);
    return `<path d="M150 150 L${x1} ${y1} A140 140 0 0 1 ${x2} ${y2} Z" class="so-seg so-seg--${card ? 'card' : i % 2 ? 'a' : 'b'}"/>
      <text x="${tx}" y="${ty}" transform="rotate(${i * seg} ${tx} ${ty})" class="so-ico">${card ? '🃏' : '💥'}</text>`;
  }).join('')}<circle cx="150" cy="150" r="140" class="so-rim"/>${Array.from({ length: SLICES }, (_, i) => { const [x, y] = pt(i * seg - seg / 2, 140); return `<circle cx="${x}" cy="${y}" r="4.5" class="so-peg"/>`; }).join('')}</g>
    <circle cx="150" cy="150" r="26" class="so-hub"/><text x="150" y="157" class="so-hubtxt">🍀</text></svg>`;
};
function info() {
  const s = G.S, o = ensure(s), left = monthsLeft(s);
  $('#so-info').innerHTML = `<p><b>Como funciona:</b> todo ano do mundo (12 meses, mais ou menos 2 horas reais) você ganha <b>1 giro</b>. São 10 fatias: <b>2 têm uma carta</b> (20%) e as outras 8 <b>estouram a roleta</b>, sem nada.</p>
    <p><b>A carta é um item raro.</b> Não se compra pronta: vem de pacotes caros, da roleta do dia (de vez em quando) e deste giro. Quem completa uma <b>coleção inteira</b> ganha o emblema no perfil, sobe no ranking de colecionadores e libera vantagens para sempre.</p>
    <p class="muted small">Você já girou ${int(o.n)} ${o.n === 1 ? 'vez' : 'vezes'} e ganhou ${int(o.wins)} ${o.wins === 1 ? 'carta' : 'cartas'}. Cartas guardadas: ${int((s.cards || []).length)}.${left ? ` Próximo giro em ${left} ${left === 1 ? 'mês' : 'meses'} do mundo (cerca de ${left * 10} min).` : ''}</p>`;
}
function paint(msg, btn) {
  const s = G.S, can = ready(s) && !busy;
  $('#so-sub').innerHTML = msg || (can ? '<strong class="dw-win">Você ganhou um giro da sorte!</strong> Gire e torça: 2 em cada 10 fatias dão uma carta rara.' : 'Seu giro já foi usado. Todo ano do mundo libera outro.');
  const b = $('#so-btn'); b.textContent = btn || (can ? 'girar a roleta' : 'sem giro agora'); b.disabled = !can && !btn; b.dataset.act = btn ? 'sorte-close' : 'sorte-spin';
  info();
}
export function open() {
  const d = $('#dlg-sorte'); if (!d) return;
  $('#so-wheel').innerHTML = wheelSVG(); angle = 0; $('#so-fx').innerHTML = ''; $('#so-wheel').className = 'so__wheel';
  paint(); if (!d.open) d.showModal();
}
export const close = () => { if (!busy) $('#dlg-sorte')?.close(); };

// estouro: tremor, clarão, a roda explode em cacos e fumaça. Nada de carta.
async function burst() {
  const w = $('#so-wheel'), fx = $('#so-fx');
  w.classList.add('is-rumble'); sfx.tick(1);
  await new Promise(r => setTimeout(r, RM.matches ? 0 : 650));
  w.classList.remove('is-rumble'); w.classList.add('is-burst'); sfx.boom(); navigator.vibrate?.([40, 30, 80]);
  if (!RM.matches) {
    fx.innerHTML = '<i class="so-flash"></i><i class="so-smoke"></i>' + Array.from({ length: 22 }, (_, i) => `<b class="so-shard" style="--a:${i * (360 / 22) + Math.random() * 12}deg;--d:${90 + Math.random() * 120}px;--s:${6 + Math.random() * 16}px;--r:${Math.random() * 540 - 270}deg"></b>`).join('');
    await new Promise(r => setTimeout(r, 900));
  }
  w.classList.remove('is-burst'); w.classList.add('is-gone'); fx.innerHTML = '';
}
export async function doSpin() {
  if (busy) return;
  const r = spin(G.S);
  if (r.err) return paint(r.err);
  save(); busy = true; G.render?.();
  const b = $('#so-btn'); b.disabled = true; b.textContent = 'girando...'; $('#so-sub').textContent = 'Valendo uma carta rara...';
  const to = landAt(angle, r.slice, SLICES, 6, Math.random());
  await spinWheel($('#so-rot'), { from: angle, to, ms: RM.matches ? 2500 : 6200, pin: $('#so-pin'), seg: 360 / SLICES });   // gira sempre (mais curto com reduzir animações)
  angle = to;
  if (r.win) {
    $('#so-wheel').classList.add('is-win'); sfx.fanfare(); sfx.play('stack', 0.7); confetti(180);
    busy = false; paint('<strong class="dw-win">É CARTA! 🃏</strong> Uma carta rara vai para a sua coleção.', 'ver a carta');
    setTimeout(() => { $('#dlg-sorte')?.close(); G.showCard?.([r.card]); }, RM.matches ? 0 : 1100);
  } else {
    await burst(); busy = false;
    paint('<strong class="so-lose">💥 A roleta estourou!</strong> Dessa vez não veio carta. Ano que vem tem outro giro.', 'fechar');
  }
  save(); G.render?.();
}
// chamado a cada segundo: mostra o botão do topo quando há giro e avisa uma vez por ano
export function refresh(s) {
  const b = $('#sortebtn'); if (!b || !s) return;
  const on = ready(s); b.hidden = !on;
  if (on && notified !== yearOf(s.month)) { notified = yearOf(s.month); badge('Giro da sorte', 'Você ganhou um giro da sorte! 2 em cada 10 fatias dão uma carta rara.', 'mission'); sfx.fanfare(); }
}
