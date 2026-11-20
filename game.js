import * as L from './logic.js';
import * as P from './progress.js';
import { CATALOG, avatarSVG } from './avatar.js';
import { G, $, esc, brl, int, RM, say, save, note, pay, award, checkAch, confetti, today, yesterday, reset, profileOf, levelUp } from './store.js';
import * as C from './casino.js';
import * as RC from './racing.js';
import * as sfx from './sfx.js';
import * as GM from './games.js';
import * as AV from './aviator.js';
import * as FB from './aposta-ui.js';
import * as TRU from './truco-ui.js';
import * as SNU from './sinuca-ui.js';
import * as PKU from './poker-ui.js';
import * as CT from './contador.js';
import * as CTU from './contador-ui.js';
import * as SFU from './staff-ui.js';
import * as SF from './staff.js';
import { botsFor as BOTS } from './botpool.js';
import * as NG from './negocios.js';
import * as SH from './shop.js';
import * as NGU from './negocios-ui.js';
import * as SU from './suinos.js';
import * as SUU from './suinos-ui.js';
import * as LEU from './leilao-ui.js';
import * as MI from './mina.js';
import * as MIU from './mina-ui.js';
import * as RL from './roulette.js';
import * as TR from './trader.js';
import * as Auth from './auth.js';
import * as PK from './perks.js';
import * as FE from './feira.js';
import * as W from './world.js';
import * as RV from './rivals.js';
import * as NPC from './npcs.js';
import * as GR from './granja.js';
import * as PM from './pomar.js';
import * as CN from './cana.js';
import * as MK from './market.js';
import * as AB from './abate.js';
import * as FN from './frig-net.js';
import * as CD from './cards.js';
import * as CHUI from './chat-ui.js';
import './news-ui.js';
import * as SHUI from './shop-ui.js';
import * as RKUI from './ranking-ui.js';
import { openDeal } from './deal-ui.js';
import * as Live from './live.js';
import * as ST from './stable.js';
import * as SUI from './stable-ui.js';
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
  const prize = GM.DAILY_WHEEL[i], mult = streakBonus(S().daily.streak) * Live.CFG.daily_mult * PK.mult(S(), 'daily'), amt = Math.round(prize.amount * mult);
  let txt;
  if (prize.kind === 'chips') { S().chips += amt; txt = `${int(amt)} fichas`; }
  if (prize.kind === 'money') { S().money += amt; note('roleta de prêmios do dia', amt); txt = brl(amt); }
  if (prize.kind === 'calves') { S().herd.push({ id: S().nextId++, heads: amt, kg: 180 }); txt = `${amt} bezerros no seu rebanho`; }
  if (prize.kind === 'xp') { P.addXp(S(), amt).forEach(levelUp); txt = `${int(amt)} XP`; }
  if (prize.kind === 'card') { const c = CD.give(S(), CD.draw(Math.random, S().daily.streak >= 5 ? 1 : 0)); txt = `a carta ${CD.label(c)}`; setTimeout(() => showCard(c), 600); }
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
  const locked = nameLocked();
  $('#char-name').disabled = locked;
  $('#char-name-hint').textContent = locked ? `Nome trocado no mês ${S().nameAt}. Próxima troca no mês ${S().nameAt + 10} do mundo (faltam ${S().nameAt + 10 - S().month}).` : 'Você pode trocar o nome a cada 10 meses do mundo. Ele fica salvo quando você sai do campo.';
  const b = PK.bonuses(S());
  $('#char-perks').innerHTML = `<h3>suas vantagens</h3>${Object.keys(b).length ? `<ul>${Object.entries(b).map(([k, v]) => `<li><b class="${v > 0 === (k !== 'loan') ? 'good' : 'bad'}">${v > 0 ? '+' : ''}${Math.round(v * 100)}%</b> ${PK.EFFECTS[k]}</li>`).join('')}</ul>` : '<p class="muted small">Nenhuma ainda. Compre carros na loja ou acessórios aqui.</p>'}`;
  $('#wardrobe').innerHTML = Object.entries(CATALOG).map(([k, g]) => `
    <fieldset class="opts"><legend>${g.label}</legend>
      ${g.opts.map(o => {
        const on = String(a[k]) === String(o.id), locked = o.price && !S().owned.includes(`${k}:${o.id}`);
        return `<button class="opt${o.swatch ? ' opt--sw' : ''}${on ? ' is-on' : ''}" aria-pressed="${on}" data-act="look" data-k="${k}" data-id="${o.id}"
          ${o.swatch ? `style="--sw:${o.swatch}" aria-label="${g.label} ${o.id}"` : ''}>${o.swatch ? '' : esc(o.id)}${locked ? `<small>${brl(o.price)}</small>` : ''}${k === 'acc' && PK.ACC_PERKS[o.id] ? `<small class="good">${esc(PK.label(PK.ACC_PERKS[o.id]))}</small>` : ''}</button>`;
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

function orchardBox(l) {
  const o = l.orchard, pr = Math.min(1, o.age / PM.ORANGE.grow), nh = PM.nextHarvest(o);
  return `<div class="orchard${o.pest >= 3 ? ' is-sick' : ''}"><img src="assets/farm-laranja.webp" alt="" loading="lazy">
    <div><b>pomar de laranja · ${l.ha} ha</b> <span class="small muted">${o.age < PM.ORANGE.grow ? `em formação (${o.age} de ${PM.ORANGE.grow} meses)` : `produzindo · ${o.harvests} colheitas`}</span>
    ${o.age < PM.ORANGE.grow ? `<span class="bar"><i style="transform:scaleX(${pr})"></i></span>` : ''}
    <span class="small">próxima colheita em ${nh} ${nh === 1 ? 'mês' : 'meses'}: ~${int(PM.expectedWith(S(), l))} caixas${PM.coverage(S(), 'plataforma') ? ' (com plataforma)' : ''} · saúde ${Math.round(o.health * 100)}% · praga ${PM.PEST_LABEL[Math.min(6, o.pest)]}</span>
    <div class="row"><button class="btn btn--sm ${o.spray ? 'btn--gold' : 'btn--glass'}" data-act="pm-spray" data-id="${l.id}" aria-pressed="${o.spray}">${o.spray ? 'defensivo ligado' : 'defensivo desligado'} (${brl(PM.sprayCost(S(), l))}/mês${PM.coverage(S(), 'pulv') ? `, era ${brl(l.ha * PM.ORANGE.spray)}` : ''})</button>
      <button class="btn btn--glass btn--sm" data-act="pm-uproot" data-id="${l.id}">arrancar pomar</button></div></div></div>`;
}
function caneBox(l) {
  const c = l.cane, nc = CN.nextCut(c), lg = CN.logistics(S(), l), first = c.cuts === 0, pr = first ? Math.min(1, c.age / CN.CANE.first) : 1 - nc / CN.CANE.cycle;
  return `<div class="orchard cane${c.pest >= 3 ? ' is-sick' : ''}"><img src="assets/farm-cana.webp" alt="" loading="lazy">
    <div><b>canavial · ${l.ha} ha</b> <span class="small muted">${first ? `cana-planta (${c.age} de ${CN.CANE.first} meses)` : `soca · ${c.cuts} ${c.cuts === 1 ? 'corte' : 'cortes'}`}${c.cuts >= CN.CANE.reform ? ' · hora de reformar' : ''}</span>
    <span class="bar"><i style="transform:scaleX(${Math.max(0, pr).toFixed(2)})"></i></span>
    <span class="small">próximo corte em ${nc} ${nc === 1 ? 'mês' : 'meses'}: ~${int(CN.expectedTons(l))} t · vigor ${Math.round(c.health * 100)}% · broca ${CN.PEST_LABEL[Math.min(6, c.pest)]}</span>
    <span class="small muted">usina a ${lg.km} km · logística ${brl(lg.total)}/t (corte ${brl(lg.cut)}${lg.own ? ' com colhedora própria' : ''}, carregamento ${brl(lg.load)}, frete ${brl(lg.freight)}${lg.truck ? ' com seu caminhão' : ''})</span>
    <div class="row"><button class="btn btn--sm ${c.care ? 'btn--gold' : 'btn--glass'}" data-act="cn-care" data-id="${l.id}" aria-pressed="${c.care}">${c.care ? 'tratos ligados' : 'tratos desligados'} (${brl(l.ha * CN.CANE.care)}/mês)</button>
      <button class="btn btn--glass btn--sm" data-act="cn-uproot" data-id="${l.id}">${c.cuts >= CN.CANE.reform ? 'reformar canavial' : 'arrancar canavial'}</button></div></div></div>`;
}
function landCard(l, kind) {
  const s = S();
  const badge = { offer: ['à venda', 'gold'], own: [l.leasedOut ? 'arrendada a terceiros' : 'sua', l.leasedOut ? 'violet' : 'green'], rent: ['arrendada de terceiros', 'violet'] }[kind];
  const benefit = kind === 'own' && !l.leasedOut ? `<p class="small good">dá: ${esc(PK.label(PK.landPerk(l)))}</p>` : kind === 'offer' ? `<p class="small good">ao comprar: ${esc(PK.label(PK.landPerk(l)))}</p>` : '';
  const facts = [`${l.use}`, l.water, ...(l.improv || [])].map(t => `<span class="tag tag--dark">${esc(t)}</span>`).join('');
  let crop = '';
  if (kind !== 'offer' && !l.leasedOut && l.cane) {
    crop = caneBox(l);
  } else if (kind !== 'offer' && !l.leasedOut && l.orchard) {
    crop = orchardBox(l);
  } else if (kind !== 'offer' && !l.leasedOut) {
    if (l.crop) {
      const c = L.CROPS[l.crop.type], k = 1 - l.crop.left / c.months;
      crop = `<div class="crop"><span class="small">${c.label} plantada, colhe em ${l.crop.left} ${l.crop.left === 1 ? 'mês' : 'meses'}</span><span class="bar"><i style="transform:scaleX(${k})"></i></span></div>`;
    } else {
      crop = `<div class="crop row"><label class="visually-hidden" for="crop-${l.id}">lavoura</label>
        ${kind === 'rent' && !L.hasVehicle(s, 'trator') ? '<span class="small muted">Terra arrendada: só pasto. Para plantar aqui você precisa de um trator (loja 21).</span>' : `<select class="input input--crop" id="crop-${l.id}">${Object.entries(L.CROPS).map(([k, c]) => `<option value="${k}">${c.label}: ${brl(L.plantCost(s, k, l.ha, kind === 'rent'))}</option>`).join('')}</select>
        <button class="btn btn--glass btn--sm" data-act="plant" data-id="${l.id}">plantar</button>`}</div>${kind === 'own' ? `<button class="btn btn--glass btn--sm btn--orange" data-act="pm-plant" data-id="${l.id}">plantar pomar de laranja (${brl(l.ha * PM.ORANGE.plant)})</button><button class="btn btn--glass btn--sm btn--cane" data-act="cn-plant" data-id="${l.id}">plantar cana (${brl(l.ha * CN.CANE.plant)})</button>` : ''}`;
    }
  }
  const acts = kind === 'offer'
    ? `<button class="btn btn--gold" data-act="buy-land" data-id="${l.id}">comprar</button><button class="btn btn--glass" data-act="rent-land" data-id="${l.id}">arrendar</button>${(S().cards || []).length ? `<button class="btn btn--glass btn--sm" data-act="buy-land-cards" data-id="${l.id}">pagar com cartas</button>` : ''}`
    : kind === 'own'
      ? `<button class="btn btn--glass" data-act="lease" data-id="${l.id}" ${l.crop || l.orchard || l.cane ? 'disabled' : ''}>${l.leasedOut ? 'retomar' : 'arrendar a terceiros'}</button><button class="btn btn--glass" data-act="sell-land" data-id="${l.id}">vender</button>`
      : `<button class="btn btn--gold" data-act="buy-rented" data-id="${l.id}">comprar por ${brl(L.buyRentedPrice(l))}</button><button class="btn btn--glass" data-act="return-land" data-id="${l.id}" ${l.crop ? 'disabled' : ''}>devolver</button>`;
  const money = kind === 'rent' ? `${brl(l.value * L.RENT_PAY)}<small>/mês</small>` : brl(l.value);
  const sub = kind === 'own' && l.leasedOut ? `recebe ${brl(l.value * L.RENT_GET)}/mês` : kind === 'own' ? (l.cane ? 'canavial' : l.orchard ? 'pomar de laranja' : l.crop ? 'lavoura plantada' : `pasto para ${L.landCap(l)} cabeças`) : kind === 'offer' ? `arrendamento ${brl(l.value * L.RENT_PAY)}/mês, ${brl(l.value / l.ha)}/ha` : `aluguel ${brl(L.rentNow(l))}/mês (+${Math.round(L.RENT_RAISE * 100)}% a cada ano), já pagou ${brl(l.paid || 0)}, abate ${brl(L.rentCredit(l))} se comprar. Lavoura: só com trator, +20% de custo e ${Math.round(L.RENT_SHARE * 100)}% da safra vai para o dono.`;
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
      ${benefit}
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
const LOT_ICON = { offer: '💰', own: '⭐', rent: '📜', pasto: '🐂', lavoura: '🌾', 'café': '☕', sede: '🏡' };
function lotPin(LF, lat, lon, icon, cls, tip, pop) {
  const m = LF.marker([lat, lon], { icon: LF.divIcon({ className: '', html: `<span class="lpin ${cls}">${icon}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) });
  m.bindTooltip(tip, { direction: 'top', offset: [0, -14] });
  if (pop) m.bindPopup(pop);
  return m;
}
let playerLands = [], playerLandsAt = 0;
function drawLots() {
  const LF = window.L;
  if (!lmap || !LF) return;
  lots.clearLayers();
  const css = getComputedStyle(document.documentElement);
  // fazendas dos concorrentes (não estão à venda)
  for (const r of RV.rivalLands()) {
    const icon = r.sede ? LOT_ICON.sede : LOT_ICON[r.use] || '🐂';
    lots.addLayer(lotPin(LF, r.lat, r.lon, icon, 'lpin--npc', `<strong>Dono: ${esc(r.owner)}</strong><br>${r.ha} ha de ${esc(r.use)}, perto de ${esc(r.city)}`));
  }
  // terras de outros jogadores de verdade (buscadas na nuvem a cada 60 s)
  for (const r of playerLands) lots.addLayer(lotPin(LF, r.lat, r.lon, r.use === 'pasto' ? LOT_ICON.pasto : LOT_ICON[r.use] || '🌾', 'lpin--player', `<strong>Dono: ${esc(r.owner)}</strong><br>${r.ha} ha de ${esc(r.use)}${r.city ? `, perto de ${esc(r.city)}` : ''}`));
  if (Date.now() - playerLandsAt > 60000) { playerLandsAt = Date.now(); Auth.mapLands?.().then(rows => { if (JSON.stringify(rows) !== JSON.stringify(playerLands)) { playerLands = rows; drawLots(); } }).catch(() => {}); }
  const me = esc(S().avatar?.name || 'você');
  const all = [...S().offers.map(l => [l, 'offer']), ...S().lands.map(l => [l, l.own ? 'own' : 'rent'])];
  for (const [l, kind] of all) {
    const color = css.getPropertyValue(KIND_COLOR[kind]).trim();
    const pop = `<strong>${esc(l.region)}</strong><br>${l.ha} ha, ${kind === 'offer' ? brl(l.value) : kind === 'own' ? 'sua' : 'arrendada'}<br><button class="btn btn--gold btn--sm" data-act="show-card" data-id="${l.id}">ver ficha</button>`;
    const tip = kind === 'offer' ? `<strong>À venda: ${brl(l.value)}</strong><br>${l.ha} ha de ${esc(l.use)}, ${esc(l.region)}` : `<strong>Dono: ${kind === 'own' ? me + ' (você)' : 'arrendada por você'}</strong><br>${l.ha} ha, ${esc(l.region)}`;
    const rect = LF.rectangle(lotBounds(l), { color, weight: 2, fillOpacity: 0.18 }).bindPopup(pop);
    const pin = lotPin(LF, l.lat, l.lon, LOT_ICON[kind], `lpin--${kind}`, tip, pop);
    pin.on('click', () => lmap.flyToBounds(lotBounds(l), { padding: [80, 80], maxZoom: 16, duration: 1.6 }));
    rect.on('click', () => lmap.flyToBounds(lotBounds(l), { padding: [80, 80], maxZoom: 16, duration: 1.6 }));
    lots.addLayer(rect).addLayer(pin);
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
  const s = S(), n = L.heads(s), cap = L.capacity(s), ab = AB.ensure(s);
  $('#abate-box').innerHTML = ab.owned
    ? `<img src="assets/farm-frigorifico.webp" alt="" loading="lazy"><div><h3>seu frigorífico</h3>
      <p class="small">Abatidos este mês: <b>${ab.used} de ${AB.OWN.cap}</b> · paga ${Math.round(AB.OWN.premium * 100)}% a mais na arroba + couro ${brl(AB.OWN.hide)}/cabeça · custo fixo ${brl(AB.OWN.fixed)}/mês</p>
      <div class="row"><label class="field"><span>comprar boi gordo (480 kg) a ${brl(AB.fatPrice(s))} e abater</span><input class="input input--s" name="fat" type="number" min="1" max="${AB.capLeft(s)}" value="${Math.min(50, AB.capLeft(s))}" inputmode="numeric"></label>
        <button class="btn btn--gold btn--sm" data-act="ab-buyfat" ${AB.capLeft(s) ? '' : 'disabled'}>comprar e abater</button>
        <button class="btn btn--glass btn--sm" data-act="ab-sellplant">vender frigorífico ${brl(ab.value * 0.85)}</button></div>
      <div class="row ab-third"><label class="check"><input type="checkbox" data-ab-open ${ab.open === false ? '' : 'checked'}><span>abater gado de outros jogadores (terceirizar)</span></label>
        <label class="field"><span>sua taxa por cabeça</span><select class="input" data-ab-fee>${AB.FEES.map(f => `<option value="${f}" ${(ab.fee ?? AB.PLAYER.fee) === f ? 'selected' : ''}>${brl(f)}${f <= 35 ? ' (atrai mais)' : f >= 80 ? ' (só quem tem pressa)' : ''}</option>`).join('')}</select></label></div>
      <p class="small muted">Aberto, os outros jogadores abatem aqui (até ${AB.OWN.cap} cabeças deles por mês, separado do seu limite). Você recebe a taxa + o couro (${brl(AB.OWN.hide)}) de cada boi, mesmo desligado: o dinheiro entra quando você abrir o jogo. Precisa estar com a conta conectada.</p></div>`
    : `<img src="assets/farm-frigorifico.webp" alt="" loading="lazy"><div><h3>frigorífico próprio</h3>
      <p class="small">Sem frigorífico, o abate é em terceiros: ${Math.round(AB.THIRD.premium * 100)}% a mais que vender vivo, menos ${brl(AB.THIRD.cost)} por cabeça. Com o seu: ${Math.round(AB.OWN.premium * 100)}% a mais + couro, até ${AB.OWN.cap} bois por mês, dá para comprar boi gordo pronto para abater e ainda terceirizar o abate para outros jogadores, cobrando taxa por cabeça.</p>
      <button class="btn btn--gold" data-act="ab-build">construir frigorífico (${brl(AB.OWN.price)})</button></div>`;
  const avg = n ? s.herd.reduce((a, h) => a + h.heads * h.kg, 0) / n : 0;
  $('#herd-stats').innerHTML = [
    ['cabeças', int(n)], ['pasto livre', `${int(Math.max(0, cap - n))} de ${int(cap)}`], ['peso médio', n ? `${int(avg)} kg` : '—'], ['valor do rebanho', brl(L.herdValue(s))],
  ].map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  $('#herd-warn').hidden = n <= cap;
  $('#herd-warn').textContent = `${int(n - cap)} bois estão num hotel de gado, porque seu pasto não tem lugar para todos. Você paga R$ ${L.BOITEL_COST} por boi por mês e eles engordam só ${L.BOITEL_GAIN} kg. Compre ou arrende mais terra de pasto para parar de pagar.`;
  $('#herd-now').textContent = cap <= 0
    ? (n ? 'Agora: você não tem pasto, então seus bois estão no hotel de gado (pago). Passo 1: consiga uma terra de pasto.' : 'Agora: você não tem pasto nem bois. Comece pelo passo 1, ou compre bezerros já (vão para o hotel de gado).')
    : n > cap ? `Agora: seu pasto tem ${int(cap)} lugares e você tem ${int(n)} bois. Faltam ${int(n - cap)} lugares, compre mais terra de pasto.`
    : `Agora: seu pasto tem ${int(cap)} lugares e ${int(cap - n)} estão livres. Pode comprar até ${int(cap - n)} bezerros sem pagar hotel.`;
  $('#calf-price').textContent = `${brl(s.prices.bezerro)} por bezerro de 180 kg${L.hasVehicle(s, 'caminhao') ? '. Seu caminhão leva o gado sem taxa.' : ''}`;
  $('#herd').innerHTML = s.herd.length ? s.herd.map((h, i) => {
    const val = h.heads * L.arrobas(h.kg) * s.prices.arroba, k = Math.min(1, (h.kg - 180) / (450 - 180));
    return `<article class="glass hcard">
      <img class="hcard__photo" src="assets/${k >= 1 ? 'farm-pasto2' : 'farm-pasto'}.webp" alt="" loading="lazy">
      <div class="hcard__top"><h4>lote ${i + 1}</h4><span class="tag ${k >= 1 ? 'tag--green' : 'tag--dark'}">${k >= 1 ? 'pronto para abate' : `${int(h.kg)} kg`}</span></div>
      <p class="price">${brl(val)}</p>
      <p class="muted small">${h.heads} cabeças, ${L.arrobas(h.kg).toFixed(1)} @ cada</p>
      <div class="bar" role="img" aria-label="${Math.round(k * 100)}% do peso de abate"><i style="transform:scaleX(${k})"></i></div>
      <div class="herd-acts"><button class="btn btn--glass btn--sm" data-act="sell-herd" data-id="${h.id}">revender vivo ${brl(h.heads * AB.perHead(s, h.kg, 'vivo', L.cattleFee(s)) * PK.mult(s, 'cattle'))}</button>
        <button class="btn btn--gold btn--sm" data-act="ab-kill" data-id="${h.id}">abater ${brl(h.heads * (AB.capLeft(s) >= h.heads ? AB.perHead(s, h.kg, 'proprio') : AB.perHead(s, h.kg, 'terceiros')))}</button>
        ${(() => { const p = AB.capLeft(s) >= h.heads ? null : FN.best(h.heads); return p ? `<button class="btn btn--gold btn--sm" data-act="ab-killp" data-id="${h.id}">abater no frigorífico de ${esc(p.owner_name)} ${brl(h.heads * AB.perHead(s, h.kg, 'jogador', p.fee))}</button>` : ''; })()}</div>
      <p class="small muted">${AB.capLeft(s) >= h.heads ? 'abate no seu frigorífico (com couro)' : s.abate?.owned ? 'seu frigorífico lotou este mês: abate em terceiros' : 'abate em frigorífico de terceiros'}</p></article>`;
  }).join('') : '<p class="empty glass">Você ainda não tem bois. Compre bezerros no leilão acima: se tiver pasto, eles vão para lá sozinhos.</p>';
}

// ---------- canavial ----------
function renderCana() {
  const s = S(); CN.ensure(s);
  const own = s.lands.filter(l => l.own), cn = own.filter(l => l.cane), free = own.filter(l => CN.canPlant(l));
  const ha = cn.reduce((t, l) => t + l.ha, 0), care = cn.filter(l => l.cane.care).reduce((t, l) => t + l.ha * CN.CANE.care, 0);
  const next = cn.length ? Math.min(...cn.map(l => CN.nextCut(l.cane))) : 0;
  $('#cn-stats').innerHTML = [['canaviais', cn.length], ['hectares', `${int(ha)} ha`], ['tratos por mês', brl(care)], ['próximo corte', cn.length ? `em ${next} ${next === 1 ? 'mês' : 'meses'}` : '—']]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  const p = s.prices.cana, pv = s.prev?.cana ?? p, ch = pv ? (p / pv - 1) * 100 : 0, hv = s.caneHarvester;
  $('#cn-logi').innerHTML = `<div><span class="muted small">usina paga pela tonelada</span><strong>${brl(p)} <small class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</small></strong></div>
    <div><span class="muted small">corte</span><strong>${hv ? `colhedora própria ${brl(CN.LOGI.cutOwn)}/t` : `terceirizado ${brl(CN.LOGI.cutThird)}/t`}</strong></div>
    <div><span class="muted small">frete</span><strong>R$ ${CN.LOGI.freightKm.toFixed(2).replace(".", ",")}/t por km${(s.cars || []).some(c => c.model === 'scania') ? ' · seu caminhão: −35%' : ''}</strong></div>
    ${hv ? `<button class="btn btn--glass btn--sm" data-act="cn-sellharv">vender colhedora ${brl(hv.value * 0.85)}</button>` : `<button class="btn btn--gold btn--sm" data-act="cn-buyharv">comprar colhedora (${brl(CN.HARVESTER.price)})</button>`}`;
  $('#cn-list').innerHTML = cn.length ? cn.map(l => `<article class="glass pm-card"><p class="small muted">${esc(l.region)} · perto de ${esc(L.region(l.region).city)}</p>${caneBox(l)}</article>`).join('')
    : '<p class="empty glass">Nenhum canavial ainda. Plante numa das suas terras abaixo.</p>';
  $('#cn-free').innerHTML = free.length ? free.map(l => { const lg = CN.logistics(s, l); return `<article class="glass pm-freecard"><div><b>${esc(l.region)}</b><span class="small muted">${l.ha} ha · usina a ${lg.km} km · logística ${brl(lg.total)}/t</span></div>
      <button class="btn btn--glass btn--cane btn--sm" data-act="cn-plant" data-id="${l.id}">plantar cana (${brl(l.ha * CN.CANE.plant)})</button></article>`; }).join('')
    : `<p class="empty glass">${own.length ? 'Todas as suas terras já estão ocupadas (lavoura, pomar, cana ou arrendadas).' : 'Você ainda não tem terra própria. Compre uma na aba terras: canavial só na terra própria.'} <button class="btn btn--glass btn--sm" data-tab-go="terras">ir para terras</button></p>`;
}

// ---------- pomar de laranja ----------
function renderPomar() {
  const s = S(); PM.ensure(s);
  const own = s.lands.filter(l => l.own), orch = own.filter(l => l.orchard), free = own.filter(l => PM.canPlant(l));
  const ha = orch.reduce((t, l) => t + l.ha, 0), spray = orch.filter(l => l.orchard.spray).reduce((t, l) => t + PM.sprayCost(s, l), 0);
  const next = orch.length ? Math.min(...orch.map(l => PM.nextHarvest(l.orchard))) : 0;
  $('#pm-stats').innerHTML = [['pomares', orch.length], ['hectares', `${int(ha)} ha`], ['defensivo por mês', brl(spray)], ['próxima colheita', orch.length ? `em ${next} ${next === 1 ? 'mês' : 'meses'}` : '—'],
    ...['pulv', 'plataforma'].map(m => { const n = PM.machines(s, m), need = PM.need(s, m), cov = PM.coverage(s, m); return [m === 'pulv' ? 'pulverizadores' : 'plataformas', `${n} de ${need} · ${m === 'pulv' ? `−${Math.round(PM.SPRAY_CUT * cov * 100)}% defensivo` : `+${Math.round(PM.HARVEST_PLUS * cov * 100)}% laranja`}`]; })]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  const p = s.prices.laranja, pv = s.prev?.laranja ?? p, ch = pv ? (p / pv - 1) * 100 : 0, stock = s.stock.laranja || 0;
  $('#pm-sell').innerHTML = `<div><span class="muted small">no armazém</span><strong>${int(stock)} caixas</strong></div>
    <div><span class="muted small">preço da caixa (40,8 kg)</span><strong>${brl(p)} <small class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</small></strong></div>
    <button class="btn btn--gold" data-act="pm-sellall" ${stock ? '' : 'disabled'}>vender tudo por ${brl(stock * p * (1 - L.MARKET_FEE))}</button>`;
  $('#pm-list').innerHTML = orch.length ? orch.map(l => `<article class="glass pm-card"><p class="small muted">${esc(l.region)} · perto de ${esc(L.region(l.region).city)}</p>${orchardBox(l)}</article>`).join('')
    : '<p class="empty glass">Nenhum pomar ainda. Plante numa das suas terras abaixo.</p>';
  $('#pm-free').innerHTML = free.length ? free.map(l => `<article class="glass pm-freecard"><div><b>${esc(l.region)}</b><span class="small muted">${l.ha} ha · ${esc(l.use)}</span></div>
      <button class="btn btn--glass btn--orange btn--sm" data-act="pm-plant" data-id="${l.id}">plantar pomar (${brl(l.ha * PM.ORANGE.plant)})</button></article>`).join('')
    : `<p class="empty glass">${own.length ? 'Todas as suas terras já estão ocupadas (lavoura, pomar ou arrendadas).' : 'Você ainda não tem terra própria. Compre uma na aba terras: pomar só na terra própria.'} <button class="btn btn--glass btn--sm" data-tab-go="terras">ir para terras</button></p>`;
}

// ---------- granja ----------
const grStage = age => age < 1 ? ['pintinhos', 'granja-pintinhos'] : age === 1 ? ['crescendo', 'granja-galpao'] : age === 2 ? ['no ponto de abate', 'granja-frangos'] : ['passou do ponto', 'granja-frangos'];
function renderGranja() {
  const s = S(), g = GR.ensure(s), lots = g.lots, birds = lots.reduce((t, l) => t + l.birds, 0);
  $('#gr-stats').innerHTML = [['galpões', g.houses.length], ['aves alojadas', int(birds)], ['valor dos lotes', brl(lots.reduce((t, l) => t + GR.lotValue(s, l), 0))], ['valor dos galpões', brl(g.houses.reduce((t, x) => t + x.value, 0))]]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  const pr = (k, label, unit, dec) => { const p = s.prices[k], pv = s.prev?.[k] ?? p, ch = pv ? (p / pv - 1) * 100 : 0;
    return `<div class="gr-price"><span class="muted small">${label}</span><strong>R$ ${p.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}<small> ${unit}</small></strong><span class="${ch >= 0 ? 'good' : 'bad'} small">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</span></div>`; };
  $('#gr-prices').innerHTML = pr('frango', 'frango vivo (frigorífico paga)', '/kg', 2) + pr('pintinho', 'pintinho de 1 dia', '/cabeça', 2) + pr('racao', 'ração', '/kg', 2);
  $('#gr-houses').innerHTML = g.houses.length ? g.houses.map(hs => {
    const H = GR.HOUSES[hs.type], l = GR.lotOf(s, hs.id);
    if (!l) return `<article class="glass grcard"><img class="grcard__img" src="assets/${H.img}.webp" alt="" loading="lazy">
      <div class="grcard__body"><div class="hcard__top"><h4>${H.label}</h4><span class="tag tag--dark">vazio</span></div>
      <p class="small muted">até ${int(H.cap)} aves · conversão ${H.conv.toString().replace('.', ',')} kg de ração por kg · mortalidade ${(H.mort * 100).toFixed(1).replace('.', ',')}%/mês</p>
      <div class="row"><label class="field"><span>pintinhos</span><input class="input input--s" id="gr-q-${hs.id}" type="number" min="100" step="100" max="${H.cap}" value="${H.cap}" inputmode="numeric"></label>
        <label class="check small"><input type="checkbox" id="gr-v-${hs.id}" checked><span>vacinar (R$ ${GR.VACCINE.toFixed(2).replace('.', ',')}/ave)</span></label></div>
      <p class="small">custo do alojamento: <b>${brl(GR.housingCost(s, H.cap, true))}</b> para ${int(H.cap)} pintinhos (pago 1 vez). Depois, em cada fechamento do mês, vêm a ração e a energia.</p>
      <div class="row"><button class="btn btn--gold" data-act="gr-house" data-id="${hs.id}">alojar pintinhos</button><button class="btn btn--glass btn--sm" data-act="gr-sellhouse" data-id="${hs.id}">vender galpão ${brl(Math.round(hs.value * GR.HOUSE_RESALE))}</button></div></div></article>`;
    const [stage, img] = grStage(l.age), kg = GR.kgAt(l.age), k = Math.min(1, l.age / 2);
    return `<article class="glass grcard${l.age >= 3 ? ' is-late' : l.age === 2 ? ' is-ready' : ''}"><img class="grcard__img" src="assets/${img}.webp" alt="" loading="lazy">
      <div class="grcard__body"><div class="hcard__top"><h4>${H.label}</h4><span class="tag ${l.age === 2 ? 'tag--green' : l.age >= 3 ? 'tag--red' : 'tag--dark'}">${stage}</span></div>
      <p class="price">${brl(GR.lotValue(s, l))}</p>
      <p class="small muted">${int(l.birds)} aves de ${int(l.start)} alojadas · ${kg.toString().replace('.', ',')} kg cada · ${l.age} ${l.age === 1 ? 'mês' : 'meses'}${l.vac ? ' · vacinado' : ' · sem vacina'}${l.events.length ? ` · ${l.events.join(', ')}` : ''}</p>
      <div class="bar" role="img" aria-label="${Math.round(k * 100)}% do peso de abate"><i style="transform:scaleX(${k})"></i></div>
      <p class="small">${l.age < 1 ? 'Pintinhos recém-chegados: ainda sem peso de venda.' : l.age === 1 ? 'Ainda dá para engordar mais um mês: o melhor preço por ave é no 2º mês.' : l.age === 2 ? 'Ponto certo de venda!' : 'Passou do ponto: come muito ração e quase não ganha peso. Venda logo.'}</p>
      <button class="btn ${l.age >= 2 ? 'btn--gold' : 'btn--glass'}" data-act="gr-sell" data-id="${l.id}" ${l.age < 1 ? 'disabled' : ''}>vender lote ao frigorífico</button></div></article>`;
  }).join('') : '<p class="empty glass">Nenhum galpão ainda. Construa o primeiro abaixo.</p>';
  $('#gr-shop').innerHTML = Object.entries(GR.HOUSES).map(([k, H]) => `<article class="glass grcard"><img class="grcard__img" src="assets/${H.img}.webp" alt="" loading="lazy">
    <div class="grcard__body"><h4>${H.label}</h4><p class="price">${brl(H.price)}</p>
    <p class="small muted">até ${int(H.cap)} aves · conversão ${H.conv.toString().replace('.', ',')} · mortalidade ${(H.mort * 100).toFixed(1).replace('.', ',')}%/mês${H.heat ? ' · sofre com calor' : ' · climatizado, sem onda de calor'}</p>
    <button class="btn btn--gold" data-act="gr-buy" data-id="${k}">construir</button></div></article>`).join('');
}

// ---------- mercado ----------
const GOODS = { soja: 'soja', milho: 'milho', cafe: 'café', laranja: 'laranja', cana: 'cana-de-açúcar', arroba: 'boi gordo', bezerro: 'bezerro', frango: 'frango vivo', suino: 'suíno vivo', ouro: 'ouro' };
const PHOTO = { soja: 'farm-soja', milho: 'farm-colheita', cafe: 'farm-cafe', laranja: 'farm-laranja', arroba: 'farm-pasto2', bezerro: 'farm-bezerro', suino: 'farm-pasto', ouro: 'photo-chips', cana: 'mk-cana', frango: 'granja-frangos', pintinho: 'granja-pintinhos', racao: 'granja-aviario' };
const UNIT = { soja: 'saca 60 kg', milho: 'saca 60 kg', cafe: 'saca 60 kg', laranja: 'caixa 40,8 kg', arroba: 'arroba', bezerro: 'cabeça', suino: 'kg vivo', ouro: 'kg', cana: 'tonelada', frango: 'kg vivo', pintinho: 'cabeça', racao: 'kg' };
const NOTE = { ouro: 'Preço pago pelo ouro da única mina do jogo.', suino: 'Preço do lote de suínos (aba suínos).', arroba: 'Preço da venda do seu gado (aba gado).', bezerro: 'Preço do leilão de bezerros (aba gado).', cana: 'Pago pela usina no corte (aba cana).', frango: 'Preço do lote na venda (aba granja).', pintinho: 'Custo para alojar (aba granja).', racao: 'Maior custo da granja.' };
function mkLive() {
  const now = Live.now();
  $('#mk-live').innerHTML = Object.entries(MK.ASSETS).map(([k, a]) => { const ch = MK.change(k, now) * 100; return `<div class="mk-live__i"><span class="muted small">${a.name} · ${a.ticker}</span><strong>${a.unit === 'R$' ? 'R$ ' : ''}${MK.fmt(k, MK.price(k, now))}${a.unit !== 'R$' ? ` <small>${a.unit}</small>` : ''}</strong><span class="delta ${ch >= 0 ? 'is-up' : 'is-down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}% na hora</span></div>`; }).join('');
}
setInterval(() => { if (!$('#p-mercado')?.hidden) mkLive(); }, 3000);
function renderMercado() {
  const s = S();
  mkLive();
  GR.ensure(s); PM.ensure(s); CN.ensure(s); SU.ensure(s); MI.ensure(s);
  $('#goods').innerHTML = Object.entries(GOODS).filter(([k]) => s.prices[k] ?? GR.PRICES[k]).map(([k, label]) => {
    const p = s.prices[k] ?? GR.PRICES[k], pv = s.prev?.[k] ?? p, ch = (p / pv - 1) * 100, trade = k in s.stock && k !== 'cana';
    const money = v => (v < 100 ? `R$ ${v.toFixed(2).replace('.', ',')}` : brl(v));
    return `<article class="glass hcard mcard">
      <img class="hcard__photo" src="assets/${PHOTO[k]}.webp" alt="" loading="lazy">
      <div class="hcard__top"><h4>${label}</h4><span class="delta ${ch > 0 ? 'is-up' : ch < 0 ? 'is-down' : ''}">${ch > 0 ? '▲' : ch < 0 ? '▼' : '='} ${Math.abs(ch).toFixed(1)}%</span></div>
      <p class="price">${money(p)}<small> / ${UNIT[k]}</small></p>
      ${trade ? `<p class="muted small">no armazém: ${int(s.stock[k])} sacas, valem ${brl(s.stock[k] * s.prices[k])}</p>
      <div class="row"><label class="visually-hidden" for="q-${k}">quantidade de ${label}</label>
        <input class="input input--s" id="q-${k}" name="q-${k}" type="number" min="1" value="${Math.max(10, s.stock[k])}" inputmode="numeric">
        <button class="btn btn--glass" data-act="buy-good" data-id="${k}">comprar</button>
        <button class="btn btn--glass" data-act="sell-good" data-id="${k}">vender</button></div>`
      : `<p class="muted small">${NOTE[k] || ''}</p>`}
    </article>`;
  }).join('');
}

// ---------- concessionária: fotos reais, nomes de paródia ----------
const carImg = c => `assets/${c.img}.webp`;
function renderCarros() {
  const s = S();
  const PESADOS = ['trator', 'caminhao'], carCard = ([id, c]) => {
    const owned = s.cars.some(x => x.model === id);
    return `<article class="glass ccard">
      <div class="ccard__photo"><img src="${carImg(c)}" alt="${esc(c.name)}" loading="lazy">
        <span class="tag ${c.perk || PK.CAR_PERKS[id] ? 'tag--green' : c.price > 1e6 ? 'tag--violet' : 'tag--dark'}">${c.cat}</span>${owned ? '<span class="tag tag--gold ccard__own">na garagem</span>' : ''}</div>
      <div class="ccard__body">
        <h4>${esc(c.name)}</h4>
        <p class="price">${brl(c.price)}</p>
        <dl class="specs"><div><dt>potência</dt><dd>${c.hp} cv</dd></div><div><dt>máxima</dt><dd>${c.top} km/h</dd></div><div><dt>IPVA e seguro</dt><dd>${brl(c.price * L.CAR_UPKEEP)}/mês</dd></div></dl>
        <p class="small good perk">vantagem: ${esc([c.perk, PK.label(PK.CAR_PERKS[id])].filter(Boolean).join(', '))}</p>
        <button class="btn btn--gold" data-act="buy-car" data-id="${id}">comprar</button>
      </div></article>`;
  };
  $('#showroom').innerHTML = Object.entries(L.CARS).filter(([, c]) => c.type !== 'maquina' && !PESADOS.includes(c.type)).map(carCard).join('');
  $('#heavy').innerHTML = Object.entries(L.CARS).filter(([, c]) => PESADOS.includes(c.type)).map(carCard).join('');
  renderMaq(s);
  $('#garage').innerHTML = s.cars.length ? s.cars.map(car => {
    const c = L.CARS[car.model], lost = 1 - car.value / c.price;
    return `<article class="glass ccard ccard--own">
      <div class="ccard__photo"><img src="${carImg(c)}" alt="${esc(c.name)}" loading="lazy"><span class="tag tag--green">sua</span></div>
      <div class="ccard__body"><h4>${esc(c.name)}</h4>
        <p class="price">${brl(car.value)}</p><p class="muted small">pagou ${brl(c.price)}, desvalorizou ${(lost * 100).toFixed(1)}%. A loja recompra por ${brl(car.value * L.CAR_BUYBACK)}.</p>
        <button class="btn btn--glass" data-act="sell-car" data-id="${car.id}">vender</button></div></article>`;
  }).join('') : '<p class="empty glass">Garagem vazia. Seu primeiro carro aparece aqui e no seu perfil.</p>';
}

// máquinas: só aparecem as da cultura que a pessoa tem (pomar -> laranja, canavial -> cana)
function renderMaq(s) {
  const hasO = s.lands.some(l => l.orchard), hasC = s.lands.some(l => l.cane) || !!s.caneHarvester;
  const card = (id, c) => { const n = s.cars.filter(x => x.model === id).length, multi = !!PM.COVER[id], owned = n > 0 && !multi;
    const cov = multi ? `<p class="small ${n >= PM.need(s, id) ? 'good' : 'bad'}">você tem ${n} · seu pomar de ${int(PM.orchardHa(s))} ha pede ${PM.need(s, id)} (cada ${id === 'pulv' ? 'um' : 'uma'} atende ${PM.COVER[id]} ha)</p>` : '';
    return `<article class="glass ccard ccard--maq"><div class="ccard__photo"><img src="assets/${c.img}.webp" alt="${esc(c.name)}" loading="lazy"><span class="tag tag--green">${c.cat}</span>${n ? `<span class="tag tag--gold ccard__own">${multi ? `${n} na fazenda` : 'na fazenda'}</span>` : ''}</div>
      <div class="ccard__body"><h4>${esc(c.name)}</h4><p class="price">${brl(c.price)}</p>
        <p class="small good perk">vantagem: ${esc(c.perk)}</p>${cov}<p class="muted small">desvaloriza 1,5% e paga ${brl(c.price * L.CAR_UPKEEP)} de seguro por mês</p>
        ${owned ? '<button class="btn btn--glass" disabled>já está na fazenda</button>' : `<button class="btn btn--gold" data-act="buy-car" data-id="${id}">${multi && n ? 'comprar mais um' : 'comprar'}</button>`}</div></article>`; };
  const list = crop => Object.entries(L.CARS).filter(([, c]) => c.crop === crop).map(([id, c]) => card(id, c)).join('');
  const hv = s.caneHarvester, colh = `<article class="glass ccard ccard--maq"><div class="ccard__photo"><img src="assets/maq-colhedora.webp" alt="colhedora de cana" loading="lazy"><span class="tag tag--green">cana</span>${hv ? '<span class="tag tag--gold ccard__own">na fazenda</span>' : ''}</div>
      <div class="ccard__body"><h4>Colhedora de cana Case A9000</h4><p class="price">${brl(hv ? hv.value : CN.HARVESTER.price)}</p>
        <p class="small good perk">vantagem: corte de ${brl(CN.LOGI.cutThird)} para ${brl(CN.LOGI.cutOwn)} por tonelada</p><p class="muted small">manutenção, diesel e operador: ${brl(CN.HARVESTER.upkeep)}/mês</p>
        ${hv ? `<button class="btn btn--glass" data-act="cn-sellharv">vender por ${brl(hv.value * 0.85)}</button>` : '<button class="btn btn--gold" data-act="cn-buyharv">comprar</button>'}</div></article>`;
  $('#maq').innerHTML = `<h4 class="maq__t">🍊 para pomar de laranja ${hasO ? '<span class="tag tag--green">você tem pomar</span>' : '<small class="muted">(rendem quando você tiver um pomar)</small>'}</h4><div class="cards cards--cars">${list('laranja')}</div>`
    + `<h4 class="maq__t">🌾 para canavial ${hasC ? '<span class="tag tag--green">você tem canavial</span>' : '<small class="muted">(rendem quando você tiver um canavial)</small>'}</h4><div class="cards cards--cars">${colh}${list('cana')}</div>`;
}

// ---------- loja unificada: carros, pesados, máquinas, galpões, empresas e Feirão 21 ----------
let lojaCat = 'carros';
function renderLoja(c) {
  if (c) lojaCat = c;
  document.querySelectorAll('[data-loja]').forEach(b => b.classList.toggle('is-on', b.dataset.loja === lojaCat));
  document.querySelectorAll('[data-lojap]').forEach(p => { p.hidden = p.dataset.lojap !== lojaCat; });
  if (lojaCat === 'carros' || lojaCat === 'pesados' || lojaCat === 'agro') renderCarros();
  if (lojaCat === 'galpoes') $('#loja-wh').innerHTML = NGU.whHTML();
  if (lojaCat === 'empresas') $('#loja-biz').innerHTML = MIU.shopCard() + NGU.shopHTML();
  if (lojaCat === 'feirao') SHUI.render();
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-loja], [data-loja-go]'); if (!t) return;
  const c = t.dataset.loja || t.dataset.lojaGo;
  if (t.dataset.lojaGo) G.goto('loja');
  renderLoja(c);
});

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
const mi = v => `${Math.round(v / 1e6)}M`;
const BIZ_LISTS = NG.LISTS;
function profileExtra(p, me) {
  const tr = p.trophies || [];
  const trophies = `<h3>troféus de patrimônio <small class="muted">${tr.length} de ${L.TROPHIES.length}</small></h3><div class="pf__troph">${L.TROPHIES.map((t, i) => `<span class="troph${tr.includes(t) ? ' is-got' : ''}${i === 0 ? ' troph--selo' : ''}" title="${i === 0 ? 'selo' : 'troféu'} de ${mi(t)}"><b>${i === 0 ? '🎖️' : '🏆'}</b><small>${mi(t)}</small></span>`).join('')}</div>`;
  const priv = me && tr.includes(L.PRIVATE_MIN) ? `<div class="pf__acts"><button class="btn btn--glass btn--sm" data-act="toggle-private">${S().privateProfile ? '🔒 perfil privado (tornar público)' : '🔓 perfil público (tornar privado)'}</button></div>` : me ? '<p class="muted small">Ao chegar a R$ 10 milhões você ganha o selo e pode deixar o perfil privado.</p>' : '';
  if (p.private && !me) return trophies + '<p class="pf__private glass">🔒 Este jogador deixou o perfil privado. Só os troféus aparecem.</p>';
  if (p.noCard) return trophies + '<p class="pf__private glass">Este jogador ainda está numa versão antiga do jogo. Os detalhes aparecem assim que ele abrir ou recarregar o jogo.</p>';
  const biz = (p.biz || []).map(b => { const c = BIZ_LISTS[b.cat]?.[b.brand]; return c ? `<span class="pf__biz" style="--img:url(assets/biz/${b.brand}.webp)"><small>${esc(c.name)}</small></span>` : ''; }).join('');
  const tiles = [['empresas', (p.biz || []).length], ['contador', p.npc ? `${brl(CT.npcFee(p.worth))}/mês` : p.acct ? `contratado (${CT.PLANS[p.acct]?.label || p.acct})` : 'não tem'], ['mina de ouro', p.mina ? 'sim' : 'não'], ['galpões', p.wh || 0], ['granja', `${p.granja || 0} galpões`], ['suínos', `${p.suinos || 0} barracões`], ['cartas raras', p.cardsN || 0], ['clube', p.club || 'nenhum']]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${esc(String(v))}</strong></div>`).join('');
  const lands = (p.landList || []).length ? `<ul class="pf__lands">${p.landList.map(l => `<li>${int(l.ha)} ha · ${esc(l.region)}${l.orchard ? ' · pomar' : ''}${l.cane ? ' · canavial' : ''}</li>`).join('')}</ul>` : '';
  const ads = (p.listings || []).length ? `<h3>à venda agora <small class="muted">no Feirão 21</small></h3><ul class="pf__ads">${p.listings.map(l => `<li><span>${esc(l.label)}</span><b>${brl(l.price)}</b></li>`).join('')}</ul><div class="pf__acts"><button class="btn btn--gold btn--sm" data-loja-go="feirao" data-act="close-profile">ver no Feirão</button></div>` : '';
  return trophies + priv + (p.biz || p.landList ? `<h3>tudo o que tem</h3><div class="pf__stats">${tiles}</div>${biz ? `<div class="pf__bizs">${biz}</div>` : ''}${lands}` : '') + ads;
}
function openProfile(pid, fetched) {
  if (!pid) return;
  let p = fetched || C.findProfile(pid);
  if (!p && String(pid).startsWith('u:')) { Auth.profileCard(pid.slice(2)).then(r => r ? openProfile(pid, r) : say('Perfil indisponível agora.', true)); return; }
  if (!p) return say('Perfil indisponível: o jogador saiu.', true);
  if (p.npc && !p.trophies) p = { ...p, trophies: L.TROPHIES.filter(t => p.worth >= t) };
  const me = pid === 'me', st = p.stats || {};
  if (p.npc && !p.ach) p.ach = P.ACHIEVEMENTS.slice(0, p.achCount).map(a => a.id);
  const rate = st.hands ? Math.round((st.wins / st.hands) * 100) : 0;
  const xp = me ? `<div class="pf__xp"><span class="small">nível ${p.level}, ${S().xp} de ${P.xpNeed(S().level)} XP</span><span class="bar"><i style="transform:scaleX(${S().xp / P.xpNeed(S().level)})"></i></span></div>` : '';
  $('#pf').innerHTML = `
    <div class="pf__head">
      <span class="pf__avatar">${avatarSVG(p.look, { label: p.name })}</span>
      <div><h2 id="pf-name">${esc(p.name)}</h2><p><span class="tag tag--gold">nível ${p.level}</span> <span class="tag tag--dark">${esc(p.rank)}</span></p>
      <p class="big">${brl(p.worth)}</p><p class="muted small">patrimônio</p>${xp}${p.bio ? `<p class="pf__bio">“${esc(p.bio)}”</p>` : ''}</div>
    </div>
    <div class="pf__stats">
      ${[['mãos de 21', int(st.hands || 0)], ['vitórias', `${int(st.wins || 0)} (${rate}%)`], ['maior prêmio', `${int(st.best || 0)} fichas`], ['corridas', `${int(st.races || 0)}, ${int(st.raceWins || 0)} acertos`],
        ['terras', p.lands == null ? '—' : `${p.lands} (${int(p.ha || 0)} ha)`], ['gado', p.heads == null ? '—' : `${int(p.heads)} cabeças`], ['canil e haras', p.animals ? `${p.animals.length} animais` : '—']].map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('')}
    </div>
    ${profileExtra(p, me)}
    <h3>garagem</h3>
        <div class="pf__cars">${(p.cars || []).length ? p.cars.map(m => L.CARS[m] ? `<span class="pf__car"><img src="assets/${L.CARS[m].img}.webp" alt=""><small>${esc(L.CARS[m].name)}</small></span>` : '').join('') : '<p class="muted small">Sem carros ainda.</p>'}</div>
    <h3>conquistas ${p.ach?.length || 0} de ${P.ACHIEVEMENTS.length}</h3>
    <ul class="achs">${P.ACHIEVEMENTS.map(a => `<li class="${p.ach?.includes(a.id) ? 'is-got' : ''}"><span class="badge__medal" aria-hidden="true"></span>${esc(a.txt)}</li>`).join('')}</ul>
    ${!me && TUI.online().some(x => x.pid === pid) ? `<div class="pf__acts"><button class="btn btn--gold" data-act="trade-invite" data-id="${esc(pid)}">propor troca</button></div>` : ''}
    ${me ? `<div class="pf__acts"><button class="btn btn--glass" data-act="edit-char">editar personagem</button>${Auth.account() ? '<button class="btn btn--glass" data-act="logout">sair da conta</button><button class="btn btn--danger btn--sm" data-act="wipe">apagar meus dados</button>' : ''}</div>${Auth.account() ? `<p class="muted small">Conta: ${esc(Auth.account().email)}</p>` : ''}` : ''}`;
  const dlg = $('#dlg-profile');
  if (!dlg.open) dlg.showModal();
}

// nome e foto de cada tipo de item (inventário, loja e trocas). Tipo novo sem entrada aqui ainda ganha nome e foto genéricos.
export const ITEM_KIND = { car: 'veículo', animal: 'animal', land: 'terra', good: 'armazém', card: 'carta rara', player: 'jogador de futebol', squad: 'futebol', club: 'clube de futebol', aviario: 'granja', galpao: 'galpão', empresa: 'empresa', acc: 'acessório' };
const GOOD_IMG = { soja: 'farm-soja', milho: 'farm-colheita', cafe: 'farm-cafe', laranja: 'farm-laranja' };
export function itemMedia(i) {
  const d = i.data || {};
  if (i.kind === 'car' && L.CARS[d.model]) return `<img src="assets/${L.CARS[d.model].img}.webp" alt="" loading="lazy">`;
  if (i.kind === 'animal') return `<img src="${ST.photo(d, S())}" alt="" loading="lazy">`;
  if (i.kind === 'land' && d.lat) return `<img src="${satThumb(d).url}" alt="" loading="lazy">`;
  if (i.kind === 'good') return `<img src="assets/${GOOD_IMG[i.good] || 'farm-colheita'}.webp" alt="" loading="lazy">`;
  if (i.kind === 'card') return `<span class="icard__cardart" style="background-image:url(assets/cards/${d.champ}.webp)"></span>`;
  if (i.kind === 'player' || i.kind === 'squad' || i.kind === 'club') return '<img src="assets/photo-stadium.webp" alt="" loading="lazy">';
  if (i.kind === 'acc') return `<div class="fcard__acc">${avatarSVG({ ...S().avatar, acc: i.acc }, { label: i.acc })}</div>`;
  if (i.kind === 'galpao') return `<img src="assets/wh-${d.type}.webp" alt="" loading="lazy">`;
  if (i.kind === 'empresa') return `<img src="assets/biz/${d.brand}.webp" alt="" loading="lazy">`;
  if (i.kind === 'aviario') return `<img src="assets/${GR.HOUSES[d.type]?.img || 'granja-galpao'}.webp" alt="" loading="lazy">`;
  return '<img src="assets/photo-chips.webp" alt="" loading="lazy">';
}
// inventário: tudo o que o jogador tem, e quem está online para negociar
let invCat = 'all';
document.addEventListener('click', e => { const b = e.target.closest('[data-invcat]'); if (b) { invCat = b.dataset.invcat; renderInv(); } });
function renderInv() {
  const items = TD.inventory(S());
  const total = items.reduce((t, i) => t + (i.value || 0), 0);
  $('#inv-sum').textContent = `${items.length} itens trocáveis, ${int(S().chips)} fichas e ${brl(S().money)} em dinheiro`;
  const players = items.filter(i => i.kind === 'player'), shown = items.filter(i => i.kind !== 'player');
  if (players.length) shown.push({ kind: 'squad', label: `elenco do ${S().fut?.club || 'clube'}: ${players.length} jogadores`, value: players.reduce((t, i) => t + i.value, 0) });
  const n = SHUI.invCats();
  $('#inv-cats').innerHTML = [['all', 'tudo'], ...Object.entries(SH.CATS)].filter(([k]) => k === 'all' || n[k]).map(([k, v]) => `<button class="shop-cat${invCat === k ? ' is-on' : ''}" data-invcat="${k}">${v}${k !== 'all' ? ` <small>${n[k]}</small>` : ''}</button>`).join('');
  $('#inv-items').innerHTML = SHUI.mineHTML(invCat);
  renderFeira();
  const ppl = TUI.online();
  $('#inv-peers').innerHTML = ppl.length ? ppl.map(p => `<li><span class="who__av">${avatarSVG(p.look || {}, { label: p.name })}</span><span>${esc(p.name)}<small class="muted"> nível ${p.level}</small></span>
    <button class="btn btn--gold btn--sm" data-act="trade-invite" data-id="${esc(p.pid)}">propor troca</button></li>`).join('') : '<li class="muted small">Nenhuma pessoa online agora. Chame os amigos pelo link do jogo.</li>';
  const npcOn = NPC.onlineNow(Live.now(), 10);
  $('#inv-peers').insertAdjacentHTML('beforeend', npcOn.map(n => `<li><span class="who__av">${avatarSVG(n.look, { label: n.nick })}</span><span>${esc(n.nick)}<small class="muted"> nível ${NPC.levelFor(NPC.worthAt(n, S().month))}</small></span>
    <button class="btn btn--glass btn--sm" data-profile="npc:${n.id}">ver perfil</button></li>`).join(''));
}
// visual estável por nome de bot
const NPC_LOOK = n => NPC.byNick(n)?.look || NPC_LOOK_HASH(n);
const NPC_LOOK_HASH = n => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return { skin: 1 + h % 5, hair: ['curto', 'degradê', 'longo', 'coque', 'raspado', 'boné'][h % 6], hairColor: 1 + (h >> 3) % 5, beard: ['nenhuma', 'por fazer', 'cavanhaque'][(h >> 5) % 3], outfit: ['camisa', 'jaqueta', 'terno'][(h >> 7) % 3], cloth: 1 + (h >> 9) % 6, acc: ['óculos escuros', 'corrente de ouro', 'nenhum'][(h >> 11) % 3] }; };
// cartas raras: coleção, chances de cada raridade e álbum de campeões
function renderCartas() {
  const cs = [...(S().cards || [])].sort((a, b) => CD.value(b) - CD.value(a));
  $('#cd-sum').textContent = cs.length ? `${cs.length} cartas, valem ${brl(cs.reduce((t, c) => t + CD.value(c), 0))}` : 'nenhuma carta ainda';
  $('#cd-list').innerHTML = cs.map(c => `<div class="tcard-slot">${CD.cardHTML(c, { small: true })}<button class="btn btn--glass btn--sm" data-act="card-sell" data-id="${c.id}">vender ${brl(Math.round(CD.value(c) * CD.SELL))}</button></div>`).join('') || '<p class="empty glass">Ganhe cartas na roleta do dia ou abra um pacote. Cartas valem dinheiro, pagam terras e trocam com outros jogadores.</p>';
  $('#cd-packs').innerHTML = Object.entries(CD.PACKS).map(([k, P]) => `<button class="cd-packbtn cd-packbtn--${k}" data-act="card-pack" data-id="${k}"><b>${P.label}</b><span>${P.hint}</span><span class="cd-packbtn__ev">valor médio ${brl(Math.round(CD.packEV(k) / 1000) * 1000)}</span><span class="cd-packbtn__left">${CD.packsLeft(S(), k) > 0 ? `restam ${CD.packsLeft(S(), k)} este mês` : 'esgotado este mês'}</span><strong>${brl(P.price)}</strong></button>`).join('');
  const tot = CD.TIERS.reduce((t, x) => t + x.w, 0);
  $('#cd-odds').innerHTML = CD.TIERS.map(t => `<div class="cd-odd cd-odd--${t.id}"><b>${t.label}</b><span>${(t.w / tot * 100).toFixed(t.w / tot < 0.01 ? 2 : 1).replace('.', ',')}%</span><small>a partir de ${brl(t.base * 0.85)}</small></div>`).join('');
  const have = new Set(cs.map(c => c.champ));
  $('#cd-album').innerHTML = CD.CHAMPS.map(ch => `<div class="cd-slot${have.has(ch.id) ? ' is-have' : ''}">${CD.cardHTML({ id: `al-${ch.id}`, champ: ch.id, tier: have.has(ch.id) ? cs.find(c => c.champ === ch.id).tier : 'bronze' }, { small: true })}</div>`).join('');
}
// feira dos bots: o índice da economia vem do ranking (patrimônio dos jogadores)
let econ = 1, econAt = 0;
function renderFeira() {
  if (Date.now() - econAt > 60000) { econAt = Date.now(); Auth.ranking?.().then(r => { const v = FE.econIndex((r || []).map(x => Number(x.worth))); if (Math.abs(v - econ) > 0.001) { econ = v; if (currentTab === 'inventario') renderFeira(); } }).catch(() => {}); }
  const f = FE.refresh(S(), econ);
  $('#fe-idx').textContent = `economia dos jogadores: ${f.idx >= 1.02 ? 'aquecida' : f.idx <= 0.98 ? 'fraca' : 'estável'} (preços ${f.idx >= 1 ? '+' : ''}${Math.round((f.idx - 1) * 100)}%)`;
  const GROUPS = [['car', 'Veículos seminovos'], ['good', 'Safra e armazém'], ['acc', 'Acessórios com vantagem']];
  const IMG = { soja: 'farm-soja', milho: 'farm-colheita', cafe: 'farm-cafe' };
  const dealTag = it => { const d = Math.round((it.ask / it.value - 1) * 100); return d <= -3 ? `<span class="fcard__deal is-good">${-d}% abaixo da referência</span>` : d >= 3 ? `<span class="fcard__deal is-high">${d}% acima da referência</span>` : '<span class="fcard__deal">preço de referência</span>'; };
  const media = it => it.kind === 'car' ? `<img src="assets/${L.CARS[it.model].img}.webp" alt="" loading="lazy">`
    : it.kind === 'good' ? `<img src="assets/${IMG[it.good] || 'farm-soja'}.webp" alt="" loading="lazy">`
    : `<div class="fcard__acc">${avatarSVG({ ...S().avatar, acc: it.acc, hair: S().avatar.hair }, { label: it.acc })}</div>`;
  const card = it => `<article class="fcard fcard--${it.kind}">
    <div class="fcard__media">${media(it)}<span class="fcard__kind">${{ car: 'seminovo', good: `${it.qty} sacas`, acc: 'usado' }[it.kind]}</span>${dealTag(it)}</div>
    <div class="fcard__body">
      <h4>${esc(it.label.replace(' (usado, com vantagem)', ''))}</h4>
      ${it.kind === 'acc' && PK.ACC_PERKS[it.acc] ? `<p class="fcard__perk">${esc(PK.label(PK.ACC_PERKS[it.acc]))}</p>` : ''}
      <div class="fcard__seller"><span class="fcard__av">${avatarSVG(NPC_LOOK(it.bot), { label: it.bot })}</span><span>${esc(it.bot)}<small>nível ${NPC.byNick(it.bot) ? NPC.levelFor(NPC.worthAt(NPC.byNick(it.bot), S().month)) : 1}</small></span></div>
      <div class="fcard__price"><b>${brl(it.ask)}</b><small>referência ${brl(it.value)}</small></div>
      <button class="btn btn--gold fcard__go" data-act="fe-buy" data-id="${it.id}">negociar</button>
    </div></article>`;
  $('#fe-list').innerHTML = f.list.length ? GROUPS.map(([k, title]) => { const items = f.list.filter(x => x.kind === k); return items.length ? `<div class="fgroup"><h4 class="fgroup__t">${title}</h4><div class="fgroup__grid">${items.map(card).join('')}</div></div>` : ''; }).join('') : '<p class="empty glass">As bancas estão vazias. Volte no próximo mês do mundo.</p>';
  const w = f.want;
  $('#fe-want').innerHTML = w ? `<article class="fwant"><span class="fcard__av fwant__av">${avatarSVG(NPC_LOOK(w.bot), { label: w.bot })}</span>
    <div class="fwant__txt"><strong>${esc(w.bot)}</strong> quer comprar <strong>${esc(w.label)}</strong><small>oferece <b class="good">${brl(w.bid)}</b> · vale cerca de ${brl(w.value)}</small></div>
    <button class="btn btn--gold" data-act="fe-sell">negociar a venda</button></article>` : '';
}
function feiraBuy(id) {
  const it = S().feira?.list.find(x => x.id === id); if (!it) return;
  openDeal({ title: it.label, sub: `Valor de referência ${brl(it.value)}.`, who: it.bot, deal: FE.buyDeal(it), onDone: price => {
    if (!price) return;
    const err = FE.buy(S(), id, price);
    if (err) return say(err[0].toUpperCase() + err.slice(1), true);
    note(`feira: ${it.label} de ${it.bot}`, -price); award('trade'); confetti(30); say(`Comprado por ${brl(price)}.`); save(); render();
  } });
}
function feiraSell() {
  const w = S().feira?.want; if (!w) return;
  openDeal({ title: `vender ${w.label}`, sub: `Ele ofereceu ${brl(w.bid)} de primeira. Peça mais, mas sem exagero.`, who: w.bot, deal: FE.sellDeal(w), onDone: price => {
    if (!price) return;
    const err = FE.sell(S(), price);
    if (err) return say(err[0].toUpperCase() + err.slice(1), true);
    note(`feira: venda de ${w.label} para ${w.bot}`, price); award('trade'); say(`Vendido por ${brl(price)}.`); save(); render();
  } });
}
G.onLobby = l => { TUI.attach(l); CHUI.attach(l); SHUI.attach(l); LEU.attach(l); };
G.onAuctionMsg = d => LEU.onMsg(d);
G.mineOwnCard = () => MIU.ownCard();
G.mineShopCard = () => MIU.shopCard();
G.onShopMsg = (d, peer) => SHUI.onMsg(d, peer);
G.onPeers = () => { if (currentTab === 'inventario') renderInv(); SHUI.onPeers(); };
document.addEventListener('submit', e => { if (e.target.id === 'tr-chat-form') { e.preventDefault(); TUI.chat(); } });

// desempenho: cada aba só é desenhada quando está aberta (ou quando o usuário entra nela)
const PANELS = { personagem: () => renderChar(), terras: () => renderTerras(), gado: () => renderGado(), mercado: () => renderMercado(),
  carros: () => renderLoja('carros'), suinos: () => SUU.render(), negocios: () => NGU.render(), banco: () => renderBanco(), livro: () => renderLivro(), equipe: () => SFU.render(), haras: () => { SUI.render(); LEU.render(); }, futebol: () => FUI.render(), inventario: () => renderInv(), ranking: () => RKUI.render(), laranja: () => renderPomar(), cana: () => renderCana(), cartas: () => renderCartas(), granja: () => renderGranja(), loja: () => renderLoja(), mesa: () => C.renderLobby() };
let currentTab = 'mesa';
// cada parte da tela desenha separada: se uma der erro, as outras continuam (a tela nunca fica travada)
let uiErrAt = 0;
function uiError(e, where) {
  console.error(where, e);
  if (Date.now() - uiErrAt > 20000) { uiErrAt = Date.now(); say('Algo não carregou direito nesta tela. Seu progresso está salvo; se continuar, troque de aba ou recarregue.', true); }
}
function render() {
  { const n = SF.active(S()).length, b = document.getElementById('team-badge'); if (b) { b.hidden = !n; b.textContent = n; } }
  for (const [f, w] of [[renderHud, 'hud'], [renderMissions, 'missões'], [PANELS[currentTab], currentTab], [() => CTU.inject(currentTab), 'contador']]) { try { f?.(); } catch (e) { uiError(e, w); } }
  try { C.announce(); } catch (e) { console.error(e); }
}
G.render = () => { render(); G.onRender?.(); };
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
  'fe-buy'(id) { feiraBuy(id); },
  'fe-sell'() { feiraSell(); },
  'card-close'() { $('#dlg-card').close(); },
  'fe-goto'() { $('.feira').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  'gr-buy'(id) { const H = GR.HOUSES[id]; if (!confirm(`Construir ${H.label} por ${brl(H.price)}?`)) return; const err = GR.buyHouse(S(), id); if (err) return say(err[0].toUpperCase() + err.slice(1), true); note(`granja: ${H.label}`, -H.price); award('land'); confetti(40); say(`${H.label} pronto para receber pintinhos.`); },
  'gr-house'(id) { const q = Number($(`#gr-q-${id}`)?.value), v = !!$(`#gr-v-${id}`)?.checked, r = GR.house(S(), id, q, v); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true); note(`granja: compra de ${int(r.birds)} pintinhos (pago 1 vez)`, -r.cost); say(`${int(r.birds)} pintinhos alojados por ${brl(r.cost)}. A ração é cobrada em cada fechamento do mês. Venda no 2º mês, com ~2,8 kg.`); },
  'gr-sell'(id) { const l = GR.ensure(S()).lots.find(x => x.id === id); if (l && l.age < 2 && !confirm('Ainda não chegou no ponto (2º mês). Vender mesmo assim?')) return; const r = GR.sellLot(S(), id); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true); note(`granja: venda de ${int(r.lot.birds)} frangos`, r.amount); confetti(50); sfx.play('stack', 0.6); say(`Lote vendido ao frigorífico por ${brl(r.amount)}.`); },
  'gr-sellhouse'(id) { if (!confirm('Vender este galpão?')) return; const r = GR.sellHouse(S(), id); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true); note('granja: venda de galpão', r.amount); say(`Galpão vendido por ${brl(r.amount)}.`); },
  'pm-plant'(id) { const l = find(S().lands, id); if (!confirm(`Plantar pomar de laranja em ${l.ha} ha por ${brl(l.ha * PM.ORANGE.plant)}? A primeira colheita vem em ${PM.ORANGE.grow} meses e depois a cada ${PM.ORANGE.cycle}.`)) return; const err = PM.plant(S(), l); if (err) return say(err[0].toUpperCase() + err.slice(1), true); note(`pomar de laranja, ${l.ha} ha`, -l.ha * PM.ORANGE.plant); award('plant'); say('Mudas plantadas. Mantenha o defensivo ligado para segurar a praga.'); },
  'cn-plant'(id) { const l = find(S().lands, id), lg = CN.logistics(S(), l); if (!confirm(`Plantar cana em ${l.ha} ha por ${brl(l.ha * CN.CANE.plant)}? Primeiro corte em ${CN.CANE.first} meses, depois a cada ${CN.CANE.cycle}. Usina a ${lg.km} km.`)) return; const err = CN.plant(S(), l); if (err) return say(err[0].toUpperCase() + err.slice(1), true); note(`plantio de cana, ${l.ha} ha`, -l.ha * CN.CANE.plant); award('plant'); say('Cana plantada. Deixe os tratos culturais ligados para segurar a broca.'); },
  'cn-care'(id) { const on = CN.toggleCare(find(S().lands, id)); say(on ? 'Tratos culturais ligados.' : 'Tratos desligados: a broca e o mato vão tomar a cana.', !on); },
  'cn-uproot'(id) { if (!confirm('Arrancar o canavial? Depois você pode plantar de novo (reforma).')) return; CN.uproot(find(S().lands, id)); say('Canavial arrancado. A terra está livre para replantar.'); },
  'cn-buyharv'() { if (!confirm(`Comprar colhedora por ${brl(CN.HARVESTER.price)}? O corte cai de ${brl(CN.LOGI.cutThird)} para ${brl(CN.LOGI.cutOwn)} por tonelada, com custo fixo de ${brl(CN.HARVESTER.upkeep)}/mês.`)) return; const err = CN.buyHarvester(S()); if (err) return say(err[0].toUpperCase() + err.slice(1), true); note('compra de colhedora de cana', -CN.HARVESTER.price); confetti(40); say('Colhedora na fazenda!'); },
  'cn-sellharv'() { if (!confirm('Vender a colhedora?')) return; const v = CN.sellHarvester(S()); note('venda da colhedora', v); say(`Colhedora vendida por ${brl(v)}.`); },
  'pm-sellall'() { const s = S(), n = s.stock.laranja || 0; if (!n) return; const v = n * s.prices.laranja * (1 - L.MARKET_FEE); s.stock.laranja = 0; s.money += v; note(`venda de ${int(n)} caixas de laranja`, v); confetti(30); say(`Laranja vendida por ${brl(v)}.`); },
  'pm-spray'(id) { const l = find(S().lands, id), on = PM.toggleSpray(l); say(on ? 'Defensivo ligado: a praga cai e a colheita fica cheia.' : 'Defensivo desligado: a praga vai subir e a colheita cai.', !on); },
  'pm-uproot'(id) { if (!confirm('Arrancar o pomar? Você perde as árvores.')) return; PM.uproot(find(S().lands, id)); say('Pomar arrancado. A terra está livre.'); },
  'ab-kill'(id) { const h = find(S().herd, id); if (!h) return; const r = AB.slaughter(S(), h.id); if (r.err) return say(r.err, true); note(`abate de ${r.heads} bois${r.own ? ` (${r.own} no seu frigorífico)` : ' (frigorífico de terceiros)'}`, r.amount); confetti(30); say(`Lote abatido: ${brl(r.amount)}.`); },
  'ab-build'() { if (!confirm(`Construir seu frigorífico por ${brl(AB.OWN.price)}? Abate até ${AB.OWN.cap} bois por mês, paga mais pela arroba e vende o couro. Custo fixo de ${brl(AB.OWN.fixed)} por mês.`)) return; const err = AB.build(S()); if (err) return say(err[0].toUpperCase() + err.slice(1), true); note('construção do frigorífico', -AB.OWN.price); confetti(60); say('Frigorífico pronto! Ele já está aberto para outros jogadores abaterem aqui pagando a sua taxa.'); setTimeout(FN.publish, 300); },
  'ab-killp'(id) { FN.killAt(id); },
  'ab-sellplant'() { if (!confirm('Vender o frigorífico?')) return; FN.close(); const v = AB.sellPlant(S()); note('venda do frigorífico', v); say(`Frigorífico vendido por ${brl(v)}.`); },
  'ab-buyfat'() { const n = qty('fat'); const r = AB.buyAndSlaughter(S(), n); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true); note(`compra de ${n} bois gordos para abate`, -r.cost); note(`abate de ${n} bois no seu frigorífico`, r.amount); say(`${n} bois abatidos: lucro de ${brl(r.profit)}.`, r.profit < 0); },
  'rk-cat'(id) { RKUI.setCat(id); },
  'rk-page'(id) { RKUI.setPage(id); },
  'rk-online'() { RKUI.toggleOnline(); },
  'shop-sell'(id) { SHUI.sellNow(id); },
  'shop-list'(id) { SHUI.listItem(id); },
  'shop-unlist'(id) { SHUI.unlist(id); },
  'shop-buy'(id) { SHUI.buy(id); },
  'shop-cat'(id) { SHUI.setCat(id); },
  'shop-npc'(id) { SHUI.buyNpc(id); },
  'shop-offer-yes'(id) { SHUI.acceptOffer(id); },
  'shop-offer-no'(id) { SHUI.rejectOffer(id); },
  'ft-take'(id) { FUI.take(id); },
  'ft-slot'(id) { FUI.openSlot(id); },
  'ft-pick'(id) { FUI.pick(id); },
  'ft-auto'() { FUI.autoXI(); },
  'ft-div'(id) { FUI.setPickDiv(id); },
  'ft-haggle'(id) { FUI.haggle(id); },
  'ft-quick'() { FUI.quick(); },
  'ft-stadium'() { FUI.stadium(); },
  'ft-offer-yes'(id) { FUI.answer(id, true); },
  'ft-offer-no'(id) { FUI.answer(id, false); },
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
  'tr-dur'(id) { TR.pickDur(id); },
  'tr-tf'(id) { TR.pickTf(id); },
  'tr-asset'(id) { TR.pickAsset(id); },
  'edit-char'() { $('#dlg-profile').close(); G.goto('personagem'); },
  'close-profile'() { const d = $('#dlg-profile'); if (d.open) d.close(); },
  'toggle-private'() { const s = S(); if (!(s.trophies || []).includes(L.PRIVATE_MIN)) return say('O perfil privado libera aos R$ 10 milhões.', true); s.privateProfile = !s.privateProfile; save(); say(s.privateProfile ? 'Perfil privado: os outros só veem seus troféus.' : 'Perfil público de novo.'); openProfile('me'); },
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
  'buy-land-cards'(idv) {
    const o = find(S().offers, idv); if (!o) return;
    if (!confirm(`Pagar ${brl(o.value)} com cartas? Cada carta vale ${Math.round(CD.LAND_RATE * 100)}% do valor dela e o troco volta em dinheiro.`)) return;
    const r = CD.payWith(S(), o.value);
    if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
    S().offers.splice(S().offers.indexOf(o), 1); S().lands.push({ ...o, own: true, leasedOut: false });
    note(`compra de ${o.ha} ha com ${r.used.length} cartas`, r.change); award('land'); confetti(50);
    say(`Terra comprada com ${r.used.length} carta${r.used.length > 1 ? 's' : ''}.${r.change ? ` Troco: ${brl(r.change)}.` : ''}`);
  },
  'card-pack'(id) {
    const P = CD.PACKS[id || 'ouro'], r = CD.openPack(S(), id || 'ouro');
    if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
    note(P.label, -P.price); showCard(r.cards);
  },
  'card-sell'(id) {
    const c = (S().cards || []).find(x => x.id === id); if (!c) return;
    if (!confirm(`Vender ${CD.label(c)} para a loja por ${brl(Math.round(CD.value(c) * CD.SELL))}?`)) return;
    const v = CD.sell(S(), id); note(`venda da carta ${CD.label(c)}`, v); say(`Carta vendida por ${brl(v)}.`);
  },
  'rent-land'(idv) {
    const o = find(S().offers, idv); if (!o) return;
    S().offers.splice(S().offers.indexOf(o), 1); S().lands.push({ ...o, own: false, leasedOut: false });
    say(`Arrendada por ${brl(o.value * L.RENT_PAY)} ao mês (reajuste de ${Math.round(L.RENT_RAISE * 100)}% ao ano). Pasto para ${L.landCap(o)} cabeças. Lavoura só com trator. O aluguel pago abate a compra depois.`); award('land');
  },
  'buy-rented'(idv) {
    const l = find(S().lands, idv), price = L.buyRentedPrice(l);
    if (!confirm(`Comprar esta terra por ${brl(price)}? O aluguel que você já pagou abate ${brl(L.rentCredit(l))}.`)) return;
    const err = L.buyRented(S(), l);
    if (err) return say(err[0].toUpperCase() + err.slice(1), true);
    note(`compra de ${l.ha} ha, ${l.region} (abatendo aluguel)`, -price); award('land'); confetti(60); say('Agora a terra é sua: sem aluguel, com todas as vantagens.');
  },
  'return-land'(idv) { const l = find(S().lands, idv); S().lands.splice(S().lands.indexOf(l), 1); say('Terra devolvida ao dono.'); },
  lease(idv) { const l = find(S().lands, idv); l.leasedOut = !l.leasedOut; say(l.leasedOut ? 'Contrato de arrendamento assinado.' : 'Terra de volta para o seu uso.'); },
  'sell-land'(idv) {
    const l = find(S().lands, idv);
    const v = Math.round(l.value * 0.95 + (PM.orchardValue(S(), l) + CN.caneValue(S(), l)) * 0.9);
    if (!confirm(`Vender ${l.ha} ha em ${l.region} por ${brl(v)}?${l.crop ? ' A lavoura plantada vai junto.' : ''}${l.orchard ? ' O pomar vai junto (já está no preço).' : ''}`)) return;
    S().lands.splice(S().lands.indexOf(l), 1); S().money += v; note(`venda de ${l.ha} ha, ${l.region}`, v); say('Terra vendida.');
  },
  plant(idv) {
    const l = find(S().lands, idv), crop = $(`#crop-${idv}`)?.value, cost = L.plantCost(S(), crop, l.ha, !l.own);
    if (!crop) return;
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
    const v = h.heads * L.arrobas(h.kg) * S().prices.arroba * (1 - L.cattleFee(S())) * PK.mult(S(), 'cattle');
    S().herd.splice(S().herd.indexOf(h), 1); S().money += v; note(`venda de ${h.heads} cabeças`, v); say(`Lote vendido por ${brl(v)}.`); award('sellherd');
  },
  'buy-good'(k) { const n = qty(`q-${k}`); NG.ensure(S()); if (n > NG.room(S(), k)) return say(`Não cabe no armazém: dá para guardar mais ${int(NG.room(S(), k))}. Compre galpões na loja.`, true); if (n && pay(n * S().prices[k], `compra de ${n} sacas de ${GOODS[k]}`)) { S().stock[k] += n; say('Mercadoria no armazém.'); } },
  'sell-good'(k) {
    const n = Math.min(qty(`q-${k}`), S().stock[k]);
    if (!n) return say(`Você não tem ${GOODS[k]} no armazém.`, true);
    const v = n * S().prices[k] * (1 - L.MARKET_FEE);
    S().stock[k] -= n; S().money += v; note(`venda de ${n} sacas de ${GOODS[k]}`, v); say(`Vendido por ${brl(v)}.`);
  },
  'buy-car'(id) {
    const c = L.CARS[id];
    if (c.type === 'maquina' && !PM.COVER[id] && S().cars.some(x => x.model === id)) return say('Essa máquina já está na sua fazenda.', true);
    if (!confirm(`Comprar ${c.name} por ${brl(c.price)}?`)) return;
    if (!pay(c.price, `loja 21: ${c.name}`)) return;
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
    S().loans.push({ id: S().nextId++, bal: v, rate: +(L.BANK_RATE * PK.mult(S(), 'loan')).toFixed(4), left: 12, missed: 0 });
    S().money += v; note('empréstimo do banco, 12 parcelas', v); say(`${brl(v)} na conta. A parcela sai todo mês.`);
  },
  payoff(idv) { const l = find(S().loans, idv); if (pay(l.bal, 'quitação de empréstimo', false)) { S().loans.splice(S().loans.indexOf(l), 1); say('Dívida quitada.'); } },
  lend(idv) {
    const b = find(S().borrowers, idv);
    if (b && pay(b.amount, `empréstimo para ${b.name}`, false)) {
      S().borrowers.splice(S().borrowers.indexOf(b), 1);
      S().lent.push({ id: b.id, name: b.name, bal: b.amount, rate: b.rate, left: b.months, risk: b.risk });
      say(`${b.name} assinou a promissória.`); award('lend');
    }
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
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  try { const r = ACTS[act]?.(b.dataset.id, b); if (r?.catch) r.catch(e => { uiError(e, act); save(); render(); }); } catch (e) { uiError(e, act); save(); render(); return; }
  if (['rl-double', 'pass-claim', 'st-train', 'trade-invite', 'trade-yes', 'trade-no', 'trade-add', 'trade-chips', 'trade-money', 'trade-remove', 'trade-lock', 'trade-confirm', 'trade-cancel', 'ft-play', 'ft-close', 'ft-quick', 'rk-cat', 'rk-page', 'rk-online', 'shop-cat', 'shop-sell', 'shop-list', 'shop-unlist', 'shop-buy', 'ft-slot', 'ft-pick', 'ft-auto', 'fe-buy', 'fe-sell', 'fe-goto', 'card-close', 'ft-haggle', 'job-start', 'job-accept', 'job-confirm', 'job-repair', 'double', 'split', 'logout', 'wipe', 'st-enter', 'stable-close', 'sit', 'leave-table', 'invite', 'bet', 'hit', 'stand', 'bet-clear', 'race-go', 'race-pick', 'race-next', 'mute', 'rl-spin', 'rl-clear', 'av-press', 'tr-buy', 'tr-sell', 'tr-dur', 'tr-tf', 'tr-asset', 'spin-daily', 'map-lot', 'show-card'].includes(act)) return;
  checkAch(); save(); render();
});
$('#map-back').addEventListener('click', () => { lmap?.flyTo([-14, -51], 4, { duration: 1.4 }); $('#map-title').textContent = 'satélite'; });
document.addEventListener('input', e => { if (e.target.name === 'tr-amt') TR.tick(); });

// abas do futebol: ao vivo e apostas / meu clube
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fsub]'); if (!b) return;
  document.querySelectorAll('[data-fsub]').forEach(x => x.classList.toggle('is-on', x === b));
  $('#fsub-live').hidden = b.dataset.fsub !== 'live'; $('#fsub-clube').hidden = b.dataset.fsub !== 'clube';
  FB.setActive(b.dataset.fsub === 'live');
});

// quem está em cada jogo agora: você + jogadores de verdade (anel roxo) + quantos jogadores da casa estão nas mesas
const HOUSE_BOTS = { 21: ['bot-dorival', 'bot-azul', 'bot-porto', 'bot-esm', 'bot-vip', 'bot-dia', 'bot-high', 'bot-mag'], roleta: ['rl'], aviator: ['av'],
  truco: ['tr-boteco', 'tr-praca', 'tr-ouro', 'tr-magnata'], sinuca: ['sn-bar', 'sn-clube', 'sn-pro', 'sn-magnata'],
  poker: ['pk-calcada', 'pk-boteco', 'pk-praca', 'pk-clube', 'pk-fazenda', 'pk-pro', 'pk-leilao', 'pk-vip', 'pk-magnata', 'pk-diamante', 'pk-high', 'pk-dono'] };
let curSub = '21';
function liveStrip() {
  const onMesa = !$('#p-mesa')?.hidden;
  C.setPlay({ game: onMesa ? curSub : null, ...(onMesa ? {} : { bet: 0, out: 0 }) });
  if (!onMesa) return;
  const box = document.getElementById(`sub-${curSub}`); if (!box) return;
  let el = box.querySelector(':scope > .live-strip');
  if (!el) { el = document.createElement('div'); el.className = 'live-strip glass'; box.prepend(el); }
  const real = C.playersIn(curSub), bots = (HOUSE_BOTS[curSub] || []).flatMap(id => BOTS(id));
  const av = (name, look, cls) => `<span class="ls-p ${cls}" title="${esc(name)}"><span class="ls-av">${avatarSVG(look || {}, { label: name })}</span><em>${esc(name)}</em></span>`;
  el.innerHTML = `<span class="ls-t"><i></i>jogando agora</span><div class="ls-list">${av('você', profileOf().look, 'is-me')}${real.map(p => av(p.name, p.look, 'is-real')).join('')}
    ${bots.slice(0, 6).map(n => av(n, NPC.byNick(n)?.look, 'is-bot')).join('')}</div>
    <span class="ls-n"><b>${real.length + 1}</b> de verdade · <b>${bots.length}</b> da casa</span>`;
}
setInterval(liveStrip, 4000);

// abas internas do cassino
function showSub(name) {
  curSub = name; setTimeout(liveStrip, 0);
  document.querySelectorAll('[data-sub]').forEach(b => b.classList.toggle('is-on', b.dataset.sub === name));
  for (const s of ['21', 'roleta', 'aviator', 'truco', 'sinuca', 'poker']) document.getElementById(`sub-${s}`).hidden = s !== name;
  AV.setActive(name === 'aviator' && !$('#p-mesa').hidden);
  if (name === 'truco') TRU.renderLobby(); if (name === 'sinuca') SNU.renderLobby(); if (name === 'poker') PKU.renderLobby();
}

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

// nome: pode trocar a cada 10 meses do mundo (a troca vale quando você sai do campo ou aperta Enter)
function nameLocked() { return S().nameAt != null && S().month < S().nameAt + 10; }   // troca de nome: a cada 10 meses do mundo
$('#char-name').addEventListener('change', e => {
  if (nameLocked()) return;
  const n = e.target.value.trim().slice(0, 18);
  if (n.length < 3) { say('O nome precisa ter pelo menos 3 letras.', true); e.target.focus(); return; }
  S().avatar.name = n; S().nameAt = S().month; save();
  say(`Nome salvo: ${n}. A próxima troca libera no mês ${S().month + 10} do mundo.`);
  render();
});
$('#char-name').addEventListener('input', e => {
  if (nameLocked()) { e.target.value = S().avatar.name; return; }
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
  try { CTU.inject(name); } catch (e) { console.error(e); }
  if (name === 'terras') setTimeout(initMap, 50);
  if (name === 'trader') TR.tick();
  if (name === 'corridas') RC.relayout();
  AV.setActive(name === 'mesa' && !$('#sub-aviator').hidden);
  FB.setActive(name === 'futebol' && !$('#fsub-live').hidden);
  document.querySelectorAll('[data-mnav]').forEach(b => b.classList.toggle('is-on', b.dataset.mnav === name));
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

// abertura blindada: se um dado antigo do save quebrar alguma parte, o jogo abre mesmo assim (e mostra o erro para corrigirmos)
const bootErrs = [];
const safe = (what, fn) => { try { fn(); } catch (e) { console.error(what, e); bootErrs.push(`${what}: ${e?.message || e}`); } };
safe('aba inicial', () => show(location.hash.slice(1)));
// aplicativo instalável e cache dos arquivos (só no site publicado, em https)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__booted = true;   // a página sabe que o jogo abriu (ver o socorro da abertura no index.html)
requestAnimationFrame(() => setTimeout(() => { $('#splash')?.classList.add('is-gone'); setTimeout(() => $('#splash')?.remove(), 600); }, 250));
safe('corridas', () => RC.initRacing());
safe('roleta', () => RL.initRoulette());
safe('investimentos', () => TR.initTrader());
safe('tela', () => render());
safe('salão', () => C.initCasino());
if (bootErrs.length) { window.__bootErrs = bootErrs; try { localStorage.setItem('21world.lastBootError', JSON.stringify({ at: Date.now(), v: APP_VERSION, errs: bootErrs })); } catch {} setTimeout(() => say(`Uma parte do jogo não carregou (${bootErrs[0].slice(0, 120)}). Mande um print para o suporte.`, true), 1500); }
// login: sem Supabase configurado segue local; com ele, a tela de entrada aparece antes de tudo
Auth.boot().then(async st => {
  if (st === 'gate' || st === 'recovery') return;
  const live = await Live.start().catch(() => 'off');
  if (live !== 'banned') maybeDaily();
});

// efeito ao clicar: anel dourado + faíscas (só em botões; respeita "reduzir movimento")
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn, .opt, .subtab, .clubcard, [data-tab]');
  if (!b || b.disabled || RM.matches) return;
  const at = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; document.body.append(el); return el; };
  const ring = at(Object.assign(document.createElement('span'), { className: 'fx-ripple' }), e.clientX, e.clientY);
  setTimeout(() => ring.remove(), 520);
  if (!b.matches('.btn--gold, .clubcard')) return;
  for (let i = 0; i < 8; i++) {
    const s = at(Object.assign(document.createElement('span'), { className: 'fx-spark' }), e.clientX, e.clientY), a = (i / 8) * Math.PI * 2 + Math.random() * 0.5, d = 28 + Math.random() * 26;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }], { duration: 480 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => s.remove());
  }
  sfx.play('chip', 0.12);
}, { passive: true });

// revelação de carta nova (pacote ou roleta)
function showCard(cs) {
  const list = Array.isArray(cs) ? cs : [cs], order = CD.TIERS.map(t => t.id);
  const best = [...list].sort((a, b) => order.indexOf(b.tier) - order.indexOf(a.tier))[0];
  const d = $('#dlg-card'), box = $('#cd-reveal'), high = ['diamante', 'mestre', 'challenger'].includes(best.tier);
  const total = list.reduce((t, c) => t + CD.value(c), 0);
  box.className = `cd-reveal cd-reveal--${best.tier}${list.length > 1 ? ' is-multi' : ''}`;
  box.innerHTML = '<div class="cd-pack"><span>21 WORLD<br>pacote de cartas</span></div>';
  $('#cd-reveal-txt').innerHTML = 'abrindo...';
  if (!d.open) d.showModal();
  sfx.play('handle', 0.6);
  setTimeout(() => {
    box.innerHTML = list.map((c, i) => `<div class="cd-reveal__one" style="animation-delay:${i * 180}ms">${CD.cardHTML(c, { small: list.length > 1 })}</div>`).join(''); box.classList.add('is-burst');
    $('#cd-reveal-txt').innerHTML = list.length > 1
      ? `<strong>${list.length} cartas</strong>: valem juntas <b class="good">${brl(total)}</b>${high ? `<br><b class="good">CARTA RARA: ${esc(CD.label(best))}!</b>` : ''}`
      : `<strong>${esc(CD.label(best))}</strong><br>vale ${brl(total)}${high ? '<br><b class="good">CARTA RARA!</b>' : ''}`;
    sfx.play('stack', 0.8); confetti(best.tier === 'challenger' ? 260 : high ? 160 : 50);
    if (best.tier === 'mestre' || best.tier === 'challenger') d.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(6px,-3px)' }, { transform: 'translate(0,0)' }], { duration: 300, iterations: 2 });
  }, RM.matches ? 0 : 950);
  save(); render();
}
// cartas inclinam com o mouse (efeito 3D) e o brilho holográfico acompanha
document.addEventListener('pointermove', e => {
  const card = e.target.closest?.('.tcard'); if (!card || RM.matches) return;
  const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  card.style.setProperty('--ry', `${(x - 0.5) * 18}deg`); card.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
  card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`);
});
document.addEventListener('pointerout', e => { const card = e.target.closest?.('.tcard'); if (card && !card.contains(e.relatedTarget)) { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); } });

// mini tutorial sempre visível no topo de cada aba
const HOWTO = {"mesa":["Como jogar no salão de jogos",["Escolha uma mesa de 21 (ou crie a sua) e sente.","Coloque suas fichas na aposta e confirme. Fichas vêm do caixa (R$ 10 cada).","Peça carta (H), pare (S), dobre ou divida. Chegar mais perto de 21 que o dealer, sem passar, ganha. Blackjack paga 3 para 2.","Na roleta e no Aviator o caminho é o mesmo: aposte fichas e acompanhe o resultado.","No truco você e um parceiro enfrentam uma dupla: peça truco, aceite, corra ou aumente. Partida até 12 pontos; a dupla vencedora leva 1,9x a entrada.","Na sinuca (bola 8) mire tocando na mesa, escolha a força e taque. Encaçape as suas (lisas ou listradas) e termine na 8.","No pôquer (Texas Hold'em) você senta com 100 big blinds: desista, dê mesa, pague, aumente ou vá all-in. Levantou, as fichas voltam para o caixa.","Truco, sinuca e pôquer também têm mesas online: crie a sua e mande o link para os amigos."]],"trader":["Como funciona a mesa de operações",["Escolha o ativo (boi, soja, dólar ou bitcoin) e o tamanho das velas (1, 5 ou 10 min) para ler o gráfico.","Digite o valor e o tempo da operação: 1, 5 ou 10 minutos.","Clique em \"sobe\" se acha que o preço vai estar mais alto no fim do tempo, ou \"desce\" se vai estar mais baixo.","O valor sai na hora. Acertou: recebe 1,85x. Errou ou ficou igual: perde o valor. Não dá para desistir no meio.","A faixa de cotações no topo mostra os preços ao vivo em qualquer tela."]],"futebol":["Como funciona o futebol",["Ao vivo e apostas: as Séries A, B e C rodam sozinhas, uma rodada a cada 4 minutos. Veja a classificação, o relatório dos times e aposte nos jogos da próxima rodada (resultado, gols, escanteios, cartões, saída de bola ou placar exato).","Dono de clube recebe cota de TV a cada jogo do seu time no Brasileirão ao vivo, com bônus quando vence.","Escolha um clube real e pague o valor para assumir.","Em \"próximo jogo\" defina formação e estilo e assista à partida (ou simule rápido).","No mercado, contrate jogadores (negocie o preço) e venda os que sobram; no estádio, aumente a bilheteria.","Fique entre os 4 primeiros para subir de divisão; os 4 últimos caem."]],"ranking":["Como funciona o ranking",["O ranking junta todos os jogadores do 21 World e muda ao vivo.","Veja quanto falta para passar quem está na sua frente.","Troque a categoria: patrimônio, nível, fazendeiros (hectares) e cassino (maior prêmio).","Toque em qualquer jogador para ver o perfil."]],"loja":["Como funciona a loja",["Tudo que é seu aparece aqui: cavalos, galgos, carros, terras, sacas, cartas, jogadores e o seu clube.","\"Vender agora\" paga na hora o preço da loja.","\"Anunciar\" deixa você escolher o preço: outros jogadores online veem e compram na hora.","Se nenhum jogador comprar, um comprador da loja pode levar, pagando no máximo 5% acima do preço de venda na hora.","Na parte de baixo ficam os anúncios dos outros jogadores: carros, máquinas, terras, cavalos, gado, produtos, cartas e jogadores de futebol. Os anúncios mudam a cada 10 minutos.","Use as categorias no topo para achar mais rápido."]],"cartas":["Como funcionam as cartas raras",["Abra pacotes ou ganhe cartas na roleta do dia.","Quanto mais rara (bronze, prata, esmeralda, diamante, mestre, challenger), mais vale.","Use como moeda: troque com outros jogadores no inventário, pague terras ou venda para a loja.","Complete o álbum com os 12 campeões.","Cartas valorizam todo mês do mundo: quanto mais rara, mais valoriza (até 40 meses). Segure as raras para vender caro depois.","Pacotes têm estoque limitado por mês: quando esgota, só no mês seguinte."]],"inventario":["Como funciona o inventário",["Aqui está tudo que você pode trocar: carros, terras, animais, jogadores e cartas.","Na feira, negocie a compra e venda: oferta muito baixa faz o negociante desistir.","Com outro jogador online, use \"propor troca\": os dois montam a oferta, ficam prontos e confirmam.","Cartas valem dinheiro e podem pagar terras."]],"haras":["Como funciona o canil e haras",["Leilão de cavalos de raça o dia inteiro, um atrás do outro (5 minutos de lances cada): Puro-Sangue Inglês, Quarto de Milha, Árabe, Mangalarga e Crioulo, com pedigree de 1 a 5 estrelas. Dê lances ao vivo contra outros jogadores; quem estiver na frente no fim leva.","Compre um animal no leilão do mês.","Treine: cada treino gasta 1 das 4 semanas do mês e cansa o animal.","Inscreva em uma prova da sua classe. Corrida também gasta uma semana.","\"Sem semanas\" = acabaram as 4 semanas do mês do mundo. O mês passa sozinho (relógio no topo, igual para todos) e as semanas voltam.","Só o 1º e o 2º lugar dão lucro. Animal lesionado precisa de veterinário."]],"corridas":["Como funciona a corrida de galgos",["Escolha o cachorro em quem vai apostar e o valor em fichas.","Quanto menor a chance dele, maior o retorno.","Clique em \"apostar e largar\" e acompanhe a corrida."]],"personagem":["Como funciona o personagem",["Escolha o visual e o nome.","Itens pagos (acessórios, roupas) são seus para sempre.","Cada acessório dá uma vantagem permanente: veja a lista \"suas vantagens\"."]],"terras":["Como funcionam as terras",["Escolha um lote à venda e veja o benefício que ele dá ao comprar.","Comprar é o melhor negócio: a terra valoriza, rende vantagens, serve de garantia no banco, planta sem restrição e pode ser arrendada a terceiros.","Arrendar de terceiros custa aluguel todo mês (+8% ao ano), não dá vantagem nenhuma e a lavoura só é permitida com trator, com 20% a mais de custo e 15% da safra para o dono.","Se arrendou e gostou, compre: o aluguel que você já pagou abate o preço (até 40%).","Dá para pagar a compra também com cartas.","Na terra própria dá para plantar pomar de laranja: forma em 6 meses e colhe a cada 4. Deixe o defensivo ligado: sem ele a praga sobe, a safra cai até ser perdida inteira e o greening pode matar o pomar (perde todo o investimento)."]],"cana":["Como funciona o canavial",["Canavial só na terra própria: R$ 11 mil por hectare para plantar.","Primeiro corte (cana-planta) em 10 meses; depois corta de novo a cada 10 meses (soca). Cada corte rende uns 12% menos: depois de 5 cortes, reforme.","No corte a cana vai direto para a usina: ela paga por tonelada e você paga corte, carregamento e frete (quanto mais longe a usina, mais caro).","Colhedora própria barateia o corte e caminhão próprio barateia o frete.","Deixe os tratos culturais ligados: sem eles a broca e o mato derrubam a produção. Na seca (julho a outubro) pode pegar fogo."]],"laranja":["Como funciona o pomar de laranja",["Pomar só na terra própria: compre terra na aba terras e plante aqui (R$ 18 mil por hectare).","São 6 meses de formação; depois colhe a cada 4 meses, cerca de 330 caixas por hectare, direto para o armazém.","Deixe o defensivo ligado (R$ 650 por hectare por mês): ele segura a praga.","Sem defensivo a praga sobe: a safra cai e com praga muito alta você perde a colheita inteira. O greening pode matar o pomar.","Venda as caixas aqui ou no mercado quando o preço estiver bom."]],"granja":["Como funciona a granja",["Construa um galpão: quanto maior e mais moderno, mais aves e menos ração por kg (o climatizado não sofre com calor).","Aloje os pintinhos no galpão vazio. Vacinar custa pouco e evita perder muitas aves numa doença.","A cada mês do mundo eles crescem e comem ração (o maior custo). Energia e mão de obra também são pagas todo mês.","Venda no 2º mês (cerca de 2,8 kg por ave): é o ponto de lucro. Depois disso comem muito e quase não ganham peso.","Preço do frango, do pintinho e da ração mudam todo mês: fique de olho."]],"gado":["Como funciona o gado",["Compre bezerros no leilão. Quem tem terra deixa no pasto de graça (cerca de 1 cabeça por hectare) e engorda 18 kg por mês.","Sem terra também dá: o gado vai para o confinamento terceirizado (boitel), paga R$ 95 por cabeça por mês e engorda 22 kg.","Venda quando o boi chegar perto de 450 kg e o preço da arroba estiver bom.","Na venda escolha: revender vivo ou abater. Abater em terceiros paga um pouco mais; no seu frigorífico paga bem mais e ainda vende o couro (até 300 bois por mês).","Com frigorífico próprio dá para comprar boi gordo pronto e abater na hora.","Dono de frigorífico pode terceirizar: abre para outros jogadores, escolhe a taxa por cabeça e recebe taxa + couro de cada boi deles. Quem não tem frigorífico vê o botão \"abater no frigorífico de...\" quando houver um aberto com vaga, e recebe mais que no terceiro comum."]],"mercado":["Como funciona o mercado",["Veja o preço de soja, milho e café, que variam todo mês.","Guarde a colheita no armazém e venda quando o preço subir."]],"loja":["Como funciona a loja 21",["Tudo o que se compra fica aqui, em seções: carros, caminhões e tratores, máquinas agrícolas, galpões e empresas (bancos, provedores e supermercados).","No Feirão 21 os jogadores anunciam de tudo. Anúncio de jogador online aparece na hora para todo mundo, no celular também.","Para vender: anuncie pelo seu preço (no Feirão ou direto no inventário) ou venda na hora para a loja.","Os jogadores do mundo anunciam sempre mais caro e fazem propostas pelos seus anúncios; se você estiver endividado, eles oferecem menos."]],"suinos":["Como funciona a suinocultura",["Compre um barracão: os maiores e tecnificados gastam menos ração por kg e perdem menos animais.","Aloje leitões de ~23 kg (vacine: sem vacina um surto pode levar parte do lote).","Eles engordam ~24 kg por mês comendo ração (o maior custo). Venda por volta do 4º mês (~120 kg): depois disso a engorda cai.","Preço do suíno, do leitão e da ração mudam todo mês."]],"negocios":["Como funcionam os negócios",["Compre a marca na loja (categoria empresas): vem só a marca, sem dinheiro em caixa. Folha e despesas saem do seu bolso todo mês.","Banco: coloque dinheiro no caixa para emprestar. Os clientes pedem valores pequenos, que crescem devagar com o tempo. Juros mais altos = mais calote.","Provedor: construa portas de fibra (caro) e escolha a mensalidade. Assinantes entram e cancelam todo mês.","Supermercado: escolha o nível de preço. Preço baixo atrai clientes; preço alto espanta.","Lucro pequeno, mas a marca valoriza devagar: é investimento de longo prazo.","Galpões aumentam o armazém: sem espaço, a colheita que sobra é vendida na hora com desconto."]],"carros":["Como funciona a concessionária",["Todo carro tem uma vantagem permanente (entregas, XP, provas...).","Você paga IPVA e seguro todo mês e o carro desvaloriza.","Vender na loja devolve 92% do valor atual.","Tem pomar de laranja ou canavial? Aparecem as máquinas da sua cultura: pulverizador e plataforma para a laranja; colhedora, transbordo e rodotrem para a cana. Cada uma barateia um custo de verdade."]],"banco":["Como funciona o banco",["Peça empréstimo usando terras e gado como garantia.","Pague as parcelas em dia: 2 atrasadas e o banco toma a terra.","Você também pode emprestar dinheiro a outras pessoas e ganhar juros, com risco de calote."]],"livro":["Livro-caixa",["Aqui fica o registro de tudo que entrou e saiu do seu dinheiro."]]};
for (const [id, [title, steps]] of Object.entries(HOWTO)) {
  const p = document.getElementById(`p-${id}`);
  if (p) p.insertAdjacentHTML('afterbegin', `<details class="howto" ${matchMedia('(max-width: 40rem)').matches ? '' : 'open'}><summary class="howto__t">${title}</summary><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol></details>`);   // no celular começa fechado: toque no título para abrir
}

// ---------- faixas dos mais ricos: aviso ao entrar (e ao sair) ----------
function trophyCheck() {
  const s = S(), w = L.netWorth(s); s.trophies ??= [];
  const nw = L.TROPHIES.filter(t => w >= t && !s.trophies.includes(t)); if (!nw.length) return;
  s.trophies.push(...nw); save(); confetti(160);
  const t = nw[nw.length - 1];
  say(t === L.PRIVATE_MIN ? 'Selo de R$ 10 milhões conquistado! Agora você pode deixar o perfil privado (no seu perfil).' : `Troféu de R$ ${Math.round(t / 1e6)} milhões conquistado! Ele fica no seu perfil para sempre.`);
}
function eliteCheck() {
  trophyCheck();
  const s = S(), i = L.eliteIdx(s), was = s.eliteSeen ?? -1;
  if (i === was) return;
  s.eliteSeen = i; save();
  if (i > was && i >= 0) {
    const e = L.ELITE[i];
    const d = $('#dlg-elite'); if (!d) return;
    $('#el-title').textContent = i === 0 ? 'Agora você começa sua jornada de mais ricos do mundo!' : `Nova faixa: ${e.name}`;
    $('#el-body').innerHTML = `<p>Seu patrimônio passou de <b>${brl(e.min)}</b>. Você está entre os mais ricos do 21 World, e o mundo cobra por isso:</p>
      <ul><li>tudo o que você compra custa <b>${Math.round(e.price * 100)}% a mais</b>;</li><li>as contas do mês ficam <b>${Math.round((e.bills - 1) * 100)}% mais caras</b>;</li><li>o mundo fica com <b>${Math.round(e.gain * 100)}% de tudo o que você ganha</b> no mês;</li><li>imposto sobre grandes fortunas de <b>${(e.tax * 100).toFixed(2).replace('.', ',')}% ao mês</b> sobre tudo o que passar de ${brl(L.ELITE[0].min)}.</li></ul>
      <p class="muted small">Quanto mais alto, mais pesado. É assim que o jogo segura a distância entre os jogadores.</p>`;
    d.showModal(); confetti(120);
  } else say(i < 0 ? 'Você saiu da faixa dos mais ricos: taxas e preços voltaram ao normal.' : `Você voltou para a faixa ${L.ELITE[i].name}.`);
}
setTimeout(() => eliteCheck(), 4000);
// reembolso único do imposto alto de v46–v51 (ver L.taxRefund)
function refund52() {
  const s = S(); if (s.refund52) return;
  if (!Live.worldReady || !Live.world() || !s.worldSync) return setTimeout(refund52, 5000);   // espera o relógio do mundo
  const v = L.taxRefund(s.log, W.current(Live.world(), 1795154969000)); s.refund52 = true;
  if (v > 0) { s.money += v; note('reembolso: imposto dos mais ricos cobrado a mais (versões 46 a 51)', v); say(`Reembolso de ${brl(v)}: o imposto dos mais ricos tinha ficado alto demais e foi corrigido.`); }
  save(); render();
}
setTimeout(refund52, 6000);
// coroa do 1º lugar: quem lidera o ranking paga mais caro em tudo
function topCheck() {
  const me = Auth.account()?.id; if (!me) return;
  Auth.ranking?.().then(rows => {
    if (!rows?.length) return;
    const top = rows[0].user_id === me, s = S();
    if (top === !!s.top1) return;
    s.top1 = top; save();
    say(top ? `Você é o 1º do ranking! A coroa pesa: compras +${Math.round(L.TOP1.price * 100)}% a mais, contas e imposto dobrados e +${Math.round(L.TOP1.gain * 100)}% de pedágio sobre os ganhos.` : 'Você saiu do 1º lugar: a taxa extra da coroa acabou.', top);
  }).catch(() => {});
}
setInterval(topCheck, 60000); setTimeout(topCheck, 8000);

// ---------- tempo de mundo: o mês passa sozinho, igual para todos ----------
// Um relógio único (config do servidor) define o mês do mundo. O jogo do jogador acompanha: roda os meses que faltam
// (no máximo 6 de uma vez, quem ficou muito tempo fora é "perdoado"), sem botão para adiantar o próprio mês.
function worldMonths() { G.newsQuiet = true; try { worldMonths0(); } finally { G.newsQuiet = false; } }   // fechamento do mês não vira notícia na TV 21
function worldMonths0() {
  const w = Live.world(), t = Live.now(), target = W.current(w, t), s = S();
  GR.ensure(s); PM.ensure(s); AB.ensure(s); CN.ensure(s); SU.ensure(s); NG.ensure(s); CD.setMonth(s.month); CD.ensure(s);
  if (s.worldSync !== true) { s.month = target; s.worldSync = true; CD.setMonth(s.month); save(); render(); return; }     // primeira vez: entra no mês atual do mundo
  const p = W.plan(s.month, target);
  if (!p.ticks || C.busyRound() || SUI.isRunning()) return;
  if (p.skipped) { s.month += p.skipped; note(`o mundo avançou ${p.skipped} meses enquanto você esteve fora (sem cobranças)`); }
  const before = s.money, logBefore = s.log.length; let harvests = 0;
  const closes = [];   // o que cada fechamento lançou (o contador mostra exatamente isso)
  for (let i = 0; i < p.ticks; i++) {
    const lines = L.tick(s), rec = [...lines], N = l => { note(l.txt, l.val); rec.push(l); };
    for (const l of ST.monthly(s)) N(l);
    for (const l of GR.monthly(s)) N(l);
    for (const l of PM.monthly(s)) N(l);
    for (const l of CN.monthly(s)) N(l);
    for (const l of SU.monthly(s)) N(l);
    for (const l of NG.monthly(s)) N(l);
    for (const l of MI.monthly(s)) { N(l); if (l.big) { confetti(220); say(l.txt); } }
    for (const l of NG.enforce(s)) { N(l); say(l.txt[0].toUpperCase() + l.txt.slice(1) + '. Compre galpões na loja.', true); }
    for (const l of AB.monthly(s)) N(l);
    for (const l of CT.monthly(s, L.netWorth(s))) N(l);
    closes.push({ m: s.month, rec });
    harvests += lines.filter(l => l.txt.startsWith('colheita')).length;
    award('month');
  }
  { const mo = s.log.slice(0, Math.max(0, s.log.length - logBefore)), spent = -mo.filter(l => l.val < 0).reduce((t, l) => t + l.val, 0), earned = mo.filter(l => l.val > 0).reduce((t, l) => t + l.val, 0); for (const l of L.eliteBills(s, spent, earned)) { note(l.txt, l.val); closes.at(-1)?.rec.push(l); } }   // os mais ricos pagam mais
  for (const c of closes) CT.record(s, c.m, c.rec);
  eliteCheck();
  if (harvests) award('harvest', harvests);
  CD.setMonth(s.month);
  document.getElementById('worldclock')?.classList.remove('is-new'); void document.body.offsetWidth; document.getElementById('worldclock')?.classList.add('is-new');
  say(p.ticks > 1 || p.skipped ? `O mundo avançou até ${W.dateLabel(s.month)}. Saldo: ${brl(s.money - before)}.` : `Chegou ${W.dateLabel(s.month)}. Saldo do mês: ${brl(s.money - before)}.${harvests ? ' Colheita no armazém.' : ''}`);
  checkAch(); save(); render();
}
let fcCache = { at: 0, month: -1, v: [] };
G.ctForecast = () => {
  const s0 = S(); if (fcCache.month === s0.month && Date.now() - fcCache.at < 15000) return fcCache.v;
  const rec = [];
  try {
    const s = structuredClone(s0), rng = () => 0.5;
    rec.push(...L.tick(s, rng));
    for (const m of [ST, GR, PM, CN, SU, NG]) rec.push(...m.monthly(s, rng));
    rec.push(...MI.monthly(s, rng), ...NG.enforce(s), ...AB.monthly(s), ...CT.monthly(s, L.netWorth(s)));
    const spent = -rec.filter(l => l.val < 0).reduce((t, l) => t + l.val, 0), earned = rec.filter(l => l.val > 0).reduce((t, l) => t + l.val, 0);
    rec.push(...L.eliteBills(s, spent, earned));
  } catch (e) { console.error('previsão do contador', e); }
  fcCache = { at: Date.now(), month: s0.month, v: rec }; return rec;
};
function worldClock() {
  const w = Live.world(), t = Live.now();
  const m = W.current(w, t);
  $('#wc-m').textContent = `${W.monthName(m)}, ano ${W.yearOf(m)}`;
  $('#wc-bar').style.transform = `scaleX(${W.progress(w, t).toFixed(3)})`;
  $('#wc-left').textContent = `${W.monthName(m + 1)} em ${W.fmt(W.msLeft(w, t))}`;
  for (const el of document.querySelectorAll('.biz-pay')) { el.querySelector('.biz-pay__t').textContent = W.fmt(W.msLeft(w, t)); el.querySelector('i').style.transform = `scaleX(${W.progress(w, t).toFixed(3)})`; }
}
setInterval(() => { if (!Live.worldReady) return; worldClock(); worldMonths(); }, 1000);
// clique no relógio do mundo: tabela do que cada faixa de fortuna paga por mês
function openTaxes() {
  const me = L.eliteIdx(S()), pct = v => `${(v * 100).toFixed(v < 0.01 ? 2 : 1).replace('.', ',').replace(/,0$/, '')}%`;
  const rows = L.ELITE.map((e0, i) => { const e = L.eliteOf({ money: e0.min, lands: [], herd: [], loans: [], lent: [], cars: [], stock: {}, prices: {} });
    return `<tr${i === me ? ' class="is-me"' : ''}><td><b>${e0.min >= 1e9 ? `R$ ${e0.min / 1e9} bi` : `R$ ${String(e0.min / 1e6).replace('.', ',')} mi`}</b>+<small class="muted"><br>${esc(e0.name)}${i === me ? ' · <b>você</b>' : ''}</small></td><td class="num">${pct(e.gain)}</td><td class="num">${pct(e.tax)}</td><td class="num">+${pct(e.price)}</td><td class="num">+${pct(e.bills - 1)}</td></tr>`; }).join('');
  $('#tx-body').innerHTML = `<div class="scroll"><table><thead><tr><th>patrimônio</th><th class="num" title="parte de tudo o que você ganha no mês que fica com o mundo">dos ganhos</th><th class="num" title="sobre o patrimônio acima de R$ 3 mi">imposto/mês</th><th class="num">compras</th><th class="num">contas</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted"><b>dos ganhos</b>: parte de tudo o que você ganha no mês que fica com o mundo. O imposto ao mês é sobre o que passar de ${brl(L.ELITE[0].min)}. O 1º do ranking paga ainda mais: +${Math.round(L.TOP1.gain * 100)} pontos nos ganhos, imposto em dobro e compras +${Math.round(L.TOP1.price * 100)}%. Abaixo de ${brl(L.ELITE[0].min)} só há o imposto de renda simples sobre os ganhos do mês.</p>`;
  $('#dlg-taxes').showModal();
}
$('#worldclock').addEventListener('click', openTaxes);
$('#worldclock').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTaxes(); } });

// ---------- tela cheia: o jogo inteiro (botão do topo) ou só a área de cada jogo ----------
// Celular sem suporte (iPhone) usa uma "tela cheia" própria: a área ocupa a tela toda por cima do resto.
function setFsLabels() {
  const on = !!document.fullscreenElement || !!document.querySelector('.is-fs');
  document.querySelectorAll('[data-fs]').forEach(b => { const me = document.fullscreenElement === document.getElementById(b.dataset.fs) || document.getElementById(b.dataset.fs)?.classList.contains('is-fs') || (b.dataset.fs === 'app' && document.fullscreenElement === document.documentElement); b.textContent = me ? 'sair da tela cheia' : 'tela cheia'; b.setAttribute('aria-pressed', me); });
  document.body.classList.toggle('has-fs', on);
}
function toggleFs(id) {
  const el = id === 'app' ? document.documentElement : document.getElementById(id);
  const pseudo = document.querySelector('.is-fs');
  if (pseudo) { pseudo.classList.remove('is-fs'); return setFsLabels(); }
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { el.classList.add('is-fs'); setFsLabels(); });
  else { el.classList.add('is-fs'); setFsLabels(); }
}
for (const id of ['mesa', 'corridas', 'trader', 'futebol', 'haras', 'cartas', 'loja', 'ranking', 'granja', 'laranja', 'cana']) {
  document.getElementById(`p-${id}`)?.insertAdjacentHTML('afterbegin', `<button class="btn btn--glass btn--sm fs-btn" type="button" data-fs="p-${id}" aria-pressed="false">tela cheia</button>`);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-fs]'); if (b) toggleFs(b.dataset.fs); });
document.addEventListener('fullscreenchange', setFsLabels);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.is-fs')) toggleFs(); });

// ---------- aviso de atualização: quando uma versão nova é publicada, todos veem o pedido para recarregar ----------
// O GitHub Pages marca todos os arquivos com a hora da publicação (Last-Modified); se ela muda, saiu versão nova.
// Versão do código. Para avisar todo mundo, suba o número aqui E no version.json (só em atualização importante).
const APP_VERSION = 59;
let updateShown = false, updateMsg = '';
let checking = false;
async function checkUpdate() {
  if (updateShown || checking) return;   // uma verificação por vez (senão saem dois avisos e duas contagens)
  checking = true;
  try { await checkUpdateNow(); } finally { checking = false; }
}
async function checkUpdateNow() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json(), v = Number(j.v) || 0;
    if (v <= APP_VERSION) return;
    // já recarregou por causa desta versão: nunca de novo (sem laço); o código novo entra sozinho na próxima abertura
    let tried = false; try { tried = sessionStorage.getItem('21world.updTried') === String(v); } catch {}
    if (tried) return;
    // o GitHub publica o version.json antes do resto: só recarrega quando o código novo já está no ar
    const g = await fetch(`game.js?t=${Date.now()}`, { cache: 'no-store' }).then(x => (x.ok ? x.text() : '')).catch(() => '');
    if ((Number(g.match(/APP_VERSION = (\d+)/)?.[1]) || 0) < v) return;   // ainda propagando: tenta de novo em 30 s
    updateMsg = String(j.msg || '').slice(0, 140);
    showUpdate(true, v);
  } catch {}
}
// a página recarrega sozinha em 15 s, a não ser que a pessoa esteja no meio de uma mão, corrida, turno ou troca
G.busy = () => busyNow();
const busyNow = () => C.busyRound() || SUI.isRunning() || !!document.querySelector('#dlg-race[open], #dlg-match[open], #dlg-trade[open], #dlg-deal[open], #dlg-card[open]');
async function doReload() {
  const b = $('#upd-go'); if (b) { b.disabled = true; b.textContent = 'salvando...'; }
  save();
  try { await Promise.race([Auth.push?.(), new Promise(r => setTimeout(r, 3000))]); } catch {}   // manda o progresso para a nuvem antes
  try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch {}
  location.reload();
}
function showUpdate(auto = true, v = 0) {
  updateShown = true;
  try { sessionStorage.setItem('21world.updTried', String(v)); } catch {}
  const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body;   // janela aberta deixa o resto sem clique
  host.insertAdjacentHTML('beforeend', `<div class="upd" role="status" title="${esc(updateMsg)}"><span class="upd__dot" aria-hidden="true"></span>
    <span><strong>Atualização</strong> <span id="upd-txt">recarrega em 15 s</span></span>
    <button class="upd__go" type="button" id="upd-go">agora</button><button class="upd__x" type="button" id="upd-x" aria-label="fechar aviso">×</button></div>`);
  $('#upd-go').addEventListener('click', doReload);
  $('#upd-x').addEventListener('click', () => { closed = true; document.querySelector('.upd')?.remove(); });
  let closed = false; const node = document.querySelector('.upd');
  if (!auto) return;
  let left = 15;
  const t = setInterval(() => {
    if (closed) { clearInterval(t); return; }
    if (!node.isConnected) document.body.append(node);   // a janela onde estava fechou: volta para a tela
    if (busyNow()) { $('#upd-txt').textContent = 'depois da jogada'; return; }
    if (--left <= 0) { clearInterval(t); doReload(); return; }
    $('#upd-txt').textContent = `recarrega em ${left} s`;
  }, 1000);
}
checkUpdate(); setInterval(checkUpdate, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
addEventListener('focus', checkUpdate);

// ---------- instalar como aplicativo (Android e computador; no iPhone é pelo "Adicionar à Tela de Início") ----------
let installEv = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; $('#btn-install').hidden = false; });
addEventListener('appinstalled', () => { $('#btn-install').hidden = true; say('21 World instalado! Abra pelo ícone na tela inicial.'); });
$('#btn-install')?.addEventListener('click', async () => { if (!installEv) return; installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; $('#btn-install').hidden = true; });

SHUI.init({ itemMedia, ITEM_KIND, announceFn: () => C.announce() });

// menu de abas: rodinha do mouse rola de lado e a aba escolhida sempre aparece inteira
{
  const tabs = document.querySelector('.tabs');
  tabs?.addEventListener('wheel', e => { if (tabs.scrollWidth > tabs.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tabs.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  tabs?.addEventListener('click', e => e.target.closest('[role="tab"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }));
}

document.addEventListener('click', e => { const g = e.target.closest('[data-tab-go]'); if (g) G.goto(g.dataset.tabGo); });

// celular: menu em grade montado a partir das abas (cada área com ícone, tudo à vista)
{
  const grid = document.getElementById('mnav-grid'), sheet = document.getElementById('mnav-sheet');
  if (grid) grid.innerHTML = [...document.querySelectorAll('.tabs [role="tab"]')].map(t => `<button type="button" data-mnav="${t.dataset.tab}">${t.querySelector('svg')?.outerHTML || ''}<span>${[...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim()}</span></button>`).join('');
  const openSheet = on => { sheet.hidden = !on; document.querySelector('[data-mnav="menu"]')?.setAttribute('aria-expanded', String(on)); document.body.classList.toggle('mnav-open', on); };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mnav]'); if (!b) { if (!sheet.hidden && e.target === sheet) openSheet(false); return; }
    const v = b.dataset.mnav;
    if (v === 'menu') return openSheet(sheet.hidden);
    if (v === 'close') return openSheet(false);
    openSheet(false); G.goto(v); scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// olhinho nos campos de senha: mostra/esconde o que foi digitado
{
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  for (const i of document.querySelectorAll('input[type="password"]')) {
    const w = document.createElement('span'); w.className = 'pw'; i.replaceWith(w); w.append(i);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pw__eye'; b.innerHTML = EYE; b.setAttribute('aria-label', 'mostrar senha'); b.setAttribute('aria-pressed', 'false'); w.append(b);
    i.form?.addEventListener('submit', () => { if (i.type === 'text') b.click(); });
    b.addEventListener('click', () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? OFF : EYE; b.setAttribute('aria-label', show ? 'esconder senha' : 'mostrar senha'); b.setAttribute('aria-pressed', String(show)); i.focus(); });
  }
}
