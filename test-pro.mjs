// node test-pro.mjs — regras puras da Central de Profissionais (o SQL é testado à parte, num Postgres)
import assert from 'node:assert/strict';
import * as PR from './pro.js';
const now = Date.UTC(2026, 10, 24), P = x => ({ stars: 4, rating_n: 0, rating_sum: 0, done: 0, delivered: 0, late: 0, earned: 0, strikes60: 0, verified: false, created_at: new Date(now - 60 * 864e5).toISOString(), ...x });
assert.deepEqual(PR.seals(P({ stars: 4.8, rating_n: 6, done: 25, delivered: 40, late: 1, verified: true }), now).map(s => s.k), ['ver', 'top', 'pont', 'vet']);
assert.deepEqual(PR.seals(P({ strikes60: 2, suspended_until: new Date(now + 864e5).toISOString() }), now).map(s => s.k), ['susp'], 'suspenso não mostra "em observação"');
assert.equal(PR.trophies(P({ done: 12, earned: 2e6 })).filter(t => t.got).map(t => t.k).join(), 'c1,c10,e1');
assert.ok(PR.score(P({ stars: 4.5, done: 20 }), now) > PR.score(P({ stars: 5, done: 0 }), now), 'trabalho feito pesa');
assert.ok(PR.score(P({ stars: 5, done: 50, suspended_until: new Date(now + 1e6).toISOString() }), now) < 0, 'suspenso vai para o fim');
const c = { period: 'semana', periods: 4, started_at: new Date(now - 9 * 864e5).toISOString(), paid: 4000, released: 1000, refunded: 0, service: {} };
const g = PR.progress(c, now); assert.equal(g.idx, 1); assert.equal(g.held, 3000); assert.equal(g.periodEnds, Date.parse(c.started_at) + 14 * 864e5);
assert.equal(PR.lenDays({ period: 'unico', service: { days: 3 } }), 3);
assert.equal(PR.starsTxt(3.5), '★★★⯪☆');
console.log('central de profissionais ok');
