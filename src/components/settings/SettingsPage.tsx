import React, { useState } from 'react';
import { UserSettings } from '../../types/settings';
import { getUserSettings, saveUserSettings, getAllAppData, restoreAllAppData } from '../../services/storage';
import { sendTestNotification } from '../../services/telegram';
import { triggerDownload } from '../../services/exportImport';
import {
  Settings,
  Bell,
  Send,
  Cloud,
  Download,
  Upload,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface SettingsPageProps {
  onSettingsUpdated: () => void;
  dueCount: number;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onSettingsUpdated,
  dueCount,
}) => {
  const [settings, setSettings] = useState<UserSettings>(getUserSettings());
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  const handleSave = (updated: Partial<UserSettings>) => {
    const res = saveUserSettings(updated);
    setSettings(res);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    onSettingsUpdated();
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTestResult(null);
    try {
      const res = await sendTestNotification(settings, dueCount);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Hata oluştu' });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleExportBackup = () => {
    const data = getAllAppData();
    const jsonStr = JSON.stringify(data, null, 2);
    triggerDownload(
      jsonStr,
      `yokdil_master_tam_yedek_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';
        const data = JSON.parse(text);
        const ok = restoreAllAppData(data);
        if (ok) {
          alert('Yedek başarıyla geri yüklendi! Sayfa güncelleniyor.');
          window.location.reload();
        } else {
          alert('Geçersiz yedek dosyası biçimi.');
        }
      } catch (err) {
        alert('Yedek dosyası okunurken hata oluştu.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          <span>Uygulama Ayarları</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Telegram bildirimleri, bulut senkronizasyonu, tema ve veri güvenliği yönetimi.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Ayarlar başarıyla kaydedildi!</span>
        </div>
      )}

      {/* 1. TELEGRAM GÜNLÜK BİLDİRİM SİSTEMİ (Kural 8) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Telegram Günlük Hatırlatma Bildirimi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Site kapalıyken bile telefonunuza belirlenen saatte çalışma hatırlatması gönderir.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.telegramEnabled}
              onChange={(e) => handleSave({ telegramEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Telegram Ayar Formu */}
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="password"
                placeholder="Örn: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={settings.telegramBotToken}
                onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                onBlur={() => handleSave({ telegramBotToken: settings.telegramBotToken })}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telegram Chat ID
              </label>
              <input
                type="text"
                placeholder="Örn: 987654321"
                value={settings.telegramChatId}
                onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                onBlur={() => handleSave({ telegramChatId: settings.telegramChatId })}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Günlük Bildirim Saati (Türkiye Saati / UTC+3)
              </label>
              <input
                type="time"
                value={settings.notificationTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({ ...settings, notificationTime: val });
                  handleSave({ notificationTime: val });
                }}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Uygulama Bağlantı Adresi (URL)
              </label>
              <input
                type="text"
                value={settings.appUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({ ...settings, appUrl: val });
                  handleSave({ appUrl: val });
                }}
                placeholder="https://kullaniciadi.github.io/yokdil-vocab-app/"
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Test Butonu ve Yardım */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={isTestingTelegram || !settings.telegramBotToken || !settings.telegramChatId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs transition disabled:opacity-50"
            >
              {isTestingTelegram ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Test Bildirimi Gönder</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTelegramGuide(!showTelegramGuide)}
              className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Telegram Botu Nasıl Kurulur? (Kılavuz)</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Telegram Kurulum Rehberi Akordeon */}
          {showTelegramGuide && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2 animate-in fade-in">
              <p className="font-bold text-slate-900 dark:text-white">
                Telegram Bot Kurulumu (2 Dakika):
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                <li>
                  Telegram'da <b>@BotFather</b> kullanıcısını bulun ve <code>/newbot</code> komutunu gönderin.
                </li>
                <li>
                  Botunuza isim verin (örn: <i>YokdilHatirlaticiBot</i>). Size verilen <b>HTTP API Token</b>'ı kopyalayıp yukarıdaki alana yapıştırın.
                </li>
                <li>
                  Yeni botunuza gidip <code>/start</code> mesajı gönderin.
                </li>
                <li>
                  Telegram'da <b>@userinfobot</b> kullanıcısına mesaj atarak kendi <b>Id</b> numaranızı (Chat ID) öğrenin ve yukarıya yapıştırın.
                </li>
                <li>
                  <b>Test Bildirimi Gönder</b> düğmesine basarak bağlantıyı teyit edin.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* 2. BULUT VERİTABANI VE SENKRONİZASYON (Kural 9) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Bulut Senkronizasyonu & Kullanıcı Hesabı
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Telefon ve bilgisayarınızda aynı verilerle çalışmak için Supabase veya Firebase bağlayın.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'none', label: 'Yalnızca Çevrimdışı (Yerel)' },
              { id: 'supabase', label: 'Supabase (PostgreSQL)' },
              { id: 'firebase', label: 'Firebase Firestore' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSave({ cloudProvider: p.id as any })}
                className={`p-3 rounded-xl border text-xs font-semibold transition ${
                  settings.cloudProvider === p.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {settings.cloudProvider === 'supabase' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={settings.supabaseConfig?.url || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      supabaseConfig: {
                        url: e.target.value,
                        anonKey: settings.supabaseConfig?.anonKey || '',
                      },
                    })
                  }
                  onBlur={() => handleSave({ supabaseConfig: settings.supabaseConfig })}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={settings.supabaseConfig?.anonKey || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      supabaseConfig: {
                        url: settings.supabaseConfig?.url || '',
                        anonKey: e.target.value,
                      },
                    })
                  }
                  onBlur={() => handleSave({ supabaseConfig: settings.supabaseConfig })}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          )}

          {settings.cloudProvider === 'firebase' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Firebase API Key
                </label>
                <input
                  type="password"
                  value={settings.firebaseConfig?.apiKey || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      firebaseConfig: {
                        apiKey: e.target.value,
                        authDomain: settings.firebaseConfig?.authDomain || '',
                        projectId: settings.firebaseConfig?.projectId || '',
                      },
                    })
                  }
                  onBlur={() => handleSave({ firebaseConfig: settings.firebaseConfig })}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Project ID
                </label>
                <input
                  type="text"
                  value={settings.firebaseConfig?.projectId || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      firebaseConfig: {
                        apiKey: settings.firebaseConfig?.apiKey || '',
                        authDomain: settings.firebaseConfig?.authDomain || '',
                        projectId: e.target.value,
                      },
                    })
                  }
                  onBlur={() => handleSave({ firebaseConfig: settings.firebaseConfig })}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Auth Domain
                </label>
                <input
                  type="text"
                  value={settings.firebaseConfig?.authDomain || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      firebaseConfig: {
                        apiKey: settings.firebaseConfig?.apiKey || '',
                        authDomain: e.target.value,
                        projectId: settings.firebaseConfig?.projectId || '',
                      },
                    })
                  }
                  onBlur={() => handleSave({ firebaseConfig: settings.firebaseConfig })}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. VERİ YEDEKLEME VE GERİ YÜKLEME (Kural 9: CSV / JSON Export & Import) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Veri Güvenliği ve Yedekleme (JSON / CSV)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tüm haftalarınızı, okuma parçalarınızı ve aralıklı tekrar geçmişinizi tek tıkla bilgisayarınıza indirin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
          >
            <Download className="w-4 h-4 text-blue-500" />
            <span>Tüm Verilerimi İndir (JSON Yedek)</span>
          </button>

          <label className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>Yedekten Geri Yükle</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 4. İSTEĞE BAĞLI YAPAY ZEKÂ ÇÖZÜMLEME AYARI */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              İsteğe Bağlı Yapay Zekâ Çeviri & Analiz Anahtarı
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              API anahtarınız yalnızca tarayıcınızın yerel belleğinde saklanır. Sunucuya aktarılmaz.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              AI Servisi
            </label>
            <select
              value={settings.aiProvider}
              onChange={(e) => handleSave({ aiProvider: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              <option value="none">Devre Dışı (Yapay zekâ kullanma)</option>
              <option value="gemini">Google Gemini API (Önerilen)</option>
              <option value="openai">OpenAI (GPT-4o Mini)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              API Anahtarı (Key)
            </label>
            <input
              type="password"
              placeholder="API Anahtarınızı giriniz..."
              value={settings.aiApiKey || ''}
              onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
              onBlur={() => handleSave({ aiApiKey: settings.aiApiKey })}
              className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
