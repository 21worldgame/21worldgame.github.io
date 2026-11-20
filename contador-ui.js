// Tela do contador: contratar (mensal, 1 mês, 3 meses, 1 ano), a previsão do próximo fechamento e o que foi cobrado
// em cada fechamento, separado por produção e por tipo de gasto. Também põe um resumo no topo de cada aba de produção.
import * as CT from './contador.js';
import * as L from './logic.js';
import * as W from './world.js';
import * as Live from './live.js';
import { G, $, esc, brl, say, save, note } from './store.js';

const TAB_GROUP = { gado: ['gado'], granja: ['granja'], suinos: ['suinos'], cana: ['cana'], laranja: ['laranja'], negocios: ['negocios'], haras: ['haras'], terras: ['terras'], banco: ['banco'] };
const pct = (x, t) => (t ? Math.round(x / t * 100) : 0);
const typeRows = (types, total) => Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(CT.TYPES[k] || k)}</span><b>${brl(v)}</b><i style="--w:${pct(v, total)}%"></i></li>`).join('');
const groupCard = G2 => `<article class="ct-g glass"><header><h4>${esc(G2.label)}</h4><b class="bad">${brl(G2.total)}</b></header>
  <ul class="ct-types">${typeRows(G2.types, G2.total)}</ul>
  <details><summary>${G2.lines.length} ${G2.lines.length === 1 ? 'lançamento' : 'lançamentos'}</summary><ul class="ct-lines">${G2.lines.map(l => `<li><span>${esc(l.txt)}</span><b>${brl(l.val)}</b></li>`).join('')}</ul></details></article>`;
const when = s => { try { const w = Live.world(), t = Live.now(); return W.fmt(W.msLeft(w, t)); } catch { return '…'; } };

export function render() {
  const el = $('#ct-body'); if (!el) return;
  const s = G.S, worth = L.netWorth(s), on = CT.active(s);
  if (!on) {
    el.innerHTML = `<div class="ct-hero glass"><div><h3>contador: planos</h3>
      <p>Ele mostra, mês a mês, exatamente quanto você gasta e com o quê: impostos, luz, água, funcionários, ração, insumos, manutenção, seguro, frete, parcelas do banco, separado por gado, granja, suínos, cana, laranja, empresas, mina e terras.</p>
      <p class="small muted">Cada fechamento do mês aparece uma única vez, com a hora em que foi cobrado e cada lançamento somado. O honorário é proporcional ao patrimônio: ${(CT.FEE.rate * 100).toFixed(2).replace('.', ',')}% ao mês (mínimo ${brl(CT.FEE.min)}). Quem é mais rico paga mais.</p></div></div>
      <div class="ct-plans">${Object.entries(CT.PLANS).map(([k, P]) => `<article class="ct-plan glass${k === 'm12' ? ' is-best' : ''}"><h4>${P.label}</h4><p class="ct-price">${brl(CT.quote(worth, k))}${P.months ? '' : '<small>/mês</small>'}</p>
        <p class="small muted">${esc(P.note)}${P.months > 1 ? ` · ${brl(Math.round(CT.quote(worth, k) / P.months))} por mês` : ''}</p><button class="btn ${k === 'm12' ? 'btn--gold' : 'btn--glass'}" data-ct="hire" data-id="${k}">contratar</button></article>`).join('')}</div>`;
    return;
  }
  const a = s.acct, fc = CT.summarize(G.ctForecast?.() || []), closes = s.closes || [];
  const head = `<div class="ct-head glass"><div><h3>relatório do contador</h3><p class="small">${a.plan === 'mensal' ? `plano mensal · próximo honorário ${brl(CT.nextMensal(s, worth))} (sobe ${Math.round(CT.FEE.rise * 100)}% a cada mês)` : `plano ${CT.PLANS[a.plan].label} pago (${brl(a.paid)}) · ${CT.monthsLeft(s)} ${CT.monthsLeft(s) === 1 ? 'mês restante' : 'meses restantes'}`}</p></div>
    <button class="btn btn--glass btn--sm" data-eq="fire" data-id="contador">demitir</button></div>`;
  const last = closes[0], ls = last && CT.summarize(last.lines);
  el.innerHTML = head + `<section class="ct-sec"><div class="ct-sec__h"><h3>previsão do próximo fechamento <small class="muted">em ${when(s)}</small></h3><span class="ct-total bad">${brl(fc.total)}</span></div>
      <p class="small muted">Contas fixas (funcionários, luz, água, aluguel, seguro, impostos, parcelas) são exatas; ração, frete e o que depende de preço do mercado podem variar um pouco.</p>
      <div class="ct-sum glass"><h4>por tipo de gasto</h4><ul class="ct-types">${typeRows(fc.types, fc.total)}</ul></div>
      <div class="ct-grid">${fc.groups.map(groupCard).join('') || '<p class="muted">Nenhum gasto previsto.</p>'}</div></section>
    <section class="ct-sec"><div class="ct-sec__h"><h3>último fechamento cobrado ${last ? `<small class="muted">${W.dateLabel(last.month)} · ${new Date(last.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · <span class="good">cobrado 1 vez</span></small>` : ''}</h3>${ls ? `<span class="ct-total bad">${brl(ls.total)}</span>` : ''}</div>
      ${ls ? `<p class="small">Entrou ${brl(ls.income)} e saiu ${brl(ls.total)}: saldo do mês <b class="${ls.income - ls.total >= 0 ? 'good' : 'bad'}">${brl(ls.income - ls.total)}</b>.</p>
        <div class="ct-sum glass"><h4>por tipo de gasto</h4><ul class="ct-types">${typeRows(ls.types, ls.total)}</ul></div><div class="ct-grid">${ls.groups.map(groupCard).join('')}</div>`
        : '<p class="muted">O primeiro fechamento com o contador aparece aqui quando o mês virar.</p>'}</section>
    ${closes.length > 1 ? `<section class="ct-sec"><h3>fechamentos anteriores</h3><table class="ct-hist"><thead><tr><th>mês</th><th>cobrado em</th><th class="num">entrou</th><th class="num">saiu</th><th class="num">saldo</th></tr></thead><tbody>${closes.map(c => { const x = CT.summarize(c.lines); return `<tr><td>${W.dateLabel(c.month)}</td><td>${new Date(c.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td class="num good">${brl(x.income)}</td><td class="num bad">${brl(x.total)}</td><td class="num">${brl(x.income - x.total)}</td></tr>`; }).join('')}</tbody></table>
      <p class="small muted">Um fechamento por mês do mundo, cada um cobrado uma única vez.</p></section>` : ''}`;
}

// resumo do contador no topo das abas de produção
export function inject(tab) {
  const groups = TAB_GROUP[tab], page = document.getElementById(`p-${tab}`); if (!groups || !page) return;
  let box = page.querySelector(':scope > .ct-box');
  if (!box) { box = document.createElement('div'); box.className = 'ct-box glass'; const h = page.querySelector(':scope > h2, :scope > .howto'); h ? h.after(box) : page.prepend(box); }
  if (!CT.active(G.S)) { box.innerHTML = `<span class="ct-box__t">contador</span><span class="small muted">Quer ver exatamente quanto esta produção gasta por mês (impostos, luz, água, funcionários...)?</span><button class="btn btn--glass btn--sm" data-tab-go="equipe">contratar contador</button>`; return; }
  const fc = CT.summarize(G.ctForecast?.() || []), gs = fc.groups.filter(g => groups.includes(g.key)), total = gs.reduce((t, g) => t + g.total, 0), types = {};
  for (const g of gs) for (const [k, v] of Object.entries(g.types)) types[k] = (types[k] || 0) + v;
  box.innerHTML = `<span class="ct-box__t">contador</span><span>próximo fechamento aqui: <b class="bad">${brl(total)}</b></span>
    <span class="ct-chips">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="ct-chip">${esc(CT.TYPES[k] || k)} <b>${brl(v)}</b></span>`).join('') || '<span class="small muted">sem gastos previstos</span>'}</span>
    <button class="btn btn--glass btn--sm" data-tab-go="equipe">ver tudo</button>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ct]'); if (!b) return;
  const s = G.S;
  if (b.dataset.ct === 'hire') {
    const k = b.dataset.id, P = CT.PLANS[k], price = CT.quote(L.netWorth(s), k);
    if (!confirm(P.months ? `Contratar o contador por ${P.label}, pagando ${brl(price)} agora?` : `Contratar o contador no plano mensal? Ele cobra ${brl(price)} no próximo fechamento e sobe ${Math.round(CT.FEE.rise * 100)}% a cada mês.`)) return;
    const r = CT.hire(s, k, L.netWorth(s)); if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
    if (r.price) note(`contador: contrato de ${P.label}`, -r.price);
    say('Contador contratado! Veja seus gastos separados por produção e por tipo.');
  }
  if (b.dataset.ct === 'cancel') { if (!confirm('Dispensar o contador?')) return; const err = CT.cancel(s); if (err) return say(err, true); say('Contador dispensado.'); }
  save(); G.render();
});
