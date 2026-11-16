import React, { useState } from 'react';
import { VocabSourceType } from '../../types/vocab';
import { parseVocabCSV } from '../../services/exportImport';
import { saveVocabCard } from '../../services/storage';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface ImportBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCompleted: (count: number) => void;
}

export const ImportBankModal: React.FC<ImportBankModalProps> = ({
  isOpen,
  onClose,
  onImportCompleted,
}) => {
  const [sourceType, setSourceType] = useState<VocabSourceType>('user_yokdil_list');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';
        setFileContent(text);

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : parsed.vocab || [];
          setParsedPreview(list.slice(0, 5));
        } else {
          // CSV / Metin Ayrıştırma
          const result = parseVocabCSV(text, sourceType);
          setParsedPreview(result.cards.slice(0, 5));
          setParseErrors(result.errors);
        }
      } catch (err: any) {
        setError('Dosya okunurken veya ayrıştırılırken hata oluştu: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleExecuteImport = () => {
    if (!fileContent.trim()) {
      setError('Lütfen bir CSV veya JSON dosyası seçiniz.');
      return;
    }

    setIsProcessing(true);
    let importedCards: any[] = [];

    try {
      if (fileName.endsWith('.json')) {
        const parsed = JSON.parse(fileContent);
        importedCards = Array.isArray(parsed) ? parsed : parsed.vocab || [];
      } else {
        const result = parseVocabCSV(fileContent, sourceType);
        importedCards = result.cards;
      }

      // Kartları depolamaya kaydet
      let count = 0;
      for (const card of importedCards) {
        saveVocabCard({
          ...card,
          sourceType,
          id: undefined, // Yeni ID atanması için
        });
        count++;
      }

      onImportCompleted(count);
      onClose();
    } catch (err: any) {
      setError('İçe aktarma hatası: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Üst Başlık */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Kelime Listesi / Bankası İçe Aktar
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                CSV, Excel (.csv) veya JSON formatında kelimeler yükleyin
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

        <div className="mt-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Kural 5: Kaynak Türü Seçimi ve Doğrulama Uyarısı */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kelime Kaynak Türü (Kaynak Ayrımı Kuralı)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition ${
                  sourceType === 'user_yokdil_list'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="sourceType"
                  value="user_yokdil_list"
                  checked={sourceType === 'user_yokdil_list'}
                  onChange={() => setSourceType('user_yokdil_list')}
                  className="hidden"
                />
                <span>Kendi Yüklediğim YÖKDİL Listem</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Kişisel çalışma listesi veya sözlük
                </span>
              </label>

              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col gap-1 transition ${
                  sourceType === 'verified_exam'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="sourceType"
                  value="verified_exam"
                  checked={sourceType === 'verified_exam'}
                  onChange={() => setSourceType('verified_exam')}
                  className="hidden"
                />
                <span>Doğrulanmış Sınav Kelimesi</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Yıl ve dönem bilgisi teyitli çıkmış soru
                </span>
              </label>
            </div>
          </div>

          {/* Doğrulanmamış Kelime Kuralı Uyarısı (Kural 5) */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <b>Önemli Kural:</b> Sistem, kaynağı doğrulanmamış kelimeleri kesin çıkmış kelime olarak sunmaz. Yüklediğiniz her kelimenin kaynak etiketi korunur.
            </p>
          </div>

          {/* Dosya Seçici */}
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-xl p-5 text-center cursor-pointer relative bg-slate-50/50 dark:bg-slate-800/30">
            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center">
              <div className="flex gap-2 text-slate-400 mb-2">
                <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                <FileCode className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {fileName ? fileName : 'CSV veya JSON dosyasını buraya sürükleyin'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Desteklenen formatlar: .csv (virgül veya noktalı virgül), .json
              </p>
            </div>
          </div>

          {/* Önizleme */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Önizleme (İlk {parsedPreview.length} kelime algılandı):
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 max-h-32 overflow-y-auto">
                {parsedPreview.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.english}</span>
                    <span className="text-blue-600 dark:text-blue-400">{item.turkish}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alt Butonlar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={isProcessing || !fileContent.trim()}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Kelimeleri Bankaya Aktar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
