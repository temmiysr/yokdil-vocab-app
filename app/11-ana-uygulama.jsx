    // --- ANA UYGULAMA BİLEŞENİ ---
    function App({ initial, storageMode }) {
      const [activeTab, setActiveTab] = useState('dashboard');
      const [learnMode, setLearnMode] = useState('learn');   // 'learn' | 'quiz'
      const [learnRound, setLearnRound] = useState(0);
      const [weeks, setWeeks] = useState(() => initial[STORAGE_KEYS.WEEKS] || []);
      const [readings, setReadings] = useState(() => initial[STORAGE_KEYS.READINGS] || []);
      const [cards, setCards] = useState(() => initial[STORAGE_KEYS.VOCAB] || []);
      const [storageWarning, setStorageWarning] = useState(() => storageWorks ? '' : 'Bu sayfa dosya ya da önizleme olarak açıldı; tarayıcı burada kayıt yapılmasına izin vermiyor, yaptığınız değişiklikler saklanmaz ve Google ile giriş çalışmaz. Uygulamayı http://localhost:3000 (baslat.bat) ya da https://temmiysr.github.io/yokdil-vocab-app/ adresinden açın.');
      const [activity, setActivity] = useState(() => initial[STORAGE_KEYS.ACTIVITY] || []);
      // Yüklenen çıkmış sınav / denemeler (IndexedDB'de; eski sürümde localStorage'daydı, loadAllData taşır)
      const [customExams, setCustomExams] = useState(() => initial[STORAGE_KEYS.EXAMS] || []);
      // Bulut eşitleme (Google ile giriş yapılınca haftalar, metinler, kartlar, çalışma kaydı ve denemeler tüm cihazlarda aynı olur)
      const sync = useCloudSync({ weeks, setWeeks, readings, setReadings, cards, setCards, activity, setActivity, exams: customExams, setExams: setCustomExams });

      // Günlük çalışma kaydına ekle: logActivity({ reviews: 1, correct: 1 })
      const logActivity = (patch, byType, byField) => {
        const day = getTodayStr();
        setActivity(prev => {
          const cur = prev.find(a => a.id === day) || { id: day, reviews: 0, correct: 0, again: 0, newCards: 0, examQ: 0, examCorrect: 0, examByType: {} };
          const next = { ...cur };
          Object.entries(patch).forEach(([k, v]) => { next[k] = (next[k] || 0) + v; });
          const addMap = (key, m) => {
            next[key] = { ...(cur[key] || {}) };
            Object.entries(m).forEach(([t, [c, n]]) => {
              const p = next[key][t] || [0, 0];
              next[key][t] = [p[0] + c, p[1] + n];
            });
          };
          if (byType) addMap('examByType', byType);
          if (byField) addMap('examByField', byField);
          return [next, ...prev.filter(a => a.id !== day)].slice(0, 400);
        });
      };

      // --- Yedek indir / yükle ---
      const backupJson = () => JSON.stringify({ app: 'yokdil-master', version: 2, exportedAt: new Date().toISOString(), weeks, readings, cards, activity, exams: customExams }, null, 1);
      // Yedek klasörü (bilgisayarda; izin verildiyse haftada bir otomatik yazılır)
      const [backupDir, setBackupDirState] = useState(null);
      useEffect(() => { if (canPickFolder()) getBackupDir().then(h => h && setBackupDirState(h)); }, []);
      const folderBackup = async (ask) => {
        if (!backupDir) return false;
        try {
          const name = await writeBackupToDir(backupDir, backupJson(), ask);
          if (name) { setSettings(s => ({ ...s, lastBackupAt: new Date().toISOString() })); showToast('Yedek "' + backupDir.name + '/' + name + '" dosyasına yazıldı.'); }
          else if (ask) showToast('Klasöre yazma izni verilmedi.', true);
          return !!name;
        } catch (e) { if (ask) showToast('Klasöre yazılamadı: ' + (e.message || e), true); return false; }
      };
      const pickBackupFolder = async () => {
        try {
          const h = await window.showDirectoryPicker({ id: 'yokdil-yedek', mode: 'readwrite' });
          await setBackupDir(h); setBackupDirState(h);
          const name = await writeBackupToDir(h, backupJson(), true);
          if (name) { setSettings(s => ({ ...s, lastBackupAt: new Date().toISOString() })); showToast('Yedek klasörü: "' + h.name + '". İlk yedek yazıldı; bundan sonra haftada bir otomatik yazılacak.'); }
        } catch (e) { if (e && e.name !== 'AbortError') showToast('Klasör seçilemedi: ' + (e.message || e), true); }
      };
      // Haftada bir: izin hâlâ geçerliyse sormadan klasöre yaz (tarayıcı izni sıfırladıysa hatırlatma çıkar)
      const autoBackupTried = useRef(false);
      useEffect(() => {
        if (!backupDir || autoBackupTried.current || daysSince(settings.lastBackupAt) < 7 || !cards.length) return;
        autoBackupTried.current = true;
        folderBackup(false);
      }, [backupDir, cards.length]);
      const exportBackup = () => {
        setSettings(s => ({ ...s, lastBackupAt: new Date().toISOString() }));
        const blob = new Blob([backupJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'yokdil-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast('Yedek indirildi: ' + weeks.length + ' hafta, ' + readings.length + ' metin, ' + cards.length + ' kart, ' + customExams.length + ' deneme.');
      };

      // Yedekteki öğeler mevcutlarla birleştirilir (hiçbir şey silinmez); aynı öğe varsa daha yeni olan kalır
      const importBackup = async (file) => {
        try {
          const data = JSON.parse(await file.text());
          if (!data || (data.app && data.app !== 'yokdil-master') || !Array.isArray(data.cards || []) ) throw new Error('Bu dosya bir YÖKDİL Master yedeği değil.');
          const stamp = (x) => Date.parse(x.updatedAt || x.createdAt || x.dateAdded || 0) || 0;
          const mergeList = (cur, inc) => {
            const map = new Map(cur.map(x => [String(x.id), x]));
            let added = 0, updated = 0;
            (inc || []).filter(x => x && x.id != null).forEach(x => {
              const id = String(x.id), ex = map.get(id);
              if (!ex) { map.set(id, x); added++; }
              else if (stamp(x) > stamp(ex) && JSON.stringify(x) !== JSON.stringify(ex)) { map.set(id, x); updated++; }
            });
            const incIds = new Set((inc || []).map(x => String(x.id)));
            const newOnes = (inc || []).filter(x => x && !cur.some(c => String(c.id) === String(x.id)));
            const rest = cur.map(c => map.get(String(c.id)));
            return { list: [...newOnes, ...rest], added, updated, incIds };
          };
          const w = mergeList(weeks, data.weeks), r = mergeList(readings, data.readings), c = mergeList(cards, data.cards);
          const ex = mergeList(customExams, data.exams), ac = mergeList(activity, data.activity);
          setWeeks(w.list); setReadings(r.list); setCards(c.list); setCustomExams(ex.list); setActivity(ac.list);
          showToast('Yedek yüklendi: ' + w.added + ' hafta, ' + r.added + ' metin, ' + c.added + ' kart eklendi' + ((w.updated + r.updated + c.updated) ? ', ' + (w.updated + r.updated + c.updated) + ' öğe güncellendi' : '') + (sync.user ? '. Buluta eşitleniyor…' : '.'));
        } catch (e) {
          showToast('Yedek yüklenemedi: ' + (e instanceof SyntaxError ? 'dosya geçerli bir yedek değil.' : (e && e.message ? e.message : 'dosya okunamadı')), true);
        }
      };
      const [settings, setSettings] = useState(() => initial[STORAGE_KEYS.SETTINGS] || ({
        theme: 'dark',
        notificationTime: '20:00',
        telegramEnabled: false,
        telegramBotToken: '',
        telegramChatId: '',
        appUrl: window.location.href,
        cloudProvider: 'none'
      }));

      // Kalıcı kayıt (IndexedDB; olmazsa localStorage). Kayıt başarısız olursa sessiz kalmaz, uyarı gösterir.
      const persist = (key, val) => {
        persistKey(storageMode, key, val).then(err => {
          if (!err) return;
          setStorageWarning(isQuotaError(err)
            ? 'Depolama alanı doldu; son değişiklikler bu cihaza kaydedilemedi. "⬇ Yedek indir" ile yedek alın ve kullanılmayan uzun metinleri silin.'
            : 'Veriler kaydedilemedi: ' + (err.message || err) + '. "⬇ Yedek indir" ile yedek almanız önerilir.');
        });
      };

      // Modallar ve Detay Durumları
      const [selectedWeekId, setSelectedWeekId] = useState(null);
      const [selectedReadingId, setSelectedReadingId] = useState(null);
      // Günlük plan için: bugün bir okuma parçası açıldı mı?
      useEffect(() => { if (selectedReadingId) logActivity({ readingsOpened: 1 }); }, [selectedReadingId]);
      const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
      const [editingCard, setEditingCard] = useState(null);
      const [initialWord, setInitialWord] = useState('');
      const [initialSentence, setInitialSentence] = useState('');
      const [isNewWeekOpen, setIsNewWeekOpen] = useState(false);
      const [isUploadReadingOpen, setIsUploadReadingOpen] = useState(false);
      const [isUploadExamOpen, setIsUploadExamOpen] = useState(false);
      const [autoVocabReadingId, setAutoVocabReadingId] = useState(null);
      const [recentCardIds, setRecentCardIds] = useState([]);
      const [toast, setToast] = useState('');
      const showToast = (msg, isError) => { setToast((isError ? '⚠ ' : '') + msg); setTimeout(() => setToast(''), 6000); };
      const [duplicateCard, setDuplicateCard] = useState(null);

      useEffect(() => { persist(STORAGE_KEYS.EXAMS, customExams); }, [customExams]);

      const handleExtractVocabFromExam = async (exam) => {
        const vocabQs = exam.questions.filter(q => qSection(q) === 'Kelime & Dil Bilgisi');
        if (!vocabQs.length) {
          showToast('Bu sınavda ayrıştırılmış kelime sorusu bulunamadı.', true);
          return;
        }
        const existingWords = new Set(cards.map(c => String(c.lemma || c.english).toLowerCase()));
        // Şıklardaki kelime/kalıplar (en çok 3 kelime); doğru cevap için boşluk doldurulmuş cümle örnek olur
        const items = [];
        const seen = new Set();
        vocabQs.forEach(q => q.options.forEach((opt, idx) => {
          const surface = opt.trim().replace(/[.,;]+$/, '');
          const clean = surface.toLowerCase().replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
          if (surface.includes('/') || clean.length < 3 || clean.split(' ').length > 3 || STOPWORDS.has(clean) || seen.has(clean)) return;
          seen.add(clean);
          const isCorrect = q.answer === idx;
          items.push({ surface, clean, isCorrect, sentence: isCorrect ? q.prompt.replace(/-{3,}/, surface) : q.prompt, num: q.num });
        }));
        if (!items.length) { showToast('Kelime sorularının şıklarında eklenecek kelime bulunamadı.', true); return; }
        showToast(`"${exam.title}": ${items.length} kelimenin anlamı, okunuşu ve örnekleri aranıyor…`);
        const now = new Date().toISOString();
        const results = await runPool(items, 3, async (it) => {
          let lemma = it.clean;
          if (!lemma.includes(' ')) { const r = await resolveLemma(lemma).catch(() => null); if (r && r.word) lemma = r.word; }
          if (existingWords.has(lemma)) return { dup: lemma, it };
          const d = await fetchWordDetails(lemma, '').catch(() => null);
          return { lemma, it, d };
        });
        const newCards = [], dupLemmas = [];
        results.forEach((r, i) => {
          if (!r) return;
          if (r.dup) { dupLemmas.push(r.dup); return; }
          if (existingWords.has(r.lemma)) return;
          existingWords.add(r.lemma);
          const d = r.d || {};
          const id = 'card_' + Date.now() + '_' + i;
          const sub = awlSublist(r.lemma);
          newCards.push({
            id, english: r.lemma, lemma: r.lemma,
            turkish: d.turkish || '(anlam bulunamadı – düzenleyin)',
            trSenses: d.trSenses || [], trSource: d.trSource || '',
            ipa: d.ipa || '', okunus: d.okunus || '', audioUrl: d.audioUrl || '',
            definition: d.definition || '', examples: d.examples || [],
            synonyms: d.synonyms || [], antonyms: d.antonyms || [],
            partOfSpeech: d.partOfSpeech || 'noun',
            originalSentence: r.it.sentence,
            questionType: 'Kelime & Dil Bilgisi',
            sourceType: 'verified_exam',
            examInfo: { examId: exam.id, title: exam.title, year: exam.year, term: exam.term, field: exam.field, num: r.it.num, wasAnswer: r.it.isCorrect, verified: true },
            ...(sub ? { awl: sub } : {}),
            isDifficult: false, srs: createSRS(id), createdAt: now, updatedAt: now,
          });
        });
        // Bankada zaten olan kelimeler: çıkmış sınav etiketini ekle
        if (dupLemmas.length) {
          const set = new Set(dupLemmas);
          setCards(prev => prev.map(c => set.has(String(c.lemma || c.english).toLowerCase()) && c.sourceType !== 'verified_exam'
            ? { ...c, questionType: c.questionType || 'Kelime & Dil Bilgisi', examInfo: { examId: exam.id, title: exam.title, year: exam.year, term: exam.term, field: exam.field, verified: true }, examTagged: true, updatedAt: now } : c));
        }
        if (newCards.length) {
          setCards(prev => [...newCards, ...prev]);
          setRecentCardIds(newCards.map(c => c.id));
          const missing = newCards.filter(isMissingMeaning).length;
          showToast(`"${exam.title}" sınavından ${newCards.length} çıkmış sınav kelimesi eklendi${dupLemmas.length ? ', ' + dupLemmas.length + ' mevcut karta "çıkmış sınav" etiketi kondu' : ''}${missing ? ' (' + missing + ' kelimenin anlamı bulunamadı)' : ''}.`);
        } else {
          showToast(dupLemmas.length ? 'Kelimeler zaten bankanızda; ' + dupLemmas.length + ' karta "çıkmış sınav" etiketi kondu.' : 'Eklenecek yeni kelime bulunamadı.');
        }
      };

      // Metin Seçimi ve Popover
      const [selectionText, setSelectionText] = useState('');
      const [popoverPos, setPopoverPos] = useState(null);
      const [expandedPhrase, setExpandedPhrase] = useState('');
      const [bionicReading, setBionicReading] = useState(false);

      // --- Tıkla-anlam: okuma ekranında tek tıkla kelimenin anlamı ---
      const [wordPop, setWordPop] = useState(null);       // { word, sentence, x, y, top, readingId }
      const [awlHighlight, setAwlHighlight] = useState(false);
      const [sentenceToAnalyze, setSentenceToAnalyze] = useState(null);
      const [audioOpen, setAudioOpen] = useState(false);
      const [moreOpen, setMoreOpen] = useState(false);
      const [examPreset, setExamPreset] = useState(null);   // { weekly: true } → Sınav sekmesinde haftalık check-up başlat
      const handleWordClick = (e, reading) => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;   // seçim yapılıyorsa eski akış
        let node = null, offset = 0;
        if (document.caretRangeFromPoint) {
          const r = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (r) { node = r.startContainer; offset = r.startOffset; }
        } else if (document.caretPositionFromPoint) {
          const p = document.caretPositionFromPoint(e.clientX, e.clientY);
          if (p) { node = p.offsetNode; offset = p.offset; }
        }
        if (!node || node.nodeType !== 3) { setWordPop(null); return; }
        // Biyonik okumada kelime parçalara bölünür: kelimenin tamamı data-w özelliğinde
        const wrap = node.parentElement && node.parentElement.closest('[data-w]');
        if (wrap) {
          const r = wrap.getBoundingClientRect();
          setPopoverPos(null);
          setWordPop({
            word: wrap.dataset.w,
            sentence: extractSentence(reading.content.replace(/^##\s+/gm, ''), wrap.dataset.w),
            x: r.left + r.width / 2, y: r.bottom, top: r.top,
            readingId: reading.id,
          });
          return;
        }
        const text = node.textContent;
        const isW = (ch) => /[A-Za-z'’-]/.test(ch || '');
        let s = offset, en = offset;
        while (s > 0 && isW(text[s - 1])) s--;
        while (en < text.length && isW(text[en])) en++;
        while (s < en && /['’-]/.test(text[s])) s++;
        while (en > s && /['’-]/.test(text[en - 1])) en--;
        let word = text.slice(s, en);
        if (/['’]s$/i.test(word)) { word = word.slice(0, -2); en -= 2; }
        if (word.length < 2 || !/[A-Za-z]{2}/.test(word)) { setWordPop(null); return; }
        const range = document.createRange();
        range.setStart(node, s); range.setEnd(node, en);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.left === 0 && rect.top === 0)) return;
        setPopoverPos(null);
        setWordPop({
          word,
          sentence: extractSentence(reading.content.replace(/^##\s+/gm, ''), word),
          x: rect.left + rect.width / 2, y: rect.bottom, top: rect.top,
          readingId: reading.id,
        });
      };

      // Anlam kutusundan karta ekle (bankada varsa yeni kaynak cümle eklenir)
      const addWordFromPopover = (info, pop) => {
        const reading = readings.find(r => r.id === pop.readingId);
        const now = new Date().toISOString();
        const lemma = (info.lemma || pop.word).toLowerCase();
        const source = { readingId: reading ? reading.id : '', readingTitle: reading ? reading.title : '', weekId: reading ? reading.weekId : '', sentence: pop.sentence, dateAdded: now };
        const existing = cards.find(c => String(c.lemma || c.english).toLowerCase() === lemma);
        if (existing) {
          setCards(cards.map(c => c.id === existing.id ? { ...c, sources: [...(c.sources || []), source], updatedAt: now } : c));
          showToast('"' + lemma + '" zaten bankada; yeni cümle eklendi.');
        } else {
          const id = 'card_' + Date.now();
          setCards([{
            id, english: lemma, lemma,
            turkish: info.turkish || '(anlam bulunamadı – düzenleyin)',
            trSenses: info.trSenses || [], trSource: info.trSource || '',
            ipa: info.ipa || '', okunus: info.okunus || '', audioUrl: info.audioUrl || '',
            definition: info.definition || '', examples: info.examples || [], synonyms: info.synonyms || [], antonyms: info.antonyms || [],
            partOfSpeech: info.pos || 'noun',
            originalSentence: pop.sentence,
            readingId: source.readingId, readingTitle: source.readingTitle, weekId: source.weekId,
            sources: [source], sourceType: 'user_reading', isDifficult: false,
            srs: createSRS(id), createdAt: now, updatedAt: now,
          }, ...cards]);
          if (reading) setReadings(readings.map(r => r.id === reading.id ? { ...r, savedWordIds: [...(r.savedWordIds || []), id] } : r));
          showToast('"' + lemma + '" karta eklendi.');
        }
        setWordPop(null);
      };

      useEffect(() => { persist(STORAGE_KEYS.WEEKS, weeks); }, [weeks]);
      useEffect(() => { persist(STORAGE_KEYS.READINGS, readings); }, [readings]);

      // Tarayıcıdan kalıcı depolama iste (yer daralınca verilerin otomatik silinmesini önler) + doluluk kontrolü
      useEffect(() => {
        (async () => {
          try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
          try {
            if (navigator.storage && navigator.storage.estimate) {
              const { usage, quota } = await navigator.storage.estimate();
              if (quota && usage / quota > 0.85) setStorageWarning('Depolama alanının %' + Math.round(usage / quota * 100) + '\'i dolu. "⬇ Yedek indir" ile yedek alın.');
            }
          } catch (e) {}
        })();
      }, []);

      const deleteReading = (id) => {
        const r = readings.find(x => x.id === id);
        if (!r) return;
        if (!window.confirm('"' + r.title + '" metni silinsin mi? Bu işlem geri alınamaz.\n(Bu metinden kaydettiğiniz kelimeler silinmez.)')) return;
        setReadings(prev => prev.filter(x => x.id !== id));
        if (selectedReadingId === id) setSelectedReadingId(null);
      };
      useEffect(() => { persist(STORAGE_KEYS.VOCAB, cards); }, [cards]);
      useEffect(() => { persist(STORAGE_KEYS.SETTINGS, settings); }, [settings]);
      useEffect(() => { persist(STORAGE_KEYS.ACTIVITY, activity); }, [activity]);

      // Kelime listesinden sırada bekleyenler: her gün belirlenen sayıda kelime tekrara eklenir (günde bir kez)
      // Herkese açık paylaşım
      const [shareReq, setShareReq] = useState(null);       // { kind, title, sourceKey, items, meta }
      const [libraryKind, setLibraryKind] = useState(null); // null | 'all' | 'list' | 'exam'
      const shareList = (name) => {
        const items = cards.filter(c => c.listName === name).sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0)).map(cardForShare);
        if (items.length) setShareReq({ kind: 'list', title: name, sourceKey: 'list:' + name, items, meta: {} });
      };
      const shareExam = (ex) => setShareReq({ kind: 'exam', title: ex.title, sourceKey: 'exam:' + ex.id, items: examForShare(ex).questions, meta: { field: ex.field || '', year: ex.year || '', term: ex.term || '' } });
      const addSharedList = (s, rows) => {
        const have = new Set(cards.flatMap(c => [String(c.english).toLowerCase(), String(c.lemma || '').toLowerCase()]).filter(Boolean));
        const now = new Date().toISOString(), today = getTodayStr(), stamp = Date.now();
        const fresh = rows.filter(r => r && r.english && !have.has(r.english.toLowerCase()) && !(r.lemma && have.has(r.lemma.toLowerCase())));
        const newCards = fresh.map((r, i) => {
          const id = 'card_pub_' + stamp + '_' + i;
          const active = i < 20;
          return { ...r, id, turkish: r.turkish || '(anlam bulunamadı – düzenleyin)', sourceType: 'public_list', listName: s.title, sharedFrom: s.id,
            queued: !active, queueOrder: i, isDifficult: false, srs: { ...createSRS(id), nextReviewAt: active ? today : '9999-12-31' }, createdAt: now, updatedAt: now };
        });
        if (newCards.length) { setCards(prev => [...prev, ...newCards]); setSettings(st => ({ ...st, listReleaseDay: today })); }
        showToast('"' + s.title + '": ' + newCards.length + ' yeni kelime eklendi' + (newCards.length > 20 ? ' (20 tanesi bugün tekrarda, kalanlar her gün ' + (settings.dailyListNew == null ? 10 : settings.dailyListNew) + ' tane eklenecek)' : '') + (rows.length - fresh.length ? '; ' + (rows.length - fresh.length) + ' tanesi zaten bankanızdaydı' : '') + '.');
        return newCards.length;
      };
      // Sınavlarda sık geçen kelimelerden kart: örnek cümle denemedeki cümleden alınır; ilk 20 hemen, kalanı günlük sırada
      const [freqOpen, setFreqOpen] = useState(false);
      const addFrequentWords = (details, freqList) => {
        const have = new Set(cards.flatMap(c => [String(c.lemma || c.english).toLowerCase(), String(c.english).toLowerCase()]));
        const sentences = customExams.flatMap(ex => (ex.questions || []).flatMap(q => [q.passage || '', q.prompt || ''])).join(' ').split(/(?<=[.!?])\s+/);
        const now = new Date().toISOString(), today = getTodayStr(), stamp = Date.now();
        const fresh = details.filter(x => x && !have.has(x.lemma) && !have.has(x.w));
        const newCards = fresh.map((x, i) => {
          const d = x.d || {};
          const id = 'card_freq_' + stamp + '_' + i;
          const sent = sentences.find(s => new RegExp('\\b' + escRe(x.w) + '\\b', 'i').test(s) && s.length < 300 && !/-{3,}/.test(s)) || '';
          const fr = freqList.find(f => f.word === x.w);
          const active = i < 20;
          return {
            id, english: x.lemma, lemma: x.lemma,
            turkish: d.turkish || '(anlam bulunamadı – düzenleyin)', trSenses: d.trSenses || [], trSource: d.trSource || '',
            ipa: d.ipa || '', okunus: d.okunus || '', audioUrl: d.audioUrl || '', definition: d.definition || '',
            examples: d.examples || [], synonyms: d.synonyms || [], antonyms: d.antonyms || [], partOfSpeech: d.partOfSpeech || 'noun',
            originalSentence: sent, sourceType: 'exam_frequent', listName: 'Sınavlarda sık geçenler', examFreq: fr ? fr.n : null,
            queued: !active, queueOrder: i, isDifficult: false,
            srs: { ...createSRS(id), nextReviewAt: active ? today : '9999-12-31' }, createdAt: now, updatedAt: now,
          };
        });
        if (newCards.length) { setCards(prev => [...newCards, ...prev]); setSettings(s => ({ ...s, listReleaseDay: today })); setRecentCardIds(newCards.map(c => c.id)); }
        setFreqOpen(false);
        showToast(newCards.length + ' sık geçen kelime eklendi' + (newCards.length > 20 ? ' (20 tanesi bugün tekrarda, kalanlar sırada)' : '') + '.');
      };
      // Denemedeki okuma / cloze parçalarını "Okuma Parçalarım"a aktar (tıkla-anlam, kalıp, Bionic okuma için)
      const passagesToReadings = (ex) => {
        const groups = [];
        [...(ex.questions || [])].sort((a, b) => a.num - b.num).forEach(q => {
          if (!q.passage) return;
          const g = groups.find(x => x.text === q.passage);
          if (g) g.to = q.num; else groups.push({ text: q.passage, from: q.num, to: q.num, type: qSection(q) });
        });
        const have = new Set(readings.map(r => r.content));
        const now = new Date().toISOString();
        const fresh = groups.filter(g => !have.has(g.text)).map((g, i) => ({
          id: 'reading_' + Date.now() + '_' + i,
          title: ex.title + ' · ' + g.type + ' (Soru ' + g.from + (g.to !== g.from ? '-' + g.to : '') + ')',
          content: g.text, weekId: (weeks[0] && weeks[0].id) || '', category: ex.field || 'Genel',
          wordCount: g.text.split(/\s+/).filter(Boolean).length, savedWordIds: [], fileType: 'exam', sourceExamId: ex.id, dateAdded: now,
        }));
        if (!groups.length) { showToast('Bu denemede okuma ya da cloze parçası yok.'); return; }
        if (!fresh.length) { showToast('Bu denemenin parçaları zaten Okuma Parçalarım\'da.'); return; }
        setReadings(prev => [...fresh, ...prev]);
        showToast(fresh.length + ' parça Okuma Parçalarım\'a eklendi. Kelimeye tıklayınca anlamı görünür.');
      };
      // Yanlışlarım: doğru → bir sonraki kutu (1, 3, 7, 21 gün; 4. doğrudan sonra deste dışı), yanlış → yarın tekrar
      const mistakeResult = (ref, ok) => {
        const today = getTodayStr();
        setCustomExams(prev => prev.map(e => {
          if (e.id !== ref.examId || !(e.mistakes || {})[ref.num]) return e;
          const mistakes = { ...e.mistakes };
          const m = mistakes[ref.num];
          if (ok) {
            const box = (m.box || 0) + 1;
            if (box >= MISTAKE_DAYS.length) delete mistakes[ref.num];
            else mistakes[ref.num] = { ...m, box, due: addDays(today, MISTAKE_DAYS[box]) };
          } else mistakes[ref.num] = { ...m, box: 0, due: addDays(today, 1), wrongCount: (m.wrongCount || 0) + 1 };
          return { ...e, mistakes, updatedAt: new Date().toISOString() };
        }));
      };
      const addSharedExam = (s, rows) => {
        const m = s.meta || {};
        setCustomExams(prev => [{ id: 'exam_' + Date.now(), title: s.title, field: m.field || 'Genel', year: m.year || '', term: m.term || '', questions: rows, uploadedAt: new Date().toISOString(), sharedFrom: s.id }, ...prev]);
        showToast('"' + s.title + '" denemesi Sınavlarım\'a eklendi (' + rows.length + ' soru).');
        return rows.length;
      };
      const [isWordListOpen, setIsWordListOpen] = useState(false);
      const [bankLimit, setBankLimit] = useState(60);
      const [bankQuery, setBankQuery] = useState('');
      const bankList = bankQuery.trim() ? cards.filter(c => (c.english + ' ' + (c.turkish || '')).toLocaleLowerCase('tr').includes(bankQuery.trim().toLocaleLowerCase('tr'))) : cards;
      useEffect(() => {
        const today = getTodayStr();
        if (settings.listReleaseDay === today) return;
        const queued = cards.filter(c => c.queued);
        if (!queued.length) return;
        const n = settings.dailyListNew == null ? 10 : settings.dailyListNew;
        const pick = new Set(queued.sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0)).slice(0, n).map(c => c.id));
        const now = new Date().toISOString();
        if (pick.size) setCards(prev => prev.map(c => pick.has(c.id) ? { ...c, queued: false, srs: { ...c.srs, nextReviewAt: today }, updatedAt: now } : c));
        setSettings(s => ({ ...s, listReleaseDay: today }));
      }, [cards.length, settings.listReleaseDay]);

      // Hesaplamalar
      const today = getTodayStr();
      // Yeni kelimeler önce "Yeni Kelimeler" oturumunda öğretilir; bugün öğrenilip henüz sınavı yapılmayanlar da tekrara girmez
      const dueCards = cards.filter(c => c.srs.nextReviewAt <= today && !isUnlearnedNew(c) && !needsQuizToday(c));
      const learnDue = learnPool(cards).length;
      const quizDue = cards.filter(needsQuizToday).length;
      // Bağlantıyla açılış (Telegram mesajı / bildirim): ?go=learn | quiz | review
      useEffect(() => {
        let go = null;
        try { go = new URLSearchParams(location.search).get('go'); } catch (e) {}
        if (!go) return;
        if (go === 'learn') { setLearnMode('learn'); setActiveTab('learn'); }
        else if (go === 'quiz') { setLearnMode('quiz'); setActiveTab('learn'); }
        else if (go === 'review') setActiveTab('daily-review');
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      }, []);
      // Uygulama açıkken hatırlatıcı bildirimleri: sabah "yeni kelimeler", akşam "günün kelime sınavı / tekrar"
      useEffect(() => {
        const check = () => {
          if (!settings.remindersOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
          const d = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
          const today = getTodayStr();
          if (hm >= (settings.morningTime || '09:00') && settings.lastMorningNote !== today && learnDue > 0) {
            setSettings(s => ({ ...s, lastMorningNote: today }));
            showStudyNotification('📘 Günün yeni kelimeleri hazır', Math.min(learnDue, settings.learnPerDay || 10) + ' yeni kelime sizi bekliyor. Önce öğretici kartlarla öğrenin.', 'learn');
          }
          if (hm >= (settings.eveningTime || '20:00') && settings.lastEveningNote !== today && (quizDue > 0 || dueCards.length > 0)) {
            setSettings(s => ({ ...s, lastEveningNote: today }));
            showStudyNotification(quizDue > 0 ? '🌙 Günün kelime sınavı' : '🔄 Tekrar zamanı', quizDue > 0 ? 'Bugün öğrendiğiniz ' + quizDue + ' kelimeden kısa bir sınav.' : dueCards.length + ' kart tekrar bekliyor.', quizDue > 0 ? 'quiz' : 'review');
          }
        };
        check();
        const t = setInterval(check, 60000);
        return () => clearInterval(t);
      }, [settings.remindersOn, settings.morningTime, settings.eveningTime, settings.lastMorningNote, settings.lastEveningNote, learnDue, quizDue, dueCards.length]);
      // Zorlandığım kelimeleri tarih beklemeden tekrar etmek için (null = normal günlük tekrar)
      const [extraReviewIds, setExtraReviewIds] = useState(null);
      const reviewCards = extraReviewIds ? cards.filter(c => extraReviewIds.includes(c.id)) : dueCards;
      const streakNow = computeStreak(activity);
      const todayRec = activity.find(a => a.id === today) || {};
      const examLeft = daysUntil(settings.examDate);
      const difficultCards = cards.filter(c => c.isDifficult || c.srs.lapses >= 3);
      const masteredCards = cards.filter(c => c.srs.state === 'mastered');

      // Okuma Metninde Seçim Olayı
      const handleReaderSelection = (readingContent) => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setPopoverPos(null);
          setExpandedPhrase('');
          return;
        }
        const text = sel.toString().trim();
        if (text.length >= 2) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const cleanContent = readingContent.replace(/^##\s+/gm, '');
          const sentence = extractSentence(cleanContent, text);
          setSelectionText(text);
          setInitialSentence(sentence);
          // Akıllı Kalıp İfade Genişletme (Smart Phrase Expansion)
          const smartExp = findSmartCollocation(sentence, text);
          setExpandedPhrase(smartExp && smartExp.toLowerCase() !== text.toLowerCase() ? smartExp : '');
          setPopoverPos({ top: rect.top, left: rect.left + rect.width / 2 });
        }
      };

      // Kelime Listeme Ekle Eylemi
      const handleAddSelection = () => {
        const norm = selectionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const dup = cards.find(c => c.english.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() === norm);
        if (dup) {
          setDuplicateCard(dup);
          setPopoverPos(null);
        } else {
          setInitialWord(selectionText);
          setEditingCard(null);
          setIsVocabModalOpen(true);
          setPopoverPos(null);
        }
      };

      // Mükerrer Karta Kaynak Ekleme
      const handleAppendSource = () => {
        if (!duplicateCard) return;
        const currentReading = readings.find(r => r.id === selectedReadingId);
        const updated = cards.map(c => {
          if (c.id === duplicateCard.id) {
            const sources = c.sources || [];
            sources.push({
              readingId: currentReading?.id || '',
              readingTitle: currentReading?.title || '',
              sentence: initialSentence,
              dateAdded: new Date().toISOString()
            });
            return { ...c, sources, updatedAt: new Date().toISOString() };
          }
          return c;
        });
        setCards(updated);
        setDuplicateCard(null);
        alert('Mevcut karta yeni örnek cümle ve kaynak başarıyla eklendi!');
      };

      // Menü öğeleri (masaüstü yan menü + telefon alt menüsü ortak)
      const navItems = [
        { id: 'dashboard', label: 'Ana Sayfa', short: 'Ana', icon: '📊' },
        { id: 'learn', label: 'Yeni Kelimeler', short: 'Öğren', icon: '📘', badge: learnDue + quizDue },
        { id: 'daily-review', label: 'Günlük Tekrar', short: 'Tekrar', icon: '🔄', badge: dueCards.length },
        { id: 'weeks', label: 'Haftalık Listelerim', icon: '📅' },
        { id: 'readings', label: 'Okuma Parçalarım', short: 'Metinler', icon: '📖' },
        { id: 'bank', label: 'YÖKDİL Kelime Bankası', icon: '🗄️' },
        { id: 'flashcards', label: 'Kelime Kartları', short: 'Kartlar', icon: '🃏', badge: cards.filter(isMissingMeaning).length },
        { id: 'study', label: 'Sınavlar & Testler', short: 'Sınav', icon: '🎓' },
        { id: 'difficult', label: 'Zorlandığım Kelimeler', icon: '⚠️', badge: difficultCards.length },
        { id: 'stats', label: 'İstatistikler', icon: '📈' },
        { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
      ];
      const MOBILE_MAIN = ['dashboard', 'learn', 'daily-review', 'flashcards', 'study'];
      const goTab = (id) => {
        setActiveTab(id);
        setMoreOpen(false);
        if (id !== 'weeks') setSelectedWeekId(null);
        if (id !== 'readings') setSelectedReadingId(null);
        if (id !== 'daily-review') setExtraReviewIds(null);
      };

      return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
          {/* Telefon: alt menü */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex safe-area-bottom" aria-label="Ana menü">
            {navItems.filter(n => MOBILE_MAIN.includes(n.id)).map(item => (
              <button key={item.id} onClick={() => goTab(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}
                      className={"relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold " + (activeTab === item.id ? 'text-blue-400' : 'text-slate-400')}>
                <span className="text-lg leading-none">{item.icon}</span>{item.short}
                {item.badge > 0 && <span className="absolute top-1 right-1/4 text-[9px] bg-blue-600 text-white px-1.5 rounded-full font-black">{item.badge}</span>}
              </button>
            ))}
            <button onClick={() => setMoreOpen(true)} className={"flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold " + (!MOBILE_MAIN.includes(activeTab) ? 'text-blue-400' : 'text-slate-400')}>
              <span className="text-lg leading-none">☰</span>Daha
            </button>
          </nav>
          {moreOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMoreOpen(false)}>
              <div className="absolute bottom-0 inset-x-0 bg-slate-950 border-t border-slate-800 rounded-t-3xl p-4 space-y-2 max-h-[85vh] overflow-y-auto safe-area-bottom" onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded bg-slate-700 mx-auto mb-2" />
                <div className="grid grid-cols-2 gap-2">
                  {navItems.filter(n => !MOBILE_MAIN.includes(n.id)).map(item => (
                    <button key={item.id} onClick={() => goTab(item.id)} className={"flex items-center gap-2 px-3 py-3 rounded-xl text-xs font-semibold " + (activeTab === item.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-200')}>
                      <span>{item.icon}</span>{item.label}
                      {item.badge > 0 && <span className="ml-auto text-[10px] bg-white text-blue-700 px-1.5 rounded-full font-black">{item.badge}</span>}
                    </button>
                  ))}
                </div>
                <SyncPanel sync={sync} backup={{ onExport: exportBackup, onImport: importBackup }} />
              </div>
            </div>
          )}

          {/* Masaüstü Yan Menü */}
          <aside className="hidden md:flex flex-col w-64 bg-slate-950 border-r border-slate-800 p-4 select-none">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
                Y
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  YÖKDİL Master
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">SRS</span>
                </h1>
                <p className="text-xs text-slate-400">Kişisel Kelime Sistemi</p>
              </div>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => goTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[10px] bg-white text-blue-700 px-2 py-0.5 rounded-full font-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <SyncPanel sync={sync} backup={{ onExport: exportBackup, onImport: importBackup }} />
          </aside>

          {/* Ana İçerik */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="bg-slate-950 border-b border-slate-800 px-4 md:px-6 py-3 md:py-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm md:text-base font-bold text-white capitalize truncate">
                  {({
                    'dashboard': 'Ana Sayfa', 'daily-review': 'Günlük Tekrar (Spaced Repetition)', 'weeks': 'Haftalık Listelerim',
                    'readings': 'Okuma Parçalarım', 'bank': 'YÖKDİL Kelime Bankası', 'flashcards': 'Kelime Kartları', 'study': 'Sınavlar & Testler',
                    'difficult': 'Zorlandığım Kelimeler', 'stats': 'İstatistikler', 'settings': 'Ayarlar',
                  })[activeTab] || activeTab}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadReadingOpen(true)}
                  className="px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition whitespace-nowrap"
                >
                  + Metin<span className="hidden sm:inline"> Yükle</span>
                </button>
                <button
                  onClick={() => {
                    setEditingCard(null);
                    setInitialWord('');
                    setInitialSentence('');
                    setIsVocabModalOpen(true);
                  }}
                  className="px-2.5 md:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition whitespace-nowrap"
                >
                  + Kelime<span className="hidden sm:inline"> Ekle</span>
                </button>
              </div>
            </header>

            {/* Sayfalar */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 max-w-6xl w-full mx-auto pb-24 md:pb-6">
              {/* ANA SAYFA */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <BackupReminder lastBackupAt={settings.lastBackupAt} snoozeUntil={settings.backupSnooze} hasData={cards.length + readings.length + customExams.length > 0}
                    onDownload={exportBackup} onFolderBackup={() => folderBackup(true)} onPickFolder={pickBackupFolder} folderName={backupDir && backupDir.name}
                    onSnooze={() => setSettings(s => ({ ...s, backupSnooze: addDays(getTodayStr(), 1) }))} />
                  <ExamCalendarCard settings={settings} setSettings={setSettings} />
                  <DailyPlanCard
                    due={dueCards.length} todayRec={todayRec} readingsCount={readings.length}
                    mistakesDue={mistakeQuestions(customExams).length} queued={cards.filter(c => c.queued).length}
                    perDay={settings.dailyListNew == null ? 10 : settings.dailyListNew}
                    onReview={() => setActiveTab('daily-review')}
                    onMistakes={() => { setExamPreset({ mistakes: true }); setActiveTab('study'); }}
                    onReading={() => setActiveTab('readings')}
                    onDrill={() => { setExamPreset({ drill: 10 }); setActiveTab('study'); }}
                    learnDue={learnDue} learnPerDay={settings.learnPerDay || 10} quizDue={quizDue} learnedToday={cards.filter(c => c.learnedAt === today).length}
                    onLearn={() => { setLearnMode('learn'); setActiveTab('learn'); }} onQuiz={() => { setLearnMode('quiz'); setActiveTab('learn'); }}
                  />
                  <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <h2 className="text-2xl font-black">
                      {dueCards.length > 0 ? `Bugün ${dueCards.length} Kelime Tekrar Bekliyor!` : 'Harika! Bugünkü Tüm Tekrarlarını Tamamladın.'}
                    </h2>
                    <p className="text-xs text-blue-100 mt-2 max-w-xl">
                      Aralıklı tekrar algoritması bilginizi unutulma eşiğinde hafızanıza çağırarak uzun vadeli kalıcılık sağlar.
                    </p>
                    <div className="mt-5 flex gap-3">
                      {dueCards.length > 0 ? (
                        <button
                          onClick={() => setActiveTab('daily-review')}
                          className="px-5 py-2.5 rounded-xl bg-white text-blue-900 font-extrabold text-xs shadow-lg hover:bg-blue-50 transition"
                        >
                          Tekrarı Başlat ({dueCards.length})
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab('study')}
                          className="px-5 py-2.5 rounded-xl bg-white/20 text-white font-bold text-xs hover:bg-white/30 transition"
                        >
                          Sınav Modları
                        </button>
                      )}
                      <button
                        onClick={() => setIsUploadReadingOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition"
                      >
                        Yeni Metin Yükle
                      </button>
                    </div>
                  </div>

                  {/* Seri, günlük hedef, sınav sayacı */}
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setActiveTab('stats')} className="text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-orange-600 transition">
                      <p className="text-[11px] text-slate-400">🔥 Seri</p>
                      <p className="text-xl font-black text-orange-400">{streakNow} gün</p>
                    </button>
                    <button onClick={() => setActiveTab('daily-review')} className="text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-blue-600 transition">
                      <p className="text-[11px] text-slate-400">🎯 Bugün</p>
                      <p className="text-xl font-black text-white">{todayRec.reviews || 0}<span className="text-xs text-slate-500">/{settings.dailyGoal || 20}</span></p>
                      <div className="h-1.5 mt-1 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: Math.min(100, (todayRec.reviews || 0) / (settings.dailyGoal || 20) * 100) + '%' }} /></div>
                    </button>
                    <button onClick={() => setActiveTab('stats')} className="text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-indigo-600 transition">
                      <p className="text-[11px] text-slate-400 truncate">📅 {settings.examName && settings.examId ? settings.examName : 'Sınava'}</p>
                      <p className="text-xl font-black text-indigo-300">{examLeft == null ? 'Tarih gir' : examLeft > 0 ? examLeft + ' gün' : examLeft === 0 ? 'Bugün' : '—'}</p>
                    </button>
                  </div>

                  {/* İstatistik Kutuları */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-slate-400">Toplam Kayıtlı Kelime</p>
                      <p className="text-3xl font-black text-white mt-1">{cards.length}</p>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-blue-400">Bugün Tekrar</p>
                      <p className="text-3xl font-black text-blue-400 mt-1">{dueCards.length}</p>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-emerald-400">Kalıcı Hafızada</p>
                      <p className="text-3xl font-black text-emerald-400 mt-1">{masteredCards.length}</p>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-amber-400">Zorlandığım</p>
                      <p className="text-3xl font-black text-amber-400 mt-1">{difficultCards.length}</p>
                    </div>
                  </div>

                  {/* Haftalarım Listesi */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm text-white">Haftalık Çalışma Listelerim</h3>
                      <button
                        onClick={() => setIsNewWeekOpen(true)}
                        className="text-xs text-blue-400 font-bold hover:underline"
                      >
                        + Yeni Hafta Oluştur
                      </button>
                    </div>
                    {weeks.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-xs text-slate-400">
                        Henüz çalışma haftası oluşturulmadı. "Yeni Hafta Oluştur" butonuna basarak başlayabilirsiniz.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {weeks.map(w => {
                          const wReadings = readings.filter(r => r.weekId === w.id);
                          const wCards = cards.filter(c => c.weekId === w.id);
                          return (
                            <div
                              key={w.id}
                              onClick={() => { setSelectedWeekId(w.id); setActiveTab('weeks'); }}
                              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500 cursor-pointer transition flex justify-between items-center"
                            >
                              <div>
                                <h4 className="font-bold text-sm text-white">{w.title}</h4>
                                <p className="text-xs text-slate-400 mt-1">{wReadings.length} metin • {wCards.length} kelime</p>
                              </div>
                              <span className="text-xs font-bold text-blue-400">Görüntüle →</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GÜNLÜK TEKRAR */}
              {activeTab === 'daily-review' && (
                <div className="max-w-xl mx-auto space-y-4">
                  {extraReviewIds && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200">
                      <span>Zorlandığım kelimeler tekrar ediliyor ({extraReviewIds.length})</span>
                      <button onClick={() => setExtraReviewIds(null)} className="underline">Normal tekrara dön</button>
                    </div>
                  )}
                  {reviewCards.length === 0 ? (
                    <div className="text-center py-16 bg-slate-950 rounded-3xl border border-slate-800 p-8 space-y-4">
                      <div className="text-5xl">🎉</div>
                      <h3 className="text-xl font-bold text-white">Harika İş!</h3>
                      <p className="text-xs text-slate-400">Bugün tekrar bekleyen kelimeniz bulunmuyor. Yeni bir okuma parçası ekleyebilir veya sınav modlarını deneyebilirsiniz.</p>
                      <button onClick={() => setActiveTab('study')} className="px-5 py-2.5 rounded-xl bg-blue-600 font-bold text-xs text-white">
                        Sınav Modlarına Git
                      </button>
                    </div>
                  ) : (
                    <DailyReviewSession
                      key={'review-' + getTodayStr() + (extraReviewIds ? '-extra' : '')}
                      cards={reviewCards}
                      goal={settings.dailyGoal || 20}
                      mode={settings.reviewMode || 'en-tr'}
                      onMode={(m) => setSettings(s => ({ ...s, reviewMode: m }))}
                      doneToday={(activity.find(a => a.id === getTodayStr()) || {}).reviews || 0}
                      onComplete={() => {
                        if (window.confetti) window.confetti({ particleCount: 100 });
                        setExtraReviewIds(null);
                        setActiveTab('dashboard');
                      }}
                      onRate={(cardId, rating) => {
                        const now = new Date().toISOString();
                        setCards(prev => prev.map(c => c.id === cardId ? { ...c, srs: processReview(c.srs, rating), updatedAt: now } : c));
                        logActivity({ reviews: 1, correct: rating >= 3 ? 1 : 0, again: rating === 1 ? 1 : 0 });
                      }}
                    />
                  )}
                </div>
              )}

              {/* YENİ KELİMELER: öğretici kartlar + günün kelime sınavı */}
              {activeTab === 'learn' && (
                <div className="space-y-4">
                  {learnMode === 'quiz' ? (
                    <DailyWordQuiz key={'quiz-' + getTodayStr()} cards={cards}
                      onExit={() => { setLearnMode('learn'); setActiveTab('dashboard'); }}
                      onLearn={() => setLearnMode('learn')}
                      onFinish={(grades) => {
                        const today = getTodayStr(), now = new Date().toISOString();
                        const g = new Map(grades.map(x => [x.id, x]));
                        setCards(prev => prev.map(c => g.has(c.id) ? { ...c, quizzedAt: today, srs: processReview(c.srs, g.get(c.id).grade), updatedAt: now } : c));
                        const ok = grades.reduce((a, x) => a + x.ok, 0), n = grades.reduce((a, x) => a + x.n, 0);
                        logActivity({ examQ: n, examCorrect: ok, wordQuizzes: 1 }, { 'Günün kelimeleri': [ok, n] });
                      }} />
                  ) : (
                    <>
                      {quizDue > 0 && (
                        <div className="max-w-xl mx-auto flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800 text-xs text-indigo-100">
                          <span className="mr-auto">🌙 Bugün öğrendiğiniz {quizDue} kelimenin sınavı hazır.</span>
                          <button onClick={() => setLearnMode('quiz')} className="px-3 py-1.5 rounded-lg bg-indigo-600 font-bold text-white">Günün kelime sınavı</button>
                        </div>
                      )}
                      <LearnSession key={'learn-' + getTodayStr() + '-' + learnRound} cards={cards} perDay={settings.learnPerDay || 10}
                        onExit={() => setActiveTab('dashboard')}
                        onQuiz={() => setLearnMode('quiz')}
                        onLearn={(learnedIds, knownIds) => {
                          const today = getTodayStr(), now = new Date().toISOString();
                          const L = new Set(learnedIds), K = new Set(knownIds);
                          setCards(prev => prev.map(c => L.has(c.id) ? { ...c, learnedAt: today, updatedAt: now }
                            : K.has(c.id) ? { ...c, learnedAt: today, quizzedAt: today, knownAtLearn: true, srs: { ...c.srs, state: 'review', interval: 30, repetitions: 1, lastReviewedAt: today, nextReviewAt: addDays(today, 30) }, updatedAt: now } : c));
                          if (learnedIds.length || knownIds.length) logActivity({ learned: learnedIds.length, newCards: learnedIds.length });
                        }} />
                      {learnDue > (settings.learnPerDay || 10) && (
                        <p className="max-w-xl mx-auto text-center text-[11px] text-slate-500">Bu oturumda {settings.learnPerDay || 10} kelime gelir; sırada {learnDue} yeni kelime var. Günlük sayıyı Ayarlar → Hatırlatıcılar'dan değiştirebilirsiniz. <button onClick={() => setLearnRound(r => r + 1)} className="text-blue-400 hover:underline">Bir oturum daha</button></p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* OKUMA PARÇALARI VE READER */}
              {activeTab === 'readings' && (
                selectedReadingId ? (
                  (() => {
                    const current = readings.find(r => r.id === selectedReadingId);
                    if (!current) return null;
                    return (
                      <div className="space-y-4 max-w-4xl mx-auto">
                        <div className="flex justify-between items-center">
                          <button
                            onClick={() => setSelectedReadingId(null)}
                            className="text-xs font-bold text-slate-400 hover:text-blue-400"
                          >
                            ← Tüm Okuma Parçalarına Dön
                          </button>
                          <button
                            onClick={() => setAutoVocabReadingId(current.id)}
                            className="ml-auto mr-2 px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 transition"
                          >
                            ✨ Kelimeleri Çıkar
                          </button>
                          <button
                            onClick={() => deleteReading(current.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-600/40 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition"
                          >
                            🗑 Metni Sil
                          </button>
                        </div>
                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                          <h2 className="text-xl font-black text-white">{current.title}</h2>
                          <p className="text-xs text-slate-400 mt-1">{current.category} • {current.wordCount} kelime</p>
                        </div>

                        {/* Akademik Kelime Listesi (AWL) özeti */}
                        {(() => {
                          const bank = new Set(cards.map(c => String(c.lemma || c.english).toLowerCase()));
                          const inBank = (w) => bank.has(w) || lemmaCandidates(w).some(x => bank.has(x));
                          const seen = new Map();
                          (plainText(current.content).match(/[A-Za-z]+/g) || []).forEach(t => {
                            const w = t.toLowerCase();
                            if (w.length < 3 || seen.has(w) || STOPWORDS.has(w)) return;
                            const n = awlSublist(w);
                            if (n) seen.set(w, n);
                          });
                          const list = [...seen.entries()].sort((a, b) => a[1] - b[1]);
                          if (!list.length) return null;
                          const missing = list.filter(([w]) => !inBank(w));
                          return (
                            <div className="bg-slate-950 p-4 rounded-2xl border border-purple-900/50 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-purple-200 font-bold mr-auto">📚 Bu metinde {list.length} akademik kelime (AWL) var{missing.length ? ', ' + missing.length + ' tanesi bankanızda yok' : ' — hepsi bankanızda ✓'}</p>
                                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                                  <input type="checkbox" checked={awlHighlight} onChange={e => setAwlHighlight(e.target.checked)} className="accent-purple-500" />
                                  Metinde vurgula
                                </label>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {list.slice(0, 80).map(([w, n]) => (
                                  <button key={w}
                                    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setWordPop({ word: w, sentence: extractSentence(plainText(current.content), w), x: r.left + r.width / 2, y: r.bottom, top: r.top, readingId: current.id }); }}
                                    title={'Alt liste ' + n + (inBank(w) ? ' · bankada var' : ' · anlamını gör / karta ekle')}
                                    className={"px-2 py-0.5 rounded-full text-[11px] border " + (inBank(w) ? 'border-emerald-800 text-emerald-300 bg-emerald-950/40' : 'border-purple-800 text-purple-200 bg-purple-950/40 hover:bg-purple-900')}>
                                    {w}<sup className="ml-0.5 text-[8px] opacity-70">{n}</sup>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Okuma Modu ve Yardımcı Araçlar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                          <span className="text-slate-400 font-medium">💡 İpucu: Kelimeye tıklayıp anlamını görün veya fareyle/dokunarak seçip kalıp olarak ekleyin.</span>
                          <label className="flex items-center gap-1.5 text-xs text-amber-300 cursor-pointer select-none font-bold bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-800/60 hover:bg-amber-950/70 transition">
                            <input type="checkbox" checked={bionicReading} onChange={e => setBionicReading(e.target.checked)} className="accent-amber-400" />
                            ⚡ Bionic Reading (Akademik Odak)
                          </label>
                          <ReadingTimer key={current.id} words={current.wordCount || plainText(current.content).split(/\s+/).filter(Boolean).length} onDone={(wpm) => { logActivity({ wpmSum: wpm, wpmN: 1 }); setReadings(prev => prev.map(r => r.id === current.id ? { ...r, lastWpm: wpm } : r)); }} />
                        </div>

                        {/* Metin Alanı ve Seçim */}
                        <div
                          data-reader
                          title="Bir kelimeye tıklayın: anlamı görünsün"
                          onMouseUp={() => handleReaderSelection(current.content)}
                          onTouchEnd={() => handleReaderSelection(current.content)}
                          onClick={(e) => handleWordClick(e, current)}
                          className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-slate-200 font-serif leading-loose text-base whitespace-pre-wrap select-text"
                        >
                          {/* "## " ile başlayan satırlar başlık olarak kalın gösterilir */}
                          {(() => {
                            // AWL vurgusu (çok uzun metinlerde performans için kapalı)
                            const hl = awlHighlight && current.content.length < 120000;
                            const bank = hl ? new Set(cards.map(c => String(c.lemma || c.english).toLowerCase())) : null;
                            // Biyonik okuma ve AWL vurgusu birlikte çalışır (kelime kelime işlenir, boşluklar aynen korunur)
                            const bionic = bionicReading && current.content.length < 120000;
                            const renderLine = (line) => {
                              if (!bionic && !hl) return line;
                              return line.split(/([A-Za-z]+)/).map((tok, k) => {
                                if (k % 2 === 0) return tok;
                                const w = tok.toLowerCase();
                                let awlCls = '';
                                if (hl && w.length >= 3 && !STOPWORDS.has(w) && awlSublist(w)) {
                                  const own = bank.has(w) || lemmaCandidates(w).some(x => bank.has(x));
                                  awlCls = "underline decoration-2 underline-offset-4 " + (own ? 'decoration-emerald-500/70' : 'decoration-purple-400');
                                }
                                if (bionic) return formatBionicWord(tok, k, awlCls);
                                return awlCls ? <span key={k} className={awlCls}>{tok}</span> : tok;
                              });
                            };
                            return current.content.split('\n').map((line, i) => (
                              /^##\s+/.test(line)
                                ? <strong key={i} className="block font-sans font-black text-white text-lg leading-snug mt-2 mb-1">{line.replace(/^##\s+/, '')}</strong>
                                : <React.Fragment key={i}>{renderLine(line)}{'\n'}</React.Fragment>
                            ));
                          })()}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg text-white">Yüklediğiniz Okuma Parçaları</h3>
                      <button onClick={() => setIsUploadReadingOpen(true)} className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white">
                        + Metin Yükle
                      </button>
                    </div>
                    {readings.length === 0 ? (
                      <div className="text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
                        Henüz okuma metni yüklenmedi.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {readings.map(r => (
                          <div
                            key={r.id}
                            onClick={() => setSelectedReadingId(r.id)}
                            className="relative p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 cursor-pointer transition"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteReading(r.id); }}
                              title="Metni sil"
                              aria-label={'"' + r.title + '" metnini sil'}
                              className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-red-600 hover:text-white transition"
                            >
                              🗑 Sil
                            </button>
                            <span className="text-[10px] font-bold text-blue-400">{r.category}</span>
                            <h4 className="font-bold text-base text-white mt-1">{r.title}</h4>
                            <p className="text-xs text-slate-400 line-clamp-3 mt-2 font-serif">{r.content.replace(/^##\s+/gm, '')}</p>
                            <p className="text-[11px] text-blue-400 font-bold mt-4">Aç ve Kelime Seç →</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* İSTATİSTİKLER */}
              {activeTab === 'stats' && (
                <StatsSection cards={cards} exams={customExams} user={sync.user} onSignIn={sync.signIn} activity={activity} settings={settings} setSettings={setSettings}
                              onWeeklyCheckup={() => { setExamPreset({ weekly: true, at: Date.now() }); goTab('study'); }} />
              )}

              {/* ZORLANDIĞIM KELİMELER */}
              {activeTab === 'difficult' && (
                <DifficultSection
                  cards={cards}
                  onUnmark={(id) => setCards(prev => prev.map(c => c.id === id ? { ...c, isDifficult: false, updatedAt: new Date().toISOString() } : c))}
                  onStudy={(ids) => { setExtraReviewIds(ids); setActiveTab('daily-review'); }}
                />
              )}

              {/* SINAVLAR & TESTLER */}
              {activeTab === 'study' && (
                <ExamSection
                  cards={cards}
                  readings={readings}
                  customExams={customExams}
                  onOpenUploadExam={() => setIsUploadExamOpen(true)}
                  onDeleteExam={(id) => {
                    if (window.confirm('Bu çıkmış sınavı silmek istediğinize emin misiniz?')) {
                      setCustomExams(prev => prev.filter(e => e.id !== id));
                      showToast('Sınav silindi.');
                    }
                  }}
                  onUpdateExam={(ex) => setCustomExams(prev => prev.map(e => e.id === ex.id ? { ...ex, updatedAt: new Date().toISOString() } : e))}
                  onExamFinished={(ex, attempt, rows) => {
                    const graded = rows.filter(r => r.graded);
                    const correct = graded.filter(r => r.ok).length;
                    const byType = {};
                    graded.forEach(r => { const t = r.section; byType[t] = byType[t] || [0, 0]; byType[t][1]++; if (r.ok) byType[t][0]++; });
                    if (graded.length) logActivity({ examQ: graded.length, examCorrect: correct, realExams: 1 }, byType, { [ex.field || 'Genel']: [correct, graded.length] });
                    const summary = { ...attempt, correct, graded: graded.length, empty: rows.filter(r => r.empty).length };
                    // Yanlış ve boş bırakılan (anahtarı olan) sorular Yanlışlarım destesine: yarın tekrar sorulur
                    const tomorrow = addDays(getTodayStr(), 1);
                    setCustomExams(prev => prev.map(e => {
                      if (e.id !== ex.id) return e;
                      const mistakes = { ...(e.mistakes || {}) };
                      graded.filter(r => !r.ok).forEach(r => { const m = mistakes[r.num] || {}; mistakes[r.num] = { box: 0, due: tomorrow, wrongCount: (m.wrongCount || 0) + 1 }; });
                      return { ...e, mistakes, attempts: [summary, ...(e.attempts || [])].slice(0, 10), updatedAt: new Date().toISOString() };
                    }));
                  }}
                  onExtractVocabFromExam={handleExtractVocabFromExam}
                  onMistakeResult={mistakeResult}
                  onPassagesToReadings={passagesToReadings}
                  onCreateExam={(ex) => { setCustomExams(prev => [ex, ...prev]); showToast('"' + ex.title + '" hazır: ' + ex.questions.length + ' soru. Başarılar!'); }}
                  onShareExam={shareExam}
                  onOpenLibrary={() => setLibraryKind('exam')}
                  onAnswer={(type, ok) => logActivity({ examQ: 1, examCorrect: ok ? 1 : 0 }, { [type]: [ok ? 1 : 0, 1] })}
                  prepBest={settings.prepBest || 0}
                  onPrepBest={(n) => setSettings(s => ({ ...s, prepBest: n }))}
                  preset={examPreset}
                  onPresetUsed={() => setExamPreset(null)}
                  onCheckupDone={(c, n) => { logActivity({ checkups: 1, checkupCorrect: c, checkupTotal: n }); showToast('Haftalık check-up: ' + c + '/' + n + ' (%' + Math.round(c / n * 100) + ')'); }}
                  onMarkDifficult={(ids) => {
                    const set = new Set(ids);
                    setCards(prev => prev.map(c => set.has(c.id) ? { ...c, isDifficult: true, updatedAt: new Date().toISOString() } : c));
                    showToast(ids.length + ' kelime "Zorlandığım Kelimeler"e eklendi.');
                  }}
                />
              )}

              {/* KELİME KARTLARI */}
              {activeTab === 'flashcards' && (
                <FlashcardsSection
                  cards={cards}
                  readings={readings}
                  recentIds={recentCardIds}
                  onUpdate={(updated) => setCards(prev => prev.map(c => c.id === updated.id ? updated : c))}
                  onUpdateMany={(list) => { const m = new Map(list.map(c => [c.id, c])); setCards(prev => prev.map(c => m.get(c.id) || c)); }}
                  onAudio={() => setAudioOpen(true)}
                  onImportList={() => setIsWordListOpen(true)}
                  onFrequent={() => setFreqOpen(true)}
                  onShareList={shareList}
                  onOpenLibrary={() => setLibraryKind('list')}
                  onDelete={(id) => {
                    const word = (cards.find(c => c.id === id) || {}).english;
                    setCards(prev => prev.filter(c => c.id !== id));
                    setRecentCardIds(prev => prev.filter(x => x !== id));
                    setReadings(prev => prev.map(r => (r.savedWordIds || []).includes(id) ? { ...r, savedWordIds: r.savedWordIds.filter(x => x !== id) } : r));
                    setToast('"' + word + '" kartı silindi.');
                    setTimeout(() => setToast(''), 3000);
                  }}
                />
              )}

              {/* YÖKDİL KELİME BANKASI */}
              {activeTab === 'bank' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-white mr-auto">Kelime Bankası ({cards.length})</h3>
                    <input type="search" value={bankQuery} onChange={e => { setBankQuery(e.target.value); setBankLimit(60); }} placeholder="Ara…" aria-label="Kelime bankasında ara" className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white w-32 mr-2" />
                    <button onClick={() => setIsWordListOpen(true)} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-xs font-bold text-white mr-2">📥 Liste içe aktar</button>
                    <button
                      onClick={() => {
                        const q = (v) => '"' + String(Array.isArray(v) ? v.join('; ') : (v || '')).replace(/"/g, '""') + '"';
                        const csvContent = "English,Turkish,IPA,Okunus,PartOfSpeech,Synonyms,Antonyms,OriginalSentence,Examples\n" +
                          cards.map(c => [c.english, c.turkish, c.ipa, c.okunus, c.partOfSpeech, c.synonyms, c.antonyms, c.originalSentence, c.examples].map(q).join(',')).join("\n");
                        const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'yokdil_kelimeler.csv'; a.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
                    >
                      CSV Dışa Aktar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bankList.slice(0, bankLimit).map(c => (
                      <div key={c.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300">{c.partOfSpeech}</span>
                          <div className="flex items-center gap-2">
                            <TurengLink word={c.lemma || c.english} />
                            <button onClick={() => playWord(c)} className="text-xs text-blue-400">🔊 Dinle</button>
                          </div>
                        </div>
                        <h4 className="font-bold text-base text-white">{c.english}</h4>
                        {(c.ipa || c.okunus) && (
                          <p className="text-[11px] text-slate-400">
                            {c.ipa && <span className="font-mono">/{c.ipa}/</span>}
                            {c.okunus && <span className="text-amber-300 ml-1.5">[{c.okunus}]</span>}
                          </p>
                        )}
                        <p className="text-xs font-semibold text-blue-400">{c.turkish}</p>
                        {c.originalSentence && (
                          <p className="text-[11px] text-slate-400 font-serif italic line-clamp-2">"{c.originalSentence}"</p>
                        )}
                        {(c.examples || [])[0] && <p className="text-[11px] text-slate-500 font-serif line-clamp-2">• {c.examples[0]}</p>}
                        {(c.synonyms || []).length > 0 && (
                          <p className="text-[10px]"><span className="text-slate-500">Eş:</span> <span className="text-emerald-300">{c.synonyms.slice(0, 4).join(', ')}</span></p>
                        )}
                        {(c.antonyms || []).length > 0 && (
                          <p className="text-[10px]"><span className="text-slate-500">Zıt:</span> <span className="text-red-300">{c.antonyms.slice(0, 3).join(', ')}</span></p>
                        )}
                      </div>
                    ))}
                  </div>
                  {bankList.length > bankLimit && (
                    <button onClick={() => setBankLimit(bankLimit + 60)} className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800">Daha fazla göster ({bankLimit} / {bankList.length})</button>
                  )}
                </div>
              )}

              {/* AYARLAR */}
              {activeTab === 'settings' && (
                <div className="max-w-xl mx-auto space-y-6">
                  <ReminderSettings settings={settings} setSettings={setSettings} />
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-base text-white">Telegram Bildirim Ayarları</h3>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Telegram Bot Token</label>
                      <input
                        type="password"
                        value={settings.telegramBotToken}
                        onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono"
                        placeholder="BotFather'dan alınan token"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Telegram Chat ID</label>
                      <input
                        type="text"
                        value={settings.telegramChatId}
                        onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono"
                        placeholder="@userinfobot ile öğrenilen ID"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!settings.telegramBotToken || !settings.telegramChatId) {
                          alert('Lütfen Bot Token ve Chat ID giriniz.');
                          return;
                        }
                        try {
                          const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              chat_id: settings.telegramChatId,
                              text: `🔔 <b>YÖKDİL Master Test Bildirimi</b>\n\nTelegram bağlantınız başarıyla sağlandı!`,
                              parse_mode: 'HTML'
                            })
                          });
                          const d = await res.json();
                          if (d.ok) alert('Test bildirimi Telegram hesabınıza gönderildi!');
                          else alert('Hata: ' + d.description);
                        } catch (err) {
                          alert('Ağ hatası: ' + err.message);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white shadow"
                    >
                      Test Bildirimi Gönder
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* Kayan Kelime Seçim Butonu */}
          {popoverPos && (
            <div
              style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px`, transform: 'translate(-50%, -100%) translateY(-10px)' }}
              className="fixed z-50 bg-slate-950 border border-slate-700 text-white p-2 rounded-xl shadow-2xl flex flex-wrap items-center gap-2 max-w-sm"
            >
              <button
                onClick={handleAddSelection}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow transition"
              >
                + Kelime Listeme Ekle
              </button>
              {expandedPhrase && (
                <button
                  onClick={() => {
                    setSelectionText(expandedPhrase);
                    setExpandedPhrase('');
                  }}
                  title="Seçimi bu tamlamaya/kalıba genişlet"
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow transition flex items-center gap-1"
                >
                  <span>🔗 Kalıbı Genişlet:</span> <span className="underline italic">"{expandedPhrase}"</span>
                </button>
              )}
              <span className="text-xs text-slate-300 font-mono">"{selectionText}"</span>
            </div>
          )}

          {/* Mükerrer Kelime Uyarısı */}
          {duplicateCard && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
                <h3 className="font-bold text-base text-white">Kelime Zaten Kayıtlı!</h3>
                <p className="text-xs text-slate-300">
                  <b>"{duplicateCard.english}"</b> ifadesi daha önce kaydedilmiş. İkinci bir kart açmak yerine bu okuma parçasındaki cümleyi mevcut karta eklemek ister misiniz?
                </p>
                <div className="flex gap-2">
                  <button onClick={handleAppendSource} className="flex-1 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white">
                    (Önerilen) Cümleyi Ekle
                  </button>
                  <button onClick={() => setDuplicateCard(null)} className="py-2 px-3 rounded-xl bg-slate-800 text-xs text-slate-300">
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kelime Ekleme Modalı (12 Alan) */}
          {isVocabModalOpen && (
            <VocabAddModal
              initialWord={initialWord}
              initialSentence={initialSentence}
              onClose={() => setIsVocabModalOpen(false)}
              onSave={(newCard) => {
                setCards([newCard, ...cards]);
                setIsVocabModalOpen(false);
              }}
            />
          )}

          {/* Tıkla-anlam kutusu */}
          {wordPop && activeTab === 'readings' && (
            <WordPopover pop={wordPop} cards={cards} onAdd={addWordFromPopover} onClose={() => setWordPop(null)}
                         onAddPhrase={(phrase, sentence) => {
                           setWordPop(null);
                           const dup = cards.find(c => String(c.english).toLowerCase() === phrase.toLowerCase());
                           if (dup) { setDuplicateCard(dup); return; }
                           setInitialWord(phrase); setInitialSentence(sentence || ''); setEditingCard(null); setIsVocabModalOpen(true);
                         }}
                         onAnalyze={(s) => { setWordPop(null); setSentenceToAnalyze(s); }} />
          )}

          {/* Herkese açık paylaşım ve kütüphane */}
          {shareReq && (
            <ShareModal req={shareReq} user={sync.user} onSignIn={sync.signIn} onClose={() => setShareReq(null)}
              onDone={(title) => { setShareReq(null); showToast('"' + title + '" herkese açık kütüphaneye eklendi.'); }} />
          )}
          {libraryKind && (
            <PublicLibraryModal user={sync.user} initialKind={libraryKind} onClose={() => setLibraryKind(null)}
              onAddList={addSharedList} onAddExam={addSharedExam} />
          )}

          {freqOpen && <FrequentWordsModal exams={customExams} cards={cards} onClose={() => setFreqOpen(false)} onAdd={addFrequentWords} />}
          {/* Kelime listesi PDF içe aktarma */}
          {isWordListOpen && (
            <WordListImportModal
              cards={cards}
              onClose={() => setIsWordListOpen(false)}
              onImport={(newCards, fills, perDay) => {
                const upd = new Map(fills.map(c => [c.id, c]));
                setCards(prev => [...prev.map(c => upd.get(c.id) || c), ...newCards]);
                setSettings(s => ({ ...s, dailyListNew: perDay, listReleaseDay: getTodayStr() }));
                setIsWordListOpen(false);
                const active = newCards.filter(c => !c.queued).length;
                showToast(newCards.length + ' kelime eklendi: ' + active + ' tanesi bugünkü tekrarda, ' + (newCards.length - active) + ' tanesi sırada (her gün ' + perDay + ' yeni kelime)' + (fills.length ? '; ' + fills.length + ' mevcut kartın eksikleri tamamlandı' : '') + '.');
              }}
            />
          )}

          {/* Sesli çalışma */}
          {audioOpen && <AudioStudyModal cards={cards} dueCards={dueCards} onClose={() => setAudioOpen(false)} />}

          {/* Cümle çevirisi ve analizi */}
          {sentenceToAnalyze && <SentenceModal sentence={sentenceToAnalyze} cards={cards} onClose={() => setSentenceToAnalyze(null)} />}

          {/* Metinden Otomatik Kelime Çıkarma */}
          {autoVocabReadingId && readings.find(r => r.id === autoVocabReadingId) && (
            <AutoVocabModal
              reading={readings.find(r => r.id === autoVocabReadingId)}
              cards={cards}
              onClose={() => setAutoVocabReadingId(null)}
              onAdd={(newCards, updated) => {
                const upd = new Map(updated.map(c => [c.id, c]));
                setCards([...newCards, ...cards.map(c => upd.get(c.id) || c)]);
                const r = readings.find(x => x.id === autoVocabReadingId);
                if (r) {
                  const ids = new Set([...(r.savedWordIds || []), ...newCards.map(c => c.id), ...updated.map(c => c.id)]);
                  setReadings(readings.map(x => x.id === r.id ? { ...x, savedWordIds: [...ids] } : x));
                }
                setAutoVocabReadingId(null);
                // Eklenen kelimelerin kartlarını ayrı "Kelime Kartları" bölümünde göster
                setRecentCardIds([...newCards.map(c => c.id), ...updated.map(c => c.id)]);
                setSelectedReadingId(null);
                setActiveTab('flashcards');
                setToast(newCards.length + ' yeni kelime kartı oluşturuldu' + (updated.length ? ', ' + updated.length + ' mevcut kart güncellendi' : '') + '.');
                setTimeout(() => setToast(''), 4000);
              }}
            />
          )}

          {storageWarning && (
            <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92vw] px-4 py-3 rounded-xl bg-red-700 text-white text-xs font-semibold shadow-2xl flex items-start gap-3">
              <span className="flex-1">⚠ {storageWarning}</span>
              <button onClick={exportBackup} className="px-2 py-1 rounded bg-white text-red-700 font-bold whitespace-nowrap">Yedek indir</button>
              <button onClick={() => setStorageWarning('')} aria-label="Uyarıyı kapat" className="px-1 text-white/80 hover:text-white">✕</button>
            </div>
          )}

          {toast && (
            <div role="status" className={"fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-2xl max-w-[90vw] " + (toast.startsWith('⚠') ? 'bg-red-600' : 'bg-emerald-600')}>
              {toast.startsWith('⚠') ? toast : '✓ ' + toast}
            </div>
          )}

          {/* Okuma Parçası Yükleme Modalı */}
          {isUploadReadingOpen && (
            <UploadModal
              weeks={weeks}
              onClose={() => setIsUploadReadingOpen(false)}
              onSave={(saved) => {
                const list = Array.isArray(saved) ? saved : [saved];
                setReadings([...list, ...readings]);
                setIsUploadReadingOpen(false);
                // Tek metin kaydedildiyse onu aç, birden çok ise listeyi göster
                setSelectedReadingId(list.length === 1 ? list[0].id : null);
                setActiveTab('readings');
              }}
            />
          )}

          {/* Çıkmış Sınav / Deneme Yükleme Modalı */}
          {isUploadExamOpen && (
            <UploadExamModal
              onClose={() => setIsUploadExamOpen(false)}
              onSave={(newExam) => {
                setCustomExams([newExam, ...customExams]);
                setIsUploadExamOpen(false);
                showToast(`"${newExam.title}" başarıyla eklendi (${newExam.questions.length} soru ayrıştırıldı).`);
              }}
            />
          )}

          {/* Yeni Hafta Modalı */}
          {isNewWeekOpen && (
            <WeekAddModal
              onClose={() => setIsNewWeekOpen(false)}
              onSave={(newWeek) => {
                setWeeks([newWeek, ...weeks]);
                setIsNewWeekOpen(false);
              }}
            />
          )}
        </div>
      );
    }

