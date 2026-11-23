// Noticiário da cidade na tela (as regras ficam em cidade.js): plantões da fortuna e grandes negócios na TV 21 em horários quebrados,
// edições do Jornal 21 (manhã, meio-dia e noite), trocas no topo do ranking ao vivo e a Gazeta da página inicial.
import * as C from './cidade.js';
import * as TV from './news-ui.js';
import * as NPC from './npcs.js';
import * as W from './world.js';
import * as Live from './live.js';
import { G, esc, ntOff } from './store.js';
import { avatarSVG } from './avatar.js';
import { short, headline, KINDS } from './news.js';

const HIST_KEY = '21world.cidade.hist', ED_KEY = '21world.cidade.ed', MIN = 6e4;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
// o que já foi ao ar (o texto de um boletim não muda quando o ranking muda depois)
const hist = new Map(load(HIST_KEY, []).map(x => [x.id, x]));
const saveHist = () => store(HIST_KEY, [...hist.values()].sort((a, b) => b.at - a.at).slice(0, 40));

function ctx() {
  const t = Live.now(), w = Live.world();
  const rows = (G.rankRows?.(500) || []).filter(r => r.worth > 10000).map(r => (r.pid === 'me' && G.S?.privateProfile ? { ...r, name: 'um investidor misterioso' } : r));
  return { rows, online: Math.max(1, NPC.onlineTotal(t)), monthAt: x => W.current(w, x) + W.progress(w, x) };
}
// negócios das últimas 24 h: os do mundo (iguais para todos) e os que jogadores de verdade fecharam e a TV viu
let dealsAt = 0, dealsC = [];
function deals24(c) {
  const t = Live.now();
  if (t - dealsAt > MIN) { dealsC = C.dealsBetween(t - 864e5, t, c.monthAt); dealsAt = t; }
  const real = TV.history().filter(x => Date.now() - x.at < 864e5 && Math.abs(x.val) >= 1e5).map(x => ({ id: x.id, kind: 'negocio', name: x.name, val: x.val, at: x.at, text: headline(x), lead: 'Negócio fechado ao vivo por um morador da cidade.' }));
  return [...dealsC, ...real].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
}

// ---------- programação ----------
let last = 0, pending = null;
function tick() {
  if (!G.S || !Live.worldReady) return;
  const t = Live.now(), c = ctx();
  for (const d of C.due(Math.max(last, t - 90 * MIN), t)) {
    let item = hist.get(d.id);
    if (d.type === 'edicao') {
      const e = C.edition(d, c, deals24(c)); item ||= e.item;
      if (t - d.at < 12 * MIN && !load(ED_KEY, []).includes(d.id)) pending = { d, e };   // abre o jornal se o jogador estiver livre
    } else item ||= C.build(d, c);
    if (!item) continue;
    hist.set(d.id, item); TV.push(item);
  }
  last = t; saveHist(); popup(); refresh();
}
function popup() {
  if (!pending) return;
  const { d, e } = pending;
  if (Live.now() - d.at > 12 * MIN) { pending = null; return; }   // passou da hora: a edição fica só na TV
  if (ntOff('aviso') || document.visibilityState !== 'visible' || document.querySelector('dialog[open]') || G.busy?.()) return;   // tenta de novo no próximo ciclo
  store(ED_KEY, [...load(ED_KEY, []), d.id].slice(-30)); pending = null;
  TV.boletim(e.slides, e.intro);
}

// ---------- ao vivo: troca no topo do ranking e novo membro do Clube dos 100 milhões ----------
let base = null, lastLive = 0;
function watch() {
  if (!G.S) return;
  const { rows } = ctx(); if (!rows.length) return;
  const lead = rows[0], club = rows.filter(r => r.worth >= 1e8).map(r => r.name), now = Date.now(), push = (id, kind, text, lead2) => { const n = { id: `${id}-${now}`, kind, text, lead: lead2, at: now }; hist.set(n.id, n); TV.push(n); saveHist(); refresh(); };
  if (!base) { base = { lead: lead.name, worth: lead.worth, club: new Set(club) }; return; }   // primeira olhada: só guarda, não anuncia
  if (lead.name !== base.lead) {
    if (now - lastLive > 10 * MIN) { lastLive = now; push('lv', 'fortuna', `Troca no topo da cidade: ${lead.name} ultrapassa ${base.lead} e assume a maior fortuna`, `${lead.name} soma ${short(lead.worth)}. ${base.lead}, que liderava com ${short(base.worth)}, cai para o segundo lugar.`); }
    base.lead = lead.name;
  }
  base.worth = lead.worth;
  for (const n of club) if (!base.club.has(n)) { base.club.add(n); push('cl', 'fortuna', `${n} entra para o Clube dos 100 milhões`, `A cidade ganha mais um morador com fortuna de nove dígitos. São ${club.length} no clube agora.`); }
}

// ---------- Gazeta da página inicial ----------
const day = t => { const s = new Date(t).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return s[0].toUpperCase() + s.slice(1); };   // Segunda-feira, 23 de novembro
const hhmm = at => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const ago = at => { const m = Math.max(0, Math.round((Live.now() - at) / MIN)); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`; };
const av = r => `<span class="gz__av">${avatarSVG(r.look || {}, { label: r.name })}</span>`;
export function gazetaHTML() {
  if (!G.S) return '';
  const c = ctx(), t = Live.now(), deals = deals24(c), g = C.gazeta(c, t, deals), [a] = c.rows;
  const wire = [...hist.values()].filter(x => x.at <= Live.now() + MIN).sort((x, y) => y.at - x.at).slice(0, 7);
  const tile = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<div class="gz__mast"><span class="gz__brand">GAZETA <b>21</b></span><span class="gz__date">${esc(day(t))} · edição da ${g.period}</span>
      <span class="gz__live"><i></i>${c.online} online agora</span></div>
    <div class="gz__grid">
      <article class="gz__col gz__lead">${a ? av(a) : ''}<div><span class="gz__kick">manchete</span>
        <h3>${esc(g.lead?.text || 'A cidade acabou de acordar: ninguém passou dos R$ 10 mil ainda')}</h3><p>${esc(g.lead?.lead || 'Seja o primeiro a aparecer no ranking e entre para a história do 21 World.')}</p>
        ${a ? `<button type="button" class="btn btn--glass btn--sm" data-profile="${esc(a.pid || '')}">ver o perfil de ${esc(a.name)}</button>` : ''}</div></article>
      <section class="gz__col"><h4>os mais ricos da cidade</h4><ol class="gz__rich">${g.top.map((r, i) => `<li><button type="button" data-profile="${esc(r.pid || '')}"><span class="gz__pos">${['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>${av(r)}<b>${esc(r.name)}</b><small>${short(r.worth)}</small></button></li>`).join('') || '<li class="muted small">Ninguém no ranking ainda.</li>'}</ol>
        <button type="button" class="btn btn--glass btn--sm" data-tab-go="ranking">ranking completo</button></section>
      <section class="gz__col"><h4>negócios do dia</h4><ul class="gz__deals">${g.deals.map(d => `<li><span class="tv__kick tv__kick--${esc(d.kind)}">${esc(KINDS[d.kind] || 'NEGÓCIO')}</span><p>${esc(d.text)}</p><small><b>${short(d.val)}</b> · ${ago(d.at)}</small></li>`).join('') || '<li class="muted small">Nenhum grande negócio nas últimas 24 horas.</li>'}</ul></section>
    </div>
    <div class="gz__stats">${tile('moradores no ranking', g.stats.pop)}${tile('online agora', c.online)}${tile('milionários', g.stats.mi)}${tile('Clube dos 100 mi', g.stats.club)}${tile('negócios em 24 h', deals.length)}</div>
    <div class="gz__wire"><h4><i class="tv__dot"></i> última hora na TV 21</h4><ul>${wire.map(x => `<li><time>${hhmm(x.at)}</time><span class="tv__kick tv__kick--${esc(x.kind)}">${esc(KINDS[x.kind] || 'NOTÍCIA')}</span><p>${esc(x.text)}</p></li>`).join('') || '<li class="muted small">O noticiário da cidade começa em instantes.</li>'}</ul></div>`;
}
function refresh() {
  const el = document.getElementById('gz');
  if (el && !document.getElementById('p-inicio')?.hidden && !el.contains(document.activeElement)) el.innerHTML = gazetaHTML();
}
setInterval(refresh, 20000);
setTimeout(tick, 7000); setInterval(tick, 20000); setInterval(watch, 15000);
