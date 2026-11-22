// Base de conhecimento do contador: como cada parte do jogo funciona, com os números de verdade do código.
// Só regras e valores. Nunca diz o que compensa, onde investir ou o que comprar (essa escolha é do jogador).
// Cada assunto tem palavras-chave; a pergunta cai no assunto com mais palavras em comum.
// Os números precisam acompanhar os arquivos do jogo (logic, futebol, granja, suinos, pomar, cana, abate, stable, cards, mina, progress, world).

export const KB = [
  // ---------- mundo e conta ----------
  { t: 'tempo do mundo', k: ['tempo', 'mes', 'meses', 'mundo', 'relogio', 'passa', 'dura', 'virada', 'ano'], a: [
    'O mundo tem um relógio só, igual para todos. Por padrão, 1 mês do mundo dura uns 10 minutos reais (o administrador pode ajustar).',
    'Na virada do mês rodam as contas: ração, energia, salários, arrendamento, IPVA, parcelas do banco, crescimento do gado, lavouras e preços.',
    'Quem fica fora do jogo paga no máximo 6 meses de uma vez quando volta. O resto o mundo perdoa.'] },
  { t: 'celular e computador', k: ['celular', 'computador', 'pc', 'sincroniz', 'aparelho', 'dois', 'sumiu', 'sumindo', 'perdi'], a: [
    'A mesma conta funciona no celular e no computador. O que você faz em um aparece no outro em segundos.',
    'Se os dois aparelhos mexem ao mesmo tempo, o jogo junta o que cada um fez: compra de um lado e venda do outro ficam valendo.',
    'Se algo seu sumiu, fale com o administrador: ele vê o livro-caixa de cada conta e pode devolver.'] },
  { t: 'nível e XP', k: ['nivel', 'xp', 'experiencia', 'subir', 'level'], a: [
    'Para sair do nível N você precisa de 100 × N de XP. Cada nível novo dá 100 × N fichas de prêmio.',
    'Ganha XP jogando mesas, vencendo, comprando terra e carro, plantando, colhendo, vendendo gado e cumprindo missões.'] },
  { t: 'prêmio diário e passe', k: ['diario', 'roleta de premio', 'sequencia', 'passe', 'temporada', 'missao', 'missoes'], a: [
    'Prêmio diário: 200 fichas × dias seguidos (até 7), e o 7º dia vale o dobro. Faltou um dia, a sequência recomeça.',
    'Passe de temporada: 30 níveis de 120 XP cada. Missões do dia dão fichas e XP.'] },
  { t: 'fichas', k: ['ficha', 'fichas', 'caixa', 'trocar fichas', 'resgate'], a: [
    '1 ficha vale R$ 10. Você compra fichas no caixa do salão e pode trocar de volta por dinheiro.',
    'Nas mesas entre jogadores, a casa fica com 5% do pote.'] },
  { t: 'patrimônio', k: ['patrimonio', 'valor total', 'quanto valho', 'netWorth', 'riqueza'], a: [
    'Patrimônio = dinheiro + fichas (R$ 10 cada) + terras próprias + gado + estoque pelo preço de hoje + carros + animais de corrida + cartas + granja + suínos + pomares e canaviais + frigorífico + empresas + mina + o que você emprestou, menos o que deve ao banco.',
    'Pergunte "por que meu patrimônio cai todo mês?" para ver o que puxa o seu para baixo.'] },
  { t: 'mercado e crises', k: ['crise', 'crises', 'mercado', 'saturado', 'saturada', 'saturacao', 'oferta', 'demanda', 'alerta', 'plantao', 'relatorio', 'superproducao', 'greve', 'regiao saturada'], a: [
    'Os preços seguem a economia do mundo: quando muita gente planta o mesmo produto, a oferta sobe e o preço de referência cai; quando poucos produzem, sobe.',
    'Crises só acontecem quando há concentração exagerada num produto (mais ou menos a cada 2 anos do mundo, se houver) ou num evento como greve, geada ou contaminação. Sempre há aviso antes: 🟡 sinais de atenção, 🟠 risco elevado, 🔴 crise.',
    'O relatório do mercado (no sino, nas cotações e na TV 21) mostra a oferta de cada produto, os eventos e recomendações. Terra em região saturada mostra um alerta antes de comprar.'] },
  { t: 'impostos', k: ['ricos', 'rico', 'faixa', 'elite', 'imposto', 'fortuna', 'taxa dos', 'magnata', 'tubarao', 'pedagio'], a: [
    'O imposto é igual para todos: 5% do lucro do mês (o que entrou menos o que saiu no fechamento), para quem tem patrimônio a partir de R$ 300 mil. Mês no prejuízo não paga.',
    'Não existe mais taxa para os mais ricos: compras, contas do mês, terras e juros do banco custam o mesmo para qualquer jogador.'] },
  { t: 'troféus e perfil privado', k: ['trofeu', 'trofeus', 'privado', 'selo', 'esconder'], a: [
    'Troféus de patrimônio a cada R$ 10 mi (de 10 a 100 mi). Ficam para sempre, mesmo se a fortuna cair.',
    'O primeiro troféu (R$ 10 mi) libera o perfil privado: os outros só veem os seus troféus.'] },
  // ---------- dinheiro ----------
  { t: 'empréstimo no banco', k: ['emprestimo', 'banco', 'credito', 'parcela', 'juros', 'divida', 'financiar', 'pegar dinheiro'], a: [
    'O banco cobra 1,8% de juros ao mês, igual para todos (empréstimo com terra e gado de garantia, como na vida real; alguns carros, acessórios e terras grandes baixam um pouco) e divide em 12 parcelas. Quem o banco não atende pega com agiota: paga o juro do banco, mais 1 ponto, mais o risco de calote dele. Se der calote, o cobrador recupera 25%.',
    'O limite é a metade do valor das suas terras próprias + 20% do valor do rebanho, menos o que você já deve.',
    'Parcela sem dinheiro fica atrasada. Duas atrasadas seguidas e o banco toma a sua terra mais cara.'] },
  { t: 'emprestar dinheiro', k: ['emprestar', 'emprestei', 'calote', 'devedor', 'cobrar'], a: [
    'Você pode emprestar para jogadores do mundo: cada pedido mostra juros por mês, prazo (3 a 12 meses) e risco.',
    'Eles pagam uma parcela por mês. Quanto maior o risco, maior a chance de calote, e aí o resto se perde.'] },
  { t: 'Pix', k: ['pix', 'transferir', 'mandar dinheiro', 'enviar dinheiro'], a: [
    'O Pix manda dinheiro na hora para outro jogador. Fica registrado no livro-caixa dos dois.'] },
  { t: 'mercado e preços', k: ['mercado', 'preco', 'precos', 'cotacao', 'vender saca', 'armazem', 'estoque', 'oscila', 'sobe', 'desce'], a: [
    'Os preços mudam todo mês, mas ficam entre 80% e 125% do preço normal e voltam aos poucos (10% por mês) para ele.',
    'Preços normais: soja R$ 130/saca, milho R$ 60, café R$ 1.400, arroba do boi R$ 310, bezerro R$ 2.600, cana R$ 150/t, laranja R$ 38/caixa, frango R$ 6,20/kg, suíno R$ 8,20/kg.',
    'Vender no mercado tem taxa de 1%. O que fica no estoque conta no patrimônio pelo preço do dia.'] },
  { t: 'investimentos', k: ['investimento', 'investimentos', 'trader', 'grafico', 'vela', 'subir ou descer', 'opcao'], a: [
    'Nos investimentos você escolhe um ativo, o tempo (1, 5 ou 10 minutos) e aposta se o preço vai subir ou descer.',
    'Acertou: recebe 1,85× o valor. Errou ou empatou: perde o valor. Não dá para sair antes do tempo.'] },
  // ---------- terras ----------
  { t: 'terras', k: ['terra', 'terras', 'hectare', 'ha', 'fazenda', 'comprar terra', 'regiao', 'mapa', 'satelite'], a: [
    'Cada terra tem região, uso (pasto, lavoura ou café), hectares, água e benfeitorias. Isso mexe no preço e em quantos bois cabem.',
    'Por hectare cabem uns 1,2 boi no pasto, 0,9 na lavoura e 0,6 no café (menos se a terra não tem água).',
    'Terra própria entra no patrimônio pelo valor dela. Vender devolve 95% do valor (pomar e canavial entram no preço).'] },
  { t: 'arrendamento', k: ['arrendar', 'arrendamento', 'aluguel', 'alugar', 'arrendada', 'arrendei'], a: [
    'Arrendar (alugar) terra de outro: você paga 0,4% do valor da terra por mês, com reajuste de 8% a cada 12 meses de contrato.',
    'Lavoura em terra arrendada só com trator, e os insumos custam 20% a mais. Pomar e canavial só em terra própria.',
    'Comprar a terra que você arrenda: metade do aluguel já pago abate o preço (até 40% do valor dela).',
    'Arrendar a SUA terra para outro: você recebe uns 0,35% do valor por mês, mas não pode usar a terra enquanto isso.'] },
  // ---------- gado ----------
  { t: 'gado', k: ['gado', 'boi', 'bois', 'bezerro', 'bezerros', 'rebanho', 'engorda', 'pasto', 'arroba', 'cabeca', 'cabecas'], a: [
    'Você compra bezerros de uns 180 kg no leilão. No seu pasto cada boi ganha 18 kg por mês sem custo de comida.',
    'Sem pasto (ou com o pasto cheio) o excesso vai para o confinamento (hotel de gado): R$ 95 por cabeça por mês e 22 kg por mês.',
    'Com uns 450 kg o boi está gordo. A arroba é de 15 kg de carcaça e a carcaça é uns 52% do peso vivo.',
    'Para vender: abate no frigorífico ou revenda do boi vivo.'] },
  { t: 'frigorífico', k: ['frigorifico', 'abate', 'abater', 'couro', 'terceiros'], a: [
    'Frigorífico de terceiros: paga a arroba +4% e cobra R$ 45 por cabeça.',
    'Frigorífico de outro jogador: paga +8% e cobra a taxa que o dono escolheu (de R$ 20 a R$ 120 por cabeça).',
    'Frigorífico próprio: custa R$ 5 mi, abate até 300 cabeças por mês, paga +10% e o couro (R$ 60 por cabeça), com custo de R$ 25 por cabeça + R$ 15 mil fixos por mês. Desvaloriza 0,4% ao mês.'] },
  // ---------- granja e suínos ----------
  { t: 'granja', k: ['granja', 'frango', 'frangos', 'pintinho', 'pintinhos', 'galpao', 'galpoes', 'aviario', 'lote', 'racao'], a: [
    'Galpões: pequeno (5.000 aves, R$ 150 mil), convencional (15.000, R$ 420 mil) e climatizado (30.000, R$ 1,1 mi). Quanto melhor o galpão, menos ave morre e menos ração gasta por kg.',
    'Cada pintinho custa uns R$ 4,20 + R$ 0,25 de vacina. Ração uns R$ 1,90/kg. O frango vivo vale uns R$ 6,20/kg.',
    'Peso médio por mês de idade: 1,3 kg no 1º mês, 2,8 kg no 2º, 3,5 kg no 3º, 3,8 kg no 4º.',
    'Ração e energia só são cobradas com lote alojado: galpão vazio não paga nada. O galpão perde 0,5% do valor por mês e na revenda vale 90%.',
    'O chapéu de granjeiro paga +8% na venda do frango.'] },
  { t: 'suínos', k: ['suino', 'suinos', 'porco', 'porcos', 'leitao', 'leitoes', 'barracao', 'suinocultura'], a: [
    'Barracões: pequeno (300 cabeças, R$ 480 mil, R$ 9 mil fixos por mês), terminação (1.000, R$ 1,35 mi, R$ 24 mil) e tecnificada (3.000, R$ 3,6 mi, R$ 58 mil).',
    'O leitão chega com 23 kg, custa uns R$ 380 + R$ 12 de vacina. Ração uns R$ 1,55/kg. O suíno vivo vale uns R$ 8,20/kg, com taxa de 2% na venda.',
    'Na revenda o barracão vale 70% do preço.'] },
  // ---------- lavouras ----------
  { t: 'lavoura', k: ['lavoura', 'plantar', 'plantio', 'colheita', 'colher', 'soja', 'milho', 'cafe', 'saca', 'sacas', 'safra'], a: [
    'Soja: R$ 6.300 por ha, 4 meses, uns 60 sacas por ha. Milho: R$ 4.800 por ha, 5 meses, uns 100 sacas. Café: R$ 32.000 por ha, 12 meses, uns 30 sacas. São os custos reais de produção.',
    'Com trator o plantio sai 10% mais barato. A colheita vai para o armazém e você vende quando quiser, pelo preço do dia.'] },
  { t: 'laranja', k: ['laranja', 'pomar', 'pomares', 'caixa', 'caixas', 'greening', 'pulverizador', 'praga'], a: [
    'Pomar só em terra própria: R$ 30 mil por ha para plantar, 6 meses até a primeira colheita e depois uma colheita a cada 4 meses.',
    'Pomar adulto e sadio: uns 330 caixas (40,8 kg) por ha por colheita. Manutenção de R$ 1.800 por ha por mês (defensivo, adubo e mão de obra).',
    'Sem defensivo a praga (greening) cresce e derruba a safra, até perder tudo. Cada pulverizador cobre 150 ha e cada plataforma 200 ha.'] },
  { t: 'cana', k: ['cana', 'canavial', 'usina', 'corte', 'colhedora', 'broca'], a: [
    'Canavial só em terra própria: R$ 11 mil por ha, primeiro corte em 10 meses e depois a cada 10 meses.',
    'O primeiro corte rende uns 85 t por ha e cada corte seguinte uns 12% menos. Depois de 5 cortes o canavial pede reforma.',
    'Tratos de R$ 280 por ha por mês. A cana vai para a usina, e o frete depende da distância do seu estado. Colhedora própria: R$ 1,2 mi.'] },
  // ---------- veículos e acessórios ----------
  { t: 'carros', k: ['carro', 'carros', 'veiculo', 'caminhonete', 'trator', 'caminhao', 'ipva', 'garagem'], a: [
    'Carros e máquinas perdem 1% do valor por mês (uns 12% ao ano, como na tabela Fipe) e pagam 0,6% por mês de IPVA e seguro.',
    'A concessionária recompra por 92% do valor de hoje. Alguns dão vantagens: o trator, por exemplo, deixa o plantio 10% mais barato. A vantagem de cada um aparece na loja.'] },
  { t: 'acessórios', k: ['acessorio', 'acessorios', 'chapeu', 'relogio', 'corrente', 'oculos', 'estoque de acessorio', 'esgotado', 'personagem'], a: [
    'Cada acessório tem 35 unidades para o jogo inteiro. Esgotou, só comprando de outro jogador no Feirão.',
    'Muitos dão vantagens (preço de venda, juros menores, etc.). Vender para a loja paga metade do preço e devolve a unidade ao estoque.'] },
  // ---------- futebol ----------
  { t: 'futebol: clube', k: ['futebol', 'clube', 'time', 'serie', 'comprar clube', 'fundar'], a: [
    'Você assume um clube de verdade: Série A uns R$ 6 mi, Série B uns R$ 900 mil, Série C uns R$ 120 mil (clube melhor custa mais). Fundar um clube novo custa o mesmo da Série C.',
    'Cada divisão tem 20 times em turno e returno (38 rodadas). Os 4 primeiros sobem e os 4 últimos caem.',
    'O clube pode ser vendido inteiro (elenco e estádio entram no preço). Ele não conta no patrimônio do ranking.'] },
  { t: 'futebol: dinheiro do clube', k: ['bilheteria', 'patrocinio', 'patrocinador', 'premio', 'premiacao', 'receita do clube'], a: [
    'Bilheteria por jogo em casa: Série A R$ 190 mil, B R$ 55 mil, C R$ 13 mil. Cada nível de estádio soma +20% e a campanha boa enche mais.',
    'Prêmio por vitória: A R$ 70 mil, B R$ 22 mil, C R$ 4.500.',
    'Patrocínio no começo de cada temporada: A R$ 2,5 mi, B R$ 500 mil, C R$ 90 mil.',
    'Prêmio final do 1º ao 4º: A 8 mi / 4,5 mi / 2,5 mi / 1,5 mi · B 1,8 mi / 1 mi / 600 mil / 400 mil · C 450 mil / 250 mil / 140 mil / 90 mil.'] },
  { t: 'futebol: estádio', k: ['estadio', 'reforma', 'arquibancada'], a: [
    'O estádio vai do nível 1 ao 5. Cada nível aumenta a bilheteria em 20%.',
    'A reforma custa 8 bilheterias da sua divisão × o nível atual, e o valor do estádio entra no valor do clube.'] },
  { t: 'futebol: elenco', k: ['jogador', 'jogadores', 'elenco', 'salario', 'salarios', 'contratar', 'contratacao', 'nota', 'overall', 'idade', 'potencial', 'evolui'], a: [
    'Salário do jogador depende da nota (ovr): mais ou menos 3 × (nota − 30)², no mínimo R$ 400 por mês. A cada rodada sai 1/4 da folha do mês.',
    'Fim de temporada: quem tem até 23 anos sobe de 1 a 4 pontos até o potencial; com 31 anos ou mais perde até 3. O salário acompanha a nota nova.',
    'O valor de mercado sobe com a nota e o potencial, é maior até 23 anos e cai bastante depois dos 31.',
    'O elenco precisa ter pelo menos 14 jogadores (para vender todos, venda o clube).'] },
  { t: 'futebol: partidas', k: ['partida', 'rodada', 'escalacao', 'escalar', 'formacao', 'tatica', 'estilo', 'lesao', 'cartao', 'suspenso', 'moral'], a: [
    'Formações: 4-4-2, 4-3-3, 3-5-2, 5-3-2 e 4-5-1. Estilos: defensivo, equilibrado, ofensivo e contra-ataque (cada um troca ataque por defesa).',
    'O resultado vem da força do seu ataque contra a defesa do adversário, e jogar em casa ajuda. Atacantes e meias marcam mais gols.',
    'A cada rodada um jogador pode se machucar (fica de 1 a 3 rodadas fora). Cartão vermelho suspende. Vitória sobe a moral do time, derrota baixa.'] },
  { t: 'futebol: propostas e mercado', k: ['proposta', 'propostas', 'vender jogador', 'mercado da bola', 'transferencia'], a: [
    'Clubes do mundo fazem propostas pelos seus jogadores (até 94% do valor de mercado). Cada proposta vale por 2 rodadas.',
    'No mercado você negocia a compra. O clube não vende abaixo de 95% do preço pedido.'] },
  // ---------- cassino e jogos ----------
  { t: '21', k: ['21', 'vinte e um', 'blackjack', 'dealer', 'mesa de 21'], a: [
    'Chegue mais perto de 21 que o dealer sem passar. Peça carta, pare, dobre ou divida.',
    'Blackjack (21 com as duas primeiras cartas) paga 3 para 2. Nas mesas entre jogadores a casa fica com 5% do pote.'] },
  { t: 'truco, sinuca e pôquer', k: ['truco', 'sinuca', 'poquer', 'poker', 'blinds', 'all-in'], a: [
    'Truco: você e um parceiro contra uma dupla, partida até 12 pontos. A dupla vencedora leva 1,9× a entrada.',
    'Sinuca (bola 8): encaçape as suas (lisas ou listradas) e termine na 8.',
    'Pôquer (Texas Hold\'em): você senta com 100 big blinds. Ao levantar, as fichas voltam para o caixa.',
    'As três têm mesas online entre jogadores, abertas ou com senha.'] },
  { t: 'roleta e aviator', k: ['roleta', 'aviator', 'aviao', 'multiplicador', 'cassino'], a: [
    'Roleta: 37 números (0 a 36). Você aposta fichas em número, cor ou grupo e o prêmio depende da aposta.',
    'Aviator: o multiplicador sobe até o avião ir embora. Saque antes para levar o valor × o multiplicador. Se não sacar, perde.'] },
  // ---------- animais e coleções ----------
  { t: 'haras e canil', k: ['cavalo', 'cavalos', 'galgo', 'galgos', 'haras', 'canil', 'corrida', 'corridas', 'pareo', 'treino', 'treinar'], a: [
    'Galgo: base de R$ 8 mil, manutenção de R$ 300 por mês e treino de R$ 800. Cavalo: base de R$ 40 mil, manutenção de R$ 2 mil e treino de R$ 5 mil.',
    'Corridas por classe: estreantes (nota até 55), classe B (até 70), classe A (até 85) e grande prêmio.',
    'Prêmio: 4× a taxa de inscrição para o 1º, 1,5× para o 2º e 0,5× para o 3º. Vender devolve 80% do valor. Com a idade eles se aposentam.'] },
  { t: 'leilão de cavalos', k: ['leilao', 'lance', 'raca', 'puro-sangue', 'quarto de milha', 'mangalarga', 'arabe', 'crioulo'], a: [
    'No leilão do haras entram cavalos de raça com estrelas. Cada raça puxa um atributo: Puro-Sangue é o mais veloz, Quarto de Milha tem largada explosiva, Árabe tem resistência, Mangalarga marcha firme e Crioulo é rústico.',
    'Ganha quem der o maior lance até o fim do pregão.'] },
  { t: 'cartas e coleções', k: ['carta', 'cartas', 'pacote', 'pacotes', 'raridade', 'colecao', 'colecoes', 'emblema', 'prestigio', 'sazonal', 'natal', 'junina', 'repetida', 'colecionador'], a: [
    'A loja paga um valor fixo por carta: comum R$ 3 mil, rara R$ 5 mil, lendária R$ 8 mil, exclusiva (sazonal) R$ 10 mil. O valor de verdade é o que os jogadores pagam entre si.',
    'Coleções padrão (Campeões, Prosperidade, Fortuna, Pecuária) saem nos pacotes o ano todo. Sazonais (Natal só em dezembro, Festa Junina de 1/6 a 31/7) só no período delas, em pacote próprio com 1 carta da temporada garantida, e às vezes nos pacotes comuns. Fora da temporada, só comprando de quem tem.',
    'Cada carta conta uma vez na coleção (repetidas não somam) e cada coleção se completa uma vez só. Completar dá emblema no perfil, sobe no ranking de colecionadores e libera a vantagem para sempre:',
    '• Campeões: +5% de XP · Prosperidade: 2 pontos a menos de mortalidade e de perda por praga · Fortuna: +2% no ganho de fichas no cassino · Pecuária: pintinhos, leitões e bezerros 5% mais baratos · Natal: 50 de prestígio · Festa Junina: +10% na roleta do dia e 30 de prestígio.',
    'Pacotes: simples R$ 6 mil (1 carta), ouro R$ 18 mil (3, 1 rara ou melhor), lendário R$ 35 mil (5, 1 lendária), com estoque por mês do mundo. A roleta do dia também dá pacote.'] },
  { t: 'mina de ouro', k: ['mina', 'ouro', 'mineradora', 'garimpo', 'equipe de garimpo'], a: [
    'A mina é única no jogo inteiro: só um jogador pode ser dono. Custa R$ 120 mi e tem manutenção de R$ 1,1 mi por mês.',
    'Cada equipe custa R$ 95 mil por mês (até 10 equipes) e tem chance de achar ouro (uns R$ 540 mil o kg). Na revenda a mina vale 60%.'] },
  { t: 'empresas', k: ['empresa', 'empresas', 'negocio', 'negocios', 'marca', 'banco proprio', 'provedor', 'supermercado', 'hotel'], a: [
    'Na aba negócios você compra marcas (bancos, provedores, supermercados, usinas, hotéis e outras). Cada marca é única: só um dono no mundo.',
    'Cada empresa tem receitas e custos mensais próprios, que aparecem no fechamento. Vender devolve o valor de venda dela.'] },
  { t: 'galpões de armazém', k: ['galpao de armazem', 'armazenagem', 'capacidade', 'toneladas', 'silo'], a: [
    'Os galpões de armazém aumentam quantas toneladas de produção você pode guardar. Na revenda valem 80%.'] },
  // ---------- comércio entre jogadores ----------
  { t: 'loja, Feirão e trocas', k: ['loja', 'feirao', 'feira', 'anunciar', 'anuncio', 'troca', 'trocar', 'negociar', 'vender para jogador'], a: [
    'Loja: você anuncia carros, animais, terras, sacas, cartas, acessórios e empresas pelo preço que quiser, e os jogadores online veem.',
    'Vender direto para a casa é na hora, por um valor menor. A feira dos jogadores do mundo tem itens usados e compradores.',
    'Trocas: os dois montam a oferta, ficam "prontos" e confirmam. Se alguém mexer na oferta, os dois confirmam de novo.'] },
  { t: 'Resenha (chat)', k: ['resenha', 'chat', 'mensagem', 'conversar', 'privado', 'destacar', 'mencionar'], a: [
    'Você lê a Resenha desde o início e escreve a partir do nível 2. Use @Nome para chamar alguém e toque na pessoa para conversar no privado.',
    'Dá para destacar uma mensagem na Geral pagando uma taxa que acompanha a economia.'] },
  // ---------- contador e equipe ----------
  { t: 'contador', k: ['contador', 'honorario', 'honorarios', 'plano', 'contratar contador', 'demitir'], a: [
    'O contador cobra 0,12% do seu patrimônio por mês (mínimo de R$ 2.500). Há o plano mensal e planos fechados com desconto.',
    'Ele separa cada gasto por produção e por tipo, mostra o lucro real de cada atividade e responde perguntas. Só não diz onde investir.'] },
  { t: 'equipe', k: ['equipe', 'funcionario', 'veterinaria', 'gerente', 'advogada', 'seguranca', 'corretor'], a: [
    'A equipe hoje tem o contador. Veterinária, gerente da fazenda, advogada, segurança e corretor de imóveis estão chegando.'] },
];

const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const HOWTO = /^(como|o que|oque|qual a regra|quais|quanto custa|quanto tempo|quanto rende|pra que|para que|explica|me explica|funciona|regra)|como funciona|como (eu )?(faco|consigo|ganho|compro|vendo)|o que e /;
// assunto da pergunta: o que tiver mais palavras-chave em comum (palavra-chave mais longa pesa mais)
export function lookup(q0) {
  const q = ` ${fold(q0).replace(/[^\w\s-]/g, ' ')} `;
  let best = null, score = 0;
  for (const e of KB) {
    let s = 0;
    for (const k of e.k) if (q.includes(` ${fold(k)}`)) s += 1 + fold(k).length / 10;
    if (s > score) { score = s; best = e; }
  }
  return best ? [`${best.t[0].toUpperCase()}${best.t.slice(1)}:`, ...best.a] : null;
}
