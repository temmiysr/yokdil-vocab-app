import fs from 'node:fs';

const code = fs.readFileSync('C:/Users/user/.gemini/antigravity/scratch/yokdil-vocab-app/tests/extracted_app.jsx', 'utf8');

// Basit JSX etiket dengesi kontrolü
const openTags = (code.match(/<[A-Za-z][A-Za-z0-9]*(\s+[^>]*)?>/g) || []).filter(t => !t.endsWith('/>'));
const closeTags = code.match(/<\/[A-Za-z][A-Za-z0-9]*>/g) || [];
console.log('Open tags count:', openTags.length);
console.log('Close tags count:', closeTags.length);

// Fonksiyon tanımlarını kontrol et
const functions = code.match(/function\s+([A-Za-z0-9_]+)/g) || [];
console.log('Functions found:', functions.join(', '));
