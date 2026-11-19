// Tela da sinuca: mesas da casa (contra um jogador da casa) e mesas online com amigos.
// A tacada é calculada por quem hospeda (sinuca.js) e todo mundo assiste à mesma animação; no fim, posições oficiais do anfitrião.
import * as SN from './sinuca.js';
import * as C from './casino.js';
import * as NPC from './npcs.js';
import { openTableRoom } from './net.js';
import { NPC_LOOKS, avatarSVG } from './avatar.js';
import { G, $, esc, int, say, save, note, award, profileOf, confetti } from './store.js';
import * as sfx from './sfx.js';

export const HOUSE = [
  { id: 'sn-bar', name: 'Bilhar do Bar', stake: 50, bot: 'TacoTorto', skill: 0.55 },
  { id: 'sn-clube', name: 'Sinuca Clube', stake: 300, bot: 'Bola8BR', skill: 0.7 },
  { id: 'sn-pro', name: 'Mesa Profissional', stake: 1500, bot: 'MestreDaTabela', skill: 0.82 },
  { id: 'sn-magnata', name: 'Mesa do Magnata', stake: 6000, bot: 'ReiDoGado', skill: 0.9 },
];
export const PAY = 1.9;
const COLORS = ['#f8fafc', '#facc15', '#2563eb', '#dc2626', '#7c3aed', '#f97316', '#16a34a', '#7f1d1d', '#0a0a0a'];
let cur = null, view = null, aim = 0, power = 0.55, anim = null, paid = new Set(), placing = false;
const rid = () => Math.random().toString(36).slice(2, 8);
const me = () => { const p = profileOf(); return { name: p.name, look: p.look }; };
const lookOf = s => (s.kind === 'human' ? s.look : NPC.byNick(s.name)?.look || NPC_LOOKS.Tião) || {};

// ---------- salão ----------
export function renderLobby() {
  const el = $('#sn-tables'); if (!el || $('#sub-sinuca').hidden) return;
  const online = C.peerList().flatMap(([, p]) => (p.games || []).filter(g => g.kind === 'sinuca').map(g => ({ ...g, host: p.profile?.name })));
  const card = (t, kind) => `<article class="tcard3 tcard3--${kind === 'online' ? 'online' : ['bronze', 'esmeralda', 'diamante', 'magnata'][HOUSE.indexOf(t)]}">
    <div class="tcard3__top"><span class="tcard3__live"><i></i>${kind === 'online' ? `online · ${esc(t.host || '')}` : 'bola 8'}</span><span class="tcard3__stake">entrada ${int(t.stake)}</span></div>
    <div class="tcard3__table"><div class="tcard3__felt sn-felt-mini"><b>${esc(t.name)}</b><small>prêmio ${int(t.stake * PAY)}</small></div>
      <span class="tcard3__seat tcard3__seat--0"><span class="tcard3__av tcard3__av--free">+</span><em>seu lugar</em></span>
      <span class="tcard3__seat tcard3__seat--3"><span class="tcard3__av">${avatarSVG(lookOf({ kind: 'bot', name: kind === 'online' ? t.host : t.bot }), { label: '' })}</span><em>${esc(kind === 'online' ? t.host || 'anfitrião' : t.bot)}</em></span></div>
    <div class="tcard3__foot"><span class="muted small">${kind === 'online' ? (t.full ? 'mesa cheia' : 'esperando adversário') : `adversário ${['iniciante', 'bom', 'muito bom', 'profissional'][HOUSE.indexOf(t)]}`}</span>
      <button class="btn btn--gold" data-sn="${kind === 'online' ? 'join' : 'house'}" data-id="${esc(t.id)}" ${t.full ? 'disabled' : ''}>jogar</button></div></article>`;
  el.innerHTML = online.map(t => card(t, 'online')).join('') + HOUSE.map(t => card(t, 'house')).join('');
}
G.gameHosts ??= {};
G.gameHosts.sinuca = () => (cur?.host && cur.pub && cur.game ? { kind: 'sinuca', id: cur.id, name: cur.game.name, stake: cur.game.stake, full: cur.game.seats[1].kind === 'human' } : null);

// ---------- motor do anfitrião (local ou online) ----------
function makeHost(game, broadcast, selfPid) {
  const h = { game, broadcast, selfPid, botTimer: 0 };
  h.push = shot => { broadcast(shot); tick(h); };
  return h;
}
function tick(h) {
  const g = h.game; clearTimeout(h.botTimer);
  if (g.phase !== 'aim') return;
  const s = g.seats[g.turn];
  if (s.kind === 'bot') h.botTimer = setTimeout(() => { const sh = SN.botShot(g, g.turn, h.skill ?? 0.8); doShot(h, g.turn, sh.angle, sh.power); }, Math.max(0, (h.busy || 0) - Date.now()) + 1400 + Math.random() * 900);   // espera a tacada anterior parar de rolar
}
function doShot(h, seat, angle, pw) {
  const g = h.game; if (g.phase !== 'aim' || seat !== g.turn) return;
  const from = g.balls.map(b => ({ ...b })), res = SN.run(g.balls, angle, pw);
  g.apply(seat, res); h.busy = Date.now() + res.t * 1000;
  h.push({ shot: { from, angle, power: pw } });
}
function placeCue(h, seat, x, y) { const err = h.game.place(seat, x, y); if (!err) h.push({}); return err; }

// ---------- abrir mesa ----------
function show(on) { $('#sn-lobby').hidden = on; $('#sn-room').hidden = !on; if (on) requestAnimationFrame(loop); }
export function sitHouse(id) {
  const def = HOUSE.find(t => t.id === id); if (!def) return;
  if ((G.S.chips || 0) < def.stake) return say(`Essa mesa pede ${int(def.stake)} fichas de entrada. Compre no caixa (aba vinte e um).`, true);
  leave(true);
  const g = new SN.Sinuca({ id: def.id, name: def.name, stake: def.stake });
  g.seats = [{ kind: 'human', pid: 'me', ...me() }, { kind: 'bot', name: def.bot }];
  const h = makeHost(g, m => receive({ ...m, view: g.view(0) }), 'me'); h.skill = def.skill;
  cur = { id: def.id, local: true, game: g, h, seat: 0 };
  g.start(); show(true); receive({ view: g.view(0) }); tick(h);
}
export async function host({ name, stake, pub }) {
  if ((G.S.chips || 0) < stake) return say(`Você precisa de ${int(stake)} fichas para a entrada.`, true);
  const id = rid(), conn = await openTableRoom(`sinuca-${id}`);
  if (!conn) return say('Sem conexão com a internet agora.', true);
  leave(true);
  const g = new SN.Sinuca({ id, name: name || 'sinuca dos amigos', stake });
  g.seats = [{ kind: 'human', pid: conn.selfId, ...me() }, { kind: 'empty', name: 'esperando…' }];
  const h = makeHost(g, m => { for (const [i, s] of g.seats.entries()) if (s.kind === 'human' && s.pid !== conn.selfId) conn.state.send({ ...m, view: g.view(i) }, { target: s.pid }); receive({ ...m, view: g.view(0) }); C.announce(); }, conn.selfId);
  cur = { id, host: true, pub, game: g, h, conn, seat: 0 };
  conn.act.onMessage = (m, { peerId }) => {
    if (m.t === 'join') {
      if (g.seats[1].kind === 'human' && g.seats[1].pid !== peerId) return conn.state.send({ full: true }, { target: peerId });
      g.seats[1] = { kind: 'human', pid: peerId, name: m.info?.name || 'jogador', look: m.info?.look };
      if (g.phase === 'wait' || g.phase === 'end') g.start();
      return h.push({});
    }
    const s = g.seats.findIndex(x => x.pid === peerId); if (s < 0) return;
    if (m.t === 'shot') doShot(h, s, Number(m.angle), Number(m.power));
    if (m.t === 'place') { const err = placeCue(h, s, Number(m.x), Number(m.y)); if (err) conn.state.send({ err, view: g.view(s) }, { target: peerId }); }
    if (m.t === 'leave') { g.seats[1] = { kind: 'bot', name: 'Bola8BR' }; h.push({}); }
    if (m.t === 'again' && g.phase === 'end') { g.start(); h.push({}); }
  };
  conn.room.onPeerLeave = pid => { if (g.seats[1].pid === pid) { g.seats[1] = { kind: 'bot', name: 'Bola8BR' }; say('O adversário saiu: a casa assumiu o lugar.'); h.push({}); } };
  show(true); receive({ view: g.view(0) }); C.announce(); invite();
}
export async function join(id) {
  id = String(id || '').trim().toLowerCase(); if (!id) return;
  const conn = await openTableRoom(`sinuca-${id}`);
  if (!conn) return say('Sem conexão com a internet agora.', true);
  leave(true);
  cur = { id, remote: true, conn, hostId: null, seat: 1 }; show(true);
  $('#sn-msg').textContent = 'Procurando a mesa…';
  conn.room.onPeerJoin = pid => conn.act.send({ t: 'join', info: me() }, { target: pid });
  conn.room.onPeerLeave = pid => { if (pid === cur?.hostId) { say('O anfitrião fechou a mesa de sinuca.', true); leave(); } };
  conn.state.onMessage = (m, { peerId }) => {
    if (cur?.conn !== conn) return;
    if (m.full) { say('Essa mesa de sinuca já tem dois jogadores.', true); return leave(); }
    if (m.closed) { say('O anfitrião fechou a mesa de sinuca.', true); return leave(); }
    if (m.err) say(m.err[0].toUpperCase() + m.err.slice(1), true);
    cur.hostId = peerId; receive(m);
  };
  setTimeout(() => { if (cur?.conn === conn && !cur.hostId) { say('Mesa de sinuca não encontrada.', true); leave(); } }, 25000);
}
export function leave(silent) {
  const c = cur; cur = null; view = null; anim = null;
  if (c?.h) clearTimeout(c.h.botTimer);
  if (c?.host) { c.conn.state.send({ closed: true }); setTimeout(() => c.conn.room.leave(), 300); }
  if (c?.remote) { if (c.hostId) c.conn.act.send({ t: 'leave' }, { target: c.hostId }); setTimeout(() => c.conn.room.leave(), 300); }
  C.announce();
  if (!silent) { show(false); renderLobby(); }
}
export function invite() {
  if (!cur || cur.local) return;
  const url = `${location.origin}${location.pathname}?sinuca=${cur.id}`;
  navigator.clipboard?.writeText(url).then(() => say(`Link da mesa de sinuca copiado. Código: ${cur.id}`), () => say(`Código da mesa de sinuca: ${cur.id}`));
}
function act(m) {
  if (!cur) return;
  if (cur.h) { if (m.t === 'shot') doShot(cur.h, cur.seat, m.angle, m.power); else if (m.t === 'place') { const e = placeCue(cur.h, cur.seat, m.x, m.y); if (e) say(e[0].toUpperCase() + e.slice(1), true); } else if (m.t === 'again') { cur.game.start(); cur.h.push({}); } }
  else if (cur.hostId) cur.conn.act.send(m, { target: cur.hostId });
}

// ---------- chegada de estado: anima a tacada e depois mostra o resultado ----------
function receive(m) {
  if (m.shot) { anim = { balls: m.shot.from.map(b => ({ ...b })), ev: { first: null, pocketed: [], cushion: false }, final: m.view, angle: m.shot.angle, power: m.shot.power, started: false }; sfx.play('chip', 0.6); }
  else if (!anim) setView(m.view);
  else anim.final = m.view;
}
function setView(v) {
  if (!v) return; view = v; money(v);
  const my = v.seat;
  if (v.turn === my && v.phase === 'aim' && v.inHand) placing = true; else placing = false;
  hud();
}
function money(v) {
  const key = `${v.id}:${v.games}`; if (!v.games || v.seat < 0) return;
  if (v.seats.every(s => s.kind !== 'empty') && !paid.has(`in:${key}`)) { paid.add(`in:${key}`); G.S.chips = Math.max(0, (G.S.chips || 0) - v.stake); note(`sinuca: entrada de ${int(v.stake)} fichas (${v.name})`); save(); G.render(); }
  if (v.phase === 'end' && !paid.has(`out:${key}`)) {
    paid.add(`out:${key}`);
    if (v.winner === v.seat) { const p = Math.floor(v.stake * PAY); G.S.chips += p; note(`sinuca: venceu, +${int(p)} fichas`); confetti(80); sfx.play('stack', 0.7); award('sinuca'); say('Você venceu a partida de sinuca!'); }
    save(); G.render();
  }
}
function hud() {
  const v = view; if (!v) return;
  const grp = g => (g === 'lisas' ? 'lisas (1–7)' : g === 'listradas' ? 'listradas (9–15)' : 'mesa aberta');
  $('#sn-name').textContent = v.name;
  $('#sn-players').innerHTML = v.seats.map((s, i) => `<div class="sn-pl${v.turn === i && v.phase === 'aim' ? ' is-turn' : ''}${i === v.seat ? ' is-me' : ''}">
    <span class="sn-av">${avatarSVG(lookOf(s), { label: s.name || '' })}</span><div><b>${esc(s.name || 'esperando…')}${i === v.seat ? ' (você)' : ''}</b><small>${grp(v.groups?.[i])}${v.groups?.[i] ? ` · faltam ${v.left[i]}` : ''}</small>
    <span class="sn-left">${v.balls ? v.balls.filter(b => !b.in && b.n && v.groups?.[i] && SN.groupOf(b.n) === v.groups[i]).map(b => `<i style="--c:${COLORS[b.n > 8 ? b.n - 8 : b.n]}" class="${b.n > 8 ? 'is-st' : ''}">${b.n}</i>`).join('') : ''}</span></div></div>`).join('<span class="sn-vs">x</span>');
  const myTurn = v.phase === 'aim' && v.turn === v.seat && !anim;
  $('#sn-msg').textContent = anim ? 'Bola rolando…' : placing ? 'Bola na mão: toque na mesa para colocar a branca.' : myTurn ? `Sua vez: mire na mesa, escolha a força e tacar. ${v.msg}` : v.msg;
  $('#sn-shoot').disabled = !myTurn || placing;
  $('#sn-again').hidden = !(v.phase === 'end' && (cur?.h || false));
  $('#sn-invite').hidden = !!cur?.local;
}

// ---------- desenho ----------
const M = 9;
let cv, g2, S = 1;
function loop() {
  if (!cur || $('#sn-room').hidden) return;
  requestAnimationFrame(loop);
  cv ??= $('#sn-cv'); if (!cv) return; g2 ??= cv.getContext('2d');
  const w = cv.clientWidth, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * (SN.WD + 2 * M) / (SN.L + 2 * M)); }
  S = cv.width / (SN.L + 2 * M);
  if (anim) {   // anima a tacada no mesmo ritmo da física
    if (!anim.started) { anim.started = true; SN.shoot(anim.balls, anim.angle, anim.power); anim.t = performance.now(); }
    const now = performance.now(), steps = Math.min(40, Math.round((now - anim.t) / 1000 / SN.SUB)); anim.t += steps * SN.SUB * 1000;
    let moving = true; const before = anim.ev.pocketed.length;
    for (let k = 0; k < steps && moving; k++) moving = SN.step(anim.balls, SN.SUB, anim.ev);
    if (anim.ev.pocketed.length > before) sfx.play('stack', 0.5);
    draw(anim.balls, false);
    if (!moving) { const f = anim.final; anim = null; setView(f); }
    return;
  }
  draw(view?.balls, true);
}
const X = x => (x + M) * S, Y = y => (y + M) * S;
function draw(balls, aiming) {
  const W = cv.width, H = cv.height, g = g2;
  g.clearRect(0, 0, W, H);
  // borda de madeira e tabelas
  const wood = g.createLinearGradient(0, 0, 0, H); wood.addColorStop(0, '#7c2d12'); wood.addColorStop(0.5, '#9a3412'); wood.addColorStop(1, '#5a1f0b');
  g.fillStyle = wood; rr(g, 0, 0, W, H, 18 * S / 3); g.fill();
  const felt = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6); felt.addColorStop(0, '#0e8f6e'); felt.addColorStop(1, '#065446');
  g.fillStyle = '#04392f'; g.fillRect(X(-2.2), Y(-2.2), (SN.L + 4.4) * S, (SN.WD + 4.4) * S);
  g.fillStyle = felt; g.fillRect(X(0), Y(0), SN.L * S, SN.WD * S);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = S * 0.3; g.beginPath(); g.moveTo(X(SN.HEAD.x), Y(0)); g.lineTo(X(SN.HEAD.x), Y(SN.WD)); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(X(SN.FOOT.x), Y(SN.FOOT.y), S * 0.7, 0, 7); g.fill();
  g.fillStyle = '#fde68a'; for (let k = 1; k < 8; k++) if (k !== 4) for (const y of [-5.5, SN.WD + 5.5]) { g.beginPath(); g.arc(X(k * SN.L / 8), Y(y), S * 0.6, 0, 7); g.fill(); }
  for (const p of SN.POCKETS) { g.fillStyle = '#020617'; g.beginPath(); g.arc(X(Math.max(-0.5, Math.min(SN.L + 0.5, p.x))), Y(Math.max(-0.5, Math.min(SN.WD + 0.5, p.y))), (p.r - 0.6) * S, 0, 7); g.fill(); }
  if (!balls) return;
  const v = view, mine = aiming && v && v.phase === 'aim' && v.turn === v.seat && !placing;
  const cue = balls[0];
  if (mine && !cue.in) {   // linha de mira com bola fantasma e para onde a bola acertada vai
    const dx = Math.cos(aim), dy = Math.sin(aim);
    let hit = null, tmin = 400;
    for (const b of balls) { if (b.in || !b.n) continue; const fx = b.x - cue.x, fy = b.y - cue.y, t = fx * dx + fy * dy; if (t <= 0) continue; const d2 = fx * fx + fy * fy - t * t, r2 = (2 * SN.R) ** 2; if (d2 > r2) continue; const th = t - Math.sqrt(r2 - d2); if (th < tmin) { tmin = th; hit = b; } }
    const wall = Math.min(dx > 0 ? (SN.L - SN.R - cue.x) / dx : dx < 0 ? (SN.R - cue.x) / dx : 400, dy > 0 ? (SN.WD - SN.R - cue.y) / dy : dy < 0 ? (SN.R - cue.y) / dy : 400);
    const tEnd = hit ? tmin : wall, gx = cue.x + dx * tEnd, gy = cue.y + dy * tEnd;
    g.setLineDash([S * 1.2, S * 1.2]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = S * 0.35;
    g.beginPath(); g.moveTo(X(cue.x), Y(cue.y)); g.lineTo(X(gx), Y(gy)); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(X(gx), Y(gy), SN.R * S, 0, 7); g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke();
    if (hit) { const nx = hit.x - gx, ny = hit.y - gy, nl = Math.hypot(nx, ny); g.strokeStyle = 'rgba(250,204,21,.9)'; g.beginPath(); g.moveTo(X(hit.x), Y(hit.y)); g.lineTo(X(hit.x + nx / nl * 18), Y(hit.y + ny / nl * 18)); g.stroke(); }
  }
  for (const b of balls) if (!b.in) ball(b);
  if (mine && !cue.in) {   // taco
    const back = 3 + power * 14, dx = Math.cos(aim), dy = Math.sin(aim);
    const sx = cue.x - dx * (SN.R + back), sy = cue.y - dy * (SN.R + back), ex = sx - dx * 95, ey = sy - dy * 95;
    const grad = g.createLinearGradient(X(sx), Y(sy), X(ex), Y(ey)); grad.addColorStop(0, '#f1f5f9'); grad.addColorStop(0.03, '#e2c290'); grad.addColorStop(0.7, '#b45309'); grad.addColorStop(1, '#1c1917');
    g.strokeStyle = grad; g.lineCap = 'round'; g.lineWidth = S * 1.5; g.beginPath(); g.moveTo(X(sx), Y(sy)); g.lineTo(X(ex), Y(ey)); g.stroke(); g.lineCap = 'butt';
  }
}
function ball(b) {
  const g = g2, x = X(b.x), y = Y(b.y), r = SN.R * S, n = b.n, col = COLORS[n > 8 ? n - 8 : n];
  g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
  g.fillStyle = n > 8 ? '#f8fafc' : col; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  if (n > 8) { g.fillStyle = col; g.fillRect(x - r, y - r * 0.55, 2 * r, r * 1.1); }
  if (n) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.48, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = `800 ${r * 0.62}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x, y + r * 0.04); }
  const sh = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.1); sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = sh; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore();
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const tableXY = e => { const r = cv.getBoundingClientRect(), s = (SN.L + 2 * M) / r.width; return { x: (e.clientX - r.left) * s - M, y: (e.clientY - r.top) * s - M }; };

document.addEventListener('pointermove', e => {
  if (e.target.id !== 'sn-cv' || !view || anim || placing) return;
  const p = tableXY(e), c = view.balls?.[0]; if (c) aim = Math.atan2(p.y - c.y, p.x - c.x);
});
document.addEventListener('pointerdown', e => {
  if (e.target.id !== 'sn-cv' || !view || anim) return;
  const p = tableXY(e);
  if (placing) { act({ t: 'place', x: p.x, y: p.y }); return; }
  const c = view.balls?.[0]; if (c) aim = Math.atan2(p.y - c.y, p.x - c.x);
});
document.addEventListener('input', e => { if (e.target.id === 'sn-power') power = Number(e.target.value) / 100; });
document.addEventListener('keydown', e => {
  if (!cur || $('#sn-room')?.hidden || e.target.closest?.('input:not([type=range]), textarea')) return;
  if (e.key === 'ArrowLeft') { aim -= 0.006; e.preventDefault(); } if (e.key === 'ArrowRight') { aim += 0.006; e.preventDefault(); }
  if (e.key === ' ' && !$('#sn-shoot').disabled) { e.preventDefault(); $('#sn-shoot').click(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sn]'); if (!b || b.disabled) return;
  const a = b.dataset.sn;
  if (a === 'house') return sitHouse(b.dataset.id);
  if (a === 'join') return join(b.dataset.id);
  if (a === 'leave') return leave();
  if (a === 'invite') return invite();
  if (a === 'create') { const f = $('#sn-create'); return host({ name: f.sname.value.trim(), stake: Number(f.sstake.value), pub: f.svis.value === 'pub' }); }
  if (a === 'code') return join($('#sn-code').value);
  if (a === 'shoot') { act({ t: 'shot', angle: aim, power }); return; }
  if (a === 'again') { if ((G.S.chips || 0) < (view?.stake || 0)) return say(`Você precisa de ${int(view.stake)} fichas.`, true); return act({ t: 'again' }); }
});
setInterval(renderLobby, 5000);
const q = new URLSearchParams(location.search).get('sinuca');
if (q) setTimeout(() => { G.goto?.('mesa'); document.querySelector('[data-sub="sinuca"]')?.click(); join(q); }, 2500);
