'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import { HabitFlowShell, HabitFlowLoading } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

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
    return <HabitFlowLoading />;
  }

  const filteredEmojis = search.trim()
    ? EMOJI_GRID.filter(
        (e) =>
          e.includes(search) ||
          ICON_LABELS[EMOJI_GRID.indexOf(e)]?.toLowerCase().includes(search.toLowerCase())
      )
    : EMOJI_GRID;

  const tabBtn = (t: Tab, active: boolean) =>
    `flex-shrink-0 px-4 py-3 text-sm font-semibold capitalize transition-colors ${
      active ? 'border-b-2 border-[#ff9d00] text-[#ffe066]' : 'text-slate-400 hover:text-white/80'
    }`;

  const emojiCell = `${neon.section} flex aspect-square min-h-[52px] items-center justify-center rounded-2xl border-2 text-3xl transition hover:border-[#ff9d00]/50 hover:bg-[#ff9d00]/5`;

  return (
    <HabitFlowShell title="Icon" onBack={() => router.push(returnTo)}>
      <input
        type="search"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 h-12 w-full rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff9d00]/50"
      />

      <div className="-mx-4 mb-4 flex overflow-x-auto border-b border-[#ff9d00]/25 px-4 scrollbar-hide sm:mx-0 sm:px-0">
        {(['emojis', 'icons', 'text', 'image'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tabBtn(t, tab === t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'emojis' && (
        <div className="grid grid-cols-6 gap-3">
          {filteredEmojis.map((emoji) => (
            <button key={emoji} type="button" onClick={() => selectIcon(emoji)} className={emojiCell}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {tab === 'icons' && (
        <div className="grid grid-cols-6 gap-3">
          {EMOJI_GRID.map((emoji) => (
            <button key={emoji} type="button" onClick={() => selectIcon(emoji)} className={emojiCell}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {tab === 'text' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Use 1–2 characters as your icon (e.g. ✓, •, A1).</p>
          <input
            type="text"
            value={textIcon}
            onChange={(e) => setTextIcon(e.target.value.slice(0, 2))}
            maxLength={2}
            placeholder="•"
            className="h-14 w-full rounded-2xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-4 text-center text-2xl text-white"
          />
          <button
            type="button"
            onClick={applyText}
            className="min-h-[48px] w-full rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00] py-4 text-base font-semibold text-black shadow-[0_0_20px_rgba(255,157,0,0.25)]"
          >
            Use as icon
          </button>
        </div>
      )}

      {tab === 'image' && (
        <div className={`${neon.panel} p-8 text-center text-slate-400`}>
          <p className="mb-2 text-white">Custom image upload</p>
          <p className="text-sm">Coming soon</p>
        </div>
      )}
    </HabitFlowShell>
  );
}
