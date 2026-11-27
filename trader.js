// Mesa de operações: velas ao vivo (1, 5 ou 10 min), aposta por tempo em "sobe" ou "desce".
// O valor sai na hora e só volta se acertar (1,7x em 1 min, 1,8x em 5, 1,88x em 10). Preços vêm de market.js: iguais para todos e sem perder nada ao recarregar.
import * as MK from './market.js';
import * as Live from './live.js';
import { G, $, esc, brl, int, say, save, award, note, confetti } from './store.js';
import * as sfx from './sfx.js';
import * as MESA from './mesa.js';   // "BTC real": preço da Coinbase, operação no servidor, ranking e copy

let cur = MESA.REAL, tf = 1, dur = 1, hover = null, timer = 0;
const now = () => Live.now();
const fmtLeft = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function initTrader() {
  G.S.trades ??= []; G.S.trHist ??= [];
  $('#tr-assets').innerHTML = `<button class="tr-asset tr-asset--real" data-act="tr-asset" data-id="${MESA.REAL}"><strong>BTC real</strong><span id="tr-q-${MESA.REAL}"></span><small>ao vivo · copy</small></button>` + Object.entries(MK.ASSETS).filter(([k]) => !MK.NO_OPEN.has(k)).map(([k, a]) => `<button class="tr-asset" data-act="tr-asset" data-id="${k}"><strong>${a.ticker}</strong><span id="tr-q-${k}"></span></button>`).join('');
  pickAsset(cur); pickDur(dur);
  const cv = $('#tr-canvas');
  cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); hover = { x: e.clientX - r.left, y: e.clientY - r.top }; draw(); });
  cv.addEventListener('mouseleave', () => { hover = null; draw(); });
  buildTicker();
  clearInterval(timer);
  timer = setInterval(() => { settleNow(); render(); updateTicker(); }, 1000);
  settleNow();
}

// fecha as operações vencidas (mesmo com a aba fechada)
function settleNow() {
  const done = MK.settle(G.S, now());
  if (!done.length) return;
  for (const r of done) {
    if (r.old) { note('trader: operação antiga com alavancagem encerrada, margem devolvida', r.back); continue; }
    const tk = MK.ASSETS[r.asset].ticker;
    note(`trader: ${r.side > 0 ? 'sobe' : 'desce'} ${tk} ${r.minutes} min, ${r.win ? 'acertou' : r.tie ? 'empatou (devolvido)' : 'errou'}`, r.back);
    award('trade');
    if (r.win) { award('tradeWin'); sfx.play('stack', 0.6); confetti(35); say(`Acertou! ${tk} ${r.side > 0 ? 'subiu' : 'desceu'}: recebeu ${brl(r.back)}.`); }
    else if (r.tie) say(`${tk} ficou praticamente parado (menos de 0,02%): empate, ${brl(r.stake)} de volta.`);
    else say(`${tk} ${r.side > 0 ? 'não subiu' : 'não desceu'}. Perdeu ${brl(r.stake)}.`, true);
  }
  save(); G.render();
}

export function pickAsset(a) { cur = a; document.querySelectorAll('.tr-asset').forEach(b => b.classList.toggle('is-on', b.dataset.id === a)); const ac = $('#mesa-acct'); if (ac) { ac.hidden = a !== MESA.REAL; if (!ac.hidden) ac.innerHTML = MESA.acctHTML(); } render(); }
const real = () => cur === MESA.REAL;
const fmtP = v => (real() ? MESA.fmt(v) : MK.fmt(cur, v));
const x = v => String(v).replace('.', ',') + 'x';
// velas e tempo da operação andam juntos: mudar um muda o outro (o gráfico mostra o tempo que vale para a boleta)
export function pickTf(v) {
  tf = dur = Number(v);
  document.querySelectorAll('[data-act="tr-tf"]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.id) === tf));
  document.querySelectorAll('[data-act="tr-dur"]').forEach(b => { const m = Number(b.dataset.id); b.classList.toggle('is-on', m === dur); b.innerHTML = `${m} min <small>paga ${x(MK.payout(m))}</small>`; });
  render();
}
export const pickDur = pickTf;
export const pickLev = () => {};

export function open(side) {
  const stake = Math.floor(Number($('[name="tr-amt"]').value) || 0);
  if (real()) return MESA.openReal(side, stake, dur).then(render);
  const r = MK.open(G.S, { asset: cur, side, stake, minutes: dur }, now());
  if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  const t = r.trade, tk = MK.ASSETS[cur].ticker;
  note(`trader: apostou que ${tk} ${side > 0 ? 'sobe' : 'desce'} em ${dur} min`, -stake);
  sfx.play('chip', 0.5);
  say(`Valendo! ${tk} em ${MK.fmt(cur, t.entry)}. Se ${side > 0 ? 'subir' : 'descer'} em ${dur} min, você recebe ${brl(Math.round(stake * t.pay))} (${x(t.pay)}).`);
  save(); G.render(); render();
}
export const close = () => {};          // não existe mais sair antes do tempo: o dinheiro já está em jogo

function render() {
  if ($('#p-trader').hidden) return;
  const t = now();
  for (const a of Object.keys(MK.ASSETS)) {
    const ch = MK.change(a, t, 60) * 100, q = $(`#tr-q-${a}`);
    if (q) { q.textContent = `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`; q.className = ch >= 0 ? 'good' : 'bad'; }
  }
  { const ch = MESA.change1h() * 100, q = $(`#tr-q-${MESA.REAL}`); if (q) { q.textContent = MESA.spotNow() ? `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%` : '…'; q.className = ch >= 0 ? 'good' : 'bad'; } }
  const amt = Math.floor(Number($('[name="tr-amt"]').value) || 0);
  if (real()) {
    const vis = MESA.candles(tf, 60), px = MESA.spotNow(), ch = MESA.change1h() * 100;
    $('#tr-name').textContent = 'Bitcoin real (BTC/USD · Coinbase)';
    $('#tr-price').textContent = px ? MESA.fmt(px) : 'carregando…';
    $('#tr-price').className = `tr-price ${ch >= 0 ? 'good' : 'bad'}`;
    $('#tr-ch').textContent = `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}% em 1 h`; $('#tr-ch').className = ch >= 0 ? 'good' : 'bad';
    $('#tr-hl').textContent = vis.length ? `máx ${MESA.fmt(Math.max(...vis.map(c => c.h)))}  mín ${MESA.fmt(Math.min(...vis.map(c => c.l)))}` : '';
    $('#tr-size').innerHTML = MESA.sizeHTML(amt, dur);
    $('#tr-pos').innerHTML = MESA.posHTML();
    $('#tr-hist').innerHTML = MESA.histHTML();
    if (vis.length > 1) draw(vis);
    return;
  }
  const A = MK.ASSETS[cur], px = MK.price(cur, t), ch = MK.change(cur, t, 60) * 100, vis = MK.candles(cur, t, tf, 60);
  $('#tr-name').textContent = `${A.name} (${A.ticker})`;
  $('#tr-price').textContent = MK.fmt(cur, px);
  $('#tr-price').className = `tr-price ${vis.at(-1).c >= vis.at(-1).o ? 'good' : 'bad'}`;
  $('#tr-ch').textContent = `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}% em 1 h`;
  $('#tr-ch').className = ch >= 0 ? 'good' : 'bad';
  $('#tr-hl').textContent = `máx ${MK.fmt(cur, Math.max(...vis.map(c => c.h)))}  mín ${MK.fmt(cur, Math.min(...vis.map(c => c.l)))}  ${A.unit}`;
  $('#tr-size').innerHTML = `Acertou em ${dur} min: recebe <b class="good">${brl(Math.round(amt * MK.payout(dur)))}</b> (${x(MK.payout(dur))}, lucro de ${Math.round((MK.payout(dur) - 1) * 100)}%). Quanto mais longo o tempo, mais paga: 1 min ${x(MK.payout(1))} · 5 min ${x(MK.payout(5))} · 10 min ${x(MK.payout(10))}. Andou menos de 0,02% para qualquer lado: empate, o valor volta. Errou: perde ${brl(amt)}. Máximo de ${brl(MK.MAX_STAKE)} por operação e lucro de até ${brl(MK.DAY_GAIN)} por dia na mesa.`;
  $('#tr-pos').innerHTML = G.S.trades.length ? G.S.trades.map(p => {
    const cp = MK.price(p.asset, t), ahead = MK.wins(p.side, p.entry, cp), close = !ahead && MK.ties(p.entry, cp);   // praticamente parado: empate
    return `<li class="tr-p"><div><strong class="${p.side > 0 ? 'good' : 'bad'}">${p.side > 0 ? '▲ sobe' : '▼ desce'} ${MK.ASSETS[p.asset].ticker}</strong>
      <span class="muted small">entrada ${MK.fmt(p.asset, p.entry)}, agora ${MK.fmt(p.asset, cp)}</span></div>
      <div class="tr-pl ${ahead ? 'good' : close ? 'gold' : 'bad'}">${ahead ? 'ganhando' : close ? 'empate: devolve se fechar assim' : 'perdendo'}<small>${brl(p.stake)} em jogo</small></div>
      <div class="tr-timer"><b>${fmtLeft(p.exp - t)}</b><small>${p.minutes} min</small></div></li>`;
  }).join('') : '<li class="muted small">Nenhuma operação em andamento.</li>';
  $('#tr-hist').innerHTML = G.S.trHist.length ? G.S.trHist.filter(h => h.exp).map(h => `<li><span>${h.side > 0 ? 'sobe' : 'desce'} ${esc(MK.ASSETS[h.asset]?.ticker || '')} ${h.minutes} min</span><span class="${h.win ? 'good' : h.tie ? 'muted' : 'bad'}">${h.win ? '+' + brl(h.back - h.stake) : h.tie ? 'empate: devolvido' : '−' + brl(h.stake)}</span></li>`).join('') : '<li class="muted small">Sem operações encerradas.</li>';
  draw(vis);
}

function draw(vis) {
  const cv = $('#tr-canvas'); if (!cv || !cv.offsetWidth) return;
  vis ??= real() ? MESA.candles(tf, 60) : MK.candles(cur, now(), tf, 60); if (vis.length < 2) return;
  const dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const css = n => getComputedStyle(cv).getPropertyValue(n).trim();
  const up = css('--tr-up'), down = css('--tr-down'), grid = css('--tr-grid'), text = css('--tr-text');
  const axisW = 84, chartH = H - 24, t = now();
  let hi = Math.max(...vis.map(c => c.h)), lo = Math.min(...vis.map(c => c.l));
  const mine = real() ? MESA.openLines() : G.S.trades.filter(p => p.asset === cur);
  for (const p of mine) { hi = Math.max(hi, p.entry); lo = Math.min(lo, p.entry); }
  const padV = (hi - lo) * 0.08 || hi * 0.001; hi += padV; lo -= padV;
  const y = v => 10 + ((hi - v) / (hi - lo)) * (chartH - 10), cw = (W - axisW) / vis.length;
  g.font = `600 11px ${css('--font-body')}`; g.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const v = lo + ((hi - lo) * i) / 5, yy = y(v);
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(0, yy); g.lineTo(W - axisW, yy); g.stroke();
    g.fillStyle = text; g.fillText(fmtP(v), W - axisW + 8, yy);
  }
  // horário embaixo
  g.fillStyle = text;
  for (let i = 0; i < vis.length; i += 12) g.fillText(new Date(vis[i].t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), i * cw + 2, H - 10);
  // média móvel de 20 velas
  g.strokeStyle = css('--tr-ma'); g.lineWidth = 1.6; g.beginPath();
  vis.forEach((c, i) => { const s = vis.slice(Math.max(0, i - 19), i + 1), ma = s.reduce((a, x) => a + x.c, 0) / s.length, xx = i * cw + cw / 2; i ? g.lineTo(xx, y(ma)) : g.moveTo(xx, y(ma)); });
  g.stroke();
  vis.forEach((c, i) => {
    const xx = i * cw + cw / 2, col = c.c >= c.o ? up : down;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(xx, y(c.h)); g.lineTo(xx, y(c.l)); g.stroke();
    g.fillRect(xx - cw * 0.34, y(Math.max(c.o, c.c)), cw * 0.68, Math.max(1, Math.abs(y(c.o) - y(c.c))));
  });
  const hline = (v, col, label, dash = [5, 4]) => {
    const yy = y(v); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, yy); g.lineTo(W - axisW, yy); g.stroke(); g.setLineDash([]);
    g.fillStyle = col; g.fillRect(W - axisW, yy - 10, axisW, 20); g.fillStyle = css('--shade'); g.fillText(label, W - axisW + 6, yy);
  };
  for (const p of mine) hline(p.entry, p.side > 0 ? up : down, `${p.side > 0 ? '▲' : '▼'} ${fmtLeft(p.exp - t)}`, [2, 3]);
  const px = real() ? (MESA.spotNow() || vis.at(-1).c) : MK.price(cur, t), last = vis.at(-1);
  hline(px, last.c >= last.o ? up : down, fmtP(px));
  if (hover && hover.x < W - axisW) {
    const i = Math.min(vis.length - 1, Math.max(0, Math.floor(hover.x / cw))), c = vis[i];
    g.strokeStyle = text; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(i * cw + cw / 2, 0); g.lineTo(i * cw + cw / 2, H - 20); g.moveTo(0, hover.y); g.lineTo(W - axisW, hover.y); g.stroke(); g.setLineDash([]);
    g.fillStyle = css('--tr-tip'); g.fillRect(8, 8, 330, 22); g.fillStyle = text;
    g.fillText(`${new Date(c.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}  A ${fmtP(c.o)}  M ${fmtP(c.h)}  m ${fmtP(c.l)}  F ${fmtP(c.c)}`, 14, 19);
  }
}

// ---------- cotações ao vivo no topo de todas as telas ----------
const COMMOD = { soja: ['Soja (saca)', 'soja'], milho: ['Milho (saca)', 'milho'], cafe: ['Café (saca)', 'cafe'], arroba: ['Arroba do boi', 'arroba'], bezerro: ['Bezerro', 'bezerro'], frango: ['Frango vivo (kg)', 'frango'], laranja: ['Laranja (caixa)', 'laranja'], cana: ['Cana (tonelada)', 'cana'] };
function tickerItems() {
  return [...Object.entries(MK.ASSETS).map(([k, a]) => `<li class="tk" data-tk="${k}"><b>${a.ticker}</b><small>${a.name}</small><i class="tk__p"></i><i class="tk__c"></i></li>`),
    ...Object.entries(COMMOD).map(([k, [label]]) => `<li class="tk tk--farm" data-tk="${k}"><b>${label}</b><small>mês do mundo</small><i class="tk__p"></i><i class="tk__c"></i></li>`)].join('');
}
function buildTicker() {
  const el = $('#ticker'); if (!el) return;
  el.innerHTML = `<h4>valores do dia <small>ao vivo</small></h4><div data-econ-chip></div><ul>${tickerItems()}</ul><p class="muted small">Clique para operar ou vender.</p>`;
  const btn = $('#tk-btn'), close = () => { el.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const place = () => el.style.setProperty('--tk-top', `${(b => b > innerHeight * 0.5 ? 12 : Math.max(8, b))(Math.round(btn.getBoundingClientRect().bottom + 8))}px`);   // logo abaixo do botão, onde quer que o topo esteja
  addEventListener('resize', () => { if (!el.hidden) place(); });
  btn.addEventListener('click', e => { e.stopPropagation(); place(); el.hidden = !el.hidden; btn.setAttribute('aria-expanded', String(!el.hidden)); updateTicker(); });
  document.addEventListener('click', e => { if (!el.hidden && !e.target.closest('.tkmenu')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  el.addEventListener('click', e => { const k = e.target.closest('[data-tk]')?.dataset.tk; if (!k) return; close(); if (MK.ASSETS[k]) { G.goto?.('trader'); pickAsset(MK.NO_OPEN.has(k) ? MESA.REAL : k); } else G.goto?.('mercado'); });
  updateTicker();
}
function updateTicker() {
  const t = now(), s = G.S;
  for (const [k] of Object.entries(MK.ASSETS)) {
    const p = MK.price(k, t), ch = MK.change(k, t, 1440) * 100;
    const dot = $('#tk-btn .tk-btn__dot'); if (dot && k === 'btc') dot.className = `tk-btn__dot ${ch >= 0 ? 'is-up' : 'is-down'}`;
    document.querySelectorAll(`[data-tk="${k}"]`).forEach(e => { e.querySelector('.tk__p').textContent = MK.fmt(k, p); const c = e.querySelector('.tk__c'); c.textContent = `${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%`; c.className = `tk__c ${ch >= 0 ? 'good' : 'bad'}`; });
  }
  for (const [k] of Object.entries(COMMOD)) {
    const p = s.prices?.[k], prev = s.prev?.[k] || p, ch = p && prev ? (p / prev - 1) * 100 : 0;
    document.querySelectorAll(`[data-tk="${k}"]`).forEach(e => { e.querySelector('.tk__p').textContent = brl(p || 0); const c = e.querySelector('.tk__c'); c.textContent = `${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%`; c.className = `tk__c ${ch >= 0 ? 'good' : 'bad'}`; });
  }
}

export const tick = () => render();
