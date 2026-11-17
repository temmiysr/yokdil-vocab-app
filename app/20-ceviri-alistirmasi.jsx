    // --- ÇEVİRİ ALIŞTIRMASI ---
    // Kullanıcı cümleyi kendisi çevirir; Claude (kullanıcının API anahtarıyla) puanlar ve hataları Türkçe açıklar.
    // Anahtar yoksa: cümle bir deneme sorusundan geliyorsa resmî doğru şık örnek çeviri olarak gösterilir.
    async function callClaudeJson(apiKey, system, userText, schema, maxTokens = 8000) {
      const mod = await loadAnthropicSdk();
      const Anthropic = mod.default || mod.Anthropic;
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      let res;
      try {
        res = await client.beta.messages.create({
          model: 'claude-opus-5-5',
          max_tokens: maxTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
          system,
          messages: [{ role: 'user', content: userText }],
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
      if (res.stop_reason === 'refusal') throw new Error('Claude bu isteği yanıtlamayı reddetti.');
      if (res.stop_reason === 'max_tokens') throw new Error('Yanıt yarım kaldı; tekrar deneyin.');
      const block = (res.content || []).find(b => b.type === 'text');
      if (!block) throw new Error('Claude boş yanıt döndürdü.');
      return { data: JSON.parse(block.text), usage: res.usage || null };
    }

    const TRANSLATION_SCHEMA = {
      type: 'object',
      properties: {
        score: { type: 'integer', description: '0-10 overall quality of the learner translation' },
        verdict_tr: { type: 'string', description: 'One or two sentence overall assessment in Turkish' },
        mistakes: {
          type: 'array',
          items: {
            type: 'object',
            properties: { part: { type: 'string' }, problem_tr: { type: 'string' }, fix: { type: 'string' } },
            required: ['part', 'problem_tr', 'fix'], additionalProperties: false,
          },
        },
        model_translation: { type: 'string' },
        key_vocabulary: {
          type: 'array',
          items: { type: 'object', properties: { word: { type: 'string' }, turkish: { type: 'string' } }, required: ['word', 'turkish'], additionalProperties: false },
        },
      },
      required: ['score', 'verdict_tr', 'mistakes', 'model_translation', 'key_vocabulary'],
      additionalProperties: false,
    };

    function TranslationPractice({ readings, exams, onBack, onAnswer }) {
      const [dir, setDir] = useState('en-tr');
      const pool = useMemo(() => {
        const out = [];
        const seen = new Set();
        const add = (text, src, ref) => { const k = text.toLowerCase(); if (!seen.has(k) && text.length >= 40 && text.length <= 300) { seen.add(k); out.push({ text, src, ref }); } };
        if (dir === 'en-tr') {
          (exams || []).forEach(ex => (ex.questions || []).forEach(q => {
            if (qSection(q) === 'Çeviri (İng→Tr)' && q.prompt) add(q.prompt, ex.title + ', soru ' + q.num, q.answer >= 0 ? q.options[q.answer] : '');
          }));
          readings.forEach(r => simSentences(r.content).forEach(s => add(s, r.title, '')));
          (exams || []).forEach(ex => (ex.questions || []).forEach(q => q.passage && simSentences(q.passage).forEach(s => add(s, ex.title, ''))));
        } else {
          (exams || []).forEach(ex => (ex.questions || []).forEach(q => {
            if (qSection(q) === 'Çeviri (Tr→İng)' && q.prompt) add(q.prompt, ex.title + ', soru ' + q.num, q.answer >= 0 ? q.options[q.answer] : '');
          }));
        }
        return shuffleArr(out);
      }, [dir, readings.length, (exams || []).length]);
      const [i, setI] = useState(0);
      const [text, setText] = useState('');
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');
      const [fb, setFb] = useState(null);
      const [showRef, setShowRef] = useState(false);
      const [key, setKey] = useState(getClaudeKey);
      const [keyOpen, setKeyOpen] = useState(false);
      useEffect(() => { setI(0); setText(''); setFb(null); setShowRef(false); setErr(''); }, [dir]);
      const item = pool[i % Math.max(1, pool.length)];
      const next = () => { setI(i + 1); setText(''); setFb(null); setShowRef(false); setErr(''); };
      const check = async () => {
        if (!key) { setKeyOpen(true); return; }
        setBusy(true); setErr(''); setFb(null);
        try {
          const target = dir === 'en-tr' ? 'Turkish' : 'English';
          const { data, usage } = await callClaudeJson(key,
            'You are a translation tutor for YÖKDİL, the Turkish academic English exam. The learner is a native Turkish speaker. Grade the learner\'s ' + target + ' translation of the source sentence for meaning accuracy first, then grammar and natural academic style. Be encouraging but precise. List only real mistakes (at most 5), each with the problematic part of the learner text, the problem explained in Turkish, and a corrected version. Give one natural model translation and the 3-6 most useful words from the source with Turkish meanings. All explanations in Turkish.',
            'Source (' + (dir === 'en-tr' ? 'English' : 'Turkish') + '): ' + item.text + '\n\nLearner translation (' + target + '): ' + text.trim() + (item.ref ? '\n\nOfficial exam answer for reference: ' + item.ref : ''),
            TRANSLATION_SCHEMA);
          setFb({ ...data, usage });
          onAnswer && onAnswer('Çeviri alıştırması', (data.score || 0) >= 7);
        } catch (e) { setErr(e.message || 'Değerlendirilemedi.'); }
        finally { setBusy(false); }
      };
      return (
        <div className="max-w-2xl mx-auto space-y-3">
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-blue-400 font-bold">← Sınav türleri</button>
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-base text-white mr-auto">✍️ Çeviri alıştırması</h3>
              {[['en-tr', 'İngilizce → Türkçe'], ['tr-en', 'Türkçe → İngilizce']].map(([k, l]) => (
                <button key={k} onClick={() => setDir(k)} className={"px-3 py-1.5 rounded-lg text-xs font-bold " + (dir === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')}>{l}</button>
              ))}
            </div>
            {!item ? (
              <p className="text-xs text-amber-300">{dir === 'en-tr' ? 'Çevrilecek cümle yok: okuma metni yükleyin ya da çeviri sorusu olan bir deneme ekleyin.' : 'Türkçe → İngilizce için çeviri sorusu olan bir deneme gerekir (Sınavlar → Çıkmış Sınav / Deneme yükle).'}</p>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-sm text-slate-100 font-serif leading-relaxed">{item.text}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Kaynak: {item.src}</p>
                </div>
                <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={dir === 'en-tr' ? 'Türkçe çevirinizi yazın…' : 'İngilizce çevirinizi yazın…'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white" />
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={busy || text.trim().length < 5} onClick={check} className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Claude değerlendiriyor…' : '✨ Claude ile değerlendir'}</button>
                  {item.ref && <button onClick={() => setShowRef(!showRef)} className="px-3 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">{showRef ? 'Örnek çeviriyi gizle' : 'Sınavdaki doğru şıkkı göster'}</button>}
                  <button onClick={next} className="px-3 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-200 ml-auto">Sonraki cümle →</button>
                  <button type="button" onClick={() => setKeyOpen(!keyOpen)} className="text-[10px] text-slate-400 hover:text-indigo-300">🔑 {key ? 'Anahtar kayıtlı' : 'API anahtarı'}</button>
                </div>
                {keyOpen && (
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                    <p>Değerlendirme için kendi <b className="text-slate-200">Anthropic API anahtarınız</b> gerekir (console.anthropic.com → API Keys); her değerlendirme hesabınızdan küçük bir ücretle faturalandırılır. Anahtar yalnızca bu tarayıcıda saklanır.</p>
                    <div className="flex gap-1.5">
                      <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value.trim())} placeholder="sk-ant-..." className="flex-1 px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white font-mono" />
                      <button type="button" onClick={() => { setClaudeKey(key); setKeyOpen(false); }} className="px-3 py-1.5 rounded bg-blue-600 text-xs font-bold text-white">Kaydet</button>
                    </div>
                  </div>
                )}
                {showRef && item.ref && <p className="text-xs text-emerald-200 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/50">Sınavdaki doğru şık: {item.ref}</p>}
                {err && <p className="text-[11px] text-red-300">⚠ {err}</p>}
                {fb && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-indigo-900/50 space-y-2 text-xs">
                    <p className="font-bold"><span className={fb.score >= 8 ? 'text-emerald-400' : fb.score >= 5 ? 'text-amber-300' : 'text-red-400'}>{fb.score}/10</span> <span className="text-slate-200 font-normal">{fb.verdict_tr}</span></p>
                    {fb.mistakes.length > 0 && (
                      <div className="space-y-1">
                        {fb.mistakes.map((m, k) => <p key={k} className="text-slate-300"><span className="text-red-300 line-through">{m.part}</span> → <span className="text-emerald-300">{m.fix}</span><br /><span className="text-slate-400">{m.problem_tr}</span></p>)}
                      </div>
                    )}
                    <p className="text-slate-300"><b className="text-slate-400">Örnek çeviri:</b> {fb.model_translation}</p>
                    {fb.key_vocabulary.length > 0 && <p className="text-slate-400">{fb.key_vocabulary.map(v => v.word + ' = ' + v.turkish).join(' · ')}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

