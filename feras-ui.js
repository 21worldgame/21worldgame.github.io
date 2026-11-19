// Tela das Feras 21: arena com caçada automática (só com a aba aberta e a tela visível), gemas, time e coleção.
import * as FR from './feras.js';
import { G, $, esc, brl, int, say, save, note, confetti, today } from './store.js';
import * as sfx from './sfx.js';

let foe = null, foeHit = 0, lastTick = 0, farming = false, log = [];
// arte original das feras em SVG (corpo, olhos e enfeite do elemento), variações pelo id da espécie
export function feraSVG(spId, size = 96) {
  const sp = FR.sp(spId), c = FR.ELEMENTS[sp.el], h = [...sp.id].reduce((t, ch) => t * 31 + ch.charCodeAt(0) >>> 0, 7);
  const w = 34 + (h % 8), hh = 30 + ((h >> 3) % 8), ear = (h >> 6) % 3, rar = FR.RARITY[sp.rar];
  const deco = { fogo: `<path d="M50 ${46 - hh} q8 -14 0 -26 q14 10 8 26 q6 -8 4 -16 q10 12 -2 24z" fill="#fde047"/>`, agua: `<path d="M50 ${44 - hh} q-9 12 0 18 q9 -6 0 -18z" fill="#bae6fd"/>`,
    planta: `<path d="M50 ${48 - hh} q-14 -10 -6 -22 q8 8 6 22 q2 -14 14 -18 q2 12 -14 18z" fill="#86efac"/>`, raio: `<path d="M54 ${42 - hh} l-10 14 h8 l-6 12 l14 -18 h-8 l6 -8z" fill="#fef08a"/>`,
    pedra: `<path d="M36 ${50 - hh} l6 -12 l8 6 l8 -8 l6 14z" fill="#78716c"/>`, sombra: `<path d="M34 ${52 - hh} q-6 -18 6 -22 q-2 12 6 16 M66 ${52 - hh} q6 -18 -6 -22 q2 12 -6 16" fill="#4c1d95"/>` }[sp.el];
  const ears = ear === 0 ? `<circle cx="${50 - w * 0.7}" cy="${58 - hh * 0.7}" r="8" fill="${c}"/><circle cx="${50 + w * 0.7}" cy="${58 - hh * 0.7}" r="8" fill="${c}"/>` : ear === 1 ? `<path d="M${50 - w * 0.6} ${60 - hh * 0.6} l-8 -18 l16 8z M${50 + w * 0.6} ${60 - hh * 0.6} l8 -18 l-16 8z" fill="${c}"/>` : '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="fera-svg" aria-label="${esc(sp.name)}">
    <defs><radialGradient id="g${sp.id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".75"/></radialGradient></defs>
    <ellipse cx="50" cy="92" rx="${w * 0.8}" ry="5" fill="#000" opacity=".25"/>${ears}${deco}
    <ellipse cx="50" cy="62" rx="${w}" ry="${hh}" fill="url(#g${sp.id})" stroke="${rar.color}" stroke-width="${sp.rar === 'comum' ? 0 : 2.5}"/>
    <ellipse cx="${50 - w * 0.35}" cy="${58}" rx="6" ry="7.5" fill="#fff"/><ellipse cx="${50 + w * 0.35}" cy="58" rx="6" ry="7.5" fill="#fff"/>
    <circle cx="${50 - w * 0.33}" cy="59" r="3.6" fill="#111"/><circle cx="${50 + w * 0.37}" cy="59" r="3.6" fill="#111"/>
    <path d="M44 ${70 + (h % 3)} q6 5 12 0" stroke="#111" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="${50 - w * 0.6}" cy="68" rx="5" ry="3" fill="#fb7185" opacity=".45"/><ellipse cx="${50 + w * 0.6}" cy="68" rx="5" ry="3" fill="#fb7185" opacity=".45"/></svg>`;
}
const card = (f, act = '') => { const sp = FR.sp(f.sp), r = FR.RARITY[sp.rar]; return `<button class="fera-card fera--${sp.rar}${act}" data-fera="${f.id}" style="--rc:${r.color}">${feraSVG(f.sp, 70)}<b>${esc(sp.name)}</b><small>nv ${f.lv} · ${r.label}</small></button>`; };

export function render() {
  const el = $('#fr-root'); if (!el) return;
  const s = G.S, st = FR.ensure(s);
  if (!st.box.length) {
    el.innerHTML = `<div class="glass fr-start"><h3>escolha sua primeira fera</h3><p class="muted">Ela caça sozinha enquanto esta tela estiver aberta: cada fera selvagem derrotada dá gemas, que viram dinheiro. Às vezes uma fera rara é capturada e vale muito.</p>
      <div class="fr-starters">${FR.STARTERS.map(id => `<button class="fera-card fera--comum" data-fr-start="${id}">${feraSVG(id, 110)}<b>${FR.sp(id).name}</b><small>${FR.sp(id).el}</small></button>`).join('')}</div></div>`;
    return;
  }
  const R = FR.ROUTES.find(r => r.id === st.route), team = st.box.filter(f => st.team.includes(f.id));
  el.innerHTML = `<div class="fr-top">
      <div class="glass fr-arena" id="fr-arena"><div class="fr-route">${esc(R.name)} <small>feras nível ${R.lv[0]}–${R.lv[1]}</small></div>
        <div class="fr-side fr-side--me">${team.map(f => `<div class="fr-fighter">${feraSVG(f.sp, 88)}<small>${esc(FR.sp(f.sp).name)} nv ${f.lv}</small><span class="fr-xp"><i style="transform:scaleX(${(f.xp / FR.xpNeed(f.lv)).toFixed(2)})"></i></span></div>`).join('')}</div>
        <div class="fr-vs">VS</div><div class="fr-side fr-side--foe" id="fr-foe"></div>
        <div class="fr-state" id="fr-state"></div><div class="fr-floats" id="fr-floats"></div></div>
      <aside class="glass fr-bank"><span class="muted small">suas gemas</span><strong class="fr-gems" id="fr-gems">💎 ${int(st.gems)}</strong>
        <small class="muted">1 gema = ${brl(FR.GEM_RS)} · limite de ${brl(FR.DAILY_CAP)} por dia (hoje: ${brl(st.sold.day === today() ? st.sold.rs : 0)})</small>
        <button class="btn btn--gold" data-fr="exchange">trocar gemas por dinheiro</button>
        <span class="muted small">feras derrotadas: ${int(st.kills)}</span>
        <label class="field"><span>rota de caça</span><select class="input" id="fr-route">${FR.ROUTES.map(r => `<option value="${r.id}" ${r.id === st.route ? 'selected' : ''} ${FR.teamLv(st) < r.need ? 'disabled' : ''}>${r.name} (nv ${r.lv[0]}+, ${r.gems}x gemas)${FR.teamLv(st) < r.need ? ` · pede nv ${r.need}` : ''}</option>`).join('')}</select></label>
        <ol class="fr-log" id="fr-log">${log.map(l => `<li>${l}</li>`).join('')}</ol></aside></div>
    <h3>sua coleção <small class="muted">(toque para pôr ou tirar do time · até ${FR.MAX_TEAM})</small></h3>
    <div class="fr-box">${st.box.map(f => `<div class="fr-slot">${card(f, st.team.includes(f.id) ? ' is-team' : '')}<button class="btn btn--glass btn--sm" data-fr="sell" data-id="${f.id}">vender ${brl(FR.value(f) * 0.7)}</button></div>`).join('')}</div>`;
  drawFoe();
}
function drawFoe() {
  const el = $('#fr-foe'); if (!el || !foe) return;
  el.innerHTML = `<div class="fr-fighter${foeHit > Date.now() - 180 ? ' is-hit' : ''}">${feraSVG(foe.sp, 96)}<small>${esc(FR.sp(foe.sp).name)} nv ${foe.lv}</small><span class="fr-hp"><i style="transform:scaleX(${Math.max(0, foe.hp / foe.max).toFixed(3)})"></i></span></div>`;
}
const visible = () => !document.hidden && !$('#p-feras')?.hidden && G.S.feras?.box?.length;
function tick() {
  const now = performance.now(), dt = Math.min(1, (now - lastTick) / 1000 || 0); lastTick = now;
  const on = visible();
  if (on !== farming) { farming = on; const st = $('#fr-state'); if (st) st.innerHTML = on ? '<i class="fr-dot"></i>caçando…' : 'pausado'; }
  if (!on) return;
  const s = G.S, st = FR.ensure(s);
  if (!foe) foe = FR.wild(st.route, Math.random, FR.teamLv(st));
  const dmg = FR.dps(st, foe) * dt; foe.hp -= dmg; foeHit = Date.now();
  if (Math.random() < 0.5) floatText(`-${Math.round(dmg * 2)}`);
  if (foe.hp <= 0) {
    const r = FR.defeat(s, foe); foe = null;
    floatText(`+${r.gems} 💎`, 'gem');
    for (const f of r.ups) { log.unshift(`⬆ ${esc(FR.sp(f.sp).name)} subiu para o nível ${f.lv}`); sfx.play('stack', 0.4); }
    if (r.caught) { const sp = FR.sp(r.caught.sp), rar = FR.RARITY[sp.rar]; log.unshift(`<b style="color:${rar.color}">capturou ${esc(sp.name)} (${rar.label})!</b>`); if (sp.rar !== 'comum' && sp.rar !== 'incomum') { confetti(sp.rar === 'lendario' ? 160 : 70); say(`Fera ${rar.label} capturada: ${sp.name}! Vale ${brl(FR.value(r.caught))}.`); } sfx.play('stack', 0.7); }
    log = log.slice(0, 8); save();
    $('#fr-gems') && ($('#fr-gems').textContent = `💎 ${int(st.gems)}`);
    if (r.ups.length || r.caught) render();
    else { const lg = $('#fr-log'); if (lg) lg.innerHTML = log.map(l => `<li>${l}</li>`).join(''); }
  }
  drawFoe();
}
function floatText(t, cls = '') { const el = $('#fr-floats'); if (!el) return; const i = document.createElement('i'); i.className = `fr-float ${cls}`; i.textContent = t; i.style.left = `${55 + Math.random() * 30}%`; el.append(i); setTimeout(() => i.remove(), 900); }
setInterval(tick, 400);

document.addEventListener('click', e => {
  const s = G.S, st0 = e.target.closest('[data-fr-start]');
  if (st0) { FR.start(s, st0.dataset.frStart); save(); say('Sua fera começou a caçar! Deixe esta tela aberta para ela farmar gemas.'); return render(); }
  const f = e.target.closest('#fr-root [data-fera]');
  if (f) { const st = FR.ensure(s), id = f.dataset.fera; FR.setTeam(s, st.team.includes(id) ? st.team.filter(x => x !== id) : [...st.team, id]); if (!st.team.length) st.team = [id]; save(); return render(); }
  const b = e.target.closest('[data-fr]'); if (!b) return;
  if (b.dataset.fr === 'exchange') { const r = FR.exchange(s, s.feras.gems, today()); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true); note(`feras: ${int(r.used)} gemas trocadas`, r.rs); say(`${int(r.used)} gemas viraram ${brl(r.rs)}.`); sfx.play('stack', 0.6); }
  if (b.dataset.fr === 'sell') { const fx = s.feras.box.find(x => x.id === b.dataset.id); if (!fx || !confirm(`Vender ${FR.sp(fx.sp).name} (nv ${fx.lv}) por ${brl(FR.value(fx) * 0.7)}?`)) return; const v = FR.sellFera(s, fx.id); if (v === -1) return say('Você precisa ficar com pelo menos uma fera.', true); note(`feras: venda de ${FR.sp(fx.sp).name}`, v); say(`Vendida por ${brl(v)}.`); }
  save(); G.render(); render();
});
document.addEventListener('change', e => { if (e.target.id !== 'fr-route') return; const err = FR.setRoute(G.S, e.target.value); if (err) { say(err[0].toUpperCase() + err.slice(1), true); return render(); } foe = null; save(); render(); });
