// Giro da sorte: todo ano do mundo (12 meses = cerca de 2 h reais) libera 1 giro. 20% das vezes vem uma carta rara (rara ou lendária);
// nas outras 80% a roleta ESTOURA e não vem nada. A carta é item raro: completar a coleção é o objetivo do jogo.
import * as CD from './cards.js';

export const YEAR_MONTHS = 12, WIN_P = 0.2, SLICES = 10, CARD_SLICES = [2, 7];
export const yearOf = m => Math.floor(((m || 1) - 1) / YEAR_MONTHS);
export const ensure = s => (s.sorte ??= { year: yearOf(s.month), n: 0, wins: 0 });
export const ready = s => yearOf(s.month) > ensure(s).year;
export const monthsLeft = s => (ready(s) ? 0 : (ensure(s).year + 1) * YEAR_MONTHS + 1 - (s.month || 1));
// um giro: marca o ano como usado ANTES de qualquer efeito (fechar a janela no meio não devolve o giro) e já guarda a carta
export function spin(s, rng = Math.random) {
  if (!ready(s)) return { err: 'o próximo giro só libera no ano que vem.' };
  const o = ensure(s); o.year = yearOf(s.month); o.n++;
  const win = rng() < WIN_P, pool = [...Array(SLICES).keys()].filter(i => CARD_SLICES.includes(i) === win);
  const slice = pool[Math.floor(rng() * pool.length)];
  if (!win) return { win, slice };
  o.wins++;
  return { win, slice, card: CD.give(s, CD.draw(rng, 1)) };   // no mínimo rara
}
