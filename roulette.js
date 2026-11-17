// Roleta europeia (um zero): roda animada, bola e mesa de apostas.
import * as GM from './games.js';
import { G, $, int, say, save, award, note, confetti, ms, RM } from './store.js';
import * as sfx from './sfx.js';

let bets = {}, chip = 25, spinning = false, wheelAngle = 0, hist = [];
const SEG = 360 / 37;

export function initRoulette() {
  // roda em SVG: setores na ordem real da roleta europeia
  const R = 150, r0 = 96;
  const pt = (a, rad) => [160 + rad * Math.sin((a * Math.PI) / 180), 160 - rad * Math.cos((a * Math.PI) / 180)];
  const sectors = GM.WHEEL.map((n, i) => {
    const a1 = i * SEG - SEG / 2, a2 = a1 + SEG, [x1, y1] = pt(a1, R), [x2, y2] = pt(a2, R), [x3, y3] = pt(a2, r0), [x4, y4] = pt(a1, r0), [tx, ty] = pt(i * SEG, 132);
    return `<path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r0} ${r0} 0 0 0 ${x4} ${y4} Z" class="rl-sec rl-sec--${GM.colorOf(n)}"/>
      <text x="${tx}" y="${ty}" transform="rotate(${i * SEG} ${tx} ${ty})" class="rl-num">${n}</text>`;
  }).join('');
  const frets = GM.WHEEL.map((_, i) => { const [x1, y1] = pt(i * SEG - SEG / 2, r0 - 14), [x2, y2] = pt(i * SEG - SEG / 2, R); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="rl-fret"/>`; }).join('');
  $('#rl-wheel').innerHTML = `<svg viewBox="0 0 320 320" aria-label="roleta"><circle cx="160" cy="160" r="158" class="rl-rim"/>
    <g id="rl-rot">${sectors}${frets}<circle cx="160" cy="160" r="82" class="rl-pockets"/><circle cx="160" cy="160" r="56" class="rl-cone"/>
      <g class="rl-turret">${[0, 90, 180, 270].map(a => `<rect x="156" y="104" width="8" height="40" rx="4" transform="rotate(${a} 160 160)"/>`).join('')}<circle cx="160" cy="160" r="12"/></g></g></svg>
    <div class="rl-ballarm" id="rl-arm"><i class="rl-ball" id="rl-ball"></i></div><span class="rl-pointer" aria-hidden="true"></span>`;

  // mesa: zero, 3 x 12 números, colunas, dúzias e apostas externas
  const nums = [];
  for (let c = 1; c <= 12; c++) for (let r = 3; r >= 1; r--) nums.push((c - 1) * 3 + r);
  const cell = (key, label, cls = '') => `<button class="rl-cell ${cls}" data-rbet="${key}"><span>${label}</span><i class="rl-stack"></i></button>`;
  $('#rl-board').innerHTML = `
    <div class="rl-grid">
      ${cell('n:0', '0', 'rl-zero is-green')}
      ${[3, 2, 1].map(row => Array.from({ length: 12 }, (_, c) => { const n = c * 3 + row; return cell(`n:${n}`, n, `is-${GM.colorOf(n)}`); }).join('')).join('')}
      ${cell('col3', '2:1', 'rl-col')}${cell('col2', '2:1', 'rl-col')}${cell('col1', '2:1', 'rl-col')}
    </div>
    <div class="rl-outer">
      ${cell('dz1', '1ª dúzia')}${cell('dz2', '2ª dúzia')}${cell('dz3', '3ª dúzia')}
      ${cell('low', '1 a 18')}${cell('even', 'par')}${cell('red', '<i class="rl-dia is-red"></i>', 'is-redbet')}${cell('black', '<i class="rl-dia is-black"></i>', 'is-blackbet')}${cell('odd', 'ímpar')}${cell('high', '19 a 36')}
    </div>`;
  renderBets();
}

export function pickChip(v) { chip = Number(v); document.querySelectorAll('[data-rchip]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.rchip) === chip)); }

export function placeBet(key) {
  if (spinning) return;
  const total = Object.values(bets).reduce((a, b) => a + b, 0);
  if (total + chip > G.S.chips) return say('Fichas insuficientes para essa aposta.', true);
  bets[key] = (bets[key] || 0) + chip;
  sfx.play('chip', 0.45);
  renderBets();
}
export function clearBets() { if (!spinning) { bets = {}; renderBets(); } }

function renderBets() {
  document.querySelectorAll('[data-rbet]').forEach(c => {
    const v = bets[c.dataset.rbet], st = c.querySelector('.rl-stack');
    st.textContent = v ? int(v) : ''; st.classList.toggle('is-on', !!v);
  });
  $('#rl-total').textContent = int(Object.values(bets).reduce((a, b) => a + b, 0));
  $('[data-act="rl-spin"]').disabled = spinning || !Object.keys(bets).length;
}

export async function spin() {
  const total = Object.values(bets).reduce((a, b) => a + b, 0);
  if (spinning || !total) return;
  if (total > G.S.chips) return say('Fichas insuficientes.', true);
  spinning = true; renderBets();
  G.S.chips -= total; save(); G.render();
  document.querySelectorAll('.rl-cell.is-hit').forEach(c => c.classList.remove('is-hit'));
  const n = GM.WHEEL[Math.floor(Math.random() * 37)], idx = GM.WHEEL.indexOf(n);
  // a roda gira no sentido horário e para com o número do resultado embaixo do ponteiro
  const target = wheelAngle + 360 * 5 + ((360 - idx * SEG - (wheelAngle % 360)) % 360 + 360) % 360;
  const dur = RM.matches ? 0 : 6000;
  sfx.play('ball', 0.25);
  $('#rl-rot').animate([{ transform: `rotate(${wheelAngle}deg)` }, { transform: `rotate(${target}deg)` }],
    { duration: dur, easing: 'cubic-bezier(.12,.7,.18,1)', fill: 'forwards' });
  // a bola corre ao contrário pela borda e cai na casa (topo) no fim
  $('#rl-arm').animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2160deg)' }], { duration: dur, easing: 'cubic-bezier(.1,.6,.2,1)', fill: 'forwards' });
  $('#rl-ball').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(0)', offset: 0.65 }, { transform: 'translateY(30px)', offset: 0.82 }, { transform: 'translateY(26px)', offset: 0.9 }, { transform: 'translateY(31px)' }],
    { duration: dur, fill: 'forwards' });
  wheelAngle = target;
  await new Promise(r => setTimeout(r, dur + 200));
  sfx.play('ball', 0.6);

  const back = GM.roulettePay(bets, n);
  G.S.chips += back;
  hist = [n, ...hist].slice(0, 14);
  $('#rl-hist').innerHTML = hist.map(x => `<span class="rl-h is-${GM.colorOf(x)}">${x}</span>`).join('');
  const res = $('#rl-result');
  res.className = `rl-result is-${GM.colorOf(n)}`; res.textContent = n;
  res.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: ms(500), easing: 'cubic-bezier(.34,1.56,.64,1)' });
  document.querySelectorAll('[data-rbet]').forEach(c => { if (GM.rouletteWins(c.dataset.rbet, n) > 0) c.classList.add('is-hit'); });
  note(`roleta: deu ${n}, apostou ${int(total)}, voltaram ${int(back)} fichas`);
  award('roulette');
  if (back > total) { award('rouletteWin'); sfx.play('stack', 0.7); confetti(back >= total * 5 ? 90 : 35); say(`Deu ${n}. Você ganhou ${int(back - total)} fichas.`); }
  else say(`Deu ${n}. ${back ? `Voltaram ${int(back)} fichas.` : 'A casa levou desta vez.'}`, !back);
  if (Object.keys(bets).some(k => k === `n:${n}`)) award('straight');
  spinning = false;
  // mantém as mesmas apostas para repetir com um clique, se houver fichas
  if (Object.values(bets).reduce((a, b) => a + b, 0) > G.S.chips) bets = {};
  renderBets(); save(); G.render();
}
