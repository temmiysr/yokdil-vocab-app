    // --- CÜMLE ÇEVİRİSİ VE ANALİZİ ---
    const loadScript = (src, globalName) => new Promise((resolve, reject) => {
      if (globalName && window[globalName]) return resolve(window[globalName]);
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = () => reject(new Error('Kütüphane yüklenemedi: ' + src));
      document.head.appendChild(s);
    });
    const loadNlp = () => loadScript('https://cdn.jsdelivr.net/npm/compromise@14.14.0/builds/compromise.js', 'nlp');

    const translateSentence = async (text) => {
      const j = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=en|tr');
      if (!j) throw new Error('Çeviri alınamadı');
      if (j.quotaFinished) throw new Error('Çeviri servisinin günlük ücretsiz kotası doldu');
      return (j.responseData && j.responseData.translatedText) || '';
    };

    // Yan cümle başlatan kelimeler → tür ve Türkçe ipucu
    const SUBORDINATORS = [
      ['which', 'Sıfat cümlesi', 'önceki isme bilgi ekler: "-en / -an / -dığı"'], ['that', 'Sıfat / isim cümlesi', '"-dığı / -en" ya da "ki"'],
      ['who', 'Sıfat cümlesi (kişi)', '"-en kişi"'], ['whom', 'Sıfat cümlesi (kişi)', '"-diği kişi"'], ['whose', 'Sıfat cümlesi (sahiplik)', '"-in …-i olan"'],
      ['where', 'Yer belirten yan cümle', '"-diği yer(de)"'], ['when', 'Zaman yan cümlesi', '"-dığında"'], ['while', 'Zaman / zıtlık yan cümlesi', '"-ken" ya da "oysa"'],
      ['whereas', 'Zıtlık yan cümlesi', '"oysa, -mesine karşın"'], ['although', 'Zıtlık yan cümlesi', '"-mesine rağmen"'], ['though', 'Zıtlık yan cümlesi', '"-mesine rağmen"'],
      ['even though', 'Zıtlık yan cümlesi', '"-mesine rağmen"'], ['because', 'Sebep yan cümlesi', '"çünkü / -diği için"'], ['since', 'Sebep / zaman yan cümlesi', '"-diği için" ya da "-den beri"'],
      ['as', 'Sebep / zaman / benzerlik', '"-diği için / -dığı gibi"'], ['if', 'Koşul yan cümlesi', '"-irse"'], ['unless', 'Koşul yan cümlesi', '"-medikçe"'],
      ['provided that', 'Koşul yan cümlesi', '"-mek şartıyla"'], ['so that', 'Amaç yan cümlesi', '"-sin diye"'], ['until', 'Zaman yan cümlesi', '"-e kadar"'],
      ['before', 'Zaman yan cümlesi', '"-meden önce"'], ['after', 'Zaman yan cümlesi', '"-dikten sonra"'], ['once', 'Zaman yan cümlesi', '"-ir -mez"'],
      ['whether', 'İsim cümlesi', '"-ip -mediği"'],
    ];
    const LINKER_TR = { 'zıtlık': 'zıtlık: "ancak, -e rağmen"', 'sebep-sonuç': 'sebep-sonuç: "bu yüzden, -dığı için"', 'ekleme': 'ekleme: "ayrıca, üstelik"', 'örnekleme': 'örnek: "örneğin"', 'koşul': 'koşul: "-medikçe, -mek şartıyla"', 'benzerlik': 'benzerlik: "benzer şekilde"', 'amaç': 'amaç: "-mek için"' };
    const PASSIVE_RE = /\b(?:is|are|was|were|be|been|being|has been|have been|had been|will be|can be|could be|may be|might be|must be|should be)\s+(?:\w+ly\s+)?(\w+(?:ed|en|wn|lt|pt|ght|ung|ade|one|ept))\b/gi;

    function SentenceModal({ sentence, cards, onClose }) {
      const [tr, setTr] = useState({ state: 'loading', text: '' });
      const [nlpState, setNlpState] = useState({ state: 'loading', clauses: [], verbs: [] });

      useEffect(() => {
        let alive = true;
        translateSentence(sentence).then(t => alive && setTr({ state: 'ok', text: t })).catch(e => alive && setTr({ state: 'error', text: e.message }));
        loadNlp().then(nlp => {
          if (!alive) return;
          const doc = nlp(sentence);
          const clauses = doc.clauses().out('array').map(s => s.trim()).filter(Boolean);
          const verbs = doc.verbs().out('array').map(v => v.toLowerCase());
          setNlpState({ state: 'ok', clauses: clauses.length ? clauses : [sentence], verbs });
        }).catch(e => alive && setNlpState({ state: 'error', clauses: [sentence], verbs: [], error: e.message }));
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => { alive = false; window.removeEventListener('keydown', onKey); };
      }, [sentence]);

      const bank = new Set(cards.map(c => String(c.lemma || c.english).toLowerCase()));
      const verbWords = new Set(nlpState.verbs.flatMap(v => v.split(/\s+/)));
      const linkerAt = (low) => [...SUBORDINATORS.map(s => s[0]), ...LINKER_LIST.map(l => l.w)].sort((a, b) => b.length - a.length).find(l => low.startsWith(l + ' ') || low.startsWith(l + ','));

      // Cümleyi renklendir: fiil (mavi), bağlaç (turuncu), AWL (mor), bankadaki kelime (yeşil)
      const colorize = (text) => {
        const linkWords = new Set([...SUBORDINATORS.map(s => s[0]), ...LINKER_LIST.map(l => l.w)].filter(w => !w.includes(' ')));
        return text.split(/([A-Za-z'’-]+)/).map((tok, i) => {
          if (i % 2 === 0) return tok;
          const w = tok.toLowerCase();
          if (linkWords.has(w)) return <b key={i} className="text-orange-300">{tok}</b>;
          if (verbWords.has(w)) return <b key={i} className="text-sky-300">{tok}</b>;
          if (bank.has(w) || lemmaCandidates(w).some(x => bank.has(x))) return <span key={i} className="text-emerald-300 underline decoration-dotted">{tok}</span>;
          if (w.length > 3 && !STOPWORDS.has(w) && awlSublist(w)) return <span key={i} className="underline decoration-purple-400 decoration-2 underline-offset-4">{tok}</span>;
          return tok;
        });
      };

      const passives = [...sentence.matchAll(PASSIVE_RE)].map(m => m[0]);
      const linkersFound = LINKER_LIST.filter(L => new RegExp('\\b' + escRe(L.w) + '\\b', 'i').test(sentence));

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
          <div role="dialog" aria-label="Cümle analizi" onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-start gap-2">
              <h3 className="font-bold text-base text-white mr-auto">📝 Cümle Analizi</h3>
              <button onClick={() => speakText(sentence)} className="px-2 py-1 rounded-md text-blue-400 hover:bg-slate-800 text-xs">🔊 Dinle</button>
              <button onClick={onClose} aria-label="Kapat" className="px-2 py-1 rounded-md text-slate-400 hover:bg-slate-800">✕</button>
            </div>

            <p className="text-base text-slate-100 font-serif leading-relaxed">{colorize(sentence)}</p>
            <p className="text-[10px] text-slate-500"><b className="text-sky-300">fiil</b> · <b className="text-orange-300">bağlaç</b> · <span className="underline decoration-purple-400">akademik kelime</span> · <span className="text-emerald-300">bankanızda</span></p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-[11px] text-slate-500 mb-1">Türkçe çeviri (otomatik, MyMemory)</p>
              <p className={"text-sm " + (tr.state === 'error' ? 'text-amber-400' : 'text-blue-200')}>{tr.state === 'loading' ? 'Çevriliyor…' : tr.text}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-300">Cümlenin parçaları</p>
              {nlpState.state === 'loading' && <p className="text-xs text-slate-500">Analiz ediliyor…</p>}
              {nlpState.state === 'error' && <p className="text-xs text-amber-400">Analiz kütüphanesi yüklenemedi; yalnızca çeviri gösteriliyor.</p>}
              {nlpState.state === 'ok' && nlpState.clauses.map((c, i) => {
                const low = c.toLowerCase().replace(/^[,;:\s]+/, '');
                const sub = SUBORDINATORS.find(s => low.startsWith(s[0] + ' ') || low.startsWith(s[0] + ','));
                const lnk = !sub && LINKER_LIST.find(L => low.startsWith(L.w + ' ') || low.startsWith(L.w + ','));
                const role = sub ? sub[1] : lnk ? 'Bağlaçla başlayan cümle (' + lnk.cat + ')' : (i === 0 || !nlpState.clauses.some((x, k) => k < i && !SUBORDINATORS.some(s => x.toLowerCase().startsWith(s[0] + ' '))) ? 'Ana cümle' : 'Cümle devamı');
                return (
                  <div key={i} className={"p-3 rounded-xl border " + (sub ? 'border-orange-900/60 bg-orange-950/20' : 'border-sky-900/60 bg-sky-950/20')}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{role}{sub && <span className="normal-case font-normal text-slate-500"> — Türkçede: {sub[2]}</span>}</p>
                    <p className="text-sm text-slate-100 font-serif mt-0.5">{colorize(c)}</p>
                  </div>
                );
              })}
            </div>

            {(passives.length > 0 || linkersFound.length > 0) && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px] text-slate-300">
                {passives.map((p, i) => <p key={'p' + i}>🔁 <b className="text-sky-300">{p}</b> → edilgen yapı (iş yapılıyor/yapıldı; yapan önemli değil). Türkçeye "-ıldı / -ilir" ile çevrilir.</p>)}
                {linkersFound.map(L => <p key={L.w}>🔗 <b className="text-orange-300">{L.w}</b> → {LINKER_TR[L.cat] || L.cat}</p>)}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Okuma ekranında tıklanan kelimenin anlam kutusu (anlam, okunuş, ses, eş/zıt anlam, karta ekle)
    // Tıklanan kelimenin cümledeki kalıpları: "shortage of natural resources", "natural resources", "play a role in"
    function phraseCandidates(sentence, word) {
      if (!sentence || !word) return [];
      const toks = sentence.split(/\s+/);
      const clean = (t) => t.replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '');
      const endsClause = (t) => /[.,;:!?)"”]$/.test(t);
      const lw = word.toLowerCase();
      const i = toks.findIndex(t => clean(t).toLowerCase() === lw);
      if (i < 0) return [];
      const PREPS = new Set(['of', 'to', 'in', 'on', 'with', 'for', 'from', 'at', 'by', 'into', 'about', 'against', 'upon', 'between', 'among', 'through', 'towards', 'without', 'within']);
      const ART = new Set(['a', 'an', 'the']);
      const STOP = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 'may', 'might', 'must', 'should', 'and', 'or', 'but', 'that', 'which', 'who', 'while', 'when', 'as', 'than', 'this', 'these', 'those', 'its', 'their', 'his', 'her', 'it', 'they']);
      const out = [];
      // Sağa: kelime + edat + (artikel) + en çok 3 kelime
      if (!endsClause(toks[i]) && toks[i + 1] && PREPS.has(clean(toks[i + 1]).toLowerCase())) {
        const parts = [clean(toks[i]), clean(toks[i + 1]).toLowerCase()];
        let j = i + 2, content = 0;
        while (j < toks.length && content < 3) {
          const c = clean(toks[j]), lc = c.toLowerCase();
          if (!c || PREPS.has(lc) || STOP.has(lc)) break;
          parts.push(c); if (!ART.has(lc)) content++;
          if (endsClause(toks[j])) break;
          j++;
        }
        out.push(parts.join(" ")); // "shortage of natural resources" ya da yalnızca "depend on"
      }
      // Sola: önündeki sıfat/isim + kelime ("natural resources")
      const prev = i > 0 ? clean(toks[i - 1]) : '';
      if (prev && prev.length > 2 && !endsClause(toks[i - 1]) && !ART.has(prev.toLowerCase()) && !PREPS.has(prev.toLowerCase()) && !STOP.has(prev.toLowerCase()) && !STOPWORDS.has(prev.toLowerCase())) {
        out.push(prev + ' ' + clean(toks[i]));
      }
      // Sağa: kelime + arkasındaki isim ("climate change")
      const next = toks[i + 1] ? clean(toks[i + 1]) : '';
      if (next && next.length > 2 && !endsClause(toks[i]) && !PREPS.has(next.toLowerCase()) && !STOP.has(next.toLowerCase()) && !STOPWORDS.has(next.toLowerCase())) {
        out.push(clean(toks[i]) + ' ' + next);
      }
      const smart = typeof findSmartCollocation === 'function' ? findSmartCollocation(sentence, clean(toks[i])) : '';
      if (smart && smart.split(/\s+/).length > 1) out.push(smart);
      return [...new Set(out)]
        .filter(p => p.split(/\s+/).length >= 2 && p.split(/\s+/).length <= 6).slice(0, 3);
    }

    function WordPopover({ pop, cards, onAdd, onAddPhrase, onClose, onAnalyze }) {
      const phrases = useMemo(() => phraseCandidates(pop.sentence, pop.word), [pop.sentence, pop.word]);
      const [info, setInfo] = useState(null);
      const [state, setState] = useState('loading');      // loading | ok | error
      const boxRef = useRef(null);
      // Kök önerisine tıklanınca kutu o kelimeye geçer (pop.word yerine)
      const [word, setWord] = useState(pop.word);
      const [roots, setRoots] = useState([]);
      useEffect(() => { setWord(pop.word); }, [pop.word]);

      useEffect(() => {
        let alive = true;
        setState('loading'); setInfo(null); setRoots([]);
        findDerivationalRoots(word).then(rs => { if (alive) setRoots(rs); }).catch(() => {});
        (async () => {
          try {
            const raw = word.toLowerCase();
            const r = await resolveLemma(raw).catch(() => null);
            let lemma = r ? r.word : raw;
            let pos = r ? posFor(lemma, [raw], r.info.tags) : null;
            if (!r) {
              // Datamuse yanıt vermezse: kök adaylarını sözlükte (dictionaryapi.dev) doğrula
              for (const c of lemmaCandidates(raw).slice(1)) {
                const j = await fetchJson('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(c)).catch(() => null);
                if (Array.isArray(j) && j.length) { lemma = c; break; }
              }
              if (lemma !== raw && /(ed|ing)$/.test(raw)) pos = 'verb';
            }
            const d = await fetchWordDetails(lemma, pos || 'noun');
            if (alive) { setInfo({ ...d, lemma, pos: d.partOfSpeech || pos }); setState('ok'); }
          } catch (e) { if (alive) setState('error'); }
        })();
        return () => { alive = false; };
      }, [word]);

      // Esc veya dışarı tıklayınca kapan
      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target) && !e.target.closest('[data-reader]')) onClose(); };
        const onScroll = (e) => { if (!boxRef.current || !boxRef.current.contains(e.target)) onClose(); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('scroll', onScroll, true);
        return () => {
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('mousedown', onDown);
          document.removeEventListener('scroll', onScroll, true);
        };
      }, []);

      const lemma = info ? info.lemma : word.toLowerCase();
      const existing = cards.find(c => String(c.lemma || c.english).toLowerCase() === lemma);
      const W = 320;
      const left = Math.max(8, Math.min(window.innerWidth - W - 8, pop.x - W / 2));
      const below = pop.y + 300 < window.innerHeight;
      const style = below ? { left, top: pop.y + 8, width: W } : { left, bottom: window.innerHeight - pop.top + 8, width: W };

      return (
        <div ref={boxRef} role="dialog" aria-label={'"' + pop.word + '" kelimesinin anlamı'} style={style}
             className="fixed z-50 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 space-y-2 text-left font-sans">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-black text-white">{lemma}</span>
                {info && info.lemma !== word.toLowerCase() && <span className="text-[10px] text-slate-500">({word})</span>}
                {info && info.pos && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{info.pos}</span>}
                <AwlBadge word={lemma} />
              </div>
              {info && (info.ipa || info.okunus) && (
                <p className="text-[11px] text-slate-400">
                  {info.ipa && <span className="font-mono">/{info.ipa}/</span>}
                  {info.okunus && <span className="text-amber-300 ml-1.5">[{info.okunus}]</span>}
                </p>
              )}
            </div>
            <button onClick={() => playWord({ english: lemma, audioUrl: info && info.audioUrl })} aria-label={lemma + ' telaffuzunu dinle'} className="px-1.5 py-1 rounded-md text-blue-400 hover:bg-slate-800">🔊</button>
            <button onClick={onClose} aria-label="Kapat" className="px-1.5 py-1 rounded-md text-slate-500 hover:bg-slate-800">✕</button>
          </div>

          {state === 'loading' && <p className="text-xs text-slate-500">Anlam aranıyor…</p>}
          {state === 'error' && <p className="text-xs text-red-400">Bağlantı hatası; anlam getirilemedi.</p>}
          {roots.length > 0 && (
            <p className="text-[11px] text-purple-300">🌱 Kök önerisi:{roots.map(r => <button key={r} onClick={() => setWord(r)} className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-200 hover:bg-purple-900 font-bold">{r}</button>)}</p>
          )}
          {state === 'ok' && (
            <>
              <p className={"text-sm font-bold " + (info.turkish ? 'text-blue-300' : 'text-amber-400')}>
                {existing && !isMissingMeaning(existing) ? existing.turkish : (info.turkish || 'Otomatik anlam bulunamadı')}
              </p>
              {(info.trSenses || []).length > 1 && info.trSenses.slice(0, 2).map((s, i) => (
                <p key={i} className="text-[10px] text-slate-400">{s.sense && <span className="italic">{s.sense}: </span>}<span className="text-blue-200">{s.words.join(', ')}</span></p>
              ))}
              {info.definition && <p className="text-[11px] text-slate-400 line-clamp-2"><span className="text-slate-500">EN:</span> {info.definition}</p>}
              {(info.synonyms || []).length > 0 && <p className="text-[11px]"><span className="text-slate-500">Eş:</span> <span className="text-emerald-300">{info.synonyms.slice(0, 4).join(', ')}</span></p>}
              {(info.antonyms || []).length > 0 && <p className="text-[11px]"><span className="text-slate-500">Zıt:</span> <span className="text-red-300">{info.antonyms.slice(0, 3).join(', ')}</span></p>}
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            {existing ? (
              <span className="text-[11px] font-bold text-emerald-400">✓ Kelime bankanızda var</span>
            ) : (
              <button
                disabled={state === 'loading'}
                onClick={() => onAdd(info || { lemma, pos: 'noun' }, pop)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
              >+ Karta ekle</button>
            )}
            <TurengLink word={lemma} className="ml-auto" />
          </div>
          {onAddPhrase && phrases.length > 0 && (
            <div className="pt-1 space-y-1">
              <p className="text-[10px] text-slate-500">🔗 Kalıp olarak ekle:</p>
              <div className="flex flex-wrap gap-1">
                {phrases.map(p => (
                  <button key={p} onClick={() => onAddPhrase(p, pop.sentence)} className="px-2 py-1 rounded-md bg-indigo-950 border border-indigo-800 text-[11px] font-bold text-indigo-200 hover:bg-indigo-900">{p}</button>
                ))}
              </div>
            </div>
          )}
          {pop.sentence && onAnalyze && (
            <button onClick={() => onAnalyze(pop.sentence)} className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200 hover:bg-slate-700">
              📝 Cümleyi çevir ve analiz et
            </button>
          )}
        </div>
      );
    }

