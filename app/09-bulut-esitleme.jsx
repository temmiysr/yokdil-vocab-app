    // --- BULUT SENKRONİZASYONU (Firebase) ---
    // Web yapılandırması gizli değildir (her Firebase web uygulamasında herkese açıktır).
    // Erişimi Firestore güvenlik kuralları korur: her kullanıcı yalnızca users/{kendi uid}/... altını okuyup yazabilir.
    const FIREBASE_CONFIG = {
      apiKey: 'AIzaSyCKJsQfCTh2wtOZ5t0HcOMHf4fC1ua0VDs',
      authDomain: 'yokdil-master.firebaseapp.com',
      projectId: 'yokdil-master',
      storageBucket: 'yokdil-master.firebasestorage.app',
      messagingSenderId: '294443630442',
      appId: '1:294443630442:web:7ef2849a41c5d6e4b72f13',
    };
    // Eşitlenen veri türleri (Ayarlar bilerek dahil değil: Telegram token'ı gibi gizli bilgiler buluta gitmez)
    const SYNC_KINDS = ['weeks', 'readings', 'cards', 'activity', 'exams'];
    const SYNC_TS_KEY = 'yokdil_sync_ts_v1';            // { kind: { id: son yerel değişiklik zamanı } }
    // Firestore'da bir belge en fazla 1 MB olabilir; daha büyük öğe toplu gönderimi tümden bozar → atlanır (cihazda kalır)
    const SYNC_MAX_BYTES = 900000;

    let fbCache = null;
    // Tarayıcı depolamayı kapattıysa (dosya olarak / önizlemede açılan sayfa, bazı gizli pencereler) Firebase başlatılmaz:
    // aksi hâlde Firestore yakalanmamış "localStorage" hatası fırlatır. Bu durumda bulut eşitleme kapalı kalır.
    const storageWorks = (() => { try { const k = '__yk_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return !!window.indexedDB; } catch (e) { return false; } })();
    const getFirebase = () => {
      if (!window.firebase || !storageWorks) return null;
      if (!fbCache) {
        try {
          if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
          const db = firebase.firestore();
          try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}   // çevrimdışı çalışma
          fbCache = { auth: firebase.auth(), db };
        } catch (e) { console.warn('Firebase başlatılamadı', e); return null; }
      }
      return fbCache;
    };

    // Firestore'da her öğe tek belge: users/{uid}/{kind}/{id} = { json, ts, deleted }
    // (json olarak saklanır: undefined/iç içe alanlar sorun çıkarmaz; silinenler "deleted" işaretiyle tutulur ki diğer cihazlar da silsin)
    function useCloudSync({ weeks, setWeeks, readings, setReadings, cards, setCards, activity, setActivity, exams, setExams }) {
      const [user, setUser] = useState(null);
      const [authReady, setAuthReady] = useState(false);
      const [status, setStatus] = useState('off');      // off | syncing | synced | error
      const [error, setError] = useState('');
      const [lastSync, setLastSync] = useState(null);
      const [tooBig, setTooBig] = useState([]);          // buluta sığmadığı için yalnızca bu cihazda kalan öğeler
      const data = { weeks, readings, cards, activity, exams: exams || [] };
      const setters = { weeks: setWeeks, readings: setReadings, cards: setCards, activity: setActivity, exams: setExams };
      const dataRef = useRef(data); dataRef.current = data;
      const synced = useRef({ weeks: new Map(), readings: new Map(), cards: new Map(), activity: new Map(), exams: new Map() });   // buluttaki bilinen hâl (id → json)
      const ready = useRef(false);
      const seen = useRef(null);                         // değişiklik zamanı damgası için önceki yerel hâl

      const toMap = (list) => new Map((list || []).filter(x => x && x.id != null).map(x => [String(x.id), JSON.stringify(x)]));
      const tsAll = () => { try { return JSON.parse(localStorage.getItem(SYNC_TS_KEY) || '{}'); } catch (e) { return {}; } };

      // Yerel değişikliklere zaman damgası (giriş yapılmamışken de): ilk girişte hangi sürümün yeni olduğunu bilmek için
      useEffect(() => {
        const cur = { weeks: toMap(weeks), readings: toMap(readings), cards: toMap(cards), activity: toMap(activity), exams: toMap(exams) };
        if (seen.current) {
          const all = tsAll(); const now = Date.now(); let changed = false;
          SYNC_KINDS.forEach(k => {
            all[k] = all[k] || {};
            cur[k].forEach((j, id) => { if (seen.current[k].get(id) !== j) { all[k][id] = now; changed = true; } });
          });
          if (changed) { try { localStorage.setItem(SYNC_TS_KEY, JSON.stringify(all)); } catch (e) {} }
        }
        seen.current = cur;
      }, [weeks, readings, cards, activity, exams]);

      // Oturum durumu
      useEffect(() => {
        const fb = getFirebase();
        if (!fb) { setAuthReady(true); return; }
        fb.auth.getRedirectResult().catch(e => setError(authErrorText(e)));
        return fb.auth.onAuthStateChanged(u => { setUser(u); setAuthReady(true); });
      }, []);

      // Girişte: birleştir + canlı dinle
      useEffect(() => {
        if (!user) { ready.current = false; setStatus('off'); return; }
        const fb = getFirebase();
        const unsubs = [];
        let cancelled = false;
        (async () => {
          setStatus('syncing'); setError('');
          try {
            const tsMap = tsAll();
            for (const kind of SYNC_KINDS) {
              const col = fb.db.collection('users').doc(user.uid).collection(kind);
              const snap = await col.get();
              if (cancelled) return;
              const remote = new Map();
              snap.forEach(d => remote.set(d.id, d.data()));
              const local = dataRef.current[kind] || [];
              const localIds = new Set(local.map(x => String(x.id)));
              const uploads = [];
              const remoteOnly = [];
              const merged = [];
              local.forEach(l => {
                const id = String(l.id), r = remote.get(id), lj = JSON.stringify(l);
                if (!r) { merged.push(l); uploads.push([id, lj]); return; }                  // yalnızca bu cihazda → yükle
                if (r.deleted) {                                                              // başka cihazda silinmiş
                  if ((tsMap[kind] || {})[id] > (r.ts || 0)) { merged.push(l); uploads.push([id, lj]); }
                  return;
                }
                if (r.json === lj) { merged.push(l); return; }
                if ((tsMap[kind] || {})[id] > (r.ts || 0)) { merged.push(l); uploads.push([id, lj]); }  // yerel daha yeni
                else merged.push(JSON.parse(r.json));                                          // bulut daha yeni
              });
              remote.forEach((r, id) => { if (!localIds.has(id) && !r.deleted && r.json) remoteOnly.push(JSON.parse(r.json)); });
              const final = [...remoteOnly, ...merged];

              const okUploads = uploads.filter(([, json]) => json.length <= SYNC_MAX_BYTES);
              if (okUploads.length < uploads.length) setTooBig(prev => [...new Set([...prev, ...uploads.filter(([, j]) => j.length > SYNC_MAX_BYTES).map(([id]) => id)])]);
              for (let i = 0; i < okUploads.length; i += 400) {
                const batch = fb.db.batch();
                okUploads.slice(i, i + 400).forEach(([id, json]) => batch.set(col.doc(id), { json, ts: Date.now(), deleted: false }));
                await batch.commit();
              }
              synced.current[kind] = toMap(final);
              seen.current = { ...(seen.current || {}), [kind]: toMap(final) };
              setters[kind](final);

              // Diğer cihazlardan gelen değişiklikleri canlı uygula
              unsubs.push(col.onSnapshot(s => {
                if (s.metadata.hasPendingWrites) return;
                const changes = s.docChanges();
                if (!changes.length) return;
                setters[kind](prev => {
                  let next = prev;
                  changes.forEach(ch => {
                    const id = ch.doc.id, r = ch.doc.data();
                    const gone = ch.type === 'removed' || r.deleted;
                    if (gone) {
                      if (next.some(x => String(x.id) === id)) next = next.filter(x => String(x.id) !== id);
                      synced.current[kind].delete(id);
                      return;
                    }
                    if (synced.current[kind].get(id) === r.json) return;
                    synced.current[kind].set(id, r.json);
                    const item = JSON.parse(r.json);
                    const idx = next.findIndex(x => String(x.id) === id);
                    next = idx >= 0 ? next.map((x, i) => i === idx ? item : x) : [item, ...next];
                  });
                  return next;
                });
                setLastSync(new Date());
              }, e => { setError('Canlı eşitleme hatası: ' + e.message); setStatus('error'); }));
            }
            if (cancelled) return;
            ready.current = true;
            setStatus('synced'); setLastSync(new Date());
          } catch (e) {
            if (cancelled) return;
            setError('Eşitleme hatası: ' + (e && e.message ? e.message : e)); setStatus('error');
          }
        })();
        return () => { cancelled = true; ready.current = false; unsubs.forEach(u => u()); };
      }, [user]);

      // Yerel değişiklikleri buluta gönder (1,2 sn gecikmeyle toplu)
      useEffect(() => {
        if (!user || !ready.current) return;
        const t = setTimeout(async () => {
          const fb = getFirebase(); if (!fb) return;
          const ops = [], big = [];
          SYNC_KINDS.forEach(kind => {
            const cur = toMap(dataRef.current[kind]);
            const prev = synced.current[kind];
            cur.forEach((json, id) => {
              if (prev.get(id) === json) return;
              if (json.length > SYNC_MAX_BYTES) { big.push(id); return; }   // çok büyük: buluta gönderilmez
              ops.push([kind, id, json]);
            });
            prev.forEach((_, id) => { if (!cur.has(id)) ops.push([kind, id, null]); });
          });
          if (big.length) setTooBig(prevB => [...new Set([...prevB, ...big])]);
          if (!ops.length) return;
          setStatus('syncing');
          try {
            for (let i = 0; i < ops.length; i += 400) {
              const batch = fb.db.batch();
              ops.slice(i, i + 400).forEach(([kind, id, json]) => {
                const ref = fb.db.collection('users').doc(user.uid).collection(kind).doc(id);
                batch.set(ref, json === null ? { json: '', ts: Date.now(), deleted: true } : { json, ts: Date.now(), deleted: false });
              });
              await batch.commit();
            }
            ops.forEach(([kind, id, json]) => { json === null ? synced.current[kind].delete(id) : synced.current[kind].set(id, json); });
            setStatus('synced'); setLastSync(new Date()); setError('');
          } catch (e) {
            setError('Gönderilemedi: ' + (e && e.message ? e.message : e)); setStatus('error');
          }
        }, 1200);
        return () => clearTimeout(t);
      }, [weeks, readings, cards, activity, exams, user]);

      const signIn = async () => {
        const fb = getFirebase();
        if (!fb) { setError('Firebase yüklenemedi (internet bağlantısını kontrol edin).'); return; }
        setError('');
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try { await fb.auth.signInWithPopup(provider); }
        catch (e) {
          if (e && /popup-blocked|operation-not-supported/.test(e.code || '')) { try { await fb.auth.signInWithRedirect(provider); } catch (e2) { setError(authErrorText(e2)); } }
          else if (!(e && /popup-closed|cancelled-popup/.test(e.code || ''))) setError(authErrorText(e));
        }
      };
      const signOut = async () => { const fb = getFirebase(); if (fb) await fb.auth.signOut(); };

      return { user, authReady, status, error, lastSync, signIn, signOut, available: !!window.firebase, tooBig };
    }

    const authErrorText = (e) => {
      const c = (e && e.code) || '';
      if (/unauthorized-domain/.test(c)) return 'Bu adres Firebase\'de izinli değil (Authentication → Settings → Authorized domains).';
      if (/network/.test(c)) return 'Bağlantı hatası; internetinizi kontrol edin.';
      return 'Giriş yapılamadı: ' + ((e && e.message) || c || 'bilinmeyen hata');
    };

    // Yedek indir / yükle: farklı adreslerde (localhost, dosya, github.io) tutulan verileri taşımak için
