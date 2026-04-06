'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import { dbToGrit } from '../../lib/gritTypes';
import {
  getStoredDraft,
  setStoredDraft,
  getReturnPath,
  clearReturnPath,
  initDraftFromHabit,
  draftToDb,
} from '../../lib/habitFormStore';
import type { GritHabitFormDraft, GritHabitTemplate } from '../../lib/gritTypes';
import { HabitFormScreen } from '../../components/grit/HabitFormScreen';
import { HabitFlowLoading } from '../../components/HabitFlowShell';

export default function EditHabitPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const preview = usePreview();
  const isPreview = preview.isPreview;

  const [draft, setDraft] = useState<GritHabitFormDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const stored = getStoredDraft();
    if (stored) {
      setDraft(stored);
      setLoading(false);
      return;
    }

    async function load() {
      if (isPreview) {
        const habit = preview.habit.habitTemplates.find((t) => t.id === id);
        if (habit) {
          setDraft(initDraftFromHabit(dbToGrit(habit)));
        }
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('habit_templates')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setDraft(initDraftFromHabit(dbToGrit(data)));
      }
      setLoading(false);
    }
    load();
  }, [id, isPreview, preview.habit, router]);

  useEffect(() => {
    if (draft) setStoredDraft(draft);
  }, [draft]);

  const handleSave = async () => {
    if (!draft?.name.trim() || !id) return;
    setSaving(true);
    try {
      if (isPreview) {
        preview.setHabit((prev) => ({
          ...prev,
          habitTemplates: prev.habitTemplates.map((t) =>
            t.id === id
              ? {
                  ...t,
                  name: draft.name.trim(),
                  icon: draft.icon,
                  category: draft.category,
                  time_of_day: draft.time_of_day,
                  is_bad_habit: draft.is_bad_habit,
                  goal_id: draft.goal_id,
                }
              : t
          ),
        }));
        setStoredDraft(null);
        clearReturnPath();
        router.push(getReturnPath() || '/habit/today');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const payload = draftToDb(draft);
      await supabase
        .from('habit_templates')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);

      setStoredDraft(null);
      clearReturnPath();
      router.push(getReturnPath() || '/habit/today');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setStoredDraft(null);
    clearReturnPath();
    router.push(getReturnPath() || '/habit/today');
  };

  if (loading || !draft) {
    return <HabitFlowLoading />;
  }

  return (
    <HabitFormScreen
      draft={draft}
      setDraft={setDraft}
      isEdit
      habitId={id}
      onSave={handleSave}
      onCancel={handleCancel}
      saving={saving}
    />
  );
}
