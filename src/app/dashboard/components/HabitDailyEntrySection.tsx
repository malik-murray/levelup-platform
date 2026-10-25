'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { usePreview } from '@/lib/previewStore';
import {
    ensureGuestSampleHabits,
    getPreviewHabitDataForDate,
    savePreviewDailyScore,
    togglePreviewTodoDone,
    upsertPreviewHabitEntry,
} from '@/lib/preview/habitDashboardPreview';
import { formatDate, type Category, type TimeOfDay, type HabitStatus } from '@/lib/habitHelpers';
import { computeDailyScoreSnapshot } from '@/lib/habit/computeDailyScores';
import { enrichHabitTemplates } from '@/lib/habit/habitTemplateLinks';
import { syncBacklogCompletion } from '@/lib/habitBacklog';
import { compareByQuadrant } from '@/lib/habit/eisenhower';
import { neon } from '../neonTheme';
import CollapsiblePanel from './CollapsiblePanel';
import OperationSequence from './OperationSequence';
import TodoNowSequence from './TodoNowSequence';
import { compareOperationOrder } from '@/lib/habit/operationOrder';
import { tasksForDay, type FocusTask } from '@/lib/habit/focusScore';

type HabitTemplate = {
    id: string;
    name: string;
    icon: string;
    category: Category;
    categories: Category[];
    time_of_day: TimeOfDay | null;
    is_active: boolean;
    sort_order: number | null;
    is_bad_habit?: boolean;
};

type HabitEntry = {
    id: string;
    habit_template_id: string;
    date: string;
    status: HabitStatus;
    checked_at: string | null;
};

type Priority = {
    id: string;
    text: string;
    category: Category | null;
    completed: boolean;
    date: string;
    completed_at: string | null;
    sort_order: number | null;
    backlog_task_id?: string | null;
    goal_id?: string | null;
    is_important?: boolean | null;
    is_urgent?: boolean | null;
};

type Todo = {
    id: string;
    title: string;
    category: Category | null;
    is_done: boolean;
    date: string;
    completed_at: string | null;
    weekly_item_day_id?: string | null;
    weekly_event_id?: string | null;
    created_at?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    backlog_task_id?: string | null;
    goal_id?: string | null;
    is_important?: boolean | null;
    is_urgent?: boolean | null;
};

type DailyScore = {
    score_overall: number;
    grade: string;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
};

export type DailyScoresForHeader = {
    score_overall: number;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
    score_physical: number;
    score_mental: number;
    score_spiritual: number;
    score_morning: number;
    score_afternoon: number;
    score_evening: number;
    grade: string;
};

const formatCompletedTime = (ts: string | null): string | null => {
    if (!ts) return null;
    const d = new Date(ts);
    const formatted = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    // e.g. "8:30 PM" -> "8:30pm"
    return formatted.toLowerCase().replace(' ', '');
};

const nextDateString = (date: Date): string => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return formatDate(next);
};

export default function HabitDailyEntrySection({
    selectedDate,
    timeframe,
    customStartDate,
    customEndDate,
    userId,
    onScoresChange,
    planClassName,
    aside,
}: {
    selectedDate: Date;
    timeframe: 'daily' | 'weekly' | 'custom';
    customStartDate: Date | null;
    customEndDate: Date | null;
    userId: string | null;
    onScoresChange?: (scores: DailyScoresForHeader) => void;
    planClassName?: string;
    aside?: ReactNode;
}) {
    const [loading, setLoading] = useState(true);
    const [habitTemplates, setHabitTemplates] = useState<HabitTemplate[]>([]);
    const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
    const [priorities, setPriorities] = useState<Priority[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [openBacklog, setOpenBacklog] = useState<FocusTask[]>([]);
    const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);
    const [dailyPlanOpen, setDailyPlanOpen] = useState(true);
    const [habitsOpen, setHabitsOpen] = useState(true);
    const [todosOpen, setTodosOpen] = useState(true);
    const [habitSubsectionsOpen, setHabitSubsectionsOpen] = useState({
        morning: true,
        afternoon: true,
        evening: true,
        bad: true,
    });
    const pathname = usePathname();
    const preview = usePreview();
    const isPreview =
        preview.isPreview ||
        pathname?.startsWith('/guest') === true ||
        pathname?.startsWith('/preview') === true;
    const loadPreviewData = () => {
        ensureGuestSampleHabits(preview);
        const dateStr = formatDate(selectedDate);
        const { templates, entries, priorities, todos, score } = getPreviewHabitDataForDate(preview, dateStr);
        setHabitTemplates(
            templates.map((t) => ({
                id: t.id,
                name: t.name,
                icon: t.icon,
                category: t.category,
                categories: t.categories ?? [t.category],
                time_of_day: t.time_of_day,
                is_active: t.is_active,
                sort_order: t.sort_order,
                is_bad_habit: t.is_bad_habit,
            }))
        );
        setHabitEntries(entries);
        setPriorities(
            priorities.map((p) => ({
                id: p.id,
                text: p.text,
                category: p.category,
                completed: p.completed,
                date: p.date ?? dateStr,
                completed_at: p.completed_at,
                sort_order: p.sort_order ?? null,
                goal_id: p.goal_id,
            }))
        );
        setTodos(
            todos.map((t) => ({
                id: t.id,
                title: t.title,
                category: t.category,
                is_done: t.is_done,
                date: t.date ?? dateStr,
                completed_at: t.completed_at,
                goal_id: t.goal_id,
            }))
        );
        setOpenBacklog([]);
        setDailyScore(
            score
                ? {
                      score_overall: score.score_overall,
                      grade: score.grade,
                      score_habits: score.score_habits,
                      score_priorities: score.score_priorities,
                      score_todos: score.score_todos,
                  }
                : null
        );
        setLoading(false);
    };

    useEffect(() => {
        if (isPreview) {
            loadPreviewData();
            return;
        }
        if (userId) {
            loadData();
            const cleanup = setupRealtime();
            return () => {
                if (cleanup) cleanup();
            };
        }
    }, [selectedDate, userId, isPreview, preview.habit]);

    const loadData = async (silent = false) => {
        if (!userId) return;
        if (!silent) setLoading(true);
        try {
            const dateStr = formatDate(selectedDate);

            // Load habit templates
            const { data: templates } = await supabase
                .from('habit_templates')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('sort_order');

            const enrichedTemplates = await enrichHabitTemplates(
                supabase,
                userId,
                templates || []
            );

            // Load habit entries
            const { data: entries } = await supabase
                .from('habit_daily_entries')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateStr);

            // Load priorities
            const { data: prioritiesData } = await supabase
                .from('habit_daily_priorities')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .order('sort_order');

            // Load todos (including weekly links and optional time)
            const { data: todosData } = await supabase
                .from('habit_daily_todos')
                .select('id, title, category, is_done, date, completed_at, weekly_item_day_id, weekly_event_id, created_at, start_time, end_time, backlog_task_id, goal_id, is_important, is_urgent')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .order('created_at');

            // Load event data for todos linked to weekly events (for sort-by-time and display title with time)
            let eventStartTimes: Record<string, string> = {};
            const eventIds = (todosData || []).map((t) => t.weekly_event_id).filter(Boolean) as string[];
            if (eventIds.length > 0) {
                const { data: eventsData } = await supabase
                    .from('habit_weekly_events')
                    .select('id, start_time')
                    .in('id', eventIds);
                if (eventsData) {
                    eventStartTimes = Object.fromEntries(
                        eventsData.map((e) => [e.id, e.start_time ?? ''])
                    );
                }
            }

            const getTodoSortTime = (t: NonNullable<typeof todosData>[number]) => {
                if (t.weekly_event_id) return eventStartTimes[t.weekly_event_id] ?? '';
                return (t as { start_time?: string }).start_time ?? '';
            };
            const sortedTodos = [...(todosData || [])].sort((a, b) => {
                const quadrantCompare = compareByQuadrant(
                    { is_important: a.is_important ?? null, is_urgent: a.is_urgent ?? null },
                    { is_important: b.is_important ?? null, is_urgent: b.is_urgent ?? null },
                    () => 0
                );
                if (quadrantCompare !== 0) return quadrantCompare;
                const aTime = getTodoSortTime(a);
                const bTime = getTodoSortTime(b);
                if (aTime && bTime) return aTime.localeCompare(bTime);
                if (aTime) return -1;
                if (bTime) return 1;
                return (a.created_at ?? '').localeCompare(b.created_at ?? '');
            });

            const dayStart = new Date(selectedDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            const backlogSelect = 'id, title, due_date, assigned_date, is_important, is_urgent, completed_at';
            const [{ data: openBacklogRows }, { data: doneBacklogRows }] = await Promise.all([
                supabase
                    .from('habit_backlog_tasks')
                    .select(backlogSelect)
                    .eq('user_id', userId)
                    .is('completed_at', null),
                supabase
                    .from('habit_backlog_tasks')
                    .select(backlogSelect)
                    .eq('user_id', userId)
                    .gte('completed_at', dayStart.toISOString())
                    .lt('completed_at', dayEnd.toISOString()),
            ]);

            // Load daily score
            const { data: scoreData } = await supabase
                .from('habit_daily_scores')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .single();

            setHabitTemplates(enrichedTemplates);
            setHabitEntries(entries || []);
            setPriorities(prioritiesData || []);
            setTodos(sortedTodos);
            setOpenBacklog([...(openBacklogRows ?? []), ...(doneBacklogRows ?? [])]);
            if (scoreData) {
                setDailyScore({
                    score_overall: scoreData.score_overall,
                    grade: scoreData.grade,
                    score_habits: scoreData.score_habits,
                    score_priorities: scoreData.score_priorities,
                    score_todos: scoreData.score_todos,
                });
            } else {
                setDailyScore(null);
            }
        } catch (error) {
            console.error('Error loading habit data:', error);
        } finally {
            setLoading(false);
        }
    };

    const setupRealtime = () => {
        if (!userId) return;

        const dateStr = formatDate(selectedDate);

        // Subscribe to habit entries changes
        const habitEntriesChannel = supabase
            .channel(`habit_entries_${userId}_${dateStr}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'habit_daily_entries',
                    filter: `user_id=eq.${userId} AND date=eq.${dateStr}`,
                },
                () => {
                    loadData(true);
                }
            )
            .subscribe();

        // Subscribe to priorities changes
        const prioritiesChannel = supabase
            .channel(`priorities_${userId}_${dateStr}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'habit_daily_priorities',
                    filter: `user_id=eq.${userId} AND date=eq.${dateStr}`,
                },
                () => {
                    loadData(true);
                }
            )
            .subscribe();

        // Subscribe to todos changes
        const todosChannel = supabase
            .channel(`todos_${userId}_${dateStr}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'habit_daily_todos',
                    filter: `user_id=eq.${userId} AND date=eq.${dateStr}`,
                },
                () => {
                    loadData(true);
                }
            )
            .subscribe();

        // Subscribe to daily scores changes
        const scoresChannel = supabase
            .channel(`scores_${userId}_${dateStr}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'habit_daily_scores',
                    filter: `user_id=eq.${userId} AND date=eq.${dateStr}`,
                },
                () => {
                    loadData(true);
                }
            )
            .subscribe();

        return () => {
            habitEntriesChannel.unsubscribe();
            prioritiesChannel.unsubscribe();
            todosChannel.unsubscribe();
            scoresChannel.unsubscribe();
        };
    };

    const handleHabitToggle = async (templateId: string) => {
        const dateStr = formatDate(selectedDate);
        const existingEntry = habitEntries.find(e => e.habit_template_id === templateId);
        const currentStatus = existingEntry?.status || 'missed';
        const nextStatus: HabitStatus = currentStatus === 'missed' ? 'checked' : 'missed';
        const checkedAt = nextStatus === 'checked' ? new Date().toISOString() : null;

        if (isPreview) {
            upsertPreviewHabitEntry(preview, dateStr, templateId, nextStatus, checkedAt);
            loadPreviewData();
            return;
        }

        if (!userId) return;

        try {
            if (existingEntry) {
                await supabase
                    .from('habit_daily_entries')
                    .update({ status: nextStatus, checked_at: checkedAt })
                    .eq('id', existingEntry.id);
            } else {
                await supabase
                    .from('habit_daily_entries')
                    .insert({
                        user_id: userId,
                        date: dateStr,
                        habit_template_id: templateId,
                        status: nextStatus,
                        checked_at: checkedAt,
                    });
            }
            if (nextStatus === 'checked') {
                const habitName = habitTemplates.find((t) => t.id === templateId)?.name ?? 'Habit';
                const { data: existing } = await supabase
                    .from('habit_daily_todos')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('date', dateStr)
                    .eq('title', habitName)
                    .maybeSingle();
                if (existing) {
                    await supabase
                        .from('habit_daily_todos')
                        .update({ is_done: true, completed_at: checkedAt })
                        .eq('id', existing.id);
                } else {
                    await supabase.from('habit_daily_todos').insert({
                        user_id: userId,
                        date: dateStr,
                        title: habitName,
                        is_done: true,
                        completed_at: checkedAt,
                    });
                }
            } else {
                const habitName = habitTemplates.find((t) => t.id === templateId)?.name ?? '';
                if (habitName) {
                    await supabase
                        .from('habit_daily_todos')
                        .update({ is_done: false, completed_at: null })
                        .eq('user_id', userId)
                        .eq('date', dateStr)
                        .eq('title', habitName);
                }
            }
            loadData(true);
        } catch (error) {
            console.error('Error updating habit:', error);
        }
    };

    const handleToggleTodo = async (id: string, isDone: boolean) => {
        if (isPreview) {
            togglePreviewTodoDone(preview, id, !isDone);
            loadPreviewData();
            return;
        }

        if (!userId) return;

        const completedAt = !isDone ? new Date().toISOString() : null;
        const newIsDone = !isDone;
        const todo = todos.find((t) => t.id === id);
        const todoTitle = todo?.title ?? '';
        const hasBacklogLink = !!todo?.backlog_task_id;

        try {
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: newIsDone, completed_at: completedAt })
                .eq('id', id)
                .eq('user_id', userId);
            if (todo?.backlog_task_id) {
                await syncBacklogCompletion(todo.backlog_task_id, newIsDone);
            }

            // Two-way sync: update habit_weekly_item_days when todo is linked
            if (todo?.weekly_item_day_id) {
                await supabase
                    .from('habit_weekly_item_days')
                    .update({ completed: newIsDone, completed_at: completedAt })
                    .eq('id', todo.weekly_item_day_id);

                const { data: itemDay } = await supabase
                    .from('habit_weekly_item_days')
                    .select('weekly_item_id')
                    .eq('id', todo.weekly_item_day_id)
                    .maybeSingle();
                if (itemDay?.weekly_item_id) {
                    await supabase
                        .from('habit_weekly_items')
                        .update({ status: newIsDone ? 'done' : 'not_started' })
                        .eq('id', itemDay.weekly_item_id);
                }
            }

            if (isDone && todoTitle && !hasBacklogLink) {
                const templateWithName = habitTemplates.find((t) => t.name === todoTitle);
                if (templateWithName) {
                    const entry = habitEntries.find((e) => e.habit_template_id === templateWithName.id);
                    if (entry) {
                        await supabase
                            .from('habit_daily_entries')
                            .update({ status: 'missed', checked_at: null })
                            .eq('id', entry.id);
                    }
                }
                const priorityWithText = priorities.find((p) => p.text === todoTitle);
                if (priorityWithText && priorityWithText.completed) {
                    await supabase
                        .from('habit_daily_priorities')
                        .update({ completed: false, completed_at: null })
                        .eq('id', priorityWithText.id);
                }
            }
            loadData(true);
        } catch (error) {
            console.error('Error updating todo:', error);
        }
    };

    const handleToggleFocus = async (taskId: string, isDone: boolean) => {
        if (isPreview || !userId) return;
        const nextDone = !isDone;
        const completedAt = nextDone ? new Date().toISOString() : null;
        try {
            await syncBacklogCompletion(taskId, nextDone);
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: nextDone, completed_at: completedAt })
                .eq('user_id', userId)
                .eq('backlog_task_id', taskId);
            loadData(true);
        } catch (error) {
            console.error('Error updating focus task:', error);
        }
    };

    const habitsWithEntries = habitTemplates.map(template => {
        const entry = habitEntries.find(e => e.habit_template_id === template.id);
        return {
            ...template,
            status: (entry?.status || 'missed') as HabitStatus,
            checked_at: entry?.checked_at ?? null,
        };
    });

    const selectedDay = formatDate(selectedDate);
    const focusTasks = useMemo(() => {
        return tasksForDay(openBacklog, selectedDay).map((task) => ({
            ...task,
            is_important: task.is_important ?? null,
            is_urgent: task.is_urgent ?? null,
            is_done: Boolean(task.completed_at),
        }));
    }, [openBacklog, selectedDay]);

    // Report live-computed scores to dashboard header (fills as user checks off items)
    // Good habits: checked = positive. Bad habits: each checked subtracts 3% from habit score.
    useEffect(() => {
        if (!onScoresChange || timeframe !== 'daily') return;
        const snapshot = computeDailyScoreSnapshot({
            templates: habitTemplates.map((t) => ({
                id: t.id,
                category: t.category,
                categories: t.categories,
                time_of_day: t.time_of_day,
                is_bad_habit: Boolean(t.is_bad_habit),
            })),
            entries: habitEntries.map((e) => ({
                habit_template_id: e.habit_template_id,
                status: e.status,
            })),
            priorities: focusTasks
                .filter((task) => task.is_important)
                .map((task) => ({
                    category: null,
                    completed: task.is_done,
                })),
            todos: focusTasks
                .filter((task) => !task.is_important)
                .map((task) => ({
                    category: null,
                    is_done: task.is_done,
                })),
        });
        onScoresChange({
            score_overall: snapshot.scoreOverall,
            score_habits: snapshot.scoreHabits,
            score_priorities: snapshot.scorePriorities,
            score_todos: snapshot.scoreTodos,
            score_physical: snapshot.scorePhysical,
            score_mental: snapshot.scoreMental,
            score_spiritual: snapshot.scoreSpiritual,
            score_morning: snapshot.scoreMorning,
            score_afternoon: snapshot.scoreAfternoon,
            score_evening: snapshot.scoreEvening,
            grade: snapshot.gradeOverall,
        });
        if (userId && timeframe === 'daily' && !isPreview) {
            const dateStr = formatDate(selectedDate);
            supabase
                .from('habit_daily_scores')
                .upsert({
                    user_id: userId,
                    date: dateStr,
                    score_overall: snapshot.scoreOverall,
                    grade: snapshot.gradeOverall,
                    score_habits: snapshot.scoreHabits,
                    score_priorities: snapshot.scorePriorities,
                    score_todos: snapshot.scoreTodos,
                    score_physical: snapshot.scorePhysical,
                    score_mental: snapshot.scoreMental,
                    score_spiritual: snapshot.scoreSpiritual,
                    score_morning: snapshot.scoreMorning,
                    score_afternoon: snapshot.scoreAfternoon,
                    score_evening: snapshot.scoreEvening,
                }, { onConflict: 'user_id,date' })
                .then(() => {});
        } else if (isPreview && timeframe === 'daily') {
            const dateStr = formatDate(selectedDate);
            const existing = preview.habit.dailyScores[dateStr];
            const unchanged =
                existing &&
                existing.score_overall === snapshot.scoreOverall &&
                existing.grade === snapshot.gradeOverall &&
                existing.score_habits === snapshot.scoreHabits &&
                existing.score_priorities === snapshot.scorePriorities &&
                existing.score_todos === snapshot.scoreTodos;
            if (!unchanged) {
                savePreviewDailyScore(preview, dateStr, snapshot);
            }
        }
    }, [timeframe, onScoresChange, habitTemplates, habitEntries, focusTasks, userId, selectedDate, isPreview, preview]);

    const badHabits = habitsWithEntries
        .filter((h) => h.is_bad_habit)
        .slice()
        .sort(compareOperationOrder);

    if (loading) {
        return (
            <div className={`${neon.panel} p-6`}>
                <div className="py-8 text-center text-slate-400">Loading...</div>
            </div>
        );
    }

    const planColumn = aside ? 'min-w-0 lg:col-span-7 xl:col-span-8' : 'min-w-0 lg:col-span-12';

    return (
        <div className="space-y-6">
            {timeframe === 'daily' ? (
                <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
                    <OperationSequence
                        habits={habitsWithEntries}
                        onToggle={(habitId) => void handleHabitToggle(habitId)}
                        mode="card"
                    />
                    <TodoNowSequence
                        tasks={focusTasks}
                        day={selectedDay}
                        onToggle={(taskId, isDone) => void handleToggleFocus(taskId, isDone)}
                        todoHref={isPreview ? null : '/todo'}
                        mode="card"
                    />
                </div>
            ) : null}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className={`${planColumn} ${planClassName ?? ''}`}>
        <div className={`${neon.panel} min-w-0 overflow-hidden`}>
            {/* Daily Plan - collapsible header */}
            <button
                type="button"
                onClick={() => setDailyPlanOpen((o) => !o)}
                aria-expanded={dailyPlanOpen}
                className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#ff9d00]/5"
            >
                <h2 className="text-2xl font-bold text-[#ffe066]" style={{ textShadow: '0 0 14px rgba(255,200,80,0.25)' }}>
                    Daily Plan
                </h2>
                <svg
                    className={`h-5 w-5 shrink-0 text-[#ff9d00] transition-transform duration-300 ease-out motion-reduce:transition-none ${dailyPlanOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <CollapsiblePanel open={dailyPlanOpen}>
            <div className="min-w-0 space-y-6 overflow-hidden px-4 pb-4">
            {/* Habits Checklist - collapsible (Morning, Afternoon, Evening, Bad Habits) */}
            <div className={`min-w-0 overflow-hidden ${neon.section}`}>
                <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="min-w-0 text-base font-bold text-[#93c5fd]">What to do next</h3>
                        {habitsOpen ? (
                            <Link
                                href="/habit"
                                className="shrink-0 rounded-lg border border-[#ff9d00]/35 bg-[#060a14]/90 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-[#ff9d00]/55 hover:text-white sm:py-1.5 sm:text-sm"
                            >
                                Edit habits
                            </Link>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => setHabitsOpen((o) => !o)}
                        className="shrink-0 rounded p-1.5 text-[#ff9d00] transition-colors hover:bg-[#ff9d00]/10"
                        aria-expanded={habitsOpen}
                        aria-label={habitsOpen ? 'Collapse habits checklist' : 'Expand habits checklist'}
                    >
                        <svg
                            className={`h-5 w-5 transition-transform duration-300 ease-out motion-reduce:transition-none ${habitsOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
                <CollapsiblePanel open={habitsOpen}>
                <div className="px-4 pb-4 space-y-3 min-w-0 overflow-hidden">
                {/* Category key */}
                <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500/80" aria-hidden />
                        <span className="text-slate-400">Physical</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500/80" aria-hidden />
                        <span className="text-slate-400">Mental</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500/80" aria-hidden />
                        <span className="text-slate-400">Spiritual</span>
                    </span>
                </div>
                <OperationSequence
                    habits={habitsWithEntries}
                    onToggle={(habitId) => void handleHabitToggle(habitId)}
                    mode="list"
                />
                {badHabits.length > 0 && (
                    <div className="min-w-0 overflow-hidden rounded-lg border border-red-500/30 bg-red-950/20">
                        <button
                            type="button"
                            onClick={() =>
                                setHabitSubsectionsOpen((p) => ({ ...p, bad: !p.bad }))
                            }
                            className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-red-500/10"
                            aria-expanded={habitSubsectionsOpen.bad}
                            aria-label={`${habitSubsectionsOpen.bad ? 'Collapse' : 'Expand'} bad habits`}
                        >
                            <h4 className="text-sm font-semibold text-red-400">Bad habits</h4>
                            <svg
                                className={`h-5 w-5 shrink-0 text-red-400 transition-transform duration-300 ease-out motion-reduce:transition-none ${habitSubsectionsOpen.bad ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <CollapsiblePanel open={habitSubsectionsOpen.bad}>
                            <div className="min-w-0 space-y-2 px-3 pb-3">
                                {badHabits.map((habit) => (
                                    <label key={habit.id} className="flex min-w-0 cursor-pointer items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={habit.status === 'checked'}
                                            onChange={() => handleHabitToggle(habit.id)}
                                            className="h-5 w-5 shrink-0 rounded border-[#ff9d00]/50 text-[#ff9d00] focus:ring-[#ff9d00]/40"
                                        />
                                        <span className="mr-2 shrink-0 text-lg">{habit.icon}</span>
                                        <span
                                            className={`min-w-0 flex-1 break-words ${habit.status === 'checked' ? 'line-through text-slate-500' : 'text-white'}`}
                                        >
                                            {habit.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </CollapsiblePanel>
                    </div>
                )}
                {habitsWithEntries.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No habits for today</p>
                )}
                </div>
                </CollapsiblePanel>
            </div>

            <div className={`min-w-0 overflow-hidden ${neon.section}`}>
                <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="min-w-0 text-base font-bold text-[#93c5fd]">To-do</h3>
                        {todosOpen && !isPreview ? (
                            <Link
                                href="/todo"
                                className="shrink-0 rounded-lg border border-[#93c5fd]/35 bg-[#060a14]/90 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-[#93c5fd]/55 hover:text-white sm:py-1.5 sm:text-sm"
                            >
                                Edit to-dos
                            </Link>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => setTodosOpen((open) => !open)}
                        className="shrink-0 rounded p-1.5 text-[#93c5fd] transition-colors hover:bg-[#93c5fd]/10"
                        aria-expanded={todosOpen}
                        aria-label={todosOpen ? 'Collapse to-do list' : 'Expand to-do list'}
                    >
                        <svg
                            className={`h-5 w-5 transition-transform duration-300 ease-out motion-reduce:transition-none ${todosOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
                <CollapsiblePanel open={todosOpen}>
                    <div className="min-w-0 space-y-3 overflow-hidden px-4 pb-4">
                        <TodoNowSequence
                            tasks={focusTasks}
                            day={selectedDay}
                            onToggle={(taskId, isDone) => void handleToggleFocus(taskId, isDone)}
                            todoHref={isPreview ? null : '/todo'}
                            mode="list"
                        />
                    </div>
                </CollapsiblePanel>
            </div>

            </div>
            </CollapsiblePanel>
        </div>
            </div>
            {aside ? <div className="min-w-0 lg:col-span-5 xl:col-span-4">{aside}</div> : null}
            </div>
        </div>
    );
}
