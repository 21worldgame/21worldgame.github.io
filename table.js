// Motor da mesa de 21. Roda no navegador de quem é o anfitrião (ou localmente, na mesa com bots).
// Ele embaralha, dá as cartas e acerta o pote; os outros só recebem o estado (view) e mandam ações.
import { newDeck, handValue, settle } from './logic.js';

export const BOTS = [
  { name: 'Dorival', limit: 16 }, { name: 'Rosa', limit: 17 }, { name: 'Tião', limit: 18 }, { name: 'Neide', limit: 17 },
];
const SEATS = 4;

export class Table {
  constructor({ id, name, minBet = 50, onChange = () => {}, speed = 1, rng = Math.random }) {
    Object.assign(this, { id, name, minBet, onChange, speed, rng });
    this.round = 0; this.phase = 'bet'; this.turn = -1; this.deadline = 0; this.closed = false;
    this.seats = Array.from({ length: SEATS }, (_, i) => this.bot(i));
    this.pending = [];
  }

  bot(i) { const b = BOTS[i % BOTS.length]; return { kind: 'bot', name: b.name, limit: b.limit, bet: 0, hand: [], pay: 0 }; }
  wait(ms) { return new Promise(r => setTimeout(r, ms * this.speed)); }
  emit() { if (!this.closed) this.onChange(this.view()); }
  humans() { return this.seats.filter(s => s.kind === 'human'); }
  seatOf(pid) { return this.seats.findIndex(s => s.kind === 'human' && s.pid === pid); }

  view() {
    return {
      id: this.id, name: this.name, minBet: this.minBet, round: this.round, phase: this.phase, turn: this.turn,
      deadline: this.deadline,
      seats: this.seats.map(s => ({ kind: s.kind, pid: s.pid, name: s.name, look: s.look, profile: s.profile,
        bet: s.bet, hand: s.hand, pay: s.pay, out: s.out, done: s.done })),
    };
  }

  // sentar: no intervalo de apostas troca um bot na hora; no meio da mão entra na próxima
  join(pid, info) {
    if (this.seatOf(pid) >= 0) return this.seatOf(pid);
    const free = this.seats.findIndex(s => s.kind === 'bot');
    if (free < 0) return -1;
    if (this.phase === 'bet') this.seats[free] = { kind: 'human', pid, ...info, bet: 0, hand: [], pay: 0 };
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

  // nome, visual e perfil mudaram no meio do jogo
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
    // primeira aposta abre um prazo de 10 s para os outros; se todos apostaram, começa já
    const waiting = this.humans().filter(s => !s.bet).length;
    if (!waiting) this.startSoon(600);
    else if (!this.deadline) { this.deadline = Date.now() + 10000 * this.speed; this.startSoon(10000); }
    this.emit();
    return true;
  }

  act(pid, a) {
    const i = this.seatOf(pid);
    if (i < 0 || i !== this.turn || this.phase !== 'play') return;
    if (a === 'hit') { this.draw(i); if (handValue(this.seats[i].hand) >= 21) this.resolveTurn?.(); else this.emit(); }
    if (a === 'stand') this.resolveTurn?.();
  }

  draw(i) { this.seats[i].hand.push(this.deck.pop()); }

  startSoon(ms) {
    clearTimeout(this.startTimer);
    this.startTimer = setTimeout(() => this.play(), ms * this.speed);
  }

  async play() {
    if (this.phase !== 'bet' || this.closed) return;
    this.round++; this.phase = 'deal'; this.deadline = 0; this.deck = newDeck(this.rng);
    for (const s of this.seats) {
      if (s.kind === 'bot') s.bet = this.minBet * (1 + Math.floor(this.rng() * 4));
      s.out = !s.bet; s.hand = []; s.pay = 0; s.done = false;
    }
    this.emit();
    await this.wait(700);
    for (let r = 0; r < 2; r++) for (let i = 0; i < SEATS; i++) {
      if (this.seats[i].out) continue;
      this.draw(i); this.emit(); await this.wait(420);
    }

    this.phase = 'play';
    for (let i = 0; i < SEATS; i++) {
      const s = this.seats[i];
      if (s.out) continue;
      this.turn = i;
      if (s.kind === 'bot') {
        this.emit(); await this.wait(600);
        while (handValue(s.hand) < s.limit) { this.draw(i); this.emit(); await this.wait(650); }
      } else if (handValue(s.hand) < 21 && !s.leaving) {
        this.deadline = Date.now() + 20000 * this.speed;
        const turn = new Promise(res => { this.resolveTurn = res; this.turnTimer = setTimeout(res, 20000 * this.speed); });
        this.emit();
        await turn;
        clearTimeout(this.turnTimer); this.resolveTurn = null; this.deadline = 0;
      }
      s.done = true;
    }

    this.turn = -1;
    const live = this.seats.map((s, i) => ({ s, i })).filter(x => !x.s.out);
    const pays = settle(live.map(x => ({ bet: x.s.bet, value: handValue(x.s.hand) })));
    live.forEach((x, k) => { x.s.pay = pays[k]; });
    this.phase = 'done'; this.emit();
    await this.wait(6500);

    // próxima rodada: limpa a mesa, quem saiu vira bot, quem esperava senta
    this.phase = 'bet';
    this.seats = this.seats.map((s, i) => (s.leaving ? this.bot(i) : { ...s, bet: 0, hand: [], pay: 0, out: false, done: false }));
    for (const p of this.pending.splice(0)) {
      const free = this.seats.findIndex(s => s.kind === 'bot');
      if (free >= 0) this.seats[free] = { kind: 'human', pid: p.pid, ...p.info, bet: 0, hand: [], pay: 0 };
    }
    this.emit();
  }

  close() { this.closed = true; clearTimeout(this.startTimer); clearTimeout(this.turnTimer); this.resolveTurn?.(); }
}
