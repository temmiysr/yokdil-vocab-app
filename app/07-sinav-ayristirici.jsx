    // --- YÖKDİL ÇIKMIŞ SINAV & DENEME AYRIŞTIRICI (EXAM PARSER) ---
    const EXAM_LETTERS = ['A', 'B', 'C', 'D', 'E'];

    // Soru tipleri. Her sınavın bölümleri PDF'teki "x. – y. sorularda …" talimatlarından çıkarılır
    // (YÖKDİL ve YDS'de sıra ve sayılar farklıdır). Talimat yoksa gerçek YÖKDİL düzeni varsayılır.
    const QTYPES = ['Kelime & Dil Bilgisi', 'Cloze Test', 'Cümle Tamamlama', 'Soru Bulma', 'Çeviri (İng→Tr)', 'Çeviri (Tr→İng)', 'Okuma', 'Yakın Anlam', 'Paragraf Tamamlama', 'Durum', 'Diyalog', 'Anlam Bütünlüğü'];
    const YOKDIL_DEFAULT = [[1, 20, 'Kelime & Dil Bilgisi'], [21, 30, 'Cloze Test'], [31, 41, 'Cümle Tamamlama'], [42, 47, 'Çeviri (İng→Tr)'], [48, 53, 'Çeviri (Tr→İng)'], [54, 59, 'Paragraf Tamamlama'], [60, 65, 'Anlam Bütünlüğü'], [66, 80, 'Okuma']];
    function yokdilCategory(num) {
      const r = YOKDIL_DEFAULT.find(([a, b]) => num >= a && num <= b);
      return r ? r[2] : 'Okuma';
    }
    // Talimat cümlesinden soru tipi
    function typeFromInstruction(text) {
      const t = String(text || '').toLocaleLowerCase('tr');
      if (/bozan/.test(t)) return 'Anlam Bütünlüğü';
      if (/getirilebilecek/.test(t)) return 'Paragraf Tamamlama';
      if (/numaralanmış/.test(t)) return 'Cloze Test';
      if (/karşılıklı konuşma|diyalog/.test(t)) return 'Diyalog';
      if (/durumda/.test(t)) return 'Durum';
      if (/hangi sorunun/.test(t)) return 'Soru Bulma';
      if (/ingilizce cümleye.*türkçe/.test(t)) return 'Çeviri (İng→Tr)';
      if (/türkçe cümleye.*ingilizce/.test(t)) return 'Çeviri (Tr→İng)';
      if (/parçalara göre|parçaya göre/.test(t)) return 'Okuma';
      if (/anlamca en yakın/.test(t)) return 'Yakın Anlam';
      if (/tamamlayan/.test(t)) return 'Cümle Tamamlama';
      if (/sözcük ya da ifade|boş bırakılan yerlere/.test(t)) return 'Kelime & Dil Bilgisi';
      return null;
    }
    // Eski kayıtlardaki adları ("Kelime Soruları (Soru 1-6)", "Gramer & Edat …") yeni tiplere çevir
    function canonicalType(s, num) {
      if (QTYPES.includes(s)) return s;
      const t = String(s || '');
      if (/Kelime|Gramer|Edat/.test(t)) return 'Kelime & Dil Bilgisi';
      if (/Cloze/.test(t)) return 'Cloze Test';
      if (/Cümle Tamamlama/.test(t)) return 'Cümle Tamamlama';
      if (/Çeviri/.test(t)) return 'Çeviri (İng→Tr)';
      if (/Okuma/.test(t)) return 'Okuma';
      if (/Paragraf/.test(t)) return 'Paragraf Tamamlama';
      return num ? yokdilCategory(num) : '';
    }
    const qSection = (q) => canonicalType(q.category, q.num);
    // Sınavın bölümleri, soru sırasına göre: [{ label, from, to, n }]
    function examSections(exam) {
      const map = new Map();
      [...(exam.questions || [])].sort((a, b) => a.num - b.num).forEach(q => {
        const l = qSection(q);
        const s = map.get(l) || { label: l, from: q.num, to: q.num, n: 0 };
        s.from = Math.min(s.from, q.num); s.to = Math.max(s.to, q.num); s.n++;
        map.set(l, s);
      });
      return [...map.values()].sort((a, b) => a.from - b.from);
    }
    // Yanlışlarım destesi: denemelerde yanlış/boş bırakılan sorular aralıklı tekrarla yeniden sorulur
    const MISTAKE_DAYS = [1, 3, 7, 21];
    function mistakeQuestions(exams, onlyDue = true) {
      const today = getTodayStr();
      const out = [];
      (exams || []).forEach(ex => Object.entries(ex.mistakes || {}).forEach(([num, m]) => {
        if (onlyDue && m.due > today) return;
        const q = (ex.questions || []).find(x => x.num === +num);
        if (!q || q.answer < 0) return;
        out.push({
          type: qSection(q), prompt: q.prompt || '(Parçadaki (' + q.num + ') numaralı boşluk)', passage: q.passage || '',
          options: q.options, answer: q.answer, cardIds: [],
          explain: 'Doğru cevap: ' + EXAM_LETTERS[q.answer] + ') ' + q.options[q.answer] + ' · ' + ex.title + ', soru ' + q.num + (m.wrongCount > 1 ? ' · ' + m.wrongCount + '. kez yanlış' : ''),
          mistakeRef: { examId: ex.id, num: q.num }, due: m.due,
        });
      }));
      return out.sort((a, b) => a.due.localeCompare(b.due));
    }
    // Kart filtresi: soru tipi ailesi ('Çeviri' iki yönü de kapsar)
    const QTYPE_FILTERS = ['Kelime & Dil Bilgisi', 'Cloze Test', 'Cümle Tamamlama', 'Çeviri', 'Paragraf Tamamlama', 'Okuma'];
    const cardMatchesQType = (c, f) => {
      if (f === 'exam') return !!(c.examInfo && c.examInfo.verified);
      if (!c.questionType) return false;
      const t = canonicalType(c.questionType);
      if (f === 'genel') return !t;
      if (f === 'Çeviri') return t.startsWith('Çeviri');
      return t === f;
    };

    // Cevap anahtarı: "1-A 2-C", "1.A", "1) C", "1 A" ya da yalnızca harf dizisi "ACDEB..." (1'den başlar)
    function parseAnswerKey(keyText) {
      const map = new Map();
      if (!keyText || !keyText.trim()) return map;
      for (const km of keyText.matchAll(/(\d{1,2})\s*[-.:)]?\s*([A-Ea-e])(?![A-Za-z])/g)) {
        const qn = parseInt(km[1], 10);
        if (qn >= 1 && qn <= 80 && !map.has(qn)) map.set(qn, km[2].toUpperCase());
      }
      if (!map.size) {
        const letters = keyText.replace(/[^A-Ea-e]/g, '').toUpperCase();
        if (letters.length >= 5) [...letters].slice(0, 80).forEach((L, i) => map.set(i + 1, L));
      }
      return map;
    }

    // Sayfa başlığı/altlığı gibi soruya ait olmayan satırlar
    const EXAM_NOISE_LINE = /^\s*(\d{1,3}|diğer sayfaya geçiniz\.?|.*soru kitapçığı.*|ösym|yökdil\s*[\/\-–].*|test b[iİ]tt[iİ].*|cevaplarınızı kontrol ediniz.*|bu testte \d+ soru vardır\.?)\s*$/i;
    const EXAM_GROUP_LINE = /^\s*(\d{1,2})\s*\.?\s*[-–—]\s*(\d{1,2})\s*\.?\s*sorular/i;

    // Şıkları bulur: yalnızca BÜYÜK harf "A)"–"E)" ve sırayla (A→B→C→D→E). "e.g." gibi ifadeler şık sanılmaz.
    function splitOptions(body) {
      const pos = [];
      let from = 0;
      for (const L of EXAM_LETTERS) {
        const re = new RegExp('(^|[\\s(])' + L + '\\)\\s*', 'g');
        re.lastIndex = from;
        const m = re.exec(body);
        if (!m) break;
        pos.push({ start: m.index + m[1].length, textStart: m.index + m[0].length });
        from = m.index + m[0].length;
      }
      if (pos.length < 4) return null;
      const opts = pos.map((p, i) => body.slice(p.textStart, i + 1 < pos.length ? pos[i + 1].start : body.length));
      return { prompt: body.slice(0, pos[0].start), opts };
    }

    function flatPassage(s) {
      // Satır sonlarını birleştir, gerçek paragraf aralarını koru
      return s.replace(/(\w)-\n(\w)/g, '$1$2').replace(/\n{2,}/g, '\u0000').replace(/\s*\n\s*/g, ' ').replace(/\u0000/g, '\n\n').replace(/[ ]{2,}/g, ' ').trim();
    }

    function parseYokdilExamText(text, answerKeyText = '') {
      if (!text || text.trim().length < 20) return [];
      let src = text.replace(/\r\n?/g, '\n').replace(/[ \t]/g, ' ');

      // Cevap anahtarı yalnızca kullanıcının girdiği alandan ya da metindeki "Cevap Anahtarı" bölümünden alınır.
      // Başlık metinde birkaç kez geçebilir ("…sonundaki Cevap Anahtarı ile karşılaştır"); ardından gerçekten
      // "1. E 2. C …" dizisi gelen ilk başlık seçilir.
      let keySection = '';
      for (const m of src.matchAll(/cevap\s+anahtar[ıi]/gi)) {
        const after = src.slice(m.index + m[0].length, m.index + m[0].length + 800);
        // "1. E 2. C …": harften sonra hemen bir sonraki numara gelir ("15. A gemstone…" gibi soru başları sayılmaz)
        if ((after.match(/(?:^|\s)\d{1,2}\s*[-.:)]?\s*[A-E](?=\s*(?:\d|$))/g) || []).length >= 4) {
          keySection = src.slice(m.index + m[0].length);
          src = src.slice(0, m.index);
          break;
        }
      }
      const answersMap = parseAnswerKey(answerKeyText);
      if (!answersMap.size && keySection) parseAnswerKey(keySection).forEach((v, k) => answersMap.set(k, v));

      const lines = src.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => !EXAM_NOISE_LINE.test(l));

      // Soru başlangıçları: satır başında "12." / "12)" ; numaralar artarak ilerlemeli
      const qStarts = [];
      let last = 0;
      lines.forEach((l, i) => {
        if (EXAM_GROUP_LINE.test(l)) return;
        const m = l.match(/^\s*(\d{1,2})\s*[.)](?:\s|$)/);
        if (!m) return;
        const n = parseInt(m[1], 10);
        if (n > last && n <= 80) { qStarts.push({ n, line: i, cut: m[0].length }); last = n; }
      });

      // "61-64. sorularda aşağıdaki parçaya göre cevaplayınız" → bu sorular için ortak parça
      const groups = [];
      lines.forEach((l, i) => {
        const g = l.match(EXAM_GROUP_LINE);
        if (g) groups.push({ from: +g[1], to: +g[2], line: i });
      });
      const isGroupLine = new Set(groups.map(g => g.line));
      // Talimat cümlesi bir sonraki satıra taşmış olabilir ("...parçaya göre\ncevaplayınız.", "...cümleyi\nbulunuz.")
      groups.forEach(g => { if (/^\s*(cevaplayınız|yanıtlayınız|bulunuz)\.?\s*$/i.test(lines[g.line + 1] || '')) isGroupLine.add(g.line + 1); });
      // Soru tipleri talimatlardan: önce geniş aralıklar, sonra dar aralıklar (alt gruplar) üzerine yazar
      const typeByNum = {};
      [...groups].sort((a, b) => (b.to - b.from) - (a.to - a.from)).forEach(g => {
        const t = typeFromInstruction(lines[g.line] + ' ' + (isGroupLine.has(g.line + 1) ? lines[g.line + 1] : ''));
        if (t) for (let n = g.from; n <= g.to; n++) typeByNum[n] = t;
      });

      const passages = {};
      groups.forEach(g => {
        const firstQ = qStarts.find(q => q.n === g.from);
        if (!firstQ || firstQ.line <= g.line) return;
        const body = [];
        for (let i = g.line + 1; i < firstQ.line; i++) if (!isGroupLine.has(i)) body.push(lines[i]);
        const txt = body.join('\n').trim();
        if (txt.replace(/\s/g, '').length > 80) for (let n = g.from; n <= g.to; n++) passages[n] = txt;
      });

      const questions = [];
      const pendingTails = {};
      qStarts.forEach((q, k) => {
        const endLine = k + 1 < qStarts.length ? qStarts[k + 1].line : lines.length;
        const bodyLines = [];
        for (let i = q.line; i < endLine; i++) {
          if (isGroupLine.has(i)) break; // talimat satırından sonrası bir sonraki parçaya aittir
          bodyLines.push(i === q.line ? lines[i].slice(q.cut) : lines[i]);
        }
        const sp = splitOptions(bodyLines.join('\n'));
        if (!sp) return;
        const opts = sp.opts.map(o => o.trim());
        // Son şıktan sonra uzun bir paragraf geldiyse (talimat satırı yoksa) bu bir sonraki sorunun parçasıdır
        const lastIdx = opts.length - 1;
        const tailLines = opts[lastIdx].split('\n');
        if (tailLines.length > 2 && tailLines.slice(1).join(' ').length > 250) {
          opts[lastIdx] = tailLines[0];
          pendingTails[q.n] = tailLines.slice(1).join('\n').trim();
        }
        const flat = s => s.replace(/(\w)-\n(\w)/g, '$1$2').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        const correctLetter = answersMap.get(q.n) || '';
        questions.push({
          num: q.n,
          prompt: flat(sp.prompt),
          options: EXAM_LETTERS.map((_, i) => flat(opts[i] || '')),
          answer: correctLetter ? EXAM_LETTERS.indexOf(correctLetter) : -1,
          category: typeByNum[q.n] || yokdilCategory(q.n),
          correctLetter,
        });
      });

      // Talimatsız bulunan parça: 61+ ise ortak parçası olmayan sonraki sorulara (en çok 4), değilse yalnızca bir sonraki soruya
      questions.forEach((q, i) => {
        const tail = pendingTails[q.num];
        if (!tail) return;
        const maxN = questions[i + 1] && questions[i + 1].num >= 61 ? 4 : 1;
        for (let j = i + 1; j < questions.length && j <= i + maxN; j++) {
          if (passages[questions[j].num]) break;
          passages[questions[j].num] = tail;
        }
      });
      questions.forEach(q => { if (passages[q.num]) q.passage = flatPassage(passages[q.num]); });
      return questions;
    }

    // Taranmış sayfanın ortasında boş dikey şerit var mı (iki sütunlu düzen)?
    function hasMiddleGutter(canvas) {
      try {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const x0 = Math.round(w * 0.46), sw = Math.round(w * 0.08), y0 = Math.round(h * 0.1), sh = Math.round(h * 0.8);
        const d = ctx.getImageData(x0, y0, sw, sh).data;
        let best = 0;
        for (let x = 0; x < sw; x += 2) {
          let dark = 0, n = 0;
          for (let y = 0; y < sh; y += 3) { const i = (y * sw + x) * 4; n++; if (d[i] + d[i + 1] + d[i + 2] < 384) dark++; }
          best = Math.max(best, 1 - dark / n);
        }
        return best > 0.985;
      } catch (e) { return false; }
    }

    // PDF'ten sınav metni: iki sütunlu sayfalar sütun sütun okunur; metin katmanı olmayan (taranmış) sayfalar OCR ile okunur.
    async function extractExamPdfText(buffer, onStatus) {
      if (!window.pdfjsLib) throw new Error('PDF okuyucu yüklenemedi (internet bağlantısını kontrol edin).');
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages = [];
      let worker = null, ocrPages = 0;
      try {
        for (let p = 1; p <= pdf.numPages; p++) {
          onStatus && onStatus('Sayfa ' + p + '/' + pdf.numPages + ' okunuyor...');
          const page = await pdf.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          const tc = await page.getTextContent();
          const items = tc.items.filter(it => it.str).map(it => ({ s: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 10 }));
          const chars = items.reduce((a, it) => a + it.s.replace(/\s/g, '').length, 0);
          // Taranmış sayfa: (neredeyse) hiç metin yok ya da az metin + sayfada resim var
          let scanned = chars < 15;
          if (!scanned && chars < 300) {
            try {
              const ops = await page.getOperatorList({ intent: 'print' });
              const O = pdfjsLib.OPS;
              scanned = ops.fnArray.some(fn => fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintJpegXObject);
            } catch (e) {}
          }
          if (scanned) {
            // Taranmış sayfa → OCR
            if (!window.Tesseract) throw new Error('Taranmış PDF için resim okuyucu (OCR) yüklenemedi.');
            if (!worker) {
              onStatus && onStatus('Resim okuyucu hazırlanıyor (ilk seferde biraz sürebilir)...');
              worker = await Tesseract.createWorker('eng');
              await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
            }
            ocrPages++;
            onStatus && onStatus('Sayfa ' + p + '/' + pdf.numPages + ' taranmış; OCR ile okunuyor...');
            const v2 = page.getViewport({ scale: 2.5 });
            const canvas = document.createElement('canvas');
            canvas.width = v2.width; canvas.height = v2.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: v2, intent: 'print' }).promise;
            const mid = Math.round(canvas.width / 2);
            const cols = hasMiddleGutter(canvas) ? [[0, mid], [mid, canvas.width]] : [[0, canvas.width]];
            const parts = [];
            for (const [x0, x1] of cols) {
              const { data } = await worker.recognize(canvas, { rectangle: { left: x0, top: 0, width: x1 - x0, height: canvas.height } });
              parts.push(data.text);
            }
            pages.push(parts.join('\n').split('\n'));
            continue;
          }
          // Satırları kur: aynı yükseklikteki parçalar bir satır. Sayfanın ortasından kesintisiz geçen satırlar
          // (talimat bantları, tam genişlikli metin) "bant ayırıcı" sayılır; aradaki bölgeler önce sol, sonra sağ sütun okunur.
          const mid = vp.width / 2;
          items.sort((a, b) => a.y - b.y || a.x - b.x);
          const rows = [];
          for (const it of items) {
            const r = rows[rows.length - 1];
            if (r && Math.abs(it.y - r.y) <= Math.max(2.5, it.h * 0.45)) r.items.push(it);
            else rows.push({ y: it.y, h: it.h, items: [it] });
          }
          // Parçaları birleştir: bitişikse boşluksuz ("a"+"ş"+"a"+"ğ"), genişçe boşluk karakteri = soru boşluğu (----)
          const joinItems = (arr) => {
            arr.sort((a, b) => a.x - b.x);
            let s = '', end = null;
            for (const t of arr) {
              const blank = !t.s.trim() && t.w > Math.max(18, t.h * 2.2);
              const piece = blank ? ' ---- ' : t.s;
              if (end !== null && t.x - end > 1.2 && !/\s$/.test(s) && !/^\s/.test(piece)) s += ' ';
              s += piece;
              end = t.x + t.w;
            }
            return s.replace(/\s+/g, ' ').trim();
          };
          const spans = (r) => {
            const its = r.items.filter(t => t.s.trim() || t.w > 0).sort((a, b) => a.x - b.x);
            if (its.some(t => t.x < mid - 4 && t.x + t.w > mid + 4)) return true;
            for (let k = 1; k < its.length; k++) {
              const a = its[k - 1], b = its[k];
              if (a.x + a.w <= mid + 4 && b.x >= mid - 4 && b.x - (a.x + a.w) < 6) return true;
            }
            return false;
          };
          const out = [];
          let band = { left: [], right: [] };
          const pushCol = (col) => {
            let lastY = null, prev = null;
            col.forEach(({ y, h, x, text }) => {
              if (!text) return;
              const gap = lastY !== null && y - lastY > h * 1.9;
              if (gap) out.push('');
              // Satır başındaki boşluk (----) PDF'te metin olarak yok; satır bir üstündekinden belirgin içeride başlıyorsa boşluk var demektir
              // (şık devam satırları ~18 pt içeride başlar, boşluk çizgisi ~35 pt)
              let t = text;
              if (prev && !gap && x - prev.x > 25 && !/^[A-E]\)/.test(t) && !/^[A-E]\)/.test(prev.text) && !/^-{3,}/.test(t)) t = '---- ' + t;
              out.push(t); lastY = y; prev = { x, text };
            });
          };
          const flushBand = () => { pushCol(band.left); pushCol(band.right); band = { left: [], right: [] }; };
          for (const r of rows) {
            if (spans(r)) { flushBand(); out.push(joinItems(r.items)); continue; }
            const L = r.items.filter(t => t.x + t.w / 2 < mid), R = r.items.filter(t => t.x + t.w / 2 >= mid);
            const minX = (arr) => Math.min(...arr.filter(t => t.s.trim()).map(t => t.x).concat([1e9]));
            if (L.length) band.left.push({ y: r.y, h: r.h, x: minX(L), text: joinItems(L) });
            if (R.length) band.right.push({ y: r.y, h: r.h, x: minX(R), text: joinItems(R) });
          }
          flushBand();
          pages.push(out);
        }
      } finally {
        if (worker) { try { await worker.terminate(); } catch (e) {} }
      }
      // Her sayfada tekrarlanan başlık / altlık satırlarını at (sayfa numarası farkı yok sayılır). Şıklar ("A) I") korunur.
      const norm = (l) => l.toLowerCase().replace(/\d+/g, '#').replace(/[\s()·|]/g, '');
      const freq = new Map();
      pages.forEach(lines => new Set(lines.map(norm)).forEach(k => k && freq.set(k, (freq.get(k) || 0) + 1)));
      const minRep = Math.max(3, Math.ceil(pages.length * 0.25));
      const isRepeated = (l) => l.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '').length >= 4 && !/^\s*([A-E]\)|\d{1,2}\s*[.)])/.test(l) && (freq.get(norm(l)) || 0) >= minRep;
      return { text: pages.map(lines => lines.filter(l => !isRepeated(l)).join('\n')).join('\n\n'), pages: pdf.numPages, ocrPages };
    }

