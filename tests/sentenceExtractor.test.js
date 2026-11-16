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
}
