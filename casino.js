// Cassino: salão de mesas (bots + online), a mesa animada e a cola com a rede.
import * as L from './logic.js';
import { Table } from './table.js';
import { openLobby, openTableRoom, net } from './net.js';
import { NPC_LOOKS, avatarSVG } from './avatar.js';
import { G, $, esc, int, ms, sleep, say, save, award, profileOf, confetti, every } from './store.js';
import * as sfx from './sfx.js';
import * as Auth from './auth.js';
import * as Live from './live.js';
import { botsFor, sitting } from './botpool.js';
import * as W from './world.js';
import { luck } from './perks.js';
import { BJ_XP_CHANCE } from './progress.js';
import * as RV from './rivals.js';
import * as SH from './shop.js';
import * as NPC from './npcs.js';
import * as BJ from './bj.js';

const SOLO = [
  { id: 'bot-dorival', name: 'Mesa Bronze', minBet: 50, bots: botsFor('bot-dorival') },
  { id: 'bot-azul', name: 'Mesa Prata', minBet: 100, bots: botsFor('bot-azul') },
  { id: 'bot-porto', name: 'Mesa Ouro', minBet: 250, bots: botsFor('bot-porto') },
  { id: 'bot-esm', name: 'Salão Esmeralda', minBet: 500, bots: botsFor('bot-esm') },
  { id: 'bot-vip', name: 'Mesa VIP', minBet: 1000, bots: botsFor('bot-vip') },
  { id: 'bot-dia', name: 'Sala Diamante', minBet: 2500, bots: botsFor('bot-dia') },
  { id: 'bot-high', name: 'High Roller', minBet: 5000, bots: botsFor('bot-high') },
  { id: 'bot-mag', name: 'Mesa do Magnata', minBet: 10000, bots: botsFor('bot-mag') },
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
// mãos ganhas no ano do mundo: passou de BJ.WINS_PER_YEAR, a banca leva todas (bj.js)
const bjYear = () => Math.floor(((G.S.month || 1) - 1) / 12);
const bjLucky = () => { const w = G.S.bjWin; return !w || w.y !== bjYear() || w.n < BJ.WINS_PER_YEAR; };
const seatInfo = () => { const p = profileOf(); return { name: p.name, look: p.look, profile: p, lucky: bjLucky() }; };
const rid = () => Math.random().toString(36).slice(2, 8);

export async function initCasino() {
  // bandeja do dealer: cada canaleta com fichas deitadas de lado, como nas mesas de verdade
  $('#rack').innerHTML = [1000, 500, 100, 100, 25, 25, 5, 5].map(d => `<span class="rack__slot"><i class="rack__chips chip--${d}"></i></span>`).join('');
  renderLobby();
  lobby = await openLobby(() => { renderLobby(); G.onPeers?.(); });
  if (lobby) G.onLobby?.(lobby);
  selfId = lobby?.selfId || (await net())?.selfId || 'me';
  $('#online').innerHTML = lobby ? '<i class="is-on"></i>salão online' : '<i></i>sem conexão: só mesas rápidas';
  announce();
  renderLobby();
  G.onLogin = loadGlobalRanking; loadGlobalRanking(); every(180000, loadGlobalRanking);
  Auth.onRankChange(loadGlobalRanking);
  setInterval(() => { NPC.CLOCK.real = Math.max(Live.realOnline(), (lobby?.peers.size || 0) + 1); if (!$('#lobby').hidden && $('#lobby-hero')) $('#lobby-hero').innerHTML = lobbyHero(NPC.onlineTotal(Live.now())); renderRanking(); if (lobby) $('#online').innerHTML = `<i class="is-on"></i>${NPC.onlineTotal(Live.now())} jogadores online`; }, 4000);   // os números do mundo andam sozinhos
  G.onRender = renderRanking;
  const code = new URLSearchParams(location.search).get('mesa');
  if (code) { G.goto('mesa'); joinOnline(code); }
}

let globalRows = null;
function loadGlobalRanking() { if (!Auth.account()) return; Auth.ranking(55000).then(rows => { if (rows) { globalRows = rows; renderRanking(); } }).catch(() => {}); }
let annTimer;
// outros jogos (truco, sinuca) leem quem está no salão por aqui
export const peerList = () => (lobby ? [...lobby.peers.entries()] : []);
export const selfPid = () => selfId;
// senha das mesas criadas por jogadores: o anfitrião confere; quem erra recebe { badpass } e pode tentar de novo
export const passOk = (pw, m) => !pw || String(m?.pass ?? '') === pw;
export function askPass(again) { const p = prompt(again ? 'Senha errada. Digite de novo a senha da mesa:' : 'Esta mesa tem senha. Digite a senha:'); return p == null ? null : p.trim(); }
export const lockTag = t => (t?.lock ? '<span class="tlock" title="mesa com senha">🔒</span> ' : '');
let play = { game: null };
// cada jogo avisa aqui onde você está e a aposta da vez; vai junto no anúncio do salão para os outros verem
export function setPlay(patch) { const n = { ...play, ...patch }; if (JSON.stringify(n) !== JSON.stringify(play)) { play = n; announce(); } }
export const playersIn = game => peerList().filter(([, p]) => p.play?.game === game && p.profile).map(([pid, p]) => ({ pid, name: p.profile.name, look: p.profile.look, bet: Number(p.play.bet) || 0, out: Number(p.play.out) || 0 }));
// cota do servidor: cada anúncio vai para TODOS do salão (presença). Antes saía a cada jogada (400 ms) e era o maior gasto de
// tráfego; agora no máximo 1 a cada 12 s, e só quando mudou de verdade
let annAt = 0, annLast = '';
export function announce() {
  if (annTimer) return;
  annTimer = setTimeout(() => {
    annTimer = 0; if (!lobby) return;
    const tables = cur?.host && cur.pub ? [summary(cur.table.view())] : [];
    const games = Object.values(G.gameHosts || {}).map(f => f()).filter(Boolean);   // mesas de truco e sinuca que eu hospedo
    const d = { profile: profileOf(), tables, games, shop: SH.publicListings(G.S), play }, k = JSON.stringify(d);
    if (k === annLast) return; annLast = k; annAt = Date.now(); lobby.announce(d);
  }, annAt ? Math.max(400, 12000 - (Date.now() - annAt)) : 400);
}
const summary = v => ({ id: v.id, lock: !!cur?.pass, name: v.name, minBet: v.minBet, phase: v.phase, house: cur?.house || null,
  seats: v.seats.map(s => ({ kind: s.kind, name: s.name, look: s.look })) });

const TIERS = ['bronze', 'prata', 'ouro', 'esmeralda', 'vip', 'diamante', 'high', 'magnata'];
const lookOf = s => (s.kind === 'human' ? s.look : NPC.byNick(s.name)?.look || NPC_LOOKS.Dorival);
function tableCard(t, kind, host) {
  const seats = (t.seats || sitting(t.id || 'am-21').map(name => ({ kind: 'bot', name }))).filter(s => !s.absent);
  const humans = seats.filter(s => s.kind === 'human').length, tier = kind === 'online' ? 'online' : TIERS[SOLO.indexOf(t)] || 'bronze';
  const pot = Math.round(t.minBet * (6 + ((Live.now() / 60000 + t.minBet) % 9)));   // fichas em jogo agora, mexe com o tempo
  return `<article class="tcard3 tcard3--${tier}">
    <div class="tcard3__top"><span class="tcard3__live"><i></i>${kind === 'online' ? `online · ${humans} ${humans === 1 ? 'jogador' : 'jogadores'}` : 'ao vivo'}</span><span class="tcard3__stake">${int(t.minBet)} / ${int(t.minBet * 20)}</span></div>
    <div class="tcard3__table"><div class="tcard3__felt"><b>${lockTag(t)}${esc(t.name)}</b><small>${int(pot)} fichas na mesa</small></div>
      ${seats.slice(0, 5).map((s, i) => `<span class="tcard3__seat tcard3__seat--b${i}${s.kind === 'human' ? ' is-human' : ''}" title="${esc(s.name)}"><span class="tcard3__av">${avatarSVG(lookOf(s) || {}, { label: s.name })}</span><em>${esc(s.name)}</em></span>`).join('')}
      <span class="tcard3__seat tcard3__seat--you"><span class="tcard3__av tcard3__av--free">+</span><em>seu lugar</em></span></div>
    <div class="tcard3__foot"><span class="muted small">${host ? `anfitrião: ${esc(host)}` : `${seats.length ? `${seats.length} da casa sentados · mesa quase livre` : 'mesa livre para você'}`}</span>
      ${kind === 'online' ? `<button class="btn btn--glass btn--sm" data-c21="watch" data-id="${esc(t.id)}">assistir</button>` : ''}<button class="btn ${kind === 'online' || SOLO.indexOf(t) < 2 ? 'btn--gold' : 'btn--glass'}" data-act="sit" data-kind="${kind}" data-id="${esc(t.id)}">jogar</button></div></article>`;
}
// faixa do salão: online, pote do dia e prêmios recentes dos jogadores
function lobbyHero(on) {
  const now = Live.now(), day = Math.floor((now - 3 * 3600e3) / 864e5), sinceDay = ((now - 3 * 3600e3) % 864e5) / 864e5;
  const jackpot = Math.round(20000 + sinceDay * 160000 + (day % 7) * 4000);
  // prêmios recentes: um ou outro de vez em quando, só nas mesas de baixo (até a VIP) e com prêmio do tamanho da aposta
  const slot = Math.floor(now / 45000), ids = [...NPC.onlineSet(now)].filter(id => !NPC.FALLEN.has(id)), rr = k => { const x = Math.sin((slot * 7 + k) * 91.7) * 43758.5; return x - Math.floor(x); };
  const wins = (ids.length ? [0, 1].slice(0, rr(9) < 0.6 ? 1 : 2) : []).map(k => { const tb = SOLO[Math.floor(rr(k) ** 2.2 * 5)], who = NPC.byId(ids[Math.floor(rr(k + 3) * ids.length)])?.nick;
    return who ? `<li><b>${esc(who)}</b> levou <strong>${int(tb.minBet * (1 + Math.floor(rr(k + 5) * 3) * 0.5))}</strong> fichas na ${esc(tb.name)}</li>` : ''; }).join('');
  return `<div class="lhero__txt"><span class="lhero__kicker"><i></i>${on} jogadores online agora</span><h2>salão de jogos</h2>
      <p>Sente numa mesa de 21, gire a roleta, voe no aviator ou aposte no futebol ao vivo.</p>
      <button class="btn btn--gold btn--lg" data-act="sit" data-kind="solo" data-id="${SOLO[1].id}">jogar agora</button></div>
    <div class="lhero__pot"><span>pote do dia</span><strong>${int(jackpot)}</strong><small>fichas distribuídas hoje nas mesas</small></div>
    <ul class="lhero__wins">${wins}</ul>`;
}

export function renderLobby() {
  const peers = lobby ? [...lobby.peers.entries()] : [];
  const online = peers.flatMap(([pid, p]) => (p.tables || []).map(t => ({ t, host: p.profile?.name, pid })));
  $('#tables').innerHTML = [
    ...online.map(o => tableCard(o.t, 'online', o.host)),
    ...SOLO.map(t => tableCard(t, 'solo')),
  ].join('');
  NPC.CLOCK.real = Math.max(Live.realOnline(), peers.length + 1); const onN = NPC.onlineTotal(Live.now());
  if (lobby) $('#online').innerHTML = `<i class="is-on"></i>${onN} jogadores online`;
  if ($('#lobby-hero')) $('#lobby-hero').innerHTML = lobbyHero(onN);
  renderRanking();
}
let lastRank = new Map();
// ranking global ao vivo: jogadores da nuvem + quem está no salão + o seu valor de agora + concorrentes do mundo
// lista completa do ranking (usada aqui no salão e na aba ranking)
export function rankingRows(limit = 10) {
  const peers = lobby ? [...lobby.peers.entries()].filter(([, p]) => p.profile).map(([pid, p]) => ({ pid, ...p.profile, worth: Number(p.profile.worth) || 0 })) : [];
  const w = Live.world(), t = Live.now(), month = W.current(w, t) + W.progress(w, t);
  const meP = profileOf(), myId = Auth.account()?.id;
  const cloud = (Auth.account() ? globalRows || [] : []).filter(r => r.user_id !== myId).map(r => ({ pid: `u:${r.user_id}`, name: r.name, level: r.level, rank: r.rank || '', worth: Number(r.worth), look: r.look || {} }));
  return RV.merge({ cloud, me: { ...meP, pid: 'me' }, peers, rivalRows: RV.rivals(month, Math.max(Number(meP.worth) || 0, ...cloud.map(r => r.worth || 0), ...peers.map(p => p.worth || 0)), Number(meP.worth) || 0), limit });
}
export function renderRanking() {
  const el = $('#ranking'); if (!el) return;
  const peers = lobby ? [...lobby.peers.entries()].filter(([, p]) => p.profile).map(([pid, p]) => ({ pid, ...p.profile, worth: Number(p.profile.worth) || 0 })) : [];
  const w = Live.world(), t = Live.now(), month = W.current(w, t) + W.progress(w, t);
  const meP = profileOf(), myId = Auth.account()?.id;
  const cloud = (Auth.account() ? globalRows || [] : []).filter(r => r.user_id !== myId).map(r => ({ pid: `u:${r.user_id}`, name: r.name, level: r.level, rank: r.rank || '', worth: Number(r.worth), look: r.look || {} }));
  const list = RV.merge({ cloud, me: { ...meP, pid: 'me' }, peers, rivalRows: RV.rivals(month, Math.max(Number(meP.worth) || 0, ...cloud.map(r => r.worth || 0), ...peers.map(p => p.worth || 0)), Number(meP.worth) || 0), limit: 10 });
  $('#ranking-title').textContent = 'ranking global ao vivo';
  const now = new Map(list.map((x, i) => [x.name, i]));
  if (!list.length) { el.innerHTML = '<li class="empty glass">Ranking vazio: o mundo recomeçou e ninguém passou de R$ 10 mil ainda. Passe dos R$ 10 mil e seja o primeiro.</li>'; lastRank = new Map(); return; }
  el.innerHTML = list.map((x, i) => {
    const was = lastRank.get(x.name), mv = was === undefined ? '' : was > i ? '<i class="rk__mv is-up" title="subiu">▲</i>' : was < i ? '<i class="rk__mv is-down" title="caiu">▼</i>' : '';
    return `<li><button class="rk${x.pid === 'me' ? ' is-me' : ''}${i < 3 ? ` rkrow is-top${i + 1}` : ''}" ${x.pid ? `data-profile="${x.pid}"` : 'disabled'}>
    <span class="rk__pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="rk__av">${avatarSVG(x.look || {}, { label: x.name })}</span>
    <span class="rk__name">${esc(x.name)}${x.pid === 'me' ? ' <small>você</small>' : ''}${mv}<small>nível ${x.level}${x.rank ? `, ${esc(x.rank)}` : ''}</small></span>
    <span class="rk__worth">${new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(x.worth)}</span></button></li>`;
  }).join('');
  lastRank = now;
}

export function findProfile(pid) {
  if (pid === 'me') return profileOf();
  if (String(pid).startsWith('npc:')) { const n = NPC.byId(pid.slice(4)); if (n) { const w = Live.world(), t = Live.now(); const p = NPC.profile(n, W.current(w, t) + W.progress(w, t)), hw = RV.hunted.get(n.id); return hw ? { ...p, worth: hw, level: RV.levelFor(hw) } : p; } }
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

export async function sitSolo(id) {
  const def = SOLO.find(t => t.id === id);
  if (await hostOnline({ name: def.name, minBet: def.minBet, pub: true, house: def })) return;
  leaveTable(true);
  cur = { id, local: true, name: def.name };
  openRoom(def.name, 'mesa rápida', false);
  cur.table = new Table({ ...def, onChange: v => applyView(v) });
  cur.table.join('me', seatInfo());
}

export async function hostOnline({ name, minBet, pub, house, pass = '' }) {
  const tid = rid();
  const conn = await openTableRoom(tid);
  if (!conn) { if (!house) say('Sem conexão com a internet. Jogue numa mesa rápida.', true); return false; }
  leaveTable(true);
  const pw = String(pass || '').trim();
  cur = { id: tid, host: true, pub, pass: pw, name, conn, house: house?.id || null };
  const { state, act, room } = conn;
  cur.table = new Table({ id: tid, name, minBet, bots: house?.bots || null, pool: house?.id || 'am-21', onChange: v => { state.send(v); applyView(v); announce(); } });
  act.onMessage = (m, { peerId }) => {
    if (m.t === 'join') { if (!passOk(pw, m)) return state.send({ badpass: true }, { target: peerId }); cur.table.join(peerId, m.info); }
    if (m.t === 'bet') cur.table.bet(peerId, m.amount);
    if (m.t === 'hit' || m.t === 'stand') cur.table.act(peerId, m.t);
    if (m.t === 'leave') cur.table.leave(peerId);
    if (m.t === 'info') cur.table.update(peerId, m.info);
  };
  room.onPeerJoin = pid => state.send(cur.table.view(), { target: pid });
  room.onPeerLeave = pid => cur?.table?.leave(pid);
  openRoom(name, house ? 'mesa rápida · os outros jogadores veem você aqui' : `${pub ? 'online, no salão' : 'online, só convite'}, código ${tid}`, true);
  cur.table.join(selfId, seatInfo());
  announce();
  if (!house) invite();
  return true;
}

export async function joinOnline(id, watch = false) {
  id = String(id).trim().toLowerCase();
  if (!id) return;
  const conn = await openTableRoom(id);
  if (!conn) return say('Sem conexão com a internet.', true);
  leaveTable(true);
  cur = { id, remote: true, conn, name: 'mesa online', hostId: null, watch };
  openRoom('conectando à mesa…', `código ${id}`, true);
  $('#tstatus').textContent = 'Procurando o anfitrião da mesa…';
  const join = target => conn.act.send({ t: 'join', info: seatInfo(), pass: cur?.pw }, { target });
  conn.room.onPeerJoin = pid => { if (!cur?.watch) join(pid); };
  conn.room.onPeerLeave = pid => { if (pid === cur?.hostId) { say('O anfitrião fechou a mesa.', true); leaveTable(); } };
  conn.state.onMessage = (v, { peerId }) => {
    if (cur?.conn !== conn) return;
    if (v.closed) { say('O anfitrião fechou a mesa.', true); return leaveTable(); }
    if (v.badpass) { const p = askPass(cur.pw != null); if (p == null) return leaveTable(); cur.pw = p; return join(peerId); }
    cur.hostId = peerId;
    $('#room-name').textContent = v.name;
    if (!cur.watch && !v.seats.some(s => s.pid === selfId) && !cur.asked) { cur.asked = true; join(peerId); }
    applyView(v);
    if (cur.watch) $('#tstatus').innerHTML = `Assistindo a mesa. <button class="btn btn--gold btn--sm" data-c21="sit">sentar na mesa</button>`;
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

document.addEventListener('click', e => {
  const b = e.target.closest('[data-c21]'); if (!b) return;
  if (b.dataset.c21 === 'watch') return joinOnline(b.dataset.id, true);
  if (b.dataset.c21 === 'sit' && cur?.remote && cur.hostId) { cur.watch = false; cur.asked = true; cur.conn.act.send({ t: 'join', info: seatInfo(), pass: cur.pw }, { target: cur.hostId }); $('#tstatus').textContent = 'Você senta na próxima rodada.'; }
});

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
// dobrar e dividir pedem mais fichas iguais à aposta da mão: confere antes de pedir à mesa
function extraOk(v, s) { const h = s?.hands[v.hand]; return h && G.S.chips >= h.bet; }
export function double() {
  const v = prev, s = mySeat(v);
  if (!s || v.phase !== 'play' || v.turn !== seatIdx(v)) return;
  if (!extraOk(v, s)) return say('Fichas insuficientes para dobrar.', true);
  send('double');
}
export function split() {
  const v = prev, s = mySeat(v);
  if (!s || v.phase !== 'play' || v.turn !== seatIdx(v)) return;
  if (!extraOk(v, s)) return say('Fichas insuficientes para dividir.', true);
  send('split');
}

// ---------- desenhar a mesa a partir do estado ----------
const mySeat = v => v?.seats.find(s => s.kind === 'human' && s.pid === myPid());
const seatIdx = v => v.seats.findIndex(s => s.kind === 'human' && s.pid === myPid());
const shown = Array.from({ length: 6 }, () => []);   // assinatura das cartas já desenhadas por lugar
let dealerShown = [];
function clearTable() {
  $('#seats').innerHTML = [0, 1, 2, 3, 4, 5].map(i => `<li class="seat seat--${i}" id="seat-${i}">
    <div class="seat__cards" id="cards-${i}"></div>
    <div class="spot" id="spot-${i}"><span class="spot__mark" aria-hidden="true"></span><span class="spot__chips"></span><span class="spot__amt"></span></div>
    <div class="seat__tags upright"><span class="seat__val" id="val-${i}" hidden></span><span class="seat__result" id="res-${i}" hidden></span></div>
    <button class="seat__who" data-profile=""><span class="seat__av"></span><span class="plate"></span><span class="seat__timer" aria-hidden="true"><i></i></span></button></li>`).join('');
  shown.forEach(a => (a.length = 0));
  dealerShown = []; $('#dealer-cards').innerHTML = ''; $('#dealer-val').hidden = true;
  $('#banner').hidden = true;
}

// baralho real (Byron Knoll, domínio público) em assets/cards
const RANK = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' }, SUIT = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const cardSrc = c => `assets/cards/${RANK[c.r] || c.r}_of_${SUIT[c.s]}.webp`;
function cardEl(c) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.setProperty('--rot', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
  el.innerHTML = `<div class="card__in"><div class="card__face">${c.hidden ? '' : `<img src="${cardSrc(c)}" alt="${c.r}${c.s}" draggable="false">`}</div><div class="card__back"></div></div>`;
  return el;
}
// carta sai do sapato em arco e vira na mesa
function dealCard(el, k, up) {
  const a = center($('#shoe')), b = center(el), dx = a.x - b.x, dy = a.y - b.y;
  setTimeout(() => sfx.play('slide', 0.55), ms(k * 150));
  el.animate([
    { transform: `translate(${dx}px, ${dy}px) translateZ(0) rotate(-35deg)`, opacity: 0 },
    { opacity: 1, offset: 0.1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) translateZ(2.5cqw) rotate(-12deg)`, offset: 0.55 },
    { transform: 'none', opacity: 1 }],
  { duration: ms(520), delay: ms(k * 150), easing: 'cubic-bezier(.25,.75,.3,1)', fill: 'backwards' })
    .finished.then(() => { if (up) { el.classList.add('is-up'); sfx.play('place', 0.35); } });
}
const sigOf = c => (c.hidden ? '?' : c.r + c.s);
function renderDealer(v) {
  const box = $('#dealer-cards');
  if (v.dealer.length < dealerShown.length) { box.innerHTML = ''; dealerShown = []; }
  v.dealer.forEach((c, k) => {
    const el = box.children[k];
    if (!el) { const n = cardEl(c); box.append(n); dealCard(n, 0, !c.hidden); dealerShown[k] = sigOf(c); return; }
    if (dealerShown[k] === '?' && !c.hidden) {           // revelação da carta escondida
      el.querySelector('.card__face').innerHTML = `<img src="${cardSrc(c)}" alt="${c.r}${c.s}" draggable="false">`;
      el.classList.add('is-up'); sfx.play('place', 0.5); dealerShown[k] = sigOf(c);
    }
  });
  const known = v.dealer.filter(c => !c.hidden), dv = $('#dealer-val');
  dv.hidden = !known.length;
  if (known.length) { const t = BJ.value(known); dv.textContent = v.dealer.some(c => c.hidden) ? `${t}` : t > 21 ? `${t}, estourou` : BJ.isBlackjack(v.dealer) ? 'blackjack' : t; dv.classList.toggle('is-bust', t > 21); }
}
function renderHands(i, s, v) {
  const box = $(`#cards-${i}`);
  const sigs = s.hands.map(h => h.cards.map(sigOf).join(','));
  const before = shown[i] || [];
  const same = sigs.length === before.length && sigs.every((x, k) => x.startsWith(before[k] || ''));
  let instant = false;
  if (!same) {
    instant = before.length === 1 && sigs.length === 2;          // divisão: as cartas já estavam na mesa
    box.innerHTML = sigs.map((_, h) => `<div class="hand" data-h="${h}"></div>`).join('');
  }
  s.hands.forEach((h, hi) => {
    const hb = box.querySelector(`[data-h="${hi}"]`);
    hb.classList.toggle('is-active', v.phase === 'play' && v.turn === i && v.hand === hi && s.hands.length > 1);
    h.cards.slice(hb.children.length).forEach((c, k) => {
      const el = cardEl(c); hb.append(el);
      if (instant) el.classList.add('is-up'); else dealCard(el, k, true);
    });
  });
  shown[i] = sigs;
  const val = $(`#val-${i}`);
  val.hidden = !s.hands.length || !s.hands[0].cards.length;
  val.textContent = s.hands.map(h => (BJ.isBlackjack(h.cards, h.split) ? 'BJ' : BJ.value(h.cards))).join(' / ');
  val.classList.toggle('is-bust', s.hands.length > 0 && s.hands.every(h => BJ.value(h.cards) > 21));
  val.classList.toggle('is-21', s.hands.some(h => BJ.value(h.cards) === 21));
}

function applyView(v) {
  const p = prev; prev = v;
  const me = seatIdx(v);
  const reveal = v.phase === 'done';

  v.seats.forEach((s, i) => {
    const seat = $(`#seat-${i}`);
    const sig = `${s.kind}|${s.pid}|${s.name}|${s.absent ? 'livre' : ''}|${JSON.stringify(s.look || '')}`;
    if (seat.dataset.sig !== sig) {
      seat.dataset.sig = sig;
      seat.querySelector('.plate').innerHTML = s.absent ? '<small>lugar livre</small>' : `${esc(s.name)}${i === me && s.name !== 'você' ? ' <small>você</small>' : ''}`;
      seat.querySelector('.seat__av').innerHTML = s.absent ? '' : avatarSVG((i === me ? profileOf().look : lookOf(s)) || {}, { label: s.name });
      seat.classList.toggle('seat--free', !!s.absent);
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

    renderHands(i, s, v);
    // a ficha extra de dobrar/dividir vai para o círculo
    if (s.bet && spot.dataset.bet && Number(spot.dataset.bet) < s.bet && v.phase !== 'done') {
      spot.dataset.bet = s.bet;
      fly(chipsHTML(s.bet / 2, 3), seat.querySelector('.seat__who'), spot).then(() => {
        spot.querySelector('.spot__chips').innerHTML = chipsHTML(s.bet);
        spot.querySelector('.spot__amt').textContent = int(s.bet);
      });
    }
  });

  renderDealer(v);
  if ((v.phase === 'deal' && p?.phase === 'bet') || (v.shuffling && !p?.shuffling)) sfx.play('shuffle', 0.6);
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
    const res = $(`#res-${i}`), r0 = s.hands[0]?.result || 'perdeu';
    res.hidden = false;
    const label = s.hands.length > 1 ? s.hands.map(h => h.result).join(' / ') : r0;
    res.textContent = s.pay > s.bet ? `${label === 'blackjack' ? 'blackjack! ' : ''}+${int(s.pay - s.bet)}` : label;
    res.className = `seat__result ${s.pay > s.bet ? 'is-win' : s.pay === s.bet ? 'is-even' : 'is-lose'}`;
    $(`#seat-${i}`).classList.toggle('is-winner', s.pay > s.bet);
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
    const bj = s.hands.some(h => h.result === 'blackjack');
    b.innerHTML = diff > 0 ? `<strong>${bj ? 'blackjack!' : 'você venceu'}</strong><span>+${int(diff)} fichas</span>`
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
    shown[i] = []; box.dataset.hands = 0;
    const spot = $(`#spot-${i}`);
    delete spot.dataset.bet; spot.querySelector('.spot__chips').innerHTML = ''; spot.querySelector('.spot__amt').textContent = '';
    $(`#res-${i}`).hidden = true; $(`#val-${i}`).hidden = true;
    $(`#seat-${i}`).classList.remove('is-winner');
  }
  const db = $('#dealer-cards');
  db.querySelectorAll('.card').forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(300), fill: 'forwards' }));
  setTimeout(() => { db.innerHTML = ''; }, ms(350)); dealerShown = []; $('#dealer-val').hidden = true;
  $('#banner').hidden = true;
  betAmt = 0; showBet();
}

// as fichas são de cada jogador: desconta a aposta e credita o prêmio uma vez por rodada
function accounting(v, me) {
  if (me < 0) return;
  const s = v.seats[me], key = `${v.id}:${v.phase === 'bet' ? v.round + 1 : v.round}`;
  if (marks.bet !== key) { marks.bet = key; marks.paid = 0; }
  if (s.bet > (marks.paid || 0)) { G.S.chips -= s.bet - (marks.paid || 0); marks.paid = s.bet; save(); G.render(); }
  if (v.phase === 'done' && !s.out && marks.pay !== `${v.id}:${v.round}`) {
    marks.pay = `${v.id}:${v.round}`;
    G.S.chips += s.pay + luck(G.S, s.pay - s.bet);
    const st = G.S.stats;
    st.hands++; if (s.pay > s.bet) { st.wins++; st.best = Math.max(st.best, s.pay - s.bet); const y = bjYear(); G.S.bjWin = { y, n: (G.S.bjWin?.y === y ? G.S.bjWin.n : 0) + 1 }; }
    updateInfo();   // avisa a mesa se ainda tem mão para ganhar no ano (e quando o ano vira)
    const xp = s.pay > s.bet && Math.random() < BJ_XP_CHANCE;   // XP e passe só em 2% das vitórias
    award('hand', 1, xp);
    if (s.pay > s.bet) award('win', 1, xp);
    if (s.hands.some(h => BJ.value(h.cards) === 21)) award('21', 1, xp);
    if (!cur?.local) award('onlineHand', 1, xp);
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
    if (v.shuffling) return 'O dealer está embaralhando um sapato novo de 6 baralhos.';
    if (v.phase === 'deal') return 'O dealer está dando as cartas.';
    if (v.phase === 'reveal') return 'O dealer revela a carta e joga a mão dele.';
    if (v.phase === 'play') { const h = s.hands[v.hand]; return v.turn === me && h ? `Sua vez${s.hands.length > 1 ? ` (mão ${v.hand + 1})` : ''}: ${BJ.value(h.cards)} pontos contra ${BJ.value(v.dealer.filter(c => !c.hidden))} do dealer. ${t()} s.` : `Vez de ${v.seats[v.turn]?.name}.`; }
    return 'Fim da rodada. A próxima começa já.';
  };
  el.textContent = text();
  clearInterval(countdown);
  if (v.deadline) countdown = setInterval(() => { if (prev === v) el.textContent = text(); }, 1000);
  const myTurn = v.phase === 'play' && v.turn === me;
  $('[data-act="bet"]').disabled = !s || v.phase !== 'bet' || !!s.bet;
  $('[data-act="hit"]').disabled = !myTurn;
  $('[data-act="stand"]').disabled = !myTurn;
  const mh = myTurn ? s.hands[v.hand] : null;
  $('[data-act="double"]').disabled = !(mh && BJ.canDouble(mh) && G.S.chips >= mh.bet);
  $('[data-act="split"]').disabled = !(mh && BJ.canSplit(mh, s.hands.length) && G.S.chips >= mh.bet);
  const left = v.shoeSize ? v.shoeLeft / v.shoeSize : 1;
  $('#shoe').style.setProperty('--left', left.toFixed(2));
}

function whoList(v, me) {
  $('#who-list').innerHTML = v.seats.map((s, i) => s.absent ? '' : `<li><button class="who" ${s.kind === 'human' ? `data-profile="${i === me ? 'me' : s.pid}"` : NPC.byNick(s.name) ? `data-profile="npc:${NPC.byNick(s.name).id}"` : 'disabled'}>
    <span class="who__av">${avatarSVG(s.kind === 'bot' ? NPC.byNick(s.name)?.look || NPC_LOOKS.Dorival : s.look, { label: s.name })}</span>
    <span>${esc(s.name)}${i === me && s.name !== 'você' ? ' (você)' : ''}</span><small>${s.kind === 'bot' ? `nível ${NPC.byNick(s.name) ? NPC.levelFor(NPC.worthAt(NPC.byNick(s.name), G.S.month)) : 1}` : `nível ${s.profile?.level ?? 1}`}</small></button></li>`).join('');
}

export const inTable = () => !!cur;
export const busyRound = () => !!prev && cur && ['deal', 'play'].includes(prev.phase) && !!mySeat(prev)?.bet;
