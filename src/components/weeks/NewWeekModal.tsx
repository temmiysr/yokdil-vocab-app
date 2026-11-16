import React, { useState } from 'react';
import { Week } from '../../types/reading';
import { saveWeek } from '../../services/storage';
import { getTodayFormatted } from '../../services/srs';
import { X, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface NewWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWeekCreated: (week: Week) => void;
  weekToEdit?: Week | null;
}

export const NewWeekModal: React.FC<NewWeekModalProps> = ({
  isOpen,
  onClose,
  onWeekCreated,
  weekToEdit,
}) => {
  const [title, setTitle] = useState(
    weekToEdit ? weekToEdit.title : `1. Hafta – ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`
  );
  const [startDate, setStartDate] = useState(weekToEdit ? weekToEdit.startDate : getTodayFormatted());
  const [endDate, setEndDate] = useState(weekToEdit?.endDate || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Lütfen hafta için bir başlık giriniz.');
      return;
    }

    const saved = saveWeek({
      id: weekToEdit ? weekToEdit.id : undefined,
      title: title.trim(),
      startDate,
      endDate: endDate || undefined,
      readingIds: weekToEdit?.readingIds || [],
      archived: weekToEdit?.archived || false,
    });

    onWeekCreated(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {weekToEdit ? 'Haftayı Düzenle' : 'Yeni Hafta Oluştur'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Hafta Adı (Örn: 1. Hafta – 16 Kasım 2026)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bitiş Tarihi (Opsiyonel)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{weekToEdit ? 'Kaydet' : 'Haftayı Başlat'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
