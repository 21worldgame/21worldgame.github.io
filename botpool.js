// Cada jogador fictício (NPC) senta em UMA mesa só, em todos os jogos: nenhum nick se repete entre mesas da casa.
// Mesas de aposta alta vêm primeiro na lista e pegam os NPCs mais ricos (NPCS já vem do mais rico para o mais pobre).
import { NPCS, isAway } from './npcs.js';

// [id da mesa, quantos bots]. "am-*" = reserva para mesas de amigos de cada jogo.
const SPEC = [
  ['bot-mag', 6], ['pk-dono', 5], ['pk-high', 5], ['tr-magnata', 3], ['sn-magnata', 1], ['bot-high', 6], ['pk-diamante', 5],
  ['bot-dia', 6], ['pk-magnata', 5], ['bot-vip', 6], ['pk-vip', 5], ['tr-ouro', 3], ['sn-pro', 1], ['bot-esm', 6], ['pk-leilao', 5],
  ['pk-pro', 5], ['bot-porto', 6], ['pk-fazenda', 5], ['sn-clube', 1], ['bot-azul', 6], ['pk-clube', 5], ['tr-praca', 3], ['pk-praca', 5],
  ['bot-dorival', 6], ['pk-boteco', 5], ['tr-boteco', 3], ['sn-bar', 1], ['pk-calcada', 5],
  ['av', 15], ['sub', 4], ['am-21', 6], ['am-pk', 5], ['am-tr', 3], ['am-sn', 1], ['rl', 8],
];
const POOL = {};
{ let k = 0; for (const [id, n] of SPEC) POOL[id] = NPCS.slice(k, k += n).map(x => x.nick); }
// quem está de folga (npcs.js AWAY) é trocado por um reserva ('sub'), também único; volta sozinho depois do horário
let nextSub = 0; const SUB = {};
const swap = nick => (isAway(nick) ? (SUB[nick] ??= POOL.sub[nextSub++ % POOL.sub.length]) : nick);
export const botsFor = id => (POOL[id] || []).map(swap);
export const botFor = id => (POOL[id] ? swap(POOL[id][0]) : undefined);
