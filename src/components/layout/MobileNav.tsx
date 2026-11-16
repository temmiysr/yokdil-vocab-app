import React from 'react';
import { ActiveTab } from '../../types';
import {
  LayoutDashboard,
  RotateCw,
  CalendarDays,
  Database,
  Menu,
} from 'lucide-react';

interface MobileNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  dueCount: number;
  openDrawer: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  dueCount,
  openDrawer,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-2 py-1.5 z-40 flex items-center justify-around shadow-2xl safe-area-bottom">
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-medium ${
          activeTab === 'dashboard' ? 'text-blue-400' : 'text-slate-400'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Özet</span>
      </button>

      <button
        onClick={() => setActiveTab('daily-review')}
        className={`relative flex flex-col items-center py-1 px-2 rounded-lg text-xs font-medium ${
          activeTab === 'daily-review' ? 'text-blue-400' : 'text-slate-400'
        }`}
      >
        <RotateCw className="w-5 h-5 mb-0.5" />
        <span>Tekrar</span>
        {dueCount > 0 && (
          <span className="absolute top-0 right-1 px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded-full font-bold">
            {dueCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab('weeks')}
        className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-medium ${
          activeTab === 'weeks' ? 'text-blue-400' : 'text-slate-400'
        }`}
      >
        <CalendarDays className="w-5 h-5 mb-0.5" />
        <span>Haftalar</span>
      </button>

      <button
        onClick={() => setActiveTab('bank')}
        className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-medium ${
          activeTab === 'bank' ? 'text-blue-400' : 'text-slate-400'
        }`}
      >
        <Database className="w-5 h-5 mb-0.5" />
        <span>Banka</span>
      </button>

      <button
        onClick={openDrawer}
        className="flex flex-col items-center py-1 px-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span>Menü</span>
      </button>
    </nav>
  );
};
