// Vantagens de quem tem carro e acessórios (regras puras). Vale o que a pessoa POSSUI, não só o que está usando.
// Cada efeito é um multiplicador somado: dois itens de +10% dão +20%.
export const EFFECTS = {
  job: 'pagamento das entregas', tip: 'gorjetas', jobTime: 'tempo para aceitar pedidos', xp: 'XP ganho', daily: 'roleta do dia',
  loan: 'juros do banco', race: 'prêmios das provas', ticket: 'bilheteria do clube', cattle: 'preço de venda do gado',
};
// carros (chave = modelo em logic.CARS); trator e caminhão já têm vantagem própria em logic.js
export const CAR_PERKS = {
  onix: { job: 0.15 },
  hilux: { job: 0.2, cattle: 0.03 },
  sw4: { job: 0.1, xp: 0.05 },
  porsche: { race: 0.1, xp: 0.05 },
  g63: { loan: -0.15, ticket: 0.1 },
  huracan: { race: 0.15, daily: 0.2, xp: 0.08 },
  veyron: { race: 0.25, daily: 0.4, xp: 0.15, ticket: 0.2 },
};
// acessórios (chave = id em avatar.CATALOG.acc)
export const ACC_PERKS = {
  brinco: { xp: 0.03 },
  'óculos escuros': { tip: 0.15 },
  'fone gamer': { jobTime: 0.25 },
  'boné de marca': { tip: 0.1, xp: 0.02 },
  'chapéu de peão': { cattle: 0.04 },
  'pulseira de prata': { job: 0.05 },
  'relógio de luxo': { loan: -0.2 },
  'corrente de ouro': { daily: 0.15, ticket: 0.05 },
  'anel de diamante': { race: 0.12 },
  'grillz de ouro': { xp: 0.06, daily: 0.1 },
};

const add = (out, p) => { for (const [k, v] of Object.entries(p || {})) out[k] = (out[k] || 0) + v; };
export function bonuses(s) {
  const out = {};
  for (const c of new Set((s.cars || []).map(c => c.model))) add(out, CAR_PERKS[c]);        // dois carros iguais não somam
  for (const tag of s.owned || []) if (tag.startsWith('acc:')) add(out, ACC_PERKS[tag.slice(4)]);
  return out;
}
// multiplicador final de um efeito (juros nunca caem abaixo de 50%)
export const mult = (s, k) => Math.max(0.5, 1 + (bonuses(s)[k] || 0));
export const label = p => Object.entries(p || {}).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${EFFECTS[k]}`).join(', ');
