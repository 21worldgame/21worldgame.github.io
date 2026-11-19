// Tela das apostas no futebol: três jogos por rodada, relatório pré-jogo, odds, jogo ao vivo (campo, lances e estatísticas).
import * as AP from './aposta.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import { G, $, esc, int, say, save, note, confetti } from './store.js';
import * as sfx from './sfx.js';

let active = false, sel = null, pick = null, sig = '', timer = 0;
const root = () => $('#sub-bet');
const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const badge = t => `<i class="fb-crest" style="--a:${t.c[0]};--b:${t.c[1]}">${esc(t.n.slice(0, 3).toUpperCase())}</i>`;
const ICON = { gol: '⚽', esc: '🚩', cart: '🟨', chute: '🎯' }, TXT = { gol: 'GOL', esc: 'escanteio', cart: 'cartão amarelo', chute: 'finalização' };

export function setActive(on) { active = on; if (on) { sig = ''; tick(); } }
setInterval(() => { settle(); if (active) tick(); }, 500);

function settle() {
  if (!G.S) return;
  const res = AP.settle(G.S, Live.now());
  if (!res.length) return;
  for (const r of res) { note(r.txt); if (r.won) { say(`Aposta certa! +${int(r.pay)} fichas.`); confetti(50); sfx.play('stack', 0.6); } }
  save(); G.render(); sig = '';
}

const clockOf = (slot, now) => { const ph = AP.phase(slot, now); return ph === 'pre' ? `começa em ${mmss(AP.kickoffIn(slot, now))}` : ph === 'live' ? `${AP.minuteAt(slot, now)}' ao vivo` : 'fim de jogo'; };
function tick() {
  const el = root(); if (!el || el.hidden) return;
  const now = Live.now(), slot = AP.slotOf(now), rounds = AP.phase(slot, now) === 'pre' ? [slot] : [slot, slot + 1];
  if (!sel || !rounds.includes(sel.slot)) { sel = { slot: rounds[0], i: sel?.i || 0 }; pick = null; }
  const ph = AP.phase(sel.slot, now), min = AP.minuteAt(sel.slot, now);
  const s2 = `${rounds}|${AP.phase(slot, now)}|${AP.minuteAt(slot, now)}|${sel.slot}:${sel.i}|${pick?.mk}:${pick?.k}|${(G.S.fbets || []).length}|${(G.S.fhist || []).length}`;
  el.querySelectorAll('[data-clock]').forEach(c => { c.textContent = clockOf(Number(c.dataset.clock), now); });   // o relógio anda sem redesenhar tudo
  if (s2 === sig) return;
  sig = s2;
  $('#fb-games').innerHTML = rounds.map(sl => `<div class="fb-round"><h4>${sl === slot && AP.phase(sl, now) !== 'pre' ? (AP.phase(sl, now) === 'live' ? 'ao vivo agora' : 'encerrados') : 'próxima rodada · apostas abertas'}</h4><div class="fb-games__row">${AP.matches(sl).map((m, i) => {
    const p = AP.phase(sl, now), mi = AP.minuteAt(sl, now);
    return `<button class="fb-game${sl === sel.slot && i === sel.i ? ' is-on' : ''}" data-fb-sel="${sl}:${i}">
    <span class="fb-game__t">${badge(m.home)}<b>${esc(m.home.n)}</b><strong>${p === 'pre' ? '' : AP.count(m, 'gol', 'h', mi)}</strong></span>
    <span class="fb-game__t">${badge(m.away)}<b>${esc(m.away.n)}</b><strong>${p === 'pre' ? '' : AP.count(m, 'gol', 'a', mi)}</strong></span>
    <small class="${p === 'live' ? 'is-live' : ''}" data-clock="${sl}">${clockOf(sl, now)}</small></button>`; }).join('')}</div></div>`).join('');
  const mt = AP.matches(sel.slot)[sel.i];
  board(mt, ph, min, clockOf(sel.slot, now));
  slip(mt, ph, sel.slot);
}

function board(mt, ph, min, clock) {
  const h = AP.count(mt, 'gol', 'h', min), a = AP.count(mt, 'gol', 'a', min), upto = ph === 'pre' ? 0 : min;
  const head = `<div class="fb-score"><div class="fb-team">${badge(mt.home)}<b>${esc(mt.home.n)}</b><small>mandante</small></div>
    <div class="fb-mid"><strong>${ph === 'pre' ? 'x' : `${h} <span>-</span> ${a}`}</strong><span class="fb-clock ${ph === 'live' ? 'is-live' : ''}" data-clock="${mt.slot}">${clock}</span></div>
    <div class="fb-team">${badge(mt.away)}<b>${esc(mt.away.n)}</b><small>visitante</small></div></div>`;
  let body;
  if (ph === 'pre') {
    const rt = mt.rt, f = t => AP.form(t, mt.slot).map(x => `<i class="fb-f fb-f--${x}">${x}</i>`).join('');
    body = `<div class="fb-report"><h4>relatório pré-jogo</h4>
      <div class="fb-rep"><span>${f(mt.home)}</span><em>últimos 5 jogos</em><span>${f(mt.away)}</span></div>
      ${[['força do elenco', mt.home.r, mt.away.r, 0], ['gols esperados', rt.gh, rt.ga, 1], ['escanteios esperados', rt.ch, rt.ca, 1], ['cartões esperados', rt.yh, rt.ya, 1], ['finalizações esperadas', rt.sh, rt.sa, 0]]
        .map(([k, x, y, d]) => statRow(k, x, y, d)).join('')}
      <p class="small muted">Apostas abertas até o apito inicial. Toque numa odd para montar o bilhete.</p></div>`;
  } else {
    const ev = mt.events.filter(e => e.m <= upto), last = [...ev].reverse().find(e => e.type !== 'chute' || e.m >= upto - 2);
    const side = last && upto - last.m <= 3 ? last.side : null, bx = side === 'h' ? 82 : side === 'a' ? 18 : 50 + Math.sin(Date.now() / 900) * 22, by = 50 + Math.cos(upto * 1.7) * 26;
    const c = (t, sd) => ev.filter(e => e.type === t && e.side === sd).length;
    body = `<div class="fb-live"><svg class="fb-pitch" viewBox="0 0 200 120" aria-label="campo">
        <rect x="2" y="2" width="196" height="116" rx="3"/><line x1="100" y1="2" x2="100" y2="118"/><circle cx="100" cy="60" r="16"/>
        <rect x="2" y="30" width="26" height="60"/><rect x="172" y="30" width="26" height="60"/><rect x="2" y="46" width="9" height="28"/><rect x="189" y="46" width="9" height="28"/>
        <circle class="fb-ball" cx="${(bx * 2).toFixed(0)}" cy="${(by * 1.2).toFixed(0)}" r="3.4"/></svg>
      <div class="fb-stats">${[['posse de bola', mt.poss, 100 - mt.poss, 0, '%'], ['finalizações', c('chute', 'h') + c('gol', 'h'), c('chute', 'a') + c('gol', 'a'), 0], ['escanteios', c('esc', 'h'), c('esc', 'a'), 0], ['cartões amarelos', c('cart', 'h'), c('cart', 'a'), 0]]
        .map(([k, x, y, d, u]) => statRow(k, x, y, d, u)).join('')}</div>
      <ol class="fb-feed">${ev.filter(e => e.type !== 'chute').reverse().map(e => `<li class="fb-ev fb-ev--${e.type}"><b>${e.m}'</b>${ICON[e.type]} ${TXT[e.type]} · ${esc((e.side === 'h' ? mt.home : mt.away).n)}</li>`).join('')
        || `<li class="muted">${upto ? 'Jogo truncado no meio-campo...' : `Bola rolando! Saída de bola: ${esc((mt.kick === 'h' ? mt.home : mt.away).n)}.`}</li>`}</ol></div>`;
  }
  $('#fb-board').innerHTML = head + body + odds(mt, ph);
}
function statRow(k, x, y, d, u = '') {
  const t = x + y || 1, fx = v => (d ? v.toFixed(d).replace('.', ',') : Math.round(v)) + u;
  return `<div class="fb-stat"><b>${fx(x)}</b><span>${k}<i><em style="width:${(x / t * 100).toFixed(0)}%"></em></i></span><b>${fx(y)}</b></div>`;
}
function odds(mt, ph) {
  const open = ph === 'pre';
  return `<div class="fb-mk">${AP.markets(mt).map(m => `<div class="fb-mkt${m.id === 'placar' ? ' fb-mkt--wide' : ''}"><h5>${m.label}</h5><div class="fb-opts">${m.opts.map(o =>
    `<button class="fb-odd${pick && pick.mk === m.id && pick.k === o.k ? ' is-on' : ''}" data-fb-mk="${m.id}" data-fb-k="${o.k}" ${open ? '' : 'disabled'}><span>${esc(o.label)}</span><b>${o.odd.toFixed(2).replace('.', ',')}</b></button>`).join('')}</div></div>`).join('')}</div>`;
}

function slip(mt, ph, slot) {
  const m = pick && AP.markets(mt).find(x => x.id === pick.mk), o = m?.opts.find(x => x.k === pick.k);
  const stake = Number($('[name="fb-stake"]')?.value) || 100;
  $('#fb-slip').innerHTML = ph !== 'pre' ? `<p class="muted small">Este jogo já começou: as apostas fecharam. Escolha um jogo da <b>próxima rodada</b> para apostar.</p>`
    : o ? `<div class="fb-pick"><small>${esc(mt.home.n)} x ${esc(mt.away.n)}</small><b>${esc(m.label)}: ${esc(o.label)}</b><span class="fb-pick__odd">${o.odd.toFixed(2).replace('.', ',')}</span></div>
      <label class="field"><span>valor em fichas</span><input class="input" name="fb-stake" type="number" min="${AP.MIN_BET}" step="10" value="${stake}" inputmode="numeric"></label>
      <div class="row">${[50, 100, 500, 1000].map(v => `<button class="btn btn--glass btn--sm" data-fb-q="${v}">${v}</button>`).join('')}</div>
      <p class="small">retorno possível: <b class="good" id="fb-ret">${int(Math.floor(stake * o.odd))} fichas</b></p>
      <button class="btn btn--gold btn--lg" data-fb-bet>apostar</button>`
    : '<p class="muted small">Escolha uma odd ao lado para montar o bilhete.</p>';
  const mine = (G.S.fbets || []).map(b => `<li><span>${esc(b.game)}<small>${esc(b.label)}</small></span><b>${int(b.stake)} × ${b.odd.toFixed(2).replace('.', ',')}</b></li>`).join('');
  const done = (G.S.fhist || []).slice(0, 6).map(b => `<li class="${b.won ? 'is-won' : 'is-lost'}"><span>${esc(b.game)} (${b.score})<small>${esc(b.label)}</small></span><b>${b.won ? `+${int(b.pay)}` : `−${int(b.stake)}`}</b></li>`).join('');
  // a galera apostando: nicks do mundo, fixos por rodada
  const r = AP.rng(slot * 97 + 5), on = [...NPC.onlineSet(Live.now())].slice(0, 40), ms = AP.matches(slot);
  const crowd = Array.from({ length: 6 }, () => { const n = NPC.byId(on[Math.floor(r() * on.length)])?.nick || 'Coringa021', g = ms[Math.floor(r() * 3)], mk = AP.markets(g)[Math.floor(r() * 5)], op = mk.opts[Math.floor(r() * mk.opts.length)];
    return `<li><span>${esc(n)}<small>${esc(g.home.n)} x ${esc(g.away.n)} · ${esc(mk.label)}: ${esc(op.label)}</small></span><b>${int([50, 100, 200, 500, 1000, 2500][Math.floor(r() * 6)])}</b></li>`; }).join('');
  $('#fb-mine').innerHTML = `${mine ? `<h4>suas apostas em jogo</h4><ul class="fb-list">${mine}</ul>` : ''}${done ? `<h4>resultados</h4><ul class="fb-list">${done}</ul>` : ''}<h4>a galera está apostando</h4><ul class="fb-list fb-list--crowd">${crowd}</ul>`;
}

document.addEventListener('click', e => {
  const t = e.target.closest('#sub-bet [data-fb-sel], #sub-bet [data-fb-mk], #sub-bet [data-fb-q], #sub-bet [data-fb-bet]'); if (!t) return;
  if (t.dataset.fbSel) { const [a, b] = t.dataset.fbSel.split(':').map(Number); sel = { slot: a, i: b }; pick = null; }
  else if (t.dataset.fbMk) { pick = { mk: t.dataset.fbMk, k: t.dataset.fbK }; sfx.play('chip', 0.4); }
  else if (t.dataset.fbQ) { $('[name="fb-stake"]').value = t.dataset.fbQ; }
  else {
    const now = Live.now(), err = AP.place(G.S, now, sel.slot, sel.i, pick.mk, pick.k, $('[name="fb-stake"]').value);
    if (err) return say(err[0].toUpperCase() + err.slice(1), true);
    const b = G.S.fbets.at(-1); note(`aposta futebol: ${b.game}, ${b.label} (${int(b.stake)} fichas a ${b.odd.toFixed(2)})`);
    sfx.play('stack', 0.5); say('Aposta feita! Acompanhe o jogo ao vivo.'); pick = null; save(); G.render();
  }
  sig = ''; tick();
});
document.addEventListener('input', e => {
  if (e.target.name !== 'fb-stake') return;
  const o = pick && AP.markets(AP.matches(sel.slot)[sel.i]).find(x => x.id === pick.mk)?.opts.find(x => x.k === pick.k);
  if (o && $('#fb-ret')) $('#fb-ret').textContent = `${int(Math.floor((Number(e.target.value) || 0) * o.odd))} fichas`;
});
