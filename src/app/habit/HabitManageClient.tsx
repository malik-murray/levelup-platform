'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import { dbToGrit, type GritHabitTemplate } from './lib/gritTypes';
import { setStoredDraft, setReturnPath, initDraftFromHabit } from './lib/habitFormStore';
import { HabitManageScreen } from './components/grit/HabitManageScreen';
import {
  deactivateHabitTemplate,
  reorderHabitTemplates,
} from '@/lib/habit/habitTemplateActions';
import { enrichHabitTemplates } from '@/lib/habit/habitTemplateLinks';

const HABIT_HOME_AUTH = '/habit';
const HABIT_HOME_GUEST = '/guest/habit';
const HABIT_HOME_PREVIEW = '/preview/habit';

export default function HabitManageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const preview = usePreview();
  const isGuestRoute = pathname?.startsWith('/guest') === true;
  const isPreview =
    preview.isPreview || pathname?.startsWith('/preview') === true || isGuestRoute;
  const habitHome = isGuestRoute ? HABIT_HOME_GUEST : isPreview ? HABIT_HOME_PREVIEW : HABIT_HOME_AUTH;

  const [habits, setHabits] = useState<GritHabitTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHabits = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
        window.location.href = '/login';
        return;
      }

      const { data: templates } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');

      const enriched = await enrichHabitTemplates(supabase, user.id, templates || []);
      setHabits(enriched.map((template) => dbToGrit(template)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [isPreview, preview.habit]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const onCreateHabit = useCallback(() => {
      setReturnPath(habitHome);
      setStoredDraft(null);
      router.push(isGuestRoute ? '/guest/habit/new' : '/habit/new');
    },
    [router, habitHome, isGuestRoute]
  );

  const onEditHabit = useCallback(
    (habit: GritHabitTemplate) => {
      setReturnPath(habitHome);
      setStoredDraft(initDraftFromHabit(habit));
      router.push(isGuestRoute ? `/guest/habit/${habit.id}/edit` : `/habit/${habit.id}/edit`);
    },
    [router, habitHome, isGuestRoute]
  );

  const onDeleteHabit = useCallback(
    async (habitId: string) => {
      if (isPreview) {
        preview.setHabit((prev) => ({
          ...prev,
          habitTemplates: prev.habitTemplates.map((template) =>
            template.id === habitId ? { ...template, is_active: false } : template
          ),
        }));
        loadHabits(true);
        return;
      }

      await deactivateHabitTemplate(habitId);
      loadHabits(true);
    },
    [isPreview, preview, loadHabits]
  );

  const onReorderHabits = useCallback(
    async (habitIds: string[]) => {
      if (isPreview) {
        preview.setHabit((prev) => ({
          ...prev,
          habitTemplates: prev.habitTemplates.map((template) => {
            const nextIndex = habitIds.indexOf(template.id);
            if (nextIndex === -1) return template;
            return { ...template, sort_order: nextIndex };
          }),
        }));
        loadHabits(true);
        return;
      }

      await reorderHabitTemplates(habitIds);
      loadHabits(true);
    },
    [isPreview, preview, loadHabits]
  );

  return (
    <HabitManageScreen
      habits={habits}
      loading={loading}
      onCreateHabit={onCreateHabit}
      onEditHabit={onEditHabit}
      onDeleteHabit={onDeleteHabit}
      onReorderHabits={onReorderHabits}
      isPreview={isPreview}
      isGuestRoute={isGuestRoute}
    />
  );
}
