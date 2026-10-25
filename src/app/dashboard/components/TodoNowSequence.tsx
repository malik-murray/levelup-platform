'use client';

import Link from 'next/link';
import { QUADRANT_META, getQuadrant } from '@/lib/habit/eisenhower';
import { daysUntilDue, focusScore, focusSummary, type FocusTask } from '@/lib/habit/focusScore';

function dueDetail(task: FocusTask, day: string): string {
    if (!task.due_date) return 'No due date';
    const days = daysUntilDue(task.due_date, day);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days}d`;
}

function groupLabel(task: FocusTask, day: string, done: boolean): string {
    if (done) return 'Done';
    if (task.due_date && daysUntilDue(task.due_date, day) < 0) return 'Overdue';
    if (task.due_date && daysUntilDue(task.due_date, day) === 0) return 'Due today';
    if (task.assigned_date === day) return 'Assigned today';
    return 'Coming up';
}

export default function TodoNowSequence({
    tasks,
    day,
    onToggle,
    todoHref,
    mode = 'both',
}: {
    tasks: FocusTask[];
    day: string;
    onToggle: (taskId: string, isDone: boolean) => void;
    todoHref: string | null;
    mode?: 'card' | 'list' | 'both';
}) {
    const summary = focusSummary(tasks, day);
    const now = tasks.find((task) => focusScore(task, day) != null) ?? null;
    const doneCount = tasks.filter((task) => focusScore(task, day) == null).length;
    const showCard = mode !== 'list';
    const showList = mode !== 'card';

    return (
        <div className={showList ? 'space-y-3' : 'h-full'}>
            {showCard ? (
            <div className="flex h-full flex-col rounded-xl border-2 border-[#93c5fd]/70 bg-[#93c5fd]/10 px-3 py-3 shadow-[0_0_24px_rgba(147,197,253,0.16)] sm:px-4 sm:py-4">
                {now ? (
                    <>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#93c5fd]">
                            Do this now · {dueDetail(now, day)}
                            {focusScore(now, day) != null ? ` · Score ${focusScore(now, day)}` : ''}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                            <span className="text-3xl leading-none" aria-hidden>
                                📋
                            </span>
                            <p className="min-w-0 flex-1 text-base font-bold text-white sm:text-xl">{now.title}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggle(now.id, false)}
                            className="mt-4 inline-flex items-center justify-center self-start rounded-full bg-[#93c5fd] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(147,197,253,0.35)] transition hover:bg-[#bfdbfe]"
                        >
                            Mark done
                        </button>
                    </>
                ) : tasks.length > 0 ? (
                    <>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#93c5fd]">
                            To-dos complete
                        </p>
                        <p className="mt-2 text-base font-bold text-white sm:text-lg">Today&apos;s to-do list is done.</p>
                    </>
                ) : (
                    <>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#93c5fd]">
                            Do this now
                        </p>
                        <p className="mt-2 text-base font-bold text-white sm:text-lg">Nothing from the to-do list is on today.</p>
                        {todoHref ? (
                            <Link
                                href={todoHref}
                                className="mt-4 inline-flex items-center justify-center rounded-full bg-[#93c5fd] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(147,197,253,0.35)] transition hover:bg-[#bfdbfe]"
                            >
                                Open to-do
                            </Link>
                        ) : null}
                    </>
                )}
                <p className="mt-auto pt-3 text-xs text-slate-400">
                    {tasks.length === 0
                        ? 'Add a task on the to-do page and it shows up here by focus score.'
                        : `${doneCount} of ${tasks.length} to-dos done · highest focus score first`}
                </p>
                {tasks.length > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                        {summary.overdue} overdue · {summary.dueToday} due today · {summary.dueNext7} in the next 7 days
                    </p>
                ) : null}
            </div>
            ) : null}

            {showList && tasks.length > 0 ? (
                <ol className="space-y-1.5">
                    {tasks.map((task, index) => {
                        const done = focusScore(task, day) == null;
                        const previous = index > 0 ? tasks[index - 1] : null;
                        const label = groupLabel(task, day, done);
                        const previousLabel = previous ? groupLabel(previous, day, focusScore(previous, day) == null) : null;
                        const quadrant = QUADRANT_META[getQuadrant(task)];
                        const score = focusScore(task, day);
                        const isNow = now?.id === task.id;

                        return (
                            <li key={task.id}>
                                {label !== previousLabel ? (
                                    <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#93c5fd]/80 first:mt-0">
                                        {label}
                                    </p>
                                ) : null}
                                <label
                                    className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border px-2.5 py-2 ${
                                        isNow ? 'border-[#93c5fd]/70 bg-[#93c5fd]/10' : 'border-transparent hover:bg-white/5'
                                    }`}
                                >
                                    <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
                                        {index + 1}
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={done}
                                        onChange={() => onToggle(task.id, done)}
                                        className="h-5 w-5 shrink-0 rounded border-[#93c5fd]/50 text-[#93c5fd] focus:ring-[#93c5fd]/40"
                                        aria-label={`${done ? 'Undo' : 'Complete'} ${task.title}`}
                                    />
                                    <span className="shrink-0 text-lg" aria-hidden>
                                        📋
                                    </span>
                                    <span className={`min-w-0 flex-1 break-words ${done ? 'text-slate-500 line-through' : 'text-white'}`}>
                                        {task.title}
                                    </span>
                                    {isNow ? (
                                        <span className="shrink-0 rounded-full bg-[#93c5fd] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                                            Now
                                        </span>
                                    ) : null}
                                    {score != null ? (
                                        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#ffe066]">
                                            {score}
                                        </span>
                                    ) : null}
                                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                                        <span className="rounded border border-[#93c5fd]/35 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                            {quadrant.shortLabel}
                                        </span>
                                        <span className="rounded border border-[#93c5fd]/35 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                            {dueDetail(task, day)}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ol>
            ) : null}
        </div>
    );
}
