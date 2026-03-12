'use client';

import { useState, useMemo } from 'react';
import {
  TEMPLATES_BY_TAB,
  filterTemplates,
  type TemplateTab,
  type HabitTemplateOption,
} from '../../lib/habitTemplatesData';

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
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--lu-bg)]">
      <header className="flex items-center justify-between h-14 px-4 border-b border-white/10 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">Choose a template</h2>
        <div className="w-12" />
      </header>

      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <input
          type="search"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 pl-4 pr-4 rounded-xl bg-white/5 border border-white/10 text-[var(--lu-text)] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--lu-accent)]"
          aria-label="Search templates"
        />
      </div>

      <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide flex-shrink-0">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`
              flex-shrink-0 px-5 py-3 text-sm font-medium transition-colors
              ${activeTab === key ? 'text-[var(--lu-accent)] border-b-2 border-[var(--lu-accent)]' : 'text-white/60'}
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
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 active:bg-white/15 min-h-[56px]"
              >
                <span className="text-2xl flex-shrink-0">{t.icon}</span>
                <span className="font-medium">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => handleSelect(null)}
          className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-white/20 text-white/80 hover:border-[var(--lu-accent)] hover:text-[var(--lu-accent)] min-h-[56px]"
        >
          <span className="text-xl">+</span>
          <span className="font-medium">Create a Custom Habit</span>
        </button>
      </div>
    </div>
  );
}
