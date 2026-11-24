// Jeito de cada jogador do mundo conversar. A personalidade vem do nick, então é sempre a mesma pessoa:
// educado (escreve certinho), informal (abrevia tudo), amigo (simpático, emoji) ou chato (seco, reclama).
// Cada um também tem um ritmo: responde em segundos, em 1-2 min, em 2-5 min ou só depois de 5-10 min.
// Nunca diz o que compensa mais no jogo (a mesma regra do contador).

const hash = s => { let x = 2166136261; for (const c of String(s)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x; };
export const STYLES = ['educado', 'informal', 'amigo', 'chato'];
const SPEED = [[8e3, 45e3], [60e3, 120e3], [120e3, 300e3], [300e3, 600e3]];
export function persona(nick) {
  const x = hash(nick), s = (x >>> 4) % 100;
  return { style: STYLES[x % 4], speed: SPEED[s < 30 ? 0 : s < 65 ? 1 : s < 85 ? 2 : 3], ignore: [0.12, 0.2, 0.08, 0.55][x % 4] };
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

const L = {
  educado: {
    oi: ['Olá! Tudo bem com você?', 'Oi, boa noite! Em que posso ajudar?', 'Olá, tudo certo por aqui. E com você?', 'Oi! Tudo ótimo, obrigado por perguntar.'],
    oi2: ['Oi de novo!', 'Olá, estou por aqui.'],
    negocio: ['Posso pensar, sim. Me mande uma proposta pela opção negociar no meu perfil.', 'Depende do valor. Faça uma proposta pelo meu perfil que eu avalio com calma.', 'No momento não estou vendendo, mas obrigado pelo interesse.', 'Tenho interesse. Qual valor você tem em mente?'],
    dica: ['Cada um tem sua estratégia. Eu prefiro ir com calma e não arriscar tudo de uma vez.', 'Sinceramente, eu acompanho o livro-caixa e o contador antes de decidir qualquer coisa.', 'Prefiro não dar palpite, cada jogo é diferente. Mas paciência ajuda muito.'],
    valeu: ['Por nada! Boa sorte por aí.', 'Disponha. Bom jogo!', 'Imagina, sempre que precisar.'],
    risada: ['Haha, verdade.', 'Rs, pois é.', 'Haha, essa foi boa.'],
    ofensa: ['Vamos manter o respeito, por favor.', 'Não precisa disso. Bom jogo para você.'],
    pergunta: ['Boa pergunta. Não sei te dizer com certeza.', 'Acredito que sim, mas não tenho certeza.', 'Hmm, não sei dizer agora. Depois te falo.'],
    papo: ['Entendi.', 'Interessante, não sabia disso.', 'Certo, faz sentido.', 'Pois é, o mundo está agitado hoje.'],
    sumiu: ['Desculpe a demora, estava cuidando da fazenda.', 'Perdão, só vi agora.'],
  },
  informal: {
    oi: ['eae', 'fala tu', 'opa blz?', 'salve', 'eae mano suave?', 'fala ai'],
    oi2: ['fala', 'opa', 'diz ai'],
    negocio: ['qnto vc qr?', 'manda proposta no meu perfil ai', 'ta caro isso ai mano', 'faz mais barato q eu pego', 'agr n to vendendo nd', 'depende do preço kk'],
    dica: ['sei la mano cada um faz o seu kk', 'eu vou no feeling', 'pergunta pro contador ai kkk', 'n sei te dizer, to perdido tb kkkk'],
    valeu: ['tmj', 'nd', 'tmj mano', 'suave'],
    risada: ['kkkkkkk', 'kkkk mt bom', 'slk kkkk', 'KKKKK'],
    ofensa: ['ue', 'oloco', 'q isso mano', 'oxi', 'relaxa ai'],
    pergunta: ['sei n', 'acho q sim', 'n faço ideia kk', 'pq?'],
    papo: ['ss', 'boa', 'slk', 'dmr', 'pse', 'tendi'],
    sumiu: ['foi mal tava na fazenda', 'opa vi agr', 'mals sumi'],
  },
  amigo: {
    oi: ['opaaa tudo bem?? 😄', 'oiii, bem vindo! precisando de algo é só chamar 🙌', 'eaaai, tudo certo? bora fazer negócio depois?', 'fala meu amigo!! 😁'],
    oi2: ['opa de novo haha 😄', 'tô aqui sim!'],
    negocio: ['bora negociar sim! manda no meu perfil que a gente acerta 🤝', 'pra você faço um precinho camarada haha', 'opa, interessa sim! me chama no negociar', 'agora não tenho, mas se aparecer te aviso 🙏'],
    dica: ['olha, eu fui no meu ritmo e deu certo, vai com calma que dá bom 💪', 'o segredo é não desistir haha, tamo junto', 'cada um tem seu jeito, mas qualquer coisa me chama que eu te ajudo 😉'],
    valeu: ['tmj demais!! 🙌', 'nada não, conta comigo 😄', 'imagina!! boa sorte aí 🍀'],
    risada: ['kkkkkk muito bom 😂', 'hahahaha você é demais', 'KKKK rindo aqui 🤣'],
    ofensa: ['eita, calma amigo haha', 'que isso, vamos jogar de boa 🙏'],
    pergunta: ['acho que sim! mas confirma aí haha', 'boa pergunta! não sei te dizer não 😅', 'então, depende né haha'],
    papo: ['massa demais!', 'verdade haha', 'que legal 😄', 'aí sim!!'],
    sumiu: ['desculpa a demora!! tava no leilão 😅', 'foi mal, só vi agora!!'],
  },
  chato: {
    oi: ['oi', 'q foi', 'fala', 'hm', 'diga'],
    oi2: ['de novo?', 'q'],
    negocio: ['não vendo', 'caro', 'não tenho interesse', 'manda proposta e para de chamar no pv', 'nem a pau'],
    dica: ['se vira', 'joga e aprende', 'não sou professor', 'pergunta pro contador'],
    valeu: ['ok', 'blz', '👍'],
    risada: ['ok', 'nem foi engraçado', 'aham'],
    ofensa: ['tá', 'bloqueado', 'vai jogar'],
    pergunta: ['sei lá', 'não', 'pergunta pra outro'],
    papo: ['ok', 'e daí', 'aham', 'tá', 'to ocupado'],
    sumiu: ['tava ocupado', 'agora vi'],
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
  if (delay > 180e3 && r() < 0.6) texts.unshift(pick(r, S.sumiu));   // demorou: pede desculpa antes
  if ((p.style === 'informal' || p.style === 'amigo') && r() < 0.25 && it !== 'ofensa') texts.push(pick(r, S.papo));   // às vezes manda em duas mensagens
  if (p.style === 'informal' || p.style === 'amigo') texts = texts.map(t => typo(t, r));
  return { texts: [...new Set(texts)], delay };
}

// fala da Geral no jeito da pessoa (sempre igual para todos: só depende do nick e da frase)
export function styleLine(nick, t) {
  const { style } = persona(nick), x = hash(nick + t);
  if (style === 'educado') return (t[0].toUpperCase() + t.slice(1)).replace(/\bvc\b/g, 'você').replace(/\bqm\b/g, 'quem').replace(/\bpq\b/g, 'porque').replace(/\bq\b/g, 'que').replace(/\s*(kkk+|rs)\s*/gi, ' ').trim().replace(/([^.!?…\p{Extended_Pictographic}])$/u, '$1.');
  if (style === 'chato') return (x % 3 ? t : `${t}. ${['aff', 'pff', 'enfim'][x % 3]}`).replace(/[!]+/g, '').replace(/\s*\p{Extended_Pictographic}/gu, '');
  if (style === 'amigo') return x % 2 ? `${t} ${['😄', '🙌', '🤝', '😁', '🔥'][x % 5]}` : `${t}!!`;
  return t.replace(/(@\S+)|[^@]+/g, (m, at) => (at ? m : m.toLowerCase())).replace(/\bvoce\b/g, 'vc').replace(/\bque\b/g, 'q').replace(/\bnao\b/g, 'n');
}
