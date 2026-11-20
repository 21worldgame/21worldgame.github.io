// Mina de ouro (regras puras): UMA só no jogo inteiro (o servidor guarda quem é o dono). Cara de comprar, cara de manter.
// Só o dono contrata equipes. Primeiro vem a prospecção (meses procurando um veio, mais equipes = mais chance por mês);
// achado o veio, cada equipe extrai alguns kg por mês, vendidos pelo preço do ouro. Acabou o veio, volta a procurar.
export const MINE = { name: 'Mineradora Serra Dourada', price: 120000000, upkeep: 1100000, crew: 95000, maxCrews: 10, resale: 0.6 };
export const FIND = 0.022, KG_PER_CREW = 1.4, GOLD = 540000;   // chance por equipe por mês · kg por equipe por mês · R$ por kg (inicial)
export const ensure = s => { s.prices ??= {}; s.prices.ouro ??= GOLD; return s.mina; };
export function buy(s) {
  if (s.mina) return 'você já é dono da mina.';
  if (s.money < MINE.price) return 'dinheiro insuficiente para a mineradora.';
  s.money -= MINE.price; ensure(s);
  s.mina = { crews: 0, phase: 'prospeccao', vein: 0, total: 0, mined: 0, months: 0, found: 0 };
  return null;
}
export function setCrews(s, n) { if (!s.mina) return 'você não é dono da mina.'; s.mina.crews = Math.max(0, Math.min(MINE.maxCrews, Math.floor(n))); return null; }
export const saleValue = s => (s.mina ? Math.round(MINE.price * MINE.resale) : 0);
export function sell(s) { if (!s.mina) return 0; const v = saleValue(s); s.money += v; delete s.mina; return v; }
// tamanho do veio: a maioria é modesta, alguns são enormes
const veinKg = rng => Math.round(18 + 300 * rng() ** 2.6);
export function monthly(s, rng = Math.random) {
  const m = s.mina; if (!m) return [];
  ensure(s); const out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val), big: false }); };
  add(`${MINE.name}: licenças ambientais, segurança, energia e máquinas`, -MINE.upkeep);
  if (m.crews) add(`${MINE.name}: ${m.crews} ${m.crews === 1 ? 'equipe' : 'equipes'} de mineiros`, -m.crews * MINE.crew);
  m.months++;
  if (m.phase === 'prospeccao') {
    if (m.crews && rng() < 1 - (1 - FIND) ** m.crews) {
      m.phase = 'extracao'; m.vein = veinKg(rng); m.total = m.vein; m.found++;
      out.push({ txt: `${MINE.name}: ACHAMOS OURO! Veio com cerca de ${m.vein} kg`, val: 0, big: true });
    } else out.push({ txt: `${MINE.name}: ${m.crews ? 'prospecção continua, nada ainda' : 'parada: sem equipes não se procura ouro'}`, val: 0 });
  } else {
    const kg = Math.min(m.vein, Math.round(m.crews * KG_PER_CREW * (0.8 + rng() * 0.4) * 10) / 10);
    if (kg > 0) { m.vein = Math.round((m.vein - kg) * 10) / 10; m.mined += kg; add(`${MINE.name}: ${kg} kg de ouro vendidos`, kg * s.prices.ouro); }
    else out.push({ txt: `${MINE.name}: veio parado (sem equipes)`, val: 0 });
    if (m.vein <= 0) { m.phase = 'prospeccao'; m.vein = 0; out.push({ txt: `${MINE.name}: o veio acabou, voltando a procurar ouro`, val: 0 }); }
  }
  m.last = out.reduce((t, l) => t + l.val, 0);   // resultado do mês (para a barra de fechamento)
  return out;
}
export const value = s => (s.mina ? saleValue(s) + Math.round((s.mina.vein || 0) * (s.prices?.ouro || GOLD) * 0.3) : 0);
