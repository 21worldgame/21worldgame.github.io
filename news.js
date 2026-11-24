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
export const KINDS = { compra: 'COMPRA', venda: 'VENDA', troca: 'TROCA', premio: 'PRÊMIO', negocio: 'NEGÓCIO', economia: 'ECONOMIA', alerta: 'ALERTA', fortuna: 'FORTUNA', edicao: 'JORNAL 21', cidade: 'CIDADE', pesca: 'PESCA' };

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
  const what = txt.replace(/^(loja 21|loja de luxo|loja|Feirão|leilão):\s*/i, '').replace(/^compra de /, '').replace(/^comprou /, '').replace(/^vendeu /, '').replace(/^venda de /, '').replace(/(^|[^\d.,\w])(\d{4,})(?![\d.,\w])/g, (m, x, n) => (/^(19|20)\d\d$/.test(n) ? m : x + Number(n).toLocaleString('pt-BR')));
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
  ed(18, 'negocio', 'assets/farm-cafe.webp', 'Depois de protestos, Danilin e Buu recebem as fazendas de volta',
    'Os dois produtores que ficaram sem terra no corte da economia real reclamaram alto, e o laudo de mercado deu razão a eles: no corte, as fazendas foram descontadas pela escritura antiga, inflada pela valorização sem fim. As 17 propriedades de Danilin contaram como R$ 45,7 milhões, mas valem R$ 12,3 milhões pelo mercado de 2026. A administração devolveu as 24 fazendas, 765 hectares no total, com os cafezais do jeito que estavam e registradas pelo valor de laudo. Danilin volta a ter 570 hectares de café; Buu, 195.'),
  ed(19, 'negocio', 'assets/farm-soja.webp', 'Tradings chegam ao 21 World: contratos de exportação pagam até 8% acima do preço do dia',
    'Cargil 21, Bungê, Cofco China 21, Luis Dreifus e Amaggy Grãos abriram escritório no mundo. Todo mês elas oferecem comprar a colheita de soja, milho e café com prêmio de 3% a 8% sobre o preço do dia, com o valor travado no aceite. A entrega tem prazo de 3 a 6 meses e quem falhar paga 10% de multa. Como nos portos de verdade, só vale grão da própria lavoura: saca comprada no mercado não embarca. Os contratos ficam na aba mercado.'),
  ed(20, 'alerta', 'assets/farm-colheita.webp', 'Seca e geada entram no radar: seguro agrícola chega às fazendas',
    'O clima passou a pesar. Em cerca de 8% das colheitas, uma seca, ou a geada no caso do café, derruba a produção para 30% a 60% do normal. Para se proteger, o produtor pode contratar o seguro agrícola na hora do plantio: custa 4% a mais e cobre a lavoura até 80% da produção esperada. Não dá lucro garantido, mas segura o caixa no ano ruim.'),
  ed(21, 'economia', 'assets/farm-roxa.webp', 'Soja passa a ocupar a terra por 6 meses: no máximo duas safras por ano',
    'Entre preparo do solo, plantio, colheita e secagem, a soja agora ocupa a terra por 6 meses, e a terra rende no máximo duas safras por ano, como no calendário brasileiro de soja e milho safrinha. Com terra, custo e preço reais, a lavoura rende algo perto de 9% a 13% ao ano sobre o capital, a mesma faixa de uma fazenda de verdade. O café também ficou mais caro de tocar: R$ 34 mil por hectare, cerca de R$ 1.130 por saca produzida.'),
  ed(22, 'compra', 'assets/car-296.webp', 'Concessionária recebe oito modelos novos, da Strada ao Rolls-Royce',
    'Chegaram Fiat Strada (R$ 125 mil), Corolla Cross (R$ 200 mil), Compass 4xe (R$ 280 mil), Ranger Raptor (R$ 480 mil), Range Rover Sport (R$ 1,1 milhão), BMW X5 M (R$ 1,25 milhão), Ferrari 296 GTB (R$ 4 milhões) e Rolls-Royce Cullinan (R$ 6,5 milhões). As vantagens são de prestígio: XP, roleta do dia e provas. Só a Strada ajuda no bolso, com 1% a mais na venda do gado.'),
  ed(23, 'compra', 'assets/maq-colheitadeira.webp', 'Máquinas para a lavoura: colheitadeira, plantadeira, drone e caminhão graneleiro',
    'A loja agrícola ganhou o trator pequeno Massey Ferguson 4707 (R$ 330 mil), drone de pulverização (R$ 180 mil), plantadeira de 16 linhas (R$ 650 mil), caminhão graneleiro (R$ 1,15 milhão), autopropelido (R$ 1,4 milhão) e colheitadeira (R$ 3,6 milhões). Cada máquina barateia o plantio por evitar o serviço de terceiros, até o teto de 15% somando a frota toda. O graneleiro paga 1% a mais pelos grãos com o frete próprio.'),
  ed(24, 'economia', 'assets/farm-frigorifico.webp', 'Granja e suinocultura com custo real: galpão climatizado sobe para R$ 2,8 milhões',
    'Os galpões e barracões passaram a custar o preço de mercado: R$ 450 mil a R$ 2,8 milhões na avicultura e R$ 600 mil a R$ 4,8 milhões na suinocultura. A granja rende de 11% a 18% ao ano sobre o galpão. Nos suínos, o barracão pequeno não se paga com o preço atual e o tecnificado rende perto de 12%, como no setor. Na mina de ouro, com o metal no recorde, a equipe extrai 0,85 kg por mês.'),
  ed(25, 'alerta', 'assets/farm-soja.webp', 'Vida nova: o 21 World recomeça do zero para todo mundo',
    'O mundo foi reiniciado. Dinheiro, fichas, terras, gado, empresas, a mina de ouro e o ranking voltaram ao começo para todos os jogadores, sem exceção. As contas continuam: é só entrar com o mesmo login de sempre e começar de novo, agora com os preços, os custos e os lucros da vida real desde o primeiro dia. O relógio do mundo também voltou ao mês 1.'),
  ed(26, 'alerta', 'assets/photo-chips.webp', 'Carteira zerada: todo mundo com R$ 10 mil, bots também, e selo para os pioneiros',
    'A carteira de todos os jogadores foi zerada e cada um ficou com R$ 10 mil, que também é o valor de quem chega agora. Os jogadores do mundo partem de R$ 10 mil e vão crescendo mês a mês. O ranking mostra só quem já entrou depois do recomeço, e quem continua parado nos R$ 10 mil fica de fora até voltar a jogar. Quem jogou no começo do 21 World ganhou no perfil o selo 🌱 pioneiro, que nenhum jogador novo vai ter.'),
  ed(27, 'economia', 'assets/farm-soja.webp', 'Largada dos jogadores: bots crescem devagar nos dois primeiros dias',
    'Nos primeiros dois dias do mundo novo, os jogadores do mundo crescem seis vezes mais devagar e param de perseguir quem lidera o ranking. É a chance de quem começou agora chegar ao topo. Depois da largada, a concorrência volta ao ritmo normal.'),
  ed(28, 'economia', 'assets/photo-chips.webp', 'Feirão vazio no recomeço: ninguém tem o que vender',
    'Com todo mundo começando com R$ 10 mil, o Feirão 21 amanheceu quase vazio: só umas cartas avulsas. Os jogadores do mundo só anunciam e só fazem propostas pelo que cabe no bolso deles, então os carros, as máquinas, os animais e as terras vão aparecendo conforme eles enriquecem. Quem tiver o que vender agora encontra o mercado sem concorrência.'),
  ed(29, 'alerta', 'assets/farm-soja.webp', 'Zeramento geral: todo mundo recomeça sem nada, com R$ 10 mil',
    'Terras, gado, carros, empresas, cartas, animais, fichas e investimentos foram apagados de todos os jogadores. Cada um recomeça com R$ 10 mil na carteira, o mesmo valor de quem chega agora, e o ranking começa vazio. Ficam só o personagem e o selo 🌱 pioneiro de quem jogou no começo do 21 World.'),
  ed(30, 'economia', 'assets/photo-chips.webp', 'Cartas ficam raras: lendária sai em 1 de cada 100',
    'A fábrica de cartas cortou a produção. Agora só 1 carta em cada 100 sai lendária e 9 saem raras, e o estoque de pacotes só volta no dia seguinte: 3 simples, 1 ouro e 1 lendário por dia. No Feirão, carta avulsa aparece de vez em quando. Quem completar uma coleção vai ter algo que quase ninguém tem.'),
  ed(31, 'alerta', 'assets/photo-chips.webp', 'Giro da sorte: uma roleta por ano, 20% de chance de carta rara',
    'Todo ano do mundo, cerca de duas horas reais, aparece o botão giro da sorte no topo do jogo. A roleta tem dez fatias: duas escondem uma carta rara e as outras oito estouram a roleta, sem nada. A carta é um item raro, não se compra pronta, e quem completar uma coleção inteira ganha emblema no perfil, sobe no ranking de colecionadores e libera vantagens para sempre. A roda do dia também ganhou giro novo, com freada e estalo de roleta de cassino.'),
  ed(32, 'economia', 'assets/mina-ouro.webp', 'Mineradora ganha logística de verdade e ouro a preço real do dia',
    'Quem for dono da Serra Dourada agora precisa comprar a frota na loja 21: perfuratriz, escavadeira, pá-carregadeira e caminhões. A produção segue o elo mais fraco da cadeia, da equipe à usina de 8.000 toneladas por mês. Os custos acompanham a média do setor, perto de US$ 1.500 a 1.785 por onça segundo o World Gold Council, com 1,5% de CFEM sobre o ouro. O preço do ouro vem do mercado: onça em dólar vezes o dólar do dia, atualizado de dez em dez minutos.'),
  ed(33, 'alerta', 'assets/photo-chips.webp', 'Perfil do personagem por categorias e vantagens dos acessórios revisadas',
    'A página do personagem agora tem identidade, aparência, acessórios por lugar do corpo e vantagens separadas por fonte, com teto geral em cada efeito. O perfil público também ficou em abas: resumo, patrimônio, cartas e troféus, garagem e conquistas. Para o jogo ficar mais justo, os acessórios foram revisados: cada um vale de 1% a 8%, e o XP, a roleta do dia, os prêmios de prova e o preço de venda dos produtos passaram a ter teto somando todas as fontes. O capacete de mineiro, que se pagava em menos de dois meses, subiu para R$ 900 mil e rende 1% sobre o ouro.'),
  ed(34, 'alerta', 'assets/farm-soja.webp', 'Inauguração! O 21 World está aberto para todos',
    'O mundo reabriu. Todo jogador começa com R$ 10 mil e nada mais, no mesmo ponto de largada, e os jogadores do mundo também partem do zero e crescem devagar nos primeiros dias. Quem jogou no começo ganhou o selo de pioneiro no perfil. As cartas são raras de verdade, a cada ano do mundo há um giro da sorte, a mineradora exige frota e usina, as mesas ficam livres para jogadores reais e o ranking começa vazio. Boa sorte, e que ganhe o melhor.'),
  { ...ed(35, 'negocio', 'assets/photo-vegas.webp', 'Central de Profissionais abre as portas: quem sabe fazer agora pode ser contratado por toda a cidade',
    'A cidade ganhou um novo ponto de encontro de quem tem talento e de quem precisa dele. Desde hoje, a aba Profissionais, em Negócios, reúne veterinários, agrônomos, mentores de 21, corretores de terra e quanta profissão o jogador quiser inventar. Qualquer morador pode montar o seu perfil, com apresentação, currículo e até oito serviços, cobrados por dia, por semana, por mês ou em pagamento único. Quem contrata paga na hora, mas o dinheiro fica guardado na Central e só chega ao bolso do profissional quando ele entrega: período sem entrega volta para o contratante. Boa reputação rende estrelas, selos e troféus, e os melhores sobem no ranking de profissionais. Já quem não cumpre perde estrela e pode ser suspenso. Reportagem da redação: este é o momento de transformar o que você sabe fazer em renda. Abra o perfil, anuncie seu serviço e entre na disputa.'), at: Date.UTC(2026, 10, 23, 16, 0) },
  { ...ed(36, 'alerta', 'assets/photo-chips.webp', 'Polícia Federal desmonta esquema no cassino e confisca fortuna de dois dos maiores do ranking',
    'Uma operação da Polícia Federal nesta terça-feira desmontou um esquema de lavagem de dinheiro nas mesas de cassino do 21 World. Segundo a investigação, dois jogadores do topo do ranking movimentavam fichas de forma suspeita havia semanas. Todo o patrimônio ligado ao esquema foi confiscado e os dois despencaram para fora do top 10. A PF não divulgou os nomes. Eles continuam no jogo, mas só com o que sobrou no campo: gado, terra e negócios. O recado ficou claro na cidade: boa parte dos grandes jogadores trocou as mesas pelo agro e pelas empresas. Com o topo embaralhado, a disputa pelo 1º lugar está aberta como nunca.'), at: Date.UTC(2026, 10, 24, 16, 40) },
  { ...ed(37, 'economia', 'assets/photo-chips.webp', 'Banco Central desvaloriza a ficha: 1 ficha passa a valer R$ 2',
    'Depois da operação da Polícia Federal, o Banco Central mudou o câmbio do cassino. A ficha, que valia R$ 10, passa a valer R$ 2, tanto na compra quanto na troca de volta no caixa. As fichas guardadas e as que vêm de prêmios, do passe e da subida de nível seguem as mesmas, mas valem menos no patrimônio. O objetivo é acabar com fortunas feitas de fichas e devolver o peso ao trabalho no campo e nas empresas.'), at: Date.UTC(2026, 10, 24, 16, 45) },
  { ...ed(38, 'alerta', 'assets/photo-vegas.webp', 'Banco Central sobe os juros de surpresa e crédito fica mais caro em todos os bancos',
    'O Banco Central anunciou às 17h desta terça-feira uma alta de juros fora do calendário, e o efeito chegou na hora a todos os bancos do 21 World. O empréstimo com garantia, que custava 1,8% ao mês, passa a custar 3,2% ao mês. A mudança vale também para quem já tem contrato: como os empréstimos do banco são pós-fixados, a próxima parcela já vem com a taxa nova. Os bancos também ficaram mais exigentes com a garantia. A terra, que respaldava metade do valor, agora cobre só 30%, e o gado cai de 20% para 10%. Na prática, o limite de crédito encolheu para todo mundo. Segundo a autoridade monetária, a medida quer frear o endividamento depois da operação da Polícia Federal no cassino e do corte no valor da ficha. Especialistas ouvidos pela redação recomendam quitar o que for possível, evitar crédito novo e manter caixa para as parcelas: duas atrasadas e o banco toma a terra mais cara. Quem tem dinheiro parado pode olhar os investimentos, que não mudaram.'), at: Date.UTC(2026, 10, 24, 20, 0) },
  { ...ed(39, 'alerta', 'assets/photo-vegas.webp', 'Quebra do fundo 21 Capital derruba grandes fortunas: investidores perdem 20% em poucas horas',
    'O fundo 21 Capital, que prometia rendimento acima do mercado com papéis de agronegócio e imóveis, travou os resgates nesta terça-feira depois que a carteira desabou. Sem conseguir vender os ativos, a gestora reconheceu a perda e o valor das cotas caiu cerca de 20% em poucas horas. Boa parte dos grandes do ranking tinha dinheiro aplicado no fundo e deve ver o patrimônio encolher aos poucos nos próximos dias, à medida que as cotas são reprecificadas. Entre os mais expostos, segundo o mercado, está a maior produtora de soja do ranking, que tinha a maior parte da fortuna no fundo. Ninguém perdeu tudo, mas vários nomes do top 20 devem trocar de posição. Quem manteve o dinheiro na produção, em terras, gado, lavoura e empresas próprias, não foi afetado. Analistas da TV 21 esperam alguma recuperação dos maiores investidores nos próximos dois dias, mas avisam que o prejuízo de quem ficou no fundo não volta. A dica dos especialistas é a de sempre: não colocar todos os ovos na mesma cesta.'), at: Date.UTC(2026, 10, 24, 18, 40) },
  { ...ed(40, 'cidade', 'assets/photo-horses.webp', 'Pesqueiro abre as portas: lagoa, pesque-pague e represa com briga de verdade e encomenda dos restaurantes',
    'A cidade ganhou nesta terça-feira um pesqueiro completo, na aba jogos. São três águas: a lagoa da fazenda, de graça e boa para treinar a mão; o pesque-pague, com tanques de pacu, tambacu e carpa; e a represa, casa do tucunaré, do dourado, do pintado e até do pirarucu. A pescaria é ao vivo: o pescador arremessa no cardume, espera a boia afundar de vez, fisga na hora certa e briga com o peixe. Cada espécie luta de um jeito. O tucunaré salta, o pintado afunda, a traíra sacode a cabeça e o pirarucu cansa o braço por minutos. Quem não regula a fricção do molinete perde a linha inteira ou arrebenta tudo. Seu Tião, barqueiro da represa há trinta anos, resume: "Pescador apressado volta de mão vazia." O peixe vai para a caixa térmica e se vende na peixaria, com preço que muda todo mês, ou vai para as encomendas de restaurantes como o Beira-Rio e o Bar do Pescador, que pagam bem acima da peixaria por peixe fresco. Quem tirar peixe grande aparece aqui na TV 21. O tempo e a hora contam: amanhecer e fim de tarde são as melhores horas. Boa pescaria.'), at: Date.UTC(2026, 10, 24, 20, 30) },
  { ...ed(41, 'alerta', 'assets/photo-vegas.webp', 'Polícia Federal prende TURBAO por dinheiro falso: fortuna de R$ 10 quatrilhões era fraude e o fazendeiro sumiu do mapa',
    'Terminou na noite desta terça-feira a carreira relâmpago do fazendeiro TURBAO. Às 19h28 o saldo dele saltou de uma dívida de R$ 16 milhões para exatos R$ 999.999.999, sem uma venda, uma colheita ou um único lançamento no livro-caixa. Treze minutos depois o número passou a R$ 10 quatrilhões, mais dinheiro do que todo o 21 World junto. A Polícia Federal cruzou o livro-caixa com a Receita e não encontrou de onde o dinheiro veio: era dinheiro impresso em casa. Na operação, os agentes desfizeram todas as compras feitas com a fortuna falsa (galpões de frango, granjas de suínos, colhedora de cana e até um galgo), devolveram a conta ao estado de antes da fraude e levaram o fazendeiro. Ele não foi mais visto, e o nome saiu do ranking. A partir de hoje o Banco Central do 21 World confere cada centavo que entra nas contas: dinheiro, terra, gado ou empresa que aparecer sem explicação é recusado na hora, e a conta volta para a última versão limpa. Os outros jogadores não foram afetados; as fortunas do topo vieram de café, soja e boi, tudo registrado. "Quem joga limpo não tem nada a temer", disse o delegado do caso.'), at: Date.UTC(2026, 10, 24, 23, 10) },
];
// edição do Jornal 21: o jornal abre com as reportagens que o jogador ainda não viu (guarda a hora da última vista)
export const EDITION = 'jornal-v190';
export const editorial = (now = Date.now()) => EDITORIAL.filter(e => now >= e.at && now - e.at < ED_DAYS * 864e5);
// manchete pronta (texto puro; a tela escapa antes de mostrar)
export function headline(n) {
  if (n.title) return n.title;   // edição especial
  if (n.text) return n.text;   // economia do mundo (econ-ui.js): manchete pronta
  const v = n.val ? ` por ${short(n.val)}` : '';
  if (n.kind === 'pesca') return `${n.name} ${n.what}.`;   // peixe grande: só o peso, sem valor
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
  r => { const ha = pick(r, [100, 200, 400, 800]); return { kind: 'negocio', what: `o arrendamento de ${ha} ha por uma safra`, val: ha * pick(r, [900, 1200, 1500]) }; },
  r => { const [g, p, q] = pick(r, [['soja', 150, 30000], ['milho', 64, 50000], ['café', 1600, 3000]]), s = q * pick(r, [1, 2, 4]); return { kind: 'venda', what: `${s.toLocaleString('pt-BR')} sacas de ${g}`, val: s * p }; },
  r => { const c = pick(r, cars); return { kind: 'venda', what: `o ${c.name} seminovo`, val: Math.round(c.price * 0.8) }; },
];
// ---------- pesca: peixe grande vira notícia ----------
// jogador: só troféu ou peixe de 15 kg para cima (a tela segura 1 notícia a cada 20 min por jogador)
export const FISH_BIG = 15;
export const fishBig = f => !!f && (f.trophy || f.kg >= FISH_BIG);
const KG = k => `${String(Math.round(k * 10) / 10).replace('.', ',')} kg`;
export function fishNews(name, f, sp, where) {
  if (!fishBig(f)) return null;
  return { kind: 'pesca', name: tidy(name).slice(0, 18) || 'um pescador', what: tidy(`tirou ${sp} de ${KG(f.kg)} ${where}${f.trophy ? ', peixe troféu' : ''}`).slice(0, 90), val: 0 };
}
// jogadores do mundo que pescam: poucos (1 em cada ~9 nicks), revezando, e raro (≈1 notícia a cada meia hora); sem valor em dinheiro
const anglers = nicks => nicks.filter(n => [...n].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 7) % 9 === 0);
const BIG_CATCH = [['um dourado', 9, 20, 'na represa'], ['um pintado', 14, 30, 'na represa'], ['um tucunaré', 5, 7, 'na represa'], ['um tambacu', 10, 14, 'no pesque-pague'], ['uma carpa', 12, 16, 'no pesque-pague'], ['um pirarucu', 45, 140, 'na represa']];
export const FISH_NEWS_P = 0.02;
function npcFish(slot, r, nicks) {
  const a = anglers(nicks); if (!a.length) return null;
  const [sp, lo, hi, where] = pick(r, BIG_CATCH), kg = lo + (hi - lo) * r() * r();
  return { id: `nf${slot}`, kind: 'pesca', name: a[slot % a.length], what: `tirou ${sp} de ${KG(kg)} ${where}`, val: 0, at: slot * NEWS_GAP + Math.floor(r() * 15000), real: false };
}
export function npcNews(slot, nicks) {
  const r = seeded(slot * 2246822519 + 7);
  if (!nicks.length || r() < 0.2) return null;
  if (r() < FISH_NEWS_P) return npcFish(slot, r, nicks);
  const name = turnOf(slot, nicks, NEWS_GAP), n = pick(r, GEN)(r);
  return { id: `nn${slot}`, name, ...n, at: slot * NEWS_GAP + Math.floor(r() * 15000), real: false };
}
// âncora da vez: alterna pelo id (o mesmo âncora para a mesma notícia em qualquer aparelho)
export const anchorOf = n => ANCHORS[[...String(n.id || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % ANCHORS.length];
