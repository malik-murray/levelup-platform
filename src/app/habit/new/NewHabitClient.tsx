'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import {
  getStoredDraft,
  setStoredDraft,
  getReturnPath,
  clearReturnPath,
  initDraftFromTemplate,
  DEFAULT_HABIT_FORM,
  draftToDb,
} from '../lib/habitFormStore';
import type { GritHabitFormDraft } from '../lib/gritTypes';
import { HabitFormScreen } from '../components/grit/HabitFormScreen';

export default function NewHabitClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preview = usePreview();
  const isPreview = preview.isPreview;

  const [draft, setDraft] = useState<GritHabitFormDraft>(DEFAULT_HABIT_FORM);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const stored = getStoredDraft();
    if (stored) {
      setDraft(stored);
      return;
    }
    const name = searchParams.get('name');
    const icon = searchParams.get('icon');
    const type = searchParams.get('type') as 'good' | 'health' | 'bad' | 'todo' | null;
    if (name && icon && type) {
      setDraft(initDraftFromTemplate({ name, icon, type }));
    }
  }, [mounted, searchParams]);

  useEffect(() => {
    if (mounted && draft) setStoredDraft(draft);
  }, [draft, mounted]);

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      if (isPreview) {
        const newHabit = {
          id: preview.generateId(),
          name: draft.name.trim(),
          icon: draft.icon,
          category: draft.category,
          time_of_day: draft.time_of_day,
          goal_id: draft.goal_id,
          is_bad_habit: draft.is_bad_habit,
          is_active: true,
          sort_order: null,
        };
        preview.setHabit((prev) => ({
          ...prev,
          habitTemplates: [...prev.habitTemplates, newHabit],
        }));
        setStoredDraft(null);
        clearReturnPath();
        router.push(getReturnPath() || '/habit/today');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const payload = draftToDb(draft);
      const { data } = await supabase
        .from('habit_templates')
        .insert({
          user_id: user.id,
          ...payload,
          is_active: true,
        })
        .select()
        .single();

      if (data) {
        setStoredDraft(null);
        clearReturnPath();
        router.push(getReturnPath() || '/habit/today');
      }
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

  return (
    <HabitFormScreen
      draft={draft}
      setDraft={setDraft}
      isEdit={false}
      onSave={handleSave}
      onCancel={handleCancel}
      saving={saving}
    />
  );
}

