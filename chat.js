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

// ---------- conversa dos jogadores do mundo ----------
// uma fala a cada ~90 s (algumas janelas ficam em silêncio), igual para todo mundo: a semente é o horário
export const NPC_GAP = 90000;
const pick = (r, a) => a[Math.floor(r() * a.length)];
const LINES = [
  r => `vendo ${pick(r, [20, 35, 50, 80])} cabeças de nelore gordo, chama no PV`,
  r => `alguém vende bezerro? pago bem, preciso de ${pick(r, [10, 20, 30])} cabeças`,
  r => `anunciei meu cavalo ${pick(r, ['quarto de milha', 'mangalarga', 'puro-sangue'])} na loja, campeão de 3 páreos`,
  r => `vendo galgo de corrida treinado, olha na loja`,
  r => `terra de ${pick(r, [40, 80, 120, 300])} ha ${pick(r, ['em Goiás', 'no Mato Grosso', 'em Minas', 'no Paraná'])} à venda, com água e tudo`,
  r => `quem quer arrendar terra? tenho ${pick(r, [50, 100, 200])} ha parados`,
  r => `vendo ${pick(r, ['Hilux', 'caminhonete', 'Scania', 'SUV blindado', 'esportivo'])} quase zero, aceito proposta`,
  r => `troco carta ${pick(r, ['diamante', 'mestre', 'esmeralda', 'challenger'])} por fichas, só proposta séria`,
  r => `abri pacote lendário e veio ${pick(r, ['uma mestre', 'uma diamante', 'duas esmeralda'])}!! 🔥`,
  r => `vendo meu clube da ${pick(r, ['Série B', 'Série C'])}, elenco montado e estádio reformado`,
  r => `procuro atacante bom pro meu time, quem tiver chama`,
  r => `granja climatizada à venda, já vem pronta pros pintinhos`,
  r => `vendo ${pick(r, [500, 1200, 3000])} caixas de laranja, preço de feira`,
  r => `vendo ${pick(r, [800, 1500, 4000])} t de cana pra quem tem usina perto`,
  r => `vendo colhedora de cana, pouco uso`,
  r => `alguém tem pulverizador de pomar sobrando? meu greening tá subindo`,
  r => `vendo trator ${pick(r, ['150 cv', '200 cv', 'com plantadeira'])}, revisado`,
  r => `${pick(r, ['Mesa VIP', 'High Roller', 'Mesa Ouro', 'Sala Diamante'])} tá pegando fogo hoje, bora`,
  r => `saquei ${pick(r, ['12,4x', '8,7x', '23,1x', '5,2x'])} no aviator kkkk`,
  r => `quem apostou no futebol ao vivo? peguei o placar exato!`,
  r => `${pick(r, ['Flamengo', 'Palmeiras', 'Corinthians', 'Grêmio', 'Cruzeiro'])} vai virar esse jogo, anota`,
  r => `alguém joga 21 comigo? mesa online aberta`,
  r => `bolsa do boi gordo subiu, hora de vender`,
  r => `falta pouco pro top 10 do ranking 💪`,
  r => `vendo corrente de ouro e relógio, olha na loja`,
];
export function npcLine(slot, nicks) {
  let a = (slot * 2654435761) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (!nicks.length || r() < 0.25) return null;
  const name = nicks[Math.floor(r() * nicks.length)];
  return { id: `npc${slot}`, name, text: pick(r, LINES)(r), at: slot * NPC_GAP + Math.floor(r() * 20000) };
}
