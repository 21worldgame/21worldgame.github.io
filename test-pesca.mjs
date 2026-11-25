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
assert.equal(P.buyRod(s, 1).cost, 1200);
const t0 = 1e12; assert.equal(P.enter(s, 'pesqueiro', t0).cost, 150); assert.equal(P.enter(s, 'pesqueiro', t0 + 60000).cost, 0);
assert.equal(P.enter(s, 'pesqueiro', t0 + P.TICKET_MS + 1).cost, 150);
assert.equal(s.money, 9970 - 1200 - 300);
// arremesso: força vira metros até o arremesso da vara e o tamanho da água; carretilha com força demais embola
assert.equal(P.throwAt('pesqueiro', 1, 1).m, 35); assert.equal(P.throwAt('lagoa', 1, 1).m, 30); assert.equal(P.throwAt('lagoa', 0, 0.5).zone, 0);
assert.ok(P.throwAt('represa', 2, 1, () => 0).backlash); assert.ok(!P.throwAt('represa', 2, 0.9, () => 0).backlash); assert.ok(!P.throwAt('pesqueiro', 1, 1, () => 0).backlash);
// sorteio: só peixe do lugar, dentro do peso; zona puxa a espécie (pintado no fundo, tilápia na beirada)
for (let i = 0; i < 500; i++) { const f = P.roll('pesqueiro', 'massa', i % 3); const F = P.SPECIES[f.sp]; assert.ok(P.SPOTS.pesqueiro.fish[f.sp] && f.kg >= F.min && f.kg <= F.max); }
const share = (z, sp) => Array.from({ length: 3000 }, () => P.roll('pesqueiro', 'massa', z)).filter(f => f.sp === sp).length;
assert.ok(share(2, 'pintado') > share(0, 'pintado') * 2, 'pintado mora no fundo'); assert.ok(share(0, 'tilapia') > share(2, 'tilapia'), 'tilápia na beirada');
// fisgada: cedo = perfeita, tarde = solta
assert.equal(P.hookGrade(0.1).q, 1); assert.equal(P.hookGrade(0.8).q, 0.72); assert.equal(P.hookGrade(1.5).q, 0.72); assert.equal(P.hookGrade(2.5), null);
// briga: jogador bom (solta no vermelho e no salto) traz quase todos; segurar sempre sem fricção arrebenta; fricção errada perde peixe grande
const good = st => st.ten < 0.72 && st.mv !== 'jump' && !(st.warn > 0 && st.next === 'jump');
const fight = (f, rod, drag, play, n = 200) => { const r = {}; for (let i = 0; i < n; i++) { const st = P.newFight(f, rod, Math.min(30, P.RODS[rod].cast), 1); let x = null, t = 0; while (!x && t < 900) { x = P.step(st, play(st), drag, 0.05); t += 0.05; } r[x || 'tempo'] = (r[x || 'tempo'] || 0) + 1; } return r; };
assert.ok((fight({ sp: 'pacu', kg: 6 }, 1, 6, good).land || 0) >= 190, 'pacu com molinete');
assert.ok((fight({ sp: 'pacu', kg: 6 }, 0, 6, () => true).snap || 0) >= 150, 'bambu sem fricção segurando sempre arrebenta');
assert.ok((fight({ sp: 'pirarucu', kg: 80 }, 3, 10, good).snap || 0) >= 190, 'fricção no máximo estoura');
assert.ok((fight({ sp: 'pirarucu', kg: 80 }, 3, 3, good).spool || 0) >= 150, 'fricção frouxa: acaba a linha');
assert.ok((fight({ sp: 'pirarucu', kg: 80 }, 3, 7, good).land || 0) >= 190, 'fricção no meio traz o gigante');
const jumpy = fight({ sp: 'dourado', kg: 8 }, 2, 6, st => st.ten < 0.72);   // não solta no salto
assert.ok((jumpy.throw || 0) > 20, 'quem recolhe no salto perde peixe (cuspiu o anzol)');
assert.ok((fight({ sp: 'traira', kg: 2 }, 1, 6, () => false).unhook || 0) > 100, 'linha frouxa solta o anzol');
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
// experiência: soltar dá 50% a mais; nível sobe
const xp0 = s.pesca.xp; const kx = P.keep(s, { sp: 'pacu', kg: 4 }).xp, rx = P.release(s, { sp: 'pacu', kg: 4 }).xp;
assert.equal(rx, Math.round(kx * 1.5)); assert.equal(s.pesca.xp, xp0 + kx + rx); assert.equal(P.levelOf(P.xpFor(5)), 5);
// encomenda: precisa dos peixes frescos certos e paga acima da peixaria
P.sell(s); s.pesca.orders = [{ id: 'x', who: 'Bar', sp: 'tilapia', n: 2, min: 1, x: 1.5, m: 1 }];
P.keep(s, { sp: 'tilapia', kg: 1.2 }); assert.ok(P.deliver(s, 'x').err);
P.keep(s, { sp: 'tilapia', kg: 0.5 }); P.keep(s, { sp: 'tilapia', kg: 1.4 });
{ const base = Math.round((1.2 + 1.4) * P.priceKg(s, 'tilapia')), m2 = s.money, d = P.deliver(s, 'x'); assert.ok(Math.abs(d.v - base * 1.5) <= 2); assert.equal(s.money, m2 + d.v); assert.equal(s.pesca.box.length, 1); assert.equal(s.pesca.orders.length, 0); }
P.monthly(s, () => 0.3); assert.equal(s.pesca.orders.length, 3, 'encomendas novas no mês');
// tempo do mês e hora: iguais para todos
assert.deepEqual(P.weatherOf(7), P.weatherOf(7)); assert.ok(P.hourBite(6) < 1 && P.hourBite(12) > 1);
console.log('pesca ok');
// cansaço depois de 2 h no dia; dia novo zera
{ const t = { money: 0 }; assert.equal(P.fatigue(t, 'd1'), 1); P.fished(t, 'd1', 3 * 3600); assert.equal(P.fatigue(t, 'd1'), 4); assert.equal(P.fatigue(t, 'd2'), 1); }
// celular + computador: a junção somou números; ensure devolve valores válidos
{ const t = { money: 0, pesca: { rods: [0, 1, 1, 9], rod: 3, cooler: 5, drag: 17, baits: { minhoca: -2 }, box: [], tickets: {}, mkt: {}, best: { pacu: 99 } } }; P.ensure(t);
  assert.deepEqual(t.pesca.rods, [0, 1]); assert.equal(t.pesca.rod, 1); assert.equal(t.pesca.cooler, 3); assert.equal(t.pesca.drag, 10); assert.equal(t.pesca.baits.minhoca, 0); assert.equal(t.pesca.best.pacu, 9);
  t.pesca.tickets.pesqueiro = Date.now() + 2 * P.TICKET_MS; assert.ok(P.ticketLeft(t, 'pesqueiro') <= P.TICKET_MS); }
{ const { merge3 } = await import('./sync-merge.js'); const b = { month: 1, pesca: { rod: 0, cooler: 0, n: 5, tickets: { pesqueiro: 100 } } };
  const m = merge3(b, { month: 1, pesca: { rod: 1, cooler: 1, n: 7, tickets: { pesqueiro: 300 } } }, { month: 1, pesca: { rod: 2, cooler: 2, n: 6, tickets: { pesqueiro: 200 } } });
  assert.equal(m.pesca.rod, 2); assert.equal(m.pesca.cooler, 2); assert.equal(m.pesca.n, 8); assert.equal(m.pesca.tickets.pesqueiro, 300); }
console.log('pesca: cansaço e dois aparelhos ok');
// mural de troféus: maiores capturas (troféu ou recorde), no máximo 8, do maior para o menor
{ const t = { money: 0 }; P.ensure(t); for (const kg of [2, 1, 3, 2.5]) P.release(t, { sp: 'pacu', kg, spot: 'x', at: 1 });
  assert.deepEqual(t.pesca.wall.map(w => w.kg), [3, 2]); assert.ok(t.pesca.wall[0].cm > 30 && t.pesca.wall[0].cm < 80);
  for (let i = 0; i < 12; i++) P.release(t, { sp: 'tilapia', kg: 0.5, trophy: true }); assert.equal(t.pesca.wall.length, P.WALL);
  assert.ok(P.tipFor('represa', P.WEATHER[0]).length > 10); }
console.log('pesca: mural ok');
// loja: isca recomendada por lugar e as iscas novas puxam os peixes certos
{ assert.equal(P.bestBait('lagoa'), 'minhoca'); assert.equal(P.bestBait('represa'), 'viva');
  const t = { money: 1000 }; assert.equal(P.buyBait(t, 'artificial', 2).n, 10); assert.equal(t.money, 760);
  const tuc = b => Array.from({ length: 4000 }, () => P.roll('represa', b, 1)).filter(f => f.sp === 'tucunare').length;
  assert.ok(tuc('artificial') > tuc('massa') * 1.3, 'artificial puxa tucunaré'); assert.ok(P.baitFish('racao').includes('tambacu')); }
console.log('pesca: lojinha ok');
