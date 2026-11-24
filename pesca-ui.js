// Tela do pesqueiro (aba pesca). As regras ficam em pesca.js.
// Fases: arremesso (segure para dar força) → espera (beliscada falsa e a boia afundando) → fisgada → briga (recolher, fricção, salto,
// arrancada, linha frouxa) → puçá → caixa ou soltar. Só anda com a tela aberta; sair no meio da briga perde o peixe.
import * as PE from './pesca.js';
import * as sfx from './sfx.js';
import { G, $, esc, brl, int, say, save, note, confetti, today, RM } from './store.js';

// estado da pescaria na tela (não vai para o save: fechar a página no meio perde só a isca)
const T = { st: 'idle', spot: 'lagoa', bait: 'minhoca', fish: null, fight: null, msg: '', t: 0, pow: 0, powDir: 1, at: 0, cast: null, school: 0, onSchool: false, wait: 0, nib: 0, nibOn: 0, bite: 0, late: 0, grade: null, land: null, miss: 0, tangle: 0, rec: false, fx: [], shake: 0, snd: 0, buzz: 0, tip: '', birds: [] };
const hold = { on: false };
const fmtKg = k => `${k.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
const rnd = (a, b) => a + Math.random() * (b - a);
const cap = t => t[0].toUpperCase() + t.slice(1);
const hour = () => new Date().getHours();
const P = () => PE.ensure(G.S);
const lv = () => PE.levelOf(P().xp);

// ---------- painéis: redesenhados a cada render do jogo ----------
export function render() {
  const el = $('#pe-side'); if (!el) return;
  const s = G.S, p = PE.ensure(s), now = Date.now(), busy = T.st !== 'idle';
  if (!p.orders.length && p.n) PE.newOrders(s);
  const W = PE.weatherOf(s.month), h = hour(), L = lv(), nx = PE.xpFor(L + 1), cur = PE.xpFor(L);
  $('#pe-cond').innerHTML = `<span title="${esc(W.txt)}">${W.ico} ${W.label} <small class="muted">${esc(W.txt)}</small></span><span>🕒 ${esc(PE.hourLabel(h))}</span>
    <span class="pe-lv"><b>pescador nível ${L}</b><span class="bar"><i style="transform:scaleX(${((p.xp - cur) / (nx - cur)).toFixed(3)})"></i></span><small class="muted">${int(p.xp - cur)}/${int(nx - cur)} XP</small></span>`;
  $('#pe-spots').innerHTML = Object.entries(PE.SPOTS).map(([k, S]) => {
    const left = PE.ticketLeft(s, k, now), can = p.rods.some(i => i >= S.rod);
    return `<button class="pe-spot${T.spot === k ? ' is-on' : ''}" data-pe="spot" data-id="${k}" ${busy ? 'disabled' : ''}>
      <b>${S.label}</b><small>${S.fee ? (left ? `entrada paga · ${Math.ceil(left / 60000)} min` : `entrada ${brl(S.fee)} (30 min)`) : 'grátis'} · água até ${S.size} m</small>
      <small class="muted">${can ? esc(S.txt) : `precisa de ${PE.RODS[S.rod].label}`}</small></button>`;
  }).join('');
  const bk = PE.boxKg(s), cp = PE.COOLERS[p.cooler].cap, tot = PE.value(s), seen = Object.keys(p.best).length;
  el.innerHTML = `${p.orders.length ? `<div class="glass pe-card"><h4>encomendas <small class="muted">pagam acima da peixaria · trocam todo mês</small></h4>${p.orders.map(o => { const got = PE.fits(s, o).length; return `<div class="pe-ord"><span><b>${esc(o.who)}</b><small class="muted">${o.n}× ${PE.SPECIES[o.sp].label} de ${String(o.min).replace('.', ',')} kg ou mais, fresco · paga ${Math.round((o.x - 1) * 100)}% a mais</small></span><button class="btn btn--${got >= o.n ? 'gold' : 'glass'} btn--sm" data-pe="deliver" data-id="${esc(o.id)}" ${got >= o.n ? '' : 'disabled'}>${got}/${o.n} entregar</button></div>`; }).join('')}</div>` : ''}
    <div class="glass pe-card"><h4>caixa térmica <small class="muted">${fmtKg(bk)} de ${cp} kg</small></h4>
      <span class="bar"><i style="transform:scaleX(${Math.min(1, bk / cp).toFixed(3)})"></i></span>
      ${p.box.length ? `<ul class="pe-box">${p.box.map((f, i) => `<li><span>${PE.SPECIES[f.sp].img} ${PE.SPECIES[f.sp].label}${f.trophy ? ' <b class="pe-trophy">troféu</b>' : ''}</span><span class="muted small">${fmtKg(f.kg)}${f.age ? ` · ${f.age} ${f.age === 1 ? 'mês' : 'meses'} no gelo` : ' · fresco'}</span><b class="good">${brl(PE.fishValue(s, f))}</b><button class="btn btn--glass btn--sm" data-pe="sell1" data-id="${i}">vender</button></li>`).join('')}</ul>
      <button class="btn btn--gold" data-pe="sellall">vender tudo na peixaria (${brl(tot)})</button>
      <p class="muted small">No gelo o peixe perde ${Math.round(PE.SPOIL * 100)}% do preço a cada mês do mundo e estraga no ${PE.SPOIL_MAX + 1}º mês.</p>`
      : '<p class="muted small">Vazia. O que você tirar da água vem para cá.</p>'}</div>
    ${p.wall?.length ? `<div class="glass pe-card"><h4>mural de troféus <small class="muted">suas maiores capturas</small></h4><ol class="pe-wall">${p.wall.map(w => `<li><i>${PE.SPECIES[w.sp].img}</i><span><b>${PE.SPECIES[w.sp].label} · ${fmtKg(w.kg)}</b><small class="muted">${w.cm} cm${w.spot ? ` · ${esc(w.spot)}` : ''}${w.at ? ` · ${new Date(w.at).toLocaleDateString('pt-BR')}` : ''}${w.trophy ? ' · troféu' : ''}</small></span></li>`).join('')}</ol></div>` : ''}
    <div class="glass pe-card"><h4>álbum de espécies <small class="muted">${seen} de ${Object.keys(PE.SPECIES).length}</small></h4><div class="pe-album">${Object.entries(PE.SPECIES).map(([k, F]) => p.best[k]
      ? `<span class="pe-sp" title="${esc(F.txt)}"><i>${F.img}</i><b>${F.label}</b><small>recorde ${fmtKg(p.best[k])}</small></span>`
      : `<span class="pe-sp is-off" title="ainda não pescado"><i>❔</i><b>???</b><small>${PE.ZONES[F.zone[0]]}</small></span>`).join('')}</div></div>
    <div class="glass pe-card"><h4>peixaria <small class="muted">preço por kg deste mês</small></h4><div class="pe-prices">${Object.entries(PE.SPECIES).map(([k, F]) => { const m = p.mkt[k] || 1; return `<span>${F.label}<b>R$ ${PE.priceKg(s, k).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small class="${m >= 1 ? 'good' : 'bad'}">${m >= 1 ? '▲' : '▼'}${Math.abs((m - 1) * 100).toFixed(0)}%</small></b></span>`; }).join('')}</div>
      <p class="muted small">Peixe com ${Math.round(PE.TROPHY * 100)}% do peso máximo da espécie é troféu e vale ${Math.round(PE.TROPHY_BONUS * 100)}% a mais.</p></div>
    <div class="glass pe-card"><h4>iscas <small class="muted">1 por arremesso</small></h4>${Object.entries(PE.BAITS).map(([k, B]) => `<div class="pe-row"><label><input type="radio" name="pe-bait" value="${k}" ${T.bait === k ? 'checked' : ''} ${busy ? 'disabled' : ''}> ${B.label} <b>${int(p.baits[k] || 0)}</b></label><button class="btn btn--glass btn--sm" data-pe="bait" data-id="${k}">+${B.pack} por ${brl(B.price)}</button></div>`).join('')}</div>
    <div class="glass pe-card"><h4>varas</h4>${PE.RODS.map((R, i) => `<div class="pe-row"><span>${R.label} <small class="muted">linha ${R.line} kg · arremesso ${R.cast} m · ${R.spool} m de linha${R.drag ? '' : ' · sem fricção'}</small></span>${p.rod === i ? '<b class="good">em uso</b>' : `<button class="btn btn--${p.rods.includes(i) ? 'glass' : 'gold'} btn--sm" data-pe="rod" data-id="${i}" ${busy ? 'disabled' : ''}>${p.rods.includes(i) ? 'usar' : brl(R.price)}</button>`}</div>`).join('')}</div>
    <div class="glass pe-card"><h4>caixa térmica maior</h4>${PE.COOLERS.map((C, i) => `<div class="pe-row"><span>${C.label} <small class="muted">${C.cap} kg</small></span>${i <= p.cooler ? (i === p.cooler ? '<b class="good">sua</b>' : '<small class="muted">—</small>') : `<button class="btn btn--gold btn--sm" data-pe="cooler" data-id="${i}">${brl(C.price)}</button>`}</div>`).join('')}</div>
    <p class="muted small">Você já tirou ${int(p.n)} ${p.n === 1 ? 'peixe' : 'peixes'} (${fmtKg(p.kg)}) e ganhou ${brl(p.earned)} com pesca.</p>`;
  if (!$('#pe-acts').childElementCount) paintActs();
  paintDrag(); start();
}

// ---------- botões da pescaria ----------
function paintActs() {
  const a = $('#pe-acts'); if (!a) return;
  const f = T.fish, S = PE.SPECIES[f?.sp] || {}, R = PE.RODS[P().rod];
  a.innerHTML = {
    idle: `<button class="btn btn--gold btn--lg pe-hold" data-pe="cast" aria-pressed="false">segure para arremessar</button>`,
    aim: `<button class="btn btn--gold btn--lg pe-hold" data-pe="cast" aria-pressed="true">solte para arremessar</button>`,
    wait: `<button class="btn btn--gold btn--lg" data-pe="hook">fisgar!</button><button class="btn btn--glass" data-pe="quit">recolher</button>`,
    fight: `<button class="btn btn--gold btn--lg pe-hold" data-pe="reel" aria-pressed="false">segure para recolher</button>`,
    land: `<button class="btn btn--gold btn--lg" data-pe="net">tirar da água!</button>`,
    caught: f ? `<button class="btn btn--gold btn--lg" data-pe="keep">pôr na caixa (${brl(PE.fishValue(G.S, { ...f, age: 0 }))})</button><button class="btn btn--glass" data-pe="free">pesque e solte (+${Math.round(PE.xpOf(f) * 1.5)} XP)</button>` : '',
  }[T.st] ?? '';
  $('#pe-msg').innerHTML = T.st === 'caught' && f
    ? `<strong class="dw-win">${S.img} ${S.label} de ${fmtKg(f.kg)}!</strong>${f.trophy ? ' <b class="pe-trophy">peixe troféu</b>' : ''}${T.rec ? ' <b class="pe-trophy">novo recorde</b>' : ''} <span class="muted small">${esc(S.txt)}</span>`
    : T.msg;
  const ph = $('#pe-photo'); ph.hidden = !(T.st === 'caught' && f);
  if (T.st === 'caught' && f) ph.innerHTML = `<div class="pe-photo__pic"><i>${S.img}</i></div><div><b>${S.label}</b><span>${fmtKg(f.kg)} · ${PE.lengthCm(f)} cm</span><small>${esc(PE.SPOTS[T.spot].label)} · ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>${f.trophy ? '<em>peixe troféu</em>' : ''}${T.rec ? '<em>novo recorde</em>' : ''}</div>`;
  $('#pe-hud').hidden = T.st !== 'fight' && T.st !== 'land';
  $('#pe-net').hidden = T.st !== 'land';
  $('#pe-pow').hidden = T.st !== 'aim';
  $('#pe-dragbox').hidden = !R.drag || !['idle', 'aim', 'fly', 'wait', 'fight'].includes(T.st);
}
const setMsg = (m, st) => { T.msg = m; if (st) T.st = st; paintActs(); };
function paintDrag() { const v = $('#pe-drag'); if (v) v.textContent = P().drag; }
function setDrag(d) { const p = P(); p.drag = Math.max(1, Math.min(10, p.drag + d)); paintDrag(); sfx.tick(0.2); }

// arremesso: segure (a força vai e volta), solte no ponto certo. As bolhas mostram o cardume.
function aim() {
  if (T.st !== 'idle') return;
  const s = G.S;
  if (P().rod < PE.SPOTS[T.spot].rod) return say(`Use ${PE.RODS[PE.SPOTS[T.spot].rod].label} ou melhor aqui.`, true);
  if (!(P().baits[T.bait] > 0)) return say('Sem isca: compre na lojinha ao lado.', true);
  const e = PE.enter(s, T.spot); if (e.err) return say(cap(e.err), true);
  if (e.cost) { note(`pesca: entrada do ${PE.SPOTS[T.spot].label}`, -e.cost); save(); }
  T.school ||= PE.school(T.spot); T.tip = PE.tipFor(T.spot, PE.weatherOf(s.month)); $('#pe-tip').textContent = `🎣 Seu Tião: ${T.tip}`; T.pow = 0; T.powDir = 1; T.fish = null;
  setMsg(`Solte quando a força chegar no cardume (bolhas a ~${T.school} m).`, 'aim');
}
function release() {
  if (T.st !== 'aim') return;
  const s = G.S, c = PE.cast(s, T.spot, T.bait); if (c.err) { setMsg('', 'idle'); return say(cap(c.err), true); }
  save();
  const th = PE.throwAt(T.spot, P().rod, T.pow);
  T.cast = { m: th.m, k: 0 }; T.at = th.m;
  if (th.backlash) { T.tangle = 4; sfx.play('chip', 0.3); return setMsg('<b>Cabeleira!</b> Força demais na carretilha e a linha embolou. Desembaraçando...', 'tangle'); }
  const S = PE.SPOTS[T.spot]; T.onSchool = Math.abs(th.m - T.school) <= S.size * 0.1;
  const tired = PE.fatigue(s, today()), pk = PE.perks(lv());
  T.fish = PE.roll(T.spot, T.bait, th.zone, T.onSchool);
  T.wait = PE.waitFor({ weather: PE.weatherOf(s.month).bite, hour: PE.hourBite(hour()), onSchool: T.onSchool, perk: pk.wait, tired }) + 0.7;
  T.nib = rnd(1.5, 4); T.bite = 0; T.miss = 0;
  sfx.play('chip', 0.3);
  setMsg(`${th.m} m · ${PE.ZONES[th.zone]}${T.onSchool ? ' · <b class="good">no cardume!</b>' : ''}. ${tired > 1 ? 'Você já pescou mais de 2 horas hoje: o peixe demora mais. ' : ''}Espere a boia <b>afundar de vez</b>.`, 'fly');
}
function hook() {
  if (T.st !== 'wait') return;
  if (T.bite > 0) {
    const g = PE.hookGrade(T.late, PE.perks(lv()).hook); if (!g) return;
    T.grade = g; T.fight = PE.newFight(T.fish, P().rod, T.at, g.q, lv()); T.bite = 0; sfx.tick(1); navigator.vibrate?.(60);
    return setMsg(`<b>${cap(g.label)}</b> Recolha em puxadas e solte quando a linha avermelhar. Fricção: ↑ ↓.`, 'fight');
  }
  T.fish = null; T.school = 0; sfx.play('chip', 0.2);
  setMsg('Fisgou na beliscada: o peixe se assustou e levou a isca.', 'idle'); render();
}
function end(msg) { T.fish = null; T.fight = null; T.school = 0; hold.on = false; setMsg(msg, 'idle'); render(); }
function startLand() { T.land = { x: 0, dir: 1, zone: 0.3 + Math.random() * 0.4, w: Math.max(0.1, 0.24 - PE.SPECIES[T.fish.sp].power * 0.08 - Math.min(0.06, T.fish.kg / 1000)) }; setMsg('Peixe na beira! Aperte <b>tirar da água</b> com o puçá na faixa verde.', 'land'); }
function net() {
  const l = T.land; if (!l || T.st !== 'land') return;
  if (Math.abs(l.x - l.zone) <= l.w / 2) {
    T.rec = T.fish.kg > (P().best[T.fish.sp] || 0); T.st = 'caught'; splash(1, 26); T.shake = 0.3;
    Object.assign(T.fish, { spot: PE.SPOTS[T.spot].label, at: Date.now() });
    try { G.fishNews?.(T.fish, `${['tilapia', 'traira', 'carpa'].includes(T.fish.sp) ? 'uma' : 'um'} ${PE.SPECIES[T.fish.sp].label}`, { lagoa: 'na lagoa', pesqueiro: 'no pesque-pague', represa: 'na represa' }[T.spot]); } catch {}
    sfx.fanfare(); confetti(T.fish.trophy ? 160 : T.rec ? 80 : 30); navigator.vibrate?.([30, 40, 30]); paintActs(); render(); return;
  }
  T.miss++; sfx.play('chip', 0.2); splash(1, 12);
  if (T.miss >= 2) return end('O peixe bateu o rabo no puçá e voltou para a água. Escapou!');
  T.fight.d = 6; T.fight.stam = Math.max(T.fight.stam, 0.25); setMsg('Errou o puçá! Ele voltou a brigar: recolha de novo.', 'fight');
}
function keepFish() {
  const s = G.S, f = T.fish, r = PE.keep(s, f);
  if (r.err) return say(cap(r.err), true);
  save(); end(`${cap(PE.SPECIES[f.sp].label)} de ${fmtKg(f.kg)} na caixa térmica (+${r.xp} XP). Arremesse de novo!`);
}
function freeFish() { const f = T.fish, r = PE.release(G.S, f); save(); end(`Solto de volta: ${PE.SPECIES[f.sp].label} de ${fmtKg(f.kg)} (+${r.xp} XP). Pesque e solte!`); }

// ---------- cena (canvas) ----------
const SKY = { lagoa: ['#8fc6d8', '#e9d9a8'], pesqueiro: ['#86b4d6', '#f0d7a0'], represa: ['#6f9cc9', '#e2c08c'] };
const WATER = { lagoa: ['#3f8a7a', '#1d4a43'], pesqueiro: ['#3a7fa0', '#173f5a'], represa: ['#2c5f8f', '#0f2744'] };
function splash(at, n) { for (let i = 0; i < n; i++) T.fx.push({ at, a: rnd(-Math.PI, 0), v: rnd(40, 140), life: rnd(0.4, 0.9), t: 0 }); }
let raf = 0, last = 0;
// distância (m) para a tela: longe = perto do horizonte
function spotXY(W, H, hz, m, wob = 0) {
  const k = Math.min(1, m / PE.SPOTS[T.spot].size), y = H - (H - hz) * (0.12 + 0.82 * Math.pow(k, 0.8));
  return [W * (0.52 + 0.16 * Math.sin(wob) * (0.4 + k)), y];
}
const jumpK = f => (f?.mv === 'jump' ? Math.sin(Math.max(0, Math.min(1, 1 - f.mt / PE.MOVES.jump.t[1]))* Math.PI) : 0);
function draw(cv, dt) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, hz = H * 0.3, t = (T.t += dt), u = W / 600, h = hour(), S = PE.SPOTS[T.spot];
  x.save(); if (T.shake > 0 && !RM.matches) { T.shake = Math.max(0, T.shake - dt); x.translate((Math.random() - 0.5) * 10 * u * T.shake, (Math.random() - 0.5) * 10 * u * T.shake); }
  const night = h >= 19 || h < 5;
  const g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, SKY[T.spot][0]); g.addColorStop(1, SKY[T.spot][1]); x.fillStyle = g; x.fillRect(0, 0, W, hz);
  if (h < 7 || h >= 18) { x.fillStyle = h >= 20 || h < 5 ? 'rgba(10,15,40,.55)' : 'rgba(255,120,60,.22)'; x.fillRect(0, 0, W, hz); }
  const Wt = PE.weatherOf(G.S.month);
  // sol ou lua, estrelas e pássaros
  if (night) { x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 40; i++) x.fillRect((i * 137) % W, (i * 71) % (hz * 0.8), (i % 3 ? 1 : 2) * u, (i % 3 ? 1 : 2) * u); x.fillStyle = '#f4f1d0'; x.beginPath(); x.arc(W * 0.8, hz * 0.3, 14 * u, 0, Math.PI * 2); x.fill(); }
  else if (!/chuva|frente/.test(Wt.label)) { const sy = hz * (h < 12 ? 1 - (h - 5) / 7 : (h - 12) / 7) * 0.8 + hz * 0.1; x.fillStyle = h >= 17 || h < 7 ? '#ffb15a' : '#fff3b0'; x.beginPath(); x.arc(W * (0.15 + (h - 5) / 14 * 0.7), sy, 16 * u, 0, Math.PI * 2); x.fill(); }
  if (!night) { if (T.birds.length < 3 && Math.random() < dt * 0.08) T.birds.push({ x: -20, y: hz * (0.15 + Math.random() * 0.4), v: 30 + Math.random() * 30 }); x.strokeStyle = 'rgba(30,30,40,.7)'; x.lineWidth = 1.5 * u; T.birds = T.birds.filter(b => (b.x += b.v * dt * u) < W + 20); for (const b of T.birds) { const fl = Math.sin(t * 9 + b.y) * 4 * u; x.beginPath(); x.moveTo(b.x - 6 * u, b.y - fl); x.lineTo(b.x, b.y); x.lineTo(b.x + 6 * u, b.y - fl); x.stroke(); } }
  if (/nublado|chuva|frente/.test(Wt.label)) { x.fillStyle = 'rgba(80,90,110,.35)'; x.fillRect(0, 0, W, hz); }
  // morros e mata
  x.fillStyle = '#3f6b3e'; x.beginPath(); x.moveTo(0, hz); for (let i = 0; i <= 10; i++) x.lineTo(i * W / 10, hz - (16 + 18 * Math.abs(Math.sin(i * 1.9 + (T.spot === 'represa' ? 2 : T.spot === 'pesqueiro' ? 1 : 0)))) * u); x.lineTo(W, hz); x.fill();
  const w = x.createLinearGradient(0, hz, 0, H); w.addColorStop(0, WATER[T.spot][0]); w.addColorStop(1, WATER[T.spot][1]); x.fillStyle = w; x.fillRect(0, hz, W, H - hz);
  // ondas (mais perto = maiores)
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1.5 * u;
  for (let r = 0; r < 9; r++) { const k = r / 9, yy = hz + 8 * u + (H - hz) * k * k; x.beginPath(); for (let i = 0; i <= W; i += 14 * u) x.lineTo(i, yy + Math.sin(i / (30 * u) + t * 1.4 + r) * (1 + k * 4) * u); x.stroke(); }
  // faixas de profundidade
  x.font = `${11 * u}px system-ui`; x.fillStyle = 'rgba(255,255,255,.4)'; x.textAlign = 'right';
  for (const [i, m] of [[0, S.size * 0.3], [1, S.size * 0.65]]) { const [, y] = spotXY(W, H, hz, m); x.fillRect(W * 0.86, y, W * 0.12, 1); x.fillText(`${PE.ZONES[i + 1]} · ${Math.round(m)} m`, W * 0.98, y - 3 * u); }
  // chuva
  if (/chuva/.test(Wt.label)) { x.strokeStyle = 'rgba(220,230,255,.35)'; x.lineWidth = u; for (let i = 0; i < 60; i++) { const rx = (i * 97 + t * 400) % W, ry = (i * 53 + t * 700) % H; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 3 * u, ry + 9 * u); x.stroke(); } }
  // cardume (bolhas)
  if (T.school && ['aim', 'fly', 'wait'].includes(T.st)) { const [bx, by] = spotXY(W, H, hz, T.school, 0.4); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = u; for (let i = 0; i < 7; i++) { const ph = (t * 0.8 + i / 7) % 1; x.beginPath(); x.arc(bx + Math.sin(i * 2.4) * 18 * u, by - ph * 10 * u, (1.5 + ph * 3) * u, 0, Math.PI * 2); x.stroke(); } }
  // taboas na beira, píer no pesque-pague, vaga-lumes à noite
  x.strokeStyle = '#4c6b2a'; x.lineWidth = 2 * u; for (let i = 0; i < 14; i++) { const rx = W * (0.62 + i * 0.027), sw = Math.sin(t * 1.2 + i) * 3 * u; x.beginPath(); x.moveTo(rx, H); x.quadraticCurveTo(rx + sw, H - 30 * u, rx + sw * 2, H - (40 + (i % 4) * 8) * u); x.stroke(); if (i % 3 === 0) { x.fillStyle = '#6b4423'; x.fillRect(rx + sw * 2 - 2 * u, H - (48 + (i % 4) * 8) * u, 4 * u, 10 * u); } }
  if (T.spot === 'pesqueiro') { x.fillStyle = '#8a6a44'; x.fillRect(W * 0.72, H * 0.62, W * 0.28, 8 * u); for (let i = 0; i < 4; i++) x.fillRect(W * (0.74 + i * 0.07), H * 0.62, 4 * u, H * 0.2); }
  if (night) { for (let i = 0; i < 10; i++) { const a = (t * 0.4 + i * 1.7); x.fillStyle = `rgba(220,255,120,${0.4 + 0.4 * Math.sin(t * 3 + i)})`; x.fillRect(W * (0.55 + 0.4 * ((Math.sin(a) + 1) / 2)), H * (0.55 + 0.3 * ((Math.cos(a * 1.3) + 1) / 2)), 2.5 * u, 2.5 * u); } }
  // barranco e vara
  x.fillStyle = '#5b3f22'; x.beginPath(); x.moveTo(0, H); x.lineTo(0, H * 0.8); x.quadraticCurveTo(W * 0.2, H * 0.84, W * 0.34, H); x.fill();
  x.fillStyle = '#3d6b2f'; for (let i = 0; i < 9; i++) x.fillRect(i * W * 0.035, H * 0.8 + Math.sin(i) * 4 * u - 10 * u, 2 * u, 12 * u);
  const f = T.fight, ten = f?.ten || 0, bend = T.st === 'fight' || T.st === 'land' ? Math.min(1, ten) : T.st === 'aim' ? T.pow * 0.5 : 0;
  const base = [W * 0.1, H * 0.99], tip = [W * 0.3 + bend * W * 0.06, H * 0.38 + bend * H * 0.22], ctl = [W * 0.15, H * 0.62 - bend * H * 0.05];
  x.lineCap = 'round';
  for (const [c, lw] of [['#2e1d0e', 6], ['#7a5b37', 2]]) { x.strokeStyle = c; x.lineWidth = lw * u; x.beginPath(); x.moveTo(...base); x.quadraticCurveTo(...ctl, ...tip); x.stroke(); }
  // ponto na água
  let m = T.st === 'fight' || T.st === 'land' ? f?.d ?? 0 : T.at;
  const wob = T.st === 'fight' ? t * (f?.mv === 'run' ? 2.4 : 0.9) : 0.4;
  if (T.st === 'fly' && T.cast) { T.cast.k = Math.min(1, T.cast.k + dt / 0.7); m = T.cast.m * T.cast.k; if (T.cast.k >= 1) { splash(T.cast.m, 10); sfx.play('chip', 0.25); T.st = 'wait'; paintActs(); } }
  const show = ['fly', 'wait', 'fight', 'land'].includes(T.st);
  if (show) {
    let [px, py] = spotXY(W, H, hz, m, wob);
    if (T.st === 'fly') py -= Math.sin(T.cast.k * Math.PI) * H * 0.35;
    const sink = T.st === 'wait' ? (T.bite > 0 ? 12 * u : T.nibOn > 0 ? 4 * u * Math.sin(T.nibOn * 22) : Math.sin(t * 2) * 1.5 * u) : 0;
    const jump = jumpK(f);
    // linha: barriga quando frouxa, reta quando esticada
    const sag = T.st === 'wait' || T.st === 'fly' ? 50 * u : (1 - Math.min(1, ten)) * 60 * u;
    x.strokeStyle = ten > 0.85 ? '#ff4a3a' : ten > 0.65 ? '#ffc04a' : 'rgba(255,255,255,.85)'; x.lineWidth = (ten > 0.85 ? 2.4 : 1.3) * u;
    x.beginPath(); x.moveTo(...tip); x.quadraticCurveTo((tip[0] + px) / 2, Math.max(tip[1], py) + sag, px, py + sink - jump * H * 0.22); x.stroke();
    if (T.st === 'wait' || T.st === 'fly') {   // boia
      x.fillStyle = '#e8432f'; x.beginPath(); x.ellipse(px, py + sink - 6 * u, 5 * u, 8 * u, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.fillRect(px - 5 * u, py + sink - 3 * u, 10 * u, 3 * u);
    } else if (f) {   // peixe: sombra embaixo d'água, fora dela no salto
      const sz = Math.min(70, 16 + Math.sqrt(T.fish.kg) * 8) * u * (0.6 + 0.4 * (1 - Math.min(1, m / S.size)));
      if (jump > 0.05) {
        x.font = `${sz}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.save(); x.translate(px, py - jump * H * 0.22); x.rotate(Math.sin(t * 14) * 0.5); x.fillText(PE.SPECIES[T.fish.sp].img, 0, 0); x.restore();
      } else {
        x.fillStyle = 'rgba(10,20,30,.45)'; x.beginPath(); x.ellipse(px, py + 4 * u, sz * 0.5, sz * 0.18, Math.sin(t * 6) * 0.2, 0, Math.PI * 2); x.fill();
        if (f.mv === 'run' || f.mv === 'shake') { x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = u; x.beginPath(); x.ellipse(px, py + 3 * u, sz * 0.7, sz * 0.22, 0, 0, Math.PI * 2); x.stroke(); }
      }
    }
  }
  if (T.st === 'caught' && T.fish) {   // peixe pendurado na linha, fora da água
    const sz = Math.min(90, 26 + Math.sqrt(T.fish.kg) * 10) * u, px = W * 0.5, py = H * 0.42 + Math.sin(t * 3) * 4 * u;
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.3 * u; x.beginPath(); x.moveTo(...tip); x.lineTo(px, py - sz * 0.4); x.stroke();
    x.font = `${sz}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.save(); x.translate(px, py); x.rotate(Math.PI / 2 + Math.sin(t * 9) * 0.25); x.fillText(PE.SPECIES[T.fish.sp].img, 0, 0); x.restore();
  }
  // respingos
  T.fx = T.fx.filter(p => (p.t += dt) < p.life);
  x.fillStyle = 'rgba(255,255,255,.8)';
  for (const p of T.fx) { const [sx, sy] = spotXY(W, H, hz, p.at, wob); x.fillRect(sx + Math.cos(p.a) * p.v * p.t * u, sy + (Math.sin(p.a) * p.v * p.t + 160 * p.t * p.t) * u, 2.5 * u, 2.5 * u); }
  x.restore();
}
function loop(ts) {
  raf = 0;
  const cv = $('#pe-cv'); if (!cv || $('#p-pesca')?.hidden) return;
  const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (r.width && cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * dpr * 0.5); }
  tickGame(dt); draw(cv, dt);
  raf = requestAnimationFrame(loop);
}
function tickGame(dt) {
  if (!['idle', 'caught'].includes(T.st)) PE.fished(G.S, today(), dt);   // tempo na beira conta para o cansaço
  if (T.st === 'aim') {
    T.pow += T.powDir * dt / 1.1; if (T.pow >= 1) { T.pow = 1; T.powDir = -1; } if (T.pow <= 0) { T.pow = 0; T.powDir = 1; }
    const R = PE.RODS[P().rod], m = Math.min(PE.SPOTS[T.spot].size, R.cast * Math.max(0.08, T.pow));
    $('#pe-pow').innerHTML = `<i class="pe-pow__fill" style="transform:scaleX(${T.pow.toFixed(3)})"></i><i class="pe-pow__mark" style="left:${Math.min(100, T.school / R.cast * 100).toFixed(1)}%"></i><span>${m.toFixed(0)} m${R.backlash && T.pow > 0.96 ? ' · cuidado: cabeleira' : ''}</span>`;
  } else if (T.st === 'tangle') {
    T.tangle -= dt; if (T.tangle <= 0) { T.school = 0; setMsg('Linha desembaraçada. A isca foi perdida; arremesse de novo, com menos força.', 'idle'); render(); }
  } else if (T.st === 'wait') {
    T.nibOn = Math.max(0, T.nibOn - dt);
    if (T.bite > 0) { T.bite -= dt; T.late += dt; if (T.bite <= 0) { T.fish = null; T.school = 0; setMsg('Demorou para fisgar: o peixe comeu a isca e foi embora.', 'idle'); render(); } return; }
    T.nib -= dt; if (T.nib <= 0) { T.nibOn = 0.5; T.nib = rnd(2, 5); sfx.tick(0.25); }
    T.wait -= dt; if (T.wait <= 0) { T.bite = PE.HOOK_WIN + PE.perks(lv()).hook; T.late = 0; splash(T.at, 6); sfx.tick(0.9); navigator.vibrate?.(40); setMsg('<b>A boia afundou! FISGUE!</b>'); }
  } else if (T.st === 'fight') {
    const f = T.fight, mv = f.mv, r = PE.step(f, hold.on, P().drag, dt);
    if (f.mv !== mv && f.mv === 'jump') { splash(f.d, 14); sfx.play('chip', 0.4); T.shake = 0.35; }
    if (f.mv !== mv && f.mv === 'run') { T.shake = 0.25; navigator.vibrate?.(80); }
    // som: a fricção chia quando solta linha; a carretilha estala recolhendo
    T.snd -= dt; if (T.snd <= 0) { if (f.out) { sfx.tick(0.18); T.snd = 0.06; } else if (hold.on) { sfx.tick(0.06); T.snd = 0.16; } }
    // celular: a vara "pulsa" na mão conforme a força na linha
    T.buzz -= dt; if (T.buzz <= 0 && f.ten > 0.4) { navigator.vibrate?.(Math.round(8 + f.ten * 30)); T.buzz = 0.45 - f.ten * 0.25; }
    paintHud();
    if (r === 'snap') { sfx.boom(); navigator.vibrate?.([30, 30, 80]); return end(T.fish.kg > PE.RODS[P().rod].maxKg ? `A linha arrebentou: peixe grande demais para a ${PE.RODS[P().rod].label}.` : P().drag >= 9 && f.R.drag ? 'A linha arrebentou! Fricção apertada demais: perto do máximo a linha estoura antes de correr.' : 'A linha arrebentou! Solte quando ela ficar vermelha.'); }
    if (r === 'spool') return end('O peixe levou toda a linha do carretel e escapou. Aperte a fricção (↑) quando ele correr muito.');
    if (r === 'unhook') return end('A linha ficou frouxa e o anzol soltou. Mantenha a linha sempre um pouco esticada.');
    if (r === 'throw') { splash(f.d, 18); return end('No salto ele sacudiu a cabeça e cuspiu o anzol! Quando ele saltar, solte a linha.'); }
    if (r === 'land') startLand();
  } else if (T.st === 'land') {
    const l = T.land; l.x += l.dir * dt * (0.7 + PE.SPECIES[T.fish.sp].power * 0.6); if (l.x > 1 || l.x < 0) { l.dir *= -1; l.x = Math.min(1, Math.max(0, l.x)); }
    $('#pe-net').innerHTML = `<i class="pe-net__zone" style="left:${((l.zone - l.w / 2) * 100).toFixed(1)}%;width:${(l.w * 100).toFixed(1)}%"></i><i class="pe-net__mark" style="left:${(l.x * 100).toFixed(1)}%"></i>`;
  }
}
function paintHud() {
  const f = T.fight; if (!f) return;
  const R = f.R, slip = R.drag ? Math.min(1, P().drag / 10 * 1.05) : 1;
  $('#pe-ten').style.transform = `scaleX(${Math.min(1, f.ten).toFixed(3)})`; $('#pe-ten').dataset.lvl = f.ten > 0.85 ? 'hi' : f.ten > 0.65 ? 'mid' : f.ten < 0.08 ? 'slack' : 'ok';
  $('#pe-slip').style.left = `${(slip * 100).toFixed(1)}%`; $('#pe-slip').hidden = !R.drag;
  $('#pe-dist').style.transform = `scaleX(${Math.min(1, f.d / R.spool).toFixed(3)})`; $('#pe-dist-t').textContent = `${f.d.toFixed(0)} m de ${R.spool} m`;
  $('#pe-stam').style.transform = `scaleX(${f.stam.toFixed(3)})`;
  const hot = f.warn > 0 || f.mv === 'jump' || f.mv === 'run' || (f.ten < 0.08 && f.slack > 0.6);
  const el = $('#pe-act'); el.textContent = f.warn > 0 ? PE.MOVES[f.next].warn : f.ten < 0.08 && f.slack > 0.6 ? 'linha frouxa! recolha' : f.stam < 0.18 ? 'peixe cansado: recolha!' : PE.MOVES[f.mv].label; el.dataset.hot = String(hot);
}
export function start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

// sair da tela no meio da pesca: a espera para (só conta com a tela aberta) e a briga perde o peixe
if (typeof document !== 'undefined') {
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return start();
  if (T.st === 'fight' || T.st === 'land') end('Você saiu da beira do rio no meio da briga: o peixe escapou.');
  if (T.st === 'wait' && T.bite > 0) { T.fish = null; setMsg('Você saiu da tela e o peixe levou a isca.', 'idle'); }
  if (T.st === 'aim') setMsg('', 'idle');
});

// ---------- controles: botão segurado (mouse/toque), barra de espaço e setas ----------
const press = on => {
  if (on) { if (T.st === 'idle') aim(); else if (T.st === 'fight') hold.on = true; }
  else { if (T.st === 'aim') release(); hold.on = false; }
  $('.pe-hold')?.setAttribute('aria-pressed', String(on && (T.st === 'fight' || T.st === 'aim')));
};
document.addEventListener('pointerdown', e => { if (e.target.closest?.('[data-pe="cast"], [data-pe="reel"]')) { e.preventDefault(); press(true); } });
document.addEventListener('pointerup', () => press(false));
document.addEventListener('pointercancel', () => press(false));
document.addEventListener('keydown', e => {
  if ($('#p-pesca')?.hidden || e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowUp' || e.key === '+') { e.preventDefault(); return setDrag(1); }
  if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); return setDrag(-1); }
  if (e.key !== ' ') return;
  e.preventDefault(); if (e.repeat) return;
  if (T.st === 'wait') hook(); else if (T.st === 'land') net(); else press(true);
});
document.addEventListener('keyup', e => { if (e.key === ' ') press(false); });
document.addEventListener('change', e => { if (e.target.name === 'pe-bait' && T.st === 'idle') T.bait = e.target.value; });
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-pe]'); if (!b) return;
  const s = G.S, a = b.dataset.pe, id = b.dataset.id; let r = null;
  if (a === 'hook') return hook();
  if (a === 'quit') { T.fish = null; T.school = 0; setMsg('Linha recolhida. A isca foi perdida.', 'idle'); return render(); }
  if (a === 'net') return net();
  if (a === 'keep') return keepFish();
  if (a === 'free') return freeFish();
  if (a === 'drag+') return setDrag(1);
  if (a === 'drag-') return setDrag(-1);
  if (a === 'spot' && T.st === 'idle') { T.spot = id; T.school = 0; T.bait = { represa: 'viva', pesqueiro: 'massa' }[id] || 'minhoca'; return render(); }
  if (a === 'bait') { r = PE.buyBait(s, id); if (!r.err) { note(`pesca: ${r.n} iscas (${PE.BAITS[id].label})`, -r.cost); say(`+${r.n} iscas de ${PE.BAITS[id].label}.`); } }
  if (a === 'rod' && T.st === 'idle') { const own = PE.ensure(s).rods.includes(+id); if (!own && !confirm(`Comprar ${PE.RODS[id].label} por ${brl(PE.RODS[id].price)}?`)) return; r = PE.buyRod(s, +id); if (!r.err && r.cost) { note(`pesca: compra de ${PE.RODS[id].label}`, -r.cost); say(`${cap(PE.RODS[id].label)} comprada.`); } }
  if (a === 'cooler') { if (!confirm(`Comprar ${PE.COOLERS[id].label} por ${brl(PE.COOLERS[id].price)}?`)) return; r = PE.buyCooler(s, +id); if (!r.err) note(`pesca: compra de ${PE.COOLERS[id].label}`, -r.cost); }
  if (a === 'sellall' || a === 'sell1') { r = PE.sell(s, a === 'sell1' ? [+id] : null); if (!r.err && r.n) { note(`pesca: venda na peixaria (${r.n} ${r.n === 1 ? 'peixe' : 'peixes'}, ${fmtKg(r.kg)})`, r.v); say(`Vendido por ${brl(r.v)}.`); } }
  if (a === 'deliver') { r = PE.deliver(s, id); if (!r.err) { note(`pesca: encomenda entregue (${r.o.who}, ${r.o.n} ${PE.SPECIES[r.o.sp].label})`, r.v); say(`Encomenda entregue: ${brl(r.v)}.`); confetti(50); } }
  if (r?.err) return say(cap(r.err), true);
  if (r) { save(); G.render(); }
});
}
