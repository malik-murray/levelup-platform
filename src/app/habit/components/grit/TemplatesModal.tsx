'use client';

import { useState, useMemo } from 'react';
import {
  TEMPLATES_BY_TAB,
  filterTemplates,
  type TemplateTab,
  type HabitTemplateOption,
} from '../../lib/habitTemplatesData';
import { neon } from '@/app/dashboard/neonTheme';

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: { name: string; icon: string; type: 'good' | 'health' | 'bad' | 'todo' } | null) => void;
}

const TABS: { key: TemplateTab; label: string }[] = [
  { key: 'good', label: 'Good' },
  { key: 'health', label: 'Health' },
  { key: 'bad', label: 'Bad' },
  { key: 'todo', label: 'To-Do' },
];

export function TemplatesModal({ open, onClose, onSelectTemplate }: TemplatesModalProps) {
  const [activeTab, setActiveTab] = useState<TemplateTab>('good');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => filterTemplates(activeTab, search),
    [activeTab, search]
  );

  if (!open) return null;

  const handleSelect = (t: HabitTemplateOption | null) => {
    if (t) {
      onSelectTemplate({ name: t.name, icon: t.icon, type: t.tab });
    } else {
      onSelectTemplate(null); // custom
    }
  };

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col bg-[#010205] text-white`}>
      <header
        className={`flex h-14 shrink-0 items-center justify-between border-b border-[#ff9d00]/25 bg-black/40 px-4 backdrop-blur-md`}
      >
        <button
          type="button"
          onClick={onClose}
          className="-ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#ff9d00]/35 text-[#ffe066] transition hover:bg-[#ff9d00]/10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-[#ffe066]" style={{ textShadow: '0 0 14px rgba(255,200,80,0.25)' }}>
          Choose a template
        </h2>
        <div className="w-12" />
      </header>

      <div className="shrink-0 px-4 pb-2 pt-3">
        <input
          type="search"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 w-full rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff9d00]/50"
          aria-label="Search templates"
        />
      </div>

      <div className="flex shrink-0 overflow-x-auto border-b border-[#ff9d00]/25 scrollbar-hide">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`
              flex-shrink-0 px-5 py-3 text-sm font-semibold transition-colors
              ${
                activeTab === key
                  ? 'border-b-2 border-[#ff9d00] text-[#ffe066]'
                  : 'text-slate-400 hover:text-white/80'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => handleSelect(t)}
                className={`${neon.section} flex min-h-[56px] w-full min-w-0 items-center gap-4 p-4 text-left transition hover:border-[#ff9d00]/55 hover:bg-[#ff9d00]/5`}
              >
                <span className="text-2xl flex-shrink-0">{t.icon}</span>
                <span className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => handleSelect(null)}
          className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#ff9d00]/35 py-4 font-semibold text-slate-300 transition hover:border-[#ff9d00]/70 hover:text-[#ffe066]"
        >
          <span className="text-xl">+</span>
          <span className="font-medium">Create a Custom Habit</span>
        </button>
      </div>
    </div>
  );
}
