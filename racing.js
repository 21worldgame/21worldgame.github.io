// Canódromo noturno: transmissão com câmera seguindo o líder, boxes que abrem, lebre no trilho, galope por passada.
import * as R from './race.js';
import { G, $, esc, int, sleep, say, save, award, note, confetti, RM, ms } from './store.js';
import * as sfx from './sfx.js';

let race = null, pick = null, running = false;
export const COATS = ['var(--coat-fawn)', 'var(--coat-black)', 'var(--coat-blue)', 'var(--coat-red)', 'var(--coat-white)', 'var(--coat-brindle)'];

// ---------- galgo em 4 poses de galope ----------
const rad = d => (d * Math.PI) / 180;
function leg(x, y, a1, a2, l1, l2, w1, w2, color) {
  const ex = x + l1 * Math.sin(rad(a1)), ey = y + l1 * Math.cos(rad(a1));
  const px = ex + l2 * Math.sin(rad(a2)), py = ey + l2 * Math.cos(rad(a2));
  return `<path d="M${x} ${y} L${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${color}" stroke-width="${w1}" stroke-linecap="round"/>
    <path d="M${ex.toFixed(1)} ${ey.toFixed(1)} L${px.toFixed(1)} ${py.toFixed(1)}" stroke="${color}" stroke-width="${w2}" stroke-linecap="round"/>
    <ellipse cx="${(px + 1.5).toFixed(1)}" cy="${py.toFixed(1)}" rx="2.6" ry="1.4" fill="${color}"/>`;
}
const POSES = [   // [frente perto, frente longe, trás perto, trás longe] em graus (0 = para baixo, + = para frente), arco das costas, cauda
  { f: [58, 85], ff: [46, 72], h: [-58, -85], hf: [-46, -72], arch: 0, tail: 2 },
  { f: [22, 4], ff: [38, 30], h: [-34, -28], hf: [-20, -8], arch: 3, tail: 5 },
  { f: [-38, -64], ff: [-26, -52], h: [46, 74], hf: [34, 60], arch: 8, tail: 9 },
  { f: [-14, -36], ff: [-4, -18], h: [12, -6], hf: [26, 16], arch: 4, tail: 6 },
];
function dogSVG(lane, coat) {
  const poses = POSES.map((p, k) => {
    const a = p.arch;
    const torso = `M102 26 C94 19 76 ${17 - a} 60 ${18 - a} C48 ${19 - a} 38 22 34 29 C32 35 38 39 47 37 C55 34 62 34 70 38 C79 45 93 47 99 41 C105 35 105 29 102 26 Z`;
    return `<g class="p p${k}">
      ${leg(93, 36, ...p.ff, 12, 15, 4, 2.8, 'var(--coat-dark)')}${leg(43, 31, ...p.hf, 14, 16, 6, 3, 'var(--coat-dark)')}
      <path d="M35 28 C24 ${30 + p.tail / 2} 15 ${35 + p.tail} 5 ${37 + p.tail}" stroke="var(--coat)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="${torso}" fill="var(--coat)"/>
      <path d="M66 37 C78 44 92 46 99 40 C92 42 80 41 70 35 Z" fill="var(--shade)" opacity=".28"/>
      <path d="M60 ${19 - a} C72 18 86 18 94 23 L91 39 C81 41 71 37 63 35 Z" fill="var(--jacket-${lane})"/>
      <path d="M60 ${19 - a} C72 18 86 18 94 23" stroke="var(--hi)" stroke-width="1.2" opacity=".35" fill="none"/>
      <text x="77" y="${33 - a / 3}" class="dog__no">${lane}</text>
      <path d="M97 22 C103 14 109 10 115 10 L119 18 C111 19 105 25 103 31 Z" fill="var(--coat)"/>
      <path d="M111 8 C117 4 126 6 134 12 C136 14 135 16 132 16 L119 18 C114 17 110 13 111 8 Z" fill="var(--coat)"/>
      <path d="M113 8 C110 3 106 4 107 8 Z" fill="var(--coat-dark)"/>
      <path d="M121 9 L133 13 M120 12 L134 15 M124 8 L124 17 M129 10 L129 17" stroke="var(--muzzle)" stroke-width=".9" fill="none"/>
      <circle cx="116" cy="10.5" r="1.1" fill="var(--shade)"/>
      ${leg(95, 36, ...p.f, 12, 15, 4.4, 3, 'var(--coat)')}${leg(45, 30, ...p.h, 14, 16, 7, 3.2, 'var(--coat)')}
    </g>`;
  }).join('');
  return `<svg class="dog" viewBox="0 0 140 70" style="--coat:${coat}" data-f="0" aria-hidden="true">
    <ellipse cx="70" cy="66" rx="44" ry="3.5" fill="var(--shade)" opacity=".45"/>${poses}</svg>`;
}

// ---------- cavalo com jóquei ----------
function horseSVG(lane, coat) {
  const poses = POSES.map((p, k) => {
    const a = p.arch * 0.5;
    const body = 'M34 50 C36 40 52 36 74 36 C92 35 108 34 120 36 C128 38 132 46 130 56 C128 66 118 70 104 70 C88 72 62 71 46 68 C36 64 32 58 34 50 Z';
    return `<g class="p p${k}">
      ${leg(112, 58, ...p.ff, 21, 22, 7, 4.6, 'var(--coat-dark)')}${leg(46, 56, ...p.hf, 22, 24, 8, 4.6, 'var(--coat-dark)')}
      <path d="M35 46 C22 ${46 + p.tail} 12 ${54 + p.tail * 1.5} 4 ${62 + p.tail * 1.5}" stroke="var(--mane)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <g transform="translate(0 ${-a})">
        <path d="${body}" fill="var(--coat)"/>
        <path d="M44 66 C70 72 100 72 120 62 C104 70 70 68 46 62 Z" fill="var(--shade)" opacity=".3"/>
        <path d="M118 40 C126 30 136 20 146 14 L154 22 C148 34 140 46 134 58 Z" fill="var(--coat)"/>
        <path d="M146 12 L151 5 L155 12 C166 16 176 24 183 32 C184 36 180 39 176 38 C168 36 160 32 154 28 C150 26 146 24 140 24 Z" fill="var(--coat)"/>
        <path d="M120 37 C128 26 138 16 148 9" stroke="var(--mane)" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="164" cy="23" r="1.4" fill="var(--shade)"/>
        <path d="M180 31 C181 34 179 36 177 36" stroke="var(--shade)" stroke-width="1" fill="none" opacity=".6"/>
        <path d="M90 38 C98 24 112 19 124 25 C126 32 118 38 104 40 Z" fill="var(--jacket-${lane})"/>
        <path d="M96 33 L99 49 L106 50" stroke="var(--boot)" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M118 28 L138 30" stroke="var(--jacket-${lane})" stroke-width="3.2" stroke-linecap="round"/><circle cx="139" cy="30" r="1.8" fill="var(--skin-3)"/>
        <circle cx="126" cy="21" r="5" fill="var(--skin-3)"/><path d="M121 20 C121 13 131 12 132 20 Z" fill="var(--jacket-${lane})" stroke="var(--shade)" stroke-width=".6"/>
        <text x="104" y="35" class="dog__no">${lane}</text>
      </g>
      ${leg(114, 58, ...p.f, 21, 22, 7.6, 4.8, 'var(--coat)')}${leg(48, 56, ...p.h, 22, 24, 8.6, 4.8, 'var(--coat)')}
    </g>`;
  }).join('');
  return `<svg class="dog horse" viewBox="0 0 200 110" style="--coat:${coat}" data-f="0" aria-hidden="true">
    <ellipse cx="100" cy="102" rx="62" ry="4.5" fill="var(--shade)" opacity=".45"/>${poses}</svg>`;
}

// retrato de um animal parado (cards da tela de canil e haras)
export function sprite(kind, coat, lane = 1, f = 3) {
  return (kind === 'horse' ? horseSVG : dogSVG)(lane, coat).replace('data-f="0"', 'data-f="' + f + '"');
}

// ---------- quadro de apostas ----------
export function initRacing() {
  race = R.newRace(Math.random, (G.S.raceNo || 0) + 1);
  race.coats = race.dogs.map((_, i) => COATS[(i * 7 + race.no) % COATS.length]);
  buildStage();
  renderRace();
}

export function renderRace() {
  $('#race-no').textContent = `páreo ${race.no}, 6 galgos, ${R.DIST} metros, pista de areia`;
  $('#dogs').innerHTML = race.dogs.map((d, i) => `<button class="dogcard${pick === i ? ' is-on' : ''}" data-act="race-pick" data-id="${i}" aria-pressed="${pick === i}">
    <span class="jacket jacket--${d.lane}">${d.lane}</span>
    <span class="dogcard__name">${esc(d.name)}<small>forma: ${d.last.join('-')}</small></span>
    <span class="dogcard__odds"><strong>${d.odds.toFixed(1)}</strong><small>placê ${R.placeOdds(d).toFixed(1)}</small></span></button>`).join('');
  slip();
  renderHist();
}

function renderHist() {
  const hist = G.S.raceHist || [];
  $('#race-history').innerHTML = hist.length ? hist.slice(0, 6).map(h => `<li><span class="jacket jacket--${h.lane}">${h.lane}</span>${esc(h.name)}<span class="${h.won ? 'good' : 'muted'}">${h.won ? `+${int(h.won)}` : h.bet ? `−${int(h.bet)}` : ''}</span></li>`).join('')
    : '<li class="muted">Nenhum páreo corrido ainda.</li>';
}

export function slip() {
  const d = race.dogs[pick];
  const type = document.querySelector('[name="rtype"]:checked')?.value || 'win';
  const amt = Math.max(0, Math.floor(Number(document.querySelector('[name="rbet"]').value) || 0));
  $('#slip-dog').innerHTML = d ? `<span class="jacket jacket--${d.lane}">${d.lane}</span> ${esc(d.name)}` : 'Escolha um galgo no quadro.';
  const odds = d ? (type === 'win' ? d.odds : R.placeOdds(d)) : 0;
  $('#slip-pay').textContent = d ? `${int(Math.floor(amt * odds))} fichas` : '—';
  $('[data-act="race-go"]').disabled = running;
}
export function pickDog(i) { if (!running) { pick = Number(i); renderRace(); } }

// ---------- cenário (galgos ou cavalos, qualquer distância) ----------
const SPR = {
  dog: { w: 140, h: 70, ax: 70, ay: 60, k: 1, view: 17, stride: 4.8, step: 50, target: 16, svg: dogSVG },
  horse: { w: 200, h: 110, ax: 100, ay: 100, k: 0.62, view: 36, stride: 16, step: 100, target: 24, svg: horseSVG },
};
let stage = null, px = 60, borrowed = null;
const defaultSpec = () => ({ kind: 'dog', dist: R.DIST, perLen: 0.07, runners: race.dogs.map((d, i) => ({ lane: d.lane, name: d.name, coat: race.coats[i] })) });
const lanesY = () => { const H = $('#track').clientHeight; return stage.runners.map((_, j) => H * (0.45 + (j / 5) * 0.4)); };

function buildStage(spec = defaultSpec()) {
  stage = { ...spec, s: SPR[spec.kind] };
  const S = stage.s;
  $('#track').style.setProperty('--m', `calc(100cqw / ${S.view})`);
  $('#track').dataset.kind = spec.kind;
  $('#rc-world').innerHTML = `
    ${Array.from({ length: Math.ceil(spec.dist / S.step) }, (_, k) => `<span class="rc-mark" data-m="${k * S.step}"><b>${k * S.step} m</b></span>`).join('')}
    <div class="rc-traps" data-m="-1.4">${spec.runners.map(d => `<span class="rc-door jacket--${d.lane}"><b>${d.lane}</b></span>`).join('')}</div>
    <div class="rc-finish" data-m="${spec.dist}"><span class="rc-finish__post"></span></div>
    <div class="rc-lure" id="rc-lure"><span></span></div>
    ${spec.runners.map((d, i) => `<div class="runner" id="runner-${i}" style="width:${S.w}px;height:${S.h}px">${S.svg(d.lane, d.coat)}</div>`).join('')}`;
  $('#race-result').hidden = true;
  $('#rc-order').innerHTML = ''; $('#rc-clock').textContent = '0:00.0'; $('#rc-left').textContent = `${spec.dist} m`;
  place(0, spec.runners.map(() => -0.8), -30);
}

// desenha o quadro: posições em metros, câmera no líder, parallax nas camadas
function place(cam, xs, lureX) {
  const st = $('#track'), W = st.clientWidth, S = stage.s;
  px = W / S.view;
  const ys = lanesY(), H = st.clientHeight;
  for (const el of st.querySelectorAll('[data-m]')) el.style.transform = `translate3d(${(Number(el.dataset.m) - cam) * px}px,0,0)`;
  xs.forEach((x, i) => {
    const r = $(`#runner-${i}`), y = ys[i] - Math.min(1, Math.max(0, x) / 60) * (ys[i] - H * 0.47) * 0.25;   // vão encostando no trilho
    const s = (0.8 + 0.2 * ((y - H * 0.45) / (H * 0.4))) * Math.min(1, W / 1000) * S.k;
    r.style.transform = `translate3d(${(x - cam) * px - S.ax * s}px, ${y - S.ay * s}px, 0) scale(${s})`;
    r.style.zIndex = Math.round(y);
    r.firstElementChild.dataset.f = x <= 0 ? 0 : Math.floor((x / S.stride) * 4) % 4;
  });
  $('#rc-lure').style.transform = `translate3d(${(lureX - cam) * px}px,0,0)`;
  $('#rc-track').style.backgroundPositionX = `${-cam * px}px`;
  $('#rc-near').style.backgroundPositionX = `${-cam * px * 1.35}px`;
  $('#rc-stand').style.backgroundPositionX = `${-cam * px * 0.22}px`;
  $('#rc-farrail').style.backgroundPositionX = `${-cam * px}px`;
}

// posição em metros no tempo t (s de corrida oficial): arranque, ritmo com variações que somem na chegada
const ease = u => (u - 0.05 * (1 - Math.exp(-u / 0.05))) / 0.95;
function posAt(i, t, T, bumps) {
  const D = stage.dist;
  if (t <= 0) return -0.8;
  const u = t / T[i];
  if (u >= 1) return D + (t - T[i]) * (D / T[i]) * Math.max(0, 1 - (t - T[i]) / 4);
  const b = bumps[i];
  return D * ease(u) + b.a * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * b.k * u + b.p);
}

// toda a cena da corrida: lebre, boxes, prova com câmera e photo finish. Quem chama decide o resultado (order/T).
export async function playRace(spec, order, T) {
  buildStage(spec);
  const st = $('#track'), S = stage.s, D = stage.dist, runners = spec.runners;
  const speed = S.target / Math.max(...T), lureV = (D / Math.min(...T)) * 1.05;
  const bumps = runners.map(() => ({ a: (1.2 + Math.random() * 2.2) * (D / 480), k: 1 + Math.random() * 1.5, p: Math.random() * 6 }));
  st.classList.add('is-live');

  // a lebre vem por trás e passa pelos boxes; aí as portas abrem
  call('A lebre está chegando...');
  sfx.crowd(true, 0.3);
  await anim(ms(2600), k => place(0, runners.map(() => -0.8), -30 + k * 34));
  st.classList.add('is-open'); sfx.play('ball', 0.7); call('Abriram os boxes!');
  sfx.crowd(true, 0.6);

  const t0 = performance.now(), last = Math.max(...T) + 2.5;
  const marks = [Math.round((D * 0.42) / 10) * 10, Math.round((D * 0.8) / 10) * 10];
  let lastLead = -1; const said = new Set();
  await new Promise(done => {
    const step = now => {
      const t = ((now - t0) / 1000) / speed;
      const xs = runners.map((_, i) => posAt(i, t, T, bumps));
      const lead = xs.indexOf(Math.max(...xs)), lx = Math.min(xs[lead], D + 4);
      const cam = Math.max(-3, Math.min(lx - S.view * 0.62, D - S.view * 0.72));
      place(cam, xs, Math.max(lx + S.view * 0.19, 4 + t * lureV));
      const pos = [...xs.keys()].sort((x, y) => xs[y] - xs[x]);
      $('#rc-order').innerHTML = pos.map(i => `<span class="jacket jacket--${runners[i].lane}">${runners[i].lane}</span>`).join('');
      const tt = Math.min(t, T[lead]);
      $('#rc-clock').textContent = `${Math.floor(tt / 60)}:${(tt % 60).toFixed(1).padStart(4, '0')}`;
      $('#rc-left').textContent = `${Math.max(0, Math.round(D - lx))} m`;
      $('#rc-map').innerHTML = xs.map((x, i) => `<i class="jacket--${runners[i].lane}" style="left:${Math.min(100, Math.max(0, (x / D) * 100))}%"></i>`).join('');
      if (lead !== lastLead && t > 2 && t < T[lead] - 1) { lastLead = lead; call(`${runners[lead].name} assume a ponta!`); }
      [[marks[0], `Passam pelos ${marks[0]} metros`], [marks[1], 'Entrando na reta final!']].forEach(([m, txt], k) => {
        if (lx > m && !said.has(m)) { said.add(m); call(`${txt}, ${runners[lead].name} na frente`); sfx.crowd(true, k ? 1 : 0.75); }
      });
      if (t < last) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  sfx.crowd(false);
  st.classList.remove('is-live', 'is-open');

  const gap = T[order[1]] - T[order[0]];
  if (gap < 0.05 * (spec.perLen / 0.07)) { st.classList.add('is-photo'); call('Photo finish!'); await sleep(1600); st.classList.remove('is-photo'); }
  return gap;
}

// a mesma pista pode aparecer numa janela (provas dos seus animais): empresta o palco e devolve depois
export function borrowStage(host) {
  const el = $('#track');
  borrowed = { parent: el.parentNode, next: el.nextSibling };
  host.append(el);
  return el;
}
export function returnStage() {
  if (!borrowed) return;
  const el = $('#track');
  borrowed.parent.insertBefore(el, borrowed.next); borrowed = null;
  buildStage();
}

// ---------- largada ----------
export async function go() {
  if (running) return;
  if (pick === null) return say('Escolha um galgo no quadro.', true);
  const amount = Math.floor(Number(document.querySelector('[name="rbet"]').value) || 0);
  if (amount < 10) return say('A aposta mínima é 10 fichas.', true);
  if (amount > G.S.chips) return say('Fichas insuficientes. Compre no caixa do cassino.', true);
  const bet = { dog: pick, type: document.querySelector('[name="rtype"]:checked').value, amount };
  G.S.chips -= amount; save(); G.render();
  running = true; slip();
  document.querySelectorAll('.dogcard').forEach(b => { b.disabled = true; });
  $('#track').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'center' });

  const order = R.runRace(race), T = R.officialTimes(order);
  const gap = await playRace(defaultSpec(), order, T);

  const won = R.payout(race, order, bet);
  G.S.chips += won;
  G.S.raceNo = race.no;
  G.S.stats.races++;
  const d = race.dogs[bet.dog], w = race.dogs[order[0]];
  note(`corrida, páreo ${race.no}: ${won ? `ganhou ${int(won)}` : `perdeu ${int(amount)}`} fichas em ${d.name}`);
  G.S.raceHist = [{ lane: w.lane, name: w.name, won, bet: won ? 0 : amount }, ...(G.S.raceHist || [])].slice(0, 12);
  award('race');
  if (won) { G.S.stats.raceWins++; award('raceWin'); confetti(won >= amount * 3 ? 90 : 40); sfx.play('stack', 0.7); }

  const res = $('#race-result');
  res.hidden = false;
  res.innerHTML = `<p class="res__head">${esc(w.name)} vence ${R.margin(gap)}</p>
    <ol class="res__table">${order.map((i, k) => `<li><span class="res__pos">${k + 1}º</span><span class="jacket jacket--${race.dogs[i].lane}">${race.dogs[i].lane}</span>
      <span class="res__name">${esc(race.dogs[i].name)}</span><span class="res__time">${T[i].toFixed(2)} s</span><span class="res__gap">${k ? `+${(T[i] - T[order[0]]).toFixed(2)}` : ''}</span></li>`).join('')}</ol>
    <p class="${won ? 'good' : 'muted'}">${won ? `Seu bilhete pagou ${int(won)} fichas.` : `${esc(d.name)} não chegou lá. −${int(amount)} fichas.`}</p>
    <button class="btn btn--gold" data-act="race-next">próximo páreo</button>`;
  renderHist(); save(); G.render();
}

function call(t) { G.callout?.(t); }
function anim(dur, fn) {
  return new Promise(res => {
    if (!dur) { fn(1); return res(); }
    const t0 = performance.now();
    const f = now => { const k = Math.min(1, (now - t0) / dur); fn(k); k < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  });
}

export function nextRace() {
  running = false; pick = null;
  race = R.newRace(Math.random, (G.S.raceNo || 0) + 1);
  race.coats = race.dogs.map((_, i) => COATS[(i * 7 + race.no) % COATS.length]);
  buildStage(); renderRace();
}
export function relayout() { if (race && !running && !borrowed) buildStage(); }
addEventListener('resize', () => { if (race && !running && !borrowed) buildStage(); });
