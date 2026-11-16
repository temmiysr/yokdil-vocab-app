import React, { useState, useEffect } from 'react';
import { VocabCard } from '../../types/vocab';
import { speakEnglish } from '../../services/speech';
import {
  Volume2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
} from 'lucide-react';

interface MultipleChoiceModeProps {
  cards: VocabCard[];
}

interface Question {
  card: VocabCard;
  options: string[];
  correctAnswer: string;
}

export const MultipleChoiceMode: React.FC<MultipleChoiceModeProps> = ({ cards }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    generateQuiz();
  }, [cards]);

  const generateQuiz = () => {
    if (cards.length < 2) return;

    // Kartları karıştır
    const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, 15);

    const generated: Question[] = shuffled.map((targetCard) => {
      // Çeldiricileri gerçek kelime havuzundan seç
      const otherCards = cards.filter((c) => c.id !== targetCard.id && c.turkish !== targetCard.turkish);
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5).slice(0, 3);
      const distractors = shuffledOthers.map((c) => c.turkish);

      // 4 seçenek oluştur
      const options = [targetCard.turkish, ...distractors].sort(() => Math.random() - 0.5);

      return {
        card: targetCard,
        options,
        correctAnswer: targetCard.turkish,
      };
    });

    setQuestions(generated);
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setFinished(false);
  };

  if (cards.length < 2) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Çoktan seçmeli test için kelime havuzunuzda en az 2 kelime olmalıdır.
      </div>
    );
  }

  if (questions.length === 0) return null;

  if (finished) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sınav Tamamlandı!</h3>
        <p className="text-3xl font-black text-blue-600 dark:text-blue-400">%{percent}</p>
        <p className="text-xs text-slate-500">
          {questions.length} sorudan {score} tanesini doğru yanıtladınız.
        </p>
        <button
          onClick={generateQuiz}
          className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Yeniden Test Çöz</span>
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  const handleSelectOption = (option: string) => {
    if (selectedOption !== null) return;

    setSelectedOption(option);
    if (option === currentQ.correctAnswer) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
    } else {
      setFinished(true);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* İlerleme ve Skor */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>Soru {currentIndex + 1} / {questions.length}</span>
        <span className="text-blue-600 dark:text-blue-400">Skor: {score}</span>
      </div>

      {/* Soru Kartı */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
          {currentQ.card.partOfSpeech}
        </span>

        <div className="flex items-center justify-center gap-2">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {currentQ.card.english}
          </h3>
          <button
            onClick={() => speakEnglish(currentQ.card.english)}
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 hover:bg-blue-100"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {currentQ.card.ipa && (
          <p className="text-xs text-slate-400 font-mono">/{currentQ.card.ipa}/</p>
        )}

        <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
          Bu ifadenin en uygun Türkçe karşılığını seçiniz:
        </p>

        {/* 4 Şık */}
        <div className="grid grid-cols-1 gap-2.5 pt-2 text-left">
          {currentQ.options.map((opt, i) => {
            const isSelected = selectedOption === opt;
            const isCorrect = opt === currentQ.correctAnswer;
            let btnClass = 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-400';

            if (selectedOption !== null) {
              if (isCorrect) {
                btnClass = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-300 font-bold';
              } else if (isSelected) {
                btnClass = 'bg-red-50 dark:bg-red-950/60 border-red-400 text-red-800 dark:text-red-300';
              } else {
                btnClass = 'opacity-40 border-slate-200 dark:border-slate-800';
              }
            }

            return (
              <button
                key={i}
                disabled={selectedOption !== null}
                onClick={() => handleSelectOption(opt)}
                className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition flex items-center justify-between ${btnClass}`}
              >
                <span>{opt}</span>
                {selectedOption !== null && isCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />
                )}
                {selectedOption !== null && isSelected && !isCorrect && (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Sonraki Soru Düğmesi */}
        {selectedOption !== null && (
          <div className="pt-2 animate-in fade-in">
            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
            >
              <span>{currentIndex + 1 === questions.length ? 'Sonuçları Gör' : 'Sonraki Soru'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
