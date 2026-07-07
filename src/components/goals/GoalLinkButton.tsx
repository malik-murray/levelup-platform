'use client';

import { useEffect, useRef, useState } from 'react';
import type { GoalPickerOption } from '@/lib/goals/useGoalsForPicker';

type Props = {
  goals: GoalPickerOption[];
  value: string | null;
  onChange: (goalId: string | null) => void;
  /** @deprecated prefer `size` */
  compact?: boolean;
  size?: 'default' | 'compact' | 'xs' | 'xxs';
};

function resolveSize(compact: boolean, size?: Props['size']): NonNullable<Props['size']> {
  if (size) return size;
  return compact ? 'compact' : 'default';
}

function sizeStyles(size: NonNullable<Props['size']>) {
  if (size === 'xxs') {
    return { box: 'h-[18px] w-[18px] min-h-0 min-w-0 rounded', icon: 'h-2.5 w-2.5' };
  }
  if (size === 'xs') {
    return { box: 'min-h-[22px] min-w-[22px] rounded', icon: 'h-3 w-3' };
  }
  if (size === 'compact') {
    return { box: 'min-h-[28px] min-w-[28px] rounded-md', icon: 'h-3.5 w-3.5' };
  }
  return { box: 'min-h-[40px] min-w-[40px] rounded-xl', icon: 'h-5 w-5' };
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <circle cx="12" cy="12" r="5" strokeWidth={2} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GoalLinkButton({ goals, value, onChange, compact = false, size }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const linkedGoal = goals.find((g) => g.id === value);
  const resolvedSize = resolveSize(compact, size);
  const { box: sizeClass, icon: iconClass } = sizeStyles(resolvedSize);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-center border transition focus:outline-none focus-visible:ring-2 ${sizeClass} ${
          value
            ? 'border-[#ff9d00]/65 bg-[#ff9d00]/15 text-[#ffe066] focus-visible:ring-[#ff9d00]/40'
            : 'border-[#ff9d00]/40 bg-[#ff9d00]/5 text-[#ff9d00]/80 hover:border-[#ff9d00]/65 hover:bg-[#ff9d00]/15 focus-visible:ring-[#ff9d00]/40'
        }`}
        aria-label={linkedGoal ? `Linked to goal: ${linkedGoal.name}` : 'Link to goal'}
        title={linkedGoal ? linkedGoal.name : 'Link to goal'}
      >
        <TargetIcon className={iconClass} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-52 w-[min(12rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[#ff9d00]/35 bg-[#03060f] py-1 shadow-lg sm:w-48">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[#ff9d00]/10 ${!value ? 'text-[#ffe066]' : 'text-slate-400'}`}
          >
            No goal
          </button>
          {goals.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onChange(g.id);
                setOpen(false);
              }}
              className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-[#ff9d00]/10 ${value === g.id ? 'font-medium text-[#ffe066]' : 'text-white'}`}
            >
              {g.name}
            </button>
          ))}
          {goals.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-slate-500">No goals yet</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
