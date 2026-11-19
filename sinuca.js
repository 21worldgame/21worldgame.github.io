// Sinuca bola 8 (regras e física puras, sem tela). Mesa 200 x 100, bolas de raio 2,4, seis caçapas.
// Física: atrito de rolamento, colisão elástica entre bolas iguais, tabela com perda de energia, caçapa com boca (a bola entra).
// Regras: na quebra vale tudo menos a branca; a 1ª bola encaçapada define lisas (1-7) ou listradas (9-15).
// Falta (branca na caçapa, não tocar em nada, tocar primeiro na bola do outro) = bola na mão para o adversário.
// Encaçapou a sua sem falta, joga de novo. A 8 só no fim: encaçapou antes ou com falta, perde.
export const L = 200, WD = 100, R = 2.4, FRICTION = 26, REST = 0.95, CUSHION = 0.78, MAX_SPEED = 330;
export const POCKETS = [{ x: -1.5, y: -1.5, r: 5.6 }, { x: L / 2, y: -3.2, r: 4.8 }, { x: L + 1.5, y: -1.5, r: 5.6 }, { x: -1.5, y: WD + 1.5, r: 5.6 }, { x: L / 2, y: WD + 3.2, r: 4.8 }, { x: L + 1.5, y: WD + 1.5, r: 5.6 }];
export const HEAD = { x: L * 0.25, y: WD / 2 }, FOOT = { x: L * 0.73, y: WD / 2 };
export const groupOf = n => (n === 0 ? 'branca' : n === 8 ? 'oito' : n < 8 ? 'lisas' : 'listradas');

export function rack(rng = Math.random) {
  // triângulo com a 8 no meio e uma lisa e uma listrada nos cantos de trás
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const rest = order.filter(n => ![1, 2, 8, 9].includes(n));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const balls = [{ n: 0, x: HEAD.x, y: HEAD.y, vx: 0, vy: 0, in: false }];
  const dx = R * Math.sqrt(3) + 0.02, slots = [];
  for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) slots.push({ x: FOOT.x + row * dx, y: FOOT.y + (k - row / 2) * (2 * R + 0.02) });
  const fill = new Array(15).fill(0); fill[0] = 1; fill[4] = 8; fill[10] = 9; fill[14] = 2;   // 1 na ponta, 8 no centro, cantos de trás: lisa e listrada
  let q = 0; for (let i = 0; i < 15; i++) if (!fill[i]) fill[i] = rest[q++];
  slots.forEach((s, i) => balls.push({ n: fill[i], x: s.x, y: s.y, vx: 0, vy: 0, in: false }));
  return balls;
}
const mouth = (x, y) => (y < 7 || y > WD - 7) && (x < 7 || x > L - 7 || Math.abs(x - L / 2) < 5.5);
// avança a física um passo; devolve os eventos (primeiro toque da branca, bolas que caíram, tabelas)
export function step(balls, dt, ev) {
  for (const b of balls) {
    if (b.in) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) { const ns = Math.max(0, sp - FRICTION * dt); b.vx *= ns / sp; b.vy *= ns / sp; if (ns < 0.6) b.vx = b.vy = 0; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const p of POCKETS) if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) { b.in = true; b.vx = b.vy = 0; ev.pocketed.push(b.n); break; }
    if (b.in) continue;
    const m = mouth(b.x, b.y);
    if (b.x < R && !m) { b.x = R; b.vx = Math.abs(b.vx) * CUSHION; ev.cushion = true; }
    if (b.x > L - R && !m) { b.x = L - R; b.vx = -Math.abs(b.vx) * CUSHION; ev.cushion = true; }
    if (b.y < R && !m) { b.y = R; b.vy = Math.abs(b.vy) * CUSHION; ev.cushion = true; }
    if (b.y > WD - R && !m) { b.y = WD - R; b.vy = -Math.abs(b.vy) * CUSHION; ev.cushion = true; }
    if (b.x < -8 || b.x > L + 8 || b.y < -8 || b.y > WD + 8) { b.in = true; b.vx = b.vy = 0; ev.pocketed.push(b.n); }   // saiu pela boca: caiu
  }
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], b = balls[j]; if (a.in || b.in) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 2 * R || d === 0) continue;
    const nx = dx / d, ny = dy / d, over = 2 * R - d;
    a.x -= nx * over / 2; a.y -= ny * over / 2; b.x += nx * over / 2; b.y += ny * over / 2;
    const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rel <= 0) continue;
    const imp = rel * (1 + REST) / 2;
    a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
    if (ev.first == null && (a.n === 0 || b.n === 0)) ev.first = a.n === 0 ? b.n : a.n;
  }
  return balls.some(b => !b.in && (b.vx || b.vy));
}
export const SUB = 1 / 240;
export function shoot(balls, angle, power) {
  const c = balls.find(b => b.n === 0), v = Math.max(0.05, Math.min(1, power)) * MAX_SPEED;
  c.vx = Math.cos(angle) * v; c.vy = Math.sin(angle) * v;
}
// roda a tacada inteira (usado pelo anfitrião, pelo bot e nos testes)
export function run(balls, angle, power, maxT = 20) {
  const b = balls.map(x => ({ ...x })), ev = { first: null, pocketed: [], cushion: false };
  shoot(b, angle, power);
  let t = 0; for (; t < maxT; t += SUB) if (!step(b, SUB, ev)) break;
  return { balls: b, ev, t };
}
export const free = (balls, x, y) => x > R && x < L - R && y > R && y < WD - R && balls.every(b => b.in || b.n === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.2);

// ---------- regras da partida ----------
export class Sinuca {
  constructor({ id = 's', name = 'mesa de sinuca', stake = 100, rng = Math.random } = {}) {
    Object.assign(this, { id, name, stake, rng });
    this.seats = [{ kind: 'empty' }, { kind: 'empty' }];
    this.phase = 'wait'; this.games = 0; this.msg = 'Esperando o adversário.';
  }
  start() {
    this.balls = rack(this.rng); this.groups = [null, null]; this.turn = Math.floor(this.rng() * 2);
    this.inHand = false; this.broke = false; this.phase = 'aim'; this.winner = null; this.games++; this.shots = 0;
    this.msg = `${this.seats[this.turn].name} quebra.`;
  }
  mine(seat) { return this.groups[seat]; }
  left(seat) { const g = this.groups[seat]; return g ? this.balls.filter(b => !b.in && groupOf(b.n) === g).length : 7; }
  target(seat) { const g = this.groups[seat]; if (!g) return 'qualquer'; return this.left(seat) ? g : 'oito'; }
  place(seat, x, y) { if (seat !== this.turn || !this.inHand || !free(this.balls, x, y)) return 'não dá para colocar a branca aí.'; const c = this.balls[0]; Object.assign(c, { x, y, in: false, vx: 0, vy: 0 }); return null; }
  // aplica o resultado de uma tacada (bolas finais + eventos)
  apply(seat, res) {
    if (seat !== this.turn || this.phase !== 'aim') return 'não é a sua vez.';
    const ev = res.ev, me = seat, op = 1 - seat, want = this.target(me), firstG = ev.first == null ? null : groupOf(ev.first);
    this.balls = res.balls.map(b => ({ ...b, vx: 0, vy: 0 })); this.shots++;
    const cueIn = ev.pocketed.includes(0), eight = ev.pocketed.includes(8), objs = ev.pocketed.filter(n => n !== 0 && n !== 8);
    let foul = cueIn ? 'a branca caiu' : ev.first == null ? 'não tocou em nenhuma bola' : null;
    if (!foul && this.broke) {
      if (want === 'qualquer' && firstG === 'oito') foul = 'tocou primeiro na 8';
      else if (want !== 'qualquer' && firstG !== want) foul = `tocou primeiro na bola ${want === 'oito' ? 'errada (só falta a 8)' : 'do adversário'}`;
    }
    const wasBreak = !this.broke; this.broke = true;
    if (eight) {
      const ok = want === 'oito' && !foul;
      if (wasBreak && !cueIn) { const e = this.balls.find(b => b.n === 8); Object.assign(e, { in: false, ...spotFree(this.balls, FOOT) }); }   // 8 na quebra volta para a mesa
      else { this.phase = 'end'; this.winner = ok ? me : op; this.msg = ok ? `${this.seats[me].name} encaçapou a 8 e venceu!` : `${this.seats[me].name} encaçapou a 8 ${foul ? 'com falta' : 'antes da hora'} e perdeu.`; return null; }
    }
    if (!this.groups[me] && objs.length && !foul && !wasBreak) { const g = groupOf(objs[0]); this.groups[me] = g; this.groups[op] = g === 'lisas' ? 'listradas' : 'lisas'; }
    if (cueIn) { const c = this.balls[0]; Object.assign(c, { in: false, ...spotFree(this.balls, HEAD) }); }
    const scored = this.groups[me] ? objs.some(n => groupOf(n) === this.groups[me]) : objs.length > 0;
    if (foul) { this.turn = op; this.inHand = true; this.msg = `Falta: ${foul}. Bola na mão para ${this.seats[op].name}.`; }
    else if (scored) { this.inHand = false; this.msg = `${this.seats[me].name} encaçapou e joga de novo.`; }
    else { this.turn = op; this.inHand = false; this.msg = `Vez de ${this.seats[op].name}.`; }
    if (this.groups[me] && !this.msg.includes('Falta') && objs.length && this.shots > 0 && !scored) this.msg = `${this.seats[me].name} encaçapou a bola do adversário. Vez de ${this.seats[op].name}.`;
    return null;
  }
  view(seat) {
    return { id: this.id, name: this.name, stake: this.stake, phase: this.phase, msg: this.msg, turn: this.turn, groups: this.groups, inHand: this.inHand, winner: this.winner, games: this.games, seat,
      balls: this.balls, seats: this.seats.map(s => ({ kind: s.kind, name: s.name, look: s.look, pid: s.pid })), broke: this.broke, left: this.balls ? [this.left(0), this.left(1)] : [7, 7], target: this.balls ? [this.target(0), this.target(1)] : [] };
  }
}
function spotFree(balls, at) { let x = at.x; while (!free(balls, x, at.y) && x < L - 10) x += 2 * R + 0.5; return { x, y: at.y }; }

// ---------- jogador da casa: mira pela "bola fantasma" e escolhe a tacada mais fácil ----------
function clear(balls, ax, ay, bx, by, skip) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  return balls.every(b => {
    if (b.in || skip.includes(b.n)) return true;
    const t = Math.max(0, Math.min(len, ((b.x - ax) * dx + (b.y - ay) * dy) / len)), px = ax + dx * t / len, py = ay + dy * t / len;
    return Math.hypot(b.x - px, b.y - py) > 2 * R - 0.1;
  });
}
export function botShot(game, seat, skill = 0.85, rng = Math.random) {
  const balls = game.balls, c = balls[0], want = game.target(seat);
  const cand = balls.filter(b => !b.in && b.n !== 0 && (want === 'qualquer' ? b.n !== 8 : want === 'oito' ? b.n === 8 : groupOf(b.n) === want));
  let best = null;
  for (const b of cand) for (const p of POCKETS) {
    const px = Math.max(1, Math.min(L - 1, p.x)), py = Math.max(1, Math.min(WD - 1, p.y));
    const dx = px - b.x, dy = py - b.y, dp = Math.hypot(dx, dy), gx = b.x - (dx / dp) * 2 * R, gy = b.y - (dy / dp) * 2 * R;
    const ax = gx - c.x, ay = gy - c.y, da = Math.hypot(ax, ay);
    const cut = (ax * dx + ay * dy) / (da * dp); if (cut < 0.25) continue;
    if (!clear(balls, c.x, c.y, gx, gy, [0, b.n]) || !clear(balls, b.x, b.y, px, py, [b.n])) continue;
    const score = cut * cut / (1 + (da + dp) / 160);
    if (!best || score > best.score) best = { score, angle: Math.atan2(ay, ax), power: Math.min(1, 0.22 + (da + dp / Math.max(0.3, cut)) / 330) };
  }
  if (!best) { const t = cand.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0] || balls.find(b => !b.in && b.n);
    best = { angle: Math.atan2(t.y - c.y, t.x - c.x), power: 0.55 }; }
  if (!game.broke) best = { angle: Math.atan2(FOOT.y - c.y + (rng() - 0.5) * 2, FOOT.x - c.x), power: 1 };
  const err = (1 - skill) * 0.06;
  return { angle: best.angle + (rng() - 0.5) * err * 2, power: Math.min(1, best.power * (0.95 + rng() * 0.1)) };
}
