// Mina de ouro: vitrine na loja (empresas) e administração na aba negócios. Dono único guardado no servidor.
import * as MI from './mina.js';
import * as Auth from './auth.js';
import { G, $, esc, brl, int, say, save, note, confetti, profileOf } from './store.js';

let owner = { loaded: false, ok: false, id: null, name: null, since: null };
export async function refresh() {
  const sb = Auth.sbClient(); if (!sb) { owner = { loaded: true, ok: false }; return owner; }
  try {
    const { data, error } = await sb.from('gold_mine').select('owner, owner_name, since').eq('id', 1).maybeSingle();
    owner = error ? { loaded: true, ok: false } : { loaded: true, ok: true, id: data?.owner || null, name: data?.owner_name || null, since: data?.since || null };
  } catch { owner = { loaded: true, ok: false }; }
  // a mina foi parar em outra mão (admin liberou, outro aparelho vendeu): o save local acompanha
  const me = Auth.account()?.id;
  if (owner.ok && G.S.mina && owner.id !== me) { delete G.S.mina; save(); say('A mina de ouro não está mais no seu nome.', true); G.render(); }
  return owner;
}
setInterval(refresh, 30000); setTimeout(refresh, 3000);
const mine = () => owner.ok && owner.id && owner.id === Auth.account()?.id && G.S.mina;

export function shopCard() {
  const s = G.S, taken = owner.ok && owner.id, isMe = mine();
  const status = !owner.loaded ? 'consultando o cartório…' : !owner.ok ? 'a mineradora está em vistoria: volta à venda em breve'
    : isMe ? 'é sua' : taken ? `dono atual: <b>${esc(owner.name || 'um jogador')}</b>` : '<b class="good">à venda: ninguém é dono</b>';
  return `<article class="glass mina-card${isMe ? ' is-own' : ''}"><div class="mina-photo" style="--img:url(assets/mina-ouro.webp)"><span class="mina-art mina-art--sm" aria-hidden="true">⛏️<span>Au</span></span></div>
    <div><span class="mina-tag">única no jogo inteiro</span><h3>${MI.MINE.name}</h3>
      <p class="muted small">Só existe uma mineradora no 21 World. O dono contrata as equipes, banca a manutenção altíssima (${brl(MI.MINE.upkeep)} por mês + ${brl(MI.MINE.crew)} por equipe) e pode passar meses procurando. Quando acha um veio, cada mês de extração vale milhões.</p>
      <p class="small">${status}</p><p class="price">${brl(MI.MINE.price)}</p>
      ${!owner.ok || taken ? '' : Auth.account() ? `<button class="btn btn--gold" data-mina="buy">comprar a mineradora</button>` : '<p class="small bad">Entre com uma conta para comprar a mina.</p>'}</div></article>`;
}
export function ownCard() {
  if (!mine()) return '';
  const m = G.S.mina, gp = G.S.prices.ouro || MI.GOLD, cost = MI.MINE.upkeep + m.crews * MI.MINE.crew;
  return `<article class="glass biz-own mina-own"><div class="mina-art mina-art--sm" aria-hidden="true">⛏️<span>Au</span></div><div class="biz-own__b"><h4>${MI.MINE.name} <small class="muted">mina de ouro · única no jogo</small></h4>
    <div class="biz-kpis"><span><small>situação</small><b>${m.phase === 'extracao' ? `<span class="good">extraindo ouro</span>` : m.crews ? 'procurando veio…' : '<span class="bad">parada</span>'}</b></span>
      <span><small>veio atual</small><b>${m.phase === 'extracao' ? `${int(m.vein)} de ${int(m.total)} kg` : '—'}</b></span><span><small>ouro já extraído</small><b>${int(m.mined)} kg</b></span>
      <span><small>preço do ouro</small><b>${brl(gp)}/kg</b></span><span><small>custo do mês</small><b class="bad">${brl(cost)}</b></span><span><small>veios achados</small><b>${m.found}</b></span></div>
    <div class="row"><label class="field"><span>equipes de mineiros (0 a ${MI.MINE.maxCrews})</span><input class="input" type="range" min="0" max="${MI.MINE.maxCrews}" value="${m.crews}" id="mina-crews"></label><b id="mina-crews-n">${m.crews}</b>
      <button class="btn btn--gold btn--sm" data-mina="crews">contratar / dispensar</button><button class="btn btn--glass btn--sm" data-mina="sell">vender a mina (${brl(MI.saleValue(G.S))})</button></div>
    <p class="small muted">Cada equipe aumenta a chance de achar um veio por mês e extrai ~${MI.KG_PER_CREW} kg por mês quando acha. Sem dinheiro para a manutenção, a mina continua cobrando: cuidado.</p></div></article>`;
}
document.addEventListener('input', e => { if (e.target.id === 'mina-crews') $('#mina-crews-n').textContent = e.target.value; });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mina]'); if (!b) return;
  const s = G.S, a = b.dataset.mina, sb = Auth.sbClient();
  if (a === 'buy') {
    if (s.money < MI.MINE.price) return say(`Você precisa de ${brl(MI.MINE.price)} para comprar a mineradora.`, true);
    if (!confirm(`Comprar a ${MI.MINE.name} por ${brl(MI.MINE.price)}? É a única do jogo; a manutenção é de ${brl(MI.MINE.upkeep)} por mês.`)) return;
    b.disabled = true;
    const { data, error } = await sb.rpc('claim_gold_mine', { p_name: profileOf().name });
    if (error || data !== 'ok') { b.disabled = false; await refresh(); G.render(); return say(data === 'taken' ? 'Alguém comprou a mina antes de você!' : 'Não deu para registrar a mina agora. Tente de novo.', true); }
    const err = MI.buy(s); if (err) { await sb.rpc('release_gold_mine'); return say(err[0].toUpperCase() + err.slice(1), true); }
    note(`compra da ${MI.MINE.name}`, -MI.MINE.price); confetti(200); say('A única mina de ouro do 21 World agora é sua! Contrate equipes na aba negócios.');
    await refresh(); save(); G.render(); return;
  }
  if (a === 'crews') { MI.setCrews(s, Number($('#mina-crews').value)); save(); say(`Agora são ${s.mina.crews} equipes na mina.`); G.render(); return; }
  if (a === 'sell') {
    if (!confirm(`Vender a mina por ${brl(MI.saleValue(s))}? Ela volta a ficar à venda para todo mundo.`)) return;
    const { data } = await sb.rpc('release_gold_mine');
    if (data !== 'ok' && data !== 'not-owner') return say('Não deu para registrar a venda agora.', true);
    const v = MI.sell(s); note(`venda da ${MI.MINE.name}`, v); say(`Mina vendida por ${brl(v)}. Ela está à venda de novo para o jogo inteiro.`); await refresh(); save(); G.render();
  }
});
