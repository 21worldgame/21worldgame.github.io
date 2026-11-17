// Concorrentes do ranking: jogadores fixos do mundo, iguais para todo mundo (regras puras).
// A fortuna deles cresce com o tempo de mundo (com altos e baixos), então o ranking se mexe sozinho mesmo sem ninguém online.
import { rank } from './logic.js';

// [nome, patrimônio inicial, ritmo de crescimento por mês, pele, cabelo, cor do cabelo, roupa, cor da roupa, acessório]
const R = [
  ['Rafael Moura', 6400000, 0.034, 2, 'degradê', 1, 'terno', 6, 'relógio de luxo'], ['Camila Duarte', 4100000, 0.04, 1, 'longo', 3, 'jaqueta', 2, 'brinco'],
  ['Thiago Barros', 2700000, 0.03, 3, 'curto', 1, 'camisa', 1, 'óculos escuros'], ['Larissa Prado', 1850000, 0.045, 2, 'coque', 4, 'camisa', 4, 'corrente de ouro'],
  ['Gustavo Neves', 1200000, 0.036, 4, 'boné', 2, 'moletom', 5, 'nenhum'], ['Bianca Ferraz', 820000, 0.05, 1, 'longo', 5, 'regata', 3, 'brinco'],
  ['Marcelo Tavares', 560000, 0.033, 5, 'raspado', 1, 'jaqueta', 3, 'fone gamer'], ['Patrícia Lopes', 380000, 0.048, 3, 'coque', 2, 'camisa', 2, 'nenhum'],
  ['Danilo Quintino', 255000, 0.041, 4, 'degradê', 1, 'moletom', 1, 'óculos escuros'], ['Júlia Andrade', 170000, 0.055, 2, 'curto', 3, 'regata', 6, 'brinco'],
  ['Renato Vilela', 118000, 0.038, 3, 'boné', 4, 'camiseta', 5, 'nenhum'], ['Aline Cordeiro', 82000, 0.05, 1, 'longo', 2, 'camiseta', 4, 'nenhum'],
];
export function worthAt(i, month) {
  const [, base, g] = R[i];
  const wave = 1 + 0.06 * Math.sin(month * 0.7 + i * 2.1) + 0.03 * Math.sin(month * 2.3 + i);
  return Math.round(base * (1 + g) ** (month - 1) * wave);
}
export const levelFor = worth => Math.max(1, Math.min(60, Math.round(Math.log10(Math.max(10, worth)) * 6 - 18)));
// month pode ser fracionário (mês + progresso), para os números andarem de verdade
export function rivals(month) {
  return R.map(([name, , , skin, hair, hairColor, outfit, cloth, acc], i) => {
    const worth = worthAt(i, month);
    return { name, level: levelFor(worth), worth, rank: rank(worth), look: { skin, hair, hairColor, beard: i % 3 === 0 ? 'por fazer' : 'nenhuma', eyes: 1 + (i % 4), outfit, cloth, acc } };
  });
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
