# YÖKDİL Master – geliştirme notları

Kişisel YÖKDİL / YDS hazırlık uygulaması (React 18, tarayıcıda çalışan tek sayfa). Arayüz ve kullanıcıya dönük metinler Türkçe.

## Kod nerede
- **Uygulama kodu `app/*.jsx` dosyalarındadır** (numara sırası önemli; hepsi tek bir `<script type="text/babel">` içinde birleşir). Değişiklikleri bu dosyalarda yapın.
- `app/index.template.html`: sayfa iskeleti (CDN kütüphaneleri, PWA, Firebase ayarları); `/*@@APP_KODU@@*/` yerine kod eklenir.
- `dist/index.html` **üretilen dosyadır**: `node scripts/assemble.mjs` ile app/'tan yazılır. Elle düzenlemeyin; app/ değişince yeniden üretip birlikte commit edin (yayın işi `--check` ile kontrol eder).
- `dist/sw.js` (çevrimdışı önbellek), `dist/manifest.webmanifest`, ikonlar: doğrudan dist/ içinde.
- `src/` eski Vite kaynağıdır; kullanılmıyor.

## Çalıştırma ve kontrol
- Yerel: `node serve.js` (ya da `baslat.bat`) → http://localhost:3000. Sunucu ana sayfayı her istekte app/'tan birleştirir.
- Testler: `node tests/parser.test.mjs` (sınav ayrıştırıcı, cevap anahtarı, soru tipleri, kelime listesi, deneme oluşturucu).
- Yayın: `main`'e push → GitHub Actions: assemble --check → testler → `scripts/build.mjs` (JSX önceden derlenir, Babel kaldırılır) → GitHub Pages.

## Veriler
- Tarayıcıda IndexedDB (`yokdil-master` / `kv`); Google girişiyle Firestore `users/{uid}/…` (yalnızca sahibi). Kurallar: `firestore.rules` (Firebase konsolunda yayınlanır).
- Herkese açık: `public_shares` (paylaşılan liste / deneme), `groups` (çalışma grupları).

## Kurallar
- Tureng'den otomatik veri çekilmez (kullanım koşulları); anlamlar Wiktionary / MyMemory'den.
- ÖSYM çıkmış soruları ve izin vermeyen yayınlar depoya ya da herkese açık kütüphaneye eklenmez.
- Claude özellikleri kullanıcının kendi API anahtarıyla çalışır (yalnızca tarayıcıda saklanır).
