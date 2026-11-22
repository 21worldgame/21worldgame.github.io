// Pomar de laranja (regras puras): cultura perene na terra própria. Planta uma vez, espera a formação e colhe a cada 4 meses
// enquanto cuidar. Sem defensivo ("veneno") todo mês a praga aumenta, a colheita cai e o greening pode matar árvores.
import { bonus } from './perks.js';
export const ORANGE = {
  plant: 18000,       // R$ por hectare (mudas, covas, adubação de plantio)
  grow: 6,            // meses de formação até a primeira colheita
  cycle: 4,           // meses entre colheitas
  yield: 330,         // caixas de 40,8 kg por hectare por colheita (pomar adulto e sadio)
  spray: 650,         // R$ por hectare por mês (defensivo + adubação de manutenção)
  price: 38,          // R$ por caixa (preço inicial do mercado)
};
export const ensure = s => { s.prices ??= {}; s.prices.laranja ??= ORANGE.price; s.stock ??= {}; s.stock.laranja ??= 0; };
export const canPlant = l => l.own && !l.leasedOut && !l.crop && !l.orchard && !l.cane;

export function plant(s, land) {
  ensure(s);
  if (!land?.own) return 'pomar só em terra própria (é cultura de muitos anos).';
  if (!canPlant(land)) return 'esta terra já está ocupada.';
  const cost = Math.round(land.ha * ORANGE.plant);
  if (cost > s.money) return 'dinheiro insuficiente para plantar o pomar.';
  s.money -= cost;
  land.orchard = { age: 0, health: 1, pest: 0, spray: true, harvests: 0 };
  return null;
}
export function uproot(land) { delete land.orchard; }
export const hasMachine = (s, m) => (s.cars || []).some(c => c.model === m && !c.broken);
// cada pulverizador atende 150 ha de pomar e cada plataforma 200 ha: o benefício vale para a parte coberta
export const COVER = { pulv: 150, plataforma: 200 }, SPRAY_CUT = 0.3, HARVEST_PLUS = 0.1;
export const machines = (s, m) => (s.cars || []).filter(c => c.model === m && !c.broken).length;   // quebrada não conta
export const orchardHa = s => (s.lands || []).reduce((t, l) => t + (l.orchard ? l.ha : 0), 0);
export const coverage = (s, m) => { const ha = orchardHa(s), n = machines(s, m); return n ? (ha ? Math.min(1, n * COVER[m] / ha) : 1) : 0; };
export const need = (s, m) => Math.ceil(orchardHa(s) / COVER[m]);
export const sprayMult = s => 1 - SPRAY_CUT * coverage(s, 'pulv');
export const harvestMult = s => 1 + HARVEST_PLUS * coverage(s, 'plataforma');
export const sprayCost = (s, l) => Math.round(l.ha * ORANGE.spray * sprayMult(s));
export const expectedWith = (s, l) => Math.round(expected(l, l.orchard, -bonus(s, 'perda')) * harvestMult(s));
export function toggleSpray(land) { if (land.orchard) land.orchard.spray = !land.orchard.spray; return land.orchard?.spray; }
export const nextHarvest = o => (o.age < ORANGE.grow ? ORANGE.grow - o.age : ORANGE.cycle - ((o.age - ORANGE.grow) % ORANGE.cycle));
// praga alta derruba fruta: com praga muito alta você perde a safra inteira
export const PEST_YIELD = [1, 0.85, 0.6, 0.3, 0, 0, 0];
export const PEST_LABEL = ['nenhuma', 'baixa', 'média', 'alta (perdendo fruta)', 'muito alta: safra perdida', 'muito alta: safra perdida', 'descontrolada: safra perdida'];
export const expected = (land, o = land.orchard, cut = 0) => Math.round(land.ha * ORANGE.yield * o.health * Math.min(1, PEST_YIELD[Math.min(6, o.pest)] + cut));   // cut: pontos de perda a menos (coleção Prosperidade)
export const orchardValue = (s, land) => (land.orchard ? Math.round(land.ha * ORANGE.plant * 0.6 * land.orchard.health) : 0);

// um mês do mundo: paga o defensivo (se ligado), a praga sobe ou desce, colhe quando chega a época
export function monthly(s, rng = Math.random) {
  ensure(s);
  const out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val) }); };
  for (const l of s.lands || []) {
    const o = l.orchard; if (!o) continue;
    const cost = sprayCost(s, l);
    if (o.spray && s.money >= cost) { add(`pomar: defensivo e adubação, ${l.ha} ha`, -cost); o.pest = Math.max(0, o.pest - 1); }
    else {
      o.pest = Math.min(6, o.pest + 1);
      if (o.spray) out.push({ txt: `pomar: sem dinheiro para o defensivo (${l.region}), a praga aumentou`, val: 0 });
      if (rng() < 0.09 * o.pest) { o.health = +(o.health * 0.78).toFixed(3); add(`pomar: greening atingiu árvores em ${l.region} (saúde ${Math.round(o.health * 100)}%)`); }
    }
    if (o.health < 0.25) { delete l.orchard; add(`pomar: as árvores de ${l.region} morreram de greening. Pomar perdido.`); continue; }
    o.age++;
    if (o.age >= ORANGE.grow && (o.age - ORANGE.grow) % ORANGE.cycle === 0) {
      const hail = rng() < 0.04;                                          // chuva de granizo derruba parte da fruta
      const cx = Math.round(expected(l, l.orchard, -bonus(s, 'perda')) * (0.85 + rng() * 0.3) * (hail ? 0.6 : 1) * harvestMult(s));
      s.stock.laranja = (s.stock.laranja || 0) + cx; o.harvests++;
      add(cx ? `colheita de laranja: ${cx} caixas, ${l.region}${hail ? ' (granizo derrubou parte da fruta)' : ''}` : `colheita perdida em ${l.region}: a praga derrubou toda a laranja`);
    }
  }
  return out;
}
