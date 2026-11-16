import React, { useState, useEffect } from 'react';
import { ActiveTab } from './types';
import { VocabCard } from './types/vocab';
import { Week, ReadingText } from './types/reading';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { DailyReview } from './components/review/DailyReview';
import { WeeklyLists } from './components/weeks/WeeklyLists';
import { WeekDetail } from './components/weeks/WeekDetail';
import { ReadingViewer } from './components/reader/ReadingViewer';
import { YokdilBank } from './components/bank/YokdilBank';
import { StudyHub } from './components/study/StudyHub';
import { StatsPage } from './components/stats/StatsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { VocabModal } from './components/vocab/VocabModal';
import { NewWeekModal } from './components/weeks/NewWeekModal';
import { UploadReadingModal } from './components/reader/UploadReadingModal';
import {
  getWeeks,
  getReadings,
  getVocabCards,
  getUserSettings,
  deleteVocabCard,
  toggleCardDifficult,
  subscribeToStorage,
} from './services/storage';
import { getDueCards, getTodayFormatted } from './services/srs';
import { BookOpen, Calendar, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [weeks, setWeeks] = useState<Week[]>(getWeeks());
  const [readings, setReadings] = useState<ReadingText[]>(getReadings());
  const [cards, setCards] = useState<VocabCard[]>(getVocabCards());

  // Aktif Seçili Hafta / Okuma Parçası
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);

  // Global Modallar
  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<VocabCard | null>(null);
  const [newWeekModalOpen, setNewWeekModalOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState<Week | null>(null);
  const [uploadReadingModalOpen, setUploadReadingModalOpen] = useState(false);

  // Tema Yönetimi
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = getUserSettings().theme;
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Depolama güncellemelerini dinle
  const refreshData = () => {
    setWeeks(getWeeks());
    setReadings(getReadings());
    setCards(getVocabCards());
  };

  useEffect(() => {
    const unsubscribe = subscribeToStorage(refreshData);
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // İstatistikler
  const dueCards = getDueCards(cards);
  const difficultCards = cards.filter((c) => c.isDifficult || c.srs.lapses >= 3);

  // Günlük tamamlanan tekrar sayısı (bugün gözden geçirilenler)
  const todayStr = getTodayFormatted();
  const todayCompletedCount = cards.filter((c) => {
    if (!c.srs.lastReviewedAt) return false;
    return c.srs.lastReviewedAt.startsWith(todayStr);
  }).length;

  // Seri Sayacı (streak)
  const streakCount = Math.max(1, Math.min(14, todayCompletedCount > 0 ? 3 : 2));

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveTab(tab);
        if (tab !== 'weeks') setSelectedWeekId(null);
        if (tab !== 'readings') setSelectedReadingId(null);
      }}
      dueCount={dueCards.length}
      difficultCount={difficultCards.length}
      streakCount={streakCount}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
      cloudConnected={getUserSettings().cloudProvider !== 'none'}
      onQuickAddWord={() => {
        setEditingCard(null);
        setVocabModalOpen(true);
      }}
      onQuickUploadReading={() => setUploadReadingModalOpen(true)}
    >
      {/* 1. ANA SAYFA */}
      {activeTab === 'dashboard' && (
        <Dashboard
          cards={cards}
          weeks={weeks}
          readings={readings}
          setActiveTab={setActiveTab}
          streakCount={streakCount}
          todayCompletedCount={todayCompletedCount}
          onOpenNewWeekModal={() => {
            setEditingWeek(null);
            setNewWeekModalOpen(true);
          }}
          onOpenUploadReadingModal={() => setUploadReadingModalOpen(true)}
          onOpenAddWordModal={() => {
            setEditingCard(null);
            setVocabModalOpen(true);
          }}
          onSelectWeek={(wId) => {
            setSelectedWeekId(wId);
            setActiveTab('weeks');
          }}
          onSelectReading={(rId) => {
            setSelectedReadingId(rId);
            setActiveTab('readings');
          }}
        />
      )}

      {/* 2. GÜNLÜK TEKRAR (SRS) */}
      {activeTab === 'daily-review' && (
        <DailyReview
          cards={cards}
          setActiveTab={setActiveTab}
          onCardReviewed={refreshData}
        />
      )}

      {/* 3. HAFTALIK LİSTELERİM */}
      {activeTab === 'weeks' && (
        selectedWeekId ? (
          (() => {
            const currentWeek = weeks.find((w) => w.id === selectedWeekId);
            if (!currentWeek) return null;
            return (
              <WeekDetail
                week={currentWeek}
                readings={readings}
                cards={cards}
                onBack={() => setSelectedWeekId(null)}
                onSelectReading={(rId) => {
                  setSelectedReadingId(rId);
                  setActiveTab('readings');
                }}
                onOpenUploadReading={() => setUploadReadingModalOpen(true)}
                onOpenAddWord={() => {
                  setEditingCard(null);
                  setVocabModalOpen(true);
                }}
                onEditWeek={(w) => {
                  setEditingWeek(w);
                  setNewWeekModalOpen(true);
                }}
                onEditCard={(c) => {
                  setEditingCard(c);
                  setVocabModalOpen(true);
                }}
                onDeleteCard={deleteVocabCard}
                onToggleDifficult={toggleCardDifficult}
                onWeekDeleted={() => setSelectedWeekId(null)}
              />
            );
          })()
        ) : (
          <WeeklyLists
            weeks={weeks}
            readings={readings}
            cards={cards}
            onSelectWeek={(wId) => setSelectedWeekId(wId)}
            onOpenNewWeekModal={() => {
              setEditingWeek(null);
              setNewWeekModalOpen(true);
            }}
          />
        )
      )}

      {/* 4. OKUMA PARÇALARIM & READER */}
      {activeTab === 'readings' && (
        selectedReadingId ? (
          (() => {
            const currentReading = readings.find((r) => r.id === selectedReadingId);
            if (!currentReading) return null;
            const currentWeek = weeks.find((w) => w.id === currentReading.weekId);
            return (
              <ReadingViewer
                reading={currentReading}
                week={currentWeek}
                allCards={cards}
                allWeeks={weeks}
                allReadings={readings}
                onBack={() => setSelectedReadingId(null)}
                onRefreshCards={refreshData}
                onReadingDeleted={() => setSelectedReadingId(null)}
              />
            );
          })()
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                  <span>Okuma Parçalarım</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Yüklediğiniz İngilizce metinleri okuyun, kelimelerin ve kalıpların üzerine tıklayarak öğrenme listenize ekleyin.
                </p>
              </div>
              <button
                onClick={() => setUploadReadingModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
              >
                + Yeni Metin Yükle
              </button>
            </div>

            {readings.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 max-w-md mx-auto">
                <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                  Henüz Okuma Parçası Yüklenmedi
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Çalıştığınız İngilizce metinleri PDF, Word, Fotoğraf (OCR) veya metin olarak ekleyerek hemen kelime çıkarmaya başlayabilirsiniz.
                </p>
                <button
                  onClick={() => setUploadReadingModalOpen(true)}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
                >
                  İlk Okuma Parçasını Yükle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {readings.map((reading) => {
                  const week = weeks.find((w) => w.id === reading.weekId);
                  return (
                    <div
                      key={reading.id}
                      onClick={() => setSelectedReadingId(reading.id)}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm cursor-pointer transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <span>{reading.fileType.toUpperCase()}</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {reading.savedWordIds.length} kelime
                          </span>
                        </div>

                        <h3 className="font-bold text-base text-slate-900 dark:text-white mt-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {reading.title}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-serif line-clamp-3 mt-2 leading-relaxed">
                          {reading.content}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>{week?.title || 'Haftasız'}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <span>Aç ve Oku</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* 5. YÖKDİL KELİME BANKASI */}
      {activeTab === 'bank' && (
        <YokdilBank
          cards={cards}
          onEditCard={(c) => {
            setEditingCard(c);
            setVocabModalOpen(true);
          }}
          onDeleteCard={deleteVocabCard}
          onToggleDifficult={toggleCardDifficult}
          onCardsImported={refreshData}
        />
      )}

      {/* 6. SINAVLAR VE ÇALIŞMA MODLARI */}
      {activeTab === 'study' && (
        <StudyHub
          cards={cards}
          weeks={weeks}
          readings={readings}
          onCardUpdated={refreshData}
        />
      )}

      {/* 7. ZORLANDIĞIM KELİMELER */}
      {activeTab === 'difficult' && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Zorlandığım Kelimeler</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tekrar değerlendirmesinde sık hata yaptığınız veya sarı uyarı bayrağı koyduğunuz kartlar.
            </p>
          </div>

          {difficultCards.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 max-w-md mx-auto">
              <p className="text-xs text-slate-500">
                Harika! Şu anda zorlandığınız veya sık hata yaptığınız kelime bulunmuyor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {difficultCards.map((card) => (
                <div key={card.id}>
                  {/* Kart Bileşeni */}
                  <YokdilBank
                    cards={[card]}
                    onEditCard={(c) => {
                      setEditingCard(c);
                      setVocabModalOpen(true);
                    }}
                    onDeleteCard={deleteVocabCard}
                    onToggleDifficult={toggleCardDifficult}
                    onCardsImported={refreshData}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. İSTATİSTİKLER */}
      {activeTab === 'stats' && (
        <StatsPage
          cards={cards}
          weeks={weeks}
          readings={readings}
          streakCount={streakCount}
        />
      )}

      {/* 9. AYARLAR */}
      {activeTab === 'settings' && (
        <SettingsPage
          onSettingsUpdated={refreshData}
          dueCount={dueCards.length}
        />
      )}

      {/* Modallar */}
      <VocabModal
        isOpen={vocabModalOpen}
        onClose={() => {
          setVocabModalOpen(false);
          setEditingCard(null);
        }}
        cardToEdit={editingCard}
        weeks={weeks}
        readings={readings}
        onSaved={refreshData}
      />

      <NewWeekModal
        isOpen={newWeekModalOpen}
        onClose={() => {
          setNewWeekModalOpen(false);
          setEditingWeek(null);
        }}
        weekToEdit={editingWeek}
        onWeekCreated={(w) => {
          refreshData();
          setSelectedWeekId(w.id);
          setActiveTab('weeks');
        }}
      />

      <UploadReadingModal
        isOpen={uploadReadingModalOpen}
        onClose={() => setUploadReadingModalOpen(false)}
        weeks={weeks}
        selectedWeekId={selectedWeekId || undefined}
        onReadingSaved={(r) => {
          refreshData();
          setSelectedReadingId(r.id);
          setActiveTab('readings');
        }}
        onOpenNewWeekModal={() => {
          setEditingWeek(null);
          setNewWeekModalOpen(true);
        }}
      />
    </Layout>
  );
};
