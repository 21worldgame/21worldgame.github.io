// Leilão de cavalos de raça (regras puras): um leilão a cada 6 min, o dia inteiro, igual para todos (semente = horário).
// 1 min de apresentação do animal, 4 min de lances. Jogadores do mundo dão lances até o limite de cada um;
// lances de pessoas chegam pelo salão e entram na mesma conta. Quem estiver na frente no fim leva.
import * as ST from './stable.js';

export const BREEDS = {
  psi: { name: 'Puro-Sangue Inglês', spd: 6, sta: 0, acc: 2, prem: 1.25, note: 'o mais veloz das pistas' },
  qm: { name: 'Quarto de Milha', spd: 3, sta: -2, acc: 8, prem: 1.12, note: 'largada explosiva' },
  arabe: { name: 'Árabe', spd: 1, sta: 8, acc: 0, prem: 1.15, note: 'resistência de longa distância' },
  mangalarga: { name: 'Mangalarga Marchador', spd: 0, sta: 5, acc: 3, prem: 1.08, note: 'marcha macia e firme' },
  crioulo: { name: 'Crioulo', spd: 0, sta: 6, acc: 1, prem: 1.02, note: 'rústico e resistente' },
};
// galgos de raça (leilão do canil): mais velozes que os galgos comuns do canil
export const DOG_BREEDS = {
  greyhound: { name: 'Greyhound Inglês', spd: 9, sta: 0, acc: 4, prem: 1.25, note: 'o cão mais rápido do mundo' },
  whippet: { name: 'Whippet', spd: 6, sta: -1, acc: 9, prem: 1.15, note: 'arrancada fulminante' },
  saluki: { name: 'Saluki', spd: 5, sta: 8, acc: 1, prem: 1.18, note: 'velocidade que não cansa' },
  galgoesp: { name: 'Galgo Espanhol', spd: 7, sta: 4, acc: 3, prem: 1.12, note: 'equilibrado e forte' },
  afghan: { name: 'Afghan Hound', spd: 6, sta: 3, acc: 5, prem: 1.1, note: 'elegante e ágil' },
};
export const breedsOf = kind => (kind === 'dog' ? DOG_BREEDS : BREEDS);
export const STAR_W = [40, 30, 18, 9, 3];   // pedigree de 1 a 5 estrelas
export const SLOT = 6 * 60 * 1000, PREVIEW = 30 * 1000, BIDDING = 5 * 60 * 1000;   // leilões emendados: 30 s de apresentação, 5 min de lances, 30 s até o próximo
const SUF = ['do Pampa', 'Imperial', 'da Serra', 'Real', 'de Ouro', 'Campeão', 'do Vale', 'Dourado', 'Negro', 'da Coroa'];
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const slotOf = now => Math.floor(now / SLOT);
export const opensAt = slot => slot * SLOT + PREVIEW, endsAt = slot => slot * SLOT + PREVIEW + BIDDING;
export const phaseOf = (slot, now) => (now < opensAt(slot) ? 'preview' : now < endsAt(slot) ? 'live' : 'closed');
// valor do cavalo de raça: raça e pedigree valorizam
export const breedValue = a => Math.round(ST.value(a) / 1000) * 1000;   // o prêmio da raça e do pedigree já está em ST.value

const cache = new Map();
export function lot(slot, nicks = [], kind = 'horse') {
  const ck = `${kind}:${slot}`; if (cache.has(ck)) return cache.get(ck);
  const BR = breedsOf(kind), r = rng(slot * 7331 + 19 + (kind === 'dog' ? 500009 : 0)), keys = Object.keys(BR), breed = keys[Math.floor(r() * keys.length)], B = BR[breed];
  let x = r() * 100, stars = 1; for (let i = 0; i < 5; i++) { if ((x -= STAR_W[i]) < 0) { stars = i + 1; break; } }
  const a = ST.newAnimal(kind, Math.round(46 + stars * 6 + r() * 8) + (kind === 'dog' ? 4 : 0), r, 0);
  for (const k of ['spd', 'sta', 'acc']) a[k] = Math.max(20, Math.min(99, a[k] + B[k] + stars));
  a.pot = Math.min(99, Math.max(a.pot, Math.max(a.spd, a.sta, a.acc) + 4));
  a.breed = breed; a.stars = stars; a.name = `${a.name} ${SUF[Math.floor(r() * SUF.length)]}`; a.age = 30 + Math.floor(r() * 18);
  const value = breedValue(a), inc = Math.max(1000, Math.round(value * 0.03 / 1000) * 1000), start = Math.max(inc, Math.round(value * 0.7 / 1000) * 1000);
  const pool = nicks.length ? nicks : ['ReiDoGado', 'HarasEstrela', 'A Boiadeira', 'TerraFirme', 'Blackjack21', 'RainhaDaSoja'];
  const names = [...new Set(pool)];   // nomes distintos: com nome repetido o bot não cobria o próprio lance e o leilão parava barato
  const bidders = Array.from({ length: Math.min(names.length, 3 + Math.floor(r() * 4)) }, () => ({ name: names.splice(Math.floor(r() * names.length), 1)[0], max: Math.round(value * (0.98 + r() * 0.4) / 1000) * 1000 }));
  const L = { slot, kind, horse: a, value, inc, start, bidders, seed: slot * 977 + 3 + (kind === 'dog' ? 7 : 0) };
  cache.set(ck, L); if (cache.size > 40) cache.delete(cache.keys().next().value);
  return L;
}
// situação do leilão num instante: lances dos jogadores do mundo (fixos pelo horário) + lances de pessoas [{ at, name, pid, amt }]
export function state(L, now, humans = []) {
  const t0 = opensAt(L.slot), end = endsAt(L.slot), until = Math.min(now, end), r = rng(L.seed);
  let price = 0, leader = null; const hist = [], hs = [...humans].sort((a, b) => a.at - b.at); let hi = 0;
  const next = () => (price ? price + L.inc : L.start);
  for (let t = t0; t <= until; t += 1000) {
    while (hi < hs.length && hs[hi].at <= t) { const h = hs[hi++]; if (h.amt >= next()) { price = h.amt; leader = { name: h.name, pid: h.pid, human: true }; hist.unshift({ at: h.at, name: h.name, amt: h.amt, human: true }); } }
    const roll = r(), pick = r();
    if (roll < 0.11) {
      const can = L.bidders.filter(b => b.max >= next() && b.name !== leader?.name);
      if (can.length) { const b = can[Math.floor(pick * can.length)]; price = next(); leader = { name: b.name, human: false }; hist.unshift({ at: t, name: b.name, amt: price }); }
    }
  }
  while (hi < hs.length && hs[hi].at <= until) { const h = hs[hi++]; if (h.amt >= next()) { price = h.amt; leader = { name: h.name, pid: h.pid, human: true }; hist.unshift({ at: h.at, name: h.name, amt: h.amt, human: true }); } }
  return { price, leader, next: next(), hist: hist.slice(0, 14), ended: now >= end, phase: phaseOf(L.slot, now), left: Math.max(0, (now < t0 ? t0 : end) - now) };
}
// quem vence leva o cavalo para o haras
export function deliver(s, L, price) {
  if (s.money < price) return 'dinheiro insuficiente para pagar o lance vencedor.';
  ST.ensure(s); s.money -= price;
  const a = { ...L.horse, id: s.stable.next++ }; delete a.cost; s.stable.animals.push(a);
  return null;
}
