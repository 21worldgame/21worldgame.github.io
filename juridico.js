// Departamento Jurídico do 21 World (juridico.sql): carta do administrador explicando ao jogador o que aconteceu na conta.
// Abre sozinha quando chega uma carta nova; as antigas ficam em "perfil > jurídico".
import * as Auth from './auth.js';
import { G, esc, say } from './store.js';

const proto = c => `JUR-${new Date(c.at).getFullYear()}/${String(c.id).padStart(5, '0')}`;
const day = at => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
// texto do admin: linha em branco separa parágrafo, **assim** vira negrito (tudo escapado antes)
const fmt = t => esc(t).split(/\n\s*\n/).map(p => `<p>${p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`).join('');

let dlg;
function box() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog'); dlg.className = 'dlg dlg--carta'; dlg.setAttribute('aria-labelledby', 'ct-t');
  document.body.append(dlg);
  dlg.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });
  return dlg;
}
const head = `<div class="ct__head"><span class="ct__seal" aria-hidden="true">⚖️</span><div><b>21 WORLD</b><small>Departamento Jurídico · Atendimento ao Jogador</small></div></div>`;

function letter(c, name) {
  const d = box();
  d.innerHTML = `<article class="ct">${head}
    <p class="ct__meta"><span>Protocolo <b>${proto(c)}</b></span><span>${day(c.at)}</span></p>
    <h2 id="ct-t" class="ct__title">${esc(c.title)}</h2>
    <p class="ct__to">Prezado(a) <b>${esc(name)}</b>,</p>
    <div class="ct__body">${fmt(c.body)}</div>
    <div class="ct__sign"><span class="ct__sig">${esc(c.signer)}</span><small>${esc(c.signer)} · Advogada do 21 World · OAB/21 nº 0421</small></div>
    <span class="ct__stamp" aria-hidden="true">ANALISADO</span>
    <div class="row ct__acts"><button class="btn btn--gold" type="button" data-close>li e entendi</button><button class="btn btn--glass" type="button" data-carta-mine>todas as cartas</button></div>
  </article>`;
  if (!d.open) d.showModal();
  if (!c.read_at) { c.read_at = new Date().toISOString(); Auth.sbClient()?.rpc('carta_lida', { p_id: c.id }).then(() => {}, () => {}); }
}

let cache = [];
async function load() {
  const sb = Auth.sbClient(), me = Auth.account(); if (!sb || !me) return null;
  const { data, error } = await sb.from('cartas').select('id, at, title, body, signer, read_at').eq('user_id', me.id).order('at', { ascending: false }).limit(30);
  if (!error) cache = data;
  return error ? null : data;
}
const nameOf = () => G.S?.avatar?.name || 'jogador';

export async function mine() {
  const d = box(); d.innerHTML = `<article class="ct">${head}<p class="muted">abrindo o arquivo...</p></article>`; if (!d.open) d.showModal();
  const list = await load();
  if (!list) { d.close(); return say('Entre na sua conta para ver as cartas do jurídico.', true); }
  d.innerHTML = `<article class="ct">${head}<h2 id="ct-t" class="ct__title">Suas cartas</h2>
    ${list.length ? `<ul class="ct__list">${list.map(c => `<li><button type="button" data-carta="${c.id}"><b>${esc(c.title)}</b><small>${proto(c)} · ${day(c.at)}${c.read_at ? '' : ' · <em>nova</em>'}</small></button></li>`).join('')}</ul>`
      : '<p class="muted">Nenhuma carta por aqui. Quando o jurídico precisar explicar algo da sua conta, a carta chega neste arquivo.</p>'}
    <div class="row ct__acts"><button class="btn btn--glass" type="button" data-close>fechar</button></div></article>`;
}

// carta nova: abre sozinha (nunca no meio de uma mão, corrida ou partida)
async function check() {
  if (document.visibilityState === 'hidden' || dlg?.open || document.querySelector('dialog[open]')) return;
  const list = await load(); const c = list?.find(x => !x.read_at);
  if (c) letter(c, nameOf());
}
setTimeout(check, 8000); setInterval(check, 180000);

document.addEventListener('click', e => {
  const b = e.target.closest('[data-carta]'); if (b) { const c = cache.find(x => String(x.id) === b.dataset.carta); if (c) letter(c, nameOf()); return; }
  if (e.target.closest('[data-carta-mine]')) { e.preventDefault(); mine(); }
  if (e.target.closest('[data-regras]')) { e.preventDefault(); rules(); }
  const t = e.target.closest('[data-rtab]'); if (t) rules(t.dataset.rtab);
});

// Lei do 21: regras de conduta (genéricas de propósito: não ensinar o que o jogo confere)
const LAW = [
  ['👥', 'Uma pessoa, uma conta', 'Nada de conta laranja nem "fazenda de contas". Na Operação Espelho, quem fez isso foi preso.', 'prisão da conta e confisco de tudo'],
  ['🤖', 'Nada de robô', 'Auto-clicker, macro ou script jogando no seu lugar.', 'bloqueio e investigação'],
  ['🐞', 'Achou bug? Avise, não use', 'Quem registra o B.O. não é punido.', 'a Receita estorna tudo que veio do bug'],
  ['📒', 'Todo dinheiro tem origem', 'O que entra no caixa precisa estar no livro-caixa.', 'estorno e análise da conta'],
  ['📈', 'Mesa de operações limpa', 'Não opere os dois lados ao mesmo tempo.', 'bloqueio da mesa'],
  ['🤝', 'Palavra e respeito', 'Golpe, calote e ofensa no chat dão B.O.', 'suspensão da conta'],
];
const STEPS = ['aviso', 'estorno', 'suspensão', 'prisão da conta'];
// regras e informações: abas (lei e vantagens; o conteúdo das vantagens vem do jogo, G.vguiaHTML em game.js)
const TABS = [['lei', '⚖️ lei do 21'], ['vantagens', '⚡ vantagens'], ['mudou', '📰 o que mudou']];
// "o que mudou": as reportagens do Jornal 21 (news.js), da mais nova para a mais antiga. Notícia nova entra aqui sozinha.
const dia = at => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
async function mudou() {
  const { EDITORIAL } = await import('./news.js'), now = Date.now();
  const list = EDITORIAL.filter(e => e.at <= now).sort((a, b) => b.at - a.at).slice(0, 25);
  return `<p class="ct__lead">Tudo o que mudou no 21 World, como saiu no Jornal 21. A mais nova primeiro.</p>
    <ol class="news-log">${list.map(e => `<li><time>${dia(e.at)}</time><b>${esc(e.title)}</b><p>${esc(e.lead.replace(/^Boa noite.s*/, ''))}</p></li>`).join('')}</ol>`;
}
export async function rules(tab = 'lei') {
  const d = box(), nav = `<nav class="rtabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-rtab="${k}" aria-selected="${k === tab}" class="${k === tab ? 'is-on' : ''}">${l}</button>`).join('')}</nav>`;
  if (tab === 'mudou') {
    d.innerHTML = `<article class="ct ct--law">${head}${nav}<h2 id="ct-t" class="ct__title">O que mudou</h2>${await mudou()}
      <div class="row ct__acts"><button class="btn btn--gold" type="button" data-close>fechar</button></div></article>`;
    if (!d.open) d.showModal(); d.scrollTop = 0; return;
  }
  if (tab === 'vantagens' && G.vguiaHTML) {
    d.innerHTML = `<article class="ct ct--law">${head}${nav}<h2 id="ct-t" class="ct__title">Guia das vantagens</h2>${G.vguiaHTML()}
      <div class="row ct__acts"><button class="btn btn--gold" type="button" data-close>fechar</button></div></article>`;
    if (!d.open) d.showModal(); d.scrollTop = 0; return;
  }
  d.innerHTML = `<article class="ct ct--law">${head}${nav}
    <h2 id="ct-t" class="ct__title">Lei do 21 World</h2>
    <p class="ct__lead">O que <b>não pode</b> no 21 World. Na dúvida, jogue limpo.</p>
    <ol class="law">${LAW.map(([i, t, no, pena], n) => `<li><span class="law__i" aria-hidden="true">${i}</span><div><b>Art. ${n + 1}º · ${t}</b><p>${no}</p><em>pena: ${pena}</em></div></li>`).join('')}</ol>
    <h3 class="law__h">Como funciona a punição</h3>
    <p class="law__steps">${STEPS.map(s => `<span>${s}</span>`).join('<i aria-hidden="true">›</i>')}</p>
    <p class="law__note">Quanto mais grave ou repetido, mais longe na escada.</p>
    <h3 class="law__h">Pode ficar tranquilo</h3>
    <ul class="law__ok"><li>Ganhar muito jogando certo não é crime.</li>
      <li>Se algo acontecer na sua conta, o jurídico explica por carta, em <b>perfil › jurídico</b>.</li></ul>
    <div class="row ct__acts"><button class="btn btn--gold" type="button" data-close>entendi as regras</button></div>
  </article>`;
  if (!d.open) d.showModal();
}
