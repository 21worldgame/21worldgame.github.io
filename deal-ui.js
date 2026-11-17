// Janela de negociação com bot: você oferece, o bot aceita, contrapropõe ou desiste.
import { $, esc, brl } from './store.js';
import { haggle } from './bots.js';
import * as sfx from './sfx.js';

let cur = null;
export function openDeal({ title, sub, who, deal, onDone }) {
  cur = { deal, onDone };
  const d = $('#dlg-deal');
  $('#dl2-title').textContent = title;
  $('#dl2-sub').textContent = sub || '';
  $('#dl2-feed').innerHTML = `<li class="bot"><b>${esc(who)}:</b> ${deal.side === 'sell' ? `Peço ${brl(deal.ask)}.` : `Pago ${brl(deal.ask)}.`}</li>`;
  $('#dl2-amt').value = deal.ask;
  $('#dl2-form').hidden = false;
  cur.who = who;
  if (!d.open) d.showModal();
  $('#dl2-amt').focus();
}
function line(html, cls) { $('#dl2-feed').insertAdjacentHTML('beforeend', `<li class="${cls}">${html}</li>`); $('#dl2-feed').lastElementChild.scrollIntoView({ block: 'nearest' }); }
function offer(e) {
  e.preventDefault();
  if (!cur?.deal.open) return;
  const v = Math.round(Number($('#dl2-amt').value) || 0);
  if (v <= 0) return;
  line(`<b>você:</b> ${brl(v)}`, 'me');
  const r = haggle(cur.deal, v);
  if (r.result === 'accept') { line(`<b>${esc(cur.who)}:</b> Fechado em ${brl(r.price)}! 🤝`, 'bot good'); sfx.play('stack', 0.6); finish(r.price); }
  else if (r.result === 'counter') { line(`<b>${esc(cur.who)}:</b> Não dá. Faço por ${brl(r.price)}.`, 'bot'); $('#dl2-amt').value = r.price; sfx.play('chip', 0.4); }
  else { line(`<b>${esc(cur.who)}:</b> Assim não tem conversa. Negócio encerrado.`, 'bot bad'); finish(null); }
}
// aceitar o último preço do bot na hora
function take() { if (!cur?.deal.open) return; cur.deal.open = false; line(`<b>você:</b> aceito ${brl(cur.deal.ask)}`, 'me'); finish(cur.deal.ask); }
function finish(price) {
  $('#dl2-form').hidden = true;
  const done = cur.onDone; cur = { deal: { open: false } };
  setTimeout(() => { $('#dlg-deal').close(); done?.(price); }, price ? 900 : 1400);
}
document.getElementById('dl2-form')?.addEventListener('submit', offer);
document.getElementById('dl2-take')?.addEventListener('click', take);
