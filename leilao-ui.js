// Leilão ao vivo de animais de raça (aba canil e haras): galgos na aba galgos, cavalos na aba cavalos. Lances de pessoas vão para todo o salão na hora.
import * as LE from './leilao.js';
import * as ST from './stable.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import * as RC from './racing.js';
import { G, $, esc, brl, int, say, save, note, confetti, profileOf } from './store.js';
import * as sfx from './sfx.js';

let lobby = null, sig = '';
const bids = new Map();     // slot -> [{ at, name, pid, amt }]
const done = new Set();
export function attach(l) { lobby = l; }
const nicks = slot => [...NPC.onlineSet(slot * LE.SLOT)].sort().map(id => NPC.byId(id)?.nick).filter(Boolean);
export let kind = 'dog';
export const setKind = k => { kind = k === 'horse' ? 'horse' : 'dog'; sig = ''; render(); };
const key = (k, slot) => `${k}:${slot}`;
const lotOf = (slot, k = kind) => LE.lot(slot, nicks(slot), k);
const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const me = () => lobby?.selfId || 'me';

// lance de outra pessoa chegando pelo salão
export function onMsg(d) {
  if (d?.t !== 'lbid') return;
  const slot = Number(d.slot), amt = Math.floor(Number(d.amt)), at = Math.min(Date.now(), Number(d.at) || Date.now()), k = d.kind === 'dog' ? 'dog' : 'horse';
  if (!(amt > 0) || Math.abs(slot - LE.slotOf(Live.now())) > 1) return;
  const list = bids.get(key(k, slot)) || []; if (list.some(b => b.id === d.id)) return;
  list.push({ id: String(d.id).slice(0, 16), at, amt, name: String(d.name || 'jogador').replace(/[<>&"]/g, '').slice(0, 18), pid: String(d.pid || '').slice(0, 40) });
  bids.set(key(k, slot), list); sig = ''; render();
}
export function bid(mult = 1) {
  const now = Live.now(), slot = LE.slotOf(now), L = lotOf(slot), st = LE.state(L, now, bids.get(key(kind, slot)));
  if (st.phase !== 'live') return say(`Os lances abrem quando a apresentação do ${kind === 'dog' ? 'galgo' : 'cavalo'} terminar.`, true);
  if (st.leader?.pid === me()) return say('Você já está na frente.', true);
  const amt = st.next + L.inc * (mult - 1);
  if (amt > G.S.money) return say(`Você precisa de ${brl(amt)} em dinheiro para esse lance.`, true);
  const b = { t: 'lbid', kind, id: Math.random().toString(36).slice(2, 10), slot, amt, at: now, name: profileOf().name, pid: me() };
  (bids.get(key(kind, slot)) || bids.set(key(kind, slot), []).get(key(kind, slot))).push(b);
  try { lobby?.sendTrade(b); } catch {}
  sfx.play('chip', 0.6); sig = ''; render();
}
// fim do leilão: quem venceu recebe o cavalo
function settle(slot, k = kind) {
  if (done.has(key(k, slot))) return; done.add(key(k, slot));
  const L = lotOf(slot, k), st = LE.state(L, LE.endsAt(slot), bids.get(key(k, slot)));
  if (st.leader?.pid !== me()) { if ((bids.get(key(k, slot)) || []).some(b => b.pid === me())) say(`Leilão encerrado: ${st.leader?.name || 'ninguém'} levou ${L.horse.name} por ${brl(st.price)}.`); return; }
  const err = LE.deliver(G.S, L, st.price);
  if (err) return say(`Você venceu, mas ${err}`, true);
  note(`leilão: arrematou ${L.horse.name} (${LE.breedsOf(k)[L.horse.breed].name})`, -st.price);
  say(`Arrematado! ${L.horse.name} é seu por ${brl(st.price)}.`); confetti(120); sfx.play('stack', 0.8); save(); G.render();
}

export function render() {
  const el = $('#lei-box'); if (!el || $('#p-haras')?.hidden) return;
  const now = Live.now(), slot = LE.slotOf(now), L = lotOf(slot), st = LE.state(L, now, bids.get(key(kind, slot))), a = L.horse, B = LE.breedsOf(kind)[a.breed];
  const tt = $('#lei-title'); if (tt) tt.innerHTML = kind === 'dog' ? '🐕 leilão de galgos de raça <small class="muted">os mais velozes, um atrás do outro, o dia inteiro</small>' : '🐎 leilão de cavalos de raça <small class="muted">um atrás do outro, o dia inteiro</small>';
  if (st.ended || st.phase === 'closed') settle(slot);
  const lead = st.leader?.pid === me(), clock = st.phase === 'preview' ? `lances abrem em ${mmss(st.left)}` : st.phase === 'live' ? `termina em ${mmss(st.left)}` : `encerrado · próximo em ${mmss(LE.slotOf(now) * LE.SLOT + LE.SLOT - now)}`;
  const s2 = `${kind}|${slot}|${st.price}|${st.leader?.name}|${(bids.get(key(kind, slot)) || []).length}|${Math.floor(st.left / 1000)}`;
  if (s2 === sig) return; sig = s2;
  const next = [1, 2, 3].map(k => { const n = lotOf(slot + k); return `<li><b>${new Date((slot + k) * LE.SLOT).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b> ${esc(LE.breedsOf(kind)[n.horse.breed].name)} ${'★'.repeat(n.horse.stars)} <span class="muted">avaliado em ${brl(n.value)}</span></li>`; }).join('');
  el.innerHTML = `<div class="lei glass${st.phase === 'live' ? ' is-live' : ''}">
    <div class="lei__horse"><span class="lei__photo"><img src="${ST.photo(a, G.S)}" alt="${esc(a.name)}"><i class="lei__breed">${esc(B.name)}</i></span>
      <div><span class="lei__tag">${st.phase === 'live' ? '<i></i>leilão ao vivo' : st.phase === 'preview' ? 'apresentação' : 'encerrado'}</span>
        <h3>${esc(a.name)}</h3><p><b>${esc(B.name)}</b> <span class="lei__stars">${'★'.repeat(a.stars)}${'☆'.repeat(5 - a.stars)}</span> <span class="muted small">${esc(B.note)}</span></p>
        <p class="small">velocidade ${a.spd} · resistência ${a.sta} · largada ${a.acc} · potencial ${a.pot} · nota ${ST.rating(a)} · ${Math.floor(a.age / 12)} anos</p>
        <p class="small muted">avaliado em <b>${brl(L.value)}</b> · lance mínimo ${brl(L.start)} · incremento ${brl(L.inc)}</p></div></div>
    <div class="lei__bid"><span class="lei__clock">${clock}</span>
      <span class="muted small">lance atual</span><strong class="lei__price">${st.price ? brl(st.price) : '—'}</strong>
      <span class="small">${st.leader ? `na frente: <b class="${lead ? 'good' : ''}">${esc(lead ? 'você' : st.leader.name)}</b>` : 'sem lances ainda'}</span>
      ${st.phase === 'live' ? `<button class="btn btn--gold btn--lg" data-lei="1" ${lead ? 'disabled' : ''}>dar lance de ${brl(st.next)}</button><button class="btn btn--glass btn--sm" data-lei="5" ${lead ? 'disabled' : ''}>lance forte: ${brl(st.next + L.inc * 4)}</button>` : ''}
      <ol class="lei__hist">${st.hist.map(h => `<li${h.human ? ' class="is-human"' : ''}><b>${esc(h.name)}</b> ${brl(h.amt)}</li>`).join('') || '<li class="muted">ninguém deu lance ainda</li>'}</ol></div>
    <div class="lei__next"><h4>próximos leilões</h4><ul>${next}</ul></div></div>`;
}
setInterval(render, 1000);
// o leilão termina mesmo com você em outra tela: quem venceu recebe o cavalo assim mesmo
setInterval(() => { const now = Live.now(), sl = LE.slotOf(now); for (const sp of ['dog', 'horse']) for (const k of [sl - 1, sl]) if (now >= LE.endsAt(k) && (bids.get(key(sp, k)) || []).some(b => b.pid === me())) settle(k, sp); }, 2000);
document.addEventListener('click', e => { const b = e.target.closest('[data-lei]'); if (b && !b.disabled) bid(Number(b.dataset.lei)); });
