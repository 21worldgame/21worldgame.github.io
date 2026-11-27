// Diário do jogador para o painel admin (diario.sql; o jogador não vê).
// Cada lançamento do livro-caixa vai para o servidor com a hora, a tela, os botões clicados e o saldo.
// E o dinheiro ou as fichas que mudaram SEM lançamento viram uma linha "sem lançamento": é ali que aparece o furo do jogo.
import * as L from './logic.js';

const clicks = [];   // botões clicados desde o último envio
export const mark = txt => { clicks.push(txt); if (clicks.length > 300) clicks.shift(); };
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const b = e.target.closest?.('button, a, [data-act], [role="button"]'); if (!b) return;
  const d = b.dataset || {}, k = Object.keys(d)[0];
  mark(d.act ? `${d.act}${d.id ? `:${String(d.id).slice(0, 12)}` : ''}` : k ? `${k}=${String(d[k]).slice(0, 16)}` : (b.textContent || '').trim().slice(0, 24) || b.tagName.toLowerCase());
}, true);

// "rl-spin x8, buy-chips" (na ordem, repetidos juntos)
export function summarize(list) {
  const out = [];
  for (const a of list) { const l = out.at(-1); if (l?.a === a) l.n++; else out.push({ a, n: 1 }); }
  return out.map(x => (x.n > 1 ? `${x.a} x${x.n}` : x.a)).join(', ').slice(0, 1500);
}

let queue = [], seen = new WeakSet(), jr = null;   // fora do save: marcar os lançamentos atrapalharia a junção de dois aparelhos
// a fila vive na memória: recarregar a página antes do envio perdia os lançamentos (jhonatas 27/11 17:21: os 2 abates de R$ 19 mi
// sumiram do diário e a central acusou "salto sem lançamento"). Guarda na aba ao sair e retoma ao abrir.
// ponytail: se o envio da página velha terminar depois do pagehide, a linha entra 2x (raro); id por linha se aparecer.
const QK = '21world.diarioq';
try { const q = JSON.parse(sessionStorage.getItem(QK) || '[]'); if (Array.isArray(q)) queue = q.slice(-3000); sessionStorage.removeItem(QK); } catch {}
const keep = () => { try { queue.length ? sessionStorage.setItem(QK, JSON.stringify(queue.slice(-3000))) : sessionStorage.removeItem(QK); } catch {} };
if (typeof addEventListener !== 'undefined') { addEventListener('pagehide', keep); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keep(); }); }
const row = (s, kind, txt, val, base) => ({ ...base, uid: jr?.uid, m: s.month || 0, kind, txt, val });
function snap(s, now, tab) {
  const money = Math.round(Number(s.money) || 0), chips = Math.round(Number(s.chips) || 0);
  let worth = 0; try { worth = Math.round(L.netWorth(s)); } catch {}
  return { money, chips, base: { at: new Date(now).toISOString(), money, chips, worth, tab: String(tab).slice(0, 30), acts: summarize(clicks.splice(0)) } };
}
// começo de sessão ou save trocado (nuvem, outro aparelho): o que já está no livro conta como visto e anota o saldo
// (o painel compara com a linha anterior: dinheiro que mudou entre uma sessão e outra também aparece)
// mês em que o save abriu, antes de o jogo rodar os meses que passaram com ele fechado (colheita, venda automática...)
let loadM = null;
export const atLoad = m => { if (loadM == null && m != null) loadM = m; };
export function rebase(s, why = 'abriu o jogo', now = Date.now(), tab = '', uid = jr?.uid) {
  // abertura: o que entrou nesses meses vai junto (antes ficava como "já visto" e o painel acusava salto de dinheiro sem lançamento)
  // e o que foi lançado desde que a página abriu (aposta do trader resolvida no carregamento cai no mesmo mês do save:
  // Light Yagami 26/11 16:52, R$ 17 mi apareceram como "salto sem lançamento")
  const t0 = typeof performance !== 'undefined' ? performance.timeOrigin : Infinity;
  const late = why === 'abriu o jogo' ? (s.log || []).filter(e => e && typeof e === 'object' && ((loadM != null && (Number(e.m) || 0) > loadM) || Number(e.at) >= t0)) : [];
  loadM = Infinity;
  for (const e of s.log || []) if (e && typeof e === 'object') seen.add(e);
  const { money, chips, base } = snap(s, now, tab), sum = late.reduce((t, e) => t + Math.round(Number(e.val) || 0), 0);
  // ok: retrato do save que abriu (não é ação deste aparelho que possa ser descartada)
  jr = { money, chips, uid }; queue.push({ ...row(s, 'inicio', why, 0, base), money: money - sum, ok: true });   // saldo de quando abriu
  for (const e of [...late].reverse()) queue.push({ ...row(s, 'log', String(e.txt || '').slice(0, 300), Math.round(Number(e.val) || 0), base), m: e.m ?? s.month ?? 0, ok: true });
}
// o que é novo desde a última vez, e confere o caixa: tudo que mudou tem que estar no livro-caixa
export function take(s, uid, now = Date.now(), tab = typeof location !== 'undefined' ? location.hash.slice(1) : '') {
  if (!jr || jr.uid !== uid) return rebase(s, 'abriu o jogo', now, tab, uid);   // entrou (ou trocou de conta)
  const fresh = (s.log || []).filter(e => e && typeof e === 'object' && !seen.has(e));
  if (!fresh.length && Math.round(Number(s.money) || 0) === jr.money && Math.round(Number(s.chips) || 0) === jr.chips) return [];
  const { money, chips, base } = snap(s, now, tab);
  const rows = [...fresh].reverse().map(e => ({ ...row(s, 'log', String(e.txt || '').slice(0, 300), Math.round(Number(e.val) || 0), base), m: e.m ?? s.month ?? 0 }));
  const gap = money - jr.money - rows.reduce((t, r) => t + r.val, 0), dc = chips - jr.chips;
  if (Math.abs(gap) >= 100) rows.push(row(s, 'gap', `dinheiro mudou sem lançamento (${gap > 0 ? '+' : ''}${gap.toLocaleString('pt-BR')})`, gap, base));
  if (dc) rows.push(row(s, 'fichas', `fichas ${dc > 0 ? '+' : ''}${dc.toLocaleString('pt-BR')} (agora ${chips.toLocaleString('pt-BR')})`, Math.round(dc * L.CHIP), base));
  for (const e of fresh) seen.add(e);
  jr = { money, chips, uid };
  queue.push(...rows); if (queue.length > 3000) queue = queue.slice(-3000);   // ponytail: sem internet por muito tempo perde o mais antigo
  return rows;
}
export const pending = () => queue.length;
// o save gravou na nuvem: o que está na fila aconteceu de verdade
export const confirm = () => { for (const r of queue) r.ok = true; };
// este aparelho descartou o que fez e ficou com a nuvem (outro aparelho fechou o mesmo mês): o que não gravou não aconteceu
// (Light Yagami 27/11: dois aparelhos fechavam o mesmo mês e a receita da Viva Fibra entrava 2x no diário, não no caixa)
export const discard = () => { queue = queue.filter(r => r.ok); };
// manda a fila (depois que o save gravou); se falhar, tenta de novo no próximo save
let sending = false;
export async function flush(sb, uid) {
  if (sending || !queue.length || !sb || !uid) return;
  sending = true;
  const part = queue.filter(r => r.uid === uid).slice(0, 500); if (!part.length) { sending = false; return; }
  try { const { error } = await sb.from('diario').insert(part.map(({ uid: u, ok, ...r }) => ({ user_id: u, ...r }))); if (!error) queue = queue.filter(r => !part.includes(r)); }
  catch {} finally { sending = false; }
}
