import React, { useState } from 'react';
import { Week, ReadingText, FileSourceType } from '../../types/reading';
import { parsePlainTextFile, parseDocxFile, parsePdfFile, performImageOcr } from '../../services/textParser';
import { saveReading } from '../../services/storage';
import {
  X,
  Upload,
  FileText,
  File,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface UploadReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeks: Week[];
  selectedWeekId?: string;
  onReadingSaved: (reading: ReadingText) => void;
  onOpenNewWeekModal: () => void;
}

export const UploadReadingModal: React.FC<UploadReadingModalProps> = ({
  isOpen,
  onClose,
  weeks,
  selectedWeekId,
  onReadingSaved,
  onOpenNewWeekModal,
}) => {
  const [targetWeekId, setTargetWeekId] = useState<string>(selectedWeekId || (weeks[0]?.id || ''));
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReadingText['category']>('Genel Akademik');
  const [content, setContent] = useState('');
  const [fileType, setFileType] = useState<FileSourceType>('manual');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [ocrReviewMode, setOcrReviewMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setFileName(file.name);

    if (!title) {
      // Dosya adından başlık öner
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      setTitle(rawName);
    }

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'txt') {
        setFileType('txt');
        setProgressMsg('Metin dosyası okunuyor...');
        const text = await parsePlainTextFile(file);
        setContent(text);
      } else if (ext === 'docx') {
        setFileType('docx');
        setProgressMsg('Word belgesi ayrıştırılıyor ve paragraflar korunuyor...');
        const text = await parseDocxFile(file);
        setContent(text);
      } else if (ext === 'pdf') {
        setFileType('pdf');
        setProgressMsg('PDF sayfaları taranıyor...');
        const text = await parsePdfFile(file, (pct) => setProgressMsg(`PDF ayrıştırılıyor: %${pct}`));
        setContent(text);
      } else if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext || '')) {
        setFileType('image_ocr');
        setProgressMsg('Görselden OCR ile metin çıkarılıyor...');
        const text = await performImageOcr(file, (pct, status) => {
          setProgressMsg(`OCR: %${pct} - ${status}`);
        });
        setContent(text);
        // OCR sonucu için kullanıcıya kontrol ve düzeltme ekranını göster (Kural 11 gereği)
        setOcrReviewMode(true);
      } else {
        throw new Error('Desteklenmeyen dosya türü. Lütfen PDF, Word (.docx), Fotoğraf veya .txt yükleyiniz.');
      }
    } catch (err: any) {
      setError(err.message || 'Dosya işlenirken bir hata oluştu.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleSave = () => {
    if (!targetWeekId) {
      setError('Lütfen bu okuma parçasının ait olacağı haftayı seçiniz.');
      return;
    }
    if (!title.trim()) {
      setError('Lütfen bir başlık giriniz (Örn: Reading 1: Technology).');
      return;
    }
    if (!content.trim()) {
      setError('Okuma metni içeriği boş olamaz.');
      return;
    }

    const saved = saveReading({
      weekId: targetWeekId,
      title: title.trim(),
      content: content.trim(),
      category,
      dateAdded: new Date().toISOString(),
      fileType,
      fileName: fileName || undefined,
    });

    onReadingSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Başlık */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                İngilizce Okuma Parçası Yükle
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yalnızca sizin sağladığınız metinler kaydedilir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Hafta Seçimi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ait Olduğu Hafta
            </label>
            {weeks.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                <span>Henüz hiçbir hafta oluşturulmadı.</span>
                <button
                  type="button"
                  onClick={onOpenNewWeekModal}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Yeni Hafta Oluştur
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={targetWeekId}
                  onChange={(e) => setTargetWeekId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onOpenNewWeekModal}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  + Yeni Hafta
                </button>
              </div>
            )}
          </div>

          {/* Metin Başlığı ve Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Metin Başlığı
              </label>
              <input
                type="text"
                placeholder="Örn: Reading 1: Technology & Agriculture"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                YÖKDİL Alanı
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="Fen Bilimleri">Fen Bilimleri</option>
                <option value="Sağlık Bilimleri">Sağlık Bilimleri</option>
                <option value="Sosyal Bilimler">Sosyal Bilimler</option>
                <option value="Genel Akademik">Genel Akademik</option>
              </select>
            </div>
          </div>

          {/* Dosya Yükleme Alanı */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dosyadan Metin Çıkar (PDF, Word .docx, Görsel OCR veya .txt)
            </label>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer relative bg-slate-50/50 dark:bg-slate-800/30 transition">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.bmp"
                onChange={handleFileUpload}
                disabled={loading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                {loading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{progressMsg}</p>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2 text-slate-400 mb-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <File className="w-5 h-5 text-indigo-500" />
                      <ImageIcon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Dosyayı buraya sürükleyin veya <span className="text-blue-600 dark:text-blue-400">gözatın</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PDF, Word, Fotoğraf (OCR) veya Düz Metin
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* OCR Kontrol ve Düzeltme Uyarısı (Kural 11) */}
          {ocrReviewMode && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">OCR Kontrol ve Düzeltme Aşaması</p>
                <p className="text-[11px] mt-0.5 leading-relaxed">
                  Görselden taranan metin aşağıda düzenleyicidedir. Kaydetmeden önce hatalı veya eksik tanınan kelimeleri elle düzeltebilirsiniz.
                </p>
              </div>
            </div>
          )}

          {/* Metin İçeriği ve Düzenleyici */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                İngilizce Okuma Metni (Paragraflar korunur)
              </label>
              <span className="text-[11px] text-slate-400">
                {content.trim() ? `${content.trim().split(/\s+/).length} Kelime` : '0 Kelime'}
              </span>
            </div>
            <textarea
              rows={8}
              placeholder="İngilizce okuma parçanızı buraya yapıştırabilir veya yukarıdaki yükleme seçeneklerini kullanabilirsiniz..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-xl text-xs sm:text-sm font-serif leading-relaxed bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

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
            onClick={handleSave}
            disabled={loading || !content.trim() || !title.trim()}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Okuma Parçasını Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
