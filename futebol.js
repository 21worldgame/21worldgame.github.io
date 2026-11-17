// Gerente de clube de futebol (regras puras, sem DOM). Clubes e jogadores fictícios.
export const DIVS = ['Série A', 'Série B', 'Série C'];
export const FOUND_COST = 80000;
export const TICKET = [380000, 110000, 26000];      // bilheteria por jogo em casa
export const WIN_PRIZE = [140000, 45000, 9000];     // prêmio por vitória
export const SEASON_PRIZE = [[4000000, 2200000, 1200000], [900000, 500000, 250000], [220000, 120000, 60000]];
export const POS = { GOL: 'goleiro', ZAG: 'zagueiro', LAT: 'lateral', VOL: 'volante', MEI: 'meia', ATA: 'atacante' };
export const FORMATIONS = { '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2], '5-3-2': [5, 3, 2], '4-5-1': [4, 5, 1] };
export const STYLES = { defensivo: [-0.06, 0.07], equilibrado: [0, 0], ofensivo: [0.07, -0.06] };
const DEF = ['ZAG', 'LAT'], MID = ['VOL', 'MEI'];

const FIRST = ['Ademir', 'Bruno', 'Caio', 'Diego', 'Edu', 'Fábio', 'Gabriel', 'Hugo', 'Igor', 'João', 'Kauã', 'Léo', 'Marcos', 'Nando', 'Otávio', 'Pedro', 'Rafael', 'Samuel', 'Tiago', 'Vitor', 'Wesley', 'Yuri', 'Davi', 'Renan', 'Murilo', 'Luan', 'Enzo', 'Heitor'];
const LAST = ['Silva', 'Souza', 'Costa', 'Lima', 'Rocha', 'Alves', 'Pereira', 'Gomes', 'Ribeiro', 'Martins', 'Barbosa', 'Moura', 'Teixeira', 'Freitas', 'Cardoso', 'Nunes', 'Mendes', 'Ramos', 'Pinto', 'Araújo'];
const CLUBS = ['Atlético Serrano', 'Grêmio Litorâneo', 'União Cafeeira', 'Esporte Clube Vale Verde', 'Ferroviário do Planalto', 'Real Cerrado', 'Operário da Serra', 'Náutico Ribeirinho',
  'Comercial Pantaneiro', 'Cruzeiro do Agreste', 'Botafogo do Sertão', 'Independente Mineiro', 'Associação Canavieira', 'América Fluvial', 'Tupi Paulista', 'Guarani do Litoral',
  'Juventude Gaúcha', 'Santa Rita FC', 'Rio Claro Esporte', 'Ipiranga Central', 'Colorado do Norte', 'Paraná Valente', 'Sport Amazonas', 'Bragança Futebol', 'Vila Nova Alegre',
  'Coritiba do Vale', 'Fortaleza do Mar', 'Ceará Unido', 'Goiânia Esporte', 'Maringá Atlético'];

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const salary = ovr => Math.round(Math.max(400, (ovr - 30) ** 2 * 3) / 10) * 10;
export const value = p => Math.round((4000 * 1.11 ** (p.ovr - 40) * (p.age <= 23 ? 1.35 : p.age >= 31 ? 0.6 : 1) * (1 + Math.max(0, p.pot - p.ovr) / 60)) / 100) * 100;

let pid = 1;
export function genPlayer(pos, ovr, rng = Math.random) {
  const age = 17 + Math.floor(rng() * 17);
  const o = clamp(Math.round(ovr), 30, 95);
  const pot = clamp(o + (age <= 21 ? 8 + rng() * 14 : age <= 25 ? 2 + rng() * 8 : rng() * 2), o, 97);
  return { id: `j${Date.now().toString(36)}${pid++}`, name: `${pick(FIRST, rng)} ${pick(LAST, rng)}`, pos, age, ovr: o, pot: Math.round(pot), sal: salary(o) };
}
export function genSquad(avg, rng = Math.random) {
  const plan = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LAT', 'LAT', 'LAT', 'VOL', 'VOL', 'VOL', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA'];
  return plan.map(pos => genPlayer(pos, avg + (rng() - 0.5) * 14, rng));
}

// escalação automática: os melhores de cada setor para a formação
export function lineup(squad, formation = '4-4-2') {
  const [d, m, a] = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  const best = (ok, n, used) => squad.filter(p => ok(p.pos) && !used.has(p.id) && !p.inj).sort((x, y) => y.ovr - x.ovr).slice(0, n);
  const used = new Set(), take = arr => { arr.forEach(p => used.add(p.id)); return arr; };
  const gk = take(best(p => p === 'GOL', 1, used));
  const def = take(best(p => DEF.includes(p), d, used));
  const mid = take(best(p => MID.includes(p), m, used));
  const att = take(best(p => p === 'ATA', a, used));
  // falta gente num setor (lesão, venda): completa com quem sobrou, com nota reduzida
  const fill = (arr, n) => { while (arr.length < n) { const x = squad.filter(p => !used.has(p.id) && !p.inj).sort((p, q) => q.ovr - p.ovr)[0]; if (!x) break; used.add(x.id); arr.push({ ...x, ovr: x.ovr * 0.8 }); } return arr; };
  return { gk: fill(gk, 1), def: fill(def, d), mid: fill(mid, m), att: fill(att, a) };
}
const avg = arr => (arr.length ? arr.reduce((t, p) => t + p.ovr, 0) / arr.length : 30);
export function strength(squad, formation = '4-4-2', style = 'equilibrado') {
  const l = lineup(squad, formation), [sa, sd] = STYLES[style] || [0, 0];
  const att = (avg(l.att) * 0.6 + avg(l.mid) * 0.4) * (1 + sa);
  const def = (avg(l.def) * 0.6 + avg(l.gk) * 0.25 + avg(l.mid) * 0.15) * (1 + sd);
  return { att, def, ovr: (att + def) / 2 };
}

function poisson(lambda, rng) { let L = Math.exp(-lambda), k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
// partida: gols esperados pela força de ataque contra defesa; mandante tem vantagem
export function simulate(h, a, rng = Math.random) {
  const lh = clamp(1.3 * (h.att / a.def) ** 2.2 * 1.12, 0.15, 5), la = clamp(1.3 * (a.att / h.def) ** 2.2 * 0.9, 0.15, 5);
  const hg = poisson(lh, rng), ag = poisson(la, rng);
  const ev = [];
  for (let i = 0; i < hg; i++) ev.push({ min: 1 + Math.floor(rng() * 90), side: 'h', kind: 'gol' });
  for (let i = 0; i < ag; i++) ev.push({ min: 1 + Math.floor(rng() * 90), side: 'a', kind: 'gol' });
  for (let i = 0, n = 3 + Math.floor(rng() * 5); i < n; i++) ev.push({ min: 1 + Math.floor(rng() * 90), side: rng() < lh / (lh + la) ? 'h' : 'a', kind: rng() < 0.7 ? 'chance' : 'cartão' });
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

export function newLeague(div, userClub, rng = Math.random) {
  const base = [78, 66, 54][div];
  const names = [...CLUBS].filter(n => n !== userClub).sort(() => rng() - 0.5).slice(0, 9);
  const teams = [{ id: 'user', name: userClub, user: true }, ...names.map((name, i) => ({ id: `c${i}`, name, rating: base + (rng() - 0.5) * 12 }))];
  const table = Object.fromEntries(teams.map(t => [t.id, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  return { div, teams, table, fixtures: fixtures(teams.map(t => t.id)), round: 0, results: [] };
}
export const standings = lg => lg.teams.map(t => ({ ...t, ...lg.table[t.id] }))
  .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
const teamStr = (f, id) => (id === 'user' ? strength(f.squad, f.formation, f.style) : { att: f.league.teams.find(t => t.id === id).rating, def: f.league.teams.find(t => t.id === id).rating });

export function foundClub(s, name, rng = Math.random) {
  if (s.fut?.club) return 'você já tem um clube.';
  const n = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 28);
  if (n.length < 3) return 'dê um nome de 3 a 28 letras ao clube.';
  if (s.money < FOUND_COST) return 'dinheiro insuficiente para fundar o clube.';
  s.money -= FOUND_COST;
  s.fut = { club: n, div: 2, season: 1, formation: '4-4-2', style: 'equilibrado', squad: genSquad(52, rng), market: [], history: [], earned: 0, trophies: 0 };
  s.fut.league = newLeague(2, n, rng);
  refreshMarket(s.fut, rng);
  return null;
}

export function refreshMarket(f, rng = Math.random) {
  const base = [74, 63, 54][f.div];
  f.market = Object.keys(POS).flatMap(pos => [genPlayer(pos, base + (rng() - 0.3) * 18, rng), genPlayer(pos, base + (rng() - 0.6) * 14, rng)]).map(p => ({ ...p, price: value(p) }));
}
export function buy(s, id) {
  const f = s.fut, p = f?.market.find(x => x.id === id);
  if (!p) return 'jogador não está mais à venda.';
  if (f.squad.length >= 26) return 'elenco cheio (26). Venda alguém antes.';
  if (p.price > s.money) return 'dinheiro insuficiente.';
  s.money -= p.price; f.market.splice(f.market.indexOf(p), 1);
  const { price, ...player } = p; f.squad.push(player);
  return null;
}
export function sell(s, id) {
  const f = s.fut, p = f?.squad.find(x => x.id === id);
  if (!p) return 0;
  if (f.squad.length <= 14) return -1;
  const v = Math.round(value(p) * 0.8);
  s.money += v; f.squad.splice(f.squad.indexOf(p), 1);
  return v;
}
export const payroll = f => f.squad.reduce((t, p) => t + p.sal, 0);

// joga a rodada inteira; devolve o jogo do usuário (para o ao vivo) e o resumo financeiro
export function playRound(s, rng = Math.random, prizeMult = 1) {
  const f = s.fut, lg = f.league;
  if (lg.round >= lg.fixtures.length) return null;
  const games = lg.fixtures[lg.round], out = [];
  let mine = null, cash = 0;
  for (const [h, a] of games) {
    const r = simulate(teamStr(f, h), teamStr(f, a), rng);
    const th = lg.table[h], ta = lg.table[a];
    th.p++; ta.p++; th.gf += r.hg; th.ga += r.ag; ta.gf += r.ag; ta.ga += r.hg;
    if (r.hg > r.ag) { th.w++; ta.l++; th.pts += 3; } else if (r.hg < r.ag) { ta.w++; th.l++; ta.pts += 3; } else { th.d++; ta.d++; th.pts++; ta.pts++; }
    const g = { h, a, hn: lg.teams.find(t => t.id === h).name, an: lg.teams.find(t => t.id === a).name, ...r };
    out.push(g);
    if (h === 'user' || a === 'user') mine = g;
  }
  const lines = [];
  if (mine) {
    const home = mine.h === 'user', my = home ? mine.hg : mine.ag, their = home ? mine.ag : mine.hg;
    if (home) { const t = Math.round(TICKET[f.div] * (0.7 + Math.min(0.6, lg.table.user.pts / Math.max(1, lg.table.user.p) / 5))); cash += t; lines.push({ txt: 'bilheteria', val: t }); }
    if (my > their) { const w = Math.round(WIN_PRIZE[f.div] * prizeMult); cash += w; lines.push({ txt: 'prêmio por vitória', val: w }); }
  }
  const wages = Math.round(payroll(f) / 4);                 // salários: 4 rodadas por mês
  cash -= wages; lines.push({ txt: 'salários do elenco', val: -wages });
  s.money += cash; f.earned += cash;
  // lesões curtas
  for (const p of f.squad) { if (p.inj) p.inj--; else if (rng() < 0.02) p.inj = 1 + Math.floor(rng() * 3); }
  lg.round++;
  lg.results = out;
  return { mine, games: out, cash, lines, done: lg.round >= lg.fixtures.length };
}

// fim da temporada: prêmio pela posição, sobe 2 e cai 2, jogadores evoluem ou envelhecem
export function endSeason(s, rng = Math.random, prizeMult = 1) {
  const f = s.fut, st = standings(f.league), pos = st.findIndex(t => t.user) + 1;
  const prize = Math.round((SEASON_PRIZE[f.div][pos - 1] || 0) * prizeMult);
  s.money += prize; f.earned += prize;
  let move = 0;
  if (pos <= 2 && f.div > 0) move = -1;
  if (pos >= 9 && f.div < 2) move = 1;
  if (pos === 1) f.trophies++;
  f.history.unshift({ season: f.season, div: f.div, pos, pts: f.league.table.user.pts, prize });
  f.div += move; f.season++;
  for (const p of f.squad) {
    p.age++;
    if (p.age <= 23) p.ovr = Math.min(p.pot, p.ovr + 1 + Math.floor(rng() * 4));
    else if (p.age >= 31) p.ovr = Math.max(30, p.ovr - Math.floor(rng() * 4));
    p.sal = salary(p.ovr); p.inj = 0;
  }
  f.league = newLeague(f.div, f.club, rng);
  refreshMarket(f, rng);
  return { pos, prize, move };
}
