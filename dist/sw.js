// YÖKDİL Master – Service Worker (çevrimdışı çalışma)
// - Uygulama sayfası: önce ağ, ağ yoksa önbellek (güncellemeler hemen gelsin, internet yokken de açılsın)
// - CDN kütüphaneleri (React, Babel, Tailwind, PDF.js, Firebase SDK…): önbellekten, yoksa ağdan alıp önbelleğe yaz
// - OCR dosyaları (Tesseract worker, wasm çekirdeği, İngilizce dil verisi) ve PDF.js worker'ı: ilk kullanımda ayrı
//   önbelleğe alınır; sonra internet yokken de resim/PDF okunabilir. Sürüm değişse de bu büyük dosyalar korunur.
// - Firebase/Google API'leri, sözlük ve çeviri servisleri, Claude API: HİÇ dokunulmaz (giriş ve eşitleme bozulmasın)
const VERSION = 'yokdil-v6';
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

// Bildirime tıklanınca uygulamayı ilgili ekranda aç (?go=learn | quiz | review)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { if ('navigate' in c && target !== './') c.navigate(target).catch(() => {}); return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

// Android'de ana ekrana eklenmiş uygulama: tarayıcı izin verdikçe arka planda günlük hatırlatma.
// Veriler uygulamanın kendi IndexedDB'sinden okunur; günde en çok bir sabah ve bir akşam bildirimi gösterilir.
const idbGet = (key) => new Promise((resolve) => {
  const r = indexedDB.open('yokdil-master');
  r.onerror = () => resolve(null);
  r.onsuccess = () => {
    try { const q = r.result.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => resolve(q.result); q.onerror = () => resolve(null); }
    catch (e) { resolve(null); }
  };
});
const idbSet = (key, val) => new Promise((resolve) => {
  const r = indexedDB.open('yokdil-master');
  r.onerror = () => resolve();
  r.onsuccess = () => { try { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = () => resolve(); } catch (e) { resolve(); } };
});
self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'yokdil-daily') return;
  event.waitUntil((async () => {
    const settings = (await idbGet('yokdil_user_settings_v1')) || {};
    if (!settings.remindersOn) return;
    const cards = (await idbGet('yokdil_vocab_cards_v1')) || [];
    const d = new Date();
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const shown = (await idbGet('sw_reminder_shown')) || {};
    const isNew = (c) => c && !c.queued && c.srs && c.srs.state === 'new' && !c.srs.lastReviewedAt && !c.learnedAt && c.srs.nextReviewAt <= today;
    const learn = cards.filter(isNew).length;
    const quiz = cards.filter(c => c.learnedAt === today && c.quizzedAt !== today).length;
    const due = cards.filter(c => c.srs && c.srs.nextReviewAt <= today && !isNew(c) && !(c.learnedAt === today && c.quizzedAt !== today)).length;
    const show = (title, body, go) => self.registration.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'yokdil-' + go, data: { url: './?go=' + go } });
    if (hm >= (settings.eveningTime || '20:00') && shown.evening !== today && (quiz > 0 || due > 0)) {
      shown.evening = today; await idbSet('sw_reminder_shown', shown);
      return show(quiz ? '🌙 Günün kelime sınavı' : '🔄 Tekrar zamanı', quiz ? 'Bugün öğrendiğiniz ' + quiz + ' kelimeden kısa bir sınav.' : due + ' kart tekrar bekliyor.', quiz ? 'quiz' : 'review');
    }
    if (hm >= (settings.morningTime || '09:00') && shown.morning !== today && settings.lastMorningNote !== today && learn > 0) {
      shown.morning = today; await idbSet('sw_reminder_shown', shown);
      return show('📘 Günün yeni kelimeleri hazır', Math.min(learn, settings.learnPerDay || 10) + ' yeni kelime sizi bekliyor.', 'learn');
    }
  })());
});
