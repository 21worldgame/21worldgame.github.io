// Painel administrativo. Tudo o que ele faz passa pelas regras do banco (supabase/admin.sql): sem ser admin, nada funciona.
import { SUPABASE } from './supabase-config.js';
import * as W from './world.js';

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
  if (error) { err.textContent = /invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(error.message) ? 'Conta ainda não confirmada: rode o admin.sql novo no SQL Editor (ele confirma as contas).' : error.message; err.hidden = false; return; }
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
  show('overview');
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
    <td class="num">${int(p.level)}</td><td class="num">${brl(p.worth || 0)}</td><td>${esc(p.tab || '')}</td><td>${p.mobile ? 'celular' : 'computador'}</td><td>${mins(p.since)}</td></tr>`).join('')
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
  if (error) return fail(error, 'carregar os pedidos (rode o admin.sql novo)');
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
function show(tab) {
  document.querySelectorAll('.ad-nav button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab; });
  ({ overview: loadOverview, players: loadUsers, economy: loadConfig, news: loadAnns, log: loadLog, passwords: loadPw })[tab]?.();
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
}

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

async function openPlayer(id) {
  if (!users.length) await loadUsers('');
  const u = users.find(x => x.user_id === id) || { user_id: id };
  const [{ data: save }, { data: grants }] = await Promise.all([
    sb.from('saves').select('data, updated_at').eq('user_id', id).maybeSingle(),
    sb.from('admin_grants').select('id, kind, amount, note, created_at, applied_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  const s = save?.data || {};
  const facts = [['dinheiro', brl(s.money)], ['fichas', int(s.chips)], ['nível', s.level ?? '—'], ['mês do jogo', s.month ?? '—'],
    ['terras', (s.lands || []).filter(l => l.own).length], ['gado', int((s.herd || []).reduce((a, h) => a + h.heads, 0))],
    ['carros', (s.cars || []).length], ['animais de corrida', (s.stable?.animals || []).length], ['mãos de 21', int(s.stats?.hands)], ['clube de futebol', s.fut?.club ? esc(s.fut.club) : '—']];
  $('#ap-body').innerHTML = `
    <h2 id="ap-name">${esc(u.name || '(sem nome)')}</h2>
    <p class="muted small">${esc(u.email || '')}, cadastro em ${when(u.created_at)}, último acesso em ${when(u.last_sign_in_at)}, save salvo em ${when(save?.updated_at)}</p>
    ${u.banned ? `<p class="ad-err">Suspenso${u.ban_reason ? `: ${esc(u.ban_reason)}` : ''}.</p>` : ''}
    <div class="ad-tiles ad-tiles--sm">${facts.map(([k, v]) => `<div class="ad-tile"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
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
      ${(grants || []).map(g => `<tr><td>${when(g.created_at)}</td><td>${esc(g.kind)}</td><td class="num">${int(g.amount)}</td><td>${esc(g.note || '')}</td>
        <td>${g.applied_at ? `aplicada ${when(g.applied_at)}` : `pendente <button class="btn btn--glass btn--sm" data-cancel="${g.id}">cancelar</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhuma ordem ainda.</td></tr>'}
    </tbody></table></div>
    <details><summary>ver o save completo</summary><pre class="ad-json">${esc(JSON.stringify(s, null, 1).slice(0, 60000))}</pre></details>`;
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

// ---------- registro ----------
async function loadLog() {
  const { data, error } = await sb.from('admin_log').select('created_at, admin, action, target, details').order('created_at', { ascending: false }).limit(150);
  if (error) return fail(error, 'carregar o registro');
  const name = id => users.find(u => u.user_id === id)?.name || (id ? id.slice(0, 8) : '—');
  $('#ad-log').innerHTML = (data || []).map(l => `<tr><td>${when(l.created_at)}</td><td>${esc(l.admin)}</td><td>${esc(l.action)}</td><td>${esc(name(l.target))}</td>
    <td class="small">${esc(JSON.stringify(l.details || '')).slice(0, 160)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nada registrado.</td></tr>';
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
