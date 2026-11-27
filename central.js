// Painel administrativo. Tudo o que ele faz passa pelas regras do banco (admin.sql): sem ser admin, nada funciona.
import { SRV } from './cfg.js';
import { captcha } from './turnstile.js';
import * as W from './world.js';
import { LISTS as BIZ, CAT_KEYS } from './negocios.js';
import { GROUPS, groupOf } from './contador.js';
import { lostLands } from './land-check.js';
import * as AE from './admin-econ.js';

const LIB = ['https://cdn.jsdelivr.net/npm/@', 'supa', 'base/', 'supa', 'base-js@2.118.0/+esm'].join('');
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
  if (!SRV.url || !SRV.anonKey) { document.body.innerHTML = '<main class="ad-login"><div class="ad-card"><h1>login não configurado</h1><p>Configuração do servidor ausente.</p></div></main>'; return; }
  const lib = await import(LIB);
  sb = lib.createClient(SRV.url, SRV.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const { data } = await sb.auth.getSession();
  if (data.session) return enter(data.session.user);
  $('#ad-login').hidden = false;
}
$('#ad-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), err = $('#ad-err');
  err.hidden = true; $('#ad-submit').disabled = true;
  let tok; try { tok = await captcha($('#ad-cap')); } catch { $('#ad-submit').disabled = false; err.textContent = 'A verificação do Cloudflare falhou. Recarregue a página e tente de novo.'; err.hidden = false; return; }
  const { data, error } = await sb.auth.signInWithPassword({ email: String(f.email).trim(), password: f.password, options: { captchaToken: tok } });
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
  $('#ad-login').hidden = true; $('#ad-app').hidden = false; setTimeout(() => loadSent(true), 1500);   // badge de avisos pendentes
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
// menus por categoria (v287): vigilância (alertas, Pix, atividade, pano) · jogadores · comunidade · mundo · receita
const MENU = { alertas: ['vigia'], pix: ['pix'], atividade: ['atividade', 'overview'], jogadores: ['players'], investigar: ['diario', 'terras', 'livros'], mundo: ['economy', 'rules', 'owners', 'news'], delegacia: ['bo'], pano: ['pano'], enviados: ['sent'], vip: ['vip'], pedidos: ['pro', 'passwords'], registro: ['log'] };
let tuneLoad = null;
let vgAt = 0;   // vigilância lida há pouco: trocar de menu não relê tudo (cada leitura baixa vários MB); o botão atualizar relê
const vgLoad = () => (vg && Date.now() - vgAt < 600000 ? drawVigia() : loadVigia());
const LOAD = { vigia: vgLoad, pix: vgLoad, atividade: vgLoad, overview: () => loadOverview(), players: () => loadUsers(), diario: () => { if (!dj) loadDiario(); }, terras: () => loadLands(),
  economy: () => { loadConfig(); loadEconomy(); }, rules: () => tuneLoad?.(), owners: () => loadOwners(), news: () => loadAnns(), bo: () => loadBo(), pano: () => (vg ? drawPano() : loadVigia()), sent: () => loadSent(), vip: () => loadVip(), pro: () => loadPro(), passwords: () => loadPw(), log: () => loadLog() };
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
  if (!confirm(`Voltar a conta de ${nm} para a cópia de ${whenTxt || 'antes'} (${moneyTxt || ''} em caixa)?\n\nA conta fica exatamente como era naquela hora: dinheiro, fichas, nível, terras, itens e as vantagens que vêm deles. Tudo o que ele comprou depois volta para a loja (marcas, mina, frigorífico, acessórios) e o dinheiro que ele gastou volta como estava. Pix que ele mandou depois é desfeito (cancelado ou retirado de quem recebeu). O jogo dele recarrega na hora. O estado de agora fica guardado (dá para desfazer).`)) return null;
  const { data, error } = await sb.rpc('admin_restore_save', { p_id: Number(histId) });
  const ok = data === 'ok' || data?.ok;
  if (ok) try {   // avisa o aparelho dele na hora (o mesmo aviso que um aparelho manda ao outro): troca em ~1 s, não em 5
    const ch = sb.channel(`save-${uid}`);
    ch.subscribe(st => { if (st === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'saved', payload: { dev: 'admin' } }).finally(() => setTimeout(() => sb.removeChannel(ch), 2000)); });
  } catch {}
  if (error || !ok) { fail(error || { message: data?.err || data }, 'voltar a conta (o código novo das cópias já foi colado no banco?)'); return null; }
  const r = typeof data === 'object' ? data : {}, li = [];
  li.push(`A conta voltou a ser exatamente como estava em <b>${esc(whenTxt || when(r.from))}</b>. Se ${esc(nm)} estiver jogando, o jogo dele troca em segundos; se não, na próxima vez que abrir.`);
  if (r.freed?.length) li.push(`Voltaram para a loja (qualquer um pode comprar): <b>${r.freed.map(b => esc(BRAND_NAMES[b] || b)).join(', ')}</b>.`);
  if (r.mine) li.push(`Mina de ouro: <b>${esc(r.mine)}</b>.`);
  if (r.frig) li.push('O frigorífico dele saiu da lista de frigoríficos abertos para os outros jogadores.');
  if (r.acc > 0) li.push(`<b>${r.acc}</b> acessório(s) voltaram para o estoque da loja.`); else if (r.acc < 0) li.push(`${-r.acc} acessório(s) que ele tinha naquela hora saíram de novo do estoque da loja.`);
  if (r.lands) li.push(`${r.lands} terra(s) saíram da conta (marcadas como "save restaurado", não como sumiço).`);
  if (Number(r.pixIn)) li.push(`Pix que ele recebeu depois dessa hora: <b>${brl(r.pixIn)}</b>. Esse dinheiro saiu da conta dele. Quem mandou não recebe de volta (se foram contas falsas dele, o dinheiro some do jogo).`);
  if (Number(r.pixCancel)) li.push(`Pix que ele mandou depois dessa hora e ninguém tinha recebido ainda: <b>${brl(r.pixCancel)}</b>, cancelados (o dinheiro ficou com ele, como na cópia).`);
  if (Number(r.pixBack)) li.push(`Pix que ele mandou depois dessa hora e já tinham sido recebidos: <b>${brl(r.pixBack)}</b>. Esse valor sai de quem recebeu (${esc((r.pixBackTo || []).join(', ') || 'outros jogadores')}) na próxima vez que abrirem o jogo, porque na cópia o dinheiro ainda é dele.`);
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
    sb.from('save_history').select('id, saved_at, why, money, lands, chips, level, month, worth').eq('user_id', id).order('saved_at', { ascending: false }).limit(260).then(r => (r.error && /column/.test(r.error.message) ? sb.from('save_history').select('id, saved_at, why, money, lands').eq('user_id', id).order('saved_at', { ascending: false }).limit(260) : r)),
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
    <p class="ad-help">O servidor guarda uma cópia da conta a cada 5 minutos de jogo, sempre que o dinheiro cai muito ou some uma terra, e quando você clica em <b>guardar cópia agora</b>. Ficam só as cópias das últimas 12 horas (as mais antigas se apagam sozinhas, inclusive as que você guardou).<br>
      <b>Voltar para esta cópia</b> faz a conta ficar exatamente como estava naquela hora: o dinheiro, as fichas, as terras e tudo o que ele comprou depois <b>saem da conta</b>. Marcas (bancos, provedores, mercados, usinas), a mina de ouro, o frigorífico e os acessórios que ele não tinha naquela hora <b>voltam para a loja</b> na mesma hora, para outro jogador poder comprar. Antes de voltar, o estado de agora é guardado aqui também (dá para desfazer). Se ele estiver jogando, o jogo dele troca para a cópia em segundos.</p>
    ${hist.error ? '<p class="muted small">As cópias da conta ainda não foram ligadas no banco.</p>'
      : `<form class="row" id="ap-snap"><label class="field ad-grow"><span>anotação da cópia (opcional)</span><input class="input" name="note" maxlength="80" placeholder="ex.: antes de investigar o Pix"></label><button class="btn btn--gold" type="submit">guardar cópia agora</button></form>
      <div id="ap-restored"></div>
      <div class="ad-tablewrap ad-ledger"><table><thead><tr><th>quando</th><th>por que foi guardada</th><th class="num">dinheiro</th><th class="num">fichas</th><th class="num">patrimônio</th><th class="num">terras</th><th class="num">nível</th><th></th></tr></thead><tbody>
      ${(hist.data || []).map(h => `<tr class="${/administrador|restaurar/.test(h.why) ? 'ad-mark' : ''}"><td>${when(h.saved_at)}</td><td>${esc(WHY_TXT[h.why] || h.why)}</td><td class="num">${brl(h.money)}</td><td class="num">${h.chips != null ? int(h.chips) : '—'}</td><td class="num">${h.worth != null ? brl(h.worth) : '—'}</td><td class="num">${int(h.lands)}</td><td class="num">${h.level ?? '—'}</td>
        <td><button class="btn btn--glass btn--sm" data-restore="${h.id}" data-when="${esc(when(h.saved_at))}" data-money="${esc(brl(h.money))}">voltar para esta cópia</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">Nenhuma cópia guardada ainda.</td></tr>'}
      </tbody></table></div>`}
    ${ledger(s)}
    <section class="ad-full" id="ap-full"><button type="button" class="btn btn--gold" data-full-ledger="${esc(id)}">📒 abrir o livro-caixa completo (todo o histórico)</button>
      <p class="muted small">O save guarda só os últimos 200 lançamentos. Aqui vem tudo o que o jogo registrou dele desde 23/11/26, com busca, filtros, caixa depois de cada lançamento e planilha.</p></section>`;
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
  $('#ad-world-now').textContent = `Mês ${W.current(w)} do mundo. Cada mês dura ${+(w.monthMs / 60000).toFixed(2)} min reais de dia e ${+(w.nightMs / 60000).toFixed(2)} min de madrugada (01:00 às 09:00)${W.isNight() ? ', agora é madrugada' : ''}; o próximo chega em ${W.fmt(W.msLeft(w))}.`;
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

// ---------- terras que sumiram (terras.sql) ----------
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

// ---------- livro-caixa completo: tudo do diário (guardado 1 ano), lido só quando o admin pede ----------
let FL = null;
const fold = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dtm = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const flName = k => GROUPS.find(x => x[0] === k)?.[1] || k;
async function loadFull(id) {
  const box = $('#ap-full'); box.innerHTML = '<p class="muted">Lendo todo o histórico...</p>';
  try {
    const rows = (await pageAll(() => sb.from('diario').select('id, at, m, kind, txt, val, money, tab').eq('user_id', id).in('kind', ['log', 'gap']))).reverse();   // mais novo primeiro
    for (const r of rows) r.g = r.kind === 'gap' ? 'gap' : groupOf(String(r.txt || ''));
    FL = { id, rows, shown: 500 };
    const cats = [...new Set(rows.map(r => r.g))].sort((a, b) => flName(a).localeCompare(flName(b)));
    box.innerHTML = `<h3>📒 livro-caixa completo <small class="muted">${int(rows.length)} lançamentos${rows.length ? ` · de ${dtm(rows.at(-1).at)} a ${dtm(rows[0].at)}` : ''}</small></h3>
      <div class="row ad-full__f"><input class="input" id="fl-q" type="search" placeholder="buscar (ex.: pix, café, federal)">
        <select class="input" id="fl-g"><option value="">todas as categorias</option>${cats.map(k => `<option value="${esc(k)}">${esc(k === 'gap' ? '⚠️ dinheiro sem lançamento' : flName(k))}</option>`).join('')}</select>
        <select class="input" id="fl-t"><option value="">entradas e saídas</option><option value="in">só entradas</option><option value="out">só saídas</option><option value="big">só acima de R$ 50 mil</option></select>
        <label class="small">de <input class="input" id="fl-a" type="date"></label><label class="small">até <input class="input" id="fl-b" type="date"></label>
        <button type="button" class="btn btn--glass btn--sm" data-fl-csv>baixar planilha</button></div>
      <div id="fl-out"></div>`;
    drawFull();
  } catch (e) { box.innerHTML = ''; fail(e, 'ler o livro-caixa completo'); }
}
function fullRows() {
  const q = fold($('#fl-q')?.value), g = $('#fl-g')?.value || '', t = $('#fl-t')?.value || '', a = $('#fl-a')?.value, b = $('#fl-b')?.value;
  const A = a ? Date.parse(`${a}T00:00:00-03:00`) : -Infinity, B = b ? Date.parse(`${b}T23:59:59-03:00`) : Infinity;
  return FL.rows.filter(r => { const v = Number(r.val) || 0, at = Date.parse(r.at);
    return (!q || fold(r.txt).includes(q)) && (!g || r.g === g) && (!t || (t === 'in' ? v > 0 : t === 'out' ? v < 0 : Math.abs(v) >= 50000)) && at >= A && at <= B; });
}
function drawFull() {
  const out = $('#fl-out'); if (!out || !FL) return;
  const R = fullRows(), inn = R.reduce((t, r) => t + Math.max(0, Number(r.val) || 0), 0), outv = R.reduce((t, r) => t + Math.min(0, Number(r.val) || 0), 0), by = {};
  for (const r of R) { const v = Number(r.val) || 0, c = (by[r.g] ??= { n: 0, in: 0, out: 0 }); c.n++; if (v > 0) c.in += v; else c.out += v; }
  out.innerHTML = `<div class="ad-tiles ad-tiles--sm"><div class="ad-tile"><span>lançamentos</span><strong>${int(R.length)}</strong></div><div class="ad-tile"><span>entrou</span><strong>${brl(inn)}</strong></div><div class="ad-tile"><span>saiu</span><strong>${brl(outv)}</strong></div><div class="ad-tile"><span>saldo</span><strong>${brl(inn + outv)}</strong></div></div>
    <details><summary>por categoria</summary><div class="ad-tablewrap"><table><thead><tr><th>categoria</th><th class="num">lançamentos</th><th class="num">entrou</th><th class="num">saiu</th><th class="num">saldo</th></tr></thead><tbody>
    ${Object.entries(by).sort((a, b) => (b[1].in - b[1].out) - (a[1].in - a[1].out)).map(([k, v]) => `<tr><td>${esc(k === 'gap' ? '⚠️ dinheiro sem lançamento' : flName(k))}</td><td class="num">${int(v.n)}</td><td class="num">${brl(v.in)}</td><td class="num">${brl(v.out)}</td><td class="num">${brl(v.in + v.out)}</td></tr>`).join('')}</tbody></table></div></details>
    <div class="ad-tablewrap ad-ledger"><table><thead><tr><th>quando</th><th>mês</th><th>categoria</th><th>lançamento</th><th class="num">valor</th><th class="num">caixa depois</th></tr></thead><tbody>
    ${R.slice(0, FL.shown).map(r => `<tr class="${r.kind === 'gap' ? 'ad-mark' : ''}"><td>${dtm(r.at)}</td><td>${r.m ?? '—'}</td><td>${esc(r.kind === 'gap' ? '⚠️ sem lançamento' : flName(r.g))}</td><td>${esc(r.txt)}</td><td class="num ${r.val < 0 ? 'neg' : ''}">${r.val ? brl(r.val) : ''}</td><td class="num">${r.money != null ? brl(r.money) : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nada com esses filtros.</td></tr>'}</tbody></table></div>
    ${R.length > FL.shown ? `<p><button type="button" class="btn btn--glass btn--sm" data-fl-more>mostrar mais (${int(R.length - FL.shown)} restantes)</button></p>` : ''}
    <p class="muted small">"caixa depois" é o caixa no momento em que o jogo enviou o lançamento (lançamentos do mesmo envio mostram o mesmo caixa).</p>`;
}
document.addEventListener('input', e => { if (FL && e.target.closest?.('.ad-full__f')) { FL.shown = 500; drawFull(); } });
document.addEventListener('click', e => {
  const f = e.target.closest('[data-full-ledger]'); if (f) return loadFull(f.dataset.fullLedger);
  if (e.target.closest('[data-fl-more]')) { FL.shown += 500; return drawFull(); }
  if (e.target.closest('[data-fl-csv]') && FL) {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, csv = ['quando;mês;categoria;lançamento;valor;caixa depois', ...fullRows().map(r => [dtm(r.at), r.m ?? '', r.kind === 'gap' ? 'sem lançamento' : flName(r.g), r.txt, r.val ?? 0, r.money ?? ''].map(q).join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = `livro-caixa-${(users.find(u => u.user_id === FL.id)?.name || FL.id).replace(/[^\w-]+/g, '_')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
});
// ---------- livro-caixa do jogador por categoria (ficha do jogador) ----------
function ledger(s) {
  const log = Array.isArray(s.log) ? s.log : [], by = {}, g = e => groupOf(String(e.txt || ''));
  for (const e of log) { const k = g(e); (by[k] ??= { n: 0, in: 0, out: 0 }).n++; if (e.val > 0) by[k].in += e.val; else by[k].out += e.val || 0; }
  const name = k => GROUPS.find(x => x[0] === k)?.[1] || k;
  const chips = Object.entries(by).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<button type="button" class="btn btn--glass btn--sm" data-ledger="${esc(k)}">${esc(name(k))} <small>(${v.n})</small></button>`).join(' ');
  const rows = log.map(e => `<tr data-g="${esc(g(e))}"><td>${e.at ? `${dtm(e.at)}<br>` : ''}<small class="muted">${e.m ? `${W.monthName(e.m)}, ano ${W.yearOf(e.m)} (mês ${e.m})` : '—'}</small></td><td>${esc(name(g(e)))}</td><td>${esc(e.txt)}</td><td class="num ${e.val < 0 ? 'neg' : ''}">${e.val ? brl(e.val) : ''}</td></tr>`).join('');
  const sum = Object.entries(by).map(([k, v]) => `<tr><td>${esc(name(k))}</td><td class="num">${v.n}</td><td class="num">${brl(v.in)}</td><td class="num">${brl(v.out)}</td><td class="num">${brl(v.in + v.out)}</td></tr>`).join('');
  return `<h3>livro-caixa por categoria <small class="muted">(últimos ${log.length} lançamentos do save)</small></h3>
    <div class="ad-tablewrap"><table><thead><tr><th>categoria</th><th class="num">lançamentos</th><th class="num">entrou</th><th class="num">saiu</th><th class="num">saldo</th></tr></thead><tbody>${sum || '<tr><td colspan="5" class="muted">Sem lançamentos.</td></tr>'}</tbody></table></div>
    <div class="row" id="ap-ledger-f"><button type="button" class="btn btn--gold btn--sm" data-ledger="">todas</button> ${chips}</div>
    <div class="ad-tablewrap ad-ledger"><table><thead><tr><th>quando</th><th>categoria</th><th>lançamento</th><th class="num">valor</th></tr></thead><tbody id="ap-ledger">${rows}</tbody></table></div>`;
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
setInterval(() => { if (document.visibilityState === 'visible' && !$('#ad-app').hidden && !$('[data-panel="overview"]').hidden) loadOverview(); }, 60000);

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
const hrs = h => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${h.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`);
// ordem por chave única: sem ela o banco devolve as páginas em ordem solta e a mesma linha vinha 2 vezes (o pano voltava com valores dobrados)
async function pageAll(q, key = 'id') { const out = []; for (let f = 0; ; f += 500) { const { data, error } = await q().order(key).range(f, f + 499); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 500) return out; } }
// ---------- diário: tudo o que cada jogador fez (diario.sql) ----------
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
  $('#ad-dj-pl').innerHTML = R.players.map(p => `<tr><td><strong>${who(p.name)}</strong></td><td class="num">${p.hours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td><td class="num">${sgn(p.worthGain)}</td><td class="num">${sgn(Math.round(p.perHour))}</td>
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
  const st = $('#ad-vg-st'); st.textContent = 'lendo saves, Pix e histórico...'; $('#ad-vg-reload').disabled = true; vgAt = Date.now();
  try {
    if (!users.length) await loadUsers('');
    const ago = d => new Date(Date.now() - d * 864e5).toISOString(), soft = p => p.catch(() => []);
    const [saves, hist, rc, gifts, pix, pix30, diary, bans, oks, takes, propay] = await Promise.all([
      pageAll(() => sb.from('saves').select('user_id, data, updated_at'), 'user_id'),
      soft(pageAll(() => sb.from('save_history').select('user_id, saved_at, money').gt('saved_at', ago(1)))),
      soft(pageAll(() => sb.from('receita_casos').select('user_id'))),
      soft(pageAll(() => sb.from('admin_grants').select('user_id, kind, amount, created_at').in('kind', ['money', 'reset']).order('created_at'))),   // saldo líquido desde o último recomeço
      soft(pageAll(() => sb.from('pix').select('from_id, from_name, to_id, to_name, amount, memo, kind, at').gt('at', ago(7)).order('at', { ascending: false }))),
      soft(pageAll(() => sb.from('pix').select('from_id, from_name, to_id, to_name, amount, memo, at').gt('at', ago(30)))),
      soft(pageAll(() => sb.from('diario').select('user_id, at, created, kind, txt, val, money, worth, acts, tab').in('kind', ['gap', 'inicio', 'log']).gt('at', ago(7)))),   // com 'log': o salto compara com o último lançamento, não com a abertura anterior
      soft(pageAll(() => sb.from('bans').select('user_id, reason, until'), 'user_id')),
      soft(pageAll(() => sb.from('vigia_ok').select('*'), 'user_id')),
      soft(pageAll(() => sb.from('admin_grants').select('user_id, amount, created_at').eq('kind', 'money').lt('amount', 0).gt('created_at', ago(30)))),
      soft(pageAll(() => sb.from('pro_payments').select('payer, amount, memo, at, pro_contracts(pro_id, pro_name, client_name)').gt('at', ago(30)))),   // pagamento de contrato na Central = repasse disfarçado
    ]);
    OKS = Object.fromEntries(oks.map(o => [o.user_id, o]));
    BANS = Object.fromEntries(bans.filter(b => !b.until || Date.parse(b.until) > Date.now()).map(b => [b.user_id, b]));
    KNOWN = users.length < 300 ? new Set(users.map(u => u.user_id)) : new Set();   // lista cortada em 300: não dá para saber quem foi excluído
    // fazenda de contas (30 dias) e dinheiro sem lançamento (diário, 7 dias)
    const UI = Object.fromEntries(users.map(u => [u.user_id, { name: u.name, created: u.created_at }]));
    const farm = AE.pixFarm(pix30, UI), F = Object.fromEntries(farm.map(f => [f.id, f])), FS = {};
    for (const f of farm) for (const x of f.senders) if (x.ageDays != null && x.ageDays < AE.NEW_DAYS) FS[x.id] = { total: (FS[x.id]?.total || 0) + x.total, to: f.name };
    const DR = AE.diaryReport(diary, {}), GP = Object.fromEntries(DR.players.map(p => [p.id, p])), JP = {};
    const JA = {}, JC = {}; for (const j of DR.jumps) { if (/nuvem/.test(j.why || '')) { JC[j.id] = Math.max(JC[j.id] || 0, j.diff); continue; } if (j.diff > (JP[j.id] || 0)) { JP[j.id] = j.diff; JA[j.id] = j.at; } }   // nuvem: a venda foi no outro aparelho dele
    const by = (list, k) => list.reduce((m, x) => ((m[x[k]] ||= []).push(x), m), {});
    const H = by(hist, 'user_id'), R = by(rc, 'user_id'), Gf = by(gifts, 'user_id'), Pin = by(pix, 'to_id'), Pout = by(pix, 'from_id'), U = Object.fromEntries(users.map(u => [u.user_id, u]));
    const players = saves.map(x => { const u = U[x.user_id] || {}; return { id: x.user_id, name: u.name || x.data?.avatar?.name || '(sem nome)', created: u.created_at, banned: u.banned, s: x.data || {},
      hist: (H[x.user_id] || []).map(h => ({ t: Date.parse(h.saved_at), money: Number(h.money) || 0 })), pixIn: Pin[x.user_id] || [], pixOut: Pout[x.user_id] || [],
      receita: (R[x.user_id] || []).length, gifts: Math.max(0, (Gf[x.user_id] || []).reduce((t, g) => (g.kind === 'reset' ? 0 : t + Number(g.amount)), 0)),   // envio desfeito (valor negativo) desconta; recomeço zera
      farm: F[x.user_id], farmSender: FS[x.user_id], gap: GP[x.user_id]?.gap || 0, gapN: GP[x.user_id]?.gapN || 0, gapPass: GP[x.user_id]?.gapPass || 0, gapOld: GP[x.user_id]?.gapOld || 0, gapOther: GP[x.user_id]?.gapOther || 0, gapList: GP[x.user_id]?.gapList || [], jump: JP[x.user_id] || 0, jumpAt: JA[x.user_id], jumpCloud: JC[x.user_id] || 0, rep: GP[x.user_id]?.rep }; });
    vg = { ...AE.watch(players), pix, pix30, propay, saves, farm, UI };
    st.textContent = `${players.length} contas analisadas às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    await handled(takes);
    drawVigia(); loadRecursos();
  } catch (e) { fail(e, 'carregar a vigilância'); st.textContent = ''; } finally { $('#ad-vg-reload').disabled = false; }
}
// situação da conta agora: ativa, suspensa até tal dia, banida para sempre ou excluída
let BANS = {}, KNOWN = new Set(), OKS = {};
// passou o pano: só volta com coisa que ACONTECEU depois do pano (regra nova do painel olhando evento antigo não traz de volta)
const fresh = r => { const o = OKS[r.id]; if (!o) return true; const n = x => Number(x) || 0, t = new Date(o.at).getTime() || 0, after = x => x != null && new Date(x).getTime() > t;
  const gapNew = (r.gapList || []).filter(g => after(g.at)).reduce((s, g) => s + n(g.val), 0), farmNew = (r.farm?.list || []).filter(p => after(p.at)).reduce((s, p) => s + n(p.amount), 0);
  return (r.rep && after(r.rep.at)) || (n(r.jump) > 50000 && after(r.jumpAt)) || gapNew > 50000 || farmNew > 50000 || n(r.pixInSum) > n(o.pix) + 50000; };
function status(id) {
  if (KNOWN.size && !KNOWN.has(id)) return '<span class="tag tag--red">excluída</span>';
  const b = BANS[id]; if (!b) return '<span class="tag tag--green">ativa</span>';
  if (!b.until) return `<span class="tag tag--red" title="${esc(b.reason || '')}">banida para sempre</span>`;
  const d = Math.ceil((Date.parse(b.until) - Date.now()) / 864e5);
  return `<span class="tag tag--red" title="${esc(b.reason || '')}">suspensa até ${new Date(b.until).toLocaleDateString('pt-BR')} (${d} d)</span>`;
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
    <td>${r.excess > 0 ? `<button class="btn btn--gold btn--sm" data-vg-take="${esc(r.id)}">tirar excesso ${AE.brlShort(r.excess)}</button> ` : ''}${r.score > 0 && !r.banned ? `<button class="btn btn--danger btn--sm" data-pun="${esc(r.id)}" data-pun-who="${esc(r.name)}" data-pun-why="${esc(r.why[0] || 'ganho fora do normal')}">suspender</button>` : ''}</td></tr>`).join('')
    || `<tr><td colspan="10" class="muted">${only ? 'Ninguém fora do normal agora.' : 'Nenhum jogador.'}</td></tr>`;
  const W0 = Object.fromEntries(R.map(r => [r.id, r.worth])), pair = {}, pk = p => [p.from_id, p.to_id].sort().join();
  for (const p of vg.pix) pair[pk(p)] = (pair[pk(p)] || 0) + 1;
  const wk = Date.now() - 7 * 864e5, pq = ($('#ad-pix-q')?.value || '').trim().toLowerCase(), ponly = $('#ad-pix-only')?.checked;
  const allPix = [...vg.pix, ...(vg.propay || []).filter(x => Date.parse(x.at) > wk).map(proPix)].sort((a, b) => (a.at < b.at ? 1 : -1));
  const flagged = allPix.map(p => { const v = Number(p.amount), age = (Date.parse(p.at) - Date.parse(vg.UI[p.from_id]?.created || '')) / 864e5, noProf = !vg.UI[p.from_id];
    const isNew = Number.isFinite(age) && age < AE.NEW_DAYS, start = v >= 5000 && v <= 20000, big = v > Math.max(100000, (W0[p.to_id] || 0) * 0.3);
    return { p, v, age, noProf, isNew, start, big, bad: isNew || noProf || start || big || pair[pk(p)] >= 3 }; });
  const pb = $('#ad-pix-badge'); if (pb) { const n = flagged.filter(f => f.bad).length; pb.textContent = n; pb.hidden = !n; }
  drawPix(flagged);
  $('#ad-vg-pix').innerHTML = flagged.filter(f => (!ponly || f.bad) && (!pq || `${f.p.from_name} ${f.p.to_name}`.toLowerCase().includes(pq))).slice(0, 300).map(({ p, v, age, noProf, isNew, start, big, bad }) => {
    const tags = [noProf ? '<span class="tag tag--red">sem perfil / excluída</span>' : '', isNew ? `<span class="tag tag--red">conta nova (${age < 1 ? `${Math.max(1, Math.round(age * 24))} h` : `${Math.floor(age)} dia(s)`} de criada)</span>` : '', start ? '<span class="tag tag--red">valor do dinheiro inicial</span>' : '',
      pair[pk(p)] >= 3 ? `<span class="tag tag--gold">mesma dupla ${pair[pk(p)]}x</span>` : '', big ? '<span class="tag tag--gold">grande para quem recebeu</span>' : ''].join(' ');
    return `<tr${bad ? ' class="ad-alert"' : ''}><td><b>${new Date(p.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</b></td><td><small class="muted">enviou</small> <a href="#" data-vg-user="${esc(p.from_id)}"><b>${esc(p.from_name)}</b></a></td><td><small class="muted">➜ recebeu</small> <a href="#" data-vg-user="${esc(p.to_id)}"><b>${esc(p.to_name)}</b></a></td>
      <td class="num"><b>${brl(p.amount)}</b></td><td>${p.kind === 'central' ? '<b>contrato na Central</b>' : p.kind === 'pagamento' ? 'pagamento' : 'Pix'} ${tags}</td><td>${esc(p.memo || '')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Nenhum Pix ou pagamento com esse filtro nos últimos 7 dias.</td></tr>';
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
// pagamento de contrato na Central no mesmo formato do Pix (de quem pagou para o profissional)
const proPix = x => ({ from_id: x.payer, from_name: x.pro_contracts?.client_name || vg.UI[x.payer]?.name || '(sem perfil)', to_id: x.pro_contracts?.pro_id, to_name: x.pro_contracts?.pro_name || '?', amount: x.amount, memo: x.memo, at: x.at, kind: 'central' });
// aba Pix: números do período, quem mais recebe (com os remetentes) e quem mais envia (30 dias, Pix + Central)
function drawPix(flagged7) {
  const all = [...(vg.pix30 || []), ...(vg.propay || []).map(proPix)], UI = vg.UI;
  const ageOf = id => { const c = Date.parse(UI[id]?.created || ''); return Number.isFinite(c) ? (Date.now() - c) / 864e5 : null; };
  const risky = id => !UI[id] || (ageOf(id) ?? 99) < AE.NEW_DAYS;
  const chip = (id, name, extra = '') => `<a href="#" class="ad-chip${risky(id) ? ' ad-chip--red' : ''}" data-vg-user="${esc(id)}" title="${!UI[id] ? 'sem perfil / excluída' : `conta de ${Math.floor(ageOf(id))} dia(s)`}">${esc(name || '?')}${extra}</a>`;
  const acc = (key, other) => { const m = {}; for (const p of all) { const k = p[key]; if (!k) continue; const g = (m[k] ||= { id: k, name: p[key === 'to_id' ? 'to_name' : 'from_name'], total: 0, n: 0, peers: {} });
    g.total += Number(p.amount) || 0; g.n++; const o = (g.peers[p[other]] ||= { id: p[other], name: p[other === 'to_id' ? 'to_name' : 'from_name'], total: 0 }); o.total += Number(p.amount) || 0; } return Object.values(m).sort((a, b) => b.total - a.total); };
  const IN = acc('to_id', 'from_id'), OUT = acc('from_id', 'to_id');
  const newSenders = new Set(all.filter(p => risky(p.from_id)).map(p => p.from_id));
  const tiles = [['Pix + pagamentos em 7 dias', `${int(flagged7.length)} · ${AE.brlShort(flagged7.reduce((t, f) => t + f.v, 0))}`], ['suspeitos em 7 dias', int(flagged7.filter(f => f.bad).length)],
    ['contas que enviaram (30 d)', int(OUT.length)], ['contas novas ou sem perfil enviando', int(newSenders.size)], ['contas que receberam (30 d)', int(IN.length)],
    ['contratos na Central (30 d)', `${int((vg.propay || []).length)} · ${AE.brlShort((vg.propay || []).reduce((t, x) => t + Number(x.amount), 0))}`]];
  $('#ad-pix-tiles').innerHTML = tiles.map(([k, v], i) => `<div class="ad-tile${i === 1 || i === 3 ? ' ad-tile--red' : ''}"><span>${k}</span><strong>${v}</strong></div>`).join('');
  const fdt = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const ageAt = (id, t) => { const c = Date.parse(UI[id]?.created || ''); if (!Number.isFinite(c)) return '<span class="tag tag--red">sem perfil / excluída</span>'; const h = (Date.parse(t) - c) / 36e5;
    return h < 72 ? `<span class="tag tag--red">conta com ${h < 1 ? 'menos de 1 h' : `${Math.round(h)} h`}</span>` : `${Math.round(h / 24)} d de conta`; };
  const detail = g => { const list = all.filter(p => p.to_id === g.id).sort((a, b) => (a.at < b.at ? -1 : 1));
    return `<details class="ad-det"><summary>ver as ${list.length} transferências, uma por uma</summary><div class="ad-tablewrap"><table class="ad-xl"><thead><tr><th>data e hora</th><th>quem ENVIOU</th><th>situação de quem enviou</th><th></th><th>quem RECEBEU</th><th class="num">valor</th><th>como</th><th>mensagem</th></tr></thead><tbody>
      ${list.map(p => `<tr${risky(p.from_id) ? ' class="ad-alert"' : ''}><td><b>${fdt(p.at)}</b></td><td><a href="#" data-vg-user="${esc(p.from_id)}"><b>${esc(p.from_name || '?')}</b></a></td><td>${ageAt(p.from_id, p.at)}</td><td>➜</td>
        <td><a href="#" data-vg-user="${esc(p.to_id)}">${esc(p.to_name || '?')}</a></td><td class="num"><b>${brl(p.amount)}</b></td><td>${p.kind === 'central' ? 'contrato na Central' : 'Pix'}</td><td>${esc(p.memo || '')}</td></tr>`).join('')}</tbody></table></div></details>`; };
  $('#ad-pix-in').innerHTML = IN.slice(0, 40).map(g => { const ps = Object.values(g.peers).sort((a, b) => b.total - a.total), bad = ps.filter(x => risky(x.id)).length;
    const badTot = all.filter(p => p.to_id === g.id && risky(p.from_id)).reduce((t, p) => t + Number(p.amount || 0), 0);
    return `<tr${bad >= 2 ? ' class="ad-alert"' : ''}><td><a href="#" data-vg-user="${esc(g.id)}"><b>${esc(g.name)}</b></a> <small class="muted">recebeu</small>${bad ? `<br><span class="tag tag--red">${bad} conta(s) nova(s) / sem perfil mandaram ${brl(badTot)}</span>` : ''}</td><td class="num"><b>${brl(g.total)}</b></td><td class="num">${g.n}</td>
      <td><div class="ad-chips">${ps.slice(0, 12).map(x => chip(x.id, x.name, ` <small>${AE.brlShort(x.total)}</small>`)).join('')}${ps.length > 12 ? ` <small class="muted">+${ps.length - 12}</small>` : ''}</div>${detail(g)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Nenhum Pix em 30 dias.</td></tr>';
  $('#ad-pix-out').innerHTML = OUT.slice(0, 40).map(g => { const a = ageOf(g.id), ps = Object.values(g.peers).sort((x, y) => y.total - x.total);
    return `<tr${risky(g.id) ? ' class="ad-alert"' : ''}><td><a href="#" data-vg-user="${esc(g.id)}"><b>${esc(g.name)}</b></a></td><td>${!UI[g.id] ? '<span class="tag tag--red">sem perfil / excluída</span>' : a < AE.NEW_DAYS ? `<span class="tag tag--red">nova: ${a < 1 ? `${Math.max(1, Math.round(a * 24))} h` : `${Math.floor(a)} d`}</span>` : `${Math.floor(a)} d`}</td>
      <td class="num"><b>${brl(g.total)}</b></td><td class="ad-chips">${ps.slice(0, 6).map(x => chip(x.id, x.name, ` <small>${AE.brlShort(x.total)}</small>`)).join('')}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Nenhum Pix em 30 dias.</td></tr>';
  $('#ad-pix-st').textContent = `${int(all.length)} transferências em 30 dias · atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
// cartões de alerta: o mais grave primeiro, com o motivo em palavras e os botões para agir
const certainty = s => (s >= 6 ? ['quase certeza', 'red'] : s >= 4 ? ['muito provável', 'red'] : ['vale conferir', 'gold']);
function drawCheats(on) {
  const ago = t => { const h = (Date.now() - Date.parse(t)) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`; };
  const farms = vg.farm.filter(f => (f.sure || f.n >= 2) && (!OKS[f.id] || f.total > (Number(OKS[f.id].pix) || 0) + 50000)).sort((a, b) => (a.last < b.last ? 1 : -1));   // Pix mais recente primeiro
  const dt = t => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
  const age = d => (d == null ? '—' : d < 1 ? `<b class="bad">${Math.max(1, Math.round(d * 24))} h</b>` : d < AE.NEW_DAYS ? `<b class="bad">${Math.floor(d)} d</b>` : `${Math.floor(d)} d`);
  // planilha: uma linha por Pix suspeito, com data e hora, quem mandou, quando a conta foi criada e o acumulado
  $('#ad-farm').innerHTML = farms.length ? `<h3>💸 fazenda de contas (Pix de contas novas para a mesma pessoa, 30 dias)</h3>
    ${farms.map(f => { let acc = 0; const rows = (f.list || []).map((x, i) => ({ ...x, i: i + 1, acc: acc += x.amount })).reverse();
      return `<div class="ad-sheet ad-sheet--red"><div class="ad-sheet__top"><span class="tag tag--red">${f.sure ? 'quase certeza' : 'muito provável'}</span>
        <b>${esc(f.name)}</b> ${status(f.id)} recebeu <b>${brl(f.total)}</b> em ${f.n} Pix de ${f.senders.length} conta(s) · 1º ${dt(f.first)} · último ${dt(f.last)} (há ${ago(f.last)})${on.has(f.id) ? ' <span class="tag tag--green">online</span>' : ''}
        <span class="ad-sheet__acts"><button class="btn btn--gold btn--xs" data-vg-user="${esc(f.id)}">ficha</button><button class="btn btn--glass btn--xs" data-pano="${esc(f.id)}" title="tirar dos alertas: volta só se aparecer coisa nova">passar o pano</button><button class="btn btn--glass btn--xs" data-desc="${esc(f.id)}" data-desc-pix="${f.total}">descontar</button><button class="btn btn--danger btn--xs" data-farm-back="${esc(f.id)}" title="a conta volta para antes do 1º Pix e o que comprou depois volta para a loja">voltar antes do 1º Pix</button><button class="btn btn--danger btn--xs" data-pun="${esc(f.id)}" data-pun-who="${esc(f.name)}" data-pun-why="recebeu Pix de contas falsas">banir / excluir ${esc(f.name)}</button><button class="btn btn--danger btn--xs" data-pun="${esc(f.senders.map(x => x.id).join(','))}" data-pun-who="${esc(f.senders.map(x => x.name).join(', '))}" data-pun-why="conta usada para mandar Pix para ${esc(f.name)}">suspender ${f.senders.length} remetente(s)</button></span></div>
        <div class="ad-tablewrap"><table class="ad-xl"><thead><tr><th>#</th><th>data e hora do Pix</th><th>conta que mandou</th><th>situação</th><th>conta criada em</th><th>idade</th><th class="num">valor</th><th class="num">acumulado</th><th>mensagem</th></tr></thead><tbody>
        ${rows.map(x => `<tr><td class="num">${x.i}</td><td>${dt(x.at)}</td><td><a href="#" data-vg-user="${esc(x.id)}">${esc(x.name)}</a></td><td>${status(x.id)}</td><td>${dt(x.created)}</td><td>${age(x.ageDays)}</td><td class="num">${brl(x.amount)}</td><td class="num">${brl(x.acc)}</td><td>${esc(x.memo)}</td></tr>`).join('')}
        </tbody></table></div></div>`; }).join('')}` : '';
  const list = vg.rows.filter(r => r.score >= 4 && fresh(r) && !(farms.some(f => f.id === r.id) && r.why.length === 1)).sort((a, b) => (b.pf || 0) - (a.pf || 0)).slice(0, 40);   // alerta da PF no topo
  const cleared = vg.rows.filter(r => OKS[r.id] && !fresh(r));
  $('#ad-cheat-st').textContent = `${list.filter(r => r.pf).length ? `🚨 ${list.filter(r => r.pf).length} alerta(s) da Polícia Federal · ` : ''}${farms.length} fazenda(s) de contas · ${list.length} jogador(es) com sinais fortes · visto em ${dt(Date.now())}`;
  // jogadores com sinais fortes: uma linha por jogador, com as datas que importam e os motivos
  const lastPix = (arr = []) => arr.reduce((m, p) => (p.at > m ? p.at : m), '');
  $('#ad-cheat').innerHTML = list.length ? `<div class="ad-tablewrap"><table class="ad-xl"><thead><tr><th>nível</th><th>jogador</th><th>situação</th><th>conta criada</th><th>último save</th><th class="num">patrimônio</th><th class="num">24 h</th><th class="num">horas (total · hoje)</th><th class="num">R$/h</th><th>Pix receb. / env. (último)</th><th class="num">cassino</th><th>motivos</th><th>agir</th></tr></thead><tbody>
    ${list.map(r => { const [lv, tone] = certainty(r.score), sv = r.s?.savedAt;
      return `<tr class="ad-alert"><td><span class="tag tag--${tone}">${lv} · ${r.score}</span></td>
        <td><a href="#" data-vg-user="${esc(r.id)}"><b>${esc(r.name)}</b></a>${r.pf ? ' <span class="tag tag--red" title="repetiu a mesma ação que dá dinheiro muitas vezes em 1 h">🚨 Polícia Federal</span>' : ''}${on.has(r.id) ? ' <span class="tag tag--green">online</span>' : ''}</td><td>${status(r.id)}</td>
        <td>${dt(r.created)}</td><td>${sv ? dt(sv) : '—'}</td><td class="num">${AE.brlShort(r.worth)}</td><td class="num ${r.money24 < 0 ? 'bad' : 'good'}">${r.money24 == null ? '—' : AE.brlShort(r.money24)}</td>
        <td class="num">${hrs(r.playH)} · ${hrs(r.todayH)}</td><td class="num">${r.perHour == null ? '—' : AE.brlShort(r.perHour)}</td>
        <td>${AE.brlShort(r.pixInSum)} / ${AE.brlShort(r.pixOutSum)}${lastPix([...(r.pixIn || []), ...(r.pixOut || [])]) ? `<br><small class="muted">${dt(lastPix([...(r.pixIn || []), ...(r.pixOut || [])]))}</small>` : ''}</td>
        <td class="num">${r.casino == null ? '—' : AE.brlShort(r.casino)}</td>
        <td class="ad-xl__why">${r.why.map(w => esc(w)).join('<br>')}</td>
        <td class="ad-xl__acts"><button class="btn btn--gold btn--xs" data-vg-user="${esc(r.id)}">ficha</button><button class="btn btn--glass btn--xs" data-desc="${esc(r.id)}">descontar</button><button class="btn btn--glass btn--xs" data-pano="${esc(r.id)}" title="tirar dos alertas: volta só se aparecer coisa nova">passar o pano</button>${r.excess > 0 ? `<button class="btn btn--glass btn--xs" data-vg-take="${esc(r.id)}">tirar ${AE.brlShort(r.excess)}</button>` : ''}<button class="btn btn--danger btn--xs" data-pun="${esc(r.id)}" data-pun-who="${esc(r.name)}" data-pun-why="${esc(r.why[0] || 'trapaça')}">banir / excluir</button></td></tr>`; }).join('')}
    </tbody></table></div>` : (farms.length ? '' : '<p class="good">Nenhum sinal forte de trapaça agora. 👍</p>');
  if (cleared.length) $('#ad-cheat').insertAdjacentHTML('beforeend', `<p class="small muted ad-cleared">🧽 ${cleared.length} com pano passado ou já descontados: <a href="#" data-goto-pano>ver no menu pano passado</a></p>`);
  drawPano();
}
// na ficha do jogador: o que a vigilância viu sobre ele
// menu "pano passado": todos que saíram dos alertas, se continuam quietos ou se apareceu coisa nova depois
function drawPano() {
  const el = $('#ad-pano'); if (!el || !vg) return;
  const R = Object.fromEntries(vg.rows.map(r => [r.id, r])), ids = Object.keys(OKS);
  const list = ids.map(id => ({ id, o: OKS[id], r: R[id], name: R[id]?.name || vg.UI?.[id]?.name || String(id).slice(0, 8) })).sort((a, b) => (a.r && !fresh(a.r) ? 1 : 0) - (b.r && !fresh(b.r) ? 1 : 0) || String(b.o.at).localeCompare(String(a.o.at)));
  const back = list.filter(x => x.r && fresh(x.r)).length;
  $('#ad-pano-st').textContent = `${list.length} jogador(es) · ${back} voltaram a aparecer nos alertas`;
  const bd = $('#ad-pano-badge'); if (bd) { bd.hidden = !back; bd.textContent = back; }
  el.innerHTML = list.map(({ id, o, r, name }) => { const again = r && fresh(r), paid = /^descontado/.test(o.note || '');
    return `<tr${again ? ' class="ad-alert"' : ''}><td><a href="#" data-vg-user="${esc(id)}"><b>${esc(name)}</b></a></td>
      <td>${again ? '<span class="tag tag--red">voltou: coisa nova depois do pano</span>' : paid ? '<span class="tag tag--gold">descontado</span>' : '<span class="tag tag--green">quieto</span>'}</td>
      <td>${o.at ? new Date(o.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td><td><small>${esc(o.note || '')}</small></td>
      <td class="num">${r ? AE.brlShort(r.worth) : '—'}</td><td class="ad-xl__why"><small>${r?.why?.length ? r.why.map(w => esc(w)).join('<br>') : '<span class="muted">nada agora</span>'}</small></td>
      <td class="ad-xl__acts"><button class="btn btn--gold btn--xs" data-vg-user="${esc(id)}">ficha</button><button class="btn btn--glass btn--xs" data-pano-undo="${esc(id)}">voltar para os alertas</button></td></tr>`; }).join('')
    || '<tr><td colspan="7" class="muted">Ninguém com pano passado.</td></tr>';
}
document.addEventListener('click', e => { if (e.target.closest('[data-goto-pano]')) { e.preventDefault(); show('pano'); } if (e.target.closest('#ad-pano-reload')) loadVigia(); });
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
// o que a vigilância viu, dito como a fiscalização do jogo diria ao jogador (sem termos do painel)
function findings(r, f) {
  const k = AE.brlShort, out = [];
  if (f) out.push(`recebimento de ${k(f.total)} em ${f.n} Pix vindos de ${f.senders.length} ${f.senders.length === 1 ? 'conta recém-aberta' : 'contas recém-abertas'} (${f.senders.slice(0, 4).map(x => x.name).join(', ')}), prática conhecida como conta laranja`);
  if ((r.gapOther ?? r.gap) > 50000) out.push(`${k(r.gapOther ?? r.gap)} no seu caixa sem origem declarada`);
  if (r.jump > 50000) out.push(`aumento de ${k(r.jump)} no saldo sem nenhuma movimentação registrada`);
  if (r.farmSender) out.push(`envio de ${k(r.farmSender.total)} por Pix para ${r.farmSender.to} logo depois de abrir a conta`);
  if (!f && r.pixInSum > Math.max(100000, r.worth * 0.3)) out.push(`${k(r.pixInSum)} recebidos por Pix, ${Math.round(r.pixInSum / Math.max(1, r.worth) * 100)}% do seu patrimônio`);
  if (r.pixOutSum > Math.max(100000, (r.worth + r.pixOutSum) * 0.5)) out.push(`envio de ${k(r.pixOutSum)} por Pix, mais da metade do que você tinha`);
  if (vg?.fair && r.perHour > vg.fair * AE.FAIR_X && r.worth > 200000) out.push(`rendimento de ${k(r.perHour)} por hora, muito acima dos outros produtores`);
  if (r.playH != null && r.playH < 2 && r.worth > 1e6) out.push(`patrimônio de ${k(r.worth)} acumulado em pouco tempo de atividade`);
  if (r.casino > Math.max(500000, r.worth * 0.2)) out.push(`lucro de ${k(r.casino)} em jogos e apostas`);
  if (r.money24 != null && r.money24 > Math.max(1e6, r.worth * 0.5)) out.push(`saldo subiu ${k(r.money24)} em 24 horas`);
  return out.length ? out : ['movimentação incompatível com a sua renda'];
}
// descontar do caixa do jogador: vira ordem do administrador e aparece no livro-caixa dele ("ajuste do administrador: motivo")
document.addEventListener('click', e => {
  const b = e.target.closest('[data-desc]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const id = b.dataset.desc, r = vg?.rows.find(x => x.id === id) || {}, fm = vg?.farm.find(f => f.id === id), name = r.name || fm?.name || 'jogador';
  const found = findings(r, fm);
  const sug = [['Pix de contas novas', Number(b.dataset.descPix) || vg?.farm.find(f => f.id === id)?.total || 0, 'Pix recebidos de contas falsas'],
    ['Pix recebidos', r.pixInSum || 0, 'Pix recebidos de forma irregular'], ['dinheiro sem lançamento', r.gap || 0, 'dinheiro que apareceu sem lançamento'],
    ['acima do ritmo', r.excess || 0, 'ganho acima do ritmo normal do jogo'], ['ganho em 24 h', Math.max(0, r.money24 || 0), 'ganho irregular nas últimas 24 h']]
    .filter(x => x[1] > 0).filter((x, i, a) => a.findIndex(y => Math.round(y[1]) === Math.round(x[1])) === i);
  const d = document.createElement('dialog'); d.className = 'ad-pun';
  d.innerHTML = `<form method="dialog"><div class="ad-desc__edit"><h3>descontar de ${esc(name)}</h3>
    <p class="small">Caixa hoje: <b>${r.s?.money != null ? brl(r.s.money) : '—'}</b> · patrimônio ${r.worth != null ? brl(r.worth) : '—'}. Sai do caixa quando o jogo dele sincronizar e aparece no livro-caixa como aviso do órgão escolhido (ele nunca vê "administrador"). O caixa pode ficar negativo.</p>
    ${sug.length ? `<div class="row">${sug.map(([k, v, why]) => `<button type="button" class="btn btn--glass btn--xs" data-sug="${Math.round(v)}" data-why="${esc(why)}">${k}: ${AE.brlShort(v)}</button>`).join('')}</div>` : ''}
    <label class="field"><span>valor a descontar (R$)</span><input class="input" type="number" name="amount" min="1" step="1" required value="${Math.round(sug[0]?.[1] || 0) || ''}" autofocus></label>
    <label class="field"><span>o que foi encontrado (em palavras do jogo; um item por linha)</span><textarea class="input" name="why" rows="4">${esc(found.join('\n'))}</textarea></label>
    <label class="field"><span>quem manda o aviso (dentro do jogo; o jogador nunca vê "administrador")</span><select class="input" name="org">
      <option value="rf">Receita Federal: auto de infração</option><option value="bc">Banco Central: Pix bloqueado por fraude</option><option value="pf">Polícia Federal: bens apreendidos</option></select></label>
    <label class="field"><span>como vai aparecer no livro-caixa dele (pode editar)</span><textarea class="input" name="txt" maxlength="500" rows="5"></textarea></label>
    <div class="row"><button class="btn btn--glass" value="cancel" formnovalidate>cancelar</button><button class="btn btn--danger" type="button" data-prev>descontar</button></div></div>
    <div class="ad-desc__prev" hidden></div></form>`;
  const q = n => d.querySelector(`[name=${n}]`), edit = d.querySelector('.ad-desc__edit'), prev = d.querySelector('.ad-desc__prev');
  const finalTxt = () => { const t = (q('txt').value || 'movimentação incompatível com a sua renda').trim().slice(0, 500); return ORG_RE.test(t) ? t : `Receita Federal: ${t}`.slice(0, 500); };
  // prévia: como o jogador vai ver (notificação + linha do livro-caixa + caixa antes e depois) antes de mandar
  const preview = () => {
    const amt = Math.floor(Number(q('amount').value) || 0); if (amt <= 0) { q('amount').focus(); return toast('Coloque o valor a descontar.', true); }
    const t = finalTxt(), org = t.match(ORG_RE)[1], body = t.slice(org.length + 1).trim(), cash = Number(r.s?.money), month = Math.max(0, ...vg.rows.map(x => Number(x.s?.month) || 0));
    prev.innerHTML = `<h3>prévia: é assim que ${esc(name)} vai ver</h3>
      <p class="muted small">notificação no jogo</p>
      <div class="ad-prev__note"><b>${esc(org)}</b><span>${esc(body)}</span></div>
      <p class="muted small">livro-caixa</p>
      <table class="ad-xl ad-prev__log"><thead><tr><th>mês</th><th>lançamento</th><th class="num">valor</th></tr></thead>
        <tbody><tr><td class="num">${month || '—'}</td><td>${esc(t)} <span class="btn btn--glass btn--xs">recorrer</span></td><td class="num bad">${brl(-amt)}</td></tr></tbody></table>
      <p class="small">Caixa: <b>${Number.isFinite(cash) ? brl(cash) : '—'}</b> → <b class="${Number.isFinite(cash) && cash - amt < 0 ? 'bad' : ''}">${Number.isFinite(cash) ? brl(cash - amt) : '—'}</b> (sai quando o jogo dele sincronizar)</p>
      <div class="row"><button class="btn btn--glass" type="button" data-back>voltar e editar</button><button class="btn btn--danger" value="ok">enviar desconto de ${brl(amt)}</button></div>`;
    edit.hidden = true; prev.hidden = false;
  };
  d.addEventListener('click', ev => { if (ev.target.closest('[data-prev]')) preview(); if (ev.target.closest('[data-back]')) { prev.hidden = true; edit.hidden = false; } });
  const suggest = () => { const v = brl(Math.floor(Number(q('amount').value) || 0));
    const items = q('why').value.split('\n').map(x => x.trim().replace(/[.;]$/, '')).filter(Boolean);
    const make = list => ({ rf: `Receita Federal: auto de infração. A fiscalização encontrou ${list}. Foram recolhidos ${v}. Se discordar, peça revisão aqui no livro-caixa. Reincidência leva à suspensão da conta.`,
      bc: `Banco Central: ${v} bloqueados e devolvidos ao sistema. Motivo: ${list}. Suas transferências seguem em monitoramento. Se discordar, peça revisão aqui no livro-caixa.`,
      pf: `Polícia Federal: ${v} apreendidos em operação. Foram encontrados ${list}. O caso segue em investigação. Se discordar, peça revisão aqui no livro-caixa.` }[q('org').value]);
    let n = items.length; while (n > 1 && make(items.slice(0, n).join('; ')).length > 500) n--;   // cabe inteiro: tira os últimos achados em vez de cortar no meio
    q('txt').value = make(items.length ? items.slice(0, n).join('; ') : 'movimentação incompatível com a sua renda').slice(0, 500); };
  d.addEventListener('click', ev => { const s2 = ev.target.closest('[data-sug]'); if (!s2) return; q('amount').value = s2.dataset.sug; suggest(); });
  d.addEventListener('input', ev => { if (ev.target.name !== 'txt') suggest(); });
  d.addEventListener('change', ev => { if (ev.target.name === 'org') suggest(); });
  document.body.append(d); suggest(); d.showModal();
  d.addEventListener('close', async () => {
    const f = Object.fromEntries(new FormData(d.querySelector('form'))); d.remove();
    const amt = Math.floor(Number(f.amount) || 0); if (d.returnValue !== 'ok' || amt <= 0) return;
    const why = ((f.txt || '').trim() ? ORG_RE.test(f.txt.trim()) ? f.txt.trim() : `Receita Federal: ${f.txt.trim()}` : 'Receita Federal: movimentação incompatível com a sua renda').slice(0, 500);   // sempre imersivo (a prévia já foi vista)
    const { error } = await sb.from('admin_grants').insert({ user_id: id, kind: 'money', amount: -amt, note: why });
    if (error) return fail(error, 'descontar');
    await log('take_money', id, { amount: amt, why, from: 'alertas de trapaça' });
    const rr = vg?.rows.find(x => x.id === id);
    if (rr) { const row = okRow(rr, { note: `descontado ${brl(amt)} em ${new Date().toLocaleDateString('pt-BR')}`, at: new Date().toISOString() }); if (!(await sb.from('vigia_ok').upsert(row)).error) { OKS[id] = row; drawVigia(); } }
    sentNotice(name, amt, why);
  });
}, true);
// aviso no painel depois de enviar: o que foi, para quem, e o caminho para acompanhar
function sentNotice(name, amt, txt) {
  const d = document.createElement('dialog'); d.className = 'ad-pun ad-pun--ok';
  d.innerHTML = `<form method="dialog"><h3>✅ aviso enviado para ${esc(name)}</h3>
    <p><b class="bad">${brl(-amt)}</b> vão sair da conta dele. Se ele estiver jogando, sai em segundos; se não, sai assim que ele abrir o jogo (fica guardado no servidor).</p>
    <div class="ad-prev__note"><span>${esc(txt)}</span></div>
    <p class="small muted">Acompanhe em <b>📨 avisos enviados</b>: lá aparece quando foi descontado, e se ele pedir revisão.</p>
    <div class="row"><button class="btn btn--glass" value="ok">fechar</button><button class="btn btn--gold" value="go">abrir avisos enviados</button></div></form>`;
  document.body.append(d); d.showModal(); toast(`Aviso enviado para ${name}: ${brl(-amt)}.`);
  d.addEventListener('close', () => { if (d.returnValue === 'go') show('enviados'); d.remove(); loadSent(true); });
}
// central de avisos enviados: as ordens (admin_grants) com quem recebeu, o texto, se já foi aplicada e se tem recurso
let SENT = [], SENT_NAMES = {};
const KIND = { money: 'dinheiro', chips: 'fichas', xp: 'XP', message: 'mensagem', reset: 'reiniciar', setmoney: 'carteira', land: 'terra', pioneer: 'selo' };
async function loadSent(quiet) {
  const st = $('#ad-sent-st'); if (!quiet && st) st.textContent = 'carregando...';
  const [g, rc] = await Promise.all([sb.from('admin_grants').select('id, user_id, kind, amount, note, created_at, applied_at').order('created_at', { ascending: false }).limit(400),
    sb.from('recursos').select('grant_id, status, msg').limit(1000)]);
  if (g.error) { if (st) st.textContent = ''; return fail(g.error, 'carregar os avisos enviados'); }
  SENT = g.data || []; const REC = Object.fromEntries((rc.data || []).map(r => [r.grant_id, r]));
  SENT.forEach(x => { x.rec = REC[x.id]; });
  const ids = [...new Set(SENT.map(x => x.user_id))].filter(i => !SENT_NAMES[i]);
  for (const u of users) SENT_NAMES[u.user_id] ??= u.name;
  const miss = ids.filter(i => !SENT_NAMES[i]);
  for (let i = 0; i < miss.length; i += 100) { const { data } = await sb.from('public_profiles').select('user_id, name').in('user_id', miss.slice(i, i + 100)); for (const p of data || []) SENT_NAMES[p.user_id] = p.name; }
  if (!Object.keys(BANS).length) { const { data } = await sb.from('bans').select('user_id, reason, until'); BANS = Object.fromEntries((data || []).filter(b => !b.until || Date.parse(b.until) > Date.now()).map(b => [b.user_id, b])); }
  const pend = SENT.filter(x => !x.applied_at).length, b = $('#ad-sent-badge'); if (b) { b.textContent = pend; b.hidden = !pend; }
  if (st) st.textContent = `${SENT.length} avisos · ${pend} pendente(s) · atualizado ${new Date().toLocaleTimeString('pt-BR')}`;
  drawSent();
}
function drawSent() {
  const el = $('#ad-sent'); if (!el) return;
  const qq = ($('#ad-sent-q')?.value || '').trim().toLowerCase(), f = $('#ad-sent-f')?.value || '';
  const dt = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const rows = SENT.filter(x => (!f || (f === 'pend' ? !x.applied_at : f === 'money' ? x.kind === 'money' || x.kind === 'setmoney' : ORG_RE.test(x.note || '')))
    && (!qq || `${SENT_NAMES[x.user_id] || ''} ${x.note || ''}`.toLowerCase().includes(qq)));
  el.innerHTML = rows.map(x => { const nm = SENT_NAMES[x.user_id] || '(conta apagada)', v = Number(x.amount) || 0, org = (x.note || '').match(ORG_RE)?.[1];
    const val = x.kind === 'money' || x.kind === 'setmoney' ? `<span class="${v < 0 ? 'bad' : 'good'}">${brl(v)}</span>` : x.kind === 'chips' || x.kind === 'xp' ? int(v) : '';
    const ent = x.applied_at ? `<span class="tag tag--green">${v < 0 && x.kind === 'money' ? 'descontado' : 'entregue'}</span><br><small>${dt(x.applied_at)}</small>` : '<span class="tag tag--gold">pendente</span><br><small class="muted">sai quando ele abrir o jogo</small>';
    const rec = x.rec ? `<span class="tag tag--${x.rec.status === 'aberto' ? 'red' : x.rec.status === 'aceito' ? 'green' : 'gold'}">${x.rec.status === 'aberto' ? 'pediu revisão' : `revisão ${x.rec.status}`}</span>` : '';
    return `<tr${!x.applied_at ? ' class="ad-alert"' : ''}><td>${dt(x.created_at)}</td><td><a href="#" data-vg-user="${esc(x.user_id)}"><b>${esc(nm)}</b></a></td><td>${status(x.user_id)}</td>
      <td>${org ? `<b>${esc(org)}</b>` : KIND[x.kind] || esc(x.kind)}</td><td class="num">${val}</td><td class="ad-xl__why">${esc(x.note || '')}</td><td>${ent}</td><td>${rec}</td>
      <td>${!x.applied_at ? `<button class="btn btn--glass btn--xs" data-sent-cancel="${x.id}">cancelar</button>` : ''}</td></tr>`; }).join('')
    || '<tr><td colspan="9" class="muted">Nenhum aviso enviado ainda.</td></tr>';
}
$('#ad-sent-reload')?.addEventListener('click', () => loadSent());
$('#ad-sent-q')?.addEventListener('input', drawSent);
$('#ad-sent-f')?.addEventListener('change', drawSent);
document.addEventListener('click', async e => {
  const c = e.target.closest('[data-sent-cancel]'); if (!c) return;
  const x = SENT.find(s => String(s.id) === c.dataset.sentCancel); if (!x) return;
  if (!confirm(`Cancelar este aviso para ${SENT_NAMES[x.user_id] || 'o jogador'}? Ele ainda não recebeu, então nada sai da conta.`)) return;
  const { data, error } = await sb.from('admin_grants').delete().eq('id', x.id).is('applied_at', null).select('id');
  if (error) return fail(error, 'cancelar');
  if (!data?.length) { toast('Não deu: o jogo dele acabou de aplicar este aviso.', true); return loadSent(); }
  await log('grant_cancel', x.user_id, { id: x.id, kind: x.kind, amount: x.amount, note: x.note }); toast('Aviso cancelado.'); loadSent();
});
setInterval(() => { if (sb && !$('#ad-app').hidden) loadSent(true); }, 60000);   // badge de pendentes e entrega atualizando sozinhos
// recursos: o jogador contestou um desconto pelo livro-caixa (recursos.sql). Aceitar devolve o valor; negar manda a resposta.
let RECS = [];
const ORG_RE = /^(Receita Federal|Banco Central|Polícia Federal):/;   // avisos imersivos (o jogo mostra sem "administrador")
async function loadRecursos() {
  const { data, error } = await sb.from('recursos').select('*').order('at', { ascending: false }).limit(80);
  if (error) { $('#ad-rec').innerHTML = ''; return; }
  RECS = data || []; const open = RECS.filter(r => r.status === 'aberto').length;
  const dt = t => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  $('#ad-rec').innerHTML = RECS.length ? `<h3>📨 recursos dos jogadores ${open ? `<span class="tag tag--red">${open} esperando resposta</span>` : ''}</h3>
    <div class="ad-tablewrap"><table class="ad-xl"><thead><tr><th>pedido em</th><th>jogador</th><th>situação</th><th class="num">descontado</th><th>lançamento</th><th>o que ele diz</th><th>resposta</th><th>agir</th></tr></thead><tbody>
    ${[...RECS].sort((a, b) => (a.status === 'aberto') === (b.status === 'aberto') ? 0 : a.status === 'aberto' ? -1 : 1).map(r => `<tr${r.status === 'aberto' ? ' class="ad-alert"' : ''}>
      <td>${dt(r.at)}</td><td><a href="#" data-vg-user="${esc(r.user_id)}">${esc(r.name || '?')}</a> ${status(r.user_id)}</td>
      <td><span class="tag tag--${r.status === 'aberto' ? 'gold' : r.status === 'aceito' ? 'green' : 'red'}">${r.status}</span>${r.answered_at ? `<br><small class="muted">${dt(r.answered_at)}</small>` : ''}</td>
      <td class="num">${brl(r.amount)}</td><td class="ad-xl__why">${esc(r.entry || '')}</td><td class="ad-xl__why"><b>${esc(r.msg)}</b></td><td class="ad-xl__why">${esc(r.answer || '')}</td>
      <td class="ad-xl__acts">${r.status === 'aberto' ? `<button class="btn btn--gold btn--xs" data-rec-ok="${r.id}">aceitar e devolver</button><button class="btn btn--danger btn--xs" data-rec-no="${r.id}">negar</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '';
}
document.addEventListener('click', async e => {
  const ok = e.target.closest('[data-rec-ok]'), no = e.target.closest('[data-rec-no]'); if (!ok && !no) return;
  e.preventDefault(); e.stopPropagation();
  const r = RECS.find(x => String(x.id) === (ok ? ok.dataset.recOk : no.dataset.recNo)); if (!r) return;
  const who = (r.entry || '').match(ORG_RE)?.[1] || 'Receita Federal';
  const answer = prompt(ok ? `Aceitar o recurso de ${r.name} e devolver ${brl(r.amount)}?\n\nResposta para ele (opcional):` : `Negar o recurso de ${r.name}?\n\nResposta para ele (aparece no livro-caixa):`,
    ok ? 'Analisamos o seu caso e o desconto foi cancelado.' : 'Analisamos o seu caso e o desconto foi mantido.');
  if (answer === null) return;
  const txt = (ok ? `${who}: recurso aceito. ${brl(r.amount)} devolvidos. ${answer}` : `${who}: recurso negado. ${answer}`).trim().slice(0, 200);
  const g = await sb.from('admin_grants').insert({ user_id: r.user_id, kind: ok ? 'money' : 'message', amount: ok ? Number(r.amount) : 0, note: txt });
  if (g.error) return fail(g.error, 'responder o recurso');
  const u = await sb.from('recursos').update({ status: ok ? 'aceito' : 'negado', answer: answer.slice(0, 400), answered_at: new Date().toISOString() }).eq('id', r.id);
  if (u.error) return fail(u.error, 'marcar o recurso');
  await log(ok ? 'appeal_accept' : 'appeal_deny', r.user_id, { id: r.id, amount: r.amount, answer });
  toast(ok ? `Recurso aceito: ${brl(r.amount)} voltam para ${r.name}.` : 'Recurso negado. Ele vê a resposta no livro-caixa.'); loadRecursos();
}, true);
// quem já levou desconto sai sozinho dos alertas e passa a ser acompanhado em "avisos enviados" (volta se aparecer coisa nova)
const okRow = (r, extra) => ({ user_id: r.id, score: r.score || 0, gap: r.gap || 0, jump: r.jump || 0, pix: Math.max(r.pixInSum || 0, r.farm?.total || 0), ...extra });
async function handled(takes = []) {
  const last = {}; for (const t of takes) if (!last[t.user_id] || t.created_at > last[t.user_id].created_at) last[t.user_id] = t;
  const rows = Object.values(last).filter(t => !OKS[t.user_id] || Date.parse(OKS[t.user_id].at) < Date.parse(t.created_at)).map(t => { const r = vg.rows.find(x => x.id === t.user_id);
    return r && okRow(r, { note: `descontado ${brl(-Number(t.amount))} em ${new Date(t.created_at).toLocaleDateString('pt-BR')}`, at: t.created_at }); }).filter(Boolean);
  if (!rows.length) return;
  const { error } = await sb.from('vigia_ok').upsert(rows); if (!error) for (const x of rows) OKS[x.user_id] = x;
}
document.addEventListener('click', e => { const g = e.target.closest('[data-goto-sent]'); if (g) { e.preventDefault(); show('enviados'); } });
// passar o pano: guarda o que foi visto agora; o jogador some dos alertas até aparecer coisa nova
document.addEventListener('click', async e => {
  const p = e.target.closest('[data-pano]'), u = e.target.closest('[data-pano-undo]'); if (!p && !u) return;
  e.preventDefault(); e.stopPropagation();
  const id = p ? p.dataset.pano : u.dataset.panoUndo, r = vg?.rows.find(x => x.id === id) || {}, fm = vg?.farm.find(f => f.id === id), name = r.name || fm?.name || 'jogador';
  if (u) { const { error } = await sb.from('vigia_ok').delete().eq('user_id', id); if (error) return fail(error, 'voltar para os alertas'); delete OKS[id]; await log('vigia_unok', id, {}); toast(`${name} voltou para os alertas.`); return drawVigia(); }
  const note = prompt(`Passar o pano em ${name}? Ele sai dos alertas de trapaça e só volta se aparecer coisa nova (mais sinais, ou +R$ 50 mil sem origem ou de Pix).\n\nAnotação (opcional, só você vê):`, '');
  if (note === null) return;
  const row = { user_id: id, score: r.score || 0, gap: r.gap || 0, jump: r.jump || 0, pix: Math.max(r.pixInSum || 0, fm?.total || 0), note: note.slice(0, 300) || null, at: new Date().toISOString() };
  const { error } = await sb.from('vigia_ok').upsert(row); if (error) return fail(error, 'passar o pano');
  OKS[id] = row; await log('vigia_ok', id, { score: row.score, note: row.note }); toast(`${name} saiu dos alertas.`); drawVigia();
}, true);
// banir ou excluir direto dos alertas: um jogador ou todas as contas de uma fazenda de uma vez
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pun]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const ids = b.dataset.pun.split(',').filter(Boolean), who = b.dataset.punWho;
  const d = document.createElement('dialog'); d.className = 'ad-pun';
  d.innerHTML = `<form method="dialog"><h3>banir ou excluir</h3><p class="small"><b>${esc(who)}</b>${ids.length > 1 ? ` (${ids.length} contas)` : ''}</p>
    <label class="ad-pun__opt"><input type="radio" name="how" value="days" checked> suspender por <input class="input" type="number" name="days" min="1" max="36500" value="365" style="width:6em" autofocus> dias</label>
    <label class="ad-pun__opt"><input type="radio" name="how" value="perm"> suspender para sempre (permanente)</label>
    <label class="ad-pun__opt ad-pun__opt--bad"><input type="radio" name="how" value="del"> excluir a conta de vez (apaga login, save, perfil e Pix; não tem volta)</label>
    <label class="field"><span>motivo (o jogador vê ao tentar entrar)</span><input class="input" name="reason" maxlength="200" value="${esc(b.dataset.punWhy || '')}"></label>
    <div class="row"><button class="btn btn--glass" value="cancel">cancelar</button><button class="btn btn--danger" value="ok">aplicar</button></div></form>`;
  document.body.append(d); d.showModal();
  d.addEventListener('close', async () => {
    const f = Object.fromEntries(new FormData(d.querySelector('form'))); d.remove();
    if (d.returnValue !== 'ok') return;
    const reason = (f.reason || 'trapaça').slice(0, 200), days = Math.max(1, Math.min(36500, Math.floor(Number(f.days) || 365)));
    if (f.how === 'del') {
      if (!confirm(`EXCLUIR DE VEZ ${ids.length > 1 ? `${ids.length} contas` : 'a conta'} de ${who}?\n\nApaga o login, o save, o perfil, os Pix e tudo o que é dele. Não tem como desfazer.`)) return;
      let ok = 0; const bad = [];
      for (const id of ids) { const { data, error } = await sb.rpc('admin_delete_account', { p_user: id }); if (data === 'ok') ok++; else bad.push(error?.message || (data === 'admin' ? 'é administrador' : data)); }
      await log('delete_account', ids[0], { ids, who, reason });
      toast(`${ok} conta(s) excluída(s).${bad.length ? ` Falhou: ${bad.join('; ')}` : ''}`, !!bad.length);
    } else {
      const until = f.how === 'perm' ? null : new Date(Date.now() + days * 864e5).toISOString();
      if (!confirm(`Suspender ${who} ${until ? `por ${days} dias (até ${when(until)})` : 'PARA SEMPRE'}?\n\nMotivo: ${reason}`)) return;
      const { error } = await sb.from('bans').upsert(ids.map(id => ({ user_id: id, reason, until })));
      if (error) return fail(error, 'suspender');
      await log('ban', ids[0], { ids, who, reason, days: until ? days : 'permanente', from: 'alertas de trapaça' });
      toast(`${ids.length} conta(s) suspensa(s) ${until ? `por ${days} dias` : 'para sempre'}.`);
    }
    await loadUsers(''); loadVigia();
  });
}, true);
$('#ad-vg-reload').addEventListener('click', loadVigia);
$('#ad-vg-only').addEventListener('change', drawVigia);
$('#ad-vg-q').addEventListener('input', drawVigia);
$('#ad-pix-only')?.addEventListener('change', drawVigia);
$('#ad-pix-q')?.addEventListener('input', drawVigia);
$('#ad-pix-reload')?.addEventListener('click', loadVigia);
// sem releitura automática: cada leitura baixa o save inteiro de todos os jogadores (estourava o tráfego do plano). Use o botão recarregar.
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

// ---------- Central de Profissionais (profissionais.sql): denúncias, profissionais e contratos ----------
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
// ---------- Delegacia (delegacia.sql): B.O. que os jogadores registram uns contra os outros ----------
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

// ---------- VIP da cidade (vip.sql) ----------
// planos do VIP (vip.js): preço por mês; trimestral −10%, anual = 12 pelo preço de 10. Tudo vence: nada é para sempre.
const VPRICE = { apoiador: 9.9, patrono: 24.9, magnata: 49.9, conselho: 89.9, barao: 199, imperador: 499, mecenas: 600 }, VOFF = { 1: 0, 3: 0.1, 12: 1 / 6 };
const VTIER = { apoiador: 'Apoiador', patrono: 'Patrono', magnata: 'Magnata', conselho: 'Conselho', barao: 'Barão (Black)', imperador: 'Imperador (Black)', mecenas: 'Mecenas (Black)' }, VPER = { 1: 'mensal', 3: 'trimestral', 12: 'anual' };
const vprice = (p, m, amt) => (p === 'mecenas' ? Math.max(600, Number(amt) || 600) : Math.round((VPRICE[p] || 0) * m * (1 - (VOFF[m] || 0)) * 100) / 100);
const VNAME = new Proxy({}, { get: (_, k) => VTIER[k] || k });
async function loadVip() {
  $('#ad-vip-st').textContent = 'carregando...';
  const [rq, v, m, r] = await Promise.all([sb.from('vip_req').select('id, user_id, name, plan, months, amount, note, at').eq('done', false).order('at'),
    sb.from('vip').select('*').order('until', { ascending: false }), sb.from('vip_meta').select('*').eq('id', 1).maybeSingle(), sb.rpc('vip_raised')]);
  if (rq.error) { $('#ad-vip-st').textContent = ''; return fail(rq.error, 'carregar o VIP'); }
  const bd = $('#ad-vip-badge'); bd.hidden = !rq.data.length; bd.textContent = rq.data.length;
  $('#ad-vip-st').textContent = `arrecadado no mês: ${brl(r.data)} de ${brl(m.data?.goal)}`;
  $('#ad-vip-req').innerHTML = rq.data.map(x => `<tr><td>${when(x.at)}</td><td>${esc(x.name)}</td><td>${esc(VTIER[x.plan] || x.plan)} ${x.plan === 'mecenas' ? 'valor livre' : VPER[x.months || 1] || ''} · <b>${brl(vprice(x.plan, x.months || 1, x.amount))}</b></td><td>${esc(x.note || '')}</td>
    <td><button class="btn btn--gold btn--xs" data-vip-ok="${x.id}" data-uid="${esc(x.user_id)}" data-plan="${esc(x.plan)}" data-m="${x.months || 1}" data-amt="${x.amount || ''}" data-note="${esc(x.note || '')}">Pix conferido: liberar</button> <button class="btn btn--glass btn--xs" data-vip-no="${x.id}">recusar</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">nenhum pedido</td></tr>';
  const live = d => d && Date.parse(d) > Date.now();
  $('#ad-vip-list').innerHTML = (v.data || []).map(x => `<tr><td>${esc(x.name)}</td><td>${live(x.until) ? esc(x.tier) : '<span class="muted">pausado</span>'}</td><td>${when(x.until)}</td><td class="num">${int(x.months)}</td><td>${x.founder ? `nº ${x.founder} ${esc(x.street || '')}` : ''}</td><td>${esc(x.title || '')}</td>
    <td>${live(x.until) ? `<button class="btn btn--danger btn--xs" data-vip-rev="${esc(x.user_id)}">encerrar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">ninguém ainda</td></tr>';
  const M = m.data || {}; $('#ad-vip-open').checked = !!M.open; $('#ad-vip-open-st').innerHTML = M.open ? '<span class="tag tag--green">abertas</span>' : '<span class="tag tag--gold">em breve · pré-venda</span>';
  const { data: pre } = await sb.from('vip_presale').select('*').order('at');
  const pn = $('#ad-pre-n'); pn.textContent = (pre || []).length; pn.hidden = !(pre || []).length;
  const PST = { novo: ['novo', 'red'], contatado: ['contatado', 'gold'], fechado: ['fechado', 'green'] };
  $('#ad-pre').innerHTML = (pre || []).map((x, i) => `<tr${x.status === 'novo' ? ' class="ad-alert"' : ''}><td class="num">${i + 1}</td><td>${when(x.at)}</td><td><a href="#" data-vg-user="${esc(x.user_id)}"><b>${esc(x.name)}</b></a></td>
    <td>${esc(VTIER[x.plan] || x.plan)} ${x.plan === 'mecenas' ? '' : VPER[x.months || 1] || ''}</td><td class="num">${brl(vprice(x.plan, x.months || 1, x.amount))}</td><td>${esc(x.contact || '—')}</td><td>${esc(x.note || '')}</td>
    <td><span class="tag tag--${PST[x.status]?.[1] || 'gold'}">${PST[x.status]?.[0] || x.status}</span></td>
    <td><button class="btn btn--gold btn--xs" data-vip-ok="pre${x.id}" data-pre-id="${x.id}" data-uid="${esc(x.user_id)}" data-plan="${esc(x.plan)}" data-m="${x.months || 1}" data-amt="${x.amount || ''}" data-note="${esc(x.note || '')}" title="já preenchido: só confira o Pix e confirme (leva +1 mês grátis da pré-venda)">Pix conferido: liberar</button> ${x.status !== 'contatado' ? `<button class="btn btn--glass btn--xs" data-pre-st="${x.id}" data-v="contatado">contatado</button>` : ''} ${x.status !== 'fechado' ? `<button class="btn btn--gold btn--xs" data-pre-st="${x.id}" data-v="fechado">fechado</button>` : ''} <button class="btn btn--danger btn--xs" data-pre-del="${x.id}">remover</button></td></tr>`).join('')
    || '<tr><td colspan="9" class="muted">Ninguém na pré-venda ainda.</td></tr>';
  $('#ad-vip-pix').value = M.pix || ''; $('#ad-vip-discord').value = M.discord || ''; $('#ad-vip-goal').value = M.goal || 140; $('#ad-vip-q').value = M.poll?.q || ''; $('#ad-vip-opts').value = (M.poll?.opts || []).join('\n');
  const P = M.poll; $('#ad-vip-res').textContent = P ? `votos: ${P.opts.map((o, i) => `${o} ${(v.data || []).filter(x => live(x.until) && x.vote_key === P.key && x.vote === i).length}`).join(' · ')}` : '';
}
async function vipGrant(uid, plan, months, amount, street) {
  const { error } = await sb.rpc('vip_grant', { p_uid: uid, p_plan: plan, p_months: months, p_amount: amount, p_street: street || null });
  if (error) return fail(error, 'liberar o VIP');
  await log('vip', uid, `${plan} ${months} mês(es) R$ ${amount}${street ? ` rua ${street}` : ''}`); toast('VIP liberado: o selo aparece no jogo em até 10 min.'); loadVip();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-vip-ok], [data-vip-no], [data-vip-rev], [data-pre-st], [data-pre-del], #ad-vip-go, #ad-vip-save, #ad-vip-reload'); if (!b) return;
  if (b.dataset.preSt) { const { error } = await sb.from('vip_presale').update({ status: b.dataset.v }).eq('id', Number(b.dataset.preSt)); if (error) return fail(error, 'marcar'); return loadVip(); }
  if (b.dataset.preDel) { if (!confirm('Remover este pedido da pré-venda?')) return; const { error } = await sb.from('vip_presale').delete().eq('id', Number(b.dataset.preDel)); if (error) return fail(error, 'remover'); return loadVip(); }
  if (b.id === 'ad-vip-reload') return loadVip();
  if (b.dataset.vipOk) { const p = b.dataset.plan, m = Number(b.dataset.m) || 1, a = vprice(p, m, b.dataset.amt), pre = b.dataset.preId, mm = m + (pre ? 1 : 0); const street = ['conselho', 'barao', 'imperador', 'mecenas'].includes(p) ? prompt('Nome da rua do conselheiro (pode deixar vazio: ele escolhe na aba VIP):', b.dataset.note || '') : null;
    if (!confirm(`Conferiu o Pix de ${brl(a)} no seu banco?\n\nLiberar ${VTIER[p] || p} ${p === 'mecenas' ? '' : VPER[m]} por ${mm} ${mm === 1 ? 'mês' : 'meses'}${pre ? ' (inclui +1 mês grátis da pré-venda)' : ''}.`)) return;
    await vipGrant(b.dataset.uid, p, mm, a, street);
    if (pre) { await sb.from('vip_presale').update({ status: 'fechado' }).eq('id', Number(pre)); loadVip(); }
    return; }
  if (b.dataset.vipNo) { if (!confirm('Recusar este pedido (o Pix não chegou)?')) return; const { error } = await sb.from('vip_req').delete().eq('id', Number(b.dataset.vipNo)); if (error) return fail(error, 'recusar'); return loadVip(); }
  if (b.dataset.vipRev) { if (!confirm('Encerrar o VIP agora? Os meses e selos colecionados continuam.')) return; const { error } = await sb.rpc('vip_revoke', { p_uid: b.dataset.vipRev }); if (error) return fail(error, 'encerrar'); await log('vip-fim', b.dataset.vipRev); return loadVip(); }
  if (b.id === 'ad-vip-go') { const nick = $('#ad-vip-nick').value.trim(); if (!nick) return toast('Escreva o nick.', true);
    const { data } = await sb.from('public_profiles').select('user_id, name').ilike('name', nick.replace(/[%_\\]/g, m => '\\' + m)).limit(2);
    if (!data?.length) return toast('Nick não encontrado.', true); if (data.length > 1) return toast('Mais de um nick parecido: escreva o nick exato.', true);
    const plan = $('#ad-vip-plan').value, months = Number($('#ad-vip-m').value) || 1, amt = Number($('#ad-vip-amt').value) || 0;
    if (!confirm(`Liberar ${plan} por ${months} mês(es) para ${data[0].name} (pago ${brl(amt)})?`)) return; return vipGrant(data[0].user_id, plan, months, amt, $('#ad-vip-street').value.trim()); }
  if (b.id === 'ad-vip-save') {
    const q = $('#ad-vip-q').value.trim(), opts = $('#ad-vip-opts').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 6);
    const { data: cur } = await sb.from('vip_meta').select('poll').eq('id', 1).maybeSingle();
    const same = cur?.poll && cur.poll.q === q && JSON.stringify(cur.poll.opts) === JSON.stringify(opts);   // mudou a pergunta: votação nova, votos zeram
    const poll = q && opts.length >= 2 ? (same ? cur.poll : { key: String(Date.now()), q, opts }) : null;
    const { error } = await sb.from('vip_meta').update({ discord: $('#ad-vip-discord').value.trim(), pix: $('#ad-vip-pix').value.trim(), goal: Math.max(1, Number($('#ad-vip-goal').value) || 140), poll }).eq('id', 1);
    if (error) return fail(error, 'salvar'); await log('vip-usina', null, q || 'sem votação'); toast('Usina e votação salvas.'); loadVip(); }
});

// abrir ou fechar as vendas do VIP (fechado = "em breve" + pré-venda na aba VIP)
$('#ad-vip-open')?.addEventListener('change', async e => {
  const on = e.target.checked;
  if (!confirm(on ? 'Abrir as vendas do VIP? A aba passa a mostrar a chave Pix e os planos para comprar.' : 'Voltar para "em breve" e pré-venda?')) { e.target.checked = !on; return; }
  const { error } = await sb.from('vip_meta').update({ open: on }).eq('id', 1); if (error) { e.target.checked = !on; return fail(error, 'mudar as vendas'); }
  await log('vip-vendas', null, on ? 'abertas' : 'pré-venda'); toast(on ? 'Vendas do VIP abertas.' : 'VIP em pré-venda.'); loadVip();
});
