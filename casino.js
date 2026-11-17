// Cassino: salão de mesas (bots + online), a mesa animada e a cola com a rede.
import * as L from './logic.js';
import { Table } from './table.js';
import { openLobby, openTableRoom, net } from './net.js';
import { NPC_LOOKS, avatarSVG } from './avatar.js';
import { G, $, esc, int, ms, sleep, say, save, award, profileOf, confetti } from './store.js';
import * as sfx from './sfx.js';
import * as Auth from './auth.js';

const SOLO = [
  { id: 'bot-dorival', name: 'Mesa do Dorival', minBet: 50 },
  { id: 'bot-azul', name: 'Salão azul', minBet: 100 },
  { id: 'bot-vip', name: 'Mesa VIP', minBet: 1000 },
];
let lobby = null, selfId = null;
let cur = null;          // mesa aberta
let prev = null;         // último estado desenhado
let betAmt = 0;
const marks = { bet: null, pay: null };

// ---------- fichas ----------
export function chipsHTML(n, max = 7) {
  const cols = Object.entries(L.breakChips(n)).sort((a, b) => b[0] - a[0]);
  return `<span class="chips">${cols.map(([d, k]) => `<span class="chips__col">${
    Array.from({ length: Math.min(k, max) }, (_, i) => `<i class="chip chip--${d}" style="--i:${i}"><b>${d >= 1000 ? '1k' : d}</b></i>`).join('')}</span>`).join('')}</span>`;
}
// posições no plano do feltro (antes da perspectiva): assim as fichas e cartas andam deitadas na mesa
function center(el) {
  const felt = $('#felt');
  let x = el.offsetWidth / 2, y = el.offsetHeight / 2;
  while (el && el !== felt) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
  return { x, y };
}
function fly(html, from, to, { dur = 520, delay = 0, sound = 'chip' } = {}) {
  const a = center(from), b = center(to);
  const g = document.createElement('div');
  g.className = 'ghost'; g.innerHTML = html;
  g.style.left = `${a.x}px`; g.style.top = `${a.y}px`;
  $('#felt').append(g);
  setTimeout(() => sfx.play(sound, 0.5), ms(delay));
  return g.animate([{ transform: 'translate(-50%,-50%) translateZ(0)' },
    { transform: `translate(calc(-50% + ${(b.x - a.x) / 2}px), calc(-50% + ${(b.y - a.y) / 2}px)) translateZ(3cqw)`, offset: 0.5 },
    { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) translateZ(0)` }],
  { duration: ms(dur), delay: ms(delay), easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' }).finished.then(() => g.remove());
}

// ---------- salão ----------
const myPid = () => (cur?.local ? 'me' : selfId);
const seatInfo = () => { const p = profileOf(); return { name: p.name, look: p.look, profile: p }; };
const rid = () => Math.random().toString(36).slice(2, 8);

export async function initCasino() {
  // bandeja do dealer: cada canaleta com fichas deitadas de lado, como nas mesas de verdade
  $('#rack').innerHTML = [1000, 500, 100, 100, 25, 25, 5, 5].map(d => `<span class="rack__slot"><i class="rack__chips chip--${d}"></i></span>`).join('');
  renderLobby();
  lobby = await openLobby(() => renderLobby());
  selfId = lobby?.selfId || (await net())?.selfId || 'me';
  $('#online').innerHTML = lobby ? '<i class="is-on"></i>salão online' : '<i></i>sem conexão: só mesas com bots';
  announce();
  renderLobby();
  G.onLogin = loadGlobalRanking; loadGlobalRanking(); setInterval(loadGlobalRanking, 90000);
  const code = new URLSearchParams(location.search).get('mesa');
  if (code) { G.goto('mesa'); joinOnline(code); }
}

let globalRows = null;
function loadGlobalRanking() { if (!Auth.account()) return; Auth.ranking().then(rows => { if (rows) { globalRows = rows; renderLobby(); } }).catch(() => {}); }
let annTimer;
export function announce() {
  clearTimeout(annTimer);
  annTimer = setTimeout(() => {
    if (!lobby) return;
    const tables = cur?.host && cur.pub ? [summary(cur.table.view())] : [];
    lobby.announce({ profile: profileOf(), tables });
  }, 400);
}
const summary = v => ({ id: v.id, name: v.name, minBet: v.minBet, phase: v.phase,
  seats: v.seats.map(s => ({ kind: s.kind, name: s.name, look: s.look })) });

function tableCard(t, kind, host) {
  const seats = t.seats || [0, 1, 2, 3].map(i => ({ kind: 'bot', name: ['Dorival', 'Rosa', 'Tião', 'Neide'][i] }));
  const humans = seats.filter(s => s.kind === 'human').length;
  return `<article class="tcard2 ${kind === 'online' ? 'is-online' : ''}">
    <div class="tcard2__felt"><span class="tag ${kind === 'online' ? 'tag--green' : 'tag--dark'}">${kind === 'online' ? `online, ${humans} ${humans === 1 ? 'jogador' : 'jogadores'}` : 'com bots'}</span>
      <span class="tag tag--gold">mínima ${int(t.minBet)}</span></div>
    <div class="tcard2__body">
      <h4>${esc(t.name)}</h4>
      <p class="muted small">${host ? `anfitrião: ${esc(host)}` : 'jogue agora, sem esperar ninguém'}</p>
      <ul class="seatdots">${seats.map(s => `<li class="${s.kind}" title="${esc(s.name)}">${s.kind === 'human' && s.look ? avatarSVG(s.look, { label: s.name }) : ''}</li>`).join('')}</ul>
      <button class="btn ${kind === 'online' ? 'btn--gold' : 'btn--glass'}" data-act="sit" data-kind="${kind}" data-id="${esc(t.id)}">sentar</button>
    </div></article>`;
}

export function renderLobby() {
  const peers = lobby ? [...lobby.peers.entries()] : [];
  const online = peers.flatMap(([pid, p]) => (p.tables || []).map(t => ({ t, host: p.profile?.name, pid })));
  $('#tables').innerHTML = [
    ...online.map(o => tableCard(o.t, 'online', o.host)),
    ...SOLO.map(t => tableCard(t, 'solo')),
  ].join('');
  if (lobby) $('#online').innerHTML = `<i class="is-on"></i>${peers.length + 1} ${peers.length ? 'jogadores' : 'jogador'} no salão`;
  const people = [{ pid: 'me', p: profileOf() }, ...peers.filter(([, p]) => p.profile).map(([pid, p]) => ({ pid, p: p.profile }))]
    .sort((a, b) => b.p.worth - a.p.worth).slice(0, 8);
  const cloud = Auth.account() ? globalRows : null;
  const list = cloud ? cloud.map(r => ({ pid: r.user_id === Auth.account().id ? 'me' : '', p: { name: r.name, level: r.level, rank: r.rank || '', worth: Number(r.worth), look: r.look || {} } })) : people;
  $('#ranking-title').textContent = cloud ? 'ranking global (não oficial)' : 'ranking do salão';
  $('#ranking').innerHTML = list.map((x, i) => `<li><button class="rk" ${x.pid ? `data-profile="${x.pid}"` : 'disabled'}>
    <span class="rk__pos">${i + 1}</span><span class="rk__av">${avatarSVG(x.p.look, { label: x.p.name })}</span>
    <span class="rk__name">${esc(x.p.name)}${x.pid === 'me' ? ' <small>você</small>' : ''}<small>nível ${x.p.level}, ${esc(x.p.rank)}</small></span>
    <span class="rk__worth">${new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(x.p.worth)}</span></button></li>`).join('');
}

export function findProfile(pid) {
  if (pid === 'me') return profileOf();
  const p = lobby?.peers.get(pid)?.profile;
  if (p) return p;
  return prev?.seats.find(s => s.pid === pid)?.profile || null;
}

// ---------- entrar / sair ----------
function openRoom(name, tag, invite) {
  $('#lobby').hidden = true; $('#room').hidden = false;
  $('#room-name').textContent = name; $('#room-tag').textContent = tag;
  $('#invite-btn').hidden = !invite;
  prev = null; betAmt = 0; marks.bet = marks.pay = null;
  clearTable(); showBet();
}

export function sitSolo(id) {
  const def = SOLO.find(t => t.id === id);
  cur = { id, local: true, name: def.name };
  openRoom(def.name, 'com bots', false);
  cur.table = new Table({ ...def, onChange: v => applyView(v) });
  cur.table.join('me', seatInfo());
}

export async function hostOnline({ name, minBet, pub }) {
  const tid = rid();
  const conn = await openTableRoom(tid);
  if (!conn) return say('Sem conexão com a internet. Jogue numa mesa com bots.', true);
  leaveTable(true);
  cur = { id: tid, host: true, pub, name, conn };
  const { state, act, room } = conn;
  cur.table = new Table({ id: tid, name, minBet, onChange: v => { state.send(v); applyView(v); announce(); } });
  act.onMessage = (m, { peerId }) => {
    if (m.t === 'join') cur.table.join(peerId, m.info);
    if (m.t === 'bet') cur.table.bet(peerId, m.amount);
    if (m.t === 'hit' || m.t === 'stand') cur.table.act(peerId, m.t);
    if (m.t === 'leave') cur.table.leave(peerId);
    if (m.t === 'info') cur.table.update(peerId, m.info);
  };
  room.onPeerJoin = pid => state.send(cur.table.view(), { target: pid });
  room.onPeerLeave = pid => cur?.table?.leave(pid);
  openRoom(name, `${pub ? 'online, no salão' : 'online, só convite'}, código ${tid}`, true);
  cur.table.join(selfId, seatInfo());
  announce();
  invite();
}

export async function joinOnline(id) {
  id = String(id).trim().toLowerCase();
  if (!id) return;
  const conn = await openTableRoom(id);
  if (!conn) return say('Sem conexão com a internet.', true);
  leaveTable(true);
  cur = { id, remote: true, conn, name: 'mesa online', hostId: null };
  openRoom('conectando à mesa…', `código ${id}`, true);
  $('#tstatus').textContent = 'Procurando o anfitrião da mesa…';
  const join = target => conn.act.send({ t: 'join', info: seatInfo() }, { target });
  conn.room.onPeerJoin = pid => join(pid);
  conn.room.onPeerLeave = pid => { if (pid === cur?.hostId) { say('O anfitrião fechou a mesa.', true); leaveTable(); } };
  conn.state.onMessage = (v, { peerId }) => {
    if (cur?.conn !== conn) return;
    if (v.closed) { say('O anfitrião fechou a mesa.', true); return leaveTable(); }
    cur.hostId = peerId;
    $('#room-name').textContent = v.name;
    if (!v.seats.some(s => s.pid === selfId) && !cur.asked) { cur.asked = true; join(peerId); }
    applyView(v);
  };
  setTimeout(() => { if (cur?.conn === conn && !cur.hostId) { say('Mesa não encontrada. Confira o código.', true); leaveTable(); } }, 25000);
}

export function leaveTable(silent) {
  if (!cur) return;
  const c = cur; cur = null;
  if (c.local) c.table.close();
  if (c.host) { c.conn.state.send({ closed: true }); c.table.close(); setTimeout(() => c.conn.room.leave(), 300); }
  if (c.remote) { if (c.hostId) c.conn.act.send({ t: 'leave' }, { target: c.hostId }); setTimeout(() => c.conn.room.leave(), 300); }
  announce();
  if (!silent) { $('#room').hidden = true; $('#lobby').hidden = false; renderLobby(); }
}

export function invite() {
  if (!cur || cur.local) return;
  const url = `${location.origin}${location.pathname}?mesa=${cur.id}`;
  navigator.clipboard?.writeText(url).then(() => say(`Link copiado. Mande para os amigos. Código: ${cur.id}`), () => say(`Código da mesa: ${cur.id}`));
}

let infoTimer;
export function updateInfo() {
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => send('info', { info: seatInfo() }), 500);
}

function send(t, extra = {}) {
  if (!cur) return;
  if (cur.table) {
    if (t === 'bet') cur.table.bet(myPid(), extra.amount);
    else if (t === 'info') cur.table.update(myPid(), extra.info);
    else cur.table.act(myPid(), t);
  } else if (cur.hostId) cur.conn.act.send({ t, ...extra }, { target: cur.hostId });
}

// ---------- apostas ----------
export function addBet(n) { if (!prev || mySeat(prev)?.bet) return; betAmt += n; showBet(); sfx.play('stack', 0.4); }
export const phase = () => prev?.phase;
export function clearBet() { betAmt = 0; showBet(); }
function showBet() { $('#betshow').textContent = int(betAmt); }
export function placeBet() {
  const v = prev, s = mySeat(v);
  if (!s) return say('Você senta na próxima rodada.', true);
  if (v.phase !== 'bet' || s.bet) return;
  if (betAmt < v.minBet) return say(`A aposta mínima desta mesa é ${int(v.minBet)} fichas.`, true);
  if (betAmt > G.S.chips) return say('Fichas insuficientes. Compre no caixa ao lado.', true);
  send('bet', { amount: betAmt });
}
export const hit = () => send('hit');
export const stand = () => send('stand');

// ---------- desenhar a mesa a partir do estado ----------
const mySeat = v => v?.seats.find(s => s.kind === 'human' && s.pid === myPid());
const seatIdx = v => v.seats.findIndex(s => s.kind === 'human' && s.pid === myPid());
const shown = [[], [], [], []];   // cartas já desenhadas por lugar

function clearTable() {
  $('#seats').innerHTML = [0, 1, 2, 3].map(i => `<li class="seat seat--${i}" id="seat-${i}">
    <div class="seat__cards" id="cards-${i}"></div>
    <div class="spot" id="spot-${i}"><span class="spot__mark" aria-hidden="true"></span><span class="spot__chips"></span><span class="spot__amt"></span></div>
    <div class="seat__tags upright"><span class="seat__val" id="val-${i}" hidden></span><span class="seat__result" id="res-${i}" hidden></span></div>
    <button class="seat__who" data-profile=""><span class="plate"></span><span class="seat__timer" aria-hidden="true"><i></i></span></button></li>`).join('');
  shown.forEach(a => (a.length = 0));
  $('#banner').hidden = true;
}

// baralho real (Byron Knoll, domínio público) em assets/cards
const RANK = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' }, SUIT = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const cardSrc = c => `assets/cards/${RANK[c.r] || c.r}_of_${SUIT[c.s]}.webp`;
function cardEl(c) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.setProperty('--rot', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
  el.innerHTML = `<div class="card__in"><div class="card__face"><img src="${cardSrc(c)}" alt="${c.r}${c.s}" draggable="false"></div><div class="card__back"></div></div>`;
  return el;
}

function applyView(v) {
  const p = prev; prev = v;
  const me = seatIdx(v);
  const reveal = v.phase === 'done';

  v.seats.forEach((s, i) => {
    const seat = $(`#seat-${i}`);
    const sig = `${s.kind}|${s.pid}|${s.name}|${JSON.stringify(s.look || '')}`;
    if (seat.dataset.sig !== sig) {
      seat.dataset.sig = sig;
      seat.querySelector('.plate').innerHTML = `${esc(s.name)}${s.kind === 'bot' ? ' <small>bot</small>' : i === me && s.name !== 'você' ? ' <small>você</small>' : ''}`;
      seat.querySelector('.seat__who').dataset.profile = s.kind === 'human' ? (i === me ? 'me' : s.pid) : '';
      seat.classList.toggle('seat--you', i === me);
      seat.classList.toggle('seat--human', s.kind === 'human' && i !== me);
    }
    seat.classList.toggle('is-turn', v.phase === 'play' && v.turn === i);
    seat.classList.toggle('is-out', !!s.out && v.phase !== 'bet');

    // aposta: fichas saem do jogador para o círculo
    const spot = $(`#spot-${i}`);
    if (s.bet && !spot.dataset.bet && v.phase !== 'done') {
      spot.dataset.bet = s.bet;
      fly(chipsHTML(s.bet, 3), seat.querySelector('.seat__who'), spot).then(() => {
        spot.querySelector('.spot__chips').innerHTML = chipsHTML(s.bet);
        spot.querySelector('.spot__amt').textContent = int(s.bet);
      });
    }

    // cartas novas voam do sapato
    const box = $(`#cards-${i}`);
    if (s.hand.length < shown[i].length) { box.innerHTML = ''; shown[i].length = 0; }
    s.hand.slice(shown[i].length).forEach((c, k) => {
      const j = shown[i].length; shown[i].push(c);
      const el = cardEl(c); box.append(el);
      const up = i === me || j === 0 || reveal;
      const a = center($('#shoe')), b = center(el), dx = a.x - b.x, dy = a.y - b.y;
      setTimeout(() => sfx.play('slide', 0.55), ms(k * 150));
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) translateZ(0) rotate(-35deg)`, opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) translateZ(2.5cqw) rotate(-12deg)`, offset: 0.55 },
        { transform: 'none', opacity: 1 }],
      { duration: ms(520), delay: ms(k * 150), easing: 'cubic-bezier(.25,.75,.3,1)', fill: 'backwards' })
        .finished.then(() => { if (up) { el.classList.add('is-up'); sfx.play('place', 0.35); } });
    });
    if (reveal) box.querySelectorAll('.card').forEach(c => c.classList.add('is-up'));

    const val = $(`#val-${i}`), hv = L.handValue(s.hand), hide = !(i === me || reveal);
    val.hidden = !s.hand.length;
    val.textContent = hide ? '?' : hv;
    val.classList.toggle('is-bust', !hide && hv > 21);
    val.classList.toggle('is-21', !hide && hv === 21);
  });

  if (v.phase === 'deal' && p?.phase === 'bet') sfx.play('shuffle', 0.5);
  // anel de tempo em volta de quem está jogando
  v.seats.forEach((s, i) => {
    const t = $(`#seat-${i} .seat__timer`);
    const on = v.phase === 'play' && v.turn === i && s.kind === 'human' && v.deadline;
    t.classList.toggle('is-on', !!on);
    if (on) { const i2 = t.querySelector('i'); i2.style.animation = 'none'; void i2.offsetWidth; i2.style.animation = ''; t.style.setProperty('--left', `${Math.max(0, v.deadline - Date.now())}ms`); }
  });
  if (v.phase === 'done' && p?.phase !== 'done') settleAnim(v, me);
  if (v.phase === 'bet' && p && p.phase !== 'bet') sweep();
  accounting(v, me);
  status(v, me);
  whoList(v, me);
}

// fim da mão: o dealer recolhe quem perdeu e paga quem ganhou, depois o jogador puxa as fichas
async function settleAnim(v, me) {
  const rack = $('#rack');
  await sleep(500);
  v.seats.forEach((s, i) => {
    if (s.out) return;
    const res = $(`#res-${i}`), hv = L.handValue(s.hand);
    res.hidden = false;
    res.textContent = s.pay ? `+${int(s.pay)}` : hv > 21 ? 'estourou' : 'perdeu';
    res.className = `seat__result ${s.pay ? 'is-win' : 'is-lose'}`;
    $(`#seat-${i}`).classList.toggle('is-winner', s.pay > 0);
  });
  await Promise.all(v.seats.map((s, i) => {
    if (s.out || s.pay) return null;
    const spot = $(`#spot-${i}`);
    const html = spot.querySelector('.spot__chips').innerHTML;
    spot.querySelector('.spot__chips').innerHTML = ''; spot.querySelector('.spot__amt').textContent = '';
    return html && fly(html, spot, rack, { dur: 600, delay: i * 90, sound: 'chips' });
  }));
  await Promise.all(v.seats.map((s, i) => s.pay && fly(chipsHTML(s.pay, 4), rack, $(`#spot-${i}`), { dur: 600, delay: i * 90, sound: 'stack' })
    .then(() => { const sp = $(`#spot-${i}`); sp.querySelector('.spot__chips').innerHTML = chipsHTML(s.pay); sp.querySelector('.spot__amt').textContent = int(s.pay); })));
  if (me >= 0 && !v.seats[me].out) {
    const s = v.seats[me], diff = s.pay - s.bet, b = $('#banner');
    b.hidden = false;
    b.className = `banner ${diff > 0 ? 'is-win' : diff === 0 ? 'is-even' : 'is-lose'}`;
    b.innerHTML = diff > 0 ? `<strong>você venceu</strong><span>+${int(s.pay)} fichas</span>`
      : diff === 0 ? '<strong>empate</strong><span>aposta de volta</span>' : `<strong>não foi desta vez</strong><span>−${int(s.bet)} fichas</span>`;
    if (diff >= s.bet) confetti(50);
  }
  await sleep(1600);
  await Promise.all(v.seats.map((s, i) => {
    if (!s.pay) return null;
    const spot = $(`#spot-${i}`), html = spot.querySelector('.spot__chips').innerHTML;
    spot.querySelector('.spot__chips').innerHTML = ''; spot.querySelector('.spot__amt').textContent = '';
    return fly(html, spot, $(`#seat-${i} .seat__who`), { dur: 600, sound: 'handle' });
  }));
}

function sweep() {
  for (let i = 0; i < 4; i++) {
    const box = $(`#cards-${i}`);
    box.querySelectorAll('.card').forEach((c, k) => c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-2cqw) scale(.9)' }], { duration: ms(300), delay: ms(k * 40), fill: 'forwards' }));
    setTimeout(() => { box.innerHTML = ''; }, ms(450));
    shown[i].length = 0;
    const spot = $(`#spot-${i}`);
    delete spot.dataset.bet; spot.querySelector('.spot__chips').innerHTML = ''; spot.querySelector('.spot__amt').textContent = '';
    $(`#res-${i}`).hidden = true; $(`#val-${i}`).hidden = true;
    $(`#seat-${i}`).classList.remove('is-winner');
  }
  $('#banner').hidden = true;
  betAmt = 0; showBet();
}

// as fichas são de cada jogador: desconta a aposta e credita o prêmio uma vez por rodada
function accounting(v, me) {
  if (me < 0) return;
  const s = v.seats[me], key = `${v.id}:${v.phase === 'bet' ? v.round + 1 : v.round}`;
  if (s.bet && marks.bet !== key) { marks.bet = key; G.S.chips -= s.bet; save(); G.render(); }
  if (v.phase === 'done' && !s.out && marks.pay !== `${v.id}:${v.round}`) {
    marks.pay = `${v.id}:${v.round}`;
    G.S.chips += s.pay;
    const st = G.S.stats;
    st.hands++; if (s.pay > s.bet) { st.wins++; st.best = Math.max(st.best, s.pay - s.bet); }
    award('hand');
    if (s.pay > s.bet) award('win');
    if (L.handValue(s.hand) === 21) award('21');
    if (!cur?.local) award('onlineHand');
    save(); G.render(); announce();
  }
}

let countdown;
function status(v, me) {
  const s = me >= 0 ? v.seats[me] : null, el = $('#tstatus');
  const t = () => (v.deadline ? Math.max(0, Math.ceil((v.deadline - Date.now()) / 1000)) : 0);
  const text = () => {
    if (!s) return 'Você senta na próxima rodada.';
    if (v.phase === 'bet') return s.bet ? `Aposta feita. ${v.deadline ? `Começa em ${t()} s.` : 'Aguardando a mesa.'}` : `Monte sua aposta com as fichas e aposte. Mínimo ${int(v.minBet)}.${v.deadline ? ` Fecha em ${t()} s.` : ''}`;
    if (v.phase === 'deal') return 'O dealer está dando as cartas.';
    if (v.phase === 'play') return v.turn === me ? `Sua vez: ${L.handValue(s.hand)} pontos. ${t()} s para decidir.` : `Vez de ${v.seats[v.turn]?.name}.`;
    return 'Fim da rodada. A próxima começa já.';
  };
  el.textContent = text();
  clearInterval(countdown);
  if (v.deadline) countdown = setInterval(() => { if (prev === v) el.textContent = text(); }, 1000);
  const myTurn = v.phase === 'play' && v.turn === me;
  $('[data-act="bet"]').disabled = !s || v.phase !== 'bet' || !!s.bet;
  $('[data-act="hit"]').disabled = !myTurn;
  $('[data-act="stand"]').disabled = !myTurn;
}

function whoList(v, me) {
  $('#who-list').innerHTML = v.seats.map((s, i) => `<li><button class="who" ${s.kind === 'human' ? `data-profile="${i === me ? 'me' : s.pid}"` : 'disabled'}>
    <span class="who__av">${avatarSVG(s.kind === 'bot' ? NPC_LOOKS[s.name] || NPC_LOOKS.Dorival : s.look, { label: s.name })}</span>
    <span>${esc(s.name)}${i === me && s.name !== 'você' ? ' (você)' : ''}</span><small>${s.kind === 'bot' ? 'bot' : `nível ${s.profile?.level ?? 1}`}</small></button></li>`).join('');
}

export const inTable = () => !!cur;
export const busyRound = () => !!prev && cur && ['deal', 'play'].includes(prev.phase) && !!mySeat(prev)?.bet;
