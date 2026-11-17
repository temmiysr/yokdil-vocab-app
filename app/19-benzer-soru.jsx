    // --- BENZER SORU ÜRETİMİ ---
    // 1) Kural tabanlı (ücretsiz, çevrimdışı da çalışır): kısa şıklı sorularda (kelime, edat/gramer, bağlaç, cloze)
    //    aynı şıklar kullanıcının kendi metinlerindeki / kartlarındaki / sözlükteki başka cümlelere uygulanır.
    // 2) Claude ile (isteğe bağlı, kullanıcının kendi API anahtarı): her soru tipi için yeni sorular + Türkçe açıklama.
    const CLAUDE_KEY_STORAGE = 'yokdil_claude_api_key_v1';
    const getClaudeKey = () => { try { return localStorage.getItem(CLAUDE_KEY_STORAGE) || ''; } catch (e) { return ''; } };
    const setClaudeKey = (k) => { try { k ? localStorage.setItem(CLAUDE_KEY_STORAGE, k) : localStorage.removeItem(CLAUDE_KEY_STORAGE); } catch (e) {} };

    const simSentences = (text) => (text || '')
      .replace(/^##\s+.*$/gm, ' ')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z"“(])/)
      .map(s => s.trim())
      // Bozuk satırları ele (sayfa altlığı, harf harf aralıklı başlıklar)
      .filter(s => s.length >= 40 && s.length <= 320 && !/-{3,}/.test(s) && !/[·•]|www\.|\.com\b/i.test(s) && (s.match(/(?:^|\s)\p{L}(?=\s|$)/gu) || []).length <= 3 && /[.!?"”)]$/.test(s));

    async function genSimilarRule(q, { readings = [], cards = [], exams = [] }, max = 5) {
      const opts = q.options.map(o => (o || '').trim());
      if (opts.filter(Boolean).length < 4 || opts.some(o => o.split(/\s+/).length > 4)) {
        return { items: [], note: 'Bu soru tipinin şıkları uzun cümleler; ücretsiz üretici yalnızca kısa şıklı soruları (kelime, edat, bağlaç, cloze) çoğaltabilir. Bu tip için "Claude ile üret"i kullanın.' };
      }
      const pool = [], seen = new Set();
      const add = (s, src) => { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); pool.push({ s, src }); } };
      readings.forEach(r => simSentences(r.content).forEach(s => add(s, r.title)));
      cards.forEach(c => [c.originalSentence, ...(c.examples || [])].filter(Boolean).forEach(s => s.length >= 30 && add(s.trim(), 'Kart: ' + (c.lemma || c.english))));
      exams.forEach(ex => (ex.questions || []).forEach(x => x.passage && simSentences(x.passage).forEach(s => add(s, ex.title))));
      const original = (q.prompt || '').toLowerCase();
      const make = (sentence, word, answerIdx, options, src, note) => {
        const re = new RegExp('(^|[^A-Za-z])(' + escRe(word) + ')(?![A-Za-z])', 'i');
        const m = sentence.match(re);
        if (!m) return null;
        const at = m.index + m[1].length;
        const prompt = sentence.slice(0, at) + '----' + sentence.slice(at + m[2].length);
        const card = cards.find(c => String(c.lemma || c.english).toLowerCase() === word.toLowerCase());
        return {
          type: q.type || 'Benzer soru',
          prompt, options, answer: answerIdx,
          explain: '"' + options[answerIdx] + '"' + (card && card.turkish && !isMissingMeaning(card) ? ' (' + card.turkish + ')' : '') + ' bu cümlede doğru seçenektir. Kaynak: ' + src + '.' + (note ? ' ' + note : ''),
          cardIds: card ? [card.id] : [],
        };
      };
      const out = [];
      const order = shuffleArr(opts.map((o, i) => i)).filter(i => opts[i]);
      // 1. tur: tam eşleşme (şık metinde aynen geçiyor) ve diğer şıklar cümlede yok (belirsizlik olmasın)
      for (const i of order) {
        if (out.length >= max) break;
        const word = opts[i];
        const re = new RegExp('(^|[^A-Za-z])' + escRe(word) + '(?![A-Za-z])', 'i');
        const hits = shuffleArr(pool.filter(p => re.test(p.s) && p.s.toLowerCase() !== original && !opts.some((o, j) => j !== i && o && new RegExp('(^|[^A-Za-z])' + escRe(o) + '(?![A-Za-z])', 'i').test(p.s))));
        if (hits.length) { const it = make(hits[0].s, word, i, opts, hits[0].src); if (it) out.push(it); }
      }
      // 2. tur (tek kelimelik kelime şıkları): sözlük örnek cümleleri, şıklar yalın hâliyle
      const single = opts.every(o => /^[A-Za-z-]+$/.test(o));
      if (out.length < Math.min(3, max) && single && opts.every(o => !PREP_OPTIONS.includes(o.toLowerCase()))) {
        const lemmas = await Promise.all(opts.map(async o => { const r = await resolveLemma(o.toLowerCase()).catch(() => null); return (r && r.word) || o.toLowerCase(); }));
        const details = await Promise.all(lemmas.map(l => fetchWordDetails(l, '').catch(() => null)));
        for (const i of order) {
          if (out.length >= max) break;
          const d = details[i];
          const ex = d && (d.examples || []).find(s => /^[A-Z"“]/.test(s) && s.split(' ').length >= 6 && new RegExp('(^|[^A-Za-z])' + escRe(lemmas[i]) + '[a-z]{0,3}(?![A-Za-z])', 'i').test(s));
          if (!ex) continue;
          const word = (ex.match(new RegExp(escRe(lemmas[i]) + '[a-z]{0,3}', 'i')) || [lemmas[i]])[0];
          const it = make(ex, word, i, lemmas, 'sözlük örneği (dictionaryapi.dev)', 'Şıklar kelimelerin yalın hâlidir.');
          if (it) out.push(it);
        }
      }
      return { items: out, note: out.length ? '' : 'Kendi metinlerinizde ve sözlükte bu şıkları içeren uygun cümle bulunamadı. Daha çok okuma metni ekleyin ya da "Claude ile üret"i kullanın.' };
    }

    // Anthropic resmi SDK'sı tarayıcıda ESM olarak yüklenir (yalnızca "Claude ile üret" kullanılınca)
    let anthropicSdkPromise = null;
    const loadAnthropicSdk = () => {
      if (!anthropicSdkPromise) {
        // Babel'in import() ifadesini dönüştürmemesi için Function ile çağrılır
        anthropicSdkPromise = new Function('u', 'return import(u)')('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm')
          .catch(e => { anthropicSdkPromise = null; throw new Error('Claude kütüphanesi yüklenemedi (internet bağlantısını kontrol edin).'); });
      }
      return anthropicSdkPromise;
    };

    const SIMILAR_SCHEMA = {
      type: 'object',
      properties: {
        original_answer: { type: 'integer', description: '0-4 index of the correct option of the ORIGINAL question' },
        original_analysis_tr: { type: 'string', description: 'Turkish explanation of why that option is correct in the original question, including key vocabulary/grammar clues' },
        vocabulary: {
          type: 'array',
          items: { type: 'object', properties: { word: { type: 'string' }, turkish: { type: 'string' } }, required: ['word', 'turkish'], additionalProperties: false },
        },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              passage: { type: 'string', description: 'Shared passage if the question type needs one (cloze or reading), otherwise empty string' },
              prompt: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              answer: { type: 'integer', description: '0-4 index of the correct option' },
              explanation_tr: { type: 'string' },
            },
            required: ['passage', 'prompt', 'options', 'answer', 'explanation_tr'],
            additionalProperties: false,
          },
        },
      },
      required: ['original_answer', 'original_analysis_tr', 'vocabulary', 'questions'],
      additionalProperties: false,
    };

    async function genSimilarAI(q, meta, apiKey, count = 3) {
      const mod = await loadAnthropicSdk();
      const Anthropic = mod.default || mod.Anthropic;
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const original = [
        'Section: ' + (q.section || q.type) + (q.num ? ' (question ' + q.num + ')' : ''),
        meta && meta.field ? 'Exam field: ' + meta.field : '',
        q.passage ? 'Passage:\n' + q.passage : '',
        'Question: ' + (q.prompt || '(no stem: the blank is in the passage)'),
        ...q.options.map((o, i) => EXAM_LETTERS[i] + ') ' + o),
        q.answer >= 0 ? 'Official answer: ' + EXAM_LETTERS[q.answer] : 'The official answer is unknown; solve it yourself.',
      ].filter(Boolean).join('\n');
      let res;
      try {
        res = await client.beta.messages.create({
          model: 'claude-opus-5-5',
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: SIMILAR_SCHEMA } },
          system: 'You write practice questions for YÖKDİL, the Turkish academic English proficiency exam (80 multiple-choice questions, five options A-E, sections: vocabulary, grammar/prepositions, cloze test, sentence completion, English-Turkish translation, paragraph completion/irrelevant sentence, reading comprehension). The learner is a Turkish speaker. Solve the original question, explain it in Turkish, list the important words in it with Turkish meanings, then write new original questions of exactly the same type, difficulty and academic register (same field when given). Each new question has exactly 5 options with exactly one correct answer and plausible distractors. For cloze or reading questions, put the shared text in "passage". Do not copy the original sentence. All explanations must be in Turkish.',
          messages: [{ role: 'user', content: 'Original question:\n' + original + '\n\nWrite ' + count + ' new similar questions.' }],
        });
      } catch (err) {
        const status = err && err.status;
        if ((mod.AuthenticationError && err instanceof mod.AuthenticationError) || status === 401) throw new Error('API anahtarı geçersiz. console.anthropic.com adresinden aldığınız anahtarı kontrol edin.');
        if ((mod.PermissionDeniedError && err instanceof mod.PermissionDeniedError) || status === 403) throw new Error('Bu API anahtarının bu modele erişim izni yok.');
        if ((mod.RateLimitError && err instanceof mod.RateLimitError) || status === 429) throw new Error('Çok sık istek gönderildi ya da kota doldu; biraz sonra tekrar deneyin.');
        if (status === 400 && /credit|balance/i.test(err.message || '')) throw new Error('Anthropic hesabınızda kredi yok (Billing bölümünden yükleyin).');
        if ((mod.APIConnectionError && err instanceof mod.APIConnectionError) || !status) throw new Error('Claude sunucusuna bağlanılamadı (internet bağlantısını kontrol edin).');
        throw new Error('Claude hatası (' + status + '): ' + (err.message || ''));
      }
      if (res.stop_reason === 'refusal') throw new Error('Claude bu soruyu yanıtlamayı reddetti. Soruyu değiştirip tekrar deneyin.');
      if (res.stop_reason === 'max_tokens') throw new Error('Yanıt yarım kaldı; daha az soru isteyip tekrar deneyin.');
      const textBlock = (res.content || []).find(b => b.type === 'text');
      if (!textBlock) throw new Error('Claude boş yanıt döndürdü.');
      const data = JSON.parse(textBlock.text);
      const items = (data.questions || [])
        .filter(x => Array.isArray(x.options) && x.options.length === 5 && x.answer >= 0 && x.answer <= 4 && x.prompt != null)
        .map(x => ({ type: (q.type || 'Benzer soru') + ' · Claude', passage: x.passage || '', prompt: x.prompt, options: x.options, answer: x.answer, explain: x.explanation_tr, cardIds: [] }));
      return {
        items,
        originalAnswer: data.original_answer >= 0 && data.original_answer <= 4 ? data.original_answer : -1,
        analysis: data.original_analysis_tr || '',
        vocabulary: data.vocabulary || [],
        usage: res.usage || null,
      };
    }

    // Tek bir sorunun altında açılan "Benzer soru üret" paneli
    function SimilarPanel({ q, meta, readings, cards, exams, onPractice, onSetAnswer }) {
      const [busy, setBusy] = useState('');
      const [err, setErr] = useState('');
      const [res, setRes] = useState(null);       // { items, note, analysis, vocabulary, originalAnswer, usage, by }
      const [picked, setPicked] = useState({});
      const [key, setKey] = useState(getClaudeKey);
      const [keyOpen, setKeyOpen] = useState(false);
      const runRule = async () => {
        setBusy('rule'); setErr(''); setPicked({});
        try { const r = await genSimilarRule(q, { readings, cards, exams }, 5); setRes({ ...r, by: 'rule' }); }
        catch (e) { setErr(e.message || 'Üretilemedi.'); } finally { setBusy(''); }
      };
      const runAI = async () => {
        if (!key) { setKeyOpen(true); return; }
        setBusy('ai'); setErr(''); setPicked({});
        try { const r = await genSimilarAI(q, meta, key, 3); setRes({ ...r, by: 'ai', note: r.items.length ? '' : 'Claude geçerli soru döndürmedi.' }); }
        catch (e) { setErr(e.message || 'Üretilemedi.'); } finally { setBusy(''); }
      };
      return (
        <div className="mt-2 p-3 rounded-xl bg-slate-900/70 border border-indigo-900/50 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" disabled={!!busy} onClick={runRule} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50">
              {busy === 'rule' ? 'Üretiliyor…' : '⚙ Kendi metinlerimden üret (ücretsiz)'}
            </button>
            <button type="button" disabled={!!busy} onClick={runAI} className="px-2.5 py-1.5 rounded-lg bg-indigo-700 text-[11px] font-bold text-white hover:bg-indigo-600 disabled:opacity-50">
              {busy === 'ai' ? 'Claude yazıyor… (20-60 sn)' : '✨ Claude ile çöz ve üret'}
            </button>
            <button type="button" onClick={() => setKeyOpen(!keyOpen)} className="text-[10px] text-slate-400 hover:text-indigo-300">🔑 {key ? 'Anahtar kayıtlı' : 'API anahtarı'}</button>
          </div>
          {keyOpen && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
              <p>Claude ile üretim için kendi <b className="text-slate-200">Anthropic API anahtarınız</b> gerekir (console.anthropic.com → API Keys). Her üretim, Anthropic hesabınızdan küçük bir ücretle faturalandırılır. Anahtar yalnızca bu tarayıcıda saklanır, buluta ve yedeğe gönderilmez; istekler doğrudan Anthropic'e gider. Paylaşılan bir bilgisayarda kullanmayın.</p>
              <div className="flex gap-1.5">
                <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value.trim())} placeholder="sk-ant-..." className="flex-1 px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white font-mono" />
                <button type="button" onClick={() => { setClaudeKey(key); setKeyOpen(false); }} className="px-3 py-1.5 rounded bg-blue-600 text-xs font-bold text-white">Kaydet</button>
                {getClaudeKey() && <button type="button" onClick={() => { setClaudeKey(''); setKey(''); }} className="px-2 py-1.5 rounded bg-slate-800 text-xs text-red-300">Sil</button>}
              </div>
            </div>
          )}
          {err && <p className="text-[11px] text-red-300">⚠ {err}</p>}
          {res && (
            <div className="space-y-2">
              {res.by === 'ai' && res.analysis && (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/50 text-[11px] text-emerald-100 space-y-1">
                  <p><b>Claude'un çözümü: {res.originalAnswer >= 0 ? EXAM_LETTERS[res.originalAnswer] + ') ' + q.options[res.originalAnswer] : '—'}</b>{q.answer >= 0 && res.originalAnswer >= 0 && res.originalAnswer !== q.answer ? <span className="text-amber-300"> (resmî anahtarla farklı: {EXAM_LETTERS[q.answer]})</span> : null}</p>
                  <p className="whitespace-pre-wrap text-slate-300">{res.analysis}</p>
                  {q.answer < 0 && res.originalAnswer >= 0 && onSetAnswer && (
                    <button type="button" onClick={() => onSetAnswer(res.originalAnswer)} className="text-[10px] font-bold text-amber-300 hover:underline">Bu cevabı anahtara yaz (resmî anahtar yoksa)</button>
                  )}
                  {res.vocabulary.length > 0 && <p className="text-slate-400">{res.vocabulary.map(v => v.word + ' = ' + v.turkish).join(' · ')}</p>}
                </div>
              )}
              {res.note && <p className="text-[11px] text-amber-300">{res.note}</p>}
              {res.items.map((it, k) => {
                const my = picked[k];
                return (
                  <div key={k} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                    {it.passage && <p className="text-[11px] text-slate-400 font-serif whitespace-pre-wrap max-h-32 overflow-y-auto">{it.passage}</p>}
                    <p className="text-slate-100 font-serif">{k + 1}. {it.prompt}</p>
                    <div className="grid gap-1">
                      {it.options.map((o, i) => (
                        <button type="button" key={i} disabled={my !== undefined} onClick={() => setPicked({ ...picked, [k]: i })}
                          className={"text-left px-2 py-1 rounded border text-[11px] " + (my === undefined ? 'border-slate-800 hover:border-blue-500' : i === it.answer ? 'border-emerald-500 text-emerald-200' : i === my ? 'border-red-500 text-red-200' : 'border-slate-800 text-slate-500')}>
                          <b>{EXAM_LETTERS[i]})</b> {o}
                        </button>
                      ))}
                    </div>
                    {my !== undefined && <p className="text-[11px] text-slate-400">{my === it.answer ? '✓ ' : '✗ '}{it.explain}</p>}
                  </div>
                );
              })}
              {res.items.length > 1 && onPractice && (
                <button type="button" onClick={() => onPractice(res.items)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-[11px] font-bold text-white">Bunları sınav olarak çöz ({res.items.length})</button>
              )}
              {res.usage && <p className="text-[10px] text-slate-600">Kullanım: {res.usage.input_tokens} girdi + {res.usage.output_tokens} çıktı token</p>}
            </div>
          )}
        </div>
      );
    }

    // Seçenek kelimelerinin Türkçe anlamları (kelime/edat sorularında hızlı analiz)
    function OptionMeanings({ options }) {
      const [rows, setRows] = useState(null);
      useEffect(() => {
        let alive = true;
        Promise.all(options.map(async o => {
          const w = (o || '').trim();
          if (!w || w.split(/\s+/).length > 3) return { w, tr: '' };
          const r = await fetchTurkishAuto(w.toLowerCase(), '').catch(() => ({ meanings: [] }));
          return { w, tr: (r.meanings || []).slice(0, 3).join(', ') };
        })).then(r => alive && setRows(r));
        return () => { alive = false; };
      }, [options.join('|')]);
      if (!rows) return <p className="text-[11px] text-slate-500">Şıkların anlamları aranıyor…</p>;
      return (
        <div className="grid gap-0.5 text-[11px]">
          {rows.map((r, i) => r.w && <p key={i} className="text-slate-300"><b className="text-slate-400">{EXAM_LETTERS[i]})</b> {r.w} <span className="text-slate-500">→</span> <span className="text-emerald-300">{r.tr || '—'}</span> <TurengLink word={r.w} className="ml-1 !py-0" /></p>)}
        </div>
      );
    }

