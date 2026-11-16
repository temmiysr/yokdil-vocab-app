import { VocabCard, PartOfSpeech, VocabSourceType } from '../types/vocab';
import { createInitialSRSItem } from './srs';

export interface CSVParseResult {
  cards: VocabCard[];
  errors: string[];
  totalParsed: number;
}

/**
 * CSV satırını virgül veya noktalı virgül ve tırnak işaretlerini dikkate alarak böler.
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * CSV dosya içeriğini VocabCard nesnelerine dönüştürür.
 * YÖKDİL Kelime Bankası içe aktarması için optimize edilmiştir.
 */
export function parseVocabCSV(
  csvContent: string,
  defaultSourceType: VocabSourceType = 'user_yokdil_list'
): CSVParseResult {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const cards: VocabCard[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { cards: [], errors: ['Dosya boş görünüyor.'], totalParsed: 0 };
  }

  // Ayırıcıyı belirle (virgül mü noktalı virgül mü?)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const rawHeaders = parseCSVLine(firstLine, delimiter).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '')
  );

  // Başlık sütunlarını eşleştir
  const colIndex = {
    english: rawHeaders.findIndex((h) => ['english', 'kelime', 'ingilizce', 'word', 'term'].includes(h)),
    turkish: rawHeaders.findIndex((h) => ['turkish', 'anlam', 'turkce', 'meaning', 'tanim'].includes(h)),
    partOfSpeech: rawHeaders.findIndex((h) => ['partofspeech', 'tur', 'kelimeturu', 'pos', 'type'].includes(h)),
    ipa: rawHeaders.findIndex((h) => ['ipa', 'telaffuz', 'pronunciation'].includes(h)),
    lemma: rawHeaders.findIndex((h) => ['lemma', 'kok', 'kokbicimi', 'stem', 'root'].includes(h)),
    sentence: rawHeaders.findIndex((h) => ['sentence', 'cumle', 'ornekcumle', 'examplesentence'].includes(h)),
    sentenceTr: rawHeaders.findIndex((h) => ['sentencetr', 'cumleceviri', 'cumletr', 'translation'].includes(h)),
    prepositions: rawHeaders.findIndex((h) => ['prepositions', 'edat', 'edatlar', 'preposition'].includes(h)),
    collocations: rawHeaders.findIndex((h) => ['collocations', 'kaliplar', 'kalip', 'collocation'].includes(h)),
    academicUsage: rawHeaders.findIndex((h) => ['academicusage', 'alan', 'kategori', 'category', 'academic'].includes(h)),
    sourceType: rawHeaders.findIndex((h) => ['sourcetype', 'kaynak', 'kaynakturu'].includes(h)),
    examYear: rawHeaders.findIndex((h) => ['examyear', 'yil', 'sinavyili', 'year'].includes(h)),
    examTerm: rawHeaders.findIndex((h) => ['examterm', 'donem', 'sinavdonemi', 'term'].includes(h)),
  };

  // Eğer başlık bulunamadıysa varsayılan sütun sırası kabul edilir:
  // [İngilizce, Türkçe, Tür, Örnek Cümle, Alan, Edatlar, Kalıplar]
  const hasValidHeader = colIndex.english !== -1 && colIndex.turkish !== -1;
  const startIndex = hasValidHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const row = parseCSVLine(lines[i], delimiter);
    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

    let english = '';
    let turkish = '';
    let pos: PartOfSpeech = 'other';
    let ipa = '';
    let lemma = '';
    let sentence = '';
    let sentenceTr = '';
    let prepositions: string[] = [];
    let collocations: string[] = [];
    let academicUsage = 'Genel Akademik';
    let sourceType: VocabSourceType = defaultSourceType;
    let examInfo: VocabCard['examInfo'] = undefined;

    if (hasValidHeader) {
      english = colIndex.english !== -1 ? row[colIndex.english] || '' : '';
      turkish = colIndex.turkish !== -1 ? row[colIndex.turkish] || '' : '';
      pos = mapStringToPOS(colIndex.partOfSpeech !== -1 ? row[colIndex.partOfSpeech] : '');
      ipa = colIndex.ipa !== -1 ? row[colIndex.ipa] || '' : '';
      lemma = colIndex.lemma !== -1 ? row[colIndex.lemma] || '' : '';
      sentence = colIndex.sentence !== -1 ? row[colIndex.sentence] || '' : '';
      sentenceTr = colIndex.sentenceTr !== -1 ? row[colIndex.sentenceTr] || '' : '';
      
      const prepRaw = colIndex.prepositions !== -1 ? row[colIndex.prepositions] : '';
      if (prepRaw) prepositions = prepRaw.split(/[,/|]/).map((s) => s.trim()).filter(Boolean);

      const collRaw = colIndex.collocations !== -1 ? row[colIndex.collocations] : '';
      if (collRaw) collocations = collRaw.split(/[,/|]/).map((s) => s.trim()).filter(Boolean);

      if (colIndex.academicUsage !== -1 && row[colIndex.academicUsage]) {
        academicUsage = row[colIndex.academicUsage];
      }

      if (colIndex.sourceType !== -1 && row[colIndex.sourceType]) {
        const rawSrc = row[colIndex.sourceType].toLowerCase();
        if (rawSrc.includes('verified') || rawSrc.includes('cikmis') || rawSrc.includes('çıkmış')) {
          sourceType = 'verified_exam';
        } else if (rawSrc.includes('reading') || rawSrc.includes('okuma')) {
          sourceType = 'user_reading';
        }
      }

      if (colIndex.examYear !== -1 && row[colIndex.examYear]) {
        const yr = parseInt(row[colIndex.examYear], 10);
        const term = colIndex.examTerm !== -1 ? (row[colIndex.examTerm] as any) : undefined;
        if (!isNaN(yr)) {
          examInfo = {
            year: yr,
            term: term === 'İlkbahar' || term === 'Sonbahar' ? term : undefined,
            field: academicUsage as any,
            verified: sourceType === 'verified_exam',
          };
        }
      }
    } else {
      // Başlıksız sıralı format
      english = row[0] || '';
      turkish = row[1] || '';
      pos = mapStringToPOS(row[2] || '');
      sentence = row[3] || '';
      academicUsage = row[4] || 'Genel Akademik';
      if (row[5]) prepositions = row[5].split(/[,/|]/).map((s) => s.trim()).filter(Boolean);
      if (row[6]) collocations = row[6].split(/[,/|]/).map((s) => s.trim()).filter(Boolean);
    }

    if (!english || !turkish) {
      errors.push(`Satır ${i + 1}: İngilizce kelime veya Türkçe anlam eksik olduğu için atlandı.`);
      continue;
    }

    const cardId = 'vocab_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const card: VocabCard = {
      id: cardId,
      english: english.trim(),
      turkish: turkish.trim(),
      ipa: ipa.trim() || undefined,
      partOfSpeech: pos,
      lemma: lemma.trim() || undefined,
      originalSentence: sentence.trim() || `Example with ${english.trim()}.`,
      sentenceTranslation: sentenceTr.trim() || undefined,
      prepositions: prepositions.length > 0 ? prepositions : undefined,
      collocations: collocations.length > 0 ? collocations : undefined,
      academicUsage: academicUsage.trim(),
      sourceType,
      examInfo,
      isDifficult: false,
      srs: createInitialSRSItem(cardId),
      createdAt: now,
      updatedAt: now,
    };

    cards.push(card);
  }

  return {
    cards,
    errors,
    totalParsed: cards.length,
  };
}

/**
 * Metin tabanlı POS değerlerini tip tanımına eşler.
 */
function mapStringToPOS(raw: string): PartOfSpeech {
  const clean = (raw || '').toLowerCase().trim();
  if (['n', 'noun', 'isim'].includes(clean)) return 'noun';
  if (['v', 'verb', 'fiil'].includes(clean)) return 'verb';
  if (['adj', 'adjective', 'sifat', 'sıfat'].includes(clean)) return 'adjective';
  if (['adv', 'adverb', 'zarf'].includes(clean)) return 'adverb';
  if (['phrasal', 'phrasal_verb', 'phrasal verb', 'öbek fiil'].includes(clean)) return 'phrasal_verb';
  if (['prep', 'prepositional_phrase', 'edat'].includes(clean)) return 'prepositional_phrase';
  if (['idiom', 'deyim'].includes(clean)) return 'idiom';
  if (['collocation', 'kalip', 'kalıp'].includes(clean)) return 'collocation';
  if (['conj', 'conjunction', 'baglac', 'bağlaç'].includes(clean)) return 'conjunction';
  return 'other';
}

/**
 * Kelime kartlarını standart CSV formatında dışa aktarır.
 */
export function exportCardsToCSV(cards: VocabCard[]): string {
  const headers = [
    'English',
    'Turkish',
    'PartOfSpeech',
    'IPA',
    'Lemma',
    'OriginalSentence',
    'SentenceTranslation',
    'Prepositions',
    'Collocations',
    'AcademicUsage',
    'SourceType',
    'ExamYear',
    'SRSState',
    'IntervalDays',
  ];

  const escapeCSV = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = cards.map((c) => [
    escapeCSV(c.english),
    escapeCSV(c.turkish),
    escapeCSV(c.partOfSpeech),
    escapeCSV(c.ipa || ''),
    escapeCSV(c.lemma || ''),
    escapeCSV(c.originalSentence),
    escapeCSV(c.sentenceTranslation || ''),
    escapeCSV((c.prepositions || []).join('; ')),
    escapeCSV((c.collocations || []).join('; ')),
    escapeCSV(c.academicUsage || ''),
    escapeCSV(c.sourceType),
    escapeCSV(c.examInfo?.year || ''),
    escapeCSV(c.srs.state),
    escapeCSV(c.srs.interval),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Dosya indirme tetikleyicisi
 */
export function triggerDownload(content: string, fileName: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
