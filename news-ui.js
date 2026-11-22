// TV 21: televisão na lateral da tela (estúdio, apresentador, faixa da manchete e letreiro passando), fixa ou minimizada,
// + aba "TV 21" dentro da Resenha com a lista das últimas notícias.
// Notícia sua sai pelo salão para todos que estão online; as dos jogadores do mundo vêm do relógio (iguais para todo mundo).
import * as N from './news.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import { G, $, esc, profileOf } from './store.js';
import { avatarSVG } from './avatar.js';

const items = [], seen = new Set();
let send = null, cur = 0, slot = 0;
export const setSender = fn => { send = fn; };
export const push = n => add(n);   // notícia pronta (economia do mundo, econ-ui.js)

function add(n, fresh = true) {
  if (!n || (n.id && seen.has(n.id))) return;
  seen.add(n.id); items.push(n); items.sort((a, b) => a.at - b.at); if (items.length > 40) items.splice(Math.max(0, items.findIndex(x => !x.ed)), 1);   // a edição especial não sai do ar
  if (fresh && n.at > Date.now() - 120000) cur = items.indexOf(n);   // notícia nova entra no ar na hora
  draw(); try { G.onTv?.(n); } catch {}   // portal de notícias acompanha a TV
}
// chegou pelo salão
// um mesmo jogador aparece no máximo 1 vez a cada 3 min (quem negocia muito não toma conta da TV)
export const NAME_GAP = 180000;
const recentName = (name, at) => items.some(x => x.real && x.name === name && Math.abs(at - x.at) < NAME_GAP);
export function receive(d) { const n = N.accept(d); if (n && !recentName(n.name, n.at)) add(n); }
export const big = (min = 1e6, n = 6) => items.filter(x => Math.abs(x.val || 0) >= min).slice(-n).reverse();   // portal: só os grandes negócios da TV
export const history = () => items.filter(n => n.real).slice(-15).map(({ id, kind, name, what, val, at }) => ({ id, kind, name, what, val, at }));

// linha do livro-caixa do próprio jogador (ver store.note): vira notícia para todos
G.onNote = (txt, val) => {
  if (G.newsQuiet) return;                        // fechamento do mês não é notícia
  const s = G.S, name = s?.privateProfile ? 'um investidor misterioso' : profileOf().name;
  const n = N.fromNote(name, txt, val); if (!n) return;
  const m = { ...n, id: Math.random().toString(36).slice(2, 12), at: Date.now() };
  if (recentName(m.name, m.at)) return;
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
  <p class="tv__line">${esc(N.headline(n))}</p>${big && n.lead ? `<p class="tv__lead">${esc(n.lead)}</p>` : ''}<small class="tv__by">${esc(N.anchorOf(n))}${big ? ` · ${new Date(n.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</small>`;

// ---------- a TV na lateral ----------
// apresentadores: visual fixo (o mesmo para todo mundo)
export const LOOKS = {
  'Willian Borner': { skin: 2, hair: 'curto', hairColor: 5, beard: 'nenhuma', eyes: 2, outfit: 'terno', cloth: 6, acc: 'nenhum' },
  'Retana Rater': { skin: 3, hair: 'longo', hairColor: 4, beard: 'nenhuma', eyes: 3, outfit: 'terno', cloth: 2, acc: 'brinco' },
};
const MODE_KEY = '21world.tvMode';
const mode = () => { try { const m = localStorage.getItem(MODE_KEY); if (m === 'fixo' || m === 'min') return m; } catch {} return matchMedia('(max-width: 40rem)').matches ? 'min' : 'fixo'; };
const setMode = m => { try { localStorage.setItem(MODE_KEY, m); } catch {} draw(); };
function mount() {
  if ($('#tvx')) return;
  document.body.insertAdjacentHTML('beforeend', `<aside class="tvx" id="tvx" aria-label="TV 21, plantão de notícias do mundo">
    <div class="tvx__set">
      <div class="tvx__screen" id="tvx-screen" role="button" tabindex="0" title="Abrir todas as notícias na Resenha">
        <div class="tvx__studio" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <span class="tvx__logo" aria-hidden="true">TV<b>21</b></span>
        <span class="tvx__live"><i class="tv__dot" aria-hidden="true"></i>AO VIVO</span>
        <div class="tvx__anchor" id="tvx-anchor" aria-hidden="true"></div>
        <div class="tvx__desk" aria-hidden="true"><span>PLANTÃO 21</span></div>
        <div class="tvx__lower"><span class="tvx__who" id="tvx-who"></span><div id="tvx-news" aria-live="polite"></div></div>
        <div class="tvx__crawl" aria-hidden="true"><span class="tvx__crawlin" id="tvx-crawl"></span></div>
      </div>
      <div class="tvx__bar"><i class="tv__dot" aria-hidden="true"></i><b>TV 21</b><span>plantão</span>
        <button type="button" class="tvx__btn" data-jornal title="assistir ao Jornal 21">jornal</button><button type="button" class="tvx__btn" data-tv-open>notícias</button><button type="button" class="tvx__btn" data-tv-mode="min" aria-label="minimizar a TV" title="minimizar">–</button></div>
    </div>
    <button type="button" class="tvx__mini" data-tv-mode="fixo" aria-label="abrir a TV 21" title="TV 21: deixar fixa na lateral"><span class="tvx__miniscreen"><i class="tv__dot"></i></span><b>TV 21</b><span id="tvx-minikick"></span></button>
  </aside>`);
}
let lastAnchor = '', lastId = '';
function drawTV() {
  mount();
  const tv = $('#tvx'), m = mode(); tv.dataset.mode = m;
  const n = items[cur] || items[items.length - 1];
  if (!n) { $('#tvx-news').innerHTML = '<p class="tv__line">Boa noite! Já já tem notícia do mundo.</p>'; return; }
  const who = N.anchorOf(n);
  if (who !== lastAnchor) { $('#tvx-anchor').innerHTML = avatarSVG(LOOKS[who] || {}, { label: who }); lastAnchor = who; }
  $('#tvx-minikick').innerHTML = `<span class="tv__kick tv__kick--${n.kind}">${N.KINDS[n.kind]}</span>`;
  if (n.id === lastId) return;
  lastId = n.id;
  $('#tvx-who').textContent = who;
  $('#tvx-news').innerHTML = `<span class="tv__kick tv__kick--${n.kind}">${N.KINDS[n.kind]}</span>${n.real ? '<span class="tv__real">ao vivo</span>' : ''}<p class="tv__line">${esc(N.headline(n))}</p>`;
  $('#tvx-crawl').textContent = [...items].reverse().slice(0, 8).map(x => N.headline(x)).join('   •   ');
  const an = $('#tvx-anchor'); an.classList.remove('is-talk'); void an.offsetWidth; an.classList.add('is-talk');   // "fala" a manchete nova
}
function draw() {
  drawTV();
  const list = $('#tv-list');
  if (list && !list.hidden) list.innerHTML = [...items].reverse().map(x => `<li class="${x.mine ? 'is-me' : ''}">${card(x, true)}</li>`).join('') || '<li class="is-sys">Sem notícias ainda.</li>';
}
// manchete troca sozinha
setInterval(() => { if (items.length) { cur = (cur + 1) % items.length; draw(); } }, 9000);
setTimeout(() => npcTick(true), 1200); setInterval(npcTick, 5000);
for (const e of N.editorial()) add(e, false);   // edição especial da redação

// abas da Resenha: conversa | TV 21
export function tab(which) {
  const tv = which === 'tv';
  for (const b of document.querySelectorAll('[data-chat-tab]')) b.classList.toggle('is-on', b.dataset.chatTab === which);
  $('#chat-list').hidden = tv; $('#tv-list').hidden = !tv;
  $('#chat-box').classList.toggle('on-tv', tv);
  draw();
}
function openNews() { G.openChat?.('tv'); }
document.addEventListener('keydown', e => { if (e.target.id === 'tvx-screen' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openNews(); } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-chat-tab]'); if (t) return tab(t.dataset.chatTab);
  const md = e.target.closest('[data-tv-mode]'); if (md) return setMode(md.dataset.tvMode);
  if (e.target.closest('[data-tv-open], #tvx-screen')) openNews();
});
mount(); draw();

// ---------- Jornal 21: abertura em clima de telejornal quando o jogo abre (uma vez por edição) ----------
// O âncora abre, apresenta cada reportagem da edição especial (foto, chamada, manchete e texto) e encerra.
const J_KEY = '21world.jornal';
let jEds = [], jI = 0, jAnchor = '';
const jSpeak = t => { try { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; u.rate = 1.05; speechSynthesis.speak(u); } catch {} };
const jStop = () => { try { speechSynthesis.cancel(); } catch {} };
function jMount() {
  if ($('#dlg-jornal')) return;
  document.body.insertAdjacentHTML('beforeend', `<dialog class="dlg jn" id="dlg-jornal" aria-labelledby="jn-title">
    <div class="jn__top"><span class="jn__logo">JORNAL<b>21</b></span><span class="jn__ed">edição especial</span><span class="jn__live"><i class="tv__dot" aria-hidden="true"></i>AO VIVO</span><span class="jn__date" id="jn-date"></span></div>
    <div class="jn__stage"><div class="jn__anchor" id="jn-anchor" aria-hidden="true"></div><figure class="jn__screen"><img id="jn-img" alt=""><figcaption id="jn-kick"></figcaption></figure></div>
    <div class="jn__body"><h2 id="jn-title"></h2><p id="jn-lead"></p><small id="jn-by"></small></div>
    <div class="jn__nav"><div class="jn__dots" id="jn-dots"></div>
      <div class="jn__acts"><button type="button" class="btn btn--glass btn--sm" data-jn="ouvir" title="ouvir a notícia">🔊 ouvir</button><button type="button" class="btn btn--glass btn--sm" data-jn="sair">pular o jornal</button><button type="button" class="btn btn--gold" data-jn="prox" id="jn-next">próxima notícia ▶</button></div></div>
  </dialog>`);
  $('#dlg-jornal').addEventListener('close', jStop);
}
function jSlide() {
  const n = jEds.length, intro = jI === 0, outro = jI === n + 1, e = jEds[jI - 1];
  const who = intro || outro ? jAnchor : N.ANCHORS[(N.ANCHORS.indexOf(jAnchor) + jI) % N.ANCHORS.length];
  $('#jn-anchor').innerHTML = avatarSVG(LOOKS[who] || {}, { label: who });
  const an = $('#jn-anchor'); an.classList.remove('is-talk'); void an.offsetWidth; an.classList.add('is-talk');
  const tops = jEds.slice(0, 3).map(x => x.title.split(':')[0].toLowerCase()).join('; ');
  if (intro) {
    $('#jn-img').src = 'assets/photo-vegas.webp'; $('#jn-kick').textContent = 'boa noite';
    $('#jn-title').textContent = `Boa noite. Eu sou ${who}, e este é o Jornal 21.`;
    $('#jn-lead').textContent = `Numa edição especial, as mudanças que mexem com o bolso de todo mundo no 21 World: ${tops}. São ${n} reportagens. Fique com a gente.`;
    $('#jn-by').textContent = 'Redação TV 21';
  } else if (outro) {
    $('#jn-img').src = 'assets/photo-vegas.webp'; $('#jn-kick').textContent = 'até a próxima';
    $('#jn-title').textContent = 'Essas foram as notícias desta edição.';
    $('#jn-lead').textContent = 'Todas as reportagens continuam no ar na TV 21, na aba da Resenha, e no destaque da página inicial. Obrigado pela audiência, boa noite e bons negócios.';
    $('#jn-by').textContent = `${who}, Jornal 21`;
  } else {
    $('#jn-img').src = e.img; $('#jn-kick').textContent = N.KINDS[e.kind] || 'notícia';
    $('#jn-title').textContent = e.title; $('#jn-lead').textContent = e.lead;
    $('#jn-by').textContent = `Reportagem: ${who}, Redação TV 21 · ${jI} de ${n}`;
  }
  $('#jn-dots').innerHTML = Array.from({ length: n + 2 }, (_, k) => `<i class="${k === jI ? 'is-on' : ''}"></i>`).join('');
  $('#jn-next').textContent = outro ? 'voltar ao jogo' : intro ? 'começar ▶' : 'próxima notícia ▶';
  $('#jn-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  jStop();
}
export function jornal(force = false) {
  jEds = N.editorial(); if (!jEds.length) return false;
  let seen = ''; try { seen = localStorage.getItem(J_KEY) || ''; } catch {}
  if (!force && seen === N.EDITION) return false;
  try { localStorage.setItem(J_KEY, N.EDITION); } catch {}
  jMount(); jI = 0; jAnchor = N.ANCHORS[Math.floor(Date.now() / 864e5) % N.ANCHORS.length];
  jSlide(); const d = $('#dlg-jornal'); if (!d.open) d.showModal();
  return true;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-jn]'); if (b) {
    const a = b.dataset.jn, d = $('#dlg-jornal');
    if (a === 'sair') return d.close();
    if (a === 'ouvir') return jSpeak(`${$('#jn-title').textContent} ${$('#jn-lead').textContent}`);
    if (a === 'prox') { if (jI >= jEds.length + 1) return d.close(); jI++; return jSlide(); }
  }
  if (e.target.closest('[data-jornal]')) jornal(true);
});
// abre sozinho quando o jogo já carregou e não há outra janela aberta (tenta por até 2 minutos)
let jTry = 0;
const jAuto = () => { if (document.querySelector('dialog[open]') || !G.S) { if (++jTry < 24) setTimeout(jAuto, 5000); return; } jornal(); };
setTimeout(jAuto, 6000);
