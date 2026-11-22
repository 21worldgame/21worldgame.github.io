// Contratos de exportação (regras puras): as tradings oferecem comprar a SUA produção com prêmio sobre o preço do dia.
// Igual na vida real (contrato a termo): o preço fica travado no aceite, a entrega tem prazo e quem não entrega paga multa.
// Só vale produção própria (rastreabilidade): sacas compradas no mercado não podem ser entregues (senão era só comprar e revender).
// As ofertas mudam a cada mês do mundo e são as mesmas para todos os jogadores.
export const TRADERS = ['Cargil 21', 'Bungê', 'Cofco China 21', 'Luis Dreifus', 'Amaggy Grãos'];
export const GOODS = { soja: { label: 'soja', min: 2000, max: 24000, step: 500 }, milho: { label: 'milho', min: 3000, max: 40000, step: 1000 }, cafe: { label: 'café', min: 150, max: 2400, step: 50 } };
export const PREM = [0.03, 0.08], MONTHS = [3, 6], FINE = 0.1, MAX_ACTIVE = 3, OFFERS = 3;

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
  s.contracts.push({ ...offer, due: (s.month || 1) + offer.months });
  return null;
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
