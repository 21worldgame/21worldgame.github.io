// node test-pesca.mjs — regras do pesqueiro (pesca.js)
import assert from 'node:assert/strict';
import * as P from './pesca.js';

const s = { money: 10000, month: 1 }; P.ensure(s);
// lagoa grátis com a vara de bambu; represa pede carretilha
assert.deepEqual(P.enter(s, 'lagoa'), { cost: 0 });
assert.ok(P.enter(s, 'represa').err);
// sem isca não lança; isca sai 1 por lançamento
assert.ok(P.cast(s, 'lagoa', 'minhoca').err);
assert.equal(P.buyBait(s, 'minhoca').cost, 30); assert.equal(s.money, 9970);
assert.ok(P.cast(s, 'lagoa', 'minhoca').ok); assert.equal(s.pesca.baits.minhoca, 19);
// entrada do pesque-pague cobra uma vez e vale 30 min
assert.ok(P.buyRod(s, 1).cost === 1200);
const t0 = 1e12; assert.equal(P.enter(s, 'pesqueiro', t0).cost, 150); assert.equal(P.enter(s, 'pesqueiro', t0 + 60000).cost, 0);
assert.equal(P.enter(s, 'pesqueiro', t0 + P.TICKET_MS + 1).cost, 150);
assert.equal(s.money, 9970 - 1200 - 300);
// sorteio fica dentro do peso da espécie e só sai peixe do lugar
for (let i = 0; i < 500; i++) { const f = P.roll('pesqueiro', 'massa'); const F = P.SPECIES[f.sp]; assert.ok(P.SPOTS.pesqueiro.fish[f.sp] && f.kg >= F.min && f.kg <= F.max); }
// briga: puxar sem parar arrebenta; puxar e soltar na hora certa traz o peixe
const big = { sp: 'pacu', kg: 6 };
{ const st = P.newFight(big, 1); let r; while (!(r = P.step(st, true, 0.05, () => 0.5))); assert.equal(r, 'snap'); }
{ let ok = 0; for (let i = 0; i < 300; i++) { const st = P.newFight(big, 1); let r; while (!(r = P.step(st, st.tension < 70, 0.05))); if (r === 'land') ok++; } assert.ok(ok > 240, `trouxe ${ok}/300`); }
// nunca puxar: o peixe leva a linha
{ const st = P.newFight(big, 1); let r; while (!(r = P.step(st, false, 0.05, () => 0.5))); assert.equal(r, 'lost'); }
// caixa térmica: limite de peso, envelhece e estraga; troféu vale mais
assert.ok(P.keep(s, { sp: 'carpa', kg: 16 }).err);                       // isopor = 15 kg
assert.ok(P.keep(s, { sp: 'pacu', kg: 5, trophy: false }).ok);
const fresh = P.fishValue(s, s.pesca.box[0]); assert.equal(fresh, Math.round(5 * P.priceKg(s, 'pacu')));
assert.equal(P.fishValue(s, { sp: 'pacu', kg: 5, trophy: true, age: 0 }), Math.round(fresh * 1.5));
P.monthly(s, () => 0.5); assert.equal(P.fishValue(s, s.pesca.box[0]), Math.round(5 * P.priceKg(s, 'pacu') * (1 - P.SPOIL)));
for (let i = 0; i < P.SPOIL_MAX; i++) P.monthly(s, () => 0.5);
assert.equal(s.pesca.box.length, 0);                                       // estragou
// venda leva o dinheiro e esvazia a caixa
P.keep(s, { sp: 'tilapia', kg: 2 }); const m = s.money, v = P.value(s), r = P.sell(s);
assert.equal(r.v, v); assert.equal(s.money, m + v); assert.equal(s.pesca.box.length, 0);
console.log('pesca ok');
// cansaço depois de 2 h no dia; dia novo zera
{ const t = { money: 0 }; assert.equal(P.fatigue(t, 'd1'), 1); P.fished(t, 'd1', 3 * 3600); assert.equal(P.fatigue(t, 'd1'), 4); assert.equal(P.fatigue(t, 'd2'), 1); }
// celular + computador: a junção somou números; ensure devolve valores válidos
{ const t = { money: 0, pesca: { rods: [0, 1, 1, 9], rod: 3, cooler: 5, baits: { minhoca: -2 }, box: [], tickets: {}, mkt: {}, best: { pacu: 99 } } }; P.ensure(t);
  assert.deepEqual(t.pesca.rods, [0, 1]); assert.equal(t.pesca.rod, 1); assert.equal(t.pesca.cooler, 3); assert.equal(t.pesca.baits.minhoca, 0); assert.equal(t.pesca.best.pacu, 9);
  t.pesca.tickets.pesqueiro = Date.now() + 2 * P.TICKET_MS; assert.ok(P.ticketLeft(t, 'pesqueiro') <= P.TICKET_MS); }
{ const { merge3 } = await import('./sync-merge.js'); const b = { month: 1, pesca: { rod: 0, cooler: 0, n: 5, tickets: { pesqueiro: 100 } } };
  const m = merge3(b, { month: 1, pesca: { rod: 1, cooler: 1, n: 7, tickets: { pesqueiro: 300 } } }, { month: 1, pesca: { rod: 2, cooler: 2, n: 6, tickets: { pesqueiro: 200 } } });
  assert.equal(m.pesca.rod, 2); assert.equal(m.pesca.cooler, 2); assert.equal(m.pesca.n, 8); assert.equal(m.pesca.tickets.pesqueiro, 300); }
console.log('pesca: cansaço e dois aparelhos ok');
