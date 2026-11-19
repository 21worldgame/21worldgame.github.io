// Tela da suinocultura (aba suínos).
import * as SU from './suinos.js';
import { G, $, esc, brl, int, say, save, note, confetti } from './store.js';

export function render() {
  const el = $('#sn2-barns'); if (!el) return;
  const s = G.S, st = SU.ensure(s), P = s.prices;
  const pr = (k, label, unit) => { const p = P[k], pv = s.prev?.[k] ?? p, ch = pv ? (p / pv - 1) * 100 : 0; return `<div class="tile glass"><span class="muted small">${label}</span><strong>R$ ${p.toFixed(2).replace('.', ',')} <small class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%</small></strong><small class="muted">${unit}</small></div>`; };
  $('#sn2-prices').innerHTML = pr('suino', 'suíno vivo', 'por kg') + pr('leitao', 'leitão (~23 kg)', 'por cabeça') + pr('racaoSuino', 'ração de suíno', 'por kg');
  el.innerHTML = st.barns.length ? st.barns.map(b => {
    const B = SU.BARNS[b.type], l = SU.lotOf(s, b.id);
    const lot = l ? `<div class="sn2-lot"><b>${int(l.pigs)} suínos · ${l.age} ${l.age === 1 ? 'mês' : 'meses'} · ~${SU.kgAt(l.age)} kg</b>
        <span class="bar"><i style="transform:scaleX(${Math.min(1, l.age / 4).toFixed(2)})"></i></span>
        <span class="small">${l.age < 4 ? `ponto de venda em ${4 - l.age} ${4 - l.age === 1 ? 'mês' : 'meses'} (~${SU.kgAt(4)} kg)` : '<b class="good">no ponto de venda!</b> Depois daqui a engorda cai e a ração pesa mais.'} ${l.vac ? '· vacinado' : '<b class="bad">· sem vacina</b>'}</span>
        <span class="small">vale hoje <b class="good">${brl(SU.lotValue(s, l))}</b> (pago ${brl(l.cost)} nos leitões)</span>
        <button class="btn btn--gold btn--sm" data-su="sell" data-id="${b.id}">vender o lote (${brl(SU.lotValue(s, l))})</button></div>`
      : `<div class="sn2-lot"><span class="muted small">Barracão vazio (custo fixo reduzido). Alojar leitões:</span>
        <div class="row"><label class="field"><span>leitões (até ${int(B.cap)})</span><input class="input input--s" id="su-n-${b.id}" type="number" min="10" max="${B.cap}" step="10" value="${B.cap}"></label>
        <label class="tr-hide"><input type="checkbox" id="su-v-${b.id}" checked> vacinar (+${brl(SU.VACCINE)} por leitão)</label>
        <button class="btn btn--gold btn--sm" data-su="house" data-id="${b.id}">alojar (${brl(SU.housing(s, B.cap, true))})</button></div></div>`;
    return `<article class="glass gr-card"><img src="assets/${B.img}.webp" alt="" loading="lazy"><div><h4>${esc(B.label)}</h4><p class="small muted">até ${int(B.cap)} suínos · conversão ${B.conv.toString().replace('.', ',')} kg de ração por kg · mortalidade ${(B.mort * 100).toFixed(1)}%/mês · custo fixo ${brl(B.fixed)}/mês</p>${lot}
      <button class="btn btn--glass btn--sm" data-su="sellbarn" data-id="${b.id}">vender barracão (${brl(b.value * SU.RESALE)})</button></div></article>`;
  }).join('') : '<p class="empty glass">Você ainda não tem barracão. Compre um abaixo.</p>';
  $('#sn2-shop').innerHTML = Object.entries(SU.BARNS).map(([k, B]) => `<article class="shopcard"><div class="shopcard__photo" style="--img:url(assets/${B.img}.webp)"><span class="shopcard__badge">${int(B.cap)} suínos</span></div>
    <div class="shopcard__body"><h4>${B.label}</h4><p class="small muted">conversão ${B.conv.toString().replace('.', ',')} kg de ração por kg · mortalidade ${(B.mort * 100).toFixed(1)}%/mês</p><div class="shopcard__buy"><span class="shopcard__price">${brl(B.price)}</span><button class="btn btn--gold" data-su="buy" data-id="${k}">comprar</button></div></div></article>`).join('');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-su]'); if (!b) return;
  const s = G.S, a = b.dataset.su, id = b.dataset.id; let err = null, msg = '';
  if (a === 'buy') { const B = SU.BARNS[id]; if (!confirm(`Comprar ${B.label} por ${brl(B.price)}?`)) return; err = SU.buyBarn(s, id); if (!err) { note(`suinocultura: compra de ${B.label}`, -B.price); msg = 'Barracão pronto. Aloje os leitões.'; } }
  if (a === 'house') { const n = Number($(`#su-n-${id}`).value), v = $(`#su-v-${id}`).checked, cost = SU.housing(s, n, v); err = SU.house(s, id, n, v); if (!err) { note(`suinocultura: ${n} leitões alojados`, -cost); msg = 'Leitões alojados. Venda por volta do 4º mês.'; } }
  if (a === 'sell') { const v = SU.sellLot(s, id); note('suinocultura: venda do lote', v); msg = `Lote vendido por ${brl(v)}.`; confetti(40); }
  if (a === 'sellbarn') { const r = SU.sellBarn(s, id); err = r.err; if (!err) { note('suinocultura: venda de barracão', r.value); msg = `Barracão vendido por ${brl(r.value)}.`; } }
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  say(msg); save(); G.render();
});
