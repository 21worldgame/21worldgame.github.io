// Rede peer-to-peer (Trystero sobre relays Nostr públicos). Sem servidor próprio: funciona no GitHub Pages.
// Se a biblioteca não carregar (sem internet), o jogo segue só com as mesas de bots.
const LIB = 'https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm';
const CFG = { appId: 'sysrm-21world-v1' };
let lib;
export async function net() {
  if (lib === undefined) lib = await import(LIB).catch(() => null);
  return lib;
}

// salão: cada jogador anuncia o próprio perfil e as mesas públicas que hospeda
export async function openLobby(onChange) {
  const t = await net();
  if (!t) return null;
  const room = t.joinRoom(CFG, 'salao');
  const hello = room.makeAction('hello');
  const trade = room.makeAction('trade');
  let onTrade = () => {};
  trade.onMessage = (d, { peerId }) => onTrade(d, peerId);
  const chat = room.makeAction('chat');                  // chat global: mensagens e o histórico para quem acabou de entrar
  let onChat = () => {}, onJoin = () => {};
  chat.onMessage = (d, { peerId }) => onChat(d, peerId);
  const peers = new Map();
  let mine = null;
  // identidade estável desta aba: quem recarrega a página volta com conexão nova, e a entrada antiga (fantasma) sai na hora
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

// sala de uma mesa: o anfitrião manda "state", os jogadores mandam "act"
export async function openTableRoom(tableId) {
  const t = await net();
  if (!t) return null;
  const room = t.joinRoom(CFG, `mesa-${tableId}`);
  return { room, selfId: t.selfId, state: room.makeAction('state'), act: room.makeAction('act') };
}
