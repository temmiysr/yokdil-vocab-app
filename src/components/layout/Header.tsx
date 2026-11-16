import React from 'react';
import { ActiveTab } from '../../types';
import {
  Flame,
  Moon,
  Sun,
  Cloud,
  CloudCheck,
  Plus,
  BookOpen,
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  streakCount: number;
  isDarkMode: boolean;
  toggleTheme: () => void;
  cloudConnected: boolean;
  onQuickAddWord: () => void;
  onQuickUploadReading: () => void;
}

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Ana Sayfa', subtitle: 'Günlük ilerleme ve çalışma özeti' },
  'daily-review': { title: 'Günlük Tekrar', subtitle: 'Aralıklı tekrar (Spaced Repetition) oturumu' },
  weeks: { title: 'Haftalık Listelerim', subtitle: 'Haftalara göre organize edilmiş okuma parçaları' },
  readings: { title: 'Okuma Parçalarım', subtitle: 'Yüklenen İngilizce metinler ve kelime çıkarma' },
  bank: { title: 'YÖKDİL Kelime Bankası', subtitle: 'Alanlara göre kategorize edilmiş kelime havuzu' },
  study: { title: 'Sınavlar & Çalışma Modları', subtitle: 'Çoktan seçmeli, boşluk doldurma ve karma testler' },
  difficult: { title: 'Zorlandığım Kelimeler', subtitle: 'Sık hata yapılan veya zor olarak işaretlenen kelimeler' },
  stats: { title: 'İstatistikler', subtitle: 'Öğrenme verileri ve 7 günlük tekrar yükü grafiği' },
  settings: { title: 'Ayarlar', subtitle: 'Telegram bildirimi, tema ve bulut yedekleme yapılandırması' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  streakCount,
  isDarkMode,
  toggleTheme,
  cloudConnected,
  onQuickAddWord,
  onQuickUploadReading,
}) => {
  const currentInfo = TAB_TITLES[activeTab] || { title: 'YÖKDİL Master', subtitle: '' };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          {currentInfo.title}
        </h2>
        <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {currentInfo.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hızlı Eylemler (Masaüstü) */}
        <button
          onClick={onQuickUploadReading}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
          title="Yeni Okuma Parçası Yükle"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span>Metin Yükle</span>
        </button>

        <button
          onClick={onQuickAddWord}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
          title="Kelime Ekle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Kelime Ekle</span>
        </button>

        {/* Günlük Seri Sayacı */}
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold"
          title="Çalışma Serisi (Gün)"
        >
          <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
          <span>{streakCount} Gün</span>
        </div>

        {/* Bulut Durumu */}
        <div
          onClick={() => setActiveTab('settings')}
          className="cursor-pointer p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          title={cloudConnected ? 'Bulut Senkronize' : 'Yerel Depolama (Bulut için Ayarlar)'}
        >
          {cloudConnected ? (
            <CloudCheck className="w-5 h-5 text-emerald-500" />
          ) : (
            <Cloud className="w-5 h-5 text-slate-400" />
          )}
        </div>

        {/* Karanlık / Aydınlık Tema Butonu */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          aria-label="Temayı Değiştir"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
