// Delegacia do 21 (supabase/delegacia.sql): registrar Boletim de Ocorrência contra outro jogador e acompanhar os seus.
// O B.O. cai na aba "delegacia" do painel admin; o denunciado não fica sabendo.
import * as Auth from './auth.js';
import { esc, say } from './store.js';

export const KINDS = { golpe: 'estelionato (golpe em negociação ou troca)', calote: 'calote (não pagou o combinado)', ofensa: 'injúria, ameaça ou assédio no chat',
  trapaca: 'fraude no jogo (bug, trapaça)', multiconta: 'contas falsas / laranjas', outro: 'outra ocorrência' };
const STATUS = { registrado: ['tag--dark', '📥 registrado', 'Aguardando a análise do delegado.'], investigando: ['tag--gold', '🔎 inquérito aberto', 'A investigação está em andamento.'],
  procedente: ['tag--red', '⚖️ procedente', 'O caso foi confirmado e providências foram tomadas.'], arquivado: ['tag--green', '🗄️ arquivado', 'As provas não bastaram para seguir com o caso.'] };
const ERR = { login: 'Entre na sua conta para registrar um B.O.', self: 'Você não pode registrar ocorrência contra si mesmo.', notarget: 'Esse jogador não foi encontrado.',
  short: 'Conte melhor o que aconteceu (pelo menos 30 letras).', limit: 'Você já registrou 3 boletins hoje. Volte amanhã.', open: 'Já existe um B.O. seu em andamento contra esse jogador.' };
export const proto = c => `${new Date(c.at || Date.now()).getFullYear()}/${String(c.id).padStart(6, '0')}`;

let dlg;
function box() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog'); dlg.className = 'dlg dlg--bo'; dlg.id = 'dlg-bo'; dlg.setAttribute('aria-labelledby', 'bo-t');
  document.body.append(dlg);
  dlg.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });
  return dlg;
}
const head = sub => `<button class="dlg__x btn btn--glass btn--sm" data-close>fechar</button>
  <div class="bo__head"><span class="bo__badge" aria-hidden="true">★</span><div><small>Polícia Civil do 21 World · Delegacia Virtual</small><h2 id="bo-t">${sub}</h2></div></div>`;

export function open(uid, name) {
  const d = box();
  if (!Auth.account()) return say(ERR.login, true);
  d.innerHTML = `${head('Boletim de Ocorrência')}
    <form class="bo__form" id="bo-form">
      <p class="bo__lead">Você está comunicando um fato à autoridade policial. O B.O. é sigiloso: <b>${esc(name)}</b> não será avisado(a).</p>
      <div class="bo__grid"><div class="bo__field"><span>noticiante</span><b>você</b></div><div class="bo__field"><span>investigado(a)</span><b>${esc(name)}</b></div></div>
      <label class="field"><span>natureza da ocorrência</span><select class="input" name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
      <label class="field"><span>quando aconteceu</span><input class="input" name="when" maxlength="60" placeholder="ex.: hoje à tarde, mês 14 do mundo"></label>
      <label class="field"><span>histórico: conte o que aconteceu</span><textarea class="input bo__ta" name="story" required minlength="30" maxlength="2000" rows="5" placeholder="Descreva o fato com o máximo de detalhes: o que foi combinado, o que ele(a) fez, valores envolvidos..."></textarea></label>
      <label class="field"><span>provas e evidências</span><textarea class="input bo__ta" name="proofs" maxlength="3000" rows="4" placeholder="Cole aqui mensagens do chat, valores de Pix, horários, links de prints (imgur, drive...), nomes de testemunhas."></textarea></label>
      <label class="check bo__oath"><input type="checkbox" name="oath" required> <span>Declaro que as informações são verdadeiras. Comunicar crime que não aconteceu também é crime (art. 340 do Código Penal) e a conta pode ser punida.</span></label>
      <div class="row"><button class="btn btn--danger" type="submit">🚔 registrar ocorrência</button><button class="btn btn--glass" type="button" data-bo-mine>meus boletins</button></div>
    </form>`;
  d.querySelector('#bo-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('[type=submit]'), sb = Auth.sbClient(); if (!sb) return say('Sem conexão com a delegacia agora.', true);
    btn.disabled = true; btn.textContent = 'enviando à delegacia...';
    const { data, error } = await sb.rpc('bo_registrar', { p_target: uid, p_kind: f.kind.value, p_when: f.when.value, p_story: f.story.value, p_proofs: f.proofs.value });
    if (error || !String(data).startsWith('ok:')) { btn.disabled = false; btn.textContent = '🚔 registrar ocorrência'; return say(ERR[data] || 'A delegacia não recebeu o B.O. agora. Tente de novo.', true); }
    done({ id: Number(String(data).slice(3)), at: new Date().toISOString() }, name, f.kind.value);
  });
  if (!d.open) d.showModal();
}

function done(c, name, kind) {
  dlg.innerHTML = `${head('Ocorrência registrada')}
    <div class="bo__done">
      <div class="bo__stamp" aria-hidden="true">REGISTRADO</div>
      <p class="muted small">Boletim de Ocorrência nº</p><p class="bo__num">${proto(c)}</p>
      <p>Recebemos a sua comunicação de <b>${esc(KINDS[kind] || kind)}</b>.</p>
      <p class="bo__lead">O delegado de plantão vai analisar o relato e as provas e <b>abrir uma investigação sobre ${esc(name)}</b>. Os fatos serão apurados com sigilo: o jogo guarda o histórico de Pix, negociações e movimentações de cada conta.</p>
      <p class="muted small">Acompanhe o andamento em "meus boletins". Guarde o número do protocolo.</p>
      <div class="row"><button class="btn btn--gold" type="button" data-bo-mine>acompanhar meus boletins</button><button class="btn btn--glass" type="button" data-close>voltar ao jogo</button></div>
    </div>`;
}

export async function mine() {
  const d = box(), sb = Auth.sbClient();
  if (!Auth.account() || !sb) return say(ERR.login, true);
  d.innerHTML = `${head('Meus boletins')}<p class="muted">consultando a delegacia...</p>`;
  if (!d.open) d.showModal();
  const { data, error } = await sb.from('bo_casos').select('id, at, target_name, kind, status, note, updated_at').eq('author', Auth.account().id).order('at', { ascending: false }).limit(30);
  d.innerHTML = `${head('Meus boletins')}${error ? '<p class="muted">A delegacia está fechada agora. Tente mais tarde.</p>' : !data.length ? '<p class="muted">Você não registrou nenhuma ocorrência.</p>'
    : `<ul class="bo__list">${data.map(c => { const s = STATUS[c.status] || STATUS.registrado; return `<li><div><b>B.O. nº ${proto(c)}</b> <span class="tag ${s[0]}">${s[1]}</span><br>
      <small class="muted">contra ${esc(c.target_name)} · ${esc(KINDS[c.kind] || c.kind)} · ${new Date(c.at).toLocaleDateString('pt-BR')}</small>
      <p class="small">${c.note ? `<b>Delegado:</b> “${esc(c.note)}”` : esc(s[2])}</p></div></li>`; }).join('')}</ul>`}`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-bo]'); if (b) { e.preventDefault(); open(b.dataset.bo, b.dataset.name || 'jogador'); return; }
  if (e.target.closest('[data-bo-mine]')) { e.preventDefault(); mine(); }
});
