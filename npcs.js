// Jogadores do mundo (controlados pelo jogo): nicks, visual, fortuna, estatísticas e presença online.
// Tudo é calculado pelo horário e pelo mês do mundo, então é igual para todos os aparelhos.
import { T } from './tune.js';
import { rank, CARS, REGIONS, ANCHOR as A } from './logic.js';
import { LISTS } from './negocios.js';
import { current, DEFAULT as WORLD0 } from './world.js';

// [nick, patrimônio inicial, crescimento por mês, pele, cabelo, cor do cabelo, barba, roupa, cor da roupa, acessório, frase]
const RAW = [
  ['ReiDoGado', 880000, 0.022, 2, 'degradê', 1, 'por fazer', 'terno', 6, 'relógio de luxo', 'soja de dia, mesa vip de noite 😎'],
  ['A Boiadeira', 720000, 0.026, 1, 'longo', 3, 'nenhuma', 'jaqueta', 2, 'brinco', 'boiada no pasto e galgo na pista'],
  ['Blackjack21', 610000, 0.02, 3, 'curto', 1, 'cavanhaque', 'camisa', 1, 'óculos escuros', '21 é matematica, o resto é choro'],
  ['RainhaDaSoja', 520000, 0.028, 2, 'coque', 4, 'nenhuma', 'camisa', 4, 'corrente de ouro', 'presidenta do mirassol, bora subirrr'],
  ['CriptoTrader', 430000, 0.024, 4, 'boné', 2, 'por fazer', 'moletom', 5, 'boné de marca', 'btc de 5 min ou nada'],
  ['HarasEstrela', 360000, 0.03, 1, 'longo', 5, 'nenhuma', 'regata', 3, 'brinco', 'haras ferraz 🐎'],
  ['TratorBrabo', 300000, 0.02, 5, 'raspado', 1, 'cheia', 'jaqueta', 3, 'fone gamer', 'era entregador, hj sou fazendeiro kkk'],
  ['TerraFirme', 255000, 0.027, 3, 'coque', 2, 'nenhuma', 'camisa', 2, 'pulseira de prata', 'compro terra arrendada, chama'],
  ['RoletaVermelha', 215000, 0.024, 4, 'degradê', 1, 'bigode', 'moletom', 1, 'óculos escuros', 'so no vermelho, sempre'],
  ['FeiraMaster', 180000, 0.031, 2, 'curto', 3, 'nenhuma', 'regata', 6, 'brinco', 'a feira é meu cassino'],
  ['NeloreBR', 150000, 0.02, 3, 'boné', 4, 'por fazer', 'camiseta', 5, 'nenhum', 'nelore no tocantins'],
  ['CafeForte', 128000, 0.026, 1, 'longo', 2, 'nenhuma', 'camiseta', 4, 'nenhum', 'cafe do sul de minas ☕'],
  ['Coringa021', 112000, 0.022, 5, 'raspado', 2, 'cavanhaque', 'jaqueta', 6, 'corrente de ouro', 'aviator 2x e vazo'],
  ['Novato_BR', 98000, 0.025, 2, 'curto', 5, 'nenhuma', 'camisa', 3, 'nenhum', 'comecei agr, bora'],
  ['LoboNoturno', 91000, 0.03, 4, 'degradê', 1, 'por fazer', 'moletom', 2, 'fone gamer', 'so jogo de madrugada'],
  ['DezVezes21', 84000, 0.028, 3, 'boné', 1, 'nenhuma', 'camiseta', 1, 'boné de marca', 'bati 21 cinco vezes seguidas, juro'],
  ['GalgoVeloz', 76000, 0.024, 2, 'curto', 2, 'nenhuma', 'regata', 5, 'nenhum', 'meu galgo vai levar o grande premio, anota'],
  ['CartaRara', 70000, 0.032, 1, 'coque', 3, 'nenhuma', 'camisa', 6, 'brinco', 'carta rara ou nada'],
  ['HighRollerX', 64000, 0.02, 5, 'raspado', 1, 'cheia', 'terno', 6, 'óculos escuros', 'high roller aposentado (mentira)'],
  ['ContaCarta', 59000, 0.027, 5, 'degradê', 1, 'cavanhaque', 'jaqueta', 1, 'corrente de ouro', 'conto carta de cabeça 🧠'],
  ['RelampagoBR', 55000, 0.029, 2, 'longo', 4, 'nenhuma', 'regata', 2, 'brinco', 'treinando o relampago todo mes'],
  ['LeaoDoSport', 52000, 0.023, 3, 'curto', 2, 'por fazer', 'camisa', 3, 'nenhum', 'sou do sport, me aceita'],
  ['Entregador99', 48000, 0.03, 1, 'coque', 1, 'nenhuma', 'moletom', 4, 'nenhum', 'juntando grana pra hilux'],
  ['PrimeiroMes', 44000, 0.026, 4, 'boné', 2, 'nenhuma', 'camiseta', 5, 'nenhum', 'primeiro mes aqui, pega leve'],
  ['TrocaTroca', 41000, 0.028, 2, 'longo', 5, 'nenhuma', 'regata', 6, 'nenhum', 'qm quer trocar carta?'],
  ['RumoAoMilhao', 38000, 0.025, 3, 'degradê', 1, 'nenhuma', 'camiseta', 1, 'nenhum', 'rumo ao primeiro milhao 🤑'],
  ['BTCnaVeia', 35000, 0.03, 1, 'curto', 3, 'nenhuma', 'camisa', 2, 'brinco', 'all in no bitcoin'],
  ['MengaoBR', 32000, 0.027, 4, 'raspado', 2, 'por fazer', 'moletom', 3, 'nenhum', 'mengao sempre'],
  ['So21', 30000, 0.024, 3, 'curto', 1, 'nenhuma', 'camiseta', 4, 'nenhum', 'so 21 e nada mais'],
  ['MetaHaras', 28000, 0.031, 2, 'coque', 4, 'nenhuma', 'regata', 5, 'nenhum', 'meta: ter um haras'],
  ['RecomecoBR', 26000, 0.026, 5, 'boné', 1, 'nenhuma', 'camiseta', 6, 'nenhum', 'recomecei do zero, sem drama'],
  ['SemanaUm', 24000, 0.029, 1, 'longo', 2, 'nenhuma', 'camisa', 1, 'nenhum', 'primeira semana!!'],
];
const hash = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const BASE = RAW.map(([nick, base, g, skin, hair, hairColor, beard, outfit, cloth, acc, bio], i) =>
  ({ id: `n${i}`, i, nick, base, g, bio, look: { name: nick, skin, hair, hairColor, beard, eyes: 1 + (i % 4), outfit, cloth, acc } }));
// mais 140 jogadores com nicks montados de palavras (nunca nome de pessoa)
const PRE = ['Mestre', 'Lobo', 'Touro', 'Falcao', 'Barao', 'Trader', 'Safra', 'Galgo', 'Ficha', 'Roleta', 'Dama', 'Valete', 'Corvo', 'Tigre', 'Pantera', 'Dragao', 'Lenda', 'Ninja', 'Sniper', 'Capitao', 'Fazendeiro', 'Peao', 'Boiadeiro', 'Vaqueiro', 'Sorte', 'Trevo', 'Diamante', 'Esmeralda', 'Aguia', 'Raio', 'Furia', 'Brabo', 'Zica', 'Turbo', 'Nitro', 'Fenix', 'Cometa', 'Tropeiro', 'Cavaleiro', 'Magnata'];
const SUF = ['21', 'BR', 'Gamer', 'Rico', 'Pro', 'X', '777', 'Ouro', 'Prime', 'MT', 'GO', 'SP', 'MG', 'PR', 'Top', 'Real', '99', 'Max', 'Neo', 'Zero'];
const BIOS = ['so jogo de noite', 'rumo ao top 10', 'gado, soja e 21', 'mesa vip ou nada', 'colecionando carta rara', 'treinando galgo todo mes', 'trader de 1 min kkk', 'fazenda no mato grosso', 'granja e pomar, o resto é sorte', 'aviator até 2x e tchau', 'comecei do zero', 'qm quer trocar?', 'meta: primeiro milhao', 'meu time ta subindo', 'roleta so no preto', 'nao me chama no pv pra pedir dinheiro kkk', 'vivendo de safra', 'perdi tudo 2x e voltei', 'aqui é trabalho, nao sorte'];
const HAIR = ['curto', 'degradê', 'longo', 'coque', 'raspado', 'boné'], OUT = ['camiseta', 'moletom', 'regata', 'camisa', 'jaqueta', 'terno'], ACC = ['nenhum', 'nenhum', 'brinco', 'óculos escuros', 'fone gamer', 'corrente de ouro', 'boné de marca'];
const r0 = n => { const x = Math.sin(n * 91.3 + 7.1) * 43758.5453; return x - Math.floor(x); };
const used = new Set(BASE.map(n => n.nick.toLowerCase()));
const EXTRA = [];
for (let k = 0; EXTRA.length < 140 && k < 2000; k++) {
  const sep = ['', '_', '.', ''][Math.floor(r0(k * 3) * 4)];
  let nick = PRE[Math.floor(r0(k) * PRE.length)] + sep + SUF[Math.floor(r0(k + 500) * SUF.length)];
  if (r0(k + 900) < 0.25) nick = nick.toLowerCase();
  if (used.has(nick.toLowerCase())) continue;
  used.add(nick.toLowerCase());
  const i = BASE.length + EXTRA.length, w = r0(k + 1300);
  EXTRA.push({ id: `n${i}`, i, nick, base: Math.round(15000 + w * w * 420000), g: 0.015 + r0(k + 1700) * 0.02, bio: BIOS[Math.floor(r0(k + 2100) * BIOS.length)],
    look: { name: nick, skin: 1 + Math.floor(r0(k + 2500) * 5), hair: HAIR[Math.floor(r0(k + 2900) * 6)], hairColor: 1 + Math.floor(r0(k + 3300) * 5), beard: ['nenhuma', 'por fazer', 'cavanhaque', 'bigode', 'cheia'][Math.floor(r0(k + 3700) * 5)], eyes: 1 + (i % 4), outfit: OUT[Math.floor(r0(k + 4100) * 6)], cloth: 1 + Math.floor(r0(k + 4500) * 6), acc: ACC[Math.floor(r0(k + 4900) * ACC.length)] } });
}
// Nicks de gamer (estilo CS, Valorant, LoL): cada bot troca o nick UMA vez, numa data só dele, espalhada em 60 dias
// (uns 2 por dia, ninguém percebe). Uns 30% nunca trocam. O nick antigo continua valendo para achar o jogador (byNick).
const GN = ['kaique', 'biel', 'guizin', 'pedrin', 'lukinhas', 'thzin', 'jvzin', 'vitin', 'nandin', 'rafinha', 'teteu', 'juninho', 'dudu', 'manu', 'bia', 'duda', 'lari', 'mari', 'gabi', 'caio', 'enzo', 'davi', 'leozin', 'theo', 'gui', 'mth', 'tuts', 'dani', 'kaua', 'vini', 'brenin', 'igor', 'xandy', 'netin', 'mel'];
const GC = ['sniper', 'clutch', 'ace', 'flick', 'smurf', 'tilt', 'rush', 'eco', 'awp', 'deagle', 'vandal', 'phantom', 'spray', 'entry', 'lurker', 'jungle', 'mid', 'adc', 'gank', 'carry', 'headshot', 'onetap', 'noscope', 'tryhard', 'frag', 'peek', 'defuse', 'baron', 'drake', 'ward', 'ult', 'combo', 'retake', 'ninja', 'rato'];
const GS = ['zin', 'zera', 'BR', 'gg', 'tv', 'fps', '777', '01', '_br', '2k', 'zz', 'xd'];
const cap1 = w => w[0].toUpperCase() + w.slice(1);
export function gamerNick(k) {
  const r = j => r0(k * 17 + j), p = a => a[Math.floor(r(a.length) * a.length)], nm = p(GN), co = GC[Math.floor(r(3) * GC.length)], su = GS[Math.floor(r(5) * GS.length)];
  const forms = [`${nm}${['', '_', '.'][Math.floor(r(7) * 3)]}${co}`, `${co}${su}`, `xX${co}Xx`, `${nm}${su}`, `${['its', 'not', 'im', 'o'][Math.floor(r(9) * 4)]}${cap1(co)}`, `${co}.${nm}`, `${cap1(nm)}${cap1(co)}`, `${nm}${Math.floor(r(11) * 90 + 10)}`];
  const n = forms[Math.floor(r(13) * forms.length)];
  return r(15) < 0.3 ? n.toLowerCase() : n.slice(0, 16);
}
export const RENAME_START = Date.UTC(2026, 10, 21, 12), RENAME_DAYS = 60;
// bots da história da TV 21 nunca trocam de nick: ReiDoGado e A Boiadeira (queda do cassino) e os do fundo 21 Capital (FALLEN e HEAVY abaixo)
export const STORY = new Set(['n0', 'n1', 'n2', 'n3', 'n5', 'n71', 'n112']);
for (const n of [...BASE, ...EXTRA]) {
  n.orig = n.nick;
  if (r0(n.i * 13 + 5) < 0.7 && !STORY.has(n.id)) {
    let g = '', k = n.i * 31;
    do g = gamerNick(k++); while (used.has(g.toLowerCase()));
    used.add(g.toLowerCase()); n.gnick = g; n.renameAt = RENAME_START + Math.floor(r0(n.i * 13 + 6) * RENAME_DAYS * 864e5);
  }
}
// 26/11/2026: nicks escolhidos pelo dono do jogo. Um bot por vez, numa hora só dele, ao longo de 10 dias (~11 por dia), troca de nick
// como gente de verdade troca (os da história da TV, STORY, ficam com o nick de sempre). O nick antigo continua achando o jogador.
export const NEW_NICKS = ["Menina do MAL", "Cola no pai", "Flamengo Pai", "Menfis", "Arlequina", "Vim do Lolzin", "Cs2 AKNA AWP", "777 BROX", "Main Diana", "Carlos BA", "Vitoria S.A", "Paula JJ", "Bruninha rp", "GTA IV - KillerM", "Moises", "Fofo do pai", "Nenem", "Esa Adc", "Neizin RP", "VEM NENEM", "Luiza abs", "KKKKKK", "Vózinha", "Main is Vayne", "INSS N APOSENTO", "Lendario", "Funkeiro de Okley", "Reizinho", "Papalegua", "Killer2", "The Best", "O King", "Marquinho", "RED Kill", "ZAC", "KS Ou Coca ?", "NIKE RIO", "Zé da Manga ADJ", "JJ", "DJ Kevin", "Adrien", "Dj Ana", "Molister", "CC dê", "Malandro do 33", "CPX Dodo", "LALA", "PAULISTINHA", "KIKO DA FF", "Viciado em ARAM", "GTA é VIDA", "POZE DO RODO", "Aninha do trader", "Nunca LA ELE", "NET PX", "ZOREIA", "AmisterD", "SADASDDSA", "VIM PRA AMAR", "O MAL", "OS Karate UFC", "Marcao MAP", "Coelho 888", "BOLA 12", "Jogada de MASTER", "Baianinho de MAUA", "ARACAJU JU JU", "Tigresa", "Rafa_x3", "Ryan DDP", "IK 47VV", "Korea RX", "XT ou NENET", "Garagem MOKS", "Moca CPX", "Fla até Morre !", "Versa", "Unin Turbinado", "Zé da Cachumba", "Bola de Aço", "Truqueiro", "777", "CAssia Cassino", "o CAIXA", "Br30", "Avzin Red", "APK Haha", "Coringa", "VOA I", "Rastafari", "Bob Marley", "Reggae Ana", "OPTIMUS PRIME", "VOVO DO TRADER", "Trader na veia", "Travada da Coluna", "Rees", "Renatinha 777", "777 Cassino PD", "Noémia", "putz", "Perdx", "Prdrox", "Neorox", "ALOX", "LUIZIN", "LKSO", "Churras", "88 Bola", "MC CATRA"];
export const NEW_START = Date.UTC(2026, 10, 26, 3), NEW_DAYS = 10;
{ const pool = [...BASE, ...EXTRA].filter(n => !STORY.has(n.id)).sort((a, b) => r0(a.i * 7 + 101) - r0(b.i * 7 + 101)), L = NEW_NICKS.length;
  let k = 0; for (const nm of NEW_NICKS) { if (used.has(nm.toLowerCase()) || k >= pool.length) continue; used.add(nm.toLowerCase());
    const n = pool[k]; n.unick = nm; n.unickAt = NEW_START + Math.floor((k + r0(n.i * 5 + 77)) / L * NEW_DAYS * 864e5); k++; } }
// 25/11 23:00 (Brasília): nicks com cara de robô (…Ouro, Barão…, Cometa…, Touro…, Magnata…) trocam já: o nome novo que estava marcado
// para depois chega agora; sem nome novo, entra o nick gamer; sem nenhum, um nome de gente. Fazendeiro_Ouro é da história: fica.
export const FIX_AT = Date.UTC(2026, 10, 26, 2, 0);
{ const FIX = ['n45', 'n54', 'n56', 'n64', 'n70', 'n90', 'n93', 'n97', 'n109', 'n120', 'n124', 'n142', 'n150', 'n160', 'n171', 'n46', 'n48', 'n91', 'n108', 'n158'], NAME = { n56: 'Pedrão Ribeirão', n46: 'Tiaguinho do Pneu', n48: 'Lara Moraes', n91: 'Gaúcho do Truco', n108: 'Juninho Placas', n158: 'Dona Cida 21' };
  for (const n of [...BASE, ...EXTRA]) { if (!FIX.includes(n.id) || STORY.has(n.id)) continue;
    if (!n.unick && !n.gnick && NAME[n.id] && !used.has(NAME[n.id].toLowerCase())) { n.unick = NAME[n.id]; used.add(n.unick.toLowerCase()); }
    if (n.unick) n.unickAt = Math.min(n.unickAt ?? FIX_AT, FIX_AT); else if (n.gnick) n.renameAt = Math.min(n.renameAt, FIX_AT); } }
// 26/11/2026 18:30 UTC: os nicks do dono que ainda não tinham entrado deixam de ser troca de nome de bot antigo (deixava rastro:
// jogador velho com nível e histórico aparecendo com outro nome) e viram jogadores NOVOS, chegando aos poucos em 3 dias, como
// gente se cadastrando. As 17 trocas que já tinham acontecido ficam. Os novos começam com R$ 10 mil e crescem devagar
// (fortuna final de R$ 40 mil a R$ 1,2 mi): nunca passam o topo dos jogadores de verdade e nunca caçam o líder (rivals.js).
export const NEW_CUT = Date.UTC(2026, 10, 26, 18, 30), FRESH_DAYS = 3;
const later = [];
for (const n of [...BASE, ...EXTRA]) if (n.unick && n.unickAt >= NEW_CUT) { later.push(n.unick); delete n.unick; delete n.unickAt; }
const FRESHB = later.map((nick, k) => {
  const i = BASE.length + EXTRA.length + k, w = r0(i * 3 + 41);
  return { id: `n${i}`, i, nick, orig: nick, base: Math.round(40000 + w * w * w * 1160000), g: 0.02, bio: '', ramp: 2 + r0(i * 3 + 43) * 4,
    arriveAt: NEW_CUT + Math.floor((k + r0(i * 3 + 45)) / later.length * FRESH_DAYS * 864e5),
    look: { name: nick, skin: 1 + Math.floor(r0(i + 2500) * 5), hair: HAIR[Math.floor(r0(i + 2900) * 6)], hairColor: 1 + Math.floor(r0(i + 3300) * 5), beard: ['nenhuma', 'por fazer', 'cavanhaque', 'bigode', 'cheia'][Math.floor(r0(i + 3700) * 5)], eyes: 1 + (i % 4), outfit: OUT[Math.floor(r0(i + 4100) * 6)], cloth: 1 + Math.floor(r0(i + 4500) * 8), acc: ACC[Math.floor(r0(i + 4900) * ACC.length)] } };
});
for (const n of [...BASE, ...EXTRA]) {
  delete n.nick;
  Object.defineProperty(n, 'nick', { enumerable: true, get() { const t = Date.now(); return this.unick && t >= this.unickAt ? this.unick : this.gnick && t >= this.renameAt ? this.gnick : this.orig; } });
}
// mundo recomeçado: as bios antigas falavam de time, haras, galgo, fazenda e carta que ninguém tem mais. Todo bot começa com uma frase de quem acabou de chegar
const FRESH = ['bora', 'sem tempo, só passando', 'foco no gado', 'aceito parceria', 'chama no pv', 'devagar e sempre', '🐂', 'agro é a base de tudo', 'comecei agora, bora', 'recomeçando do zero kkk', 'primeiro dia por aqui', 'sem nada ainda, vamos ver', 'rumo ao primeiro milhão', 'recomecei do zero, sem drama', 'novo por aqui, pega leve', 'meta: sair dos 10 mil', 'soja, gado e empresa', 'vivendo de safra e dividendo', 'compro na baixa, vendo na alta', 'diversificar é a regra', 'compro terra, chama no pv'];
export const NPCS = [...BASE, ...EXTRA, ...FRESHB].map(n => ({ ...n, bio: hash(n.i * 59 + 11) < 0.45 ? '' : FRESH[Math.floor(hash(n.i * 61 + 3) * FRESH.length)] }));   // ~45% sem recado no perfil
// 24/11/2026 13:40: a fortuna de cassino do ReiDoGado e da A Boiadeira foi tomada (TV 21: "mafioso do cassino", sem nomes).
// Caem para o 13º/14º lugar e voltam bem devagar, só com gado, terra e negócios (rivals.js calcula e guarda aqui). Perfil sempre aberto.
export const FALL = Date.UTC(2026, 10, 24, 16, 40), FALLEN = new Set(['n0', 'n1']);
// fortuna que o ranking mostra agora (rivals.js: caçadores do topo, vizinhos e os dois caídos). worthAt devolve esta para o "agora",
// então nível, perfil, chat, mesas e amigos batem com o ranking. raw = true: a fortuna de base, sem o ranking (só rivals.js usa)
export const SHOWN = new Map();
// 26/11/2026: os especuladores saem do topo (rivals.js RETREAT) e a fortuna de base dos bots para de crescer: os jogadores ficam em cima
export const GROW_STOP = Date.UTC(2026, 10, 26, 4, 0);
// 26/11/2026 18:30 UTC: os antigos perdem mais 12%, devagar, em 2 dias (gente nova chegando divide o mercado)
const oldDim = t => 1 - 0.12 * Math.min(1, Math.max(0, (t - NEW_CUT) / (2 * 864e5))) ** 2 * (3 - 2 * Math.min(1, Math.max(0, (t - NEW_CUT) / (2 * 864e5))));
// todos os jogadores do mundo perdem 25% em 3 h reais a partir daí (devagar, sem salto): mais disputa para quem tem conta
const ss = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// 24/11/2026 15:40: quebra do fundo 21 Capital (TV 21). Quem tinha dinheiro no fundo perde 20%, devagar, ao longo de 12 h (ninguém fica sem nada).
// No topo a perseguição ao líder cai 25% nas mesmas 12 h e só recupera um pouco em 3 dias (fica em 85%): os jogadores sobem devagar.
// HEAVY: os que tinham mais no fundo (RainhaDaSoja, Blackjack21, HarasEstrela, vaqueironeo, Fazendeiro_Ouro) perdem mais, em 18 h,
// e saem do topo aos poucos (rivals.js para de puxar eles para perto do líder).
export const CRASH = Date.UTC(2026, 10, 24, 18, 40), HEAVY = new Set(['n3', 'n2', 'n5', 'n71', 'n112']);
export const CRASH_H = 36;   // horas reais da queda (bem devagar)
export const crashOf = t => 1 - 0.2 * ss((t - CRASH) / (CRASH_H * 36e5));
export const crashHunt = t => 1 - 0.25 * ss((t - CRASH) / (CRASH_H * 36e5)) + 0.1 * ss((t - CRASH - CRASH_H * 36e5) / (72 * 36e5));
export const heavyOf = t => 1 - 0.55 * ss((t - CRASH) / (48 * 36e5));   // perseguição dos HEAVY: some quase toda em 18 h
const heavyBase = (n, t) => (HEAVY.has(n.id) ? 1 - 0.15 * ss((t - CRASH) / (48 * 36e5)) : 1);   // e a fortuna deles cai mais 15%
export const dropOf = t => (1 - 0.25 * ss((t - FALL) / (3 * 36e5))) * crashOf(t);
// folga: jogadores fora do jogo até a hora indicada (UTC). 12:20 de Brasília = 15:20 UTC. Apague a linha para voltarem antes.
export const AWAY = { 'ReiDoGado': Date.UTC(2026, 10, 21, 15, 20), 'A Boiadeira': Date.UTC(2026, 10, 21, 15, 20) };
export const isAway = (n, now = Date.now()) => (AWAY[typeof n === 'string' ? byNick(n)?.orig ?? n : n?.orig ?? n?.nick] || 0) > now;
export const byId = id => NPCS.find(n => n.id === id);
export const byNick = nick => NPCS.find(n => n.nick === nick) || NPCS.find(n => n.orig === nick || n.gnick === nick || n.unick === nick);   // nick antigo ainda acha o jogador
const OLDN = () => NPCS.filter(x => !x.arriveAt);
export const nicks = (from, n) => { const o = OLDN(); return Array.from({ length: n }, (_, k) => o[(from + k * 7) % o.length].nick); };

// ---------- vida de cada bot ----------
// Vontade de jogar (0 a 1): ondas lentas de vários dias, diferentes para cada um (fase "viciado" e fase "sumido").
// Online: quem tem mais vontade e está perto do seu horário preferido. Patrimônio: sobe aos poucos enquanto ele joga e
// desce devagar quando some (custos correndo). É a integral da vontade, então nunca dá salto.
const DAY = 864e5, TAU = Math.PI * 2;
const per = n => [4 + hash(n.i * 7 + 1) * 8, 1.7 + hash(n.i * 7 + 2) * 2];
export function drive(n, t = Date.now()) {
  const d = t / DAY, [p1, p2] = per(n);
  return Math.min(1, Math.max(0, 0.5 + 0.38 * Math.sin(TAU * d / p1 + n.i * 1.3) + 0.14 * Math.sin(TAU * d / p2 + n.i * 0.7)));
}
export function form(n, t = Date.now()) {
  const d = t / DAY, [p1, p2] = per(n);
  return 1 - 0.13 * Math.cos(TAU * d / p1 + n.i * 1.3) - 0.04 * Math.cos(TAU * d / p2 + n.i * 0.7);
}
const peakOf = n => (hash(n.i * 7 + 3) < 0.3 ? 22 + hash(n.i * 7 + 4) * 5 : 11 + hash(n.i * 7 + 4) * 11) % 24;   // 30% corujas
function hourFit(n, t) { const h = ((t / 36e5 - 3) % 24 + 24) % 24, x = Math.abs(h - peakOf(n)), dist = Math.min(x, 24 - x); return Math.max(0, 1 - dist / 7); }
export const propensity = (n, t) => hourFit(n, t) * 0.55 + drive(n, t) * 0.6 + hash(n.i * 97 + Math.floor(t / 1200000)) * 0.3;
// relógio do mundo (live.js troca pela config do servidor) e quantos jogadores de verdade estão no salão (casino.js atualiza):
// online = só quem já chegou ao mundo (está no ranking), e os bots completam o total junto com as pessoas de verdade
export const CLOCK = { world: WORLD0, real: 1 };
const arrived = (n, t) => current(CLOCK.world, t) >= startMonth(n);
const byPropensity = t => [...NPCS].filter(n => !isAway(n, t) && arrived(n, t)).sort((a, b) => propensity(b, t) - propensity(a, t));

// largada: nos primeiros 288 meses do mundo (2 dias reais) os bots crescem 6x mais devagar e não caçam ninguém (rivals.js)
export const EARLY = 288;
export const NPC_LATE = 1.004, NPC_LATE_CAP = 6;
// o reforço não entra de uma vez: começa no mês 440 do mundo (19/11/2026) e chega ao total em ~1 mês real (4320 meses de 10 min)
export const NPC_RAMP_START = 440;   // força final e dias da rampa: painel admin (tune.js)
// resultado das escolhas de cada um na economia do mundo (econ.js liga isto): quem apostou no produto que caiu perde, quem pegou a alta ganha
export const PERF = { fn: null };
// fortuna no mês do mundo (pode ser fracionário: anda devagar entre um mês e outro)
export function worthAt(n, month, t = Date.now(), raw = false) {
  if (n.arriveAt) { const d = Math.max(0, (t - n.arriveAt) / 864e5); return Math.round((10000 + (n.base - 10000) * (1 - Math.exp(-d / n.ramp)) * Math.min(1, Math.max(0, (month - 1) / EARLY))) * (1 + 0.05 * Math.sin(month * 0.7 + n.i)) * form(n, t)); }   // novo: R$ 10 mil e sobe devagar
  if (!raw && SHOWN.has(n.id) && Math.abs(t - Date.now()) < 120000) return SHOWN.get(n.id);   // agora: o mesmo número do ranking
  const fell = FALLEN.has(n.id) && t >= FALL;
  const wm = month; month = Math.min(month, current(CLOCK.world, GROW_STOP));   // GROW_STOP: a fortuna de base para de crescer (as ondas seguem)
  const m = Math.min(48, Math.max(0, month - 1) * 48 / EARLY);   // arrancada esticada pela largada inteira (2 dias reais)
  const late = Math.min(NPC_LATE_CAP, NPC_LATE ** Math.max(0, month - 49)), NPC_RAMP = T.npcRampDays * 144;   // depois seguem crescendo devagar, até 6x
  const wave = 1 + 0.07 * Math.sin(wm * 0.7 + n.i * 2.1) + 0.03 * Math.sin(wm * 2.3 + n.i);
  const boost = 1 + (T.npcBoost - 1) * Math.min(1, m / 48);   // mundo novo continua alcançável
  const r = Math.min(1, Math.max(0, (month - NPC_RAMP_START) / NPC_RAMP));   // 0 em 19/11/2026, 1 daqui a um mês
  const start = 10000 * (Math.max(10000, n.base) / 10000) ** (m / 48);   // todo bot começa o mundo com R$ 10 mil e chega à fortuna dele no mês 49
  return Math.round(start * (1 + n.g * 0.55) ** m * (1 + (boost * late - 1) * r) * wave * form(n, t) * (PERF.fn ? PERF.fn(n, wm) : 1) * dropOf(t) * heavyBase(n, t) * oldDim(t) * (fell ? 0.15 : 1));   // caído e o ranking ainda não calculou: uma fração do que tinha
}
// chegada: cada bot entra no mundo num momento diferente das primeiras 24 h reais (144 meses): o ranking enche aos poucos, como gente de verdade chegando
export const startMonth = n => (n.arriveAt ? current(CLOCK.world, n.arriveAt) : 1 + Math.floor(hash(n.i * 13 + 7) * 144));   // os novos (FRESHB): chegam na hora deles
export const levelFor = worth => Math.max(1, Math.min(60, Math.round(Math.log10(Math.max(10, worth)) * 7 - 28)));

// negócios do bot: a cada janela de 3 h em que ele estava com vontade de jogar, fecha um negócio do tamanho da fortuna dele
const DEAL_MS = 3 * 36e5;
const DEAL_KINDS = [
  (v, r) => { const q = Math.max(10, Math.round(v * 0.03 / 2600 / 10) * 10); return { txt: `comprou ${q} bezerros`, val: -q * Math.round(A.bezerro * (0.9 + r * 0.2)) }; },
  (v, r) => { const q = Math.max(10, Math.round(v * 0.04 / 4700 / 10) * 10); return { txt: `vendeu ${q} bois gordos`, val: q * Math.round(A.arroba * 16 * (0.9 + r * 0.2)) }; },
  (v, r) => { const q = Math.max(100, Math.round(v * 0.02 / 130 / 100) * 100), p = Math.round(A.soja * (0.9 + r * 0.2)); return { txt: `vendeu ${q} sacas de soja a R$ ${p}`, val: q * p }; },
  (v, r) => { const q = Math.max(100, Math.round(v * 0.015 / 60 / 100) * 100), p = Math.round(A.milho * (0.9 + r * 0.2)); return { txt: `comprou ${q} sacas de milho a R$ ${p}`, val: -q * p }; },
  (v, r) => { const q = Math.max(20, Math.round(v * 0.01 / 1400 / 10) * 10), p = Math.round(A.cafe * (0.9 + r * 0.2)); return { txt: `vendeu ${q} sacas de café a R$ ${p}`, val: q * p }; },
  (v, r) => { const ha = Math.max(20, Math.round(v * 0.06 / 18000 / 10) * 10); return { txt: `comprou ${ha} ha de terra`, val: -ha * Math.round(15000 + r * 9000) }; },
  (v, r) => { const q = Math.max(500, Math.round(v * 0.004 / 6.2 / 500) * 500); return { txt: `vendeu ${q} kg de frango`, val: Math.round(q * (5.6 + r * 1.2)) }; },
  (v, r) => { const q = Math.max(50, Math.round(v * 0.005 / 38 / 50) * 50); return { txt: `vendeu ${q} caixas de laranja`, val: q * Math.round(A.laranja * (0.9 + r * 0.2)) }; },
  (v, r) => { const ha = Math.max(20, Math.round(v * 0.05 / 18000 / 10) * 10); return { txt: `recebeu arrendamento de ${ha} ha`, val: Math.round(ha * (180 + r * 90)) }; },
  (v, r) => ({ txt: 'recebeu o lucro das empresas', val: Math.round(v * (0.002 + r * 0.004) / 100) * 100 }),
];
export function deals(n, worth, now = Date.now(), max = 6) {
  const out = [], s0 = Math.floor(now / DEAL_MS);
  for (let k = 0; k < 40 && out.length < max; k++) {
    const sl = s0 - k, t = sl * DEAL_MS + hash(n.i * 131 + sl) * DEAL_MS;
    if (t > now || hash(n.i * 37 + sl) > 0.15 + drive(n, t) * 0.6) continue;
    const d = DEAL_KINDS[Math.floor(hash(n.i * 53 + sl) * DEAL_KINDS.length)](worth * (0.5 + hash(n.i * 29 + sl) * 1.1), hash(n.i * 71 + sl));
    out.push({ ...d, at: t });
  }
  return out;
}

// 24/11/2026: os jogadores do mundo largaram o cassino e vivem de agro e empresas. As partidas de antes continuam no perfil, paradas nesse dia
export const CASINO_STOP = Date.UTC(2026, 10, 24, 3);
const BIZ = Object.entries(LISTS).filter(([c]) => c !== 'usinas').flatMap(([cat, L]) => Object.entries(L).map(([brand, v]) => ({ cat, brand, price: v.price })));
// o que cada um tem (empresas, terras, granja...), fixo por pessoa e do tamanho da fortuna: o perfil fica igual ao de quem tem conta
function assets(n, worth, lands, ha, age) {
  const r = k => hash(n.i * 43 + k), can = BIZ.filter(b => b.price <= worth * 0.3), want = worth < 3e6 ? 0 : Math.min(can.length, 1 + Math.floor(r(1) * Math.min(5, worth / 8e6))), biz = [];
  for (let k = 0; biz.length < want && k < 60; k++) { const b = can[Math.floor(r(10 + k) * can.length)]; if (!biz.includes(b)) biz.push(b); }
  const landList = Array.from({ length: Math.min(10, lands) }, (_, k) => ({ region: REGIONS[Math.floor(r(80 + k) * REGIONS.length)].name, ha: Math.max(10, Math.round(ha / lands / 10) * 10), orchard: r(120 + k) < 0.15, cane: r(140 + k) < 0.12 }));
  return { biz: biz.map(({ cat, brand }) => ({ cat, brand })), landList, mina: worth > 2e7 && r(2) < 0.3, wh: worth > 1.5e6 ? Math.floor(r(3) * 4) : 0,
    granja: worth > 8e5 && r(4) < 0.5 ? 1 + Math.floor(r(5) * 4) : 0, suinos: worth > 1e6 && r(6) < 0.4 ? 1 + Math.floor(r(7) * 3) : 0, cardsN: Math.floor(r(8) * 24 * age), club: null };
}
// a perda de 24/11 aparece no perfil de cada um com a causa dele (fixa por pessoa), no momento em que ela acontece nas 12 h da queda:
// a maioria tinha dinheiro no fundo 21 Capital; uns venderam a produção na baixa por medo; poucos torraram no cassino antes de largar
export const lossCause = n => (HEAVY.has(n.id) ? 'fundo' : ((x) => (x < 0.6 ? 'fundo' : x < 0.88 ? 'baixa' : 'cassino'))(hash(n.i * 211 + 3)));
function fundo(n, worth, now = Date.now()) {
  if (now < CRASH || FALLEN.has(n.id) || worth < 2e5) return [];
  const r = k => hash(n.i * 211 + k), cause = lossCause(n), at = CRASH + r(7) * (CRASH_H - 2) * 36e5, k = HEAVY.has(n.id) ? 0.35 : 0.2;
  if (cause === 'fundo') {
    const put = Math.round(worth * (0.6 + r(5) * 0.3) / 1000) * 1000, out = [{ txt: 'aplicou no fundo 21 Capital', val: -put, at: CRASH - (1 + r(9) * 5) * 864e5 }];
    if (at <= now) out.push({ txt: `prejuízo no fundo 21 Capital (cotas caíram ${k * 100}%)`, val: -Math.round(put * k), at });
    return out;
  }
  if (at > now) return [];
  if (cause === 'baixa') {
    const [g, p] = [['sacas de soja', A.soja], ['sacas de café', A.cafe], ['bois gordos', A.arroba * 16]][Math.floor(r(11) * 3)], q = Math.max(10, Math.round(worth * 0.25 / p / 10) * 10);
    return [{ txt: `vendeu ${q} ${g} na baixa, ${Math.round(18 + r(13) * 12)}% abaixo do preço normal`, val: Math.round(q * p * 0.76), at }, { txt: 'prejuízo na venda (vendeu antes da alta)', val: -Math.round(worth * 0.2), at: at + 60000 }];
  }
  return [{ txt: `perdeu ${int(Math.round(worth * 0.2 / 2))} fichas no cassino`, val: -Math.round(worth * 0.2), at }];
}
const int = v => v.toLocaleString('pt-BR');
// perfil completo (para a janela de perfil)
export function profile(n, month) {
  const worth = worthAt(n, month), r = k => hash(n.i * 31 + k), lv = levelFor(worth);
  const fr = n.arriveAt ? Math.min(1, Math.max(0, (Date.now() - n.arriveAt) / (3 * 864e5))) : null;   // novo (FRESHB): perfil de quem acabou de chegar
  const age = fr ?? Math.min(1, Math.max(0, (month - 1) / EARLY));   // 0 no mês 1: sem partidas, conquistas, bichos nem negócios; chega ao normal na largada (2 dias)
  const cm = Math.min(month, Math.max(1, current(CLOCK.world, CASINO_STOP))), cw = worthAt(n, cm, CASINO_STOP - 1), cage = FALLEN.has(n.id) || fr != null ? 0 : Math.min(1, Math.max(0, (cm - 1) / EARLY));   // cassino parado no dia em que largou
  const hands = Math.round((80 + levelFor(cw) * 45 + r(1) * 400) * cage), cars = Object.keys(CARS).filter(c => CARS[c].type !== 'maquina' && CARS[c].price < worth * 0.6).slice(-1 - Math.floor(r(2) * 2));
  return {
    npc: true, id: n.id, name: n.nick, look: n.look, level: lv, rank: rank(worth), worth, bio: FALLEN.has(n.id) ? ['recomeçando do zero, só no gado e na terra', 'boi no pasto e terra no nome'][n.i] : n.bio, open: FALLEN.has(n.id),
    stats: { hands, wins: Math.round(hands * (0.38 + r(3) * 0.08)), best: Math.round((150 + r(4) * Math.min(cw / 3000, 2500)) * cage), races: Math.round(r(5) * 60 * cage), raceWins: Math.round(r(6) * 14 * cage) },
    lands: Math.floor(worth / 250000), ha: Math.floor(worth / 250000) * (30 + Math.floor(r(7) * 70)), ...assets(n, worth, Math.floor(worth / 250000), Math.floor(worth / 250000) * (30 + Math.floor(r(7) * 70)), age), pioneer: !n.arriveAt && hash(n.i * 89 + 5) < 0.35, heads: Math.floor(worth / 60000) * 10,
    cars, animals: Array.from({ length: Math.floor(r(8) * 3 * age) }, (_, k) => ({ kind: k % 2 ? 'horse' : 'dog', name: '', rating: 50 + Math.floor(r(9 + k) * 30), wins: Math.floor(r(12 + k) * 8) })),
    achCount: Math.floor(Math.min(20, 2 + Math.floor(lv / 2)) * age), deals: [...fundo(n, worth), ...deals(n, worth).filter(d => Date.now() - d.at < (month - 1) * 3e5 && d.at >= (n.arriveAt || 0))].sort((a, b) => b.at - a.at).slice(0, 6),   // negócio só desde que o mundo começou (ponytail: assume 5 min por mês)
  };
}

// ---------- quantas pessoas estão jogando agora (sobe à noite, cai de madrugada) ----------
// curva por hora do dia no horário de Brasília (UTC-3)
const CURVE = [58, 46, 38, 33, 30, 31, 36, 42, 48, 52, 55, 58, 62, 60, 57, 58, 63, 70, 78, 88, 96, 102, 94, 74];
const smooth = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
export function onlineCount(now = Date.now()) {
  const h = ((now / 3600000 - 3) % 24 + 24) % 24, i = Math.floor(h), f = h - i;
  const base = CURVE[i] * (1 - f) + CURVE[(i + 1) % 24] * f;   // curva do dia (30 a 102) vira 70 a 138 jogadores: pico à noite, vale de madrugada
  return Math.max(ONLINE_MIN, Math.min(ONLINE_MAX, Math.round(70 + Math.max(0, (base - 30) / 72) ** 0.55 * 68 + (smooth(now / 420000) - 0.5) * 16 + (smooth(now / 90000) - 0.5) * 6)));   // 70 de madrugada, 123 a 138 no pico; varia a cada poucos minutos   // gente entrando e saindo a cada poucos minutos
}
export const ONLINE_MIN = 70, ONLINE_MAX = 138;
// total que todas as telas mostram: bots online + jogadores de verdade (ranking, chat, salão)
export const onlineTotal = (now = Date.now()) => onlineSet(now).size + CLOCK.real;
// quem está online agora (rodízio a cada 20 min; sempre os mesmos para todos os aparelhos)
export function onlineSet(now = Date.now(), real = CLOCK.real) {
  return new Set(byPropensity(now).slice(0, Math.max(0, onlineCount(now) - real)).map(n => n.id));
}
export function onlineNow(now = Date.now(), max = 12) {
  const want = Math.min(NPCS.length, Math.max(4, Math.round(onlineCount(now) / 5)));
  return byPropensity(now).slice(0, Math.min(max, want));
}

// vez de quem fala na TV 21 / Resenha: ordem embaralhada fixa (igual em todo aparelho), um por janela e sem repetir
// quem falou nas últimas janelas (gap = tamanho da janela em ms), para não aparecer sempre o mesmo jogador
const nickHash = s => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const nicksAt = t => [...onlineSet(t)].map(id => byId(id)?.nick).filter(Boolean);
function rot(slot, nicks, avoid) {
  const o = [...nicks].sort((a, b) => nickHash(a) - nickHash(b) || (a < b ? -1 : 1));
  for (let k = 0; k < o.length; k++) { const n = o[((slot + k) % o.length + o.length) % o.length]; if (!avoid.has(n)) return n; }
  return o[((slot % o.length) + o.length) % o.length] ?? null;
}
export const TURN_AVOID = 6;
export function turnOf(slot, nicks, gap) {
  if (!nicks.length) return null;
  // refaz em ordem as janelas anteriores (cada uma evitando as suas anteriores), igual em todo aparelho
  const chain = [];
  if (gap) for (let k = TURN_AVOID * 8; k >= 1; k--) chain.push(rot(slot - k, nicksAt((slot - k) * gap), new Set(chain.slice(-TURN_AVOID))));
  return rot(slot, nicks, new Set(chain.slice(-TURN_AVOID)));
}
