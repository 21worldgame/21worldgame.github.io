// Concorrentes do ranking: jogadores fixos do mundo, iguais para todo mundo (regras puras).
// A fortuna deles cresce com o tempo de mundo (com altos e baixos), então o ranking se mexe sozinho mesmo sem ninguém online.
import { rank } from './logic.js';

import { NPCS, worthAt as npcWorth, levelFor as npcLevel } from './npcs.js';
export const levelFor = npcLevel;
// month pode ser fracionário (mês + progresso), para os números andarem de verdade
// caçadores do topo: os 3 maiores concorrentes do mundo perseguem o líder real (leader = maior patrimônio de jogador).
// O 1º caçador fica em média ~4% acima do líder, com uma onda lenta: o jogador só segura o 1º lugar nos vales da onda.
export const HUNT = [1.04, 0.99, 0.94, 0.88, 0.83, 0.77, 0.72, 0.66, 0.6, 0.55], HUNT_WAVE = 0.06;
export const NEAR = [1.03, 1.09, 1.17];   // vizinhos: sempre tem alguém logo acima de você
export const hunted = new Map();   // id do npc -> fortuna de caçador (para o perfil mostrar o mesmo número do ranking)
export function rivals(month, leader = 0, me = 0) {
  const rows = NPCS.map(n => { const worth = npcWorth(n, month); return { pid: `npc:${n.id}`, id: n.id, name: n.nick, worth, look: n.look }; });
  hunted.clear();
  if (leader > 0) [...rows].sort((a, b) => b.worth - a.worth).slice(0, HUNT.length).forEach((r, k) => {
    const chase = Math.round(leader * HUNT[k] * (1 + HUNT_WAVE * Math.sin(month * 0.9 + k * 2.1)));
    if (chase > r.worth) { r.worth = chase; hunted.set(r.id, chase); }
  });
  if (me > 0 && me < leader) {   // quem não é o líder sempre tem 3 concorrentes logo acima (os seguintes depois dos caçadores)
    const free = [...rows].sort((a, b) => b.worth - a.worth).filter(r => !hunted.has(r.id)).slice(0, NEAR.length);
    free.forEach((r, k) => { const near = Math.round(me * NEAR[k] * (1 + 0.03 * Math.sin(month * 1.3 + k))); if (near > r.worth && near < leader) { r.worth = near; hunted.set(r.id, near); } });
  }
  return rows.map(({ id, ...r }) => ({ ...r, level: npcLevel(r.worth), rank: rank(r.worth) }));
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
