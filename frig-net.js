// Frigoríficos dos jogadores abrem para os outros (frigorifico.sql). Sem servidor, nada aparece e o jogo segue igual.
// Quem abate num frigorífico de jogador paga a taxa do dono; o dono recebe taxa + couro mesmo desligado (fica guardado até ele abrir).
import * as Auth from './auth.js';
import * as AB from './abate.js';
import * as Live from './live.js';
import * as W from './world.js';
import { G, say, note, save, brl, int, profileOf } from './store.js';

export let plants = [];   // frigoríficos abertos de outros jogadores, com vagas do mês
const bucket = () => W.current(Live.world(), Live.now());   // o mês do mundo, igual ao servidor (world_month)
export async function refresh() {
  const sb = Auth.sbClient(); if (!sb) return;
  const { data, error } = await sb.from('abate_plant').select('owner, owner_name, fee, cap, used, bucket').eq('open', true);
  if (error) { plants = []; return; }
  const me = Auth.account()?.id, b = bucket();
  plants = data.filter(p => p.owner !== me).map(p => ({ ...p, left: p.cap - (Number(p.bucket) === b ? p.used : 0) }));
}
// o mais barato que ainda cabe o lote inteiro
export const options = heads => plants.filter(p => p.left >= heads).sort((a, b) => a.fee - b.fee || b.left - a.left);   // todos com vaga para o lote, mais barato primeiro
export const best = heads => options(heads)[0] || null;

// dono: publica taxa e se está aberto
export async function publish() {
  const sb = Auth.sbClient(), s = G.S; if (!sb || !Auth.account() || !s?.abate?.owned) return;
  await sb.rpc('set_abate', { p_name: profileOf().name, p_fee: s.abate.fee ?? AB.PLAYER.fee, p_open: s.abate.open ?? true });
}
export async function close() { const sb = Auth.sbClient(); if (sb && Auth.account()) await sb.rpc('close_abate'); }
// dono: recebe o que os outros pagaram
// Só no aparelho em uso e com o save já sincronizado: se outro aparelho gravasse logo depois do crédito, o dinheiro sumiria
// (a nuvem vence e o servidor já marcou como recebido). Por isso sincroniza antes e manda para a nuvem logo depois.
export async function claim() {
  const sb = Auth.sbClient(); if (!sb || !Auth.account() || document.visibilityState !== 'visible' || G.busy?.()) return;
  await Auth.push?.().catch(() => {});
  const { data, error } = await sb.rpc('claim_abate'); if (error) return;
  const r = data?.[0], pay = Number(r?.pay) || 0; if (!pay) return;
  G.S.money += pay; note(`frigorífico: ${int(r.heads)} bois de outros jogadores abatidos (taxa + couro)`, pay); save();
  await Auth.push?.().catch(() => {});
  say(`Seu frigorífico abateu ${int(r.heads)} bois de outros jogadores: ${brl(pay)} para você.`); G.render?.();
}
// abater um lote no frigorífico de outro jogador
export async function killAt(lotId, owner) {
  const s = G.S, h = s.herd.find(x => String(x.id) === String(lotId)); if (!h) return;   // o id chega da tela como texto
  const p = owner ? options(h.heads).find(x => x.owner === owner) : best(h.heads); if (!p) return say(owner ? 'Esse frigorífico não tem mais vaga para esse lote. Escolha outro.' : 'Nenhum frigorífico de jogador com vaga para esse lote agora.', true);
  const { data, error } = await Auth.sbClient().rpc('use_abate', { p_owner: p.owner, p_heads: h.heads, p_fee: p.fee, p_name: profileOf().name });
  if (error || data !== 'ok') { await refresh(); G.render?.(); return say(data === 'full' ? 'Esse frigorífico lotou este mês. Tente outro.' : data === 'fee' ? 'O dono mudou a taxa: confira o valor novo.' : 'Não deu para abater lá agora. Tente de novo.', true); }
  const r = AB.slaughterAt(s, h.id, p.fee);
  note(`abate de ${r.heads} bois no frigorífico de ${p.owner_name} (taxa ${brl(p.fee)}/cabeça)`, r.amount);
  p.left -= h.heads; save(); say(`Lote abatido no frigorífico de ${p.owner_name}: ${brl(r.amount)}.`); G.render?.();
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.matches?.('[data-ab-fee], [data-ab-open]')) return;
  const ab = AB.ensure(G.S);
  if (t.dataset.abFee != null) ab.fee = Number(t.value); else ab.open = t.checked;
  save(); publish(); say(ab.open === false ? 'Frigorífico fechado para outros jogadores.' : `Frigorífico aberto para outros jogadores a ${brl(ab.fee ?? AB.PLAYER.fee)} por cabeça.`);
});
const tick = () => { refresh(); claim(); publish(); };
setTimeout(tick, 6000); setInterval(tick, 60000);
