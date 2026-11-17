    // --- ÇALIŞMA GRUPLARI ---
    // groups/{kod} = { name, createdBy, createdAt } ; groups/{kod}/members/{uid} = { nick, week, reviews, examQ, examCorrect, streak, updatedAt }
    // Yalnızca takma ad ve bu haftanın sayıları paylaşılır; kartlar, metinler, e-posta paylaşılmaz.
    const weekStart = (d = getTodayStr()) => { const dt = new Date(d + 'T00:00:00'); const dow = (dt.getDay() + 6) % 7; return addDays(d, -dow); };
    function weekStats(activity) {
      const ws = weekStart();
      const days = activity.filter(a => a.id >= ws);
      const sum = (k) => days.reduce((s, a) => s + (a[k] || 0), 0);
      return { week: ws, reviews: sum('reviews'), examQ: sum('examQ'), examCorrect: sum('examCorrect'), streak: computeStreak(activity), activeDays: days.filter(a => (a.reviews || 0) + (a.examQ || 0) > 0).length };
    }
    const newGroupCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

    function StudyGroups({ user, activity, settings, setSettings, onSignIn }) {
      const groups = settings.groups || [];
      const [nick, setNick] = useState(settings.groupNick || '');
      const [name, setName] = useState('');
      const [code, setCode] = useState('');
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');
      const [boards, setBoards] = useState({});      // kod → üyeler
      const mine = weekStats(activity);
      const db = () => { const fb = getFirebase(); if (!fb) throw new Error('Firebase yüklenemedi.'); return fb.db; };
      const pushMine = async (codes) => {
        for (const c of codes) await db().collection('groups').doc(c).collection('members').doc(user.uid).set({ nick: settings.groupNick || nick, ...mine, updatedAt: Date.now() });
      };
      const loadBoards = async () => {
        const out = {};
        for (const g of groups) {
          try {
            const s = await db().collection('groups').doc(g.code).collection('members').get();
            out[g.code] = s.docs.map(d => ({ uid: d.id, ...d.data() }));
          } catch (e) { out[g.code] = { error: publicError(e) }; }
        }
        setBoards(out);
      };
      // Kendi haftalık sayılarını gönder (değiştikçe, en çok dakikada bir) ve sıralamayı yükle
      const lastPush = useRef('');
      useEffect(() => {
        if (!user || !groups.length) return;
        const sig = JSON.stringify(mine) + (settings.groupNick || '');
        if (sig === lastPush.current) return;
        const t = setTimeout(async () => {
          try { await pushMine(groups.map(g => g.code)); lastPush.current = sig; await loadBoards(); } catch (e) { setErr(publicError(e)); }
        }, 1500);
        return () => clearTimeout(t);
      }, [user && user.uid, groups.length, mine.reviews, mine.examQ, settings.groupNick]);
      useEffect(() => { if (user && groups.length) loadBoards(); }, [user && user.uid, groups.length]);

      const saveNick = () => { const n = nick.trim().slice(0, 24); if (n) setSettings(s => ({ ...s, groupNick: n })); return n; };
      const create = async () => {
        const n = saveNick(); if (!n) { setErr('Önce bir takma ad yazın.'); return; }
        setBusy(true); setErr('');
        try {
          const c = newGroupCode();
          await db().collection('groups').doc(c).set({ name: name.trim().slice(0, 60) || 'Çalışma grubu', createdBy: user.uid, createdAt: Date.now() });
          await db().collection('groups').doc(c).collection('members').doc(user.uid).set({ nick: n, ...mine, updatedAt: Date.now() });
          setSettings(s => ({ ...s, groupNick: n, groups: [...(s.groups || []), { code: c, name: name.trim() || 'Çalışma grubu' }] }));
          setName('');
        } catch (e) { setErr(publicError(e)); } finally { setBusy(false); }
      };
      const join = async () => {
        const n = saveNick(); if (!n) { setErr('Önce bir takma ad yazın.'); return; }
        const c = code.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(c)) { setErr('Grup kodu 6 karakterdir (ör. K7M2QX).'); return; }
        if (groups.some(g => g.code === c)) { setErr('Bu gruptasınız.'); return; }
        setBusy(true); setErr('');
        try {
          const g = await db().collection('groups').doc(c).get();
          if (!g.exists) throw new Error('Bu kodla bir grup bulunamadı.');
          await db().collection('groups').doc(c).collection('members').doc(user.uid).set({ nick: n, ...mine, updatedAt: Date.now() });
          setSettings(s => ({ ...s, groupNick: n, groups: [...(s.groups || []), { code: c, name: g.data().name || 'Çalışma grubu' }] }));
          setCode('');
        } catch (e) { setErr(publicError(e)); } finally { setBusy(false); }
      };
      const leave = async (c) => {
        if (!window.confirm('Gruptan ayrılmak istiyor musunuz? Sıralamadan adınız kaldırılır.')) return;
        try { await db().collection('groups').doc(c).collection('members').doc(user.uid).delete(); } catch (e) {}
        setSettings(s => ({ ...s, groups: (s.groups || []).filter(g => g.code !== c) }));
      };

      return (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-bold text-white">👥 Çalışma grubu</h4>
            <span className="text-[11px] text-slate-400">Bu hafta: {mine.reviews} tekrar · {mine.examQ} soru</span>
          </div>
          <p className="text-[11px] text-slate-500">Arkadaşlarınızla bir grup kurup haftalık sıralama tutun. Yalnızca takma adınız ve bu haftanın sayıları (tekrar, soru, doğru oranı, seri) paylaşılır; kartlarınız, metinleriniz ve e-postanız paylaşılmaz.</p>
          {!user ? (
            <button onClick={onSignIn} className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white">Grup için Google ile giriş yap</button>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 items-center">
                <input value={nick} onChange={e => setNick(e.target.value)} onBlur={saveNick} placeholder="Takma adınız" aria-label="Takma ad" className="w-36 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Yeni grup adı" aria-label="Yeni grup adı" className="w-36 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
                <button disabled={busy} onClick={create} className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-50">Grup kur</button>
                <span className="text-[11px] text-slate-600">ya da</span>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="Grup kodu" aria-label="Grup kodu" className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-mono uppercase" />
                <button disabled={busy} onClick={join} className="px-3 py-1.5 rounded-lg bg-slate-700 text-xs font-bold text-white disabled:opacity-50">Katıl</button>
              </div>
              {err && <p className="text-[11px] text-red-300">⚠ {err}</p>}
              {groups.map(g => {
                const b = boards[g.code];
                const ws = weekStart();
                const rows = Array.isArray(b) ? b.map(m => m.week === ws ? m : { ...m, reviews: 0, examQ: 0, examCorrect: 0 }).sort((x, y) => (y.reviews + y.examQ) - (x.reviews + x.examQ)) : [];
                return (
                  <div key={g.code} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white mr-auto">{g.name} <span className="font-mono text-slate-400">· kod {g.code}</span></p>
                      <button onClick={() => { try { navigator.clipboard.writeText(g.code); } catch (e) {} }} className="text-[10px] text-blue-400 hover:underline">Kodu kopyala</button>
                      <button onClick={loadBoards} className="text-[10px] text-slate-400 hover:underline">↻</button>
                      <button onClick={() => leave(g.code)} className="text-[10px] text-red-400 hover:underline">Ayrıl</button>
                    </div>
                    {b && b.error && <p className="text-[11px] text-red-300">⚠ {b.error}</p>}
                    {!b && <p className="text-[11px] text-slate-500">Yükleniyor…</p>}
                    {rows.length > 0 && (
                      <table className="w-full text-[11px]">
                        <thead><tr className="text-slate-500 text-left"><th className="py-0.5">#</th><th>Takma ad</th><th>Tekrar</th><th>Soru</th><th>Doğru</th><th>Seri</th></tr></thead>
                        <tbody>
                          {rows.map((m, i) => (
                            <tr key={m.uid} className={"border-t border-slate-800 " + (m.uid === user.uid ? 'text-blue-300 font-bold' : 'text-slate-300')}>
                              <td className="py-1">{i === 0 && (m.reviews + m.examQ) > 0 ? '🏆' : i + 1}</td><td>{m.nick}</td><td>{m.reviews}</td><td>{m.examQ}</td><td>{m.examQ ? '%' + Math.round(m.examCorrect / m.examQ * 100) : '—'}</td><td>{m.streak || 0} gün</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
              {groups.length > 0 && <p className="text-[10px] text-slate-600">Hafta pazartesi başlar. Kodu arkadaşlarınıza gönderin; grubu başka bir cihazda görmek için orada da aynı kodla katılın.</p>}
            </>
          )}
        </div>
      );
    }

    // 365 günlük çalışma ısı haritası (GitHub tarzı: sütunlar haftalar, satırlar Pzt…Paz)
    function ActivityHeatmap({ activity, cards }) {
      const today = getTodayStr();
      const byDay = new Map(activity.map(a => [a.id, a]));
      const addedByDay = new Map();
      cards.forEach(c => { const d = (c.createdAt || '').slice(0, 10); if (d) addedByDay.set(d, (addedByDay.get(d) || 0) + 1); });
      const score = (d) => { const a = byDay.get(d) || {}; return (a.reviews || 0) + (a.examQ || 0) + (addedByDay.get(d) || 0); };
      // Başlangıç: 52 hafta önceki pazartesi
      const dow = (d) => (new Date(d + 'T00:00:00').getDay() + 6) % 7;   // 0 = Pazartesi
      const start = addDays(today, -(52 * 7) - dow(today));
      const days = [];
      for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);
      const weeks = [];
      days.forEach((d, i) => { const w = Math.floor(i / 7); (weeks[w] = weeks[w] || []).push(d); });
      const vals = days.map(score).filter(v => v > 0).sort((a, b) => a - b);
      const q = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 1;
      const cuts = [q(0.25), q(0.5), q(0.75)];
      const level = (v) => v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4;
      const COLORS = ['#1e293b', '#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd'];
      const activeDays = days.filter(d => score(d) > 0).length;
      const months = [];
      weeks.forEach((w, i) => { const m = w[0].slice(5, 7); if (!months.length || months[months.length - 1].m !== m) months.push({ m, i }); });
      const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      const CELL = 11, GAP = 2;
      const scrollRef = useRef(null);
      useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, []);
      return (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-bold text-white">🗓 Son bir yıl</h4>
            <span className="text-[11px] text-slate-400">{activeDays} gün çalışıldı</span>
          </div>
          <div ref={scrollRef} className="overflow-x-auto pb-1">
            <svg width={weeks.length * (CELL + GAP) + 24} height={7 * (CELL + GAP) + 16} role="img" aria-label={'Son bir yılda ' + activeDays + ' gün çalışıldı'}>
              {months.filter((x, k) => k > 0 || x.i < weeks.length - 2).map(x => (
                <text key={x.i + x.m} x={24 + x.i * (CELL + GAP)} y={9} fontSize="9" fill="#94a3b8">{MONTHS_TR[+x.m - 1]}</text>
              ))}
              {['Pzt', '', 'Çar', '', 'Cum', '', ''].map((l, r) => l && <text key={r} x={0} y={16 + r * (CELL + GAP) + 9} fontSize="9" fill="#64748b">{l}</text>)}
              {weeks.map((w, wi) => w.map((d, r) => {
                const v = score(d), a = byDay.get(d) || {};
                return (
                  <rect key={d} x={24 + wi * (CELL + GAP)} y={14 + r * (CELL + GAP)} width={CELL} height={CELL} rx="2" fill={COLORS[level(v)]}>
                    <title>{new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}: {v ? (a.reviews || 0) + ' tekrar, ' + (a.examQ || 0) + ' soru, ' + (addedByDay.get(d) || 0) + ' yeni kelime' : 'çalışma yok'}</title>
                  </rect>
                );
              }))}
            </svg>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 justify-end">
            Az {COLORS.map((c, i) => <span key={i} className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c }} />)} Çok
          </div>
        </div>
      );
    }

