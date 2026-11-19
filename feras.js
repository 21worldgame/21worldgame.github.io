// Feras 21 (regras puras): criaturas ORIGINAIS do 21 World que caçam sozinhas enquanto a tela está aberta.
// Cada fera derrotada dá gemas e experiência; de vez em quando uma fera selvagem é capturada (as raras valem muito).
// Gemas viram dinheiro (com limite por dia, para não quebrar a economia). Feras podem ser vendidas na loja.
export const ELEMENTS = { fogo: '#f97316', agua: '#0ea5e9', planta: '#22c55e', raio: '#facc15', pedra: '#a8a29e', sombra: '#8b5cf6' };
export const BEATS = { fogo: 'planta', planta: 'agua', agua: 'fogo', raio: 'agua', pedra: 'raio', sombra: 'sombra' };
export const RARITY = {
  comum: { label: 'comum', w: 70, value: 2500, mult: 1, color: '#94a3b8' },
  incomum: { label: 'incomum', w: 22, value: 9000, mult: 1.2, color: '#22c55e' },
  raro: { label: 'raro', w: 6.5, value: 45000, mult: 1.5, color: '#3b82f6' },
  epico: { label: 'épico', w: 1.3, value: 220000, mult: 1.9, color: '#a855f7' },
  lendario: { label: 'lendário', w: 0.2, value: 1500000, mult: 2.6, color: '#f59e0b' },
};
const S = (id, name, el, rar, atk, hp) => ({ id, name, el, rar, atk, hp });
export const SPECIES = [
  S('brasinha', 'Brasinha', 'fogo', 'comum', 11, 52), S('chamarrao', 'Chamarrão', 'fogo', 'raro', 15, 64), S('vulcanor', 'Vulcanor', 'fogo', 'epico', 19, 80),
  S('bolhudo', 'Bolhudo', 'agua', 'comum', 9, 60), S('marejo', 'Marejo', 'agua', 'incomum', 12, 70), S('tsunamix', 'Tsunamix', 'agua', 'epico', 17, 92),
  S('brotim', 'Brotim', 'planta', 'comum', 9, 62), S('folhagor', 'Folhagor', 'planta', 'incomum', 12, 74), S('raizeiro', 'Raizeiro', 'planta', 'raro', 14, 88),
  S('zapito', 'Zapito', 'raio', 'comum', 12, 46), S('trovoar', 'Trovoar', 'raio', 'incomum', 15, 56), S('relampejo', 'Relampejo', 'raio', 'raro', 18, 64),
  S('seixo', 'Seixo', 'pedra', 'comum', 8, 72), S('rochedo', 'Rochedo', 'pedra', 'incomum', 10, 90), S('montanhor', 'Montanhor', 'pedra', 'epico', 14, 120),
  S('sombrito', 'Sombrito', 'sombra', 'incomum', 13, 54), S('eclipsor', 'Eclipsor', 'sombra', 'epico', 19, 76), S('solarion', 'Solarion', 'fogo', 'lendario', 24, 110), S('kraquion', 'Kraquion', 'agua', 'lendario', 21, 140),
];
export const STARTERS = ['brasinha', 'bolhudo', 'brotim'];
export const ROUTES = [
  { id: 'campo', name: 'Campo Verde', lv: [1, 8], gems: 1, luck: 1, need: 1 },
  { id: 'floresta', name: 'Floresta Funda', lv: [8, 20], gems: 3, luck: 1.6, need: 8 },
  { id: 'vulcao', name: 'Vulcão Rubro', lv: [20, 38], gems: 7, luck: 2.6, need: 20 },
  { id: 'abismo', name: 'Abismo Sombrio', lv: [38, 60], gems: 15, luck: 4, need: 38 },
];
export const GEM_RS = 3, DAILY_CAP = 60000, MAX_TEAM = 3, CATCH = 0.035, MAX_BOX = 40;
export const sp = id => SPECIES.find(x => x.id === id) || SPECIES[0];
export const xpNeed = lv => Math.round(20 * lv ** 1.6);
export const stats = f => { const s = sp(f.sp), m = RARITY[s.rar].mult, k = 1 + (f.lv - 1) * 0.13; return { atk: s.atk * m * k, hp: s.hp * m * k }; };
export const value = f => Math.round(RARITY[sp(f.sp).rar].value * (1 + (f.lv - 1) * 0.04) / 100) * 100;
export const teamLv = st => Math.max(1, ...st.box.filter(f => st.team.includes(f.id)).map(f => f.lv));
let uid = 0;
const newFera = (id, lv) => ({ id: `f${Date.now().toString(36)}${(uid++).toString(36)}`, sp: id, lv, xp: 0 });
export function ensure(s) { s.feras ??= { box: [], team: [], gems: 0, route: 'campo', kills: 0, sold: { day: '', rs: 0 } }; return s.feras; }
export function start(s, id) {
  const st = ensure(s); if (st.box.length) return 'você já tem feras.';
  if (!STARTERS.includes(id)) return 'escolha uma das três iniciais.';
  const f = newFera(id, 3); st.box.push(f); st.team = [f.id]; return null;
}
// fera selvagem da rota (nível e espécie sorteados)
export function wild(route, rng = Math.random, cap = 99) {
  const R = ROUTES.find(r => r.id === route) || ROUTES[0];
  const pool = SPECIES.filter(x => x.rar === 'comum' || x.rar === 'incomum' || rng() < 0.25 * R.luck);
  const s = pool[Math.floor(rng() * pool.length)], lv = Math.max(R.lv[0], Math.min(cap + 1, R.lv[0] + Math.floor(rng() * (R.lv[1] - R.lv[0] + 1))));   // a selvagem acompanha o seu time
  const f = { sp: s.id, lv }; const t = stats(f); return { ...f, hp: t.hp * 0.8, max: t.hp * 0.8, atk: t.atk };
}
// dano por segundo do time contra uma fera (vantagem de elemento +40%)
export function dps(st, foe) {
  return st.box.filter(f => st.team.includes(f.id)).reduce((t, f) => t + stats(f).atk * (BEATS[sp(f.sp).el] === sp(foe.sp).el ? 1.4 : 1), 0);
}
// sorteia a raridade de uma captura (rotas mais fundas aumentam a chance das raras)
export function rollRarity(luck, rng = Math.random) {
  const ent = Object.entries(RARITY).map(([k, r]) => [k, k === 'comum' ? r.w : r.w * luck]), tot = ent.reduce((t, [, w]) => t + w, 0);
  let r = rng() * tot; for (const [k, w] of ent) if ((r -= w) < 0) return k; return 'comum';
}
// uma fera derrotada: gemas, experiência e chance de captura
export function defeat(s, foe, rng = Math.random) {
  const st = ensure(s), R = ROUTES.find(r => r.id === st.route) || ROUTES[0], out = { gems: 0, ups: [], caught: null };
  out.gems = Math.round(R.gems * (1 + foe.lv / 25) * 10) / 10; st.gems = Math.round((st.gems + out.gems) * 10) / 10; st.kills++;
  for (const f of st.box.filter(x => st.team.includes(x.id))) {
    f.xp += Math.round(6 + foe.lv * 2.2);
    while (f.xp >= xpNeed(f.lv) && f.lv < 70) { f.xp -= xpNeed(f.lv); f.lv++; out.ups.push(f); }
  }
  if (rng() < CATCH * (0.6 + R.luck * 0.4) && st.box.length < MAX_BOX) {
    const rar = rollRarity(R.luck, rng), opts = SPECIES.filter(x => x.rar === rar), s2 = opts[Math.floor(rng() * opts.length)];
    const f = newFera(s2.id, Math.max(1, foe.lv - 2)); st.box.push(f); out.caught = f;
  }
  return out;
}
export function setTeam(s, ids) { const st = ensure(s); st.team = ids.filter(id => st.box.some(f => f.id === id)).slice(0, MAX_TEAM); return st.team; }
export function setRoute(s, id) { const st = ensure(s), R = ROUTES.find(r => r.id === id); if (!R) return 'rota inválida.'; if (teamLv(st) < R.need) return `essa rota pede uma fera nível ${R.need} no time.`; st.route = id; return null; }
// troca gemas por dinheiro, com limite diário
export function exchange(s, gems, today) {
  const st = ensure(s); gems = Math.floor(Math.min(gems, st.gems)); if (gems <= 0) return { err: 'sem gemas para trocar.' };
  if (st.sold.day !== today) st.sold = { day: today, rs: 0 };
  const room = Math.max(0, DAILY_CAP - st.sold.rs), rs = Math.min(gems * GEM_RS, room); if (rs <= 0) return { err: `limite de troca de hoje atingido (${DAILY_CAP.toLocaleString('pt-BR')} por dia).` };
  const used = Math.ceil(rs / GEM_RS); st.gems = Math.round((st.gems - used) * 10) / 10; st.sold.rs += rs; s.money += rs; return { rs, used };
}
export function sellFera(s, id) {
  const st = ensure(s), f = st.box.find(x => x.id === id); if (!f) return 0;
  if (st.box.length === 1) return -1;
  const v = Math.round(value(f) * 0.7); st.box = st.box.filter(x => x !== f); st.team = st.team.filter(x => x !== id); if (!st.team.length) st.team = [st.box[0].id]; s.money += v; return v;
}
export const boxValue = s => (s.feras?.box || []).reduce((t, f) => t + value(f) * 0.7, 0);
