// Aba banco: amigos, parcerias e agiotagem (regras em amigos.js).
import * as AM from './amigos.js';
import * as L from './logic.js';
import * as NG from './negocios.js';
import * as NPC from './npcs.js';
import { avatarSVG } from './avatar.js';
import { G, $, esc, brl, say, save, note } from './store.js';

const pct = v => `${(v * 100).toFixed(2).replace('.', ',')}%`;
const av = n => `<span class="am__av">${avatarSVG(n?.look || {}, { label: n?.nick || '' })}</span>`;
const conf = c => `<span class="tag ${c >= 60 ? 'tag--green' : c >= 30 ? 'tag--gold' : 'tag--red'}">confiança ${Math.round(c)}</span>`;

export function render() {
  const el = $('#amigos'); if (!el) return;
  const s = G.S, a = AM.ensure(s), fr = AM.friends(s), req = AM.requests(s), off = AM.offers(s), best = AM.bestFriend(s);
  const idleLands = s.lands.filter(l => l.own && !l.leasedOut && !l.crop && !l.orchard && !l.cane && !L.pastureBusy(s, l));
  const myLeases = s.lands.filter(l => l.leaseTo), fLands = s.lands.filter(l => l.friend), whR = s.biz?.whRent || [], myWh = s.biz?.wh || [];
  el.innerHTML = `
  <p class="muted small">Amigo faz negócio melhor: terra e galpão dele saem mais baratos, ele paga mais pelo que está parado com você e empresta sem garantia.
    A confiança sobe todo mês e com conta paga; calote derruba e confiança zerada acaba a amizade. Até ${AM.MAX} amigos.</p>
  ${req.length && fr.length < AM.MAX ? `<h4>querem ser seus amigos</h4><div class="am__row">${req.map(n => `<article class="glass am__card">${av(n)}<div><b>${esc(n.nick)}</b><small class="muted">nível ${NPC.levelFor(NPC.worthAt(n, s.month))}</small></div>
      <button class="btn btn--gold btn--sm" data-am="accept" data-n="${esc(n.nick)}">aceitar</button><button class="btn btn--glass btn--sm" data-am="refuse" data-n="${esc(n.nick)}">agora não</button></article>`).join('')}</div>` : ''}
  <h4>seus amigos</h4>
  ${fr.length ? `<div class="am__row">${fr.map(f => `<article class="glass am__card">${av(f.npc)}<div><b>${esc(f.nick)}</b> ${conf(f.conf)}
      <small class="muted">empresta até ${brl(AM.loanLimit(s, f))} a ${pct(AM.loanRate(f))} ao mês</small></div>
      <button class="btn btn--glass btn--sm" data-am="borrow" data-n="${esc(f.nick)}">pedir emprestado</button><button class="btn btn--glass btn--sm" data-am="unfriend" data-n="${esc(f.nick)}">desfazer</button></article>`).join('')}</div>`
    : '<p class="empty glass">Nenhum amigo ainda. Aceite um pedido de amizade acima (chegam pedidos novos todo mês).</p>'}
  ${off.length ? `<h4>parcerias oferecidas este mês</h4><div class="am__row">${off.map(o => o.kind === 'land'
    ? `<article class="glass am__card"><div><b>terra de ${esc(o.nick)}</b><small>${o.land.ha} ha, ${esc(o.land.region)} · pasto para ${L.landCap(o.land)} cabeças</small>
        <small class="good">${brl(o.land.value * o.rate)} ao mês (normal: ${brl(o.land.value * L.RENT_PAY)})</small></div><button class="btn btn--gold btn--sm" data-am="take" data-id="${o.id}">arrendar</button></article>`
    : `<article class="glass am__card"><div><b>${esc(NG.WAREHOUSES[o.type].label)} de ${esc(o.nick)}</b><small>guarda ${NG.WAREHOUSES[o.type].cap} t do seu estoque, sem comprar o galpão</small>
        <small class="good">${brl(o.rent)} ao mês</small></div><button class="btn btn--gold btn--sm" data-am="take" data-id="${o.id}">alugar</button></article>`).join('')}</div>` : ''}
  ${fLands.length || whR.length ? `<h4>alugado de amigos</h4><ul class="am__list">${fLands.map(l => `<li>${l.ha} ha, ${esc(l.region)} de <b>${esc(l.friend)}</b>: ${brl(L.rentNow(l))}/mês <span class="muted small">(devolva na aba fazenda)</span></li>`).join('')}
    ${whR.map(w => `<li>${esc(NG.WAREHOUSES[w.type].label)} de <b>${esc(w.friend)}</b>: ${brl(w.rent)}/mês <button class="btn btn--glass btn--sm" data-am="retwh" data-id="${w.id}">devolver</button></li>`).join('')}</ul>` : ''}
  ${best ? `<h4>o que está parado com você</h4><p class="muted small">Quem usa é seu amigo de mais confiança, <b>${esc(best.nick)}</b>. Terra: ${pct(L.RENT_FRIEND)} do valor ao mês (de fora pagam ${pct(L.RENT_GET)}). Galpão: ${pct(AM.WH_LEND)} ao mês.</p>
    <ul class="am__list">${idleLands.map(l => `<li>${l.ha} ha, ${esc(l.region)}: ${brl(l.value * L.RENT_FRIEND)}/mês <button class="btn btn--glass btn--sm" data-am="lease" data-id="${l.id}">arrendar para ${esc(best.nick)}</button></li>`).join('')}
    ${myLeases.map(l => `<li>${l.ha} ha, ${esc(l.region)} com <b>${esc(l.leaseTo)}</b> <button class="btn btn--glass btn--sm" data-act="lease" data-id="${l.id}">pegar de volta</button></li>`).join('')}
    ${myWh.map(w => `<li>${esc(NG.WAREHOUSES[w.type]?.label || 'galpão')}${w.lentTo ? ` com <b>${esc(w.lentTo)}</b>` : `: ${brl(w.value * AM.WH_LEND)}/mês`} <button class="btn btn--glass btn--sm" data-am="lendwh" data-id="${w.id}">${w.lentTo ? 'pegar de volta' : `alugar para ${esc(best.nick)}`}</button></li>`).join('')}
    ${idleLands.length || myLeases.length || myWh.length ? '' : '<li class="muted">Nada parado: terras livres e galpões aparecem aqui.</li>'}</ul>` : ''}
  <h4>agiota automático</h4>
  <div class="glass am__auto"><label class="field"><span>ligado</span><input type="checkbox" id="am-on" ${a.auto.on ? 'checked' : ''}></label>
    <label class="field"><span>emprestar no máximo (total na rua)</span><input class="input" id="am-budget" type="number" min="0" step="10000" value="${a.auto.budget}" inputmode="numeric"></label>
    <label class="field"><span>risco máximo de calote ao mês</span><select class="input" id="am-risk">${[0.03, 0.05, 0.08, 0.12, 0.16].map(r => `<option value="${r}" ${Math.abs(a.auto.risk - r) < 1e-6 ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('')}</select></label>
    <button class="btn btn--gold btn--sm" data-am="auto">salvar</button>
    <p class="muted small">Todo mês, na virada, ele empresta sozinho para os pedidos (amigos e jogadores do mundo) que pagam mais juros, dentro do seu limite e do risco escolhido. Na rua agora: <b>${brl(AM.lentTotal(s))}</b>.</p></div>`;
}

const cap = t => t[0].toUpperCase() + t.slice(1);
const done = (err, ok) => { if (err) return say(cap(err), true); if (ok) say(ok); save(); G.render?.(); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-am]'); if (!b) return;
  const s = G.S, n = b.dataset.n, id = b.dataset.id;
  switch (b.dataset.am) {
    case 'accept': return done(AM.accept(s, n), `Agora você e ${n} são amigos.`);
    case 'refuse': AM.refuse(s, n); return done();
    case 'unfriend': if (!confirm(`Desfazer a amizade com ${n}? O que está alugado com ele volta para você.`)) return; AM.unfriend(s, n); return done(null, 'Amizade desfeita.');
    case 'take': { const o = AM.offers(s).find(x => x.id === id), err = AM.take(s, id); if (!err) note(o.kind === 'land' ? `arrendou terra de ${o.nick} (${o.land.ha} ha)` : `alugou galpão de ${o.nick}`); return done(err, 'Parceria fechada. O aluguel sai na virada do mês.'); }
    case 'retwh': return done(AM.returnWh(s, id), 'Galpão devolvido.');
    case 'lease': return done(AM.leaseLand(s, Number(id)), 'Terra arrendada para o seu amigo.');
    case 'lendwh': return done(AM.lendWh(s, id));
    case 'borrow': {
      const f = AM.friends(s).find(x => x.nick === n), v = prompt(`Quanto pedir para ${n}? Até ${brl(AM.loanLimit(s, f))}, ${pct(AM.loanRate(f))} ao mês em 12 parcelas.`, String(AM.loanLimit(s, f)));
      if (v == null) return; const amt = Math.round(Number(String(v).replace(/\D/g, '')) / 1000) * 1000, err = AM.borrow(s, n, amt);
      if (!err) note(`empréstimo de ${n}, 12 parcelas`, amt); return done(err, `${n} mandou ${brl(amt)}. Atrasar parcela derruba a confiança (e ele pode tomar sua terra).`);
    }
    case 'auto': AM.setAuto(s, $('#am-on').checked, $('#am-budget').value, $('#am-risk').value); return done(null, s.amigos.auto.on ? 'Agiota automático ligado.' : 'Agiota automático desligado.');
  }
});
