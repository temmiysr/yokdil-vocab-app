import React from 'react';
import { VocabCard } from '../../types/vocab';
import { Week, ReadingText } from '../../types/reading';
import { getLearningStats, get7DayForecast } from '../../services/srs';
import { ForecastChart } from '../dashboard/ForecastChart';
import {
  BarChart3,
  TrendingUp,
  BrainCircuit,
  RotateCw,
  Flame,
  Award,
  BookOpen,
} from 'lucide-react';

interface StatsPageProps {
  cards: VocabCard[];
  weeks: Week[];
  readings: ReadingText[];
  streakCount: number;
}

export const StatsPage: React.FC<StatsPageProps> = ({
  cards,
  weeks,
  readings,
  streakCount,
}) => {
  const stats = getLearningStats(cards);
  const forecast = get7DayForecast(cards);

  // Kategori dağılımı
  const categories: Record<string, number> = {};
  cards.forEach((c) => {
    const cat = c.academicUsage || 'Genel Akademik';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // Kelime türü dağılımı
  const posCounts: Record<string, number> = {};
  cards.forEach((c) => {
    posCounts[c.partOfSpeech] = (posCounts[c.partOfSpeech] || 0) + 1;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          <span>İlerleme ve Öğrenme Analizi</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hafıza kalıcılığı, tekrar yükü ve kelime havuzunuzun ayrıntılı dökümü.
        </p>
      </div>

      {/* Üst Kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Toplam Kelime</span>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-1">{readings.length} okuma parçasından</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Kalıcı Hafızada</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{stats.masteredCount}</p>
          <p className="text-[11px] text-emerald-500/80 mt-1">%{stats.learningPercentage} ustalaşma</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Öğrenme / Tekrarda</span>
            <RotateCw className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {stats.learningCount + stats.reviewCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">SRS döngüsünde aktif</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Çalışma Serisi</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">{streakCount} Gün</p>
          <p className="text-[11px] text-amber-500/80 mt-1">Kesintisiz pratik</p>
        </div>
      </div>

      {/* 7 Günlük Tekrar Grafiği */}
      <ForecastChart data={forecast} />

      {/* Kategori ve Kelime Türü Dağılımları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YÖKDİL Alan Dağılımı */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">
            YÖKDİL Alan Dağılımı
          </h3>
          <div className="space-y-3">
            {Object.entries(categories).map(([name, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>{name}</span>
                    <span>{count} kelime (%{pct})</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kelime Türü Dağılımı */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">
            Dil Bilgisi / Kelime Türü Dağılımı
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(posCounts).map(([pos, count]) => (
              <div
                key={pos}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex justify-between items-center"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">{pos}</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
