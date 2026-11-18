// Trocas em tempo real entre jogadores online (pela sala do salão): convite, ofertas, chat, "pronto" e confirmação dupla.
import * as TD from './trade.js';
import { G, $, esc, brl, int, say, save, note, award, confetti, profileOf } from './store.js';
import * as sfx from './sfx.js';

let lobby = null, ss = null;           // ss = sessão de troca aberta
const myName = () => profileOf().name;
const send = msg => lobby?.sendTrade({ ...msg, id: ss?.id }, ss?.peer);

export function attach(l) {
  lobby = l;
  lobby.setOnTrade(onMsg);
}
export const online = () => (lobby ? [...lobby.peers.entries()].filter(([, p]) => p.profile).map(([pid, p]) => ({ pid, ...p.profile })) : []);

export function invite(pid) {
  if (!lobby) return say('Sem conexão com o salão: trocas só funcionam online.', true);
  if (ss) return say('Termine a troca aberta antes de começar outra.', true);
  const peer = lobby.peers.get(pid);
  if (!peer) return say('Esse jogador saiu do salão.', true);
  ss = { peer: pid, name: peer.profile?.name || 'jogador', id: Math.random().toString(36).slice(2, 10), mine: [], theirs: [], lock: { me: false, them: false }, ok: { me: false, them: false }, chat: [], open: false };
  lobby.sendTrade({ t: 'invite', id: ss.id, name: myName() }, pid);
  say(`Convite de troca enviado para ${ss.name}. Aguardando...`);
  ss.timer = setTimeout(() => { if (ss && !ss.open) { say(`${ss.name} não respondeu.`, true); ss = null; } }, 30000);
}

function onMsg(d, peerId) {
  if (!d || typeof d !== 'object') return;
  if (String(d.t).startsWith('shop')) return G.onShopMsg?.(d, peerId);   // compras da loja usam o mesmo canal
  if (d.t === 'invite') {
    if (ss) return lobby.sendTrade({ t: 'decline', id: d.id, busy: true }, peerId);
    ss = { peer: peerId, name: String(d.name || 'jogador').replace(/[<>&"]/g, '').slice(0, 18), id: String(d.id).slice(0, 12), mine: [], theirs: [], lock: { me: false, them: false }, ok: { me: false, them: false }, chat: [], open: false, incoming: true };
    $('#ti-text').textContent = `${ss.name} quer negociar com você.`;
    $('#dlg-trade-invite').showModal(); sfx.play('chip', 0.6);
    return;
  }
  if (!ss || peerId !== ss.peer || d.id !== ss.id) return;      // só aceita mensagens da troca aberta
  if (d.t === 'accept') { clearTimeout(ss.timer); openWindow(); }
  if (d.t === 'decline') { clearTimeout(ss.timer); say(d.busy ? `${ss.name} está em outra troca agora.` : `${ss.name} recusou a troca.`, true); close(); }
  if (d.t === 'offer') { ss.theirs = TD.sanitize(d.items); ss.lock = { me: false, them: false }; ss.ok = { me: false, them: false }; render(); }
  if (d.t === 'lock') { ss.lock.them = !!d.v; if (!d.v) ss.ok.them = false; render(); }
  if (d.t === 'confirm') { ss.ok.them = true; render(); maybeApply(); }
  if (d.t === 'chat') { ss.chat.push({ me: false, text: String(d.text || '').slice(0, 140) }); render(); sfx.play('place', 0.4); }
  if (d.t === 'cancel') { say(d.reason ? `Troca cancelada: ${String(d.reason).slice(0, 80)}` : `${ss.name} cancelou a troca.`, true); close(); }
}

export function answer(yes) {
  $('#dlg-trade-invite').close();
  if (!ss) return;
  lobby.sendTrade({ t: yes ? 'accept' : 'decline', id: ss.id }, ss.peer);
  if (yes) openWindow(); else ss = null;
}

function openWindow() { ss.open = true; render(); const d = $('#dlg-trade'); if (!d.open) d.showModal(); }

function render() {
  if (!ss) return;
  $('#tr-who').textContent = `negociando com ${ss.name}`;
  const list = (items, mine) => items.length ? items.map((it, k) => `<li><span>${esc(TD.describe(it))}</span>${mine ? `<button class="btn btn--glass btn--sm" data-act="trade-remove" data-id="${k}">tirar</button>` : ''}</li>`).join('') : '<li class="muted small">nada ainda</li>';
  $('#tr-mine').innerHTML = list(ss.mine, true);
  $('#tr-theirs').innerHTML = list(ss.theirs, false);
  $('#tr-pick').innerHTML = TD.inventory(G.S).filter(i => !ss.mine.some(m => m.kind === i.kind && (m.data?.id ?? m.good) === (i.data?.id ?? i.good)))
    .map(i => `<option value="${i.kind}:${i.kind === 'good' ? i.good : i.id}">${esc(i.label)}</option>`).join('') || '<option value="">seu inventário está vazio</option>';
  $('#tr-state').innerHTML = `você: <b class="${ss.lock.me ? 'good' : ''}">${ss.ok.me ? 'confirmou' : ss.lock.me ? 'pronto' : 'montando'}</b>, ${esc(ss.name)}: <b class="${ss.lock.them ? 'good' : ''}">${ss.ok.them ? 'confirmou' : ss.lock.them ? 'pronto' : 'montando'}</b>`;
  $('[data-act="trade-lock"]').textContent = ss.lock.me ? 'mexer de novo' : 'estou pronto';
  $('[data-act="trade-confirm"]').disabled = !(ss.lock.me && ss.lock.them) || ss.ok.me;
  $('#tr-chat').innerHTML = ss.chat.slice(-30).map(c => `<li class="${c.me ? 'is-me' : ''}">${esc(c.text)}</li>`).join('');
  $('#tr-chat').scrollTop = 1e6;
}

// mudou a oferta: os dois precisam ficar "prontos" de novo
function changed() {
  const err = TD.canGive(G.S, ss.mine);
  if (err) { ss.mine.pop(); return say(err[0].toUpperCase() + err.slice(1), true); }
  ss.lock = { me: false, them: false }; ss.ok = { me: false, them: false };
  send({ t: 'offer', items: ss.mine });
  render();
}
export function addPicked() {
  const v = $('#tr-pick').value; if (!v || !ss) return;
  const [kind, key] = v.split(':');
  const it = TD.inventory(G.S).find(i => i.kind === kind && String(i.kind === 'good' ? i.good : i.id) === key);
  if (!it) return;
  if (kind === 'good') { const q = Math.floor(Number(prompt(`Quantas sacas de ${TD.GOODS[key]}? (você tem ${it.qty})`, it.qty)) || 0); if (q <= 0) return; ss.mine.push({ kind: 'good', good: key, qty: Math.min(q, it.qty) }); }
  else ss.mine.push({ kind, data: it.data });
  changed();
}
export function addAmount(kind) {
  if (!ss) return;
  const v = Math.floor(Number($(kind === 'chips' ? '#tr-chips' : '#tr-money').value) || 0);
  if (v <= 0) return;
  const old = ss.mine.find(i => i.kind === kind);
  if (old) old.amount += v; else ss.mine.push({ kind, amount: v });
  changed();
}
export function remove(k) { if (!ss) return; ss.mine.splice(Number(k), 1); changed(); }
export function lock() { if (!ss) return; ss.lock.me = !ss.lock.me; if (!ss.lock.me) ss.ok.me = false; send({ t: 'lock', v: ss.lock.me }); render(); }
export function confirmTrade() {
  if (!ss || !(ss.lock.me && ss.lock.them)) return;
  const err = TD.canGive(G.S, ss.mine);
  if (err) { send({ t: 'cancel', reason: err }); say(err, true); return close(); }
  ss.ok.me = true; send({ t: 'confirm' }); render(); maybeApply();
}
function maybeApply() {
  if (!ss || !ss.ok.me || !ss.ok.them || ss.done) return;
  ss.done = true;
  const err = TD.apply(G.S, ss.mine, ss.theirs);
  if (err) { send({ t: 'cancel', reason: err }); say(`A troca não pôde ser concluída: ${err}`, true); return close(); }
  note(`troca com ${ss.name}: deu ${ss.mine.map(TD.describe).join(', ') || 'nada'}; recebeu ${ss.theirs.map(TD.describe).join(', ') || 'nada'}`);
  award('trade'); confetti(60); sfx.play('stack', 0.7);
  say(`Troca com ${ss.name} concluída.`);
  save(); G.render();
  setTimeout(close, 1200);
}
export function chat() {
  const i = $('#tr-msg'), text = i.value.trim().slice(0, 140);
  if (!text || !ss) return;
  ss.chat.push({ me: true, text }); send({ t: 'chat', text }); i.value = ''; render();
}
export function cancel() { if (ss) send({ t: 'cancel' }); close(); }
function close() { if (ss?.timer) clearTimeout(ss.timer); ss = null; const d = $('#dlg-trade'); if (d?.open) d.close(); }
export const busy = () => !!ss;
