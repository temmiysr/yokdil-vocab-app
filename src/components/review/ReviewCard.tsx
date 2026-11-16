import React, { useState, useEffect } from 'react';
import { VocabCard } from '../../types/vocab';
import { SRSRating } from '../../types/srs';
import { speakEnglish } from '../../services/speech';
import {
  Volume2,
  Eye,
  RotateCcw,
  Sparkles,
  BookOpen,
  Calendar,
  AlertTriangle,
  Tag,
} from 'lucide-react';

interface ReviewCardProps {
  card: VocabCard;
  onRate: (rating: SRSRating) => void;
  currentIndex: number;
  totalCards: number;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  card,
  onRate,
  currentIndex,
  totalCards,
}) => {
  const [revealed, setRevealed] = useState(false);

  // Kart değiştiğinde cevabı gizle
  useEffect(() => {
    setRevealed(false);
  }, [card.id]);

  // Klavye kısayolları (Space: Göster, 1,2,3,4: Değerlendir)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!revealed && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        if (e.key === '1') {
          e.preventDefault();
          onRate(1);
        } else if (e.key === '2') {
          e.preventDefault();
          onRate(2);
        } else if (e.key === '3') {
          e.preventDefault();
          onRate(3);
        } else if (e.key === '4') {
          e.preventDefault();
          onRate(4);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revealed, onRate]);

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* İlerleme Çubuğu */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>Kart {currentIndex + 1} / {totalCards}</span>
        <span>Aralık: {card.srs.interval} gün | Çarpan: {card.srs.easeFactor}</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.round(((currentIndex + 1) / totalCards) * 100)}%` }}
        />
      </div>

      {/* Ana Çalışma Kartı */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all">
        {/* Kart Üst Bilgisi */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {card.partOfSpeech}
            </span>
            {card.academicUsage && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {card.academicUsage}
              </span>
            )}
          </div>
          <button
            onClick={() => speakEnglish(card.english)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 transition"
            title="Telaffuzu Dinle"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Dinle</span>
          </button>
        </div>

        {/* ÖN YÜZ: İngilizce Kelime / İfade */}
        <div className="p-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {card.english}
          </h2>

          {card.ipa && (
            <p className="text-sm text-slate-400 font-mono mt-2">
              /{card.ipa}/
            </p>
          )}

          {/* İpucu: Kök (Lemma) */}
          {card.lemma && card.lemma !== card.english && (
            <p className="text-xs text-slate-400 mt-1">
              Kök: <span className="font-semibold text-slate-600 dark:text-slate-300">{card.lemma}</span>
            </p>
          )}
        </div>

        {/* ARKA YÜZ (Gizli / Açılır Bölüm) */}
        {revealed ? (
          <div className="p-6 bg-slate-50/70 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
            {/* Türkçe Anlam */}
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Türkçe Anlamı
              </span>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {card.turkish}
              </p>
            </div>

            {/* Orijinal Cümle ve Çeviri */}
            {card.originalSentence && (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span>Metindeki Orijinal Cümlesi</span>
                </p>
                <p className="text-slate-800 dark:text-slate-200 font-serif italic leading-relaxed text-sm">
                  "{card.originalSentence}"
                </p>
                {card.sentenceTranslation && (
                  <p className="text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {card.sentenceTranslation}
                  </p>
                )}
              </div>
            )}

            {/* Edatlar ve Kalıplar */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {card.prepositions?.map((p, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                >
                  +{p}
                </span>
              ))}
              {card.collocations?.map((c, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={() => setRevealed(true)}
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
            >
              <Eye className="w-5 h-5" />
              <span>Anlamını Göster (Boşluk Tuşu)</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Değerlendirme Butonu */}
      {revealed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 animate-in fade-in">
          {/* 1: Tekrar */}
          <button
            onClick={() => onRate(1)}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 transition group active:scale-95"
          >
            <span className="font-extrabold text-sm">Tekrar [1]</span>
            <span className="text-[11px] text-red-600/80 dark:text-red-400 mt-0.5">Hatırlayamadım</span>
            <span className="text-[10px] text-slate-400 mt-1">1 Gün</span>
          </button>

          {/* 2: Zor */}
          <button
            onClick={() => onRate(2)}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 transition group active:scale-95"
          >
            <span className="font-extrabold text-sm">Zor [2]</span>
            <span className="text-[11px] text-amber-600/80 dark:text-amber-400 mt-0.5">Zor hatırladım</span>
            <span className="text-[10px] text-slate-400 mt-1">1-2 Gün</span>
          </button>

          {/* 3: İyi */}
          <button
            onClick={() => onRate(3)}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 transition group active:scale-95"
          >
            <span className="font-extrabold text-sm">İyi [3]</span>
            <span className="text-[11px] text-blue-600/80 dark:text-blue-400 mt-0.5">Hatırladım</span>
            <span className="text-[10px] text-slate-400 mt-1">Standart</span>
          </button>

          {/* 4: Kolay */}
          <button
            onClick={() => onRate(4)}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 transition group active:scale-95"
          >
            <span className="font-extrabold text-sm">Kolay [4]</span>
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">Çok iyi biliyorum</span>
            <span className="text-[10px] text-slate-400 mt-1">Geniş Aralık</span>
          </button>
        </div>
      )}
    </div>
  );
};
