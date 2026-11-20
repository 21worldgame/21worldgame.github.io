// Tela do futebol: escolher clube real, elenco, escalação, mercado com negociação, propostas, estádio, tabela e jogo ao vivo.
import * as FT from './futebol.js';
import { G, $, esc, brl, int, say, save, note, award, confetti, ms } from './store.js';
import * as Live from './live.js';
import * as sfx from './sfx.js';
import { openDeal } from './deal-ui.js';

let view = 'jogo', playing = false, pickDiv = 2;
const f = () => G.S.fut;
const crest = (c, size = 'md') => `<span class="crest crest--${size}" style="--c1:${c?.[0] || '#444'};--c2:${c?.[1] || '#ddd'}" aria-hidden="true"></span>`;
const colorsOf = name => FT.club(name)?.c;

export function render() {
  const has = !!f()?.club;
  $('#ft-found').hidden = has; $('#ft-club').hidden = !has;
  if (!has) return renderPick();
  const c = f(), st = FT.standings(c.league), me = st.findIndex(t => t.user) + 1, lg = c.league;
  const str = FT.strength(c.squad, c.formation, c.style, c.morale || 0, c.xi);
  $('#ft-name').innerHTML = `${crest(c.colors || colorsOf(c.club), 'lg')}${esc(c.club)}`;
  $('#ft-sub').textContent = `${FT.DIVS[c.div]}, temporada ${c.season}, rodada ${Math.min(lg.round + 1, lg.fixtures.length)} de ${lg.fixtures.length}, ${me}º lugar`;
  const mor = c.morale || 0;
  $('#ft-kpis').innerHTML = [['força do time', Math.round(str.ovr)], ['ataque', Math.round(str.att)], ['defesa', Math.round(str.def)], ['moral', mor > 0 ? `+${mor} em alta` : mor < 0 ? `${mor} em baixa` : 'normal'],
    ['folha mensal', brl(FT.payroll(c))], ['estádio', `nível ${c.stadium || 1}`], ['ganho no clube', brl(c.earned)], ['títulos', c.trophies]]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  const offers = (c.offers || []).length;
  document.querySelectorAll('[data-ftv]').forEach(b => { b.classList.toggle('is-on', b.dataset.ftv === view); if (b.dataset.ftv === 'propostas') b.dataset.badge = offers || ''; });
  document.querySelectorAll('[data-ftpanel]').forEach(p => { p.hidden = p.dataset.ftpanel !== view; });
  ({ jogo: renderNext, elenco: renderSquad, tabela: renderTable, mercado: renderMarket, propostas: renderOffers })[view]?.();
}
export function setView(v) { view = v; render(); }
export function setPickDiv(d) { pickDiv = Number(d); renderPick(); }

function renderPick() {
  document.querySelectorAll('[data-ftdiv]').forEach(b => b.classList.toggle('is-on', Number(b.dataset.ftdiv) === pickDiv));
  $('#ft-clubs').innerHTML = FT.CLUBS[pickDiv].map(c => {
    const price = FT.clubPrice(c.n), ok = G.S.money >= price;
    return `<button class="clubcard glass${ok ? '' : ' is-locked'}" data-act="ft-take" data-id="${esc(c.n)}" style="--c1:${c.c[0]};--c2:${c.c[1]}">
      ${crest(c.c)}<span class="clubcard__name">${esc(c.n)}</span><span class="clubcard__r">força ${c.r}</span><b>${brl(price)}</b></button>`;
  }).join('');
}

function renderNext() {
  const c = f(), lg = c.league;
  const done = lg.round >= lg.fixtures.length;
  $('#ft-next').innerHTML = done
    ? `<p class="big-line">Temporada encerrada.</p><button class="btn btn--gold btn--lg" data-act="ft-season">fechar a temporada e receber o prêmio</button>`
    : (() => {
      const [h, a] = lg.fixtures[lg.round].find(g => g.includes('user'));
      const t = id => lg.teams.find(x => x.id === id);
      const col = id => (id === 'user' ? c.colors || colorsOf(c.club) : t(id).colors);
      const out = c.squad.filter(p => p.inj || p.sus);
      return `<div class="fx"><span>${crest(col(h))}${esc(t(h).name)}</span><b>x</b><span>${crest(col(a))}${esc(t(a).name)}</span></div>
        <p class="muted small">${h === 'user' ? 'Jogo em casa: a bilheteria entra para você.' : 'Jogo fora de casa.'}${out.length ? ` Desfalques: ${out.map(p => `${esc(p.name)} (${p.sus ? 'suspenso' : 'lesionado'})`).join(', ')}.` : ''}</p>
        <div class="row"><label class="field"><span>formação</span><select class="input" id="ft-form">${Object.keys(FT.FORMATIONS).map(x => `<option ${x === c.formation ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="field"><span>estilo</span><select class="input" id="ft-style">${Object.keys(FT.STYLES).map(x => `<option value="${x}" ${x === c.style ? 'selected' : ''}>${x === 'contra' ? 'contra-ataque' : x}</option>`).join('')}</select></label></div>
        <div class="row"><button class="btn btn--gold btn--lg" data-act="ft-play" ${playing ? 'disabled' : ''}>assistir ao jogo</button>
          <button class="btn btn--glass" data-act="ft-quick" ${playing ? 'disabled' : ''}>simular rápido</button></div>
        <div class="ft-stadium"><span>Estádio nível ${c.stadium || 1} de ${FT.STADIUM_MAX}: cada nível aumenta a bilheteria em 20%.</span>
          ${(c.stadium || 1) < FT.STADIUM_MAX ? `<button class="btn btn--glass btn--sm" data-act="ft-stadium">ampliar por ${brl(FT.stadiumCost(c))}</button>` : ''}</div>`;
    })();
  $('#ft-pitch').innerHTML = pitch(c);
  $('#ft-last').innerHTML = lg.results?.length ? `<h3>resultados da última rodada</h3><ul class="ft-res">${lg.results.map(g => `<li class="${g.h === 'user' || g.a === 'user' ? 'is-mine' : ''}"><span>${esc(g.hn)}</span><b>${g.hg} x ${g.ag}</b><span>${esc(g.an)}</span></li>`).join('')}</ul>` : '';
}

function pitch(c) {
  const l = FT.lineup(c.squad, c.formation, c.xi), col = c.colors || colorsOf(c.club) || ['#c8102e', '#fff'];
  const row = (sec, y) => l[sec].map((p, i) => `<button class="ply${p?.off ? ' is-off' : ''}${c.xi?.[sec + i] ? ' is-fixed' : ''}" type="button" data-act="ft-slot" data-id="${sec}${i}" style="left:${((i + 1) / (l[sec].length + 1)) * 100}%;top:${y}%;--c1:${col[0]};--c2:${col[1]}" title="trocar">
    <b>${p ? Math.round(p.ovr) : '?'}</b><small>${p ? esc(p.name.split(' ')[0]) : 'vazio'}</small></button>`).join('');
  return `<div class="pitch">${row('att', 16)}${row('mid', 44)}${row('def', 70)}${row('gk', 90)}</div>
    <p class="muted small ft-pitch-tip">Toque num jogador para trocar. Fora da posição ele rende 85%. ${c.xi && Object.keys(c.xi).length ? '<button class="btn btn--glass btn--sm" data-act="ft-auto">escalação automática</button>' : ''}</p>`;
}
let pickSlot = null;
export function openSlot(slot) {
  const c = f(), sec = slot.replace(/\d+$/, ''), cur = FT.lineup(c.squad, c.formation, c.xi);
  const inXI = new Set([...cur.gk, ...cur.def, ...cur.mid, ...cur.att].filter(Boolean).map(p => p.id));
  const fit = p => ({ gk: ['GOL'], def: ['ZAG', 'LAT'], mid: ['VOL', 'MEI'], att: ['ATA'] }[sec].includes(p.pos));
  pickSlot = slot;
  $('#sl-title').textContent = `escolher ${FT.SECTOR_LABEL[sec]}`;
  $('#sl-list').innerHTML = [...c.squad].sort((a, b) => fit(b) - fit(a) || b.ovr - a.ovr).map(p => {
    const outp = p.inj || p.sus;
    return `<li><button class="sl-p${fit(p) ? '' : ' is-off'}" data-act="ft-pick" data-id="${p.id}" ${outp ? 'disabled' : ''}>
      <span class="posb posb--${p.pos}">${p.pos}</span><span>${esc(p.name)}${inXI.has(p.id) ? ' <small class="muted">(titular)</small>' : ''}${outp ? ` <small class="bad">${p.sus ? 'suspenso' : 'lesionado'}</small>` : ''}</span>
      <b>${fit(p) ? p.ovr : Math.round(p.ovr * 0.85)}</b></button></li>`;
  }).join('');
  $('#dlg-slot').showModal();
}
export function pick(id) {
  const err = FT.setSlot(f(), pickSlot, id);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  $('#dlg-slot').close(); save(); render();
}
export function autoXI() { f().xi = {}; save(); render(); say('Escalação automática: os melhores de cada posição.'); }
function renderSquad() {
  const c = f(), order = Object.keys(FT.POS);
  $('#ft-squad').innerHTML = [...c.squad].sort((a, b) => order.indexOf(a.pos) - order.indexOf(b.pos) || b.ovr - a.ovr).map(p => `<tr>
    <td><span class="posb posb--${p.pos}">${p.pos}</span></td><td>${esc(p.name)}${p.trait ? ` <span class="muted small">${esc(p.trait)}</span>` : ''}${p.inj ? ' <span class="tag tag--red">lesionado</span>' : ''}${p.sus ? ' <span class="tag tag--red">suspenso</span>' : ''}</td><td class="num">${p.age}</td>
    <td class="num"><strong>${p.ovr}</strong></td><td class="num">${p.pot}</td><td class="num">${brl(p.sal)}</td><td class="num">${brl(FT.value(p))}</td>
    <td class="acts"><button class="btn btn--glass btn--sm" data-act="ft-sell" data-id="${p.id}">vender ${brl(Math.round(FT.value(p) * 0.8))}</button></td></tr>`).join('');
}
function renderTable() {
  const lg = f().league, st = FT.standings(lg), z = FT.zone(lg), n = st.length;
  $('#ft-table').innerHTML = st.map((t, i) => `<tr class="${t.user ? 'is-mine' : ''} ${i < z ? 'is-up' : i >= n - z ? 'is-down' : ''}"><td class="num">${i + 1}</td><td>${crest(t.user ? f().colors || colorsOf(f().club) : t.colors, 'sm')}${esc(t.name)}</td>
    <td class="num">${t.p}</td><td class="num">${t.w}</td><td class="num">${t.d}</td><td class="num">${t.l}</td><td class="num">${t.gf}:${t.ga}</td><td class="num"><strong>${t.pts}</strong></td></tr>`).join('');
  $('#ft-hist').innerHTML = f().history.length ? f().history.map(h => `<li>Temporada ${h.season}, ${FT.DIVS[h.div]}: ${h.pos}º lugar, ${h.pts} pontos, prêmio ${brl(h.prize)}</li>`).join('') : '<li class="muted">Primeira temporada.</li>';
}
function renderMarket() {
  $('#ft-market').innerHTML = f().market.map(p => `<tr><td><span class="posb posb--${p.pos}">${p.pos}</span></td><td>${esc(p.name)} <span class="muted small">${esc(p.club || '')}${p.trait ? `, ${esc(p.trait)}` : ''}</span></td><td class="num">${p.age}</td>
    <td class="num"><strong>${p.ovr}</strong></td><td class="num">${p.pot}</td><td class="num">${brl(p.sal)}</td>
    <td class="acts"><button class="btn btn--glass btn--sm" data-act="ft-haggle" data-id="${p.id}">negociar</button><button class="btn btn--gold btn--sm" data-act="ft-buy" data-id="${p.id}">pagar ${brl(p.price)}</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Mercado vazio até a próxima temporada.</td></tr>';
}
function renderOffers() {
  const c = f(), os = c.offers || [];
  $('#ft-offers').innerHTML = os.length ? os.map(o => {
    const p = c.squad.find(x => x.id === o.pid);
    return `<article class="glass offer"><div>${crest(colorsOf(o.club))}<strong>${esc(o.club)}</strong> quer <strong>${esc(o.name)}</strong>${p ? ` (${p.pos}, nota ${p.ovr})` : ''}</div>
      <p>Oferta: <b class="good">${brl(o.amount)}</b> <span class="muted small">valor de mercado ${p ? brl(FT.value(p)) : '?'}. Vale até a rodada ${o.until}.</span></p>
      <div class="row"><button class="btn btn--gold btn--sm" data-act="ft-offer-yes" data-id="${o.id}">aceitar</button><button class="btn btn--glass btn--sm" data-act="ft-offer-no" data-id="${o.id}">recusar</button></div></article>`;
  }).join('') : '<p class="empty glass">Nenhuma proposta agora. Clubes fazem ofertas pelos seus melhores jogadores durante a temporada. Para negociar com outros jogadores, use a aba inventário (troca ao vivo).</p>';
}

export function take(name) {
  const err = FT.takeClub(G.S, name);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  note(`assumiu o ${name}`, -FT.clubPrice(name));
  note(`patrocínio da temporada`, FT.SPONSOR[G.S.fut.div]);
  award('ftFound'); confetti(80); sfx.play('stack', 0.7);
  say(`Você é o novo presidente do ${name}! O patrocínio de ${brl(FT.SPONSOR[G.S.fut.div])} já entrou.`);
  view = 'jogo';
}
export function buy(id, price) {
  const p = f().market.find(x => x.id === id); if (!p) return;
  const err = FT.buy(G.S, id, price);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  note(`contratação de ${p.name}`, -(price ?? p.price)); say(`${p.name} contratado.`); sfx.play('stack', 0.5);
}
export function haggle(id) {
  const c = f(), p = c.market.find(x => x.id === id); if (!p) return;
  openDeal({ title: `${p.name}, ${FT.POS[p.pos]} nota ${p.ovr}`, sub: `Dono do passe: ${p.club}. Preço pedido ${brl(p.price)}.`, who: p.club, deal: FT.dealFor(c, id),
    onDone: price => { if (price) { buy(id, price); save(); G.render(); } } });
}
export function sell(id) {
  const p = f().squad.find(x => x.id === id);
  if (!confirm(`Vender ${p.name} por ${brl(Math.round(FT.value(p) * 0.8))}? Propostas de clubes costumam pagar mais.`)) return;
  const v = FT.sell(G.S, id);
  if (v < 0) return say('O clube precisa de pelo menos 14 jogadores. Para vender todos, venda o clube inteiro no inventário.', true);
  note(`venda de ${p.name}`, v); say(`${p.name} vendido.`);
}
export function answer(id, yes) {
  const r = FT.answerOffer(G.S, id, yes);
  if (r.err) return say(r.err[0].toUpperCase() + r.err.slice(1), true);
  if (yes) { note(`venda de ${r.offer.name} ao ${r.offer.club}`, r.amount); say(`${r.offer.name} vendido ao ${r.offer.club} por ${brl(r.amount)}.`); sfx.play('stack', 0.6); }
}
export function stadium() {
  const cost = FT.stadiumCost(f()), err = FT.upgradeStadium(G.S);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  note('ampliação do estádio', -cost); confetti(40); say(`Estádio ampliado para o nível ${f().stadium}.`);
}
export function seasonEnd() {
  const r = FT.endSeason(G.S, Math.random, Live.CFG.prize_mult || 1);
  note(`fim da temporada: ${r.pos}º lugar`, r.prize);
  note('patrocínio da temporada', r.sponsor);
  if (r.pos === 1) { award('ftTitle'); confetti(120); }
  say(r.move < 0 ? `${r.pos}º lugar: acesso para a ${FT.DIVS[G.S.fut.div]}! Prêmio ${brl(r.prize)}.` : r.move > 0 ? `${r.pos}º lugar: rebaixado para a ${FT.DIVS[G.S.fut.div]}.` : `${r.pos}º lugar. Prêmio ${brl(r.prize)}.`, r.move > 0);
}

function applyTactics() { const c = f(); c.formation = $('#ft-form')?.value || c.formation; c.style = $('#ft-style')?.value || c.style; }
function bookkeep(res) {
  const g = res.mine, home = g.h === 'user', my = home ? g.hg : g.ag, their = home ? g.ag : g.hg;
  note(`futebol: ${g.hn} ${g.hg} x ${g.ag} ${g.an}`, res.cash);
  award('ftMatch'); if (my > their) award('ftWin');
  return { my, their };
}
export function quick() {
  if (playing) return;
  applyTactics();
  const res = FT.playRound(G.S, Math.random, Live.CFG.prize_mult || 1);
  if (!res) return;
  const { my, their } = bookkeep(res), g = res.mine;
  say(`${g.hn} ${g.hg} x ${g.ag} ${g.an}: ${my > their ? 'vitória' : my < their ? 'derrota' : 'empate'}. Caixa da rodada ${brl(res.cash)}.`, my < their);
  if (my > their) sfx.play('stack', 0.5);
  save(); G.render();
}

// partida ao vivo: 90 minutos em ~14 s, com quem marcou e expulsões
export async function play() {
  if (playing) return;
  applyTactics();
  const res = FT.playRound(G.S, Math.random, Live.CFG.prize_mult || 1);
  if (!res) return;
  save();
  playing = true;
  const g = res.mine, home = g.h === 'user', d = $('#dlg-match');
  $('#mt-home').textContent = g.hn; $('#mt-away').textContent = g.an;
  $('#mt-score').textContent = '0 x 0'; $('#mt-min').textContent = "0'"; $('#mt-feed').innerHTML = ''; $('#mt-end').hidden = true;
  d.showModal();
  let hs = 0, as = 0;
  const total = ms(14000), t0 = performance.now(), queue = [...g.events];
  sfx.crowd(true, 0.4);
  await new Promise(done => {
    const tick = now => {
      const min = Math.min(90, Math.floor(((now - t0) / (total || 1)) * 90));
      $('#mt-min').textContent = `${min}'`;
      $('#mt-bar').style.transform = `scaleX(${min / 90})`;
      while (queue.length && queue[0].min <= min) {
        const e = queue.shift(), mine = (e.side === 'h') === home, team = e.side === 'h' ? g.hn : g.an;
        if (e.kind === 'gol') { e.side === 'h' ? hs++ : as++; $('#mt-score').textContent = `${hs} x ${as}`; $('#mt-score').animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], 500); sfx.play('stack', 0.7); sfx.crowd(true, 1); if (mine) confetti(25); }
        const txt = e.kind === 'gol' ? `GOL do ${esc(team)}!${e.who ? ` ${esc(e.who)} marca.` : ''}` : e.kind === 'cartão' ? `cartão amarelo para o ${esc(team)}` : e.kind === 'vermelho' ? `cartão VERMELHO para o ${esc(team)}${e.who ? `: ${esc(e.who)} está fora dos próximos jogos` : ''}` : `chance perigosa do ${esc(team)}`;
        $('#mt-feed').insertAdjacentHTML('afterbegin', `<li class="ev ev--${e.kind} ${mine ? 'is-mine' : ''}"><b>${e.min}'</b> ${txt}</li>`);
      }
      if (min >= 90 || !total) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  sfx.crowd(false);
  $('#mt-score').textContent = `${g.hg} x ${g.ag}`;
  const { my, their } = bookkeep(res);
  const end = $('#mt-end'); end.hidden = false;
  end.innerHTML = `<p class="${my > their ? 'good' : my < their ? 'bad' : ''}"><strong>${my > their ? 'Vitória!' : my < their ? 'Derrota.' : 'Empate.'}</strong></p>
    <ul class="ft-cash">${res.lines.map(l => `<li><span>${esc(l.txt)}</span><b class="${l.val < 0 ? 'bad' : 'good'}">${brl(l.val)}</b></li>`).join('')}</ul>
    ${(f().offers || []).some(o => o.until === f().league.round + 2) ? '<p class="small good">Chegou proposta por um jogador seu: veja na aba propostas.</p>' : ''}
    <button class="btn btn--gold" data-act="ft-close">continuar</button>`;
  playing = false;
  save(); G.render();
}
export function closeMatch() { $('#dlg-match').close(); render(); }

document.getElementById('dlg-match')?.addEventListener('cancel', e => { if (playing) e.preventDefault(); });
