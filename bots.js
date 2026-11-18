// Negociação com bots (regras puras). Usada no mercado de futebol e na feira de itens.
// O bot tem um preço-limite secreto; aceita se a sua oferta passa dele, contrapropõe no meio do caminho
// e desiste depois de 3 rodadas ou se a oferta for ofensiva.
export const BOT_NAMES = ['zeca021', 'Bea.Lima', 'Diguinho', 'Joãozinho99', 'Carla_BR', 'Bruninho', 'Thaís.S', 'Mateus.L', 'Rayssa_', 'Fe_Martins'];

// dealer = quem vende (você compra); limit = menor preço que o bot aceita
export function newDeal(ask, rng = Math.random, side = 'sell') {
  const k = side === 'sell' ? 0.82 + rng() * 0.12 : 1.06 + rng() * 0.14;   // vendendo: aceita até ~-18%; comprando: paga até ~+20% do valor
  return { ask: Math.round(ask), limit: Math.round(ask * k), side, round: 0, open: true };
}
// você propõe `offer`; devolve { result: 'accept'|'counter'|'walk', price }
export function haggle(d, offer, rng = Math.random) {
  if (!d.open) return { result: 'walk', price: d.ask };
  offer = Math.round(Number(offer) || 0);
  d.round++;
  const sell = d.side === 'sell';                           // bot vende: quer preço alto
  const ok = sell ? offer >= d.limit : offer <= d.limit;
  if (ok) { d.open = false; return { result: 'accept', price: offer }; }
  const insult = sell ? offer < d.limit * 0.7 : offer > d.limit * 1.4;
  if (insult || d.round >= 3) { d.open = false; return { result: 'walk', price: d.ask }; }
  d.ask = Math.round(sell ? Math.max(d.limit, (d.ask + offer) / 2 + d.ask * 0.02 * rng()) : Math.min(d.limit, (d.ask + offer) / 2));
  return { result: 'counter', price: d.ask };
}
