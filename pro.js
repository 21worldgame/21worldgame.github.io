// Central de Profissionais: regras puras (sem tela). Quem guarda e decide tudo é o servidor (profissionais.sql).
export const PERIOD = { dia: 'por dia', semana: 'por semana', mes: 'por mês', unico: 'pagamento único' };
export const PER_ONE = { dia: 'dia', semana: 'semana', mes: 'mês', unico: 'entrega' };
export const MAX_N = { dia: 90, semana: 52, mes: 12, unico: 1 };
// sugestões (o jogador pode digitar qualquer outra)
export const PROFS = ['Veterinário(a)', 'Agrônomo(a)', 'Corretor(a) de terras', 'Consultor(a) financeiro', 'Contador(a)', 'Advogado(a)', 'Gerente de fazenda',
  'Peão / vaqueiro', 'Treinador(a) de galgos', 'Jóquei', 'Técnico(a) de futebol', 'Trader', 'Professor(a) de 21', 'Mentor(a) de iniciantes', 'Leiloeiro(a)', 'Designer', 'Segurança'];
export const STATUS = { ativo: ['em andamento', 'green'], disputa: ['em disputa', 'red'], concluido: ['concluído', 'gold'], cancelado: ['cancelado', 'muted'], encerrado: ['encerrado pelo admin', 'red'] };
export const REASONS = { nao_entregou: 'não entregou o serviço', fraude: 'golpe / fraude', abuso: 'comportamento abusivo', outro: 'outro motivo' };

const DAY = 864e5;
export const lenDays = c => ({ dia: 1, semana: 7, mes: 30 }[c.period] || Number(c.service?.days) || 7);
// onde o contrato está: período atual (0 = primeiro), quando ele acaba e quanto ainda está em custódia
export function progress(c, now = Date.now()) {
  const len = lenDays(c) * DAY, t0 = Date.parse(c.started_at), idx = Math.max(0, Math.min(c.periods - 1, Math.floor((now - t0) / len)));
  return { idx, len, periodEnds: t0 + (idx + 1) * len, ends: t0 + c.periods * len, held: Math.max(0, (Number(c.paid) || 0) - (Number(c.released) || 0) - (Number(c.refunded) || 0)) };
}
export const suspended = (p, now = Date.now()) => !!p?.suspended_until && Date.parse(p.suspended_until) > now;
export const starsTxt = v => { const n = Math.max(0, Math.min(5, Number(v) || 0)), f = Math.round(n * 2) / 2; return '★'.repeat(Math.floor(f)) + (f % 1 ? '⯪' : '') + '☆'.repeat(5 - Math.ceil(f)); };
export const fromPrice = p => (p.services || []).reduce((m, s) => Math.min(m, Number(s.price) || Infinity), Infinity);

// selos: o que o perfil mostra ao lado do nome
export function seals(p, now = Date.now()) {
  const out = [], tot = (p.delivered || 0) + (p.late || 0);
  if (suspended(p, now)) out.push({ k: 'susp', label: 'suspenso', tone: 'red', tip: 'Não cumpriu contratos: não pode ser contratado por alguns dias.' });
  if (p.verified) out.push({ k: 'ver', label: '✔ verificado', tone: 'green', tip: 'Conferido pela administração do 21 World.' });
  if (p.rating_n >= 5 && p.stars >= 4.7) out.push({ k: 'top', label: '★ top avaliado', tone: 'gold', tip: 'Nota 4,7 ou mais com pelo menos 5 avaliações.' });
  if (p.delivered >= 10 && p.late / Math.max(1, tot) <= 0.05) out.push({ k: 'pont', label: '⏱ pontual', tone: 'green', tip: 'Entregou 95% ou mais dos períodos no prazo.' });
  if (p.done >= 20) out.push({ k: 'vet', label: '🎖 veterano', tone: 'gold', tip: '20 contratos concluídos ou mais.' });
  if (p.strikes60 > 0 && !suspended(p, now)) out.push({ k: 'obs', label: 'em observação', tone: 'red', tip: `${p.strikes60} penalidade(s) nos últimos 60 dias.` });
  if (now - Date.parse(p.created_at) < 14 * DAY && (p.done || 0) < 3) out.push({ k: 'new', label: 'novo talento', tone: 'muted', tip: 'Chegou há pouco na Central.' });
  return out;
}
// troféus por marcos (contratos concluídos, faturamento, avaliações)
const TROPHIES = [
  ['c1', '🥉', 'primeiro contrato', p => p.done >= 1], ['c10', '🥈', '10 contratos', p => p.done >= 10], ['c50', '🥇', '50 contratos', p => p.done >= 50], ['c100', '💎', '100 contratos', p => p.done >= 100],
  ['e1', '💰', 'R$ 1 milhão faturado', p => p.earned >= 1e6], ['e10', '🏦', 'R$ 10 milhões faturados', p => p.earned >= 1e7], ['e100', '👑', 'R$ 100 milhões faturados', p => p.earned >= 1e8],
  ['r10', '⭐', '10 avaliações', p => p.rating_n >= 10], ['r5', '🌟', 'nota máxima (5 avaliações, média 4,9)', p => p.rating_n >= 5 && p.rating_sum / p.rating_n >= 4.9],
];
export const trophies = p => TROPHIES.map(([k, icon, label, ok]) => ({ k, icon, label, got: !!ok({ done: 0, earned: 0, rating_n: 0, rating_sum: 0, ...p }) }));
// ranking: estrelas pesam mais com mais trabalho feito; suspenso vai para o fim
export const score = (p, now = Date.now()) => (Number(p.stars) || 0) * Math.log10(10 + (p.done || 0) * 3 + (p.rating_n || 0) * 2) + (p.verified ? 0.5 : 0) - (suspended(p, now) ? 100 : 0);
export const MSG = { login: 'Entre na sua conta para usar a Central.', self: 'Você não pode se contratar.', banned: 'Sua conta está suspensa.', nopro: 'Esse profissional não está atendendo.',
  suspended: 'Esse profissional está suspenso por não cumprir contratos.', noservice: 'Esse serviço não existe mais.', worth: 'O valor passa do seu patrimônio.', limit: 'Muitas ações em pouco tempo: espere um pouco.',
  nocontract: 'Contrato não encontrado.', status: 'Esse contrato não permite isso agora.', text: 'Escreva o que foi entregue.', done: 'Você já avaliou este contrato.', early: 'Dá para avaliar depois do primeiro pagamento liberado.',
  stars: 'Escolha de 1 a 5 estrelas.', open: 'Já existe uma denúncia aberta para este contrato.', title: 'Escreva sua profissão (3 letras ou mais).' };
