// Propostas dos bots: de tempos em tempos um jogador online do mundo procura VOCÊ para negociar o que você tem
// (sacas, caixas de laranja, um lote de boi pronto) ou para te vender bezerros. Uma proposta por janela de 25 min,
// nem toda janela tem proposta, e some quando a janela acaba. Aceitar, negociar (contraproposta) ou recusar.
import * as NPC from './npcs.js';
import { arrobas, cattleFee } from './logic.js';
import { newDeal } from './bots.js';

export const WIN = 25 * 60000;
const h = n => { const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
const GOOD = { soja: ['sacas de soja', 'saca'], milho: ['sacas de milho', 'saca'], cafe: ['sacas de café', 'saca'], laranja: ['caixas de laranja', 'caixa'] };
const LINES = {
  buy: ['to precisando de {q}, te pago {p} cada, fechado?', 'vi que vc tem {q} parado no armazém. faço {p} cada', 'bora negociar? levo {q} a {p} cada, pago na hora'],
  herd: ['teu lote de {n} bois ta no ponto, pago {t} no lote todo', 'quero teus {n} bois, {t} e tiro com meu caminhão'],
  calves: ['tenho {n} bezerros desmamados, faço {p} cada pra vc', 'sobrou {n} bezerro aqui, {p} cada, quer?'],
};
// a proposta da janela atual (ou null): igual enquanto a janela durar, muda com o que você tem
export function offerFor(s, now = Date.now()) {
  const slot = Math.floor(now / WIN), seed = slot * 7 + (s.nextId || 0) % 5;
  if (s.botOfferDone === slot || h(seed) > 0.55) return null;
  const on = NPC.onlineNow(now, 12); if (!on.length) return null;
  const bot = on[Math.floor(h(seed + 1) * on.length)], p = s.prices || {}, r = h(seed + 2), line = a => a[Math.floor(h(seed + 3) * a.length)];
  const opts = [];
  for (const g of Object.keys(GOOD)) { const have = Math.floor(s.stock?.[g] || 0); if (have >= 20 && p[g]) opts.push(() => {
    const q = Math.max(10, Math.round(have * (0.3 + r * 0.5))), unit = Math.round(p[g] * (0.97 + r * 0.1) * 100) / 100;
    return { kind: 'buy', good: g, q, unit, total: Math.round(q * unit), txt: line(LINES.buy).replace('{q}', `${q} ${GOOD[g][0]}`).replace('{p}', `R$ ${unit.toFixed(2).replace('.', ',')}`) };
  }); }
  const lot = (s.herd || []).find(x => x.kg >= 380);
  if (lot && p.arroba) opts.push(() => {
    const total = Math.round(lot.heads * arrobas(lot.kg) * p.arroba * (1 - cattleFee(s)) * (1.01 + r * 0.05));
    return { kind: 'herd', lot: lot.id, heads: lot.heads, total, txt: line(LINES.herd).replace('{n}', lot.heads).replace('{t}', `R$ ${Math.round(total).toLocaleString('pt-BR')}`) };
  });
  if (p.bezerro && (s.money || 0) > p.bezerro * 20) opts.push(() => {
    const n = 10 + Math.floor(r * 4) * 10, unit = Math.round(p.bezerro * (0.92 + r * 0.07));
    return n * unit < s.money ? { kind: 'calves', heads: n, unit, total: n * unit, txt: line(LINES.calves).replace('{n}', n).replace('{p}', `R$ ${unit.toLocaleString('pt-BR')}`) } : null;
  });
  if (!opts.length) return null;
  const o = opts[Math.floor(h(seed + 4) * opts.length)]();
  return o && { ...o, slot, bot: bot.nick, botId: bot.id, until: (slot + 1) * WIN };
}
// fecha o negócio pelo preço total combinado; devolve o lançamento do livro-caixa ou { err }
export function settle(s, o, total) {
  total = Math.round(total);
  if (o.kind === 'buy') {
    if ((s.stock?.[o.good] || 0) < o.q) return { err: 'você não tem mais essa quantidade no armazém.' };
    s.stock[o.good] -= o.q; s.money += total;
    return { txt: `vendeu ${o.q} ${GOOD[o.good][0]} para ${o.bot}`, val: total };
  }
  if (o.kind === 'herd') {
    const lot = (s.herd || []).find(x => x.id === o.lot); if (!lot) return { err: 'esse lote não está mais no seu rebanho.' };
    s.herd = s.herd.filter(x => x !== lot); s.money += total;
    return { txt: `venda de ${lot.heads} cabeças para ${o.bot}`, val: total };
  }
  if (o.kind === 'calves') {
    if ((s.money || 0) < total) return { err: 'dinheiro insuficiente.' };
    s.money -= total; s.herd.push({ id: s.nextId++, heads: o.heads, kg: 180 });
    return { txt: `compra de ${o.heads} bezerros de ${o.bot}`, val: -total };
  }
  return { err: 'proposta inválida.' };
}
// negociar: quando o bot compra ele paga até ~+6%; quando vende, baixa até ~-8%
export const dealFor = o => { const d = newDeal(o.total, Math.random, o.kind === 'calves' ? 'sell' : 'buy'); d.limit = Math.round(o.total * (o.kind === 'calves' ? 0.92 : 1.06)); return d; };
