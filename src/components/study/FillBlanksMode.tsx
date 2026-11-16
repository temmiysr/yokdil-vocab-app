import React, { useState, useEffect } from 'react';
import { VocabCard } from '../../types/vocab';
import { speakEnglish } from '../../services/speech';
import {
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  HelpCircle,
  Trophy,
} from 'lucide-react';

interface FillBlanksModeProps {
  cards: VocabCard[];
}

export const FillBlanksMode: React.FC<FillBlanksModeProps> = ({ cards: initialCards }) => {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const validCards = initialCards.filter(
      (c) => c.originalSentence && c.originalSentence.toLowerCase().includes(c.english.toLowerCase())
    );
    setCards([...validCards].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setUserAnswer('');
    setIsAnswered(false);
    setShowHint(false);
    setScore(0);
    setFinished(false);
  }, [initialCards]);

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Boşluk doldurma için okuma parçalarından kaydedilmiş cümle içeren kelime bulunamadı.
      </div>
    );
  }

  const current = cards[currentIndex];

  // Hedef kelimeyi cümlede "_____" ile değiştir
  const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const blankedSentence = current.originalSentence.replace(
    new RegExp(`\\b${escapeRegex(current.english)}\\b`, 'gi'),
    '____________'
  );

  const handleCheckAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || isAnswered) return;

    const cleanInput = userAnswer.trim().toLowerCase();
    const cleanTarget = current.english.trim().toLowerCase();

    const correct = cleanInput === cleanTarget;
    setIsCorrect(correct);
    setIsAnswered(true);

    if (correct) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((i) => i + 1);
      setUserAnswer('');
      setIsAnswered(false);
      setShowHint(false);
    } else {
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Alıştırma Tamamlandı!</h3>
        <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
          %{Math.round((score / cards.length) * 100)}
        </p>
        <p className="text-xs text-slate-500">
          {cards.length} cümleden {score} tanesini doğru tamamladınız.
        </p>
        <button
          onClick={() => {
            setCards([...cards].sort(() => Math.random() - 0.5));
            setCurrentIndex(0);
            setUserAnswer('');
            setIsAnswered(false);
            setScore(0);
            setFinished(false);
          }}
          className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Yeniden Başla</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Cümle {currentIndex + 1} / {cards.length}</span>
        <span className="text-blue-600 dark:text-blue-400 font-bold">Skor: {score}</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
          Boşluğu Uygun Kelimeyle Doldurun
        </span>

        {/* Cümle */}
        <p className="text-base sm:text-lg font-serif italic text-slate-800 dark:text-slate-200 leading-relaxed text-center py-2">
          "{blankedSentence}"
        </p>

        {/* İpucu Bölümü (Türkçe Anlam) */}
        <div className="text-center">
          {showHint ? (
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg">
              İpucu (Türkçe Anlam): {current.turkish}
            </p>
          ) : (
            <button
              onClick={() => setShowHint(true)}
              className="text-xs text-slate-400 hover:text-blue-500 transition inline-flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Türkçe Anlam İpucunu Göster</span>
            </button>
          )}
        </div>

        {/* Cevap Formu */}
        <form onSubmit={handleCheckAnswer} className="space-y-3">
          <input
            type="text"
            disabled={isAnswered}
            placeholder="Eksik İngilizce kelimeyi buraya yazın..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-center text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            autoFocus
          />

          {!isAnswered ? (
            <button
              type="submit"
              disabled={!userAnswer.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md disabled:opacity-50 transition"
            >
              Cevabı Kontrol Et
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in">
              <div
                className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
                  isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300'
                }`}
              >
                <span>{isCorrect ? 'Tebrikler! Doğru cevap.' : `Doğru Cevap: ${current.english}`}</span>
                <button
                  type="button"
                  onClick={() => speakEnglish(current.english)}
                  className="p-1 hover:text-blue-600"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
              >
                <span>{currentIndex + 1 === cards.length ? 'Sonuçları Gör' : 'Sonraki Cümle'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
