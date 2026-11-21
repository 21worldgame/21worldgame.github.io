// Confere o save de um jogador: toda terra que o livro-caixa diz que ele adquiriu (compra, loja, troca, devolução)
// e não diz que saiu (venda, loja, Feirão, troca, banco) precisa estar no save. Se não está, ela sumiu.
// Usado pelo painel de admin (aba terras > analisar todas as contas). O livro-caixa guarda os últimos lançamentos,
// então só vê terras adquiridas dentro dessa janela.
import { REGIONS } from './logic.js';

const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX = new RegExp(`(\\d+) ha, (${REGIONS.map(r => escRe(r.name)).sort((a, b) => b.length - a.length).join('|')})`, 'g');
const keys = t => [...String(t).matchAll(RX)].map(m => `${m[1]} ha, ${m[2]}`);

export function lostLands(s) {
  const log = Array.isArray(s?.log) ? [...s.log].reverse() : [];   // do mais antigo para o mais novo
  const bal = new Map(), paid = new Map(), when = new Map();
  for (const e of log) {
    const t = String(e?.txt || '');
    let add = [], sub = [];
    if (/^(compra de |loja: comprou |terra devolvida pelo administrador)/.test(t)) add = keys(t).slice(0, 1);
    else if (/^(venda de |loja: vendeu |Feirão: vendeu |loja: .+ comprou )|devolução de terra que sumiu/.test(t)) sub = keys(t).slice(0, 1);
    else if (/^troca com /.test(t)) { const [deu, rec = ''] = t.split('; recebeu'); sub = keys(deu); add = keys(rec); }
    else { const m = t.match(/banco tomou a terra em (.+) \((\d+) ha\)/); if (m) sub = [`${m[2]} ha, ${m[1]}`]; }
    for (const k of add) { bal.set(k, (bal.get(k) || 0) + 1); if (e.val < 0) paid.set(k, [...(paid.get(k) || []), -e.val]); when.set(k, e.m); }
    for (const k of sub) bal.set(k, (bal.get(k) || 0) - 1);
  }
  const owned = new Map();
  for (const l of s?.lands || []) if (l?.own) { const k = `${l.ha} ha, ${l.region}`; owned.set(k, (owned.get(k) || 0) + 1); }
  const out = [];
  for (const [k, n] of bal) {
    const miss = n - (owned.get(k) || 0), ps = paid.get(k) || [];
    for (let i = 0; i < miss; i++) out.push({ land: k, paid: Math.round(ps[ps.length - 1 - i] || 0), month: when.get(k) ?? null });
  }
  return out;
}
