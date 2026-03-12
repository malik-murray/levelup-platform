'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import type { TimeOfDay } from '../../lib/gritTypes';

const OPTIONS: { value: TimeOfDay | null; label: string }[] = [
  { value: null, label: 'Daily' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export function RepeatScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') || '/habit/new';

  const [draft, setDraft] = useState<import('../../lib/gritTypes').GritHabitFormDraft | null>(null);

  useEffect(() => {
    const d = getStoredDraft();
    setDraft(d || null);
  }, []);

  const select = (time_of_day: TimeOfDay | null) => {
    if (!draft) return;
    setStoredDraft({ ...draft, time_of_day });
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
        <h1 className="text-lg font-semibold">Repeat</h1>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm text-white/60 mb-4">When do you want to do this habit?</p>

        <div className="space-y-2">
          {OPTIONS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => select(value)}
              className={`
                w-full text-left py-4 px-4 rounded-2xl border min-h-[56px]
                ${draft.time_of_day === value ? 'bg-[var(--lu-accent)]/20 border-[var(--lu-accent)]' : 'bg-white/5 border-white/10'}
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
