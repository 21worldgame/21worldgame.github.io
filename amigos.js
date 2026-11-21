// Amigos e parcerias com os jogadores do mundo (regras puras, sem DOM).
// Amizade tem confiança (0 a 100): sobe com o tempo e com dívida paga, cai com calote. Quanto mais confiança, melhor o negócio:
// terra e galpão do amigo saem mais baratos, ele paga mais para usar o que está parado com você e empresta sem garantia.
// Agiotagem: amigos e jogadores do mundo pedem dinheiro a juros altos; o agiota automático empresta sozinho dentro das suas regras.
import * as NPC from './npcs.js';
import * as L from './logic.js';
import * as NG from './negocios.js';

export const MAX = 8, START = 20;
export const LAND_OFF = 0.35;       // terra de amigo: até 35% mais barata que o arrendamento normal
export const WH_RENT = 0.004;       // galpão de amigo: aluguel ao mês sobre o preço do galpão (sem pagar o galpão)
export const WH_LEND = 0.005;       // seu galpão parado alugado a amigo: recebe ao mês sobre o valor (a manutenção é 0,25%)
export const FRIEND_RATE = 0.012, FRIEND_RATE_LOW = 0.025;   // empréstimo do amigo: abaixo do banco com muita confiança
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r1000 = v => Math.round(v / 1000) * 1000;

export function ensure(s) {
  s.amigos ??= { list: {}, auto: { on: false, budget: 200000, risk: 0.08 }, taken: {} };
  s.amigos.list ??= {}; s.amigos.taken ??= {}; s.amigos.auto ??= { on: false, budget: 200000, risk: 0.08 };
  return s.amigos;
}
export const friends = s => Object.entries(ensure(s).list).map(([nick, f]) => ({ nick, ...f, npc: NPC.byNick(nick) })).filter(f => f.npc);
export const isFriend = (s, nick) => !!ensure(s).list[nick];
const k = f => 0.5 + (f?.conf || 0) / 200;   // 0,5 a 1: peso da confiança no desconto

// quem quer ser seu amigo este mês (3 jogadores do mundo, iguais o mês todo)
export function requests(s) {
  const a = ensure(s), m = s.month || 1, r = seeded(m * 4241 + 7), out = [];
  for (let i = 0; i < 40 && out.length < 3; i++) { const n = NPC.NPCS[Math.floor(r() * NPC.NPCS.length)]; if (!a.list[n.nick] && !out.includes(n) && !(a.taken[`no:${n.nick}`] === m)) out.push(n); }
  return out;
}
export function accept(s, nick) {
  const a = ensure(s);
  if (!requests(s).some(n => n.nick === nick)) return 'esse pedido de amizade expirou.';
  if (Object.keys(a.list).length >= MAX) return `no máximo ${MAX} amigos. Desfaça uma amizade antes.`;
  a.list[nick] = { since: s.month || 1, conf: START }; return null;
}
export function refuse(s, nick) { ensure(s).taken[`no:${nick}`] = s.month || 1; }
export function unfriend(s, nick) {
  const a = ensure(s); delete a.list[nick];
  for (const l of s.lands || []) if (l.leaseTo === nick) { l.leasedOut = false; delete l.leaseTo; }
  for (const w of s.biz?.wh || []) if (w.lentTo === nick) delete w.lentTo;
}

// parcerias que os amigos oferecem este mês: terra parada deles e galpão sobrando
export function offers(s) {
  const a = ensure(s), m = s.month || 1, out = [];
  for (const f of friends(s)) {
    const r = seeded(m * 977 + f.npc.i * 13);
    if (r() < 0.55) {
      const tmp = { nextId: 1, offers: [] }; L.refreshOffers(tmp, r); const o = tmp.offers[0];
      out.push({ id: `fl-${m}-${f.npc.i}`, kind: 'land', nick: f.nick, land: o, rate: +(L.RENT_PAY * (1 - LAND_OFF * k(f))).toFixed(5) });
    }
    if (r() < 0.35) {
      const type = f.conf >= 60 && r() < 0.5 ? 'g2000' : 'g500', W = NG.WAREHOUSES[type];
      out.push({ id: `fw-${m}-${f.npc.i}`, kind: 'wh', nick: f.nick, type, rent: r1000(W.price * WH_RENT * (1 - 0.2 * k(f))) });
    }
  }
  return out.filter(o => a.taken[o.id] !== m);
}
export function take(s, id) {
  const a = ensure(s), o = offers(s).find(x => x.id === id);
  if (!o) return 'essa parceria não está mais disponível.';
  if (o.kind === 'land') s.lands.push({ ...o.land, id: s.nextId++, own: false, leasedOut: false, friend: o.nick, rate: o.rate });
  else { NG.ensure(s); (s.biz.whRent ??= []).push({ id: `wr${s.nextId++}`, type: o.type, rent: o.rent, friend: o.nick }); }
  a.taken[o.id] = s.month || 1; return null;
}
export function returnWh(s, id) {
  const w = (s.biz?.whRent || []).find(x => x.id === id); if (!w) return 'galpão não encontrado.';
  if (NG.tons(s) > NG.capacity(s) - NG.WAREHOUSES[w.type].cap) return 'seu estoque não cabe sem esse galpão: venda parte antes.';
  s.biz.whRent = s.biz.whRent.filter(x => x !== w); return null;
}
// o melhor amigo (mais confiança) é quem usa o que está parado com você
export const bestFriend = s => friends(s).sort((x, y) => y.conf - x.conf)[0] || null;
export function leaseLand(s, landId) {
  const l = (s.lands || []).find(x => x.id === landId), f = bestFriend(s);
  if (!f) return 'você ainda não tem amigos.';
  if (!l?.own) return 'só dá para arrendar terra sua.';
  if (l.leasedOut || l.crop || l.orchard || l.cane) return 'essa terra não está parada.';
  const busy = L.pastureBusy(s, l); if (busy) return busy;
  l.leasedOut = true; l.leaseTo = f.nick; return null;
}
export function lendWh(s, whId) {
  const w = (s.biz?.wh || []).find(x => x.id === whId), f = bestFriend(s);
  if (!f) return 'você ainda não tem amigos.';
  if (!w) return 'galpão não encontrado.';
  if (w.lentTo) { delete w.lentTo; return null; }   // de volta para você
  if (NG.tons(s) > NG.capacity(s) - NG.WAREHOUSES[w.type].cap) return 'seu estoque não cabe sem esse galpão.';
  w.lentTo = f.nick; return null;
}

// ---------- dinheiro entre amigos ----------
export const loanLimit = (s, f) => r1000(Math.min(NPC.worthAt(f.npc, s.month || 1) * 0.02, 20000 + f.conf * 8000));
export const loanRate = f => (f.conf >= 60 ? FRIEND_RATE : FRIEND_RATE_LOW);
export function borrow(s, nick, amount) {
  const f = friends(s).find(x => x.nick === nick); if (!f) return 'só amigo empresta sem garantia.';
  if (s.loans.some(l => l.from === nick)) return `você já deve para ${nick}: pague antes de pedir de novo.`;
  amount = r1000(Number(amount) || 0);
  if (amount < 1000 || amount > loanLimit(s, f)) return `${nick} empresta até R$ ${loanLimit(s, f).toLocaleString('pt-BR')}.`;
  s.loans.push({ id: s.nextId++, bal: amount, rate: loanRate(f), left: 12, missed: 0, from: nick });
  s.money += amount; return null;
}
// pedidos de empréstimo dos jogadores do mundo (agiotagem): amigo paga menos juros mas quase não dá calote
function worldBorrowers(s, rng) {
  const m = s.month || 1, out = [], fr = friends(s), r = seeded(m * 6151 + 3);
  for (const f of fr) if (r() < 0.35) {
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
    if ((x = /^(.+) deu calote/.exec(l.txt)) && a.list[x[1]]) { bump(x[1], -50); out.push({ txt: `${x[1]} deu calote: a amizade esfriou`, val: 0 }); }
    else if ((x = /^(.+) pagou a parcela/.exec(l.txt))) bump(x[1], 1);
    else if ((x = /^parcela do empréstimo de (.+) atrasada/.exec(l.txt))) bump(x[1], -20);
  }
  for (const [nick, f] of Object.entries(a.list)) if (f.conf <= 0) { unfriend(s, nick); out.push({ txt: `${nick} desfez a amizade (confiança zerada)`, val: 0 }); }
  for (const w of s.biz?.whRent || []) { add(`galpão alugado de ${w.friend}`, -w.rent); bump(w.friend, 1); }
  for (const w of s.biz?.wh || []) if (w.lentTo) { add(`${NG.WAREHOUSES[w.type]?.label || 'galpão'} alugado para ${w.lentTo}`, w.value * WH_LEND); bump(w.lentTo, 1); }
  for (const l of s.lands || []) if (l.leaseTo) bump(l.leaseTo, 1);
  s.borrowers = [...(s.borrowers || []), ...worldBorrowers(s, rng)];
  if (a.auto.on) for (const b of [...s.borrowers].sort((x, y) => y.rate - x.rate)) {
    if (b.risk > a.auto.risk || lentTotal(s) + b.amount > a.auto.budget || s.money - b.amount < 0) continue;
    if (lend(s, b)) out.push({ txt: `agiota automático: emprestou R$ ${b.amount.toLocaleString('pt-BR')} para ${b.name} a ${(b.rate * 100).toFixed(1)}% ao mês`, val: -b.amount });   // lend() já tirou o dinheiro
  }
  return out;
}
