'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import type { Category } from '../../lib/gritTypes';
import { formatCategoriesLabel } from '../../lib/gritTypes';
import { HABIT_TRACKER_CATEGORIES } from '@/lib/habit/habitTemplateLinks';
import { HabitFlowShell, HabitFlowLoading } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

const CATEGORY_LABELS: Record<Category, string> = {
  physical: 'Physical',
  mental: 'Mental',
  spiritual: 'Spiritual',
};

const CATEGORY_COLORS: Record<Category, string> = {
  physical: 'border-blue-400/50 bg-blue-500/15 text-blue-200',
  mental: 'border-purple-400/50 bg-purple-500/15 text-purple-200',
  spiritual: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
};

export function CategoryPickerScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Category[]>(['mental']);

  useEffect(() => {
    const draft = getStoredDraft();
    if (draft) {
      setSelected(
        draft.categories.length > 0 ? draft.categories : draft.category ? [draft.category] : ['mental']
      );
    }
  }, []);

  const toggleCategory = (category: Category) => {
    setSelected((prev) => {
      if (prev.includes(category)) {
        const next = prev.filter((c) => c !== category);
        return next.length > 0 ? next : prev;
      }
      return [...prev, category];
    });
  };

  const saveAndReturn = () => {
    const current = getStoredDraft();
    if (!current) {
      router.push(returnTo);
      return;
    }
    setStoredDraft({
      ...current,
      categories: selected,
      category: selected[0] ?? 'mental',
    });
    router.push(returnTo);
  };

  if (!getStoredDraft()) {
    return <HabitFlowLoading />;
  }

  return (
    <HabitFlowShell
      title="Categories"
      onBack={() => router.push(returnTo)}
      headerRight={
        <button
          type="button"
          onClick={saveAndReturn}
          className="min-h-[44px] rounded-xl border-2 border-[#ff9d00]/60 bg-[#ff9d00]/15 px-4 py-2 text-sm font-semibold text-[#ffe066]"
        >
          Done
        </button>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        Pick every area this habit supports. {formatCategoriesLabel(selected)}
      </p>
      <ul className="space-y-2">
        {HABIT_TRACKER_CATEGORIES.map((category) => {
          const checked = selected.includes(category);
          return (
            <li key={category}>
              <label
                className={`${neon.section} flex cursor-pointer items-center gap-3 px-4 py-4 ${
                  checked ? 'border-[#ff9d00]/70' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCategory(category)}
                  className="h-4 w-4 accent-[#ff9d00]"
                />
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category]}`}>
                  {CATEGORY_LABELS[category]}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </HabitFlowShell>
  );
}
