// Sınav ayrıştırıcısı ve kelime listesi dönüştürücüsü için otomatik testler.
// dist/index.html içindeki fonksiyonları doğrudan alır (kopyası yok), sentetik örnek metinlerle dener.
// Örnek metinler bu proje için yazılmıştır; gerçek sınav içeriği değildir.
//   Çalıştırma: node tests/parser.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const slice = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('Kod bölümü bulunamadı: ' + from);
  return html.slice(a, b);
};
const parserSrc = slice('// --- YÖKDİL ÇIKMIŞ SINAV & DENEME AYRIŞTIRICI', '// Taranmış sayfanın ortasında');
const wordSrc = slice('// Satırı karta dönüştürülecek biçime çevir', '// --- HERKESE AÇIK KÜTÜPHANE');
const P = new Function(parserSrc + '\nreturn { parseYokdilExamText, parseAnswerKey, examSections, qSection, typeFromInstruction, cardMatchesQType };')();
const W = new Function('ipaToTurkish', wordSrc + '\nreturn { normalizeWordEntry };')((ipa) => 'okunus:' + ipa);

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message.split('\n').join('\n    ')); }
};

// --- 1) Klasik biçim: "e.g." soruyu bölmemeli, cloze ve okuma parçaları bağlanmalı ---
const classic = `1. - 6. sorularda, cümlede boş bırakılan yere uygun düşen sözcük ya da ifadeyi bulunuz.
1. Several chronic conditions, e.g. diabetes, can be ---- by regular
exercise and a balanced diet.
A) alleviated B) abandoned
C) accumulated D) exaggerated
E) abolished
2. The researchers ---- that the new material could withstand extreme temperatures.
A) demonstrated
B) consumed
C) refused
D) eliminated
E) postponed
17. - 18. sorularda, aşağıdaki parçada numaralanmış yerlere uygun düşen sözcük ya da ifadeyi bulunuz.
Glaciers have been retreating (17)---- the last century, and scientists warn that this trend
will accelerate (18)---- global temperatures continue to rise at the current rate across the world.
17. A) during B) since C) among D) despite E) beyond
18. A) unless B) as long as C) even though D) so that E) whereas
3
Diğer sayfaya geçiniz.
61. - 62. sorularda aşağıdaki parçaya göre cevaplayınız.
Photosynthesis is the process by which green plants convert light energy into chemical
energy. During this process, carbon dioxide and water are transformed into glucose and
oxygen. The efficiency of photosynthesis depends on several factors, such as light
intensity, temperature and the concentration of carbon dioxide in the atmosphere.
61. According to the passage, photosynthesis ----.
A) only occurs at night
B) converts light energy into chemical energy
C) produces carbon dioxide
D) is unaffected by temperature
E) takes place in animal cells
62. It is stated in the passage that the efficiency of photosynthesis ----.
A) is constant
B) depends on several factors
C) increases at low temperatures
D) is unrelated to light
E) has never been measured
CEVAP ANAHTARI
1-A 2-A 17-B 18-B 61-B 62-B`;

console.log('Klasik biçim');
const qa = P.parseYokdilExamText(classic);
test('6 soru bulunur', () => assert.deepEqual(qa.map(q => q.num), [1, 2, 17, 18, 61, 62]));
test('"e.g." soruyu bölmez', () => {
  assert.match(qa[0].prompt, /e\.g\. diabetes, can be ---- by regular exercise/);
  assert.deepEqual(qa[0].options, ['alleviated', 'abandoned', 'accumulated', 'exaggerated', 'abolished']);
});
test('cevap anahtarı eşleşir', () => assert.equal(qa.map(q => q.correctLetter).join(''), 'AABBBB'));
test('cloze parçası 17 ve 18\'e bağlanır', () => {
  assert.match(qa[2].passage, /^Glaciers have been retreating/);
  assert.equal(qa[3].passage, qa[2].passage);
});
test('okuma parçası 61-62\'ye bağlanır, sayfa altlığı karışmaz', () => {
  assert.match(qa[4].passage, /^Photosynthesis is the process/);
  assert.ok(!/Diğer sayfaya/.test(qa[3].options.join(' ')));
});
test('anahtarsız sorular -1', () => {
  const q = P.parseYokdilExamText(classic.replace(/CEVAP ANAHTARI[\s\S]*$/, ''));
  assert.ok(q.every(x => x.answer === -1 && x.correctLetter === ''));
});
test('kullanıcının girdiği anahtar öncelikli', () => {
  const q = P.parseYokdilExamText(classic, 'CDEABC');
  assert.equal(q.find(x => x.num === 1).correctLetter, 'C');
});

// --- 2) Deneme kitapçığı biçimi: talimat bantları, alt gruplar, metinde birkaç kez geçen "Cevap Anahtarı" ---
const booklet = `Örnek Deneme Sınavı (Cevap Anahtarlı)
Cevaplarını ayrı bir kâğıda yaz; bitince kitapçığın sonundaki Cevap Anahtarı ile karşılaştır.
1. – 2. sorularda, cümlede boş bırakılan yerlere uygun düşen sözcük ya da ifadeyi bulunuz.
1. The new telescope has the ---- to detect very faint galaxies.
A) ability
B) clarity
C) reliance
D) amount
E) theory
2. A good scientist ---- every result before publishing it.
A) checks
B) borrows
C) paints
D) sells
E) ignores
3. – 4. sorularda, verilen İngilizce cümleye anlamca en yakın Türkçe cümleyi bulunuz.
3. Water boils at a lower temperature on high mountains.
A) Su, yüksek dağlarda daha düşük sıcaklıkta kaynar.
B) Su, yüksek dağlarda hiç kaynamaz.
C) Dağlarda su daha geç donar.
D) Yüksek sıcaklıkta su buharlaşmaz.
E) Su, deniz seviyesinde daha düşük sıcaklıkta kaynar.
4. Bees play a key role in pollinating many crops.
A) Arılar ürünlere zarar verir.
B) Arılar birçok ürünün tozlaşmasında önemli bir rol oynar.
C) Arılar yalnızca çiçeklerde yaşar.
D) Ürünler arı olmadan da yetişir.
E) Arılar bal üretmek için tozlaşır.
5. – 6. sorularda, aşağıdaki parçalara göre soruları cevaplayınız.
5. – 6. sorular
Coral reefs cover less than one percent of the ocean floor, yet they support about a quarter of all
marine species. Rising sea temperatures cause corals to expel the algae living in their tissues,
which turns them white and can eventually kill them.
5. According to the passage, coral reefs ----.
A) cover most of the ocean floor
B) support a large share of marine species
C) are not affected by temperature
D) live without algae
E) are always white
6. It is stated in the passage that rising sea temperatures ----.
A) help corals grow
B) have no effect on algae
C) can kill corals
D) reduce marine species
E) cool the ocean floor
TEST BİTTİ. Cevaplarını kontrol et; ardından cevap anahtarına geç.
Cevap Anahtarı
1. A 2. A 3. A
4. B 5. B 6. C
Çözüm İpuçları
3. soru (A): yüksek dağlar → daha düşük sıcaklık.`;

console.log('Deneme kitapçığı biçimi');
const qb = P.parseYokdilExamText(booklet);
test('6 soru bulunur, metin ilk "Cevap Anahtarı" geçişinde kesilmez', () => assert.equal(qb.length, 6));
test('gerçek anahtar tablosu bulunur', () => assert.equal(qb.map(q => q.correctLetter).join(''), 'AAABBC'));
test('bölümler talimatlardan çıkarılır', () => {
  assert.deepEqual(P.examSections({ questions: qb }).map(s => s.label), ['Kelime & Dil Bilgisi', 'Çeviri (İng→Tr)', 'Okuma']);
});
test('okuma parçası alt gruptan alınır', () => assert.match(qb[4].passage, /^Coral reefs cover less than one percent/));
test('"TEST BİTTİ" son şıkka karışmaz', () => assert.equal(qb[5].options[4], 'cool the ocean floor'));

console.log('Soru tipleri');
test('talimat → soru tipi', () => {
  const t = P.typeFromInstruction;
  assert.equal(t('21. – 30. sorularda, aşağıdaki parçalarda numaralanmış yerlere uygun düşen sözcük ya da ifadeyi bulunuz.'), 'Cloze Test');
  assert.equal(t('31. – 41. sorularda, verilen cümleyi uygun şekilde tamamlayan ifadeyi bulunuz.'), 'Cümle Tamamlama');
  assert.equal(t('48. – 53. sorularda, verilen Türkçe cümleye anlamca en yakın İngilizce cümleyi bulunuz.'), 'Çeviri (Tr→İng)');
  assert.equal(t('54. – 59. sorularda, boş bırakılan yere, parçada anlam bütünlüğünü sağlamak için getirilebilecek cümleyi bulunuz.'), 'Paragraf Tamamlama');
  assert.equal(t('60. – 65. sorularda, cümleler sırasıyla okunduğunda parçanın anlam bütünlüğünü bozan cümleyi bulunuz.'), 'Anlam Bütünlüğü');
  assert.equal(t('73. – 76. sorularda, karşılıklı konuşmanın boş bırakılan kısmını tamamlayabilecek ifadeyi bulunuz.'), 'Diyalog');
});
test('eski kayıt adları yeni tiplere çevrilir', () => {
  assert.equal(P.qSection({ num: 3, category: 'Kelime Soruları (Soru 1-6)' }), 'Kelime & Dil Bilgisi');
  assert.equal(P.qSection({ num: 70 }), 'Okuma');
});
test('kart filtresi', () => {
  assert.ok(P.cardMatchesQType({ questionType: 'Gramer & Edat (7-16)' }, 'Kelime & Dil Bilgisi'));
  assert.ok(P.cardMatchesQType({ questionType: 'Çeviri (Tr→İng)' }, 'Çeviri'));
  assert.ok(P.cardMatchesQType({ examInfo: { verified: true } }, 'exam'));
});

console.log('Cevap anahtarı');
test('farklı yazımlar', () => {
  const m = P.parseAnswerKey('1-A 2.B 3) C 4 D');
  assert.deepEqual([...m.entries()], [[1, 'A'], [2, 'B'], [3, 'C'], [4, 'D']]);
  assert.equal(P.parseAnswerKey('ABCDE').get(5), 'E');
});

console.log('Kelime listesi satırları');
test('edatlı giriş kök kelimeye iner', () => {
  const r = W.normalizeWordEntry({ no: 3, en: 'abstain from', okunus: '', trLines: ['Kaçınmak, çekinmek'], extraLines: [] });
  assert.equal(r.lemma, 'abstain'); assert.equal(r.english, 'abstain from'); assert.equal(r.turkish, 'Kaçınmak, çekinmek');
});
test('sözlük satırı: tür, anlamlar ve IPA', () => {
  const r = W.normalizeWordEntry({ no: 1, en: 'sample', okunus: '', trLines: ['i. örnek, numune;', 'f. örneklemek.'], extraLines: ['Hecelenişi: sam·ple', 'Okunuşu: /ˈsɑːmp(ə)l /'] });
  assert.equal(r.pos, 'noun'); assert.equal(r.turkish, 'örnek, numune; örneklemek'); assert.equal(r.ipa, 'ˈsɑːmp(ə)l'); assert.equal(r.hyphenation, 'sam·ple');
});

console.log('\n' + passed + ' test geçti' + (failed ? ', ' + failed + ' test BAŞARISIZ' : ''));
if (failed) process.exit(1);
