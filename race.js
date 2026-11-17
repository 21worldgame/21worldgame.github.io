// Corrida de galgos: odds com margem da casa, resultado sorteado pelos pesos. Sem DOM.
export const MARGIN = 0.12;          // a casa fica com ~12% (como num jóquei de verdade)
export const PLACE_DIV = 3;          // placê (chegar em 1º ou 2º) paga a odd dividida por 3
const NAMES = ['Relâmpago', 'Pipoca', 'Trovão', 'Fumaça', 'Bala', 'Faísca', 'Cometa', 'Tufão', 'Paçoca', 'Vulcão', 'Sombra', 'Turbo'];

export function newRace(rng = Math.random, no = 1) {
  const pool = [...NAMES];
  const dogs = Array.from({ length: 6 }, (_, i) => {
    const name = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const form = 0.75 + rng() * 0.5;
    const last = Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
    return { lane: i + 1, name, form, last };
  });
  const w = dogs.map(d => d.form ** 6), tot = w.reduce((a, b) => a + b, 0);
  dogs.forEach((d, i) => {
    d.p = w[i] / tot;
    d.odds = Math.max(1.2, Math.round(((1 - MARGIN) / d.p) * 10) / 10);
  });
  return { no, dogs };
}

// ordem de chegada (índices), sorteada sem reposição pelos pesos
export function runRace(race, rng = Math.random) {
  const left = race.dogs.map((d, i) => ({ i, p: d.p })), order = [];
  while (left.length) {
    const tot = left.reduce((a, d) => a + d.p, 0);
    let r = rng() * tot, k = 0;
    while (k < left.length - 1 && (r -= left[k].p) > 0) k++;
    order.push(left.splice(k, 1)[0].i);
  }
  return order;
}

export function payout(race, order, bet) {
  const d = race.dogs[bet.dog];
  if (bet.type === 'win') return order[0] === bet.dog ? Math.floor(bet.amount * d.odds) : 0;
  return order.slice(0, 2).includes(bet.dog) ? Math.floor(bet.amount * placeOdds(d)) : 0;
}
// tempos oficiais nos 480 m (galgo de verdade faz ~28-30 s) e margem em corpos (~0,07 s por corpo)
export const DIST = 480;
export function officialTimes(order, rng = Math.random, base = 28.3, scale = 1) {
  const t = [];
  let cur = base + rng() * 1.3 * scale;
  order.forEach((dog, k) => { if (k) cur += (0.015 + rng() * rng() * 0.45) * scale; t[dog] = +cur.toFixed(2); });
  return t;
}
export function margin(sec, perLen = 0.07) {
  const len = sec / perLen;
  if (len < 0.15) return 'por um focinho';
  if (len < 0.4) return 'por uma cabeça';
  if (len < 0.75) return 'por meio corpo';
  if (len < 1.5) return 'por um corpo';
  return `por ${Math.round(len)} corpos`;
}

export const placeOdds = d => Math.max(1.1, Math.round((d.odds / PLACE_DIV) * 10) / 10);
