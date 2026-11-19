// Estado salvo, utilidades de tela e comemorações compartilhadas pelos módulos de interface.
import * as L from './logic.js';
import * as FT from './futebol.js';
import * as P from './progress.js';
import { DEFAULT } from './avatar.js';
import * as ST from './stable.js';

// cada conta tem o próprio save neste aparelho: 21world.save.v1:<uid>. Sem login, vale a chave antiga.
const BASE_KEY = '21world.save.v1';
export const UID_KEY = '21world.uid';
let uid = null;
try { uid = localStorage.getItem(UID_KEY); } catch {}
export const keyFor = u => (u ? `${BASE_KEY}:${u}` : BASE_KEY);
export const currentUid = () => uid;
export const $ = sel => document.querySelector(sel);
export const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
export const int = v => new Intl.NumberFormat('pt-BR').format(Math.round(v));
export const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const RM = matchMedia('(prefers-reduced-motion: reduce)');
export const ms = n => (RM.matches ? 0 : n);
export const sleep = n => new Promise(r => setTimeout(r, ms(n)));
const day = d => d.toLocaleDateString('sv');
export const today = () => day(new Date());
export const yesterday = () => day(new Date(Date.now() - 864e5));

function normalize(s) {
  // save antigo ou incompleto: completa com os campos padrão que faltarem
  s = s && typeof s === 'object' ? Object.assign(L.newState(), s) : L.newState();
  for (const k of ['lands', 'herd', 'loans', 'lent', 'offers', 'borrowers', 'log']) if (!Array.isArray(s[k])) s[k] = [];
  s.stock = { soja: 0, milho: 0, cafe: 0, ...(s.stock || {}) };
  s.avatar ??= { ...DEFAULT };
  s.owned ??= []; s.cars ??= [];
  for (const c of s.cars) c.model = L.OLD_CARS[c.model] || c.model;
  s.cars = s.cars.filter(c => L.CARS[c.model]);
  for (const k of ['money', 'chips']) if (!Number.isFinite(s[k])) s[k] = 0;
  s.herd = s.herd.filter(h => h && Number.isFinite(h.heads));
  s.prices = { ...L.newState(() => 0.5).prices, ...(s.prices || {}) };
  if (s.fut?.club && (!Array.isArray(s.fut.squad) || !s.fut.league?.teams)) repairClub(s);
  ST.ensure(s);
  P.ensure(s, today());
  return s;
}
// clube de uma versão antiga do jogo: mantém o clube e refaz o que faltar (elenco, campeonato), sem cobrar nada
function repairClub(s) {
  const c = FT.club(s.fut.club);
  if (!c) { s.futOld = s.fut; delete s.fut; return; }
  const div = FT.divOf(c.n);
  s.fut = { formation: '4-4-2', style: 'equilibrado', market: [], offers: [], history: [], earned: 0, trophies: 0, stadium: 1, morale: 0, season: 1, ...s.fut, club: c.n, colors: c.c, div };
  if (!Array.isArray(s.fut.squad) || s.fut.squad.length < 14) s.fut.squad = [...(Array.isArray(s.fut.squad) ? s.fut.squad : []), ...FT.genSquad(c.r - 3)].slice(0, 26);
  if (!s.fut.league?.teams) s.fut.league = FT.newLeague(div, c.n);
  if (!Array.isArray(s.fut.market)) s.fut.market = [];
  delete s.fut.xi;
}
function load() {
  let s;
  try { const raw = localStorage.getItem(keyFor(uid)); if (raw) s = JSON.parse(raw); } catch {}
  return normalize(s);
}
export const G = { S: load(), render: () => {}, afterSave: null };
export function save() {
  G.S.savedAt = Date.now();
  try { localStorage.setItem(keyFor(uid), JSON.stringify(G.S)); } catch {}
  G.afterSave?.();
}
// save novo de uma conta (nome vindo do cadastro)
export function blankState(name) { const s = normalize(null); if (name) s.avatar.name = name; s.savedAt = Date.now(); return s; }
export function writeSave(u, state) { try { localStorage.setItem(keyFor(u), JSON.stringify(state)); localStorage.setItem(UID_KEY, u); } catch {} }
export function forgetUser() { try { localStorage.removeItem(UID_KEY); } catch {} }
export function reset() { G.S = blankState(G.S.avatar?.name && G.S.avatar.name !== 'você' ? G.S.avatar.name : ''); save(); }
export function note(txt, val = 0) { G.S.log.unshift({ m: G.S.month, txt, val: Math.round(val) }); }
export function pay(v, why) {
  if (v > G.S.money) { say(`Dinheiro insuficiente para ${why}.`, true); return false; }
  G.S.money -= v; note(why, -v); return true;
}

let toastTimer;
export function say(msg, bad = false) {
  const el = $('#status');
  el.textContent = msg;
  el.dataset.tone = bad ? 'bad' : 'ok';
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

// cartão dourado que entra pela direita (conquista, missão cumprida)
export function badge(title, sub, kind = 'ach') {
  const el = document.createElement('div');
  el.className = `badge badge--${kind}`;
  el.innerHTML = `<span class="badge__medal" aria-hidden="true"></span><div><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>`;
  $('#badges').append(el);
  setTimeout(() => el.classList.add('is-out'), ms(4200) || 4200);
  setTimeout(() => el.remove(), (ms(4200) || 4200) + 600);
}

export function confetti(n = 60) {
  if (RM.matches) return;
  const box = $('#confetti');
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.setProperty('--x', `${Math.random() * 100}vw`);
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}vw`);
    c.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    c.style.setProperty('--d', `${1.6 + Math.random() * 1.4}s`);
    c.style.setProperty('--c', `var(--confetti-${1 + (i % 4)})`);
    box.append(c);
    setTimeout(() => c.remove(), 3200);
  }
}

export function levelUp(level) {
  const el = $('#levelup');
  el.querySelector('strong').textContent = `nível ${level}`;
  el.querySelector('span').textContent = `+${int(P.levelReward(level))} fichas de prêmio`;
  el.hidden = false;
  el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
  confetti(90);
  setTimeout(() => { el.hidden = true; }, 2800);
}

// registra um evento de progresso e comemora o que destravou
export function award(ev, n = 1) {
  const out = P.track(G.S, ev, n);
  out.missions.forEach(m => badge('Missão cumprida', `${m.txt}. Resgate ${int(m.reward)} fichas.`, 'mission'));
  out.ach.forEach(a => badge('Conquista desbloqueada', a.txt));
  if (out.levels.length) levelUp(out.levels.at(-1));
  save();
  return out;
}
export function checkAch() { P.checkAch(G.S).forEach(a => badge('Conquista desbloqueada', a.txt)); }

// resumo público do jogador (vai para o salão e para a mesa)
export function profileOf(s = G.S) {
  const own = s.lands.filter(l => l.own);
  return {
    name: s.avatar.name || 'jogador', look: s.avatar, level: s.level, rank: L.rank(L.netWorth(s)), worth: L.netWorth(s),
    stats: s.stats, ach: s.ach, lands: own.length, ha: own.reduce((a, l) => a + l.ha, 0), heads: L.heads(s),
    cars: s.cars.map(c => c.model),
    animals: (s.stable?.animals || []).map(a => ({ kind: a.kind, name: a.name, rating: ST.rating(a), wins: a.wins })),
  };
}
