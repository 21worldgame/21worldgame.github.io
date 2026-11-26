// Mercado ao vivo (regras puras): o preço é uma função do horário, igual para todos os jogadores e sem perder nada ao recarregar.
// Operação por tempo: você escolhe sobe ou desce e a duração (1, 5 ou 10 min). O valor apostado sai na hora e só volta se acertar.
export const ASSETS = {   // preço base = cotação real de nov/2026 (B3, Cepea); o gráfico oscila em volta dele
  ibov: { name: 'Ibovespa', ticker: 'IBOV', price: 171000, vol: 0.01, unit: 'pts', dec: 0 },
  petr: { name: 'Petrobras PN', ticker: 'PETR4', price: 31, vol: 0.016, unit: 'R$', dec: 2 },
  vale: { name: 'Vale ON', ticker: 'VALE3', price: 66, vol: 0.015, unit: 'R$', dec: 2 },
  itau: { name: 'Itaú PN', ticker: 'ITUB4', price: 36, vol: 0.012, unit: 'R$', dec: 2 },
  boi: { name: 'Boi gordo', ticker: 'BGI', price: 335, vol: 0.012, unit: 'R$/@', dec: 2 },
  soja: { name: 'Soja', ticker: 'SJC', price: 150, vol: 0.016, unit: 'R$/sc', dec: 2 },
  dol: { name: 'Dólar', ticker: 'USD/BRL', price: 5.7, vol: 0.008, unit: 'R$', dec: 4 },
  btc: { name: 'Bitcoin', ticker: 'BTC', price: 420000, vol: 0.03, unit: 'R$', dec: 0 },
};
export const DURATIONS = [1, 5, 10];          // minutos
export const TIMEFRAMES = [1, 5, 10];         // minutos por vela
export const PAYOUT = { 1: 1.55, 5: 1.65, 10: 1.72 }   // v285: paga menos (antes 1,7 / 1,8 / 1,88)   // teto: a melhor estratégia acerta ~52% em 10 min, empate de 1,88x é 53,2%;   // acertou: recebe Nx o valor (quanto mais longo, mais paga); errou ou empatou: perde
export const payout = minutes => PAYOUT[minutes];
export const MIN_STAKE = 100;
// limites (v277): o preço é uma conta fixa no código, então quem a copia sabe o futuro (Light Yagami acertou 14 seguidas com até R$ 11 mi).
// ponytail: limite, não trava; trava de verdade só com o preço sorteado no servidor
export const MAX_STAKE = 20000, DAY_GAIN = 100000;   // v285: era 200 mil e 1 mi (o Light Yagami seguiu acertando quase tudo no BTC simulado)
// acerto só conta se o preço andar pelo menos 0,02% para o seu lado (spread da corretora): parado ou quase parado, perde
export const SPREAD = 0.0002;
export const wins = (side, entry, final) => side * (final - entry) / entry > SPREAD;
// auditoria: 8 acertos seguidos é improvável demais (menos de 1 em 400 mesmo com sorte): a mesa fecha para o jogador até amanhã
export const AUDIT_STREAK = 8;
export const NO_OPEN = new Set(['btc']);   // BTC só no "BTC real" (preço de verdade, decidido no servidor)
const day = now => new Date(now - 3 * 36e5).toISOString().slice(0, 10);   // dia de Brasília
export const dayGain = (s, now) => (s.trDay?.d === day(now) ? s.trDay.net : 0);

// Passeio aleatório determinístico (mesmo valor para o mesmo instante em qualquer aparelho), montado como ponte browniana:
// o futuro não dá para prever pelo gráfico (antes era uma curva suave e dava para lucrar apostando contra o movimento).
const SEED = { boi: 11, soja: 23, dol: 37, btc: 53, ibov: 61, petr: 71, vale: 83, itau: 97 };
const ih = (a, b, c) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
const gauss = (a, b, c) => (ih(a, b, c) + ih(a, b, c + 1e6) + ih(a, b, c + 2e6) + ih(a, b, c + 3e6) - 2) * 1.732;
const P = 2 ** 19, DAY = 4 * 3600, RHO = 0.85, END = 1.6;   // bloco de ~6 dias; ponta de cada bloco puxa devagar de volta para o preço base
const endAt = (s, k) => { let e = 0; for (let j = 0; j < 30; j++) e += RHO ** j * gauss(s, k - j, 7); return e * END; };
function walk(s, t) {
  const k = Math.floor(t / P), u = t - k * P;
  let a = 0, b = P, wa = endAt(s, k), wb = endAt(s, k + 1), lvl = 0;
  while (b - a > 1) { const m = (a + b) / 2, wm = (wa + wb) / 2 + gauss(s, k * 64 + lvl, m) * Math.sqrt((b - a) / 4 / DAY); if (u < m) { b = m; wb = wm; } else { a = m; wa = wm; } lvl++; }
  return wa + (wb - wa) * (u - a);
}
export function price(asset, ms) {
  const A = ASSETS[asset];
  return A.price * Math.exp(walk(SEED[asset], ms / 1000) * A.vol * 2.2);
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
  if (NO_OPEN.has(asset)) return { err: 'o Bitcoin agora é só no BTC real (preço de verdade da Coinbase).' };
  if (!DURATIONS.includes(minutes)) return { err: 'escolha 1, 5 ou 10 minutos.' };
  stake = Math.floor(Number(stake) || 0);
  if (stake < MIN_STAKE) return { err: `o valor mínimo é R$ ${MIN_STAKE}.` };
  if (stake > MAX_STAKE) return { err: `o valor máximo por operação é R$ ${MAX_STAKE.toLocaleString('pt-BR')}.` };
  if (stake > s.money) return { err: 'dinheiro insuficiente.' };
  if (s.trAudit === day(now)) return { err: 'auditoria da corretora: sequência de acertos improvável. A mesa abre de novo amanhã.' };
  if (dayGain(s, now) >= DAY_GAIN) return { err: `você já lucrou R$ ${DAY_GAIN.toLocaleString('pt-BR')} na mesa hoje: ela abre de novo amanhã.` };
  s.money -= stake;                                      // o dinheiro entra em jogo na hora
  const t = { id: s.nextId++, asset, side: side > 0 ? 1 : -1, stake, minutes, entry: price(asset, now), pay: payout(minutes), at: now, exp: now + minutes * 60000 };
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
    const final = price(t.asset, t.exp), win = wins(t.side, t.entry, final), back = win ? Math.round(t.stake * (t.pay ?? 1.85)) : 0;   // sem pay = aberta antes da v199, quando tudo pagava 1,85x
    s.money += back; s.trades.splice(s.trades.indexOf(t), 1);
    const dd = day(t.exp); s.trDay = { d: dd, net: (s.trDay?.d === dd ? s.trDay.net : 0) + back - t.stake };
    s.trStreak = win ? (s.trStreak || 0) + 1 : 0; if (s.trStreak >= AUDIT_STREAK) { s.trAudit = dd; s.trStreak = 0; }
    const r = { ...t, final, win, back };
    s.trHist = [r, ...(s.trHist || [])].slice(0, 15);
    done.push(r);
  }
  return done;
}
export const fmt = (asset, v) => (ASSETS[asset].dec ? v.toFixed(ASSETS[asset].dec).replace('.', ',') : Math.round(v).toLocaleString('pt-BR'));
