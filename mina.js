import { mult } from './perks.js';
// Mina de ouro (regras puras): UMA só no jogo inteiro (o servidor guarda quem é o dono). Cara de comprar, cara de manter.
// Só o dono contrata equipes. Para minerar precisa de FROTA comprada na loja 21 (escavadeira, pá-carregadeira, caminhões e perfuratriz):
// a produção por mês é limitada pelo elo mais fraco da logística (equipes, usina, escavação, carga, transporte e perfuração).
// Primeiro vem a prospecção (sondagem com perfuratriz: mais equipes = mais chance por mês); achado o veio (com teor em g/t), a frota tira o
// minério, a usina recupera ~92% do ouro e o ouro é vendido pelo preço do dia (ao vivo, ver mina-ui.js). Acabou o veio, volta a procurar.
//
// Números calibrados em referências reais (nov/2026):
//  - ouro à vista US$ 3.700 a 4.150 a onça (queda de 3% em 12/11); preço no jogo = onça ÷ 31,1035 × dólar, em R$ por kg
//  - custo total por onça (AISC) das mineradoras: ~US$ 1.500 a 1.785 (World Gold Council e S&P, 2026): perto de 46% da receita
//  - CFEM (royalty) do ouro: 1,5% do faturamento; mais PIS/Cofins/IR, ~4,5% no total
//  - usina de ~270 t/dia (CIL), 1 a 3 g/t de teor, recuperação de 90 a 95%
export const MINE = { name: 'Mineradora Serra Dourada', price: 120000000, upkeep: 850000, crew: 95000, maxCrews: 10, resale: 0.6 };
// upkeep = custos fixos (licenças ambientais, segurança, alojamento, administração e energia de base): ~25% do custo total por onça
export const PLANT_T = 8000, CREW_T = 800, OPEX_T = 95, ROYALTY = 0.045, RECOVERY = 0.92;   // t/mês da usina · t/mês por equipe · R$/t (diesel, explosivo, reagentes, desgaste) · CFEM+impostos · recuperação
export const FIND = 0.022, GOLD = 680000;   // chance por equipe por mês · R$ por kg (preço de reserva se a internet falhar: ~R$ 680/g)
export const KG_PER_CREW = +(CREW_T * 1.5 * RECOVERY / 1000).toFixed(2);   // ~1,1 kg por equipe/mês no teor médio (só para texto)
export const OZ = 31.1035;
export const spotBRLkg = (usdOz, usdBrl) => Math.round(usdOz / OZ * usdBrl * 1000);

// ---------- frota (vendida na loja 21) ----------
// t = toneladas de minério por mês que cada máquina aguenta; role = o elo da logística. Preços de tabela 2026 (aprox.).
const eq = (name, role, t, price, perk) => ({ name, type: 'maquina', crop: 'ouro', cat: 'mineração', role, t, price, img: 'mina-ouro', hp: 0, top: 30, perk });
export const EQUIP = {
  mn_escav: eq('Caterpilar 320 GC (escavadeira hidráulica 20 t)', 'escavar', 3500, 1450000, 'escava 3.500 t de minério por mês'),
  mn_carreg: eq('Caterpilar 950 GC (pá-carregadeira)', 'carregar', 4500, 1250000, 'carrega 4.500 t por mês nos caminhões'),
  mn_basc: eq('Mercedez Arocs 3345 (caminhão basculante 6x4)', 'transportar', 2000, 820000, 'transporta 2.000 t por mês até a usina'),
  mn_artic: eq('Volvu A40G (caminhão articulado 40 t)', 'transportar', 5000, 3900000, 'transporta 5.000 t por mês, mesmo em terreno ruim'),
  mn_perf: eq('Sandvic Ranger DX (perfuratriz hidráulica)', 'furar', 6000, 2600000, 'fura e prepara 6.000 t por mês (e faz a sondagem do veio)'),
};
export const ROLES = { furar: 'perfuratriz', escavar: 'escavadeira', carregar: 'pá-carregadeira', transportar: 'caminhão' };
// capacidade de cada elo (t/mês) somando as máquinas que o dono tem
export function fleet(s) {
  const f = { furar: 0, escavar: 0, carregar: 0, transportar: 0, n: {} };
  for (const c of s.cars || []) { const e = EQUIP[c.model]; if (e) { f[e.role] += e.t; f.n[e.role] = (f.n[e.role] || 0) + 1; } }
  return f;
}
export const missing = s => { const f = fleet(s); return Object.keys(ROLES).filter(r => !f[r]).map(r => ROLES[r]); };
// quanto minério por mês a mina consegue mover agora: o elo mais fraco manda
export function capacity(s) {
  const m = s.mina; if (!m) return { t: 0, limit: '—' };
  const f = fleet(s), parts = { 'as equipes': m.crews * CREW_T, 'a usina': PLANT_T, 'a escavação': f.escavar, 'a carga': f.carregar, 'o transporte': f.transportar, 'a perfuração': f.furar };
  const [limit, t] = Object.entries(parts).sort((a, b) => a[1] - b[1])[0];
  return { t, limit, parts };
}

export const ensure = s => { s.prices ??= {}; s.prices.ouro ??= GOLD; return s.mina; };
// preço real do ouro (onça em dólar × dólar em reais), ignorando número absurdo vindo da internet
export function setSpot(s, usdOz, usdBrl) {
  if (!(usdOz > 500 && usdOz < 20000 && usdBrl > 2 && usdBrl < 20)) return false;
  s.prices ??= {}; s.prices.ouro = spotBRLkg(usdOz, usdBrl); return true;
}
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
// tamanho do veio (kg de ouro): a maioria é modesta, alguns são enormes; teor em g/t: a maioria perto de 1,5, poucos ricos
const veinKg = rng => Math.round(18 + 300 * rng() ** 2.6);
const gradeOf = rng => Math.round((0.9 + 2.3 * rng() ** 1.8) * 100) / 100;
export function monthly(s, rng = Math.random) {
  const m = s.mina; if (!m) return [];
  ensure(s); const out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val), big: false }); };
  add(`${MINE.name}: custos fixos (licenças ambientais, segurança, alojamento, administração e energia)`, -MINE.upkeep);
  if (m.crews) add(`${MINE.name}: ${m.crews} ${m.crews === 1 ? 'equipe' : 'equipes'} de mineiros`, -m.crews * MINE.crew);
  m.months++; const f = fleet(s), lack = missing(s);
  if (m.phase === 'prospeccao') {
    if (!m.crews) out.push({ txt: `${MINE.name}: parada: sem equipes não se procura ouro`, val: 0 });
    else if (!f.furar) out.push({ txt: `${MINE.name}: sem perfuratriz não dá para sondar o terreno (compre na loja 21)`, val: 0 });
    else if (rng() < 1 - (1 - FIND) ** Math.min(m.crews, Math.ceil(f.furar / 1000))) {   // cada perfuratriz sonda com até 6 equipes
      m.phase = 'extracao'; m.vein = veinKg(rng); m.total = m.vein; m.grade = gradeOf(rng); m.found++;
      out.push({ txt: `${MINE.name}: ACHAMOS OURO! Veio com cerca de ${m.vein} kg (teor de ${String(m.grade).replace('.', ',')} g/t)`, val: 0, big: true });
    } else out.push({ txt: `${MINE.name}: sondagem continua, nada ainda`, val: 0 });
  } else if (lack.length || !m.crews) {
    out.push({ txt: `${MINE.name}: veio parado (${m.crews ? `faltam máquinas: ${lack.join(', ')}` : 'sem equipes'})`, val: 0 });
  } else {
    const cap = capacity(s), grade = m.grade || 1.5, tons = Math.round(cap.t * (0.9 + rng() * 0.2));   // a máquina não rende igual todo mês
    const kg = Math.min(m.vein, Math.round(tons * grade * RECOVERY / 100) / 10);
    if (kg > 0) {
      const real = Math.round(kg * 1000 / (grade * RECOVERY));   // t realmente processadas (no fim do veio, menos)
      m.vein = Math.round((m.vein - kg) * 10) / 10; m.mined += kg;
      add(`${MINE.name}: diesel, explosivos, reagentes e desgaste de ${real.toLocaleString('pt-BR')} t de minério`, -real * OPEX_T);
      const rev = kg * s.prices.ouro * mult(s, 'ouro');
      add(`${MINE.name}: ${String(kg).replace('.', ',')} kg de ouro vendidos (teor ${String(grade).replace('.', ',')} g/t)`, rev);
      add(`${MINE.name}: CFEM (1,5%) e impostos sobre o ouro`, -rev * ROYALTY);
    }
    if (m.vein <= 0) { m.phase = 'prospeccao'; m.vein = 0; out.push({ txt: `${MINE.name}: o veio acabou, voltando a procurar ouro`, val: 0 }); }
  }
  m.last = out.reduce((t, l) => t + l.val, 0);   // resultado do mês (para a barra de fechamento)
  return out;
}
export const value = s => (s.mina ? saleValue(s) + Math.round((s.mina.vein || 0) * (s.prices?.ouro || GOLD) * 0.3) : 0);
