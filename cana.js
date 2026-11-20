// Canavial (regras puras): cultura semiperene na terra própria. Planta uma vez e corta várias safras ("soca"),
// cada corte rende um pouco menos; depois de uns 5 cortes vale reformar (arrancar e plantar de novo).
// A cana não fica no armazém: no corte ela vai direto para a usina, que paga pela tonelada (já descontado corte e frete).
// Tratos culturais todo mês (adubação, herbicida e controle da broca); sem eles a broca derruba a produção.
// Na seca (julho a outubro) pode pegar fogo: a cana queimada é vendida com desconto.
import { ownsUsina } from './negocios.js';
export const CANE = {
  plant: 11000,       // R$ por hectare (mudas, preparo do solo, plantio)
  first: 10,          // meses até o primeiro corte (cana-planta)
  cycle: 10,          // meses entre os cortes seguintes (soca)
  yield: 85,          // toneladas por hectare no primeiro corte
  decline: 0.88,      // cada corte rende 12% menos que o anterior
  care: 280,          // R$ por hectare por mês (tratos culturais)
  price: 150,         // R$ por tonelada (usina, preço inicial)
  reform: 5,          // depois de tantos cortes o canavial pede reforma
};
// ---------- logística: corte, carregamento e frete até a usina (custo por tonelada) ----------
// distância média até uma usina por estado (onde tem mais usina, o frete é mais barato)
export const USINA_KM = { sp: 25, go: 35, mg: 40, ms: 45, pr: 50, mt: 90, ba: 110, to: 140, pa: 180, rs: 160, sc: 150 };
export const HARVESTER = { price: 1200000, upkeep: 8000, deprec: 0.006 };   // colhedora própria
export const LOGI = { cutThird: 25, cutOwn: 12, load: 6, freightKm: 0.35, truckSave: 0.35 };
export const kmOf = land => USINA_KM[land.uf] ?? 100;
export function logistics(s, land) {
  const has = m => (s.cars || []).some(c => c.model === m), cut = s.caneHarvester ? LOGI.cutOwn : LOGI.cutThird, rodo = has('rodotrem'), truck = rodo || has('scania');
  const freight = +(kmOf(land) * LOGI.freightKm * (rodo ? 0.55 : truck ? 1 - LOGI.truckSave : 1)).toFixed(2), load = has('transbordo') ? 2 : LOGI.load;
  return { cut, load, freight, km: kmOf(land), truck, rodo, own: !!s.caneHarvester, total: +(cut + load + freight).toFixed(2) };
}
export function buyHarvester(s) {
  if (s.caneHarvester) return 'você já tem uma colhedora.';
  if (s.money < HARVESTER.price) return 'dinheiro insuficiente para a colhedora.';
  s.money -= HARVESTER.price; s.caneHarvester = { value: HARVESTER.price };
  return null;
}
export function sellHarvester(s) { if (!s.caneHarvester) return 0; const v = Math.round(s.caneHarvester.value * 0.85); s.money += v; delete s.caneHarvester; return v; }
export const PEST_YIELD = [1, 0.88, 0.7, 0.45, 0.2, 0.1, 0.05];
export const PEST_LABEL = ['controlada', 'baixa', 'média', 'alta (broca na cana)', 'muito alta', 'muito alta', 'descontrolada'];
export const ensure = s => { s.prices ??= {}; s.prices.cana ??= CANE.price; };
export const canPlant = l => l.own && !l.leasedOut && !l.crop && !l.orchard && !l.cane;

export function plant(s, land) {
  ensure(s);
  if (!land?.own) return 'canavial só em terra própria.';
  if (!canPlant(land)) return 'esta terra já está ocupada.';
  const cost = Math.round(land.ha * CANE.plant);
  if (cost > s.money) return 'dinheiro insuficiente para plantar a cana.';
  s.money -= cost;
  land.cane = { age: 0, cuts: 0, health: 1, pest: 0, care: true };
  return null;
}
export function uproot(land) { delete land.cane; }
export function toggleCare(land) { if (land.cane) land.cane.care = !land.cane.care; return land.cane?.care; }
export const nextCut = c => (c.cuts === 0 ? CANE.first - c.age : CANE.cycle - ((c.age - CANE.first) % CANE.cycle));
export const expectedTons = (land, c = land.cane) => Math.round(land.ha * CANE.yield * CANE.decline ** c.cuts * c.health * PEST_YIELD[Math.min(6, c.pest)]);
export const caneValue = (s, land) => (land.cane ? Math.round(land.ha * CANE.plant * 0.6 * land.cane.health * Math.max(0, 1 - land.cane.cuts / (CANE.reform + 1))) : 0);
const dryMonth = month => [7, 8, 9, 10].includes(((month - 1) % 12) + 1);

export function monthly(s, rng = Math.random) {
  ensure(s);
  const out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val) }); };
  if (s.caneHarvester) { s.caneHarvester.value = Math.round(s.caneHarvester.value * (1 - HARVESTER.deprec)); add('colhedora: manutenção, diesel e operador', -HARVESTER.upkeep); }
  for (const l of s.lands || []) {
    const c = l.cane; if (!c) continue;
    const cost = Math.round(l.ha * CANE.care);
    if (c.care && s.money >= cost) { add(`canavial: tratos culturais, ${l.ha} ha`, -cost); c.pest = Math.max(0, c.pest - 1); }
    else {
      c.pest = Math.min(6, c.pest + 1);
      if (c.care) out.push({ txt: `canavial: sem dinheiro para os tratos (${l.region}), a broca aumentou`, val: 0 });
      if (rng() < 0.05 * c.pest) { c.health = +(c.health * 0.85).toFixed(3); add(`canavial: broca e mato tomaram parte da cana em ${l.region} (vigor ${Math.round(c.health * 100)}%)`); }
    }
    let burnt = false;
    if (dryMonth(s.month || 1) && rng() < (c.care ? 0.015 : 0.05)) { burnt = true; add(`canavial: fogo na cana em ${l.region} (seca)`); }
    if (c.health < 0.2) { delete l.cane; add(`canavial perdido em ${l.region}: a cana não rebrota mais.`); continue; }
    c.age++;
    const due = c.cuts === 0 ? c.age === CANE.first : c.age > CANE.first && (c.age - CANE.first) % CANE.cycle === 0;
    if (due || burnt && c.age >= CANE.first - 2 && nextCut(c) <= 2) {
      const tons = Math.round(expectedTons(l) * (0.9 + rng() * 0.2) * (burnt ? 0.75 : 1));
      const mine = ownsUsina(s, 'cana'), price = (s.prices.cana || CANE.price) * (burnt ? 0.85 : 1) * (mine ? 1.12 : 1);
      const lg = logistics(s, l), net = Math.round(tons * (price - lg.total + (mine ? lg.freight / 2 : 0)));
      c.cuts++; if (!due) c.age = c.cuts === 1 ? CANE.first : CANE.first + (c.cuts - 1) * CANE.cycle;   // corte antecipado pelo fogo
      add(`corte de cana: ${tons} t para ${mine ? 'a SUA usina (+12% e frete pela metade)' : `a usina a ${lg.km} km`}, ${l.region}${burnt ? ' (cana queimada, com desconto)' : ''} · logística R$ ${lg.total.toFixed(2).replace('.', ',')}/t`, net);
      if (c.cuts >= CANE.reform) out.push({ txt: `canavial de ${l.region}: já são ${c.cuts} cortes, pense em reformar`, val: 0 });
    }
  }
  return out;
}
