'use client';

import type { GoalCategory, GoalDueDateFilter } from '@/lib/goals/types';
import { GOAL_CATEGORIES } from '@/lib/goals/types';
import { goalCategoryLabel } from '@/lib/goals/categories';
import { neon } from '@/app/dashboard/neonTheme';

type Props = {
  category: GoalCategory | '';
  onCategoryChange: (v: GoalCategory | '') => void;
  dueDateFilter: GoalDueDateFilter;
  onDueDateFilterChange: (v: GoalDueDateFilter) => void;
  showArchived: boolean;
  onShowArchivedChange: (v: boolean) => void;
};

const DUE_DATE_OPTIONS: { value: GoalDueDateFilter; label: string }[] = [
  { value: 'all', label: 'All deadlines' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'this-week', label: 'Due this week' },
  { value: 'this-month', label: 'Due this month' },
  { value: 'no-deadline', label: 'No deadline' },
];

export default function GoalFilters({
  category,
  onCategoryChange,
  dueDateFilter,
  onDueDateFilterChange,
  showArchived,
  onShowArchivedChange,
}: Props) {
  return (
    <div className={`${neon.section} space-y-4 p-4`}>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Category</span>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as GoalCategory | '')}
            className="rounded-lg border border-[#ff9d00]/35 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#ff9d00]/70 focus:outline-none"
          >
            <option value="">All categories</option>
            {GOAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {goalCategoryLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Due date</span>
          <select
            value={dueDateFilter}
            onChange={(e) => onDueDateFilterChange(e.target.value as GoalDueDateFilter)}
            className="rounded-lg border border-[#ff9d00]/35 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#ff9d00]/70 focus:outline-none"
          >
            {DUE_DATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => onShowArchivedChange(e.target.checked)}
          className="h-4 w-4 rounded border-[#ff9d00]/40 accent-[#ff9d00]"
        />
        Show archived goals
      </label>
    </div>
  );
}
