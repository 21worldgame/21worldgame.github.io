// Roleta europeia (um zero): roda animada, bola e mesa de apostas.
import * as GM from './games.js';
import * as C from './casino.js';
import { botsFor } from './botpool.js';
import { avatarSVG, NPC_LOOKS } from './avatar.js';
import * as NPC from './npcs.js';
import { G, $, int, say, save, award, note, confetti, ms, RM } from './store.js';
import * as sfx from './sfx.js';

let bets = {}, chip = 25, spinning = false, wheelAngle = 0, hist = [];
const SEG = 360 / 37;

export function initRoulette() {
  // roda em SVG: setores na ordem real da roleta europeia
  const R = 132, r0 = 90;
  const pt = (a, rad) => [160 + rad * Math.sin((a * Math.PI) / 180), 160 - rad * Math.cos((a * Math.PI) / 180)];
  const sectors = GM.WHEEL.map((n, i) => {
    const a1 = i * SEG - SEG / 2, a2 = a1 + SEG, [x1, y1] = pt(a1, R), [x2, y2] = pt(a2, R), [x3, y3] = pt(a2, r0), [x4, y4] = pt(a1, r0), [tx, ty] = pt(i * SEG, 106);
    return `<path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r0} ${r0} 0 0 0 ${x4} ${y4} Z" class="rl-sec rl-sec--${GM.colorOf(n)}"/>
      <text x="${tx}" y="${ty}" transform="rotate(${i * SEG} ${tx} ${ty})" class="rl-num">${n}</text>`;
  }).join('');
  const frets = GM.WHEEL.map((_, i) => { const [x1, y1] = pt(i * SEG - SEG / 2, r0), [x2, y2] = pt(i * SEG - SEG / 2, R); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="rl-fret"/>`; }).join('');
  const grad = (id, a, b) => `<radialGradient id="rl-g-${id}" gradientUnits="userSpaceOnUse" cx="160" cy="160" r="${R}"><stop offset=".66" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  $('#rl-wheel').innerHTML = `<svg viewBox="0 0 320 320" aria-label="roleta"><defs>
      <radialGradient id="rl-wood" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#4a250f"/><stop offset=".92" stop-color="#7a4421"/><stop offset="1" stop-color="#2a1408"/></radialGradient>
      <radialGradient id="rl-track" gradientUnits="userSpaceOnUse" cx="160" cy="160" r="158"><stop offset=".82" stop-color="#1a0f08"/><stop offset=".9" stop-color="#5b3a1e"/><stop offset=".97" stop-color="#2b1809"/></radialGradient>
      <linearGradient id="rl-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".45" stop-color="#e2a21b"/><stop offset="1" stop-color="#7a5208"/></linearGradient>
      <radialGradient id="rl-hub" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#d49a1c"/><stop offset="1" stop-color="#5c3d05"/></radialGradient>
      <radialGradient id="rl-cone2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3a2a14"/><stop offset=".7" stop-color="#1b1208"/><stop offset="1" stop-color="#0a0704"/></radialGradient>
      <linearGradient id="rl-shine" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
      ${grad('red', '#6e0716', '#e0243f')}${grad('black', '#030304', '#2a2a33')}${grad('green', '#03502a', '#19ad5c')}
    </defs>
    <circle cx="160" cy="160" r="158" fill="url(#rl-wood)"/><circle cx="160" cy="160" r="152" fill="url(#rl-track)" stroke="url(#rl-brass)" stroke-width="3"/>
    <circle cx="160" cy="160" r="133" fill="none" stroke="url(#rl-brass)" stroke-width="2.4"/>
    <g id="rl-rot">${sectors}${frets}<circle cx="160" cy="160" r="${r0}" class="rl-pockets"/><circle cx="160" cy="160" r="72" fill="url(#rl-cone2)" stroke="url(#rl-brass)" stroke-width="2"/>
      <g class="rl-turret">${[0, 90, 180, 270].map(a => `<g transform="rotate(${a} 160 160)"><rect x="157" y="108" width="6" height="40" rx="3"/><circle cx="160" cy="106" r="5.5"/></g>`).join('')}<circle cx="160" cy="160" r="13"/></g></g>
    <path d="M60 60 A140 140 0 0 1 250 38 A130 130 0 0 0 78 98 Z" fill="url(#rl-shine)" pointer-events="none"/></svg>
    <i class="rl-blur" id="rl-blur" aria-hidden="true"></i><i class="rl-glow" aria-hidden="true"></i>
    <div class="rl-ballarm" id="rl-arm"><i class="rl-trail" id="rl-trail"></i><i class="rl-ball" id="rl-ball"></i></div>
    <span class="rl-centernum" id="rl-centernum" aria-hidden="true"></span><span class="rl-pointer" aria-hidden="true"></span>`;

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
// crupiê: as falas de cada fase, como no cassino
function call(t) { const el = document.querySelector('#rl-call'); if (el) { el.textContent = t; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); } }
// dobra todas as apostas que estão na mesa
export function doubleBets() {
  if (spinning) return;
  const total = Object.values(bets).reduce((a, b) => a + b, 0);
  if (!total) return say('Não há apostas na mesa para dobrar.', true);
  if (total * 2 > G.S.chips) return say('Fichas insuficientes para dobrar.', true);
  for (const k of Object.keys(bets)) bets[k] *= 2;
  sfx.play('stack', 0.5); renderBets();
}

function renderBets() {
  document.querySelectorAll('[data-rbet]').forEach(c => {
    const v = bets[c.dataset.rbet], st = c.querySelector('.rl-stack');
    st.textContent = v ? int(v) : ''; st.classList.toggle('is-on', !!v);
  });
  $('#rl-total').textContent = int(Object.values(bets).reduce((a, b) => a + b, 0));
  C.setPlay({ bet: Object.values(bets).reduce((a, b) => a + b, 0) });
  $('[data-act="rl-spin"]').disabled = spinning || !Object.keys(bets).length;
}

const GLOW = { red: '255,60,90', black: '210,220,255', green: '60,255,140' };
// chegada da bola: pancada na roda, anel de luz na casa vencedora e o número aparecendo no centro
function landFx(n) {
  const box = $('#rl-wheel'), col = GM.colorOf(n), rgb = GLOW[col];
  const mid = $('#rl-centernum');
  mid.textContent = n; mid.className = `rl-centernum is-${col} is-on`;
  if (RM.matches) return;
  box.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025) rotate(-.4deg)', offset: 0.25 }, { transform: 'scale(.995) rotate(.3deg)', offset: 0.55 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
  mid.animate([{ transform: 'translate(-50%, -50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'both' });
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('i');
    ring.className = 'rl-land'; ring.style.cssText = `--rgb:${rgb}`;
    box.append(ring);
    ring.animate([{ transform: 'translate(-50%, -50%) scale(.3)', opacity: 0.95 }, { transform: 'translate(-50%, -50%) scale(4.5)', opacity: 0 }], { duration: 1100, delay: i * 220, easing: 'ease-out', fill: 'backwards' }).finished.then(() => ring.remove());
  }
  for (let i = 0; i < 14; i++) {                       // faíscas saindo da casa
    const sp = document.createElement('i'); sp.className = 'rl-spark'; sp.style.cssText = `--rgb:${rgb}`; box.append(sp);
    const a = (Math.random() - 0.5) * Math.PI * 1.6 - Math.PI / 2, d = 40 + Math.random() * 70;
    sp.animate([{ transform: 'translate(-50%, -50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px))`, opacity: 0 }], { duration: 600 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => sp.remove());
  }
}

// na mesa: você, os jogadores de verdade na roleta agora e os jogadores da casa (apostas mudam a cada giro)
let botBets = [];
const rollBots = () => { botBets = botsFor('rl').slice(0, 5 + Math.floor(Math.random() * 4)).map(name => ({ name, bet: [25, 50, 100, 250, 500, 1000][Math.floor(Math.random() * 6)] })); };
export function renderWho() {
  const el = document.querySelector('#rl-who'); if (!el) return;
  if (!botBets.length) rollBots();
  const mine = Object.values(bets).reduce((a, b) => a + b, 0), real = C.playersIn('roleta');
  const row = (name, look, bet, cls) => `<li class="${cls}"><span class="who-av">${avatarSVG(look || {}, { label: name })}</span><b>${name}</b><span class="muted small">${bet ? `${int(bet)} fichas` : 'olhando'}</span></li>`;
  const esc = s => String(s).replace(/[<>&"]/g, '');
  el.innerHTML = row(`${esc(G.S.avatar?.name || 'você')} (você)`, G.S.avatar, mine, 'is-me')
    + real.map(p => row(esc(p.name), p.look, p.bet, 'is-real')).join('')
    + botBets.map(b => row(esc(b.name), NPC.byNick(b.name)?.look || NPC_LOOKS.Dorival, b.bet, '')).join('');
  const n = document.querySelector('#rl-who-n'); if (n) n.textContent = `${real.length + 1} de verdade · ${botBets.length} da casa`;
}
setInterval(renderWho, 4000);
export async function spin() {
  const total = Object.values(bets).reduce((a, b) => a + b, 0);
  if (spinning || !total) return;
  if (total > G.S.chips) return say('Fichas insuficientes.', true);
  spinning = true; renderBets(); rollBots(); renderWho();
  G.S.chips -= total; save(); G.render();
  document.querySelectorAll('.rl-cell.is-hit').forEach(c => c.classList.remove('is-hit'));
  document.querySelectorAll('.rl-dolly').forEach(d => d.remove());
  call('Não vale mais apostar.');
  $('#rl-centernum').className = 'rl-centernum';
  const n = GM.WHEEL[Math.floor(Math.random() * 37)], idx = GM.WHEEL.indexOf(n);
  // a roda gira no sentido horário e para com o número do resultado embaixo do ponteiro
  const target = wheelAngle + 360 * 5 + ((360 - idx * SEG - (wheelAngle % 360)) % 360 + 360) % 360;
  const dur = RM.matches ? 0 : 8500;
  const box = $('#rl-wheel');
  box.classList.add('is-spinning');
  sfx.play('ball', 0.3);
  // roda: gira no sentido horário, desacelera de verdade e fica nítida só no fim (borrão de movimento)
  $('#rl-rot').animate([{ transform: `rotate(${wheelAngle}deg)`, filter: 'blur(3px)' }, { filter: 'blur(2px)', offset: 0.3 }, { filter: 'blur(0)', offset: 0.78 }, { transform: `rotate(${target}deg)`, filter: 'blur(0)' }],
    { duration: dur, easing: 'cubic-bezier(.12,.7,.18,1)', fill: 'forwards' });
  $('#rl-blur').animate([{ opacity: 0.9 }, { opacity: 0.55, offset: 0.35 }, { opacity: 0 }], { duration: dur, easing: 'ease-out', fill: 'forwards' });
  box.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)', offset: 0.12 }, { transform: 'scale(1.035)', offset: 0.78 }, { transform: 'scale(1)' }], { duration: dur, easing: 'ease-in-out' });
  // bola: corre ao contrário na pista (com rastro), perde velocidade, cai nos defletores, quica e assenta na casa (topo)
  $('#rl-arm').animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2880deg)' }], { duration: dur, easing: 'cubic-bezier(.08,.55,.2,1)', fill: 'forwards' });
  $('#rl-trail').animate([{ opacity: 1 }, { opacity: 0.8, offset: 0.55 }, { opacity: 0, offset: 0.7 }, { opacity: 0 }], { duration: dur, fill: 'forwards' });
  const hop = (y, x, o, e = 'ease-out') => ({ transform: `translate(${x}%, ${y}%)`, offset: o, easing: e });
  $('#rl-ball').animate([
    { transform: 'translate(0, 0)' }, hop(0, 0, 0.6), hop(70, 0, 0.66, 'ease-in'), hop(25, 90, 0.7), hop(120, 160, 0.75, 'ease-in'), hop(70, -60, 0.8),
    hop(165, -90, 0.85, 'ease-in'), hop(130, -30, 0.89), hop(185, 20, 0.93, 'ease-in'), hop(168, 0, 0.96), { transform: 'translate(0, 182%)', offset: 1 }],
    { duration: dur, fill: 'forwards' });
  // tique-taque da bola passando pelas casas (espaçado cada vez mais) e as batidas nos defletores
  const timers = [];
  for (let k = 0; k < 30; k++) timers.push(setTimeout(() => sfx.play('chip', 0.12), dur * 0.58 * (1 - (1 - k / 30) ** 2.2)));
  for (const o of [0.66, 0.75, 0.85, 0.93]) timers.push(setTimeout(() => sfx.play('ball', 0.35), dur * o));
  wheelAngle = target;
  await new Promise(r => setTimeout(r, dur + 200));
  timers.forEach(clearTimeout);
  box.classList.remove('is-spinning');
  sfx.play('stack', 0.5);
  landFx(n);

  const back = GM.roulettePay(bets, n);
  G.S.chips += back;
  hist = [n, ...hist].slice(0, 14);
  $('#rl-hist').innerHTML = hist.map(x => `<span class="rl-h is-${GM.colorOf(x)}">${x}</span>`).join('');
  const res = $('#rl-result');
  res.className = `rl-result is-${GM.colorOf(n)}`; res.textContent = n;
  res.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: ms(500), easing: 'cubic-bezier(.34,1.56,.64,1)' });
  document.querySelectorAll('[data-rbet]').forEach(c => { if (GM.rouletteWins(c.dataset.rbet, n) > 0) c.classList.add('is-hit'); });
  document.querySelector(`[data-rbet="n:${n}"]`)?.insertAdjacentHTML('beforeend', '<i class="rl-dolly" aria-hidden="true"></i>');
  call(`${n}, ${GM.colorOf(n) === 'red' ? 'vermelho' : GM.colorOf(n) === 'black' ? 'preto' : 'verde'}${n ? `, ${n % 2 ? 'ímpar' : 'par'}` : ''}. Façam suas apostas.`);
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
