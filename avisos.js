// Central de avisos: o sino no topo guarda o que apareceu (últimos 40) e as propostas de negócio dos outros jogadores.
// Proposta não pula mais na tela nem toca som: espera aqui, e o sino mostra o número do que é importante.
import { G, $, esc, FEED } from './store.js';

let openedAt = Date.now();
const ago = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`; };
function badge() {
  const offer = !!$('#nc-offer')?.childElementCount, n = FEED.filter(f => f.imp && f.at > openedAt).length + (offer ? 1 : 0), b = $('#nc-badge');
  if (b) { b.hidden = !n; b.textContent = n; }
  $('#nc-btn')?.classList.toggle('has-new', n > 0);
}
// situação da nuvem no topo da central de avisos
function syncLine() {
  const el = $('#nc-sync'), st = G.syncState?.(); if (!el || !st?.on) { if (el) el.hidden = true; return; }
  const s = Math.round((Date.now() - (st.at || 0)) / 1000);
  el.hidden = false; el.className = `nc-sync ${st.offline ? 'is-bad' : st.pending ? 'is-wait' : 'is-ok'}`;
  el.textContent = st.offline ? '⚠️ sem internet: o que você fizer fica guardado e vai para a nuvem quando voltar' : st.pending ? '⏳ enviando para a nuvem...' : st.at ? `☁️ tudo salvo na nuvem (há ${s < 60 ? `${s} s` : `${Math.round(s / 60)} min`})` : '☁️ conectado à nuvem';
}
setInterval(syncLine, 3000);
function list() {
  syncLine();
  const el = $('#nc-list'); if (!el) return;
  el.innerHTML = FEED.length ? FEED.map(f => `<li class="${f.bad ? 'is-bad' : f.imp ? 'is-imp' : ''}"><span>${esc(f.txt)}</span><small>${ago(f.at)}</small></li>`).join('')
    : '<li class="muted small">Nada por aqui ainda.</li>';
  $('#nc-sub').textContent = FEED.length ? `${FEED.length} recentes` : '';
}
G.onFeed = () => { badge(); if (!$('#nc-panel')?.hidden) list(); };
G.ncBadge = badge;
{
  const el = $('#nc-panel'), btn = $('#nc-btn');
  const close = () => { el.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const place = () => el.style.setProperty('--tk-top', `${(b => (b > innerHeight * 0.5 ? 12 : Math.max(8, b)))(Math.round(btn.getBoundingClientRect().bottom + 8))}px`);
  btn?.addEventListener('click', e => { e.stopPropagation(); place(); el.hidden = !el.hidden; btn.setAttribute('aria-expanded', String(!el.hidden)); if (!el.hidden) { openedAt = Date.now(); list(); } badge(); });
  document.addEventListener('click', e => { if (el && !el.hidden && !e.target.closest('.ncmenu')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el && !el.hidden) close(); });
}
