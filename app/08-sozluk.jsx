    // --- OTOMATİK KELİME ÇIKARMA VE SÖZLÜK ---
    // Kaynaklar (ücretsiz, anahtar gerektirmez; yalnızca İngilizce kelime gönderilir):
    //   Datamuse (kelime sıklığı, eş/zıt anlam) · dictionaryapi.dev (IPA, ses, tanım, örnek) · MyMemory (Türkçe karşılık)

    // Çok yaygın İngilizce kelimeler (öğrenme listesine alınmaz)
    const STOPWORDS = new Set((
      'the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been being has had did does done said made used such each many much more very own same both few those here where why own while through during before above below between under again further once off down should may might must shall upon among within without into onto toward towards against along around across behind beyond however therefore thus although though whether either neither also yet still already always never often sometimes usually perhaps maybe really quite rather almost enough every another something anything nothing everything someone anyone everyone nobody thing things part parts place case point group number fact hand high great small large long little old big right left last next early late young sure able bad best better less least whole real true full open per via etc mr mrs ms dr st vs'
    ).split(/\s+/));

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Hata/hız sınırına karşı tekrar denemeli JSON isteği (404 → null)
    // cache:'no-store' → tarayıcı önbelleği kullanılmaz. Datamuse gibi servisler CORS izin başlığını tek bir adrese göre
    // önbelleğe yazdırıyor; aynı tarayıcıda başka adresten (localhost ↔ github.io) açınca istekler engelleniyordu.
    // Sonuçlar zaten uygulamanın kendi önbelleğinde (freq/dict cache) tutuluyor.
    // Datamuse'un sunucu önbelleği izin başlığını adres ayırt etmeden 24 saat saklıyor; adrese özel parametre ile ayrı önbellek
    const ORIGIN_TAG = (() => { try { return btoa(location.origin).replace(/[^a-z0-9]/gi, '').slice(-12); } catch (e) { return 'x'; } })();
    // dictionaryapi.dev bulunamayan kelimede izin başlığı olmayan 404 döndürür; tarayıcı bunu ağ hatası sayar.
    // Bu yüzden orada tekrar denenmez ve aynı kelime oturum boyunca bir daha istenmez (konsolu da hata ile doldurmaz).
    const notFoundUrls = new Set();
    const fetchJson = async (url, tries = 3) => {
      if (/api\.datamuse\.com/.test(url)) url += (url.includes('?') ? '&' : '?') + 'o=' + ORIGIN_TAG;
      const isDict = /api\.dictionaryapi\.dev/.test(url);
      if (isDict && notFoundUrls.has(url)) return null;
      for (let a = 0; a < tries; a++) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (r.status === 404) { if (isDict) notFoundUrls.add(url); return null; }
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return await r.json();
        } catch (e) {
          if (isDict && e instanceof TypeError && navigator.onLine !== false) { notFoundUrls.add(url); return null; }
          if (a === tries - 1) throw e;
          await sleep(500 * (a + 1));
        }
      }
    };

    // Sınırlı eşzamanlılıkla iş havuzu
    const runPool = async (items, limit, fn, onProgress) => {
      const res = new Array(items.length);
      let next = 0, done = 0;
      const worker = async () => {
        while (next < items.length) {
          const k = next++;
          try { res[k] = await fn(items[k], k); } catch (e) { res[k] = null; }
          done++;
          if (onProgress) onProgress(done, items.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
      return res;
    };

    // Basit önbellek (aynı kelime için tekrar istek atmamak için)
    const CACHE_KEYS = { FREQ: 'yokdil_freq_cache_v1', DICT: 'yokdil_dict_cache_v2' };
    try { localStorage.removeItem('yokdil_dict_cache_v1'); } catch (e) {}           // eski (yalnızca MyMemory) önbellek
    const cacheGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
    // Önbellek en fazla CACHE_MAX kayıt tutar (en eskiler atılır) ki asıl verilere yer kalsın
    const CACHE_MAX = 1500;
    const cacheSet = (k, v) => {
      const keys = Object.keys(v);
      if (keys.length > CACHE_MAX) keys.slice(0, keys.length - CACHE_MAX).forEach(x => delete v[x]);
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch (e) { try { localStorage.removeItem(k); } catch (e2) {} }   // yer yoksa önbelleği bırak
    };

    // Datamuse: kelimenin sıklığı (milyonda) ve etiketleri; bulunamazsa null
    const freqCache = cacheGet(CACHE_KEYS.FREQ);
    const lookupFreq = async (w) => {
      if (w in freqCache) return freqCache[w];
      const j = await fetchJson('https://api.datamuse.com/words?sp=' + encodeURIComponent(w) + '&md=fp&max=1');
      let v = null;
      if (j && j[0] && j[0].word === w) {
        const tags = j[0].tags || [];
        const f = parseFloat((tags.find(t => t.startsWith('f:')) || 'f:0').slice(2));
        v = { f, tags: tags.filter(t => !t.startsWith('f:')) };
      }
      freqCache[w] = v;
      return v;
    };

    // Kural tabanlı kök adayları (transformed → transform, studies → study, stopped → stop)
    const lemmaCandidates = (w) => {
      const c = [w];
      if (/ies$/.test(w)) c.push(w.slice(0, -3) + 'y');
      if (/(ches|shes|sses|xes|zes|oes)$/.test(w)) c.push(w.slice(0, -2));
      if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) c.push(w.slice(0, -1));
      if (/ied$/.test(w)) c.push(w.slice(0, -3) + 'y');
      if (/ed$/.test(w)) { const s = w.slice(0, -2); c.push(s, s + 'e'); if (/([b-df-hj-np-tv-z])\1$/.test(s)) c.push(s.slice(0, -1)); }
      if (/ing$/.test(w)) { const s = w.slice(0, -3); c.push(s, s + 'e'); if (/([b-df-hj-np-tv-z])\1$/.test(s)) c.push(s.slice(0, -1)); }
      return [...new Set(c)].filter(x => x.length >= 3);
    };

    // Türetme eki kök adayları (substantially → substantial, advancement → advance, awareness → aware…).
    // Türetilmiş kelime çoğu zaman ayrı bir kelimedir (government ≠ govern); bu yüzden kök otomatik seçilmez, ÖNERİ olarak sunulur.
    const derivationalCandidates = (w) => {
      const c = [];
      const add = (x) => { if (x && x.length >= 3 && x !== w) c.push(x); };
      if (/ally$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -4)); }               // economically → economical, economic
      else if (/ily$/.test(w)) add(w.slice(0, -3) + 'y');                               // happily → happy
      else if (/bly$/.test(w)) add(w.slice(0, -1) + 'e');                               // probably → probable
      else if (/ly$/.test(w)) add(w.slice(0, -2));                                      // substantially → substantial
      if (/ments?$/.test(w)) add(w.replace(/ments?$/, ''));                             // advancement(s) → advance
      if (/iness$/.test(w)) add(w.slice(0, -5) + 'y');                                  // happiness → happy
      else if (/ness$/.test(w)) add(w.slice(0, -4));                                    // awareness → aware
      if (/ations?$/.test(w)) { const s = w.replace(/s$/, ''); add(s.slice(0, -3) + 'e'); add(s.slice(0, -5)); add(s.slice(0, -5) + 'e'); }   // creation → create, information → inform, realization → realize
      else if (/tions?$/.test(w)) { const s = w.replace(/s$/, ''); add(s.slice(0, -3)); add(s.slice(0, -4) + 'e'); }                         // adoption → adopt, reduction → reduce
      if (/ility$/.test(w)) add(w.slice(0, -5) + 'le');                                 // stability → stable
      else if (/ity$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }      // validity → valid, scarcity → scarce
      if (/ive$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); }           // effective → effect, creative → create
      if (/logical$/.test(w)) add(w.slice(0, -4) + 'y');                                // technological → technology
      if (/[^i]al$/.test(w) && !/ally$/.test(w)) add(w.slice(0, -2));                   // environmental → environment
      return [...new Set(c)];
    };
    // Sözlükte gerçekten var olan kök önerileri (en fazla 2)
    const findDerivationalRoots = async (word) => {
      const raw = String(word || '').toLowerCase().trim();
      if (!/^[a-z]{5,}$/.test(raw)) return [];
      const bases = [...new Set([raw, ...lemmaCandidates(raw).slice(1)])];         // önce çekim ekini at (advancements → advancement)
      const cands = [...new Set(bases.flatMap(derivationalCandidates))].filter(x => !bases.includes(x)).slice(0, 8);
      const out = [];
      for (const x of cands) {
        const info = await lookupFreq(x).catch(() => null);
        if (info && info.f >= 0.3 && !info.tags.includes('prop')) out.push(x);
        if (out.length >= 2) break;
      }
      return out;
    };

    // Kelimeyi köküne indir: kök adayı yeterince yaygınsa (orijinalin ≥%30'u) onu seç
    const resolveLemma = async (w) => {
      const cands = lemmaCandidates(w);
      const infos = await Promise.all(cands.map(c => lookupFreq(c).catch(() => null)));
      const orig = infos[0];
      let best = null;
      cands.forEach((c, i) => {
        if (i === 0 || !infos[i]) return;
        if (!best || infos[i].f > best.info.f) best = { word: c, info: infos[i] };
      });
      if (best && (!orig || best.info.f >= orig.f * 0.3)) return best;
      return orig ? { word: w, info: orig } : null;
    };

    // Metinden öğrenmeye değer kelime adaylarını çıkarır
    const extractCandidates = async (text, { maxFreq, minFreq = 0.2, onProgress }) => {
      const plain = text.replace(/^##\s+/gm, '');
      const counts = new Map();
      (plain.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).forEach(tok => {
        if (/['’]/.test(tok)) tok = tok.replace(/['’]s$/i, '');
        if (/['’]/.test(tok)) return;
        const w = tok.toLowerCase();
        if (w.length < 4 || STOPWORDS.has(w)) return;
        const e = counts.get(w) || { count: 0, surface: tok };
        e.count++;
        counts.set(w, e);
      });
      const words = [...counts.keys()];
      const resolved = await runPool(words, 4, resolveLemma, onProgress);
      cacheSet(CACHE_KEYS.FREQ, freqCache);

      const groups = new Map();
      words.forEach((w, i) => {
        const r = resolved[i];
        if (!r || !r.info) return;                                     // sözlükte yok (isim, OCR hatası...)
        if (r.info.tags.includes('prop')) return;                       // özel isim
        if (STOPWORDS.has(r.word)) return;
        if (r.info.f > maxFreq || r.info.f < minFreq) return;           // çok yaygın / çok nadir
        const g = groups.get(r.word) || { lemma: r.word, freq: r.info.f, tags: r.info.tags, count: 0, forms: [] };
        g.count += counts.get(w).count;
        g.forms.push(counts.get(w).surface);
        groups.set(r.word, g);
      });
      return [...groups.values()].map(g => ({ ...g, pos: posFor(g.lemma, g.forms, g.tags), sentence: extractSentence(plain, g.forms[0]) }));
    };

    // Datamuse etiketinden kelime türü (etiketler olasılık sırasındadır; ilk uygun etiket alınır)
    const posFromTags = (tags) => {
      const first = (tags || []).find(t => ['n', 'v', 'adj', 'adv'].includes(t));
      return { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' }[first] || 'noun';
    };
    // Metindeki kullanım biçimine göre tür: "assembled/introducing" → fiil, aksi halde Datamuse'un ilk etiketi
    const posFor = (lemma, forms, tags) => {
      const f = (forms || []).map(x => x.toLowerCase());
      if (f.some(x => x !== lemma && /(ed|ing)$/.test(x)) && (tags || []).includes('v')) return 'verb';
      return posFromTags(tags);
    };

    // Sıklık → seviye etiketi
    const freqLevel = (f) => f < 3 ? { label: 'İleri', cls: 'bg-purple-950 text-purple-300' } : f < 20 ? { label: 'Orta-İleri', cls: 'bg-blue-950 text-blue-300' } : { label: 'Orta', cls: 'bg-emerald-950 text-emerald-300' };

    // IPA → Türkçe harflerle okunuş (vurgulu hece BÜYÜK): /sɪɡˈnɪ.fɪ.kənt/ → sig-Nİ-fi-kınt
    const ipaToTurkish = (ipa) => {
      if (!ipa) return '';
      let s = ipa.split(',')[0].replace(/\([^)]*\)/g, '').replace(/[\/\[\]]/g, '').trim();   // (ɹ) gibi isteğe bağlı sesler atılır
      const map = [
        ['t͡ʃ', 'ç'], ['tʃ', 'ç'], ['d͡ʒ', 'c'], ['dʒ', 'c'], ['eɪ', 'ey'], ['aɪ', 'ay'], ['ɔɪ', 'oy'], ['aʊ', 'av'], ['əʊ', 'ou'], ['oʊ', 'ou'],
        ['ɪə', 'iı'], ['eə', 'eı'], ['ɛə', 'eı'], ['ʊə', 'uı'],
        ['iː', 'i'], ['uː', 'u'], ['ɑː', 'a'], ['ɔː', 'o'], ['ɜː', 'ö'], ['ɝ', 'ör'], ['ɚ', 'ır'],
        ['ɪ', 'i'], ['ʊ', 'u'], ['ə', 'ı'], ['ʌ', 'a'], ['æ', 'e'], ['ɑ', 'a'], ['ɒ', 'o'], ['ɔ', 'o'], ['ɛ', 'e'], ['ɜ', 'ö'], ['ɐ', 'a'], ['ᵻ', 'i'], ['ɨ', 'ı'],
        ['θ', 't'], ['ð', 'd'], ['ʃ', 'ş'], ['j', 'y'], ['ʒ', 'j'], ['ŋ', 'ng'], ['ɹ', 'r'], ['ɾ', 't'], ['ɡ', 'g'], ['ɫ', 'l'], ['ʔ', ''], ['ː', ''], ['̩', ''], ['ˌ', '.'],
      ];
      for (const [a, b] of map) s = s.split(a).join(b);
      s = s.replace(/ˈ/g, '·').replace(/[^a-zçğıöşüy·.]/g, '');
      const isV = (ch) => 'aeıioöuü'.includes(ch);
      const stressPos = s.replace(/\./g, '').indexOf('·');
      const letters = s.replace(/[·.]/g, '');
      if (!letters) return '';
      // Türkçe hece kuralları: V-CV, VC-CV
      const sylls = []; let cur = '';
      for (let i = 0; i < letters.length; i++) {
        cur += letters[i];
        if (!isV(letters[i])) continue;
        let j = i + 1; while (j < letters.length && !isV(letters[j])) j++;
        if (j >= letters.length) { cur += letters.slice(i + 1); break; }
        const cons = letters.slice(i + 1, j);
        if (cons.length <= 1) { sylls.push(cur); cur = ''; }
        else { const keep = cons.slice(0, cons.length - 1); cur += keep; sylls.push(cur); cur = ''; i += keep.length; }
      }
      if (cur) { if (sylls.length && !/[aeıioöuü]/.test(cur)) sylls[sylls.length - 1] += cur; else sylls.push(cur); }
      let stressed = -1;
      if (stressPos >= 0 && sylls.length > 1) {
        const firstV = letters.slice(stressPos).search(/[aeıioöuü]/) + stressPos;
        let pos = 0;
        for (let k = 0; k < sylls.length; k++) { if (firstV >= pos && firstV < pos + sylls[k].length) { stressed = k; break; } pos += sylls[k].length; }
      }
      return sylls.map((x, k) => k === stressed ? x.toLocaleUpperCase('tr') : x).join('-');
    };

    // Türkçe karşılıklar (MyMemory): birden çok anlam toplanır
    const fetchTurkish = async (word) => {
      const j = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(word) + '&langpair=en|tr');
      if (!j) return { meanings: [], quota: false };
      if (j.quotaFinished) return { meanings: [], quota: true };
      // Yalnızca kelimenin kendisiyle birebir eşleşen, makul kaliteli kayıtlar (cümle parçaları, ünlemli/garip girdiler elenir)
      const w = word.toLowerCase();
      const raw = [j.responseData && j.responseData.translatedText].concat(
        (j.matches || [])
          .filter(m => String(m.segment || '').trim().toLowerCase() === w)
          .filter(m => m.quality == null || +m.quality >= 60)
          .sort((a, b) => (+b.quality || 0) - (+a.quality || 0))
          .map(m => m.translation)
      );
      const seen = new Set(), meanings = [];
      raw.forEach(t => {
        if (!t) return;
        const v = String(t).trim().replace(/\.+$/, '').trim().toLocaleLowerCase('tr');
        if (!v || v === w || seen.has(v)) return;
        if (!/^[a-zçğıöşüâîû][a-zçğıöşüâîû' -]*[a-zçğıöşüâîû]$/i.test(v)) return;   // !, [ ], rakam, tek harf vb.
        if (v.split(/\s+/).length > 3) return;
        seen.add(v); meanings.push(v);
      });
      return { meanings: meanings.slice(0, 4), quota: false };
    };

    // Türkçe karşılıklar (Wiktionary, CC BY-SA): İngilizce Vikisözlük'teki "Translations" tablolarından, anlam başlığı ve türüyle.
    // Resmî MediaWiki API'si kullanılır (programla erişime izin verir).
    const cleanWikiItem = (s) => s
      .replace(/\{\{tt?\+?\|tr\|([^}|]+)[^}]*\}\}/g, '$1')
      .replace(/\{\{l\|tr\|([^}|]+)[^}]*\}\}/g, '$1')
      .replace(/\{\{[^}]*\}\}/g, '')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\([^)]*\)/g, '')
      .replace(/['"’]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const parseWiktionaryTurkish = (wikitext) => {
      if (!wikitext) return { senses: [], subpage: false };
      const parts = wikitext.split(/\n==(?!=)/);
      const en = parts.find(s => /^\s*English\s*==/.test(s)) || (parts[0].startsWith('==English==') ? parts[0] : '');
      const senses = [];
      let pos = null, sense = null;
      en.split('\n').forEach(line => {
        const h = line.match(/^===+\s*(Noun|Verb|Adjective|Adverb|Proper noun)\s*=+/);
        if (h) pos = h[1].toLowerCase();
        const tt = line.match(/\{\{trans-top(?:-also)?\|([^}|]*)/);
        if (tt) sense = tt[1].trim();
        else if (/\{\{trans-top\}\}/.test(line)) sense = '';
        if (/^\*\s*Turkish\s*:/.test(line)) {
          const body = line.replace(/^\*\s*Turkish\s*:/, '');
          const words = body.replace(/\{\{[^}]*\}\}/g, m => /^\{\{(tt?\+?|l)\|tr\|/.test(m) ? cleanWikiItem(m) + ',' : '')
            .split(/[,;]/).map(cleanWikiItem).filter(w => w && /^[a-zçğıöşüâîû][a-zçğıöşüâîû ' -]*$/i.test(w) && w.split(' ').length <= 4);
          if (words.length) senses.push({ pos, sense, words: [...new Set(words)] });
        }
      });
      return { senses, subpage: /\{\{see translation subpage/.test(en) };
    };

    const fetchWikiText = async (page) => {
      const j = await fetchJson('https://en.wiktionary.org/w/api.php?action=parse&page=' + encodeURIComponent(page) + '&prop=wikitext&format=json&formatversion=2&redirects=1&origin=*');
      return j && j.parse ? j.parse.wikitext : null;
    };

    const fetchWiktionaryTurkish = async (word, wantPos) => {
      let { senses, subpage } = parseWiktionaryTurkish(await fetchWikiText(word));
      if (subpage) {
        const sub = parseWiktionaryTurkish('==English==\n' + ((await fetchWikiText(word + '/translations').catch(() => null)) || ''));
        senses = senses.concat(sub.senses);
      }
      if (!senses.length) return { meanings: [], senses: [] };
      // İstenen türdeki anlamlar önce; en fazla 5 karşılık
      const ordered = [...senses.filter(s => s.pos === wantPos), ...senses.filter(s => s.pos !== wantPos)];
      const meanings = [];
      ordered.forEach(s => s.words.forEach(w => { if (meanings.length < 5 && !meanings.includes(w)) meanings.push(w); }));
      return { meanings, senses: ordered.slice(0, 4) };
    };

    // Önce Wiktionary, bulunamazsa MyMemory
    const fetchTurkishAuto = async (word, wantPos) => {
      try {
        const wk = await fetchWiktionaryTurkish(word, wantPos);
        if (wk.meanings.length) return { meanings: wk.meanings, senses: wk.senses, source: 'Wiktionary', quota: false };
      } catch (e) {}
      const mm = await fetchTurkish(word).catch(() => ({ meanings: [], quota: false }));
      return { meanings: mm.meanings, senses: [], source: mm.meanings.length ? 'MyMemory' : '', quota: mm.quota };
    };

    // Bir kelimenin tüm ayrıntıları: Türkçe anlam, IPA, okunuş, ses, tanım, örnekler, eş/zıt anlamlılar
    const dictCache = cacheGet(CACHE_KEYS.DICT);
    const fetchWordDetails = async (lemma, wantPos) => {
      const key = lemma + '|' + wantPos;
      if (dictCache[key]) return dictCache[key];
      const [dict, syn, ant, tr] = await Promise.all([
        fetchJson('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(lemma)).catch(() => null),
        fetchJson('https://api.datamuse.com/words?rel_syn=' + encodeURIComponent(lemma) + '&max=8').catch(() => []),
        fetchJson('https://api.datamuse.com/words?rel_ant=' + encodeURIComponent(lemma) + '&max=6').catch(() => []),
        fetchTurkishAuto(lemma, wantPos).catch(() => ({ meanings: [], senses: [], source: '', quota: false })),
      ]);
      const entries = Array.isArray(dict) ? dict : [];
      const phonetics = entries.flatMap(e => e.phonetics || []);
      let ipa = (entries.find(e => e.phonetic) || {}).phonetic || (phonetics.find(p => p.text) || {}).text || '';
      if (!ipa) {
        // Yedek: Datamuse telaffuz verisi (IPA)
        const pr = await fetchJson('https://api.datamuse.com/words?sp=' + encodeURIComponent(lemma) + '&md=r&ipa=1&max=1').catch(() => null);
        const tag = pr && pr[0] && (pr[0].tags || []).find(t => t.startsWith('ipa_pron:'));
        if (tag) ipa = tag.slice(9);
      }
      const audioUrl = (phonetics.find(p => p.audio && /-us\./.test(p.audio)) || phonetics.find(p => p.audio) || {}).audio || '';
      const meanings = entries.flatMap(e => e.meanings || []);
      const main = meanings.find(m => m.partOfSpeech === wantPos) || meanings[0];
      const pos = wantPos || (main && main.partOfSpeech) || 'noun';
      const defs = main ? (main.definitions || []) : [];
      const examples = meanings.flatMap(m => (m.definitions || []).map(d => d.example)).filter(Boolean).slice(0, 2);
      const uniq = (arr, n) => [...new Set(arr.map(x => String(x).trim().toLowerCase()).filter(x => x && x !== lemma))].slice(0, n);
      const synonyms = uniq([
        ...meanings.flatMap(m => (m.synonyms || []).concat((m.definitions || []).flatMap(d => d.synonyms || []))),
        ...(syn || []).map(x => x.word),
      ], 6);
      const antonyms = uniq([
        ...meanings.flatMap(m => (m.antonyms || []).concat((m.definitions || []).flatMap(d => d.antonyms || []))),
        ...(ant || []).map(x => x.word),
      ], 5);
      const details = {
        turkish: tr.meanings.join(', '),
        trSenses: tr.senses || [],
        trSource: tr.source || '',
        trQuota: tr.quota,
        ipa: ipa.replace(/^\/|\/$/g, ''),
        okunus: ipaToTurkish(ipa),
        audioUrl,
        partOfSpeech: pos,
        definition: defs.slice(0, 2).map(d => d.definition).join(' / '),
        examples,
        synonyms,
        antonyms,
      };
      if (!tr.quota) { dictCache[key] = details; cacheSet(CACHE_KEYS.DICT, dictCache); }
      return details;
    };

    // Tureng: kullanım koşulları otomatik veri çekmeyi yasakladığı için yalnızca kelime sayfasına bağlantı verilir
    // (kullanıcı sayfayı kendisi açar, anlamı kendisi kopyalar)
    const turengUrl = (word) => 'https://tureng.com/tr/turkce-ingilizce/' + encodeURIComponent(String(word || '').trim().toLowerCase());
    const TurengLink = ({ word, className }) => (
      <a
        href={turengUrl(word)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        title={'"' + word + '" kelimesini Tureng\'de aç (yeni sekme)'}
        className={"inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-950/60 border border-red-900 text-[10px] font-bold text-red-300 hover:bg-red-900 hover:text-white transition " + (className || '')}
      >
        Tureng ↗
      </a>
    );
    const isMissingMeaning = (c) => !c.turkish || /^\(anlam bulunamadı/.test(c.turkish);

    const playWord = (card) => {
      if (card.audioUrl) {
        const a = new Audio(card.audioUrl);
        a.play().catch(() => speakText(card.english));
      } else speakText(card.english);
    };

