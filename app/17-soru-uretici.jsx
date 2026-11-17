    // --- SINAV TARZI SORULAR (YÖKDİL formatı; kendi metin ve kartlarınızdan, API anahtarı gerektirmez) ---
    const shuffleArr = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    const pickN = (a, n) => shuffleArr(a).slice(0, n);
    const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const plainText = (t) => String(t || '').replace(/^##\s+.*$/gm, '').replace(/\s+\n/g, '\n');
    const splitSentences = (t) => (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’)]?/g) || []).map(s => s.trim()).filter(s => s.split(' ').length >= 6 && s.split(' ').length <= 45);
    const firstMeaning = (c) => String(c.turkish || '').split(/[,;]/)[0].trim();

    // Kelimeyi cümledeki çekime uydur (assemble + "d" → assembled, study + "ies" → studies)
    const inflectLike = (word, suffix) => {
      const w = word.toLowerCase();
      if (!suffix) return w;
      if (/^(d|ed)$/.test(suffix)) return /e$/.test(w) ? w + 'd' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ied' : w + 'ed';
      if (/^(s|es|ies)$/.test(suffix)) return /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(w) ? w + 'es' : w + 's';
      if (suffix === 'ing') return /[^e]e$/.test(w) ? w.slice(0, -1) + 'ing' : w + 'ing';
      return w + suffix;
    };
    // Cümlede kartın geçtiği biçimi ve eki bul
    const findForm = (sentence, lemma) => {
      const l = lemma.toLowerCase();
      const stems = [l, /e$/.test(l) ? l.slice(0, -1) : null, /y$/.test(l) ? l.slice(0, -1) : null].filter(Boolean);
      for (const st of stems) {
        const m = sentence.match(new RegExp('\\b(' + escRe(st) + '[a-z]{0,4})\\b', 'i'));
        if (m) {
          const form = m[1];
          if (!form.toLowerCase().startsWith(l) && !/^(d|ed|s|es|ies|ing|ied)$/.test(form.toLowerCase().slice(st.length))) continue;
          let suffix = form.toLowerCase().slice(l.length);
          if (!form.toLowerCase().startsWith(l)) suffix = form.toLowerCase().slice(st.length);
          if (suffix === 'ied') suffix = 'ed';
          return { form, suffix, index: m.index };
        }
      }
      return null;
    };

    const LINKERS = {
      'zıtlık': ['however', 'although', 'even though', 'whereas', 'nevertheless', 'nonetheless', 'despite', 'in spite of', 'on the other hand', 'in contrast', 'though'],
      'sebep-sonuç': ['therefore', 'thus', 'hence', 'consequently', 'as a result', 'because', 'because of', 'due to', 'since'],
      'ekleme': ['moreover', 'furthermore', 'in addition', 'besides', 'additionally'],
      'örnekleme': ['for example', 'for instance', 'such as'],
      'koşul': ['unless', 'provided that', 'as long as', 'in case'],
      'benzerlik': ['similarly', 'likewise'],
      'amaç': ['in order to', 'so that', 'so as to'],
    };
    const LINKER_LIST = Object.entries(LINKERS).flatMap(([cat, ws]) => ws.map(w => ({ w, cat })));

    const LETTERS = ['A', 'B', 'C', 'D', 'E'];
    const makeQ = (type, prompt, options, correct, explain, extra) => {
      const opts = shuffleArr(options);
      return { type, prompt, options: opts, answer: opts.indexOf(correct), explain, ...(extra || {}) };
    };

    function genVocabQuestions(cards, n) {
      const usable = cards.filter(c => c.originalSentence && !isMissingMeaning(c) && findForm(c.originalSentence, c.lemma || c.english));
      if (usable.length < 1 || cards.length < 5) return [];
      return pickN(usable, n).map(c => {
        const lemma = (c.lemma || c.english).toLowerCase();
        const f = findForm(c.originalSentence, lemma);
        const blanked = c.originalSentence.slice(0, f.index) + '----' + c.originalSentence.slice(f.index + f.form.length);
        const others = cards.filter(x => (x.lemma || x.english).toLowerCase() !== lemma && /^[a-z]+$/i.test(x.lemma || x.english));
        const samePos = others.filter(x => x.partOfSpeech === c.partOfSpeech);
        const pool = [...pickN(samePos, 4), ...pickN(others.filter(x => !samePos.includes(x)), 4)].slice(0, 4);
        if (pool.length < 4) return null;
        const correct = f.form.toLowerCase();
        const opts = [correct, ...pool.map(x => inflectLike(x.lemma || x.english, f.suffix))];
        if (new Set(opts).size < 5) return null;
        return makeQ('Kelime', blanked, opts, correct,
          '"' + lemma + '" = ' + c.turkish + '. Cümle: "' + c.originalSentence + '"',
          { cardIds: [c.id] });
      }).filter(Boolean);
    }

    function genLinkerQuestions(readings, n) {
      const found = [];
      readings.forEach(r => splitSentences(plainText(r.content)).forEach(s => {
        const hits = LINKER_LIST.filter(L => new RegExp('\\b' + escRe(L.w) + '\\b', 'i').test(s));
        // tek bir bağlaç içeren cümleler (çok anlamlı olmasın); uzun ifadeyi kısaya tercih et
        const longest = hits.sort((a, b) => b.w.length - a.w.length)[0];
        if (!longest) return;
        const others = hits.filter(h => !longest.w.includes(h.w));
        if (others.length) return;
        found.push({ s, L: longest, title: r.title });
      }));
      return pickN(found, n).map(({ s, L }) => {
        const m = s.match(new RegExp('\\b' + escRe(L.w) + '\\b', 'i'));
        const atStart = m.index === 0;
        const cap = (w) => atStart ? w.charAt(0).toUpperCase() + w.slice(1) : w;
        const blanked = s.slice(0, m.index) + '----' + s.slice(m.index + m[0].length);
        const otherCats = Object.keys(LINKERS).filter(c => c !== L.cat);
        const distract = pickN(otherCats, 4).map(cat => pickN(LINKERS[cat], 1)[0]);
        const correct = cap(L.w);
        return makeQ('Bağlaç', blanked, [correct, ...distract.map(cap)], correct,
          '"' + L.w + '" bir ' + L.cat + ' ifadesidir; cümlenin iki kısmı arasındaki ' + L.cat + ' ilişkisini kurar.');
      });
    }

    function genIrrelevantQuestions(readings, n) {
      const paras = [];
      readings.forEach(r => plainText(r.content).split(/\n\s*\n/).forEach(p => {
        const ss = splitSentences(p);
        if (ss.length >= 5) paras.push({ ss, rid: r.id });
      }));
      const allSent = readings.map(r => ({ rid: r.id, ss: splitSentences(plainText(r.content)) }));
      const out = [];
      for (const p of pickN(paras, n * 2)) {
        const foreign = allSent.filter(x => x.rid !== p.rid && x.ss.length).flatMap(x => x.ss);
        if (!foreign.length) continue;
        const start = Math.floor(Math.random() * (p.ss.length - 4));
        const five = p.ss.slice(start, start + 5);
        const pos = 1 + Math.floor(Math.random() * 4);           // ilk cümle hiçbir zaman değişmez
        five[pos] = pickN(foreign, 1)[0];
        const text = five.map((s, i) => '(' + ['I', 'II', 'III', 'IV', 'V'][i] + ') ' + s).join(' ');
        const opts = ['I', 'II', 'III', 'IV', 'V'];
        out.push({ type: 'Anlamı bozan cümle', prompt: 'Aşağıdaki parçada anlam bütünlüğünü bozan cümle hangisidir?\n\n' + text, options: opts, answer: pos, explain: '(' + opts[pos] + ') numaralı cümle başka bir metinden alındı; paragrafın konusuyla ilgisi yok.' });
        if (out.length >= n) break;
      }
      return out;
    }

    function genMeaningQuestions(cards, n) {
      const usable = cards.filter(c => !isMissingMeaning(c) && firstMeaning(c));
      if (usable.length < 5) return [];
      return pickN(usable, n).map(c => {
        const correct = firstMeaning(c);
        const others = [...new Set(usable.filter(x => x.id !== c.id).map(firstMeaning).filter(m => m && m !== correct))];
        if (others.length < 4) return null;
        return makeQ('Türkçe karşılık', '"' + (c.lemma || c.english) + '" kelimesinin Türkçe karşılığı hangisidir?', [correct, ...pickN(others, 4)], correct,
          (c.lemma || c.english) + ' = ' + c.turkish + (c.originalSentence ? '. Cümle: "' + c.originalSentence + '"' : ''), { cardIds: [c.id] });
      }).filter(Boolean);
    }

    // YÖKDİL Paraphrasing / Eş Anlamlı Soru Üretici
    function genSynonymQuestions(cards, n) {
      const usable = cards.filter(c => c.synonyms && c.synonyms.length > 0);
      if (usable.length < 2) return [];
      return pickN(usable, n).map(c => {
        const correct = c.synonyms[0];
        const otherCards = cards.filter(x => x.id !== c.id);
        const otherWords = [
          ...otherCards.flatMap(x => x.synonyms || []),
          ...otherCards.map(x => x.lemma || x.english)
        ].filter(w => w && w.toLowerCase() !== correct.toLowerCase() && !c.synonyms.map(s => s.toLowerCase()).includes(w.toLowerCase()));
        const uniqueOthers = [...new Set(otherWords)];
        if (uniqueOthers.length < 4) return null;
        const distractors = pickN(uniqueOthers, 4);
        return makeQ(
          'Eş Anlamlı (Synonym)',
          '"' + (c.lemma || c.english) + '" kelimesinin en yakın eş anlamlısı (synonym) hangisidir?',
          [correct, ...distractors],
          correct,
          '"' + (c.lemma || c.english) + '" kelimesinin eş anlamlıları: ' + c.synonyms.join(', ') + '. Türkçe anlamı: ' + c.turkish,
          { cardIds: [c.id] }
        );
      }).filter(Boolean);
    }

