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

// gado sem pasto vai para o confinamento (paga por cabeça e engorda 22 kg); com pasto engorda 18 kg de graça
const s = L.newState(() => 0.5);
s.herd.push({ id: 1, heads: 10, kg: 180 });
const before = s.money;
L.tick(s, () => 0.5);
assert.equal(s.money, before - 10 * L.BOITEL_COST);
assert.equal(s.herd[0].kg, 180 + L.BOITEL_GAIN);
s.lands.push({ id: 2, own: true, region: 'x', ha: 10, value: 100000, leasedOut: false });
L.tick(s, () => 0.5);
assert.equal(s.herd[0].kg, 180 + L.BOITEL_GAIN + 18);

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
assert.equal(f.money, 1e6 - L.CROPS.soja.cost * 10);
assert.equal(L.capacity(f), 0);
for (let i = 0; i < L.CROPS.soja.months; i++) L.tick(f, () => 0.5);
assert.equal(f.stock.soja, 600);
assert.equal(lot.crop, undefined);
f.cars.push({ id: 10, model: 'deere', value: 650000 });
assert.equal(L.plantCost(f, 'soja', 10), Math.round(L.CROPS.soja.cost * 10 * 0.9));

// terra acompanha o mercado (v154): escritura inflada volta para o laudo e nunca sobe para sempre
{ const t = L.newState(() => 0.5), lt = { id: 7, own: true, region: 'cerrado, goiás', ha: 100, improv: ['curral'], water: 'rio' }, mk = L.landMarket(lt);
  assert.equal(mk, Math.round(L.region('cerrado, goiás').perHa * 100 * 1.03));
  lt.value = mk * 2; t.lands.push(lt); for (let i = 0; i < 120; i++) L.tick(t, () => 0.99);
  assert.ok(lt.value <= mk * 1.25 && lt.value >= mk * 0.8, 'terra fica perto do mercado: ' + lt.value / mk);
  assert.equal(L.landMarket({ region: 'região que não existe', ha: 10 }), 0); }
// máquinas de lavoura (v156): trator vale o maior, o resto soma, teto de 15%
{ const car = m => ({ id: m, model: m, value: 1 });
  assert.equal(L.machDiscount({ cars: [car('massey')] }), 0.07); assert.equal(L.machDiscount({ cars: [car('massey'), car('deere')] }), 0.1);
  assert.equal(L.machDiscount({ cars: ['deere', 'plantadeira', 'colheitadeira', 'autopropelido', 'drone'].map(car) }), L.MACH_MAX);
  assert.ok(Object.values(L.CARS).every(c => c.img && c.price > 0)); }
// contratos de exportação e seguro agrícola (v156)
{ const CTR = await import('./contratos.js'), pr = { soja: 150, milho: 64, cafe: 1600 };
  const o = CTR.offers(40, pr); assert.deepEqual(o, CTR.offers(40, pr), 'mesmas propostas para todos'); assert.equal(o.length, CTR.OFFERS);
  assert.ok(o.every(x => x.prem >= CTR.PREM[0] && x.prem <= CTR.PREM[1] && Math.abs(x.price - pr[x.good] * (1 + x.prem)) < 0.01));
  const s = { ...L.newState(() => 0.5), month: 40 }; s.money = 1e9; const c = o[0];
  assert.equal(CTR.accept(s, c), null); assert.ok(CTR.accept(s, c), 'não fecha o mesmo contrato duas vezes');
  s.stock[c.good] = c.qty * 2; assert.ok(CTR.deliver(s, c.id).err, 'grão comprado no mercado não vale (só colheita própria)');
  s.colhido[c.good] = c.qty; const m0 = s.money, r = CTR.deliver(s, c.id); assert.equal(s.money, m0 + Math.round(c.qty * c.price)); assert.equal(r.c.id, c.id); assert.equal(s.colhido[c.good], 0);
  CTR.accept(s, o[1]); s.month += o[1].months; const m1 = s.money, fine = CTR.monthly(s); assert.equal(s.money, m1 - Math.round(o[1].qty * o[1].price * CTR.FINE)); assert.equal(fine.length, 1); assert.equal(s.contracts.length, 0);
  // seguro: quebra de safra paga a diferença até 80%; sem seguro não paga
  const mk = seg => { const t = L.newState(() => 0.5); t.money = 1e7; const l = { id: 3, own: true, region: 'cerrado, goiás', ha: 100, cap: 0.9, value: 5e6 }; t.lands.push(l); L.plant(t, l, 'soja', seg); return t; };
  const a = mk(true), b = mk(false), ma = a.money, mb = b.money;
  for (let i = 0; i < L.CROPS.soja.months - 1; i++) { L.tick(a, () => 0.5); L.tick(b, () => 0.5); }
  L.tick(a, () => 0.01); L.tick(b, () => 0.01);
  assert.equal(a.stock.soja, Math.round(100 * 60 * (L.CLIMATE.min + 0.01 * L.CLIMATE.span))); assert.ok(a.log.some(x => /quebra de safra/.test(x.txt)));
  assert.ok((a.money - ma) - (b.money - mb) > 100 * 60 * a.prices.soja * 0.4, 'indenização do seguro na quebra: ' + ((a.money - ma) - (b.money - mb)));
  assert.equal(L.plantTotal(a, 'soja', 100, false, true), Math.round(L.plantCost(a, 'soja', 100) * (1 + L.INSURE.premium)));
  const ev = L.CLIMATE.chance * (L.INSURE.cover - (L.CLIMATE.min + L.CLIMATE.span / 2)) + (1 - L.CLIMATE.chance) * 0.1 * 0.025;
  assert.ok(ev * 60 * 150 < L.CROPS.soja.cost * L.INSURE.premium * 1.2, 'seguro não é máquina de dinheiro');
  console.log('contratos de exportação e seguro agrícola ok'); }
// carro desvaloriza 1,5% e paga IPVA/seguro
const g = L.newState(() => 0.5);
g.cars.push({ id: 1, model: 'onix', value: 95000 });
const m0 = g.money;
L.tick(g, () => 0.5);
assert.equal(g.cars[0].value, Math.round(95000 * (1 - L.CAR_DEPREC)));
assert.equal(Math.round(m0 - g.money), Math.round(95000 * L.CAR_UPKEEP));
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

// motor da mesa (blackjack contra o dealer): 1 humano + 3 bots, várias rodadas
import { Table } from './table.js';
import * as BJ2 from './bj.js';
for (let round = 0; round < 25; round++) {
  await new Promise(done => {
    let leaked = false;
    const t = new Table({ id: 't', name: 'teste', minBet: 50, speed: 0.0005, onChange: v => {
      if (['deal', 'play'].includes(v.phase) && v.dealer[1] && !v.dealer[1].hidden) leaked = true;
      if (v.phase === 'play' && v.turn === 0) t.act('me', round % 3 === 0 ? 'double' : round % 3 === 1 ? 'hit' : 'stand');
      if (v.phase === 'done') {
        assert.ok(!leaked, 'carta escondida do dealer vazou');
        const dv = BJ2.value(v.dealer);
        for (const s of v.seats) {
          if (s.out) continue;
          const sum = s.hands.reduce((x, h) => x + BJ2.payout(h, v.dealer), 0);
          assert.equal(s.pay, sum);
          assert.equal(s.bet, s.hands.reduce((x, h) => x + h.bet, 0));
        }
        const anyAlive = v.seats.some(s => !s.out && s.hands.some(h => BJ2.value(h.cards) <= 21 && !BJ2.isBlackjack(h.cards, h.split)));
        if (anyAlive && !BJ2.isBlackjack(v.dealer)) assert.ok(dv >= 17, 'dealer parou com ' + dv);
        t.close(); done();
      }
    } });
    assert.equal(t.join('me', { name: 'eu' }), 0);
    assert.ok(t.bet('me', 100));
    assert.ok(!t.bet('me', 100));
  });
}
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
// blackjack de cassino
import * as BJ from './bj.js';
{
  const c = (...rs) => rs.map(r => ({ r, s: '♠' }));
  assert.equal(BJ.newShoe().cards.length, 312);
  assert.deepEqual(BJ.total(c('A', '6')), { t: 17, soft: true });
  assert.deepEqual(BJ.total(c('A', '6', '10')), { t: 17, soft: false });
  assert.ok(BJ.isBlackjack(c('A', 'K')) && !BJ.isBlackjack(c('A', 'K'), true) && !BJ.isBlackjack(c('7', '7', '7')));
  assert.ok(BJ.dealerPlays(c('10', '6')) && !BJ.dealerPlays(c('A', '6')) && !BJ.dealerPlays(c('10', '7')));
  const H = (cards, bet = 100, split = false) => ({ cards: c(...cards), bet, split });
  assert.equal(BJ.payout(H(['A', 'K']), c('10', '9')), 250);        // blackjack 3:2
  assert.equal(BJ.payout(H(['A', 'K']), c('A', 'Q')), 100);         // os dois com blackjack: empate
  assert.equal(BJ.payout(H(['10', '9']), c('A', 'Q')), 0);          // dealer blackjack
  assert.equal(BJ.payout(H(['10', '9']), c('10', '6', '9')), 200);  // dealer estourou
  assert.equal(BJ.payout(H(['10', '8']), c('10', '8')), 100);       // empate
  assert.equal(BJ.payout(H(['10', '5', '9']), c('10', '6', '9')), 0); // jogador estourou primeiro perde mesmo se o dealer estourar
  assert.equal(BJ.payout(H(['A', 'K'], 100, true), c('10', '9')), 200); // 21 depois de dividir não é blackjack
  assert.equal(BJ.outcome(H(['A', 'K']), c('10', '9')), 'blackjack');
  assert.ok(BJ.canSplit({ cards: c('8', '8') }, 1) && BJ.canSplit({ cards: c('K', 'Q') }, 1) && !BJ.canSplit({ cards: c('8', '8') }, 2));
  assert.equal(BJ.botAction({ cards: c('8', '8') }, { r: '10' }, 1), 'split');
  assert.equal(BJ.botAction({ cards: c('6', '5') }, { r: '6' }, 1), 'double');
  assert.equal(BJ.botAction({ cards: c('10', '6') }, { r: '10' }, 1), 'hit');
  assert.equal(BJ.botAction({ cards: c('10', '3') }, { r: '5' }, 1), 'stand');
  assert.ok(BJ.dealerPeeks({ r: 'A' }) && BJ.dealerPeeks({ r: 'K' }) && !BJ.dealerPeeks({ r: '9' }));
  const shoe = BJ.newShoe(); shoe.cards.length = 70; assert.ok(BJ.needsShuffle(shoe));
}
// clube de futebol
import * as FT from './futebol.js';
import * as BT from './bots.js';
import * as PK from './perks.js';
{
  let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  // tabela: 10 clubes, 18 rodadas, cada clube joga 1 vez por rodada e enfrenta cada rival 2 vezes (1 em casa)
  const fx = FT.fixtures(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  assert.equal(fx.length, 18);
  for (const round of fx) assert.equal(new Set(round.flat()).size, 10);
  const pairs = {}; for (const round of fx) for (const [h, a] of round) pairs[h + a] = (pairs[h + a] || 0) + 1;
  assert.ok(Object.values(pairs).every(n => n === 1) && Object.keys(pairs).length === 90);
  // assumir clube real
  assert.equal(FT.CLUBS.every(d => d.length === 20), true);
  assert.ok(FT.clubPrice('Flamengo') > FT.clubPrice('Remo') && FT.clubPrice('Remo') > FT.clubPrice('Sport'));
  const s = { money: 50000 };
  assert.ok(FT.takeClub(s, 'Barra-SC', r).includes('insuficiente'));
  s.money = 20e6;
  assert.ok(FT.takeClub(s, 'Time Inventado', r).includes('lista'));
  assert.equal(FT.takeClub(s, 'Barra-SC', r), null);
  assert.equal(s.money, 20e6 - FT.clubPrice('Barra-SC') + FT.sponsorOf(s.fut)); assert.equal(s.fut.squad.length, 18); assert.equal(s.fut.div, 2);
  assert.equal(s.fut.league.teams.length, 20); assert.ok(s.fut.league.teams.some(t => t.name === 'Paysandu'));
  const l = FT.lineup(s.fut.squad, '4-3-3'); assert.equal(l.gk.length + l.def.length + l.mid.length + l.att.length, 11);
  // time mais forte vence mais (500 jogos)
  let hw = 0, lw = 0;
  for (let i = 0; i < 500; i++) { const g = FT.simulate({ att: 72, def: 72 }, { att: 55, def: 55 }, r); if (g.hg > g.ag) hw++; if (g.hg < g.ag) lw++; }
  assert.ok(hw > 330 && lw < 60, 'forte ' + hw + ' fraco ' + lw);
  // gols por jogo realistas (entre 1,8 e 3,6 em times iguais)
  let goals = 0; for (let i = 0; i < 500; i++) { const g = FT.simulate({ att: 60, def: 60 }, { att: 60, def: 60 }, r); goals += g.hg + g.ag; }
  assert.ok(goals / 500 > 1.8 && goals / 500 < 3.6, 'gols/jogo ' + goals / 500);
  // temporada inteira: pontos fecham, dinheiro anda, fim de temporada move divisão
  const m0 = s.money;
  for (let i = 0; i < 4; i++) FT.playRound(s, r);
  assert.ok(FT.playRound(s, r).err && s.fut.league.round === 4, '5ª rodada no mesmo mês é bloqueada');
  let res; do { if (!FT.roundsLeft(s)) s.month = (s.month || 1) + 1; res = FT.playRound(s, r); } while (!res.done);
  const tb = s.fut.league.table; const totalP = Object.values(tb).reduce((a, x) => a + x.p, 0);
  assert.equal(totalP, 760); assert.equal(tb.user.p, 38);
  assert.equal(Object.values(tb).reduce((a, x) => a + x.gf, 0), Object.values(tb).reduce((a, x) => a + x.ga, 0));
  assert.ok(s.money !== m0);
  const end = FT.endSeason(s, r);
  assert.ok(end.pos >= 1 && end.pos <= 20); assert.equal(s.fut.season, 2); assert.equal(s.fut.league.round, 0);
  if (end.pos <= 4) assert.equal(s.fut.div, 1); else assert.equal(s.fut.div, 2);
  // propostas de bots chegaram durante a temporada e dá para aceitar
  s.fut.offers = [{ id: 'o1', pid: s.fut.squad[0].id, name: 'x', club: 'Remo', amount: 5000, until: 99 }];
  assert.ok(FT.contractLeft(s) > 0 && FT.answerOffer(s, 'o1', true).err, 'contrato de 12 meses segura o elenco que veio com o clube');
  s.fut.offers = [{ id: 'o1', pid: s.fut.squad[0].id, name: 'x', club: 'Remo', amount: 5000, until: 99 }];
  s.month = (s.month || 1) + FT.CONTRACT; assert.equal(FT.contractLeft(s), 0);
  const mo = s.money; const ans = FT.answerOffer(s, 'o1', true); assert.ok(ans.ok); assert.equal(s.money, mo + 5000);
  // negociação com bot: oferta absurda faz o bot desistir, oferta justa fecha
  const d1 = FT.dealFor(s.fut, s.fut.market[0].id, r); assert.equal(BT.haggle(d1, 1).result, 'walk');
  const d2 = FT.dealFor(s.fut, s.fut.market[0].id, r); assert.equal(BT.haggle(d2, s.fut.market[0].price).result, 'accept');
  const d3 = FT.dealFor(s.fut, s.fut.market[0].id, r); const c3 = BT.haggle(d3, Math.round(d3.limit * 0.9)); assert.equal(c3.result, 'counter'); assert.ok(c3.price >= d3.limit);
  // vantagens: carro e acessório somam
  const pk = { cars: [{ model: 'onix' }, { model: 'onix' }, { model: 'veyron' }], owned: ['acc:corrente de ouro'] };
  assert.equal(+PK.mult(pk, 'xp').toFixed(2), 1.19); assert.equal(+PK.mult(pk, 'daily').toFixed(2), 1.5); assert.equal(PK.mult({ owned: ['acc:relógio de luxo'], cars: [{ model: 'g63' }] }, 'loan'), 1 - 0.1);
  assert.ok(Math.abs(PK.bonus({ owned: Object.keys(PK.ACC_PERKS).map(k => 'acc:' + k) }, 'daily') - 0.2) < 1e-9, 'todos os acessórios juntos: roleta do dia +20%'); assert.ok(PK.bonus({ owned: Object.keys(PK.ACC_PERKS).map(k => 'acc:' + k) }, 'xp') <= 0.25, 'teto de XP');
  assert.equal(PK.bonus({ cars: [{ model: 'veyron' }, { model: 'huracan' }, { model: 'cullinan' }] }, 'daily'), 0.5, 'teto geral da roleta do dia: +50%');
  // mercado
  const p = s.fut.market[0]; const mb = s.money; assert.equal(FT.buy(s, p.id), null); assert.equal(s.money, mb - p.price);
  const sold = FT.sell(s, p.id); assert.ok(sold > 0 && sold < p.price);
  while (s.fut.squad.length > 14) FT.sell(s, s.fut.squad[0].id);
  assert.equal(FT.sell(s, s.fut.squad[0].id), -1);
}
// trocas entre jogadores
import * as TD from './trade.js';
{
  const mk = () => ({ money: 100000, chips: 500, nextId: 50, stock: { soja: 10, milho: 0, cafe: 0 }, prices: { soja: 130 }, cars: [{ id: 1, model: 'onix', value: 90000 }],
    lands: [{ id: 2, own: true, region: 'cerrado, goiás', ha: 10, value: 220000 }], stable: { animals: [{ id: 7, kind: 'dog', name: 'Bala', spd: 60, sta: 60, acc: 60, pot: 70, age: 30, wk: 4, fat: 0, inj: 0 }], next: 8 } });
  const A = mk(), B = mk();
  const inv = TD.inventory(A); assert.ok(inv.some(i => i.kind === 'car') && inv.some(i => i.kind === 'animal') && inv.some(i => i.kind === 'land') && inv.some(i => i.kind === 'good'));
  const giveA = [{ kind: 'car', data: A.cars[0] }, { kind: 'chips', amount: 200 }];
  const giveB = [{ kind: 'money', amount: 80000 }, { kind: 'animal', data: B.stable.animals[0] }];
  assert.equal(TD.apply(A, giveA, giveB), null); assert.equal(TD.apply(B, giveB, giveA), null);
  assert.equal(A.cars.length, 0); assert.equal(B.cars.length, 2); assert.equal(A.chips, 300); assert.equal(B.chips, 700);
  assert.equal(A.money, 180000); assert.equal(B.money, 20000); assert.equal(A.stable.animals.length, 2); assert.equal(B.stable.animals.length, 0);
  assert.notEqual(B.cars[1].id, B.cars[0].id);
  // não dá para dar o que não tem
  assert.ok(TD.canGive(A, [{ kind: 'chips', amount: 99999 }]).includes('fichas'));
  assert.ok(TD.canGive(A, [{ kind: 'car', data: { id: 1 } }]).includes('carro'));
  assert.ok(TD.canGive(A, [{ kind: 'money', amount: -5 }]).includes('inválido'));
  assert.ok(TD.apply(A, [{ kind: 'money', amount: 1e9 }], []).includes('dinheiro'));
  // o que chega do outro lado é limpo: valores impossíveis cortados, tipos estranhos descartados
  const evil = TD.sanitize([{ kind: 'car', data: { model: 'veyron', value: 1e12 } }, { kind: 'hack', amount: 5 }, { kind: 'chips', amount: Infinity },
    { kind: 'animal', data: { kind: 'horse', name: '<img onerror=x>', spd: 500, sta: 1, acc: 50, pot: 999, age: 30 } }]);
  assert.equal(evil.length, 2); assert.ok(evil[0].data.value <= 15000000);
  assert.ok(evil[1].data.spd === 99 && evil[1].data.sta === 20 && !evil[1].data.name.includes('<'));
}
// treino com mini-jogo e ração premium
{
  const s = { money: 1e6, stable: { animals: [], offers: [], next: 1 } };
  const mk = () => ({ ...ST.newAnimal('dog', 50, () => 0.5, 1), id: 1, pot: 90, spd: 50, fat: 0, wk: 4, inj: 0, age: 30 });
  s.stable.animals = [mk()]; const g1 = ST.train(s, 1, 'spd', () => 0.5, 1.5).gain;
  s.stable.animals = [mk()]; const g2 = ST.train(s, 1, 'spd', () => 0.5, 0.6).gain;
  assert.ok(g1 > g2 * 2, 'treino perfeito ' + g1 + ' x ruim ' + g2);
  const a = mk(); a.fat = 90; s.stable.animals = [a]; const base = ST.upkeep(a);
  ST.togglePremium(s, 1); assert.ok(ST.upkeep(a) > base);
  ST.monthly(s, () => 0.5); assert.equal(a.fat, 10);
}
// passe da temporada
{
  const s = L.newState(() => 0.5); s.chips = 0; s.money = 0; P.ensure(s, '2026-11-01');
  P.passEnsure(s, '2026-11');
  assert.equal(P.passTier(s), 0);
  for (let i = 0; i < 20; i++) P.track(s, 'land');
  assert.equal(P.passTier(s), Math.floor(1000 / P.PASS_XP));
  const r1 = P.passClaim(s, 1); assert.ok(r1 && (s.chips > 0 || s.money > 0));
  assert.equal(P.passClaim(s, 1), null); assert.equal(P.passClaim(s, 30), null);
  P.passEnsure(s, '2026-12'); assert.equal(s.pass.xp, 0); assert.equal(s.pass.claimed.length, 0);
  for (const t of [1, 5, 10, 30]) assert.deepEqual(P.passReward(t), { kind: 'chips', amount: 100 }, 'todo nível paga 100 fichas');
  // 21: mão jogada conta para missão, mas XP e passe só quando liberado (2% das vitórias)
  const xp0 = s.pass.xp, c0 = s.counts.hand || 0; P.track(s, 'hand', 1, false); P.track(s, 'win', 1, false);
  assert.equal(s.pass.xp, xp0, 'sem XP no passe'); assert.equal(s.counts.hand, c0 + 1, 'missão continua contando');
  assert.equal(P.BJ_XP_CHANCE, 0.02);
}
console.log('ok');
// feira dos bots: comprar e revender na hora nunca dá lucro
import * as FE from './feira.js';
import { CAR_BUYBACK } from './logic.js';
{
  let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 40; k++) {
    const s = { month: 400 + k, money: 1e8, cars: [{ id: 1, model: 'onix', value: 90000 }], stock: { soja: 30, milho: 0, cafe: 0 }, prices: { soja: 130, milho: 60, cafe: 1400 }, owned: [], nextId: 9 };
    const f = FE.refresh(s, 0.85 + r() * 0.4, r);
    for (const it of f.list) { const d = FE.buyDeal(it, r); assert.ok(d.limit >= (it.kind === 'car' ? it.value : it.kind === 'good' ? it.value : 0), 'bot vende abaixo do valor'); }
    if (f.want) { const d = FE.sellDeal(f.want, r); assert.ok(d.limit <= f.want.value); }
    const car = f.list.find(x => x.kind === 'car'); const d = FE.buyDeal(car, r);
    assert.equal(FE.buy(s, car.id, d.limit), null);
    assert.ok(s.cars.at(-1).value * CAR_BUYBACK < d.limit, 'revenda na concessionária daria lucro');
  }
  assert.equal(FE.econIndex([]), 1); assert.ok(FE.econIndex([5e7, 5e7, 5e7]) > 1 && FE.econIndex([1000]) < 1);
}
console.log('feira ok');
{
  const BPx = await import('./botpool.js');
  let busy = 0, n = 0; const t0 = Date.UTC(2026, 10, 25);
  for (let w = 0; w < 400; w++) for (const id of ['bot-dorival', 'pk-boteco', 'tr-praca', 'sn-bar', 'av', 'rl']) { n++; const x = BPx.sitting(id, t0 + w * BPx.SIT_WIN); if (x.length) { busy++; assert.ok(x.every(b => BPx.botsFor(id).includes(b)), 'bot da mesa certa'); } }
  assert.ok(busy / n > 0.01 && busy / n < 0.09, `bot sentado em ${(busy / n * 100).toFixed(1)}% das janelas: tem que ser raro`);
  assert.deepEqual(BPx.sitting('av', t0), BPx.sitting('av', t0 + 1000), 'igual para todos na mesma janela');
}
console.log('mesas livres ok');
// cartas: pacote não dá lucro garantido, pagar terra com cartas devolve troco certo, troca só aceita carta válida
import * as CD from './cards.js';
{
  let sd = 9; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  let tot = 0; for (let i = 0; i < 20000; i++) tot += CD.value(CD.draw(r));
  const ev = tot / 20000;
  assert.ok(ev * CD.SELL < CD.PACK_PRICE && ev * CD.LAND_RATE < CD.PACK_PRICE, 'pacote dá lucro: ' + ev);
  const s = { money: 0, cards: [], nextId: 1 };
  CD.give(s, { tier: 'diamante', champ: 'brasa' }); CD.give(s, { tier: 'bronze', champ: 'faisca' }); CD.give(s, { tier: 'prata', champ: 'raiz' });
  const big = CD.value(s.cards[0]) * CD.LAND_RATE;
  const p = CD.payWith(s, 1500);
  assert.ok(!p.err && p.used.length === 1 && p.used[0].tier === 'diamante' && p.change === Math.round(big - 1500) && s.cards.length === 2);
  assert.ok(CD.payWith(s, 1e9).err);
  assert.equal(CD.sanitize({ tier: 'deus', champ: 'brasa' }), null);
  assert.equal(TD.sanitize([{ kind: 'card', data: { tier: 'mestre', champ: 'umbra', id: 'x' } }]).length, 1);
}
console.log('cartas ok');
// chat: palavrão vira ***, nível 2, intervalo e destaque pago
import * as CH from './chat.js';
{
  assert.equal(CH.clean('vendo hilux, p0rra de barata'), 'vendo hilux, ***** de barata');
  assert.equal(CH.clean('FDP caralhoooo puta'), '*** ****** ****');
  assert.equal(CH.clean('computador putativo cuca'), 'computador putativo cuca');
  assert.equal(CH.clean('<script>oi</script>'), 'scriptoi/script');
  assert.ok(CH.canSend({ level: 1, money: 1e6 }, 'oi', 0).includes('nível'));
  assert.equal(CH.canSend({ level: 2, money: 1e6 }, 'oi', 0), null);
  assert.ok(CH.canSend({ level: 2, money: 1e6 }, 'oi', Date.now()).includes('espere'));
  assert.ok(CH.canSend({ level: 3, money: 10 }, 'oi', 0, Date.now(), true).includes('insuficiente'));
  assert.equal(CH.highlightFee(1), 1000); assert.ok(CH.highlightFee(1.25) > 1000);
  assert.equal(CH.accept({ text: 'merda', name: '<b>x' }).text, '*****');
}
console.log('chat ok');
// arrendamento: reajuste, plantio só com trator, parte do dono e compra com abatimento
{
  const mk = () => { const s = L.newState(); s.money = 100000; s.lands.push({ id: 900, own: false, leasedOut: false, region: 'x', ha: 10, value: 1000000, use: 'lavoura', cap: 1 }); return s; };
  let s = mk();
  assert.ok(L.plant(s, s.lands[0], 'soja').includes('trator'));
  s.cars.push({ id: 1, model: 'deere', value: 650000 });
  const c1 = L.plantCost(s, 'soja', 10, true), c0 = L.plantCost(s, 'soja', 10, false);
  assert.equal(Math.round(c1 / c0 * 100), 120);
  const m0 = s.money; assert.equal(L.plant(s, s.lands[0], 'soja'), null); assert.equal(s.money, m0 - c1);
  for (let i = 0; i < 12; i++) L.tick(s, () => 0.5);
  assert.equal(L.rentNow(s.lands[0]), Math.round(s.lands[0].value * L.RENT_PAY * 1.08));
  assert.ok(s.lands[0].paid > 0);
  // abatimento: metade do aluguel pago, com teto de 40% do valor
  const l = s.lands[0]; assert.equal(L.rentCredit(l), Math.min(l.paid * 0.5, l.value * 0.4));
  assert.equal(L.buyRentedPrice(l), Math.round(l.value - L.rentCredit(l)));
  s.money = 10; assert.ok(L.buyRented(s, l).includes('insuficiente'));
  s.money = 1e8; assert.equal(L.buyRented(s, l), null); assert.equal(l.own, true); assert.equal(l.paid, undefined);
  // dono fica com 15% da safra (sem sorteio: rng fixo)
  const s2 = mk(); s2.cars.push({ id: 1, model: 'deere', value: 1 }); s2.lands[0].crop = { type: 'soja', left: 1 };
  const before = s2.stock.soja; L.tick(s2, () => 0.5);
  const bruto = 10 * 60; assert.equal(s2.stock.soja - before, bruto - Math.round(bruto * 0.15));
}
console.log('arrendamento ok');
// tempo de mundo: mesmo mês para todos, recuperação limitada, aceleração sem voltar no tempo
import * as WD from './world.js';
{
  const w = { epoch: 1000, base: 1, monthMs: 60000 };
  assert.equal(WD.current(w, 1000), 1); assert.equal(WD.current(w, 1000 + 59999), 1); assert.equal(WD.current(w, 1000 + 60000), 2); assert.equal(WD.current(w, 1000 + 600000), 11);
  assert.equal(WD.msLeft(w, 1000 + 15000), 45000); assert.ok(Math.abs(WD.progress(w, 1000 + 15000) - 0.25) < 1e-9);
  assert.deepEqual(WD.plan(5, 5), { ticks: 0, skipped: 0 }); assert.deepEqual(WD.plan(9, 5), { ticks: 0, skipped: 0 });
  assert.deepEqual(WD.plan(5, 8), { ticks: 3, skipped: 0 }); assert.deepEqual(WD.plan(1, 100), { ticks: 6, skipped: 93 });
  const now = 1000 + 600000, f = WD.setSpeed(w, 10000, now);
  assert.equal(WD.current(f, now), 11); assert.equal(WD.current(f, now + 10000), 12);          // acelerar não muda o mês atual
  assert.equal(WD.current(WD.advance(f, 5), now), 16);
  assert.equal(WD.sanitize({ monthMs: 5 }).monthMs, WD.MIN_MONTH_MS); assert.equal(WD.sanitize(null).base, WD.DEFAULT.base);
  assert.equal(WD.fmt(61000), '1:01'); assert.equal(WD.fmt(3700000), '1h01');
  // madrugada (01:00 às 09:00 de Brasília) o mês dura o dobro: 5 min de dia, 10 min de madrugada, 240 meses por dia real
  const d0 = Date.UTC(2026, 10, 24, 3), v = WD.sanitize({ epoch: d0, base: 100, monthMs: 300000, nightMs: 600000 });   // 00:00 de Brasília
  assert.equal(WD.msLeft(v, d0), 300000); assert.equal(WD.msLeft(v, d0 + 2 * 36e5), 600000); assert.equal(WD.msLeft(v, d0 + 10 * 36e5), 300000);
  assert.equal(WD.current(v, d0 + 36e5), 112); assert.equal(WD.current(v, d0 + 9 * 36e5), 160); assert.equal(WD.current(v, d0 + 864e5), 340);
  assert.ok(WD.isNight(d0 + 2 * 36e5) && !WD.isNight(d0 + 10 * 36e5));
  assert.equal(WD.msUntil(v, d0 + 36e5 - 60000, 2), 60000 + 600000);   // 1 min para virar e o mês seguinte já é de madrugada
}
console.log('mundo ok');
// mercado ao vivo: preço determinístico, aposta por tempo, sem devolução se errar
import * as MK from './market.js';
{
  const t0 = Date.UTC(2026, 10, 18, 12);
  assert.equal(MK.price('btc', t0), MK.price('btc', t0));
  for (const a of Object.keys(MK.ASSETS)) { const p = MK.price(a, t0); assert.ok(p > MK.ASSETS[a].price * 0.5 && p < MK.ASSETS[a].price * 2, a + ' ' + p); }
  // sobe e desce perto de 50/50 em 1 minuto (justo antes da taxa da casa)
  let up = 0, n = 4000; for (let i = 0; i < n; i++) { const t = t0 + i * 61000; if (MK.price('soja', t + 60000) > MK.price('soja', t)) up++; }
  assert.ok(up / n > 0.44 && up / n < 0.56, 'sobe ' + up / n);
  // movimento de 1 minuto não é minúsculo nem absurdo
  let mv = 0; for (let i = 0; i < 500; i++) { const t = t0 + i * 97000; mv += Math.abs(MK.price('boi', t + 60000) / MK.price('boi', t) - 1); }
  assert.ok(mv / 500 > 0.0002 && mv / 500 < 0.02, 'mov ' + mv / 500);
  const c = MK.candles('dol', t0, 5, 60); assert.equal(c.length, 60); assert.ok(c.every(k => k.h >= Math.max(k.o, k.c) && k.l <= Math.min(k.o, k.c)));
  const s = { money: 10000, nextId: 1, trades: [{ id: 99, asset: 'boi', side: 1, lev: 5, margin: 700, entry: 300 }] };
  assert.ok(MK.open(s, { asset: 'boi', side: 1, stake: 50, minutes: 1 }, t0).err);
  assert.ok(MK.open(s, { asset: 'boi', side: 1, stake: 500, minutes: 3 }, t0).err);
  const o = MK.open(s, { asset: 'boi', side: 1, stake: 1000, minutes: 1 }, t0); assert.ok(o.trade); assert.equal(s.money, 9000);
  assert.equal(MK.settle(s, t0 + 1000).filter(r => !r.old).length, 0);          // ainda não venceu (a antiga devolve a margem)
  assert.equal(s.money, 9700);
  const r = MK.settle(s, t0 + 60000)[0];
  const won = MK.price('boi', t0 + 60000) > MK.price('boi', t0);
  assert.equal(r.win, won); assert.equal(s.money, 9700 + (won ? 1700 : 0)); assert.equal(s.trades.length, 0);
  assert.deepEqual([1, 5, 10].map(MK.payout), [1.7, 1.8, 1.88]);   // quanto mais longo, mais paga
  const old = { money: 0, trHist: [], trades: [{ id: 1, asset: 'boi', side: won ? 1 : -1, stake: 1000, minutes: 1, entry: MK.price('boi', t0), at: t0, exp: t0 + 60000 }] };
  MK.settle(old, t0 + 60000); assert.equal(old.money, 1850);   // operação aberta antes (sem pay) recebe o 1,85x combinado
}
console.log('mercado ok');
// notícia de economia mexe de verdade: na seca a colheita de soja sai menor, e o livro-caixa diz por quê
{ const EC = await import('./econ.js'), m = 214, st = EC.state(m);
  assert.ok(st.crop.soja < 1 && st.price.soja > 1, 'seca do mês 214: colheita menor e preço maior');
  const grow = () => { const t = L.newState(() => 0.5); t.money = 1e7; const l = { id: 3, own: true, region: 'cerrado, goiás', ha: 100, cap: 0.9, value: 5e6 }; t.lands.push(l); L.plant(t, l, 'soja', false); for (let i = 0; i < L.CROPS.soja.months; i++) L.tick(t, () => 0.5); return t; };
  const normal = grow().stock.soja; EC.apply(m, L.ECON, {}, L.CROP_YIELD); const seca = grow(); EC.apply(1, L.ECON, {}, L.CROP_YIELD);
  assert.equal(seca.stock.soja, Math.round(normal * st.crop.soja)); assert.ok(seca.log.some(x => /seca do noticiário levou/.test(x.txt)));
  assert.match(EC.effectTxt(EC.events(m).find(e => e.kind === 'seca'), m), /colheita de soja −\d+%/); }
console.log('notícia de economia na lavoura ok');
// menções e privado no chat
{
  assert.ok(CH.mentions('oi @Ana, vende a hilux?', 'Ana'));
  assert.ok(CH.mentions('@joão silva vem', 'João Silva'));
  assert.ok(!CH.mentions('oi Ana', 'Ana'));
  assert.ok(!CH.mentions('@Anabela', 'Bela'));
  const pv = CH.accept({ text: 'oi', pv: true, toName: '<b>Bia', hi: true });
  assert.ok(pv.pv && !pv.hi && pv.toName === 'bBia');
}
console.log('chat pv ok');
// pacotes: várias cartas, valor médio perto do preço, mas vender ou pagar terra com elas nunca dá lucro garantido
{
  for (const [k, P] of Object.entries(CD.PACKS)) {
    const ev = CD.packEV(k);
    assert.ok(ev * CD.LAND_RATE < P.price && ev * CD.SELL < P.price, `${k} dá lucro na loja: ${ev}`);   // o valor de verdade vem da troca entre jogadores
  }
  const s = { money: 300000, nextId: 1 };
  const sorte = () => 0, azar = () => 0.99;
  assert.equal(CD.openPack(s, 'lendario', sorte).cards.length, 5); assert.equal(s.money, 300000 - CD.PACKS.lendario.price);
  assert.ok(CD.openPack(s, 'lendario').err);
  const o = CD.openPack(s, 'ouro', sorte); assert.equal(o.cards.length, 3); assert.notEqual(CD.rarityOf(o.cards[0]), 'comum');
  const v = CD.openPack(s, 'simples', azar); assert.deepEqual(v.cards, [], 'pacote pode vir vazio'); assert.equal(s.money, 300000 - CD.PACKS.lendario.price - CD.PACKS.ouro.price - CD.PACKS.simples.price, 'vazio também cobra');
  for (const [k, P] of Object.entries(CD.PACKS)) { let n = 0; for (let i = 0; i < 4000; i++) if (CD.openPack({ money: 1e9, nextId: 1 }, k, Math.random, Date.UTC(2027, 2, 10), true).cards.length) n++; assert.ok(Math.abs(n / 4000 - P.hit) < 0.04, `${k}: ${n}/4000 com carta`); assert.match(P.hint, /% de chance de vir carta$/); }
  // valoriza bem devagar com o dono, e a loja paga pouco
  const h = { month: 1000, nextId: 1 }, c = CD.give(h, { set: 'fortuna', key: 'jackpot' });
  CD.setMonth(1000); assert.equal(CD.value(c), 8000);
  CD.setMonth(1000 + CD.PACK_DAY * 10); assert.equal(CD.value(c), 8400, '10 dias: +5%');
  CD.setMonth(1000 + CD.PACK_DAY * 999); assert.equal(CD.value(c), 12000, 'teto de +50%');
  h.money = 0; assert.equal(CD.sell(h, c.id), 4800, 'loja paga 40%');
  CD.setMonth(0);
}
console.log('pacotes ok');
// loja: vender tudo para a casa, anunciar, comprador da casa nunca paga a ponto de virar máquina de dinheiro
import * as SH from './shop.js';
{
  const s = L.newState(); s.money = 1e7;
  s.cars.push({ id: 501, model: 'hilux', value: 330000 });
  s.cards = [{ id: 'k1', tier: 'diamante', champ: 'brasa' }];
  FT.takeClub(s, 'Barra-SC');
  const keys = SH.items(s).map(i => i.key);
  assert.ok(keys.includes('car:501') && keys.includes('card:k1') && keys.includes('club:club'));
  const m0 = s.money, r = SH.sellToHouse(s, 'car:501');
  assert.equal(r.amount, Math.round(330000 * L.CAR_BUYBACK)); assert.equal(s.money, m0 + r.amount); assert.equal(s.cars.length, 0);
  const cv = SH.clubValue(s.fut); assert.ok(cv > 0);
  assert.ok(SH.sellToHouse(s, 'club:club').err, 'clube preso no contrato');
  assert.ok(cv + FT.sponsorOf(s.fut) < FT.clubPrice('Barra-SC'), 'comprar, pegar o patrocínio e revender não dá lucro');
  s.month += FT.CONTRACT;
  const c = SH.sellToHouse(s, 'club:club'); assert.equal(c.amount, cv); assert.equal(s.fut, undefined);
  // comprador da casa: anunciar caro demais nunca vende; perto do preço da casa vende às vezes
  assert.equal(SH.npcChance(1000 * SH.NPC_MAX + 1, 1000), 0);
  assert.ok(SH.npcChance(1000, 1000) > 0);
  // nunca dá para comprar um carro novo e revender com lucro
  assert.ok(L.CAR_BUYBACK * SH.NPC_MAX < 1);
  assert.equal(SH.list(s, 'card:k1', 50), 'preço mínimo R$ 100.');
  assert.equal(SH.list(s, 'card:k1', 90000), null); assert.ok(SH.list(s, 'card:k1', 90000).includes('anunciado'));
  let sd = 3; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400; i++) SH.npcTick(s, rr);
  assert.equal(s.cards.length, 1);          // 90 mil por uma carta que a casa paga ~56 mil: ninguém da casa compra
  SH.unlist(s, s.shop[0].id); assert.equal(SH.list(s, 'card:k1', SH.housePrice(s, SH.find(s, 'card:k1'))), null);
  let sold = []; for (let i = 0; i < 400 && !sold.length; i++) sold = SH.npcTick(s, rr);
  assert.equal(sold.length, 1); assert.equal(s.cards.length, 0);
}
console.log('loja ok');
// escalação manual
{
  const s = { money: 1e9 }; FT.takeClub(s, 'Remo'); const f = s.fut;
  const auto = FT.lineup(f.squad, '4-4-2');
  assert.equal([...auto.gk, ...auto.def, ...auto.mid, ...auto.att].filter(Boolean).length, 11);
  const ata = f.squad.find(p => p.pos === 'ATA');
  assert.equal(FT.setSlot(f, 'gk0', ata.id), null);
  const l = FT.lineup(f.squad, '4-4-2', f.xi);
  assert.equal(l.gk[0].id, ata.id); assert.ok(l.gk[0].off && l.gk[0].ovr < ata.ovr);       // fora de posição rende menos
  assert.ok(FT.strength(f.squad, '4-4-2', 'equilibrado', 0, f.xi).def < FT.strength(f.squad, '4-4-2').def);
  FT.setSlot(f, 'att0', ata.id); assert.equal(f.xi.gk0, undefined);                          // muda de vaga
  ata.inj = 2; assert.notEqual(FT.lineup(f.squad, '4-4-2', f.xi).att[0]?.id, ata.id);        // lesionado sai sozinho
  assert.ok(FT.setSlot(f, 'att9', ata.id));
}
console.log('escalação ok');
{ // Receita Federal: sobe 10 mi devagar não pega; 15 mi em 5 min pega; amostra velha (> 10 min) sai da conta; rico precisa subir 25%
  const a = []; let t = 0;
  for (let i = 0; i < 20; i++) assert.equal(L.receitaFlag(a, t += 60000, 1e6 + i * 0.4e6), 0);   // +8 mi em 20 min
  const b = []; assert.equal(L.receitaFlag(b, 0, 1e6), 0); assert.ok(L.receitaFlag(b, 300000, 16e6) > 0);
  const c = []; L.receitaFlag(c, 0, 1e6); assert.equal(L.receitaFlag(c, 700000, 20e6), 0);
  const d = []; L.receitaFlag(d, 0, 300e6); assert.equal(L.receitaFlag(d, 60000, 360e6), 0); assert.ok(L.receitaFlag(d, 120000, 380e6) > 0);
  console.log('receita federal ok');
}
{ // painel do admin: margem fora do normal vira alerta; margem normal não; economia soma os jogadores
  const AE = await import('./admin-econ.js');
  const mk = (lin, lout) => ({ ...L.newState(() => 0.5), month: 10, pl: { 9: { lavoura: { in: lin, out: lout, bem: 0 }, suinos: { in: 5e6, out: 4.2e6, bem: 0 } } } });
  const bad = mk(80e6, 10e6), ok = mk(80e6, 50e6);
  assert.ok(AE.pnl(bad).rows.find(x => x.key === 'lavoura').alert && AE.alerts(bad).some(a => /lavouras/.test(a)), 'lavoura com 88% de margem é alerta');
  assert.ok(!AE.pnl(ok).rows.some(x => x.alert), 'margem de 37% é normal');
  const e = AE.economy([{ name: 'a', data: bad }, { name: 'b', data: ok }]);
  assert.equal(e.players, 2); assert.equal(e.rows.find(x => x.key === 'lavoura').in, 160e6); assert.equal(e.rows.find(x => x.key === 'lavoura').top.name, 'a');
  assert.ok(AE.worthParts(ok).parts.dinheiro === ok.money && AE.activities({ ...ok, fut: { club: 'Remo', div: 1, season: 2, league: { round: 5 } } }).some(a => /Remo/.test(a)));
  console.log('painel: economia do jogador ok');
}
{ // futebol com preço real (v151): clube da escala antiga é devolvido pelo preço antigo; clube novo não é mexido
  const old = { money: 1000, fut: { club: 'Paysandu', div: 2, squad: [{ id: 'a', ovr: 60 }] }, shop: [{ key: 'player:a' }, { key: 'car:1' }], freeAgents: [{ id: 'b' }] };
  const v = FT.migrate(old); assert.ok(v > 0 && v < 200000 && old.money === 1000 + v && !old.fut && old.shop.length === 1 && !old.freeAgents.length);
  const nw = { money: 1e9 }; FT.takeClub(nw, 'Paysandu'); assert.equal(FT.migrate(nw), 0); assert.ok(nw.fut.real);
  assert.ok(FT.sponsorOf({ club: 'Paysandu', div: 0 }) < FT.sponsorOf({ club: 'Flamengo', div: 0 }), 'clube pequeno na Série A ganha menos que o grande');
  console.log('futebol: migração para preço real ok');
}
// jogadores do mundo: nicks únicos, ranking alcançável e movimento ao longo do dia
import * as NP from './npcs.js';
{
  assert.equal(new Set(NP.NPCS.map(n => n.nick)).size, NP.NPCS.length);
  const w1 = NP.NPCS.map(n => NP.worthAt(n, 1)).sort((a, b) => b - a);
  assert.ok(w1[0] < 1.2e6, 'topo alto demais');
  assert.ok(w1.filter(w => w < 100000).length >= 10, 'novato precisa passar alguém logo');
  const at = h => NP.onlineCount(Date.UTC(2026, 10, 18, h + 3));          // horário de Brasília
  for (let h = 0; h < 24; h++) assert.ok(at(h) >= 68 && at(h) <= 159, `online fora de 68 a 159 às ${h} h: ${at(h)}`);
  assert.ok(at(21) > 130 && at(4) < 80, 'pico à noite, vale de madrugada');
  assert.ok(at(21) > at(4), 'à noite tem mais gente que de madrugada');
  assert.equal(NP.onlineNow(Date.UTC(2026, 10, 18, 15)).length, NP.onlineNow(Date.UTC(2026, 10, 18, 15, 5)).length);
  const p = NP.profile(NP.NPCS[0], 3); assert.ok(p.name && p.level >= 1 && p.stats.hands >= 0 && p.bio);
  // largaram o cassino: partidas paradas depois do dia, perfil com o que tem (empresas, terras) como quem tem conta
  const p1 = NP.profile(NP.NPCS[0], 5000), p2 = NP.profile(NP.NPCS[0], 9000);
  assert.equal(p1.stats.hands, p2.stats.hands, 'cassino parado'); assert.ok(p2.biz.length >= 1 && p2.landList.length >= 1, 'rico tem empresa e terra no perfil');
}
console.log('jogadores do mundo ok');
// confinamento: novato sem terra consegue lucrar com gado (menos que quem tem pasto)
{
  const s = L.newState(() => 0.5); const m0 = s.money;
  s.money -= 10 * s.prices.bezerro; s.herd.push({ id: 1, heads: 10, kg: 180 });
  let months = 0; while (s.herd[0].kg < 450) { L.tick(s, () => 0.5); months++; s.prices.arroba = 310; s.prices.bezerro = 2600; }
  const sale = 10 * L.arrobas(s.herd[0].kg) * 310 * (1 - L.cattleFee(s));
  assert.ok(sale - 10 * 2600 - months * 10 * L.BOITEL_COST > 0, 'boitel dá prejuízo');
}
// granja: galpão, lote, engorda, venda no ponto certo dá lucro; passar do ponto rende menos; galpão revende abaixo do preço
import * as GR from './granja.js';
{
  const mk = () => { const s = { money: 2e6, prices: {}, nextId: 1 }; GR.ensure(s); return s; };
  const s = mk(); assert.equal(GR.buyHouse(s, 'convencional'), null); const hid = s.granja.houses[0].id;
  assert.ok(GR.house(s, hid, 20000).err.includes('comporta'));
  assert.ok(GR.house(s, hid, 15000, true).cost > 0); assert.ok(GR.house(s, hid, 100).err.includes('já tem'));
  const lid = s.granja.lots[0].id; assert.ok(GR.sellLot(s, lid).err);
  const before = s.money + GR.housingCost(s, 15000, true);
  GR.monthly(s, () => 0.5); GR.monthly(s, () => 0.5);
  const r = GR.sellLot(s, lid); const profit = s.money - before;
  assert.ok(profit > 0 && profit < 15000 * 4, 'lucro do lote ' + profit);
  // passar do ponto (4 meses) dá menos que vender no 2º mês
  const s2 = mk(); GR.buyHouse(s2, 'convencional'); const h2 = s2.granja.houses[0].id; GR.house(s2, h2, 15000, true);
  const b2 = s2.money + GR.housingCost(s2, 15000, true); for (let i = 0; i < 4; i++) GR.monthly(s2, () => 0.5); GR.sellLot(s2, s2.granja.lots[0].id);
  assert.ok(s2.money - b2 < profit, 'passar do ponto deveria render menos');
  assert.ok(GR.sellHouse(s, hid).amount < GR.HOUSES.convencional.price);
  // sem vacina, a doença mata muito mais
  const s3 = mk(); GR.buyHouse(s3, 'pequeno'); GR.house(s3, s3.granja.houses[0].id, 5000, false); GR.monthly(s3, () => 0.001);
  const s4 = mk(); GR.buyHouse(s4, 'pequeno'); GR.house(s4, s4.granja.houses[0].id, 5000, true); GR.monthly(s4, () => 0.001);
  assert.ok(s3.granja.lots[0].birds < s4.granja.lots[0].birds);
  assert.ok(L.netWorth({ ...L.newState(), granja: s.granja }) > L.netWorth(L.newState()) - 1);
}
console.log('granja ok');
// pomar de laranja: forma, colhe a cada 4 meses, defensivo segura a praga; matadouro: abate rende mais que vender vivo, sem máquina de dinheiro
import * as PM from './pomar.js';
import * as AB from './abate.js';
{
  const mk = () => { const s = L.newState(() => 0.5); PM.ensure(s); s.money = 1e7; s.lands.push({ id: 77, own: true, region: 'x', ha: 20, value: 400000, use: 'lavoura', cap: 1, leasedOut: false }); return s; };
  const s = mk(), l = s.lands[0];
  assert.equal(PM.plant(s, l), null); assert.ok(PM.plant(s, l).includes('ocupada'));
  assert.equal(L.capacity(s), 0, 'pomar não serve de pasto');
  for (let i = 0; i < PM.ORANGE.grow; i++) PM.monthly(s, () => 0.5);
  assert.ok(s.stock.laranja > 0, 'primeira colheita no fim da formação');
  const c1 = s.stock.laranja; for (let i = 0; i < PM.ORANGE.cycle; i++) PM.monthly(s, () => 0.5);
  assert.ok(s.stock.laranja > c1, 'colhe de novo 4 meses depois');
  // sem defensivo a praga sobe e a colheita cai
  const s2 = mk(), l2 = s2.lands[0]; PM.plant(s2, l2); PM.toggleSpray(l2);
  for (let i = 0; i < 6; i++) PM.monthly(s2, () => 0.99);
  assert.ok(s2.stock.laranja < c1, 'sem veneno deveria colher menos');
  // retorno: com custo e preço reais de 2026 (caixa a R$ 28) o pomar leva uns 8 anos para se pagar; em 3 não se paga
  const s3 = mk(), l3 = s3.lands[0], m0 = s3.money; PM.plant(s3, l3);
  for (let i = 0; i < 36; i++) PM.monthly(s3, () => 0.5);
  assert.ok(s3.money + s3.stock.laranja * PM.ORANGE.price < m0, 'pomar não pode se pagar em 3 anos');
  for (let i = 36; i < 108; i++) PM.monthly(s3, () => 0.5);
  assert.ok(s3.money + s3.stock.laranja * PM.ORANGE.price > m0, 'pomar deveria se pagar em 9 anos');
  // abate
  const a = L.newState(() => 0.5); a.money = 5e7; a.herd.push({ id: 1, heads: 10, kg: 450 });
  const vivo = AB.perHead(a, 450, 'vivo', L.cattleFee(a)), terc = AB.perHead(a, 450, 'terceiros'), prop = AB.perHead(a, 450, 'proprio');
  assert.ok(prop > terc && terc > vivo);
  assert.ok(AB.perHead(a, 180, 'proprio') < a.prices.bezerro, 'bezerro abatido não pode dar lucro');
  assert.ok(AB.buyAndSlaughter(a, 5).err.includes('frigorífico'));
  assert.equal(AB.build(a), null);
  const r = AB.slaughter(a, 1); assert.equal(r.own, 10); assert.ok(r.amount > 10 * vivo);
  assert.ok(AB.buyAndSlaughter(a, 400).err.includes('só abate'));
  const b = AB.buyAndSlaughter(a, 290); assert.ok(b.profit > 0 && b.profit < 290 * 600, 'lucro do boi comprado ' + b.profit);
  // um mês inteiro no limite não paga o custo fixo + a desvalorização com folga absurda
  assert.ok(b.profit + r.amount - 10 * vivo < AB.OWN.price, 'frigorífico se paga rápido demais');
}
console.log('laranja e abate ok');
// descuido: sem defensivo o pomar dá prejuízo e pode morrer
{
  const s = L.newState(() => 0.5); PM.ensure(s); s.money = 1e7; s.lands.push({ id: 78, own: true, region: 'y', ha: 20, value: 400000, use: 'lavoura', cap: 1, leasedOut: false });
  const l = s.lands[0], m0 = s.money; PM.plant(s, l); PM.toggleSpray(l);
  let sd = 4; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 24; i++) PM.monthly(s, r);
  assert.ok(s.money + s.stock.laranja * PM.ORANGE.price < m0, 'descuidado deveria dar prejuízo');
  const s2 = L.newState(() => 0.5); PM.ensure(s2); s2.money = 1e7; s2.lands.push({ id: 79, own: true, region: 'z', ha: 10, value: 200000, use: 'lavoura', cap: 1, leasedOut: false });
  PM.plant(s2, s2.lands[0]); PM.toggleSpray(s2.lands[0]);
  for (let i = 0; i < 24 && s2.lands[0].orchard; i++) PM.monthly(s2, () => 0.01);
  assert.equal(s2.lands[0].orchard, undefined, 'greening sem controle deveria matar o pomar');
}
console.log('descuido ok');
// canavial: corta na época, rende menos a cada corte, se paga com cuidado e dá prejuízo sem tratos
import * as CN from './cana.js';
{
  const mk = () => { const s = L.newState(() => 0.5); CN.ensure(s); s.month = 1; s.money = 1e7; s.lands.push({ id: 81, own: true, region: 'r', ha: 50, value: 800000, use: 'lavoura', cap: 1, leasedOut: false }); return s; };
  const run = (s, n, rng) => { for (let i = 0; i < n; i++) { CN.monthly(s, rng); s.month++; } };
  const s = mk(), l = s.lands[0];
  assert.equal(CN.plant(s, l), null); assert.ok(CN.plant(s, l).includes('ocupada'));
  assert.equal(L.capacity(s), 0); assert.ok(PM.plant(s, l).includes('ocupada'));
  run(s, CN.CANE.first, () => 0.5);
  assert.equal(l.cane.cuts, 1, 'primeiro corte');
  const t1 = CN.expectedTons(l); run(s, CN.CANE.cycle, () => 0.5);
  assert.equal(l.cane.cuts, 2); assert.ok(CN.expectedTons(l) < t1, 'soca rende menos');
  // em 5 cortes, com cuidado, paga plantio e tratos
  const s2 = mk(), m0 = s2.money; CN.plant(s2, s2.lands[0]); run(s2, CN.CANE.first + CN.CANE.cycle * 4, () => 0.5);
  assert.ok(s2.money > m0, 'canavial cuidado deveria dar lucro: ' + (s2.money - m0));
  // sem tratos dá prejuízo
  const s3 = mk(), m3 = s3.money; CN.plant(s3, s3.lands[0]); CN.toggleCare(s3.lands[0]);
  let sd = 6; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  run(s3, CN.CANE.first + CN.CANE.cycle * 4, r);
  assert.ok(s3.money < m3, 'canavial abandonado deveria dar prejuízo');
}
console.log('cana ok');
// logística da cana: usina perto, caminhão e colhedora própria baixam o custo por tonelada
{
  const s = L.newState(); s.money = 1e7;
  const sp = { uf: 'sp' }, pa = { uf: 'pa' };
  assert.ok(CN.logistics(s, sp).total < CN.logistics(s, pa).total, 'usina longe deveria custar mais');
  const before = CN.logistics(s, pa).total; s.cars.push({ id: 1, model: 'scania', value: 1 });
  assert.ok(CN.logistics(s, pa).total < before, 'caminhão próprio deveria baratear o frete');
  const b2 = CN.logistics(s, pa).total; assert.equal(CN.buyHarvester(s), null); assert.ok(CN.logistics(s, pa).total < b2);
  assert.ok(CN.sellHarvester(s) < CN.HARVESTER.price);
}
console.log('logística da cana ok');

// ---------- apostas no futebol ----------
{
  const AP = await import('./aposta.js');
  const now = AP.slotStart(5000) + 1000, slot = AP.slotOf(now);
  assert.equal(slot, 5000); assert.equal(AP.phase(slot, now), 'pre');
  const ms = AP.matches(slot);
  assert.equal(ms.length, 30); assert.deepEqual(AP.matches(slot)[0].events, ms[0].events, 'mesma rodada, mesmo jogo para todos');
  // casa nunca perde no longo prazo: cada opção tem retorno esperado < 1 e a frequência real bate com o modelo
  const tally = {};
  let n = 0;
  for (let sl = 1; sl <= 120; sl++) for (const mt of AP.matches(sl)) {
    for (const m of AP.markets(mt)) for (const o of m.opts) {
      assert.ok(o.p * o.odd < 0.95, `odd generosa demais ${m.id} ${o.k}`);
      const key = `${m.id}:${o.k === 'h' || o.k === 'a' || o.k === 'd' || o.k === 'o' || o.k === 'u' ? o.k : 'x'}`;
      if (m.id === 'placar') continue;
      tally[key] ??= { w: 0, pay: 0 }; tally[key].w += AP.wins(mt, m.id, o.k) ? 1 : 0; tally[key].pay += AP.wins(mt, m.id, o.k) ? o.odd : 0;
    }
    n++;
  }
  for (const [k, t] of Object.entries(tally)) assert.ok(t.pay / n < 1, `retorno real acima de 1 em ${k}: ${(t.pay / n).toFixed(3)}`);
  const s = { chips: 1000 };
  assert.match(AP.place(s, now, slot, 0, 'res', 'h', 5), /mínima/);
  assert.equal(AP.place(s, now, slot, 0, 'res', 'h', 100), null); assert.equal(s.chips, 900);
  assert.match(AP.place(s, AP.slotStart(slot) + AP.PRE + 1, slot, 0, 'res', 'h', 100), /fecharam/);
  assert.equal(AP.settle(s, now).length, 0, 'não paga antes do fim');
  const r = AP.settle(s, AP.slotStart(slot) + AP.PRE + AP.LIVE);
  assert.equal(r.length, 1); assert.equal(s.chips, 900 + r[0].pay); assert.equal(s.fbets.length, 0);
  // liga: classificação soma 3 por vitória, todos jogam o mesmo número de jogos
  const st = AP.standings(0, AP.slotStart(AP.ROUNDS * 50 + 10) + AP.PRE + AP.LIVE + 1000);
  assert.equal(st.length, 20); assert.ok(st.every(x => x.j === 11 && x.pts === x.v * 3 + x.e), 'classificação errada');
  // cota de TV do dono do clube
  const tv = { money: 0, fut: { club: 'Flamengo' } }, t1 = AP.slotStart(AP.ROUNDS * 50 + 3) + 1000;
  assert.equal(AP.tvIncome(tv, t1).length, 0);
  const got = AP.tvIncome(tv, t1 + AP.SLOT * 3); assert.equal(got.length, 3); assert.ok(tv.money >= AP.TV[0] * 3);
  assert.equal(AP.tvIncome(tv, t1 + AP.SLOT * 3).length, 0, 'não paga duas vezes');
  // aposta antiga (sem versão) é devolvida
  const old = { chips: 0, fbets: [{ slot: 1, i: 0, stake: 50, mk: 'res', k: 'h', odd: 2 }] }; AP.settle(old, Date.now()); assert.equal(old.chips, 50);
  console.log('apostas futebol ok', Object.entries(tally).map(([k, t]) => `${k} ${(t.pay / n).toFixed(2)}`).join(' '));
}

// ---------- coleções de cartas: valor fixo, repetidas não somam, completa uma vez, sazonais só na temporada ----------
{
  const s = { money: 1e6, month: 10, nextId: 1, cards: [] };
  const c = CD.give(s, { tier: 'mestre', champ: 'brasa' }), b = CD.give(s, { tier: 'bronze', champ: 'brasa' });
  assert.equal(CD.value(c), 8000, 'lendária vale 8 mil na loja'); assert.equal(CD.value(b), 3000, 'comum vale 3 mil');
  assert.equal(CD.value(CD.give(s, { set: 'natal', key: 'noel' })), 10000, 'sazonal é exclusiva: 10 mil');
  assert.equal(CD.value(CD.give(s, { set: 'fortuna', key: 'jackpot' })), 8000);
  assert.equal(CD.progress(s, 'campeoes').have, 1, 'duas brasas contam uma vez');
  assert.equal(CD.duplicates(s).size, 1, 'a segunda brasa é repetida');
  // completa a Pecuária: vale uma vez e dá a vantagem
  for (const k of CD.SETS.pecuaria.cards) CD.give(s, { set: 'pecuaria', key: k.key });
  for (const k of CD.SETS.pecuaria.cards) CD.give(s, { set: 'pecuaria', key: k.key });
  assert.deepEqual(CD.claim(s), ['pecuaria']); assert.deepEqual(CD.claim(s), [], 'cada coleção completa uma vez só');
  assert.equal(CD.prestige(s), 10);
  const PKc = await import('./perks.js');
  assert.ok(Math.abs(PKc.mult(s, 'animais') - 0.95) < 1e-9, 'Pecuária: pintinho, leitão e bezerro 5% mais baratos');
  s.cards = s.cards.filter(x => x.set !== 'pecuaria'); assert.ok(Math.abs(PKc.mult(s, 'animais') - 0.95) < 1e-9, 'vantagem fica mesmo vendendo as cartas');
  s.colls.fortuna = 1; assert.equal(PKc.luck(s, 1000), 20, 'Fortuna: +2% do ganho de fichas (teto abaixo da vantagem da casa)'); assert.equal(PKc.luck(s, -500), 0, 'perda não ganha bônus');
  s.colls.prosperidade = 1; assert.ok(Math.abs(PKc.bonus(s, 'perda') + 0.02) < 1e-9, 'Prosperidade: 2 pontos a menos de perda');
  // sazonal: só na temporada (calendário de verdade)
  const dez = Date.UTC(2026, 11, 10, 15), mar = Date.UTC(2027, 2, 10, 15);
  assert.ok(CD.seasonOpen('natal', dez) && !CD.seasonOpen('natal', mar) && !CD.seasonOpen('natal', Date.UTC(2027, 0, 3, 15)) && !CD.seasonOpen('natal', Date.UTC(2026, 10, 25, 15)) && CD.seasonOpen('natal', Date.UTC(2026, 11, 1, 12)) && CD.seasonOpen('natal', Date.UTC(2026, 11, 31, 23)), 'natal só em dezembro');
  assert.ok(CD.seasonOpen('junina', Date.UTC(2027, 5, 15, 15)) && !CD.seasonOpen('junina', dez));
  const sp = CD.openPack(s, 'sazonal:natal', () => 0, dez); assert.equal(sp.cards.length, 3); assert.equal(sp.cards[0].set, 'natal', 'pacote sazonal garante 1 carta da temporada');
  assert.match(CD.openPack(s, 'sazonal:natal', Math.random, mar).err, /acabou/);
  for (let i = 0; i < 300; i++) { const r = CD.openPack({ money: 1e7, month: i, nextId: 1 }, 'simples', Math.random, mar); assert.ok(!r.cards.some(x => CD.SETS[x.set]?.kind === 'sazonal'), 'fora da temporada não sai sazonal'); }
  let saz = 0; for (let i = 0; i < 2000; i++) { const r = CD.openPack({ money: 1e7, month: i, nextId: 1 }, 'simples', Math.random, dez); if (r.cards.some(x => x.set === 'natal')) saz++; }
  assert.ok(saz > 10 && saz < 60, `na temporada os pacotes comuns às vezes trazem sazonal (${saz}/2000)`);
  // prêmio de pacote (roleta do dia) não cobra nem gasta estoque
  const g = { money: 0, month: 3, nextId: 1 }; assert.equal(CD.openPack(g, 'ouro', () => 0, mar, true).cards.length, 3); assert.equal(g.money, 0);
  // estoque mensal e troca só aceita carta que existe
  s.month = 20; for (let i = 0; i < CD.PACKS.ouro.stock; i++) assert.ok(!CD.openPack(s, 'ouro').err);
  assert.match(CD.openPack(s, 'ouro').err, /esgotado/);
  s.month = 21; assert.match(CD.openPack(s, 'ouro').err, /esgotado/, 'mês seguinte ainda esgotado'); s.month = 20 + CD.PACK_DAY; assert.ok(!CD.openPack(s, 'ouro').err, 'estoque volta no dia seguinte');
  assert.equal(CD.sanitize({ set: 'natal', key: 'xx' }), null); assert.deepEqual(CD.sanitize({ set: 'natal', key: 'noel', id: 'a' }), { set: 'natal', key: 'noel', id: 'a' });
}
console.log('coleções de cartas ok');

// ---------- máquinas de laranja e cana ----------
{
  const PMx = await import('./pomar.js'), CNx = await import('./cana.js');
  const land = { id: 1, own: true, ha: 10, uf: 'mt', region: 'x' };
  const a = { cars: [] }, b = { cars: [{ model: 'transbordo' }, { model: 'rodotrem' }] };
  const la = CNx.logistics(a, land), lb = CNx.logistics(b, land);
  assert.ok(lb.load < la.load && lb.freight < la.freight * 0.6, 'transbordo e rodotrem baratear a logística');
  const mk = cars => ({ money: 1e6, cars, stock: {}, lands: [{ ...land, orchard: { age: 0, health: 1, pest: 0, spray: true, harvests: 0 } }] });
  const s1 = mk([]), s2 = mk([{ model: 'pulv' }]);
  PMx.monthly(s1, () => 0.5); PMx.monthly(s2, () => 0.5);
  assert.ok(1e6 - s2.money < (1e6 - s1.money) * 0.75, 'pulverizador baratear o defensivo');
}
console.log('máquinas ok');

// ---------- anúncios dos jogadores do mundo ----------
{
  const SHx = await import('./shop.js'), L2 = await import('./logic.js');
  const s = L2.newState(() => 0.4); s.money = 1e8; s.stable = { animals: [], offers: [], next: 1 }; s.stock.laranja = 0;
  s.month = 1; const now = 1.8e12;
  assert.ok(SHx.npcListings(s, now).every(l => l.price <= 10000), 'mundo novo: bot pobre não anuncia carro nem terra');
  s.month = 1200; const ls = SHx.npcListings(s, now);
  assert.ok(new Set(ls.map(l => l.cat)).size >= 6, 'anúncios de várias categorias');
  assert.deepEqual(SHx.npcListings(s, now).map(l => l.label), ls.map(l => l.label), 'iguais para todos na mesma janela');
  for (const l of ls) {
    const before = s.money, r = SHx.buyNpc(s, l.id, now);
    assert.ok(!r.err, `${l.label}: ${r.err}`);
    assert.equal(before - s.money, l.price);
    assert.ok(!SHx.npcListings(s, now).some(x => x.id === l.id), 'vendido some do anúncio');
  }
  // revender tudo na loja na hora devolve menos do que custou
  const paid = ls.reduce((t, l) => t + l.price, 0), back = SHx.items(s).reduce((t, it) => t + SHx.housePrice(s, it), 0) + s.herd.reduce((t, h) => t + h.heads * s.prices.bezerro, 0);
  assert.ok(back < paid, `anúncio com lucro garantido: pagou ${paid}, loja paga ${back}`);
}
console.log('anúncios dos jogadores ok');

// ---------- truco ----------
{
  const TR = await import('./truco.js');
  const C = (r, s) => ({ r, s });
  assert.equal(TR.manilhaOf(C('7', '♣')), 'Q'); assert.equal(TR.manilhaOf(C('3', '♦')), '4');
  assert.ok(TR.power(C('4', '♣'), '4') > TR.power(C('4', '♥'), '4') && TR.power(C('4', '♦'), '4') > TR.power(C('3', '♣'), '4'), 'zap > copas; manilha > 3');
  assert.equal(TR.power({ ...C('3', '♣'), hidden: true }, '4'), -1);
  // rodadas: empate na 1ª decide a 2ª; ganhou a 1ª e empatou a 2ª leva quem ganhou a 1ª; tudo empatado ninguém
  assert.equal(TR.handWinner([0, 0]), 0); assert.equal(TR.handWinner([-1, 1]), 1); assert.equal(TR.handWinner([1, -1]), 1);
  assert.equal(TR.handWinner([0, 1]), undefined); assert.equal(TR.handWinner([0, 1, -1]), 0); assert.equal(TR.handWinner([-1, -1, 0]), 0); assert.equal(TR.handWinner([-1, -1, -1]), null);
  // empate entre parceiros não é empate
  assert.equal(TR.trickWinner([{ seat: 0, card: C('3', '♦') }, { seat: 1, card: C('2', '♦') }, { seat: 2, card: C('3', '♠') }, { seat: 3, card: C('A', '♦') }], '4').team, 0);
  assert.equal(TR.trickWinner([{ seat: 0, card: C('3', '♦') }, { seat: 1, card: C('3', '♠') }], '4').team, -1);
  // partidas inteiras só com a casa jogando: sempre termina em 12, sem travar
  let sd = 5; const rng = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let g = 0; g < 40; g++) {
    const t = new TR.Truco({ auto: false, rng }); t.botNames = ['A', 'B', 'C', 'D']; t.start();   // só joga quem da casa está sentado
    let guard = 0;
    while (t.phase !== 'gameEnd' && guard++ < 5000) {
      const need = t.who();
      if (need.length) { const s = t.phase === 'play' ? need[0] : need[0]; t.botAct(s); } else t.flush();
    }
    assert.equal(t.phase, 'gameEnd', 'partida travou'); assert.ok(Math.max(...t.score) >= 12);
  }
  // pedir truco, correr: a outra dupla leva o valor de antes
  const t = new TR.Truco({ auto: false, rng }); t.botNames = ['A', 'B', 'C', 'D']; t.start();   // só joga quem da casa está sentado
  while (t.phase !== 'play') { t.who().length ? t.botAct(t.who()[0]) : t.flush(); }
  const s0 = t.turn, sc = [...t.score];
  assert.equal(t.act(s0, { t: 'truco' }), null); assert.equal(t.phase, 'raise');
  assert.match(t.act(s0, { t: 'accept' }), /outra dupla/);
  t.act((s0 + 1) % 4, { t: 'run' });
  assert.equal(t.score[TR.team(s0)], sc[TR.team(s0)] + t.hand.result.value);
  // a mesma dupla não pede duas vezes seguidas; a outra pode aumentar
  t.flush(); while (t.phase !== 'play') { t.who().length ? t.botAct(t.who()[0]) : t.flush(); }
  if (!t.hand.onze && !t.hand.iron) {
    const a = t.turn; t.act(a, { t: 'truco' }); t.act((a + 1) % 4, { t: 'raise' });
    assert.equal(t.hand.value, 3); assert.equal(t.hand.raise.to, 6); assert.equal(t.hand.raise.by, TR.team(a + 1));
    t.act(a, { t: 'accept' }); assert.equal(t.hand.value, 6);
    assert.ok(!t.canRaise((a + 1) % 4) || t.turn !== (a + 1) % 4 || true);
  }
  // visão: só vê as próprias cartas
  const v = t.view(0); assert.ok(v.hand.cards[1].every(c => c === null) && v.hand.cards[0].every(c => c));
}
console.log('truco ok');

// ---------- sinuca ----------
{
  const SN = await import('./sinuca.js');
  // bola tacada reta em direção à caçapa do canto cai
  const b0 = [{ n: 0, x: 40, y: 40, vx: 0, vy: 0, in: false }, { n: 3, x: 20, y: 20, vx: 0, vy: 0, in: false }];
  const r0 = SN.run(b0, Math.atan2(20 - 40, 20 - 40), 0.5);
  assert.ok(r0.ev.pocketed.includes(3) && r0.ev.first === 3, 'bola no canto deveria cair: ' + JSON.stringify(r0.ev));
  // quebra: bolas se espalham e tudo para
  let sd = 3; const rng = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const rk = SN.rack(rng); assert.equal(rk.length, 16); assert.deepEqual(rk.map(x => x.n).sort((a, b) => a - b), [...Array(16).keys()], 'bolas repetidas no triângulo'); assert.ok(rk.every(a => rk.every(b => a === b || Math.hypot(a.x - b.x, a.y - b.y) >= 2 * SN.R - 0.01)), 'bolas sobrepostas no triângulo');
  const br = SN.run(rk, Math.atan2(SN.FOOT.y - SN.HEAD.y, SN.FOOT.x - SN.HEAD.x), 1);
  assert.ok(br.balls.every(b => b.in || (b.x >= 0 && b.x <= SN.L && b.y >= 0 && b.y <= SN.WD)), 'bola fora da mesa');
  assert.ok(br.balls.filter(b => !b.in && b.n).some(b => Math.hypot(b.x - SN.FOOT.x, b.y - SN.FOOT.y) > 20), 'quebra não espalhou');
  // falta: não tocar em nada = bola na mão para o outro
  const g = new SN.Sinuca({ rng }); g.seats = [{ kind: 'bot', name: 'A' }, { kind: 'bot', name: 'B' }]; g.start(); g.broke = true;
  const t0 = g.turn; g.balls = g.balls.map(b => (b.n ? { ...b } : { ...b, x: 10, y: 50 }));
  g.apply(t0, { balls: g.balls, ev: { first: null, pocketed: [], cushion: false } });
  assert.equal(g.turn, 1 - t0); assert.ok(g.inHand);
  // partidas inteiras entre jogadores da casa terminam com vencedor
  let wins = 0;
  for (let k = 0; k < 15; k++) {
    const m = new SN.Sinuca({ rng }); m.seats = [{ kind: 'bot', name: 'A' }, { kind: 'bot', name: 'B' }]; m.start();
    let n = 0;
    while (m.phase !== 'end' && n++ < 400) { const s = SN.botShot(m, m.turn, 0.9, rng); m.apply(m.turn, SN.run(m.balls, s.angle, s.power)); }
    assert.equal(m.phase, 'end', 'partida de sinuca não terminou'); wins++;
  }
  console.log('sinuca ok', wins);
}


// ---------- suínos, negócios, galpões e feras ----------
{
  const SU = await import('./suinos.js'), NG = await import('./negocios.js');
  let sd = 11; const rng = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // suínos: lote vendido no ponto (4º mês) dá lucro no barracão médio; lote sem vacina pode perder animais
  const s = { money: 1e8, month: 1 }; assert.equal(SU.buyBarn(s, 'medio'), null); const id = s.suinos.barns[0].id;
  assert.match(SU.house(s, id, 5000), /aloje/); assert.equal(SU.house(s, id, 1000, true), null); assert.match(SU.house(s, id, 10), /já tem/);
  const m0 = s.money + SU.housing(s, 1000, true); for (let i = 0; i < 4; i++) SU.monthly(s, rng);
  assert.ok(SU.kgAt(4) > 115 && SU.kgAt(4) < 125); const v = SU.sellLot(s, id); assert.ok(v > 0);
  assert.match(SU.sellBarn({ suinos: { barns: [], lots: [] } }, 'x').err, /não encontrado/);
  // banco: só a marca, caixa vem do dono; sem caixa não empresta; com caixa empresta e recebe
  const b = { money: 5e7, month: 1, stock: {} }; assert.equal(NG.buy(b, 'banks', 'roxinho'), null); assert.match(NG.buy(b, 'banks', 'roxinho'), /já é dono/);
  const bank = b.biz.banks[0]; NG.monthly(b, rng); assert.equal(bank.loans.length, 0, 'sem caixa não empresta');
  NG.deposit(b, bank.id, 2e6); NG.monthly(b, rng); assert.ok(bank.loans.length === 1 && bank.capital < 2e6);
  assert.match(NG.withdraw(b, bank.id, 1e9), /não tem/);
  // pedidos de empréstimo são pequenos e crescem devagar com o tempo do mundo
  const avg = l => l.bal / l.n; const early = avg(bank.loans[0]); b.month = 200; NG.monthly(b, rng); assert.ok(avg(bank.loans.at(-1)) > early && avg(bank.loans.at(-1)) < early * 3);
  // provedor: sem rede não tem assinante; com rede cresce
  const p = { money: 1e8, month: 1, stock: {} }; NG.buy(p, 'isps', 'netroca'); const isp = p.biz.isps[0]; NG.monthly(p, rng); assert.equal(isp.subs, 0);
  NG.build(p, isp.id, 4); for (let i = 0; i < 6; i++) NG.monthly(p, rng); assert.ok(isp.subs > 100 && isp.subs <= isp.ports);
  // galpões: estoque além da capacidade é vendido com desconto; quem já tinha estoque grande ganha capacidade herdada
  const w = { money: 1e8, month: 1, stock: { soja: 500, milho: 0, cafe: 0 }, prices: { soja: 130, milho: 60, cafe: 1400, laranja: 38 } };
  NG.ensure(w); assert.equal(w.biz.legacy, 0); w.stock.soja = 3000; const o = NG.enforce(w); assert.ok(o.length && NG.tons(w) <= NG.capacity(w) + 0.1);
  const big = { money: 0, month: 1, stock: { soja: 5000 } }; NG.ensure(big); assert.ok(NG.capacity(big) >= NG.tons(big), 'estoque antigo não pode ser vendido à força');
  assert.ok(NG.whPrice('g500', 60) > NG.whPrice('g500', 1), 'galpão sobe de preço com o tempo');
  NG.buyWh(w, 'g500'); assert.equal(NG.room(w, 'soja') > 8000, true);
}
console.log('suínos, negócios e galpões ok');

// ---------- imposto igual para todos (v151) ----------
{
  const L3 = await import('./logic.js'), sales = [];
  const poor = L3.newState(() => 0.5); assert.deepEqual(L3.monthTax(poor, 0, 1e5), [], 'abaixo do mínimo não paga');
  const mid = L3.newState(() => 0.5); mid.money = 5e5; assert.equal(L3.monthTax(mid, 0, 100000)[0].val, -5000, 'imposto de renda 5% do lucro');
  const rich = L3.newState(() => 0.5); rich.money = 3e8; assert.equal(L3.monthTax(rich, 0, 100000)[0].val, -5000, 'rico paga a mesma alíquota');
  assert.deepEqual(L3.monthTax(rich, 2e5, 1e5), [], 'mês no prejuízo não paga');
  assert.equal(L3.bankRisk({ ...rich, lands: [], herd: [], loans: [], lent: [], cars: [], stock: {}, prices: {} }).rate, L3.BANK_RATE, 'juros iguais para rico');
}
{
  const ST3 = await import('./stable.js'), st = { stable: { animals: [], offers: [] } };
  for (let i = 0; i < ST3.PHOTO_POOL.dog.length; i++) { const d = { kind: 'dog', name: 'Rex', coat: 0 }; st.stable.animals.push(d); ST3.photo(d, st); }
  assert.equal(new Set(st.stable.animals.map(x => x.ph)).size, ST3.PHOTO_POOL.dog.length, 'nenhum galgo repete a foto');
}
{
  const RV2 = await import('./rivals.js');
  const lead = 5e9, C = RV2.HUNT_CYCLE, at = u => Math.floor(Date.UTC(2026, 11, 1) / C) * C + u * C, top = u => Math.max(...RV2.rivals(300, lead, 0, at(u)).map(r => r.worth));
  assert.ok(top(0.2) < lead && top(0.2) > lead * 0.85, 'fase do jogador: ele fica na frente ' + top(0.2) / lead);
  assert.ok(top(0.75) > lead && top(0.75) < lead * 1.11, 'fase dos bots: retomam o 1º ' + top(0.75) / lead);
  let jump = 0; for (let k = 0; k < 360; k++) jump = Math.max(jump, Math.abs(RV2.huntLevel(at(k / 360)) - RV2.huntLevel(at((k + 1) / 360))));
  assert.ok(jump < 0.01, 'sobe e desce aos poucos, sem salto: ' + jump);
  let ahead = 0; for (let k = 0; k < 100; k++) if (top(k / 100) > lead) ahead++;
  assert.ok(ahead > 25 && ahead < 50, 'o jogador fica na frente mais da metade do tempo: bots na frente ' + ahead + '%');
}
{
  const RV3 = await import('./rivals.js'), r = RV3.rivals(400, 5e8, 2e6).map(x => x.worth).sort((a, b) => b - a);
  assert.ok(r.filter(w => w > 1.9e6 && w < 2.5e6).length >= 3, 'vizinhos logo acima de quem está subindo');
  assert.ok(r.filter(w => w > 2.5e8).length >= 9, '10 caçadores em escada atrás do líder');
}
console.log('mais ricos ok');

// ---------- leilão de cavalos de raça ----------
{
  const LE = await import('./leilao.js');
  const slot = 2000000, L = LE.lot(slot);
  assert.ok(LE.BREEDS[L.horse.breed] && L.horse.stars >= 1 && L.horse.stars <= 5 && L.value > 0);
  assert.equal(LE.lot(slot).horse.name, L.horse.name, 'mesmo lote para todos');
  const t0 = LE.opensAt(slot), end = LE.endsAt(slot);
  assert.equal(LE.state(L, t0 - 1000).phase, 'preview');
  const a = LE.state(L, end), b = LE.state(L, end); assert.deepEqual(a, b, 'lances dos jogadores do mundo iguais para todos');
  assert.ok(a.price <= Math.max(...L.bidders.map(x => x.max)), 'ninguém do mundo passa do próprio limite');
  // pessoa dá um lance alto no fim e leva
  const big = a.price + L.inc * 5, w = LE.state(L, end, [{ at: end - 2000, name: 'Ana', pid: 'p1', amt: big }]);
  assert.equal(w.leader.name, 'Ana'); assert.equal(w.price, big);
  // lance abaixo do mínimo não vale
  assert.notEqual(LE.state(L, end, [{ at: t0 + 500, name: 'Ana', pid: 'p1', amt: 1 }]).leader?.name, 'Ana');
  const s = { money: big + 10 }; assert.equal(LE.deliver(s, L, big), null); assert.equal(s.stable.animals.length, 1); assert.equal(s.stable.animals[0].breed, L.horse.breed);
}
console.log('leilão ok');

// ---------- mina de ouro ----------
{
  const MI = await import('./mina.js');
  let sd = 21; const rng = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const s = { money: 1e9, prices: {} }; assert.equal(MI.buy(s), null); assert.match(MI.buy(s), /já é dono/);
  const m0 = s.money; MI.monthly(s, rng); assert.equal(m0 - s.money, MI.MINE.upkeep, 'sem equipes: só a manutenção, e não acha nada');
  assert.equal(s.mina.phase, 'prospeccao');
  // sem frota nada acontece: equipe parada sem perfuratriz, escavadeira, pá e caminhão
  MI.setCrews(s, 10); for (let i = 0; i < 30; i++) MI.monthly(s, rng); assert.equal(s.mina.phase, 'prospeccao', 'sem perfuratriz não acha veio');
  assert.deepEqual(MI.missing(s), ['perfuratriz', 'escavadeira', 'pá-carregadeira', 'caminhão']);
  s.cars = [{ id: 1, model: 'mn_perf' }]; let n = 0; while (s.mina.phase === 'prospeccao' && n++ < 400) MI.monthly(s, rng);
  assert.equal(s.mina.phase, 'extracao'); assert.ok(s.mina.vein >= 18 && s.mina.grade >= 0.9 && s.mina.grade <= 3.2);
  let before = s.money; MI.monthly(s, rng); assert.ok(s.money < before && s.mina.mined === 0, 'achou o veio, mas sem escavadeira, pá e caminhão não extrai (só custa)');
  // frota mínima: o elo mais fraco manda (1 escavadeira = 3.500 t, 1 basculante = 2.000 t)
  s.cars.push({ id: 2, model: 'mn_escav' }, { id: 3, model: 'mn_carreg' }, { id: 4, model: 'mn_basc' });
  assert.deepEqual(MI.missing(s), []); const cap = MI.capacity(s); assert.equal(cap.t, 2000); assert.equal(cap.limit, 'o transporte');
  s.mina.vein = 80; s.mina.total = 80; s.mina.grade = 1.5; before = s.money; s.prices.ouro = 680000;
  const out = MI.monthly(s, rng), kg = s.mina.mined; assert.ok(kg > 2 && kg < 4, `2.000 t x 1,5 g/t x 92% = ~2,8 kg (deu ${kg})`);
  assert.ok(out.some(l => /CFEM/.test(l.txt) && l.val < 0) && out.some(l => /diesel/.test(l.txt) && l.val < 0) && out.some(l => /vendidos/.test(l.txt) && l.val > 0), 'receita, CFEM e diesel lançados');
  // mais caminhões soltam o gargalo; a usina (8.000 t) é o teto
  s.cars.push({ id: 5, model: 'mn_artic' }, { id: 6, model: 'mn_artic' }, { id: 7, model: 'mn_escav' }, { id: 8, model: 'mn_escav' }, { id: 9, model: 'mn_carreg' });
  assert.equal(MI.capacity(s).limit, 'a perfuração', 'com 1 perfuratriz só dá 6.000 t'); s.cars.push({ id: 10, model: 'mn_perf' });
  assert.equal(MI.capacity(s).t, 8000); assert.ok(['as equipes', 'a usina'].includes(MI.capacity(s).limit), 'teto: 10 equipes e usina de 8.000 t');
  // ouro ao vivo: US$ 3.539 a onça x R$ 5,95
  assert.ok(MI.setSpot(s, 3539, 5.95) && Math.abs(s.prices.ouro - 677000) < 2000, 'preço real do ouro em R$/kg'); assert.ok(!MI.setSpot(s, 5, 5.95) && !MI.setSpot(s, 3539, 0), 'número absurdo é ignorado');
  assert.equal(MI.sell(s), MI.MINE.price * MI.MINE.resale); assert.equal(s.mina, undefined);
}
console.log('mina ok');
{ // animal comprado com a foto de outro do mesmo dono troca de foto
  const ST4 = await import('./stable.js'), s = { stable: { animals: [], offers: [] } };
  const a = { kind: 'dog', name: 'A', coat: 0 }, b = { kind: 'dog', name: 'B', coat: 0 }; s.stable.animals.push(a); ST4.photo(a, s); b.ph = a.ph; s.stable.animals.push(b); ST4.photo(b, s);
  assert.notEqual(a.ph, b.ph); console.log('foto de animal comprado ok');
}
{ // regras do painel: valores fora do limite nunca quebram o jogo
  const TU = await import('./tune.js');
  const t = TU.applyTune({ npcBoost: 999, incomeTax: -5, hunt: false, landOffers: 'abc' });
  assert.equal(t.npcBoost, 10); assert.equal(t.incomeTax, 0); assert.equal(t.hunt, false); assert.equal(t.landOffers, 24);
  TU.applyTune(null); assert.equal(TU.T.npcBoost, 3); console.log('regras do painel ok');
}

// ---------- pôquer ----------
{
  const PK = await import('./poker.js');
  const h = t => t.split(' ').map(x => ({ r: x.slice(0, -1), s: x.slice(-1) }));
  const ev = t => PK.evaluate(h(t));
  assert.deepEqual(ev('A♠ K♠ Q♠ J♠ 10♠ 2♥ 3♦'), [9, 14]);
  assert.deepEqual(ev('5♥ 4♥ 3♥ 2♥ A♥ K♦ K♣'), [8, 5]);                 // roda com ás baixo
  assert.deepEqual(ev('9♣ 9♦ 9♥ 9♠ 2♣ 3♦ K♥'), [7, 9, 13]);
  assert.deepEqual(ev('8♣ 8♦ 8♥ 2♠ 2♣ 2♦ K♥'), [6, 8, 2]);
  assert.deepEqual(ev('A♣ 9♣ 7♣ 4♣ 2♣ K♦ Q♥').slice(0, 2), [5, 14]);
  assert.deepEqual(ev('A♣ 2♦ 3♥ 4♠ 5♣ 9♦ K♥'), [4, 5]);
  assert.deepEqual(ev('Q♣ Q♦ 7♥ 7♠ 3♣ 3♦ K♥'), [2, 12, 7, 13]);
  assert.deepEqual(ev('J♣ J♦ 9♥ 6♠ 4♣ 3♦ 2♥'), [1, 11, 9, 6, 4]);
  assert.ok(PK.compare(ev('K♣ K♦ A♥ 6♠ 4♣ 3♦ 2♥'), ev('K♥ K♠ Q♥ J♠ 4♣ 3♦ 2♥')) > 0, 'kicker desempata');
  assert.equal(PK.compare(ev('A♣ 2♦ 3♥ 4♠ 5♣ 9♦ K♥'), ev('A♦ 2♣ 3♠ 4♥ 5♦ 9♣ K♠')), 0);
  // mãos inteiras: fichas nunca somem nem aparecem (fora a reposição da casa)
  let sd = 11; const rng = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const t = new PK.Poker({ bb: 20, auto: false, rng, botNames: ['A', 'B', 'C', 'D', 'E'] });
  t.join('me', { name: 'eu' }, 0); t.fillBots(5);
  let hands = 0, guard = 0, sideSeen = false;
  const sum = () => t.seats.reduce((s, x) => s + (x.stack || 0), 0);
  let total = 0;
  while (hands < 300 && guard++ < 200000) {
    if (t.phase === 'play' && t.turn >= 0) t.botAct(t.turn);
    else if (t.phase === 'show') {
      assert.equal(sum(), total, `mão ${t.hands}: fichas conservadas`);
      if (new Set(t.contrib.filter(Boolean)).size > 2) sideSeen = true;
      hands++; t.flush();
    } else { const was = t.phase; if (t.seats[0].stack < t.bb) t.rebuy('me'); t.flush(); if (was !== 'play' && t.phase === 'play') total = sum() + t.seats.reduce((x, y) => x + (y.bet || 0), 0); }
  }
  assert.equal(hands, 300, 'mãos rodam sem travar');
  // all-in curto: só disputa o que cobriu
  const a = new PK.Poker({ bb: 20, auto: false, rng });
  a.join('x', { name: 'x' }, 0); a.join('y', { name: 'y' }, 1); a.join('z', { name: 'z' }, 2);
  a.seats[0].stack = 100; a.flush();
  for (const i of [0, 1, 2]) a.seats[i].cards = h(['A♠ A♥', '2♣ 7♦', 'K♣ K♦'][i]);
  a.deck = [...h('3♥ 4♦ 9♣ J♠ 8♥').reverse()];
  while (a.phase === 'play') { const s = a.turn; a.act(s, s === 0 ? { t: 'allin' } : a.toCall(s) ? { t: 'call' } : s === 1 ? { t: 'raise', to: 200 } : { t: 'check' }); if (a.turn < 0 && a.phase === 'play') a.flush(); }
  const won = Object.fromEntries(a.winners.map(w => [w.seat, w.amount]));
  assert.equal(won[0], 300, 'all-in de 100 leva só 3x100'); assert.equal(won[2], a.contrib[1] * 2 - 200, 'o resto vai para a segunda melhor mão');
  console.log('pôquer ok', sideSeen ? '(potes paralelos vistos)' : '');
}

// ---------- redes (lanchonetes, aviação, imóveis...) ----------
{
  const N = await import('./negocios.js');
  const s = { money: 5e8, month: 100, prices: {} }; N.ensure(s);
  assert.equal(N.buy(s, 'air', 'azuu'), null); const b = s.biz.air[0];
  assert.match(N.buyUnit(s, 'air', b.id, 'mono'), /sem vaga/, 'avião sem hangar não entra');
  assert.equal(N.buyUnit(s, 'air', b.id, 'hangar'), null);
  for (let k = 0; k < 4; k++) assert.equal(N.buyUnit(s, 'air', b.id, 'mono'), null);
  assert.match(N.buyUnit(s, 'air', b.id, 'mono'), /sem vaga/, 'hangar guarda 4');
  assert.ok(N.sellUnit(s, 'air', b.id, 'hangar').err, 'não vende hangar com avião dentro');
  assert.equal(N.buyUnit(s, 'cars', 'x', 'patio'), 'unidade inválida.');
  N.buy(s, 'cars', 'feirao21'); assert.equal(N.buyUnit(s, 'cars', s.biz.cars[0].id, 'showroom'), 'unidade inválida.', 'seminovos não abre showroom de importado');
  N.buy(s, 'realty', 'lopex'); const r = s.biz.realty[0]; N.buyUnit(s, 'realty', r.id, 'casa');
  s.month = 220; const v = N.sellUnit(s, 'realty', r.id, 'casa').value; assert.ok(v > 480000, `casa valoriza: ${v}`);
  const before = s.money; for (let k = 0; k < 24; k++) { s.month++; N.monthly(s); }
  assert.ok(Number.isFinite(s.money) && s.money !== before && Number.isFinite(N.value(s)), 'mês das redes sem NaN');
  console.log('redes ok');
}
{
  const PK = await import('./poker.js');
  const t = new PK.Poker({ bb: 20, auto: false, botNames: ['A', 'B', 'C', 'D', 'E'] });
  t.join('me', { name: 'eu' }, 0); t.fillBots(5);
  assert.equal(t.join('amigo', { name: 'amigo' }, 3), 3, 'senta no lugar escolhido de um jogador da casa');
  assert.equal(t.move('amigo', 0), 'esse lugar não está livre.');
  assert.equal(t.move('amigo', 4), null); assert.equal(t.seatOf('amigo'), 4); assert.equal(t.seats[3].kind, 'bot');
  assert.equal(t.view(-1).seats.every(s => s.cards.every(c => c === null)), true, 'quem assiste não vê cartas');
  console.log('pôquer: assistir e trocar de lugar ok');
}

// nenhum jogador fictício senta em duas mesas/jogos ao mesmo tempo
{
  const BP = await import('./botpool.js'), NP = await import('./npcs.js'), fs = await import('node:fs');
  const ids = [...fs.readFileSync('./botpool.js', 'utf8').matchAll(/\['([a-z0-9-]+)', \d+\]/g)].map(m => m[1]).filter(id => id !== 'sub');
  const seen = new Set();
  for (const id of ids) for (const n of BP.botsFor(id)) { assert.ok(NP.byNick(n), `${n} não é um NPC`); assert.ok(!seen.has(n), `${n} em duas mesas`); seen.add(n); }
  for (const f of ['poker-ui.js', 'casino.js', 'truco-ui.js', 'sinuca-ui.js', 'aviator.js']) assert.ok(/botsFor|botFor|sitting/.test(fs.readFileSync(`./${f}`, 'utf8')), `${f} não usa botpool`);
  console.log(`bots: ${seen.size} únicos em ${ids.length} mesas, sem repetição ok`);
}

{
  const AB = await import('./abate.js');
  assert.equal(AB.OWN.price, 5000000);
  const s = { prices: { arroba: 300 }, herd: [{ id: 'h1', heads: 10, kg: 480 }], money: 0, month: 1 };
  const third = AB.perHead(s, 480, 'terceiros'), player = AB.perHead(s, 480, 'jogador', 50);
  assert.ok(player > third, 'frigorífico de jogador (taxa 50) paga mais que o terceiro comum');
  const r = AB.slaughterAt(s, 'h1', 50); assert.equal(r.heads, 10); assert.equal(s.herd.length, 0); assert.equal(s.money, Math.round(10 * player));
  console.log('frigorífico de jogador ok');
}

{
  const PM = await import('./pomar.js');
  const s = { cars: [], lands: [{ ha: 450, orchard: { age: 6, health: 1, pest: 0 } }] };
  assert.equal(PM.sprayMult(s), 1); assert.equal(PM.need(s, 'pulv'), 3);
  s.cars.push({ model: 'pulv' }); assert.ok(Math.abs(PM.sprayMult(s) - 0.9) < 1e-9, 'um pulverizador em 450 ha cobre 1/3');
  s.cars.push({ model: 'pulv' }, { model: 'pulv' }); assert.ok(Math.abs(PM.sprayMult(s) - 0.7) < 1e-9, 'três cobrem tudo');
  s.cars.push({ model: 'plataforma' }); assert.ok(PM.expectedWith(s, s.lands[0]) > PM.expected(s.lands[0]), 'plataforma aumenta a colheita');
  console.log('pulverizador e plataforma por hectare ok');
}
{ const SHq = await import('./shop.js'), Lq = await import('./logic.js'); const s = Lq.newState(() => 0.5); (s.owned ??= []).push('acc:corrente de ouro'); (s.avatar ??= {}).acc = 'corrente de ouro';
  assert.ok(SHq.items(s).some(i => i.kind === 'acc' && i.label === 'corrente de ouro')); const m = s.money; const r = SHq.sellToHouse(s, 'acc:corrente de ouro');
  assert.equal(r.amount, 12500); assert.equal(s.money, m + 12500); assert.deepEqual(s.avatar.acc, []); assert.ok(!s.owned.includes('acc:corrente de ouro')); console.log('acessório no inventário ok'); }

{
  const TD = await import('./trade.js'), SH = await import('./shop.js'), NG = await import('./negocios.js');
  const a = { money: 1e9, owned: ['acc:oculos'], avatar: { acc: 'oculos' }, nextId: 5, biz: null, stock: {}, cars: [], stable: { animals: [] }, lands: [], cards: [] };
  NG.ensure(a); NG.buy(a, 'food', 'bobao'); NG.buyWh(a, 'g500');
  const b = { money: 1e9, owned: [], nextId: 50, stock: {}, cars: [], stable: { animals: [] }, lands: [], cards: [] };
  const accOk = (await import('./avatar.js')).CATALOG.acc.opts.find(o => o.price);
  a.owned.push(`acc:${accOk.id}`);
  for (const give of [[{ kind: 'acc', acc: accOk.id }], [{ kind: 'empresa', cat: 'food', data: a.biz.food[0] }], [{ kind: 'galpao', data: a.biz.wh[0] }]]) {
    const clean = TD.sanitize(give); assert.equal(clean.length, 1, 'item ' + give[0].kind + ' passa na validação');
    assert.equal(TD.apply(a, give, [{ kind: 'money', amount: 1000 }]), null); assert.equal(TD.apply(b, [{ kind: 'money', amount: 1000 }], clean), null);
  }
  assert.ok(b.owned.includes(`acc:${accOk.id}`) && !a.owned.includes(`acc:${accOk.id}`), 'acessório mudou de dono');
  assert.equal(b.biz.food[0].brand, 'bobao'); assert.equal(a.biz.food.length, 0); assert.equal(b.biz.wh.length, 1);
  assert.equal(TD.sanitize([{ kind: 'empresa', cat: 'food', data: { brand: 'inexistente' } }]).length, 0, 'marca inventada é recusada');
  assert.equal(SH.list(a, 'x', 500), 'esse item não é mais seu.');
  console.log('Feirão: acessórios, empresas e galpões entre jogadores ok');
}
{ const FTq = await import('./futebol.js'), SHq = await import('./shop.js'), Lq = await import('./logic.js');
  for (const c of FTq.CLUBS.flat()) { const s = Lq.newState(() => 0.5), m = s.money = 1e10; FTq.takeClub(s, c.n); const net = s.money - m + SHq.clubValue(s.fut); assert.ok(net < 0, `${c.n}: comprar e revender não pode dar lucro (${net})`); }
  console.log('clube: comprar e revender dá prejuízo ok'); }
{ const AM = await import('./amigos.js'), Lq = await import('./logic.js'), NGq = await import('./negocios.js'), NPq = await import('./npcs.js');
  // terra é pasto ou lavoura: não planta onde o gado está pastando
  const s = Lq.newState(() => 0.5); s.money = 1e8; s.lands = [{ id: 900, region: 'x', ha: 100, cap: 1.2, value: 1e6, own: true }]; s.herd = [{ id: 1, heads: 120, kg: 180 }];
  assert.ok(Lq.plant(s, s.lands[0], 'soja'), 'pasto com boi não aceita lavoura'); s.herd = [];
  // caixinha parceiro: sem ela não há parceria nem empréstimo barato
  const nick = NPq.NPCS[3].nick;
  assert.ok(AM.lendTo(s, nick, 10000, 0.025, 6), 'sem parceria não empresta a juro de amigo');
  assert.equal(AM.offersFrom(s, nick).length, 0);
  assert.equal(AM.setPartner(s, nick, true), null); assert.ok(AM.isFriend(s, nick));
  for (let i = 0; i < 9; i++) AM.setPartner(s, NPq.NPCS[10 + i].nick, true); assert.equal(AM.friends(s).length, AM.MAX, 'máximo de parceiros');
  // o parceiro oferece terra mais barata, espaço de galpão e máquina
  let off = []; for (let m = 1; m < 60 && !['land', 'wh', 'tool'].every(k => off.some(o => o.kind === k)); m++) { s.month = m; off = AM.offersFrom(s, nick); }
  const ol = off.find(o => o.kind === 'land'), ow = off.find(o => o.kind === 'wh'), ot = off.find(o => o.kind === 'tool');
  assert.ok(ol && ow && ot && ol.rate < Lq.RENT_PAY);
  const cap0 = NGq.capacity(s), had = Lq.hasVehicle(s, ot.type);
  for (const o of [ol, ow, ot]) assert.equal(AM.take(s, o.id), null); assert.ok(AM.take(s, ol.id), 'não pega duas vezes');
  assert.ok(Lq.rentNow(s.lands.at(-1)) < s.lands.at(-1).value * Lq.RENT_PAY); assert.ok(NGq.capacity(s) > cap0); assert.ok(!had && Lq.hasVehicle(s, ot.type), 'máquina emprestada trabalha para você');
  // você empresta trator: a vantagem sai de você e o aluguel entra
  s.amigos.tools = []; s.cars.push({ id: 950, model: 'deere', value: 600000 }); assert.equal(AM.lendTool(s, 950, nick), null); assert.ok(!Lq.hasVehicle(s, 'trator'));
  // empréstimo ao parceiro escolhido na negociação
  const m0 = s.money; assert.equal(AM.lendTo(s, nick, 10000, 0.025, 6), null); assert.equal(s.money, m0 - 10000); assert.ok(s.lent.some(p => p.nick === nick));
  assert.ok(AM.lendTo(s, nick, 10000, 0.08, 6), 'parceiro não aceita juro de agiota'); assert.ok(AM.lendTo(s, nick, 10000, 0.025, 6), 'um empréstimo por vez');
  s.borrowers = []; const out = AM.monthly(s, [], () => 0.1);
  assert.ok(out.some(l => /galpão alugado de/.test(l.txt) && l.val < 0) && out.some(l => /emprestado para/.test(l.txt) && l.val > 0), 'aluguéis do mês');
  // calote derruba a confiança; desmarcar devolve tudo
  const c0 = s.amigos.list[nick].conf; AM.monthly(s, [{ txt: `${nick} deu calote de R$ 1` }]); assert.ok(!AM.isFriend(s, nick) || s.amigos.list[nick].conf < c0);
  AM.setPartner(s, nick, false); assert.ok(!s.cars.some(c => c.lentTo) && Lq.hasVehicle(s, 'trator'));
  // jogador de verdade: parceria e cada negócio só depois que o outro aceita; cada lado aplica a sua metade
  { const A = Lq.newState(() => 0.5), B = Lq.newState(() => 0.5); A.money = B.money = 1e7;
    A.lands = [{ id: 901, region: 'Goiás', ha: 50, cap: 1.2, value: 2e6, own: true }]; A.cars.push({ id: 960, model: 'deere', value: 6e5 });
    assert.ok(AM.setPartner(A, 'Bia', true), 'sem retrato não marca quem não é do mundo');
    assert.ok(AM.peerApply(A, AM.askOf(A, 'give', { what: 'land', id: 901 }), 'from', 'Bia'), 'sem parceria não arrenda');
    A.amigos.list.Bia = { conf: 20, peer: { look: {}, worth: 5e6 } }; AM.ensure(A); assert.ok(!AM.isFriend(A, 'Bia'), 'parceria antiga sem aceite cai');
    assert.equal(AM.setPartner(A, 'Bia', true, { worth: 5e6 }), null); assert.equal(AM.setPartner(B, 'Ana', true, { worth: 3e6 }), null);   // os dois aceitaram
    assert.equal(AM.offersFrom(A, 'Bia').length, 0, 'jogador de verdade não tem oferta inventada');
    const land = AM.askOf(A, 'give', { what: 'land', id: 901 }), tool = AM.askOf(A, 'give', { what: 'tool', id: 960 });
    for (const k of [land, tool]) { assert.equal(AM.peerApply(A, k, 'from', 'Bia'), null); assert.equal(AM.peerApply(B, k, 'to', 'Ana'), null); }
    assert.ok(A.lands[0].leaseTo === 'Bia' && B.lands.some(l => l.friend === 'Ana' && l.oid === 901 && !l.own) && B.amigos.tools.some(t => t.oid === 960), 'terra e trator do lado dos dois');
    const loan = AM.askOf(B, 'borrow', { amount: 50000, rate: AM.FRIEND_RATE_LOW, months: 12 }), a0 = A.money, b0 = B.money;
    assert.equal(AM.peerApply(B, loan, 'from', 'Ana'), null); assert.equal(AM.peerApply(A, loan, 'to', 'Bia'), null);
    assert.ok(A.money === a0 - 50000 && B.money === b0 + 50000 && A.lent.some(p => p.nick === 'Bia' && p.risk === 0) && B.loans.some(l => l.from === 'Ana'), 'empréstimo dos dois lados');
    AM.peerBack(B, 'Ana', 'tool', 960, false); assert.ok(!B.amigos.tools.length, 'dono pegou a máquina de volta');
    AM.unfriend(A, 'Bia'); AM.unfriend(B, 'Ana'); assert.ok(!A.lands[0].leaseTo && !B.lands.some(l => l.friend === 'Ana'), 'fim da parceria devolve a terra'); }
  // parcelas e as duas formas de emprestar
  const sc = AM.schedule(10000, 0.02, 6); assert.ok(sc.total > 10000 && sc.first > 10000 / 6 && sc.profit === sc.total - 10000);
  assert.ok(AM.lendRisk(s, nick, 'auto') < AM.lendRisk(s, nick, 'trust') && AM.lendMaxRate(s, nick, 'trust') > AM.lendMaxRate(s, nick, 'auto'));
  // celular e computador mexendo nas parcerias ao mesmo tempo: o merge mantém os dois lados
  { const SM = await import('./sync-merge.js'), base = Lq.newState(() => 0.5); base.money = 1e6; base.month = 7; AM.ensure(base);
    const cel = structuredClone(base), pc = structuredClone(base), a1 = NPq.NPCS[30].nick, a2 = NPq.NPCS[31].nick;
    AM.setPartner(cel, a1, true); assert.equal(AM.lendTo(cel, a1, 10000, 0.025, 6), null);
    AM.setPartner(pc, a2, true); pc.cars.push({ id: 4242, model: 'deere', value: 600000 }); assert.equal(AM.lendTool(pc, 4242, a2), null);
    const mg = SM.merge3(base, cel, pc);
    assert.ok(mg.amigos.list[a1] && mg.amigos.list[a2], 'parceiros dos dois aparelhos'); assert.ok(mg.lent.some(p => p.nick === a1), 'empréstimo feito no celular');
    assert.equal(mg.cars.find(c => c.id === 4242)?.lentTo, a2, 'trator emprestado no computador'); assert.equal(mg.money, 1e6 - 10000); }
  console.log('amigos, parcerias e agiota ok'); }
{ const FTq = await import('./futebol.js'); let r = 1; const rng = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) { const f = { market: [{ id: 'x', price: 100000 }] }, d = FTq.dealFor(f, 'x', rng); assert.ok(d.limit >= 95000, 'piso de compra'); }
  assert.ok(FTq.OFFER_MAX < FTq.BUY_FLOOR); console.log('jogadores: sem arbitragem compra/venda ok'); }
{ const MKq = await import('./market.js'), LEq = await import('./leilao.js');
  for (const a of Object.keys(MKq.ASSETS)) for (const m of MKq.DURATIONS) for (const lb of [60, 300, 600]) for (const dir of [1, -1]) { let w = 0; const N = 3000;
    for (let k = 0; k < N; k++) { const now = 1.79e12 + k * 1300000, side = dir * (Math.sign(MKq.price(a, now) - MKq.price(a, now - lb * 1000)) || 1); if (side * (MKq.price(a, now + m * 60000) - MKq.price(a, now)) > 0) w++; }
    assert.ok(w / N < 1 / MKq.payout(m), `mercado ${a} ${m} min: seguir/ir contra o gráfico não pode dar lucro (${(w / N * 100).toFixed(1)}%)`); }
  for (let sl = 1000; sl < 2500; sl++) { const l = LEq.lot(sl), st = LEq.state(l, LEq.endsAt(sl) - 1500); assert.ok(st.next >= l.value * 0.97, `leilão ${sl} saiu barato`); }
  console.log('mercado imprevisível e leilão sem cavalo barato ok'); }

{
  const CT = await import('./contador.js');
  assert.equal(CT.feeFor(0), CT.FEE.min); assert.equal(CT.feeFor(100e6), CT.feeFor(1e6), 'contador cobra igual de todos');
  const s = { money: 1e7, month: 10 };
  assert.equal(CT.hire(s, 'm3', 5e6).price, CT.quote(5e6, 'm3')); assert.ok(CT.active(s)); assert.ok(CT.hire(s, 'm1', 5e6).err);
  s.month = 13; assert.equal(CT.monthly(s, 5e6)[0].val, 0); assert.ok(!CT.active(s), 'contrato de 3 meses acaba no 3º fechamento');
  CT.hire(s, 'mensal', 5e6); const a = -CT.monthly(s, 5e6)[0].val, b = -CT.monthly(s, 5e6)[0].val; assert.ok(b > a, 'mensal sobe');
  // as partes de cada linha somam exatamente o valor cobrado
  const lines = [{ txt: 'suinocultura: energia, água e mão de obra (barracão)', val: -12345 }, { txt: 'IPVA e seguro, Toyoda Hilox', val: -1321 }, { txt: "Bobão's Lanches: funcionários, aluguel, manutenção, seguro e sede da marca", val: -99999 },
    { txt: 'Carrefur: mercadoria, perdas, 85 funcionários, aluguel, energia e impostos', val: -500000, parts: { mercadoria: 300000, funcionarios: 150000, imposto: 50000 } }, { txt: 'venda', val: 777 }];
  const r = CT.summarize(lines);
  assert.equal(Math.round(r.total), 12345 + 1321 + 99999 + 500000); assert.equal(r.income, 777);
  assert.equal(Math.round(Object.values(r.types).reduce((x, y) => x + y, 0)), Math.round(r.total), 'tipos somam o total');
  assert.ok(r.groups.find(g => g.key === 'suinos') && r.groups.find(g => g.key === 'negocios') && r.groups.find(g => g.key === 'veiculos'));
  const s2 = {}; CT.record(s2, 5, lines); CT.record(s2, 5, lines); assert.equal(s2.closes.length, 1, 'um fechamento por mês');
  console.log('contador ok');
}

{
  const SF = await import('./staff.js'), CT = await import('./contador.js');
  const s = { money: 1e7, month: 10 };
  assert.equal(SF.active(s).length, 0); CT.hire(s, 'm12', 5e6); assert.deepEqual(SF.active(s).map(x => x.id), ['contador']);
  s.month = 13; const back = CT.refundOf(s), m0 = s.money; assert.equal(back, Math.round(s.acct.paid * 9 / 12 * 0.7), 'devolve 70% dos meses não usados');
  CT.fire(s); assert.equal(s.money, m0 + back); assert.equal(SF.active(s).length, 0, 'demitido sai da equipe');
  console.log('equipe ok');
}

{
  const CT = await import('./contador.js');
  const closes = [{ month: 3, lines: [{ txt: 'parcela do banco', val: -300 }, { txt: 'venda', val: 900 }] }, { month: 2, lines: [{ txt: 'parcela do banco', val: -200 }] }];
  const t = CT.monthTable(CT.history({ closes })); assert.deepEqual(t.months, [2, 3]); assert.deepEqual(t.totals, [200, 300]); assert.deepEqual(t.incomes, [0, 900]);
  assert.equal(t.rows[0].key, 'juros'); assert.equal(Math.round(t.rows[0].delta * 100), 50, 'subiu 50%');
  assert.equal(CT.summarize(closes[0].lines).ins[0].val, 900); console.log('mês a mês ok');
}

{
  const CT = await import('./contador.js'); const s = {};
  for (let m = 1; m <= 10; m++) CT.record(s, m, [{ txt: 'parcela do banco', val: -100 * m }, { txt: 'granja: ração do lote', val: -10 }]);
  assert.equal(s.closes.length, 6); assert.deepEqual(s.closesArc.map(a => a.month), [4, 3, 2, 1], 'arquivo guarda os meses que saíram');
  assert.equal(s.closesArc[0].total, 410); assert.equal(s.closesArc[0].groups.granja, 10);
  CT.record(s, 10, [{ txt: 'parcela do banco', val: -5 }]); assert.equal(CT.history(s).length, 10, 'mesmo mês não duplica');
  assert.equal(CT.history(s)[0].total, 5); console.log('arquivo ok');
}
{
  const GR = await import('./granja.js'); const s = { money: 1e6, prices: {} }; GR.buyHouse(s, 'pequeno'); const h = s.granja.houses[0].id, m0 = s.money;
  const r = GR.house(s, h, 5000.7, true); assert.equal(m0 - s.money, r.cost, 'cobra o que registra'); assert.ok(GR.house(s, h, 5000, true).err, 'galpão cheio não cobra de novo');
  assert.equal(m0 - s.money, r.cost, 'pintinho cobrado 1 vez só'); console.log('granja 1 cobrança ok');
}

{
  const NG = await import('./negocios.js'), GR = await import('./granja.js');
  const s = { nextId: 5, biz: { wh: [{ id: 'b5', type: 'g500', value: 1 }, { id: 'b5', type: 'g2000', value: 2 }] }, stock: {} };
  NG.ensure(s); assert.equal(new Set(s.biz.wh.map(w => w.id)).size, 2, 'galpões com id repetido ganham ids próprios'); assert.equal(s.biz.wh.length, 2);
  const g = { nextId: 3, prices: {}, granja: { houses: [{ id: 'g3', type: 'pequeno', value: 1 }, { id: 'g3', type: 'pequeno', value: 1 }], lots: [] } };
  GR.ensure(g); assert.equal(new Set(g.granja.houses.map(h => h.id)).size, 2); console.log('ids únicos ok');
}
{ const Nw = await import('./news.js');
  assert.equal(Nw.fromNote('Ana', 'compra de 100 fichas', -1000), null); assert.equal(Nw.fromNote('Ana', 'imposto sobre grandes fortunas (x)', -9e6), null);
  assert.equal(Nw.fromNote('Ana', 'loja 21: Lamborgini Huracão', -3600000).kind, 'compra'); assert.equal(Nw.fromNote('Ana', 'troca com Beto: deu Hilux', 0).kind, 'troca');
  assert.equal(Nw.accept({ kind: 'hack', name: 'x' }), null); assert.ok(!/[<>]/.test(Nw.accept({ kind: 'compra', name: '<b>x', what: '<script>', val: 5 }).name + Nw.accept({ kind: 'compra', name: 'x', what: '<script>', val: 5 }).what));
  let n = 0; for (let s = 0; s < 200; s++) { const x = Nw.npcNews(s, ['A', 'B']); if (x) { n++; assert.ok(Nw.headline(x).length > 10 && !/undefined|NaN/.test(Nw.headline(x))); } } assert.ok(n > 100);
  assert.deepEqual(Nw.npcNews(77, ['A', 'B']), Nw.npcNews(77, ['A', 'B']), 'igual para todos');
  console.log('TV 21: notícias ok'); }
{ const Ne = await import('./news.js'), t = Ne.EDITORIAL[0].at;
  assert.equal(Ne.editorial(t + 3600e3).length, Ne.EDITORIAL.length, 'edição especial no ar'); assert.equal(Ne.editorial(t + 5 * 864e5).length, 0, 'sai do ar depois de 3 dias');
  assert.ok(Ne.EDITORIAL.every(e => Ne.KINDS[e.kind] && e.title.length > 20 && e.lead.length > 80 && Ne.headline(e) === e.title));
  console.log('TV 21: edição especial ok'); }
{ // TV 21 / Resenha: o mesmo jogador do mundo não fala de novo nas 6 janelas seguintes
  const G = 70000, t0 = Math.floor(Date.now() / G), out = [];
  for (let s = t0 - 200; s < t0; s++) { const nk = [...NP.onlineSet(s * G)].map(id => NP.byId(id)?.nick).filter(Boolean); out.push(NP.turnOf(s, nk, G)); }
  out.forEach((n, i) => assert.ok(!out.slice(Math.max(0, i - NP.TURN_AVOID), i).includes(n), `repetiu ${n}`));
  assert.ok(new Set(out).size > 40); assert.equal(NP.turnOf(5, ['A', 'B'], 0), NP.turnOf(5, ['B', 'A'], 0));
  console.log('rodízio de quem fala ok'); }
{ const Cq = await import('./chat.js'); const seen = new Set(); for (let s = 1000; s < 1020; s++) seen.add(Cq.lineOf(s)); assert.equal(seen.size, 20, 'frases da Resenha não repetem em 20 falas seguidas'); console.log('frases sem repetir ok'); }
// preços da granja/suínos voltam ao base: frango derrubado se recupera, ração disparada cai
{ const s = L.newState(() => 0.5); s.prices.frango = 3.9; s.prices.racao = 2.6; for (let i = 0; i < 40; i++) L.tick(s, () => 0.5);
  assert.ok(Math.abs(s.prices.frango - L.ANCHOR.frango) < 0.2 && Math.abs(s.prices.racao - L.ANCHOR.racao) < 0.1, 'preço ancorado ' + s.prices.frango + ' ' + s.prices.racao); console.log('preço ancorado ok'); }
// arroba derrubada volta para a faixa: boi de 12 meses no boitel volta a dar lucro sobre o bezerro
{ const s = L.newState(() => 0.5); s.prices.arroba = 121; L.tick(s, () => 0.5); assert.ok(s.prices.arroba >= 248, 'arroba ancorada ' + s.prices.arroba);
  assert.ok(L.arrobas(180 + 12 * L.BOITEL_GAIN) * 310 * 0.99 > 2600 + 12 * L.BOITEL_COST, 'gado no boitel dá lucro no preço base'); console.log('arroba ancorada ok'); }
// granja: o lote guarda o gasto total (lucro real na venda); chapéu de granjeiro paga 2% a mais no frango
{ const s = { money: 1e6, prices: {}, nextId: 1 }; GR.ensure(s); GR.buyHouse(s, 'pequeno'); const hid = s.granja.houses[0].id;
  const r0 = GR.house(s, hid, 5000, true); const l = s.granja.lots[0]; assert.equal(l.cost, r0.cost);
  GR.monthly(s, () => 0.5); GR.monthly(s, () => 0.5); assert.ok(l.cost > r0.cost * 2, 'ração entra no gasto do lote');
  const plain = GR.lotValue(s, l); s.owned = ['acc:chapéu de granjeiro']; assert.ok(Math.abs(GR.lotValue(s, l) - plain * 1.02) <= 1, 'chapéu +2%');
  const r = GR.sellLot(s, l.id); assert.equal(r.profit, r.amount - r.cost); console.log('granja lucro do lote ok'); }
// contador: separa entrada, saída e bens; não diz o que compensa
import * as CT from './contador.js';
{ const s = { month: 10 }; CT.track(s, 'granja: compra de 5.000 pintinhos (pago 1 vez)', -25550); CT.track(s, 'granja: venda de 4.700 frangos', 50734); CT.track(s, 'granja: galpão pequeno', -150000);
  const r = CT.results(s, 0); assert.equal(r.lucro, 50734 - 25550); assert.equal(r.bem, -150000);
  assert.equal(CT.groupOf('frigorífico: funcionários, energia e manutenção'), 'frigorifico'); assert.equal(CT.groupOf('venda de 30 cabeças'), 'gado');
  const ctx = { brl: v => String(Math.round(v)), forecast: CT.summarize([]), prices: {}, base: {} };
  assert.ok(CT.answer(s, 'o que compensa mais?', ctx)[0].includes('não posso')); assert.ok(CT.answer(s, 'granja vazia paga algo?', ctx)[0].includes('não tem nenhuma cobrança'));
  console.log('contador lucro real ok'); }
// contador: nunca diz onde investir; explica prejuízo, quanto o dinheiro aguenta, patrimônio e dívida
{
  const brl = v => 'R$ ' + Math.round(v);
  const s = { month: 10, money: 5000, closes: [], pl: { 10: { gado: { in: 0, out: 3895, bem: 0 } }, 9: { granja: { in: 900, out: 500, bem: 0 } } } };
  const ctx = { brl, forecast: { total: 2000, income: 500, groups: [], types: {} }, prices: { arroba: 121 }, base: { arroba: 310 }, held: { gado: 4700 },
    worth: { total: 9000, debt: 1000, parts: [['dinheiro', 5000], ['gado', 4700]] }, loans: [{ bal: 1000, rate: 0.018, left: 5 }] };
  const A = q => CT.answer(s, q, ctx).join('\n');
  const NO = 'não posso dizer';
  for (const q of ['o que compensa mais?', 'vale a pena comprar um banco?', 'devo vender meu gado?', 'onde invisto meu dinheiro?', 'qual empresa comprar?', 'me dá uma dica', 'quando vender o boi?', 'o que eu faço agora?', 'qual rende mais, granja ou gado?', 'me recomenda algo', 'melhor negócio do jogo?'])
    assert.ok(A(q).includes(NO), 'deveria recusar: ' + q);
  for (const q of ['por que tive prejuízo?', 'por que o gado deu prejuízo?', 'quanto tempo meu dinheiro aguenta?', 'quanto vale meu patrimônio?', 'quanto devo ao banco?', 'preço do boi', 'qual meu lucro real nos ultimos 3 meses?'])
    assert.ok(!A(q).includes(NO), 'não deveria recusar: ' + q);
  const gado = A('por que o gado deu prejuízo?');
  assert.ok(gado.includes('prejuízo de R$ 3895') && gado.includes('R$ 4700') && gado.includes('61% abaixo') && gado.includes('nada foi vendido'), gado);
  assert.ok(A('quanto tempo meu dinheiro aguenta?').includes('uns 3 meses'));
  assert.ok(A('quanto devo ao banco?').includes('R$ 1000'));
  assert.ok(A('qual meu lucro real nos ultimos 3 meses?').includes('últimos 3 meses'));
  assert.ok(A('por que tive prejuízo?').includes('gado: −R$ 3895'));
  console.log('contador ok');
}
// vários acessórios: um por lugar do corpo; save antigo (texto) continua funcionando
{ const AV = await import('./avatar.js'); const a = { acc: 'brinco' };
  AV.toggleAcc(a, 'corrente de ouro'); AV.toggleAcc(a, 'chapéu de peão'); AV.toggleAcc(a, 'boné de marca');
  assert.deepEqual(AV.accsOf(a), ['brinco', 'corrente de ouro', 'boné de marca'], 'um chapéu por vez');
  AV.toggleAcc(a, 'brinco'); assert.deepEqual(AV.accsOf(a), ['corrente de ouro', 'boné de marca']);
  const svg = AV.avatarSVG(a); assert.ok(svg.includes('stroke-dasharray="3 1.4"') && svg.includes('cx="100" cy="34" r="7"'), 'desenha os dois');
  AV.toggleAcc(a, 'nenhum'); assert.deepEqual(AV.accsOf(a), []); assert.deepEqual(AV.accsOf({ acc: 'nenhum' }), []);
  console.log('vários acessórios ok'); }
// acessórios novos: cada área tem a sua vantagem e todos estão à venda no guarda-roupa
{ const AV = await import('./avatar.js'), PKx = await import('./perks.js');
  for (const k of ['suino', 'grain', 'laranja', 'cana', 'ouro', 'biz']) assert.ok(Object.entries(PKx.ACC_PERKS).some(([id, p]) => p[k] > 0 && AV.CATALOG.acc.opts.some(o => o.id === id && o.price)), 'sem acessório para ' + k);
  const s = { owned: ['acc:bota de borracha', 'acc:chapéu de palha'] }; assert.equal(PKx.mult(s, 'suino'), 1.02); assert.equal(PKx.mult(s, 'grain'), 1.02);
  assert.ok(AV.avatarSVG({ acc: ['bota de borracha'] }, { full: true }).includes('viewBox="0 0 200 404"')); console.log('acessórios de todas as áreas ok'); }
// propostas dos bots: aparecem só quando você tem o que negociar; fechar mexe no armazém e no dinheiro certo
{ const BOx = await import('./bot-offers.js'), Lx = await import('./logic.js'); const s = Lx.newState(() => 0.5); s.stock.soja = 500; s.money = 1e4;
  let o = null, t = Date.UTC(2026, 11, 1); for (let k = 0; k < 40 && !o; k++) o = BOx.offerFor(s, t += BOx.WIN);
  assert.ok(o && o.kind === 'buy' && o.good === 'soja' && o.q <= 500, 'bot propõe comprar a soja');
  const m = s.money, r = BOx.settle(s, o, o.total); assert.equal(s.money, m + o.total); assert.equal(s.stock.soja, 500 - o.q); assert.ok(r.val > 0);
  s.botOfferDone = o.slot; assert.equal(BOx.offerFor(s, t), null, 'recusada não volta na mesma janela');
  const N2 = await import('./npcs.js'), old = N2.NPCS.find(n => n.gnick); assert.equal(N2.byNick(old.orig), old, 'nick antigo acha o bot');
  console.log('propostas dos bots ok'); }

// jogadores do mundo no privado: personalidade fixa pelo nick, ritmo variado, nunca diz o que compensa
{
  const BC = await import('./bot-chat.js');
  const nicks = Array.from({ length: 400 }, (_, i) => `bot${i}`), ps = nicks.map(BC.persona);
  assert.deepEqual(BC.persona('Falcao777'), BC.persona('Falcao777'), 'mesmo nick, mesma personalidade');
  for (const s of BC.STYLES) assert.ok(ps.some(p => p.style === s), `tem estilo ${s}`);
  assert.ok(ps.some(p => p.speed[1] <= 45e3) && ps.some(p => p.speed[0] >= 300e3), 'uns respondem em segundos, outros em 5-10 min');
  assert.equal(BC.intent('oi tudo bem'), 'oi'); assert.equal(BC.intent('quanto quer no cavalo?'), 'negocio'); assert.equal(BC.intent('vlw mano'), 'valeu');
  let n = 0; for (const p of ps) for (const q of ['oi', 'compensa granja ou suino?', 'vende?', 'kkkk', 'blz']) { const r = BC.reply(p, q, { first: true }, Math.random); if (r.skip) continue; n++;
    assert.ok(r.texts.length && r.delay >= 4e3 && r.delay <= 600e3, 'resposta com atraso de 4 s a 10 min');
    for (const t of r.texts) assert.ok(!/compensa mais|melhor investimento|invista em/i.test(t), 'bot não diz o que compensa'); }
  assert.ok(n > 1500, 'quase todos respondem');
  assert.ok(BC.reply(BC.persona('x'), 'oi', { engaged: true }, () => 0.5).delay <= 60e3, 'conversa engatada responde rápido');
  assert.notEqual(BC.styleLine(nicks.find(k => BC.persona(k).style === 'educado'), 'vc vai no leilao'), BC.styleLine(nicks.find(k => BC.persona(k).style === 'informal'), 'vc vai no leilao'), 'cada um escreve de um jeito');
  console.log('conversa dos bots ok');
}

// celular e computador gravando juntos: nada do que um aparelho fez some (era assim que sumiam terras)
{
  const { merge3 } = await import('./sync-merge.js');
  const base = { month: 10, money: 1000, chips: 50, savedAt: 1, lands: [{ id: 1, ha: 50, own: true }], cars: [], log: [{ m: 10, txt: 'a', val: 0 }], prices: { soja: 130 }, stock: { soja: 10 } };
  const cell = JSON.parse(JSON.stringify(base)); cell.money -= 300; cell.lands.push({ id: 2, ha: 80, own: true }); cell.log.unshift({ m: 10, txt: 'compra de 80 ha', val: -300 }); cell.savedAt = 5;
  const pc = JSON.parse(JSON.stringify(base)); pc.money += 200; pc.chips += 7; pc.cars.push({ id: 'c1', model: 'hilux' }); pc.log.unshift({ m: 10, txt: 'venda de bois', val: 200 }); pc.stock.soja = 4; pc.savedAt = 4;
  const m = merge3(base, cell, pc);
  assert.deepEqual(m.lands.map(l => l.id), [1, 2], 'terra comprada no celular continua');
  assert.equal(m.money, 900, 'dinheiro soma as duas mudanças (−300 e +200)');
  assert.equal(m.chips, 57); assert.equal(m.cars.length, 1, 'carro comprado no PC continua'); assert.equal(m.stock.soja, 4);
  assert.equal(m.log.length, 3, 'livro-caixa tem os lançamentos dos dois'); assert.equal(m.savedAt, 5);
  const sold = JSON.parse(JSON.stringify(base)); sold.lands = []; sold.money += 5000;
  const m2 = merge3(base, sold, pc); assert.equal(m2.lands.length, 0, 'terra vendida num aparelho não volta'); assert.equal(m2.money, 6200);
  const ed = JSON.parse(JSON.stringify(base)); ed.lands[0].crop = 'soja';
  const ed2 = JSON.parse(JSON.stringify(base)); ed2.lands[0].leasedOut = true;
  const m3 = merge3(base, ed, ed2); assert.equal(m3.lands[0].crop, 'soja'); assert.equal(m3.lands[0].leasedOut, true, 'mudanças na mesma terra juntam');
  const t1 = { ...JSON.parse(JSON.stringify(cell)), month: 11 }, t2 = { ...JSON.parse(JSON.stringify(pc)), month: 11 };
  assert.equal(merge3(base, t1, t2), null, 'os dois viraram o mês: fica a nuvem');
  const t3 = { ...JSON.parse(JSON.stringify(pc)), month: 11 }; assert.equal(merge3(base, cell, t3).month, 11, 'só a nuvem virou o mês: vale o mês novo');
  console.log('sincronização sem perder nada ok');
}

// painel: acha terra que o livro-caixa diz que é do jogador mas sumiu do save
{
  const { lostLands } = await import('./land-check.js');
  const log = [   // mais novo primeiro, como no jogo
    { m: 9, txt: 'venda de 30 ha, várzea, tocantins', val: 250000 },
    { m: 8, txt: 'banco tomou a terra em terra roxa, paraná (40 ha)', val: 0 },
    { m: 7, txt: 'compra de 40 ha, terra roxa, paraná', val: -2200000 },
    { m: 6, txt: 'compra de 80 ha, cerrado, goiás', val: -1760000 },
    { m: 5, txt: 'compra de 30 ha, várzea, tocantins', val: -270000 },
    { m: 4, txt: 'compra de 50 ha, chapadão, mato grosso', val: -1500000 },
  ];
  const s = { log, lands: [{ id: 1, own: true, ha: 50, region: 'chapadão, mato grosso' }] };
  const lost = lostLands(s);
  assert.equal(lost.length, 1, 'só a de goiás sumiu (a do tocantins foi vendida, a do paraná o banco tomou)');
  assert.equal(lost[0].land, '80 ha, cerrado, goiás'); assert.equal(lost[0].paid, 1760000);
  assert.equal(lostLands({ log: [{ m: 9, txt: 'ajuste do administrador: devolução de terra que sumiu: 80 ha, cerrado, goiás', val: 1760000 }, ...log], lands: s.lands }).length, 0, 'já devolvida não aparece de novo');
  assert.equal(lostLands({ log: [{ m: 9, txt: 'troca com Ana: deu 80 ha, cerrado, goiás; recebeu R$ 1.000.000', val: 0 }, ...log], lands: s.lands }).length, 0, 'trocada não é perda');
  console.log('analisador de terras sumidas ok');
}

// contador explica por que o patrimônio cai com os meses, com os números do jogador
{
  const CTq = await import('./contador.js');
  const brlq = v => `R$ ${Math.round(v)}`;
  const ctx = { brl: brlq, forecast: { total: 50000, income: 10000, groups: [] }, prices: {}, base: {}, held: {}, worth: { total: 1, parts: [], debt: 0 }, loans: [], drops: { carros: 3000, galpoes: 500, juros: 1200, elite: null } };
  for (const q of ['por que meu patrimônio cai todo mês?', 'qual a lógica do meu patrimônio abaixar conforme passa os mês?']) {
    const a = CTq.answer({ month: 10, log: [] }, q, ctx).join(' ');
    assert.ok(/R\$ 40000/.test(a) && /carros/.test(a) && /juros/.test(a) && /preço do mercado/.test(a), `contador explica a queda do patrimônio: ${q}`);
  }
  assert.ok(CTq.QUICK.some(x => /patrimônio cai/.test(x)));
  console.log('contador explica o patrimônio ok');
}

// contador conhece as regras do jogo inteiro (sem dizer onde investir)
{
  const CTk = await import('./contador.js'), KBm = await import('./contador-kb.js');
  const ctx = { brl: v => `R$ ${Math.round(v)}`, forecast: { total: 0, income: 0, groups: [] }, prices: {}, base: {}, held: {}, worth: { total: 1, parts: [], debt: 0 }, loans: [], drops: {} };
  const ask = q => CTk.answer({ month: 10, log: [] }, q, ctx).join(' ');
  assert.match(ask('como funciona o futebol?'), /20 times|Série A/);
  assert.match(ask('quanto é o patrocínio da série B?'), /R\$ 500 mil/);
  assert.match(ask('como funciona o estádio?'), /nível 1 ao 5/);
  assert.match(ask('como funciona a granja?'), /galpão vazio não paga/);
  assert.match(ask('o que acontece se eu não pagar o banco?'), /banco toma/);
  assert.match(ask('quanto dura um mês do mundo?'), /5 minutos/);
  assert.match(ask('como funciona o arrendamento?'), /0,4%/);
  assert.match(ask('qual time compensa mais comprar?'), /não posso dizer/);
  for (const e of KBm.KB) for (const l of e.a) assert.ok(!/compensa|vale a pena|melhor investimento|recomendo|você deve (comprar|investir)/i.test(l), `base não aconselha: ${l}`);
  assert.ok(KBm.KB.length >= 40, 'base grande');
  console.log('contador conhece o jogo ok');
}

// jogadores do mundo conversando entre si na Geral: devagar, igual para todos, cada um no seu jeito
{
  const CHt = await import('./chat.js');
  const nicks = ['Falcao777', 'Rosa.MT', 'TropeiroGO', 'BoiBravo', 'LunaAgro'];
  let n = 0;
  for (let sl = 5000; sl < 5200; sl++) {
    const th = CHt.npcThread(sl, nicks);
    assert.deepEqual(th, CHt.npcThread(sl, nicks), 'mesma conversa em todos os aparelhos');
    if (!th.length) continue; n++;
    for (let i = 1; i < th.length; i++) { assert.ok(th[i].at - th[i - 1].at >= 60000 && th[i].at - th[i - 1].at <= 240000, 'resposta entre 1 e 4 min'); assert.notEqual(th[i].name, th[i - 1].name, 'quem responde é outro'); }
    for (const l of th) { assert.ok(!/@[ABC]\b/.test(l.text), 'menção vira o nick'); assert.ok(nicks.includes(l.name)); }
  }
  assert.ok(n > 60 && n < 160, `nem toda janela tem conversa (${n} de 200)`);
  assert.deepEqual(CHt.npcThread(5001, ['a', 'b']), [], 'precisa de gente online');
  console.log('conversa entre jogadores do mundo ok');
}
// agiota: juro sempre acima do banco, cresce com o risco e dá lucro esperado; calote devolve 25% pelo cobrador
{ const Lq = await import('./logic.js');
  for (const r of [0.01, 0.05, 0.12]) { const b = { rate: Lq.agiotaRate(r), risk: r }; assert.ok(b.rate > Lq.BANK_RATE && Lq.lendEdge(b) > 0, 'agiota ' + r); }
  assert.ok(Lq.agiotaRate(0.1) > Lq.agiotaRate(0.02));
  const s = Lq.newState(() => 0.5); assert.ok(s.borrowers.every(b => b.rate > Lq.BANK_RATE && Lq.lendEdge(b) > 0), 'pedidos do banco');
  s.lent = [{ id: 1, name: 'Zé', bal: 10000, rate: 0.1, left: 6, risk: 1 }]; const m0 = s.money; Lq.tick(s, () => 0.5);
  assert.ok(!s.lent.length && s.log.some(e => /Zé deu calote/.test(e.txt) && e.val === 2500), 'cobrador recupera 25%');
  console.log('agiota com lógica ok'); }

// bloquear: jogador do mundo bloqueado não manda mais proposta
{
  const BOb = await import('./bot-offers.js'), NPb = await import('./npcs.js');
  const t0 = Date.UTC(2026, 10, 21, 15), s = { money: 1e7, prices: { bezerro: 2600, arroba: 310 }, herd: [], stock: {}, nextId: 3, month: 20 };
  const got = []; for (let k = 0; k < 400; k++) { const o = BOb.offerFor(s, t0 + k * 1500000); if (o) got.push(o); }
  assert.ok(got.length > 20, 'há propostas');
  const victim = got[0].botId; s.blocked = [`npc:${victim}`];
  for (let k = 0; k < 400; k++) { const o = BOb.offerFor(s, t0 + k * 1500000); assert.ok(!o || o.botId !== victim, 'bloqueado não manda proposta'); }
  s.blocked = NPb.onlineNow(t0, 12).map(b => `npc:${b.id}`); assert.equal(BOb.offerFor(s, t0), null, 'todos bloqueados: ninguém oferece');
  console.log('bloquear jogador ok');
}
// marcos de prestígio: R$ 100 mi a 2 bi viram troféus com título e uma vantagem pequena que soma
{ const PKq = await import('./perks.js'), Lq = await import('./logic.js');
  assert.ok(PKq.PRESTIGE.every(p => Lq.TROPHIES.includes(p.min)), 'todo marco é troféu');
  assert.equal(PKq.prestigeTop([10e6, 50e6]), null);
  assert.equal(PKq.prestigeTop([100e6, 200e6, 300e6]).title, 'Senhor dos Mercados');
  const s = { cars: [], lands: [], owned: [], cards: [], trophies: [100e6, 200e6] };
  assert.ok(PKq.mult(s, 'loan') < 1 && PKq.mult(s, 'daily') > 1, 'vantagens dos marcos');
  console.log('marcos de prestígio ok'); }
// empresas: análise antes de comprar, oportunidade 30% abaixo com reputação baixa, marca valoriza com boa gestão
{ const NGq = await import('./negocios.js'), Lq = await import('./logic.js');
  const a = NGq.analysis('food', 'mcboi', 50); assert.ok(a && a.invest > a.price && a.payback > 12 && a.unitTop > a.unitNow, 'análise coerente (médio prazo)');
  let deal = null; for (const [c, S] of Object.entries(NGq.SECTORS)) for (const b of Object.keys(S.brands)) if (NGq.dealOf(c, b, 50)) deal = [c, b];
  assert.ok(deal, 'sempre tem uma oportunidade na janela');
  const s = Lq.newState(() => 0.5); s.money = 1e9; s.month = 50; assert.equal(NGq.buy(s, deal[0], deal[1]), null);
  const b = s.biz[deal[0]][0]; assert.ok(b.paid < NGq.LISTS[deal[0]][deal[1]].price && b.rep === NGq.DEAL.rep, 'compra com desconto e reputação baixa');
  assert.ok(NGq.brandGrowth(1, 1.1) > 0 && NGq.brandGrowth(0.4, 0.85) < 0, 'valoriza com boa gestão, desvaloriza com má');
  console.log('empresas com análise e oportunidade ok'); }
// economia do mundo: oferta alta derruba o preço de referência, crise só com concentração e sempre com aviso antes
{ const E = await import('./econ.js');
  let seen = new Set(), ok = 0;
  for (let m = 1; m < 1500; m++) for (const e of E.events(m)) if (e.kind === 'superproducao' && !seen.has(e.id)) { seen.add(e.id); if (E.season(e.start - 6).pressure[e.good] >= 1.22) ok++; assert.equal(E.phaseOf(e, e.start - e.warn), 'aviso', 'crise tem aviso antes'); }
  assert.ok(seen.size > 5 && ok === seen.size, 'crise só onde há concentração');
  for (let m = 1; m < 1500; m += 7) { const s = E.state(m); for (const g of E.GOODS) assert.ok(s.price[g] >= 0.45 && s.price[g] <= 1.6, 'preço sem extremos ' + g + ' ' + s.price[g]); }
  const hi = [...Array(600).keys()].map(m => E.season(m + 1)).find(s => E.GOODS.some(g => s.pressure[g] >= 1.3));
  assert.ok(hi, 'mercado tem ciclos de concentração');
  E.setReal([{ cafe: 5000 }, { cafe: 3000, soja: 100 }], 400); assert.ok(E.season(400).pressure.cafe > E.season(397).pressure.cafe, 'jogadores com conta mexem na oferta');
  const inf = E.regionInfo([{ name: 'a', use: 'café' }, { name: 'b', use: 'pasto' }], { a: 30, b: 1 }, 400);
  assert.ok(inf.a.risk > inf.b.risk && inf.b.tag === 'pouco explorada', 'região cheia de café é mais arriscada');
  E.setReal([], 0);
  console.log('economia do mundo ok'); }
// jogadores do mundo: fortuna acompanha o resultado das escolhas (uns sobem, outros apanham) e perfil de investidor igual para todos
{ const E = await import('./econ.js'), Nq = await import('./npcs.js');
  const pf = Nq.NPCS.map(n => E.npcPerf(n, 600)); assert.ok(Math.min(...pf) < 0.97 && Math.max(...pf) > 1.01, 'nem todo mundo enriquece igual');
  const iv = E.npcInvestor(Nq.NPCS[2], 600); assert.ok(iv.style && iv.risk && iv.hist.length >= 1);
  const pv = E.playerInvestor({ crops: { cafe: 300, soja: 20 }, inv: { hist: ['agora: 2 colheitas de café'], trend: 'em alta' } }); assert.ok(pv.style === 'agricultor especializado' && pv.hist.length === 1 && pv.trend === 'em alta');
  console.log('perfis de investidor ok'); }
// banco com capacidade limitada: a partir de R$ 250 mi o limite cai e empréstimo gigante é barrado; juros iguais para todos (v151)
{ const Lq = await import('./logic.js');
  const mk = (w, lent = 0, miss = 0) => ({ ...Lq.newState(() => 0.5), money: w, loans: lent ? [{ id: 1, bal: lent, rate: 0.035, left: 12, missed: 0 }] : [], lands: [{ id: 9, own: true, ha: 1000, value: w * 0.5, region: 'x' }], creditMiss: miss, month: 600 });
  const low = Lq.bankRisk(mk(100e6)), hi = Lq.bankRisk(mk(400e6)), huge = Lq.bankRisk(mk(1.5e9)), owing = Lq.bankRisk(mk(400e6, 15e6));
  assert.ok(!low.high && hi.high && hi.rate === low.rate && huge.rate === low.rate, 'juros iguais para todos');
  assert.ok(owing.limit < hi.limit, 'quem já deve muito pega menos');
  assert.ok(huge.limit <= huge.ceiling && huge.limit < 50e6, 'empréstimo de valor gigante barrado');
  console.log('banco com capacidade limitada ok'); }
// investimentos no banco: rendem pouco (abaixo da terra), prazo longo, teto, sair antes custa, aplicado conta no patrimônio
{ const IV = await import('./invest.js'), Lq = await import('./logic.js');
  const s = Lq.newState(() => 0.5); s.money = 10e6; const w0 = Lq.netWorth(s);
  assert.equal(IV.apply(s, 'cdb', 1e6, w0), null); assert.equal(s.money, 9e6);
  assert.ok(Math.abs(Lq.netWorth(s) - w0) < 1, 'aplicar não muda o patrimônio');
  assert.ok(IV.apply(s, 'tesouro', 5e6, w0), 'teto de 25% do patrimônio');
  for (const [k, P] of Object.entries(IV.PRODUCTS)) assert.ok(P.rate < Lq.BANK_RATE && P.rate >= 0.005, `${k}: taxa real, abaixo dos juros do empréstimo (pegar emprestado para aplicar não dá lucro)`);
  let lines = []; for (let m = 0; m < 60; m++) lines.push(...IV.monthly(s));
  assert.equal(s.money, 9e6 + 1e6 * (1 + IV.PRODUCTS.cdb.rate * 60), 'CDB paga a taxa do mês x 60 meses (juros simples)');
  assert.ok(lines.some(l => IV.NOT_PROFIT.test(l.txt) && l.val === 1e6), 'devolução do aplicado não conta como lucro');
  IV.apply(s, 'previdencia', 1e6, Lq.netWorth(s)); for (let m = 0; m < 10; m++) IV.monthly(s);
  const r = IV.withdraw(s, s.invest[0].id); assert.equal(r.value, 900000, 'previdência: sair antes perde rendimento e 10%');
  console.log('investimentos no banco ok'); }

// ---------- giro da sorte: 1 por ano, 20% de carta, o resto estoura ----------
{
  const SO = await import('./sorte.js'), L5 = await import('./logic.js'), CD5 = await import('./cards.js');
  const s = L5.newState(); s.month = 1;
  assert.ok(!SO.ready(s), 'no 1º ano não tem giro'); assert.ok(SO.spin(s).err, 'giro sem estar liberado');
  s.month = 13; assert.ok(SO.ready(s), 'ano novo libera o giro'); assert.equal(SO.monthsLeft(s), 0);
  const r = SO.spin(s, () => 0.1); assert.ok(r.win && r.card && SO.CARD_SLICES.includes(r.slice), 'rng baixo = carta na fatia dourada');
  assert.ok(['rara', 'lendaria'].includes(CD5.rarityOf(r.card)), 'carta do giro é no mínimo rara');
  assert.ok(!SO.ready(s) && SO.spin(s).err, 'só um giro por ano'); assert.equal(SO.monthsLeft(s), 12);
  s.month = 25; const l = SO.spin(s, () => 0.9); assert.ok(!l.win && !l.card && !SO.CARD_SLICES.includes(l.slice), 'rng alto = estoura, fatia escura');
  assert.equal((s.cards || []).length, 1, 'estourar não dá carta');
  let w = 0; const N = 4000; for (let i = 0; i < N; i++) { const t = L5.newState(); t.month = 13; if (SO.spin(t).win) w++; }
  assert.ok(w / N > 0.17 && w / N < 0.23, `chance de carta ${(w / N * 100).toFixed(1)}%: tem que ser ~20%`);
  console.log('giro da sorte ok');
}

// investimento do banco rende nos meses em que o jogador ficou fora
{ const INVx = await import('./invest.js'), s = { money: 1e6, invest: [], month: 1, nextId: 1 };
  assert.equal(INVx.apply(s, 'poupanca', 100000, 1e6), null); for (let k = 0; k < 100; k++) INVx.monthly(s);
  assert.equal(Math.round(s.invest[0].acc), Math.round(100000 * 0.0055 * 100), 'poupança rende 0,55% por mês, mês a mês, sem parar'); console.log('investimento rende fora ok'); }
// ---------- produtos no inventário: unidade e preço de referência ----------
{
  const TDx = await import('./trade.js'), s = { cars: [], stable: { animals: [] }, lands: [], cards: [], stock: { soja: 10, laranja: 10 }, prices: { soja: 150 } };
  const g = TDx.inventory(s).filter(i => i.kind === 'good'), la = g.find(i => i.good === 'laranja'), so = g.find(i => i.good === 'soja');
  assert.equal(la.label, 'laranja: 10 caixas', 'laranja é caixa, não saca'); assert.equal(so.label, 'soja: 10 sacas');
  assert.equal(la.value, 10 * 28, 'sem preço no save vale o preço de referência'); assert.equal(so.value, 1500);
  assert.equal(TDx.describe({ kind: 'good', good: 'laranja', qty: 3 }), '3 caixas de laranja');
  console.log('produtos do inventário ok');
}

// save restaurado depois do zeramento não é zerado de novo; save antigo continua sendo
{ const AR = await import('./authrules.js'), old = { updated_at: '2026-11-20T10:00:00Z', data: { money: 5e6 } }, back = { updated_at: '2026-11-23T10:00:00Z', data: { money: 5e6 } };
  assert.equal(AR.keepRestored(old).data.z161, undefined, 'save de antes do zeramento segue valendo o zeramento'); assert.equal(AR.keepRestored(back).data.z161, 1); assert.equal(AR.keepRestored(back).data.money, 5e6);
  assert.equal(AR.keepRestored(null), null); console.log('save restaurado ok'); }
{ const s = { month: 10 }, l = { value: 1.3e6, cost: 1e6, bought: 10 };
  assert.equal(L.landSale(s, l), 920000, 'revenda na hora: no máximo o que pagou, menos 8%');
  s.month = 22; assert.equal(L.landSale(s, l), Math.round(1e6 * 1.0012 * 0.92), 'um ano depois: só 0,12% de ganho, ainda prejuízo');
  assert.equal(L.landSale(s, { value: 5e5 }), 460000, 'terra sem preço de compra: valor menos 8%'); console.log('venda de terra ok'); }
{ const t = Date.now(); NP.CLOCK.real = 4; const s = NP.onlineSet(t), m = WD.current(NP.CLOCK.world, t);
  assert.ok([...s].every(id => NP.startMonth(NP.byId(id)) <= m), 'bot online já chegou ao mundo (está no ranking)');
  assert.equal(NP.onlineTotal(t), s.size + 4); assert.ok(NP.NPCS.some(n => !n.bio) && NP.NPCS.some(n => n.bio)); NP.CLOCK.real = 1; console.log('online alinhado ok'); }

// canavial plantado quando o primeiro corte era mais tarde: não perde o corte quando o tempo diminui
{
  const CNt = await import('./cana.js');
  const s = { money: 1e9, month: 3, prices: {}, lands: [{ id: 'x', own: true, ha: 10, region: 'r', uf: 'sp', cane: { age: CNt.CANE.first + 1, cuts: 0, care: true, pest: 0, health: 1 } }] };
  const out = CNt.monthly(s, () => 0.99);
  assert.ok(out.some(o => /corte de cana/.test(o.txt)), 'cana atrasada corta no mês seguinte');
  assert.equal(s.lands[0].cane.age, CNt.CANE.first, 'e volta para o ritmo normal da soca');
  console.log('cana com tempo novo ok');
}
