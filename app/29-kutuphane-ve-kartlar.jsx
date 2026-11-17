    // --- HERKESE AÇIK KÜTÜPHANE ---
    // Kullanıcı seçtiği kelime listesini ya da denemeyi paylaşır: public_shares/{id} (başlık, sayı, sahibi)
    // + public_shares/{id}/chunks/{n} (içerik, 1 MB belge sınırı için parçalara bölünmüş JSON).
    // Herkes okuyabilir; yalnızca paylaşan kişi değiştirip silebilir. Kişisel tekrar geçmişi paylaşılmaz.
    const PUBLIC_COL = 'public_shares';
    const cardForShare = (c) => {
      const o = {
        english: c.english, lemma: c.lemma || '', turkish: isMissingMeaning(c) ? '' : (c.turkish || ''),
        partOfSpeech: c.partOfSpeech || '', ipa: c.ipa || '', okunus: c.okunus || '',
        hyphenation: c.hyphenation || '', definition: c.definition || '',
        examples: (c.examples || []).slice(0, 2), synonyms: (c.synonyms || []).slice(0, 6), antonyms: (c.antonyms || []).slice(0, 5),
        questionType: c.questionType || '', listNo: c.listNo || null,
      };
      if (c.examInfo && c.examInfo.verified) o.examInfo = { title: c.examInfo.title || '', year: c.examInfo.year || '', field: c.examInfo.field || '', verified: true };
      return o;
    };
    const examForShare = (ex) => ({
      title: ex.title, field: ex.field || '', year: ex.year || '', term: ex.term || '',
      questions: (ex.questions || []).map(q => ({ num: q.num, prompt: q.prompt, options: q.options, answer: q.answer, correctLetter: q.correctLetter || '', category: q.category || '', ...(q.passage ? { passage: q.passage } : {}) })),
    });
    const publicError = (e) => {
      const code = e && e.code;
      if (code === 'permission-denied') return 'Herkese açık kütüphaneye erişim izni yok. Firebase\'de Firestore kurallarının güncellenmesi gerekiyor.';
      if (code === 'unavailable') return 'Sunucuya bağlanılamadı (internet bağlantısını kontrol edin).';
      return (e && e.message) || 'Bilinmeyen hata';
    };
    async function publishShare(user, { kind, title, note, sourceKey, items, meta }) {
      const fb = getFirebase();
      if (!fb) throw new Error('Firebase yüklenemedi.');
      const col = fb.db.collection(PUBLIC_COL);
      // Aynı kaynağı daha önce paylaştıysa eskisini kaldır (güncelleme)
      const old = await col.where('ownerUid', '==', user.uid).where('sourceKey', '==', sourceKey).get();
      for (const d of old.docs) await deleteShare(d.id);
      const per = kind === 'exam' ? 40 : 400;
      const chunks = [];
      for (let i = 0; i < items.length; i += per) chunks.push(JSON.stringify(items.slice(i, i + per)));
      const ref = col.doc();
      await ref.set({ kind, title, note: note || '', sourceKey, ownerUid: user.uid, count: items.length, chunks: chunks.length, meta: meta || {}, createdAt: Date.now() });
      for (let i = 0; i < chunks.length; i += 20) {
        const batch = fb.db.batch();
        chunks.slice(i, i + 20).forEach((json, k) => batch.set(ref.collection('chunks').doc(String(i + k)), { json }));
        await batch.commit();
      }
      return ref.id;
    }
    async function loadShare(id) {
      const fb = getFirebase();
      if (!fb) throw new Error('Firebase yüklenemedi.');
      const snap = await fb.db.collection(PUBLIC_COL).doc(id).collection('chunks').get();
      return snap.docs.sort((a, b) => +a.id - +b.id).flatMap(d => JSON.parse(d.data().json || '[]'));
    }
    async function deleteShare(id) {
      const fb = getFirebase();
      const ref = fb.db.collection(PUBLIC_COL).doc(id);
      const snap = await ref.collection('chunks').get();
      for (const d of snap.docs) await d.ref.delete();
      await ref.delete();
    }

    // Paylaşma penceresi
    function ShareModal({ req, user, onSignIn, onClose, onDone }) {
      const [title, setTitle] = useState(req.title);
      const [note, setNote] = useState('');
      const [ok, setOk] = useState(false);
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');
      const go = async () => {
        setBusy(true); setErr('');
        try { await publishShare(user, { ...req, title: title.trim() || req.title, note: note.trim() }); onDone(title.trim() || req.title); }
        catch (e) { setErr(publicError(e)); }
        finally { setBusy(false); }
      };
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-3">
            <h3 className="font-bold text-base text-white">🌐 Herkese açık paylaş</h3>
            <p className="text-xs text-slate-400">{req.kind === 'exam' ? req.items.length + ' soruluk deneme' : req.items.length + ' kelimelik liste'} herkese açık kütüphaneye eklenir. Siteyi açan herkes görebilir ve kendi bankasına ekleyebilir. Adınız ve e-postanız gösterilmez; kendi tekrar geçmişiniz ve cevaplarınız paylaşılmaz. İstediğiniz zaman kütüphaneden kaldırabilirsiniz.</p>
            <label className="block text-[11px] text-slate-400">Başlık
              <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
            </label>
            <label className="block text-[11px] text-slate-400">Not (isteğe bağlı; kaynak adı gibi)
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Örn: Kaynak: Zafer Hoca Dil Akademisi (zaferhoca.com.tr)" className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
            </label>
            <label className="flex items-start gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-0.5 accent-blue-500" />
              <span>Bu içeriği paylaşma hakkım var. (Kendi hazırladıklarım ya da paylaşılmasına izin verilen kaynaklar; ÖSYM çıkmış soruları ve izin vermeyen yayınların içerikleri paylaşılmaz.)</span>
            </label>
            {err && <p className="text-[11px] text-red-300">⚠ {err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              {user
                ? <button disabled={!ok || busy} onClick={go} className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Paylaşılıyor…' : 'Paylaş'}</button>
                : <button onClick={onSignIn} className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white">Paylaşmak için Google ile giriş yap</button>}
            </div>
          </div>
        </div>
      );
    }

    // Herkese açık kütüphane: paylaşılan listeler ve denemeler
    function PublicLibraryModal({ user, initialKind, onClose, onAddList, onAddExam }) {
      const [items, setItems] = useState(null);
      const [err, setErr] = useState('');
      const [kind, setKind] = useState(initialKind || 'all');
      const [busyId, setBusyId] = useState('');
      const [preview, setPreview] = useState(null);     // { id, rows }
      const [done, setDone] = useState({});
      const load = async () => {
        setErr('');
        try {
          const fb = getFirebase();
          if (!fb) throw new Error('Firebase yüklenemedi.');
          const snap = await fb.db.collection(PUBLIC_COL).orderBy('createdAt', 'desc').limit(100).get();
          setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { setErr(publicError(e)); setItems([]); }
      };
      useEffect(() => { load(); }, []);
      const add = async (s) => {
        setBusyId(s.id);
        try {
          const rows = await loadShare(s.id);
          const n = s.kind === 'exam' ? onAddExam(s, rows) : onAddList(s, rows);
          setDone(d => ({ ...d, [s.id]: n }));
        } catch (e) { setErr(publicError(e)); }
        finally { setBusyId(''); }
      };
      const showPreview = async (s) => {
        if (preview && preview.id === s.id) { setPreview(null); return; }
        setBusyId(s.id);
        try { setPreview({ id: s.id, rows: (await loadShare(s.id)).slice(0, 8) }); } catch (e) { setErr(publicError(e)); }
        finally { setBusyId(''); }
      };
      const remove = async (s) => {
        if (!window.confirm('"' + s.title + '" herkese açık kütüphaneden kaldırılsın mı? (Kendi bankanızdaki kopyanız silinmez.)')) return;
        setBusyId(s.id);
        try { await deleteShare(s.id); setItems(prev => prev.filter(x => x.id !== s.id)); } catch (e) { setErr(publicError(e)); }
        finally { setBusyId(''); }
      };
      const shown = (items || []).filter(s => kind === 'all' || s.kind === kind);
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">🌐 Herkese Açık Kütüphane</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kullanıcıların paylaştığı kelime listeleri ve denemeler. Eklediğiniz içerik kendi bankanıza kopyalanır.</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <div className="flex gap-1.5 text-xs">
              {[['all', 'Tümü'], ['list', '📚 Kelime listeleri'], ['exam', '📄 Denemeler']].map(([k, l]) => (
                <button key={k} onClick={() => setKind(k)} className={"px-3 py-1.5 rounded-lg font-bold " + (kind === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}>{l}</button>
              ))}
            </div>
            {err && <p className="text-xs text-red-300">⚠ {err}</p>}
            {items === null && <p className="text-xs text-slate-500">Yükleniyor…</p>}
            {items && !shown.length && !err && <p className="text-xs text-slate-500">Henüz paylaşılan içerik yok. Kelime Kartları'nda bir liste seçip ya da bir denemenin kartında "🌐 Paylaş" ile ilk paylaşımı siz yapabilirsiniz.</p>}
            {shown.map(s => (
              <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{s.kind === 'exam' ? '📄' : '📚'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.title}</p>
                    <p className="text-[11px] text-slate-500">{s.count} {s.kind === 'exam' ? 'soru' : 'kelime'}{s.meta && s.meta.field ? ' · ' + s.meta.field : ''} · {new Date(s.createdAt).toLocaleDateString('tr-TR')}{user && s.ownerUid === user.uid ? ' · sizin paylaşımınız' : ''}</p>
                    {s.note && <p className="text-[11px] text-slate-400">{s.note}</p>}
                  </div>
                  <button onClick={() => showPreview(s)} disabled={busyId === s.id} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200">Önizle</button>
                  {done[s.id] != null
                    ? <span className="text-[11px] font-bold text-emerald-400">✓ {done[s.id]} eklendi</span>
                    : <button onClick={() => add(s)} disabled={busyId === s.id} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-[11px] font-bold text-white disabled:opacity-50">{busyId === s.id ? '…' : 'Bankama ekle'}</button>}
                  {user && s.ownerUid === user.uid && <button onClick={() => remove(s)} disabled={busyId === s.id} title="Kütüphaneden kaldır" className="px-2 py-1.5 rounded-lg text-[11px] text-red-400 hover:bg-red-950">🗑</button>}
                </div>
                {preview && preview.id === s.id && (
                  <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-800 pt-1.5">
                    {preview.rows.map((r, i) => s.kind === 'exam'
                      ? <p key={i} className="truncate">{r.num}. {r.prompt || '(parça sorusu)'}</p>
                      : <p key={i} className="truncate"><b className="text-white">{r.english}</b> → <span className="text-blue-300">{r.turkish}</span></p>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Kelime listesi PDF'lerini içe aktarma penceresi
    function WordListImportModal({ cards, onClose, onImport }) {
      const [files, setFiles] = useState([]);          // [{ name, listName, entries, error }]
      const [busy, setBusy] = useState('');
      const [startNow, setStartNow] = useState(20);
      const [perDay, setPerDay] = useState(10);
      const [shuffle, setShuffle] = useState(false);
      const prettyName = (n) => n.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\bzafer hoca\b/i, 'Zafer Hoca').replace(/\b\p{L}/gu, ch => ch.toLocaleUpperCase('tr'));

      const pick = async (e) => {
        const list = [...(e.target.files || [])];
        e.target.value = '';
        for (const file of list) {
          setBusy('"' + file.name + '" okunuyor…');
          try {
            const { entries } = await extractWordListPdf(await file.arrayBuffer(), (s) => setBusy('"' + file.name + '": ' + s));
            const norm = entries.map(normalizeWordEntry).filter(x => x.english && x.turkish);
            setFiles(prev => [...prev, { name: file.name, listName: prettyName(file.name), entries: norm, error: norm.length ? '' : 'Bu dosyada "No | Kelime | Anlam" biçiminde bir tablo bulunamadı.' }]);
          } catch (err) {
            setFiles(prev => [...prev, { name: file.name, listName: prettyName(file.name), entries: [], error: err.message || 'Okunamadı.' }]);
          }
        }
        setBusy('');
      };

      // Bankadakilerle ve listeler arasında tekrarları ayıkla
      const existing = new Map(cards.map(c => [String(c.lemma || c.english).toLowerCase(), c]));
      const existingEn = new Set(cards.map(c => String(c.english).toLowerCase()));
      // Aynı kök ("abort by" ve "abort") tek kart olur; sonraki listedeki IPA / okunuş / tür bilgisi ilkine eklenir
      const seen = new Map();
      const plan = [];
      let dupBank = 0, dupList = 0;
      files.forEach(f => f.entries.forEach(x => {
        const k = x.english.toLowerCase();
        if (existingEn.has(k) || existing.has(k) || existing.has(x.lemma)) { dupBank++; return; }
        const prev = seen.get(k) || seen.get(x.lemma);
        if (prev) {
          dupList++;
          if (!prev.ipa && x.ipa) prev.ipa = x.ipa;
          if (!prev.okunus && x.okunus) prev.okunus = x.okunus;
          if (!prev.pos && x.pos) prev.pos = x.pos;
          if (prev.listName !== f.listName && !(prev.alsoIn || []).includes(f.listName)) prev.alsoIn = [...(prev.alsoIn || []), f.listName];
          return;
        }
        const item = { ...x, listName: f.listName };
        seen.set(k, item); seen.set(x.lemma, item);
        plan.push(item);
      }));

      const doImport = () => {
        const now = new Date().toISOString(), today = getTodayStr();
        const order = shuffle ? shuffleArr(plan) : plan;
        const stamp = Date.now();
        const newCards = order.map((x, i) => {
          const id = 'card_wl_' + stamp + '_' + i;
          const active = i < startNow;
          return {
            id, english: x.english, lemma: x.lemma, turkish: x.turkish,
            ...(x.trFull && x.trFull !== x.turkish && x.trFull.length < 400 ? { trFull: x.trFull } : {}),
            partOfSpeech: x.pos || '', ipa: x.ipa || '', okunus: x.okunus || '',
            ...(x.hyphenation ? { hyphenation: x.hyphenation } : {}),
            sourceType: 'word_list', listName: x.listName, listNo: x.no, ...(x.alsoIn ? { alsoIn: x.alsoIn } : {}),
            queued: !active, queueOrder: i,
            isDifficult: false,
            srs: { ...createSRS(id), nextReviewAt: active ? today : '9999-12-31' },
            createdAt: now, updatedAt: now,
          };
        });
        // Bankadaki aynı kelimenin eksik alanlarını listeden tamamla (ör. okunuş, IPA)
        const fills = [];
        files.forEach(f => f.entries.forEach(x => {
          const c = existing.get(x.english.toLowerCase()) || existing.get(x.lemma);
          if (!c) return;
          const patch = {};
          if (isMissingMeaning(c) && x.turkish) patch.turkish = x.turkish;
          if (!c.ipa && x.ipa) patch.ipa = x.ipa;
          if (!c.okunus && x.okunus) patch.okunus = x.okunus;
          if (!c.partOfSpeech && x.pos) patch.partOfSpeech = x.pos;
          if (Object.keys(patch).length && !fills.some(y => y.id === c.id)) fills.push({ ...c, ...patch, updatedAt: now });
        }));
        onImport(newCards, fills, perDay);
      };

      const total = files.reduce((a, f) => a + f.entries.length, 0);
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">📥 Kelime Listesi İçe Aktar (PDF)</h3>
                <p className="text-xs text-slate-400 mt-0.5">"No · Kelime · Anlam" tablolu listeler: 5000 kelime defteri, özel sözlük modülü, 1000 temel kelime gibi.</p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <label className={"block p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-center cursor-pointer " + (busy ? 'opacity-60 pointer-events-none' : '')}>
              <input type="file" accept=".pdf" multiple onChange={pick} className="hidden" />
              <span className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white">📁 PDF seç (birden fazla seçilebilir)</span>
              <p className="text-[11px] text-slate-500 mt-2">Dosyalar yalnızca bu cihazda okunur; kelimeler kendi kelime bankanıza (ve giriş yaptıysanız kendi bulut alanınıza) eklenir.</p>
            </label>
            {busy && <p className="text-xs text-blue-300">{busy}</p>}

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input value={f.listName} onChange={e => setFiles(prev => prev.map((x, j) => j === i ? { ...x, listName: e.target.value } : x))} aria-label="Liste adı" className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white" />
                      <span className={"text-xs font-bold " + (f.error ? 'text-red-400' : 'text-emerald-400')}>{f.error ? '✕' : f.entries.length + ' kelime'}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} aria-label="Listeyi kaldır" className="text-slate-500 hover:text-red-400 text-xs">🗑</button>
                    </div>
                    {f.error && <p className="text-[11px] text-red-300">{f.error}</p>}
                    {!f.error && (
                      <div className="grid gap-0.5 text-[11px]">
                        {f.entries.slice(0, 4).map((x, k) => (
                          <p key={k} className="text-slate-400 truncate"><b className="text-white">{x.english}</b>{x.okunus ? <span className="text-amber-300"> [{x.okunus}]</span> : null}{x.pos ? <span className="text-slate-500"> ({x.pos})</span> : null} → <span className="text-blue-300">{x.turkish}</span></p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <p><b className="text-white">{plan.length}</b> yeni kelime eklenecek{dupBank ? <span className="text-slate-500"> · {dupBank} tanesi zaten bankanızda (eksik okunuş/anlam varsa tamamlanır)</span> : null}{dupList ? <span className="text-slate-500"> · {dupList} tanesi listelerde tekrar ediyor</span> : null}</p>
                  <label className="flex items-center gap-2">Hemen tekrara başlansın:
                    <input type="number" min="0" max={plan.length} value={startNow} onChange={e => setStartNow(clampN(+e.target.value || 0, 0, plan.length))} className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white" /> kelime
                  </label>
                  <label className="flex items-center gap-2">Kalanlar sırada beklesin; her gün
                    <input type="number" min="0" max="200" value={perDay} onChange={e => setPerDay(clampN(+e.target.value || 0, 0, 200))} className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white" /> yeni kelime tekrara eklensin
                  </label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} className="accent-blue-500" /> Liste sırası yerine karışık sırayla</label>
                  <p className="text-[11px] text-slate-500">Sıradaki kelimeleri Kelime Kartları → "📚 Sırada bekleyen" filtresinden görebilir; bildiklerinizi "✓ Biliyorum" ile atlayabilir, istediklerinizi "▶ Öğrenmeye başla" ile hemen ekleyebilirsiniz.{plan.length > 2000 ? ' Google ile girişliyseniz bu kadar kelimenin buluta eşitlenmesi birkaç dakika sürebilir.' : ''}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button type="button" disabled={!plan.length || !!busy} onClick={doImport} className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white hover:bg-blue-500 disabled:opacity-50">
                {plan.length ? plan.length + ' kelimeyi ekle' : total ? 'Eklenecek yeni kelime yok' : 'PDF bekleniyor'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Kelime Kartları bölümü: çevrilebilir kartlar, Tureng bağlantısı ve kart üzerinde anlam düzenleme
    function FlashcardsSection({ cards, readings, recentIds, onUpdate, onUpdateMany, onDelete, onAudio, onImportList, onShareList, onOpenLibrary, onFrequent }) {
      const [query, setQuery] = useState('');
      const [autoFill, setAutoFill] = useState(null);     // { done, total } otomatik anlam bulma sürerken
      const [refreshingId, setRefreshingId] = useState(null);

      // Karta Türkçe anlamı otomatik getir (Wiktionary → MyMemory)
      const lookupMeaning = async (c) => {
        const r = await fetchTurkishAuto(c.lemma || c.english, c.partOfSpeech);
        return r.meanings.length
          ? { ...c, turkish: r.meanings.join(', '), trSenses: r.senses || [], trSource: r.source, updatedAt: new Date().toISOString() }
          : null;
      };
      const fillMissing = async () => {
        const targets = cards.filter(isMissingMeaning);
        if (!targets.length) return;
        setAutoFill({ done: 0, total: targets.length, found: 0 });
        let found = 0;
        const results = await runPool(targets, 3, async (c) => {
          const u = await lookupMeaning(c);
          if (u) found++;
          return u;
        }, (d, t) => setAutoFill({ done: d, total: t, found }));
        onUpdateMany(results.filter(Boolean));
        setAutoFill({ done: targets.length, total: targets.length, found: results.filter(Boolean).length, finished: true });
        setTimeout(() => setAutoFill(null), 5000);
      };
      const refreshOne = async (c) => {
        setRefreshingId(c.id);
        try { const u = await lookupMeaning(c); if (u) onUpdate(u); } finally { setRefreshingId(null); }
      };
      const [filter, setFilter] = useState(recentIds && recentIds.length ? 'recent' : 'all');
      const [qTypeFilter, setQTypeFilter] = useState('all');
      const [flipped, setFlipped] = useState(() => new Set());
      const [order, setOrder] = useState(null);           // karıştırılmış sıra (id listesi) ya da null
      const [editingId, setEditingId] = useState(null);
      const [editValue, setEditValue] = useState('');

      useEffect(() => { if (recentIds && recentIds.length) setFilter('recent'); }, [recentIds]);

      const recentSet = new Set(recentIds || []);
      const readingTitles = [...new Set(cards.map(c => c.readingTitle).filter(Boolean))];
      const listNames = [...new Set(cards.map(c => c.listName).filter(Boolean))];
      const queuedCount = cards.filter(c => c.queued).length;
      // Binlerce kart olabilir: 60'ar 60'ar göster
      const [shown, setShown] = useState(60);
      useEffect(() => { setShown(60); }, [filter, qTypeFilter, query]);
      const q = query.trim().toLowerCase();
      let list = cards.filter(c => {
        if (filter === 'recent' && !recentSet.has(c.id)) return false;
        if (filter === 'queued' && !c.queued) return false;
        if (filter.startsWith('l:') && c.listName !== filter.slice(2)) return false;
        if (filter === 'missing' && !isMissingMeaning(c)) return false;
        if (filter.startsWith('r:') && c.readingTitle !== filter.slice(2)) return false;
        if (qTypeFilter !== 'all' && !cardMatchesQType(c, qTypeFilter)) return false;
        if (q && !(c.english.toLowerCase().includes(q) || (c.turkish || '').toLowerCase().includes(q))) return false;
        return true;
      });
      if (order) {
        const pos = new Map(order.map((id, i) => [id, i]));
        list = [...list].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e9) - (pos.has(b.id) ? pos.get(b.id) : 1e9));
      }

      const toggle = (id) => setFlipped(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
      const allFlipped = list.length > 0 && list.every(c => flipped.has(c.id));
      const shuffle = () => {
        const ids = cards.map(c => c.id);
        for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
        setOrder(ids); setFlipped(new Set());
      };
      const startEdit = (c) => { setEditingId(c.id); setEditValue(isMissingMeaning(c) ? '' : c.turkish); };
      const saveEdit = (c) => {
        const v = editValue.trim();
        if (v) onUpdate({ ...c, turkish: v, updatedAt: new Date().toISOString() });
        setEditingId(null);
      };

      const missingCount = cards.filter(isMissingMeaning).length;

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-lg text-white mr-auto">Kelime Kartları ({list.length}{list.length !== cards.length ? ' / ' + cards.length : ''})</h3>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Kelime ara…"
              aria-label="Kelime ara"
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white w-40"
            />
            <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Kartları filtrele" className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white">
              <option value="all">Tüm kartlar</option>
              {recentIds && recentIds.length > 0 && <option value="recent">Son eklenenler ({recentIds.length})</option>}
              <option value="missing">Anlamı eksik olanlar ({missingCount})</option>
              {queuedCount > 0 && <option value="queued">📚 Sırada bekleyen liste kelimeleri ({queuedCount})</option>}
              {listNames.map(n => <option key={n} value={'l:' + n}>Liste: {n}</option>)}
              {readingTitles.map(t => <option key={t} value={'r:' + t}>Metin: {t}</option>)}
            </select>
            <select value={qTypeFilter} onChange={e => setQTypeFilter(e.target.value)} aria-label="Soru tipine göre filtrele" className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-indigo-300">
              <option value="all">Tüm Soru Tipleri</option>
              <option value="exam">🎯 Çıkmış sınav kelimeleri ({cards.filter(c => c.examInfo && c.examInfo.verified).length})</option>
              {QTYPE_FILTERS.map(t => <option key={t} value={t}>{t} · {cards.filter(c => cardMatchesQType(c, t)).length}</option>)}
              <option value="genel">Genel Akademik</option>
            </select>
            {onImportList && <button onClick={onImportList} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-xs font-bold text-white">📥 Liste içe aktar (PDF)</button>}
            {onOpenLibrary && <button onClick={onOpenLibrary} className="px-3 py-1.5 rounded-lg bg-sky-700 text-xs font-bold text-white">🌐 Paylaşılan listeler</button>}
            {onFrequent && <button onClick={onFrequent} className="px-3 py-1.5 rounded-lg bg-violet-800 text-xs font-bold text-white">📊 Sınavlarda sık geçenler</button>}
            {onShareList && filter.startsWith('l:') && <button onClick={() => onShareList(filter.slice(2))} className="px-3 py-1.5 rounded-lg bg-sky-900 border border-sky-700 text-xs font-bold text-sky-200">🌐 Bu listeyi paylaş</button>}
            {onAudio && <button onClick={onAudio} disabled={!cards.length} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white disabled:opacity-40">🎧 Dinleyerek çalış</button>}
            <button onClick={shuffle} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">🔀 Karıştır</button>
            <button
              onClick={() => setFlipped(allFlipped ? new Set() : new Set(list.map(c => c.id)))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
            >
              {allFlipped ? 'Ön yüzleri göster' : 'Tümünü çevir'}
            </button>
          </div>

          {(missingCount > 0 || autoFill) && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/50">
              {autoFill ? (
                <p className="text-xs text-amber-200">
                  {autoFill.finished
                    ? '✓ ' + autoFill.found + ' kartın anlamı otomatik bulundu' + (autoFill.total - autoFill.found ? ', ' + (autoFill.total - autoFill.found) + ' kelime için kaynak bulunamadı.' : '.')
                    : 'Anlamlar aranıyor… ' + autoFill.done + '/' + autoFill.total}
                </p>
              ) : (
                <>
                  <p className="text-xs text-amber-200">{missingCount} kartın Türkçe anlamı eksik.</p>
                  <button onClick={fillMissing} className="px-3 py-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white hover:bg-amber-500">
                    ✨ Eksik anlamları otomatik bul
                  </button>
                </>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Karta tıklayınca çevrilir. Türkçe anlamlar otomatik gelir (Wiktionary, CC BY-SA). <span className="font-bold text-slate-300">↻</span> ile kartın anlamını yeniden getirebilir, <span className="text-red-300 font-bold">Tureng ↗</span> ile karşılaştırabilirsiniz.
          </p>

          {!cards.length ? (
            <div className="text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
              Henüz kart yok. Bir okuma metnini açıp <b>✨ Kelimeleri Çıkar</b> ile kelime ekleyin.
            </div>
          ) : !list.length ? (
            <div className="text-center py-10 text-xs text-slate-400">Bu filtreye uyan kart yok.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.slice(0, shown).map(c => {
                const back = flipped.has(c.id);
                const missing = isMissingMeaning(c);
                return (
                  <div key={c.id} className={"rounded-2xl border flex flex-col overflow-hidden " + (recentSet.has(c.id) ? "border-blue-600/50" : "border-slate-800") + (missing ? " ring-1 ring-amber-600/40" : "")}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={back}
                      aria-label={c.english + (back ? ' kartının ön yüzünü göster' : ' kartını çevir')}
                      className={"min-h-[11rem] p-4 text-left flex flex-col transition-colors " + (back ? "bg-slate-900" : "bg-slate-950 hover:bg-slate-900/60")}
                    >
                      {!back ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300">{c.partOfSpeech}</span>
                            {c.questionType && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/60 text-indigo-300">
                                {c.questionType.split(' ')[0]}
                              </span>
                            )}
                            {c.examInfo && c.examInfo.verified && (
                              <span title={'Çıkmış sınavda geçti: ' + (c.examInfo.title || '')} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300">
                                🎯 Çıkmış {c.examInfo.year || ''}
                              </span>
                            )}
                          </div>
                          <span className="text-2xl font-black text-white mt-1">{c.english}</span>
                          {c.ipa && <span className="text-[11px] font-mono text-slate-400">/{c.ipa}/</span>}
                          {c.okunus && <span className="text-xs text-amber-300">[{c.okunus}]</span>}
                          <span className="text-[10px] text-slate-600 mt-2">çevirmek için tıklayın</span>
                        </div>
                      ) : (
                        <div className="flex-1 space-y-1.5">
                          <p className={"text-lg font-black " + (missing ? "text-amber-400" : "text-blue-300")}>{missing ? 'Anlam eksik — "Eksik anlamları otomatik bul" düğmesini kullanın' : c.turkish}</p>
                          {(c.trSenses || []).length > 1 && (
                            <div className="space-y-0.5">
                              {c.trSenses.slice(0, 3).map((s, i) => (
                                <p key={i} className="text-[10px] text-slate-400">
                                  {s.pos && <span className="text-slate-500">({s.pos}) </span>}
                                  {s.sense && <span className="italic">{s.sense}: </span>}
                                  <span className="text-blue-200">{s.words.join(', ')}</span>
                                </p>
                              ))}
                            </div>
                          )}
                          {c.definition && <p className="text-[11px] text-slate-400"><span className="text-slate-500">EN:</span> {c.definition}</p>}
                          {c.originalSentence && <p className="text-[11px] text-slate-300 font-serif italic line-clamp-3">“{c.originalSentence}”</p>}
                          {(c.examples || [])[0] && <p className="text-[11px] text-slate-400 font-serif line-clamp-2">• {c.examples[0]}</p>}
                          {(c.synonyms || []).length > 0 && <p className="text-[11px]"><span className="text-slate-500">Eş:</span> <span className="text-emerald-300">{c.synonyms.slice(0, 4).join(', ')}</span></p>}
                          {(c.antonyms || []).length > 0 && <p className="text-[11px]"><span className="text-slate-500">Zıt:</span> <span className="text-red-300">{c.antonyms.slice(0, 3).join(', ')}</span></p>}
                        </div>
                      )}
                    </button>

                    {editingId === c.id ? (
                      <form onSubmit={e => { e.preventDefault(); saveEdit(c); }} className="flex items-center gap-1.5 p-2 bg-slate-900 border-t border-slate-800">
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          placeholder="Türkçe anlamı yapıştırın/yazın"
                          aria-label={c.english + ' Türkçe anlamı'}
                          className="flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs text-white"
                        />
                        <button type="submit" className="px-2.5 py-1 rounded-md bg-blue-600 text-[11px] font-bold text-white">Kaydet</button>
                        <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 rounded-md bg-slate-800 text-[11px] text-slate-300">İptal</button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/70 border-t border-slate-800">
                        <button onClick={() => playWord(c)} aria-label={c.english + ' telaffuzunu dinle'} className="px-2 py-1 rounded-md text-xs text-blue-400 hover:bg-slate-800">🔊</button>
                        <TurengLink word={c.lemma || c.english} />
                        <button
                          onClick={() => refreshOne(c)}
                          disabled={refreshingId === c.id}
                          title="Türkçe anlamı otomatik yeniden getir"
                          aria-label={c.english + ' anlamını otomatik yeniden getir'}
                          className={"px-2 py-1 rounded-md text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50 " + (refreshingId === c.id ? 'animate-spin' : '')}
                        >↻</button>
                        {c.trSource && <span className="text-[9px] text-slate-600">{c.trSource}</span>}
                        <button onClick={() => startEdit(c)} className={"ml-auto px-2 py-1 rounded-md text-[11px] font-bold " + (missing ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800")}>
                          ✎ Anlam{missing ? ' ekle' : ''}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('"' + c.english + '" kartı silinsin mi? Kelime, Kelime Bankası ve Günlük Tekrar\'dan da kaldırılır. Bu işlem geri alınamaz.')) onDelete(c.id);
                          }}
                          title="Kartı sil"
                          aria-label={c.english + ' kartını sil'}
                          className="px-2 py-1 rounded-md text-[11px] font-bold text-red-400 hover:bg-red-600 hover:text-white transition"
                        >
                          🗑 Sil
                        </button>
                        {c.queued && onUpdate && (
                          <div className="w-full flex gap-1.5 pt-1">
                            <button onClick={() => onUpdate({ ...c, queued: false, srs: { ...c.srs, nextReviewAt: getTodayStr() }, updatedAt: new Date().toISOString() })} className="flex-1 px-2 py-1 rounded-md bg-blue-700 text-[11px] font-bold text-white">▶ Öğrenmeye başla</button>
                            <button onClick={() => onUpdate({ ...c, queued: false, srs: { ...c.srs, state: 'review', interval: 60, repetitions: 1, lastReviewedAt: getTodayStr(), nextReviewAt: addDays(getTodayStr(), 60) }, knownAtImport: true, updatedAt: new Date().toISOString() })} title="Biliyorum: 60 gün sonra bir kez sorulur" className="flex-1 px-2 py-1 rounded-md bg-emerald-800 text-[11px] font-bold text-white">✓ Biliyorum</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {list.length > shown && (
            <button onClick={() => setShown(shown + 60)} className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800">
              Daha fazla göster ({shown} / {list.length})
            </button>
          )}
        </div>
      );
    }

    // Okuma metninden kelimeleri otomatik çıkarır, anlam/okunuş/örnek/eş-zıt anlamları getirir ve bankaya ekler
    function AutoVocabModal({ reading, cards, onClose, onAdd }) {
      const [level, setLevel] = useState('120');   // en yüksek sıklık (milyonda); düşük = daha zor kelimeler
      const [limit, setLimit] = useState(30);
      const [phase, setPhase] = useState('idle');  // idle | scanning | details | done | error
      const [progress, setProgress] = useState({ done: 0, total: 0 });
      const [items, setItems] = useState([]);
      const [errorMsg, setErrorMsg] = useState('');
      const [quotaHit, setQuotaHit] = useState(false);
      const runId = useRef(0);

      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\s-]/g, '').trim();
      const existing = new Map(cards.map(c => [norm(c.lemma || c.english), c]));

      const start = async () => {
        const my = ++runId.current;
        setPhase('scanning'); setItems([]); setErrorMsg(''); setQuotaHit(false);
        setProgress({ done: 0, total: 0 });
        try {
          const cands = await extractCandidates(reading.content, {
            maxFreq: parseFloat(level),
            onProgress: (d, t) => { if (runId.current === my) setProgress({ done: d, total: t }); },
          });
          if (runId.current !== my) return;
          if (!cands.length) { setPhase('done'); return; }
          // Bankada olmayanlar önce; aralarında daha az yaygın (daha "akademik") olanlar önce
          // Akademik kelimeler (AWL) önce, sonra daha az yaygın olanlar
          cands.sort((a, b) => (existing.has(a.lemma) - existing.has(b.lemma)) || ((awlSublist(a.lemma) ? 0 : 1) - (awlSublist(b.lemma) ? 0 : 1)) || (a.freq - b.freq));
          const chosen = cands.slice(0, limit);
          setItems(chosen.map(c => ({ ...c, checked: !existing.has(c.lemma), loading: true })));
          setPhase('details');
          setProgress({ done: 0, total: chosen.length });
          await runPool(chosen, 3, async (c) => {
            const d = await fetchWordDetails(c.lemma, c.pos);
            if (runId.current !== my) return;
            if (d.trQuota) setQuotaHit(true);
            setItems(prev => prev.map(x => x.lemma === c.lemma ? { ...x, ...d, loading: false } : x));
          }, (d, t) => { if (runId.current === my) setProgress({ done: d, total: t }); });
          if (runId.current !== my) return;
          setItems(prev => prev.map(x => x.loading ? { ...x, loading: false, failed: true } : x));
          setPhase('done');
        } catch (e) {
          if (runId.current !== my) return;
          setErrorMsg('Kelimeler alınamadı: ' + (e && e.message ? e.message : 'bağlantı hatası') + '. İnternet bağlantınızı kontrol edip tekrar deneyin.');
          setPhase('error');
        }
      };

      // Pencere açılınca otomatik başlat
      useEffect(() => { start(); return () => { runId.current++; }; }, []);

      const update = (lemma, patch) => setItems(prev => prev.map(x => x.lemma === lemma ? { ...x, ...patch } : x));
      const selected = items.filter(x => x.checked && !x.loading);
      const allChecked = items.length > 0 && items.every(x => x.checked);

      const handleAdd = () => {
        const now = new Date().toISOString();
        const newCards = [], updated = [];
        selected.forEach((x, i) => {
          const source = { readingId: reading.id, readingTitle: reading.title, weekId: reading.weekId, sentence: x.sentence, dateAdded: now };
          const fields = {
            turkish: (x.turkish || '').trim(),
            trSenses: x.trSenses || [],
            trSource: x.trSource || '',
            ipa: x.ipa || '',
            okunus: x.okunus || '',
            audioUrl: x.audioUrl || '',
            definition: x.definition || '',
            examples: x.examples || [],
            synonyms: x.synonyms || [],
            antonyms: x.antonyms || [],
          };
          const dup = existing.get(x.lemma);
          if (dup) {
            // Mevcut karta: yeni kaynak cümle + eksik alanları tamamla
            const filled = {};
            Object.keys(fields).forEach(k => {
              const cur = dup[k];
              if (cur == null || cur === '' || (Array.isArray(cur) && !cur.length)) filled[k] = fields[k];
            });
            const sources = (dup.sources || []).filter(s => !(s.readingId === reading.id && s.sentence === x.sentence)).concat([source]);
            updated.push({ ...dup, ...filled, sources, updatedAt: now });
          } else {
            const id = 'card_' + Date.now() + '_' + i;
            newCards.push({
              id,
              english: x.lemma,
              lemma: x.lemma,
              ...fields,
              turkish: fields.turkish || '(anlam bulunamadı – düzenleyin)',
              partOfSpeech: x.partOfSpeech || x.pos || 'noun',
              originalSentence: x.sentence,
              readingId: reading.id,
              readingTitle: reading.title,
              weekId: reading.weekId,
              sources: [source],
              sourceType: 'user_reading',
              isDifficult: false,
              srs: createSRS(id),
              createdAt: now,
              updatedAt: now,
            });
          }
        });
        onAdd(newCards, updated);
      };

      const chip = (t, cls) => <span key={t} className={"inline-block px-2 py-0.5 rounded-full text-[10px] mr-1 mb-1 " + cls}>{t}</span>;
      const highlight = (sentence, forms) => {
        if (!sentence) return null;
        const re = new RegExp('\\b(' + forms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
        return sentence.split(re).map((part, i) => i % 2 ? <mark key={i} className="bg-blue-500/30 text-white rounded px-0.5">{part}</mark> : part);
      };
      const busy = phase === 'scanning' || phase === 'details';

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-white">✨ Metinden Kelime Çıkar</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{reading.title}</p>
                </div>
                <button onClick={onClose} aria-label="Kapat" className="px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-800">✕</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="text-slate-400">Seviye</label>
                <select value={level} onChange={e => setLevel(e.target.value)} disabled={busy} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                  <option value="400">Tümü (yaygın kelimeler dahil)</option>
                  <option value="120">Orta ve üstü (önerilen)</option>
                  <option value="30">İleri</option>
                </select>
                <label className="text-slate-400 ml-2">En fazla</label>
                <select value={limit} onChange={e => setLimit(+e.target.value)} disabled={busy} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                  {[15, 30, 50, 80].map(n => <option key={n} value={n}>{n} kelime</option>)}
                </select>
                <button onClick={start} disabled={busy} className="ml-auto px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold disabled:opacity-50">↻ Yeniden çıkar</button>
              </div>
              {busy && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded bg-slate-800 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: (progress.total ? Math.round(progress.done / progress.total * 100) : 5) + '%' }} />
                  </div>
                  <p className="text-[11px] text-blue-300">
                    {phase === 'scanning' ? 'Metindeki kelimeler taranıyor' : 'Anlamlar, okunuşlar ve örnekler getiriliyor'} · {progress.done}/{progress.total || '…'}
                  </p>
                </div>
              )}
              {quotaHit && <p className="text-[11px] text-amber-400">Çeviri servisinin günlük ücretsiz kotası doldu; bazı Türkçe anlamlar boş kaldı. Elle yazabilir veya yarın tekrar deneyebilirsiniz.</p>}
              {errorMsg && <p className="text-[11px] text-red-400">{errorMsg}</p>}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {phase === 'done' && !items.length && (
                <p className="text-center text-xs text-slate-400 py-10">Bu seviyede öğrenilecek kelime bulunamadı. Seviyeyi "Tümü" yapıp tekrar deneyin.</p>
              )}
              {items.length > 0 && (
                <label className="flex items-center gap-2 text-[11px] text-slate-400 px-1 pb-1 cursor-pointer select-none">
                  <input type="checkbox" checked={allChecked} onChange={e => setItems(prev => prev.map(x => ({ ...x, checked: e.target.checked })))} className="accent-blue-500" />
                  Tümünü seç ({items.length} kelime bulundu)
                </label>
              )}
              {items.map(x => {
                const lvl = freqLevel(x.freq);
                const inBank = existing.has(x.lemma);
                return (
                  <div key={x.lemma} className={"rounded-xl border p-3 transition " + (x.checked ? "border-blue-600/60 bg-slate-950" : "border-slate-800 bg-slate-950/50 opacity-70")}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={x.checked} onChange={e => update(x.lemma, { checked: e.target.checked })} aria-label={x.lemma + ' kelimesini seç'} className="mt-1 accent-blue-500" />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-white text-base">{x.lemma}</span>
                          <button type="button" onClick={() => playWord({ english: x.lemma, audioUrl: x.audioUrl })} aria-label={x.lemma + ' telaffuzunu dinle'} className="text-xs text-blue-400 hover:text-blue-300">🔊</button>
                          {x.ipa && <span className="text-[11px] font-mono text-slate-400">/{x.ipa}/</span>}
                          {x.okunus && <span className="text-[11px] text-amber-300" title="Türkçe harflerle okunuş (büyük harfli hece vurgulu)">[{x.okunus}]</span>}
                          {x.partOfSpeech && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{x.partOfSpeech}</span>}
                          <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded " + lvl.cls}>{lvl.label}</span>
                          <AwlBadge word={x.lemma} />
                          <span className="text-[10px] text-slate-500">metinde {x.count}×</span>
                          {inBank && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300">Bankada var</span>}
                        </div>
                        {x.loading ? (
                          <p className="text-[11px] text-slate-500">Bilgiler getiriliyor…</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={x.turkish || ''}
                                onChange={e => update(x.lemma, { turkish: e.target.value })}
                                placeholder="Türkçe anlamı (bulunamadı, yazabilirsiniz)"
                                className="flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-300"
                              />
                              <TurengLink word={x.lemma} />
                            </div>
                            {x.trSource && <p className="text-[10px] text-slate-500 -mt-0.5">Türkçe anlam kaynağı: {x.trSource}</p>}
                            {x.definition && <p className="text-[11px] text-slate-400"><span className="text-slate-500">EN:</span> {x.definition}</p>}
                            {x.sentence && <p className="text-[11px] text-slate-300 font-serif italic">“{highlight(x.sentence, x.forms)}”</p>}
                            {(x.examples || []).map((ex, i) => <p key={i} className="text-[11px] text-slate-400 font-serif">• {ex}</p>)}
                            {(x.synonyms || []).length > 0 && <div className="text-[11px]"><span className="text-slate-500 mr-1">Eş anlamlı:</span>{x.synonyms.map(s => chip(s, 'bg-emerald-950 text-emerald-300'))}</div>}
                            {(x.antonyms || []).length > 0 && <div className="text-[11px]"><span className="text-slate-500 mr-1">Zıt anlamlı:</span>{x.antonyms.map(s => chip(s, 'bg-red-950 text-red-300'))}</div>}
                            {x.failed && <p className="text-[11px] text-amber-400">Bilgiler alınamadı; yine de ekleyip sonra düzenleyebilirsiniz.</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <p className="text-[10px] text-slate-500">Türkçe anlamlar: Wiktionary (CC BY-SA), yoksa MyMemory · Okunuş/örnek: dictionaryapi.dev, Datamuse</p>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">Kapat</button>
                <button onClick={handleAdd} disabled={!selected.length} className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white disabled:opacity-50">
                  {selected.length ? selected.length + ' Kelimeyi Bankaya Ekle' : 'Kelime seçin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    function VocabAddModal({ initialWord, initialSentence, onClose, onSave }) {
      const [english, setEnglish] = useState(initialWord);
      const [turkish, setTurkish] = useState('');
      const [pos, setPos] = useState('noun');
      const [sentence, setSentence] = useState(initialSentence);
      const [qType, setQType] = useState('Kelime Soruları (1-6)');
      const [synonymsInput, setSynonymsInput] = useState('');
      const [antonymsInput, setAntonymsInput] = useState('');

      // --- Otomatik anlam: kelime yazılınca Türkçe anlam, tür, okunuş, örnek, eş/zıt anlamlılar kendiliğinden gelir ---
      const [info, setInfo] = useState(null);             // { lemma, ipa, okunus, audioUrl, definition, examples, synonyms, antonyms, trSenses, trSource }
      const [lookup, setLookup] = useState('idle');       // idle | loading | found | notfound | error
      const turkishTouched = useRef(false);               // kullanıcı anlamı kendisi değiştirdiyse üzerine yazma
      const posTouched = useRef(false);
      const reqId = useRef(0);

      const [roots, setRoots] = useState([]);              // türetme eki kök önerileri (substantially → substantial)
      const runLookup = async (text, wantPos) => {
        const my = ++reqId.current;
        const raw = text.trim().toLowerCase();
        setRoots([]);
        if (raw.length < 2) { setLookup('idle'); setInfo(null); return; }
        setLookup('loading');
        findDerivationalRoots(raw).then(rs => { if (my === reqId.current) setRoots(rs); }).catch(() => {});
        try {
          let lemma = raw, guessPos = wantPos;
          if (/^[a-z][a-z'’-]*$/.test(raw)) {
            const r = await resolveLemma(raw).catch(() => null);
            if (r) {
              lemma = r.word;
              if (!wantPos) guessPos = posFor(lemma, [raw], r.info.tags);
            }
          }
          const usePos = wantPos || guessPos || 'noun';
          const d = await fetchWordDetails(lemma, usePos);
          if (my !== reqId.current) return;                // daha yeni bir arama başladı
          setInfo({ ...d, lemma });
          if (!posTouched.current && ['noun', 'verb', 'adjective', 'adverb'].includes(d.partOfSpeech || usePos)) setPos(d.partOfSpeech || usePos);
          if (!turkishTouched.current) setTurkish(d.turkish || '');
          if (!synonymsInput && d.synonyms && d.synonyms.length) setSynonymsInput(d.synonyms.slice(0, 5).join(', '));
          if (!antonymsInput && d.antonyms && d.antonyms.length) setAntonymsInput(d.antonyms.slice(0, 4).join(', '));
          setLookup(d.turkish ? 'found' : 'notfound');
        } catch (e) {
          if (my !== reqId.current) return;
          setLookup('error');
        }
      };

      // Yazmayı bırakınca (0,6 sn) otomatik ara
      useEffect(() => {
        const t = setTimeout(() => runLookup(english, posTouched.current ? pos : null), 600);
        return () => clearTimeout(t);
      }, [english]);

      const onPosChange = (v) => {
        posTouched.current = true;
        setPos(v);
        if (v === 'prepositional_phrase') setQType('Gramer & Edat (7-16)');
        if (['noun', 'verb', 'adjective', 'adverb'].includes(v) && english.trim()) runLookup(english, v);   // türe uygun anlamı yeniden getir
      };

      const handleSave = (e) => {
        e.preventDefault();
        if (!english.trim()) return;
        const newId = 'card_' + Date.now();
        const now = new Date().toISOString();
        // Tek kelimede kök hâli kaydedilir ("defects" → "defect"); ifadeler yazıldığı gibi kalır
        const typed = english.trim();
        const isSingle = /^[A-Za-z][A-Za-z'’-]*$/.test(typed);
        const synList = synonymsInput ? synonymsInput.split(',').map(s => s.trim()).filter(Boolean) : (info && info.synonyms || []);
        const antList = antonymsInput ? antonymsInput.split(',').map(s => s.trim()).filter(Boolean) : (info && info.antonyms || []);
        onSave({
          id: newId,
          english: isSingle && info && info.lemma ? info.lemma : typed,
          lemma: info && info.lemma || typed.toLowerCase(),
          turkish: turkish.trim() || '(anlam bulunamadı – düzenleyin)',
          trSenses: info && info.trSenses || [],
          trSource: turkishTouched.current ? 'Elle' : (info && info.trSource || ''),
          ipa: info && info.ipa || '',
          okunus: info && info.okunus || '',
          audioUrl: info && info.audioUrl || '',
          definition: info && info.definition || '',
          examples: info && info.examples || [],
          synonyms: synList,
          antonyms: antList,
          questionType: qType,
          partOfSpeech: pos,
          originalSentence: sentence.trim(),
          sourceType: 'user_reading',
          isDifficult: false,
          srs: createSRS(newId),
          createdAt: now,
          updatedAt: now,
        });
      };

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-3 max-h-[92vh] overflow-y-auto">
            <h3 className="font-bold text-base text-white">Kelime Kartı Ekle</h3>
            <input
              type="text"
              autoFocus={!initialWord}
              placeholder="İngilizce kelime/ifade (anlamı otomatik gelir)"
              aria-label="İngilizce kelime veya ifade"
              value={english}
              onChange={e => setEnglish(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={lookup === 'loading' ? 'Anlam aranıyor…' : 'Türkçe anlamı (otomatik)'}
                  aria-label="Türkçe anlamı"
                  value={turkish}
                  onChange={e => { turkishTouched.current = true; setTurkish(e.target.value); }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-300"
                />
                {english.trim() && <TurengLink word={(info && info.lemma) || english} />}
              </div>
              <p role="status" className={"text-[10px] " + ({ loading: 'text-blue-300', found: 'text-emerald-400', notfound: 'text-amber-400', error: 'text-red-400' }[lookup] || 'text-slate-500')}>
                {lookup === 'loading' && 'Anlam, okunuş ve örnekler aranıyor…'}
                {lookup === 'found' && '✓ Anlam otomatik bulundu' + (info && info.trSource ? ' (' + info.trSource + ')' : '') + (info && info.lemma && info.lemma !== english.trim().toLowerCase() ? ' · kök: ' + info.lemma : '')}
                {roots.length > 0 && (
                  <span className="block mt-1 text-purple-300">
                    🌱 Türetilmiş kelime. Kök önerisi:{' '}
                    {roots.map(r => (
                      <button key={r} type="button" onClick={() => { turkishTouched.current = false; setSynonymsInput(''); setAntonymsInput(''); setEnglish(r); }}
                              className="ml-1 px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-200 hover:bg-purple-900 font-bold">{r}</button>
                    ))}
                    <span className="text-slate-500"> (tıklayınca kök kelime eklenir)</span>
                  </span>
                )}
                {lookup === 'notfound' && 'Otomatik anlam bulunamadı; yine de kaydedebilirsiniz (Kelime Kartları\'nda tekrar denenebilir).'}
                {lookup === 'error' && 'Bağlantı hatası; internetinizi kontrol edin.'}
                {lookup === 'idle' && 'Kelimeyi yazın, anlamı kendiliğinden gelecek.'}
              </p>
              {turkishTouched.current && lookup === 'found' && info && info.turkish && info.turkish !== turkish && (
                <button type="button" onClick={() => { turkishTouched.current = false; setTurkish(info.turkish); }} className="text-[10px] text-blue-400 underline">
                  Otomatik anlamı geri getir: {info.turkish}
                </button>
              )}
            </div>

            {info && (info.ipa || info.okunus || (info.synonyms || []).length || (info.trSenses || []).length > 1) && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => playWord({ english: info.lemma || english, audioUrl: info.audioUrl })} aria-label="Telaffuzu dinle" className="text-blue-400">🔊</button>
                  {info.ipa && <span className="font-mono text-slate-400">/{info.ipa}/</span>}
                  {info.okunus && <span className="text-amber-300">[{info.okunus}]</span>}
                </div>
                {(info.trSenses || []).length > 1 && info.trSenses.slice(0, 3).map((s, i) => (
                  <p key={i} className="text-slate-400">
                    {s.pos && <span className="text-slate-500">({s.pos}) </span>}{s.sense && <span className="italic">{s.sense}: </span>}
                    <button type="button" onClick={() => { turkishTouched.current = true; setTurkish(s.words.join(', ')); }} className="text-blue-200 hover:underline" title="Bu anlamı kullan">{s.words.join(', ')}</button>
                  </p>
                ))}
                {info.definition && <p className="text-slate-400"><span className="text-slate-500">EN:</span> {info.definition}</p>}
                {(info.examples || [])[0] && <p className="text-slate-400 font-serif">• {info.examples[0]}</p>}
                {(info.synonyms || []).length > 0 && <p><span className="text-slate-500">Eş:</span> <span className="text-emerald-300">{info.synonyms.slice(0, 5).join(', ')}</span></p>}
                {(info.antonyms || []).length > 0 && <p><span className="text-slate-500">Zıt:</span> <span className="text-red-300">{info.antonyms.slice(0, 4).join(', ')}</span></p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Kelime Türü</label>
                <select
                  value={pos}
                  onChange={e => onPosChange(e.target.value)}
                  aria-label="Kelime türü"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                >
                  <option value="noun">İsim (Noun)</option>
                  <option value="verb">Fiil (Verb)</option>
                  <option value="adjective">Sıfat (Adjective)</option>
                  <option value="adverb">Zarf (Adverb)</option>
                  <option value="collocation">Kalıp İfade (Collocation)</option>
                  <option value="prepositional_phrase">Edatlı Yapı</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">YÖKDİL Soru Tipi</label>
                <select
                  value={qType}
                  onChange={e => setQType(e.target.value)}
                  aria-label="YÖKDİL Soru Tipi"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                >
                  <option value="Kelime Soruları (1-6)">Kelime Soruları (1-6)</option>
                  <option value="Gramer & Edat (7-16)">Gramer & Edat (7-16)</option>
                  <option value="Cloze Test (17-26)">Cloze Test (17-26)</option>
                  <option value="Cümle Tamamlama (27-36)">Cümle Tamamlama (27-36)</option>
                  <option value="Çeviri Soruları (37-48)">Çeviri Soruları (37-48)</option>
                  <option value="Paragraf Soruları (49-80)">Paragraf Soruları (49-80)</option>
                  <option value="Genel Akademik">Genel Akademik</option>
                </select>
              </div>
            </div>

            {/* Eş ve Zıt Anlam Düzenleme */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Eş Anlamlılar (virgülle ayırın)</label>
                <input
                  type="text"
                  placeholder="e.g. lack, scarcity"
                  value={synonymsInput}
                  onChange={e => setSynonymsInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-emerald-300 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Zıt Anlamlılar (virgülle ayırın)</label>
                <input
                  type="text"
                  placeholder="e.g. abundance, surplus"
                  value={antonymsInput}
                  onChange={e => setAntonymsInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-red-300 placeholder:text-slate-600"
                />
              </div>
            </div>
            <textarea
              rows={3}
              placeholder="Metindeki orijinal cümle"
              value={sentence}
              onChange={e => setSentence(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button type="submit" disabled={!english.trim()} className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white disabled:opacity-50">Kaydet</button>
            </div>
          </form>
        </div>
      );
    }

    function UploadModal({ weeks, onClose, onSave }) {
      const [title, setTitle] = useState('');
      const [content, setContent] = useState('');
      const [weekId, setWeekId] = useState(weeks[0]?.id || '');
      const [category, setCategory] = useState('Fen Bilimleri');
      const [fileType, setFileType] = useState('manual');
      const [fileStatus, setFileStatus] = useState('');
      const [isReadingFile, setIsReadingFile] = useState(false);
      const [forceOcr, setForceOcr] = useState(false);

      // --- OCR (resimdeki yazıları okuma) ---
      // Tek bir Tesseract worker'ı açılır, dosya bitince kapatılır.
      const ocrRef = useRef(null);
      const getOcrWorker = async () => {
        if (!window.Tesseract) throw new Error('Resim okuyucu (OCR) yüklenemedi (internet bağlantısını kontrol edin).');
        if (!ocrRef.current) {
          setFileStatus('Resim okuyucu hazırlanıyor (ilk seferde biraz sürebilir)...');
          ocrRef.current = await Tesseract.createWorker('eng');
        }
        return ocrRef.current;
      };
      const closeOcrWorker = async () => {
        if (ocrRef.current) { try { await ocrRef.current.terminate(); } catch (e) {} ocrRef.current = null; }
      };
      useEffect(() => () => { closeOcrWorker(); }, []);

      const ocrImage = async (image, label) => {
        const worker = await getOcrWorker();
        setFileStatus(label + ' okunuyor (OCR)...');
        // Görüntüyü canvas'a çevir: başlık satırlarını kesip yeniden okuyabilmek için gerekli
        let canvas = image;
        if (!(image instanceof HTMLCanvasElement)) {
          try {
            const bmp = await createImageBitmap(image instanceof Blob ? image : await (await fetch(image)).blob());
            canvas = document.createElement('canvas');
            canvas.width = bmp.width; canvas.height = bmp.height;
            canvas.getContext('2d').drawImage(bmp, 0, 0);
            canvas = upscaleForOcr(canvas);
          } catch (e) { canvas = null; }
        }
        const { data } = await worker.recognize(canvas || image, {}, { text: true, blocks: true });
        if (!data || !Array.isArray(data.blocks) || !data.blocks.length) return cleanOcrText(data && data.text ? data.text : '');
        return structureOcr(data.blocks, canvas, worker);
      };

      // Bir parça metni filtreleyip temiz kelimelere çevirir
      const filterWords = (words) => words
        .filter(w => isPlausibleWord(w.text, w.confidence))
        .map(w => ({ w, t: cleanWordText(w.text) }))
        .filter(p => p.t);

      // Başlık satırını görüntüden kesip büyüterek yeniden okur (büyük/süslü yazılarda daha doğru sonuç verir)
      const reocrLine = async (canvas, bbox, worker) => {
        const pad = Math.round((bbox.y1 - bbox.y0) * 0.3);
        const x = Math.max(0, bbox.x0 - pad), y = Math.max(0, bbox.y0 - pad);
        const w = Math.min(canvas.width - x, bbox.x1 - bbox.x0 + 2 * pad);
        const h = Math.min(canvas.height - y, bbox.y1 - bbox.y0 + 2 * pad);
        const empty = { text: '', avgConf: 0, n: 0 };
        if (w < 10 || h < 10) return empty;
        const crop = document.createElement('canvas');
        crop.width = w * 2; crop.height = h * 2;
        const cctx = crop.getContext('2d');
        cctx.fillStyle = '#fff'; cctx.fillRect(0, 0, crop.width, crop.height);
        cctx.imageSmoothingQuality = 'high';
        cctx.drawImage(canvas, x, y, w, h, 0, 0, crop.width, crop.height);

        // Başlıklar çoğu zaman koyu/noktalı zemin üzerinde beyaz yazıdır. Birkaç ön işleme denenir, en güvenilir sonuç seçilir:
        // olduğu gibi · bulanıklaştır + siyah-beyaz + ters çevir (koyu zeminli başlık) · bulanıklaştır + siyah-beyaz (açık zemin)
        const variants = [
          null,
          { blur: 3, invert: true }, { blur: 4, invert: true },
          { blur: 2, invert: false },
        ];
        let best = empty;
        try {
          await worker.setParameters({ tessedit_pageseg_mode: '7' });                    // tek satır modu
          for (const v of variants) {
            const img = v ? binarize(crop, v.blur, v.invert) : crop;
            const { data } = await worker.recognize(img, {}, { text: true, blocks: true });
            const words = [];
            (data && data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => words.push(...(l.words || [])))));
            const kept = filterWords(words).filter(p => p.w.confidence >= 50);          // başlıkta yalnızca emin olunan kelimeler
            const score = kept.reduce((s, p) => s + p.w.confidence, 0);
            if (score > (best.score || 0)) {
              best = { text: kept.map(p => p.t).join(' ').trim(), avgConf: score / kept.length, n: kept.length, score };
            }
          }
        } finally {
          await worker.setParameters({ tessedit_pageseg_mode: '6' });                    // tesseract.js varsayılanı
        }
        return best;
      };

      // Gri ton + bulanıklaştırma (tram/nokta desenini yok eder) + Otsu eşiği ile siyah-beyaz; istenirse renkleri ters çevirir
      const binarize = (src, blur, invert) => {
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.filter = blur ? 'blur(' + blur + 'px)' : 'none';
        g.drawImage(src, 0, 0);
        g.filter = 'none';
        const id = g.getImageData(0, 0, c.width, c.height), d = id.data, n = d.length / 4;
        const gray = new Uint8Array(n), hist = new Array(256).fill(0);
        for (let i = 0; i < n; i++) { const v = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0; gray[i] = v; hist[v]++; }
        let sumAll = 0; for (let t = 0; t < 256; t++) sumAll += t * hist[t];
        let sB = 0, wB = 0, bestVar = 0, thr = 128;
        for (let t = 0; t < 256; t++) {
          wB += hist[t]; if (!wB) continue;
          const wF = n - wB; if (!wF) break;
          sB += t * hist[t];
          const diff = sB / wB - (sumAll - sB) / wF, v = wB * wF * diff * diff;
          if (v > bestVar) { bestVar = v; thr = t; }
        }
        for (let i = 0; i < n; i++) {
          let v = gray[i] < thr ? 0 : 255;
          if (invert) v = 255 - v;
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        return c;
      };

      // Yeni okumadaki rakamlar ilk okumayla aynı uzunluktaysa ilk okumanın rakamlarını koru
      // (tam çözünürlükteki ilk okuma rakamlarda genelde daha doğrudur: "1899 1961" ↔ "1999-1361")
      const keepOriginalDigits = (fresh, orig) => {
        const od = (orig.match(/\d/g) || []).join('');
        const fd = (fresh.match(/\d/g) || []).join('');
        if (!od || od.length !== fd.length || od === fd) return fresh;
        let k = 0;
        return fresh.replace(/\d/g, () => od[k++]);
      };

      // --- OCR çıktısını temizleme ve yapılandırma ---
      // Geçerli 2 harfli İngilizce kelimeler (geri kalan 2 harfli parçalar çoğunlukla tarama lekesidir)
      const VALID_2 = new Set('am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we ad ex id vs'.split(' '));

      // OCR'ın bulduğu bir parçanın gerçek kelime olup olmadığını tahmin eder.
      // Gerçek kelimeler bazen düşük güven puanı alabildiği için yalnızca puana değil, biçimine de bakılır.
      const isPlausibleWord = (text, conf) => {
        if (/^[^A-Za-z0-9]+$/.test(text)) return /^[&—–]$/.test(text) && conf >= 80; // ~ * | © + : gibi tek başına semboller
        if (conf >= 85) return true;
        const core = text
          .replace(/^[“”‘’"'(\[~*•+|\-]+/, '')
          .replace(/[“”‘’"')\].,;:!?|]+$/, '');
        if (!core) return false;
        if (/^\d[\d.,%\-–/]*(s|st|nd|rd|th)?$/i.test(core)) return true;            // 1950s, 20%, 1899-1961
        if (/^[A-Za-z]+\.[A-Za-z]+$/.test(core)) return core.split('.').every(p => isPlausibleWord(p, conf)); // "a.shelf" → "a shelf"
        const parts = core.split(/['’\-]/);
        if (!parts.every(p => /^[A-Za-z]+$/.test(p))) return false;
        const letters = parts.join('');
        if (letters.length === 1) return /^[aAI]$/.test(letters);
        if (/(.)\1\1/i.test(letters)) return false;                                   // "iii", "LLL"
        const isCaps = letters === letters.toUpperCase();
        if (!parts.every(p => !p || p === p.toUpperCase() || /^[A-Za-z][a-z]*$/.test(p))) return false; // "dE" gibi karışık harf
        if (isCaps && conf < 60) return false;                                        // "TE ES GTS"
        if (letters.length === 2) return VALID_2.has(letters.toLowerCase());
        return /[aeiouy]/i.test(letters);
      };

      // Kelimenin başındaki tarama artıklarını (~ * • + | -) atar
      const cleanWordText = (t) => t
        .replace(/^[~*•+|¦]+/, '').replace(/^-+(?=[A-Za-z])/, '').replace(/[|¦]+$/, '')
        .replace(/^([A-Za-z]+)\.([a-z]+)$/, '$1 $2');                                  // "a.shelf" → "a shelf"

      const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

      const structureOcr = async (blocks, canvas, worker) => {
        const lines = [];
        blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach((l, li) => {
          const pairs = filterWords(l.words || []);
          if (!pairs.length) return;
          const parts = pairs.map(p => p.t);
          const kept = pairs.map(p => p.w);
          // Satır başındaki eşi olmayan tırnak işareti genellikle lekedir
          const rest = parts.join(' ').slice(1);
          if (/^[“"]/.test(parts[0]) && !/[”"]/.test(rest)) parts[0] = parts[0].replace(/^[“"]+/, '');
          if (/^[‘']/.test(parts[0]) && !/[’'](?![A-Za-z])/.test(rest)) parts[0] = parts[0].replace(/^[‘']+/, '');
          const realWords = parts.join(' ').split(' ').filter(t => /[A-Za-z]{3,}/.test(t)).length;
          lines.push({
            lowConf: l.confidence < 40,
            realWords,
            bbox: l.bbox,
            // Yeniden okuma için sağ sınır: makul güvenli son kelime (çok düşük puanlı süs parçaları hariç)
            cx1: (kept.filter(w => w.confidence >= 25).pop() || kept[kept.length - 1]).bbox.x1,
            text: parts.join(' ').trim(),
            h: l.bbox.y1 - l.bbox.y0,
            x0: kept[0].bbox.x0,
            x1: kept[kept.length - 1].bbox.x1,
            n: parts.length,
            paraStart: li === 0,
          });
        })));
        if (!lines.length) return '';

        const medH0 = median(lines.filter(l => l.n >= 5).map(l => l.h)) || median(lines.map(l => l.h));
        // Düşük güvenli satırlardan yalnızca yeterince gerçek kelime içerenleri tut; büyük yazılı (başlık) satırlarda 1 kelime yeter
        for (let i = lines.length - 1; i >= 0; i--) {
          const l = lines[i];
          if (l.lowConf && l.realWords < 3 && !(l.h >= medH0 * 1.15 && l.realWords >= 1)) lines.splice(i, 1);
        }
        if (!lines.length) return '';

        const body = lines.filter(l => l.n >= 5);
        const ref = body.length ? body : lines;
        const medH = median(ref.map(l => l.h));
        const left = median(ref.map(l => l.x0));
        const right = median(ref.map(l => l.x1));
        const width = Math.max(1, right - left);

        // Başlık: gövde satırlarından belirgin büyük, kısa, satırı doldurmayan ve noktalama ile bitmeyen satır
        const isHeading = (l) =>
          l.n <= 12 && /[A-Za-z]{3,}/.test(l.text) && !/[.,;:!?]$/.test(l.text) &&
          l.h >= medH * 1.15 && l.x1 < left + width * 0.85;

        const out = [];
        let para = '';
        let prev = null;
        const flush = () => {
          const p = para.trim().replace(/([.!?”"])\s+[A-Za-z0-9]$/, '$1');               // paragraf sonundaki tek harf lekesi
          if (p) out.push(p);
          para = '';
        };
        const countWords = (t) => t.split(/\s+/).filter(x => /[A-Za-z]{2,}/.test(x)).length;
        for (let l of lines) {
          if (isHeading(l)) {
            flush();
            if (canvas && worker) {
              try {
                // Yeni okuma yalnızca güvenilirse kullanılır: yüksek ortalama güven, çoğu parça gerçek kelime,
                // ve eskisinden çok daha fazla kelime değil (süs grafikleri çöp üretmesin)
                // Yalnızca ilk ve son gerçek kelime arasını kes (yandaki süs grafiklerini dışarıda bırak)
                const again = await reocrLine(canvas, { x0: l.x0, x1: l.cx1, y0: l.bbox.y0, y1: l.bbox.y1 }, worker);
                const before = countWords(l.text);
                if (again.text && again.avgConf >= 60 &&
                    countWords(again.text) >= Math.max(1, before - 1) && countWords(again.text) <= before + 4) {
                  l = { ...l, text: keepOriginalDigits(again.text, l.text.replace(/(\s+[^\sA-Za-z]{1,2}|\s+\d)+$/, '')) };
                }
              } catch (e) {}
            }
            l = { ...l, text: l.text.replace(/(\s+[^\sA-Za-z]{1,2}|\s+\d)+$/, '').replace(/[\s:;,\-]+$/, '') }; // "1961: 0" → "1961"
            if (prev && prev.heading && out.length) out[out.length - 1] += ' ' + l.text;
            else out.push('## ' + l.text);
            prev = { ...l, heading: true };
            continue;
          }
          const newPara = !para || l.paraStart && prev && !prev.heading && /[.!?"”]$/.test(prev.text) ||
            (l.x0 - left) > width * 0.025 ||
            (prev && /[.!?"”:]$/.test(prev.text) && prev.x1 < left + width * 0.85);
          if (newPara) flush();
          if (para && /[A-Za-z]-$/.test(para)) para = para.slice(0, -1) + l.text;        // satır sonu hecelemesi
          else para += (para ? ' ' : '') + l.text;
          prev = { ...l, heading: false };
        }
        flush();
        return out.join('\n\n');
      };

      // OCR çıktısını okunur hale getir: satır sonu "|" artıkları, heceleme tireleri ve paragraf içi satır kırılmaları
      const cleanOcrText = (raw) => raw
        .replace(/\r/g, '')
        .replace(/[ \t]*[|¦]+[ \t]*$/gm, '')          // satır sonundaki | çizgileri
        .replace(/^[ \t]*[|¦]+[ \t]*/gm, '')          // satır başındaki | çizgileri
        .replace(/(\w)-\n(\w)/g, '$1$2')               // sat-\nır → satır
        .replace(/([^\n])\n(?!\n)/g, '$1 ')            // paragraf içindeki tek satır sonlarını birleştir
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

      // Küçük resimleri OCR'dan önce büyüt (küçük yazılar daha doğru okunur)
      const upscaleForOcr = (canvas) => {
        const scale = Math.max(1, Math.min(2.5, 2000 / canvas.width));
        if (scale <= 1.05) return canvas;
        const out = document.createElement('canvas');
        out.width = Math.round(canvas.width * scale);
        out.height = Math.round(canvas.height * scale);
        const ctx = out.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
        return out;
      };

      const base64ToBytes = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

      // EMF (Windows çizim dosyası) içindeki gömülü bitmap'i çıkarıp canvas'a çizer.
      // Word'e yapıştırılan taranmış sayfalar çoğunlukla bu biçimde saklanır ve tarayıcılar EMF'yi gösteremez.
      const emfToCanvas = async (bytes) => {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let off = 0, best = null;
        while (off + 8 <= dv.byteLength) {
          const type = dv.getUint32(off, true), size = dv.getUint32(off + 4, true);
          if (size < 8 || off + size > dv.byteLength) break;
          let r = null;
          if (type === 81 || type === 80) { // EMR_STRETCHDIBITS / EMR_SETDIBITSTODEVICE
            r = { bmi: dv.getUint32(off + 48, true), cbBmi: dv.getUint32(off + 52, true), bits: dv.getUint32(off + 56, true), cbBits: dv.getUint32(off + 60, true) };
          } else if ((type === 76 || type === 77) && size >= 100) { // EMR_BITBLT / EMR_STRETCHBLT
            r = { bmi: dv.getUint32(off + 84, true), cbBmi: dv.getUint32(off + 88, true), bits: dv.getUint32(off + 92, true), cbBits: dv.getUint32(off + 96, true) };
          }
          if (r && r.cbBmi && r.cbBits && (!best || r.cbBits > best.cbBits)) { r.base = off; best = r; }
          if (type === 14) break; // EMR_EOF
          off += size;
        }
        if (!best) return null;

        const h = best.base + best.bmi;
        const bitsStart = best.base + best.bits;
        const biSize = dv.getUint32(h, true);
        const w = dv.getInt32(h + 4, true);
        const rawH = dv.getInt32(h + 8, true);
        const bpp = dv.getUint16(h + 14, true);
        const comp = dv.getUint32(h + 16, true);
        const H = Math.abs(rawH), topDown = rawH < 0;
        const canvas = document.createElement('canvas');

        if (comp === 4 || comp === 5) { // BI_JPEG / BI_PNG: içerik doğrudan JPEG/PNG
          const blob = new Blob([bytes.slice(bitsStart, bitsStart + best.cbBits)], { type: comp === 4 ? 'image/jpeg' : 'image/png' });
          const bmp = await createImageBitmap(blob);
          canvas.width = bmp.width; canvas.height = bmp.height;
          canvas.getContext('2d').drawImage(bmp, 0, 0);
          return canvas;
        }
        if (!(comp === 0 || comp === 3) || ![1, 4, 8, 16, 24, 32].includes(bpp) || w <= 0 || H <= 0) return null;

        const clrUsed = dv.getUint32(h + 32, true);
        const nPal = bpp <= 8 ? (clrUsed || (1 << bpp)) : 0;
        const palOff = h + biSize + (comp === 3 && biSize === 40 ? 12 : 0);
        const pal = [];
        for (let i = 0; i < nPal; i++) {
          const p = palOff + i * 4;
          pal.push([bytes[p + 2], bytes[p + 1], bytes[p]]);
        }
        const stride = ((w * bpp + 31) >> 5) * 4;
        canvas.width = w; canvas.height = H;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(w, H);
        const d = img.data;
        for (let y = 0; y < H; y++) {
          const row = bitsStart + (topDown ? y : H - 1 - y) * stride;
          for (let x = 0; x < w; x++) {
            let r, g, b;
            if (bpp === 32) { const p = row + x * 4; b = bytes[p]; g = bytes[p + 1]; r = bytes[p + 2]; }
            else if (bpp === 24) { const p = row + x * 3; b = bytes[p]; g = bytes[p + 1]; r = bytes[p + 2]; }
            else if (bpp === 16) { const v = bytes[row + x * 2] | (bytes[row + x * 2 + 1] << 8); r = ((v >> 10) & 31) << 3; g = ((v >> 5) & 31) << 3; b = (v & 31) << 3; }
            else {
              let idx;
              if (bpp === 8) idx = bytes[row + x];
              else if (bpp === 4) idx = (bytes[row + (x >> 1)] >> ((x & 1) ? 0 : 4)) & 15;
              else idx = (bytes[row + (x >> 3)] >> (7 - (x & 7))) & 1;
              [r, g, b] = pal[idx] || [0, 0, 0];
            }
            const q = (y * w + x) * 4;
            d[q] = r; d[q + 1] = g; d[q + 2] = b; d[q + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        return canvas;
      };

      // PDF metni bozuk kodlanmışsa (anlamsız karakterler) OCR'a geçmek için basit kontrol
      const looksGarbled = (text) => {
        const chars = text.replace(/\s/g, '');
        if (chars.length < 40) return false;
        const letters = (chars.match(/[A-Za-zÀ-ɏ]/g) || []).length;
        const words = text.split(/\s+/).filter(w => w.length > 2);
        const withVowel = words.filter(w => /[aeiouyAEIOUY]/.test(w)).length;
        return letters / chars.length < 0.6 || (words.length > 5 && withVowel / words.length < 0.5);
      };

      const pageHasImages = async (page) => {
        try {
          const ops = await page.getOperatorList({ intent: 'print' });
          const O = pdfjsLib.OPS;
          return ops.fnArray.some(fn => fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject || fn === O.paintJpegXObject);
        } catch (e) { return false; }
      };

      const extractPdfText = async (buffer) => {
        if (!window.pdfjsLib) throw new Error('PDF okuyucu yüklenemedi (internet bağlantısını kontrol edin).');
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          let text = tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('').trim();
          const textLen = text.replace(/\s/g, '').length;
          // OCR gereken durumlar: metin katmanı yok / çok az metin + sayfada resim var / metin bozuk kodlanmış / kullanıcı zorladı
          const needOcr = forceOcr || textLen < 20 || looksGarbled(text) || (textLen < 400 && await pageHasImages(page));
          if (needOcr) {
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            // intent:'print' requestAnimationFrame kullanmaz; sekme arka plandayken de çizim takılmaz
            await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
            const ocrText = await ocrImage(canvas, 'Sayfa ' + i + '/' + pdf.numPages);
            // OCR daha fazla metin bulduysa onu kullan (az metinli sayfalarda gerçek metni kaybetme)
            if (forceOcr || ocrText.replace(/\s/g, '').length >= textLen || looksGarbled(text)) text = ocrText;
          }
          pages.push(text);
        }
        return pages.join('\n\n');
      };

      const extractDocxText = async (buffer) => {
        if (!window.mammoth) throw new Error('Word okuyucu yüklenemedi (internet bağlantısını kontrol edin).');
        // HTML'e çevir: böylece belgedeki resimler de yerinde yakalanır ve OCR ile okunur
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
          convertImage: mammoth.images.imgElement(img =>
            img.read('base64').then(b64 => ({ src: 'data:' + img.contentType + ';base64,' + b64 }))
          )
        });
        const doc = new DOMParser().parseFromString(result.value, 'text/html');
        const imgs = [...doc.querySelectorAll('img')];
        for (let i = 0; i < imgs.length; i++) {
          let t = '';
          const label = 'Belgedeki resim ' + (i + 1) + '/' + imgs.length;
          try {
            const src = imgs[i].getAttribute('src') || '';
            const m = src.match(/^data:([^;]+);base64,(.*)$/);
            const type = m ? m[1].toLowerCase() : '';
            if (/emf/.test(type)) {
              // EMF: tarayıcı gösteremez, içindeki bitmap'i çıkar
              const canvas = await emfToCanvas(base64ToBytes(m[2]));
              if (canvas) t = await ocrImage(upscaleForOcr(canvas), label);
            } else if (/wmf/.test(type)) {
              t = ''; // WMF desteklenmiyor
            } else {
              const bmp = await createImageBitmap(await (await fetch(src)).blob());
              const c = document.createElement('canvas');
              c.width = bmp.width; c.height = bmp.height;
              c.getContext('2d').drawImage(bmp, 0, 0);
              t = await ocrImage(upscaleForOcr(c), label);
            }
          } catch (e) { if (!window.Tesseract) throw e; }
          imgs[i].replaceWith(doc.createTextNode(t ? '\n' + t + '\n' : ''));
        }
        const blocks = [...doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th')]
          .filter(el => !el.querySelector('p, li, td, th'));
        // Word başlıkları (Başlık 1-6) ve tamamı kalın kısa paragraflar "## " ile başlık olarak işaretlenir
        const asText = (el) => {
          const t = el.textContent.trim();
          if (!t) return '';
          if (/^H[1-6]$/.test(el.tagName)) return '## ' + t.replace(/\n+/g, ' ');
          const strong = [...el.querySelectorAll('strong, b')].map(s => s.textContent).join('').trim();
          if (el.tagName === 'P' && t.length <= 120 && !/\n/.test(t) && strong === t) return '## ' + t;
          return t;
        };
        const text = blocks.length
          ? blocks.map(asText).filter(Boolean).join('\n\n')
          : doc.body.textContent;
        return text;
      };

      // Tek bir dosyadan metni çıkarır (PDF, Word, resim, txt)
      const readFileText = async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        let text = '';
        if (ext === 'pdf') text = await extractPdfText(await file.arrayBuffer());
        else if (ext === 'docx') text = await extractDocxText(await file.arrayBuffer());
        else if (ext === 'txt') text = await file.text();
        else if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext) || (file.type || '').startsWith('image/')) text = await ocrImage(file, 'Resim');
        else if (ext === 'doc') throw new Error('Eski .doc biçimi desteklenmiyor. Word\'de "Farklı Kaydet > .docx" ile kaydedin.');
        else throw new Error('Desteklenmeyen dosya türü (PDF, Word .docx, resim veya .txt seçin).');

        text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        // Sayfa/resim sınırında bölünen cümleleri birleştir ("...the old\n\nman: he too..." → tek paragraf)
        text = text.replace(/([a-z,;])\n\n(?!## )([a-z])/g, '$1 $2');
        if (!text) throw new Error('Okunabilir metin bulunamadı. Görüntü bulanık veya çok küçük olabilir.');
        return { text, ext };
      };

      const countWordsOf = (t) => t.replace(/^##\s+/gm, '').trim().split(/\s+/).filter(Boolean).length;

      // --- Çoklu dosya kuyruğu ---
      // docs: [{ id, name, title, text, ext, status: 'waiting' | 'reading' | 'ready' | 'error', error }]
      const [docs, setDocs] = useState([]);
      const [selectedDocId, setSelectedDocId] = useState(null);
      const [mergeDocs, setMergeDocs] = useState(false);
      const [mergeTitle, setMergeTitle] = useState('');
      const updateDoc = (id, patch) => setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
      const selectedDoc = docs.find(d => d.id === selectedDocId) || null;
      const queueMode = docs.length > 0;

      const handleFile = async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        const stamp = Date.now();
        const added = files.map((f, i) => ({
          id: 'doc_' + stamp + '_' + i,
          file: f,
          name: f.name,
          title: f.name.replace(/\.[^.]+$/, ''),
          text: '',
          ext: f.name.split('.').pop().toLowerCase(),
          status: 'waiting',
          error: '',
        }));
        // Elle yazılmış metin varsa kaybolmasın: kuyruğun ilk öğesi olarak ekle
        const manual = !queueMode && content.trim()
          ? [{ id: 'doc_' + stamp + '_m', name: 'Elle girilen metin', title: title.trim() || 'Elle girilen metin', text: content.trim(), ext: fileType, status: 'ready', error: '' }]
          : [];
        setDocs(prev => [...prev, ...manual, ...added.map(({ file, ...d }) => d)]);
        if (!selectedDocId) setSelectedDocId((manual[0] || added[0]).id);

        setIsReadingFile(true);
        try {
          for (let i = 0; i < added.length; i++) {
            const d = added[i];
            updateDoc(d.id, { status: 'reading' });
            setFileStatus((added.length > 1 ? '(' + (i + 1) + '/' + added.length + ') ' : '') + '"' + d.name + '" okunuyor...');
            try {
              const { text, ext } = await readFileText(d.file);
              updateDoc(d.id, { status: 'ready', text, ext });
            } catch (err) {
              updateDoc(d.id, { status: 'error', error: err && err.message ? err.message : 'Dosya okunamadı.' });
            }
          }
          setFileStatus(added.length > 1 ? added.length + ' dosya işlendi.' : '"' + added[0].name + '" işlendi.');
        } finally {
          await closeOcrWorker();
          setIsReadingFile(false);
        }
      };

      const removeDoc = (id) => {
        setDocs(prev => {
          const next = prev.filter(d => d.id !== id);
          if (selectedDocId === id) setSelectedDocId(next[0] ? next[0].id : null);
          return next;
        });
      };

      const clearAll = () => {
        setDocs([]); setSelectedDocId(null);
        setContent(''); setFileType('manual'); setFileStatus('');
      };

      const readyDocs = docs.filter(d => d.status === 'ready' && d.text.trim());

      const makeReading = (t, text, type, i) => ({
        id: 'reading_' + Date.now() + '_' + i,
        title: t,
        content: text,
        weekId,
        category,
        wordCount: countWordsOf(text),
        savedWordIds: [],
        fileType: type,
        dateAdded: new Date().toISOString()
      });

      const handleSave = (e) => {
        e.preventDefault();
        if (isReadingFile) return;
        if (!queueMode) {
          if (!title.trim() || !content.trim()) return;
          onSave([makeReading(title.trim(), content.trim(), fileType, 0)]);
          return;
        }
        if (!readyDocs.length) return;
        if (mergeDocs && readyDocs.length > 1) {
          // Tek metin: her dosya kendi başlığıyla ayrılır
          const merged = readyDocs.map(d => (/^##\s/.test(d.text) ? '' : '## ' + d.title + '\n\n') + d.text).join('\n\n');
          const t = mergeTitle.trim() || readyDocs.map(d => d.title).join(' + ');
          onSave([makeReading(t, merged, 'merged', 0)]);
        } else {
          onSave(readyDocs.map((d, i) => makeReading(d.title.trim() || d.name, d.text.trim(), d.ext, i)));
        }
      };

      const statusBadge = (d) => ({
        waiting: <span className="text-slate-500">bekliyor</span>,
        reading: <span className="text-blue-300">okunuyor…</span>,
        ready: <span className="text-emerald-400">{countWordsOf(d.text)} kelime</span>,
        error: <span className="text-red-400" title={d.error}>hata</span>,
      })[d.status];

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-3 max-h-[92vh] overflow-y-auto">
            <h3 className="font-bold text-base text-white">İngilizce Okuma Metni Yükle</h3>
            {!queueMode && (
              <input
                type="text"
                placeholder="Başlık (Örn: Reading 1: Technology)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={weekId}
                onChange={e => setWeekId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
              >
                {weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="Fen Bilimleri">Fen Bilimleri</option>
                <option value="Sağlık Bilimleri">Sağlık Bilimleri</option>
                <option value="Sosyal Bilimler">Sosyal Bilimler</option>
                <option value="Genel Akademik">Genel Akademik</option>
              </select>
            </div>
            <label className={"flex flex-col items-center justify-center gap-1 w-full px-3 py-4 rounded-lg border-2 border-dashed cursor-pointer transition " + (isReadingFile ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-blue-500 hover:bg-slate-800/60")}>
              <span className="text-xs font-bold text-white">{isReadingFile ? 'Dosyalar okunuyor...' : queueMode ? '+ Başka dosya ekle' : 'PDF, Word veya resim dosyaları seç'}</span>
              <span className="text-[11px] text-slate-400">Birden çok dosya seçebilirsiniz (Ctrl/Shift ile) · .pdf, .docx, .jpg, .png, .txt</span>
              <input type="file" multiple accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={handleFile} disabled={isReadingFile} className="hidden" />
            </label>

            {queueMode && (
              <div className="rounded-lg border border-slate-800 divide-y divide-slate-800 max-h-44 overflow-y-auto">
                {docs.map((d, i) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDocId(d.id)}
                    className={"flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer " + (d.id === selectedDocId ? "bg-blue-600/15" : "hover:bg-slate-800/60")}
                  >
                    <span className="text-slate-500 w-4 text-right">{i + 1}</span>
                    <span className="flex-1 truncate text-slate-200" title={d.name}>{d.title || d.name}</span>
                    {statusBadge(d)}
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); removeDoc(d.id); }}
                      disabled={d.status === 'reading'}
                      aria-label={'"' + d.name + '" dosyasını listeden çıkar'}
                      title="Listeden çıkar"
                      className="px-1.5 rounded text-slate-500 hover:bg-red-600 hover:text-white disabled:opacity-30"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {queueMode && docs.length > 1 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" checked={mergeDocs} onChange={e => setMergeDocs(e.target.checked)} className="accent-blue-500" />
                  Hepsini tek metinde birleştir (işaretlenmezse her dosya ayrı metin olarak kaydedilir)
                </label>
                {mergeDocs && (
                  <input
                    type="text"
                    placeholder="Birleşik metnin başlığı (boş bırakılırsa dosya adları kullanılır)"
                    value={mergeTitle}
                    onChange={e => setMergeTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={forceOcr} onChange={e => setForceOcr(e.target.checked)} disabled={isReadingFile} className="accent-blue-500" />
              PDF'in tüm sayfalarını resim olarak oku (metin eksik veya bozuk çıkıyorsa işaretleyin)
            </label>
            {fileStatus && (
              <p className={"text-[11px] " + (fileStatus.startsWith('Hata') ? "text-red-400" : isReadingFile ? "text-blue-300" : "text-emerald-400")}>{fileStatus}</p>
            )}
            {queueMode ? (
              selectedDoc && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Bu metnin başlığı"
                    value={selectedDoc.title}
                    onChange={e => updateDoc(selectedDoc.id, { title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                  {selectedDoc.status === 'error' ? (
                    <p className="text-[11px] text-red-400">Hata: {selectedDoc.error}</p>
                  ) : (
                    <textarea
                      rows={7}
                      placeholder={selectedDoc.status === 'ready' ? '' : 'Dosya okunuyor, metin birazdan burada görünecek...'}
                      value={selectedDoc.text}
                      disabled={selectedDoc.status !== 'ready'}
                      onChange={e => updateDoc(selectedDoc.id, { text: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif leading-relaxed disabled:opacity-60"
                    />
                  )}
                </div>
              )
            ) : (
              <textarea
                rows={7}
                placeholder={"İngilizce metni buraya yapıştırın veya yukarıdan dosya seçin...\n\nBaşlık satırlarını \"## \" ile başlatın; okuma ekranında kalın gösterilir."}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif leading-relaxed"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              {(queueMode || content) && (
                <button type="button" onClick={clearAll} disabled={isReadingFile} className="mr-auto px-4 py-2 rounded-lg bg-slate-800 text-xs text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-50">{queueMode ? 'Listeyi Temizle' : 'Metni Temizle'}</button>
              )}
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button type="submit" disabled={isReadingFile || (queueMode && !readyDocs.length)} className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white disabled:opacity-50">
                {!queueMode ? 'Metni Kaydet'
                  : mergeDocs && readyDocs.length > 1 ? 'Birleştirip Kaydet'
                  : readyDocs.length > 1 ? readyDocs.length + ' Metni Kaydet' : 'Metni Kaydet'}
              </button>
            </div>
          </form>
        </div>
      );
    }

