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

