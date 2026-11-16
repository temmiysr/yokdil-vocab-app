// YÖKDİL Master – Service Worker (çevrimdışı çalışma)
// - Uygulama sayfası: önce ağ, ağ yoksa önbellek (güncellemeler hemen gelsin, internet yokken de açılsın)
// - CDN kütüphaneleri (React, Babel, Tailwind, PDF.js, Firebase SDK…): önbellekten, yoksa ağdan alıp önbelleğe yaz
// - Firebase/Google API'leri, sözlük ve çeviri servisleri: HİÇ dokunulmaz (giriş ve eşitleme bozulmasın)
const VERSION = 'yokdil-v3';
const APP_CACHE = VERSION + '-app';
const CDN_CACHE = VERSION + '-cdn';
const APP_SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdn.tailwindcss.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Aynı adresteki uygulama dosyaları
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
      event.respondWith(
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
      );
      return;
    }
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // CDN kütüphaneleri (büyük OCR dil/wasm dosyaları hariç)
  if (CDN_HOSTS.includes(url.hostname) && !/\.(wasm|traineddata)(\.gz)?$/.test(url.pathname) && !/firebasejs\/.*\/(firestore|auth)\.js\.map$/.test(url.pathname)) {
    event.respondWith(caches.open(CDN_CACHE).then((cache) => cache.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
      return hit || net;
    })));
  }
  // Diğer her şey (Firebase, Firestore, Google girişi, sözlük/çeviri API'leri): tarayıcıya bırak
});

// Bildirime tıklanınca uygulamayı aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
