// Jeito de cada jogador do mundo conversar. A personalidade vem do nick, então é sempre a mesma pessoa:
// educado (escreve certinho), informal (abrevia tudo), amigo (simpático, emoji) ou chato (seco, reclama).
// Cada um também tem um ritmo: responde em segundos, em 1-2 min, em 2-5 min ou só depois de 5-10 min.
// Nunca diz o que compensa mais no jogo (a mesma regra do contador).

const hash = s => { let x = 2166136261; for (const c of String(s)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
export const STYLES = ['educado', 'informal', 'amigo', 'chato'];
const SPEED = [[8e3, 45e3], [60e3, 120e3], [120e3, 300e3], [300e3, 600e3]];
export function persona(nick) {
  const x = hash(nick), s = (x >>> 4) % 100;
  return { style: STYLES[x % 4], speed: SPEED[s < 20 ? 0 : s < 55 ? 1 : s < 80 ? 2 : 3], ignore: [0.3, 0.4, 0.25, 0.65][x % 4] };   // v286: muitos nem respondem
}

const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function intent(text) {
  const t = fold(text);
  if (/\*\*\*|idiota|burro|lixo|otario|noob|ruim demais/.test(t)) return 'ofensa';
  if (/\b(vlw|valeu|obrigad|brigad|tmj)/.test(t)) return 'valeu';
  if (/\b(vend|compr|quanto|preco|valor|negoci|proposta|troco|troca)|r\$|\d+ ?(k|mil)\b/.test(t)) return 'negocio';
  if (/\b(como|dica|ajuda|ensina|compensa|vale a pena|melhor|qual)\b/.test(t)) return 'dica';
  if (/^(oi+|ola|opa|eae|eai|e ai|fala|salve|bom dia|boa tarde|boa noite|hey|iae)\b/.test(t)) return 'oi';
  if (/k{3,}|haha|\brs\b|😂/.test(t)) return 'risada';
  if (/\?$/.test(t.trim())) return 'pergunta';
  return 'papo';
}

// v286: gente de verdade no privado responde curto, nem sempre e sem cara de atendente (nada de "em que posso ajudar")
const L = {
  educado: {
    oi: ['Oi, tudo bem?', 'Olá, tudo certo e você?', 'Oi! Tudo bem sim'],
    oi2: ['Oi', 'Opa'],
    negocio: ['No momento não, obrigado', 'Agora não estou negociando', 'Vou pensar, depois te falo'],
    dica: ['Cada um joga de um jeito, vai com calma', 'Ainda estou aprendendo também', 'Não sei te dizer, sinceramente'],
    valeu: ['De nada', 'Por nada', 'Imagina'],
    risada: ['Haha', 'Rs'],
    ofensa: ['Sem necessidade', 'Ok, bom jogo'],
    pergunta: ['Não sei dizer', 'Acho que sim', 'Não tenho certeza'],
    papo: ['Entendi', 'Ah sim', 'Verdade', 'Pois é'],
    sumiu: ['Desculpa, só vi agora', 'Opa, estava ocupado'],
  },
  informal: {
    oi: ['eae', 'opa', 'salve', 'fala', 'eai blz?'],
    oi2: ['fala', 'opa', 'oi'],
    negocio: ['agr n', 'n to vendendo nd', 'sei la, dps vejo', 'n tenho'],
    dica: ['sei la mano', 'to aprendendo tb kk', 'cada um faz o seu', 'n sei te dizer'],
    valeu: ['tmj', 'nd', 'suave'],
    risada: ['kkkkk', 'kkkk', 'kkk'],
    ofensa: ['ue', 'oxi', 'q isso'],
    pergunta: ['sei n', 'acho q sim', 'n sei'],
    papo: ['ss', 'boa', 'pse', 'tendi', 'blz', 'hm'],
    sumiu: ['vi agr', 'mals tava ocupado', 'foi mal sumi'],
  },
  amigo: {
    oi: ['opa tudo bem?', 'oii', 'eai tudo certo?', 'fala!'],
    oi2: ['opa', 'oi de novo haha'],
    negocio: ['agora nao, mas valeu', 'nao to vendendo nada agora', 'depois vejo isso'],
    dica: ['vai com calma que da certo', 'eu tbm to aprendendo haha', 'cada um tem um jeito ne'],
    valeu: ['nada!', 'tmj', 'imagina'],
    risada: ['kkkkkk', 'hahaha', 'kkkk boa'],
    ofensa: ['eita', 'calma ai haha'],
    pergunta: ['acho que sim', 'nao sei te dizer', 'depende ne'],
    papo: ['verdade', 'haha', 'boa', 'massa'],
    sumiu: ['desculpa, so vi agora', 'foi mal a demora'],
  },
  chato: {
    oi: ['oi', 'fala', 'q'],
    oi2: ['q foi', 'hm'],
    negocio: ['n', 'nao vendo', 'sem interesse'],
    dica: ['sei la', 'joga ai', 'nao sei'],
    valeu: ['ok', 'blz'],
    risada: ['ok', 'aham'],
    ofensa: ['ta', 'vlw'],
    pergunta: ['sei la', 'nao'],
    papo: ['ok', 'aham', 'ta'],
    sumiu: ['tava ocupado', 'vi agr'],
  },
};
// erros de digitação de quem escreve rápido (só informal e amigo, às vezes)
const typo = (t, r) => (t.length > 6 && r() < 0.15 ? t.replace(/([a-z])([a-z])(?=[a-z]{2})/, '$2$1') : t);
const pick = (r, a) => a[Math.floor(r() * a.length)];

// resposta no privado: { skip } (não responde agora) ou { texts: [...], delay } (ms até a primeira mensagem)
// ctx: { first: é o primeiro papo; engaged: já está conversando há pouco (responde mais rápido); late: demorou muito }
export function reply(p, text, ctx = {}, r = Math.random) {
  if (!ctx.engaged && r() < p.ignore) return { skip: true };
  const it = intent(text), S = L[p.style];
  let key = it === 'oi' && !ctx.first ? 'oi2' : it;
  let texts = [pick(r, S[key] || S.papo)];
  const [a, b] = ctx.engaged ? [4e3, Math.min(60e3, p.speed[1])] : p.speed;
  const delay = Math.round(a + r() * (b - a));
  if (delay > 180e3 && r() < 0.3) texts.unshift(pick(r, S.sumiu));   // demorou: pede desculpa antes
  if (p.style === 'informal' && r() < 0.1 && it !== 'ofensa') texts.push(pick(r, S.papo));   // raramente em duas mensagens
  if (p.style === 'informal' || p.style === 'amigo') texts = texts.map(t => typo(t, r));
  return { texts: [...new Set(texts)], delay };
}

// fala da Geral no jeito da pessoa (sempre igual para todos: só depende do nick e da frase)
export function styleLine(nick, t) {
  const { style } = persona(nick), x = hash(nick + t);
  if (style === 'educado') return (t[0].toUpperCase() + t.slice(1)).replace(/\bvc\b/g, 'você').replace(/\bqm\b/g, 'quem').replace(/\bpq\b/g, 'porque').replace(/\bq\b/g, 'que').replace(/\s*(kkk+|rs)\s*/gi, ' ').trim();
  if (style === 'chato') return (x % 3 ? t : `${t}. ${['aff', 'pff', 'enfim'][x % 3]}`).replace(/[!]+/g, '').replace(/\s*\p{Extended_Pictographic}/gu, '');
  if (style === 'amigo') return x % 5 === 0 ? `${t} ${['😄', '😅', '🙏'][x % 3]}` : t;   // v286: emoji só às vezes
  return t.replace(/(@\S+)|[^@]+/g, (m, at) => (at ? m : m.toLowerCase())).replace(/\bvoce\b/g, 'vc').replace(/\bque\b/g, 'q').replace(/\bnao\b/g, 'n');
}
