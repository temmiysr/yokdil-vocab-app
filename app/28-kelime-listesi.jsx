    // --- KELİME LİSTESİ PDF'İ İÇE AKTARMA ---
    // Tablo biçimli kelime listelerini okur: "No | English | Türkçe", "No | Kelime | Anlamı | Ek Bilgiler",
    // "S.No | EN · Okunuş | TR", yan yana iki tablo olan sayfalar. Her satır numarasıyla bulunur, ilk satır
    // boşluklara göre hücrelere bölünür, alt satırlara taşan metin üstündeki hücreye eklenir.
    const WL_NUM_HDR = /^(s\.?\s*no|no|sıra)$/i;
    const WL_EN_HDR = /^(english|ingilizce|kelime|word|en\b)/i;
    const WL_TR_HDR = /^(türkçe|anlamı|anlam|tr|meaning)$/i;
    async function extractWordListPdf(buffer, onStatus) {
      if (!window.pdfjsLib) throw new Error('PDF okuyucu yüklenemedi (internet bağlantısını kontrol edin).');
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const entries = [];
      let numCols = null;                // önceki sayfanın numara sütunları (başlıksız sayfalar için)
      for (let p = 1; p <= pdf.numPages; p++) {
        if (onStatus && (p === 1 || p % 5 === 0)) onStatus('Sayfa ' + p + '/' + pdf.numPages + ' okunuyor…');
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ s: it.str, f: it.fontName, x: it.transform[4], y: vp.height - it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 9 }));
        // Başlık satırları (ör. "S.No  English  Türkçe")
        const hdrs = items.filter(it => WL_NUM_HDR.test(it.s.trim()) && items.some(o => Math.abs(o.y - it.y) < 3 && o.x > it.x && (WL_EN_HDR.test(o.s.trim()) || WL_TR_HDR.test(o.s.trim()))));
        if (hdrs.length) numCols = hdrs.map(h => h.x).sort((a, b) => a - b);
        if (!numCols) continue;
        const hdrYs = hdrs.map(h => h.y);
        // Satır numaraları: numara sütununun hizasındaki salt sayılar
        const nums = items.filter(it => /^\d{1,5}$/.test(it.s.trim()) && numCols.some(x => Math.abs(it.x - x) < 22) && it.y < vp.height - 50);
        nums.sort((a, b) => a.y - b.y || a.x - b.x);
        const tableOf = (x) => { let k = 0; numCols.forEach((c, i) => { if (x >= c - 15) k = i; }); return k; };
        for (const n of nums) {
          const t = tableOf(n.x);
          const x0 = numCols[t] - 15, x1 = t + 1 < numCols.length ? numCols[t + 1] - 15 : vp.width;
          const below = nums.filter(o => tableOf(o.x) === t && o.y > n.y + 2).map(o => o.y);
          const stops = [...below, ...hdrYs.filter(y => y > n.y + 2), vp.height - 50, n.y + 140];
          const yEnd = Math.min(...stops) - 3;
          const mine = items.filter(it => it !== n && it.x >= x0 && it.x < x1 && it.y >= n.y - 3 && it.y < yEnd);
          if (!mine.length) continue;
          // İlk satırdaki parçalar → hücreler (geniş boşlukta yeni hücre)
          const first = mine.filter(it => Math.abs(it.y - n.y) < 3).sort((a, b) => a.x - b.x);
          const cells = [];
          first.forEach(it => {
            const c = cells[cells.length - 1];
            if (c && it.x - c.end < 10) { c.items.push(it); c.end = Math.max(c.end, it.x + it.w); }
            else cells.push({ start: it.x, end: it.x + it.w, items: [it] });
          });
          if (!cells.length) continue;
          // Alt satırlar: başlangıcı en yakın (solundaki) hücreye
          mine.filter(it => Math.abs(it.y - n.y) >= 3).forEach(it => {
            let best = null;
            cells.forEach(c => { if (it.x >= c.start - 25 && (!best || c.start > best.start)) best = c; });
            (best || cells[0]).items.push(it);
          });
          const text = (arr) => {
            const lines = [];
            [...arr].sort((a, b) => a.y - b.y || a.x - b.x).forEach(it => {
              const l = lines[lines.length - 1];
              if (l && Math.abs(it.y - l.y) < 3) l.items.push(it); else lines.push({ y: it.y, items: [it] });
            });
            return lines.map(l => {
              let s = '', end = null;
              l.items.sort((a, b) => a.x - b.x).forEach(it => { if (end !== null && it.x - end > 1.2 && !/\s$/.test(s)) s += ' '; s += it.s; end = it.x + it.w; });
              return s.trim();
            }).filter(Boolean);
          };
          const enCell = cells[0], trCell = cells[1], exCell = cells[2];
          // İngilizce hücresi: ilk yazı tipi = kelime, farklı (italik) yazı tipindeki kısım = okunuş
          const enItems = [...enCell.items].sort((a, b) => a.y - b.y || a.x - b.x);
          const f0 = enItems[0].f;
          const en = text(enItems.filter(it => it.f === f0)).join(' ').replace(/\s+/g, ' ').trim();
          const okunus = text(enItems.filter(it => it.f !== f0)).join(' ').trim();
          if (!en || /^\d+$/.test(en)) continue;
          entries.push({
            no: +n.s.trim(), page: p,
            en, okunus,
            trLines: trCell ? text(trCell.items) : [],
            extraLines: exCell ? text(exCell.items) : [],
          });
        }
      }
      return { entries, pages: pdf.numPages };
    }

    // Satırı karta dönüştürülecek biçime çevir
    const WL_POS = { 'f.': 'verb', 'i.': 'noun', 's.': 'adjective', 'zf.': 'adverb', 'edat': 'preposition', 'bağ.': 'conjunction', 'ünl.': 'interjection', 'zm.': 'pronoun' };
    const WL_PREPS = new Set(['to', 'of', 'in', 'on', 'with', 'for', 'from', 'at', 'by', 'as', 'about', 'against', 'into', 'upon', 'over', 'between', 'among', 'towards', 'toward', 'through', 'off', 'out', 'up']);
    function normalizeWordEntry(e) {
      const english = e.en.replace(/\s*,\s*/g, ', ').trim();
      // "abort by", "acclaim as, by" → kök "abort", "acclaim"; edatlar kartta kalır
      const toks = english.toLowerCase().split(/[\s,]+/).filter(Boolean);
      const lemma = toks.length > 1 && toks.slice(1).every(t => WL_PREPS.has(t)) ? toks[0] : english.toLowerCase();
      // Türkçe anlam: satırları birleştir, ";" ile ayrılmış ilk 4 anlam; sözlükteki "f. / i. / s." türü kelime türü olur
      const trAll = e.trLines.join(' ').replace(/\s+/g, ' ').trim();
      // Anlamlar ";" ile ya da yeni bir tür kısaltmasıyla ("f. …", "i. …") başlayan satırla ayrılır
      const senses = e.trLines.join('\n').split(/\s*;\s*|\n(?=(?:zf|f|i|s|edat|bağ|ünl|zm)\.\s)/).map(s => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      let pos = '';
      const m = (senses[0] || '').match(/^(zf\.|f\.|i\.|s\.|edat|bağ\.|ünl\.|zm\.)\s*/);
      if (m) pos = WL_POS[m[1]] || '';
      const turkish = senses.slice(0, 4).map(s => s.replace(/^(?:[a-zçğıöşü]{1,5}\.\s*,?)+\s*/i, '').replace(/\.$/, '')).filter(Boolean).join('; ');
      const extra = e.extraLines.join(' ');
      const ipaM = extra.match(/Okunuşu:\s*\/\s*([^/]+?)\s*\//);
      const ipa = ipaM ? ipaM[1].replace(/\s+/g, '').replace(/ʼ/g, 'ˈ') : '';
      const hece = (extra.match(/Hecelenişi:\s*([^\s]+)/) || [])[1] || '';
      return { english, lemma, turkish, trFull: trAll, pos, ipa, okunus: e.okunus || (ipa ? ipaToTurkish(ipa) : ''), hyphenation: hece, no: e.no };
    }

