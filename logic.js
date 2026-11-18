import { value as cardValue } from './cards.js';
import * as PK from './perks.js';
// Regras puras do 21 World (sem DOM) — usadas pelo jogo e pelo test.mjs.
import { animalsValue } from './stable.js';
export const CHIP = 10;           // 1 ficha = R$ 10
export const HOUSE_FEE = 0.05;    // taxa do cassino sobre o pote
export const MARKET_FEE = 0.01;   // taxa do mercado sobre vendas
export const BANK_RATE = 0.018;   // juros do banco ao mês
export const KG_ARROBA = 15;
export const RENT_PAY = 0.004;    // arrendamento pago ao mês, sobre o valor da terra
export const RENT_RAISE = 0.08;      // reajuste do aluguel a cada 12 meses de contrato
export const RENT_SHARE = 0.15;      // parte da safra que vai para o dono em terra arrendada
export const RENT_INPUTS = 1.2;      // plantar em terra arrendada custa 20% mais (insumos e máquina por conta do arrendatário)
export const RENT_CREDIT = 0.5;     // metade do aluguel já pago abate o preço se o arrendatário comprar
export const RENT_CREDIT_CAP = 0.4; // o abatimento nunca passa de 40% do valor da terra
export const RENT_GET = 0.0035;   // arrendamento recebido (o arrendatário NPC negocia um pouco abaixo)

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function newDeck(rng = Math.random) {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { total += 11; aces++; }
    else total += ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

// NPC pede carta abaixo do seu limite (16–17, varia por personalidade)
export function playBot(hand, deck, limit = 17) {
  while (handValue(hand) < limit) hand.push(deck.pop());
  return hand;
}

// seats: [{bet, value}] → pagamento bruto de cada assento (fichas)
export function settle(seats, fee = HOUSE_FEE) {
  const pot = seats.reduce((a, s) => a + s.bet, 0);
  const net = Math.floor(pot * (1 - fee));
  const alive = seats.filter(s => s.value <= 21);
  if (!alive.length) return seats.map(s => Math.floor(s.bet * (1 - fee))); // todos estouraram: devolve menos a taxa
  const best = Math.max(...alive.map(s => s.value));
  const winners = seats.filter(s => s.value === best).length;
  return seats.map(s => (s.value === best ? Math.floor(net / winners) : 0));
}

// ---------- economia ----------
// preço/ha aproximado da terra nua por região (ordem de grandeza real, 2025)
// lat/lon: centro de uma zona agrícola real de cada região (o lote cai num raio de ~25 km)
export const REGIONS = [
  { name: 'várzea, tocantins', uf: 'to', perHa: 9000, use: 'pasto', lat: -10.79, lon: -49.62, city: 'Lagoa da Confusão' },
  { name: 'cerrado, goiás', uf: 'go', perHa: 22000, use: 'lavoura', lat: -17.75, lon: -51.05, city: 'Rio Verde' },
  { name: 'pastagem, mato grosso do sul', uf: 'ms', perHa: 18000, use: 'pasto', lat: -20.44, lon: -53.76, city: 'Ribas do Rio Pardo' },
  { name: 'terra roxa, paraná', uf: 'pr', perHa: 55000, use: 'lavoura', lat: -24.95, lon: -53.45, city: 'Cascavel' },
  { name: 'chapadão, mato grosso', uf: 'mt', perHa: 30000, use: 'lavoura', lat: -12.55, lon: -55.75, city: 'Sorriso' },
  { name: 'sul de minas', uf: 'mg', perHa: 40000, use: 'café', lat: -21.37, lon: -45.51, city: 'Três Pontas' },
  { name: 'oeste da bahia', uf: 'ba', perHa: 16000, use: 'lavoura', lat: -12.1, lon: -45.8, city: 'Luís Eduardo Magalhães' },
  { name: 'sudeste do pará', uf: 'pa', perHa: 7000, use: 'pasto', lat: -7.1, lon: -49.95, city: 'Xinguara' },
];
export const placeLot = (reg, rng) => ({ lat: +(reg.lat + (rng() - 0.5) * 0.45).toFixed(5), lon: +(reg.lon + (rng() - 0.5) * 0.45).toFixed(5) });
export const region = name => REGIONS.find(r => r.name === name) || REGIONS[0];
const CAP_BY_USE = { pasto: 1.2, lavoura: 0.9, 'café': 0.6 };           // cabeças por hectare
const WATER = [['rio', 1], ['açude', 1], ['poço artesiano', 0.9], ['sem água', 0.5]];
const IMPROV = [['casa sede', 0.06], ['curral', 0.03], ['galpão', 0.04], ['cerca nova', 0.02]];

// ---------- lavoura ----------
export const CROPS = {
  soja: { label: 'soja', cost: 4500, months: 4, yield: 60, good: 'soja' },     // sacas por hectare
  milho: { label: 'milho', cost: 3500, months: 5, yield: 110, good: 'milho' },
  cafe: { label: 'café', cost: 12000, months: 8, yield: 30, good: 'cafe' },
};
export const hasVehicle = (s, type) => (s.cars || []).some(c => CARS[c.model]?.type === type);
export const rentNow = l => Math.round(l.value * RENT_PAY * (1 + RENT_RAISE * Math.floor((l.age || 0) / 12)));
export const rentCredit = l => Math.min((l.paid || 0) * RENT_CREDIT, l.value * RENT_CREDIT_CAP);
export const buyRentedPrice = l => Math.round(l.value - rentCredit(l));
export const plantCost = (s, crop, ha, rented = false) => Math.round(CROPS[crop].cost * ha * (hasVehicle(s, 'trator') ? 0.85 : 1) * PK.mult(s, 'plant') * (rented ? RENT_INPUTS : 1));
// compra da terra que você arrendava: o aluguel pago vira desconto
export function buyRented(s, land) {
  if (!land || land.own) return 'essa terra já é sua.';
  const price = buyRentedPrice(land);
  if (price > s.money) return 'dinheiro insuficiente para comprar essa terra.';
  s.money -= price;
  land.own = true; land.leasedOut = false; delete land.age; delete land.paid;
  return null;
}
export function plant(s, land, crop) {
  if (land.crop || land.leasedOut) return 'esta terra já está ocupada.';
  if (!land.own && !hasVehicle(s, 'trator')) return 'terra arrendada só aceita lavoura de quem tem trator (a máquina e os insumos ficam por sua conta).';
  const cost = plantCost(s, crop, land.ha, !land.own);
  if (cost > s.money) return 'dinheiro insuficiente para o plantio.';
  s.money -= cost;
  land.crop = { type: crop, left: CROPS[crop].months };
  return null;
}

// ---------- veículos (modelos fictícios) ----------
// nomes de paródia, no estilo dos jogos de mundo aberto; foto real em assets/<img>.webp
export const CARS = {
  onix: { name: 'Chevrolé Ônyx', type: 'hatch', price: 95000, cat: 'popular', img: 'car-onix', hp: 116, top: 190 },
  hilux: { name: 'Toyoda Hilox', type: 'picape', price: 330000, cat: 'picape', img: 'car-hilux', hp: 204, top: 180 },
  sw4: { name: 'Toyoda SW5', type: 'suv', price: 420000, cat: 'SUV', img: 'car-sw4', hp: 204, top: 180 },
  deere: { name: 'John Dear 6215', type: 'trator', price: 650000, cat: 'agrícola', img: 'car-deere', hp: 125, top: 40, perk: 'plantio 15% mais barato' },
  scania: { name: 'Scanya R540 boiadeiro', type: 'caminhao', price: 950000, cat: 'agrícola', img: 'car-scania', hp: 540, top: 110, perk: 'vende gado sem taxa de frete' },
  porsche: { name: 'Porshe 912 Carreira', type: 'esportivo', price: 1100000, cat: 'esportivo', img: 'car-porsche', hp: 385, top: 293 },
  g63: { name: 'Mercedez G36 AMJ', type: 'suv', price: 2000000, cat: 'luxo', img: 'car-g63', hp: 585, top: 220 },
  huracan: { name: 'Lamborgini Huracão', type: 'super', price: 3600000, cat: 'superesportivo', img: 'car-huracan', hp: 640, top: 325 },
  veyron: { name: 'Bugati Veiron 61.4', type: 'super', price: 15000000, cat: 'hiperesportivo', img: 'car-veyron', hp: 1001, top: 407 },
};
export const OLD_CARS = { vento: 'onix', bravo: 'hilux', serra: 'sw4', campeiro: 'deere', boiadeiro: 'scania', falcao: 'porsche', tempesta: 'huracan' };
export const CAR_DEPREC = 0.015;   // desvaloriza 1,5% ao mês
export const CAR_UPKEEP = 0.004;   // IPVA + seguro ao mês
export const CAR_BUYBACK = 0.92;   // a concessionária recompra com margem
export const cattleFee = s => (hasVehicle(s, 'caminhao') ? 0 : MARKET_FEE);

// ---------- fichas por valor, como no cassino ----------
export const DENOMS = [1000, 500, 100, 25, 5];
export function breakChips(n) {
  const out = {};
  for (const d of DENOMS) { const k = Math.floor(n / d); if (k) out[d] = k; n -= k * d; }
  return out;
}

export function newState(rng = Math.random) {
  const s = {
    v: 1, month: 1, money: 100000, chips: 0, nextId: 1,
    lands: [], herd: [], stock: { soja: 0, milho: 0, cafe: 0 },
    prices: { soja: 130, milho: 60, cafe: 1400, arroba: 310, bezerro: 2600 },
    loans: [], lent: [], offers: [], borrowers: [], log: [], cars: [],
  };
  refreshOffers(s, rng);
  return s;
}

const id = s => s.nextId++;
const walk = (v, rng, pct) => v * (1 + (rng() * 2 - 1) * pct);

export function refreshOffers(s, rng = Math.random) {
  s.offers = Array.from({ length: 10 }, () => {
    const reg = REGIONS[Math.floor(rng() * REGIONS.length)];
    const ha = 5 + Math.floor(rng() * 16) * 5;
    const [water, wf] = WATER[Math.floor(rng() * WATER.length)];
    const improv = IMPROV.filter(() => rng() < 0.35);
    const bonus = improv.reduce((a, [, b]) => a + b, 0) + (wf < 1 ? -0.12 : 0);
    return { id: id(s), region: reg.name, uf: reg.uf, use: reg.use, ha, water, improv: improv.map(([n]) => n), ...placeLot(reg, rng),
      cap: +(CAP_BY_USE[reg.use] * wf).toFixed(2), value: Math.round(walk(reg.perHa, rng, 0.15) * ha * (1 + bonus)) };
  });
  const names = ['seu Antônio', 'dona Lurdes', 'Jair do posto', 'Marta da feira', 'Zé Carreteiro', 'Cida Leiteira'];
  const start = Math.floor(rng() * names.length);
  s.borrowers = Array.from({ length: 3 }, (_, i) => {
    const risk = 0.02 + rng() * 0.13;
    return { id: id(s), name: names[(start + i) % names.length], amount: (2 + Math.floor(rng() * 19)) * 1000,
      rate: +(0.015 + risk * 0.25).toFixed(3), months: 3 + Math.floor(rng() * 10), risk };
  });
}

// lotação do pasto: cabeças por hectare conforme aptidão e água; terra plantada não é pasto
export const landCap = l => Math.floor(l.ha * (l.cap ?? 1));
export const capacity = s => s.lands.filter(l => !l.leasedOut && !l.crop).reduce((a, l) => a + landCap(l), 0);
export const carsValue = s => (s.cars || []).reduce((a, c) => a + c.value, 0);
export const heads = s => s.herd.reduce((a, h) => a + h.heads, 0);
export const YIELD = 0.52; // rendimento de carcaça: a arroba do boi gordo é sobre a carcaça, não o peso vivo
export const arrobas = kg => (kg * YIELD) / KG_ARROBA;
export const herdValue = s => s.herd.reduce((a, h) => a + h.heads * arrobas(h.kg) * s.prices.arroba, 0);
export const debt = s => s.loans.reduce((a, l) => a + l.bal, 0);
export const creditLimit = s =>
  Math.max(0, Math.floor(s.lands.filter(l => l.own).reduce((a, l) => a + l.value, 0) * 0.5 + herdValue(s) * 0.2 - debt(s)));

export function netWorth(s) {
  const lands = s.lands.filter(l => l.own).reduce((a, l) => a + l.value, 0);
  const stock = Object.entries(s.stock).reduce((a, [k, q]) => a + q * s.prices[k], 0);
  const lent = s.lent.reduce((a, l) => a + l.bal, 0);
  return Math.round(s.money + s.chips * CHIP + lands + herdValue(s) + stock + lent + carsValue(s) + animalsValue(s) + (s.cards || []).reduce((a, c) => a + cardValue(c), 0) - debt(s));
}

export const TITLES = [[0, 'iniciante'], [150000, 'fazendeiro'], [500000, 'barão do gado'], [2000000, 'magnata']];
export const rank = worth => TITLES.filter(([min]) => worth >= min).pop()[1];

// Passa um mês. Devolve as linhas do livro-caixa.
export function tick(s, rng = Math.random) {
  const log = [];
  const add = (txt, val = 0) => { s.money += val; log.push({ m: s.month, txt, val: Math.round(val) }); };

  s.prev = { ...s.prices };
  for (const k of Object.keys(s.prices)) s.prices[k] = Math.round(walk(s.prices[k], rng, 0.06));
  for (const l of s.lands) l.value = Math.round(l.value * (1 + 0.006 + (rng() * 2 - 1) * 0.02));

  // gado: engorda no pasto; o excedente come ração
  const cap = capacity(s), n = heads(s), over = Math.max(0, n - cap);
  for (const h of s.herd) h.kg += n <= cap ? 18 : 8;
  if (over) add(`ração para ${over} cabeças sem pasto`, -over * 150);

  for (const l of s.lands) {
    if (l.own && l.leasedOut) add(`arrendamento recebido, ${l.region}`, l.value * RENT_GET);
    if (l.own) add(`manutenção e ITR, ${l.region}`, -l.value * 0.001);
    if (!l.own) { const r = rentNow(l); l.age = (l.age || 0) + 1; l.paid = (l.paid || 0) + r; add(`arrendamento pago, ${l.region}`, -r); }
  }

  // lavoura: cresce e colhe; a safra varia ±25% com o clima
  for (const l of s.lands) {
    if (!l.crop || --l.crop.left > 0) continue;
    const c = CROPS[l.crop.type], bruto = Math.round(l.ha * c.yield * (0.75 + rng() * 0.5)), dono = l.own ? 0 : Math.round(bruto * RENT_SHARE), sacas = bruto - dono;
    s.stock[c.good] += sacas;
    add(`colheita de ${c.label}: ${sacas} sacas, ${l.region}${dono ? ` (${dono} ficaram com o dono da terra)` : ''}`);
    delete l.crop;
  }

  for (const c of s.cars || []) {
    add(`IPVA e seguro, ${CARS[c.model].name}`, -c.value * CAR_UPKEEP);
    c.value = Math.round(c.value * (1 - CAR_DEPREC));
  }

  for (const loan of [...s.loans]) {
    loan.bal *= 1 + loan.rate;
    const due = loan.bal / Math.max(1, loan.left);
    if (s.money >= due) { add('parcela do banco', -due); loan.bal -= due; loan.left--; loan.missed = 0; }
    else if (++loan.missed >= 2) {
      const land = s.lands.filter(l => l.own).sort((a, b) => b.value - a.value)[0];
      if (land) {
        s.lands.splice(s.lands.indexOf(land), 1);
        add(`banco tomou a terra em ${land.region} (${land.ha} ha)`);
        loan.bal = Math.max(0, loan.bal - land.value); loan.missed = 0;
      } else add('parcela atrasada, sem garantia para executar');
    } else add('parcela do banco atrasada');
    if (loan.bal < 1) s.loans.splice(s.loans.indexOf(loan), 1);
  }

  for (const p of [...s.lent]) {
    if (rng() < p.risk) { add(`${p.name} deu calote de R$ ${Math.round(p.bal)}`); s.lent.splice(s.lent.indexOf(p), 1); continue; }
    p.bal *= 1 + p.rate;
    const pay = p.bal / Math.max(1, p.left);
    add(`${p.name} pagou a parcela`, pay); p.bal -= pay;
    if (--p.left <= 0) s.lent.splice(s.lent.indexOf(p), 1);
  }

  s.month++;
  refreshOffers(s, rng);
  s.log = [...log.reverse(), ...s.log].slice(0, 200);
  return log;
}
