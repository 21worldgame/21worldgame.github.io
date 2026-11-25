// Barreira contra o modo desenvolvedor (F12 / console / Sources). É só uma barreira: quem segura de verdade é o servidor
// (teto-dinheiro.sql, compras-servidor.sql), que recusa dinheiro e bens sem explicação. Aqui só se tira o trapaceiro casual:
// 1) atalhos do DevTools e menu do botão direito desligados;
// 2) detectores, a cada segundo:
//    - "debugger" novo a cada vez (DevTools aberto pausa nele, e a pausa é medida; "nunca pausar aqui" não pega o próximo);
//    - um erro-isca mandado ao console: o console só lê o .stack dele quando está aberto;
//    - variável global nova apontando para o estado do jogo (o "window.hack = G" do teste);
// 3) detectou: tela travada, flag G.devtools que não se desfaz (auth.js para de gravar na nuvem), registro no diário (kind 'devtools').
// Não age para o administrador nem no computador local (desenvolvimento).
import { G } from './store.js';
import * as Live from './live.js';
import * as Auth from './auth.js';

const LOCAL = typeof location === 'undefined' || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) || location.protocol === 'file:';
const off = () => LOCAL || Live.admin();

function caught(why) {
  if (G.devtools || off()) return;
  try { Object.defineProperty(G, 'devtools', { value: why, writable: false, configurable: false, enumerable: false }); } catch { G.devtools = why; }
  try {
    const sb = Auth.sbClient();
    if (sb && Auth.account()) sb.from('diario').insert({ user_id: Auth.account().id, kind: 'devtools', txt: `abriu o modo desenvolvedor (${why})`, money: Math.round(G.S?.money || 0), chips: Math.round(G.S?.chips || 0), tab: location.hash.slice(1) || null, at: new Date().toISOString() }).then(() => {}, () => {});
  } catch {}
  const show = () => {
    if (document.getElementById('devguard')) return;
    const d = document.createElement('div');
    d.id = 'devguard'; d.setAttribute('role', 'alertdialog');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(8,6,14,.96);color:#fff;font:600 17px/1.5 system-ui,sans-serif;text-align:center;padding:24px';
    d.innerHTML = '<div style="max-width:440px"><div style="font-size:42px">🚔</div><p style="font-size:20px;margin:8px 0">Modo desenvolvedor detectado</p><p style="opacity:.8;font-weight:400">O 21 World não funciona com as ferramentas do desenvolvedor abertas. O jogo parou de salvar e o acesso foi registrado. Feche as ferramentas e recarregue a página.</p><button type="button" style="margin-top:14px;padding:10px 22px;border:0;border-radius:10px;background:#f5c542;color:#1a1300;font:700 16px system-ui">recarregar</button></div>';
    d.querySelector('button').onclick = () => location.reload();
    document.body.append(d);
  };
  show();
  setInterval(show, 500);   // apagou o aviso pelo Elements: volta
}

if (typeof document !== 'undefined' && !LOCAL) {
  document.addEventListener('keydown', e => {
    if (off()) return;
    const k = e.key?.toUpperCase();
    if (k === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C', 'K'].includes(k)) || ((e.ctrlKey || e.metaKey) && k === 'U') || (e.metaKey && e.altKey && ['I', 'J', 'C', 'U'].includes(k))) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('contextmenu', e => { if (!off() && !e.target.closest?.('input, textarea')) e.preventDefault(); }, true);

  const base = new Set(Object.getOwnPropertyNames(window));   // globais do próprio site e do navegador
  const bait = new Error('21world');
  Object.defineProperty(bait, 'stack', { get() { caught('console aberto'); return ''; } });

  // começa depois de 8 s: dá tempo de o jogo saber se a conta é de administrador
  setTimeout(() => setInterval(() => {
    if (off() || G.devtools) return;
    const t = performance.now(); Function('debugger')();   // ponytail: "desativar pontos de parada" passa; os outros detectores e o servidor cobrem
    if (performance.now() - t > 150) return caught('pausa no depurador');
    console.log(bait);   // ponytail: depende do jeito que cada navegador mostra erros no console
    for (const k of Object.getOwnPropertyNames(window)) {
      if (base.has(k)) continue;
      let v; try { v = window[k]; } catch { continue; }
      if (v && typeof v === 'object' && (v === G || v === G.S || v === G.S?.biz)) return caught(`window.${k} = estado do jogo`);
    }
  }, 1000), 8000);
}
