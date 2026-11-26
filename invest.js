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
// a partir de sábado 28/11/2026 00:00 (Brasília) os juros de aplicação nova caem 40% (rendia demais).
// Aplicação com prazo guarda a taxa do dia em que entrou (contrato); a poupança (sem prazo) segue a taxa do momento.
export const CUT_AT = Date.UTC(2026, 10, 28, 3), CUT = 0.6;
export const rateNow = (kind, now = Date.now()) => { const r = PRODUCTS[kind]?.rate || 0; return now >= CUT_AT ? Math.round(r * CUT * 1e5) / 1e5 : r; };
export const rateOf = (i, now = Date.now()) => { const P = PRODUCTS[i.kind]; return !P ? 0 : !P.months ? rateNow(i.kind, now) : i.rate ?? P.rate; };   // aplicação antiga sem 'rate' = taxa antiga
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
    i.acc = Math.round(((i.acc || 0) + i.amt * rateOf(i, now)) * 100) / 100;
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
