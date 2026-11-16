import React from 'react';
import { ActiveTab } from '../../types';
import {
  LayoutDashboard,
  RotateCw,
  CalendarDays,
  BookOpen,
  Database,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  Settings,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  dueCount: number;
  difficultCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  dueCount,
  difficultCount,
}) => {
  const menuItems = [
    { id: 'dashboard' as ActiveTab, label: 'Ana Sayfa', icon: LayoutDashboard },
    { id: 'daily-review' as ActiveTab, label: 'Günlük Tekrar', icon: RotateCw, badge: dueCount },
    { id: 'weeks' as ActiveTab, label: 'Haftalık Listelerim', icon: CalendarDays },
    { id: 'readings' as ActiveTab, label: 'Okuma Parçalarım', icon: BookOpen },
    { id: 'bank' as ActiveTab, label: 'YÖKDİL Kelime Bankası', icon: Database },
    { id: 'study' as ActiveTab, label: 'Sınavlar & Çalışma', icon: GraduationCap },
    { id: 'difficult' as ActiveTab, label: 'Zorlandığım Kelimeler', icon: AlertTriangle, badge: difficultCount },
    { id: 'stats' as ActiveTab, label: 'İstatistikler', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'Ayarlar', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 select-none">
      {/* Logo & Marka */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
            YÖKDİL Master
            <span className="text-[10px] uppercase font-semibold tracking-wider bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">SRS</span>
          </h1>
          <p className="text-xs text-slate-400">Kişisel Kelime Sistemi</p>
        </div>
      </div>

      {/* Menü Öğeleri */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : item.id === 'difficult'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Alt Bilgi Kutusu */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-slate-200">Kişisel İçerik Kuralı</p>
            <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">
              Yalnızca sizin yüklediğiniz okuma parçaları ve kelimeler saklanır.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
