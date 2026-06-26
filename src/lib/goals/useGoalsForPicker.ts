'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import { loadGoalsForPicker } from '@/lib/goals/loadGoalsForPicker';

export type GoalPickerOption = { id: string; name: string };

export function useGoalsForPicker(userId: string | null): GoalPickerOption[] {
  const [goals, setGoals] = useState<GoalPickerOption[]>([]);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      return;
    }
    void loadGoalsForPicker(supabase, userId).then(setGoals);
  }, [userId]);

  return goals;
}
