// Login, cadastro e save na nuvem (Supabase). Sem url/anonKey em supabase-config.js, o jogo roda local, sem login.
import { SUPABASE } from './supabase-config.js';
import { G, $, save, say, writeSave, forgetUser, blankState, currentUid, keyFor, profileOf } from './store.js';
import * as L from './logic.js';
import { cleanName, validateSignup, validateLogin, validatePassword, translateError, isNameTaken, withSuffix, MIN_PASSWORD } from './authrules.js';

const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
export const configured = () => !!(SUPABASE.url && SUPABASE.anonKey);
let recovering = false, sb = null, user = null, mode = 'in', busy = false, lastPush = 0, timer = 0, rankCache = null;

export const sbClient = () => sb;
export const account = () => (user ? { id: user.id, email: user.email } : null);

async function client() {
  if (!configured()) return null;
  if (sb) return sb;
  const lib = await import(LIB);
  sb = lib.createClient(SUPABASE.url, SUPABASE.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return sb;
}

// ---------- tela de entrada ----------
const dlg = () => $('#dlg-auth');
function setErr(msg) { const e = $('#au-err'); e.textContent = msg || ''; e.hidden = !msg; }
function setBusy(on) { busy = on; $('#au-submit').disabled = on; $('#au-submit').dataset.busy = on ? '1' : ''; }
function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-au-tab]').forEach(b => { const on = b.dataset.auTab === m; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-up]').forEach(el => { el.hidden = m !== 'up'; });
  $('#au-form [name="password"]').autocomplete = m === 'up' ? 'new-password' : 'current-password';
  $('#au-submit').textContent = m === 'up' ? 'criar conta' : 'entrar';
  $('#au-title').textContent = m === 'up' ? 'crie sua conta' : 'entre para jogar';
  $('#au-forgot').hidden = m === 'up';
  setErr('');
}
function showGate() {
  if (dlg().open) return;
  const show = providers => {
    $('#au-oauth').hidden = !providers.length;
    $('#au-oauth-btns').innerHTML = providers.map(p => `<button type="button" class="btn btn--glass btn--oauth" data-au-oauth="${p}">${p === 'google' ? '<span class="g-ico" aria-hidden="true">G</span>' : ''}entrar com ${p === 'github' ? 'GitHub' : 'Google'}</button>`).join('');
  };
  show((SUPABASE.providers || []).filter(p => ['github', 'google'].includes(p)));
  // o botão do Google aparece sozinho quando o provedor for ligado no projeto
  fetch(`${SUPABASE.url}/auth/v1/settings`, { headers: { apikey: SUPABASE.anonKey } }).then(r => r.json())
    .then(st => show(['google', 'github'].filter(p => st?.external?.[p]))).catch(() => {});
  let had = false; try { had = !!localStorage.getItem('21world.hadAccount'); } catch {}
  setMode(had ? 'in' : 'up');                // quem nunca entrou vê primeiro o cadastro
  dlg().showModal();
  $('#au-form [name="email"]').focus();
}

async function submit(e) {
  e.preventDefault();
  if (busy) return;
  const f = Object.fromEntries(new FormData($('#au-form')));
  f.adult = $('#au-form [name="adult"]').checked;
  const bad = mode === 'up' ? validateSignup(f) : validateLogin(f);
  if (bad) return setErr(bad);
  setErr(''); setBusy(true);
  try {
    const c = await client();
    if (mode === 'up') {
      const { data, error } = await c.auth.signUp({ email: f.email.trim(), password: f.password,
        options: { data: { name: cleanName(f.name) }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      if (!data.session) {   // projeto ainda com confirmação ligada: tenta entrar direto (o banco já confirma a conta sozinho)
        const again = await c.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
        if (!again.error) { user = again.data.user; $('#au-form [name="password"]').value = ''; await afterLogin(); return; }
        setMode('in');
        $('#au-form [name="password"]').value = '';
        setErr('');
        $('#au-info').textContent = 'Conta criada. Entre com o seu e-mail e senha.';
        $('#au-info').hidden = false;
        return;
      }
      user = data.session.user;
    } else {
      const { data, error } = await c.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
      if (error) throw error;
      user = data.user;
    }
    $('#au-form [name="password"]').value = '';
    await afterLogin();
  } catch (err) {
    setErr(translateError(err));
  } finally { setBusy(false); }
}

// recuperar senha sem e-mail: o pedido vai para análise da equipe, que troca a senha manualmente
function forgot() {
  const d = $('#dlg-forgot'), f = $('#fg-form');
  f.reset(); f.hidden = false; $('#fg-done').hidden = true; $('#fg-err').hidden = true;
  f.email.value = $('#au-form [name="email"]').value.trim();
  d.showModal();
}
async function sendForgot(e) {
  e.preventDefault();
  const f = e.target, err = $('#fg-err');
  const email = f.email.value.trim().toLowerCase(), pw = f.password.value;
  const bad = (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && 'Digite um e-mail válido.') || validatePassword(pw) || (pw !== f.again.value && 'As duas senhas precisam ser iguais.') || (cleanName(f.nick.value).length < 3 && 'Digite o nome do seu personagem no jogo.');
  if (bad) { err.textContent = bad; err.hidden = false; return; }
  err.hidden = true; f.querySelector('button').disabled = true;
  try { await (await client()).rpc('request_password_reset', { p_email: email, p_name: cleanName(f.nick.value), p_details: f.details.value.slice(0, 300), p_password: pw }); } catch {}
  f.querySelector('button').disabled = false;
  f.hidden = true; $('#fg-done').hidden = false;      // a resposta é sempre a mesma: não revela se o e-mail tem conta
}

async function oauth(provider) {
  setErr('');
  const { error } = await (await client()).auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
  if (error) setErr(translateError(error));
}

// link de recuperação de senha: pede a senha nova
function showRecovery() {
  if (dlg().open) dlg().close();
  const d = $('#dlg-recovery');
  if (!d.open) d.showModal();
}
async function saveNewPassword(e) {
  e.preventDefault();
  const pw = $('#rc-form [name="password"]').value, again = $('#rc-form [name="again"]').value, err = $('#rc-err');
  const bad = validatePassword(pw) || (pw !== again ? 'As duas senhas precisam ser iguais.' : null);
  if (bad) { err.textContent = bad; err.hidden = false; return; }
  err.hidden = true;
  const { error } = await (await client()).auth.updateUser({ password: pw });
  if (error) { err.textContent = translateError(error); err.hidden = false; return; }
  $('#dlg-recovery').close();
  say('Senha alterada.');
  const { data } = await sb.auth.getSession();
  if (data.session) { user = data.session.user; await afterLogin(); }
}

// ---------- save na nuvem ----------
async function pull() {
  const { data, error } = await sb.from('saves').select('data, updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data;
}
// card = o perfil completo que os outros veem ao clicar (coluna nova: supabase/perfil.sql). Privado: só os troféus.
let noCard = false;
function profileRow() {
  const s = G.S, row = { user_id: user.id, name: cleanName(s.avatar?.name) || 'jogador', level: s.level || 1, worth: Math.round(L.netWorth(s)), rank: L.rank(L.netWorth(s)), look: s.avatar || null, updated_at: new Date().toISOString() };
  if (!noCard) { const { look, name, level, worth, rank, ...p } = profileOf(s); row.card = p.private ? { private: true, trophies: p.trophies } : p; }
  return row;
}
// perfil de outro jogador da nuvem (ao clicar no ranking)
export async function profileCard(id) {
  if (!sb || !user) return null;
  let r = await sb.from('public_profiles').select('user_id, name, level, worth, rank, look, card').eq('user_id', id).maybeSingle();
  if (r.error) r = await sb.from('public_profiles').select('user_id, name, level, worth, rank, look').eq('user_id', id).maybeSingle();
  if (r.error || !r.data) return null;
  const { card, ...base } = r.data;
  return { ...(card || {}), ...base, worth: Number(base.worth), noCard: !card };
}
export async function push() {
  if (!sb || !user) return false;
  const stamp = G.S.savedAt || Date.now();
  const { error } = await sb.from('saves').upsert({ user_id: user.id, data: G.S, updated_at: new Date().toISOString() });
  if (error) return false;
  let row = profileRow(), r = await sb.from('public_profiles').upsert(row);
  if (r.error && /card/i.test(r.error.message || '')) { noCard = true; row = profileRow(); r = await sb.from('public_profiles').upsert(row); }   // coluna card ainda não criada no servidor
  if (r.error && isNameTaken(r.error)) {                      // outro jogador já usa esse nome: troca por um com número
    G.S.avatar.name = withSuffix(row.name, Math.floor(10 + Math.random() * 90));
    save(); row = profileRow(); r = await sb.from('public_profiles').upsert(row);
    if (!r.error) { G.render(); say(`Esse nome já estava em uso. Você agora é "${G.S.avatar.name}".`); }
  }
  lastPush = stamp;
  return true;
}
function scheduleSync() {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => push().catch(() => {}), 1500);   // quase em tempo real: outro aparelho vê o progresso em segundos
}
export async function ranking(maxAge = 60000) {
  if (!sb || !user) return null;
  if (rankCache && Date.now() - rankCache.at < maxAge) return rankCache.rows;
  const { data, error } = await sb.from('public_profiles').select('user_id, name, level, worth, rank, look').order('worth', { ascending: false }).limit(10);
  if (error) return rankCache?.rows || null;
  rankCache = { at: Date.now(), rows: data };
  return data;
}

// logo depois de autenticar: escolhe qual save vale e, se trocou de conta, recarrega com o save certo
async function afterLogin() {
  const previous = currentUid();
  let cloud = null;
  try { cloud = await pull(); } catch { say('Não foi possível ler seu save na nuvem. Jogando com o save deste aparelho.', true); }
  if (previous !== user.id) {
    if (cloud) writeSave(user.id, cloud.data);
    else {
      const fresh = blankState(cleanName(user.user_metadata?.name || user.user_metadata?.full_name));   // conta nova começa do zero
      fresh.chips = (fresh.chips || 0) + 500;                                                               // bônus de boas-vindas da tela de entrada
      writeSave(user.id, fresh);
    }
    location.reload();
    return new Promise(() => {});
  }
  if (cloud && (cloud.data?.savedAt || 0) > (G.S.savedAt || 0) + 1000) { writeSave(user.id, cloud.data); location.reload(); return new Promise(() => {}); }
  if (dlg().open) dlg().close();
  try { localStorage.setItem('21world.hadAccount', '1'); } catch {}
  G.afterSave = scheduleSync;
  watchRanking();
  await push().catch(() => {});
  renderAccount();
  G.onLogin?.();
}

// ranking em tempo real: o banco avisa quando algum perfil muda (precisa da replicação ligada; sem ela, o jogo consulta a cada poucos segundos)
let rankCb = null, rankSub = false;
export const onRankChange = fn => { rankCb = fn; };
function watchRanking() {
  if (rankSub || !sb) return;
  rankSub = true;
  try { sb.channel('rk').on('postgres_changes', { event: '*', schema: 'public', table: 'public_profiles' }, () => { rankCache = null; rankCb?.(); }).subscribe(); } catch {}
}
function renderAccount() {
  const el = $('#account-line'); if (!el) return;
  el.hidden = !user;
  if (user) el.textContent = `Conta: ${user.email}`;
}

export async function logout() {
  let synced = false;
  try { synced = await push(); } catch {}
  if (!synced && !confirm('Não deu para enviar seu progresso para a nuvem agora. Se sair, o que você jogou desde o último envio pode se perder. Sair mesmo assim?')) return;
  await sb?.auth.signOut();
  try { localStorage.removeItem(keyFor(user.id)); } catch {}   // não deixa o save desta conta num aparelho compartilhado
  forgetUser();
  location.reload();
}
// LGPD: apaga o save e o perfil público da nuvem e sai. (Apagar o cadastro em si é feito no painel do Supabase.)
export async function wipe() {
  if (!sb || !user) return;
  await sb.from('saves').delete().eq('user_id', user.id);
  await sb.from('public_profiles').delete().eq('user_id', user.id);
  try { localStorage.removeItem(keyFor(user.id)); } catch {}
  await sb.auth.signOut();
  forgetUser();
  location.reload();
}

// ---------- início ----------
export async function boot() {
  if (!configured()) return 'local';
  document.addEventListener('submit', e => { if (e.target.id === 'au-form') submit(e); if (e.target.id === 'rc-form') saveNewPassword(e); if (e.target.id === 'fg-form') sendForgot(e); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-au-tab]'); if (t) { $('#au-info').hidden = true; setMode(t.dataset.auTab); }
    const o = e.target.closest('[data-au-oauth]'); if (o) oauth(o.dataset.auOauth);
    if (e.target.closest('#au-forgot')) forgot();
  });
  dlg().addEventListener('cancel', e => e.preventDefault());          // a tela de entrada não fecha com Esc
  $('#dlg-recovery').addEventListener('cancel', e => e.preventDefault());
  let c;
  try { c = await client(); } catch { say('Não foi possível carregar o login. Jogando sem conta por enquanto.', true); return 'offline'; }
  c.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; showRecovery(); } });
  const { data } = await c.auth.getSession();
  if (!data.session) { forgetUser(); showGate(); return 'gate'; }
  const check = await c.auth.getUser();
  if (check.error?.status === 401 || check.error?.status === 403 || (!check.error && !check.data?.user)) {
    try { localStorage.removeItem(keyFor(data.session.user.id)); } catch {}
    await c.auth.signOut().catch(() => {});
    forgetUser(); showGate(); return 'gate';
  }
  user = data.session.user;
  if (recovering) { showRecovery(); return 'recovery'; }       // a conta só segue depois de definir a senha nova
  await afterLogin();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user && (G.S.savedAt || 0) > lastPush) push().catch(() => {}); });
  return 'ok';
}
export const MINPW = MIN_PASSWORD;
