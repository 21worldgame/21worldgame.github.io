// Investimentos no Banco 21 (regras puras): dinheiro parado rende pouco e fica preso por bastante tempo.
// Calibrado para render bem menos que terra (~0,6% ao mês) e empresas: é um porto seguro, não um atalho para enriquecer.
// Juros simples (sem bola de neve), teto por pessoa e o valor aplicado conta no patrimônio (não serve para fugir das faixas).
export const PRODUCTS = {
  poupanca: { name: 'Poupança 21', icon: '🐷', months: 0, rate: 0.0003, desc: 'Sem prazo: tira quando quiser. Rende pouquinho, todo mês.', early: 0 },
  cdb: { name: 'CDB 21', icon: '📄', months: 60, rate: 0.001, desc: 'Certificado do banco. Prazo curto para um investimento.', early: 0 },
  lca: { name: 'LCA Agro 21', icon: '🌾', months: 120, rate: 0.0012, desc: 'Financia o agro do mundo. O rendimento é isento do pedágio dos mais ricos.', early: 0, exempt: true },
  tesouro: { name: 'Tesouro 21', icon: '🏛️', months: 288, rate: 0.0014, desc: 'Título do governo do 21 World. Prazo longo, rendimento maior.', early: 0.02 },
  previdencia: { name: 'Previdência 21', icon: '🛡️', months: 576, rate: 0.0016, desc: 'O mais longo e o que mais rende. Para quem pensa no futuro.', early: 0.1 },
};
export const MIN = 10000, CAP_SHARE = 0.25, CAP_MAX = 50e6;
export const total = s => (s.invest || []).reduce((t, i) => t + i.amt + (i.acc || 0), 0);
export const cap = (s, worth) => Math.max(0, Math.min(CAP_MAX, Math.max(1e6, worth * CAP_SHARE)) - (s.invest || []).reduce((t, i) => t + i.amt, 0));
export const finalOf = (kind, amt) => { const P = PRODUCTS[kind]; return Math.round(amt * (1 + P.rate * P.months)); };
export function apply(s, kind, amt, worth) {
  const P = PRODUCTS[kind]; amt = Math.floor(Number(amt) || 0);
  if (!P) return 'investimento inválido.';
  if (amt < MIN) return `o mínimo é R$ ${MIN.toLocaleString('pt-BR')}.`;
  if (amt > (s.money || 0)) return 'dinheiro insuficiente.';
  const room = cap(s, worth); if (amt > room) return `o banco aceita até R$ ${Math.floor(room).toLocaleString('pt-BR')} a mais em investimentos para você (teto: 25% do patrimônio, no máximo R$ 50 mi).`;
  s.money -= amt; (s.invest ??= []).push({ id: `iv${(s.nextId = (s.nextId || 1) + 1)}`, kind, amt, acc: 0, left: P.months, at: s.month || 1 });
  return null;
}
// sair antes: perde o rendimento e, nos longos, uma taxa sobre o valor aplicado
export const earlyValue = i => { const P = PRODUCTS[i.kind]; return P.months ? Math.round(i.amt * (1 - P.early)) : Math.round(i.amt + (i.acc || 0)); };
export function withdraw(s, id) {
  const i = (s.invest || []).find(x => x.id === id); if (!i) return { err: 'investimento não encontrado.' };
  const v = earlyValue(i); s.invest = s.invest.filter(x => x !== i); s.money += v;
  return { value: v, loss: Math.round(i.amt + (i.acc || 0) - v), name: PRODUCTS[i.kind].name };
}
// fecha o mês: rende e paga o que venceu. A devolução do valor aplicado não é lucro (fica fora do pedágio); o rendimento é
export function monthly(s) {
  const out = [];
  for (const i of [...(s.invest || [])]) {
    const P = PRODUCTS[i.kind]; if (!P) continue;
    i.acc = Math.round(((i.acc || 0) + i.amt * P.rate) * 100) / 100;
    if (!P.months) continue;
    if (--i.left > 0) continue;
    s.invest = s.invest.filter(x => x !== i);
    s.money += i.amt + i.acc;
    out.push({ txt: `resgate de investimento: ${P.name} (valor aplicado de volta)`, val: i.amt });
    out.push({ txt: `${P.exempt ? 'rendimento isento' : 'rendimento'}: ${P.name} venceu`, val: Math.round(i.acc) });
  }
  return out;   // o dinheiro já entrou no caixa acima: quem chama só lança no livro-caixa
}
// linhas que não contam como lucro do mês (pedágio dos mais ricos)
export const NOT_PROFIT = /^resgate de investimento|^rendimento isento/;
