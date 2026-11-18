// Concorrentes do ranking: jogadores fixos do mundo, iguais para todo mundo (regras puras).
// A fortuna deles cresce com o tempo de mundo (com altos e baixos), então o ranking se mexe sozinho mesmo sem ninguém online.
import { rank } from './logic.js';

import { NPCS, worthAt as npcWorth, levelFor as npcLevel } from './npcs.js';
export const levelFor = npcLevel;
// month pode ser fracionário (mês + progresso), para os números andarem de verdade
export function rivals(month) {
  return NPCS.map(n => { const worth = npcWorth(n, month); return { pid: `npc:${n.id}`, name: n.nick, level: npcLevel(worth), worth, rank: rank(worth), look: n.look }; });
}
// ranking final: jogadores reais da nuvem (com o seu valor sempre ao vivo), vizinhos online e os concorrentes do mundo
export function merge({ cloud = [], me, peers = [], rivalRows = [], limit = 10 }) {
  const rows = new Map();
  const put = (r, tag) => { const k = r.name.trim().toLowerCase(); const cur = rows.get(k); if (!cur || tag === 'me' || (cur.tag !== 'me' && r.worth >= cur.worth)) rows.set(k, { ...r, tag }); };
  rivalRows.forEach(r => put(r, 'npc'));
  cloud.forEach(r => put(r, 'cloud'));
  peers.forEach(r => put(r, 'peer'));
  if (me) put(me, 'me');
  return [...rows.values()].sort((a, b) => b.worth - a.worth).slice(0, limit);
}

// fazendas dos concorrentes no mapa: 2 a 3 lotes cada, posição fixa por nome
import { REGIONS } from './logic.js';
export function rivalLands() {
  const out = [];
  NPCS.slice(0, 14).forEach(({ nick: name }, i) => {
    let seed = i * 7919 + 17; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 2 + (i % 2); k++) {
      const reg = REGIONS[Math.floor(rnd() * REGIONS.length)];
      out.push({ owner: name, region: reg.name, uf: reg.uf, city: reg.city, use: reg.use, ha: 20 + Math.floor(rnd() * 30) * 10,
        lat: +(reg.lat + (rnd() - 0.5) * 0.9).toFixed(5), lon: +(reg.lon + (rnd() - 0.5) * 0.9).toFixed(5), sede: rnd() < 0.4 });
    }
  });
  return out;
}
