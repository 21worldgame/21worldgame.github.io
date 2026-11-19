// Apostas no futebol ao vivo (regras puras). Rodadas de 4 minutos iguais para todos os jogadores: a semente é o horário.
// 1 min de pré-jogo (apostas abertas, relatório dos times), 2,5 min de jogo ao vivo (90 minutos), 30 s de resultado.
// As odds saem do mesmo modelo que simula o jogo, com 7% de margem da casa: ninguém tem vantagem garantida.
import { CLUBS } from './futebol.js';

export const PRE = 60000, LIVE = 150000, POST = 30000, SLOT = PRE + LIVE + POST, PER_SLOT = 3, MARGIN = 0.07;
export const MIN_BET = 10, MAX_BET = 20000, EPOCH = Date.UTC(2026, 10, 1);
const TEAMS = [...CLUBS[0], ...CLUBS[1]];

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const slotOf = now => Math.floor((now - EPOCH) / SLOT);
export const slotStart = slot => EPOCH + slot * SLOT;
export function phase(slot, now) { const t = now - slotStart(slot); return t < PRE ? 'pre' : t < PRE + LIVE ? 'live' : 'post'; }
export const minuteAt = (slot, now) => Math.max(0, Math.min(90, Math.floor((now - slotStart(slot) - PRE) / (LIVE / 90))));
export const kickoffIn = (slot, now) => Math.max(0, slotStart(slot) + PRE - now);

// força dos times -> médias esperadas por jogo
export function rates(h, a) {
  const d = (h.r - a.r) / 10;
  return { gh: 1.45 * Math.exp(0.3 * d), ga: 1.12 * Math.exp(-0.3 * d), ch: Math.max(2.5, 5.3 + 0.5 * d), ca: Math.max(2.5, 4.4 - 0.5 * d), yh: 1.9, ya: 2.3, sh: 12 + 2 * d, sa: 10 - 2 * d };
}
const EV = [['gol', 'gh', 'ga'], ['esc', 'ch', 'ca'], ['cart', 'yh', 'ya'], ['chute', 'sh', 'sa']];

const cache = new Map();
export function matches(slot) {
  if (cache.has(slot)) return cache.get(slot);
  const r = rng(slot * 7919 + 13), pool = [...TEAMS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const list = Array.from({ length: PER_SLOT }, (_, i) => {
    const home = pool[i * 2], away = pool[i * 2 + 1], rt = rates(home, away), e = rng(slot * 131 + i * 17 + 1), events = [];
    const kick = e() < 0.5 ? 'h' : 'a';
    for (let m = 1; m <= 90; m++) for (const [type, kh, ka] of EV) {
      if (e() < rt[kh] / 90) events.push({ m, type, side: 'h' });
      if (e() < rt[ka] / 90) events.push({ m, type, side: 'a' });
    }
    return { id: `${slot}-${i}`, slot, i, home, away, rt, kick, events, poss: Math.round(50 + (home.r - away.r) * 0.6 + (e() - 0.5) * 8) };
  });
  cache.set(slot, list); if (cache.size > 12) cache.delete(cache.keys().next().value);
  return list;
}
export const count = (mt, type, side, upto = 90) => mt.events.filter(ev => ev.type === type && (!side || ev.side === side) && ev.m <= upto).length;

// distribuições exatas do modelo (binomial de 90 minutos) para as odds
function binom(p, n = 90) { const out = [Math.pow(1 - p, n)]; for (let k = 1; k <= n; k++) out[k] = out[k - 1] * ((n - k + 1) / k) * (p / (1 - p)); return out; }
function conv(a, b) { const o = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { o[i + j] += x * y; })); return o; }
const over = (d, line) => d.reduce((t, x, k) => t + (k > line ? x : 0), 0);
export const odd = p => Math.min(60, Math.max(1.03, Math.floor(((1 - MARGIN) / p) * 100) / 100));

export function markets(mt) {
  const { rt, home, away } = mt, gh = binom(rt.gh / 90), ga = binom(rt.ga / 90);
  let ph = 0, pd = 0;
  gh.forEach((x, i) => ga.forEach((y, j) => { if (i > j) ph += x * y; else if (i === j) pd += x * y; }));
  const goals = conv(gh, ga), corners = conv(binom(rt.ch / 90), binom(rt.ca / 90)), cards = conv(binom(rt.yh / 90), binom(rt.ya / 90));
  const ou = (d, line) => { const o = over(d, line); return [{ k: 'o', label: `mais de ${String(line).replace('.', ',')}`, p: o }, { k: 'u', label: `menos de ${String(line).replace('.', ',')}`, p: 1 - o }]; };
  const scores = [];
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) scores.push({ k: `${i}-${j}`, label: `${i} x ${j}`, p: gh[i] * ga[j] });
  scores.push({ k: 'outro', label: 'outro placar', p: 1 - scores.reduce((t, s) => t + s.p, 0) });
  const list = [
    { id: 'res', label: 'resultado final', opts: [{ k: 'h', label: home.n, p: ph }, { k: 'd', label: 'empate', p: pd }, { k: 'a', label: away.n, p: 1 - ph - pd }] },
    { id: 'kick', label: 'saída de bola', opts: [{ k: 'h', label: home.n, p: 0.5 }, { k: 'a', label: away.n, p: 0.5 }] },
    { id: 'gols', label: 'total de gols', opts: ou(goals, 2.5) },
    { id: 'esc', label: 'escanteios', opts: ou(corners, 9.5) },
    { id: 'cart', label: 'cartões amarelos', opts: ou(cards, 4.5) },
    { id: 'placar', label: 'placar exato', opts: scores },
  ];
  for (const m of list) for (const o of m.opts) o.odd = odd(o.p);
  return list;
}

// a aposta ganhou? (só depois do apito final)
export function wins(mt, mk, k) {
  const h = count(mt, 'gol', 'h'), a = count(mt, 'gol', 'a');
  if (mk === 'res') return k === (h > a ? 'h' : h < a ? 'a' : 'd');
  if (mk === 'kick') return k === mt.kick;
  if (mk === 'placar') return k === `${h}-${a}` || (k === 'outro' && (h > 3 || a > 3));
  const line = { gols: 2.5, esc: 9.5, cart: 4.5 }[mk], n = count(mt, { gols: 'gol', esc: 'esc', cart: 'cart' }[mk]);
  return k === (n > line ? 'o' : 'u');
}

export function place(s, now, slot, i, mk, k, stake) {
  stake = Math.floor(Number(stake) || 0);
  if (phase(slot, now) !== 'pre') return 'as apostas desse jogo já fecharam.';
  if (stake < MIN_BET) return `a aposta mínima é ${MIN_BET} fichas.`;
  if (stake > MAX_BET) return `a aposta máxima é ${MAX_BET.toLocaleString('pt-BR')} fichas.`;
  if (stake > (s.chips || 0)) return 'fichas insuficientes. Compre no caixa do cassino.';
  const mt = matches(slot)[i], m = markets(mt).find(x => x.id === mk), o = m?.opts.find(x => x.k === k);
  if (!o) return 'opção inválida.';
  s.chips -= stake;
  (s.fbets ??= []).push({ id: Math.random().toString(36).slice(2, 9), slot, i, mk, k, odd: o.odd, stake, game: `${mt.home.n} x ${mt.away.n}`, label: `${m.label}: ${o.label}` });
  return null;
}

// paga as apostas cujo jogo terminou; devolve o que aconteceu para o livro-caixa
export function settle(s, now) {
  const out = [];
  s.fbets = (s.fbets || []).filter(b => {
    if (now < slotStart(b.slot) + PRE + LIVE) return true;
    const mt = matches(b.slot)[b.i], won = wins(mt, b.mk, b.k), pay = won ? Math.floor(b.stake * b.odd) : 0;
    s.chips = (s.chips || 0) + pay;
    (s.fhist ??= []).unshift({ ...b, won, pay, score: `${count(mt, 'gol', 'h')} x ${count(mt, 'gol', 'a')}` }); s.fhist.length = Math.min(s.fhist.length, 15);
    out.push({ won, pay, txt: `aposta futebol (${b.game}, ${b.label}): ${won ? `ganhou ${pay} fichas` : `perdeu ${b.stake} fichas`}` });
    return false;
  });
  return out;
}

// "últimos 5 jogos" do relatório: fixos por time e rodada, puxados pela força do time
export function form(team, slot) {
  const r = rng(slot * 3 + team.n.length * 977 + team.r);
  return Array.from({ length: 5 }, () => { const x = r() + (team.r - 72) / 40; return x > 0.62 ? 'V' : x > 0.36 ? 'E' : 'D'; });
}
