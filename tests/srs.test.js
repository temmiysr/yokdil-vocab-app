// SRS Algoritması Birim Testleri (ES Module)
import assert from 'node:assert';

export function createInitialSRSItem(cardId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    cardId,
    state: 'new',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    nextReviewAt: today,
    reviewHistory: [],
  };
}

export function addDaysToDate(dateStr, days) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function processReview(item, rating, currentDate = new Date()) {
  const todayStr = currentDate.toISOString().slice(0, 10);
  let newRepetitions = item.repetitions;
  let newEase = item.easeFactor;
  let newInterval = item.interval;
  let newLapses = item.lapses;
  let newState = item.state;

  if (rating === 1) {
    newRepetitions = 0;
    newInterval = 1;
    newEase = Math.max(1.3, newEase - 0.2);
    newLapses += 1;
    newState = 'learning';
  } else {
    if (newRepetitions === 0) {
      if (rating === 2) {
        newInterval = 1;
        newEase = Math.max(1.3, newEase - 0.15);
      } else if (rating === 3) {
        newInterval = 1;
      } else if (rating === 4) {
        newInterval = 3;
        newEase = Math.min(3.0, newEase + 0.15);
      }
      newRepetitions = 1;
      newState = 'learning';
    } else if (newRepetitions === 1) {
      if (rating === 2) {
        newInterval = 2;
        newEase = Math.max(1.3, newEase - 0.15);
      } else if (rating === 3) {
        newInterval = 3;
      } else if (rating === 4) {
        newInterval = 6;
        newEase = Math.min(3.0, newEase + 0.15);
      }
      newRepetitions = 2;
      newState = 'learning';
    } else if (newRepetitions === 2) {
      if (rating === 2) {
        newInterval = 4;
        newEase = Math.max(1.3, newEase - 0.1);
      } else if (rating === 3) {
        newInterval = 7;
      } else if (rating === 4) {
        newInterval = 12;
        newEase = Math.min(3.0, newEase + 0.15);
      }
      newRepetitions = 3;
      newState = 'review';
    } else {
      let modifier = 1.0;
      if (rating === 2) {
        modifier = 0.8;
        newEase = Math.max(1.3, newEase - 0.15);
      } else if (rating === 4) {
        modifier = 1.3;
        newEase = Math.min(3.0, newEase + 0.15);
      }
      newInterval = Math.max(newInterval + 1, Math.round(newInterval * newEase * modifier));
      newRepetitions += 1;
      newState = newInterval >= 30 ? 'mastered' : 'review';
    }
  }

  newEase = Math.round(newEase * 100) / 100;
  const nextReviewDate = addDaysToDate(todayStr, newInterval);

  return {
    ...item,
    state: newState,
    interval: newInterval,
    easeFactor: newEase,
    repetitions: newRepetitions,
    lapses: newLapses,
    lastReviewedAt: new Date().toISOString(),
    nextReviewAt: nextReviewDate,
  };
}

export function runSrsTests() {
  console.log('--- 1. Aralıklı Tekrar (SRS) SM-2 Algoritması Testleri ---');

  // Test 1: Başlangıç durumu
  const initial = createInitialSRSItem('card_1');
  assert.strictEqual(initial.interval, 0, 'Başlangıç aralığı 0 olmalı');
  assert.strictEqual(initial.easeFactor, 2.5, 'Başlangıç kolaylık faktörü 2.5 olmalı');
  assert.strictEqual(initial.repetitions, 0, 'Başlangıç tekrar sayısı 0 olmalı');
  assert.strictEqual(initial.lapses, 0, 'Başlangıç hata sayısı 0 olmalı');
  console.log('✓ Test 1: Başlangıç SRS kartı başarıyla oluşturuldu.');

  // Test 2: İlk tekrar rating 3 (İyi) -> aralık 1 gün
  const rev1 = processReview(initial, 3);
  assert.strictEqual(rev1.interval, 1, 'İlk başarılı tekrarda aralık 1 gün olmalı');
  assert.strictEqual(rev1.repetitions, 1, 'Tekrar sayısı 1 olmalı');
  assert.strictEqual(rev1.state, 'learning', 'Durum learning olmalı');
  console.log('✓ Test 2: 1. başarılı tekrar hesaplaması doğrulandı (1 gün).');

  // Test 3: İkinci tekrar rating 3 (İyi) -> aralık 3 gün
  const rev2 = processReview(rev1, 3);
  assert.strictEqual(rev2.interval, 3, 'İkinci başarılı tekrarda aralık 3 gün olmalı');
  assert.strictEqual(rev2.repetitions, 2);
  console.log('✓ Test 3: 2. başarılı tekrar hesaplaması doğrulandı (3 gün).');

  // Test 4: Üçüncü tekrar rating 3 (İyi) -> aralık 7 gün
  const rev3 = processReview(rev2, 3);
  assert.strictEqual(rev3.interval, 7, 'Üçüncü başarılı tekrarda aralık 7 gün olmalı');
  assert.strictEqual(rev3.repetitions, 3);
  assert.strictEqual(rev3.state, 'review');
  console.log('✓ Test 4: 3. başarılı tekrar hesaplaması doğrulandı (7 gün).');

  // Test 5: Dördüncü tekrar rating 4 (Kolay) -> aralık katlanarak artar, ease factor yükselir
  const rev4 = processReview(rev3, 4);
  assert(rev4.interval >= 20, 'Kolay değerlendirmede aralık hızla artmalı');
  assert(rev4.easeFactor > 2.5, 'Kolay değerlendirmede easeFactor artmalı');
  console.log(`✓ Test 5: Kolay değerlendirmede SM-2 çarpanı test edildi (Aralık: ${rev4.interval} gün, Çarpan: ${rev4.easeFactor}).`);

  // Test 6: Tekrar değerlendirmesi (Rating 1 - Hatırlayamadım)
  const failed = processReview(rev4, 1);
  assert.strictEqual(failed.interval, 1, 'Başarısız tekrarda aralık 1 güne sıfırlanmalı');
  assert.strictEqual(failed.repetitions, 0, 'Tekrar sayısı sıfırlanmalı');
  assert.strictEqual(failed.lapses, 1, 'Lapse sayısı 1 artmalı');
  assert(failed.easeFactor < rev4.easeFactor, 'Başarısızlıkta kolaylık katsayısı düşmeli');
  console.log('✓ Test 6: Başarısızlıkta (Again/Tekrar) ceza puanı ve aralık sıfırlama doğrulandı.');
}
