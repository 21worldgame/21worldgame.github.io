// Telas dos negócios: aba "negócios" (administrar) e as vitrines da loja (marcas e galpões à venda).
import * as NG from './negocios.js';
import { G, $, esc, brl, int, say, save, note, confetti } from './store.js';

const CATS = { banks: { label: 'bancos', list: NG.BANKS, icon: '🏦' }, isps: { label: 'provedores de internet', list: NG.ISPS, icon: '📡' }, markets: { label: 'supermercados', list: NG.MARKETS, icon: '🛒' } };
const logo = (c, txt) => `<span class="biz-logo" style="--c:${c.color}">${esc(txt.split(' ').map(w => w[0]).join('').slice(0, 3))}</span>`;

// ---------- loja: marcas à venda ----------
export function shopHTML() {
  const s = G.S; NG.ensure(s);
  const block = (cat, desc) => `<h3>${CATS[cat].icon} ${CATS[cat].label}</h3><p class="muted small">${desc}</p><div class="biz-grid">${Object.entries(CATS[cat].list).map(([id, c]) => {
    const own = s.biz[cat].some(b => b.brand === id);
    const extra = cat === 'banks' ? `${c.staff} funcionários · ${int(c.req)} pedidos de empréstimo por mês` : cat === 'isps' ? `cidade com ${int(c.homes)} casas` : `~${int(c.clients)} clientes por mês · ${c.staff} funcionários`;
    return `<article class="shopcard${own ? ' is-own' : ''}"><div class="shopcard__photo" style="--img:url(assets/biz/${id}.webp);--c:${c.color}">${logo(c, c.name)}${own ? '<span class="shopcard__badge shopcard__badge--gold">é sua</span>' : ''}</div>
      <div class="shopcard__body"><h4>${esc(c.name)}</h4><p class="small muted">${extra}</p><div class="shopcard__buy"><span class="shopcard__price">${brl(c.price)}</span>${own ? '' : `<button class="btn btn--gold" data-biz="buy" data-cat="${cat}" data-id="${id}">comprar a marca</button>`}</div></div></article>`; }).join('')}</div>`;
  return block('banks', 'Você compra só a marca: o caixa para emprestar sai do seu bolso, e a folha e as despesas também. Os clientes pedem empréstimos pequenos, que crescem devagar com o tempo.')
    + block('isps', 'Construa a rede de fibra (caro), escolha a mensalidade (barata) e veja os assinantes entrando. Lucro mensal pequeno, valorização no longo prazo.')
    + block('markets', 'Clientes, ticket médio, mercadoria, perdas, funcionários e aluguel: preço baixo atrai gente, preço alto espanta.');
}
export function whHTML() {
  const s = G.S; NG.ensure(s);
  const used = NG.tons(s), cap = NG.capacity(s);
  return `<div class="glass wh-bar"><div><b>armazém: ${int(used)} t de ${int(cap)} t</b><span class="bar"><i style="transform:scaleX(${Math.min(1, used / cap).toFixed(3)})"></i></span></div>
    <p class="small muted">Grátis: ${NG.FREE_TONS} t${s.biz.legacy ? ` + ${int(s.biz.legacy)} t do seu depósito antigo` : ''}. Colheita ou compra além do espaço é vendida na hora com 15% de desconto. Os galpões ficam mais caros conforme o mundo avança.</p></div>
    <div class="biz-grid">${Object.entries(NG.WAREHOUSES).map(([id, w]) => `<article class="shopcard"><div class="shopcard__photo" style="--img:url(assets/wh-${id}.webp)"><span class="shopcard__badge">${int(w.cap)} toneladas</span></div>
      <div class="shopcard__body"><h4>${w.label}</h4><p class="small muted">guarda ~${int(w.cap * 1000 / 60)} sacas · manutenção ${brl(NG.whPrice(id, s.month) * NG.WH_UPKEEP)}/mês · o preço sobe com o tempo</p>
      <div class="shopcard__buy"><span class="shopcard__price">${brl(NG.whPrice(id, s.month))}</span><button class="btn btn--gold" data-biz="buywh" data-id="${id}">comprar galpão</button></div></div></article>`).join('')}</div>
    ${s.biz.wh.length ? `<h4>seus galpões</h4><ul class="biz-list">${s.biz.wh.map(w => `<li><span>${NG.WAREHOUSES[w.type].label}</span><b>${brl(w.value)}</b><button class="btn btn--glass btn--sm" data-biz="sellwh" data-id="${w.id}">vender (${brl(w.value * 0.8)})</button></li>`).join('')}</ul>` : ''}`;
}

// ---------- aba negócios ----------
export function render() {
  const el = $('#neg-list'); if (!el) return;
  const s = G.S; NG.ensure(s); const m = s.month || 1;
  const own = ['banks', 'isps', 'markets'].reduce((t, c) => t + s.biz[c].length, 0);
  $('#neg-stats').innerHTML = [['negócios', own], ['valem hoje', brl(NG.value(s))], ['armazém', `${int(NG.tons(s))} / ${int(NG.capacity(s))} t`], ['galpões', s.biz.wh.length]]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  const cards = [];
  for (const b of s.biz.banks) {
    const C = NG.BANKS[b.brand], book = b.loans.reduce((t, l) => t + l.bal, 0), P = NG.POLICY[b.policy];
    cards.push(`<article class="glass biz-own"><span class="biz-own__ph" style="--img:url(assets/biz/${b.brand}.webp)">${logo(C, C.name)}</span><div class="biz-own__b"><h4>${esc(C.name)} <small class="muted">banco</small></h4>
      <div class="biz-kpis"><span><small>caixa para emprestar</small><b>${brl(b.capital)}</b></span><span><small>emprestado na rua</small><b>${brl(book)}</b></span><span><small>juros</small><b>${(P.rate * 100).toFixed(1)}% ao mês</b></span><span><small>despesa mensal</small><b class="bad">${brl(C.staff * NG.SALARY + C.price * NG.BANK_FIXED)}</b></span><span><small>valor de venda</small><b>${brl(NG.saleValue(s, 'banks', b))}</b></span></div>
      <div class="row"><label class="field"><span>política</span><select class="input" data-biz-policy="${b.id}">${Object.entries(NG.POLICY).map(([k, p]) => `<option value="${k}" ${b.policy === k ? 'selected' : ''}>${p.label}: ${(p.rate * 100).toFixed(1)}%/mês, calote ${(p.bad * 100).toFixed(1)}%</option>`).join('')}</select></label>
        <label class="field"><span>valor</span><input class="input input--s" id="bk-${b.id}" type="number" min="1000" step="10000" value="500000" inputmode="numeric"></label>
        <button class="btn btn--gold btn--sm" data-biz="dep" data-id="${b.id}">colocar no caixa</button><button class="btn btn--glass btn--sm" data-biz="wd" data-id="${b.id}">tirar do caixa</button>
        <button class="btn btn--glass btn--sm" data-biz="sell" data-cat="banks" data-id="${b.id}">vender banco</button></div>
      <p class="small muted">${b.capital < NG.BANKS[b.brand].avg * 3 ? '<b class="bad">Caixa baixo: os pedidos de empréstimo estão sendo recusados.</b> ' : ''}Os juros e as parcelas voltam para o caixa do banco; tire quando quiser.</p></div></article>`);
  }
  for (const b of s.biz.isps) {
    const C = NG.ISPS[b.brand], fill = b.ports ? b.subs / b.ports : 0;
    cards.push(`<article class="glass biz-own"><span class="biz-own__ph" style="--img:url(assets/biz/${b.brand}.webp)">${logo(C, C.name)}</span><div class="biz-own__b"><h4>${esc(C.name)} <small class="muted">provedor</small></h4>
      <div class="biz-kpis"><span><small>assinantes</small><b>${int(b.subs)}</b></span><span><small>portas de fibra</small><b>${int(b.ports)} / ${int(C.homes)}</b></span><span><small>ocupação</small><b>${Math.round(fill * 100)}%</b></span><span><small>investido na rede</small><b>${brl(b.net)}</b></span><span><small>valor de venda</small><b>${brl(NG.saleValue(s, 'isps', b))}</b></span></div>
      <div class="row"><label class="field"><span>mensalidade</span><select class="input" data-biz-plan="${b.id}">${Object.keys(NG.PLANS).map(p => `<option value="${p}" ${b.plan === +p ? 'selected' : ''}>R$ ${p} ${p === '49' ? '(atrai mais, cancela menos)' : p === '89' ? '(atrai menos)' : ''}</option>`).join('')}</select></label>
        <button class="btn btn--gold btn--sm" data-biz="build" data-id="${b.id}" data-n="1">construir ${NG.PORT_PACK} portas (${brl(NG.PORT_PACK * NG.PORT_COST)})</button><button class="btn btn--glass btn--sm" data-biz="build" data-id="${b.id}" data-n="4">+${NG.PORT_PACK * 4} (${brl(NG.PORT_PACK * 4 * NG.PORT_COST)})</button>
        <button class="btn btn--glass btn--sm" data-biz="sell" data-cat="isps" data-id="${b.id}">vender provedor</button></div>
      <p class="small muted">${!b.ports ? '<b class="bad">Sem rede ainda: construa portas para ter assinantes.</b> ' : fill > 0.9 ? '<b class="good">Rede quase cheia: construa mais portas.</b> ' : ''}Cada assinante paga a mensalidade (menos 20% de impostos); você paga link, suporte, técnicos e manutenção da rede.</p></div></article>`);
  }
  for (const b of s.biz.markets) {
    const C = NG.MARKETS[b.brand];
    cards.push(`<article class="glass biz-own"><span class="biz-own__ph" style="--img:url(assets/biz/${b.brand}.webp)">${logo(C, C.name)}</span><div class="biz-own__b"><h4>${esc(C.name)} <small class="muted">supermercado</small></h4>
      <div class="biz-kpis"><span><small>reputação</small><b>${Math.round(b.rep * 100)}%</b></span><span><small>clientes por mês</small><b>${int(C.clients * b.rep)}</b></span><span><small>funcionários</small><b>${C.staff}</b></span><span><small>valor de venda</small><b>${brl(NG.saleValue(s, 'markets', b))}</b></span></div>
      <div class="row"><label class="field"><span>preços</span><select class="input" data-biz-markup="${b.id}">${Object.entries(NG.MARKUP).map(([k, x]) => `<option value="${k}" ${b.markup === +k ? 'selected' : ''}>${x.label} (margem ${k}%)</option>`).join('')}</select></label>
        <button class="btn btn--glass btn--sm" data-biz="sell" data-cat="markets" data-id="${b.id}">vender mercado</button></div></div></article>`);
  }
  el.innerHTML = (G.mineOwnCard?.() || '') + cards.join('') || '<p class="empty glass">Você ainda não tem negócios. Compre a marca de um banco, provedor ou supermercado na loja (categoria empresas). <button class="btn btn--gold btn--sm" data-loja-go="empresas">ir para a loja</button></p>';
  $('#neg-wh').innerHTML = whHTML();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-biz]'); if (!b) return;
  const s = G.S, a = b.dataset.biz, id = b.dataset.id; let err = null, msg = '';
  if (a === 'buy') { const C = CATS[b.dataset.cat].list[id]; if (!confirm(`Comprar a marca ${C.name} por ${brl(C.price)}? Os custos de todo mês saem do seu bolso.`)) return; err = NG.buy(s, b.dataset.cat, id); if (!err) { note(`compra da marca ${C.name}`, -C.price); msg = `${C.name} agora é sua! Administre na aba negócios.`; confetti(60); } }
  if (a === 'buywh') { const p = NG.whPrice(id, s.month); if (!confirm(`Comprar ${NG.WAREHOUSES[id].label} por ${brl(p)}?`)) return; err = NG.buyWh(s, id); if (!err) { note(`compra de ${NG.WAREHOUSES[id].label}`, -p); msg = 'Galpão pronto: mais espaço no armazém.'; } }
  if (a === 'sellwh') { const v = NG.sellWh(s, id); if (v === -1) err = 'o estoque não cabe sem esse galpão: venda parte do estoque antes.'; else if (v) { note('venda de galpão', v); msg = `Galpão vendido por ${brl(v)}.`; } }
  if (a === 'dep' || a === 'wd') { const v = Number($(`#bk-${id}`).value); err = a === 'dep' ? NG.deposit(s, id, v) : NG.withdraw(s, id, v); if (!err) { note(a === 'dep' ? 'banco: dinheiro colocado no caixa' : 'banco: dinheiro tirado do caixa', a === 'dep' ? -v : v); msg = 'Feito.'; } }
  if (a === 'build') { const n = Number(b.dataset.n), before = s.money; err = NG.build(s, id, n); if (!err) { note('provedor: construção de rede de fibra', s.money - before); msg = 'Rede ampliada: novos assinantes chegam nos próximos meses.'; } }
  if (a === 'sell') { const x = NG.find(s, b.dataset.cat, id); if (!x || !confirm(`Vender por ${brl(NG.saleValue(s, b.dataset.cat, x))}?`)) return; const r = NG.sell(s, b.dataset.cat, id); err = r.err; if (!err) { note('venda de negócio', r.value); msg = `Vendido por ${brl(r.value)}.`; } }
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  if (msg) say(msg); save(); G.render();
});
document.addEventListener('change', e => {
  const t = e.target, s = G.S;
  if (t.dataset.bizPolicy) { const b = NG.find(s, 'banks', t.dataset.bizPolicy); if (b) b.policy = t.value; }
  else if (t.dataset.bizPlan) { const b = NG.find(s, 'isps', t.dataset.bizPlan); if (b) b.plan = Number(t.value); }
  else if (t.dataset.bizMarkup) { const b = NG.find(s, 'markets', t.dataset.bizMarkup); if (b) b.markup = Number(t.value); }
  else return;
  save(); say('Ajuste salvo: vale a partir do próximo mês.');
});
