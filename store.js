// Estado salvo, utilidades de tela e comemorações compartilhadas pelos módulos de interface.
import * as L from './logic.js';
import * as FT from './futebol.js';
import * as P from './progress.js';
import { DEFAULT } from './avatar.js';
import * as ST from './stable.js';
import * as SFX from './sfx.js';
import * as PK from './perks.js';
import { completed as collsDone, prestige as collsPrestige } from './cards.js';

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
  if (s.feras) {   // Feras 21 saiu do jogo: devolve o valor de venda das feras e das gemas
    const V = { chamarrao: 45000, raizeiro: 45000, relampejo: 45000, marejo: 9000, folhagor: 9000, trovoar: 9000, rochedo: 9000, sombrito: 9000, vulcanor: 220000, tsunamix: 220000, montanhor: 220000, eclipsor: 220000, solarion: 1500000, kraquion: 1500000 };
    const back = Math.round((s.feras.box || []).reduce((t, f) => t + (V[f.sp] || 2500) * (1 + ((f.lv || 1) - 1) * 0.04) * 0.7, 0) + (Number(s.feras.gems) || 0) * 3);
    if (back > 0) { s.money = (Number(s.money) || 0) + back; (s.log ||= []).unshift({ txt: 'Feras 21 saiu do jogo: valor das suas feras e gemas devolvido', val: back }); }
    delete s.feras; s.shop = (s.shop || []).filter(l => l.kind !== 'fera');
  }
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
// jogadores bloqueados (não mandam proposta, somem da Resenha). Mundo: npc:<id> · pessoa: name:<nome>
export const blockKey = (name, npcId) => (npcId ? `npc:${npcId}` : `name:${String(name || '').toLowerCase()}`);
export const isBlocked = (name, npcId) => (G.S?.blocked || []).includes(blockKey(name, npcId));
export function setBlocked(key, on) { const b = new Set(G.S.blocked || []); on ? b.add(key) : b.delete(key); G.S.blocked = [...b]; }
export function adopt(state) { G.S = normalize(state); try { localStorage.setItem(keyFor(uid), JSON.stringify(G.S)); } catch {} }
export function writeSave(u, state) { try { localStorage.setItem(keyFor(u), JSON.stringify(state)); localStorage.setItem(UID_KEY, u); } catch {} }
export function forgetUser() { try { localStorage.removeItem(UID_KEY); } catch {} }
export function reset() { G.S = blankState(G.S.avatar?.name && G.S.avatar.name !== 'você' ? G.S.avatar.name : ''); save(); }
export function note(txt, val = 0) { try { G.track?.(G.S, txt, val); } catch {} G.S.log.unshift({ m: G.S.month, txt, val: Math.round(val) }); try { G.onNote?.(txt, val); } catch {}
  if (val >= 2000) SFX.cash(val >= Math.max(1e6, (G.S.money || 0) * 0.05)); }   // onNote: TV 21 (news-ui) · dinheiro entrando: som (valor pequeno não toca)
export function pay(v, why, buy = true) {   // buy=false: quitar dívida / emprestar não é compra, não leva a taxa dos mais ricos
  const e = buy && L.eliteOf(G.S); if (e) { v = Math.round(v * (1 + e.price)); why += ` (+${Math.round(e.price * 100)}% de taxa para os mais ricos)`; }
  if (v > G.S.money) { say(`Dinheiro insuficiente para ${why}.`, true); return false; }
  G.S.money -= v; note(why, -v); return true;
}


// avisos nas laterais (nunca no meio nem em cima): esquerda = avisos do jogo, direita = conversas e conquistas.
// Avisos do jogo somem sozinhos e ficam guardados no sino (no máximo 4 por lado; o mais velho sai). "não mostrar" desliga aquele tipo (volta no perfil).
export const ntOff = k => { try { return localStorage.getItem(`21world.nt.${k}`) === 'off'; } catch { return false; } };
export function ntSet(k, on) { try { on ? localStorage.removeItem(`21world.nt.${k}`) : localStorage.setItem(`21world.nt.${k}`, 'off'); } catch {} }
export function ntBox(side) {
  if (matchMedia('(max-width: 40rem)').matches) side = 'm';   // celular: uma pilha só, logo acima da barra de baixo
  let b = document.getElementById(`nt-${side}`);
  if (!b) { b = Object.assign(document.createElement('div'), { id: `nt-${side}`, className: `nt nt--${side}` }); b.setAttribute('aria-live', 'polite'); document.body.append(b); }
  return b;
}
export function notice({ side = 'left', kind = 'aviso', html, tone = 'ok', open = null, life = 0 }) {
  const box = ntBox(side), max = matchMedia('(max-width: 40rem)').matches ? 2 : 4;
  const c = document.createElement('div');
  c.className = 'nt__card'; c.dataset.tone = tone; c.dataset.kind = kind;
  c.innerHTML = `<div class="nt__body">${html}</div><div class="nt__acts">${open ? `<button type="button" class="nt__go">${open.label}</button>` : ''}<button type="button" class="nt__off">não mostrar</button></div><button type="button" class="nt__x" aria-label="fechar aviso">×</button>`;
  const close = () => { c.classList.add('is-out'); setTimeout(() => c.remove(), 250); };
  c.querySelector('.nt__x').onclick = close;
  c.querySelector('.nt__off').onclick = () => { ntSet(kind, false); for (const x of document.querySelectorAll(`.nt__card[data-kind="${kind}"]`)) x.remove(); say(kind === 'chat' ? 'Avisos de conversa desligados. Religue no seu perfil.' : 'Avisos do jogo desligados (erros ainda aparecem). Religue no seu perfil.'); };
  if (open) c.querySelector('.nt__go').onclick = () => { close(); open.fn(); };
  box.append(c);
  while (box.children.length > max) box.firstElementChild.remove();
  if (life) setTimeout(close, life);
  return c;
}
// central de avisos (sino no topo): tudo o que apareceu fica aqui (últimos 40). imp = conta no número do sino
export const FEED = [];
export function feed(item) { FEED.unshift({ at: Date.now(), ...item }); FEED.length = Math.min(FEED.length, 40); try { G.onFeed?.(); } catch {} }
export function say(msg, bad = false) {
  const el = $('#status'); if (el) el.textContent = msg;   // leitor de tela
  if (FEED[0]?.txt !== msg) feed({ txt: msg, bad });
  const off = ntOff('aviso');
  if (off && !bad) return;
  const box = ntBox('left'), last = box.lastElementChild;
  if (last?.dataset.msg === msg) { const n = last.querySelector('.nt__n'); last.dataset.k = (Number(last.dataset.k) || 1) + 1; n.textContent = ` ×${last.dataset.k}`; n.hidden = false; return; }   // repetido: só conta
  const c = notice({ side: 'left', kind: 'aviso', tone: bad ? 'bad' : 'ok', life: off ? 6000 : bad ? 9000 : 4500,   // some sozinho; fica no sino
    html: `<span class="nt__ico" aria-hidden="true">${bad ? '!' : '✓'}</span><p>${esc(msg)}<b class="nt__n" hidden></b></p>` });
  c.dataset.msg = msg;
}

// cartão dourado que entra pela direita (conquista, missão cumprida)
export function badge(title, sub, kind = 'ach') {
  const el = document.createElement('div');
  el.className = `badge badge--${kind}`;
  el.innerHTML = `<span class="badge__medal" aria-hidden="true"></span><div><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>`;
  ntBox('right').append(el);
  setTimeout(() => el.classList.add('is-out'), ms(8000) || 8000);
  setTimeout(() => el.remove(), (ms(8000) || 8000) + 600);
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
    acct: s.acct ? s.acct.plan : null,
    name: s.avatar.name || 'jogador', look: s.avatar, level: s.level, rank: PK.prestigeTop(s.trophies)?.title || L.rank(L.netWorth(s)), prest: PK.prestigeTop(s.trophies)?.id || '', worth: L.netWorth(s),
    stats: s.stats, ach: s.ach, lands: own.length, ha: own.reduce((a, l) => a + l.ha, 0), heads: L.heads(s),
    cars: s.cars.map(c => c.model),
    animals: (s.stable?.animals || []).map(a => ({ kind: a.kind, name: a.name, rating: ST.rating(a), wins: a.wins, ph: a.ph })),
    trophies: s.trophies || [], private: !!s.privateProfile && (s.trophies || []).includes(L.PRIVATE_MIN),
    landList: own.slice(0, 10).map(l => ({ region: l.region, ha: l.ha, orchard: !!l.orchard, cane: !!l.cane })),
    biz: ['usinas', 'hotel', 'air', 'boat', 'cars', 'jewel', 'food', 'realty', 'auction', 'banks', 'isps', 'markets'].flatMap(c => (s.biz?.[c] || []).map(b => ({ cat: c, brand: b.brand }))),
    mina: !!s.mina, wh: (s.biz?.wh || []).length, granja: (s.granja?.houses || []).length, suinos: (s.suinos?.barns || []).length,
    cardsN: (s.cards || []).length, colls: collsDone(s), prestige: collsPrestige(s), club: s.fut?.club || null,
    listings: (s.shop || []).slice(0, 12).map(l => ({ label: String(l.label || '').slice(0, 60), price: l.price, kind: l.kind })),
  };
}
