// Negociação do inventário, parte de parcerias e dinheiro (regras em amigos.js), + agiota automático na aba banco.
// Abas da janela de troca: 1 troca (trade-ui.js) · 2 parceria (rentHTML) · 3 dinheiro (cashHTML). Topo: os dois lados (sideHTML).
import * as AM from './amigos.js';
import * as L from './logic.js';
import * as NG from './negocios.js';
import * as NPC from './npcs.js';
import { avatarSVG } from './avatar.js';
import { G, $, esc, brl, int, say, save, note, profileOf } from './store.js';

const pct = v => `${(v * 100).toFixed(1).replace('.', ',')}%`;
export const confTag = c => `<span class="tag ${c >= 60 ? 'tag--green' : c >= 30 ? 'tag--gold' : 'tag--red'}" title="confiança da parceria: sobe todo mês e com conta paga, cai com calote">confiança ${Math.round(c)}</span>`;
export const partnerBox = (s, nick, peer) => `<label class="am-chk"><input type="checkbox" data-partner="${esc(nick)}"${peer ? ` data-peer="${esc(JSON.stringify({ look: peer.look || {}, worth: peer.worth || 0 }))}"` : ''} ${AM.isFriend(s, nick) ? 'checked' : ''}><span>parceiro</span></label>`;
const btn = (am, id, txt, gold) => `<button class="btn ${gold ? 'btn--gold' : 'btn--glass'} btn--sm" type="button" data-am="${am}" data-id="${esc(String(id))}">${txt}</button>`;
const row = (title, sub, b = '') => `<li><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${b}</li>`;
const WH = t => NG.WAREHOUSES[t]?.label || 'galpão';
const help = (title, lines) => `<details class="tr-help"><summary>${title}</summary><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></details>`;
const stat = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;

// ---------- topo: você ⇄ ele ----------
export function sideMe() {
  const s = G.S, p = profileOf(s), own = s.lands.filter(l => l.own), free = AM.idleLands(s).length;
  const tools = (s.cars || []).filter(c => AM.TOOLS.includes(L.CARS[c.model]?.type)).length + AM.ensure(s).tools.length;
  const space = Math.max(0, NG.capacity(s) - NG.tons(s));
  return `<span class="tr-side__av">${avatarSVG(p.look || {}, { label: p.name })}</span>
    <div class="tr-side__id"><small>você</small><b>${esc(p.name)}</b><small>nível ${p.level || 1}</small></div>
    <dl class="tr-side__st">${stat('carteira', `<span class="good">${brl(s.money)}</span>`)}${stat('fichas', int(s.chips))}
      ${stat('terras', own.length ? `${own.length} · ${int(own.reduce((t, l) => t + l.ha, 0))} ha${free ? ` · ${free} parada${free > 1 ? 's' : ''}` : ''}` : '—')}
      ${stat('galpão livre', `${int(space)} t`)}${stat('máquinas', tools || '—')}${stat('gado', L.heads(s) ? `${int(L.heads(s))} cab.` : '—')}${stat('patrimônio', brl(L.netWorth(s)))}</dl>`;
}
export function sideBot(nick) {
  const s = G.S, n = NPC.byNick(nick); if (!n) return '';
  const p = NPC.profile(n, s.month || 1), f = AM.friend(s, nick), owes = s.lent.filter(x => x.nick === nick).reduce((t, x) => t + x.bal, 0), debt = s.loans.find(l => l.from === nick);
  return `<span class="tr-side__av">${avatarSVG(n.look || {}, { label: nick })}</span>
    <div class="tr-side__id"><small>jogador do mundo</small><b>${esc(nick)}</b><small>nível ${p.level} · ${esc(p.rank)}</small>${partnerBox(s, nick)}${f ? confTag(f.conf) : ''}</div>
    <dl class="tr-side__st">${stat('patrimônio', `~${brl(p.worth)}`)}${stat('terras', `${p.lands} · ${int(p.ha)} ha`)}${stat('gado', `${int(p.heads)} cab.`)}
      ${f ? stat('tem para você', `${AM.offersFrom(s, nick).length} oferta(s) este mês`) : ''}${owes ? stat('te deve', `<span class="good">${brl(owes)}</span>`) : ''}${debt ? stat('você deve', `<span class="bad">${brl(debt.bal)}</span>`) : ''}</dl>`;
}
export function sidePeer(p) {
  const s = G.S, f = p?.name && AM.friend(s, p.name);
  return `<span class="tr-side__av">${avatarSVG(p?.look || {}, { label: p?.name || '' })}</span>
    <div class="tr-side__id"><small>jogador de verdade, online</small><b>${esc(p?.name || 'jogador')}</b><small>nível ${p?.level || 1}${p?.rank ? ` · ${esc(p.rank)}` : ''}</small>${p?.name ? partnerBox(s, p.name, p) : ''}${f ? confTag(f.conf) : ''}</div>
    <dl class="tr-side__st">${p?.worth ? stat('patrimônio', brl(p.worth)) : ''}${p?.lands != null ? stat('terras', `${p.lands} · ${int(p.ha || 0)} ha`) : ''}${p?.heads ? stat('gado', `${int(p.heads)} cab.`) : ''}</dl>`;
}

// ---------- aba 2: parceria (aluguel) ----------
export function rentHTML(nick) {
  const s = G.S, f = AM.friend(s, nick);
  const intro = help('como funciona a parceria', [
    'Parceria é <b>aluguel por mês</b>: nada muda de dono. Quem usa paga todo mês, na virada do mês do mundo, sozinho.',
    `Você pode <b>usar o que é dele</b> (terra, espaço de galpão, trator, caminhão) mais barato do que no mercado.`,
    `E <b>ganhar com o que está parado com você</b>: ele paga para usar sua terra livre, seu galpão vazio ou sua máquina.`,
    'Dá para devolver ou pegar de volta quando quiser. Cada mês pago em dia aumenta a confiança.',
  ]);
  if (!f) return `${intro}<div class="tr-empty glass"><b>Marque ${esc(nick)} como parceiro</b><p>A caixinha <b>parceiro</b> fica no cartão dele, lá em cima. Sem parceria não dá para alugar nada entre vocês.</p>${partnerBox(s, nick)}</div>`;
  const theirs = AM.offersFrom(s, nick).map(o => o.kind === 'land'
    ? row(`terra de ${o.land.ha} ha · ${esc(o.land.region)}`, `pasto para ${L.landCap(o.land)} bois ou lavoura · <span class="good">${brl(o.land.value * o.rate)}/mês</span> · no mercado: ${brl(o.land.value * L.RENT_PAY)}/mês`, btn('take', o.id, 'arrendar', true))
    : o.kind === 'wh' ? row(`espaço de galpão: ${int(NG.WAREHOUSES[o.type].cap)} t`, `guarda sua safra sem comprar galpão (${esc(WH(o.type))}) · <span class="good">${brl(o.rent)}/mês</span>`, btn('take', o.id, 'alugar', true))
    : row(`${o.type === 'trator' ? 'trator' : 'caminhão'} emprestado: ${esc(L.CARS[o.model].name)}`, `${esc(L.CARS[o.model].perk || '')} · <span class="good">${brl(o.fee)}/mês</span> · comprar custa ${brl(L.CARS[o.model].price)}`, btn('take', o.id, 'pegar', true)));
  const mine = [
    ...AM.idleLands(s).map(l => row(`sua terra parada: ${l.ha} ha · ${esc(l.region)}`, `ele paga <span class="good">${brl(l.value * L.RENT_FRIEND)}/mês</span> · quem é de fora pagaria ${brl(l.value * L.RENT_GET)}`, btn('lease', l.id, 'arrendar para ele'))),
    ...AM.idleWh(s).map(w => row(`seu ${esc(WH(w.type))} vazio`, `ele paga <span class="good">${brl(w.value * AM.WH_LEND)}/mês</span> · o espaço fica com ele`, btn('lendwh', w.id, 'alugar para ele'))),
    ...AM.idleTools(s).map(c => row(`seu ${esc(L.CARS[c.model].name)}`, `ele paga <span class="good">${brl(L.CARS[c.model].price * AM.TOOL_RENT * 0.8)}/mês</span> · enquanto estiver com ele, a vantagem da máquina é dele`, btn('lendtool', c.id, 'emprestar'))),
  ];
  const using = [
    ...s.lands.filter(l => l.friend === nick).map(l => row(`terra dele: ${l.ha} ha · ${esc(l.region)}`, `você paga ${brl(L.rentNow(l))}/mês · para devolver, use a aba terras`)),
    ...(s.biz?.whRent || []).filter(w => w.friend === nick).map(w => row(`galpão dele: ${int(NG.WAREHOUSES[w.type].cap)} t`, `você paga ${brl(w.rent)}/mês`, btn('retwh', w.id, 'devolver'))),
    ...AM.ensure(s).tools.filter(t => t.friend === nick).map(t => row(`máquina dele: ${esc(L.CARS[t.model]?.name || t.type)}`, `você paga ${brl(t.fee)}/mês`, btn('rettool', t.id, 'devolver'))),
    ...s.lands.filter(l => l.leaseTo === nick).map(l => row(`sua terra com ele: ${l.ha} ha · ${esc(l.region)}`, `ele paga ${brl(l.value * L.RENT_FRIEND)}/mês`, `<button class="btn btn--glass btn--sm" type="button" data-act="lease" data-id="${l.id}">pegar de volta</button>`)),
    ...(s.biz?.wh || []).filter(w => w.lentTo === nick).map(w => row(`seu ${esc(WH(w.type))} com ele`, `ele paga ${brl(w.value * AM.WH_LEND)}/mês`, btn('lendwh', w.id, 'pegar de volta'))),
    ...(s.cars || []).filter(c => c.lentTo === nick).map(c => row(`seu ${esc(L.CARS[c.model]?.name || 'carro')} com ele`, `ele paga ${brl(L.CARS[c.model].price * AM.TOOL_RENT * 0.8)}/mês`, btn('lendtool', c.id, 'pegar de volta'))),
  ];
  return `${intro}<div class="tr-cols">
    <div class="glass tr-col"><h3>o que é seu e está parado</h3><p class="tr-sub">alugue para ${esc(nick)} e receba todo mês</p><ul class="am-list">${mine.join('') || '<li class="muted small">Nada parado agora. Terra livre (sem lavoura e sem boi), galpão vazio, trator e caminhão aparecem aqui.</li>'}</ul></div>
    <div class="glass tr-col tr-col--them"><h3>o que ${esc(nick)} tem para você</h3><p class="tr-sub">muda todo mês do mundo</p><ul class="am-list">${theirs.join('') || `<li class="muted small">${AM.isPeer(s, nick) ? 'Quando ele oferecer terra, galpão ou máquina, o pedido aparece na sua tela para você aceitar ou recusar.' : 'Nada parado com ele este mês.'}</li>`}</ul></div></div>
    ${using.length ? `<h4 class="tr-h">em andamento entre vocês</h4><ul class="am-list">${using.join('')}</ul>` : ''}`;
}

// ---------- aba 3: dinheiro (empréstimo) ----------
const preview = (amt, rate, months) => { const p = AM.schedule(amt, rate, months); return `parcela ≈ <b>${brl(p.first)}</b>/mês por ${months} meses · total ≈ <b>${brl(p.total)}</b> · juros ${brl(p.profit)}`; };
export function cashHTML(nick) {
  const s = G.S, f = AM.friend(s, nick), cap = AM.lendCap(s, nick), owe = s.loans.find(l => l.from === nick), his = s.lent.filter(p => p.nick === nick);
  const intro = help('como funciona o empréstimo', [
    `<b>Débito automático:</b> a parcela sai sozinha da conta dele todo mês. É o jeito mais seguro: o risco de calote cai 70%.`,
    `<b>Na confiança:</b> ele paga por conta própria, sem garantia. Arrisca mais, mas ele topa um juro até 2 pontos maior.`,
    `As parcelas entram na sua carteira na virada do mês. Se ele der calote, você perde o que faltava receber.`,
    `${f ? 'Como vocês são parceiros, ele aceita juro de amigo e quase não dá calote.' : 'Sem parceria, ele só pega a juro de agiota (a partir de ${Math.round(AM.AGIOTA_MIN * 100)}% ao mês) e o risco é maior.'}`,
  ]);
  const amt = Math.min(cap, 50000), rate = f ? 0.025 : 0.06;
  const lend = `<form class="glass tr-col am-loan" data-loan="lend">
      <h3>emprestar para ${esc(nick)}</h3><p class="tr-sub">você tem ${brl(s.money)} na carteira · ele precisa de até ${brl(cap)}</p>
      <div class="am-modes" role="radiogroup" aria-label="forma de pagamento">${Object.entries(AM.MODES).map(([k, m]) => `<label class="am-mode"><input type="radio" name="am-mode" value="${k}" ${k === 'auto' ? 'checked' : ''}><span><b>${m.label}</b><small>${k === 'auto' ? 'parcela cai sozinha, risco menor' : 'sem garantia, juro maior'}</small></span></label>`).join('')}</div>
      <div class="am-grid"><label class="field"><span>valor (R$)</span><input class="input" id="am-amt" type="number" min="1000" step="1000" max="${cap}" value="${amt}" inputmode="numeric"></label>
        <label class="field"><span>juros ao mês</span><select class="input" id="am-rate">${AM.LEND_RATES.map(r => `<option value="${r}" ${r === rate ? 'selected' : ''}>${pct(r)}</option>`).join('')}</select></label>
        <label class="field"><span>prazo</span><select class="input" id="am-months">${[3, 6, 9, 12].map(m => `<option value="${m}" ${m === 6 ? 'selected' : ''}>${m} meses</option>`).join('')}</select></label></div>
      <p class="am-prev" id="am-prev">${preview(amt, rate, 6)}</p>
      <p class="tr-sub" id="am-risk">${esc(nick)} aceita até <b>${pct(AM.lendMaxRate(s, nick, 'auto'))}</b> ao mês · risco de calote ${pct(AM.lendRisk(s, nick, 'auto'))} ao mês</p>
      ${his.length ? `<p class="small">Ele ainda está pagando o empréstimo anterior: só dá para emprestar de novo quando terminar.</p>` : btn('lendto', nick, 'emprestar agora', true)}</form>`;
  const borrow = !f ? `<div class="glass tr-col tr-col--them"><h3>pedir emprestado a ${esc(nick)}</h3><p class="tr-sub">só entre parceiros: marque a caixinha <b>parceiro</b> no cartão dele.</p>${partnerBox(s, nick)}</div>`
    : owe ? `<div class="glass tr-col tr-col--them"><h3>pedir emprestado a ${esc(nick)}</h3><p class="tr-sub">Você já deve ${brl(owe.bal)} para ele. Termine de pagar para pedir de novo.</p></div>`
    : `<form class="glass tr-col tr-col--them am-loan" data-loan="borrow"><h3>pedir emprestado a ${esc(nick)}</h3>
      <p class="tr-sub">sem garantia, ${pct(AM.loanRate(f))} ao mês em 12 parcelas no <b>débito automático</b> (saem sozinhas da sua carteira). O banco cobra ${pct(L.BANK_RATE)} e pede terra como garantia.</p>
      <label class="field"><span>valor (até ${brl(AM.loanLimit(s, f))})</span><input class="input" id="am-bor" type="number" min="1000" step="1000" max="${AM.loanLimit(s, f)}" value="${AM.loanLimit(s, f)}" inputmode="numeric"></label>
      <p class="am-prev" id="am-bprev">${preview(AM.loanLimit(s, f), AM.loanRate(f), 12)}</p>
      <p class="tr-sub">Atrasar parcela derruba a confiança; duas atrasadas e ele toma sua terra, como o banco.</p>${btn('borrow', nick, 'pedir agora')}</form>`;
  const open = [
    ...his.map(p => row(`${esc(nick)} te deve ${brl(p.bal)}`, `${pct(p.rate)} ao mês · faltam ${p.left} parcelas · ${AM.MODES[p.mode]?.label || 'débito automático'}`)),
    ...(owe ? [row(`você deve ${brl(owe.bal)} a ${esc(nick)}`, `${pct(owe.rate)} ao mês · faltam ${owe.left} parcelas · débito automático${owe.missed ? ' · <span class="bad">parcela atrasada</span>' : ''}`)] : []),
  ];
  return `${intro}<div class="tr-cols">${lend}${borrow}</div>${open.length ? `<h4 class="tr-h">empréstimos entre vocês</h4><ul class="am-list">${open.join('')}</ul>` : ''}`;
}
// prévia ao vivo do formulário de empréstimo
document.addEventListener('input', e => {
  const f = e.target.closest?.('.am-loan'); if (!f) return;
  const nick = $('#tr-cash')?.dataset.nick, s = G.S;
  if (f.dataset.loan === 'lend') {
    const mode = f.querySelector('[name=am-mode]:checked')?.value || 'auto', amt = Number($('#am-amt').value) || 0, rate = Number($('#am-rate').value), m = Number($('#am-months').value);
    $('#am-prev').innerHTML = preview(amt, rate, m);
    $('#am-risk').innerHTML = `${esc(nick)} aceita até <b>${pct(AM.lendMaxRate(s, nick, mode))}</b> ao mês ${AM.MODES[mode].label} · risco de calote ${pct(AM.lendRisk(s, nick, mode))} ao mês${rate > AM.lendMaxRate(s, nick, mode) ? ' · <span class="bad">juro acima do que ele aceita</span>' : ''}`;
  } else { const fr = AM.friend(s, nick); if (fr) $('#am-bprev').innerHTML = preview(Number($('#am-bor').value) || 0, AM.loanRate(fr), 12); }
});
document.addEventListener('change', e => { if (e.target.closest?.('.am-loan')) e.target.dispatchEvent(new Event('input', { bubbles: true })); });

// aba banco: só o agiota automático (parcerias e empréstimos diretos ficam na negociação do inventário)
export function render() {
  const el = $('#amigos'); if (!el) return;
  const s = G.S, a = AM.ensure(s);
  el.innerHTML = `<div class="glass am__auto"><label class="am-chk"><input type="checkbox" id="am-on" ${a.auto.on ? 'checked' : ''}><span>ligado</span></label>
    <label class="field"><span>emprestar no máximo (total na rua)</span><input class="input" id="am-budget" type="number" min="0" step="10000" value="${a.auto.budget}" inputmode="numeric"></label>
    <label class="field"><span>risco máximo de calote ao mês</span><select class="input" id="am-risk-auto">${[0.03, 0.05, 0.08, 0.12, 0.16].map(r => `<option value="${r}" ${Math.abs(a.auto.risk - r) < 1e-6 ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('')}</select></label>
    ${btn('auto', '', 'salvar', true)}
    <p class="muted small">Todo mês, na virada, ele empresta sozinho para os pedidos (parceiros e jogadores do mundo) que pagam mais juros, dentro do seu limite e do risco escolhido. Na rua agora: <b>${brl(AM.lentTotal(s))}</b>. Para emprestar para alguém específico, negocie com ele no inventário (aba dinheiro).</p></div>`;
}

const cap = t => t[0].toUpperCase() + t.slice(1);
const done = (err, ok) => { if (err) return say(cap(err), true); if (ok) say(ok); save(); G.render?.(); document.dispatchEvent(new Event('am:changed')); };
document.addEventListener('change', e => {
  const c = e.target.closest?.('[data-partner]'); if (!c) return;
  const nick = c.dataset.partner;
  const real = !!c.dataset.peer || AM.isPeer(G.S, nick);
  if (!c.checked && !confirm(`Desfazer a parceria com ${nick}? O que está alugado entre vocês volta para o dono.`)) { c.checked = true; return; }
  if (real && c.checked) { c.checked = false; return ask(nick, { kind: 'partner' }); }   // jogador de verdade precisa aceitar
  if (real) { AM.unfriend(G.S, nick); peerMsg(nick, { t: 'pend' }); return done(null, 'Parceria desfeita.'); }
  const err = AM.setPartner(G.S, nick, c.checked); if (err) c.checked = false;
  done(err, c.checked ? `${nick} agora é seu parceiro.` : 'Parceria desfeita.');
});
// com jogador de verdade nada acontece sem ele aceitar: trade-ui.js manda o pedido e aplica quando ele disser sim
export const ask = (nick, a) => document.dispatchEvent(new CustomEvent('am:ask', { detail: { nick, ask: a } }));
export const peerMsg = (nick, msg) => document.dispatchEvent(new CustomEvent('am:peer', { detail: { nick, msg } }));
export function askText(a, from) {
  const p = a.snap || {};
  if (a.kind === 'partner') return `${from} quer ser seu parceiro. Aceita?\n\nParceiros podem alugar terra, galpão e máquinas e emprestar dinheiro um para o outro. Cada negócio também pede a sua permissão.`;
  if (a.kind === 'give') return a.what === 'land' ? `${from} quer arrendar para você uma terra de ${p.ha} ha (${p.region}) por ${brl(p.value * L.RENT_FRIEND)} ao mês. Aceita?`
    : a.what === 'wh' ? `${from} quer alugar para você o ${WH(p.type)} por ${brl(Math.round(p.value * AM.WH_LEND / 1000) * 1000)} ao mês. Aceita?`
    : `${from} quer te emprestar o ${L.CARS[p.model]?.name || 'máquina'} por ${brl(Math.round((L.CARS[p.model]?.price || 0) * AM.TOOL_RENT * 0.8))} ao mês. Aceita?`;
  const terms = `${brl(a.amount)} a ${pct(a.rate)} ao mês em ${a.months} parcelas no débito automático`;
  return a.kind === 'lend' ? `${from} quer te emprestar ${terms}. Aceita?` : `${from} pede emprestado ${terms}. Você empresta?`;
}
const nickOf = b => b.closest('[data-nick]')?.dataset.nick;
document.addEventListener('submit', e => { if (e.target.closest?.('.am-loan')) e.preventDefault(); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-am]'); if (!b) return;
  const s = G.S, id = b.dataset.id, nk = nickOf(b);
  if (nk && AM.isPeer(s, nk) && peerClick(s, b.dataset.am, id, nk)) return;
  switch (b.dataset.am) {
    case 'take': { const o = AM.offers(s).find(x => x.id === id), err = AM.take(s, id); if (!err) note(o.kind === 'land' ? `arrendou terra de ${o.nick} (${o.land.ha} ha)` : o.kind === 'wh' ? `alugou galpão de ${o.nick}` : `pegou ${L.CARS[o.model].name} emprestado de ${o.nick}`); return done(err, 'Parceria fechada. O aluguel sai na virada do mês.'); }
    case 'retwh': return done(AM.returnWh(s, id), 'Galpão devolvido.');
    case 'rettool': return done(AM.returnTool(s, id), 'Máquina devolvida.');
    case 'lease': return done(AM.leaseLand(s, Number(id), nk), 'Terra arrendada para o seu parceiro.');
    case 'lendwh': return done(AM.lendWh(s, id, nk));
    case 'lendtool': return done(AM.lendTool(s, Number(id), nk));
    case 'borrow': {
      const amt = Math.round(Number($('#am-bor')?.value || 0) / 1000) * 1000, err = AM.borrow(s, id, amt);
      if (!err) note(`empréstimo de ${id}, 12 parcelas no débito automático`, amt); return done(err, `${id} mandou ${brl(amt)}. As parcelas saem sozinhas na virada do mês.`);
    }
    case 'lendto': {
      const mode = b.closest('.am-loan')?.querySelector('[name=am-mode]:checked')?.value || 'auto';
      const amt = Math.round(Number($('#am-amt')?.value || 0) / 1000) * 1000, err = AM.lendTo(s, id, amt, Number($('#am-rate').value), Number($('#am-months').value), mode);
      if (!err) note(`empréstimo para ${id} (${AM.MODES[mode].label})`, -amt); return done(err, `${id} assinou a promissória de ${brl(amt)} (${AM.MODES[mode].label}). As parcelas entram na virada do mês.`);
    }
    case 'auto': AM.setAuto(s, $('#am-on').checked, $('#am-budget').value, $('#am-risk-auto').value); return done(null, s.amigos.auto.on ? 'Agiota automático ligado.' : 'Agiota automático desligado.');
  }
});
// parceiro de verdade: passar algo ou dinheiro vira pedido; pegar de volta / devolver é na hora e avisa o outro
function peerClick(s, act, id, nick) {
  const give = (what, oid) => { const a = AM.askOf(s, 'give', { what, id: oid }); if (a) ask(nick, a); return true; };
  const back = (err, msg, ok) => { if (!err) peerMsg(nick, { t: 'pback', ...msg }); done(err, ok); return true; };
  switch (act) {
    case 'lease': return give('land', Number(id));
    case 'lendwh': { const w = s.biz?.wh?.find(x => x.id === id); return w?.lentTo ? back(AM.lendWh(s, id, nick), { what: 'wh', oid: id, owner: false }, 'Galpão de volta.') : give('wh', id); }
    case 'lendtool': { const c = s.cars.find(x => x.id === Number(id)); return c?.lentTo ? back(AM.lendTool(s, Number(id), nick), { what: 'tool', oid: Number(id), owner: false }, 'Máquina de volta.') : give('tool', Number(id)); }
    case 'retwh': { const w = s.biz?.whRent?.find(x => x.id === id); return back(AM.returnWh(s, id), { what: 'wh', oid: w?.oid, owner: true }, 'Galpão devolvido.'); }
    case 'rettool': { const t = AM.ensure(s).tools.find(x => x.id === id); return back(AM.returnTool(s, id), { what: 'tool', oid: t?.oid, owner: true }, 'Máquina devolvida.'); }
    case 'borrow': { const f = AM.friend(s, nick); ask(nick, AM.askOf(s, 'borrow', { amount: Math.min(AM.loanLimit(s, f), Number($('#am-bor')?.value) || 0), rate: AM.loanRate(f), months: 12 })); return true; }
    case 'lendto': ask(nick, AM.askOf(s, 'lend', { amount: Math.min(s.money, Number($('#am-amt')?.value) || 0), rate: $('#am-rate').value, months: $('#am-months').value })); return true;
  }
  return false;
}
