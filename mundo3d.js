// Mundo 3D do 21 World: uma cidade low-poly onde cada recurso do jogo é um lugar (cassino, banco, bolsa, fazendas...).
// Personagens chibi no estilo dos bonecos do escritório do RM AI Workforce, com as cores do seu personagem.
// Entrar num lugar abre a tela que o jogo já tem; o botão "voltar ao mundo 3D" devolve você na porta.
// Three.js só é baixado quando a pessoa entra no 3D (o jogo 2D continua leve).
import { G, $, esc, brl, int } from './store.js';
import * as NPC from './npcs.js';
import * as Live from './live.js';
import * as W from './world.js';
import * as AP from './aposta.js';
import * as MK from './market.js';

const LIB = 'three';   // endereço no importmap do index.html (three@0.160.0)
const PREF = '21world.mode';
let T = null, renderer, scene, camera, sun, hemi, player, root, raf = 0, active = false, built = false, last = 0;
let yaw = Math.PI * 0.15, pitch = 0.82, dist = 20, target = null, nearPlace = null, lastDoor = null;
const keys = new Set(), boxes = [], npcs = [], labels = [], anim = [], lamps = [];
const mobile = matchMedia('(pointer: coarse)').matches;
const joy = { on: false, x: 0, y: 0 };
let billboard = null, ticker = null, nightMix = -1, composer = null, bloom = null;

// ---------- os lugares da cidade (id = aba do jogo) ----------
const PLACES = [
  { id: 'mesa', name: 'Cassino 21', kind: 'casino', x: 0, z: -44, w: 34, d: 20, h: 15, color: '#2a1f5c', neon: '#facc15' },
  { id: 'banco', name: 'Banco', kind: 'bank', x: -36, z: -26, w: 16, d: 14, h: 20, color: '#64748b', neon: '#38bdf8' },
  { id: 'livro', name: 'Contador', kind: 'office', x: -36, z: -48, w: 10, d: 8, h: 8, color: '#475569', neon: '#e2e8f0' },
  { id: 'trader', name: 'Bolsa de Valores', kind: 'tower', x: 36, z: -26, w: 16, d: 14, h: 30, color: '#1e3a8a', neon: '#22c55e' },
  { id: 'personagem', name: 'Moda e Barbearia', kind: 'shop', x: -15, z: -21, w: 10, d: 8, h: 7, color: '#be185d', neon: '#f9a8d4' },
  { id: 'inventario', name: 'Sua Casa', kind: 'house', x: 15, z: -21, w: 10, d: 8, h: 6, color: '#f5f5f4', neon: '#fde68a' },
  { id: 'carros', name: 'Concessionária', kind: 'dealer', x: -38, z: 18, w: 22, d: 16, h: 8, color: '#0f172a', neon: '#f97316' },
  { id: 'loja', name: 'Loja', kind: 'shop', x: 38, z: 18, w: 20, d: 14, h: 9, color: '#0e7490', neon: '#67e8f9' },
  { id: 'cartas', name: 'Cartas Raras', kind: 'cards', x: -20, z: 42, w: 14, d: 12, h: 9, color: '#581c87', neon: '#c084fc' },
  { id: 'trabalho', name: 'Central de Entregas', kind: 'depot', x: 20, z: 42, w: 14, d: 12, h: 7, color: '#b45309', neon: '#fdba74' },
  { id: 'futebol', name: 'Estádio', kind: 'stadium', x: 0, z: 78, w: 46, d: 34, h: 11, color: '#334155', neon: '#4ade80' },
  { id: 'ranking', name: 'Hall da Fama', kind: 'monument', x: 0, z: 0, w: 7, d: 7, h: 12, color: '#facc15', neon: '#fde047' },
  { id: 'corridas', name: 'Canódromo', kind: 'track', x: -80, z: 58, w: 34, d: 22, h: 2, color: '#a16207', neon: '#fbbf24' },
  { id: 'haras', name: 'Canil e Haras', kind: 'barn', x: -78, z: 22, w: 18, d: 12, h: 9, color: '#991b1b', neon: '#fca5a5' },
  { id: 'mercado', name: 'Armazém e Bolsa Rural', kind: 'silo', x: 66, z: -18, w: 14, d: 10, h: 9, color: '#78716c', neon: '#fde68a' },
  { id: 'gado', name: 'Curral', kind: 'corral', x: 66, z: 18, w: 18, d: 14, h: 1.6, color: '#92400e', neon: '#fcd34d' },
  { id: 'granja', name: 'Granja', kind: 'poultry', x: 94, z: -18, w: 22, d: 8, h: 4, color: '#e7e5e4', neon: '#fef08a' },
  { id: 'laranja', name: 'Pomar de Laranja', kind: 'orchard', x: 94, z: 18, w: 20, d: 16, h: 0.4, color: '#3f6212', neon: '#fb923c' },
  { id: 'cana', name: 'Canavial', kind: 'cane', x: 94, z: 46, w: 22, d: 16, h: 0.4, color: '#4d7c0f', neon: '#bef264' },
  { id: 'terras', name: 'Cartório de Terras', kind: 'house', x: 64, z: 46, w: 12, d: 10, h: 7, color: '#d6d3d1', neon: '#a7f3d0' },
];
for (const p of PLACES) {
  if (p.kind === 'monument') { p.door = { x: 0, z: 7.5 }; continue; }
  const alongX = Math.abs(p.x) > Math.abs(p.z), s = alongX ? -Math.sign(p.x) : -Math.sign(p.z) || 1;
  p.door = alongX ? { x: p.x + s * (p.w / 2 + 2.2), z: p.z } : { x: p.x, z: p.z + s * (p.d / 2 + 2.2) };
  p.face = alongX ? { x: s, z: 0 } : { x: 0, z: s };
}
export const places = PLACES;
export const debug = () => ({ x: player?.position.x, z: player?.position.z, npcs: npcs.length, active });

// ---------- utilidades ----------
const ctx2 = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function css(v, fb = '#888') {        // cor dos tokens (oklch) -> cor do three
  const raw = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;
  ctx2.fillStyle = '#000'; ctx2.fillStyle = raw; ctx2.fillRect(0, 0, 1, 1);
  const d = ctx2.getImageData(0, 0, 1, 1).data;
  return new T.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, T.SRGBColorSpace);
}
const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, ...o });
const glow = c => new T.MeshBasicMaterial({ color: c, toneMapped: false });
function mesh(geo, m, x = 0, y = 0, z = 0, shadow = true) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow && !mobile; o.receiveShadow = true; return o; }
function textTex(text, { w = 512, h = 128, color = '#fff', bg = 'rgba(0,0,0,0)', font = 'bold 72px system-ui', glowC = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (glowC) { g.shadowColor = glowC; g.shadowBlur = 24; }
  g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
// fachada com janelas (acesas à noite)
function windowsTex(cols, rows, lit) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  const cw = 256 / cols, rh = 256 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const on = Math.sin(i * 12.9 + j * 78.2) * 43758 % 1;
    g.fillStyle = Math.abs(on) < lit ? '#fde68a' : '#1e293b';
    g.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.2, cw * 0.64, rh * 0.55);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function collideBox(x0, z0, x1, z1) { boxes.push({ x0, z0, x1, z1 }); }
function resolve(p, r = 0.55) {
  for (const b of boxes) {
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r) {
      const dl = p.x - (b.x0 - r), dr = b.x1 + r - p.x, dt = p.z - (b.z0 - r), db = b.z1 + r - p.z, m = Math.min(dl, dr, dt, db);
      if (m === dl) p.x = b.x0 - r; else if (m === dr) p.x = b.x1 + r; else if (m === dt) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
  p.x = Math.max(-118, Math.min(118, p.x)); p.z = Math.max(-118, Math.min(118, p.z));
}

// ---------- caminhos: grade de 2 m com busca em largura (desvia de prédios) ----------
const GS = 2, GN = 120, grid = new Uint8Array(GN * GN);
const gi = (x, z) => [Math.max(0, Math.min(GN - 1, Math.floor((x + 120) / GS))), Math.max(0, Math.min(GN - 1, Math.floor((z + 120) / GS)))];
const gc = (i, j) => ({ x: i * GS - 120 + GS / 2, z: j * GS - 120 + GS / 2 });
function buildGrid() {
  for (let i = 0; i < GN; i++) for (let j = 0; j < GN; j++) { const c = gc(i, j); grid[i * GN + j] = boxes.some(b => c.x > b.x0 - 0.9 && c.x < b.x1 + 0.9 && c.z > b.z0 - 0.9 && c.z < b.z1 + 0.9) ? 1 : 0; }
}
const free = (i, j) => i >= 0 && j >= 0 && i < GN && j < GN && !grid[i * GN + j];
function sight(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.8); for (let k = 1; k < n; k++) { const [i, j] = gi(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n); if (!free(i, j)) return false; } return true; }
export function route(from, to) {
  let [si, sj] = gi(from.x, from.z), [ti, tj] = gi(to.x, to.z);
  if (!free(ti, tj)) { let best = null, bd = 1e9; for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) if (free(ti + di, tj + dj) && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); best = [ti + di, tj + dj]; } if (!best) return [to]; [ti, tj] = best; }
  if (sight(from, to)) return [to];
  const prev = new Int32Array(GN * GN).fill(-1), q = [si * GN + sj]; prev[si * GN + sj] = si * GN + sj;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], ci = Math.floor(c / GN), cj = c % GN; if (ci === ti && cj === tj) break;
    for (const [a, b] of D) { const ni = ci + a, nj = cj + b, k = ni * GN + nj; if (free(ni, nj) && prev[k] < 0 && (a === 0 || b === 0 || (free(ci + a, cj) && free(ci, cj + b)))) { prev[k] = c; q.push(k); } }
  }
  if (prev[ti * GN + tj] < 0) return [to];
  const pts = []; for (let c = ti * GN + tj; c !== prev[c]; c = prev[c]) pts.push(gc(Math.floor(c / GN), c % GN));
  pts.reverse(); pts.push(to);
  const out = []; let cur = from;   // corta caminho onde dá para ver o próximo ponto
  for (let k = 0; k < pts.length; k++) { if (k === pts.length - 1 || !sight(cur, pts[k + 1])) { out.push(pts[k]); cur = pts[k]; } }
  return out;
}

// ---------- personagem chibi ----------
function makeChar(look = {}, nick = '') {
  const g = new T.Group(), skin = css(`--skin-${look.skin || 3}`, '#e0ac69'), hairC = css(`--hair-${look.hairColor || 1}`, '#2b1b10'), cloth = css(`--cloth-${look.cloth || 1}`, '#2563eb');
  const pants = new T.Color('#1f2937'), mS = mat(skin, { roughness: 0.6 }), mC = mat(cloth), mP = mat(pants), mH = mat(hairC, { roughness: 0.9 });
  const legGeo = new T.CapsuleGeometry(0.17, 0.42, 4, 8), armGeo = new T.CapsuleGeometry(0.13, 0.42, 4, 8);
  const hip = y => { const p = new T.Group(); p.position.y = y; return p; };
  const lL = hip(0.78), lR = hip(0.78); lL.position.x = -0.2; lR.position.x = 0.2;
  lL.add(mesh(legGeo, mP, 0, -0.38, 0)); lR.add(mesh(legGeo, mP, 0, -0.38, 0));
  lL.add(mesh(new T.BoxGeometry(0.3, 0.14, 0.44), mat('#111827'), 0, -0.74, 0.06)); lR.add(mesh(new T.BoxGeometry(0.3, 0.14, 0.44), mat('#111827'), 0, -0.74, 0.06));
  const body = mesh(new T.CapsuleGeometry(0.4, 0.45, 6, 12), mC, 0, 1.22, 0); body.scale.set(1, 1, 0.72);
  const aL = hip(1.5), aR = hip(1.5); aL.position.x = -0.55; aR.position.x = 0.55;
  aL.add(mesh(armGeo, mC, 0, -0.33, 0)); aR.add(mesh(armGeo, mC, 0, -0.33, 0));
  aL.add(mesh(new T.SphereGeometry(0.13, 10, 8), mS, 0, -0.66, 0)); aR.add(mesh(new T.SphereGeometry(0.13, 10, 8), mS, 0, -0.66, 0));
  const head = new T.Group(); head.position.y = 2.12;
  head.add(mesh(new T.SphereGeometry(0.52, 20, 16), mS));
  const eyeM = mat('#111827', { roughness: 0.3 });
  head.add(mesh(new T.SphereGeometry(0.075, 8, 6), eyeM, -0.18, 0.04, 0.47, false), mesh(new T.SphereGeometry(0.075, 8, 6), eyeM, 0.18, 0.04, 0.47, false));
  head.add(mesh(new T.SphereGeometry(0.06, 8, 6), mS, 0, -0.08, 0.52, false));
  const hair = look.hair || 'curto';
  if (hair !== 'raspado') {
    const cap = mesh(new T.SphereGeometry(0.55, 20, 12, 0, Math.PI * 2, 0, hair === 'boné' ? Math.PI * 0.42 : Math.PI * 0.5), hair === 'boné' ? mat(cloth.clone().offsetHSL(0.5, 0, -0.1)) : mH, 0, 0.04, -0.02);
    head.add(cap);
    if (hair === 'boné') head.add(mesh(new T.BoxGeometry(0.62, 0.05, 0.38), cap.material, 0, 0.18, 0.5));
    if (hair === 'longo') head.add(mesh(new T.BoxGeometry(0.9, 0.85, 0.3), mH, 0, -0.3, -0.32));
    if (hair === 'coque') head.add(mesh(new T.SphereGeometry(0.2, 10, 8), mH, 0, 0.5, -0.3));
  }
  if (/barba|cheia|cavanhaque/.test(look.beard || '') && look.beard !== 'nenhuma') head.add(mesh(new T.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mH, 0, -0.14, 0.24));
  if (/óculos/.test(look.acc || '')) head.add(mesh(new T.BoxGeometry(0.62, 0.13, 0.08), mat('#0b0b0b', { metalness: 0.6, roughness: 0.2 }), 0, 0.05, 0.5, false));
  if (/chapéu/.test(look.acc || '')) { const hm = mat('#a16207'); head.add(mesh(new T.CylinderGeometry(0.85, 0.85, 0.05, 20), hm, 0, 0.36, 0), mesh(new T.CylinderGeometry(0.38, 0.45, 0.42, 16), hm, 0, 0.58, 0)); }
  if (/corrente|ouro/.test(look.acc || '')) g.add(mesh(new T.TorusGeometry(0.28, 0.035, 6, 20), mat('#facc15', { metalness: 1, roughness: 0.25 }), 0, 1.58, 0.2));
  if (look.outfit === 'terno') body.add(mesh(new T.BoxGeometry(0.16, 0.6, 0.02), mat('#991b1b'), 0, 0.05, 0.41));
  // sombra redonda no chão (barata, funciona mesmo sem sombras)
  const sh = mesh(new T.CircleGeometry(0.62, 20), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }), 0, 0.02, 0, false); sh.rotation.x = -Math.PI / 2; sh.receiveShadow = false;
  g.add(lL, lR, body, aL, aR, head, sh);
  g.userData = { lL, lR, aL, aR, head, phase: Math.random() * 6, nick };
  return g;
}
function animateChar(c, speed, dt) {
  const u = c.userData; u.phase += dt * (speed > 0.1 ? 4 + speed * 0.9 : 1.6);
  const sw = speed > 0.1 ? Math.min(0.9, 0.35 + speed * 0.06) : 0;
  u.lL.rotation.x = Math.sin(u.phase) * sw; u.lR.rotation.x = -Math.sin(u.phase) * sw;
  u.aL.rotation.x = -Math.sin(u.phase) * sw * 0.9; u.aR.rotation.x = Math.sin(u.phase) * sw * 0.9;
  u.head.position.y = 2.12 + (speed > 0.1 ? Math.abs(Math.sin(u.phase)) * 0.06 : Math.sin(u.phase) * 0.015);
}

// ---------- construção da cidade ----------
function sign(p, y, wid = Math.min(p.w * 0.8, 16)) {
  const tex = textTex(p.name.toUpperCase(), { w: 1024, h: 160, color: p.neon, font: '900 96px system-ui', glowC: p.neon });
  const m = mesh(new T.PlaneGeometry(wid, wid * 0.156), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), 0, 0, 0, false);
  const f = p.face || { x: 0, z: 1 };
  m.position.set(p.x + f.x * (p.w / 2 + 0.06), y, p.z + f.z * (p.d / 2 + 0.06));
  m.rotation.y = Math.atan2(f.x, f.z);
  root.add(m); return m;
}
function block(p, opts = {}) {
  const lit = opts.lit ?? 0.45, tex = windowsTex(Math.max(3, Math.round(p.w / 3)), Math.max(2, Math.round(p.h / 3.5)), lit);
  const m = new T.MeshStandardMaterial({ color: p.color, roughness: 0.6, metalness: opts.metal ?? 0.1, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 });
  const b = mesh(new T.BoxGeometry(p.w, p.h, p.d), m, p.x, p.h / 2, p.z);
  root.add(b); lamps.push({ m, base: 0.1, night: 0.6 });
  root.add(mesh(new T.BoxGeometry(p.w + 0.6, 0.5, p.d + 0.6), mat(new T.Color(p.color).multiplyScalar(0.6)), p.x, p.h + 0.25, p.z));
  collideBox(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2);
  // porta e marquise
  const f = p.face, dx = p.x + f.x * (p.w / 2 + 0.05), dz = p.z + f.z * (p.d / 2 + 0.05);
  const door = mesh(new T.PlaneGeometry(3, 3.4), glow(new T.Color(p.neon).multiplyScalar(0.55)), dx, 1.7, dz, false); door.rotation.y = Math.atan2(f.x, f.z); root.add(door);
  const aw = mesh(new T.BoxGeometry(f.x ? 2.4 : 6, 0.25, f.x ? 6 : 2.4), mat(p.neon, { emissive: p.neon, emissiveIntensity: 0.25 }), dx + f.x * 1.2, 3.8, dz + f.z * 1.2); root.add(aw);
  return b;
}
function tree(x, z, s = 1) {
  const g = new T.Group();
  g.add(mesh(new T.CylinderGeometry(0.18 * s, 0.26 * s, 1.6 * s, 6), mat('#78350f'), 0, 0.8 * s, 0));
  g.add(mesh(new T.IcosahedronGeometry(1.25 * s, 0), mat('#15803d', { flatShading: true }), 0, 2.2 * s, 0));
  g.add(mesh(new T.IcosahedronGeometry(0.9 * s, 0), mat('#22c55e', { flatShading: true }), 0.3 * s, 2.9 * s, 0.2 * s));
  g.position.set(x, 0, z); root.add(g);
}
function car(x, z, color, rot = 0) {
  const g = new T.Group(), m = mat(color, { metalness: 0.7, roughness: 0.25 });
  g.add(mesh(new T.BoxGeometry(2, 0.7, 4.2), m, 0, 0.75, 0), mesh(new T.BoxGeometry(1.7, 0.6, 2.2), mat('#0f172a', { metalness: 0.8, roughness: 0.1 }), 0, 1.35, -0.2));
  for (const [wx, wz] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) { const w = mesh(new T.CylinderGeometry(0.38, 0.38, 0.3, 14), mat('#111'), wx, 0.4, wz); w.rotation.z = Math.PI / 2; g.add(w); }
  g.position.set(x, 0, z); g.rotation.y = rot; root.add(g); return g;
}
function cow(x, z) {
  const g = new T.Group(), white = mat('#f5f5f4'), dark = mat('#1c1917');
  g.add(mesh(new T.BoxGeometry(0.9, 0.8, 1.7), white, 0, 1, 0), mesh(new T.BoxGeometry(0.6, 0.6, 0.6), white, 0, 1.25, 1.05), mesh(new T.BoxGeometry(0.5, 0.42, 0.5), dark, 0.2, 1.1, -0.2));
  for (const [a, b] of [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]]) g.add(mesh(new T.BoxGeometry(0.18, 0.6, 0.18), white, a, 0.3, b));
  g.position.set(x, 0, z); g.rotation.y = Math.random() * 6; root.add(g); anim.push(t => { g.rotation.y += Math.sin(t * 0.3 + x) * 0.002; });
}
function buildPlace(p) {
  const f = p.face;
  if (p.kind === 'casino') {
    block(p, { lit: 0.25, metal: 0.4 });
    sign(p, p.h - 2.4, 22);
    // tiras de neon que piscam
    for (let i = 0; i < 4; i++) { const n = mesh(new T.BoxGeometry(p.w + 0.2, 0.18, 0.18), glow(i % 2 ? '#a855f7' : '#facc15'), p.x, 5 + i * 2.4, p.z + p.d / 2 + 0.1, false); root.add(n); anim.push(t => { n.visible = Math.sin(t * 3 + i) > -0.6; }); }
    const coin = mesh(new T.CylinderGeometry(2.4, 2.4, 0.4, 32), mat('#facc15', { metalness: 1, roughness: 0.2, emissive: '#a16207', emissiveIntensity: 0.4 }), p.x, p.h + 4, p.z);
    coin.rotation.x = Math.PI / 2; root.add(coin); anim.push(t => { coin.rotation.z = t; });
    const t21 = mesh(new T.PlaneGeometry(3.6, 1.8), new T.MeshBasicMaterial({ map: textTex('21', { w: 256, h: 128, color: '#7c2d12', font: '900 110px system-ui' }), transparent: true }), 0, 0, 0.21, false); coin.add(t21); t21.rotation.x = -Math.PI / 2;
  } else if (p.kind === 'bank' || p.kind === 'office') {
    block(p, { lit: 0.35 }); sign(p, p.h * 0.8, p.w * 0.85);
    if (p.kind === 'bank') for (let i = -2; i <= 2; i++) root.add(mesh(new T.CylinderGeometry(0.45, 0.5, p.h * 0.55, 12), mat('#e2e8f0'), p.x + p.w / 2 + 1.1, p.h * 0.275, p.z + i * 2.6));
  } else if (p.kind === 'tower') {
    block(p, { lit: 0.6, metal: 0.6 }); sign(p, p.h * 0.62, p.w * 0.9);
    const tc = document.createElement('canvas'); tc.width = 2048; tc.height = 96; ticker = { c: tc, tex: new T.CanvasTexture(tc), off: 0 }; ticker.tex.colorSpace = T.SRGBColorSpace; ticker.tex.wrapS = T.RepeatWrapping;
    const band = mesh(new T.CylinderGeometry(Math.hypot(p.w, p.d) / 2 + 0.3, Math.hypot(p.w, p.d) / 2 + 0.3, 1.6, 32, 1, true), new T.MeshBasicMaterial({ map: ticker.tex, side: T.DoubleSide, toneMapped: false }), p.x, p.h * 0.42, p.z, false);
    band.scale.set(p.w / Math.hypot(p.w, p.d), 1, p.d / Math.hypot(p.w, p.d)); root.add(band); drawTicker();
  } else if (p.kind === 'shop' || p.kind === 'cards' || p.kind === 'depot') {
    block(p, { lit: 0.5 }); sign(p, p.h - 1.4, p.w * 0.85);
    if (p.kind === 'cards') {
      const tl = new T.TextureLoader(), card = new T.Mesh(new T.PlaneGeometry(3, 4.2), new T.MeshBasicMaterial({ map: tl.load('assets/cards/brasa.webp', t => { t.colorSpace = T.SRGBColorSpace; }), side: T.DoubleSide }));
      card.position.set(p.x, p.h + 3.5, p.z); root.add(card); anim.push(t => { card.rotation.y = t * 0.8; card.position.y = p.h + 3.5 + Math.sin(t * 2) * 0.3; });
    }
    if (p.kind === 'depot') for (let i = 0; i < 3; i++) { const mo = car(p.x - 4 + i * 4, p.z + p.d / 2 + 2.5, ['#ef4444', '#f59e0b', '#22c55e'][i]); mo.scale.set(0.35, 0.55, 0.5); }
  } else if (p.kind === 'house') {
    block(p, { lit: 0.5 }); sign(p, p.h - 1.1, p.w * 0.8);
    const roof = mesh(new T.ConeGeometry(Math.hypot(p.w, p.d) / 2 + 0.6, 3.2, 4), mat('#7f1d1d', { flatShading: true }), p.x, p.h + 1.8, p.z); roof.rotation.y = Math.PI / 4; roof.scale.set(p.w / Math.hypot(p.w, p.d) * 1.4, 1, p.d / Math.hypot(p.w, p.d) * 1.4); root.add(roof);
  } else if (p.kind === 'dealer') {
    const gl = mesh(new T.BoxGeometry(p.w, p.h, p.d), new T.MeshStandardMaterial({ color: '#93c5fd', transparent: true, opacity: 0.35, metalness: 0.9, roughness: 0.05 }), p.x, p.h / 2, p.z); root.add(gl);
    root.add(mesh(new T.BoxGeometry(p.w + 0.4, 0.6, p.d + 0.4), mat('#0f172a'), p.x, p.h + 0.3, p.z));
    collideBox(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2);
    ['#dc2626', '#f8fafc', '#0ea5e9', '#facc15'].forEach((c, i) => car(p.x - 6 + i * 4, p.z, c, Math.PI / 2));
    sign(p, p.h - 1.2, p.w * 0.8);
    for (let i = 0; i < 3; i++) car(p.x - 6 + i * 6, p.z + p.d / 2 + 4, ['#16a34a', '#334155', '#f97316'][i], 0);
  } else if (p.kind === 'stadium') {
    const ring = mesh(new T.CylinderGeometry(p.w / 2, p.w / 2 + 3, p.h, 40, 1, true), mat('#475569', { side: T.DoubleSide }), p.x, p.h / 2, p.z); ring.scale.z = p.d / p.w; root.add(ring);
    const field = mesh(new T.PlaneGeometry(p.w * 0.62, p.d * 0.62), mat('#16a34a'), p.x, 0.06, p.z, false); field.rotation.x = -Math.PI / 2; root.add(field);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      root.add(mesh(new T.CylinderGeometry(0.3, 0.4, 18, 8), mat('#94a3b8'), p.x + a * p.w * 0.46, 9, p.z + b * p.d * 0.46));
      const lamp = mesh(new T.BoxGeometry(2.6, 1.4, 0.4), glow('#fef9c3'), p.x + a * p.w * 0.46, 18.4, p.z + b * p.d * 0.46, false); root.add(lamp); lamps.push({ glowMesh: lamp });
    }
    collideBox(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2);
    // telão com o placar do futebol ao vivo
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 400; billboard = { c: bc, tex: new T.CanvasTexture(bc) }; billboard.tex.colorSpace = T.SRGBColorSpace;
    const bb = mesh(new T.PlaneGeometry(16, 6.25), new T.MeshBasicMaterial({ map: billboard.tex, toneMapped: false }), p.x, p.h + 6, p.z - p.d / 2 - 0.5, false); bb.rotation.y = Math.PI; root.add(bb);
    root.add(mesh(new T.BoxGeometry(16.6, 6.8, 0.4), mat('#0f172a'), p.x, p.h + 6, p.z - p.d / 2 - 0.2));
    root.add(mesh(new T.PlaneGeometry(16, 6.25), bb.material, p.x, p.h + 6, p.z - p.d / 2 + 0.05, false));   // o placar também aparece por dentro do estádio
    drawBillboard();
    const s = sign({ ...p, face: { x: 0, z: -1 } }, 4, 14); s.position.z = p.z - p.d / 2 - 3.2;
  } else if (p.kind === 'track') {
    const sand = mesh(new T.RingGeometry(6, 11, 48), mat('#d97706'), p.x, 0.05, p.z, false); sand.rotation.x = -Math.PI / 2; sand.scale.set(p.w / 22, p.d / 22, 1); root.add(sand);
    const rail = mesh(new T.TorusGeometry(11, 0.12, 6, 64), mat('#f8fafc'), p.x, 1, p.z); rail.rotation.x = Math.PI / 2; rail.scale.set(p.w / 22, p.d / 22, 1); root.add(rail);
    collideBox(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2);
    const dog = new T.Group(); dog.add(mesh(new T.BoxGeometry(0.5, 0.5, 1.4), mat('#78716c'), 0, 0.7, 0), mesh(new T.BoxGeometry(0.35, 0.35, 0.5), mat('#78716c'), 0, 1, 0.8)); root.add(dog);
    anim.push(t => { const a = t * 1.4; dog.position.set(p.x + Math.cos(a) * 8.5 * p.w / 22, 0, p.z + Math.sin(a) * 8.5 * p.d / 22); dog.rotation.y = -a; });
    sign({ ...p, h: 6, face: { x: 1, z: 0 } }, 3.4, 12).position.x = p.x + p.w / 2 + 1;
  } else if (p.kind === 'barn') {
    block(p, { lit: 0.2 }); sign(p, p.h - 1.6, p.w * 0.8);
    const roof = mesh(new T.CylinderGeometry(p.d / 2 + 0.6, p.d / 2 + 0.6, p.w + 0.6, 3), mat('#450a0a', { flatShading: true }), p.x, p.h + 1.2, p.z); roof.rotation.z = Math.PI / 2; root.add(roof);
  } else if (p.kind === 'silo') {
    block(p, { lit: 0.2 }); sign(p, p.h - 1.3, p.w * 0.9);
    for (let i = 0; i < 3; i++) { root.add(mesh(new T.CylinderGeometry(2.2, 2.2, 12, 20), mat('#cbd5e1', { metalness: 0.7, roughness: 0.3 }), p.x + 9.5, 6, p.z - 5 + i * 5), mesh(new T.ConeGeometry(2.3, 1.6, 20), mat('#94a3b8', { metalness: 0.7 }), p.x + 9.5, 12.8, p.z - 5 + i * 5)); collideBox(p.x + 7.3, p.z - 7.2 + i * 5, p.x + 11.7, p.z - 2.8 + i * 5); }
  } else if (p.kind === 'corral') {
    for (let i = 0; i <= 12; i++) for (const s of [-1, 1]) { root.add(mesh(new T.BoxGeometry(0.2, 1.6, 0.2), mat('#78350f'), p.x - p.w / 2 + i * p.w / 12, 0.8, p.z + s * p.d / 2)); }
    for (const s of [-1, 1]) for (const y of [0.6, 1.3]) { root.add(mesh(new T.BoxGeometry(p.w, 0.12, 0.12), mat('#92400e'), p.x, y, p.z + s * p.d / 2)); root.add(mesh(new T.BoxGeometry(0.12, 0.12, p.d), mat('#92400e'), p.x + s * p.w / 2, y, p.z)); }
    for (let i = 0; i < 8; i++) cow(p.x - p.w / 2 + 2 + (i % 4) * 4.4, p.z - 3 + Math.floor(i / 4) * 6);
    collideBox(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2);
    sign({ ...p, h: 4 }, 3, 10).position.y = 3.2;
  } else if (p.kind === 'poultry') {
    block(p, { lit: 0.1 }); sign(p, p.h - 0.9, p.w * 0.6);
    const roof = mesh(new T.CylinderGeometry(p.d / 2 + 0.5, p.d / 2 + 0.5, p.w + 0.4, 3), mat('#94a3b8', { metalness: 0.6, flatShading: true }), p.x, p.h + 0.9, p.z); roof.rotation.z = Math.PI / 2; root.add(roof);
    for (let i = 0; i < 14; i++) { const c = mesh(new T.SphereGeometry(0.22, 8, 6), mat('#fafaf9'), p.x - 9 + Math.random() * 18, 0.22, p.z - p.d / 2 - 1.2 - Math.random() * 2); root.add(c); anim.push(t => { c.position.y = 0.22 + Math.max(0, Math.sin(t * 5 + i)) * 0.08; }); }
  } else if (p.kind === 'orchard' || p.kind === 'cane') {
    const soil = mesh(new T.PlaneGeometry(p.w, p.d), mat('#713f12'), p.x, 0.04, p.z, false); soil.rotation.x = -Math.PI / 2; root.add(soil);
    if (p.kind === 'orchard') {
      const top = new T.InstancedMesh(new T.IcosahedronGeometry(1.1, 0), mat('#166534', { flatShading: true }), 40), fruit = new T.InstancedMesh(new T.SphereGeometry(0.16, 6, 5), glow('#f97316'), 200), trunk = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.16, 1.2, 5), mat('#78350f'), 40);
      const m4 = new T.Matrix4(); let k = 0;
      for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
        const x = p.x - p.w / 2 + 1.5 + i * (p.w - 3) / 7, z = p.z - p.d / 2 + 1.5 + j * (p.d - 3) / 4, n = i * 5 + j;
        top.setMatrixAt(n, m4.makeTranslation(x, 1.8, z)); trunk.setMatrixAt(n, m4.makeTranslation(x, 0.6, z));
        for (let q = 0; q < 5; q++) fruit.setMatrixAt(k++, m4.makeTranslation(x + Math.cos(q * 1.3 + n) * 0.9, 1.6 + Math.sin(q * 2 + n) * 0.5, z + Math.sin(q * 1.3 + n) * 0.9));
      }
      top.castShadow = !mobile; root.add(top, fruit, trunk);
    } else {
      const N = 900, cane = new T.InstancedMesh(new T.CylinderGeometry(0.05, 0.07, 3, 4), mat('#65a30d'), N), leaf = new T.InstancedMesh(new T.ConeGeometry(0.4, 1.2, 4), mat('#4d7c0f', { flatShading: true }), N), m4 = new T.Matrix4();
      for (let i = 0; i < N; i++) { const x = p.x - p.w / 2 + 0.5 + (i % 45) * (p.w - 1) / 44 + Math.sin(i) * 0.15, z = p.z - p.d / 2 + 0.5 + Math.floor(i / 45) * (p.d - 1) / 19, h = 2.4 + Math.sin(i * 7.7) * 0.5;
        cane.setMatrixAt(i, m4.makeScale(1, h / 3, 1).setPosition(x, h / 2, z)); leaf.setMatrixAt(i, m4.makeTranslation(x, h, z)); }
      root.add(cane, leaf); anim.push(t => { leaf.rotation.z = Math.sin(t * 1.2) * 0.004; });
    }
    collideBox(p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2);
    const s = sign({ ...p, h: 5 }, 3.4, 12); s.position.set(p.door.x - p.face.x * 1.6, 3.4, p.door.z - p.face.z * 1.6);
    root.add(mesh(new T.BoxGeometry(0.2, 3, 0.2), mat('#78350f'), s.position.x - p.face.z * 5, 1.5, s.position.z));
  } else if (p.kind === 'monument') {
    root.add(mesh(new T.CylinderGeometry(6, 6.4, 0.8, 40), mat('#cbd5e1'), 0, 0.4, 0));
    const water = mesh(new T.CylinderGeometry(5.4, 5.4, 0.2, 40), new T.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }), 0, 0.82, 0, false); root.add(water);
    const ob = mesh(new T.CylinderGeometry(0.6, 1.2, p.h, 4), mat('#facc15', { metalness: 1, roughness: 0.25 }), 0, p.h / 2 + 0.8, 0); root.add(ob);
    const star = mesh(new T.OctahedronGeometry(1.1), glow('#fde047'), 0, p.h + 2, 0, false); root.add(star); anim.push(t => { star.rotation.y = t * 1.5; star.position.y = p.h + 2 + Math.sin(t * 2) * 0.3; });
    collideBox(-6.2, -6.2, 6.2, 6.2);
    const s = mesh(new T.PlaneGeometry(9, 1.4), new T.MeshBasicMaterial({ map: textTex('HALL DA FAMA · RANKING', { w: 1024, h: 160, color: '#fde047', font: '900 80px system-ui', glowC: '#facc15' }), transparent: true, toneMapped: false }), 0, 2.4, 6.5, false); root.add(s);
  }
  // marcador da porta: anel no chão + losango flutuando
  const ring = mesh(new T.RingGeometry(1.1, 1.45, 32), glow(p.neon), p.door.x, 0.07, p.door.z, false); ring.rotation.x = -Math.PI / 2; root.add(ring);
  const gem = mesh(new T.OctahedronGeometry(0.35), glow(p.neon), p.door.x, 3.2, p.door.z, false); root.add(gem);
  anim.push(t => { gem.rotation.y = t * 2; gem.position.y = 3.2 + Math.sin(t * 2.4 + p.x) * 0.25; ring.material.opacity = 0.6 + Math.sin(t * 3) * 0.4; });
  ring.material.transparent = true;
}
function buildCity() {
  root = new T.Group(); scene.add(root);
  const grass = mesh(new T.PlaneGeometry(260, 260), mat('#4d7c3a', { roughness: 1 }), 0, 0, 0, false); grass.rotation.x = -Math.PI / 2; root.add(grass);
  const road = mat('#334155', { roughness: 0.95 }), line = glow('#e2e8f0');
  const r1 = mesh(new T.PlaneGeometry(232, 9), road, 0, 0.02, 0, false); r1.rotation.x = -Math.PI / 2; root.add(r1);
  const r2 = mesh(new T.PlaneGeometry(9, 150), road, 0, 0.021, 10, false); r2.rotation.x = -Math.PI / 2; root.add(r2);
  for (let x = -112; x < 112; x += 6) { const l = mesh(new T.PlaneGeometry(2.6, 0.18), line, x, 0.03, 0, false); l.rotation.x = -Math.PI / 2; if (Math.abs(x) > 24) root.add(l); }
  for (let z = -64; z < 84; z += 6) { const l = mesh(new T.PlaneGeometry(0.18, 2.6), line, 0, 0.031, z, false); l.rotation.x = -Math.PI / 2; if (Math.abs(z) > 24) root.add(l); }
  const plaza = mesh(new T.CircleGeometry(24, 64), mat('#cbd5e1', { roughness: 0.9 }), 0, 0.04, 0, false); plaza.rotation.x = -Math.PI / 2; root.add(plaza);
  const ringP = mesh(new T.RingGeometry(23, 24, 64), mat('#94a3b8'), 0, 0.05, 0, false); ringP.rotation.x = -Math.PI / 2; root.add(ringP);
  for (const p of PLACES) buildPlace(p);
  // postes de luz pelas avenidas
  for (let x = -100; x <= 100; x += 16) for (const s of [-1, 1]) if (Math.abs(x) > 26) lamp(x, s * 6);
  for (let z = -28; z <= 60; z += 16) for (const s of [-1, 1]) if (Math.abs(z) > 26) lamp(s * 6, z);
  // árvores espalhadas (fora das ruas e prédios)
  let n = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  while (n < 150) {
    const x = rnd() * 228 - 114, z = rnd() * 228 - 114;
    if (Math.abs(z) < 8 || (Math.abs(x) < 8 && z > -34 && z < 62) || Math.hypot(x, z) < 28) continue;
    if (boxes.some(b => x > b.x0 - 4 && x < b.x1 + 4 && z > b.z0 - 4 && z < b.z1 + 4)) continue;
    if (PLACES.some(p => Math.hypot(p.door.x - x, p.door.z - z) < 6)) continue;
    tree(x, z, 0.8 + rnd() * 0.6); n++;
  }
}
function lamp(x, z) {
  root.add(mesh(new T.CylinderGeometry(0.1, 0.14, 5, 6), mat('#475569'), x, 2.5, z));
  const bulb = mesh(new T.SphereGeometry(0.32, 10, 8), glow('#fef3c7'), x, 5.1, z, false); root.add(bulb); lamps.push({ glowMesh: bulb });
}

// telões: placar do futebol ao vivo e cotações na bolsa
function drawBillboard() {
  if (!billboard) return;
  const g = billboard.c.getContext('2d'), now = Live.now(), slot = AP.slotOf(now), ph = AP.phase(slot, now), mt = AP.matches(slot)[0], min = AP.minuteAt(slot, now);
  g.fillStyle = '#020617'; g.fillRect(0, 0, 1024, 400);
  g.fillStyle = '#22c55e'; g.font = '800 40px system-ui'; g.textAlign = 'center'; g.fillText(ph === 'pre' ? 'FUTEBOL AO VIVO · APOSTAS ABERTAS' : ph === 'live' ? `AO VIVO · ${min}'` : 'FIM DE JOGO', 512, 62);
  g.fillStyle = '#fff'; g.font = '900 64px system-ui';
  g.textAlign = 'right'; g.fillText(mt.home.n.slice(0, 14), 400, 220); g.textAlign = 'left'; g.fillText(mt.away.n.slice(0, 14), 624, 220);
  g.textAlign = 'center'; g.fillStyle = '#facc15'; g.font = '900 110px system-ui';
  g.fillText(ph === 'pre' ? 'x' : `${AP.count(mt, 'gol', 'h', min)}-${AP.count(mt, 'gol', 'a', min)}`, 512, 240);
  g.fillStyle = '#94a3b8'; g.font = '600 34px system-ui'; g.fillText('entre no estádio e aposte: gols, escanteios, cartões e placar', 512, 350);
  billboard.tex.needsUpdate = true;
}
function drawTicker() {
  if (!ticker) return;
  const g = ticker.c.getContext('2d'), now = Live.now();
  g.fillStyle = '#020617'; g.fillRect(0, 0, 2048, 96); g.font = '800 54px system-ui'; g.textBaseline = 'middle';
  let x = 20;
  for (const [k, a] of Object.entries(MK.ASSETS)) {
    const ch = MK.change(k, now) * 100;
    g.fillStyle = '#e2e8f0'; g.fillText(`${a.ticker} ${MK.fmt(k, MK.price(k, now))}`, x, 50); x += g.measureText(`${a.ticker} ${MK.fmt(k, MK.price(k, now))}`).width + 14;
    g.fillStyle = ch >= 0 ? '#22c55e' : '#ef4444'; const t = `${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%`; g.fillText(t, x, 50); x += g.measureText(t).width + 60;
  }
  ticker.tex.needsUpdate = true;
}

// ---------- jogadores do mundo andando pela cidade ----------
const WALK = PLACES.map(p => p.door).concat([{ x: 18, z: 0 }, { x: -18, z: 0 }, { x: 0, z: -18 }, { x: 0, z: 20 }, { x: 50, z: 0 }, { x: -50, z: 0 }, { x: 0, z: 50 }]);
function spawnNpcs() {
  const ids = [...NPC.onlineSet(Live.now())].sort(), want = Math.min(mobile ? 14 : 26, Math.max(8, Math.round(ids.length / 3)));
  for (let i = 0; i < want; i++) {
    const n = NPC.byId(ids[(i * 7) % ids.length]); if (!n) continue;
    const c = makeChar(n.look, n.nick), s = WALK[(i * 5) % WALK.length];
    c.position.set(s.x + (Math.random() - 0.5) * 6, 0, s.z + (Math.random() - 0.5) * 6);
    root.add(c); npcs.push({ c, n, goal: null, wait: Math.random() * 4, speed: 2.4 + Math.random() * 1.4 });
    addLabel(c, n.nick, false);
  }
}
function stepNpcs(dt) {
  for (const a of npcs) {
    if (a.wait > 0) { a.wait -= dt; animateChar(a.c, 0, dt); continue; }
    if (!a.goal) { const g = WALK[Math.floor(Math.random() * WALK.length)]; a.goal = route(a.c.position, { x: g.x + (Math.random() - 0.5) * 3, z: g.z + (Math.random() - 0.5) * 3 }); a.stuck = 0; }
    const p = a.c.position, wp = a.goal[0], dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
    if (a.stuck > 4) { a.goal = null; a.wait = 1 + Math.random() * 3; continue; }
    if (d < 0.6) { a.goal.shift(); if (!a.goal.length) { a.goal = null; a.wait = 2 + Math.random() * 6; } continue; }
    const ox = p.x, oz = p.z;
    p.x += (dx / d) * a.speed * dt; p.z += (dz / d) * a.speed * dt; resolve(p);
    const moved = Math.hypot(p.x - ox, p.z - oz); if (moved < a.speed * dt * 0.3) a.stuck += dt;
    a.c.rotation.y = Math.atan2(dx, dz); animateChar(a.c, a.speed, dt);
  }
}

// ---------- nomes por cima das cabeças (HTML, sempre nítido) ----------
function addLabel(obj, text, me) { const el = document.createElement('span'); el.className = `w3d-tag${me ? ' is-me' : ''}`; el.textContent = text; $('#w3d-labels').append(el); labels.push({ obj, el, y: 2.95 }); }
const v3 = () => new T.Vector3();
let tmpV;
function placeLabels() {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  for (const l of labels) {
    tmpV.copy(l.obj.position); tmpV.y += l.y;
    const dd = tmpV.distanceTo(camera.position); tmpV.project(camera);
    const vis = tmpV.z < 1 && dd < 55 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    l.el.style.display = vis ? '' : 'none';
    if (vis) { l.el.style.transform = `translate(-50%,-100%) translate(${((tmpV.x + 1) / 2 * w).toFixed(1)}px,${((1 - tmpV.y) / 2 * h).toFixed(1)}px) scale(${Math.max(0.65, Math.min(1.1, 22 / dd)).toFixed(2)})`; l.el.style.opacity = Math.min(1, (60 - dd) / 15).toFixed(2); }
  }
}

// ---------- dia e noite (hora de Brasília) ----------
function dayNight(force = false) {
  const d = new Date(Live.now() - 3 * 3600e3), hr = d.getUTCHours() + d.getUTCMinutes() / 60;
  const sunUp = Math.sin(((hr - 6) / 12) * Math.PI), day = Math.max(0, Math.min(1, sunUp * 1.6 + 0.15));
  const night = 1 - day;
  if (!force && Math.abs(night - nightMix) < 0.01) return;
  nightMix = night;
  const sky = new T.Color('#7dd3fc').lerp(new T.Color('#1e1b4b'), night);
  scene.background = sky; scene.fog.color = sky;
  sun.intensity = 0.7 + day * 1.8; hemi.intensity = 0.55 + day * 0.35;
  sun.color = new T.Color('#fff7ed').lerp(new T.Color('#93c5fd'), night);
  const a = ((hr - 6) / 12) * Math.PI;
  sun.position.set(Math.cos(a) * 80, Math.max(25, Math.sin(Math.abs(a)) * 120), 50);
  if (bloom) bloom.strength = 0.22 + night * 0.3;
  for (const l of lamps) { if (l.m) l.m.emissiveIntensity = l.base + l.night * night; if (l.glowMesh) l.glowMesh.visible = night > 0.25; }
}

// ---------- montagem ----------
async function build() {
  T = await import(LIB);
  const FX = mobile ? null : await Promise.all(['postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js'].map(f => import(`three/addons/${f}`))).catch(() => null);
  tmpV = v3();
  const cv = $('#w3d-cv');
  renderer = new T.WebGLRenderer({ canvas: cv, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
  renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.outputColorSpace = T.SRGBColorSpace;
  scene = new T.Scene(); scene.fog = new T.Fog('#7dd3fc', 70, 190);
  try { const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'); scene.environment = new T.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; } catch {}   // reflexo nos metais e vidros
  camera = new T.PerspectiveCamera(50, 1, 0.5, 400);
  hemi = new T.HemisphereLight('#e0f2fe', '#3f6212', 0.6); scene.add(hemi);
  sun = new T.DirectionalLight('#fff7ed', 2.5); sun.castShadow = !mobile;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 }); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  buildCity(); buildGrid();
  if (FX) {   // brilho neon (só no computador)
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = FX;
    composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new T.Vector2(512, 512), 0.35, 0.4, 0.92); composer.addPass(bloom); composer.addPass(new OutputPass());
  }
  player = makeChar(G.S.avatar, G.S.avatar.name);
  player.position.set(0, 0, 16); scene.add(player);
  addLabel(player, G.S.avatar.name && G.S.avatar.name !== 'você' ? G.S.avatar.name : 'você', true);
  spawnNpcs();
  dayNight(true);
  setInterval(() => { if (active) { drawBillboard(); drawTicker(); dayNight(); hud(); } }, 2000);
  built = true;
}

// ---------- entrada do jogador ----------
function moveInput() {
  let ix = 0, iz = 0;
  if (keys.has('w') || keys.has('arrowup')) iz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) iz += 1;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  if (joy.on) { ix += joy.x; iz += joy.y; }
  return { ix, iz };
}
function step(dt, t) {
  const { ix, iz } = moveInput(), run = keys.has('shift') ? 1.7 : 1, sp = 7.5 * run;
  const p = player.position;
  let mx = 0, mz = 0;
  if (ix || iz) {
    target = null;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), l = Math.min(1, Math.hypot(ix, iz));
    mx = (rx * ix - fx * iz); mz = (rz * ix - fz * iz); const n = Math.hypot(mx, mz) || 1; mx = (mx / n) * l; mz = (mz / n) * l;
  } else if (target) {
    if (!target.path) target.path = route(p, target);
    const wp = target.path[0], dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.45) { target.path.shift(); if (!target.path.length) { const go = target.enter; target = null; if (go) enter(go); } } else { mx = dx / d; mz = dz / d; }
  }
  const speed = Math.hypot(mx, mz) * sp;
  if (speed > 0) { p.x += mx * sp * dt; p.z += mz * sp * dt; resolve(p); player.rotation.y = Math.atan2(mx, mz); }
  animateChar(player, speed, dt);
  // lugar mais perto da porta
  let best = null, bd = 4.2;
  for (const pl of PLACES) { const d = Math.hypot(pl.door.x - p.x, pl.door.z - p.z); if (d < bd) { bd = d; best = pl; } }
  if (best !== nearPlace) { nearPlace = best; const pr = $('#w3d-prompt'); pr.hidden = !best; if (best) pr.querySelector('b').textContent = best.name; }
  // câmera em terceira pessoa
  const cxp = p.x + Math.sin(yaw) * dist * Math.cos(pitch), cz = p.z + Math.cos(yaw) * dist * Math.cos(pitch), cy = dist * Math.sin(pitch) + 1.5;
  camera.position.lerp(tmpV.set(cxp, cy, cz), Math.min(1, dt * 8)); camera.lookAt(p.x, 1.6, p.z);
  sun.target.position.set(p.x, 0, p.z);   // a sombra acompanha o jogador
  sun.shadow.camera.updateProjectionMatrix();
  const sp2 = sun.position.clone().sub(sun.target.position).normalize().multiplyScalar(90); sun.position.copy(sun.target.position).add(sp2);
  for (const f of anim) f(t);
  stepNpcs(dt);
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!active || document.hidden) return;
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  resize(); step(dt, now / 1000);
  composer ? composer.render() : renderer.render(scene, camera); placeLabels(); minimap();
}
function resize() {
  const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * renderer.getPixelRatio()) || c.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); composer?.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}

// clique no chão anda até lá; clique num prédio vai até a porta e entra
const ray = () => new T.Raycaster();
function clickWorld(ev) {
  const r = renderer.domElement.getBoundingClientRect(), nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
  const rc = ray(); rc.setFromCamera({ x: nx, y: ny }, camera);
  const hit = rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3());
  if (!hit) return;
  const pl = PLACES.find(p => hit.x > p.x - p.w / 2 - 1 && hit.x < p.x + p.w / 2 + 1 && hit.z > p.z - p.d / 2 - 1 && hit.z < p.z + p.d / 2 + 1) || PLACES.find(p => Math.hypot(p.door.x - hit.x, p.door.z - hit.z) < 2.5);
  target = pl ? { x: pl.door.x, z: pl.door.z, enter: pl } : { x: hit.x, z: hit.z };
}

// ---------- HUD, minimapa, menu de lugares ----------
function hud() {
  const s = G.S, w = Live.world(), t = Live.now(), m = W.current(w, t);
  $('#w3d-stats').innerHTML = `<span><small>dinheiro</small><b class="good">${brl(s.money)}</b></span><span><small>fichas</small><b>${int(s.chips)}</b></span><span><small>mundo</small><b>${W.monthName(m)}, ano ${W.yearOf(m)}</b></span>`;
  $('#w3d-on').textContent = `${NPC.onlineSet(t).size + 1} online`;
}
function minimap() {
  const c = $('#w3d-map'); if (!c || c.offsetParent === null) return;
  const g = c.getContext('2d'), S = c.width / 240, X = x => (x + 120) * S, Z = z => (z + 120) * S;
  g.clearRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(15,23,42,.8)'; g.beginPath(); g.arc(c.width / 2, c.height / 2, c.width / 2, 0, 7); g.fill();
  g.fillStyle = '#475569'; g.fillRect(X(-116), Z(-4.5), 232 * S, 9 * S); g.fillRect(X(-4.5), Z(-65), 9 * S, 150 * S);
  for (const p of PLACES) { g.fillStyle = p.neon; g.fillRect(X(p.x - p.w / 2), Z(p.z - p.d / 2), Math.max(3, p.w * S), Math.max(3, p.d * S)); }
  g.fillStyle = '#e2e8f0'; for (const a of npcs) g.fillRect(X(a.c.position.x) - 1, Z(a.c.position.z) - 1, 2, 2);
  const px = X(player.position.x), pz = Z(player.position.z);
  g.fillStyle = '#facc15'; g.beginPath(); g.arc(px, pz, 4, 0, 7); g.fill();
  g.strokeStyle = '#facc15'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, pz); g.lineTo(px - Math.sin(yaw) * 12, pz - Math.cos(yaw) * 12); g.stroke();
}
function menu(open) {
  const m = $('#w3d-menu'); m.hidden = !open;
  if (open) m.innerHTML = `<h3>ir para</h3>${PLACES.map(p => `<button data-w3d-go="${p.id}"><i style="background:${p.neon}"></i>${esc(p.name)}</button>`).join('')}<button data-w3d="close">fechar</button>`;
}

// ---------- entrar num lugar (abre a tela do jogo) e voltar ----------
function enter(p) {
  lastDoor = p; active = false;
  $('#w3d').hidden = true; document.body.classList.remove('is-3d');
  $('#w3d-back').hidden = false; $('#w3d-back b').textContent = p.name;
  G.goto(p.id); scrollTo({ top: 0 });
}
export async function open() {
  try { localStorage.setItem(PREF, '3d'); } catch {}
  ensureDom();
  $('#w3d').hidden = false; $('#w3d-back').hidden = true; document.body.classList.add('is-3d');
  if (!built) {
    $('#w3d-load').hidden = false;
    try { await build(); } catch (e) { console.error(e); $('#w3d-load').innerHTML = 'Não deu para abrir o 3D neste aparelho. <button data-w3d="exit">voltar ao modo clássico</button>'; return; }
    $('#w3d-load').hidden = true;
  }
  if (lastDoor) { player.position.set(lastDoor.door.x + (lastDoor.face?.x || 0) * 1.5, 0, lastDoor.door.z + (lastDoor.face?.z || 1) * 1.5); }
  active = true; last = performance.now(); hud();
  if (!raf) raf = requestAnimationFrame(frame);
}
export function close() {
  try { localStorage.setItem(PREF, '2d'); } catch {}
  active = false; $('#w3d').hidden = true; $('#w3d-back').hidden = true; document.body.classList.remove('is-3d');
}
export const preferred = () => { try { return localStorage.getItem(PREF) === '3d'; } catch { return false; } };

function ensureDom() {
  if ($('#w3d')) return;
  document.body.insertAdjacentHTML('beforeend', `
  <div id="w3d" class="w3d" hidden>
    <canvas id="w3d-cv" class="w3d-cv" tabindex="0" aria-label="cidade 3D do 21 World"></canvas>
    <div id="w3d-labels" class="w3d-labels" aria-hidden="true"></div>
    <header class="w3d-hud">
      <button class="w3d-btn" data-w3d="exit" title="voltar ao modo clássico">modo clássico</button>
      <div class="w3d-stats" id="w3d-stats"></div>
      <span class="w3d-on" id="w3d-on"></span>
      <button class="w3d-btn w3d-btn--gold" data-w3d="menu">lugares</button>
    </header>
    <canvas id="w3d-map" class="w3d-map" width="180" height="180" aria-hidden="true"></canvas>
    <div class="w3d-prompt" id="w3d-prompt" hidden><button data-w3d="enter">entrar: <b></b> <kbd>E</kbd></button></div>
    <div class="w3d-help">${mobile ? 'arraste o joystick para andar · toque num prédio para ir até ele' : 'WASD ou setas para andar · Shift corre · clique no chão ou num prédio · arraste para girar a câmera · roda do mouse aproxima'}</div>
    <div class="w3d-joy" id="w3d-joy"><i></i></div>
    <nav class="w3d-menu" id="w3d-menu" hidden></nav>
    <div class="w3d-load" id="w3d-load" hidden><span class="w3d-spin"></span>montando a cidade 3D…</div>
  </div>
  <button id="w3d-back" class="w3d-back" hidden>voltar ao mundo 3D <small>(você está em <b></b>)</small></button>`);
  const root3 = $('#w3d'), cv = $('#w3d-cv');
  root3.addEventListener('click', e => {
    const b = e.target.closest('[data-w3d],[data-w3d-go]'); if (!b) return;
    const a = b.dataset.w3d;
    if (a === 'exit') close(); else if (a === 'menu') menu($('#w3d-menu').hidden); else if (a === 'close') menu(false);
    else if (a === 'enter' && nearPlace) enter(nearPlace);
    else if (b.dataset.w3dGo) { const p = PLACES.find(x => x.id === b.dataset.w3dGo); menu(false); target = { x: p.door.x, z: p.door.z, enter: p }; }
  });
  $('#w3d-back').addEventListener('click', open);
  // câmera: arrastar gira, roda aproxima; clique curto anda
  let drag = null;
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.target !== cv) return; drag = { x: e.clientX, y: e.clientY, yaw, pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 6) drag.moved = true; if (drag.moved) { yaw = drag.yaw - dx * 0.006; pitch = Math.max(0.35, Math.min(1.35, drag.pitch + dy * 0.004)); } });
  cv.addEventListener('pointerup', e => { if (drag && !drag.moved && built) clickWorld(e); drag = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(8, Math.min(48, dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
  // joystick no celular
  const jb = $('#w3d-joy'), knob = jb.querySelector('i');
  const jm = e => { const r = jb.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), m = r.width / 2, l = Math.min(1, Math.hypot(dx, dy) / m), a = Math.atan2(dy, dx);
    joy.x = Math.cos(a) * l; joy.y = Math.sin(a) * l; knob.style.transform = `translate(${joy.x * m * 0.6}px,${joy.y * m * 0.6}px)`; };
  jb.addEventListener('pointerdown', e => { joy.on = true; jb.setPointerCapture(e.pointerId); jm(e); });
  jb.addEventListener('pointermove', e => { if (joy.on) jm(e); });
  const jend = () => { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ''; };
  jb.addEventListener('pointerup', jend); jb.addEventListener('pointercancel', jend);
  addEventListener('keydown', e => {
    if (!active || e.target.closest?.('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'e' && nearPlace) { e.preventDefault(); return enter(nearPlace); }
    if (k === 'escape') return menu(false);
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
}
