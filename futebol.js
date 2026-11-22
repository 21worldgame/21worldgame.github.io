// Gerente de futebol no estilo Brasfoot (regras puras, sem DOM).
// Clubes reais do futebol brasileiro (só o nome e as cores; sem escudos). Jogadores com nomes fictícios.
import * as PK from './perks.js';
import { newDeal } from './bots.js';
export const DIVS = ['Série A', 'Série B', 'Série C'];
// Valores da vida real (2025), na escala de um elenco de 18: clube médio fica perto do zero a zero (folha ~ receita);
// o lucro vem de terminar no G4, subir de divisão, ampliar o estádio e vender bem os jogadores. (Até a v150 o clube se pagava a cada temporada.)
export const PRICE = [150e6, 30e6, 8e6];             // assumir o comando (SAF) de um clube médio da divisão
export const OLD_PRICE = [6000000, 900000, 120000];  // preço antigo (até v150): devolvido a quem tinha clube na migração
export const FOUND_COST = PRICE[2];
export const TICKET = [1e6, 180000, 55000];          // bilheteria por jogo em casa (estádio nível 1)
export const WIN_PRIZE = [150000, 40000, 15000];     // prêmio por vitória
export const SPONSOR = [15e6, 3.2e6, 1.1e6];         // patrocínio + cota de TV pagos no início da temporada
export const SEASON_PRIZE = [[30e6, 18e6, 12e6, 8e6], [3.5e6, 2.2e6, 1.5e6, 1e6], [900000, 550000, 350000, 250000]];   // premiação por posição (G4)
export const POS = { GOL: 'goleiro', ZAG: 'zagueiro', LAT: 'lateral', VOL: 'volante', MEI: 'meia', ATA: 'atacante' };
export const FORMATIONS = { '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2], '4-5-1': [4, 5, 1] };
export const STYLES = { defensivo: [-0.06, 0.07], equilibrado: [0, 0], ofensivo: [0.07, -0.06], contra: [0.03, 0.03] };
export const STADIUM_MAX = 5;
const DEF = ['ZAG', 'LAT'], MID = ['VOL', 'MEI'];

// [nome, cor 1, cor 2, força]
const T = (n, a, b, r) => ({ n, c: [a, b], r });
export const CLUBS = [
  [T('Flamengo', '#c8102e', '#111', 84), T('Palmeiras', '#006437', '#fff', 84), T('Botafogo', '#111', '#fff', 80), T('Cruzeiro', '#0033a0', '#fff', 80), T('Fluminense', '#7a1631', '#00613c', 79),
   T('São Paulo', '#e4002b', '#111', 79), T('Atlético-MG', '#111', '#fff', 79), T('Internacional', '#e30613', '#fff', 78), T('Corinthians', '#111', '#fff', 78), T('Bahia', '#0057b8', '#e4002b', 78),
   T('Grêmio', '#0d80bf', '#111', 77), T('Vasco', '#111', '#fff', 77), T('Red Bull Bragantino', '#d50032', '#fff', 76), T('Santos', '#fff', '#111', 76), T('Mirassol', '#f7d117', '#007a33', 75),
   T('Athletico-PR', '#c8102e', '#111', 75), T('Vitória', '#e30613', '#111', 73), T('Coritiba', '#00563f', '#fff', 73), T('Chapecoense', '#00843d', '#fff', 71), T('Remo', '#0b2a6f', '#fff', 71)],
  [T('Fortaleza', '#0047ab', '#e4002b', 70), T('Ceará', '#111', '#fff', 69), T('Sport', '#c8102e', '#111', 69), T('Juventude', '#00843d', '#fff', 68), T('Goiás', '#00843d', '#fff', 67),
   T('Novorizontino', '#f7d117', '#111', 67), T('Cuiabá', '#00843d', '#f7d117', 66), T('Criciúma', '#f7d117', '#111', 66), T('América-MG', '#00843d', '#111', 66), T('Atlético-GO', '#c8102e', '#111', 65),
   T('CRB', '#c8102e', '#fff', 65), T('Avaí', '#0057b8', '#fff', 64), T('Vila Nova', '#c8102e', '#fff', 64), T('Operário-PR', '#111', '#fff', 64), T('Ponte Preta', '#111', '#fff', 63),
   T('Botafogo-SP', '#c8102e', '#111', 63), T('Náutico', '#c8102e', '#fff', 62), T('Athletic', '#111', '#f7d117', 62), T('Londrina', '#5bc2e7', '#fff', 61), T('São Bernardo', '#f7d117', '#111', 61)],
  [T('Paysandu', '#5bc2e7', '#fff', 60), T('Guarani', '#00843d', '#fff', 59), T('Figueirense', '#111', '#fff', 59), T('Amazonas', '#f7d117', '#111', 58), T('Ferroviária', '#7a1631', '#fff', 58),
   T('Volta Redonda', '#f7d117', '#111', 57), T('Ypiranga-RS', '#f7d117', '#00843d', 57), T('Brusque', '#00843d', '#f7d117', 56), T('CSA', '#0057b8', '#fff', 56), T('ABC', '#111', '#fff', 56),
   T('Botafogo-PB', '#111', '#fff', 55), T('Confiança', '#0057b8', '#fff', 55), T('Caxias', '#7a1631', '#fff', 55), T('Santa Cruz', '#c8102e', '#111', 54), T('Floresta', '#00843d', '#fff', 54),
   T('Itabaiana', '#0057b8', '#c8102e', 53), T('Maringá', '#111', '#fff', 53), T('Ituano', '#c8102e', '#111', 53), T('Anápolis', '#c8102e', '#fff', 52), T('Barra-SC', '#0057b8', '#fff', 52)],
];
export const club = name => CLUBS.flat().find(c => c.n === name);
export const divOf = name => CLUBS.findIndex(d => d.some(c => c.n === name));
const divAvg = d => CLUBS[d].reduce((t, c) => t + c.r, 0) / CLUBS[d].length;
// tamanho do clube: clube grande tem mais torcida, patrocínio e valor (mesma conta para preço, bilheteria e patrocínio)
export const bigness = (name, d = divOf(name)) => { const c = club(name); return !c || d < 0 ? 1 : 1.07 ** (c.r - divAvg(d)); };   // comparado com a divisão em que o clube joga
export const clubPrice = name => { const d = divOf(name); return d < 0 ? PRICE[2] : Math.round(PRICE[d] * bigness(name) / 1000) * 1000; };
export const sponsorOf = f => Math.round(SPONSOR[f.div] * bigness(f.club, f.div) / 1000) * 1000;   // patrocínio da temporada na divisão em que o clube está

const FIRST = ['Ademir', 'Bruno', 'Caio', 'Diego', 'Edu', 'Fábio', 'Gabriel', 'Hugo', 'Igor', 'João', 'Kauã', 'Léo', 'Marcos', 'Nando', 'Otávio', 'Pedro', 'Rafael', 'Samuel', 'Tiago', 'Vitor', 'Wesley', 'Yuri', 'Davi', 'Renan', 'Murilo', 'Luan', 'Enzo', 'Heitor', 'Matheus', 'Gustavo', 'Arthur', 'Ruan'];
const LAST = ['Silva', 'Souza', 'Costa', 'Lima', 'Rocha', 'Alves', 'Pereira', 'Gomes', 'Ribeiro', 'Martins', 'Barbosa', 'Moura', 'Teixeira', 'Freitas', 'Cardoso', 'Nunes', 'Mendes', 'Ramos', 'Pinto', 'Araújo', 'Vieira', 'Batista'];
const TRAITS = { GOL: ['reflexo', 'saída do gol', 'pênalti'], ZAG: ['desarme', 'cabeceio', 'marcação'], LAT: ['cruzamento', 'velocidade', 'apoio'], VOL: ['desarme', 'passe', 'resistência'], MEI: ['passe', 'drible', 'visão de jogo'], ATA: ['finalização', 'velocidade', 'cabeceio'] };

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// salário por mês: ~R$ 15 mil na Série C (força 55), ~R$ 170 mil num titular da Série A (75), ~R$ 500 mil numa estrela (84)
export const salary = ovr => Math.round(Math.max(3000, 15000 * 1.13 ** (ovr - 55)) / 100) * 100;
// valor de mercado: ~R$ 300 mil na Série C, ~R$ 5 mi num titular da Série A, ~R$ 17 mi numa estrela; jovem vale mais, veterano menos
export const value = p => Math.round((300000 * 1.15 ** (p.ovr - 55) * (p.age <= 23 ? 1.35 : p.age >= 31 ? 0.6 : 1) * (1 + Math.max(0, p.pot - p.ovr) / 60)) / 1000) * 1000;

let pid = 1;
export function genPlayer(pos, ovr, rng = Math.random) {
  const age = 17 + Math.floor(rng() * 17);
  const o = clamp(Math.round(ovr), 30, 95);
  const pot = clamp(o + (age <= 21 ? 8 + rng() * 14 : age <= 25 ? 2 + rng() * 8 : rng() * 2), o, 97);
  return { id: `j${Date.now().toString(36)}${pid++}`, name: `${pick(FIRST, rng)} ${pick(LAST, rng)}`, pos, age, ovr: o, pot: Math.round(pot), sal: salary(o), trait: pick(TRAITS[pos], rng) };
}
export function genSquad(avg, rng = Math.random) {
  const plan = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LAT', 'LAT', 'LAT', 'VOL', 'VOL', 'VOL', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA'];
  return plan.map(pos => genPlayer(pos, avg + (rng() - 0.5) * 14, rng));
}

// escalação automática: os melhores de cada setor (lesionado e suspenso ficam fora)
const out = p => p.inj || p.sus;
const SECTOR = { gk: p => p === 'GOL', def: p => DEF.includes(p), mid: p => MID.includes(p), att: p => p === 'ATA' };
export const SECTOR_LABEL = { gk: 'goleiro', def: 'defesa', mid: 'meio-campo', att: 'ataque' };
// as vagas da formação: gk0, def0..def3, mid0.., att0..
export function slots(formation = '4-4-2') {
  const [d, m, a] = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  return [['gk', 1], ['def', d], ['mid', m], ['att', a]].flatMap(([k, n]) => Array.from({ length: n }, (_, i) => `${k}${i}`));
}
// xi = { gk0: idDoJogador, def1: ... } escolhido pelo técnico; vaga vazia ou jogador fora (lesão/suspensão) completa sozinha.
// Jogador fora da posição dele rende 85% (fora do setor).
export function lineup(squad, formation = '4-4-2', xi = null) {
  const [d, m, a] = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  const res = { gk: Array(1), def: Array(d), mid: Array(m), att: Array(a) }, used = new Set();
  if (xi) for (const slot of slots(formation)) {
    const sec = slot.replace(/\d+$/, ''), i = +slot.slice(sec.length), p = xi[slot] && squad.find(x => x.id === xi[slot] && !out(x));
    if (p && !used.has(p.id)) { res[sec][i] = SECTOR[sec](p.pos) ? p : { ...p, ovr: p.ovr * 0.85, off: true }; used.add(p.id); }
  }
  for (const sec of ['gk', 'def', 'mid', 'att']) for (let i = 0; i < res[sec].length; i++) {
    if (res[sec][i]) continue;
    const p = squad.filter(x => SECTOR[sec](x.pos) && !used.has(x.id) && !out(x)).sort((x, y) => y.ovr - x.ovr)[0];
    if (p) { res[sec][i] = p; used.add(p.id); }
  }
  // falta gente num setor (lesão, venda): completa com quem sobrou, com nota reduzida
  for (const sec of ['gk', 'def', 'mid', 'att']) for (let i = 0; i < res[sec].length; i++) {
    if (res[sec][i]) continue;
    const x = squad.filter(p => !used.has(p.id) && !out(p)).sort((p, q) => q.ovr - p.ovr)[0];
    if (x) { used.add(x.id); res[sec][i] = { ...x, ovr: x.ovr * 0.8, off: true }; }
  }
  for (const sec of Object.keys(res)) res[sec] = res[sec].map(p => p || null);
  return res;
}
const avg = arr => { const v = arr.filter(Boolean); return v.length ? v.reduce((t, p) => t + p.ovr, 0) / arr.length : 30; };
export function strength(squad, formation = '4-4-2', style = 'equilibrado', morale = 0, xi = null) {
  const l = lineup(squad, formation, xi), [sa, sd] = STYLES[style] || [0, 0], m = 1 + morale * 0.03;
  const att = (avg(l.att) * 0.6 + avg(l.mid) * 0.4) * (1 + sa) * m;
  const def = (avg(l.def) * 0.6 + avg(l.gk) * 0.25 + avg(l.mid) * 0.15) * (1 + sd) * m;
  return { att, def, ovr: (att + def) / 2 };
}

function poisson(lambda, rng) { let L = Math.exp(-lambda), k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
export function simulate(h, a, rng = Math.random) {
  const lh = clamp(1.3 * (h.att / a.def) ** 2.2 * 1.12, 0.15, 5), la = clamp(1.3 * (a.att / h.def) ** 2.2 * 0.9, 0.15, 5);
  const hg = poisson(lh, rng), ag = poisson(la, rng);
  const ev = [];
  for (let i = 0; i < hg; i++) ev.push({ min: 1 + Math.floor(rng() * 90), side: 'h', kind: 'gol' });
  for (let i = 0; i < ag; i++) ev.push({ min: 1 + Math.floor(rng() * 90), side: 'a', kind: 'gol' });
  for (let i = 0, n = 3 + Math.floor(rng() * 5); i < n; i++) { const r = rng(); ev.push({ min: 1 + Math.floor(rng() * 90), side: rng() < lh / (lh + la) ? 'h' : 'a', kind: r < 0.62 ? 'chance' : r < 0.95 ? 'cartão' : 'vermelho' }); }
  ev.sort((x, y) => x.min - y.min);
  return { hg, ag, events: ev, xg: [lh, la] };
}

// turno e returno: método do círculo
export function fixtures(ids) {
  const t = [...ids], n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const games = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; games.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(games);
    t.splice(1, 0, t.pop());
  }
  return [...rounds, ...rounds.map(g => g.map(([a, b]) => [b, a]))];
}

// liga com os clubes reais da divisão (o seu entra no lugar dele ou de um sorteado)
export function newLeague(div, userClub, rng = Math.random) {
  const others = CLUBS[div].filter(c => c.n !== userClub).sort(() => rng() - 0.5).slice(0, 19);
  const teams = [{ id: 'user', name: userClub, user: true }, ...others.map((c, i) => ({ id: `c${i}`, name: c.n, rating: c.r + (rng() - 0.5) * 4, colors: c.c }))];
  const table = Object.fromEntries(teams.map(t => [t.id, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  return { div, teams, table, fixtures: fixtures(teams.map(t => t.id)), round: 0, results: [] };
}
export const zone = lg => (lg.teams.length >= 20 ? 4 : 2);       // quantos sobem e quantos caem
export const standings = lg => lg.teams.map(t => ({ ...t, ...lg.table[t.id] }))
  .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
const teamStr = (f, id) => (id === 'user' ? strength(f.squad, f.formation, f.style, f.morale || 0, f.xi) : { att: f.league.teams.find(t => t.id === id).rating, def: f.league.teams.find(t => t.id === id).rating });

// contrato: quem assume um clube fica com ele (e com o elenco que veio junto) por 12 meses do mundo antes de vender
export const CONTRACT = 12;
export const contractLeft = s => (s.fut?.since == null ? 0 : Math.max(0, s.fut.since + CONTRACT - (s.month || 1)));
export const lockedPlayer = (s, p) => !!p?.ct && contractLeft(s) > 0;
export const lockMsg = s => `contrato de ${CONTRACT} meses com o clube: faltam ${contractLeft(s)} ${contractLeft(s) === 1 ? 'mês' : 'meses'} para vender o clube ou o elenco que veio com ele.`;
const signed = squad => squad.map(p => ({ ...p, ct: true }));

// assumir o comando de um clube real
export function takeClub(s, name, rng = Math.random) {
  if (s.fut?.club) return 'você já comanda um clube.';
  const c = club(name);
  if (!c) return 'escolha um clube da lista.';
  const cost = clubPrice(name);
  if (s.money < cost) return 'dinheiro insuficiente para assumir esse clube.';
  s.money -= cost;
  const div = divOf(name);
  s.fut = { club: c.n, colors: c.c, div, season: 1, formation: '4-4-2', style: 'equilibrado', squad: [...signed(genSquad(c.r - 3, rng)), ...(s.freeAgents || [])], market: [], offers: [], history: [], earned: 0, trophies: 0, stadium: 1, morale: 0, since: s.month || 1, real: true };
  s.freeAgents = [];
  s.fut.league = newLeague(div, c.n, rng);
  const sp = sponsorOf(s.fut); s.money += sp; s.fut.earned += sp;
  refreshMarket(s.fut, rng);
  return null;
}

// migração v151 (preços reais): clube da escala antiga é devolvido pelo preço antigo; o jogador compra de novo no preço real.
// Sem isso o elenco antigo seria vendido pelo valor novo (15 a 30 vezes maior). Devolve o valor reembolsado (0 = nada a fazer).
export function migrate(s) {
  if (!s.fut?.club || s.fut.real) return 0;
  const d = divOf(s.fut.club), v = d < 0 ? OLD_PRICE[2] : Math.round(OLD_PRICE[d] * bigness(s.fut.club) / 1000) * 1000;
  s.money = (Number(s.money) || 0) + v;
  s.shop = (s.shop || []).filter(l => !/^(player|club):/.test(l.key || ''));
  delete s.fut; s.freeAgents = [];
  return v;
}
// clube comprado de outro jogador no Feirão: mesmo clube, elenco, estádio e títulos; temporada nova
export function adoptClub(s, d, rng = Math.random) {
  if (s.fut?.club) return 'você já comanda um clube.';
  const c = club(d.club); if (!c) return 'clube inválido.';
  const div = divOf(c.n);
  s.fut = { club: c.n, colors: c.c, div, season: 1, formation: '4-4-2', style: 'equilibrado', squad: [...signed(d.squad || []), ...(s.freeAgents || [])], market: [], offers: [], history: [], earned: 0, trophies: d.trophies || 0, stadium: d.stadium || 1, morale: 0, since: s.month || 1, real: true };
  s.freeAgents = []; s.fut.league = newLeague(div, c.n, rng); refreshMarket(s.fut, rng);
  return null;
}
export function refreshMarket(f, rng = Math.random) {
  const base = [76, 65, 56][f.div];
  f.market = Object.keys(POS).flatMap(pos => [genPlayer(pos, base + (rng() - 0.3) * 18, rng), genPlayer(pos, base + (rng() - 0.6) * 14, rng), genPlayer(pos, base - 8 + rng() * 6, rng)])
    .map(p => ({ ...p, price: value(p), club: pick(CLUBS[f.div], rng).n }));
}
// compra a preço de tabela (ou pelo preço negociado com o bot)
export function buy(s, id, price) {
  const f = s.fut, p = f?.market.find(x => x.id === id);
  if (!p) return 'jogador não está mais à venda.';
  if (f.squad.length >= 28) return 'elenco cheio (28). Venda alguém antes.';
  const cost = Math.round(price ?? p.price);
  if (cost > s.money) return 'dinheiro insuficiente.';
  s.money -= cost; f.market.splice(f.market.indexOf(p), 1);
  const { price: _, club: __, ...player } = p; f.squad.push(player);
  return null;
}
// piso da compra negociada e teto das propostas de clubes (abaixo do piso): comprar e revender jogador nunca dá lucro
export const BUY_FLOOR = 0.95, OFFER_MAX = 0.94;
export const dealFor = (f, id, rng = Math.random) => { const p = f.market.find(x => x.id === id); return p ? (d => (d.limit = Math.max(d.limit, Math.round(d.ask * BUY_FLOOR)), d))(newDeal(p.price, rng, 'sell')) : null; };   // nunca compra abaixo de 95% do valor
export function sell(s, id, price) {
  const f = s.fut, p = f?.squad.find(x => x.id === id);
  if (!p) return 0;
  if (f.squad.length <= 14) return -1;
  if (lockedPlayer(s, p)) return -2;
  const v = Math.round(price ?? value(p) * 0.8);
  s.money += v; f.squad.splice(f.squad.indexOf(p), 1);
  f.offers = (f.offers || []).filter(o => o.pid !== id);
  return v;
}
export const payroll = f => f.squad.reduce((t, p) => t + salary(p.ovr), 0);   // sempre pela tabela atual
export const stadiumCost = f => TICKET[f.div] * 8 * (f.stadium || 1);
export function upgradeStadium(s) {
  const f = s.fut;
  if ((f.stadium || 1) >= STADIUM_MAX) return 'estádio já está no nível máximo.';
  const c = stadiumCost(f);
  if (s.money < c) return 'dinheiro insuficiente para a reforma.';
  s.money -= c; f.stadium = (f.stadium || 1) + 1;
  return null;
}
// clubes-bot fazem propostas pelos seus jogadores (aceite ou recuse até 2 rodadas)
function botOffers(s, rng) {
  const f = s.fut;
  f.offers = (f.offers || []).filter(o => o.until > f.league.round && f.squad.some(p => p.id === o.pid));
  if (f.offers.length >= 3 || rng() > 0.3) return;
  const p = f.squad.filter(x => !lockedPlayer(s, x)).sort((a, b) => b.ovr - a.ovr)[Math.floor(rng() * 6)];
  if (!p || f.offers.some(o => o.pid === p.id)) return;
  const buyer = pick(CLUBS[Math.max(0, f.div - (rng() < 0.4 ? 1 : 0))].filter(c => c.n !== f.club), rng);
  f.offers.push({ id: `o${Date.now().toString(36)}${pid++}`, pid: p.id, name: p.name, club: buyer.n, amount: Math.round(value(p) * (0.75 + rng() * (OFFER_MAX - 0.75)) / 1000) * 1000, until: f.league.round + 2 });
}
export function answerOffer(s, oid, yes) {
  const f = s.fut, o = (f.offers || []).find(x => x.id === oid);
  if (!o) return { err: 'proposta expirou.' };
  f.offers = f.offers.filter(x => x !== o);
  if (!yes) return { ok: true };
  const v = sell(s, o.pid, o.amount);
  return v === -2 ? { err: lockMsg(s) } : v < 0 ? { err: 'o elenco precisa de pelo menos 14 jogadores.' } : { ok: true, amount: v, offer: o };
}

// quem marcou: atacantes e meias têm mais chance
function scorer(l, rng) {
  const pool = [...l.att.filter(Boolean).map(p => [p, 5]), ...l.mid.filter(Boolean).map(p => [p, 2]), ...l.def.filter(Boolean).map(p => [p, 0.6])];
  let r = rng() * pool.reduce((t, [, w]) => t + w, 0);
  for (const [p, w] of pool) if ((r -= w) <= 0) return p;
  return pool[0]?.[0];
}

// uma rodada = uma semana do mundo: no máximo 4 por mês (antes dava para simular a temporada inteira em segundos e repetir prêmio/patrocínio)
export const ROUNDS_PER_MONTH = 4;
export const roundsLeft = s => (s.fut?.wk?.m === (s.month || 1) ? Math.max(0, ROUNDS_PER_MONTH - s.fut.wk.n) : ROUNDS_PER_MONTH);
export function playRound(s, rng = Math.random, prizeMult = 1) {
  const f = s.fut, lg = f.league;
  if (lg.round >= lg.fixtures.length) return null;
  if (!roundsLeft(s)) return { err: 'sem rodadas neste mês do mundo: são 4 jogos por mês (o relógio no topo mostra quando o próximo mês chega).' };
  f.wk = { m: s.month || 1, n: ROUNDS_PER_MONTH - roundsLeft(s) + 1 };
  const games = lg.fixtures[lg.round], results = [];
  let mine = null, cash = 0;
  for (const [h, a] of games) {
    const r = simulate(teamStr(f, h), teamStr(f, a), rng);
    const th = lg.table[h], ta = lg.table[a];
    th.p++; ta.p++; th.gf += r.hg; th.ga += r.ag; ta.gf += r.ag; ta.ga += r.hg;
    if (r.hg > r.ag) { th.w++; ta.l++; th.pts += 3; } else if (r.hg < r.ag) { ta.w++; th.l++; ta.pts += 3; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
    const g = { h, a, hn: lg.teams.find(t => t.id === h).name, an: lg.teams.find(t => t.id === a).name, ...r };
    results.push(g);
    if (h === 'user' || a === 'user') mine = g;
  }
  for (const p of f.squad) if (p.sus) p.sus--;                 // cumpriu a suspensão desta rodada
  const lines = [];
  if (mine) {
    const home = mine.h === 'user', side = home ? 'h' : 'a', my = home ? mine.hg : mine.ag, their = home ? mine.ag : mine.hg;
    const l = lineup(f.squad, f.formation, f.xi);
    for (const e of mine.events) if (e.side === side) {
      if (e.kind === 'gol') e.who = scorer(l, rng)?.name;
      if (e.kind === 'vermelho') { const all = [...l.def, ...l.mid, ...l.att].filter(Boolean), p = all[Math.floor(rng() * all.length)], real = p && f.squad.find(x => x.id === p.id); if (real) { real.sus = 2; e.who = real.name; } }
    }
    if (home) {
      const t = Math.round(TICKET[f.div] * bigness(f.club, f.div) * (1 + 0.2 * ((f.stadium || 1) - 1)) * PK.mult(s, 'ticket') * (0.7 + Math.min(0.6, lg.table.user.pts / Math.max(1, lg.table.user.p) / 5)));
      cash += t; lines.push({ txt: 'bilheteria', val: t });
    }
    if (my > their) { const w = Math.round(WIN_PRIZE[f.div] * prizeMult); cash += w; lines.push({ txt: 'prêmio por vitória', val: w }); }
    f.morale = clamp((f.morale || 0) + (my > their ? 1 : my < their ? -1 : 0), -3, 3);
  }
  const wages = Math.round(payroll(f) / 4);
  cash -= wages; lines.push({ txt: 'salários do elenco', val: -wages });
  s.money += cash; f.earned += cash;
  for (const p of f.squad) { if (p.inj) p.inj--; else if (rng() < 0.02) p.inj = 1 + Math.floor(rng() * 3); }
  lg.round++;
  lg.results = results;
  botOffers(s, rng);
  return { mine, games: results, cash, lines, done: lg.round >= lg.fixtures.length };
}

// fim da temporada: prêmio pela posição, acesso e rebaixamento, jogadores evoluem ou envelhecem, novo patrocínio
export function endSeason(s, rng = Math.random, prizeMult = 1) {
  const f = s.fut, st = standings(f.league), pos = st.findIndex(t => t.user) + 1, z = zone(f.league), n = st.length;
  const prize = Math.round((SEASON_PRIZE[f.div][pos - 1] || 0) * prizeMult);
  s.money += prize; f.earned += prize;
  let move = 0;
  if (pos <= z && f.div > 0) move = -1;
  if (pos > n - z && f.div < 2) move = 1;
  if (pos === 1) f.trophies++;
  f.history.unshift({ season: f.season, div: f.div, pos, pts: f.league.table.user.pts, prize });
  f.div += move; f.season++;
  for (const p of f.squad) {
    p.age++;
    if (p.age <= 23) p.ovr = Math.min(p.pot, p.ovr + 1 + Math.floor(rng() * 4));
    else if (p.age >= 31) p.ovr = Math.max(30, p.ovr - Math.floor(rng() * 4));
    p.sal = salary(p.ovr); p.inj = 0; p.sus = 0;
  }
  f.league = newLeague(f.div, f.club, rng);
  f.offers = [];
  const sponsor = sponsorOf(f); s.money += sponsor; f.earned += sponsor;
  refreshMarket(f, rng);
  return { pos, prize, move, sponsor };
}

export function setSlot(f, slot, id) {
  if (!slots(f.formation).includes(slot)) return 'vaga inválida.';
  f.xi ??= {};
  if (!id) { delete f.xi[slot]; return null; }
  if (!f.squad.some(p => p.id === id)) return 'jogador não está no elenco.';
  for (const k of Object.keys(f.xi)) if (f.xi[k] === id) delete f.xi[k];      // sai da vaga anterior
  f.xi[slot] = id;
  return null;
}
