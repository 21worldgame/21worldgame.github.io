// Pix 21: mandar dinheiro ou pagar outro jogador pelo inventário (supabase/pix.sql).
// Quem envia paga na hora; quem recebe ganha quando abrir o jogo (de 15 em 15 s enquanto joga), uma vez só.
import * as Auth from './auth.js';
import { G, brl, esc, say, note, save, profileOf } from './store.js';

const box = () => document.getElementById('pix');
let to = null, kind = 'pix', found = [], hist = [], off = false, sending = false, qTimer = 0;
const money = v => Math.floor(Number(String(v).replace(/\D/g, '')) || 0);

async function search(q) {
  const sb = Auth.sbClient(), me = Auth.account()?.id; if (!sb || !me || q.length < 2) { found = []; return paintFound(); }
  const { data } = await sb.from('public_profiles').select('user_id, name, rank').ilike('name', `%${q.replace(/[%_\\]/g, m => `\\${m}`)}%`).neq('user_id', me).order('worth', { ascending: false }).limit(6);
  found = data || []; paintFound();
}
function paintFound() {
  const ul = document.getElementById('pix-found'); if (!ul) return;
  ul.innerHTML = found.map(p => `<li><button type="button" class="pix-who" data-pix="pick" data-id="${esc(p.user_id)}" data-name="${esc(p.name)}"><b>${esc(p.name)}</b><small>${esc(p.rank || '')}</small></button></li>`).join('');
  ul.hidden = !found.length;
}
async function loadHist() {
  const sb = Auth.sbClient(), me = Auth.account()?.id; if (!sb || !me) return;
  const { data, error } = await sb.from('pix').select('id, from_id, from_name, to_name, amount, memo, kind, at').or(`from_id.eq.${me},to_id.eq.${me}`).order('at', { ascending: false }).limit(20);
  if (error) { off = /pix/i.test(error.message || '') && /exist|relation|schema/i.test(error.message || ''); return render(); }
  off = false; hist = data.map(r => ({ ...r, out: r.from_id === me })); render();
}
// recebe o que chegou (uma vez só: o servidor marca como creditado)
export async function claim() {
  const sb = Auth.sbClient(); if (!sb || !Auth.account() || off) return;
  const { data, error } = await sb.rpc('claim_pix'); if (error || !data?.length) return;
  for (const r of data) {
    const v = Number(r.amount) || 0; G.S.money += v;
    note(`${r.kind === 'pagamento' ? 'pagamento recebido' : 'Pix recebido'} de ${r.from_name || 'jogador'}${r.memo ? `: ${r.memo}` : ''}`, v);
    say(`${r.kind === 'pagamento' ? 'Pagamento' : 'Pix'} de ${brl(v)} recebido de ${r.from_name || 'jogador'}${r.memo ? ` (${r.memo})` : ''}!`);
  }
  save(); G.render?.(); loadHist();
}
async function send() {
  if (sending) return;
  const v = money(document.getElementById('pix-v')?.value), memo = (document.getElementById('pix-m')?.value || '').trim().slice(0, 80);
  if (!to) return say('Escolha para quem vai mandar.', true);
  if (v < 1) return say('Digite o valor.', true);
  if (kind === 'pagamento' && !memo) return say('Diga o que está pagando (ex.: 30 bois gordos).', true);
  if (v > G.S.money) return say(`Você só tem ${brl(G.S.money)} em dinheiro.`, true);
  if (!confirm(`${kind === 'pagamento' ? 'Pagar' : 'Mandar Pix de'} ${brl(v)} para ${to.name}?${memo ? `\n"${memo}"` : ''}\n\nO dinheiro sai agora e não volta.`)) return;
  sending = true; paintBtn();
  try {
    const { data, error } = await Auth.sbClient().rpc('send_pix', { p_to: to.id, p_amount: v, p_name: profileOf().name, p_memo: memo, p_kind: kind });
    if (error || data !== 'ok') return say({ nouser: 'Esse jogador não existe mais.', self: 'Não dá para mandar para você mesmo.', worth: 'O valor passa do seu patrimônio.', limit: 'Muitos envios em pouco tempo: espere um pouco.', invalid: 'Valor inválido.', login: 'Entre na sua conta para usar o Pix.' }[data] || 'Não foi possível enviar agora. Tente de novo.', true);
    G.S.money -= v; note(`${kind === 'pagamento' ? 'pagamento' : 'Pix'} para ${to.name}${memo ? `: ${memo}` : ''}`, -v); save();
    say(`${kind === 'pagamento' ? 'Pagamento' : 'Pix'} de ${brl(v)} enviado para ${to.name}.`);
    for (const id of ['pix-v', 'pix-m']) { const i = document.getElementById(id); if (i) i.value = ''; }
    to = null; G.render?.(); render(); loadHist();
  } finally { sending = false; paintBtn(); }
}
const paintBtn = () => { const b = document.getElementById('pix-go'); if (b) { b.disabled = sending; b.textContent = sending ? 'enviando…' : kind === 'pagamento' ? 'pagar' : 'enviar Pix'; } };

export function render() {
  const el = box(); if (!el) return;
  if (!Auth.account()) { el.innerHTML = '<div class="pix__h"><h3>Pix 21</h3></div><p class="small muted">Entre na sua conta para mandar Pix e pagar outros jogadores.</p>'; return; }
  if (off) { el.innerHTML = '<div class="pix__h"><h3>Pix 21</h3></div><p class="small muted">O Pix entre jogadores está chegando. Volte daqui a pouco.</p>'; return; }
  const keep = { v: document.getElementById('pix-v')?.value || '', m: document.getElementById('pix-m')?.value || '' };
  el.innerHTML = `<div class="pix__h"><h3>Pix 21</h3><span class="small muted">saldo <b>${brl(G.S.money)}</b></span></div>
    <div class="pix__kind" role="group" aria-label="tipo"><button type="button" class="btn btn--sm ${kind === 'pix' ? 'btn--gold' : 'btn--glass'}" data-pix="kind" data-id="pix" aria-pressed="${kind === 'pix'}">fazer Pix</button><button type="button" class="btn btn--sm ${kind === 'pagamento' ? 'btn--gold' : 'btn--glass'}" data-pix="kind" data-id="pagamento" aria-pressed="${kind === 'pagamento'}">pagar jogador</button></div>
    <label class="field"><span>para quem</span>${to ? `<span class="pix-to"><b>${esc(to.name)}</b><button type="button" class="btn btn--glass btn--sm" data-pix="clear">trocar</button></span>`
      : '<input class="input" id="pix-q" type="search" placeholder="nome do jogador" autocomplete="off" maxlength="18">'}</label>
    <ul class="pix-found" id="pix-found" hidden></ul>
    <label class="field"><span>valor (R$)</span><input class="input" id="pix-v" inputmode="numeric" placeholder="0" value="${esc(keep.v)}"></label>
    <div class="pix__quick">${[1000, 10000, 100000, 1000000].map(x => `<button type="button" class="btn btn--glass btn--sm" data-pix="add" data-id="${x}">+${brl(x).replace(/\s/g, ' ')}</button>`).join('')}</div>
    <label class="field"><span>${kind === 'pagamento' ? 'o que está pagando' : 'mensagem (opcional)'}</span><input class="input" id="pix-m" maxlength="80" placeholder="${kind === 'pagamento' ? 'ex.: 30 bois gordos' : 'ex.: valeu pela ajuda'}" value="${esc(keep.m)}"></label>
    <button type="button" class="btn btn--gold" id="pix-go" data-pix="send">${kind === 'pagamento' ? 'pagar' : 'enviar Pix'}</button>
    <p class="small muted">Cai na conta do jogador na hora, mesmo se ele estiver desligado (recebe quando abrir o jogo). Não dá para desfazer.</p>
    ${hist.length ? `<details class="pix-hist"><summary>extrato (${hist.length})</summary><ul>${hist.map(r => `<li><span><b>${r.out ? `para ${esc(r.to_name)}` : `de ${esc(r.from_name)}`}</b><small>${r.kind === 'pagamento' ? 'pagamento' : 'Pix'}${r.memo ? ` · ${esc(r.memo)}` : ''} · ${new Date(r.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span><b class="${r.out ? 'bad' : 'good'}">${r.out ? '−' : '+'}${brl(r.amount)}</b></li>`).join('')}</ul></details>` : ''}`;
}

document.addEventListener('input', e => {
  if (e.target.id === 'pix-q') { clearTimeout(qTimer); const q = e.target.value.trim(); qTimer = setTimeout(() => search(q), 300); }
  if (e.target.id === 'pix-v') { const v = money(e.target.value); e.target.value = v ? v.toLocaleString('pt-BR') : ''; }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pix]'); if (!b) return;
  const a = b.dataset.pix;
  if (a === 'kind') { kind = b.dataset.id; render(); }
  if (a === 'pick') { to = { id: b.dataset.id, name: b.dataset.name }; found = []; render(); document.getElementById('pix-v')?.focus(); }
  if (a === 'clear') { to = null; render(); document.getElementById('pix-q')?.focus(); }
  if (a === 'add') { const i = document.getElementById('pix-v'), v = money(i.value) + Number(b.dataset.id); i.value = v.toLocaleString('pt-BR'); }
  if (a === 'send') send();
});
// abre o inventário: atualiza saldo e extrato
document.addEventListener('click', e => { if (e.target.closest('[data-tab="inventario"], [data-tab-go="inventario"]')) setTimeout(() => { render(); loadHist(); }, 50); });
setInterval(claim, 15000);
setTimeout(() => { render(); loadHist(); claim(); }, 4000);
