// Redação da cidade (regras puras, sem tela): o noticiário programado da TV 21 e da Gazeta da página inicial.
// Tudo depende só do relógio e do ranking, então todo aparelho agenda os mesmos boletins nos mesmos horários:
//  · 3 edições por dia (Bom dia 21, Jornal do Meio-Dia, Jornal 21 Noite), com atraso ou adianto de até 8 min por dia;
//  · plantões da fortuna (quem manda na cidade, pódio, disputa pelo topo, Clube dos 100 milhões, movimento da cidade), em horas quebradas;
//  · grandes negócios fechados pelos jogadores do mundo, do tamanho da fortuna de cada um.
import { CARS, REGIONS } from './logic.js';
import { CLUBS, clubPrice } from './futebol.js';
import { LISTS } from './negocios.js';
import { NPCS, startMonth, worthAt, isAway } from './npcs.js';
import { short } from './news.js';

const H = 36e5, DAY = 864e5, MIN = 6e4, BRT = -3 * H;
export const DEAL_SLOT = 12 * MIN;
const hash = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const vary = (arr, seed) => arr[Math.floor(hash(seed) * arr.length) % arr.length];
export const hourBR = t => (((t + BRT) / H) % 24 + 24) % 24;
export const periodOf = t => { const h = hourBR(t); return h < 5 ? 'madrugada' : h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite'; };

export const EDITIONS = [
  { k: 'manha', h: 7.5, name: 'Bom dia 21', greet: 'Bom dia' },
  { k: 'meiodia', h: 12, name: 'Jornal do Meio-Dia', greet: 'Boa tarde' },
  { k: 'noite', h: 19.5, name: 'Jornal 21 Noite', greet: 'Boa noite' },
];
const FLASH = ['lider', 'lider', 'podio', 'disputa', 'clube', 'cidade'];

// o que vai ao ar entre `from` (exclusive) e `to` (inclusive), em ordem de horário
export function due(from, to) {
  const out = [];
  for (let d = Math.floor((from + BRT) / DAY) - 1; d <= Math.floor((to + BRT) / DAY); d++) EDITIONS.forEach((e, i) => {
    const at = Math.round(d * DAY - BRT + (e.h + (hash(d * 3 + i + 11) * 2 - 1) * 0.13) * H);
    if (at > from && at <= to) out.push({ id: `ed${d}${e.k}`, type: 'edicao', at, ed: e });
  });
  for (let h = Math.floor(from / H) - 1; h <= Math.floor(to / H); h++) for (let w = 0; w < 2; w++) {   // 2 janelas de 30 min por hora, mais raras de madrugada
    if (hash(h * 7 + w * 3 + 5) > (hourBR(h * H + 1) < 6 ? 0.35 : 0.8)) continue;
    const at = h * H + w * 30 * MIN + MIN + Math.floor(hash(h * 11 + w + 2) * 28 * MIN);
    if (at > from && at <= to) out.push({ id: `fl${h}${w}`, type: FLASH[Math.floor(hash(h * 13 + w * 5 + 9) * FLASH.length)], at });
  }
  for (let s = Math.floor(from / DEAL_SLOT) - 1; s <= Math.floor(to / DEAL_SLOT); s++) {
    if (hash(s * 17 + 3) > (hourBR(s * DEAL_SLOT) < 6 ? 0.2 : 0.4)) continue;
    const at = s * DEAL_SLOT + Math.floor(hash(s * 19 + 7) * DEAL_SLOT);
    if (at > from && at <= to) out.push({ id: `dl${s}`, type: 'negocio', at, slot: s });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- grandes negócios ----------
const cars = Object.values(CARS).filter(c => c.type !== 'maquina').sort((a, b) => a.price - b.price);
const brands = Object.values(LISTS).flatMap(L => Object.values(L)).filter(b => b?.name && b.price).sort((a, b) => a.price - b.price);
const clubs = Object.values(CLUBS).flat().map(c => ({ n: c.n, price: clubPrice(c.n) })).sort((a, b) => a.price - b.price);
const fit = (list, v) => { const ok = list.filter(x => x.price <= v); return ok.length ? ok.slice(-3) : null; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const title = t => t.replace(/(^|\s)(\p{L})(\p{L}*)/gu, (m, sp, a, b) => (/^(do|da|de|dos|das)$/.test(a + b) ? m : sp + a.toUpperCase() + b));   // pantanal, mato grosso do sul -> Pantanal, Mato Grosso do Sul
const land = (r, v) => { const g = [pick(r, REGIONS), pick(r, REGIONS), pick(r, REGIONS)].sort((a, b) => a.perHa - b.perHa)[0], q = v / g.perHa, ha = q >= 20 ? Math.round(q / 10) * 10 : Math.max(1, Math.round(q));   // a mais barata de 3 sorteadas: terra cabe no bolso
  return { kind: 'compra', what: `${ha.toLocaleString('pt-BR')} ha de terra em ${title(g.name)}`, val: -g.perHa * ha }; };
const KINDS = [
  land,
  (r, v) => { const c = fit(cars, v); if (!c) return land(r, v); const x = pick(r, c); return { kind: 'compra', what: `um ${x.name} zero quilômetro`, val: -x.price }; },
  (r, v) => { const c = fit(clubs, v); if (!c) return land(r, v); const x = pick(r, c); return { kind: 'compra', what: `o comando do ${x.n}`, val: -x.price }; },
  (r, v) => { const c = fit(brands, v); if (!c) return land(r, v); const x = pick(r, c); return { kind: 'compra', what: `a marca ${x.name}`, val: -x.price }; },
  (r, v) => { const n = Math.max(10, Math.round(v / 6000 / 10) * 10), p = pick(r, [5600, 6000, 6400]); return { kind: 'venda', what: `${n.toLocaleString('pt-BR')} bois gordos no frigorífico`, val: n * p }; },
  (r, v) => { const s = Math.max(100, Math.round(v / 150 / 100) * 100); return { kind: 'venda', what: `${s.toLocaleString('pt-BR')} sacas de soja`, val: s * 150 }; },
];
const T_COMPRA = [(n, w, v) => `${n} fecha a compra de ${w} por ${v}`, (n, w, v) => `Negócio de peso: ${n} leva ${w} por ${v}`, (n, w, v) => `${n} desembolsa ${v} e fica com ${w}`];
const T_VENDA = [(n, w, v) => `${n} vende ${w} e embolsa ${v}`, (n, w, v) => `Venda de peso: ${n} fatura ${v} com ${w}`, (n, w, v) => `${n} fecha a venda de ${w} por ${v}`];
// o negócio de um horário (null se nenhum jogador do mundo estava em condições de fechar algo grande)
export function dealOf(d, monthAt) {
  const month = monthAt(d.at), pool = NPCS.filter(n => month >= startMonth(n) && !isAway(n, d.at));
  if (!pool.length) return null;
  let best = null, bw = 0;
  for (let k = 0; k < 3; k++) { const n = pool[Math.floor(hash(d.slot * 31 + k * 7 + 1) * pool.length)], w = worthAt(n, month, d.at); if (w > bw) { best = n; bw = w; } }   // 3 sorteados: o mais rico fecha o negócio
  const v = bw * (0.04 + hash(d.slot * 5 + 3) * 0.26);
  if (v < 8000) return null;
  const r = rng(d.slot * 2246822519 + 13), x = KINDS[Math.floor(hash(d.slot * 23 + 5) * KINDS.length)](r, v), name = best.nick, val = Math.round(x.val), money = short(val);
  if (Math.abs(val) > bw * 0.9) return null;   // nunca maior que o bolso de quem fecha
  const text = (x.kind === 'venda' ? T_VENDA : T_COMPRA)[Math.floor(hash(d.slot * 29 + 1) * 3)](name, x.what, money);
  return { id: d.id, kind: 'negocio', name, what: x.what, val, text, at: d.at, worth: bw,
    lead: `A operação equivale a ${Math.max(1, Math.round(Math.abs(val) / bw * 100))}% do patrimônio de ${name}, hoje na casa de ${short(bw)}.` };
}
// todos os negócios de um período (o maior primeiro): alimenta "Negócios do dia" da Gazeta e as edições
export function dealsBetween(from, to, monthAt) {
  return due(from, to).filter(d => d.type === 'negocio').map(d => dealOf(d, monthAt)).filter(Boolean).sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
}

// ---------- fortuna: boletins a partir do ranking ----------
// rows: [{ name, worth }] do maior para o menor (jogadores de verdade e do mundo juntos)
const names = (rows, n) => { const a = rows.slice(0, n).map(r => r.name); return a.length > 1 ? `${a.slice(0, -1).join(', ')} e ${a.at(-1)}` : a[0] || ''; };
function lider(d, c) {
  const [a, b] = c.rows; if (!a) return null;
  return { text: vary([`${a.name} segue no topo: a maior fortuna da cidade é de ${short(a.worth)}`, `Quem manda na cidade? ${a.name}, com ${short(a.worth)} em patrimônio`, `Maior fortuna do 21 World: ${a.name} lidera com ${short(a.worth)}`], d.at),
    lead: b ? `${b.name} vem logo atrás, a ${short(a.worth - b.worth)} de distância. São ${c.rows.length} moradores na disputa pelo ranking da cidade.` : `Ninguém chegou perto: ${a.name} corre sozinho no topo do ranking.`, name: a.name, val: a.worth };
}
function podio(d, c) {
  const [a, b, x] = c.rows; if (!x) return lider(d, c);
  const top = c.rows.slice(0, 10).reduce((t, r) => t + r.worth, 0), three = a.worth + b.worth + x.worth;
  return { text: `Pódio da riqueza: ${a.name}, ${b.name} e ${x.name} comandam a cidade`,
    lead: `${a.name} (${short(a.worth)}), ${b.name} (${short(b.worth)}) e ${x.name} (${short(x.worth)}). Os três juntos concentram ${Math.round(three / top * 100)}% da fortuna dos dez mais ricos.`, name: a.name, val: three };
}
function disputa(d, c) {
  const [a, b] = c.rows; if (!b || (a.worth - b.worth) / a.worth > 0.12) return lider(d, c);
  return { text: `Disputa pelo topo: só ${short(a.worth - b.worth)} separam ${a.name} e ${b.name}`,
    lead: `${a.name} tem ${short(a.worth)} e ${b.name}, ${short(b.worth)}. A cidade inteira acompanha quem vai segurar a liderança.`, name: a.name, val: a.worth };
}
function clube(d, c) {
  const m = c.rows.filter(r => r.worth >= 1e8), a = c.rows[0]; if (!a) return null;
  if (m.length) return { text: `Clube dos 100 milhões tem ${m.length} ${m.length === 1 ? 'membro' : 'membros'}: ${names(m, 3)}`, lead: `${m.length === 1 ? 'É o único morador' : `São ${m.length} moradores`} acima dos R$ 100 milhões. A maior fortuna é de ${a.name}, com ${short(a.worth)}.`, name: a.name, val: a.worth };
  return { text: 'Clube dos 100 milhões segue de portas fechadas', lead: `${a.name} é quem chega mais perto, com ${short(a.worth)}. Faltam ${short(1e8 - a.worth)} para a primeira vaga no clube.`, name: a.name, val: a.worth };
}
function cidade(d, c) {
  const a = c.rows[0], mi = c.rows.filter(r => r.worth >= 1e6).length;
  return { text: vary([`Cidade movimentada: ${c.online} jogadores online agora`, `${c.online} moradores circulando pelo 21 World neste momento`], d.at),
    lead: `${c.rows.length} moradores no ranking${mi ? `, ${mi} deles milionários` : ''}.${a ? ` A maior fortuna é de ${a.name}, com ${short(a.worth)}.` : ''}` };
}
const FORT = { lider, podio, disputa, clube, cidade };
// boletim de plantão pronto para a TV (null se não há dados para ele)
export function build(d, c) {
  if (d.type === 'negocio') return dealOf(d, c.monthAt);
  const f = FORT[d.type]?.(d, c); if (!f) return null;
  return { id: d.id, kind: d.type === 'cidade' ? 'cidade' : 'fortuna', at: d.at, ...f };
}

// ---------- edições ----------
// devolve o item da TV e as páginas do Jornal 21 (foto, chamada, manchete e texto)
export function edition(d, c, deals = []) {
  const e = d.ed, [a] = c.rows, slides = [];
  const add = (img, kind, f) => f && slides.push({ img, kind, title: f.text, lead: f.lead });
  for (const x of (c.econ || []).slice(0, 2)) slides.push({ img: 'assets/farm-colheita.webp', kind: x.phase === 'crise' ? 'alerta' : 'economia', title: `${x.icon} ${x.title}`, lead: `${x.lead} ${x.effect}`.trim() });   // economia primeiro: mexe no bolso de todo mundo
  add('assets/photo-vegas.webp', 'fortuna', lider(d, c));
  if (c.rows.length > 2) slides.push({ img: 'assets/photo-chips.webp', kind: 'fortuna', title: 'Os mais ricos da cidade', lead: c.rows.slice(0, 5).map((r, i) => `${i + 1}º ${r.name}, ${short(r.worth)}`).join(' · ') + '.' });
  if (deals.length) slides.push({ img: 'assets/news/news-export.webp', kind: 'negocio', title: `Negócio do dia: ${deals[0].text}`, lead: `${deals[0].lead}${deals.length > 1 ? ` Também no balanço: ${deals.slice(1, 3).map(x => x.text).join('; ')}.` : ''}` });
  add('assets/car-porsche.webp', 'fortuna', clube(d, c));
  add('assets/farm-colheita.webp', 'cidade', cidade(d, c));
  return { slides, intro: { greet: e.greet, name: e.name, text: a ? `Na pauta desta edição: ${(c.econ || []).length ? 'a economia que mexe nas lavouras e nos preços, ' : ''}a fortuna dos moradores, os grandes negócios fechados e o movimento da cidade. Hoje, ${a.name} lidera o ranking com ${short(a.worth)}.` : 'Na pauta desta edição: o movimento da cidade e os grandes negócios do 21 World.' },
    item: { id: d.id, kind: 'edicao', at: d.at, name: e.name, text: a ? `${e.name} no ar: ${a.name} lidera a cidade com ${short(a.worth)}` : `${e.name} no ar: acompanhe as notícias da cidade`,
      lead: `${slides.length} reportagens: ${slides.slice(0, 3).map(s => s.title).join(' | ')}` } };
}

// ---------- Gazeta (página inicial) ----------
// manchete do dia: o plantão da fortuna mais recente, ou o líder do ranking se nada foi ao ar ainda
export function gazeta(c, now, deals = []) {
  const top = c.rows.slice(0, 5), mi = c.rows.filter(r => r.worth >= 1e6).length;
  return { period: periodOf(now), top, deals: deals.slice(0, 3), econ: (c.econ || []).slice(0, 2), lead: lider({ at: Math.floor(now / H) * H }, c),
    stats: { pop: c.rows.length, online: c.online, mi, club: c.rows.filter(r => r.worth >= 1e8).length } };
}
