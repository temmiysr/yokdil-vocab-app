import React from 'react';

interface ForecastItem {
  date: string;
  dayName: string;
  count: number;
}

interface ForecastChartProps {
  data: ForecastItem[];
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ data }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 5);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            Önümüzdeki 7 Günün Tekrar Yükü
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Spaced repetition algoritması tarafından planlanan günlük kelime sayıları
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold">
          7 Günlük Tahmin
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 pt-6">
        {data.map((item, index) => {
          const heightPercent = Math.max(12, Math.round((item.count / maxCount) * 100));
          const isToday = index === 0;

          return (
            <div key={item.date} className="flex flex-col items-center h-full justify-end group">
              {/* Sayı Rozeti */}
              <span
                className={`text-[11px] font-bold mb-1.5 transition-transform group-hover:scale-110 ${
                  isToday
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.count}
              </span>

              {/* Çubuk */}
              <div className="w-full max-w-[42px] bg-slate-100 dark:bg-slate-800/80 rounded-t-lg h-full flex items-end p-1">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all duration-500 shadow-sm ${
                    isToday
                      ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-blue-500/20'
                      : item.count > 0
                      ? 'bg-gradient-to-t from-slate-400 to-slate-300 dark:from-slate-700 dark:to-slate-600 group-hover:from-blue-400 group-hover:to-blue-300'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              </div>

              {/* Gün Adı */}
              <span
                className={`text-[11px] font-medium mt-2 ${
                  isToday
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.dayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
