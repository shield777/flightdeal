/* 오프라인 지원: 항상 네트워크를 먼저 쓰고, 연결이 없을 때만 저장해 둔 사본을 보여 줘요. */
const CACHE = 'flightdeal-v1';
const SHELL = ['./', 'index.html', 'css/base.css', 'css/flights.css', 'js/flight-core.js', 'js/flights.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const mine = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    (mine ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(e.request)).then(res => {
      if (mine) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
