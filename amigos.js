// Parceiros entre você e os jogadores do mundo (regras puras, sem DOM).
// Marque alguém como parceiro (até 8) e, ao negociar com ele no inventário, os dois lados se ajudam:
// ele arrenda terra parada, aluga espaço de galpão, empresta trator/caminhão e dinheiro; você faz o mesmo com o que está parado.
// Parceria tem confiança (0 a 100): sobe todo mês e com conta paga, cai com calote; zerada, a parceria acaba.
// Agiotagem: parceiros e jogadores do mundo pedem dinheiro a juros altos; o agiota automático empresta sozinho dentro das suas regras.
import * as NPC from './npcs.js';
import * as L from './logic.js';
import * as NG from './negocios.js';

export const MAX = 8, START = 20;
export const LAND_OFF = 0.35;       // terra de parceiro: até 35% mais barata que o arrendamento normal
export const WH_RENT = 0.004;       // galpão de parceiro: aluguel ao mês sobre o preço do galpão (sem pagar o galpão)
export const WH_LEND = 0.005;       // seu galpão parado alugado ao parceiro: recebe ao mês sobre o valor (a manutenção é 0,25%)
export const TOOL_RENT = 0.01;      // máquina emprestada: ao mês sobre o preço da máquina
export const TOOLS = ['trator', 'caminhao'];
export const FRIEND_RATE = 0.012, FRIEND_RATE_LOW = 0.025;   // empréstimo do parceiro: abaixo do banco com muita confiança
export const LEND_RATES = [0.015, 0.025, 0.04, 0.06, 0.08];  // juros que você pode cobrar ao emprestar
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r1000 = v => Math.round(v / 1000) * 1000;

export function ensure(s) {
  s.amigos ??= {};
  s.amigos.list ??= {}; s.amigos.taken ??= {}; s.amigos.tools ??= []; s.amigos.auto ??= { on: false, budget: 200000, risk: 0.08 };
  return s.amigos;
}
export const friends = s => Object.entries(ensure(s).list).map(([nick, f]) => ({ nick, ...f, npc: NPC.byNick(nick) })).filter(f => f.npc);
export const friend = (s, nick) => friends(s).find(f => f.nick === nick) || null;
export const isFriend = (s, nick) => !!ensure(s).list[nick];
const k = f => 0.5 + (f?.conf || 0) / 200;   // 0,5 a 1: peso da confiança no desconto

// caixinha "parceiro"
export function setPartner(s, nick, on) {
  const a = ensure(s);
  if (!on) { unfriend(s, nick); return null; }
  if (a.list[nick]) return null;
  if (!NPC.byNick(nick)) return 'esse jogador não está no mundo.';
  if (Object.keys(a.list).length >= MAX) return `no máximo ${MAX} parceiros. Desmarque um antes.`;
  a.list[nick] = { since: s.month || 1, conf: START }; return null;
}
// fim da parceria: o que estava com ele volta para você; o que era dele volta para ele
export function unfriend(s, nick) {
  delete ensure(s).list[nick];
  for (const l of s.lands || []) if (l.leaseTo === nick) { l.leasedOut = false; delete l.leaseTo; }
  for (const w of s.biz?.wh || []) if (w.lentTo === nick) delete w.lentTo;
  for (const c of s.cars || []) if (c.lentTo === nick) delete c.lentTo;
  s.amigos.tools = s.amigos.tools.filter(t => t.friend !== nick);
}

// o que um parceiro tem para oferecer este mês (muda todo mês do mundo)
export function offersFrom(s, nick) {
  const a = ensure(s), f = friend(s, nick); if (!f) return [];
  const m = s.month || 1, r = seeded(m * 977 + f.npc.i * 13), out = [];
  if (r() < 0.7) {
    const tmp = { nextId: 1, offers: [] }; L.refreshOffers(tmp, r); const o = tmp.offers[0];
    out.push({ id: `fl-${m}-${f.npc.i}`, kind: 'land', nick, land: o, rate: +(L.RENT_PAY * (1 - LAND_OFF * k(f))).toFixed(5) });
  }
  if (r() < 0.55) {
    const type = f.conf >= 60 && r() < 0.5 ? 'g2000' : 'g500', W = NG.WAREHOUSES[type];
    out.push({ id: `fw-${m}-${f.npc.i}`, kind: 'wh', nick, type, rent: r1000(W.price * WH_RENT * (1 - 0.2 * k(f))) });
  }
  for (const type of TOOLS) if (r() < 0.45) {
    const model = Object.keys(L.CARS).find(c => L.CARS[c].type === type);
    out.push({ id: `ft-${m}-${f.npc.i}-${type}`, kind: 'tool', nick, type, model, fee: r1000(L.CARS[model].price * TOOL_RENT * (1 - 0.3 * k(f))) });
  }
  return out.filter(o => a.taken[o.id] !== m);
}
export const offers = s => friends(s).flatMap(f => offersFrom(s, f.nick));
export function take(s, id) {
  const a = ensure(s), o = offers(s).find(x => x.id === id);
  if (!o) return 'essa parceria não está mais disponível.';
  if (o.kind === 'land') s.lands.push({ ...o.land, id: s.nextId++, own: false, leasedOut: false, friend: o.nick, rate: o.rate });
  else if (o.kind === 'wh') { NG.ensure(s); (s.biz.whRent ??= []).push({ id: `wr${s.nextId++}`, type: o.type, rent: o.rent, friend: o.nick }); }
  else { if (a.tools.some(t => t.type === o.type)) return `você já está com um ${L.CARS[o.model].name} emprestado.`; a.tools.push({ id: `tl${s.nextId++}`, type: o.type, model: o.model, fee: o.fee, friend: o.nick }); }
  a.taken[o.id] = s.month || 1; return null;
}
export function returnWh(s, id) {
  const w = (s.biz?.whRent || []).find(x => x.id === id); if (!w) return 'galpão não encontrado.';
  if (NG.tons(s) > NG.capacity(s) - NG.WAREHOUSES[w.type].cap) return 'seu estoque não cabe sem esse galpão: venda parte antes.';
  s.biz.whRent = s.biz.whRent.filter(x => x !== w); return null;
}
export function returnTool(s, id) { const a = ensure(s); a.tools = a.tools.filter(t => t.id !== id); return null; }

// o que você tem parado e pode passar para o parceiro
export const idleLands = s => (s.lands || []).filter(l => l.own && !l.leasedOut && !l.crop && !l.orchard && !l.cane && !L.pastureBusy(s, l));
export const idleWh = s => (s.biz?.wh || []).filter(w => !w.lentTo && NG.tons(s) <= NG.capacity(s) - (NG.WAREHOUSES[w.type]?.cap || 0));
export const idleTools = s => (s.cars || []).filter(c => !c.lentTo && TOOLS.includes(L.CARS[c.model]?.type));
const need = (s, nick) => (isFriend(s, nick) ? null : 'marque esse jogador como parceiro antes.');
export function leaseLand(s, landId, nick) {
  const l = (s.lands || []).find(x => x.id === landId); const e = need(s, nick); if (e) return e;
  if (!l?.own) return 'só dá para arrendar terra sua.';
  if (l.leasedOut || l.crop || l.orchard || l.cane) return 'essa terra não está parada.';
  const busy = L.pastureBusy(s, l); if (busy) return busy;
  l.leasedOut = true; l.leaseTo = nick; return null;
}
export function lendWh(s, whId, nick) {
  const w = (s.biz?.wh || []).find(x => x.id === whId); if (!w) return 'galpão não encontrado.';
  if (w.lentTo) { delete w.lentTo; return null; }   // de volta para você
  const e = need(s, nick); if (e) return e;
  if (NG.tons(s) > NG.capacity(s) - NG.WAREHOUSES[w.type].cap) return 'seu estoque não cabe sem esse galpão.';
  w.lentTo = nick; return null;
}
export function lendTool(s, carId, nick) {
  const c = (s.cars || []).find(x => x.id === carId); if (!c) return 'máquina não encontrada.';
  if (c.lentTo) { delete c.lentTo; return null; }
  const e = need(s, nick); if (e) return e;
  if (!TOOLS.includes(L.CARS[c.model]?.type)) return 'só trator e caminhão podem ser emprestados.';
  c.lentTo = nick; return null;
}

// ---------- dinheiro ----------
export const loanLimit = (s, f) => r1000(Math.min(NPC.worthAt(f.npc, s.month || 1) * 0.02, 20000 + f.conf * 8000));
export const loanRate = f => (f.conf >= 60 ? FRIEND_RATE : FRIEND_RATE_LOW);
export function borrow(s, nick, amount) {
  const f = friend(s, nick); if (!f) return 'só parceiro empresta sem garantia.';
  if (s.loans.some(l => l.from === nick)) return `você já deve para ${nick}: pague antes de pedir de novo.`;
  amount = r1000(Number(amount) || 0);
  if (amount < 1000 || amount > loanLimit(s, f)) return `${nick} empresta até R$ ${loanLimit(s, f).toLocaleString('pt-BR')}.`;
  s.loans.push({ id: s.nextId++, bal: amount, rate: loanRate(f), left: 12, missed: 0, from: nick });
  s.money += amount; return null;
}
// você empresta para quem está negociando com você. Parceiro aceita juros de amigo e quase não dá calote;
// quem não é parceiro só pega se o juro for de agiota e paga pior.
export const lendCap = (s, nick) => { const n = NPC.byNick(nick); return n ? r1000(Math.max(10000, Math.min(2e6, NPC.worthAt(n, s.month || 1) * 0.03))) : 0; };
export const lendRisk = (s, nick) => { const f = friend(s, nick); return +(f ? 0.02 * (1 - f.conf / 130) : 0.07).toFixed(3); };
export const lendMaxRate = (s, nick) => (isFriend(s, nick) ? 0.04 : 0.08);
export function lendTo(s, nick, amount, rate, months) {
  amount = r1000(Number(amount) || 0); rate = Number(rate); months = Math.round(Number(months) || 0);
  if (!NPC.byNick(nick)) return 'esse jogador não está no mundo.';
  if (!LEND_RATES.includes(rate)) return 'escolha uma taxa da lista.';
  if (months < 2 || months > 12) return 'prazo de 2 a 12 meses.';
  if (amount < 1000 || amount > lendCap(s, nick)) return `${nick} só precisa de até R$ ${lendCap(s, nick).toLocaleString('pt-BR')}.`;
  if (rate > lendMaxRate(s, nick)) return `${nick} achou o juro alto demais: no máximo ${(lendMaxRate(s, nick) * 100).toFixed(1).replace('.', ',')}% ao mês${isFriend(s, nick) ? ' para parceiro' : ''}.`;
  if (!isFriend(s, nick) && rate < 0.04) return `${nick} não é seu parceiro: sem confiança, você só empresta a partir de 4% ao mês.`;
  if (s.lent.some(p => p.nick === nick)) return `${nick} ainda está pagando o empréstimo anterior.`;
  if (amount > s.money) return 'dinheiro insuficiente.';
  s.money -= amount;
  s.lent.push({ id: s.nextId++, name: nick, nick, bal: amount, rate, left: months, risk: lendRisk(s, nick) });
  return null;
}
// pedidos de empréstimo dos jogadores do mundo (agiotagem): parceiro paga menos juros mas quase não dá calote
function worldBorrowers(s, rng) {
  const m = s.month || 1, out = [], r = seeded(m * 6151 + 3);
  for (const f of friends(s)) if (r() < 0.35) {
    const risk = (0.02 + r() * 0.08) * (1 - f.conf / 130);
    out.push({ id: s.nextId++, name: f.nick, nick: f.nick, friend: true, amount: r1000(10000 + r() * Math.min(300000, 20000 + f.conf * 3000)), rate: +(0.025 + r() * 0.02).toFixed(3), months: 3 + Math.floor(r() * 6), risk: +risk.toFixed(3) });
  }
  const online = [...NPC.onlineSet()].map(NPC.byId).filter(n => n && !isFriend(s, n.nick));
  for (let i = 0; i < 2 && online.length; i++) {
    const n = online.splice(Math.floor(rng() * online.length), 1)[0], risk = 0.04 + rng() * 0.12;
    out.push({ id: s.nextId++, name: n.nick, nick: n.nick, amount: r1000(5000 + rng() * 150000), rate: +(0.04 + risk * 0.35).toFixed(3), months: 3 + Math.floor(rng() * 6), risk: +risk.toFixed(3) });
  }
  return out;
}
export function lend(s, b) {
  if (s.money < b.amount) return false;
  s.money -= b.amount; s.borrowers = s.borrowers.filter(x => x.id !== b.id);
  s.lent.push({ id: b.id, name: b.name, nick: b.nick, bal: b.amount, rate: b.rate, left: b.months, risk: b.risk });
  return true;
}
export const lentTotal = s => (s.lent || []).reduce((t, p) => t + p.bal, 0);
export function setAuto(s, on, budget, risk) {
  const a = ensure(s).auto;
  a.on = !!on; a.budget = Math.max(0, r1000(Number(budget) || 0)); a.risk = Math.min(0.2, Math.max(0.01, Number(risk) || 0.08));
}

// fecha o mês: depois do L.tick (que já cobrou parcelas, aluguéis e calotes). lines = o que o tick lançou.
export function monthly(s, lines = [], rng = Math.random) {
  const a = ensure(s), out = [], add = (txt, val = 0) => { s.money += val; out.push({ txt, val: Math.round(val) }); };
  const bump = (nick, d) => { const f = a.list[nick]; if (f) f.conf = Math.max(0, Math.min(100, f.conf + d)); };
  for (const nick of Object.keys(a.list)) bump(nick, 3);
  for (const l of lines) {
    let x;
    if ((x = /^(.+) deu calote/.exec(l.txt)) && a.list[x[1]]) { bump(x[1], -50); out.push({ txt: `${x[1]} deu calote: a parceria esfriou`, val: 0 }); }
    else if ((x = /^(.+) pagou a parcela/.exec(l.txt))) bump(x[1], 1);
    else if ((x = /^parcela do empréstimo de (.+) atrasada/.exec(l.txt))) bump(x[1], -20);
  }
  for (const [nick, f] of Object.entries(a.list)) if (f.conf <= 0) { unfriend(s, nick); out.push({ txt: `${nick} desfez a parceria (confiança zerada)`, val: 0 }); }
  for (const w of s.biz?.whRent || []) { add(`galpão alugado de ${w.friend}`, -w.rent); bump(w.friend, 1); }
  for (const t of a.tools) { add(`aluguel de máquina: ${L.CARS[t.model]?.name || t.type} de ${t.friend}`, -t.fee); bump(t.friend, 1); }
  for (const w of s.biz?.wh || []) if (w.lentTo) { add(`${NG.WAREHOUSES[w.type]?.label || 'galpão'} alugado para ${w.lentTo}`, w.value * WH_LEND); bump(w.lentTo, 1); }
  for (const c of s.cars || []) if (c.lentTo) { add(`${L.CARS[c.model]?.name || 'máquina'} emprestado para ${c.lentTo}`, L.CARS[c.model].price * TOOL_RENT * 0.8); bump(c.lentTo, 1); }
  for (const l of s.lands || []) if (l.leaseTo) bump(l.leaseTo, 1);
  s.borrowers = [...(s.borrowers || []), ...worldBorrowers(s, rng)];
  if (a.auto.on) for (const b of [...s.borrowers].sort((x, y) => y.rate - x.rate)) {
    if (b.risk > a.auto.risk || lentTotal(s) + b.amount > a.auto.budget || s.money - b.amount < 0) continue;
    if (lend(s, b)) out.push({ txt: `agiota automático: emprestou R$ ${b.amount.toLocaleString('pt-BR')} para ${b.name} a ${(b.rate * 100).toFixed(1)}% ao mês`, val: -b.amount });   // lend() já tirou o dinheiro
  }
  return out;
}
