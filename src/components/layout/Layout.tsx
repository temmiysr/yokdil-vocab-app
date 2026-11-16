import React, { useState } from 'react';
import { ActiveTab } from '../../types';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import {
  X,
  RotateCw,
  CalendarDays,
  BookOpen,
  Database,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  Settings,
  LayoutDashboard,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  dueCount: number;
  difficultCount: number;
  streakCount: number;
  isDarkMode: boolean;
  toggleTheme: () => void;
  cloudConnected: boolean;
  onQuickAddWord: () => void;
  onQuickUploadReading: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  dueCount,
  difficultCount,
  streakCount,
  isDarkMode,
  toggleTheme,
  cloudConnected,
  onQuickAddWord,
  onQuickUploadReading,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const drawerItems = [
    { id: 'dashboard' as ActiveTab, label: 'Ana Sayfa', icon: LayoutDashboard },
    { id: 'daily-review' as ActiveTab, label: 'Günlük Tekrar', icon: RotateCw, badge: dueCount },
    { id: 'weeks' as ActiveTab, label: 'Haftalık Listelerim', icon: CalendarDays },
    { id: 'readings' as ActiveTab, label: 'Okuma Parçalarım', icon: BookOpen },
    { id: 'bank' as ActiveTab, label: 'YÖKDİL Kelime Bankası', icon: Database },
    { id: 'study' as ActiveTab, label: 'Sınavlar & Çalışma Modları', icon: GraduationCap },
    { id: 'difficult' as ActiveTab, label: 'Zorlandığım Kelimeler', icon: AlertTriangle, badge: difficultCount },
    { id: 'stats' as ActiveTab, label: 'İstatistikler', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'Ayarlar', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      {/* Masaüstü Yan Menü */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dueCount={dueCount}
        difficultCount={difficultCount}
      />

      {/* Mobil Tam Ekran Menü Çekmecesi */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-slate-900 text-white p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="font-bold text-lg">YÖKDİL Menü</h3>
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-2">
            {drawerItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium ${
                    isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-xs bg-white text-blue-600 px-2 py-0.5 rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>YÖKDİL Kişisel Hazırlık Sistemi</span>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200"
            >
              {isDarkMode ? 'Açık Tema' : 'Koyu Tema'}
            </button>
          </div>
        </div>
      )}

      {/* Ana Gövde */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          streakCount={streakCount}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          cloudConnected={cloudConnected}
          onQuickAddWord={onQuickAddWord}
          onQuickUploadReading={onQuickUploadReading}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobil Alt Çubuk */}
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dueCount={dueCount}
          openDrawer={() => setMobileDrawerOpen(true)}
        />
      </div>
    </div>
  );
};
