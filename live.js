// Ligação do jogo com o painel administrativo: configuração e eventos, avisos, suspensões e ordens do admin.
// Se as tabelas do supabase/admin.sql ainda não existirem, tudo aqui fica quieto e o jogo segue normal.
import { applyTune } from './tune.js';
import { G, $, esc, brl, int, say, save, note, badge, levelUp, blankState, profileOf } from './store.js';
import * as P from './progress.js';
import * as Auth from './auth.js';
import * as W from './world.js';
import { CLOCK as NPC_CLOCK } from './npcs.js';
import * as L from './logic.js';

export const CFG = { xp_mult: 1, daily_mult: 1, job_mult: 1, prize_mult: 1, maintenance: false, maintenance_msg: '', event: '' };
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(10, Number(v)) : d);
let isAdmin = false, timer = 0, anns = [], clockOffset = 0;
CFG.world = { ...W.DEFAULT };
// só no seu computador (localhost) dá para simular o mundo em testes; no site publicado vale sempre a config do servidor
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
export const world = () => { if (LOCAL) { try { const t = localStorage.getItem('21world.worldTest'); if (t) return W.sanitize(JSON.parse(t)); } catch {} } return CFG.world; };
export const now = () => Date.now() + clockOffset;       // hora do servidor (corrige relógio errado do aparelho)
export let worldReady = false;

async function syncClock() {
  try {
    const r = await fetch(`${location.origin}${location.pathname}`, { method: 'HEAD', cache: 'no-store' });   // a própria hospedagem informa a hora certa
    const t = Date.parse(r.headers.get('date') || '');
    if (Number.isFinite(t)) clockOffset = t - Date.now();
  } catch {}
}
export async function start() {
  await syncClock();
  const sb = Auth.sbClient();
  if (!sb) { worldReady = true; return 'off'; }
  await loadConfig(sb);
  worldReady = true;
  await loadAnnouncements(sb);
  let banned = false;
  if (Auth.account()) {
    try { const { data } = await sb.rpc('is_admin'); isAdmin = data === true; } catch {}
    if (isAdmin && !G.S.fix171) { G.S.money = 10000; G.S.fix171 = 1; badge('Administrador', 'Sua carteira voltou para R$ 10 mil.', 'mission'); save(); G.render?.(); }   // pedido do dono: volta a R$ 10 mil (uma vez)
    if (isAdmin) adminWipe(sb).catch(() => {});
    banned = await checkBan(sb);   // pausado/suspenso: o timer segue rodando para saber quando soltar
    if (!banned) await applyGrants(sb);
  }
  maintenance();
  realtime(sb);
  clearInterval(timer);
  timer = setInterval(async () => {
    await loadConfig(sb); await loadAnnouncements(sb); maintenance();
    if (Auth.account()) { if (await checkBan(sb)) return; await applyGrants(sb); if (!isAdmin) await receita(sb); }
  }, 10000);
  return banned ? 'banned' : 'ok';
}

// Receita Federal: 1ª vez que o patrimônio dispara é só o aviso; se disparar de novo em até 24 h, pausa a conta (receita.sql)
const amostras = [];
async function receita(sb) {
  const s = G.S, gain = L.receitaFlag(amostras, Date.now(), L.netWorth(s));
  if (!gain) return;
  amostras.length = 0;   // a próxima medição começa do zero
  if (!s.receitaAt || Date.now() - s.receitaAt > 864e5) {
    s.receitaAt = Date.now(); save();
    $('#rf-gain').textContent = brl(gain);
    const d = $('#dlg-receita'); if (d && !d.open) d.showModal();
    return;
  }
  try { await sb.rpc('receita_pausa', { p_gain: Math.round(gain), p_worth: Math.round(L.netWorth(s)) }); } catch {}
  await checkBan(sb);
}
export const admin = () => isAdmin;
// tempo real: dinheiro do administrador, eventos e avisos chegam na hora (a consulta a cada 20 s fica de reserva)
let rtOn = false;
function realtime(sb) {
  if (rtOn) return; rtOn = true;
  try {
    const me = Auth.account()?.id, ch = sb.channel('live-game');
    if (me) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_grants', filter: `user_id=eq.${me}` }, () => applyGrants(sb));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'game_config' }, async () => { await loadConfig(sb); maintenance(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, async () => { await loadAnnouncements(sb); maintenance(); })
      .subscribe();
  } catch {}
  presence(sb);
}
// presença em tempo real: o painel admin vê quem está com o jogo aberto agora (some sozinho ao fechar a aba)
function presence(sb) {
  try {
    const key = `t${Math.random().toString(36).slice(2, 10)}`, since = Date.now();
    const ch = sb.channel('online-players', { config: { presence: { key } } });
    const info = () => { const a = Auth.account(), p = G.S ? profileOf() : {}; return { uid: a?.id || null, name: String(p.name || 'visitante').slice(0, 24), level: p.level || 1, worth: Math.round(p.worth || 0), tab: location.hash.slice(1) || 'cassino', since, mobile: matchMedia('(max-width: 40rem)').matches }; };
    ch.subscribe(st => { if (st === 'SUBSCRIBED') ch.track(info()); });
    setInterval(() => ch.track(info()), 30000);
    addEventListener('hashchange', () => ch.track(info()));
  } catch {}
}

// v164: depois do zeramento geral (v161), o administrador solta no servidor o que era dos donos antigos (uma vez por aparelho; repetir não faz mal)
async function adminWipe(sb) {
  const K = '21world.adminWipe161'; try { if (localStorage.getItem(K)) return; } catch {}
  const me = Auth.account().id, out = [];
  if (!G.S.mina) { const { data } = await sb.rpc('admin_release_mine'); out.push(`mina: ${data}`); }
  const { data: cos } = await sb.from('company_owner').select('brand, owner');
  for (const c of cos || []) if (c.owner !== me) await sb.rpc('admin_release_company', { p_brand: c.brand });
  out.push(`marcas soltas: ${(cos || []).filter(c => c.owner !== me).length}`);
  const { data: acc } = await sb.from('acc_stock').select('id, left_qty');
  let back = 0; for (const a of acc || []) for (let k = a.left_qty; k < 35; k++) { await sb.rpc('give_acc', { p_id: a.id }); back++; }
  out.push(`acessórios devolvidos ao estoque: ${back}`);
  try { localStorage.setItem(K, String(Date.now())); } catch {}
  badge('Administrador', `Servidor limpo depois do zeramento. ${out.join(' · ')}.`, 'mission');
}

async function loadConfig(sb) {
  const { data, error } = await sb.from('game_config').select('data').eq('id', 1).maybeSingle();
  if (error || !data) return;
  const d = data.data || {};
  CFG.world = W.sanitize(d.world || W.DEFAULT); NPC_CLOCK.world = CFG.world;
  Object.assign(CFG, { xp_mult: num(d.xp_mult, 1), daily_mult: num(d.daily_mult, 1), job_mult: num(d.job_mult, 1), prize_mult: num(d.prize_mult, 1),
    maintenance: !!d.maintenance, maintenance_msg: String(d.maintenance_msg || '').slice(0, 280), event: String(d.event || '').slice(0, 120) });
  P.setXpMult(CFG.xp_mult);
  applyTune(d.tuning);
  renderBar();
}

async function loadAnnouncements(sb) {
  await checkReopen(sb);
  const { data, error } = await sb.from('announcements').select('id, text, kind').order('created_at', { ascending: false }).limit(5);
  if (error) return;
  anns = data || [];
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem('21world.ann') || '[]'); } catch {}
  for (const a of anns) if (!seen.includes(a.id)) { badge(a.kind === 'evento' ? 'Evento' : a.kind === 'alerta' ? 'Aviso importante' : 'Aviso', a.text, 'mission'); seen.push(a.id); }
  try { localStorage.setItem('21world.ann', JSON.stringify(seen.slice(-50))); } catch {}
  renderBar();
}

function renderBar() {
  const bar = $('#ann-bar'); if (!bar) return;
  const items = [...(CFG.event ? [{ text: CFG.event, kind: 'evento' }] : []), ...anns];
  const mults = [CFG.xp_mult > 1 && `XP x${CFG.xp_mult}`, CFG.daily_mult > 1 && `roleta do dia x${CFG.daily_mult}`, CFG.job_mult > 1 && `trabalhos x${CFG.job_mult}`, CFG.prize_mult > 1 && `prêmios das provas x${CFG.prize_mult}`].filter(Boolean);
  if (mults.length) items.unshift({ text: `Bônus ativo: ${mults.join(', ')}`, kind: 'evento' });
  bar.hidden = !items.length;
  bar.innerHTML = items.map(a => `<span class="ann ann--${esc(a.kind)}">${esc(a.text)}</span>`).join('');
}

// fechado até a reinauguração: abre sozinho quando o administrador publica um aviso com "reinauguração" (painel > avisos)
const LOCK_AT = '2026-11-22T21:36:00Z';   // só vale aviso publicado depois do fechamento
let reopened = true;   // INAUGURADO em 22/11/2026: o jogo está aberto para todos (para fechar de novo: false)
async function checkReopen(sb) {
  if (reopened) return;
  const { data, error } = await sb.from('announcements').select('id').ilike('text', '%reinaugura%').gte('created_at', LOCK_AT).limit(1);
  if (!error && data?.length) reopened = true;
}
function maintenance() {
  const d = $('#dlg-maint'), shut = !reopened;
  if ((CFG.maintenance || shut) && !isAdmin) {
    $('#mt-title').textContent = shut ? 'fechado para a reinauguração' : 'em manutenção';
    $('#maint-msg').textContent = shut ? 'O 21 World está sendo preparado para a reinauguração: todo mundo vai começar do zero, com R$ 10 mil. A data sai em breve no aviso do jogo. Quem jogou no começo já tem o selo 🌱 pioneiro guardado.' : CFG.maintenance_msg || 'O jogo está em manutenção. Volte em alguns minutos.';
    if (!d.open) d.showModal();
  } else if (d.open) d.close();
}

document.getElementById('dlg-ban')?.addEventListener('cancel', e => e.preventDefault());
document.getElementById('dlg-maint')?.addEventListener('cancel', e => e.preventDefault());   // Esc não fura o fechamento   // Esc não fecha: suspenso/pausado fica travado
async function checkBan(sb) {
  const { data, error } = await sb.from('bans').select('reason, until').eq('user_id', Auth.account().id).maybeSingle();
  const over = !error && (!data || (data.until && new Date(data.until) <= new Date()));
  if (over && $('#dlg-ban').open) location.reload();   // tempo acabou ou o admin soltou: volta a jogar
  if (error || over) return false;
  $('#ban-title').textContent = /^Receita Federal/.test(data.reason || '') ? 'Receita Federal: conta em análise' : 'conta suspensa';
  G.afterSave = null;                                                  // suspenso: nada mais vai para a nuvem
  $('#ban-msg').textContent = `${data.reason ? `Motivo: ${data.reason.replace(/\.$/, '')}. ` : ''}${data.until ? `Até ${new Date(data.until).toLocaleString('pt-BR')}.` : 'Sem data para terminar.'}`;
  const d = $('#dlg-ban'); if (!d.open) d.showModal();
  return true;
}

// aplica as ordens pendentes: primeiro marca como aplicada (para nunca aplicar duas vezes), depois aplica só as que marcou
async function applyGrants(sb) {
  const me = Auth.account().id;
  const { data: pend, error } = await sb.from('admin_grants').select('id').eq('user_id', me).is('applied_at', null).limit(50);
  if (error || !pend?.length) return;
  const mark = cols => sb.from('admin_grants').update({ applied_at: new Date().toISOString() }).in('id', pend.map(r => r.id)).is('applied_at', null).select(cols);
  let { data: rows, error: e2 } = await mark('id, kind, amount, note, item');
  if (e2 && /item/i.test(e2.message || '')) ({ data: rows, error: e2 } = await mark('id, kind, amount, note'));   // coluna item ainda não criada (supabase/terras.sql)
  if (e2 || !rows?.length) return;
  for (const g of rows) {
    const amt = Number(g.amount) || 0, why = g.note ? `: ${g.note}` : '';
    if (g.kind === 'money') { G.S.money += amt; note(`ajuste do administrador${why}`, amt); badge('Administrador', `${amt >= 0 ? 'Você recebeu' : 'Foram retirados'} ${brl(Math.abs(amt))}${why}.`, 'mission'); }
    if (g.kind === 'chips') { G.S.chips = Math.max(0, G.S.chips + amt); note(`fichas do administrador${why}`); badge('Administrador', `${amt >= 0 ? '+' : ''}${int(amt)} fichas${why}.`, 'mission'); }
    if (g.kind === 'xp') { P.addXp(G.S, amt).forEach(levelUp); badge('Administrador', `+${int(amt)} XP${why}.`, 'mission'); }
    if (g.kind === 'message') badge('Mensagem do administrador', g.note || '', 'mission');
    if (g.kind === 'land' && g.item?.id != null && !(G.S.lands || []).some(l => String(l.id) === String(g.item.id))) {
      G.S.lands.push({ ...g.item, own: true }); note(`terra devolvida pelo administrador: ${g.item.ha} ha, ${g.item.region}`);
      badge('Administrador', `Sua terra de ${int(g.item.ha)} ha em ${g.item.region} foi devolvida${why}.`, 'mission');
    }
    if (g.kind === 'setmoney') { G.S.money = amt; note(`carteira zerada pelo administrador${why}`, amt); badge('Administrador', `Sua carteira agora tem ${brl(amt)}${why}.`, 'mission'); }
    if (g.kind === 'pioneer') { G.S.pioneer = true; badge('Pioneiro do 21 World', 'Você jogou no começo do game: seu perfil ganhou o selo de pioneiro.', 'mission'); }
    if (g.kind === 'reset') {
      const name = G.S.avatar?.name;
      const pioneer = G.S.pioneer; G.S = blankState(name && name !== 'você' ? name : ''); if (pioneer) G.S.pioneer = true;   // o selo de pioneiro fica
      say('O administrador reiniciou o seu progresso.', true);
    }
  }
  save(); G.render();
}

// tempo jogado de verdade (painel admin, aba vigilância): soma 30 s só com a aba visível e alguém mexendo nos últimos 3 min.
// s.play = { ms: total, days: { 'AAAA-MM-DD' (Brasília): ms } }, guarda os últimos 30 dias
let lastAct = Date.now();
for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true });
setInterval(() => {
  const s = G.S; if (!s || document.visibilityState !== 'visible' || Date.now() - lastAct > 180000) return;
  const p = (s.play ||= { ms: 0, days: {} }), d = new Date(now() - 3 * 36e5).toISOString().slice(0, 10);
  p.ms += 30000; p.days[d] = (p.days[d] || 0) + 30000;
  const ks = Object.keys(p.days).sort(); while (ks.length > 30) delete p.days[ks.shift()];
}, 30000);
