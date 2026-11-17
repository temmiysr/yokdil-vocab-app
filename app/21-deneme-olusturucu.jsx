    // --- YÖKDİL / YDS TARZI DENEME OLUŞTURUCU ---
    // Bölümler gerçek sınavdaki sırayla: kelime/dil bilgisi, cloze parçaları, cümle tamamlama, çeviri,
    // paragraf tamamlama, anlam bütünlüğü, uzun okuma parçaları (her parçaya 3 soru)…
    // Oluşan deneme "Çıkmış Sınavlarım"a kaydedilir ve gerçek sınav ekranında çözülür.
    const EXAM_BLUEPRINTS = {
      'YÖKDİL': {
        full: [{ type: 'Kelime & Dil Bilgisi', n: 20 }, { type: 'Cloze Test', passages: 2, per: 5 }, { type: 'Cümle Tamamlama', n: 11 }, { type: 'Çeviri (İng→Tr)', n: 6 }, { type: 'Çeviri (Tr→İng)', n: 6 }, { type: 'Paragraf Tamamlama', n: 6 }, { type: 'Anlam Bütünlüğü', n: 6 }, { type: 'Okuma', passages: 5, per: 3 }],
        half: [{ type: 'Kelime & Dil Bilgisi', n: 10 }, { type: 'Cloze Test', passages: 1, per: 5 }, { type: 'Cümle Tamamlama', n: 4 }, { type: 'Çeviri (İng→Tr)', n: 3 }, { type: 'Çeviri (Tr→İng)', n: 3 }, { type: 'Paragraf Tamamlama', n: 3 }, { type: 'Anlam Bütünlüğü', n: 3 }, { type: 'Okuma', passages: 3, per: 3 }],
        mini: [{ type: 'Kelime & Dil Bilgisi', n: 5 }, { type: 'Cloze Test', passages: 1, per: 4 }, { type: 'Cümle Tamamlama', n: 2 }, { type: 'Çeviri (İng→Tr)', n: 1 }, { type: 'Çeviri (Tr→İng)', n: 1 }, { type: 'Paragraf Tamamlama', n: 2 }, { type: 'Anlam Bütünlüğü', n: 2 }, { type: 'Okuma', passages: 1, per: 3 }],
      },
      'YDS': {
        full: [{ type: 'Kelime & Dil Bilgisi', n: 16 }, { type: 'Cloze Test', passages: 2, per: 5 }, { type: 'Cümle Tamamlama', n: 10 }, { type: 'Çeviri (İng→Tr)', n: 6 }, { type: 'Çeviri (Tr→İng)', n: 6 }, { type: 'Okuma', passages: 4, per: 3 }, { type: 'Diyalog', n: 6 }, { type: 'Yakın Anlam', n: 5 }, { type: 'Paragraf Tamamlama', n: 4 }, { type: 'Anlam Bütünlüğü', n: 5 }],
        half: [{ type: 'Kelime & Dil Bilgisi', n: 8 }, { type: 'Cloze Test', passages: 1, per: 5 }, { type: 'Cümle Tamamlama', n: 5 }, { type: 'Çeviri (İng→Tr)', n: 3 }, { type: 'Çeviri (Tr→İng)', n: 3 }, { type: 'Okuma', passages: 2, per: 3 }, { type: 'Diyalog', n: 3 }, { type: 'Yakın Anlam', n: 2 }, { type: 'Paragraf Tamamlama', n: 2 }, { type: 'Anlam Bütünlüğü', n: 3 }],
        mini: [{ type: 'Kelime & Dil Bilgisi', n: 4 }, { type: 'Cloze Test', passages: 1, per: 4 }, { type: 'Cümle Tamamlama', n: 2 }, { type: 'Çeviri (İng→Tr)', n: 1 }, { type: 'Çeviri (Tr→İng)', n: 1 }, { type: 'Okuma', passages: 1, per: 3 }, { type: 'Diyalog', n: 1 }, { type: 'Yakın Anlam', n: 1 }, { type: 'Paragraf Tamamlama', n: 1 }, { type: 'Anlam Bütünlüğü', n: 2 }],
      },
    };
    const blueprintCount = (bp) => bp.reduce((a, s) => a + (s.n || s.passages * s.per), 0);
    // Bölüm talimatları (sınav ekranında bölüm başında gösterilir)
    const SECTION_INSTRUCTIONS = {
      'Kelime & Dil Bilgisi': 'Cümlede boş bırakılan yere uygun düşen sözcük ya da ifadeyi bulunuz.',
      'Cloze Test': 'Aşağıdaki parçada numaralanmış yerlere uygun düşen sözcük ya da ifadeyi bulunuz.',
      'Cümle Tamamlama': 'Verilen cümleyi uygun şekilde tamamlayan ifadeyi bulunuz.',
      'Soru Bulma': 'Verilen cümlenin hangi sorunun cevabı olduğunu bulunuz.',
      'Çeviri (İng→Tr)': 'Verilen İngilizce cümleye anlamca en yakın Türkçe cümleyi bulunuz.',
      'Çeviri (Tr→İng)': 'Verilen Türkçe cümleye anlamca en yakın İngilizce cümleyi bulunuz.',
      'Okuma': 'Aşağıdaki parçaya göre soruları cevaplayınız.',
      'Yakın Anlam': 'Verilen cümleye anlamca en yakın cümleyi bulunuz.',
      'Paragraf Tamamlama': 'Boş bırakılan yere, parçada anlam bütünlüğünü sağlamak için getirilebilecek cümleyi bulunuz.',
      'Durum': 'Verilen durumda söylenebilecek ifadeyi bulunuz.',
      'Diyalog': 'Karşılıklı konuşmanın boş bırakılan kısmını tamamlayabilecek ifadeyi bulunuz.',
      'Anlam Bütünlüğü': 'Cümleler sırasıyla okunduğunda parçanın anlam bütünlüğünü bozan cümleyi bulunuz.',
    };
    // Claude için bölüm tarifleri
    const SECTION_SPECS = {
      'Kelime & Dil Bilgisi': (s) => `Write ${s.n} separate questions. Each prompt is ONE academic sentence (18-35 words) with one blank written as "----" (a few may have two blanks "---- ... ----" with two-part options like "had been / would"). Mix: about 60% vocabulary (nouns, verbs, adjectives, adverbs, phrasal verbs at B2-C1 academic level) and 40% grammar (tenses, modals, passives, conditionals, relative pronouns, conjunctions, prepositions). Options are single words or short phrases of the same part of speech/form. passage = "".`,
      'Cloze Test': (s) => `Write ${s.passages} passage(s). Each passage is an academic paragraph of 130-190 words with exactly ${s.per} numbered blanks written as "(1) ----", "(2) ----", … "(${s.per}) ----" in order. The blanks test prepositions, conjunctions/linkers, verb tenses and vocabulary. For each passage give exactly ${s.per} questions in blank order; each question's prompt = "" and its options are the 5 candidates for that blank.`,
      'Cümle Tamamlama': (s) => `Write ${s.n} separate questions. Each prompt is an incomplete complex academic sentence with one clause replaced by "----" (the missing part may be at the start, middle or end). Options are 5 clauses; only one completes the sentence logically and grammatically (pay attention to conjunctions, tense agreement and meaning). passage = "".`,
      'Çeviri (İng→Tr)': (s) => `Write ${s.n} separate questions. Each prompt is ONE English academic sentence (25-40 words). Options are 5 Turkish sentences; exactly one is the closest in meaning; distractors change tense, quantity, cause-effect, negation or focus subtly. passage = "".`,
      'Çeviri (Tr→İng)': (s) => `Write ${s.n} separate questions. Each prompt is ONE Turkish academic sentence (20-35 words). Options are 5 English sentences; exactly one is the closest in meaning; distractors change tense, quantity, cause-effect, negation or focus subtly. passage = "".`,
      'Paragraf Tamamlama': (s) => `Write ${s.n} separate questions. Each prompt is an academic paragraph of 5-6 sentences in which one sentence (beginning, middle or end) is replaced by "----". Options are 5 full sentences; exactly one restores coherence. passage = "".`,
      'Anlam Bütünlüğü': (s) => `Write ${s.n} separate questions. Each prompt is a paragraph of exactly 5 sentences labelled "(I) … (II) … (III) … (IV) … (V) …"; exactly one sentence (never sentence I) breaks the flow/topic although it uses related words. Options must be exactly ["I", "II", "III", "IV", "V"]. passage = "".`,
      'Okuma': (s) => `Write ${s.passages} reading passage(s). Each passage is an academic text of 260-360 words (2-3 paragraphs) followed by exactly ${s.per} questions about it: main idea/purpose, specific detail, inference ("It can be inferred…"), vocabulary or reference in context, or the author's attitude. Prompts usually end with "----" (e.g. "According to the passage, ----."). Use different topics for different passages.`,
      'Diyalog': (s) => `Write ${s.n} separate questions. Each prompt is a short dialogue of 4-6 lines between two named speakers (e.g. "Emma: …") in an academic or everyday context, with one line replaced by "----". Options are 5 possible lines; exactly one fits. passage = "".`,
      'Yakın Anlam': (s) => `Write ${s.n} separate questions. Each prompt is ONE English sentence (20-35 words). Options are 5 English sentences; exactly one is closest in meaning (a paraphrase); distractors change logic, tense or emphasis. passage = "".`,
      'Durum': (s) => `Write ${s.n} separate questions. Each prompt describes a situation in English (2-3 sentences) ending with a question like "What would you most probably say?". Options are 5 utterances; exactly one is most appropriate. passage = "".`,
    };
    const MOCK_SCHEMA = {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              passage: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
                    answer: { type: 'integer', description: '0-4 index of the correct option' },
                    explanation_tr: { type: 'string', description: 'Short Turkish explanation of why the answer is correct' },
                  },
                  required: ['prompt', 'options', 'answer', 'explanation_tr'], additionalProperties: false,
                },
              },
            },
            required: ['passage', 'questions'], additionalProperties: false,
          },
        },
      },
      required: ['groups'], additionalProperties: false,
    };
    const FIELD_TOPICS = {
      'Fen Bilimleri': 'science and engineering (physics, chemistry, biology, earth sciences, astronomy, environmental science, technology)',
      'Sağlık Bilimleri': 'health sciences (medicine, public health, nutrition, psychology, pharmacology, nursing, genetics)',
      'Sosyal Bilimler': 'social sciences (history, sociology, economics, education, linguistics, political science, archaeology)',
      'Genel': 'general academic topics (science, society, history, culture, technology)',
    };
    async function genSectionAI(apiKey, kind, field, spec, focusWords) {
      const want = spec.n || spec.passages * spec.per;
      const { data } = await callClaudeJson(apiKey,
        'You write original practice questions for the Turkish academic English exams ' + kind + ' (ÖSYM format: 5 options A-E, exactly one correct). Topics: ' + (FIELD_TOPICS[field] || FIELD_TOPICS.Genel) + '. Level: B2-C1, formal academic register like real ' + kind + ' booklets. Never copy real exam questions; write new ones. Distractors must be plausible but clearly wrong for a careful reader. Vary which option (A-E) is correct. Explanations are short and in Turkish.',
        'Section: ' + spec.type + '\n' + SECTION_SPECS[spec.type](spec) + (focusWords && focusWords.length && spec.type === 'Kelime & Dil Bilgisi' ? '\nWhere natural, use some of these words the learner is studying (as the correct answer or as distractors): ' + focusWords.join(', ') + '.' : ''),
        MOCK_SCHEMA, 16000);
      const groups = (data.groups || []).map(g => ({
        passage: (g.passage || '').trim(),
        questions: (g.questions || []).filter(q => Array.isArray(q.options) && q.options.length === 5 && q.answer >= 0 && q.answer <= 4),
      })).filter(g => g.questions.length);
      const got = groups.reduce((a, g) => a + g.questions.length, 0);
      if (got < Math.ceil(want * 0.6)) throw new Error(spec.type + ': yeterli soru üretilemedi (' + got + '/' + want + ').');
      return groups;
    }

    // Ücretsiz cloze: kendi metinlerinizden bir paragraf alınır, bağlaç ve edatlar numaralı boşluk olur
    function genClozeFromReadings(readings, passages, per) {
      const paras = [];
      readings.forEach(r => plainText(r.content).split(/\n\s*\n/).forEach(p => {
        const t = p.replace(/\s+/g, ' ').trim();
        const words = t.split(' ').length;
        if (words >= 70 && words <= 230 && !/[·•]|www\./.test(t)) paras.push(t);
      }));
      const out = [];
      for (const p of shuffleArr(paras)) {
        if (out.length >= passages) break;
        const hits = [];
        LINKER_LIST.forEach(L => { for (const m of p.matchAll(new RegExp('\\b' + escRe(L.w) + '\\b', 'gi'))) hits.push({ i: m.index, len: m[0].length, w: m[0], pool: 'linker', cat: L.cat }); });
        PREP_OPTIONS.forEach(w => { for (const m of p.matchAll(new RegExp('\\b' + w + '\\b', 'g'))) hits.push({ i: m.index, len: m[0].length, w, pool: 'prep' }); });
        hits.sort((a, b) => a.i - b.i);
        // birbirine en az 60 karakter uzak, çakışmayan boşluklar; bağlaçlar öncelikli
        const chosen = [];
        [...hits.filter(h => h.pool === 'linker'), ...shuffleArr(hits.filter(h => h.pool === 'prep'))].forEach(h => {
          if (chosen.length >= per) return;
          if (chosen.some(c => Math.abs(c.i - h.i) < 60)) return;
          chosen.push(h);
        });
        if (chosen.length < per) continue;
        chosen.sort((a, b) => a.i - b.i);
        let text = '', last = 0;
        const qs = chosen.map((h, k) => {
          text += p.slice(last, h.i) + '(' + (k + 1) + ') ----';
          last = h.i + h.len;
          const atStart = h.i === 0 || /[.!?]\s*$/.test(p.slice(0, h.i));
          const cap = (w) => atStart ? w.charAt(0).toUpperCase() + w.slice(1) : w;
          const distract = h.pool === 'prep'
            ? pickN(PREP_OPTIONS.filter(x => x !== h.w.toLowerCase()), 4)
            : pickN(Object.keys(LINKERS).filter(c => c !== h.cat), 4).map(c => pickN(LINKERS[c], 1)[0]);
          const correct = cap(h.w.toLowerCase());
          const opts = shuffleArr([correct, ...distract.map(cap)]);
          return { prompt: '', options: opts, answer: opts.indexOf(correct), explanation_tr: '"' + h.w.toLowerCase() + '" metindeki özgün ifadedir' + (h.cat ? ' (' + h.cat + ' bildirir).' : '.') };
        });
        text += p.slice(last);
        out.push({ passage: text, questions: qs });
      }
      return out;
    }
    // Ücretsiz bölümler: kendi kart ve metinlerinizden (okuma, çeviri gibi bölümler için Claude ya da yüklenen deneme gerekir)
    function genSectionOffline(spec, cards, readings) {
      if (spec.type === 'Kelime & Dil Bilgisi') {
        const qs = [...genVocabQuestions(cards, spec.n), ...genLinkerQuestions(readings, spec.n)].slice(0, spec.n);
        return shuffleArr(qs).map(q => ({ passage: '', questions: [{ prompt: q.prompt, options: q.options, answer: q.answer, explanation_tr: q.explain || '' }] }));
      }
      if (spec.type === 'Cloze Test') return genClozeFromReadings(readings, spec.passages, spec.per);
      if (spec.type === 'Anlam Bütünlüğü') {
        return genIrrelevantQuestions(readings, spec.n).map(q => ({ passage: '', questions: [{ prompt: q.prompt.replace(/^Aşağıdaki parçada[^\n]*\n\n/, ''), options: q.options, answer: q.answer, explanation_tr: q.explain || '' }] }));
      }
      return [];
    }
    // Bölüm gruplarını numaralı sınav sorularına çevir
    function assembleMockExam(sectionsOut) {
      const questions = [];
      let num = 1;
      sectionsOut.forEach(({ type, groups }) => groups.forEach(g => {
        const start = num;
        let passage = g.passage || '';
        if (type === 'Cloze Test') passage = passage.replace(/\((\d{1,2})\)/g, (m, k) => '(' + (start + +k - 1) + ')');
        g.questions.forEach(q => {
          questions.push({ num, prompt: q.prompt || '', options: q.options.map(o => String(o).trim()), answer: q.answer, correctLetter: EXAM_LETTERS[q.answer], category: type, ...(passage ? { passage } : {}), ...(q.explanation_tr ? { explanation: q.explanation_tr } : {}) });
          num++;
        });
      }));
      return questions;
    }

    // Zayıf bölümlere göre şablon: son denemelerde ortalamanın altında kalan bölümler artırılır, iyi gidenler azaltılır
    function adaptBlueprint(bp, acc) {
      const rated = bp.map(s => ({ s, a: acc[s.type] && acc[s.type][1] >= 3 ? acc[s.type][0] / acc[s.type][1] : null }));
      const known = rated.filter(r => r.a != null);
      if (known.length < 2) return { bp, changed: false };
      const avg = known.reduce((x, r) => x + r.a, 0) / known.length;
      const out = rated.map(({ s, a }) => {
        if (a == null) return s;
        const w = a < avg - 0.08 ? 1.7 : a > avg + 0.08 ? 0.6 : 1;
        return s.n ? { ...s, n: Math.max(1, Math.round(s.n * w)), w } : { ...s, passages: Math.max(1, Math.round(s.passages * w)), w };
      });
      return { bp: out, changed: out.some(s => s.w && s.w !== 1) };
    }
    function MockExamBuilder({ cards, readings, exams, onCreate }) {
      const [kind, setKind] = useState('YÖKDİL');
      const [field, setField] = useState('Fen Bilimleri');
      const [size, setSize] = useState('mini');
      const [key, setKey] = useState(getClaudeKey);
      const [keyOpen, setKeyOpen] = useState(false);
      const [progress, setProgress] = useState(null);   // [{ type, state: 'wait'|'run'|'ok'|'skip'|'err', note }]
      const [err, setErr] = useState('');
      const [adaptive, setAdaptive] = useState(false);
      const secAcc = useMemo(() => recentSectionAccuracy(exams || []), [exams]);
      const adapted = adaptBlueprint(EXAM_BLUEPRINTS[kind][size], secAcc);
      const bp = adaptive && adapted.changed ? adapted.bp : EXAM_BLUEPRINTS[kind][size];
      const total = blueprintCount(bp);
      const minutes = Math.round(180 * total / 80);
      const busy = progress && progress.some(p => p.state === 'run' || p.state === 'wait');
      const setP = (i, patch) => setProgress(prev => prev.map((p, k) => k === i ? { ...p, ...patch } : p));
      const run = async (useAI) => {
        if (useAI && !key) { setKeyOpen(true); return; }
        setErr('');
        setProgress(bp.map(s => ({ type: s.type, state: 'wait', note: '' })));
        const focus = shuffleArr(cards.filter(c => c.isDifficult || (c.srs && (c.srs.lapses || 0) > 0)).map(c => c.lemma || c.english)).slice(0, 15);
        const results = new Array(bp.length);
        let next = 0;
        const worker = async () => {
          while (next < bp.length) {
            const i = next++;
            const spec = bp[i];
            setP(i, { state: 'run' });
            try {
              const groups = useAI ? await genSectionAI(key, kind, field, spec, focus) : genSectionOffline(spec, cards, readings);
              const n = groups.reduce((a, g) => a + g.questions.length, 0);
              results[i] = { type: spec.type, groups };
              setP(i, { state: n ? 'ok' : 'skip', note: n ? n + ' soru' : (useAI ? 'üretilemedi' : 'bu bölüm için Claude ya da daha çok metin/kart gerekir') });
            } catch (e) {
              results[i] = { type: spec.type, groups: [] };
              setP(i, { state: 'err', note: e.message || 'hata' });
            }
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        const questions = assembleMockExam(results.filter(Boolean));
        if (questions.length < 3) { setErr('Deneme oluşturulamadı: yeterli soru yok.' + (useAI ? '' : ' Ücretsiz modda sorular kelime kartlarınızdan ve okuma metinlerinizden üretilir; önce birkaç metin ve kart ekleyin.')); return; }
        const d = new Date();
        onCreate({
          id: 'exam_gen_' + Date.now(),
          title: kind + ' tarzı deneme' + (adaptive && adapted.changed ? ' (zayıf bölüm odaklı)' : '') + ' · ' + field + ' · ' + d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          field, year: d.getFullYear(), term: '', kind, generated: useAI ? 'claude' : 'offline',
          questions, uploadedAt: d.toISOString(),
        });
      };
      return (
        <div className="bg-gradient-to-br from-indigo-950 to-slate-950 p-5 rounded-2xl border border-indigo-800/60 space-y-3">
          <div>
            <h3 className="font-bold text-lg text-white">📝 YÖKDİL / YDS tarzı deneme oluştur</h3>
            <p className="text-xs text-slate-400 mt-0.5">Gerçek sınavdaki bölüm sırasıyla: kelime ve dil bilgisi, cloze parçaları, cümle tamamlama, çeviri, paragraf tamamlama, anlam bütünlüğü ve uzun okuma parçaları (her parçaya 3 soru). Deneme "Çıkmış Sınavlarım"a kaydedilir; süreli çözülür, sonunda bölüm analizi ve açıklamalar gelir.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <label className="text-[10px] font-bold text-slate-400">Sınav
              <select value={kind} onChange={e => setKind(e.target.value)} disabled={busy} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                <option>YÖKDİL</option><option>YDS</option>
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-400">Alan
              <select value={field} onChange={e => setField(e.target.value)} disabled={busy} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                {Object.keys(FIELD_TOPICS).map(f => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-400">Uzunluk
              <select value={size} onChange={e => setSize(e.target.value)} disabled={busy} className="mt-1 w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">
                <option value="mini">Mini · {blueprintCount(EXAM_BLUEPRINTS[kind].mini)} soru</option>
                <option value="half">Yarım · {blueprintCount(EXAM_BLUEPRINTS[kind].half)} soru</option>
                <option value="full">Tam · {blueprintCount(EXAM_BLUEPRINTS[kind].full)} soru</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-1 text-[10px]">
            {bp.map((s, i) => <span key={i} className={"px-2 py-0.5 rounded " + (s.w > 1 ? 'bg-amber-900 text-amber-100' : s.w < 1 ? 'bg-slate-900 text-slate-500' : 'bg-slate-800 text-slate-300')}>{s.type} · {s.n || (s.passages + ' parça × ' + s.per)}{s.w > 1 ? ' ↑' : s.w < 1 ? ' ↓' : ''}</span>)}
            <span className="px-2 py-0.5 rounded bg-indigo-900 text-indigo-200 font-bold">{total} soru · {minutes} dk</span>
          </div>
          <label className={"flex items-center gap-2 text-[11px] " + (adapted.changed ? 'text-slate-300' : 'text-slate-600')}>
            <input type="checkbox" checked={adaptive && adapted.changed} disabled={!adapted.changed || busy} onChange={e => setAdaptive(e.target.checked)} className="accent-amber-500" />
            🎯 Zayıf bölümlerime göre (son denemelerde düşük kalan bölümler ↑ artar, iyi gidenler ↓ azalır)
            {!adapted.changed && <span className="text-slate-600">— önce en az bir tam deneme çözün</span>}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy} onClick={() => run(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">✨ Claude ile oluştur (tüm bölümler)</button>
            <button disabled={busy} onClick={() => run(false)} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50">⚙ Ücretsiz oluştur (kendi metin ve kartlarımdan)</button>
            <button type="button" onClick={() => setKeyOpen(!keyOpen)} className="text-[10px] text-slate-400 hover:text-indigo-300">🔑 {key ? 'Anahtar kayıtlı' : 'API anahtarı'}</button>
          </div>
          <p className="text-[10px] text-slate-500">Ücretsiz modda kelime, cloze ve anlam bütünlüğü bölümleri kendi metin ve kartlarınızdan üretilir; okuma, çeviri ve cümle tamamlama için Claude gerekir. Claude ile tam deneme birkaç dakika sürer ve Anthropic hesabınızdan (soru sayısına göre) ücretlendirilir.</p>
          {keyOpen && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
              <p>Kendi <b className="text-slate-200">Anthropic API anahtarınız</b> (console.anthropic.com → API Keys). Anahtar yalnızca bu tarayıcıda saklanır; buluta ve yedeğe gönderilmez.</p>
              <div className="flex gap-1.5">
                <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value.trim())} placeholder="sk-ant-..." className="flex-1 px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white font-mono" />
                <button type="button" onClick={() => { setClaudeKey(key); setKeyOpen(false); }} className="px-3 py-1.5 rounded bg-blue-600 text-xs font-bold text-white">Kaydet</button>
              </div>
            </div>
          )}
          {progress && (
            <div className="grid gap-1 text-[11px]">
              {progress.map((p, i) => (
                <p key={i} className={p.state === 'ok' ? 'text-emerald-300' : p.state === 'err' ? 'text-red-300' : p.state === 'skip' ? 'text-slate-500' : 'text-slate-300'}>
                  {p.state === 'ok' ? '✓' : p.state === 'err' ? '⚠' : p.state === 'skip' ? '–' : p.state === 'run' ? '⏳' : '·'} {p.type}{p.note ? ' — ' + p.note : p.state === 'run' ? ' — hazırlanıyor…' : ''}
                </p>
              ))}
            </div>
          )}
          {err && <p className="text-[11px] text-red-300">⚠ {err}</p>}
        </div>
      );
    }

