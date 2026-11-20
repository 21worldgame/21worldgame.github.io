// Inventário e trocas entre jogadores (regras puras, sem DOM nem rede).
// Item da troca: { kind: 'chips'|'money', amount } | { kind: 'good', good, qty } | { kind: 'car'|'animal'|'land', data }
import { CARS, region } from './logic.js';
import { KINDS as ANIMAL, value as animalValue } from './stable.js';
import * as CD from './cards.js';
import { POS as FPOS, value as fValue, salary as fSalary, club as fClub, adoptClub } from './futebol.js';
import * as NG from './negocios.js';
import * as GR from './granja.js';
import { CATALOG } from './avatar.js';
export const GOODS = { soja: 'soja', milho: 'milho', cafe: 'café', laranja: 'laranja (caixas)' };
export const MAX_ITEMS = 8;

// tudo o que o jogador tem e pode trocar
export function inventory(s) {
  const out = [];
  for (const c of s.cars || []) if (CARS[c.model]) out.push({ kind: 'car', id: c.id, label: CARS[c.model].name, value: c.value, img: CARS[c.model].img, data: c });
  for (const a of s.stable?.animals || []) out.push({ kind: 'animal', id: a.id, label: `${a.name} (${ANIMAL[a.kind].label})`, value: animalValue(a), data: a });
  for (const l of s.lands || []) if (l.own) out.push({ kind: 'land', id: l.id, label: `${l.ha} ha, ${l.region}`, value: l.value, data: l });
  for (const c of s.cards || []) out.push({ kind: 'card', id: c.id, label: `carta ${CD.label(c)}`, value: CD.value(c), data: c });
  for (const p of s.fut?.squad || []) out.push({ kind: 'player', id: p.id, label: `${p.name} (${p.pos}, nota ${p.ovr})`, value: fValue(p), data: p });
  for (const [g, q] of Object.entries(s.stock || {})) if (q > 0) out.push({ kind: 'good', id: g, good: g, label: `${GOODS[g] || g}: ${q} sacas`, qty: q, value: q * (s.prices?.[g] || 0) });
  return out;
}

export const describe = it => it.kind === 'chips' ? `${it.amount} fichas` : it.kind === 'money' ? `R$ ${Math.round(it.amount).toLocaleString('pt-BR')}`
  : it.kind === 'good' ? `${it.qty} sacas de ${GOODS[it.good] || it.good}` : it.kind === 'car' ? (CARS[it.data.model]?.name || 'carro')
  : it.kind === 'acc' ? `acessório ${it.acc}` : it.kind === 'galpao' ? NG.WAREHOUSES[it.data?.type]?.label || 'galpão' : it.kind === 'aviario' ? `${GR.HOUSES[it.data?.type]?.label || 'galpão'} (granja)`
  : it.kind === 'empresa' ? NG.LISTS[it.cat]?.[it.data?.brand]?.name || 'empresa' : it.kind === 'club' ? `clube ${it.data?.club}`
  : it.kind === 'card' ? `carta ${CD.label(it.data)}` : it.kind === 'player' ? `jogador ${it.data.name} (${it.data.pos}, nota ${it.data.ovr})` : it.kind === 'animal' ? `${it.data.name} (${ANIMAL[it.data.kind]?.label || 'animal'})` : it.kind === 'land' ? `${it.data.ha} ha, ${it.data.region}` : '?';

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
    if (i.kind === 'acc' && !(s.owned || []).includes(`acc:${i.acc}`)) return 'esse acessório não é mais seu.';
    if (i.kind === 'galpao' && !(s.biz?.wh || []).some(w => w.id === i.data?.id)) return 'esse galpão não é mais seu.';
    if (i.kind === 'galpao' && NG.tons(s) > NG.capacity(s) - (NG.WAREHOUSES[i.data.type]?.cap || 0)) return 'o estoque não cabe sem esse galpão.';
    if (i.kind === 'aviario' && (!(s.granja?.houses || []).some(h => h.id === i.data?.id) || GR.lotOf(s, i.data.id))) return 'esse galpão da granja não está livre.';
    if (i.kind === 'empresa' && !(s.biz?.[i.cat] || []).some(b => b.id === i.data?.id)) return 'essa empresa não é mais sua.';
    if (i.kind === 'club' && s.fut?.club !== i.data?.club) return 'esse clube não é mais seu.';
    if (i.kind === 'land' && !(s.lands || []).some(l => l.id === i.data?.id && l.own)) return 'essa terra não é mais sua.';
    if (i.kind === 'land' && i.data.crop) return 'terra com lavoura plantada não pode ser trocada.';
    if (i.kind === 'card' && !(s.cards || []).some(c => c.id === i.data?.id)) return 'essa carta não é mais sua.';
    if (i.kind === 'player' && !(s.fut?.squad || []).some(p => p.id === i.data?.id)) return 'esse jogador não está mais no seu elenco.';
  }
  if (items.some(i => i.kind === 'player') && (s.fut?.squad || []).length - items.filter(i => i.kind === 'player').length < 14) return 'o elenco precisa ficar com pelo menos 14 jogadores.';
  return null;
}

// itens que chegam de outro jogador: só aceita formato conhecido, com valores no limite
export function sanitize(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, items.every(i => i?.kind === 'player') ? 40 : MAX_ITEMS).flatMap(i => {
    if ((i?.kind === 'chips' || i?.kind === 'money') && Number.isFinite(i.amount) && i.amount > 0 && i.amount < 1e10) return [{ kind: i.kind, amount: Math.floor(i.amount) }];
    if (i?.kind === 'good' && GOODS[i.good] && Number.isInteger(i.qty) && i.qty > 0 && i.qty < 1e7) return [{ kind: 'good', good: i.good, qty: i.qty }];
    if (i?.kind === 'car' && CARS[i.data?.model]) return [{ kind: 'car', data: { model: i.data.model, value: Math.min(Number(i.data.value) || 0, CARS[i.data.model].price), id: i.data.id } }];
    if (i?.kind === 'animal' && ANIMAL[i.data?.kind]) {
      const a = i.data, cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || lo));
      return [{ kind: 'animal', data: { ...a, name: String(a.name || 'animal').replace(/[<>&"]/g, '').slice(0, 20), spd: cl(a.spd, 20, 99), sta: cl(a.sta, 20, 99), acc: cl(a.acc, 20, 99), pot: cl(a.pot, 20, 99), age: cl(a.age, 1, 400) } }];
    }
    if (i?.kind === 'card') { const c = CD.sanitize(i.data); return c ? [{ kind: 'card', data: c }] : []; }
    if (i?.kind === 'player' && FPOS[i.data?.pos]) {
      const p = i.data, cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo))), ovr = cl(p.ovr, 30, 95);
      return [{ kind: 'player', data: { name: String(p.name || 'jogador').replace(/[<>&"]/g, '').slice(0, 30), pos: p.pos, age: cl(p.age, 16, 40), ovr, pot: cl(p.pot, ovr, 97), sal: fSalary(ovr), trait: String(p.trait || '').replace(/[<>&"]/g, '').slice(0, 20), id: p.id } }];
    }
    const num = (v, hi) => Math.max(0, Math.min(hi, Number(v) || 0));
    if (i?.kind === 'acc' && CATALOG.acc.opts.some(o => o.id === i.acc && o.price)) return [{ kind: 'acc', acc: i.acc }];
    if (i?.kind === 'galpao' && NG.WAREHOUSES[i.data?.type]) return [{ kind: 'galpao', data: { type: i.data.type, value: num(i.data.value, NG.WAREHOUSES[i.data.type].price * 3), id: i.data.id } }];
    if (i?.kind === 'aviario' && GR.HOUSES[i.data?.type]) return [{ kind: 'aviario', data: { type: i.data.type, value: num(i.data.value, GR.HOUSES[i.data.type].price * 2), id: i.data.id } }];
    if (i?.kind === 'empresa' && NG.LISTS[i.cat]?.[i.data?.brand]) {
      const d = JSON.parse(JSON.stringify(i.data || {})); if (JSON.stringify(d).length > 30000) return [];
      for (const k of ['capital', 'net', 'ports', 'subs']) if (k in d) d[k] = num(d[k], 5e9);
      if (Array.isArray(d.loans)) d.loans = d.loans.slice(0, 20).map(l => ({ bal: num(l.bal, 5e9), rate: num(l.rate, 0.1), left: num(l.left, 12), bad: num(l.bad, 0.2), n: num(l.n, 1e5) }));
      if (Array.isArray(d.units)) d.units = d.units.slice(0, 80).filter(u => NG.SECTORS[i.cat]?.units[u?.t]).map(u => ({ t: u.t, at: num(u.at, 1e7) }));
      return [{ kind: 'empresa', cat: i.cat, data: d }];
    }
    if (i?.kind === 'club' && fClub(i.data?.club)) {
      const squad = sanitize((i.data.squad || []).slice(0, 40).map(p => ({ kind: 'player', data: p }))).map(x => ({ ...x.data, id: `c${Math.random().toString(36).slice(2, 8)}` }));
      return [{ kind: 'club', data: { club: fClub(i.data.club).n, squad, stadium: Math.round(num(i.data.stadium, 20)) || 1, trophies: Math.round(num(i.data.trophies, 200)) } }];
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
    if (i.kind === 'player' && s.fut) s.fut.squad = s.fut.squad.filter(p => p.id !== i.data.id);
    if (i.kind === 'card') s.cards = s.cards.filter(c => c.id !== i.data.id);
    if (i.kind === 'acc') { s.owned = s.owned.filter(t => t !== `acc:${i.acc}`); if (s.avatar?.acc === i.acc) s.avatar.acc = 'nenhum'; }
    if (i.kind === 'galpao') s.biz.wh = s.biz.wh.filter(w => w.id !== i.data.id);
    if (i.kind === 'aviario') s.granja.houses = s.granja.houses.filter(h => h.id !== i.data.id);
    if (i.kind === 'empresa') s.biz[i.cat] = s.biz[i.cat].filter(b => b.id !== i.data.id);
    if (i.kind === 'club') delete s.fut;
  }
  for (const i of sanitize(receive)) {
    if (i.kind === 'chips') s.chips += i.amount;
    if (i.kind === 'money') s.money += i.amount;
    if (i.kind === 'good') s.stock[i.good] = (s.stock[i.good] || 0) + i.qty;
    if (i.kind === 'car') s.cars.push({ ...i.data, id: s.nextId++ });
    if (i.kind === 'animal') s.stable.animals.push({ ...i.data, id: s.stable.next++, wk: Math.min(4, i.data.wk ?? 4) });
    if (i.kind === 'land') s.lands.push({ ...i.data, id: s.nextId++ });
    if (i.kind === 'card') CD.give(s, i.data);
    if (i.kind === 'acc' && !(s.owned ??= []).includes(`acc:${i.acc}`)) s.owned.push(`acc:${i.acc}`);
    if (i.kind === 'galpao') { NG.ensure(s); s.biz.wh.push({ ...i.data, id: `b${s.nextId++}` }); }
    if (i.kind === 'aviario') { s.granja ??= { houses: [], lots: [] }; (s.granja.houses ??= []).push({ ...i.data, id: `g${s.nextId++}` }); }
    if (i.kind === 'empresa') { NG.ensure(s); if (!s.biz[i.cat].some(b => b.brand === i.data.brand)) s.biz[i.cat].push({ ...i.data, id: `b${s.nextId++}` }); }
    if (i.kind === 'club') adoptClub(s, i.data);
    if (i.kind === 'player') { const p = { ...i.data, id: `t${s.nextId++}` }; if (s.fut?.club) s.fut.squad.push(p); else (s.freeAgents ??= []).push(p); }   // sem clube: espera até assumir um
  }
  return null;
}
