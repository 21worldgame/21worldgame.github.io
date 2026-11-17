// Central de entregas: turno em tempo real que exige atenção. Regras puras (sem DOM), avançadas por step(dt).
export const SHIFT = 90;          // segundos por turno
export const CAP = 3;             // pedidos na moto ao mesmo tempo
export const ACCEPT_WINDOW = 7;   // segundos para aceitar um pedido
export const CONFIRM_WINDOW = 3;  // segundos para confirmar quando chega (se não, o cliente cancela)
export const FAST_TIP = 1.2;      // confirmou em até 1,2 s: gorjeta
export const levelMult = lvl => 1 + (lvl - 1) * 0.12;
export const xpToNext = lvl => 4 + lvl * 2;   // turnos bons para subir de nível

export function newShift(level = 1, rng = Math.random) {
  return { t: 0, level, rain: false, flat: null, orders: [], route: [], log: [], earned: 0, tips: 0, delivered: 0, missed: 0, failed: 0,
    seq: 1, nextSpawn: 1.5, nextEvent: 25 + rng() * 20, over: false };
}

function spawn(s, rng) {
  const vip = rng() < 0.15;
  const x = 8 + rng() * 84, y = 10 + rng() * 80;
  const dist = Math.hypot(x - 50, y - 50);
  const pay = Math.round((60 + dist * 6) * (vip ? 2.4 : 1) * levelMult(s.level) / 5) * 5;
  s.orders.push({ id: s.seq++, x, y, pay, vip, until: s.t + (vip ? 5 : ACCEPT_WINDOW), travel: 3.5 + dist / 9 + rng() * 2 });
}

// avança o turno dt segundos
export function step(s, dt, rng = Math.random) {
  if (s.over) return s;
  s.t = Math.min(SHIFT, s.t + dt);
  const speed = s.flat ? 0 : s.rain ? 0.6 : 1;
  if (s.t >= s.nextSpawn && s.t < SHIFT - 4) { spawn(s, rng); s.nextSpawn = s.t + (s.rain ? 2.2 : 3) + rng() * 3; }
  for (const o of [...s.orders]) if (s.t >= o.until) { s.orders.splice(s.orders.indexOf(o), 1); s.missed++; s.log.push({ t: s.t, txt: 'pedido perdido: ninguém aceitou' }); }
  for (const r of [...s.route]) {
    if (r.arrived) {
      if (s.t > r.arrived + CONFIRM_WINDOW) { s.route.splice(s.route.indexOf(r), 1); s.failed++; s.log.push({ t: s.t, txt: 'cliente cancelou: você não confirmou a entrega a tempo' }); }
    } else {
      r.left = Math.max(0, r.left - dt * speed);
      if (r.left === 0) r.arrived = s.t;
    }
  }
  // imprevistos: chuva (moto mais lenta, mais pedidos) ou pneu furado (moto para até você consertar)
  if (s.t >= s.nextEvent && !s.flat) {
    if (rng() < 0.5) { s.rain = !s.rain; s.log.push({ t: s.t, txt: s.rain ? 'começou a chover: a moto anda mais devagar' : 'a chuva passou' }); }
    else if (s.route.some(r => !r.arrived)) { s.flat = { clicks: 0, need: 6 }; s.log.push({ t: s.t, txt: 'pneu furado! conserte para seguir' }); }
    s.nextEvent = s.t + 18 + rng() * 15;
  }
  if (s.t >= SHIFT) { s.over = true; s.failed += s.route.length; s.missed += s.orders.length; s.route = []; s.orders = []; }
  return s;
}

export function accept(s, id) {
  const o = s.orders.find(x => x.id === id);
  if (!o || s.over) return 'pedido não está mais disponível.';
  if (s.route.length >= CAP) return 'a moto está cheia: entregue antes de aceitar mais.';
  s.orders.splice(s.orders.indexOf(o), 1);
  s.route.push({ ...o, left: o.travel, total: o.travel, arrived: 0 });
  return null;
}

export function confirm(s, id) {
  const r = s.route.find(x => x.id === id);
  if (!r || !r.arrived) return 0;
  const fast = s.t - r.arrived <= FAST_TIP;
  const tip = fast ? Math.round(r.pay * (r.vip ? 0.35 : 0.2)) : 0;
  s.route.splice(s.route.indexOf(r), 1);
  s.earned += r.pay + tip; s.tips += tip; s.delivered++;
  return r.pay + tip;
}

export function repair(s) {
  if (!s.flat) return false;
  if (++s.flat.clicks >= s.flat.need) { s.flat = null; s.log.push({ t: s.t, txt: 'pneu consertado' }); return true; }
  return false;
}

// nota do turno: entregas certas menos as que deixou escapar
export function grade(s) {
  const total = s.delivered + s.missed + s.failed;
  return total ? s.delivered / total : 0;
}
