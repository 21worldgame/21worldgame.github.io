// Loja (regras puras): vender qualquer coisa na hora para a casa ou anunciar.
// Anúncio: outros jogadores online podem comprar; se ninguém comprar, compradores da casa pagam no máximo 5% acima do preço da casa.
import { CARS, CAR_BUYBACK, MARKET_FEE } from './logic.js';
import * as ST from './stable.js';
import * as CD from './cards.js';
import * as FT from './futebol.js';
import { inventory } from './trade.js';

export const HOUSE_RATE = { car: CAR_BUYBACK, land: 0.95, card: CD.SELL, player: 0.8 };
export const NPC_MAX = 1.05;            // comprador da casa paga até 5% acima do preço de venda na hora
export const MAX_LISTINGS = 8;

// valor do clube inteiro: elenco + a vaga na divisão + o estádio
export function clubValue(f) {
  if (!f?.club) return 0;
  const squad = f.squad.reduce((t, p) => t + FT.value(p), 0) * 0.8;
  const spot = FT.clubPrice(f.club) * 0.6;
  let stadium = 0; for (let l = 1; l < (f.stadium || 1); l++) stadium += FT.TICKET[f.div] * 8 * l * 0.5;
  return Math.round(squad + spot + stadium);
}
// tudo que dá para vender: o inventário de trocas + o clube inteiro
export function items(s) {
  const out = inventory(s).map(i => ({ ...i, key: `${i.kind}:${i.id}` }));
  if (s.fut?.club) out.push({ kind: 'club', id: 'club', key: 'club:club', label: `clube ${s.fut.club} (${FT.DIVS[s.fut.div]})`, value: clubValue(s.fut) });
  return out;
}
export function housePrice(s, it) {
  if (it.kind === 'car') return Math.round(it.data.value * CAR_BUYBACK);
  if (it.kind === 'animal') return ST.value(it.data);
  if (it.kind === 'land') return Math.round(it.data.value * 0.95);
  if (it.kind === 'good') return Math.round(it.qty * (s.prices?.[it.good] || 0) * (1 - MARKET_FEE));
  if (it.kind === 'card') return Math.round(CD.value(it.data) * CD.SELL);
  if (it.kind === 'player') return Math.round(FT.value(it.data) * 0.8);
  if (it.kind === 'club') return clubValue(s.fut);
  return 0;
}
// por que não dá para vender (ou null)
export function blocked(s, it) {
  if (it.kind === 'land' && it.data.crop) return 'terra com lavoura plantada: espere a colheita.';
  if (it.kind === 'player' && s.fut.squad.length <= 14) return 'o elenco precisa de pelo menos 14 jogadores.';
  return null;
}
export const find = (s, key) => items(s).find(i => i.key === key);

// tira o item do jogador (usado na venda para a casa, para comprador da casa e para outro jogador)
export function remove(s, it) {
  if (it.kind === 'car') s.cars = s.cars.filter(c => c.id !== it.id);
  if (it.kind === 'animal') s.stable.animals = s.stable.animals.filter(a => a.id !== it.id);
  if (it.kind === 'land') s.lands = s.lands.filter(l => l.id !== it.id);
  if (it.kind === 'good') s.stock[it.good] = Math.max(0, (s.stock[it.good] || 0) - it.qty);
  if (it.kind === 'card') s.cards = s.cards.filter(c => c.id !== it.id);
  if (it.kind === 'player') s.fut.squad = s.fut.squad.filter(p => p.id !== it.id);
  if (it.kind === 'club') delete s.fut;
  s.shop = (s.shop || []).filter(l => l.key !== it.key);
}
export function sellToHouse(s, key) {
  const it = find(s, key);
  if (!it) return { err: 'esse item não é mais seu.' };
  const b = blocked(s, it); if (b) return { err: b };
  const v = housePrice(s, it);
  remove(s, it); s.money += v;
  return { amount: v, item: it };
}

// ---------- anúncios ----------
export function list(s, key, price, now = Date.now()) {
  const it = find(s, key);
  if (!it) return 'esse item não é mais seu.';
  const b = blocked(s, it); if (b) return b;
  price = Math.round(Number(price) || 0);
  if (price < 100) return 'preço mínimo R$ 100.';
  s.shop ??= [];
  if (s.shop.some(l => l.key === key)) return 'esse item já está anunciado.';
  if (s.shop.length >= MAX_LISTINGS) return `no máximo ${MAX_LISTINGS} anúncios ao mesmo tempo.`;
  s.shop.push({ id: `a${now.toString(36)}${Math.floor(Math.random() * 1e4)}`, key, kind: it.kind, label: it.label, price, house: housePrice(s, it), at: now });
  return null;
}
export function unlist(s, id) { s.shop = (s.shop || []).filter(l => l.id !== id); }
// chance de um comprador da casa levar o anúncio nesta checagem (a cada 30 s)
export function npcChance(price, house) { return house > 0 ? Math.max(0, Math.min(1, (house * NPC_MAX - price) / (house * 0.3))) * 0.15 : 0; }
export function npcTick(s, rng = Math.random) {
  const sold = [];
  for (const l of [...(s.shop || [])]) {
    const it = find(s, l.key);
    if (!it || blocked(s, it)) { unlist(s, l.id); continue; }
    const house = housePrice(s, it);
    if (rng() < npcChance(l.price, house)) { remove(s, it); s.money += l.price; sold.push({ ...l, buyer: 'casa' }); }
  }
  return sold;
}
// vitrine pública (vai para os outros jogadores pelo salão): só o que eles precisam ver
export const publicListings = s => (s.shop || []).filter(l => l.kind !== 'club').slice(0, MAX_LISTINGS).map(l => ({ id: l.id, kind: l.kind, label: String(l.label).slice(0, 60), price: l.price }));
