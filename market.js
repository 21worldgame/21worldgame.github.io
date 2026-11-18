// Mercado ao vivo (regras puras): o preço é uma função do horário, igual para todos os jogadores e sem perder nada ao recarregar.
// Operação por tempo: você escolhe sobe ou desce e a duração (1, 5 ou 10 min). O valor apostado sai na hora e só volta se acertar.
export const ASSETS = {
  boi: { name: 'Boi gordo', ticker: 'BGI', price: 310, vol: 0.012, unit: 'R$/@', dec: 2 },
  soja: { name: 'Soja', ticker: 'SJC', price: 130, vol: 0.016, unit: 'R$/sc', dec: 2 },
  dol: { name: 'Dólar', ticker: 'USD/BRL', price: 5.42, vol: 0.008, unit: 'R$', dec: 4 },
  btc: { name: 'Bitcoin', ticker: 'BTC', price: 520000, vol: 0.03, unit: 'R$', dec: 0 },
};
export const DURATIONS = [1, 5, 10];          // minutos
export const TIMEFRAMES = [1, 5, 10];         // minutos por vela
export const PAYOUT = 1.85;                   // acertou: recebe 1,85x o valor (lucro de 85%); errou ou empatou: perde
export const MIN_STAKE = 100;

// ruído suave e determinístico (mesmo valor para o mesmo instante em qualquer aparelho)
const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
const smooth = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const SEED = { boi: 11, soja: 23, dol: 37, btc: 53 };
// camadas: segundos (tremida), minutos (velas), horas e dias (tendência)
const LAYERS = [[8, 0.06], [45, 0.14], [240, 0.32], [1500, 0.55], [7200, 0.8], [43200, 1.1], [172800, 1.4]];

export function price(asset, ms) {
  const A = ASSETS[asset], t = ms / 1000, s = SEED[asset];
  let lp = 0;
  for (const [period, amp] of LAYERS) lp += smooth(t / period + s * 7.3 + period) * amp;
  return A.price * Math.exp(lp * A.vol * 2.2);
}
// velas de `tf` minutos terminando em `now` (a última está em formação)
export function candles(asset, now, tf = 1, count = 60) {
  const step = tf * 60000, start = Math.floor(now / step) * step - (count - 1) * step, out = [];
  for (let i = 0; i < count; i++) {
    const a = start + i * step, b = Math.min(now, a + step), n = 12;
    let h = -Infinity, l = Infinity;
    for (let k = 0; k <= n; k++) { const p = price(asset, a + ((b - a) * k) / n); if (p > h) h = p; if (p < l) l = p; }
    out.push({ t: a, o: price(asset, a), c: price(asset, b), h, l });
  }
  return out;
}
export const change = (asset, now, minutes = 60) => price(asset, now) / price(asset, now - minutes * 60000) - 1;

export function open(s, { asset, side, stake, minutes }, now) {
  if (!ASSETS[asset]) return { err: 'ativo inválido.' };
  if (!DURATIONS.includes(minutes)) return { err: 'escolha 1, 5 ou 10 minutos.' };
  stake = Math.floor(Number(stake) || 0);
  if (stake < MIN_STAKE) return { err: `o valor mínimo é R$ ${MIN_STAKE}.` };
  if (stake > s.money) return { err: 'dinheiro insuficiente.' };
  s.money -= stake;                                      // o dinheiro entra em jogo na hora
  const t = { id: s.nextId++, asset, side: side > 0 ? 1 : -1, stake, minutes, entry: price(asset, now), at: now, exp: now + minutes * 60000 };
  (s.trades ??= []).push(t);
  return { trade: t };
}
// fecha as que venceram (funciona mesmo se o jogador ficou fora: o preço do vencimento é sempre o mesmo)
export function settle(s, now) {
  const done = [];
  for (const t of [...(s.trades || [])]) {
    if (!t.exp) {                                        // operação do formato antigo (alavancagem): devolve a margem
      s.money += t.margin || 0; s.trades.splice(s.trades.indexOf(t), 1);
      done.push({ ...t, old: true, back: t.margin || 0 }); continue;
    }
    if (now < t.exp) continue;
    const final = price(t.asset, t.exp), win = t.side * (final - t.entry) > 0, back = win ? Math.round(t.stake * PAYOUT) : 0;
    s.money += back; s.trades.splice(s.trades.indexOf(t), 1);
    const r = { ...t, final, win, back };
    s.trHist = [r, ...(s.trHist || [])].slice(0, 15);
    done.push(r);
  }
  return done;
}
export const fmt = (asset, v) => (ASSETS[asset].dec ? v.toFixed(ASSETS[asset].dec).replace('.', ',') : Math.round(v).toLocaleString('pt-BR'));
