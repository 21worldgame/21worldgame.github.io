// Contador (regras puras): honorário fixo e a prestação de contas de cada fechamento do mês.
// Ele não muda nenhuma cobrança do jogo: lê exatamente o que foi lançado em cada fechamento (s.closes) e separa
// por produção (gado, granja, cana...) e por tipo de gasto (imposto, luz, água, funcionários...).
// Linhas que juntam vários gastos ("energia, água e mão de obra") são separadas pela composição oficial abaixo (SPLIT):
// a soma das partes é sempre igual ao valor cobrado.
import { LISTS, WAREHOUSES } from './negocios.js';
import * as KB from './contador-kb.js';

// ---------- honorário ----------
export const FEE = { min: 2500, rise: 0.02 };    // R$ 2.500 por mês para qualquer jogador; o mensal sobe 2% a cada mês de contrato
export const PLANS = {
  mensal: { months: 0, mult: 1, label: 'mensal', note: 'paga no fechamento de cada mês; sobe 2% a cada mês de contrato' },
  m1: { months: 1, mult: 1, label: '1 mês', note: 'pago agora, preço travado' },
  m3: { months: 3, mult: 0.93, label: '3 meses', note: 'pago agora, 7% de desconto' },
  m12: { months: 12, mult: 0.8, label: '1 ano', note: 'pago agora, 20% de desconto' },
};
export const feeFor = () => FEE.min;   // preço igual para todos (v151): antes era 0,12% do patrimônio
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
// demitir: mensal sai sem custo; contrato pago devolve 70% dos meses que não usou (30% de multa)
export const FIRE_KEEP = 0.7;
export const refundOf = s => (!s.acct || s.acct.plan === 'mensal' ? 0 : Math.round((s.acct.paid || 0) * Math.min(1, monthsLeft(s) / PLANS[s.acct.plan].months) * FIRE_KEEP));
export function fire(s) { if (!s.acct) return { err: 'você não tem contador.' }; const v = refundOf(s); s.money = (s.money || 0) + v; delete s.acct; return { refund: v }; }
export const cancel = s => fire(s).err || null;
// no fechamento do mês: cobra o mensal; avisa quando o contrato pago acaba
export function monthly(s, worth) {
  const a = s.acct; if (!a) return [];
  if (a.plan === 'mensal') { const v = nextMensal(s, worth); a.n = (a.n || 0) + 1; s.money -= v; return [{ txt: `contador: honorário mensal (${a.n}º mês)`, val: -v, parts: { honorario: v } }]; }
  if ((s.month || 0) >= a.until) { delete s.acct; return [{ txt: 'contador: o contrato terminou (contrate de novo para continuar vendo as contas)', val: 0 }]; }
  return [];
}

// ---------- fechamentos guardados (o que foi cobrado, uma vez por mês) ----------
export const KEEP = 6, ARCHIVE = 36;     // 6 meses com cada lançamento; 36 meses no arquivo (totais por tipo e por produção)
const r0 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
export const compact = c => { const x = summarize(c.lines); return { month: c.month, at: c.at, income: Math.round(x.income), total: Math.round(x.total), types: r0(x.types), groups: Object.fromEntries(x.groups.map(g => [g.key, Math.round(g.total)])) }; };
export function record(s, month, lines, now = Date.now()) {
  const all = [{ month, at: now, lines: lines.filter(l => l && l.val).slice(0, 250).map(l => ({ txt: String(l.txt).slice(0, 140), val: Math.round(l.val), ...(l.parts ? { parts: l.parts } : {}) })) },
    ...(s.closes || []).filter(c => c.month !== month)];
  s.closes = all.slice(0, KEEP);
  const out = all.slice(KEEP).map(compact);
  if (out.length) s.closesArc = [...out, ...(s.closesArc || []).filter(a => !out.some(o => o.month === a.month))].sort((a, b) => b.month - a.month).slice(0, ARCHIVE);
}
// todos os meses guardados, do mais novo ao mais antigo, no mesmo formato compacto
export const history = s => [...(s.closes || []).map(compact), ...(s.closesArc || []).filter(a => !(s.closes || []).some(c => c.month === a.month))].sort((a, b) => b.month - a.month);

// ---------- de onde vem cada gasto ----------
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BIZ = new RegExp(`^(${Object.values(LISTS).flatMap(o => Object.values(o).map(b => esc(b.name))).join('|')})`);
const WH = new RegExp(`^(${Object.values(WAREHOUSES).map(w => esc(w.label)).join('|')})`);
export const GROUPS = [
  ['impostos', 'impostos', /imposto de renda|pedágio dos mais ricos|grandes fortunas|contas mais caras|reembolso: imposto/],
  ['contador', 'contador', /^contador/],
  ['negocios', 'empresas e galpões', /^compra da marca |^provedor: |^venda de negócio/],   // investimento da empresa (marca, rede de fibra) no grupo dela, não em "outros"
  ['frigorifico', 'frigorífico (só a indústria)', /^frigorífico|construção do frigorífico|venda do frigorífico/],
  ['gado', 'gado', /boitel|confinamento|frigorífico|gado|bezerr|\bbois\b|\babate\b|cabeças/],
  ['granja', 'granja', /^granja/],
  ['lavoura', 'lavouras (soja, milho, café)', /^plantio de|^colheita de|sacas de/],
  ['suinos', 'suínos', /^suinocultura/],
  ['cana', 'cana', /canavial|corte de cana|colhedora/],
  ['laranja', 'laranja', /^pomar|colheita de laranja/],
  ['mina', 'mina de ouro', /mina de ouro|mineradora|garimpo|ouro/i],
  ['invest', 'investimentos no banco', /investimento|^rendimento/],
  ['jogos', 'cassino e apostas', /^(truco|sinuca|pôquer|roleta|aviator|trader|aposta|corrida|resgate de|fichas)/],
  ['futebol', 'futebol', /futebol|temporada|estádio|patrocínio|contratação de|^assumiu o|venda de .* ao /],
  ['compras', 'compras, vendas e Pix', /^(loja|feira|Feirão|compra:|venda:|troca com|Pix|pagamento|leilão)/],
  ['haras', 'canil e haras', /ração e cuidados|haras|canil|veterin/],
  ['veiculos', 'veículos e máquinas', /IPVA e seguro/],
  ['terras', 'terras', /arrendamento|ITR|banco tomou|terra tomada|^(compra|venda) de \d+ ha/],
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
  [/parcela do (banco|empréstimo de )/, { juros: 1 }],
  [/galpão alugado de/, { aluguel: 1 }],
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
  const groups = {}, types = {}, ins = []; let total = 0, income = 0;
  for (const l of lines || []) {
    if (l.val > 0) { income += l.val; ins.push({ txt: l.txt, val: l.val }); continue; }
    if (!(l.val < 0)) continue;
    const g = groupOf(l.txt), p = partsOf(l);
    const G = groups[g] ??= { key: g, label: GROUP_LABEL[g], total: 0, types: {}, lines: [] };
    G.total -= l.val; G.lines.push({ txt: l.txt, val: -l.val, parts: p }); total -= l.val;
    for (const [k, x] of Object.entries(p)) { G.types[k] = (G.types[k] || 0) + x; types[k] = (types[k] || 0) + x; }
  }
  return { total, income, ins: ins.sort((a, b) => b.val - a.val), types, groups: Object.values(groups).sort((a, b) => b.total - a.total) };
}
export function monthTable(hist, by = 'types', max = 12) {
  const cols = [...(hist || [])].slice(0, max).reverse(), keys = {};
  cols.forEach((c, i) => { for (const [k, v] of Object.entries(c[by] || {})) (keys[k] ??= cols.map(() => 0))[i] = v; });
  const rows = Object.entries(keys).map(([k, vals]) => ({ key: k, label: by === 'types' ? TYPES[k] || k : GROUP_LABEL[k] || k, vals, avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    delta: vals.length > 1 && vals[vals.length - 2] ? vals[vals.length - 1] / vals[vals.length - 2] - 1 : null })).sort((a, b) => b.avg - a.avg);
  return { months: cols.map(c => c.month), totals: cols.map(c => c.total), incomes: cols.map(c => c.income), rows };
}
// bots também pagam contador: o mesmo honorário pelo patrimônio deles
export const npcFee = worth => feeFor(worth);

// ---------- resultado (lucro real): tudo que entra e sai do dinheiro, por produção e por mês ----------
// Cada lançamento do livro-caixa passa por track(): entra (venda, receita), sai (custo do dia a dia) ou bem (comprar/vender
// galpão, terra, carro, empresa: é troca de dinheiro por patrimônio, não é lucro nem prejuízo da produção).
export const INV = /^investimento: |^resgate de investimento|galpão|barracão|construção|colhedora|compra da marca|venda de negócio|^assumiu|^(compra|venda) de \d+ ha|^empréstimo do banco|^compra da |^venda da |^venda do (?!lote)|^compra: |^venda: |^compra de [^:]+: |^leilão: arrematou|^contratação de|^venda de (?!\d)/;
export const kindOf = (txt, val) => (INV.test(txt) ? 'bem' : val > 0 ? 'in' : 'out');
export function track(s, txt, val) {
  val = Math.round(Number(val) || 0); if (!val) return;
  const k = kindOf(txt, val), M = ((s.pl ??= {})[s.month || 0] ??= {}), R = (M[groupOf(txt)] ??= { in: 0, out: 0, bem: 0 });
  if (k === 'bem') R.bem += val; else R[k] += Math.abs(val);
  const ms = Object.keys(s.pl).map(Number).sort((a, b) => a - b);
  for (const m of ms.slice(0, Math.max(0, ms.length - ARCHIVE))) delete s.pl[m];
}
// primeira vez: monta o histórico com o que ainda está no livro-caixa
export function backfill(s) {
  if (s.pl) return;
  s.pl = {};
  for (const e of [...(s.log || [])].reverse()) { const m = s.month; s.month = e.m; track(s, e.txt, e.val); s.month = m; }
}
const zero = () => ({ in: 0, out: 0, bem: 0 });
// soma dos meses [de, até] por produção; lucro = entrou − saiu (os bens ficam à parte)
export function results(s, from, to = s.month || 0) {
  const by = {}, tot = zero();
  for (const [m, M] of Object.entries(s.pl || {})) {
    if (Number(m) < from || Number(m) > to) continue;
    for (const [g, R] of Object.entries(M)) { const B = (by[g] ??= zero()); for (const k of ['in', 'out', 'bem']) { B[k] += R[k]; tot[k] += R[k]; } }
  }
  const rows = Object.entries(by).map(([key, R]) => ({ key, label: GROUP_LABEL[key] || key, ...R, lucro: R.in - R.out })).sort((a, b) => a.label.localeCompare(b.label));
  return { rows, ...tot, lucro: tot.in - tot.out };
}

// ---------- assistente do contador: responde com os números do próprio jogador ----------
// Regra do jogo: ele mostra quanto cada coisa deu de lucro/prejuízo e o que está caro, mas NÃO diz o que compensa mais.
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const WORDS = [
  ['granja', /granja|frango|pintinho|galinha|ave|galpao/], ['frigorifico', /frigorifico|industria|abatedouro/], ['gado', /gado|boi|bezerr|vaca|arroba|boitel|confinamento|pasto/],
  ['suinos', /suin|porco|leitao|barracao/], ['cana', /cana|usina|canavial/], ['laranja', /laranja|pomar/], ['mina', /mina|ouro|minerad/],
  ['negocios', /empresa|negocio|banco proprio|provedor|supermercado|marca/], ['haras', /haras|cavalo|canil|galgo|veterin/], ['veiculos', /carro|veiculo|ipva|caminhao|trator|maquina/],
  ['lavoura', /soja|milho|cafe|lavoura|plantio|colheita|saca/], ['terras', /terra|arrendamento|itr|fazenda|hectare/], ['banco', /emprestimo|parcela|divida|banco/], ['impostos', /imposto|pedagio|fortuna/], ['contador', /contador|honorario/],
  ['jogos', /cassino|truco|sinuca|poquer|roleta|aviator|trader|aposta|ficha/], ['futebol', /futebol|clube|estadio|time/],
];
const PNAME = { frango: 'frango (kg vivo)', pintinho: 'pintinho', racao: 'ração da granja (kg)', suino: 'suíno (kg vivo)', leitao: 'leitão', racaoSuino: 'ração dos suínos (kg)',
  arroba: 'arroba do boi', bezerro: 'bezerro', soja: 'soja (saca)', milho: 'milho (saca)', cafe: 'café (saca)', cana: 'cana (tonelada)', laranja: 'laranja (caixa)' };
const PRICE_OF = { gado: ['arroba', 'bezerro'], frigorifico: ['arroba'], granja: ['frango', 'pintinho', 'racao'], suinos: ['suino', 'leitao', 'racaoSuino'], lavoura: ['soja', 'milho', 'cafe'], cana: ['cana'], laranja: ['laranja'] };
const HELD = { gado: 'bois no rebanho', lavoura: 'sacas no armazém', laranja: 'caixas de laranja no armazém', granja: 'frangos nos galpões', suinos: 'porcos nos barracões' };
const groupIn = q => WORDS.find(([, re]) => re.test(q))?.[0] || null;
// Regra do jogo: o contador conta o que aconteceu e o que vai ser cobrado. Nunca diz onde investir, o que comprar/vender nem quando.
export const ADVICE = /compensa|vale (mais )?a pena|vale comprar|melhor (investimento|negocio|opcao|empresa|producao|coisa|jeito|hora|momento)|(devo|deveria|tenho que|preciso) (investir|comprar|vender|abrir|entrar|plantar|criar|montar|largar|sair)|onde (eu )?(invisto|investir|coloco|aplico|aplicar|ponho)|qual (da|rende|lucra|paga) mais|o que (e )?mais lucrativo|recomend|\bdica|conselho|sugest|me (indica|aconselha|sugere|ajuda a escolher)|o que (eu )?(faco|fazer|compro|comprar|vendo|vender)\b|quando (devo )?(vender|comprar)|hora (certa )?de (vender|comprar)|e bom (comprar|investir|vender)|qual (empresa|negocio|producao|setor|investimento)/;
export const QUICK = ['qual meu lucro real?', 'por que tive prejuízo?', 'o que está vindo caro?', 'quanto tempo meu dinheiro aguenta?', 'quanto vale meu patrimônio?', 'por que meu patrimônio cai todo mês?', 'quanto vou pagar no próximo fechamento?'];
// período pedido: "últimos 3 meses"; o padrão é 12 meses
const periodOf = q => { const x = /ult\w* (\d{1,2}) mes/.exec(q); return x ? Math.max(1, Math.min(ARCHIVE, +x[1])) : 12; };
const money2 = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// ctx: { brl, forecast: summarize(previsão), prices, base, held, worth, loans }
export function answer(s, q0, ctx) {
  const q = norm(q0), brl = ctx.brl, g = groupIn(q), L = g ? GROUP_LABEL[g] : null, m = s.month || 0, fc = ctx.forecast, held = ctx.held || {}, N = periodOf(q);
  const res = (from, to) => results(s, from, to), line = R => `entrou ${brl(R.in)}, saiu ${brl(R.out)}: ${R.lucro >= 0 ? 'lucro' : 'prejuízo'} de ${brl(Math.abs(R.lucro))}`;
  const pick = (r, k) => r.rows.find(x => x.key === k) || { in: 0, out: 0, bem: 0, lucro: 0 };
  const per = `últimos ${N} ${N === 1 ? 'mês' : 'meses'}`;
  // preço de agora contra o normal (só o fato, sem dizer se é hora de vender)
  const priceLine = k => { const v = ctx.prices?.[k], b = ctx.base?.[k]; if (!(v > 0 && b > 0)) return null; const d = Math.round((v / b - 1) * 100); return `• ${PNAME[k] || k}: ${money2(v)} (normal ${money2(b)}, ${d > 0 ? `${d}% acima` : d < 0 ? `${-d}% abaixo` : 'igual'})`; };
  // o que ainda está guardado: já custou, mas só vira entrada quando for vendido
  const heldLine = k => (held[k] > 0 ? `• ainda tem ${brl(held[k])} em ${HELD[k]} (valor de hoje). Isso já custou, mas só entra no lucro quando for vendido.` : null);
  // gasto por tipo de uma produção nos fechamentos guardados com detalhe (até KEEP meses)
  const costTypes = (k, from) => { const out = {}; for (const c of s.closes || []) if (c.month >= from) { const G2 = summarize(c.lines).groups.find(x => x.key === k); if (G2) for (const [t, v] of Object.entries(G2.types)) out[t] = (out[t] || 0) + v; } return Object.entries(out).sort((a, b) => b[1] - a[1]); };

  if (ADVICE.test(q))
    return ['Isso eu não posso dizer: onde investir, o que comprar ou vender e quando é escolha sua, faz parte do jogo.', 'O que eu posso fazer é mostrar os seus números: quanto cada produção deu de lucro ou prejuízo, o que está caro e quanto vai ser cobrado. Pergunte, por exemplo, "por que tive prejuízo?" ou "qual meu lucro real?".'];
  // "como funciona...", "o que é...", "quanto custa...": regra do jogo, da base de conhecimento (contador-kb.js)
  const rule = KB.lookup(q);
  if (rule && KB.HOWTO.test(q) && !/(^| )(meu|minha|meus|minhas|eu tenho|tive|gastei|ganhei)( |$|\?)/.test(q)) return rule;
  if (/patrimonio/.test(q) && /abaix|cai|caind|diminu|baix|menor|perd|desc[ae]|reduz|encolh|logica/.test(q)) {
    const D = ctx.drops || {}, net = fc.total - fc.income;
    const out = ['O patrimônio é tudo o que você tem pelo valor de hoje (dinheiro, fichas, terras, gado, estoque, carros, galpões, empresas...) menos o que você deve ao banco. Ele muda todo mês por estes motivos:'];
    out.push(net > 0
      ? `• contas do mês: o próximo fechamento tira ${brl(fc.total)} e só tem ${brl(fc.income)} de entrada certa, então o dinheiro cai uns ${brl(net)}. Ração, energia, funcionários, arrendamento, IPVA, impostos e honorários são cobrados mesmo sem você vender nada.`
      : `• contas do mês: hoje as entradas certas (${brl(fc.income)}) cobrem as contas do fechamento (${brl(fc.total)}), então elas não puxam o patrimônio para baixo.`);
    if (D.carros >= 1) out.push(`• carros: perdem 1,5% do valor por mês, uns ${brl(D.carros)} a menos agora.`);
    if (D.galpoes >= 1) out.push(`• galpões da granja: perdem 0,5% do valor por mês, uns ${brl(D.galpoes)}.`);
    if (D.juros >= 1) out.push(`• juros do banco: a dívida cresce uns ${brl(D.juros)} por mês, e a dívida é descontada do patrimônio.`);
    out.push('• preço do mercado: gado, estoque e produção contam pelo preço de hoje. Se a arroba ou a saca cai, o patrimônio cai junto, mesmo sem você vender nada. Quando o preço sobe, ele volta.');
    out.push('• compras: o dinheiro sai inteiro, mas o bem entra pelo valor de revenda (carro, galpão, empresa valem menos do que você pagou). Por isso o patrimônio dá um tranco logo depois de uma compra.');
    out.push('Ele sobe quando você vende produção com lucro (boi gordo, lote de frango, colheita) e quando os seus bens valorizam. Pergunte "qual meu lucro real?" para ver quanto cada produção deu.');
    return out;
  }
  if (/patrimonio|quanto (eu )?valho|meus bens|o que eu tenho/.test(q) && ctx.worth) {
    const W = ctx.worth;
    return [`Seu patrimônio hoje: ${brl(W.total)}.`, ...W.parts.filter(([, v]) => Math.round(v) > 0).map(([k, v]) => `• ${k}: ${brl(v)}`), W.debt > 0 ? `• menos a dívida no banco: −${brl(W.debt)}` : ''].filter(Boolean);
  }
  if (/quanto devo|minha divida|meus emprestimos|devo ao banco|parcelas? que faltam/.test(q)) {
    const ls = ctx.loans || [];
    if (!ls.length) return ['Você não deve nada ao banco.'];
    return [`Você deve ${brl(ls.reduce((t, l) => t + l.bal, 0))} ao banco:`, ...ls.map((l, i) => `• empréstimo ${i + 1}: ${brl(l.bal)}, juros de ${(l.rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ao mês, faltam ${l.left} ${l.left === 1 ? 'parcela' : 'parcelas'} de uns ${brl(l.bal * (1 + l.rate) / Math.max(1, l.left))}`), 'Duas parcelas atrasadas e o banco toma a terra mais cara.'];
  }
  if (/aguenta|quanto tempo|quebrar|sem dinheiro|falir|falencia|dinheiro dura/.test(q)) {
    const net = fc.total - fc.income, cash = s.money || 0;
    if (net <= 0) return [`Você tem ${brl(cash)} em dinheiro. No próximo fechamento entram ${brl(-net)} a mais do que saem: do jeito que está, o dinheiro não diminui.`];
    const n = Math.floor(cash / net);
    return [`Você tem ${brl(cash)} em dinheiro e o próximo fechamento tira ${brl(net)} a mais do que coloca.`, n < 1 ? 'O dinheiro de agora não paga o próximo fechamento inteiro.' : `Se todo mês fosse igual, o dinheiro dura uns ${n} ${n === 1 ? 'mês' : 'meses'}.`, 'A conta não inclui vendas que você ainda vai fazer (gado, estoque, lotes) nem compras novas.'];
  }
  if (/vazi|sem (pintinho|lote|animal|boi|porco|leitao|ninguem|nada)|parad|desocupad/.test(q) && g) {
    const G2 = fc.groups.find(x => x.key === g);
    const extra = g === 'granja' ? ' Galpão vazio não paga ração, energia nem mão de obra: isso só começa quando você aloja pintinhos. O galpão perde 0,5% do valor por mês (desvalorização), mas isso não sai do seu dinheiro.' : g === 'suinos' ? ' Barracão vazio paga 40% da energia, água e mão de obra.' : '';
    return G2 ? [`Do jeito que está agora, ${L} vai cobrar ${brl(G2.total)} no próximo fechamento:`, ...G2.lines.map(l => `• ${l.txt}: ${brl(l.val)}`), extra.trim()].filter(Boolean)
      : [`Do jeito que está agora, ${L} não tem nenhuma cobrança no próximo fechamento.${extra}`];
  }
  if (/preco|cotacao|valor do (frango|pintinho|racao|boi|suino|bezerro)/.test(q)) {
    const ks = (g ? PRICE_OF[g] || [] : Object.keys(PNAME)).filter(k => ctx.base?.[k]);
    if (ks.length) return ['Preços de agora (e o normal):', ...ks.map(priceLine).filter(Boolean), 'Os preços variam todo mês, mas sempre voltam para perto do normal (ficam entre 80% e 125% dele).'];
  }
  // por que deu prejuízo / onde estou perdendo: explica com os números, sem dizer o que fazer
  if (/por ?que|motivo|explica|onde (estou |to |eu )?(perd|ganh)|perdendo|nao (da|deu|esta dando|ta dando) lucro|so (da|deu) prejuizo/.test(q)) {
    const from = m - N + 1, r = res(from, m);
    if (g) {
      const R = pick(r, g), ct = costTypes(g, Math.max(from, m - KEEP + 1)), ps = (PRICE_OF[g] || []).map(priceLine).filter(Boolean);
      return [`${L} nos ${per}: ${line(R)}.`,
        ct.length ? `Para onde foi o dinheiro (fechamentos com detalhe, até ${KEEP} meses):` : '', ...ct.slice(0, 5).map(([k, v]) => `• ${TYPES[k] || k}: ${brl(v)}`),
        R.out > 0 && R.in === 0 ? '• nada foi vendido nesse período: só teve custo.' : '',
        heldLine(g), ps.length ? 'Preços de agora, contra o normal:' : '', ...ps,
        'Esses são os fatos; o que fazer com eles é decisão sua.'].filter(Boolean);
    }
    const bad = r.rows.filter(x => x.lucro < 0).sort((a, b) => a.lucro - b.lucro), good = r.rows.filter(x => x.lucro > 0);
    const hs = Object.keys(HELD).map(heldLine).filter(Boolean);
    if (!bad.length) return [`Nos ${per} nenhuma produção ficou no prejuízo: ${line(r)}.`, ...hs];
    return [`Nos ${per}: ${line(r)}.`, 'Onde saiu mais do que entrou:', ...bad.map(x => `• ${x.label}: −${brl(-x.lucro)} (entrou ${brl(x.in)}, saiu ${brl(x.out)})`),
      good.length ? `Onde entrou mais do que saiu: ${good.map(x => x.label).join(', ')}.` : '', ...hs,
      'Quer o detalhe de uma delas? Pergunte, por exemplo, "por que o gado deu prejuízo?".'].filter(Boolean);
  }
  if (/proximo|previs|vou pagar|vai cobrar|fechamento/.test(q)) {
    if (g) { const G2 = fc.groups.find(x => x.key === g); return G2 ? [`${L}: ${brl(G2.total)} no próximo fechamento.`, ...G2.lines.map(l => `• ${l.txt}: ${brl(l.val)}`)] : [`${L} não tem cobrança prevista no próximo fechamento.`]; }
    return [`No próximo fechamento saem ${brl(fc.total)}${fc.income ? ` e entram ${brl(fc.income)}` : ''}.`, ...fc.groups.slice(0, 6).map(x => `• ${x.label}: ${brl(x.total)}`)];
  }
  if (/caro|gasto|gastei|gastando|custo|despesa|manutencao|paga|sai(ndo)? (dinheiro|muito)/.test(q)) {
    const hist = history(s), last = hist[0], prev = hist[1];
    if (g) {
      const G2 = fc.groups.find(x => x.key === g), r = pick(res(m - N + 1, m), g);
      return [`${L}: nos ${per} saíram ${brl(r.out)} (custos do dia a dia).`, G2 ? `No próximo fechamento: ${brl(G2.total)}, assim:` : 'Não tem cobrança prevista no próximo fechamento.', ...(G2 ? Object.entries(G2.types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${TYPES[k] || k}: ${brl(v)}`) : [])];
    }
    const out = [`Os maiores gastos do próximo fechamento (${brl(fc.total)} no total):`, ...Object.entries(fc.types).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `• ${TYPES[k] || k}: ${brl(v)} (${Math.round(v / (fc.total || 1) * 100)}%)`)];
    if (last && prev) { const up = Object.entries(last.types).map(([k, v]) => [k, v - (prev.types[k] || 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]).slice(0, 3); if (up.length) out.push('O que mais subiu do mês passado para cá:', ...up.map(([k, d]) => `• ${TYPES[k] || k}: +${brl(d)}`)); }
    return out;
  }
  if (/lucro|prejuizo|resultado|ganhei|perdi|deu|rend|saldo|ganho|real|melhorando|piorando/.test(q) || g) {
    const rN = res(m - N + 1, m), r1 = res(m, m), r0 = res(m - 1, m - 1);
    if (g) {
      const a = pick(r1, g), b = pick(r0, g), c = pick(rN, g);
      return [`${L}:`, `• este mês: ${line(a)}`, `• mês passado: ${line(b)}`, `• ${per}: ${line(c)}`, heldLine(g), c.bem ? `• bens (compra/venda de ${g === 'granja' ? 'galpões' : 'patrimônio'}): ${c.bem < 0 ? `investiu ${brl(-c.bem)}` : `recebeu ${brl(c.bem)}`}. Isso não entra no lucro: virou patrimônio.` : ''].filter(Boolean);
    }
    const avgN = rN.lucro / N;
    return ['Seu lucro real (só o que entrou e saiu da operação; compra e venda de bens fica à parte):', `• este mês: ${line(r1)}`, `• mês passado: ${line(r0)}`, `• ${per}: ${line(rN)}`,
      N > 1 ? `• média por mês nesse período: ${avgN >= 0 ? '' : '−'}${brl(Math.abs(avgN))}; este mês ficou ${r1.lucro >= avgN ? 'acima' : 'abaixo'} da média.` : '',
      ...rN.rows.filter(x => x.in || x.out).map(x => `  – ${x.label}: ${x.lucro >= 0 ? '+' : '−'}${brl(Math.abs(x.lucro))}`), ...Object.keys(HELD).map(heldLine).filter(Boolean),
      rN.bem ? `• bens no período: ${rN.bem < 0 ? `investiu ${brl(-rN.bem)}` : `vendeu ${brl(rN.bem)}`} (virou patrimônio, não é prejuízo).` : ''].filter(Boolean);
  }
  if (rule) return rule;   // não era sobre os números dele: responde a regra do assunto
  return ['Eu sou o seu contador. Posso responder com os seus números, por exemplo:', ...QUICK.map(x => `• ${x}`), 'Também entendo períodos ("nos últimos 3 meses") e cada produção ("por que o gado deu prejuízo?"). Só não digo onde investir nem o que comprar: essa escolha é sua.'];
}
