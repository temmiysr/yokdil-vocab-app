// YÖKDİL Master - Sıfır Bağımlılıklı Yerel Web Sunucusu (Zero-dependency HTTP Server)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.ts': 'text/plain; charset=UTF-8',
  '.tsx': 'text/plain; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8',
  '.csv': 'text/csv; charset=UTF-8',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  // Kök adres doğrudan derlenmiş uygulamayı (dist/index.html) açar
  if (reqPath === '/' || reqPath === '/index.html') reqPath = '/dist/index.html';

  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Dosya mevcut değilse ve kök veya dist dosyasıysa kontrol et
  if (!fs.existsSync(filePath)) {
    const distPath = path.join(PUBLIC_DIR, 'dist', reqPath);
    if (fs.existsSync(distPath)) {
      filePath = distPath;
    } else {
      // SPA Fallback: dist/index.html
      filePath = path.join(PUBLIC_DIR, 'dist', 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404: Dosya bulunamadı.');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end(`500: Sunucu Hatası: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  YÖKDİL Master Web Sunucusu Başlatıldı!`);
  console.log(`  Yerel Adres: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
