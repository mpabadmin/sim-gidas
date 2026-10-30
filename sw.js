const VERSION = 'sim-gidas-v11.0';
const FILES = ['./', './index.html', './app.js', './pulse-cat.js', './pulse-cm.js', './pulse-local.js', './pulse-scen.js', './pulse.js', './pulse-ui.js', './sim.js', './rtc.js', './relay.js', './scen.js', './scen-import.js', './vendor/qrcode.min.js', './vendor/jsqr.min.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png', './favicon-64.png', './img/logo-balt.png', './img/logo-juod.png'];
self.addEventListener('install', e => {
  // cache: 'reload' – apeiti naršyklės HTTP talpyklą, kad nauja versija gautų naujus failus
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const net = (req.mode === 'navigate' ? fetch(req) : fetch(req, { cache: 'no-cache' })).then(res => {
    if (res && res.ok) { const copy = res.clone(); return caches.open(VERSION).then(c => c.put(req, copy)).then(() => res); }
    return res;
  });
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(c => c || net));
  e.waitUntil(net.then(() => {}, () => {}));
});
