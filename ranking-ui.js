// Aba ranking: pódio, sua posição e quanto falta para subir, categorias e destaques do mundo, tudo ao vivo.
import * as C from './casino.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import * as W from './world.js';
import { G, $, esc, brl, int, profileOf } from './store.js';
import { avatarSVG } from './avatar.js';

let cat = 'worth', last = new Map();
const money = v => new Intl.NumberFormat('pt-BR', { notation: v >= 1e6 ? 'compact' : 'standard', style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1e6 ? 2 : 0 }).format(v);
const CATS = {
  worth: { label: 'patrimônio', val: r => r.worth, fmt: money },
  level: { label: 'nível', val: r => r.level, fmt: v => `nível ${v}` },
  farm: { label: 'fazendeiros', val: r => r.ha || 0, fmt: v => `${int(v)} ha` },
  casino: { label: 'cassino', val: r => r.best || 0, fmt: v => `${int(v)} fichas` },
};
export const setCat = c => { if (CATS[c]) { cat = c; render(); } };

// junta os dados extras (hectares, maior prêmio) que cada fonte tem
function rows() {
  const w = Live.world(), t = Live.now(), month = W.current(w, t) + W.progress(w, t), me = profileOf();
  return C.rankingRows(60).map(r => {
    if (String(r.pid).startsWith('npc:')) { const p = NPC.profile(NPC.byId(r.pid.slice(4)), month); return { ...r, ha: p.ha, best: p.stats.best, wins: p.stats.wins }; }
    if (r.pid === 'me') return { ...r, ha: me.ha, best: me.stats?.best || 0, wins: me.stats?.wins || 0 };
    return r;
  });
}

export function render() {
  if ($('#p-ranking')?.hidden) return;
  const C1 = CATS[cat], all = rows().sort((a, b) => C1.val(b) - C1.val(a)), top = all.slice(0, 30);
  const myIdx = all.findIndex(r => r.pid === 'me'), me = all[myIdx];
  document.querySelectorAll('[data-rkcat]').forEach(b => b.classList.toggle('is-on', b.dataset.rkcat === cat));
  // pódio
  const pod = [1, 0, 2].map(i => top[i]).map((r, k) => r ? `<button class="podium__p podium__p--${[2, 1, 3][k]}" data-profile="${esc(r.pid || '')}" ${r.pid ? '' : 'disabled'}>
      <span class="podium__av">${avatarSVG(r.look || {}, { label: r.name })}</span><b>${esc(r.name)}</b><small>${C1.fmt(C1.val(r))}</small><span class="podium__base">${[2, 1, 3][k]}º</span></button>` : '').join('');
  $('#rk-podium').innerHTML = pod;
  // você
  const next = myIdx > 0 ? all[myIdx - 1] : null, gap = next ? C1.val(next) - C1.val(me) : 0;
  const pct = next ? Math.max(0.03, Math.min(1, C1.val(me) / Math.max(1, C1.val(next)))) : 1;
  $('#rk-me').innerHTML = me ? `<span class="rk-me__pos">${myIdx + 1}º</span><span class="rk-me__av">${avatarSVG(me.look || {}, { label: me.name })}</span>
    <div class="rk-me__txt"><b>${esc(me.name)} <small>você</small></b><span>${C1.fmt(C1.val(me))}</span>
      ${next ? `<span class="small">faltam <b class="good">${cat === 'worth' ? brl(gap) : cat === 'level' ? `${gap} níveis` : cat === 'farm' ? `${int(gap)} ha` : `${int(gap)} fichas`}</b> para passar ${esc(next.name)}</span><span class="bar"><i style="transform:scaleX(${pct.toFixed(3)})"></i></span>` : '<span class="small good">Você é o número 1!</span>'}</div>` : '';
  // lista
  const now = new Map(all.map((r, i) => [r.name, i]));
  $('#rk-list').innerHTML = top.map((r, i) => {
    const was = last.get(r.name), mv = was === undefined ? '' : was > i ? `<i class="rk__mv is-up">▲${was - i}</i>` : was < i ? `<i class="rk__mv is-down">▼${i - was}</i>` : '';
    return `<li><button class="rkrow${r.pid === 'me' ? ' is-me' : ''}${i < 3 ? ` is-top${i + 1}` : ''}" data-profile="${esc(r.pid || '')}" ${r.pid ? '' : 'disabled'}>
      <span class="rkrow__pos">${i + 1}</span><span class="rkrow__av">${avatarSVG(r.look || {}, { label: r.name })}</span>
      <span class="rkrow__name">${esc(r.name)}${r.pid === 'me' ? ' <small>você</small>' : ''}${mv}<small>nível ${r.level} · ${esc(r.rank || '')}</small></span>
      <span class="rkrow__val">${C1.fmt(C1.val(r))}</span></button></li>`;
  }).join('');
  last = now;
  // destaques do mundo
  const w = Live.world(), t = Live.now(), m = W.current(w, t);
  const byWorth = [...all].sort((a, b) => b.worth - a.worth)[0], byHa = [...all].sort((a, b) => (b.ha || 0) - (a.ha || 0))[0], byBest = [...all].sort((a, b) => (b.best || 0) - (a.best || 0))[0], byLvl = [...all].sort((a, b) => b.level - a.level)[0];
  const total = all.reduce((s, r) => s + r.worth, 0);
  $('#rk-facts').innerHTML = [
    ['jogadores online agora', `${NPC.onlineCount(t) + 1}`], ['mês do mundo', W.dateLabel(m)],
    ['maior fortuna', `${esc(byWorth?.name || '')} · ${money(byWorth?.worth || 0)}`], ['maior fazendeiro', `${esc(byHa?.name || '')} · ${int(byHa?.ha || 0)} ha`],
    ['maior prêmio no 21', `${esc(byBest?.name || '')} · ${int(byBest?.best || 0)} fichas`], ['nível mais alto', `${esc(byLvl?.name || '')} · nível ${byLvl?.level || 1}`],
    ['dinheiro no ranking', money(total)], ['para entrar no top 10', all[9] ? C1.fmt(C1.val(all[9])) : '—'],
  ].map(([k, v]) => `<div class="rk-fact"><span class="muted small">${k}</span><b>${v}</b></div>`).join('');
}
setInterval(render, 4000);
