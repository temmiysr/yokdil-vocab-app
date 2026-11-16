import React, { useState } from 'react';
import { Week, ReadingText } from '../../types/reading';
import { VocabCard } from '../../types/vocab';
import { VocabCardItem } from '../vocab/VocabCardItem';
import { deleteWeek } from '../../services/storage';
import { isCardDue } from '../../services/srs';
import {
  ArrowLeft,
  Calendar,
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface WeekDetailProps {
  week: Week;
  readings: ReadingText[];
  cards: VocabCard[];
  onBack: () => void;
  onSelectReading: (readingId: string) => void;
  onOpenUploadReading: () => void;
  onOpenAddWord: () => void;
  onEditWeek: (week: Week) => void;
  onEditCard: (card: VocabCard) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleDifficult: (cardId: string) => void;
  onWeekDeleted: () => void;
}

export const WeekDetail: React.FC<WeekDetailProps> = ({
  week,
  readings,
  cards,
  onBack,
  onSelectReading,
  onOpenUploadReading,
  onOpenAddWord,
  onEditWeek,
  onEditCard,
  onDeleteCard,
  onToggleDifficult,
  onWeekDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'readings' | 'words'>('readings');

  // Bu haftaya ait okuma parçaları ve kelimeler
  const weekReadings = readings.filter((r) => r.weekId === week.id);
  const weekCards = cards.filter(
    (c) => c.weekId === week.id || weekReadings.some((r) => r.savedWordIds.includes(c.id))
  );

  // Haftalık Metrikler (Kural 4)
  const totalWords = weekCards.length;
  const learnedWords = weekCards.filter((c) => c.srs.state === 'mastered').length;
  const pendingReviewWords = weekCards.filter((c) => isCardDue(c.srs)).length;
  const difficultWords = weekCards.filter((c) => c.isDifficult || c.srs.lapses >= 3).length;
  const learningPercentage = totalWords > 0 ? Math.round((learnedWords / totalWords) * 100) : 0;

  const handleDeleteWeek = () => {
    if (
      window.confirm(
        `"${week.title}" haftasını ve içerisindeki okuma parçalarını silmek istediğinize emin misiniz?`
      )
    ) {
      deleteWeek(week.id);
      onWeekDeleted();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Üst Başlık ve Yönetim */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Haftalık Listelerim'e Dön</span>
          </button>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {week.title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {week.startDate} {week.endDate ? `— ${week.endDate}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEditWeek(week)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition text-xs font-semibold flex items-center gap-1.5"
            title="Haftayı Yeniden Adlandır / Düzenle"
          >
            <Edit3 className="w-4 h-4" />
            <span className="hidden sm:inline">Düzenle</span>
          </button>
          <button
            onClick={handleDeleteWeek}
            className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition"
            title="Haftayı Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenUploadReading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Metin Yükle</span>
          </button>
        </div>
      </div>

      {/* 5 Haftalık İstatistik Kartı (Kural 4 gereği) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toplam Kelime</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalWords}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Öğrenilen</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{learnedWords}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Tekrar Bekleyen</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{pendingReviewWords}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Zorlandığım</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{difficultWords}</p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Öğrenme Yüzdesi</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">%{learningPercentage}</p>
        </div>
      </div>

      {/* Sekmeler: Okuma Parçaları vs. Seçilen Kelimeler */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-sm font-bold">
        <button
          onClick={() => setActiveTab('readings')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'readings'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Yüklenen Okuma Parçaları ({weekReadings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('words')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'words'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Seçilen Kelimeler ({weekCards.length})</span>
        </button>
      </div>

      {/* Okuma Parçaları Sekmesi */}
      {activeTab === 'readings' && (
        <div className="space-y-3">
          {weekReadings.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
              <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Bu haftaya henüz okuma parçası eklenmedi.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Çalıştığınız İngilizce metinleri PDF, Word, Görsel (OCR) veya metin olarak yükleyin.
              </p>
              <button
                onClick={onOpenUploadReading}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Okuma Metnini Yükle</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weekReadings.map((reading) => (
                <div
                  key={reading.id}
                  onClick={() => onSelectReading(reading.id)}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm cursor-pointer transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        {reading.category || 'Genel Akademik'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {reading.fileType.toUpperCase()}
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-slate-900 dark:text-white mt-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {reading.title}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-serif line-clamp-2 mt-2 leading-relaxed">
                      {reading.content}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>{reading.wordCount} kelime</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                      <span>Metni Aç ve Kelime Seç</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kelimeler Sekmesi */}
      {activeTab === 'words' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={onOpenAddWord}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bu Haftaya Kelime Ekle</span>
            </button>
          </div>

          {weekCards.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                Bu haftanın metinlerinden henüz kelime çıkarılmadı. Okuma metinlerinden birini açarak üzerine dokunup kelimeler ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weekCards.map((card) => (
                <VocabCardItem
                  key={card.id}
                  card={card}
                  onEdit={onEditCard}
                  onDelete={onDeleteCard}
                  onToggleDifficult={onToggleDifficult}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
