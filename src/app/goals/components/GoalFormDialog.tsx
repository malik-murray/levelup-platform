'use client';

import { useEffect, useState } from 'react';
import type { GoalFormSavePayload, GoalFormValues, MilestoneDraft } from '@/lib/goals/types';
import { GOAL_CATEGORIES } from '@/lib/goals/types';
import { goalCategoryLabel } from '@/lib/goals/categories';
import type { GoalHabitOption } from '@/lib/goals/syncGoalHabits';
import { neon } from '@/app/dashboard/neonTheme';

type Props = {
  open: boolean;
  title: string;
  initial: GoalFormValues;
  initialMilestones: MilestoneDraft[];
  availableHabits: GoalHabitOption[];
  initialLinkedHabitIds: string[];
  editingGoalId?: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: GoalFormSavePayload) => void;
};

const inputClass =
  'w-full rounded-lg border border-[#ff9d00]/35 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#ff9d00]/70 focus:outline-none';

const compactInputClass =
  'w-full rounded-lg border border-[#ff9d00]/30 bg-black/30 px-2.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#ff9d00]/60 focus:outline-none';

function newMilestoneDraft(): MilestoneDraft {
  return {
    clientId: crypto.randomUUID(),
    name: '',
    description: '',
    due_date: '',
    target_value: '',
    is_completed: false,
  };
}

export default function GoalFormDialog({
  open,
  title,
  initial,
  initialMilestones,
  availableHabits,
  initialLinkedHabitIds,
  editingGoalId,
  saving,
  onClose,
  onSave,
}: Props) {
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [removedMilestoneIds, setRemovedMilestoneIds] = useState<string[]>([]);
  const [linkedHabitIds, setLinkedHabitIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setMilestones(
        initialMilestones.length > 0 ? initialMilestones.map((m) => ({ ...m })) : []
      );
      setRemovedMilestoneIds([]);
      setLinkedHabitIds([...initialLinkedHabitIds]);
    }
  }, [open, initialMilestones, initialLinkedHabitIds]);

  if (!open) return null;

  const updateMilestone = (clientId: string, patch: Partial<MilestoneDraft>) => {
    setMilestones((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, ...patch } : m)));
  };

  const removeMilestone = (draft: MilestoneDraft) => {
    if (draft.id) {
      setRemovedMilestoneIds((prev) => [...prev, draft.id!]);
    }
    setMilestones((prev) => prev.filter((m) => m.clientId !== draft.clientId));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({
      goal: {
        name: String(fd.get('name') ?? '').trim(),
        description: String(fd.get('description') ?? '').trim(),
        vision_statement: String(fd.get('vision_statement') ?? '').trim(),
        category: (fd.get('category') as GoalFormValues['category']) || '',
        deadline: String(fd.get('deadline') ?? ''),
        target_value: String(fd.get('target_value') ?? '').trim(),
        target_unit: String(fd.get('target_unit') ?? '').trim(),
      },
      milestones: milestones.filter((m) => m.name.trim()),
      removedMilestoneIds,
      linkedHabitIds,
    });
  };

  const toggleHabit = (habitId: string) => {
    setLinkedHabitIds((prev) =>
      prev.includes(habitId) ? prev.filter((id) => id !== habitId) : [...prev, habitId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close dialog" onClick={onClose} />
      <div
        className={`${neon.panel} relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-5`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-form-title"
      >
        <h2 id="goal-form-title" className="mb-4 text-lg font-bold text-[#ffe066]">
          {title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Goal name *</span>
            <input
              name="name"
              required
              defaultValue={initial.name}
              placeholder="e.g. Run a marathon"
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Vision statement</span>
            <textarea
              name="vision_statement"
              rows={3}
              defaultValue={initial.vision_statement}
              placeholder="Why does this matter to you? What will life look like when you achieve it?"
              className={inputClass}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Description</span>
            <textarea
              name="description"
              rows={2}
              defaultValue={initial.description}
              placeholder="Optional details"
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Category</span>
              <select name="category" defaultValue={initial.category} className={inputClass}>
                <option value="">Select category</option>
                {GOAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {goalCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Due date</span>
              <input name="deadline" type="date" defaultValue={initial.deadline} className={inputClass} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Target value</span>
              <input
                name="target_value"
                type="number"
                min="0"
                step="any"
                defaultValue={initial.target_value}
                placeholder="e.g. 10000"
                className={inputClass}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Unit</span>
              <input
                name="target_unit"
                defaultValue={initial.target_unit}
                placeholder="e.g. subscribers, lbs"
                className={inputClass}
              />
            </label>
          </div>

          <div className="space-y-3 border-t border-[#ff9d00]/15 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Milestones
              </span>
              <button
                type="button"
                onClick={() => setMilestones((prev) => [...prev, newMilestoneDraft()])}
                className="text-xs font-semibold text-[#ffe066] hover:text-[#ff9d00]"
              >
                + Add milestone
              </button>
            </div>

            {milestones.length === 0 ? (
              <p className="text-xs text-slate-500">
                Optional checkpoints to break this goal into smaller steps.
              </p>
            ) : (
              <ul className="space-y-3">
                {milestones.map((m, index) => (
                  <li key={m.clientId} className={`${neon.section} space-y-2 p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500">Milestone {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeMilestone(m)}
                        className="text-xs text-slate-500 hover:text-red-400"
                        aria-label={`Remove milestone ${index + 1}`}
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      value={m.name}
                      onChange={(e) => updateMilestone(m.clientId, { name: e.target.value })}
                      placeholder="Milestone name"
                      className={compactInputClass}
                    />

                    <input
                      value={m.description}
                      onChange={(e) => updateMilestone(m.clientId, { description: e.target.value })}
                      placeholder="Description (optional)"
                      className={compactInputClass}
                    />

                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={m.due_date}
                        onChange={(e) => updateMilestone(m.clientId, { due_date: e.target.value })}
                        className={compactInputClass}
                        aria-label={`Due date for milestone ${index + 1}`}
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={m.target_value}
                        onChange={(e) => updateMilestone(m.clientId, { target_value: e.target.value })}
                        placeholder="Target (optional)"
                        className={compactInputClass}
                        aria-label={`Target for milestone ${index + 1}`}
                      />
                    </div>

                    {m.id ? (
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                        <input
                          type="checkbox"
                          checked={m.is_completed}
                          onChange={(e) =>
                            updateMilestone(m.clientId, { is_completed: e.target.checked })
                          }
                          className="h-3.5 w-3.5 accent-[#ff9d00]"
                        />
                        Completed
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-[#ff9d00]/15 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Linked habits
            </span>
            {availableHabits.length === 0 ? (
              <p className="text-xs text-slate-500">
                No active habits yet. Create habits on the dashboard to link them here.
              </p>
            ) : (
              <ul className={`${neon.section} max-h-40 space-y-1 overflow-y-auto p-2`}>
                {availableHabits.map((habit) => {
                  const checked = linkedHabitIds.includes(habit.id);
                  const linkedElsewhere =
                    !checked &&
                    habit.linkedGoalIds.some((goalId) => goalId !== editingGoalId);

                  return (
                    <li key={habit.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#ff9d00]/5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHabit(habit.id)}
                          className="h-4 w-4 shrink-0 accent-[#ff9d00]"
                        />
                        <span className="shrink-0 text-base" aria-hidden>
                          {habit.icon || '✓'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                          {habit.name}
                        </span>
                        {linkedElsewhere ? (
                          <span className="shrink-0 text-[10px] text-slate-500">other goal</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[#ff9d00]/35 py-2.5 text-sm font-semibold text-slate-300 hover:border-[#ff9d00]/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#ff9d00]/25 py-2.5 text-sm font-semibold text-[#ffe066] shadow-[0_0_16px_rgba(255,157,0,0.2)] hover:bg-[#ff9d00]/35 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
