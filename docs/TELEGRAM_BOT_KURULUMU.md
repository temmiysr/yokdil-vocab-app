# Telegram Günlük Bildirim Sistemi Kurulum Kılavuzu

GitHub Pages statik bir barındırma hizmeti olduğundan, tarayıcı veya web sayfası kapalıyken kullanıcının telefonuna doğrudan sistem bildirimi iletemez. Bu sınırlamayı aşmak için en güvenilir, sıfır maliyetli ve kesintisiz yöntem **Telegram Botu ve GitHub Actions Zamanlayıcısı** kullanmaktır.

---

## 1. Telegram Botunun Oluşturulması (1 Dakika)

1. Telefonunuzda veya masaüstünde Telegram uygulamasını açın.
2. Arama çubuğuna `@BotFather` yazın ve doğrulanmış resmi mavi tikli botu seçin.
3. `/newbot` mesajını gönderin.
4. Botunuz için bir görünen ad belirleyin (Örn: *YÖKDİL Kelime Asistanım*).
5. Botunuz için benzersiz bir kullanıcı adı (`username`) belirleyin. Kullanıcı adı mutlaka `bot` ile bitmelidir (Örn: `YokdilVocabStudyBot`).
6. BotFather size bir **HTTP API Token** verecektir. Bu anahtar şuna benzer:
   `7123456789:AAFlkBvEXAMPLEtokenKeyABC_123`
   *(Bu token'ı gizli tutun ve bir yere not edin).*
7. Oluşturduğunuz yeni botun bağlantısına tıklayarak içine girin ve `/start` düğmesine basın.

---

## 2. Kendi Chat ID Numaranızı Öğrenme

1. Telegram arama çubuğuna `@userinfobot` yazın.
2. Botu başlatın. Size ait `Id:` satırında 9-10 basamaklı bir sayı verecektir (Örn: `987654321`).
3. Bu sayı sizin **Telegram Chat ID**'nizdir.

---

## 3. Uygulama Ayarlarından Test Etme

1. Geliştirilen YÖKDİL uygulamasında **Ayarlar** sekmesine gidin.
2. **Telegram Bot Token** ve **Telegram Chat ID** alanlarını doldurun.
3. **Test Bildirimi Gönder** düğmesine tıklayın.
4. Telefonunuza test bildiriminin geldiğini teyit edin.

---

## 4. GitHub Actions ile Günlük Otomatik Zamanlama Kurulumu

Her gün iki mesaj gelir: sabah **09:00**'da "Günün yeni kelimeleri" (bağlantı uygulamayı `?go=learn` ile öğrenme ekranında açar) ve akşam **20:00**'de "Günün kelime sınavı" (`?go=quiz`). Kurmak için:

1. Uygulamanızın GitHub deposuna gidin.
2. **Settings -> Secrets and variables -> Actions** menüsünü açın.
3. **New repository secret** butonuna basarak şu 3 gizli değişkeni ekleyin:
   - `TELEGRAM_BOT_TOKEN`: 1. adımda aldığınız bot token.
   - `TELEGRAM_CHAT_ID`: 2. adımda aldığınız sohbet ID numarası.
   - `APP_URL` (isteğe bağlı): sitenin adresi. Yazmazsanız `https://temmiysr.github.io/yokdil-vocab-app/` kullanılır.
4. Hemen denemek için **Actions → Telegram Daily Study Reminders → Run workflow** (kind: `sabah` ya da `aksam`).

---

## 5. Saat Farkı (UTC ve Türkiye Saati UTC+3) & Gecikme Açıklaması

- **UTC Saati:** GitHub Actions cron zamanlayıcıları evrensel standart olan UTC saat dilimini kullanır.
- **Türkiye Saati (TSİ):** Türkiye, yıl boyu sabit **UTC + 3** saat dilimindedir.
- **Dönüşüm Formülü:** `UTC Saati = İstenen Türkiye Saati - 3 Saat`
  - Örneğin akşam saat **20:00 (TSİ)** bildirim almak istiyorsanız: `20 - 3 = 17:00 UTC`
  - Deponuzdaki `.github/workflows/telegram-reminder.yml` dosyası `cron: '0 6 * * *'` (09:00) ve `cron: '0 17 * * *'` (20:00) ile yapılandırılmıştır.
- **Zamanlayıcı Jitter Uyarısı:** GitHub Actions paylaşımlı altyapı kullandığı için, dünya genelindeki yoğunluk durumuna bağlı olarak zamanlanmış görevleri 5 ila 25 dakika arasında gecikmeyle tetikleyebilir. Bu durum GitHub'ın standart davranışıdır.
