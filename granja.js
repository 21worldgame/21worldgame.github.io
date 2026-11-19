// Granja de frangos de corte (regras puras): compra o galpão, aloja os pintinhos, eles engordam mês a mês e você vende o lote.
// Lógica de verdade da avicultura: lote único por galpão ("todos dentro, todos fora"), ração é o maior custo, conversão alimentar
// (kg de ração por kg de frango) depende do galpão, mortalidade, vacina e o ponto certo de abate (~2,8 kg no 2º mês).
export const HOUSES = {
  pequeno: { label: 'galpão pequeno', cap: 5000, price: 150000, mort: 0.03, conv: 1.85, heat: true, energy: 0.35, img: 'granja-galpao' },
  convencional: { label: 'galpão convencional', cap: 15000, price: 420000, mort: 0.025, conv: 1.75, heat: true, energy: 0.4, img: 'granja-aviario' },
  climatizado: { label: 'galpão climatizado (dark house)', cap: 30000, price: 1100000, mort: 0.015, conv: 1.62, heat: false, energy: 0.55, img: 'granja-frangos' },
};
export const PRICES = { pintinho: 4.2, frango: 6.2, racao: 1.9 };       // R$ por pintinho, R$ por kg vivo, R$ por kg de ração
export const WEIGHT = [0.045, 1.3, 2.8, 3.5, 3.8];                       // peso médio (kg) por mês de idade
export const VACCINE = 0.25;                                              // R$ por pintinho
export const FEE = 0.01;                                                  // taxa do frigorífico
export const HOUSE_DEPREC = 0.005, HOUSE_RESALE = 0.9;

export function ensure(s) {
  s.granja ??= { houses: [], lots: [] };
  s.granja.houses = (s.granja.houses || []).filter(h => h && HOUSES[h.type]); s.granja.lots = (s.granja.lots || []).filter(Boolean);   // galpão de tipo que não existe mais não quebra a tela
  s.prices ??= {};
  for (const [k, v] of Object.entries(PRICES)) s.prices[k] ??= v;
  return s.granja;
}
export const kgAt = age => WEIGHT[Math.min(age, WEIGHT.length - 1)];
export const lotOf = (s, hid) => ensure(s).lots.find(l => l.house === hid);
export const lotValue = (s, l) => Math.round(l.birds * kgAt(l.age) * (s.prices.frango || PRICES.frango) * (1 - FEE));
export const granjaValue = s => (s.granja?.houses || []).reduce((t, h) => t + h.value, 0) + (s.granja?.lots || []).reduce((t, l) => t + lotValue(s, l), 0);

export function buyHouse(s, type) {
  const H = HOUSES[type]; ensure(s);
  if (!H) return 'galpão inválido.';
  if (H.price > s.money) return 'dinheiro insuficiente para construir o galpão.';
  s.money -= H.price;
  s.granja.houses.push({ id: `g${(s.nextId = (s.nextId || 1) + 1)}`, type, value: H.price });
  return null;
}
export function sellHouse(s, hid) {
  const g = ensure(s), h = g.houses.find(x => x.id === hid);
  if (!h) return { err: 'galpão não encontrado.' };
  if (lotOf(s, hid)) return { err: 'venda o lote de frangos antes de vender o galpão.' };
  const v = Math.round(h.value * HOUSE_RESALE);
  g.houses = g.houses.filter(x => x !== h); s.money += v;
  return { amount: v };
}
// alojar pintinhos (só com o galpão vazio)
export const housingCost = (s, birds, vac) => Math.round(birds * ((s.prices.pintinho || PRICES.pintinho) + (vac ? VACCINE : 0)));
export function house(s, hid, birds, vac = true) {
  const g = ensure(s), h = g.houses.find(x => x.id === hid);
  if (!h) return 'galpão não encontrado.';
  if (lotOf(s, hid)) return 'o galpão já tem um lote. Venda antes de alojar outro.';
  birds = Math.floor(Number(birds) || 0);
  if (birds < 100) return 'aloje pelo menos 100 pintinhos.';
  if (birds > HOUSES[h.type].cap) return `esse galpão comporta até ${HOUSES[h.type].cap.toLocaleString('pt-BR')} aves.`;
  const cost = housingCost(s, birds, vac);
  if (cost > s.money) return 'dinheiro insuficiente para os pintinhos.';
  s.money -= cost;
  g.lots.push({ id: `l${(s.nextId = (s.nextId || 1) + 1)}`, house: hid, birds, start: birds, age: 0, vac: !!vac, events: [] });
  return null;
}
export function sellLot(s, lid) {
  const g = ensure(s), l = g.lots.find(x => x.id === lid);
  if (!l) return { err: 'lote não encontrado.' };
  if (l.age < 1) return { err: 'os pintinhos ainda não têm peso de venda: espere pelo menos 1 mês.' };
  const v = lotValue(s, l);
  g.lots = g.lots.filter(x => x !== l); s.money += v;
  return { amount: v, lot: l };
}

// um mês do mundo: crescem, comem, alguns morrem; eventos de doença e calor
export function monthly(s, rng = Math.random) {
  const g = ensure(s), out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val) }); };
  for (const h of g.houses) h.value = Math.round(h.value * (1 - HOUSE_DEPREC));
  for (const l of g.lots) {
    const H = HOUSES[g.houses.find(x => x.id === l.house)?.type] || HOUSES.pequeno;
    const gain = kgAt(l.age + 1) - kgAt(l.age), conv = H.conv * (l.age >= 2 ? 1.45 : 1);          // passou do ponto: come muito e engorda pouco
    const feed = Math.round(l.birds * gain * conv * (s.prices.racao || PRICES.racao));
    add(`granja: ração do lote (${l.birds.toLocaleString('pt-BR')} aves)`, -feed);
    add('granja: energia, cama e mão de obra', -Math.round(l.birds * H.energy));
    let dead = l.birds * H.mort;
    if (rng() < (l.vac ? 0.01 : 0.05)) { const d = l.birds * (l.vac ? 0.05 : 0.2); dead += d; l.events.push('doença'); add(`granja: surto de doença no lote${l.vac ? ' (a vacina segurou boa parte)' : ' sem vacina'}: ${Math.round(d)} aves perdidas`); }
    if (H.heat && rng() < 0.06) { const d = l.birds * 0.06; dead += d; l.events.push('calor'); add(`granja: onda de calor no galpão: ${Math.round(d)} aves perdidas`); }
    l.birds = Math.max(0, Math.round(l.birds - dead));
    l.age++;
  }
  g.lots = g.lots.filter(l => l.birds > 0);
  return out;
}
