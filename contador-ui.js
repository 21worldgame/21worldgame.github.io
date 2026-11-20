// Tela do contador: contratar (mensal, 1 mês, 3 meses, 1 ano), a previsão do próximo fechamento e o que foi cobrado
// em cada fechamento, separado por produção e por tipo de gasto. Também põe um resumo no topo de cada aba de produção.
import * as CT from './contador.js';
import * as L from './logic.js';
import * as W from './world.js';
import * as Live from './live.js';
import { G, $, esc, brl, say, save, note } from './store.js';
import { PRICES as GR_P } from './granja.js';
import { PRICES as SU_P } from './suinos.js';

// contador registra TUDO que entra e sai (para o lucro real), contratado ou não; na 1ª vez aproveita o livro-caixa
G.track = (s, txt, val) => { CT.backfill(s); CT.track(s, txt, val); };
const TAB_GROUP = { gado: ['gado', 'frigorifico'], granja: ['granja'], suinos: ['suinos'], cana: ['cana'], laranja: ['laranja'], negocios: ['negocios'], haras: ['haras'], terras: ['terras'], banco: ['banco'] };
const pct = (x, t) => (t ? Math.round(x / t * 100) : 0);
const typeRows = (types, total) => Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(CT.TYPES[k] || k)}</span><b>${brl(v)}</b><i style="--w:${pct(v, total)}%"></i></li>`).join('');
const groupCard = G2 => `<article class="ct-g glass"><header><h4>${esc(G2.label)}</h4><b class="bad">${brl(G2.total)}</b></header>
  <ul class="ct-types">${typeRows(G2.types, G2.total)}</ul>
  <details><summary>${G2.lines.length} ${G2.lines.length === 1 ? 'lançamento' : 'lançamentos'}</summary><ul class="ct-lines">${G2.lines.map(l => `<li><span>${esc(l.txt)}</span><b>${brl(l.val)}</b></li>`).join('')}</ul></details></article>`;
const stamp = at => new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const sumv = a => a.reduce((x, y) => x + y, 0), avg = a => sumv(a) / (a.length || 1);
const insList = x => (x.ins.length ? `<details class="ct-in"><summary>o que entrou: <b class="good">${brl(x.income)}</b> · ${x.ins.length} ${x.ins.length === 1 ? 'lançamento' : 'lançamentos'}</summary><ul class="ct-lines">${x.ins.map(l => `<li><span>${esc(l.txt)}</span><b class="good">${brl(l.val)}</b></li>`).join('')}</ul></details>` : '');
const closeBody = x => `<p class="small">Entrou ${brl(x.income)} e saiu ${brl(x.total)}: saldo do mês <b class="${x.income - x.total >= 0 ? 'good' : 'bad'}">${brl(x.income - x.total)}</b>.${x.groups[0] ? ` Quem mais gastou: <b>${esc(x.groups[0].label)}</b> (${pct(x.groups[0].total, x.total)}%).` : ''}</p>
  ${insList(x)}<div class="ct-sum glass"><h4>por tipo de gasto</h4><ul class="ct-types">${typeRows(x.types, x.total)}</ul></div><div class="ct-grid">${x.groups.map(groupCard).join('')}</div>`;
// mês do arquivo (só totais): tipos e produções em barras
const arcBody = a => `<div class="ct-arc"><div><h4>por tipo de gasto</h4><ul class="ct-types">${typeRows(a.types, a.total)}</ul></div>
  <div><h4>por produção</h4><ul class="ct-types">${Object.entries(a.groups).sort((x, y) => y[1] - x[1]).map(([k, v]) => `<li><span>${esc(CT.GROUP_LABEL[k] || k)}</span><b>${brl(v)}</b><i style="--w:${pct(v, a.total)}%"></i></li>`).join('')}</ul></div></div>`;
// indicadores do topo
function kpis(hist, fc) {
  const h = hist.slice(0, 12), t = h.map(a => a.total), last = h[0], prev = h[1], big = last && Object.entries(last.types).sort((a, b) => b[1] - a[1])[0];
  const d = last && prev && prev.total ? last.total / prev.total - 1 : null;
  const k = (lbl, val, sub = '', cls = '') => `<div class="ct-kpi glass"><span>${lbl}</span><b class="${cls}">${val}</b><small>${sub}</small></div>`;
  return `<div class="ct-kpis">${k('próximo fechamento', brl(fc.total), 'previsão', 'bad')}${k('último mês', last ? brl(last.total) : '—', last ? W.dateLabel(last.month) : 'ainda sem fechamento', 'bad')}
    ${k('média por mês', h.length ? brl(avg(t)) : '—', h.length ? `últimos ${h.length} ${h.length === 1 ? 'mês' : 'meses'}` : '')}
    ${k('vs mês anterior', d == null ? '—' : `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(Math.round(d * 100))}%`, d == null ? 'precisa de 2 fechamentos' : d > 0 ? 'gastou mais' : 'gastou menos', d == null ? '' : d > 0 ? 'bad' : 'good')}
    ${(() => { const s = G.S, m = s.month || 0, r = CT.results(s, m, m), r12 = CT.results(s, m - 11, m); return k('lucro real do mês', `${r.lucro >= 0 ? '' : '−'}${brl(Math.abs(r.lucro))}`, `12 meses: ${r12.lucro >= 0 ? '' : '−'}${brl(Math.abs(r12.lucro))}`, r.lucro >= 0 ? 'good' : 'bad'); })()}
    ${k('maior gasto', big ? esc(CT.TYPES[big[0]] || big[0]) : '—', big ? `${brl(big[1])} · ${pct(big[1], last.total)}% do mês` : '')}</div>`;
}
// tabela mês a mês (linhas por tipo de gasto ou por produção, uma coluna por mês)
let by = 'types';
const dl = d => (d == null ? '<td class="num muted">—</td>' : `<td class="num ${d > 0.005 ? 'bad' : d < -0.005 ? 'good' : 'muted'}">${d > 0.005 ? '▲' : d < -0.005 ? '▼' : '='} ${Math.abs(Math.round(d * 100))}%</td>`);
function monthly(hist) {
  const t = CT.monthTable(hist, by), n = t.months.length, last = t.totals[n - 1], prev = t.totals[n - 2];
  const head = `<tr><th>${by === 'types' ? 'tipo de gasto' : 'produção'}</th>${t.months.map(m => `<th class="num">${W.dateLabel(m)}</th>`).join('')}<th class="num">média</th><th class="num">vs anterior</th></tr>`;
  const rows = t.rows.map(r => `<tr><td>${esc(r.label)}</td>${r.vals.map(v => `<td class="num">${v ? brl(v) : '<span class="muted">—</span>'}</td>`).join('')}<td class="num">${brl(r.avg)}</td>${dl(r.delta)}</tr>`).join('');
  const foot = `<tr class="ct-mt__tot"><td>total de gastos</td>${t.totals.map(v => `<td class="num bad">${brl(v)}</td>`).join('')}<td class="num bad">${brl(avg(t.totals))}</td>${dl(n > 1 && prev ? last / prev - 1 : null)}</tr>
    <tr><td>entrou</td>${t.incomes.map(v => `<td class="num good">${brl(v)}</td>`).join('')}<td class="num good">${brl(avg(t.incomes))}</td><td></td></tr>
    <tr class="ct-mt__tot"><td>saldo</td>${t.incomes.map((v, i) => `<td class="num ${v - t.totals[i] >= 0 ? 'good' : 'bad'}">${brl(v - t.totals[i])}</td>`).join('')}<td class="num">${brl(avg(t.incomes) - avg(t.totals))}</td><td></td></tr>`;
  return `<section class="ct-sec"><div class="ct-sec__h"><h3>gastos mês a mês <small class="muted">últimos ${n} ${n === 1 ? 'mês' : 'meses'}</small></h3>
    <span class="ct-by" role="group" aria-label="agrupar por"><button class="btn btn--sm ${by === 'types' ? 'btn--gold' : 'btn--glass'}" data-ct="by" data-id="types" aria-pressed="${by === 'types'}">por tipo</button><button class="btn btn--sm ${by === 'groups' ? 'btn--gold' : 'btn--glass'}" data-ct="by" data-id="groups" aria-pressed="${by === 'groups'}">por produção</button></span></div>
    <p class="small muted">Cada coluna é um fechamento já cobrado. A última coluna compara o mês mais recente com o anterior: <span class="bad">▲ gastou mais</span>, <span class="good">▼ gastou menos</span>.</p>
    <div class="ct-mt glass"><table class="ct-hist"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div></section>`;
}
// arquivo: todos os meses guardados, separados por ano
function archive(s, hist) {
  if (hist.length < 2) return '';
  const full = Object.fromEntries((s.closes || []).map(c => [c.month, c])), years = {};
  for (const a of hist.slice(1)) (years[W.yearOf(a.month)] ??= []).push(a);
  return `<section class="ct-sec"><div class="ct-sec__h"><h3>arquivo mês a mês <small class="muted">toque num mês para ver o detalhe</small></h3><span class="small muted">guarda até ${CT.ARCHIVE} meses</span></div>
    ${Object.entries(years).sort((a, b) => b[0] - a[0]).map(([y, ms]) => `<div class="ct-year"><h4>ano ${y} <small class="muted">gastos ${brl(sumv(ms.map(a => a.total)))} · entrou ${brl(sumv(ms.map(a => a.income)))}</small></h4>
      ${ms.map(a => `<details class="ct-old glass"><summary><b>${W.dateLabel(a.month)}</b><span class="small muted">cobrado em ${stamp(a.at)}</span><span class="good">+${brl(a.income)}</span><span class="bad">−${brl(a.total)}</span><b class="${a.income - a.total >= 0 ? 'good' : 'bad'}">${brl(a.income - a.total)}</b></summary>${full[a.month] ? closeBody(CT.summarize(full[a.month].lines)) : arcBody(a)}</details>`).join('')}</div>`).join('')}
    <p class="small muted">Os últimos ${CT.KEEP} meses guardam cada lançamento; os mais antigos ficam com os totais por tipo e por produção.</p></section>`;
}
// lucro real: por produção, este mês / mês passado / 12 meses (entrou − saiu; compra e venda de bens à parte)
const money = v => `<b class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '' : '−'}${brl(Math.abs(v))}</b>`;
function profit(s) {
  const m = s.month || 0, a = CT.results(s, m, m), b = CT.results(s, m - 1, m - 1), c = CT.results(s, m - 11, m);
  const keys = c.rows.filter(r => r.in || r.out).map(r => r.key);
  if (!keys.length) return `<section class="ct-sec"><h3>lucro real</h3><p class="muted">Ainda não tem lançamentos. A partir de agora o contador soma tudo que entra e sai.</p></section>`;
  const cell = (R, k) => { const x = R.rows.find(r => r.key === k); return x && (x.in || x.out) ? `<td class="num" title="entrou ${brl(x.in)} · saiu ${brl(x.out)}">${money(x.lucro)}</td>` : '<td class="num muted">—</td>'; };
  const det = k => { const x = c.rows.find(r => r.key === k); return `<small class="muted">entrou ${brl(x.in)} · saiu ${brl(x.out)}</small>`; };
  return `<section class="ct-sec"><div class="ct-sec__h"><h3>lucro real <small class="muted">tudo que entrou menos tudo que saiu, por produção</small></h3></div>
    <div class="ct-mt glass"><table class="ct-hist"><thead><tr><th>produção</th><th class="num">este mês</th><th class="num">mês passado</th><th class="num">12 meses</th></tr></thead>
    <tbody>${keys.map(k => `<tr><td>${esc(CT.GROUP_LABEL[k] || k)}<br>${det(k)}</td>${cell(a, k)}${cell(b, k)}${cell(c, k)}</tr>`).join('')}</tbody>
    <tfoot><tr class="ct-mt__tot"><td>total</td><td class="num">${money(a.lucro)}</td><td class="num">${money(b.lucro)}</td><td class="num">${money(c.lucro)}</td></tr></tfoot></table></div>
    ${c.bem ? `<p class="small muted">Bens nos 12 meses (galpões, terras, carros, empresas): ${c.bem < 0 ? `investiu ${brl(-c.bem)}` : `vendeu ${brl(c.bem)}`}. Não entra no lucro porque virou patrimônio (ou saiu dele).</p>` : ''}</section>`;
}
let chat = [];
const ctx = () => ({ brl, forecast: CT.summarize(G.ctForecast?.() || []), prices: G.S.prices || {}, base: { ...GR_P, ...SU_P } });
function assistant() {
  return `<section class="ct-sec ct-ai glass"><div class="ct-sec__h"><h3>pergunte ao contador</h3><span class="small muted">responde com os seus números</span></div>
    <div class="ct-ai__log" id="ct-log" aria-live="polite">${chat.map(c => `<p class="ct-ai__q">${esc(c.q)}</p><div class="ct-ai__a">${c.a.map(l => `<p>${esc(l)}</p>`).join('')}</div>`).join('') || '<p class="muted small">Ex.: "qual meu lucro real?", "com a granja vazia eu pago alguma coisa?", "o que o frigorífico gasta?"</p>'}</div>
    <div class="ct-ai__chips">${CT.QUICK.map(q => `<button type="button" class="ct-chip" data-ct="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="row ct-ai__form" data-ct-form><input class="input" name="q" maxlength="160" autocomplete="off" placeholder="digite sua pergunta" aria-label="pergunta ao contador"><button class="btn btn--gold">perguntar</button></form></section>`;
}
function ask(q) {
  q = String(q || '').trim(); if (!q) return;
  chat = [...chat, { q, a: CT.answer(G.S, q, ctx()) }].slice(-6);
  render(); const log = $('#ct-log'); if (log) log.scrollTop = log.scrollHeight;
}
document.addEventListener('submit', e => { const f = e.target.closest('[data-ct-form]'); if (!f) return; e.preventDefault(); ask(f.q.value); });
const when = s => { try { const w = Live.world(), t = Live.now(); return W.fmt(W.msLeft(w, t)); } catch { return '…'; } };

export function render() {
  const el = $('#ct-body'); if (!el) return;
  const s = G.S, worth = L.netWorth(s), on = CT.active(s);
  CT.backfill(s);
  if (!on) {
    el.innerHTML = `<div class="ct-hero glass"><div><h3>contador: planos</h3>
      <p>Ele mostra o seu <b>lucro real</b> (tudo que entra menos tudo que sai) por produção, responde suas perguntas com os seus números e mostra, mês a mês, exatamente quanto você gasta e com o quê: impostos, luz, água, funcionários, ração, insumos, manutenção, seguro, frete, parcelas do banco, separado por gado, granja, suínos, cana, laranja, empresas, mina e terras.</p>
      <p class="small muted">Cada fechamento do mês aparece uma única vez, com a hora em que foi cobrado e cada lançamento somado. O honorário é proporcional ao patrimônio: ${(CT.FEE.rate * 100).toFixed(2).replace('.', ',')}% ao mês (mínimo ${brl(CT.FEE.min)}). Quem é mais rico paga mais.</p></div></div>
      <div class="ct-plans">${Object.entries(CT.PLANS).map(([k, P]) => `<article class="ct-plan glass${k === 'm12' ? ' is-best' : ''}"><h4>${P.label}</h4><p class="ct-price">${brl(CT.quote(worth, k))}${P.months ? '' : '<small>/mês</small>'}</p>
        <p class="small muted">${esc(P.note)}${P.months > 1 ? ` · ${brl(Math.round(CT.quote(worth, k) / P.months))} por mês` : ''}</p><button class="btn ${k === 'm12' ? 'btn--gold' : 'btn--glass'}" data-ct="hire" data-id="${k}">contratar</button></article>`).join('')}</div>`;
    return;
  }
  const a = s.acct, fc = CT.summarize(G.ctForecast?.() || []), closes = s.closes || [];
  const head = `<div class="ct-head glass"><div><h3>relatório do contador</h3><p class="small">${a.plan === 'mensal' ? `plano mensal · próximo honorário ${brl(CT.nextMensal(s, worth))} (sobe ${Math.round(CT.FEE.rise * 100)}% a cada mês)` : `plano ${CT.PLANS[a.plan].label} pago (${brl(a.paid)}) · ${CT.monthsLeft(s)} ${CT.monthsLeft(s) === 1 ? 'mês restante' : 'meses restantes'}`}</p></div>
    <button class="btn btn--glass btn--sm" data-eq="fire" data-id="contador">demitir</button></div>`;
  const last = closes[0], ls = last && CT.summarize(last.lines);
  const hist = CT.history(s);
  el.innerHTML = head + kpis(hist, fc) + assistant() + profit(s) + `<section class="ct-sec"><div class="ct-sec__h"><h3>previsão do próximo fechamento <small class="muted">em ${when(s)}</small></h3><span class="ct-total bad">${brl(fc.total)}</span></div>
      <p class="small muted">Contas fixas (funcionários, luz, água, aluguel, seguro, impostos, parcelas) são exatas; ração, frete e o que depende de preço do mercado podem variar um pouco.</p>
      <div class="ct-sum glass"><h4>por tipo de gasto</h4><ul class="ct-types">${typeRows(fc.types, fc.total)}</ul></div>
      <div class="ct-grid">${fc.groups.map(groupCard).join('') || '<p class="muted">Nenhum gasto previsto.</p>'}</div></section>
    <section class="ct-sec"><div class="ct-sec__h"><h3>último fechamento cobrado ${last ? `<small class="muted">${W.dateLabel(last.month)} · ${stamp(last.at)} · <span class="good">cobrado 1 vez</span></small>` : ''}</h3>${ls ? `<span class="ct-total bad">${brl(ls.total)}</span>` : ''}</div>
      ${ls ? closeBody(ls)
        : '<p class="muted">O primeiro fechamento com o contador aparece aqui quando o mês virar.</p>'}</section>
    ${hist.length ? monthly(hist) : ''}
    ${archive(s, hist)}`;
}

// resumo do contador no topo das abas de produção
export function inject(tab) {
  const groups = TAB_GROUP[tab], page = document.getElementById(`p-${tab}`); if (!groups || !page) return;
  let box = page.querySelector(':scope > .ct-box');
  if (!box) { box = document.createElement('div'); box.className = 'ct-box glass'; const h = page.querySelector(':scope > h2, :scope > .howto'); h ? h.after(box) : page.prepend(box); }
  if (!CT.active(G.S)) { box.innerHTML = `<span class="ct-box__t">contador</span><span class="small muted">Quer ver exatamente quanto esta produção gasta por mês (impostos, luz, água, funcionários...)?</span><button class="btn btn--glass btn--sm" data-tab-go="equipe">contratar contador</button>`; return; }
  const fc = CT.summarize(G.ctForecast?.() || []), gs = fc.groups.filter(g => groups.includes(g.key)), total = gs.reduce((t, g) => t + g.total, 0), types = {};
  for (const g of gs) for (const [k, v] of Object.entries(g.types)) types[k] = (types[k] || 0) + v;
  const m = G.S.month || 0, R = CT.results(G.S, m - 11, m).rows.filter(r => groups.includes(r.key)), luc = R.reduce((t, r) => t + r.lucro, 0);
  box.innerHTML = `<span class="ct-box__t">contador</span><span>próximo fechamento aqui: <b class="bad">${brl(total)}</b>${R.length ? ` · lucro real 12 meses: ${money(luc)}` : ''}</span>
    <span class="ct-chips">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="ct-chip">${esc(CT.TYPES[k] || k)} <b>${brl(v)}</b></span>`).join('') || '<span class="small muted">sem gastos previstos</span>'}</span>
    <button class="btn btn--glass btn--sm" data-tab-go="equipe">ver tudo</button>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ct]'); if (!b) return;
  if (b.dataset.ct === 'by') { by = b.dataset.id; return render(); }
  if (b.dataset.ct === 'ask') return ask(b.dataset.q);
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
