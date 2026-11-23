// Tempo de mundo: um relógio único para todos os jogadores (regras puras).
// O mês do jogo não é mais um botão: ele passa sozinho a cada `monthMs` de tempo real, igual para todo mundo.
// A config (epoch, base, monthMs) fica no Supabase e o administrador pode acelerar o mundo para todos.
export const DEFAULT = { epoch: 1795380251110, base: 1,   // vida nova (22/11/2026): sem o servidor, o relógio não volta para o mundo antigo
  monthMs: 5 * 60 * 1000 };   // 1 mês do mundo = 5 min reais
export const MAX_CATCHUP = 6;                  // quem ficou fora joga no máximo 6 meses de uma vez (o resto o mundo "perdoa")
export const MIN_MONTH_MS = 10 * 1000, MAX_MONTH_MS = 24 * 3600 * 1000;

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
export function sanitize(w) {
  const o = w && typeof w === 'object' ? w : {};
  return {
    epoch: Math.max(0, num(o.epoch, DEFAULT.epoch)),
    base: Math.max(1, Math.min(1e6, Math.floor(num(o.base, DEFAULT.base)))),
    monthMs: Math.max(MIN_MONTH_MS, Math.min(MAX_MONTH_MS, Math.floor(num(o.monthMs, DEFAULT.monthMs)))),
  };
}
export const current = (w, now = Date.now()) => w.base + Math.max(0, Math.floor((now - w.epoch) / w.monthMs));
export const msLeft = (w, now = Date.now()) => w.monthMs - (Math.max(0, now - w.epoch) % w.monthMs);
export const progress = (w, now = Date.now()) => 1 - msLeft(w, now) / w.monthMs;

// quantos meses rodar e quantos "pular" para o jogador alcançar o mundo
export function plan(playerMonth, target) {
  const behind = target - playerMonth;
  if (behind <= 0) return { ticks: 0, skipped: 0 };
  const ticks = Math.min(behind, MAX_CATCHUP);
  return { ticks, skipped: behind - ticks };
}
// ações do administrador (viram a config nova; o mês atual do mundo não volta nem salta sem querer)
export const setSpeed = (w, monthMs, now = Date.now()) => sanitize({ epoch: now, base: current(w, now), monthMs });
export const advance = (w, n) => sanitize({ ...w, base: w.base + Math.max(0, Math.floor(n)) });
export const fmt = ms => { const s = Math.ceil(ms / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// calendário do jogo: mês 1 = janeiro do ano 1
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = m => MESES[((m - 1) % 12 + 12) % 12];
export const yearOf = m => Math.floor((m - 1) / 12) + 1;
export const dateLabel = m => `${monthName(m)} do ano ${yearOf(m)}`;
