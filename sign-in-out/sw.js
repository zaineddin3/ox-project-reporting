// Sign In and Out — offline support
// App files: network first (so updates arrive), falling back to the saved copy when offline or slow.
// Face-recognition and sync libraries: saved once and reused (their versioned web addresses never change).
const CACHE = 'signinout-v6';
const LIB_CACHE = 'signinout-libs-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const FA = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/';
const LIBS = [
  FA + 'dist/face-api.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  ...['tiny_face_detector_model', 'face_landmark_68_model', 'face_recognition_model']
    .flatMap(m => [FA + 'model/' + m + '-weights_manifest.json', FA + 'model/' + m + '.bin']),
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE); await c.addAll(SHELL);
    const l = await caches.open(LIB_CACHE); // best effort: a failed download must not stop the app installing
    await Promise.allSettled(LIBS.map(async u => { if (!(await l.match(u))) await l.add(u); }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== LIB_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // e.g. the HEAD request used to read the server's clock always goes to the network
  const url = new URL(req.url);
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(LIB_CACHE).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
  } else if (url.origin === location.origin) {
    e.respondWith(withTimeout(fetch(req), 5000)
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  }
});
