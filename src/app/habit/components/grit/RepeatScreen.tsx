'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import type { TimeOfDay } from '../../lib/gritTypes';
import { HabitFlowShell, HabitFlowLoading } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

const OPTIONS: { value: TimeOfDay | null; label: string }[] = [
  { value: null, label: 'Daily' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export function RepeatScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
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
    return <HabitFlowLoading />;
  }

  return (
    <HabitFlowShell title="Repeat" onBack={() => router.push(returnTo)}>
      <p className="mb-4 text-sm text-slate-400">When do you want to do this habit?</p>

      <div className="space-y-2">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => select(value)}
            className={`
              min-h-[56px] w-full rounded-2xl border-2 px-4 py-4 text-left font-medium transition-all
              ${
                draft.time_of_day === value
                  ? 'border-[#ff9d00] bg-[#ff9d00]/15 text-[#ffe066] shadow-[0_0_20px_rgba(255,157,0,0.2)]'
                  : `${neon.section} text-white hover:border-[#ff9d00]/50 hover:bg-[#ff9d00]/5`
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>
    </HabitFlowShell>
  );
}
