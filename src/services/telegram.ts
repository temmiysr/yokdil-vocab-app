import { UserSettings } from '../types/settings';

/**
 * Telegram Bot API üzerinden mesaj gönderir.
 * Doğrudan https://api.telegram.org/bot<TOKEN>/sendMessage adresine POST isteği yapar.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram Bot Token veya Chat ID eksik.' };
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || 'Telegram API hatası' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Ağ bağlantı hatası' };
  }
}

/**
 * Ayarlar ekranında Telegram bağlantısını doğrulamak için test bildirimi gönderir.
 */
export async function sendTestNotification(
  settings: UserSettings,
  dueCount: number = 0
): Promise<{ success: boolean; message: string }> {
  if (!settings.telegramBotToken || !settings.telegramChatId) {
    return {
      success: false,
      message: 'Lütfen Telegram Bot Token ve Chat ID alanlarını doldurunuz.',
    };
  }

  const message = `🔔 <b>YÖKDİL Kelime Öğrenme - Test Bildirimi</b>\n\n` +
    `Tebrikler! Telegram bildirim entegrasyonunuz başarıyla bağlandı.\n\n` +
    `📊 <b>Mevcut Durum:</b> Bugün tekrar bekleyen ${dueCount} kelimeniz var.\n` +
    `⏰ <b>Planlanan Saat:</b> ${settings.notificationTime} (Türkiye Saati / UTC+3)\n\n` +
    `🔗 <a href="${settings.appUrl || window.location.href}">Uygulamaya Git ve Çalışmaya Başla</a>`;

  const result = await sendTelegramMessage(
    settings.telegramBotToken,
    settings.telegramChatId,
    message
  );

  if (result.success) {
    return { success: true, message: 'Test bildirimi Telegram hesabınıza başarıyla iletildi!' };
  } else {
    return {
      success: false,
      message: `Bildirim gönderilemedi: ${result.error || 'Bilinmeyen hata'}. Token ve Chat ID'nizi kontrol ediniz.`,
    };
  }
}

/**
 * Otomatik GitHub Actions veya zamanlayıcı için kullanılacak standart mesaj şablonu.
 */
export function formatDailyReminderMessage(dueCount: number, appUrl: string): string {
  const countText = dueCount > 0 ? `Bugün tekrar etmen gereken <b>${dueCount}</b> kelime var.` : 'Bugünlük tüm tekrarlarını tamamladın veya yeni kelimeler ekleyebilirsin.';
  return (
    `📚 <b>İngilizce Tekrar Zamanı!</b>\n\n` +
    `Günün YÖKDİL çalışmasını aksatma. ${countText}\n\n` +
    `🎯 Düzenli aralıklı tekrar (SRS) uzun vadeli kalıcılığın tek anahtarıdır.\n\n` +
    `👉 <a href="${appUrl}">Buraya tıklayarak hemen başla</a>`
  );
}
