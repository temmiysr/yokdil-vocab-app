import React, { useState } from 'react';
import { VocabCard } from '../../types/vocab';
import { Week, ReadingText } from '../../types/reading';
import { FlashcardsMode } from './FlashcardsMode';
import { MultipleChoiceMode } from './MultipleChoiceMode';
import { FillBlanksMode } from './FillBlanksMode';
import {
  GraduationCap,
  Layers,
  HelpCircle,
  Puzzle,
  AlertTriangle,
  Shuffle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export type StudyModeType =
  | 'menu'
  | 'flashcards_en_tr'
  | 'flashcards_tr_en'
  | 'multiple_choice'
  | 'fill_blanks'
  | 'collocations'
  | 'difficult'
  | 'mixed';

interface StudyHubProps {
  cards: VocabCard[];
  weeks: Week[];
  readings: ReadingText[];
  onCardUpdated: () => void;
}

export const StudyHub: React.FC<StudyHubProps> = ({
  cards,
  weeks,
  readings,
  onCardUpdated,
}) => {
  const [currentMode, setCurrentMode] = useState<StudyModeType>('menu');

  if (cards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <GraduationCap className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Sınav Modları İçin Kelime Havuzu Boş
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Önce bir okuma parçası yükleyip kelimeler seçebilir veya YÖKDİL Kelime Bankasına liste aktarabilirsiniz.
        </p>
      </div>
    );
  }

  // Mod Seçim Menüsü
  if (currentMode === 'menu') {
    const studyModes = [
      {
        id: 'flashcards_en_tr' as StudyModeType,
        title: 'Kelime Kartları (İngilizce → Türkçe)',
        desc: 'İngilizce kelime ve telaffuz gösterilir, tahmin edip kartı çevirirsiniz.',
        icon: Layers,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/50',
      },
      {
        id: 'flashcards_tr_en' as StudyModeType,
        title: 'Türkçeden İngilizceye',
        desc: 'Türkçe anlam gösterilir, İngilizce karşılığını bulmaya çalışırsınız.',
        icon: Shuffle,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/50',
      },
      {
        id: 'multiple_choice' as StudyModeType,
        title: 'Çoktan Seçmeli Sınav',
        desc: '4 şıklı sınav. Çeldiriciler gerçek kelime havuzunuzdan otomatik seçilir.',
        icon: HelpCircle,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      },
      {
        id: 'fill_blanks' as StudyModeType,
        title: 'Boşluk Doldurma (Cümle İçi)',
        desc: 'Okuma metinlerinizdeki orijinal cümlelerden hedef kelime çıkarılır.',
        icon: Puzzle,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/50',
      },
      {
        id: 'collocations' as StudyModeType,
        title: 'Kalıp İfade ve Edat Çalışması',
        desc: 'Edatlı yapılar (+on, +to) ve akademik kelime birliktelikleri (collocations).',
        icon: Sparkles,
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/50',
      },
      {
        id: 'difficult' as StudyModeType,
        title: 'Zorlandığım Kelimeler',
        desc: 'Sık hata yapılan veya zor olarak işaretlenen kelimelere odaklanın.',
        icon: AlertTriangle,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/50',
      },
      {
        id: 'mixed' as StudyModeType,
        title: 'Karma Tekrar Sınavı',
        desc: 'Farklı haftalardaki tüm kelimeler rastgele karma şekilde sorulur.',
        icon: GraduationCap,
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/50',
      },
    ];

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            YÖKDİL Sınav ve Çalışma Modları
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Farklı yöntemlerle hafızanızı test edin ve çok yönlü pekiştirme sağlayın.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {studyModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <div
                key={mode.id}
                onClick={() => setCurrentMode(mode.id)}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm cursor-pointer transition flex items-start gap-4 group"
              >
                <div className={`p-3 rounded-xl ${mode.bg} ${mode.color} shrink-0`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {mode.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {mode.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Seçilen Modun Render Edilmesi
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <button
        onClick={() => setCurrentMode('menu')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition mb-2"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Sınav Modları Menüsüne Dön</span>
      </button>

      {currentMode === 'flashcards_en_tr' && (
        <FlashcardsMode cards={cards} isReverse={false} />
      )}
      {currentMode === 'flashcards_tr_en' && (
        <FlashcardsMode cards={cards} isReverse={true} />
      )}
      {currentMode === 'multiple_choice' && (
        <MultipleChoiceMode cards={cards} />
      )}
      {currentMode === 'fill_blanks' && (
        <FillBlanksMode cards={cards.filter((c) => c.originalSentence)} />
      )}
      {currentMode === 'collocations' && (
        <MultipleChoiceMode
          cards={cards.filter(
            (c) =>
              c.partOfSpeech === 'collocation' ||
              c.partOfSpeech === 'prepositional_phrase' ||
              (c.prepositions && c.prepositions.length > 0) ||
              (c.collocations && c.collocations.length > 0)
          )}
        />
      )}
      {currentMode === 'difficult' && (
        <MultipleChoiceMode
          cards={cards.filter((c) => c.isDifficult || c.srs.lapses >= 3)}
        />
      )}
      {currentMode === 'mixed' && (
        <MultipleChoiceMode
          cards={[...cards].sort(() => Math.random() - 0.5)}
        />
      )}
    </div>
  );
};
