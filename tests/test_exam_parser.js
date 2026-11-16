import assert from 'node:assert';

export function parseYokdilExamText(text, answerKeyText = '') {
  if (!text || text.trim().length < 20) return [];

  const answersMap = new Map();
  const combinedForKeys = (answerKeyText + '\n' + text);
  const keyMatches = combinedForKeys.matchAll(/(?:^|[\s,;])(\d{1,2})\s*[-.:)]\s*([A-Ea-e])(?=[\s,;]|$)/g);
  for (const km of keyMatches) {
    const qn = parseInt(km[1], 10);
    const ans = km[2].toUpperCase();
    if (qn >= 1 && qn <= 80 && !answersMap.has(qn)) {
      answersMap.set(qn, ans);
    }
  }

  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/\d{1,2}\s*[-–]\s*\d{1,2}\.\s*sorularda[^\n]+/gi, '')
    .replace(/CEVAP ANAHTARI[\s\S]*$/i, '');

  const qRegex = /(?:^|\n)\s*(\d{1,2})\s*[\.\)]\s*([\s\S]*?)(?=(?:^|\n)\s*\d{1,2}\s*[\.\)]|\s*$)/g;
  const questions = [];

  for (const m of clean.matchAll(qRegex)) {
    const num = parseInt(m[1], 10);
    const body = m[2].trim();
    if (num < 1 || num > 80 || body.length < 10) continue;

    const optRegex = /(?:^|\s|\n)([A-Ea-e])\s*[\)\.\-]\s*([\s\S]*?)(?=(?:^|\s|\n)[A-Ea-e]\s*[\)\.\-]|\s*$)/g;
    const optsFound = [];
    let promptEnd = -1;

    for (const om of body.matchAll(optRegex)) {
      if (promptEnd === -1) {
        promptEnd = om.index;
      }
      optsFound.push({ letter: om[1].toUpperCase(), text: om[2].trim().replace(/\s+/g, ' ') });
    }

    if (optsFound.length >= 4) {
      const prompt = promptEnd > 0 ? body.slice(0, promptEnd).trim().replace(/\s+/g, ' ') : body;
      const options = ['A', 'B', 'C', 'D', 'E'].map(L => {
        const found = optsFound.find(o => o.letter === L);
        return found ? found.text : '';
      });

      let category = 'Genel';
      if (num <= 6) category = 'Kelime Soruları (Soru 1-6)';
      else if (num <= 16) category = 'Gramer & Edat (Soru 7-16)';
      else if (num <= 26) category = 'Cloze Test (Soru 17-26)';
      else if (num <= 36) category = 'Cümle Tamamlama (Soru 27-36)';
      else if (num <= 48) category = 'Çeviri Soruları (Soru 37-48)';
      else if (num <= 60) category = 'Paragraf & Anlam Bütünlüğü (Soru 49-60)';
      else category = 'Okuma Parçası Soruları (Soru 61-80)';

      const correctLetter = answersMap.get(num);
      const answerIdx = correctLetter ? ['A', 'B', 'C', 'D', 'E'].indexOf(correctLetter) : -1;

      questions.push({
        num,
        prompt,
        options,
        answer: answerIdx,
        category,
        correctLetter: correctLetter || ''
      });
    }
  }

  return questions;
}

export function runExamParserTests() {
  console.log('\n--- 5. Çıkmış Sınav (YÖKDİL PDF & Soru Ayrıştırma) Testleri ---');

  const sampleText = `
1. The recent economic crisis has severely affected the stability of developing countries.
A) significantly
B) accurately
C) relatively
D) arbitrarily
E) implicitly

2. In order to achieve sustainable development, governments must ---- harmful carbon emissions.
A) curb B) trigger C) intensify D) neglect E) provoke

7. Many chronic diseases are associated ---- environmental toxins and genetic predisposition.
A) with
B) from
C) to
D) in
E) for

CEVAP ANAHTARI
1-A 2-A 7-A
`;

  const parsed = parseYokdilExamText(sampleText);
  assert.strictEqual(parsed.length, 3, '3 soru ayrıştırılmalı');
  assert.strictEqual(parsed[0].num, 1);
  assert.strictEqual(parsed[0].category, 'Kelime Soruları (Soru 1-6)');
  assert.strictEqual(parsed[0].options[0], 'significantly');
  assert.strictEqual(parsed[0].answer, 0); // 1-A -> 0
  console.log('✓ Test 1: Çok satırlı soru ve şık ayrıştırma başarılı.');

  assert.strictEqual(parsed[1].num, 2);
  assert.strictEqual(parsed[1].options[0], 'curb');
  assert.strictEqual(parsed[1].answer, 0);
  console.log('✓ Test 2: Tek satırlı (yatay) şık ayrıştırma başarılı.');

  assert.strictEqual(parsed[2].num, 7);
  assert.strictEqual(parsed[2].category, 'Gramer & Edat (Soru 7-16)');
  assert.strictEqual(parsed[2].options[0], 'with');
  assert.strictEqual(parsed[2].answer, 0);
  console.log('✓ Test 3: Soru tipi sınıflandırması ve cevap anahtarı eşleştirmesi başarılı.');
}
