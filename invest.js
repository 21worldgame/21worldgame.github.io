// Investimentos no Banco 21 (regras puras): dinheiro parado rende pouco e fica preso por bastante tempo.
// Taxas da vida real: rendem menos que os juros do empréstimo do banco (1,8% ao mês), então pegar emprestado para aplicar não dá lucro.
// Juros simples (sem bola de neve), teto por pessoa e o valor aplicado conta no patrimônio.
export const PRODUCTS = {   // taxas reais de nov/2026 (Selic 13,75% ao ano = ~1,08% ao mês), por mês do mundo
  poupanca: { name: 'Poupança 21', icon: '🐷', months: 0, rate: 0.0055, desc: 'Sem prazo: tira quando quiser. Rende como a poupança de verdade (0,5% + TR ao mês).', early: 0 },
  cdb: { name: 'CDB 21', icon: '📄', months: 60, rate: 0.01, desc: 'Certificado do banco, ~93% do CDI. Prazo curto para um investimento.', early: 0 },
  lca: { name: 'LCA Agro 21', icon: '🌾', months: 120, rate: 0.0102, desc: 'Financia o agro do mundo. Rendimento isento de imposto de renda.', early: 0, exempt: true },
  tesouro: { name: 'Tesouro 21', icon: '🏛️', months: 288, rate: 0.0108, desc: 'Título do governo, rende a Selic. Prazo longo.', early: 0.02 },
  previdencia: { name: 'Previdência 21', icon: '🛡️', months: 576, rate: 0.011, desc: 'O mais longo e o que mais rende. Para quem pensa no futuro.', early: 0.1 },
};
export const MIN = 10000, CAP_SHARE = 0.25, CAP_MAX = 50e6;
// quinta 26/11/2026 00:00 (Brasília): corrida à Previdência quase quebrou o Banco 21 (TV 21) e os juros de aplicação NOVA despencam.
// Quem já tinha dinheiro aplicado fica com a taxa do dia em que aplicou (contrato), inclusive na poupança.
export const CUT_AT = Date.UTC(2026, 10, 26, 3);
export const NEW_RATE = { poupanca: 0.0016, cdb: 0.0029, lca: 0.003, tesouro: 0.0031, previdencia: 0.0032 };
export const rateNow = (kind, now = Date.now()) => (now >= CUT_AT ? NEW_RATE[kind] ?? 0 : PRODUCTS[kind]?.rate || 0);
export const rateOf = i => { const P = PRODUCTS[i.kind]; return !P ? 0 : i.rate ?? P.rate; };   // aplicação antiga sem 'rate' = taxa antiga
export const total = s => (s.invest || []).reduce((t, i) => t + i.amt + (i.acc || 0), 0);
export const cap = (s, worth) => Math.max(0, Math.min(CAP_MAX, Math.max(1e6, worth * CAP_SHARE)) - (s.invest || []).reduce((t, i) => t + i.amt, 0));
export const finalOf = (kind, amt, rate = rateNow(kind)) => { const P = PRODUCTS[kind]; return Math.round(amt * (1 + rate * P.months)); };
export function apply(s, kind, amt, worth, now = Date.now()) {
  const P = PRODUCTS[kind]; amt = Math.floor(Number(amt) || 0);
  if (!P) return 'investimento inválido.';
  if (amt < MIN) return `o mínimo é R$ ${MIN.toLocaleString('pt-BR')}.`;
  if (amt > (s.money || 0)) return 'dinheiro insuficiente.';
  const room = cap(s, worth); if (amt > room) return `o banco aceita até R$ ${Math.floor(room).toLocaleString('pt-BR')} a mais em investimentos para você (teto: 25% do patrimônio, no máximo R$ 50 mi).`;
  s.money -= amt; (s.invest ??= []).push({ id: `iv${(s.nextId = (s.nextId || 1) + 1)}`, kind, amt, acc: 0, left: P.months, at: s.month || 1, rate: rateNow(kind, now) });
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
export function monthly(s, now = Date.now()) {
  const out = [];
  for (const i of [...(s.invest || [])]) {
    const P = PRODUCTS[i.kind]; if (!P) continue;
    i.acc = Math.round(((i.acc || 0) + i.amt * rateOf(i)) * 100) / 100;
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
