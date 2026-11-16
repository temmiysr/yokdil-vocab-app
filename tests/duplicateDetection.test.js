// Mükerrer Kelime Tespiti Birim Testleri (ES Module)
import assert from 'node:assert';

export function normalizeWord(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
    .replace(/\s+/g, ' ');
}

export function findDuplicateCard(cards, wordToFind) {
  const normalizedTarget = normalizeWord(wordToFind);
  if (!normalizedTarget) return undefined;

  return cards.find((card) => {
    const normExisting = normalizeWord(card.english);
    if (normExisting === normalizedTarget) return true;
    if (card.lemma && normalizeWord(card.lemma) === normalizedTarget) return true;
    return false;
  });
}

export function runDuplicateTests() {
  console.log('\n--- 3. Mükerrer Kelime Tespiti (Duplicate Detection) Testleri ---');

  const existingCards = [
    { id: '1', english: 'shortage of natural resources', turkish: 'doğal kaynak kıtlığı' },
    { id: '2', english: 'significantly', turkish: 'önemli ölçüde', lemma: 'significant' },
    { id: '3', english: 'attribute to', turkish: 'atfetmek' },
  ];

  // Test 1: Tam eşleşme (büyük/küçük harf farkı)
  const dup1 = findDuplicateCard(existingCards, 'Significantly');
  assert(dup1 !== undefined, 'Büyük/küçük harf farkı olan kelime tespit edilmeli');
  assert.strictEqual(dup1.id, '2');
  console.log('✓ Test 1: Büyük/küçük harf duyarsız mükerrer kelime tespiti başarılı.');

  // Test 2: Çoklu ifade ve kenar noktalama işaretleri
  const dup2 = findDuplicateCard(existingCards, '"shortage of natural resources"');
  assert(dup2 !== undefined, 'Tırnak içinde seçilen çoklu ifade tespit edilmeli');
  assert.strictEqual(dup2.id, '1');
  console.log('✓ Test 2: Noktalama ve boşluk temizliğiyle kalıp ifade tespiti başarılı.');

  // Test 3: Lemma (kök) eşleşmesi
  const dup3 = findDuplicateCard(existingCards, 'significant');
  assert(dup3 !== undefined, 'Kelimenin kökü havuzda varsa tespit edilmeli');
  console.log('✓ Test 3: Kök (lemma) eşleşmesiyle mükerrer kelime uyarısı doğrulandı.');

  // Test 4: Havuzda olmayan yeni kelime
  const dup4 = findDuplicateCard(existingCards, 'agricultural production');
  assert.strictEqual(dup4, undefined, 'Yeni kelime duplicate olarak algılanmamalı');
  console.log('✓ Test 4: Yeni kelimeler için mükerrer hatası verilmediği doğrulandı.');
}
