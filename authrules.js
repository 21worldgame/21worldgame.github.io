// Regras puras do cadastro e login (sem DOM, sem rede): validação e tradução de erros do servidor.
export const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanName(raw) {
  return String(raw ?? '').normalize('NFC').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
}

export function validateEmail(email) {
  const e = String(email ?? '').trim();
  if (!e) return 'Digite seu e-mail.';
  return EMAIL.test(e) && e.length <= 254 ? null : 'Esse e-mail não parece válido.';
}

export function validatePassword(pw) {
  const p = String(pw ?? '');
  if (p.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (p.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (/^(.)\1+$/.test(p) || ['12345678', '123456789', '1234567890', 'password', 'senha123', 'qwertyui', '00000000'].includes(p.toLowerCase())) return 'Escolha uma senha menos óbvia.';
  return null;
}

// devolve a mensagem de erro, ou null se o formulário está ok
export function validateSignup({ name, email, password, adult }) {
  const n = cleanName(name);
  if (n.length < 3) return 'O nome do jogador precisa ter de 3 a 18 letras ou números.';
  return validateEmail(email) || validatePassword(password) || (adult ? null : 'Confirme que você tem 18 anos ou mais para criar a conta.');
}
export function validateLogin({ email, password }) {
  return validateEmail(email) || (password ? null : 'Digite sua senha.');
}

const MAP = [
  [/banned/i, 'Conta presa pela Polícia Federal (Operação Espelho): fraude com robô e contas laranja na mesa de operações. Os bens estão apreendidos. A soltura só acontece se você assumir a fraude e devolver os bens: fale com a administração no Discord.'],
  [/captcha/i, 'A verificação do Cloudflare (não sou robô) falhou. Recarregue a página e tente de novo.'],
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
  [/already registered|already been registered|user already exists/i, 'Já existe uma conta com esse e-mail. Use a aba "entrar".'],
  [/password should be at least|weak password|password is too short/i, 'Essa senha é fraca. Use 8 caracteres ou mais.'],
  [/same password|different from the old/i, 'A nova senha precisa ser diferente da antiga.'],
  [/rate limit|too many requests|over_email_send_rate_limit|security purposes/i, 'Muitas tentativas. Espere alguns minutos e tente de novo.'],
  [/signups? (not allowed|are disabled)/i, 'O cadastro está fechado no momento.'],
  [/failed to fetch|networkerror|network request failed|load failed/i, 'Sem conexão com o servidor. Confira sua internet.'],
  [/invalid.*email|unable to validate email/i, 'Esse e-mail não parece válido.'],
  [/jwt|token.*expired|session.*(missing|not found)/i, 'Sua sessão expirou. Entre de novo.'],
];
export function translateError(err) {
  const msg = String(err?.message ?? err ?? '');
  for (const [re, pt] of MAP) if (re.test(msg)) return pt;
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}

// nome já em uso (índice único em public_profiles): tenta de novo com um sufixo
export const isNameTaken = err => err?.code === '23505' || /duplicate key|unique constraint/i.test(String(err?.message ?? ''));
export const withSuffix = (name, n) => `${cleanName(name).slice(0, 15)}${String(n).padStart(2, '0')}`.slice(0, 18);

// zeramento geral (v161): save da nuvem gravado ANTES desta hora é do mundo antigo e é zerado ao abrir; gravado DEPOIS (por exemplo,
// restaurado pelo administrador) já é do mundo novo e NÃO pode ser zerado de novo. Marca as flags que o store.js usa para decidir.
export const WIPE_AT = Date.parse('2026-11-22T21:21:00Z');
export function keepRestored(row) {
  if (!row?.data || row.data.z161 || !(Date.parse(row.updated_at) > WIPE_AT)) return row;
  return { ...row, restored: true, data: { ...row.data, z161: 1, l165: row.data.l165 || 1, m10k: row.data.m10k || 1 } };
}
