
    const { useState, useEffect, useRef } = React;

    // --- TEMEL VERİ KATMANI (Offline-first localStorage) ---
    const STORAGE_KEYS = {
      WEEKS: 'yokdil_weeks_v1',
      READINGS: 'yokdil_readings_v1',
      VOCAB: 'yokdil_vocab_cards_v1',
      SETTINGS: 'yokdil_user_settings_v1',
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

    // --- SM-2 ARALIKLI TEKRAR MOTORU ---
    function getTodayStr() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function addDays(dateStr, days) {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function createSRS(cardId) {
      return {
        cardId,
        state: 'new',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lapses: 0,
        lastReviewedAt: null,
        nextReviewAt: getTodayStr(),
      };
    }

    function processReview(item, rating) {
      const today = getTodayStr();
      let rep = item.repetitions;
      let ease = item.easeFactor;
      let interval = item.interval;
      let lapses = item.lapses;
      let state = item.state;

      if (rating === 1) {
        rep = 0;
        interval = 1;
        ease = Math.max(1.3, ease - 0.2);
        lapses += 1;
        state = 'learning';
      } else {
        if (rep === 0) {
          interval = rating === 4 ? 3 : 1;
          if (rating === 4) ease = Math.min(3.0, ease + 0.15);
          if (rating === 2) ease = Math.max(1.3, ease - 0.15);
          rep = 1;
          state = 'learning';
        } else if (rep === 1) {
          interval = rating === 4 ? 6 : (rating === 2 ? 2 : 3);
          rep = 2;
          state = 'learning';
        } else if (rep === 2) {
          interval = rating === 4 ? 12 : (rating === 2 ? 4 : 7);
          rep = 3;
          state = 'review';
        } else {
          let mod = rating === 2 ? 0.8 : (rating === 4 ? 1.3 : 1.0);
          if (rating === 2) ease = Math.max(1.3, ease - 0.15);
          if (rating === 4) ease = Math.min(3.0, ease + 0.15);
          interval = Math.max(interval + 1, Math.round(interval * ease * mod));
          rep += 1;
          state = interval >= 30 ? 'mastered' : 'review';
        }
      }

      ease = Math.round(ease * 100) / 100;
      return {
        ...item,
        state,
        interval,
        easeFactor: ease,
        repetitions: rep,
        lapses,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: addDays(today, interval),
      };
    }

    // --- TELAFFUZ (SpeechSynthesis) ---
    function speakText(text) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }

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

    // --- ANA UYGULAMA BİLEŞENİ ---
    function App() {
      const [activeTab, setActiveTab] = useState('dashboard');
      const [weeks, setWeeks] = useState(() => getStored(STORAGE_KEYS.WEEKS, []));
      const [readings, setReadings] = useState(() => getStored(STORAGE_KEYS.READINGS, []));
      const [cards, setCards] = useState(() => getStored(STORAGE_KEYS.VOCAB, []));
      const [settings, setSettings] = useState(() => getStored(STORAGE_KEYS.SETTINGS, {
        theme: 'dark',
        notificationTime: '20:00',
        telegramEnabled: false,
        telegramBotToken: '',
        telegramChatId: '',
        appUrl: window.location.href,
        cloudProvider: 'none'
      }));

      // Modallar ve Detay Durumları
      const [selectedWeekId, setSelectedWeekId] = useState(null);
      const [selectedReadingId, setSelectedReadingId] = useState(null);
      const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
      const [editingCard, setEditingCard] = useState(null);
      const [initialWord, setInitialWord] = useState('');
      const [initialSentence, setInitialSentence] = useState('');
      const [isNewWeekOpen, setIsNewWeekOpen] = useState(false);
      const [isUploadReadingOpen, setIsUploadReadingOpen] = useState(false);
      const [duplicateCard, setDuplicateCard] = useState(null);

      // Metin Seçimi ve Popover
      const [selectionText, setSelectionText] = useState('');
      const [popoverPos, setPopoverPos] = useState(null);

      useEffect(() => {
        setStored(STORAGE_KEYS.WEEKS, weeks);
      }, [weeks]);
      useEffect(() => {
        setStored(STORAGE_KEYS.READINGS, readings);
      }, [readings]);
      useEffect(() => {
        setStored(STORAGE_KEYS.VOCAB, cards);
      }, [cards]);
      useEffect(() => {
        setStored(STORAGE_KEYS.SETTINGS, settings);
      }, [settings]);

      // Hesaplamalar
      const today = getTodayStr();
      const dueCards = cards.filter(c => c.srs.nextReviewAt <= today);
      const difficultCards = cards.filter(c => c.isDifficult || c.srs.lapses >= 3);
      const masteredCards = cards.filter(c => c.srs.state === 'mastered');

      // Okuma Metninde Seçim Olayı
      const handleReaderSelection = (readingContent) => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setPopoverPos(null);
          return;
        }
        const text = sel.toString().trim();
        if (text.length >= 2) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const sentence = extractSentence(readingContent, text);
          setSelectionText(text);
          setInitialSentence(sentence);
          setPopoverPos({ top: rect.top, left: rect.left + rect.width / 2 });
        }
      };

      // Kelime Listeme Ekle Eylemi
      const handleAddSelection = () => {
        const norm = selectionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const dup = cards.find(c => c.english.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() === norm);
        if (dup) {
          setDuplicateCard(dup);
          setPopoverPos(null);
        } else {
          setInitialWord(selectionText);
          setEditingCard(null);
          setIsVocabModalOpen(true);
          setPopoverPos(null);
        }
      };

      // Mükerrer Karta Kaynak Ekleme
      const handleAppendSource = () => {
        if (!duplicateCard) return;
        const currentReading = readings.find(r => r.id === selectedReadingId);
        const updated = cards.map(c => {
          if (c.id === duplicateCard.id) {
            const sources = c.sources || [];
            sources.push({
              readingId: currentReading?.id || '',
              readingTitle: currentReading?.title || '',
              sentence: initialSentence,
              dateAdded: new Date().toISOString()
            });
            return { ...c, sources, updatedAt: new Date().toISOString() };
          }
          return c;
        });
        setCards(updated);
        setDuplicateCard(null);
        alert('Mevcut karta yeni örnek cümle ve kaynak başarıyla eklendi!');
      };

      return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
          {/* Masaüstü Yan Menü */}
          <aside className="hidden md:flex flex-col w-64 bg-slate-950 border-r border-slate-800 p-4 select-none">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20">
                Y
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  YÖKDİL Master
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">SRS</span>
                </h1>
                <p className="text-xs text-slate-400">Kişisel Kelime Sistemi</p>
              </div>
            </div>

            <nav className="flex-1 py-4 space-y-1">
              {[
                { id: 'dashboard', label: 'Ana Sayfa', icon: '📊' },
                { id: 'daily-review', label: 'Günlük Tekrar', icon: '🔄', badge: dueCards.length },
                { id: 'weeks', label: 'Haftalık Listelerim', icon: '📅' },
                { id: 'readings', label: 'Okuma Parçalarım', icon: '📖' },
                { id: 'bank', label: 'YÖKDİL Kelime Bankası', icon: '🗄️' },
                { id: 'study', label: 'Sınavlar & Testler', icon: '🎓' },
                { id: 'difficult', label: 'Zorlandığım Kelimeler', icon: '⚠️', badge: difficultCards.length },
                { id: 'stats', label: 'İstatistikler', icon: '📈' },
                { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'weeks') setSelectedWeekId(null);
                    if (item.id !== 'readings') setSelectedReadingId(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activeTab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[10px] bg-white text-blue-700 px-2 py-0.5 rounded-full font-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              <span className="font-bold text-slate-300">Kişisel İçerik Kuralı:</span>
              <p className="mt-0.5">Yalnızca sizin yüklediğiniz okuma metinleri ve kelimeler saklanır.</p>
            </div>
          </aside>

          {/* Ana İçerik */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="bg-slate-950 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white capitalize">
                  {activeTab === 'daily-review' ? 'Günlük Tekrar (Spaced Repetition)' : activeTab}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUploadReadingOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  + Metin Yükle
                </button>
                <button
                  onClick={() => {
                    setEditingCard(null);
                    setInitialWord('');
                    setInitialSentence('');
                    setIsVocabModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition"
                >
                  + Kelime Ekle
                </button>
              </div>
            </header>

            {/* Sayfalar */}
            <main className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto pb-20 md:pb-6">
              {/* ANA SAYFA */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <h2 className="text-2xl font-black">
                      {dueCards.length > 0 ? `Bugün ${dueCards.length} Kelime Tekrar Bekliyor!` : 'Harika! Bugünkü Tüm Tekrarlarını Tamamladın.'}
                    </h2>
                    <p className="text-xs text-blue-100 mt-2 max-w-xl">
                      Aralıklı tekrar algoritması bilginizi unutulma eşiğinde hafızanıza çağırarak uzun vadeli kalıcılık sağlar.
                    </p>
                    <div className="mt-5 flex gap-3">
                      {dueCards.length > 0 ? (
                        <button
                          onClick={() => setActiveTab('daily-review')}
                          className="px-5 py-2.5 rounded-xl bg-white text-blue-900 font-extrabold text-xs shadow-lg hover:bg-blue-50 transition"
                        >
                          Tekrarı Başlat ({dueCards.length})
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab('study')}
                          className="px-5 py-2.5 rounded-xl bg-white/20 text-white font-bold text-xs hover:bg-white/30 transition"
                        >
                          Sınav Modları
                        </button>
                      )}
                      <button
                        onClick={() => setIsUploadReadingOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition"
                      >
                        Yeni Metin Yükle
                      </button>
                    </div>
                  </div>

                  {/* İstatistik Kutuları */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-slate-400">Toplam Kayıtlı Kelime</p>
                      <p className="text-3xl font-black text-white mt-1">{cards.length}</p>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-blue-400">Bugün Tekrar</p>
                      <p className="text-3xl font-black text-blue-400 mt-1">{dueCards.length}</p>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-emerald-400">Kalıcı Hafızada</p>
                      <p className="text-3xl font-black text-emerald-400 mt-1">{masteredCards.length}</p>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-xs text-amber-400">Zorlandığım</p>
                      <p className="text-3xl font-black text-amber-400 mt-1">{difficultCards.length}</p>
                    </div>
                  </div>

                  {/* Haftalarım Listesi */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-sm text-white">Haftalık Çalışma Listelerim</h3>
                      <button
                        onClick={() => setIsNewWeekOpen(true)}
                        className="text-xs text-blue-400 font-bold hover:underline"
                      >
                        + Yeni Hafta Oluştur
                      </button>
                    </div>
                    {weeks.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-xs text-slate-400">
                        Henüz çalışma haftası oluşturulmadı. "Yeni Hafta Oluştur" butonuna basarak başlayabilirsiniz.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {weeks.map(w => {
                          const wReadings = readings.filter(r => r.weekId === w.id);
                          const wCards = cards.filter(c => c.weekId === w.id);
                          return (
                            <div
                              key={w.id}
                              onClick={() => { setSelectedWeekId(w.id); setActiveTab('weeks'); }}
                              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500 cursor-pointer transition flex justify-between items-center"
                            >
                              <div>
                                <h4 className="font-bold text-sm text-white">{w.title}</h4>
                                <p className="text-xs text-slate-400 mt-1">{wReadings.length} metin • {wCards.length} kelime</p>
                              </div>
                              <span className="text-xs font-bold text-blue-400">Görüntüle →</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GÜNLÜK TEKRAR */}
              {activeTab === 'daily-review' && (
                <div className="max-w-xl mx-auto space-y-4">
                  {dueCards.length === 0 ? (
                    <div className="text-center py-16 bg-slate-950 rounded-3xl border border-slate-800 p-8 space-y-4">
                      <div className="text-5xl">🎉</div>
                      <h3 className="text-xl font-bold text-white">Harika İş!</h3>
                      <p className="text-xs text-slate-400">Bugün tekrar bekleyen kelimeniz bulunmuyor. Yeni bir okuma parçası ekleyebilir veya sınav modlarını deneyebilirsiniz.</p>
                      <button onClick={() => setActiveTab('study')} className="px-5 py-2.5 rounded-xl bg-blue-600 font-bold text-xs text-white">
                        Sınav Modlarına Git
                      </button>
                    </div>
                  ) : (
                    <DailyReviewSession
                      cards={dueCards}
                      onComplete={() => {
                        if (window.confetti) window.confetti({ particleCount: 100 });
                        setActiveTab('dashboard');
                      }}
                      onRate={(cardId, rating) => {
                        const updated = cards.map(c => {
                          if (c.id === cardId) {
                            return { ...c, srs: processReview(c.srs, rating) };
                          }
                          return c;
                        });
                        setCards(updated);
                      }}
                    />
                  )}
                </div>
              )}

              {/* OKUMA PARÇALARI VE READER */}
              {activeTab === 'readings' && (
                selectedReadingId ? (
                  (() => {
                    const current = readings.find(r => r.id === selectedReadingId);
                    if (!current) return null;
                    return (
                      <div className="space-y-4 max-w-4xl mx-auto">
                        <button
                          onClick={() => setSelectedReadingId(null)}
                          className="text-xs font-bold text-slate-400 hover:text-blue-400"
                        >
                          ← Tüm Okuma Parçalarına Dön
                        </button>
                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                          <h2 className="text-xl font-black text-white">{current.title}</h2>
                          <p className="text-xs text-slate-400 mt-1">{current.category} • {current.wordCount} kelime</p>
                        </div>

                        {/* Metin Alanı ve Seçim */}
                        <div
                          onMouseUp={() => handleReaderSelection(current.content)}
                          onTouchEnd={() => handleReaderSelection(current.content)}
                          className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-slate-200 font-serif leading-loose text-base whitespace-pre-wrap select-text"
                        >
                          {current.content}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg text-white">Yüklediğiniz Okuma Parçaları</h3>
                      <button onClick={() => setIsUploadReadingOpen(true)} className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white">
                        + Metin Yükle
                      </button>
                    </div>
                    {readings.length === 0 ? (
                      <div className="text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
                        Henüz okuma metni yüklenmedi.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {readings.map(r => (
                          <div
                            key={r.id}
                            onClick={() => setSelectedReadingId(r.id)}
                            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 cursor-pointer transition"
                          >
                            <span className="text-[10px] font-bold text-blue-400">{r.category}</span>
                            <h4 className="font-bold text-base text-white mt-1">{r.title}</h4>
                            <p className="text-xs text-slate-400 line-clamp-3 mt-2 font-serif">{r.content}</p>
                            <p className="text-[11px] text-blue-400 font-bold mt-4">Aç ve Kelime Seç →</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* YÖKDİL KELİME BANKASI */}
              {activeTab === 'bank' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-white">Kelime Bankası ({cards.length})</h3>
                    <button
                      onClick={() => {
                        const csvContent = "English,Turkish,PartOfSpeech,OriginalSentence\n" + cards.map(c => `"${c.english}","${c.turkish}","${c.partOfSpeech}","${c.originalSentence}"`).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'yokdil_kelimeler.csv'; a.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
                    >
                      CSV Dışa Aktar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cards.map(c => (
                      <div key={c.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300">{c.partOfSpeech}</span>
                          <button onClick={() => speakText(c.english)} className="text-xs text-blue-400">🔊 Dinle</button>
                        </div>
                        <h4 className="font-bold text-base text-white">{c.english}</h4>
                        <p className="text-xs font-semibold text-blue-400">{c.turkish}</p>
                        {c.originalSentence && (
                          <p className="text-[11px] text-slate-400 font-serif italic line-clamp-2">"{c.originalSentence}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AYARLAR */}
              {activeTab === 'settings' && (
                <div className="max-w-xl mx-auto space-y-6">
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                    <h3 className="font-bold text-base text-white">Telegram Bildirim Ayarları</h3>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Telegram Bot Token</label>
                      <input
                        type="password"
                        value={settings.telegramBotToken}
                        onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono"
                        placeholder="BotFather'dan alınan token"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Telegram Chat ID</label>
                      <input
                        type="text"
                        value={settings.telegramChatId}
                        onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono"
                        placeholder="@userinfobot ile öğrenilen ID"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!settings.telegramBotToken || !settings.telegramChatId) {
                          alert('Lütfen Bot Token ve Chat ID giriniz.');
                          return;
                        }
                        try {
                          const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              chat_id: settings.telegramChatId,
                              text: `🔔 <b>YÖKDİL Master Test Bildirimi</b>\n\nTelegram bağlantınız başarıyla sağlandı!`,
                              parse_mode: 'HTML'
                            })
                          });
                          const d = await res.json();
                          if (d.ok) alert('Test bildirimi Telegram hesabınıza gönderildi!');
                          else alert('Hata: ' + d.description);
                        } catch (err) {
                          alert('Ağ hatası: ' + err.message);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white shadow"
                    >
                      Test Bildirimi Gönder
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* Kayan Kelime Seçim Butonu */}
          {popoverPos && (
            <div
              style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px`, transform: 'translate(-50%, -100%) translateY(-10px)' }}
              className="fixed z-50 bg-slate-950 border border-slate-700 text-white p-2 rounded-xl shadow-2xl flex items-center gap-2"
            >
              <button
                onClick={handleAddSelection}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow transition"
              >
                + Kelime Listeme Ekle
              </button>
              <span className="text-xs text-slate-300 font-mono">"{selectionText}"</span>
            </div>
          )}

          {/* Mükerrer Kelime Uyarısı */}
          {duplicateCard && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
                <h3 className="font-bold text-base text-white">Kelime Zaten Kayıtlı!</h3>
                <p className="text-xs text-slate-300">
                  <b>"{duplicateCard.english}"</b> ifadesi daha önce kaydedilmiş. İkinci bir kart açmak yerine bu okuma parçasındaki cümleyi mevcut karta eklemek ister misiniz?
                </p>
                <div className="flex gap-2">
                  <button onClick={handleAppendSource} className="flex-1 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white">
                    (Önerilen) Cümleyi Ekle
                  </button>
                  <button onClick={() => setDuplicateCard(null)} className="py-2 px-3 rounded-xl bg-slate-800 text-xs text-slate-300">
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kelime Ekleme Modalı (12 Alan) */}
          {isVocabModalOpen && (
            <VocabAddModal
              initialWord={initialWord}
              initialSentence={initialSentence}
              onClose={() => setIsVocabModalOpen(false)}
              onSave={(newCard) => {
                setCards([newCard, ...cards]);
                setIsVocabModalOpen(false);
              }}
            />
          )}

          {/* Okuma Parçası Yükleme Modalı */}
          {isUploadReadingOpen && (
            <UploadModal
              weeks={weeks}
              onClose={() => setIsUploadReadingOpen(false)}
              onSave={(newReading) => {
                setReadings([newReading, ...readings]);
                setIsUploadReadingOpen(false);
                setSelectedReadingId(newReading.id);
                setActiveTab('readings');
              }}
            />
          )}

          {/* Yeni Hafta Modalı */}
          {isNewWeekOpen && (
            <WeekAddModal
              onClose={() => setIsNewWeekOpen(false)}
              onSave={(newWeek) => {
                setWeeks([newWeek, ...weeks]);
                setIsNewWeekOpen(false);
              }}
            />
          )}
        </div>
      );
    }

    // --- YARDIMCI MODAL BİLEŞENLERİ ---
    function DailyReviewSession({ cards, onComplete, onRate }) {
      const [idx, setIdx] = useState(0);
      const [revealed, setRevealed] = useState(false);
      const card = cards[idx];

      const handleRating = (rating) => {
        onRate(card.id, rating);
        setRevealed(false);
        if (idx + 1 < cards.length) {
          setIdx(idx + 1);
        } else {
          onComplete();
        }
      };

      return (
        <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl text-center space-y-6">
          <div className="text-xs text-slate-400 font-bold">Kart {idx + 1} / {cards.length}</div>
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300">{card.partOfSpeech}</span>
            <h2 className="text-3xl font-black text-white mt-2">{card.english}</h2>
            {card.ipa && <p className="text-xs text-slate-400 font-mono mt-1">/{card.ipa}/</p>}
          </div>

          {revealed ? (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <p className="text-2xl font-bold text-blue-400">{card.turkish}</p>
              {card.originalSentence && (
                <p className="text-xs text-slate-300 font-serif italic">"{card.originalSentence}"</p>
              )}
              <div className="grid grid-cols-4 gap-2 pt-2">
                <button onClick={() => handleRating(1)} className="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-bold">Tekrar [1]</button>
                <button onClick={() => handleRating(2)} className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-bold">Zor [2]</button>
                <button onClick={() => handleRating(3)} className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-300 text-xs font-bold">İyi [3]</button>
                <button onClick={() => handleRating(4)} className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-bold">Kolay [4]</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRevealed(true)} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg">
              Anlamını Göster
            </button>
          )}
        </div>
      );
    }

    function VocabAddModal({ initialWord, initialSentence, onClose, onSave }) {
      const [english, setEnglish] = useState(initialWord);
      const [turkish, setTurkish] = useState('');
      const [pos, setPos] = useState('noun');
      const [sentence, setSentence] = useState(initialSentence);

      const handleSave = (e) => {
        e.preventDefault();
        if (!english.trim() || !turkish.trim()) return;
        const newId = 'card_' + Date.now();
        onSave({
          id: newId,
          english: english.trim(),
          turkish: turkish.trim(),
          partOfSpeech: pos,
          originalSentence: sentence.trim(),
          sourceType: 'user_reading',
          isDifficult: false,
          srs: createSRS(newId),
          createdAt: new Date().toISOString()
        });
      };

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-3">
            <h3 className="font-bold text-base text-white">Kelime Kartı Ekle</h3>
            <input
              type="text"
              placeholder="İngilizce kelime/ifade"
              value={english}
              onChange={e => setEnglish(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Türkçe anlamı"
              value={turkish}
              onChange={e => setTurkish(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            />
            <select
              value={pos}
              onChange={e => setPos(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            >
              <option value="noun">İsim (Noun)</option>
              <option value="verb">Fiil (Verb)</option>
              <option value="adjective">Sıfat (Adjective)</option>
              <option value="adverb">Zarf (Adverb)</option>
              <option value="collocation">Kalıp İfade (Collocation)</option>
              <option value="prepositional_phrase">Edatlı Yapı</option>
            </select>
            <textarea
              rows={3}
              placeholder="Metindeki orijinal cümle"
              value={sentence}
              onChange={e => setSentence(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white">Kaydet</button>
            </div>
          </form>
        </div>
      );
    }

    function UploadModal({ weeks, onClose, onSave }) {
      const [title, setTitle] = useState('');
      const [content, setContent] = useState('');
      const [weekId, setWeekId] = useState(weeks[0]?.id || '');
      const [category, setCategory] = useState('Fen Bilimleri');

      const handleSave = (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;
        const newId = 'reading_' + Date.now();
        onSave({
          id: newId,
          title: title.trim(),
          content: content.trim(),
          weekId,
          category,
          wordCount: content.trim().split(/\s+/).length,
          savedWordIds: [],
          fileType: 'manual',
          dateAdded: new Date().toISOString()
        });
      };

      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-3">
            <h3 className="font-bold text-base text-white">İngilizce Okuma Metni Yükle</h3>
            <input
              type="text"
              placeholder="Başlık (Örn: Reading 1: Technology)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={weekId}
                onChange={e => setWeekId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
              >
                {weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="Fen Bilimleri">Fen Bilimleri</option>
                <option value="Sağlık Bilimleri">Sağlık Bilimleri</option>
                <option value="Sosyal Bilimler">Sosyal Bilimler</option>
                <option value="Genel Akademik">Genel Akademik</option>
              </select>
            </div>
            <textarea
              rows={7}
              placeholder="İngilizce metni buraya yapıştırın..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif leading-relaxed"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white">Metni Kaydet</button>
            </div>
          </form>
        </div>
      );
    }

    function WeekAddModal({ onClose, onSave }) {
      const [title, setTitle] = useState(`1. Hafta – ${new Date().toLocaleDateString('tr-TR')}`);
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-3">
            <h3 className="font-bold text-base text-white">Yeni Hafta Oluştur</h3>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">İptal</button>
              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) return;
                  onSave({
                    id: 'week_' + Date.now(),
                    title: title.trim(),
                    startDate: getTodayStr(),
                    readingIds: [],
                    archived: false
                  });
                }}
                className="px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  