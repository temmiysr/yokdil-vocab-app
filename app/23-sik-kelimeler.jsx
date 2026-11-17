    // --- SINAVLARDA SIK GEÇEN KELİMELER ---
    // Yüklenen ve oluşturulan tüm denemelerdeki kelimeler sayılır (her parça bir kez); yaygın kelimeler atlanır.
    function examWordFrequency(exams) {
      const count = new Map(), inExams = new Map();
      (exams || []).forEach(ex => {
        const seenPassages = new Set();
        const texts = [];
        (ex.questions || []).forEach(q => {
          if (q.passage && !seenPassages.has(q.passage)) { seenPassages.add(q.passage); texts.push(q.passage); }
          // Türkçe metinler sayılmaz: Tr→İng sorusunun kökü ve İng→Tr sorusunun şıkları
          const sec = qSection(q);
          if (sec !== 'Çeviri (Tr→İng)') texts.push(q.prompt || '');
          if (sec !== 'Çeviri (İng→Tr)') texts.push(...(q.options || []));
        });
        const local = new Set();
        texts.join(' ').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).forEach(w => {
          w = w.replace(/^['-]+|['-]+$/g, '').replace(/'s$/, '');
          if (w.length < 4 || STOPWORDS.has(w) || /[^a-z-]/.test(w)) return;
          count.set(w, (count.get(w) || 0) + 1);
          local.add(w);
        });
        local.forEach(w => inExams.set(w, (inExams.get(w) || 0) + 1));
      });
      // Basit birleştirme: çoğul / -ed / -ing biçimleri, kök de listede varsa köke eklenir
      const merged = new Map();
      [...count.entries()].sort((a, b) => a[0].length - b[0].length).forEach(([w, n]) => {
        const base = [w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e')].find(b => b !== w && merged.has(b));
        const k = base || w;
        const cur = merged.get(k) || { word: k, n: 0, exams: 0 };
        cur.n += n; cur.exams = Math.max(cur.exams, inExams.get(w) || 0);
        merged.set(k, cur);
      });
      return [...merged.values()].filter(x => x.n >= 2).sort((a, b) => (b.exams - a.exams) || (b.n - a.n));
    }

    function FrequentWordsModal({ exams, cards, onClose, onAdd }) {
      const all = useMemo(() => examWordFrequency(exams), [exams]);
      const bank = useMemo(() => new Set(cards.flatMap(c => [String(c.lemma || c.english).toLowerCase(), String(c.english).toLowerCase()])), [cards]);
      const [onlyAwl, setOnlyAwl] = useState(false);
      const [limit, setLimit] = useState(100);
      const list = all.filter(x => !onlyAwl || awlSublist(x.word)).slice(0, 300);
      const [sel, setSel] = useState(() => new Set(all.filter(x => !bank.has(x.word)).slice(0, 50).map(x => x.word)));
      const [prog, setProg] = useState(null);
      const toggle = (w) => setSel(s => { const n = new Set(s); n.has(w) ? n.delete(w) : n.add(w); return n; });
      const add = async () => {
        const words = [...sel].filter(w => !bank.has(w));
        if (!words.length) return;
        setProg({ done: 0, total: words.length });
        const details = await runPool(words, 3, async (w) => {
          const r = await resolveLemma(w).catch(() => null);
          const lemma = (r && r.word) || w;
          const d = await fetchWordDetails(lemma, '').catch(() => null);
          return { w, lemma, d };
        }, (d, t) => setProg({ done: d, total: t }));
        onAdd(details.filter(Boolean), all);
      };
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl max-w-3xl w-full space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">📊 Sınavlarda sık geçen kelimeler</h3>
                <p className="text-xs text-slate-400">{(exams || []).length} denemedeki kelimeler; en çok denemede ve en sık geçenler önce. Yaygın kelimeler (the, have, which…) sayılmaz.</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            {!all.length ? <p className="text-xs text-slate-500">Önce Sınavlar sekmesinden bir deneme yükleyin ya da oluşturun.</p> : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyAwl} onChange={e => setOnlyAwl(e.target.checked)} className="accent-purple-500" /> Yalnızca akademik kelimeler (AWL)</label>
                  <button onClick={() => setSel(new Set(list.slice(0, limit).filter(x => !bank.has(x.word)).map(x => x.word)))} className="text-blue-400 hover:underline">Bankada olmayanların hepsini seç</button>
                  <button onClick={() => setSel(new Set())} className="text-slate-400 hover:underline">Seçimi temizle</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                  {list.slice(0, limit).map(x => {
                    const have = bank.has(x.word);
                    return (
                      <label key={x.word} className={"flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border " + (have ? 'border-emerald-900/50 text-emerald-400/70' : sel.has(x.word) ? 'border-blue-600 bg-blue-950/40 text-white' : 'border-slate-800 text-slate-300')}>
                        <input type="checkbox" disabled={have} checked={have || sel.has(x.word)} onChange={() => toggle(x.word)} className="accent-blue-500" />
                        <span className="flex-1 truncate">{x.word}</span>
                        {awlSublist(x.word) ? <span className="text-[8px] text-purple-300">AWL</span> : null}
                        <span className="text-[9px] text-slate-500" title={x.n + ' kez, ' + x.exams + ' denemede'}>{x.n}×</span>
                      </label>
                    );
                  })}
                </div>
                {list.length > limit && <button onClick={() => setLimit(limit + 100)} className="w-full py-2 rounded-lg bg-slate-800 text-xs text-slate-300">Daha fazla göster ({limit} / {list.length})</button>}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-400">{prog ? 'Anlamlar aranıyor… ' + prog.done + '/' + prog.total : sel.size + ' kelime seçili · yeşiller zaten bankanızda'}</span>
                  <button disabled={!sel.size || !!prog} onClick={add} className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-50">Seçilenleri karta ekle</button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

