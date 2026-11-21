// Trocas em tempo real entre jogadores online (pela sala do salão): convite, ofertas, chat, "pronto" e confirmação dupla.
import * as TD from './trade.js';
import * as SH from './shop.js';
import * as NPC from './npcs.js';
import { CHIP } from './logic.js';
import { G, $, esc, brl, int, say, save, note, award, confetti, profileOf } from './store.js';
import * as sfx from './sfx.js';
import * as AMU from './amigos-ui.js';
import * as AM from './amigos.js';
document.addEventListener('am:changed', () => render());   // parceria mexeu (empréstimo, aluguel): redesenha a janela
document.addEventListener('click', e => { const b = e.target.closest('[data-trtab]'); if (b && ss) { ss.tab = b.dataset.trtab; render(); } });

let lobby = null, ss = null;           // ss = sessão de troca aberta
const myName = () => profileOf().name;
const send = msg => { if (!ss?.bot) lobby?.sendTrade({ ...msg, id: ss?.id }, ss?.peer); };   // com jogador do mundo não há rede

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

// negociar com um jogador do mundo: ele vende pelo preço do mercado (anúncios da janela) e compra seus itens pelo preço da casa
export function inviteBot(id) {
  const n = NPC.byId(id);
  if (!n) return say('Esse jogador saiu do mundo.', true);
  if (ss) return say('Termine a troca aberta antes de começar outra.', true);
  ss = { bot: true, peer: null, name: n.nick, id: Math.random().toString(36).slice(2, 10), mine: [], theirs: [], picks: [], lock: { me: false, them: true }, ok: { me: false, them: true }, chat: [], open: true };
  openWindow();
}
const botListings = () => SH.npcListings(G.S, Date.now());
const botValue = it => it.kind === 'money' ? it.amount : it.kind === 'chips' ? Math.floor(it.amount * CHIP * 0.95) : SH.housePrice(G.S, it);
function botTotals() {
  const ls = botListings(), picked = ss.picks.map(id => ls.find(l => l.id === id)).filter(Boolean);
  return { ls, picked, asked: picked.reduce((t, l) => t + l.price, 0), offered: ss.mine.reduce((t, i) => t + botValue(i), 0) };
}
const botOk = () => { const t = botTotals(); return t.picked.length > 0 && t.picked.length === ss.picks.length && t.offered >= t.asked; };
export function botAdd() { const id = $('#tr-botpick').value; if (!ss?.bot || !id || ss.picks.includes(id)) return; ss.picks.push(id); changed(); }
export function botDrop(id) { if (!ss?.bot) return; ss.picks = ss.picks.filter(x => x !== id); changed(); }
function botApply() {
  const { picked, asked, offered } = botTotals();
  if (!picked.length || picked.length !== ss.picks.length) return 'um dos itens já saiu do mercado.';
  if (offered < asked) return 'a sua oferta não cobre o preço de mercado.';
  const e = TD.apply(G.S, ss.mine, picked.flatMap(l => l.items)); if (e) return e;
  for (const l of picked) if (l.heads) G.S.herd.push({ id: G.S.nextId++, heads: l.heads, kg: 190 });
  if (offered > asked) G.S.money += offered - asked;                    // troco em dinheiro
  const win = Math.floor(Date.now() / SH.NPC_WIN); if (G.S.npcSold?.win !== win) G.S.npcSold = { win, ids: [] };
  G.S.npcSold.ids.push(...picked.map(l => l.id));
  ss.got = picked.map(l => l.label); ss.change = offered - asked;
  return null;
}

function onMsg(d, peerId) {
  if (!d || typeof d !== 'object') return;
  if (String(d.t).startsWith('shop')) return G.onShopMsg?.(d, peerId);   // compras da loja usam o mesmo canal
  if (d.t === 'lbid') return G.onAuctionMsg?.(d, peerId);                 // lances do leilão de cavalos
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
  $('#tr-who').textContent = `negociação com ${ss.name}`;
  // topo: os dois lados, cada um com o que tem
  $('#tr-me').innerHTML = AMU.sideMe();
  $('#tr-them').innerHTML = ss.bot ? AMU.sideBot(ss.name) : AMU.sidePeer(lobby?.peers.get(ss.peer)?.profile || { name: ss.name });
  // abas: com jogador de verdade, parceria e empréstimo só aparecem depois de marcar a caixinha "parceiro"
  const full = ss.bot || AM.isFriend(G.S, ss.name);
  if (!full) ss.tab = 'troca';
  ss.tab ||= 'troca';
  for (const b of document.querySelectorAll('#tr-tabs [data-trtab]')) { b.hidden = !full && b.dataset.trtab !== 'troca'; b.classList.toggle('is-on', b.dataset.trtab === ss.tab); b.setAttribute('aria-pressed', String(b.dataset.trtab === ss.tab)); }
  $('#tr-tabs').hidden = !full;
  for (const p of document.querySelectorAll('#dlg-trade [data-pane]')) { p.hidden = p.dataset.pane !== ss.tab; p.dataset.nick = full ? ss.name : ''; }
  if (ss.tab === 'parceria') { $('#tr-partner').dataset.nick = ss.name; $('#tr-partner').innerHTML = AMU.rentHTML(ss.name); }
  if (ss.tab === 'dinheiro') { $('#tr-cash').dataset.nick = ss.name; $('#tr-cash').innerHTML = AMU.cashHTML(ss.name); }
  $('#tr-steps').innerHTML = (ss.bot
    ? ['Em <b>você recebe</b>, escolha o que quer comprar dele (ele vende pelo preço de mercado).', 'Em <b>você dá</b>, ponha dinheiro ou itens seus que cubram o preço. Ele paga seus itens pelo valor de venda na hora; o que sobrar volta em dinheiro.', 'Clique <b>estou pronto</b> e depois <b>confirmar troca</b>.']
    : ['Em <b>você dá</b>, monte o que vai entregar (itens, dinheiro ou fichas).', `${esc(ss.name)} monta o lado dele; aparece em <b>você recebe</b>. Combinem pelo chat.`, 'Os dois clicam <b>estou pronto</b> e depois <b>confirmar troca</b>. Se alguém mexer, os dois confirmam de novo.']).map(x => `<li>${x}</li>`).join('');
  const val = it => ss.bot ? ` <small class="muted">vale ${brl(botValue(it))}</small>` : '';
  const list = (items, mine) => items.length ? items.map((it, k) => `<li><span>${esc(TD.describe(it))}${mine ? val(it) : ''}</span>${mine ? `<button class="btn btn--glass btn--sm" data-act="trade-remove" data-id="${k}">tirar</button>` : ''}</li>`).join('') : `<li class="muted small">${mine ? 'nada ainda: escolha abaixo' : 'nada ainda'}</li>`;
  $('#tr-mine').innerHTML = list(ss.mine, true);
  $('#tr-bot').hidden = $('#tr-bal').hidden = !ss.bot; $('#tr-chatbox').hidden = !!ss.bot;
  if (ss.bot) {
    const t = botTotals(); ss.picks = ss.picks.filter(id => t.ls.some(l => l.id === id)); ss.theirs = t.picked.flatMap(l => l.items);
    $('#tr-theirs').innerHTML = t.picked.length ? t.picked.map(l => `<li><span>${esc(l.label)}: <b>${brl(l.price)}</b></span><button class="btn btn--glass btn--sm" data-act="trade-botdrop" data-id="${esc(l.id)}">tirar</button></li>`).join('') : '<li class="muted small">escolha abaixo o que quer comprar</li>';
    $('#tr-botpick').innerHTML = t.ls.filter(l => !ss.picks.includes(l.id)).map(l => `<option value="${esc(l.id)}">${esc(l.label)}, ${brl(l.price)}</option>`).join('') || '<option value="">sem anúncios agora</option>';
    const falta = t.asked - t.offered;
    $('#tr-bal').innerHTML = !t.picked.length ? `Escolha em <b>você recebe</b> o que quer comprar de ${esc(ss.name)}.`
      : `<span>ele pede <b>${brl(t.asked)}</b></span><span>você oferece <b>${brl(t.offered)}</b></span><span class="${falta > 0 ? 'bad' : 'good'}">${falta > 0 ? `faltam <b>${brl(falta)}</b>: ponha mais dinheiro ou itens` : falta < 0 ? `sobram ${brl(-falta)}, que voltam para você em dinheiro` : 'valor certinho'}</span>`;
  } else $('#tr-theirs').innerHTML = list(ss.theirs, false);
  const taken = new Set(ss.mine.map(offerKey));
  $('#tr-pick').innerHTML = SH.items(G.S).filter(i => !taken.has(i.key)).map(i => `<option value="${esc(i.key)}">${esc(i.label)}${ss.bot ? ` · vale ${brl(SH.housePrice(G.S, i))}` : ''}</option>`).join('') || '<option value="">seu inventário está vazio</option>';
  $('#tr-state').innerHTML = `<span>você: <b class="${ss.lock.me ? 'good' : ''}">${ss.ok.me ? 'confirmou' : ss.lock.me ? 'pronto' : 'montando a oferta'}</b></span><span>${esc(ss.name)}: <b class="${ss.lock.them ? 'good' : ''}">${ss.bot ? 'aceita pelo preço de mercado' : ss.ok.them ? 'confirmou' : ss.lock.them ? 'pronto' : 'montando a oferta'}</b></span>`;
  $('[data-act="trade-lock"]').textContent = ss.lock.me ? 'mexer de novo' : 'estou pronto';
  $('[data-act="trade-confirm"]').disabled = !(ss.lock.me && ss.lock.them) || ss.ok.me || (ss.bot && !botOk());
  $('#tr-chat').innerHTML = ss.chat.slice(-30).map(c => `<li class="${c.me ? 'is-me' : ''}">${esc(c.text)}</li>`).join('');
  $('#tr-chat').scrollTop = 1e6;
}

// mudou a oferta: os dois precisam ficar "prontos" de novo
function changed() {
  const err = TD.canGive(G.S, ss.mine);
  if (err) { ss.mine.pop(); return say(err[0].toUpperCase() + err.slice(1), true); }
  ss.lock = { me: false, them: !!ss.bot }; ss.ok = { me: false, them: !!ss.bot };
  send({ t: 'offer', items: ss.mine });
  render();
}
// chave do item oferecido = chave do inventário (SH.items)
const offerKey = o => o.kind === 'good' ? `good:${o.good}` : o.kind === 'acc' ? `acc:${o.acc}` : o.kind === 'club' ? 'club:club' : `${o.kind}:${o.data?.id}`;
export function addPicked() {
  const v = $('#tr-pick').value; if (!v || !ss) return;
  const it = SH.find(G.S, v);
  if (!it) return;
  const b = SH.blocked(G.S, it); if (b) return say(b[0].toUpperCase() + b.slice(1), true);
  if (it.kind === 'good') { const q = Math.floor(Number(prompt(`Quantas sacas de ${TD.GOODS[it.good] || it.good}? (você tem ${it.qty})`, it.qty)) || 0); if (q <= 0) return; ss.mine.push({ kind: 'good', good: it.good, qty: Math.min(q, it.qty) }); }
  else if (it.kind === 'acc') ss.mine.push({ kind: 'acc', acc: it.acc });
  else if (it.kind === 'empresa') ss.mine.push({ kind: 'empresa', cat: it.cat, data: it.data });
  else if (it.kind === 'club') ss.mine.push({ kind: 'club', data: JSON.parse(JSON.stringify(G.S.fut)) });
  else ss.mine.push({ kind: it.kind, data: it.data });
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
  const err = ss.bot ? botApply() : TD.apply(G.S, ss.mine, ss.theirs);
  if (err) { send({ t: 'cancel', reason: err }); say(`A troca não pôde ser concluída: ${err}`, true); return close(); }
  note(`troca com ${ss.name}: deu ${ss.mine.map(TD.describe).join(', ') || 'nada'}; recebeu ${(ss.bot ? ss.got : ss.theirs.map(TD.describe)).join(', ') || 'nada'}${ss.change > 0 ? `; troco de R$ ${Math.round(ss.change).toLocaleString('pt-BR')}` : ''}`);
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
