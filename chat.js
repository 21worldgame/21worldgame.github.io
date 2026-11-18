// Chat global (regras puras): filtro de palavrão, limites e taxa de destaque que acompanha a economia.
export const MIN_LEVEL = 2;
export const MAX_LEN = 200;
export const GAP_MS = 4000;          // uma mensagem a cada 4 s
export const HIGHLIGHT_BASE = 1000;  // destaque custa R$ 1.000 x índice da economia

// palavrões comuns (comparados depois de normalizar: sem acento, 4->a, 3->e, letras repetidas juntas)
const BAD = [/^porr/, /^caralh/, /^krl$/, /^kct$/, /^caced?t/, /^put[ao]s?$/, /^putari/, /^merd/, /^bucet/, /^cu$/, /^cuzao/, /^fod[aeio]/, /^fud[eiao]/, /^fdp$/, /^vsf+$/, /^pqp$/, /^tnc$/, /^vtnc$/,
  /^arromb/, /^viad/, /^otari/, /^babac/, /^piranh/, /^corn[oa]s?$/, /^vagabund/, /^bost/, /^xot/, /^rola$/, /^pica$/, /^prr$/, /^desgracad/, /^idiot/, /^imbecil/, /^retardad/, /^fuck/, /^shit/, /^bitch/];
const LEET = { 4: 'a', '@': 'a', 3: 'e', 1: 'i', '!': 'i', 0: 'o', 5: 's', $: 's', 7: 't' };
export const norm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[4@31!05$7]/g, c => LEET[c]).replace(/[^a-z]/g, '');
export const isBad = w => { const n = norm(w), c = n.replace(/(.)+/g, '$1'); return n.length > 1 && BAD.some(r => r.test(n) || r.test(c)); };   // testa também com letras repetidas juntas (porrrra)
export function clean(text) {
  const t = String(text || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  return t.split(' ').map(w => (isBad(w) ? '*'.repeat(Math.min(6, w.length)) : w)).join(' ');
}
export const highlightFee = idx => Math.round((HIGHLIGHT_BASE * (idx || 1)) / 50) * 50;

// pode mandar? devolve o motivo se não puder
export function canSend(s, text, lastAt, now = Date.now(), highlight = false, idx = 1) {
  if ((s.level || 1) < MIN_LEVEL) return `o chat libera no nível ${MIN_LEVEL}. Jogue um pouco para subir.`;
  if (!String(text || '').trim()) return 'escreva uma mensagem.';
  if (now - (lastAt || 0) < GAP_MS) return 'calma: espere uns segundos entre as mensagens.';
  if (highlight && s.money < highlightFee(idx)) return 'dinheiro insuficiente para destacar.';
  return null;
}
// mensagem que chega de outro jogador: valida tudo de novo (o outro lado pode estar adulterado)
export function accept(m) {
  if (!m || typeof m.text !== 'string') return null;
  const text = clean(m.text);
  if (!text) return null;
  return { id: String(m.id || '').slice(0, 24), name: String(m.name || 'jogador').replace(/[<>&"]/g, '').slice(0, 18), level: Math.max(1, Math.min(999, Number(m.level) || 1)),
    text, hi: !!m.hi && !m.pv, pv: !!m.pv, toName: m.pv ? String(m.toName || '').replace(/[<>&"]/g, '').slice(0, 18) : '', at: Math.min(Date.now(), Number(m.at) || Date.now()) };
}

// menção: @Nome em qualquer lugar da mensagem (sem diferenciar maiúsculas)
const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
export function mentions(text, name) {
  if (!name) return false;
  const n = fold(name);
  return String(text || '').split('@').slice(1).some(part => fold(part).startsWith(n));
}
