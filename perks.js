// Vantagens de quem tem carro e acessórios (regras puras). Vale o que a pessoa POSSUI, não só o que está usando.
// Cada efeito é um multiplicador somado: dois itens de +10% dão +20%.
import { rewards as collRewards } from './cards.js';
export const EFFECTS = {
  xp: 'XP ganho', daily: 'roleta do dia', perda: 'pontos de perda (mortalidade e praga)', casino: 'ganho de fichas no cassino', animais: 'preço de pintinhos, leitões e bezerros',
  loan: 'juros do banco', race: 'prêmios das provas', ticket: 'bilheteria do clube', cattle: 'preço de venda do gado', frango: 'preço de venda do frango', plant: 'custo do plantio',
  suino: 'preço de venda do suíno', grain: 'venda de soja, milho e café', laranja: 'venda da laranja', cana: 'preço da cana na usina', ouro: 'venda do ouro da mina', biz: 'faturamento das empresas',
};
// carros (chave = modelo em logic.CARS); trator e caminhão já têm vantagem própria em logic.js
export const CAR_PERKS = {
  onix: { xp: 0.04, daily: 0.05 },
  hilux: { cattle: 0.05 },
  sw4: { xp: 0.08 },
  porsche: { race: 0.1, xp: 0.05 },
  g63: { loan: -0.15, ticket: 0.1 },
  huracan: { race: 0.15, daily: 0.2, xp: 0.08 },
  veyron: { race: 0.25, daily: 0.4, xp: 0.15, ticket: 0.2 },
};
// acessórios (chave = id em avatar.CATALOG.acc)
export const ACC_PERKS = {
  brinco: { xp: 0.03 },
  'óculos escuros': { daily: 0.08 },
  'fone gamer': { xp: 0.05 },
  'boné de marca': { xp: 0.04 },
  'chapéu de peão': { cattle: 0.04 },
  'chapéu de granjeiro': { frango: 0.08 },
  'pulseira de prata': { race: 0.05 },
  'relógio de luxo': { loan: -0.2 },
  'corrente de ouro': { daily: 0.15, ticket: 0.05 },
  'anel de diamante': { race: 0.12 },
  'grillz de ouro': { xp: 0.06, daily: 0.1 },
  'tênis de grife': { xp: 0.03, daily: 0.03 },
  'bota de borracha': { suino: 0.08 },
  'luvas de colheita': { laranja: 0.08 },
  'chapéu de palha': { grain: 0.06 },
  'cinto de fivela': { cana: 0.06, cattle: 0.02 },
  'gravata de seda': { biz: 0.05, loan: -0.05 },
  'capacete de mineiro': { ouro: 0.05 },
};

// terras próprias: cada tipo de lote dá uma vantagem, com teto
const cap = (v, m) => Math.min(m, v);
export function landBonuses(lands) {
  const own = (lands || []).filter(l => l.own);
  if (!own.length) return {};
  const ha = own.reduce((t, l) => t + (Number(l.ha) || 0), 0);
  const n = u => own.filter(l => l.use === u).length;
  const out = { xp: cap(own.length * 0.01, 0.1) };
  if (n('pasto')) out.cattle = cap(n('pasto') * 0.02, 0.1);
  if (n('lavoura') + n('café')) out.plant = -cap((n('lavoura') + n('café')) * 0.03, 0.15);
  if (ha >= 100) out.loan = ha >= 500 ? -0.2 : -0.1;
  const sede = own.filter(l => (l.improv || []).includes('casa sede')).length;
  if (sede) out.daily = cap(sede * 0.05, 0.1);
  return out;
}
// o que UM lote à venda acrescenta (para mostrar antes de comprar)
export const landPerk = l => {
  const p = { xp: 0.01 };
  if (l.use === 'pasto') p.cattle = 0.02;
  if (l.use === 'lavoura' || l.use === 'café') p.plant = -0.03;
  if ((l.improv || []).includes('casa sede')) p.daily = 0.05;
  if (Number(l.ha) >= 100) p.loan = -0.1;
  return p;
};
const add = (out, p) => { for (const [k, v] of Object.entries(p || {})) out[k] = (out[k] || 0) + v; };
// marcos de prestígio (troféus a partir de R$ 100 mi): título, selo, troféu com nome e uma vantagem pequena para sempre
// (as vantagens são pequenas de propósito: prestígio sem quebrar a economia; o imposto das faixas dos mais ricos continua valendo)
export const PRESTIGE = [
  { min: 100e6, id: 'diamante', title: 'Magnata Nacional', icon: '💎', trophy: 'Taça Diamante', perk: { loan: -0.1 } },
  { min: 200e6, id: 'safira', title: 'Barão da Economia', icon: '🔷', trophy: 'Cetro de Safira', perk: { daily: 0.1 } },
  { min: 300e6, id: 'rubi', title: 'Senhor dos Mercados', icon: '♦️', trophy: 'Coroa de Rubi', perk: { xp: 0.05 } },
  { min: 500e6, id: 'ouro', title: 'Titã dos Negócios', icon: '🏆', trophy: 'Troféu de Ouro Maciço', perk: { biz: 0.03 } },
  { min: 1e9, id: 'bilhao', title: 'Bilionário do 21 World', icon: '👑', trophy: 'Coroa Imperial', perk: { casino: 0.05 } },
  { min: 2e9, id: 'lenda', title: 'Lenda do 21 World', icon: '🌟', trophy: 'Estrela Eterna', perk: { grain: 0.03 } },
];
export const prestigeOf = trophies => PRESTIGE.filter(p => (trophies || []).includes(p.min));   // conquistados (troféu é para sempre)
export const prestigeTop = trophies => prestigeOf(trophies).at(-1) || null;
export function bonuses(s) {
  const out = {};
  for (const c of new Set((s.cars || []).map(c => c.model))) add(out, CAR_PERKS[c]);        // dois carros iguais não somam
  add(out, landBonuses(s.lands));
  for (const tag of s.owned || []) if (tag.startsWith('acc:')) add(out, ACC_PERKS[tag.slice(4)]);
  for (const r of collRewards(s)) add(out, r);                                                // coleções de cartas completas
  for (const p of prestigeOf(s.trophies)) add(out, p.perk);                                   // marcos de R$ 100 mi para cima
  return out;
}
// multiplicador final de um efeito (juros nunca caem abaixo de 50%)
// coleção Fortuna: +15% no que a pessoa ganhou de fichas (só o lucro da rodada, nunca a aposta de volta)
export const luck = (s, profit) => (profit > 0 ? Math.floor(profit * (bonuses(s).casino || 0)) : 0);
export const bonus = (s, k) => bonuses(s)[k] || 0;   // valor cru (perda: pontos a menos de perda)
export const mult = (s, k) => Math.max(0.5, 1 + (bonuses(s)[k] || 0));
export const label = p => Object.entries(p || {}).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${EFFECTS[k]}`).join(', ');
