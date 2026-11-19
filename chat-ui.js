// Chat global ao vivo pelo salão P2P: libera no nível 2, filtra palavrão, destaque pago (taxa segue a economia),
// menção com @Nome (avisa a pessoa) e conversa privada (PV) que só o destinatário recebe.
import * as CH from './chat.js';
import * as FE from './feira.js';
import * as Auth from './auth.js';
import { G, $, esc, brl, say, save, note, profileOf } from './store.js';
import * as sfx from './sfx.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';

let lobby = null, lastAt = 0, unread = 0, idx = 1, to = 'all';
const msgs = [], seen = new Set();
const isOpen = () => !$('#chat-box').hidden;
const myName = () => profileOf().name;

export function attach(l) {
  lobby = l;
  if (!l.setOnChat) return;
  l.setOnChat((d, peer) => { if (d?.t === 'hist' && Array.isArray(d.list)) d.list.slice(-30).forEach(m => add({ ...m, pv: false }, false)); else add(d, false, peer); });
  setInterval(() => { if (isOpen() && document.activeElement !== $('#chat-to')) { fillTo(); $('#chat-online').textContent = onlineLabel(); } }, 2500);   // lista de quem está online sempre em dia
  l.setOnJoin(id => { const pub = msgs.filter(m => !m.sys && !m.pv).slice(-20); if (pub.length) l.sendChat({ t: 'hist', list: pub }, id); });
}
async function refreshIdx() { try { idx = FE.econIndex(((await Auth.ranking?.()) || []).map(r => Number(r.worth))); } catch {} }
const online = () => (lobby ? [...lobby.peers.entries()].filter(([, p]) => p.profile).map(([pid, p]) => ({ pid, name: p.profile.name })) : []);

function add(raw, mine, peer) {
  const m = CH.accept(raw);
  if (!m || (m.id && seen.has(m.id))) return;
  if (m.id) seen.add(m.id);
  m.mine = mine; m.pid = peer || null;
  m.mention = !mine && CH.mentions(m.text, myName());
  msgs.push(m); msgs.sort((a, b) => a.at - b.at); if (msgs.length > 150) msgs.shift();
  if (!mine) {
    if (!isOpen() || m.pv || m.mention) { unread++; badge(); }
    if (m.pv) { sfx.play('stack', 0.4); say(`${m.name} mandou uma mensagem privada no chat.`); }
    else if (m.mention) { sfx.play('stack', 0.4); say(`${m.name} mencionou você no chat.`); }
    else if (m.hi) sfx.play('chip', 0.25);
  }
  draw();
}
// quantos estão no salão agora: pessoas conectadas + jogadores do mundo online (o mesmo número do salão e do ranking)
const onlineLabel = () => `${NPC.onlineSet(Live.now()).size + online().length + 1} online`;
function badge() { const n = $('#chat-n'); n.textContent = unread; n.hidden = !unread; }
function fillTo() {
  const sel = $('#chat-to'); if (!sel) return;
  const people = online();
  if (to !== 'all' && !people.some(p => p.pid === to)) to = 'all';
  sel.innerHTML = `<option value="all">todos (global)</option>${people.map(p => `<option value="${esc(p.pid)}" ${p.pid === to ? 'selected' : ''}>privado: ${esc(p.name)}</option>`).join('')}`;
  sel.value = to;
  $('#chat-hi-wrap').hidden = to !== 'all';
}
function draw() {
  if (!isOpen()) return;
  const el = $('#chat-list'), stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
  const people = online();
  el.innerHTML = msgs.map(m => {
    const canPv = !m.mine && m.pid && people.some(p => p.pid === m.pid);
    return `<li class="${m.hi ? 'is-hi' : ''} ${m.mine ? 'is-me' : ''} ${m.pv ? 'is-pv' : ''} ${m.mention ? 'is-mention' : ''}">
      ${m.pv ? `<span class="chat-pv">privado${m.mine ? ` para ${esc(m.toName)}` : ''}</span>` : ''}
      <button class="chat-name" type="button" data-mention="${esc(m.name)}" title="mencionar ${esc(m.name)}">${esc(m.name)}</button><small>nv ${m.level}</small>
      ${canPv ? `<button class="chat-pvbtn" type="button" data-pv="${esc(m.pid)}" title="conversar no privado">PV</button>` : ''}
      ${esc(m.text).replace(/@([^\s@]{2,18})/g, '<b class="chat-at">@$1</b>')}</li>`;
  }).join('') || '<li class="is-sys">Ninguém falou ainda. Anuncie o que você vende ou procura!</li>';
  if (stick) el.scrollTop = el.scrollHeight;
  $('#chat-online').textContent = onlineLabel();
  $('#chat-fee').textContent = brl(CH.highlightFee(idx));
  fillTo();
  const lvl = G.S.level || 1, locked = lvl < CH.MIN_LEVEL;
  $('#chat-form').hidden = locked; $('#chat-lock').hidden = !locked;
  $('#chat-lock').textContent = `Você lê o chat, mas só escreve a partir do nível ${CH.MIN_LEVEL} (você está no ${lvl}). Jogue uma mesa ou faça um turno de entregas para subir.`;
}
function toggle(open = !isOpen()) {
  $('#chat-box').hidden = !open; $('#chat-fab').setAttribute('aria-expanded', open);
  if (open) { unread = 0; badge(); refreshIdx().then(draw); draw(); $('#chat-in')?.focus(); }
}
export function openPv(pid) { to = pid; toggle(true); fillTo(); $('#chat-in').focus(); }
function send(e) {
  e.preventDefault();
  const text = $('#chat-in').value, pv = to !== 'all', hi = !pv && $('#chat-hi').checked, fee = CH.highlightFee(idx);
  const err = CH.canSend(G.S, text, lastAt, Date.now(), hi, idx);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  if (!lobby?.sendChat) return say('Sem conexão com o salão agora. Tente de novo em alguns segundos.', true);
  const target = pv ? online().find(p => p.pid === to) : null;
  if (pv && !target) { to = 'all'; fillTo(); return say('Essa pessoa saiu do salão.', true); }
  if (hi) { G.S.money -= fee; note('destaque no chat global', -fee); save(); G.render(); }
  const m = { id: Math.random().toString(36).slice(2, 12), name: myName(), level: G.S.level || 1, text: CH.clean(text), hi, pv, toName: target?.name || '', at: Date.now() };
  pv ? lobby.sendChat(m, to) : lobby.sendChat(m);
  add(m, true);
  lastAt = Date.now();
  $('#chat-in').value = ''; $('#chat-hi').checked = false;
  if (CH.clean(text) !== text.trim().replace(/\s+/g, ' ')) say('Algumas palavras foram trocadas por *** (sem palavrão no chat).');
}

// jogadores do mundo falando no chat de tempos em tempos (mesma fala para todos, sem lotar)
let npcSlot = 0;
function npcTalk(first = false) {
  const now = Live.now(), cur = Math.floor(now / CH.NPC_GAP);
  for (let sl = first ? cur - 4 : npcSlot + 1; sl <= cur; sl++) {
    const nicks = [...NPC.onlineSet(sl * CH.NPC_GAP)].sort().map(id => NPC.byId(id)?.nick).filter(Boolean), l = CH.npcLine(sl, nicks);
    if (l && l.at > now) break;
    npcSlot = sl;
    if (!l) continue;
    const n = NPC.byNick(l.name);
    add({ ...l, level: n ? NPC.levelFor(NPC.worthAt(n, G.S?.month || 1)) : 5 }, false);
  }
}
setTimeout(() => npcTalk(true), 1500); setInterval(npcTalk, 5000);

document.getElementById('chat-fab')?.addEventListener('click', () => toggle());
document.getElementById('chat-x')?.addEventListener('click', () => toggle(false));
document.getElementById('chat-form')?.addEventListener('submit', send);
document.getElementById('chat-to')?.addEventListener('change', e => { to = e.target.value; fillTo(); });
document.getElementById('chat-list')?.addEventListener('click', e => {
  const mn = e.target.closest('[data-mention]');
  if (mn) { const i = $('#chat-in'); i.value = `${i.value.trim()} @${mn.dataset.mention} `.trimStart(); i.focus(); return; }
  const pv = e.target.closest('[data-pv]');
  if (pv) openPv(pv.dataset.pv);
});
