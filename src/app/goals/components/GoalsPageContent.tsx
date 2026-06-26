'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import type {
  GoalCategory,
  GoalDueDateFilter,
  GoalFormSavePayload,
  GoalFormValues,
  GoalWithMilestones,
  HabitGoal,
  HabitMilestone,
  MilestoneDraft,
} from '@/lib/goals/types';
import { matchesDueDateFilter, sortGoals } from '@/lib/goals/filters';
import { loadLinkedItemsByGoalId } from '@/lib/goals/loadLinkedItems';
import { parseMilestoneValues } from '@/lib/goals/milestoneProgress';
import { syncGoalMilestones } from '@/lib/goals/syncMilestones';
import {
  loadHabitsForGoalForm,
  syncGoalHabits,
  type GoalHabitOption,
} from '@/lib/goals/syncGoalHabits';
import GoalCard from './GoalCard';
import GoalFilters from './GoalFilters';
import GoalFormDialog from './GoalFormDialog';
import { neon } from '@/app/dashboard/neonTheme';

const EMPTY_GOAL_FORM: GoalFormValues = {
  name: '',
  description: '',
  vision_statement: '',
  category: '',
  deadline: '',
  target_value: '',
  target_unit: '',
};

function goalToForm(goal: HabitGoal): GoalFormValues {
  return {
    name: goal.name,
    description: goal.description ?? '',
    vision_statement: goal.vision_statement ?? '',
    category: goal.category ?? '',
    deadline: goal.deadline ?? '',
    target_value: goal.target_value != null ? String(goal.target_value) : '',
    target_unit: goal.target_unit ?? '',
  };
}

function milestonesToDrafts(milestones: HabitMilestone[]): MilestoneDraft[] {
  return milestones
    .filter((m) => !m.is_archived)
    .map((m) => ({
      clientId: m.id,
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      due_date: m.due_date ?? '',
      target_value: m.values.length > 0 ? String(m.values[m.values.length - 1]) : '',
      is_completed: m.is_completed,
    }));
}

function mapMilestone(row: Record<string, unknown>): HabitMilestone {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    goal_id: String(row.goal_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    values: parseMilestoneValues(row.values),
    current_value: row.current_value != null ? Number(row.current_value) : null,
    due_date: (row.due_date as string | null) ?? null,
    is_completed: Boolean(row.is_completed),
    is_archived: Boolean(row.is_archived),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapGoal(row: Record<string, unknown>): HabitGoal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    vision_statement: (row.vision_statement as string | null) ?? null,
    category: (row.category as HabitGoal['category']) ?? null,
    target_value: row.target_value != null ? Number(row.target_value) : null,
    target_unit: (row.target_unit as string | null) ?? null,
    current_value: row.current_value != null ? Number(row.current_value) : null,
    priority_score: row.priority_score != null ? Number(row.priority_score) : null,
    deadline: (row.deadline as string | null) ?? null,
    is_completed: Boolean(row.is_completed),
    is_archived: Boolean(row.is_archived),
    sort_order: row.sort_order != null ? Number(row.sort_order) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export default function GoalsPageContent() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<GoalWithMilestones[]>([]);
  const [category, setCategory] = useState<GoalCategory | ''>('');
  const [dueDateFilter, setDueDateFilter] = useState<GoalDueDateFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithMilestones | null>(null);
  const [formMilestones, setFormMilestones] = useState<MilestoneDraft[]>([]);
  const [formHabits, setFormHabits] = useState<GoalHabitOption[]>([]);
  const [formLinkedHabitIds, setFormLinkedHabitIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    setUserId(uid);

    const { data: goalRows, error: goalsError } = await supabase
      .from('habit_goals')
      .select('*')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true });

    if (goalsError) {
      console.error(goalsError);
      setLoading(false);
      return;
    }

    const mappedGoals = (goalRows ?? []).map((r) => mapGoal(r as Record<string, unknown>));
    const goalIds = mappedGoals.map((g) => g.id);

    const [milestonesRes, linkedMap] = await Promise.all([
      goalIds.length > 0
        ? supabase.from('habit_milestones').select('*').eq('user_id', uid).in('goal_id', goalIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      loadLinkedItemsByGoalId(supabase, uid, goalIds),
    ]);

    const milestonesByGoal: Record<string, HabitMilestone[]> = {};
    for (const row of milestonesRes.data ?? []) {
      const m = mapMilestone(row as Record<string, unknown>);
      if (!milestonesByGoal[m.goal_id]) milestonesByGoal[m.goal_id] = [];
      milestonesByGoal[m.goal_id].push(m);
    }

    setGoals(
      mappedGoals.map((g) => ({
        ...g,
        milestones: milestonesByGoal[g.id] ?? [],
        linkedItems: linkedMap[g.id] ?? [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredGoals = useMemo(() => {
    return sortGoals(
      goals.filter((g) => {
        if (!showArchived && g.is_archived) return false;
        if (category && g.category !== category) return false;
        if (!matchesDueDateFilter(g, dueDateFilter)) return false;
        return true;
      })
    );
  }, [goals, category, dueDateFilter, showArchived]);

  const activeCount = goals.filter((g) => !g.is_archived && !g.is_completed).length;
  const completedLinked = goals.reduce(
    (sum, g) => sum + g.linkedItems.filter((i) => i.completed).length,
    0
  );

  const handleSaveGoal = async ({
    goal,
    milestones,
    removedMilestoneIds,
    linkedHabitIds,
  }: GoalFormSavePayload) => {
    if (!userId || !goal.name) return;
    setSaving(true);

    const payload = {
      user_id: userId,
      name: goal.name,
      description: goal.description || null,
      vision_statement: goal.vision_statement || null,
      category: goal.category || null,
      deadline: goal.deadline || null,
      target_value: goal.target_value ? Number(goal.target_value) : null,
      target_unit: goal.target_unit || null,
      updated_at: new Date().toISOString(),
    };

    let goalId = editingGoal?.id;

    if (editingGoal) {
      await supabase.from('habit_goals').update(payload).eq('id', editingGoal.id);
    } else {
      const { data, error } = await supabase
        .from('habit_goals')
        .insert({ ...payload, current_value: 0 })
        .select('id')
        .single();

      if (error || !data) {
        console.error(error);
        setSaving(false);
        return;
      }
      goalId = data.id;
    }

    if (goalId) {
      await syncGoalMilestones(supabase, userId, goalId, milestones, removedMilestoneIds);
      await syncGoalHabits(supabase, userId, goalId, linkedHabitIds);
    }

    setSaving(false);
    setFormOpen(false);
    setEditingGoal(null);
    setFormMilestones([]);
    setFormHabits([]);
    setFormLinkedHabitIds([]);
    await loadData();
  };

  const prepareFormHabits = async (uid: string, goalId?: string) => {
    const habits = await loadHabitsForGoalForm(supabase, uid);
    setFormHabits(habits);
    if (goalId) {
      setFormLinkedHabitIds(
        habits.filter((h) => h.linkedGoalIds.includes(goalId)).map((h) => h.id)
      );
    } else {
      setFormLinkedHabitIds([]);
    }
  };

  const openCreateForm = () => {
    if (!userId) return;
    setEditingGoal(null);
    setFormMilestones([]);
    setFormHabits([]);
    setFormLinkedHabitIds([]);
    setFormOpen(true);
    void prepareFormHabits(userId);
  };

  const openEditForm = (goal: GoalWithMilestones) => {
    if (!userId) return;
    setEditingGoal(goal);
    setFormMilestones(milestonesToDrafts(goal.milestones));
    setFormHabits([]);
    setFormLinkedHabitIds([]);
    setFormOpen(true);
    void prepareFormHabits(userId, goal.id);
  };

  const handleToggleMilestone = async (milestoneId: string, completed: boolean) => {
    await supabase
      .from('habit_milestones')
      .update({ is_completed: completed, updated_at: new Date().toISOString() })
      .eq('id', milestoneId);
    await loadData();
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    await supabase.from('habit_milestones').delete().eq('id', milestoneId);
    await loadData();
  };

  const handleArchive = async (goal: HabitGoal) => {
    await supabase
      .from('habit_goals')
      .update({ is_archived: !goal.is_archived, updated_at: new Date().toISOString() })
      .eq('id', goal.id);
    await loadData();
  };

  const handleComplete = async (goal: HabitGoal) => {
    await supabase
      .from('habit_goals')
      .update({ is_completed: true, updated_at: new Date().toISOString() })
      .eq('id', goal.id);
    await loadData();
  };

  const handleDelete = async (goal: HabitGoal) => {
    const confirmed = window.confirm(
      `Delete "${goal.name}"? Milestones will be removed. Linked habits and tasks will be unlinked.`
    );
    if (!confirmed) return;

    await supabase.from('habit_goals').delete().eq('id', goal.id);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:max-w-4xl">
      <section className={`${neon.panel} p-5 text-center`}>
        <p className="text-sm leading-relaxed text-slate-300">
          Your vision is the compass. Track goals, celebrate milestones, and see every habit and task
          moving you forward.
        </p>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div>
            <span className="block text-2xl font-bold text-[#ffe066]">{activeCount}</span>
            <span className="text-slate-500">active goals</span>
          </div>
          <div>
            <span className="block text-2xl font-bold text-[#ffe066]">{completedLinked}</span>
            <span className="text-slate-500">linked items done</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GoalFilters
          category={category}
          onCategoryChange={setCategory}
          dueDateFilter={dueDateFilter}
          onDueDateFilterChange={setDueDateFilter}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />
      </div>

      <button
        type="button"
        onClick={openCreateForm}
        className="w-full rounded-xl border-2 border-dashed border-[#ff9d00]/45 py-3.5 text-sm font-semibold text-[#ffe066] transition hover:border-[#ff9d00]/70 hover:bg-[#ff9d00]/5"
      >
        + Create a new goal
      </button>

      {filteredGoals.length === 0 ? (
        <div className={`${neon.section} p-8 text-center`}>
          <p className="text-lg font-semibold text-slate-300">No goals yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Start with one meaningful goal. Add a vision statement to remind yourself why it matters.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => openEditForm(goal)}
              onArchive={() => void handleArchive(goal)}
              onComplete={() => void handleComplete(goal)}
              onDelete={() => void handleDelete(goal)}
              onAddMilestone={() => openEditForm(goal)}
              onToggleMilestone={(id, completed) => void handleToggleMilestone(id, completed)}
              onDeleteMilestone={(id) => void handleDeleteMilestone(id)}
            />
          ))}
        </div>
      )}

      <GoalFormDialog
        open={formOpen}
        title={editingGoal ? 'Edit goal' : 'New goal'}
        initial={editingGoal ? goalToForm(editingGoal) : EMPTY_GOAL_FORM}
        initialMilestones={formMilestones}
        availableHabits={formHabits}
        initialLinkedHabitIds={formLinkedHabitIds}
        editingGoalId={editingGoal?.id ?? null}
        saving={saving}
        onClose={() => {
          setFormOpen(false);
          setEditingGoal(null);
          setFormMilestones([]);
          setFormHabits([]);
          setFormLinkedHabitIds([]);
        }}
        onSave={(payload) => void handleSaveGoal(payload)}
      />
    </div>
  );
}
