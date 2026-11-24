// Painel administrativo. Tudo o que ele faz passa pelas regras do banco (supabase/admin.sql): sem ser admin, nada funciona.
import { SUPABASE } from './supabase-config.js';
import * as W from './world.js';
import { LISTS as BIZ, CAT_KEYS } from './negocios.js';
import { GROUPS, groupOf } from './contador.js';
import { lostLands } from './land-check.js';
import * as AE from './admin-econ.js';

const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0);
const int = v => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v) || 0));
const when = d => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
let sb, me, users = [], cfg = {};

function toast(msg, bad = false) {
  const t = $('#ad-toast'); t.textContent = msg; t.dataset.tone = bad ? 'bad' : 'ok'; t.classList.add('is-on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 3500);
}
const fail = (e, what) => { console.error(e); toast(`Não deu para ${what}: ${e?.message || e}`, true); };
async function log(action, target, details) { await sb.from('admin_log').insert({ action, target: target || null, details: details || null }); }

// ---------- entrada ----------
async function boot() {
  if (!SUPABASE.url || !SUPABASE.anonKey) { document.body.innerHTML = '<main class="ad-login"><div class="ad-card"><h1>login não configurado</h1><p>Preencha supabase-config.js.</p></div></main>'; return; }
  const lib = await import(LIB);
  sb = lib.createClient(SUPABASE.url, SUPABASE.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const { data } = await sb.auth.getSession();
  if (data.session) return enter(data.session.user);
  $('#ad-login').hidden = false;
}
$('#ad-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), err = $('#ad-err');
  err.hidden = true; $('#ad-submit').disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email: String(f.email).trim(), password: f.password });
  $('#ad-submit').disabled = false;
  if (error) { err.textContent = /invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(error.message) ? 'Conta ainda não confirmada no banco do jogo.' : error.message; err.hidden = false; return; }
  e.target.reset();
  enter(data.user);
});

async function enter(user) {
  me = user;
  const { data, error } = await sb.rpc('is_admin');
  if (error) { $('#ad-login').hidden = true; $('#ad-setup').hidden = false; return; }
  if (data !== true) {
    $('#ad-login').hidden = false;
    const err = $('#ad-err'); err.textContent = 'Esta conta não é administradora.'; err.hidden = false;
    await sb.auth.signOut(); return;
  }
  $('#ad-login').hidden = true; $('#ad-app').hidden = false;
  $('#ad-who').textContent = `Conectado como ${user.email}`;
  show('vigia');
  pwBadge(); setInterval(pwBadge, 60000);
  watchOnline();
}
// ---------- quem está online (presença em tempo real, sem tabela) ----------
let online = [];
function watchOnline() {
  const ch = sb.channel('online-players');
  ch.on('presence', { event: 'sync' }, () => { online = Object.values(ch.presenceState()).map(a => a[0]).filter(Boolean); renderOnline(); }).subscribe();
  setInterval(renderOnline, 20000);
}
function renderOnline() {
  const el = $('#ad-online'); if (!el) return;
  const mins = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'agora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const list = [...online].sort((a, b) => (b.worth || 0) - (a.worth || 0));
  $('#ad-on-n').textContent = list.length;
  el.innerHTML = list.map(p => `<tr ${p.uid ? `data-user="${esc(p.uid)}"` : ''}><td><strong>${esc(p.name)}</strong></td><td>${p.uid ? '<span class="tag tag--green">conta logada</span> <small class="muted">clique para ver</small>' : '<span class="tag tag--gold">visitante sem conta</span>'}</td>
    <td class="num">${int(p.level)}</td><td class="num">${brl(p.worth || 0)}</td><td>${esc(tela(p.tab || ''))}</td><td>${p.mobile ? 'celular' : 'computador'}</td><td>${mins(p.since)}</td></tr>`).join('')
    || '<tr><td colspan="7" class="muted">Ninguém com o jogo aberto agora.</td></tr>';
}
// ---------- pedidos de senha ----------
async function pwBadge() {
  const { data } = await sb.rpc('admin_password_requests');
  const n = (data || []).filter(r => r.status === 'pendente').length, b = $('#ad-pw-badge');
  b.textContent = n; b.hidden = !n;
  if (n) document.title = `(${n}) 21 World: central`;
}
async function loadPw() {
  const { data, error } = await sb.rpc('admin_password_requests');
  if (error) return fail(error, 'carregar os pedidos');
  $('#ad-pw').innerHTML = (data || []).map(r => `<tr class="${r.status !== 'pendente' ? 'is-done' : ''}">
    <td>${when(r.created_at)}</td><td>${esc(r.email)}</td><td>${esc(r.name)}</td><td>${esc(r.details)}</td>
    <td>${r.account_exists ? `${esc(r.real_name || 'sem perfil')}, nível ${r.real_level ?? '?'}, ${brl(r.real_worth)}, último acesso ${when(r.last_sign_in_at)}` : '<b class="bad">não existe conta com esse e-mail</b>'}</td>
    <td>${r.status === 'pendente' ? `<button class="btn btn--gold btn--sm" data-pw="${r.id}" data-ok="1" ${r.account_exists ? '' : 'disabled'}>aprovar</button> <button class="btn btn--glass btn--sm" data-pw="${r.id}" data-ok="0">recusar</button>` : esc(r.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum pedido.</td></tr>';
  pwBadge();
}
document.addEventListener('click', async e => {
  if (e.target.id === 'ad-pw-reload') return loadPw();
  const b = e.target.closest('[data-pw]'); if (!b) return;
  const ok = b.dataset.ok === '1';
  if (ok && !confirm('Aprovar e trocar a senha dessa conta agora?')) return;
  const { data, error } = await sb.rpc('admin_decide_password', { p_id: Number(b.dataset.pw), p_approve: ok });
  if (error) return fail(error, 'decidir o pedido');
  toast(data === 'ok' ? (ok ? 'Senha trocada. Avise o jogador que já pode entrar.' : 'Pedido recusado.') : data, data !== 'ok');
  loadPw();
});
for (const id of ['#ad-logout', '#ad-logout2']) $(id).addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

// ---------- navegação ----------
// poucos menus: cada um junta várias partes do painel, uma embaixo da outra
const MENU = { alertas: ['vigia', 'overview'], jogadores: ['players'], investigar: ['diario', 'terras', 'livros'], mundo: ['economy', 'rules', 'owners', 'news'], delegacia: ['bo'], pedidos: ['pro', 'passwords', 'log'] };
let tuneLoad = null;
const LOAD = { vigia: () => loadVigia(), overview: () => loadOverview(), players: () => loadUsers(), diario: () => { if (!dj) loadDiario(); }, terras: () => loadLands(),
  economy: () => { loadConfig(); loadEconomy(); }, rules: () => tuneLoad?.(), owners: () => loadOwners(), news: () => loadAnns(), bo: () => loadBo(), pro: () => loadPro(), passwords: () => loadPw(), log: () => loadLog() };
function show(tab) {
  const g = MENU[tab] ? tab : Object.keys(MENU).find(k => MENU[k].includes(tab)) || 'alertas';
  document.querySelectorAll('.ad-nav button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === g));
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = !MENU[g].includes(p.dataset.panel); });
  for (const p of MENU[g]) LOAD[p]?.();
  window.scrollTo?.(0, 0);
}
document.querySelector('.ad-nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });

// ---------- visão geral ----------
async function loadOverview() {
  const { data: st, error } = await sb.rpc('admin_stats');
  if (error) return fail(error, 'carregar os números');
  const tiles = [['jogadores', int(st.users)], ['e-mail confirmado', int(st.confirmed)], ['novos em 24 h', int(st.new_24h)], ['novos em 7 dias', int(st.new_7d)],
    ['jogaram nas últimas 24 h', int(st.active_24h)], ['suspensos', int(st.banned)], ['patrimônio somado', brl(st.total_worth)], ['ordens pendentes', int(st.pending)]];
  $('#ad-stats').innerHTML = tiles.map(([k, v]) => `<div class="ad-tile"><span>${k}</span><strong>${v}</strong></div>`).join('');
  const { data: top } = await sb.from('public_profiles').select('user_id, name, level, worth').order('worth', { ascending: false }).limit(10);
  $('#ad-top').innerHTML = (top || []).map((p, i) => `<tr data-user="${p.user_id}"><td>${i + 1}</td><td>${esc(p.name)}</td><td class="num">${p.level}</td><td class="num">${brl(p.worth)}</td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Ninguém no ranking ainda.</td></tr>';
  loadReceita();
}
async function loadReceita() {
  const { data: cases } = await sb.from('receita_casos').select('user_id, at, gain, worth, minutes').order('at', { ascending: false }).limit(30);
  const ids = [...new Set((cases || []).map(c => c.user_id))];
  const [{ data: names }, { data: bans }] = ids.length ? await Promise.all([sb.from('public_profiles').select('user_id, name').in('user_id', ids), sb.from('bans').select('user_id, until, reason').in('user_id', ids)]) : [{}, {}];
  const nm = Object.fromEntries((names || []).map(n => [n.user_id, n.name])), preso = Object.fromEntries((bans || []).filter(b => /^Receita Federal/.test(b.reason || '') && new Date(b.until) > new Date()).map(b => [b.user_id, b.until]));
  const seen = new Set();
  $('#ad-receita').innerHTML = (cases || []).map(c => {
    const now = !seen.has(c.user_id) && preso[c.user_id]; seen.add(c.user_id);   // só a linha mais nova de cada um mostra o botão
    return `<tr data-user="${c.user_id}"><td>${when(c.at)}</td><td><strong>${esc(nm[c.user_id] || '(sem nome)')}</strong></td><td class="num">${brl(c.gain)}</td><td class="num">${brl(c.worth)}</td><td class="num">${c.minutes} min</td>
      <td>${now ? `<span class="tag tag--red">preso até ${new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span> <button class="btn btn--gold btn--sm" data-solta="${c.user_id}">soltar</button>` : '<span class="tag tag--green">solto</span>'}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="muted">Nenhum caso ainda.</td></tr>';
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-solta]'); if (!b) return;
  e.stopPropagation(); b.disabled = true;
  const { error } = await sb.from('bans').delete().eq('user_id', b.dataset.solta);
  if (error) return fail(error, 'soltar');
  await log('receita_solta', b.dataset.solta); toast('Liberado. O jogo dele volta em até 10 s.'); loadReceita();
}, true);

// ---------- jogadores ----------
async function loadUsers(q = $('#ad-q').value.trim()) {
  const { data, error } = await sb.rpc('admin_users', { q, lim: 300 });
  if (error) return fail(error, 'listar os jogadores');
  users = data || [];
  $('#ad-users').innerHTML = users.map(u => `<tr data-user="${u.user_id}" tabindex="0">
    <td><strong>${esc(u.name || '(sem nome)')}</strong></td><td>${esc(u.email)}${u.confirmed ? '' : ' <span class="tag tag--gold">não confirmou</span>'}</td>
    <td class="num">${u.level ?? '—'}</td><td class="num">${u.worth != null ? brl(u.worth) : '—'}</td><td>${when(u.last_sign_in_at)}</td>
    <td>${u.banned ? `<span class="tag tag--red">suspenso</span>` : '<span class="tag tag--green">ativo</span>'}</td></tr>`).join('')
    || '<tr><td colspan="6" class="muted">Nenhum jogador encontrado.</td></tr>';
}
$('#ad-search').addEventListener('submit', e => { e.preventDefault(); loadUsers(); });
document.addEventListener('click', e => { const r = e.target.closest('tr[data-user]'); if (r) openPlayer(r.dataset.user); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('tr[data-user]')) openPlayer(e.target.dataset.user); });

// economia do jogador: de que é feito o patrimônio, o que ele faz, lucro/prejuízo por atividade e alertas
const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`);
const pnlTable = (rows, extra) => `<div class="ad-tablewrap"><table><thead><tr><th>atividade</th><th class="num">faturou</th><th class="num">gastou</th><th class="num">lucro</th><th class="num">margem</th>${extra ? '<th>quem mais lucrou</th>' : ''}</tr></thead><tbody>
  ${rows.filter(x => x.in || x.out).map(x => `<tr${x.alert ? ' class="ad-alert"' : ''}><td>${esc(x.label)}${x.alert ? ' <span class="tag tag--red">fora do normal</span>' : ''}</td><td class="num">${brl(x.in)}</td><td class="num">${brl(x.out)}</td>
    <td class="num ${x.lucro < 0 ? 'bad' : 'good'}">${brl(x.lucro)}</td><td class="num">${pct(x.margin)}</td>${extra ? `<td>${esc(x.top?.name || '')} ${x.top ? brl(x.top.lucro) : ''}</td>` : ''}</tr>`).join('') || '<tr><td colspan="6" class="muted">Sem movimento ainda.</td></tr>'}</tbody></table></div>`;
function econHTML(s) {
  if (!s || s.money == null) return '';
  try {
    const w = AE.worthParts(s), p = AE.pnl(s), al = AE.alerts(s, p), act = AE.activities(s);
    return `<h3>economia do jogador</h3>
    ${al.length ? `<ul class="ad-err">${al.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="good small">Nada fora do normal.</p>'}
    <p class="small"><b>o que está fazendo:</b> ${act.length ? act.map(esc).join(' · ') : 'nada no momento'}</p>
    <p class="small"><b>patrimônio ${brl(w.total)}:</b> ${Object.entries(w.parts).filter(([, v]) => Math.abs(v) >= 1000).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${AE.brlShort(v)} (${Math.round(v / Math.max(1, w.total) * 100)}%)`).join(' · ')}${w.debt ? ` · <span class="bad">dívidas ${AE.brlShort(w.debt)}</span>` : ''}</p>
    <h4>lucro e prejuízo por atividade (últimos 36 meses do jogo)</h4>
    <p class="small muted">Total: entrou ${brl(p.in)}, saiu ${brl(p.out)}, lucro ${brl(p.lucro)}. Compra e venda de bens (terras, galpões, empresas) não entram como lucro.</p>
    ${pnlTable(p.rows)}
    <h4>maiores lançamentos do livro-caixa</h4>
    <div class="ad-tablewrap"><table><thead><tr><th>mês</th><th>o quê</th><th class="num">valor</th></tr></thead><tbody>${AE.bigMoves(s).map(l => `<tr><td>${l.m ?? ''}</td><td>${esc(l.txt)}</td><td class="num ${l.val < 0 ? 'bad' : 'good'}">${brl(l.val)}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (e) { console.error(e); return '<p class="ad-err">Não deu para analisar a economia deste save.</p>'; }
}
// saúde da economia: todos os jogadores somados por atividade
async function loadEconomy() {
  const box = $('#ad-econ'); if (!box) return;
  box.innerHTML = '<p class="muted">Calculando...</p>';
  const [{ data: sv, error }, { data: pf }] = await Promise.all([sb.from('saves').select('user_id, data'), sb.from('public_profiles').select('user_id, name')]);
  if (error) return fail(error, 'ler os saves');
  const nm = Object.fromEntries((pf || []).map(p => [p.user_id, p.name])), e = AE.economy((sv || []).map(x => ({ name: nm[x.user_id] || '?', data: x.data })));
  const bad = e.rows.filter(r => r.alert);
  box.innerHTML = `<div class="ad-tiles ad-tiles--sm"><div class="ad-tile"><span>jogadores</span><strong>${e.players}</strong></div><div class="ad-tile"><span>dinheiro em caixa (todos)</span><strong>${AE.brlShort(e.money)}</strong></div><div class="ad-tile"><span>patrimônio somado</span><strong>${AE.brlShort(e.worth)}</strong></div></div>
    ${bad.length ? `<ul class="ad-err">${bad.map(r => `<li>${esc(r.label)}: margem de ${pct(r.margin)} em ${AE.brlShort(r.in)} (normal até ~${pct(AE.EXPECT[r.key])}). Vale revisar custo/preço dessa atividade.</li>`).join('')}</ul>` : '<p class="good small">Todas as atividades com margem dentro do normal.</p>'}
    ${pnlTable(e.rows, true)}`;
}
document.addEventListener('click', e => { if (e.target.closest('#ad-econ-reload')) loadEconomy(); });

// ---------- textos em palavras (nada de código na tela) ----------
const GRANT_TXT = { money: 'dinheiro', chips: 'fichas', xp: 'XP', message: 'mensagem', reset: 'reiniciar a conta', setmoney: 'definir o dinheiro', land: 'devolver terra', pioneer: 'selo de pioneiro' };
const WHY_TXT = { 'cópia periódica': 'cópia automática', 'antes de mudar': 'cópia automática', 'dinheiro caiu muito': 'o dinheiro caiu muito (cópia de antes)', 'terra a menos': 'sumiu uma terra (cópia de antes)', 'save apagado ou reiniciado': 'a conta foi apagada ou reiniciada (cópia de antes)' };
const ACTION_TXT = { grant_money: 'deu ou tirou dinheiro', grant_chips: 'deu ou tirou fichas', grant_xp: 'deu XP', grant_message: 'mandou mensagem', grant_cancel: 'cancelou uma ordem', rename: 'trocou o nome', ban: 'suspendeu', unban: 'reativou a conta',
  reset: 'reiniciou a conta', wipe: 'apagou save e perfil', restore_save: 'voltou a conta para uma cópia', restore_land: 'devolveu terra', refund_land: 'devolveu o valor de uma terra', world: 'mudou o tempo do mundo', config: 'mudou eventos e manutenção',
  gift_all: 'presente para todos', announcement: 'publicou aviso', announcement_delete: 'apagou aviso', tuning: 'mudou as regras do jogo', release_owner: 'liberou marca ou mina para a loja', take_excess: 'tirou o excesso', receita_solta: 'soltou da Receita',
  pro_decide: 'decidiu denúncia de profissional', pro_set: 'mudou um profissional', ban_farm: 'suspendeu contas da fazenda de Pix' };
const KEY_TXT = { amount: 'valor', note: 'mensagem', reason: 'motivo', days: 'dias', name: 'nome', what: 'o quê', kind: 'tipo', count: 'jogadores', copia: 'cópia', de: 'de', marcas_devolvidas: 'marcas devolvidas', mina: 'mina', frigorifico_fechado: 'frigorífico fechado', acessorios_devolvidos: 'acessórios devolvidos', why: 'motivo', land: 'terra', from: 'de onde' };
const detailsTxt = d => (d && typeof d === 'object' ? Object.entries(d).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).slice(0, 6)
  .map(([k, v]) => `${KEY_TXT[k] || k.replace(/_/g, ' ')}: ${typeof v === 'number' ? int(v) : typeof v === 'boolean' ? (v ? 'sim' : 'não') : Array.isArray(v) ? v.map(x => (typeof x === 'object' ? x?.region || x?.ha || '' : BRAND_NAMES[x] || x)).join(', ') : typeof v === 'object' ? (v.region ? `${v.ha} ha em ${v.region}` : '…') : String(v).slice(0, 60)}`).join(' · ') : '');

// voltar a conta para uma cópia e mostrar, em palavras, o que saiu dela e o que voltou para a loja
async function restoreTo(uid, histId, whenTxt, moneyTxt) {
  const nm = users.find(u => u.user_id === uid)?.name || 'este jogador';
  if (!confirm(`Voltar a conta de ${nm} para a cópia de ${whenTxt || 'antes'} (${moneyTxt || ''} em caixa)?\n\nTudo o que ele ganhou e comprou depois sai da conta. Marcas, mina, frigorífico e acessórios que ele não tinha naquela hora voltam para a loja. O estado de agora fica guardado (dá para desfazer).`)) return null;
  const { data, error } = await sb.rpc('admin_restore_save', { p_id: Number(histId) });
  const ok = data === 'ok' || data?.ok;
  if (error || !ok) { fail(error || { message: data?.err || data }, 'voltar a conta (o código novo das cópias já foi colado no banco?)'); return null; }
  const r = typeof data === 'object' ? data : {}, li = [];
  li.push(`A conta voltou a ser exatamente como estava em <b>${esc(whenTxt || when(r.from))}</b>. Se ${esc(nm)} estiver jogando, o jogo dele troca em segundos; se não, na próxima vez que abrir.`);
  if (r.freed?.length) li.push(`Voltaram para a loja (qualquer um pode comprar): <b>${r.freed.map(b => esc(BRAND_NAMES[b] || b)).join(', ')}</b>.`);
  if (r.mine) li.push(`Mina de ouro: <b>${esc(r.mine)}</b>.`);
  if (r.frig) li.push('O frigorífico dele saiu da lista de frigoríficos abertos para os outros jogadores.');
  if (r.acc > 0) li.push(`<b>${r.acc}</b> acessório(s) voltaram para o estoque da loja.`); else if (r.acc < 0) li.push(`${-r.acc} acessório(s) que ele tinha naquela hora saíram de novo do estoque da loja.`);
  if (r.lands) li.push(`${r.lands} terra(s) saíram da conta (marcadas como "save restaurado", não como sumiço).`);
  if (Number(r.pixIn)) li.push(`Pix que ele recebeu depois dessa hora: <b>${brl(r.pixIn)}</b>. Esse dinheiro saiu da conta dele. Quem mandou não recebe de volta (se foram contas falsas dele, o dinheiro some do jogo).`);
  if (Number(r.pixOut)) li.push(`Pix que ele mandou depois dessa hora: ${brl(r.pixOut)}. O dinheiro voltou para ele e quem recebeu continua com o dele: confira se precisa voltar também a conta de quem recebeu.`);
  if (r.conflict?.length) li.push(`<span class="bad">Atenção: naquela hora ele tinha ${r.conflict.map(esc).join(', ')}. Hoje já é de outro jogador; quando o jogo dele abrir, ele recebe o valor de volta em dinheiro no lugar.</span>`);
  toast('Conta voltou para a cópia escolhida.');
  await openPlayer(uid);
  const box = $('#ap-restored'); if (box) { box.innerHTML = `<div class="ad-done"><h4>✅ feito</h4><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul></div>`; box.scrollIntoView({ block: 'center' }); }
  return r;
}

async function openPlayer(id) {
  if (!users.length) await loadUsers('');
  const u = users.find(x => x.user_id === id) || { user_id: id };
  const [{ data: save }, { data: grants }, hist] = await Promise.all([
    sb.from('saves').select('data, updated_at').eq('user_id', id).maybeSingle(),
    sb.from('admin_grants').select('id, kind, amount, note, created_at, applied_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    sb.from('save_history').select('*').eq('user_id', id).order('saved_at', { ascending: false }).limit(260).then(r => (r.error && /column/.test(r.error.message) ? sb.from('save_history').select('id, saved_at, why, money, lands').eq('user_id', id).order('saved_at', { ascending: false }).limit(260) : r)),
  ]);
  const s = save?.data || {};
  const facts = [['dinheiro', brl(s.money)], ['fichas', int(s.chips)], ['nível', s.level ?? '—'], ['mês do jogo', s.month ?? '—'],
    ['terras', (s.lands || []).filter(l => l.own).length], ['gado', int((s.herd || []).reduce((a, h) => a + h.heads, 0))],
    ['carros', (s.cars || []).length], ['animais de corrida', (s.stable?.animals || []).length], ['mãos de 21', int(s.stats?.hands)], ['clube de futebol', s.fut?.club ? esc(s.fut.club) : '—'],
    ['empresas', CAT_KEYS.filter(c => c !== 'usinas').reduce((t, c) => t + (s.biz?.[c] || []).length, 0)], ['usinas', (s.biz?.usinas || []).length], ['mina de ouro', s.mina ? 'sim' : 'não'],
    ['troféus', (s.trophies || []).length], ['perfil', s.privateProfile ? 'privado' : 'público'],
    ['horas jogadas', s.play ? hrs(s.play.ms / 36e5) : 'não medido'], ['jogou hoje', s.play ? hrs((s.play.days?.[new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10)] || 0) / 36e5) : '—'], ['dias que jogou (de 30)', s.play ? Object.keys(s.play.days || {}).length : '—']];
  $('#ap-body').innerHTML = `
    <h2 id="ap-name">${esc(u.name || '(sem nome)')} <button class="btn btn--glass btn--sm" type="button" data-dj-open="${esc(u.name || '')}">ver diário completo</button></h2>
    <p class="muted small">${esc(u.email || '')}, cadastro em ${when(u.created_at)}, último acesso em ${when(u.last_sign_in_at)}, save salvo em ${when(save?.updated_at)}</p>
    ${u.banned ? `<p class="ad-err">Suspenso${u.ban_reason ? `: ${esc(u.ban_reason)}` : ''}.</p>` : ''}
    ${cheatBox(id)}
    <div class="ad-tiles ad-tiles--sm">${facts.map(([k, v]) => `<div class="ad-tile"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    ${econHTML(s)}
    <h3>dar ou tirar</h3>
    <form class="row" id="ap-grant">
      <label class="field"><span>o quê</span><select class="input" name="kind"><option value="money">dinheiro (R$)</option><option value="chips">fichas</option><option value="xp">XP</option><option value="message">só mensagem</option></select></label>
      <label class="field"><span>quantidade (negativo tira)</span><input class="input" name="amount" type="number" step="1" value="1000"></label>
      <label class="field ad-grow"><span>mensagem para o jogador</span><input class="input" name="note" maxlength="200"></label>
      <button class="btn btn--gold" type="submit">enviar</button>
    </form>
    <h3>conta</h3>
    <div class="row">
      <form class="row" id="ap-rename"><label class="field"><span>renomear</span><input class="input" name="name" minlength="3" maxlength="18" value="${esc(u.name || '')}"></label><button class="btn btn--glass" type="submit">salvar nome</button></form>
    </div>
    <form class="row" id="ap-ban">
      <label class="field ad-grow"><span>motivo da suspensão</span><input class="input" name="reason" maxlength="200"></label>
      <label class="field"><span>por quanto tempo</span><select class="input" name="days"><option value="1">1 dia</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="0">sem prazo</option></select></label>
      <button class="btn btn--danger" type="submit">suspender</button>
      ${u.banned ? '<button class="btn btn--glass" type="button" id="ap-unban">reativar conta</button>' : ''}
    </form>
    <div class="row ad-danger">
      <button class="btn btn--danger" id="ap-reset">reiniciar o progresso</button>
      <button class="btn btn--danger" id="ap-wipe">apagar save e perfil</button>
    </div>
    <h3>ordens enviadas</h3>
    <div class="ad-tablewrap"><table><thead><tr><th>quando</th><th>o quê</th><th class="num">quanto</th><th>mensagem</th><th>situação</th></tr></thead><tbody>
      ${(grants || []).map(g => `<tr><td>${when(g.created_at)}</td><td>${esc(GRANT_TXT[g.kind] || g.kind)}</td><td class="num">${int(g.amount)}</td><td>${esc(g.note || '')}</td>
        <td>${g.applied_at ? `aplicada ${when(g.applied_at)}` : `pendente <button class="btn btn--glass btn--sm" data-cancel="${g.id}">cancelar</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhuma ordem ainda.</td></tr>'}
    </tbody></table></div>
    <h3 id="ap-hist">voltar a conta para um estado anterior</h3>
    <p class="ad-help">O servidor guarda uma cópia da conta a cada 5 minutos de jogo, sempre que o dinheiro cai muito ou some uma terra, e quando você clica em <b>guardar cópia agora</b>. Ficam as 200 mais recentes, a última de cada dia dos últimos 60 dias e as cópias que você guardou.<br>
      <b>Voltar para esta cópia</b> faz a conta ficar exatamente como estava naquela hora: o dinheiro, as fichas, as terras e tudo o que ele comprou depois <b>saem da conta</b>. Marcas (bancos, provedores, mercados, usinas), a mina de ouro, o frigorífico e os acessórios que ele não tinha naquela hora <b>voltam para a loja</b> na mesma hora, para outro jogador poder comprar. Antes de voltar, o estado de agora é guardado aqui também (dá para desfazer). Se ele estiver jogando, o jogo dele troca para a cópia em segundos.</p>
    ${hist.error ? '<p class="muted small">As cópias da conta ainda não foram ligadas no banco.</p>'
      : `<form class="row" id="ap-snap"><label class="field ad-grow"><span>anotação da cópia (opcional)</span><input class="input" name="note" maxlength="80" placeholder="ex.: antes de investigar o Pix"></label><button class="btn btn--gold" type="submit">guardar cópia agora</button></form>
      <div id="ap-restored"></div>
      <div class="ad-tablewrap ad-ledger"><table><thead><tr><th>quando</th><th>por que foi guardada</th><th class="num">dinheiro</th><th class="num">fichas</th><th class="num">patrimônio</th><th class="num">terras</th><th class="num">nível</th><th></th></tr></thead><tbody>
      ${(hist.data || []).map(h => `<tr class="${/administrador|restaurar/.test(h.why) ? 'ad-mark' : ''}"><td>${when(h.saved_at)}</td><td>${esc(WHY_TXT[h.why] || h.why)}</td><td class="num">${brl(h.money)}</td><td class="num">${h.chips != null ? int(h.chips) : '—'}</td><td class="num">${h.worth != null ? brl(h.worth) : '—'}</td><td class="num">${int(h.lands)}</td><td class="num">${h.level ?? '—'}</td>
        <td><button class="btn btn--glass btn--sm" data-restore="${h.id}" data-when="${esc(when(h.saved_at))}" data-money="${esc(brl(h.money))}">voltar para esta cópia</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Nenhuma cópia guardada ainda.</td></tr>'}
      </tbody></table></div>`}
    ${ledger(s)}`;
  const d = $('#ad-player'); if (!d.open) d.showModal();

  $('#ap-grant').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), amount = Math.trunc(Number(f.amount) || 0);
    if (f.kind !== 'message' && !amount) return toast('Digite uma quantidade.', true);
    const { data: row, error } = await sb.from('admin_grants').insert({ user_id: id, kind: f.kind, amount: f.kind === 'message' ? 0 : amount, note: f.note || null }).select('id').single();
    if (error) return fail(error, 'enviar');
    await log(`grant_${f.kind}`, id, { amount, note: f.note });
    toast('Enviado! Se o jogador estiver online, cai na conta dele na hora.'); openPlayer(id);
    if (row?.id) watchGrant(row.id, id);
  };
  $('#ap-rename').onsubmit = async e => {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name')).trim();
    const { error } = await sb.from('public_profiles').update({ name }).eq('user_id', id);
    if (error) return fail(error, /duplicate|unique/i.test(error.message) ? 'renomear (esse nome já existe)' : 'renomear');
    await log('rename', id, { name }); toast('Nome alterado no ranking.'); loadUsers('');
  };
  $('#ap-ban').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), days = Number(f.days);
    if (!confirm(`Suspender ${u.name || 'este jogador'}?`)) return;
    const { error } = await sb.from('bans').upsert({ user_id: id, reason: f.reason || null, until: days ? new Date(Date.now() + days * 864e5).toISOString() : null });
    if (error) return fail(error, 'suspender');
    await log('ban', id, { reason: f.reason, days }); toast('Conta suspensa.'); await loadUsers(''); openPlayer(id);
  };
  $('#ap-unban')?.addEventListener('click', async () => {
    const { error } = await sb.from('bans').delete().eq('user_id', id);
    if (error) return fail(error, 'reativar');
    await log('unban', id); toast('Conta reativada.'); await loadUsers(''); openPlayer(id);
  });
  $('#ap-reset').onclick = async () => {
    if (!confirm('Reiniciar todo o progresso deste jogador? Isso não pode ser desfeito.')) return;
    const { error } = await sb.from('admin_grants').insert({ user_id: id, kind: 'reset', note: 'progresso reiniciado pelo administrador' });
    if (error) return fail(error, 'reiniciar');
    await log('reset', id); toast('O progresso será reiniciado na próxima vez que o jogo dele sincronizar.'); openPlayer(id);
  };
  $('#ap-wipe').onclick = async () => {
    if (!confirm('Apagar o save e o perfil deste jogador da nuvem? A conta de e-mail continua existindo (apague em Authentication > Users).')) return;
    const a = await sb.from('saves').delete().eq('user_id', id), b = await sb.from('public_profiles').delete().eq('user_id', id);
    if (a.error || b.error) return fail(a.error || b.error, 'apagar');
    await log('wipe', id); toast('Save e perfil apagados.'); d.close(); loadUsers('');
  };
  $('#ap-body').querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); restoreTo(id, b.dataset.restore, b.dataset.when, b.dataset.money); }, true));
  $('#ap-snap')?.addEventListener('submit', async e => {
    e.preventDefault();
    const { data, error } = await sb.rpc('admin_snapshot_save', { p_user: id, p_note: new FormData(e.target).get('note') || null });
    if (error || data !== 'ok') return fail(error || { message: data === 'missing' ? 'este jogador ainda não tem save na nuvem' : data }, 'guardar a cópia (falta ligar esta parte no banco?)');
    toast('Cópia guardada. Ela fica no topo da lista.'); openPlayer(id);
  });
  $('#ap-body').querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', async () => {
    const { error } = await sb.from('admin_grants').delete().eq('id', Number(b.dataset.cancel)).is('applied_at', null);
    if (error) return fail(error, 'cancelar');
    await log('grant_cancel', id, { grant: b.dataset.cancel }); openPlayer(id);
  }));
}
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) e.target.closest('dialog').close(); });

// ---------- economia e eventos ----------
async function loadConfig() {
  const { data, error } = await sb.from('game_config').select('data').eq('id', 1).maybeSingle();
  if (error) return fail(error, 'ler a configuração');
  cfg = data?.data || {};
  const f = $('#ad-config');
  for (const k of ['xp_mult', 'daily_mult', 'job_mult', 'prize_mult']) f[k].value = String(cfg[k] ?? 1);
  f.event.value = cfg.event || ''; f.maintenance.checked = !!cfg.maintenance; f.maintenance_msg.value = cfg.maintenance_msg || '';
  showWorld();
}
// ---------- tempo de mundo ----------
const world = () => W.sanitize(cfg.world || W.DEFAULT);
function showWorld() {
  const w = world(), f = $('#ad-world');
  f.min.value = +(w.monthMs / 60000).toFixed(2);
  $('#ad-world-now').textContent = `Mês ${W.current(w)} do mundo. Cada mês dura ${+(w.monthMs / 60000).toFixed(2)} min reais; o próximo chega em ${W.fmt(W.msLeft(w))}.`;
}
async function saveWorld(next, what) {
  const data = { ...cfg, world: next };
  const { error } = await sb.from('game_config').update({ data, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) return fail(error, 'salvar o tempo de mundo');
  cfg = data; await log('world', null, { ...next, what }); showWorld(); toast('Tempo de mundo salvo. Todos os jogadores acompanham em até 1 minuto.');
}
$('#ad-world').addEventListener('submit', e => {
  e.preventDefault();
  const min = Number(e.target.min.value);
  if (!(min >= W.MIN_MONTH_MS / 60000 && min <= W.MAX_MONTH_MS / 60000)) return toast('Use entre 0,2 e 1440 minutos.', true);
  saveWorld(W.setSpeed(world(), Math.round(min * 60000)), `velocidade ${min} min/mês`);
});
document.querySelectorAll('[data-world-speed]').forEach(b => b.addEventListener('click', () => saveWorld(W.setSpeed(world(), Number(b.dataset.worldSpeed) * 60000), `velocidade ${b.dataset.worldSpeed} min/mês`)));
$('#ad-world-adv').addEventListener('click', () => {
  const n = Math.floor(Number($('#ad-world').adv.value));
  if (!(n >= 1 && n <= 24)) return toast('Avançar de 1 a 24 meses.', true);
  if (confirm(`Avançar o mundo ${n} mês(es) para TODOS os jogadores? Cobranças, safras e parcelas rodam para todos.`)) saveWorld(W.advance(world(), n), `avanço de ${n} meses`);
});
setInterval(() => { if (!$('#ad-world').closest('[data-panel]').hidden) showWorld(); }, 1000);
$('#ad-config').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const data = { ...cfg, xp_mult: Number(f.xp_mult.value), daily_mult: Number(f.daily_mult.value), job_mult: Number(f.job_mult.value), prize_mult: Number(f.prize_mult.value),
    event: f.event.value.trim(), maintenance: f.maintenance.checked, maintenance_msg: f.maintenance_msg.value.trim() };
  if (data.maintenance && !confirm('Colocar o jogo em manutenção? Todos os jogadores ficam bloqueados até você desligar.')) return;
  const { error } = await sb.from('game_config').update({ data, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) return fail(error, 'salvar');
  await log('config', null, data); toast('Configuração salva. Os jogos aplicam em até 1 minuto.');
});
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const f = $('#ad-config'), w = b.dataset.preset === 'weekend';
  f.xp_mult.value = w ? '2' : '1'; f.daily_mult.value = w ? '2' : '1'; f.job_mult.value = w ? '1.5' : '1'; f.prize_mult.value = '1';
  f.event.value = w ? 'Fim de semana em dobro: XP e roleta do dia valem 2x' : ''; f.maintenance.checked = false;
  toast('Preenchido. Confira e clique em "salvar configuração".');
}));
$('#ad-gift-all').addEventListener('submit', async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), amount = Math.trunc(Number(f.amount) || 0);
  if (amount <= 0) return toast('Digite uma quantidade positiva.', true);
  const { data, error } = await sb.rpc('admin_users', { q: '', lim: 1000 });
  if (error) return fail(error, 'listar os jogadores');
  const rows = (data || []).filter(u => !u.banned).map(u => ({ user_id: u.user_id, kind: f.kind, amount, note: f.note || null }));
  if (!confirm(`Enviar ${int(amount)} ${f.kind === 'money' ? 'reais' : f.kind === 'chips' ? 'fichas' : 'XP'} para ${rows.length} jogadores?`)) return;
  for (let i = 0; i < rows.length; i += 200) { const { error: e2 } = await sb.from('admin_grants').insert(rows.slice(i, i + 200)); if (e2) return fail(e2, 'enviar o presente'); }
  await log('gift_all', null, { kind: f.kind, amount, count: rows.length, note: f.note }); toast(`Presente enviado para ${rows.length} jogadores.`);
});

// ---------- avisos ----------
async function loadAnns() {
  const { data, error } = await sb.from('announcements').select('id, text, kind, ends_at, created_at').order('created_at', { ascending: false }).limit(50);
  if (error) return fail(error, 'carregar os avisos');
  $('#ad-anns').innerHTML = (data || []).map(a => `<tr><td>${esc(a.text)}</td><td>${esc(a.kind)}</td><td>${a.ends_at ? when(a.ends_at) : 'sem prazo'}</td>
    <td><button class="btn btn--glass btn--sm" data-del-ann="${a.id}">apagar</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum aviso.</td></tr>';
  document.querySelectorAll('[data-del-ann]').forEach(b => b.addEventListener('click', async () => {
    const { error: e2 } = await sb.from('announcements').delete().eq('id', Number(b.dataset.delAnn));
    if (e2) return fail(e2, 'apagar'); await log('announcement_delete', null, { id: b.dataset.delAnn }); loadAnns();
  }));
}
$('#ad-ann').addEventListener('submit', async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), hours = Number(f.hours);
  const { error } = await sb.from('announcements').insert({ text: f.text.trim(), kind: f.kind, ends_at: hours ? new Date(Date.now() + hours * 36e5).toISOString() : null });
  if (error) return fail(error, 'publicar');
  await log('announcement', null, { text: f.text, kind: f.kind, hours }); e.target.reset(); toast('Aviso publicado.'); loadAnns();
});

// ---------- terras que sumiram (supabase/terras.sql) ----------
let lands = [];
async function loadLands() {
  if (!users.length) await loadUsers('');
  const { data, error } = await sb.from('land_audit').select('id, user_id, at, land, reason, money_before, money_after, month_before, month_after, dev, restored_at').order('at', { ascending: false }).limit(300);
  if (error) { $('#ad-lands').innerHTML = `<tr><td colspan="7" class="muted">${/land_audit/.test(error.message) ? 'A auditoria de terras ainda não foi ligada no banco.' : esc(error.message)}</td></tr>`; return; }
  lands = data || []; drawLands();
}
function drawLands() {
  const only = $('#ad-lands-only').checked, name = id => users.find(u => u.user_id === id)?.name || id.slice(0, 8);
  const rows = lands.filter(r => !only || !r.reason);
  $('#ad-lands').innerHTML = rows.map(r => `<tr><td>${when(r.at)}</td><td><a href="#" data-user="${esc(r.user_id)}">${esc(name(r.user_id))}</a></td>
    <td>${int(r.land?.ha)} ha · ${esc(r.land?.region || '?')}${r.land?.use ? ` · ${esc(r.land.use)}` : ''}<br><small class="muted">valor ${brl(r.land?.value)}</small></td>
    <td>${r.reason ? `<span class="tag tag--green">${esc(r.reason)}</span>` : '<span class="tag tag--red">sem explicação</span>'}</td>
    <td class="num">${brl(r.money_before)} → ${brl(r.money_after)}</td><td>${r.month_before ?? '—'} → ${r.month_after ?? '—'}</td>
    <td>${r.restored_at ? `<small class="muted">devolvida ${when(r.restored_at)}</small>` : `<button class="btn btn--gold btn--sm" data-land-restore="${r.id}">devolver</button>`}</td></tr>`).join('')
    || `<tr><td colspan="7" class="muted">${only ? 'Nenhuma terra sumiu sem explicação.' : 'Nada registrado ainda.'}</td></tr>`;
}
$('#ad-lands-only')?.addEventListener('change', drawLands);
document.addEventListener('click', async e => {
  const u = e.target.closest('#ad-lands [data-user]'); if (u) { e.preventDefault(); return openPlayer(u.dataset.user); }
  const b = e.target.closest('[data-land-restore]'); if (!b) return;
  const r = lands.find(x => String(x.id) === b.dataset.landRestore); if (!r || !confirm(`Devolver ${r.land?.ha} ha em ${r.land?.region} para este jogador?`)) return;
  b.disabled = true;
  const { error } = await sb.from('admin_grants').insert({ user_id: r.user_id, kind: 'land', amount: 0, item: r.land, note: 'terra que sumiu na sincronização' });
  if (error) { b.disabled = false; return fail(error, 'devolver a terra'); }
  await sb.from('land_audit').update({ restored_at: new Date().toISOString() }).eq('id', r.id);
  await log('restore_land', r.user_id, { land: r.land }); toast('Terra devolvida. O jogador recebe na próxima vez que abrir o jogo.'); loadLands();
});

// ---------- livro-caixa do jogador por categoria (ficha do jogador) ----------
function ledger(s) {
  const log = Array.isArray(s.log) ? s.log : [], by = {}, g = e => groupOf(String(e.txt || ''));
  for (const e of log) { const k = g(e); (by[k] ??= { n: 0, in: 0, out: 0 }).n++; if (e.val > 0) by[k].in += e.val; else by[k].out += e.val || 0; }
  const name = k => GROUPS.find(x => x[0] === k)?.[1] || k;
  const chips = Object.entries(by).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<button type="button" class="btn btn--glass btn--sm" data-ledger="${esc(k)}">${esc(name(k))} <small>(${v.n})</small></button>`).join(' ');
  const rows = log.map(e => `<tr data-g="${esc(g(e))}"><td>${e.m ?? '—'}</td><td>${esc(name(g(e)))}</td><td>${esc(e.txt)}</td><td class="num ${e.val < 0 ? 'neg' : ''}">${e.val ? brl(e.val) : ''}</td></tr>`).join('');
  const sum = Object.entries(by).map(([k, v]) => `<tr><td>${esc(name(k))}</td><td class="num">${v.n}</td><td class="num">${brl(v.in)}</td><td class="num">${brl(v.out)}</td><td class="num">${brl(v.in + v.out)}</td></tr>`).join('');
  return `<h3>livro-caixa por categoria <small class="muted">(últimos ${log.length} lançamentos do save)</small></h3>
    <div class="ad-tablewrap"><table><thead><tr><th>categoria</th><th class="num">lançamentos</th><th class="num">entrou</th><th class="num">saiu</th><th class="num">saldo</th></tr></thead><tbody>${sum || '<tr><td colspan="5" class="muted">Sem lançamentos.</td></tr>'}</tbody></table></div>
    <div class="row" id="ap-ledger-f"><button type="button" class="btn btn--gold btn--sm" data-ledger="">todas</button> ${chips}</div>
    <div class="ad-tablewrap ad-ledger"><table><thead><tr><th>mês</th><th>categoria</th><th>lançamento</th><th class="num">valor</th></tr></thead><tbody id="ap-ledger">${rows}</tbody></table></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ledger]'); if (!b) return;
  for (const x of document.querySelectorAll('#ap-ledger-f [data-ledger]')) x.className = `btn btn--sm ${x === b ? 'btn--gold' : 'btn--glass'}`;
  for (const tr of document.querySelectorAll('#ap-ledger tr')) tr.hidden = !!b.dataset.ledger && tr.dataset.g !== b.dataset.ledger;
});

// ---------- todos os saves (análise de terras e livro-caixa geral) ----------
let allSaves = null;
async function loadAllSaves(st) {
  if (allSaves) return allSaves;
  if (!users.length) await loadUsers('');
  const out = [];
  for (let from = 0; ; from += 200) {
    st.textContent = `lendo saves... ${out.length}`;
    const { data, error } = await sb.from('saves').select('user_id, lands:data->lands, log:data->log').range(from, from + 199);
    if (error) throw error;
    out.push(...(data || [])); if (!data || data.length < 200) break;
  }
  st.textContent = `${out.length} saves lidos`;
  return (allSaves = out);
}
const pname = id => users.find(u => u.user_id === id)?.name || String(id).slice(0, 8);
let found = [];
async function scanLands() {
  const st = $('#ad-scan-st'); $('#ad-scan').disabled = true;
  try {
    allSaves = null;
    const rows = await loadAllSaves(st);
    found = rows.flatMap(r => lostLands({ lands: r.lands, log: r.log }).map(x => ({ ...x, user_id: r.user_id })));
    st.textContent = `${rows.length} contas analisadas · ${found.length} terra(s) sumida(s)`;
    $('#ad-scan-all').hidden = !found.some(f => f.paid > 0);
    drawScan();
  } catch (e) { fail(e, 'analisar as contas'); st.textContent = ''; } finally { $('#ad-scan').disabled = false; }
}
function drawScan() {
  $('#ad-scan-out').innerHTML = found.map((f, i) => `<tr><td><a href="#" data-user="${esc(f.user_id)}">${esc(pname(f.user_id))}</a></td><td>${esc(f.land)}</td><td>${f.month ?? '—'}</td><td class="num">${f.paid ? brl(f.paid) : '<small class="muted">recebida em troca</small>'}</td>
    <td>${f.done ? '<small class="muted">devolvido</small>' : f.paid ? `<button class="btn btn--gold btn--sm" data-refund="${i}">devolver ${brl(f.paid)}</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Nenhuma terra sumida encontrada.</td></tr>';
}
async function refund(f) {
  const { error } = await sb.from('admin_grants').insert({ user_id: f.user_id, kind: 'money', amount: f.paid, note: `devolução de terra que sumiu: ${f.land}` });
  if (error) throw error;
  f.done = true; await log('refund_land', f.user_id, { land: f.land, amount: f.paid });
}
$('#ad-scan')?.addEventListener('click', scanLands);
$('#ad-scan-all')?.addEventListener('click', async () => {
  const todo = found.filter(f => f.paid && !f.done); if (!todo.length || !confirm(`Devolver ${todo.length} terra(s), total ${brl(todo.reduce((t, f) => t + f.paid, 0))}?`)) return;
  try { for (const f of todo) await refund(f); toast('Devoluções enviadas. Cada jogador recebe na próxima vez que abrir o jogo.'); } catch (e) { fail(e, 'devolver'); }
  drawScan();
});
document.addEventListener('click', async e => {
  const u = e.target.closest('#ad-scan-out [data-user], #ad-bk [data-user]'); if (u) { e.preventDefault(); return openPlayer(u.dataset.user); }
  const b = e.target.closest('[data-refund]'); if (!b) return;
  const f = found[Number(b.dataset.refund)]; if (!f || f.done || !confirm(`Devolver ${brl(f.paid)} para ${pname(f.user_id)} (${f.land})?`)) return;
  b.disabled = true; try { await refund(f); toast('Devolução enviada.'); } catch (err) { b.disabled = false; fail(err, 'devolver'); } drawScan();
});

// livro-caixa geral: lançamentos de todos os jogadores
let book = [];
const gname = k => GROUPS.find(x => x[0] === k)?.[1] || k;
$('#ad-bk-cat') && ($('#ad-bk-cat').innerHTML += GROUPS.map(g => `<option value="${esc(g[0])}">${esc(g[1])}</option>`).join(''));
async function loadBook() {
  try {
    const rows = await loadAllSaves($('#ad-bk-st'));
    book = rows.flatMap(r => (Array.isArray(r.log) ? r.log : []).map((e, i) => ({ u: r.user_id, n: pname(r.user_id), m: Number(e.m) || 0, i, txt: String(e.txt || ''), val: Number(e.val) || 0, g: groupOf(String(e.txt || '')) })))
      .sort((a, b) => b.m - a.m || a.i - b.i);
    drawBook();
  } catch (e) { fail(e, 'carregar os livros-caixa'); }
}
function drawBook() {
  const c = $('#ad-bk-cat').value, q = $('#ad-bk-q').value.trim().toLowerCase();
  const rows = book.filter(e => (!c || e.g === c) && (!q || e.n.toLowerCase().includes(q) || e.txt.toLowerCase().includes(q)));
  $('#ad-bk-st').textContent = `${rows.length} lançamentos${rows.length > 1500 ? ' (mostrando 1.500)' : ''}`;
  $('#ad-bk').innerHTML = rows.slice(0, 1500).map(e => `<tr><td><a href="#" data-user="${esc(e.u)}">${esc(e.n)}</a></td><td>${e.m}</td><td>${esc(gname(e.g))}</td><td>${esc(e.txt)}</td><td class="num ${e.val < 0 ? 'neg' : ''}">${e.val ? brl(e.val) : ''}</td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Clique em carregar.</td></tr>';
}
$('#ad-bk-load')?.addEventListener('click', () => { allSaves = null; loadBook(); });
$('#ad-bk-cat')?.addEventListener('change', drawBook);
$('#ad-bk-q')?.addEventListener('input', drawBook);

// ---------- registro ----------
async function loadLog() {
  const { data, error } = await sb.from('admin_log').select('created_at, admin, action, target, details').order('created_at', { ascending: false }).limit(150);
  if (error) return fail(error, 'carregar o registro');
  const name = id => users.find(u => u.user_id === id)?.name || (id ? id.slice(0, 8) : '—');
  $('#ad-log').innerHTML = (data || []).map(l => `<tr><td>${when(l.created_at)}</td><td>${esc(l.admin)}</td><td>${esc(ACTION_TXT[l.action] || String(l.action).replace(/_/g, ' '))}</td><td>${esc(name(l.target))}</td>
    <td class="small">${esc(detailsTxt(l.details))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nada registrado.</td></tr>';
}

boot().catch(e => fail(e, 'iniciar o painel'));

// acompanha a ordem até o jogo do jogador aplicar (sem precisar recarregar o painel)
function watchGrant(gid, uid) {
  let n = 0;
  const t = setInterval(async () => {
    const { data } = await sb.from('admin_grants').select('applied_at').eq('id', gid).maybeSingle();
    if (data?.applied_at) { clearInterval(t); toast('Aplicado no jogo do jogador.'); if ($('#ad-player')?.open) openPlayer(uid); }
    else if (++n >= 120) { clearInterval(t); toast('O jogador está offline: a ordem será aplicada quando ele entrar.'); }
  }, 2500);
}
// números do painel se atualizam sozinhos
setInterval(() => { if (!$('#ad-app').hidden && !$('[data-panel="overview"]').hidden) loadOverview(); }, 15000);

// ---------- regras do jogo (game_config.data.tuning, lidas pelo jogo em tune.js) ----------
import('./tune.js').then(({ DEFAULTS }) => {
  const f = $('#ad-tune'); if (!f) return;
  const fill = t => {
    const v = { ...DEFAULTS, ...(t || {}) };
    f.npcBoost.value = v.npcBoost; f.npcRampDays.value = v.npcRampDays; f.hunt.checked = !!v.hunt; f.huntLeadPct.value = Math.round((v.huntLead - 1) * 100);
    f.near.checked = !!v.near; f.incomeTaxPct.value = +(v.incomeTax * 100).toFixed(1); f.incomeMin.value = v.incomeMin;
    f.landPremiumPct.value = Math.round((v.landPremium - 1) * 100); f.landOffers.value = v.landOffers; f.bizMult.value = v.bizMult;
  };
  const read = () => ({ npcBoost: +f.npcBoost.value, npcRampDays: +f.npcRampDays.value, hunt: f.hunt.checked, huntLead: 1 + f.huntLeadPct.value / 100, near: f.near.checked,
    incomeTax: f.incomeTaxPct.value / 100, incomeMin: +f.incomeMin.value,
    landPremium: 1 + f.landPremiumPct.value / 100, landOffers: +f.landOffers.value, bizMult: +f.bizMult.value });
  const save = async (tuning, what) => {
    const { data: cur, error: e0 } = await sb.from('game_config').select('data').eq('id', 1).maybeSingle();
    if (e0) return fail(e0, 'ler a configuração');
    const data = { ...(cur?.data || {}), tuning }; cfg = data;
    const { error } = await sb.from('game_config').update({ data, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return fail(error, 'salvar as regras');
    await log('tuning', null, { what, ...tuning }); fill(tuning); toast('Regras salvas. Todos os jogos aplicam em até 1 minuto.');
  };
  tuneLoad = async () => { const { data } = await sb.from('game_config').select('data').eq('id', 1).maybeSingle(); fill(data?.data?.tuning); };
  f.addEventListener('submit', e => { e.preventDefault(); save(read(), 'manual'); });
  $('#ad-tune-reset').addEventListener('click', () => { if (confirm('Voltar todas as regras ao padrão?')) save({ ...DEFAULTS }, 'padrão'); });
  document.querySelectorAll('[data-tune-preset]').forEach(b => b.addEventListener('click', () => {
    const easy = b.dataset.tunePreset === 'facil';
    fill(easy ? { ...DEFAULTS, npcBoost: 1.5, npcRampDays: 60, huntLead: 0.97, near: false, incomeTax: 0.03, landPremium: 1.15, bizMult: 1.2 }
      : { ...DEFAULTS, npcBoost: 5, npcRampDays: 14, huntLead: 1.08, incomeTax: 0.1, incomeMin: 150000, landPremium: 1.6, bizMult: 0.85 });
    toast('Preenchido. Confira e clique em "salvar regras".');
  }));
});

// ---------- donos únicos (mina e marcas) ----------
const BRAND_NAMES = { roxinho: 'Roxinho Bank', enter: 'Banco Enter', santandre: 'Santandré', caixa: 'Caixa Federau', bradeskao: 'Bradeskão', itai: 'Itaí Unibanco', brasa: 'Banco do Brasa',
  netroca: 'NetRoça Fibra', giga21: 'Giga21 Telecom', timtim: 'TimTim Live', oi: 'Ói Fibra', clarao: 'Clarão Net', viva: 'Viva Fibra',
  zezinho: 'Mercadinho do Zezinho', acai: 'Açaí Atacadista', paoacucre: 'Pão de Açucre', carrefur: 'Carrefur',
  canaa: 'Usina Canaã', bomjesus: 'Usina Bom Jesus do Açúcar', dourado: 'Citrus Dourado Sucos', laranjal: 'Laranjal Paulista Sucos',
  ...Object.fromEntries(CAT_KEYS.flatMap(c => Object.entries(BIZ[c]).map(([id, x]) => [id, x.name]))) };
async function loadOwners() {
  const [m, c] = await Promise.all([sb.from('gold_mine').select('owner, owner_name, since').eq('id', 1).maybeSingle(), sb.from('company_owner').select('brand, owner, owner_name, since').order('since', { ascending: false })]);
  const rows = [];
  if (m.error) rows.push('<tr><td>mina de ouro</td><td colspan="3" class="muted">ainda não ligada no banco</td></tr>');
  else rows.push(`<tr><td>⛏️ mina de ouro</td><td>${m.data?.owner ? esc(m.data.owner_name || 'jogador') : '<span class="muted">à venda</span>'}</td><td>${when(m.data?.since)}</td><td>${m.data?.owner ? '<button class="btn btn--danger btn--sm" data-free-mine>liberar</button>' : ''}</td></tr>`);
  if (c.error) rows.push('<tr><td>empresas</td><td colspan="3" class="muted">ainda não ligadas no banco</td></tr>');
  else {
    const owned = new Map((c.data || []).map(r => [r.brand, r]));
    for (const [id, name] of Object.entries(BRAND_NAMES)) { const r = owned.get(id); rows.push(`<tr><td>${esc(name)}</td><td>${r ? esc(r.owner_name || 'jogador') : '<span class="muted">à venda</span>'}</td><td>${r ? when(r.since) : '—'}</td><td>${r ? `<button class="btn btn--danger btn--sm" data-free-brand="${id}">liberar</button>` : ''}</td></tr>`); }
  }
  $('#ad-owners').innerHTML = rows.join('');
}
$('#ad-own-reload')?.addEventListener('click', loadOwners);
document.addEventListener('click', async e => {
  const bm = e.target.closest('[data-free-mine]'), bb = e.target.closest('[data-free-brand]'); if (!bm && !bb) return;
  const what = bm ? 'a mina de ouro' : BRAND_NAMES[bb.dataset.freeBrand];
  if (!confirm(`Liberar ${what} para a loja? O dono atual perde e recebe o valor de volta quando o jogo dele sincronizar.`)) return;
  const { data, error } = bm ? await sb.rpc('admin_release_mine') : await sb.rpc('admin_release_company', { p_brand: bb.dataset.freeBrand });
  if (error || data !== 'ok') return fail(error || data, 'liberar (falta ligar esta parte no banco)');
  await log('release_owner', null, { what }); toast(`${what} voltou para a loja.`); loadOwners();
});

// ---------- vigilância (admin-econ.js watch): quem enriqueceu rápido demais, Pix, cassino, Receita, tempo jogado ----------
const hrs = h => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1).replace('.', ',')} h`);
async function pageAll(q) { const out = []; for (let f = 0; ; f += 500) { const { data, error } = await q().range(f, f + 499); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 500) return out; } }
// ---------- diário: tudo o que cada jogador fez (supabase/diario.sql) ----------
let dj = null;
const djName = id => (users.find(u => u.user_id === id)?.name) || String(id).slice(0, 8);
const hm = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const sgn = v => `<span class="${v > 0 ? 'good' : v < 0 ? 'bad' : ''}">${v > 0 ? '+' : ''}${brl(v)}</span>`;
// cada botão que o jogador clicou, em palavras (o valor depois de ":" ou "=" diz qual: tela, ativo, minutos...)
const TELA = { inicio: 'início', mesa: 'salão de jogos', corridas: 'corrida de galgos', cartas: 'cartas', futebol: 'futebol', terras: 'terras e soja', gado: 'gado', suinos: 'suínos',
  granja: 'granja', laranja: 'laranja', cana: 'cana', haras: 'canil e haras', banco: 'banco', inventario: 'inventário', loja: 'loja', personagem: 'personagem', ranking: 'ranking',
  pro: 'profissionais', negocios: 'empresas', trader: 'investimentos', mercado: 'mercado de grãos', livro: 'livro-caixa', equipe: 'equipe', menu: 'menu', voce: 'você', fazenda: 'fazenda', jogos: 'jogos', '': 'desconhecida' };
const tela = v => TELA[v] ?? v;
const ATIVO = { btc: 'bitcoin', ibov: 'Ibovespa', petr: 'Petrobras', vale: 'Vale', itau: 'Itaú', dol: 'dólar', boi: 'boi gordo', soja: 'soja' };
const pick = (o, v) => o[v] || v;
const ROLETA = v => String(v).replace('n:', 'número ').replace('red', 'vermelho').replace('black', 'preto').replace('even', 'par').replace('odd', 'ímpar').replace('low', '1 a 18').replace('high', '19 a 36').replace(/^dz(\d)/, '$1ª dúzia');
const ACT = {
  tab: v => `abriu a tela ${tela(v)}`, tabGo: v => `abriu a tela ${tela(v)}`, mnav: v => (v === 'close' ? 'fechou o menu' : `abriu a tela ${tela(v)} pelo menu`), cat: v => `abriu o grupo ${tela(v)} do menu`,
  close: () => 'fechou uma janela', fechar: () => 'fechou uma janela', '×': () => 'fechou uma janela', entendi: () => 'fechou um aviso (entendi)', '‹': () => 'voltou',
  'open-pass': () => 'abriu o passe', 'pass-claim': v => `resgatou o prêmio do passe${v ? ` (nível ${v})` : ''}`, 'open-missions': () => 'abriu as missões', 'claim-mission': () => 'resgatou prêmio de missão',
  'open-chipx': () => 'abriu o caixa de fichas', 'chipx-go': () => 'confirmou a troca de fichas', cxDir: v => (v === 'in' ? 'caixa: escolheu comprar fichas' : 'caixa: escolheu trocar fichas por dinheiro'),
  cxPct: v => `caixa: escolheu ${Math.round(Number(v) * 100)}%`, cxClose: () => 'fechou o caixa de fichas',
  'buy-chips': () => 'comprou fichas', 'sell-chips': () => 'trocou fichas por dinheiro', 'cash-chips': () => 'trocou fichas por dinheiro', rchip: v => `escolheu ficha de ${v}`, add: v => `pôs ${v} fichas na aposta`,
  'spin-daily': () => 'girou a roleta do dia', 'close-daily': () => 'fechou a roleta do dia', 'sorte-open': () => 'abriu a sorte do dia', 'sorte-spin': () => 'girou a sorte do dia', 'sorte-close': () => 'fechou a sorte do dia',
  sub: v => `entrou no jogo ${pick({ 21: '21 (blackjack)' }, v)}`, bet: () => '21: apostou', hit: () => '21: pediu carta', stand: () => '21: parou', double: () => '21: dobrou', 'bet-clear': () => '21: limpou a aposta',
  sit: () => 'sentou numa mesa', 'leave-table': () => 'saiu da mesa',
  'rl-spin': () => 'roleta: girou', 'rl-clear': () => 'roleta: limpou as apostas', rbet: v => `roleta: apostou em ${ROLETA(v)}`,
  'av-press': () => 'aviator: apostou ou parou', avQuick: v => `aviator: aposta rápida de ${v}`, 'agora! (espaço)': () => 'aviator: parou (espaço)',
  pk: v => `pôquer: ${pick({ create: 'criou mesa', house: 'jogou contra a casa', invite: 'convidou', call: 'pagou', raise: 'aumentou', check: 'deu mesa', fold: 'desistiu', allin: 'all-in', rebuy: 'comprou mais fichas' }, v)}`,
  'race-go': () => 'corrida: apostou e largou', 'race-pick': v => `corrida: escolheu o cachorro ${Number(v) + 1}`, 'race-next': () => 'corrida: próxima',
  'tr-asset': v => `investimentos: escolheu ${pick(ATIVO, v)}`, 'tr-tf': v => `investimentos: velas de ${v} min`, 'tr-dur': v => `investimentos: operação de ${v} min`,
  'tr-buy': () => 'investimentos: apostou que sobe', 'tr-sell': () => 'investimentos: apostou que desce',
  invApply: v => `aplicou em ${pick({ cdb: 'CDB', poupanca: 'poupança', previdencia: 'previdência', lca: 'LCA' }, v)}`, invOut: () => 'resgatou uma aplicação', invcat: v => `inventário: filtrou ${v === 'all' ? 'tudo' : v}`,
  'buy-land': v => `comprou a terra ${v}`, 'sell-land': v => `vendeu a terra ${v}`, lease: v => `arrendou a terra ${v}`, 'rent-land': v => `alugou a terra ${v}`, 'return-land': v => `devolveu a terra arrendada ${v}`,
  plant: v => `plantou na terra ${v}`, 'cn-plant': v => `plantou cana na terra ${v}`,
  'buy-good': v => `comprou ${v}`, 'sell-good': v => `vendeu ${v}`, 'buy-calves': () => 'comprou bezerros', 'ab-kill': v => `abateu ${v} bois`,
  'shop-sell': v => `vendeu para a loja ${String(v).startsWith('card') ? 'uma carta' : String(v).replace('good:', '')}`, 'shop-buy': () => 'comprou na loja', 'shop-cat': v => `loja: seção ${v === 'all' ? 'tudo' : v}`, loja: v => `loja: seção ${v}`,
  'card-sell': () => 'vendeu uma carta', 'card-pack': v => `abriu pacote de cartas ${v}`, 'card-close': () => 'fechou a carta', 'fe-buy': () => 'feira: comprou', 'fe-sell': () => 'feira: vendeu',
  'trade-confirm': () => 'confirmou troca com outro jogador', pix: v => pick({ pick: 'Pix: escolheu quem recebe', send: 'Pix: mandou', kind: 'Pix: escolheu o tipo' }, v), borrow: () => 'pegou empréstimo',
  profile: v => (v === 'me' ? 'abriu o próprio perfil' : 'abriu o perfil de outro jogador'), pftab: v => `perfil: aba ${v}`,
  'rk-cat': v => `ranking: categoria ${pick({ farm: 'fazendeiros', worth: 'patrimônio', clube: 'clubes', level: 'nível', casino: 'cassino', colls: 'colecionadores' }, v)}`, 'rk-page': v => `ranking: página ${Number(v) + 1}`,
  pro: v => `profissionais: ${pick({ view: 'viu um serviço', open: 'abriu', hire: 'contratou', confirm: 'confirmou', rate: 'avaliou', 'svc-add': 'cadastrou serviço' }, v)}`,
  'salvar perfil profission': () => 'salvou o perfil de profissional', agente: () => 'abriu o agente',
  fbSel: () => 'futebol: escolheu um palpite', fbMk: v => `futebol: aposta em ${pick({ res: 'resultado', cart: 'cartões', kick: 'saída de bola' }, v)}`, fbBet: () => 'futebol: apostou', fbQ: v => `futebol: valor rápido ${v}`,
  fbDiv: v => `futebol: série ${'ABC'[Number(v)] || v}`, fsub: v => `futebol: ${v === 'live' ? 'ao vivo' : 'meu clube'}`,
  'st-kind': v => `haras: ${v === 'horse' ? 'cavalos' : 'galgos'}`, 'st-train': () => 'haras: treinou', 'st-treat': () => 'haras: veterinário', 'st-buy': () => 'haras: comprou animal', 'st-premium': () => 'haras: ração premium',
  'char-tab': v => `personagem: aba ${v}`, look: () => 'personagem: trocou o visual', eq: () => 'abriu a equipe', jn: v => (v === 'sair' ? 'fechou o jornal' : 'jornal: próxima notícia'),
  tvMode: () => 'minimizou a TV', conv: () => 'abriu a conversa da TV', econOpen: () => 'abriu o painel da economia', chatOpen: () => 'abriu o chat', rzClose: () => 'fechou o aviso da Receita',
  cotações: () => 'abriu as cotações', fs: () => 'tela cheia', reset: () => 'clicou em reiniciar', logout: () => 'saiu da conta',
  'menu na lateral': () => 'mudou o menu para a lateral', 'menu no topo': () => 'mudou o menu para o topo',
};
const actWord = a => {
  const s = String(a || ''), n = s.match(/ x(\d+)$/)?.[1], r = s.replace(/ x\d+$/, ''), m = r.match(/^([^:=]+)[:=](.*)$/), k = m ? m[1] : r, v = m ? m[2] : '';
  let w;
  if (r.startsWith('tela: ')) w = `na tela ${tela(r.slice(6))}`;
  else if (ACT[k]) w = ACT[k](v);
  else if (/^avisos\d/.test(k)) w = 'mexeu nos avisos';
  else if (/^mundo|^ano \d/.test(k)) w = 'clicou no relógio do mundo';
  else if (/^\p{Extended_Pictographic}/u.test(k)) w = 'clicou num atalho do menu';
  else w = `clicou em "${k.replace(/^[a-z]{2}-/, '').replace(/[-_]/g, ' ')}"`;
  return n ? `${w} (${n}x)` : w;
};
const actLabel = a => esc(actWord(a));
const actsText = s => String(s || '').split(', ').filter(Boolean).map(actWord).join(' · ');
async function loadDiario() {
  const st = $('#ad-dj-st'), who = $('#ad-dj-who').value.trim().toLowerCase(); st.textContent = 'lendo o diário...'; $('#ad-dj-load').disabled = true;
  try {
    if (!users.length) await loadUsers('');
    $('#ad-dj-names').innerHTML = users.map(u => `<option value="${esc(u.name || '')}">`).join('');
    const ids = who ? users.filter(u => (u.name || '').toLowerCase() === who || (u.email || '').toLowerCase() === who).map(u => u.user_id) : [];
    if (who && !ids.length) { st.textContent = 'jogador não encontrado'; return; }
    const since = new Date(Date.now() - Number($('#ad-dj-per').value) * 36e5).toISOString();
    const rows = await pageAll(() => { let q = sb.from('diario').select('user_id, at, m, kind, txt, val, money, chips, worth, tab, acts').gt('at', since).order('at', { ascending: false }); if (ids.length) q = q.in('user_id', ids); return q; });
    dj = { rows, rep: AE.diaryReport(rows, Object.fromEntries(users.map(u => [u.user_id, u.name]))) };
    st.textContent = `${int(rows.length)} registros às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    drawDiario();
  } catch (e) { fail(e, 'carregar o diário (falta ligar esta parte no banco)'); st.textContent = ''; } finally { $('#ad-dj-load').disabled = false; }
}
function drawDiario() {
  if (!dj) return;
  const { rows, rep: R } = dj, gapT = R.players.reduce((t, p) => t + p.gap, 0), chipT = R.players.reduce((t, p) => t + p.chips, 0);
  $('#ad-dj-tiles').innerHTML = [['registros', int(rows.length)], ['jogadores', int(R.players.length)], ['dinheiro sem lançamento', brl(gapT)], ['vezes sem lançamento', int(R.players.reduce((t, p) => t + p.gapN, 0))],
    ['fichas ganhas (R$)', brl(chipT)], ['mudou entre sessões', int(R.jumps.length)]].map(([k, v]) => `<div class="ad-tile"><span>${k}</span><strong>${v}</strong></div>`).join('');
  const none = n => `<tr><td colspan="${n}" class="muted">Nada no período.</td></tr>`, ppl = a => esc(a.slice(0, 6).join(', ') + (a.length > 6 ? ` +${a.length - 6}` : ''));
  const who = n => `<a href="#" data-dj-who="${esc(n)}">${esc(n)}</a>`;
  $('#ad-dj-gap').innerHTML = R.gapBy.slice(0, 40).map(g => `<tr><td>${actLabel(g.act)}</td><td class="num">${sgn(g.val)}</td><td class="num">${int(g.n)}</td><td>${ppl(g.players)}</td></tr>`).join('') || none(4);
  $('#ad-dj-jump').innerHTML = R.jumps.slice(0, 40).map(j => `<tr><td>${who(j.name)}</td><td>${hm(j.prevAt)} → ${hm(j.at)}</td><td>${esc(j.why)}</td><td class="num">${brl(j.from)} → ${brl(j.to)}</td><td class="num">${sgn(j.diff)}</td></tr>`).join('') || none(5);
  $('#ad-dj-src').innerHTML = R.sources.slice(0, 60).map(x => `<tr><td title="${esc(x.ex)}">${esc(x.k)}</td><td class="num">${brl(x.in)}</td><td class="num">${brl(x.out)}</td><td class="num">${sgn(x.net)}</td><td class="num">${int(x.n)}</td><td class="num">${int(x.nPlayers)}</td><td>${x.top ? `${who(x.top[0])} (${brl(x.top[1])})` : ''}</td></tr>`).join('') || none(7);
  $('#ad-dj-chip').innerHTML = R.chipBy.slice(0, 30).map(g => `<tr><td>${actLabel(g.act)}</td><td class="num">${sgn(g.val)}</td><td class="num">${int(g.n)}</td><td>${ppl(g.players)}</td></tr>`).join('') || none(4);
  $('#ad-dj-pl').innerHTML = R.players.map(p => `<tr><td><strong>${who(p.name)}</strong></td><td class="num">${p.hours.toFixed(1).replace('.', ',')}</td><td class="num">${sgn(p.worthGain)}</td><td class="num">${sgn(Math.round(p.perHour))}</td>
    <td class="num">${brl(p.in)} / ${brl(p.out)}</td><td class="num">${p.gapN ? `${sgn(p.gap)} <small>(${p.gapN}x)</small>` : '—'}</td><td class="num">${p.chips ? sgn(p.chips) : '—'}</td><td class="num">${p.sessions}</td>
    <td><small>${p.top.filter(t => t.net > 0).slice(0, 3).map(t => `${esc(t.k)}: ${brl(t.net)}`).join('<br>')}</small></td></tr>`).join('') || none(9);
  drawTimeline();
}
function drawTimeline() {
  if (!dj) return;
  const kind = $('#ad-dj-kind').value, min = Number($('#ad-dj-min').value) || 0, q = $('#ad-dj-q').value.trim().toLowerCase();
  const list = dj.rows.filter(r => (!kind || r.kind === kind) && Math.abs(Number(r.val) || 0) >= min && (!q || `${r.txt} ${r.acts} ${actsText(r.acts)} ${r.tab}`.toLowerCase().includes(q))).slice(0, 1500);
  const tag = { gap: '<span class="tag tag--red">sem lançamento</span> ', fichas: '<span class="tag tag--gold">fichas</span> ', inicio: '<span class="tag tag--green">sessão</span> ' };
  $('#ad-dj-tl').innerHTML = list.map(r => `<tr><td>${hm(r.at)}</td><td>${esc(djName(r.user_id))}</td><td>${esc(tela(r.tab || ''))}</td><td class="num">${r.m ?? ''}</td><td>${tag[r.kind] || ''}${esc(r.txt)}</td><td class="num">${r.val ? sgn(Number(r.val)) : ''}</td>
    <td class="num">${brl(r.money)}</td><td class="num">${int(r.chips)}</td><td class="num">${brl(r.worth)}</td><td><small>${esc(actsText(r.acts))}</small></td></tr>`).join('') || '<tr><td colspan="10" class="muted">Nada com esse filtro.</td></tr>';
}
$('#ad-dj-load').addEventListener('click', loadDiario);
for (const id of ['#ad-dj-kind', '#ad-dj-min', '#ad-dj-q']) $(id).addEventListener('input', drawTimeline);
document.addEventListener('click', e => {
  const a = e.target.closest('[data-dj-who], [data-dj-open]'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  $('#ad-dj-who').value = a.dataset.djWho ?? a.dataset.djOpen; $('#ad-player')?.close?.(); show('diario'); loadDiario();
}, true);

let vg = null;
async function loadVigia() {
  const st = $('#ad-vg-st'); st.textContent = 'lendo saves, Pix e histórico...'; $('#ad-vg-reload').disabled = true;
  try {
    if (!users.length) await loadUsers('');
    const ago = d => new Date(Date.now() - d * 864e5).toISOString(), soft = p => p.catch(() => []);
    const [saves, hist, rc, gifts, pix, pix30, diary] = await Promise.all([
      pageAll(() => sb.from('saves').select('user_id, data, updated_at')),
      soft(pageAll(() => sb.from('save_history').select('user_id, saved_at, money').gt('saved_at', ago(1)))),
      soft(pageAll(() => sb.from('receita_casos').select('user_id'))),
      soft(pageAll(() => sb.from('admin_grants').select('user_id, amount').eq('kind', 'money').gt('amount', 0))),
      soft(pageAll(() => sb.from('pix').select('from_id, from_name, to_id, to_name, amount, memo, kind, at').gt('at', ago(7)).order('at', { ascending: false }))),
      soft(pageAll(() => sb.from('pix').select('from_id, from_name, to_id, to_name, amount, at').gt('at', ago(30)))),
      soft(pageAll(() => sb.from('diario').select('user_id, at, kind, txt, val, money, worth, acts, tab').in('kind', ['gap', 'inicio']).gt('at', ago(7)))),
    ]);
    // fazenda de contas (30 dias) e dinheiro sem lançamento (diário, 7 dias)
    const UI = Object.fromEntries(users.map(u => [u.user_id, { name: u.name, created: u.created_at }]));
    const farm = AE.pixFarm(pix30, UI), F = Object.fromEntries(farm.map(f => [f.id, f])), FS = {};
    for (const f of farm) for (const x of f.senders) if (x.ageDays != null && x.ageDays < AE.NEW_DAYS) FS[x.id] = { total: (FS[x.id]?.total || 0) + x.total, to: f.name };
    const DR = AE.diaryReport(diary, {}), GP = Object.fromEntries(DR.players.map(p => [p.id, p])), JP = {};
    for (const j of DR.jumps) if (j.diff > 0) JP[j.id] = Math.max(JP[j.id] || 0, j.diff);
    const by = (list, k) => list.reduce((m, x) => ((m[x[k]] ||= []).push(x), m), {});
    const H = by(hist, 'user_id'), R = by(rc, 'user_id'), Gf = by(gifts, 'user_id'), Pin = by(pix, 'to_id'), Pout = by(pix, 'from_id'), U = Object.fromEntries(users.map(u => [u.user_id, u]));
    const players = saves.map(x => { const u = U[x.user_id] || {}; return { id: x.user_id, name: u.name || x.data?.avatar?.name || '(sem nome)', created: u.created_at, banned: u.banned, s: x.data || {},
      hist: (H[x.user_id] || []).map(h => ({ t: Date.parse(h.saved_at), money: Number(h.money) || 0 })), pixIn: Pin[x.user_id] || [], pixOut: Pout[x.user_id] || [],
      receita: (R[x.user_id] || []).length, gifts: (Gf[x.user_id] || []).reduce((t, g) => t + Number(g.amount), 0),
      farm: F[x.user_id], farmSender: FS[x.user_id], gap: GP[x.user_id]?.gap || 0, gapN: GP[x.user_id]?.gapN || 0, jump: JP[x.user_id] || 0 }; });
    vg = { ...AE.watch(players), pix, saves, farm, UI };
    st.textContent = `${players.length} contas analisadas às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    drawVigia();
  } catch (e) { fail(e, 'carregar a vigilância'); st.textContent = ''; } finally { $('#ad-vg-reload').disabled = false; }
}
function drawVigia() {
  if (!vg) return;
  const on = new Set(online.map(p => p.uid).filter(Boolean)), R = vg.rows, sus = R.filter(r => r.score >= 3);
  const active = R.filter(r => r.weekH > 0), pixSum = vg.pix.reduce((t, p) => t + Number(p.amount), 0);
  const tiles = [['contas com save', int(R.length)], ['online agora', int(on.size)], ['suspeitos', int(sus.length)], ['chamaram atenção', int(R.filter(r => r.score > 0).length)],
    ['ritmo justo', vg.fair ? `${AE.brlShort(vg.fair)}/h` : 'pouca medição'], ['horas jogadas hoje (todos)', hrs(R.reduce((t, r) => t + r.todayH, 0))],
    ['média por jogador ativo', active.length ? `${hrs(active.reduce((t, r) => t + r.weekH, 0) / 7 / active.length)}/dia` : '—'], ['jogaram nos últimos 7 dias', int(active.length)],
    ['Pix em 7 dias', `${int(vg.pix.length)} · ${AE.brlShort(pixSum)}`], ['casos da Receita', int(R.reduce((t, r) => t + r.receita, 0))],
    ['patrimônio somado', AE.brlShort(R.reduce((t, r) => t + r.worth, 0))], ['sem tempo medido', int(R.filter(r => r.playH == null).length)]];
  $('#ad-vg-tiles').innerHTML = tiles.map(([k, v]) => `<div class="ad-tile"><span>${k}</span><strong>${v}</strong></div>`).join('');
  const b = $('#ad-vg-badge'); b.textContent = sus.length; b.hidden = !sus.length;
  drawCheats(on);
  const only = $('#ad-vg-only').checked, q = $('#ad-vg-q').value.trim().toLowerCase();
  const rows = R.filter(r => (!only || r.score > 0) && (!q || r.name.toLowerCase().includes(q)));
  const tone = r => (r.score >= 3 ? 'red' : r.score > 0 ? 'gold' : 'green'), money = v => (v == null ? '—' : `<span class="${v < 0 ? 'bad' : 'good'}">${AE.brlShort(v)}</span>`);
  $('#ad-vg').innerHTML = rows.map(r => `<tr${r.score >= 3 ? ' class="ad-alert"' : ''}><td><span class="tag tag--${tone(r)}">${r.score >= 3 ? 'alta' : r.score > 0 ? 'média' : 'ok'} · ${r.score}</span></td>
    <td><a href="#" data-vg-user="${esc(r.id)}"><strong>${esc(r.name)}</strong></a>${on.has(r.id) ? ' <span class="tag tag--green">online</span>' : ''}${r.banned ? ' <span class="tag tag--red">suspenso</span>' : ''}<br><small class="muted">conta de ${when(r.created)}</small></td>
    <td class="num">${AE.brlShort(r.worth)}</td><td class="num">${hrs(r.playH)} · ${hrs(r.todayH)} · ${hrs(r.weekH)}</td><td class="num">${r.perHour == null ? '—' : AE.brlShort(r.perHour)}</td>
    <td class="num">${money(r.money24)}</td><td class="num">${AE.brlShort(r.pixInSum)} / ${AE.brlShort(r.pixOutSum)}</td><td class="num">${money(r.casino)}</td>
    <td class="small">${r.why.length ? `<ul class="ad-why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<span class="muted">nada</span>'}</td>
    <td>${r.excess > 0 ? `<button class="btn btn--gold btn--sm" data-vg-take="${esc(r.id)}">tirar excesso ${AE.brlShort(r.excess)}</button> ` : ''}${r.score > 0 && !r.banned ? `<button class="btn btn--danger btn--sm" data-vg-ban="${esc(r.id)}">suspender 1 dia</button>` : ''}</td></tr>`).join('')
    || `<tr><td colspan="10" class="muted">${only ? 'Ninguém fora do normal agora.' : 'Nenhum jogador.'}</td></tr>`;
  const W0 = Object.fromEntries(R.map(r => [r.id, r.worth])), pair = {}, pk = p => [p.from_id, p.to_id].sort().join();
  for (const p of vg.pix) pair[pk(p)] = (pair[pk(p)] || 0) + 1;
  $('#ad-vg-pix').innerHTML = vg.pix.slice(0, 200).map(p => { const v = Number(p.amount), age = (Date.parse(p.at) - Date.parse(vg.UI[p.from_id]?.created || '')) / 864e5;
    const isNew = Number.isFinite(age) && age < AE.NEW_DAYS, start = v >= 5000 && v <= 20000, big = v > Math.max(100000, (W0[p.to_id] || 0) * 0.3), bad = isNew || start || big || pair[pk(p)] >= 3;
    const tags = [isNew ? `<span class="tag tag--red">conta nova (${age < 1 ? `${Math.max(1, Math.round(age * 24))} h` : `${Math.floor(age)} dia(s)`} de criada)</span>` : '', start ? '<span class="tag tag--red">valor do dinheiro inicial</span>' : '',
      pair[pk(p)] >= 3 ? `<span class="tag tag--gold">mesma dupla ${pair[pk(p)]}x</span>` : '', big ? '<span class="tag tag--gold">grande para quem recebeu</span>' : ''].join(' ');
    return `<tr${bad ? ' class="ad-alert"' : ''}><td>${when(p.at)}</td><td><a href="#" data-vg-user="${esc(p.from_id)}">${esc(p.from_name)}</a></td><td><a href="#" data-vg-user="${esc(p.to_id)}">${esc(p.to_name)}</a></td>
      <td class="num"><b>${brl(p.amount)}</b></td><td>${p.kind === 'pagamento' ? 'pagamento' : 'Pix'} ${tags}</td><td>${esc(p.memo || '')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Nenhum Pix nos últimos 7 dias.</td></tr>';
  const days = Array.from({ length: 7 }, (_, k) => new Date(Date.now() - 3 * 36e5 - (6 - k) * 864e5).toISOString().slice(0, 10));
  $('#ad-vg-play').innerHTML = [...R].filter(r => r.weekH > 0).sort((a, b) => b.weekH - a.weekH).slice(0, 30).map(r => `<tr><td><a href="#" data-vg-user="${esc(r.id)}">${esc(r.name)}</a>${on.has(r.id) ? ' <span class="tag tag--green">online</span>' : ''}</td>
    <td class="num">${hrs(r.weekH)}</td><td class="num">${hrs(r.todayH)}</td><td class="small">${days.map(d => hrs((r.s.play?.days?.[d] || 0) / 36e5)).join(' · ')}</td><td class="num">${hrs(r.playH)}</td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Ainda sem tempo medido (aparece quando os jogadores abrirem a versão nova do jogo).</td></tr>';
  const cur = Math.max(0, ...R.map(r => Number(r.s.month) || 0)), nm = Object.fromEntries(R.map(r => [r.id, r.name]));
  const moves = vg.saves.flatMap(x => (Array.isArray(x.data?.log) ? x.data.log : []).filter(e => Number(e.m) >= cur - 1 && e.val).map(e => ({ u: x.user_id, ...e })))
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, 40);
  $('#ad-vg-moves').innerHTML = moves.map(e => `<tr><td><a href="#" data-vg-user="${esc(e.u)}">${esc(nm[e.u] || '?')}</a></td><td>${e.m}</td><td>${esc(e.txt)}</td><td class="num ${e.val < 0 ? 'bad' : 'good'}">${brl(e.val)}</td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Sem movimentos.</td></tr>';
}
// cartões de alerta: o mais grave primeiro, com o motivo em palavras e os botões para agir
const certainty = s => (s >= 6 ? ['quase certeza', 'red'] : s >= 4 ? ['muito provável', 'red'] : ['vale conferir', 'gold']);
function drawCheats(on) {
  const ago = t => { const h = (Date.now() - Date.parse(t)) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`; };
  const farms = vg.farm.filter(f => f.sure || f.n >= 2);
  $('#ad-farm').innerHTML = farms.length ? `<h3>💸 fazenda de contas: várias contas mandando Pix para a mesma pessoa</h3>
    <p class="ad-help">Cada conta nova começa com dinheiro. Quem cria várias contas e manda esse dinheiro por Pix para a conta principal fica rico sem jogar. Abaixo, quem recebeu esses Pix nos últimos 30 dias e as contas que mandaram (com quantos dias de criada a conta tinha quando mandou).</p>
    ${farms.map(f => `<article class="ad-cheat ad-cheat--red"><header><span class="tag tag--red">${f.sure ? 'quase certeza' : 'muito provável'}</span> <b class="ad-cheat__name">${esc(f.name)}</b> recebeu <b>${brl(f.total)}</b> em ${f.n} Pix ${on.has(f.id) ? '<span class="tag tag--green">online agora</span>' : ''}</header>
      <p>${esc(f.story)} Primeiro Pix há ${ago(f.first)}, último há ${ago(f.last)}.</p>
      <div class="ad-tablewrap"><table><thead><tr><th>conta que mandou</th><th>idade da conta quando mandou</th><th class="num">Pix</th><th class="num">total</th></tr></thead><tbody>${f.senders.map(x => `<tr><td><a href="#" data-vg-user="${esc(x.id)}">${esc(x.name)}</a></td><td>${x.ageDays == null ? '—' : x.ageDays < 1 ? '<b class="bad">criada no mesmo dia</b>' : x.ageDays < AE.NEW_DAYS ? `<b class="bad">${Math.floor(x.ageDays)} dia(s)</b>` : `${Math.floor(x.ageDays)} dias`}</td><td class="num">${x.n}</td><td class="num">${brl(x.total)}</td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn btn--gold btn--sm" data-vg-user="${esc(f.id)}">abrir a ficha de ${esc(f.name)}</button>
        <button class="btn btn--danger btn--sm" data-farm-back="${esc(f.id)}">voltar ${esc(f.name)} para antes do 1º Pix</button>
        <button class="btn btn--danger btn--sm" data-farm-ban="${esc(f.id)}">suspender as ${f.senders.length} conta(s) que mandaram</button></div>
      <p class="muted small"><b>Voltar para antes do 1º Pix</b>: a conta dele fica como estava antes de receber, e tudo o que ele comprou depois volta para a loja. <b>Suspender</b>: as contas que mandaram ficam 30 dias sem entrar.</p></article>`).join('')}` : '';
  const list = vg.rows.filter(r => r.score >= 4 && !(farms.some(f => f.id === r.id) && r.why.length === 1)).slice(0, 12);
  $('#ad-cheat-st').textContent = `${farms.length} fazenda(s) de contas · ${list.length} jogador(es) com sinais fortes`;
  $('#ad-cheat').innerHTML = list.map(r => { const [lv, tone] = certainty(r.score);
    return `<article class="ad-cheat ad-cheat--${tone}"><header><span class="tag tag--${tone}">${lv}</span> <b class="ad-cheat__name">${esc(r.name)}</b> · patrimônio ${brl(r.worth)} · ${r.playH == null ? 'tempo jogado não medido' : `${hrs(r.playH)} jogadas`}${on.has(r.id) ? ' <span class="tag tag--green">online agora</span>' : ''}${r.banned ? ' <span class="tag tag--red">suspenso</span>' : ''}</header>
      <ul>${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <div class="row"><button class="btn btn--gold btn--sm" data-vg-user="${esc(r.id)}">abrir a ficha e voltar o save</button>
        ${r.excess > 0 ? `<button class="btn btn--glass btn--sm" data-vg-take="${esc(r.id)}">tirar o excesso (${AE.brlShort(r.excess)})</button>` : ''}
        ${!r.banned ? `<button class="btn btn--danger btn--sm" data-vg-ban="${esc(r.id)}">suspender 1 dia</button>` : ''}</div></article>`; }).join('')
    || (farms.length ? '' : '<p class="good">Nenhum sinal forte de trapaça agora. 👍</p>');
}
// na ficha do jogador: o que a vigilância viu sobre ele
function cheatBox(id) {
  const r = vg?.rows.find(x => x.id === id); if (!r || !r.score) return '';
  const [lv, tone] = certainty(r.score);
  return `<div class="ad-cheat ad-cheat--${tone}"><header><span class="tag tag--${tone}">${lv}</span> <b>o que a vigilância viu</b></header><ul>${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    <p class="small">Para desfazer, use <a href="#ap-hist">voltar a conta para um estado anterior</a>, mais abaixo nesta ficha.</p></div>`;
}
document.addEventListener('click', async e => {
  const bk = e.target.closest('[data-farm-back]'), bn = e.target.closest('[data-farm-ban]'); if (!bk && !bn) return;
  e.preventDefault(); e.stopPropagation();
  const f = vg?.farm.find(x => x.id === (bk ? bk.dataset.farmBack : bn.dataset.farmBan)); if (!f) return;
  if (bk) {
    const { data, error } = await sb.from('save_history').select('id, saved_at, money').eq('user_id', f.id).lt('saved_at', f.first).order('saved_at', { ascending: false }).limit(1);
    if (error) return fail(error, 'procurar a cópia');
    if (!data?.length) return toast(`Não há cópia da conta de ${f.name} de antes do primeiro Pix. Abra a ficha e escolha a mais antiga, ou tire o valor em "dar ou tirar".`, true);
    await restoreTo(f.id, data[0].id, when(data[0].saved_at), brl(data[0].money));
  } else {
    if (!confirm(`Suspender por 30 dias estas contas que mandaram Pix para ${f.name}?\n\n${f.senders.map(x => `${x.name}: ${brl(x.total)}`).join('\n')}`)) return;
    const reason = `Conta usada para mandar Pix para ${f.name}`.slice(0, 200), until = new Date(Date.now() + 30 * 864e5).toISOString();
    const { error } = await sb.from('bans').upsert(f.senders.map(x => ({ user_id: x.id, reason, until })));
    if (error) return fail(error, 'suspender as contas');
    await log('ban_farm', f.id, { count: f.senders.length, why: reason }); toast(`${f.senders.length} conta(s) suspensa(s) por 30 dias.`); await loadUsers(''); loadVigia();
  }
}, true);
$('#ad-vg-reload').addEventListener('click', loadVigia);
$('#ad-vg-only').addEventListener('change', drawVigia);
$('#ad-vg-q').addEventListener('input', drawVigia);
setInterval(() => { if (!$('#ad-app').hidden && !$('[data-panel="vigia"]').hidden) loadVigia(); }, 120000);   // relê tudo a cada 2 min
document.addEventListener('click', async e => {
  const u = e.target.closest('[data-vg-user]'); if (u) { e.preventDefault(); return openPlayer(u.dataset.vgUser); }
  const t = e.target.closest('[data-vg-take]'), bn = e.target.closest('[data-vg-ban]'); if (!t && !bn) return;
  const r = vg?.rows.find(x => x.id === (t ? t.dataset.vgTake : bn.dataset.vgBan)); if (!r) return;
  if (t) {
    if (!confirm(`Tirar ${brl(r.excess)} do caixa de ${r.name}?\n\nMotivo: ${r.why.join('; ')}\n\nO caixa dele pode ficar negativo.`)) return;
    const { error } = await sb.from('admin_grants').insert({ user_id: r.id, kind: 'money', amount: -r.excess, note: 'ajuste: ganho acima do ritmo normal do jogo' });
    if (error) return fail(error, 'tirar o excesso');
    await log('take_excess', r.id, { amount: r.excess, why: r.why }); toast('Ordem enviada. Sai do caixa dele quando o jogo sincronizar.');
  } else {
    if (!confirm(`Suspender ${r.name} por 1 dia?\n\nMotivo: ${r.why.join('; ')}`)) return;
    const reason = `Em análise: ${r.why[0] || 'ganho fora do normal'}`.slice(0, 200);
    const { error } = await sb.from('bans').upsert({ user_id: r.id, reason, until: new Date(Date.now() + 864e5).toISOString() });
    if (error) return fail(error, 'suspender');
    await log('ban', r.id, { reason, days: 1, from: 'vigilância' }); toast('Conta suspensa por 1 dia.'); await loadUsers(''); r.banned = true; drawVigia();
  }
});

// ---------- Central de Profissionais (supabase/profissionais.sql): denúncias, profissionais e contratos ----------
let proData = null;
const PRO_REASON = { nao_entregou: 'não entregou', fraude: 'golpe / fraude', abuso: 'abuso', outro: 'outro' };
async function loadPro() {
  const st = $('#ad-pro-st'); st.textContent = 'carregando...';
  const [p, r, c] = await Promise.all([sb.from('pro_profiles').select('*').order('updated_at', { ascending: false }).limit(500),
    sb.from('pro_reports').select('*').order('at', { ascending: false }).limit(200), sb.from('pro_contracts').select('*').order('updated_at', { ascending: false }).limit(150)]);
  if (p.error) { st.textContent = ''; $('#ad-pro-rep').innerHTML = '<tr><td colspan="7" class="muted">A Central de Profissionais ainda não foi ligada no banco.</td></tr>'; return; }
  proData = { pros: p.data || [], reports: r.data || [], contracts: c.data || [] };
  st.textContent = `${proData.pros.length} profissionais · ${proData.reports.filter(x => x.status === 'aberta').length} denúncia(s) aberta(s)`;
  drawPro();
}
function drawPro() {
  const { pros, reports, contracts } = proData, C = Object.fromEntries(contracts.map(c => [c.id, c])), open = reports.filter(r => r.status === 'aberta');
  const b = $('#ad-pro-badge'); b.textContent = open.length; b.hidden = !open.length;
  const held = c => c ? Math.max(0, c.paid - c.released - c.refunded) : 0;
  $('#ad-pro-tiles').innerHTML = [['profissionais', pros.length], ['aceitando contratos', pros.filter(p => p.active).length], ['suspensos agora', pros.filter(p => p.suspended_until && new Date(p.suspended_until) > new Date()).length],
    ['denúncias abertas', open.length], ['contratos ativos', contracts.filter(c => c.status === 'ativo').length], ['em disputa', contracts.filter(c => c.status === 'disputa').length],
    ['em custódia (contratos recentes)', brl(contracts.reduce((t, c) => t + held(c), 0))], ['faturado por todos', brl(pros.reduce((t, p) => t + Number(p.earned), 0))]]
    .map(([k, v]) => `<div class="ad-tile"><span>${k}</span><strong>${v}</strong></div>`).join('');
  $('#ad-pro-rep').innerHTML = reports.slice(0, 100).map(r => { const c = C[r.contract_id];
    return `<tr${r.status === 'aberta' ? ' class="ad-alert"' : ''}><td>${when(r.at)}</td><td>#${r.contract_id} ${esc(c?.service?.title || '')}<br><small class="muted">${c ? `${esc(c.client_name)} contratou ${esc(c.pro_name)} · ${brl(c.price)} · ${esc(c.status)}` : ''}</small></td>
      <td>${esc(PRO_REASON[r.reason] || r.reason)}</td><td class="small">${esc(r.text || '')}</td><td class="num">${brl(held(c))}</td>
      <td>${r.status === 'aberta' ? '<span class="tag tag--red">aberta</span>' : `<span class="tag tag--${r.status === 'procedente' ? 'gold' : 'green'}">${esc(r.status)}</span><br><small class="muted">${esc(r.decision || '')}</small>`}</td>
      <td>${r.status === 'aberta' ? `<button class="btn btn--danger btn--sm" data-prodec="${r.id}" data-fav="1">procedente: devolver ao contratante</button> <button class="btn btn--glass btn--sm" data-prodec="${r.id}" data-fav="0">improcedente: segue o contrato</button>` : ''}</td></tr>`; }).join('')
    || '<tr><td colspan="7" class="muted">Nenhuma denúncia.</td></tr>';
  const susp = p => p.suspended_until && new Date(p.suspended_until) > new Date();
  $('#ad-pro-list').innerHTML = pros.map(p => `<tr><td><a href="#" data-vg-user="${esc(p.user_id)}"><strong>${esc(p.name)}</strong></a><br><small class="muted">${esc(p.title)}</small></td>
    <td class="num">${Number(p.stars).toFixed(2)} <small class="muted">(${p.rating_n})</small></td><td class="num">${p.done}</td><td class="num">${p.delivered} / ${p.late}</td><td class="num">${p.strikes60}</td><td class="num">${brl(p.earned)}</td>
    <td>${susp(p) ? `<span class="tag tag--red">suspenso até ${when(p.suspended_until)}</span>` : p.active ? '<span class="tag tag--green">atendendo</span>' : '<span class="tag">pausado</span>'}${p.verified ? ' <span class="tag tag--gold">verificado</span>' : ''}</td>
    <td>${susp(p) ? `<button class="btn btn--glass btn--sm" data-proset="${esc(p.user_id)}" data-days="0">liberar</button>` : `<button class="btn btn--danger btn--sm" data-proset="${esc(p.user_id)}" data-days="7">suspender 7 dias</button>`}
      <button class="btn btn--glass btn--sm" data-proset="${esc(p.user_id)}" data-ver="${p.verified ? 0 : 1}">${p.verified ? 'tirar selo' : 'dar selo verificado'}</button></td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Ninguém criou perfil profissional ainda.</td></tr>';
  $('#ad-pro-ct').innerHTML = contracts.map(c => `<tr${c.status === 'disputa' ? ' class="ad-alert"' : ''}><td>#${c.id}<br><small class="muted">${when(c.created_at)}</small></td><td>${esc(c.service?.title || '')}<br><small class="muted">${brl(c.price)} ${esc(c.period)} · ${c.settled}/${c.periods} períodos</small></td>
    <td><a href="#" data-vg-user="${esc(c.client_id)}">${esc(c.client_name)}</a> → <a href="#" data-vg-user="${esc(c.pro_id)}">${esc(c.pro_name)}</a></td>
    <td class="num">${brl(c.paid)}</td><td class="num">${brl(c.released)}</td><td class="num">${brl(c.refunded)}</td><td class="num">${brl(held(c))}</td><td>${esc(c.status)}<br><small class="muted">${esc(c.last_event || '')}</small></td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Nenhum contrato ainda.</td></tr>';
}
$('#ad-pro-reload').addEventListener('click', loadPro);
document.addEventListener('click', async e => {
  const d = e.target.closest('[data-prodec]'), s = e.target.closest('[data-proset]'); if (!d && !s) return;
  if (d) {
    const fav = d.dataset.fav === '1', note = prompt(fav ? 'Denúncia procedente: o dinheiro em custódia volta ao contratante e o profissional leva 1 penalidade. Motivo (aparece no registro):' : 'Denúncia improcedente: o contrato segue e os períodos vencidos são pagos ao profissional. Motivo:');
    if (note === null) return;
    const { data, error } = await sb.rpc('admin_pro_decide', { p_report: Number(d.dataset.prodec), p_favor_client: fav, p_note: note });
    if (error || data !== 'ok') return fail(error || { message: data }, 'decidir a denúncia');
    toast('Denúncia decidida. Os dois jogadores recebem o resultado em até 30 s.');
  } else {
    const days = s.dataset.days != null ? Number(s.dataset.days) : null, ver = s.dataset.ver != null ? s.dataset.ver === '1' : null;
    if (days === 7 && !confirm('Suspender este profissional da Central por 7 dias? Ele some da busca e não pode ser contratado; os contratos atuais continuam.')) return;
    const { data, error } = await sb.rpc('admin_pro_set', { p_pro: s.dataset.proset, p_days: days, p_verified: ver });
    if (error || data !== 'ok') return fail(error || { message: data }, 'atualizar o profissional');
    toast('Feito.');
  }
  loadPro();
});
// ---------- Delegacia (supabase/delegacia.sql): B.O. que os jogadores registram uns contra os outros ----------
const BO_KIND = { golpe: 'estelionato', calote: 'calote', ofensa: 'injúria / ameaça', trapaca: 'fraude no jogo', multiconta: 'contas falsas', outro: 'outra' };
const BO_ST = { registrado: ['tag--red', 'novo'], investigando: ['tag--gold', 'em investigação'], procedente: ['tag--red', 'procedente'], arquivado: ['tag--green', 'arquivado'] };
const boNum = c => `${new Date(c.at).getFullYear()}/${String(c.id).padStart(6, '0')}`;
async function loadBo() {
  const st = $('#ad-bo-st'); st.textContent = 'carregando...';
  let q = sb.from('bo_casos').select('*').order('at', { ascending: false }).limit(200);
  if ($('#ad-bo-f').value === 'abertos') q = q.in('status', ['registrado', 'investigando']);
  const { data, error } = await q;
  if (error) { st.textContent = ''; $('#ad-bo').innerHTML = '<tr><td colspan="7" class="muted">A delegacia ainda não foi ligada no banco.</td></tr>'; return; }
  const novos = data.filter(c => c.status === 'registrado').length, b = $('#ad-bo-badge'); b.textContent = novos; b.hidden = !novos;
  const vezes = {}; for (const c of data) vezes[c.target] = (vezes[c.target] || 0) + 1;
  st.textContent = `${data.length} boletim(ns) · ${novos} novo(s)`;
  $('#ad-bo').innerHTML = data.map(c => { const s = BO_ST[c.status] || BO_ST.registrado, open = c.status === 'registrado' || c.status === 'investigando';
    return `<tr${c.status === 'registrado' ? ' class="ad-alert"' : ''}><td><b>${boNum(c)}</b><br><small class="muted">${when(c.at)}${c.fact_when ? `<br>fato: ${esc(c.fact_when)}` : ''}</small></td>
      <td><a href="#" data-vg-user="${esc(c.author)}">${esc(c.author_name)}</a> →<br><a href="#" data-vg-user="${esc(c.target)}"><strong>${esc(c.target_name)}</strong></a>${vezes[c.target] > 1 ? ` <span class="tag tag--red">${vezes[c.target]} B.O.</span>` : ''}</td>
      <td>${esc(BO_KIND[c.kind] || c.kind)}</td><td class="small" style="white-space:pre-wrap;max-width:22rem">${esc(c.story)}</td><td class="small" style="white-space:pre-wrap;max-width:18rem">${esc(c.proofs || '—')}</td>
      <td><span class="tag ${s[0]}">${s[1]}</span>${c.note ? `<br><small class="muted">“${esc(c.note)}”</small>` : ''}</td>
      <td>${open ? `${c.status === 'registrado' ? `<button class="btn btn--gold btn--sm" data-boset="${c.id}" data-st="investigando">abrir inquérito</button> ` : ''}<button class="btn btn--danger btn--sm" data-boset="${c.id}" data-st="procedente">procedente</button> <button class="btn btn--glass btn--sm" data-boset="${c.id}" data-st="arquivado">arquivar</button>` : `<button class="btn btn--glass btn--sm" data-boset="${c.id}" data-st="investigando">reabrir</button>`}</td></tr>`; }).join('')
    || '<tr><td colspan="7" class="muted">Nenhum boletim.</td></tr>';
}
const BO_MSG = { investigando: 'Inquérito instaurado. As provas estão sendo analisadas e o investigado será averiguado.', procedente: 'Ocorrência confirmada. O investigado foi responsabilizado conforme as regras do 21 World.', arquivado: 'Após análise, não foram encontradas provas suficientes. O caso foi arquivado.' };
$('#ad-bo-reload').addEventListener('click', loadBo);
$('#ad-bo-f').addEventListener('change', loadBo);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-boset]'); if (!b) return;
  const note = prompt('Resposta da delegacia ao noticiante (ele lê em "meus boletins"):', BO_MSG[b.dataset.st] || '');
  if (note === null) return;
  const { data, error } = await sb.rpc('admin_bo_set', { p_id: Number(b.dataset.boset), p_status: b.dataset.st, p_note: note });
  if (error || data !== 'ok') return fail(error || { message: data }, 'atualizar o B.O.');
  await log('bo', null, { id: Number(b.dataset.boset), status: b.dataset.st }); toast('B.O. atualizado.'); loadBo();
});
setInterval(async () => { if ($('#ad-app').hidden) return; const { data } = await sb.from('bo_casos').select('id').eq('status', 'registrado'); const b = $('#ad-bo-badge'); if (b && data) { b.textContent = data.length; b.hidden = !data.length; } }, 60000);
setInterval(async () => { if ($('#ad-app').hidden) return; const { data } = await sb.from('pro_reports').select('id').eq('status', 'aberta'); const b = $('#ad-pro-badge'); if (b && data) { b.textContent = data.length; b.hidden = !data.length; } }, 60000);
