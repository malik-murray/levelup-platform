'use client';

import { useState } from 'react';
import type { GoalWithMilestones } from '@/lib/goals/types';
import { goalCategoryBadgeClass, goalCategoryLabel } from '@/lib/goals/categories';
import {
  goalProgressPercent,
  milestoneProgressPercent,
  parseMilestoneValues,
} from '@/lib/goals/milestoneProgress';
import LinkedItemsPanel from './LinkedItemsPanel';
import { neon } from '@/app/dashboard/neonTheme';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

type Props = {
  goal: GoalWithMilestones;
  onEdit: () => void;
  onArchive: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onAddMilestone: () => void;
  onToggleMilestone: (milestoneId: string, completed: boolean) => void;
  onDeleteMilestone: (milestoneId: string) => void;
};

function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

export default function GoalCard({
  goal,
  onEdit,
  onArchive,
  onComplete,
  onDelete,
  onAddMilestone,
  onToggleMilestone,
  onDeleteMilestone,
}: Props) {
  const [milestonesExpanded, setMilestonesExpanded] = useState(false);
  const [linkedExpanded, setLinkedExpanded] = useState(false);
  const progress = goalProgressPercent(goal, goal.milestones);
  const activeMilestones = goal.milestones.filter((m) => !m.is_archived);
  const completedMilestones = activeMilestones.filter((m) => m.is_completed).length;
  const deadlineLabel = formatDate(goal.deadline);
  const isOverdue = goal.deadline && !goal.is_completed && new Date(`${goal.deadline}T00:00:00`) < new Date();

  return (
    <article
      className={`${neon.panel} flex flex-col gap-3 p-4 ${
        goal.is_archived ? 'opacity-60' : ''
      } ${goal.is_completed ? 'border-emerald-500/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {goal.category ? (
              <span className={goalCategoryBadgeClass(goal.category)}>
                {goalCategoryLabel(goal.category)}
              </span>
            ) : null}
            {goal.is_completed ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                Completed
              </span>
            ) : null}
            {isOverdue ? (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
                Overdue
              </span>
            ) : null}
          </div>

          <h3
            className={`text-lg font-bold ${goal.is_completed ? 'text-slate-400 line-through' : 'text-white'}`}
          >
            {goal.name}
          </h3>

          {goal.vision_statement ? (
            <p className="mt-2 text-sm italic leading-relaxed text-[#ffe066]/90">
              &ldquo;{goal.vision_statement}&rdquo;
            </p>
          ) : null}

          {goal.description ? (
            <p className="mt-2 text-sm text-slate-400">{goal.description}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {deadlineLabel ? <span>Due {deadlineLabel}</span> : null}
            {goal.target_value != null ? (
              <span>
                {goal.current_value ?? 0} / {goal.target_value}
                {goal.target_unit ? ` ${goal.target_unit}` : ''}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#ff9d00]/50 bg-black/40"
            aria-label={`${progress}% progress`}
          >
            <span className="text-sm font-bold text-[#ffe066]">{progress}%</span>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,157,0,0.15)" strokeWidth="4" />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="#ff9d00"
                strokeWidth="4"
                strokeDasharray={`${(progress / 100) * 150.8} 150.8`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setMilestonesExpanded((v) => !v)}
          aria-expanded={milestonesExpanded}
          className={`${neon.section} flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:border-[#ff9d00]/45`}
        >
          <span className="text-slate-300">
            <span className="font-medium text-slate-200">Milestones</span>
            {activeMilestones.length > 0 ? (
              <>
                <span className="text-slate-500"> · </span>
                <span className="font-medium text-[#ffe066]">{completedMilestones}</span>
                <span className="text-slate-400"> / {activeMilestones.length} done</span>
              </>
            ) : (
              <span className="text-slate-500"> · none yet</span>
            )}
          </span>
          <span className="text-[#ff9d00]/70" aria-hidden>
            {milestonesExpanded ? '▲' : '▼'}
          </span>
        </button>

        <CollapsibleSection open={milestonesExpanded}>
          {activeMilestones.length === 0 ? (
            <p className="mt-2 px-1 text-xs text-slate-500">
              Add milestones to break this goal into checkpoints.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {activeMilestones.map((m) => {
                const values = parseMilestoneValues(m.values);
                const mProgress = milestoneProgressPercent(m);
                const due = formatDate(m.due_date);

                return (
                  <li
                    key={m.id}
                    className={`${neon.section} flex items-start gap-3 px-3 py-2`}
                  >
                    <input
                      type="checkbox"
                      checked={m.is_completed}
                      onChange={(e) => onToggleMilestone(m.id, e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#ff9d00]"
                      aria-label={`Mark ${m.name} complete`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${
                            m.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'
                          }`}
                        >
                          {m.name}
                        </span>
                        {values.length > 0 ? (
                          <span className="shrink-0 text-xs text-slate-500">{mProgress}%</span>
                        ) : null}
                      </div>
                      {m.description ? (
                        <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
                      ) : null}
                      {due ? <p className="mt-0.5 text-xs text-slate-500">Due {due}</p> : null}
                      {values.length > 0 ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full bg-[#ff9d00]/70 transition-all"
                            style={{ width: `${mProgress}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteMilestone(m.id)}
                      className="shrink-0 text-xs text-slate-600 hover:text-red-400"
                      aria-label={`Delete milestone ${m.name}`}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleSection>
      </div>

      <LinkedItemsPanel
        items={goal.linkedItems}
        expanded={linkedExpanded}
        onToggle={() => setLinkedExpanded((v) => !v)}
      />

      <div className="flex flex-wrap gap-2 border-t border-[#ff9d00]/15 pt-3">
        <button type="button" onClick={onAddMilestone} className={neon.buttonOutline}>
          + Milestone
        </button>
        <button type="button" onClick={onEdit} className={neon.buttonGhost}>
          Edit
        </button>
        {!goal.is_completed ? (
          <button
            type="button"
            onClick={onComplete}
            className="rounded-lg border border-emerald-500/35 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Mark complete
          </button>
        ) : null}
        <button
          type="button"
          onClick={onArchive}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300"
        >
          {goal.is_archived ? 'Unarchive' : 'Archive'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400/80 hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
