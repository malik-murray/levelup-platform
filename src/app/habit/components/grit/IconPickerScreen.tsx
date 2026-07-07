'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import {
  EMOJI_CATEGORY_TABS,
  EMOJIS_BY_CATEGORY,
  findCategoryForEmoji,
  isKnownEmoji,
  type EmojiCategoryId,
} from '../../lib/emojiData';
import { HabitFlowShell, HabitFlowLoading } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

export function IconPickerScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<import('../../lib/gritTypes').GritHabitFormDraft | null>(null);
  const [category, setCategory] = useState<EmojiCategoryId>('smileys');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const storedDraft = getStoredDraft();
    setDraft(storedDraft || null);
    if (storedDraft?.icon && isKnownEmoji(storedDraft.icon)) {
      setCategory(findCategoryForEmoji(storedDraft.icon));
    }
  }, []);

  const selectIcon = (icon: string) => {
    if (!draft) return;
    const updated = { ...draft, icon };
    setStoredDraft(updated);
    router.push(returnTo);
  };

  const filteredEmojis = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return EMOJIS_BY_CATEGORY[category];

    const seen = new Set<string>();
    const results: string[] = [];
    for (const { id } of EMOJI_CATEGORY_TABS) {
      for (const emoji of EMOJIS_BY_CATEGORY[id]) {
        if (seen.has(emoji) || !emoji.toLowerCase().includes(query)) continue;
        seen.add(emoji);
        results.push(emoji);
      }
    }
    return results;
  }, [category, search]);

  if (!draft) {
    return <HabitFlowLoading />;
  }

  const tabBtn = (active: boolean) =>
    `flex-shrink-0 px-4 py-3 text-sm font-semibold transition-colors ${
      active ? 'border-b-2 border-[#ff9d00] text-[#ffe066]' : 'text-slate-400 hover:text-white/80'
    }`;

  const emojiCell = `${neon.section} flex aspect-square min-h-[52px] items-center justify-center rounded-2xl border-2 text-3xl transition hover:border-[#ff9d00]/50 hover:bg-[#ff9d00]/5`;

  return (
    <HabitFlowShell title="Icon" onBack={() => router.push(returnTo)}>
      <input
        type="search"
        placeholder="Search emojis..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 h-12 w-full rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff9d00]/50"
      />

      {!search.trim() ? (
        <div className="-mx-4 mb-4 flex overflow-x-auto border-b border-[#ff9d00]/25 px-4 scrollbar-hide sm:mx-0 sm:px-0">
          {EMOJI_CATEGORY_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={tabBtn(category === id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-400">Searching all categories</p>
      )}

      <div className="grid grid-cols-6 gap-3 sm:grid-cols-8">
        {filteredEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => selectIcon(emoji)}
            className={emojiCell}
            aria-label={`Select ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {filteredEmojis.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">No emojis match your search.</p>
      ) : null}
    </HabitFlowShell>
  );
}
