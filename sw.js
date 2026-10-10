/* Service worker: cache dos arquivos do editor para uso offline. Só caminhos relativos. */
const VERSION = 'sms-3.0.0';
const FILES = ['./', 'index.html', 'estilo.css', 'config.js', 'banco.js', 'nucleo.js', 'animacao.js', 'icones.js', 'midia.js', 'audio.js', 'render.js', 'persistencia.js', 'exportar.js', 'templates.js', 'ui.js', 'comandos.js', 'palco.js', 'linha-tempo.js', 'propriedades.js', 'paineis.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
