// YÖKDİL Master – Service Worker (çevrimdışı çalışma)
// - Uygulama sayfası: önce ağ, ağ yoksa önbellek (güncellemeler hemen gelsin, internet yokken de açılsın)
// - CDN kütüphaneleri (React, Babel, Tailwind, PDF.js, Firebase SDK…): önbellekten, yoksa ağdan alıp önbelleğe yaz
// - OCR dosyaları (Tesseract worker, wasm çekirdeği, İngilizce dil verisi) ve PDF.js worker'ı: ilk kullanımda ayrı
//   önbelleğe alınır; sonra internet yokken de resim/PDF okunabilir. Sürüm değişse de bu büyük dosyalar korunur.
// - Firebase/Google API'leri, sözlük ve çeviri servisleri, Claude API: HİÇ dokunulmaz (giriş ve eşitleme bozulmasın)
const VERSION = 'yokdil-v5';
const APP_CACHE = VERSION + '-app';
const CDN_CACHE = VERSION + '-cdn';
const OCR_CACHE = 'yokdil-ocr-v1';     // büyük dosyalar: sürüm yükseltmelerinde silinmez
const APP_SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdn.tailwindcss.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'];
const isOcrAsset = (url) => /\.(wasm|traineddata)(\.gz)?$/.test(url.pathname) || /tesseract|pdf\.worker/.test(url.pathname) || url.hostname === 'tessdata.projectnaptha.com';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== OCR_CACHE).map((k) => caches.delete(k))))
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
    // Veri dosyaları (hazır soru bankası): önce ağ (güncellemeler gelsin), çevrimdışıysa önbellek
    if (url.pathname.includes('/data/')) {
      event.respondWith(fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then((c) => c.put(req.url.split('?')[0], copy)); }
        return res;
      }).catch(() => caches.match(req.url.split('?')[0])));
      return;
    }
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // CDN kütüphaneleri ve OCR dosyaları: önbellekte varsa oradan (sürümlü adresler değişmez), yoksa ağdan alıp kaydet
  if (CDN_HOSTS.includes(url.hostname) && !/\.map$/.test(url.pathname)) {
    const cacheName = isOcrAsset(url) ? OCR_CACHE : CDN_CACHE;
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Yalnızca tam (200) yanıtlar kaydedilir; kısmi (206) ya da hatalı yanıtlar önbelleğe girmez
        if (res.status === 200 || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {});
        return res;
      });
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
