// Tela do clube de futebol: fundar, elenco, escalação, mercado, tabela e a partida ao vivo.
import * as FT from './futebol.js';
import { G, $, esc, brl, int, say, save, note, award, confetti, ms } from './store.js';
import * as Live from './live.js';
import * as sfx from './sfx.js';

let view = 'jogo', playing = false;
const f = () => G.S.fut;

export function render() {
  const has = !!f()?.club;
  $('#ft-found').hidden = has; $('#ft-club').hidden = !has;
  if (!has) { $('#ft-cost').textContent = brl(FT.FOUND_COST); return; }
  const c = f(), st = FT.standings(c.league), me = st.findIndex(t => t.user) + 1, lg = c.league;
  const str = FT.strength(c.squad, c.formation, c.style);
  $('#ft-name').textContent = c.club;
  $('#ft-sub').textContent = `${FT.DIVS[c.div]}, temporada ${c.season}, rodada ${Math.min(lg.round + 1, lg.fixtures.length)} de ${lg.fixtures.length}, ${me}º lugar`;
  $('#ft-kpis').innerHTML = [['força do time', Math.round(str.ovr)], ['ataque', Math.round(str.att)], ['defesa', Math.round(str.def)],
    ['folha mensal', brl(FT.payroll(c))], ['ganho no clube', brl(c.earned)], ['títulos', c.trophies]]
    .map(([k, v]) => `<div class="tile glass"><span class="muted small">${k}</span><strong>${v}</strong></div>`).join('');
  document.querySelectorAll('[data-ftv]').forEach(b => b.classList.toggle('is-on', b.dataset.ftv === view));
  document.querySelectorAll('[data-ftpanel]').forEach(p => { p.hidden = p.dataset.ftpanel !== view; });
  ({ jogo: renderNext, elenco: renderSquad, tabela: renderTable, mercado: renderMarket })[view]?.();
}
export function setView(v) { view = v; render(); }

function renderNext() {
  const c = f(), lg = c.league;
  const done = lg.round >= lg.fixtures.length;
  $('#ft-next').innerHTML = done
    ? `<p class="big-line">Temporada encerrada.</p><button class="btn btn--gold btn--lg" data-act="ft-season">fechar a temporada e receber o prêmio</button>`
    : (() => {
      const [h, a] = lg.fixtures[lg.round].find(g => g.includes('user'));
      const name = id => lg.teams.find(t => t.id === id).name;
      return `<div class="fx"><span>${esc(name(h))}</span><b>x</b><span>${esc(name(a))}</span></div>
        <p class="muted small">${h === 'user' ? 'Jogo em casa: bilheteria entra para você.' : 'Jogo fora de casa.'} Formação ${c.formation}, estilo ${c.style}.</p>
        <div class="row"><label class="field"><span>formação</span><select class="input" id="ft-form">${Object.keys(FT.FORMATIONS).map(x => `<option ${x === c.formation ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="field"><span>estilo</span><select class="input" id="ft-style">${Object.keys(FT.STYLES).map(x => `<option ${x === c.style ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <button class="btn btn--gold btn--lg" data-act="ft-play" ${playing ? 'disabled' : ''}>jogar a rodada</button></div>`;
    })();
  $('#ft-pitch').innerHTML = pitch(c);
  $('#ft-last').innerHTML = lg.results?.length ? `<h3>resultados da última rodada</h3><ul class="ft-res">${lg.results.map(g => `<li class="${g.h === 'user' || g.a === 'user' ? 'is-mine' : ''}"><span>${esc(g.hn)}</span><b>${g.hg} x ${g.ag}</b><span>${esc(g.an)}</span></li>`).join('')}</ul>` : '';
}

function pitch(c) {
  const l = FT.lineup(c.squad, c.formation);
  const row = (arr, y) => arr.map((p, i) => `<span class="ply" style="left:${((i + 1) / (arr.length + 1)) * 100}%;top:${y}%"><b>${Math.round(p.ovr)}</b><small>${esc(p.name.split(' ')[0])}</small></span>`).join('');
  return `<div class="pitch">${row(l.att, 16)}${row(l.mid, 44)}${row(l.def, 70)}${row(l.gk, 90)}</div>`;
}

function renderSquad() {
  const c = f(), order = Object.keys(FT.POS);
  $('#ft-squad').innerHTML = [...c.squad].sort((a, b) => order.indexOf(a.pos) - order.indexOf(b.pos) || b.ovr - a.ovr).map(p => `<tr>
    <td><span class="posb posb--${p.pos}">${p.pos}</span></td><td>${esc(p.name)}${p.inj ? ' <span class="tag tag--red">lesionado</span>' : ''}</td><td class="num">${p.age}</td>
    <td class="num"><strong>${p.ovr}</strong></td><td class="num">${p.pot}</td><td class="num">${brl(p.sal)}</td><td class="num">${brl(FT.value(p))}</td>
    <td class="acts"><button class="btn btn--glass btn--sm" data-act="ft-sell" data-id="${p.id}">vender ${brl(Math.round(FT.value(p) * 0.8))}</button></td></tr>`).join('');
}
function renderTable() {
  const st = FT.standings(f().league);
  $('#ft-table').innerHTML = st.map((t, i) => `<tr class="${t.user ? 'is-mine' : ''} ${i < 2 ? 'is-up' : i >= 8 ? 'is-down' : ''}"><td class="num">${i + 1}</td><td>${esc(t.name)}</td>
    <td class="num">${t.p}</td><td class="num">${t.w}</td><td class="num">${t.d}</td><td class="num">${t.l}</td><td class="num">${t.gf}:${t.ga}</td><td class="num"><strong>${t.pts}</strong></td></tr>`).join('');
  $('#ft-hist').innerHTML = f().history.length ? f().history.map(h => `<li>Temporada ${h.season}, ${FT.DIVS[h.div]}: ${h.pos}º lugar, ${h.pts} pontos, prêmio ${brl(h.prize)}</li>`).join('') : '<li class="muted">Primeira temporada.</li>';
}
function renderMarket() {
  $('#ft-market').innerHTML = f().market.map(p => `<tr><td><span class="posb posb--${p.pos}">${p.pos}</span></td><td>${esc(p.name)}</td><td class="num">${p.age}</td>
    <td class="num"><strong>${p.ovr}</strong></td><td class="num">${p.pot}</td><td class="num">${brl(p.sal)}</td>
    <td class="acts"><button class="btn btn--gold btn--sm" data-act="ft-buy" data-id="${p.id}">contratar ${brl(p.price)}</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Mercado vazio até a próxima temporada.</td></tr>';
}

export function found() {
  const err = FT.foundClub(G.S, $('#ft-new').value);
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  note(`fundação do clube ${G.S.fut.club}`, -FT.FOUND_COST);
  award('ftFound'); confetti(60); say(`${G.S.fut.club} fundado na Série C. Boa sorte, presidente!`);
  view = 'jogo';
}
export function buy(id) { const p = f().market.find(x => x.id === id); const err = FT.buy(G.S, id); if (err) return say(err[0].toUpperCase() + err.slice(1), true); note(`contratação de ${p.name}`, -p.price); say(`${p.name} contratado.`); }
export function sell(id) {
  const p = f().squad.find(x => x.id === id);
  if (!confirm(`Vender ${p.name} por ${brl(Math.round(FT.value(p) * 0.8))}?`)) return;
  const v = FT.sell(G.S, id);
  if (v < 0) return say('O elenco precisa de pelo menos 14 jogadores.', true);
  note(`venda de ${p.name}`, v); say(`${p.name} vendido.`);
}
export function seasonEnd() {
  const r = FT.endSeason(G.S, Math.random, Live.CFG.prize_mult || 1);
  note(`fim da temporada: ${r.pos}º lugar`, r.prize);
  if (r.pos === 1) { award('ftTitle'); confetti(120); }
  say(r.move < 0 ? `${r.pos}º lugar: acesso para a ${FT.DIVS[G.S.fut.div]}! Prêmio ${brl(r.prize)}.` : r.move > 0 ? `${r.pos}º lugar: rebaixado para a ${FT.DIVS[G.S.fut.div]}.` : `${r.pos}º lugar. Prêmio ${brl(r.prize)}.`, r.move > 0);
}

// partida ao vivo: 90 minutos em ~18 s, gols e lances aparecendo no minuto certo
export async function play() {
  if (playing) return;
  const c = f();
  c.formation = $('#ft-form')?.value || c.formation; c.style = $('#ft-style')?.value || c.style;
  const res = FT.playRound(G.S, Math.random, Live.CFG.prize_mult || 1);
  if (!res) return;
  save();                                           // o resultado já fica gravado
  playing = true;
  const g = res.mine, home = g.h === 'user', d = $('#dlg-match');
  $('#mt-home').textContent = g.hn; $('#mt-away').textContent = g.an;
  $('#mt-score').textContent = '0 x 0'; $('#mt-min').textContent = "0'"; $('#mt-feed').innerHTML = ''; $('#mt-end').hidden = true;
  d.showModal();
  let hs = 0, as = 0;
  const total = ms(18000), t0 = performance.now(), queue = [...g.events];
  sfx.crowd(true, 0.4);
  await new Promise(done => {
    const tick = now => {
      const min = Math.min(90, Math.floor(((now - t0) / (total || 1)) * 90));
      $('#mt-min').textContent = `${min}'`;
      $('#mt-bar').style.transform = `scaleX(${min / 90})`;
      while (queue.length && queue[0].min <= min) {
        const e = queue.shift(), mine = (e.side === 'h') === home;
        const team = e.side === 'h' ? g.hn : g.an;
        if (e.kind === 'gol') { e.side === 'h' ? hs++ : as++; $('#mt-score').textContent = `${hs} x ${as}`; sfx.play('stack', 0.7); sfx.crowd(true, 1); if (mine) confetti(25); }
        $('#mt-feed').insertAdjacentHTML('afterbegin', `<li class="ev ev--${e.kind} ${mine ? 'is-mine' : ''}"><b>${e.min}'</b> ${e.kind === 'gol' ? `GOL do ${esc(team)}!` : e.kind === 'cartão' ? `cartão amarelo para o ${esc(team)}` : `chance perigosa do ${esc(team)}`}</li>`);
      }
      if (min >= 90 || !total) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  sfx.crowd(false);
  const my = home ? g.hg : g.ag, their = home ? g.ag : g.hg;
  $('#mt-score').textContent = `${g.hg} x ${g.ag}`;
  const end = $('#mt-end'); end.hidden = false;
  end.innerHTML = `<p class="${my > their ? 'good' : my < their ? 'bad' : ''}"><strong>${my > their ? 'Vitória!' : my < their ? 'Derrota.' : 'Empate.'}</strong></p>
    <ul class="ft-cash">${res.lines.map(l => `<li><span>${esc(l.txt)}</span><b class="${l.val < 0 ? 'bad' : 'good'}">${brl(l.val)}</b></li>`).join('')}</ul>
    <button class="btn btn--gold" data-act="ft-close">continuar</button>`;
  note(`futebol: ${g.hn} ${g.hg} x ${g.ag} ${g.an}`, res.cash);
  award('ftMatch'); if (my > their) award('ftWin');
  playing = false;
  save(); G.render();
}
export function closeMatch() { $('#dlg-match').close(); render(); }

document.getElementById('dlg-match')?.addEventListener('cancel', e => { if (playing) e.preventDefault(); });
