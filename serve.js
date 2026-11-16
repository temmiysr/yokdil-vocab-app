// YÖKDİL Master - Sıfır Bağımlılıklı Yerel Web Sunucusu (Zero-dependency HTTP Server)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.join(__dirname, 'dist');

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
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(DIST_DIR, reqPath);

  // Dosya dist içinde yoksa SPA yönlendirmesi olarak dist/index.html sunulur
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end(`500: Sunucu Hatası: ${err.code}`);
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

// Otomatik Port Çakışması Yönetimi (Port 3000 doluysa 3001, 3002... dener)
function startServer(port) {
  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`  YÖKDİL Master Web Sunucusu Başlatıldı!`);
    console.log(`  Yerel Adres: http://localhost:${port}`);
    console.log(`======================================================\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Bilgi] Port ${port} kullanımda, ${port + 1} portu deneniyor...`);
      startServer(port + 1);
    } else {
      console.error('Sunucu başlatma hatası:', err);
    }
  });
}

startServer(DEFAULT_PORT);
