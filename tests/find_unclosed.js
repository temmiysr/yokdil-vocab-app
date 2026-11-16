import fs from 'node:fs';

const code = fs.readFileSync('C:/Users/user/.gemini/antigravity/scratch/yokdil-vocab-app/tests/extracted_app.jsx', 'utf8');

// Find any <input without />
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (/<input\b[^>]*[^/]>/.test(line)) {
    console.log(`Unclosed input tag at line ${idx + 1}:`, line.trim());
  }
  if (/<img\b[^>]*[^/]>/.test(line)) {
    console.log(`Unclosed img tag at line ${idx + 1}:`, line.trim());
  }
});
console.log('Unclosed tag check finished.');
