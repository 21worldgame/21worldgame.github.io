// Tela da loja: vender qualquer coisa na hora, anunciar pelo preço que quiser e comprar anúncios de outros jogadores.
// Compra entre jogadores pelo salão P2P: o comprador pede, o vendedor confere e entrega, o comprador paga ao receber.
import * as SH from './shop.js';
import * as TD from './trade.js';
import { G, $, esc, brl, say, save, note, award, confetti, profileOf } from './store.js';
import * as sfx from './sfx.js';

let lobby = null, media = () => '', kindName = {}, announce = () => {};
const pending = new Set();
export function init({ itemMedia, ITEM_KIND, announceFn }) {
  media = itemMedia; kindName = ITEM_KIND; announce = announceFn;
  setInterval(npc, 30000);
}
export function attach(l) { lobby = l; }

// comprador da casa passa a cada 30 s olhando os anúncios
function npc() {
  const sold = SH.npcTick(G.S);
  if (!sold.length) return;
  for (const l of sold) { note(`loja: vendeu ${l.label}`, l.price); say(`Vendido na loja: ${l.label} por ${brl(l.price)}.`); sfx.play('stack', 0.6); }
  save(); announce(); G.render();
}

export function render() {
  const s = G.S, all = SH.items(s), mine = new Map((s.shop || []).map(l => [l.key, l]));
  const its = all.filter(i => i.kind !== 'player'), players = all.filter(i => i.kind === 'player');
  const card = it => {
    const l = mine.get(it.key), house = SH.housePrice(s, it), b = SH.blocked(s, it);
    return `<article class="scard${l ? ' is-listed' : ''}">
      <div class="scard__media">${media(it)}<span class="scard__kind">${esc(kindName[it.kind] || it.kind)}</span>${l ? '<span class="scard__on">anunciado</span>' : ''}</div>
      <div class="scard__body"><h4>${esc(it.label)}</h4>
        <p class="small">a loja paga agora <b class="good">${brl(house)}</b>${it.value ? ` <span class="muted">· vale ${brl(it.value)}</span>` : ''}</p>
        ${b ? `<p class="small bad">${esc(b)}</p>` : l
          ? `<p class="small">anunciado por <b>${brl(l.price)}</b></p><button class="btn btn--glass btn--sm" data-act="shop-unlist" data-id="${esc(l.id)}">tirar anúncio</button>`
          : `<div class="row"><label class="visually-hidden" for="sp-${esc(it.key)}">preço</label><input class="input input--s" id="sp-${esc(it.key)}" type="number" min="100" step="100" value="${Math.round(Math.max(house, it.value || 0) * 1.1 / 100) * 100}" inputmode="numeric">
             <button class="btn btn--gold btn--sm" data-act="shop-list" data-id="${esc(it.key)}">anunciar</button></div>
             <button class="btn btn--glass btn--sm" data-act="shop-sell" data-id="${esc(it.key)}">vender agora por ${brl(house)}</button>`}
      </div></article>`;
  };
  $('#shop-mine').innerHTML = all.length ? its.map(card).join('') + (players.length ? `<details class="shop-players"><summary>jogadores do seu clube (${players.length}): vender ou anunciar um por um</summary><div class="shop-grid">${players.map(card).join('')}</div></details>` : '') : '<p class="empty glass">Você ainda não tem nada para vender. Compre carros, animais, terras, cartas ou um clube.</p>';
  const others = lobby ? [...lobby.peers.entries()].flatMap(([pid, p]) => (p.shop || []).map(l => ({ ...l, pid, seller: p.profile?.name || 'jogador' }))) : [];
  $('#shop-others').innerHTML = others.length ? others.map(l => `<article class="scard scard--other">
      <div class="scard__body"><span class="scard__kind">${esc(kindName[l.kind] || l.kind)}</span><h4>${esc(String(l.label).slice(0, 60))}</h4>
        <p class="small muted">vendido por ${esc(String(l.seller).slice(0, 18))}</p><p class="scard__price">${brl(Number(l.price) || 0)}</p>
        <button class="btn btn--gold btn--sm" data-act="shop-buy" data-id="${esc(l.pid)}|${esc(l.id)}|${Number(l.price) || 0}" ${pending.has(l.id) ? 'disabled' : ''}>${pending.has(l.id) ? 'aguardando...' : 'comprar'}</button></div></article>`).join('')
    : '<p class="empty glass">Nenhum jogador online está anunciando agora. Os seus anúncios aparecem aqui para os outros jogadores, e se ninguém comprar, um comprador da loja pode levar (pagando no máximo 5% acima do que a loja paga na hora).</p>';
}

export function sellNow(key) {
  const it = SH.find(G.S, key); if (!it) return;
  if (!confirm(`Vender ${it.label} agora por ${brl(SH.housePrice(G.S, it))}?`)) return;
  const r = SH.sellToHouse(G.S, key);
  if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  note(`loja: vendeu ${r.item.label}`, r.amount); say(`Vendido por ${brl(r.amount)}.`); sfx.play('stack', 0.6);
  save(); announce(); G.render();
}
export function listItem(key) {
  const price = Number(document.getElementById(`sp-${key}`)?.value);
  const err = SH.list(G.S, key, price);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  say(`Anunciado por ${brl(price)}. Jogadores online veem na loja.`); save(); announce(); render();
}
export function unlist(id) { SH.unlist(G.S, id); save(); announce(); render(); }

export function buy(arg) {
  const [pid, lid, price] = String(arg).split('|'), p = Number(price);
  if (!lobby) return say('Sem conexão com o salão agora.', true);
  if (!(p > 0) || p > G.S.money) return say('Dinheiro insuficiente para essa compra.', true);
  pending.add(lid);
  lobby.sendTrade({ t: 'shopbuy', lid, price: p, name: profileOf().name }, pid);
  setTimeout(() => { if (pending.delete(lid)) { say('O vendedor não respondeu. Tente de novo.', true); render(); } }, 15000);
  render();
}
// mensagens da loja entre jogadores
export function onMsg(d, peer) {
  const s = G.S;
  if (d.t === 'shopbuy') {
    const l = (s.shop || []).find(x => x.id === d.lid), it = l && SH.find(s, l.key);
    if (!l || !it || Number(d.price) !== l.price || l.kind === 'club') return lobby.sendTrade({ t: 'shopno', lid: d.lid, why: 'esse anúncio não está mais disponível.' }, peer);
    const give = [it.kind === 'good' ? { kind: 'good', good: it.good, qty: it.qty } : { kind: it.kind, data: it.data }];
    const err = TD.apply(s, give, [{ kind: 'money', amount: l.price }]);
    if (err) return lobby.sendTrade({ t: 'shopno', lid: d.lid, why: err }, peer);
    SH.unlist(s, l.id);
    lobby.sendTrade({ t: 'shopok', lid: d.lid, price: l.price, item: give[0] }, peer);
    note(`loja: ${String(d.name || 'jogador').slice(0, 18)} comprou ${l.label}`, l.price); say(`${String(d.name || 'Um jogador').slice(0, 18)} comprou ${l.label} por ${brl(l.price)}!`);
    sfx.play('stack', 0.7); award('trade'); save(); announce(); G.render();
  }
  if (d.t === 'shopok' && pending.delete(d.lid)) {
    const err = TD.apply(s, [{ kind: 'money', amount: Math.floor(Number(d.price) || 0) }], [d.item]);
    if (err) return say(`Compra não concluída: ${err}`, true);
    note(`loja: comprou ${TD.describe(TD.sanitize([d.item])[0] || {})}`, -d.price); say(`Compra feita: ${brl(d.price)}.`);
    confetti(40); award('trade'); save(); G.render();
  }
  if (d.t === 'shopno' && pending.delete(d.lid)) { say(String(d.why || 'Compra recusada.').slice(0, 120), true); render(); }
}
