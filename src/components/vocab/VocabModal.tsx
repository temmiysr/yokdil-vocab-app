import React, { useState, useEffect } from 'react';
import { VocabCard, PartOfSpeech } from '../../types/vocab';
import { Week, ReadingText } from '../../types/reading';
import { saveVocabCard } from '../../services/storage';
import { speakEnglish } from '../../services/speech';
import { analyzeVocabularyWithAI } from '../../services/aiService';
import {
  X,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Tag,
  BookOpen,
  Calendar,
  Layers,
  Loader2,
} from 'lucide-react';

interface VocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToEdit?: VocabCard | null;
  initialEnglish?: string;
  initialSentence?: string;
  initialReading?: ReadingText;
  initialWeek?: Week;
  weeks: Week[];
  readings: ReadingText[];
  onSaved: (card: VocabCard) => void;
}

export const VocabModal: React.FC<VocabModalProps> = ({
  isOpen,
  onClose,
  cardToEdit,
  initialEnglish = '',
  initialSentence = '',
  initialReading,
  initialWeek,
  weeks,
  readings,
  onSaved,
}) => {
  // Form State (12 Alan)
  const [english, setEnglish] = useState('');
  const [turkish, setTurkish] = useState('');
  const [ipa, setIpa] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>('noun');
  const [lemma, setLemma] = useState('');
  const [originalSentence, setOriginalSentence] = useState('');
  const [sentenceTranslation, setSentenceTranslation] = useState('');
  const [prepositions, setPrepositions] = useState<string[]>([]);
  const [prepInput, setPrepInput] = useState('');
  const [collocations, setCollocations] = useState<string[]>([]);
  const [collocInput, setCollocInput] = useState('');
  const [academicUsage, setAcademicUsage] = useState('Genel Akademik');
  const [readingId, setReadingId] = useState<string>('');
  const [weekId, setWeekId] = useState<string>('');
  const [isDifficult, setIsDifficult] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cardToEdit) {
      setEnglish(cardToEdit.english);
      setTurkish(cardToEdit.turkish);
      setIpa(cardToEdit.ipa || '');
      setPartOfSpeech(cardToEdit.partOfSpeech);
      setLemma(cardToEdit.lemma || '');
      setOriginalSentence(cardToEdit.originalSentence);
      setSentenceTranslation(cardToEdit.sentenceTranslation || '');
      setPrepositions(cardToEdit.prepositions || []);
      setCollocations(cardToEdit.collocations || []);
      setAcademicUsage(cardToEdit.academicUsage || 'Genel Akademik');
      setReadingId(cardToEdit.readingId || '');
      setWeekId(cardToEdit.weekId || '');
      setIsDifficult(cardToEdit.isDifficult || false);
    } else {
      setEnglish(initialEnglish);
      setTurkish('');
      setIpa('');
      setPartOfSpeech(guessInitialPOS(initialEnglish));
      setLemma('');
      setOriginalSentence(initialSentence);
      setSentenceTranslation('');
      setPrepositions([]);
      setCollocations([]);
      setAcademicUsage(initialReading?.category || 'Genel Akademik');
      setReadingId(initialReading?.id || '');
      setWeekId(initialWeek?.id || initialReading?.weekId || '');
      setIsDifficult(false);
    }
    setError(null);
    setAiSuccessMsg(null);
  }, [cardToEdit, initialEnglish, initialSentence, initialReading, initialWeek, isOpen]);

  if (!isOpen) return null;

  function guessInitialPOS(text: string): PartOfSpeech {
    const words = text.trim().split(/\s+/);
    if (words.length > 2) return 'collocation';
    if (words.length === 2) {
      if (['in', 'on', 'at', 'by', 'for', 'with', 'about', 'to'].includes(words[0].toLowerCase())) {
        return 'prepositional_phrase';
      }
      return 'collocation';
    }
    if (text.endsWith('tion') || text.endsWith('ment') || text.endsWith('ness') || text.endsWith('ity')) return 'noun';
    if (text.endsWith('ly')) return 'adverb';
    if (text.endsWith('able') || text.endsWith('ive') || text.endsWith('al') || text.endsWith('ous')) return 'adjective';
    return 'noun';
  }

  // Preposition Ekleme / Silme
  const handleAddPrep = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = prepInput.trim().replace(/^\+/, '');
    if (clean && !prepositions.includes(clean)) {
      setPrepositions([...prepositions, clean]);
      setPrepInput('');
    }
  };

  const handleRemovePrep = (prep: string) => {
    setPrepositions(prepositions.filter((p) => p !== prep));
  };

  // Collocation Ekleme / Silme
  const handleAddColloc = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = collocInput.trim();
    if (clean && !collocations.includes(clean)) {
      setCollocations([...collocations, clean]);
      setCollocInput('');
    }
  };

  const handleRemoveColloc = (col: string) => {
    setCollocations(collocations.filter((c) => c !== col));
  };

  // İsteğe Bağlı Yapay Zekâ Destek Butonu (Kullanıcı onayına sunulur)
  const handleAIAssist = async () => {
    if (!english.trim()) {
      setError('Lütfen önce bir İngilizce kelime veya ifade giriniz.');
      return;
    }
    setError(null);
    setAiLoading(true);
    setAiSuccessMsg(null);

    try {
      const res = await analyzeVocabularyWithAI(english, originalSentence);
      if (res) {
        if (!turkish.trim()) setTurkish(res.turkish);
        if (res.ipa) setIpa(res.ipa);
        if (res.partOfSpeech) setPartOfSpeech(res.partOfSpeech);
        if (res.lemma) setLemma(res.lemma);
        if (res.sentenceTranslation) setSentenceTranslation(res.sentenceTranslation);
        if (res.prepositions && res.prepositions.length > 0) {
          const mergedPreps = Array.from(new Set([...prepositions, ...res.prepositions]));
          setPrepositions(mergedPreps);
        }
        if (res.collocations && res.collocations.length > 0) {
          const mergedCollocs = Array.from(new Set([...collocations, ...res.collocations]));
          setCollocations(mergedCollocs);
        }
        if (res.academicUsage) setAcademicUsage(res.academicUsage);

        setAiSuccessMsg('Yapay zekâ önerileri forma aktarıldı. Lütfen kontrol edip dilediğiniz alanı değiştirin.');
      } else {
        setError('Yapay zekâ anahtarı girilmemiş veya sonuç alınamadı. Ayarlar ekranından Gemini / OpenAI API anahtarınızı ekleyebilirsiniz.');
      }
    } catch (err: any) {
      setError('AI Çözümleme hatası: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!english.trim()) {
      setError('İngilizce kelime veya ifade boş bırakılamaz.');
      return;
    }
    if (!turkish.trim()) {
      setError('Lütfen Türkçe anlamı giriniz.');
      return;
    }

    const matchedReading = readings.find((r) => r.id === readingId);
    const matchedWeek = weeks.find((w) => w.id === weekId);

    const saved = saveVocabCard({
      id: cardToEdit ? cardToEdit.id : undefined,
      english: english.trim(),
      turkish: turkish.trim(),
      ipa: ipa.trim() || undefined,
      partOfSpeech,
      lemma: lemma.trim() || undefined,
      originalSentence: originalSentence.trim() || `Example sentence for ${english.trim()}.`,
      sentenceTranslation: sentenceTranslation.trim() || undefined,
      prepositions: prepositions.length > 0 ? prepositions : undefined,
      collocations: collocations.length > 0 ? collocations : undefined,
      academicUsage: academicUsage.trim(),
      readingId: readingId || undefined,
      readingTitle: matchedReading?.title || cardToEdit?.readingTitle || undefined,
      weekId: weekId || undefined,
      weekTitle: matchedWeek?.title || cardToEdit?.weekTitle || undefined,
      sourceType: cardToEdit?.sourceType || (readingId ? 'user_reading' : 'user_yokdil_list'),
      isDifficult,
      srs: cardToEdit?.srs,
    });

    onSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Üst Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {cardToEdit ? 'Kelime Kartını Düzenle' : 'Kelime Listeme Ekle'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                12 Alanlı Kapsamlı Akademik Öğrenme Kartı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Alanı */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aiSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{aiSuccessMsg}</span>
            </div>
          )}

          {/* 1. İngilizce Kelime & Dinleme & AI Önerisi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                1. İngilizce Kelime veya Çoklu İfade <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAIAssist}
                disabled={aiLoading || !english.trim()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-500" />
                )}
                <span>AI ile Çözümle (İsteğe Bağlı)</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Örn: shortage of natural resources veya significantly"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                className="w-full pl-3 pr-10 py-2 rounded-lg text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => speakEnglish(english)}
                className="absolute right-2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 transition"
                title="Telaffuzu Dinle"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Türkçe Anlam & 3. IPA Telaffuz */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                2. Türkçe Anlamı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Örn: doğal kaynakların kıtlığı"
                value={turkish}
                onChange={(e) => setTurkish(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                3. Telaffuz Fonetiği (IPA)
              </label>
              <input
                type="text"
                placeholder="Örn: /ˈʃɔːtɪdʒ əv ˈnætʃrəl rɪˈsɔːsɪz/"
                value={ipa}
                onChange={(e) => setIpa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* 4. Kelime Türü & 5. Temel Biçim (Lemma) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                4. Kelime / İfade Türü
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value as PartOfSpeech)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="noun">İsim (Noun)</option>
                <option value="verb">Fiil (Verb)</option>
                <option value="adjective">Sıfat (Adjective)</option>
                <option value="adverb">Zarf (Adverb)</option>
                <option value="phrasal_verb">Öbek Fiil (Phrasal Verb)</option>
                <option value="prepositional_phrase">Edatlı Yapı (Prepositional Phrase)</option>
                <option value="collocation">Kalıp İfade / Birliktelik (Collocation)</option>
                <option value="idiom">Deyim (Idiom)</option>
                <option value="conjunction">Bağlaç (Conjunction)</option>
                <option value="other">Diğer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                5. Temel Biçim / Kök (Lemma)
              </label>
              <input
                type="text"
                placeholder="Örn: shortage / advance"
                value={lemma}
                onChange={(e) => setLemma(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* 6. Okuma Parçasındaki Orijinal Cümlesi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              6. Okuma Parçasındaki Orijinal Cümlesi
            </label>
            <textarea
              rows={2}
              placeholder="Cümle okuma metninden otomatik çekilir veya elle girilebilir..."
              value={originalSentence}
              onChange={(e) => setOriginalSentence(e.target.value)}
              className="w-full p-2.5 rounded-lg text-xs font-serif bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 leading-relaxed"
            />
          </div>

          {/* 7. Cümlenin Türkçe Çevirisi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              7. Cümlenin Türkçe Çevirisi
            </label>
            <input
              type="text"
              placeholder="Örn: Ancak doğal kaynakların kıtlığı büyük bir zorluk olmaya devam etmektedir."
              value={sentenceTranslation}
              onChange={(e) => setSentenceTranslation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* 8. Birlikte Kullanıldığı Edatlar (Prepositions) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              8. Birlikte Kullanıldığı Edatlar
            </label>
            <div className="flex gap-2 mb-1.5">
              <input
                type="text"
                placeholder="Örn: of, in, for (Enter'a basın)"
                value={prepInput}
                onChange={(e) => setPrepInput(e.target.value)}
                onKeyDown={handleAddPrep}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleAddPrep}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Ekle
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {prepositions.map((prep) => (
                <span
                  key={prep}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                >
                  +{prep}
                  <button
                    type="button"
                    onClick={() => handleRemovePrep(prep)}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 9. Yaygın Kelime Birliktelikleri (Collocations) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              9. Yaygın Kelime Birliktelikleri (Collocations)
            </label>
            <div className="flex gap-2 mb-1.5">
              <input
                type="text"
                placeholder="Örn: severe shortage, major challenge (Enter'a basın)"
                value={collocInput}
                onChange={(e) => setCollocInput(e.target.value)}
                onKeyDown={handleAddColloc}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleAddColloc}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Ekle
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {collocations.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                >
                  {col}
                  <button
                    type="button"
                    onClick={() => handleRemoveColloc(col)}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 10. İlgili Akademik Kullanım & 11. Hafta ve Okuma Parçası İlişkisi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                10. Akademik Kullanım Alanı
              </label>
              <select
                value={academicUsage}
                onChange={(e) => setAcademicUsage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="Fen Bilimleri">Fen Bilimleri</option>
                <option value="Sağlık Bilimleri">Sağlık Bilimleri</option>
                <option value="Sosyal Bilimler">Sosyal Bilimler</option>
                <option value="Genel Akademik">Genel Akademik</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                11. Ait Olduğu Hafta / Parça
              </label>
              <div className="text-xs text-slate-600 dark:text-slate-400 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 truncate">
                {readings.find((r) => r.id === readingId)?.title || 'Genel / Havuz'}
              </div>
            </div>
          </div>

          {/* 12. Zorlandığım Kelime Olarak İşaretle */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isDifficult}
                onChange={(e) => setIsDifficult(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-400"
              />
              <span>Bu kelimeyi "Zorlandığım Kelimeler" listesine ekle</span>
            </label>
          </div>
        </form>

        {/* Alt Butonlar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{cardToEdit ? 'Değişiklikleri Kaydet' : 'Kelimeyi Listeme Kaydet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
