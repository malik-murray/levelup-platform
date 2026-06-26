'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { HabitFlowShell } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';
import { goalCategoryBadgeClass, goalCategoryLabel } from '@/lib/goals/categories';
import type { HabitGoal } from '@/lib/goals/types';
import { getStoredDraft, setStoredDraft } from '../../lib/habitFormStore';
import { formatGoalsLabel } from '../../lib/gritTypes';

export function GoalPickerScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [goals, setGoals] = useState<HabitGoal[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const draft = getStoredDraft();
    setSelectedIds(draft?.goal_ids ?? (draft?.goal_id ? [draft.goal_id] : []));

    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('habit_goals')
        .select('*')
        .eq('user_id', uid)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

      setGoals((data ?? []) as HabitGoal[]);
      setLoading(false);
    })();
  }, []);

  const toggleGoal = (goalId: string) => {
    setSelectedIds((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  };

  const saveAndReturn = () => {
    const current = getStoredDraft();
    if (!current) {
      router.push(returnTo);
      return;
    }
    setStoredDraft({
      ...current,
      goal_ids: selectedIds,
      goal_id: selectedIds[0] ?? null,
    });
    router.push(returnTo);
  };

  return (
    <HabitFlowShell
      title="Link to goals"
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
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
        </div>
      ) : goals.length === 0 ? (
        <div className={`${neon.panel} p-8 text-center`}>
          <p className="mb-4 text-slate-300">No goals yet. Create one on the Goals & Vision page first.</p>
          <button
            type="button"
            onClick={() => router.push('/goals')}
            className="min-h-[48px] rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00]/15 px-6 py-3 text-sm font-semibold text-[#ffe066]"
          >
            Go to Goals & Vision
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-400">
            Select one or more goals. {formatGoalsLabel(selectedIds)}
          </p>
          <ul className="space-y-2">
            {goals.map((goal) => {
              const checked = selectedIds.includes(goal.id);
              return (
                <li key={goal.id}>
                  <label
                    className={`${neon.section} flex cursor-pointer items-start gap-3 px-4 py-4 ${
                      checked ? 'border-[#ff9d00]/70' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGoal(goal.id)}
                      className="mt-1 h-4 w-4 accent-[#ff9d00]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-white">{goal.name}</span>
                      {goal.category ? (
                        <span className={`mt-2 inline-block ${goalCategoryBadgeClass(goal.category)}`}>
                          {goalCategoryLabel(goal.category)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </HabitFlowShell>
  );
}
