import React from 'react';
import { Week, ReadingText } from '../../types/reading';
import { VocabCard } from '../../types/vocab';
import {
  CalendarDays,
  Plus,
  BookOpen,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface WeeklyListsProps {
  weeks: Week[];
  readings: ReadingText[];
  cards: VocabCard[];
  onSelectWeek: (weekId: string) => void;
  onOpenNewWeekModal: () => void;
}

export const WeeklyLists: React.FC<WeeklyListsProps> = ({
  weeks,
  readings,
  cards,
  onSelectWeek,
  onOpenNewWeekModal,
}) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Üst Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Haftalık Listelerim
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Önceki haftalarınız silinmez; tüm okuma parçalarınız kronolojik olarak korunur.
          </p>
        </div>

        <button
          onClick={onOpenNewWeekModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Hafta Oluştur</span>
        </button>
      </div>

      {/* Haftalar Listesi */}
      {weeks.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto">
          <CalendarDays className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Henüz Bir Hafta Bulunmuyor
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Haftalık İngilizce okuma programınızı başlatmak için örneğin "1. Hafta – 16 Kasım 2026" adında yeni bir hafta oluşturun.
          </p>
          <button
            onClick={onOpenNewWeekModal}
            className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>İlk Haftayı Başlat</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeks.map((week) => {
            const weekReadings = readings.filter((r) => r.weekId === week.id);
            const weekCards = cards.filter((c) => c.weekId === week.id);
            const learnedCount = weekCards.filter((c) => c.srs.state === 'mastered').length;
            const percent = weekCards.length > 0 ? Math.round((learnedCount / weekCards.length) * 100) : 0;

            return (
              <div
                key={week.id}
                onClick={() => onSelectWeek(week.id)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm cursor-pointer transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span>{week.startDate}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">%{percent} Öğrenildi</span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 dark:text-white mt-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {week.title}
                  </h3>

                  <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{weekReadings.length} Okuma Parçası</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{weekCards.length} Seçilen Kelime</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <span>Haftayı İncele</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
