// Chat global (regras puras): filtro de palavrão, limites e taxa de destaque que acompanha a economia.
import { turnOf } from './npcs.js';
import { styleLine } from './bot-chat.js';
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

// ---------- conversa dos jogadores do mundo ----------
// v286: falam POUCO (uma janela a cada 8 min e mais da metade fica em silêncio: ~1 fala a cada 18 min) e só papo comum.
// Nada de oferta que não existe ("vendo X, chama no pv"), nada de comentar notícia, nada de número que dá para conferir.
export const NPC_GAP = 480000;
const pick = (r, a) => a[Math.floor(r() * a.length)];
const LINES = [
  r => pick(r, ['bom dia', 'bom dia povo', 'dia', 'bom diaa']),
  r => pick(r, ['boa tarde', 'tarde galera']),
  r => pick(r, ['boa noite', 'boa noite gente', 'noite']),
  r => pick(r, ['alguem on?', 'tem alguem ai?', 'ta parado hj']),
  r => pick(r, ['cheguei', 'voltei', 'to de volta']),
  r => pick(r, ['vou sair, flw', 'fui galera', 'vou dormir, falou', 'vou almoçar ja volto']),
  r => pick(r, ['q calor hj', 'chovendo aqui', 'frio do caramba hj']),
  r => pick(r, ['to cansado hj', 'dia corrido', 'trabalhei o dia todo, so agr deu pra entrar']),
  r => pick(r, ['perdi feio hj kkk', 'hj nao foi meu dia', 'dia ruim aqui']),
  r => pick(r, ['hj foi bom', 'fechei o dia no positivo', 'ate q foi bem hj']),
  r => pick(r, ['alguem joga truco?', 'bora um truco?', 'qm topa sinuca?']),
  r => pick(r, ['o jogo ta travando pra mais alguem?', 'aqui deu uma travada agr', 'meu celular ta lento hj']),
  r => pick(r, ['kkkkk', 'kkk', 'rs']),
  r => pick(r, ['q fome', 'vou pegar um cafe']),
  r => pick(r, ['ainda to aprendendo esse jogo', 'demorei pra entender o mercado', 'agora q peguei o jeito']),
  r => pick(r, ['a pescaria é viciante', 'fiquei uma hora pescando kkk', 'perdi a linha no tucunare de novo']),
  r => pick(r, ['quase subi de nivel', 'subi de nivel', 'falta pouco pro proximo nivel']),
  r => pick(r, ['esqueci de colher ontem', 'deixei a lavoura passar do ponto', 'quase esqueci do gado']),
  r => pick(r, ['tem jogo hj?', 'qm vai ver o jogo?', 'q jogo ruim ontem']),
  r => pick(r, ['domingo é dia de jogar o dia todo', 'segunda de novo affs', 'sexta finalmente']),
  r => pick(r, ['meu ranking caiu', 'subi umas posicao', 'to devagar no ranking']),
  r => pick(r, ['q sono', 'acordei agr']),
  r => pick(r, ['a roleta do dia so me da coisa ruim', 'peguei a roleta hj', 'esqueci da roleta ontem']),
  r => pick(r, ['alguem mais joga pelo celular?', 'to no pc hj', 'bateria acabando aqui']),
  r => pick(r, ['vou ficar mais tranquilo hj', 'hj é so observar', 'vou com calma essa semana']),
];
// respostas de um jogador do mundo para outro (parece conversa de verdade)
const REPLIES = ['kkkkkk', 'q isso', 'boa', 'slk', 'tmj', 'serio?', 'ai sim', 'pse', 'verdade'];
// cada um escreve de um jeito: abreviação, risada, emoji, letra esticada (sempre igual para todo mundo: vem da semente)
const SWAP = [[/\bvoce\b/g, 'vc'], [/\bporque\b/g, 'pq'], [/\btambem\b/g, 'tb'], [/\bquem\b/g, 'qm'], [/\bhoje\b/g, 'hj'], [/\bninguem\b/g, 'ngm'], [/\bbeleza\b/g, 'blz']];
function casual(t, r) {
  if (r() < 0.6) for (const [a, b] of SWAP) t = t.replace(a, b);
  if (r() < 0.12) t = t[0].toUpperCase() + t.slice(1);
  const e = r();
  if (e < 0.08) t += ` ${pick(r, ['kkkk', 'kkk', 'rs'])}`;
  else if (e < 0.11) t += ` ${pick(r, ['😂', '🙏', '👀'])}`;
  if (r() < 0.08) t = t.replace(/([aeiou])([^aeiou]*)$/, '$1$1$1$2');   // "bora" vira "boraaa"
  return t;
}
// frase da vez: percorre a lista toda em ordem embaralhada antes de repetir (passo primo com o tamanho da lista)
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const STEP = (() => { let k = 11; while (gcd(k, LINES.length) !== 1) k++; return k; })();
// ---------- conversas entre os jogadores do mundo ----------
// De tempos em tempos (janelas de 7 min, nem toda janela tem) dois ou três deles conversam na Geral, com 1 a 4 minutos
// entre uma fala e outra, como gente que está jogando e responde quando dá. A semente é o horário: todos veem igual.
// Só assuntos que não dá para conferir (nada de "criei a mesa agora" ou preço exato).
export const THREAD_GAP = 2400000;   // v286: janela de 40 min e a maioria em silêncio
const THREADS = [
  [['A', 'boa noite povo'], ['B', '@A boa noite']],
  [['A', 'alguem on?'], ['B', '@A eu']],
  [['A', 'o jogo travou pra vcs tb?'], ['B', '@A aqui ta normal'], ['A', '@B voltou aqui']],
  [['A', 'qm topa um truco depois?'], ['B', '@A mais tarde talvez']],
  [['A', 'perdi a linha no tucunare de novo kkk'], ['B', '@A tem q afrouxar a friccao']],
  [['A', 'subi de nivel'], ['B', '@A boa']],
  [['A', 'q calor hj'], ['B', '@A aqui ta chovendo']],
  [['A', 'vou dormir, flw'], ['B', '@A falou']],
  [['A', 'esqueci de colher ontem kkk'], ['B', '@A ja fiz isso varias vezes']],
  [['A', 'alguem mais no celular?'], ['B', '@A eu'], ['C', '@A pc aqui']],
];
export function npcThread(slot, nicks) {
  let a = (slot * 2246822519 + 99) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (nicks.length < 3 || r() < 0.6) return [];
  const th = THREADS[Math.floor(r() * THREADS.length)], pool = [...nicks], who = {};
  for (const role of ['A', 'B', 'C']) who[role] = pool.splice(Math.floor(r() * pool.length), 1)[0];
  let at = slot * THREAD_GAP + Math.floor(r() * 60000);
  return th.map(([role, text], i) => {
    if (i) at += 90000 + Math.floor(r() * 300000);   // 1,5 a 6,5 min entre as falas
    const msg = text.replace(/@([ABC])\b/g, (_, x) => `@${who[x]}`);
    return { id: `nt${slot}-${i}`, name: who[role], text: styleLine(who[role], msg), at };
  });
}
export const lineOf = slot => ((slot * STEP) % LINES.length + LINES.length) % LINES.length;
export function npcLine(slot, nicks) {
  let a = (slot * 2654435761) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (!nicks.length || r() < 0.55) return null;   // v286: mais da metade das janelas fica em silêncio
  const name = turnOf(slot, nicks, NPC_GAP), others = nicks.filter(n => n !== name);
  const text = styleLine(name, others.length && r() < 0 ? `@${pick(r, others)} ${pick(r, REPLIES)}`   /* v286: sem @ solto para quem não falou nada */ : casual(LINES[lineOf(slot)](r), r));   // cada um no seu jeito
  return { id: `npc${slot}`, name, text, at: slot * NPC_GAP + Math.floor(r() * 20000) };
}
