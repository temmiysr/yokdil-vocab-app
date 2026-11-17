// app/ klasöründeki kaynak dosyalarını birleştirip dist/index.html'i üretir.
//   Uygulama kodu app/NN-ad.jsx dosyalarındadır (sıra önemli: dosya adındaki numara). Sayfa iskeleti
//   app/index.template.html; içindeki /*@@APP_KODU@@*/ yerine dosyalar sırayla eklenir.
//   Kullanım:  node scripts/assemble.mjs          → dist/index.html'i yazar
//              node scripts/assemble.mjs --check  → dist/index.html güncel değilse hata verir
// serve.js de bu fonksiyonu kullanır: yerel sunucu her istekte app/ klasöründen güncel sayfayı üretir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist', 'index.html');

export function assemble() {
  const tpl = fs.readFileSync(path.join(APP, 'index.template.html'), 'utf8');
  const files = fs.readdirSync(APP).filter(f => /^\d{2}-.+\.jsx$/.test(f)).sort();
  if (!files.length) throw new Error('app/ klasöründe kaynak dosya yok');
  const code = files.map(f => fs.readFileSync(path.join(APP, f), 'utf8')).join('');
  if (!tpl.includes('/*@@APP_KODU@@*/')) throw new Error('index.template.html içinde /*@@APP_KODU@@*/ yok');
  return tpl.replace(/\/\*@@APP_KODU@@\*\/\r?\n/, () => code);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const html = assemble();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur.replace(/\r\n/g, '\n') !== html.replace(/\r\n/g, '\n')) { console.error('✗ dist/index.html güncel değil: node scripts/assemble.mjs çalıştırın'); process.exit(1); }
    console.log('✓ dist/index.html güncel');
  } else {
    fs.writeFileSync(OUT, html);
    console.log('✓ dist/index.html yazıldı (' + Math.round(html.length / 1024) + ' KB)');
  }
}
