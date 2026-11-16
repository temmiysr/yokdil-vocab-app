# YÖKDİL Master – Adım Adım Kurulum ve Kullanım Kılavuzu

Modern, mobil uyumlu, Türkçe arayüzlü ve aralıklı tekrar (Spaced Repetition) motorlu **Kişisel YÖKDİL İngilizce Kelime Öğrenme ve Okuma Analizi Uygulaması**.

---

## 1. Projenin Temel İlkeleri ve Özellikleri

- **Mutlak Kullanıcı Kontrolü:** Uygulama internetten kendiliğinden metin indirmez, hazır okuma parçaları eklemez ve yapay zekâyla otomatik metin üretmez. Tüm okuma parçalarını yalnızca siz sağlarsınız.
- **Çoklu Dosya Formatı:** PDF, Word (.docx), Görsel (Tesseract OCR ile kontrollü metin tanıma) ve Düz Metin desteği.
- **Akıllı Metin Seçimi:** Metin içindeki tek kelimeleri veya çok sözcüklü kalıp ifadeleri (*shortage of natural resources*, *remains a major challenge* vb.) seçip 12 alanlı öğrenme kartına dönüştürebilme.
- **Mükerrer Kelime Tespiti:** Aynı kelime başka bir parçada geçtiğinde yeni kart açmak yerine yeni bağlam ve cümle ekleme önerisi.
- **SM-2 Tabanlı Günlük Tekrar Motoru:** 1, 3, 7, 14 ve 30+ günlük uyarlanabilir tekrar aralıkları, kolaylık faktörü ve unutma (lapse) sayacı.
- **7 Farklı Çalışma Modu:** Kelime Kartları, Türkçeden İngilizceye, Çoktan Seçmeli Test, Boşluk Doldurma, Kalıp İfadeler & Edatlar, Zorlandığım Kelimeler ve Karma Tekrar.
- **Telegram Bildirim Entegrasyonu:** GitHub Actions zamanlayıcısı ile her gün belirlediğiniz saatte telefonunuza otomatik hatırlatma.
- **PWA Desteği:** iOS ve Android telefonlarda ana ekrana uygulama olarak ekleyebilme.
- **Bulut ve Çoklu Cihaz Senkronizasyonu:** Supabase (PostgreSQL) ve Firebase desteği; ayrıca çevrimdışı öncelikli (Offline-first) yerel depolama.

---

## 2. Proje Klasör Yapısı

```
yokdil-vocab-app/
├── .github/
│   └── workflows/
│       ├── deploy.yml                 # GitHub Pages otomatik yayınlama
│       └── telegram-reminder.yml      # Günlük zamanlanmış Telegram bildirimi
├── docs/
│   ├── KURULUM_REHBERI.md             # Bu kılavuz
│   ├── TELEGRAM_BOT_KURULUMU.md       # Telegram bildirim botu rehberi
│   └── VERITABANI_SEMA_VE_GUVENLIK_KURALLARI.md # Supabase & Firebase şemaları
├── public/
│   ├── 404.html                       # GitHub Pages SPA yönlendirme çözümü
│   ├── favicon.svg                    # Vektörel akademik uygulama simgesi
│   ├── manifest.webmanifest           # PWA bildirim ve yükleme dosyası
│   └── sw.js                          # Service Worker (Çevrimdışı önbellekleme)
├── src/
│   ├── components/
│   │   ├── bank/                      # YÖKDİL Kelime Bankası ve İçe Aktarma
│   │   ├── dashboard/                 # Ana sayfa ve 7 günlük tekrar grafiği
│   │   ├── layout/                    # Responsive Sidebar, Header, Mobil Nav
│   │   ├── reader/                    # Okuma ekranı, seçim menüsü, OCR & dosya yükleyici
│   │   ├── review/                    # Spaced repetition günlük tekrar oturumu
│   │   ├── settings/                  # Ayarlar, Telegram testi, yedekleme
│   │   ├── stats/                     # İstatistik ve analiz ekranı
│   │   ├── study/                     # 7 adet sınav ve alıştırma modu
│   │   ├── vocab/                     # 12 alanlı kelime modalı ve mükerrer uyarısı
│   │   └── weeks/                     # Haftalık listelerim ve hafta detay görünümü
│   ├── services/
│   │   ├── aiService.ts               # İsteğe bağlı AI dil analizi sağlayıcısı
│   │   ├── cloudSync.ts               # Supabase & Firebase senkronizasyonu
│   │   ├── exportImport.ts            # CSV ve JSON içe/dışa aktarım motoru
│   │   ├── speech.ts                  # Web Speech API İngilizce telaffuz servisi
│   │   ├── srs.ts                     # SM-2 aralıklı tekrar algoritması
│   │   ├── storage.ts                 # Yerel ve bulut depolama katmanı
│   │   ├── telegram.ts                # Telegram Bot bildirim istemcisi
│   │   └── textParser.ts              # PDF, Word, TXT ve OCR metin çıkarma
│   ├── types/                         # TypeScript tip tanımları (srs, vocab, reading, settings)
│   ├── utils/                         # Cümle çıkarma, normalizasyon ve regex
│   ├── App.tsx                        # Ana React bileşeni
│   ├── index.css                      # Tailwind yönergeleri ve animasyonlar
│   └── main.tsx                       # React başlangıç noktası
├── templates/
│   ├── yokdil_kelime_sablonu.csv      # CSV toplu içe aktarma şablonu
│   ├── yokdil_kelime_sablonu.json     # JSON kelime bankası şablonu
│   └── ornek_okuma_parcasi_bilgi.txt  # Okuma metni format bilgisi
├── tests/
│   ├── srs.test.js                    # SRS algoritma birim testleri
│   ├── sentenceExtractor.test.js      # Orijinal cümle çıkarma testleri
│   ├── importExport.test.js           # CSV/JSON ayrıştırma testleri
│   ├── duplicateDetection.test.js     # Mükerrer kelime tespiti testleri
│   └── runTests.js                    # Node.js test çalıştırıcısı
├── index.html
├── package.json
├── postcss.config.js
├── serve.js                           # Bağımsız yerel test sunucusu
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts                     # GitHub Pages (base: './') uyumlu yapılandırma
```

---

## 3. Kurulum ve Çalıştırma Adımları

### Gereksinimler
- Bilgisayarınızda **Node.js** (v18 veya üzeri) ve **npm** (veya **pnpm**) kurulu olmalıdır.

### Adım 1: Bağımlılıkları Yükleme
Proje klasörüne girip terminalde şu komutu çalıştırın:
```bash
npm install
```

### Adım 2: Geliştirme Sunucusunu Başlatma
Uygulamayı yerel geliştirme modunda açmak için:
```bash
npm run dev
```
Terminalde verilen adresi (genellikle `http://localhost:5173`) tarayıcınızda açın.

### Adım 3: Birim Testleri Çalıştırma
Tüm algoritmaların ve ayrıştırma mekanizmalarının doğrulanması için:
```bash
npm test
```

### Adım 4: Canlı Sunucu (Zero-Dependency)
Hiçbir harici bağımlılık olmadan doğrudan Node.js ile çalıştırmak için:
```bash
node serve.js
```
`http://localhost:3000` adresinde çalışan uygulamayı görebilirsiniz.

---

## 4. GitHub Pages Üzerinde Yayınlama

1. GitHub'da yeni bir repository (depo) oluşturun (Örn: `yokdil-vocab-app`).
2. Projenizi GitHub'a push edin:
   ```bash
   git init
   git add .
   git commit -m "İlk sürüm: YÖKDİL Kelime ve Akıllı Tekrar Uygulaması"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADINIZ/yokdil-vocab-app.git
   git push -u origin main
   ```
3. GitHub deponuzun **Settings -> Pages** sekmesine gidin.
4. **Build and deployment -> Source** kısmından **GitHub Actions** seçeneğini işaretleyin.
5. Deponuzdaki `.github/workflows/deploy.yml` iş akışı otomatik devreye girecek ve birkaç dakika içinde siteniz `https://kullanici_adiniz.github.io/yokdil-vocab-app/` adresinde canlıya geçecektir.

---

## 5. Mobil Telefona Yükleme (PWA)

- **iPhone / iOS (Safari):**
  Safari ile sitenizi açın -> Alttaki **Paylaş** simgesine dokunun -> **Ana Ekrana Ekle** seçeneğine basın.
- **Android (Chrome):**
  Chrome ile sitenizi açın -> Sağ üstteki üç noktaya dokunun -> **Uygulamayı Yükle** veya **Ana Ekrana Ekle** seçeneğine basın.

Bu sayede uygulama tarayıcı çubukları olmadan, tam ekran ve çevrimdışı destekli bir mobil uygulama gibi çalışır.
