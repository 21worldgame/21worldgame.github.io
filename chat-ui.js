// Resenha: chat estilo WhatsApp. Lista de conversas (Geral, TV 21 e cada jogador online) e a conversa aberta.
// Computador largo: fica fixa na lateral direita. Celular e tela menor: abre em tela cheia pelo botão "resenha".
// Regras do chat (nível 2, palavrão, destaque pago, @menção) continuam em chat.js.
import * as CH from './chat.js';
import * as FE from './feira.js';
import * as Auth from './auth.js';
import * as VIP from './vip.js';
import { G, $, esc, brl, say, save, note, profileOf, notice, ntOff, isBlocked } from './store.js';
import * as sfx from './sfx.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import * as NEWS from './news-ui.js';
import { avatarSVG } from './avatar.js';
import * as BC from './bot-chat.js';

let lobby = null, lastAt = 0, idx = 1, conv = 'all', q = '';
const msgs = [], seen = new Set(), unread = new Map();   // unread: conversa -> quantas novas
const docked = matchMedia('(min-width: 75rem)');
const box = () => $('#chat-box');
const isOpen = () => (docked.matches && !document.body.classList.contains('rz-min')) || document.body.classList.contains('rz-open');
// computador: minimizar deixa só uma faixa fina com o ícone e o número de mensagens novas (lembra da escolha)
function setMin(on) {
  document.body.classList.toggle('rz-min', on);
  try { on ? localStorage.setItem('21world.rzMin', '1') : localStorage.removeItem('21world.rzMin'); } catch {}
  if (!on) { $('#rz-conv').hidden ? drawPeople() : openConv(conv, false); }
}
try { if (localStorage.getItem('21world.rzMin')) document.body.classList.add('rz-min'); } catch {}
const viewing = c => isOpen() && !$('#rz-conv').hidden && conv === c;
const myName = () => profileOf().name;
const time = at => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function attach(l) {
  lobby = l;
  if (!l.setOnChat) return;
  NEWS.setSender(m => lobby?.sendChat?.(m));
  l.setOnChat((d, peer) => { if (d?.t === 'news') return NEWS.receive(d); if (d?.t === 'nhist' && Array.isArray(d.list)) return d.list.slice(-15).forEach(NEWS.receive); if (d?.t === 'hist' && Array.isArray(d.list)) d.list.slice(-30).forEach(m => add({ ...m, pv: false }, false)); else add(d, false, peer); });
  l.setOnJoin(id => { const pub = msgs.filter(m => !m.sys && !m.pv && !m.bot).slice(-20); if (pub.length) l.sendChat({ t: 'hist', list: pub }, id); const nh = NEWS.history(); if (nh.length) l.sendChat({ t: 'nhist', list: nh }, id); });
}
setInterval(() => { if (isOpen() && !$('#rz-conv').hidden) drawStrip(); if (isOpen() && $('#rz-conv').hidden) drawPeople(); $('#chat-online').textContent = onlineLabel(); }, 3000);   // quem está online sempre em dia
async function refreshIdx() { try { idx = FE.econIndex(((await Auth.ranking?.()) || []).map(r => Number(r.worth))); } catch {} }

// todo mundo online: pessoas conectadas e jogadores do mundo, tudo na mesma lista
function people() {
  const out = lobby ? [...lobby.peers.entries()].filter(([, p]) => p.profile).map(([pid, p]) => ({ id: pid, name: p.profile.name, look: p.profile.look, level: p.profile.level || 1, peer: true })) : [];
  const month = G.S?.month || 1;
  for (const id of NPC.onlineSet(Live.now())) { const n = NPC.byId(id); if (n) out.push({ id: `npc:${id}`, name: n.nick, look: n.look, level: NPC.levelFor(NPC.worthAt(n, month)) }); }
  return out;
}
const who = c => people().find(p => p.id === c);

function add(raw, mine, peer, extra = {}) {
  const m = CH.accept(raw);
  if (!m || (m.id && seen.has(m.id))) return;
  if (!mine && isBlocked(m.name, NPC.byNick(m.name)?.id)) return;   // bloqueado: some da Resenha
  if (m.id) seen.add(m.id);
  Object.assign(m, { mine, pid: peer || null, conv: m.pv ? (mine ? extra.conv : peer || extra.conv) : 'all', bot: !!extra.bot });
  m.mention = !mine && CH.mentions(m.text, myName());
  msgs.push(m); msgs.sort((a, b) => a.at - b.at); if (msgs.length > 300) msgs.shift();
  if (!mine && !viewing(m.conv)) {
    unread.set(m.conv, (unread.get(m.conv) || 0) + 1);
    if (m.pv || m.mention) { sfx.play('stack', 0.4); popup(m); }
    if (m.mention && !m.pv) unread.set('@', (unread.get('@') || 0) + 1);
  } else if (!mine && m.hi) sfx.play('chip', 0.25);
  badge(); draw();
}
// aviso igual ao do WhatsApp na lateral direita: foto, nome e a mensagem; fica até fechar ou responder
function popup(m) {
  if (ntOff('chat')) return;
  const c = m.conv, p = who(c) || who(m.pid) || {};
  const old = document.querySelector(`.nt__card[data-conv="${CSS.escape(c)}"]`);
  if (old) old.remove();   // a mesma conversa: troca pelo aviso mais novo
  const card = notice({ side: 'right', kind: 'chat', open: { label: 'responder', fn: () => G.openChat(c) },
    html: `<span class="nt__av">${avatarSVG(p.look || {}, { label: m.name })}</span><div class="nt__msg"><b>${esc(m.name)}<small>${m.pv ? 'privado' : 'mencionou você na Geral'} · ${time(m.at)}</small></b><p>${esc(m.text)}</p></div>` });
  card.dataset.conv = c;
}
const onlineLabel = () => `${NPC.onlineTotal(Live.now())} online`;   // o mesmo número do ranking, do salão e da cidade
// número no botão: privadas e menções (a Geral não conta, senão ficava sempre aceso)
function badge() {
  let n = unread.get('@') || 0; for (const [c, v] of unread) if (c !== 'all' && c !== '@' && c !== 'tv') n += v;
  for (const b of document.querySelectorAll('.rz-badge')) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
}
const mini = (look, name) => `<span class="rz__av">${avatarSVG(look || {}, { label: name })}</span>`;
const icon = (t, id) => `<span class="rz__av rz__av--ico"${id ? ` id="${id}"` : ''} aria-hidden="true">${t}</span>`;
const lastOf = c => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].conv === c) return msgs[i]; return null; };

function drawPeople() {
  const el = $('#rz-people'); if (!el) return;
  const list = people(), f = q.trim().toLowerCase();
  const row = (c, av, name, sub, at, n, extra = '') => `<li><button type="button" class="rz__row${n ? ' has-new' : ''}" data-conv="${esc(c)}">${av}
    <span class="rz__txt"><span class="rz__l1"><b>${esc(name)}</b>${at ? `<small>${time(at)}</small>` : ''}</span><span class="rz__l2"><span>${sub}</span>${n ? `<i class="rz__n">${n > 99 ? '99+' : n}</i>` : extra}</span></span></button></li>`;
  const g = lastOf('all'), tv = NEWS.history().at?.(-1);
  let html = f ? '' : row('all', icon('#'), 'Geral', g ? `${esc(g.mine ? 'você' : g.name)}: ${esc(g.text)}` : 'conversa de todo mundo', g?.at, unread.get('all') || 0)
    + row('tv', icon('<i class="tv__dot"></i>'), 'TV 21', tv ? esc(`${tv.name} ${tv.what}`) : 'últimas notícias do mundo', 0, 0);
  const ranked = list.filter(p => !f || p.name.toLowerCase().includes(f)).map(p => ({ p, last: lastOf(p.id) }))
    .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0) || a.p.name.localeCompare(b.p.name));
  html += `<li class="rz__sec">online agora · ${f ? ranked.length : NPC.onlineTotal(Live.now())}</li>`;
  html += ranked.map(({ p, last }) => row(p.id, mini(p.look, p.name), p.name, typing.has(p.id) ? '<i class="rz__typing">digitando...</i>' : last ? esc(`${last.mine ? 'você: ' : ''}${last.text}`) : `nível ${p.level} · toque para conversar`, last?.at, unread.get(p.id) || 0, '<i class="rz__dot" aria-label="online"></i>')).join('')
    || `<li class="rz__empty">Ninguém com esse nome online.</li>`;
  el.innerHTML = html;
}
// fileira de quem está online no topo da Geral (toque para abrir o privado); só redesenha se a lista mudar
let stripKey = '';
function drawStrip() {
  const el = $('#rz-strip'); if (!el) return;
  el.hidden = conv !== 'all'; if (el.hidden) return;
  const list = people().sort((a, b) => (b.peer ? 1 : 0) - (a.peer ? 1 : 0) || b.level - a.level), key = list.map(p => p.id).join();
  if (key === stripKey) return; stripKey = key;
  el.innerHTML = `<span class="rz__strip-t">online agora · ${NPC.onlineTotal(Live.now())}</span><div class="rz__strip-row">${list.map(p => `<button type="button" class="rz__chip" data-conv="${esc(p.id)}" title="conversar com ${esc(p.name)}">${mini(p.look, p.name)}<i class="rz__dot"></i><small>${esc(p.name)}</small></button>`).join('')}</div>`;
}
function drawConv() {
  drawStrip();
  const tv = conv === 'tv', p = !tv && conv !== 'all' && who(conv);
  $('#rz-title').textContent = tv ? 'TV 21' : conv === 'all' ? 'Geral' : p?.name || lastOf(conv)?.name || 'jogador';
  $('#rz-sub').textContent = tv ? 'notícias do mundo' : conv === 'all' ? onlineLabel() : typing.has(conv) ? 'digitando...' : p ? `online · nível ${p.level}` : 'saiu do salão';
  $('#rz-sub').classList.toggle('is-typing', typing.has(conv));
  const av = $('#rz-av');
  av.outerHTML = tv ? icon('<i class="tv__dot"></i>', 'rz-av') : conv === 'all' ? icon('#', 'rz-av')
    : `<button type="button" class="rz__av" id="rz-av" data-profile="${esc(conv)}" aria-label="ver perfil">${avatarSVG(p?.look || {}, { label: p?.name || '' })}</button>`;
  NEWS.tab(tv ? 'tv' : 'chat');
  if (tv) return;
  const el = $('#chat-list'), stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
  const list = msgs.filter(m => m.conv === conv);
  let day = '';
  el.innerHTML = list.map(m => {
    const d = new Date(m.at).toLocaleDateString('pt-BR'), sep = d !== day ? `<li class="rz__day">${(day = d) === new Date().toLocaleDateString('pt-BR') ? 'hoje' : d}</li>` : '';
    return `${sep}<li class="${m.hi ? 'is-hi' : ''} ${m.mine ? 'is-me' : ''} ${m.pv ? 'is-pv' : ''} ${m.mention ? 'is-mention' : ''}">
      ${!m.mine && conv === 'all' ? `<button class="chat-name" type="button" data-mention="${esc(m.name)}" title="mencionar ${esc(m.name)}"><span class="${VIP.cls(m.name)}">${esc(m.name)}</span>${VIP.tag(m.name)}</button><small>nv ${m.level}</small>${m.pid && who(m.pid) ? `<button class="chat-pvbtn" type="button" data-conv="${esc(m.pid)}" title="conversar no privado">PV</button>` : ''}` : ''}
      <span class="rz__msg">${esc(m.text).replace(/@([^\s@]{2,18})/g, '<b class="chat-at">@$1</b>')}</span><time>${time(m.at)}</time></li>`;
  }).join('') || `<li class="is-sys">${conv === 'all' ? 'Ninguém falou ainda. Anuncie o que você vende ou procura!' : 'Comece a conversa. Só vocês dois veem.'}</li>`;
  if (stick) el.scrollTop = el.scrollHeight;
  $('#chat-fee').textContent = brl(CH.highlightFee(idx));
  $('#chat-hi-wrap').hidden = conv !== 'all';
  $('#chat-in').placeholder = conv === 'all' ? 'Mensagem para todos (@Nome chama alguém)' : 'Mensagem privada';
  const lvl = G.S?.level || 1, locked = lvl < CH.MIN_LEVEL;
  $('#chat-form').hidden = locked; $('#chat-lock').hidden = !locked;
  $('#chat-lock').textContent = `Você lê a Resenha, mas só escreve a partir do nível ${CH.MIN_LEVEL} (você está no ${lvl}). Jogue uma mesa ou faça um turno de entregas para subir.`;
}
function draw() { if (!isOpen()) return; $('#rz-conv').hidden ? drawPeople() : drawConv(); $('#chat-online').textContent = onlineLabel(); }

function openConv(c, focus = true) {
  document.querySelector(`.nt__card[data-conv="${CSS.escape(c)}"]`)?.remove();
  conv = c; unread.delete(c); if (c === 'all') unread.delete('@'); badge();
  $('#rz-home').hidden = true; $('#rz-conv').hidden = false; box().classList.add('is-conv');
  drawConv(); const el = $('#chat-list'); el.scrollTop = el.scrollHeight;
  if (focus && c !== 'tv' && (docked.matches || matchMedia('(pointer: fine)').matches)) $('#chat-in')?.focus({ preventScroll: true });
}
function home() { $('#rz-conv').hidden = true; $('#rz-home').hidden = false; box().classList.remove('is-conv'); drawPeople(); }
function setOpen(on) {
  document.body.classList.toggle('rz-open', on);
  for (const b of document.querySelectorAll('[data-chat-open]')) b.setAttribute('aria-expanded', String(on));
  if (on) { refreshIdx().then(draw); $('#rz-conv').hidden ? drawPeople() : openConv(conv); }
}
G.openChat = c => { setOpen(true); if (c) openConv(c); };
export function openPv(pid) { G.openChat(pid); }

function send(e) {
  e.preventDefault();
  const text = $('#chat-in').value, pv = conv !== 'all', hi = !pv && $('#chat-hi').checked, fee = CH.highlightFee(idx);
  const err = CH.canSend(G.S, text, lastAt, Date.now(), hi, idx);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  const target = pv ? who(conv) : null;
  if (pv && !target) return say('Essa pessoa saiu do salão.', true);
  const bot = pv && conv.startsWith('npc:');
  if (!bot && !lobby?.sendChat) return say('Sem conexão com o salão agora. Tente de novo em alguns segundos.', true);
  if (hi) { G.S.money -= fee; note('destaque no chat global', -fee); save(); G.render(); }
  const m = { id: Math.random().toString(36).slice(2, 12), name: myName(), level: G.S.level || 1, text: CH.clean(text), hi, pv, toName: target?.name || '', at: Date.now() };
  if (!bot) pv ? lobby.sendChat(m, conv) : lobby.sendChat(m);
  add(m, true, null, { conv, bot });
  if (bot) botReply(conv, target, m.text);
  else if (!pv) { const b = people().find(x => x.id.startsWith('npc:') && CH.mentions(m.text, x.name)); if (b) botReply(`geral:${b.id}`, b, m.text, true); }   // chamou alguém do mundo com @ na Geral
  lastAt = Date.now();
  $('#chat-in').value = ''; $('#chat-hi').checked = false;
  if (CH.clean(text) !== text.trim().replace(/\s+/g, ' ')) say('Algumas palavras foram trocadas por *** (sem palavrão na Resenha).');
}
// jogador do mundo responde no privado, cada um no seu jeito e no seu tempo (segundos, 1-2 min, até 10 min);
// aparece "digitando..." antes. Mensagens seguidas enquanto ele não respondeu viram uma resposta só.
const botSt = new Map();   // conversa -> { timer, text, talked, lastAt }
const typing = new Set();
function botReply(c, p, text, geral = false) {
  const st = botSt.get(c) || {}; botSt.set(c, st);
  st.text = text;
  if (st.timer) return;
  const r = BC.reply(BC.persona(p.name), text, { first: !st.talked, engaged: Date.now() - (st.lastAt || 0) < 300e3 });
  if (r.skip) return;
  const typeMs = Math.min(r.delay, 2500 + Math.random() * 4000);
  st.timer = setTimeout(() => {
    typing.add(c); draw();
    st.timer = setTimeout(() => {
      typing.delete(c); st.timer = null; st.talked = true; st.lastAt = Date.now();
      r.texts.forEach((txt, i) => setTimeout(() => add({ id: Math.random().toString(36).slice(2, 12), name: p.name, level: p.level, text: geral ? `@${myName()} ${txt}` : txt, pv: !geral, at: Date.now() }, false, geral ? null : c, { bot: true }), i * (2000 + Math.random() * 4000)));
    }, typeMs);
  }, r.delay - typeMs);
}

// jogadores do mundo falando na Geral de tempos em tempos (mesma fala para todos, sem lotar)
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
// conversas entre eles: as falas de cada conversa entram na hora marcada (iguais em todos os aparelhos)
function npcThreads() {
  const now = Live.now(), cur = Math.floor(now / CH.THREAD_GAP);
  for (let sl = cur - 2; sl <= cur; sl++) {
    const nicks = [...NPC.onlineSet(sl * CH.THREAD_GAP)].sort().map(id => NPC.byId(id)?.nick).filter(Boolean);
    for (const l of CH.npcThread(sl, nicks)) if (l.at <= now && now - l.at < 1800000) { const n = NPC.byNick(l.name); add({ ...l, level: n ? NPC.levelFor(NPC.worthAt(n, G.S?.month || 1)) : 5 }, false); }
  }
}
setTimeout(() => { npcTalk(true); npcThreads(); }, 1500); setInterval(() => { npcTalk(); npcThreads(); }, 5000);

document.addEventListener('click', e => {
  if (e.target.closest('[data-chat-open]')) return setOpen(!document.body.classList.contains('rz-open') || docked.matches);
  if (!e.target.closest('#chat-box')) return;
  if (e.target.closest('[data-rz-min]')) return setMin(!document.body.classList.contains('rz-min'));
  if (e.target.closest('[data-rz-close]')) return setOpen(false);
  if (e.target.closest('#rz-back')) return home();
  const c = e.target.closest('[data-conv]'); if (c) return openConv(c.dataset.conv);
  const mn = e.target.closest('[data-mention]');
  if (mn) { const i = $('#chat-in'); i.value = `${i.value.trim()} @${mn.dataset.mention} `.trimStart(); i.focus(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('rz-open') && !docked.matches && !document.querySelector('dialog[open]')) setOpen(false); });
$('#chat-form')?.addEventListener('submit', send);
$('#rz-q')?.addEventListener('input', e => { q = e.target.value; drawPeople(); });
docked.addEventListener('change', draw);
openConv('all', false);   // abre na Geral; "‹" mostra todas as conversas
