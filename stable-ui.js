// Aba "canil e haras": comprar, treinar, tratar, vender e inscrever animais em provas.
import * as ST from './stable.js';
import * as R from './race.js';
import * as RC from './racing.js';
import { G, $, esc, brl, int, say, save, note, award, confetti, ms } from './store.js';
import * as sfx from './sfx.js';

let kind = 'dog', running = false;
const S = () => G.S;
const years = m => (m >= 12 ? `${Math.floor(m / 12)} ${Math.floor(m / 12) === 1 ? 'ano' : 'anos'}${m % 12 ? ` e ${m % 12} m` : ''}` : `${m} meses`);
const tier = r => (r >= 80 ? 'is-elite' : r >= 65 ? 'is-good' : '');
const stars = (pot, r) => { const g = pot - r; return g >= 16 ? '★★★' : g >= 10 ? '★★☆' : '★☆☆'; };
const coatOf = a => RC.COATS[a.coat % RC.COATS.length];

function statBars(a) {
  return Object.entries(ST.STATS).map(([k, label]) => `<div class="stat"><span class="stat__k">${label}</span><span class="stat__v">${Math.round(a[k])}</span>
    <span class="stat__bar" role="img" aria-label="${label} ${Math.round(a[k])} de um potencial de ${a.pot}"><i class="stat__pot" style="width:${a.pot}%"></i><i class="stat__now" style="width:${a[k]}%"></i></span></div>`).join('');
}

function animalCard(a) {
  const K = ST.KINDS[a.kind], r = ST.rating(a), ret = ST.retired(a);
  const cost = ST.trainCost(a), can = ST.ready(a);
  const status = a.inj ? `<span class="tag tag--red">lesionado, ${a.inj} ${a.inj === 1 ? 'mês' : 'meses'}</span>` : ret ? '<span class="tag tag--dark">aposentado</span>'
    : a.fat >= 60 ? '<span class="tag tag--gold">cansado</span>' : '<span class="tag tag--green">em forma</span>';
  const trainBtns = Object.entries(ST.STATS).map(([k, label]) => `<button class="btn btn--glass btn--sm" data-act="st-train" data-id="${a.id}" data-k="${k}" ${can ? '' : 'disabled'} title="${label}: ${brl(cost)}">${label}</button>`).join('');
  return `<article class="glass acard${a.inj ? ' is-inj' : ''}${ret ? ' is-ret' : ''}">
    <div class="acard__stage">${RC.sprite(a.kind, coatOf(a))}<span class="tag tag--dark acard__kind">${K.label}, ${years(a.age)}</span>${status}</div>
    <div class="acard__body">
      <div class="acard__head"><h4>${esc(a.name)}</h4><span class="rate ${tier(r)}" title="nota geral">${r}</span></div>
      ${statBars(a)}
      <div class="acard__cond"><span class="muted small">cansaço</span><span class="bar" role="img" aria-label="cansaço ${a.fat}%"><i style="transform:scaleX(${a.fat / 100})"></i></span>
        <span class="weeks" role="img" aria-label="${a.wk} de ${ST.WEEKS} semanas livres">${Array.from({ length: ST.WEEKS }, (_, i) => `<i class="${i < a.wk ? 'is-free' : ''}"></i>`).join('')}</span></div>
      <p class="muted small">${a.runs} ${a.runs === 1 ? 'prova' : 'provas'}, ${a.wins} ${a.wins === 1 ? 'vitória' : 'vitórias'}, ganhou ${brl(a.earn)}</p>
      <div class="acard__train"><span class="muted small">treinar (${brl(cost)}, uma semana)</span><div class="row">${trainBtns}</div></div>
      <div class="acard__acts">
        ${a.inj ? `<button class="btn btn--glass" data-act="st-treat" data-id="${a.id}">tratar ${brl(K.vet)}</button>` : ''}
        <button class="btn btn--glass" data-act="st-sell" data-id="${a.id}">vender ${brl(ST.value(a))}</button>
      </div>
    </div></article>`;
}

function offerCard(o) {
  const K = ST.KINDS[o.kind], r = ST.rating(o);
  return `<article class="glass acard acard--offer">
    <div class="acard__stage">${RC.sprite(o.kind, coatOf(o))}<span class="tag tag--dark acard__kind">${K.label}, ${years(o.age)}</span></div>
    <div class="acard__body">
      <div class="acard__head"><h4>${esc(o.name)}</h4><span class="rate ${tier(r)}" title="nota geral">${r}</span></div>
      ${Object.entries(ST.STATS).map(([k, label]) => `<div class="stat"><span class="stat__k">${label}</span><span class="stat__v">${Math.round(o[k])}</span><span class="stat__bar"><i class="stat__now" style="width:${o[k]}%"></i></span></div>`).join('')}
      <p class="small">potencial <span class="gold">${stars(o.pot, r)}</span></p>
      <p class="price">${brl(o.cost)}</p>
      <button class="btn btn--gold" data-act="st-buy" data-id="${o.id}">comprar</button>
    </div></article>`;
}

function eventCard(ev) {
  const mine = S().stable.animals.filter(a => ST.eligible(a, ev));
  const opts = mine.map(a => `<option value="${a.id}" ${ST.ready(a) ? '' : 'disabled'}>${esc(a.name)}, nota ${ST.rating(a)}${ST.ready(a) ? '' : a.inj ? ' (lesionado)' : ST.retired(a) ? ' (aposentado)' : ' (sem semanas)'}</option>`).join('');
  const cap = ev.cls.cap >= 100 ? 'sem limite de nota' : `até nota ${ev.cls.cap}`;
  return `<article class="glass ecard">
    <div class="hcard__top"><h4>${ev.cls.name}</h4><span class="tag tag--dark">${ev.dist} m</span></div>
    <p class="muted small">${cap}, adversários de nota ${Math.round(ev.cls.field[0])} a ${Math.round(ev.cls.field[1])}</p>
    <ol class="prizes"><li><b>1º</b>${brl(ev.prize[0])}</li><li><b>2º</b>${brl(ev.prize[1])}</li><li><b>3º</b>${brl(ev.prize[2])}</li></ol>
    <p class="small">inscrição <strong>${brl(ev.fee)}</strong>, só o 1º e o 2º lugar dão lucro</p>
    ${mine.length ? `<label class="visually-hidden" for="ev-${ev.id}">animal</label><select class="input" id="ev-${ev.id}">${opts}</select>
      <button class="btn btn--gold" data-act="st-enter" data-id="${ev.id}">inscrever e correr</button>`
      : `<p class="muted small">Você não tem ${ST.KINDS[ev.kind].plural} elegíveis para esta prova.</p>`}
  </article>`;
}

export function render() {
  const st = S().stable, K = ST.KINDS[kind];
  const mine = st.animals.filter(a => a.kind === kind);
  document.querySelectorAll('[data-act="st-kind"]').forEach(b => b.classList.toggle('is-on', b.dataset.id === kind));
  const monthly = st.animals.reduce((t, a) => t + ST.upkeep(a), 0);
  $('#st-sum').textContent = st.animals.length ? `${st.animals.length} ${st.animals.length === 1 ? 'animal' : 'animais'}, valem ${brl(ST.animalsValue(S()))}, ração e cuidados ${brl(monthly)} por mês` : 'Você ainda não tem animais.';
  $('#st-mine-title').textContent = `seus ${K.plural}`;
  $('#st-mine').innerHTML = mine.length ? mine.map(animalCard).join('') : `<p class="empty glass">Nenhum ${K.label} ainda. Compre um no leilão abaixo, treine e inscreva nas provas.</p>`;
  $('#st-events').innerHTML = ST.events(kind).map(eventCard).join('');
  $('#st-offers').innerHTML = st.offers.filter(o => o.kind === kind).map(offerCard).join('');
}

export const setKind = k => { kind = k; render(); };

export function buy(id) {
  const o = S().stable.offers.find(x => String(x.id) === String(id)), name = o?.name, cost = o?.cost;
  if (!confirm(`Comprar ${name} por ${brl(cost)}?`)) return;
  const err = ST.buy(S(), Number(id));
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  note(`compra de ${ST.KINDS[kind].label}: ${name}`, -cost);
  say(`${name} chegou ao seu ${kind === 'dog' ? 'canil' : 'haras'}.`); sfx.play('stack', 0.5); award('buyAnimal');
}

export function train(id, stat) {
  const a = S().stable.animals.find(x => String(x.id) === String(id));
  const res = ST.train(S(), Number(id), stat);
  if (res.err) return say(`${a?.name || 'Animal'} ${res.err}`, true);
  note(`treino de ${ST.STATS[stat]}, ${a.name}`, -res.cost);
  sfx.play('chip', 0.4);
  say(res.injured ? `${a.name} se lesionou no treino. Trate com o veterinário ou espere.` : `${a.name} treinou ${ST.STATS[stat]}: +${res.gain.toFixed(1)}.`, res.injured);
  award('train');
}

export function treat(id) {
  const a = S().stable.animals.find(x => String(x.id) === String(id)), c = ST.KINDS[a.kind].vet;
  const err = ST.treat(S(), Number(id));
  if (err) return say(err[0].toUpperCase() + err.slice(1), true);
  note(`veterinário, ${a.name}`, -c); say(`${a.name} foi tratado e está liberado.`);
}

export function sell(id) {
  const a = S().stable.animals.find(x => String(x.id) === String(id));
  const v = ST.value(a);
  if (!confirm(`Vender ${a.name} por ${brl(v)}?`)) return;
  ST.sell(S(), Number(id));
  note(`venda de ${a.name}`, v); say(`${a.name} vendido por ${brl(v)}.`);
}

// ---------- a prova ----------
export async function enter(evId) {
  if (running) return;
  const sel = $(`#ev-${evId}`), id = Number(sel?.value);
  const a = S().stable.animals.find(x => x.id === id);
  if (!a) return say('Escolha um animal para a prova.', true);
  const res = ST.enter(S(), id, evId);
  if (res.err) return say(`${a.name} ${res.err}`, true);
  save();                                         // resultado já gravado: recarregar a página não refaz a prova
  running = true;
  const dlg = $('#dlg-race');
  RC.borrowStage($('#race-host'));
  dlg.showModal();
  const spec = { kind: res.kind, dist: res.dist, perLen: res.perLen,
    runners: res.runners.map(r => ({ lane: r.lane, name: r.name, coat: RC.COATS[r.coat % RC.COATS.length] })) };
  await new Promise(r => setTimeout(r, ms(400)));
  const gap = await RC.playRace(spec, res.order, res.T);

  const mineIdx = res.runners.findIndex(r => !r.npc), w = res.runners[res.order[0]];
  const net = res.prize - res.fee;
  note(`prova ${res.ev.cls.name} (${res.dist} m), ${a.name} em ${res.pos + 1}º: ${net >= 0 ? 'lucro' : 'prejuízo'} ${brl(Math.abs(net))}`, net);
  award('stakeRun');
  if (res.pos === 0) { award('stakeWin'); if (res.ev.cls.id === 'gp') award('stakeGP'); }
  if (res.pos <= 1) { confetti(res.pos === 0 ? 90 : 40); sfx.play('stack', 0.7); }
  const out = $('#race-result');
  out.hidden = false;
  out.innerHTML = `<p class="res__head">${esc(w.name)} vence ${R.margin(gap, res.perLen)}</p>
    <ol class="res__table">${res.order.map((i, k) => `<li class="${i === mineIdx ? 'is-mine' : ''}"><span class="res__pos">${k + 1}º</span><span class="jacket jacket--${res.runners[i].lane}">${res.runners[i].lane}</span>
      <span class="res__name">${esc(res.runners[i].name)}</span><span class="res__time">${res.T[i].toFixed(2)} s</span><span class="res__gap">${k ? `+${(res.T[i] - res.T[res.order[0]]).toFixed(2)}` : ''}</span></li>`).join('')}</ol>
    <p class="${net >= 0 ? 'good' : 'muted'}">${esc(a.name)} chegou em ${res.pos + 1}º. ${res.prize ? `Prêmio ${brl(res.prize)}, ${net >= 0 ? 'lucro' : 'prejuízo'}` : (net >= 0 ? 'Lucro' : 'Prejuízo')} de ${brl(Math.abs(net))} já descontada a inscrição.${res.injured ? ` ${esc(a.name)} se lesionou na prova.` : ''}</p>
    <button class="btn btn--gold" data-act="stable-close">fechar</button>`;
  running = false;
  G.render();
}

export function closeRace() {
  if (running) return;
  $('#dlg-race').close();
  RC.returnStage();
  render();
}
export const isRunning = () => running;
