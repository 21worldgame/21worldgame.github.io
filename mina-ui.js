// Mina de ouro: vitrine na loja (empresas) e administração na aba negócios. Dono único guardado no servidor.
import * as MI from './mina.js';
import * as Auth from './auth.js';
import { payBar } from './negocios-ui.js';
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
  if (owner.ok && G.S.mina && owner.id !== me) { const v = MI.saleValue(G.S); G.S.money += v; note('mina de ouro saiu do seu nome: valor devolvido', v); delete G.S.mina; save(); say(`A mina de ouro não está mais no seu nome. Você recebeu ${brl(v)}.`, true); G.render(); }
  return owner;
}
setInterval(refresh, 30000); setTimeout(refresh, 3000);

// ---------- ouro ao vivo: onça (gold-api.com) x dólar (awesomeapi / open.er-api), de 10 em 10 min; sem internet vale o último preço guardado ----------
const LIVE_KEY = '21world.goldLive';
export const live = { oz: 0, fx: 0, at: 0, ok: false };
try { Object.assign(live, JSON.parse(localStorage.getItem(LIVE_KEY) || 'null') || {}, { ok: false }); } catch {}
const getJSON = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
export async function refreshGold() {
  try {
    const gold = await getJSON('https://api.gold-api.com/price/XAU');
    const fx = await getJSON('https://economia.awesomeapi.com.br/json/last/USD-BRL').then(d => Number(d.USDBRL.bid)).catch(() => getJSON('https://open.er-api.com/v6/latest/USD').then(d => Number(d.rates.BRL)));
    live.oz = Number(gold.price); live.fx = fx; live.at = Date.now(); live.ok = Number.isFinite(live.oz) && Number.isFinite(fx);
    if (live.ok) try { localStorage.setItem(LIVE_KEY, JSON.stringify({ oz: live.oz, fx, at: live.at })); } catch {}
  } catch { live.ok = false; }
  if (live.oz && G.S && MI.setSpot(G.S, live.oz, live.fx)) G.render?.();   // o preço do ouro no save acompanha o mercado real
}
setInterval(refreshGold, 600000); setTimeout(refreshGold, 2000);
const liveLine = () => !live.oz ? 'preço de reserva (sem internet)' : `US$ ${int(live.oz)} a onça × R$ ${live.fx.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = <b>R$ ${(live.oz / MI.OZ * live.fx).toFixed(0)}/g</b> · ${live.ok ? 'ao vivo' : 'último preço guardado'}${live.at ? `, atualizado há ${Math.max(0, Math.round((Date.now() - live.at) / 60000))} min` : ''}`;
const FLEET_ICO = { furar: '🔩', escavar: '🚜', carregar: '🏗️', transportar: '🚛' };
const mine = () => owner.ok && owner.id && owner.id === Auth.account()?.id && G.S.mina;

export function shopCard() {
  const s = G.S, taken = owner.ok && owner.id, isMe = mine();
  const status = !owner.loaded ? 'consultando o cartório…' : !owner.ok ? 'a mineradora está em vistoria: volta à venda em breve'
    : isMe ? 'é sua' : taken ? `dono atual: <b>${esc(owner.name || 'um jogador')}</b>` : '<b class="good">à venda: ninguém é dono</b>';
  return `<article class="glass mina-card${isMe ? ' is-own' : ''}"><div class="mina-photo" style="--img:url(assets/mina-ouro.webp)"><span class="mina-art mina-art--sm" aria-hidden="true">⛏️<span>Au</span></span></div>
    <div><span class="mina-tag">única no jogo inteiro</span><h3>${MI.MINE.name}</h3>
      <p class="muted small">Só existe uma mineradora no 21 World, com usina de ${int(MI.PLANT_T)} t por mês. Para minerar o dono precisa comprar a <b>frota na loja 21</b> (perfuratriz, escavadeira, pá-carregadeira e caminhões) e contratar equipes. Custos fixos de ${brl(MI.MINE.upkeep)} por mês + ${brl(MI.MINE.crew)} por equipe + diesel e explosivos por tonelada; paga CFEM e impostos sobre o ouro. O ouro é vendido pelo preço real do dia. Pode passar meses procurando veio. Quando acha um veio, cada mês de extração vale milhões.</p>
      <p class="small">${status}</p><p class="price">${brl(MI.MINE.price)}</p>
      ${!owner.ok || taken ? '' : Auth.account() ? `<button class="btn btn--gold" data-mina="buy">comprar a mineradora</button>` : '<p class="small bad">Entre com uma conta para comprar a mina.</p>'}</div></article>`;
}
export function ownCard() {
  if (!mine()) return '';
  const m = G.S.mina, gp = G.S.prices.ouro || MI.GOLD, f = MI.fleet(G.S), cap = MI.capacity(G.S), lack = MI.missing(G.S), grade = m.grade || 1.5;
  const fixed = MI.MINE.upkeep + m.crews * MI.MINE.crew, run = m.phase === 'extracao' && !lack.length && m.crews;
  const tons = run ? cap.t : 0, kg = run ? Math.min(m.vein, tons * grade * MI.RECOVERY / 1000) : 0, rev = kg * gp, varc = tons * MI.OPEX_T, roy = rev * MI.ROYALTY, net = rev - varc - roy - fixed;
  const link = (r, ok) => `<span class="mina-fl ${ok ? 'is-ok' : 'is-no'}" title="${esc(MI.ROLES[r])}">${FLEET_ICO[r]} ${esc(MI.ROLES[r])}: <b>${ok ? `${f.n[r]} (${int(f[r])} t/mês)` : 'falta'}</b></span>`;
  return `<article class="glass biz-own mina-own"><div class="mina-art mina-art--sm" aria-hidden="true">⛏️<span>Au</span></div><div class="biz-own__b"><h4>${MI.MINE.name} <small class="muted">mina de ouro · única no jogo</small></h4>
    ${payBar(m.last)}
    <div class="biz-kpis"><span><small>situação</small><b>${m.phase === 'extracao' ? (lack.length || !m.crews ? '<span class="bad">veio achado, mas parada</span>' : '<span class="good">extraindo ouro</span>') : !m.crews ? '<span class="bad">parada</span>' : !f.furar ? '<span class="bad">sem perfuratriz</span>' : 'sondando o terreno…'}</b></span>
      <span><small>veio atual</small><b>${m.phase === 'extracao' ? `${int(m.vein)} de ${int(m.total)} kg · ${String(grade).replace('.', ',')} g/t` : '—'}</b></span><span><small>ouro já extraído</small><b>${int(m.mined)} kg</b></span>
      <span><small>preço do ouro</small><b>${brl(gp)}/kg</b></span><span><small>custo fixo do mês</small><b class="bad">${brl(fixed)}</b></span><span><small>veios achados</small><b>${m.found}</b></span></div>
    <p class="small muted">🌍 ${liveLine()}</p>
    <h5 class="mina-h">logística da mina <small class="muted">(a produção segue o elo mais fraco)</small></h5>
    <div class="mina-fleet">${['furar', 'escavar', 'carregar', 'transportar'].map(r => link(r, !!f[r])).join('')}
      <span class="mina-fl ${m.crews ? 'is-ok' : 'is-no'}">👷 equipes: <b>${m.crews} (${int(m.crews * MI.CREW_T)} t/mês)</b></span><span class="mina-fl is-ok">🏭 usina: <b>${int(MI.PLANT_T)} t/mês</b></span></div>
    <p class="small ${lack.length ? 'bad' : 'good'}">${lack.length ? `Faltam máquinas para extrair: <b>${esc(lack.join(', '))}</b>. Compre na loja 21 (aba máquinas) e elas entram na mina sozinhas.` : `Capacidade de hoje: <b>${int(cap.t)} t de minério por mês</b>, limitada por ${esc(cap.limit)}. Para produzir mais, solte esse gargalo.`} <button class="btn btn--glass btn--sm" type="button" data-tab-go="loja">ir à loja</button></p>
    ${run ? `<table class="mina-dre"><caption class="small muted">estimativa do próximo mês (no teor de ${String(grade).replace('.', ',')} g/t, recuperação de ${Math.round(MI.RECOVERY * 100)}%)</caption>
      <tr><td>ouro vendido (${kg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg)</td><td class="good">+${brl(rev)}</td></tr><tr><td>diesel, explosivos, reagentes e desgaste (${int(tons)} t × ${brl(MI.OPEX_T)})</td><td class="bad">−${brl(varc)}</td></tr>
      <tr><td>CFEM (1,5%) e impostos (${(MI.ROYALTY * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</td><td class="bad">−${brl(roy)}</td></tr><tr><td>custos fixos e equipes</td><td class="bad">−${brl(fixed)}</td></tr>
      <tr class="is-tot"><td><b>resultado antes do IPVA e seguro da frota</b></td><td class="${net >= 0 ? 'good' : 'bad'}"><b>${net >= 0 ? '+' : '−'}${brl(Math.abs(net))}</b></td></tr></table>` : ''}
    <div class="row"><label class="field"><span>equipes de mineiros (0 a ${MI.MINE.maxCrews})</span><input class="input" type="range" min="0" max="${MI.MINE.maxCrews}" value="${m.crews}" id="mina-crews"></label><b id="mina-crews-n">${m.crews}</b>
      <button class="btn btn--gold btn--sm" data-mina="crews">contratar / dispensar</button><button class="btn btn--glass btn--sm" data-mina="sell">vender a mina (${brl(MI.saleValue(G.S))})</button></div>
    <p class="small muted">Cada equipe move até ${int(MI.CREW_T)} t por mês e aumenta a chance de achar um veio (cada perfuratriz sonda com até 6 equipes). A frota paga IPVA e seguro todo mês e desvaloriza. Sem dinheiro para os custos fixos, a mina continua cobrando: cuidado.</p></div></article>`;
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
