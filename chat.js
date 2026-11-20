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
  r => `vendo ${pick(r, [20, 35, 50, 80])} nelore gordo, chama no pv`,
  r => `alguem vende bezerro? to precisando de uns ${pick(r, [10, 20, 30])}`,
  r => `anunciei meu ${pick(r, ['quarto de milha', 'mangalarga', 'puro-sangue'])} na loja, ganhou 3 pareos seguidos`,
  r => `vendo galgo treinado, ta na loja`,
  r => `terra de ${pick(r, [40, 80, 120, 300])} ha ${pick(r, ['em goias', 'no mato grosso', 'em minas', 'no parana'])} a venda, tem rio e tudo`,
  r => `qm quer arrendar? tenho ${pick(r, [50, 100, 200])} ha parado aqui`,
  r => `vendo ${pick(r, ['hilux', 'minha caminhonete', 'a scania', 'suv blindada', 'o esportivo'])} quase zero, aceito proposta`,
  r => `troco carta ${pick(r, ['diamante', 'mestre', 'esmeralda'])} por ficha, so proposta seria`,
  r => `abri o lendario e veio ${pick(r, ['uma mestre', 'uma diamante', 'duas esmeralda'])} 🔥🔥`,
  r => `vendo meu time da ${pick(r, ['serie b', 'serie c'])}, elenco montado`,
  r => `procuro atacante bom pro meu time, qm tiver chama`,
  r => `granja climatizada a venda, ja ta pronta pros pintinho`,
  r => `vendo ${pick(r, [500, 1200, 3000])} caixa de laranja, preco de feira`,
  r => `alguem tem pulverizador sobrando? o greening ta comendo meu pomar`,
  r => `${pick(r, ['mesa vip', 'high roller', 'mesa ouro', 'sala diamante'])} ta pegando fogo hoje`,
  r => `saquei ${pick(r, ['12,4x', '8,7x', '23,1x', '5,2x'])} no aviator kkkkk`,
  r => `perdi tudo no aviator de novo, porque eu nao saio no 2x 😭`,
  r => `quem apostou no futebol? peguei o placar exato`,
  r => `${pick(r, ['flamengo', 'palmeiras', 'corinthians', 'gremio', 'cruzeiro'])} vira esse jogo, anota ai`,
  r => `alguem joga 21? to sozinho na mesa`,
  r => `boi gordo subiu, hora de vender`,
  r => `falta pouco pro top 10 💪`,
  r => `vendo corrente de ouro e relogio, ta na loja`,
  r => `bom dia povo`,
  r => `boa noite galera`,
  r => `alguem online?`,
  r => `ae ${pick(r, ['geral', 'galera', 'povo', 'rapaziada'])}, qual a boa hoje?`,
  r => `o imposto dos rico ta pesado hein`,
  r => `mano o pasto lotou, vou ter q mandar pro boitel`,
  r => `${pick(r, ['ganhei', 'perdi'])} ${pick(r, ['2k', '5k', '10k', '50k'])} na roleta agora kkk`,
  r => `alguem sabe se compensa granja ou suino?`,
  r => `comprei uma ${pick(r, ['hilux', 'scania', 'porshe'])} hoje, to feliz demais`,
  r => `meu cavalo machucou bem antes do pareo, que raiva`,
  r => `quem vai no leilao de cavalo?`,
  r => `to quase comprando meu primeiro frigorifico`,
  r => `soja ta barata, vou segurar no armazem`,
  r => `ninguem joga truco comigo? 😅`,
  r => `aff estourei com 20 na mao`,
  r => `alguem me ensina a ganhar no poker kkkk`,
  r => `ce loko, o dolar ta subindo direto`,
  r => `saiu um 21 de primeira agora 🃏`,
  r => `vendo ${pick(r, [800, 1500, 4000])} t de cana`,
];
// respostas de um jogador do mundo para outro (parece conversa de verdade)
const REPLIES = ['quanto?', 'chama no pv', 'kkkkkk', 'mentira 😂', 'tb quero', 'fechou, te chamo', 'q isso', 'boa!!', 'eu topo', 'ta caro isso ai', 'manda print',
  'slk', 'bora', 'tmj', 'ja vendi o meu, foi mal', 'faz 10% a menos?', 'quero!', 'sério isso?', 'aí sim'];
// cada um escreve de um jeito: abreviação, risada, emoji, letra esticada (sempre igual para todo mundo: vem da semente)
const SWAP = [[/\bvoce\b/g, 'vc'], [/\bporque\b/g, 'pq'], [/\btambem\b/g, 'tb'], [/\bquem\b/g, 'qm'], [/\bhoje\b/g, 'hj'], [/\bninguem\b/g, 'ngm'], [/\bbeleza\b/g, 'blz']];
function casual(t, r) {
  if (r() < 0.6) for (const [a, b] of SWAP) t = t.replace(a, b);
  if (r() < 0.12) t = t[0].toUpperCase() + t.slice(1);
  const e = r();
  if (e < 0.12) t += ` ${pick(r, ['kkkk', 'kkkkkk', 'rs', 'haha'])}`;
  else if (e < 0.2) t += ` ${pick(r, ['😎', '🤑', '🙏', '👀', '😂', '🔥'])}`;
  if (r() < 0.08) t = t.replace(/([aeiou])([^aeiou]*)$/, '$1$1$1$2');   // "bora" vira "boraaa"
  return t;
}
export function npcLine(slot, nicks) {
  let a = (slot * 2654435761) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (!nicks.length || r() < 0.25) return null;
  const name = nicks[Math.floor(r() * nicks.length)], others = nicks.filter(n => n !== name);
  const text = others.length && r() < 0.2 ? `@${pick(r, others)} ${pick(r, REPLIES)}` : casual(pick(r, LINES)(r), r);
  return { id: `npc${slot}`, name, text, at: slot * NPC_GAP + Math.floor(r() * 20000) };
}
