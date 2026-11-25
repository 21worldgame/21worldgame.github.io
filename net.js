// Rede das mesas e do salão. Principal: tempo real do servidor (broadcast + presence) — tudo passa pelo servidor,
// então funciona em 4G, Wi-Fi de empresa e celular (a conexão direta entre aparelhos falhava nessas redes).
// Reserva: Trystero sobre relays Nostr públicos, só se o servidor não estiver configurado ou não carregar.
// As duas falam a mesma "língua" para o resto do jogo: room.makeAction(nome) → { send(dado, { target }), onMessage },
// room.onPeerJoin / onPeerLeave / leave() e selfId.
import { sbReady } from './auth.js';

const LIB = 'https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm';
const CFG = { appId: 'sysrm-21world-v1' };
const SELF = Math.random().toString(36).slice(2, 12);   // id desta aba (o mesmo no salão e em todas as mesas)

let sbP;
const supa = () => (sbP ??= sbReady().catch(() => null));
let lib;
async function p2p() {
  if (lib === undefined) lib = await import(LIB).catch(() => null);
  return lib;
}
export async function net() {
  if (await supa()) return { selfId: SELF };
  return p2p();
}

// sala no servidor com a mesma cara da sala do Trystero
function sbRoom(sb, name, onReady) {
  for (const old of sb.getChannels().filter(c => c.topic === `realtime:21w:${name}`)) sb.removeChannel(old);   // saiu e voltou na mesma mesa: canal novo
  const ch = sb.channel(`21w:${name}`, { config: { broadcast: { self: false }, presence: { key: SELF } } });
  let ready = false, left = false;
  const queue = [];
  const push = m => (ready ? ch.send(m).catch(() => {}) : queue.push(m));
  const room = {
    onPeerJoin: () => {}, onPeerLeave: () => {},
    makeAction(event) {
      const a = { onMessage: () => {}, send: (d, o) => push({ type: 'broadcast', event, payload: { f: SELF, to: o?.target || null, d } }) };
      ch.on('broadcast', { event }, ({ payload: p }) => { if (!p || p.f === SELF || (p.to && p.to !== SELF)) return; a.onMessage(p.d, { peerId: p.f }); });
      return a;
    },
    leave() { if (left) return; left = true; sb.removeChannel(ch); },
  };
  const known = new Set();
  ch.on('presence', { event: 'sync' }, () => {
    const now = new Set(Object.keys(ch.presenceState()).filter(k => k !== SELF));
    for (const k of now) if (!known.has(k)) { known.add(k); room.onPeerJoin(k); }
    for (const k of [...known]) if (!now.has(k)) { known.delete(k); room.onPeerLeave(k); }
  });
  queueMicrotask(() => ch.subscribe(st => {
    if (st !== 'SUBSCRIBED' || left) return;
    ready = true; onReady ? onReady(ch) : ch.track({ at: Date.now() }).catch(() => {});
    for (const m of queue.splice(0)) ch.send(m).catch(() => {});
  }));
  return { room, ch };
}

// salão: cada jogador anuncia o próprio perfil e as mesas que hospeda
export async function openLobby(onChange) {
  const sb = await supa();
  if (!sb) return openLobbyP2P(onChange);
  let mine = null, chan = null, onTrade = () => {}, onChat = () => {}, onJoin = () => {};
  const peers = new Map();
  const { room, ch } = sbRoom(sb, 'salao', c => { chan = c; if (mine) c.track(mine).catch(() => {}); });
  const trade = room.makeAction('trade'), chat = room.makeAction('chat');
  trade.onMessage = (d, { peerId }) => onTrade(d, peerId);
  chat.onMessage = (d, { peerId }) => onChat(d, peerId);
  // presença: o perfil de cada um chega sozinho a quem entra; quem fecha a aba some da lista
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState(), seen = new Set();
    for (const [k, metas] of Object.entries(st)) {
      if (k === SELF) continue;
      const d = metas[metas.length - 1]; if (!d) continue;
      seen.add(k); if (!peers.has(k)) setTimeout(() => onJoin(k), 0);
      peers.set(k, { ...d, seen: Date.now() });
    }
    for (const k of [...peers.keys()]) if (!seen.has(k)) peers.delete(k);
    // a mesma pessoa com duas conexões (recarregou a página): fica só a mais nova
    const byCid = new Map();
    for (const [k, p] of peers) { const o = p.cid && byCid.get(p.cid); if (o && (peers.get(o).at || 0) > (p.at || 0)) peers.delete(k); else { if (o) peers.delete(o); if (p.cid) byCid.set(p.cid, k); } }
    onChange(peers);
  });
  let cid = '';
  try { cid = sessionStorage.getItem('21world.cid') || ''; if (!cid) { cid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('21world.cid', cid); } } catch { cid = Math.random().toString(36).slice(2, 12); }
  return { selfId: SELF, peers, announce(d) { mine = { ...d, cid, at: Date.now() }; chan?.track(mine).catch(() => {}); },
    sendTrade: (msg, target) => trade.send(msg, { target }), setOnTrade: fn => { onTrade = fn; },
    sendChat: (msg, to) => (to ? chat.send(msg, { target: to }) : chat.send(msg)), setOnChat: fn => { onChat = fn; }, setOnJoin: fn => { onJoin = fn; } };
}

// sala de uma mesa: o anfitrião manda "state", os jogadores mandam "act"
export async function openTableRoom(tableId) {
  const sb = await supa();
  if (sb) { const { room } = sbRoom(sb, `mesa-${tableId}`); return { room, selfId: SELF, state: room.makeAction('state'), act: room.makeAction('act') }; }
  const t = await p2p();
  if (!t) return null;
  const room = t.joinRoom(CFG, `mesa-${tableId}`);
  return { room, selfId: t.selfId, state: room.makeAction('state'), act: room.makeAction('act') };
}

// ---------- reserva: Trystero (P2P) ----------
async function openLobbyP2P(onChange) {
  const t = await p2p();
  if (!t) return null;
  const room = t.joinRoom(CFG, 'salao');
  const hello = room.makeAction('hello');
  const trade = room.makeAction('trade');
  let onTrade = () => {};
  trade.onMessage = (d, { peerId }) => onTrade(d, peerId);
  const chat = room.makeAction('chat');
  let onChat = () => {}, onJoin = () => {};
  chat.onMessage = (d, { peerId }) => onChat(d, peerId);
  const peers = new Map();
  let mine = null;
  let cid = '';
  try { cid = sessionStorage.getItem('21world.cid') || ''; if (!cid) { cid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('21world.cid', cid); } } catch { cid = Math.random().toString(36).slice(2, 12); }
  const changed = () => onChange(peers);
  room.onPeerJoin = id => { if (mine) hello.send(mine, { target: id }); onJoin(id); };
  room.onPeerLeave = id => { peers.delete(id); changed(); };
  hello.onMessage = (d, { peerId }) => {
    if (d?.cid) for (const [id, p] of peers) if (p.cid === d.cid && id !== peerId) peers.delete(id);
    peers.set(peerId, { ...d, seen: Date.now() }); changed();
  };
  setInterval(() => {
    if (mine) hello.send(mine);
    for (const [id, p] of peers) if (Date.now() - p.seen > 25000) peers.delete(id);
    changed();
  }, 10000);
  return { selfId: t.selfId, peers, announce(d) { mine = { ...d, cid }; hello.send(mine); },
    sendTrade: (msg, target) => trade.send(msg, { target }), setOnTrade: fn => { onTrade = fn; },
    sendChat: (msg, to) => (to ? chat.send(msg, { target: to }) : chat.send(msg)), setOnChat: fn => { onChat = fn; }, setOnJoin: fn => { onJoin = fn; } };
}
