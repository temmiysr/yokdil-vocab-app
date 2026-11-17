    // --- YARDIMCI MODAL BİLEŞENLERİ ---
    function DailyReviewSession({ cards, onComplete, onRate, goal, doneToday, mode = 'en-tr', onMode }) {
      // Oturum başındaki liste sabitlenir (değerlendirilen kart listeden düşünce sıradaki kart atlanmasın)
      const [queue] = useState(() => cards);
      const [idx, setIdx] = useState(0);
      const [revealed, setRevealed] = useState(false);
      const [dragX, setDragX] = useState(0);
      const [dragY, setDragY] = useState(0);
      const touch = useRef(null);
      const card = queue[idx];
      const [typed, setTyped] = useState('');
      // Kartın bu turdaki türü: karışıkta kart ve sıraya göre değişir; cümlesi olmayan kart cümle türüne giremez
      const clozeSentence = (() => {
        if (!card) return { ok: false, text: '' };
        const lemma = String(card.lemma || card.english).toLowerCase();
        for (const s of [card.originalSentence, ...(card.examples || [])].filter(Boolean)) {
          const f = findForm(s, lemma);
          if (f) return { ok: true, text: s.slice(0, f.index) + '_____' + s.slice(f.index + f.form.length) };
        }
        return { ok: false, text: '' };
      })();
      const pickMixed = () => { const opts = ['en-tr', 'tr-en', 'listen'].concat(clozeSentence.ok ? ['cloze', 'cloze'] : []); let h = 0; for (const ch of String(card && card.id) + idx) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return opts[h % opts.length]; };
      const cardMode = !card ? 'en-tr' : mode === 'mixed' ? pickMixed() : mode === 'cloze' && !clozeSentence.ok ? 'tr-en' : mode;
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
      const typedOk = !!typed && [card && card.english, card && card.lemma].some(w => w && norm(w) === norm(typed));
      useEffect(() => { setTyped(''); if (card && cardMode === 'listen') setTimeout(() => playWord(card), 250); }, [idx, cardMode]);

      const handleRating = (rating) => {
        if (!card) return;
        triggerHaptic(35);
        onRate(card.id, rating);
        setRevealed(false); setDragX(0); setDragY(0);
        if (idx + 1 < queue.length) setIdx(idx + 1);
        else onComplete();
      };

      // Klavye: Boşluk = anlamı göster, 1-4 = değerlendir
      useEffect(() => {
        const onKey = (e) => {
          if (/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
          if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setRevealed(true); }
          else if (revealed && /^[1-4]$/.test(e.key)) handleRating(+e.key);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      });

      // Dokunmatik ve Kaydırma Jestleri (Mobile Swipe Gestures)
      const onTouchStart = (e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      };
      const onTouchMove = (e) => {
        if (touch.current != null) {
          const dx = e.touches[0].clientX - touch.current.x;
          const dy = e.touches[0].clientY - touch.current.y;
          setDragX(dx);
          setDragY(dy);
        }
      };
      const onTouchEnd = () => {
        if (!revealed) {
          // Kart kapalıyken hafifçe yukarı kaydırılırsa veya dokunulursa aç
          if (dragY < -40 || Math.abs(dragX) > 40) setRevealed(true);
        } else {
          // Anlam açıkken: Sağa = İyi (3), Sola = Tekrar (1), Yukarı = Kolay (4)
          // Titreşim (destekleyen telefonlarda): Tekrar = çift kısa, İyi = kısa, Kolay = uzun
          const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
          if (dragX > 70) {
            buzz(15); handleRating(3);
          } else if (dragX < -70) {
            buzz([20, 60, 20]); handleRating(1);
          } else if (dragY < -60 && Math.abs(dragY) > Math.abs(dragX)) {
            buzz(40); handleRating(4);
          }
        }
        setDragX(0);
        setDragY(0);
        touch.current = null;
      };

      if (!card) return null;
      const preview = [1, 2, 3, 4].map(g => fsrsNext(card.srs, g).interval);
      const isUp = dragY < -40 && Math.abs(dragY) > Math.abs(dragX);
      const swipeHint = dragX > 40 ? 'İyi →' : dragX < -40 ? '← Tekrar' : isUp ? '↑ Kolay' : '';
      const borderCls = dragX > 40 ? 'border-emerald-500 shadow-emerald-950/50' : dragX < -40 ? 'border-red-500 shadow-red-950/50' : isUp ? 'border-sky-400 shadow-sky-950/50' : 'border-slate-800';

      return (
        <div
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{
            transform: (dragX || (isUp && dragY)) ? `translate(${dragX}px, ${isUp ? dragY : 0}px) rotate(${dragX / 30}deg)` : undefined,
            transition: (dragX || dragY) ? 'none' : 'transform .2s ease-out'
          }}
          className={"bg-slate-950 p-6 sm:p-8 rounded-3xl border shadow-2xl text-center space-y-6 " + borderCls}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Kart {idx + 1} / {queue.length}</span>
            {goal > 0 && <span className={doneToday >= goal ? 'text-emerald-400' : ''}>🎯 Bugün {doneToday}/{goal}</span>}
          </div>
          {swipeHint && (
            <div className={"text-base font-black animate-pulse " + (dragX > 0 ? 'text-emerald-400' : dragX < 0 ? 'text-red-400' : 'text-sky-300')}>
              {swipeHint}
            </div>
          )}
          {/* Kart türü: İng→Tr (klasik), Tr→İng, cümlede boşluk, dinleyip yaz, karışık */}
          <div className="flex flex-wrap justify-center gap-1">
            {[['en-tr', 'İng → Tr'], ['tr-en', 'Tr → İng'], ['cloze', 'Cümlede boşluk'], ['listen', 'Dinle-yaz'], ['mixed', 'Karışık']].map(([k, l]) => (
              <button key={k} onClick={() => { onMode && onMode(k); setTyped(''); }} className={"px-2 py-0.5 rounded-full text-[10px] font-bold border " + (mode === k ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200')}>{l}</button>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300">{card.partOfSpeech}</span>
              {card.questionType && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                  {card.questionType.split(' ')[0]}
                </span>
              )}
              {cardMode !== 'en-tr' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{{ 'tr-en': 'Türkçe → İngilizce', cloze: 'Cümlede boşluk', listen: 'Dinle ve yaz' }[cardMode]}</span>}
            </div>
            {cardMode === 'en-tr' || revealed ? (
              <>
                <h2 className="text-3xl font-black text-white mt-2">{card.english}</h2>
                {card.ipa && <p className="text-xs text-slate-400 font-mono mt-1">/{card.ipa}/</p>}
                {card.okunus && <p className="text-xs text-amber-300 mt-0.5">[{card.okunus}]</p>}
                <button onClick={() => playWord(card)} className="mt-2 text-xs text-blue-400">🔊 Dinle</button>
              </>
            ) : cardMode === 'tr-en' ? (
              <p className="text-2xl font-bold text-blue-300 mt-3">{card.turkish}</p>
            ) : cardMode === 'cloze' ? (
              <div className="mt-3 space-y-1">
                <p className="text-base text-slate-100 font-serif leading-relaxed">{clozeSentence.text}</p>
                <p className="text-[11px] text-slate-500">İpucu: {card.english.charAt(0)}… ({card.english.length} harf){card.turkish && !isMissingMeaning(card) ? ' · ' + firstMeaning(card) : ''}</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <button onClick={() => playWord(card)} className="px-5 py-3 rounded-2xl bg-blue-600 text-white text-2xl">🔊</button>
                <p className="text-[11px] text-slate-500">Kelimeyi dinleyin ve yazın</p>
              </div>
            )}
            {cardMode !== 'en-tr' && (
              <div className="mt-3 max-w-xs mx-auto">
                <input value={typed} onChange={e => setTyped(e.target.value)} disabled={revealed} autoComplete="off" autoCapitalize="off" spellCheck={false}
                  onKeyDown={e => { if (e.key === 'Enter' && !revealed) { e.preventDefault(); e.stopPropagation(); setRevealed(true); } }}
                  placeholder="İngilizcesini yazın (isteğe bağlı)…" aria-label="Cevabınız"
                  className={"w-full px-3 py-2 rounded-lg bg-slate-900 border text-sm text-center text-white " + (!revealed ? 'border-slate-700' : typedOk ? 'border-emerald-500' : typed ? 'border-red-500' : 'border-slate-700')} />
                {revealed && typed && <p className={"text-[11px] mt-1 font-bold " + (typedOk ? 'text-emerald-400' : 'text-red-400')}>{typedOk ? '✓ Doğru yazdınız' : '✗ Doğrusu: ' + card.english}</p>}
              </div>
            )}
          </div>

          {revealed ? (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <p className="text-2xl font-bold text-blue-400">{card.turkish}</p>
              {card.originalSentence && (
                <p className="text-xs text-slate-300 font-serif italic">"{card.originalSentence}"</p>
              )}
              {(card.examples || []).slice(0, 2).map((ex, i) => <p key={i} className="text-[11px] text-slate-400 font-serif">• {ex}</p>)}
              {((card.synonyms || []).length > 0 || (card.antonyms || []).length > 0) && (
                <div className="text-[11px] space-y-0.5">
                  {(card.synonyms || []).length > 0 && <p><span className="text-slate-500">Eş anlamlı:</span> <span className="text-emerald-300">{card.synonyms.slice(0, 5).join(', ')}</span></p>}
                  {(card.antonyms || []).length > 0 && <p><span className="text-slate-500">Zıt anlamlı:</span> <span className="text-red-300">{card.antonyms.slice(0, 4).join(', ')}</span></p>}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[[1, 'Tekrar', 'bg-red-950/60 border-red-800 text-red-300'], [2, 'Zor', 'bg-amber-950/60 border-amber-800 text-amber-300'], [3, 'İyi', 'bg-blue-950/60 border-blue-800 text-blue-300'], [4, 'Kolay', 'bg-emerald-950/60 border-emerald-800 text-emerald-300']].map(([g, label, cls]) => (
                  <button key={g} onClick={() => handleRating(g)} className={"p-2.5 rounded-xl border text-xs font-bold " + cls}>
                    {label}<span className="block text-[10px] font-normal opacity-80">{g === 1 ? 'yarın' : formatInterval(preview[g - 1])}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                📱 Telefonda: <b>Sağa</b> = İyi, <b>Sola</b> = Tekrar, <b>Yukarı</b> = Kolay · ⌨ Klavye: 1-4
              </p>
            </div>
          ) : (
            <button onClick={() => setRevealed(true)} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg">
              Anlamını Göster <span className="opacity-60 font-normal">(boşluk veya yukarı kaydır)</span>
            </button>
          )}
        </div>
      );
    }


    // --- GÜNLÜK ÖĞRENME: önce öğretici kartlar, gün içinde o günün kelimelerinden sınav ---
    // Yeni eklenen kelime tekrar listesine doğrudan girmez: önce "Yeni kelimeleri öğren" oturumunda tanıtılır
    // (okunuş, anlam, örnek cümle, eş anlam + 5 kelimede bir kısa kontrol). Aynı gün "Günün kelime sınavı"nda
    // sorulur; sınav sonucu aralıklı tekrarı başlatır (iki soru da doğru → İyi, biri → Zor, hiçbiri → Tekrar).
    const isUnlearnedNew = (c) => !!c && !c.queued && !!c.srs && c.srs.state === 'new' && !c.srs.lastReviewedAt && !c.learnedAt;
    const needsQuizToday = (c) => !!c && c.learnedAt === getTodayStr() && c.quizzedAt !== getTodayStr();
    const learnPool = (cards) => cards.filter(c => isUnlearnedNew(c) && c.srs.nextReviewAt <= getTodayStr())
      .sort((a, b) => (a.queueOrder != null && b.queueOrder != null ? a.queueOrder - b.queueOrder : String(a.createdAt || '').localeCompare(String(b.createdAt || ''))));
    const highlightWord = (sentence, word) => {
      if (!sentence) return null;
      const f = findForm(sentence, String(word || '').toLowerCase());
      if (!f) return sentence;
      return <>{sentence.slice(0, f.index)}<b className="text-amber-300">{f.form}</b>{sentence.slice(f.index + f.form.length)}</>;
    };
    const meaningOptions = (card, allCards, n = 4) => {
      const right = firstMeaning(card);
      const others = [...new Set(allCards.filter(x => x.id !== card.id && !isMissingMeaning(x)).map(firstMeaning).filter(m => m && m !== right))];
      if (!right || others.length < n - 1) return null;
      const opts = shuffleArr([right, ...pickN(others, n - 1)]);
      return { opts, answer: opts.indexOf(right) };
    };

    function LearnSession({ cards, perDay, onLearn, onExit, onQuiz }) {
      const [batch] = useState(() => learnPool(cards).slice(0, perDay));
      const [idx, setIdx] = useState(0);
      const [phase, setPhase] = useState(batch.length ? 'teach' : 'empty');   // teach | check | done | empty
      const [checkList, setCheckList] = useState([]);
      const [checkIdx, setCheckIdx] = useState(0);
      const [picked, setPicked] = useState(null);
      const [learned, setLearned] = useState([]);
      const [known, setKnown] = useState([]);
      const [misses, setMisses] = useState([]);
      const card = batch[idx];
      useEffect(() => { if (phase === 'teach' && card) setTimeout(() => playWord(card), 300); }, [idx, phase]);
      const afterCard = (kind) => {
        const nl = kind === 'known' ? learned : [...learned, card.id];
        const nk = kind === 'known' ? [...known, card.id] : known;
        setLearned(nl); setKnown(nk);
        const last = idx + 1 >= batch.length;
        // 5 kelimede bir (ya da sonda) yeni öğrenilenlerin anlamını kısa kontrol
        const groupEnd = (idx + 1) % 5 === 0 || last;
        const group = batch.slice(Math.floor(idx / 5) * 5, idx + 1).filter(c => nl.includes(c.id));
        const qs = groupEnd ? group.map(c => ({ c, m: meaningOptions(c, cards) })).filter(x => x.m) : [];
        if (qs.length) { setCheckList(qs); setCheckIdx(0); setPicked(null); setPhase('check'); }
        else if (last) finish(nl, nk);
        else setIdx(idx + 1);
      };
      const finish = (nl, nk) => { onLearn(nl, nk); setPhase('done'); };
      const nextCheck = () => {
        if (checkIdx + 1 < checkList.length) { setCheckIdx(checkIdx + 1); setPicked(null); return; }
        if (idx + 1 >= batch.length) finish(learned, known);
        else { setIdx(idx + 1); setPhase('teach'); }
      };
      if (phase === 'empty') {
        return (
          <div className="max-w-xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
            <p className="text-3xl">🎉</p>
            <p className="text-sm text-slate-200 font-bold">Bugün öğrenilecek yeni kelime yok.</p>
            <p className="text-xs text-slate-400">Metinlerden kelime çıkarın, kelime listesi içe aktarın ya da "+ Kelime Ekle" ile yeni kelime ekleyin; ertesi sabah burada sizi bekler.</p>
            <button onClick={onExit} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Ana sayfa</button>
          </div>
        );
      }
      if (phase === 'done') {
        return (
          <div className="max-w-xl mx-auto bg-slate-950 p-6 rounded-2xl border border-emerald-800 text-center space-y-3">
            <p className="text-3xl">✅</p>
            <p className="text-base text-white font-black">{learned.length} yeni kelime öğrendiniz{known.length ? ', ' + known.length + ' tanesini zaten biliyordunuz' : ''}.</p>
            {misses.length > 0 && <p className="text-xs text-amber-300">Kontrolde karıştırdıklarınız: {misses.join(', ')} — akşam sınavında yeniden sorulacak.</p>}
            <p className="text-xs text-slate-400">Akşam "🌙 Günün kelime sınavı"nda bu kelimeleri farklı sorularla çözeceksiniz; sonuca göre tekrar günleri belirlenir. Hatırlatıcı açıksa bildirim gelir.</p>
            <div className="flex justify-center gap-2">
              {learned.length > 0 && <button onClick={onQuiz} className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white">Sınavı şimdi çöz</button>}
              <button onClick={onExit} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Ana sayfa</button>
            </div>
          </div>
        );
      }
      if (phase === 'check') {
        const { c, m } = checkList[checkIdx];
        return (
          <div className="max-w-xl mx-auto bg-slate-950 p-6 rounded-2xl border border-indigo-800 space-y-4">
            <p className="text-[11px] text-indigo-300 font-bold">🧠 Kısa kontrol {checkIdx + 1} / {checkList.length}</p>
            <p className="text-2xl font-black text-white text-center">{c.english}</p>
            <div className="grid gap-2">
              {m.opts.map((o, i) => (
                <button key={i} disabled={picked !== null} onClick={() => { setPicked(i); if (i !== m.answer) setMisses(x => x.includes(c.english) ? x : [...x, c.english]); }}
                  className={"text-left px-4 py-2.5 rounded-xl border text-sm " + (picked === null ? 'border-slate-700 hover:border-blue-500' : i === m.answer ? 'border-emerald-500 bg-emerald-600/15 text-emerald-200' : i === picked ? 'border-red-500 bg-red-600/15 text-red-200' : 'border-slate-800 text-slate-500')}>{o}</button>
              ))}
            </div>
            {picked !== null && <button onClick={nextCheck} className="w-full py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white">Devam →</button>}
          </div>
        );
      }
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button onClick={() => { if (learned.length || known.length) onLearn(learned, known); onExit(); }} className="hover:text-slate-200">✕ Ara ver</button>
            <span>📘 Yeni kelime {idx + 1} / {batch.length}</span>
          </div>
          <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: (idx / batch.length * 100) + '%' }} /></div>
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              {card.partOfSpeech && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300">{card.partOfSpeech}</span>}
              <AwlBadge word={card.lemma || card.english} />
              {card.listName && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{card.listName}</span>}
            </div>
            <h2 className="text-4xl font-black text-white">{card.english}</h2>
            {(card.ipa || card.okunus) && <p className="text-xs text-slate-400">{card.ipa && <span className="font-mono">/{card.ipa}/</span>}{card.okunus && <span className="text-amber-300 ml-1.5">[{card.okunus}]</span>}</p>}
            <button onClick={() => playWord(card)} className="text-xs text-blue-400">🔊 Tekrar dinle</button>
            <p className={"text-2xl font-bold " + (isMissingMeaning(card) ? 'text-amber-400' : 'text-blue-300')}>{isMissingMeaning(card) ? 'Anlamı eksik — Kelime Kartları\'ndan ekleyin' : card.turkish}</p>
            {card.definition && <p className="text-[11px] text-slate-400"><span className="text-slate-500">EN:</span> {card.definition}</p>}
            {[card.originalSentence, ...(card.examples || [])].filter(Boolean).slice(0, 2).map((s, i) => <p key={i} className="text-sm text-slate-200 font-serif italic">"{highlightWord(s, card.lemma || card.english)}"</p>)}
            {(card.synonyms || []).length > 0 && <p className="text-[11px]"><span className="text-slate-500">Eş anlamlı:</span> <span className="text-emerald-300">{card.synonyms.slice(0, 5).join(', ')}</span></p>}
            {(card.antonyms || []).length > 0 && <p className="text-[11px]"><span className="text-slate-500">Zıt anlamlı:</span> <span className="text-red-300">{card.antonyms.slice(0, 4).join(', ')}</span></p>}
            <p className="text-[11px] text-slate-500">İpucu: kelimeyi sesli tekrar edin ve örnek cümleyi bir kez yüksek sesle okuyun.</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => afterCard('known')} className="py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200">✓ Zaten biliyorum</button>
              <button onClick={() => afterCard('learn')} className="py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white">Öğrendim →</button>
            </div>
          </div>
        </div>
      );
    }

    // Günün kelime sınavı: o gün öğrenilen her kelime için iki soru (anlam + cümlede/Türkçeden)
    function buildWordQuiz(words, allCards) {
      const pool = allCards.filter(x => !isMissingMeaning(x) && /^[A-Za-z][A-Za-z -]*$/.test(x.lemma || x.english));
      const qs = [];
      words.forEach(c => {
        const m = meaningOptions(c, allCards, 5);
        if (m) qs.push({ cid: c.id, type: 'Anlam', prompt: '"' + c.english + '" ne demektir?', options: m.opts, answer: m.answer, explain: c.english + ' = ' + c.turkish });
        const lemma = String(c.lemma || c.english).toLowerCase();
        const sent = [c.originalSentence, ...(c.examples || [])].filter(Boolean).find(s => findForm(s, lemma));
        const others = pool.filter(x => x.id !== c.id && (x.lemma || x.english).toLowerCase() !== lemma);
        const samePos = others.filter(x => x.partOfSpeech === c.partOfSpeech);
        const distract = [...pickN(samePos, 4), ...pickN(others, 4)].map(x => x.lemma || x.english).filter((w, i, a) => a.indexOf(w) === i && w.toLowerCase() !== lemma).slice(0, 4);
        if (distract.length < 4) return;
        if (sent) {
          const f = findForm(sent, lemma);
          const opts = shuffleArr([lemma, ...distract]);
          qs.push({ cid: c.id, type: 'Cümlede', prompt: sent.slice(0, f.index) + '----' + sent.slice(f.index + f.form.length), options: opts, answer: opts.indexOf(lemma), explain: 'Cümledeki kelime: ' + f.form + ' (' + firstMeaning(c) + ')' });
        } else if (!isMissingMeaning(c)) {
          const opts = shuffleArr([lemma, ...distract]);
          qs.push({ cid: c.id, type: 'Türkçeden', prompt: '"' + firstMeaning(c) + '" anlamına gelen kelime hangisidir?', options: opts, answer: opts.indexOf(lemma), explain: lemma + ' = ' + c.turkish });
        }
      });
      // Aynı kelimenin iki sorusu art arda gelmesin
      const a = shuffleArr(qs);
      for (let i = 1; i < a.length; i++) if (a[i].cid === a[i - 1].cid) { const j = a.findIndex((q, k) => k > i && q.cid !== a[i].cid); if (j > 0) [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    function DailyWordQuiz({ cards, onFinish, onExit, onLearn }) {
      const [words] = useState(() => cards.filter(needsQuizToday));
      const [qs] = useState(() => buildWordQuiz(words, cards));
      const [idx, setIdx] = useState(0);
      const [picked, setPicked] = useState(null);
      const [res, setRes] = useState({});      // cid → [doğru, toplam]
      const [done, setDone] = useState(false);
      if (!words.length || !qs.length) {
        const unlearned = learnPool(cards).length;
        return (
          <div className="max-w-xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
            <p className="text-3xl">🌙</p>
            <p className="text-sm text-slate-200 font-bold">{cards.some(c => c.learnedAt === getTodayStr()) ? 'Bugünün kelime sınavını tamamladınız.' : 'Bugün henüz yeni kelime öğrenmediniz.'}</p>
            {unlearned > 0 && <button onClick={onLearn} className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white">📘 {Math.min(unlearned, 99)} yeni kelimeyi öğren</button>}
            <button onClick={onExit} className="ml-2 px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Ana sayfa</button>
          </div>
        );
      }
      const finish = (r) => {
        const grades = words.map(c => { const [ok, n] = r[c.id] || [0, 0]; return { id: c.id, grade: n === 0 ? 3 : ok === n ? 3 : ok > 0 ? 2 : 1, ok, n }; });
        onFinish(grades);
        setDone(true);
      };
      if (done) {
        const tot = Object.values(res).reduce((a, [o, n]) => [a[0] + o, a[1] + n], [0, 0]);
        const weak = words.filter(c => { const r = res[c.id] || [0, 0]; return r[1] && r[0] < r[1]; });
        return (
          <div className="max-w-xl mx-auto bg-slate-950 p-6 rounded-2xl border border-indigo-800 space-y-3">
            <p className="text-lg font-black text-white">🌙 Günün kelime sınavı: {tot[0]} / {tot[1]}</p>
            <p className="text-xs text-slate-400">Tam bilinen kelimeler birkaç gün sonra, karıştırılanlar yarın yeniden sorulacak.</p>
            {weak.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-amber-300 font-bold">Tekrar edilecekler:</p>
                {weak.map(c => <p key={c.id} className="text-xs text-slate-300"><b className="text-white">{c.english}</b> — {c.turkish}</p>)}
              </div>
            )}
            <button onClick={onExit} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Ana sayfa</button>
          </div>
        );
      }
      const q = qs[idx];
      return (
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button onClick={onExit} className="hover:text-slate-200">✕ Çık</button>
            <span>🌙 Günün kelime sınavı · {idx + 1} / {qs.length} · <span className="text-indigo-300">{q.type}</span></span>
          </div>
          <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: (idx / qs.length * 100) + '%' }} /></div>
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <p className="text-base text-slate-100 font-serif leading-relaxed">{q.prompt}</p>
            <div className="grid gap-2">
              {q.options.map((o, i) => (
                <button key={i} disabled={picked !== null} onClick={() => { setPicked(i); setRes(r => { const p = r[q.cid] || [0, 0]; return { ...r, [q.cid]: [p[0] + (i === q.answer ? 1 : 0), p[1] + 1] }; }); }}
                  className={"text-left px-4 py-2.5 rounded-xl border text-sm " + (picked === null ? 'border-slate-700 hover:border-blue-500' : i === q.answer ? 'border-emerald-500 bg-emerald-600/15 text-emerald-200' : i === picked ? 'border-red-500 bg-red-600/15 text-red-200' : 'border-slate-800 text-slate-500')}>
                  <b className="mr-2">{EXAM_LETTERS[i]})</b>{o}
                </button>
              ))}
            </div>
            {picked !== null && (
              <>
                <p className={"text-xs " + (picked === q.answer ? 'text-emerald-300' : 'text-red-300')}>{picked === q.answer ? '✓ Doğru' : '✗ Yanlış'} · {q.explain}</p>
                <button onClick={() => { if (idx + 1 < qs.length) { setIdx(idx + 1); setPicked(null); } else finish(res); }} className="w-full py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white">{idx + 1 < qs.length ? 'Sonraki →' : 'Sonucu gör'}</button>
              </>
            )}
          </div>
        </div>
      );
    }

    // --- HATIRLATICI BİLDİRİMLERİ ---
    // 1) Uygulama açıkken: belirlenen saatte bu cihaza bildirim (service worker ile; telefonda da görünür).
    // 2) Android'de uygulama ana ekrana eklendiyse: tarayıcı izin verdikçe günde bir arka plan hatırlatması (periodic sync).
    // 3) Uygulama kapalıyken telefona kesin bildirim: GitHub Actions + Telegram botu (sabah 09.00, akşam 20.00).
    function showStudyNotification(title, body, go) {
      const opts = { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'yokdil-' + go, data: { url: './?go=' + go } };
      const fallback = () => { try { new Notification(title, opts); } catch (e) {} };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts)).catch(fallback);
      } else fallback();
    }
    async function enableDeviceReminders() {
      if (typeof Notification === 'undefined') return { ok: false, msg: 'Bu tarayıcı bildirimleri desteklemiyor. Telefonda Chrome (Android) ya da ana ekrana eklenmiş uygulama (iPhone, iOS 16.4+) kullanın.' };
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return { ok: false, msg: 'Bildirim izni verilmedi. Tarayıcı ayarlarından bu site için bildirimlere izin verebilirsiniz.' };
      let periodic = false;
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.periodicSync) {
          const st = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => null);
          if (!st || st.state === 'granted') { await reg.periodicSync.register('yokdil-daily', { minInterval: 6 * 60 * 60 * 1000 }); periodic = true; }
        }
      } catch (e) {}
      return { ok: true, periodic };
    }

    function ReminderSettings({ settings, setSettings }) {
      const [msg, setMsg] = useState('');
      const perm = typeof Notification === 'undefined' ? 'yok' : Notification.permission;
      const repoSecrets = 'https://github.com/temmiysr/yokdil-vocab-app/settings/secrets/actions';
      return (
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-base text-white">⏰ Günlük çalışma ve hatırlatıcılar</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="text-slate-300">Günde öğrenilecek yeni kelime
              <input type="number" min="3" max="50" value={settings.learnPerDay || 10} onChange={e => setSettings(s => ({ ...s, learnPerDay: clampN(+e.target.value || 10, 3, 50) }))} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white" />
            </label>
            <label className="text-slate-300">Sabah: yeni kelimeler
              <input type="time" value={settings.morningTime || '09:00'} onChange={e => setSettings(s => ({ ...s, morningTime: e.target.value }))} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white" />
            </label>
            <label className="text-slate-300">Akşam: günün sınavı
              <input type="time" value={settings.eveningTime || '20:00'} onChange={e => setSettings(s => ({ ...s, eveningTime: e.target.value }))} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white" />
            </label>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300">
            <p className="font-bold text-white">📱 Bu cihazda bildirim</p>
            <p className="text-[11px] text-slate-400">Uygulama (ya da sekmesi) açıkken saatinde bildirim gelir. Android'de uygulamayı ana ekrana eklerseniz tarayıcı izin verdikçe kapalıyken de günde bir hatırlatma gösterebilir; bu, telefonun pil ayarlarına bağlıdır.</p>
            <div className="flex flex-wrap items-center gap-2">
              {settings.remindersOn && perm === 'granted'
                ? <span className="text-emerald-400 font-bold">✓ Açık</span>
                : <button onClick={async () => { const r = await enableDeviceReminders(); setMsg(r.ok ? 'Bildirimler açıldı' + (r.periodic ? '; arka plan hatırlatması da kuruldu.' : '.') : r.msg); if (r.ok) setSettings(s => ({ ...s, remindersOn: true })); }} className="px-3 py-1.5 rounded-lg bg-blue-600 font-bold text-white">Bildirimleri aç</button>}
              {settings.remindersOn && <button onClick={() => showStudyNotification('🔔 YÖKDİL Master', 'Hatırlatıcılar çalışıyor. Sabah ' + (settings.morningTime || '09:00') + ', akşam ' + (settings.eveningTime || '20:00') + '.', 'learn')} className="px-3 py-1.5 rounded-lg bg-slate-800 font-bold text-slate-200">Deneme bildirimi</button>}
              {settings.remindersOn && <button onClick={() => setSettings(s => ({ ...s, remindersOn: false }))} className="text-slate-500 hover:text-slate-300">Kapat</button>}
            </div>
            {msg && <p className="text-[11px] text-amber-200">{msg}</p>}
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300">
            <p className="font-bold text-white">✈️ Uygulama kapalıyken telefona bildirim (Telegram, ücretsiz)</p>
            <p className="text-[11px] text-slate-400">GitHub her gün sabah 09.00'da "yeni kelimeler" ve akşam 20.00'de "günün kelime sınavı" mesajını Telegram botunuzdan telefonunuza gönderir; mesajdaki bağlantı uygulamayı doğrudan o ekranda açar. Bir kez kurulur:</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-[11px] text-slate-300">
              <li>Telegram'da <b>@BotFather</b>'a /newbot yazıp bir bot oluşturun; verilen <b>token</b>'ı kopyalayın. Botunuza girip /start deyin.</li>
              <li><b>@userinfobot</b>'tan kendi <b>Chat ID</b>'nizi öğrenin.</li>
              <li>Aşağıdaki alanlara yazıp "Test Bildirimi Gönder" ile deneyin.</li>
              <li><a href={repoSecrets} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">GitHub → depo ayarları → Secrets</a> sayfasında "New repository secret" ile <code className="text-amber-200">TELEGRAM_BOT_TOKEN</code> ve <code className="text-amber-200">TELEGRAM_CHAT_ID</code> ekleyin. Bundan sonra mesajlar her gün kendiliğinden gelir.</li>
            </ol>
            <p className="text-[10px] text-slate-500">Token gizlidir: yalnızca bu tarayıcıda ve GitHub'ın şifreli Secrets bölümünde durur; buluta ve yedeğe gönderilmez. Saatleri değiştirmek isterseniz söylemeniz yeterli (GitHub zamanlayıcısı birkaç dakika gecikebilir).</p>
          </div>
        </div>
      );
    }
