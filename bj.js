// Blackjack de cassino (regras puras, sem DOM): sapato de 6 baralhos, dealer para no 17 (S17), blackjack paga 3:2,
// dobra com 2 cartas, divide pares uma vez, dealer confere blackjack (peek) com Ás ou 10 à mostra.
export const DECKS = 6;
export const CUT = 0.75;                 // embaralha quando 75% do sapato saiu
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function newShoe(rng = Math.random, decks = DECKS) {
  const s = [];
  for (let d = 0; d < decks; d++) for (const su of SUITS) for (const r of RANKS) s.push({ r, s: su });
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return { cards: s, size: s.length };
}
export const needsShuffle = shoe => shoe.cards.length < shoe.size * (1 - CUT);
export const cardValue = c => (c.r === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r));

export function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += cardValue(c); if (c.r === 'A') aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 && t <= 21 };
}
export const value = cards => total(cards).t;
export const isBlackjack = (cards, fromSplit = false) => !fromSplit && cards.length === 2 && value(cards) === 21;
export const canDouble = h => h.cards.length === 2 && !h.done;
export const canSplit = (h, handsCount) => handsCount === 1 && h.cards.length === 2 && cardValue(h.cards[0]) === cardValue(h.cards[1]);

// dealer: compra até 17; para em 17 macio também (S17)
export function dealerPlays(cards) { return value(cards) < 17; }
export const dealerPeeks = up => up && (up.r === 'A' || cardValue(up) === 10);

// quanto volta para a mão (aposta + prêmio); 0 = perdeu
export function payout(hand, dealerCards) {
  const pv = value(hand.cards), dv = value(dealerCards);
  const pbj = isBlackjack(hand.cards, hand.split), dbj = isBlackjack(dealerCards);
  if (pv > 21) return 0;
  if (pbj && !dbj) return Math.floor(hand.bet * 2.5);
  if (dbj && !pbj) return 0;
  if (pbj && dbj) return hand.bet;
  if (dv > 21 || pv > dv) return hand.bet * 2;
  if (pv === dv) return hand.bet;
  return 0;
}
export function outcome(hand, dealerCards) {
  const p = payout(hand, dealerCards);
  if (value(hand.cards) > 21) return 'estourou';
  if (p > hand.bet * 2) return 'blackjack';
  return p > hand.bet ? 'ganhou' : p === hand.bet ? 'empate' : 'perdeu';
}

// estratégia básica simplificada para os bots (S17, 6 baralhos)
export function botAction(hand, up, handsCount, chipsOk = true) {
  const { t, soft } = total(hand.cards), u = cardValue(up);
  if (chipsOk && canSplit(hand, handsCount)) {
    const r = hand.cards[0].r;
    if (r === 'A' || r === '8') return 'split';
    if (['2', '3', '6', '7', '9'].includes(r) && u <= 7 && u !== 7 || (r === '9' && u <= 9 && u !== 7)) return 'split';
  }
  if (chipsOk && hand.cards.length === 2) {
    if (!soft && (t === 11 || (t === 10 && u <= 9) || (t === 9 && u >= 3 && u <= 6))) return 'double';
    if (soft && t >= 15 && t <= 18 && u >= 4 && u <= 6) return 'double';
  }
  if (soft) return t >= 19 || (t === 18 && u <= 8) ? 'stand' : 'hit';
  if (t >= 17) return 'stand';
  if (t >= 13 && u <= 6) return 'stand';
  if (t === 12 && u >= 4 && u <= 6) return 'stand';
  return 'hit';
}

// ---------- banca ----------
// Quem tem conta ganha no máximo WINS_PER_YEAR mãos por ano do mundo; antes disso a banca já leva RIG_P das rodadas.
// A banca escolhe a carta escondida do dealer e as que ele compra, sempre dentro da regra (compra até 16, para no 17),
// para ele terminar acima da maior mão viva dos jogadores marcados. Nada aparece diferente na mesa.
export const WINS_PER_YEAR = 2, RIG_P = 0.75;
const take = (shoe, ok) => { for (let i = shoe.cards.length - 1; i >= 0; i--) if (ok(shoe.cards[i])) return shoe.cards.splice(i, 1)[0]; return null; };
// a melhor carta para o dealer com `cs`: termina acima de need, senão empata, senão continua comprando sem estourar
function best(shoe, cs, need, bad = () => false) {
  const v = c => value([...cs, c]), end = c => !bad(c) && v(c) >= 17 && v(c) <= 21;
  return take(shoe, c => end(c) && v(c) > need) || take(shoe, c => end(c) && v(c) === need) || take(shoe, c => !bad(c) && v(c) < 17);
}
// troca a carta escondida (escondida até a revelação) e diz qual carta o dealer compra
export function rigHole(dealer, shoe, need) {
  const peeked = dealerPeeks(dealer[0]), c = best(shoe, [dealer[0]], need, x => peeked && value([dealer[0], x]) === 21);   // conferiu blackjack e não tinha: não pode virar blackjack
  if (c) { shoe.cards.unshift(dealer[1]); dealer[1] = c; }
}
export const rigDraw = (dealer, shoe, need) => best(shoe, dealer, need) || shoe.cards.pop();
// segunda carta de quem está marcado nunca fecha blackjack
export const noBJ = (first, shoe) => take(shoe, c => value([first, c]) !== 21) || shoe.cards.pop();
