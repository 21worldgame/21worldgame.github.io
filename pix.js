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
// recebe o que chegou, em 2 passos para não perder dinheiro com a sincronização entre aparelhos:
// 1) credita e anota o id no save (s.pixGot); 2) só depois que esse save subiu, o servidor marca como recebido (ack_pix).
// Se outro aparelho gravar antes e este adotar o save de lá, o id some junto com o crédito e o Pix é creditado de novo.
let claiming = false;
export async function claim() {
  const sb = Auth.sbClient(); if (!sb || !Auth.account() || off || claiming || sending || document.visibilityState !== 'visible' || G.busy?.()) return;
  claiming = true;
  try {
    const { data, error } = await sb.from('pix').select('id, from_name, amount, memo, kind').eq('to_id', Auth.account().id).eq('claimed', false).order('id').limit(50);
    if (error) return;
    const got = new Set((G.S.pixGot ||= []));
    const fresh = data.filter(r => !got.has(r.id));
    for (const r of fresh) {
      const v = Number(r.amount) || 0; G.S.money += v; G.S.pixGot.push(r.id);
      note(`${r.kind === 'pagamento' ? 'pagamento recebido' : 'Pix recebido'} de ${r.from_name || 'jogador'}${r.memo ? `: ${r.memo}` : ''}`, v);
      say(`${r.kind === 'pagamento' ? 'Pagamento' : 'Pix'} de ${brl(v)} recebido de ${r.from_name || 'jogador'}${r.memo ? ` (${r.memo})` : ''}!`);
    }
    // envios das últimas 2 h que estão no servidor mas não no save (o save com o desconto foi trocado pelo de outro aparelho)
    const since = new Date(Date.now() - 7200000).toISOString(), out = new Set((G.S.pixOut ||= []));
    const sent = await sb.from('pix').select('id, to_name, amount, memo, kind').eq('from_id', Auth.account().id).gt('at', since).order('id');
    for (const r of sent.error ? [] : sent.data.filter(r => !out.has(r.id))) {
      const v = Number(r.amount) || 0; G.S.money -= v; G.S.pixOut.push(r.id); fresh.push(r);
      note(`${r.kind === 'pagamento' ? 'pagamento' : 'Pix'} para ${r.to_name || 'jogador'}${r.memo ? `: ${r.memo}` : ''}`, -v);
    }
    G.S.pixOut = G.S.pixOut.slice(-300);
    if (fresh.length) { save(); G.render?.(); }
    if (!G.S.pixGot.length) return;
    if (!(await Auth.push().catch(() => false))) return;                       // o crédito ainda não está na nuvem: confirma na próxima volta
    const ids = [...G.S.pixGot];
    const ack = await sb.rpc('ack_pix', { p_ids: ids });
    if (ack.error) return;
    G.S.pixGot = G.S.pixGot.filter(id => !ids.includes(id)); save();         // confirmado no servidor: não precisa mais lembrar
    if (fresh.length) loadHist();
  } finally { claiming = false; }
}
async function send() {
  if (sending) return;
  const v = money(document.getElementById('pix-v')?.value), memo = (document.getElementById('pix-m')?.value || '').trim().slice(0, 80);
  if (!to) return say('Escolha para quem vai mandar.', true);
  if (v < 1) return say('Digite o valor.', true);
  if (kind === 'pagamento' && !memo) return say('Diga o que está pagando (ex.: 30 bois gordos).', true);
  if (v > G.S.money) return say(`Você só tem ${brl(G.S.money)} em dinheiro.`, true);
  if (!confirm(`${kind === 'pagamento' ? 'Pagar' : 'Mandar Pix de'} ${brl(v)} para ${to.name}?${memo ? `\n"${memo}"` : ''}\n\nO dinheiro sai agora e não volta.`)) return;
  while (claiming) await new Promise(ok => setTimeout(ok, 100));   // não envia no meio da conferência (desconto em dobro)
  if (sending) return;
  sending = true; paintBtn();
  try {
    const { data, error } = await Auth.sbClient().rpc('send_pix', { p_to: to.id, p_amount: v, p_name: profileOf().name, p_memo: memo, p_kind: kind });
    const sid = Number(String(data || '').match(/^ok:(\d+)$/)?.[1]) || 0;
    if (error || !sid) return say({ nouser: 'Esse jogador não existe mais.', self: 'Não dá para mandar para você mesmo.', worth: 'O valor passa do seu patrimônio.', limit: 'Muitos envios em pouco tempo: espere um pouco.', invalid: 'Valor inválido.', login: 'Entre na sua conta para usar o Pix.' }[data] || 'Não foi possível enviar agora. Tente de novo.', true);
    G.S.money -= v; (G.S.pixOut ||= []).push(sid); G.S.pixOut = G.S.pixOut.slice(-300);   // o id vai no save: se o desconto se perder na sincronização, reconcile() desconta de novo
    note(`${kind === 'pagamento' ? 'pagamento' : 'Pix'} para ${to.name}${memo ? `: ${memo}` : ''}`, -v); save();
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
  const ae = document.activeElement, fid = el.contains(ae) ? ae.id : '', q = document.getElementById('pix-q')?.value || '', sel = fid ? [ae.selectionStart, ae.selectionEnd] : null;   // redesenhar não tira o foco de quem está digitando
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
  const qi = document.getElementById('pix-q'); if (qi && q) qi.value = q;
  const fi = fid && document.getElementById(fid); if (fi) { fi.focus(); try { if (sel) fi.setSelectionRange(...sel); } catch {} }
  paintFound();
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
