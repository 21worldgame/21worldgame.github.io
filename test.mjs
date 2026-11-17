// node test.mjs
import assert from 'node:assert/strict';
import * as L from './logic.js';

const c = (...rs) => rs.map(r => ({ r, s: '♠' }));
assert.equal(L.handValue(c('A', 'K')), 21);
assert.equal(L.handValue(c('A', 'A', '9')), 21);
assert.equal(L.handValue(c('K', 'Q', '5')), 25);
assert.equal(L.newDeck().length, 52);

// vencedor leva o pote menos 5%; empate divide; todos estourados recebem de volta menos a taxa
assert.deepEqual(L.settle([{ bet: 500, value: 21 }, { bet: 500, value: 19 }, { bet: 500, value: 23 }]), [1425, 0, 0]);
assert.deepEqual(L.settle([{ bet: 100, value: 20 }, { bet: 100, value: 20 }]), [95, 95]);
assert.deepEqual(L.settle([{ bet: 100, value: 22 }, { bet: 100, value: 25 }]), [95, 95]);

// gado sem pasto paga ração; com pasto engorda 18 kg
const s = L.newState(() => 0.5);
s.herd.push({ id: 1, heads: 10, kg: 180 });
const before = s.money;
L.tick(s, () => 0.5);
assert.equal(s.money, before - 1500);
assert.equal(s.herd[0].kg, 188);
s.lands.push({ id: 2, own: true, region: 'x', ha: 10, value: 100000, leasedOut: false });
L.tick(s, () => 0.5);
assert.equal(s.herd[0].kg, 206);

// calote de banco por 2 meses sem dinheiro executa a terra
s.money = 0; s.loans.push({ id: 3, bal: 50000, rate: 0.018, left: 6, missed: 0 });
L.tick(s, () => 0.5); L.tick(s, () => 0.5);
assert.equal(s.lands.length, 0);
// fichas por valor
assert.deepEqual(L.breakChips(1630), { 1000: 1, 500: 1, 100: 1, 25: 1, 5: 1 });
assert.deepEqual(L.breakChips(95), { 25: 3, 5: 4 });

// lavoura: terra plantada não é pasto; colhe no prazo; trator barateia
const f = L.newState(() => 0.5);
f.money = 1e6;
const lot = { id: 9, own: true, region: 'cerrado, goiás', ha: 10, cap: 0.9, value: 220000 };
f.lands.push(lot);
assert.equal(L.capacity(f), 9);
assert.equal(L.plant(f, lot, 'soja'), null);
assert.equal(f.money, 1e6 - 45000);
assert.equal(L.capacity(f), 0);
for (let i = 0; i < 4; i++) L.tick(f, () => 0.5);
assert.equal(f.stock.soja, 600);
assert.equal(lot.crop, undefined);
f.cars.push({ id: 10, model: 'deere', value: 650000 });
assert.equal(L.plantCost(f, 'soja', 10), 38250);

// carro desvaloriza 1,5% e paga IPVA/seguro
const g = L.newState(() => 0.5);
g.cars.push({ id: 1, model: 'onix', value: 95000 });
const m0 = g.money;
L.tick(g, () => 0.5);
assert.equal(g.cars[0].value, 93575);
assert.equal(Math.round(m0 - g.money), 380);
// progressão: missão, nível com prêmio, conquista, bônus diário
import * as P from './progress.js';
const h = L.newState(() => 0.5);
P.ensure(h, '2026-11-16');
assert.equal(h.missions.list.length, 3);
h.missions.list[0] = { id: 'hands5', prog: 0, claimed: false };
for (let i = 0; i < 5; i++) P.track(h, 'hand');
assert.equal(P.claimMission(h, 'hands5'), 300);
assert.equal(P.claimMission(h, 'hands5'), 0);
assert.ok(h.ach.includes('first-hand'));
const r = P.track(h, 'land', 2);               // 50 xp cada -> 150 de 100 => sobe para o nível 2
assert.deepEqual(r.levels, [2]);
assert.equal(P.claimDaily(h, '2026-11-16', '2026-11-15'), 200);
assert.equal(P.claimDaily(h, '2026-11-16', '2026-11-15'), 0);
assert.equal(P.claimDaily(h, '2026-11-17', '2026-11-16'), 400);

// corrida: a casa tem margem; ordem de chegada completa; pagamento
import * as R from './race.js';
const race = R.newRace(() => 0.37);
assert.ok(race.dogs.reduce((a, d) => a + 1 / d.odds, 0) > 1);
const order = R.runRace(race, () => 0.1);
assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4, 5]);
assert.equal(R.payout(race, order, { dog: order[0], type: 'win', amount: 100 }), Math.floor(100 * race.dogs[order[0]].odds));
assert.equal(R.payout(race, order, { dog: order[5], type: 'place', amount: 100 }), 0);

const times = R.officialTimes(order, () => 0.5);
assert.ok(order.every((d, k) => !k || times[d] > times[order[k - 1]]));
assert.ok(times[order[0]] > 28 && times[order[5]] < 32);
assert.equal(R.margin(0.005), 'por um focinho');
assert.equal(R.margin(0.21), 'por 3 corpos');

// motor da mesa: 1 humano + 3 bots jogam uma mão inteira
import { Table } from './table.js';
await new Promise(done => {
  const t = new Table({ id: 't', name: 'teste', minBet: 50, speed: 0.001, onChange: v => {
    if (v.phase === 'play' && v.turn === 1) t.act('me', 'stand');
    if (v.phase === 'done') {
      const total = v.seats.reduce((a, s) => a + s.pay, 0), pot = v.seats.reduce((a, s) => a + s.bet, 0);
      assert.ok(total <= pot && total >= Math.floor(pot * 0.95) - 4);
      t.close(); done();
    }
  } });
  assert.equal(t.join('me', { name: 'eu' }), 0);
  assert.ok(t.bet('me', 100));
  assert.ok(!t.bet('me', 100));
  t.act('me', 'noop');
  // o humano entra no lugar 0; força a vez dele no turno certo
  t.onChange = (o => v => { if (v.phase === 'play' && v.turn === 0) t.act('me', 'stand'); o(v); })(t.onChange);
});
// jogos novos
import * as GM from './games.js';
let rs = 1; const lcg = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
const pts = Array.from({ length: 20000 }, () => GM.crashPoint(lcg));
const atLeast2 = pts.filter(x => x >= 2).length / pts.length;
assert.ok(Math.abs(atLeast2 - 0.485) < 0.02, `crash >= 2x em ${atLeast2}`);  // (1-3%)/2
assert.equal(GM.multAt(0), 1);
assert.ok(Math.abs(GM.multAt(GM.timeTo(2)) - 2) < 0.02);
assert.equal(GM.WHEEL.length, 37);
assert.equal(new Set(GM.WHEEL).size, 37);
assert.equal(GM.roulettePay({ 'n:17': 10 }, 17), 360);
assert.equal(GM.roulettePay({ red: 10, black: 10 }, 0), 0);
assert.equal(GM.roulettePay({ red: 10, dz1: 10 }, 3), 20 + 30);
assert.equal(GM.roulettePay({ col3: 10, odd: 10 }, 36), 30);
const pos = { side: 1, lev: 10, entry: 100, margin: 1000 };
assert.equal(GM.pnl(pos, 101), 100);
assert.equal(GM.pnl(pos, 80), -1000);                 // nunca perde mais que a margem
assert.equal(GM.liqPrice(pos), 90);
assert.ok(Math.abs(GM.liqPrice({ ...pos, side: -1 }) - 110) < 1e-9);
const feed = GM.newFeed('soja', lcg);
for (let i = 0; i < 5000; i++) GM.tickFeed(feed);
assert.ok(feed.price > 0 && Number.isFinite(feed.price));
assert.ok(GM.DAILY_WHEEL.every(s => s.amount > 0));
assert.ok(GM.spinDaily(() => 0.999) === GM.DAILY_WHEEL.length - 1 && GM.spinDaily(() => 0) === 0);
// login: validação e tradução de erros
import * as AR from './authrules.js';
assert.equal(AR.cleanName('  Ana   <b>Maria</b>  '), 'Ana bMaria/b');
assert.equal(AR.cleanName('x'.repeat(40)).length, 18);
assert.equal(AR.validateEmail('a@b.co'), null);
assert.ok(AR.validateEmail('a@b'));
assert.ok(AR.validateEmail(''));
assert.ok(AR.validatePassword('1234567'));
assert.ok(AR.validatePassword('aaaaaaaa'));
assert.ok(AR.validatePassword('12345678'));
assert.equal(AR.validatePassword('cavalo-azul-77'), null);
assert.ok(AR.validatePassword('x'.repeat(73)));
const ok = { name: 'Rafa', email: 'rafa@exemplo.com', password: 'cavalo-azul-77', adult: true };
assert.equal(AR.validateSignup(ok), null);
assert.ok(AR.validateSignup({ ...ok, adult: false }).includes('18'));
assert.ok(AR.validateSignup({ ...ok, name: 'ab' }));
assert.ok(AR.validateSignup({ ...ok, email: 'x' }));
assert.equal(AR.validateLogin({ email: 'a@b.co', password: 'x' }), null);
assert.ok(AR.validateLogin({ email: 'a@b.co', password: '' }));
assert.equal(AR.translateError({ message: 'Invalid login credentials' }), 'E-mail ou senha incorretos.');
assert.ok(AR.translateError(new Error('Email not confirmed')).includes('Confirme'));
assert.ok(AR.translateError({ message: 'User already registered' }).includes('Já existe'));
assert.ok(AR.translateError({ message: 'email rate limit exceeded' }).includes('Muitas'));
assert.ok(AR.translateError(new TypeError('Failed to fetch')).includes('conexão'));
assert.ok(AR.translateError({ message: 'algo estranho' }).includes('Não foi possível'));
assert.ok(!AR.translateError({ message: 'secret stack trace' }).includes('secret'));   // nunca vaza mensagem crua
assert.ok(AR.isNameTaken({ code: '23505' }) && !AR.isNameTaken({ code: '42501' }));
assert.equal(AR.withSuffix('Rafael Gutierrez Silva', 7), 'Rafael Gutierre07');
assert.ok(AR.withSuffix('Rafael Gutierrez Silva', 7).length <= 18);
// canil e haras
import * as ST from './stable.js';
{
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const base = (extra = {}) => ({ money: 1e7, stable: { animals: [], offers: [], next: 1 }, ...extra });
const mkAnimal = (kind, r, over = {}) => ({ ...ST.newAnimal(kind, r, rnd, 1), age: kind === 'dog' ? 30 : 60, fat: 0, wk: 4, inj: 0, ...over });
// nota bate com o alvo, potencial acima da nota, preço sobe com a nota
for (const kind of ['dog', 'horse']) for (const r of [42, 60, 80]) {
  const a = ST.newAnimal(kind, r, rnd, 1);
  assert.ok(Math.abs(ST.rating(a) - r) <= 1, kind + ' nota ' + ST.rating(a) + ' alvo ' + r);
  assert.ok(a.pot >= Math.min(99, r + 8) - 1 && a.pot <= 99);
}
assert.ok(ST.price('dog', 80) > ST.price('dog', 60) && ST.price('dog', 60) > ST.price('dog', 45));
assert.ok(ST.price('horse', 60) > ST.price('dog', 60) * 3);
assert.equal(ST.ageFactor('dog', 30), 1);
assert.ok(ST.ageFactor('dog', 8) < 1 && ST.ageFactor('dog', 70) < 1 && ST.ageFactor('dog', 200) >= 0.6);
// compra e venda
const s1 = base(); ST.refreshOffers(s1, rnd);
assert.equal(s1.stable.offers.length, 8);
const offer = s1.stable.offers[0], mStart = s1.money, paid = offer.cost;
assert.equal(ST.buy(s1, offer.id), null);
assert.equal(s1.money, mStart - paid);
assert.equal(s1.stable.animals.length, 1);
assert.ok(ST.buy(s1, offer.id).includes('vendido'));
const poor = base({ money: 10 }); ST.refreshOffers(poor, rnd);
assert.ok(ST.buy(poor, poor.stable.offers[0].id).includes('insuficiente'));
const v = ST.value(s1.stable.animals[0]); assert.ok(v < paid && v > 0);
const m1 = s1.money; assert.equal(ST.sell(s1, offer.id), v); assert.equal(s1.money, m1 + v);
// treino: custo, ganho limitado ao potencial, cansaço, semanas e lesão
const s2 = base(); const dog = mkAnimal('dog', 50); dog.id = 5; dog.pot = 60; dog.spd = 59.5; s2.stable.animals.push(dog);
const before = s2.money, cost = ST.trainCost(dog);
const r1 = ST.train(s2, 5, 'spd', () => 0.5);
assert.ok(!r1.err && dog.spd <= 60 && dog.spd > 59.5);
assert.equal(s2.money, before - cost); assert.equal(dog.fat, 25); assert.equal(dog.wk, 3); assert.equal(r1.injured, false);
dog.fat = 60; const r2 = ST.train(s2, 5, 'sta', () => 0); assert.equal(r2.injured, true); assert.ok(dog.inj >= 1);
assert.ok(ST.train(s2, 5, 'sta', () => 0.5).err.includes('lesionado'));
assert.equal(ST.treat(s2, 5), null); assert.equal(dog.inj, 0);
dog.wk = 0; assert.ok(ST.train(s2, 5, 'sta').err.includes('semanas'));
// prova: o dinheiro fecha (taxa e prêmio), 6 corredores, limite de classe
const s3 = base(); const a3 = mkAnimal('dog', 50); a3.id = 9; s3.stable.animals.push(a3);
const evB = ST.events('dog')[1], m3 = s3.money;
const res = ST.enter(s3, 9, evB.id, rnd);
assert.ok(!res.err); assert.equal(res.runners.length, 6); assert.deepEqual([...res.order].sort(), [0, 1, 2, 3, 4, 5]);
assert.equal(s3.money, m3 - evB.fee + res.prize); assert.equal(res.prize, evB.prize[res.pos] || 0);
assert.equal(a3.runs, 1); assert.equal(a3.wk, 3); assert.ok(a3.fat >= 30);
const strong = mkAnimal('dog', 80); strong.id = 10; s3.stable.animals.push(strong);
assert.ok(ST.enter(s3, 10, ST.events('dog')[0].id, rnd).err.includes('limite'));
assert.ok(ST.enter(s3, 10, 'dog-zz', rnd).err);
const broke = base({ money: 100 }); const a4 = mkAnimal('dog', 50); a4.id = 11; broke.stable.animals.push(a4);
assert.ok(ST.enter(broke, 11, ST.events('dog')[1].id, rnd).err.includes('insuficiente'));
// animal melhor ganha mais, e o lucro acompanha a nota (centenas de provas)
function sim(kind, r, ci, n = 500) {
  let wins = 0, net = 0; const ev = ST.events(kind)[ci];
  for (let i = 0; i < n; i++) {
    const s = base(); const a = mkAnimal(kind, r); a.id = 1; s.stable.animals.push(a);
    const m = s.money; const out = ST.enter(s, 1, ev.id, rnd);
    if (out.pos === 0) wins++; net += s.money - m;
  }
  return { win: wins / n, net: net / n, fee: ev.fee };
}
const hi = sim('dog', 69, 1), lo = sim('dog', 45, 1), hh = sim('horse', 69, 1);
assert.ok(hi.win > 0.22, 'nota 69 vence ' + hi.win);
assert.ok(lo.win < 0.08, 'nota 45 vence ' + lo.win);
assert.ok(hi.net > 0, 'lucro com nota alta ' + hi.net);
assert.ok(lo.net < -hi.fee * 0.4, 'prejuízo com nota baixa ' + lo.net);
assert.ok(hh.win > 0.22 && hh.net > 0, 'cavalo ' + hh.win + ' ' + hh.net);
// mês: ração, idade, descanso, semanas e leilão novo
const s5 = base(); const a5 = mkAnimal('horse', 60); a5.id = 20; a5.fat = 80; a5.wk = 0; a5.inj = 2; s5.stable.animals.push(a5); ST.refreshOffers(s5, rnd);
const o0 = s5.stable.offers.map(o => o.id).join(), mm = s5.money, age0 = a5.age;
const lines = ST.monthly(s5, rnd);
assert.equal(s5.money, mm - ST.upkeep(a5)); assert.equal(a5.age, age0 + 1); assert.equal(a5.fat, 25); assert.equal(a5.wk, 4); assert.equal(a5.inj, 1);
assert.notEqual(s5.stable.offers.map(o => o.id).join(), o0); assert.ok(lines.length >= 1);
assert.ok(ST.animalsValue(s5) > 0);
// aposentado não corre
a5.inj = 0; a5.age = ST.KINDS.horse.retire; assert.ok(ST.enter(s5, 20, ST.events('horse')[1].id, rnd).err.includes('aposentado'));
// tempos e margem de cavalo
const hT = ST.KINDS.horse; assert.ok(hT.dist === 1600 && hT.baseTime > 90);
}
console.log('ok');
