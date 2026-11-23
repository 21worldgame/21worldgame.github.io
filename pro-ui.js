// Central de Profissionais (aba "profissionais", em negócios): perfis, serviços, contratos, entregas, avaliações e denúncias.
// Regras e dinheiro no servidor (supabase/profissionais.sql). O save só recebe o débito da contratação e os créditos liberados,
// com o mesmo cuidado do Pix: o id vai no save (proOut/proGot) e o servidor só marca como recebido depois que o save subiu.
import * as Auth from './auth.js';
import { G, brl, esc, say, note, save, badge } from './store.js';
import { avatarSVG } from './avatar.js';
import * as PR from './pro.js';

const $ = s => document.querySelector(s);
const sb = () => Auth.sbClient(), me = () => Auth.account()?.id;
const missing = e => /pro_|relation|schema|does not exist|function/i.test(e?.message || '') && /exist|find|schema/i.test(e?.message || '');
let view = 'buscar', off = false, lock = false, pros = [], looks = {}, mine = null, contracts = [], deliv = {}, draft = null, unseen = 0, loaded = 0;
const ago = t => { const m = Math.round((Date.now() - Date.parse(t)) / 6e4); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d`; };
const left = t => { const m = Math.max(0, Math.round((t - Date.now()) / 6e4)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`; };
const tag = (txt, tone, tip = '') => `<span class="pro-tag pro-tag--${tone}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(txt)}</span>`;
const stars = (v, n) => `<span class="pro-stars" aria-label="${Number(v).toFixed(1)} de 5 estrelas">${PR.starsTxt(v)}</span> <b>${Number(v).toFixed(1).replace('.', ',')}</b>${n != null ? ` <small class="muted">(${n})</small>` : ''}`;
const av = (id, name) => `<span class="pro-av">${avatarSVG(looks[id] || { name }, { label: name })}</span>`;

// ---------- dados ----------
async function loadPros() {
  const { data, error } = await sb().from('pro_profiles').select('*').limit(500);
  if (error) { off = missing(error); return; }
  off = false; pros = data || []; mine = pros.find(p => p.user_id === me()) || null; loaded = Date.now();
  const ids = pros.map(p => p.user_id).filter(id => !(id in looks));
  if (ids.length) { const { data: lk } = await sb().from('public_profiles').select('user_id, look').in('user_id', ids.slice(0, 300)); for (const r of lk || []) looks[r.user_id] = r.look; }
  if (mine) trophyCheck(mine);
}
async function loadContracts() {
  if (!me()) return;
  const { data, error } = await sb().from('pro_contracts').select('*').or(`pro_id.eq.${me()},client_id.eq.${me()}`).order('updated_at', { ascending: false }).limit(60);
  if (error) { off = missing(error); return; }
  contracts = data || [];
  const ids = contracts.map(c => c.id);
  if (ids.length) { const { data: d } = await sb().from('pro_deliveries').select('contract_id, at, text').in('contract_id', ids).order('at', { ascending: false }); deliv = {}; for (const x of d || []) (deliv[x.contract_id] ||= []).push(x); }
}
// troféus novos viram conquista na tela
function trophyCheck(p) {
  const got = new Set(G.S.proTrophies ||= []), fresh = PR.trophies(p).filter(t => t.got && !got.has(t.k));
  for (const t of fresh) { G.S.proTrophies.push(t.k); badge(`${t.icon} troféu da Central`, t.label); }
  if (fresh.length) save();
}

// ---------- dinheiro e avisos (de 30 em 30 s) ----------
const seenKey = () => `21world.proSeen.${me()}`;
export async function sync() {
  if (!sb() || !me() || off || lock || document.visibilityState !== 'visible' || G.busy?.()) return;
  lock = true;
  try {
    await sb().rpc('pro_tick');
    const { data, error } = await sb().from('pro_payouts').select('id, amount, memo, kind').eq('to_id', me()).eq('claimed', false).order('id').limit(50);
    if (error) { off = missing(error); return; }
    const got = new Set((G.S.proGot ||= [])); let changed = false;
    for (const r of data.filter(r => !got.has(r.id))) {
      const v = Number(r.amount) || 0; G.S.money += v; G.S.proGot.push(r.id); changed = true;
      note(r.memo || 'Central de Profissionais', v); say(`${r.kind === 'reembolso' ? 'Reembolso' : 'Pagamento'} de ${brl(v)} da Central de Profissionais!`);
    }
    // contratações das últimas 2 h que estão no servidor e não no save (o save com o desconto foi trocado pelo de outro aparelho)
    const out = new Set((G.S.proOut ||= [])), since = new Date(Date.now() - 72e5).toISOString();
    const sent = await sb().from('pro_payments').select('id, amount, memo').eq('payer', me()).gt('at', since).order('id');
    for (const r of sent.error ? [] : sent.data.filter(r => !out.has(r.id))) { const v = Number(r.amount) || 0; G.S.money -= v; G.S.proOut.push(r.id); note(r.memo || 'Central de Profissionais', -v); changed = true; }
    G.S.proOut = G.S.proOut.slice(-300);
    if (changed) { save(); G.render?.(); }
    if (G.S.proGot.length && (await Auth.push().catch(() => false))) {
      const ids = [...G.S.proGot], ack = await sb().rpc('pro_ack', { p_ids: ids });
      if (!ack.error) { G.S.proGot = G.S.proGot.filter(id => !ids.includes(id)); save(); }
    }
    // avisos: o que o outro lado fez desde a última olhada
    await loadContracts();
    let seen = 0; try { seen = Number(localStorage.getItem(seenKey())) || 0; } catch {}
    if (!seen) seen = Date.now();
    for (const c of contracts) {
      const t = Date.parse(c.updated_at); if (t <= seen || c.last_actor === me() || !c.last_event) continue;
      const other = c.pro_id === me() ? c.client_name : c.pro_name;
      say(`Central: contrato #${c.id} (${c.service?.title || 'serviço'}) com ${other}: ${c.last_event}`); unseen++;
    }
    try { localStorage.setItem(seenKey(), String(Math.max(seen, ...contracts.map(c => Date.parse(c.updated_at)), Date.now() - 1000))); } catch {}
    paintBadge();
    const p = panel(); if (p && !p.hidden && view === 'contratos' && !p.contains(document.activeElement?.closest('textarea, input, select'))) paint();
  } finally { lock = false; }
}
const paintBadge = () => { const b = $('#pro-badge'); if (b) { b.hidden = !unseen; b.textContent = unseen; } };

// ---------- tela ----------
const panel = () => document.getElementById('p-pro');
export async function open() {
  const p = panel(); if (!p) return;
  unseen = 0; paintBadge();
  if (!p.dataset.ready) { p.dataset.ready = '1'; p.innerHTML = shell(); }
  paint(true);
  if (sb()) { await Promise.all([Date.now() - loaded > 20000 ? loadPros() : null, loadContracts()]); paint(); }
}
const shell = () => `<div class="pro-hero"><div><span class="pro-hero__k">negócios · entre jogadores</span><h2>Central de Profissionais</h2>
  <p>Ofereça o que você sabe fazer ou contrate quem sabe. O pagamento fica guardado pela Central e só vai para o profissional quando ele entrega: período sem entrega volta para quem contratou.</p></div>
  <nav class="pro-nav" aria-label="Central de Profissionais">${[['buscar', 'encontrar profissionais'], ['contratos', 'meus contratos'], ['perfil', 'meu perfil profissional'], ['ranking', 'ranking']]
    .map(([k, l]) => `<button type="button" class="btn btn--sm" data-pro="view" data-id="${k}">${l}</button>`).join('')}</nav></div><div id="pro-body"></div>`;
function paint(loading = false) {
  const body = $('#pro-body'); if (!body) return;
  for (const b of document.querySelectorAll('.pro-nav [data-pro="view"]')) { const on = b.dataset.id === view; b.className = `btn btn--sm ${on ? 'btn--gold' : 'btn--glass'}`; b.setAttribute('aria-pressed', String(on)); }
  if (!Auth.configured()) { body.innerHTML = '<p class="pro-empty">A Central precisa do jogo online.</p>'; return; }
  if (off) { body.innerHTML = '<p class="pro-empty">A Central de Profissionais está chegando. Volte daqui a pouco.</p>'; return; }
  if (loading && !pros.length) { body.innerHTML = '<p class="pro-empty muted">Carregando…</p>'; return; }
  body.innerHTML = view === 'buscar' ? viewSearch() : view === 'contratos' ? viewContracts() : view === 'perfil' ? viewProfile() : viewRanking();
}

// buscar
let fq = '', fper = '', fsort = 'rep';
function viewSearch() {
  const q = fq.toLowerCase(), list = pros.filter(p => p.active && (!q || `${p.name} ${p.title} ${(p.services || []).map(s => s.title).join(' ')}`.toLowerCase().includes(q))
    && (!fper || (p.services || []).some(s => s.period === fper)));
  list.sort(fsort === 'preco' ? (a, b) => PR.fromPrice(a) - PR.fromPrice(b) : fsort === 'contratos' ? (a, b) => b.done - a.done : (a, b) => PR.score(b) - PR.score(a));
  return `<div class="pro-filters">
    <label class="field pro-grow"><span>procurar</span><input class="input" id="pro-q" type="search" placeholder="profissão, nome ou serviço" value="${esc(fq)}" autocomplete="off"></label>
    <label class="field"><span>cobrança</span><select class="input" id="pro-per"><option value="">todas</option>${Object.entries(PR.PERIOD).map(([k, l]) => `<option value="${k}"${fper === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>ordenar</span><select class="input" id="pro-sort">${[['rep', 'melhor reputação'], ['preco', 'menor preço'], ['contratos', 'mais contratos']].map(([k, l]) => `<option value="${k}"${fsort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    ${list.length ? `<div class="pro-grid">${list.map(card).join('')}</div>` : `<p class="pro-empty">${pros.length ? 'Ninguém com esse filtro.' : 'Ainda não há profissionais. Seja o primeiro: crie seu perfil em <b>meu perfil profissional</b>.'}</p>`}`;
}
const card = p => { const fp = PR.fromPrice(p), s = (p.services || []).find(x => Number(x.price) === fp);
  return `<article class="pro-card${PR.suspended(p) ? ' is-susp' : ''}"><header>${av(p.user_id, p.name)}<div><h3>${esc(p.name)}</h3><p>${esc(p.title)}</p></div></header>
    <div>${stars(p.stars, p.rating_n)}</div><div class="pro-seals">${PR.seals(p).map(x => tag(x.label, x.tone, x.tip)).join('')}</div>
    <p class="small">${p.done} contrato(s) concluído(s) · ${(p.services || []).length} serviço(s)</p>
    ${s ? `<p class="pro-price">a partir de <b>${brl(fp)}</b> <small>${PR.PERIOD[s.period]}</small></p>` : '<p class="small muted">sem serviços</p>'}
    <button type="button" class="btn btn--gold btn--sm" data-pro="open" data-id="${esc(p.user_id)}">ver perfil</button></article>`; };

// perfil de um profissional (janela)
async function openProfile(id) {
  const p = pros.find(x => x.user_id === id); if (!p) return;
  const d = document.getElementById('dlg-pro'), host = document.getElementById('pro-dlg'); if (!d || !host) return;
  host.innerHTML = profileHTML(p, []); if (!d.open) d.showModal();
  const { data } = await sb().from('pro_reviews').select('stars, text, client_name, at').eq('pro_id', id).order('at', { ascending: false }).limit(20);
  host.innerHTML = profileHTML(p, data || []);
}
function profileHTML(p, reviews) {
  const self = p.user_id === me(), susp = PR.suspended(p);
  return `<header class="pro-ph">${av(p.user_id, p.name)}<div><h2 id="pro-dlg-t">${esc(p.name)}</h2><p class="pro-ph__t">${esc(p.title)}</p><div>${stars(p.stars, p.rating_n)}</div>
      <div class="pro-seals">${PR.seals(p).map(x => tag(x.label, x.tone, x.tip)).join('')}</div></div></header>
    <div class="pro-stats">${[['contratos concluídos', p.done], ['entregas no prazo', p.delivered], ['períodos sem entrega', p.late], ['faturado na Central', brl(p.earned)], ['na Central desde', new Date(p.created_at).toLocaleDateString('pt-BR')]]
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="pro-trophies">${PR.trophies(p).map(t => `<span class="pro-trophy${t.got ? ' is-got' : ''}" title="${esc(t.label)}${t.got ? '' : ' (ainda não)'}">${t.icon}<small>${esc(t.label)}</small></span>`).join('')}</div>
    ${p.bio ? `<h3>apresentação</h3><p class="pro-text">${esc(p.bio)}</p>` : ''}
    ${p.cv ? `<h3>currículo</h3><p class="pro-text">${esc(p.cv)}</p>` : ''}
    <h3>serviços</h3>
    ${susp ? '<p class="pro-warn">Este profissional está suspenso por não cumprir contratos e não pode ser contratado agora.</p>' : ''}
    ${(p.services || []).map(s => `<article class="pro-svc"><div class="pro-svc__h"><b>${esc(s.title)}</b><span class="pro-price"><b>${brl(s.price)}</b> <small>${PR.PERIOD[s.period]}${s.period === 'unico' ? ` · prazo ${s.days} dia(s)` : ''}</small></span></div>
      ${s.desc ? `<p class="small">${esc(s.desc)}</p>` : ''}${s.obl ? `<p class="small"><b>obrigações e entregas:</b> ${esc(s.obl)}</p>` : ''}
      ${self ? '<p class="small muted">Este é o seu serviço.</p>' : !me() ? '<p class="small muted">Entre na sua conta para contratar.</p>' : susp ? '' : `<div class="pro-hire">
        ${s.period === 'unico' ? '' : `<label class="field"><span>quantos ${PR.PER_ONE[s.period] === 'mês' ? 'meses' : `${PR.PER_ONE[s.period]}s`}</span><input class="input" type="number" min="1" max="${PR.MAX_N[s.period]}" value="1" data-pro-n="${esc(s.id)}"></label>`}
        <button type="button" class="btn btn--gold btn--sm" data-pro="hire" data-id="${esc(p.user_id)}" data-svc="${esc(s.id)}">contratar</button></div>`}</article>`).join('') || '<p class="small muted">Nenhum serviço cadastrado.</p>'}
    <h3>avaliações</h3>
    ${reviews.length ? `<ul class="pro-reviews">${reviews.map(r => `<li><span class="pro-stars">${PR.starsTxt(r.stars)}</span> <b>${esc(r.client_name || 'jogador')}</b> <small class="muted">${ago(r.at)}</small>${r.text ? `<p>${esc(r.text)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="small muted">Ainda sem avaliações.</p>'}
    ${self ? '<button type="button" class="btn btn--glass btn--sm" data-pro="edit">editar meu perfil</button>' : ''}`;
}

// contratos
function viewContracts() {
  if (!me()) return '<p class="pro-empty">Entre na sua conta para ver seus contratos.</p>';
  const hired = contracts.filter(c => c.client_id === me()), work = contracts.filter(c => c.pro_id === me());
  const sec = (t, list, empty) => `<h3 class="pro-sec">${t} <small class="muted">(${list.length})</small></h3>${list.length ? list.map(contractCard).join('') : `<p class="small muted">${empty}</p>`}`;
  return sec('serviços que contratei', hired, 'Você ainda não contratou ninguém. Procure em <b>encontrar profissionais</b>.') + sec('trabalhos que eu faço', work, 'Ninguém contratou você ainda. Monte um bom perfil e serviços claros.');
}
function contractCard(c) {
  const isPro = c.pro_id === me(), g = PR.progress(c), [stl, stt] = PR.STATUS[c.status] || [c.status, 'muted'], ds = deliv[c.id] || [];
  const cur = Date.parse(c.started_at) + g.idx * g.len, hasCur = ds.some(d => Date.parse(d.at) >= cur);
  const n = PR.PER_ONE[c.period], act = [];
  if (c.status === 'ativo' && isPro) act.push(`<div class="pro-row"><label class="field pro-grow"><span>registrar entrega deste ${n}</span><textarea class="input" rows="2" maxlength="400" id="pro-dv-${c.id}" placeholder="o que você fez (ex.: vacinei 40 cabeças e mandei o relatório)"></textarea></label>
    <button type="button" class="btn btn--gold btn--sm" data-pro="deliver" data-id="${c.id}">registrar entrega</button></div>`);
  if (c.status === 'ativo' && !isPro) act.push(`<button type="button" class="btn btn--gold btn--sm" data-pro="confirm" data-id="${c.id}">confirmar entrega e liberar ${brl(c.price)}</button>`);
  if (['ativo', 'concluido'].includes(c.status) && !isPro && c.period !== 'unico') act.push(`<span class="pro-row"><input class="input pro-n" type="number" min="1" max="${PR.MAX_N[c.period]}" value="1" id="pro-rn-${c.id}" aria-label="períodos a renovar"><button type="button" class="btn btn--glass btn--sm" data-pro="renew" data-id="${c.id}">renovar</button></span>`);
  if (c.status === 'concluido' && !isPro && c.period === 'unico') act.push(`<button type="button" class="btn btn--glass btn--sm" data-pro="renew" data-id="${c.id}">contratar de novo</button>`);
  if (c.status === 'ativo') act.push(`<button type="button" class="btn btn--danger btn--sm" data-pro="cancel" data-id="${c.id}">cancelar contrato</button>`);
  const canRate = !isPro && !c.rated && (Number(c.released) > 0 || ['concluido', 'cancelado', 'encerrado'].includes(c.status));
  const canReport = !isPro && ['ativo', 'concluido', 'cancelado'].includes(c.status);
  return `<article class="pro-ct pro-ct--${stt}"><header><div><b>#${c.id} · ${esc(c.service?.title || 'serviço')}</b><p class="small">${isPro ? `contratado por <b>${esc(c.client_name)}</b>` : `profissional <b>${esc(c.pro_name)}</b>`} · ${brl(c.price)} ${PR.PERIOD[c.period]}</p></div>${tag(stl, stt)}</header>
    ${c.status === 'ativo' ? `<p class="small">${c.period === 'unico' ? 'entrega única' : `${n} ${g.idx + 1} de ${c.periods}`} · ${c.period === 'unico' ? 'prazo acaba' : `este ${n} acaba`} em <b>${left(g.periodEnds)}</b> · ${hasCur ? '<span class="good">entrega registrada</span>' : '<span class="bad">sem entrega neste período ainda</span>'}</p>` : ''}
    ${c.status === 'disputa' ? '<p class="pro-warn">Denúncia em análise. O dinheiro em custódia fica parado até o administrador decidir.</p>' : ''}
    <div class="pro-money"><span>pago <b>${brl(c.paid)}</b></span><span>liberado <b class="good">${brl(c.released)}</b></span><span>devolvido <b>${brl(c.refunded)}</b></span><span>em custódia <b>${brl(g.held)}</b></span>${c.renewals ? `<span>renovado ${c.renewals}x</span>` : ''}</div>
    ${c.service?.obl ? `<p class="small"><b>obrigações:</b> ${esc(c.service.obl)}</p>` : ''}
    ${ds.length ? `<details class="pro-dl"><summary>entregas (${ds.length})</summary><ul>${ds.slice(0, 20).map(d => `<li><small class="muted">${ago(d.at)}</small> ${esc(d.text)}</li>`).join('')}</ul></details>` : ''}
    ${c.last_event ? `<p class="small muted">último acontecimento: ${esc(c.last_event)} · ${ago(c.updated_at)}</p>` : ''}
    ${act.length ? `<div class="pro-actions">${act.join('')}</div>` : ''}
    ${canRate ? `<details class="pro-dl"><summary>avaliar o profissional</summary><div class="pro-row"><select class="input" id="pro-rs-${c.id}" aria-label="estrelas">${[5, 4, 3, 2, 1].map(s => `<option value="${s}">${'★'.repeat(s)}${'☆'.repeat(5 - s)}</option>`).join('')}</select>
      <input class="input pro-grow" id="pro-rt-${c.id}" maxlength="300" placeholder="comentário (opcional)"><button type="button" class="btn btn--gold btn--sm" data-pro="rate" data-id="${c.id}">enviar avaliação</button></div></details>` : ''}
    ${canReport ? `<details class="pro-dl"><summary class="bad">denunciar</summary><div class="pro-row"><select class="input" id="pro-xr-${c.id}" aria-label="motivo">${Object.entries(PR.REASONS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <input class="input pro-grow" id="pro-xt-${c.id}" maxlength="500" placeholder="conte o que aconteceu"><button type="button" class="btn btn--danger btn--sm" data-pro="report" data-id="${c.id}">enviar denúncia</button></div>
      <p class="small muted">Com o contrato em andamento, o dinheiro em custódia congela até o administrador decidir. Denúncia falsa também é analisada.</p></details>` : ''}</article>`;
}

// meu perfil profissional (editar)
const blankSvc = () => ({ id: Math.random().toString(36).slice(2, 10), title: '', desc: '', obl: '', price: 1000, period: 'unico', days: 7 });
function viewProfile() {
  if (!me()) return '<p class="pro-empty">Entre na sua conta para criar seu perfil profissional.</p>';
  if (!draft) draft = mine ? { title: mine.title, bio: mine.bio, cv: mine.cv, active: mine.active, services: (mine.services || []).map(s => ({ ...s })) } : { title: '', bio: '', cv: '', active: true, services: [blankSvc()] };
  const m = mine;
  return `${m ? `<div class="pro-mine"><div>${stars(m.stars, m.rating_n)}</div><div class="pro-seals">${PR.seals(m).map(x => tag(x.label, x.tone, x.tip)).join('')}</div>
      <div class="pro-stats">${[['contratos concluídos', m.done], ['faturado', brl(m.earned)], ['entregas', m.delivered], ['sem entrega', m.late], ['penalidades (60 dias)', m.strikes60]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      ${PR.suspended(m) ? `<p class="pro-warn">Você está suspenso da Central até ${new Date(m.suspended_until).toLocaleString('pt-BR')} por não cumprir contratos. Seus contratos atuais continuam.</p>` : ''}
      <div class="pro-trophies">${PR.trophies(m).map(t => `<span class="pro-trophy${t.got ? ' is-got' : ''}" title="${esc(t.label)}">${t.icon}<small>${esc(t.label)}</small></span>`).join('')}</div>
      <button type="button" class="btn btn--glass btn--sm" data-pro="open" data-id="${esc(m.user_id)}">ver como os outros veem</button></div>` : '<p class="small">Crie seu perfil: outros jogadores vão poder achar você, ver seu currículo e contratar seus serviços. Você recebe quando entrega.</p>'}
    <form class="pro-form" id="pro-form">
      <label class="field"><span>profissão (escolha ou invente a sua)</span><input class="input" name="title" list="pro-profs" maxlength="40" required value="${esc(draft.title)}" placeholder="ex.: Agrônomo(a), Mentor de 21, Caçador de leilão"><datalist id="pro-profs">${PR.PROFS.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <label class="field"><span>apresentação</span><textarea class="input" name="bio" rows="3" maxlength="600" placeholder="quem é você e por que contratar você">${esc(draft.bio)}</textarea></label>
      <label class="field"><span>currículo</span><textarea class="input" name="cv" rows="4" maxlength="1500" placeholder="experiência, conquistas no jogo, o que já fez">${esc(draft.cv)}</textarea></label>
      <h3 class="pro-sec">serviços <small class="muted">(até 8)</small></h3>
      ${draft.services.map((s, i) => `<fieldset class="pro-svc-ed"><legend>serviço ${i + 1}</legend>
        <label class="field"><span>nome do serviço</span><input class="input" data-svc="${i}" data-f="title" maxlength="60" value="${esc(s.title)}" placeholder="ex.: consulta do rebanho"></label>
        <label class="field"><span>descrição</span><textarea class="input" data-svc="${i}" data-f="desc" rows="2" maxlength="400">${esc(s.desc)}</textarea></label>
        <label class="field"><span>obrigações e entregas</span><input class="input" data-svc="${i}" data-f="obl" maxlength="300" value="${esc(s.obl)}" placeholder="o que você se compromete a entregar em cada período"></label>
        <div class="pro-row"><label class="field"><span>preço (R$)</span><input class="input" data-svc="${i}" data-f="price" type="number" min="100" step="100" value="${Number(s.price) || 100}"></label>
          <label class="field"><span>cobrança</span><select class="input" data-svc="${i}" data-f="period">${Object.entries(PR.PERIOD).map(([k, l]) => `<option value="${k}"${s.period === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          ${s.period === 'unico' ? `<label class="field"><span>prazo de entrega (dias)</span><input class="input" data-svc="${i}" data-f="days" type="number" min="1" max="30" value="${Number(s.days) || 7}"></label>` : ''}
          <button type="button" class="btn btn--glass btn--sm" data-pro="svc-del" data-id="${i}">remover</button></div></fieldset>`).join('')}
      ${draft.services.length < 8 ? '<button type="button" class="btn btn--glass btn--sm" data-pro="svc-add">+ serviço</button>' : ''}
      <label class="check"><input type="checkbox" name="active"${draft.active ? ' checked' : ''}> <span>aceitando novos contratos (aparece na busca)</span></label>
      <p class="small muted">Como funciona: quem contrata paga na hora e a Central guarda. Em cada período você registra a entrega; no fim do período o valor cai na sua conta. Período sem entrega volta para o contratante e tira meia estrela sua; 3 penalidades em 30 dias suspendem você por 7 dias.</p>
      <button type="submit" class="btn btn--gold">salvar perfil profissional</button></form>`;
}

// ranking
function viewRanking() {
  const list = pros.filter(p => p.done > 0 || p.rating_n > 0).sort((a, b) => PR.score(b) - PR.score(a)).slice(0, 30);
  if (!list.length) return '<p class="pro-empty">O ranking aparece quando os primeiros contratos forem concluídos.</p>';
  return `<div class="glass scroll"><table class="pro-rank"><thead><tr><th>#</th><th>profissional</th><th>reputação</th><th class="num">contratos</th><th class="num">faturado</th><th>selos</th></tr></thead><tbody>
    ${list.map((p, i) => `<tr><td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td><button type="button" class="pro-link" data-pro="open" data-id="${esc(p.user_id)}"><b>${esc(p.name)}</b></button><br><small class="muted">${esc(p.title)}</small></td>
      <td>${stars(p.stars, p.rating_n)}</td><td class="num">${p.done}</td><td class="num">${brl(p.earned)}</td><td><div class="pro-seals">${PR.seals(p).map(x => tag(x.label, x.tone, x.tip)).join('')}</div></td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- ações ----------
async function rpc(fn, args) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) { say(`Não deu certo: ${error.message}`, true); return null; }
  const ok = String(data ?? '').startsWith('ok'); if (!ok) say(PR.MSG[data] || `Não deu certo (${data}).`, true);
  return ok ? String(data) : null;
}
const waitLock = async () => { while (lock) await new Promise(r => setTimeout(r, 100)); };
async function hire(proId, svcId) {
  const p = pros.find(x => x.user_id === proId), s = p?.services?.find(x => x.id === svcId); if (!s) return;
  const n = s.period === 'unico' ? 1 : Math.max(1, Math.min(PR.MAX_N[s.period], Math.floor(Number(document.querySelector(`[data-pro-n="${CSS.escape(svcId)}"]`)?.value) || 1)));
  const tot = Number(s.price) * n;
  if (tot > G.S.money) return say(`Você só tem ${brl(G.S.money)} em dinheiro para pagar ${brl(tot)}.`, true);
  if (!confirm(`Contratar "${s.title}" de ${p.name}?\n\n${s.period === 'unico' ? `Pagamento único de ${brl(tot)}, prazo de ${s.days} dia(s).` : `${n} ${PR.PER_ONE[s.period]}(s) x ${brl(s.price)} = ${brl(tot)}.`}\n\nO valor sai agora e fica guardado pela Central. Cada período só é pago a ${p.name} se houver entrega; senão volta para você.`)) return;
  await waitLock(); lock = true;
  try {
    const r = await rpc('pro_hire', { p_pro: proId, p_service: svcId, p_periods: n }); if (!r) return;
    const [, cid, pid] = r.split(':');
    G.S.money -= tot; (G.S.proOut ||= []).push(Number(pid)); note(`Central: contrato #${cid} (${s.title}) com ${p.name}`, -tot); save(); G.render?.();
    say(`Contrato #${cid} fechado com ${p.name}. Acompanhe em "meus contratos".`);
    document.getElementById('dlg-pro')?.close(); view = 'contratos'; await loadContracts(); paint();
  } finally { lock = false; }
}
async function renew(id) {
  const c = contracts.find(x => x.id === id); if (!c) return;
  const n = c.period === 'unico' ? 1 : Math.max(1, Math.min(PR.MAX_N[c.period], Math.floor(Number($(`#pro-rn-${id}`)?.value) || 1))), tot = Number(c.price) * n;
  if (tot > G.S.money) return say(`Você só tem ${brl(G.S.money)} em dinheiro.`, true);
  if (!confirm(`Renovar o contrato #${id} com ${c.pro_name} por mais ${n} ${PR.PER_ONE[c.period]}(s)? Sai ${brl(tot)} agora (fica guardado pela Central).`)) return;
  await waitLock(); lock = true;
  try {
    const r = await rpc('pro_renew', { p_id: id, p_periods: n }); if (!r) return;
    G.S.money -= tot; (G.S.proOut ||= []).push(Number(r.split(':')[1])); note(`Central: renovação do contrato #${id} com ${c.pro_name}`, -tot); save(); G.render?.();
    say('Contrato renovado.'); await loadContracts(); paint();
  } finally { lock = false; }
}
async function act(fn, id, args, okMsg, ask) {
  if (ask && !confirm(ask)) return;
  if (await rpc(fn, { p_id: id, ...args })) { say(okMsg); await loadContracts(); paint(); setTimeout(sync, 500); }
}
async function saveProfile(f) {
  const title = f.title.value.trim(); if (title.length < 3) return say(PR.MSG.title, true);
  const services = draft.services.filter(s => s.title.trim().length >= 3).map(s => ({ ...s, price: Math.max(100, Math.floor(Number(s.price) || 0)), days: Math.max(1, Math.min(30, Math.floor(Number(s.days) || 7))) }));
  if (!services.length) return say('Cadastre pelo menos um serviço (nome com 3 letras ou mais).', true);
  if (await rpc('pro_save_profile', { p_title: title, p_bio: f.bio.value.trim(), p_cv: f.cv.value.trim(), p_services: services, p_active: f.active.checked })) {
    say(mine ? 'Perfil profissional atualizado.' : 'Perfil profissional criado! Você já aparece na Central.'); draft = null; await loadPros(); paint();
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-pro]'); if (!b) return;
  const a = b.dataset.pro, id = b.dataset.id, n = Number(id);
  if (a === 'view') { view = id; paint(); if (id === 'contratos') loadContracts().then(paint); }
  else if (a === 'open') openProfile(id);
  else if (a === 'edit') { document.getElementById('dlg-pro')?.close(); view = 'perfil'; paint(); }
  else if (a === 'hire') hire(id, b.dataset.svc);
  else if (a === 'svc-add') { draft.services.push(blankSvc()); paint(); }
  else if (a === 'svc-del') { draft.services.splice(n, 1); paint(); }
  else if (a === 'renew') renew(n);
  else if (a === 'deliver') { const t = $(`#pro-dv-${n}`)?.value.trim() || ''; if (t.length < 3) return say(PR.MSG.text, true); act('pro_deliver', n, { p_text: t }, 'Entrega registrada. O contratante foi avisado.'); }
  else if (a === 'confirm') act('pro_confirm', n, {}, 'Entrega confirmada: o pagamento deste período foi liberado ao profissional.', 'Confirmar a entrega deste período? O valor vai para o profissional agora.');
  else if (a === 'cancel') { const c = contracts.find(x => x.id === n), isPro = c?.pro_id === me();
    act('pro_cancel', n, {}, 'Contrato cancelado.', isPro ? 'Cancelar este contrato? Todo o valor que não foi pago volta para o contratante e, depois de 1 h de contrato, você leva uma penalidade (1 estrela).' : 'Cancelar este contrato? O período atual só é pago se já teve entrega; o resto volta para você.'); }
  else if (a === 'rate') act('pro_review', n, { p_stars: Number($(`#pro-rs-${n}`)?.value) || 5, p_text: $(`#pro-rt-${n}`)?.value || '' }, 'Avaliação enviada. Obrigado!');
  else if (a === 'report') act('pro_report', n, { p_reason: $(`#pro-xr-${n}`)?.value || 'outro', p_text: $(`#pro-xt-${n}`)?.value || '' }, 'Denúncia enviada ao administrador.', 'Enviar a denúncia? Com o contrato em andamento, o dinheiro em custódia fica congelado até a decisão.');
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pro-q') { fq = t.value; const pos = t.selectionStart; paint(); const q = $('#pro-q'); q.focus(); try { q.setSelectionRange(pos, pos); } catch {} }
  if (t.dataset?.svc != null && draft) draft.services[Number(t.dataset.svc)][t.dataset.f] = t.value;
  if (t.form?.id === 'pro-form' && ['title', 'bio', 'cv'].includes(t.name) && draft) draft[t.name] = t.value;
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'pro-per') { fper = t.value; paint(); }
  if (t.id === 'pro-sort') { fsort = t.value; paint(); }
  if (t.dataset?.f === 'period' && draft) { draft.services[Number(t.dataset.svc)].period = t.value; paint(); }
  if (t.name === 'active' && t.form?.id === 'pro-form' && draft) draft.active = t.checked;
});
document.addEventListener('submit', e => { if (e.target.id === 'pro-form') { e.preventDefault(); saveProfile(e.target); } });
document.addEventListener('click', e => { if (e.target.closest('[data-tab="pro"]')) setTimeout(open, 50); });
addEventListener('hashchange', () => { if (location.hash === '#pro') setTimeout(open, 50); });
setTimeout(() => { if (location.hash === '#pro') open(); sync(); }, 5000);
setInterval(sync, 30000);
