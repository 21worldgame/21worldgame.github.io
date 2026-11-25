// Contratos de exportação (regras puras): as tradings oferecem comprar a SUA produção com prêmio sobre o preço do dia.
// Igual na vida real (contrato a termo): o preço fica travado no aceite, a entrega tem prazo e quem não entrega paga multa.
// Só vale produção própria (rastreabilidade): sacas compradas no mercado não podem ser entregues (senão era só comprar e revender).
// As ofertas mudam a cada mês do mundo e são as mesmas para todos os jogadores.
import { CROPS, RENT_SHARE, plantCost } from './logic.js';
import { room, capacity, UNIT_KG } from './negocios.js';
export const TRADERS = ['Cargil 21', 'Bungê', 'Cofco China 21', 'Luis Dreifus', 'Amaggy Grãos'];
export const GOODS = { soja: { label: 'soja', min: 2000, max: 24000, step: 500 }, milho: { label: 'milho', min: 3000, max: 40000, step: 1000 }, cafe: { label: 'café', min: 150, max: 2400, step: 50 } };
export const PREM = [0.03, 0.08], MONTHS = [3, 6], FINE = 0.1, MAX_ACTIVE = 3, OFFERS = 3, FREE_QUIT = 2;   // desistir sem multa até 2 meses depois de fechar (clique errado)

const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const ensure = s => { s.contracts ??= []; s.colhido ??= {}; return s; };

// ofertas do mês (o preço por saca usa o preço do dia de quem está vendo)
export function offers(month, prices = {}) {
  const r = seeded(month * 7919 + 13), keys = Object.keys(GOODS);
  return Array.from({ length: OFFERS }, (_, i) => {
    const good = keys[Math.floor(r() * keys.length)], G = GOODS[good], prem = +(PREM[0] + r() * (PREM[1] - PREM[0])).toFixed(3);
    const qty = Math.round((G.min + r() * (G.max - G.min)) / G.step) * G.step, months = MONTHS[0] + Math.floor(r() * (MONTHS[1] - MONTHS[0] + 1));
    return { id: `ct${month}-${i}`, trader: TRADERS[Math.floor(r() * TRADERS.length)], good, qty, prem, months, price: Math.round((prices[good] || 0) * (1 + prem) * 100) / 100 };
  });
}
export function accept(s, offer) {
  ensure(s);
  if (!offer || !GOODS[offer.good] || !(offer.price > 0)) return 'proposta inválida.';
  if (s.contracts.some(c => c.id === offer.id)) return 'você já fechou esse contrato.';
  if (s.contracts.length >= MAX_ACTIVE) return `no máximo ${MAX_ACTIVE} contratos abertos ao mesmo tempo.`;
  s.contracts.push({ ...offer, due: (s.month || 1) + offer.months, at: s.month || 1 });
  return null;
}
// desistir: sem multa até FREE_QUIT meses depois de fechar; contrato antigo (sem 'at', fechado antes da v240) desiste sem multa uma vez
export const freeQuit = (s, c) => (c.at == null ? true : (s.month || 1) - c.at <= FREE_QUIT);
export function quit(s, id) {
  ensure(s);
  const c = s.contracts.find(x => x.id === id); if (!c) return { err: 'contrato não encontrado.' };
  const fine = freeQuit(s, c) ? 0 : Math.round(c.qty * c.price * FINE);
  s.money -= fine; s.contracts = s.contracts.filter(x => x !== c);
  return { fine, c };
}
// quanto dá para entregar agora: o que está no armazém E veio da sua colheita
export const ready = (s, good) => Math.min(Math.floor(s.stock?.[good] || 0), Math.floor(ensure(s).colhido[good] || 0));
export function deliver(s, id) {
  ensure(s);
  const c = s.contracts.find(x => x.id === id); if (!c) return { err: 'contrato não encontrado.' };
  if (ready(s, c.good) < c.qty) return { err: `faltam ${(c.qty - ready(s, c.good)).toLocaleString('pt-BR')} sacas de ${GOODS[c.good].label} da sua colheita no armazém.` };
  s.stock[c.good] -= c.qty; s.colhido[c.good] -= c.qty;
  const v = Math.round(c.qty * c.price); s.money += v;
  s.contracts = s.contracts.filter(x => x !== c);
  return { value: v, c };
}
// ---------- previsão de safra (só mostra; a colheita de verdade continua igual: ±25% de clima e 8% de chance de quebra) ----------
export const CROP_OF = { soja: 'soja', milho: 'milho', cafe: 'cafe' };   // produto -> lavoura
export const LO = 0.75, HI = 1.25;   // faixa normal do clima
// sacas que uma lavoura plantada deve dar (ano normal), já sem a parte do dono em terra arrendada
export const expect = l => { const c = CROPS[l.crop?.type]; if (!c) return 0; return Math.round(l.ha * c.yield * (l.own ? 1 : 1 - RENT_SHARE)); };
// por produto: o que já está no armazém (colheita própria, pronta para exportar) e o que está no campo, com o mês da colheita
export function forecast(s) {
  ensure(s);
  const out = {};
  for (const g of Object.keys(GOODS)) out[g] = { ready: ready(s, g), fields: [], ha: 0, mid: 0 };
  for (const l of s.lands || []) {
    if (!l.crop || l.leasedOut) continue; const g = CROPS[l.crop.type]?.good; if (!out[g]) continue;
    const mid = expect(l); out[g].fields.push({ region: l.region, ha: l.ha, left: l.crop.left, mid, seg: !!l.crop.seg }); out[g].ha += l.ha; out[g].mid += mid;
  }
  for (const g of Object.keys(out)) out[g].fields.sort((a, b) => a.left - b.left);
  return out;
}
// quanto do contrato dá para cumprir até o prazo: armazém + lavouras que colhem antes do vencimento.
// Só conta o que CABE no armazém: colheita sem espaço é vendida na hora (negocios.enforce) e não serve para o contrato.
// ponytail: espaço livre de hoje, sem descontar outras colheitas/contratos que vão disputar o mesmo galpão
export function fit(s, c, monthsLeft = c.months) {
  const f = forecast(s)[c.good], by = f.fields.filter(x => x.left <= monthsLeft).reduce((t, x) => t + x.mid, 0);
  const free = room(s, c.good), fits = Math.min(by, free), have = f.ready + fits;
  const crop = CROPS[CROP_OF[c.good]], need = Math.max(0, c.qty - have), ha = need ? Math.ceil(need / crop.yield) : 0;
  const kg = UNIT_KG[c.good] || 60, spaceShort = Math.max(0, c.qty - f.ready - free);   // sacas do contrato que não têm onde ficar
  return { ready: f.ready, field: fits, lost: by - fits, have, need, ha, cost: ha ? plantCost(s, CROP_OF[c.good], ha) : 0, growMonths: crop.months, inTime: crop.months <= monthsLeft, ok: have >= c.qty, safe: f.ready + Math.min(free, Math.round(by * LO)) >= c.qty,
    room: free, roomT: free * kg / 1000, capT: capacity(s), needT: c.qty * kg / 1000, spaceShort, spaceShortT: spaceShort * kg / 1000 };
}
// fechamento do mês: contrato vencido sem entrega paga multa de 10% do valor
export function monthly(s) {
  ensure(s);
  const out = [];
  for (const c of [...s.contracts]) {
    if ((s.month || 1) < c.due) continue;
    const fine = Math.round(c.qty * c.price * FINE);
    s.money -= fine; s.contracts = s.contracts.filter(x => x !== c);
    out.push({ txt: `multa: contrato de ${c.qty.toLocaleString('pt-BR')} sacas de ${GOODS[c.good].label} com a ${c.trader} venceu sem entrega`, val: -fine });
  }
  return out;
}
