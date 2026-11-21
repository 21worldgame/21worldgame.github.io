// Portal de notícias: a primeira tela do jogo. Manchetes do que vem aí,
// tendências do campo calculadas com os preços do mundo (os mesmos de todos) e o que está acontecendo agora.
import { G, esc } from './store.js';
import { ANCHOR } from './logic.js';
import * as W from './world.js';
import * as NEWS from './news-ui.js';
import { headline, KINDS, short } from './news.js';

const IMG = n => `assets/news/news-${n}.webp`;
// o que vem aí (sem data marcada)
const SOON = [
  { tag: 'em breve', img: IMG('leilao'), title: 'Grande Leilão Nelore: pregão ao vivo com o mundo inteiro dando lance',
    lead: 'Depois do leilão de cavalos do haras, chega a vez do gado. Lotes de bezerros e matrizes vão a pregão em tempo real, com todos os jogadores disputando o mesmo lote. Quem tiver caixa leva.' },
  { tag: 'novo mapa', img: IMG('eua'), title: 'EUA ou China: o próximo território a ser explorado',
    lead: 'Terras no Meio-Oeste americano e fazendas no interior da China entram no radar. Outro clima, outra moeda e outros preços.' },
  { tag: 'comércio exterior', img: IMG('export'), title: 'Porto aberto: exportação e importação',
    lead: 'Mande sua safra para fora quando o dólar estiver a favor, ou traga máquinas e genética de outros países.' },
  { tag: 'ásia', img: IMG('china'), title: 'Xangai de olho na soja e na carne do 21 World',
    lead: 'Compradores chineses estudam contratos de longo prazo. A abertura do mercado pode mexer com o preço de tudo no campo.' },
];
const NAMES = { soja: 'soja', milho: 'milho', cafe: 'café', arroba: 'arroba do boi', bezerro: 'bezerro', cana: 'cana', laranja: 'laranja', frango: 'frango', suino: 'suíno', pintinho: 'pintinho', leitao: 'leitão', racao: 'ração de frango', racaoSuino: 'ração de suíno' };

// preço de hoje comparado ao preço normal de cada produto
export function trends(prices = {}) {
  return Object.keys(NAMES).filter(k => ANCHOR[k] && prices[k]).map(k => ({ k, name: NAMES[k], pct: Math.round((prices[k] / ANCHOR[k] - 1) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

const card = (n, cls = '') => `<article class="pn ${cls}"><img src="${n.img}" alt="" loading="${cls.includes('hero') ? 'eager' : 'lazy'}" decoding="async">
  <div class="pn__in"><span class="pn__tag">${esc(n.tag)}</span><h3>${esc(n.title)}</h3><p>${esc(n.lead)}</p></div></article>`;

// grandes negócios do mundo (R$ 1 milhão ou mais), os mesmos que passam na TV 21, na hora em que entram no ar
const ago = at => { const m = Math.max(0, Math.round((Date.now() - at) / 60000)); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`; };
const liveHTML = () => NEWS.big().map(n => `<li class="pl"><span class="pl__k pl__k--${esc(n.kind)}">${esc(KINDS[n.kind] || 'NEGÓCIO')}</span><p>${esc(headline(n))}</p><span class="pl__m"><b>${short(n.val)}</b><small>${ago(n.at)}</small></span></li>`).join('')
  || '<li class="muted">Assim que sair um negócio de R$ 1 milhão ou mais, ele aparece aqui junto com a TV 21.</li>';
G.onTv = () => { const ul = document.getElementById('portal-live'); if (ul && !document.getElementById('p-inicio')?.hidden) ul.innerHTML = liveHTML(); };
setInterval(() => G.onTv(), 60000);   // atualiza o "há X min"

export function render() {
  const el = document.getElementById('p-inicio'); if (!el || !G.S) return;
  const s = G.S, m = s.month || 1, year = W.yearOf(m), tr = trends(s.prices);
  const up = tr.filter(t => t.pct > 2).slice(0, 4), down = tr.filter(t => t.pct < -2).slice(-4).reverse();
  const chip = t => `<li><span>${esc(t.name)}</span><b class="${t.pct >= 0 ? 'good' : 'bad'}">${t.pct > 0 ? '+' : ''}${t.pct}%</b></li>`;
  el.innerHTML = `
  <header class="portal__mast"><div><span class="portal__brand">21 World <b>Notícias</b></span><span class="portal__date">${esc(W.monthName(m))}, ano ${year} · edição de hoje</span></div>
    <span class="portal__live"><i></i> ao vivo</span></header>
  <div class="portal__top">${card(SOON[0], 'pn--hero')}<div class="portal__side">${card(SOON[1])}${card(SOON[2])}</div></div>
  <section class="portal__trend" style="--bg:url(${IMG('safra')})">
    <div class="portal__trend-in"><span class="pn__tag">mercado · ano ${year}</span>
      <h2>O que está em alta no campo este ano</h2>
      <p>Preço de hoje comparado ao preço normal de cada produto. Atualiza todo mês do mundo, igual para todos os jogadores.</p>
      <div class="portal__cols"><div><h4>em alta</h4><ul>${up.map(chip).join('') || '<li class="muted">nada muito acima do normal</li>'}</ul></div>
        <div><h4>em baixa</h4><ul>${down.map(chip).join('') || '<li class="muted">nada muito abaixo do normal</li>'}</ul></div></div>
      <button class="btn btn--gold btn--sm" type="button" data-tab-go="mercado">ver o mercado</button></div></section>
  <div class="portal__grid">
    <section class="portal__box"><h2>Grandes negócios <small><i class="tv__dot"></i> ao vivo na TV 21</small></h2><ul class="portal__live-list" id="portal-live">${liveHTML()}</ul></section>
    ${card(SOON[3], 'pn--mini')}
  </div>`;
}
