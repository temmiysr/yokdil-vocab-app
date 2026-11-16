import React from 'react';
import { Plus, BookmarkPlus } from 'lucide-react';

interface SelectionPopoverProps {
  position: { top: number; left: number } | null;
  selectedText: string;
  onAddWord: () => void;
}

export const SelectionPopover: React.FC<SelectionPopoverProps> = ({
  position,
  selectedText,
  onAddWord,
}) => {
  if (!position || !selectedText.trim()) return null;

  return (
    <div
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      }}
      className="fixed z-40 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-1.5 flex items-center gap-1.5 border border-slate-700/80">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddWord();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition active:scale-95"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>Kelime Listeme Ekle</span>
        </button>

        <span className="text-[11px] text-slate-300 max-w-[120px] truncate px-1 font-mono">
          "{selectedText}"
        </span>
      </div>

      {/* Küçük ok işareti */}
      <div className="w-2.5 h-2.5 bg-slate-900 border-r border-b border-slate-700/80 rotate-45 mx-auto -mt-1.5 shadow" />
    </div>
  );
};
