// node test-cidade.mjs — noticiário programado da cidade: horários variados, iguais em todo aparelho, textos sem buraco
import assert from 'node:assert/strict';
import * as C from './cidade.js';
import * as W from './world.js';

const t0 = Date.UTC(2026, 10, 24, 3), t1 = t0 + 48 * 36e5;   // 48 h a partir da meia-noite de Brasília
const a = C.due(t0, t1), b = C.due(t0, t1);
assert.deepEqual(a, b, 'mesma agenda em qualquer aparelho');
assert.deepEqual([...C.due(t0, t0 + 10 * 36e5), ...C.due(t0 + 10 * 36e5, t1)].map(x => x.id), a.map(x => x.id), 'cortar a janela no meio não perde nem repete boletim');

const ed = a.filter(x => x.type === 'edicao'), fl = a.filter(x => ['lider', 'podio', 'disputa', 'clube', 'cidade'].includes(x.type)), dl = a.filter(x => x.type === 'negocio');
assert.equal(ed.length, 6, '3 edições por dia');
for (const e of ed) { const h = C.hourBR(e.at), want = e.ed.h; assert.ok(Math.abs(h - want) <= 0.14, `edição ${e.ed.name} fora do horário: ${h}`); }
assert.ok(new Set(ed.filter(e => e.ed.k === 'meiodia').map(e => e.at % 864e5)).size === 2, 'o horário varia de um dia para o outro');
assert.ok(fl.length >= 40 && fl.length <= 90, `plantões em 48 h: ${fl.length}`);
assert.ok(dl.length >= 50 && dl.length <= 110, `negócios em 48 h: ${dl.length}`);
for (let i = 1; i < a.length; i++) assert.ok(a[i].at >= a[i - 1].at, 'em ordem de horário');
assert.equal(new Set(a.map(x => x.id)).size, a.length, 'ids únicos');
const night = a.filter(x => x.type !== 'edicao' && C.hourBR(x.at) < 6).length / a.filter(x => x.type !== 'edicao').length;
assert.ok(night < 0.17, `madrugada mais calma: ${night}`);
const gaps = a.filter(x => x.type !== 'negocio').map(x => x.at), gap = gaps.slice(1).map((x, i) => x - gaps[i]);
assert.ok(new Set(gap.map(g => Math.round(g / 6e4))).size > 20, 'intervalos variados, nada de relógio batido');

// negócios: do tamanho da fortuna de quem fecha, com texto pronto
const w = W.DEFAULT, monthAt = t => W.current(w, t) + W.progress(w, t);
const late = Date.UTC(2026, 11, 30), deals = C.dealsBetween(late - 864e5, late, monthAt);
assert.ok(deals.length > 10, `negócios em 24 h: ${deals.length}`);
for (const d of deals) { assert.ok(d.name && d.what && d.text && d.lead && Number.isFinite(d.val) && d.val !== 0, JSON.stringify(d)); assert.ok(Math.abs(d.val) <= d.worth * 1.2, `negócio maior que a fortuna: ${d.text}`); assert.ok(!/undefined|NaN/.test(d.text + d.lead)); }
assert.ok(Math.abs(deals[0].val) >= Math.abs(deals.at(-1).val), 'maior negócio primeiro');

// fortuna: textos
const rows = [['Ana', 5.2e8], ['Beto', 4.9e8], ['Caio', 1.2e8], ['Dani', 8e6], ['Edu', 2e6], ['Fabi', 3e5]].map(([name, worth]) => ({ name, worth }));
const c = { rows, online: 97, monthAt };
for (const type of ['lider', 'podio', 'disputa', 'clube', 'cidade']) {
  const x = C.build({ id: 'x', type, at: late }, c);
  assert.ok(x && x.text.length > 20 && x.lead.length > 20 && !/undefined|NaN/.test(x.text + x.lead), type + ': ' + JSON.stringify(x));
}
assert.match(C.build({ id: 'x', type: 'clube', at: late }, c).text, /3 membros: Ana, Beto e Caio/);
assert.match(C.build({ id: 'x', type: 'disputa', at: late }, c).text, /separam Ana e Beto/);
assert.match(C.build({ id: 'x', type: 'disputa', at: late }, { ...c, rows: [{ name: 'Ana', worth: 9e8 }, { name: 'Beto', worth: 1e8 }] }).text, /Ana/, 'disputa sem disputa vira líder');
assert.equal(C.build({ id: 'x', type: 'lider', at: late }, { ...c, rows: [] }), null, 'sem ranking, sem boletim de fortuna');
assert.match(C.build({ id: 'x', type: 'clube', at: late }, { ...c, rows: [{ name: 'Ana', worth: 4e6 }] }).lead, /Faltam R\$ 96 mi/);

// edição completa
const e = C.edition({ id: 'edx', at: late, ed: C.EDITIONS[1] }, c, deals);
assert.ok(e.slides.length >= 4 && e.slides.every(s => s.img && s.title && s.lead), 'páginas do jornal');
assert.match(e.item.text, /Jornal do Meio-Dia no ar: Ana lidera/); assert.equal(e.item.kind, 'edicao');
const vazio = C.edition({ id: 'edy', at: late, ed: C.EDITIONS[0] }, { rows: [], online: 20, monthAt }, []);
assert.ok(vazio.slides.length >= 1 && /Bom dia 21 no ar/.test(vazio.item.text), 'edição com a cidade vazia não quebra');
const g = C.gazeta(c, late, deals); assert.equal(g.top.length, 5); assert.equal(g.stats.club, 3); assert.equal(g.stats.mi, 5);
console.log(`cidade ok: ${ed.length} edições, ${fl.length} plantões e ${dl.length} negócios em 48 h; exemplo: ${deals[0].text}`);
