    // --- EDAT EŞLEŞTİRME OYUNU (Preposition Wheel) ---
    // YÖKDİL'in kelime sorularında sık çıkan edatlı kalıplar. Birden fazla edatla doğru olabilenler (result in/from,
    // involved in/with, concerned with/about…) belirsiz oldukları için listeye alınmadı.
    const PREP_OPTIONS = ['to', 'of', 'from', 'in', 'on', 'with', 'for', 'at'];
    const PREP_PAIRS = [
      ['attribute', 'to', '-e bağlamak, -e atfetmek'], ['prone', 'to', '-e yatkın'], ['susceptible', 'to', '-e karşı savunmasız'], ['contribute', 'to', '-e katkıda bulunmak'],
      ['adhere', 'to', '-e bağlı kalmak, uymak'], ['resort', 'to', '-e başvurmak'], ['succumb', 'to', '-e yenik düşmek'], ['object', 'to', '-e itiraz etmek'],
      ['consent', 'to', '-e razı olmak'], ['equivalent', 'to', '-e eşdeğer'], ['similar', 'to', '-e benzer'], ['exposed', 'to', '-e maruz kalmış'],
      ['subject', 'to', '-e tabi'], ['confined', 'to', '-e sınırlı'], ['adapt', 'to', '-e uyum sağlamak'], ['respond', 'to', '-e yanıt vermek'],
      ['refer', 'to', '-e değinmek, atıfta bulunmak'], ['access', 'to', '-e erişim'], ['threat', 'to', '-e tehdit'], ['solution', 'to', '-e çözüm'],
      ['approach', 'to', '-e yaklaşım'], ['contribution', 'to', '-e katkı'], ['alternative', 'to', '-e alternatif'], ['vulnerable', 'to', '-e karşı savunmasız'],
      ['immune', 'to', '-e karşı bağışık'], ['detrimental', 'to', '-e zararlı'], ['conducive', 'to', '-e elverişli'], ['akin', 'to', '-e benzer'],
      ['stem', 'from', '-den kaynaklanmak'], ['derive', 'from', '-den türemek, elde etmek'], ['refrain', 'from', '-den kaçınmak'], ['abstain', 'from', '-den uzak durmak'],
      ['differ', 'from', '-den farklı olmak'], ['benefit', 'from', '-den yararlanmak'], ['suffer', 'from', '-den muzdarip olmak'], ['emerge', 'from', '-den ortaya çıkmak'],
      ['recover', 'from', '-den iyileşmek'], ['prevent', 'from', '-den alıkoymak'], ['exempt', 'from', '-den muaf'], ['distinguish', 'from', '-den ayırt etmek'],
      ['originate', 'from', '-den kaynaklanmak'], ['deviate', 'from', '-den sapmak'], ['withdraw', 'from', '-den çekilmek'],
      ['deprive', 'of', '-den yoksun bırakmak'], ['consist', 'of', '-den oluşmak'], ['dispose', 'of', '-den kurtulmak, elden çıkarmak'], ['accuse', 'of', '-le suçlamak'],
      ['approve', 'of', '-i onaylamak'], ['devoid', 'of', '-den yoksun'], ['indicative', 'of', '-in göstergesi'], ['characteristic', 'of', '-e özgü'],
      ['tolerant', 'of', '-e hoşgörülü'], ['conscious', 'of', '-in bilincinde'], ['aware', 'of', '-in farkında'], ['capable', 'of', '-e muktedir'],
      ['independent', 'of', '-den bağımsız'], ['regardless', 'of', '-e bakılmaksızın'], ['lack', 'of', '-in eksikliği'], ['representative', 'of', '-i temsil eden'],
      ['comprised', 'of', '-den oluşan'], ['reminiscent', 'of', '-i hatırlatan'], ['wary', 'of', '-e karşı temkinli'],
      ['invest', 'in', '-e yatırım yapmak'], ['participate', 'in', '-e katılmak'], ['specialize', 'in', '-de uzmanlaşmak'], ['persist', 'in', '-de ısrar etmek'],
      ['succeed', 'in', '-de başarılı olmak'], ['interested', 'in', '-e ilgili'], ['rich', 'in', '-ce zengin'], ['engage', 'in', '-e girişmek, -le uğraşmak'],
      ['belief', 'in', '-e inanç'], ['increase', 'in', '-de artış'], ['decline', 'in', '-de düşüş'], ['instrumental', 'in', '-de etkili, önemli rol oynayan'],
      ['implicated', 'in', '-e karışmış'], ['inherent', 'in', '-in doğasında olan'],
      ['rely', 'on', '-e güvenmek, dayanmak'], ['depend', 'on', '-e bağlı olmak'], ['insist', 'on', '-de ısrar etmek'], ['focus', 'on', '-e odaklanmak'],
      ['comment', 'on', '-e yorum yapmak'], ['emphasis', 'on', '-e vurgu'], ['impact', 'on', '-e etki'], ['reliance', 'on', '-e bağımlılık'],
      ['based', 'on', '-e dayalı'], ['dependent', 'on', '-e bağımlı'], ['embark', 'on', '-e başlamak, girişmek'], ['capitalize', 'on', '-den yararlanmak, fırsata çevirmek'],
      ['comply', 'with', '-e uymak'], ['cope', 'with', '-le başa çıkmak'], ['coincide', 'with', '-le çakışmak, aynı zamana denk gelmek'], ['interfere', 'with', '-e engel olmak, karışmak'],
      ['consistent', 'with', '-le tutarlı'], ['compatible', 'with', '-le uyumlu'], ['associated', 'with', '-le ilişkili'], ['equipped', 'with', '-le donatılmış'],
      ['preoccupied', 'with', '-le meşgul, kafayı takmış'], ['interact', 'with', '-le etkileşimde bulunmak'], ['collaborate', 'with', '-le iş birliği yapmak'], ['correlate', 'with', '-le ilişkili olmak'],
      ['deal', 'with', '-le ilgilenmek, ele almak'], ['faced', 'with', '-le karşı karşıya'], ['fraught', 'with', '-le dolu'], ['grapple', 'with', '-le boğuşmak'],
      ['account', 'for', '-i açıklamak; oluşturmak'], ['compensate', 'for', '-i telafi etmek'], ['substitute', 'for', '-in yerine geçmek'], ['responsible', 'for', '-den sorumlu'],
      ['demand', 'for', '-e talep'], ['need', 'for', '-e ihtiyaç'], ['reason', 'for', '-in sebebi'], ['preference', 'for', '-i tercih'],
      ['eligible', 'for', '-e uygun, hak sahibi'], ['notorious', 'for', '-le kötü şöhretli'], ['renowned', 'for', '-le ünlü'], ['strive', 'for', '-için çabalamak'],
      ['marvel', 'at', '-e hayret etmek'], ['adept', 'at', '-de usta'], ['glance', 'at', '-e göz atmak'],
    ].map(([w, p, tr]) => ({ w, p, tr }));

    function PrepositionGame({ readings, onAnswer, best, onBest }) {
      const [state, setState] = useState('idle');      // idle | playing | done
      const [tab, setTab] = useState('game');          // game | matrix
      const [selectedPrep, setSelectedPrep] = useState('to');
      const [left, setLeft] = useState(60);
      const [item, setItem] = useState(null);
      const [score, setScore] = useState(0);
      const [answered, setAnswered] = useState(0);
      const [combo, setCombo] = useState(0);
      const [wrong, setWrong] = useState([]);
      const [flash, setFlash] = useState(null);           // 'ok' | 'bad'
      const deck = useRef([]);

      // Kalıp sizin metinlerinizde geçiyorsa cümlesiyle sor
      const contexts = useRef(null);
      const findContext = (it) => {
        if (!contexts.current) contexts.current = readings.flatMap(r => splitSentences(plainText(r.content)));
        const re = new RegExp('\\b(' + escRe(it.w) + '[a-z]{0,3})\\s+' + it.p + '\\b', 'i');
        const s = contexts.current.find(x => re.test(x));
        if (!s) return null;
        const m = s.match(re);
        return { before: s.slice(0, m.index + m[1].length), after: s.slice(m.index + m[0].length) };
      };
      const next = () => {
        if (!deck.current.length) deck.current = shuffleArr(PREP_PAIRS);
        const it = deck.current.pop();
        setItem({ ...it, ctx: findContext(it) });
      };
      const start = () => { setScore(0); setAnswered(0); setCombo(0); setWrong([]); setLeft(60); deck.current = shuffleArr(PREP_PAIRS); setState('playing'); next(); };

      useEffect(() => {
        if (state !== 'playing') return;
        if (left <= 0) { setState('done'); if (score > (best || 0)) onBest(score); return; }
        const t = setTimeout(() => setLeft(l => l - 1), 1000);
        return () => clearTimeout(t);
      }, [state, left]);

      const pick = (p) => {
        if (state !== 'playing' || !item) return;
        const ok = p === item.p;
        setAnswered(a => a + 1);
        if (ok) { setScore(s => s + 1); setCombo(c => c + 1); }
        else { setCombo(0); setWrong(w => [...w, { ...item, picked: p }]); }
        onAnswer(ok);
        setFlash(ok ? 'ok' : 'bad');
        setTimeout(() => setFlash(null), 250);
        next();
      };

      // Klavye kısayolu: 1-8
      useEffect(() => {
        const onKey = (e) => { if (state === 'playing' && /^[1-8]$/.test(e.key)) pick(PREP_OPTIONS[+e.key - 1]); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      });

      if (state === 'idle' || state === 'done') {
        const prepItems = PREP_PAIRS.filter(x => x.p === selectedPrep);
        return (
          <div className="max-w-2xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">🎯 YÖKDİL Preposition Matrix & Çarkı</h3>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setTab('game')}
                  className={"px-3 py-1 rounded-lg text-xs font-bold transition " + (tab === 'game' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}
                >
                  ⚡ Hızlı Çark (60 sn)
                </button>
                <button
                  onClick={() => setTab('matrix')}
                  className={"px-3 py-1 rounded-lg text-xs font-bold transition " + (tab === 'matrix' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}
                >
                  📊 Preposition Matrix
                </button>
              </div>
            </div>

            {tab === 'matrix' ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">YÖKDİL sınavında en çok sorulan sabit edatlı yapıları kategori bazında inceleyin ve pekiştirin:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PREP_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => setSelectedPrep(p)}
                      className={"px-3 py-1.5 rounded-lg text-xs font-bold transition " + (selectedPrep === p ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800')}
                    >
                      {p} ({PREP_PAIRS.filter(x => x.p === p).length})
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {prepItems.map((it, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-black text-white">{it.w} <span className="text-indigo-400 font-bold">{it.p}</span></span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{it.tr}</p>
                      </div>
                      <button onClick={() => playWord({ english: it.w + ' ' + it.p })} className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-1 rounded bg-slate-800">🔊</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setTab('game'); start(); }} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500">
                  Şimdi Çarkı Başlat (Pratik Yap) →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">YÖKDİL kelime sorularının önemli kısmı edatlı kalıplardan gelir (attribute <b>to</b>, stem <b>from</b>, deprive <b>of</b>…). Kalıbı gör, doğru edatı olabildiğince hızlı seç. Kalıp metinlerinizde geçiyorsa orijinal cümleyle sorulur.</p>
                {state === 'done' && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <p className="text-2xl font-black text-white">{score} doğru <span className="text-sm text-slate-400">/ {answered} cevap · en iyi: {Math.max(best || 0, score)}</span></p>
                    {wrong.length > 0 && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        <p className="text-[11px] text-slate-500">Yanlışlarınız:</p>
                        {wrong.map((x, i) => <p key={i} className="text-xs text-slate-300"><b className="text-white">{x.w} <span className="text-emerald-400">{x.p}</span></b> = {x.tr} <span className="text-red-400 line-through ml-1">{x.picked}</span></p>)}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={start} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500">{state === 'done' ? 'Tekrar oyna' : 'Başla'}</button>
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className={"font-black text-lg " + (left <= 10 ? 'text-red-400' : 'text-white')}>⏱ {left}</span>
            <span className="text-slate-300">Doğru: <b className="text-emerald-400">{score}</b> {combo >= 3 && <span className="text-orange-400 font-bold ml-1">🔥 x{combo}</span>}</span>
          </div>
          <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500 transition-all" style={{ width: (left / 60 * 100) + '%' }} /></div>
          <div className={"p-6 rounded-2xl border text-center transition-colors " + (flash === 'ok' ? 'border-emerald-500 bg-emerald-950/30' : flash === 'bad' ? 'border-red-500 bg-red-950/30' : 'border-slate-800 bg-slate-950')}>
            {item && (item.ctx ? (
              <p className="text-base text-slate-100 font-serif leading-relaxed">{item.ctx.before} <span className="inline-block min-w-[3rem] border-b-2 border-blue-400 text-blue-300">&nbsp;?&nbsp;</span> {item.ctx.after}</p>
            ) : (
              <p className="text-3xl font-black text-white">{item.w} <span className="inline-block min-w-[3.5rem] border-b-4 border-blue-400 text-blue-300">?</span></p>
            ))}
            {item && item.ctx && <p className="text-[10px] text-slate-500 mt-2">Kalıp: <b className="text-slate-300">{item.w} ___</b> · sizin metninizden</p>}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PREP_OPTIONS.map((p, i) => (
              <button key={p} onClick={() => pick(p)} className="py-3 rounded-xl bg-slate-800 hover:bg-blue-600 text-white font-bold text-sm">
                {p}<span className="block text-[9px] font-normal text-slate-400">{i + 1}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setLeft(0)} className="text-xs text-slate-500 hover:text-slate-300">Bitir</button>
        </div>
      );
    }

    // Soru metnindeki bağlam ipuçlarını (bağlaç / geçiş ifadeleri) vurgula ve açıklamasını üret
    const CLUE_WORDS = (() => {
      const m = new Map();
      LINKER_LIST.forEach(L => m.set(L.w, L.cat));
      [['while', 'zıtlık'], ['but', 'zıtlık'], ['yet', 'zıtlık'], ['unlike', 'zıtlık'], ['rather than', 'zıtlık'], ['instead of', 'zıtlık'], ['so', 'sebep-sonuç'], ['thereby', 'sebep-sonuç'], ['accordingly', 'sebep-sonuç'], ['as well as', 'ekleme'], ['also', 'ekleme']].forEach(([w, c]) => { if (!m.has(w)) m.set(w, c); });
      return [...m.entries()].sort((a, b) => b[0].length - a[0].length);
    })();
    const CLUE_HINT = {
      'zıtlık': 'zıtlık bildirir → boşluğa gelen kelime, cümlenin öbür yarısıyla ZIT anlamlı olmalı',
      'sebep-sonuç': 'sebep-sonuç bildirir → boşluk, öbür yarının SONUCU ya da SEBEBİ olacak anlamda olmalı',
      'ekleme': 'ekleme bildirir → boşluk, önceki fikirle AYNI yönde olmalı',
      'benzerlik': 'benzerlik bildirir → boşluk, önceki fikre BENZER olmalı',
      'örnekleme': 'örnek verir → boşluk, verilen örnekleri KAPSAYAN genel bir kavram olmalı',
      'koşul': 'koşul bildirir → boşluk, koşul gerçekleşince/gerçekleşmeyince olacak durumu anlatır',
      'amaç': 'amaç bildirir → boşluk, ulaşılmak istenen hedefi anlatır',
    };
    function renderWithClues(text) {
      const found = [];
      const re = new RegExp('\\b(' + CLUE_WORDS.map(([w]) => escRe(w)).join('|') + ')\\b', 'gi');
      const parts = []; let last = 0, m;
      while ((m = re.exec(text))) {
        parts.push(text.slice(last, m.index));
        const w = m[0].toLowerCase(), cat = (CLUE_WORDS.find(([x]) => x === w) || [])[1];
        if (cat && !found.some(f => f.w === w)) found.push({ w, cat });
        parts.push(<b key={m.index} className="text-orange-300 bg-orange-500/10 rounded px-0.5">{m[0]}</b>);
        last = m.index + m[0].length;
      }
      parts.push(text.slice(last));
      return { nodes: parts, clues: found };
    }

