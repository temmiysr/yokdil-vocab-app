    // --- OKUMA HIZI ---
    // Okuma ekranında süre tutulur: kelime sayısı / dakika. Sınavda 180 dakikayı yetiştirmek için
    // akademik metinde dakikada ~150-200 kelime hedeflenir.
    function ReadingTimer({ words, onDone }) {
      const [start, setStart] = useState(null);
      const [now, setNow] = useState(Date.now());
      const [result, setResult] = useState(null);
      useEffect(() => { if (!start) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [start]);
      const sec = start ? Math.round((now - start) / 1000) : 0;
      const stop = () => {
        const s = Math.max(10, (Date.now() - start) / 1000);
        const wpm = Math.round(words / (s / 60));
        setStart(null); setResult({ wpm, s: Math.round(s) });
        if (wpm >= 30 && wpm <= 800) onDone && onDone(wpm);   // açık unutulan ya da hiç okunmayan ölçümler sayılmaz
      };
      if (start) {
        return (
          <span className="flex items-center gap-2">
            <span className="font-mono font-bold text-sky-300">⏱ {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</span>
            <button onClick={stop} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-xs font-bold text-white">Bitirdim</button>
            <button onClick={() => setStart(null)} className="text-[11px] text-slate-500 hover:text-slate-300">İptal</button>
          </span>
        );
      }
      return (
        <span className="flex items-center gap-2">
          {result && (result.wpm > 800 || result.wpm < 30
            ? <span className="text-xs text-slate-400">{result.wpm} kelime/dk · gerçekçi değil, kaydedilmedi</span>
            : <span className={"text-xs font-bold " + (result.wpm >= 150 ? 'text-emerald-300' : 'text-amber-300')}>{result.wpm} kelime/dk{result.wpm < 150 ? ' · hedef 150+' : ' 👍'}</span>)}
          <button onClick={() => { setResult(null); setStart(Date.now()); setNow(Date.now()); }} title={words + ' kelime; okumaya başlarken basın, bitince "Bitirdim" deyin'}
            className="px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-800 text-xs font-bold text-sky-200 hover:bg-sky-900">⏱ Okuma hızımı ölç</button>
        </span>
      );
    }
    // İstatistikler: haftalık ortalama okuma hızı
    function ReadingSpeedCard({ activity }) {
      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const ws = addDays(weekStart(), -7 * i), we = addDays(ws, 7);
        const days = activity.filter(a => a.id >= ws && a.id < we);
        const n = days.reduce((s, a) => s + (a.wpmN || 0), 0), sum = days.reduce((s, a) => s + (a.wpmSum || 0), 0);
        weeks.push({ ws, wpm: n ? Math.round(sum / n) : null, n });
      }
      const has = weeks.filter(w => w.wpm != null);
      if (!has.length) {
        return (
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <h4 className="text-sm font-bold text-white">📖 Okuma hızı</h4>
            <p className="text-[11px] text-slate-500 mt-1">Bir okuma parçası açıp "⏱ Okuma hızımı ölç"e basın; parçayı bitirince "Bitirdim" deyin. Haftalık ortalamanız burada görünür (hedef: dakikada 150-200 kelime).</p>
          </div>
        );
      }
      const max = Math.max(220, ...has.map(w => w.wpm));
      return (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-bold text-white">📖 Okuma hızı (kelime/dakika)</h4>
            <span className="text-[11px] text-slate-400">Bu hafta: <b className="text-white">{weeks[7].wpm == null ? '—' : weeks[7].wpm}</b> · hedef 150-200</span>
          </div>
          <div className="flex items-end gap-2 h-28">
            {weeks.map(w => (
              <div key={w.ws} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={w.wpm == null ? 'ölçüm yok' : w.wpm + ' kelime/dk · ' + w.n + ' ölçüm'}>
                {w.wpm != null && <span className="text-[9px] text-slate-400">{w.wpm}</span>}
                <div className={"w-full rounded-t " + (w.wpm == null ? 'bg-slate-900' : w.wpm >= 150 ? 'bg-emerald-500' : 'bg-sky-500')} style={{ height: w.wpm == null ? 3 : Math.max(4, w.wpm / max * 100) + '%' }} />
                <span className="text-[9px] text-slate-600">{new Date(w.ws + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Bir denemenin bölüm bölüm doğru / toplam (anahtarı olan sorular)
    function attemptSectionStats(ex, at) {
      const out = {};
      (ex.questions || []).forEach(q => {
        if (q.answer < 0) return;
        if (at.section && at.section !== 'all' && qSection(q) !== at.section) return;
        const l = qSection(q);
        out[l] = out[l] || [0, 0];
        out[l][1]++;
        if ((at.answers || {})[q.num] === q.answer) out[l][0]++;
      });
      return out;
    }
    // Tüm denemelerdeki tam (bölüm seçilmeden çözülmüş) denemeler, eskiden yeniye
    function fullAttempts(exams) {
      const list = [];
      (exams || []).forEach(ex => (ex.attempts || []).forEach(at => {
        if (at.section !== 'all' || !at.graded || at.graded < 10) return;
        list.push({ ex, at, score: Math.round(at.correct / at.graded * 1000) / 10, date: at.at });
      }));
      return list.sort((a, b) => a.date.localeCompare(b.date));
    }
    // Son denemelere göre bölüm başarıları (zayıf bölüm analizi ve uyarlanmış deneme için)
    function recentSectionAccuracy(exams, lastN = 5) {
      const acc = {};
      fullAttempts(exams).slice(-lastN).forEach(({ ex, at }) => {
        Object.entries(attemptSectionStats(ex, at)).forEach(([l, [c, n]]) => { acc[l] = acc[l] || [0, 0]; acc[l][0] += c; acc[l][1] += n; });
      });
      return acc;
    }

    // Puan geçmişi ve hedef
    function ScoreProgress({ exams, settings, setSettings }) {
      const target = settings.targetScore || 70;
      const list = fullAttempts(exams);
      const last = list[list.length - 1];
      // Son 3 denemede bölüm başına kaybedilen puan (100 üzerinden)
      const lost = {};
      list.slice(-3).forEach(({ ex, at }) => {
        const per = 100 / at.graded;
        Object.entries(attemptSectionStats(ex, at)).forEach(([l, [c, n]]) => { lost[l] = (lost[l] || 0) + (n - c) * per / Math.min(3, list.length); });
      });
      const lostSorted = Object.entries(lost).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0.4);
      const W = 560, H = 160, P = 28;
      const xs = (i) => P + (list.length <= 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (list.length - 1));
      const ys = (v) => H - P - v / 100 * (H - 2 * P);
      return (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-bold text-white">🎯 Puan gelişimi</h4>
            <label className="text-[11px] text-slate-400 flex items-center gap-1.5">Hedef puan
              <input type="number" min="40" max="100" value={target} onChange={e => setSettings(s => ({ ...s, targetScore: clampN(+e.target.value || 70, 40, 100) }))} className="w-16 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-xs" />
            </label>
          </div>
          {!list.length ? (
            <p className="text-[11px] text-slate-500">Tam bir deneme çözdüğünüzde (Sınavlar → "▶ Tüm Sınavı Çöz" ya da "📝 Deneme oluştur") tahmini puanınız burada grafiğe eklenir.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div><p className="text-[10px] text-slate-400">Son deneme</p><p className="text-2xl font-black text-white">{last.score}</p></div>
                <div><p className="text-[10px] text-slate-400">Hedef</p><p className="text-2xl font-black text-indigo-300">{target}</p></div>
                <p className={"text-xs font-bold " + (last.score >= target ? 'text-emerald-400' : 'text-amber-300')}>{last.score >= target ? '✓ Hedefin üzerindesiniz' : 'Hedefe ' + Math.round((target - last.score) * 10) / 10 + ' puan kaldı (~' + Math.ceil((target - last.score) / 1.25) + ' soru)'}</p>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label={'Son ' + list.length + ' denemenin tahmini puanları'}>
                {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1={P} x2={W - P} y1={ys(v)} y2={ys(v)} stroke="#1e293b" /><text x={4} y={ys(v) + 3} fontSize="9" fill="#64748b">{v}</text></g>)}
                <line x1={P} x2={W - P} y1={ys(target)} y2={ys(target)} stroke="#818cf8" strokeDasharray="5 4" />
                <text x={W - P} y={ys(target) - 4} fontSize="9" fill="#a5b4fc" textAnchor="end">hedef {target}</text>
                {list.length > 1 && <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={list.map((p, i) => xs(i) + ',' + ys(p.score)).join(' ')} />}
                {list.map((p, i) => (
                  <circle key={i} cx={xs(i)} cy={ys(p.score)} r="4" fill={p.score >= target ? '#10b981' : '#3b82f6'}>
                    <title>{new Date(p.date).toLocaleDateString('tr-TR')} · {p.ex.title}: {p.score} puan ({p.at.correct}/{p.at.graded})</title>
                  </circle>
                ))}
              </svg>
              {lostSorted.length > 0 && (
                <div className="text-[11px] text-slate-300 space-y-0.5">
                  <p className="text-slate-400">Son denemelerde en çok puan kaybettiğiniz bölümler (100 üzerinden):</p>
                  {lostSorted.slice(0, 4).map(([l, v]) => <p key={l}><b className="text-white">{l}</b>: −{Math.round(v * 10) / 10} puan</p>)}
                  {last.score < target && <p className="text-amber-200">💡 En hızlı kazanç: <b>{lostSorted[0][0]}</b>. Sınavlar → "Deneme oluştur" → "Zayıf bölümlerime göre" ile bu bölüme ağırlık verin.</p>}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    // Alanlara göre (Fen / Sağlık / Sosyal) ve YÖKDİL bölümlerine göre başarı
    function FieldSuccess({ activity, exams }) {
      const byField = {};
      activity.forEach(a => Object.entries(a.examByField || {}).forEach(([f, [c, n]]) => { byField[f] = byField[f] || [0, 0]; byField[f][0] += c; byField[f][1] += n; }));
      const fields = ['Fen Bilimleri', 'Sağlık Bilimleri', 'Sosyal Bilimler', 'Genel'].filter(f => byField[f] && byField[f][1]);
      // Bölümler: yüklenen sınavlardaki son denemelerden
      const sec = {};
      (exams || []).forEach(ex => (ex.attempts || []).slice(0, 3).forEach(at => {
        Object.entries(at.answers || {}).forEach(([num, my]) => {
          const q = ex.questions.find(x => x.num === +num);
          if (!q || q.answer < 0) return;
          const s = qSection(q);
          sec[s] = sec[s] || [0, 0]; sec[s][1]++; if (q.answer === my) sec[s][0]++;
        });
      }));
      const secs = QTYPES.filter(l => sec[l]);
      const Bar = ({ label, c, n }) => {
        const pct = Math.round(c / n * 100);
        return (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-40 shrink-0 text-slate-300 truncate">{label}</span>
            <div className="flex-1 h-2.5 rounded bg-slate-800 overflow-hidden"><div className={"h-full rounded " + (pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: pct + '%' }} /></div>
            <span className="w-24 text-right text-slate-400"><b className="text-white">%{pct}</b> · {c}/{n}</span>
          </div>
        );
      };
      if (!fields.length && !secs.length) {
        return (
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <h4 className="text-sm font-bold text-white">🧭 Alan ve bölüm başarısı</h4>
            <p className="text-[11px] text-slate-500 mt-1">Sınavlar sekmesinden bir çıkmış sınav yükleyip çözdüğünüzde, Fen / Sağlık / Sosyal alanlarına ve YÖKDİL bölümlerine göre başarınız burada görünür.</p>
          </div>
        );
      }
      return (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h4 className="text-sm font-bold text-white">🧭 Alan ve bölüm başarısı</h4>
          {fields.length > 0 && <div className="space-y-1.5"><p className="text-[10px] uppercase tracking-wide text-slate-500">Alana göre (çözülen çıkmış sınavlar)</p>{fields.map(f => <Bar key={f} label={f} c={byField[f][0]} n={byField[f][1]} />)}</div>}
          {secs.length > 0 && <div className="space-y-1.5"><p className="text-[10px] uppercase tracking-wide text-slate-500">Bölüme göre (her sınavın son 3 denemesi)</p>{secs.map(l => <Bar key={l} label={l} c={sec[l][0]} n={sec[l][1]} />)}</div>}
        </div>
      );
    }

    function StatsSection({ cards, activity, settings, setSettings, onWeeklyCheckup, exams, user, onSignIn }) {
      const today = getTodayStr();
      const todayRec = activity.find(a => a.id === today) || {};
      const goal = settings.dailyGoal || 20;
      const streak = computeStreak(activity), best = bestStreak(activity);
      const left = daysUntil(settings.examDate);

      // Son 30 gün
      const days30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
      const byDay = new Map(activity.map(a => [a.id, a]));
      const maxRev = Math.max(goal, ...days30.map(d => (byDay.get(d) || {}).reviews || 0), 1);
      const added30 = days30.map(d => cards.filter(c => (c.createdAt || '').slice(0, 10) === d).length);

      // Kart durumları
      const states = { new: 0, learning: 0, review: 0, mastered: 0 };
      cards.forEach(c => { const s = (c.srs && c.srs.state) || 'new'; states[s] = (states[s] || 0) + 1; });
      const stateMeta = [['new', 'Yeni', 'bg-slate-500'], ['learning', 'Öğreniliyor', 'bg-amber-500'], ['review', 'Tekrar', 'bg-blue-500'], ['mastered', 'Kalıcı', 'bg-emerald-500']];

      // Önümüzdeki 7 gün
      const forecast = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i);
        return { d, n: cards.filter(c => c.srs && (i === 0 ? c.srs.nextReviewAt <= d : c.srs.nextReviewAt === d)).length };
      });
      const maxF = Math.max(1, ...forecast.map(f => f.n));

      // Sınav başarısı (tüm zamanlar)
      const exam = {};
      activity.forEach(a => Object.entries(a.examByType || {}).forEach(([t, [c, n]]) => { exam[t] = exam[t] || [0, 0]; exam[t][0] += c; exam[t][1] += n; }));
      const totalRev = activity.reduce((s, a) => s + (a.reviews || 0), 0);
      const totalCorrect = activity.reduce((s, a) => s + (a.correct || 0), 0);

      const hardest = [...cards].filter(c => c.srs && ((c.srs.lapses || 0) > 0 || c.srs.difficulty > 6))
        .sort((a, b) => ((b.srs.lapses || 0) - (a.srs.lapses || 0)) || ((b.srs.difficulty || 0) - (a.srs.difficulty || 0))).slice(0, 10);
      const dayLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

      return (
        <div className="space-y-5">
          {/* Sınav sayacı + hedef + seri */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-indigo-700 to-blue-800 p-5 rounded-2xl text-white space-y-2">
              <p className="text-xs text-blue-100">📅 {settings.examName && settings.examId ? settings.examName : 'Sınavıma'} kalan</p>
              <p className="text-3xl font-black">{left == null ? '—' : left > 0 ? left + ' gün' : left === 0 ? 'Bugün!' : 'Geçti'}</p>
              <label className="block text-[11px] text-blue-100">Sınav tarihi
                <input type="date" value={settings.examDate || ''} onChange={e => setSettings({ ...settings, examDate: e.target.value, examId: null, examName: '' })}
                       className="mt-1 w-full px-2 py-1 rounded-md bg-white/15 border border-white/20 text-white text-xs" />
              </label>
              <label className="block text-[11px] text-blue-100">ya da ÖSYM takviminden seçin
                <select value={settings.examId || ""} onChange={e => { const x = EXAM_CALENDAR.find(c => c.id === e.target.value); setSettings(x ? { ...settings, examId: x.id, examDate: x.date, examName: x.name } : { ...settings, examId: null, examName: "" }); }}
                        className="mt-1 w-full px-2 py-1 rounded-md bg-white/15 border border-white/20 text-white text-xs">
                  <option value="" className="text-slate-900">— seçilmedi —</option>
                  {EXAM_CALENDAR.filter(c => c.date >= getTodayStr()).map(c => <option key={c.id} value={c.id} className="text-slate-900">{c.name} · {new Date(c.date + "T00:00:00").toLocaleDateString("tr-TR")}</option>)}
                </select>
              </label>
              {left > 0 && cards.length > 0 && <p className="text-[11px] text-blue-100">Günde ~{Math.ceil(Math.max(0, 600 - cards.length) / left)} yeni kelime ile sınava kadar 600 kelimeye ulaşırsınız.</p>}
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-xs text-slate-400">🎯 Bugünkü hedef</p>
              <p className="text-3xl font-black text-white">{todayRec.reviews || 0}<span className="text-base text-slate-500"> / {goal} tekrar</span></p>
              <div className="h-2 rounded bg-slate-800 overflow-hidden"><div className={"h-full " + ((todayRec.reviews || 0) >= goal ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: Math.min(100, (todayRec.reviews || 0) / goal * 100) + '%' }} /></div>
              <label className="flex items-center gap-2 text-[11px] text-slate-400">Günlük hedef
                <input type="number" min="5" max="300" step="5" value={goal} onChange={e => setSettings({ ...settings, dailyGoal: clampN(+e.target.value || 20, 5, 300) })}
                       className="w-16 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-xs" />
              </label>
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
              <p className="text-xs text-slate-400">🔥 Çalışma serisi</p>
              <p className="text-3xl font-black text-orange-400">{streak} gün</p>
              <p className="text-[11px] text-slate-500">En uzun seri: {best} gün</p>
              <p className="text-[11px] text-slate-500">{isActiveDay(todayRec) ? 'Bugün çalıştınız ✓' : 'Seriyi korumak için bugün tekrar yapın.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Toplam kelime" value={cards.length} sub={added30.reduce((a, b) => a + b, 0) + ' tanesi son 30 günde'} />
            <StatBox label="Toplam tekrar" value={totalRev} sub={totalRev ? '%' + Math.round(totalCorrect / totalRev * 100) + ' doğru hatırlama' : '—'} cls="text-blue-400" />
            <StatBox label="Kalıcı hafızada" value={states.mastered} sub="30+ gün aralıklı" cls="text-emerald-400" />
            <StatBox label="Çözülen soru" value={activity.reduce((s, a) => s + (a.examQ || 0), 0)} sub={(() => { const q = activity.reduce((s, a) => s + (a.examQ || 0), 0), c = activity.reduce((s, a) => s + (a.examCorrect || 0), 0); return q ? '%' + Math.round(c / q * 100) + ' doğru' : 'Sınavlar sekmesinden'; })()} cls="text-purple-400" />
          </div>

          <ActivityHeatmap activity={activity} cards={cards} />
          <ScoreProgress exams={exams} settings={settings} setSettings={setSettings} />
          <ReadingSpeedCard activity={activity} />
          <FieldSuccess activity={activity} exams={exams} />
          <StudyGroups user={user} activity={activity} settings={settings} setSettings={setSettings} onSignIn={onSignIn} />

          {/* Haftalık check-up */}
          {(() => {
            const last = activity.find(a => (a.checkups || 0) > 0);
            const isSunday = new Date().getDay() === 0;
            return (
              <div className={"p-4 rounded-2xl border flex flex-wrap items-center gap-3 " + (isSunday ? 'bg-indigo-950/50 border-indigo-600' : 'bg-slate-950 border-slate-800')}>
                <div className="mr-auto">
                  <p className="text-sm font-bold text-white">⏱ Haftalık Check-up {isSunday && <span className="text-indigo-300">— bugün check-up günü!</span>}</p>
                  <p className="text-[11px] text-slate-400">Şimdiye kadar çalıştığınız tüm kelime ve metinlerden 20 soru · 15 dakika · sonuç ve açıklamalar sonda.</p>
                  {last && <p className="text-[11px] text-indigo-300 mt-0.5">Son check-up ({new Date(last.id + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}): {last.checkupCorrect}/{last.checkupTotal} · %{Math.round(last.checkupCorrect / Math.max(1, last.checkupTotal) * 100)}</p>}
                </div>
                {onWeeklyCheckup && <button onClick={onWeeklyCheckup} className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500">Başlat</button>}
              </div>
            );
          })()}
          {/* Son 30 gün */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-white">Son 30 gün</h3>
              <span className="text-[10px] text-slate-500"><span className="inline-block w-2 h-2 bg-blue-500 rounded-sm mr-1" />tekrar <span className="inline-block w-2 h-2 bg-emerald-500 rounded-sm ml-2 mr-1" />yeni kelime · çizgi: hedef</span>
            </div>
            <div className="relative h-32 flex items-end gap-[3px]">
              <div className="absolute left-0 right-0 border-t border-dashed border-slate-600" style={{ bottom: (goal / maxRev * 100) + '%' }} />
              {days30.map((d, i) => {
                const r = (byDay.get(d) || {}).reviews || 0;
                return (
                  <div key={d} className="flex-1 flex flex-col justify-end h-full" title={dayLabel(d) + ': ' + r + ' tekrar, ' + added30[i] + ' yeni kelime'}>
                    <div className="bg-emerald-500/80 rounded-t-sm" style={{ height: Math.min(100, added30[i] / maxRev * 100) + '%' }} />
                    <div className={"rounded-t-sm " + (d === today ? 'bg-blue-400' : 'bg-blue-600')} style={{ height: (r / maxRev * 100) + '%' }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>{dayLabel(days30[0])}</span><span>Bugün</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kart durumları */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-white">Kartların durumu</h3>
              <div className="h-3 rounded-full overflow-hidden flex bg-slate-800">
                {stateMeta.map(([k, , c]) => states[k] ? <div key={k} className={c} style={{ width: (states[k] / Math.max(1, cards.length) * 100) + '%' }} /> : null)}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {stateMeta.map(([k, label, c]) => <p key={k} className="text-slate-300"><span className={"inline-block w-2 h-2 rounded-sm mr-1.5 " + c} />{label}: <b>{states[k] || 0}</b></p>)}
              </div>
            </div>
            {/* 7 günlük yük */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-white">Önümüzdeki 7 günün tekrar yükü</h3>
              <div className="space-y-1">
                {forecast.map((f, i) => (
                  <div key={f.d} className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 text-slate-400">{i === 0 ? 'Bugün' : dayLabel(f.d)}</span>
                    <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: (f.n / maxF * 100) + '%' }} /></div>
                    <span className="w-6 text-right text-slate-300">{f.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
              <h3 className="font-bold text-sm text-white">Sınav başarısı (soru türüne göre)</h3>
              {Object.keys(exam).length === 0 ? <p className="text-xs text-slate-500">Henüz soru çözülmedi.</p> :
                Object.entries(exam).map(([t, [c, n]]) => (
                  <div key={t} className="text-[11px]">
                    <div className="flex justify-between text-slate-300"><span>{t}</span><span>{c}/{n} · %{Math.round(c / n * 100)}</span></div>
                    <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className={"h-full " + (c / n >= 0.7 ? 'bg-emerald-500' : c / n >= 0.5 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: (c / n * 100) + '%' }} /></div>
                  </div>
                ))}
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
              <h3 className="font-bold text-sm text-white">En çok zorlandığınız kelimeler</h3>
              {!hardest.length ? <p className="text-xs text-slate-500">Henüz yok.</p> : hardest.map(c => (
                <p key={c.id} className="text-[11px] text-slate-300 flex justify-between gap-2"><span><b className="text-white">{c.english}</b> — {c.turkish}</span><span className="text-red-300 whitespace-nowrap">{c.srs.lapses || 0}× unutuldu</span></p>
              ))}
            </div>
          </div>
        </div>
      );
    }

    function DifficultSection({ cards, onUnmark, onStudy }) {
      const list = cards.filter(c => c.isDifficult || (c.srs && c.srs.lapses >= 3));
      if (!list.length) {
        return <div className="text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">Zorlandığınız kelime yok. Sınavda yanlış yaptığınız veya tekrarda sık unuttuğunuz kelimeler burada toplanır.</div>;
      }
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-lg text-white mr-auto">Zorlandığım Kelimeler ({list.length})</h3>
            <button onClick={() => onStudy(list.map(c => c.id))} className="px-4 py-2 rounded-lg bg-amber-600 text-xs font-bold text-white hover:bg-amber-500">Bunları şimdi tekrar et</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map(c => (
              <div key={c.id} className="p-4 rounded-xl bg-slate-950 border border-amber-900/50 space-y-1">
                <div className="flex items-center gap-2">
                  <b className="text-white">{c.english}</b>
                  <button onClick={() => playWord(c)} aria-label={c.english + ' dinle'} className="text-xs text-blue-400">🔊</button>
                  <span className="ml-auto text-[10px] text-red-300">{(c.srs && c.srs.lapses) || 0}× unutuldu</span>
                </div>
                <p className="text-xs text-blue-300 font-semibold">{c.turkish}</p>
                {c.originalSentence && <p className="text-[11px] text-slate-400 font-serif italic line-clamp-2">"{c.originalSentence}"</p>}
                {c.isDifficult && <button onClick={() => onUnmark(c.id)} className="text-[10px] text-slate-500 hover:text-slate-300 underline">Artık zorlanmıyorum</button>}
              </div>
            ))}
          </div>
        </div>
      );
    }

