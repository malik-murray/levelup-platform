'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import type { GritHabitType } from '../../lib/gritTypes';

const TYPES: { value: GritHabitType; label: string; description: string }[] = [
  { value: 'good', label: 'Good', description: 'A habit you want to build or maintain.' },
  { value: 'bad', label: 'Bad', description: 'A habit you want to break or avoid.' },
  { value: 'track', label: 'Track', description: 'Something you want to measure or log (e.g. mood, steps).' },
  { value: 'todo', label: 'To-Do', description: 'A one-off or recurring task for the day.' },
];

export function TypeSelectorScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<import('../../lib/gritTypes').GritHabitFormDraft | null>(null);

  useEffect(() => {
    const d = getStoredDraft();
    setDraft(d || null);
  }, []);

  const selectType = (type: GritHabitType) => {
    if (!draft) return;
    setStoredDraft({
      ...draft,
      type,
      is_bad_habit: type === 'bad',
    });
    router.push(returnTo);
  };

  if (!draft) {
    return (
      <div className="min-h-screen bg-[var(--lu-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
        <h1 className="text-lg font-semibold">Type</h1>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm text-white/60 mb-4">Choose how you want to track this habit.</p>

        <div className="space-y-3">
          {TYPES.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectType(value)}
              className={`
                w-full text-left p-4 rounded-2xl border min-h-[56px]
                ${draft.type === value ? 'bg-[var(--lu-accent)]/20 border-[var(--lu-accent)]' : 'bg-white/5 border-white/10'}
              `}
            >
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-white/70 mt-0.5">{description}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
