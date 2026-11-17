    // --- YÜKLENEN ÇIKMIŞ SINAVI ÇÖZME (gerçek sınav düzeni) ---
    // Serbest gezinme, işaretleme, süre; cevap anahtarı olmayan sorular puanlanmaz; sonda bölüm bölüm analiz ve tahmini puan.
    function RealExamRunner({ exam, section, readings, cards, exams, onExit, onFinish, onSetAnswer, onPractice, initialPicked, paper }) {
      const qsList = useMemo(() => (exam.questions || []).filter(q => section == null || qSection(q) === section).sort((a, b) => a.num - b.num), [exam, section]);
      // Süre: tam sınav 180 dk; kısa denemelerde soru sayısıyla orantılı (80 soru = 180 dk)
      const totalSec = section == null ? Math.max(10 * 60, Math.round(180 * 60 * Math.min(80, qsList.length) / 80 / 60) * 60) : Math.max(5 * 60, Math.ceil(qsList.length * 2.25) * 60);
      const [idx, setIdx] = useState(0);
      const [picked, setPicked] = useState(() => initialPicked || {});   // num → şık (kâğıttan girilen cevaplar da olabilir)
      const [flags, setFlags] = useState({});
      const [endAt] = useState(() => Date.now() + totalSec * 1000);
      const [startAt] = useState(() => Date.now());
      const [now, setNow] = useState(Date.now());
      const [result, setResult] = useState(null);
      const [reviewFilter, setReviewFilter] = useState('wrong');
      const [openTools, setOpenTools] = useState({});     // num → 'similar' | 'meanings'
      useEffect(() => { if (result) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [result]);
      // Soru başına süre: ekranda kalınan süre toplanır (soruya geri dönülürse eklenir)
      const timesRef = useRef({});
      const enterRef = useRef(Date.now());
      const [times, setTimes] = useState(null);
      const flushTime = () => {
        const q = qsList[idx];
        if (q) timesRef.current[q.num] = (timesRef.current[q.num] || 0) + (Date.now() - enterRef.current) / 1000;
        enterRef.current = Date.now();
      };
      const goTo = (i) => { flushTime(); setIdx(i); };
      const remaining = Math.max(0, Math.round((endAt - now) / 1000));
      const finish = () => {
        const rows = qsList.map(q => {
          const my = picked[q.num];
          const graded = q.answer >= 0;
          return { num: q.num, section: qSection(q), my: my === undefined ? -1 : my, graded, ok: graded && my === q.answer, empty: my === undefined };
        });
        flushTime();
        const tm = paper ? null : Object.fromEntries(Object.entries(timesRef.current).map(([k, v]) => [k, Math.round(v)]));
        setTimes(tm);
        const attempt = { at: new Date().toISOString(), section: section == null ? 'all' : section, durationSec: Math.round((Date.now() - startAt) / 1000), answers: Object.fromEntries(rows.filter(r => !r.empty).map(r => [r.num, r.my])), ...(tm ? { times: tm } : {}), ...(paper ? { paper: true } : {}) };
        setResult(rows);
        onFinish && onFinish(attempt, rows);
      };
      useEffect(() => { if (!result && remaining === 0) finish(); }, [remaining]);
      // Kâğıttan girilen cevaplar: hemen puanla
      useEffect(() => { if (paper) finish(); }, []);
      // Klavye: ←/→ gezinme, A-E şık
      useEffect(() => {
        if (result) return;
        const h = (e) => {
          if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
          if (e.key === 'ArrowRight') goTo(Math.min(qsList.length - 1, idx + 1));
          else if (e.key === 'ArrowLeft') goTo(Math.max(0, idx - 1));
          else { const L = EXAM_LETTERS.indexOf(e.key.toUpperCase()); if (L >= 0 && qsList[idx]) setPicked(p => ({ ...p, [qsList[idx].num]: L })); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
      }, [result, idx, qsList]);

      if (!qsList.length) return <div className="max-w-2xl mx-auto p-6 text-center text-sm text-slate-300">Bu bölümde soru yok. <button onClick={onExit} className="text-blue-400 underline">Geri</button></div>;

      if (result) {
        const live = result.map(r => { const lq = qsList.find(x => x.num === r.num); const graded = !!lq && lq.answer >= 0; return { ...r, graded, ok: graded && r.my === lq.answer }; });
        const bySection = examSections({ questions: qsList }).map(s => {
          const r = live.filter(x => x.num >= s.from && x.num <= s.to);
          return { ...s, n: r.length, ok: r.filter(x => x.ok).length, wrong: r.filter(x => x.graded && !x.ok && !x.empty).length, empty: r.filter(x => x.empty).length, ungraded: r.filter(x => !x.graded).length };
        }).filter(s => s.n);
        const graded = live.filter(x => x.graded).length, ok = live.filter(x => x.ok).length;
        const fullExam = section == null && qsList.length >= 70;
        // Süre analizi
        const fmtSec = (s) => s >= 60 ? Math.floor(s / 60) + ' dk ' + (s % 60) + ' sn' : s + ' sn';
        const tOf = (num) => (times || {})[num] || 0;
        const secTime = (s) => { const qs = qsList.filter(q => qSection(q) === s.label); const tot = qs.reduce((a, q) => a + tOf(q.num), 0); return times && qs.length ? Math.round(tot / qs.length) : null; };
        const slowest = times ? [...qsList].sort((a, b) => tOf(b.num) - tOf(a.num)).slice(0, 3).filter(q => tOf(q.num) > 0) : [];
        const slowSec = times ? bySection.filter(s => secTime(s) != null).sort((a, b) => secTime(b) - secTime(a))[0] : null;
        const used = Math.round((Date.now() - startAt) / 1000);
        const shown = qsList.filter(q => {
          const r = live.find(x => x.num === q.num);
          if (reviewFilter === 'wrong') return r.graded && !r.ok;
          if (reviewFilter === 'ungraded') return !r.graded;
          return true;
        });
        return (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-black text-lg text-white">{exam.title}{section != null ? ' · ' + section : ''}</h3>
                <span className="text-xs text-slate-400">{paper ? "📝 Kâğıt üzerinde çözüldü" : "Süre: " + Math.floor(used / 60) + " dk " + (used % 60) + " sn"}</span>
              </div>
              {graded > 0 ? (
                <div className="flex flex-wrap gap-3 items-end">
                  <div><p className="text-[10px] text-slate-400">Doğru</p><p className="text-2xl font-black text-emerald-400">{ok}<span className="text-sm text-slate-500"> / {graded}</span></p></div>
                  <div><p className="text-[10px] text-slate-400">Başarı</p><p className="text-2xl font-black text-white">%{Math.round(ok / graded * 100)}</p></div>
                  {fullExam && <div><p className="text-[10px] text-slate-400">Tahmini YÖKDİL puanı</p><p className="text-2xl font-black text-indigo-300">{(ok * 1.25).toFixed(2)}<span className="text-sm text-slate-500"> / 100</span></p></div>}
                  <p className="text-[10px] text-slate-500 w-full">YÖKDİL'de her soru 1,25 puandır ve yanlışlar doğruları götürmez.{graded < live.length ? ' Cevap anahtarı olmayan ' + (live.length - graded) + ' soru puanlanmadı.' : ''}</p>
                </div>
              ) : <p className="text-sm text-amber-300">Bu sınavın cevap anahtarı girilmemiş; sorular puanlanamadı. Aşağıdan doğru cevapları işaretleyebilir ya da sınav kartındaki "🔑 Anahtar" ile toplu girebilirsiniz.</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-slate-500 text-left"><th className="py-1">Bölüm</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Anahtarsız</th><th title="Soru başına ortalama süre">Ort. süre</th><th className="w-24">Başarı</th></tr></thead>
                  <tbody>
                    {bySection.map(s => {
                      const g = s.n - s.ungraded, pct = g ? Math.round(s.ok / g * 100) : null;
                      return (
                        <tr key={s.label} className="border-t border-slate-800 text-slate-300">
                          <td className="py-1.5">{s.label} <span className="text-slate-600">({s.from}-{s.to})</span></td>
                          <td className="text-emerald-400 font-bold">{s.ok}</td><td className="text-red-400">{s.wrong}</td><td className="text-slate-400">{s.empty}</td><td className="text-slate-500">{s.ungraded}</td><td className="text-slate-400">{secTime(s) == null ? "—" : fmtSec(secTime(s))}</td>
                          <td>{pct == null ? '—' : <div className="flex items-center gap-1"><div className="flex-1 h-1.5 rounded bg-slate-800"><div className={"h-full rounded " + (pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: pct + '%' }} /></div><span className="w-8 text-right">%{pct}</span></div>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {slowSec && slowest.length > 0 && (
                <p className="text-[11px] text-sky-200">⏱ En çok zaman harcadığınız bölüm: <b>{slowSec.label}</b> (soru başına {fmtSec(secTime(slowSec))}). En uzun süren sorular: {slowest.map(q => q.num + '. soru ' + fmtSec(Math.round(tOf(q.num)))).join(' · ')}. Gerçek sınavda soru başına ortalama 2 dk 15 sn düşer.</p>
              )}
              {bySection.filter(s => s.n - s.ungraded >= 3).length > 1 && (() => {
                const weak = bySection.filter(s => s.n - s.ungraded >= 3).sort((a, b) => a.ok / (a.n - a.ungraded) - b.ok / (b.n - b.ungraded))[0];
                return <p className="text-[11px] text-amber-200">💡 En çok zorlandığınız bölüm: <b>{weak.label}</b>. Yanlışlarınızın altındaki "Benzer soru üret" ile bu tipte alıştırma yapabilirsiniz.</p>;
              })()}
              <div className="flex gap-2">
                <button onClick={onExit} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">← Sınavlarım</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {[['wrong', 'Yanlış ve boşlarım'], ['ungraded', 'Anahtarsız sorular'], ['all', 'Tüm sorular']].map(([k, l]) => (
                <button key={k} onClick={() => setReviewFilter(k)} className={"px-3 py-1.5 rounded-lg font-bold " + (reviewFilter === k ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300')}>{l}</button>
              ))}
            </div>
            {shown.length === 0 && <p className="text-xs text-slate-500">Bu filtrede soru yok.</p>}
            {shown.map(q => {
              const r = live.find(x => x.num === q.num);
              const tool = openTools[q.num];
              const shortOpts = q.options.every(o => o && o.split(/\s+/).length <= 3);
              return (
                <div key={q.num} className={"p-4 rounded-2xl bg-slate-950 border space-y-2 " + (r.ok ? 'border-emerald-900/60' : r.graded ? 'border-red-900/60' : 'border-slate-800')}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white">Soru {q.num}</span>
                    <span className="text-indigo-400">{qSection(q)}</span>
                  </div>
                  {q.passage && <details className="text-[11px] text-slate-400"><summary className="cursor-pointer text-amber-300/80">📖 Parçayı göster</summary><p className="font-serif whitespace-pre-wrap mt-1">{q.passage}</p></details>}
                  {q.prompt && <p className="text-sm text-slate-100 font-serif">{q.prompt}</p>}
                  <div className="grid gap-1">
                    {q.options.map((o, i) => (
                      <div key={i} className={"px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 " + (i === q.answer ? 'border-emerald-600 bg-emerald-600/10 text-emerald-200' : i === r.my ? 'border-red-600 bg-red-600/10 text-red-200' : 'border-slate-800 text-slate-400')}>
                        <b>{EXAM_LETTERS[i]})</b><span className="flex-1">{o}</span>
                        {i === r.my && <span className="text-[10px]">sizin</span>}
                        {q.answer < 0 && <button type="button" onClick={() => onSetAnswer(q.num, i)} className="text-[10px] text-amber-300 hover:underline">doğru bu</button>}
                      </div>
                    ))}
                  </div>
                  {r.empty && <p className="text-[11px] text-slate-500">Boş bıraktınız.</p>}
                  {q.explanation && <p className="text-[11px] text-sky-200 bg-sky-950/30 border border-sky-900/40 rounded-lg px-2.5 py-1.5">💡 {q.explanation}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {shortOpts && <button type="button" onClick={() => setOpenTools({ ...openTools, [q.num]: tool === 'meanings' ? null : 'meanings' })} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300">🔍 Şıkların anlamları</button>}
                    <button type="button" onClick={() => setOpenTools({ ...openTools, [q.num]: tool === 'similar' ? null : 'similar' })} className="px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-800 text-[11px] font-bold text-indigo-200">🔁 Benzer soru üret / çöz</button>
                  </div>
                  <GrammarTopicPanel q={q} readings={readings} onPractice={onPractice} />
                  {tool === 'meanings' && <OptionMeanings options={q.options} />}
                  {tool === 'similar' && (
                    <SimilarPanel q={{ ...q, type: qSection(q), section: qSection(q) }} meta={{ field: exam.field }}
                      readings={readings} cards={cards} exams={exams} onPractice={onPractice}
                      onSetAnswer={(i) => onSetAnswer(q.num, i)} />
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      const q = qsList[idx];
      const my = picked[q.num];
      const answeredN = Object.keys(picked).length;
      // Bölüm başlığı (gerçek kitapçıktaki talimat satırı) ve aynı parçayı paylaşan sorular
      const sec = examSections({ questions: qsList }).find(s => s.label === qSection(q));
      const group = q.passage ? qsList.filter(x => x.passage === q.passage) : [];
      // Cloze parçasında şu anki boşluğu vurgula: "(23) ----"
      const passageNodes = q.passage ? q.passage.split(new RegExp('(\\(' + q.num + '\\)\\s*-{3,})')).map((part, i) =>
        i % 2 === 1 ? <mark key={i} className="bg-amber-400/30 text-amber-100 rounded px-0.5 font-bold">{part}</mark> : part) : null;
      const optionsAndNav = (
        <>
          <p className="text-sm text-slate-100 font-serif leading-relaxed whitespace-pre-wrap"><b className="text-slate-400 mr-1">{q.num}.</b>{q.prompt || (q.passage ? '(Parçadaki (' + q.num + ') numaralı boşluk)' : '')}</p>
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => setPicked(p => { const n = { ...p }; if (n[q.num] === i) delete n[q.num]; else n[q.num] = i; return n; })}
                className={"w-full text-left px-4 py-2.5 rounded-xl border text-sm transition " + (my === i ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-slate-700 hover:border-blue-500 hover:bg-slate-900 text-slate-200')}>
                <b className="mr-2">{EXAM_LETTERS[i]})</b>{o}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button disabled={idx === 0} onClick={() => goTo(idx - 1)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-200 disabled:opacity-30">← Önceki</button>
            <button onClick={() => setFlags(f => ({ ...f, [q.num]: !f[q.num] }))} className={"text-xs " + (flags[q.num] ? 'text-amber-300' : 'text-slate-500 hover:text-amber-300')}>⚑ {flags[q.num] ? 'İşaretli' : 'Sonra bak'}</button>
            {idx + 1 < qsList.length
              ? <button onClick={() => goTo(idx + 1)} className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white">Sonraki →</button>
              : <button onClick={() => { if (answeredN === qsList.length || window.confirm((qsList.length - answeredN) + ' soru boş. Sınav bitirilsin mi?')) finish(); }} className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white">Sınavı bitir</button>}
          </div>
        </>
      );
      return (
        <div className={(q.passage ? 'max-w-6xl' : 'max-w-3xl') + " mx-auto space-y-3"}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button onClick={() => { if (window.confirm('Sınavdan çıkılsın mı? Cevaplarınız kaydedilmez.')) onExit(); }} className="hover:text-slate-200">✕ Çık</button>
            <span className="truncate px-2">{exam.title}</span>
            <span className={"font-black text-sm " + (remaining <= 300 ? 'text-red-400' : 'text-indigo-300')}>⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
          </div>
          {/* Soru haritası: bölümlere ayrılmış */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {examSections({ questions: qsList }).map(s => (
              <div key={s.label} className="flex flex-wrap items-center gap-1">
                <span className={"text-[9px] font-bold uppercase tracking-wide mr-0.5 " + (s.label === qSection(q) ? 'text-blue-300' : 'text-slate-600')}>{s.label}</span>
                {qsList.filter(x => qSection(x) === s.label).map(x => {
                  const i = qsList.indexOf(x);
                  return (
                    <button key={x.num} onClick={() => goTo(i)} title={'Soru ' + x.num}
                      className={"w-7 h-7 rounded text-[10px] font-bold border " + (i === idx ? 'border-blue-400 text-white bg-blue-600' : flags[x.num] ? 'border-amber-500 text-amber-300 bg-amber-950/40' : picked[x.num] !== undefined ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-800 text-slate-500 bg-slate-950')}>
                      {x.num}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Bölüm talimatı: "21. – 30. sorularda, …" */}
          {sec && (
            <div className="px-4 py-2 rounded-xl bg-slate-800/70 border border-slate-700 text-[12px] text-slate-200">
              <b>{sec.from}{sec.to !== sec.from ? '. – ' + sec.to : ''}. sorularda,</b> {(SECTION_INSTRUCTIONS[sec.label] || '').replace(/^./, c => c.toLocaleLowerCase('tr'))}
            </div>
          )}
          {q.passage ? (
            // Uzun parça + soru: geniş ekranda yan yana (kitapçık düzeni), telefonda alt alta
            <div className="grid md:grid-cols-2 gap-3 items-start">
              <div className="md:sticky md:top-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-amber-300/80 mb-2">
                  📖 {group.length > 1 ? group[0].num + ' – ' + group[group.length - 1].num + '. sorular bu parçaya göre' : 'Parça'}
                </p>
                <div className="max-h-[38vh] md:max-h-[70vh] overflow-y-auto pr-1 text-[15px] text-slate-200 font-serif leading-7 whitespace-pre-wrap">{passageNodes}</div>
              </div>
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">{optionsAndNav}</div>
            </div>
          ) : (
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">{optionsAndNav}</div>
          )}
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{answeredN} / {qsList.length} cevaplandı · klavye: A–E şık, ←/→ gezinme</span>
            <button onClick={() => { if (window.confirm((qsList.length - answeredN) ? (qsList.length - answeredN) + ' soru boş. Sınav bitirilsin mi?' : 'Sınav bitirilsin mi?')) finish(); }} className="text-emerald-400 hover:underline font-bold">Teslim et</button>
          </div>
        </div>
      );
    }

    function ExamSection({ cards, readings, customExams = [], onOpenUploadExam, onDeleteExam, onUpdateExam, onExamFinished, onExtractVocabFromExam, onShareExam, onOpenLibrary, onMistakeResult, onPassagesToReadings, onCreateExam, onMarkDifficult, onAnswer, prepBest, onPrepBest, preset, onPresetUsed, onCheckupDone }) {
      const [examTab, setExamTab] = useState('generator'); // 'generator' | 'uploaded'
      const [mode, setMode] = useState('mixed');
      const [count, setCount] = useState(10);
      const [qs, setQs] = useState(null);
      const [idx, setIdx] = useState(0);
      const [picked, setPicked] = useState({});          // soru index → seçilen şık
      const [marked, setMarked] = useState(false);
      const [prepOpen, setPrepOpen] = useState(false);
      const [transOpen, setTransOpen] = useState(false);
      const [timed, setTimed] = useState(null);           // { endAt, total } süreli haftalık check-up
      const [now, setNow] = useState(Date.now());
      const reported = useRef(false);

      const build = (opts) => {
        const m = (opts && opts.mode) || mode, n = (opts && opts.count) || count;
        if (m === 'prep') { setPrepOpen(true); return; }
        if (m === 'translate') { setTransOpen(true); return; }
        const per = m === 'mixed' ? Math.ceil(n / 4) + 1 : n;
        let list = [];
        if (m === 'mixed' || m === 'vocab') list = list.concat(genVocabQuestions(cards, per));
        if (m === 'mixed' || m === 'linker') list = list.concat(genLinkerQuestions(readings, per));
        if (m === 'mixed' || m === 'irrelevant') list = list.concat(genIrrelevantQuestions(readings, m === 'mixed' ? Math.max(1, Math.floor(per / 2)) : per));
        if (m === 'mixed' || m === 'meaning') list = list.concat(genMeaningQuestions(cards, per));
        if (m === 'mixed' || m === 'synonym') list = list.concat(genSynonymQuestions(cards, per));
        list = m === 'mixed' ? shuffleArr(list).slice(0, n) : list.slice(0, n);
        setQs(list); setIdx(0); setPicked({}); setMarked(false); reported.current = false;
        setTimed(opts && opts.seconds && list.length ? { endAt: Date.now() + opts.seconds * 1000, total: opts.seconds } : null);
      };

      // Yüklenen sınav: gerçek sınav düzeninde çözülür (RealExamRunner)
      // Yeni sınav eklenince "Çıkmış Sınavlarım" sekmesine geç
      const examCountRef = useRef(customExams.length);
      useEffect(() => {
        if (customExams.length > examCountRef.current) setExamTab('uploaded');
        examCountRef.current = customExams.length;
      }, [customExams.length]);
      const [runner, setRunner] = useState(null);          // { examId, section, paperAnswers? }
      const [paperExam, setPaperExam] = useState(null);    // kâğıttan cevap girilen deneme
      const [keyEdit, setKeyEdit] = useState(null);        // { examId, text }
      const startCustomExam = (ex, section = null) => setRunner({ examId: ex.id, section });
      const practiceList = (items) => {
        setRunner(null);
        setQs(items); setIdx(0); setPicked({}); setMarked(false); reported.current = false; setTimed(null);
      };
      const setExamAnswer = (examId, num, i) => {
        const ex = customExams.find(e => e.id === examId);
        if (!ex || !onUpdateExam) return;
        onUpdateExam({ ...ex, questions: ex.questions.map(q => q.num === num ? { ...q, answer: i, correctLetter: EXAM_LETTERS[i] } : q) });
      };
      const applyKeyText = (ex, text) => {
        const map = parseAnswerKey(text);
        if (!map.size) return 0;
        onUpdateExam({ ...ex, questions: ex.questions.map(q => map.has(q.num) ? { ...q, answer: EXAM_LETTERS.indexOf(map.get(q.num)), correctLetter: map.get(q.num) } : q) });
        return map.size;
      };

      // Haftalık check-up dışarıdan (İstatistikler) başlatılabilir
      useEffect(() => {
        if (preset && preset.weekly) { setPrepOpen(false); build({ mode: 'mixed', count: 20, seconds: 15 * 60 }); onPresetUsed && onPresetUsed(); }
        if (preset && preset.mistakes) { setPrepOpen(false); const list = mistakeQuestions(customExams); if (list.length) practiceList(list); else setExamTab('uploaded'); onPresetUsed && onPresetUsed(); }
        if (preset && preset.drill) { setPrepOpen(false); build({ mode: 'mixed', count: preset.drill }); onPresetUsed && onPresetUsed(); }
      }, [preset]);

      // Süre sayacı; süre bitince cevaplanmayanlar boş sayılır
      useEffect(() => {
        if (!timed || !qs) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
      }, [timed, qs]);
      const remaining = timed ? Math.max(0, Math.round((timed.endAt - now) / 1000)) : null;
      useEffect(() => {
        if (timed && qs && remaining === 0 && idx < qs.length) {
          const filled = { ...picked };
          qs.forEach((_, i) => { if (filled[i] === undefined) filled[i] = -1; });
          setPicked(filled); setIdx(qs.length);
        }
      }, [remaining]);

      const runnerExam = runner && customExams.find(e => e.id === runner.examId);
      if (runnerExam) {
        return (
          <RealExamRunner
            key={runner.examId + '|' + runner.section + (runner.paperAnswers ? '|paper' + runner.t : '')}
            exam={runnerExam} section={runner.section}
            readings={readings} cards={cards} exams={customExams}
            onExit={() => setRunner(null)}
            onFinish={(attempt, rows) => onExamFinished && onExamFinished(runnerExam, attempt, rows)}
            onSetAnswer={(num, i) => setExamAnswer(runnerExam.id, num, i)}
            onPractice={practiceList}
            initialPicked={runner.paperAnswers} paper={!!runner.paperAnswers}
          />
        );
      }

      if (transOpen) {
        return <TranslationPractice readings={readings} exams={customExams} onBack={() => setTransOpen(false)} onAnswer={(t, ok) => onAnswer && onAnswer(t, ok)} />;
      }

      if (prepOpen) {
        return (
          <div className="space-y-3">
            <button onClick={() => setPrepOpen(false)} className="text-xs text-slate-400 hover:text-blue-400 font-bold">← Sınav türleri</button>
            <PrepositionGame readings={readings} best={prepBest} onBest={onPrepBest} onAnswer={(ok) => onAnswer && onAnswer('Edat', ok)} />
          </div>
        );
      }

      const needs = [];
      if (cards.length < 5) needs.push('en az 5 kelime kartı (şu an ' + cards.length + ')');
      if (!readings.length) needs.push('en az 1 okuma metni');

      if (!qs) {
        return (
          <div className="max-w-2xl mx-auto space-y-4">
            {paperExam && <PaperAnswerModal exam={paperExam} onClose={() => setPaperExam(null)} onSubmit={(ans) => { setRunner({ examId: paperExam.id, section: null, paperAnswers: ans, t: Date.now() }); setPaperExam(null); }} />}
            {/* Üst Sekmeler ve PDF Yükleme Butonu */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExamTab('generator')}
                  className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition " + (examTab === 'generator' ? 'bg-blue-600 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800')}
                >
                  🤖 Özgün Soru Üretici
                </button>
                <button
                  type="button"
                  onClick={() => setExamTab('uploaded')}
                  className={"px-3.5 py-1.5 rounded-xl text-xs font-bold transition " + (examTab === 'uploaded' ? 'bg-blue-600 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800')}
                >
                  📄 Çıkmış Sınavlarım & Denemeler ({customExams.length})
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenUploadExam}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
              >
                <span>+ Çıkmış Sınav / Deneme PDF'i Yükle</span>
              </button>
              {onOpenLibrary && (
                <button type="button" onClick={onOpenLibrary} className="px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-xs font-bold text-white shadow">
                  🌐 Paylaşılan denemeler
                </button>
              )}
              {(() => {
                const dueM = mistakeQuestions(customExams).length, allM = mistakeQuestions(customExams, false).length;
                return allM > 0 ? (
                  <button type="button" disabled={!dueM} onClick={() => practiceList(mistakeQuestions(customExams))}
                    title={dueM ? 'Bugün tekrar edilecek yanlışlarınız' : 'Bugün tekrar zamanı gelen yanlış yok'}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-xs font-bold text-white shadow disabled:opacity-50">
                    📕 Yanlışlarım: {dueM} bugün · {allM} toplam
                  </button>
                ) : null;
              })()}
            </div>

            {examTab === 'uploaded' ? (
              customExams.length === 0 ? (
                <div className="bg-slate-950 p-8 rounded-2xl border border-dashed border-slate-800 text-center space-y-3">
                  <div className="text-3xl">📄</div>
                  <h4 className="font-bold text-base text-white">Henüz Bir Sınav PDF'i Yüklemediniz</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Geçmiş yılların YÖKDİL kitapçıklarını (PDF veya Word) yükleyin. Sistem soruları, şıkları ve YÖKDİL soru tiplerini otomatik olarak ayrıştırarak sınav simülasyonu hazırlar.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenUploadExam}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
                  >
                    + İlk Sınav PDF'inizi Yükleyin
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {customExams.map(ex => {
                    const qCount = ex.questions.length;
                    const vocabCount = ex.questions.filter(q => qSection(q) === 'Kelime & Dil Bilgisi').length;
                    return (
                      <div key={ex.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                                {ex.field} • {ex.year} {ex.term}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {qCount} soru
                              </span>
                            </div>
                            <h4 className="font-black text-base text-white mt-1">{ex.title}</h4>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {vocabCount > 0 && onExtractVocabFromExam && (
                              <button
                                type="button"
                                onClick={() => onExtractVocabFromExam(ex)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 text-xs font-bold transition flex items-center gap-1"
                                title="Sınavdaki hedef kelimeleri kelime bankanıza aktarır"
                              >
                                ✨ Kelimeleri Bankaya Ekle
                              </button>
                            )}
                            <button type="button" onClick={() => printExamBooklet(ex, window.confirm('Cevap anahtarı en son sayfaya eklensin mi?\n(Kendiniz çözecekseniz "İptal" deyin.)'))} title="Kitapçık ve optik form olarak yazdır"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-bold">
                              🖨 Yazdır
                            </button>
                            <button type="button" onClick={() => setPaperExam(ex)} title="Kâğıtta çözdüğünüz cevapları girin"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-bold">
                              📝 Kâğıttan cevap gir
                            </button>
                            {onPassagesToReadings && ex.questions.some(q => q.passage) && (
                              <button type="button" onClick={() => onPassagesToReadings(ex)} title="Okuma ve cloze parçalarını Okuma Parçalarım'a aktar"
                                className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-200 hover:bg-amber-900 text-xs font-bold">
                                📖 Parçaları okumaya aktar
                              </button>
                            )}
                            {onShareExam && (
                              <button type="button" onClick={() => onShareExam(ex)} title="Herkese açık kütüphanede paylaş"
                                className="px-2.5 py-1.5 rounded-lg bg-sky-950/70 border border-sky-800 text-sky-300 hover:bg-sky-900 text-xs font-bold">
                                🌐 Paylaş
                              </button>
                            )}
                            {onDeleteExam && (
                              <button
                                type="button"
                                onClick={() => onDeleteExam(ex.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 hover:bg-red-900 text-xs transition"
                                title="Sınavı Sil"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Hızlı Başlatma Butonları */}
                        {(() => {
                          const keyed = ex.questions.filter(q => q.answer >= 0).length;
                          const last = (ex.attempts || [])[0];
                          return (
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className={keyed === qCount ? 'text-emerald-400' : keyed ? 'text-amber-300' : 'text-slate-500'}>🔑 Cevap anahtarı: {keyed}/{qCount}</span>
                              <button type="button" onClick={() => setKeyEdit(keyEdit && keyEdit.examId === ex.id ? null : { examId: ex.id, text: '' })} className="text-blue-400 hover:underline font-bold">{keyed ? 'Anahtarı düzenle' : 'Anahtar gir'}</button>
                              {last && <span className="text-slate-400">· Son deneme ({new Date(last.at).toLocaleDateString('tr-TR')}{last.section !== 'all' ? ', ' + last.section : ''}): <b className="text-white">{last.correct}/{last.graded}</b>{last.section === 'all' && last.graded >= 70 ? ' · ' + (last.correct * 1.25).toFixed(1) + ' puan' : ''}</span>}
                            </div>
                          );
                        })()}
                        {keyEdit && keyEdit.examId === ex.id && (
                          <div className="flex gap-1.5">
                            <input autoFocus value={keyEdit.text} onChange={e => setKeyEdit({ ...keyEdit, text: e.target.value })} placeholder="1-A 2-C 3-D … ya da ACDEB…" className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-mono" />
                            <button type="button" onClick={() => { const n = applyKeyText(ex, keyEdit.text); if (n) setKeyEdit(null); else alert('Cevap bulunamadı. Örnek: 1-A 2-C 3-D ya da ACDEB…'); }} className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white">Uygula</button>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => startCustomExam(ex, null)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
                          >
                            ▶ Tüm Sınavı Çöz ({qCount} Soru · {Math.max(10, Math.round(180 * Math.min(80, qCount) / 80))} dk)
                          </button>
                          {examSections(ex).map(s => {
                            const n = s.n;
                            return n ? (
                              <button key={s.label} type="button" onClick={() => startCustomExam(ex, s.label)}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-200">
                                {s.from}-{s.to} {s.label} <span className="text-slate-500">({n})</span>
                              </button>
                            ) : null;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-4">
              {onCreateExam && <MockExamBuilder cards={cards} readings={readings} exams={customExams} onCreate={(ex) => { onCreateExam(ex); setRunner({ examId: ex.id, section: null }); }} />}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-lg text-white">🎓 Hızlı alıştırma (karışık sorular)</h3>
                <p className="text-xs text-slate-400">Sorular sizin okuma metinlerinizden ve kelime kartlarınızdan otomatik üretilir. Her soruda 5 şık vardır; cevabınızdan sonra açıklama gösterilir.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[['mixed', 'Karışık (önerilen)'], ['vocab', 'Kelime – boşluk doldurma'], ['synonym', '🎯 Eş Anlamlılar (Synonyms)'], ['linker', 'Bağlaç / geçiş ifadeleri'], ['irrelevant', 'Anlamı bozan cümle'], ['meaning', 'Türkçe karşılık'], ['translate', '✍️ Çeviri alıştırması (Claude)'], ['prep', '🎯 Preposition Matrix & Çark']].map(([k, label]) => (
                    <label key={k} className={"flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer " + (mode === k ? 'border-blue-600 bg-blue-600/10 text-white' : 'border-slate-800 text-slate-300')}>
                      <input type="radio" name="examMode" checked={mode === k} onChange={() => setMode(k)} className="accent-blue-500" /> {label}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Soru sayısı</span>
                  {[10, 20, 40].map(n => (
                    <button key={n} onClick={() => setCount(n)} className={"px-3 py-1.5 rounded-lg font-bold " + (count === n ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}>{n}</button>
                  ))}
                </div>
                {needs.length > 0 && mode !== 'prep' && mode !== 'translate' && <p className="text-[11px] text-amber-400">Daha çok soru için: {needs.join(', ')}. Bağlaç ve anlamı bozan cümle soruları okuma metinlerinden üretilir (ikincisi için en az 2 metin gerekir).</p>}
                <button onClick={() => build()} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500">{mode === 'prep' ? 'Oyunu Aç' : mode === 'translate' ? 'Alıştırmayı Aç' : 'Sınavı Başlat'}</button>
                <button onClick={() => build({ mode: 'mixed', count: 20, seconds: 15 * 60 })} className="w-full py-2.5 rounded-xl bg-indigo-700 text-white font-bold text-xs hover:bg-indigo-600">
                  ⏱ Haftalık Check-up: 20 soru · 15 dakika{new Date().getDay() === 0 ? ' — bugün check-up günü!' : ''}
                </button>
              </div>
              </div>
            )}
          </div>
        );
      }

      if (!qs.length) {
        return (
          <div className="max-w-2xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3 text-center">
            <p className="text-sm text-slate-300">Bu türde soru üretilecek kadar veri yok.</p>
            <p className="text-xs text-slate-500">Okuma metni yükleyip "✨ Kelimeleri Çıkar" ile kelime ekleyin; sonra tekrar deneyin.</p>
            <button onClick={() => setQs(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Geri</button>
          </div>
        );
      }

      const answered = Object.keys(picked).length;
      const correctN = qs.filter((q, i) => picked[i] === q.answer).length;
      const done = answered === qs.length && idx >= qs.length;

      if (done) {
        const wrongCardIds = [...new Set(qs.flatMap((q, i) => picked[i] !== q.answer ? (q.cardIds || []) : []))];
        const byType = {};
        qs.forEach((q, i) => { byType[q.type] = byType[q.type] || [0, 0]; byType[q.type][1]++; if (picked[i] === q.answer) byType[q.type][0]++; });
        if (timed && !reported.current) { reported.current = true; setTimeout(() => onCheckupDone && onCheckupDone(correctN, qs.length), 0); }
        const usedSec = timed ? Math.min(timed.total, timed.total - Math.max(0, Math.round((timed.endAt - Date.now()) / 1000))) : 0;
        return (
          <div className="max-w-2xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            {timed && <p className="text-xs font-bold text-indigo-300">⏱ Haftalık Check-up · süre: {Math.floor(usedSec / 60)} dk {usedSec % 60} sn{qs.some((_, i) => picked[i] === -1) ? ' · süre doldu, boş bırakılanlar yanlış sayıldı' : ''}</p>}
            <h3 className="font-bold text-lg text-white">Sonuç: {correctN} / {qs.length} <span className="text-slate-400 text-sm">(%{Math.round(correctN / qs.length * 100)})</span></h3>
            {timed && (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {qs.map((q, i) => picked[i] === q.answer ? null : (
                  <div key={i} className="p-3 rounded-xl bg-red-950/30 border border-red-900/50 text-xs space-y-1">
                    <p className="text-slate-400">{i + 1}. {q.type}</p>
                    <p className="text-slate-200 font-serif whitespace-pre-wrap line-clamp-4">{q.prompt}</p>
                    <p className="text-emerald-300">Doğru: {LETTERS[q.answer]}) {q.options[q.answer]}{picked[i] >= 0 ? <span className="text-red-300 ml-2">Sizin: {LETTERS[picked[i]]}) {q.options[picked[i]]}</span> : <span className="text-slate-500 ml-2">(boş)</span>}</p>
                    <p className="text-slate-400">{q.explain}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1 text-xs">
              {Object.entries(byType).map(([t, [c, n]]) => <p key={t} className="text-slate-300">{t}: <b className={c === n ? 'text-emerald-400' : 'text-amber-300'}>{c}/{n}</b></p>)}
            </div>
            {wrongCardIds.length > 0 && (
              <button disabled={marked} onClick={() => { onMarkDifficult(wrongCardIds); setMarked(true); }} className="px-4 py-2 rounded-lg bg-amber-600 text-xs font-bold text-white disabled:opacity-60">
                {marked ? '✓ Zorlandığım Kelimeler\'e eklendi' : 'Yanlış yaptığım ' + wrongCardIds.length + ' kelimeyi "Zorlandığım Kelimeler"e ekle'}
              </button>
            )}
            <div className="flex gap-2">
              <button onClick={() => build(timed ? { mode: 'mixed', count: 20, seconds: 15 * 60 } : undefined)} className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white">Yeni sınav</button>
              <button onClick={() => { setQs(null); setTimed(null); }} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Ayarlar</button>
            </div>
          </div>
        );
      }

      const q = qs[idx];
      if (!q) return null;
      const my = picked[idx];
      const isAnswered = my !== undefined && !timed;      // süreli denemede geri bildirim sonda
      const showClues = q.type === 'Kelime';
      const rendered = showClues ? renderWithClues(q.prompt) : { nodes: q.prompt, clues: [] };
      return (
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Soru {idx + 1} / {qs.length} · <span className="text-blue-300 font-bold">{q.type}</span></span>
            {timed
              ? <span className={"font-black text-sm " + (remaining <= 60 ? 'text-red-400' : 'text-indigo-300')}>⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
              : <span>Doğru: {correctN} / {answered}</span>}
          </div>
          <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: (idx / qs.length * 100) + '%' }} /></div>
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            {q.passage && <div className="max-h-[35vh] overflow-y-auto p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 font-serif leading-relaxed whitespace-pre-wrap">{q.passage}</div>}
            <p className="text-sm text-slate-100 font-serif leading-relaxed whitespace-pre-wrap">{rendered.nodes}</p>
            {rendered.clues.length > 0 && (
              <div className="text-[11px] text-orange-200 bg-orange-950/30 border border-orange-900/40 rounded-lg px-3 py-2 space-y-0.5">
                {rendered.clues.map(c => <p key={c.w}>💡 <b>{c.w}</b> {CLUE_HINT[c.cat] || c.cat}</p>)}
              </div>
            )}
            <div className="space-y-2">
              {q.options.map((o, i) => {
                const state = !isAnswered ? 'idle' : i === q.answer ? 'right' : i === my ? 'wrong' : 'dim';
                const cls = { idle: 'border-slate-700 hover:border-blue-500 hover:bg-slate-900', right: 'border-emerald-500 bg-emerald-600/15 text-emerald-200', wrong: 'border-red-500 bg-red-600/15 text-red-200', dim: 'border-slate-800 text-slate-500' }[state];
                return (
                  <button key={i} disabled={isAnswered || (timed && my !== undefined)} onClick={() => {
                    setPicked({ ...picked, [idx]: i });
                    if (onAnswer) onAnswer(q.type, i === q.answer);
                    if (q.mistakeRef && onMistakeResult) onMistakeResult(q.mistakeRef, i === q.answer);
                    if (timed) setTimeout(() => setIdx(x => x + 1), 250);     // süreli denemede doğrudan sonraki soru
                  }}
                          className={"w-full text-left px-4 py-2.5 rounded-xl border text-sm transition " + cls}>
                    <b className="mr-2">{LETTERS[i]})</b>{o}
                  </button>
                );
              })}
            </div>
            {isAnswered && (
              <div className={"p-3 rounded-xl text-xs " + (my === q.answer ? 'bg-emerald-950/50 text-emerald-200' : 'bg-red-950/40 text-red-200')}>
                <b>{my === q.answer ? '✓ Doğru!' : '✗ Yanlış. Doğru cevap: ' + LETTERS[q.answer] + ') ' + q.options[q.answer]}</b>
                <p className="mt-1 text-slate-300">{q.explain}</p>
              </div>
            )}
            <div className="flex justify-between">
              {timed ? (
                <>
                  <button onClick={() => { const f = { ...picked }; qs.forEach((_, i) => { if (f[i] === undefined) f[i] = -1; }); setPicked(f); setIdx(qs.length); }} className="text-xs text-slate-500 hover:text-slate-300">Teslim et</button>
                  <button onClick={() => { if (picked[idx] === undefined) setPicked({ ...picked, [idx]: -1 }); setIdx(idx + 1); }} className="px-5 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">Boş geç →</button>
                </>
              ) : (
                <>
                  <button onClick={() => setQs(null)} className="text-xs text-slate-500 hover:text-slate-300">Sınavı bitir</button>
                  <button disabled={!isAnswered} onClick={() => setIdx(idx + 1)} className="px-5 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-40">
                    {idx + 1 < qs.length ? 'Sonraki →' : 'Sonucu gör'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

