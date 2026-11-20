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
  ['impostos', 'impostos do topo', /imposto de renda|pedágio dos mais ricos|grandes fortunas|contas mais caras|reembolso: imposto/],
  ['contador', 'contador', /^contador/],
  ['negocios', 'empresas e galpões', null],
  ['frigorifico', 'frigorífico (só a indústria)', /^frigorífico|construção do frigorífico|venda do frigorífico/],
  ['gado', 'gado', /boitel|confinamento|frigorífico|gado|bezerr|\bbois\b|\babate\b|cabeças/],
  ['granja', 'granja', /^granja/],
  ['lavoura', 'lavouras (soja, milho, café)', /^plantio de|^colheita de|sacas de/],
  ['suinos', 'suínos', /^suinocultura/],
  ['cana', 'cana', /canavial|corte de cana|colhedora/],
  ['laranja', 'laranja', /^pomar|colheita de laranja/],
  ['mina', 'mina de ouro', /mina de ouro|mineradora|garimpo|ouro/i],
  ['jogos', 'cassino e apostas', /^(truco|sinuca|pôquer|roleta|aviator|trader|aposta|corrida|resgate de|fichas)/],
  ['futebol', 'futebol', /futebol|temporada|estádio|patrocínio|contratação de|^assumiu o|venda de .* ao /],
  ['compras', 'compras, vendas e Pix', /^(loja|feira|Feirão|compra:|venda:|troca com|Pix|pagamento|leilão)/],
  ['haras', 'canil e haras', /ração e cuidados|haras|canil|veterin/],
  ['veiculos', 'veículos e máquinas', /IPVA e seguro/],
  ['terras', 'terras', /arrendamento|ITR|banco tomou|^(compra|venda) de \d+ ha/],
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
export const INV = /galpão|barracão|construção|colhedora|compra da marca|venda de negócio|^assumiu|^(compra|venda) de \d+ ha|^empréstimo do banco|^compra da |^venda da |^venda do (?!lote)|^compra: |^venda: |^compra de [^:]+: |^leilão: arrematou|^contratação de|^venda de (?!\d)/;
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
const PNAME = { frango: 'frango (kg vivo)', pintinho: 'pintinho', racao: 'ração da granja (kg)', suino: 'suíno (kg vivo)', leitao: 'leitão', racaoSuino: 'ração dos suínos (kg)' };
const groupIn = q => WORDS.find(([, re]) => re.test(q))?.[0] || null;
export const QUICK = ['qual meu lucro real?', 'o que está vindo caro?', 'quanto a granja deu de lucro?', 'com a granja vazia eu pago alguma coisa?', 'o que o frigorífico gasta?', 'quanto vou pagar no próximo fechamento?'];
// ctx: { brl, forecast: summarize(previsão), prices, base, monthLabel }
export function answer(s, q0, ctx) {
  const q = norm(q0), brl = ctx.brl, g = groupIn(q), L = g ? GROUP_LABEL[g] : null, m = s.month || 0, fc = ctx.forecast;
  const res = (from, to) => results(s, from, to), line = R => `entrou ${brl(R.in)}, saiu ${brl(R.out)}: ${R.lucro >= 0 ? 'lucro' : 'prejuízo'} de ${brl(Math.abs(R.lucro))}`;
  const pick = (r, k) => r.rows.find(x => x.key === k) || { in: 0, out: 0, bem: 0, lucro: 0 };
  if (/compensa|vale (mais )?a pena|melhor (investimento|negocio|opcao)|devo (investir|comprar|vender)|onde investir|qual (da|rende) mais|o que (e )?mais lucrativo|recomenda/.test(q))
    return ['Isso eu não posso dizer: a escolha de onde investir é sua, faz parte do jogo.', 'O que eu posso fazer é mostrar quanto cada produção deu de lucro ou prejuízo. Pergunte, por exemplo, "quanto a granja deu de lucro?" ou "qual meu lucro real?".'];
  if (/vazi|sem (pintinho|lote|animal|boi|porco|leitao|ninguem|nada)|parad|desocupad/.test(q) && g) {
    const G2 = fc.groups.find(x => x.key === g);
    const extra = g === 'granja' ? ' Galpão vazio não paga ração, energia nem mão de obra: isso só começa quando você aloja pintinhos. O galpão perde 0,5% do valor por mês (desvalorização), mas isso não sai do seu dinheiro.' : g === 'suinos' ? ' Barracão vazio paga 40% da energia, água e mão de obra.' : '';
    return G2 ? [`Do jeito que está agora, ${L} vai cobrar ${brl(G2.total)} no próximo fechamento:`, ...G2.lines.map(l => `• ${l.txt}: ${brl(l.val)}`), extra.trim()].filter(Boolean)
      : [`Do jeito que está agora, ${L} não tem nenhuma cobrança no próximo fechamento.${extra}`];
  }
  if (/preco|cotacao|valor do (frango|pintinho|racao|boi|suino)/.test(q)) {
    const ks = Object.keys(ctx.base).filter(k => g ? (g === 'granja' ? ['frango', 'pintinho', 'racao'] : g === 'suinos' ? ['suino', 'leitao', 'racaoSuino'] : []).includes(k) : true);
    if (ks.length) return ['Preços de agora (e o normal):', ...ks.map(k => { const v = ctx.prices[k], b = ctx.base[k], d = Math.round((v / b - 1) * 100); return `• ${PNAME[k] || k}: R$ ${v.toFixed(2).replace('.', ',')} (normal R$ ${b.toFixed(2).replace('.', ',')}, ${d > 0 ? `${d}% acima` : d < 0 ? `${-d}% abaixo` : 'igual'})`; }), 'Os preços variam todo mês, mas sempre voltam para perto do normal.'];
  }
  if (/proximo|previs|vou pagar|vai cobrar|fechamento/.test(q)) {
    if (g) { const G2 = fc.groups.find(x => x.key === g); return G2 ? [`${L}: ${brl(G2.total)} no próximo fechamento.`, ...G2.lines.map(l => `• ${l.txt}: ${brl(l.val)}`)] : [`${L} não tem cobrança prevista no próximo fechamento.`]; }
    return [`No próximo fechamento saem ${brl(fc.total)}${fc.income ? ` e entram ${brl(fc.income)}` : ''}.`, ...fc.groups.slice(0, 6).map(x => `• ${x.label}: ${brl(x.total)}`)];
  }
  if (/caro|gasto|gastando|custo|despesa|manutencao|paga|sai(ndo)? (dinheiro|muito)/.test(q)) {
    const hist = history(s), last = hist[0], prev = hist[1];
    if (g) {
      const G2 = fc.groups.find(x => x.key === g), r = pick(res(m - 11, m), g);
      return [`${L}: nos últimos 12 meses saíram ${brl(r.out)} (custos do dia a dia).`, G2 ? `No próximo fechamento: ${brl(G2.total)}, assim:` : 'Não tem cobrança prevista no próximo fechamento.', ...(G2 ? Object.entries(G2.types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${TYPES[k] || k}: ${brl(v)}`) : [])];
    }
    const out = [`Os maiores gastos do próximo fechamento (${brl(fc.total)} no total):`, ...Object.entries(fc.types).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `• ${TYPES[k] || k}: ${brl(v)} (${Math.round(v / (fc.total || 1) * 100)}%)`)];
    if (last && prev) { const up = Object.entries(last.types).map(([k, v]) => [k, v - (prev.types[k] || 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]).slice(0, 3); if (up.length) out.push('O que mais subiu do mês passado para cá:', ...up.map(([k, d]) => `• ${TYPES[k] || k}: +${brl(d)}`)); }
    return out;
  }
  if (/lucro|prejuizo|resultado|ganhei|perdi|deu|rend|saldo|ganho|real/.test(q) || g) {
    const r12 = res(m - 11, m), r1 = res(m, m), r0 = res(m - 1, m - 1);
    if (g) {
      const a = pick(r1, g), b = pick(r0, g), c = pick(r12, g);
      return [`${L}:`, `• este mês: ${line(a)}`, `• mês passado: ${line(b)}`, `• últimos 12 meses: ${line(c)}`, c.bem ? `• bens (compra/venda de ${g === 'granja' ? 'galpões' : 'patrimônio'}): ${c.bem < 0 ? `investiu ${brl(-c.bem)}` : `recebeu ${brl(c.bem)}`}. Isso não entra no lucro: virou patrimônio.` : ''].filter(Boolean);
    }
    return ['Seu lucro real (só o que entrou e saiu da operação; compra e venda de bens fica à parte):', `• este mês: ${line(r1)}`, `• mês passado: ${line(r0)}`, `• últimos 12 meses: ${line(r12)}`, ...r12.rows.filter(x => x.in || x.out).map(x => `  – ${x.label}: ${x.lucro >= 0 ? '+' : '−'}${brl(Math.abs(x.lucro))}`), r12.bem ? `• bens nos 12 meses: ${r12.bem < 0 ? `investiu ${brl(-r12.bem)}` : `vendeu ${brl(r12.bem)}`} (virou patrimônio, não é prejuízo).` : ''].filter(Boolean);
  }
  return ['Eu sou o seu contador. Posso responder com os seus números, por exemplo:', ...QUICK.map(x => `• ${x}`), 'Só não digo o que compensa mais: essa escolha é sua.'];
}
