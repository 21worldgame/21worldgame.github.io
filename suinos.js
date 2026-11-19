// Suinocultura (regras puras): compra o barracão, aloja leitões de ~23 kg, eles engordam ~24 kg/mês comendo ração
// (conversão ~2,4–2,7 kg de ração por kg ganho) e são vendidos por kg vivo. Ponto de venda: ~4º mês (~115–120 kg).
// Números de referência: Embrapa/FAEP (GPD ~790 g/dia, CA ~2,4) e Cepea (suíno vivo R$ 7,5–9,5/kg em 2025).
export const BARNS = {
  pequeno: { label: 'barracão pequeno', cap: 300, price: 480000, conv: 2.75, mort: 0.012, fixed: 9000, img: 'barn-pequeno' },
  medio: { label: 'barracão de terminação', cap: 1000, price: 1350000, conv: 2.6, mort: 0.009, fixed: 24000, img: 'barn-medio' },
  tecnificado: { label: 'granja tecnificada (climatizada)', cap: 3000, price: 3600000, conv: 2.42, mort: 0.006, fixed: 58000, img: 'barn-tecnificado' },
};
export const PRICES = { leitao: 380, suino: 8.2, racaoSuino: 1.55 };   // R$ por leitão, R$ por kg vivo, R$ por kg de ração (milho + farelo)
export const START_KG = 23, VACCINE = 12, FEE = 0.02, RESALE = 0.7;
// peso por mês no lote: cresce bem até ~4 meses, depois a engorda desacelera e a conversão piora
export const kgAt = age => Math.round(START_KG + [0, 25, 51, 76, 98, 114, 126][Math.min(6, age)]);
const gainAt = age => kgAt(age + 1) - kgAt(age);
export const ensure = s => { s.suinos ??= { barns: [], lots: [] }; s.prices ??= {}; for (const [k, v] of Object.entries(PRICES)) s.prices[k] ??= v; s.suinos.barns = s.suinos.barns.filter(b => b && BARNS[b.type]); s.suinos.lots = s.suinos.lots.filter(Boolean); return s.suinos; };
export const lotOf = (s, id) => s.suinos?.lots.find(l => l.barn === id);
export function buyBarn(s, type) {
  const B = BARNS[type]; ensure(s);
  if (!B) return 'barracão inválido.';
  if (s.money < B.price) return 'dinheiro insuficiente para o barracão.';
  s.money -= B.price; s.suinos.barns.push({ id: `sb${(s.nextId = (s.nextId || 1) + 1)}`, type, value: B.price });
  return null;
}
export const housing = (s, n, vac) => Math.round(n * ((s.prices.leitao || PRICES.leitao) + (vac ? VACCINE : 0)));
export function house(s, barnId, n, vac = true) {
  ensure(s); const b = s.suinos.barns.find(x => x.id === barnId), B = b && BARNS[b.type];
  if (!B) return 'barracão não encontrado.';
  if (lotOf(s, barnId)) return 'esse barracão já tem um lote.';
  n = Math.floor(n); if (n < 10 || n > B.cap) return `aloje de 10 a ${B.cap} leitões.`;
  const cost = housing(s, n, vac); if (cost > s.money) return 'dinheiro insuficiente para os leitões.';
  s.money -= cost; s.suinos.lots.push({ barn: barnId, pigs: n, age: 0, vac: !!vac, cost });
  return null;
}
export const lotValue = (s, l) => Math.round(l.pigs * kgAt(l.age) * (s.prices.suino || PRICES.suino) * (1 - FEE));
export function sellLot(s, barnId) {
  const l = lotOf(s, barnId); if (!l) return 0;
  const v = lotValue(s, l); s.money += v; s.suinos.lots = s.suinos.lots.filter(x => x !== l); return v;
}
export function sellBarn(s, barnId) {
  if (lotOf(s, barnId)) return { err: 'venda o lote antes de vender o barracão.' };
  const b = s.suinos?.barns.find(x => x.id === barnId); if (!b) return { err: 'barracão não encontrado.' };
  const v = Math.round(b.value * RESALE); s.money += v; s.suinos.barns = s.suinos.barns.filter(x => x !== b); return { value: v };
}
export function monthly(s, rng = Math.random) {
  ensure(s); const out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val) }); };
  for (const b of s.suinos.barns) {
    const B = BARNS[b.type], l = lotOf(s, b.id);
    add(`suinocultura: energia, água e mão de obra (${B.label})`, -B.fixed * (l ? 1 : 0.4));
    if (!l) continue;
    const g = gainAt(l.age), conv = B.conv * (l.age >= 4 ? 1.25 : 1);       // depois do ponto, cada kg custa mais ração
    const feed = Math.round(l.pigs * g * conv * (s.prices.racaoSuino || PRICES.racaoSuino));
    add(`suinocultura: ração do lote (${l.pigs} suínos)`, -feed);
    const dead = Math.round(l.pigs * B.mort * (0.7 + rng() * 0.6)); l.pigs -= dead;
    if (!l.vac && rng() < 0.06) { const k = Math.round(l.pigs * (0.12 + rng() * 0.18)); l.pigs -= k; out.push({ txt: `suinocultura: surto de doença no lote sem vacina, ${k} suínos perdidos`, val: 0 }); }
    l.age++;
    if (l.pigs <= 0) { s.suinos.lots = s.suinos.lots.filter(x => x !== l); out.push({ txt: 'suinocultura: o lote inteiro foi perdido', val: 0 }); }
  }
  return out;
}
export const value = s => (s.suinos?.barns || []).reduce((t, b) => t + b.value * RESALE, 0) + (s.suinos?.lots || []).reduce((t, l) => t + lotValue(s, l), 0);
