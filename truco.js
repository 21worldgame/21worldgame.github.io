// Truco paulista (regras puras, sem tela). 4 jogadores em duplas (lugares 0 e 2 contra 1 e 3), baralho de 40 cartas.
// Vira define a manilha (a carta seguinte); força da manilha por naipe: ouros < espadas < copas < paus (zap).
// Mão vale 1; truco 3, seis 6, nove 9, doze 12. Quem pede espera a outra dupla aceitar, correr ou aumentar.
// Empate ("cangou"): empatou a 1ª, quem ganhar a 2ª leva; ganhou a 1ª e empatou depois, leva quem ganhou a 1ª.
// Mão de onze: a dupla com 11 vê as cartas do parceiro e decide jogar (vale 3) ou correr (outra dupla +1); não tem truco.
// Mão de ferro (11 a 11): vale 1, sem truco. Partida até 12 pontos.
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUITS = ['♦', '♠', '♥', '♣'];
export const SUIT_NAME = { '♦': 'ouros', '♠': 'espadas', '♥': 'copas', '♣': 'paus' };
export const MANILHA_NAME = { '♣': 'zap', '♥': 'copas', '♠': 'espadilha', '♦': 'pica-fumo' };
export const RAISE_NAME = { 3: 'truco', 6: 'seis', 9: 'nove', 12: 'doze' };
export const GOAL = 12;
export const nextValue = v => (v === 1 ? 3 : v + 3);
export const team = seat => seat % 2;
export const newDeck = () => RANKS.flatMap(r => SUITS.map(s => ({ r, s })));
export const manilhaOf = vira => RANKS[(RANKS.indexOf(vira.r) + 1) % RANKS.length];
// força: carta encoberta vale nada; manilha acima de tudo
export const power = (c, mani) => (c.hidden ? -1 : c.r === mani ? 100 + SUITS.indexOf(c.s) : RANKS.indexOf(c.r));
export function shuffle(a, rng = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// quem leva a mão a partir das rodadas (0/1 = dupla, -1 = empate); undefined = ainda não decidiu; null = ninguém (tudo empatado)
export function handWinner(t) {
  const w = [t.filter(x => x === 0).length, t.filter(x => x === 1).length];
  if (w[0] >= 2) return 0; if (w[1] >= 2) return 1;
  if (t.length >= 2) {
    if (t[0] === -1 && t[1] !== -1) return t[1];
    if (t[0] !== -1 && t[1] === -1) return t[0];
  }
  if (t.length === 3) return t[2] !== -1 ? t[2] : t[0] !== -1 ? t[0] : t[1] !== -1 ? t[1] : null;
  return undefined;
}
// quem ganha a rodada: maior carta; maiores iguais de duplas diferentes = empate
export function trickWinner(table, mani) {
  const best = Math.max(...table.map(p => power(p.card, mani)));
  const top = table.filter(p => power(p.card, mani) === best);
  const teams = new Set(top.map(p => team(p.seat)));
  return { team: teams.size === 1 ? team(top[0].seat) : -1, seat: top[0].seat };
}
// força da mão para os bots (0 a ~1)
export function strength(cards, mani) { return cards.reduce((t, c) => t + Math.min(1, (power(c, mani) + 1) / (c.r === mani ? 100 : 12)) * (c.r === mani ? 1.15 : 0.55), 0) / 2.2; }

export class Truco {
  constructor({ id = 't', name = 'mesa de truco', stake = 100, onChange = () => {}, rng = Math.random, auto = true, botDelay = 900, turnMs = 40000 } = {}) {
    Object.assign(this, { id, name, stake, onChange, rng, auto, botDelay, turnMs });
    this.seats = [0, 1, 2, 3].map(() => ({ kind: 'empty' }));
    this.score = [0, 0]; this.phase = 'wait'; this.dealer = 0; this.msg = 'Esperando jogadores. Lugares vazios viram jogadores da casa.';
    this.games = 0; this.timers = new Set();
  }
  // ---------- lugares ----------
  join(pid, info, seat) {
    if (this.seats.some(s => s.pid === pid)) return this.emit();
    const free = seat ?? [0, 2, 1, 3].find(i => this.seats[i].kind !== 'human') ?? -1;   // o 1º amigo senta de parceiro (lugar da frente)
    if (free < 0 || this.seats[free]?.kind === 'human') return null;
    if (this.phase !== 'wait' && this.phase !== 'gameEnd' && this.seats[free].kind === 'bot') { this.seats[free] = { ...this.seats[free], kind: 'human', pid, name: info?.name || 'jogador', look: info?.look }; this.msg = `${this.seats[free].name} assumiu o lugar.`; }   // entra no lugar de um jogador da casa
    else this.seats[free] = { kind: 'human', pid, name: info?.name || 'jogador', look: info?.look };
    this.emit(); return free;
  }
  leave(pid) {
    const i = this.seats.findIndex(s => s.pid === pid); if (i < 0) return;
    this.seats[i] = { kind: 'bot', name: this.botName(i) };     // a casa assume para a partida não parar
    this.emit(); this.schedule();
  }
  botName(i) { return this.botNames?.[i] || ['Coringa021', 'SemanaUm', 'RecomecoBR', 'PrimeiroMes'][i]; }
  fill() { this.seats = this.seats.map((s, i) => (s.kind === 'human' ? s : { kind: 'bot', name: this.botName(i) })); }
  seatOf(pid) { return this.seats.findIndex(s => s.kind === 'human' && s.pid === pid); }

  // ---------- partida ----------
  start() {
    if (this.phase !== 'wait' && this.phase !== 'gameEnd') return 'a partida já está rolando.';
    this.fill(); this.score = [0, 0]; this.dealer = Math.floor(this.rng() * 4); this.games++;
    this.deal(); return null;
  }
  deal() {
    const deck = shuffle(newDeck(), this.rng), vira = deck.pop();
    this.hand = { vira, mani: manilhaOf(vira), cards: [0, 1, 2, 3].map(() => deck.splice(0, 3)), table: [], tricks: [], value: 1, raise: null, lastRaise: null, lastTrick: null };
    this.hand.starter = (this.dealer + 1) % 4; this.turn = this.hand.starter;
    const on = [this.score[0] === GOAL - 1, this.score[1] === GOAL - 1];
    this.hand.iron = on[0] && on[1];
    if (on[0] !== on[1]) { this.phase = 'onze'; this.hand.onze = on[0] ? 0 : 1; this.msg = `Mão de onze para a dupla ${this.hand.onze + 1}: jogar (vale 3) ou correr?`; }
    else { this.phase = 'play'; this.msg = this.hand.iron ? 'Mão de ferro: 11 a 11, quem ganhar leva.' : `Vira ${vira.r}${vira.s}: manilha é o ${this.hand.mani}.`; }
    this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule();
  }
  canRaise(seat) {
    const h = this.hand;
    return this.phase === 'play' && this.turn === seat && !h.iron && h.onze == null && h.value < GOAL && h.lastRaise !== team(seat);
  }
  act(seat, a) {
    if (seat < 0 || !this.hand && a.t !== 'start') return 'jogada inválida.';
    const h = this.hand;
    if (a.t === 'start') return this.start();
    if (this.phase === 'onze') {
      if (team(seat) !== h.onze || (a.t !== 'onze-play' && a.t !== 'onze-run')) return 'é a outra dupla que decide a mão de onze.';
      if (a.t === 'onze-run') return this.endHand(1 - h.onze, 1, 'correu na mão de onze');
      h.value = 3; this.phase = 'play'; this.msg = 'Mão de onze aceita: vale 3.'; this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); return null;
    }
    if (this.phase === 'raise') {
      const r = h.raise; if (team(seat) === r.by) return 'espere a outra dupla responder.';
      if (a.t === 'accept') { h.value = r.to; h.lastRaise = r.by; h.raise = null; this.phase = 'play'; this.msg = `${this.seats[seat].name} aceitou: a mão vale ${h.value}.`; }
      else if (a.t === 'run') return this.endHand(r.by, h.value, `${this.seats[seat].name} correu`);
      else if (a.t === 'raise' && r.to < GOAL) { h.value = r.to; h.raise = { by: team(seat), to: nextValue(r.to), asker: seat }; this.msg = `${this.seats[seat].name} pediu ${RAISE_NAME[h.raise.to].toUpperCase()}!`; }
      else return 'resposta inválida.';
      this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); return null;
    }
    if (this.phase !== 'play') return 'espere.';
    if (a.t === 'truco') {
      if (!this.canRaise(seat)) return 'agora não dá para pedir.';
      h.raise = { by: team(seat), to: nextValue(h.value), asker: seat }; this.phase = 'raise';
      this.msg = `${this.seats[seat].name} pediu ${RAISE_NAME[h.raise.to].toUpperCase()}!`;
      this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); return null;
    }
    if (a.t !== 'play') return 'jogada inválida.';
    if (this.turn !== seat) return 'não é a sua vez.';
    const card = h.cards[seat][a.i]; if (!card) return 'carta inválida.';
    if (a.hidden && !h.tricks.length) return 'na primeira rodada não dá para jogar encoberta.';
    h.cards[seat].splice(a.i, 1);
    h.table.push({ seat, card: { ...card, hidden: !!a.hidden } });
    if (h.table.length < 4) { this.turn = (this.turn + 1) % 4; this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); return null; }
    // fecha a rodada
    const w = trickWinner(h.table, h.mani);
    h.tricks.push(w.team); h.lastTrick = { table: h.table, winner: w };
    this.msg = w.team === -1 ? 'Cangou! Rodada empatada.' : `${this.seats[w.seat].name} levou a rodada.`;
    const res = handWinner(h.tricks);
    if (res !== undefined) return this.endHand(res, h.value, res === null ? 'tudo empatado, ninguém pontua' : 'ganhou a mão');
    this.phase = 'trick'; this.emit();
    this.later(() => { h.table = []; this.turn = w.seat; this.phase = 'play'; this.deadline = Date.now() + this.turnMs; this.emit(); this.schedule(); }, 1300);
    return null;
  }
  endHand(t, value, why) {
    const h = this.hand;
    if (t != null) this.score[t] = Math.min(GOAL, this.score[t] + value);
    this.phase = 'handEnd'; h.result = { team: t, value, why };
    this.msg = t == null ? 'Mão empatada: ninguém pontua.' : `Dupla ${t + 1} fez ${value} ${value === 1 ? 'ponto' : 'pontos'} (${why}).`;
    if (this.score[0] >= GOAL || this.score[1] >= GOAL) { this.phase = 'gameEnd'; this.winner = this.score[0] >= GOAL ? 0 : 1; this.msg = `Fim de partida! Dupla ${this.winner + 1} venceu ${this.score[this.winner]} a ${this.score[1 - this.winner]}.`; this.emit(); return null; }
    this.emit();
    this.later(() => { this.dealer = (this.dealer + 1) % 4; this.deal(); }, 2200);
    return null;
  }
  // ---------- jogadores da casa ----------
  later(fn, ms) { if (!this.auto) { this.queue = fn; return; } const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); }
  flush() { const f = this.queue; this.queue = null; f?.(); }      // testes: roda a etapa pendente
  // quem precisa agir agora
  who() {
    const h = this.hand; if (!h) return [];
    if (this.phase === 'play') return [this.turn];
    if (this.phase === 'raise') return [0, 1, 2, 3].filter(s => team(s) !== h.raise.by);
    if (this.phase === 'onze') return [0, 1, 2, 3].filter(s => team(s) === h.onze);
    return [];
  }
  schedule() {
    if (!this.auto) return;
    clearTimeout(this.botT); clearTimeout(this.idleT);
    const need = this.who(); if (!need.length) return;
    // na vez de jogar age quem está na vez; para responder, se tiver humano na dupla, o humano decide
    const human = need.some(s => this.seats[s].kind === 'human'), bot = need.find(s => this.seats[s].kind === 'bot');
    if (this.phase === 'play' ? this.seats[need[0]].kind === 'bot' : !human) this.botT = setTimeout(() => this.botAct(this.phase === 'play' ? need[0] : bot), this.botDelay + this.rng() * 600);
    else this.idleT = setTimeout(() => this.timeout(), Math.max(1000, this.deadline - Date.now()));
  }
  timeout() {   // humano demorou: joga a menor carta / aceita
    const need = this.who(); if (!need.length) return;
    const s = need[0];
    if (this.phase === 'play') this.act(s, { t: 'play', i: this.order(s)[0] });
    else if (this.phase === 'raise') this.act(s, { t: 'accept' });
    else if (this.phase === 'onze') this.act(s, { t: 'onze-play' });
  }
  order(seat) { const h = this.hand, c = h.cards[seat]; return c.map((x, i) => i).sort((a, b) => power(c[a], h.mani) - power(c[b], h.mani)); }
  botAct(seat) {
    const h = this.hand, r = this.rng, st = strength(h.cards[seat].concat(h.cards[(seat + 2) % 4].length && this.phase === 'onze' ? h.cards[(seat + 2) % 4] : []), h.mani);
    const won = h.tricks.filter(x => x === team(seat)).length, lost = h.tricks.filter(x => x === 1 - team(seat)).length;
    if (this.phase === 'onze') return this.act(seat, { t: st > 0.42 || r() < 0.2 ? 'onze-play' : 'onze-run' });
    if (this.phase === 'raise') {
      const conf = st + won * 0.25 - lost * 0.3;
      if (conf > 0.8 && h.raise.to < GOAL && r() < 0.5) return this.act(seat, { t: 'raise' });
      return this.act(seat, { t: conf > 0.36 || r() < 0.12 ? 'accept' : 'run' });
    }
    if (this.phase !== 'play' || this.turn !== seat) return;
    if (this.canRaise(seat) && (st + won * 0.3 > 0.72 && r() < 0.55 || r() < 0.04)) return this.act(seat, { t: 'truco' });
    const ord = this.order(seat), c = h.cards[seat];
    if (!h.table.length) return this.act(seat, { t: 'play', i: h.tricks.length ? ord[ord.length - 1] : ord[Math.min(1, ord.length - 1)] });
    const best = trickWinner(h.table, h.mani), bestP = Math.max(...h.table.map(p => power(p.card, h.mani)));
    if (best.team === team(seat) && best.seat !== seat) return this.act(seat, { t: 'play', i: ord[0], hidden: h.tricks.length > 0 && r() < 0.3 });   // parceiro já está ganhando
    const beat = ord.find(i => power(c[i], h.mani) > bestP);
    return this.act(seat, { t: 'play', i: beat ?? ord[0], hidden: beat == null && h.tricks.length > 0 && r() < 0.4 });
  }
  close() { for (const t of this.timers) clearTimeout(t); clearTimeout(this.botT); clearTimeout(this.idleT); this.closed = true; }
  emit() { if (!this.closed) this.onChange(this); }
  // o que cada lugar pode ver (mão dos outros fica escondida; na mão de onze a dupla vê o parceiro)
  view(seat) {
    const h = this.hand;
    return {
      id: this.id, name: this.name, stake: this.stake, phase: this.phase, msg: this.msg, score: this.score, turn: this.turn, dealer: this.dealer, winner: this.winner, games: this.games,
      deadline: this.deadline, seat,
      seats: this.seats.map(s => ({ kind: s.kind, name: s.name, look: s.look, pid: s.pid })),
      hand: h && {
        vira: h.vira, mani: h.mani, value: h.value, raise: h.raise, tricks: h.tricks, onze: h.onze, iron: h.iron, result: h.result, lastRaise: h.lastRaise,
        table: (this.phase === 'trick' || this.phase === 'handEnd' || this.phase === 'gameEnd') && !h.table.length && h.lastTrick ? h.lastTrick.table : h.table,
        cards: h.cards.map((c, i) => (i === seat || (this.phase === 'onze' && seat >= 0 && team(i) === team(seat) && team(seat) === h.onze) ? c : c.map(() => null))),
        canRaise: seat >= 0 && this.canRaise(seat),
      },
    };
  }
}
