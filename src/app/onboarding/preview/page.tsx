'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { getPreviewDataForMigration, clearPreviewDataAfterMigration } from '@/lib/previewStore';

export default function OnboardingPreviewPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'migrating' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login?redirect=/onboarding/preview');
        return;
      }

      const data = getPreviewDataForMigration();
      const hasData = data.habit.habitTemplates.length > 0
        || data.habit.priorities.length > 0
        || data.habit.todos.length > 0
        || data.habit.habitEntries.length > 0
        || data.finance.transactions.length > 0
        || data.finance.accounts.length > 0
        || data.fitness.workouts.length > 0
        || data.fitness.meals.length > 0;

      if (!hasData) {
        clearPreviewDataAfterMigration();
        router.replace('/dashboard');
        return;
      }

      setStatus('migrating');
      setMessage('Saving your preview data to your account...');

      try {
        const habitIdMap: Record<string, string> = {};
        const accountIdMap: Record<string, string> = {};
        const categoryIdMap: Record<string, string> = {};

        // 1) Habit templates
        for (const t of data.habit.habitTemplates) {
          const { data: inserted } = await supabase
            .from('habit_templates')
            .insert({
              user_id: user.id,
              name: t.name,
              icon: t.icon,
              category: t.category,
              time_of_day: t.time_of_day,
              goal_id: t.goal_id,
              is_bad_habit: t.is_bad_habit,
              is_active: t.is_active ?? true,
              sort_order: t.sort_order,
            })
            .select('id')
            .single();
          if (inserted) habitIdMap[t.id] = inserted.id;
        }

        // 2) Habit daily entries (map template ids)
        for (const e of data.habit.habitEntries) {
          const newTemplateId = habitIdMap[e.habit_template_id];
          if (!newTemplateId) continue;
          await supabase.from('habit_daily_entries').insert({
            user_id: user.id,
            date: e.date,
            habit_template_id: newTemplateId,
            status: e.status,
            checked_at: e.checked_at,
          });
        }

        // 3) Priorities (with date)
        const prioritiesWithDate = (data.habit.priorities || []) as Array<{ id: string; text: string; category: string | null; time_of_day: string | null; completed: boolean; goal_id: string | null; completed_at: string | null; date?: string; sort_order?: number }>;
        for (const p of prioritiesWithDate) {
          const date = p.date || new Date().toISOString().slice(0, 10);
          await supabase.from('habit_daily_priorities').insert({
            user_id: user.id,
            date,
            text: p.text,
            category: p.category,
            time_of_day: p.time_of_day,
            goal_id: p.goal_id,
            completed: p.completed ?? false,
            completed_at: p.completed_at,
          });
        }

        // 4) Todos (with date)
        const todosWithDate = (data.habit.todos || []) as Array<{ id: string; title: string; category: string | null; time_of_day: string | null; is_done: boolean; goal_id: string | null; completed_at: string | null; date?: string }>;
        for (const t of todosWithDate) {
          const date = t.date || new Date().toISOString().slice(0, 10);
          await supabase.from('habit_daily_todos').insert({
            user_id: user.id,
            date,
            title: t.title,
            category: t.category,
            time_of_day: t.time_of_day,
            goal_id: t.goal_id,
            is_done: t.is_done ?? false,
            completed_at: t.completed_at,
          });
        }

        // 5) Finance: accounts
        for (const a of data.finance.accounts) {
          const { data: inserted } = await supabase
            .from('accounts')
            .insert({
              user_id: user.id,
              name: a.name,
              type: a.type,
              starting_balance: a.starting_balance,
            })
            .select('id')
            .single();
          if (inserted) accountIdMap[a.id] = inserted.id;
        }

        // 6) Finance: categories
        for (const c of data.finance.categories) {
          const { data: inserted } = await supabase
            .from('categories')
            .insert({
              user_id: user.id,
              name: c.name,
              kind: c.kind,
              parent_id: c.parent_id,
              type: c.type,
            })
            .select('id')
            .single();
          if (inserted) categoryIdMap[c.id] = inserted.id;
        }

        // 7) Finance: transactions (map account and category)
        for (const tx of data.finance.transactions) {
          const newAccountId = tx.account_id ? accountIdMap[tx.account_id] : null;
          const newCategoryId = tx.category_id ? categoryIdMap[tx.category_id] : null;
          if (!newAccountId) continue;
          await supabase.from('transactions').insert({
            user_id: user.id,
            date: tx.date,
            account_id: newAccountId,
            category_id: newCategoryId,
            amount: tx.amount,
            person: tx.person,
            note: tx.note,
          });
        }

        // 8) Finance: budgets (map category)
        for (const b of data.finance.budgets) {
          const newCategoryId = categoryIdMap[b.category_id];
          if (!newCategoryId) continue;
          await supabase.from('category_budgets').insert({
            user_id: user.id,
            category_id: newCategoryId,
            month: b.month,
            amount: b.amount,
          });
        }

        // 9) Fitness goals
        if (data.fitness.goals) {
          await supabase.from('fitness_goals').insert({
            user_id: user.id,
            daily_steps_target: data.fitness.goals.daily_steps_target,
            daily_calories_target: data.fitness.goals.daily_calories_target,
            daily_water_ml_target: data.fitness.goals.daily_water_ml_target,
            weekly_workout_minutes_target: data.fitness.goals.weekly_workout_minutes_target,
          });
        }

        // 10) Fitness workouts, meals, metrics
        for (const w of data.fitness.workouts || []) {
          await supabase.from('fitness_workouts').insert({
            user_id: user.id,
            date: w.date,
            type: w.type,
            muscle_group: w.muscle_group,
            duration_minutes: w.duration_minutes,
            intensity: w.intensity,
            calories_burned: w.calories_burned,
            notes: w.notes,
          });
        }
        for (const m of data.fitness.meals || []) {
          await supabase.from('fitness_meals').insert({
            user_id: user.id,
            date: m.date,
            meal_type: m.meal_type,
            description: m.description,
            calories: m.calories,
            protein_g: m.protein_g,
            carbs_g: m.carbs_g,
            fat_g: m.fat_g,
          });
        }
        for (const date of Object.keys(data.fitness.metrics || {})) {
          const metric = data.fitness.metrics[date];
          await supabase.from('fitness_metrics').insert({
            user_id: user.id,
            date: metric.date,
            weight_kg: metric.weight_kg,
            steps: metric.steps,
            water_ml: metric.water_ml,
            sleep_hours: metric.sleep_hours,
          });
        }

        if (cancelled) return;
        clearPreviewDataAfterMigration();
        setStatus('done');
        setMessage('Your data has been saved. Redirecting...');
        router.replace('/dashboard');
      } catch (err) {
        if (cancelled) return;
        console.error('Preview migration error:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to save preview data.');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [router]);

  if (status === 'checking' || status === 'migrating') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mx-auto" />
          <p className="text-slate-300">{status === 'migrating' ? message : 'Loading...'}</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4">
        <div className="max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 text-center">
          <p className="text-red-400 mb-4">{message}</p>
          <button
            onClick={() => router.replace('/dashboard')}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            Continue to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-4">
      <div className="text-center">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mx-auto" />
        <p className="text-slate-300">{message}</p>
      </div>
    </main>
  );
}
