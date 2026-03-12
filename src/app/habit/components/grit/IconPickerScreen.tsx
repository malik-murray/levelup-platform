'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';

type Tab = 'icons' | 'emojis' | 'text' | 'image';

const EMOJI_GRID = [
  '📝', '✅', '💪', '🧘', '📖', '💧', '😴', '🙏', '🏃', '🥗', '☕', '📵',
  '🎯', '📋', '💰', '📞', '📊', '🧹', '📈', '📅', '💾', '🚭', '🍔', '📱',
  '🍷', '⏰', '😤', '🛒', '📲', '🍳', '✨', '🚶', '💊', '🥤', '👟', '🧘‍♀️',
];

const ICON_LABELS = [
  'Meditate', 'Read', 'Exercise', 'Journal', 'Water', 'Sleep', 'Gratitude', 'Learn',
  'Run', 'Eat', 'Coffee', 'Phone off', 'Goal', 'Plan', 'Money', 'Call',
  'Chart', 'Clean', 'Growth', 'Calendar', 'Save', 'No smoke', 'No junk', 'No scroll',
];

export function IconPickerScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<import('../../lib/gritTypes').GritHabitFormDraft | null>(null);
  const [tab, setTab] = useState<Tab>('emojis');
  const [search, setSearch] = useState('');
  const [textIcon, setTextIcon] = useState('');

  useEffect(() => {
    const d = getStoredDraft();
    setDraft(d || null);
    if (d?.icon && d.icon.length <= 2 && !EMOJI_GRID.includes(d.icon)) {
      setTextIcon(d.icon);
      setTab('text');
    }
  }, []);

  const selectIcon = (icon: string) => {
    if (!draft) return;
    const updated = { ...draft, icon };
    setStoredDraft(updated);
    router.push(returnTo);
  };

  const applyText = () => {
    const t = textIcon.trim().slice(0, 2) || '•';
    selectIcon(t);
  };

  if (!draft) {
    return (
      <div className="min-h-screen bg-[var(--lu-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredEmojis = search.trim()
    ? EMOJI_GRID.filter((e) => e.includes(search) || ICON_LABELS[EMOJI_GRID.indexOf(e)]?.toLowerCase().includes(search.toLowerCase()))
    : EMOJI_GRID;

  return (
    <div className="min-h-screen bg-[var(--lu-bg)] text-[var(--lu-text)] flex flex-col">
      <header className="flex items-center justify-between h-14 px-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Icon</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 pt-3 pb-2">
        <input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 pl-4 pr-4 rounded-xl bg-white/5 border border-white/10 text-[var(--lu-text)] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--lu-accent)]"
        />
      </div>

      <div className="flex border-b border-white/10 overflow-x-auto">
        {(['emojis', 'icons', 'text', 'image'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`
              flex-shrink-0 px-4 py-3 text-sm font-medium capitalize
              ${tab === t ? 'text-[var(--lu-accent)] border-b-2 border-[var(--lu-accent)]' : 'text-white/60'}
            `}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {tab === 'emojis' && (
          <div className="grid grid-cols-6 gap-3">
            {filteredEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => selectIcon(emoji)}
                className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl active:bg-white/10 min-h-[52px]"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {tab === 'icons' && (
          <div className="grid grid-cols-6 gap-3">
            {EMOJI_GRID.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => selectIcon(emoji)}
                className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl active:bg-white/10 min-h-[52px]"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-4">
            <p className="text-sm text-white/60">Use 1–2 characters as your icon (e.g. ✓, •, A1).</p>
            <input
              type="text"
              value={textIcon}
              onChange={(e) => setTextIcon(e.target.value.slice(0, 2))}
              maxLength={2}
              placeholder="•"
              className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-4 text-2xl text-center text-[var(--lu-text)]"
            />
            <button
              type="button"
              onClick={applyText}
              className="w-full py-4 rounded-2xl bg-[var(--lu-accent)] text-black font-semibold min-h-[48px]"
            >
              Use as icon
            </button>
          </div>
        )}

        {tab === 'image' && (
          <div className="rounded-2xl border border-white/10 p-8 text-center text-white/60">
            <p className="mb-2">Custom image upload</p>
            <p className="text-sm">Coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}
