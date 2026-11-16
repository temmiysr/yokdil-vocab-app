import fs from 'node:fs';
import path from 'node:path';

const basePath = 'C:/Users/user/.gemini/antigravity/scratch/yokdil-vocab-app';
const html = fs.readFileSync(path.join(basePath, 'dist/index.html'), 'utf8');
const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('Babel script tag bulunamadı!');
  process.exit(1);
}

const code = match[1];
fs.writeFileSync(path.join(basePath, 'tests/extracted_app.jsx'), code, 'utf8');
console.log('App JSX başarıyla çıkarıldı. Karakter sayısı:', code.length);
