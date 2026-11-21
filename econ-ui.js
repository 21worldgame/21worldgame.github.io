// Economia do mundo na tela: notícias na TV 21, plantão com a repórter nos momentos importantes, relatório do mercado
// e o sinal de alerta (🟢 🟡 🟠 🔴). As regras ficam em econ.js; aqui só mostra.
import * as EC from './econ.js';
import * as TV from './news-ui.js';
import { avatarSVG } from './avatar.js';
import { G, $, esc, feed } from './store.js';

const REPORTER = 'Retana Rater';
const seenKey = '21world.econSeen';
const seenGet = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')); } catch { return new Set(); } };
const seenAdd = id => { try { const s = [...seenGet(), id].slice(-80); localStorage.setItem(seenKey, JSON.stringify(s)); } catch {} };
const month = () => G.S?.month || 1;
export const now = () => EC.state(month());
const pct = v => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;

// ---------- sinal de alerta ----------
export function levelChip(st = now()) { const [ic, txt] = EC.LEVELS[st.level]; return `<button type="button" class="econ-chip econ-chip--${st.level}" data-econ-open title="relatório do mercado">${ic} ${txt}</button>`; }
function paintChips() { const st = now(); for (const el of document.querySelectorAll('[data-econ-chip]')) el.innerHTML = levelChip(st); }

// ---------- notícias: cada fase de evento vira manchete; relatório do mercado a cada ~20 min ----------
let lastReport = 0, lastFlash = 0;
function tick() {
  if (!G.S) return;
  const st = now(), seen = seenGet();
  for (const e of st.events) {
    const id = `${e.id}:${e.phase}`, hd = EC.headline(e);
    TV.push({ id, kind: e.phase === 'aviso' || e.phase === 'risco' ? 'alerta' : 'economia', text: `${hd.icon} ${hd.lead}`, at: Date.now() - (seen.has(id) ? 600000 : 0) });
    if (!seen.has(id)) {
      seenAdd(id);
      feed({ txt: `${hd.icon} ${hd.title}: ${hd.level}`, imp: e.phase !== 'fim' });
      if ((e.phase === 'risco' || e.phase === 'crise') && Date.now() - lastFlash > 600000) { lastFlash = Date.now(); flash(e); }
    }
  }
  const slot = Math.floor(Date.now() / 1200000);
  if (slot !== lastReport) {
    lastReport = slot;
    const t = EC.tips(month());
    if (t.length) TV.push({ id: `rel-${slot}`, kind: 'economia', text: `Relatório do mercado: ${t[0]}`, at: Date.now() });
  }
  paintChips();
}

// ---------- plantão: a repórter entra na tela (só risco elevado e crise, no máximo um a cada 10 min, nunca no meio de jogada) ----------
function flash(e) {
  const go = () => {
    if (G.busy?.()) return setTimeout(go, 15000);
    const hd = EC.headline(e), d = $('#dlg-econ-flash'); if (!d) return;
    d.innerHTML = `<div class="ef__set"><div class="ef__studio" aria-hidden="true"><i></i><i></i><i></i></div><span class="ef__logo" aria-hidden="true">TV<b>21</b></span>
        <span class="ef__live"><i class="tv__dot" aria-hidden="true"></i>PLANTÃO</span>
        <div class="ef__anchor" aria-hidden="true">${avatarSVG(TV.LOOKS[REPORTER] || {}, { label: REPORTER })}</div>
        <div class="ef__lower"><span class="ef__kick ef__kick--${e.phase}">${hd.icon} ${hd.level.toUpperCase()} · ${esc(hd.cat)}</span><b>${esc(hd.title)}</b></div></div>
      <div class="ef__body"><p><b>${REPORTER}:</b> “${esc(hd.lead)}”</p>
        <p class="small"><b>O que dá para fazer:</b></p><ul>${hd.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="muted small">É informação do mercado, não garantia. ${e.phase === 'risco' ? 'Ainda dá tempo de se preparar.' : 'O efeito entra aos poucos e passa com o tempo.'}</p>
        <form method="dialog" class="ef__acts"><button class="btn btn--glass" value="ok">entendi</button><button class="btn btn--gold" type="button" data-econ-open>ver relatório do mercado</button></form></div>`;
    d.showModal();
  };
  go();
}

// ---------- relatório do mercado ----------
export function reportHTML() {
  const st = now(), [ic, txt] = EC.LEVELS[st.level];
  const evs = st.events.map(e => { const hd = EC.headline(e); return `<li class="er-ev er-ev--${e.phase}"><b>${hd.icon} ${esc(hd.title)}</b><span class="small">${esc(hd.level)} · ${esc(hd.cat)}</span><p class="small">${esc(hd.lead)}</p></li>`; }).join('');
  const goods = EC.GOODS.map(g => { const p = st.pressure[g], v = st.price[g] || 1; return `<tr><td>${EC.LABEL[g]}</td><td><span class="er-bar"><i style="width:${Math.min(100, p * 50)}%" class="${p >= 1.25 ? 'is-hi' : p <= 0.85 ? 'is-lo' : ''}"></i></span><small>${p >= 1.25 ? 'saturado' : p <= 0.85 ? 'em falta' : 'normal'}</small></td><td class="num ${v >= 1.03 ? 'good' : v <= 0.97 ? 'bad' : ''}">${pct(v)}</td></tr>`; }).join('');
  const sec = Object.entries(st.sector).map(([c, v]) => `<li>${EC.SECTOR_TXT[c] || c}: <b class="${v >= 1 ? 'good' : 'bad'}">${pct(v)}</b> na demanda</li>`).join('');
  const tips = EC.tips(month()).map(t => `<li>${esc(t)}</li>`).join('');
  return `<p class="econ-level econ-level--${st.level}">${ic} <b>${txt}</b></p>
    ${evs ? `<h4>acontecendo no mercado</h4><ul class="er-evs">${evs}</ul>` : '<p class="muted small">Nenhuma crise ou evento à vista. Os avisos aparecem aqui antes de qualquer crise chegar.</p>'}
    <h4>oferta de cada produto <small class="muted">(quanto o mundo está produzindo) e preço de referência</small></h4>
    <table class="er-tab"><tbody>${goods}</tbody></table>
    ${sec ? `<h4>empresas</h4><ul class="small">${sec}</ul>` : ''}
    ${tips ? `<h4>recomendações</h4><ul class="small">${tips}</ul>` : ''}
    <p class="muted small">Quando muita gente vai para o mesmo produto, a oferta sobe e o preço cai; quando poucos produzem, o preço sobe. Recomendações não garantem lucro.</p>`;
}
function openReport() {
  const d = $('#dlg-econ'); if (!d) return;
  $('#econ-body').innerHTML = reportHTML();
  $('#dlg-econ-flash')?.open && $('#dlg-econ-flash').close();
  if (!d.open) d.showModal();
}
G.openEcon = openReport;
document.addEventListener('click', e => { if (e.target.closest('[data-econ-open]')) openReport(); });
setTimeout(tick, 6000); setInterval(tick, 30000);
