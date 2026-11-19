// Cartas colecionáveis: valem dinheiro, trocam entre jogadores e pagam terras (regras puras).
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
  { id: 'brasa', name: 'Brasa, o Carrasco', el: 'fogo', k: 1.5 }, { id: 'fenix', name: 'Fênix Rubra', el: 'fogo', k: 1.25 },
  { id: 'nevasca', name: 'Nevasca', el: 'gelo', k: 1.1 }, { id: 'cristal', name: 'Cristal Eterna', el: 'gelo', k: 1.3 },
  { id: 'selene', name: 'Selene, Lâmina da Lua', el: 'lua', k: 1.45 }, { id: 'eclipse', name: 'Eclipse', el: 'lua', k: 1.2 },
  { id: 'trovao', name: 'Trovão de Aço', el: 'raio', k: 1.15 }, { id: 'faisca', name: 'Faísca', el: 'raio', k: 0.9 },
  { id: 'umbra', name: 'Umbra, a Ceifadora', el: 'sombra', k: 1.4 }, { id: 'corvo', name: 'Corvo Noturno', el: 'sombra', k: 1.0 },
  { id: 'raiz', name: 'Raiz Ancestral', el: 'natureza', k: 0.85 }, { id: 'vespa', name: 'Vespa Esmeralda', el: 'natureza', k: 1.05 },
];
export const PACK_PRICE = 30000;   // pacote ouro (mantido para compatibilidade)
export const SELL = 0.7;          // a loja recompra por 70%
export const LAND_RATE = 0.9;     // como pagamento de terra, a carta vale 90%

const tier = id => TIERS.find(t => t.id === id) || TIERS[0];
export const champ = id => CHAMPS.find(c => c.id === id) || CHAMPS[0];
// valorização: a carta guarda o mês do mundo em que nasceu e valoriza todo mês; quanto mais rara, mais valoriza (até 40 meses)
export const GROW = { bronze: 0.003, prata: 0.005, esmeralda: 0.007, diamante: 0.008, mestre: 0.011, challenger: 0.015 };
export const GROW_CAP = 40;
let MONTH = 0;
export const setMonth = m => { MONTH = Number(m) || 0; };
export const baseValue = c => Math.round(tier(c.tier).base * champ(c.champ).k / 100) * 100;
export const age = (c, m = MONTH) => Math.max(0, Math.min(GROW_CAP, m - (c.born ?? m)));
export const growth = (c, m = MONTH) => (1 + GROW[tier(c.tier).id]) ** age(c, m);
export const value = (c, m = MONTH) => Math.round((baseValue(c) * growth(c, m)) / 100) * 100;
export const ensure = s => { for (const c of s.cards || []) c.born ??= s.month || MONTH; };
export const label = c => `${champ(c.champ).name} (${tier(c.tier).label})`;

export function draw(rng = Math.random, minTier = 0) {
  const pool = TIERS.slice(minTier), tot = pool.reduce((a, t) => a + t.w, 0);
  let r = rng() * tot, t = pool.find(x => (r -= x.w) < 0) || pool[0];
  return { tier: t.id, champ: CHAMPS[Math.floor(rng() * CHAMPS.length)].id };
}
export function give(s, card) {
  s.cards ??= [];
  const now = s.month ?? MONTH, born = Number.isFinite(card.born) ? Math.max(now - GROW_CAP, Math.min(now, card.born)) : now;
  const c = { id: `k${(s.nextId = (s.nextId || 1) + 1)}`, tier: tier(card.tier).id, champ: champ(card.champ).id, born };
  s.cards.push(c);
  return c;
}
// Pacotes: cada vaga da carta tem sua chance de raridade. O valor médio do pacote fica perto do preço
// (você recebe várias cartas e às vezes tira uma rara), mas vender na loja ou pagar terra com elas nunca dá lucro garantido.
const COMUM = { bronze: 64, prata: 29, esmeralda: 6, diamante: 0.9, mestre: 0.09, challenger: 0.01 };
export const PACKS = {
  simples: { label: 'pacote simples', price: 8000, stock: 6, slots: [COMUM], hint: '1 carta' },
  ouro: { label: 'pacote ouro', price: 30000, stock: 3, slots: [COMUM, COMUM, { prata: 84, esmeralda: 13.5, diamante: 2.2, mestre: 0.27, challenger: 0.03 }], hint: '3 cartas, 1 garantida prata ou melhor' },
  lendario: { label: 'pacote lendário', price: 200000, stock: 1, slots: [COMUM, COMUM, COMUM, { esmeralda: 80, diamante: 17, mestre: 2.6, challenger: 0.4 }, { diamante: 92, mestre: 7, challenger: 1 }], hint: '5 cartas, 1 esmeralda+ e 1 diamante+ garantidas' },
};
function drawFrom(w, rng) {
  const ent = Object.entries(w), tot = ent.reduce((t, [, x]) => t + x, 0);
  let r = rng() * tot; const t = (ent.find(([, x]) => (r -= x) < 0) || ent[0])[0];
  return { tier: t, champ: CHAMPS[Math.floor(rng() * CHAMPS.length)].id };
}
// valor médio de um pacote (para mostrar na tela e para o teste)
export function packEV(id) {
  const kAvg = CHAMPS.reduce((t, c) => t + c.k, 0) / CHAMPS.length;
  return PACKS[id].slots.reduce((sum, w) => { const tot = Object.values(w).reduce((a, b) => a + b, 0); return sum + Object.entries(w).reduce((a, [t, x]) => a + tier(t).base * kAvg * x / tot, 0); }, 0);
}
// estoque de pacotes por mês do mundo: é isso que mantém as cartas raras
export function packsLeft(s, id) { if (s.packs?.m !== (s.month || 0)) s.packs = { m: s.month || 0, n: {} }; return PACKS[id].stock - (s.packs.n[id] || 0); }
export function openPack(s, id = 'ouro', rng = Math.random) {
  const P = PACKS[id];
  if (!P) return { err: 'pacote inválido.' };
  if (packsLeft(s, id) <= 0) return { err: `${P.label} esgotado neste mês do mundo. Cartas são raras: o estoque volta no mês que vem.` };
  if (s.money < P.price) return { err: 'dinheiro insuficiente para o pacote.' };
  s.money -= P.price;
  s.packs.n[id] = (s.packs.n[id] || 0) + 1;
  return { cards: P.slots.map(w => give(s, drawFrom(w, rng))) };
}
export function buyPack(s, rng = Math.random) { const r = openPack(s, 'ouro', rng); return r.err ? r : { card: r.cards[0], cards: r.cards }; }
export function sell(s, id) {
  const c = (s.cards || []).find(x => x.id === id);
  if (!c) return 0;
  const v = Math.round(value(c) * SELL);
  s.cards = s.cards.filter(x => x !== c); s.money += v;
  return v;
}
// paga um valor usando cartas (as mais baratas primeiro, até cobrir); o troco volta em dinheiro
export function payWith(s, price) {
  const cards = [...(s.cards || [])].sort((a, b) => value(a) - value(b));
  const total = cards.reduce((t, c) => t + value(c) * LAND_RATE, 0);
  if (total < price) return { err: 'suas cartas não cobrem esse valor.' };
  const used = []; let paid = 0;
  for (const c of [...cards].sort((a, b) => value(b) - value(a))) { if (paid >= price) break; used.push(c); paid += value(c) * LAND_RATE; }
  // tenta devolver cartas desnecessárias (das menores)
  for (const c of [...used].sort((a, b) => value(a) - value(b))) if (paid - value(c) * LAND_RATE >= price) { used.splice(used.indexOf(c), 1); paid -= value(c) * LAND_RATE; }
  const ids = new Set(used.map(c => c.id));
  s.cards = s.cards.filter(c => !ids.has(c.id));
  const change = Math.round(paid - price);
  s.money += change;
  return { used, change };
}
// carta que chega de outro jogador: só tier e campeão conhecidos
export const sanitize = d => (TIERS.some(t => t.id === d?.tier) && CHAMPS.some(c => c.id === d?.champ) ? { tier: d.tier, champ: d.champ, id: String(d.id || ''), ...(Number.isFinite(Number(d.born)) && d.born !== null && d.born !== '' ? { born: Number(d.born) } : {}) } : null);

// arte da carta: emblema do elemento em SVG + moldura animada da raridade (CSS)
const ICON = {
  fogo: 'M50 8c6 18 26 26 22 52-3 18-14 28-22 32-8-4-19-14-22-32-3-16 6-24 10-34 2 10 8 14 12 14-6-12-4-22 0-32z',
  gelo: 'M50 6v88M12 28l76 44M12 72l76-44M50 6l-10 10M50 6l10 10M50 94l-10-10M50 94l10-10',
  lua: 'M62 10a40 40 0 1 0 28 62A34 34 0 1 1 62 10z',
  raio: 'M58 4L18 56h26l-8 40 46-58H56z',
  sombra: 'M50 10c22 0 36 16 36 36 0 14-8 22-14 28v14H28V74c-6-6-14-14-14-28 0-20 14-36 36-36zM36 44a7 7 0 1 0 0.1 0zM64 44a7 7 0 1 0 0.1 0z',
  natureza: 'M50 92C50 60 20 52 16 16c30 2 46 20 34 52 4-28 22-44 36-48-2 30-18 48-36 72z',
};
const STARS = { bronze: 1, prata: 2, esmeralda: 3, diamante: 4, mestre: 5, challenger: 6 };
const EL_LABEL = { fogo: 'fogo', gelo: 'gelo', lua: 'lua', raio: 'raio', sombra: 'sombra', natureza: 'natureza' };
export function cardHTML(c, { small = false, act = '' } = {}) {
  const ch = champ(c.champ), t = tier(c.tier), [c1, c2] = ELEMENTS[ch.el];
  const stroke = ch.el === 'gelo' ? `fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"` : 'fill="#fff"';
  const [title, sub] = ch.name.split(', ');
  return `<article class="tcard tcard--${t.id}${small ? ' tcard--sm' : ''}" style="--c1:${c1};--c2:${c2};--art:url(assets/cards/${ch.id}.webp)" ${act}>
    <div class="tcard__in">
      <div class="tcard__art el--${ch.el}"><i class="tcard__fx" aria-hidden="true"></i><i class="tcard__rays" aria-hidden="true"></i></div>
      <i class="tcard__holo" aria-hidden="true"></i>
      <div class="tcard__top"><span class="tcard__tier">${t.label}</span><span class="tcard__el" title="${EL_LABEL[ch.el]}"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${ICON[ch.el]}" ${stroke}/></svg></span></div>
      <div class="tcard__foot">
        <span class="tcard__stars" aria-label="raridade ${STARS[t.id]} de 6">${'★'.repeat(STARS[t.id])}</span>
        <h4 class="tcard__name">${title}${sub ? `<small>${sub}</small>` : ''}</h4>
        <p class="tcard__val">R$ ${value(c).toLocaleString('pt-BR')}${growth(c) > 1.005 ? `<small class="tcard__up">▲ ${Math.round((growth(c) - 1) * 100)}%</small>` : ''}</p>
      </div>
    </div></article>`;
}
