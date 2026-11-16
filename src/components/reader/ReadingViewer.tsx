import React, { useState, useRef, useEffect } from 'react';
import { ReadingText, Week } from '../../types/reading';
import { VocabCard } from '../../types/vocab';
import { extractSentenceForSelection, findDuplicateCard, segmentTextWithSavedWords } from '../../utils/sentenceExtractor';
import { SelectionPopover } from './SelectionPopover';
import { WordQuickInfoModal } from './WordQuickInfoModal';
import { VocabModal } from '../vocab/VocabModal';
import { DuplicateWarningModal } from '../vocab/DuplicateWarningModal';
import { appendSourceToCard, deleteReading } from '../../services/storage';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  BookmarkPlus,
  Trash2,
  FileText,
} from 'lucide-react';

interface ReadingViewerProps {
  reading: ReadingText;
  week?: Week;
  allCards: VocabCard[];
  allWeeks: Week[];
  allReadings: ReadingText[];
  onBack: () => void;
  onRefreshCards: () => void;
  onReadingDeleted: () => void;
}

export const ReadingViewer: React.FC<ReadingViewerProps> = ({
  reading,
  week,
  allCards,
  allWeeks,
  allReadings,
  onBack,
  onRefreshCards,
  onReadingDeleted,
}) => {
  // Seçim ve Popover State
  const [selectedText, setSelectedText] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Modallar
  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [quickInfoCard, setQuickInfoCard] = useState<VocabCard | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateCard, setDuplicateCard] = useState<VocabCard | null>(null);
  const [editingCard, setEditingCard] = useState<VocabCard | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  // Bu okuma parçasında kaydedilmiş veya genel havuzdaki kartlar
  const savedCardsForReading = allCards.filter(
    (c) => reading.savedWordIds.includes(c.id) || c.readingId === reading.id
  );

  // Kullanıcı metin seçtiğinde tetiklenir (Fare ve Dokunmatik Ekran)
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopoverPos(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setPopoverPos(null);
      setSelectedText('');
      return;
    }

    // Seçim okuma içeriği içinde mi?
    if (contentRef.current && contentRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Tam orijinal cümleyi çıkar
      const sentence = extractSentenceForSelection(reading.content, text);

      setSelectedText(text);
      setSelectedSentence(sentence);
      setPopoverPos({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    }
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    return () => {
      document.removeEventListener('selectionchange', handleTextSelection);
    };
  }, [reading.content]);

  // "Kelime Listeme Ekle" butonuna basıldığında
  const handleInitiateAddWord = () => {
    if (!selectedText) return;

    // Mükerrer kontrolü (Kural 4)
    const duplicate = findDuplicateCard(allCards, selectedText);
    if (duplicate) {
      setDuplicateCard(duplicate);
      setDuplicateModalOpen(true);
      setPopoverPos(null);
      return;
    }

    // Yeni kelime modalını aç
    setEditingCard(null);
    setVocabModalOpen(true);
    setPopoverPos(null);
  };

  // Mükerrer kelimeye yeni kaynak ve cümle ekleme
  const handleAppendSource = () => {
    if (!duplicateCard) return;

    appendSourceToCard(duplicateCard.id, {
      readingId: reading.id,
      readingTitle: reading.title,
      weekId: reading.weekId,
      sentence: selectedSentence,
    });

    onRefreshCards();
    setDuplicateModalOpen(false);
  };

  // Paragraf paragrafa ayırarak ve kayıtlı kelimeleri vurgulayarak render et
  const paragraphs = reading.content.split(/\n{2,}/);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Üst Eylem ve Bilgi Barı */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Okuma Parçaları Listesine Dön</span>
          </button>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {reading.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {week && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>{week.title}</span>
              </span>
            )}
            <span>•</span>
            <span>{reading.wordCount} kelime</span>
            <span>•</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              {savedCardsForReading.length} çıkarılan kelime
            </span>
            {reading.category && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {reading.category}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => {
              if (window.confirm(`"${reading.title}" okuma parçasını silmek istediğinize emin misiniz?`)) {
                deleteReading(reading.id);
                onReadingDeleted();
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
            title="Okuma Parçasını Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Okuma Rehberi İpucu Kutusu */}
      <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <p className="font-bold">Nasıl Kelime Seçilir?</p>
          <p className="mt-0.5 text-[11px] text-blue-800/80 dark:text-blue-300/80">
            Metin içindeki herhangi bir kelimeyi veya kalıp ifadeyi (örn: <i>shortage of natural resources</i>) fareyle veya parmağınızla seçtiğinizde açılan <b>"Kelime Listeme Ekle"</b> düğmesine basabilirsiniz. Sarı/mavi vurgulu kelimelere dokunarak kayıtlı anlamını görebilirsiniz.
          </p>
        </div>
      </div>

      {/* Ana Metin Okuma Alanı */}
      <div
        ref={contentRef}
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-sm leading-loose font-serif text-slate-800 dark:text-slate-200 text-base sm:text-lg select-text space-y-6"
      >
        {paragraphs.map((para, pIdx) => {
          const segments = segmentTextWithSavedWords(para, allCards);

          return (
            <p key={pIdx} className="leading-relaxed">
              {segments.map((seg, sIdx) => {
                if (seg.isSaved && seg.card) {
                  return (
                    <mark
                      key={sIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickInfoCard(seg.card!);
                      }}
                      className="cursor-pointer bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-950 dark:text-blue-200 px-1 py-0.5 rounded font-sans font-semibold border-b-2 border-blue-500 transition mx-0.5"
                      title="Kart detayını görmek için tıklayın"
                    >
                      {seg.text}
                    </mark>
                  );
                }
                return <span key={sIdx}>{seg.text}</span>;
              })}
            </p>
          );
        })}
      </div>

      {/* Bu Metinden Çıkarılan Kelimeler Kart Listesi */}
      {savedCardsForReading.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Bu Parçadan Seçilen Kelimeler ({savedCardsForReading.length})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedCardsForReading.map((card) => (
              <div
                key={card.id}
                onClick={() => setQuickInfoCard(card)}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-white">
                    {card.english}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    {card.turkish}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                  {card.partOfSpeech}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kayan Seçim Menüsü */}
      <SelectionPopover
        position={popoverPos}
        selectedText={selectedText}
        onAddWord={handleInitiateAddWord}
      />

      {/* Kaydedilmiş Kelimeye Dokunulduğunda Hızlı Bilgi Modalı */}
      <WordQuickInfoModal
        card={quickInfoCard}
        onClose={() => setQuickInfoCard(null)}
        onEdit={(card) => {
          setEditingCard(card);
          setVocabModalOpen(true);
        }}
      />

      {/* 12 Alanlı Kelime Ekleme / Düzenleme Modalı */}
      <VocabModal
        isOpen={vocabModalOpen}
        onClose={() => {
          setVocabModalOpen(false);
          setEditingCard(null);
        }}
        cardToEdit={editingCard}
        initialEnglish={selectedText}
        initialSentence={selectedSentence}
        initialReading={reading}
        initialWeek={week}
        weeks={allWeeks}
        readings={allReadings}
        onSaved={() => {
          onRefreshCards();
          setSelectedText('');
        }}
      />

      {/* Mükerrer Kelime Uyarısı ve Cümle Ekleme Modalı */}
      {duplicateCard && (
        <DuplicateWarningModal
          isOpen={duplicateModalOpen}
          onClose={() => setDuplicateModalOpen(false)}
          existingCard={duplicateCard}
          currentReading={reading}
          newSentence={selectedSentence}
          onAppendSource={handleAppendSource}
          onEditExisting={() => {
            setEditingCard(duplicateCard);
            setVocabModalOpen(true);
          }}
          onCreateSeparate={() => {
            setEditingCard(null);
            setVocabModalOpen(true);
          }}
        />
      )}
    </div>
  );
};
