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
const PAY = { 1: 1.7, 5: 1.8, 10: 1.88 };
const MSG = { login: 'Entre na sua conta.', banned: 'Conta bloqueada.', min: 'Valor abaixo do mínimo.', max: 'Máximo de R$ 500 mil por operação.',
  saldo: 'Saldo insuficiente na mesa. Deposite primeiro.', abertas: 'Você já tem 5 operações abertas.', rapido: 'Aguarde 5 segundos entre operações.',
  preco: 'A cotação real não respondeu agora. Tente de novo em instantes.', args: 'Operação inválida.', worth: 'Valor maior que o seu patrimônio.',
  limit: 'Muitas movimentações seguidas. Aguarde um minuto.', fee: 'A comissão vai de 5% a 20%.', notrader: 'Este jogador não oferece serviço de Trader na Central.',
  nocontract: 'O copy só é liberado depois de contratar um serviço deste trader na Central de Profissionais (contrato ativo).', self: 'Você não pode copiar a si mesmo.',
  mincopy: 'O copy começa em R$ 10 mil.', maxcopy: 'Máximo de R$ 50 milhões por copy.', stop: 'O stop vai de 5% a 95%.', nocopy: 'Copy não encontrado.',
  encerrando: 'Seu copy anterior com este trader ainda está fechando a última operação.' };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const usd = v => `US$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
let tab = 'operar', dur = 1, acct = null, trades = [], copies = [], rank = [], rankAt = 0, spot = 0, spot0 = 0, series = [], seriesAt = 0, busy = false, ready = false;

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
    if (Date.now() - seriesAt > 60000) { const c = await fetch(`${CB}/candles?granularity=60`, { cache: 'no-store' }); if (c.ok) { series = (await c.json()).slice(0, 90).reverse().map(x => ({ t: x[0] * 1000, c: x[4] })); spot0 = series.at(-60)?.c || series[0]?.c || 0; seriesAt = Date.now(); } }
  } catch {}
}

// ---------- tela ----------
const host = () => document.getElementById('mesa');
const visible = () => { const p = document.getElementById('p-trader'); return p && !p.hidden && document.visibilityState === 'visible'; };
function paint() {
  const h = host(); if (!h) return;
  if (!Auth.configured() || !me()) { h.innerHTML = '<p class="muted small">A Mesa Profissional precisa do jogo online e da sua conta.</p>'; return; }
  h.innerHTML = `<div class="mesa-head"><div><span class="pro-hero__k">mercado real · servidor</span><h2>Mesa Profissional <small>BTC/USD ao vivo (Coinbase)</small></h2>
      <p class="small">Preço real do Bitcoin: ninguém sabe o próximo minuto. A entrada é a cotação no momento do clique; o resultado é o fechamento real do minuto em que a operação vence. Liquidação automática pelo servidor.</p></div>
    <nav class="pro-nav" aria-label="Mesa Profissional">${[['operar', 'operar'], ['ranking', 'ranking de traders'], ['copy', 'copy trade']].map(([k, l]) => `<button type="button" class="btn btn--sm ${tab === k ? 'btn--gold' : 'btn--glass'}" data-mesa="tab" data-id="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</nav></div>
    <div id="mesa-body">${tab === 'operar' ? viewTrade() : tab === 'ranking' ? viewRank() : viewCopy()}</div>`;
  if (tab === 'operar') draw();
}
function viewTrade() {
  const done = trades.filter(t => t.status !== 'aberta' && !t.copy_id).slice(0, 12);
  const ch = spot && spot0 ? (spot / spot0 - 1) * 100 : 0, isTrader = rank.find(r => r.user_id === me())?.is_trader, followers = copies.filter(c => c.leader === me() && c.status === 'ativo');
  return `<div class="mesa-grid"><div class="glass mesa-chart"><div class="tr-head"><div><span class="muted small">Bitcoin (BTC/USD)</span><div class="tr-price ${ch >= 0 ? 'good' : 'bad'}" id="mesa-px">${spot ? usd(spot) : '…'}</div></div>
      <span class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}% em 1 h</span></div><canvas id="mesa-canvas"></canvas></div>
    <aside class="glass tr-ticket"><h3>conta da mesa</h3>
      <p class="mesa-bal">saldo <b>${brl(acct?.bal || 0)}</b></p>
      <div class="pro-row"><input class="input pro-grow" id="mesa-dep" type="number" min="1000" step="1000" placeholder="valor (R$)" inputmode="numeric" aria-label="valor para depositar ou sacar">
        <button type="button" class="btn btn--gold btn--sm" data-mesa="dep">depositar</button><button type="button" class="btn btn--glass btn--sm" data-mesa="wd">sacar</button></div>
      <p class="small muted">Depósito sai da carteira na hora. Saque volta para a carteira em até 3 minutos.</p>
      <h3>boleta</h3>
      <label class="field"><span>valor da operação em R$ (100 a 500 mil)</span><input class="input" id="mesa-amt" type="number" min="100" max="500000" step="100" value="1000" inputmode="numeric"></label>
      <div class="seg" role="group" aria-label="tempo da operação">${[1, 5, 10].map(m => `<button type="button" class="segbtn${dur === m ? ' is-on' : ''}" data-mesa="dur" data-id="${m}">${m} min <small>paga ${String(PAY[m]).replace('.', ',')}x</small></button>`).join('')}</div>
      <div class="tr-actions"><button class="btn btn--buy btn--lg" data-mesa="buy">▲ sobe</button><button class="btn btn--sell btn--lg" data-mesa="sell">▼ desce</button></div>
      ${followers.length ? `<p class="small"><b>${followers.length} seguidor(es)</b> copiam suas operações (${brl(followers.reduce((t, c) => t + Number(c.bal), 0))} no copy). Cada operação sua é repetida na mesma proporção.</p>` : ''}
      ${isTrader || followers.length ? `<label class="field"><span>sua comissão sobre o lucro de quem copia</span><select class="input" id="mesa-fee">${[5, 10, 15, 20].map(v => `<option value="${v}"${Number(acct?.fee_pct) === v ? ' selected' : ''}>${v}%</option>`).join('')}</select></label>` : ''}
      <h3>em andamento</h3><ul class="tr-list" id="mesa-open">${openList()}</ul>
      <h3>histórico</h3><ul class="tr-list tr-list--h">${done.length ? done.map(row).join('') : '<li class="muted small">Sem operações encerradas.</li>'}</ul></aside></div>`;
}
const openList = () => { const o = trades.filter(t => t.status === 'aberta' && !t.copy_id); return o.length ? o.map(row).join('') : '<li class="muted small">Nenhuma operação aberta.</li>'; };
function row(t) {
  const exp = Date.parse(t.exp), left = Math.max(0, Math.ceil((exp - Date.now()) / 1000)), tag = t.side > 0 ? '▲ sobe' : '▼ desce';
  if (t.status === 'aberta') return `<li class="tr-p"><div><strong class="${t.side > 0 ? 'good' : 'bad'}">${tag} ${t.minutes} min</strong><span class="muted small">entrada ${usd(t.entry)}${spot ? ` · agora ${usd(spot)}` : ''}</span></div>
    <div class="tr-pl">${brl(t.stake)}<small>${left ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'aguardando o fechamento do minuto'}</small></div></li>`;
  const won = t.status === 'ganhou';
  return `<li><span>${tag} ${t.minutes} min <small class="muted">${usd(t.entry)} → ${t.final ? usd(t.final) : '—'}</small></span><span class="${won ? 'good' : t.status === 'devolvida' ? 'muted' : 'bad'}">${won ? '+' + brl(t.back - t.stake) : t.status === 'devolvida' ? 'devolvida' : '−' + brl(t.stake)}</span></li>`;
}
function viewRank() {
  const list = rank.filter(r => r.ops >= 5);
  return `<p class="mesa-note">📌 <b>Copy trade:</b> escolha um trader e copie as operações dele automaticamente. <b>O copy só é liberado depois de contratar o serviço do trader na Central de Profissionais.</b> Ele recebe a comissão dele só sobre o lucro que você tiver.</p>
    ${list.length ? `<div class="glass scroll"><table class="pro-rank mesa-rank"><thead><tr><th>#</th><th>jogador</th><th class="num">operações (30 d)</th><th class="num">acertos</th><th class="num">% de acerto</th><th class="num">lucro 30 d</th><th class="num">lucro 7 d</th><th class="num">seguidores</th><th>copy</th></tr></thead><tbody>
    ${list.map((r, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td><b>${esc(r.name)}</b>${r.user_id === me() ? ' <small class="muted">(você)</small>' : ''}${r.ops < 20 ? '<br><small class="muted">poucas operações</small>' : ''}</td>
      <td class="num">${r.ops}</td><td class="num">${r.wins}</td><td class="num"><b>${pct(r.wins, r.ops)}</b></td><td class="num ${r.profit >= 0 ? 'good' : 'bad'}">${brl(r.profit)}</td><td class="num ${r.profit7 >= 0 ? 'good' : 'bad'}">${brl(r.profit7)}</td>
      <td class="num">${r.copiers}</td><td>${r.is_trader && r.user_id !== me() ? `<button type="button" class="btn btn--gold btn--sm" data-mesa="pro" data-id="${esc(r.user_id)}">contratar e copiar</button><br><small class="muted">comissão ${r.fee_pct}%</small>` : r.is_trader ? '<small class="muted">você é Trader</small>' : '<small class="muted">não oferece copy</small>'}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="pro-empty">O ranking aparece quando os jogadores fecharem 5 operações na Mesa Profissional.</p>'}
    <p class="small muted">Últimos 30 dias, só operações próprias (as copiadas não contam). Ordem: lucro em 30 dias. Quer aparecer como Trader? Crie seu perfil em <b>profissionais</b> com a profissão "Trader" e um serviço.</p>`;
}
function viewCopy() {
  const mine = copies.filter(c => c.follower === me()), fol = copies.filter(c => c.leader === me() && c.status !== 'encerrado');
  const card = c => { const res = Number(c.bal) - Number(c.invested), st = { ativo: ['copiando', 'green'], encerrando: ['fechando a última operação', 'gold'], encerrado: ['encerrado', 'muted'] }[c.status];
    return `<article class="pro-ct pro-ct--${st[1]}"><header><div><b>${esc(c.leader_name)}</b><p class="small">stop ${c.stop_pct}% · comissão ${c.fee_pct}% do lucro</p></div><span class="pro-tag pro-tag--${st[1]}">${st[0]}</span></header>
      <div class="pro-money"><span>investido <b>${brl(c.invested)}</b></span>${c.status !== 'encerrado' ? `<span>saldo do copy <b>${brl(c.bal)}</b></span><span>resultado <b class="${res >= 0 ? 'good' : 'bad'}">${res >= 0 ? '+' : ''}${brl(res)}</b></span>` : `<span>devolvido <b>${brl(c.paid_out)}</b></span><span>comissão paga <b>${brl(c.fee_paid)}</b></span>`}</div>
      ${c.end_reason ? `<p class="small muted">${esc(c.end_reason)}</p>` : ''}
      ${c.status === 'ativo' ? `<button type="button" class="btn btn--danger btn--sm" data-mesa="stop" data-id="${c.id}">parar de copiar e receber o saldo</button>` : ''}</article>`; };
  return `<p class="mesa-note">📌 <b>Como copiar:</b> 1) em <b>ranking de traders</b>, escolha quem tem bom histórico; 2) contrate o serviço dele na <b>Central de Profissionais</b> (o copy só é liberado com contrato ativo); 3) no perfil dele, escolha o valor e o stop e clique em <b>copiar</b>. Cada operação dele é repetida na sua conta na mesma proporção (até 25% do copy por operação), mesmo com o jogo fechado.</p>
    <h3 class="pro-sec">quem eu copio <small class="muted">(${mine.length})</small></h3>${mine.length ? mine.map(card).join('') : '<p class="small muted">Você ainda não copia ninguém.</p>'}
    ${fol.length ? `<h3 class="pro-sec">quem me copia <small class="muted">(${fol.length})</small></h3><ul class="tr-list">${fol.map(c => `<li><span><b>${esc(c.follower_name)}</b> <small class="muted">desde ${new Date(c.created_at).toLocaleDateString('pt-BR')}</small></span><span>${brl(c.bal)}</span></li>`).join('')}</ul>` : ''}
    <p class="small muted">O stop encerra o copy sozinho se o saldo cair até o limite. Ao parar, o saldo volta para a sua carteira; o trader leva a comissão só sobre o lucro acima do que você colocou. Se o contrato com o trader acabar, o copy também encerra.</p>`;
}
function draw() {
  const cv = document.getElementById('mesa-canvas'); if (!cv || !cv.offsetWidth || series.length < 2) return;
  const pts = [...series.map(x => x.c), spot || series.at(-1).c], dpr = devicePixelRatio || 1, W = cv.offsetWidth, H = cv.offsetHeight;
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = n => getComputedStyle(cv).getPropertyValue(n).trim(), hi = Math.max(...pts), lo = Math.min(...pts), pad = (hi - lo) * 0.1 || 1;
  const y = v => 8 + (hi + pad - v) / (hi - lo + 2 * pad) * (H - 16), x = i => i / (pts.length - 1) * (W - 70);
  g.strokeStyle = css('--tr-grid'); g.fillStyle = css('--tr-text'); g.font = `600 11px ${css('--font-body')}`; g.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) { const v = lo - pad + (hi - lo + 2 * pad) * i / 4; g.beginPath(); g.moveTo(0, y(v)); g.lineTo(W - 70, y(v)); g.stroke(); g.fillText(Math.round(v).toLocaleString('pt-BR'), W - 64, y(v)); }
  g.strokeStyle = pts.at(-1) >= pts[0] ? css('--tr-up') : css('--tr-down'); g.lineWidth = 2; g.beginPath(); pts.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)))); g.stroke();
  for (const t of trades.filter(t => t.status === 'aberta' && !t.copy_id)) { g.setLineDash([3, 3]); g.strokeStyle = t.side > 0 ? css('--tr-up') : css('--tr-down'); g.beginPath(); g.moveTo(0, y(t.entry)); g.lineTo(W - 70, y(t.entry)); g.stroke(); g.setLineDash([]); }
}

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
  if (a === 'tab') { tab = id; if (id === 'ranking') loadRank(true).then(paint); paint(); }
  else if (a === 'dur') { dur = Number(id); paint(); }
  else if (a === 'dep') act(async () => {
    const v = amt('mesa-dep'); if (v < 1000) return say('Depósito mínimo de R$ 1.000.', true); if (v > G.S.money) return say(`Você tem ${brl(G.S.money)} na carteira.`, true);
    const r = await rpc('tr_deposit', { p_amount: v }); if (!r) return;
    G.S.money -= v; (G.S.trOut ||= []).push(Number(r.split(':')[1])); note('Mesa Profissional: depósito', -v); save(); G.render?.(); say(`${brl(v)} depositados na Mesa Profissional.`); await load(); paint(); });
  else if (a === 'wd') act(async () => {
    const v = amt('mesa-dep'); if (!(await rpc('tr_withdraw', { p_amount: v }))) return;
    say(`Saque de ${brl(v)} pedido: entra na carteira em instantes.`); await load(); paint(); setTimeout(proSync, 1500); });
  else if (a === 'buy' || a === 'sell') act(async () => {
    const v = amt('mesa-amt'), r = await rpc('tr_open', { p_side: a === 'buy' ? 1 : -1, p_minutes: dur, p_stake: v }); if (!r) return;
    const [, , px, n] = r.split(':');
    say(`Valendo! BTC em ${usd(px)}. Se ${a === 'buy' ? 'subir' : 'descer'} em ${dur} min, você recebe ${brl(Math.floor(v * PAY[dur]))}.${Number(n) ? ` ${n} seguidor(es) copiaram.` : ''}`);
    await load(); paint(); });
  else if (a === 'stop') act(async () => {
    if (!confirm('Parar de copiar? O saldo do copy volta para a sua carteira (o trader leva a comissão só sobre o lucro). Se houver operação aberta, encerra quando ela fechar.')) return;
    if (await rpc('tr_copy_stop', { p_id: Number(id) })) { say('Copy encerrado: o saldo entra na sua carteira em instantes.'); await load(); paint(); setTimeout(proSync, 1500); } });
  else if (a === 'copy') act(async () => {
    const v = amt('mesa-cp-amt'), stop = Number(document.getElementById('mesa-cp-stop')?.value) || 40;
    if (v > G.S.money) return say(`Você tem ${brl(G.S.money)} na carteira.`, true);
    if (!confirm(`Copiar este trader com ${brl(v)}?\n\nCada operação dele será repetida na sua conta, na mesma proporção (até 25% do copy por operação). O copy para sozinho se cair ${stop}%. O trader leva a comissão dele só sobre o seu lucro.`)) return;
    const r = await rpc('tr_copy_start', { p_leader: id, p_amount: v, p_stop: stop }); if (!r) return;
    G.S.money -= v; (G.S.trOut ||= []).push(Number(r.split(':')[2])); note('Mesa Profissional: copy trade', -v); save(); G.render?.();
    say(`Copy ativo! As próximas operações do trader serão repetidas na sua conta. Acompanhe em investimentos > Mesa Profissional > copy trade.`);
    document.getElementById('dlg-pro')?.close(); await load(); });
  else if (a === 'pro') openPro(id);
});
document.addEventListener('change', e => { if (e.target.id === 'mesa-fee') act(async () => { if (await rpc('tr_set_fee', { p_pct: Number(e.target.value) })) { say('Comissão atualizada (vale para os copies novos).'); await load(); } }); });

// ---------- ciclo: cotação a cada 3 s (Coinbase) e o servidor só a cada 30 s com operação aberta (cota) ----------
let lastLoad = 0;
setInterval(async () => {
  if (!visible() || !host()) { ready = false; return; }   // aba escondida ou outra tela: nada de rede; ao voltar recarrega
  if (!ready) { ready = true; await Promise.all([load(), loadRank(true), price()]); paint(); lastLoad = Date.now(); return; }
  await price();
  if (tab !== 'operar') return;
  const px = document.getElementById('mesa-px'); if (px && spot) px.textContent = usd(spot);
  draw();
  const ul = document.getElementById('mesa-open'); if (ul) ul.innerHTML = openList();
  const n = trades.filter(t => t.status === 'aberta').length;
  if (n && Date.now() - lastLoad > 30000) { lastLoad = Date.now(); await load(); if (trades.filter(t => t.status === 'aberta').length !== n) paint(); }   // fechou: mostra o resultado
}, 3000);
