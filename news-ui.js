// TV 21 dentro da Resenha (chat): faixa de plantão no topo (troca de manchete sozinha) + aba "TV 21" com a lista das últimas notícias.
// Notícia sua sai pelo salão para todos que estão online; as dos jogadores do mundo vêm do relógio (iguais para todo mundo).
import * as N from './news.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import { G, $, esc, profileOf } from './store.js';

const items = [], seen = new Set();
let send = null, cur = 0, slot = 0;
export const setSender = fn => { send = fn; };

function add(n, fresh = true) {
  if (!n || (n.id && seen.has(n.id))) return;
  seen.add(n.id); items.push(n); items.sort((a, b) => a.at - b.at); if (items.length > 40) items.shift();
  if (fresh && n.at > Date.now() - 120000) cur = items.indexOf(n);   // notícia nova entra no ar na hora
  draw();
}
// chegou pelo salão
export function receive(d) { const n = N.accept(d); if (n) add(n); }
export const history = () => items.filter(n => n.real).slice(-15).map(({ id, kind, name, what, val, at }) => ({ id, kind, name, what, val, at }));

// linha do livro-caixa do próprio jogador (ver store.note): vira notícia para todos
G.onNote = (txt, val) => {
  if (G.newsQuiet) return;                        // fechamento do mês não é notícia
  const s = G.S, name = s?.privateProfile ? 'um investidor misterioso' : profileOf().name;
  const n = N.fromNote(name, txt, val); if (!n) return;
  const m = { ...n, id: Math.random().toString(36).slice(2, 12), at: Date.now() };
  add({ ...m, real: true, mine: true });
  send?.({ t: 'news', ...m });
};

// notícias dos jogadores do mundo
function npcTick(first = false) {
  const now = Live.now(), c = Math.floor(now / N.NEWS_GAP);
  for (let sl = first ? c - 6 : slot + 1; sl <= c; sl++) {
    const nicks = [...NPC.onlineSet(sl * N.NEWS_GAP)].sort().map(id => NPC.byId(id)?.nick).filter(Boolean), n = N.npcNews(sl, nicks);
    if (n && n.at > now) break;
    slot = sl; if (n) add(n, !first);
  }
}

const card = (n, big) => `<span class="tv__kick tv__kick--${n.kind}">${N.KINDS[n.kind]}</span>${n.real ? '<span class="tv__real">ao vivo</span>' : ''}
  <p class="tv__line">${esc(N.headline(n))}</p><small class="tv__by">${esc(N.anchorOf(n))}${big ? ` · ${new Date(n.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</small>`;
function draw() {
  const tv = $('#tv'); if (!tv) return;
  const n = items[cur] || items[items.length - 1];
  $('#tv-screen').innerHTML = n ? card(n) : '<p class="tv__line">Boa noite! Já já tem notícia do mundo.</p>';
  const list = $('#tv-list');
  if (list && !list.hidden) list.innerHTML = [...items].reverse().map(x => `<li class="${x.mine ? 'is-me' : ''}">${card(x, true)}</li>`).join('') || '<li class="is-sys">Sem notícias ainda.</li>';
}
// manchete troca sozinha
setInterval(() => { if (items.length) { cur = (cur + 1) % items.length; draw(); } }, 9000);
setTimeout(() => npcTick(true), 1200); setInterval(npcTick, 5000);

// abas da Resenha: conversa | TV 21
export function tab(which) {
  const tv = which === 'tv';
  for (const b of document.querySelectorAll('[data-chat-tab]')) b.classList.toggle('is-on', b.dataset.chatTab === which);
  $('#chat-list').hidden = tv; $('#tv-list').hidden = !tv;
  $('#chat-box').classList.toggle('on-tv', tv);
  draw();
}
document.addEventListener('keydown', e => { if (e.target.id === 'tv' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tab('tv'); } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-chat-tab]'); if (t) return tab(t.dataset.chatTab);
  if (e.target.closest('#tv')) tab('tv');
});
