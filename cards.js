// Cartas colecionáveis e coleções (regras puras).
// A loja paga um valor FIXO por raridade (comum 3 mil, rara 5 mil, lendária 8 mil, exclusiva 10 mil): é simbólico,
// o valor de verdade de cada carta sai da negociação entre os jogadores (loja, Feirão e trocas).
// Coleções: cada carta conta uma vez só (repetidas não somam) e cada coleção é completada uma vez só.
// Completar dá um emblema no perfil, sobe no ranking de colecionadores e libera a vantagem da coleção para sempre.
// Padrões saem nos pacotes o ano todo; sazonais só saem no período delas (calendário de verdade), em pacote próprio
// e às vezes nos pacotes comuns. Fora do período, só dá para conseguir comprando de quem tem.
// Personagens originais do 21 World (não usamos personagens de outros jogos: são marcas registradas).
export const TIERS = [
  { id: 'bronze', label: 'bronze', base: 2500, w: 46 },
  { id: 'prata', label: 'prata', base: 8000, w: 27 },
  { id: 'esmeralda', label: 'esmeralda', base: 25000, w: 15 },
  { id: 'diamante', label: 'diamante', base: 80000, w: 8 },
  { id: 'mestre', label: 'mestre', base: 260000, w: 1.2 },
  { id: 'challenger', label: 'challenger', base: 1000000, w: 0.25 },
];
export const ELEMENTS = { fogo: ['#ff5a1f', '#ffcc33'], gelo: ['#5fd3ff', '#e9fbff'], lua: ['#b38bff', '#f2e6ff'], raio: ['#ffe14d', '#6cf0ff'], sombra: ['#7a2cff', '#ff2c7a'], natureza: ['#2ee66b', '#d9ff6a'] };
export const CHAMPS = [
  { id: 'brasa', name: 'Líder', el: 'fogo', k: 1.5 }, { id: 'fenix', name: 'Estratégia', el: 'fogo', k: 1.25 },
  { id: 'nevasca', name: 'Devoção', el: 'gelo', k: 1.1 }, { id: 'cristal', name: 'Vitória', el: 'gelo', k: 1.3 },
  { id: 'selene', name: 'Glória', el: 'lua', k: 1.45 }, { id: 'eclipse', name: 'Disciplina', el: 'lua', k: 1.2 },
  { id: 'trovao', name: 'Equipe', el: 'raio', k: 1.15 }, { id: 'faisca', name: 'Faísca', el: 'raio', k: 0.9 },
  { id: 'umbra', name: 'Conquista', el: 'sombra', k: 1.4 }, { id: 'corvo', name: 'Corvo Noturno', el: 'sombra', k: 1.0 },
  { id: 'raiz', name: 'Raiz Ancestral', el: 'natureza', k: 0.85 }, { id: 'vespa', name: 'Vespa Esmeralda', el: 'natureza', k: 1.05 },
];
export const CHAMP_ICON = { brasa: '🪓', fenix: '🦅', nevasca: '❄️', cristal: '💎', selene: '🌙', eclipse: '🌑', trovao: '⚡', faisca: '✨', umbra: '💀', corvo: '🐦‍⬛', raiz: '🌳', vespa: '🐝' };
// ---------- raridade e valor fixo da loja ----------
export const RARITY = {
  comum: { label: 'comum', value: 3000, frame: 'prata', stars: 1 },
  rara: { label: 'rara', value: 5000, frame: 'esmeralda', stars: 2 },
  lendaria: { label: 'lendária', value: 8000, frame: 'mestre', stars: 3 },
  exclusiva: { label: 'exclusiva', value: 10000, frame: 'challenger', stars: 4 },
};
const TIER_RAR = { bronze: 'comum', prata: 'comum', esmeralda: 'rara', diamante: 'rara', mestre: 'lendaria', challenger: 'lendaria' };
const RAR_TIERS = { comum: [['bronze', 64], ['prata', 36]], rara: [['esmeralda', 75], ['diamante', 25]], lendaria: [['mestre', 85], ['challenger', 15]] };
export const SELL = 1;            // a loja paga o valor fixo da raridade
export const LAND_RATE = 0.9;     // como pagamento de terra, a carta vale 90% do valor fixo
export const PACK_PRICE = 18000;  // pacote ouro (mantido para compatibilidade)

// ---------- coleções ----------
// reward: vantagem (chaves de perks.js) · prestige: pontos de prestígio · season: [mês, dia, mês, dia] do calendário de verdade
const C = (key, name, icon, rar, w = 1) => ({ key, name, icon, rar, w });
export const SETS = {
  campeoes: { name: 'Campeões', kind: 'padrao', icon: '⚔️', color: ['#7a2cff', '#ff2c7a'], reward: { xp: 0.05 }, rewardTxt: '+5% de XP em tudo', prestige: 10,
    cards: CHAMPS.map(ch => C(ch.id, ch.name.split(', ')[0], '⚔️', null)) },
  prosperidade: { name: 'Prosperidade', kind: 'padrao', icon: '🌾', color: ['#2ee66b', '#d9ff6a'], reward: { perda: -0.02 }, rewardTxt: '2 pontos a menos de perda: mortalidade da granja e dos suínos e praga do pomar e do canavial', prestige: 10,
    cards: [C('semente', 'Sementes', '🌱', 'comum'), C('chuva', 'Irrigação', '🌧️', 'comum'), C('trator', 'Adubação', '🚜', 'comum'), C('celeiro', 'Plantação', '🛖', 'rara'),
      C('colheita', 'Colheita', '🌾', 'rara'), C('sol', 'Clima Favorável', '☀️', 'rara'), C('arco', 'Pomar', '🌈', 'lendaria'), C('ouroverde', 'Canavial', '💚', 'lendaria')] },
  fortuna: { name: 'Fortuna', kind: 'padrao', icon: '🎰', color: ['#ffb800', '#ff5a1f'], reward: { casino: 0.15 }, rewardTxt: '+15% no ganho de fichas no cassino (21, roleta e aviator)', prestige: 10,
    cards: [C('ficha', 'Fichas', '🪙', 'comum'), C('trevo', 'Sorte', '🍀', 'comum'), C('dados', 'Aposta', '🎲', 'comum'), C('roleta', 'Roleta', '🎡', 'rara'),
      C('as', 'Blackjack 21', '♠️', 'rara'), C('coringa', 'Aviator', '🃏', 'rara'), C('jackpot', 'Jackpot', '💰', 'lendaria'), C('coroa', 'Cassino', '👑', 'lendaria')] },
  pecuaria: { name: 'Pecuária', kind: 'padrao', icon: '🐂', color: ['#c2410c', '#fbbf24'], reward: { animais: -0.15 }, rewardTxt: '15% mais barato comprar pintinhos, leitões e bezerros', prestige: 10,
    cards: [C('pintinho', 'Pintinhos', '🐣', 'comum'), C('leitao', 'Leitão', '🐖', 'comum'), C('bezerro', 'Bezerro', '🐄', 'comum'), C('galo', 'Aves', '🐓', 'rara'),
      C('touro', 'Suínos', '🐂', 'rara'), C('cavalo', 'Cocheira', '🐎', 'rara'), C('boiadeiro', 'Curral', '🤠', 'lendaria'), C('zebu', 'Gado', '🏆', 'lendaria')] },
  natal: { name: 'Natal', kind: 'sazonal', season: [12, 1, 12, 31], icon: '🎄', color: ['#dc2626', '#16a34a'], reward: {}, rewardTxt: '50 pontos de prestígio', prestige: 50,
    cards: [C('arvore', 'Árvore de Natal', '🎄', 'exclusiva'), C('presente', 'Presentes', '🎁', 'exclusiva'), C('rena', 'Renas', '🦌', 'exclusiva'), C('estrela', 'Luzes', '⭐', 'exclusiva'),
      C('sino', 'Guirlanda', '🔔', 'exclusiva'), C('boneco', 'Bolas de Natal', '☃️', 'exclusiva'), C('noel', 'Papai Noel', '🎅', 'exclusiva', 0.4), C('ceia', 'Trenó', '🦃', 'exclusiva', 0.4)] },
  junina: { name: 'Festa Junina', kind: 'sazonal', season: [6, 1, 7, 31], icon: '🔥', color: ['#f59e0b', '#7c3aed'], reward: { daily: 0.1 }, rewardTxt: '+10% na roleta do dia e 30 pontos de prestígio', prestige: 30,
    cards: [C('fogueira', 'Fogueira', '🔥', 'exclusiva'), C('balao', 'Chapéu de Palha', '🎈', 'exclusiva'), C('quadrilha', 'Danças', '💃', 'exclusiva'), C('pamonha', 'Pamonha', '🌽', 'exclusiva'),
      C('bandeirinha', 'Bandeirinhas', '🎏', 'exclusiva'), C('sanfona', 'Milho', '🪗', 'exclusiva'), C('santo', 'Quentão', '⛪', 'exclusiva', 0.4), C('pescaria', 'Canjica', '🎣', 'exclusiva', 0.4)] },
};
// data de São Paulo (UTC−3) para saber se a temporada está aberta
const spDate = now => { const d = new Date(now - 3 * 3600000); return [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCFullYear()]; };
export function seasonOpen(id, now = Date.now()) {
  const S = SETS[id]; if (!S?.season) return false;
  const [m, d] = spDate(now), x = m * 100 + d, a = S.season[0] * 100 + S.season[1], b = S.season[2] * 100 + S.season[3];
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}
export const openSeasons = (now = Date.now()) => Object.keys(SETS).filter(k => seasonOpen(k, now));
export const seasonLabel = id => { const s = SETS[id]?.season; return s ? `de ${s[1]}/${s[0]} a ${s[3]}/${s[2]}` : ''; };

// ---------- identidade da carta (antigas = coleção Campeões) ----------
const tier = id => TIERS.find(t => t.id === id) || TIERS[0];
export const champ = id => CHAMPS.find(c => c.id === id) || CHAMPS[0];
export const setOf = c => (c?.set && SETS[c.set] ? c.set : 'campeoes');
export const keyOf = c => (c?.set ? c.key : c?.champ);
export const ART = new Set(["campeoes:brasa", "campeoes:cristal", "campeoes:eclipse", "campeoes:fenix", "campeoes:nevasca", "campeoes:selene", "campeoes:trovao", "campeoes:umbra", "fortuna:as", "fortuna:coringa", "fortuna:coroa", "fortuna:dados", "fortuna:ficha", "fortuna:jackpot", "fortuna:roleta", "fortuna:trevo", "junina:balao", "junina:bandeirinha", "junina:fogueira", "junina:pamonha", "junina:pescaria", "junina:quadrilha", "junina:sanfona", "junina:santo", "natal:arvore", "natal:boneco", "natal:ceia", "natal:estrela", "natal:noel", "natal:presente", "natal:rena", "natal:sino", "pecuaria:bezerro", "pecuaria:boiadeiro", "pecuaria:cavalo", "pecuaria:galo", "pecuaria:leitao", "pecuaria:pintinho", "pecuaria:touro", "pecuaria:zebu", "prosperidade:arco", "prosperidade:celeiro", "prosperidade:chuva", "prosperidade:colheita", "prosperidade:ouroverde", "prosperidade:semente", "prosperidade:sol", "prosperidade:trator"]);   // coleção:chave com ilustração oficial em assets/cards/art (as outras mostram o emblema)
export const artOf = c => (ART.has(`${setOf(c)}:${keyOf(c)}`) ? `assets/cards/art/${setOf(c)}-${keyOf(c)}.webp` : '');
export const itemOf = c => SETS[setOf(c)].cards.find(x => x.key === keyOf(c));
export const rarityOf = c => (c?.set ? (SETS[c.set]?.kind === 'sazonal' ? 'exclusiva' : itemOf(c)?.rar || 'comum') : TIER_RAR[tier(c?.tier).id]);
export const value = c => RARITY[rarityOf(c)].value;
export const growth = () => 1;                 // não valorizam mais com o tempo
export const baseValue = c => value(c);
export const setMonth = () => {};
export const ensure = s => { s.colls ??= {}; };
export const label = c => (c?.set ? `${itemOf(c)?.name || 'carta'} (${SETS[c.set].name}, ${RARITY[rarityOf(c)].label})` : `${champ(c.champ).name} (${tier(c.tier).label})`);

export function give(s, card) {
  s.cards ??= [];
  const id = `k${(s.nextId = (s.nextId || 1) + 1)}`;
  const c = card?.set ? { id, set: card.set, key: card.key } : { id, tier: tier(card.tier).id, champ: champ(card.champ).id };
  s.cards.push(c);
  return c;
}

// ---------- sorteio ----------
const pickW = (list, rng) => { const tot = list.reduce((t, [, w]) => t + w, 0); let r = rng() * tot; return (list.find(([, w]) => (r -= w) < 0) || list[0])[0]; };
// carta de coleção padrão da raridade pedida (Campeões entram com uma das molduras daquela raridade)
function drawStd(rar, rng) {
  const pool = [];
  for (const [id, S] of Object.entries(SETS)) if (S.kind === 'padrao') for (const c of S.cards) if (id === 'campeoes' ? rar !== 'exclusiva' : c.rar === rar) pool.push([id, c]);
  const [set, c] = pool[Math.floor(rng() * pool.length)];
  return set === 'campeoes' ? { tier: pickW(RAR_TIERS[rar], rng), champ: c.key } : { set, key: c.key };
}
const drawSeasonal = (set, rng) => ({ set, key: pickW(SETS[set].cards.map(c => [c.key, c.w]), rng) });
// carta avulsa (prêmio, loja dos bots): compatível com o formato antigo
export function draw(rng = Math.random, minTier = 0) { return drawStd(minTier >= 1 ? pickW([['rara', 85], ['lendaria', 15]], rng) : pickW(Object.entries(W_STD), rng), rng); }

// ---------- pacotes ----------
const W_STD = { comum: 82, rara: 15, lendaria: 3 };
export const PACKS = {
  simples: { label: 'pacote simples', price: 6000, stock: 6, slots: [W_STD], hint: '1 carta' },
  ouro: { label: 'pacote ouro', price: 18000, stock: 3, slots: [W_STD, W_STD, { rara: 85, lendaria: 15 }], hint: '3 cartas, 1 rara ou melhor garantida' },
  lendario: { label: 'pacote lendário', price: 35000, stock: 1, slots: [W_STD, W_STD, W_STD, { rara: 70, lendaria: 30 }, { lendaria: 100 }], hint: '5 cartas, 1 lendária garantida' },
};
export const SEASON_PACK = { price: 25000, stock: 3, hint: '3 cartas: 1 da coleção da temporada garantida + 2 das coleções do ano' };
export const SEASON_CHANCE = 0.1;   // pacotes comuns na temporada: 10% de chance de vir uma carta sazonal no lugar da primeira
export const packInfo = id => (id.startsWith('sazonal:') ? { label: `pacote ${SETS[id.slice(8)]?.name || ''}`, ...SEASON_PACK } : PACKS[id]);
// valor médio na loja (fixo por raridade)
export function packEV(id) {
  if (id.startsWith('sazonal:')) return RARITY.exclusiva.value + 2 * packEV('simples');
  return PACKS[id].slots.reduce((sum, w) => { const tot = Object.values(w).reduce((a, b) => a + b, 0); return sum + Object.entries(w).reduce((a, [r, x]) => a + RARITY[r].value * x / tot, 0); }, 0);
}
export function packsLeft(s, id) { if (s.packs?.m !== (s.month || 0)) s.packs = { m: s.month || 0, n: {} }; return packInfo(id).stock - (s.packs.n[id] || 0); }
// abre um pacote; free = prêmio (não cobra nem gasta o estoque do mês)
export function openPack(s, id = 'ouro', rng = Math.random, now = Date.now(), free = false) {
  const P = packInfo(id), season = id.startsWith('sazonal:') ? id.slice(8) : null;
  if (!P || (season && !SETS[season])) return { err: 'pacote inválido.' };
  if (season && !seasonOpen(season, now)) return { err: `a temporada ${SETS[season].name} acabou. Agora essas cartas só com quem já tem.` };
  if (!free) {
    if (packsLeft(s, id) <= 0) return { err: `${P.label} esgotado neste mês do mundo. O estoque volta no mês que vem.` };
    if (s.money < P.price) return { err: 'dinheiro insuficiente para o pacote.' };
    s.money -= P.price; s.packs.n[id] = (s.packs.n[id] || 0) + 1;
  }
  const out = season ? [drawSeasonal(season, rng), drawStd(pickW(Object.entries(W_STD), rng), rng), drawStd(pickW(Object.entries(W_STD), rng), rng)]
    : P.slots.map(w => drawStd(pickW(Object.entries(w), rng), rng));
  const open = openSeasons(now);
  if (!season && open.length && rng() < SEASON_CHANCE) out[0] = drawSeasonal(open[Math.floor(rng() * open.length)], rng);
  return { cards: out.map(c => give(s, c)) };
}
export function buyPack(s, rng = Math.random) { const r = openPack(s, 'ouro', rng); return r.err ? r : { card: r.cards[0], cards: r.cards }; }
export function sell(s, id) {
  const c = (s.cards || []).find(x => x.id === id);
  if (!c) return 0;
  const v = Math.round(value(c) * SELL);
  s.cards = s.cards.filter(x => x !== c); s.money += v;
  return v;
}

// ---------- coleções: progresso, conclusão, emblemas, prestígio ----------
export function progress(s, id) {
  const S = SETS[id], have = new Set((s.cards || []).filter(c => setOf(c) === id).map(keyOf));
  return { have: S.cards.filter(c => have.has(c.key)).length, total: S.cards.length, keys: have, done: !!s.colls?.[id] };
}
// já tenho essa carta? (mesma coleção e mesma figura, qualquer raridade): selo na hora de comprar, sem ir conferir em outra página
export function ownInfo(s, c) { const set = setOf(c), key = keyOf(c), n = (s.cards || []).filter(x => setOf(x) === set && keyOf(x) === key).length; return { n, done: !!s.colls?.[set], need: !n && !s.colls?.[set], set: SETS[set]?.name || '' }; }
export function ownBadge(s, c) {
  const o = ownInfo(s, c);
  return o.n ? `<span class="own-b own-b--rep" title="Você já tem esta carta${o.n > 1 ? ` (${o.n} iguais)` : ''}: esta seria repetida">✅ já tem${o.n > 1 ? ` ×${o.n}` : ''} · repetida</span>`
    : o.need ? `<span class="own-b own-b--new" title="Você ainda não tem: conta para completar a coleção ${o.set}">✨ nova · falta na coleção</span>`
    : `<span class="own-b" title="A coleção ${o.set} já está completa">coleção já completa</span>`;
}
// marca as coleções que ficaram completas agora (cada uma vale uma vez só, para sempre); devolve as novas
export function claim(s) {
  ensure(s); const fresh = [];
  for (const id of Object.keys(SETS)) if (!s.colls[id]) { const p = progress(s, id); if (p.have === p.total) { s.colls[id] = s.month || 1; fresh.push(id); } }
  return fresh;
}
export const completed = s => Object.keys(s?.colls || {}).filter(k => SETS[k]);
export const prestige = s => completed(s).reduce((t, k) => t + (SETS[k].prestige || 0), 0);
export const rewards = s => completed(s).map(k => SETS[k].reward || {});
// repetidas: cópias além da primeira de cada carta (as que podem ir para venda ou troca sem mexer na coleção)
export function duplicates(s) {
  const seen = new Set(), out = new Set();
  for (const c of s.cards || []) { const k = `${setOf(c)}:${keyOf(c)}`; if (seen.has(k)) out.add(c.id); else seen.add(k); }
  return out;
}

// paga um valor usando cartas (as mais baratas primeiro, até cobrir); o troco volta em dinheiro
export function payWith(s, price) {
  const cards = [...(s.cards || [])].sort((a, b) => value(a) - value(b));
  const total = cards.reduce((t, c) => t + value(c) * LAND_RATE, 0);
  if (total < price) return { err: 'suas cartas não cobrem esse valor.' };
  const used = []; let paid = 0;
  for (const c of [...cards].sort((a, b) => value(b) - value(a))) { if (paid >= price) break; used.push(c); paid += value(c) * LAND_RATE; }
  for (const c of [...used].sort((a, b) => value(a) - value(b))) if (paid - value(c) * LAND_RATE >= price) { used.splice(used.indexOf(c), 1); paid -= value(c) * LAND_RATE; }
  const ids = new Set(used.map(c => c.id));
  s.cards = s.cards.filter(c => !ids.has(c.id));
  const change = Math.round(paid - price);
  s.money += change;
  return { used, change };
}
// carta que chega de outro jogador: só carta que existe no catálogo
export const sanitize = d => {
  if (d?.set) return SETS[d.set]?.cards.some(c => c.key === d.key) ? { set: d.set, key: d.key, id: String(d.id || '') } : null;
  return TIERS.some(t => t.id === d?.tier) && CHAMPS.some(c => c.id === d?.champ) ? { tier: d.tier, champ: d.champ, id: String(d.id || '') } : null;
};

// arte da carta: emblema do elemento em SVG + moldura animada da raridade (CSS)
const ICON = {
  fogo: 'M50 8c6 18 26 26 22 52-3 18-14 28-22 32-8-4-19-14-22-32-3-16 6-24 10-34 2 10 8 14 12 14-6-12-4-22 0-32z',
  gelo: 'M50 6v88M12 28l76 44M12 72l76-44M50 6l-10 10M50 6l10 10M50 94l-10-10M50 94l10-10',
  lua: 'M62 10a40 40 0 1 0 28 62A34 34 0 1 1 62 10z',
  raio: 'M58 4L18 56h26l-8 40 46-58H56z',
  sombra: 'M50 10c22 0 36 16 36 36 0 14-8 22-14 28v14H28V74c-6-6-14-14-14-28 0-20 14-36 36-36zM36 44a7 7 0 1 0 0.1 0zM64 44a7 7 0 1 0 0.1 0z',
  natureza: 'M50 92C50 60 20 52 16 16c30 2 46 20 34 52 4-28 22-44 36-48-2 30-18 48-36 72z',
};
const EL_LABEL = { fogo: 'fogo', gelo: 'gelo', lua: 'lua', raio: 'raio', sombra: 'sombra', natureza: 'natureza' };
export function cardHTML(c, { small = false, act = '', missing = false } = {}) {
  const R = RARITY[rarityOf(c)], val = `<p class="tcard__val">R$ ${value(c).toLocaleString('pt-BR')}</p>`, stars = `<span class="tcard__stars" aria-label="${R.label}">${'★'.repeat(R.stars)}</span>`;
  if (c.set) {
    const S = SETS[c.set], it = itemOf(c) || { name: '?', icon: '❔' }, [c1, c2] = S.color;
    return `<article class="tcard tcard--${R.frame} tcard--set${small ? ' tcard--sm' : ''}${missing ? ' is-missing' : ''}" style="--c1:${c1};--c2:${c2}" ${act}>
    <div class="tcard__in">
      ${artOf(c) ? `<div class="tcard__art tcard__art--img" style="--img:url(${artOf(c)})"><i class="tcard__fx" aria-hidden="true"></i></div>` : `<div class="tcard__art tcard__art--set"><i class="tcard__fx" aria-hidden="true"></i><span class="tcard__emoji" aria-hidden="true">${it.icon}</span></div>`}
      <i class="tcard__holo" aria-hidden="true"></i>
      <div class="tcard__top"><span class="tcard__tier">${R.label}</span><span class="tcard__el" title="coleção ${S.name}">${S.icon}</span></div>
      <div class="tcard__foot">${stars}<h4 class="tcard__name">${it.name}<small>coleção ${S.name}</small></h4>${val}</div>
    </div></article>`;
  }
  const ch = champ(c.champ), t = tier(c.tier), [c1, c2] = ELEMENTS[ch.el];
  const stroke = ch.el === 'gelo' ? `fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"` : 'fill="#fff"';
  const [title, sub] = ch.name.split(', ');
  // campeão: emblema no mesmo estilo das coleções (raios e halo na cor do elemento), no lugar da pintura antiga
  return `<article class="tcard tcard--${t.id} tcard--set${small ? ' tcard--sm' : ''}${missing ? ' is-missing' : ''}" style="--c1:${c1};--c2:${c2}" ${act}>
    <div class="tcard__in">
      ${artOf(c) ? `<div class="tcard__art tcard__art--img el--${ch.el}" style="--img:url(${artOf(c)})"><i class="tcard__fx" aria-hidden="true"></i><i class="tcard__rays" aria-hidden="true"></i></div>` : `<div class="tcard__art tcard__art--set el--${ch.el}"><i class="tcard__fx" aria-hidden="true"></i><i class="tcard__rays" aria-hidden="true"></i><span class="tcard__emoji" aria-hidden="true">${CHAMP_ICON[ch.id] || '⭐'}</span></div>`}
      <i class="tcard__holo" aria-hidden="true"></i>
      <div class="tcard__top"><span class="tcard__tier">${t.label}</span><span class="tcard__el" title="${EL_LABEL[ch.el]}"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${ICON[ch.el]}" ${stroke}/></svg></span></div>
      <div class="tcard__foot">${stars}<h4 class="tcard__name">${title}${sub ? `<small>${sub}</small>` : ''}</h4>${val}</div>
    </div></article>`;
}
