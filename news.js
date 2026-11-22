// TV 21 (regras puras): plantão de notícias do mundo. Jogadores de verdade viram notícia quando compram, vendem ou trocam algo grande;
// os jogadores do mundo (NPCs) geram notícias pelo horário, iguais para todo mundo. Quem apresenta: os âncoras da TV 21.
import { CARS, REGIONS } from './logic.js';
import { CLUBS, clubPrice } from './futebol.js';
import { LISTS } from './negocios.js';
import { CHAMPS } from './cards.js';
import { turnOf } from './npcs.js';

export const ANCHORS = ['Willian Borner', 'Retana Rater'];
export const NEWS_MIN = 30000;        // movimentos a partir de R$ 30 mil viram notícia
export const NEWS_GAP = 70000;        // notícia dos jogadores do mundo: uma a cada ~70 s (algumas janelas sem notícia)
export const KINDS = { compra: 'COMPRA', venda: 'VENDA', troca: 'TROCA', premio: 'PRÊMIO', negocio: 'NEGÓCIO', economia: 'ECONOMIA', alerta: 'ALERTA' };

// R$ 3,6 mi · R$ 850 mil · R$ 12.500
export const short = v => { v = Math.abs(Math.round(v)); const f = (x, u) => `R$ ${String(+x.toFixed(x < 10 ? 1 : 0)).replace('.', ',')} ${u}`;
  return v >= 1e9 ? f(v / 1e9, 'bi') : v >= 1e6 ? f(v / 1e6, 'mi') : v >= 1e4 ? f(v / 1e3, 'mil') : `R$ ${v.toLocaleString('pt-BR')}`; };

const tidy = t => String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
// linha do livro-caixa do jogador → notícia (ou null se não vale notícia)
const SKIP = /fichas|empréstimo|quitação|destaque no chat|reembolso|parcela|aposta|imposto|pedágio|investimento|rendimento/i;
export function fromNote(name, txt, val) {
  txt = tidy(txt);
  if (!txt || SKIP.test(txt)) return null;
  const troca = /^troca com /.test(txt);
  if (!troca && !(Math.abs(val) >= NEWS_MIN)) return null;
  const what = txt.replace(/^(loja 21|loja de luxo|loja|Feirão|leilão):\s*/i, '').replace(/^compra de /, '').replace(/^comprou /, '').replace(/^vendeu /, '');
  const kind = troca ? 'troca' : /vend/i.test(txt) ? 'venda' : /roda|prêmio|ganhou|bônus/i.test(txt) ? 'premio' : val < 0 ? 'compra' : 'negocio';
  return { kind, name: tidy(name).slice(0, 18) || 'um jogador', what: what.slice(0, 90), val: Math.round(val) };
}
// ---------- edição especial: reportagens da redação sobre as mudanças do mundo (ficam no ar por 3 dias) ----------
const ED_AT = Date.UTC(2026, 10, 22, 17, 0), ED_DAYS = 3;
const ed = (i, kind, img, title, lead) => ({ id: `ed152-${i}`, kind, img, title, lead, at: ED_AT + i * 60000, ed: true, real: false });
export const EDITORIAL = [
  ed(1, 'economia', 'assets/photo-vegas.webp', 'Fim da taxa dos ricos: imposto do 21 World passa a ser igual para todos',
    'O acréscimo nas compras, o pedágio sobre o lucro e o imposto sobre grandes fortunas foram extintos. A partir de hoje vale um único imposto de renda de 5% sobre o lucro do mês, com a mesma alíquota para o pequeno produtor e para o magnata. Mês fechado no prejuízo não paga nada. Juros do banco e honorário do contador (R$ 2.500 fixos) também deixam de variar conforme a fortuna.'),
  ed(2, 'alerta', 'assets/farm-roxa.webp', 'Reajuste da economia real: fortunas encolhem pela metade após auditoria do campo',
    'Levantamento da redação mostrou que as lavouras do 21 World davam até 79% de lucro, contra 30% a 40% na vida real. Para corrigir a distorção, o patrimônio de todos os jogadores foi reduzido em 50%, primeiro do caixa e, quando não havia dinheiro, com a venda de terras pelo valor de tabela. O ranking já mostra os novos números.'),
  ed(3, 'economia', 'assets/farm-soja.webp', 'Choque de custos: soja passa a custar R$ 6.300 por hectare e margem cai para 30%',
    'Com base nos custos do IMEA e da Aprosoja-MS para a safra 2025/26, que vão de R$ 5,6 mil a R$ 7,7 mil por hectare, o plantio ficou mais caro. A saca de soja segue o Cepea, perto de R$ 150 no Paraná. Milho custa R$ 4.800 por hectare (saca a R$ 64) e o café arábica R$ 32 mil, com uma colheita por ano e saca a R$ 1.600.'),
  ed(4, 'economia', 'assets/farm-bezerro.webp', 'Boi gordo a R$ 335 e bezerro a R$ 3.500: reposição nunca foi tão cara',
    'O indicador do bezerro do Cepea em Mato Grosso do Sul renovou a máxima histórica em outubro, perto de R$ 3.500 por cabeça, alta de quase 14% no ano. A arroba do boi gordo passa a ser negociada em torno de R$ 335. Quem engorda o gado precisa fazer conta: o lucro está na diferença entre a reposição e o boi pronto.'),
  ed(5, 'alerta', 'assets/farm-laranja.webp', 'Laranja em crise: caixa cai para R$ 28 e pomar leva até 8 anos para se pagar',
    'A indústria paga entre R$ 26 e R$ 30 pela caixa de 40,8 kg no início da safra 2026/27, segundo o Cepea, nível próximo ao de 2021. Com manutenção de R$ 1.800 por hectare ao mês, o pomar continua de pé, mas o retorno ficou longo. Na cana, o ATR em torno de R$ 1,05 por quilo deixa a tonelada perto de R$ 130.'),
  ed(6, 'economia', 'assets/farm-pasto2.webp', 'Terra vale em média R$ 40 mil o hectare; Paraná e São Paulo lideram',
    'A tabela de terras do 21 World foi atualizada com o mercado de 2026. A média nacional ficou em cerca de R$ 40 mil por hectare, segundo a Scot Consultoria. Campos Gerais (PR) e Ribeirão Preto (SP) chegam a R$ 90 mil; Rio Verde (GO), puxado pelas novas agroindústrias, R$ 55 mil. No Norte, o pasto ainda sai por R$ 10 mil a R$ 18 mil. O ágio de 35% sobre a tabela acabou.'),
  ed(7, 'economia', 'assets/photo-chips.webp', 'Juros despencam no Banco 21: empréstimo cai de 3,5% para 1,8% ao mês',
    'Com a Selic em 13,75% ao ano, o Banco 21 alinhou suas taxas ao mercado. O empréstimo com terra e gado de garantia passa a custar 1,8% ao mês. Na outra ponta, a poupança rende 0,55%, o CDB 1%, a LCA Agro 1,02% (isenta de imposto), o Tesouro 1,08% e a Previdência 1,1% ao mês. Pegar emprestado para aplicar não fecha a conta.'),
  ed(8, 'negocio', 'assets/photo-stadium.webp', 'Futebol vira negócio de gente grande: clube da Série A custa R$ 150 milhões',
    'O futebol do 21 World ganhou valores reais. Um titular da Série A recebe uns R$ 170 mil por mês e uma estrela chega a R$ 500 mil. Uma SAF da Série C sai por R$ 8 milhões e uma da Série A por R$ 150 milhões, com bilheteria, patrocínio e premiação da CBF na mesma escala. O clube médio fica perto do zero a zero: o lucro vem do G4, do acesso e da venda de jogadores. Quem tinha clube recebeu de volta o que pagou.'),
  ed(9, 'negocio', 'assets/news/news-export.webp', 'Bolsa do 21 World abre pregão de ações: Ibovespa, Petrobras, Vale e Itaú na mesa de operações',
    'A mesa de operações ganhou o Ibovespa, perto dos 171 mil pontos, e três das ações mais negociadas da B3: Petrobras PN, Vale ON e Itaú PN. O dólar foi atualizado para cerca de R$ 5,70 e o bitcoin para R$ 420 mil. Boi gordo e soja seguem a cotação do Cepea.'),
  ed(10, 'compra', 'assets/car-porsche.webp', 'Concessionárias reajustam tabela: Porsche 911 a R$ 990 mil e Huracán a R$ 4,5 milhões',
    'O Onix parte de R$ 100 mil, a Hilux SRX de R$ 335 mil e o Scania R 540 de R$ 1,02 milhão, perto da tabela Fipe. O Mercedes-AMG G 63 sai por R$ 2,15 milhões. O IPVA (4%) e o seguro (cerca de 3,5%) passam a custar 0,6% do valor por mês, e o carro desvaloriza uns 12% ao ano.'),
  ed(11, 'alerta', 'assets/photo-roulette.webp', 'Grifes perdem o poder mágico: vantagens de acessórios são recalibradas',
    'Chapéus, botas e relógios continuam dando vantagem, mas agora de 1% a 3%, o tamanho de um bom contrato com o comprador. Antes, um chapéu chegava a dobrar o lucro de uma granja. No cassino, a coleção Fortuna dá no máximo 2% e nenhuma combinação supera a vantagem da casa. O trator barateia o plantio em 10%.'),
  ed(12, 'alerta', 'assets/photo-slots.webp', 'Receita Federal aperta o cerco a quem enriquece rápido demais',
    'Quem tiver o patrimônio subindo mais de R$ 10 milhões e 25% em 10 minutos recebe um aviso da Receita. Se insistir, a conta é congelada para análise: 10 minutos na primeira vez, 15 na segunda e mais a cada nova ocorrência, até o administrador liberar.'),
  ed(13, 'economia', 'assets/farm-colheita.webp', 'Frango vivo a R$ 5,90 o quilo: granja segue no aperto, mas no azul',
    'Sem cotação oficial do frango vivo nesta semana, a redação refez a conta a partir do atacado: o frango resfriado sai a R$ 8,29 o quilo na Grande São Paulo, segundo o Cepea, e cerca de 72% do peso vira carcaça. Com o abatedouro ficando com a margem dele, o produtor recebe perto de R$ 5,90 pelo quilo vivo. O pintinho de um dia sai a R$ 4 e a ração, puxada pelo milho a R$ 64 a saca, a R$ 1,75 o quilo. O lote de 45 dias continua dando lucro, mas apertado, como na vida real.'),
  ed(14, 'negocio', 'assets/photo-blackjack.webp', 'Sinuca destravada: bola na mão não prende mais a partida e as bolas agora giram na mesa',
    'Os frequentadores do salão reclamavam: depois de uma falta, a branca voltava para a mesa e a partida travava. O problema foi resolvido. Quem está com a bola na mão coloca a branca onde quiser e já pode tacar. De quebra, as bolas ganharam efeito: o número e a faixa giram na direção em que a bola rola.'),
  ed(15, 'alerta', 'assets/photo-chips.webp', 'Mutirão de reparos: inventário volta ao lugar e o Feirão para de inflar os números',
    'A equipe técnica do 21 World fez um mutirão. O inventário, que aparecia desarrumado no computador por causa de um conflito com a tela de investimentos, voltou ao normal. O número ao lado de cada categoria do Feirão agora conta só o que está de fato anunciado, e não mais o que você guarda em casa. Os valores dos cards de resumo pararam de quebrar no meio, e as fichas do pomar, do canavial e do leilão ganharam espaço para o texto respirar.'),
  ed(16, 'alerta', 'assets/farm-pasto.webp', 'Corte da economia real leva 27 fazendas: Danilin e Buu ficam sem terra',
    'O reajuste que reduziu as fortunas pela metade obrigou a venda de 27 propriedades, somando 840 hectares e R$ 52,9 milhões pelo valor de tabela. Danilin, que tinha o patrimônio quase todo em terra, entregou as 17 fazendas, 570 hectares de café. Buu vendeu as 7 que tinha, e Pastor Galego abriu mão de 3 das 40. NocBit, com caixa de sobra, pagou tudo em dinheiro e manteve as 15 propriedades. Quem perdeu a terra continua com a granja, os galpões e as empresas, e pode comprar de novo pelo preço de mercado.'),
  ed(17, 'economia', 'assets/farm-roxa.webp', 'Laudo do mercado: terras são reavaliadas e a valorização sem fim acaba',
    'Uma auditoria nas escrituras encontrou terras registradas muito acima do mercado. As propriedades subiam 0,6% a cada mês do jogo, sem parar, e algumas já valiam mais que o dobro de uma terra igual à venda. Um laudo reavaliou cada fazenda pelo preço da região, pelos hectares, pela água e pelas benfeitorias. As 15 fazendas do maior produtor do mundo, registradas em R$ 110 milhões, valem R$ 45,5 milhões pelo laudo de 2026. Daqui para frente a terra acompanha o mercado: sobe e desce até 2% ao mês em volta do valor de laudo, como na vida real.'),
];
// edição do Jornal 21: o jornal abre com as reportagens que o jogador ainda não viu (guarda a hora da última vista)
export const EDITION = 'jornal-v154';
export const editorial = (now = Date.now()) => EDITORIAL.filter(e => now >= e.at - 864e5 && now - e.at < ED_DAYS * 864e5);
// manchete pronta (texto puro; a tela escapa antes de mostrar)
export function headline(n) {
  if (n.title) return n.title;   // edição especial
  if (n.text) return n.text;   // economia do mundo (econ-ui.js): manchete pronta
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
  r => { const n = pick(r, [40, 80, 150, 300]); return { kind: 'venda', what: `${n} bois gordos no frigorífico`, val: n * pick(r, [5600, 6000, 6400]) }; },
  r => ({ kind: 'compra', what: `um cavalo ${pick(r, ['Puro-Sangue Inglês', 'Quarto de Milha', 'Árabe', 'Mangalarga Marchador'])} no leilão`, val: -pick(r, [180000, 260000, 420000, 750000]) }),
  r => ({ kind: 'premio', what: `uma carta ${pick(r, ['mestre', 'challenger', 'diamante'])} de ${pick(r, CHAMPS).name || 'campeão'} no pacote lendário`, val: pick(r, [400000, 900000, 2500000]) }),
  r => ({ kind: 'premio', what: `um saque de ${pick(r, ['18,4x', '32,7x', '55,0x', '12,9x'])} no aviator`, val: pick(r, [60000, 140000, 320000]) }),
  r => { const [g, p, q] = pick(r, [['soja', 150, 30000], ['milho', 64, 50000], ['café', 1600, 3000]]), s = q * pick(r, [1, 2, 4]); return { kind: 'venda', what: `${s.toLocaleString('pt-BR')} sacas de ${g}`, val: s * p }; },
  r => { const c = pick(r, cars); return { kind: 'venda', what: `o ${c.name} seminovo`, val: Math.round(c.price * 0.8) }; },
];
export function npcNews(slot, nicks) {
  const r = seeded(slot * 2246822519 + 7);
  if (!nicks.length || r() < 0.2) return null;
  const name = turnOf(slot, nicks, NEWS_GAP), n = pick(r, GEN)(r);
  return { id: `nn${slot}`, name, ...n, at: slot * NEWS_GAP + Math.floor(r() * 15000), real: false };
}
// âncora da vez: alterna pelo id (o mesmo âncora para a mesma notícia em qualquer aparelho)
export const anchorOf = n => ANCHORS[[...String(n.id || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % ANCHORS.length];
