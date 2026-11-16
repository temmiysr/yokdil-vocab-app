import React, { useState } from 'react';
import { VocabCard, VocabSourceType, YokdilCategory } from '../../types/vocab';
import { VocabCardItem } from '../vocab/VocabCardItem';
import { ImportBankModal } from './ImportBankModal';
import { exportCardsToCSV, triggerDownload } from '../../services/exportImport';
import {
  Database,
  Search,
  Upload,
  Download,
  Filter,
  CheckCircle,
  Tag,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';

interface YokdilBankProps {
  cards: VocabCard[];
  onEditCard: (card: VocabCard) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleDifficult: (cardId: string) => void;
  onCardsImported: () => void;
}

export const YokdilBank: React.FC<YokdilBankProps> = ({
  cards,
  onEditCard,
  onDeleteCard,
  onToggleDifficult,
  onCardsImported,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);

  const categories = [
    { id: 'all', label: 'Tüm Kelimeler' },
    { id: 'Fen Bilimleri', label: 'Fen Bilimleri' },
    { id: 'Sağlık Bilimleri', label: 'Sağlık Bilimleri' },
    { id: 'Sosyal Bilimler', label: 'Sosyal Bilimler' },
    { id: 'Genel Akademik', label: 'Genel Akademik' },
    { id: 'verb', label: 'Akademik Fiiller' },
    { id: 'adjective', label: 'Akademik Sıfatlar' },
    { id: 'adverb', label: 'Akademik Zarflar' },
    { id: 'prepositions', label: 'Edatlar & Prepositions' },
    { id: 'collocations', label: 'Kalıp İfadeler & Collocations' },
  ];

  // Filtreleme Mantığı
  const filteredCards = cards.filter((card) => {
    // Arama
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEng = card.english.toLowerCase().includes(q);
      const matchTr = card.turkish.toLowerCase().includes(q);
      const matchSentence = card.originalSentence?.toLowerCase().includes(q);
      if (!matchEng && !matchTr && !matchSentence) return false;
    }

    // Kaynak Türü Filtresi (Kural 5)
    if (selectedSource !== 'all') {
      if (selectedSource === 'user_reading' && card.sourceType !== 'user_reading') return false;
      if (selectedSource === 'user_yokdil_list' && card.sourceType !== 'user_yokdil_list') return false;
      if (selectedSource === 'verified_exam' && card.sourceType !== 'verified_exam') return false;
    }

    // Kategori Filtresi
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'verb' && card.partOfSpeech !== 'verb' && card.partOfSpeech !== 'phrasal_verb') return false;
      if (selectedCategory === 'adjective' && card.partOfSpeech !== 'adjective') return false;
      if (selectedCategory === 'adverb' && card.partOfSpeech !== 'adverb') return false;
      if (selectedCategory === 'prepositions') {
        const hasPrep = (card.prepositions && card.prepositions.length > 0) || card.partOfSpeech === 'prepositional_phrase';
        if (!hasPrep) return false;
      }
      if (selectedCategory === 'collocations') {
        const hasColloc = (card.collocations && card.collocations.length > 0) || card.partOfSpeech === 'collocation';
        if (!hasColloc) return false;
      }
      if (['Fen Bilimleri', 'Sağlık Bilimleri', 'Sosyal Bilimler', 'Genel Akademik'].includes(selectedCategory)) {
        if (card.academicUsage !== selectedCategory) return false;
      }
    }

    return true;
  });

  const handleExportCSV = () => {
    if (cards.length === 0) return;
    const csv = exportCardsToCSV(filteredCards);
    triggerDownload(csv, `yokdil_kelime_bankasi_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Üst Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-500" />
            <span>YÖKDİL Kelime Bankası</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Alanlara göre filtrelenebilir, kaynak teyitli akademik kelime havuzu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={cards.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition disabled:opacity-50"
            title="CSV Olarak İndir"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Dışa Aktar</span>
          </button>
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Dosya İçe Aktar</span>
          </button>
        </div>
      </div>

      {/* Kaynak Ayrımı Filtre Sekmeleri (Kural 5: Kaynaklar belirgin şekilde ayrılır) */}
      <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 inline-flex flex-wrap gap-1 text-xs font-semibold">
        <button
          onClick={() => setSelectedSource('all')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedSource === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          Tüm Kaynaklar ({cards.length})
        </button>
        <button
          onClick={() => setSelectedSource('user_reading')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            selectedSource === 'user_reading'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-3 h-3" />
          <span>Okuma Parçalarımdan ({cards.filter((c) => c.sourceType === 'user_reading').length})</span>
        </button>
        <button
          onClick={() => setSelectedSource('user_yokdil_list')}
          className={`px-3 py-1.5 rounded-lg transition ${
            selectedSource === 'user_yokdil_list'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          Yüklediğim YÖKDİL Listeleri ({cards.filter((c) => c.sourceType === 'user_yokdil_list').length})
        </button>
        <button
          onClick={() => setSelectedSource('verified_exam')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            selectedSource === 'verified_exam'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          <span>Doğrulanmış Çıkmış Kelimeler ({cards.filter((c) => c.sourceType === 'verified_exam').length})</span>
        </button>
      </div>

      {/* Arama ve Kategori Sekmeleri */}
      <div className="space-y-3">
        {/* Arama Çubuğu */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="İngilizce kelime, Türkçe anlam veya cümle içinde ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Alan / Kategori Hapları */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition font-medium ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kelime Kartları Izgarası */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 max-w-md mx-auto">
          <Database className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {cards.length === 0 ? 'Kelime Bankası Henüz Boş' : 'Eşleşen Kelime Bulunamadı'}
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {cards.length === 0
              ? 'YÖKDİL kelime listenizi CSV veya JSON dosyası yükleyerek bankaya aktarabilirsiniz.'
              : 'Arama kriterlerinizi değiştirmeyi deneyebilirsiniz.'}
          </p>
          {cards.length === 0 && (
            <button
              onClick={() => setImportModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
            >
              <Upload className="w-4 h-4" />
              <span>Dosyadan Kelime Yükle</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => (
            <VocabCardItem
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              onToggleDifficult={onToggleDifficult}
            />
          ))}
        </div>
      )}

      {/* İçe Aktarma Modalı */}
      <ImportBankModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportCompleted={(count) => {
          onCardsImported();
          alert(`${count} adet kelime başarıyla YÖKDİL Bankasına aktarıldı!`);
        }}
      />
    </div>
  );
};
