    // --- CÜMLE ÇIKARMA VE MÜKERRER KONTROLÜ ---
    function extractSentence(text, target) {
      if (!text || !target) return '';
      const idx = text.toLowerCase().indexOf(target.toLowerCase());
      if (idx === -1) return target;

      let start = idx;
      while (start > 0) {
        const c = text[start - 1];
        if (c === '\n') break;
        if (['.', '!', '?'].includes(c)) {
          const pre = text.slice(Math.max(0, start - 8), start).toLowerCase();
          if (!/(e\.g|i\.e|e\.|i\.|dr|mr|vs|etc|u\.s)\.$/i.test(pre)) break;
        }
        start--;
      }

      let end = idx + target.length;
      while (end < text.length) {
        const c = text[end];
        if (c === '\n') break;
        if (['.', '!', '?'].includes(c)) {
          const sub = text.slice(Math.max(0, end - 6), end + 1).toLowerCase();
          const next = text.slice(end + 1, Math.min(text.length, end + 4)).toLowerCase();
          const isAbbr = /(e\.g|i\.e|dr|mr|vs|etc|u\.s)\.$/i.test(sub) || (/\b[a-z]\.$/i.test(sub) && /^[a-z]\./i.test(next));
          if (!isAbbr) { end++; break; }
        }
        end++;
      }
      return text.slice(start, end).trim().replace(/\s+/g, ' ');
    }

    // Akıllı Kalıp İfade Genişletme (Smart Phrase Expansion)
    function findSmartCollocation(sentence, target) {
      if (!sentence || !target || target.length < 2) return '';
      const cleanTarget = target.trim();
      const lowerSentence = sentence.toLowerCase();
      const lowerTarget = cleanTarget.toLowerCase();
      const idx = lowerSentence.indexOf(lowerTarget);
      if (idx === -1) return '';

      const beforeText = sentence.slice(0, idx).trim();
      const afterText = sentence.slice(idx + cleanTarget.length).trim();

      const beforeTokens = beforeText ? beforeText.split(/\s+/) : [];
      const afterTokens = afterText ? afterText.split(/\s+/) : [];

      const prepositions = new Set(['of', 'to', 'in', 'on', 'with', 'for', 'from', 'at', 'by', 'into', 'as', 'about', 'against', 'upon', 'between']);
      const articles = new Set(['a', 'an', 'the']);
      const verbs = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'remains', 'remained', 'becomes', 'became', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);

      if (afterTokens.length >= 2 && prepositions.has(afterTokens[0].toLowerCase().replace(/[^a-z]/g, ''))) {
        const prep = afterTokens[0].replace(/[^a-z]/g, '');
        const nextWords = [];
        let i = 1;
        if (i < afterTokens.length && articles.has(afterTokens[i].toLowerCase().replace(/[^a-z]/g, ''))) {
          nextWords.push(afterTokens[i]);
          i++;
        }
        while (i < afterTokens.length && nextWords.length < 2) {
          const cleanW = afterTokens[i].replace(/[.,;:!?()"']/g, '');
          if (!cleanW || prepositions.has(cleanW.toLowerCase()) || verbs.has(cleanW.toLowerCase())) break;
          nextWords.push(cleanW);
          i++;
        }
        if (nextWords.length > 0) {
          return (cleanTarget + ' ' + prep + ' ' + nextWords.join(' ')).trim();
        }
      }

      if (beforeTokens.length >= 1 && cleanTarget.split(/\s+/).length <= 2) {
        const prevWord = beforeTokens[beforeTokens.length - 1].replace(/^[.,;:!?()"']+|[.,;:!?()"']+$/g, '');
        if (prevWord.length > 2 && !articles.has(prevWord.toLowerCase()) && !prepositions.has(prevWord.toLowerCase())) {
          return (prevWord + ' ' + cleanTarget).trim();
        }
      }
      return '';
    }

    // Dokunsal Titreşim (Haptics) Desteği
    function triggerHaptic(duration = 30) {
      try {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(duration);
        }
      } catch (e) {}
    }

    // Bionic Reading Kelime Biçimlendirici (Akademik Odaklanma)
    // Yalnızca harflerden oluşan bir kelime alır (boşluk/noktalama dışarıda kalır, ek boşluk eklenmez).
    // data-w: tıkla-anlam özelliği kelime parçalara bölünse de kelimenin tamamını bulabilsin diye.
    function formatBionicWord(letters, key, extraCls) {
      const len = letters.length;
      const fix = len <= 3 ? 1 : len <= 5 ? 2 : len <= 7 ? 3 : Math.ceil(len * 0.45);
      return (
        <span key={key} data-w={letters} className={extraCls || undefined}>
          <strong className="font-extrabold text-white">{letters.slice(0, fix)}</strong>
          <span className="opacity-80">{letters.slice(fix)}</span>
        </span>
      );
    }

