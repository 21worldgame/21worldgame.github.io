// Cada jogador fictício (NPC) senta em UMA mesa só, em todos os jogos: nenhum nick se repete entre mesas da casa.
// Mesas de aposta alta vêm primeiro na lista e pegam os NPCs mais ricos (NPCS já vem do mais rico para o mais pobre).
import { NPCS, isAway, FALLEN } from './npcs.js';

// [id da mesa, quantos bots]. "am-*" = reserva para mesas de amigos de cada jogo.
const SPEC = [
  ['bot-mag', 6], ['pk-dono', 5], ['pk-high', 5], ['tr-magnata', 3], ['sn-magnata', 1], ['bot-high', 6], ['pk-diamante', 5],
  ['bot-dia', 6], ['pk-magnata', 5], ['bot-vip', 6], ['pk-vip', 5], ['tr-ouro', 3], ['sn-pro', 1], ['bot-esm', 6], ['pk-leilao', 5],
  ['pk-pro', 5], ['bot-porto', 6], ['pk-fazenda', 5], ['sn-clube', 1], ['bot-azul', 6], ['pk-clube', 5], ['tr-praca', 3], ['pk-praca', 5],
  ['bot-dorival', 6], ['pk-boteco', 5], ['tr-boteco', 3], ['sn-bar', 1], ['pk-calcada', 5],
  ['av', 15], ['sub', 4], ['am-21', 6], ['am-pk', 5], ['am-tr', 3], ['am-sn', 1], ['rl', 8],
];
const POOL = {};
{ let k = 0; for (const [id, n] of SPEC) POOL[id] = NPCS.filter(x => !FALLEN.has(x.id) && !x.arriveAt).slice(k, k += n).map(x => x.nick); }   // os dois caídos não sentam mais em mesa nenhuma
// quem está de folga (npcs.js AWAY) é trocado por um reserva ('sub'), também único; volta sozinho depois do horário
let nextSub = 0; const SUB = {};
const swap = nick => (isAway(nick) ? (SUB[nick] ??= POOL.sub[nextSub++ % POOL.sub.length]) : nick);
export const botsFor = id => (POOL[id] || []).map(swap);
export const botFor = id => (POOL[id] ? swap(POOL[id][0]) : undefined);

// v167: a mesa fica LIVRE para os jogadores. Os jogadores do mundo só sentam de vez em quando (cada mesa tem 4% de chance por janela de 6 min),
// para parecer gente de verdade e não bot de enfeite. Igual para todos os aparelhos (sorteio pelo relógio).
export const SIT_P = 0.015, SIT_WIN = 6 * 60000;
const h01 = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; };
export function sitting(id, now = Date.now(), max = 2) {
  const pool = botsFor(id), w = Math.floor(now / SIT_WIN);
  if (!pool.length || h01(`${id}|${w}`) >= SIT_P) return [];
  const k = 1 + Math.floor(h01(`${id}#${w}`) * Math.min(max, pool.length)), at = Math.floor(h01(`${id}@${w}`) * pool.length);
  return Array.from({ length: k }, (_, i) => pool[(at + i) % pool.length]);
}
