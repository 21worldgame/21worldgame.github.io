// Tela do pôquer: salão com mesas da casa e online, mesa de 6 lugares (você embaixo), apostas e showdown.
// Fichas: senta com a compra (100 big blinds) e leva o que tiver quando levantar. O que está na mesa fica guardado
// no save (G.S.pk): se fechar a aba no meio, as fichas voltam na próxima vez que abrir o jogo.
import * as PK from './poker.js';
import * as C from './casino.js';
import * as NPC from './npcs.js';
import { openTableRoom } from './net.js';
import { NPC_LOOKS, avatarSVG } from './avatar.js';
import { G, $, esc, int, say, save, note, profileOf, confetti } from './store.js';
import * as sfx from './sfx.js';

export const HOUSE = [
  { id: 'pk-boteco', name: 'Pôquer do Boteco', bb: 10, skill: 0.55, bots: ['Coringa021', 'SemanaUm', 'Novato_BR', 'TrocaTroca', 'PrimeiroMes'] },
  { id: 'pk-clube', name: 'Clube do Flop', bb: 50, skill: 0.66, bots: ['FeiraMaster', 'CafeForte', 'MengaoBR', 'LoboNoturno', 'DezVezes21'] },
  { id: 'pk-pro', name: 'Mesa Profissional', bb: 200, skill: 0.78, bots: ['ContaCarta', 'CartaRara', 'CriptoTrader', 'HarasEstrela', 'Blackjack21'] },
  { id: 'pk-magnata', name: 'Pôquer do Magnata', bb: 1000, skill: 0.88, bots: ['ReiDoGado', 'A Boiadeira', 'RainhaDaSoja', 'HighRollerX', 'BTCnaVeia'] },
];
const TIER = ['bronze', 'esmeralda', 'diamante', 'magnata'];
let cur = null, view = null, raiseTo = 0, lastHands = -1;
const rid = () => Math.random().toString(36).slice(2, 8);
const me = () => { const p = profileOf(); return { name: p.name, look: p.look }; };
const RN = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' }, SU = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const card = (c, cls = '') => (c ? `<img class="tr-card pk-card ${cls}" src="assets/cards/${RN[c.r] || c.r}_of_${SU[c.s]}.webp" alt="${c.r}${c.s}">` : `<span class="tr-card tr-card--back pk-card ${cls}"></span>`);
const lookOf = s => (s.kind === 'human' ? s.look : NPC.byNick(s.name)?.look || NPC_LOOKS.Dorival) || {};

// ---------- fichas na mesa ----------
function settle(why) {   // devolve as fichas da mesa para o caixa
  const pk = G.S?.pk; if (!pk) return;
  delete G.S.pk;
  if (pk.stack > 0) { G.S.chips = (G.S.chips || 0) + pk.stack; note(`pôquer: levantou da mesa com ${int(pk.stack)} fichas${why ? ` (${why})` : ''}`); }
  save(); G.render?.();
}
function money(v) {
  const s = v.seats[v.seat]; if (!s || s.kind !== 'human') return;
  if (G.S.pk?.id !== v.id) { settle(); G.S.pk = { id: v.id, paid: 0, stack: 0 }; }
  const pk = G.S.pk;
  if (s.buys > pk.paid) { const n = s.buys - pk.paid, cost = n * v.buyIn; G.S.chips = Math.max(0, (G.S.chips || 0) - cost); pk.paid = s.buys; note(`pôquer: comprou ${int(cost)} fichas na ${v.name}`); }
  if (pk.stack !== s.stack || pk.dirty) { pk.stack = s.stack; save(); G.render?.(); }
  if (v.phase === 'show' && v.hands !== lastHands) {
    lastHands = v.hands;
    const w = v.winners?.find(x => x.seat === v.seat);
    if (w) { sfx.play('stack', 0.7); if (w.amount >= v.bb * 40) confetti(60); G.S.stats ??= {}; G.S.stats.poker = (G.S.stats.poker || 0) + 1; G.S.stats.best = Math.max(G.S.stats.best || 0, w.amount); save(); }
  }
}

// ---------- salão ----------
export function renderLobby() {
  if (G.S?.pk && !cur) settle('a mesa fechou');
  const el = $('#pk-tables'); if (!el || $('#sub-poker').hidden) return;
  const online = C.peerList().flatMap(([, p]) => (p.games || []).filter(g => g.kind === 'poker').map(g => ({ ...g, host: p.profile?.name })));
  const tcard = (t, kind) => {
    const seats = t.seats || t.bots.map(name => ({ kind: 'bot', name }));
    return `<article class="tcard3 tcard3--${kind === 'online' ? 'online' : TIER[HOUSE.indexOf(t)]}">
      <div class="tcard3__top"><span class="tcard3__live"><i></i>${kind === 'online' ? `online · ${esc(t.host || '')}` : 'texas hold\'em'}</span><span class="tcard3__stake">blinds ${int(t.bb / 2)}/${int(t.bb)}</span></div>
      <div class="tcard3__table"><div class="tcard3__felt pk-felt-mini"><b>${esc(t.name)}</b><small>compra ${int(t.bb * 100)} fichas</small></div>
        ${seats.slice(0, 5).map((s, i) => `<span class="tcard3__seat tcard3__seat--b${i}" title="${esc(s.name || 'livre')}"><span class="tcard3__av${s.kind === 'empty' ? ' tcard3__av--free' : ''}">${s.kind === 'empty' ? '+' : avatarSVG(lookOf(s), { label: s.name })}</span><em>${esc(s.kind === 'empty' ? 'livre' : s.name)}</em></span>`).join('')}
        <span class="tcard3__seat tcard3__seat--you"><span class="tcard3__av tcard3__av--free">+</span><em>seu lugar</em></span></div>
      <div class="tcard3__foot"><span class="muted small">${kind === 'online' ? `${t.humans} ${t.humans === 1 ? 'pessoa' : 'pessoas'} na mesa` : `adversários ${['iniciantes', 'bons', 'profissionais', 'tubarões'][HOUSE.indexOf(t)]}`}</span>
        <button class="btn btn--gold" data-pk="${kind === 'online' ? 'join' : 'house'}" data-id="${esc(t.id)}" ${t.full ? 'disabled' : ''}>sentar</button></div></article>`;
  };
  el.innerHTML = online.map(t => tcard(t, 'online')).join('') + HOUSE.map(t => tcard(t, 'house')).join('');
}
G.gameHosts ??= {};
G.gameHosts.poker = () => (cur?.host && cur.pub && cur.engine ? { kind: 'poker', id: cur.id, name: cur.engine.name, bb: cur.engine.bb, humans: cur.engine.seats.filter(s => s.kind === 'human').length,
  full: cur.engine.seats.every(s => s.kind === 'human'), seats: cur.engine.seats.filter((s, i) => i).map(s => ({ kind: s.kind, name: s.name, look: s.look })) } : null);

// ---------- abrir mesa ----------
function show(on) { $('#pk-lobby').hidden = on; $('#pk-room').hidden = !on; }
const enough = bb => { if ((G.S.chips || 0) >= bb * 100) return true; say(`Essa mesa pede ${int(bb * 100)} fichas para sentar. Compre no caixa do cassino (aba vinte e um).`, true); return false; };
export function sitHouse(id) {
  const def = HOUSE.find(t => t.id === id); if (!def || !enough(def.bb)) return;
  leave(true);
  const e = new PK.Poker({ id: def.id, name: def.name, bb: def.bb, skill: def.skill, botNames: def.bots, onChange: x => draw(x.view(x.seatOf('me'))) });
  cur = { id: def.id, local: true, engine: e }; show(true);
  e.join('me', me(), 0); e.fillBots(5);
}
export async function host({ name, bb, pub }) {
  if (!enough(bb)) return;
  const id = rid(), conn = await openTableRoom(`poker-${id}`);
  if (!conn) return say('Sem conexão com a internet agora. Jogue numa mesa da casa.', true);
  leave(true);
  const self = conn.selfId;
  const e = new PK.Poker({ id, name: name || 'pôquer dos amigos', bb, skill: 0.7, botNames: HOUSE[1].bots, onChange: x => {
    for (const [i, s] of x.seats.entries()) if (s.kind === 'human' && s.pid !== self) conn.state.send(x.view(i), { target: s.pid });
    draw(x.view(x.seatOf(self))); C.announce();
  } });
  cur = { id, host: true, pub, engine: e, conn };
  conn.act.onMessage = (m, { peerId }) => {
    if (m.t === 'join') { if (e.join(peerId, m.info) == null) conn.state.send({ full: true }, { target: peerId }); return; }
    if (m.t === 'leave') return e.leave(peerId);
    if (m.t === 'rebuy') return e.rebuy(peerId), e.emit();
    const s = e.seatOf(peerId); if (s >= 0) e.act(s, m);
  };
  conn.room.onPeerLeave = pid => e.leave(pid);
  show(true); e.join(self, me(), 0); e.fillBots(3); C.announce(); invite();
}
export async function join(id) {
  id = String(id || '').trim().toLowerCase(); if (!id) return;
  const conn = await openTableRoom(`poker-${id}`);
  if (!conn) return say('Sem conexão com a internet agora.', true);
  leave(true);
  cur = { id, remote: true, conn, hostId: null }; show(true);
  $('#pk-msg').textContent = 'Procurando a mesa…';
  conn.room.onPeerJoin = target => { conn.act.send({ t: 'join', info: me() }, { target }); };
  conn.room.onPeerLeave = pid => { if (pid === cur?.hostId) { say('O anfitrião fechou a mesa de pôquer.', true); leave(); } };
  conn.state.onMessage = (v, { peerId }) => {
    if (cur?.conn !== conn) return;
    if (v.full) { say('Essa mesa está cheia.', true); return leave(); }
    if (v.closed) { say('O anfitrião fechou a mesa de pôquer.', true); return leave(); }
    if (!cur.hostId && (G.S.chips || 0) < v.buyIn) { say(`Essa mesa pede ${int(v.buyIn)} fichas para sentar.`, true); conn.act.send({ t: 'leave' }, { target: peerId }); return leave(); }
    cur.hostId = peerId; draw(v);
  };
  setTimeout(() => { if (cur?.conn === conn && !cur.hostId) { say('Mesa de pôquer não encontrada.', true); leave(); } }, 25000);
}
export function leave(silent) {
  const c = cur; if (!c) { if (!silent) show(false); return; }
  cur = null; view = null; lastHands = -1;
  if (c.engine) { if (c.host) { c.conn.state.send({ closed: true }); setTimeout(() => c.conn.room.leave(), 300); } c.engine.close(); }
  if (c.remote) { if (c.hostId) c.conn.act.send({ t: 'leave' }, { target: c.hostId }); setTimeout(() => c.conn.room.leave(), 300); }
  settle(); C.announce();
  if (!silent) { show(false); renderLobby(); }
}
export function invite() {
  if (!cur || cur.local) return;
  const url = `${location.origin}${location.pathname}?poker=${cur.id}`;
  navigator.clipboard?.writeText(url).then(() => say(`Link da mesa de pôquer copiado. Código: ${cur.id}`), () => say(`Código da mesa de pôquer: ${cur.id}`));
}
function send(a) {
  if (!cur) return;
  if (cur.engine) {
    const e = cur.engine, s = e.seatOf(cur.local ? 'me' : cur.conn.selfId);
    const err = a.t === 'rebuy' ? e.rebuy(cur.local ? 'me' : cur.conn.selfId) : e.act(s, a);
    if (err) say(err[0].toUpperCase() + err.slice(1), true); else if (a.t === 'rebuy') e.emit();
  } else if (cur.hostId) cur.conn.act.send(a, { target: cur.hostId });
}

// ---------- desenhar ----------
function draw(v) {
  if (!v || !$('#pk-room')) return;
  view = v; money(v);
  const my = Math.max(0, v.seat), rel = i => (i - my + PK.SEATS) % PK.SEATS, mine = v.seats[v.seat];
  const won = new Map((v.phase === 'show' ? v.winners || [] : []).map(w => [w.seat, w]));
  $('#pk-name').textContent = v.name;
  $('#pk-blinds').textContent = `blinds ${int(v.sb)}/${int(v.bb)}`;
  $('#pk-seats').innerHTML = v.seats.map((s, i) => {
    if (s.kind === 'empty') return `<div class="pk-seat pk-pos--${rel(i)} is-empty"><span class="pk-av">+</span><b>livre</b></div>`;
    const w = won.get(i), turn = v.phase === 'play' && v.turn === i;
    return `<div class="pk-seat pk-pos--${rel(i)}${turn ? ' is-turn' : ''}${s.folded ? ' is-folded' : ''}${w ? ' is-winner' : ''}${i === v.seat ? ' is-me' : ''}">
      <span class="pk-av">${avatarSVG(lookOf(s), { label: s.name })}</span>
      <b>${esc(s.name)}</b><span class="pk-stack">${s.stack ? int(s.stack) : s.allin ? 'all-in' : 'sem fichas'}</span>
      ${s.said ? `<em class="pk-said">${esc(s.said)}</em>` : ''}${w ? `<em class="pk-won">+${int(w.amount)}${w.hand ? ` · ${esc(w.hand)}` : ''}</em>` : ''}
      ${i !== v.seat && s.cards.length ? `<span class="pk-hole">${s.cards.map(c => card(c, 'tr-card--sm')).join('')}</span>` : ''}
      ${v.button === i ? '<i class="tr-dealer pk-dealer" title="botão (quem dá as cartas)">D</i>' : ''}
      ${s.bet ? `<span class="pk-bet">${int(s.bet)}</span>` : ''}</div>`;
  }).join('');
  $('#pk-center').innerHTML = `<div class="pk-board">${[0, 1, 2, 3, 4].map(k => v.board[k] ? card(v.board[k], 'pk-in') : '<span class="pk-slot"></span>').join('')}</div>
    <div class="pk-pot"><small>pote</small><b>${int(v.pot)}</b></div>`;
  // minhas cartas
  $('#pk-hand').innerHTML = mine?.cards?.length ? `${mine.cards.map(c => card(c)).join('')}${v.best ? `<span class="pk-best">${esc(v.best)}</span>` : ''}` : '';
  // botões
  const myTurn = v.phase === 'play' && v.turn === v.seat, call = v.toCall;
  if (myTurn) {
    const min = Math.min(v.minTo, v.maxTo), pot = v.pot + call;
    raiseTo = Math.max(min, Math.min(v.maxTo, raiseTo || min));
    const presets = [['½ pote', Math.floor(pot / 2)], ['pote', pot], ['2x pote', pot * 2]].map(([l, x]) => [l, Math.max(min, Math.min(v.maxTo, (v.seats[v.seat].bet + call) + x))]);
    $('#pk-actions').innerHTML = `<button class="btn btn--glass btn--lg" data-pk="fold">desistir</button>
      ${call ? `<button class="btn btn--gold btn--lg" data-pk="call">pagar ${int(Math.min(call, mine.stack))}</button>` : '<button class="btn btn--gold btn--lg" data-pk="check">mesa</button>'}
      ${mine.stack > call ? `<div class="pk-raise"><input type="range" id="pk-range" min="${min}" max="${v.maxTo}" step="${v.bb / 2 >= 1 ? Math.floor(v.bb / 2) : 1}" value="${raiseTo}" aria-label="valor do aumento">
        <div class="pk-presets">${presets.map(([l, x]) => `<button class="btn btn--glass btn--sm" data-pk="preset" data-v="${x}">${l}</button>`).join('')}</div>
        <button class="btn btn--hot btn--lg" data-pk="raise" id="pk-raise-btn">${call ? 'aumentar' : 'apostar'} p/ ${int(raiseTo)}</button></div>` : ''}
      <button class="btn btn--hot btn--lg pk-allin" data-pk="allin">all-in ${int(mine.stack)}</button>`;
  } else if (mine && !mine.stack && !(mine.in && !mine.folded && v.phase === 'play')) $('#pk-actions').innerHTML = `<button class="btn btn--gold btn--lg" data-pk="rebuy">comprar ${int(v.buyIn)} fichas</button>`;
  else { $('#pk-actions').innerHTML = ''; raiseTo = 0; }
  const turnName = v.seats[v.turn]?.name;
  $('#pk-msg').textContent = myTurn ? `Sua vez${call ? `: ${int(call)} para pagar` : ''}. ${v.msg}` : v.phase === 'play' && turnName ? `Vez de ${turnName}. ${v.msg}` : v.msg;
  $('#pk-invite').hidden = !!cur?.local;
  $('#pk-room').classList.toggle('is-myturn', myTurn);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-pk]'); if (!b || b.disabled) return;
  const a = b.dataset.pk;
  if (a === 'house') return sitHouse(b.dataset.id);
  if (a === 'join') return join(b.dataset.id);
  if (a === 'leave') return leave();
  if (a === 'invite') return invite();
  if (a === 'create') { const f = $('#pk-create'); return host({ name: f.pname.value.trim(), bb: Number(f.pbb.value), pub: f.pvis.value === 'pub' }); }
  if (a === 'code') return join($('#pk-code').value);
  if (a === 'rebuy') { if (!enough(view?.bb || 0)) return; return send({ t: 'rebuy' }); }
  if (a === 'preset') { raiseTo = Number(b.dataset.v); return draw(view); }
  if (a === 'raise') return send({ t: 'raise', to: raiseTo });
  send({ t: a });
});
document.addEventListener('input', e => {
  if (e.target.id !== 'pk-range') return;
  raiseTo = Number(e.target.value);
  const btn = $('#pk-raise-btn'); if (btn) btn.textContent = `${view?.toCall ? 'aumentar' : 'apostar'} p/ ${int(raiseTo)}`;
});
setInterval(renderLobby, 5000);
const q = new URLSearchParams(location.search).get('poker');
if (q) setTimeout(() => { G.goto?.('mesa'); document.querySelector('[data-sub="poker"]')?.click(); join(q); }, 2500);
