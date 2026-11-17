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


    // --- SINAV TAKVİMİ VE SAYAÇ ---
    // Kaynak: ÖSYM 2026 ve 2027 Yılı Sınav Takvimleri (2027 takvimi 28.10.2026'da yayımlandı) ve 2026-YDS/2 duyurusu.
    // ÖSYM takvimi güncelleyebilir; uygulama kullanıcıya "ÖSYM'den kontrol edin" uyarısı gösterir.
    // Kâğıt sınavlar (YDS, YÖKDİL) saat 10.15'te başlar; e-sınavların saati sınava giriş belgesinde yazar.
    const EXAM_CALENDAR_UPDATED = '17.11.2026';
    const EXAM_CALENDAR = [
      { id: '2026-yds2', kind: 'YDS', name: '2026-YDS/2', date: '2026-11-22', time: '10:15', app: ['2026-09-30', '2026-10-08'], late: '2026-10-14', result: '2026-12-10' },
      { id: '2026-eyds12', kind: 'e-YDS', name: 'e-YDS 2026/12 İngilizce', date: '2026-12-19', app: ['2026-12-02', '2026-12-10'], result: '2026-12-19' },
      { id: '2027-eyds1', kind: 'e-YDS', name: 'e-YDS 2027/1 İngilizce', date: '2027-01-16', app: ['2027-01-04', '2027-01-07'], result: '2027-01-16' },
      { id: '2027-eyds2', kind: 'e-YDS', name: 'e-YDS 2027/2 İngilizce', date: '2027-02-06', app: ['2027-01-20', '2027-01-28'], result: '2027-02-06' },
      { id: '2027-yokdil1', kind: 'YÖKDİL', name: '2027-YÖKDİL/1', date: '2027-02-28', time: '10:15', app: ['2027-01-12', '2027-01-20'], late: '2027-01-28', result: '2027-03-26' },
      { id: '2027-yds1', kind: 'YDS', name: '2027-YDS/1', date: '2027-03-28', time: '10:15', app: ['2027-02-03', '2027-02-11'], late: '2027-02-18', result: '2027-04-21' },
      { id: '2027-eyds4', kind: 'e-YDS', name: 'e-YDS 2027/4 İngilizce', date: '2027-04-24', app: ['2027-04-07', '2027-04-14'], result: '2027-04-24' },
      { id: '2027-eyokdil1', kind: 'e-YÖKDİL', name: 'e-YÖKDİL 2027/1 İngilizce – Sosyal Bilimler', date: '2027-05-29', app: ['2027-05-04', '2027-05-12'], result: '2027-05-29' },
      { id: '2027-eyokdil2', kind: 'e-YÖKDİL', name: 'e-YÖKDİL 2027/2 İngilizce – Sağlık Bilimleri', date: '2027-05-30', app: ['2027-05-04', '2027-05-12'], result: '2027-05-30' },
      { id: '2027-eyokdil3', kind: 'e-YÖKDİL', name: 'e-YÖKDİL 2027/3 İngilizce – Fen Bilimleri', date: '2027-06-05', app: ['2027-05-04', '2027-05-27'], result: '2027-06-05' },
      { id: '2027-eyds6', kind: 'e-YDS', name: 'e-YDS 2027/6 İngilizce', date: '2027-06-26', app: ['2027-06-09', '2027-06-17'], result: '2027-06-26' },
      { id: '2027-yokdil2', kind: 'YÖKDİL', name: '2027-YÖKDİL/2', date: '2027-07-25', time: '10:15', app: ['2027-06-08', '2027-06-16'], late: '2027-06-23', result: '2027-08-13' },
      { id: '2027-eyds9', kind: 'e-YDS', name: 'e-YDS 2027/9 İngilizce', date: '2027-08-21', app: ['2027-08-04', '2027-08-12'], result: '2027-08-21' },
      { id: '2027-eyds10', kind: 'e-YDS', name: 'e-YDS 2027/10 İngilizce', date: '2027-09-25', app: ['2027-09-08', '2027-09-16'], result: '2027-09-25' },
      { id: '2027-eyds11', kind: 'e-YDS', name: 'e-YDS 2027/11 Farsça/İngilizce', date: '2027-10-16', app: ['2027-09-29', '2027-10-07'], result: '2027-10-16' },
      { id: '2027-yds2', kind: 'YDS', name: '2027-YDS/2', date: '2027-11-21', time: '10:15', app: ['2027-10-05', '2027-10-13'], late: '2027-10-20', result: '2027-12-10' },
      { id: '2027-eyds12', kind: 'e-YDS', name: 'e-YDS 2027/12 İngilizce', date: '2027-12-18', app: ['2027-12-01', '2027-12-09'], result: '2027-12-18' },
    ];
    const trDate = (d, withDay) => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', withDay ? { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' } : { day: 'numeric', month: 'long' });
    const examStart = (e) => new Date(e.date + 'T' + (e.time || '09:00') + ':00');
    // Başvuru / sınav durumu
    function examStatus(e, today = getTodayStr()) {
      const dd = (x) => daysUntil(x);
      if (today < e.app[0]) return { tone: 'wait', text: 'Başvuru başlangıcı: ' + trDate(e.app[0]) + ' (' + dd(e.app[0]) + ' gün sonra)' };
      if (today <= e.app[1]) return { tone: 'open', text: '📢 Başvuru açık · son gün ' + trDate(e.app[1]) };
      if (e.late && today <= e.late) return { tone: 'late', text: '⏰ Yalnızca geç başvuru: ' + trDate(e.late) };
      if (today <= e.date) return { tone: 'closed', text: 'Başvurular kapandı' };
      if (e.result && today <= e.result) return { tone: 'result', text: 'Sonuç: ' + trDate(e.result) };
      return { tone: 'past', text: 'Tamamlandı' };
    }
    const STATUS_CLS = { wait: 'bg-slate-800 text-slate-300', open: 'bg-emerald-900 text-emerald-200', late: 'bg-amber-900 text-amber-200', closed: 'bg-slate-900 text-slate-500', result: 'bg-sky-900 text-sky-200', past: 'bg-slate-900 text-slate-600' };

    // Takvime eklenecek .ics dosyası: sınav günü + başvuru başlangıcı ve son günü hatırlatmaları
    function downloadExamIcs(e) {
      const d = (x) => x.replace(/-/g, '');
      const ev = (uid, day, title, desc) => ['BEGIN:VEVENT', 'UID:' + uid + '@yokdil-master', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
        'DTSTART;VALUE=DATE:' + d(day), 'DTEND;VALUE=DATE:' + d(addDays(day, 1)), 'SUMMARY:' + title, 'DESCRIPTION:' + desc,
        'BEGIN:VALARM', 'TRIGGER:-PT12H', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'END:VALARM', 'END:VEVENT'];
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YOKDIL Master//TR', 'CALSCALE:GREGORIAN',
        ...ev(e.id + '-app1', e.app[0], e.name + ' başvuruları başlıyor', 'ÖSYM AİS (ais.osym.gov.tr) üzerinden başvuru'),
        ...ev(e.id + '-app2', e.app[1], e.name + ' başvuru son günü', 'Başvuru son gün ' + e.app[1] + (e.late ? '; geç başvuru ' + e.late : '')),
        ...ev(e.id + '-exam', e.date, e.name + ' sınavı' + (e.time ? ' (' + e.time.replace(':', '.') + ')' : ''), 'Sınava giriş belgenizi ve kimliğinizi unutmayın. Tarihleri ÖSYM duyurularından kontrol edin.'),
        ...(e.result && e.result !== e.date ? ev(e.id + '-res', e.result, e.name + ' sonuçları', 'Planlanan sonuç açıklama tarihi') : []),
        'END:VCALENDAR'];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = e.id + '.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    // Canlı geri sayım
    function Countdown({ exam }) {
      const [now, setNow] = useState(Date.now());
      useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
      const ms = examStart(exam).getTime() - now;
      if (ms <= 0) return <p className="text-2xl font-black">{getTodayStr() === exam.date ? 'Bugün sınav günü — başarılar! 🍀' : 'Sınav tamamlandı'}</p>;
      const s = Math.floor(ms / 1000), days = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      const Box = ({ v, l }) => <div className="text-center min-w-[3.2rem]"><p className="text-3xl sm:text-4xl font-black tabular-nums leading-none">{String(v).padStart(l === 'gün' ? 1 : 2, '0')}</p><p className="text-[10px] uppercase tracking-wide opacity-70 mt-1">{l}</p></div>;
      return <div className="flex items-end gap-3"><Box v={days} l="gün" /><Box v={h} l="saat" /><Box v={m} l="dakika" /><Box v={sec} l="saniye" /></div>;
    }

    // Ana sayfa: seçilen sınavın sayacı + yaklaşan YDS / YÖKDİL tarihleri
    function ExamCalendarCard({ settings, setSettings }) {
      const today = getTodayStr();
      const [open, setOpen] = useState(false);
      const [kinds, setKinds] = useState(['YDS', 'YÖKDİL', 'e-YDS', 'e-YÖKDİL']);
      const upcoming = EXAM_CALENDAR.filter(e => (e.result || e.date) >= today);
      const mine = EXAM_CALENDAR.find(e => e.id === settings.examId);
      const choose = (e) => setSettings(s => ({ ...s, examId: e.id, examDate: e.date, examName: e.name }));
      // Sayaç kurulmamışsa: başvurusu açık / yakın olan ilk YDS-YÖKDİL sınavını öner
      const suggestion = upcoming.find(e => e.date > today && (e.kind === 'YDS' || e.kind === 'YÖKDİL'));
      const st = mine && examStatus(mine);
      return (
        <div className="rounded-2xl border border-indigo-800/60 overflow-hidden">
          {mine && mine.date >= today ? (
            <div className="bg-gradient-to-br from-indigo-700 via-blue-800 to-slate-900 p-5 text-white space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-blue-200">⏳ Sınavıma kalan süre</p>
                  <p className="text-lg font-black">{mine.name}</p>
                  <p className="text-xs text-blue-100">{trDate(mine.date, true)}{mine.time ? ', saat ' + mine.time.replace(':', '.') : ' (saat sınava giriş belgesinde)'}</p>
                </div>
                <span className={"text-[11px] font-bold px-2 py-1 rounded-lg " + STATUS_CLS[st.tone]}>{st.text}</span>
              </div>
              <Countdown exam={mine} />
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button onClick={() => downloadExamIcs(mine)} className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-bold">📅 Telefon takvimime ekle</button>
                <button onClick={() => setOpen(!open)} className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-bold">{open ? 'Takvimi gizle' : 'Sınav takvimi / değiştir'}</button>
                <button onClick={() => setSettings(s => ({ ...s, examId: null }))} className="px-2.5 py-1 rounded-lg text-blue-200 hover:text-white">Sayacı kaldır</button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 p-4 flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-white mr-auto">⏳ Sınav sayacı <span className="block text-[11px] font-normal text-slate-400">Gireceğiniz YDS / YÖKDİL oturumunu seçin; ana sayfada geri sayım ve başvuru tarihleri görünsün.</span></p>
              {suggestion && <button onClick={() => choose(suggestion)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white">{suggestion.name} için sayaç kur</button>}
              <button onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">{open ? 'Takvimi gizle' : 'Tüm tarihler'}</button>
            </div>
          )}
          {open && (
            <div className="bg-slate-950 p-4 space-y-2 border-t border-slate-800">
              <div className="flex flex-wrap gap-1 text-[11px]">
                {['YDS', 'YÖKDİL', 'e-YDS', 'e-YÖKDİL'].map(k => (
                  <button key={k} onClick={() => setKinds(ks => ks.includes(k) ? ks.filter(x => x !== k) : [...ks, k])}
                    className={"px-2.5 py-1 rounded-full font-bold border " + (kinds.includes(k) ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-slate-500')}>{k}</button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="text-left text-slate-500"><th className="py-1">Sınav</th><th>Tarih</th><th>Başvuru</th><th>Sonuç</th><th>Durum</th><th></th></tr></thead>
                  <tbody>
                    {upcoming.filter(e => kinds.includes(e.kind)).map(e => {
                      const s = examStatus(e);
                      return (
                        <tr key={e.id} className={"border-t border-slate-800 " + (e.id === settings.examId ? 'text-indigo-200' : 'text-slate-300')}>
                          <td className="py-1.5 font-bold">{e.name}</td>
                          <td className="whitespace-nowrap">{trDate(e.date)}{e.date.slice(0, 4) !== today.slice(0, 4) ? ' ' + e.date.slice(0, 4) : ''}{e.time ? ' · ' + e.time.replace(':', '.') : ''}</td>
                          <td className="whitespace-nowrap">{trDate(e.app[0])} – {trDate(e.app[1])}{e.late ? <span className="text-slate-500"> (geç: {trDate(e.late)})</span> : null}</td>
                          <td className="whitespace-nowrap">{e.result ? trDate(e.result) : '—'}</td>
                          <td><span className={"px-1.5 py-0.5 rounded " + STATUS_CLS[s.tone]}>{s.text}</span></td>
                          <td className="whitespace-nowrap text-right">
                            {e.date >= today && (e.id === settings.examId
                              ? <span className="text-indigo-300 font-bold">✓ sayaçta</span>
                              : <button onClick={() => choose(e)} className="px-2 py-0.5 rounded bg-indigo-700 text-white font-bold">Sayaç kur</button>)}
                            <button onClick={() => downloadExamIcs(e)} title="Takvime ekle (.ics): başvuru ve sınav günü hatırlatmaları" className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">📅</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500">Kaynak: ÖSYM 2026 ve 2027 yılı sınav takvimleri (güncelleme {EXAM_CALENDAR_UPDATED}). ÖSYM takvimi değiştirebilir; başvurudan önce osym.gov.tr duyurularını kontrol edin. e-YDS ve e-YÖKDİL'de başvurular kontenjan dolunca erken kapanabilir.</p>
            </div>
          )}
        </div>
      );
    }
