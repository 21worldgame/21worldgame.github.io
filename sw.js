// Service worker do 21 World: abre rápido (arquivos do jogo em cache) e atualiza em segundo plano.
// Nunca guarda chamadas do servidor (login, saves) nem do mapa: essas sempre vão para a rede.
const VERSION = '21world-v245';
const CORE = ['./', 'index.html', 'style.css', 'tokens.css', 'base.css', 'game.js', 'pix.js', 'pro.js', 'pro-ui.js', 'cidade.js', 'cidade-ui.js', 'logic.js', 'store.js', 'progress.js', 'casino.js', 'table.js', 'bj.js',
  'avatar.js', 'net.js', 'auth.js', 'authrules.js', 'turnstile.js', 'devguard.js', 'live.js', 'tune.js', 'cfg.js', 'manifest.webmanifest', 'assets/brand/logo-mark.svg', 'assets/brand/logo-anim.svg', 'avisos.js', 'econ.js', 'econ-ui.js', 'invest.js', 'invest-ui.js', 'assets/brand/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const NEVER = /version.json|\/realtime\/|\/storage\/|arcgisonline|tile|nostr|relay|\/rest\/|\/auth\//;
const LIBS = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || NEVER.test(req.url)) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // arquivos do jogo: sempre a versão nova da rede (para nunca misturar arquivos de versões diferentes);
    // a cópia guardada só entra sem internet (rede lenta espera: misturar versões travava o jogo na abertura)
    e.respondWith(caches.open(VERSION).then(async c => {
      try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) c.put(req, r.clone()); return r; } catch { return (await c.match(req)) || Response.error(); }
    }));
  } else if (LIBS.test(req.url)) {
    // bibliotecas com versão fixa e fontes: guarda de vez
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
  }
});
