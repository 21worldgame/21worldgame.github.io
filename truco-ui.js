// Tela do truco: salão com mesas da casa e mesas online, a mesa com 4 lugares (você sempre embaixo) e as jogadas.
// Mesa da casa: você + parceiro da casa contra dois da casa. Online: o anfitrião roda a partida (truco.js) e manda a visão de cada um.
import * as TR from './truco.js';
import * as C from './casino.js';
import * as NPC from './npcs.js';
import { openTableRoom } from './net.js';
import { NPC_LOOKS, avatarSVG } from './avatar.js';
import { G, $, esc, int, say, save, note, award, profileOf, confetti } from './store.js';
import * as sfx from './sfx.js';
import { botsFor } from './botpool.js';

export const HOUSE = [
  { id: 'tr-boteco', name: 'Truco do Boteco', stake: 50, bots: botsFor('tr-boteco') },
  { id: 'tr-praca', name: 'Truco da Praça', stake: 200, bots: botsFor('tr-praca') },
  { id: 'tr-ouro', name: 'Mesa de Ouro', stake: 1000, bots: botsFor('tr-ouro') },
  { id: 'tr-magnata', name: 'Truco do Magnata', stake: 5000, bots: botsFor('tr-magnata') },
];
export const PAY = 1.9;                // dupla vencedora: cada um leva 1,9x a entrada (5% fica com a casa)
let cur = null, view = null, hidden = false, paid = new Set();
const rid = () => Math.random().toString(36).slice(2, 8);
const me = () => { const p = profileOf(); return { name: p.name, look: p.look }; };
const RN = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' }, SN = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const src = c => `assets/cards/${RN[c.r] || c.r}_of_${SN[c.s]}.webp`;
const cardImg = (c, cls = '') => (c && !c.hidden ? `<img class="tr-card ${cls}" src="${src(c)}" alt="${c.r}${c.s}">` : `<span class="tr-card tr-card--back ${cls}"></span>`);
const lookOf = s => (s.kind === 'human' ? s.look : NPC.byNick(s.name)?.look || NPC_LOOKS.Dorival) || {};

// ---------- salão ----------
export function renderLobby() {
  const el = $('#tr-tables'); if (!el || $('#sub-truco').hidden) return;
  const online = C.peerList().flatMap(([pid, p]) => (p.games || []).filter(g => g.kind === 'truco').map(g => ({ ...g, host: p.profile?.name })));
  const card = (t, kind) => {
    const seats = t.seats || [{ name: 'seu lugar', free: true }, { name: t.bots[0] }, { name: t.bots[1] }, { name: t.bots[2] }];
    return `<article class="tcard3 tcard3--${kind === 'online' ? 'online' : ['bronze', 'prata', 'ouro', 'magnata'][HOUSE.indexOf(t)] || 'vip'}">
      <div class="tcard3__top"><span class="tcard3__live"><i></i>${kind === 'online' ? `online · ${esc(t.host || '')}` : 'truco paulista'}</span><span class="tcard3__stake">entrada ${int(t.stake)}</span></div>
      <div class="tcard3__table"><div class="tcard3__felt tr-felt-mini"><b>${esc(t.name)}</b><small>prêmio ${int(t.stake * PAY)} por jogador</small></div>
        ${seats.slice(0, 4).map((s, i) => `<span class="tcard3__seat tr-seat--${i}"><span class="tcard3__av${s.free ? ' tcard3__av--free' : ''}">${s.free ? '+' : avatarSVG(lookOf({ kind: s.kind || 'bot', name: s.name, look: s.look }), { label: s.name })}</span><em>${esc(s.name || 'livre')}</em></span>`).join('')}</div>
      <div class="tcard3__foot"><span class="muted small">${kind === 'online' ? `${t.humans} ${t.humans === 1 ? 'pessoa' : 'pessoas'} na mesa` : 'você + parceiro contra dupla'}</span>
        <button class="btn btn--gold" data-tr="${kind === 'online' ? 'join' : 'house'}" data-id="${esc(t.id)}">jogar</button></div></article>`;
  };
  el.innerHTML = online.map(t => card(t, 'online')).join('') + HOUSE.map(t => card(t, 'house')).join('');
}
G.gameHosts ??= {};
G.gameHosts.truco = () => (cur?.host && cur.pub && cur.engine ? { kind: 'truco', id: cur.id, name: cur.engine.name, stake: cur.engine.stake, humans: cur.engine.seats.filter(s => s.kind === 'human').length,
  seats: cur.engine.seats.map(s => ({ kind: s.kind === 'human' ? 'human' : 'bot', name: s.kind === 'empty' ? 'livre' : s.name, look: s.look, free: s.kind === 'empty' })) } : null);

// ---------- abrir mesa ----------
function show(on) { $('#tr-lobby').hidden = on; $('#tr-room').hidden = !on; }
export function sitHouse(id) {
  const def = HOUSE.find(t => t.id === id); if (!def) return;
  if ((G.S.chips || 0) < def.stake) return say(`Essa mesa pede ${int(def.stake)} fichas de entrada. Compre no caixa do cassino (aba vinte e um).`, true);
  leave(true);
  const e = new TR.Truco({ id: def.id, name: def.name, stake: def.stake, onChange: x => draw(x.view(0)) });
  e.botNames = [null, def.bots[0], def.bots[1], def.bots[2]];
  cur = { id: def.id, local: true, engine: e };
  e.join('me', me(), 0); show(true); e.start();
}
export async function host({ name, stake, pub }) {
  if ((G.S.chips || 0) < stake) return say(`Você precisa de ${int(stake)} fichas para a entrada.`, true);
  const id = rid(), conn = await openTableRoom(`truco-${id}`);
  if (!conn) return say('Sem conexão com a internet agora. Jogue numa mesa da casa.', true);
  leave(true);
  const self = conn.selfId;
  const e = new TR.Truco({ id, name: name || 'truco dos amigos', stake, onChange: x => { for (const [i, s] of x.seats.entries()) if (s.kind === 'human' && s.pid !== self) conn.state.send(x.view(i), { target: s.pid }); draw(x.view(x.seatOf(self))); C.announce(); } });
  cur = { id, host: true, pub, engine: e, conn };
  conn.act.onMessage = (m, { peerId }) => {
    if (m.t === 'join') { if (e.join(peerId, m.info) == null) conn.state.send({ full: true }, { target: peerId }); return; }
    if (m.t === 'leave') return e.leave(peerId);
    const s = e.seatOf(peerId); if (s >= 0) e.act(s, m);
  };
  conn.room.onPeerLeave = pid => e.leave(pid);
  e.join(self, me(), 0); show(true); C.announce(); invite();
}
export async function join(id) {
  id = String(id || '').trim().toLowerCase(); if (!id) return;
  const conn = await openTableRoom(`truco-${id}`);
  if (!conn) return say('Sem conexão com a internet agora.', true);
  leave(true);
  cur = { id, remote: true, conn, hostId: null }; show(true);
  $('#tr-msg').textContent = 'Procurando a mesa…';
  const ask = target => conn.act.send({ t: 'join', info: me() }, { target });
  conn.room.onPeerJoin = ask;
  conn.room.onPeerLeave = pid => { if (pid === cur?.hostId) { say('O anfitrião fechou a mesa de truco.', true); leave(); } };
  conn.state.onMessage = (v, { peerId }) => {
    if (cur?.conn !== conn) return;
    if (v.full) { say('Essa mesa está cheia.', true); return leave(); }
    if (v.closed) { say('O anfitrião fechou a mesa de truco.', true); return leave(); }
    cur.hostId = peerId; draw(v);
  };
  setTimeout(() => { if (cur?.conn === conn && !cur.hostId) { say('Mesa de truco não encontrada.', true); leave(); } }, 25000);
}
export function leave(silent) {
  const c = cur; if (!c) { if (!silent) show(false); return; }
  cur = null; view = null;
  if (c.engine) { if (c.host) { c.conn.state.send({ closed: true }); setTimeout(() => c.conn.room.leave(), 300); } c.engine.close(); }
  if (c.remote) { if (c.hostId) c.conn.act.send({ t: 'leave' }, { target: c.hostId }); setTimeout(() => c.conn.room.leave(), 300); }
  C.announce();
  if (!silent) { show(false); renderLobby(); }
}
export function invite() {
  if (!cur || cur.local) return;
  const url = `${location.origin}${location.pathname}?truco=${cur.id}`;
  navigator.clipboard?.writeText(url).then(() => say(`Link da mesa de truco copiado. Código: ${cur.id}`), () => say(`Código da mesa de truco: ${cur.id}`));
}
function send(a) {
  if (!cur) return;
  if (cur.engine) { const s = cur.local ? 0 : cur.engine.seatOf(cur.conn.selfId); const err = cur.engine.act(s, a); if (err) say(err[0].toUpperCase() + err.slice(1), true); }
  else if (cur.hostId) cur.conn.act.send(a, { target: cur.hostId });
}

// ---------- fichas: entrada ao começar, prêmio ao vencer (uma vez por partida) ----------
function money(v) {
  const key = `${v.id}:${v.games}`;
  if (v.seat < 0 || !v.games) return;
  if (v.phase !== 'wait' && !paid.has(`in:${key}`)) {
    paid.add(`in:${key}`);
    G.S.chips = Math.max(0, (G.S.chips || 0) - v.stake); note(`truco: entrada de ${int(v.stake)} fichas (${v.name})`); save(); G.render();
  }
  if (v.phase === 'gameEnd' && !paid.has(`out:${key}`)) {
    paid.add(`out:${key}`);
    const won = v.winner === TR.team(v.seat);
    if (won) { const p = Math.floor(v.stake * PAY); G.S.chips += p; note(`truco: venceu a partida, +${int(p)} fichas`); confetti(80); sfx.play('stack', 0.7); award('truco'); }
    G.S.stats ??= {}; G.S.stats.truco = (G.S.stats.truco || 0) + (won ? 1 : 0);
    save(); G.render();
  }
}

// ---------- desenhar ----------
let lastPhase = '', lastMsg = '';
function draw(v) {
  if (!v || !$('#tr-room')) return;
  view = v; money(v);
  const my = v.seat, rel = i => (i - (my < 0 ? 0 : my) + 4) % 4, h = v.hand;   // 0 = você (embaixo), 1 = direita, 2 = parceiro (em cima), 3 = esquerda
  const myTeam = TR.team(Math.max(0, my));
  $('#tr-name').textContent = v.name;
  $('#tr-score').innerHTML = `<span class="tr-sc tr-sc--us"><small>nós</small><b>${v.score[myTeam]}</b></span><span class="tr-sc__x">×</span><span class="tr-sc tr-sc--them"><small>eles</small><b>${v.score[1 - myTeam]}</b></span>`;
  // lugares
  $('#tr-seats').innerHTML = v.seats.map((s, i) => {
    const r = rel(i), n = h ? h.cards[i].length : 0, act = v.phase === 'play' && v.turn === i;
    return `<div class="tr-seat tr-pos--${r}${act ? ' is-turn' : ''}${TR.team(i) === myTeam ? ' is-us' : ''}">
      <span class="tr-av">${avatarSVG(lookOf(s), { label: s.name })}</span><b>${esc(s.kind === 'empty' ? 'livre' : s.name)}${i === my ? ' (você)' : ''}</b>
      ${r && h ? `<span class="tr-back">${h.cards[i].map(c => (c ? cardImg(c, 'tr-card--sm') : '<span class="tr-card tr-card--back tr-card--sm"></span>')).join('')}</span>` : ''}
      ${v.dealer === i ? '<i class="tr-dealer" title="quem deu as cartas">D</i>' : ''}</div>`;
  }).join('');
  // centro: vira, valor da mão e cartas jogadas
  $('#tr-center').innerHTML = h ? `<div class="tr-vira">${cardImg(h.vira)}<span>vira<b>manilha: ${h.mani}</b></span></div>
    <div class="tr-value"><small>a mão vale</small><b>${h.value}</b>${h.iron ? '<em>mão de ferro</em>' : h.onze != null ? '<em>mão de onze</em>' : ''}</div>
    <div class="tr-tricks">${[0, 1, 2].map(k => `<i class="${h.tricks[k] == null ? '' : h.tricks[k] === -1 ? 'is-tie' : h.tricks[k] === myTeam ? 'is-us' : 'is-them'}"></i>`).join('')}</div>
    ${h.table.map(p => `<div class="tr-played tr-pos--${rel(p.seat)}">${cardImg(p.card)}</div>`).join('')}` : '<p class="muted">A partida começa quando o anfitrião mandar.</p>';
  // minha mão e botões
  const mine = h && my >= 0 ? h.cards[my] : [], myTurn = v.phase === 'play' && v.turn === my;
  $('#tr-hand').innerHTML = mine.map((c, i) => `<button class="tr-mine${myTurn ? ' is-playable' : ''}" data-tr="play" data-id="${i}" ${myTurn ? '' : 'disabled'}>${cardImg(c)}${c && c.r === h.mani ? `<em>${TR.MANILHA_NAME[c.s]}</em>` : ''}</button>`).join('');
  const raiseTo = h?.raise?.to, mustAnswer = v.phase === 'raise' && my >= 0 && TR.team(my) !== h.raise.by, onze = v.phase === 'onze' && my >= 0 && TR.team(my) === h.onze;
  const next = h ? TR.RAISE_NAME[TR.nextValue(h.value)] : '';
  $('#tr-actions').innerHTML = mustAnswer
    ? `<button class="btn btn--gold btn--lg" data-tr="accept">aceitar (${raiseTo})</button>${raiseTo < 12 ? `<button class="btn btn--hot btn--lg" data-tr="raise">${TR.RAISE_NAME[TR.nextValue(raiseTo)]}!</button>` : ''}<button class="btn btn--glass btn--lg" data-tr="run">correr</button>`
    : onze ? '<button class="btn btn--gold btn--lg" data-tr="onze-play">jogar a mão de onze (vale 3)</button><button class="btn btn--glass btn--lg" data-tr="onze-run">correr (eles +1)</button>'
      : v.phase === 'gameEnd' || v.phase === 'wait' ? (cur?.engine ? `<button class="btn btn--gold btn--lg" data-tr="start">${v.phase === 'wait' ? 'começar a partida' : 'jogar de novo'} (entrada ${int(v.stake)})</button>` : '<p class="muted">Esperando o anfitrião começar.</p>')
        : `<button class="btn btn--hot btn--lg tr-truco" data-tr="truco" ${h?.canRaise ? '' : 'disabled'}>${next ? `${next}!` : 'truco!'}</button>
           <label class="tr-hide"><input type="checkbox" id="tr-hidden" ${hidden ? 'checked' : ''} ${h?.tricks.length ? '' : 'disabled'}> jogar encoberta</label>`;
  const msg = v.phase === 'play' ? (myTurn ? `Sua vez. ${v.msg}` : `Vez de ${v.seats[v.turn]?.name}. ${v.msg}`) : v.msg;
  $('#tr-msg').textContent = msg;
  if (v.phase === 'raise' && lastPhase !== 'raise') { sfx.play('stack', 0.6); $('#tr-room').classList.remove('is-shout'); void $('#tr-room').offsetWidth; $('#tr-room').classList.add('is-shout'); }
  if (msg !== lastMsg && v.phase === 'play' && v.hand?.table.length) sfx.play('chip', 0.35);
  if (v.phase === 'gameEnd' && lastPhase !== 'gameEnd' && v.winner === myTeam) say('Vocês venceram a partida de truco!');
  $('#tr-shout').textContent = v.phase === 'raise' ? `${TR.RAISE_NAME[raiseTo].toUpperCase()}!` : '';
  $('#tr-invite').hidden = !!cur?.local;
  lastPhase = v.phase; lastMsg = msg;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-tr]'); if (!b || b.disabled) return;
  const a = b.dataset.tr;
  if (a === 'house') return sitHouse(b.dataset.id);
  if (a === 'join') return join(b.dataset.id);
  if (a === 'leave') return leave();
  if (a === 'invite') return invite();
  if (a === 'create') { const f = $('#tr-create'); return host({ name: f.tname.value.trim(), stake: Number(f.tstake.value), pub: f.tvis.value === 'pub' }); }
  if (a === 'code') return join($('#tr-code').value);
  if (a === 'start') {
    if ((G.S.chips || 0) < (view?.stake || 0)) return say(`Você precisa de ${int(view.stake)} fichas para a entrada.`, true);
    return send({ t: 'start' });
  }
  if (a === 'play') { send({ t: 'play', i: Number(b.dataset.id), hidden }); hidden = false; return; }
  send({ t: a });
});
document.addEventListener('change', e => { if (e.target.id === 'tr-hidden') hidden = e.target.checked; });
setInterval(renderLobby, 5000);
const q = new URLSearchParams(location.search).get('truco');
if (q) setTimeout(() => { G.goto?.('mesa'); document.querySelector('[data-sub="truco"]')?.click(); join(q); }, 2500);
