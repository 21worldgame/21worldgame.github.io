// Tempo de mundo: um relógio único para todos os jogadores (regras puras).
// O mês do jogo passa sozinho, igual para todo mundo: de dia em `monthMs` (5 min) e de madrugada, das 01:00 às 09:00
// de Brasília, em `nightMs` (10 min). Um dia real tem 16 h de dia (192 meses) + 8 h de madrugada (48 meses) = 240 meses.
// A config (epoch, base, monthMs, nightMs) fica no servidor e o administrador pode acelerar o mundo para todos.
// O servidor faz a mesma conta em mundo.sql (world_month): mudar aqui, mudar lá.
export const DEFAULT = { epoch: 1795482831120, base: 171,   // sem o servidor, o relógio não volta para o mundo antigo
  monthMs: 5 * 60 * 1000, nightMs: 10 * 60 * 1000 };
export const NIGHT_FROM = 1, NIGHT_TO = 9;     // madrugada lenta: 01:00 até 09:00 (Brasília)
export const MAX_CATCHUP = 6;                  // quem ficou fora joga no máximo 6 meses de uma vez (o resto o mundo "perdoa")
export const MIN_MONTH_MS = 10 * 1000, MAX_MONTH_MS = 24 * 3600 * 1000;

const H = 36e5, DAY = 24 * H, BRT = 3 * H;   // Brasília = UTC-3 (sem horário de verão)
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clampMs = v => Math.max(MIN_MONTH_MS, Math.min(MAX_MONTH_MS, Math.floor(v)));
export function sanitize(w) {
  const o = w && typeof w === 'object' ? w : {};
  const monthMs = clampMs(num(o.monthMs, DEFAULT.monthMs));
  return {
    epoch: Math.max(0, num(o.epoch, DEFAULT.epoch)),
    base: Math.max(1, Math.min(1e6, Math.floor(num(o.base, DEFAULT.base)))),
    monthMs,
    nightMs: clampMs(num(o.nightMs, monthMs * 2)),   // config antiga (sem nightMs): madrugada com o dobro do tempo
  };
}
// meses corridos desde a meia-noite de Brasília de 01/01/1970 até t (conta fechada, sem laço)
const nightOf = w => w.nightMs || w.monthMs * 2;   // config sem nightMs: madrugada com o dobro do tempo
const lens = w => { const a = NIGHT_FROM * H, b = NIGHT_TO * H; return { a, b, dayU: a / w.monthMs + (b - a) / nightOf(w) + (DAY - b) / w.monthMs }; };
function units(w, t) {
  const { a, b, dayU } = lens(w), loc = t - BRT, d = Math.floor(loc / DAY), x = loc - d * DAY;
  return d * dayU + Math.min(x, a) / w.monthMs + Math.max(0, Math.min(x, b) - a) / nightOf(w) + Math.max(0, x - b) / w.monthMs;
}
function timeAt(w, u) {   // o inverso: em que instante o contador chega a u
  const { a, b, dayU } = lens(w), d = Math.floor(u / dayU), r = u - d * dayU, ua = a / w.monthMs, ub = ua + (b - a) / nightOf(w);
  const x = r < ua ? r * w.monthMs : r < ub ? a + (r - ua) * nightOf(w) : b + (r - ub) * w.monthMs;
  return d * DAY + x + BRT;
}
const since = (w, now) => Math.max(0, units(w, now) - units(w, w.epoch));
export const current = (w, now = Date.now()) => w.base + Math.floor(since(w, now));
export const progress = (w, now = Date.now()) => { const s = since(w, now); return s - Math.floor(s); };
// tempo real até virar o mês (n = 1) ou até daqui a n viradas
export const msUntil = (w, now = Date.now(), n = 1) => Math.max(0, timeAt(w, units(w, Math.max(now, w.epoch)) - progress(w, now) + n) - now);
export const monthsIn = (w, a, b) => units(w, b) - units(w, a);   // meses do mundo que passam entre dois instantes (dia e madrugada contados certo)
export const msLeft = (w, now = Date.now()) => msUntil(w, now, 1);
export const isNight = (now = Date.now()) => { const h = (((now - BRT) % DAY) + DAY) % DAY / H; return h >= NIGHT_FROM && h < NIGHT_TO; };
export const monthMsAt = (w, now = Date.now()) => (isNight(now) ? nightOf(w) : w.monthMs);   // quanto dura o mês que está passando
export const perDay = w => lens(w).dayU;   // meses por dia real

// quantos meses rodar e quantos "pular" para o jogador alcançar o mundo
export function plan(playerMonth, target) {
  const behind = target - playerMonth;
  if (behind <= 0) return { ticks: 0, skipped: 0 };
  const ticks = Math.min(behind, MAX_CATCHUP);
  return { ticks, skipped: behind - ticks };
}
// ações do administrador (viram a config nova; o mês atual do mundo não volta nem salta sem querer)
// mudar a velocidade mantém a proporção da madrugada (o dobro do dia, por padrão)
export const setSpeed = (w, monthMs, now = Date.now()) => sanitize({ epoch: now, base: current(w, now), monthMs, nightMs: monthMs * (nightOf(w) / w.monthMs) });
export const advance = (w, n) => sanitize({ ...w, base: w.base + Math.max(0, Math.floor(n)) });
export const fmt = ms => { const s = Math.ceil(ms / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// calendário do jogo: mês 1 = janeiro do ano 1
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = m => MESES[((m - 1) % 12 + 12) % 12];
export const yearOf = m => Math.floor((m - 1) / 12) + 1;
export const dateLabel = m => `${monthName(m)} do ano ${yearOf(m)}`;
