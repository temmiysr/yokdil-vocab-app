import React, { useState } from 'react';
import { VocabCard } from '../../types/vocab';
import { speakEnglish } from '../../services/speech';
import {
  Volume2,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Shuffle,
  BookOpen,
} from 'lucide-react';

interface FlashcardsModeProps {
  cards: VocabCard[];
  isReverse?: boolean; // false = EN -> TR, true = TR -> EN
}

export const FlashcardsMode: React.FC<FlashcardsModeProps> = ({
  cards: initialCards,
  isReverse = false,
}) => {
  const [cards, setCards] = useState<VocabCard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Bu mod için uygun kelime bulunamadı.
      </div>
    );
  }

  const current = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setCards([...cards].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 select-none">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{isReverse ? 'Türkçeden İngilizceye' : 'Kelime Kartları (İngilizce → Türkçe)'}</span>
        <div className="flex items-center gap-3">
          <span>{currentIndex + 1} / {cards.length}</span>
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1 hover:text-blue-600 transition"
            title="Karıştır"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Karıştır</span>
          </button>
        </div>
      </div>

      {/* Kart */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="cursor-pointer min-h-[300px] bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between items-center text-center transition-all hover:shadow-2xl"
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            {current.partOfSpeech}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              speakEnglish(current.english);
            }}
            className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        <div className="my-auto py-6">
          {!isFlipped ? (
            // Ön Yüz
            <div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {isReverse ? current.turkish : current.english}
              </h3>
              {!isReverse && current.ipa && (
                <p className="text-xs text-slate-400 font-mono mt-2">/{current.ipa}/</p>
              )}
              <p className="text-xs text-slate-400 mt-4">
                (Çevirmek için dokunun)
              </p>
            </div>
          ) : (
            // Arka Yüz
            <div className="space-y-3 animate-in fade-in">
              <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                {isReverse ? current.english : current.turkish}
              </h3>
              {current.originalSentence && (
                <p className="text-xs text-slate-600 dark:text-slate-300 font-serif italic max-w-sm mx-auto">
                  "{current.originalSentence}"
                </p>
              )}
              {current.prepositions && current.prepositions.length > 0 && (
                <div className="flex gap-1 justify-center">
                  {current.prepositions.map((p, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      +{p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400">
          Ait Olduğu: {current.readingTitle || 'Kelime Bankası'}
        </span>
      </div>

      {/* Gezinme Düğmeleri */}
      <div className="flex gap-3">
        <button
          onClick={handlePrev}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Önceki</span>
        </button>
        <button
          onClick={handleNext}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
        >
          <span>Sonraki</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
