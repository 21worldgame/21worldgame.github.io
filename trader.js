// Mesa de operações: velas ao vivo, compra/venda com alavancagem, liquidação automática. Usa o dinheiro (R$).
import * as GM from './games.js';
import { G, $, esc, brl, int, say, save, award, note, confetti } from './store.js';
import * as sfx from './sfx.js';

const TICK = 400, PER = 5;                 // um tick a cada 0,4 s; vela fecha a cada 5 ticks
const feeds = {}, candles = {};
let cur = 'boi', lev = 5, hover = null, timer = 0;
const fmt = (a, v) => (a === 'dol' ? v.toFixed(4) : a === 'btc' ? int(v) : v.toFixed(2));

export function initTrader() {
  G.S.trades ??= []; G.S.trHist ??= []; G.S.trPx ??= {};
  for (const a of Object.keys(GM.ASSETS)) {
    feeds[a] = GM.newFeed(a);
    if (G.S.trPx[a]) feeds[a].price = G.S.trPx[a];
    // histórico inicial para o gráfico nascer cheio
    candles[a] = [];
    for (let i = 0; i < 90 * PER; i++) step(a, true);
  }
  $('#tr-assets').innerHTML = Object.entries(GM.ASSETS).map(([k, a]) => `<button class="tr-asset" data-act="tr-asset" data-id="${k}"><strong>${a.ticker}</strong><span id="tr-q-${k}"></span></button>`).join('');
  pickAsset(cur);
  const cv = $('#tr-canvas');
  cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); hover = { x: e.clientX - r.left, y: e.clientY - r.top }; draw(); });
  cv.addEventListener('mouseleave', () => { hover = null; draw(); });
  clearInterval(timer);
  timer = setInterval(() => { for (const a of Object.keys(feeds)) step(a); checkLiq(); render(); }, TICK);
}

function step(a, silent) {
  const p = GM.tickFeed(feeds[a]), list = candles[a];
  let c = list.at(-1);
  if (!c || c.n >= PER) { c = { o: c ? c.c : p, h: p, l: p, c: p, v: 0, n: 0 }; list.push(c); if (list.length > 160) list.shift(); }
  c.h = Math.max(c.h, p); c.l = Math.min(c.l, p); c.c = p; c.n++; c.v += 50 + Math.random() * 200 * (Math.abs(p - c.o) / p * 400 + 0.3);
  if (!silent) G.S.trPx[a] = p;
}

export function pickAsset(a) {
  cur = a;
  document.querySelectorAll('.tr-asset').forEach(b => b.classList.toggle('is-on', b.dataset.id === a));
  render();
}
export function pickLev(v) { lev = Number(v); document.querySelectorAll('[data-lev]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.lev) === lev)); render(); }

export function open(side) {
  const margin = Math.floor(Number($('[name="tr-amt"]').value) || 0);
  if (margin < 100) return say('O valor mínimo da operação é R$ 100.', true);
  const fee = margin * lev * GM.TRADE_FEE;
  if (margin + fee > G.S.money) return say('Dinheiro insuficiente para essa operação.', true);
  G.S.money -= margin + fee;
  const pos = { id: G.S.nextId++, asset: cur, side, lev, margin, entry: feeds[cur].price, at: Date.now() };
  G.S.trades.push(pos);
  note(`trader: ${side > 0 ? 'comprou' : 'vendeu'} ${GM.ASSETS[cur].ticker} ${lev}x, margem ${brl(margin)}`, -(margin + fee));
  sfx.play('chip', 0.5);
  say(`${side > 0 ? 'Compra' : 'Venda'} aberta em ${fmt(cur, pos.entry)}.`);
  save(); G.render(); render();
}

export function close(id, why = '') {
  const pos = G.S.trades.find(p => String(p.id) === String(id)); if (!pos) return;
  const pl = GM.pnl(pos, feeds[pos.asset].price), back = Math.max(0, pos.margin + pl);
  G.S.trades.splice(G.S.trades.indexOf(pos), 1);
  G.S.money += back;
  G.S.trHist = [{ ticker: GM.ASSETS[pos.asset].ticker, side: pos.side, lev: pos.lev, pl: Math.round(pl), why }, ...G.S.trHist].slice(0, 12);
  note(`trader: fechou ${GM.ASSETS[pos.asset].ticker} ${why || ''} ${pl >= 0 ? 'lucro' : 'prejuízo'} ${brl(Math.abs(pl))}`, back);
  award('trade');
  if (pl > 0) { award('tradeWin'); sfx.play('stack', 0.6); if (pl >= pos.margin) confetti(50); }
  say(why === 'liquidada' ? `Posição liquidada em ${GM.ASSETS[pos.asset].ticker}. Perdeu a margem.` : `Operação fechada: ${pl >= 0 ? '+' : '−'}${brl(Math.abs(pl))}.`, pl < 0);
  save(); G.render(); render();
}

function checkLiq() {
  for (const p of [...G.S.trades]) {
    const px = feeds[p.asset].price;
    if ((p.side > 0 && px <= GM.liqPrice(p)) || (p.side < 0 && px >= GM.liqPrice(p))) close(p.id, 'liquidada');
  }
}

function render() {
  if ($('#p-trader').hidden) return;
  for (const a of Object.keys(feeds)) {
    const list = candles[a], first = list[Math.max(0, list.length - 60)].o, ch = (feeds[a].price / first - 1) * 100;
    const q = $(`#tr-q-${a}`); if (q) { q.textContent = `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`; q.className = ch >= 0 ? 'good' : 'bad'; }
  }
  const A = GM.ASSETS[cur], px = feeds[cur].price, list = candles[cur], first = list[Math.max(0, list.length - 60)].o, ch = (px / first - 1) * 100;
  const vis = list.slice(-60);
  $('#tr-name').textContent = `${A.name} (${A.ticker})`;
  $('#tr-price').textContent = fmt(cur, px);
  $('#tr-price').className = `tr-price ${list.at(-1).c >= list.at(-1).o ? 'good' : 'bad'}`;
  $('#tr-ch').textContent = `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%`;
  $('#tr-ch').className = ch >= 0 ? 'good' : 'bad';
  $('#tr-hl').textContent = `máx ${fmt(cur, Math.max(...vis.map(c => c.h)))}  mín ${fmt(cur, Math.min(...vis.map(c => c.l)))}  ${A.unit}`;
  const amt = Math.floor(Number($('[name="tr-amt"]').value) || 0);
  $('#tr-size').textContent = `exposição ${brl(amt * lev)}, taxa ${brl(amt * lev * GM.TRADE_FEE)}`;
  $('#tr-pos').innerHTML = G.S.trades.length ? G.S.trades.map(p => {
    const pl = GM.pnl(p, feeds[p.asset].price), pct = (pl / p.margin) * 100;
    return `<li class="tr-p"><div><strong class="${p.side > 0 ? 'good' : 'bad'}">${p.side > 0 ? 'compra' : 'venda'} ${GM.ASSETS[p.asset].ticker} ${p.lev}x</strong>
      <span class="muted small">entrada ${fmt(p.asset, p.entry)}, liquida em ${fmt(p.asset, GM.liqPrice(p))}</span></div>
      <div class="tr-pl ${pl >= 0 ? 'good' : 'bad'}">${pl >= 0 ? '+' : '−'}${brl(Math.abs(pl))}<small>${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</small></div>
      <button class="btn btn--glass btn--sm" data-act="tr-close" data-id="${p.id}">fechar</button></li>`;
  }).join('') : '<li class="muted small">Nenhuma posição aberta.</li>';
  $('#tr-hist').innerHTML = G.S.trHist.length ? G.S.trHist.map(h => `<li><span>${h.side > 0 ? 'compra' : 'venda'} ${h.ticker} ${h.lev}x${h.why ? `, ${h.why}` : ''}</span><span class="${h.pl >= 0 ? 'good' : 'bad'}">${h.pl >= 0 ? '+' : '−'}${brl(Math.abs(h.pl))}</span></li>`).join('') : '<li class="muted small">Sem operações fechadas.</li>';
  draw();
}

function draw() {
  const cv = $('#tr-canvas'); if (!cv || !cv.offsetWidth) return;
  const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const css = n => getComputedStyle(cv).getPropertyValue(n).trim();
  const up = css('--tr-up'), down = css('--tr-down'), grid = css('--tr-grid'), text = css('--tr-text');
  const vis = candles[cur].slice(-60), axisW = 78, volH = H * 0.16, chartH = H - volH - 24;
  let hi = Math.max(...vis.map(c => c.h)), lo = Math.min(...vis.map(c => c.l));
  const posL = G.S.trades.filter(p => p.asset === cur);
  for (const p of posL) { hi = Math.max(hi, p.entry); lo = Math.min(lo, p.entry); }
  const padV = (hi - lo) * 0.08 || hi * 0.001; hi += padV; lo -= padV;
  const y = v => 10 + ((hi - v) / (hi - lo)) * (chartH - 10), cw = (W - axisW) / vis.length;
  g.font = `600 11px ${css('--font-body')}`; g.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const v = lo + ((hi - lo) * i) / 5, yy = y(v);
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(0, yy); g.lineTo(W - axisW, yy); g.stroke();
    g.fillStyle = text; g.fillText(fmt(cur, v), W - axisW + 8, yy);
  }
  const maxV = Math.max(...vis.map(c => c.v));
  // média móvel de 20
  const all = candles[cur], off = all.length - vis.length;
  g.strokeStyle = css('--tr-ma'); g.lineWidth = 1.6; g.beginPath();
  vis.forEach((c, i) => {
    const s = all.slice(Math.max(0, off + i - 19), off + i + 1), ma = s.reduce((a, x) => a + x.c, 0) / s.length;
    const xx = i * cw + cw / 2; i ? g.lineTo(xx, y(ma)) : g.moveTo(xx, y(ma));
  });
  g.stroke();
  vis.forEach((c, i) => {
    const xx = i * cw + cw / 2, col = c.c >= c.o ? up : down;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(xx, y(c.h)); g.lineTo(xx, y(c.l)); g.stroke();
    const top = y(Math.max(c.o, c.c)), bh = Math.max(1, Math.abs(y(c.o) - y(c.c)));
    g.fillRect(xx - cw * 0.34, top, cw * 0.68, bh);
    g.globalAlpha = 0.35; g.fillRect(xx - cw * 0.34, H - 20 - (c.v / maxV) * volH, cw * 0.68, (c.v / maxV) * volH); g.globalAlpha = 1;
  });
  const hline = (v, col, label, dash = [5, 4]) => {
    const yy = y(v); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, yy); g.lineTo(W - axisW, yy); g.stroke(); g.setLineDash([]);
    g.fillStyle = col; g.fillRect(W - axisW, yy - 10, axisW, 20); g.fillStyle = css('--shade'); g.fillText(label, W - axisW + 6, yy);
  };
  for (const p of posL) {
    const pl = GM.pnl(p, feeds[cur].price);
    hline(p.entry, pl >= 0 ? up : down, `${p.side > 0 ? 'C' : 'V'} ${fmt(cur, p.entry)}`, [2, 3]);
    const lq = GM.liqPrice(p); if (lq > lo && lq < hi) hline(lq, css('--tr-liq'), `liq ${fmt(cur, lq)}`, [8, 4]);
  }
  const last = vis.at(-1);
  hline(feeds[cur].price, last.c >= last.o ? up : down, fmt(cur, feeds[cur].price));
  if (hover && hover.x < W - axisW) {
    const i = Math.min(vis.length - 1, Math.max(0, Math.floor(hover.x / cw))), c = vis[i];
    g.strokeStyle = text; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(i * cw + cw / 2, 0); g.lineTo(i * cw + cw / 2, H - 20); g.moveTo(0, hover.y); g.lineTo(W - axisW, hover.y); g.stroke(); g.setLineDash([]);
    g.fillStyle = css('--tr-tip'); g.fillRect(8, 8, 300, 22); g.fillStyle = text;
    g.fillText(`A ${fmt(cur, c.o)}  M ${fmt(cur, c.h)}  m ${fmt(cur, c.l)}  F ${fmt(cur, c.c)}`, 14, 19);
  }
}

export const tick = () => render();
