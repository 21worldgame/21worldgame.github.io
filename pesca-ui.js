// Tela do pesqueiro (aba pesca). As regras ficam em pesca.js.
// Precisa estar com a tela aberta: a espera só conta com a aba visível e, se sair no meio da briga, o peixe escapa.
import * as PE from './pesca.js';
import * as sfx from './sfx.js';
import { G, $, esc, brl, int, say, save, note, confetti, today } from './store.js';

// estado da pescaria na tela (não vai para o save: fechar a página no meio perde só a isca)
const T = { st: 'idle', spot: 'lagoa', bait: 'minhoca', fish: null, fight: null, wait: 0, nib: 0, bite: 0, land: null, miss: 0, msg: '', t: 0, splash: 0 };
const hold = { on: false };
const fmtKg = k => `${k.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- painéis (equipamento, caixa, lojinha): redesenhados a cada render do jogo ----------
export function render() {
  const el = $('#pe-side'); if (!el) return;
  const s = G.S, p = PE.ensure(s), now = Date.now();
  if (!p.rods.includes(p.rod)) p.rod = 0;
  $('#pe-spots').innerHTML = Object.entries(PE.SPOTS).map(([k, S]) => {
    const left = PE.ticketLeft(s, k, now), can = p.rods.some(i => i >= S.rod);
    return `<button class="pe-spot${T.spot === k ? ' is-on' : ''}" data-pe="spot" data-id="${k}" ${T.st !== 'idle' ? 'disabled' : ''}>
      <b>${S.label}</b><small>${S.fee ? (left ? `entrada paga · ${Math.ceil(left / 60000)} min` : `entrada ${brl(S.fee)} (30 min)`) : 'grátis'}</small>
      <small class="muted">${can ? esc(S.txt) : `precisa de ${PE.RODS[S.rod].label}`}</small></button>`;
  }).join('');
  const bk = PE.boxKg(s), cap = PE.COOLERS[p.cooler].cap, tot = PE.value(s);
  el.innerHTML = `<div class="glass pe-card"><h4>caixa térmica <small class="muted">${fmtKg(bk)} de ${cap} kg</small></h4>
      <span class="bar"><i style="transform:scaleX(${Math.min(1, bk / cap).toFixed(3)})"></i></span>
      ${p.box.length ? `<ul class="pe-box">${p.box.map((f, i) => `<li><span>${PE.SPECIES[f.sp].img} ${PE.SPECIES[f.sp].label}${f.trophy ? ' <b class="pe-trophy">troféu</b>' : ''}</span><span class="muted small">${fmtKg(f.kg)}${f.age ? ` · ${f.age} ${f.age === 1 ? 'mês' : 'meses'} no gelo` : ' · fresco'}</span><b class="good">${brl(PE.fishValue(s, f))}</b><button class="btn btn--glass btn--sm" data-pe="sell1" data-id="${i}">vender</button></li>`).join('')}</ul>
      <button class="btn btn--gold" data-pe="sellall">vender tudo na peixaria (${brl(tot)})</button>
      <p class="muted small">No gelo o peixe perde ${Math.round(PE.SPOIL * 100)}% do preço a cada mês do mundo e estraga no ${PE.SPOIL_MAX + 1}º mês.</p>`
      : '<p class="muted small">Vazia. O que você tirar da água vem para cá.</p>'}</div>
    <div class="glass pe-card"><h4>peixaria <small class="muted">preço por kg deste mês</small></h4><div class="pe-prices">${Object.entries(PE.SPECIES).map(([k, F]) => { const m = p.mkt[k] || 1; return `<span>${F.label}<b>R$ ${PE.priceKg(s, k).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small class="${m >= 1 ? 'good' : 'bad'}">${m >= 1 ? '▲' : '▼'}${Math.abs((m - 1) * 100).toFixed(0)}%</small></b></span>`; }).join('')}</div>
      <p class="muted small">Peixe com ${Math.round(PE.TROPHY * 100)}% do peso máximo da espécie é troféu: vai para restaurante e vale ${Math.round(PE.TROPHY_BONUS * 100)}% a mais.</p></div>
    <div class="glass pe-card"><h4>iscas <small class="muted">1 por lançamento</small></h4>${Object.entries(PE.BAITS).map(([k, B]) => `<div class="pe-row"><label><input type="radio" name="pe-bait" value="${k}" ${T.bait === k ? 'checked' : ''} ${T.st !== 'idle' ? 'disabled' : ''}> ${B.label} <b>${int(p.baits[k] || 0)}</b></label><button class="btn btn--glass btn--sm" data-pe="bait" data-id="${k}">+${B.pack} por ${brl(B.price)}</button></div>`).join('')}</div>
    <div class="glass pe-card"><h4>varas</h4>${PE.RODS.map((R, i) => `<div class="pe-row"><span>${R.label} <small class="muted">segura até ${R.maxKg} kg</small></span>${p.rod === i ? '<b class="good">em uso</b>' : `<button class="btn btn--${p.rods.includes(i) ? 'glass' : 'gold'} btn--sm" data-pe="rod" data-id="${i}" ${T.st !== 'idle' ? 'disabled' : ''}>${p.rods.includes(i) ? 'usar' : brl(R.price)}</button>`}</div>`).join('')}</div>
    <div class="glass pe-card"><h4>caixa térmica maior</h4>${PE.COOLERS.map((C, i) => `<div class="pe-row"><span>${C.label} <small class="muted">${C.cap} kg</small></span>${i <= p.cooler ? (i === p.cooler ? '<b class="good">sua</b>' : '<small class="muted">—</small>') : `<button class="btn btn--gold btn--sm" data-pe="cooler" data-id="${i}">${brl(C.price)}</button>`}</div>`).join('')}</div>
    <p class="muted small">Você já tirou ${int(p.n)} ${p.n === 1 ? 'peixe' : 'peixes'} (${fmtKg(p.kg)}) e vendeu ${brl(p.earned)}.${Object.keys(p.best).length ? ` Recordes: ${Object.entries(p.best).map(([k, v]) => `${PE.SPECIES[k].label} ${fmtKg(v)}`).join(', ')}.` : ''}</p>`;
  if (!$('#pe-acts').childElementCount) paintActs();
  start();
}

// ---------- botões da pescaria ----------
function paintActs() {
  const a = $('#pe-acts'); if (!a) return;
  const f = T.fish, S = PE.SPECIES[f?.sp] || {};
  a.innerHTML = {
    idle: `<button class="btn btn--gold btn--lg" data-pe="cast">lançar a linha</button>`,
    wait: `<button class="btn btn--gold btn--lg" data-pe="hook">fisgar!</button><button class="btn btn--glass" data-pe="quit">recolher</button>`,
    fight: `<button class="btn btn--gold btn--lg pe-hold" data-pe="hold" aria-pressed="false">segure para puxar</button>`,
    land: `<button class="btn btn--gold btn--lg" data-pe="net">tirar da água!</button>`,
    caught: `<button class="btn btn--gold btn--lg" data-pe="keep">pôr na caixa (${brl(PE.fishValue(G.S, { ...f, age: 0 }))})</button><button class="btn btn--glass" data-pe="free">soltar</button>`,
  }[T.st] || '';
  $('#pe-msg').innerHTML = T.msg;
  $('#pe-hud').hidden = T.st !== 'fight' && T.st !== 'land';
  $('#pe-net').hidden = T.st !== 'land';
  if (T.st === 'caught') $('#pe-msg').innerHTML = `<strong class="dw-win">${S.img} ${S.label} de ${fmtKg(f.kg)}!</strong>${f.trophy ? ' <b class="pe-trophy">peixe troféu</b>' : ''}`;
}
const setMsg = (m, st) => { T.msg = m; if (st) T.st = st; paintActs(); };

function doCast() {
  const s = G.S;
  const e = PE.enter(s, T.spot); if (e.err) return say(e.err[0].toUpperCase() + e.err.slice(1), true);
  if (e.cost) note(`pesca: entrada do ${PE.SPOTS[T.spot].label}`, -e.cost);
  const c = PE.cast(s, T.spot, T.bait); if (c.err) { if (e.cost) save(); return say(c.err[0].toUpperCase() + c.err.slice(1), true); }
  save();
  const tired = PE.fatigue(s, today());
  T.fish = PE.roll(T.spot, T.bait); T.wait = rnd(5, 20) * tired; T.nib = rnd(1.5, 4); T.bite = 0; T.miss = 0; T.splash = 1;
  sfx.play('chip', 0.3);
  setMsg(tired > 1 ? 'Linha na água. Você já pescou mais de 2 horas hoje: o peixe anda desconfiado e demora mais para beliscar.' : 'Linha na água. Espere a boia <b>afundar de vez</b>: beliscada pequena não é peixe.', 'wait');
  G.render();
}
function hook() {
  if (T.bite > 0) {
    T.fight = PE.newFight(T.fish, PE.ensure(G.S).rod); T.bite = 0; sfx.tick(1); navigator.vibrate?.(60);
    return setMsg('Fisgou! <b>Segure para puxar</b> e solte quando a linha ficar vermelha.', 'fight');
  }
  T.fish = null; sfx.play('chip', 0.2);
  setMsg('Puxou cedo demais: o peixe se assustou e levou a isca.', 'idle'); render();
}
function end(msg) { T.fish = null; T.fight = null; hold.on = false; setMsg(msg, 'idle'); render(); }
function startLand() { T.land = { x: 0, dir: 1, zone: 0.32 + Math.random() * 0.36, w: Math.max(0.1, 0.22 - PE.SPECIES[T.fish.sp].power * 0.08) }; setMsg('Peixe na beira! Aperte <b>tirar da água</b> com o puçá na faixa verde.', 'land'); }
function net() {
  const l = T.land; if (!l) return;
  if (Math.abs(l.x - l.zone) <= l.w / 2) { T.st = 'caught'; T.splash = 1; sfx.fanfare(); confetti(T.fish.trophy ? 160 : 40); paintActs(); render(); return; }
  T.miss++; sfx.play('chip', 0.2);
  if (T.miss >= 2) return end('O peixe bateu o rabo no puçá e voltou para a água. Escapou!');
  T.fight.dist = 30; T.fight.stam = Math.max(T.fight.stam, 2); setMsg('Errou o puçá! Ele voltou a brigar: puxe de novo.', 'fight');
}
function keepFish() {
  const s = G.S, f = T.fish, r = PE.keep(s, f);
  if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  save(); end(`${PE.SPECIES[f.sp].label} de ${fmtKg(f.kg)} na caixa térmica. Lance de novo!`);
}

// ---------- cena (canvas) ----------
const SKY = { lagoa: ['#8fc6d8', '#e9d9a8'], pesqueiro: ['#86b4d6', '#f0d7a0'], represa: ['#6f9cc9', '#e2c08c'] };
const WATER = { lagoa: ['#3f8a7a', '#245a52'], pesqueiro: ['#3a7fa0', '#1f4d6b'], represa: ['#2c5f8f', '#142f52'] };
let raf = 0, last = 0;
function draw(cv, dt) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, hz = H * 0.32, t = (T.t += dt);
  const g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, SKY[T.spot][0]); g.addColorStop(1, SKY[T.spot][1]); x.fillStyle = g; x.fillRect(0, 0, W, hz);
  x.fillStyle = '#4c7a4a'; x.beginPath(); x.moveTo(0, hz); for (let i = 0; i <= 8; i++) x.lineTo(i * W / 8, hz - 18 - 14 * Math.sin(i * 1.7 + (T.spot === 'represa' ? 2 : 0))); x.lineTo(W, hz); x.fill();
  const w = x.createLinearGradient(0, hz, 0, H); w.addColorStop(0, WATER[T.spot][0]); w.addColorStop(1, WATER[T.spot][1]); x.fillStyle = w; x.fillRect(0, hz, W, H - hz);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2;
  for (let r = 0; r < 7; r++) { const yy = hz + 20 + r * (H - hz) / 7; x.beginPath(); for (let i = 0; i <= W; i += 16) x.lineTo(i, yy + Math.sin(i / 40 + t * 1.6 + r) * 3); x.stroke(); }
  // barranco e a vara
  x.fillStyle = '#6b4b2a'; x.beginPath(); x.moveTo(0, H); x.lineTo(0, H * 0.82); x.quadraticCurveTo(W * 0.18, H * 0.86, W * 0.3, H); x.fill();
  const f = T.fight, bend = T.st === 'fight' ? Math.min(1, (f?.tension || 0) / 100) : 0;
  const base = [W * 0.08, H * 0.98], tip = [W * 0.3 + bend * W * 0.04, H * 0.42 + bend * H * 0.2];
  x.strokeStyle = '#3a2614'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(...base); x.quadraticCurveTo(W * 0.16, H * 0.6, ...tip); x.stroke();
  if (T.st === 'idle' && !T.fish) return;
  // onde está a boia / o peixe
  const d = T.st === 'wait' ? 75 : T.st === 'caught' ? 0 : (f?.dist ?? 0);
  let fx = W * 0.36 + (W * 0.56) * (d / 100), fy = hz + (H - hz) * (0.25 + 0.45 * (1 - d / 100));
  if (T.st === 'fight') { fx += Math.sin(t * 9) * (f.run > 0 ? 10 : 4); fy += Math.cos(t * 7) * 3; }
  let sink = 0;
  if (T.st === 'wait') sink = T.bite > 0 ? 14 : T.nibOn > 0 ? 5 * Math.sin(T.nibOn * 20) : Math.sin(t * 2) * 1.5;
  const lift = T.st === 'caught' ? Math.min(1, T.splash < 1 ? 1 - T.splash : 1) : 0;
  const tension = f?.tension || 0;
  x.strokeStyle = tension > 80 ? '#ff5a4a' : tension > 60 ? '#ffc04a' : 'rgba(255,255,255,.8)'; x.lineWidth = tension > 80 ? 2.2 : 1.4;
  x.beginPath(); x.moveTo(...tip); x.quadraticCurveTo((tip[0] + fx) / 2, Math.max(tip[1], fy) + (T.st === 'wait' ? 40 : 6 - tension / 10), fx, fy + sink - lift * H * 0.35); x.stroke();
  if (T.st === 'wait') {   // boia
    x.fillStyle = '#e8432f'; x.beginPath(); x.ellipse(fx, fy + sink - 6, 6, 9, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.fillRect(fx - 6, fy + sink - 3, 12, 3);
  } else {   // peixe
    const sz = Math.min(64, 18 + Math.sqrt(T.fish.kg) * 9);
    x.font = `${sz}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.save(); x.translate(fx, fy - lift * H * 0.35); if (T.st !== 'caught') x.globalAlpha = 0.55 + 0.45 * (1 - d / 100); x.rotate(T.st === 'caught' ? Math.sin(t * 12) * 0.4 : Math.sin(t * 5) * 0.2); x.fillText(PE.SPECIES[T.fish.sp].img, 0, 0); x.restore();
  }
  if (T.splash > 0) { x.strokeStyle = `rgba(255,255,255,${T.splash})`; x.lineWidth = 2; for (let k = 1; k <= 3; k++) { x.beginPath(); x.ellipse(fx, fy + 4, (1.2 - T.splash) * 30 * k, (1.2 - T.splash) * 8 * k, 0, 0, Math.PI * 2); x.stroke(); } T.splash = Math.max(0, T.splash - dt * 0.9); }
  if (T.st === 'fight' && f.run > 0) { x.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 5; k++) x.fillRect(fx - 20 + Math.random() * 40, fy - 4 - Math.random() * 10, 3, 3); }
}
function loop(ts) {
  raf = 0;
  const cv = $('#pe-cv'); if (!cv || $('#p-pesca')?.hidden) return;
  const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * dpr * 0.5); }
  tickGame(dt); draw(cv, dt);
  raf = requestAnimationFrame(loop);
}
function tickGame(dt) {
  if (T.st !== 'idle' && T.st !== 'caught') PE.fished(G.S, today(), dt);   // tempo na beira conta para o cansaço (vai no save junto com a próxima pesca)
  if (T.st === 'wait') {
    T.nibOn = Math.max(0, (T.nibOn || 0) - dt);
    if (T.bite > 0) { T.bite -= dt; if (T.bite <= 0) { T.fish = null; setMsg('Demorou para fisgar: o peixe comeu a isca e foi embora.', 'idle'); render(); } return; }
    T.nib -= dt; if (T.nib <= 0) { T.nibOn = 0.5; T.nib = rnd(2, 5); sfx.tick(0.25); }
    T.wait -= dt; if (T.wait <= 0) { T.bite = 1.1; T.splash = 1; sfx.tick(0.9); navigator.vibrate?.(40); setMsg('<b>A boia afundou! FISGUE!</b>'); }
  } else if (T.st === 'fight') {
    const r = PE.step(T.fight, hold.on, dt);
    paintHud();
    if (r === 'snap') { sfx.boom(); navigator.vibrate?.([30, 30, 60]); return end(PE.RODS[PE.ensure(G.S).rod].maxKg < T.fish.kg ? `A linha arrebentou: era um peixe grande demais para a ${PE.RODS[PE.ensure(G.S).rod].label}.` : 'A linha arrebentou! Solte antes de ficar vermelho.'); }
    if (r === 'lost') return end('O peixe levou a linha toda e escapou.');
    if (r === 'land') startLand();
  } else if (T.st === 'land') {
    const l = T.land; l.x += l.dir * dt * (0.7 + PE.SPECIES[T.fish.sp].power * 0.6); if (l.x > 1 || l.x < 0) { l.dir *= -1; l.x = Math.min(1, Math.max(0, l.x)); }
    $('#pe-net').innerHTML = `<i class="pe-net__zone" style="left:${((l.zone - l.w / 2) * 100).toFixed(1)}%;width:${(l.w * 100).toFixed(1)}%"></i><i class="pe-net__mark" style="left:${(l.x * 100).toFixed(1)}%"></i>`;
  }
}
function paintHud() {
  const f = T.fight; if (!f) return;
  $('#pe-ten').style.transform = `scaleX(${(f.tension / 100).toFixed(3)})`; $('#pe-ten').dataset.lvl = f.tension > 80 ? 'hi' : f.tension > 60 ? 'mid' : 'ok';
  $('#pe-dist').style.transform = `scaleX(${(1 - f.dist / 100).toFixed(3)})`;
  $('#pe-stam').textContent = f.run > 0 ? 'arrancada! dê linha' : f.stam > 0 ? 'peixe brigando' : 'peixe cansado: puxe!';
}
export function start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

// sair da tela no meio da pesca: a espera para (só conta com a tela aberta) e a briga perde o peixe
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return start();
  if (T.st === 'fight' || T.st === 'land') end('Você saiu da beira do rio no meio da briga: o peixe escapou.');
  if (T.st === 'wait' && T.bite > 0) { T.fish = null; setMsg('Você saiu da tela e o peixe levou a isca.', 'idle'); }
});

// ---------- cliques ----------
const holdOn = on => { if (T.st !== 'fight') return; hold.on = on; $('.pe-hold')?.setAttribute('aria-pressed', String(on)); };
document.addEventListener('pointerdown', e => { if (e.target.closest('[data-pe="hold"]')) { e.preventDefault(); holdOn(true); } });
document.addEventListener('pointerup', () => holdOn(false));
document.addEventListener('pointercancel', () => holdOn(false));
document.addEventListener('keydown', e => {
  if (e.key !== ' ' || $('#p-pesca')?.hidden || e.target.closest('input, textarea, select')) return;
  e.preventDefault(); if (e.repeat && T.st !== 'fight') return;
  if (T.st === 'fight') holdOn(true); else if (T.st === 'wait') hook(); else if (T.st === 'land') net(); else if (T.st === 'idle') doCast();
});
document.addEventListener('keyup', e => { if (e.key === ' ') holdOn(false); });
document.addEventListener('change', e => { if (e.target.name === 'pe-bait' && T.st === 'idle') T.bait = e.target.value; });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pe]'); if (!b) return;
  const s = G.S, a = b.dataset.pe, id = b.dataset.id; let r = null;
  if (a === 'cast') return doCast();
  if (a === 'hook') return hook();
  if (a === 'quit') { T.fish = null; setMsg('Linha recolhida. A isca foi perdida.', 'idle'); return render(); }
  if (a === 'net') return net();
  if (a === 'keep') return keepFish();
  if (a === 'free') return end(`Você soltou o ${PE.SPECIES[T.fish.sp].label}. Pesque e solte!`);
  if (a === 'spot' && T.st === 'idle') { T.spot = id; T.bait = { represa: 'viva', pesqueiro: 'massa' }[id] || 'minhoca'; return render(); }
  if (a === 'bait') { r = PE.buyBait(s, id); if (!r.err) { note(`pesca: ${r.n} iscas (${PE.BAITS[id].label})`, -r.cost); say(`+${r.n} iscas de ${PE.BAITS[id].label}.`); } }
  if (a === 'rod' && T.st === 'idle') { const own = PE.ensure(s).rods.includes(+id); if (!own && !confirm(`Comprar ${PE.RODS[id].label} por ${brl(PE.RODS[id].price)}?`)) return; r = PE.buyRod(s, +id); if (!r.err && r.cost) { note(`pesca: compra de ${PE.RODS[id].label}`, -r.cost); say(`${PE.RODS[id].label[0].toUpperCase() + PE.RODS[id].label.slice(1)} comprada.`); } }
  if (a === 'cooler') { if (!confirm(`Comprar ${PE.COOLERS[id].label} por ${brl(PE.COOLERS[id].price)}?`)) return; r = PE.buyCooler(s, +id); if (!r.err) note(`pesca: compra de ${PE.COOLERS[id].label}`, -r.cost); }
  if (a === 'sellall' || a === 'sell1') { r = PE.sell(s, a === 'sell1' ? [+id] : null); if (!r.err && r.n) { note(`pesca: venda na peixaria (${r.n} ${r.n === 1 ? 'peixe' : 'peixes'}, ${fmtKg(r.kg)})`, r.v); say(`Vendido por ${brl(r.v)}.`); } }
  if (r?.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  if (r) { save(); G.render(); }
});
