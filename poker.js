// Pôquer Texas Hold'em sem limite (regras puras, sem tela). Mesa de 6 lugares, jogo a dinheiro:
// cada um senta com fichas (compra = 100 big blinds), joga mão a mão e leva o que sobrar quando levantar.
// Blinds, 4 rodadas de apostas (pré-flop, flop, turn, river), all-in com potes paralelos e showdown com a melhor mão de 5 entre 7 cartas.
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RV = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
export const HAND_NAME = ['carta alta', 'um par', 'dois pares', 'trinca', 'sequência', 'flush', 'full house', 'quadra', 'straight flush', 'royal flush'];
export const SEATS = 6;
export const newDeck = () => RANKS.flatMap(r => SUITS.map(s => ({ r, s })));
export function shuffle(a, rng = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- força da mão: [categoria, desempates...] (compara posição a posição) ----------
function straightTop(vals) {   // vals únicos em ordem decrescente
  const v = vals.includes(14) ? [...vals, 1] : vals;
  for (let i = 0; i + 4 < v.length; i++) if (v[i] - v[i + 4] === 4) return v[i];
  return 0;
}
export function evaluate(cards) {
  const vals = cards.map(c => RV[c.r]).sort((a, b) => b - a), uniq = [...new Set(vals)];
  const bySuit = {}; for (const c of cards) (bySuit[c.s] ??= []).push(RV[c.r]);
  const fl = Object.values(bySuit).find(v => v.length >= 5)?.sort((a, b) => b - a);
  if (fl) { const t = straightTop([...new Set(fl)]); if (t) return [t === 14 ? 9 : 8, t]; }
  const cnt = {}; for (const v of vals) cnt[v] = (cnt[v] || 0) + 1;
  const g = Object.entries(cnt).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const kick = (skip, n) => uniq.filter(v => !skip.includes(v)).slice(0, n);
  if (g[0][1] === 4) return [7, g[0][0], ...kick([g[0][0]], 1)];
  if (g[0][1] === 3 && g[1]?.[1] >= 2) return [6, g[0][0], g[1][0]];
  if (fl) return [5, ...fl.slice(0, 5)];
  const st = straightTop(uniq); if (st) return [4, st];
  if (g[0][1] === 3) return [3, g[0][0], ...kick([g[0][0]], 2)];
  if (g[0][1] === 2 && g[1]?.[1] === 2) return [2, g[0][0], g[1][0], ...kick([g[0][0], g[1][0]], 1)];
  if (g[0][1] === 2) return [1, g[0][0], ...kick([g[0][0]], 3)];
  return [0, ...uniq.slice(0, 5)];
}
export const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; };

// força para os jogadores da casa (0 a 1)
export function strength(hole, board) {
  const [a, b] = hole.map(c => RV[c.r]).sort((x, y) => y - x);
  if (board.length < 3) return Math.min(1, a === b ? 0.5 + a / 30 : (a + b) / 42 + (hole[0].s === hole[1].s ? 0.06 : 0) + (a - b <= 2 ? 0.04 : 0) - (a < 10 ? 0.06 : 0));
  const mine = evaluate([...hole, ...board]), table = evaluate(board);
  let st = [0.1 + a / 70, 0.42, 0.62, 0.74, 0.82, 0.87, 0.93, 0.97, 0.99, 1][mine[0]];
  if (mine[0] === 1) st += (mine[1] - 8) / 40;                          // par alto vale mais
  if (mine[0] === table[0] && compare(mine.slice(0, 2), table.slice(0, 2)) === 0) st = Math.min(st, 0.25 + a / 80);   // a mão é da mesa, não sua
  if (board.length < 5) {                                                 // projetos
    const suits = {}; for (const c of [...hole, ...board]) suits[c.s] = (suits[c.s] || 0) + 1;
    if (Object.values(suits).some(n => n === 4) && mine[0] < 5) st += 0.13;
  }
  return Math.max(0, Math.min(1, st));
}

export class Poker {
  constructor({ id = 'p', name = 'mesa de pôquer', bb = 20, onChange = () => {}, rng = Math.random, auto = true, botDelay = 1100, turnMs = 30000, skill = 0.7, botNames = [] } = {}) {
    Object.assign(this, { id, name, bb, sb: Math.max(1, Math.floor(bb / 2)), buyIn: bb * 100, onChange, rng, auto, botDelay, turnMs, skill, botNames });
    this.seats = Array.from({ length: SEATS }, () => ({ kind: 'empty' }));
    this.button = -1; this.phase = 'wait'; this.hands = 0; this.msg = 'Esperando jogadores.'; this.timers = new Set();
  }
  // ---------- lugares ----------
  seatOf(pid) { return this.seats.findIndex(s => s.kind === 'human' && s.pid === pid); }
  bot(i) { return { kind: 'bot', name: this.botNames[i % Math.max(1, this.botNames.length)] || `Casa${i}`, stack: this.buyIn, buys: 0 }; }
  fillBots(n) { for (let i = 0, k = 0; i < SEATS && k < n; i++) if (this.seats[i].kind === 'empty') { this.seats[i] = this.bot(k); k++; } this.maybeStart(); }
  join(pid, info, prefer = -1) {
    const had = this.seatOf(pid); if (had >= 0) return had;
    const free = prefer >= 0 && this.seats[prefer] && this.seats[prefer].kind !== 'human' ? prefer : [...this.seats.keys()].find(i => this.seats[i].kind === 'empty') ?? [...this.seats.keys()].find(i => this.seats[i].kind === 'bot');
    if (free == null) return null;
    if (this.phase === 'play' && this.seats[free].kind === 'bot' && this.seats[free].in && !this.seats[free].folded) this.foldOut(free);
    this.seats[free] = { kind: 'human', pid, name: String(info?.name || 'jogador').slice(0, 20), look: info?.look, stack: this.buyIn, buys: 1 };
    this.msg = `${this.seats[free].name} sentou na mesa.`;
    this.emit(); this.maybeStart(); return free;
  }
  leave(pid) {
    const i = this.seatOf(pid); if (i < 0) return;
    if (this.phase === 'play' && this.seats[i].in && !this.seats[i].folded) this.foldOut(i);
    this.seats[i] = this.botNames.length ? this.bot(i) : { kind: 'empty' };
    this.emit(); this.schedule();
  }
  // trocar de lugar: para um lugar vazio ou de jogador da casa que não esteja jogando a mão agora
  move(pid, to) {
    const i = this.seatOf(pid), t = this.seats[to];
    if (i < 0 || !t || i === to || t.kind === 'human') return 'esse lugar não está livre.';
    const busy = s => this.phase === 'play' && s.in && !s.folded;
    if (busy(this.seats[i]) || busy(t)) return 'espere a mão acabar para trocar de lugar.';
    const me = this.seats[i];
    this.seats[to] = { kind: 'human', pid, name: me.name, look: me.look, stack: me.stack, buys: me.buys };
    this.seats[i] = this.botNames.length ? this.bot(i) : { kind: 'empty' };
    this.msg = `${me.name} trocou de lugar.`; this.emit(); return null;
  }
  rebuy(pid) {   // só com a mão fora de jogo e sem fichas
    const i = this.seatOf(pid), s = this.seats[i]; if (!s) return 'lugar inválido.';
    if (s.stack >= this.bb || (s.in && !s.folded && this.phase === 'play')) return 'você ainda tem fichas na mesa.';
    s.stack += this.buyIn; s.buys++; this.msg = `${s.name} comprou mais fichas.`; this.emit(); this.maybeStart(); return null;
  }
  // quem sai no meio da mão: as fichas que apostou ficam no pote
  foldOut(i) {
    const s = this.seats[i]; s.folded = true; this.pot += s.bet; s.bet = 0;
    if (this.phase === 'play' && this.turn === i) this.advance(i);
    else if (this.phase === 'play' && this.live().length < 2) this.advance(this.turn);
  }

  // ---------- mão ----------
  live() { return this.seats.map((s, i) => i).filter(i => this.seats[i].in && !this.seats[i].folded); }
  next(from, ok) { for (let k = 1; k <= SEATS; k++) { const i = (from + k) % SEATS; if (ok(this.seats[i], i)) return i; } return -1; }
  canPlay() { return this.seats.filter(s => s.kind !== 'empty' && s.stack > 0).length >= 2 && this.seats.some(s => s.kind === 'human' && s.stack > 0); }
  maybeStart() {
    if (this.phase === 'play' || this.closed || this.starting) return;
    if (!this.canPlay()) { this.phase = 'wait'; this.msg = this.seats.some(s => s.kind === 'human') ? 'Esperando mais jogadores com fichas.' : 'Mesa vazia.'; return this.emit(); }
    this.starting = true; this.later(() => { this.starting = false; this.deal(); }, this.hands ? 2600 : 900);
  }
  deal() {
    if (this.closed || this.phase === 'play') return;
    for (const s of this.seats) if (s.kind === 'bot' && s.stack < this.bb) { s.stack = this.buyIn; s.buys = (s.buys || 0) + 1; }   // a casa repõe
    if (!this.canPlay()) { this.phase = 'wait'; this.msg = 'Esperando mais jogadores com fichas.'; return this.emit(); }
    const deck = shuffle(newDeck(), this.rng);
    for (const s of this.seats) Object.assign(s, { in: s.kind !== 'empty' && s.stack > 0, folded: false, allin: false, bet: 0, acted: false, cards: [], said: '' });
    for (const s of this.seats) if (s.in) s.cards = [deck.pop(), deck.pop()];
    const ok = s => s.in;
    this.button = this.next(this.button, ok);
    const heads = this.seats.filter(ok).length === 2;
    this.sbSeat = heads ? this.button : this.next(this.button, ok); this.bbSeat = this.next(this.sbSeat, ok);
    this.contrib = Array(SEATS).fill(0);
    Object.assign(this, { deck, board: [], pot: 0, street: 0, curBet: 0, minRaise: this.bb, winners: null, phase: 'play', shown: false });
    this.hands++;
    this.post(this.sbSeat, this.sb, 'small blind'); this.post(this.bbSeat, this.bb, 'big blind');
    this.curBet = this.bb;
    this.turn = this.next(this.bbSeat, s => s.in && !s.folded && !s.allin);
    this.msg = `Mão ${this.hands}: blinds ${this.sb}/${this.bb}.`;
    if (this.turn < 0 || this.need().length === 0) return this.endStreet();
    this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule();
  }
  post(i, amt, said) { const s = this.seats[i], a = Math.min(s.stack, amt); s.stack -= a; s.bet += a; this.contrib[i] += a; s.said = said; if (!s.stack) s.allin = true; }
  need() { return this.live().filter(i => { const s = this.seats[i]; return !s.allin && (!s.acted || s.bet < this.curBet); }); }
  toCall(i) { return Math.max(0, this.curBet - this.seats[i].bet); }
  minRaiseTo() { return this.curBet + this.minRaise; }

  act(seat, a) {
    if (a?.t === 'rebuy') return 'use o botão de comprar fichas.';
    if (this.phase !== 'play') return 'espere a próxima mão.';
    if (seat !== this.turn) return 'não é a sua vez.';
    const s = this.seats[seat], call = this.toCall(seat);
    if (a.t === 'fold') { s.folded = true; s.said = 'desistiu'; }
    else if (a.t === 'check') { if (call) return 'tem aposta na mesa: pague, aumente ou desista.'; s.said = 'mesa'; }
    else if (a.t === 'call') { if (!call) return 'não tem aposta para pagar: dê mesa.'; this.put(seat, Math.min(call, s.stack)); s.said = s.allin ? 'all-in' : 'pagou'; }
    else if (a.t === 'raise' || a.t === 'allin') {
      const max = s.bet + s.stack, to = a.t === 'allin' ? max : Math.min(max, Math.floor(Number(a.to) || 0));
      if (to <= this.curBet) { if (a.t === 'allin') { this.put(seat, s.stack); s.said = 'all-in'; } else return 'o aumento precisa passar a aposta atual.'; }
      else {
        if (to < this.minRaiseTo() && to < max) return `aumento mínimo para ${this.minRaiseTo()}.`;
        if (to - this.curBet >= this.minRaise) this.minRaise = to - this.curBet;
        this.put(seat, to - s.bet); this.curBet = to;
        for (const i of this.live()) if (i !== seat) this.seats[i].acted = false;
        s.said = s.allin ? 'all-in' : `aumentou p/ ${to}`;
      }
    } else return 'jogada inválida.';
    s.acted = true;
    this.msg = `${s.name}: ${s.said}.`;
    return this.advance(seat);
  }
  put(i, amt) { const s = this.seats[i]; s.stack -= amt; s.bet += amt; this.contrib[i] += amt; if (!s.stack) s.allin = true; }
  advance(from) {
    if (this.live().length === 1) return this.finish();
    const need = this.need();
    if (need.length) { this.turn = this.next(from, (s, i) => need.includes(i)); this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); return null; }
    return this.endStreet();
  }
  endStreet() {
    for (const s of this.seats) { this.pot += s.bet || 0; s.bet = 0; s.acted = false; }
    this.curBet = 0; this.minRaise = this.bb;
    if (this.street === 3) return this.finish();
    this.street++;
    this.board.push(...this.deck.splice(-(this.street === 1 ? 3 : 1)));
    const can = this.live().filter(i => !this.seats[i].allin);
    if (can.length <= 1) {   // todo mundo all-in: abre a mesa até o river
      this.turn = -1; this.msg = 'All-in: abrindo a mesa até o fim.'; this.emit();
      this.later(() => this.endStreet(), 1400); return null;
    }
    for (const i of this.live()) this.seats[i].said = '';
    this.turn = this.next(this.button, (s, i) => can.includes(i));
    this.msg = ['', 'Flop', 'Turn', 'River'][this.street] + '.';
    this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); return null;
  }
  // divide o pote (com potes paralelos de quem foi all-in) e mostra as cartas
  finish() {
    for (const s of this.seats) { this.pot += s.bet || 0; s.bet = 0; }
    clearTimeout(this.botT); clearTimeout(this.idleT);
    const live = this.live(), win = new Map();
    if (live.length === 1) win.set(live[0], { amount: this.pot, hand: null });
    else {
      this.shown = true;
      const score = new Map(live.map(i => [i, evaluate([...this.seats[i].cards, ...this.board])]));
      const c = this.contrib, levels = [...new Set(live.map(i => c[i]))].sort((a, b) => a - b);
      let prev = 0, paid = 0;
      for (const L of levels) {
        let amt = 0; for (const x of c) amt += Math.min(x, L) - Math.min(x, prev);
        if (L === levels[levels.length - 1]) amt = this.pot - paid;   // o que sobrou (apostas de quem desistiu acima do maior all-in) vai para o último pote
        prev = L; paid += amt;
        const elig = live.filter(i => c[i] >= L);
        const best = elig.reduce((b, i) => (compare(score.get(i), score.get(b)) > 0 ? i : b), elig[0]);
        const tied = elig.filter(i => compare(score.get(i), score.get(best)) === 0).sort((a, b) => ((a - this.button - 1 + 2 * SEATS) % SEATS) - ((b - this.button - 1 + 2 * SEATS) % SEATS));
        const part = Math.floor(amt / tied.length);
        tied.forEach((i, k) => { const w = win.get(i) || { amount: 0, hand: HAND_NAME[score.get(i)[0]] }; w.amount += part + (k === 0 ? amt - part * tied.length : 0); win.set(i, w); });
      }
    }
    for (const [i, w] of win) this.seats[i].stack += w.amount;
    this.winners = [...win].map(([seat, w]) => ({ seat, amount: w.amount, hand: w.hand, name: this.seats[seat].name }));
    this.msg = this.winners.map(w => `${w.name} levou ${w.amount}${w.hand ? ` com ${w.hand}` : ''}`).join(' · ') + '.';
    this.phase = 'show'; this.turn = -1; this.emit();
    this.later(() => { this.phase = 'between'; this.maybeStart(); this.emit(); }, this.shown ? 5200 : 2600);
    return null;
  }

  // ---------- jogadores da casa ----------
  later(fn, ms) { if (!this.auto) { this.queue = fn; return; } const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); }
  flush() { const f = this.queue; this.queue = null; f?.(); }   // testes: roda a etapa pendente
  schedule() {
    if (!this.auto || this.phase !== 'play' || this.turn < 0) return;
    clearTimeout(this.botT); clearTimeout(this.idleT);
    const s = this.seats[this.turn], t = this.turn;
    if (s.kind === 'bot') this.botT = setTimeout(() => this.turn === t && this.botAct(t), this.botDelay + this.rng() * 1400);
    else this.idleT = setTimeout(() => this.turn === t && this.act(t, { t: this.toCall(t) ? 'fold' : 'check' }), Math.max(1000, this.deadline - Date.now()));
  }
  botDecision(i) {
    const s = this.seats[i], r = this.rng, call = this.toCall(i), pot = this.pot + this.seats.reduce((t, x) => t + (x.bet || 0), 0);
    const st = strength(s.cards, this.board) + (r() - 0.5) * (1 - this.skill) * 0.5 + (this.live().length <= 2 ? 0.06 : 0);
    const odds = call / Math.max(1, pot + call), size = f => ({ t: 'raise', to: Math.max(this.minRaiseTo(), this.curBet + Math.floor(pot * f)) });
    if (st > 0.9 && r() < 0.5) return s.stack + s.bet <= this.curBet + pot ? { t: 'allin' } : size(1);
    if (st > 0.72) return r() < 0.65 ? size(0.6 + r() * 0.4) : call ? { t: 'call' } : size(0.5);
    if (!call) return st > 0.5 || r() < 0.08 + this.skill * 0.06 ? size(0.4 + r() * 0.3) : { t: 'check' };
    if (st > 0.55 || st > odds + 0.18 || (call <= this.bb && st > 0.3)) return { t: 'call' };
    return r() < 0.04 ? { t: 'call' } : { t: 'fold' };
  }
  botAct(i) {
    if (this.phase !== 'play' || this.turn !== i) return;
    const d = this.botDecision(i);
    if (this.act(i, d)) this.act(i, { t: this.toCall(i) ? 'call' : 'check' }) && this.act(i, { t: 'fold' });   // aposta inválida: joga o simples
  }
  close() { for (const t of this.timers) clearTimeout(t); clearTimeout(this.botT); clearTimeout(this.idleT); this.closed = true; }
  emit() { if (!this.closed) this.onChange(this); }

  // o que cada lugar vê (cartas dos outros só no showdown)
  view(seat) {
    const me = this.seats[seat];
    return {
      id: this.id, name: this.name, bb: this.bb, sb: this.sb, buyIn: this.buyIn, phase: this.phase, msg: this.msg, turn: this.turn, deadline: this.deadline, seat,
      hands: this.hands, button: this.button, board: this.board || [], pot: (this.pot || 0) + this.seats.reduce((t, s) => t + (s.bet || 0), 0), winners: this.winners,
      seats: this.seats.map((s, i) => ({ kind: s.kind, name: s.name, look: s.look, pid: s.pid, stack: s.stack, bet: s.bet || 0, in: !!s.in, folded: !!s.folded, allin: !!s.allin, said: s.said || '', buys: s.buys || 0,
        cards: !s.in ? [] : i === seat || (this.shown && !s.folded && (this.phase === 'show' || this.phase === 'between')) ? s.cards : s.cards.map(() => null) })),
      toCall: me && this.phase === 'play' && this.turn === seat ? this.toCall(seat) : 0,
      minTo: this.phase === 'play' ? this.minRaiseTo() : 0, maxTo: me ? (me.bet || 0) + (me.stack || 0) : 0,
      best: me?.cards?.length && this.board?.length >= 3 ? HAND_NAME[evaluate([...me.cards, ...this.board])[0]] : '',
    };
  }
}
