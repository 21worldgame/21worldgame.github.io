// Inventário e trocas entre jogadores (regras puras, sem DOM nem rede).
// Item da troca: { kind: 'chips'|'money', amount } | { kind: 'good', good, qty } | { kind: 'car'|'animal'|'land', data }
import { CARS, region } from './logic.js';
import { KINDS as ANIMAL } from './stable.js';
export const GOODS = { soja: 'soja', milho: 'milho', cafe: 'café' };
export const MAX_ITEMS = 8;

// tudo o que o jogador tem e pode trocar
export function inventory(s) {
  const out = [];
  for (const c of s.cars || []) if (CARS[c.model]) out.push({ kind: 'car', id: c.id, label: CARS[c.model].name, value: c.value, img: CARS[c.model].img, data: c });
  for (const a of s.stable?.animals || []) out.push({ kind: 'animal', id: a.id, label: `${a.name} (${ANIMAL[a.kind].label})`, value: 0, data: a });
  for (const l of s.lands || []) if (l.own) out.push({ kind: 'land', id: l.id, label: `${l.ha} ha, ${l.region}`, value: l.value, data: l });
  for (const [g, q] of Object.entries(s.stock || {})) if (q > 0) out.push({ kind: 'good', id: g, good: g, label: `${GOODS[g] || g}: ${q} sacas`, qty: q, value: q * (s.prices?.[g] || 0) });
  return out;
}

export const describe = it => it.kind === 'chips' ? `${it.amount} fichas` : it.kind === 'money' ? `R$ ${Math.round(it.amount).toLocaleString('pt-BR')}`
  : it.kind === 'good' ? `${it.qty} sacas de ${GOODS[it.good] || it.good}` : it.kind === 'car' ? (CARS[it.data.model]?.name || 'carro')
  : it.kind === 'animal' ? `${it.data.name} (${ANIMAL[it.data.kind]?.label || 'animal'})` : it.kind === 'land' ? `${it.data.ha} ha, ${it.data.region}` : '?';

// o jogador ainda tem tudo o que ofereceu?
export function canGive(s, items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return 'oferta inválida.';
  const sum = k => items.filter(i => i.kind === k).reduce((t, i) => t + i.amount, 0);
  if (items.some(i => (i.kind === 'chips' || i.kind === 'money') && !(Number.isFinite(i.amount) && i.amount > 0))) return 'valor inválido na oferta.';
  if (sum('chips') > s.chips) return 'fichas insuficientes para a oferta.';
  if (sum('money') > s.money) return 'dinheiro insuficiente para a oferta.';
  for (const i of items) {
    if (i.kind === 'good' && !((s.stock?.[i.good] || 0) >= i.qty && i.qty > 0)) return 'você não tem essa quantidade no armazém.';
    if (i.kind === 'car' && !(s.cars || []).some(c => c.id === i.data?.id)) return 'esse carro não está mais na sua garagem.';
    if (i.kind === 'animal' && !(s.stable?.animals || []).some(a => a.id === i.data?.id)) return 'esse animal não é mais seu.';
    if (i.kind === 'land' && !(s.lands || []).some(l => l.id === i.data?.id && l.own)) return 'essa terra não é mais sua.';
    if (i.kind === 'land' && i.data.crop) return 'terra com lavoura plantada não pode ser trocada.';
  }
  return null;
}

// itens que chegam de outro jogador: só aceita formato conhecido, com valores no limite
export function sanitize(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).flatMap(i => {
    if ((i?.kind === 'chips' || i?.kind === 'money') && Number.isFinite(i.amount) && i.amount > 0 && i.amount < 1e10) return [{ kind: i.kind, amount: Math.floor(i.amount) }];
    if (i?.kind === 'good' && GOODS[i.good] && Number.isInteger(i.qty) && i.qty > 0 && i.qty < 1e7) return [{ kind: 'good', good: i.good, qty: i.qty }];
    if (i?.kind === 'car' && CARS[i.data?.model]) return [{ kind: 'car', data: { model: i.data.model, value: Math.min(Number(i.data.value) || 0, CARS[i.data.model].price), id: i.data.id } }];
    if (i?.kind === 'animal' && ANIMAL[i.data?.kind]) {
      const a = i.data, cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || lo));
      return [{ kind: 'animal', data: { ...a, name: String(a.name || 'animal').replace(/[<>&"]/g, '').slice(0, 20), spd: cl(a.spd, 20, 99), sta: cl(a.sta, 20, 99), acc: cl(a.acc, 20, 99), pot: cl(a.pot, 20, 99), age: cl(a.age, 1, 400) } }];
    }
    if (i?.kind === 'land' && i.data?.region && Number(i.data.ha) > 0 && Number(i.data.ha) <= 1000) {
      const reg = region(i.data.region);
      return [{ kind: 'land', data: { ...i.data, region: reg.name, uf: reg.uf, ha: Number(i.data.ha), value: Math.min(Number(i.data.value) || 0, reg.perHa * 3 * Number(i.data.ha)), crop: undefined, leasedOut: false, own: true } }];
    }
    return [];
  });
}

// aplica a troca de um lado: tira o que deu, põe o que recebeu (novos ids para não colidir)
export function apply(s, give, receive) {
  const err = canGive(s, give);
  if (err) return err;
  for (const i of give) {
    if (i.kind === 'chips') s.chips -= i.amount;
    if (i.kind === 'money') s.money -= i.amount;
    if (i.kind === 'good') s.stock[i.good] -= i.qty;
    if (i.kind === 'car') s.cars = s.cars.filter(c => c.id !== i.data.id);
    if (i.kind === 'animal') s.stable.animals = s.stable.animals.filter(a => a.id !== i.data.id);
    if (i.kind === 'land') s.lands = s.lands.filter(l => l.id !== i.data.id);
  }
  for (const i of sanitize(receive)) {
    if (i.kind === 'chips') s.chips += i.amount;
    if (i.kind === 'money') s.money += i.amount;
    if (i.kind === 'good') s.stock[i.good] = (s.stock[i.good] || 0) + i.qty;
    if (i.kind === 'car') s.cars.push({ ...i.data, id: s.nextId++ });
    if (i.kind === 'animal') s.stable.animals.push({ ...i.data, id: s.stable.next++, wk: Math.min(4, i.data.wk ?? 4) });
    if (i.kind === 'land') s.lands.push({ ...i.data, id: s.nextId++ });
  }
  return null;
}
