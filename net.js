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
  const peers = new Map();
  let mine = null;
  const changed = () => onChange(peers);
  room.onPeerJoin = id => { if (mine) hello.send(mine, { target: id }); };
  room.onPeerLeave = id => { peers.delete(id); changed(); };
  hello.onMessage = (d, { peerId }) => { peers.set(peerId, { ...d, seen: Date.now() }); changed(); };
  setInterval(() => {
    if (mine) hello.send(mine);
    for (const [id, p] of peers) if (Date.now() - p.seen > 40000) peers.delete(id);
    changed();
  }, 10000);
  return { selfId: t.selfId, peers, announce(d) { mine = d; hello.send(d); } };
}

// sala de uma mesa: o anfitrião manda "state", os jogadores mandam "act"
export async function openTableRoom(tableId) {
  const t = await net();
  if (!t) return null;
  const room = t.joinRoom(CFG, `mesa-${tableId}`);
  return { room, selfId: t.selfId, state: room.makeAction('state'), act: room.makeAction('act') };
}
