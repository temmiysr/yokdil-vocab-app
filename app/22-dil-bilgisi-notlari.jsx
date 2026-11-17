    // --- DİL BİLGİSİ KONU NOTLARI ---
    // Kelime / dil bilgisi ve cloze sorularında şıklara bakarak konu tahmin edilir; kısa Türkçe not ve alıştırma sunulur.
    const GRAMMAR_TOPICS = [
      { key: 'conditional', label: 'Koşul cümleleri (if / unless)', en: 'conditional sentences (zero, first, second, third and mixed conditionals; unless, provided that, otherwise)',
        test: (o, p) => /\b(if|unless|provided|otherwise|had\s+\w+ed)\b/i.test(p) && o.filter(x => /\bwould\b|\bwill\b|\bhad\b/.test(x)).length >= 2,
        note: 'Gerçek/olası durum: If + Present, will + V1. Hayali şimdi: If + Past, would + V1. Geçmişteki hayali durum: If + had V3, would have V3. Karma: If + had V3 (geçmiş), would + V1 (bugünkü sonuç). "Unless" = if … not; "provided (that)" = şartıyla. İpucu: önce yan cümledeki zamanı, sonra "today / now / last year" gibi zaman ifadelerini bulun.' },
      { key: 'tense', label: 'Zamanlar (tense uyumu)', en: 'verb tenses and tense agreement (present/past perfect, continuous, future perfect, time expressions such as by, since, for, until, by the time)',
        test: (o) => o.filter(x => /\b(have|has|had|will|would|was|were|is|are|been|being)\b/.test(x)).length >= 3,
        note: 'Zaman ifadeleri ipucudur: "since / for" → Present Perfect; "by the time + Past" → Past Perfect; "by + gelecek zaman" → Future Perfect; "last / ago / in 1990" → Simple Past; "currently / at the moment" → Continuous. İki boşluklu sorularda önce kesin ipucu olan boşluğu çözüp şıkları eleyin.' },
      { key: 'relative', label: 'Sıfat cümlecikleri (which / whose / that)', en: 'relative clauses and relative pronouns (which, who, whom, whose, that, where, when, whereby, preposition + which)',
        test: (o) => o.filter(x => /^(which|who|whom|whose|that|where|when|what|whereby|in which|by which|of which|to whom)$/i.test(x.trim())).length >= 3,
        note: '"Which" nesne/olay, "who" kişi, "whose" iyelik (whose + isim), "where" yer, "when" zaman bildirir. Virgülden sonra "that" kullanılmaz. "What" = the thing that (öncesinde isim yoksa). Edat + which/whom: "the method by which", "the person to whom".' },
      { key: 'linker', label: 'Bağlaçlar ve geçiş ifadeleri', en: 'conjunctions and transition words (although, however, whereas, despite, therefore, unless, so that, not only … but also, either … or)',
        test: (o) => o.filter(x => LINKER_LIST.some(L => L.w === x.trim().toLowerCase()) || /^(but|and|or|yet|so|while|whether|as|once|until|before|after|even if|just as|not only|either|neither|both|only if)$/i.test(x.trim())).length >= 3,
        note: 'Önce iki cümle arasındaki ilişkiyi bulun: zıtlık (although, whereas, however, despite + isim), sebep-sonuç (because, since, therefore, as a result), koşul (unless, provided that), amaç (so that, in order to). "Despite / in spite of / because of" + isim; "although / because" + cümle. Noktalı virgülden sonra "however, therefore" gibi bağlaçlar gelir.' },
      { key: 'prep', label: 'Edatlar (prepositions)', en: 'prepositions, including dependent prepositions after verbs, nouns and adjectives (depend on, contribute to, capable of, in terms of)',
        test: (o) => o.filter(x => x.split(/\s*\/\s*/).every(t => PREP_OPTIONS.concat(['by', 'into', 'over', 'among', 'within', 'between', 'through', 'about', 'against', 'upon', 'towards', 'under', 'onto', 'beyond', 'without']).includes(t.trim().toLowerCase()))).length >= 3,
        note: 'Edatlar çoğunlukla kalıptır: depend on, contribute to, consist of, result in / result from, capable of, responsible for, in terms of, due to. Kelimeyi edatıyla birlikte öğrenin (Kelime Kartları\'ndaki "kalıp olarak ekle" bunun için). İki boşlukluysa önce emin olduğunuz kalıbı yerleştirin.' },
      { key: 'modal', label: 'Kipler (modals)', en: 'modal verbs (can, could, may, might, must, should, ought to, need, would rather, had better) including perfect modals (must have done, should have done)',
        test: (o) => o.filter(x => /^(can|could|may|might|must|should|ought|need|would rather|had better|have to|be able)/i.test(x.trim())).length >= 3,
        note: 'Geçmişe yönelik tahmin: must have V3 (kesin), may/might/could have V3 (olası), can\'t have V3 (imkânsız). Pişmanlık/eleştiri: should have V3. Zorunluluk: must / have to; gerek yok: don\'t have to / needn\'t. Tavsiye: should, had better.' },
      { key: 'passive', label: 'Edilgen yapı (passive)', en: 'passive voice in all tenses (is produced, has been tested, will be carried out, is thought to have been)',
        test: (o) => o.filter(x => /\b(be|been|being|is|are|was|were)\s+\w+(ed|en|wn|ne|t)\b/.test(x)).length >= 2,
        note: 'Özne eylemi yapmıyorsa edilgen gerekir: be + V3. Zamanı "be" taşır: is made, was made, has been made, will be made, is being made. "It is thought / believed that …" ve "X is said to have V3" kalıpları sınavda sık çıkar.' },
      { key: 'quant', label: 'Miktar belirteçleri (much / many / few)', en: 'quantifiers and determiners (much, many, few, a few, little, a little, each, every, either, neither, none, both, most, the number of / a number of)',
        test: (o) => o.filter(x => /^(much|many|few|a few|little|a little|each|every|either|neither|none|both|most|all|several|any|some|no|the number|a number)\b/i.test(x.trim())).length >= 3,
        note: 'Sayılabilen çoğul: many, few, a number of (+ çoğul fiil); sayılamayan: much, little. "A few / a little" = biraz (olumlu), "few / little" = çok az (olumsuz). "Each / every" + tekil isim; "either / neither" iki şey için; "none of" + çoğul.' },
      { key: 'verbal', label: 'Fiilimsiler (to / -ing)', en: 'gerunds and infinitives (avoid doing, manage to do, be used to doing, in order to, by doing, without doing)',
        test: (o) => o.filter(x => /^to\s|ing\b/.test(x.trim())).length >= 3,
        note: 'Bazı fiiller -ing ister (avoid, consider, enjoy, deny, involve), bazıları to + V1 (manage, fail, decide, aim, tend). Edattan sonra -ing gelir (by using, without knowing, be used to working). Amaç: (in order) to + V1.' },
      { key: 'compare', label: 'Karşılaştırma (more / as … as)', en: 'comparatives and superlatives (more … than, as … as, the more … the more, far/much + comparative, the most)',
        test: (o, p) => /\bthan\b|\bas\s+\w+\s+as\b|\bthe (more|less)\b/i.test(p) || o.filter(x => /\b(more|most|less|least|as|than|-er)\b/i.test(x)).length >= 3,
        note: 'Cümlede "than" varsa karşılaştırma (more/-er), "as … as" eşitlik, "the + -est / most" üstünlük gerekir. "The more …, the more …" = ne kadar … o kadar. Güçlendirme: much / far / considerably + comparative.' },
    ];
    function grammarTopicOf(q) {
      if (!q || !['Kelime & Dil Bilgisi', 'Cloze Test'].includes(qSection(q))) return null;
      const o = (q.options || []).map(x => String(x || ''));
      const p = (q.prompt || '') + ' ' + (q.passage ? (q.passage.match(new RegExp('[^.]*\\(' + q.num + '\\)[^.]*\\.?')) || [''])[0] : '');
      return GRAMMAR_TOPICS.find(t => t.test(o, p)) || null;
    }
    async function genGrammarDrill(topic, apiKey, readings) {
      if (apiKey) {
        const { data } = await callClaudeJson(apiKey,
          'You write original YÖKDİL/YDS-style grammar practice questions (5 options A-E, exactly one correct). Formal academic sentences on science, health and society topics. Explanations short and in Turkish.',
          'Write exactly 5 separate questions that ALL test: ' + topic.en + '. Each prompt is one academic sentence (18-35 words) with "----" for the blank (or two blanks with two-part options "x / y"). Vary which option is correct. passage = "".',
          MOCK_SCHEMA, 8000);
        return (data.groups || []).flatMap(g => g.questions).filter(q => q.options && q.options.length === 5 && q.answer >= 0 && q.answer <= 4)
          .map(q => ({ type: topic.label, prompt: q.prompt, options: q.options, answer: q.answer, explain: q.explanation_tr, cardIds: [] }));
      }
      // Anahtar yoksa: yalnızca bağlaç ve edat konuları kendi metinlerinizden üretilebilir
      if (topic.key === 'linker') return genLinkerQuestions(readings, 5);
      if (topic.key === 'prep') return genClozeFromReadings(readings, 1, 5).flatMap(g => g.questions.map((q, k) => ({ type: topic.label, prompt: '', passage: g.passage.replace(/\((\d)\)/g, (m, d) => '(' + d + ')'), options: q.options, answer: q.answer, explain: q.explanation_tr })));
      return [];
    }
    function GrammarTopicPanel({ q, readings, onPractice }) {
      const topic = grammarTopicOf(q);
      const [open, setOpen] = useState(false);
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState('');
      if (!topic) return null;
      const drill = async () => {
        setBusy(true); setMsg('');
        try {
          const items = await genGrammarDrill(topic, getClaudeKey(), readings);
          if (items.length) onPractice(items);
          else setMsg('Bu konuda alıştırma için Claude API anahtarı gerekir (Benzer soru üret → 🔑).');
        } catch (e) { setMsg(e.message || 'Alıştırma üretilemedi.'); }
        finally { setBusy(false); }
      };
      return (
        <div className="text-[11px]">
          <button type="button" onClick={() => setOpen(!open)} className="px-2.5 py-1 rounded-lg bg-violet-950/60 border border-violet-800 text-violet-200 font-bold">📘 Konu: {topic.label}</button>
          {open && (
            <div className="mt-1.5 p-2.5 rounded-lg bg-violet-950/20 border border-violet-900/50 space-y-1.5 text-slate-300">
              <p>{topic.note}</p>
              {onPractice && <button type="button" disabled={busy} onClick={drill} className="px-2.5 py-1 rounded-lg bg-violet-700 text-white font-bold disabled:opacity-50">{busy ? 'Hazırlanıyor…' : 'Bu konudan 5 alıştırma sorusu'}</button>}
              {msg && <p className="text-amber-300">{msg}</p>}
            </div>
          )}
        </div>
      );
    }

