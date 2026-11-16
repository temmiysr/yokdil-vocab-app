// CSV ve JSON İçe/Dışa Aktarım Testleri (ES Module)
import assert from 'node:assert';

export function parseCSVLine(line, delimiter = ',') {
  const result = [];
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

export function runImportExportTests() {
  console.log('\n--- 4. CSV ve JSON Ayrıştırma (Import/Export) Testleri ---');

  // Test 1: Virgüllü ve tırnaklı standart CSV
  const csvLine1 = '"shortage of natural resources","doğal kaynak kıtlığı","collocation","Technological advancements have significantly affected agricultural production, but shortage remains."';
  const parsed1 = parseCSVLine(csvLine1, ',');
  assert.strictEqual(parsed1.length, 4, '4 sütun başarıyla ayrılmalı');
  assert.strictEqual(parsed1[0], 'shortage of natural resources');
  assert.strictEqual(parsed1[1], 'doğal kaynak kıtlığı');
  console.log('✓ Test 1: Tırnak içi virgül içeren karmaşık CSV satırı doğru ayrıştırıldı.');

  // Test 2: Noktalı virgül (Excel Türkiye formatı)
  const csvLine2 = 'advancement;ilerleme;noun;in;"major advancement"';
  const parsed2 = parseCSVLine(csvLine2, ';');
  assert.strictEqual(parsed2.length, 5);
  assert.strictEqual(parsed2[1], 'ilerleme');
  console.log('✓ Test 2: Noktalı virgül ayırıcılı Excel CSV satırı doğru ayrıştırıldı.');

  // Test 3: Çift tırnak kaçış karakteri ("" -> ")
  const csvLine3 = '"word with ""quotes""","tırnaklı kelime"';
  const parsed3 = parseCSVLine(csvLine3, ',');
  assert.strictEqual(parsed3[0], 'word with "quotes"');
  console.log('✓ Test 3: Kaçış tırnakları ("") başarıyla temizlendi.');
}
