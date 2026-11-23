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

// ---------- vigilância: quem enriqueceu rápido demais para o tempo que ficou jogando ----------
// p = { id, name, created, banned, online, s (save), hist: [{ t, money }] (24 h), pixIn/pixOut: [{ amount, other, at }], receita (casos), gifts (R$ do admin) }
// O ritmo justo é a mediana de R$ por hora jogada de quem já jogou 1 h+; quem passa de 4x isso, ou recebeu muito Pix, entra na lista.
export const START = 10000, FAIR_X = 4;
const dayKey = t => new Date(t - 3 * 36e5).toISOString().slice(0, 10);   // dia de Brasília
export function watch(players, now = Date.now()) {
  const today = dayKey(now), week = Array.from({ length: 7 }, (_, k) => dayKey(now - k * 864e5));
  const rows = players.map(p => {
    const s = p.s || {}, play = s.play || null, worth = s.money == null ? 0 : L.netWorth({ ...blank, ...s });
    const playH = play ? play.ms / 36e5 : null, sum = a => a.reduce((t, x) => t + (Number(x.amount) || 0), 0);
    const h = [...(p.hist || [])].sort((a, b) => a.t - b.t), money24 = h.length ? (Number(s.money) || 0) - h[0].money : null;
    let casino = 0; try { casino = pnl(s).rows.find(x => x.key === 'jogos')?.lucro || 0; } catch {}
    let warn = []; try { if (s.money != null) warn = alerts(s); } catch {}
    return { ...p, worth, playH, todayH: (play?.days?.[today] || 0) / 36e5, weekH: week.reduce((t, d) => t + (play?.days?.[d] || 0), 0) / 36e5,
      perHour: playH >= 0.25 ? (worth - START) / playH : null, money24, pixInSum: sum(p.pixIn || []), pixOutSum: sum(p.pixOut || []), casino, warn };
  });
  const rates = rows.filter(r => r.playH >= 1 && r.perHour > 0).map(r => r.perHour).sort((a, b) => a - b);
  const fair = rates.length >= 3 ? rates[Math.floor(rates.length / 2)] : null;
  for (const r of rows) {
    const why = [], add = (pts, txt) => { r.score = (r.score || 0) + pts; why.push(txt); };
    r.score = 0;
    if (fair && r.perHour > fair * FAIR_X && r.worth > 200000) add(3, `ganha ${brlShort(r.perHour)} por hora jogada, ${Math.round(r.perHour / fair)}x o normal (${brlShort(fair)}/h)`);
    if (r.playH != null && r.playH < 2 && r.worth > 1e6) add(3, `${brlShort(r.worth)} com só ${r.playH.toFixed(1).replace('.', ',')} h jogadas`);
    if (r.playH == null && r.worth > 1e6) add(1, 'tempo jogado ainda não medido (jogo dele está em versão antiga)');
    if (r.pixInSum > Math.max(100000, r.worth * 0.3)) add(3, `${brlShort(r.pixInSum)} recebidos por Pix (${Math.round(r.pixInSum / Math.max(1, r.worth) * 100)}% do patrimônio): pode ser outra conta dele mandando dinheiro`);
    if (r.pixOutSum > Math.max(100000, (r.worth + r.pixOutSum) * 0.5)) add(2, `mandou ${brlShort(r.pixOutSum)} por Pix, mais da metade do que tinha (conta "laranja"?)`);
    if (r.casino > Math.max(500000, r.worth * 0.2)) add(2, `cassino e apostas deram ${brlShort(r.casino)} de lucro`);
    if (r.money24 != null && r.money24 > Math.max(1e6, r.worth * 0.5)) add(2, `dinheiro subiu ${brlShort(r.money24)} nas últimas 24 h`);
    if (r.receita) add(Math.min(3, r.receita), `pego ${r.receita}x pela Receita Federal (subiu rápido demais em 10 min)`);
    if (r.gifts > 0) why.push(`recebeu ${brlShort(r.gifts)} do administrador (não conta como suspeita)`);
    for (const w of r.warn) add(1, w);
    r.why = why;
    // excesso: o que passa de 2x o ritmo justo pelo tempo jogado (presente do admin não entra)
    r.excess = fair && r.playH != null ? Math.max(0, Math.round(r.worth - (r.gifts || 0) - (START + fair * 2 * r.playH))) : 0;
  }
  rows.sort((a, b) => b.score - a.score || b.worth - a.worth);
  return { rows, fair, today };
}

// ---------- diário (supabase/diario.sql): tudo o que cada jogador fez, com hora e botão clicado ----------
// rows: [{ user_id, at, m, kind, txt, val, money, chips, worth, tab, acts }]. Mostra de onde vem o dinheiro e onde está o furo:
// "gap" é dinheiro que mudou sem lançamento no livro-caixa; o botão clicado antes de cada gap aponta a tela com defeito.
export const pattern = t => String(t || '').replace(/\d[\d.,]*/g, '#').replace(/\s+/g, ' ').trim().slice(0, 80);   // "venda de 500 bois" → "venda de # bois"
const actNames = a => [...new Set(String(a || '').split(', ').map(x => x.replace(/ x\d+$/, '').replace(/[:=].*$/, '')).filter(Boolean))];
export function diaryReport(rows, names = {}) {
  const P = {}, src = {}, gapBy = {}, chipBy = {}, jumps = [];
  const nm = id => names[id] || String(id).slice(0, 8);
  const sorted = [...rows].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const last = {};
  for (const r of sorted) {
    const id = r.user_id, p = (P[id] ??= { id, name: nm(id), in: 0, out: 0, gap: 0, gapN: 0, chips: 0, n: 0, sessions: 0, first: r, last: r, src: {} });
    const v = Number(r.val) || 0; p.n++; p.last = r;
    if (r.kind === 'inicio') {
      p.sessions++;
      const prev = last[id]; if (prev && Math.abs((Number(r.money) || 0) - (Number(prev.money) || 0)) >= 1000) jumps.push({ id, name: p.name, at: r.at, why: r.txt, from: Number(prev.money) || 0, to: Number(r.money) || 0, diff: (Number(r.money) || 0) - (Number(prev.money) || 0), prevAt: prev.at });
    } else if (r.kind === 'gap') {
      p.gap += v; p.gapN++;
      for (const a of actNames(r.acts).concat(r.tab ? [`tela: ${r.tab}`] : [])) { const G = (gapBy[a] ??= { act: a, val: 0, n: 0, players: new Set() }); G.val += v; G.n++; G.players.add(p.name); }
    } else if (r.kind === 'fichas') {
      p.chips += v;
      for (const a of actNames(r.acts)) { const C = (chipBy[a] ??= { act: a, val: 0, n: 0, players: new Set() }); C.val += v; C.n++; C.players.add(p.name); }
    } else if (v) {
      if (v > 0) p.in += v; else p.out -= v;
      const k = pattern(r.txt), S = (src[k] ??= { k, in: 0, out: 0, n: 0, players: {}, ex: r.txt }), Q = (p.src[k] ??= { k, net: 0, n: 0 });
      if (v > 0) S.in += v; else S.out -= v; S.n++; S.players[p.name] = (S.players[p.name] || 0) + v; Q.net += v; Q.n++;
    }
    last[id] = r;
  }
  const list = o => Object.values(o).map(x => ({ ...x, players: [...x.players] })).sort((a, b) => b.val - a.val);
  const players = Object.values(P).map(p => {
    const h = Math.max(1 / 60, (Date.parse(p.last.at) - Date.parse(p.first.at)) / 36e5), dw = (Number(p.last.worth) || 0) - (Number(p.first.worth) || 0);
    return { ...p, hours: h, worthGain: dw, perHour: dw / h, top: Object.values(p.src).sort((a, b) => b.net - a.net).slice(0, 5) };
  }).sort((a, b) => b.perHour - a.perHour);
  const sources = Object.values(src).map(S => ({ ...S, net: S.in - S.out, top: Object.entries(S.players).sort((a, b) => b[1] - a[1])[0] || null, nPlayers: Object.keys(S.players).length })).sort((a, b) => b.net - a.net);
  return { players, sources, gapBy: list(gapBy), chipBy: list(chipBy), jumps: jumps.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)) };
}
