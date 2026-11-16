import { VocabCard } from '../types/vocab';

/**
 * Metin içerisinden seçilen bir ifadenin geçtiği orijinal cümleyi tam olarak bulur.
 * Kısaltmaları (e.g., i.e., Dr., vs., etc.) dikkate alarak yanlış bölünmeleri engeller.
 */
export function extractSentenceForSelection(
  fullText: string,
  selectedText: string,
  selectionStartIndex?: number
): string {
  if (!fullText || !selectedText) return '';

  const cleanSelected = selectedText.trim();
  if (!cleanSelected) return '';

  // Eğer seçim başlangıç indeksi biliniyorsa doğrudan oradan geriye ve ileriye tara
  let targetIndex = -1;
  if (selectionStartIndex !== undefined && selectionStartIndex >= 0) {
    targetIndex = selectionStartIndex;
  } else {
    // Büyük/küçük harf duyarsız ilk eşleşmeyi bul
    targetIndex = fullText.toLowerCase().indexOf(cleanSelected.toLowerCase());
  }

  if (targetIndex === -1) {
    // Metin içinde bulunamazsa en azından seçili ifadeyi döndür
    return cleanSelected;
  }

  // Geriye doğru cümle başlangıcını bul
  let start = targetIndex;
  while (start > 0) {
    const char = fullText[start - 1];
    if (char === '\n' || char === '\r') {
      break;
    }
    if (['.', '!', '?'].includes(char)) {
      const precedingSub = fullText.slice(Math.max(0, start - 8), start).toLowerCase();
      const isAbbr = /(e\.g|i\.e|e\.|i\.|dr|mr|mrs|prof|vs|etc|u\.s|al)\.$/i.test(precedingSub);
      if (!isAbbr) {
        break;
      }
    }
    start--;
  }

  // İleriye doğru cümle sonunu bul
  let end = targetIndex + cleanSelected.length;
  while (end < fullText.length) {
    const char = fullText[end];
    if (char === '\n' || char === '\r') {
      break;
    }
    if (['.', '!', '?'].includes(char)) {
      const sub = fullText.slice(Math.max(0, end - 6), end + 1).toLowerCase();
      const nextSub = fullText.slice(end + 1, Math.min(fullText.length, end + 4)).toLowerCase();

      const isAbbr =
        /(e\.g|i\.e|dr|mr|mrs|prof|vs|etc|u\.s|al)\.$/i.test(sub) ||
        (/\b[a-z]\.$/i.test(sub) && /^[a-z]\./i.test(nextSub));

      if (!isAbbr) {
        end++; // Noktalama işaretini dahil et
        break;
      }
    }
    end++;
  }

  const rawSentence = fullText.slice(start, end).trim();
  return rawSentence.replace(/\s+/g, ' ');
}

/**
 * Kelimeyi veya çoklu ifadeyi normalize eder (küçük harf, kenar boşlukları ve gereksiz noktalama temizliği).
 */
export function normalizeWord(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
    .replace(/\s+/g, ' ');
}

/**
 * Var olan kelime havuzunda aynı ifadenin daha önce kaydedilip kaydedilmediğini denetler.
 * Mükerrer kelime tespiti için kullanılır.
 */
export function findDuplicateCard(cards: VocabCard[], wordToFind: string): VocabCard | undefined {
  const normalizedTarget = normalizeWord(wordToFind);
  if (!normalizedTarget) return undefined;

  return cards.find((card) => {
    const normExisting = normalizeWord(card.english);
    if (normExisting === normalizedTarget) return true;
    if (card.lemma && normalizeWord(card.lemma) === normalizedTarget) return true;
    return false;
  });
}

/**
 * Okuma metninde kaydedilmiş kelimelerin vurgulanması için metni segmentlere ayırır.
 */
export interface HighlightSegment {
  text: string;
  isSaved: boolean;
  card?: VocabCard;
}

export function segmentTextWithSavedWords(
  text: string,
  savedCards: VocabCard[]
): HighlightSegment[] {
  if (!text || savedCards.length === 0) {
    return [{ text, isSaved: false }];
  }

  // Uzun ifadeler önce gelecek şekilde sırala
  const sortedCards = [...savedCards].sort((a, b) => b.english.length - a.english.length);

  const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const patterns = sortedCards.map((c) => escapeRegex(c.english.trim())).filter(Boolean);

  if (patterns.length === 0) {
    return [{ text, isSaved: false }];
  }

  const combinedRegex = new RegExp(`\\b(${patterns.join('|')})\\b`, 'gi');

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchText = match[0];

    if (matchStart > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchStart),
        isSaved: false,
      });
    }

    const matchingCard = sortedCards.find(
      (c) => normalizeWord(c.english) === normalizeWord(matchText)
    );

    segments.push({
      text: matchText,
      isSaved: true,
      card: matchingCard,
    });

    lastIndex = matchStart + matchText.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isSaved: false,
    });
  }

  return segments;
}
