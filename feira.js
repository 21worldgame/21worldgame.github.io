// Feira dos bots: bots vendem e compram itens, com preço puxado pela economia dos jogadores (regras puras).
import { CARS, CAR_BUYBACK } from './logic.js';
import { CATALOG } from './avatar.js';
import { BOT_NAMES, newDeal } from './bots.js';
import { GOODS } from './trade.js';

// índice da economia: patrimônio mediano dos jogadores do ranking comparado a R$ 500 mil.
// Economia rica = bots pedem e pagam mais (até +25%); economia pobre = até -15%.
export function econIndex(worths) {
  const w = (worths || []).filter(Number.isFinite).sort((a, b) => a - b);
  if (!w.length) return 1;
  const med = w[Math.floor(w.length / 2)];
  return Math.max(0.85, Math.min(1.25, (Math.max(1, med) / 500000) ** 0.08));
}

const pick = (a, rng) => a[Math.floor(rng() * a.length)];
// renova as bancas no começo de cada mês do jogo
export function refresh(s, idx = 1, rng = Math.random) {
  if (s.feira?.month === s.month) return s.feira;
  const list = [], models = Object.keys(CARS).filter(m => CARS[m].price <= Math.max(400000, (s.money || 0) * 3));
  for (let i = 0; i < 3; i++) {
    const m = pick(models, rng), age = 0.7 + rng() * 0.25, value = Math.round(CARS[m].price * age);
    list.push({ id: `f${s.month}-${i}`, kind: 'car', model: m, label: `${CARS[m].name} seminovo`, value, ask: Math.round(Math.min(CARS[m].price * 0.98, value * idx * (0.95 + rng() * 0.15))), bot: pick(BOT_NAMES, rng) });
  }
  for (const g of Object.keys(GOODS)) {
    const qty = 20 + Math.floor(rng() * 80), unit = s.prices?.[g] || 100;
    list.push({ id: `f${s.month}-${g}`, kind: 'good', good: g, qty, label: `${qty} sacas de ${GOODS[g]}`, value: qty * unit, ask: Math.round(qty * unit * idx * (1.05 + rng() * 0.12)), bot: pick(BOT_NAMES, rng) });
  }
  const accs = CATALOG.acc.opts.filter(o => o.price && !(s.owned || []).includes(`acc:${o.id}`));
  if (accs.length) { const a = pick(accs, rng); list.push({ id: `f${s.month}-acc`, kind: 'acc', acc: a.id, label: `${a.id} (usado, com vantagem)`, value: a.price, ask: Math.round(a.price * idx * (0.75 + rng() * 0.2)), bot: pick(BOT_NAMES, rng) }); }
  // um bot quer comprar algo seu
  const mine = [...(s.cars || []).map(c => ({ kind: 'car', id: c.id, label: CARS[c.model]?.name, value: c.value })),
    ...Object.entries(s.stock || {}).filter(([, q]) => q >= 10).map(([g, q]) => ({ kind: 'good', good: g, qty: q, label: `${q} sacas de ${GOODS[g]}`, value: q * (s.prices?.[g] || 0) }))];
  const want = mine.length ? pick(mine, rng) : null;
  s.feira = { month: s.month, idx, list, want: want && { ...want, bid: Math.round(Math.min(want.value * 0.97, want.value * idx * (0.88 + rng() * 0.1))), bot: pick(BOT_NAMES, rng) } };
  return s.feira;
}

// negociação: o bot nunca vende abaixo do que daria lucro na revenda imediata, nem compra acima do valor
export function buyDeal(it, rng = Math.random) {
  const d = newDeal(it.ask, rng, 'sell');
  d.limit = Math.max(d.limit, Math.round(it.kind === 'car' ? it.value : it.kind === 'good' ? it.value * 1.02 : it.value * 0.6));
  d.ask = Math.max(d.ask, d.limit);
  return d;
}
export function sellDeal(w, rng = Math.random) {
  const d = newDeal(w.bid, rng, 'buy');
  d.limit = Math.min(d.limit, Math.round(w.value * (w.kind === 'good' ? 1.0 : 0.99)));
  d.ask = Math.min(d.ask, d.limit);
  return d;
}

// fecha a compra de um item da banca
export function buy(s, id, price) {
  const it = s.feira?.list.find(x => x.id === id);
  if (!it) return 'esse item já foi vendido.';
  if (price > s.money) return 'dinheiro insuficiente.';
  s.money -= price;
  if (it.kind === 'car') s.cars.push({ id: s.nextId++, model: it.model, value: Math.min(it.value, price) });
  if (it.kind === 'good') s.stock[it.good] = (s.stock[it.good] || 0) + it.qty;
  if (it.kind === 'acc') (s.owned ??= []).push(`acc:${it.acc}`);
  s.feira.list = s.feira.list.filter(x => x !== it);
  return null;
}
// fecha a venda para o bot que quer comprar
export function sell(s, price) {
  const w = s.feira?.want;
  if (!w) return 'o comprador desistiu.';
  if (w.kind === 'car') { if (!s.cars.some(c => c.id === w.id)) return 'esse carro não está mais com você.'; s.cars = s.cars.filter(c => c.id !== w.id); }
  if (w.kind === 'good') { if ((s.stock[w.good] || 0) < w.qty) return 'você não tem mais essa quantidade.'; s.stock[w.good] -= w.qty; }
  s.money += price;
  s.feira.want = null;
  return null;
}
export const dealerBuyback = v => v * CAR_BUYBACK;
