export interface ExamQuestion {
  num: number;
  category: string;
  prompt: string;
  options: string[];
  answer: number; // 0 for A, 1 for B... -1 if unknown
  correctLetter?: string;
  explanation?: string;
}

export interface CustomExam {
  id: string;
  title: string;
  field: 'Fen Bilimleri' | 'Sağlık Bilimleri' | 'Sosyal Bilimler' | 'Genel';
  year?: number;
  term?: 'İlkbahar' | 'Sonbahar';
  questions: ExamQuestion[];
  uploadedAt: string;
}
