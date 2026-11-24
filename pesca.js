// Pesqueiro (regras puras, sem DOM): lugares, varas, iscas, caixa térmica, sorteio do peixe, briga e peixaria.
// A pesca só anda com a tela aberta (pesca-ui.js): lança, espera a boia afundar, fisga, puxa sem arrebentar a linha e tira da água.
// Preço por kg perto do que a peixaria paga ao pescador (tilápia ~R$ 12/kg, pintado ~R$ 24/kg); muda um pouco todo mês.

export const SPECIES = {
  lambari: { label: 'lambari', min: 0.05, max: 0.2, kg: 18, power: 0.15, img: '🐟' },
  tilapia: { label: 'tilápia', min: 0.4, max: 2.6, kg: 12, power: 0.35, img: '🐟' },
  traira: { label: 'traíra', min: 0.5, max: 3.5, kg: 11, power: 0.55, img: '🐟' },
  carpa: { label: 'carpa', min: 1, max: 16, kg: 9, power: 0.5, img: '🐠' },
  pacu: { label: 'pacu', min: 1, max: 9, kg: 17, power: 0.6, img: '🐠' },
  tambacu: { label: 'tambacu', min: 1.5, max: 14, kg: 15, power: 0.65, img: '🐠' },
  tucunare: { label: 'tucunaré', min: 1, max: 7, kg: 22, power: 0.8, img: '🐡' },
  pintado: { label: 'pintado', min: 3, max: 32, kg: 24, power: 0.75, img: '🐡' },
  dourado: { label: 'dourado', min: 2, max: 22, kg: 26, power: 0.95, img: '🐡' },
  pirarucu: { label: 'pirarucu', min: 25, max: 160, kg: 20, power: 1, img: '🦈' },
};
// entrada vale 30 min de pesca na tela (ticket do pesque-pague)
export const SPOTS = {
  lagoa: { label: 'lagoa da fazenda', fee: 0, rod: 0, fish: { lambari: 20, tilapia: 55, traira: 25 }, txt: 'De graça. Peixe pequeno, bom para treinar a mão.' },
  pesqueiro: { label: 'pesque-pague', fee: 150, rod: 1, fish: { tilapia: 30, pacu: 25, tambacu: 22, carpa: 18, pintado: 5 }, txt: 'Tanques cheios de pacu, tambacu e carpa. De vez em quando sai um pintado.' },
  represa: { label: 'represa', fee: 1500, rod: 2, fish: { tucunare: 32, pintado: 28, dourado: 22, tambacu: 15, pirarucu: 3 }, txt: 'Peixe esportivo e caro. Pede vara boa e sai até pirarucu.' },
};
export const TICKET_MS = 30 * 60 * 1000;
// força = quanto a linha aguenta antes de arrebentar · recolhe = velocidade de puxar · maxKg = acima disso a vara não segura
export const RODS = [
  { label: 'vara de bambu', price: 0, force: 0.45, reel: 0.8, maxKg: 4 },
  { label: 'vara com molinete', price: 1200, force: 0.7, reel: 1, maxKg: 18 },
  { label: 'carretilha de arremesso', price: 25000, force: 0.9, reel: 1.2, maxKg: 40 },
  { label: 'vara pesada (multifilamento)', price: 32000, force: 1.15, reel: 1.35, maxKg: 200 },
];
// isca: puxa a chance de cada peixe (x) e quanto aumenta o peso (big)
export const BAITS = {
  minhoca: { label: 'minhoca', pack: 20, price: 30, like: { lambari: 2, tilapia: 1.3, traira: 0.6 }, big: 1 },
  massa: { label: 'massa de milho', pack: 20, price: 50, like: { tilapia: 1.6, pacu: 1.8, tambacu: 1.6, carpa: 2 }, big: 1.05 },
  viva: { label: 'isca viva (lambari)', pack: 10, price: 90, like: { traira: 2, tucunare: 1.8, pintado: 2, dourado: 2, pirarucu: 1.6 }, big: 1.15 },
};
export const COOLERS = [
  { label: 'isopor', price: 0, cap: 15 },
  { label: 'caixa térmica 60 L', price: 900, cap: 45 },
  { label: 'caixa térmica 150 L', price: 4200, cap: 120 },
  { label: 'freezer na caminhonete', price: 18000, cap: 400 },
];
export const SPOIL = 0.18, SPOIL_MAX = 4;   // perde 18% do preço a cada mês do mundo no gelo; no 5º mês estraga
// cansaço: depois de 2 h de pesca no mesmo dia real o peixe belisca cada vez menos (segura robô de clique e o dia inteiro na beira)
export const TIRED_H = 2;
export function fatigue(s, day) {
  const p = ensure(s); if (p.day?.d !== day) p.day = { d: day, sec: 0 };
  return Math.min(6, 1 + Math.max(0, p.day.sec / 3600 - TIRED_H) * 3);   // multiplica a espera pela beliscada
}
export const fished = (s, day, sec) => { fatigue(s, day); s.pesca.day.sec = Math.round((s.pesca.day.sec + sec) * 10) / 10; };
export const TROPHY = 0.8, TROPHY_BONUS = 0.5;   // peixe com 80% do peso máximo vale 50% a mais (vai para restaurante)

export function ensure(s) {
  const p = (s.pesca ??= {});
  p.rods ??= [0]; p.rod ??= 0; p.cooler ??= 0; p.baits ??= {}; p.box ??= []; p.tickets ??= {}; p.mkt ??= {};
  p.n ??= 0; p.kg ??= 0; p.earned ??= 0; p.best ??= {};
  for (const k of Object.keys(SPECIES)) p.mkt[k] ??= 1;
  p.box = p.box.filter(f => f && SPECIES[f.sp]);
  // celular e computador juntos: a junção soma números mexidos nos dois lados; aqui volta para um valor válido
  p.rods = [...new Set(p.rods.filter(i => RODS[i]))]; if (!p.rods.includes(0)) p.rods.unshift(0);
  if (!p.rods.includes(p.rod)) p.rod = Math.max(...p.rods);
  p.cooler = Math.max(0, Math.min(COOLERS.length - 1, Math.floor(p.cooler) || 0));
  for (const k of Object.keys(p.baits)) p.baits[k] = Math.max(0, Math.floor(p.baits[k]) || 0);
  for (const k of Object.keys(p.best)) if (SPECIES[k]) p.best[k] = Math.min(SPECIES[k].max, p.best[k]); else delete p.best[k];
  for (const k of Object.keys(p.mkt)) p.mkt[k] = Math.min(1.35, Math.max(0.7, Number(p.mkt[k]) || 1));
  return p;
}
export const boxKg = s => ensure(s).box.reduce((t, f) => t + f.kg, 0);
export const freeKg = s => COOLERS[ensure(s).cooler].cap - boxKg(s);
export const priceKg = (s, sp) => Math.round(SPECIES[sp].kg * (ensure(s).mkt[sp] || 1) * 100) / 100;
export function fishValue(s, f) {
  const fresh = Math.max(0, 1 - SPOIL * (f.age || 0));
  return Math.round(f.kg * priceKg(s, f.sp) * fresh * (f.trophy ? 1 + TROPHY_BONUS : 1));
}
export const value = s => (s.pesca?.box || []).reduce((t, f) => t + fishValue(s, f), 0);

const err = t => ({ err: t });
export function buyRod(s, i) {
  const p = ensure(s), R = RODS[i]; if (!R) return err('vara inválida.');
  if (p.rods.includes(i)) { p.rod = i; return { cost: 0 }; }
  if (s.money < R.price) return err('dinheiro insuficiente para a vara.');
  s.money -= R.price; p.rods.push(i); p.rod = i; return { cost: R.price };
}
export function buyCooler(s, i) {
  const p = ensure(s), C = COOLERS[i]; if (!C || i <= p.cooler) return err('você já tem uma caixa igual ou maior.');
  if (s.money < C.price) return err('dinheiro insuficiente para a caixa.');
  s.money -= C.price; p.cooler = i; return { cost: C.price };
}
export function buyBait(s, k, packs = 1) {
  const p = ensure(s), B = BAITS[k]; packs = Math.floor(packs);
  if (!B || packs < 1 || packs > 50) return err('isca inválida.');
  const cost = B.price * packs; if (s.money < cost) return err('dinheiro insuficiente para a isca.');
  s.money -= cost; p.baits[k] = (p.baits[k] || 0) + B.pack * packs; return { cost, n: B.pack * packs };
}
export const ticketLeft = (s, spot, now = Date.now()) => Math.min(TICKET_MS, Math.max(0, (ensure(s).tickets[spot] || 0) - now));   // min: dois aparelhos pagando juntos não somam horário
export function enter(s, spot, now = Date.now()) {
  const p = ensure(s), S = SPOTS[spot]; if (!S) return err('lugar inválido.');
  if (!p.rods.some(i => i >= S.rod)) return err(`aqui precisa de ${RODS[S.rod].label} ou melhor.`);
  if (ticketLeft(s, spot, now) || !S.fee) return { cost: 0 };
  if (s.money < S.fee) return err('dinheiro insuficiente para a entrada.');
  s.money -= S.fee; p.tickets[spot] = now + TICKET_MS; return { cost: S.fee };
}
// gasta a isca na hora do lançamento (fisgou ou não, ela vai)
export function cast(s, spot, bait, now = Date.now()) {
  const p = ensure(s), S = SPOTS[spot];
  if (!S) return err('lugar inválido.');
  if (S.fee && !ticketLeft(s, spot, now)) return err('a entrada venceu: pague de novo para continuar.');
  if (p.rod < S.rod) return err(`use ${RODS[S.rod].label} ou melhor aqui.`);
  if (!BAITS[bait] || !(p.baits[bait] > 0)) return err('sem isca: compre na lojinha.');
  p.baits[bait]--; return { ok: true };
}
// qual peixe beliscou (peso perto do mínimo é comum, peixe grande é raro)
export function roll(spot, bait, rng = Math.random) {
  const S = SPOTS[spot], B = BAITS[bait] || { like: {}, big: 1 };
  const w = Object.entries(S.fish).map(([k, v]) => [k, v * (B.like[k] || 1)]), tot = w.reduce((t, [, v]) => t + v, 0);
  let r = rng() * tot; const sp = (w.find(([, v]) => (r -= v) < 0) || w.at(-1))[0], F = SPECIES[sp];
  const kg = Math.round(Math.min(F.max, F.min + (F.max - F.min) * Math.pow(rng(), 2.2) * B.big) * 100) / 100;
  return { sp, kg, trophy: kg >= F.max * TROPHY };
}
// briga: quanto o peixe puxa (0-1) para esta vara; peixe acima do que a vara segura puxa muito mais
export function fight(f, rodI) {
  const R = RODS[rodI], F = SPECIES[f.sp], load = f.kg / R.maxKg;
  return {
    pull: Math.min(1.6, (0.35 + F.power * 0.5 + (f.kg - F.min) / (F.max - F.min + 0.01) * 0.35) / R.force * (load > 1 ? 1 + (load - 1) * 0.8 : 1)),
    reel: R.reel, stamina: 6 + F.power * 10 + Math.sqrt(f.kg) * 1.2,   // segundos de briga cheia
  };
}
// passo da briga (dt em segundos; hold = está puxando). Linha 0-100; distância 100 = fundo, 0 = na beira.
export function step(st, hold, dt, rng = Math.random) {
  const fx = st.fx;
  if (rng() < dt * 0.35 && st.stam > 0) st.run = 0.6 + rng() * 1.2;          // arrancada do peixe
  const pulling = st.run > 0 ? 1.8 : 1, tired = st.stam > 0 ? 1 : 0.35;
  st.run = Math.max(0, st.run - dt);
  if (hold) {
    st.tension += (14 + 26 * fx.pull * pulling * tired) * dt;
    st.dist -= 11 * fx.reel * (st.run > 0 ? 0.2 : 1) * (st.stam > 0 ? 1 : 1.6) * dt;
    st.stam -= dt;
  } else {
    st.tension -= 40 * dt;
    st.dist += 4 * fx.pull * pulling * tired * dt;
    st.stam -= dt * 0.25;                                                   // dando linha o peixe cansa devagar
  }
  st.tension = Math.max(0, st.tension); st.dist = Math.min(100, Math.max(0, st.dist));
  if (st.tension >= 100) return 'snap';
  if (st.dist >= 100) return 'lost';
  if (st.dist <= 0) return 'land';
  return null;
}
export const newFight = (f, rodI) => ({ fx: fight(f, rodI), tension: 20, dist: 70, stam: fight(f, rodI).stamina, run: 0 });

export function keep(s, f) {
  const p = ensure(s); if (f.kg > freeKg(s)) return err('a caixa térmica está cheia: venda ou solte o peixe.');
  p.box.push({ sp: f.sp, kg: f.kg, trophy: !!f.trophy, age: 0, m: s.month || 0 });
  p.n++; p.kg = Math.round((p.kg + f.kg) * 100) / 100; if (f.kg > (p.best[f.sp] || 0)) p.best[f.sp] = f.kg;
  return { ok: true };
}
// vende tudo da caixa (ou só os índices pedidos)
export function sell(s, idx = null) {
  const p = ensure(s), pick = idx ? new Set(idx) : null; let v = 0, kg = 0, n = 0;
  p.box = p.box.filter((f, i) => { if (pick && !pick.has(i)) return true; v += fishValue(s, f); kg += f.kg; n++; return false; });
  s.money += v; p.earned += v; return { v, kg: Math.round(kg * 100) / 100, n };
}
// fechamento do mês: o gelo envelhece o peixe e a peixaria mexe no preço (±8%, volta devagar para o normal)
export function monthly(s, rng = Math.random) {
  const p = ensure(s), out = [];
  for (const k of Object.keys(p.mkt)) p.mkt[k] = Math.round(Math.min(1.35, Math.max(0.7, 1 + (p.mkt[k] - 1) * 0.7 + (rng() - 0.5) * 0.16)) * 1000) / 1000;
  for (const f of p.box) f.age = (f.age || 0) + 1;
  const bad = p.box.filter(f => f.age > SPOIL_MAX);
  if (bad.length) { p.box = p.box.filter(f => f.age <= SPOIL_MAX); out.push({ txt: `pesca: ${bad.length} ${bad.length === 1 ? 'peixe estragou' : 'peixes estragaram'} na caixa térmica`, val: 0 }); }
  return out;
}
