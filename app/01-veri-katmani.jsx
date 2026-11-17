    // --- TEMEL VERİ KATMANI (Offline-first localStorage) ---
    const STORAGE_KEYS = {
      WEEKS: 'yokdil_weeks_v1',
      READINGS: 'yokdil_readings_v1',
      VOCAB: 'yokdil_vocab_cards_v1',
      SETTINGS: 'yokdil_user_settings_v1',
      EXAMS: 'custom_exams',               // yüklenen çıkmış sınav / denemeler (Antigravity eklentisi)
      ACTIVITY: 'yokdil_activity_v1',      // günlük çalışma kaydı: [{ id: 'YYYY-MM-DD', reviews, correct, again, newCards, examQ, examCorrect, examByType }]
    };

    function getStored(key, def) {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : def;
      } catch (e) {
        return def;
      }
    }

    function setStored(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    }

