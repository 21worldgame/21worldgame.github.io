// Regras puras dos jogos novos: Aviator (crash), roleta europeia, trader e roda de prêmios diária. Sem DOM.

// ---------- Aviator ----------
export const CRASH_EDGE = 0.03;                 // 3% da casa, como nos crash games reais
export function crashPoint(rng = Math.random) {
  const u = rng();
  if (u < CRASH_EDGE) return 1;
  return Math.max(1, Math.floor(((1 - CRASH_EDGE) / (1 - u)) * 100) / 100);
}
export const CRASH_K = 0.11;                     // velocidade da subida (2x em ~6,3 s)
export const multAt = sec => Math.floor(Math.exp(CRASH_K * sec) * 100) / 100;
export const timeTo = mult => Math.log(mult) / CRASH_K;

// ---------- roleta europeia (um zero) ----------
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = n => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
// tipos de aposta: n:<número>, red, black, even, odd, low, high, dz1..3, col1..3
export function rouletteWins(bet, n) {
  if (bet.startsWith('n:')) return Number(bet.slice(2)) === n ? 35 : -1;
  if (n === 0) return -1;
  const ok = {
    red: RED.has(n), black: !RED.has(n), even: n % 2 === 0, odd: n % 2 === 1, low: n <= 18, high: n >= 19,
    dz1: n <= 12, dz2: n > 12 && n <= 24, dz3: n > 24, col1: n % 3 === 1, col2: n % 3 === 2, col3: n % 3 === 0,
  }[bet];
  return ok ? (bet.startsWith('dz') || bet.startsWith('col') ? 2 : 1) : -1;
}
// devolve o total que volta para o jogador (aposta + prêmio) dado { tipo: fichas }
export function roulettePay(bets, n) {
  let back = 0;
  for (const [k, amt] of Object.entries(bets)) { const m = rouletteWins(k, n); if (m > 0) back += amt * (m + 1); }
  return back;
}

// ---------- trader: preço com volatilidade que muda em ondas ----------
export const ASSETS = {
  boi: { name: 'Boi gordo', ticker: 'BGI', price: 310, vol: 0.0018, unit: 'R$/@' },
  soja: { name: 'Soja', ticker: 'SJC', price: 130, vol: 0.0022, unit: 'R$/sc' },
  dol: { name: 'Dólar', ticker: 'USD/BRL', price: 5.42, vol: 0.0012, unit: 'R$' },
  btc: { name: 'Bitcoin', ticker: 'BTC', price: 520000, vol: 0.0045, unit: 'R$' },
};
export function newFeed(asset, rng = Math.random) {
  return { price: ASSETS[asset].price, vol: ASSETS[asset].vol, drift: 0, rng };
}
// um tick (~1 s): passeio aleatório com tendência que vira e volatilidade em grupos, como mercado de verdade
export function tickFeed(f) {
  const r = f.rng;
  if (r() < 0.02) f.drift = (r() - 0.5) * f.vol * 0.6;
  f.vol = Math.max(f.vol * 0.4, Math.min(f.vol * 2.5, f.vol * (1 + (r() - 0.5) * 0.1)));
  const shock = (r() + r() + r() - 1.5) * 1.4;       // ~normal
  f.price = Math.max(0.01, f.price * (1 + f.drift + shock * f.vol));
  return f.price;
}
export const TRADE_FEE = 0.001;                       // 0,1% na abertura
// lucro de uma posição: side 1 compra, -1 venda; liquida quando perde a margem
export function pnl(pos, price) {
  const ret = ((price - pos.entry) / pos.entry) * pos.side * pos.lev;
  return Math.max(-pos.margin, pos.margin * ret);
}
export const liqPrice = pos => pos.entry * (1 - pos.side / pos.lev);

// ---------- roda diária: sempre ganha alguma coisa, quase sempre pouco (v235: média ~R$ 350/dia; antes ~R$ 1.500) ----------
export const DAILY_WHEEL = [
  { kind: 'chips', amount: 50, label: '50 fichas', w: 30 },
  { kind: 'money', amount: 500, label: 'R$ 500', w: 22 },
  { kind: 'chips', amount: 100, label: '100 fichas', w: 16 },
  { kind: 'calves', amount: 1, label: '1 bezerro', w: 5 },
  { kind: 'xp', amount: 150, label: '150 XP', w: 13 },
  { kind: 'card', amount: 1, label: 'pacote de cartas', w: 5 },
  { kind: 'money', amount: 2000, label: 'R$ 2 mil', w: 5.5 },
  { kind: 'chips', amount: 300, label: '300 fichas', w: 3 },
  { kind: 'money', amount: 10000, label: 'R$ 10 mil', w: 0.5 },
];
export function spinDaily(rng = Math.random) {
  const tot = DAILY_WHEEL.reduce((a, s) => a + s.w, 0);
  let r = rng() * tot;
  return DAILY_WHEEL.findIndex(s => (r -= s.w) < 0);
}
