// Loja (regras puras): vender qualquer coisa na hora para a casa ou anunciar.
// Anúncio: outros jogadores online podem comprar; se ninguém comprar, compradores da casa pagam no máximo 5% acima do preço da casa.
import { CARS, CAR_BUYBACK, MARKET_FEE } from './logic.js';
import * as ST from './stable.js';
import * as CD from './cards.js';
import * as FT from './futebol.js';
import { inventory } from './trade.js';
import * as GR from './granja.js';
import * as PM from './pomar.js';
import * as CN from './cana.js';
import * as NG from './negocios.js';
import { debt } from './logic.js';
import { CATALOG, accsOf } from './avatar.js';

export const HOUSE_RATE = { car: CAR_BUYBACK, land: 0.95, card: CD.SELL, player: 0.8 };
export const NPC_MAX = 1.05;            // comprador da casa paga até 5% acima do preço de venda na hora
export const MAX_LISTINGS = 8;

// valor do clube inteiro: 80% do preço do clube (com o elenco junto) + metade do que foi gasto no estádio. Com preço real o clube
// dá perto do zero a zero, então revender por menos da metade (como era até a v150) tornava qualquer compra prejuízo certo.
// Nunca acima do preço menos o patrocínio que veio junto: comprar e revender não dá lucro.
export const CLUB_RESALE = 0.8;
export function clubValue(f) {
  if (!f?.club) return 0;
  let stadium = 0; for (let l = 1; l < (f.stadium || 1); l++) stadium += FT.TICKET[f.div] * 8 * l * 0.5;
  const price = FT.clubPrice(f.club), base = Math.min(price * CLUB_RESALE, (price - FT.sponsorOf({ club: f.club, div: FT.divOf(f.club) })) * 0.9);   // e nunca acima do preço menos o patrocínio que veio junto
  return Math.round(Math.max(0, base) + stadium);
}
// tudo que dá para vender: o inventário de trocas + o clube inteiro
export function items(s) {
  const out = inventory(s).map(i => ({ ...i, key: `${i.kind}:${i.id}` }));
  for (const h of (s.granja?.houses || []).filter(h => h && GR.HOUSES[h.type])) out.push({ kind: 'aviario', id: h.id, key: `aviario:${h.id}`, label: `${GR.HOUSES[h.type].label} (granja)`, value: h.value, data: h });
  for (const t of s.owned || []) { const id = t.startsWith('acc:') && t.slice(4), o = id && CATALOG.acc.opts.find(x => x.id === id && x.price); if (o) out.push({ kind: 'acc', id, key: `acc:${id}`, label: id, value: o.price, acc: id }); }
  if (s.fut?.club) out.push({ kind: 'club', id: 'club', key: 'club:club', label: `clube ${s.fut.club} (${FT.DIVS[s.fut.div]})`, value: clubValue(s.fut) });
  for (const w of s.biz?.wh || []) out.push({ kind: 'galpao', id: w.id, key: `galpao:${w.id}`, label: NG.WAREHOUSES[w.type].label, value: w.value, data: w });
  for (const c of NG.CAT_KEYS) for (const b of s.biz?.[c] || []) { const C = NG.LISTS[c][b.brand]; if (!C) continue; out.push({ kind: 'empresa', id: b.id, key: `empresa:${b.id}`, cat: c, label: `${C.name} (${({ banks: 'banco', isps: 'provedor', markets: 'supermercado', usinas: 'usina' })[c] || NG.SECTORS[c]?.one})`, value: NG.saleValue(s, c, b), data: b }); }
  return out;
}
export function housePrice(s, it) {
  if (it.kind === 'car') return Math.round(it.data.value * CAR_BUYBACK);
  if (it.kind === 'animal') return ST.value(it.data);
  if (it.kind === 'land') return Math.round(it.data.value * 0.95 + (PM.orchardValue(s, it.data) + CN.caneValue(s, it.data)) * 0.9);
  if (it.kind === 'good') return Math.round(it.qty * (s.prices?.[it.good] || 0) * (1 - MARKET_FEE));
  if (it.kind === 'card') return Math.round(CD.value(it.data) * CD.SELL);
  if (it.kind === 'player') return Math.round(FT.value(it.data) * 0.8);
  if (it.kind === 'club') return clubValue(s.fut);
  if (it.kind === 'acc') return Math.round(CATALOG.acc.opts.find(o => o.id === it.acc).price * 0.5);
  if (it.kind === 'aviario') return Math.round(it.data.value * GR.HOUSE_RESALE);
  if (it.kind === 'galpao') return Math.round(it.data.value * 0.8);
  if (it.kind === 'empresa') return NG.saleValue(s, it.cat, it.data);
  return 0;
}
// por que não dá para vender (ou null)
export function blocked(s, it) {
  if (it.kind === 'land' && it.data.crop) return 'terra com lavoura plantada: espere a colheita.';
  if (it.kind === 'aviario' && GR.lotOf(s, it.id)) return 'venda o lote de frangos antes.';
  if ((it.kind === 'club' && FT.contractLeft(s) > 0) || (it.kind === 'player' && FT.lockedPlayer(s, it.data))) return FT.lockMsg(s);
  if (it.kind === 'player' && (s.fut?.squad?.length || 0) <= 14) return 'o clube precisa de pelo menos 14 jogadores. Para vender todos, venda o clube inteiro.';
  if (it.kind === 'galpao' && NG.tons(s) > NG.capacity(s) - NG.WAREHOUSES[it.data.type].cap) return 'o estoque não cabe sem esse galpão: venda parte antes.';
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
  if (it.kind === 'player' && s.fut) s.fut.squad = s.fut.squad.filter(p => p.id !== it.id);
  if (it.kind === 'club') { const ids = new Set((s.fut?.squad || []).map(p => `player:${p.id}`)); s.shop = (s.shop || []).filter(l => !ids.has(l.key)); delete s.fut; }
  if (it.kind === 'acc') { s.owned = s.owned.filter(t => t !== `acc:${it.acc}`); if (s.avatar) s.avatar.acc = accsOf(s.avatar).filter(x => x !== it.acc); }
  if (it.kind === 'aviario') s.granja.houses = s.granja.houses.filter(h => h.id !== it.id);
  if (it.kind === 'galpao') s.biz.wh = s.biz.wh.filter(w => w.id !== it.id);
  if (it.kind === 'empresa') s.biz[it.cat] = s.biz[it.cat].filter(b => b.id !== it.id);
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
    if (rng() < npcChance(l.price, house) * (indebted(s) ? 0.4 : 1)) { remove(s, it); s.money += l.price; sold.push({ ...l, buyer: 'casa' }); }
  }
  return sold;
}
// vitrine pública (vai para os outros jogadores pelo salão): só o que eles precisam ver
export const publicListings = s => (s.shop || []).filter(l => l.kind !== 'fera').slice(0, MAX_LISTINGS).map(l => { const d = l.kind === 'card' ? find(s, l.key)?.data : null; return { id: l.id, kind: l.kind, label: String(l.label).slice(0, 60), price: l.price, ...(d ? { card: { champ: d.champ, set: d.set, key: d.key, tier: d.tier } } : {}) }; });   // carta leva o desenho para a vitrine dos outros

// ---------- anúncios dos jogadores do mundo (todas as categorias) ----------
// trocam a cada 10 min, iguais para todo mundo; a compra entrega o item de verdade.
// Preço sempre acima do que a loja recompra: comprar do anúncio e revender na hora nunca dá lucro.
import * as L from './logic.js';
import * as NPCS from './npcs.js';
import { apply as tradeApply } from './trade.js';
export const NPC_WIN = 10 * 60 * 1000;
export const CATS = { veiculo: 'veículos', maquina: 'máquinas', terra: 'terras', animal: 'cavalos e galgos', gado: 'gado', produto: 'produtos', carta: 'cartas', futebol: 'futebol', granja: 'granja', galpao: 'galpões', empresa: 'empresas', acessorio: 'acessórios' };
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r100 = v => Math.round(v / 100) * 100;
export const HOLD = 0.4;   // um bot não põe num item só mais que 40% do patrimônio dele
const richOnline = (ids, month, t) => ids.map(id => NPCS.byId(id)).filter(Boolean).map(b => ({ nick: b.nick, worth: NPCS.worthAt(b, month, t) }));
export function npcListings(s, now = Date.now()) {
  const win = Math.floor(now / NPC_WIN), r = seeded(win * 7717 + 3), out = [], month = s.month || 1;
  const ids = [...NPCS.onlineSet(win * NPC_WIN)].sort(), rich = richOnline(ids, month, win * NPC_WIN);
  // realismo: só anuncia quem tem cacife (o item vale no máximo 40% do patrimônio do bot). Mundo novo, bots pobres: Feirão quase vazio, e vai enchendo conforme eles crescem
  const seller = price => { const ok = rich.filter(b => b.worth * HOLD >= price); return ok.length ? ok[Math.floor(r() * ok.length)].nick : null; };
  const cars = Object.entries(CARS).filter(([, c]) => c.type !== 'maquina' && c.price <= 4e6), maqs = Object.entries(CARS).filter(([, c]) => c.type === 'maquina');
  let n = 0;   // id fixo por posição: o anúncio que sai por falta de cacife não muda o id dos outros
  const add = (cat, label, price, items, extra = {}) => { const id = `n${win}-${n++}`, who = seller(price); if (who) out.push({ id, cat, label, price: r100(price), items, seller: who, ...extra }); };
  // vitrine cheia, mas sem repetir foto: cada anúncio é um modelo, produto, campeão ou animal diferente
  const mix = arr => { const x = [...arr]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  for (const [m, c] of mix(cars).slice(0, 6)) { const v = r100(c.price * (0.7 + r() * 0.2)); add('veiculo', `${c.name} seminovo`, v * 1.06, [{ kind: 'car', data: { model: m, value: v } }], { img: c.img }); }
  for (const [m, c] of mix(maqs).slice(0, 3)) { const v = r100(c.price * (0.75 + r() * 0.15)); add('maquina', `${c.name} usado`, v * 1.06, [{ kind: 'car', data: { model: m, value: v } }], { img: c.img }); }
  for (let k = 0; k < 6; k++) { const tmp = { nextId: 1, offers: [] }; L.refreshOffers(tmp, r); const o = tmp.offers[0]; add('terra', `${o.ha} ha, ${o.region}`, o.value * 1.06, [{ kind: 'land', data: { ...o, own: true, leasedOut: false } }], { land: o }); }
  const pen = { stable: { animals: [], offers: [] } };   // fotos já usadas pelos anúncios de animais
  for (const kind of ['horse', 'horse', 'horse', 'horse', 'dog', 'dog', 'dog', 'dog']) { const a = ST.newAnimal(kind, 44 + Math.floor(r() * 30), r, 0); ST.photo(a, pen); pen.stable.animals.push(a); add('animal', `${ST.KINDS[kind].label} ${a.name}, nota ${ST.rating(a)}`, ST.value(a) * 1.12, [{ kind: 'animal', data: a }], { animal: a }); }
  { const n = 10 + Math.floor(r() * 31); add('gado', `${n} bezerros nelore desmamados`, n * (s.prices?.bezerro || 2600) * 1.06, [], { heads: n }); }
  for (const g of ['soja', 'milho', 'cafe', 'laranja']) { const q = (g === 'cafe' ? 20 : 200) + Math.floor(r() * (g === 'cafe' ? 80 : 800)), p = s.prices?.[g] || { soja: 130, milho: 60, cafe: 1400, laranja: 38 }[g]; add('produto', `${q} ${g === 'laranja' ? 'caixas de laranja' : `sacas de ${g === 'cafe' ? 'café' : g}`}`, q * p * 1.05, [{ kind: 'good', good: g, qty: q }], { good: g }); }
  const champs = new Set();
  const nCards = r() < 0.35 ? 1 : 0;   // carta no Feirão é rara: no máximo 1, e só às vezes
  for (let k = 0; k < 30 && champs.size < nCards; k++) { const c = { ...CD.draw(r, k % 3), born: Math.max(0, month - Math.floor(r() * 24)) }; if (champs.has(c.champ)) continue; champs.add(c.champ); add('carta', `carta ${CD.label(c)}`, CD.value(c, month) * (1.02 + r() * 0.12), [{ kind: 'card', data: c }], { card: c }); }
  { const pos = Object.keys(FT.POS)[Math.floor(r() * 6)], p = FT.genPlayer(pos, 55 + Math.floor(r() * 25), r); add('futebol', `${FT.POS[pos]} ${p.name}, nota ${p.ovr}`, FT.value(p) * 1.1, [{ kind: 'player', data: p }]); }
  const sold = new Set(s.npcSold?.win === win ? s.npcSold.ids : []);
  return out.filter(l => !sold.has(l.id));
}
export function buyNpc(s, id, now = Date.now()) {
  const l = npcListings(s, now).find(x => x.id === id);
  if (!l) return { err: 'esse anúncio já saiu do ar.' };
  if (l.price > s.money) return { err: 'dinheiro insuficiente.' };
  if (l.heads) { s.money -= l.price; s.herd.push({ id: s.nextId++, heads: l.heads, kg: 190 }); }
  else { const e = tradeApply(s, [{ kind: 'money', amount: l.price }], l.items); if (e) return { err: e }; }
  const win = Math.floor(now / NPC_WIN);
  if (s.npcSold?.win !== win) s.npcSold = { win, ids: [] };
  s.npcSold.ids.push(id);
  return { item: l };
}
// categoria de um item seu (para os filtros da loja)
export const catOf = it => it.kind === 'galpao' ? 'galpao' : it.kind === 'empresa' ? 'empresa' : it.kind === 'car' ? (CARS[it.data?.model]?.type === 'maquina' ? 'maquina' : 'veiculo') : it.kind === 'land' ? 'terra' : it.kind === 'animal' ? 'animal'
  : it.kind === 'good' ? 'produto' : it.kind === 'card' ? 'carta' : it.kind === 'player' || it.kind === 'club' ? 'futebol' : it.kind === 'aviario' ? 'granja' : it.kind === 'acc' ? 'acessorio' : 'produto';

// ---------- propostas dos jogadores do mundo pelos seus anúncios ----------
// Sempre abaixo do anúncio; se você está endividado, eles apertam mais (sabem que você precisa vender).
export const indebted = s => (s.money || 0) < 0 || debt(s) > Math.max(0, s.money || 0) * 0.5;
export const OFFER_TTL = 3 * 60 * 1000;
export function npcOffer(s, now = Date.now(), rng = Math.random) {
  s.offersIn = (s.offersIn || []).filter(o => now - o.at < OFFER_TTL && (s.shop || []).some(l => l.id === o.lid));
  const ls = (s.shop || []).filter(l => !s.offersIn.some(o => o.lid === l.id)); if (!ls.length || rng() > 0.45) return null;
  const l = ls[Math.floor(rng() * ls.length)], it = find(s, l.key); if (!it || blocked(s, it)) return null;
  const house = housePrice(s, it), f = indebted(s) ? 0.78 + rng() * 0.1 : 0.94 + rng() * 0.1;
  const price = Math.min(l.price - 100, Math.round(house * f / 100) * 100); if (price < house * 0.7 || price <= 0) return null;
  const can = richOnline([...NPCS.onlineSet(now)], s.month || 1, now).filter(b => b.worth * HOLD >= price); if (!can.length) return null;   // ninguém online tem dinheiro para isso
  const npc = can[Math.floor(rng() * can.length)].nick;
  const o = { id: `o${now.toString(36)}${Math.floor(rng() * 1e4)}`, lid: l.id, npc, price, label: l.label, ask: l.price, at: now, low: indebted(s) };
  s.offersIn.push(o); return o;
}
export function acceptOffer(s, oid, now = Date.now()) {
  const o = (s.offersIn || []).find(x => x.id === oid); if (!o || now - o.at > OFFER_TTL) return { err: 'essa proposta expirou.' };
  const l = (s.shop || []).find(x => x.id === o.lid), it = l && find(s, l.key); if (!it) return { err: 'o item não está mais à venda.' };
  const b = blocked(s, it); if (b) return { err: b };
  remove(s, it); s.money += o.price; s.offersIn = s.offersIn.filter(x => x.lid !== o.lid); return { offer: o };
}
export function rejectOffer(s, oid) { s.offersIn = (s.offersIn || []).filter(x => x.id !== oid); }
