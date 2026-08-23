'use client';

import { useRouter } from 'next/navigation';
import type { WeeklyTodoItem } from '@/lib/habit/weeklyPlanActions';

export default function WeeklyTodoList({
    todos,
    busy,
    onToggle,
    onDelete,
}: {
    todos: WeeklyTodoItem[];
    busy?: boolean;
    onToggle: (todo: WeeklyTodoItem, completed: boolean) => void;
    onDelete: (todo: WeeklyTodoItem) => void;
}) {
    const router = useRouter();

    if (todos.length === 0) {
        return <p className="text-sm text-slate-500 text-center py-2">No weekly to-dos yet.</p>;
    }

    return (
        <ul className="space-y-2">
            {todos.map((todo, index) => {
                const editPath = `/habit/weekly-plan/todo/${todo.id}/edit`;
                return (
                    <li
                        key={todo.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(editPath)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                router.push(editPath);
                            }
                        }}
                        className="flex items-center gap-3 p-3 rounded border border-slate-700 bg-slate-900/50 min-h-[44px] cursor-pointer transition-colors hover:border-slate-600 hover:bg-slate-900/80"
                    >
                        <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-semibold text-[#ff9d00]/90"
                            aria-label={`Priority ${index + 1}`}
                        >
                            {index + 1}.
                        </span>
                        <input
                            type="checkbox"
                            checked={!!todo.is_done}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onToggle(todo, e.target.checked)}
                            disabled={busy}
                            aria-label={`Mark ${todo.title} complete`}
                            className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1 min-w-0">
                            <span
                                className={`font-medium block ${todo.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}
                            >
                                {todo.title}
                            </span>
                            <span className="text-xs text-slate-400">
                                {todo.assigned_date
                                    ? new Date(todo.assigned_date + 'T12:00:00').toLocaleDateString('en-US', {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                      })
                                    : 'Not scheduled'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(editPath);
                            }}
                            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#ff9d00]/30 text-[#ff9d00]/80 transition hover:border-[#ff9d00]/60 hover:text-[#ffe066] shrink-0"
                            aria-label={`Edit ${todo.title}`}
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(todo);
                            }}
                            disabled={busy}
                            className="text-red-400 hover:text-red-300 text-sm shrink-0 disabled:opacity-50"
                        >
                            Delete
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
