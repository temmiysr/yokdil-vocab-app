import { VocabCard } from '../types/vocab';
import { Week, ReadingText } from '../types/reading';
import { UserSettings } from '../types/settings';
import { createInitialSRSItem } from './srs';

const STORAGE_KEYS = {
  WEEKS: 'yokdil_weeks_v1',
  READINGS: 'yokdil_readings_v1',
  VOCAB: 'yokdil_vocab_cards_v1',
  SETTINGS: 'yokdil_user_settings_v1',
};

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  notificationTime: '20:00',
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  appUrl: window.location.origin + window.location.pathname,
  cloudProvider: 'none',
  aiProvider: 'none',
  webNotificationEnabled: false,
  audioAutoplay: false,
  dailyReviewGoal: 20,
};

// Basit olay dinleyici (state senkronizasyonu için)
type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeToStorage(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyStorageChange() {
  listeners.forEach((fn) => fn());
}

// =================== HAFTALAR (WEEKS) ===================

export function getWeeks(): Week[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEEKS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Haftalar yüklenirken hata:', e);
    return [];
  }
}

export function saveWeek(week: Omit<Week, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Week {
  const weeks = getWeeks();
  const now = new Date().toISOString();
  let savedWeek: Week;

  if (week.id) {
    // Güncelleme
    const idx = weeks.findIndex((w) => w.id === week.id);
    if (idx >= 0) {
      savedWeek = {
        ...weeks[idx],
        ...week,
        updatedAt: now,
      } as Week;
      weeks[idx] = savedWeek;
    } else {
      savedWeek = {
        ...week,
        id: week.id,
        createdAt: now,
        updatedAt: now,
      } as Week;
      weeks.push(savedWeek);
    }
  } else {
    // Yeni hafta
    savedWeek = {
      ...week,
      id: 'week_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      readingIds: week.readingIds || [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    weeks.unshift(savedWeek);
  }

  localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(weeks));
  notifyStorageChange();
  return savedWeek;
}

export function deleteWeek(weekId: string): void {
  let weeks = getWeeks();
  weeks = weeks.filter((w) => w.id !== weekId);
  localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(weeks));

  // Bu haftaya bağlı okuma metinlerini de temizle
  let readings = getReadings();
  readings = readings.filter((r) => r.weekId !== weekId);
  localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));

  notifyStorageChange();
}

// =================== OKUMA METİNLERİ (READINGS) ===================

export function getReadings(): ReadingText[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.READINGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Okuma metinleri yüklenirken hata:', e);
    return [];
  }
}

export function getReadingById(id: string): ReadingText | undefined {
  return getReadings().find((r) => r.id === id);
}

export function saveReading(
  reading: Omit<ReadingText, 'id' | 'createdAt' | 'updatedAt' | 'wordCount' | 'savedWordIds'> & {
    id?: string;
    savedWordIds?: string[];
  }
): ReadingText {
  const readings = getReadings();
  const now = new Date().toISOString();
  const wordCount = reading.content.trim().split(/\s+/).filter(Boolean).length;
  let savedReading: ReadingText;

  if (reading.id) {
    const idx = readings.findIndex((r) => r.id === reading.id);
    if (idx >= 0) {
      savedReading = {
        ...readings[idx],
        ...reading,
        wordCount,
        updatedAt: now,
      } as ReadingText;
      readings[idx] = savedReading;
    } else {
      savedReading = {
        ...reading,
        id: reading.id,
        wordCount,
        savedWordIds: reading.savedWordIds || [],
        createdAt: now,
        updatedAt: now,
      } as ReadingText;
      readings.push(savedReading);
    }
  } else {
    savedReading = {
      ...reading,
      id: 'reading_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      wordCount,
      savedWordIds: [],
      createdAt: now,
      updatedAt: now,
    };
    readings.unshift(savedReading);

    // İlgili haftanın readingIds dizisine ekle
    const weeks = getWeeks();
    const targetWeek = weeks.find((w) => w.id === reading.weekId);
    if (targetWeek && !targetWeek.readingIds.includes(savedReading.id)) {
      targetWeek.readingIds.push(savedReading.id);
      targetWeek.updatedAt = now;
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(weeks));
    }
  }

  localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
  notifyStorageChange();
  return savedReading;
}

export function deleteReading(readingId: string): void {
  let readings = getReadings();
  const readingToDelete = readings.find((r) => r.id === readingId);
  readings = readings.filter((r) => r.id !== readingId);
  localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));

  // Haftadaki listeden çıkar
  if (readingToDelete?.weekId) {
    const weeks = getWeeks();
    const week = weeks.find((w) => w.id === readingToDelete.weekId);
    if (week) {
      week.readingIds = week.readingIds.filter((id) => id !== readingId);
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(weeks));
    }
  }

  notifyStorageChange();
}

// =================== KELİME KARTLARI (VOCAB CARDS) ===================

export function getVocabCards(): VocabCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOCAB);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Kelimeler yüklenirken hata:', e);
    return [];
  }
}

export function saveVocabCard(
  card: Omit<VocabCard, 'id' | 'createdAt' | 'updatedAt' | 'srs'> & {
    id?: string;
    srs?: VocabCard['srs'];
  }
): VocabCard {
  const cards = getVocabCards();
  const now = new Date().toISOString();
  let savedCard: VocabCard;

  if (card.id) {
    const idx = cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      savedCard = {
        ...cards[idx],
        ...card,
        updatedAt: now,
      } as VocabCard;
      cards[idx] = savedCard;
    } else {
      const srsItem = card.srs || createInitialSRSItem(card.id);
      savedCard = {
        ...card,
        id: card.id,
        srs: srsItem,
        createdAt: now,
        updatedAt: now,
      } as VocabCard;
      cards.push(savedCard);
    }
  } else {
    const newId = 'vocab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const srsItem = card.srs || createInitialSRSItem(newId);
    savedCard = {
      ...card,
      id: newId,
      srs: srsItem,
      createdAt: now,
      updatedAt: now,
    };
    cards.unshift(savedCard);

    // Eğer bir okuma metnine bağlıysa okuma metninin savedWordIds listesine ekle
    if (savedCard.readingId) {
      const readings = getReadings();
      const reading = readings.find((r) => r.id === savedCard.readingId);
      if (reading && !reading.savedWordIds.includes(savedCard.id)) {
        reading.savedWordIds.push(savedCard.id);
        reading.updatedAt = now;
        localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
      }
    }
  }

  localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(cards));
  notifyStorageChange();
  return savedCard;
}

export function appendSourceToCard(
  existingCardId: string,
  newSource: {
    readingId: string;
    readingTitle: string;
    weekId?: string;
    sentence: string;
    sentenceTranslation?: string;
  }
): VocabCard | null {
  const cards = getVocabCards();
  const idx = cards.findIndex((c) => c.id === existingCardId);
  if (idx === -1) return null;

  const card = cards[idx];
  const now = new Date().toISOString();
  const sources = card.sources || [];

  sources.push({
    ...newSource,
    dateAdded: now,
  });

  const updatedCard: VocabCard = {
    ...card,
    sources,
    updatedAt: now,
  };

  cards[idx] = updatedCard;
  localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(cards));

  // Okuma metnine ekle
  const readings = getReadings();
  const reading = readings.find((r) => r.id === newSource.readingId);
  if (reading && !reading.savedWordIds.includes(card.id)) {
    reading.savedWordIds.push(card.id);
    localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
  }

  notifyStorageChange();
  return updatedCard;
}

export function deleteVocabCard(cardId: string): void {
  let cards = getVocabCards();
  cards = cards.filter((c) => c.id !== cardId);
  localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(cards));

  // Okuma metinlerinden de referansı temizle
  const readings = getReadings();
  readings.forEach((r) => {
    if (r.savedWordIds.includes(cardId)) {
      r.savedWordIds = r.savedWordIds.filter((id) => id !== cardId);
    }
  });
  localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));

  notifyStorageChange();
}

export function toggleCardDifficult(cardId: string): VocabCard | null {
  const cards = getVocabCards();
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return null;

  cards[idx].isDifficult = !cards[idx].isDifficult;
  cards[idx].updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(cards));
  notifyStorageChange();
  return cards[idx];
}

// =================== AYARLAR (SETTINGS) ===================

export function getUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveUserSettings(settings: Partial<UserSettings>): UserSettings {
  const current = getUserSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  notifyStorageChange();
  return updated;
}

// =================== TOPLU İÇE / DIŞA AKTARIM ===================

export function getAllAppData() {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    weeks: getWeeks(),
    readings: getReadings(),
    vocab: getVocabCards(),
    settings: getUserSettings(),
  };
}

export function restoreAllAppData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  try {
    if (Array.isArray(data.weeks)) {
      localStorage.setItem(STORAGE_KEYS.WEEKS, JSON.stringify(data.weeks));
    }
    if (Array.isArray(data.readings)) {
      localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(data.readings));
    }
    if (Array.isArray(data.vocab)) {
      localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(data.vocab));
    }
    if (data.settings && typeof data.settings === 'object') {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
    }
    notifyStorageChange();
    return true;
  } catch (e) {
    console.error('Yedek geri yüklenirken hata:', e);
    return false;
  }
}
