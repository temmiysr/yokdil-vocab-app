import React from 'react';
import { VocabCard } from '../../types/vocab';
import { speakEnglish } from '../../services/speech';
import {
  X,
  Volume2,
  Edit3,
  Calendar,
  CheckCircle,
  Tag,
  BookOpen,
} from 'lucide-react';

interface WordQuickInfoModalProps {
  card: VocabCard | null;
  onClose: () => void;
  onEdit: (card: VocabCard) => void;
}

export const WordQuickInfoModal: React.FC<WordQuickInfoModalProps> = ({
  card,
  onClose,
  onEdit,
}) => {
  if (!card) return null;

  const stateLabels: Record<string, { label: string; color: string }> = {
    new: { label: 'Yeni Kelime', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    learning: { label: 'Öğreniliyor', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    review: { label: 'Tekrar Aşamasında', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
    mastered: { label: 'Kalıcı Hafızada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  };

  const status = stateLabels[card.srs.state] || stateLabels.new;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-5 overflow-hidden">
        {/* Üst Bar */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {card.partOfSpeech}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Kelime ve Anlamı */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {card.english}
            </h3>
            <button
              onClick={() => speakEnglish(card.english)}
              className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
              title="Telaffuzu Dinle"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          {card.ipa && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              /{card.ipa}/
            </p>
          )}

          <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-2">
            {card.turkish}
          </p>
        </div>

        {/* Orijinal Cümle */}
        {card.originalSentence && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
            <p className="font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider mb-1">
              Metindeki Orijinal Cümlesi
            </p>
            <p className="text-slate-700 dark:text-slate-200 italic font-serif leading-relaxed">
              "{card.originalSentence}"
            </p>
            {card.sentenceTranslation && (
              <p className="text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                {card.sentenceTranslation}
              </p>
            )}
          </div>
        )}

        {/* Edatlar ve Kalıplar */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.prepositions?.map((prep, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
            >
              prep: +{prep}
            </span>
          ))}
          {card.collocations?.map((col, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            >
              {col}
            </span>
          ))}
        </div>

        {/* SRS Bilgisi */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Sonraki Tekrar: <b>{card.srs.nextReviewAt}</b></span>
          </div>
          <span>Aralık: {card.srs.interval} gün</span>
        </div>

        {/* Alt Butonlar */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              onClose();
              onEdit(card);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Kartı Düzenle</span>
          </button>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
