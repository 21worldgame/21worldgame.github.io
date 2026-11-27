// Vantagens de quem tem carro e acessórios (regras puras). Vale o que a pessoa POSSUI, não só o que está usando.
// Cada efeito é um multiplicador somado: dois itens de +10% dão +20%.
import { rewards as collRewards, SETS } from './cards.js';
export const EFFECTS = {
  xp: 'XP ganho', daily: 'roleta do dia', perda: 'pontos de perda (mortalidade e praga)', casino: 'ganho de fichas no cassino', animais: 'preço de pintinhos, leitões e bezerros',
  loan: 'juros do banco', race: 'prêmios das provas', ticket: 'bilheteria do clube', cattle: 'preço de venda do gado', frango: 'preço de venda do frango', plant: 'custo do plantio',
  suino: 'preço de venda do suíno', grain: 'venda de soja, milho e café', laranja: 'venda da laranja', cana: 'preço da cana na usina', ouro: 'venda do ouro da mina', biz: 'faturamento das empresas',
};
// carros (chave = modelo em logic.CARS); trator e caminhão já têm vantagem própria em logic.js
export const CAR_PERKS = {
  onix: { xp: 0.04, daily: 0.05 },
  hilux: { cattle: 0.02 },
  sw4: { xp: 0.08 },
  porsche: { race: 0.1, xp: 0.05 },
  g63: { loan: -0.05, ticket: 0.03 },
  huracan: { race: 0.15, daily: 0.2, xp: 0.08 },
  veyron: { race: 0.25, daily: 0.4, xp: 0.15, ticket: 0.05 },
  strada: { cattle: 0.01 },
  corolla: { xp: 0.02 },
  compass: { daily: 0.03 },
  raptor: { race: 0.03, xp: 0.02 },
  rrsport: { daily: 0.06 },
  x5: { xp: 0.04 },
  f296: { race: 0.1, xp: 0.06 },
  cullinan: { daily: 0.15, xp: 0.05 },
  graneleiro: { grain: 0.01 },
};
// acessórios (chave = id em avatar.CATALOG.acc). Calibrados para a economia real (v152): vantagem de venda de 1% a 3%,
// do tamanho de um contrato melhor com o comprador; acima disso dobrava o lucro de quem tem margem real de 10% a 30%.
export const ACC_PERKS = {
  // v175 (revisão de equilíbrio): o que importa é o bônus SOMADO. Antes os 18 acessórios somavam +21% de XP, +36% da roleta do dia e +17% nos prêmios
  // de prova, e o capacete de mineiro (+3% sobre a receita da mina) se pagava em menos de 2 meses. Agora cada item vale 1% a 8% e tem teto geral (CAPS).
  brinco: { xp: 0.02 },
  'óculos escuros': { daily: 0.05 },
  'fone gamer': { xp: 0.04 },
  'boné de marca': { xp: 0.03 },
  'chapéu de peão': { cattle: 0.02 },
  'chapéu de granjeiro': { frango: 0.02 },
  'pulseira de prata': { race: 0.03 },
  'relógio de luxo': { loan: -0.05 },
  'corrente de ouro': { daily: 0.08, ticket: 0.02 },
  'anel de diamante': { race: 0.08 },
  'grillz de ouro': { xp: 0.04, daily: 0.05 },
  'tênis de grife': { xp: 0.02, daily: 0.02 },
  'bota de borracha': { suino: 0.02 },
  'luvas de colheita': { laranja: 0.02 },
  'chapéu de palha': { grain: 0.02 },
  'cinto de fivela': { cana: 0.02 },
  'gravata de seda': { biz: 0.02, loan: -0.02 },
  'capacete de mineiro': { ouro: 0.01 },
};
// teto de cada efeito somando TUDO (carros, terras, acessórios, coleções e prestígio). Sem teto, quem junta tudo dobra a economia dos outros.
// v311: teto que dá para alcançar. Plantio (terras 5%), filhotes (coleção 5%) e ouro (capacete 1%) tinham teto acima de tudo o que existe.
export const CAPS = { xp: 0.25, daily: 0.5, race: 0.3, ticket: 0.1, loan: -0.2, plant: -0.05, animais: -0.05, cattle: 0.08, frango: 0.08, suino: 0.08, grain: 0.08, laranja: 0.08, cana: 0.08, ouro: 0.01, biz: 0.07, casino: 0.02 };

// escala da produção (v311): quem produz muito fecha contrato de volume e vende um pouco mais caro, como na vida real.
// Antes frango, suíno, laranja e cana só tinham o acessório (2%) e o teto de 8% era inalcançável.
// v312 (mais difícil): [o que conta, quantos para cada 1%, teto da escala]. Granja e suínos: 1% a cada 3 galpões (18 para os 6%);
// pomar 150 ha, canavial 300 ha e lavoura própria 500 ha para cada 1% (900 ha, 1.800 ha e 2.500 ha no máximo); empresa 1% cada (no máximo 2).
export const SCALE = { frango: ['galpões da granja', 3, 0.06], suino: ['barracões de suínos', 3, 0.06], laranja: ['ha de pomar', 150, 0.06],
  cana: ['ha de canavial', 300, 0.06], grain: ['ha de lavoura ou café em terra própria', 500, 0.05], biz: ['empresa', 1, 0.02] };
export function scaleBonuses(s) {
  const own = (s.lands || []).filter(l => l && l.own), ha = f => own.filter(f).reduce((t, l) => t + (Number(l.ha) || 0), 0);
  const n = { frango: s.granja?.houses?.length || 0, suino: s.suinos?.barns?.length || 0, laranja: ha(l => l.orchard), cana: ha(l => l.cane),
    grain: ha(l => l.use === 'lavoura' || l.use === 'café'), biz: Object.values(s.biz || {}).reduce((t, a) => t + (Array.isArray(a) ? a.length : 0), 0) };
  const out = {}; for (const [k, [, size, max]] of Object.entries(SCALE)) { const p = Math.floor(n[k] / size) * 0.01; if (p) out[k] = Math.min(max, p); }
  return out;
}
// como chegar ao teto de um efeito: todas as fontes que existem no jogo (a página do personagem marca as que você já tem)
const LAND_HOW = { xp: '1% por terra própria, até 10%', cattle: '1% por terra própria de pasto, até 4%', plant: '1% por terra própria de lavoura ou café, até 5%',
  loan: '5% com 100 ha próprios, 10% com 500 ha', daily: '5% por terra própria com casa sede, até 10%' };
export function paths(k) {
  const out = [];
  for (const [id, p] of Object.entries(CAR_PERKS)) if (p[k]) out.push({ src: 'car', id, v: p[k] });
  for (const [id, p] of Object.entries(ACC_PERKS)) if (p[k]) out.push({ src: 'acc', id, v: p[k] });
  if (LAND_HOW[k]) out.push({ src: 'land', txt: LAND_HOW[k] });
  if (SCALE[k]) { const [u, size, max] = SCALE[k]; out.push({ src: 'scale', txt: `1% a cada ${size.toLocaleString('pt-BR')} ${u}, até ${Math.round(max * 100)}%` }); }
  for (const [id, c] of Object.entries(SETS)) if (c.reward?.[k]) out.push({ src: 'coll', id, txt: `coleção ${c.name} completa`, v: c.reward[k] });
  for (const p of PRESTIGE) if (p.perk[k]) out.push({ src: 'prest', id: p.min, txt: `${p.icon} ${p.title} (patrimônio de R$ ${p.min >= 1e9 ? `${p.min / 1e9} bi` : `${p.min / 1e6} mi`})`, v: p.perk[k] });
  return out;
}

// terras próprias: cada tipo de lote dá uma vantagem, com teto
const cap = (v, m) => Math.min(m, v);
export function landBonuses(lands) {
  const own = (lands || []).filter(l => l.own);
  if (!own.length) return {};
  const ha = own.reduce((t, l) => t + (Number(l.ha) || 0), 0);
  const n = u => own.filter(l => l.use === u).length;
  const out = { xp: cap(own.length * 0.01, 0.1) };
  if (n('pasto')) out.cattle = cap(n('pasto') * 0.01, 0.04);
  if (n('lavoura') + n('café')) out.plant = -cap((n('lavoura') + n('café')) * 0.01, 0.05);
  if (ha >= 100) out.loan = ha >= 500 ? -0.1 : -0.05;   // terra de garantia: juros um pouco menores
  const sede = own.filter(l => (l.improv || []).includes('casa sede')).length;
  if (sede) out.daily = cap(sede * 0.05, 0.1);
  return out;
}
// o que UM lote à venda acrescenta (para mostrar antes de comprar)
export const landPerk = l => {
  const p = { xp: 0.01 };
  if (l.use === 'pasto') p.cattle = 0.01;
  if (l.use === 'lavoura' || l.use === 'café') p.plant = -0.01;
  if ((l.improv || []).includes('casa sede')) p.daily = 0.05;
  if (Number(l.ha) >= 100) p.loan = -0.05;
  return p;
};
const add = (out, p) => { for (const [k, v] of Object.entries(p || {})) out[k] = (out[k] || 0) + v; };
// marcos de prestígio (troféus a partir de R$ 100 mi): título, selo, troféu com nome e uma vantagem pequena para sempre
// (as vantagens são pequenas de propósito: prestígio sem quebrar a economia)
export const PRESTIGE = [
  { min: 100e6, id: 'diamante', title: 'Magnata Nacional', icon: '💎', trophy: 'Taça Diamante', perk: { loan: -0.1 } },
  { min: 200e6, id: 'safira', title: 'Barão da Economia', icon: '🔷', trophy: 'Cetro de Safira', perk: { daily: 0.1 } },
  { min: 300e6, id: 'rubi', title: 'Senhor dos Mercados', icon: '♦️', trophy: 'Coroa de Rubi', perk: { xp: 0.05 } },
  { min: 500e6, id: 'ouro', title: 'Titã dos Negócios', icon: '🏆', trophy: 'Troféu de Ouro Maciço', perk: { biz: 0.03 } },
  { min: 1e9, id: 'bilhao', title: 'Bilionário do 21 World', icon: '👑', trophy: 'Coroa Imperial', perk: { xp: 0.05 } },
  { min: 2e9, id: 'lenda', title: 'Lenda do 21 World', icon: '🌟', trophy: 'Estrela Eterna', perk: { grain: 0.03 } },
];
export const prestigeOf = trophies => PRESTIGE.filter(p => (trophies || []).includes(p.min));   // conquistados (troféu é para sempre)
export const prestigeTop = trophies => prestigeOf(trophies).at(-1) || null;
export function bonuses(s) {
  const out = {};
  for (const c of new Set((s.cars || []).map(c => c.model))) add(out, CAR_PERKS[c]);        // dois carros iguais não somam
  add(out, landBonuses(s.lands));
  add(out, scaleBonuses(s));
  for (const tag of s.owned || []) if (tag.startsWith('acc:')) add(out, ACC_PERKS[tag.slice(4)]);
  for (const r of collRewards(s)) add(out, r);                                                // coleções de cartas completas
  for (const p of prestigeOf(s.trophies)) add(out, p.perk);                                   // marcos de R$ 100 mi para cima
  for (const [k, c] of Object.entries(CAPS)) if (k in out) out[k] = c >= 0 ? Math.min(out[k], c) : Math.max(out[k], c);   // teto geral de cada efeito
  return out;
}
// de onde vem cada vantagem (para a página do personagem): total (já com o teto), soma crua e o que cada fonte dá
export const SOURCES = { carros: 'carros e máquinas', terras: 'terras', escala: 'escala da produção', acessorios: 'acessórios', colecoes: 'coleções de cartas', prestigio: 'troféus' };
export function breakdown(s) {
  const src = { carros: {}, terras: landBonuses(s.lands), escala: scaleBonuses(s), acessorios: {}, colecoes: {}, prestigio: {} };
  for (const c of new Set((s.cars || []).map(c => c.model))) add(src.carros, CAR_PERKS[c]);
  for (const tag of s.owned || []) if (tag.startsWith('acc:')) add(src.acessorios, ACC_PERKS[tag.slice(4)]);
  for (const r of collRewards(s)) add(src.colecoes, r);
  for (const p of prestigeOf(s.trophies)) add(src.prestigio, p.perk);
  const tot = bonuses(s), rows = {};
  for (const k of Object.keys(tot)) {
    const parts = Object.fromEntries(Object.entries(src).map(([n, o]) => [n, o[k] || 0]).filter(([, v]) => v));
    rows[k] = { total: tot[k], raw: Object.values(parts).reduce((t, v) => t + v, 0), cap: CAPS[k] ?? null, parts };
  }
  return rows;
}
// multiplicador final de um efeito (juros nunca caem abaixo de 50%)
// coleção Fortuna: +2% no que a pessoa ganhou de fichas (só o lucro da rodada, nunca a aposta de volta)
// teto de 2%: acima disso o bônus supera a vantagem da casa (roleta 2,7%) e apostar vira lucro garantido
export const CASINO_MAX = 0.02;
export const luck = (s, profit) => (profit > 0 ? Math.floor(profit * Math.min(CASINO_MAX, bonuses(s).casino || 0)) : 0);
export const bonus = (s, k) => bonuses(s)[k] || 0;   // valor cru (perda: pontos a menos de perda)
export const mult = (s, k) => Math.max(0.5, 1 + (bonuses(s)[k] || 0));
export const label = p => Object.entries(p || {}).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${EFFECTS[k]}`).join(', ');
