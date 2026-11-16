import { SRSItem } from './srs';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'phrasal_verb'
  | 'prepositional_phrase'
  | 'idiom'
  | 'collocation'
  | 'conjunction'
  | 'other';

export type VocabSourceType =
  | 'user_reading'        // Kullanıcının yüklediği okuma parçalarından seçilen kelimeler
  | 'user_yokdil_list'    // Kullanıcının yüklediği YÖKDİL kelime listeleri
  | 'verified_exam';      // Kaynağı ve sınav bilgisi doğrulanmış çıkmış kelimeler

export interface WordSourceReference {
  readingId: string;
  readingTitle: string;
  weekId?: string;
  sentence: string;
  sentenceTranslation?: string;
  dateAdded: string;
}

export interface VocabCard {
  id: string;
  userId?: string;
  
  // 12 Zorunlu & Temel Alan:
  // 1. İngilizce kelime veya ifade
  english: string;
  // 2. Türkçe anlam
  turkish: string;
  // 3. İngilizce telaffuz (IPA)
  ipa?: string;
  // 4. Kelime türü
  partOfSpeech: PartOfSpeech;
  // 5. Kelimenin temel biçimi veya kökü
  lemma?: string;
  // 6. Okuma parçasındaki orijinal cümlesi
  originalSentence: string;
  // 7. Cümlenin Türkçe çevirisi
  sentenceTranslation?: string;
  // 8. Birlikte kullanıldığı edatlar
  prepositions?: string[];
  // 9. Yaygın kelime birliktelikleri (collocations)
  collocations?: string[];
  // 10. Varsa ilgili akademik kullanım
  academicUsage?: string;
  // 11. Ait olduğu okuma parçası ve hafta
  readingId?: string;
  readingTitle?: string;
  weekId?: string;
  weekTitle?: string;
  // Birden fazla okuma parçasında geçmesi durumu için kaynak referansları
  sources?: WordSourceReference[];
  // 12. Öğrenme ve tekrar durumu (SRS)
  srs: SRSItem;

  // Kaynak sınıflandırması:
  sourceType: VocabSourceType;
  examInfo?: {
    year?: number;
    term?: 'İlkbahar' | 'Sonbahar';
    field?: 'Fen Bilimleri' | 'Sağlık Bilimleri' | 'Sosyal Bilimler';
    verified: boolean;
  };

  // Öğrenme durumları
  isDifficult: boolean; // Kullanıcının elle işaretlediği veya lapselara göre zorlanan kelime
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export type YokdilCategory =
  | 'Fen Bilimleri'
  | 'Sağlık Bilimleri'
  | 'Sosyal Bilimler'
  | 'Genel Akademik'
  | 'Akademik Fiiller'
  | 'Akademik Sıfatlar'
  | 'Akademik Zarflar'
  | 'Edatlar & Prepositions'
  | 'Kalıp İfadeler & Collocations';
