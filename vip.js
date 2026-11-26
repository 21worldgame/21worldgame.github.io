// VIP da cidade (vip.sql + vip-v2.sql): Apoiador, Patrono, Magnata e Conselho da Cidade. Tudo é assinatura que vence
// (mensal, trimestral ou anual pré-pago) e precisa renovar: nada é para sempre. Só aparência e reconhecimento:
// não dá dinheiro, taxa nem vantagem no jogo. Pix manual: o jogador avisa, o admin confere e libera no painel.
// Os dados vêm do servidor ao abrir e no máximo a cada 10 min (tabela pequena); o selo aparece no ranking, no salão e no chat.
import * as Auth from './auth.js';
import { G, brl, esc, int, say, save, badge, profileOf, every } from './store.js';

export const TIERS = {
  apoiador: { name: 'Apoiador', price: 9.9, ico: '🌱', rank: 1, pitch: 'Seu nome acende na cidade' },
  patrono: { name: 'Patrono', price: 24.9, ico: '⚜️', rank: 2, pitch: 'Nick colorido, título e voto' },
  magnata: { name: 'Magnata', price: 49.9, ico: '💎', rank: 3, pitch: 'Nick com brilho e moldura de luxo' },
  conselho: { name: 'Conselho da Cidade', price: 89.9, ico: '🏛️', rank: 4, pitch: 'Uma das 21 cadeiras do mês e sua rua no mapa' },
  // Linha Black: categoria à parte para quem quer dar mais
  barao: { name: 'Barão', price: 199, ico: '🖤', rank: 5, black: true, pitch: 'A Linha Black: preto e ouro em tudo' },
  imperador: { name: 'Imperador', price: 499, ico: '👑', rank: 6, black: true, pitch: 'Só 3 tronos por mês na cidade inteira' },
  mecenas: { name: 'Mecenas', price: 600, ico: '🏆', rank: 7, black: true, free: true, pitch: 'Você escolhe o valor. O topo do Hall é seu' },
};
export const CAP = { conselho: 21, imperador: 3 };   // lugares por mês (cadeiras / tronos)
export const MEC_MIN = 600;
export const PERIODS = { 1: { label: 'mensal', off: 0 }, 3: { label: 'trimestral', off: 0.1 }, 12: { label: 'anual', off: 1 / 6 } };   // anual: 12 pelo preço de 10
export const priceOf = (tier, m, amt) => (TIERS[tier].free ? Math.max(MEC_MIN, Number(amt) || MEC_MIN) : Math.round(TIERS[tier].price * m * (1 - PERIODS[m].off) * 100) / 100);
// selo da sequência (meses SEGUIDOS de apoio): renovou até 7 dias depois de vencer, continua; passou disso, zera
export const LEVELS = [[24, '👑', 'Lenda'], [12, '💎', 'Diamante'], [6, '🥇', 'Ouro'], [3, '🥈', 'Prata'], [1, '🥉', 'Bronze']];
export const levelOf = m => LEVELS.find(l => m >= l[0]) || null;
export const nextLevel = m => [...LEVELS].reverse().find(l => m < l[0]) || null;
export const GRACE = 7 * 864e5;
// selo do mês: cada mês tem o seu e só existe naquele mês
export const STAMPS = [['🎆', 'Ano Novo'], ['🎭', 'Carnaval'], ['🌧️', 'Águas de Março'], ['🐣', 'Páscoa'], ['🌽', 'Colheita do Milho'], ['🔥', 'São João'],
  ['❄️', 'Geada'], ['🐂', 'Rodeio'], ['🌸', 'Primavera'], ['🎡', 'Feira da Cidade'], ['🌾', 'Plantio da Soja'], ['🎄', 'Natal']];
export const COLORS = { ouro: 'Ouro', esmeralda: 'Esmeralda', rubi: 'Rubi', safira: 'Safira', ametista: 'Ametista', prata: 'Prata' };
export const GLOW = { aurora: 'Aurora (brilho)', fogo: 'Fogo (brilho)', neon: 'Neon (brilho)', arcoiris: 'Arco-íris (brilho)' };   // Magnata para cima
export const BLACKC = { ouroliquido: 'Ouro líquido (Black)', diamante: 'Diamante (Black)', imperial: 'Imperial (Black)' };   // Linha Black
export const SEATS = 21;
const PERKS = {
  apoiador: ['🔒 Perfil privado: esconda seu patrimônio e suas terras', '✏️ Pode trocar o nick (só VIP)', 'Selo ao lado do nick no ranking, no salão e no chat', 'Selo exclusivo do mês para o álbum', 'Sequência: Bronze, Prata, Ouro, Diamante e Lenda', 'Nome no Mural da Usina'],
  patrono: ['Tudo do Apoiador', 'Nick colorido (6 cores)', 'Título embaixo do nick: "Barão do Café"', 'Vota na carga do mês'],
  magnata: ['Tudo do Patrono', 'Nick com brilho animado: Aurora, Fogo, Neon, Arco-íris', 'Moldura de luxo no ranking e no salão', 'Destaque no topo do Mural'],
  conselho: [`Uma das ${SEATS} cadeiras do mês (numerada)`, 'Uma rua da cidade com o nome que você escolher', 'Tudo do Magnata', 'Não renovou? A cadeira vai para o próximo da fila'],
  barao: ['Tudo do Conselho, sem disputar cadeira', 'Faixa BLACK preta e ouro no seu nível', 'Cores exclusivas: Ouro líquido, Diamante, Imperial', 'Nome no Hall da Linha Black'],
  imperador: ['Só 3 tronos por mês: trono numerado', 'Faixa IMPERADOR e coroa dourada animada', 'Tudo do Barão', 'Primeiro nome do Hall, logo abaixo dos Mecenas'],
  mecenas: [`Valor livre a partir de ${brl(MEC_MIN)} por mês`, 'Faixa MECENAS: a marca mais rara da cidade', 'Tudo do Imperador, sem disputar trono', 'Topo do Hall dos Mecenas, em ordem de apoio'],
};

let rows = [], meta = { pix: '', goal: 140, poll: null }, raised = 0, myReq = null, at = 0, loading = null, period = 1, pick = 'patrono', mecAmt = 1000;
const byId = new Map(), byName = new Map();
const live = v => !!v && v.tier && Date.parse(v.until) > Date.now();
const rankOf = v => (live(v) ? TIERS[v.tier]?.rank || 0 : 0);

export async function load(force = false) {
  if (loading) return loading;
  if (!force && Date.now() - at < 600000) return;
  loading = (async () => {
    const sb = Auth.sbClient() || await Auth.sbReady(); if (!sb) return;
    const me = Auth.account()?.id;
    const [v, m, r, q] = await Promise.all([sb.from('vip').select('user_id, name, tier, until, months, streak, stamps, founder, street, title, color, vote_key, vote'),
      sb.from('vip_meta').select('pix, goal, poll').eq('id', 1).maybeSingle(), sb.rpc('vip_raised'),
      me ? sb.from('vip_req').select('id, plan, months, amount, at').eq('user_id', me).eq('done', false).maybeSingle() : Promise.resolve({ data: null })]);
    if (v.error) return;
    rows = v.data || []; meta = m.data || meta; raised = Number(r.data) || 0; myReq = q.data || null; at = Date.now();
    byId.clear(); byName.clear();
    for (const x of rows) { byId.set(x.user_id, x); if (x.name) byName.set(x.name.toLowerCase(), x); }
    remind(); syncMine(); hud();
  })().finally(() => { loading = null; });
  return loading;
}
const find = key => byId.get(String(key || '').replace(/^u:/, '')) || byName.get(String(key || '').toLowerCase());

// selo ao lado do nick (ranking, salão, chat). key = id da conta, 'u:id' ou o nick.
export function tag(key) {
  const v = find(key); if (!live(v)) return '';
  const L = levelOf(v.streak || 0), T = TIERS[v.tier];
  return `${v.tier === 'conselho' && v.founder ? `<i class="vtag vtag--conselho" title="Conselho da Cidade · cadeira nº ${v.founder}">🏛️</i>` : ''}<i class="vtag vtag--${v.tier}" title="${T.name} da cidade${L ? ` · ${v.streak} ${v.streak === 1 ? 'mês' : 'meses'} seguidos · selo ${L[2]}` : ''}">${L ? L[1] : T.ico}</i>`;
}
export const cls = key => { const v = find(key), r = rankOf(v); if (r < 2 || !v.color) return r >= 5 ? ' vnick vnick--ouroliquido vnick--lux' : r >= 3 ? ' vnick vnick--lux' : '';
  const c = (BLACKC[v.color] && r < 5) || (GLOW[v.color] && r < 3) ? 'ouro' : v.color;
  return ` vnick vnick--${c}${r >= 3 ? ' vnick--lux' : ''}`; };
export const title = key => { const v = find(key); return rankOf(v) >= 2 && v.title ? v.title : ''; };

// o próprio VIP: ativo? (perfil privado é do VIP) · vencimento gravado no save para o perfil voltar a público sozinho quando vencer
const mineRow = () => byId.get(Auth.account()?.id);
export const isOn = () => live(mineRow());
function syncMine() { const v = mineRow(), u = v?.until || null; if (G.S && (G.S.vipUntil || null) !== u) { G.S.vipUntil = u; save(); } }
const SHORT = { apoiador: 'VIP', patrono: 'VIP', magnata: 'VIP', conselho: 'VIP', barao: 'BLACK', imperador: 'IMPERADOR', mecenas: 'MECENAS' };
// HUD: coroa em cima do avatar e faixa "VIP" embaixo do nível, na cor do plano
export function hud() {
  const ring = document.getElementById('hud-ring'); if (!ring) return;
  const v = mineRow(), on = live(v), c = document.getElementById('hud-crown'), f = document.getElementById('hud-vip');
  ring.dataset.vip = on ? v.tier : '';
  if (c) { c.hidden = !on; c.textContent = on && TIERS[v.tier].rank >= 3 ? '👑' : '♛'; }
  if (f) { f.hidden = !on; f.textContent = on ? SHORT[v.tier] : ''; f.title = on ? `${TIERS[v.tier].name} da cidade · vence ${dt(v.until)}` : ''; }
}
// selo no perfil (ao lado do nível)
export function chip(key) {
  const v = find(key); if (!live(v)) return '';
  const T = TIERS[v.tier], L = levelOf(v.streak || 0);
  return ` <span class="vchip vchip--${v.tier}${T.black ? ' vchip--black' : ''}" title="${T.name} da cidade${L ? ` · ${v.streak} ${v.streak === 1 ? 'mês' : 'meses'} seguidos` : ''}"><i>${T.rank >= 3 ? '👑' : '♛'}</i>${T.black ? 'BLACK' : 'VIP'} · ${esc(T.name)}${L ? ` ${L[1]}` : ''}</span>`;
}

// aviso de renovação (1 vez por dia): faltando 5 dias, e no prazo de 7 dias depois de vencer (a sequência ainda dá para salvar)
function remind() {
  const me = Auth.account()?.id, v = me && byId.get(me); if (!v?.tier || !v.until) return;
  const left = Date.parse(v.until) - Date.now(), k = `21world.vipRemind.${me}`, day = new Date().toDateString();
  try { if (localStorage.getItem(k) === day) return; } catch {}
  const T = TIERS[v.tier]?.name || 'VIP', d = n => `${Math.max(1, Math.ceil(n / 864e5))} ${Math.ceil(n / 864e5) <= 1 ? 'dia' : 'dias'}`;
  let msg = '';
  if (left > 0 && left < 5 * 864e5) msg = `Seu ${T} vence em ${d(left)}. Renove na aba VIP e mantenha a sequência de ${v.streak} ${v.streak === 1 ? 'mês' : 'meses'}${v.tier === 'conselho' ? ' e a sua cadeira' : ''}.`;
  else if (left <= 0 && -left < GRACE) msg = `Seu ${T} venceu. A sequência de ${v.streak} ${v.streak === 1 ? 'mês' : 'meses'} ainda dá para salvar por ${d(GRACE + left)}: renove na aba VIP.`;
  if (!msg) return;
  badge('⚜️ VIP da cidade', msg, 'mission');
  try { localStorage.setItem(k, day); } catch {}
}

// ---------- aba VIP ----------
const box = () => document.getElementById('p-vip');
const brt = d => new Date(new Date(d).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const ym = d => { const x = brt(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const dt = s => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const span = ms => { const m = Math.max(0, Math.floor(ms / 6e4)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h` : `${h}h ${m % 60}min`; };
function monthEnd() { const x = brt(Date.now()); const next = Date.UTC(x.getFullYear(), x.getMonth() + 1, 1, 3); return next - Date.now(); }   // virada do mês em Brasília

export async function render() {
  const el = box(); if (!el || el.hidden) return;
  if (!at) el.innerHTML = '<div class="vip-loading"><span>⚜️</span><p>Abrindo o salão nobre da cidade…</p></div>';
  await load(); draw();
}
const myName = () => String(profileOf()?.name || 'Você');
function nickAs(tier, color) {   // prévia: como o seu nick aparece em cada plano
  const r = TIERS[tier].rank, c = r >= 5 ? (color || { barao: 'ouroliquido', imperador: 'imperial', mecenas: 'diamante' }[tier]) : r >= 3 ? (color && !BLACKC[color] ? color : 'aurora') : r >= 2 ? (color && !GLOW[color] && !BLACKC[color] ? color : 'ouro') : '';
  return `<span class="vip-nick${c ? ` vnick vnick--${c}` : ''}${r >= 3 ? ' vnick--lux' : ''}">${esc(myName())}</span><i class="vtag vtag--${tier}">${TIERS[tier].ico}</i>`;
}
function draw() {
  const el = box(); if (!el) return;
  const me = Auth.account()?.id, mine = byId.get(me), on = live(mine), goal = Math.max(1, Number(meta.goal) || 140), pct = Math.min(1, raised / goal);
  const act = rows.filter(live).sort((a, b) => rankOf(b) - rankOf(a) || (b.streak || 0) - (a.streak || 0));
  const seats = Array.from({ length: SEATS }, (_, i) => act.find(v => v.tier === 'conselho' && v.founder === i + 1) || null), thrones = Array.from({ length: CAP.imperador }, (_, i) => act.find(v => v.tier === 'imperador' && v.founder === i + 1) || null), tFree = thrones.filter(t => !t).length, free = seats.filter(s => !s).length;
  const nowYm = ym(Date.now()), year = brt(Date.now()).getFullYear(), mi = brt(Date.now()).getMonth(), stampNow = STAMPS[mi];
  const L = mine && levelOf(mine.streak || 0), N = nextLevel(mine?.streak || 0), left = mine?.until ? Date.parse(mine.until) - Date.now() : 0;
  const poll = meta.poll && Array.isArray(meta.poll.opts) ? meta.poll : null;
  const votes = poll ? poll.opts.map((_, i) => act.filter(v => rankOf(v) >= 2 && v.vote_key === poll.key && v.vote === i).length) : [];
  const vTot = votes.reduce((a, b) => a + b, 0) || 1, canVote = rankOf(mine) >= 2;
  const renewTier = mine?.tier || pick;
  el.innerHTML = `
  <header class="vip-hero">
    <div class="vip-hero__glow" aria-hidden="true"></div>
    <p class="vip-kick">⚜️ Salão Nobre · VIP da cidade</p>
    <h2 class="vip-title">Brilhe em <span>21 World</span></h2>
    <p class="vip-lead">Nick que brilha, selo que cresce a cada mês seguido, cadeira no Conselho e uma rua com o seu nome. Quem apoia mantém a <b>Usina 21</b> ligada e a cidade inteira vê.</p>
    <div class="vip-chips">
      <span class="vip-chip">🔥 <b>${act.length}</b> ${act.length === 1 ? 'apoiando' : 'apoiando'} este mês</span>
      <span class="vip-chip${free <= 5 ? ' vip-chip--hot' : ''}">🏛️ <b>${SEATS - free}/${SEATS}</b> cadeiras do Conselho</span>
      <span class="vip-chip vip-chip--time">${stampNow[0]} selo <b>${esc(stampNow[1])}</b> some em <b data-vip-clock="month">${span(monthEnd())}</b></span>
    </div>
    <div class="vip-usina" role="img" aria-label="usina do mês: ${Math.round(pct * 100)}% da meta"><i style="transform:scaleX(${pct.toFixed(3)})"></i><span>${pct >= 1 ? '💡 Usina do mês paga! Obrigado, cidade' : `⚡ ${Math.round(pct * 100)}% da Usina do mês paga`}</span></div>
    <p class="vip-fine">Só VIP pode <b>deixar o perfil privado</b> e <b>trocar o nick</b>. Fora isso, VIP é aparência e reconhecimento: <b>não dá dinheiro, juros, terra nem vantagem nas mesas</b>. O jogo continua justo para todos.</p>
  </header>

  ${mine?.tier ? `<section class="vip-me vip-me--${on ? mine.tier : 'off'}">
    <div class="vip-me__badge"><span>${L ? L[1] : TIERS[mine.tier]?.ico || '⚜️'}</span></div>
    <div class="vip-me__info">
      <h3>${on ? `Você é <b>${TIERS[mine.tier].name}</b>` : left > -GRACE ? '⏳ Seu VIP venceu: a sequência ainda dá para salvar' : '💤 Seu VIP está desligado'}</h3>
      <p class="vip-me__nick">${tag(me) || ''}<span class="${cls(me)}">${esc(mine.name)}</span>${title(me) ? ` <small class="vtitle">${esc(title(me))}</small>` : ''}</p>
      <div class="vip-streak"><span class="vip-streak__fire">🔥 ${int(mine.streak || 0)}</span><span>${(mine.streak || 0) === 1 ? 'mês seguido' : 'meses seguidos'}${L ? ` · selo <b>${L[2]}</b>` : ''}</span></div>
      ${N ? `<div class="vip-next"><i style="transform:scaleX(${Math.min(1, (mine.streak || 0) / N[0]).toFixed(3)})"></i><span>faltam <b>${N[0] - (mine.streak || 0)}</b> para ${N[1]} ${N[2]}</span></div>` : '<p class="small">👑 Você chegou ao topo: Lenda da cidade.</p>'}
      ${on ? `<p class="vip-due${left < 5 * 864e5 ? ' is-hot' : ''}">vence em <b data-vip-clock="due">${span(left)}</b> (${dt(mine.until)}) · ${mine.tier === 'conselho' && mine.founder ? `cadeira nº <b>${mine.founder}</b>${mine.street ? ` · 🛣️ ${esc(mine.street)}` : ''} · ` : ''}renove antes e não perde a sequência</p>`
        : left > -GRACE ? `<p class="vip-due is-hot">a sequência de <b>${int(mine.streak || 0)}</b> meses zera em <b data-vip-clock="grace">${span(GRACE + left)}</b>. Renove para salvar.</p>` : '<p class="vip-due">A sequência zerou. Recomece hoje e o selo volta a crescer.</p>'}
      <button class="btn btn--gold vip-cta" type="button" data-vip="pick" data-plan="${esc(renewTier)}">${on ? '🔁 renovar agora' : '⚡ reativar'} · ${TIERS[renewTier].name}</button>
    </div>
  </section>` : ''}

  <section class="vip-plans-wrap">
    <div class="vip-plans-head"><h3>Escolha seu brilho</h3>
      <div class="vip-period" role="radiogroup" aria-label="período">${Object.entries(PERIODS).map(([m, P]) => `<button type="button" role="radio" aria-checked="${period === Number(m)}" class="${period === Number(m) ? 'is-on' : ''}" data-vip="period" data-m="${m}">${P.label}${P.off ? ` <small>${m === '12' ? '2 meses grátis' : `−${Math.round(P.off * 100)}%`}</small>` : ''}</button>`).join('')}</div></div>
    <div class="vip-plans">${Object.entries(TIERS).filter(([, T]) => !T.black).map(([k, T]) => { const tot = priceOf(k, period), cur = on && mine.tier === k;
      return `<article class="vip-plan vip-plan--${k}${pick === k ? ' is-pick' : ''}">
      ${k === 'patrono' ? '<span class="vip-plan__tag">mais escolhido</span>' : k === 'magnata' ? '<span class="vip-plan__tag vip-plan__tag--lux">✨ mais brilho</span>' : k === 'conselho' ? `<span class="vip-plan__tag vip-plan__tag--hot">${free ? `restam ${free} de ${SEATS} este mês` : 'cadeiras ocupadas'}</span>` : ''}
      <div class="vip-plan__ico">${T.ico}</div><h4>${T.name}</h4><p class="vip-plan__pitch">${esc(T.pitch)}</p>
      <p class="vip-plan__price"><b>${brl(Math.round(tot / period * 100) / 100)}</b><small>/mês</small></p>
      <p class="vip-plan__tot">${period > 1 ? `${brl(tot)} por ${period} meses` : 'renova todo mês'}</p>
      <div class="vip-plan__prev">${nickAs(k, k === mine?.tier ? mine.color : null)}</div>
      <ul>${PERKS[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="btn ${k === 'patrono' || k === 'magnata' ? 'btn--gold' : 'btn--glass'} vip-plan__btn" type="button" data-vip="pick" data-plan="${k}"${k === 'conselho' && !free && !(on && mine.tier === 'conselho') ? ' disabled' : ''}>${cur ? 'renovar' : `quero ser ${T.name.split(' ')[0]}`}</button></article>`; }).join('')}</div>
    <p class="vip-fine">Assinatura: vale pelo período pago e vence. Avisamos 5 dias antes no jogo. Renovou até 7 dias depois de vencer, a sequência continua.</p>
  </section>

  <section class="vip-black">
    <div class="vip-black__shine" aria-hidden="true"></div>
    <p class="vip-kick">🖤 Linha Black · para quem quer ir além</p>
    <h3 class="vip-black__title">Linha <span>Black</span></h3>
    <p class="vip-lead">Preto e ouro. Pouquíssimos na cidade. Para quem quer apoiar de verdade e ser lembrado: tronos limitados, faixa própria no nível e o topo do Hall.</p>
    <div class="vip-plans vip-plans--black">${Object.entries(TIERS).filter(([, T]) => T.black).map(([k, T]) => { const cur = on && mine.tier === k, lim = k === 'imperador' && !tFree && !cur;
      return `<article class="vip-plan vip-plan--black vip-plan--${k}${pick === k ? ' is-pick' : ''}">
      ${k === 'imperador' ? `<span class="vip-plan__tag vip-plan__tag--hot">${tFree ? `${tFree} de ${CAP.imperador} tronos livres` : 'tronos ocupados'}</span>` : k === 'mecenas' ? '<span class="vip-plan__tag">o mais alto</span>' : '<span class="vip-plan__tag">entrada da Black</span>'}
      <div class="vip-plan__ico">${T.ico}</div><h4>${T.name}</h4><p class="vip-plan__pitch">${esc(T.pitch)}</p>
      ${T.free ? `<p class="vip-plan__price"><b>${brl(mecAmt)}</b><small>/mês</small></p>
        <div class="vip-amt">${[600, 1000, 2500, 5000].map(v => `<button type="button" class="${mecAmt === v ? 'is-on' : ''}" data-vip="amt" data-v="${v}">${brl(v)}</button>`).join('')}</div>
        <label class="field vip-amt__in"><span>ou digite (mín. ${brl(MEC_MIN)})</span><input class="input" id="vip-amt" type="number" min="${MEC_MIN}" step="50" value="${mecAmt}" inputmode="numeric"></label>`
      : `<p class="vip-plan__price"><b>${brl(Math.round(priceOf(k, period) / period * 100) / 100)}</b><small>/mês</small></p><p class="vip-plan__tot">${period > 1 ? `${brl(priceOf(k, period))} por ${period} meses` : 'renova todo mês'}</p>`}
      <div class="vip-plan__prev">${nickAs(k, k === mine?.tier ? mine.color : null)}</div>
      <ul>${PERKS[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="btn btn--gold vip-plan__btn" type="button" data-vip="pick" data-plan="${k}"${lim ? ' disabled' : ''}>${cur ? 'renovar' : `quero ser ${T.name}`}</button></article>`; }).join('')}</div>
    <div class="vip-thrones">${thrones.map((v, i) => `<div class="${v ? 'is-on' : ''}"><span>👑 trono ${i + 1}</span>${v ? `<b class="${cls(v.user_id)}">${esc(v.name)}</b>` : '<small>livre este mês</small>'}</div>`).join('')}</div>
  </section>

  <section class="vip-grid">
    <div class="vip-card">
      <h3>🏅 Sequência de meses</h3>
      <ol class="vip-ladder">${[...LEVELS].reverse().map(([n, e, nm]) => `<li class="${(mine?.streak || 0) >= n ? 'is-got' : ''}"><span>${e}</span><b>${nm}</b><small>${n} ${n === 1 ? 'mês' : 'meses'} seguidos</small></li>`).join('')}</ol>
      <p class="small muted">O selo ao lado do nick mostra a sequência. Parou mais de 7 dias, zera.</p>
    </div>
    <div class="vip-card">
      <h3>📒 Álbum de ${year}</h3>
      <ol class="vip-album">${STAMPS.map(([e, n], i) => { const k = `${year}-${String(i + 1).padStart(2, '0')}`, got = (mine?.stamps || []).includes(k);
        return `<li class="${got ? 'is-got' : ''}${k === nowYm ? ' is-now' : ''}${!got && k < nowYm ? ' is-lost' : ''}" title="${esc(n)}${got ? ': seu!' : k < nowYm ? ': esse mês já passou' : k === nowYm ? ': só este mês!' : ''}"><span>${got ? e : k < nowYm ? '✖' : k === nowYm ? e : '?'}</span><small>${esc(n)}</small></li>`; }).join('')}</ol>
      <p class="small">${(mine?.stamps || []).includes(nowYm) ? `✅ O selo ${stampNow[0]} ${esc(stampNow[1])} já é seu.` : `${stampNow[0]} <b>${esc(stampNow[1])}</b> só existe neste mês: acaba em <b data-vip-clock="month">${span(monthEnd())}</b>.`}</p>
    </div>
  </section>

  ${poll ? `<section class="vip-card vip-poll"><h3>🗳️ Carga do mês: quem decide são os VIPs</h3><p>${esc(poll.q || 'Qual novidade chega primeiro?')}</p>
    <ul>${poll.opts.map((o, i) => `<li><button class="vip-opt${mine?.vote_key === poll.key && mine?.vote === i ? ' is-mine' : ''}" type="button" data-vip="vote" data-i="${i}"${canVote ? '' : ' disabled'}>
      <span>${esc(o)}</span><b>${votes[i]}</b><i style="transform:scaleX(${(votes[i] / vTot).toFixed(3)})"></i></button></li>`).join('')}</ul>
    <p class="small muted">${canVote ? 'Toque para votar (pode trocar até fechar).' : 'Patrono para cima vota. Todo mundo vê o placar.'}</p></section>` : ''}

  ${on && rankOf(mine) >= 2 ? `<section class="vip-card vip-style"><h3>🎨 Seu estilo</h3><div class="row">
      <label class="field"><span>título (até 24 letras)</span><input class="input" id="vip-title" maxlength="24" value="${esc(mine.title || '')}" placeholder="Barão do Café"></label>
      <label class="field"><span>cor do nick</span><select class="input" id="vip-color"><option value="">normal</option>${Object.entries(COLORS).map(([k, n]) => `<option value="${k}"${mine.color === k ? ' selected' : ''}>${n}</option>`).join('')}
        ${Object.entries(GLOW).map(([k, n]) => `<option value="${k}"${mine.color === k ? ' selected' : ''}${rankOf(mine) < 3 ? ' disabled' : ''}>${n}${rankOf(mine) < 3 ? ' · Magnata' : ''}</option>`).join('')}
        ${Object.entries(BLACKC).map(([k, n]) => `<option value="${k}"${mine.color === k ? ' selected' : ''}${rankOf(mine) < 5 ? ' disabled' : ''}>${n}${rankOf(mine) < 5 ? ' · Linha Black' : ''}</option>`).join('')}</select></label>
      ${rankOf(mine) >= 4 ? `<label class="field"><span>nome da sua rua</span><input class="input" id="vip-street" maxlength="40" value="${esc(mine.street || '')}" placeholder="Avenida dos Pioneiros"></label>` : ''}
      <button class="btn btn--gold btn--sm" type="button" data-vip="style">salvar</button></div></section>` : ''}

  <section class="vip-card vip-pay" id="vip-pay">
    <h3>💸 Ativar pelo Pix</h3>
    ${myReq ? `<p class="vip-wait">⏳ Pedido de <b>${esc(TIERS[myReq.plan]?.name || myReq.plan)}</b> (${TIERS[myReq.plan]?.free ? 'valor livre' : PERIODS[myReq.months || 1]?.label || 'mensal'}, ${brl(priceOf(myReq.plan, myReq.months || 1, myReq.amount))}) enviado em ${dt(myReq.at)}. Assim que o Pix for conferido, o seu brilho acende. <button class="btn btn--glass btn--xs" type="button" data-vip="cancel">cancelar pedido</button></p>`
      : me ? `<div class="vip-pay__sum"><span>${TIERS[pick].ico} <b>${TIERS[pick].name}</b> · ${TIERS[pick].free ? 'mensal, valor livre' : PERIODS[period].label}</span><b class="vip-pay__tot">${brl(priceOf(pick, period, mecAmt))}</b></div>
      <ol class="vip-steps"><li>Mande <b>${brl(priceOf(pick, period, mecAmt))}</b> no Pix ${meta.pix ? `para a chave <b class="vip-key">${esc(meta.pix)}</b> <button class="btn btn--glass btn--xs" type="button" data-vip="copy">copiar chave</button>` : '(a chave aparece aqui em breve)'}.</li>
        <li>Na mensagem do Pix, escreva o seu nick: <b>${esc(myName())}</b>.</li><li>Toque em <b>já mandei o Pix</b>. O prefeito confere e o brilho acende em até 24 h.</li></ol>
      <div class="row">${TIERS[pick].rank >= 4 ? '<label class="field"><span>nome da sua rua</span><input class="input" id="vip-note" maxlength="40" placeholder="Avenida dos Pioneiros"></label>' : '<label class="field"><span>recado (opcional)</span><input class="input" id="vip-note" maxlength="140" placeholder="ex.: comprovante às 14h20"></label>'}
        <button class="btn btn--gold vip-cta" type="button" data-vip="req"${meta.pix ? '' : ' disabled'}>já mandei o Pix</button></div>` : '<p class="small">Entre na sua conta para ativar o VIP.</p>'}
    <p class="small muted">Apoio é voluntário, vale pelo período pago e não volta como dinheiro no jogo. Menores de idade: peça para um responsável.</p>
  </section>

  <section class="vip-card vip-wall"><h3>🏛️ Conselho da Cidade <small class="muted">${SEATS - free}/${SEATS} cadeiras · renova todo mês</small></h3>
    <ol class="vip-seats">${seats.map((v, i) => `<li class="${v ? 'is-on' : ''}"><span>${i + 1}</span>${v ? `<b class="${cls(v.user_id)}">${esc(v.name)}</b>${v.street ? `<small>🛣️ ${esc(v.street)}</small>` : ''}` : '<small>livre</small>'}</li>`).join('')}</ol>
    ${act.some(v => TIERS[v.tier]?.black) ? `<h3>🖤 Hall da Linha Black</h3><ol class="vip-hall">${act.filter(v => TIERS[v.tier]?.black).map(v => `<li class="vip-hall__${v.tier}"><span>${TIERS[v.tier].ico}</span><b class="${cls(v.user_id)}">${esc(v.name)}</b><small>${TIERS[v.tier].name}${v.tier === 'imperador' && v.founder ? ` · trono ${v.founder}` : ''}</small></li>`).join('')}</ol>` : ''}
    <h3>✨ Quem mantém a luz acesa</h3>
    ${act.length ? `<ul class="vip-names">${act.map(v => `<li class="vip-names__${v.tier}">${tag(v.user_id)} <b class="${cls(v.user_id)}">${esc(v.name)}</b>${title(v.user_id) ? ` <small class="vtitle">${esc(title(v.user_id))}</small>` : ''}</li>`).join('')}</ul>` : '<p class="small muted">Ainda ninguém este mês. O primeiro nome do mural pode ser o seu.</p>'}
  </section>`;
}
// relógios da tela (sem rede)
setInterval(() => {
  const el = box(); if (!el || el.hidden) return;
  const me = Auth.account()?.id, v = byId.get(me), left = v?.until ? Date.parse(v.until) - Date.now() : 0;
  for (const c of el.querySelectorAll('[data-vip-clock]')) c.textContent = span(c.dataset.vipClock === 'month' ? monthEnd() : c.dataset.vipClock === 'due' ? left : GRACE + left);
}, 30000);

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-vip]'); if (!b || !box()?.contains(b)) return;
  const sb = Auth.sbClient(), act = b.dataset.vip;
  if (act === 'pick') { pick = b.dataset.plan; draw(); document.getElementById('vip-pay')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (act === 'period') { period = Number(b.dataset.m) || 1; draw(); return; }
  if (act === 'amt') { mecAmt = Number(b.dataset.v) || MEC_MIN; pick = 'mecenas'; draw(); return; }
  if (act === 'copy') { try { await navigator.clipboard.writeText(meta.pix); say('Chave Pix copiada.'); } catch { say('Não deu para copiar: selecione a chave e copie.', true); } return; }
  if (!sb) return say('Entre na sua conta primeiro.', true);
  b.disabled = true;
  try {
    if (act === 'req') {
      const note = (document.getElementById('vip-note')?.value || '').trim().slice(0, 140);
      if (TIERS[pick].free && mecAmt < MEC_MIN) return say(`O Mecenas começa em ${brl(MEC_MIN)}.`, true);
      const { error } = await sb.from('vip_req').insert({ plan: pick, months: TIERS[pick].free ? 1 : period, amount: TIERS[pick].free ? mecAmt : null, note: note || null, name: myName().slice(0, 40) });
      if (error) return say(/duplicate|unique/i.test(error.message) ? 'Você já tem um pedido esperando conferência.' : 'Não deu para enviar o pedido. Tente de novo.', true);
      say(`Pedido enviado: ${TIERS[pick].name} ${TIERS[pick].free ? '' : PERIODS[period].label} (${brl(priceOf(pick, period, mecAmt))}). Assim que o Pix for conferido, o brilho acende.`);
    } else if (act === 'cancel') {
      await sb.from('vip_req').delete().eq('id', myReq.id);
    } else if (act === 'style') {
      const { data } = await sb.rpc('vip_style', { p_title: document.getElementById('vip-title').value, p_color: document.getElementById('vip-color').value });
      const st = document.getElementById('vip-street'); let ok = data === 'ok';
      if (ok && st) { const r = await sb.rpc('vip_street', { p_street: st.value }); ok = r.data === 'ok'; if (!ok) say(String(r.data || 'não deu para salvar a rua'), true); }
      if (data !== 'ok') say(String(data || 'não deu para salvar'), true); else if (ok) say('Estilo salvo: já aparece no ranking, no salão e no chat.');
    } else if (act === 'vote') {
      const { data } = await sb.rpc('vip_vote', { p_opt: Number(b.dataset.i) });
      say(data === 'ok' ? 'Voto registrado!' : String(data || 'não deu para votar'), data !== 'ok');
    }
    await load(true); draw();
  } finally { b.disabled = false; }
});
// selos no ranking e no salão: lê ao abrir o jogo e a cada 10 min (com a aba escondida não lê)
if (typeof document !== 'undefined') { setTimeout(() => load(), 6000); every(600000, () => load()); }
document.addEventListener('change', e => { if (e.target.id === 'vip-amt') { mecAmt = Math.max(MEC_MIN, Math.floor(Number(e.target.value) || MEC_MIN)); pick = 'mecenas'; draw(); } });
