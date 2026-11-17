// Tela da central de entregas: mapa com pedidos, moto com até 3 entregas, confirmação na hora certa.
import * as JB from './jobs.js';
import { G, $, esc, brl, int, say, save, note, award, confetti } from './store.js';
import * as Live from './live.js';
import * as sfx from './sfx.js';

let s = null, raf = 0, last = 0, acc = 0, hinted = false;
const job = () => (G.S.job ??= { level: 1, xp: 0, shifts: 0, best: 0, total: 0 });

export function render() {
  const j = job();
  $('#job-level').textContent = j.level;
  $('#job-xp').style.transform = `scaleX(${Math.min(1, j.xp / JB.xpToNext(j.level))})`;
  $('#job-xp-txt').textContent = `${j.xp} de ${JB.xpToNext(j.level)} turnos bons para o próximo nível`;
  $('#job-stats').textContent = `${j.shifts} turnos, melhor turno ${brl(j.best)}, total ganho ${brl(j.total)}. Pagamento ${Math.round(JB.levelMult(j.level) * 100)}% da tabela${Live.CFG.job_mult > 1 ? `, evento x${Live.CFG.job_mult}` : ''}.`;
  if (!s) $('#job-board').innerHTML = '';
}

export function running() { return !!s && !s.over; }

export function start() {
  if (running()) return;
  s = JB.newShift(job().level);
  $('#job-start').disabled = true; $('#job-result').hidden = true; $('#job-live').hidden = false;
  last = performance.now(); acc = 0;
  cancelAnimationFrame(raf);
  const loop = now => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    const before = { o: s.orders.length, ready: s.route.filter(r => r.arrived).length };
    JB.step(s, dt);
    if (s.orders.length > before.o) sfx.play('chip', 0.35);
    if (s.route.filter(r => r.arrived).length > before.ready) sfx.play('place', 0.6);
    acc += dt;
    if (acc >= 0.1) { acc = 0; draw(); }
    if (s.over) return finish();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function draw() {
  $('#job-clock').textContent = `${Math.ceil(JB.SHIFT - s.t)} s`;
  $('#job-earned').textContent = brl(s.earned);
  $('#job-weather').textContent = s.flat ? 'pneu furado' : s.rain ? 'chuva' : 'tempo bom';
  $('#job-map').classList.toggle('is-rain', s.rain);
  // pedidos no mapa (clique para aceitar) com o tempo que falta em volta do pino
  $('#job-pins').innerHTML = s.orders.map(o => {
    const left = Math.max(0, (o.until - s.t) / (o.vip ? 5 : JB.ACCEPT_WINDOW));
    return `<button class="pin${o.vip ? ' pin--vip' : ''}" style="left:${o.x}%;top:${o.y}%;--k:${left.toFixed(2)}" data-act="job-accept" data-id="${o.id}" aria-label="aceitar pedido de ${brl(o.pay)}">
      <span>${brl(o.pay)}</span></button>`;
  }).join('') + s.route.map(r => `<span class="moto-dest" style="left:${r.x}%;top:${r.y}%"></span>`).join('');
  $('#job-route').innerHTML = s.route.length ? s.route.map(r => r.arrived
    ? `<li class="rt is-ready"><span>${r.vip ? 'VIP, ' : ''}${brl(r.pay)}</span><button class="btn btn--gold" data-act="job-confirm" data-id="${r.id}">confirmar entrega</button>
        <span class="rt__bar rt__bar--urgent"><i style="transform:scaleX(${Math.max(0, 1 - (s.t - r.arrived) / JB.CONFIRM_WINDOW).toFixed(2)})"></i></span></li>`
    : `<li class="rt"><span>${r.vip ? 'VIP, ' : ''}${brl(r.pay)} a caminho</span><span class="rt__bar"><i style="transform:scaleX(${(1 - r.left / r.total).toFixed(2)})"></i></span></li>`).join('')
    : '<li class="muted small">Moto vazia. Clique nos pedidos do mapa para aceitar (até 3).</li>';
  $('#job-flat').hidden = !s.flat;
  if (s.flat) $('#job-flat-txt').textContent = `Conserte o pneu: ${s.flat.need - s.flat.clicks} toques`;
  $('#job-log').innerHTML = s.log.slice(-4).reverse().map(l => `<li>${esc(l.txt)}</li>`).join('');
}

export function accept(id) { if (!s) return; const err = JB.accept(s, Number(id)); if (err) say(err[0].toUpperCase() + err.slice(1), true); else sfx.play('slide', 0.4); draw(); }
export function confirmOne(id) {
  if (!s) return;
  const target = id ? Number(id) : s.route.find(r => r.arrived)?.id;
  const got = target ? JB.confirm(s, target) : 0;
  if (got) sfx.play('stack', 0.5);
  draw();
}
export function repair() { if (s && JB.repair(s)) sfx.play('place', 0.5); if (s) draw(); }

function finish() {
  cancelAnimationFrame(raf);
  const j = job(), mult = Live.CFG.job_mult || 1, pay = Math.round(s.earned * mult), g = JB.grade(s);
  G.S.money += pay;
  j.shifts++; j.total += pay; j.best = Math.max(j.best, pay);
  let up = false;
  if (g >= 0.6) { j.xp++; if (j.xp >= JB.xpToNext(j.level)) { j.xp = 0; j.level++; up = true; } }
  note(`turno de entregas: ${s.delivered} entregas`, pay);
  award('job');
  if (g >= 0.95 && s.delivered >= 8) award('jobPerfect');
  if (pay >= 4000) confetti(50);
  $('#job-live').hidden = true; $('#job-start').disabled = false;
  const r = $('#job-result'); r.hidden = false;
  r.innerHTML = `<h3>fim do turno</h3>
    <div class="tiles tiles--job">${[['ganho', brl(pay)], ['entregas', int(s.delivered)], ['gorjetas', brl(s.tips * mult)], ['perdidos', int(s.missed + s.failed)], ['aproveitamento', `${Math.round(g * 100)}%`]]
      .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('')}</div>
    <p class="${g >= 0.6 ? 'good' : 'muted'}">${up ? `Você subiu para entregador nível ${j.level}: os pedidos pagam mais.` : g >= 0.6 ? 'Turno bom: conta para subir de nível.' : 'Aproveitamento abaixo de 60%: este turno não conta para subir de nível.'}</p>`;
  s = null;
  save(); G.render(); render();
}

// quem perdeu quase tudo recebe a dica de trabalhar
export function hint() {
  if (hinted || running()) return;
  if (G.S.money < 3000 && G.S.chips < 50) { hinted = true; say('Sem dinheiro? A central de entregas paga na hora: aba "trabalho".'); }
}
