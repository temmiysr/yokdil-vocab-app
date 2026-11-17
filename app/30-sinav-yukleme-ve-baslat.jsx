    // --- YÖKDİL ÇIKMIŞ SINAV & DENEME YÜKLEME MODALI ---
    function UploadExamModal({ onClose, onSave }) {
      const [title, setTitle] = useState('');
      const [field, setField] = useState('Fen Bilimleri');
      const [year, setYear] = useState(new Date().getFullYear());
      const [term, setTerm] = useState('İlkbahar');
      const [mode, setMode] = useState('file');
      const [fileStatus, setFileStatus] = useState('');
      const [rawText, setRawText] = useState('');
      const [answerKeyText, setAnswerKeyText] = useState('');
      const [isParsing, setIsParsing] = useState(false);
      const [parsedQuestions, setParsedQuestions] = useState([]);
      const [showPreview, setShowPreview] = useState(false);

      const readAnyText = async (file, onStatus) => {
        const buffer = await file.arrayBuffer();
        const name = file.name.toLowerCase();
        if (name.endsWith('.pdf')) return extractExamPdfText(buffer, onStatus);
        if (name.endsWith('.docx')) {
          if (!window.mammoth) throw new Error('Word okuyucu yüklenemedi.');
          const res = await mammoth.extractRawText({ arrayBuffer: buffer });
          return { text: res.value, ocrPages: 0 };
        }
        return { text: new TextDecoder('utf-8').decode(buffer), ocrPages: 0 };
      };

      // Dosya adından yıl / dönem / alan tahmini ("2023-ilkbahar-yokdil-saglik.pdf")
      const guessMetaFromName = (fname) => {
        const n = fname.toLocaleLowerCase('tr');
        const y = n.match(/20\d\d/);
        if (y) setYear(parseInt(y[0], 10));
        if (/sonbahar|güz|guz|kas[ıi]m|ekim/.test(n)) setTerm('Sonbahar');
        else if (/ilkbahar|bahar|mart|nisan|mayıs|mayis/.test(n)) setTerm('İlkbahar');
        if (/sa[gğ]l[ıi]k/.test(n)) setField('Sağlık Bilimleri');
        else if (/sosyal/.test(n)) setField('Sosyal Bilimler');
        else if (/fen/.test(n)) setField('Fen Bilimleri');
      };

      const handleKeyFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          setFileStatus('Cevap anahtarı okunuyor...');
          const { text } = await readAnyText(file, setFileStatus);
          const map = parseAnswerKey(text.replace(/CEVAP\s+ANAHTARI/i, ''));
          if (!map.size) { setFileStatus('❌ Cevap anahtarı dosyasında "1-A" ya da "1. A" biçiminde cevap bulunamadı.'); return; }
          const keyStr = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([n, L]) => n + '-' + L).join(' ');
          handleKeyChange(keyStr);
          setFileStatus('✓ Cevap anahtarından ' + map.size + ' cevap alındı.');
        } catch (err) { setFileStatus('❌ ' + (err.message || 'Cevap anahtarı okunamadı.')); }
      };

      const handleFileChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setIsParsing(true);
        setFileStatus(`"${file.name}" okunuyor ve sorular taranıyor...`);
        try {
          if (!title) {
            const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            setTitle(cleanName);
          }
          guessMetaFromName(file.name);
          const { text, ocrPages } = await readAnyText(file, setFileStatus);
          setRawText(text);
          const qs = parseYokdilExamText(text, answerKeyText);
          setParsedQuestions(qs);
          const withPassage = qs.filter(q => q.passage).length;
          setFileStatus(qs.length
            ? `✓ ${qs.length} soru ayrıştırıldı${withPassage ? ', ' + withPassage + ' soruya parça eklendi' : ''}${ocrPages ? ' (' + ocrPages + ' taranmış sayfa OCR ile okundu; şıkları önizlemeden kontrol edin)' : ''}.`
            : '❌ Dosya okundu ama soru bulunamadı. "Metni düzenle" sekmesinde metni kontrol edebilirsiniz.');
        } catch (err) {
          console.error(err);
          setFileStatus('❌ Hata: ' + (err.message || 'Dosya okunamadı.'));
        } finally {
          setIsParsing(false);
        }
      };

      const handleTextChange = (txt) => {
        setRawText(txt);
        if (txt.trim().length > 30) {
          const qs = parseYokdilExamText(txt, answerKeyText);
          setParsedQuestions(qs);
        } else {
          setParsedQuestions([]);
        }
      };

      const handleKeyChange = (keys) => {
        setAnswerKeyText(keys);
        if (rawText.trim().length > 30) {
          const qs = parseYokdilExamText(rawText, keys);
          setParsedQuestions(qs);
        }
      };

      const handleSave = (e) => {
        e.preventDefault();
        if (!parsedQuestions.length) return;
        const examId = 'exam_' + Date.now();
        const newExam = {
          id: examId,
          title: title.trim() || `${year} ${term} YÖKDİL ${field}`,
          field,
          year: parseInt(year, 10) || new Date().getFullYear(),
          term,
          questions: parsedQuestions,
          uploadedAt: new Date().toISOString()
        };
        onSave(newExam);
      };

      const categoriesCount = {};
      parsedQuestions.forEach(q => {
        categoriesCount[q.category] = (categoriesCount[q.category] || 0) + 1;
      });

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">📄 YÖKDİL Çıkmış Sınav / Deneme Yükle</h3>
                <p className="text-xs text-slate-400 mt-0.5">Geçmiş yıl sınav PDF'ini yükleyin; sorular, şıklar ve soru tipleri otomatik ayrıştırılır.</p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-slate-400">Sınav Adı</label>
                <input
                  type="text"
                  placeholder="Örn: 2023 İlkbahar YÖKDİL Sağlık Bilimleri"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Alan</label>
                <select value={field} onChange={e => setField(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white">
                  <option value="Fen Bilimleri">Fen Bilimleri</option>
                  <option value="Sağlık Bilimleri">Sağlık Bilimleri</option>
                  <option value="Sosyal Bilimler">Sosyal Bilimler</option>
                  <option value="Genel">Genel</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Yıl</label>
                <input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Dönem</label>
                <select value={term} onChange={e => setTerm(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white">
                  <option value="İlkbahar">İlkbahar</option>
                  <option value="Sonbahar">Sonbahar</option>
                </select>
              </div>
            </div>

            {/* Dosya veya Metin Seçimi */}
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setMode('file')}
                className={"px-3 py-1.5 rounded-lg text-xs font-bold transition " + (mode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}
              >
                📎 PDF / Word Dosyası Yükle
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={"px-3 py-1.5 rounded-lg text-xs font-bold transition " + (mode === 'paste' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}
              >
                📝 Metni Yapıştır / Düzenle
              </button>
            </div>

            {mode === 'file' ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-center space-y-2">
                <input
                  type="file"
                  id="examFileInput"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="examFileInput" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow">
                  📁 PDF veya Word Seç
                </label>
                <p className="text-[11px] text-slate-400">YÖKDİL sınav kitapçığı PDF'ini seçin (metinler otomatik ayrıştırılır).</p>
                {fileStatus && (
                  <p className={"text-xs font-bold " + (fileStatus.startsWith('✓') ? 'text-emerald-400' : fileStatus.startsWith('❌') ? 'text-red-400' : 'text-blue-300')}>
                    {fileStatus}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">Soru Metinleri</label>
                <textarea
                  rows={6}
                  placeholder="Soruları buraya yapıştırın (Örn: 1. The recent... A) ... B) ...)"
                  value={rawText}
                  onChange={e => handleTextChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
            )}

            {/* Cevap Anahtarı (Opsiyonel) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400">Cevap Anahtarı (Opsiyonel; sonradan da girilebilir)</label>
                <label className="text-[10px] font-bold text-blue-400 hover:underline cursor-pointer">
                  📎 Cevap anahtarı dosyası seç
                  <input type="file" accept=".pdf,.docx,.txt" onChange={handleKeyFile} className="hidden" />
                </label>
              </div>
              <input
                type="text"
                placeholder="Örn: 1-A 2-C 3-D… ya da yalnızca harfler: ACDEB… (PDF'te CEVAP ANAHTARI bölümü varsa otomatik eşleşir)"
                value={answerKeyText}
                onChange={e => handleKeyChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-slate-500">Anahtarı olmayan sorular çözülürken puanlanmaz; önizlemede şıkka tıklayarak doğru cevabı tek tek de işaretleyebilirsiniz.</p>
            </div>

            {/* Analiz Özeti */}
            {parsedQuestions.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">
                    ✓ Toplam {parsedQuestions.length} soru başarıyla ayrıştırıldı
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[11px] text-blue-400 hover:underline font-bold"
                  >
                    {showPreview ? 'Önizlemeyi Gizle' : 'Soruları Önizle (' + parsedQuestions.length + ')'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(categoriesCount).map(([cat, cnt]) => (
                    <span key={cat} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {cat}: <b>{cnt}</b>
                    </span>
                  ))}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    Cevabı Bilinen: <b>{parsedQuestions.filter(q => q.answer >= 0).length} / {parsedQuestions.length}</b>
                  </span>
                </div>

                {showPreview && (
                  <div className="mt-3 max-h-56 overflow-y-auto space-y-2 border-t border-slate-800 pt-2 text-xs">
                    {parsedQuestions.map((q, qi) => (
                      <div key={q.num} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-white">Soru {q.num}</span>
                          <span className="text-indigo-400 font-semibold">{q.category}</span>
                          {q.correctLetter ? <span className="text-emerald-400 font-bold">Cevap: {q.correctLetter}</span> : <span className="text-slate-500">cevap yok</span>}
                        </div>
                        {q.passage && <p className="text-[10px] text-amber-300/80 line-clamp-2">📖 Parça: {q.passage}</p>}
                        {q.prompt && <p className="text-slate-300 font-serif line-clamp-2">{q.prompt}</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-slate-400 font-mono">
                          {q.options.map((opt, oi) => (
                            <button type="button" key={oi} title="Doğru cevap olarak işaretle"
                              onClick={() => setParsedQuestions(list => list.map((x, xi) => xi !== qi ? x : (x.answer === oi ? { ...x, answer: -1, correctLetter: '' } : { ...x, answer: oi, correctLetter: EXAM_LETTERS[oi] })))}
                              className={"text-left px-1 rounded hover:bg-slate-800 " + (q.answer === oi ? 'text-emerald-300 font-bold' : '') + (!opt ? ' text-red-400' : '')}>
                              {EXAM_LETTERS[oi]}) {opt || '(şık okunamadı)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button
                type="submit"
                disabled={!parsedQuestions.length}
                className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {parsedQuestions.length ? `${parsedQuestions.length} Soruyu Sınav Bankasına Ekle` : 'Dosya Bekleniyor'}
              </button>
            </div>
          </form>
        </div>
      );
    }

    function WeekAddModal({ onClose, onSave }) {
      const [title, setTitle] = useState(`1. Hafta – ${new Date().toLocaleDateString('tr-TR')}`);
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-3">
            <h3 className="font-bold text-base text-white">Yeni Hafta Oluştur</h3>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) return;
                  onSave({
                    id: 'week_' + Date.now(),
                    title: title.trim(),
                    startDate: getTodayStr(),
                    readingIds: [],
                    archived: false
                  });
                }}
                className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Önce veriyi yükle (gerekirse localStorage → IndexedDB taşı), sonra uygulamayı göster
    function Root() {
      const [loaded, setLoaded] = useState(null);
      useEffect(() => { loadAllData().then(setLoaded); }, []);
      if (!loaded) {
        return (
          <div className="h-screen flex items-center justify-center text-slate-400 text-sm gap-3">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Verileriniz yükleniyor…
          </div>
        );
      }
      return <App initial={loaded.data} storageMode={loaded.mode} />;
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<Root />);

    // Çevrimdışı çalışma + "Ana ekrana ekle" (PWA). Dosyadan (file://) açıldığında service worker çalışmaz.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      const registerSW = () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker kaydedilemedi:', e));
      if (document.readyState === 'complete') registerSW(); else window.addEventListener('load', registerSW);
    }
