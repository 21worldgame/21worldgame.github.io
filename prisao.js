// Prisão da Polícia Federal (supabase/prisao.sql): a conta presa não entra mais; na tela de entrar (ou no jogo aberto) aparece a cela,
// o que a investigação apurou e o espaço para confessar. Quem solta é o administrador, pela central.
import { $, esc } from './store.js';
import { avatarSVG } from './avatar.js';

// agente federal: avatar de terno + quepe azul-marinho com distintivo dourado
const CAP = '<g stroke="var(--ink-line)" stroke-width="2" stroke-linejoin="round"><path d="M64 46 C62 14 138 14 136 46 Z" fill="#0b1d3a"/><rect x="62" y="38" width="76" height="10" rx="2" fill="#13294f"/><path d="M62 47 Q100 58 138 47 L134 52 Q100 62 66 52 Z" fill="#05070d"/><path d="M100 20 l4 7 8 1 -6 5 2 8 -8 -4 -8 4 2 -8 -6 -5 8 -1 Z" fill="#facc15"/></g>';
export const copSVG = () => avatarSVG({ skin: 3, hair: 'raspado', beard: 'nenhuma', eyes: 1, outfit: 'terno', cloth: 1, acc: ['óculos escuros'] }, { label: 'agente da Polícia Federal' }).replace('</svg>', CAP + '</svg>');

// texto do processo: "- " vira item; "Pena:" fecha em destaque
const body = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l =>
  l.startsWith('- ') ? `<li>${esc(l.slice(2))}</li>` : /^Pena:/.test(l) ? `<p class="pf-fim">${esc(l)}</p>` : `<p>${esc(l)}</p>`)
  .join('').replace(/(<li>.*<\/li>)/s, '<ul class="pz-list">$1</ul>');

// p = { name, reason, at, confessou } (preso_info)
export function show(sb, email, p) {
  let d = $('#dlg-preso');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg-preso'; d.className = 'dlg dlg--pf dlg--preso'; d.setAttribute('aria-labelledby', 'pz-title'); document.body.append(d); }
  d.addEventListener('cancel', e => e.preventDefault());   // da cela não se sai com Esc
  const quando = p.at ? new Date(p.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  d.innerHTML = `<div class="pf-top"><span>🚨 POLÍCIA FEDERAL</span><span class="pf-top__live">CONTA PRESA</span></div>
    <div class="pf-stage pz-cela"><div class="pf-cop">${copSVG()}</div><div class="pf-say"><h2 id="pz-title">VOCÊ ESTÁ PRESO.</h2>
      <p><b>${esc(p.name || 'Detento')}</b>${quando ? `, detido em ${esc(quando)}` : ''}. Os bens estão apreendidos e a conta não entra mais.</p></div><i class="pz-grade" aria-hidden="true"></i></div>
    <div class="pf-body">${body(p.reason)}
      <form class="pz-conf" id="pz-form"${p.confessou ? ' hidden' : ''}>
        <label class="field"><span>Depoimento ao delegado</span><textarea class="input" name="msg" rows="3" maxlength="1500" required minlength="20" placeholder="Conte o que fez e como vai devolver os bens."></textarea></label>
        <label class="pz-ok"><input type="checkbox" name="ok" required> Assumo a fraude e devolvo todos os bens.</label>
        <p class="ad-err small" id="pz-err" hidden></p>
        <div class="br-acts"><button class="btn btn--gold" type="submit">entregar a confissão</button></div>
      </form>
      <p class="pz-done"${p.confessou ? '' : ' hidden'}>📄 Confissão entregue. O delegado vai analisar o seu caso e decidir a soltura.</p>
      <div class="br-acts"><button class="btn btn--glass" type="button" id="pz-out">sair</button></div></div>`;
  $('#pz-out').onclick = () => { d.close(); location.reload(); };
  $('#pz-form').onsubmit = async e => {
    e.preventDefault();
    const msg = e.target.msg.value.trim(), err = $('#pz-err');
    const { data, error } = await sb.rpc('preso_confessa', { p_email: email, p_msg: msg });
    if (error || data !== 'ok') { err.textContent = data === 'curta' ? 'Escreva um depoimento de verdade (pelo menos uma frase).' : data === 'espera' ? 'O delegado já recebeu um depoimento agora há pouco. Espere alguns minutos.' : 'O depoimento não chegou. Tente de novo.'; err.hidden = false; return; }
    e.target.hidden = true; d.querySelector('.pz-done').hidden = false;
  };
  if (!d.open) d.showModal();
}
// pergunta ao servidor se o e-mail está preso; se estiver, mostra a cela e devolve true
export async function check(sb, email) {
  if (!sb || !email) return false;
  try { const { data } = await sb.rpc('preso_info', { p_email: email }); if (data) { show(sb, email, data); return true; } } catch {}
  return false;
}
