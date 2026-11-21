import { T } from './tune.js';
import { value as cardValue } from './cards.js';
import { value as suinosValue, PRICES as SU_PRICES } from './suinos.js';
import { value as bizValue } from './negocios.js';
import { value as minaValue } from './mina.js';
import * as PK from './perks.js';
import { granjaValue, PRICES as GR_PRICES } from './granja.js';
import { orchardValue } from './pomar.js';
import { caneValue } from './cana.js';
import { plantValue } from './abate.js';
// Regras puras do 21 World (sem DOM) — usadas pelo jogo e pelo test.mjs.
import { animalsValue } from './stable.js';
export const CHIP = 10;           // 1 ficha = R$ 10
export const HOUSE_FEE = 0.05;    // taxa do cassino sobre o pote
export const MARKET_FEE = 0.01;   // taxa do mercado sobre vendas
export const BANK_RATE = 0.035;   // juros do banco ao mês
// agiota: quem pega com ele é quem o banco não atende. Paga o banco + 1 ponto + o risco dele (calote ao mês) com 10% de folga.
// Com calote o cobrador ainda recupera RECOVER do saldo, então emprestar dá lucro esperado: rate - risk * (1 - RECOVER) > 0.
export const RECOVER = 0.25;
export const agiotaRate = risk => +(BANK_RATE + 0.01 + risk * 1.1).toFixed(3);
export const lendEdge = b => b.rate - b.risk * (1 - RECOVER);   // lucro esperado ao mês por real emprestado
export const KG_ARROBA = 15;
export const RENT_PAY = 0.004;    // arrendamento pago ao mês, sobre o valor da terra
export const RENT_RAISE = 0.08;      // reajuste do aluguel a cada 12 meses de contrato
export const RENT_SHARE = 0.15;      // parte da safra que vai para o dono em terra arrendada
export const RENT_INPUTS = 1.2;      // plantar em terra arrendada custa 20% mais (insumos e máquina por conta do arrendatário)
export const RENT_CREDIT = 0.5;     // metade do aluguel já pago abate o preço se o arrendatário comprar
export const RENT_CREDIT_CAP = 0.4; // o abatimento nunca passa de 40% do valor da terra
export const RENT_GET = 0.0035;   // arrendamento recebido (o arrendatário NPC negocia um pouco abaixo)
export const RENT_FRIEND = 0.0042;   // amigo arrenda sua terra parada pagando 20% mais que o arrendatário de fora

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
  { name: 'interior de são paulo', uf: 'sp', perHa: 95000, use: 'lavoura', lat: -21.18, lon: -47.81, city: 'Ribeirão Preto' },
  { name: 'oeste paulista', uf: 'sp', perHa: 62000, use: 'pasto', lat: -22.12, lon: -51.39, city: 'Presidente Prudente' },
  { name: 'serra gaúcha', uf: 'rs', perHa: 78000, use: 'lavoura', lat: -29.17, lon: -51.52, city: 'Bento Gonçalves' },
  { name: 'planalto gaúcho', uf: 'rs', perHa: 70000, use: 'lavoura', lat: -28.26, lon: -52.41, city: 'Passo Fundo' },
  { name: 'campanha gaúcha', uf: 'rs', perHa: 38000, use: 'pasto', lat: -31.33, lon: -54.1, city: 'Bagé' },
  { name: 'oeste catarinense', uf: 'sc', perHa: 64000, use: 'lavoura', lat: -27.1, lon: -52.62, city: 'Chapecó' },
  { name: 'campos gerais, paraná', uf: 'pr', perHa: 80000, use: 'lavoura', lat: -24.79, lon: -50.01, city: 'Castro' },
  { name: 'triângulo mineiro', uf: 'mg', perHa: 56000, use: 'lavoura', lat: -19.75, lon: -47.93, city: 'Uberaba' },
  { name: 'cerrado mineiro', uf: 'mg', perHa: 50000, use: 'café', lat: -18.94, lon: -46.99, city: 'Patrocínio' },
  { name: 'montanhas capixabas', uf: 'es', perHa: 46000, use: 'café', lat: -20.34, lon: -41.13, city: 'Venda Nova do Imigrante' },
  { name: 'serra fluminense', uf: 'rj', perHa: 52000, use: 'pasto', lat: -22.25, lon: -43.7, city: 'Valença' },
  { name: 'entorno do df', uf: 'df', perHa: 60000, use: 'lavoura', lat: -15.95, lon: -47.55, city: 'Brasília (PAD-DF)' },
  { name: 'matopiba, maranhão', uf: 'ma', perHa: 28000, use: 'lavoura', lat: -7.53, lon: -46.04, city: 'Balsas' },
  { name: 'cerrado do piauí', uf: 'pi', perHa: 25000, use: 'lavoura', lat: -7.23, lon: -44.55, city: 'Uruçuí' },
  { name: 'vale do são francisco', uf: 'pe', perHa: 65000, use: 'lavoura', lat: -9.39, lon: -40.6, city: 'Petrolina' },
  { name: 'chapada do apodi', uf: 'rn', perHa: 32000, use: 'lavoura', lat: -5.66, lon: -37.8, city: 'Apodi' },
  { name: 'cariri cearense', uf: 'ce', perHa: 22000, use: 'pasto', lat: -7.21, lon: -39.31, city: 'Juazeiro do Norte' },
  { name: 'zona da mata alagoana', uf: 'al', perHa: 42000, use: 'lavoura', lat: -9.78, lon: -36.2, city: 'São Miguel dos Campos' },
  { name: 'brejo paraibano', uf: 'pb', perHa: 20000, use: 'pasto', lat: -6.85, lon: -35.6, city: 'Guarabira' },
  { name: 'sertão sergipano', uf: 'se', perHa: 19000, use: 'pasto', lat: -10.22, lon: -37.42, city: 'Nossa Senhora da Glória' },
  { name: 'sul da bahia', uf: 'ba', perHa: 34000, use: 'lavoura', lat: -14.86, lon: -39.59, city: 'Ibicaraí' },
  { name: 'cone sul de rondônia', uf: 'ro', perHa: 33000, use: 'lavoura', lat: -12.74, lon: -60.15, city: 'Vilhena' },
  { name: 'vale do acre', uf: 'ac', perHa: 16000, use: 'pasto', lat: -9.97, lon: -67.6, city: 'Rio Branco' },
  { name: 'várzea amazonense', uf: 'am', perHa: 14000, use: 'pasto', lat: -3.14, lon: -58.44, city: 'Itacoatiara' },
  { name: 'lavrado de roraima', uf: 'rr', perHa: 17000, use: 'lavoura', lat: -2.82, lon: -60.67, city: 'Boa Vista' },
  { name: 'cerrado do amapá', uf: 'ap', perHa: 15000, use: 'pasto', lat: 0.71, lon: -51.41, city: 'Porto Grande' },
  { name: 'pantanal, mato grosso do sul', uf: 'ms', perHa: 16000, use: 'pasto', lat: -20.47, lon: -55.79, city: 'Aquidauana' },
  { name: 'araguaia, mato grosso', uf: 'mt', perHa: 24000, use: 'pasto', lat: -14.05, lon: -52.16, city: 'Água Boa' },
  { name: 'norte do tocantins', uf: 'to', perHa: 14000, use: 'pasto', lat: -7.19, lon: -48.2, city: 'Araguaína' },
  { name: 'nordeste paraense', uf: 'pa', perHa: 19000, use: 'lavoura', lat: -2.99, lon: -47.35, city: 'Paragominas' },
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
// máquina emprestada a parceiro (lentTo) não trabalha para você; a que você pegou emprestada (amigos.tools) trabalha
export const hasVehicle = (s, type) => (s.cars || []).some(c => !c.lentTo && CARS[c.model]?.type === type) || (s.amigos?.tools || []).some(t => t.type === type);
export const rentNow = l => Math.round(l.value * (l.rate ?? RENT_PAY) * (1 + RENT_RAISE * Math.floor((l.age || 0) / 12)));
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
  if (land.crop || land.leasedOut || land.orchard || land.cane) return 'esta terra já está ocupada.';
  const busy = pastureBusy(s, land); if (busy) return busy;
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
  // máquinas agrícolas: aparecem na concessionária para quem tem pomar ou canavial
  pulv: { name: 'Jactu Arbos 3030 (pulverizador)', type: 'maquina', crop: 'laranja', price: 380000, cat: 'laranja', img: 'maq-pulv', hp: 0, top: 25, perk: 'defensivo do pomar 30% mais barato; cada um atende 150 ha de pomar' },
  plataforma: { name: 'Plataforma Citrus PC-22', type: 'maquina', crop: 'laranja', price: 260000, cat: 'laranja', img: 'maq-plataforma', hp: 0, top: 20, perk: 'colhe 10% mais laranja (menos fruta no chão); cada uma atende 200 ha de pomar' },
  transbordo: { name: 'Transbordo Antoniossi 12 t', type: 'maquina', crop: 'cana', price: 320000, cat: 'cana', img: 'maq-transbordo', hp: 0, top: 30, perk: 'carregamento da cana de R$ 6 para R$ 2 por tonelada' },
  rodotrem: { name: 'Volvu FH rodotrem canavieiro', type: 'maquina', crop: 'cana', price: 1400000, cat: 'cana', img: 'maq-rodotrem', hp: 540, top: 90, perk: 'frete da cana até a usina 45% mais barato' },
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
// arroba/bezerro/grãos também ancorados: soltos derivavam (arroba chegou a ~R$ 120) e o boi engordado vendia abaixo do bezerro
// ECON: multiplicador do preço de referência vindo da economia do mundo (econ.js), igual para todos; o jogo preenche antes do mês
export const ECON = {};
export const REGION_K = {};   // região → multiplicador do preço da terra (procura e saturação), também preenchido pelo jogo
export const ANCHOR = { soja: 130, milho: 60, cafe: 1400, arroba: 310, bezerro: 2600, cana: 150, laranja: 38, ...GR_PRICES, ...SU_PRICES };

export function refreshOffers(s, rng = Math.random) {
  const used = [];   // ofertas espalhadas pelo Brasil: regiões diferentes e longe umas das outras
  const far = r => used.every(u => Math.hypot(u.lat - r.lat, u.lon - r.lon) > 4);
  s.offers = Array.from({ length: T.landOffers }, () => {
    let reg = REGIONS[Math.floor(rng() * REGIONS.length)];
    for (let i = 0; i < 25 && !far(reg); i++) reg = REGIONS[Math.floor(rng() * REGIONS.length)];
    used.push(reg);
    const ha = rng() < 0.2 ? 100 + Math.floor(rng() * 19) * 50 : 5 + Math.floor(rng() * 16) * 5;   // 1 em 5 é fazenda grande (100 a 1.000 ha)
    const [water, wf] = WATER[Math.floor(rng() * WATER.length)];
    const improv = IMPROV.filter(() => rng() < 0.35);
    const bonus = improv.reduce((a, [, b]) => a + b, 0) + (wf < 1 ? -0.12 : 0);
    return { id: id(s), region: reg.name, uf: reg.uf, use: reg.use, ha, water, improv: improv.map(([n]) => n), ...placeLot(reg, rng),
      cap: +(CAP_BY_USE[reg.use] * wf).toFixed(2), value: Math.round(walk(reg.perHa, rng, 0.15) * T.landPremium * ha * (1 + bonus) * (REGION_K[reg.name] || 1)) };
  });
  const names = ['seu Antônio', 'dona Lurdes', 'Jair do posto', 'Marta da feira', 'Zé Carreteiro', 'Cida Leiteira'];
  const start = Math.floor(rng() * names.length);
  s.borrowers = Array.from({ length: 3 }, (_, i) => {
    const risk = +(0.01 + rng() * 0.11).toFixed(3);
    return { id: id(s), name: names[(start + i) % names.length], amount: (2 + Math.floor(rng() * 19)) * 1000,
      rate: agiotaRate(risk), months: 3 + Math.floor(rng() * 10), risk };
  });
}

// lotação do pasto: cabeças por hectare conforme aptidão e água; terra plantada não é pasto
export const landCap = l => Math.floor(l.ha * (l.cap ?? 1));
export const capacity = s => s.lands.filter(l => !l.leasedOut && !l.crop && !l.orchard && !l.cane).reduce((a, l) => a + landCap(l), 0);
// terra é pasto OU lavoura: plantar (ou arrendar) a terra onde o gado está pastando é proibido. Antes o jogo deixava e o gado ia
// calado para o hotel de gado; parecia que dava para tirar o lucro do boi e o da safra da mesma terra.
export function pastureBusy(s, land) {
  if (land.crop || land.leasedOut || land.orchard || land.cane) return null;
  const n = heads(s), rest = capacity(s) - landCap(land), out = Math.min(landCap(land), n - Math.max(0, rest));
  return out > 0 ? `essa terra é o pasto de ${out} bois seus. Terra é pasto ou lavoura, não os dois: venda esses bois ou consiga outro pasto antes.` : null;
}
export const carsValue = s => (s.cars || []).reduce((a, c) => a + c.value, 0);
export const heads = s => s.herd.reduce((a, h) => a + (h?.heads || 0), 0);
export const BOITEL_COST = 95, BOITEL_GAIN = 22;   // R$ por cabeça por mês e kg por mês no confinamento
export const YIELD = 0.52; // rendimento de carcaça: a arroba do boi gordo é sobre a carcaça, não o peso vivo
export const arrobas = kg => (kg * YIELD) / KG_ARROBA;
export const herdValue = s => s.herd.reduce((a, h) => a + (h ? h.heads * arrobas(h.kg || 0) * (s.prices.arroba || 0) : 0), 0);
export const debt = s => s.loans.reduce((a, l) => a + l.bal, 0);
export const creditLimit = s =>
  Math.max(0, Math.floor(s.lands.filter(l => l.own).reduce((a, l) => a + l.value, 0) * 0.5 + herdValue(s) * 0.2 - debt(s)));

// soma protegida: um item com dado faltando (save antigo) vale 0 em vez de virar NaN e quebrar a tela
const num = v => (Number.isFinite(v) ? v : 0);
const part = fn => { try { return num(fn()); } catch { return 0; } };
export function netWorth(s) {
  const own = (s.lands || []).filter(l => l && l.own);
  return Math.round(part(() => s.money) + part(() => s.chips * CHIP) + own.reduce((a, l) => a + num(l.value), 0) + part(() => herdValue(s))
    + Object.entries(s.stock || {}).reduce((a, [k, q]) => a + num(q * (s.prices?.[k] ?? 0)), 0) + (s.lent || []).reduce((a, l) => a + num(l?.bal), 0)
    + part(() => carsValue(s)) + part(() => animalsValue(s)) + (s.cards || []).reduce((a, c) => a + part(() => cardValue(c)), 0) + part(() => granjaValue(s))
    + own.reduce((a, l) => a + part(() => orchardValue(s, l) + caneValue(s, l)), 0) + num(s.caneHarvester?.value) + part(() => plantValue(s)) + part(() => suinosValue(s)) + part(() => bizValue(s)) + part(() => minaValue(s)) - part(() => debt(s)));
}

// troféus de patrimônio: o de 10 mi é o selo de entrada; ficam para sempre, mesmo se a fortuna cair
export const TROPHIES = [10e6, 20e6, 30e6, 40e6, 50e6, 60e6, 70e6, 80e6, 90e6, 100e6, 200e6, 300e6, 500e6, 1e9, 2e9];   // de 100 mi para cima: marcos de prestígio (perks.js PRESTIGE)
export const PRIVATE_MIN = 10e6;   // perfil privado libera a partir de 10 mi
// área por produto (vai no perfil público e entra na economia do mundo): lavoura, pomar, canavial e pasto com gado
export function cropsOf(s) {
  const o = {};
  for (const l of s.lands || []) { const k = l.crop?.type || (l.orchard ? 'laranja' : l.cane ? 'cana' : null); if (k) o[k] = (o[k] || 0) + (Number(l.ha) || 0); }
  const hd = heads(s); if (hd > 0) o.arroba = Math.round(hd / 1.2);
  return o;
}
// histórico de investidor de quem tem conta (vai no perfil público, no mesmo formato dos jogadores do mundo)
export function investorHist(s) {
  const runs = [];
  for (const e of s.log || []) {
    let x = /^colheita de ([^:]+):/.exec(e.txt || ''), item = x ? x[1] : /^compra de \d+ ha/.test(e.txt || '') ? 'compra de terra' : (x = /^compra da marca (.+)/.exec(e.txt || '')) ? `comprou a marca ${x[1]}` : null;
    if (!item) continue;
    const r = runs.at(-1); if (r && r.item === item) r.n++; else runs.push({ item, n: 1 });
    if (runs.length > 4) break;
  }
  const hist = runs.slice(0, 4).map((r, i) => `${i === 0 ? 'agora: ' : ''}${/^comprou|^compra de terra/.test(r.item) ? (r.item === 'compra de terra' ? `comprou terra${r.n > 1 ? ` (${r.n} vezes)` : ''}` : r.item) : `${r.n} ${r.n === 1 ? 'colheita' : 'colheitas'} de ${r.item}`}`);
  let net = 0; for (const [m, M] of Object.entries(s.pl || {})) if (Number(m) > (s.month || 0) - 12) for (const R of Object.values(M)) net += (R.in || 0) - (R.out || 0);
  const w = Math.max(1, netWorth(s)), trend = net > w * 0.03 ? 'em alta' : net < -w * 0.03 ? 'em dificuldade' : 'estável';
  return { hist, trend };
}
export const TITLES = [[0, 'iniciante'], [150000, 'fazendeiro'], [500000, 'barão do gado'], [2000000, 'magnata']];
export const rank = worth => (TITLES.filter(([min]) => worth >= min).pop() || TITLES[0])[1];

// Passa um mês. Devolve as linhas do livro-caixa.
export function tick(s, rng = Math.random) {
  const log = [];
  const add = (txt, val = 0) => { s.money += val; log.push({ m: s.month, txt, val: Math.round(val) }); };

  s.prev = { ...s.prices };
  for (const k of Object.keys(s.prices)) { const b = ANCHOR[k] && ANCHOR[k] * (ECON[k] || 1); let v = walk(b ? s.prices[k] + (b - s.prices[k]) * 0.1 : s.prices[k], rng, 0.06);   // ancorado: volta 10%/mês ao preço base, sem isso frango/ração derivavam sem limite e a granja virava prejuízo certo
    if (b) v = Math.min(b * 1.25, Math.max(b * 0.8, v));   // faixa realista: save antigo já derivado volta no próximo mês
    s.prices[k] = v < 100 ? Math.round(v * 100) / 100 : Math.round(v); }   // preço pequeno (frango, ração) anda em centavos
  for (const l of s.lands) l.value = Math.round(l.value * (1 + 0.006 + (rng() * 2 - 1) * 0.02));

  // gado: engorda no pasto; o excedente come ração
  const cap = capacity(s), n = heads(s), over = Math.max(0, n - cap);
  // sem pasto próprio o gado vai para o confinamento terceirizado (boitel): paga por cabeça e engorda bem (dá para começar sem terra)
  for (const h of s.herd) h.kg += n <= cap ? 18 : Math.round((cap * 18 + over * BOITEL_GAIN) / n);
  if (over) add(`confinamento terceirizado (boitel) de ${over} cabeças`, -over * BOITEL_COST);

  for (const l of s.lands) {
    if (l.own && l.leasedOut) add(`arrendamento recebido${l.leaseTo ? ` de ${l.leaseTo}` : ''}, ${l.region}`, l.value * (l.leaseTo ? RENT_FRIEND : RENT_GET));
    if (l.own) add(`manutenção e ITR, ${l.region}`, -l.value * 0.001);
    if (!l.own) { const r = rentNow(l); l.age = (l.age || 0) + 1; l.paid = (l.paid || 0) + r; add(`arrendamento pago${l.friend ? ` a ${l.friend}` : ''}, ${l.region}`, -r); }
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
    const who = loan.from ? `do empréstimo de ${loan.from}` : 'do banco';
    if (s.money >= due) { add(`parcela ${who}`, -due); loan.bal -= due; loan.left--; loan.missed = 0; }
    else if (++loan.missed >= 2) {
      const land = s.lands.filter(l => l.own).sort((a, b) => b.value - a.value)[0];
      if (land) {
        s.lands.splice(s.lands.indexOf(land), 1);
        add(`${loan.from || 'banco'} tomou a terra em ${land.region} (${land.ha} ha)`);
        loan.bal = Math.max(0, loan.bal - land.value); loan.missed = 0;
      } else add('parcela atrasada, sem garantia para executar');
    } else add(`parcela ${who} atrasada`);
    if (loan.bal < 1) s.loans.splice(s.loans.indexOf(loan), 1);
  }

  for (const p of [...s.lent]) {
    if (rng() < p.risk) { const back = Math.round(p.bal * RECOVER); add(`${p.name} deu calote de R$ ${Math.round(p.bal - back)} (o cobrador recuperou ${Math.round(RECOVER * 100)}%)`, back); s.lent.splice(s.lent.indexOf(p), 1); continue; }
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

// ---------- os mais ricos do mundo: quanto maior a fortuna, mais caro fica tudo (para não abrir desigualdade demais) ----------
// price: acréscimo em toda compra · bills: multiplica as contas do mês · tax: imposto mensal sobre tudo o que passa de R$ 3 mi
// gain: parte dos ganhos do mês que fica com o mundo (pedágio dos mais ricos)
export const ELITE = [
  { min: 3e6, name: 'jornada dos mais ricos', price: 0.12, bills: 1.4, tax: 0.002, gain: 0.08 },
  { min: 5e6, name: 'milionário do topo', price: 0.16, bills: 1.6, tax: 0.004, gain: 0.1 },
  { min: 1e7, name: 'magnata do mundo', price: 0.2, bills: 1.8, tax: 0.006, gain: 0.13 },
  { min: 1.5e7, name: 'tubarão do mundo', price: 0.24, bills: 2, tax: 0.008, gain: 0.18 },
  { min: 5e7, name: 'bilionário em formação', price: 0.3, bills: 2.3, tax: 0.01, gain: 0.22 },
  { min: 2e8, name: 'dono do mundo', price: 0.42, bills: 3, tax: 0.012, gain: 0.26 },
  { min: 1e9, name: 'imperador do 21 World', price: 0.6, bills: 4, tax: 0.015, gain: 0.3 },
];
export const eliteIdx = s => { const w = netWorth(s); let i = -1; ELITE.forEach((e, k) => { if (w >= e.min) i = k; }); return i; };
// o 1º do ranking paga ainda mais (s.top1 vem do ranking do servidor): a coroa pesa
export const TOP1 = { price: 0.25, bills: 1, tax: 2, gain: 0.15 };
// sem degrau: entre um limite e o próximo, pedágio, compras e contas sobem aos poucos (escala log). O imposto sobre a fortuna é por faixa (fortuneTax)
export const eliteOf = s => {
  const i = eliteIdx(s), e0 = ELITE[i]; if (!e0) return null;
  const w = netWorth(s), e1 = ELITE[i + 1], t = e1 ? Math.max(0, Math.min(1, Math.log(w / e0.min) / Math.log(e1.min / e0.min))) : 0, mix = k => e0[k] + ((e1 ? e1[k] : e0[k]) - e0[k]) * t;
  const k = T.eliteMult, e = { ...e0, price: mix('price') * k, bills: 1 + (mix('bills') - 1) * k, tax: e0.tax * k, gain: mix('gain') * k };
  return s.top1 && T.top1 ? { ...e, name: `1º do mundo (${e.name})`, price: e.price + TOP1.price, bills: e.bills + TOP1.bills, tax: e.tax * TOP1.tax, gain: e.gain + TOP1.gain } : e;
};
// imposto sobre grandes fortunas por faixa (como o imposto de renda): cada taxa só sobre o pedaço dentro da faixa
export function fortuneTax(w, mult = 1) {
  let t = 0;
  ELITE.forEach((e, i) => { const hi = ELITE[i + 1]?.min ?? Infinity; if (w > e.min) t += (Math.min(w, hi) - e.min) * e.tax; });
  return Math.round(t * T.eliteMult * mult);
}
// reembolso (v52): de v46 a v51 o imposto sobre fortunas foi de 3% a 7% ao mês e o pedágio chegou a 60% dos ganhos.
// Devolve a diferença para as taxas atuais, lendo o livro-caixa a partir do mês `from` (mês do mundo quando a v46 entrou).
const OLD_TAX = { 'milionário do topo': 0.03, 'magnata do mundo': 0.04, 'tubarão do mundo': 0.045, 'bilionário em formação': 0.05, 'dono do mundo': 0.06, 'imperador do 21 World': 0.07 };
const OLD_GAIN = { 45: 0.18, 50: 0.22, 55: 0.26, 60: 0.3, 65: 0.37, 70: 0.41, 75: 0.45 };   // % cobrado → % de hoje (65 a 75 = 1º do ranking)
export function taxRefund(log, from) {
  let total = 0;
  for (const l of log || []) {
    if (!(l.m >= from) || !(l.val < 0)) continue;
    const t = /^imposto sobre grandes fortunas \((?:1º do mundo \()?(.+?)\)?\)$/.exec(l.txt || ''), g = /^pedágio dos mais ricos: (\d+)% dos ganhos/.exec(l.txt || '');
    if (t && OLD_TAX[t[1]]) total += -l.val * (1 - ELITE.find(e => e.name === t[1]).tax / OLD_TAX[t[1]]);
    else if (g && OLD_GAIN[g[1]]) total += -l.val * (1 - OLD_GAIN[g[1]] / (g[1] / 100));
  }
  return Math.round(total);
}
// contas extras do mês: imposto sobre a fortuna + o quanto as contas normais encarecem
// spent/earned: tudo o que saiu/entrou no fechamento · living: só os gastos da casa e das fazendas (sem empresas e sem parcelas)
export function eliteBills(s, spent, earned = 0, living = spent) {
  const e = eliteOf(s), profit = Math.max(0, earned - spent);   // "dos ganhos" = do lucro do mês, não do faturamento
  if (!e) {   // ainda não é elite: imposto de renda simples sobre o lucro do mês
    const it = netWorth(s) >= T.incomeMin ? Math.round(profit * T.incomeTax) : 0;
    if (it > 0) { s.money -= it; return [{ txt: `imposto de renda (${Math.round(T.incomeTax * 100)}% do lucro do mês)`, val: -it }]; }
    return [];
  }
  const w = netWorth(s), tax = fortuneTax(w, s.top1 && T.top1 ? TOP1.tax : 1), extra = Math.round(Math.max(0, living) * (e.bills - 1)), cut = Math.round(profit * e.gain), out = [];
  if (cut > 0) { s.money -= cut; out.push({ txt: `pedágio dos mais ricos: ${Math.round(e.gain * 100)}% do lucro do mês`, val: -cut }); }
  if (tax > 0) { s.money -= tax; out.push({ txt: `imposto sobre grandes fortunas (${e.name})`, val: -tax }); }
  if (extra > 0) { s.money -= extra; out.push({ txt: `contas mais caras para quem está no topo (+${Math.round((e.bills - 1) * 100)}%)`, val: -extra }); }
  return out;
}
