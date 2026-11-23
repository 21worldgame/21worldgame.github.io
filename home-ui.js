// Portal de notícias: a primeira tela do jogo. Manchetes do que vem aí,
// tendências do campo calculadas com os preços do mundo (os mesmos de todos) e o que está acontecendo agora.
import { G, esc } from './store.js';
import { ANCHOR } from './logic.js';
import * as W from './world.js';
import * as MK from './market.js';
import * as Live from './live.js';
import * as NEWS from './news-ui.js';
import { headline, KINDS, short } from './news.js';
import * as EC from './econ.js';
import * as NG from './negocios.js';
import * as PK from './perks.js';
import { netWorth, TROPHIES } from './logic.js';
import { editorial } from './news.js';
import * as CTR from './contratos.js';
import { brl } from './store.js';
import * as INVU from './invest-ui.js';

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

// quadro de tendências: campo (preço do mês x normal) + bolsa do negociante (última hora, ao vivo)
function trendHTML() {
  const tr = trends(G.S?.prices), up = tr.filter(t => t.pct > 2).slice(0, 4), down = tr.filter(t => t.pct < -2).slice(-4).reverse();
  const chip = t => `<li><span>${esc(t.name)}</span><b class="${t.pct >= 0 ? 'good' : 'bad'}">${t.pct > 0 ? '+' : ''}${t.pct}%</b></li>`;
  const now = Live.now(), bolsa = Object.entries(MK.ASSETS).map(([k, a]) => { const c = Math.round(MK.change(k, now, 60) * 1000) / 10;
    return `<li><span>${esc(a.name)} <small class="muted">${MK.fmt(k, MK.price(k, now))} ${esc(a.unit)}</small></span><b class="${c >= 0 ? 'good' : 'bad'}">${c > 0 ? '+' : ''}${String(c).replace('.', ',')}%</b></li>`; }).join('');
  return `<div class="portal__cols portal__cols--3"><div><h4>em alta no campo</h4><ul>${up.map(chip).join('') || '<li class="muted">nada muito acima do normal</li>'}</ul></div>
    <div><h4>em baixa no campo</h4><ul>${down.map(chip).join('') || '<li class="muted">nada muito abaixo do normal</li>'}</ul></div>
    <div><h4>bolsa do negociante <small class="portal__livedot">ao vivo</small></h4><ul>${bolsa}</ul></div></div>`;
}
// enquanto o portal está aberto: bolsa a cada 5 s e o campo assim que o mês do mundo vira
setInterval(() => { const el = document.getElementById('portal-trend'); if (el && !document.getElementById('p-inicio')?.hidden) el.innerHTML = trendHTML(); }, 5000);

// ---------- painel do jogador (topo da página inicial): carrossel, indicadores, oportunidades e destaques, tudo com dados do mundo ----------
const CROP_IMG = { soja: 'farm-soja', milho: 'farm-colheita', cafe: 'farm-cafe', laranja: 'farm-laranja', cana: 'farm-cana', arroba: 'farm-pasto' };
const plMonth = s => { let net = 0; for (const [m, M] of Object.entries(s.pl || {})) if (Number(m) > (s.month || 0) - 12) for (const R of Object.values(M)) net += (R.in || 0) - (R.out || 0); return net; };
function nextMark(s) {
  const w = netWorth(s), got = s.trophies || [], t = TROPHIES.find(x => !got.includes(x) && x > w) ?? TROPHIES.find(x => !got.includes(x));
  if (!t) return null; const pr = PK.PRESTIGE.find(p => p.min === t), prev = [...TROPHIES].reverse().find(x => x <= w) || 0;
  return { t, label: pr ? `${pr.icon} ${pr.title}` : `troféu de ${short(t)}`, pct: Math.max(0.02, Math.min(1, (w - prev) / Math.max(1, t - prev))) };
}
function slides(s) {
  const m = s.month || 1, st = EC.state(m), [ic, lv] = EC.LEVELS[st.level], ev = st.events.find(e => e.phase !== 'fim'), out = [];
  if (ev) { const hd = EC.headline(ev); out.push({ img: IMG('safra'), tag: `${hd.icon} ${hd.level}`, title: hd.title, lead: hd.lead, act: ['ver relatório do mercado', 'data-econ-open'] }); }
  else { const lo = EC.GOODS.map(g => [g, st.pressure[g]]).sort((a, b) => a[1] - b[1])[0]; out.push({ img: `assets/${CROP_IMG[lo[0]]}.webp`, tag: `${ic} ${lv}`, title: `Mercado estável: ${EC.LABEL[lo[0]]} com pouca oferta`, lead: `Pouca gente produzindo ${EC.LABEL[lo[0]]} neste ciclo. Quem chega antes costuma vender melhor (não é garantia).`, act: ['ver relatório do mercado', 'data-econ-open'] }); }
  if (INVU.launching()) out.unshift({ img: 'assets/biz/caixa.webp', tag: '🏦 novidade no Banco 21', title: 'Agora dá para investir o seu dinheiro', lead: 'Poupança, CDB, LCA Agro, Tesouro 21 e Previdência. Quanto mais tempo o dinheiro fica, mais rende. Os prazos são longos: é para quem pensa no futuro.', act: ['ver investimentos', 'data-tab-go="banco"'] });
  const nx = nextMark(s), w = netWorth(s);
  out.push({ img: 'assets/photo-vegas.webp', tag: 'sua fortuna', title: `Patrimônio de ${brl(w)}`, lead: nx ? `Próximo marco: ${nx.label}. Faltam ${brl(Math.max(0, nx.t - w))}.` : 'Você já tem todos os troféus de patrimônio. Uma lenda.', bar: nx?.pct, act: ['ver meu perfil', 'data-profile="me"'] });
  let deal = null; for (const [c, S] of Object.entries(NG.SECTORS)) for (const b of Object.keys(S.brands)) if (NG.dealOf(c, b, m)) deal = [c, b];
  if (deal) { const C = NG.SECTORS[deal[0]].brands[deal[1]]; out.push({ img: `assets/biz/${deal[1]}.webp`, tag: '🔥 oportunidade de aquisição', title: `${C.name} em dificuldades: ${brl(NG.priceOf(deal[0], deal[1], m))}`, lead: `${Math.round(NG.DEAL.off * 100)}% abaixo do preço até o mês ${NG.dealOf(deal[0], deal[1], m).until}. Reputação baixa para recuperar: investimento de médio prazo.`, act: ['ver empresas à venda', 'data-tab-go="negocios"'] }); }
  const ri = G.regInfo?.() || {}, reg = Object.entries(ri).filter(([, v]) => v.tag === 'pouco explorada' || v.tag === 'em falta').sort((a, b) => a[1].risk - b[1].risk)[0];
  if (reg) out.push({ img: `assets/${CROP_IMG[reg[1].good] || 'farm-pasto'}.webp`, tag: '🧭 nova fronteira', title: `Terras em ${reg[0]}`, lead: `${reg[1].tag === 'pouco explorada' ? 'Região pouco explorada, terra mais barata' : `${EC.LABEL[reg[1].good]} em falta no país`}. Diversificar para longe da concorrência pode valer a pena.`, act: ['ver terras', 'data-tab-go="terras"'] });
  out.push({ img: SOON[0].img, tag: SOON[0].tag, title: SOON[0].title, lead: SOON[0].lead });
  const ct = [...(s.contracts || [])].sort((a, b) => a.due - b.due)[0];   // contrato que vence primeiro: lembrete para voltar e entregar
  if (ct) { const left = ct.due - m, r = CTR.ready(s, ct.good); out.unshift({ img: `assets/${CROP_IMG[ct.good] || 'farm-soja'}.webp`, tag: '📦 contrato de exportação', title: `${ct.qty.toLocaleString('pt-BR')} sacas de ${CTR.GOODS[ct.good].label} para a ${ct.trader}`,
    lead: `${left <= 0 ? 'Vence agora' : `Vence em ${left} ${left === 1 ? 'mês' : 'meses'}`}. Você já tem ${r.toLocaleString('pt-BR')} da sua colheita no armazém. Entregue e receba ${short(ct.qty * ct.price)}; se atrasar, paga ${Math.round(CTR.FINE * 100)}% de multa.`, act: ['ir ao mercado', 'data-tab-go="mercado"'] }); }
  out.unshift(...editorial().slice(-4).reverse().map(e => ({ img: e.img, tag: '📰 TV 21 · edição especial', title: e.title, lead: e.lead })));   // reportagens da semana primeiro
  return out;
}
// ranking ao vivo na página inicial (atualiza sozinho a cada 4 s, sem redesenhar a página toda)
const rankKpi = (rows, pos) => [pos >= 0 ? `${pos + 1}º` : '—', pos >= 0 ? `de ${rows.length} ${rows.length === 1 ? 'jogador' : 'jogadores'}` : 'passe dos R$ 10 mil para entrar'];
const topHTML = top => top.length ? top.map((r, i) => `<li><button type="button" data-profile="${esc(r.pid || '')}"><span>${['🥇', '🥈', '🥉'][i]}</span><b>${esc(r.name)}</b><small>${short(r.worth)}</small></button></li>`).join('') : '<li class="muted small">Ninguém no ranking ainda: o mundo acabou de recomeçar.</li>';
const clubTxt = n => `💎 Clube dos 100 milhões: <b>${n}</b> ${n === 1 ? 'membro' : 'membros'}`;
function liveRank() {
  if (document.getElementById('p-inicio')?.hidden) return;
  const k = document.querySelector('.hk--rank'), ol = document.getElementById('htop-live'); if (!k || !ol) return;
  const rows = G.rankRows?.(500) || [], pos = rows.findIndex(r => r.pid === 'me'), [v, sub] = rankKpi(rows, pos);
  k.querySelector('.hk__v').textContent = v; k.querySelector('small').textContent = sub;
  const html = topHTML(rows.slice(0, 3)); if (ol.innerHTML !== html) ol.innerHTML = html;
  const c = document.getElementById('hclub-live'); if (c) c.innerHTML = clubTxt(rows.filter(r => r.worth >= 100e6).length);
}
setInterval(liveRank, 4000);
function panelHTML(s) {
  const st = EC.state(s.month || 1), [ic, lv] = EC.LEVELS[st.level], w = netWorth(s), net = plMonth(s), nx = nextMark(s), sl = slides(s);
  const rows = G.rankRows?.(500) || [], pos = rows.findIndex(r => r.pid === 'me'), top = rows.slice(0, 3), club = rows.filter(r => r.worth >= 100e6).length;
  const tips = [...EC.tips(s.month || 1)];
  const kpi = (k, v, sub, cls = '', count) => `<div class="hk glass ${cls}"><span class="hk__k">${k}</span><b class="hk__v"${count != null ? ` data-count="${Math.round(count)}"` : ''}>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<section class="hero" aria-roledescription="carrossel" aria-label="destaques">
      ${sl.map((x, i) => `<article class="hero__s${i === 0 ? ' is-on' : ''}" style="--img:url(${x.img})" aria-hidden="${i ? 'true' : 'false'}"><div class="hero__in"><span class="hero__tag">${esc(x.tag)}</span><h2>${esc(x.title)}</h2><p>${esc(x.lead)}</p>
        ${x.bar != null ? `<span class="hero__bar"><i style="width:${Math.round(x.bar * 100)}%"></i></span>` : ''}${x.act ? `<button class="btn btn--gold" type="button" ${x.act[1]}>${esc(x.act[0])}</button>` : ''}</div></article>`).join('')}
      <button class="hero__nav hero__nav--p" type="button" data-hero="-1" aria-label="anterior">‹</button><button class="hero__nav hero__nav--n" type="button" data-hero="1" aria-label="próximo">›</button>
      <div class="hero__dots">${sl.map((_, i) => `<button type="button" class="${i === 0 ? 'is-on' : ''}" data-hero-go="${i}" aria-label="destaque ${i + 1}"></button>`).join('')}</div></section>
    <div class="hkpis">${kpi('patrimônio', brl(w), PK.prestigeTop(s.trophies)?.title || '', '', w)}${kpi('últimos 12 meses', `${net >= 0 ? '+' : ''}${brl(net)}`, 'entradas menos saídas', net >= 0 ? 'is-up' : 'is-down')}
      ${kpi('mercado', `${ic} ${lv}`, st.events.length ? `${st.events.length} evento(s) no radar` : 'sem crise à vista', `is-l${st.level}`)}${kpi('ranking', ...rankKpi(rows, pos), 'hk--rank')}
      ${nx ? `<div class="hk glass"><span class="hk__k">próximo marco</span><b class="hk__v">${esc(nx.label)}</b><span class="hero__bar"><i style="width:${Math.round(nx.pct * 100)}%"></i></span></div>` : ''}</div>
    <div class="hgrid"><section class="glass hbox"><h3>oportunidades e recomendações</h3><ul class="hlist">${tips.map(t => `<li>${esc(t)}</li>`).join('') || '<li class="muted">Mercado equilibrado: nenhum sinal forte agora.</li>'}</ul><button class="btn btn--glass btn--sm" type="button" data-econ-open>relatório do mercado</button></section>
      <section class="glass hbox"><h3>destaques do mundo</h3><ol class="htop" id="htop-live">${topHTML(top)}</ol>
        <p class="small muted" id="hclub-live">${clubTxt(club)}</p><button class="btn btn--glass btn--sm" type="button" data-tab-go="ranking">ver ranking</button></section></div>`;
}
// carrossel: troca a cada 7 s, pausa com o mouse em cima; números contam até o valor
let heroT = 0, heroI = 0;
function heroGo(i) { const ss = [...document.querySelectorAll('.hero__s')], ds = [...document.querySelectorAll('.hero__dots button')]; if (!ss.length) return; heroI = (i + ss.length) % ss.length; ss.forEach((x, k) => { x.classList.toggle('is-on', k === heroI); x.setAttribute('aria-hidden', String(k !== heroI)); }); ds.forEach((x, k) => x.classList.toggle('is-on', k === heroI)); }
function heroStart() { clearInterval(heroT); if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; heroT = setInterval(() => { if (!document.querySelector('.hero:hover') && !document.getElementById('p-inicio')?.hidden) heroGo(heroI + 1); }, 7000); }
document.addEventListener('click', e => { const b = e.target.closest('[data-hero]'); if (b) { heroGo(heroI + Number(b.dataset.hero)); heroStart(); } const d = e.target.closest('[data-hero-go]'); if (d) { heroGo(Number(d.dataset.heroGo)); heroStart(); } });
function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const el of document.querySelectorAll('#p-inicio [data-count]')) { const to = Number(el.dataset.count), t0 = performance.now(), fin = el.textContent;
    const f = t => { const k = Math.min(1, (t - t0) / 900), e = 1 - (1 - k) ** 3; el.textContent = brl(to * e); if (k < 1) requestAnimationFrame(f); else el.textContent = fin; }; requestAnimationFrame(f); }
}
export function render() {
  const el = document.getElementById('p-inicio'); if (!el || !G.S) return;
  const s = G.S, m = s.month || 1, year = W.yearOf(m), tr = trends(s.prices);
  el.innerHTML = `
  <header class="portal__mast"><div><span class="portal__brand">21 World <b>Notícias</b></span><span class="portal__date">${esc(W.monthName(m))}, ano ${year} · edição de hoje</span></div>
    <span class="portal__live"><i></i> ao vivo</span></header>
  ${panelHTML(s)}
  <div class="portal__top">${card(SOON[1], 'pn--hero')}<div class="portal__side">${card(SOON[2])}${card(SOON[3])}</div></div>
  <section class="portal__trend" style="--bg:url(${IMG('safra')})">
    <div class="portal__trend-in"><span class="pn__tag">mercado · ano ${year}</span>
      <h2>O que está em alta no campo este ano</h2>
      <p>Campo: preço do mês comparado ao normal. Bolsa do negociante: variação da última hora, ao vivo. Tudo igual para todos os jogadores.</p>
      <div id="portal-trend">${trendHTML()}</div>
      <div class="row"><button class="btn btn--gold btn--sm" type="button" data-tab-go="mercado">ver o mercado</button> <button class="btn btn--glass btn--sm" type="button" data-tab-go="trader">abrir a bolsa</button></div></div></section>
  <div class="portal__grid">
    <section class="portal__box"><h2>Grandes negócios <small><i class="tv__dot"></i> ao vivo na TV 21</small></h2><ul class="portal__live-list" id="portal-live">${liveHTML()}</ul></section>
    ${card(SOON[0], 'pn--mini')}
  </div>`;
  heroI = 0; heroStart(); countUp();
}
