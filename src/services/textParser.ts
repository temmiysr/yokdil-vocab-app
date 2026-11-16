/**
 * Okuma metinleri için dosya ayrıştırma ve metin çıkarma servisi.
 * PDF, Word (.docx), Fotoğraf (OCR) ve Düz Metin (.txt) formatlarını destekler.
 * Paragraf ve cümle yapısını titizlikle korur.
 */

/**
 * Düz metin (.txt) dosyasından metin okur.
 */
export async function parsePlainTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      resolve(normalizeExtractedText(text));
    };
    reader.onerror = () => reject(new Error('Düz metin dosyası okunamadı.'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Word (.docx) dosyasından metin çıkarır.
 * Mammoth kütüphanesi yüklüyse onu kullanır; yoksa docx ZIP içerisindeki word/document.xml'i
 * doğrudan ayrıştırarak paragraf yapılarını (<w:p>) koruyarak metni çıkarır.
 */
export async function parseDocxFile(file: File): Promise<string> {
  try {
    // Dinamik mammoth yüklemesi kontrolü
    if ((window as any).mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      return normalizeExtractedText(result.value);
    }

    // Tarayıcı içi doğrudan ZIP ayrıştırma (mammoth veya kütüphane henüz yüklenmemişse bile çalışır)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('utf-8');
    const rawContent = textDecoder.decode(bytes);

    // XML parçalarını yakala
    const pMatches = rawContent.match(/<w:p[\s>].*?<\/w:p>/gs);
    if (pMatches && pMatches.length > 0) {
      const paragraphs = pMatches.map((pXml) => {
        const textParts = pXml.match(/<w:t[\s>].*?<\/w:t>/gs) || [];
        return textParts
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join('');
      }).filter((line) => line.trim().length > 0);

      return paragraphs.join('\n\n');
    }

    // Fallback: tüm metin etiketlerini temizle
    const fallbackText = rawContent
      .replace(/<w:p[\s>]/g, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t\u00C0-\u017F]/g, '');

    return normalizeExtractedText(fallbackText);
  } catch (error) {
    console.error('Word (.docx) ayrıştırma hatası:', error);
    throw new Error('Word dosyası metne dönüştürülürken bir hata oluştu.');
  }
}

/**
 * PDF dosyasından metin çıkarır.
 * PDF.js kütüphanesi varsa sayfa sayfa paragrafları koruyarak çıkarır.
 */
export async function parsePdfFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = (window as any).pdfjsLib;

    if (pdfjsLib) {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      let fullText = '';

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        let lastY = -1;
        let pageStr = '';

        for (const item of textContent.items as any[]) {
          if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 8) {
            // Yeni satır / paragraf algılandı
            pageStr += '\n';
          }
          pageStr += item.str + ' ';
          lastY = item.transform[5];
        }

        fullText += pageStr + '\n\n';
        if (onProgress) {
          onProgress(Math.round((pageNum / numPages) * 100));
        }
      }

      return normalizeExtractedText(fullText);
    }

    // Basit metin akışı taraması (PDF.js hazır değilse)
    const textDecoder = new TextDecoder('latin1');
    const rawPdf = textDecoder.decode(new Uint8Array(arrayBuffer));
    const streamMatches = rawPdf.match(/BT[\s\S]*?ET/g) || [];
    let extracted = '';

    for (const stream of streamMatches) {
      const textParts = stream.match(/\((.*?)\)\s*T[jJ]/g) || [];
      const line = textParts
        .map((t) => t.replace(/[\\()]/g, '').trim())
        .filter(Boolean)
        .join(' ');
      if (line) {
        extracted += line + ' ';
      }
    }

    if (extracted.trim().length > 50) {
      return normalizeExtractedText(extracted);
    }

    throw new Error(
      'PDF dosyası taranmış görsel olabilir veya korumalıdır. Lütfen metni kopyalayıp yapıştırın veya görsel olarak yükleyip OCR özelliğini kullanın.'
    );
  } catch (error: any) {
    console.error('PDF ayrıştırma hatası:', error);
    throw new Error(error.message || 'PDF dosyası ayrıştırılamadı.');
  }
}

/**
 * Görseller ve taranmış belgeler için İstemci Taraflı OCR işlemi.
 * Tesseract.js entegrasyonu ile çalışır.
 * İlerleme durumunu (yüzde ve açıklama) bildirir.
 */
export async function performImageOcr(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  try {
    const Tesseract = (window as any).Tesseract;
    if (!Tesseract) {
      // Dinamik CDN yüklemesi
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    }

    const tesseractInstance = (window as any).Tesseract;
    if (!tesseractInstance) {
      throw new Error('OCR motoru yüklenemedi. İnternet bağlantınızı kontrol ediniz.');
    }

    const result = await tesseractInstance.recognize(file, 'eng', {
      logger: (m: any) => {
        if (onProgress && m.status) {
          const pct = Math.round((m.progress || 0) * 100);
          const trStatus =
            m.status === 'recognizing text'
              ? 'Metin tanınıyor...'
              : m.status === 'loading tesseract core'
              ? 'OCR motoru başlatılıyor...'
              : m.status === 'loading language traineddata'
              ? 'İngilizce dil modeli yükleniyor...'
              : 'Görsel taranıyor...';
          onProgress(pct, trStatus);
        }
      },
    });

    return normalizeExtractedText(result.data.text);
  } catch (err: any) {
    console.error('OCR Hatası:', err);
    throw new Error('Görselden metin okuma sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
  }
}

/**
 * Yardımcı: Harici betik yükleyici
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script yüklenemedi: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Çıkarılan metni standartlaştırır, gereksiz boşlukları ve kırık satırları temizler.
 */
export function normalizeExtractedText(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Sayfa numarası gibi tek başına kalan satırları temizle
    .replace(/^\s*\d+\s*$/gm, '')
    // Tire ile bölünmüş kelimeleri birleştir (örn: sig- \n nificantly -> significantly)
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    // Art arda gelen birden fazla boşluğu teke indir
    .replace(/[ \t]+/g, ' ')
    // 3 ve daha fazla yeni satırı 2 yeni satıra (paragraf boşluğu) indir
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
