'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import { formatDate } from '@/lib/habitHelpers';
import { dbToGrit, type GritHabitTemplate } from '../lib/gritTypes';
import { setStoredDraft, setReturnPath, initDraftFromTemplate, initDraftFromHabit } from '../lib/habitFormStore';
import { HabitTodayScreen } from '../components/grit/HabitTodayScreen';

type HabitWithStatus = GritHabitTemplate & {
  status: 'checked' | 'half' | 'missed';
  entryId?: string;
  checked_at?: string | null;
};

export default function HabitTodayPage() {
  const router = useRouter();
  const pathname = usePathname();
  const preview = usePreview();
  const isPreview = preview.isPreview || pathname?.startsWith('/preview') === true;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const dateStr = formatDate(selectedDate);
    try {
      if (isPreview) {
        const h = preview.habit;
        const templates = h.habitTemplates.filter((t) => t.is_active).map(dbToGrit);
        const entries = h.habitEntries.filter((e) => e.date === dateStr);
        const withStatus: HabitWithStatus[] = templates.map((t) => {
          const entry = entries.find((e) => e.habit_template_id === t.id);
          return {
            ...t,
            status: (entry?.status as 'checked' | 'half' | 'missed') || 'missed',
            entryId: entry?.id,
            checked_at: entry?.checked_at ?? null,
          };
        });
        setHabits(withStatus);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: templates } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');

      const { data: entries } = await supabase
        .from('habit_daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr);

      const list = (templates || []).map((t) => dbToGrit(t));
      const withStatus: HabitWithStatus[] = list.map((t) => {
        const entry = (entries || []).find((e) => e.habit_template_id === t.id);
        return {
          ...t,
          status: (entry?.status as 'checked' | 'half' | 'missed') || 'missed',
          entryId: entry?.id,
          checked_at: entry?.checked_at ?? null,
        };
      });
      setHabits(withStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, isPreview, preview.habit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onToggleHabit = useCallback(
    async (habitId: string, date: string) => {
      if (isPreview) {
        // Toggle in preview store
        const entry = preview.habit.habitEntries.find(
          (e) => e.habit_template_id === habitId && e.date === date
        );
        const newStatus = entry?.status === 'checked' ? 'missed' : 'checked';
        preview.setHabit((prev) => {
          const rest = prev.habitEntries.filter(
            (e) => !(e.habit_template_id === habitId && e.date === date)
          );
          if (newStatus === 'checked') {
            rest.push({
              id: preview.generateId(),
              habit_template_id: habitId,
              date,
              status: 'checked',
              checked_at: new Date().toISOString(),
            });
          } else {
            rest.push({
              id: entry?.id || preview.generateId(),
              habit_template_id: habitId,
              date,
              status: 'missed',
              checked_at: null,
            });
          }
          return { ...prev, habitEntries: rest };
        });
        loadData(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existing = habits.find((h) => h.id === habitId);
      const currentStatus = existing?.status === 'checked';

      if (existing?.entryId) {
        await supabase
          .from('habit_daily_entries')
          .update({
            status: currentStatus ? 'missed' : 'checked',
            checked_at: currentStatus ? null : new Date().toISOString(),
          })
          .eq('id', existing.entryId);
      } else {
        await supabase.from('habit_daily_entries').insert({
          user_id: user.id,
          date,
          habit_template_id: habitId,
          status: 'checked',
          checked_at: new Date().toISOString(),
        });
      }
      loadData(true);
    },
    [habits, isPreview, preview, loadData]
  );

  const onCreateHabit = useCallback(
    (template?: { name: string; icon: string; type: 'good' | 'health' | 'bad' | 'todo' }) => {
      setReturnPath('/habit/today');
      if (template) {
        const draft = initDraftFromTemplate(template);
        setStoredDraft(draft);
      } else {
        setStoredDraft(null);
      }
      router.push('/habit/new');
    },
    [router]
  );

  const onEditHabit = useCallback(
    (habit: GritHabitTemplate) => {
      setReturnPath('/habit/today');
      const draft = initDraftFromHabit(habit);
      setStoredDraft(draft);
      router.push(`/habit/${habit.id}/edit`);
    },
    [router]
  );

  return (
    <HabitTodayScreen
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      habits={habits}
      loading={loading}
      onToggleHabit={onToggleHabit}
      onCreateHabit={onCreateHabit}
      onEditHabit={onEditHabit}
      isPreview={isPreview}
    />
  );
}
