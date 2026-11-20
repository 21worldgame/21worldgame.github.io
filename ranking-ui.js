// Aba ranking: pódio, sua posição e quanto falta para subir, categorias e destaques do mundo, tudo ao vivo.
import * as C from './casino.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import * as W from './world.js';
import { G, $, esc, brl, int, profileOf } from './store.js';
import { avatarSVG } from './avatar.js';

let cat = 'worth', last = new Map(), page = 0, onlyOn = false, query = '';
const PER = 25;
const money = v => new Intl.NumberFormat('pt-BR', { notation: v >= 1e6 ? 'compact' : 'standard', style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1e6 ? 2 : 0 }).format(v);
const CATS = {
  worth: { label: 'patrimônio', val: r => r.worth, fmt: money },
  level: { label: 'nível', val: r => r.level, fmt: v => `nível ${v}` },
  farm: { label: 'fazendeiros', val: r => r.ha || 0, fmt: v => `${int(v)} ha` },
  casino: { label: 'cassino', val: r => r.best || 0, fmt: v => `${int(v)} fichas` },
};
export const setCat = c => { if (CATS[c]) { cat = c; page = 0; render(); } };
export const setPage = p => { page = Math.max(0, Number(p) || 0); render(); document.getElementById('rk-count')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
export const toggleOnline = () => { onlyOn = !onlyOn; page = 0; render(); };
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const search = q => { query = fold(q).trim(); page = 0; render(); };

// junta os dados extras (hectares, maior prêmio) que cada fonte tem
function rows() {
  const w = Live.world(), t = Live.now(), month = W.current(w, t) + W.progress(w, t), me = profileOf();
  const on = NPC.onlineSet(t);
  return C.rankingRows(500).map(r => {
    r = { ...r, online: r.pid === 'me' ? true : String(r.pid || '').startsWith('npc:') ? on.has(r.pid.slice(4)) : String(r.pid || '').startsWith('u:') ? false : !!r.pid };   // da nuvem sem estar no salão = fora agora
    if (String(r.pid).startsWith('npc:')) { const p = NPC.profile(NPC.byId(r.pid.slice(4)), month); return { ...r, ha: p.ha, best: p.stats.best, wins: p.stats.wins }; }
    if (r.pid === 'me') return { ...r, ha: me.ha, best: me.stats?.best || 0, wins: me.stats?.wins || 0 };
    return r;
  });
}

export function render() {
  if ($('#p-ranking')?.hidden) return;
  const C1 = CATS[cat], every = rows().sort((a, b) => C1.val(b) - C1.val(a)), all = every;
  const shown = every.filter(r => (!onlyOn || r.online) && (!query || fold(r.name).includes(query))), pages = Math.max(1, Math.ceil(shown.length / PER));
  page = Math.min(page, pages - 1);
  const top = every.slice(0, 3), pageRows = shown.slice(page * PER, page * PER + PER);
  const myIdx = all.findIndex(r => r.pid === 'me'), me = all[myIdx];
  document.querySelectorAll('[data-rkcat]').forEach(b => b.classList.toggle('is-on', b.dataset.rkcat === cat));
  // pódio
  const pod = [1, 0, 2].map(i => top[i]).map((r, k) => r ? `<button class="podium__p podium__p--${[2, 1, 3][k]}" data-profile="${esc(r.pid || '')}" ${r.pid ? '' : 'disabled'}>
      <span class="podium__frame">${[2, 1, 3][k] === 1 ? '<i class="podium__crown" aria-hidden="true">👑</i>' : `<i class="podium__medal" aria-hidden="true">${[2, 1, 3][k] === 2 ? '🥈' : '🥉'}</i>`}<i class="podium__spark" aria-hidden="true"></i><span class="podium__av">${avatarSVG(r.look || {}, { label: r.name })}</span></span><b>${esc(r.name)}</b><small>${C1.fmt(C1.val(r))}</small><span class="podium__base">${[2, 1, 3][k]}º</span></button>` : '').join('');
  $('#rk-podium').innerHTML = pod;
  // você
  const next = myIdx > 0 ? all[myIdx - 1] : null, gap = next ? C1.val(next) - C1.val(me) : 0;
  const pct = next ? Math.max(0.03, Math.min(1, C1.val(me) / Math.max(1, C1.val(next)))) : 1;
  $('#rk-me').innerHTML = me ? `<span class="rk-me__pos">${myIdx + 1}º</span><span class="rk-me__av">${avatarSVG(me.look || {}, { label: me.name })}</span>
    <div class="rk-me__txt"><b>${esc(me.name)} <small>você</small></b><span>${C1.fmt(C1.val(me))}</span>
      ${next ? `<span class="small">faltam <b class="good">${cat === 'worth' ? brl(gap) : cat === 'level' ? `${gap} níveis` : cat === 'farm' ? `${int(gap)} ha` : `${int(gap)} fichas`}</b> para passar ${esc(next.name)}</span><span class="bar"><i style="transform:scaleX(${pct.toFixed(3)})"></i></span>` : '<span class="small good">Você é o número 1!</span>'}</div>` : '';
  // lista
  const now = new Map(all.map((r, i) => [r.name, i]));
  $('#rk-list').innerHTML = pageRows.map(r => {
    const i = every.indexOf(r);
    const was = last.get(r.name), mv = was === undefined ? '' : was > i ? `<i class="rk__mv is-up">▲${was - i}</i>` : was < i ? `<i class="rk__mv is-down">▼${i - was}</i>` : '';
    return `<li><button class="rkrow${r.pid === 'me' ? ' is-me' : ''}${i < 3 ? ` is-top${i + 1}` : ''}" data-profile="${esc(r.pid || '')}" ${r.pid ? '' : 'disabled'}>
      <span class="rkrow__pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="rkrow__av">${r.online ? '<i class="rkrow__on" title="online agora"></i>' : ''}${avatarSVG(r.look || {}, { label: r.name })}</span>
      <span class="rkrow__name">${esc(r.name)}${r.pid === 'me' ? ' <small>você</small>' : ''}${mv}<small>nível ${r.level} · ${esc(r.rank || '')}</small></span>
      <span class="rkrow__val">${C1.fmt(C1.val(r))}</span></button></li>`;
  }).join('');
  if (!pageRows.length) $('#rk-list').innerHTML = `<li class="muted rk-empty">${query ? 'Nenhum jogador com esse nome.' : 'Ninguém online agora.'}</li>`;
  last = now;
  const onCount = every.filter(r => r.online).length;
  $('#rk-count').innerHTML = `<b>${every.length}</b> jogadores no ranking · <b class="good">${onCount}</b> online agora <button class="btn btn--glass btn--sm" data-act="rk-online" aria-pressed="${onlyOn}">${onlyOn ? 'mostrar todos' : 'só quem está online'}</button>`;
  const nums = Array.from({ length: pages }, (_, k) => k).filter(k => k === 0 || k === pages - 1 || Math.abs(k - page) <= 2);
  $('#rk-pages').innerHTML = pages > 1 ? `<button class="btn btn--glass btn--sm" data-act="rk-page" data-id="${page - 1}" ${page ? '' : 'disabled'}>‹ anterior</button>${nums.map((k, j) => `${j && k - nums[j - 1] > 1 ? '<span class="muted">…</span>' : ''}<button class="rk-pg${k === page ? ' is-on' : ''}" data-act="rk-page" data-id="${k}">${k + 1}</button>`).join('')}<button class="btn btn--glass btn--sm" data-act="rk-page" data-id="${page + 1}" ${page < pages - 1 ? '' : 'disabled'}>próxima ›</button>` : '';
  // destaques do mundo
  const w = Live.world(), t = Live.now(), m = W.current(w, t);
  const byWorth = [...all].sort((a, b) => b.worth - a.worth)[0], byHa = [...all].sort((a, b) => (b.ha || 0) - (a.ha || 0))[0], byBest = [...all].sort((a, b) => (b.best || 0) - (a.best || 0))[0], byLvl = [...all].sort((a, b) => b.level - a.level)[0];
  const total = all.reduce((s, r) => s + r.worth, 0);
  $('#rk-facts').innerHTML = [
    ['jogadores online agora', `${every.filter(r => r.online).length}`], ['mês do mundo', W.dateLabel(m)],
    ['maior fortuna', `${esc(byWorth?.name || '')} · ${money(byWorth?.worth || 0)}`], ['maior fazendeiro', `${esc(byHa?.name || '')} · ${int(byHa?.ha || 0)} ha`],
    ['maior prêmio no 21', `${esc(byBest?.name || '')} · ${int(byBest?.best || 0)} fichas`], ['nível mais alto', `${esc(byLvl?.name || '')} · nível ${byLvl?.level || 1}`],
    ['dinheiro no ranking', money(total)], ['para entrar no top 10', all[9] ? C1.fmt(C1.val(all[9])) : '—'],
  ].map(([k, v]) => `<div class="rk-fact"><span class="muted small">${k}</span><b>${v}</b></div>`).join('');
}
setInterval(render, 4000);
document.addEventListener('input', e => { if (e.target.id === 'rk-search') search(e.target.value); });
