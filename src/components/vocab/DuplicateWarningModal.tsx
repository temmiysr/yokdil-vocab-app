import React from 'react';
import { VocabCard } from '../../types/vocab';
import { ReadingText } from '../../types/reading';
import {
  AlertTriangle,
  BookmarkPlus,
  Edit3,
  CopyPlus,
  X,
  BookOpen,
} from 'lucide-react';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCard: VocabCard;
  currentReading: ReadingText;
  newSentence: string;
  onAppendSource: () => void;
  onEditExisting: () => void;
  onCreateSeparate: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  onClose,
  existingCard,
  currentReading,
  newSentence,
  onAppendSource,
  onEditExisting,
  onCreateSeparate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Başlık */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Kelime Zaten Kayıtlı
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mükerrer kart oluşturmak yerine yeni bağlam ekleyebilirsiniz.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mevcut Kart ve Yeni Bağlam Karşılaştırması */}
        <div className="mt-4 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {existingCard.english}
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {existingCard.turkish}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              <span>İlk Kaynak: {existingCard.readingTitle || 'Daha Önceki Liste'}</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-1 font-serif">
              "{existingCard.originalSentence}"
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Yeni Okuma Metnindeki Kullanım ({currentReading.title})
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-200 italic mt-1 font-serif">
              "{newSentence}"
            </p>
          </div>
        </div>

        {/* Eylem Seçenekleri */}
        <div className="mt-5 space-y-2">
          {/* 1. Önerilen Seçenek */}
          <button
            onClick={() => {
              onAppendSource();
              onClose();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
          >
            <div className="flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4" />
              <span>(Önerilen) Mevcut Karta Yeni Örnek Cümle Olarak Ekle</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
              Tekrar Durumu Korunur
            </span>
          </button>

          {/* 2. Mevcut Kartı Düzenle */}
          <button
            onClick={() => {
              onEditExisting();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Mevcut Kartı Aç ve Bilgilerini Güncelle</span>
          </button>

          {/* 3. Yeni Ayrı Kart Oluştur */}
          <button
            onClick={() => {
              onCreateSeparate();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[11px] transition"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            <span>Yine de Bağımsız Yeni Kart Olarak Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
