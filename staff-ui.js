// Aba "equipe": funcionários ativos no topo (com demitir) e a agência de contratação embaixo.
// O relatório do contador (contador-ui.js) aparece logo abaixo quando ele está na equipe.
import * as SF from './staff.js';
import * as CT from './contador.js';
import * as CTU from './contador-ui.js';
import * as L from './logic.js';
import { avatarSVG } from './avatar.js';
import { G, $, esc, brl, say, save, note } from './store.js';

const stars = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
const price = (s, x, worth) => (x.id === 'contador' ? `a partir de ${brl(CT.quote(worth, 'mensal'))}/mês` : '');

export function render() {
  const el = $('#eq-active'); if (!el) return;
  const s = G.S, worth = L.netWorth(s), act = SF.active(s);
  // funcionários ativos
  el.innerHTML = `<div class="eq-sec__h"><h3>funcionários ativos <small class="muted">${act.length} ${act.length === 1 ? 'contratado' : 'contratados'}</small></h3>${act.length ? `<span class="small">folha da equipe: <b class="bad">${brl(SF.payroll(s, worth))}</b> por mês</span>` : ''}</div>`
    + (act.length ? `<div class="eq-actives">${act.map(x => { const c = SF.contract(s, x.id, worth);
      return `<article class="eq-on glass"><span class="eq-on__av">${avatarSVG(x.look, { label: x.name })}</span>
        <div class="eq-on__b"><b>${esc(x.name)}</b><span class="eq-role">${esc(x.role)} · <span class="good">trabalhando</span></span>
          <span class="small">plano ${esc(c?.plan || '')} · ${c ? `${brl(c.cost)}${c.per === 'mês' ? '/mês' : ' pago'}` : ''} · ${esc(c?.until || '')}</span></div>
        <div class="eq-on__a">${x.id === 'contador' ? '<a class="btn btn--gold btn--sm" href="#ct-body" data-eq="open">ver relatório</a>' : ''}<button class="btn btn--glass btn--sm" data-eq="fire" data-id="${x.id}">demitir</button></div></article>`; }).join('')}</div>`
      : '<p class="eq-empty glass">Ninguém trabalhando para você ainda. Contrate o primeiro funcionário na agência abaixo.</p>');
  // agência
  $('#eq-hire').innerHTML = `<div class="eq-sec__h"><h3>agência de funcionários</h3><span class="small muted">mais profissionais chegando em breve</span></div><div class="eq-grid">${SF.STAFF.map(x => { const on = SF.isActive(s, x.id);
    return `<article class="eq-card glass${x.soon ? ' is-soon' : ''}${on ? ' is-on' : ''}"><div class="eq-card__top"><span class="eq-card__av">${avatarSVG(x.look, { label: x.name })}</span>${x.soon ? '<span class="eq-tag">em breve</span>' : on ? '<span class="eq-tag eq-tag--on">na sua equipe</span>' : '<span class="eq-tag eq-tag--new">disponível</span>'}</div>
      <div class="eq-card__b"><span class="eq-role">${esc(x.role)}</span><h4>${esc(x.name)}</h4><span class="eq-stars" aria-label="${x.stars} estrelas">${stars(x.stars)}</span>
        <p class="small">${esc(x.does)}</p>${x.xp ? `<p class="small muted">${esc(x.xp)}</p>` : ''}
        ${x.soon ? '<button class="btn btn--glass btn--sm" disabled>em breve</button>' : on ? '<a class="btn btn--glass btn--sm" href="#ct-body" data-eq="open">ver relatório</a>' : `<p class="eq-price">${price(s, x, worth)}</p><a class="btn btn--gold" href="#ct-body" data-eq="open">ver planos e contratar</a>`}</div></article>`; }).join('')}</div>`;
  CTU.render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-eq]'); if (!b) return;
  if (b.dataset.eq === 'open') { e.preventDefault(); document.getElementById('ct-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (b.dataset.eq === 'fire') {
    const s = G.S, x = SF.byId(b.dataset.id); if (!x) return;
    const back = x.id === 'contador' ? CT.refundOf(s) : 0;
    if (!confirm(`Demitir ${x.name} (${x.role})?${back ? ` Você recebe de volta ${brl(back)} dos meses que não usou (70%).` : ''}`)) return;
    if (x.id === 'contador') { const r = CT.fire(s); if (r.err) return say(r.err, true); if (r.refund) note(`contador demitido: devolução de ${Math.round(CT.FIRE_KEEP * 100)}% dos meses não usados`, r.refund); }
    else if (s.staff) delete s.staff[x.id];
    say(`${x.name} foi demitido${back ? ` e você recebeu ${brl(back)} de volta` : ''}.`); save(); G.render();
  }
});
