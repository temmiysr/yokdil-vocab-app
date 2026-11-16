// Yayın derlemesi: dist/ klasörünü _site/ altına kopyalar ve index.html içindeki JSX kodunu önceden
// JavaScript'e çevirir. Böylece tarayıcı 3 MB'lık Babel'i indirip her açılışta derlemek zorunda kalmaz.
// Yerelde (baslat.bat / serve.js) dist/index.html olduğu gibi çalışmaya devam eder.
//   Kullanım: npm i --no-save @babel/standalone@7.26.4 && node scripts/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babelMod = require(process.env.BABEL_PATH || '@babel/standalone');
const Babel = babelMod.transform ? babelMod : (babelMod.default || globalThis.Babel);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const src = path.join(root, 'dist');
const out = path.join(root, '_site');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true, filter: (p) => !/[\\/]_test-[^\\/]*$/.test(p) && !p.endsWith('app.js') });

const file = path.join(out, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) throw new Error('index.html içinde <script type="text/babel"> bulunamadı');
const t0 = Date.now();
const { code } = Babel.transform(m[1], { presets: ['react'], compact: false, comments: false });
html = html.replace(m[0], () => '<script>\n' + code + '\n</script>');
// Artık gerekmeyen Babel yüklemeleri
const before = html.length;
html = html.replace(/\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"[^>]*><\/script>/, '');
html = html.replace(/\s*document\.write\('<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@babel\/standalone@[^']+'\);/, '');
if (html.length === before) throw new Error('Babel <script> etiketi bulunamadı');
if (/babel-standalone|@babel\/standalone/.test(html)) throw new Error('Babel yüklemesi tamamen kaldırılamadı');
fs.writeFileSync(file, html);
console.log('✓ Derlendi (' + (Date.now() - t0) + ' ms): ' + Math.round(m[1].length / 1024) + ' KB JSX → ' + Math.round(code.length / 1024) + ' KB JS');
