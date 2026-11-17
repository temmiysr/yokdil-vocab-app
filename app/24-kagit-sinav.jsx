    // --- KÂĞIT SINAV PROVASI ---
    // Denemeyi kitapçık gibi yazdırır (iki sütun, bölüm talimatları, parçalar) + optik form (+ istenirse cevap anahtarı)
    const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function printExamBooklet(ex, withKey) {
      const qs = [...(ex.questions || [])].sort((a, b) => a.num - b.num);
      const secs = examSections({ questions: qs });
      let body = '', lastSec = '', lastPassage = '';
      qs.forEach(q => {
        const sec = qSection(q);
        if (sec !== lastSec) {
          const s = secs.find(x => x.label === sec);
          body += '<div class="band"><b>' + s.from + (s.to !== s.from ? '. – ' + s.to : '') + '. sorularda,</b> ' + escHtml((SECTION_INSTRUCTIONS[sec] || '').replace(/^./, c => c.toLocaleLowerCase('tr'))) + '</div>';
          lastSec = sec; lastPassage = '';
        }
        if (q.passage && q.passage !== lastPassage) {
          const grp = qs.filter(x => x.passage === q.passage);
          body += '<div class="passage">' + (grp.length > 1 ? '<div class="plabel">' + grp[0].num + '. – ' + grp[grp.length - 1].num + '. sorular</div>' : '') + escHtml(q.passage).replace(/\n/g, '<br>') + '</div>';
          lastPassage = q.passage;
        }
        body += '<div class="q"><div class="stem"><b>' + q.num + '.</b> ' + escHtml(q.prompt || '').replace(/\n/g, '<br>') + '</div>' +
          q.options.map((o, i) => '<div class="opt"><b>' + EXAM_LETTERS[i] + ')</b> ' + escHtml(o) + '</div>').join('') + '</div>';
      });
      // Optik form: 4 sütun × 20 satır
      const n = qs.length, rowsPer = Math.ceil(n / 4);
      let form = '<div class="formgrid">';
      for (let c = 0; c < 4; c++) {
        form += '<div>';
        qs.slice(c * rowsPer, (c + 1) * rowsPer).forEach(q => {
          form += '<div class="frow"><span class="fnum">' + q.num + '</span>' + EXAM_LETTERS.map(L => '<span class="bub">' + L + '</span>').join('') + '</div>';
        });
        form += '</div>';
      }
      form += '</div>';
      const key = withKey ? '<div class="page"><h2>Cevap Anahtarı</h2><div class="keygrid">' + qs.map(q => '<span><b>' + q.num + '.</b> ' + (q.answer >= 0 ? EXAM_LETTERS[q.answer] : '–') + '</span>').join('') + '</div></div>' : '';
      const html = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + escHtml(ex.title) + '</title><style>' +
        '@page{size:A4;margin:14mm 12mm}body{font-family:Georgia,"Times New Roman",serif;font-size:10.5pt;color:#111;margin:0}' +
        'h1{font-family:Arial,sans-serif;font-size:15pt;margin:0 0 2mm}h2{font-family:Arial,sans-serif;font-size:13pt}.meta{font-family:Arial,sans-serif;font-size:9pt;color:#555;margin-bottom:4mm}' +
        '.cols{column-count:2;column-gap:8mm;column-rule:1px solid #ccc}.band{column-span:all;background:#eee;border-radius:3px;padding:2mm 3mm;margin:3mm 0;font-family:Arial,sans-serif;font-size:9.5pt}' +
        '.passage{border:1px solid #bbb;border-radius:3px;padding:2.5mm;margin:0 0 3mm;text-align:justify;line-height:1.45}.plabel{font-family:Arial,sans-serif;font-weight:bold;font-size:8.5pt;margin-bottom:1mm}' +
        '.q{break-inside:avoid;margin:0 0 4mm}.stem{margin-bottom:1.2mm;line-height:1.4}.opt{margin:0.6mm 0 0.6mm 3mm}' +
        '.page{break-before:page}.formgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;font-family:Arial,sans-serif}.frow{display:flex;align-items:center;gap:1.6mm;margin:1.3mm 0}' +
        '.fnum{width:7mm;text-align:right;font-weight:bold;font-size:9pt}.bub{width:5.2mm;height:5.2mm;border:1px solid #444;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:7pt;color:#666}' +
        '.keygrid{display:grid;grid-template-columns:repeat(8,1fr);gap:2mm;font-family:Arial,sans-serif}.foot{font-family:Arial,sans-serif;font-size:8pt;color:#777;margin-top:4mm}' +
        '</style></head><body><h1>' + escHtml(ex.title) + '</h1><div class="meta">' + n + ' soru · süre ' + Math.max(10, Math.round(180 * Math.min(80, n) / 80)) + ' dakika · her doğru 1,25 puan; yanlışlar doğruları götürmez</div>' +
        '<div class="cols">' + body + '</div>' +
        '<div class="page"><h2>Cevap Kâğıdı</h2><div class="meta">Ad Soyad: ____________________ Tarih: ____________ · Cevaplarınızı daireleri doldurarak işaretleyin; sonra uygulamada "📝 Kâğıttan cevap gir" ile girin.</div>' + form + '</div>' +
        key + '<div class="foot">YÖKDİL Master ile hazırlandı.</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
      const w = window.open('', '_blank');
      if (!w) { alert('Yazdırma penceresi açılamadı. Tarayıcınızın açılır pencere engelini bu site için kaldırın.'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }

    // Kâğıtta çözülen denemenin cevaplarını girme
    function PaperAnswerModal({ exam, onClose, onSubmit }) {
      const qs = [...(exam.questions || [])].sort((a, b) => a.num - b.num);
      const [ans, setAns] = useState({});
      const [quick, setQuick] = useState('');
      const applyQuick = (txt) => {
        setQuick(txt);
        const letters = txt.toUpperCase().replace(/[^A-E\-_ ]/g, '');
        const next = {};
        [...letters].forEach((ch, i) => { if (qs[i] && /[A-E]/.test(ch)) next[qs[i].num] = EXAM_LETTERS.indexOf(ch); });
        setAns(next);
      };
      const filled = Object.keys(ans).length;
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl max-w-3xl w-full space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">📝 Kâğıttan cevap gir · {exam.title}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <label className="block text-[11px] text-slate-400">Hızlı giriş: cevapları sırayla harf olarak yazın, boş bıraktıklarınız için "-" (ör. ACDB-EA…)
              <input value={quick} onChange={e => applyQuick(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white font-mono tracking-widest" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
              {qs.map(q => (
                <div key={q.num} className="flex items-center gap-1">
                  <span className="w-6 text-right text-[11px] font-bold text-slate-400">{q.num}</span>
                  {EXAM_LETTERS.map((L, i) => (
                    <button key={L} onClick={() => setAns(a => { const n = { ...a }; if (n[q.num] === i) delete n[q.num]; else n[q.num] = i; return n; })}
                      className={"w-6 h-6 rounded-full text-[10px] font-bold border " + (ans[q.num] === i ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-700 text-slate-500 hover:border-blue-500')}>{L}</button>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">{filled} / {qs.length} işaretlendi</span>
              <button onClick={() => onSubmit(ans)} disabled={!filled} className="px-5 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50">Puanla ve analiz et</button>
            </div>
          </div>
        </div>
      );
    }

