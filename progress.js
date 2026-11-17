// Progressão: XP/nível, bônus diário, missões do dia e conquistas. Sem DOM.
import { netWorth, heads } from './logic.js';

export const XP = { hand: 10, win: 25, '21': 40, calves: 15, sellherd: 30, plant: 30, harvest: 40, land: 50, car: 60,
  month: 5, race: 8, raceWin: 30, lend: 20, onlineHand: 20,
  buyAnimal: 30, train: 10, stakeRun: 15, stakeWin: 60, stakeGP: 120, roulette: 6, rouletteWin: 20, aviator: 6, cashout: 15, trade: 10, tradeWin: 30, car: 60 };
export const xpNeed = level => 100 * level;           // XP para sair do nível atual
export const levelReward = level => 100 * level;      // fichas ao subir

export const MISSIONS = [
  { id: 'hands5', txt: 'Jogue 5 mãos de 21', ev: 'hand', goal: 5, reward: 300 },
  { id: 'win2', txt: 'Vença 2 mãos', ev: 'win', goal: 2, reward: 400 },
  { id: 'bj', txt: 'Faça um 21', ev: '21', goal: 1, reward: 500 },
  { id: 'calves', txt: 'Compre bezerros', ev: 'calves', goal: 1, reward: 250 },
  { id: 'sellherd', txt: 'Venda um lote de gado', ev: 'sellherd', goal: 1, reward: 400 },
  { id: 'plant', txt: 'Plante uma lavoura', ev: 'plant', goal: 1, reward: 400 },
  { id: 'month2', txt: 'Passe 2 meses', ev: 'month', goal: 2, reward: 300 },
  { id: 'race3', txt: 'Aposte em 3 corridas', ev: 'race', goal: 3, reward: 300 },
  { id: 'racewin', txt: 'Acerte o vencedor de uma corrida', ev: 'raceWin', goal: 1, reward: 500 },
  { id: 'land', txt: 'Compre ou arrende uma terra', ev: 'land', goal: 1, reward: 400 },
  { id: 'lend', txt: 'Empreste para alguém', ev: 'lend', goal: 1, reward: 300 },
  { id: 'online', txt: 'Jogue uma mão numa mesa online', ev: 'onlineHand', goal: 1, reward: 600 },
  { id: 'train1', txt: 'Treine um dos seus animais', ev: 'train', goal: 1, reward: 300 },
  { id: 'stake1', txt: 'Inscreva um animal seu numa prova', ev: 'stakeRun', goal: 1, reward: 450 },
  { id: 'roleta3', txt: 'Gire a roleta 3 vezes', ev: 'roulette', goal: 3, reward: 300 },
  { id: 'roletawin', txt: 'Ganhe uma rodada na roleta', ev: 'rouletteWin', goal: 1, reward: 400 },
  { id: 'cashout2', txt: 'Saque 2 vezes no Aviator', ev: 'cashout', goal: 2, reward: 400 },
  { id: 'trade', txt: 'Feche uma operação com lucro no trader', ev: 'tradeWin', goal: 1, reward: 600 },
];

export const ACHIEVEMENTS = [
  { id: 'first-hand', txt: 'Primeira mão', ev: 'hand', goal: 1 },
  { id: 'hands100', txt: '100 mãos jogadas', ev: 'hand', goal: 100 },
  { id: 'bj', txt: 'Vinte e um', ev: '21', goal: 1 },
  { id: 'bj10', txt: '10 vezes 21', ev: '21', goal: 10 },
  { id: 'race-win', txt: 'Pé quente nas corridas', ev: 'raceWin', goal: 1 },
  { id: 'friends', txt: 'Jogou com amigos', ev: 'onlineHand', goal: 1 },
  { id: 'land', txt: 'Dono de terra', ev: 'land', goal: 1 },
  { id: 'harvest', txt: 'Primeira colheita', ev: 'harvest', goal: 1 },
  { id: 'car', txt: 'Primeiro carro', ev: 'car', goal: 1 },
  { id: 'owner', txt: 'Dono de um animal de corrida', ev: 'buyAnimal', goal: 1 },
  { id: 'champ', txt: 'Campeão: venceu uma prova', ev: 'stakeWin', goal: 1 },
  { id: 'gpwin', txt: 'Venceu um grande prêmio', ev: 'stakeGP', goal: 1 },
  { id: 'stable5', txt: 'Canil e haras com 5 animais', check: s => (s.stable?.animals.length || 0) >= 5 },
  { id: 'pilot', txt: 'Aviador: sacou 10x ou mais', ev: 'cashout10', goal: 1 },
  { id: 'straight', txt: 'Número cheio na roleta', ev: 'straight', goal: 1 },
  { id: 'trader', txt: 'Lucro no trader', ev: 'tradeWin', goal: 1 },
  { id: 'hyper', txt: 'Dono de hiperesportivo', ev: 'hypercar', goal: 1 },
  { id: 'herd100', txt: '100 cabeças no pasto', check: s => heads(s) >= 100 },
  { id: 'million', txt: 'Milionário', check: s => netWorth(s) >= 1e6 },
  { id: 'magnata', txt: 'Magnata', check: s => netWorth(s) >= 2e6 },
  { id: 'streak7', txt: '7 dias seguidos', check: s => (s.daily?.streak || 0) >= 7 },
];

export function ensure(s, today) {
  s.xp ??= 0; s.level ??= 1; s.ach ??= []; s.counts ??= {};
  s.stats ??= { hands: 0, wins: 0, best: 0, races: 0, raceWins: 0 };
  s.daily ??= { last: null, streak: 0 };
  if (s.missions?.date !== today) {
    let h = 0; for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pool = [...MISSIONS], list = [];
    while (list.length < 3) { h = (h * 1103515245 + 12345) >>> 0; list.push(pool.splice(h % pool.length, 1)[0]); }
    s.missions = { date: today, list: list.map(m => ({ id: m.id, prog: 0, claimed: false })) };
  }
}

// registra um evento; devolve o que destravou para a interface comemorar
export function track(s, ev, n = 1) {
  const out = { levels: [], ach: [], missions: [] };
  s.counts[ev] = (s.counts[ev] || 0) + n;
  for (const m of s.missions.list) {
    const def = MISSIONS.find(x => x.id === m.id);
    if (def.ev !== ev || m.prog >= def.goal) continue;
    m.prog = Math.min(def.goal, m.prog + n);
    if (m.prog >= def.goal) out.missions.push(def);
  }
  s.xp += (XP[ev] || 0) * n;
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level); s.level++;
    s.chips += levelReward(s.level);
    out.levels.push(s.level);
  }
  out.ach = checkAch(s);
  return out;
}

// XP direto (prêmio da roda diária)
export function addXp(s, n) {
  s.xp += n; const levels = [];
  while (s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; s.chips += levelReward(s.level); levels.push(s.level); }
  return levels;
}

export function checkAch(s) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (s.ach.includes(a.id)) continue;
    if (a.check ? a.check(s) : (s.counts[a.ev] || 0) >= a.goal) { s.ach.push(a.id); got.push(a); }
  }
  return got;
}

export function claimMission(s, id) {
  const m = s.missions.list.find(x => x.id === id), def = MISSIONS.find(x => x.id === id);
  if (!m || m.claimed || m.prog < def.goal) return 0;
  m.claimed = true; s.chips += def.reward;
  return def.reward;
}

// bônus diário: sequência de 7 dias, o 7º paga em dobro
export const dailyReward = streak => 200 * Math.min(streak, 7) * (streak % 7 === 0 ? 2 : 1);
export function dailyStatus(s, today, yesterday) {
  if (s.daily.last === today) return null;
  return { streak: s.daily.last === yesterday ? s.daily.streak + 1 : 1 };
}
export function claimDaily(s, today, yesterday, payChips = true) {
  const st = dailyStatus(s, today, yesterday);
  if (!st) return 0;
  s.daily = { last: today, streak: st.streak };
  const r = dailyReward(st.streak);
  if (payChips) s.chips += r;
  return r;
}
