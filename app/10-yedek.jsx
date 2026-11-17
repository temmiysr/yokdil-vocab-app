    // --- HAFTALIK YEDEK ---
    // Bilgisayarda (Chrome / Edge) bir klasör seçilirse yedek her hafta oraya otomatik yazılır; o klasör
    // Google Drive / OneDrive masaüstü klasörüyse yedek buluta da gider. Desteklenmeyen tarayıcıda hatırlatma + indirme.
    const BACKUP_DIR_KEY = 'backup_dir_handle';
    const canPickFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    const idbKv = (mode, fn) => new Promise((res, rej) => {
      const r = indexedDB.open('yokdil-master');
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        try {
          const tx = r.result.transaction('kv', mode);
          const req = fn(tx.objectStore('kv'));
          tx.oncomplete = () => res(req && req.result);
          tx.onerror = () => rej(tx.error);
        } catch (e) { rej(e); }
      };
    });
    const getBackupDir = () => idbKv('readonly', s => s.get(BACKUP_DIR_KEY)).catch(() => null);
    const setBackupDir = (h) => idbKv('readwrite', s => h ? s.put(h, BACKUP_DIR_KEY) : s.delete(BACKUP_DIR_KEY)).catch(() => null);
    async function writeBackupToDir(dir, json, ask) {
      const opts = { mode: 'readwrite' };
      let perm = await dir.queryPermission(opts);
      if (perm !== 'granted' && ask) perm = await dir.requestPermission(opts);
      if (perm !== 'granted') return false;
      const name = 'yokdil-yedek-' + getTodayStr() + '.json';
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(json); await w.close();
      return name;
    }
    const daysSince = (iso) => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : Infinity;

    function BackupReminder({ lastBackupAt, snoozeUntil, hasData, onDownload, onFolderBackup, onPickFolder, folderName, onSnooze }) {
      const ago = daysSince(lastBackupAt);
      if (!hasData || ago < 7 || (snoozeUntil && snoozeUntil > getTodayStr())) return null;
      return (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-100">
          <span className="mr-auto">🗂 {ago === Infinity ? 'Henüz hiç yedek almadınız.' : 'Son yedeğiniz ' + ago + ' gün önce.'} Haftada bir yedek almanızı öneririz{canPickFolder() ? '; bir klasör seçerseniz yedek her hafta oraya kendiliğinden yazılır (ör. Google Drive klasörünüz)' : ''}.</span>
          {folderName && <button onClick={onFolderBackup} className="px-3 py-1.5 rounded-lg bg-amber-600 font-bold text-white">"{folderName}" klasörüne yedekle</button>}
          {canPickFolder() && <button onClick={onPickFolder} className="px-3 py-1.5 rounded-lg bg-slate-800 font-bold text-slate-100">{folderName ? 'Klasörü değiştir' : '📁 Yedek klasörü seç'}</button>}
          <button onClick={onDownload} className="px-3 py-1.5 rounded-lg bg-slate-800 font-bold text-slate-100">⬇ Yedek indir</button>
          <button onClick={onSnooze} className="text-amber-300/70 hover:text-amber-200">Yarın hatırlat</button>
        </div>
      );
    }

    function BackupLinks({ onExport, onImport }) {
      const inputRef = useRef(null);
      return (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800 mt-1">
          <button onClick={onExport} className="text-[10px] text-blue-400 hover:text-blue-300 underline" title="Tüm haftaları, metinleri ve kartları bir dosyaya indir">⬇ Yedek indir</button>
          <button onClick={() => inputRef.current && inputRef.current.click()} className="text-[10px] text-blue-400 hover:text-blue-300 underline" title="Daha önce indirdiğiniz yedek dosyasını ekle (mevcut veriler silinmez)">⬆ Yedek yükle</button>
          <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onImport(f); }} />
          <PrivacyLink />
        </div>
      );
    }

    // Gizlilik notu (siteyi başkaları da kullanabildiği için)
    function PrivacyLink() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} className="text-[10px] text-slate-400 hover:text-slate-200 underline ml-auto">🔒 Gizlilik</button>
          {open && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-2 text-xs text-slate-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-base text-white">🔒 Gizlilik</h3>
                <p><b className="text-white">Giriş yapmadan:</b> kartlarınız, metinleriniz ve denemeleriniz yalnızca bu tarayıcıda saklanır; hiçbir sunucuya gönderilmez.</p>
                <p><b className="text-white">Google ile giriş yapınca:</b> aynı veriler cihazlarınız arasında eşitlensin diye Google Firebase'de yalnızca sizin hesabınıza ayrılmış bölümde saklanır. Bu bölümü sizden başka kimse okuyamaz. Girişte yalnızca Google hesabınızın kimliği, adı ve e-postası kullanılır.</p>
                <p><b className="text-white">Herkese açık kütüphane:</b> yalnızca sizin "Paylaş" dediğiniz listeler ve denemeler herkese açılır; adınız ve e-postanız gösterilmez, tekrar geçmişiniz ve cevaplarınız paylaşılmaz. Paylaşımı istediğiniz zaman kaldırabilirsiniz.</p>
                <p><b className="text-white">Yüklediğiniz dosyalar</b> (PDF, Word, resim) yalnızca bu cihazda okunur; dosyanın kendisi hiçbir yere gönderilmez.</p>
                <p><b className="text-white">Dış hizmetler:</b> kelime anlamı ve okunuş için yalnızca İngilizce kelime ya da cümle; sözlük ve çeviri servislerine (Datamuse, dictionaryapi.dev, Wiktionary, MyMemory) gönderilir. "Claude ile" özellikleri yalnızca siz kullanırsanız, soru ya da cümle kendi API anahtarınızla doğrudan Anthropic'e gönderilir; anahtar yalnızca bu tarayıcıda saklanır.</p>
                <p><b className="text-white">Silme:</b> "⬇ Yedek indir" ile verilerinizin kopyasını alabilir, kartları ve denemeleri uygulama içinden silebilirsiniz. Hesabınızın buluttaki verilerinin tamamen silinmesini isterseniz site sahibine yazın.</p>
                <p className="text-slate-500">Reklam ya da izleme (analitik) kullanılmaz.</p>
                <button onClick={() => setOpen(false)} className="mt-2 px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200">Kapat</button>
              </div>
            </div>
          )}
        </>
      );
    }

    function SyncPanel({ sync, backup }) {
      const links = backup ? <BackupLinks onExport={backup.onExport} onImport={backup.onImport} /> : null;
      if (!sync.available) {
        return <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">☁️ Bulut eşitleme yüklenemedi (internet bağlantısı gerekli).{links}</div>;
      }
      if (!sync.authReady) return <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-500">☁️ Kontrol ediliyor…{links}</div>;
      if (!sync.user) {
        return (
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2">
            <p><span className="font-bold text-slate-200">☁️ Cihazlar arası eşitleme</span><br />Giriş yapınca kelimeleriniz, metinleriniz ve kartlarınız tüm cihazlarınızda aynı olur.</p>
            <button onClick={sync.signIn} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-bold hover:bg-slate-100">
              <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              Google ile giriş yap
            </button>
            {sync.error && <p className="text-red-400">{sync.error}</p>}
            {links}
          </div>
        );
      }
      const label = { syncing: '⟳ Eşitleniyor…', synced: '✓ Eşitlendi' + (sync.lastSync ? ' · ' + sync.lastSync.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''), error: '⚠ Eşitleme sorunu', off: '' }[sync.status];
      const cls = { syncing: 'text-blue-300', synced: 'text-emerald-400', error: 'text-red-400', off: 'text-slate-500' }[sync.status];
      return (
        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2">
            {sync.user.photoURL
              ? <img src={sync.user.photoURL} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full" />
              : <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">{(sync.user.email || '?')[0].toUpperCase()}</span>}
            <span className="truncate text-slate-200 font-semibold" title={sync.user.email}>{sync.user.displayName || sync.user.email}</span>
          </div>
          <p role="status" className={cls}>☁️ {label}</p>
          {sync.error && <p className="text-red-400">{sync.error}</p>}
          {(sync.tooBig || []).length > 0 && <p className="text-amber-400">{sync.tooBig.length} çok uzun metin buluta sığmadığı için yalnızca bu cihazda saklanıyor.</p>}
          <button onClick={sync.signOut} className="text-[10px] text-slate-500 hover:text-slate-300 underline">Çıkış yap (veriler bu cihazda kalır)</button>
          {links}
        </div>
      );
    }

