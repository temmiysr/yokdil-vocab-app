    // --- İSTATİSTİK YARDIMCILARI ---
    const isActiveDay = (a) => a && ((a.reviews || 0) + (a.examQ || 0)) > 0;
    function computeStreak(activity) {
      const active = new Set(activity.filter(isActiveDay).map(a => a.id));
      let d = getTodayStr();
      if (!active.has(d)) d = addDays(d, -1);              // bugün henüz çalışılmadıysa dünden say
      let n = 0;
      while (active.has(d)) { n++; d = addDays(d, -1); }
      return n;
    }
    function bestStreak(activity) {
      const days = activity.filter(isActiveDay).map(a => a.id).sort();
      let best = 0, cur = 0, prev = null;
      days.forEach(d => { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; });
      return best;
    }
    const daysUntil = (dateStr) => dateStr ? Math.ceil((Date.parse(dateStr + 'T00:00:00') - Date.parse(getTodayStr() + 'T00:00:00')) / 86400000) : null;

    function StatBox({ label, value, sub, cls }) {
      return (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <p className={"text-xs " + (cls || 'text-slate-400')}>{label}</p>
          <p className={"text-2xl font-black mt-1 " + (cls || 'text-white')}>{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
      );
    }

    // Ana sayfadaki "Bugün" kartı: günün işleri ve ilerleme
    function DailyPlanCard({ due, todayRec, readingsCount, mistakesDue, queued, perDay, onReview, onMistakes, onReading, onDrill }) {
      const reviewed = todayRec.reviews || 0;
      const tasks = [
        { key: 'review', icon: '🔄', label: due > 0 ? 'Kelime tekrarı: ' + due + ' kart kaldı' : reviewed ? 'Kelime tekrarı bitti (' + reviewed + ' kart)' : 'Bugün tekrar edilecek kart yok', done: due === 0, onClick: onReview, btn: 'Başla',
          sub: queued > 0 ? 'Listelerden her gün ' + perDay + ' yeni kelime ekleniyor · sırada ' + queued : '' },
        { key: 'mistakes', icon: '📕', label: mistakesDue > 0 ? 'Yanlışlarım: ' + mistakesDue + ' soru' : 'Yanlışlarım: bugün tekrar yok', done: mistakesDue === 0, onClick: onMistakes, btn: 'Çöz' },
        { key: 'reading', icon: '📖', label: (todayRec.readingsOpened || 0) > 0 ? 'Okuma: bugün bir parça okundu' : 'Okuma: 1 parça oku', done: (todayRec.readingsOpened || 0) > 0, onClick: onReading, btn: 'Aç', disabled: !readingsCount,
          sub: readingsCount ? '' : 'Önce bir metin yükleyin ya da denemedeki parçaları okumaya aktarın' },
        { key: 'drill', icon: '🎯', label: 'Soru çözümü: ' + Math.min(todayRec.examQ || 0, 10) + ' / 10', done: (todayRec.examQ || 0) >= 10, onClick: onDrill, btn: 'Başla' },
      ];
      const doneN = tasks.filter(t => t.done).length;
      return (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-black text-base text-white">📋 Bugün</h3>
            <span className={"text-xs font-bold " + (doneN === tasks.length ? 'text-emerald-400' : 'text-slate-400')}>{doneN === tasks.length ? '✓ Günün planı tamam!' : doneN + ' / ' + tasks.length + ' tamamlandı'}</span>
          </div>
          <div className="h-1.5 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: (doneN / tasks.length * 100) + '%' }} /></div>
          <div className="grid gap-2">
            {tasks.map(t => (
              <div key={t.key} className={"flex items-center gap-3 p-2.5 rounded-xl border " + (t.done ? 'border-emerald-900/50 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/50')}>
                <span className="text-lg">{t.done ? '✅' : t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={"text-xs font-bold " + (t.done ? 'text-emerald-300' : 'text-white')}>{t.label}</p>
                  {t.sub && <p className="text-[10px] text-slate-500">{t.sub}</p>}
                </div>
                {!t.done && <button onClick={t.onClick} disabled={t.disabled} className="px-3 py-1.5 rounded-lg bg-blue-600 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-40">{t.btn}</button>}
              </div>
            ))}
          </div>
        </div>
      );
    }

