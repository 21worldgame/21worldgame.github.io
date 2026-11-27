// Mesa Profissional (aba investimentos): BTC real da Coinbase, ranking de traders e copy trade.
// Regras e dinheiro no servidor (supabase/copy-trade.sql): entrada = preço real na hora; resultado = fechamento real do minuto
// em que vence; o servidor liquida sozinho a cada minuto. Ninguém prevê o resultado (o trader antigo usa uma conta fixa no código).
// Copy só com contrato ATIVO com um profissional "Trader" na Central de Profissionais.
// Dinheiro: depósito sai do save na hora (id em trOut); saque e fim de copy chegam pela fila da Central (pro-ui.js sync).
import * as Auth from './auth.js';
import { G, brl, esc, say, note, save } from './store.js';
import { sync as proSync, openPro } from './pro-ui.js';

const sb = () => Auth.sbClient(), me = () => Auth.account()?.id;
const CB = 'https://api.exchange.coinbase.com/products/BTC-USD';
const PAY = { 1: 1.55, 5: 1.65, 10: 1.72 };   // v285 (igual ao servidor); acerto só conta se andar mais de 0,02% (spread)
const MSG = { login: 'Entre na sua conta.', banned: 'Conta bloqueada.', min: 'Valor abaixo do mínimo.', max: 'Máximo de R$ 500 mil por operação.',
  saldo: 'Saldo insuficiente na mesa. Deposite primeiro.', abertas: 'Você já tem 5 operações abertas.', rapido: 'Aguarde 5 segundos entre operações.',
  preco: 'A cotação real não respondeu agora. Tente de novo em instantes.', args: 'Operação inválida.', worth: 'Valor maior que o seu patrimônio.',
  limit: 'Muitas movimentações seguidas. Aguarde um minuto.', fee: 'A comissão vai de 5% a 20%.', notrader: 'Este jogador não oferece serviço de Trader na Central.',
  nocontract: 'O copy só é liberado depois de contratar um serviço deste trader na Central de Profissionais (contrato ativo).', self: 'Você não pode copiar a si mesmo.',
  mincopy: 'O copy começa em R$ 10 mil.', maxcopy: 'Máximo de R$ 50 milhões por copy.', stop: 'O stop vai de 5% a 95%.', nocopy: 'Copy não encontrado.',
  encerrando: 'Seu copy anterior com este trader ainda está fechando a última operação.' };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const usd = v => `US$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
let acct = null, trades = [], copies = [], rank = [], rankAt = 0, spot = 0, spot0 = 0, series = [], seriesAt = 0, busy = false, ready = false;

// ---------- dados ----------
async function rpc(fn, args) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) { say(`Não deu certo: ${error.message}`, true); return null; }
  const r = String(data ?? ''); if (!r.startsWith('ok')) { say(MSG[r] || `Não deu certo (${r}).`, true); return null; }
  return r;
}
async function load() {
  if (!sb() || !me()) return;
  const [a, t, c] = await Promise.all([
    sb().from('tr_accounts').select('bal, fee_pct').eq('user_id', me()).maybeSingle(),
    sb().from('tr_trades').select('id, copy_id, side, minutes, stake, pay, entry, final, opened_at, exp, status, back').eq('user_id', me()).order('id', { ascending: false }).limit(30),
    sb().from('tr_copies').select('*').or(`follower.eq.${me()},leader.eq.${me()}`).order('id', { ascending: false }).limit(40)]);
  acct = a.data || { bal: 0, fee_pct: 10 }; trades = t.data || []; copies = c.data || [];
  reconcile();
}
export async function loadRank(force = false) {
  if (!sb() || (!force && Date.now() - rankAt < 60000)) return rank;
  const { data } = await sb().rpc('tr_ranking'); rank = data || []; rankAt = Date.now(); return rank;
}
// depósito que está no servidor e não no save (o save com o desconto foi trocado pelo de outro aparelho): desconta agora
async function reconcile() {
  const since = new Date(Date.now() - 72e5).toISOString();
  const { data } = await sb().from('tr_moves').select('id, amount, memo').eq('user_id', me()).eq('kind', 'deposito').gt('at', since);
  const out = new Set(G.S.trOut ||= []); let ch = false;
  for (const r of data || []) if (!out.has(r.id)) { G.S.money -= Number(r.amount); G.S.trOut.push(r.id); note(r.memo, -Number(r.amount)); ch = true; }
  G.S.trOut = G.S.trOut.slice(-200); if (ch) { save(); G.render?.(); }
}
// cotação real (direto da Coinbase: não gasta a cota do servidor do jogo)
async function price() {
  try {
    const r = await fetch(`${CB}/ticker`, { cache: 'no-store' }); if (r.ok) { spot = Number((await r.json()).price) || spot; }
    if (Date.now() - seriesAt > 30000 || (Math.floor(Date.now() / 6e4) !== Math.floor(seriesAt / 6e4) && Date.now() % 6e4 > 4000)) { const c = await fetch(`${CB}/candles?granularity=60`, { cache: 'no-store' }); if (c.ok) { series = (await c.json()).reverse().map(x => ({ t: x[0] * 1000, l: x[1], h: x[2], o: x[3], c: x[4] })); spot0 = series.at(-60)?.c || series[0]?.c || 0; seriesAt = Date.now(); } }
  } catch {}
}

// ---------- integração com a mesa de cima (trader.js): "BTC real" é um ativo da lista ----------
export const REAL = 'real';
export const spotNow = () => spot;
export const change1h = () => (spot && spot0 ? spot / spot0 - 1 : 0);
export const fmt = v => usd(v);
export const ready1 = () => series.length > 1;
export const openLines = () => trades.filter(t => t.status === 'aberta' && !t.copy_id).map(t => ({ side: t.side, entry: Number(t.entry), exp: Date.parse(t.exp) }));
// velas de tf minutos montadas com as velas reais de 1 min (a última recebe a cotação de agora)
export function candles(tf = 1, count = 60) {
  if (!series.length) return [];
  const out = []; for (const x of series) { const k = Math.floor(x.t / (tf * 6e4)) * tf * 6e4, l = out.at(-1);
    if (l && l.t === k) { l.h = Math.max(l.h, x.h); l.l = Math.min(l.l, x.l); l.c = x.c; } else out.push({ t: k, o: x.o, h: x.h, l: x.l, c: x.c }); }
  const cur = Math.floor(Date.now() / (tf * 6e4)) * tf * 6e4;   // virou o minuto: a vela anterior fecha e nasce a nova
  if (spot && out.length && out.at(-1).t < cur) { const p = out.at(-1).c; out.push({ t: cur, o: p, h: Math.max(p, spot), l: Math.min(p, spot), c: spot }); }
  const last = out.at(-1); if (spot && last) { last.c = spot; last.h = Math.max(last.h, spot); last.l = Math.min(last.l, spot); }
  return out.slice(-count);
}
export const sizeHTML = (amt, dur) => `Acertou em ${dur} min: recebe <b class="good">${brl(Math.floor(amt * PAY[dur]))}</b> (${String(PAY[dur]).replace('.', ',')}x). Preço <b>real</b> do Bitcoin (Coinbase): a entrada é a cotação no clique e a operação vence no <b>fechamento de uma vela de 1 minuto</b> (entre ${dur} e ${dur + 1} min), com o preço real desse fechamento. Acerto conta se o preço andar mais de 0,02% para o seu lado; andou menos que isso para qualquer lado, é <b>empate e o valor volta</b>. Sai do <b>saldo da mesa</b> (deposite abaixo). De R$ 100 a R$ 500 mil por operação.`;
export const posHTML = () => openList();
export const histHTML = () => { const d = trades.filter(t => t.status !== 'aberta' && !t.copy_id).slice(0, 15); return d.length ? d.map(row).join('') : '<li class="muted small">Sem operações encerradas.</li>'; };
export function acctHTML() {
  const isTrader = rank.find(r => r.user_id === me())?.is_trader, followers = copies.filter(c => c.leader === me() && c.status === 'ativo');
  return `<p class="mesa-bal">saldo da mesa <b>${brl(acct?.bal || 0)}</b></p>
    <div class="pro-row"><input class="input pro-grow" id="mesa-dep" type="number" min="1000" step="1000" placeholder="valor (R$)" inputmode="numeric" aria-label="valor para depositar ou sacar">
      <button type="button" class="btn btn--gold btn--sm" data-mesa="dep">depositar</button><button type="button" class="btn btn--glass btn--sm" data-mesa="wd">sacar</button></div>
    <p class="small muted">Depósito sai da carteira na hora; saque volta em até 3 min.</p>
    ${followers.length ? `<p class="small"><b>${followers.length} seguidor(es)</b> copiam você (${brl(followers.reduce((t, c) => t + Number(c.bal), 0))}): cada operação sua é repetida na mesma proporção.</p>` : ''}
    ${isTrader || followers.length ? `<label class="field"><span>sua comissão sobre o lucro de quem copia</span><select class="input" id="mesa-fee">${[5, 10, 15, 20].map(v => `<option value="${v}"${Number(acct?.fee_pct) === v ? ' selected' : ''}>${v}%</option>`).join('')}</select></label>` : ''}`;
}
export async function openReal(side, stake, dur) {
  await act(async () => {
    const r = await rpc('tr_open', { p_side: side > 0 ? 1 : -1, p_minutes: dur, p_stake: Math.floor(Number(stake) || 0) }); if (!r) return;
    const [, , px, n] = r.split(':');
    say(`Valendo! BTC em ${usd(px)}. Se ${side > 0 ? 'subir' : 'descer'} em ${dur} min, você recebe ${brl(Math.floor(stake * PAY[dur]))}.${Number(n) ? ` ${n} seguidor(es) copiaram.` : ''}`);
    await load(); paintAcct(); });
}
const paintAcct = () => { const h = document.getElementById('mesa-acct'); if (h && !h.hidden && !h.contains(document.activeElement)) h.innerHTML = acctHTML(); };
// lateral da mesa: ranking de traders (acertos e %) + meus copies
const win = t => t.side * (spot - t.entry) / t.entry > 0.0002;   // igual ao servidor: precisa andar mais de 0,02%
const tie = t => Math.abs(spot - t.entry) / t.entry <= 0.0002;   // praticamente parado: empate, devolve
function row(t) {
  const exp = Date.parse(t.exp), left = Math.max(0, Math.ceil((exp - Date.now()) / 1000)), tag = t.side > 0 ? '▲ sobe' : '▼ desce';
  if (t.status === 'aberta') return `<li class="tr-p"><div><strong class="${t.side > 0 ? 'good' : 'bad'}">${tag} BTC real</strong><span class="muted small">entrada ${usd(t.entry)}${spot ? `, agora ${usd(spot)}` : ''}</span></div>
    <div class="tr-pl ${spot && win(t) ? 'good' : spot && tie(t) ? 'gold' : 'bad'}">${spot && win(t) ? 'ganhando' : spot && tie(t) ? 'empate: devolve se fechar assim' : 'perdendo'}<small>${brl(t.stake)} em jogo</small></div>
    <div class="tr-timer"><b>${left ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '…'}</b><small>${left ? 'vence no fechamento do minuto' : 'conferindo o fechamento…'}</small></div></li>`;
  const won = t.status === 'ganhou';
  return `<li><span>${tag} BTC real ${t.minutes} min</span><span class="${won ? 'good' : t.status === 'devolvida' ? 'muted' : 'bad'}">${won ? '+' + brl(t.back - t.stake) : t.status === 'devolvida' ? (t.final ? 'empate: devolvido' : 'devolvida') : '−' + brl(t.stake)}</span></li>`;
}
function sideHTML() {
  const list = rank.filter(r => r.ops >= 5).slice(0, 15), mine = copies.filter(c => c.follower === me() && c.status !== 'encerrado');
  return `<h3>ranking de traders <small class="muted">30 dias · BTC real</small></h3>
    <p class="mesa-note small">📌 Copie um trader e as operações dele entram sozinhas na sua conta. <b>O copy só é liberado depois de contratar o serviço dele em Profissionais.</b></p>
    ${list.length ? `<ol class="mesa-rk">${list.map((r, i) => `<li><span class="mesa-rk__n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
      <div class="mesa-rk__who"><b>${esc(r.name)}</b>${r.user_id === me() ? ' <small class="muted">(você)</small>' : ''}<small>${r.wins} de ${r.ops} acertos · <b>${pct(r.wins, r.ops)}</b>${r.copiers ? ` · ${r.copiers} copiando` : ''}</small></div>
      <div class="mesa-rk__v"><b class="${r.profit >= 0 ? 'good' : 'bad'}">${r.profit >= 0 ? '+' : ''}${brl(r.profit)}</b>
      ${r.is_trader && r.user_id !== me() ? `<button type="button" class="btn btn--gold btn--sm" data-mesa="pro" data-id="${esc(r.user_id)}" title="comissão de ${r.fee_pct}% sobre o lucro">copiar</button>` : r.user_id === me() ? '' : '<small class="muted">sem copy</small>'}</div></li>`).join('')}</ol>`
      : '<p class="small muted">O ranking aparece quando os jogadores fecharem 5 operações no BTC real.</p>'}
    <p class="small muted">Quer ser copiado? Crie seu perfil em Profissionais com a profissão "Trader" e um serviço. Você recebe de 5% a 20% do lucro de quem copia.</p>
    <h3>meus copies</h3>${mine.length ? mine.map(c => { const res = Number(c.bal) - Number(c.invested);
      return `<div class="mesa-cp"><div><b>${esc(c.leader_name)}</b><small>${c.status === 'ativo' ? `stop ${c.stop_pct}% · comissão ${c.fee_pct}%` : 'fechando a última operação'}</small></div>
        <div class="mesa-rk__v"><b>${brl(c.bal)}</b><small class="${res >= 0 ? 'good' : 'bad'}">${res >= 0 ? '+' : ''}${brl(res)}</small>${c.status === 'ativo' ? `<button type="button" class="btn btn--glass btn--sm" data-mesa="stop" data-id="${c.id}">parar</button>` : ''}</div></div>`; }).join('')
      : '<p class="small muted">Você ainda não copia ninguém.</p>'}`;
}
const paintSide = () => { const h = document.getElementById('mesa-side'); if (h) h.innerHTML = me() ? sideHTML() : '<p class="small muted">Entre na sua conta para ver o ranking de traders.</p>'; };
const visible = () => { const p = document.getElementById('p-trader'); return p && !p.hidden && document.visibilityState === 'visible'; };
const openList = () => { const o = trades.filter(t => t.status === 'aberta' && !t.copy_id); return o.length ? o.map(row).join('') : '<li class="muted small">Nenhuma operação em andamento.</li>'; };
// caixa de copy no perfil do Trader na Central (pro-ui.js)
export function copyHTML(p, hasContract) {
  if (!/trader/i.test(p.title || '') || p.user_id === me()) return '';
  const r = rank.find(x => x.user_id === p.user_id), cur = copies.find(c => c.follower === me() && c.leader === p.user_id && c.status === 'ativo');
  return `<section class="mesa-copy"><h3>📈 copy trade</h3>
    ${r ? `<div class="pro-stats">${[['operações (30 d)', r.ops], ['acertos', `${r.wins} (${pct(r.wins, r.ops)})`], ['lucro 30 d', brl(r.profit)], ['lucro 7 d', brl(r.profit7)], ['seguidores', r.copiers], ['comissão', `${r.fee_pct}% do lucro`]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`
      : '<p class="small muted">Ainda sem operações na Mesa Profissional nos últimos 30 dias.</p>'}
    ${hasContract ? `${cur ? `<p class="small good">Você já copia ${esc(p.name)} (${brl(cur.bal)} no copy). Pode pôr mais abaixo.</p>` : ''}<div class="pro-row">
        <label class="field"><span>valor do copy (mín. R$ 10 mil)</span><input class="input" id="mesa-cp-amt" type="number" min="10000" step="1000" value="10000" inputmode="numeric"></label>
        <label class="field"><span>stop (para se perder)</span><select class="input" id="mesa-cp-stop">${[10, 20, 30, 40, 50, 75].map(v => `<option value="${v}"${v === 40 ? ' selected' : ''}>${v}%</option>`).join('')}</select></label>
        <button type="button" class="btn btn--gold btn--sm" data-mesa="copy" data-id="${esc(p.user_id)}">copiar ${esc(p.name)}</button></div>`
      : `<p class="pro-warn">O copy só é liberado depois de contratar um serviço de ${esc(p.name)} aqui na Central. Contrate abaixo e o botão <b>copiar</b> aparece.</p>`}</section>`;
}

// ---------- ações ----------
async function act(fn) { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } }
const amt = id => Math.floor(Number(document.getElementById(id)?.value) || 0);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mesa]'); if (!b) return;
  const a = b.dataset.mesa, id = b.dataset.id;
  if (a === 'dep') act(async () => {
    const v = amt('mesa-dep'); if (v < 1000) return say('Depósito mínimo de R$ 1.000.', true); if (v > G.S.money) return say(`Você tem ${brl(G.S.money)} na carteira.`, true);
    const r = await rpc('tr_deposit', { p_amount: v }); if (!r) return;
    G.S.money -= v; (G.S.trOut ||= []).push(Number(r.split(':')[1])); note('Mesa Profissional: depósito', -v); save(); G.render?.(); say(`${brl(v)} depositados no saldo da mesa (BTC real).`); await load(); paintAcct(); });
  else if (a === 'wd') act(async () => {
    const v = amt('mesa-dep'); if (!(await rpc('tr_withdraw', { p_amount: v }))) return;
    say(`Saque de ${brl(v)} pedido: entra na carteira em instantes.`); await load(); paintAcct(); setTimeout(proSync, 1500); });
  else if (a === 'stop') act(async () => {
    if (!confirm('Parar de copiar? O saldo do copy volta para a sua carteira (o trader leva a comissão só sobre o lucro). Se houver operação aberta, encerra quando ela fechar.')) return;
    if (await rpc('tr_copy_stop', { p_id: Number(id) })) { say('Copy encerrado: o saldo entra na sua carteira em instantes.'); await load(); paintSide(); setTimeout(proSync, 1500); } });
  else if (a === 'copy') act(async () => {
    const v = amt('mesa-cp-amt'), stop = Number(document.getElementById('mesa-cp-stop')?.value) || 40;
    if (v > G.S.money) return say(`Você tem ${brl(G.S.money)} na carteira.`, true);
    if (!confirm(`Copiar este trader com ${brl(v)}?\n\nCada operação dele será repetida na sua conta, na mesma proporção (até 25% do copy por operação). O copy para sozinho se cair ${stop}%. O trader leva a comissão dele só sobre o seu lucro.`)) return;
    const r = await rpc('tr_copy_start', { p_leader: id, p_amount: v, p_stop: stop }); if (!r) return;
    G.S.money -= v; (G.S.trOut ||= []).push(Number(r.split(':')[2])); note('Mesa Profissional: copy trade', -v); save(); G.render?.();
    say(`Copy ativo! As próximas operações do trader serão repetidas na sua conta. Acompanhe em investimentos, na lateral (meus copies).`);
    document.getElementById('dlg-pro')?.close(); await load(); });
  else if (a === 'pro') openPro(id);
});
document.addEventListener('change', e => { if (e.target.id === 'mesa-fee') act(async () => { if (await rpc('tr_set_fee', { p_pct: Number(e.target.value) })) { say('Comissão atualizada (vale para os copies novos).'); await load(); } }); });

// ---------- ciclo: cotação a cada 3 s (Coinbase, fora da cota) e o servidor só ao abrir e a cada 30 s com operação aberta ----------
let lastLoad = 0, rankLoad = 0, lastSettle = 0;
setInterval(async () => {
  if (!visible()) { ready = false; return; }   // outra tela ou aba escondida: nada de rede; ao voltar recarrega
  if (!ready) { ready = true; await Promise.all([load(), loadRank(true), price()]); paintSide(); paintAcct(); lastLoad = rankLoad = Date.now(); return; }
  await price();
  const n = trades.filter(t => t.status === 'aberta').length, due = trades.some(t => t.status === 'aberta' && Date.parse(t.exp) < Date.now() - 6000);
  if (due && Date.now() - lastSettle > 10000) { lastSettle = Date.now(); await sb().rpc('tr_settle_me').catch(() => {}); await load(); lastLoad = Date.now(); paintAcct(); paintSide(); return; }
  if (n && Date.now() - lastLoad > 30000) { lastLoad = Date.now(); await load(); if (trades.filter(t => t.status === 'aberta').length !== n) { paintAcct(); paintSide(); } }   // fechou: mostra o resultado
  if (Date.now() - rankLoad > 300000) { rankLoad = Date.now(); await loadRank(true); paintSide(); }
}, 3000);
