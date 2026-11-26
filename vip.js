// VIP da cidade (vip.sql): Apoiador, Patrono e Fundador. Só aparência e reconhecimento: não dá dinheiro, taxa nem vantagem no jogo.
// Os dados vêm do servidor uma vez ao abrir e no máximo a cada 10 min (tabela pequena); o selo aparece no ranking e no salão.
import * as Auth from './auth.js';
import { brl, esc, int, say, profileOf, every } from './store.js';

export const PLANS = {
  apoiador: { name: 'Apoiador', price: 5, per: '/mês', ico: '🌱' },
  patrono: { name: 'Patrono', price: 15, per: '/mês', ico: '⚜️' },
  patrono12: { name: 'Patrono anual', price: 150, per: ' por 12 meses', ico: '⚜️' },
  fundador: { name: 'Fundador', price: 50, per: ' uma vez só', ico: '🏛️' },
};
// o selo evolui com os meses de apoio somados (pausar não perde: volta e ele reacende)
export const LEVELS = [[24, '👑', 'Lenda'], [12, '💎', 'Diamante'], [6, '🥇', 'Ouro'], [3, '🥈', 'Prata'], [1, '🥉', 'Bronze']];
export const levelOf = m => LEVELS.find(l => m >= l[0]) || null;
export const nextLevel = m => [...LEVELS].reverse().find(l => m < l[0]) || null;
// selo do mês: cada mês tem o seu e só ganha quem apoiou naquele mês. Fica para sempre no álbum.
export const STAMPS = [['🎆', 'Ano Novo'], ['🎭', 'Carnaval'], ['🌧️', 'Águas de Março'], ['🐣', 'Páscoa'], ['🌽', 'Colheita do Milho'], ['🔥', 'São João'],
  ['❄️', 'Geada'], ['🐂', 'Rodeio'], ['🌸', 'Primavera'], ['🎡', 'Feira da Cidade'], ['🌾', 'Plantio da Soja'], ['🎄', 'Natal']];
export const COLORS = { ouro: 'Ouro', esmeralda: 'Esmeralda', rubi: 'Rubi', safira: 'Safira', ametista: 'Ametista', prata: 'Prata' };
export const FOUNDERS = 21;

let rows = [], meta = { pix: '', goal: 140, poll: null }, raised = 0, myReq = null, at = 0, loading = null;
const byId = new Map(), byName = new Map();
const active = v => !!v && v.tier && Date.parse(v.until) > Date.now();

export async function load(force = false) {
  if (loading) return loading;
  if (!force && Date.now() - at < 600000) return;
  loading = (async () => {
    const sb = Auth.sbClient() || await Auth.sbReady(); if (!sb) return;
    const me = Auth.account()?.id;
    const [v, m, r, q] = await Promise.all([sb.from('vip').select('user_id, name, tier, until, months, stamps, founder, street, title, color, vote_key, vote'),
      sb.from('vip_meta').select('pix, goal, poll').eq('id', 1).maybeSingle(), sb.rpc('vip_raised'),
      me ? sb.from('vip_req').select('id, plan, at').eq('user_id', me).eq('done', false).maybeSingle() : Promise.resolve({ data: null })]);
    if (v.error) return;
    rows = v.data || []; meta = m.data || meta; raised = Number(r.data) || 0; myReq = q.data || null; at = Date.now();
    byId.clear(); byName.clear();
    for (const x of rows) { byId.set(x.user_id, x); if (x.name) byName.set(x.name.toLowerCase(), x); }
  })().finally(() => { loading = null; });
  return loading;
}
const find = key => byId.get(String(key || '').replace(/^u:/, '')) || byName.get(String(key || '').toLowerCase());

// selo ao lado do nick (ranking, salão). key = id da conta, 'u:id' ou o nick.
export function tag(key) {
  const v = find(key); if (!v) return '';
  const on = active(v), L = on && levelOf(v.months);
  const t = [v.founder ? `<i class="vtag vtag--f" title="Fundador nº ${v.founder} da cidade">🏛️</i>` : '',
    on ? `<i class="vtag vtag--${v.tier}" title="${v.tier === 'patrono' ? 'Patrono' : 'Apoiador'} da cidade${L ? ` · selo ${L[2]}` : ''}">${L ? L[1] : '🌱'}</i>` : ''].join('');
  return t;
}
export const cls = key => { const v = find(key); return active(v) && v.tier === 'patrono' && v.color ? ` vnick vnick--${v.color}` : ''; };
export const title = key => { const v = find(key); return active(v) && v.tier === 'patrono' && v.title ? v.title : ''; };

// ---------- aba VIP ----------
const box = () => document.getElementById('p-vip');
const ym = d => { const x = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const dt = s => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export async function render() {
  const el = box(); if (!el || el.hidden) return;
  if (!at) el.innerHTML = '<p class="glass empty">Abrindo o salão nobre da cidade…</p>';
  await load(); draw();
}
function draw() {
  const el = box(); if (!el) return;
  const me = Auth.account()?.id, mine = byId.get(me), on = active(mine), goal = Math.max(1, Number(meta.goal) || 140), pct = Math.min(1, raised / goal);
  const pats = rows.filter(active).sort((a, b) => (b.tier === 'patrono') - (a.tier === 'patrono') || b.months - a.months);
  const founders = rows.filter(v => v.founder).sort((a, b) => a.founder - b.founder), left = FOUNDERS - founders.length;
  const year = new Date().getFullYear(), nowYm = ym(new Date());
  const L = mine && levelOf(mine.months), N = nextLevel(mine?.months || 0);
  const perks = {
    apoiador: ['Selo ao lado do nick no ranking e no salão', 'Selo do mês para o seu álbum (cada mês tem um diferente)', 'O selo evolui: Bronze, Prata, Ouro, Diamante e Lenda', 'Seu nome no Mural da Usina'],
    patrono: ['Tudo do Apoiador', 'Nick colorido (ouro, esmeralda, rubi…)', 'Título seu embaixo do nick: "Barão do Café", "Rei do Truco"…', 'Vota na carga do mês: os Patronos escolhem a próxima novidade', 'Destaque no topo do Mural'],
    patrono12: ['Tudo do Patrono por 12 meses', '12 meses pelo preço de 10', 'Garante os 12 selos do ano no álbum', 'Chega direto no selo 💎 Diamante'],
    fundador: [`Só ${FOUNDERS} vagas para sempre: Fundador nº 1 a ${FOUNDERS}`, 'Selo 🏛️ permanente, nunca vence', 'Uma rua da cidade com o nome que você escolher', 'Leva 1 mês de Patrono de presente'],
  };
  const poll = meta.poll && Array.isArray(meta.poll.opts) ? meta.poll : null;
  const votes = poll ? poll.opts.map((_, i) => rows.filter(v => active(v) && v.vote_key === poll.key && v.vote === i).length) : [];
  const vTot = votes.reduce((a, b) => a + b, 0) || 1;
  el.innerHTML = `
  <header class="vip-hero glass">
    <p class="vip-hero__kick">⚡ Usina 21 · a luz da cidade</p>
    <h2>Mantenha a cidade acesa</h2>
    <p>O 21 World roda numa usina que custa todo mês. Quem apoia paga a luz da cidade e ganha <b>reconhecimento</b>: selo, nome no mural, nick colorido. <b>VIP não dá dinheiro, juros, terra nem vantagem nas mesas</b>: o jogo continua justo para todos.</p>
    <div class="vip-usina" role="img" aria-label="usina do mês: ${Math.round(pct * 100)}% da meta"><i style="transform:scaleX(${pct.toFixed(3)})"></i><span>${pct >= 1 ? '💡 usina paga este mês! obrigado, cidade' : `${Math.round(pct * 100)}% da usina do mês paga`}</span></div>
    <p class="small muted">Meta do mês: ${brl(goal)} · ${pats.length} ${pats.length === 1 ? 'apoiador ativo' : 'apoiadores ativos'} · a conta zera todo dia 1º</p>
  </header>

  ${mine ? `<section class="glass vip-me">
    <h3>${on ? `${L ? L[1] : '🌱'} Você é ${mine.tier === 'patrono' ? 'Patrono' : 'Apoiador'} da cidade` : `${mine.founder ? '🏛️ Fundador' : '💤 Seu apoio está pausado'}`}</h3>
    <p class="small">${mine.founder ? `Fundador nº <b>${mine.founder}</b>${mine.street ? ` · 🛣️ <b>${esc(mine.street)}</b>` : ''} · ` : ''}${int(mine.months)} ${mine.months === 1 ? 'mês' : 'meses'} de apoio${L ? ` · selo <b>${L[2]}</b>` : ''}${on ? ` · vale até <b>${dt(mine.until)}</b>` : ''}</p>
    ${!on && L ? `<p class="small bad">Seu selo ${L[1]} ${L[2]} está guardado, apagado. Volte a apoiar e ele reacende de onde parou.</p>` : ''}
    ${N ? `<p class="small">Faltam <b>${N[0] - (mine.months || 0)} ${N[0] - (mine.months || 0) === 1 ? 'mês' : 'meses'}</b> para o selo ${N[1]} ${N[2]}.</p>` : ''}
    <h4>📒 Álbum de selos de ${year}</h4>
    <ol class="vip-album">${STAMPS.map(([e, n], i) => { const k = `${year}-${String(i + 1).padStart(2, '0')}`, got = (mine.stamps || []).includes(k);
      return `<li class="${got ? 'is-got' : ''}${k === nowYm ? ' is-now' : ''}" title="${esc(n)}${got ? ': seu!' : k < nowYm ? ': esse mês já passou' : ''}"><span>${got ? e : k < nowYm ? '✖' : '?'}</span><small>${esc(n)}</small></li>`; }).join('')}</ol>
    ${on && mine.tier === 'patrono' ? `<div class="vip-style"><h4>⚜️ Seu estilo de Patrono</h4><div class="row">
      <label class="field"><span>título (até 24 letras)</span><input class="input" id="vip-title" maxlength="24" value="${esc(mine.title || '')}" placeholder="Barão do Café"></label>
      <label class="field"><span>cor do nick</span><select class="input" id="vip-color"><option value="">normal</option>${Object.entries(COLORS).map(([k, n]) => `<option value="${k}"${mine.color === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn btn--gold btn--sm" type="button" data-vip="style">salvar</button></div>
      <p class="small">Prévia: <b class="${cls(me) || ''}" id="vip-prev">${esc(mine.name)}</b>${mine.title ? ` <small class="vtitle">${esc(mine.title)}</small>` : ''}</p></div>` : ''}
  </section>` : ''}

  ${poll ? `<section class="glass vip-poll"><h3>🗳️ Carga do mês: os Patronos decidem</h3><p>${esc(poll.q || 'Qual novidade chega primeiro?')}</p>
    <ul>${poll.opts.map((o, i) => `<li><button class="vip-opt${mine?.vote_key === poll.key && mine?.vote === i ? ' is-mine' : ''}" type="button" data-vip="vote" data-i="${i}"${on && mine.tier === 'patrono' ? '' : ' disabled'}>
      <span>${esc(o)}</span><b>${votes[i]}</b><i style="transform:scaleX(${(votes[i] / vTot).toFixed(3)})"></i></button></li>`).join('')}</ul>
    <p class="small muted">${on && mine.tier === 'patrono' ? 'Toque para votar (pode trocar até fechar).' : 'Só Patronos votam. Todo mundo vê o placar.'}</p></section>` : ''}

  <h3 class="vip-h">Planos</h3>
  <div class="vip-plans">${Object.entries(PLANS).map(([k, P]) => `<article class="glass vip-plan vip-plan--${k}">
    ${k === 'patrono' ? '<span class="vip-plan__tag">mais escolhido</span>' : k === 'fundador' ? `<span class="vip-plan__tag">${left > 0 ? `restam ${left} de ${FOUNDERS}` : 'esgotado'}</span>` : ''}
    <h4>${P.ico} ${P.name}</h4><p class="vip-plan__price"><b>${brl(P.price)}</b><small>${P.per}</small></p>
    <ul>${perks[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <button class="btn ${k === 'patrono' ? 'btn--gold' : 'btn--glass'} btn--sm" type="button" data-vip="pick" data-plan="${k}"${k === 'fundador' && left <= 0 ? ' disabled' : ''}>quero este</button></article>`).join('')}</div>

  <section class="glass vip-pay" id="vip-pay">
    <h3>💸 Como apoiar</h3>
    <ol><li>Escolha o plano e mande o Pix ${meta.pix ? `para a chave <b class="vip-key">${esc(meta.pix)}</b> <button class="btn btn--glass btn--xs" type="button" data-vip="copy">copiar</button>` : '(a chave aparece aqui em breve)'}.</li>
      <li>Na mensagem do Pix, escreva o seu nick.</li><li>Toque em <b>já mandei o Pix</b>: o prefeito confere e o selo aparece em até 24 h.</li></ol>
    ${myReq ? `<p class="good">⏳ Pedido de <b>${esc(PLANS[myReq.plan]?.name || myReq.plan)}</b> enviado em ${dt(myReq.at)}. Assim que o Pix for conferido, o selo acende. <button class="btn btn--glass btn--xs" type="button" data-vip="cancel">cancelar pedido</button></p>`
      : me ? `<div class="row"><label class="field"><span>plano</span><select class="input" id="vip-plan">${Object.entries(PLANS).map(([k, P]) => `<option value="${k}">${P.name} · ${brl(P.price)}${P.per}</option>`).join('')}</select></label>
      <label class="field"><span>recado (opcional)</span><input class="input" id="vip-note" maxlength="140" placeholder="ex.: nome da rua, se for Fundador"></label>
      <button class="btn btn--gold btn--sm" type="button" data-vip="req">já mandei o Pix</button></div>` : '<p class="small">Entre na sua conta para apoiar.</p>'}
    <p class="small muted">Apoio é voluntário e não volta como dinheiro no jogo. Menores de idade: peça para um responsável.</p>
  </section>

  <section class="glass vip-wall"><h3>🏛️ Mural da Usina</h3>
    ${founders.length ? `<h4>Fundadores da cidade</h4><ul class="vip-names">${founders.map(v => `<li><b>nº ${v.founder}</b> ${esc(v.name)}${v.street ? ` <small>🛣️ ${esc(v.street)}</small>` : ''}</li>`).join('')}</ul>` : ''}
    <h4>Quem mantém a luz acesa este mês</h4>
    ${pats.length ? `<ul class="vip-names">${pats.map(v => `<li>${tag(v.user_id)} <b class="${cls(v.user_id)}">${esc(v.name)}</b>${title(v.user_id) ? ` <small class="vtitle">${esc(title(v.user_id))}</small>` : ''}</li>`).join('')}</ul>` : '<p class="small muted">Ainda ninguém. Seja o primeiro nome do mural!</p>'}
  </section>`;
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-vip]'); if (!b || !box()?.contains(b)) return;
  const sb = Auth.sbClient(), act = b.dataset.vip;
  if (act === 'pick') { const s = document.getElementById('vip-plan'); if (s) s.value = b.dataset.plan; document.getElementById('vip-pay')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (act === 'copy') { try { await navigator.clipboard.writeText(meta.pix); say('Chave Pix copiada.'); } catch { say('Não deu para copiar: selecione a chave e copie.', true); } return; }
  if (!sb) return say('Entre na sua conta primeiro.', true);
  b.disabled = true;
  try {
    if (act === 'req') {
      const plan = document.getElementById('vip-plan').value, note = document.getElementById('vip-note').value.trim().slice(0, 140);
      const { error } = await sb.from('vip_req').insert({ plan, note: note || null, name: String(profileOf()?.name || '').slice(0, 40) });
      if (error) return say(/duplicate|unique/i.test(error.message) ? 'Você já tem um pedido esperando conferência.' : 'Não deu para enviar o pedido. Tente de novo.', true);
      say('Pedido enviado! Assim que o Pix for conferido, o selo acende.');
    } else if (act === 'cancel') {
      await sb.from('vip_req').delete().eq('id', myReq.id);
    } else if (act === 'style') {
      const { data } = await sb.rpc('vip_style', { p_title: document.getElementById('vip-title').value, p_color: document.getElementById('vip-color').value });
      say(data === 'ok' ? 'Estilo salvo: já aparece no ranking e no salão.' : String(data || 'não deu para salvar'), data !== 'ok');
    } else if (act === 'vote') {
      const { data } = await sb.rpc('vip_vote', { p_opt: Number(b.dataset.i) });
      say(data === 'ok' ? 'Voto registrado!' : String(data || 'não deu para votar'), data !== 'ok');
    }
    await load(true); draw();
  } finally { b.disabled = false; }
});
// selos no ranking e no salão: lê ao abrir o jogo e a cada 10 min (com a aba escondida não lê)
if (typeof document !== 'undefined') { setTimeout(() => load(), 6000); every(600000, () => load()); }
