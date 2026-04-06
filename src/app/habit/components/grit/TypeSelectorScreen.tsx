'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import type { GritHabitType } from '../../lib/gritTypes';
import { HabitFlowShell, HabitFlowLoading } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

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
    return <HabitFlowLoading />;
  }

  return (
    <HabitFlowShell title="Type" onBack={() => router.push(returnTo)}>
      <p className="mb-4 text-sm text-slate-400">Choose how you want to track this habit.</p>

      <div className="space-y-3">
        {TYPES.map(({ value, label, description }) => (
          <button
            key={value}
            type="button"
            onClick={() => selectType(value)}
            className={`
              min-h-[56px] w-full rounded-2xl border-2 p-4 text-left transition-all
              ${
                draft.type === value
                  ? 'border-[#ff9d00] bg-[#ff9d00]/15 text-[#ffe066] shadow-[0_0_20px_rgba(255,157,0,0.2)]'
                  : `${neon.section} hover:border-[#ff9d00]/50 hover:bg-[#ff9d00]/5`
              }
            `}
          >
            <p className="font-semibold text-white">{label}</p>
            <p className="mt-0.5 text-sm text-slate-400">{description}</p>
          </button>
        ))}
      </div>
    </HabitFlowShell>
  );
}
