    // --- KALICI DEPOLAMA: IndexedDB ---
    // localStorage ~5 MB ile sınırlı; uzun OCR metinleri ve çok sayıda kartla dolabilir. Veriler artık IndexedDB'de
    // (yüzlerce MB) tutulur. İlk açılışta localStorage'daki eski veriler kopyalanır ve geri okunarak doğrulanır;
    // eski kayıtlar SİLİNMEZ (yedek olarak kalır).
    const IDB_NAME = 'yokdil-master', IDB_STORE = 'kv';
    const STORAGE_MODE_KEY = 'yokdil_storage_mode_v2';   // 'idb' → veriler IndexedDB'de
    let idbPromise = null;
    const idbOpen = () => {
      if (!idbPromise) {
        idbPromise = new Promise((resolve, reject) => {
          if (!window.indexedDB) return reject(new Error('IndexedDB yok'));
          const req = indexedDB.open(IDB_NAME, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
          req.onblocked = () => reject(new Error('IndexedDB engellendi'));
        });
        idbPromise.catch(() => { idbPromise = null; });
      }
      return idbPromise;
    };
    const idbGet = async (key) => {
      const db = await idbOpen();
      return new Promise((resolve, reject) => {
        const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    };
    const idbSet = async (key, val) => {
      const db = await idbOpen();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('İşlem iptal edildi'));
      });
    };
    const isQuotaError = (e) => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || ''));

    // Açılışta tüm veriyi yükler (gerekirse localStorage → IndexedDB taşıması yapar)
    const DATA_KEYS = [STORAGE_KEYS.WEEKS, STORAGE_KEYS.READINGS, STORAGE_KEYS.VOCAB, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.ACTIVITY, STORAGE_KEYS.EXAMS];
    async function loadAllData() {
      const fromLocal = () => Object.fromEntries(DATA_KEYS.map(k => [k, getStored(k, undefined)]));
      try {
        if (localStorage.getItem(STORAGE_MODE_KEY) === 'idb') {
          const out = {};
          for (const k of DATA_KEYS) {
            const v = await idbGet(k);
            out[k] = v !== undefined ? v : getStored(k, undefined);   // IndexedDB'de yoksa eski yedeğe düş
          }
          return { data: out, mode: 'idb' };
        }
        // İlk açılış: taşı + doğrula
        const local = fromLocal();
        for (const k of DATA_KEYS) if (local[k] !== undefined) await idbSet(k, local[k]);
        for (const k of DATA_KEYS) {
          if (local[k] === undefined) continue;
          const back = await idbGet(k);
          if (JSON.stringify(back) !== JSON.stringify(local[k])) throw new Error('Taşıma doğrulanamadı: ' + k);
        }
        localStorage.setItem(STORAGE_MODE_KEY, 'idb');
        try { localStorage.setItem('yokdil_migrated_at', new Date().toISOString()); } catch (e) {}
        return { data: local, mode: 'idb', migrated: true };
      } catch (e) {
        console.warn('IndexedDB kullanılamadı, localStorage ile devam ediliyor:', e);
        return { data: fromLocal(), mode: 'local', error: e };
      }
    }

    // Tek bir anahtarı kalıcı kaydeder; başarısızsa hatayı döndürür
    async function persistKey(mode, key, val) {
      try {
        if (mode === 'idb') await idbSet(key, val);
        else localStorage.setItem(key, JSON.stringify(val));
        return null;
      } catch (e) {
        return e;
      }
    }

