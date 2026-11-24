// Concorrentes do ranking: jogadores fixos do mundo, iguais para todo mundo (regras puras).
// A fortuna deles cresce com o tempo de mundo (com altos e baixos), então o ranking se mexe sozinho mesmo sem ninguém online.
import { T } from './tune.js';
import { rank } from './logic.js';

import { NPCS, isAway, EARLY, startMonth, worthAt as npcWorth, levelFor as npcLevel, FALL, FALLEN, SHOWN, crashHunt, HEAVY, heavyOf } from './npcs.js';
// volta dos dois caídos: da posição 13/14 até passar o 1º em CLIMB_DAYS reais (posição fracionária entre os vizinhos, sem salto)
export const CLIMB_DAYS = 7, CLIMB_FROM = { n0: 12, n1: 13 };
export const levelFor = npcLevel;
// month pode ser fracionário (mês + progresso), para os números andarem de verdade
// caçadores do topo: os 3 maiores concorrentes do mundo perseguem o líder real (leader = maior patrimônio de jogador).
// O 1º caçador fica em média ~4% acima do líder, com uma onda lenta: o jogador só segura o 1º lugar nos vales da onda.
// escada apertada: 16 bots colados atrás do líder, trocando de posição entre si com a onda (disputa de verdade)
export const HUNT = [1, 0.985, 0.97, 0.955, 0.94, 0.92, 0.9, 0.88, 0.855, 0.83, 0.8, 0.77, 0.74, 0.71, 0.68, 0.65], HUNT_WAVE = 0.012;
// ciclo da disputa pelo 1º lugar (tempo real): o jogador que passa fica na frente um bom tempo (~30 h), depois os bots
// sobem aos poucos (~9 h), ficam na frente (~16 h) e recuam (~5 h). Igual para todo mundo, sem saltos.
export const HUNT_CYCLE = 60 * 36e5, HUNT_LOW = 0.9;
const ss = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export function huntLevel(t = Date.now(), top = T.huntLead) {
  const u = (t % HUNT_CYCLE) / HUNT_CYCLE;
  return HUNT_LOW + (top - HUNT_LOW) * (ss((u - 0.5) / 0.2) - ss((u - 0.92) / 0.08));   // sobe bem devagar (~12 h)
}
export const NEAR = [1.03, 1.09, 1.17];   // vizinhos: sempre tem alguém logo acima de você
export const hunted = SHOWN;   // id do npc -> fortuna mostrada no ranking (worthAt devolve esta: nível e perfil batem em todas as telas)
export function rivals(month, leader = 0, me = 0, t = Date.now()) {
  const rows = NPCS.filter(n => month >= startMonth(n)).map(n => { const worth = npcWorth(n, month, t, true); return { away: isAway(n) || (FALLEN.has(n.id) && t >= FALL), pid: `npc:${n.id}`, id: n.id, name: n.nick, worth, look: n.look }; });
  hunted.clear();
  const early = month < EARLY;   // largada: os jogadores têm chance de passar os bots
  if (leader > 0 && T.hunt && !early) [...rows].filter(r => !r.away).sort((a, b) => b.worth - a.worth).slice(0, HUNT.length).forEach((r, k) => {
    const chase = Math.round(Math.min(leader * T.huntLead, leader * (HUNT[k] / HUNT[0]) * huntLevel(t) * (1 + HUNT_WAVE * Math.sin(month * 0.9 + k * 2.1))) * crashHunt(t) * (HEAVY.has(r.id) ? heavyOf(t) : 1));   // quebra do fundo: o topo também cai e volta devagar   // nunca passa muito do 1º
    if (chase > r.worth) { r.worth = chase; hunted.set(r.id, chase); }
  });
  if (T.near && !early && me > 0 && me < leader) {   // quem não é o líder sempre tem 3 concorrentes logo acima (os seguintes depois dos caçadores)
    const free = [...rows].filter(r => !r.away).sort((a, b) => b.worth - a.worth).filter(r => !hunted.has(r.id)).slice(0, NEAR.length);
    free.forEach((r, k) => { const near = Math.round(me * NEAR[k] * (1 + 0.03 * Math.sin(month * 1.3 + k))); if (near > r.worth && near < leader) { r.worth = near; hunted.set(r.id, near); } });
  }
  if (t >= FALL) {   // os dois caídos: posição que sobe devagar; acima do 1º acompanham o ciclo da disputa (o jogador ainda pode liderar)
    const vals = [...rows.filter(r => !FALLEN.has(r.id)).map(r => r.worth), leader].filter(v => v > 0).sort((a, b) => b - a), u = ss((t - FALL) / (CLIMB_DAYS * 864e5));
    for (const r of rows.filter(r => FALLEN.has(r.id))) {
      const p = CLIMB_FROM[r.id] - (CLIMB_FROM[r.id] + (r.id === 'n1' ? 0.3 : 0.6)) * u, top = vals[0] || 1e6;
      const fin = leader > 0 ? leader * huntLevel(t) * (r.id === 'n1' ? 0.99 : 1.005) : top * 1.01;
      let w; if (p >= 0) { const i = Math.max(0, Math.min(Math.floor(p), vals.length - 2)), f = p - i, a = vals[i] || top, b = vals[i + 1] || a * 0.95; w = a * (b / a) ** f; }   // entre o vizinho de cima e o de baixo
      else w = top + (fin - top) * Math.min(1, -p / 0.5);
      r.worth = Math.round(w * (1 + 0.004 * Math.sin(t / 36e5 * 1.7 + (r.id === 'n1' ? 2 : 0)))); hunted.set(r.id, r.worth);
    }
  }
  return rows.map(({ id, away, ...r }) => ({ ...r, level: npcLevel(r.worth), rank: rank(r.worth) }));
}
// ranking final: jogadores reais da nuvem (com o seu valor sempre ao vivo), vizinhos online e os concorrentes do mundo
export const START = 10000, SHOW_MIN = 25000;   // bots só entram no ranking e nos destaques a partir de R$ 25 mil
export function merge({ cloud = [], me, peers = [], rivalRows = [], limit = 10 }) {
  const rows = new Map();
  const put = (r, tag) => { const k = r.name.trim().toLowerCase(); const cur = rows.get(k); if (!cur || tag === 'me' || (cur.tag !== 'me' && r.worth >= cur.worth)) rows.set(k, { ...r, tag }); };
  const idle = r => Number(r.worth) <= START;   // quem está parado nos R$ 10 mil do começo não entra no ranking (você sempre se vê)
  rivalRows.forEach(r => put(r, 'npc'));   // o bot aparece quando chega ao mundo (startMonth)
  cloud.filter(r => !idle(r)).forEach(r => put(r, 'cloud'));
  peers.filter(r => !idle(r)).forEach(r => put(r, 'peer'));
  if (me && !idle(me)) put(me, 'me');   // quem ainda está nos R$ 10 mil do começo não ganha posição (antes aparecia um "você" sozinho em 1º)
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
