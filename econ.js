// Economia do mundo (regras puras, iguais em todos os aparelhos): oferta e demanda dos produtos, crises e eventos.
// Tudo sai do relógio do mundo (mês) + do que os jogadores plantam:
//  - os jogadores do mundo escolhem o que plantar a cada safra (3 meses) conforme o perfil deles e o preço da safra anterior;
//  - os jogadores com conta entram com o que mostram no perfil público (card.crops);
//  - muita gente num produto → oferta alta → preço de referência cai; pouca gente → sobe (com atraso de uma safra).
// Crises: a cada ~2 anos o mundo olha se há concentração exagerada num produto; se houver, avisa antes (🟡 → 🟠) e a crise
// chega depois (🔴). Sem concentração, não há crise. Eventos temáticos (greve, ciberataque, contaminação...) seguem a exposição.
import { NPCS, PERF, CLOCK, FALL } from './npcs.js';
import { current } from './world.js';
const smartW = () => Math.floor((Math.max(1, current(CLOCK.world, FALL)) - 1) / SEASON);   // safra em que os jogadores do mundo ficaram mais espertos

export const GOODS = ['soja', 'milho', 'cafe', 'laranja', 'cana', 'arroba'];
export const LABEL = { soja: 'soja', milho: 'milho', cafe: 'café', laranja: 'laranja', cana: 'cana', arroba: 'boi gordo', frango: 'frango', suino: 'suíno' };
const NORMAL = { soja: 0.28, milho: 0.2, cafe: 0.12, laranja: 0.09, cana: 0.11, arroba: 0.2 };   // fatia "saudável" de cada produto
const SEASON = 3;                                                                              // meses por safra
const h = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

// perfil econômico de cada jogador do mundo (fixo por pessoa): como ele decide
export const PERSONAS = {
  conservador: { label: 'investidor conservador', chase: 0.3, stick: 0.75 },
  agressivo: { label: 'empresário agressivo', chase: 1.6, stick: 0.3 },
  especialista: { label: 'agricultor especializado', chase: 0.4, stick: 0.9 },
  diversifica: { label: 'diversifica tudo', chase: 0.5, stick: 0.4 },
  oportunista: { label: 'comerciante oportunista', chase: 1.3, stick: 0.2 },
  iniciante: { label: 'jogador iniciante', chase: 1.1, stick: 0.5, noise: 0.5 },
  contrario: { label: 'compra na baixa', chase: -0.9, stick: 0.4 },
  tendencia: { label: 'segue a tendência', chase: 2, stick: 0.25 },
};
const PKEYS = Object.keys(PERSONAS);
export const personaOf = n => PKEYS[Math.floor(h((n?.i ?? 0) * 7.31 + 2) * PKEYS.length)];
const favOf = n => GOODS[Math.floor(h((n?.i ?? 0) * 3.7 + 9) * GOODS.length)];   // produto do coração (especialista fica nele)

// ---------- safra a safra: fatia de cada produto e preço de referência ----------
// mult[k] = multiplicador do preço de referência (0,7 a 1,25); lag de uma safra porque a produção demora a chegar
// "febre": a cada ~30 meses um produto vira moda e atrai quem segue tendência (é assim que nasce a concentração)
export const feverOf = w => { const j = Math.floor(w / 10); return h(j * 3.3 + 5) < 0.7 ? GOODS[Math.floor(h(j * 1.9 + 2) * GOODS.length)] : null; };
function npcMix(w, prevMult) {
  const tot = Object.fromEntries(GOODS.map(k => [k, 0])), fever = feverOf(w);
  for (const n of NPCS) {
    const P = PERSONAS[personaOf(n)], fav = favOf(n);
    let sum = 0; const wts = {};
    for (const k of GOODS) {
      let v = NORMAL[k] * Math.max(0.4, 1 + P.chase * ((prevMult[k] || 1) - 1) * 2.2);   // corre atrás (ou foge) do preço da safra passada
      if (k === fav) v *= 1 + P.stick * 2;
      if (k === fever && P.chase > 0) v *= 1 + P.chase * 1.1;                       // a moda puxa quem segue preço
      if (P.noise) v *= 0.6 + h(n.i * 13 + w * 7 + k.length) * P.noise * 2;
      wts[k] = v; sum += v;
    }
    const size = 1 + Math.log10(1 + (n.i % 40));                                     // os maiores pesam mais
    for (const k of GOODS) tot[k] += (wts[k] / sum) * size;
  }
  const all = Object.values(tot).reduce((a, b) => a + b, 0);
  return Object.fromEntries(GOODS.map(k => [k, tot[k] / all]));
}
const step = (mult, mix) => Object.fromEntries(GOODS.map(g => { const p = mix[g] / NORMAL[g], target = Math.max(0.7, Math.min(1.25, 1 - 0.45 * (p - 1))); return [g, +(mult[g] * 0.65 + target * 0.35).toFixed(3)]; }));
// história só dos jogadores do mundo, calculada uma vez e guardada (safra a safra)
const hist = [{ mult: Object.fromEntries(GOODS.map(k => [k, 1])), mix: { ...NORMAL } }];
function npcSeason(w) {
  while (hist.length <= w) { const prev = hist[hist.length - 1], mix = npcMix(hist.length, prev.mult); hist.push({ mix, mult: step(prev.mult, mix) }); }
  return hist[w];
}
// fatia dos jogadores com conta (área plantada por produto), injetada pelo jogo a partir do ranking (nuvem)
let realMix = null, realWeight = 0, realFrom = Infinity;
export function setReal(cropsList, fromMonth) {   // cropsList: [{ soja: ha, cafe: ha, ... }, ...]
  const tot = Object.fromEntries(GOODS.map(k => [k, 0])); let any = 0;
  for (const c of cropsList || []) for (const k of GOODS) { const v = Math.max(0, Number(c?.[k]) || 0); tot[k] += v; any += v; }
  if (!any) { realMix = null; realWeight = 0; return; }
  // arredondado em 2 pontos: aparelhos com a lista um pouco diferente chegam na mesma conta
  realMix = Object.fromEntries(GOODS.map(k => [k, Math.round((tot[k] / any) * 50) / 50]));
  realWeight = Math.min(0.5, (cropsList.length || 0) / 40);
  realFrom = Math.floor((Math.max(1, fromMonth || 1) - 1) / SEASON);   // só a safra de agora (o passado fica como foi)
}
export function season(m) {
  const w = Math.max(0, Math.floor((m - 1) / SEASON)), base = npcSeason(w);
  if (!realMix || w < realFrom) return { w, mix: base.mix, mult: base.mult, pressure: Object.fromEntries(GOODS.map(g => [g, +(base.mix[g] / NORMAL[g]).toFixed(2)])) };
  const prev = npcSeason(Math.max(0, w - 1)), mix = Object.fromEntries(GOODS.map(g => [g, base.mix[g] * (1 - realWeight) + realMix[g] * realWeight]));
  return { w, mix, mult: step(prev.mult, mix), pressure: Object.fromEntries(GOODS.map(g => [g, +(mix[g] / NORMAL[g]).toFixed(2)])) };
}

// ---------- crises e eventos ----------
// fases: aviso (🟡) → risco (🟠) → crise (🔴) → recuperação. eff: produto → multiplicador do preço; sector: setor de empresa → demanda
export const EVENTS = {
  superproducao: { cat: 'agrícola', title: g => `Superprodução de ${LABEL[g]}`, why: g => `Com a entrada de muitos produtores, a produção de ${LABEL[g]} bateu recorde. O excesso de oferta pressiona os preços e reduz as margens.`, tips: g => [`diversificar para produtos com pouca oferta`, `segurar o estoque de ${LABEL[g]} só se tiver galpão`, `evitar comprar terra nova para ${LABEL[g]} agora`] },
  greve: { cat: 'logística', title: () => 'Greve nacional dos caminhoneiros', why: () => 'Uma paralisação dos caminhoneiros atrasa o transporte de mercadorias em várias regiões. Quem depende de frete sente primeiro.', eff: { soja: 0.9, milho: 0.9, laranja: 0.88, arroba: 0.93 }, sector: { food: 0.85, cars: 0.9, markets: 0.9 }, up: { jewel: 1.05 }, tips: () => ['guardar a safra no galpão até a estrada liberar', 'evitar vender produto perecível na pressa', 'negócios que não dependem de frete sofrem menos'] },
  ciber: { cat: 'tecnologia', title: () => 'Ataque cibernético de grandes proporções', why: () => 'Um ataque derrubou serviços digitais pelo país. Empresas de tecnologia e bancos enfrentam instabilidade, e clientes procuram alternativas.', sector: { isps: 0.8, banks: 0.85 }, up: { realty: 1.06, auction: 1.05 }, tips: () => ['provedores e bancos podem perder clientes por alguns meses', 'negócios físicos ganham espaço', 'quem segura a operação sai valorizado'] },
  frutas: { cat: 'sanitária', crop: { laranja: 0.75 }, title: () => 'Bactéria suspende venda de frutas', why: () => 'Uma bactéria encontrada em regiões produtoras suspendeu parte da venda de frutas. O setor tem perdas, e outros produtos ganham espaço.', eff: { laranja: 0.75 }, up: { cana: 1.06, milho: 1.04 }, tips: () => ['pomares podem render menos por alguns meses', 'cana e milho ganham demanda', 'não é hora de plantar pomar novo'] },
  geada: { cat: 'clima', crop: { cafe: 0.7 }, title: () => 'Geada forte nas regiões de café', why: () => 'Uma frente fria trouxe geada às regiões cafeeiras. A colheita vai encolher, e o preço do café tende a subir para quem tiver estoque.', eff: { cafe: 1.22 }, tips: () => ['quem tem café estocado pode vender melhor', 'cafezais novos sofrem mais', 'oportunidade para quem plantou em outras regiões'] },
  seca: { cat: 'clima', crop: { soja: 0.8, milho: 0.78 }, title: () => 'Seca prolongada no Centro-Oeste', why: () => 'A falta de chuva derruba a produtividade de grãos. Com menos soja e milho no mercado, os preços sobem, mas quem planta agora arrisca mais.', eff: { soja: 1.15, milho: 1.18 }, sector: { food: 0.94 }, tips: () => ['estoque de grão vale mais', 'ração mais cara pesa na granja e nos suínos', 'irrigação e galpão fazem diferença'] },
  aviaria: { cat: 'sanitária', title: () => 'Gripe aviária fecha mercados', why: () => 'Casos de gripe aviária fecharam compradores de frango por alguns meses. O preço do frango cai; carne bovina e suína ganham espaço.', eff: { frango: 0.78, arroba: 1.06, suino: 1.08 }, tips: () => ['segurar a venda de frango se der', 'boi e suíno ganham demanda', 'evitar novos galpões de frango agora'] },
  imoveis: { cat: 'mercado', title: () => 'Boom imobiliário nas capitais', why: () => 'Juros e emprego em alta aqueceram o mercado de imóveis. Aluguéis sobem e casas valorizam mais rápido.', sector: { realty: 1.15, hotel: 1.06 }, tips: () => ['imobiliárias faturam mais', 'boa hora para vender imóveis caros', 'o boom passa: não compre no topo sem planejar'] },
  dolar: { cat: 'câmbio', title: () => 'Dólar dispara e exportação ganha força', why: () => 'O real perdeu valor. Quem exporta (soja, café, laranja) recebe mais; importados e viagens ficam mais caros.', eff: { soja: 1.1, cafe: 1.12, laranja: 1.08 }, sector: { cars: 0.88, air: 0.92 }, tips: () => ['bom momento para vender grão e café', 'importados vendem menos', 'insumos importados encarecem o plantio'] },
};
export const PHASES = [['aviso', '🟡', 'sinais de atenção'], ['risco', '🟠', 'risco elevado'], ['crise', '🔴', 'crise em andamento'], ['fim', '🟢', 'recuperação']];
// agenda: avaliação de concentração a cada ~24 meses (data varia) + eventos temáticos a cada ~16 meses (nem sempre acontece)
function concentration(j) {
  const m0 = j * 24 + 6 + Math.floor(h(j * 5.1) * 8);            // mês da avaliação (não é fixo)
  const p = season(m0 - 6).pressure, top = GOODS.reduce((a, g) => (p[g] > p[a] ? g : a), GOODS[0]);   // decide no dia do aviso, com o que já dá para ver
  if (p[top] < 1.22) return null;                                   // sem concentração exagerada: sem crise
  const k = Math.min(1, (p[top] - 1.15) / 0.7), dur = 5 + Math.round(k * 7);
  return { id: `c${j}-${top}`, kind: 'superproducao', good: top, start: m0, warn: 6, dur, k, eff: { [top]: +(1 - 0.12 - 0.18 * k).toFixed(2) } };
}
const THEMES = ['greve', 'ciber', 'frutas', 'geada', 'seca', 'aviaria', 'imoveis', 'dolar'];
function themed(j) {
  if (h(j * 9.7 + 1) > 0.65) return null;                          // ~2 em 3 janelas têm evento
  const m0 = j * 16 + 3 + Math.floor(h(j * 2.3) * 10);
  // exposição: produto muito ocupado atrai o evento que o afeta (contaminação quando há muita laranja, geada quando há muito café)
  const p = season(m0).pressure, wt = THEMES.map(t => { const E = EVENTS[t]; let v = 1; for (const g of Object.keys(E.eff || {})) if (p[g]) v += Math.max(0, p[g] - 1) * 2; return v; });
  let r = h(j * 4.4 + 3) * wt.reduce((a, b) => a + b, 0), kind = THEMES[0];
  for (let i = 0; i < THEMES.length; i++) { r -= wt[i]; if (r <= 0) { kind = THEMES[i]; break; } }
  return { id: `t${j}-${kind}`, kind, start: m0, warn: 2, dur: 3 + Math.floor(h(j * 6.6) * 5), k: 0.6 + h(j * 8.1) * 0.4, eff: EVENTS[kind].eff, sector: EVENTS[kind].sector, up: EVENTS[kind].up, crop: EVENTS[kind].crop };
}
// eventos que tocam o mês m (do aviso até 3 meses depois do fim)
export function events(m) {
  const out = [];
  for (let j = Math.max(0, Math.floor(m / 24) - 1); j <= Math.floor(m / 24) + 1; j++) { const e = concentration(j); if (e) out.push(e); }
  for (let j = Math.max(0, Math.floor(m / 16) - 1); j <= Math.floor(m / 16) + 1; j++) { const e = themed(j); if (e) out.push(e); }
  return out.map(e => ({ ...e, phase: phaseOf(e, m) })).filter(e => e.phase).sort((a, b) => a.start - b.start);
}
export function phaseOf(e, m) {
  const a = e.start - e.warn, b = e.start + e.dur;
  if (m < a || m > b + 3) return null;
  if (m < e.start - Math.ceil(e.warn / 2)) return 'aviso';
  if (m < e.start) return 'risco';
  if (m <= b) return 'crise';
  return 'fim';
}
// força do efeito no mês: entra aos poucos, fica, e sai aos poucos na recuperação
const power = (e, m) => (e.phase === 'crise' ? Math.min(1, (m - e.start + 1) / 2) : e.phase === 'fim' ? Math.max(0, 1 - (m - e.start - e.dur) / 3) : 0);
// ---------- resultado do mês: preço de referência e demanda dos setores ----------
export function state(m) {
  const s = season(m), price = { ...s.mult }, sector = {}, crop = {};   // crop: quanto rende a colheita de quem colhe neste mês (1 = normal)
  const evs = events(m);
  for (const e of evs) {
    const p = power(e, m); if (!p) continue;
    for (const [g, v] of Object.entries(e.eff || {})) price[g] = +((price[g] || 1) * (1 + (v - 1) * p)).toFixed(3);
    for (const [g, v] of Object.entries(e.up || {})) { if (GOODS.includes(g) || g === 'frango' || g === 'suino') price[g] = +((price[g] || 1) * (1 + (v - 1) * p)).toFixed(3); else sector[g] = +((sector[g] || 1) * (1 + (v - 1) * p)).toFixed(3); }
    for (const [c, v] of Object.entries(e.sector || {})) sector[c] = +((sector[c] || 1) * (1 + (v - 1) * p)).toFixed(3);
    for (const [g, v] of Object.entries(e.crop || {})) crop[g] = +((crop[g] || 1) * (1 + (v - 1) * p)).toFixed(3);
  }
  const lvl = evs.reduce((a, e) => Math.max(a, { aviso: 1, risco: 2, crise: 3, fim: 0 }[e.phase]), 0);
  return { month: m, mix: s.mix, pressure: s.pressure, price, sector, crop, events: evs, level: lvl };
}
// preenche os multiplicadores que o jogo usa (preço de referência e demanda dos setores) para o mês m
export function apply(m, priceOut, sectorOut, cropOut = {}) {
  const st = state(m);
  for (const o of [priceOut, sectorOut, cropOut]) for (const k of Object.keys(o)) delete o[k];
  Object.assign(priceOut, st.price); Object.assign(sectorOut, st.sector); Object.assign(cropOut, st.crop);
  return st;
}
export const LEVELS = [['🟢', 'mercado estável'], ['🟡', 'sinais de atenção'], ['🟠', 'risco elevado'], ['🔴', 'crise em andamento']];
// manchete e texto da fase (para TV, jornal, avisos)
export function headline(e) {
  const E = EVENTS[e.kind], g = e.good, ph = PHASES.find(p => p[0] === e.phase);
  const title = E.title(g);
  const lead = e.phase === 'aviso' ? `Analistas veem sinais de alerta: ${title.toLowerCase()} pode chegar nos próximos meses.`
    : e.phase === 'risco' ? `Risco elevado: ${title.toLowerCase()} deve começar em breve.`
    : e.phase === 'crise' ? E.why(g) : `${title}: o pior já passou e o mercado se recupera aos poucos.`;
  return { icon: ph[1], level: ph[2], cat: E.cat, title, lead, tips: E.tips(g) };
}
// o que o evento faz de verdade no jogo neste mês, em palavras ("preço do café +22% · colheita de café −30%")
const pct = v => `${v >= 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
export function effectTxt(e, m) {
  const p = power({ ...e, phase: e.phase ?? phaseOf(e, m) }, m), on = p > 0, out = [];
  const k = v => (on ? 1 + (v - 1) * p : v);   // antes da crise: o que vem (efeito cheio); na crise: o de agora
  for (const [g, v] of Object.entries(e.eff || {})) out.push(`preço ${g === 'arroba' ? 'do boi' : `de ${LABEL[g] || g}`} ${pct(k(v))}`);
  for (const [g, v] of Object.entries(e.up || {})) if (LABEL[g]) out.push(`preço ${g === 'arroba' ? 'do boi' : `de ${LABEL[g]}`} ${pct(k(v))}`);
  for (const [g, v] of Object.entries(e.crop || {})) out.push(`colheita de ${LABEL[g] || g} ${pct(k(v))}`);
  for (const [c, v] of Object.entries(e.sector || {})) out.push(`${SECTOR_TXT[c] || c} ${pct(k(v))} de clientes`);
  return out.length ? `${on ? 'Efeito agora' : 'Efeito esperado'}: ${out.join(' · ')}.` : '';
}
// recomendações do momento (informação, não garantia)
export function tips(m) {
  const s = state(m), out = [];
  const sorted = GOODS.map(g => [g, s.pressure[g]]).sort((a, b) => b[1] - a[1]);
  const [hi, lo] = [sorted[0], sorted.at(-1)];
  if (hi[1] >= 1.25) out.push(`O mercado de ${LABEL[hi[0]]} está com sinais de saturação: muita gente produzindo.`);
  if (lo[1] <= 0.8) out.push(`Pouca oferta de ${LABEL[lo[0]]}: os preços tendem a subir. Pode ser hora de diversificar.`);
  for (const [c, v] of Object.entries(s.sector)) if (v >= 1.05) out.push(`Demanda em alta para ${SECTOR_TXT[c] || c}.`); else if (v <= 0.92) out.push(`Demanda fraca para ${SECTOR_TXT[c] || c} por enquanto.`);
  for (const [g, v] of Object.entries(s.price)) if (v >= 1.12) out.push(`Preço de ${LABEL[g] || g} em alta.`); else if (v <= 0.85) out.push(`Preço de ${LABEL[g] || g} em queda.`);
  return [...new Set(out)].slice(0, 5);
}
export const SECTOR_TXT = { food: 'lanchonetes', cars: 'lojas de carro', jewel: 'joalherias', realty: 'imóveis', auction: 'casas de leilão', air: 'aviação', boat: 'marinas', hotel: 'hotéis', isps: 'provedores de internet', banks: 'bancos', markets: 'supermercados' };

// ---------- regiões: saturação e oportunidade ----------
// produto da região conforme a aptidão; para lavoura vale o grão mais ocupado (é onde a concorrência aperta)
export const regionGood = (use, p) => (use === 'café' ? 'cafe' : use === 'pasto' ? 'arroba' : (p.soja >= p.milho ? 'soja' : 'milho'));
// counts: região → quantos lotes de jogadores com conta estão lá (mapa). Esperado = média entre as regiões
export function regionInfo(regions, counts, m) {
  const st = state(m), p = st.pressure, tot = Object.values(counts || {}).reduce((a, b) => a + b, 0), exp = tot / Math.max(1, regions.length);
  return Object.fromEntries(regions.map(r => {
    const g = regionGood(r.use, p), crowd = exp > 0 ? (counts[r.name] || 0) / exp : 1;
    const risk = +(p[g] * (1 + 0.35 * Math.max(0, Math.min(3, crowd - 1)))).toFixed(2);
    // preço da terra: produto procurado e região disputada encarecem; região vazia sai mais barata (incentivo para explorar)
    const k = +Math.max(0.82, Math.min(1.3, (st.price[g] || 1) * (crowd < 0.4 ? 0.88 : 1 + 0.06 * Math.min(3, crowd - 1)))).toFixed(3);
    const tag = risk >= 1.25 ? 'saturada' : crowd < 0.4 ? 'pouco explorada' : p[g] <= 0.85 ? 'em falta' : '';
    return [r.name, { good: g, crowd: +crowd.toFixed(2), risk, k, tag, pressure: p[g] }];
  }));
}
export function saturationAlert(region, info, regions) {
  const me = info[region]; if (!me || me.tag !== 'saturada') return null;
  const alt = regions.filter(r => r.name !== region && info[r.name] && info[r.name].risk < 1.05).sort((a, b) => info[a.name].risk - info[b.name].risk).slice(0, 3);
  const g = LABEL[me.good];
  return { title: '⚠️ ALERTA DE MERCADO: REGIÃO SATURADA',
    text: `Esta região está registrando uma concentração cada vez maior de ${me.good === 'arroba' ? 'criação de boi' : `plantações de ${g}`}${me.crowd > 1.3 ? ` (${Math.round(me.crowd * 10) / 10}× mais lotes de jogadores que a média)` : ''}. A oferta nacional de ${g} está ${Math.round((me.pressure - 1) * 100)}% acima do normal.\n\nCom a entrada de novos produtores, especialistas apontam para uma possível desvalorização de ${g} nos próximos ciclos. Investir aqui pode render menos.`,
    alt: alt.map(r => ({ name: r.name, use: r.use, why: info[r.name].tag === 'pouco explorada' ? 'pouco explorada, terra mais barata' : info[r.name].tag === 'em falta' ? `${LABEL[info[r.name].good]} em falta` : `${LABEL[info[r.name].good]} sem concorrência forte` })) };
}

// ---------- cada jogador do mundo: escolha da safra, resultado e perfil de investidor ----------
// mesma conta do npcMix, para uma pessoa: o produto que ela mais plantou na safra w e quanto da área dela foi nele
export function npcChoice(n, w) {
  const P = PERSONAS[personaOf(n)], fav = favOf(n), prev = w > 0 ? npcSeason(w - 1).mult : npcSeason(0).mult, fever = feverOf(w);
  let sum = 0, best = GOODS[0], bv = -1;
  for (const k of GOODS) {
    let v = NORMAL[k] * Math.max(0.4, 1 + P.chase * ((prev[k] || 1) - 1) * 2.2);
    if (k === fav) v *= 1 + P.stick * 2;
    if (k === fever && P.chase > 0) v *= 1 + P.chase * 1.1;
    if (P.noise) v *= 0.6 + h(n.i * 13 + w * 7 + k.length) * P.noise * 2;
    if (w >= smartW()) v *= (npcSeason(w).mult[k] || 1) ** 2;   // experiente: olha o preço da safra e vai no que paga mais
    sum += v; if (v > bv) { bv = v; best = k; }
  }
  return { good: best, share: bv / sum };
}
// fortuna × resultado das últimas 8 safras (0,8 a 1,2): concentrar no produto que caiu custa caro; crise no produto pesa mais
const perfCache = new Map();
export function npcPerf(n, m) {
  const w = Math.max(0, Math.floor((m - 1) / SEASON)), key = `${n.i}:${w}`;
  if (perfCache.has(key)) return perfCache.get(key);
  let acc = 0, k = 0;
  for (let j = Math.max(0, w - 8); j <= w; j++) { const c = npcChoice(n, j); acc += c.share * ((npcSeason(j).mult[c.good] || 1) - 1); k++; }
  const v = +Math.max(0.78, Math.min(1.25, 1 + 3 * acc / Math.max(1, k))).toFixed(3);
  if (perfCache.size > 6000) perfCache.clear();
  perfCache.set(key, v); return v;
}
PERF.fn = npcPerf;
const RISK = c => (c >= 1.3 ? 'alto' : c >= 0.6 ? 'médio' : c < 0 ? 'médio (compra na baixa)' : 'baixo');
// perfil de investidor de um jogador do mundo: estilo, risco, foco de agora e o que ele fez nas últimas safras
export function npcInvestor(n, m) {
  const P = PERSONAS[personaOf(n)], w = Math.max(0, Math.floor((m - 1) / SEASON)), now = npcChoice(n, w), runs = [];
  for (let j = w; j >= Math.max(0, w - 11); j--) {   // últimas 12 safras em trechos: "3 safras em café, com queda de 12%"
    const c = npcChoice(n, j), mu = npcSeason(j).mult[c.good] || 1, r = runs.at(-1);
    if (r && r.good === c.good) { r.n++; r.mu += mu; } else runs.push({ good: c.good, n: 1, mu });
  }
  const hist = runs.slice(0, 4).map((r, i) => { const avg = r.mu / r.n, d = Math.round((avg - 1) * 100);
    return `${i === 0 ? 'agora: ' : ''}${r.n} ${r.n === 1 ? 'safra' : 'safras'} em ${LABEL[r.good]}${d >= 4 ? `, pegou alta de ${d}%` : d <= -4 ? `, perdeu com queda de ${-d}%` : ''}`; });
  const perf = npcPerf(n, m);
  return { style: P.label, risk: RISK(P.chase), focus: LABEL[now.good], share: Math.round(now.share * 100), perf, trend: perf >= 1.05 ? 'em alta' : perf <= 0.95 ? 'em dificuldade' : 'estável', hist };
}
// o mesmo perfil para quem tem conta, deduzido do que a pessoa mostra (área por produto e empresas)
export function playerInvestor(p) {
  const c = p?.crops || {}, tot = Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0), biz = (p?.biz || []).length;
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0], share = top && tot ? top[1] / tot : 0;
  const style = biz >= 3 && tot < 200 ? 'empresário' : share >= 0.7 ? 'agricultor especializado' : Object.keys(c).length >= 3 ? 'diversifica tudo' : biz ? 'empresário' : tot ? 'produtor' : 'jogador do cassino';
  const st = state(p?.month || 1), hot = top && st.pressure[top[0]] >= 1.25;
  return { style, risk: share >= 0.7 || hot ? 'alto' : share >= 0.45 ? 'médio' : 'baixo', focus: top ? LABEL[top[0]] || top[0] : biz ? 'empresas' : '—', share: Math.round(share * 100), trend: p?.inv?.trend || 'estável', hist: (p?.inv?.hist || []).map(String).slice(0, 4) };
}
