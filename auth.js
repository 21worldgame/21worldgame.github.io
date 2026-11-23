// Login, cadastro e save na nuvem (Supabase). Sem url/anonKey em supabase-config.js, o jogo roda local, sem login.
import { SUPABASE } from './supabase-config.js';
import { adopt, G, $, save, say, writeSave, forgetUser, blankState, currentUid, keyFor, profileOf } from './store.js';
import * as L from './logic.js';
import { merge3 } from './sync-merge.js';
import { keepRestored, cleanName, validateSignup, validateLogin, validatePassword, translateError, isNameTaken, withSuffix, MIN_PASSWORD } from './authrules.js';

const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
export const configured = () => !!(SUPABASE.url && SUPABASE.anonKey);
let recovering = false, sb = null, user = null, mode = 'in', busy = false, lastPush = 0, timer = 0, rankCache = null;

export const sbClient = () => sb;
export const sbReady = () => client().catch(() => null);   // rede das mesas (net.js) usa o mesmo cliente
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
  // app instalado (no iPhone ele não divide o login com o Safari) ou link do QR "conectar celular": abre em "entrar"
  const qEmail = new URLSearchParams(location.search).get('entrar') || '', app = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  setMode(had || app || qEmail ? 'in' : 'up');   // quem nunca entrou neste aparelho vê primeiro o cadastro
  if (qEmail) $('#au-form [name="email"]').value = qEmail.slice(0, 254);
  dlg().showModal();
  $(qEmail ? '#au-form [name="password"]' : '#au-form [name="email"]').focus();
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
      const nm = cleanName(f.name), { data: same } = await c.from('public_profiles').select('user_id').ilike('name', nm.replace(/[%_\\]/g, m => '\\' + m)).limit(1);
      if (same?.length) { setMode('in'); setErr(`Já existe uma conta com o nome "${nm}". Se é você jogando em outro aparelho, entre com o mesmo e-mail (ou o mesmo botão do Google) e tudo aparece aqui.`); return; }
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
  return keepRestored(data);   // save restaurado pelo administrador depois do zeramento não é zerado de novo
}
// card = o perfil completo que os outros veem ao clicar (coluna nova: supabase/perfil.sql). Privado: só os troféus.
let noCardUntil = 0;   // coluna card faltando: tenta de novo em 5 min (não desiste para sempre)
// terras próprias que todos veem no mapa (só o essencial; perfil privado não aparece)
const mapLandsOf = s => (s.lands || []).filter(l => l.own && Number.isFinite(l.lat) && Number.isFinite(l.lon)).slice(0, 30).map(l => ({ r: l.region, c: l.city || '', u: l.use, ha: l.ha, lat: l.lat, lon: l.lon }));
function profileRow() {
  const s = G.S, row = { user_id: user.id, name: cleanName(s.avatar?.name) || 'jogador', level: s.level || 1, worth: Math.round(L.netWorth(s)), rank: L.rank(L.netWorth(s)), look: s.avatar || null, updated_at: new Date().toISOString() };
  if (Date.now() > noCardUntil) { const { look, name, level, worth, rank, ...p } = profileOf(s); row.card = p.private ? { private: true, trophies: p.trophies, pioneer: p.pioneer } : { ...p, mapLands: mapLandsOf(s) }; }
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
// cada aparelho tem um id: o save marca de onde veio, para o outro aparelho saber que precisa se atualizar
const DEV = (() => { try { let d = localStorage.getItem('21world.dev'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('21world.dev', d); } return d; } catch { return Math.random().toString(36).slice(2, 10); } })();
// Sincronização entre aparelhos com versão do servidor (não depende do relógio do aparelho, que pode estar adiantado ou atrasado).
// base = updated_at da linha da nuvem de onde o save deste aparelho veio. Gravar só funciona se a nuvem ainda estiver nessa versão;
// se outro aparelho gravou antes, este baixa a versão nova em vez de apagar o que foi feito lá (era assim que sumiam galpões).
let base = '', pushed = 0, pushing = false, outdated = false;   // outdated: a nuvem foi gravada por uma versão mais nova do jogo
const metaKey = () => `21world.sync.${user?.id}`;
function loadMeta() { try { const m = JSON.parse(localStorage.getItem(metaKey()) || 'null'); base = m?.base || ''; pushed = Number(m?.pushed) || 0; } catch { base = ''; pushed = 0; } }
function saveMeta() { try { localStorage.setItem(metaKey(), JSON.stringify({ base, pushed })); } catch {} }
// cópia do save como estava na nuvem na última sincronização: é o ponto de partida para juntar o que cada aparelho fez
// ---------- proteção contra perda ----------
// progresso de um save: patrimônio + coisas que a pessoa tem. Serve para escolher entre duas versões (nunca pela hora do save)
export function progressOf(d) {
  if (!d || typeof d !== 'object') return 0;
  let w = 0; try { w = L.netWorth({ money: 0, lands: [], herd: [], loans: [], lent: [], cars: [], stock: {}, prices: {}, ...d }); } catch { w = Number(d.money) || 0; }
  const n = a => (Array.isArray(a) ? a.length : 0), biz = d.biz ? Object.values(d.biz).reduce((t, x) => t + n(x), 0) : 0;
  return w + (n(d.lands) * 1e5) + (n(d.cars) * 5e4) + (biz * 2e5) + (n(d.cards) * 3e3) + (n(d.stable?.animals) * 3e4) + (Number(d.xp) || 0) + (Number(d.level) || 0) * 1e4;
}
// antes de qualquer versão substituir outra, a que sai vira cópia aqui (últimas 5): dá para restaurar no perfil
const bkKey = () => `21world.backup.${user?.id || 'local'}`;
export function backups() { try { return JSON.parse(localStorage.getItem(bkKey()) || '[]'); } catch { return []; } }
export function backup(d, why) {
  if (!d || typeof d !== 'object') return;
  try {
    const list = backups().filter(b => b.savedAt !== d.savedAt);
    list.unshift({ at: Date.now(), why, savedAt: d.savedAt || 0, worth: Math.round(progressOf(d)), money: Math.round(Number(d.money) || 0), lands: (d.lands || []).filter(l => l.own).length, data: JSON.stringify(d) });
    for (let k = 5; k >= 1; k--) { try { localStorage.setItem(bkKey(), JSON.stringify(list.slice(0, k))); return; } catch {} }   // sem espaço: guarda menos cópias
  } catch {}
}
// volta uma cópia: ela vira o save atual e vai para a nuvem (a versão de agora também vira cópia, por garantia)
export async function restore(i) {
  const b = backups()[i]; if (!b) return false;
  backup(G.S, 'antes de restaurar');
  adopt(JSON.parse(b.data)); save(); G.render?.();
  if (user) await push().catch(() => {});
  return true;
}
let baseData = null;
const baseKey = () => `21world.syncbase.${user?.id}`;
function setBaseData(d) { try { baseData = d ? JSON.parse(typeof d === 'string' ? d : JSON.stringify(d)) : null; d ? localStorage.setItem(baseKey(), typeof d === 'string' ? d : JSON.stringify(d)) : localStorage.removeItem(baseKey()); } catch { baseData = null; } }
function loadBaseData() { try { baseData = JSON.parse(localStorage.getItem(baseKey()) || 'null'); } catch { baseData = null; } }
// o outro aparelho gravou enquanto este tinha coisa não enviada: junta os dois (nada é descartado) e envia o resultado
function mergeRemote(row) {
  if (newerThanMe(row.data)) return;
  if (row.restored) return takeRemote(row);   // administrador restaurou o save: vale a nuvem, não a junção com o que o aparelho zerou sozinho
  const m = dirty() && baseData ? merge3(baseData, G.S, row.data) : null;
  if (!m) return takeRemote(row);   // takeRemote guarda cópia do que este aparelho tinha
  backup(G.S, 'antes de juntar com o outro aparelho');
  adopt(m); base = row.updated_at; setBaseData(row.data); saveMeta();
  save(); G.render();                                              // save marca como não enviado: o próximo push grava a junção
}
const sameAt = (a, b) => !!a && !!b && Date.parse(a) === Date.parse(b);
const dirty = () => (G.S.savedAt || 0) !== pushed;
const serverIso = () => new Date(G.now?.() ?? Date.now()).toISOString();   // hora do servidor (Live.now)
// versão antiga do jogo (app aberto há tempo no celular) não pode gravar um save da versão nova: ela descartaria o que não conhece
function newerThanMe(d) { if ((Number(d?.appV) || 0) > (G.appV || 0)) { outdated = true; G.checkUpdate?.(); say('Saiu uma versão nova do jogo: atualizando para não perder nada do seu progresso.', true); return true; } return false; }
function takeRemote(row, msg = true) {
  if (newerThanMe(row.data)) return;                              // não aplica com código velho: espera a atualização
  if (dirty() && progressOf(G.S) > progressOf(row.data) * 1.001) { backup(G.S, 'versão deste aparelho (a nuvem chegou junto)'); }
  else if (dirty()) backup(G.S, 'mudanças deste aparelho antes de atualizar');
  adopt(row.data); base = row.updated_at; setBaseData(row.data); pushed = G.S.savedAt || 0; lastPush = pushed; saveMeta(); syncedAt = Date.now(); G.render();
  if (msg) say('Atualizado com o que você fez no outro aparelho.');
}
export async function push() {
  if (!sb || !user || pushing || outdated) return false;
  pushing = true;
  try {
    const stamp = G.S.savedAt || 0, at = serverIso(), data = { ...G.S, dev: DEV, appV: G.appV || 0 }, snap = JSON.stringify(data);
    let res;
    if (base) res = await sb.from('saves').update({ data, updated_at: at }).eq('user_id', user.id).eq('updated_at', base).select('updated_at');
    else res = await sb.from('saves').insert({ user_id: user.id, data, updated_at: at }).select('updated_at');
    if (res.error || !res.data?.length) {
      // outro aparelho gravou antes (ou a linha já existia): a nuvem vale; este aparelho se atualiza
      if (res.error && (base || !/duplicate|conflict|23505/i.test(`${res.error.code} ${res.error.message}`))) { lastErrAt = Date.now(); setTimeout(() => { if (dirty()) scheduleSync(); }, 8000); return false; }   // erro de rede: tenta de novo sozinho
      if (G.busy?.()) return false;                                   // no meio de uma mão: tenta de novo no próximo save
      const row = await pull();
      if (!row) { base = ''; saveMeta(); return false; }              // a linha sumiu (conta zerada pelo admin): grava de novo no próximo save
      mergeRemote(row); return false;
    }
    base = res.data[0].updated_at; setBaseData(snap); pushed = stamp; lastPush = stamp; saveMeta(); syncedAt = Date.now();
    try { bc?.send({ type: 'broadcast', event: 'saved', payload: { dev: DEV } })?.catch?.(() => {}); } catch {}   // avisa o outro aparelho na hora
    let row = profileRow(), r = await sb.from('public_profiles').upsert(row);
    if (r.error && /card/i.test(r.error.message || '')) { noCardUntil = Date.now() + 300000; row = profileRow(); r = await sb.from('public_profiles').upsert(row); }   // coluna card ainda não criada no servidor
    if (r.error && isNameTaken(r.error)) {                      // outro jogador já usa esse nome: troca por um com número
      G.S.avatar.name = withSuffix(row.name, Math.floor(10 + Math.random() * 90));
      save(); row = profileRow(); r = await sb.from('public_profiles').upsert(row);
      if (!r.error) { G.render(); say(`Esse nome já estava em uso. Você agora é "${G.S.avatar.name}".`); }
    }
    return true;
  } finally {
    pushing = false;
    if (user && dirty()) scheduleSync();                          // salvou de novo enquanto gravava: manda o resto
  }
}
// celular e computador abertos ao mesmo tempo: confere a versão da nuvem a cada 5 s (e ao voltar para a aba);
// se outro aparelho gravou, aplica na hora (nunca no meio de uma mão, corrida ou partida)
export const isOutdated = () => outdated;   // game.js: aparelho travado esperando a versão nova continua tentando recarregar
// outro aparelho gravou: o aviso chega pelo Realtime em ~1 s e só dispara a conferência normal (gravação condicional e versão continuam valendo)
let bc = null;
function watchSaves() {
  if (bc || !sb || !user) return;
  try { bc = sb.channel(`save-${user.id}`).on('broadcast', { event: 'saved' }, ({ payload }) => { if (payload?.dev !== DEV) setTimeout(checkRemote, 300); }).subscribe(); } catch {}
}
async function checkRemote() {
  if (!sb || !user || pushing || outdated || document.visibilityState === 'hidden' || G.busy?.()) return;
  try {
    const { data } = await sb.from('saves').select('updated_at').eq('user_id', user.id).maybeSingle();
    if (!data || sameAt(data.updated_at, base)) return;
    const row = await pull();
    if (row && !sameAt(row.updated_at, base) && !pushing) mergeRemote(row);
  } catch {}
}
setInterval(checkRemote, 5000);
// sincronização na tela (perfil): quando gravou por último, se há algo pendente, e o botão "sincronizar agora"
let syncedAt = 0;
export const syncInfo = () => ({ on: !!user, at: syncedAt, pending: !!user && dirty(), email: user?.email || '' });
export async function syncNow() { if (!user) return false; await checkRemote(); const ok = await push().catch(() => false); return ok || !dirty(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkRemote(); });
addEventListener('pageshow', e => { if (e.persisted) checkRemote(); });   // celular: voltou do cache da página (bfcache) com o jogo velho
addEventListener('focus', () => checkRemote());
// celular fecha o app ou trava a tela antes do envio de 1,5 s: manda na hora (e de novo quando a internet volta)
const flush = () => { if (user && dirty()) { clearTimeout(timer); push().catch(() => {}); } };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);
addEventListener('online', () => { flush(); setTimeout(checkRemote, 500); });
let lastErrAt = 0;
export const syncState = () => ({ on: !!user, pending: !!user && dirty(), offline: typeof navigator !== 'undefined' && navigator.onLine === false, at: syncedAt, err: lastErrAt });
function scheduleSync() {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => push().catch(() => {}), 1500);   // quase em tempo real: outro aparelho vê o progresso em segundos
}
// terras dos outros jogadores de verdade, para o mapa
let mapCache = null;
export async function mapLands(maxAge = 60000) {
  if (!sb || !user) return [];
  if (mapCache && Date.now() - mapCache.at < maxAge) return mapCache.rows;
  const { data, error } = await sb.from('public_profiles').select('user_id, name, ml:card->mapLands').not('card->mapLands', 'is', null).limit(300);
  if (error) return mapCache?.rows || [];
  const rows = data.filter(p => p.user_id !== user.id && Array.isArray(p.ml)).flatMap(p => p.ml.map(l => ({ owner: p.name, region: String(l.r || ''), city: String(l.c || ''), use: String(l.u || ''), ha: Number(l.ha) || 0, lat: Number(l.lat), lon: Number(l.lon) }))).filter(l => Number.isFinite(l.lat) && Number.isFinite(l.lon));
  mapCache = { at: Date.now(), rows };
  return rows;
}
// o que cada jogador com conta tem plantado (perfil público): entra na conta de oferta e demanda do mundo (econ.js)
let cropCache = null;
export async function cropsCloud(maxAge = 300000) {
  if (!sb || !user) return [];
  if (cropCache && Date.now() - cropCache.at < maxAge) return cropCache.rows;
  const { data, error } = await sb.from('public_profiles').select('user_id, cr:card->crops').not('card->crops', 'is', null).limit(500);
  if (error) return cropCache?.rows || [];
  cropCache = { at: Date.now(), rows: data.map(p => p.cr).filter(c => c && typeof c === 'object') };
  return cropCache.rows;
}
const RANK_CUT = '2026-11-22T21:20:00Z';   // v161: zeramento geral; v159: só entra no ranking quem já abriu o jogo depois do recomeço com R$ 10 mil
export async function ranking(maxAge = 60000) {
  if (!sb || !user) return null;
  if (rankCache && Date.now() - rankCache.at < maxAge) return rankCache.rows;
  const { data, error } = await sb.from('public_profiles').select('user_id, name, level, worth, rank, look').gte('updated_at', RANK_CUT).order('worth', { ascending: false }).limit(10);
  if (error) return rankCache?.rows || null;
  rankCache = { at: Date.now(), rows: data };
  return data;
}

// logo depois de autenticar: escolhe qual save vale e, se trocou de conta, recarrega com o save certo
async function afterLogin() {
  const previous = currentUid();
  let cloud = null;
  try { cloud = await pull(); } catch { say('Não foi possível ler seu save na nuvem. Jogando com o save deste aparelho.', true); }
  loadMeta(); loadBaseData();
  const useCloud = () => { writeSave(user.id, cloud.data); base = cloud.updated_at; setBaseData(cloud.data); pushed = cloud.data?.savedAt || 0; saveMeta(); location.reload(); return new Promise(() => {}); };
  if (previous !== user.id) {
    if (cloud) return useCloud();
    const fresh = blankState(cleanName(user.user_metadata?.name || user.user_metadata?.full_name));   // conta nova começa do zero
    writeSave(user.id, fresh); base = ''; pushed = 0; saveMeta();
    location.reload();
    return new Promise(() => {});
  }
  if (cloud) {
    if (newerThanMe(cloud.data)) { if (!base) { base = 'velho'; saveMeta(); } }   // não grava nem aplica: a versão nova, ao abrir, vê que a nuvem mudou e usa a nuvem
    else if (!base) {   // primeira vez com a sincronização nova neste aparelho: vale o mais novo (regra antiga, uma vez só)
      const pc = progressOf(cloud.data), pl = progressOf(G.S);
      if (pc >= pl) { backup(G.S, 'save deste aparelho (a nuvem tinha mais progresso)'); return useCloud(); }
      backup(cloud.data, 'save da nuvem (este aparelho tinha mais progresso)');
      base = cloud.updated_at; setBaseData(cloud.data); pushed = 0; saveMeta();   // este aparelho tem mais progresso: grava por cima (a nuvem ficou na cópia)
    } else if (!sameAt(cloud.updated_at, base)) {                // outro aparelho gravou depois que este sincronizou
      if (cloud.restored || !dirty() || !baseData || !merge3(baseData, G.S, cloud.data)) { if (dirty()) backup(G.S, 'mudanças deste aparelho que não deu para juntar'); return useCloud(); }   // nada pendente aqui: a nuvem vale
      mergeRemote(cloud);                                           // havia coisa não enviada neste aparelho: junta com a nuvem
    }
  } else if (base) { base = ''; saveMeta(); }                       // não há save na nuvem: este aparelho cria
  if (dlg().open) dlg().close();
  try { localStorage.setItem('21world.hadAccount', '1'); } catch {}
  G.afterSave = scheduleSync;
  watchRanking(); watchSaves();
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user && dirty()) push().catch(() => {}); });
  return 'ok';
}
export const MINPW = MIN_PASSWORD;
