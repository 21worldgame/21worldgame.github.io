// Contador (regras puras): honorário proporcional ao patrimônio e a prestação de contas de cada fechamento do mês.
// Ele não muda nenhuma cobrança do jogo: lê exatamente o que foi lançado em cada fechamento (s.closes) e separa
// por produção (gado, granja, cana...) e por tipo de gasto (imposto, luz, água, funcionários...).
// Linhas que juntam vários gastos ("energia, água e mão de obra") são separadas pela composição oficial abaixo (SPLIT):
// a soma das partes é sempre igual ao valor cobrado.
import { LISTS, WAREHOUSES } from './negocios.js';

// ---------- honorário ----------
export const FEE = { rate: 0.0012, min: 2500, rise: 0.02 };    // 0,12% do patrimônio por mês (mínimo R$ 2.500); mensal sobe 2% a cada mês
export const PLANS = {
  mensal: { months: 0, mult: 1, label: 'mensal', note: 'paga no fechamento de cada mês; sobe 2% a cada mês de contrato' },
  m1: { months: 1, mult: 1, label: '1 mês', note: 'pago agora, preço travado' },
  m3: { months: 3, mult: 0.93, label: '3 meses', note: 'pago agora, 7% de desconto' },
  m12: { months: 12, mult: 0.8, label: '1 ano', note: 'pago agora, 20% de desconto' },
};
export const feeFor = worth => Math.max(FEE.min, Math.round((Number(worth) || 0) * FEE.rate / 100) * 100);
export const quote = (worth, plan) => { const P = PLANS[plan]; return P.months ? Math.round(feeFor(worth) * P.months * P.mult / 100) * 100 : feeFor(worth); };
export const active = s => !!s.acct && (s.acct.plan === 'mensal' || (s.month || 0) < s.acct.until);
export const monthsLeft = s => (s.acct?.plan === 'mensal' ? Infinity : Math.max(0, (s.acct?.until || 0) - (s.month || 0)));
export const nextMensal = (s, worth) => Math.round(feeFor(worth) * (1 + FEE.rise) ** (s.acct?.n || 0));

export function hire(s, plan, worth) {
  const P = PLANS[plan]; if (!P) return { err: 'plano inválido.' };
  if (active(s)) return { err: 'você já tem um contador contratado.' };
  if (!P.months) { s.acct = { plan: 'mensal', since: s.month || 1, n: 0 }; return { price: 0 }; }
  const price = quote(worth, plan);
  if ((s.money || 0) < price) return { err: 'dinheiro insuficiente para contratar o contador.' };
  s.money -= price; s.acct = { plan, since: s.month || 1, until: (s.month || 1) + P.months, paid: price };
  return { price };
}
export function cancel(s) { if (!s.acct) return 'você não tem contador.'; if (s.acct.plan !== 'mensal') return 'contrato pago: vale até o fim do período.'; delete s.acct; return null; }
// no fechamento do mês: cobra o mensal; avisa quando o contrato pago acaba
export function monthly(s, worth) {
  const a = s.acct; if (!a) return [];
  if (a.plan === 'mensal') { const v = nextMensal(s, worth); a.n = (a.n || 0) + 1; s.money -= v; return [{ txt: `contador: honorário mensal (${a.n}º mês)`, val: -v, parts: { honorario: v } }]; }
  if ((s.month || 0) >= a.until) { delete s.acct; return [{ txt: 'contador: o contrato terminou (contrate de novo para continuar vendo as contas)', val: 0 }]; }
  return [];
}

// ---------- fechamentos guardados (o que foi cobrado, uma vez por mês) ----------
export const KEEP = 6;
export function record(s, month, lines, now = Date.now()) {
  s.closes = [{ month, at: now, lines: lines.filter(l => l && l.val).slice(0, 250).map(l => ({ txt: String(l.txt).slice(0, 140), val: Math.round(l.val), ...(l.parts ? { parts: l.parts } : {}) })) },
    ...(s.closes || []).filter(c => c.month !== month)].slice(0, KEEP);
}

// ---------- de onde vem cada gasto ----------
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BIZ = new RegExp(`^(${Object.values(LISTS).flatMap(o => Object.values(o).map(b => esc(b.name))).join('|')})`);
const WH = new RegExp(`^(${Object.values(WAREHOUSES).map(w => esc(w.label)).join('|')})`);
export const GROUPS = [
  ['impostos', 'impostos do topo', /imposto de renda|pedágio dos mais ricos|grandes fortunas|contas mais caras|reembolso: imposto/],
  ['contador', 'contador', /^contador/],
  ['negocios', 'empresas e galpões', null],
  ['gado', 'gado e frigorífico', /boitel|confinamento|frigorífico|gado|bezerr|\bbois\b|abate/],
  ['granja', 'granja', /^granja/],
  ['suinos', 'suínos', /^suinocultura/],
  ['cana', 'cana', /canavial|corte de cana|colhedora/],
  ['laranja', 'laranja', /^pomar|colheita de laranja/],
  ['mina', 'mina de ouro', /mina de ouro|garimpo|ouro/i],
  ['haras', 'canil e haras', /ração e cuidados|haras|canil|veterin/],
  ['veiculos', 'veículos e máquinas', /IPVA e seguro/],
  ['terras', 'terras', /arrendamento|ITR|banco tomou/],
  ['banco', 'banco e empréstimos', /parcela|calote/],
  ['outros', 'outros', /./],
];
export const groupOf = txt => (BIZ.test(txt) || WH.test(txt) ? 'negocios' : GROUPS.find(([k, , re]) => re && re.test(txt))[0]);
export const GROUP_LABEL = Object.fromEntries(GROUPS.map(([k, l]) => [k, l]));

// ---------- tipo de gasto ----------
export const TYPES = { imposto: 'impostos e licenças', funcionarios: 'funcionários', luz: 'energia (luz)', agua: 'água', racao: 'ração', insumos: 'insumos (defensivo, adubo, cama)',
  materia: 'matéria-prima', mercadoria: 'mercadoria', industria: 'indústria (produção)', combustivel: 'combustível', manutencao: 'manutenção', seguro: 'seguro',
  aluguel: 'aluguel e arrendamento', servicos: 'serviços de terceiros', frete: 'frete e logística', juros: 'parcelas do banco', honorario: 'contador', outros: 'outros' };
// composição oficial das linhas que juntam vários gastos (as partes somam 100%)
export const SPLIT = [
  [/imposto de renda|pedágio dos mais ricos|grandes fortunas/, { imposto: 1 }],
  [/contas mais caras/, { luz: 0.4, agua: 0.2, funcionarios: 0.4 }],
  [/manutenção e ITR/, { imposto: 0.4, manutencao: 0.6 }],
  [/IPVA e seguro/, { imposto: 0.6, seguro: 0.4 }],
  [/energia, cama e mão de obra/, { luz: 0.4, insumos: 0.2, funcionarios: 0.4 }],
  [/energia, água e mão de obra/, { luz: 0.35, agua: 0.2, funcionarios: 0.45 }],
  [/ração/, { racao: 1 }],
  [/tratos culturais/, { insumos: 0.7, funcionarios: 0.3 }],
  [/manutenção, diesel e operador/, { manutencao: 0.3, combustivel: 0.4, funcionarios: 0.3 }],
  [/frigorífico: funcionários, energia e manutenção/, { funcionarios: 0.55, luz: 0.3, agua: 0.05, manutencao: 0.1 }],
  [/defensivo e adubação/, { insumos: 1 }],
  [/licenças ambientais, segurança, energia e máquinas/, { imposto: 0.25, funcionarios: 0.25, luz: 0.3, manutencao: 0.2 }],
  [/equipes? de mineiros/, { funcionarios: 1 }],
  [/boitel|confinamento/, { servicos: 1 }],
  [/arrendamento pago/, { aluguel: 1 }],
  [/parcela do banco/, { juros: 1 }],
  [/folha \(.*\) e despesas da agência/, { funcionarios: 0.85, aluguel: 0.1, luz: 0.05 }],
  [/link de internet, suporte, técnicos e manutenção/, { servicos: 0.45, funcionarios: 0.4, manutencao: 0.15 }],
  [/funcionários, aluguel, manutenção, seguro e sede/, { funcionarios: 0.45, aluguel: 0.2, manutencao: 0.15, seguro: 0.1, servicos: 0.1 }],
  [/sede da marca/, { servicos: 1 }],
  [/folha, manutenção.* e energia/, { funcionarios: 0.5, manutencao: 0.25, luz: 0.25 }],
  [/manutenção e seguro/, { manutencao: 0.6, seguro: 0.4 }],
  [/^contador/, { honorario: 1 }],
];
// partes em reais de uma linha de gasto (positivas); a soma bate com o valor da linha
export function partsOf(l) {
  const v = -l.val; if (!(v > 0)) return {};
  if (l.parts) { const sum = Object.values(l.parts).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(l.parts).map(([k, x]) => [k, x / sum * v])); }
  const sh = SPLIT.find(([re]) => re.test(l.txt))?.[1] || { outros: 1 };
  const out = {}; let left = v; const keys = Object.keys(sh);
  keys.forEach((k, i) => { const x = i === keys.length - 1 ? left : Math.round(v * sh[k]); out[k] = x; left -= x; });
  return out;
}
// resumo de um fechamento (ou de uma previsão): por produção e por tipo, só gastos
export function summarize(lines) {
  const groups = {}, types = {}; let total = 0, income = 0;
  for (const l of lines || []) {
    if (l.val > 0) { income += l.val; continue; }
    if (!(l.val < 0)) continue;
    const g = groupOf(l.txt), p = partsOf(l);
    const G = groups[g] ??= { key: g, label: GROUP_LABEL[g], total: 0, types: {}, lines: [] };
    G.total -= l.val; G.lines.push({ txt: l.txt, val: -l.val, parts: p }); total -= l.val;
    for (const [k, x] of Object.entries(p)) { G.types[k] = (G.types[k] || 0) + x; types[k] = (types[k] || 0) + x; }
  }
  return { total, income, types, groups: Object.values(groups).sort((a, b) => b.total - a.total) };
}
// bots também pagam contador: o mesmo honorário pelo patrimônio deles
export const npcFee = worth => feeFor(worth);
