// Chat global ao vivo pelo salão P2P: libera no nível 2, filtra palavrão, destaque pago (taxa segue a economia).
import * as CH from './chat.js';
import * as FE from './feira.js';
import * as Auth from './auth.js';
import { G, $, esc, brl, say, save, note, profileOf } from './store.js';
import * as sfx from './sfx.js';

let lobby = null, lastAt = 0, unread = 0, idx = 1;
const msgs = [], seen = new Set();
const isOpen = () => !$('#chat-box').hidden;

export function attach(l) {
  lobby = l;
  if (!l.setOnChat) return;
  l.setOnChat((d, peer) => { if (d?.t === 'hist' && Array.isArray(d.list)) d.list.slice(-30).forEach(m => add(m, false)); else add(d, false); });
  l.setOnJoin(id => { if (msgs.length) l.sendChat({ t: 'hist', list: msgs.filter(m => !m.sys).slice(-20) }, id); });
}
// índice da economia (mesmo do mercado dos bots): ranking mais rico = destaque mais caro
async function refreshIdx() { try { idx = FE.econIndex(((await Auth.ranking?.()) || []).map(r => Number(r.worth))); } catch {} }

function add(raw, mine) {
  const m = CH.accept(raw);
  if (!m || (m.id && seen.has(m.id))) return;
  if (m.id) seen.add(m.id);
  m.mine = mine;
  msgs.push(m); msgs.sort((a, b) => a.at - b.at); if (msgs.length > 120) msgs.shift();
  if (!mine && !isOpen()) { unread++; badge(); }
  if (!mine && m.hi) sfx.play('chip', 0.25);
  draw();
}
function badge() { const n = $('#chat-n'); n.textContent = unread; n.hidden = !unread; }
function draw() {
  if (!isOpen()) return;
  const el = $('#chat-list'), stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
  el.innerHTML = msgs.map(m => `<li class="${m.hi ? 'is-hi' : ''} ${m.mine ? 'is-me' : ''}"><b>${esc(m.name)}</b><small>nv ${m.level}</small> ${esc(m.text)}</li>`).join('')
    || '<li class="is-sys">Ninguém falou ainda. Anuncie o que você vende ou procura!</li>';
  if (stick) el.scrollTop = el.scrollHeight;
  const peers = lobby ? [...lobby.peers.values()].filter(p => p.profile).length : 0;
  $('#chat-online').textContent = lobby ? `${peers} online` : 'conectando...';
  $('#chat-fee').textContent = brl(CH.highlightFee(idx));
  const lvl = G.S.level || 1, locked = lvl < CH.MIN_LEVEL;
  $('#chat-form').hidden = locked; $('#chat-lock').hidden = !locked;
  $('#chat-lock').textContent = `Você lê o chat, mas só escreve a partir do nível ${CH.MIN_LEVEL} (você está no ${lvl}). Jogue uma mesa ou faça um turno de entregas para subir.`;
}
function toggle(open = !isOpen()) {
  $('#chat-box').hidden = !open; $('#chat-fab').setAttribute('aria-expanded', open);
  if (open) { unread = 0; badge(); refreshIdx().then(draw); draw(); $('#chat-in')?.focus(); }
}
function send(e) {
  e.preventDefault();
  const text = $('#chat-in').value, hi = $('#chat-hi').checked, fee = CH.highlightFee(idx);
  const err = CH.canSend(G.S, text, lastAt, Date.now(), hi, idx);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  if (!lobby?.sendChat) return say('Sem conexão com o salão agora. Tente de novo em alguns segundos.', true);
  if (hi) { G.S.money -= fee; note('destaque no chat global', -fee); save(); G.render(); }
  const p = profileOf();
  const m = { id: Math.random().toString(36).slice(2, 12), name: p.name, level: G.S.level || 1, text: CH.clean(text), hi, at: Date.now() };
  lobby.sendChat(m);
  add(m, true);
  lastAt = Date.now();
  $('#chat-in').value = ''; $('#chat-hi').checked = false;
  if (CH.clean(text) !== text.trim().replace(/\s+/g, ' ')) say('Algumas palavras foram trocadas por *** (sem palavrão no chat).');
}

document.getElementById('chat-fab')?.addEventListener('click', () => toggle());
document.getElementById('chat-x')?.addEventListener('click', () => toggle(false));
document.getElementById('chat-form')?.addEventListener('submit', send);
