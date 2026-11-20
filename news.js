// TV 21 (regras puras): plantão de notícias do mundo. Jogadores de verdade viram notícia quando compram, vendem ou trocam algo grande;
// os jogadores do mundo (NPCs) geram notícias pelo horário, iguais para todo mundo. Quem apresenta: os âncoras da TV 21.
import { CARS, REGIONS } from './logic.js';
import { CLUBS, clubPrice } from './futebol.js';
import { LISTS } from './negocios.js';
import { CHAMPS } from './cards.js';

export const ANCHORS = ['Willian Borner', 'Retana Rater'];
export const NEWS_MIN = 30000;        // movimentos a partir de R$ 30 mil viram notícia
export const NEWS_GAP = 70000;        // notícia dos jogadores do mundo: uma a cada ~70 s (algumas janelas sem notícia)
export const KINDS = { compra: 'COMPRA', venda: 'VENDA', troca: 'TROCA', premio: 'PRÊMIO', negocio: 'NEGÓCIO' };

// R$ 3,6 mi · R$ 850 mil · R$ 12.500
export const short = v => { v = Math.abs(Math.round(v)); const f = (x, u) => `R$ ${String(+x.toFixed(x < 10 ? 1 : 0)).replace('.', ',')} ${u}`;
  return v >= 1e9 ? f(v / 1e9, 'bi') : v >= 1e6 ? f(v / 1e6, 'mi') : v >= 1e4 ? f(v / 1e3, 'mil') : `R$ ${v.toLocaleString('pt-BR')}`; };

const tidy = t => String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
// linha do livro-caixa do jogador → notícia (ou null se não vale notícia)
const SKIP = /fichas|empréstimo|quitação|destaque no chat|reembolso|parcela|aposta|imposto|pedágio/i;
export function fromNote(name, txt, val) {
  txt = tidy(txt);
  if (!txt || SKIP.test(txt)) return null;
  const troca = /^troca com /.test(txt);
  if (!troca && !(Math.abs(val) >= NEWS_MIN)) return null;
  const what = txt.replace(/^(loja 21|loja de luxo|loja|Feirão|leilão):\s*/i, '').replace(/^compra de /, '').replace(/^comprou /, '').replace(/^vendeu /, '');
  const kind = troca ? 'troca' : /vend/i.test(txt) ? 'venda' : /roda|prêmio|ganhou|bônus/i.test(txt) ? 'premio' : val < 0 ? 'compra' : 'negocio';
  return { kind, name: tidy(name).slice(0, 18) || 'um jogador', what: what.slice(0, 90), val: Math.round(val) };
}
// manchete pronta (texto puro; a tela escapa antes de mostrar)
export function headline(n) {
  const v = n.val ? ` por ${short(n.val)}` : '';
  if (n.kind === 'troca') return `${n.name} fechou uma troca ${n.what.replace(/^troca /, '')}.`;
  if (n.kind === 'venda') return `${n.name} vendeu ${n.what}${v}.`;
  if (n.kind === 'premio') return `${n.name} levou ${short(n.val)}: ${n.what}.`;
  if (n.kind === 'compra') return `${n.name} acaba de comprar ${n.what}${v}.`;
  return `${n.name} movimentou ${short(n.val)}: ${n.what}.`;
}
// notícia que chega de outro jogador: valida tudo de novo
export function accept(d) {
  if (!d || !KINDS[d.kind]) return null;
  const val = Number(d.val);
  return { id: tidy(d.id).slice(0, 24), kind: d.kind, name: tidy(d.name).slice(0, 18) || 'um jogador', what: tidy(d.what).slice(0, 90),
    val: Number.isFinite(val) ? Math.max(-1e12, Math.min(1e12, Math.round(val))) : 0, at: Math.min(Date.now(), Number(d.at) || Date.now()), real: true };
}

// ---------- notícias dos jogadores do mundo ----------
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const cars = Object.values(CARS).filter(c => c.type !== 'maquina'), brands = Object.values(LISTS).flatMap(L => Object.values(L)).filter(b => b?.name && b.price);
const GEN = [
  r => { const c = pick(r, cars); return { kind: 'compra', what: `um ${c.name} zero quilômetro`, val: -c.price }; },
  r => { const g = pick(r, REGIONS), ha = pick(r, [80, 150, 300, 600, 1000]); return { kind: 'compra', what: `${ha} ha em ${g.name}`, val: -g.perHa * ha }; },
  r => { const d = r() < 0.3 ? 0 : r() < 0.6 ? 1 : 2, c = pick(r, CLUBS[d]); return { kind: 'compra', what: `o comando do ${c.n}`, val: -clubPrice(c.n) }; },
  r => { const b = pick(r, brands); return { kind: 'compra', what: `a marca ${b.name}`, val: -b.price }; },
  r => { const n = pick(r, [40, 80, 150, 300]); return { kind: 'venda', what: `${n} bois gordos no frigorífico`, val: n * pick(r, [5200, 5600, 6100]) }; },
  r => ({ kind: 'compra', what: `um cavalo ${pick(r, ['Puro-Sangue Inglês', 'Quarto de Milha', 'Árabe', 'Mangalarga Marchador'])} no leilão`, val: -pick(r, [180000, 260000, 420000, 750000]) }),
  r => ({ kind: 'premio', what: `uma carta ${pick(r, ['mestre', 'challenger', 'diamante'])} de ${pick(r, CHAMPS).name || 'campeão'} no pacote lendário`, val: pick(r, [400000, 900000, 2500000]) }),
  r => ({ kind: 'premio', what: `um saque de ${pick(r, ['18,4x', '32,7x', '55,0x', '12,9x'])} no aviator`, val: pick(r, [60000, 140000, 320000]) }),
  r => { const [g, p, q] = pick(r, [['soja', 130, 30000], ['milho', 60, 50000], ['café', 1400, 3000]]), s = q * pick(r, [1, 2, 4]); return { kind: 'venda', what: `${s.toLocaleString('pt-BR')} sacas de ${g}`, val: s * p }; },
  r => { const c = pick(r, cars); return { kind: 'venda', what: `o ${c.name} seminovo`, val: Math.round(c.price * 0.8) }; },
];
export function npcNews(slot, nicks) {
  const r = seeded(slot * 2246822519 + 7);
  if (!nicks.length || r() < 0.2) return null;
  const name = pick(r, nicks), n = pick(r, GEN)(r);
  return { id: `nn${slot}`, name, ...n, at: slot * NEWS_GAP + Math.floor(r() * 15000), real: false };
}
// âncora da vez: alterna pelo id (o mesmo âncora para a mesma notícia em qualquer aparelho)
export const anchorOf = n => ANCHORS[[...String(n.id || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % ANCHORS.length];
