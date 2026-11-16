import React, { useState } from 'react';
import { VocabCard } from '../../types/vocab';
import { SRSRating } from '../../types/srs';
import { processReview, getDueCards } from '../../services/srs';
import { saveVocabCard } from '../../services/storage';
import { ReviewCard } from './ReviewCard';
import { ActiveTab } from '../../types';
import {
  RotateCw,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Trophy,
} from 'lucide-react';

interface DailyReviewProps {
  cards: VocabCard[];
  setActiveTab: (tab: ActiveTab) => void;
  onCardReviewed: () => void;
}

export const DailyReview: React.FC<DailyReviewProps> = ({
  cards,
  setActiveTab,
  onCardReviewed,
}) => {
  const dueCards = getDueCards(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const handleRateCard = (rating: SRSRating) => {
    if (currentIndex >= dueCards.length) return;

    const currentCard = dueCards[currentIndex];
    const updatedSRS = processReview(currentCard.srs, rating);

    // Otomatik Leech / Zorluk kontrolü: 3 veya daha fazla hata yapılırsa kart zor olarak işaretlenir
    const isNowDifficult = currentCard.isDifficult || updatedSRS.lapses >= 3;

    saveVocabCard({
      ...currentCard,
      isDifficult: isNowDifficult,
      srs: updatedSRS,
    });

    // İstatistik güncelle
    setSessionStats((prev) => ({
      ...prev,
      again: rating === 1 ? prev.again + 1 : prev.again,
      hard: rating === 2 ? prev.hard + 1 : prev.hard,
      good: rating === 3 ? prev.good + 1 : prev.good,
      easy: rating === 4 ? prev.easy + 1 : prev.easy,
    }));

    onCardReviewed();

    if (currentIndex + 1 < dueCards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSessionCompleted(true);
      // Konfeti patlat
      if ((window as any).confetti) {
        (window as any).confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    }
  };

  // Eğer bugün tekrar edilecek kart yoksa veya oturum tamamlandıysa
  if (dueCards.length === 0 || sessionCompleted) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <Trophy className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Tebrikler!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bugünlük aralıklı tekrar programınız tamamlandı.
          </p>
        </div>

        {/* Oturum İstatistikleri */}
        {sessionCompleted && (
          <div className="grid grid-cols-4 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center">
            <div>
              <p className="text-base font-bold text-red-600 dark:text-red-400">{sessionStats.again}</p>
              <p className="text-[10px] text-slate-400 font-medium">Tekrar</p>
            </div>
            <div>
              <p className="text-base font-bold text-amber-600 dark:text-amber-400">{sessionStats.hard}</p>
              <p className="text-[10px] text-slate-400 font-medium">Zor</p>
            </div>
            <div>
              <p className="text-base font-bold text-blue-600 dark:text-blue-400">{sessionStats.good}</p>
              <p className="text-[10px] text-slate-400 font-medium">İyi</p>
            </div>
            <div>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{sessionStats.easy}</p>
              <p className="text-[10px] text-slate-400 font-medium">Kolay</p>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('study')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>Sınav ve Test Modlarında Pratik Yap</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="w-full py-2.5 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  return (
    <div className="py-4">
      <ReviewCard
        card={currentCard}
        onRate={handleRateCard}
        currentIndex={currentIndex}
        totalCards={dueCards.length}
      />
    </div>
  );
};
