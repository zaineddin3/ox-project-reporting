// Service worker: lets the app install like a native app, open quickly, and open with no signal on site.
// The app page is always fetched fresh when online, so updates appear on the next open.
const CACHE = 'ox-reporting-v3';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
// Libraries the app loads from these sites are kept too, so it still starts offline (they never change at a fixed version).
const LIBS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (LIBS.includes(u.hostname)) { // fixed-version libraries: cache first
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })));
    return;
  }
  if (u.origin !== location.origin) return; // database and file requests go straight to Supabase
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }) // error pages (404s) are never kept
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
