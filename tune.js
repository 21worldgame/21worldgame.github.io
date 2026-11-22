// Regras ajustáveis pelo painel admin (game_config.data.tuning). O jogo lê na abertura e quando o admin salva.
// Cada valor tem limite: um número absurdo vindo do banco nunca quebra o jogo.
export const DEFAULTS = {
  npcBoost: 3,        // força final dos concorrentes do mundo (x)
  npcRampDays: 30,    // dias reais para os concorrentes chegarem à força final
  hunt: true,         // os maiores concorrentes perseguem o líder do ranking
  huntLead: 1.04,     // quanto o 1º perseguidor fica acima do líder (1,04 = 4%)
  near: true,         // sempre 3 concorrentes logo acima de quem está subindo
  incomeTax: 0.05,    // imposto de renda sobre o lucro do mês, igual para todos
  incomeMin: 300000,  // a partir de qual patrimônio paga imposto de renda
  landPremium: 1.35,  // ágio das terras à venda (1,35 = 35% acima da tabela)
  landOffers: 24,     // quantos lotes de terra à venda por mês
  bizMult: 1,         // resultado mensal das empresas e usinas (receita)
};
const LIMITS = {
  npcBoost: [1, 10], npcRampDays: [1, 365], huntLead: [0.8, 1.5], incomeTax: [0, 0.5], incomeMin: [0, 1e9],
  landPremium: [0.5, 4], landOffers: [5, 60], bizMult: [0.2, 3],
};
export const T = { ...DEFAULTS };
export function applyTune(d) {
  const src = d && typeof d === 'object' ? d : {};
  for (const [k, def] of Object.entries(DEFAULTS)) {
    const v = src[k];
    if (typeof def === 'boolean') T[k] = v == null ? def : !!v;
    else { const n = Number(v), [lo, hi] = LIMITS[k]; T[k] = Number.isFinite(n) && v !== '' && v != null ? Math.min(hi, Math.max(lo, n)) : def; }
  }
  T.landOffers = Math.round(T.landOffers);
  return T;
}
