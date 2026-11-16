import React from 'react';
import { VocabCard } from '../../types/vocab';
import { speakEnglish } from '../../services/speech';
import {
  Volume2,
  AlertTriangle,
  Edit3,
  Trash2,
  Calendar,
  Layers,
  BookOpen,
} from 'lucide-react';

interface VocabCardItemProps {
  card: VocabCard;
  onEdit: (card: VocabCard) => void;
  onDelete: (cardId: string) => void;
  onToggleDifficult: (cardId: string) => void;
}

export const VocabCardItem: React.FC<VocabCardItemProps> = ({
  card,
  onEdit,
  onDelete,
  onToggleDifficult,
}) => {
  const stateBadges: Record<string, { label: string; bg: string; text: string }> = {
    new: { label: 'Yeni', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300' },
    learning: { label: 'Öğreniliyor', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300' },
    review: { label: 'Tekrarda', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300' },
    mastered: { label: 'Öğrenildi', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300' },
  };

  const badge = stateBadges[card.srs.state] || stateBadges.new;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition flex flex-col justify-between group">
      <div>
        {/* Üst Satır: Tür & SRS Durumu & Zorluk */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {card.partOfSpeech}
            </span>
            {card.academicUsage && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-ellipsis max-w-[100px] truncate">
                {card.academicUsage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleDifficult(card.id)}
              className={`p-1 rounded-md transition ${
                card.isDifficult || card.srs.lapses >= 3
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
              }`}
              title="Zorlandığım Kelime Olarak İşaretle"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onEdit(card)}
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 transition"
              title="Düzenle"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`"${card.english}" kelimesini silmek istediğinize emin misiniz?`)) {
                  onDelete(card.id);
                }
              }}
              className="p-1 rounded-md text-slate-400 hover:text-red-600 transition"
              title="Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* İngilizce Kelime & Dinle */}
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
              {card.english}
            </h4>
            {card.ipa && (
              <span className="text-xs text-slate-400 font-mono">
                /{card.ipa}/
              </span>
            )}
          </div>
          <button
            onClick={() => speakEnglish(card.english)}
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition shrink-0"
            title="Telaffuz"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {/* Türkçe Anlamı */}
        <p className="mt-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
          {card.turkish}
        </p>

        {/* Orijinal Cümle */}
        {card.originalSentence && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 italic font-serif line-clamp-2">
            "{card.originalSentence}"
          </p>
        )}

        {/* Edatlar ve Kalıplar */}
        <div className="mt-2 flex flex-wrap gap-1">
          {card.prepositions?.map((p, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
            >
              +{p}
            </span>
          ))}
          {card.collocations?.map((c, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Alt Bilgi: Kaynak & SRS Tekrar Tarihi */}
      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[130px] flex items-center gap-1">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>{card.readingTitle || 'Kelime Bankası'}</span>
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{card.srs.nextReviewAt} ({card.srs.interval}g)</span>
        </span>
      </div>
    </div>
  );
};
