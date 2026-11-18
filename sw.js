// Service worker do 21 World: abre rápido (arquivos do jogo em cache) e atualiza em segundo plano.
// Nunca guarda chamadas do Supabase (login, saves) nem do mapa: essas sempre vão para a rede.
const VERSION = '21world-v11';
const CORE = ['./', 'index.html', 'style.css', 'tokens.css', 'base.css', 'game.js', 'logic.js', 'store.js', 'progress.js', 'casino.js', 'table.js', 'bj.js',
  'avatar.js', 'net.js', 'auth.js', 'authrules.js', 'live.js', 'supabase-config.js', 'manifest.webmanifest', 'assets/brand/logo-mark.svg', 'assets/brand/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const NEVER = /supabase\.co|arcgisonline|tile|nostr|relay|\/rest\/|\/auth\//;
const LIBS = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || NEVER.test(req.url)) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // arquivos do jogo: sempre a versão nova da rede (para nunca misturar arquivos de versões diferentes);
    // a cópia guardada só entra sem internet ou se a rede demorar mais de 4 s
    e.respondWith(caches.open(VERSION).then(async c => {
      const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
      const slow = new Promise(res => setTimeout(res, 4000)).then(() => c.match(req));
      try { return (await Promise.race([net, slow])) || (await net); } catch { return (await c.match(req)) || Response.error(); }
    }));
  } else if (LIBS.test(req.url)) {
    // bibliotecas com versão fixa e fontes: guarda de vez
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
  }
});
