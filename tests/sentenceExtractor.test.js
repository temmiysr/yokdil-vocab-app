// Orijinal Cümle Çıkarma ve Kısaltma Koruma Testleri (ES Module)
import assert from 'node:assert';

export function extractSentenceForSelection(fullText, selectedText) {
  if (!fullText || !selectedText) return '';
  const cleanSelected = selectedText.trim();
  const targetIndex = fullText.toLowerCase().indexOf(cleanSelected.toLowerCase());
  if (targetIndex === -1) return cleanSelected;

  // Geriye doğru cümle başlangıcını bul
  let start = targetIndex;
  while (start > 0) {
    const char = fullText[start - 1];
    if (char === '\n' || char === '\r') break;
    if (['.', '!', '?'].includes(char)) {
      const precedingSub = fullText.slice(Math.max(0, start - 8), start).toLowerCase();
      // Kısaltma kontrolleri: e.g., i.e., etc., dr., vs., u.s., vb.
      const isAbbr = /(e\.g|i\.e|e\.|i\.|dr|mr|mrs|prof|vs|etc|u\.s|al)\.$/i.test(precedingSub);
      if (!isAbbr) break;
    }
    start--;
  }

  // İleriye doğru cümle sonunu bul
  let end = targetIndex + cleanSelected.length;
  while (end < fullText.length) {
    const char = fullText[end];
    if (char === '\n' || char === '\r') break;
    if (['.', '!', '?'].includes(char)) {
      const sub = fullText.slice(Math.max(0, end - 6), end + 1).toLowerCase();
      const nextChar = end + 1 < fullText.length ? fullText[end + 1] : '';
      const nextSub = fullText.slice(end + 1, Math.min(fullText.length, end + 4)).toLowerCase();

      // e.g. veya i.e. veya tek harf nokta (e.g. içindeki e. gibi)
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

  return fullText.slice(start, end).trim().replace(/\s+/g, ' ');
}

export function findSmartCollocation(sentence, target) {
  if (!sentence || !target || target.length < 2) return '';
  const cleanTarget = target.trim();
  const lowerSentence = sentence.toLowerCase();
  const lowerTarget = cleanTarget.toLowerCase();
  const idx = lowerSentence.indexOf(lowerTarget);
  if (idx === -1) return '';

  const beforeText = sentence.slice(0, idx).trim();
  const afterText = sentence.slice(idx + cleanTarget.length).trim();

  const beforeTokens = beforeText ? beforeText.split(/\s+/) : [];
  const afterTokens = afterText ? afterText.split(/\s+/) : [];

  const prepositions = new Set(['of', 'to', 'in', 'on', 'with', 'for', 'from', 'at', 'by', 'into', 'as', 'about', 'against', 'upon', 'between']);
  const articles = new Set(['a', 'an', 'the']);
  const verbs = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'remains', 'remained', 'becomes', 'became', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);

  // Durum A: Hedef kelimeden hemen sonra edat geliyorsa
  if (afterTokens.length >= 2 && prepositions.has(afterTokens[0].toLowerCase().replace(/[^a-z]/g, ''))) {
    const prep = afterTokens[0].replace(/[^a-z]/g, '');
    const nextWords = [];
    let i = 1;
    if (i < afterTokens.length && articles.has(afterTokens[i].toLowerCase().replace(/[^a-z]/g, ''))) {
      nextWords.push(afterTokens[i]);
      i++;
    }
    while (i < afterTokens.length && nextWords.length < 2) {
      const cleanW = afterTokens[i].replace(/[.,;:!?()"']/g, '');
      if (!cleanW || prepositions.has(cleanW.toLowerCase()) || verbs.has(cleanW.toLowerCase())) break;
      nextWords.push(cleanW);
      i++;
    }
    if (nextWords.length > 0) {
      return (cleanTarget + ' ' + prep + ' ' + nextWords.join(' ')).trim();
    }
  }

  // Durum B: Hedef kelime öncesinde niteleyici sıfat/isim varsa
  if (beforeTokens.length >= 1 && cleanTarget.split(/\s+/).length <= 2) {
    const prevWord = beforeTokens[beforeTokens.length - 1].replace(/^[.,;:!?()"']+|[.,;:!?()"']+$/g, '');
    if (prevWord.length > 2 && !articles.has(prevWord.toLowerCase()) && !prepositions.has(prevWord.toLowerCase())) {
      return (prevWord + ' ' + cleanTarget).trim();
    }
  }

  return '';
}

export function runSentenceExtractorTests() {
  console.log('\n--- 2. Cümle Çıkarma ve Metin Doğruluk Testleri ---');

  const text = "Technological advancements have significantly affected agricultural production. However, the shortage of natural resources remains a major challenge for developing countries (e.g. regions with arid climate). Finally, sustainable policies are essential.";

  // Test 1: Tek kelime seçimi
  const s1 = extractSentenceForSelection(text, "significantly");
  assert.strictEqual(
    s1,
    "Technological advancements have significantly affected agricultural production.",
    "İlk cümle tam olarak çıkarılmalı"
  );
  console.log('✓ Test 1: Tek kelimeden tam cümle çıkarma başarılı.');

  // Test 2: Çoklu kelime / Kalıp ifade seçimi ("shortage of natural resources")
  const s2 = extractSentenceForSelection(text, "shortage of natural resources");
  assert(
    s2.startsWith("However, the shortage"),
    "Cümle başlangıcı doğru tespit edilmeli"
  );
  assert(
    s2.includes("e.g. regions with arid climate"),
    "e.g. kısaltmasındaki nokta cümleyi erken bölmemeli"
  );
  console.log('✓ Test 2: Kalıp ifade seçimi ve kısaltma koruması (e.g.) başarılı.');

  // Test 3: Cümle sonundaki ifade ("major challenge")
  const s3 = extractSentenceForSelection(text, "remains a major challenge");
  assert(s3.includes("However, the shortage of natural resources remains a major challenge"));
  console.log('✓ Test 3: Cümle içi ve sonu yüklem öbeği yakalama başarılı.');

  // Test 4: Akıllı Kalıp İfade Genişletme (Smart Phrase Expansion)
  const exp1 = findSmartCollocation(s1, "production");
  assert.strictEqual(exp1, "agricultural production", "Öncesindeki niteleyici sıfat tamlaması yakalanmalı");

  const exp2 = findSmartCollocation(s2, "shortage");
  assert.strictEqual(exp2, "shortage of natural resources", "Sonrasındaki edatlı isim öbeği yakalanmalı");
  console.log('✓ Test 4: Akıllı kalıp genişletme (collocation & preposition) başarılı.');
}
