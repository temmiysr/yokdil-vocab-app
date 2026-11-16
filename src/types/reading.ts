export interface Week {
  id: string;
  userId?: string;
  title: string; // Örneğin: "1. Hafta – 16 Kasım 2026"
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  readingIds: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FileSourceType = 'manual' | 'txt' | 'pdf' | 'docx' | 'image_ocr';

export interface ReadingText {
  id: string;
  userId?: string;
  weekId: string;
  title: string; // Örneğin: "Reading 1: Technology"
  content: string; // Paragraf düzeni korunmuş İngilizce metin
  category?: 'Fen Bilimleri' | 'Sağlık Bilimleri' | 'Sosyal Bilimler' | 'Genel Akademik';
  dateAdded: string; // ISO
  fileType: FileSourceType;
  fileName?: string;
  wordCount: number;
  savedWordIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WeekStats {
  weekId: string;
  totalWords: number;
  learnedWords: number;
  pendingReviewWords: number;
  difficultWords: number;
  learningPercentage: number;
}
