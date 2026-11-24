// node test-vigia.mjs — vigilância do painel: o rápido demais aparece no topo, o normal não
import assert from 'node:assert/strict';
import { watch } from './admin-econ.js';
const play = h => ({ ms: h * 36e5, days: {} }), P = (id, money, h, extra = {}) => ({ id, name: id, s: { money, play: h == null ? undefined : play(h) }, ...extra });
const { rows, fair } = watch([P('a', 110000, 10), P('b', 210000, 20), P('c', 60000, 5), P('rapido', 5e6, 1), P('pix', 900000, 30, { pixIn: [{ amount: 800000 }] })]);
assert.ok(fair > 0, 'ritmo justo calculado');
assert.equal(rows[0].name, 'rapido', 'quem ficou rico em 1 h vai para o topo');
assert.ok(rows[0].excess > 4e6, 'excesso sugerido: ' + rows[0].excess);
assert.ok(rows.find(r => r.name === 'pix').why.some(w => /Pix/.test(w)), 'Pix grande aparece');
assert.equal(rows.find(r => r.name === 'a').score, 0, 'jogador normal não é suspeito');
console.log('vigilância ok');
{ const { diaryReport, pattern } = await import('./admin-econ.js'), at = i => new Date(Date.UTC(2026, 10, 23, 12, i)).toISOString();
  assert.equal(pattern('venda de 500 bois por R$ 1.200,50'), 'venda de # bois por R$ #');
  const R = diaryReport([
    { user_id: 'a', at: at(0), kind: 'inicio', txt: 'abriu o jogo', val: 0, money: 1000, worth: 1000 },
    { user_id: 'a', at: at(1), kind: 'log', txt: 'venda de 10 bois', val: 50000, money: 51000, worth: 51000, acts: 'sell-herd' },
    { user_id: 'a', at: at(2), kind: 'gap', txt: 'sem lançamento', val: 900000, money: 951000, worth: 951000, acts: 'rl-spin x3, fe-sell:abc', tab: 'cassino' },
    { user_id: 'a', at: at(30), kind: 'inicio', txt: 'abriu o jogo', val: 0, money: 2e6, worth: 2e6 },
    { user_id: 'b', at: at(5), kind: 'fichas', txt: 'fichas +100', val: 100000, acts: 'av-press x9' },
  ], { a: 'Ana' });
  assert.equal(R.players[0].name, 'Ana'); assert.equal(R.players[0].gap, 900000);
  assert.deepEqual(R.gapBy.map(g => g.act).sort(), ['fe-sell', 'rl-spin', 'tela: cassino']);
  assert.equal(R.chipBy[0].act, 'av-press'); assert.equal(R.sources[0].k, 'venda de # bois');
  assert.equal(R.jumps[0].diff, 2e6 - 951000, 'dinheiro que mudou entre uma sessão e outra');
  console.log('diário ok'); }
// fazenda de contas: 3 contas novas mandam R$ 10 mil para a mesma pessoa
{ const { pixFarm, watch: W2 } = await import('./admin-econ.js'), t = i => new Date(Date.UTC(2026, 10, 23, 12, i)).toISOString(), day = Date.UTC(2026, 10, 23, 10);
  const users = { b: { name: 'Basso', created: new Date(day - 10 * 864e5).toISOString() }, a1: { name: 'alt1', created: new Date(day).toISOString() }, a2: { name: 'alt2', created: new Date(day).toISOString() }, a3: { name: 'alt3', created: new Date(day).toISOString() }, v: { name: 'Velho', created: new Date(day - 30 * 864e5).toISOString() } };
  const pix = [1, 2, 3].map(i => ({ from_id: `a${i}`, from_name: `alt${i}`, to_id: 'b', to_name: 'Basso', amount: 10000, at: t(i) })).concat([{ from_id: 'v', from_name: 'Velho', to_id: 'a1', to_name: 'alt1', amount: 300, at: t(9) }]);
  const F = pixFarm(pix, users);
  assert.equal(F.length, 1, 'só o Basso aparece'); assert.equal(F[0].name, 'Basso'); assert.equal(F[0].senders.length, 3); assert.equal(F[0].total, 30000); assert.ok(F[0].sure);
  assert.ok(F[0].senders.every(x => x.ageDays < 1), 'contas criadas no mesmo dia');
  const { rows } = W2([{ id: 'b', name: 'Basso', s: { money: 40000 }, farm: F[0] }, { id: 'a1', name: 'alt1', s: { money: 0 }, farmSender: { total: 10000, to: 'Basso' } }, { id: 'g', name: 'Furo', s: { money: 900000 }, gap: 800000, gapN: 4 }]);
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.ok(by.b.score >= 6 && /3 contas novas/.test(by.b.why[0]), by.b.why.join(' | '));
  assert.ok(by.a1.score >= 4 && /criada só para isso/.test(by.a1.why.join(' ')));
  assert.ok(by.g.score >= 5 && /sem nenhum lançamento/.test(by.g.why.join(' ')));
  console.log('fazenda de contas ok'); }
