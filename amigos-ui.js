// Parcerias dentro da negociação do inventário (bloco "parceria" da janela de troca) + agiota automático na aba banco.
// Regras em amigos.js. A caixinha "parceiro" fica na lista de jogadores do inventário e no topo da negociação.
import * as AM from './amigos.js';
import * as L from './logic.js';
import * as NG from './negocios.js';
import { G, $, esc, brl, say, save, note } from './store.js';

const pct = v => `${(v * 100).toFixed(1).replace('.', ',')}%`;
export const confTag = c => `<span class="tag ${c >= 60 ? 'tag--green' : c >= 30 ? 'tag--gold' : 'tag--red'}">confiança ${Math.round(c)}</span>`;
export const partnerBox = (s, nick) => `<label class="am-chk"><input type="checkbox" data-partner="${esc(nick)}" ${AM.isFriend(s, nick) ? 'checked' : ''}><span>parceiro</span></label>`;
const btn = (am, id, txt, gold) => `<button class="btn ${gold ? 'btn--gold' : 'btn--glass'} btn--sm" data-am="${am}" data-id="${esc(String(id))}">${txt}</button>`;
const li = (txt, b = '') => `<li><span>${txt}</span>${b}</li>`;
const WH = t => NG.WAREHOUSES[t]?.label || 'galpão';

// bloco da negociação com um jogador do mundo: o que ele oferece e o que você pode oferecer a ele
export function partnerHTML(nick) {
  const s = G.S, f = AM.friend(s, nick);
  const head = `<div class="am-head"><h3>parceria com ${esc(nick)}</h3>${partnerBox(s, nick)}${f ? confTag(f.conf) : ''}</div>`;
  const owes = s.lent.filter(p => p.nick === nick || p.name === nick), owe = s.loans.find(l => l.from === nick);
  const status = [owes.length ? `${esc(nick)} te deve <b>${brl(owes.reduce((t, p) => t + p.bal, 0))}</b>` : '', owe ? `você deve <b>${brl(owe.bal)}</b> a ${esc(nick)}` : ''].filter(Boolean).join(' · ');
  const lendForm = `<li class="am-form"><span>emprestar dinheiro</span>
      <input class="input input--s" id="am-amt" type="number" min="1000" step="1000" value="${Math.min(AM.lendCap(s, nick), 50000)}" inputmode="numeric" aria-label="valor">
      <select class="input input--s" id="am-rate" aria-label="juros ao mês">${AM.LEND_RATES.map(r => `<option value="${r}" ${r === (f ? 0.025 : 0.06) ? 'selected' : ''}>${pct(r)}/mês</option>`).join('')}</select>
      <select class="input input--s" id="am-months" aria-label="prazo">${[3, 6, 9, 12].map(m => `<option value="${m}" ${m === 6 ? 'selected' : ''}>${m} meses</option>`).join('')}</select>
      ${btn('lendto', nick, 'emprestar', true)}<small class="muted">precisa de até ${brl(AM.lendCap(s, nick))} · aceita até ${pct(AM.lendMaxRate(s, nick))} ao mês · risco de calote ${pct(AM.lendRisk(s, nick))} ao mês</small></li>`;
  if (!f) return `${head}<p class="muted small">Marque <b>parceiro</b> para liberar o que ${esc(nick)} tem parado (terra, galpão, trator, caminhão, dinheiro sem garantia) e para passar a ele o que está parado com você. Sem parceria, só dá para emprestar a juros de agiota.</p>
    ${status ? `<p class="small">${status}</p>` : ''}<ul class="am-list">${lendForm}</ul>`;

  const theirs = AM.offersFrom(s, nick).map(o => o.kind === 'land'
    ? li(`terra: ${o.land.ha} ha, ${esc(o.land.region)} · pasto para ${L.landCap(o.land)} cabeças · <b class="good">${brl(o.land.value * o.rate)}/mês</b> <small class="muted">(normal ${brl(o.land.value * L.RENT_PAY)})</small>`, btn('take', o.id, 'arrendar', true))
    : o.kind === 'wh' ? li(`espaço no galpão: ${esc(WH(o.type))} (${NG.WAREHOUSES[o.type].cap} t para o seu estoque) · <b class="good">${brl(o.rent)}/mês</b>`, btn('take', o.id, 'alugar', true))
    : li(`${o.type === 'trator' ? 'trator' : 'caminhão'} emprestado: ${esc(L.CARS[o.model].name)} · <b class="good">${brl(o.fee)}/mês</b> <small class="muted">(${esc(L.CARS[o.model].perk || '')})</small>`, btn('take', o.id, 'pegar', true)));
  if (!owe) theirs.push(`<li class="am-form"><span>pedir dinheiro emprestado: até ${brl(AM.loanLimit(s, f))}, ${pct(AM.loanRate(f))} ao mês em 12 parcelas, sem garantia</span>
      <input class="input input--s" id="am-bor" type="number" min="1000" step="1000" value="${AM.loanLimit(s, f)}" inputmode="numeric" aria-label="valor">${btn('borrow', nick, 'pedir')}</li>`);
  const fromHim = [
    ...s.lands.filter(l => l.friend === nick).map(l => li(`terra dele: ${l.ha} ha, ${esc(l.region)}, ${brl(L.rentNow(l))}/mês <small class="muted">(devolva na aba terras)</small>`)),
    ...(s.biz?.whRent || []).filter(w => w.friend === nick).map(w => li(`galpão dele: ${esc(WH(w.type))}, ${brl(w.rent)}/mês`, btn('retwh', w.id, 'devolver'))),
    ...AM.ensure(s).tools.filter(t => t.friend === nick).map(t => li(`máquina dele: ${esc(L.CARS[t.model]?.name || t.type)}, ${brl(t.fee)}/mês`, btn('rettool', t.id, 'devolver'))),
  ];
  const mine = [lendForm,
    ...AM.idleLands(s).map(l => li(`arrendar sua terra parada: ${l.ha} ha, ${esc(l.region)} · <b class="good">${brl(l.value * L.RENT_FRIEND)}/mês</b> <small class="muted">(de fora pagam ${brl(l.value * L.RENT_GET)})</small>`, btn('lease', l.id, 'arrendar'))),
    ...AM.idleWh(s).map(w => li(`alugar seu galpão: ${esc(WH(w.type))} · <b class="good">${brl(w.value * AM.WH_LEND)}/mês</b>`, btn('lendwh', w.id, 'alugar'))),
    ...AM.idleTools(s).map(c => li(`emprestar seu ${esc(L.CARS[c.model].name)} · <b class="good">${brl(L.CARS[c.model].price * AM.TOOL_RENT * 0.8)}/mês</b> <small class="muted">(enquanto estiver com ele, a vantagem da máquina é dele)</small>`, btn('lendtool', c.id, 'emprestar'))),
  ];
  const withHim = [
    ...s.lands.filter(l => l.leaseTo === nick).map(l => li(`sua terra: ${l.ha} ha, ${esc(l.region)}`, `<button class="btn btn--glass btn--sm" data-act="lease" data-id="${l.id}">pegar de volta</button>`)),
    ...(s.biz?.wh || []).filter(w => w.lentTo === nick).map(w => li(`seu ${esc(WH(w.type))}`, btn('lendwh', w.id, 'pegar de volta'))),
    ...(s.cars || []).filter(c => c.lentTo === nick).map(c => li(`seu ${esc(L.CARS[c.model]?.name || 'carro')}`, btn('lendtool', c.id, 'pegar de volta'))),
  ];
  return `${head}${status ? `<p class="small">${status}</p>` : ''}
    <div class="am-cols"><div><h4>${esc(nick)} oferece este mês</h4><ul class="am-list">${theirs.join('') || '<li class="muted small">Nada parado com ele este mês. Muda na virada do mês.</li>'}</ul>
      ${fromHim.length ? `<h4>você está usando dele</h4><ul class="am-list">${fromHim.join('')}</ul>` : ''}</div>
    <div><h4>você oferece a ${esc(nick)}</h4><ul class="am-list">${mine.join('')}</ul>
      ${withHim.length ? `<h4>está com ${esc(nick)}</h4><ul class="am-list">${withHim.join('')}</ul>` : ''}</div></div>
    <p class="muted small">Aluguéis e parcelas entram ou saem na virada do mês. Conta paga em dia aumenta a confiança; calote derruba e confiança zerada acaba a parceria.</p>`;
}

// aba banco: só o agiota automático (as parcerias ficam na negociação do inventário)
export function render() {
  const el = $('#amigos'); if (!el) return;
  const s = G.S, a = AM.ensure(s);
  el.innerHTML = `<div class="glass am__auto"><label class="am-chk"><input type="checkbox" id="am-on" ${a.auto.on ? 'checked' : ''}><span>ligado</span></label>
    <label class="field"><span>emprestar no máximo (total na rua)</span><input class="input" id="am-budget" type="number" min="0" step="10000" value="${a.auto.budget}" inputmode="numeric"></label>
    <label class="field"><span>risco máximo de calote ao mês</span><select class="input" id="am-risk">${[0.03, 0.05, 0.08, 0.12, 0.16].map(r => `<option value="${r}" ${Math.abs(a.auto.risk - r) < 1e-6 ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('')}</select></label>
    ${btn('auto', '', 'salvar', true)}
    <p class="muted small">Todo mês, na virada, ele empresta sozinho para os pedidos (parceiros e jogadores do mundo) que pagam mais juros, dentro do seu limite e do risco escolhido. Na rua agora: <b>${brl(AM.lentTotal(s))}</b>. Para emprestar para alguém específico, negocie com ele no inventário.</p></div>`;
}

const cap = t => t[0].toUpperCase() + t.slice(1);
const done = (err, ok) => { if (err) return say(cap(err), true); if (ok) say(ok); save(); G.render?.(); document.dispatchEvent(new Event('am:changed')); };
document.addEventListener('change', e => {
  const c = e.target.closest?.('[data-partner]'); if (!c) return;
  const nick = c.dataset.partner;
  if (!c.checked && !confirm(`Desfazer a parceria com ${nick}? O que está alugado entre vocês volta para o dono.`)) { c.checked = true; return; }
  const err = AM.setPartner(G.S, nick, c.checked); if (err) c.checked = false;
  done(err, c.checked ? `${nick} agora é seu parceiro.` : 'Parceria desfeita.');
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-am]'); if (!b) return;
  const s = G.S, id = b.dataset.id;
  switch (b.dataset.am) {
    case 'take': { const o = AM.offers(s).find(x => x.id === id), err = AM.take(s, id); if (!err) note(o.kind === 'land' ? `arrendou terra de ${o.nick} (${o.land.ha} ha)` : o.kind === 'wh' ? `alugou galpão de ${o.nick}` : `pegou ${L.CARS[o.model].name} emprestado de ${o.nick}`); return done(err, 'Parceria fechada. O aluguel sai na virada do mês.'); }
    case 'retwh': return done(AM.returnWh(s, id), 'Galpão devolvido.');
    case 'rettool': return done(AM.returnTool(s, id), 'Máquina devolvida.');
    case 'lease': return done(AM.leaseLand(s, Number(id), b.closest('[data-nick]')?.dataset.nick), 'Terra arrendada para o seu parceiro.');
    case 'lendwh': return done(AM.lendWh(s, id, b.closest('[data-nick]')?.dataset.nick));
    case 'lendtool': return done(AM.lendTool(s, Number(id), b.closest('[data-nick]')?.dataset.nick));
    case 'borrow': {
      const amt = Math.round(Number($('#am-bor')?.value || 0) / 1000) * 1000, err = AM.borrow(s, id, amt);
      if (!err) note(`empréstimo de ${id}, 12 parcelas`, amt); return done(err, `${id} mandou ${brl(amt)}. Atrasar parcela derruba a confiança (e ele pode tomar sua terra).`);
    }
    case 'lendto': {
      const amt = Math.round(Number($('#am-amt')?.value || 0) / 1000) * 1000, err = AM.lendTo(s, id, amt, Number($('#am-rate').value), Number($('#am-months').value));
      if (!err) note(`empréstimo para ${id}`, -amt); return done(err, `${id} assinou a promissória de ${brl(amt)}. As parcelas entram na virada do mês.`);
    }
    case 'auto': AM.setAuto(s, $('#am-on').checked, $('#am-budget').value, $('#am-risk').value); return done(null, s.amigos.auto.on ? 'Agiota automático ligado.' : 'Agiota automático desligado.');
  }
});
