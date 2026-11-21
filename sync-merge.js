// Junta o que dois aparelhos fizeram ao mesmo tempo (celular e computador), sem jogar fora nenhum dos lados.
// base = o save de onde os dois partiram; local = este aparelho; remote = o que o outro aparelho gravou na nuvem.
// Antes, quando os dois gravavam quase juntos, um lado era descartado inteiro: era assim que sumiam terras compradas.
//  - número mexido nos dois lados (dinheiro, fichas, estoque): soma as duas mudanças (base + o que cada um mudou);
//    marcas de tempo, mês e nível ficam com o maior
//  - lista de coisas com id (terras, carros, animais, empresas...): o que um lado comprou entra, o que um lado vendeu sai,
//    o que os dois mexeram é juntado de novo, item por item
//  - lista sem id (livro-caixa): junta os lançamentos novos dos dois lados
//  - o resto: vale o lado que mudou
// Se os dois aparelhos viraram o mês do mundo juntos, não dá para separar o que foi do mês e o que foi da pessoa:
// devolve null e quem chamou fica com a nuvem (como era antes; acontece raramente, só nessa janela de segundos).
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const MAXKEY = /(^|_)(at|month|level|seen|day|week|nameAt|savedAt|appV)$|At$|Month$|^v$/;
const hasIds = arr => arr.length > 0 && arr.every(x => isObj(x) && x.id != null);

function mergeNum(key, b, l, r) {
  if (typeof b !== 'number') return l;
  if (MAXKEY.test(key)) return Math.max(l, r);
  const v = r + (l - b);
  return Number.isInteger(l) && Number.isInteger(r) ? Math.round(v) : Math.round(v * 100) / 100;
}
function mergeIdList(b, l, r) {
  const bm = new Map((b || []).filter(isObj).map(x => [String(x.id), x])), lm = new Map(l.map(x => [String(x.id), x]));
  const out = [];
  for (const x of r) {
    const id = String(x.id), bx = bm.get(id), lx = lm.get(id);
    if (bx && !lx) continue;                                   // este aparelho vendeu/tirou
    out.push(bx && lx && !same(bx, lx) ? merge(bx, lx, x) : x);
  }
  const have = new Set(out.map(x => String(x.id)));
  for (const x of l) if (!bm.has(String(x.id)) && !have.has(String(x.id))) out.push(x);   // este aparelho comprou
  return out;
}
function mergeList(b, l, r) {
  const key = JSON.stringify, count = new Map();
  for (const x of b || []) count.set(key(x), (count.get(key(x)) || 0) + 1);
  const added = l.filter(x => { const k = key(x), n = count.get(k) || 0; if (n) { count.set(k, n - 1); return false; } return true; });
  const lc = new Map(); for (const x of l) lc.set(key(x), (lc.get(key(x)) || 0) + 1);
  const removed = new Map(); for (const x of b || []) { const k = key(x); if (!lc.get(k)) removed.set(k, (removed.get(k) || 0) + 1); else lc.set(k, lc.get(k) - 1); }
  const kept = r.filter(x => { const k = key(x), n = removed.get(k) || 0; if (n) { removed.set(k, n - 1); return false; } return true; });
  const front = added.length && l.length && same(l[0], added[0]);   // livro-caixa: lançamento novo entra no começo
  return front ? [...added, ...kept] : [...kept, ...added];
}
export function merge(b, l, r, key = '') {
  if (same(l, b)) return r;
  if (same(r, b) || same(l, r)) return l;
  if (typeof l === 'number' && typeof r === 'number') return mergeNum(key, b, l, r);
  if (Array.isArray(l) && Array.isArray(r)) return (hasIds(l) || hasIds(r)) && [...l, ...r].every(x => isObj(x) && x.id != null) ? mergeIdList(Array.isArray(b) ? b : [], l, r) : mergeList(Array.isArray(b) ? b : [], l, r);
  if (isObj(l) && isObj(r)) {
    const out = {}, bo = isObj(b) ? b : {};
    for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) {
      if (!(k in l) && k in bo) continue;                       // este aparelho apagou
      if (!(k in r) && k in bo && same(l[k], bo[k])) continue;  // o outro apagou e este não mexeu
      out[k] = !(k in r) ? l[k] : !(k in l) ? r[k] : merge(bo[k], l[k], r[k], k);
    }
    return out;
  }
  return l;
}
export function merge3(base, local, remote) {
  if (!isObj(base) || !isObj(local) || !isObj(remote)) return null;
  const bm = base.month || 0;
  if ((local.month || 0) !== bm && (remote.month || 0) !== bm) return null;   // os dois viraram o mês: fica a nuvem
  return merge(base, local, remote);
}
