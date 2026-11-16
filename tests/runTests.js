// YÖKDİL Master - Otomatik Test Çalıştırıcısı (ES Module)
import { runSrsTests } from './srs.test.js';
import { runSentenceExtractorTests } from './sentenceExtractor.test.js';
import { runDuplicateTests } from './duplicateDetection.test.js';
import { runImportExportTests } from './importExport.test.js';
import { runExamParserTests } from './test_exam_parser.js';

console.log('====================================================');
console.log('   YÖKDİL MASTER - TEMEL BİRİM VE SİSTEM TESTLERİ   ');
console.log('====================================================');

const startTime = Date.now();

try {
  runSrsTests();
  runSentenceExtractorTests();
  runDuplicateTests();
  runImportExportTests();
  runExamParserTests();

  const duration = Date.now() - startTime;
  console.log('\n====================================================');
  console.log(`✓ TÜM TESTLER BAŞARIYLA GEÇTİ (${duration} ms)`);
  console.log('====================================================\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ TEST BAŞARISIZ OLDU:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
