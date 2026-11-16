import { SRSItem, SRSRating, ReviewLog } from '../types/srs';
import { VocabCard } from '../types/vocab';

const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 3.0;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Yeni bir kelime kartı için başlangıç SRS durumunu oluşturur.
 */
export function createInitialSRSItem(cardId: string): SRSItem {
  const today = getTodayFormatted();
  return {
    cardId,
    state: 'new',
    interval: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    nextReviewAt: today, // Yeni kelimeler hemen ilk gün çalışmaya hazırdır
    reviewHistory: [],
  };
}

/**
 * Tarihi 'YYYY-MM-DD' formatına çevirir (Yerel saat dikkate alınarak).
 */
export function getTodayFormatted(dateObj: Date = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Belirli bir tarihe gün ekler ve 'YYYY-MM-DD' formatında döner.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return getTodayFormatted(date);
}

/**
 * SM-2 tabanlı, YÖKDİL hazırlığına uyarlanmış Spaced Repetition hesaplayıcısı.
 * 1: Tekrar (hatırlanamadı) -> 1 gün sonra, kolaylık düşer, lapse artar
 * 2: Zor (zor hatırlandı) -> küçük aralık, kolaylık düşer
 * 3: İyi (hatırlandı) -> standart SM-2 aralığı
 * 4: Kolay (çok iyi biliniyor) -> genişletilmiş aralık, kolaylık artar
 */
export function processReview(
  item: SRSItem,
  rating: SRSRating,
  currentDate: Date = new Date()
): SRSItem {
  const todayStr = getTodayFormatted(currentDate);
  let newRepetitions = item.repetitions;
  let newEase = item.easeFactor;
  let newInterval = item.interval;
  let newLapses = item.lapses;
  let newState = item.state;

  if (rating === 1) {
    // Hatırlanamadı
    newRepetitions = 0;
    newInterval = 1;
    newEase = Math.max(MIN_EASE_FACTOR, newEase - 0.2);
    newLapses += 1;
    newState = 'learning';
  } else {
    // Başarılı değerlendirme (2 = Zor, 3 = İyi, 4 = Kolay)
    if (newRepetitions === 0) {
      // 1. Aşama: İlk başarılı tekrar
      switch (rating) {
        case 2:
          newInterval = 1;
          newEase = Math.max(MIN_EASE_FACTOR, newEase - 0.15);
          break;
        case 3:
          newInterval = 1;
          break;
        case 4:
          newInterval = 3;
          newEase = Math.min(MAX_EASE_FACTOR, newEase + 0.15);
          break;
      }
      newRepetitions = 1;
      newState = 'learning';
    } else if (newRepetitions === 1) {
      // 2. Aşama: 2. başarılı tekrar
      switch (rating) {
        case 2:
          newInterval = 2;
          newEase = Math.max(MIN_EASE_FACTOR, newEase - 0.15);
          break;
        case 3:
          newInterval = 3;
          break;
        case 4:
          newInterval = 6;
          newEase = Math.min(MAX_EASE_FACTOR, newEase + 0.15);
          break;
      }
      newRepetitions = 2;
      newState = 'learning';
    } else if (newRepetitions === 2) {
      // 3. Aşama: 3. başarılı tekrar (7 gün hedefi)
      switch (rating) {
        case 2:
          newInterval = 4;
          newEase = Math.max(MIN_EASE_FACTOR, newEase - 0.1);
          break;
        case 3:
          newInterval = 7;
          break;
        case 4:
          newInterval = 12;
          newEase = Math.min(MAX_EASE_FACTOR, newEase + 0.15);
          break;
      }
      newRepetitions = 3;
      newState = 'review';
    } else {
      // 4. Aşama ve sonrası: 14, 30 ve katları (adaptif SM-2 formülü)
      let modifier = 1.0;
      if (rating === 2) {
        modifier = 0.8;
        newEase = Math.max(MIN_EASE_FACTOR, newEase - 0.15);
      } else if (rating === 4) {
        modifier = 1.3;
        newEase = Math.min(MAX_EASE_FACTOR, newEase + 0.15);
      }

      newInterval = Math.max(newInterval + 1, Math.round(newInterval * newEase * modifier));
      newRepetitions += 1;
      newState = newInterval >= 30 ? 'mastered' : 'review';
    }
  }

  // 2 basamağa yuvarla
  newEase = Math.round(newEase * 100) / 100;

  const nextReviewDate = addDaysToDate(todayStr, newInterval);

  const reviewLog: ReviewLog = {
    date: new Date().toISOString(),
    rating,
    interval: newInterval,
    easeFactor: newEase,
  };

  const updatedHistory = [...(item.reviewHistory || []), reviewLog];

  return {
    ...item,
    state: newState,
    interval: newInterval,
    easeFactor: newEase,
    repetitions: newRepetitions,
    lapses: newLapses,
    lastReviewedAt: new Date().toISOString(),
    nextReviewAt: nextReviewDate,
    reviewHistory: updatedHistory,
  };
}

/**
 * Kartın belirtilen tarihte (varsayılan: bugün) tekrar vaktinin gelip gelmediğini kontrol eder.
 */
export function isCardDue(item: SRSItem, targetDate: string = getTodayFormatted()): boolean {
  return item.nextReviewAt <= targetDate;
}

/**
 * Bugün tekrar bekleyen tüm kelimeleri filtreler.
 */
export function getDueCards(cards: VocabCard[], targetDate: string = getTodayFormatted()): VocabCard[] {
  return cards.filter((card) => isCardDue(card.srs, targetDate));
}

/**
 * Önümüzdeki 7 günün tekrar yükünü hesaplar (Bar chart / forecast grafiği için).
 */
export function get7DayForecast(
  cards: VocabCard[],
  startDateStr: string = getTodayFormatted()
): Array<{ date: string; dayName: string; count: number }> {
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const forecast: Array<{ date: string; dayName: string; count: number }> = [];

  for (let i = 0; i < 7; i++) {
    const curDateStr = addDaysToDate(startDateStr, i);
    const dateObj = new Date(curDateStr + 'T00:00:00');
    const dayName = i === 0 ? 'Bugün' : dayNames[dateObj.getDay()];

    const count = cards.filter((card) => {
      if (i === 0) {
        // Bugün: vadesi geçmiş veya bugüne ait tüm kartlar
        return card.srs.nextReviewAt <= curDateStr;
      }
      return card.srs.nextReviewAt === curDateStr;
    }).length;

    forecast.push({
      date: curDateStr,
      dayName,
      count,
    });
  }

  return forecast;
}

/**
 * Genel öğrenme istatistiklerini hesaplar.
 */
export function getLearningStats(cards: VocabCard[]) {
  const today = getTodayFormatted();
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let masteredCount = 0;
  let difficultCount = 0;
  let dueCount = 0;

  for (const card of cards) {
    if (isCardDue(card.srs, today)) {
      dueCount++;
    }
    if (card.isDifficult || card.srs.lapses >= 3) {
      difficultCount++;
    }

    switch (card.srs.state) {
      case 'new':
        newCount++;
        break;
      case 'learning':
        learningCount++;
        break;
      case 'review':
        reviewCount++;
        break;
      case 'mastered':
        masteredCount++;
        break;
    }
  }

  const total = cards.length;
  const learningPercentage = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

  return {
    total,
    newCount,
    learningCount,
    reviewCount,
    masteredCount,
    difficultCount,
    dueCount,
    learningPercentage,
  };
}
