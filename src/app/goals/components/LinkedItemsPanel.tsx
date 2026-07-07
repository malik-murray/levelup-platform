'use client';

import type { LinkedItem } from '@/lib/goals/types';
import { LINKED_ITEM_TYPE_LABELS } from '@/lib/goals/loadLinkedItems';
import { linkedItemsSummary } from '@/lib/goals/milestoneProgress';
import { neon } from '@/app/dashboard/neonTheme';
import CollapsibleSection from '@/components/ui/CollapsibleSection';

type Props = {
  items: LinkedItem[];
  expanded: boolean;
  onToggle: () => void;
};

const toggleBtnClass = `${neon.section} flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:border-[#ff9d00]/45`;

export default function LinkedItemsPanel({ items, expanded, onToggle }: Props) {
  const summary = linkedItemsSummary(items);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={toggleBtnClass}
      >
        <span className="text-slate-300">
          <span className="font-medium text-slate-200">Linked items</span>
          {summary.total > 0 ? (
            <>
              <span className="text-slate-500"> · </span>
              <span className="font-medium text-[#ffe066]">{summary.completed}</span>
              <span className="text-slate-400"> / {summary.total} done</span>
            </>
          ) : (
            <span className="text-slate-500"> · none yet</span>
          )}
        </span>
        <span className="text-[#ff9d00]/70" aria-hidden>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      <CollapsibleSection open={expanded}>
        {summary.total === 0 ? (
          <p className="mt-2 px-1 text-xs text-slate-500">
            Link habits, to-dos, priorities, or weekly plan items to track progress here.
          </p>
        ) : (
          <ul className={`${neon.widget} mt-2 max-h-48 space-y-1 overflow-y-auto p-2`}>
            {items.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    item.completed ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                  aria-hidden
                />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {LINKED_ITEM_TYPE_LABELS[item.type]}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    item.completed ? 'text-slate-500 line-through' : 'text-slate-200'
                  }`}
                >
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    </div>
  );
}
