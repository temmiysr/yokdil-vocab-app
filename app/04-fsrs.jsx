    // --- FSRS (Free Spaced Repetition Scheduler, v4.5 varsayılan ağırlıklar) ---
    // Her kart için hafıza "dayanıklılığı" (stability, gün) ve "zorluk" (difficulty, 1-10) tutulur.
    // Kart, hatırlama olasılığı hedefin (%90) altına düşeceği gün tekrar sorulur.
    // Eski SM-2 kartları ilk tekrarda kendi aralık/kolaylık değerlerinden FSRS'ye çevrilir (geçmiş kaybolmaz).
    const FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
    const FSRS_RETENTION = 0.9, FSRS_DECAY = -0.5, FSRS_FACTOR = 19 / 81;
    const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
    const fsrsInitD = (g) => clampN(FSRS_W[4] - (g - 3) * FSRS_W[5], 1, 10);
    const fsrsRetr = (days, s) => Math.pow(1 + FSRS_FACTOR * days / s, FSRS_DECAY);
    const fsrsInterval = (s) => clampN(Math.round(s / FSRS_FACTOR * (Math.pow(FSRS_RETENTION, 1 / FSRS_DECAY) - 1)), 1, 36500);
    const daysBetween = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));

    function fsrsNext(item, rating) {
      const g = rating, w = FSRS_W;
      const today = getTodayStr();
      let S = item.stability, D = item.difficulty;
      const reviewed = item.repetitions > 0 || (item.state && item.state !== 'new');
      if (!(S > 0) && reviewed) {
        // SM-2 kartını çevir: dayanıklılık ≈ mevcut aralık, zorluk ≈ kolaylık katsayısından
        S = Math.max(0.5, item.interval || 1);
        D = clampN(11 - ((item.easeFactor || 2.5) - 1.3) * 5, 1, 10);
      }
      let lapses = item.lapses || 0;
      if (!(S > 0)) {
        S = w[g - 1];
        D = fsrsInitD(g);
        if (g === 1) lapses += 1;
      } else {
        const elapsed = item.lastReviewedAt ? daysBetween(item.lastReviewedAt.slice(0, 10), today) : (item.interval || 0);
        const R = fsrsRetr(elapsed, S);
        const D1 = D - w[6] * (g - 3);
        D = clampN(w[7] * fsrsInitD(4) + (1 - w[7]) * D1, 1, 10);
        if (g === 1) {
          S = Math.min(S, w[11] * Math.pow(D, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R)));
          lapses += 1;
        } else if (elapsed < 1) {
          // aynı gün tekrar: dayanıklılık değişmez (kolayda hafif artış)
          if (g === 4) S = S * 1.2;
        } else {
          const hard = g === 2 ? w[15] : 1, easy = g === 4 ? w[16] : 1;
          S = S * (Math.exp(w[8]) * (11 - D) * Math.pow(S, -w[9]) * (Math.exp(w[10] * (1 - R)) - 1) * hard * easy + 1);
        }
      }
      const interval = g === 1 ? 1 : fsrsInterval(S);
      return {
        ...item,
        stability: Math.round(S * 1000) / 1000,
        difficulty: Math.round(D * 1000) / 1000,
        state: g === 1 ? 'learning' : interval >= 30 ? 'mastered' : interval >= 7 ? 'review' : 'learning',
        interval,
        repetitions: (item.repetitions || 0) + 1,
        lapses,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: addDays(today, interval),
      };
    }

    function processReview(item, rating) { return fsrsNext(item, rating); }

    // Düğmelerde gösterilecek sonraki aralık ("3 gün", "2 ay")
    const formatInterval = (d) => d < 30 ? d + ' gün' : d < 365 ? Math.round(d / 30) + ' ay' : (Math.round(d / 36.5) / 10) + ' yıl';

