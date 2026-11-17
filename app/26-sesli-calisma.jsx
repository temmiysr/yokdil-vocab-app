    // --- SESLİ ÇALIŞMA MODU (tarayıcının konuşma sentezi; İngilizce kelime → Türkçe anlam → örnek cümle) ---
    const speakAsync = (text, lang, rate) => new Promise(resolve => {
      if (!('speechSynthesis' in window) || !text) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = rate || 1;
      const v = window.speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish; u.onerror = finish;
      setTimeout(finish, 6000 + text.length * 150);           // bazı tarayıcılarda onend gelmeyebilir
      window.speechSynthesis.speak(u);
    });

    function AudioStudyModal({ cards, dueCards, onClose }) {
      const [source, setSource] = useState(dueCards.length ? 'due' : 'all');
      const [rate, setRate] = useState(0.9);
      const [withSentence, setWithSentence] = useState(true);
      const [loop, setLoop] = useState(false);
      const [shuffleOn, setShuffleOn] = useState(false);
      const [playing, setPlaying] = useState(false);
      const [idx, setIdx] = useState(0);
      const [phase, setPhase] = useState('');
      const run = useRef(0);

      const base = source === 'due' ? dueCards : source === 'difficult' ? cards.filter(c => c.isDifficult || (c.srs && c.srs.lapses >= 3)) : cards;
      const [order, setOrder] = useState(() => base.map(c => c.id));
      useEffect(() => { setOrder((shuffleOn ? shuffleArr(base) : base).map(c => c.id)); setIdx(0); stop(); }, [source, shuffleOn]);
      const list = order.map(id => cards.find(c => c.id === id)).filter(Boolean);
      const card = list[idx];
      const hasTr = typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices().some(v => /^tr/i.test(v.lang));

      const stop = () => { run.current++; setPlaying(false); setPhase(''); try { speechSynthesis.cancel(); } catch (e) {} };
      useEffect(() => () => stop(), []);

      const play = async (from) => {
        const my = ++run.current;
        setPlaying(true);
        const pause = (ms) => new Promise(r => setTimeout(r, ms / rate));
        for (let i = from; ; i++) {
          if (i >= list.length) { if (loop && list.length) i = 0; else break; }
          if (run.current !== my) return;
          setIdx(i);
          const c = list[i];
          setPhase('en'); await speakAsync(c.english, 'en-US', rate); if (run.current !== my) return;
          await pause(1200); if (run.current !== my) return;
          setPhase('tr'); await speakAsync(firstMeaning(c) || c.turkish, 'tr-TR', rate); if (run.current !== my) return;
          if (withSentence && c.originalSentence) {
            await pause(700); if (run.current !== my) return;
            setPhase('sentence'); await speakAsync(c.originalSentence, 'en-US', rate * 0.95); if (run.current !== my) return;
          }
          await pause(1500);
        }
        if (run.current === my) { setPlaying(false); setPhase(''); }
      };

      const jump = (d) => { const n = clampN(idx + d, 0, Math.max(0, list.length - 1)); stop(); setIdx(n); };

      return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-label="Sesli çalışma" className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center">
              <h3 className="font-bold text-base text-white mr-auto">🎧 Dinleyerek Çalış</h3>
              <button onClick={() => { stop(); onClose(); }} aria-label="Kapat" className="px-2 py-1 rounded-md text-slate-400 hover:bg-slate-800">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              {[['due', 'Bugünküler (' + dueCards.length + ')'], ['difficult', 'Zorlandıklarım'], ['all', 'Tümü (' + cards.length + ')']].map(([k, l]) => (
                <button key={k} onClick={() => setSource(k)} className={"px-2 py-1.5 rounded-lg font-bold " + (source === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}>{l}</button>
              ))}
            </div>

            <div className="text-center py-6 rounded-2xl bg-slate-950 border border-slate-800 min-h-[9rem] flex flex-col justify-center gap-1 px-4">
              {!card ? <p className="text-xs text-slate-500">Bu grupta kart yok.</p> : (
                <>
                  <p className={"text-2xl font-black " + (phase === 'en' ? 'text-white' : 'text-slate-300')}>{card.english}</p>
                  {card.okunus && <p className="text-[11px] text-amber-300">[{card.okunus}]</p>}
                  <p className={"text-base font-bold " + (phase === 'tr' ? 'text-blue-300' : 'text-blue-300/60')}>{card.turkish}</p>
                  {withSentence && card.originalSentence && <p className={"text-[11px] font-serif italic " + (phase === 'sentence' ? 'text-slate-200' : 'text-slate-500')}>"{card.originalSentence}"</p>}
                  <p className="text-[10px] text-slate-600 mt-1">{idx + 1} / {list.length}</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => jump(-1)} disabled={!card} aria-label="Önceki" className="w-10 h-10 rounded-full bg-slate-800 text-white disabled:opacity-40">⏮</button>
              <button onClick={() => playing ? stop() : play(idx)} disabled={!card} aria-label={playing ? 'Duraklat' : 'Oynat'} className="w-14 h-14 rounded-full bg-blue-600 text-white text-xl font-bold disabled:opacity-40">{playing ? '⏸' : '▶'}</button>
              <button onClick={() => jump(1)} disabled={!card} aria-label="Sonraki" className="w-10 h-10 rounded-full bg-slate-800 text-white disabled:opacity-40">⏭</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <label className="flex items-center gap-2">Hız
                <input type="range" min="0.6" max="1.3" step="0.1" value={rate} onChange={e => setRate(+e.target.value)} className="flex-1 accent-blue-500" />
                <span className="w-7 text-right">{rate.toFixed(1)}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={withSentence} onChange={e => setWithSentence(e.target.checked)} className="accent-blue-500" />Cümleyi de oku</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={shuffleOn} onChange={e => setShuffleOn(e.target.checked)} className="accent-blue-500" />Karıştır</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} className="accent-blue-500" />Bitince başa dön</label>
            </div>
            {!hasTr && <p className="text-[10px] text-amber-400">Cihazınızda Türkçe ses bulunamadı; Türkçe anlamlar varsayılan sesle okunabilir. (Windows: Ayarlar → Zaman ve dil → Konuşma → Türkçe ses ekleyin.)</p>}
          </div>
        </div>
      );
    }

