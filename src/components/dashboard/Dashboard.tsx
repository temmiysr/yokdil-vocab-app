import React from 'react';
import { VocabCard } from '../../types/vocab';
import { Week, ReadingText } from '../../types/reading';
import { ActiveTab } from '../../types';
import { ForecastChart } from './ForecastChart';
import { get7DayForecast, getLearningStats } from '../../services/srs';
import {
  RotateCw,
  BookOpen,
  Plus,
  Flame,
  CheckCircle2,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Sparkles,
} from 'lucide-react';

interface DashboardProps {
  cards: VocabCard[];
  weeks: Week[];
  readings: ReadingText[];
  setActiveTab: (tab: ActiveTab) => void;
  streakCount: number;
  todayCompletedCount: number;
  onOpenNewWeekModal: () => void;
  onOpenUploadReadingModal: () => void;
  onOpenAddWordModal: () => void;
  onSelectWeek: (weekId: string) => void;
  onSelectReading: (readingId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  cards,
  weeks,
  readings,
  setActiveTab,
  streakCount,
  todayCompletedCount,
  onOpenNewWeekModal,
  onOpenUploadReadingModal,
  onOpenAddWordModal,
  onSelectWeek,
  onSelectReading,
}) => {
  const stats = getLearningStats(cards);
  const forecast = get7DayForecast(cards);

  return (
    <div className="space-y-6">
      {/* Üst Karşılama ve Hızlı Başlat Kartı */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Kişisel YÖKDİL Çalışma Masası</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {stats.dueCount > 0
              ? `Bugün ${stats.dueCount} Kelime Tekrar Bekliyor!`
              : 'Harika İş! Bugünkü Tekrarlarını Tamamladın.'}
          </h1>
          <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
            {stats.dueCount > 0
              ? 'Aralıklı tekrar algoritması, kelimeleri unutma eşiğine geldiğiniz anda size sunar. Birkaç dakikanızı ayırarak bilginizi kalıcı belleğe aktarın.'
              : 'Bugün için planlanan tüm aralıklı tekrarları bitirdiniz. İsterseniz yeni bir okuma parçası yükleyip kelime dağarcığınızı genişletebilir veya sınav modlarında pratik yapabilirsiniz.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {stats.dueCount > 0 ? (
              <button
                onClick={() => setActiveTab('daily-review')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-sm shadow-lg hover:bg-blue-50 transition transform active:scale-95"
              >
                <RotateCw className="w-4 h-4 text-blue-600 animate-spin-reverse" />
                <span>Günlük Tekrarı Başlat ({stats.dueCount})</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('study')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm backdrop-blur-md transition"
              >
                <BrainCircuit className="w-4 h-4 text-amber-300" />
                <span>Serbest Test Çöz</span>
              </button>
            )}

            <button
              onClick={onOpenUploadReadingModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold backdrop-blur-md transition"
            >
              <BookOpen className="w-4 h-4" />
              <span>Metin Yükle</span>
            </button>
          </div>
        </div>

        {/* Arka plan dekorasyonu */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <BookOpen className="w-80 h-80 text-white -mr-16 -mb-16" />
        </div>
      </div>

      {/* 7 Temel İstatistik Kartı */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Toplam Kayıtlı Kelime */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toplam Kelime</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-1">Havuzdaki tüm kartlar</p>
        </div>

        {/* 2. Bugün Tekrar Edilecek */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-sm bg-blue-50/20 dark:bg-blue-950/20">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Bugün Tekrar</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.dueCount}</p>
          <p className="text-[11px] text-blue-500/80 mt-1">Vadesi gelen kartlar</p>
        </div>

        {/* 3. Bugün Tamamlanan */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Bugün Biten</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{todayCompletedCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Gözden geçirilen</p>
        </div>

        {/* 4. Öğrenilmiş Kelime */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Öğrenilmiş (Mastered)</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{stats.masteredCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Aralık ≥ 30 gün</p>
        </div>

        {/* 5. Çalışma Serisi */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm bg-amber-50/20 dark:bg-amber-950/20">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Seri</span>
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{streakCount} Gün</p>
          <p className="text-[11px] text-amber-600/70 mt-1">Aralıksız çalışma</p>
        </div>

        {/* 6. Haftalık İlerleme Yüzdesi */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span>Kalıcılık</span>
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">%{stats.learningPercentage}</p>
          <p className="text-[11px] text-slate-400 mt-1">Uzun vade başarı</p>
        </div>
      </div>

      {/* 7 Günlük Tekrar Grafiği */}
      <ForecastChart data={forecast} />

      {/* Haftalarım ve Okuma Parçaları Genel Görünümü */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Haftalık Listeler (2 Kolon) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span>Haftalık Çalışma Listelerim</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kendi oluşturduğunuz haftalar ve okuma parçaları
              </p>
            </div>
            <button
              onClick={onOpenNewWeekModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Hafta</span>
            </button>
          </div>

          {weeks.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                Henüz bir çalışma haftası oluşturulmadı.
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Örneğin <b>"1. Hafta – 16 Kasım 2026"</b> adıyla yeni bir hafta oluşturup içine çalıştığınız okuma metinlerini ekleyebilirsiniz.
              </p>
              <button
                onClick={onOpenNewWeekModal}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>İlk Haftayı Oluştur</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {weeks.slice(0, 4).map((week) => {
                const weekReadings = readings.filter((r) => r.weekId === week.id);
                const weekCards = cards.filter((c) => c.weekId === week.id);
                const learnedCount = weekCards.filter((c) => c.srs.state === 'mastered').length;
                const percent = weekCards.length > 0 ? Math.round((learnedCount / weekCards.length) * 100) : 0;

                return (
                  <div
                    key={week.id}
                    onClick={() => onSelectWeek(week.id)}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {week.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{weekReadings.length} Okuma Metni</span>
                        <span>•</span>
                        <span>{weekCards.length} Kelime</span>
                        <span>•</span>
                        <span>%{percent} Öğrenildi</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>
                );
              })}

              {weeks.length > 4 && (
                <button
                  onClick={() => setActiveTab('weeks')}
                  className="w-full text-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-2"
                >
                  Tüm Haftaları Gör ({weeks.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Son Okuma Parçaları (1 Kolon) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>Son Okuma Parçaları</span>
            </h3>
            <button
              onClick={onOpenUploadReadingModal}
              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
              title="Yeni Metin Yükle"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {readings.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Henüz metin yüklenmedi.
              </p>
              <button
                onClick={onOpenUploadReadingModal}
                className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                PDF / Word / Metin Yükle
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-80">
              {readings.slice(0, 5).map((reading) => (
                <div
                  key={reading.id}
                  onClick={() => onSelectReading(reading.id)}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition"
                >
                  <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                    {reading.title}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>{reading.wordCount} kelime</span>
                    <span>{reading.savedWordIds.length} çıkarılan kelime</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
