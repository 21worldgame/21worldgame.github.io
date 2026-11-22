// Aviator: o multiplicador sobe até o avião "voar". Saque antes disso.
import { botsFor } from './botpool.js';
import * as GM from './games.js';
import * as C from './casino.js';
import { G, $, esc, int, say, save, award, note, confetti, RM } from './store.js';
import * as sfx from './sfx.js';
import { luck } from './perks.js';

const BOT_NAMES = botsFor('av');
let st = { phase: 'wait', until: 0, crash: 1, t0: 0, mult: 1 }, mine = null, next = null, bots = [], hist = [], raf = 0, active = false;
const PLANE = new Path2D('M2 12 L22 6 L30 0 L34 2 L28 10 L44 8 L48 4 L52 6 L48 14 L28 18 L22 26 L18 25 L20 17 L6 16 Z');

export function setActive(on) {
  active = on;
  if (on && !raf) { if (st.phase === 'wait' && !st.until) newRound(); loop(); }
}

function newRound() {
  st = { phase: 'wait', until: performance.now() + 6000, crash: GM.crashPoint(), t0: 0, mult: 1 };
  mine = next ? { ...next, done: false, won: 0 } : null;
  if (next) next = null;
  const pick = [...BOT_NAMES].sort(() => Math.random() - 0.5);   // cada nome uma vez só na rodada
  bots = Array.from({ length: Math.min(BOT_NAMES.length, 6 + Math.floor(Math.random() * 7)) }, (_, i) => ({
    name: pick[i], bet: [10, 20, 50, 100, 200, 500][Math.floor(Math.random() * 6)],
    target: Math.max(1.1, Math.round((1 / (1 - Math.random() * 0.93)) * 100) / 100), out: 0,
  }));
  renderPlayers(); renderBtn();
}

function loop() {
  raf = requestAnimationFrame(loop);
  const now = performance.now();
  if (st.phase === 'wait' && now >= st.until) { st.phase = 'fly'; st.t0 = now; sfx.play('chips', 0.3); }
  if (st.phase === 'fly') {
    const sec = (now - st.t0) / 1000;
    st.mult = Math.min(GM.multAt(sec), st.crash);
    sfx.engine(active, st.mult);
    if (mine && !mine.done && mine.auto && st.mult >= mine.auto && mine.auto <= st.crash) cashout(mine.auto);
    for (const b of bots) if (!b.out && st.mult >= b.target && b.target <= st.crash) { b.out = b.target; renderPlayers(); }
    if (st.mult >= st.crash) crash(now);
  }
  if (st.phase === 'crash' && now >= st.until) {
    if (!active) { cancelAnimationFrame(raf); raf = 0; st.until = 0; return; }
    newRound();
  }
  draw(now); renderBtn();
}

function crash(now) {
  st.phase = 'crash'; st.until = now + 3200; st.mult = st.crash;
  sfx.engine(false); sfx.play('ball', 0.5);
  hist = [st.crash, ...hist].slice(0, 18);
  $('#av-hist').innerHTML = hist.map(x => `<span class="av-pill ${x >= 10 ? 'is-hi' : x >= 2 ? 'is-mid' : ''}">${x.toFixed(2)}x</span>`).join('');
  if (mine && !mine.done) {
    mine.done = true;
    note(`aviator: perdeu ${int(mine.bet)} fichas (voou em ${st.crash.toFixed(2)}x)`);
    award('aviator'); save(); G.render();
  }
  renderPlayers();
}

function cashout(at = st.mult) {
  if (!mine || mine.done || st.phase !== 'fly') return;
  mine.done = true; mine.won = Math.floor(mine.bet * at); mine.at = at;
  G.S.chips += mine.won + luck(G.S, mine.won - mine.bet);
  note(`aviator: sacou ${at.toFixed(2)}x, +${int(mine.won)} fichas`);
  sfx.play('stack', 0.6);
  award('aviator'); award('cashout');
  if (at >= 10) award('cashout10');
  if (at >= 3) confetti(at >= 10 ? 90 : 40);
  say(`Sacou em ${at.toFixed(2)}x: +${int(mine.won)} fichas.`);
  save(); G.render(); renderPlayers();
}

export function press() {
  if (mine && !mine.done && st.phase === 'fly') return cashout();
  const bet = Math.floor(Number($('[name="av-bet"]').value) || 0), auto = Number($('[name="av-auto"]').value) || 0;
  if (next) { G.S.chips += next.bet; next = null; save(); G.render(); return renderBtn(); }   // cancela a aposta da próxima rodada
  if (bet < 10) return say('A aposta mínima é 10 fichas.', true);
  if (bet > G.S.chips) return say('Fichas insuficientes. Compre no caixa do cassino.', true);
  G.S.chips -= bet; save(); G.render(); sfx.play('chip', 0.5);
  const b = { bet, auto: auto >= 1.01 ? auto : 0, done: false, won: 0 };
  if (st.phase === 'wait') mine = b; else next = b;
  renderBtn(); renderPlayers();
}
export function quick(n) { const i = $('[name="av-bet"]'), v = Number(i.value) || 0; i.value = Math.max(10, n === 'x2' ? v * 2 : v + n); }

function renderBtn() {
  const btn = $('#av-btn'); if (!btn) return;
  let txt, cls = 'btn--gold';
  if (mine && !mine.done && st.phase === 'fly') { txt = `sacar ${int(mine.bet * st.mult)}`; cls = 'btn--cash'; }
  else if (mine && !mine.done) txt = 'aposta feita, aguarde a decolagem';
  else if (next) { txt = 'cancelar aposta da próxima rodada'; cls = 'btn--glass'; }
  else txt = st.phase === 'wait' ? 'apostar' : 'apostar na próxima rodada';
  if (btn.textContent !== txt) btn.textContent = txt;
  btn.className = `btn btn--lg av-btn ${cls}`;
  btn.disabled = !!(mine && !mine.done && st.phase === 'wait');
}

function renderPlayers() {
  C.setPlay({ bet: mine?.bet || 0, out: mine?.at || 0 });
  const real = C.playersIn('aviator').map(p => ({ name: p.name, bet: p.bet, out: p.out, real: true }));
  const rows = [...(mine ? [{ name: G.S.avatar.name && G.S.avatar.name !== 'você' ? `${G.S.avatar.name} (você)` : 'você', bet: mine.bet, out: mine.at || 0, me: true }] : []), ...real, ...bots];
  $('#av-players').innerHTML = rows.map(r => {
    const lost = st.phase === 'crash' && !r.out;
    return `<li class="${r.out ? 'is-out' : ''} ${lost ? 'is-lost' : ''} ${r.me ? 'is-me' : ''}"><span>${esc(r.name)}</span><span>${r.bet ? int(r.bet) : '—'}</span>
      <span>${r.out ? `${r.out.toFixed(2)}x` : '—'}</span><span>${r.out ? `+${int(r.bet * r.out)}` : lost ? 'voou' : ''}</span></li>`;
  }).join('');
  $('#av-count').textContent = `${rows.length} na rodada`;
}

function draw(now) {
  const cv = $('#av-canvas'); if (!cv || !cv.offsetWidth) return;
  const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const css = n => getComputedStyle(cv).getPropertyValue(n).trim();
  const pad = 40, x0 = pad, y0 = H - pad;
  // raios de fundo girando, como no jogo original
  g.save(); g.translate(x0, y0); g.rotate((now / 9000) % (Math.PI * 2));
  for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? css('--av-ray') : 'transparent'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Math.hypot(W, H), 0, Math.PI / 12); g.fill(); }
  g.restore();
  g.strokeStyle = css('--av-grid'); g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x0, y0 - (i * (y0 - 20)) / 6); g.lineTo(W, y0 - (i * (y0 - 20)) / 6); g.stroke(); }
  const msg = $('#av-msg'), mult = $('#av-mult');
  if (st.phase === 'wait') {
    const left = Math.max(0, (st.until - now) / 1000);
    mult.textContent = ''; msg.innerHTML = `<small>próximo voo em</small><strong>${left.toFixed(1)}s</strong><span class="av-bar"><i style="transform:scaleX(${left / 6})"></i></span>`;
    msg.hidden = false; drawPlane(g, x0 + 8, y0 - 16, 0, css); return;
  }
  msg.hidden = st.phase !== 'crash';
  if (st.phase === 'crash') msg.innerHTML = '<strong class="av-gone">voou!</strong>';
  mult.textContent = `${st.mult.toFixed(2)}x`;
  mult.classList.toggle('is-crash', st.phase === 'crash');
  // curva até o multiplicador atual, escala que acompanha
  const sec = st.phase === 'fly' ? (now - st.t0) / 1000 : GM.timeTo(st.crash);
  const maxT = Math.max(8, sec * 1.15), maxM = Math.max(2, st.mult * 1.2);
  const px = t => x0 + (t / maxT) * (W - x0 - 60), py = m => y0 - ((m - 1) / (maxM - 1)) * (y0 - 40);
  g.beginPath(); g.moveTo(x0, y0);
  const smooth = t => Math.min(Math.exp(GM.CRASH_K * t), st.mult);   // curva contínua (o multAt arredonda e faria degraus)
  for (let t = 0; t <= sec; t += sec / 80 || 1) g.lineTo(px(t), py(smooth(t)));
  const ex = px(sec), ey = py(st.mult);
  g.lineTo(ex, ey);
  g.strokeStyle = css('--av-line'); g.lineWidth = 4; g.stroke();
  g.lineTo(ex, y0); g.closePath();
  const grad = g.createLinearGradient(0, ey, 0, y0); grad.addColorStop(0, css('--av-fill')); grad.addColorStop(1, 'transparent');
  g.fillStyle = grad; g.fill();
  if (st.phase === 'crash') {
    const k = 1 - Math.max(0, (st.until - now) / 3200);
    drawPlane(g, ex + k * W * 0.8, ey - k * H * 0.8, -0.6, css);
  } else {
    const t2 = Math.max(0, sec - 0.3);
    drawPlane(g, ex, ey, Math.atan2(ey - py(smooth(t2)), ex - px(t2) || 1), css);
  }
}
function drawPlane(g, x, y, ang, css) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(1.7, 1.7); g.translate(-26, -16);
  g.fillStyle = css('--av-plane'); g.strokeStyle = css('--shade'); g.lineWidth = 1.5; g.fill(PLANE); g.stroke(PLANE);
  g.restore();
}
setInterval(() => { if (active) renderPlayers(); }, 4000);   // jogadores de verdade entrando/saindo do aviator
