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
