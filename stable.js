import * as PK from './perks.js';
// Canil e haras: comprar, treinar e inscrever galgos e cavalos em provas. Lógica pura, sem DOM.
import { runRace, officialTimes } from './race.js';

export const KINDS = {
  dog: { label: 'galgo', plural: 'galgos', dist: 480, base: 8000, upkeep: 300, train: 800, vet: 2000, baseTime: 28.3, timeScale: 1, perLen: 0.07,
    w: { spd: 0.5, sta: 0.25, acc: 0.25 }, peak: [18, 54], retire: 72, fees: [1000, 3000, 10000, 30000], age: [16, 40] },
  horse: { label: 'cavalo', plural: 'cavalos', dist: 1600, base: 40000, upkeep: 2000, train: 5000, vet: 10000, baseTime: 96, timeScale: 3.4, perLen: 0.2,
    w: { spd: 0.35, sta: 0.5, acc: 0.15 }, peak: [40, 84], retire: 144, fees: [5000, 15000, 50000, 150000], age: [30, 70] },
};
export const STATS = { spd: 'velocidade', sta: 'resistência', acc: 'largada' };
export const CLASSES = [
  { id: 'e', name: 'estreantes', cap: 55, field: [40, 53] },
  { id: 'b', name: 'classe B', cap: 70, field: [55, 68] },
  { id: 'a', name: 'classe A', cap: 85, field: [70, 83] },
  { id: 'gp', name: 'grande prêmio', cap: 100, field: [78, 92] },
];
export const PRIZE = [4, 1.5, 0.5];          // múltiplos da taxa para 1º, 2º e 3º; só o 1º e o 2º dão lucro
export const WEEKS = 4;
export const SALE = 0.8;

const NAMES = {
  dog: ['Relâmpago', 'Pipoca', 'Trovão', 'Fumaça', 'Bala', 'Faísca', 'Cometa', 'Tufão', 'Paçoca', 'Vulcão', 'Sombra', 'Turbo', 'Ligeirinho', 'Pantera', 'Foguete', 'Furacão'],
  horse: ['Trovador', 'Sertanejo', 'Relincho', 'Galope', 'Centelha', 'Mestiço', 'Caboclo', 'Estrela', 'Tornado', 'Pampa', 'Aurora', 'Bandeirante', 'Zéfiro', 'Ventania', 'Herói', 'Lenda'],
};
export const COAT_COUNT = 6;

export const rating = a => Math.round(KINDS[a.kind].w.spd * a.spd + KINDS[a.kind].w.sta * a.sta + KINDS[a.kind].w.acc * a.acc);
export function ageFactor(kind, age) {
  const [lo, hi] = KINDS[kind].peak;
  if (age < lo) return 0.8 + (0.2 * age) / lo;
  if (age <= hi) return 1;
  return Math.max(0.6, 1 - (age - hi) * 0.012);
}
export const condition = a => 1 - Math.max(0, a.fat - 30) * 0.004;
export const strength = a => rating(a) * ageFactor(a.kind, a.age) * condition(a);
export const retired = a => a.age >= KINDS[a.kind].retire;
export const ready = a => !a.inj && !retired(a) && a.wk > 0;

export function price(kind, r, pot = r + 12) { return Math.round((KINDS[kind].base * Math.exp((r - 45) / 12) * (0.9 + (pot - r) / 100)) / 100) * 100; }
// cavalo de raça vale mais: prêmio da raça e do pedigree (estrelas)
export const BREED_PREM = { psi: 1.25, qm: 1.12, arabe: 1.15, mangalarga: 1.08, crioulo: 1.02 };
export function value(a) {
  const f = retired(a) ? 0.15 : Math.min(1, ageFactor(a.kind, a.age) + 0.1), prem = (BREED_PREM[a.breed] || 1) * (1 + 0.12 * (a.stars || 0));
  return Math.round((price(a.kind, rating(a), a.pot) * f * SALE * prem) / 100) * 100;
}
export const animalsValue = s => (s.stable?.animals || []).reduce((t, a) => t + value(a), 0);
export const trainCost = a => Math.round((KINDS[a.kind].train * (0.5 + rating(a) / 50)) / 10) * 10;
export const upkeep = a => Math.round(KINDS[a.kind].upkeep * (retired(a) ? 0.5 : 1 + rating(a) / 200) * (a.premium ? 1.6 : 1));
// ração premium: custa 60% a mais por mês, mas o animal recupera mais do cansaço
export function togglePremium(s, id) { const a = s.stable.animals.find(x => x.id === id); if (a) a.premium = !a.premium; return a?.premium; }

let rid = 1;
export function newAnimal(kind, target, rng = Math.random, id = 0) {
  const K = KINDS[kind], r = target;
  const pot = Math.min(99, Math.round(r + 8 + rng() * 18));
  const jit = () => Math.round((rng() - 0.5) * 12);
  let spd = r + jit(), sta = r + jit(), acc = r + jit();
  const off = r - (K.w.spd * spd + K.w.sta * sta + K.w.acc * acc);      // recentra para a nota bater com o alvo
  spd += off; sta += off; acc += off;
  const cl = v => Math.max(20, Math.min(pot, Math.round(v)));
  return { id, kind, name: NAMES[kind][Math.floor(rng() * NAMES[kind].length)], coat: Math.floor(rng() * COAT_COUNT), age: K.age[0] + Math.floor(rng() * (K.age[1] - K.age[0])),
    spd: cl(spd), sta: cl(sta), acc: cl(acc), pot, fat: 0, wk: WEEKS, inj: 0, wins: 0, runs: 0, earn: 0, best: 0 };
}

export function ensure(s, rng = Math.random) {
  s.stable ??= { animals: [], offers: [], next: 1 };
  if (!s.stable.offers.length) refreshOffers(s, rng);
}
export function refreshOffers(s, rng = Math.random) {
  const out = [];
  for (const kind of Object.keys(KINDS)) for (const t of [42, 52, 62, 74]) {
    const a = newAnimal(kind, t + Math.round((rng() - 0.5) * 6), rng, s.stable.next++);
    a.cost = price(kind, rating(a), a.pot);
    out.push(a);
  }
  s.stable.offers = out;
}

export function buy(s, id) {
  const a = s.stable.offers.find(o => o.id === id);
  if (!a) return 'esse animal já foi vendido.';
  if (a.cost > s.money) return 'dinheiro insuficiente.';
  s.money -= a.cost;
  s.stable.offers.splice(s.stable.offers.indexOf(a), 1);
  delete a.cost;
  s.stable.animals.push(a);
  return null;
}
export function sell(s, id) {
  const a = s.stable.animals.find(x => x.id === id);
  if (!a) return 0;
  const v = value(a);
  s.money += v;
  s.stable.animals.splice(s.stable.animals.indexOf(a), 1);
  return v;
}
export function treat(s, id) {
  const a = s.stable.animals.find(x => x.id === id);
  if (!a?.inj) return 'sem lesão para tratar.';
  const c = KINDS[a.kind].vet;
  if (c > s.money) return 'dinheiro insuficiente para o veterinário.';
  s.money -= c; a.inj = 0;
  return null;
}

// treino: uma semana, ganho com retorno decrescente até o potencial, cansa e pode lesionar quem treina cansado
// quality: nota do mini-jogo de treino (0,6 a 1,5)
export function train(s, id, stat, rng = Math.random, quality = 1) {
  const a = s.stable.animals.find(x => x.id === id);
  if (!a) return { err: 'animal não encontrado.' };
  if (!ready(a)) return { err: a.inj ? 'está lesionado.' : retired(a) ? 'está aposentado.' : 'sem semanas livres neste mês do mundo (o relógio no topo mostra quando o próximo mês chega).' };
  const cost = trainCost(a);
  if (cost > s.money) return { err: 'dinheiro insuficiente para o treino.' };
  s.money -= cost;
  const q = Math.max(0.5, Math.min(1.5, Number(quality) || 1));
  const gain = Math.max(0.3, (a.pot - a[stat]) / 12) * (0.6 + rng() * 0.8) * q;
  const before = a[stat];
  a[stat] = Math.min(a.pot, +(a[stat] + gain).toFixed(1));
  const risk = a.fat >= 60 ? 0.2 : 0.02;
  a.fat = Math.min(100, a.fat + 25); a.wk--;
  const injured = rng() < risk;
  if (injured) a.inj = 1 + Math.floor(rng() * 2);
  return { gain: +(a[stat] - before).toFixed(1), cost, injured, stat };
}

// ---------- provas ----------
export function events(kind) {
  const K = KINDS[kind];
  return CLASSES.map((c, i) => ({ id: `${kind}-${c.id}`, kind, cls: c, fee: K.fees[i], dist: K.dist, prize: PRIZE.map(m => Math.round(K.fees[i] * m)) }));
}
export const eligible = (a, ev) => a.kind === ev.kind && rating(a) <= ev.cls.cap;

// corre a prova: devolve tudo o que a tela precisa e já aplica o resultado no estado
export function enter(s, id, evId, rng = Math.random) {
  const a = s.stable.animals.find(x => x.id === id), ev = events(a?.kind || 'dog').find(e => e.id === evId);
  if (!a || !ev) return { err: 'prova não encontrada.' };
  if (!ready(a)) return { err: a.inj ? 'está lesionado.' : retired(a) ? 'está aposentado.' : 'sem semanas livres neste mês.' };
  if (!eligible(a, ev)) return { err: `a nota ${rating(a)} passa do limite da ${ev.cls.name}.` };
  if (ev.fee > s.money) return { err: 'dinheiro insuficiente para a taxa de inscrição.' };
  const K = KINDS[a.kind];
  s.money -= ev.fee;
  const used = new Set([a.name]);
  const field = Array.from({ length: 5 }, () => {
    const r = ev.cls.field[0] + rng() * (ev.cls.field[1] - ev.cls.field[0]);
    let n; do { n = NAMES[a.kind][Math.floor(rng() * NAMES[a.kind].length)]; } while (used.has(n) && used.size < NAMES[a.kind].length);
    used.add(n);
    const npc = newAnimal(a.kind, r, rng); npc.name = n; npc.fat = Math.round(rng() * 25); npc.age = Math.round((K.peak[0] + K.peak[1]) / 2 + (rng() - 0.5) * 20);
    return { npc: true, name: n, coat: npc.coat, str: strength(npc), rating: rating(npc) };
  });
  const runners = [{ npc: false, name: a.name, coat: a.coat, str: strength(a), rating: rating(a), id: a.id }, ...field];
  for (let i = runners.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [runners[i], runners[j]] = [runners[j], runners[i]]; }
  runners.forEach((r, i) => { r.lane = i + 1; });
  const w = runners.map(r => r.str ** 6), tot = w.reduce((x, y) => x + y, 0);
  const order = runRace({ dogs: runners.map((r, i) => ({ p: w[i] / tot })) }, rng);
  const T = officialTimes(order, rng, K.baseTime, K.timeScale);
  const pos = order.findIndex(i => runners[i].id === a.id);
  const prize = Math.round((ev.prize[pos] || 0) * PK.mult(s, 'race'));
  s.money += prize;
  a.runs++; a.earn += prize; if (pos === 0) a.wins++;
  a.best = Math.max(a.best, prize);
  a.fat = Math.min(100, a.fat + 30); a.wk--;
  const risk = a.fat - 30 >= 60 ? 0.15 : 0.03;
  const injured = rng() < risk;
  if (injured) a.inj = 1 + Math.floor(rng() * 3);
  return { ev, runners, order, T, pos, prize, injured, fee: ev.fee, kind: a.kind, dist: ev.dist, perLen: K.perLen };
}

// passa o mês: ração e cuidados, descanso, idade, e novos animais no leilão
export function monthly(s, rng = Math.random) {
  const lines = [];
  for (const a of s.stable.animals) {
    const c = upkeep(a);
    s.money -= c; lines.push({ txt: `ração e cuidados, ${a.name}`, val: -c });
    a.age++; a.fat = Math.max(0, a.fat - (a.premium ? 80 : 55)); a.wk = WEEKS; if (a.inj) a.inj--;
    const hi = KINDS[a.kind].peak[1];
    if (a.age > hi && rng() < 0.25) a.spd = Math.max(20, a.spd - 1);
    if (a.age === KINDS[a.kind].retire) lines.push({ txt: `${a.name} se aposentou das pistas`, val: 0 });
  }
  refreshOffers(s, rng);
  return lines;
}

// fotos reais (Wikimedia, créditos em CREDITOS.md). Regra: nenhum animal repete a foto de outro do mesmo dono.
// Cada animal guarda a sua (a.ph) na primeira vez que aparece, escolhida entre as que o dono ainda não usa.
const H = (b, n) => [`h-${b}`, ...Array.from({ length: n - 1 }, (_, k) => `h-${b}${k + 2}`)];
const POOL = {
  psi: ['h-psi', 'h-psi2', 'h-psi4', 'h-psi5', 'h-psi6'], qm: H('qm', 7), arabe: ['h-arabe', 'h-arabe2', 'h-arabe4', 'h-arabe5'],
  mangalarga: H('mangalarga', 6), crioulo: H('crioulo', 4),
  dog: ['d-2', 'd-3', 'd-4', 'd-5', 'd-6', 'd-7', 'd-8', 'd-10', 'd-11', 'd-12', 'd-13', 'd-14', 'd-15'],
};
POOL.horse = [...POOL.psi, ...POOL.qm, ...POOL.arabe, ...POOL.mangalarga, ...POOL.crioulo];
export const PHOTO_POOL = POOL;
const pick = a => (a.coat || 0) + [...String(a.name || '')].reduce((t, c) => t + c.charCodeAt(0), 0);
export function photo(a, s) {
  const pool = a.kind === 'horse' ? POOL[a.breed] || POOL.horse : POOL.dog;
  const taken = new Set([...(s?.stable?.animals || []), ...(s?.stable?.offers || [])].filter(x => x !== a).map(x => x.ph));
  const mine = (s?.stable?.animals || []).includes(a);   // animal comprado com a foto de outro seu: troca
  if (!pool.includes(a.ph) || (mine && taken.has(a.ph))) {
    let k = pick(a) % pool.length;
    for (let n = 0; n < pool.length && taken.has(pool[k]); n++) k = (k + 1) % pool.length;
    a.ph = pool[k];
  }
  return `assets/animals/${a.ph}.webp`;
}
