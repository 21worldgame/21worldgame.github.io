// Investimentos na aba banco (regras em invest.js) + lançamento anunciado na TV 21, nos avisos e na página inicial.
import * as INV from './invest.js';
import * as L from './logic.js';
import * as Live from './live.js';
import * as W from './world.js';
import * as TV from './news-ui.js';
import { G, $, esc, brl, say, save, note, feed } from './store.js';

const pct = v => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/0$/, '')}%`;
// prazo no calendário da cidade (o relógio do mundo no topo mostra o mês e o ano de agora)
const anos = m => { const a = Math.floor(m / 12), r = m % 12; return a ? `${a} ${a === 1 ? 'ano' : 'anos'}${r ? ` e ${r} ${r === 1 ? 'mês' : 'meses'}` : ''}` : `${r} ${r === 1 ? 'mês' : 'meses'}`; };
const venc = m => W.dateLabel((G.S.month || 1) + m);
const worth = () => L.netWorth(G.S);

export function render() {
  const el = $('#invest'); if (!el || !G.S) return;
  const s = G.S, room = INV.cap(s, worth()), mine = s.invest || [];
  const inv = mine.reduce((t, i) => t + i.amt, 0), acc = mine.reduce((t, i) => t + (i.acc || 0), 0);
  const def = Math.max(INV.MIN, Math.min(Math.floor(s.money), Math.floor(room), 100000));
  el.innerHTML = `<div class="ivp-sum glass"><div><span class="muted small">aplicado</span><b>${brl(inv)}</b></div><div><span class="muted small">já rendeu</span><b class="good">${brl(acc)}</b></div><div><span class="muted small">ainda pode aplicar</span><b>${brl(room)}</b></div></div>
    <div class="ivp-grid">${Object.entries(INV.PRODUCTS).map(([k, P]) => `<article class="ivp-card glass">
      <div class="ivp-card__top"><span class="ivp-card__ico" aria-hidden="true">${P.icon}</span><div><h4>${esc(P.name)}</h4><small class="muted">${P.months ? `prazo de ${P.months} meses (${anos(P.months)} na cidade). Aplicando agora, vence em ${venc(P.months)}` : 'sem prazo, resgate quando quiser'}</small></div></div>
      <p class="ivp-card__rate"><b>${pct(INV.rateNow(k, Live.now()))}</b> ao mês${P.months ? ` · <span class="good">+${Math.round(INV.rateNow(k, Live.now()) * P.months * 1000) / 10}% no fim</span>` : ''}</p>
      <p class="small muted">${esc(P.desc)}${P.months ? ` Sair antes: ${P.early ? `perde o rendimento e ${Math.round(P.early * 100)}% do valor aplicado` : 'perde o rendimento'}.` : ''}</p>
      <div class="ivp-card__form"><input class="input" type="number" min="${INV.MIN}" step="1000" value="${def}" inputmode="numeric" data-inv-amt="${k}" aria-label="valor para aplicar no ${esc(P.name)}"><button class="btn btn--gold btn--sm" data-inv-apply="${k}">aplicar</button></div>
      <p class="small ivp-card__prev" data-inv-prev="${k}">${prev(k, def)}</p></article>`).join('')}</div>
    <h4>seus investimentos</h4>
    <ul class="ivp-list">${mine.map(i => { const P = INV.PRODUCTS[i.kind], done = P.months ? (P.months - i.left) / P.months : 0;
      return `<li class="glass"><span class="ivp-card__ico" aria-hidden="true">${P.icon}</span><div class="ivp-list__info"><b>${esc(P.name)}</b><span class="small">aplicado ${brl(i.amt)} · rendeu <b class="good">${brl(i.acc || 0)}</b>${P.months ? ` · no fim: ${brl(INV.finalOf(i.kind, i.amt, INV.rateOf(i)))} (${pct(INV.rateOf(i))} ao mês contratado)` : ''}</span>
        ${P.months ? `<span class="bar"><i style="transform:scaleX(${done.toFixed(3)})"></i></span><span class="small">⏳ faltam <b>${i.left} meses</b> (${anos(i.left)} na cidade) · 📅 vence em <b>${venc(i.left)}</b></span>` : ''}</div>
        <button class="btn btn--glass btn--sm" data-inv-out="${i.id}">${P.months ? `sair antes (${brl(INV.earlyValue(i))})` : 'resgatar'}</button></li>`; }).join('') || '<li class="muted small">Nenhum investimento ainda. O dinheiro aplicado continua contando no seu patrimônio.</li>'}</ul>
    <p class="muted small">Investimento é para guardar dinheiro com segurança: rende menos que terras e empresas. Juros simples sobre o valor aplicado; teto de 25% do patrimônio (no máximo R$ 50 mi). No vencimento, tudo volta sozinho para a sua conta. O prazo corre no calendário da cidade: o relógio do mundo, no topo, mostra o mês e o ano de hoje.</p>
    <section class="glass ivp-calc"><h4>🧮 calculadora do investidor</h4>
      <div class="row"><label class="field"><span>produto</span><select class="input" id="ivc-k">${Object.entries(INV.PRODUCTS).map(([k, P]) => `<option value="${k}"${k === ivc.k ? ' selected' : ''}>${esc(P.name)}</option>`).join('')}</select></label>
      <label class="field"><span>valor</span><input class="input" id="ivc-v" type="number" min="0" step="1000" inputmode="numeric" value="${ivc.v}"></label>
      <label class="field"><span>daqui a quantos meses?</span><input class="input" id="ivc-m" type="number" min="1" max="2000" inputmode="numeric" value="${ivc.m}"></label></div>
      <p class="small" id="ivc-out">${ivcOut()}</p></section>`;
}
// calculadora: quanto rende e quando vence, no calendário da cidade; e em que mês/ano a cidade estará daqui a N meses
const ivc = { k: 'previdencia', v: 100000, m: 12 };
function ivcOut() {
  const P = INV.PRODUCTS[ivc.k], r = INV.rateNow(ivc.k, Live.now()), v = Math.max(0, Number(ivc.v) || 0), m = Math.max(1, Math.min(2000, Math.floor(Number(ivc.m) || 1)));
  const fim = P.months ? `Fica <b>${P.months} meses</b> (${anos(P.months)}) e devolve <b class="good">${brl(INV.finalOf(ivc.k, v, r))}</b> em ${venc(P.months)}.` : 'Não tem prazo: resgata quando quiser.';
  return `${esc(P.name)} hoje: <b>${pct(r)} ao mês</b>. ${brl(v)} rendem <b>${brl(v * r)}</b> por mês da cidade. ${fim}<br>Em <b>${m} meses</b> (${anos(m)}) ${P.months && m < P.months ? `terá rendido ${brl(v * r * m)}, ainda preso até ${venc(P.months)}` : P.months ? 'já terá vencido' : `terá rendido ${brl(v * r * m)}`}. A cidade estará em <b>${venc(m)}</b>.`;
}
document.addEventListener('input', e => { if (!['ivc-k', 'ivc-v', 'ivc-m'].includes(e.target.id)) return; ivc.k = document.getElementById('ivc-k').value; ivc.v = document.getElementById('ivc-v').value; ivc.m = document.getElementById('ivc-m').value; const o = document.getElementById('ivc-out'); if (o) o.innerHTML = ivcOut(); });
document.addEventListener('change', e => { if (e.target.id === 'ivc-k') { ivc.k = e.target.value; const o = document.getElementById('ivc-out'); if (o) o.innerHTML = ivcOut(); } });
const prev = (k, amt) => { const P = INV.PRODUCTS[k]; amt = Math.floor(Number(amt) || 0); return amt >= INV.MIN ? (P.months ? `aplicando ${brl(amt)}, recebe <b class="good">${brl(INV.finalOf(k, amt, INV.rateNow(k, Live.now())))}</b> no vencimento` : `rende ~${brl(amt * INV.rateNow(k, Live.now()))} por mês`) : `mínimo ${brl(INV.MIN)}`; };
document.addEventListener('input', e => { const k = e.target.dataset?.invAmt; if (k) { const p = document.querySelector(`[data-inv-prev="${k}"]`); if (p) p.innerHTML = prev(k, e.target.value); } });
document.addEventListener('click', e => {
  const a = e.target.closest('[data-inv-apply]');
  if (a) {
    const k = a.dataset.invApply, P = INV.PRODUCTS[k], amt = Math.floor(Number(document.querySelector(`[data-inv-amt="${k}"]`)?.value) || 0);
    if (P.months && !confirm(`Aplicar ${brl(amt)} no ${P.name} por ${P.months} meses (${anos(P.months)} na cidade, vence em ${venc(P.months)})? Sair antes ${P.early ? `custa o rendimento e ${Math.round(P.early * 100)}% do valor` : 'custa o rendimento'}.`)) return;
    const err = INV.apply(G.S, k, amt, worth(), Live.now()); if (err) return say(err[0].toUpperCase() + err.slice(1), true);
    note(`investimento: aplicação no ${P.name}`, -amt); say(`${brl(amt)} aplicados no ${P.name}.`); save(); G.render?.(); return;
  }
  const o = e.target.closest('[data-inv-out]');
  if (o) {
    const i = (G.S.invest || []).find(x => x.id === o.dataset.invOut); if (!i) return;
    const P = INV.PRODUCTS[i.kind];
    if (P.months && !confirm(`Sair do ${P.name} antes do prazo? Você recebe ${brl(INV.earlyValue(i))} e perde ${brl(i.amt + (i.acc || 0) - INV.earlyValue(i))}.`)) return;
    const r = INV.withdraw(G.S, i.id); if (r.err) return say(r.err, true);
    note(`resgate de investimento: ${r.name}${r.loss > 0 ? ' (antes do prazo)' : ''}`, r.value); say(`${brl(r.value)} de volta na conta.`); save(); G.render?.();
  }
});

// ---------- lançamento: TV 21, avisos e página inicial (por 3 dias reais) ----------
export const LAUNCH = { from: Date.UTC(2026, 10, 21, 20), until: Date.UTC(2026, 10, 24, 20) };
export const launching = () => Date.now() >= LAUNCH.from && Date.now() < LAUNCH.until;
function announce() {
  if (!launching()) return;
  TV.push({ id: 'lanc-invest', kind: 'economia', text: '🏦 Novidade no mundo: o Banco 21 lança investimentos. Poupança, CDB, LCA Agro, Tesouro 21 e Previdência: quanto mais tempo o dinheiro fica, mais rende. Os prazos são longos. Veja na aba banco.', at: Date.now() - 60000 });
  let seen = false; try { seen = localStorage.getItem('21world.lancInvest') === '1'; } catch {}
  if (!seen) { feed({ txt: '🏦 Novidade: investimentos no Banco 21 (Poupança, CDB, LCA, Tesouro 21, Previdência). Veja na aba banco.', imp: true }); try { localStorage.setItem('21world.lancInvest', '1'); } catch {} }
}
setTimeout(announce, 7000);
