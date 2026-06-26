'use client';

import type { GoalPickerOption } from '@/lib/goals/useGoalsForPicker';

type Props = {
  goals: GoalPickerOption[];
  value: string | null;
  onChange: (goalId: string | null) => void;
  className?: string;
  compact?: boolean;
};

const selectClass =
  'w-full rounded-lg border border-[#ff9d00]/35 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#ff9d00]/70 focus:outline-none';

const compactClass =
  'max-w-[9.5rem] rounded-md border border-[#ff9d00]/35 bg-[#03060f]/90 px-1.5 py-0.5 text-[10px] text-white focus:border-[#ff9d00]/60 focus:outline-none focus:ring-1 focus:ring-[#ff9d00]/30';

export function GoalPicker({ goals, value, onChange, className, compact }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={className ?? (compact ? compactClass : selectClass)}
      aria-label="Link to goal"
      title="Link to goal"
    >
      <option value="">{compact ? 'Goal…' : 'No goal'}</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
