import * as L from './logic.js';
import * as P from './progress.js';
import { CATALOG, avatarSVG } from './avatar.js';
import { G, $, esc, brl, int, RM, say, save, note, pay, award, checkAch, confetti, today, yesterday, reset, profileOf, levelUp } from './store.js';
import * as C from './casino.js';
import * as RC from './racing.js';
import * as sfx from './sfx.js';
import * as GM from './games.js';
import * as AV from './aviator.js';
import * as RL from './roulette.js';
import * as TR from './trader.js';
import * as Auth from './auth.js';
import * as Live from './live.js';
import * as ST from './stable.js';
import * as SUI from './stable-ui.js';
import * as JUI from './jobs-ui.js';
import * as FUI from './futebol-ui.js';
import * as TUI from './trade-ui.js';
import * as TD from './trade.js';

const S = () => G.S;

// saves antigos: completa os campos novos das terras
for (const l of [...G.S.lands, ...G.S.offers]) {
  const r = L.region(l.region);
  l.uf ??= r.uf; l.use ??= r.use; l.water ??= 'rio'; l.improv ??= [];
  if (l.lat == null) { let k = l.id * 9301 + 49297; Object.assign(l, L.placeLot(r, () => ((k = (k * 9301 + 49297) % 233280) / 233280))); }
}

// ---------- números do topo rolando ----------
const shownNum = new Map();
function rollTo(el, to, fmt) {
  const from = shownNum.has(el) ? shownNum.get(el) : to;
  shownNum.set(el, to);
  if (from === to || RM.matches) { el.textContent = fmt(to); return; }
  el.classList.remove('up', 'down'); void el.offsetWidth;
  el.classList.add(to > from ? 'up' : 'down');
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / 700), e = 1 - (1 - k) ** 3;
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderPass() {
  const s = S(), tier = P.passTier(s), into = (s.pass.xp % P.PASS_XP) / P.PASS_XP;
  const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  $('#ps-sub').textContent = `Temporada de ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Termina em ${Math.ceil((end - Date.now()) / 864e5)} dias. Todo XP ganho no jogo avança o passe.`;
  $('#ps-bar').style.transform = `scaleX(${tier >= P.PASS_TIERS ? 1 : into})`;
  $('#ps-xp').textContent = tier >= P.PASS_TIERS ? 'Passe completo!' : `nível ${tier}, faltam ${P.PASS_XP - (s.pass.xp % P.PASS_XP)} XP para o ${tier + 1}`;
  $('#ps-track').innerHTML = Array.from({ length: P.PASS_TIERS }, (_, k) => {
    const t = k + 1, r = P.passReward(t), got = s.pass.claimed.includes(t), open = t <= tier;
    return `<li class="ps-t${got ? ' is-got' : open ? ' is-open' : ''}${t % 10 === 0 ? ' is-big' : ''}"><small>${t}</small><b>${r.kind === 'chips' ? `${int(r.amount)} fichas` : brl(r.amount)}</b>
      ${got ? '<span class="tag tag--dark">resgatado</span>' : open ? `<button class="btn btn--gold btn--sm" data-act="pass-claim" data-id="${t}">resgatar</button>` : ''}</li>`;
  }).join('');
}

function renderHud() {
  const s = S(), worth = L.netWorth(s);
  $('#r-month').textContent = s.month;
  rollTo($('#r-money'), s.money, brl);
  rollTo($('#r-chips'), s.chips, int);
  rollTo($('#r-worth'), worth, brl);
  rollTo($('#chips-now'), s.chips, v => `${int(v)} fichas`);
  rollTo($('#table-chips'), s.chips, int);
  $('#chips-val').textContent = `valem ${brl(s.chips * L.CHIP)}`;
  $('#hud-avatar').innerHTML = avatarSVG(s.avatar, { label: 'seu personagem' });
  $('#hud-name').textContent = s.avatar.name || 'você';
  $('#hud-rank').textContent = $('#char-rank').textContent = L.rank(worth);
  $('#hud-level').textContent = s.level;
  $('#hud-ring').style.setProperty('--p', s.xp / P.xpNeed(s.level));
  P.passEnsure(s, today().slice(0, 7));
  const ptier = P.passTier(s);
  $('#pass-tier').textContent = ptier;
  $('#pass-badge').hidden = !Array.from({ length: ptier }, (_, k) => k + 1).some(t => !s.pass.claimed.includes(t));
  const ready = s.missions.list.filter(m => !m.claimed && m.prog >= P.MISSIONS.find(x => x.id === m.id).goal).length;
  $('#missions-badge').hidden = !ready;
  $('#missions-badge').textContent = ready;
}

// ---------- missões e bônus ----------
function missionsHTML() {
  return S().missions.list.map(m => {
    const d = P.MISSIONS.find(x => x.id === m.id), done = m.prog >= d.goal;
    return `<li class="mi${done ? ' is-done' : ''}${m.claimed ? ' is-claimed' : ''}">
      <div class="mi__txt"><strong>${esc(d.txt)}</strong><span class="muted small">${m.prog} de ${d.goal}, prêmio ${int(d.reward)} fichas</span>
      <span class="bar"><i style="transform:scaleX(${m.prog / d.goal})"></i></span></div>
      ${m.claimed ? '<span class="tag tag--dark">resgatado</span>' : done ? `<button class="btn btn--gold btn--sm" data-act="claim-mission" data-id="${m.id}">resgatar</button>` : ''}</li>`;
  }).join('');
}
function streakHTML(streak, claimedToday) {
  const cur = ((Math.max(1, streak) - 1) % 7) + 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = i + 1, state = d < cur || (d === cur && claimedToday) ? 'is-got' : d === cur ? 'is-now' : '';
    return `<div class="day ${state}"><small>dia ${d}</small><strong>+${(d - 1) * 10}%</strong></div>`;
  }).join('');
}
const streakBonus = streak => 1 + Math.min(6, ((Math.max(1, streak) - 1) % 7)) * 0.1;
function renderMissions() {
  $('#missions-mini').innerHTML = missionsHTML();
  $('#missions-full').innerHTML = missionsHTML();
  $('#streak-mini').innerHTML = streakHTML(S().daily.streak || 1, S().daily.last === today());
}
let dwAngle = 0;
function drawDailyWheel() {
  const n = GM.DAILY_WHEEL.length, seg = 360 / n, pt = (a, r) => [150 + r * Math.sin((a * Math.PI) / 180), 150 - r * Math.cos((a * Math.PI) / 180)];
  $('#dw-wheel').innerHTML = `<svg viewBox="0 0 300 300" aria-label="roda de prêmios"><g id="dw-rot">${GM.DAILY_WHEEL.map((s, i) => {
    const [x1, y1] = pt(i * seg - seg / 2, 140), [x2, y2] = pt(i * seg + seg / 2, 140), [tx, ty] = pt(i * seg, 92);
    return `<path d="M150 150 L${x1} ${y1} A140 140 0 0 1 ${x2} ${y2} Z" class="dw-seg dw-seg--${i % 4}"/>
      <text x="${tx}" y="${ty}" transform="rotate(${i * seg} ${tx} ${ty})" class="dw-txt">${s.label}</text>`;
  }).join('')}<circle cx="150" cy="150" r="140" class="dw-rim"/>${Array.from({ length: n }, (_, i) => { const [x, y] = pt(i * seg - seg / 2, 140); return `<circle cx="${x}" cy="${y}" r="4" class="dw-bulb"/>`; }).join('')}</g>
    <circle cx="150" cy="150" r="26" class="dw-hub"/><text x="150" y="155" class="dw-hubtxt">21</text></svg>`;
}
function maybeDaily() {
  const st = P.dailyStatus(S(), today(), yesterday());
  if (!st) return;
  drawDailyWheel();
  $('#streak').innerHTML = streakHTML(st.streak, false);
  $('#dl-sub').textContent = st.streak > 1 ? `${st.streak} dias seguidos: prêmio +${Math.round((streakBonus(st.streak) - 1) * 100)}%. Um giro por dia, todo prêmio é bom.` : 'Um giro por dia, todo prêmio é bom. Volte amanhã e o prêmio cresce.';
  $('#dw-btn').textContent = 'girar'; $('#dw-btn').disabled = false; $('#dw-btn').dataset.act = 'spin-daily';
  $('#dlg-daily').showModal();
}
async function spinDaily() {
  const st = P.dailyStatus(S(), today(), yesterday());
  if (!st) return;
  const btn = $('#dw-btn'); btn.disabled = true;
  const i = GM.spinDaily(), seg = 360 / GM.DAILY_WHEEL.length;
  const target = dwAngle + 360 * 6 + ((360 - i * seg - (dwAngle % 360)) % 360 + 360) % 360;
  sfx.play('ball', 0.3);
  await $('#dw-rot').animate([{ transform: `rotate(${dwAngle}deg)` }, { transform: `rotate(${target}deg)` }],
    { duration: RM.matches ? 0 : 5200, easing: 'cubic-bezier(.12,.7,.18,1)', fill: 'forwards' }).finished;
  dwAngle = target;
  P.claimDaily(S(), today(), yesterday(), false);   // só registra a sequência; o prêmio vem da roda
  const prize = GM.DAILY_WHEEL[i], mult = streakBonus(S().daily.streak) * Live.CFG.daily_mult, amt = Math.round(prize.amount * mult);
  let txt;
  if (prize.kind === 'chips') { S().chips += amt; txt = `${int(amt)} fichas`; }
  if (prize.kind === 'money') { S().money += amt; note('roleta de prêmios do dia', amt); txt = brl(amt); }
  if (prize.kind === 'calves') { S().herd.push({ id: S().nextId++, heads: amt, kg: 180 }); txt = `${amt} bezerros no seu rebanho`; }
  if (prize.kind === 'xp') { P.addXp(S(), amt).forEach(levelUp); txt = `${int(amt)} XP`; }
  sfx.play('stack', 0.7); confetti(110);
  $('#dl-sub').innerHTML = `<strong class="dw-win">Você ganhou ${txt}!</strong>${mult > 1 ? ` Bônus de sequência +${Math.round((mult - 1) * 100)}%.` : ''} Volte amanhã.`;
  $('#streak').innerHTML = streakHTML(S().daily.streak, true);
  btn.textContent = 'resgatar'; btn.disabled = false; btn.dataset.act = 'close-daily';
  checkAch(); save(); render();
}

// ---------- personagem ----------
function renderChar() {
  const a = S().avatar;
  $('#char-preview').innerHTML = avatarSVG(a, { label: 'seu personagem' });
  $('#char-name-show').textContent = a.name || 'você';
  if (document.activeElement !== $('#char-name')) $('#char-name').value = a.name || '';
  $('#wardrobe').innerHTML = Object.entries(CATALOG).map(([k, g]) => `
    <fieldset class="opts"><legend>${g.label}</legend>
      ${g.opts.map(o => {
        const on = String(a[k]) === String(o.id), locked = o.price && !S().owned.includes(`${k}:${o.id}`);
        return `<button class="opt${o.swatch ? ' opt--sw' : ''}${on ? ' is-on' : ''}" aria-pressed="${on}" data-act="look" data-k="${k}" data-id="${o.id}"
          ${o.swatch ? `style="--sw:${o.swatch}" aria-label="${g.label} ${o.id}"` : ''}>${o.swatch ? '' : esc(o.id)}${locked ? `<small>${brl(o.price)}</small>` : ''}</button>`;
      }).join('')}
    </fieldset>`).join('');
}

// ---------- terras: satélite real (Esri World Imagery) ----------
const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
const LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer';
// metade do lado do lote em graus (lote quadrado com a área em hectares)
function lotHalf(l) { const m = Math.sqrt(l.ha * 1e4) / 2; return { dLat: m / 111320, dLon: m / (111320 * Math.cos((l.lat * Math.PI) / 180)) }; }
const lotBounds = l => { const { dLat, dLon } = lotHalf(l); return [[l.lat - dLat, l.lon - dLon], [l.lat + dLat, l.lon + dLon]]; };
// foto de satélite do próprio lote: recorte 1,6:1 com o lote ocupando ~40% da altura
function satThumb(l) {
  const { dLat, dLon } = lotHalf(l), k = 2.5, hLat = dLat * k, hLon = dLon * k * 1.6;
  const url = `${SAT}/export?bbox=${l.lon - hLon},${l.lat - hLat},${l.lon + hLon},${l.lat + hLat}&bboxSR=4326&imageSR=3857&size=480,300&format=jpg&f=image`;
  return { url, w: 100 / (k * 1.6), h: 100 / k };
}
const KIND_COLOR = { offer: '--print-gold', own: '--money', rent: '--violet' };

function landCard(l, kind) {
  const s = S();
  const badge = { offer: ['à venda', 'gold'], own: [l.leasedOut ? 'arrendada a terceiros' : 'sua', l.leasedOut ? 'violet' : 'green'], rent: ['arrendada de terceiros', 'violet'] }[kind];
  const facts = [`${l.use}`, l.water, ...(l.improv || [])].map(t => `<span class="tag tag--dark">${esc(t)}</span>`).join('');
  let crop = '';
  if (kind !== 'offer' && !l.leasedOut) {
    if (l.crop) {
      const c = L.CROPS[l.crop.type], k = 1 - l.crop.left / c.months;
      crop = `<div class="crop"><span class="small">${c.label} plantada, colhe em ${l.crop.left} ${l.crop.left === 1 ? 'mês' : 'meses'}</span><span class="bar"><i style="transform:scaleX(${k})"></i></span></div>`;
    } else {
      crop = `<div class="crop row"><label class="visually-hidden" for="crop-${l.id}">lavoura</label>
        <select class="input input--crop" id="crop-${l.id}">${Object.entries(L.CROPS).map(([k, c]) => `<option value="${k}">${c.label}: ${brl(L.plantCost(s, k, l.ha))}</option>`).join('')}</select>
        <button class="btn btn--glass btn--sm" data-act="plant" data-id="${l.id}">plantar</button></div>`;
    }
  }
  const acts = kind === 'offer'
    ? `<button class="btn btn--gold" data-act="buy-land" data-id="${l.id}">comprar</button><button class="btn btn--glass" data-act="rent-land" data-id="${l.id}">arrendar</button>`
    : kind === 'own'
      ? `<button class="btn btn--glass" data-act="lease" data-id="${l.id}" ${l.crop ? 'disabled' : ''}>${l.leasedOut ? 'retomar' : 'arrendar a terceiros'}</button><button class="btn btn--glass" data-act="sell-land" data-id="${l.id}">vender</button>`
      : `<button class="btn btn--glass" data-act="return-land" data-id="${l.id}" ${l.crop ? 'disabled' : ''}>devolver</button>`;
  const money = kind === 'rent' ? `${brl(l.value * L.RENT_PAY)}<small>/mês</small>` : brl(l.value);
  const sub = kind === 'own' && l.leasedOut ? `recebe ${brl(l.value * L.RENT_GET)}/mês` : kind === 'offer' ? `arrendamento ${brl(l.value * L.RENT_PAY)}/mês, ${brl(l.value / l.ha)}/ha` : `lotação ${L.landCap(l)} cabeças`;
  const t = satThumb(l), reg = L.region(l.region);
  return `<article class="lcard" data-pin="${l.id}">
    <button class="scene sat" data-act="map-lot" data-id="${l.id}" aria-label="ver o lote no mapa" style="background-image:url('${t.url}')">
      <span class="lotbox lotbox--${kind}" style="left:${50 - t.w / 2}%;top:${50 - t.h / 2}%;width:${t.w}%;height:${t.h}%"></span>
      <span class="tag tag--${badge[1]}">${badge[0]}</span><span class="tag tag--dark">${l.ha} ha</span>
      <span class="sat__coord">${l.lat.toFixed(4)}, ${l.lon.toFixed(4)}</span></button>
    <div class="lcard__body">
      <h4>${esc(l.region)}</h4><p class="muted small">perto de ${esc(reg.city)}</p>
      <p class="price">${money}</p>
      <p class="muted small">${sub}</p>
      <div class="facts">${facts}</div>
      ${crop}
      <div class="lcard__acts">${acts}</div>
    </div></article>`;
}

function renderTerras() {
  const s = S(), own = s.lands.filter(l => l.own), rent = s.lands.filter(l => !l.own);
  $('#lands').innerHTML = s.lands.length ? [...own.map(l => landCard(l, 'own')), ...rent.map(l => landCard(l, 'rent'))].join('')
    : '<p class="empty glass">Nenhuma terra ainda. Compre ou arrende uma das ofertas abaixo.</p>';
  $('#lands-sum').textContent = own.length ? `${own.reduce((a, l) => a + l.ha, 0)} ha próprios, valem ${brl(own.reduce((a, l) => a + l.value, 0))}` : '';
  $('#offers').innerHTML = s.offers.length ? s.offers.map(o => landCard(o, 'offer')).join('') : '<p class="empty glass">Sem ofertas neste mês.</p>';
  drawLots();
}

let lmap, lots;
function initMap() {
  const LF = window.L;
  if (lmap || !LF) { lmap?.invalidateSize(); return; }
  lmap = LF.map('map', { zoomControl: true, worldCopyJump: true }).setView([-14, -51], 4);
  LF.tileLayer(`${SAT}/tile/{z}/{y}/{x}`, { maxZoom: 18, attribution: 'Imagens © Esri, Maxar, Earthstar Geographics' }).addTo(lmap);
  LF.tileLayer(`${LABELS}/tile/{z}/{y}/{x}`, { maxZoom: 18, opacity: 0.85 }).addTo(lmap);
  lots = LF.layerGroup().addTo(lmap);
  drawLots();
}
function drawLots() {
  const LF = window.L;
  if (!lmap || !LF) return;
  lots.clearLayers();
  const css = getComputedStyle(document.documentElement);
  const all = [...S().offers.map(l => [l, 'offer']), ...S().lands.map(l => [l, l.own ? 'own' : 'rent'])];
  for (const [l, kind] of all) {
    const color = css.getPropertyValue(KIND_COLOR[kind]).trim();
    const pop = `<strong>${esc(l.region)}</strong><br>${l.ha} ha, ${kind === 'offer' ? brl(l.value) : kind === 'own' ? 'sua' : 'arrendada'}<br><button class="btn btn--gold btn--sm" data-act="show-card" data-id="${l.id}">ver ficha</button>`;
    const rect = LF.rectangle(lotBounds(l), { color, weight: 2, fillOpacity: 0.18 }).bindPopup(pop);
    const dot = LF.circleMarker([l.lat, l.lon], { radius: 7, color: 'transparent', fillColor: color, fillOpacity: 0.95 }).bindPopup(pop);
    dot.on('click', () => lmap.flyToBounds(lotBounds(l), { padding: [80, 80], maxZoom: 16, duration: 1.6 }));
    rect.on('click', () => lmap.flyToBounds(lotBounds(l), { padding: [80, 80], maxZoom: 16, duration: 1.6 }));
    lots.addLayer(rect).addLayer(dot);
  }
}
function flyToLot(id) {
  const l = [...S().offers, ...S().lands].find(x => String(x.id) === String(id));
  if (!l) return;
  $('#p-terras').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
  initMap();
  lmap?.flyToBounds(lotBounds(l), { padding: [80, 80], maxZoom: 16, duration: RM.matches ? 0 : 1.8 });
  $('#map-title').textContent = `${l.region}, ${l.ha} ha`;
}

// ---------- gado ----------
function renderGado() {
  const s = S(), n = L.heads(s), cap = L.capacity(s);
  const avg = n ? s.herd.reduce((a, h) => a + h.heads * h.kg, 0) / n : 0;
  $('#herd-stats').innerHTML = [
    ['cabeças', int(n)], ['pasto livre', `${int(Math.max(0, cap - n))} de ${int(cap)}`], ['peso médio', n ? `${int(avg)} kg` : '—'], ['valor do rebanho', brl(L.herdValue(s))],
  ].map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  $('#herd-warn').hidden = n <= cap;
  $('#herd-warn').textContent = `${int(n - cap)} cabeças sem pasto: cada uma custa R$ 150 de ração por mês e engorda menos.`;
  $('#calf-price').textContent = `${brl(s.prices.bezerro)} por bezerro de 180 kg${L.hasVehicle(s, 'caminhao') ? '. Seu caminhão leva o gado sem taxa.' : ''}`;
  $('#herd').innerHTML = s.herd.length ? s.herd.map((h, i) => {
    const val = h.heads * L.arrobas(h.kg) * s.prices.arroba, k = Math.min(1, (h.kg - 180) / (450 - 180));
    return `<article class="glass hcard">
      <img class="hcard__photo" src="assets/${k >= 1 ? 'farm-pasto2' : 'farm-pasto'}.webp" alt="" loading="lazy">
      <div class="hcard__top"><h4>lote ${i + 1}</h4><span class="tag ${k >= 1 ? 'tag--green' : 'tag--dark'}">${k >= 1 ? 'pronto para abate' : `${int(h.kg)} kg`}</span></div>
      <p class="price">${brl(val)}</p>
      <p class="muted small">${h.heads} cabeças, ${L.arrobas(h.kg).toFixed(1)} @ cada</p>
      <div class="bar" role="img" aria-label="${Math.round(k * 100)}% do peso de abate"><i style="transform:scaleX(${k})"></i></div>
      <button class="btn btn--glass" data-act="sell-herd" data-id="${h.id}">vender lote</button></article>`;
  }).join('') : '<p class="empty glass">Sem rebanho. Dê um lance no leilão de bezerros e engorde no seu pasto.</p>';
}

// ---------- mercado ----------
const GOODS = { soja: 'soja', milho: 'milho', cafe: 'café', arroba: 'boi gordo', bezerro: 'bezerro' };
const PHOTO = { soja: 'farm-soja', milho: 'farm-colheita', cafe: 'farm-cafe', arroba: 'farm-pasto2', bezerro: 'farm-bezerro' };
const UNIT = { soja: 'saca 60 kg', milho: 'saca 60 kg', cafe: 'saca 60 kg', arroba: 'arroba', bezerro: 'cabeça' };
function renderMercado() {
  const s = S();
  $('#goods').innerHTML = Object.entries(GOODS).map(([k, label]) => {
    const pv = s.prev?.[k] ?? s.prices[k], ch = (s.prices[k] / pv - 1) * 100, trade = k in s.stock;
    return `<article class="glass tcard">
      <img class="tcard__photo" src="assets/${PHOTO[k]}.webp" alt="" loading="lazy">
      <div class="tcard__top"><h4>${label}</h4><span class="delta ${ch > 0 ? 'is-up' : ch < 0 ? 'is-down' : ''}">${ch > 0 ? '▲' : ch < 0 ? '▼' : '='} ${Math.abs(ch).toFixed(1)}%</span></div>
      <p class="price">${brl(s.prices[k])}<small> / ${UNIT[k]}</small></p>
      ${trade ? `<p class="muted small">no armazém: ${int(s.stock[k])} sacas, valem ${brl(s.stock[k] * s.prices[k])}</p>
      <div class="row"><label class="visually-hidden" for="q-${k}">quantidade de ${label}</label>
        <input class="input input--s" id="q-${k}" name="q-${k}" type="number" min="1" value="${Math.max(10, s.stock[k])}" inputmode="numeric">
        <button class="btn btn--glass" data-act="buy-good" data-id="${k}">comprar</button>
        <button class="btn btn--glass" data-act="sell-good" data-id="${k}">vender</button></div>`
      : `<p class="muted small">${k === 'arroba' ? 'Preço da venda do seu gado.' : 'Preço do leilão de bezerros.'}</p>`}
    </article>`;
  }).join('');
}

// ---------- concessionária: fotos reais, nomes de paródia ----------
const carImg = c => `assets/${c.img}.webp`;
function renderCarros() {
  const s = S();
  $('#showroom').innerHTML = Object.entries(L.CARS).map(([id, c]) => {
    const owned = s.cars.some(x => x.model === id);
    return `<article class="glass ccard">
      <div class="ccard__photo"><img src="${carImg(c)}" alt="${esc(c.name)}" loading="lazy">
        <span class="tag ${c.perk ? 'tag--green' : c.price > 1e6 ? 'tag--violet' : 'tag--dark'}">${c.cat}</span>${owned ? '<span class="tag tag--gold ccard__own">na garagem</span>' : ''}</div>
      <div class="ccard__body">
        <h4>${esc(c.name)}</h4>
        <p class="price">${brl(c.price)}</p>
        <dl class="specs"><div><dt>potência</dt><dd>${c.hp} cv</dd></div><div><dt>máxima</dt><dd>${c.top} km/h</dd></div><div><dt>IPVA e seguro</dt><dd>${brl(c.price * L.CAR_UPKEEP)}/mês</dd></div></dl>
        ${c.perk ? `<p class="small good">${esc(c.perk)}</p>` : ''}
        <button class="btn btn--gold" data-act="buy-car" data-id="${id}">comprar</button>
      </div></article>`;
  }).join('');
  $('#garage').innerHTML = s.cars.length ? s.cars.map(car => {
    const c = L.CARS[car.model], lost = 1 - car.value / c.price;
    return `<article class="glass ccard ccard--own">
      <div class="ccard__photo"><img src="${carImg(c)}" alt="${esc(c.name)}" loading="lazy"><span class="tag tag--green">sua</span></div>
      <div class="ccard__body"><h4>${esc(c.name)}</h4>
        <p class="price">${brl(car.value)}</p><p class="muted small">pagou ${brl(c.price)}, desvalorizou ${(lost * 100).toFixed(1)}%. A loja recompra por ${brl(car.value * L.CAR_BUYBACK)}.</p>
        <button class="btn btn--glass" data-act="sell-car" data-id="${car.id}">vender</button></div></article>`;
  }).join('') : '<p class="empty glass">Garagem vazia. Seu primeiro carro aparece aqui e no seu perfil.</p>';
}

// ---------- banco ----------
function renderBanco() {
  const s = S();
  rollTo($('#credit'), L.creditLimit(s), brl);
  $('#loans').innerHTML = s.loans.length ? s.loans.map(l => `<tr>
    <td class="num">${brl(l.bal)}</td><td class="num">${(l.rate * 100).toFixed(1)}%</td><td class="num">${l.left}</td>
    <td>${l.missed ? '<span class="tag tag--red">atrasada</span>' : '<span class="tag tag--green">em dia</span>'}</td>
    <td class="acts"><button class="btn btn--glass" data-act="payoff" data-id="${l.id}">quitar</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">Nenhuma dívida.</td></tr>';
  $('#borrowers').innerHTML = s.borrowers.length ? s.borrowers.map(b => {
    const look = { skin: (b.id % 5) + 1, hair: ['curto', 'longo', 'coque', 'raspado', 'boné'][b.id % 5], hairColor: (b.id % 4) + 1, outfit: ['moletom', 'regata', 'jaqueta'][b.id % 3], cloth: (b.id % 6) + 1, acc: 'nenhum' };
    return `<article class="glass bcard">
      <span class="bcard__avatar">${avatarSVG(look, { label: b.name })}</span>
      <div><h4>${esc(b.name)}</h4><p class="price">${brl(b.amount)}</p>
      <p class="muted small">${(b.rate * 100).toFixed(1)}% ao mês em ${b.months} meses</p>
      <p class="small"><span class="tag ${b.risk > 0.09 ? 'tag--red' : b.risk > 0.05 ? 'tag--gold' : 'tag--green'}">risco ${Math.round(b.risk * 100)}%/mês</span></p></div>
      <button class="btn btn--glass" data-act="lend" data-id="${b.id}">emprestar</button></article>`;
  }).join('') : '<p class="empty glass">Ninguém pedindo empréstimo este mês.</p>';
  $('#lent').innerHTML = s.lent.length ? s.lent.map(p => `<tr>
    <td>${esc(p.name)}</td><td class="num">${brl(p.bal)}</td><td class="num">${(p.rate * 100).toFixed(1)}%</td><td class="num">${p.left}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">Você ainda não emprestou para ninguém.</td></tr>';
}

function renderLivro() {
  const s = S();
  $('#log').innerHTML = s.log.length ? s.log.slice(0, 80).map(e => `<tr>
    <td class="num">${e.m}</td><td>${esc(e.txt)}</td><td class="num ${e.val < 0 ? 'bad' : e.val > 0 ? 'good' : ''}">${e.val ? brl(e.val) : ''}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">Nada lançado ainda. Jogue uma mão ou passe o mês.</td></tr>';
}

// ---------- perfil ----------
function openProfile(pid) {
  if (!pid) return;
  const p = C.findProfile(pid);
  if (!p) return say('Perfil indisponível: o jogador saiu.', true);
  const me = pid === 'me', st = p.stats || {};
  const rate = st.hands ? Math.round((st.wins / st.hands) * 100) : 0;
  const xp = me ? `<div class="pf__xp"><span class="small">nível ${p.level}, ${S().xp} de ${P.xpNeed(S().level)} XP</span><span class="bar"><i style="transform:scaleX(${S().xp / P.xpNeed(S().level)})"></i></span></div>` : '';
  $('#pf').innerHTML = `
    <div class="pf__head">
      <span class="pf__avatar">${avatarSVG(p.look, { label: p.name })}</span>
      <div><h2 id="pf-name">${esc(p.name)}</h2><p><span class="tag tag--gold">nível ${p.level}</span> <span class="tag tag--dark">${esc(p.rank)}</span></p>
      <p class="big">${brl(p.worth)}</p><p class="muted small">patrimônio</p>${xp}</div>
    </div>
    <div class="pf__stats">
      ${[['mãos de 21', int(st.hands || 0)], ['vitórias', `${int(st.wins || 0)} (${rate}%)`], ['maior prêmio', `${int(st.best || 0)} fichas`], ['corridas', `${int(st.races || 0)}, ${int(st.raceWins || 0)} acertos`],
        ['terras', `${p.lands} (${int(p.ha)} ha)`], ['gado', `${int(p.heads)} cabeças`], ['canil e haras', `${(p.animals || []).length} animais`]].map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('')}
    </div>
    <h3>garagem</h3>
        <div class="pf__cars">${(p.cars || []).length ? p.cars.map(m => L.CARS[m] ? `<span class="pf__car"><img src="assets/${L.CARS[m].img}.webp" alt=""><small>${esc(L.CARS[m].name)}</small></span>` : '').join('') : '<p class="muted small">Sem carros ainda.</p>'}</div>
    <h3>conquistas ${p.ach?.length || 0} de ${P.ACHIEVEMENTS.length}</h3>
    <ul class="achs">${P.ACHIEVEMENTS.map(a => `<li class="${p.ach?.includes(a.id) ? 'is-got' : ''}"><span class="badge__medal" aria-hidden="true"></span>${esc(a.txt)}</li>`).join('')}</ul>
    ${!me && TUI.online().some(x => x.pid === pid) ? `<div class="pf__acts"><button class="btn btn--gold" data-act="trade-invite" data-id="${esc(pid)}">propor troca</button></div>` : ''}
    ${me ? `<div class="pf__acts"><button class="btn btn--glass" data-act="edit-char">editar personagem</button>${Auth.account() ? '<button class="btn btn--glass" data-act="logout">sair da conta</button><button class="btn btn--danger btn--sm" data-act="wipe">apagar meus dados</button>' : ''}</div>${Auth.account() ? `<p class="muted small">Conta: ${esc(Auth.account().email)}</p>` : ''}` : ''}`;
  const dlg = $('#dlg-profile');
  if (!dlg.open) dlg.showModal();
}

// inventário: tudo o que o jogador tem, e quem está online para negociar
function renderInv() {
  const items = TD.inventory(S());
  const total = items.reduce((t, i) => t + (i.value || 0), 0);
  $('#inv-sum').textContent = `${items.length} itens trocáveis, ${int(S().chips)} fichas e ${brl(S().money)} em dinheiro`;
  $('#inv-items').innerHTML = items.length ? items.map(i => `<article class="glass icard icard--${i.kind}">
    ${i.img ? `<img src="assets/${i.img}.webp" alt="" loading="lazy">` : `<span class="icard__ico" aria-hidden="true"></span>`}
    <div><span class="tag tag--dark">${{ car: 'veículo', animal: 'animal', land: 'terra', good: 'armazém' }[i.kind]}</span><h4>${esc(i.label)}</h4>${i.value ? `<p class="muted small">vale cerca de ${brl(i.value)}</p>` : ''}</div></article>`).join('')
    : '<p class="empty glass">Nada para trocar ainda. Compre carros, animais, terras ou guarde sacas no armazém.</p>';
  const ppl = TUI.online();
  $('#inv-peers').innerHTML = ppl.length ? ppl.map(p => `<li><span class="who__av">${avatarSVG(p.look || {}, { label: p.name })}</span><span>${esc(p.name)}<small class="muted"> nível ${p.level}</small></span>
    <button class="btn btn--gold btn--sm" data-act="trade-invite" data-id="${esc(p.pid)}">propor troca</button></li>`).join('') : '<li class="muted small">Ninguém online agora. Chame os amigos pelo link do jogo.</li>';
}
G.onLobby = l => TUI.attach(l);
G.onPeers = () => { if (currentTab === 'inventario') renderInv(); };
document.addEventListener('submit', e => { if (e.target.id === 'tr-chat-form') { e.preventDefault(); TUI.chat(); } });

// desempenho: cada aba só é desenhada quando está aberta (ou quando o usuário entra nela)
const PANELS = { personagem: () => renderChar(), terras: () => renderTerras(), gado: () => renderGado(), mercado: () => renderMercado(),
  carros: () => renderCarros(), banco: () => renderBanco(), livro: () => renderLivro(), haras: () => SUI.render(), trabalho: () => JUI.render(), futebol: () => FUI.render(), inventario: () => renderInv(), mesa: () => C.renderLobby() };
let currentTab = 'mesa';
function render() {
  renderHud(); renderMissions();
  PANELS[currentTab]?.();
  C.announce();
  JUI.hint();
}
G.render = render;
G.callout = t => { const el = $('#race-call'); el.textContent = t; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); };

// ---------- ações ----------
const find = (arr, id) => arr.find(x => String(x.id) === String(id));
const qty = name => Math.max(0, Math.floor(Number(document.querySelector(`[name="${name}"]`)?.value) || 0));

const ACTS = {
  'buy-chips'() { const n = qty('chips-buy'); if (n && pay(n * L.CHIP, `compra de ${int(n)} fichas`)) { S().chips += n; say(`${int(n)} fichas na mão.`); } },
  'cash-chips'() {
    if (C.busyRound()) return say('Termine a mão antes de ir ao caixa.', true);
    const n = Math.min(qty('chips-buy'), S().chips);
    S().chips -= n; S().money += n * L.CHIP; note(`resgate de ${int(n)} fichas`, n * L.CHIP); say(`${brl(n * L.CHIP)} de volta na conta.`);
  },
  sit(id, b) { if (b.dataset.kind === 'online') C.joinOnline(id); else C.sitSolo(id); },
  'leave-table'() { C.leaveTable(); },
  invite() { C.invite(); },
  bet() { C.placeBet(); },
  hit() { C.hit(); },
  stand() { C.stand(); },
  double() { C.double(); },
  split() { C.split(); },
  'bet-clear'() { C.clearBet(); },
  'race-pick'(id) { RC.pickDog(id); },
  'race-go'() { RC.go(); },
  'race-next'() { RC.nextRace(); },
  mute() { const off = sfx.toggleMute(); $('#mute-btn').classList.toggle('is-off', off); say(off ? 'Som desligado.' : 'Som ligado.'); },
  'open-pass'() { renderPass(); $('#dlg-pass').showModal(); },
  'pass-claim'(id) { const r = P.passClaim(S(), Number(id)); if (r) { say(`Passe: +${r.kind === 'chips' ? `${int(r.amount)} fichas` : brl(r.amount)}.`); confetti(40); renderPass(); } },
  'open-missions'() { renderMissions(); $('#dlg-missions').showModal(); },
  'claim-mission'(id) {
    const r = P.claimMission(S(), id);
    if (r) { say(`+${int(r)} fichas da missão.`); confetti(40); }
  },
  'spin-daily'() { spinDaily(); },
  logout() { Auth.logout(); },
  'st-kind'(id) { SUI.setKind(id); },
  'job-start'() { JUI.start(); },
  'ft-found'() { FUI.found(); },
  'trade-invite'(id) { const d = $('#dlg-profile'); if (d.open) d.close(); TUI.invite(id); },
  'trade-yes'() { TUI.answer(true); },
  'trade-no'() { TUI.answer(false); },
  'trade-add'() { TUI.addPicked(); },
  'trade-chips'() { TUI.addAmount('chips'); },
  'trade-money'() { TUI.addAmount('money'); },
  'trade-remove'(id) { TUI.remove(id); },
  'trade-lock'() { TUI.lock(); },
  'trade-confirm'() { TUI.confirmTrade(); },
  'trade-cancel'() { TUI.cancel(); },
  'ft-view'(id) { FUI.setView(id); },
  'ft-buy'(id) { FUI.buy(id); },
  'ft-sell'(id) { FUI.sell(id); },
  'ft-season'() { FUI.seasonEnd(); },
  'ft-play'() { FUI.play(); },
  'ft-close'() { FUI.closeMatch(); },
  'job-accept'(id) { JUI.accept(id); },
  'job-confirm'(id) { JUI.confirmOne(id); },
  'job-repair'() { JUI.repair(); },
  'st-buy'(id) { SUI.buy(id); },
  'st-train'(id, b) { SUI.train(id, b.dataset.k); },
  'st-treat'(id) { SUI.treat(id); },
  'st-sell'(id) { SUI.sell(id); },
  'st-premium'(id) { SUI.premium(id); },
  'st-enter'(id) { SUI.enter(id); },
  'stable-close'() { SUI.closeRace(); },
  wipe() {
    if (!confirm('Apagar seu save e seu perfil da nuvem e sair? Isso não pode ser desfeito. Para apagar também o cadastro (e-mail), peça ao administrador.')) return;
    Auth.wipe();
  },
  'close-daily'() { $('#dlg-daily').close(); },
  'map-lot'(id) { flyToLot(id); },
  'show-card'(id) { const el = document.querySelector(`.lcard[data-pin="${id}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.classList.add('is-hot'); setTimeout(() => el?.classList.remove('is-hot'), 2000); },
  'rl-spin'() { RL.spin(); },
  'rl-clear'() { RL.clearBets(); },
  'rl-double'() { RL.doubleBets(); },
  'av-press'() { AV.press(); },
  'tr-buy'() { TR.open(1); },
  'tr-sell'() { TR.open(-1); },
  'tr-close'(id) { TR.close(id); },
  'tr-asset'(id) { TR.pickAsset(id); },
  'edit-char'() { $('#dlg-profile').close(); G.goto('personagem'); },
  look(id, b) {
    const k = b.dataset.k, opt = CATALOG[k].opts.find(o => String(o.id) === id), tag = `${k}:${opt.id}`;
    if (opt.price && !S().owned.includes(tag)) {
      if (!confirm(`Comprar ${opt.id} por ${brl(opt.price)}?`)) return;
      if (!pay(opt.price, `loja de luxo: ${opt.id}`)) return;
      S().owned.push(tag); say(`${opt.id} no seu guarda-roupa.`);
    }
    S().avatar[k] = typeof CATALOG[k].opts[0].id === 'number' ? Number(id) : id;
    C.updateInfo();
  },
  'buy-land'(idv) {
    const o = find(S().offers, idv);
    if (o && pay(o.value, `compra de ${o.ha} ha, ${o.region}`)) {
      S().offers.splice(S().offers.indexOf(o), 1); S().lands.push({ ...o, own: true, leasedOut: false }); say('Terra registrada no seu nome.'); award('land');
    }
  },
  'rent-land'(idv) {
    const o = find(S().offers, idv); if (!o) return;
    S().offers.splice(S().offers.indexOf(o), 1); S().lands.push({ ...o, own: false, leasedOut: false });
    say(`Arrendada por ${brl(o.value * L.RENT_PAY)} ao mês. Pasto para ${L.landCap(o)} cabeças ou lavoura.`); award('land');
  },
  'return-land'(idv) { const l = find(S().lands, idv); S().lands.splice(S().lands.indexOf(l), 1); say('Terra devolvida ao dono.'); },
  lease(idv) { const l = find(S().lands, idv); l.leasedOut = !l.leasedOut; say(l.leasedOut ? 'Contrato de arrendamento assinado.' : 'Terra de volta para o seu uso.'); },
  'sell-land'(idv) {
    const l = find(S().lands, idv);
    if (!confirm(`Vender ${l.ha} ha em ${l.region} por ${brl(l.value * 0.95)}?${l.crop ? ' A lavoura plantada vai junto.' : ''}`)) return;
    S().lands.splice(S().lands.indexOf(l), 1); S().money += l.value * 0.95; note(`venda de ${l.ha} ha, ${l.region}`, l.value * 0.95); say('Terra vendida.');
  },
  plant(idv) {
    const l = find(S().lands, idv), crop = $(`#crop-${idv}`).value, cost = L.plantCost(S(), crop, l.ha);
    const err = L.plant(S(), l, crop);
    if (err) return say(err, true);
    note(`plantio de ${L.CROPS[crop].label}, ${l.ha} ha`, -cost);
    say(`${L.CROPS[crop].label} plantada. Colheita em ${L.CROPS[crop].months} meses.`); award('plant');
  },
  'buy-calves'() {
    const n = qty('calves');
    if (n && pay(n * S().prices.bezerro, `compra de ${n} bezerros`)) { S().herd.push({ id: S().nextId++, heads: n, kg: 180 }); say(`${n} bezerros no rebanho.`); award('calves'); }
  },
  'sell-herd'(idv) {
    const h = find(S().herd, idv);
    const v = h.heads * L.arrobas(h.kg) * S().prices.arroba * (1 - L.cattleFee(S()));
    S().herd.splice(S().herd.indexOf(h), 1); S().money += v; note(`venda de ${h.heads} cabeças`, v); say(`Lote vendido por ${brl(v)}.`); award('sellherd');
  },
  'buy-good'(k) { const n = qty(`q-${k}`); if (n && pay(n * S().prices[k], `compra de ${n} sacas de ${GOODS[k]}`)) { S().stock[k] += n; say('Mercadoria no armazém.'); } },
  'sell-good'(k) {
    const n = Math.min(qty(`q-${k}`), S().stock[k]);
    if (!n) return say(`Você não tem ${GOODS[k]} no armazém.`, true);
    const v = n * S().prices[k] * (1 - L.MARKET_FEE);
    S().stock[k] -= n; S().money += v; note(`venda de ${n} sacas de ${GOODS[k]}`, v); say(`Vendido por ${brl(v)}.`);
  },
  'buy-car'(id) {
    const c = L.CARS[id];
    if (!confirm(`Comprar ${c.name} por ${brl(c.price)}?`)) return;
    if (!pay(c.price, `concessionária: ${c.name}`)) return;
    S().cars.push({ id: S().nextId++, model: id, value: c.price });
    say(`${c.name} na sua garagem.`); confetti(60); award('car');
    if (c.price >= 1e7) award('hypercar');
  },
  'sell-car'(idv) {
    const car = find(S().cars, idv), c = L.CARS[car.model], v = car.value * L.CAR_BUYBACK;
    if (!confirm(`Vender ${c.name} por ${brl(v)}?`)) return;
    S().cars.splice(S().cars.indexOf(car), 1); S().money += v; note(`venda do ${c.name}`, v); say('Carro vendido.');
  },
  borrow() {
    const v = qty('loan');
    if (!v) return;
    if (v > L.creditLimit(S())) return say('Acima do seu crédito. O banco empresta contra terra e gado.', true);
    S().loans.push({ id: S().nextId++, bal: v, rate: L.BANK_RATE, left: 12, missed: 0 });
    S().money += v; note('empréstimo do banco, 12 parcelas', v); say(`${brl(v)} na conta. A parcela sai todo mês.`);
  },
  payoff(idv) { const l = find(S().loans, idv); if (pay(l.bal, 'quitação de empréstimo')) { S().loans.splice(S().loans.indexOf(l), 1); say('Dívida quitada.'); } },
  lend(idv) {
    const b = find(S().borrowers, idv);
    if (b && pay(b.amount, `empréstimo para ${b.name}`)) {
      S().borrowers.splice(S().borrowers.indexOf(b), 1);
      S().lent.push({ id: b.id, name: b.name, bal: b.amount, rate: b.rate, left: b.months, risk: b.risk });
      say(`${b.name} assinou a promissória.`); award('lend');
    }
  },
  month() {
    if (C.busyRound()) return say('Termine a mão antes de passar o mês.', true);
    const before = S().money;
    const lines = L.tick(S());
    for (const l of ST.monthly(S())) note(l.txt, l.val);
    const harvests = lines.filter(l => l.txt.startsWith('colheita')).length;
    document.body.classList.remove('is-newmonth'); void document.body.offsetWidth; document.body.classList.add('is-newmonth');
    say(`Mês ${S().month}. Saldo do mês: ${brl(S().money - before)}.${harvests ? ' Colheita no armazém.' : ''}`);
    award('month');
    if (harvests) award('harvest', harvests);
  },
  reset() {
    if (!confirm('Começar um jogo novo? O progresso atual será apagado.')) return;
    C.leaveTable(); reset(); say('Jogo novo. R$ 100.000 na conta.');
  },
};

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) { C.addBet(Number(add.dataset.add)); return; }
  const pf = e.target.closest('[data-profile]');
  if (pf && pf.dataset.profile) { openProfile(pf.dataset.profile); return; }
  const close = e.target.closest('[data-close]');
  if (close) { close.closest('dialog').close(); return; }
  const sub = e.target.closest('[data-sub]');
  if (sub) { showSub(sub.dataset.sub); return; }
  const rc = e.target.closest('[data-rchip]');
  if (rc) { RL.pickChip(rc.dataset.rchip); return; }
  const rb = e.target.closest('[data-rbet]');
  if (rb) { RL.placeBet(rb.dataset.rbet); return; }
  const aq = e.target.closest('[data-av-quick]');
  if (aq) { AV.quick(Number(aq.dataset.avQuick)); return; }
  const lv = e.target.closest('[data-lev]');
  if (lv) { TR.pickLev(lv.dataset.lev); return; }
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  ACTS[act]?.(b.dataset.id, b);
  if (['rl-double', 'pass-claim', 'st-train', 'trade-invite', 'trade-yes', 'trade-no', 'trade-add', 'trade-chips', 'trade-money', 'trade-remove', 'trade-lock', 'trade-confirm', 'trade-cancel', 'ft-play', 'ft-close', 'job-start', 'job-accept', 'job-confirm', 'job-repair', 'double', 'split', 'logout', 'wipe', 'st-enter', 'stable-close', 'sit', 'leave-table', 'invite', 'bet', 'hit', 'stand', 'bet-clear', 'race-go', 'race-pick', 'race-next', 'mute', 'rl-spin', 'rl-clear', 'av-press', 'tr-buy', 'tr-sell', 'tr-close', 'tr-asset', 'spin-daily', 'map-lot', 'show-card'].includes(act)) return;
  checkAch(); save(); render();
});
$('#map-back').addEventListener('click', () => { lmap?.flyTo([-14, -51], 4, { duration: 1.4 }); $('#map-title').textContent = 'satélite'; });
document.addEventListener('input', e => { if (e.target.name === 'tr-amt') TR.tick(); });

// abas internas do cassino
function showSub(name) {
  document.querySelectorAll('[data-sub]').forEach(b => b.classList.toggle('is-on', b.dataset.sub === name));
  for (const s of ['21', 'roleta', 'aviator']) document.getElementById(`sub-${s}`).hidden = s !== name;
  AV.setActive(name === 'aviator' && !$('#p-mesa').hidden);
}

// atalhos das entregas: espaço confirma a próxima entrega, F conserta o pneu
document.addEventListener('keydown', e => {
  if (!JUI.running() || $('#p-trabalho').hidden || e.target.closest('input, select, textarea')) return;
  if (e.key === ' ') { e.preventDefault(); JUI.confirmOne(); }
  if (e.key.toLowerCase() === 'f') JUI.repair();
});
// atalhos da mesa: 1-5 fichas, espaço aposta, H pede, S para, R regras
const CHIP_KEYS = { 1: 5, 2: 25, 3: 100, 4: 500, 5: 1000 };
document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea') || document.querySelector('dialog[open]') || $('#room').hidden || $('#p-mesa').hidden || $('#sub-21').hidden) return;
  const k = e.key.toLowerCase();
  if (CHIP_KEYS[k]) C.addBet(CHIP_KEYS[k]);
  else if (k === ' ') { e.preventDefault(); C.placeBet(); }
  else if (k === 'h') C.hit();
  else if (k === 's') C.stand();
  else if (k === 'd') C.double();
  else if (k === 'p') C.split();
  else if (k === 'r') $('#dlg-rules').showModal();
});
$('#mute-btn').classList.toggle('is-off', sfx.isMuted());
document.addEventListener('input', e => { if (e.target.name === 'rbet' || e.target.name === 'rtype') RC.slip(); });
document.addEventListener('change', e => { if (e.target.name === 'rtype') RC.slip(); });

$('#create-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  C.hostOnline({ name: String(f.get('tname') || '').trim() || `mesa de ${S().avatar.name || 'um amigo'}`, minBet: Number(f.get('tmin')), pub: f.get('tvis') === 'pub' });
});
$('#code-form').addEventListener('submit', e => { e.preventDefault(); C.joinOnline(new FormData(e.target).get('code')); });

$('#char-name').addEventListener('input', e => {
  S().avatar.name = e.target.value.trim().slice(0, 18);
  save(); renderHud(); $('#char-name-show').textContent = S().avatar.name || 'você'; C.announce(); C.updateInfo();
});

// cartão de terra acende o pino no mapa, e vice-versa
const hot = (id, on) => document.querySelectorAll(`[data-pin="${id}"]`).forEach(el => el.classList.toggle('is-hot', on));
for (const ev of ['mouseover', 'mouseout', 'focusin', 'focusout']) {
  $('#p-terras').addEventListener(ev, e => { const el = e.target.closest('[data-pin]'); if (el) hot(el.dataset.pin, ev === 'mouseover' || ev === 'focusin'); });
}

// abas, com a aba atual na URL
const tabs = [...document.querySelectorAll('[role="tab"]')];
function show(name, focus = false) {
  if (!tabs.some(t => t.dataset.tab === name)) name = 'mesa';
  for (const t of tabs) {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  }
  currentTab = name;
  PANELS[name]?.();
  if (name === 'terras') setTimeout(initMap, 50);
  if (name === 'trader') TR.tick();
  if (name === 'corridas') RC.relayout();
  AV.setActive(name === 'mesa' && !$('#sub-aviator').hidden);
}
G.goto = name => { history.replaceState(null, '', `${location.search}#${name}`); show(name); };
tabs.forEach((t, i) => {
  t.addEventListener('click', () => G.goto(t.dataset.tab));
  t.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length];
    G.goto(n.dataset.tab); show(n.dataset.tab, true);
  });
});

show(location.hash.slice(1));
// aplicativo instalável e cache dos arquivos (só no site publicado, em https)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
requestAnimationFrame(() => setTimeout(() => { $('#splash')?.classList.add('is-gone'); setTimeout(() => $('#splash')?.remove(), 600); }, 250));
RC.initRacing();
RL.initRoulette();
TR.initTrader();
render();
C.initCasino();
// login: sem Supabase configurado segue local; com ele, a tela de entrada aparece antes de tudo
Auth.boot().then(async st => {
  if (st === 'gate' || st === 'recovery') return;
  const live = await Live.start().catch(() => 'off');
  if (live !== 'banned') maybeDaily();
});
