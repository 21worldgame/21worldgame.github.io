// Análise econômica para o painel do admin (sem tela): de onde vem o patrimônio de cada jogador, o que ele está fazendo,
// lucro e prejuízo por atividade e alertas de coisa fora do normal. Também junta todos os jogadores para ver a economia inteira.
import * as L from './logic.js';
import { results, GROUP_LABEL } from './contador.js';
import { total as investTotal } from './invest.js';
import { value as bizValue } from './negocios.js';

// margem de lucro esperada (vida real) por atividade; acima de esperado + 25 pontos vira alerta
export const EXPECT = { lavoura: 0.4, laranja: 0.45, cana: 0.35, gado: 0.3, granja: 0.12, suinos: 0.18, frigorifico: 0.15, negocios: 0.2, mina: 0.35, invest: 1, futebol: 0.3 };
export const ALERT_GAP = 0.25, ALERT_MIN = 1e6;   // só alerta atividade que faturou pelo menos R$ 1 mi no período
const safe = fn => { try { return Number(fn()) || 0; } catch { return 0; } };
const blank = { money: 0, lands: [], herd: [], loans: [], lent: [], cars: [], stock: {}, prices: {} };

// de que é feito o patrimônio
export function worthParts(s0) {
  const s = { ...blank, ...s0 }, own = (s.lands || []).filter(l => l?.own), total = L.netWorth(s), debt = safe(() => L.debt(s));
  const parts = { dinheiro: Number(s.money) || 0, fichas: (Number(s.chips) || 0) * L.CHIP, terras: own.reduce((t, l) => t + (Number(l.value) || 0), 0),
    gado: safe(() => L.herdValue(s)), estoque: Object.entries(s.stock || {}).reduce((t, [k, q]) => t + (Number(q) || 0) * (s.prices?.[k] || 0), 0),
    'carros e máquinas': safe(() => L.carsValue(s)), empresas: safe(() => bizValue(s)), investimentos: safe(() => investTotal(s)) };
  parts.outros = total + debt - Object.values(parts).reduce((a, b) => a + b, 0);   // granja, suínos, pomar, cana, cartas, animais, mina...
  return { total, debt, parts };
}

// o que o jogador está fazendo agora
export function activities(s) {
  const out = [], ha = {};
  for (const l of s.lands || []) { const k = l.crop?.type || (l.orchard ? 'laranja' : l.cane ? 'cana' : null); if (k) ha[k] = (ha[k] || 0) + (Number(l.ha) || 0); }
  const own = (s.lands || []).filter(l => l.own), rent = (s.lands || []).filter(l => !l.own);
  if (own.length) out.push(`${own.length} terras próprias (${Math.round(own.reduce((t, l) => t + (l.ha || 0), 0)).toLocaleString('pt-BR')} ha)${rent.length ? `, ${rent.length} arrendadas` : ''}`);
  for (const [k, v] of Object.entries(ha)) out.push(`${k === 'cafe' ? 'café' : k}: ${Math.round(v).toLocaleString('pt-BR')} ha plantados`);
  const hd = safe(() => L.heads(s)); if (hd) out.push(`gado: ${hd.toLocaleString('pt-BR')} cabeças`);
  const gr = (s.granja?.lots || []).length, su = (s.suinos?.lots || []).length;
  if (gr) out.push(`granja: ${gr} lotes de frango`); if (su) out.push(`suínos: ${su} lotes`);
  const biz = Object.entries(s.biz || {}).reduce((t, [, v]) => t + (Array.isArray(v) ? v.length : 0), 0); if (biz) out.push(`${biz} empresas`);
  if (s.mina) out.push('dono da mina de ouro');
  if (s.fut?.club) out.push(`futebol: ${s.fut.club}, ${['Série A', 'Série B', 'Série C'][s.fut.div] || ''}, temporada ${s.fut.season}, rodada ${s.fut.league?.round ?? 0}`);
  if ((s.stable?.animals || []).length) out.push(`${s.stable.animals.length} animais de corrida`);
  if ((s.invest || []).length) out.push(`${s.invest.length} investimentos no banco`);
  if ((s.loans || []).length) out.push(`${s.loans.length} empréstimos (deve ${Math.round(L.debt(s)).toLocaleString('pt-BR')})`);
  if (s.chips) out.push(`${Number(s.chips).toLocaleString('pt-BR')} fichas no cassino`);
  return out;
}

// lucro e prejuízo por atividade (últimos `months` meses do mundo), com margem e alerta
export function pnl(s, months = 36) {   // 36 = tudo o que o jogo guarda; janela curta engana (vende hoje a safra plantada antes)
  const r = results(s, (s.month || 0) - months + 1, s.month || 0);
  const rows = r.rows.map(x => {
    const margin = x.in > 0 ? x.lucro / x.in : null, exp = EXPECT[x.key];
    return { ...x, margin, alert: exp != null && x.in >= ALERT_MIN && margin != null && margin > exp + ALERT_GAP };
  }).sort((a, b) => b.lucro - a.lucro);
  return { rows, in: r.in, out: r.out, lucro: r.lucro };
}

// alertas do jogador: margem fora do normal, cassino ganhando muito, dívida alta, dinheiro negativo
export function alerts(s, p = pnl(s)) {
  const a = [], w = L.netWorth({ ...blank, ...s });
  for (const x of p.rows) if (x.alert) a.push(`${x.label}: margem de ${Math.round(x.margin * 100)}% (o normal é até ~${Math.round(EXPECT[x.key] * 100)}%) em ${brlShort(x.in)} de faturamento`);
  const jogos = p.rows.find(x => x.key === 'jogos'); if (jogos && jogos.lucro > Math.max(2e6, w * 0.1)) a.push(`cassino e apostas deram ${brlShort(jogos.lucro)} de lucro (sorte grande ou falha)`);
  if (w > 0 && p.lucro > w * 0.6) a.push(`lucrou ${brlShort(p.lucro)} em 36 meses do jogo, ${Math.round(p.lucro / w * 100)}% do patrimônio: ritmo muito acima do normal`);
  if ((Number(s.money) || 0) < 0) a.push(`dinheiro negativo: ${brlShort(s.money)}`);
  const d = safe(() => L.debt(s)); if (w > 0 && d > w * 0.5) a.push(`dívida de ${brlShort(d)}, mais da metade do patrimônio`);
  return a;
}
export const brlShort = v => { const n = Number(v) || 0, a = Math.abs(n); return `${n < 0 ? '-' : ''}R$ ${a >= 1e9 ? `${(a / 1e9).toFixed(2).replace('.', ',')} bi` : a >= 1e6 ? `${(a / 1e6).toFixed(1).replace('.', ',')} mi` : a >= 1e3 ? `${Math.round(a / 1e3)} mil` : Math.round(a)}`; };

// maiores lançamentos do livro-caixa (entradas e saídas) dos últimos meses
export const bigMoves = (s, n = 12) => [...(s.log || [])].filter(l => l.val).sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, n);

// a economia inteira: soma de todos os jogadores por atividade
export function economy(saves, months = 36) {
  const by = {}, tot = { players: 0, money: 0, worth: 0 };
  for (const { name, data: s } of saves) {
    if (!s) continue;
    tot.players++; tot.money += Number(s.money) || 0; tot.worth += L.netWorth({ ...blank, ...s });
    for (const x of pnl(s, months).rows) {
      const B = (by[x.key] ??= { key: x.key, label: GROUP_LABEL[x.key] || x.key, in: 0, out: 0, lucro: 0, players: 0, top: null });
      B.in += x.in; B.out += x.out; B.lucro += x.lucro; B.players++;
      if (!B.top || x.lucro > B.top.lucro) B.top = { name, lucro: x.lucro };
    }
  }
  const rows = Object.values(by).map(B => { const margin = B.in > 0 ? B.lucro / B.in : null, exp = EXPECT[B.key];
    return { ...B, margin, alert: exp != null && B.in >= ALERT_MIN && margin != null && margin > exp + ALERT_GAP }; }).sort((a, b) => b.lucro - a.lucro);
  return { ...tot, rows };
}
