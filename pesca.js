// Pesqueiro (regras puras, sem DOM): lugares, varas, iscas, caixa térmica, arremesso, briga com física, peixaria e encomendas.
// A pesca só anda com a tela aberta (pesca-ui.js): arremessa, espera a boia afundar, fisga, cansa o peixe sem arrebentar a linha e tira com o puçá.
// Briga no modelo dos simuladores: a linha arrebenta quando a força passa do limite dela; a fricção do molinete deixa a linha
// escorregar antes disso (o peixe ganha distância mas a linha não quebra). Cada espécie tem fôlego e jeito próprio de brigar.
// Preço por kg perto do que a peixaria paga ao pescador (tilápia ~R$ 12/kg, pintado ~R$ 24/kg); muda um pouco todo mês.

// zone: onde vive (perto 0, meio 1, fundo 2) · moves: jeito de brigar (pesos) · power: força · endur: fôlego
export const SPECIES = {
  lambari: { label: 'lambari', min: 0.05, max: 0.2, kg: 18, power: 0.15, endur: 0.5, zone: [0], moves: { swim: 5, shake: 1 }, img: '🐟', txt: 'Pequeno e esperto: belisca muito antes de pegar.' },
  tilapia: { label: 'tilápia', min: 0.4, max: 2.6, kg: 12, power: 0.35, endur: 0.8, zone: [0, 1], moves: { swim: 4, run: 1, shake: 1 }, img: '🐟', txt: 'Briga honesta, cansa rápido.' },
  traira: { label: 'traíra', min: 0.5, max: 3.5, kg: 11, power: 0.55, endur: 0.9, zone: [0], moves: { swim: 2, shake: 3, run: 1 }, img: '🐟', txt: 'Sacode a cabeça para cuspir o anzol: não deixe a linha frouxa.' },
  carpa: { label: 'carpa', min: 1, max: 16, kg: 9, power: 0.5, endur: 1.4, zone: [1], moves: { swim: 3, dive: 2, run: 1 }, img: '🐠', txt: 'Pesada e teimosa: vai para o fundo e fica.' },
  pacu: { label: 'pacu', min: 1, max: 9, kg: 17, power: 0.6, endur: 1.1, zone: [1], moves: { swim: 3, run: 2, dive: 1 }, img: '🐠', txt: 'Corridas fortes e curtas.' },
  tambacu: { label: 'tambacu', min: 1.5, max: 14, kg: 15, power: 0.65, endur: 1.3, zone: [1, 2], moves: { swim: 3, run: 2, dive: 2 }, img: '🐠', txt: 'Força bruta: puxa para o meio do lago.' },
  tucunare: { label: 'tucunaré', min: 1, max: 7, kg: 22, power: 0.8, endur: 1, zone: [0, 1], moves: { swim: 2, run: 2, jump: 3 }, img: '🐡', txt: 'Salta fora da água: na hora do salto, solte a linha.' },
  pintado: { label: 'pintado', min: 3, max: 32, kg: 24, power: 0.75, endur: 1.6, zone: [2], moves: { swim: 2, dive: 4, run: 1 }, img: '🐡', txt: 'Peixe de couro do fundo: afunda e pesa na vara.' },
  dourado: { label: 'dourado', min: 2, max: 22, kg: 26, power: 0.95, endur: 1.3, zone: [1, 2], moves: { swim: 1, run: 3, jump: 3 }, img: '🐡', txt: 'O rei do rio: corridas longas e saltos seguidos.' },
  pirarucu: { label: 'pirarucu', min: 25, max: 160, kg: 20, power: 1, endur: 2.4, zone: [2], moves: { swim: 2, run: 3, dive: 2, jump: 1 }, img: '🦈', txt: 'Gigante: briga de vários minutos. Fricção baixa e paciência.' },
};
export const MOVES = {
  swim: { label: 'nadando', t: [2, 4], pull: 1 },
  run: { label: 'arrancada!', t: [1, 2.5], pull: 2.1, warn: 'vai arrancar!' },
  jump: { label: 'salto!', t: [1, 1.4], pull: 0.3, warn: 'vai saltar: solte!' },
  dive: { label: 'afundando', t: [2, 3.5], pull: 1.5 },
  shake: { label: 'sacudindo a cabeça', t: [1, 1.6], pull: 1.2 },
};
// entrada vale 30 min de pesca na tela (ticket do pesque-pague) · size: até onde vai a água (m)
export const SPOTS = {
  lagoa: { label: 'lagoa da fazenda', fee: 0, rod: 0, size: 30, kgx: 0.5, fish: { lambari: 20, tilapia: 55, traira: 25 }, txt: 'De graça. Peixe pequeno, bom para treinar a mão.' },
  pesqueiro: { label: 'pesque-pague', fee: 150, rod: 1, size: 45, fish: { tilapia: 30, pacu: 25, tambacu: 22, carpa: 18, pintado: 5 }, txt: 'Tanques cheios de pacu, tambacu e carpa. De vez em quando sai um pintado.' },
  represa: { label: 'represa', fee: 1500, rod: 2, size: 70, fish: { tucunare: 32, pintado: 28, dourado: 22, tambacu: 15, pirarucu: 3 }, txt: 'Peixe esportivo e caro. Pede vara boa e sai até pirarucu.' },
};
export const zoneOf = (spot, m) => (m < SPOTS[spot].size * 0.3 ? 0 : m < SPOTS[spot].size * 0.65 ? 1 : 2);
export const ZONES = ['beirada', 'meio', 'fundo'];
export const TICKET_MS = 30 * 60 * 1000;
// line: o que a linha aguenta (kg de força) · reel: metros por segundo recolhendo · cast: arremesso máximo (m) · spool: linha no carretel (m)
export const RODS = [
  { label: 'vara de bambu', price: 0, line: 3, reel: 2.2, cast: 14, spool: 20, maxKg: 4, drag: false, txt: 'Para começar na lagoa. Simples: sem molinete e sem fricção.', color: '#c9a25a' },
  { label: 'vara com molinete', price: 1200, line: 8, reel: 3, cast: 35, spool: 90, maxKg: 18, drag: true, txt: 'A mais fácil de usar. Libera o pesque-pague e peixe de até 18 kg.', color: '#3b6fb6' },
  { label: 'carretilha de arremesso', price: 25000, line: 16, reel: 3.6, cast: 55, spool: 120, maxKg: 40, drag: true, backlash: true, txt: 'Arremessa longe: libera a represa. Não use força máxima (embola).', color: '#c0392b' },
  { label: 'vara pesada (multifilamento)', price: 32000, line: 45, reel: 4, cast: 65, spool: 300, maxKg: 200, drag: true, backlash: true, txt: 'Para os gigantes, como o pirarucu. Linha que aguenta 45 kg.', color: '#8a9bb0' },
];
// isca: puxa a chance de cada peixe (x) e quanto aumenta o peso (big)
export const BAITS = {
  minhoca: { label: 'minhoca', pack: 20, price: 30, like: { lambari: 2, tilapia: 1.3, traira: 0.6 }, big: 1, txt: 'A clássica. Boa para lambari e tilápia na lagoa.' },
  massa: { label: 'massa de milho', pack: 20, price: 50, like: { tilapia: 1.6, pacu: 1.8, tambacu: 1.6, carpa: 2 }, big: 1.05, txt: 'Pacu, tambacu e carpa adoram. A melhor do pesque-pague.' },
  racao: { label: 'ração de peixe', pack: 30, price: 70, like: { tilapia: 1.5, pacu: 1.7, tambacu: 1.9, carpa: 1.4 }, big: 1, txt: 'Bolinhas de ração: atrai muito tambacu e pacu. Rende 30 arremessos.' },
  camarao: { label: 'camarão', pack: 15, price: 80, like: { tilapia: 1.4, traira: 1.5, pacu: 1.3, pintado: 1.4 }, big: 1.08, txt: 'Serve para quase tudo. Boa escolha quando não sabe o que usar.' },
  viva: { label: 'isca viva (lambari)', pack: 10, price: 90, like: { traira: 2, tucunare: 1.8, pintado: 2, dourado: 2, pirarucu: 1.6 }, big: 1.15, txt: 'Para os peixes grandes e bravos da represa: pintado, dourado e pirarucu.' },
  artificial: { label: 'isca artificial', pack: 5, price: 120, like: { tucunare: 2.6, dourado: 2.1, traira: 1.8 }, big: 1.12, txt: 'Imita um peixinho. A preferida do tucunaré e do dourado.' },
};
// melhor isca para um lugar: a que mais puxa os peixes de lá (o que a loja recomenda)
export const bestBait = spot => Object.entries(BAITS).map(([k, B]) => [k, Object.entries(SPOTS[spot].fish).reduce((t, [sp, w]) => t + w * (B.like[sp] || 1) * SPECIES[sp].kg, 0)]).sort((a, b) => b[1] - a[1])[0][0];
export const baitFish = k => Object.entries(BAITS[k].like).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).map(([sp]) => SPECIES[sp].label);
export const COOLERS = [
  { label: 'isopor', price: 0, cap: 15, txt: 'Cabe pouco: venda sempre que encher.' },
  { label: 'caixa térmica 60 L', price: 900, cap: 45, txt: 'Três vezes mais espaço para o pesque-pague.' },
  { label: 'caixa térmica 150 L', price: 4200, cap: 120, txt: 'Para quem pesca peixe grande na represa.' },
  { label: 'freezer na caminhonete', price: 18000, cap: 400, txt: 'Cabe até pirarucu. Guarde e venda quando o preço subir.' },
];
export const SPOIL = 0.18, SPOIL_MAX = 4;   // perde 18% do preço a cada mês do mundo no gelo; no 5º mês estraga
export const TROPHY = 0.8, TROPHY_BONUS = 0.5;   // peixe com 80% do peso máximo vale 50% a mais (vai para restaurante)
// cansaço: depois de 2 h de pesca no mesmo dia real o peixe belisca cada vez menos (segura robô de clique e o dia inteiro na beira)
export const TIRED_H = 2;
export function fatigue(s, day) {
  const p = ensure(s); if (p.day?.d !== day) p.day = { d: day, sec: 0 };
  return Math.min(6, 1 + Math.max(0, p.day.sec / 3600 - TIRED_H) * 3);   // multiplica a espera pela beliscada
}
export const fished = (s, day, sec) => { fatigue(s, day); s.pesca.day.sec = Math.round((s.pesca.day.sec + sec) * 10) / 10; };

// ---------- tempo e hora: igual para todos (tempo pelo mês do mundo, hora pelo relógio) ----------
export const WEATHER = [
  { label: 'sol forte', ico: '☀️', bite: 1.2, txt: 'peixe entocado no calor' },
  { label: 'nublado', ico: '⛅', bite: 0.85, txt: 'bom para pescar' },
  { label: 'chuva fina', ico: '🌦️', bite: 0.8, txt: 'água oxigenada, peixe ativo' },
  { label: 'frente fria', ico: '🥶', bite: 1.6, txt: 'peixe parado no fundo' },
  { label: 'calor abafado', ico: '🌡️', bite: 0.75, txt: 'pré-chuva: o peixe come muito' },
];
export const weatherOf = month => WEATHER[Math.abs(Math.imul((month || 1) * 2654435761, 1) >>> 7) % WEATHER.length];
export const hourBite = h => (h >= 5 && h < 8) || (h >= 17 && h < 20) ? 0.7 : h >= 11 && h < 15 ? 1.25 : 1;
export const hourLabel = h => (hourBite(h) < 1 ? 'hora boa (amanhecer ou fim de tarde)' : hourBite(h) > 1 ? 'sol a pino: peixe preguiçoso' : 'hora comum');

// ---------- pescador: experiência e nível ----------
export const levelOf = xp => Math.floor(Math.sqrt((xp || 0) / 120));
export const xpFor = lv => lv * lv * 120;
export const perks = lv => ({ hook: Math.min(0.35, lv * 0.025), wait: Math.max(0.75, 1 - lv * 0.012), reel: 1 + Math.min(0.2, lv * 0.01) });
export const xpOf = f => Math.round(10 + f.kg * 6 * (0.5 + SPECIES[f.sp].power) + (f.trophy ? 80 : 0));

export function ensure(s) {
  const p = (s.pesca ??= {});
  p.rods ??= [0]; p.rod ??= 0; p.cooler ??= 0; p.baits ??= {}; p.box ??= []; p.tickets ??= {}; p.mkt ??= {};
  p.n ??= 0; p.kg ??= 0; p.earned ??= 0; p.best ??= {}; p.xp ??= 0; p.drag ??= 6; p.orders ??= [];
  for (const k of Object.keys(SPECIES)) p.mkt[k] ??= 1;
  p.box = p.box.filter(f => f && SPECIES[f.sp]);
  // celular e computador juntos: a junção soma números mexidos nos dois lados; aqui volta para um valor válido
  p.rods = [...new Set(p.rods.filter(i => RODS[i]))]; if (!p.rods.includes(0)) p.rods.unshift(0);
  if (!p.rods.includes(p.rod)) p.rod = Math.max(...p.rods);
  p.cooler = Math.max(0, Math.min(COOLERS.length - 1, Math.floor(p.cooler) || 0));
  p.drag = Math.max(1, Math.min(10, Math.round(p.drag) || 6));
  for (const k of Object.keys(p.baits)) p.baits[k] = Math.max(0, Math.floor(p.baits[k]) || 0);
  for (const k of Object.keys(p.best)) if (SPECIES[k]) p.best[k] = Math.min(SPECIES[k].max, p.best[k]); else delete p.best[k];
  for (const k of Object.keys(p.mkt)) p.mkt[k] = Math.min(1.35, Math.max(0.7, Number(p.mkt[k]) || 1));
  p.orders = p.orders.filter(o => o && SPECIES[o.sp] && o.id != null);
  p.wall = (Array.isArray(p.wall) ? p.wall : []).filter(w => w && SPECIES[w.sp] && w.kg > 0).sort((a, b) => b.kg - a.kg).slice(0, WALL);
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
// arremesso: força 0-1 vira metros. Força demais na carretilha embola a linha (cabeleira).
export function throwAt(spot, rodI, power, rng = Math.random) {
  const R = RODS[rodI], m = Math.round(Math.min(SPOTS[spot].size, R.cast * Math.max(0.08, power)) * 10) / 10;
  return { m, zone: zoneOf(spot, m), backlash: !!R.backlash && power > 0.96 && rng() < 0.7 };
}
// cardume: lugar da água onde o peixe está comendo agora (muda a cada lançamento)
export const school = (spot, rng = Math.random) => Math.round(SPOTS[spot].size * (0.2 + rng() * 0.7));
// qual peixe beliscou: lugar, isca, zona da água (cada espécie vive numa) e cardume (peixe maior)
export function roll(spot, bait, zone = 1, onSchool = false, rng = Math.random) {
  const S = SPOTS[spot], B = BAITS[bait] || { like: {}, big: 1 };
  const w = Object.entries(S.fish).map(([k, v]) => [k, v * (B.like[k] || 1) * (SPECIES[k].zone.includes(zone) ? 1.8 : 0.45)]), tot = w.reduce((t, [, v]) => t + v, 0);
  let r = rng() * tot; const sp = (w.find(([, v]) => (r -= v) < 0) || w.at(-1))[0], F = SPECIES[sp];
  const kg = Math.round(Math.min(F.max, F.min + (F.max - F.min) * (S.kgx || 1) * Math.pow(rng(), onSchool ? 1.7 : 2.2) * B.big) * 100) / 100;   // kgx: lagoa tem peixe menor
  return { sp, kg, trophy: kg >= F.max * TROPHY };
}
// espera pela beliscada (s): tempo, hora, cardume, nível e cansaço
export const waitFor = ({ weather = 1, hour = 1, onSchool = false, perk = 1, tired = 1 }, rng = Math.random) => (5 + rng() * 15) * weather * hour * (onSchool ? 0.5 : 1) * perk * tired;
// fisgada: dentro da primeira fração da janela = perfeita (anzol bem preso), depois boa, depois o peixe solta
export const HOOK_WIN = 2.2;   // v233: era 1,1 s, curto demais para quem está no celular
export const hookGrade = (late, bonus = 0) => (late <= 0.6 + bonus * 0.6 ? { q: 1, label: 'fisgada perfeita!' } : late <= HOOK_WIN + bonus ? { q: 0.72, label: 'fisgou' } : null);

// ---------- briga ----------
// força do peixe em kg; a linha aguenta R.line. Fricção 1-10: a linha escorrega a partir de drag/10 × 1,05 do limite
// (fricção 10 passa do limite: aí arrebenta antes de escorregar). Bambu não tem fricção: é tudo ou nada.
export function newFight(f, rodI, at = 20, q = 1, lv = 0) {
  const F = SPECIES[f.sp], R = RODS[rodI];
  return { f, R, F, d: at, ten: 0.2, stam: 1, mv: 'swim', mt: 2, warn: 0, next: null, slack: 0, q, jumped: false, lv,
    base: 0.3 + Math.pow(f.kg, 0.85) * (0.35 + F.power * 0.4) };
}
const pick = (o, rng) => { const e = Object.entries(o), tot = e.reduce((t, [, v]) => t + v, 0); let r = rng() * tot; return (e.find(([, v]) => (r -= v) < 0) || e[0])[0]; };
// um passo (dt em s). hold = recolhendo. Devolve null, ou: 'snap' (arrebentou), 'spool' (acabou a linha), 'unhook' (soltou o anzol), 'throw' (cuspiu no salto), 'land' (na beira)
export function step(st, hold, drag, dt, rng = Math.random) {
  const { R, F } = st;
  // comportamento: aviso curto antes da arrancada e do salto (dá para reagir)
  st.mt -= dt;
  if (st.warn > 0) { st.warn -= dt; if (st.warn <= 0) { st.mv = st.next; st.mt = MOVES[st.mv].t[0] + rng() * (MOVES[st.mv].t[1] - MOVES[st.mv].t[0]); st.jumped = false; } }
  else if (st.mt <= 0) {
    const nx = st.stam < 0.18 ? 'swim' : pick(F.moves, rng);
    if (MOVES[nx].warn) { st.next = nx; st.warn = 0.55; st.mv = 'swim'; } else { st.mv = nx; st.mt = MOVES[nx].t[0] + rng() * (MOVES[nx].t[1] - MOVES[nx].t[0]); }
  }
  const M = MOVES[st.mv], shake = st.mv === 'shake' ? 1 + 0.7 * Math.sin(st.mt * 40) : 1;
  const fish = st.base * M.pull * shake * (0.2 + 0.8 * st.stam);                                // kg de força do peixe agora
  const pull = fish + (hold ? R.line * 0.42 : 0);                                              // recolhendo, a vara soma força
  const slip = R.drag ? R.line * (drag / 10) * 1.05 : Infinity;
  // fricção: só o peixe tira linha dela (se ele puxa mais que a fricção, a linha sai e não quebra);
  // recolhendo contra a fricção o carretel patina e quase não ganha linha
  const ten = Math.min(pull, slip), out = fish > slip ? Math.min(6, 1.2 + (fish - slip) / R.line * 9) : 0, spin = pull > slip ? 0.25 : 1;
  st.ten += (ten / R.line - st.ten) * Math.min(1, dt * 8);
  if (st.ten >= 1 || (st.ten > 0.85 && rng() < dt * (st.ten - 0.85) * 4)) return 'snap';   // perto do limite a linha pode estourar no nó
  st.out = out;
  if (out) st.d += out * dt;
  else if (hold) st.d -= R.reel * (1 + Math.min(0.2, st.lv * 0.01)) * spin * Math.max(0.15, 1 - fish / R.line) * (st.mv === 'dive' ? 0.35 : 1) * dt;
  else st.d += Math.max(0, fish / R.line - 0.25) * 2.5 * dt;
  // fôlego: cansa mais brigando contra linha esticada
  st.stam = Math.max(0, st.stam - dt * (0.012 + st.ten * 0.09) / F.endur / (1 + st.f.kg / 90));
  // linha frouxa: anzol mal preso solta; traíra sacudindo solta mais
  if (st.ten < 0.08) { st.slack += dt * (st.mv === 'shake' ? 2 : 1); if (st.slack > 1.6 && rng() < dt * (1.3 - st.q)) return 'unhook'; } else st.slack = Math.max(0, st.slack - dt * 2);
  // salto: recolhendo com a linha esticada, o peixe cospe o anzol
  if (st.mv === 'jump' && !st.jumped && hold && st.ten > 0.3) { st.jumped = true; if (rng() < 0.55 * (1.25 - st.q)) return 'throw'; }
  if (st.d >= R.spool) return 'spool';
  if (st.d <= 1.2) return 'land';
  return null;
}

export function keep(s, f) {
  const p = ensure(s); if (f.kg > freeKg(s)) return err('a caixa térmica está cheia: venda ou solte o peixe.');
  p.box.push({ sp: f.sp, kg: f.kg, trophy: !!f.trophy, age: 0, m: s.month || 0 });
  log(p, f); p.xp += xpOf(f); return { ok: true, xp: xpOf(f) };
}
// pesque e solte: não vai para a caixa, mas dá 50% a mais de experiência e entra no álbum
export function release(s, f) { const p = ensure(s), x = Math.round(xpOf(f) * 1.5); log(p, f); p.xp += x; return { xp: x }; }
// mural de troféus: as maiores capturas (troféu ou recorde da espécie), com lugar e data
export const WALL = 8;
// comprimento aproximado pelo peso (peixe de corpo médio: peso ≈ 0,012 × cm³)
export const lengthCm = f => Math.round(Math.cbrt((f.kg * 1000) / (f.sp === 'pirarucu' || f.sp === 'pintado' ? 0.008 : 0.013)));
function wall(p, f) {
  if (!f.trophy && f.kg <= (p.best[f.sp] || 0)) return false;
  p.wall = [...(p.wall || []), { sp: f.sp, kg: f.kg, cm: lengthCm(f), spot: f.spot || '', at: f.at || 0, trophy: !!f.trophy }].sort((a, b) => b.kg - a.kg).slice(0, WALL);
  return true;
}
function log(p, f) { wall(p, f); p.n++; p.kg = Math.round((p.kg + f.kg) * 100) / 100; if (f.kg > (p.best[f.sp] || 0)) p.best[f.sp] = f.kg; }
// vende tudo da caixa (ou só os índices pedidos)
export function sell(s, idx = null) {
  const p = ensure(s), pick = idx ? new Set(idx) : null; let v = 0, kg = 0, n = 0;
  p.box = p.box.filter((f, i) => { if (pick && !pick.has(i)) return true; v += fishValue(s, f); kg += f.kg; n++; return false; });
  s.money += v; p.earned += v; return { v, kg: Math.round(kg * 100) / 100, n };
}

// ---------- encomendas: restaurantes e peixarias da cidade pedem peixe fresco e pagam acima da peixaria ----------
const BUYERS = ['Restaurante Beira-Rio', 'Peixaria do Porto', 'Churrascaria Fogo de Chão Caipira', 'Pesqueiro do Tião', 'Mercado Municipal', 'Bar do Pescador'];
export function newOrders(s, rng = Math.random) {
  const p = ensure(s), have = Object.keys(SPECIES).filter(k => p.rods.some(r => RODS[r].maxKg >= SPECIES[k].min * 2) && k !== 'pirarucu');
  p.orders = Array.from({ length: 3 }, (_, i) => {
    const sp = have[Math.floor(rng() * have.length)], F = SPECIES[sp], n = 1 + Math.floor(rng() * 3);
    return { id: `${s.month || 0}-${i}`, who: BUYERS[Math.floor(rng() * BUYERS.length)], sp, n, min: Math.round((F.min + (F.max - F.min) * (0.15 + rng() * 0.25)) * 10) / 10, x: Math.round((1.4 + rng() * 0.5) * 100) / 100, m: s.month || 0 };
  });
  return p.orders;
}
// peixe da caixa que serve na encomenda (fresco: até 1 mês no gelo)
export const fits = (s, o) => ensure(s).box.map((f, i) => [f, i]).filter(([f]) => f.sp === o.sp && f.kg >= o.min && (f.age || 0) <= 1).sort((a, b) => a[0].kg - b[0].kg).slice(0, o.n);
export function deliver(s, id) {
  const p = ensure(s), o = p.orders.find(x => x.id === id); if (!o) return err('encomenda não encontrada.');
  const got = fits(s, o); if (got.length < o.n) return err(`faltam peixes: ${o.n} ${SPECIES[o.sp].label} de ${o.min} kg ou mais, frescos.`);
  const idx = new Set(got.map(([, i]) => i)), v = Math.round(got.reduce((t, [f]) => t + fishValue(s, f), 0) * o.x);
  p.box = p.box.filter((_, i) => !idx.has(i)); p.orders = p.orders.filter(x => x !== o); s.money += v; p.earned += v; p.xp += 40 * o.n;
  return { v, o };
}

// fechamento do mês: o gelo envelhece o peixe, a peixaria mexe no preço (±8%, volta devagar para o normal) e chegam encomendas novas
export function monthly(s, rng = Math.random) {
  const p = ensure(s), out = [];
  for (const k of Object.keys(p.mkt)) p.mkt[k] = Math.round(Math.min(1.35, Math.max(0.7, 1 + (p.mkt[k] - 1) * 0.7 + (rng() - 0.5) * 0.16)) * 1000) / 1000;
  for (const f of p.box) f.age = (f.age || 0) + 1;
  const bad = p.box.filter(f => f.age > SPOIL_MAX);
  if (bad.length) { p.box = p.box.filter(f => f.age <= SPOIL_MAX); out.push({ txt: `pesca: ${bad.length} ${bad.length === 1 ? 'peixe estragou' : 'peixes estragaram'} na caixa térmica`, val: 0 }); }
  if (p.n || p.orders.length) newOrders(s, rng);   // só quem já pescou recebe encomenda
  return out;
}

// dicas do seu Tião, o barqueiro: uma por arremesso, conforme o lugar e o tempo
export const TIPS = {
  geral: ['Linha esticada, mas não no osso: peixe gosta de linha frouxa para cuspir o anzol.', 'Viu a água borbulhar? É cardume comendo. Joga ali.', 'Pescador apressado volta de mão vazia.', 'Peixe cansado vira de lado. Aí é só trazer.', 'Fricção é igual rédea de cavalo: nem solta demais, nem puxa demais.'],
  lagoa: ['Lambari rouba isca: espera a boia sumir de vez.', 'Traíra fica na beirada, no meio do mato.'],
  pesqueiro: ['Massa de milho no meio do tanque traz pacu.', 'Tambacu puxa para o meio: dá linha e cansa ele.', 'De vez em quando passa um pintado no fundo.'],
  represa: ['Tucunaré salta: na hora do salto, solta a linha.', 'Pintado mora no fundo, perto dos 50 metros.', 'Dourado corre muito. Aperta a fricção só depois da primeira corrida.', 'Pirarucu é briga de vários minutos. Fricção no meio e paciência.'],
};
export const tipFor = (spot, weather, rng = Math.random) => { const t = [...TIPS.geral, ...(TIPS[spot] || []), `Hoje: ${weather.label}, ${weather.txt}.`]; return t[Math.floor(rng() * t.length)]; };
