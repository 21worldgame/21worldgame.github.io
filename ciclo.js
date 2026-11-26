// Ciclo do mercado (dia e noite): a cada 12 h reais o servidor (supabase/ciclo-mercado.sql, market_now) olha o que os
// jogadores fizeram e mexe no preço de cada setor. Setor lotado cai (até -45%), setor esquecido sobe devagar (até +15%).
// Aqui: o multiplicador de cada setor (1 = normal) e as notícias do período. Regras puras, sem rede (live.js busca e chama set).
export const SECTORS = ['gado', 'cafe', 'soja', 'milho', 'laranja', 'cana', 'granja', 'suinos', 'canil', 'pesca', 'futebol', 'cartas', 'empresas'];
const M = {};   // setor -> multiplicador do período
let cur = null;
export const mult = k => M[k] ?? 1;
export const data = () => cur;
// produto do preço (s.prices) -> setor
// só o que o produtor VENDE (bezerro, leitão e pintinho não: o setor lotado ganha menos na venda, não paga menos na compra)
const GOOD = { arroba: 'gado', cafe: 'cafe', soja: 'soja', milho: 'milho', laranja: 'laranja', cana: 'cana', frango: 'granja', suino: 'suinos' };
export const good = k => (GOOD[k] ? mult(GOOD[k]) : 1);
export function set(d) {
  if (!d?.mult) return;
  cur = d; for (const k of SECTORS) M[k] = Math.max(0.55, Math.min(1.15, Number(d.mult[k]) || 1));
}
// período atual (o mesmo do servidor): 12 h começando 09:00 e 21:00 UTC (06h e 18h em Brasília)
export const periodOf = t => Math.floor((t / 1000 - 32400) / 43200);

// ---------- notícias do período ----------
const NAME = { gado: 'boi gordo', cafe: 'café', soja: 'soja', milho: 'milho', laranja: 'laranja', cana: 'cana-de-açúcar', granja: 'frango', suinos: 'carne suína', canil: 'galgos e cavalos de corrida', pesca: 'pescado', futebol: 'futebol', cartas: 'cartas colecionáveis', empresas: 'empresas' };
const IMG = { gado: 'farm-bezerro', cafe: 'farm-cafe', soja: 'farm-soja', milho: 'farm-colheita', laranja: 'farm-laranja', cana: 'farm-cana', granja: 'granja-frangos', suinos: 'barn-tecnificado', canil: 'photo-horses', pesca: 'tex-sand', futebol: 'photo-stadium', cartas: 'photo-chips', empresas: 'biz-markets' };
// onde o efeito aparece no jogo (para a notícia dizer a consequência de verdade)
const WHERE = { gado: 'na arroba do boi gordo', cafe: 'no preço da saca de café', soja: 'no preço da saca de soja', milho: 'no preço do milho', laranja: 'na caixa de laranja', cana: 'na tonelada de cana', granja: 'no quilo do frango', suinos: 'no quilo do suíno', canil: 'nos prêmios das provas e no valor dos animais', pesca: 'no preço do quilo na peixaria', futebol: 'na cota de TV dos clubes', cartas: 'no valor das cartas', empresas: 'no movimento das empresas' };
const pick = (arr, n) => arr[Math.abs(n) % arr.length];
const DOWN = {
  excesso: [
    (s, n) => [`Excesso de ${n} derruba o mercado`, `Com muitos produtores entrando ao mesmo tempo, a oferta de ${n} passou muito do que os compradores conseguem absorver. Os pedidos encolheram e o preço despencou. Analistas da TV 21 recomendam não aumentar a produção agora e procurar setores com pouca concorrência.`],
    (s, n) => [`Mercado de ${n} saturado: compradores cancelam pedidos`, `Armazéns cheios e compradores recuando: o mercado de ${n} está saturado. As exportações foram reduzidas e quem precisa vender aceita preços bem mais baixos. A margem de lucro de quem insiste no setor caiu forte.`],
    (s, n) => [`Superoferta de ${n}: preço cai e margem some`, `O número de produtores de ${n} cresceu rápido demais. Com o excesso de mercadoria, a comercialização ficou difícil e o preço caiu. Especialistas avisam: enquanto o setor seguir lotado, a tendência é continuar caindo.`],
  ],
  saturando: [
    (s, n) => [`Procura por ${n} esfria`, `A demanda por ${n} começou a desacelerar depois de semanas de forte entrada de produtores. Os compradores estão mais seletivos e o preço recua aos poucos. Quem depende só desse setor deve ficar atento.`],
    (s, n) => [`Sinais de saturação no mercado de ${n}`, `Corretores relatam dificuldade crescente para negociar ${n}. A oferta subiu mais rápido que a procura e as margens estão diminuindo. A recomendação é diversificar antes que o preço caia mais.`],
  ],
};
const UP = [
  (s, n) => [`Demanda por ${n} aquece`, `O mercado de ${n} registra aquecimento na procura. Com poucos produtores no setor, os compradores pagam mais, e especialistas apontam um bom momento para investir, sem exageros: a alta é moderada e pode não durar.`],
  (s, n) => [`${n[0].toUpperCase() + n.slice(1)} volta ao radar dos investidores`, `Depois de um período esquecido, o setor de ${n} começa a apresentar maior rentabilidade. A falta de oferta puxa os preços para cima, e quem entrar cedo tende a aproveitar a melhora.`],
  (s, n) => [`Pouca oferta de ${n} anima o mercado`, `Faltam produtores de ${n}, e os compradores disputam o que existe. O resultado é uma valorização gradual. Analistas lembram que, se muita gente migrar para o setor de uma vez, a vantagem acaba.`],
];
const RECOVER = (s, n) => [`Mercado de ${n} se recupera aos poucos`, `Depois da queda, os produtores de ${n} reduziram a oferta e o mercado volta a respirar. O preço sobe devagar, ainda abaixo do normal.`];
const EVENT = {
  futebol: ['Rodada decisiva no Brasileirão aumenta audiência e cota de TV', 'A reta decisiva do campeonato levou a audiência às alturas. As emissoras aumentaram a cota de TV paga por jogo, e os donos de clube recebem mais neste período.'],
  cartas: ['Feira de colecionadores valoriza as cartas raras', 'Uma grande feira de colecionadores movimentou o mercado de cartas. Os compradores estão pagando mais pelas raras, e quem guardou a coleção vê o valor subir.'],
  canil: ['Grande prêmio atrai público e aumenta as bolsas das provas', 'O circuito de corridas ganhou patrocínio novo. As bolsas das provas subiram, e galgos e cavalos de corrida estão mais valorizados.'],
  pesca: ['Restaurantes da cidade disputam peixe fresco', 'A temporada de festivais gastronômicos aumentou a procura por peixe fresco. A peixaria está pagando mais pelo quilo.'],
  empresas: ['Consumo em alta movimenta as empresas da cidade', 'Com o comércio aquecido, as empresas registram mais clientes. O movimento extra aparece no faturamento.'],
  granja: ['Exportação de frango ganha novo comprador', 'Um comprador do exterior abriu as portas para o frango do 21 World. As granjas começam a apresentar maior rentabilidade.'],
  suinos: ['Carne suína ganha espaço no exterior', 'Novos contratos de exportação aumentaram a procura por carne suína. O preço do quilo sobe nos frigoríficos.'],
};
const pct = v => `${v >= 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
// até 4 manchetes por período: as quedas mais fortes, as altas e o acontecimento especial
export function news(d = cur) {
  if (!d?.mult) return [];
  const at = Date.parse(d.start) || Date.now(), out = [], tag = `${d.period}`;
  const st = d.state || {}, mu = d.mult, when = new Date(at - 3 * 36e5).getUTCHours() < 12 ? 'Boletim do agro, manhã' : 'Boletim do agro, noite';   // virada das 06h ou das 18h (Brasília)
  const item = (k, [title, lead], kind, i) => out.push({ id: `ciclo-${tag}-${k}`, kind, img: `assets/${IMG[k]}.webp`, title, lead: `${when}. ${lead} Efeito no jogo: ${pct(mu[k])} ${WHERE[k]} em relação ao normal.`, at: at + i * 60000, ed: true, real: false, ciclo: true });
  const downs = SECTORS.filter(k => st[k] === 'excesso' || st[k] === 'saturando').sort((a, b) => mu[a] - mu[b]).slice(0, 2);
  const ups = SECTORS.filter(k => st[k] === 'oportunidade').sort((a, b) => mu[b] - mu[a]).slice(0, 2);
  downs.forEach((k, i) => item(k, pick(DOWN[st[k]], d.period + i)(k, NAME[k]), 'alerta', i));
  ups.forEach((k, i) => item(k, pick(UP, d.period + i * 2)(k, NAME[k]), 'economia', 2 + i));
  if (d.event?.sector && EVENT[d.event.sector] && !ups.includes(d.event.sector)) item(d.event.sector, EVENT[d.event.sector], 'economia', 4);
  if (!downs.length) { const k = SECTORS.find(x => st[x] === 'recuperando'); if (k) item(k, RECOVER(k, NAME[k]), 'economia', 5); }
  return out;
}
