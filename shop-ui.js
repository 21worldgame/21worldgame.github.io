// Tela da loja: vender qualquer coisa na hora, anunciar pelo preço que quiser e comprar anúncios de outros jogadores.
// Compra entre jogadores pelo salão P2P: o comprador pede, o vendedor confere e entrega, o comprador paga ao receber.
import * as SH from './shop.js';
import * as TD from './trade.js';
import { G, $, esc, brl, say, save, note, award, confetti, profileOf } from './store.js';
import * as sfx from './sfx.js';
import * as Auth from './auth.js';
import * as NGU from './negocios-ui.js';

let lobby = null, media = () => '', kindName = {}, announce = () => {}, cat = 'all';
export const setCat = c => { cat = c || 'all'; render(); };
const inCat = c => cat === 'all' || c === cat;
const pending = new Set();
export function init({ itemMedia, ITEM_KIND, announceFn }) {
  media = itemMedia; kindName = ITEM_KIND; announce = announceFn;
  setInterval(npc, 30000);
  setInterval(offers, 40000);
}
// propostas dos jogadores do mundo pelos seus anúncios
function offers() {
  const o = SH.npcOffer(G.S, Date.now()); if (!o) return;
  save(); sfx.play('chip', 0.5);
  say(`${o.npc} ofereceu ${brl(o.price)} por ${o.label}${o.low ? ' (sabe que você está endividado)' : ''}. Veja no Feirão.`);
  render(); G.onOffer?.();
}
// anúncios novos de outros jogadores: avisa e destaca na hora (o salão sincroniza sozinho, sem recarregar)
const seen = new Set(); let primed = false; const fresh = new Map();
export function onPeers() {
  const all = lobby ? [...lobby.peers.entries()].flatMap(([pid, p]) => (p.shop || []).map(l => ({ ...l, pid, seller: p.profile?.name || 'jogador' }))) : [];
  for (const l of all) {
    const k = `${l.pid}|${l.id}`; if (seen.has(k)) continue; seen.add(k);
    if (primed) { fresh.set(k, Date.now()); say(`🛒 ${l.seller} anunciou no Feirão: ${String(l.label).slice(0, 50)} por ${brl(Number(l.price) || 0)}`); sfx.play('chip', 0.4); }
  }
  primed = true;
  if (!document.getElementById('p-loja')?.hidden || !document.getElementById('p-inventario')?.hidden) render();
}
export function attach(l) { lobby = l; }

// comprador da casa passa a cada 30 s olhando os anúncios
function npc() {
  const sold = SH.npcTick(G.S);
  if (!sold.length) return;
  for (const l of sold) { note(`loja: vendeu ${l.label}`, l.price); say(`Vendido na loja: ${l.label} por ${brl(l.price)}.`); sfx.play('stack', 0.6); }
  save(); announce(); G.render();
}

function cardFor(s, it, mine) {
  const l = mine.get(it.key), house = SH.housePrice(s, it), b = SH.blocked(s, it);
  return `<article class="scard${l ? ' is-listed' : ''}">
    <div class="scard__media">${media(it)}<span class="scard__kind">${esc(kindName[it.kind] || it.kind)}</span>${l ? '<span class="scard__on">anunciado</span>' : ''}</div>
    <div class="scard__body"><h4>${esc(it.label)}</h4>
      <p class="small">a loja paga agora <b class="good">${brl(house)}</b>${it.value ? ` <span class="muted">· vale ${brl(it.value)}</span>` : ''}</p>
      ${b ? `<p class="small bad">${esc(b)}</p>${l ? `<button class="btn btn--glass btn--sm" data-act="shop-unlist" data-id="${esc(l.id)}">tirar anúncio</button>` : ''}${it.kind === 'player' && s.fut?.club ? `<button class="btn btn--gold btn--sm" data-act="shop-sell" data-id="club:club">vender o clube inteiro por ${brl(SH.clubValue(s.fut))}</button>` : ''}` : l
        ? `<p class="small">anunciado por <b>${brl(l.price)}</b></p><button class="btn btn--glass btn--sm" data-act="shop-unlist" data-id="${esc(l.id)}">tirar anúncio</button>`
        : `<div class="row"><label class="visually-hidden" for="sp-${esc(it.key)}">preço</label><input class="input input--s" id="sp-${esc(it.key)}" type="number" min="100" step="100" value="${Math.round(Math.max(house, it.value || 0) * 1.1 / 100) * 100}" inputmode="numeric">
           <button class="btn btn--gold btn--sm" data-act="shop-list" data-id="${esc(it.key)}">anunciar</button></div>
           <button class="btn btn--glass btn--sm" data-act="shop-sell" data-id="${esc(it.key)}">vender agora por ${brl(house)}</button>`}
    </div></article>`;
}
export function render() {
  const s = G.S, all = SH.items(s), mine = new Map((s.shop || []).map(l => [l.key, l]));
  const npcs = SH.npcListings(s, Date.now());
  const counts = {}; for (const i of all) counts[SH.catOf(i)] = (counts[SH.catOf(i)] || 0) + 1; for (const l of npcs) counts[l.cat] = (counts[l.cat] || 0) + 1;
  $('#shop-cats').innerHTML = [['all', 'tudo'], ...Object.entries(SH.CATS)].map(([k, v]) => `<button class="shop-cat${cat === k ? ' is-on' : ''}" data-act="shop-cat" data-id="${k}">${v}${k !== 'all' && counts[k] ? ` <small>${counts[k]}</small>` : ''}</button>`).join('');
  const its = all.filter(i => i.kind !== 'player' && inCat(SH.catOf(i))), players = inCat('futebol') ? all.filter(i => i.kind === 'player') : [];
  const card = it => cardFor(s, it, mine);
  const myL = (s.shop || []).filter(l => inCat(SH.catOf({ kind: l.kind })));
  $('#shop-mine').innerHTML = myL.length ? myL.map(l => `<article class="scard scard--other is-listed"><div class="scard__body"><span class="scard__kind">${esc(kindName[l.kind] || l.kind)}</span><h4>${esc(l.label)}</h4><p class="small muted">anunciado há ${Math.max(1, Math.round((Date.now() - l.at) / 60000))} min · todos online estão vendo</p><p class="scard__price">${brl(l.price)}</p><button class="btn btn--glass btn--sm" data-act="shop-unlist" data-id="${esc(l.id)}">tirar anúncio</button></div></article>`).join('')
    : '<p class="empty glass">Você não tem anúncios. Anuncie pelo <button class="btn btn--gold btn--sm" data-tab-go="inventario">inventário</button></p>';
  const others = (lobby ? [...lobby.peers.entries()].flatMap(([pid, p]) => (p.shop || []).map(l => ({ ...l, pid, seller: p.profile?.name || 'jogador' }))) : []).filter(l => inCat(SH.catOf({ kind: l.kind })));
  const npcHTML = npcs.filter(l => inCat(l.cat)).map(npcCard).join('');
  const offs = (s.offersIn || []).filter(o => Date.now() - o.at < SH.OFFER_TTL);
  if ($('#shop-offers')) $('#shop-offers').innerHTML = offs.length ? `<h3>propostas pelos seus anúncios</h3><div class="offers">${offs.map(o => `<div class="offer glass${o.low ? ' is-low' : ''}"><span><b>${esc(o.npc)}</b> oferece <b class="good">${brl(o.price)}</b> por ${esc(o.label)}<small class="muted">você pediu ${brl(o.ask)}${o.low ? ' · proposta baixa porque você está endividado' : ''}</small></span><button class="btn btn--gold btn--sm" data-act="shop-offer-yes" data-id="${o.id}">aceitar</button><button class="btn btn--glass btn--sm" data-act="shop-offer-no" data-id="${o.id}">recusar</button></div>`).join('')}</div>` : '';
  $('#shop-others').innerHTML = others.length || npcHTML ? others.map(l => `<article class="scard scard--other${fresh.has(`${l.pid}|${l.id}`) && Date.now() - fresh.get(`${l.pid}|${l.id}`) < 60000 ? ' is-new' : ''}">
      <div class="scard__body"><span class="scard__kind">${esc(kindName[l.kind] || l.kind)}</span><h4>${esc(String(l.label).slice(0, 60))}</h4>
        <p class="small muted">vendido por ${esc(String(l.seller).slice(0, 18))}</p><p class="scard__price">${brl(Number(l.price) || 0)}</p>
        <button class="btn btn--gold btn--sm" data-act="shop-buy" data-id="${esc(l.pid)}|${esc(l.id)}|${Number(l.price) || 0}" ${pending.has(l.id) ? 'disabled' : ''}>${pending.has(l.id) ? 'aguardando...' : 'comprar'}</button></div></article>`).join('') + npcHTML
    : '<p class="empty glass">Nenhum jogador online está anunciando agora. Os seus anúncios aparecem aqui para os outros jogadores, e se ninguém comprar, um comprador da loja pode levar (pagando no máximo 5% acima do que a loja paga na hora).</p>';
}

function npcCard(l) {
  const m = l.cat === 'veiculo' || l.cat === 'maquina' ? `<img src="assets/${l.img}.webp" alt="" loading="lazy">` : l.cat === 'terra' ? media({ kind: 'land', data: l.land }) : l.cat === 'animal' ? media({ kind: 'animal', data: l.animal })
    : l.cat === 'gado' ? '<img src="assets/farm-bezerro.webp" alt="" loading="lazy">' : l.cat === 'produto' ? media({ kind: 'good', good: l.good }) : l.cat === 'carta' ? media({ kind: 'card', data: l.card }) : media({ kind: 'player' });
  return `<article class="scard scard--other">
    <div class="scard__media">${m}<span class="scard__kind">${esc(SH.CATS[l.cat])}</span></div>
    <div class="scard__body"><h4>${esc(l.label)}</h4><p class="small muted">anunciado por <b>${esc(l.seller)}</b></p><p class="scard__price">${brl(l.price)}</p>
      <button class="btn btn--gold btn--sm" data-act="shop-npc" data-id="${esc(l.id)}">comprar</button></div></article>`;
}
export function buyNpc(id) {
  const l = SH.npcListings(G.S, Date.now()).find(x => x.id === id); if (!l) return say('Esse anúncio já saiu do ar.', true);
  if (!confirm(`Comprar ${l.label} de ${l.seller} por ${brl(l.price)}?`)) return;
  const r = SH.buyNpc(G.S, id, Date.now());
  if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  note(`loja: comprou ${l.label} de ${l.seller}`, -l.price); say(`Comprado de ${l.seller}: ${l.label}.`); sfx.play('stack', 0.6); confetti(30);
}
// inventário: os mesmos cards (vender agora / anunciar no Feirão), filtrados por categoria
export function mineHTML(c = 'all') {
  const s = G.S, mine = new Map((s.shop || []).map(l => [l.key, l])), all = SH.items(s).filter(i => c === 'all' || SH.catOf(i) === c);
  return all.map(it => cardFor(s, it, mine)).join('') || '<p class="empty glass">Nada seu nesta categoria.</p>';
}
export function invCats() { const s = G.S, n = {}; for (const i of SH.items(s)) n[SH.catOf(i)] = (n[SH.catOf(i)] || 0) + 1; return n; }
export function acceptOffer(id) {
  const r = SH.acceptOffer(G.S, id); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  note(`Feirão: vendeu ${r.offer.label} para ${r.offer.npc}`, r.offer.price); say(`Vendido para ${r.offer.npc} por ${brl(r.offer.price)}.`); sfx.play('stack', 0.6); confetti(30); save(); announce(); G.render();
}
export function rejectOffer(id) { SH.rejectOffer(G.S, id); save(); render(); }
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
  const l = lobby.peers.get(pid)?.shop?.find(x => x.id === lid);
  if (l?.kind === 'club' && G.S.fut?.club) return say('Você já comanda um clube: venda o seu antes de comprar outro.', true);
  pending.add(lid);
  lobby.sendTrade({ t: 'shopbuy', lid, price: p, name: profileOf().name }, pid);
  setTimeout(() => { if (pending.delete(lid)) { say('O vendedor não respondeu. Tente de novo.', true); render(); } }, 15000);
  render();
}
// mensagens da loja entre jogadores
export async function onMsg(d, peer) {
  const s = G.S;
  if (d.t === 'shopbuy') {
    const l = (s.shop || []).find(x => x.id === d.lid), it = l && SH.find(s, l.key);
    if (!l || !it || Number(d.price) !== l.price) return lobby.sendTrade({ t: 'shopno', lid: d.lid, why: 'esse anúncio não está mais disponível.' }, peer);
    const give = [it.kind === 'good' ? { kind: 'good', good: it.good, qty: it.qty } : it.kind === 'acc' ? { kind: 'acc', acc: it.acc } : it.kind === 'empresa' ? { kind: 'empresa', cat: it.cat, data: it.data }
      : it.kind === 'club' ? { kind: 'club', data: { club: s.fut.club, squad: s.fut.squad, stadium: s.fut.stadium, trophies: s.fut.trophies } } : { kind: it.kind, data: it.data }];
    const err = TD.apply(s, give, [{ kind: 'money', amount: l.price }]);
    if (err) return lobby.sendTrade({ t: 'shopno', lid: d.lid, why: err }, peer);
    SH.unlist(s, l.id);
    if (it.kind === 'empresa') { try { await Auth.sbClient()?.rpc('release_company', { p_brand: it.data.brand }); } catch {} }   // a marca passa para o comprador
    lobby.sendTrade({ t: 'shopok', lid: d.lid, price: l.price, item: give[0] }, peer);
    note(`loja: ${String(d.name || 'jogador').slice(0, 18)} comprou ${l.label}`, l.price); say(`${String(d.name || 'Um jogador').slice(0, 18)} comprou ${l.label} por ${brl(l.price)}!`);
    sfx.play('stack', 0.7); award('trade'); save(); announce(); G.render();
  }
  if (d.t === 'shopok' && pending.delete(d.lid)) {
    const err = TD.apply(s, [{ kind: 'money', amount: Math.floor(Number(d.price) || 0) }], [d.item]);
    if (err) return say(`Compra não concluída: ${err}`, true);
    note(`loja: comprou ${TD.describe(TD.sanitize([d.item])[0] || {})}`, -d.price); say(`Compra feita: ${brl(d.price)}.`);
    if (d.item?.kind === 'empresa') NGU.refreshOwners();   // registra a marca no seu nome
    confetti(40); award('trade'); save(); G.render();
  }
  if (d.t === 'shopno' && pending.delete(d.lid)) { say(String(d.why || 'Compra recusada.').slice(0, 120), true); render(); }
}
