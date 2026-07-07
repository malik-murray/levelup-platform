'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import {
  deactivateHabitTemplate,
  reorderHabitTemplates,
} from '@/lib/habit/habitTemplateActions';
import { dbToGrit, type GritHabitTemplate, type TimeOfDay } from '../../lib/gritTypes';
import { initDraftFromHabit, getReturnPath, setReturnPath, setStoredDraft } from '../../lib/habitFormStore';
import { SortableHabitList } from './SortableHabitList';

const TIME_SECTIONS: { slot: TimeOfDay; title: string }[] = [
  { slot: 'morning', title: 'Morning' },
  { slot: 'afternoon', title: 'Afternoon' },
  { slot: 'evening', title: 'Evening' },
];

function sortHabits(a: GritHabitTemplate, b: GritHabitTemplate) {
  const ao = a.sort_order ?? 0;
  const bo = b.sort_order ?? 0;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name);
}

export function HabitManageSection({
  currentHabitId,
  onCurrentHabitDeleted,
}: {
  currentHabitId?: string;
  onCurrentHabitDeleted?: () => void;
}) {
  const router = useRouter();
  const preview = usePreview();
  const isPreview = preview.isPreview;

  const [habits, setHabits] = useState<GritHabitTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHabits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPreview) {
        const templates = preview.habit.habitTemplates
          .filter((template) => template.is_active)
          .map(dbToGrit);
        setHabits(templates);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: templates } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');

      setHabits((templates || []).map((template) => dbToGrit(template)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, [isPreview, preview.habit, router]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const habitsByTime = useMemo(() => {
    const unset: GritHabitTemplate[] = [];
    const bySlot: Record<TimeOfDay, GritHabitTemplate[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const habit of habits) {
      if (habit.time_of_day && habit.time_of_day in bySlot) {
        bySlot[habit.time_of_day].push(habit);
      } else {
        unset.push(habit);
      }
    }

    for (const slot of Object.keys(bySlot) as TimeOfDay[]) {
      bySlot[slot].sort(sortHabits);
    }
    unset.sort(sortHabits);

    return { bySlot, unset };
  }, [habits]);

  const handleReorder = async (habitIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      if (isPreview) {
        preview.setHabit((prev) => ({
          ...prev,
          habitTemplates: prev.habitTemplates.map((template) => {
            const nextIndex = habitIds.indexOf(template.id);
            if (nextIndex === -1) return template;
            return { ...template, sort_order: nextIndex };
          }),
        }));
        await loadHabits();
        return;
      }

      await reorderHabitTemplates(habitIds);
      await loadHabits();
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder habits');
      throw reorderError;
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (habit: GritHabitTemplate) => {
    const confirmed = window.confirm(
      `Delete "${habit.name}"? Past check-ins will stay in your history.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      if (isPreview) {
        preview.setHabit((prev) => ({
          ...prev,
          habitTemplates: prev.habitTemplates.map((template) =>
            template.id === habit.id ? { ...template, is_active: false } : template
          ),
        }));
      } else {
        await deactivateHabitTemplate(habit.id);
      }

      if (habit.id === currentHabitId) {
        onCurrentHabitDeleted?.();
        return;
      }

      await loadHabits();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete habit');
    } finally {
      setBusy(false);
    }
  };

  const handleEditHabit = (habit: GritHabitTemplate) => {
    if (habit.id === currentHabitId) return;
    setReturnPath(getReturnPath() || '/habit');
    setStoredDraft(initDraftFromHabit(habit));
    router.push(`/habit/${habit.id}/edit`);
  };

  if (loading) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
        <p className="text-sm text-slate-400">Loading habits…</p>
      </div>
    );
  }

  if (habits.length === 0) {
    return null;
  }

  return (
    <section aria-label="Manage habits">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ff9d00]/85">
        All Habits
      </p>
      <p className="mb-4 px-1 text-sm text-slate-400">
        Drag to reorder within each section. Tap edit to switch habits, or delete any habit.
      </p>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        {TIME_SECTIONS.map(({ slot, title }) => {
          const list = habitsByTime.bySlot[slot];
          if (list.length === 0) return null;
          return (
            <div key={slot}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
                {title}
              </h3>
              <SortableHabitList
                habits={list}
                busy={busy}
                currentHabitId={currentHabitId}
                onReorder={handleReorder}
                onDelete={handleDelete}
                onEditHabit={handleEditHabit}
              />
            </div>
          );
        })}

        {habitsByTime.unset.length > 0 ? (
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
              Anytime
            </h3>
            <SortableHabitList
              habits={habitsByTime.unset}
              busy={busy}
              currentHabitId={currentHabitId}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onEditHabit={handleEditHabit}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
