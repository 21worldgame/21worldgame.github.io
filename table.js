// Motor da mesa de blackjack. Roda no navegador do anfitrião (ou localmente, na mesa com bots).
// Ele embaralha o sapato, dá as cartas, joga pelo dealer e acerta cada mão. Os outros recebem o estado (view) e mandam ações.
import * as BJ from './bj.js';

export const BOTS = [
  { name: 'Coringa021' }, { name: 'SemanaUm' }, { name: 'RecomecoBR' }, { name: 'PrimeiroMes' }, { name: 'Novato_BR' }, { name: 'TrocaTroca' },
];
export const SEATS = 6; const TURN_MS = 20000;

export class Table {
  constructor({ id, name, minBet = 50, onChange = () => {}, speed = 1, rng = Math.random, bots = null }) {
    Object.assign(this, { id, name, minBet, onChange, speed, rng, botNames: bots });
    this.round = 0; this.phase = 'bet'; this.turn = -1; this.hand = 0; this.deadline = 0; this.closed = false; this.shuffling = false;
    this.shoe = BJ.newShoe(rng);
    this.dealer = [];
    this.seats = Array.from({ length: SEATS }, (_, i) => this.bot(i));
    this.pending = [];
  }

  bot(i) { const b = this.botNames ? { name: this.botNames[i % this.botNames.length] } : BOTS[i % BOTS.length]; return { kind: 'bot', name: b.name, bet: 0, hands: [], pay: 0 }; }
  wait(ms) { return new Promise(r => setTimeout(r, ms * this.speed)); }
  emit() { if (!this.closed) this.onChange(this.view()); }
  humans() { return this.seats.filter(s => s.kind === 'human'); }
  seatOf(pid) { return this.seats.findIndex(s => s.kind === 'human' && s.pid === pid); }
  draw() { if (!this.shoe.cards.length) this.shoe = BJ.newShoe(this.rng); return this.shoe.cards.pop(); }

  // a carta escondida do dealer não vai para os outros jogadores até a revelação
  view() {
    const hide = ['deal', 'play'].includes(this.phase);
    return {
      id: this.id, name: this.name, minBet: this.minBet, round: this.round, phase: this.phase, turn: this.turn, hand: this.hand,
      deadline: this.deadline, shuffling: this.shuffling, shoeLeft: this.shoe.cards.length, shoeSize: this.shoe.size,
      dealer: this.dealer.map((c, i) => (hide && i === 1 ? { hidden: true } : c)),
      seats: this.seats.map(s => ({ kind: s.kind, pid: s.pid, name: s.name, look: s.look, profile: s.profile, bet: s.bet, pay: s.pay, out: s.out, done: s.done,
        hands: s.hands.map(h => ({ cards: h.cards, bet: h.bet, done: h.done, doubled: h.doubled, split: h.split, result: h.result, pay: h.pay })) })),
    };
  }

  join(pid, info) {
    if (this.seatOf(pid) >= 0) return this.seatOf(pid);
    const free = this.seats.findIndex(s => s.kind === 'bot');
    if (free < 0) return -1;
    if (this.phase === 'bet') this.seats[free] = { kind: 'human', pid, ...info, bet: 0, hands: [], pay: 0 };
    else this.pending.push({ pid, info });
    this.emit();
    return free;
  }
  leave(pid) {
    this.pending = this.pending.filter(p => p.pid !== pid);
    const i = this.seatOf(pid);
    if (i < 0) return;
    if (this.phase === 'bet') this.seats[i] = this.bot(i);
    else { this.seats[i].leaving = true; if (this.turn === i) this.resolveTurn?.(); }
    this.emit();
  }
  update(pid, info) {
    const i = this.seatOf(pid);
    if (i < 0 || !info) return;
    const { name, look, profile } = info;
    Object.assign(this.seats[i], { name: String(name || 'jogador').slice(0, 18), look, profile });
    this.emit();
  }

  bet(pid, amount) {
    const i = this.seatOf(pid);
    if (i < 0 || this.phase !== 'bet' || this.seats[i].bet || !(amount >= this.minBet)) return false;
    this.seats[i].bet = Math.floor(amount);
    const waiting = this.humans().filter(s => !s.bet).length;
    if (!waiting) this.startSoon(600);
    else if (!this.deadline) { this.deadline = Date.now() + 10000 * this.speed; this.startSoon(10000); }
    this.emit();
    return true;
  }

  // ações da vez: hit, stand, double, split
  act(pid, a) {
    const i = this.seatOf(pid);
    if (i < 0 || i !== this.turn || this.phase !== 'play') return;
    const s = this.seats[i], h = s.hands[this.hand];
    if (!h || h.done) return;
    if (a === 'hit') { h.cards.push(this.draw()); if (BJ.value(h.cards) >= 21) this.finishHand(h); else this.emit(); }
    if (a === 'stand') this.finishHand(h);
    if (a === 'double' && BJ.canDouble(h)) { h.bet *= 2; h.doubled = true; s.bet += h.bet / 2; h.cards.push(this.draw()); this.finishHand(h); }
    if (a === 'split' && BJ.canSplit(h, s.hands.length)) { this.doSplit(s); this.emit(); }
  }
  finishHand(h) { h.done = true; this.resolveTurn?.(); }
  doSplit(s) {
    const h = s.hands[0];
    const aces = h.cards[0].r === 'A';
    const a = { cards: [h.cards[0], this.draw()], bet: h.bet, split: true, done: aces };
    const b = { cards: [h.cards[1], this.draw()], bet: h.bet, split: true, done: aces };
    s.hands = [a, b]; s.bet += h.bet;
    if (aces) this.resolveTurn?.();   // ases divididos recebem uma carta só
  }

  startSoon(ms) { clearTimeout(this.startTimer); this.startTimer = setTimeout(() => this.play(), ms * this.speed); }

  async play() {
    if (this.phase !== 'bet' || this.closed) return;
    this.round++; this.deadline = 0;
    if (BJ.needsShuffle(this.shoe)) {
      this.shuffling = true; this.phase = 'deal'; this.emit();
      await this.wait(1600);
      this.shoe = BJ.newShoe(this.rng); this.shuffling = false;
    }
    this.phase = 'deal'; this.dealer = [];
    for (const s of this.seats) {
      if (s.kind === 'bot') s.bet = this.minBet * (1 + Math.floor(this.rng() * 4));
      s.out = !s.bet; s.pay = 0; s.done = false;
      s.hands = s.out ? [] : [{ cards: [], bet: s.bet }];
    }
    this.emit();
    await this.wait(600);
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < SEATS; i++) {
        if (this.seats[i].out) continue;
        this.seats[i].hands[0].cards.push(this.draw()); this.emit(); await this.wait(380);
      }
      this.dealer.push(this.draw()); this.emit(); await this.wait(380);
    }

    // o dealer confere se tem blackjack quando mostra Ás ou figura
    const dealerBJ = BJ.isBlackjack(this.dealer);
    if (!(BJ.dealerPeeks(this.dealer[0]) && dealerBJ)) {
      this.phase = 'play';
      for (let i = 0; i < SEATS; i++) {
        const s = this.seats[i];
        if (s.out) continue;
        this.turn = i;
        for (this.hand = 0; this.hand < s.hands.length; this.hand++) {
          const h = s.hands[this.hand];
          if (BJ.isBlackjack(h.cards, h.split)) { h.done = true; continue; }
          if (s.kind === 'bot') await this.botTurn(s, h);
          else if (!h.done && !s.leaving) {
            this.deadline = Date.now() + TURN_MS * this.speed;
            const turn = new Promise(res => { this.resolveTurn = res; this.turnTimer = setTimeout(res, TURN_MS * this.speed); });
            this.emit();
            await turn;
            clearTimeout(this.turnTimer); this.resolveTurn = null; this.deadline = 0;
            h.done = true;
          }
        }
        s.done = true;
      }
      this.turn = -1; this.hand = 0;
    }

    // dealer revela e compra até 17 (só se alguma mão ainda está viva)
    this.phase = 'reveal'; this.emit(); await this.wait(700);
    const alive = this.seats.some(s => !s.out && s.hands.some(h => BJ.value(h.cards) <= 21 && !BJ.isBlackjack(h.cards, h.split)));
    if (alive && !dealerBJ) while (BJ.dealerPlays(this.dealer)) { this.dealer.push(this.draw()); this.emit(); await this.wait(650); }

    for (const s of this.seats) {
      if (s.out) continue;
      for (const h of s.hands) { h.pay = BJ.payout(h, this.dealer); h.result = BJ.outcome(h, this.dealer); }
      s.pay = s.hands.reduce((t, h) => t + h.pay, 0);
    }
    this.phase = 'done'; this.emit();
    await this.wait(6500);

    this.phase = 'bet'; this.dealer = [];
    this.seats = this.seats.map((s, i) => (s.leaving ? this.bot(i) : { ...s, bet: 0, hands: [], pay: 0, out: false, done: false }));
    for (const p of this.pending.splice(0)) {
      const free = this.seats.findIndex(s => s.kind === 'bot');
      if (free >= 0) this.seats[free] = { kind: 'human', pid: p.pid, ...p.info, bet: 0, hands: [], pay: 0 };
    }
    this.emit();
  }

  async botTurn(s, h) {
    this.emit(); await this.wait(550);
    for (;;) {
      if (h.done || BJ.value(h.cards) >= 21) { h.done = true; return; }
      const a = BJ.botAction(h, this.dealer[0], s.hands.length);
      if (a === 'stand') { h.done = true; return; }
      if (a === 'double' && BJ.canDouble(h)) { h.bet *= 2; h.doubled = true; s.bet += h.bet / 2; h.cards.push(this.draw()); h.done = true; this.emit(); await this.wait(600); return; }
      if (a === 'split' && BJ.canSplit(h, s.hands.length)) {
        this.doSplit(s); this.emit(); await this.wait(600);
        h = s.hands[this.hand]; continue;
      }
      h.cards.push(this.draw()); this.emit(); await this.wait(600);
    }
  }

  close() { this.closed = true; clearTimeout(this.startTimer); clearTimeout(this.turnTimer); this.resolveTurn?.(); }
}
