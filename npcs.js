// Jogadores do mundo (controlados pelo jogo): nicks, visual, fortuna, estatísticas e presença online.
// Tudo é calculado pelo horário e pelo mês do mundo, então é igual para todos os aparelhos.
import { T } from './tune.js';
import { rank, CARS } from './logic.js';

// [nick, patrimônio inicial, crescimento por mês, pele, cabelo, cor do cabelo, barba, roupa, cor da roupa, acessório, frase]
const RAW = [
  ['ReiDoGado', 880000, 0.022, 2, 'degradê', 1, 'por fazer', 'terno', 6, 'relógio de luxo', 'soja de dia, mesa vip de noite 😎'],
  ['A Boiadeira', 720000, 0.026, 1, 'longo', 3, 'nenhuma', 'jaqueta', 2, 'brinco', 'boiada no pasto e galgo na pista'],
  ['Blackjack21', 610000, 0.02, 3, 'curto', 1, 'cavanhaque', 'camisa', 1, 'óculos escuros', '21 é matematica, o resto é choro'],
  ['RainhaDaSoja', 520000, 0.028, 2, 'coque', 4, 'nenhuma', 'camisa', 4, 'corrente de ouro', 'presidenta do mirassol, bora subirrr'],
  ['CriptoTrader', 430000, 0.024, 4, 'boné', 2, 'por fazer', 'moletom', 5, 'boné de marca', 'btc de 5 min ou nada'],
  ['HarasEstrela', 360000, 0.03, 1, 'longo', 5, 'nenhuma', 'regata', 3, 'brinco', 'haras ferraz 🐎'],
  ['TratorBrabo', 300000, 0.02, 5, 'raspado', 1, 'cheia', 'jaqueta', 3, 'fone gamer', 'era entregador, hj sou fazendeiro kkk'],
  ['TerraFirme', 255000, 0.027, 3, 'coque', 2, 'nenhuma', 'camisa', 2, 'pulseira de prata', 'compro terra arrendada, chama'],
  ['RoletaVermelha', 215000, 0.024, 4, 'degradê', 1, 'bigode', 'moletom', 1, 'óculos escuros', 'so no vermelho, sempre'],
  ['FeiraMaster', 180000, 0.031, 2, 'curto', 3, 'nenhuma', 'regata', 6, 'brinco', 'a feira é meu cassino'],
  ['NeloreBR', 150000, 0.02, 3, 'boné', 4, 'por fazer', 'camiseta', 5, 'nenhum', 'nelore no tocantins'],
  ['CafeForte', 128000, 0.026, 1, 'longo', 2, 'nenhuma', 'camiseta', 4, 'nenhum', 'cafe do sul de minas ☕'],
  ['Coringa021', 112000, 0.022, 5, 'raspado', 2, 'cavanhaque', 'jaqueta', 6, 'corrente de ouro', 'aviator 2x e vazo'],
  ['Novato_BR', 98000, 0.025, 2, 'curto', 5, 'nenhuma', 'camisa', 3, 'nenhum', 'comecei agr, bora'],
  ['LoboNoturno', 91000, 0.03, 4, 'degradê', 1, 'por fazer', 'moletom', 2, 'fone gamer', 'so jogo de madrugada'],
  ['DezVezes21', 84000, 0.028, 3, 'boné', 1, 'nenhuma', 'camiseta', 1, 'boné de marca', 'bati 21 cinco vezes seguidas, juro'],
  ['GalgoVeloz', 76000, 0.024, 2, 'curto', 2, 'nenhuma', 'regata', 5, 'nenhum', 'meu galgo vai levar o grande premio, anota'],
  ['CartaRara', 70000, 0.032, 1, 'coque', 3, 'nenhuma', 'camisa', 6, 'brinco', 'carta rara ou nada'],
  ['HighRollerX', 64000, 0.02, 5, 'raspado', 1, 'cheia', 'terno', 6, 'óculos escuros', 'high roller aposentado (mentira)'],
  ['ContaCarta', 59000, 0.027, 5, 'degradê', 1, 'cavanhaque', 'jaqueta', 1, 'corrente de ouro', 'conto carta de cabeça 🧠'],
  ['RelampagoBR', 55000, 0.029, 2, 'longo', 4, 'nenhuma', 'regata', 2, 'brinco', 'treinando o relampago todo mes'],
  ['LeaoDoSport', 52000, 0.023, 3, 'curto', 2, 'por fazer', 'camisa', 3, 'nenhum', 'sou do sport, me aceita'],
  ['Entregador99', 48000, 0.03, 1, 'coque', 1, 'nenhuma', 'moletom', 4, 'nenhum', 'juntando grana pra hilux'],
  ['PrimeiroMes', 44000, 0.026, 4, 'boné', 2, 'nenhuma', 'camiseta', 5, 'nenhum', 'primeiro mes aqui, pega leve'],
  ['TrocaTroca', 41000, 0.028, 2, 'longo', 5, 'nenhuma', 'regata', 6, 'nenhum', 'qm quer trocar carta?'],
  ['RumoAoMilhao', 38000, 0.025, 3, 'degradê', 1, 'nenhuma', 'camiseta', 1, 'nenhum', 'rumo ao primeiro milhao 🤑'],
  ['BTCnaVeia', 35000, 0.03, 1, 'curto', 3, 'nenhuma', 'camisa', 2, 'brinco', 'all in no bitcoin'],
  ['MengaoBR', 32000, 0.027, 4, 'raspado', 2, 'por fazer', 'moletom', 3, 'nenhum', 'mengao sempre'],
  ['So21', 30000, 0.024, 3, 'curto', 1, 'nenhuma', 'camiseta', 4, 'nenhum', 'so 21 e nada mais'],
  ['MetaHaras', 28000, 0.031, 2, 'coque', 4, 'nenhuma', 'regata', 5, 'nenhum', 'meta: ter um haras'],
  ['RecomecoBR', 26000, 0.026, 5, 'boné', 1, 'nenhuma', 'camiseta', 6, 'nenhum', 'recomecei do zero, sem drama'],
  ['SemanaUm', 24000, 0.029, 1, 'longo', 2, 'nenhuma', 'camisa', 1, 'nenhum', 'primeira semana!!'],
];
const hash = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const BASE = RAW.map(([nick, base, g, skin, hair, hairColor, beard, outfit, cloth, acc, bio], i) =>
  ({ id: `n${i}`, i, nick, base, g, bio, look: { name: nick, skin, hair, hairColor, beard, eyes: 1 + (i % 4), outfit, cloth, acc } }));
// mais 140 jogadores com nicks montados de palavras (nunca nome de pessoa)
const PRE = ['Mestre', 'Lobo', 'Touro', 'Falcao', 'Barao', 'Trader', 'Safra', 'Galgo', 'Ficha', 'Roleta', 'Dama', 'Valete', 'Corvo', 'Tigre', 'Pantera', 'Dragao', 'Lenda', 'Ninja', 'Sniper', 'Capitao', 'Fazendeiro', 'Peao', 'Boiadeiro', 'Vaqueiro', 'Sorte', 'Trevo', 'Diamante', 'Esmeralda', 'Aguia', 'Raio', 'Furia', 'Brabo', 'Zica', 'Turbo', 'Nitro', 'Fenix', 'Cometa', 'Tropeiro', 'Cavaleiro', 'Magnata'];
const SUF = ['21', 'BR', 'Gamer', 'Rico', 'Pro', 'X', '777', 'Ouro', 'Prime', 'MT', 'GO', 'SP', 'MG', 'PR', 'Top', 'Real', '99', 'Max', 'Neo', 'Zero'];
const BIOS = ['so jogo de noite', 'rumo ao top 10', 'gado, soja e 21', 'mesa vip ou nada', 'colecionando carta rara', 'treinando galgo todo mes', 'trader de 1 min kkk', 'fazenda no mato grosso', 'granja e pomar, o resto é sorte', 'aviator até 2x e tchau', 'comecei do zero', 'qm quer trocar?', 'meta: primeiro milhao', 'meu time ta subindo', 'roleta so no preto', 'nao me chama no pv pra pedir dinheiro kkk', 'vivendo de safra', 'perdi tudo 2x e voltei', 'aqui é trabalho, nao sorte'];
const HAIR = ['curto', 'degradê', 'longo', 'coque', 'raspado', 'boné'], OUT = ['camiseta', 'moletom', 'regata', 'camisa', 'jaqueta', 'terno'], ACC = ['nenhum', 'nenhum', 'brinco', 'óculos escuros', 'fone gamer', 'corrente de ouro', 'boné de marca'];
const r0 = n => { const x = Math.sin(n * 91.3 + 7.1) * 43758.5453; return x - Math.floor(x); };
const used = new Set(BASE.map(n => n.nick.toLowerCase()));
const EXTRA = [];
for (let k = 0; EXTRA.length < 140 && k < 2000; k++) {
  const sep = ['', '_', '.', ''][Math.floor(r0(k * 3) * 4)];
  let nick = PRE[Math.floor(r0(k) * PRE.length)] + sep + SUF[Math.floor(r0(k + 500) * SUF.length)];
  if (r0(k + 900) < 0.25) nick = nick.toLowerCase();
  if (used.has(nick.toLowerCase())) continue;
  used.add(nick.toLowerCase());
  const i = BASE.length + EXTRA.length, w = r0(k + 1300);
  EXTRA.push({ id: `n${i}`, i, nick, base: Math.round(15000 + w * w * 420000), g: 0.015 + r0(k + 1700) * 0.02, bio: BIOS[Math.floor(r0(k + 2100) * BIOS.length)],
    look: { name: nick, skin: 1 + Math.floor(r0(k + 2500) * 5), hair: HAIR[Math.floor(r0(k + 2900) * 6)], hairColor: 1 + Math.floor(r0(k + 3300) * 5), beard: ['nenhuma', 'por fazer', 'cavanhaque', 'bigode', 'cheia'][Math.floor(r0(k + 3700) * 5)], eyes: 1 + (i % 4), outfit: OUT[Math.floor(r0(k + 4100) * 6)], cloth: 1 + Math.floor(r0(k + 4500) * 6), acc: ACC[Math.floor(r0(k + 4900) * ACC.length)] } });
}
export const NPCS = [...BASE, ...EXTRA];
// folga: jogadores fora do jogo até a hora indicada (UTC). 12:20 de Brasília = 15:20 UTC. Apague a linha para voltarem antes.
export const AWAY = { 'ReiDoGado': Date.UTC(2026, 10, 21, 15, 20), 'A Boiadeira': Date.UTC(2026, 10, 21, 15, 20) };
export const isAway = (n, now = Date.now()) => (AWAY[n?.nick ?? n] || 0) > now;
export const byId = id => NPCS.find(n => n.id === id);
export const byNick = nick => NPCS.find(n => n.nick === nick);
export const nicks = (from, n) => Array.from({ length: n }, (_, k) => NPCS[(from + k * 7) % NPCS.length].nick);

export const NPC_LATE = 1.004, NPC_LATE_CAP = 6;
// o reforço não entra de uma vez: começa no mês 440 do mundo (19/11/2026) e chega ao total em ~1 mês real (4320 meses de 10 min)
export const NPC_RAMP_START = 440;   // força final e dias da rampa: painel admin (tune.js)
// fortuna no mês do mundo (pode ser fracionário: anda devagar entre um mês e outro)
export function worthAt(n, month) {
  const m = Math.min(48, Math.max(0, month - 1));   // arrancada nos primeiros 48 meses (~8 h de jogo)
  const late = Math.min(NPC_LATE_CAP, NPC_LATE ** Math.max(0, month - 49)), NPC_RAMP = T.npcRampDays * 144;   // depois seguem crescendo devagar, até 6x
  const wave = 1 + 0.07 * Math.sin(month * 0.7 + n.i * 2.1) + 0.03 * Math.sin(month * 2.3 + n.i);
  const boost = 1 + (T.npcBoost - 1) * Math.min(1, m / 48);   // mundo novo continua alcançável
  const r = Math.min(1, Math.max(0, (month - NPC_RAMP_START) / NPC_RAMP));   // 0 em 19/11/2026, 1 daqui a um mês
  return Math.round(n.base * (1 + n.g * 0.55) ** m * (1 + (boost * late - 1) * r) * wave);
}
export const levelFor = worth => Math.max(1, Math.min(60, Math.round(Math.log10(Math.max(10, worth)) * 7 - 28)));

// perfil completo (para a janela de perfil)
export function profile(n, month) {
  const worth = worthAt(n, month), lv = levelFor(worth), r = k => hash(n.i * 31 + k);
  const hands = Math.round(80 + lv * 45 + r(1) * 400), cars = Object.keys(CARS).filter(c => CARS[c].type !== 'maquina' && CARS[c].price < worth * 0.6).slice(-1 - Math.floor(r(2) * 2));
  return {
    npc: true, id: n.id, name: n.nick, look: n.look, level: lv, rank: rank(worth), worth, bio: n.bio,
    stats: { hands, wins: Math.round(hands * (0.38 + r(3) * 0.08)), best: Math.round(200 + r(4) * worth / 200), races: Math.round(r(5) * 60), raceWins: Math.round(r(6) * 14) },
    lands: Math.floor(worth / 250000), ha: Math.floor(worth / 250000) * (30 + Math.floor(r(7) * 70)), heads: Math.floor(worth / 60000) * 10,
    cars, animals: Array.from({ length: Math.floor(r(8) * 3) }, (_, k) => ({ kind: k % 2 ? 'horse' : 'dog', name: '', rating: 50 + Math.floor(r(9 + k) * 30), wins: Math.floor(r(12 + k) * 8) })),
    achCount: Math.min(20, 2 + Math.floor(lv / 2)),
  };
}

// ---------- quantas pessoas estão jogando agora (sobe à noite, cai de madrugada) ----------
// curva por hora do dia no horário de Brasília (UTC-3)
const CURVE = [58, 46, 38, 33, 30, 31, 36, 42, 48, 52, 55, 58, 62, 60, 57, 58, 63, 70, 78, 88, 96, 102, 94, 74];
const smooth = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
export function onlineCount(now = Date.now()) {
  const h = ((now / 3600000 - 3) % 24 + 24) % 24, i = Math.floor(h), f = h - i;
  const base = CURVE[i] * (1 - f) + CURVE[(i + 1) % 24] * f;
  return Math.round(base + (smooth(now / 420000) - 0.5) * 10);          // pequenas entradas e saídas a cada poucos minutos
}
// quem está online agora (rodízio a cada 20 min; sempre os mesmos para todos os aparelhos)
export function onlineSet(now = Date.now()) {
  const slot = Math.floor(now / 1200000);
  return new Set([...NPCS].filter(n => !isAway(n, now)).sort((a, b) => hash(a.i * 97 + slot) - hash(b.i * 97 + slot)).slice(0, Math.min(NPCS.length, onlineCount(now))).map(n => n.id));
}
export function onlineNow(now = Date.now(), max = 12) {
  const slot = Math.floor(now / 1200000), want = Math.min(NPCS.length, Math.max(4, Math.round(onlineCount(now) / 5)));
  return [...NPCS].filter(n => !isAway(n, now)).sort((a, b) => hash(a.i * 97 + slot) - hash(b.i * 97 + slot)).slice(0, Math.min(max, want));
}

// vez de quem fala na TV 21 / Resenha: ordem embaralhada fixa (igual em todo aparelho), um por janela e sem repetir
// quem falou nas últimas janelas (gap = tamanho da janela em ms), para não aparecer sempre o mesmo jogador
const nickHash = s => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const nicksAt = t => [...onlineSet(t)].map(id => byId(id)?.nick).filter(Boolean);
function rot(slot, nicks, avoid) {
  const o = [...nicks].sort((a, b) => nickHash(a) - nickHash(b) || (a < b ? -1 : 1));
  for (let k = 0; k < o.length; k++) { const n = o[((slot + k) % o.length + o.length) % o.length]; if (!avoid.has(n)) return n; }
  return o[((slot % o.length) + o.length) % o.length] ?? null;
}
export const TURN_AVOID = 6;
export function turnOf(slot, nicks, gap) {
  if (!nicks.length) return null;
  // refaz em ordem as janelas anteriores (cada uma evitando as suas anteriores), igual em todo aparelho
  const chain = [];
  if (gap) for (let k = TURN_AVOID * 2; k >= 1; k--) chain.push(rot(slot - k, nicksAt((slot - k) * gap), new Set(chain.slice(-TURN_AVOID))));
  return rot(slot, nicks, new Set(chain.slice(-TURN_AVOID)));
}
