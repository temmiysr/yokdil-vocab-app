export type SRSState = 'new' | 'learning' | 'review' | 'mastered';

export type SRSRating = 1 | 2 | 3 | 4;
// 1 = Tekrar (Again / hatırlayamadım)
// 2 = Zor (Hard / zor hatırladım)
// 3 = İyi (Good / hatırladım)
// 4 = Kolay (Easy / çok iyi biliyorum)

export interface ReviewLog {
  date: string;
  rating: SRSRating;
  interval: number;
  easeFactor: number;
}

export interface SRSItem {
  cardId: string;
  state: SRSState;
  interval: number; // Gün cinsinden aralık
  easeFactor: number; // SM-2 kolaylık çarpanı (varsayılan: 2.5, minimum: 1.3)
  repetitions: number; // Başarılı ardışık tekrar sayısı
  lapses: number; // 'Tekrar' değerlendirmesi sayısı (zorlanma göstergesi)
  lastReviewedAt: string | null; // ISO tarih
  nextReviewAt: string; // ISO tarih (YYYY-MM-DD)
  reviewHistory?: ReviewLog[];
}
