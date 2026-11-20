import { T } from './tune.js';
// Negócios (regras puras): bancos, provedores de internet, supermercados e galpões de armazenagem.
// Você compra só a MARCA (sem caixa); todos os custos mensais saem do seu bolso. Lucro baixo de propósito,
// mas a marca valoriza devagar com o tempo do mundo: é investimento de longo prazo.
// Nomes são paródias (como os carros da concessionária), sem usar marcas reais.
export const MONTH0 = 1;
// o mês do mundo dura ~10 min: as taxas por mês são pequenas e têm teto (senão disparam em poucos dias reais)
const grow = (month, r, cap = 2.5) => Math.min(cap, (1 + r) ** Math.max(0, (month || 1) - MONTH0));

// ---------- bancos ----------
// os clientes da casa pedem empréstimos pequenos (valores bem abaixo do mercado), que crescem um pouquinho com o tempo do mundo
export const BANKS = {
  roxinho: { name: 'Roxinho Bank', price: 6000000, staff: 6, req: 46, avg: 4200, color: '#8b5cf6' },
  enter: { name: 'Banco Enter', price: 9000000, staff: 9, req: 62, avg: 4600, color: '#f97316' },
  santandre: { name: 'Santandré', price: 15000000, staff: 15, req: 90, avg: 5400, color: '#dc2626' },
  caixa: { name: 'Caixa Federau', price: 19000000, staff: 20, req: 110, avg: 5600, color: '#2563eb' },
  bradeskao: { name: 'Bradeskão', price: 24000000, staff: 24, req: 130, avg: 6200, color: '#e11d48' },
  itai: { name: 'Itaí Unibanco', price: 28000000, staff: 28, req: 146, avg: 6600, color: '#f59e0b' },
  brasa: { name: 'Banco do Brasa', price: 34000000, staff: 34, req: 172, avg: 6800, color: '#facc15' },
};
export const POLICY = {   // juros ao mês, inadimplência no prazo do empréstimo, quantos aceitam
  conservador: { rate: 0.028, bad: 0.015, demand: 0.7, label: 'conservador' },
  moderado: { rate: 0.038, bad: 0.035, demand: 1, label: 'moderado' },
  agressivo: { rate: 0.055, bad: 0.09, demand: 1.25, label: 'agressivo' },
};
export const SALARY = 4200, BANK_FIXED = 0.0008, TERM = 9;
// ---------- provedores ----------
// investimento alto (rede de fibra por porta), mensalidade baixa; assinantes entram e saem todo mês
export const ISPS = {
  netroca: { name: 'NetRoça Fibra', price: 700000, homes: 9000, color: '#16a34a' },
  giga21: { name: 'Giga21 Telecom', price: 1600000, homes: 22000, color: '#06b6d4' },
  timtim: { name: 'TimTim Live', price: 3200000, homes: 45000, color: '#2563eb' },
  oi: { name: 'Ói Fibra', price: 4500000, homes: 65000, color: '#eab308' },
  clarao: { name: 'Clarão Net', price: 7000000, homes: 100000, color: '#ef4444' },
  viva: { name: 'Viva Fibra', price: 9500000, homes: 140000, color: '#a855f7' },
};
export const PLANS = { 49: { growth: 1.35, churn: 0.016 }, 69: { growth: 1, churn: 0.022 }, 89: { growth: 0.7, churn: 0.03 } };
export const PORT_COST = 2200, PORT_PACK = 250, TAX_ISP = 0.2, LINK = 7, SUPPORT = 4, TECH_PER = 300, TECH = 3200, MAINT = 0.0035, ISP_FIXED = 4;
// ---------- supermercados ----------
export const MARKETS = {
  zezinho: { name: 'Mercadinho do Zezinho', price: 1200000, clients: 2600, staff: 11, color: '#22c55e' },
  acai: { name: 'Açaí Atacadista', price: 3800000, clients: 11000, staff: 34, color: '#f97316' },
  paoacucre: { name: 'Pão de Açucre', price: 6500000, clients: 16000, staff: 52, color: '#16a34a' },
  carrefur: { name: 'Carrefur', price: 11000000, clients: 26000, staff: 85, color: '#2563eb' },
};
export const MARKUP = { 15: { pull: 1.25, label: 'preço baixo' }, 22: { pull: 1, label: 'preço normal' }, 30: { pull: 0.78, label: 'preço alto' } };
export const TICKET = 78, LOSSES = 0.018, TAX_MKT = 0.03, MKT_SALARY = 2300, MKT_FIXED = 0.0065;
// ---------- usinas: cana (açúcar e etanol) e laranja (suco) ----------
// Caríssimas, faturam muito e gastam muito. Só processam na safra; na entressafra o custo fixo continua (manutenção).
// cap = toneladas de cana ou caixas de laranja por mês moendo a 100%
export const USINAS = {
  canaa: { name: 'Usina Canaã', kind: 'cana', price: 180000000, cap: 120000, color: '#16a34a' },
  bomjesus: { name: 'Usina Bom Jesus do Açúcar', kind: 'cana', price: 320000000, cap: 220000, color: '#f59e0b' },
  dourado: { name: 'Citrus Dourado Sucos', kind: 'laranja', price: 140000000, cap: 900000, color: '#f97316' },
  laranjal: { name: 'Laranjal Paulista Sucos', kind: 'laranja', price: 260000000, cap: 1700000, color: '#eab308' },
};
// safra (mês do ano 1-12): cana de abril a novembro; laranja de junho a janeiro
export const SAFRA = { cana: [4, 5, 6, 7, 8, 9, 10, 11], laranja: [6, 7, 8, 9, 10, 11, 12, 1] };
export const RATES = [0, 50, 75, 100], MIXES = [30, 50, 70];   // moagem (%) e mix de açúcar (%) na usina de cana
// por tonelada de cana: açúcar 118 kg ou etanol 82 L; indústria e CCT (corte, carregamento e transporte da cana de fornecedores)
export const CANA_U = { sugarKg: 118, ethanolL: 82, industry: 38, cct: 44, fixed: 18 };
// por caixa de laranja (40,8 kg): suco vendido, indústria e frete; fixo por caixa de capacidade
export const LARANJA_U = { industry: 4.5, freight: 3, fixed: 2.6 };
export const monthOfYear = m => ((Math.max(1, m) - 1) % 12) + 1;
export const inSafra = (kind, m) => SAFRA[kind].includes(monthOfYear(m));
// preços do mercado internacional (iguais para todos, mudam todo mês)
export const sugarPrice = m => +(2.6 * (1 + 0.14 * Math.sin(m * 0.31) + 0.05 * Math.sin(m * 1.7))).toFixed(2);   // R$/kg
export const ethanolPrice = m => +(3.1 * (1 + 0.12 * Math.sin(m * 0.23 + 1) + 0.05 * Math.sin(m * 1.3))).toFixed(2);   // R$/L
export const juicePrice = m => +(51 * (1 + 0.13 * Math.sin(m * 0.27 + 2) + 0.05 * Math.sin(m * 1.1))).toFixed(2);   // R$ por caixa processada
export const ownsUsina = (s, kind) => (s.biz?.usinas || []).some(b => USINAS[b.brand]?.kind === kind);
// ---------- redes: lanchonetes, carros, joias, imóveis, leilões, aviação, marinas e hotéis ----------
// Mesmo esquema para todos: compra a MARCA (única no jogo) e depois as unidades (lojas, aviões, lanchas, hotéis...).
// Cada unidade fatura conforme a ocupação do mês (reputação, nível de preço, época do ano e sorte) e tem custo fixo alto:
// ocupação boa dá lucro, ocupação fraca dá prejuízo. Aviões e lanchas precisam de vaga em hangar / galpão náutico.
// rev = faturamento por mês com a unidade 100% ocupada; cost = custo fixo por mês; slots = vagas que a unidade dá; slot = vaga que ocupa
const SUMMER = [12, 1, 2, 3], VAC = [12, 1, 7];
export const SECTORS = {
  food: { label: 'redes de lanchonete', one: 'lanchonete', icon: '🍔', base: 0.95, max: 40,
    desc: 'Restaurantes de rua e drive-thru de rodovia: muito movimento, mas aluguel, funcionários e comida custam caro todo mês.',
    brands: { mcboi: { name: 'McBoi Burguer', price: 26000000, color: '#facc15' }, reiburguer: { name: 'Burguer Rei', price: 21000000, color: '#ef4444' }, habibao: { name: 'Habibão Esfihas', price: 12000000, color: '#16a34a' }, bobao: { name: "Bobão's Lanches", price: 8000000, color: '#dc2626' } },
    units: { loja: { label: 'restaurante', price: 2400000, rev: 150000, cost: 114000 }, drive: { label: 'drive-thru de rodovia', price: 4800000, rev: 300000, cost: 228000 } } },
  cars: { label: 'lojas de carro e importados', one: 'loja de carro', icon: '🚘', base: 0.85, max: 25,
    desc: 'Pátios de seminovos giram rápido; showrooms de importados vendem menos carros, mas cada venda dá muito mais margem.',
    brands: { feirao21: { name: 'Feirão Seminovos 21', price: 6000000, color: '#22c55e', units: ['patio'] }, rodao: { name: 'Rodão Seminovos', price: 9500000, color: '#0ea5e9', units: ['patio'] },
      importsp: { name: 'Paulista Import Motors', price: 38000000, color: '#a855f7', units: ['showroom'] }, italia: { name: 'Itália Motors Importados', price: 62000000, color: '#dc2626', units: ['showroom'] } },
    units: { patio: { label: 'pátio de seminovos', price: 3200000, rev: 190000, cost: 124000 }, showroom: { label: 'showroom de importados', price: 14000000, rev: 860000, cost: 565000 } } },
  jewel: { label: 'joalherias', one: 'joalheria', icon: '💍', base: 0.8, max: 30,
    desc: 'Margem alta e estoque caro. Com a mina de ouro, o ouro sai do seu garimpo: custo 8% menor.',
    brands: { vivarra: { name: 'Vivarra Joias', price: 22000000, color: '#be123c' }, hestrela: { name: 'H. Estrela Joalheiros', price: 45000000, color: '#0f172a' }, garimpo: { name: 'Ouro do Garimpo', price: 8000000, color: '#ca8a04' } },
    units: { loja: { label: 'loja de shopping', price: 3600000, rev: 230000, cost: 142000 }, boutique: { label: 'boutique de luxo', price: 9500000, rev: 640000, cost: 402000 } } },
  realty: { label: 'imobiliárias', one: 'imobiliária', icon: '🏠', base: 0.92, max: 60, appreciate: 0.003,
    desc: 'Compre casas e alugue. O aluguel paga IPTU, manutenção e a administração; a casa valoriza com o tempo e vende pelo valor de mercado.',
    brands: { lopex: { name: 'Lopex Imóveis', price: 9000000, color: '#2563eb' }, quintal: { name: 'Quinto Quintal Imóveis', price: 16000000, color: '#f97316' } },
    units: { casa: { label: 'casa', price: 480000, rev: 3200, cost: 1100 }, sobrado: { label: 'sobrado', price: 1250000, rev: 8000, cost: 2900 }, mansao: { label: 'mansão', price: 6500000, rev: 38000, cost: 15000 } } },
  auction: { label: 'casas de leilão', one: 'casa de leilão', icon: '🔨', base: 0.8, max: 15, season: [5, 6, 7, 8, 9], seasonPull: 1.25,
    desc: 'Pavilhões alugados para leilões de gado e cavalos. A temporada forte é de maio a setembro.',
    brands: { nelorepq: { name: 'Parque de Leilões Nelore', price: 7000000, color: '#a16207' }, leilaobr: { name: 'Leilão Rural Brasil', price: 14000000, color: '#15803d' } },
    units: { pavilhao: { label: 'pavilhão de leilão', price: 2800000, rev: 175000, cost: 121000 } } },
  air: { label: 'táxi aéreo e jatos', one: 'empresa de aviação', icon: '✈️', base: 0.78, max: 30,
    desc: 'Compre o hangar e os aviões, e alugue para os clientes do mundo por hora de voo. Cada hangar guarda 4 aviões. Avião parado custa caro (tripulação, seguro e manutenção).',
    brands: { azuu: { name: 'Azuu Táxi Aéreo', price: 15000000, color: '#2563eb' }, jatao: { name: 'Jatão Executive', price: 32000000, color: '#111827' }, brigadeiro: { name: 'Céu de Brigadeiro Aviação', price: 8000000, color: '#0284c7' } },
    units: { hangar: { label: 'hangar (4 aviões)', price: 6500000, rev: 0, cost: 26000, slots: 4 }, mono: { label: 'monomotor', price: 2200000, rev: 140000, cost: 84000, slot: 1 },
      turbo: { label: 'turboélice', price: 14000000, rev: 860000, cost: 520000, slot: 1 }, jato: { label: 'jato executivo', price: 46000000, rev: 2700000, cost: 1650000, slot: 1 } } },
  boat: { label: 'marinas e lanchas', one: 'marina', icon: '🛥️', base: 0.75, max: 30, season: SUMMER, seasonPull: 1.35, offPull: 0.75,
    desc: 'Galpão náutico (6 vagas) e lanchas para alugar. Verão (dezembro a março) lota; no inverno a procura cai.',
    brands: { angra21: { name: 'Marina Angra 21', price: 9000000, color: '#0891b2' }, ilhabela: { name: 'Estaleiro Ilhabela', price: 16000000, color: '#1d4ed8' } },
    units: { galpao: { label: 'galpão náutico (6 vagas)', price: 4000000, rev: 0, cost: 15000, slots: 6 }, lancha: { label: 'lancha 32 pés', price: 1100000, rev: 70000, cost: 38000, slot: 1 },
      iate50: { label: 'iate 50 pés', price: 6000000, rev: 380000, cost: 205000, slot: 1 }, iate80: { label: 'iate 80 pés', price: 22000000, rev: 1380000, cost: 745000, slot: 1 } } },
  hotel: { label: 'hotéis de luxo', one: 'rede de hotel', icon: '🏨', base: 0.82, max: 12, season: VAC, seasonPull: 1.25,
    desc: 'Os mais caros do setor: diárias altas, mas a folha, a manutenção e a energia não param. Férias de verão e de julho enchem os quartos.',
    brands: { copapalacio: { name: 'Copacabana Palácio', price: 85000000, color: '#f8fafc' }, fazzano: { name: 'Fazzano Hotéis', price: 60000000, color: '#78350f' }, tchai: { name: 'Tchai Resort', price: 34000000, color: '#065f46' } },
    units: { boutique: { label: 'hotel boutique (40 quartos)', price: 26000000, rev: 1500000, cost: 1000000 }, resort: { label: 'resort (200 quartos)', price: 92000000, rev: 5200000, cost: 3450000 } } },
};
export const LEVELS = { popular: { label: 'preço popular', mult: 0.85, pull: 1.18 }, normal: { label: 'preço normal', mult: 1, pull: 1 }, premium: { label: 'preço premium', mult: 1.22, pull: 0.8 } };
export const SECTOR_FIXED = 0.0012;   // sede, marketing e sistemas: % do preço da marca por mês
export const unitTypes = (cat, brand) => { const S = SECTORS[cat]; return S.brands[brand]?.units || Object.keys(S.units); };
export const unitCount = (b, t) => (b.units || []).filter(u => u.t === t).length;
export const slotsOf = (cat, b) => { const U = SECTORS[cat].units; let free = 0, need = false; for (const u of b.units || []) { free += U[u.t].slots || 0; free -= U[u.t].slot || 0; if (U[u.t].slot) need = true; } return { free, need: need || Object.values(U).some(x => x.slots) }; };
export const unitValue = (cat, u, month) => { const S = SECTORS[cat], p = S.units[u.t].price; return Math.round(S.appreciate ? p * grow(month - (u.at || month) + 1, S.appreciate, 2.2) * 0.95 : p * 0.6); };
export function buyUnit(s, cat, id, t) {
  const S = SECTORS[cat], b = find(s, cat, id), U = S?.units[t]; if (!b || !U || !unitTypes(cat, b.brand).includes(t)) return 'unidade inválida.';
  if ((b.units || []).length >= S.max) return `limite de ${S.max} unidades por marca.`;
  if (U.slot && slotsOf(cat, b).free < U.slot) return `sem vaga: compre antes um ${Object.values(S.units).find(x => x.slots).label.split(' (')[0]}.`;
  if (s.money < U.price) return 'dinheiro insuficiente.';
  s.money -= U.price; (b.units ??= []).push({ t, at: s.month || 1 }); return null;
}
export function sellUnit(s, cat, id, t) {
  const S = SECTORS[cat], b = find(s, cat, id); if (!b) return { err: 'negócio não encontrado.' };
  const k = (b.units || []).findLastIndex(u => u.t === t); if (k < 0) return { err: 'você não tem essa unidade.' };
  if (S.units[t].slots && slotsOf(cat, b).free < S.units[t].slots) return { err: 'tire os aviões / lanchas antes: eles ficariam sem vaga.' };
  const v = unitValue(cat, b.units[k], s.month || 1); b.units.splice(k, 1); s.money += v; return { value: v };
}
// mês da rede: ocupação × faturamento cheio − custo fixo
export function sectorMonth(s, cat, b, m, rng) {
  const S = SECTORS[cat], L = LEVELS[b.level] || LEVELS.normal, moy = monthOfYear(m);
  b.rep = Math.max(0.35, Math.min(1, (b.rep ?? 0.75) + (L.pull - 1) * 0.04 + 0.007 + (rng() - 0.5) * 0.03));
  const season = S.season ? (S.season.includes(moy) ? S.seasonPull : S.offPull || 1) : 1;
  const occ = Math.max(0.12, Math.min(1, S.base * b.rep * L.pull * season * (0.82 + rng() * 0.3)));
  let rev = 0, cost = (S.brands[b.brand]?.price || 0) * SECTOR_FIXED;
  for (const u of b.units || []) { const U = S.units[u.t]; rev += U.rev * L.mult * occ * grow(m, 0.0004, 2); cost += U.cost * grow(m, 0.0004, 2); }
  if (cat === 'jewel' && s.mina) cost *= 0.92;
  b.occ = occ; return { rev, cost, occ };
}

// ---------- galpões ----------
export const WAREHOUSES = {
  g500: { label: 'galpão 500 t', cap: 500, price: 1800000 },
  g2000: { label: 'armazém 2.000 t', cap: 2000, price: 6500000 },
  g8000: { label: 'complexo de silos 8.000 t', cap: 8000, price: 22000000 },
};
export const FREE_TONS = 60, UNIT_KG = { soja: 60, milho: 60, cafe: 60, laranja: 40.8 }, WH_UPKEEP = 0.0025, WH_INFL = 0.0008;
export const whPrice = (type, month) => Math.round(WAREHOUSES[type].price * grow(month, WH_INFL, 2.5) / 1000) * 1000;

export const LISTS = { banks: BANKS, isps: ISPS, markets: MARKETS, usinas: USINAS, ...Object.fromEntries(Object.entries(SECTORS).map(([k, S]) => [k, S.brands])) };
export const CAT_KEYS = Object.keys(LISTS);
export function ensure(s) {
  s.biz ??= { banks: [], isps: [], markets: [], wh: [] };
  for (const k of [...CAT_KEYS, 'wh']) s.biz[k] = (s.biz[k] || []).filter(Boolean);
  if (s.biz.legacy == null) { const t = tons(s); s.biz.legacy = Math.max(0, Math.ceil(t - FREE_TONS)); }   // quem já tinha estoque grande não perde nada
  return s.biz;
}
const nid = s => `b${(s.nextId = (s.nextId || 1) + 1)}`;
export const brandValue = (b, cat, month) => Math.round(LISTS[cat][b.brand].price * grow(month - (b.at || month) + 1, 0.0004, 2) * 0.85);
export function buy(s, cat, brand) {
  ensure(s);
  const C = LISTS[cat]?.[brand]; if (!C) return 'marca inválida.';
  if (s.biz[cat].some(b => b.brand === brand)) return 'você já é dono dessa marca.';
  if (s.money < C.price) return 'dinheiro insuficiente para comprar a marca.';
  s.money -= C.price;
  const b = { id: nid(s), brand, at: s.month || 1 };
  if (cat === 'banks') Object.assign(b, { capital: 0, loans: [], policy: 'moderado' });
  if (cat === 'isps') Object.assign(b, { ports: 0, subs: 0, plan: 69, net: 0 });
  if (cat === 'markets') Object.assign(b, { markup: 22, rep: 0.6 });
  if (SECTORS[cat]) Object.assign(b, { units: [], level: 'normal', rep: 0.75 });
  s.biz[cat].push(b); return null;
}
export const find = (s, cat, id) => s.biz?.[cat]?.find(b => b.id === id);
// vender: a marca sai por 85% do valor atual; caixa do banco volta inteiro, carteira de empréstimos com deságio
export function saleValue(s, cat, b) {
  const m = s.month || 1, brand = brandValue(b, cat, m);
  if (cat === 'banks') return brand + b.capital + Math.round(b.loans.reduce((t, l) => t + l.bal, 0) * 0.8);
  if (cat === 'isps') return brand + Math.round(b.net * 0.45 + b.subs * 300);
  if (cat === 'markets' || cat === 'usinas') return brand;
  if (SECTORS[cat]) return brand + (b.units || []).reduce((t, u) => t + unitValue(cat, u, m), 0);
  return 0;
}
export function sell(s, cat, id) {
  const b = find(s, cat, id); if (!b) return { err: 'negócio não encontrado.' };
  const v = saleValue(s, cat, b); s.money += v; s.biz[cat] = s.biz[cat].filter(x => x !== b); return { value: v };
}
// ---------- banco: aportar e sacar caixa para emprestar ----------
export function deposit(s, id, amt) { const b = find(s, 'banks', id); amt = Math.floor(amt); if (!b || amt <= 0) return 'valor inválido.'; if (amt > s.money) return 'dinheiro insuficiente.'; s.money -= amt; b.capital += amt; return null; }
export function withdraw(s, id, amt) { const b = find(s, 'banks', id); amt = Math.floor(amt); if (!b || amt <= 0) return 'valor inválido.'; if (amt > b.capital) return 'o banco não tem esse dinheiro em caixa (o resto está emprestado).'; b.capital -= amt; s.money += amt; return null; }
// ---------- provedor: construir rede (portas) e escolher o plano ----------
export function build(s, id, packs = 1) {
  const b = find(s, 'isps', id), C = b && ISPS[b.brand]; if (!b) return 'provedor não encontrado.';
  const n = Math.min(packs * PORT_PACK, C.homes - b.ports); if (n <= 0) return 'a cidade inteira já tem rede.';
  const cost = n * PORT_COST; if (cost > s.money) return 'dinheiro insuficiente para construir a rede.';
  s.money -= cost; b.ports += n; b.net += cost; return null;
}
export const pmt = (bal, r, n) => (r ? bal * r / (1 - (1 + r) ** -n) : bal / n);

export function monthly(s, rng = Math.random) {
  ensure(s); const out = [], m = s.month || 1, add = (txt, val = 0) => { if (val > 0) val *= T.bizMult; s.money += val; out.push({ txt, val: Math.round(val) }); };   // bizMult: painel admin
  // bancos
  for (const b of s.biz.banks) {
    const C = BANKS[b.brand], P = POLICY[b.policy] || POLICY.moderado;
    add(`${C.name}: folha (${C.staff} funcionários) e despesas da agência`, -(C.staff * SALARY + C.price * BANK_FIXED));
    let interest = 0, lost = 0;
    for (const l of b.loans) {
      const due = Math.min(l.bal * (1 + l.rate), pmt(l.bal, l.rate, l.left)), int = l.bal * l.rate;
      if (rng() < l.bad / TERM) { lost += l.bal; l.bal = 0; continue; }   // calote
      interest += int; b.capital += due; l.bal = Math.max(0, l.bal + int - due); l.left--;
    }
    b.loans = b.loans.filter(l => l.bal > 1 && l.left > 0);
    const avg = C.avg * grow(m, 0.0006, 3), want = Math.round(C.req * P.demand * (0.85 + rng() * 0.3));
    let lent = 0, n = 0;
    for (let k = 0; k < want; k++) { const amt = Math.round(avg * (0.4 + rng() * 1.2)); if (amt > b.capital) break; b.capital -= amt; lent += amt; n++; }
    if (lent) b.loans.push({ bal: lent, rate: P.rate, left: TERM, bad: P.bad, n });
    if (b.loans.length > 14) { const [a, c] = b.loans.splice(0, 2); b.loans.unshift({ bal: a.bal + c.bal, rate: a.rate, left: Math.max(a.left, c.left), bad: Math.max(a.bad, c.bad), n: a.n + c.n }); }
    b.last = Math.round(interest - lost - (C.staff * SALARY + C.price * BANK_FIXED));
    out.push({ txt: `${C.name}: ${n} empréstimos novos (${Math.round(lent).toLocaleString('pt-BR')}), juros recebidos ${Math.round(interest).toLocaleString('pt-BR')}${lost ? `, calote de ${Math.round(lost).toLocaleString('pt-BR')}` : ''}${want > n ? ` · faltou caixa para ${want - n} pedidos` : ''}`, val: 0 });
  }
  // provedores
  for (const b of s.biz.isps) {
    const C = ISPS[b.brand], P = PLANS[b.plan] || PLANS[69];
    const free = Math.max(0, b.ports - b.subs), left = Math.max(0, C.homes * 0.32 - b.subs);
    const join = Math.min(free, Math.round(left * 0.06 * P.growth * (0.8 + rng() * 0.4))), quit = Math.round(b.subs * P.churn * (0.8 + rng() * 0.4));
    b.subs = Math.max(0, b.subs + join - quit);
    const rev = b.subs * b.plan * (1 - TAX_ISP), cost = b.subs * (LINK + SUPPORT) + Math.ceil(b.subs / TECH_PER) * TECH + ISP_FIXED * TECH + b.net * MAINT;
    add(`${C.name}: ${b.subs} assinantes (+${join} / −${quit}), mensalidades menos impostos`, rev);
    add(`${C.name}: link de internet, suporte, técnicos e manutenção da rede`, -cost);
    b.last = Math.round(rev - cost);
  }
  // supermercados
  for (const b of s.biz.markets) {
    const C = MARKETS[b.brand], M = MARKUP[b.markup] || MARKUP[22];
    b.rep = Math.max(0.3, Math.min(1.2, b.rep + (M.pull - 1) * 0.04 + 0.01 + (rng() - 0.5) * 0.03));
    const clients = Math.round(C.clients * b.rep * M.pull * (0.9 + rng() * 0.2)), ticket = TICKET * grow(m, 0.0004, 2), rev = clients * ticket;
    const cogs = rev / (1 + b.markup / 100), lossv = rev * LOSSES, staff = C.staff * MKT_SALARY, fixed = C.price * MKT_FIXED, tax = rev * TAX_MKT;
    add(`${C.name}: vendas do mês (${clients.toLocaleString('pt-BR')} clientes)`, rev);
    add(`${C.name}: mercadoria, perdas, ${C.staff} funcionários, aluguel, energia e impostos`, -(cogs + lossv + staff + fixed + tax));
    b.last = Math.round(rev - (cogs + lossv + staff + fixed + tax));
  }
  // usinas
  for (const b of s.biz.usinas) {
    const C = USINAS[b.brand]; if (!C) continue;
    b.rate ??= 100; b.mix ??= 50;
    const safra = inSafra(C.kind, m), on = safra && b.rate > 0, U = C.kind === 'cana' ? CANA_U : LARANJA_U;
    const fixed = C.cap * U.fixed * (b.rate === 0 ? 0.7 : 1);
    let net = -fixed;
    add(`${C.name}: folha, manutenção${safra ? '' : ' da entressafra'} e energia`, -fixed);
    if (on) {
      const q = Math.round(C.cap * b.rate / 100 * (0.9 + rng() * 0.2));
      if (C.kind === 'cana') {
        const mix = b.mix / 100, rev = q * (mix * U.sugarKg * sugarPrice(m) + (1 - mix) * U.ethanolL * ethanolPrice(m));
        const cost = q * ((s.prices?.cana || 150) + U.industry + U.cct);
        add(`${C.name}: ${q.toLocaleString('pt-BR')} t de cana moídas, ${b.mix}% açúcar e ${100 - b.mix}% etanol vendidos`, rev);
        add(`${C.name}: cana dos fornecedores, indústria e logística (corte, carregamento e transporte)`, -cost);
        net += rev - cost;
      } else {
        const own = Math.min(q, Math.floor(s.stock?.laranja || 0)); if (own) s.stock.laranja -= own;   // a laranja do seu armazém entra primeiro (sem compra e sem frete)
        const rev = q * juicePrice(m), cost = (q - own) * ((s.prices?.laranja || 38) + U.freight) + q * U.industry;
        add(`${C.name}: ${q.toLocaleString('pt-BR')} caixas processadas${own ? ` (${own.toLocaleString('pt-BR')} do seu armazém)` : ''}, suco vendido`, rev);
        add(`${C.name}: laranja comprada, indústria e frete`, -cost);
        net += rev - cost;
      }
    } else out.push({ txt: `${C.name}: ${safra ? 'moagem parada por você' : 'entressafra, sem moagem'}`, val: 0 });
    b.last = Math.round(net); b.lastQ = on;
  }
  // redes
  for (const cat of Object.keys(SECTORS)) for (const b of s.biz[cat]) {
    const S = SECTORS[cat], C = S.brands[b.brand]; if (!C) continue;
    const r = sectorMonth(s, cat, b, m, rng), n = (b.units || []).length;
    if (n) add(`${C.name}: faturamento de ${n} ${n === 1 ? 'unidade' : 'unidades'} (${Math.round(r.occ * 100)}% de ocupação)`, r.rev);
    add(`${C.name}: ${n ? 'funcionários, aluguel, manutenção, seguro e ' : ''}sede da marca`, -r.cost);
    b.last = Math.round(r.rev * (r.rev > 0 ? T.bizMult : 1) - r.cost);
  }
  // galpões: manutenção
  for (const w of s.biz.wh) add(`${WAREHOUSES[w.type].label}: manutenção e seguro`, -w.value * WH_UPKEEP);
  return out;
}
export const value = s => { const b = s.biz; if (!b) return 0; return CAT_KEYS.reduce((t, c) => t + (b[c] || []).reduce((a, x) => a + saleValue(s, c, x), 0), 0) + b.wh.reduce((t, w) => t + w.value * 0.8, 0); };

// ---------- armazenagem ----------
export const tons = s => Object.entries(s.stock || {}).reduce((t, [k, q]) => t + (UNIT_KG[k] ? (q || 0) * UNIT_KG[k] / 1000 : 0), 0);
export const capacity = s => FREE_TONS + (s.biz?.legacy || 0) + (s.biz?.wh || []).reduce((t, w) => t + WAREHOUSES[w.type].cap, 0);
export function buyWh(s, type) {
  ensure(s); const W = WAREHOUSES[type]; if (!W) return 'galpão inválido.';
  const p = whPrice(type, s.month); if (s.money < p) return 'dinheiro insuficiente para o galpão.';
  s.money -= p; s.biz.wh.push({ id: nid(s), type, value: p }); return null;
}
export function sellWh(s, id) { const w = s.biz?.wh.find(x => x.id === id); if (!w) return 0; if (tons(s) > capacity(s) - WAREHOUSES[w.type].cap) return -1; const v = Math.round(w.value * 0.8); s.money += v; s.biz.wh = s.biz.wh.filter(x => x !== w); return v; }
// quanto cabe de um produto agora (em unidades)
export const room = (s, good) => Math.max(0, Math.floor((capacity(s) - tons(s)) * 1000 / (UNIT_KG[good] || 60)));
// passou do limite (colheita grande): o excedente é vendido na hora com desconto
export function enforce(s, fee = 0.15) {
  ensure(s); const out = [];
  let over = tons(s) - capacity(s);
  for (const k of ['laranja', 'milho', 'soja', 'cafe']) {
    if (over <= 0) break; const q = s.stock?.[k] || 0; if (!q) continue;
    const sell = Math.min(q, Math.ceil(over * 1000 / UNIT_KG[k])), v = Math.round(sell * (s.prices?.[k] || 0) * (1 - fee));
    s.stock[k] -= sell; s.money += v; over -= sell * UNIT_KG[k] / 1000;
    out.push({ txt: `sem lugar no armazém: ${sell} ${k === 'laranja' ? 'caixas de laranja' : `sacas de ${k === 'cafe' ? 'café' : k}`} vendidas na hora com desconto`, val: v });
  }
  return out;
}
