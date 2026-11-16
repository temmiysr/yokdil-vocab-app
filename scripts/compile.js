import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const basePath = 'C:/Users/user/.gemini/antigravity/scratch/yokdil-vocab-app';

console.log('Babel yükleniyor...');
const babelCode = fs.readFileSync(path.join(basePath, 'tests/babel.min.js'), 'utf8');

const sandbox = {
  window: {},
  navigator: {},
  document: {},
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};
sandbox.window = sandbox;
sandbox.global = sandbox;

vm.createContext(sandbox);
vm.runInContext(babelCode, sandbox);

const Babel = sandbox.Babel || sandbox.window.Babel;
if (!Babel) {
  console.error('Babel nesnesi bulunamadı!');
  process.exit(1);
}
console.log('✓ Babel başarıyla yüklendi. Versiyon:', Babel.version);

// JSX kodunu oku
const jsxCode = fs.readFileSync(path.join(basePath, 'tests/extracted_app.jsx'), 'utf8');
console.log('JSX derleniyor... Karakter sayısı:', jsxCode.length);

const start = Date.now();
const result = Babel.transform(jsxCode, {
  presets: ['react'],
  comments: false,
  compact: false,
});
console.log(`✓ Derleme tamamlandı! Süre: ${Date.now() - start} ms`);

const compiledPath = path.join(basePath, 'dist/app.js');
fs.writeFileSync(compiledPath, result.code, 'utf8');
console.log('✓ Çıktı kaydedildi:', compiledPath, 'Boyut:', result.code.length);
