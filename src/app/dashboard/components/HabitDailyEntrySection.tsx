'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate, getGrade, calculateItemScore, calculateDailyScore, type Category, type TimeOfDay, type HabitStatus } from '@/lib/habitHelpers';

type HabitTemplate = {
    id: string;
    name: string;
    icon: string;
    category: Category;
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
};

type Todo = {
    id: string;
    title: string;
    category: Category | null;
    is_done: boolean;
    date: string;
    completed_at: string | null;
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
    grade: string;
};

export default function HabitDailyEntrySection({
    selectedDate,
    timeframe,
    customStartDate,
    customEndDate,
    userId,
    onScoresChange,
}: {
    selectedDate: Date;
    timeframe: 'daily' | 'weekly' | 'custom';
    customStartDate: Date | null;
    customEndDate: Date | null;
    userId: string | null;
    onScoresChange?: (scores: DailyScoresForHeader) => void;
}) {
    const [loading, setLoading] = useState(true);
    const [habitTemplates, setHabitTemplates] = useState<HabitTemplate[]>([]);
    const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
    const [priorities, setPriorities] = useState<Priority[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);
    const [draftPriorities, setDraftPriorities] = useState<string[]>([]);
    const [draftTodos, setDraftTodos] = useState<string[]>(['', '', '']);
    const [dailyPlanOpen, setDailyPlanOpen] = useState(true);
    const [prioritiesOpen, setPrioritiesOpen] = useState(true);
    const [todosOpen, setTodosOpen] = useState(true);
    const [habitsOpen, setHabitsOpen] = useState(true);

    useEffect(() => {
        if (userId) {
            loadData();
            const cleanup = setupRealtime();
            return () => {
                if (cleanup) cleanup();
            };
        }
    }, [selectedDate, userId]);

    const sortedPrioritiesForSlots = [...priorities].sort(
        (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    useEffect(() => {
        setDraftPriorities([...sortedPrioritiesForSlots.map((p) => p.text), '']);
    }, [priorities]);

    useEffect(() => {
        setDraftTodos([...todos.map((t) => t.title), '']);
    }, [todos]);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const dateStr = formatDate(selectedDate);

            // Load habit templates
            const { data: templates } = await supabase
                .from('habit_templates')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('sort_order');

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

            // Load todos
            const { data: todosData } = await supabase
                .from('habit_daily_todos')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .order('created_at');

            // Load daily score
            const { data: scoreData } = await supabase
                .from('habit_daily_scores')
                .select('*')
                .eq('user_id', userId)
                .eq('date', dateStr)
                .single();

            setHabitTemplates(templates || []);
            setHabitEntries(entries || []);
            setPriorities(prioritiesData || []);
            setTodos(todosData || []);
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
                    loadData();
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
                    loadData();
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
                    loadData();
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
                    loadData();
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
        if (!userId) return;

        const dateStr = formatDate(selectedDate);
        const existingEntry = habitEntries.find(e => e.habit_template_id === templateId);
        const currentStatus = existingEntry?.status || 'missed';
        const nextStatus: HabitStatus = currentStatus === 'missed' ? 'checked' : 'missed';
        const checkedAt = nextStatus === 'checked' ? new Date().toISOString() : null;

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
            loadData();
        } catch (error) {
            console.error('Error updating habit:', error);
        }
    };

    const handlePrioritySlotBlur = async (slotIndex: number, value: string) => {
        if (!userId) return;
        const dateStr = formatDate(selectedDate);
        const priority = sortedPrioritiesForSlots[slotIndex];
        try {
            if (value.trim()) {
                if (priority) {
                    await supabase
                        .from('habit_daily_priorities')
                        .update({ text: value.trim() })
                        .eq('id', priority.id);
                } else {
                    await supabase.from('habit_daily_priorities').insert({
                        user_id: userId,
                        date: dateStr,
                        text: value.trim(),
                        completed: false,
                        sort_order: slotIndex,
                    });
                }
            } else if (priority) {
                await supabase.from('habit_daily_priorities').delete().eq('id', priority.id);
            }
            loadData();
        } catch (error) {
            console.error('Error saving priority:', error);
        }
    };

    const handleTodoSlotBlur = async (slotIndex: number, value: string) => {
        if (!userId) return;
        const dateStr = formatDate(selectedDate);
        const todo = todos[slotIndex];
        try {
            if (value.trim()) {
                if (todo) {
                    await supabase
                        .from('habit_daily_todos')
                        .update({ title: value.trim() })
                        .eq('id', todo.id);
                } else {
                    await supabase.from('habit_daily_todos').insert({
                        user_id: userId,
                        date: dateStr,
                        title: value.trim(),
                        is_done: false,
                    });
                }
            } else if (todo) {
                await supabase.from('habit_daily_todos').delete().eq('id', todo.id);
            }
            loadData();
        } catch (error) {
            console.error('Error saving todo:', error);
        }
    };

    const handleTogglePriority = async (id: string, completed: boolean) => {
        if (!userId) return;

        const completedAt = !completed ? new Date().toISOString() : null;
        const priorityText = priorities.find((p) => p.id === id)?.text ?? '';

        try {
            await supabase
                .from('habit_daily_priorities')
                .update({ completed: !completed, completed_at: completedAt })
                .eq('id', id);
            const dateStr = formatDate(selectedDate);
            if (!completed && priorityText) {
                const { data: existing } = await supabase
                    .from('habit_daily_todos')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('date', dateStr)
                    .eq('title', priorityText)
                    .maybeSingle();
                if (existing) {
                    await supabase
                        .from('habit_daily_todos')
                        .update({ is_done: true, completed_at: completedAt })
                        .eq('id', existing.id);
                } else {
                    await supabase.from('habit_daily_todos').insert({
                        user_id: userId,
                        date: dateStr,
                        title: priorityText,
                        is_done: true,
                        completed_at: completedAt,
                    });
                }
            } else if (completed && priorityText) {
                await supabase
                    .from('habit_daily_todos')
                    .update({ is_done: false, completed_at: null })
                    .eq('user_id', userId)
                    .eq('date', dateStr)
                    .eq('title', priorityText);
            }
            loadData();
        } catch (error) {
            console.error('Error updating priority:', error);
        }
    };

    const handleToggleTodo = async (id: string, isDone: boolean) => {
        if (!userId) return;

        const dateStr = formatDate(selectedDate);
        const completedAt = !isDone ? new Date().toISOString() : null;
        const todoTitle = todos.find((t) => t.id === id)?.title ?? '';

        try {
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: !isDone, completed_at: completedAt })
                .eq('id', id);
            if (isDone && todoTitle) {
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
            loadData();
        } catch (error) {
            console.error('Error updating todo:', error);
        }
    };

    const habitsWithEntries = habitTemplates.map(template => {
        const entry = habitEntries.find(e => e.habit_template_id === template.id);
        return {
            ...template,
            status: (entry?.status || 'missed') as HabitStatus,
        };
    });

    // Report live-computed scores to dashboard header (fills as user checks off items)
    // Good habits: checked = positive. Bad habits: each checked subtracts 3% from habit score.
    useEffect(() => {
        if (!onScoresChange || timeframe !== 'daily') return;
        const goodTemplates = habitTemplates.filter((t) => !t.is_bad_habit);
        const badTemplates = habitTemplates.filter((t) => t.is_bad_habit);
        const goodStatuses = goodTemplates.map((t) => {
            const entry = habitEntries.find((e) => e.habit_template_id === t.id);
            return { status: (entry?.status ?? 'missed') as HabitStatus };
        });
        const goodHabitsScore =
            goodTemplates.length > 0
                ? calculateItemScore(goodStatuses, goodTemplates.length)
                : 0;
        const checkedBadCount = badTemplates.filter((t) => {
            const entry = habitEntries.find((e) => e.habit_template_id === t.id);
            return entry?.status === 'checked';
        }).length;
        const habitsScore = Math.max(0, goodHabitsScore - checkedBadCount * 3);
        const prioritiesScore = calculateItemScore(
            priorities.map((p) => ({ completed: p.completed })),
            Math.max(1, priorities.length)
        );
        const todosScore = calculateItemScore(
            todos.map((t) => ({ is_done: t.is_done })),
            Math.max(1, todos.length)
        );
        const score_overall = calculateDailyScore(habitsScore, prioritiesScore, todosScore);
        const grade = getGrade(score_overall);
        onScoresChange({
            score_overall,
            score_habits: habitsScore,
            score_priorities: prioritiesScore,
            score_todos: todosScore,
            grade,
        });
        if (userId && timeframe === 'daily') {
            const dateStr = formatDate(selectedDate);
            supabase
                .from('habit_daily_scores')
                .upsert({
                    user_id: userId,
                    date: dateStr,
                    score_overall,
                    grade,
                    score_habits: habitsScore,
                    score_priorities: prioritiesScore,
                    score_todos: todosScore,
                }, { onConflict: 'user_id,date' })
                .then(() => {});
        }
    }, [timeframe, onScoresChange, habitTemplates, habitEntries, priorities, todos, userId, selectedDate]);

    const categoryColors = {
        physical: 'bg-blue-500/30 text-blue-300 border-blue-500/50',
        mental: 'bg-purple-500/30 text-purple-300 border-purple-500/50',
        spiritual: 'bg-amber-500/30 text-amber-300 border-amber-500/50',
    };
    const timeOfDayOrder: TimeOfDay[] = ['morning', 'afternoon', 'evening'];
    const timeOfDayLabels: Record<TimeOfDay, string> = {
        morning: 'Morning',
        afternoon: 'Afternoon',
        evening: 'Evening',
    };
    const goodHabits = habitsWithEntries.filter((h) => !h.is_bad_habit);
    const badHabits = habitsWithEntries.filter((h) => h.is_bad_habit);
    const habitsByTimeOfDay = (time: TimeOfDay) =>
        goodHabits.filter((h) => h.time_of_day === time || (time === 'afternoon' && !h.time_of_day));

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
                <div className="text-center py-8 text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900 min-w-0 overflow-hidden">
            {/* Daily Plan - collapsible header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 min-w-0">
                <button
                    type="button"
                    onClick={() => setDailyPlanOpen((o) => !o)}
                    className="flex-1 flex items-center justify-center gap-2 text-left hover:bg-slate-800/50 -mx-2 -my-1 px-2 py-1 rounded transition-colors min-w-0"
                >
                    <h2 className="text-2xl font-bold text-white">Daily Plan</h2>
                    <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${dailyPlanOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            {dailyPlanOpen && (
            <div className="px-4 pb-4 space-y-6 min-w-0 overflow-hidden">
            {/* Top Priorities - collapsible */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 min-w-0 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setPrioritiesOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                    <h3 className="text-lg font-semibold text-purple-400">Top Priorities</h3>
                    <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${prioritiesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {prioritiesOpen && (
                <div className="p-4 pt-0 space-y-2 min-w-0 overflow-hidden">
                <ol className="list-decimal list-inside space-y-2 min-w-0">
                    {Array.from({ length: sortedPrioritiesForSlots.length + 1 }, (_, slotIndex) => {
                        const priority = sortedPrioritiesForSlots[slotIndex];
                        const isAddRow = slotIndex === sortedPrioritiesForSlots.length;
                        return (
                            <li key={priority?.id ?? `priority-slot-${slotIndex}`} className="flex items-center gap-2 min-w-0">
                                {priority ? (
                                    <input
                                        type="checkbox"
                                        checked={priority.completed}
                                        onChange={() => handleTogglePriority(priority.id, priority.completed)}
                                        className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                                    />
                                ) : (
                                    <span className="w-5 shrink-0" aria-hidden />
                                )}
                                <input
                                    type="text"
                                    value={draftPriorities[slotIndex] ?? ''}
                                    onChange={(e) =>
                                        setDraftPriorities((prev) => {
                                            const next = [...prev];
                                            next[slotIndex] = e.target.value;
                                            return next;
                                        })
                                    }
                                    onBlur={(e) => handlePrioritySlotBlur(slotIndex, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                    placeholder={isAddRow ? 'Add priority' : `Priority ${slotIndex + 1}`}
                                    className={`flex-1 min-w-0 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none ${priority?.completed ? 'line-through text-slate-500' : ''}`}
                                />
                            </li>
                        );
                    })}
                </ol>
                </div>
                )}
            </div>

            {/* To-Do List - collapsible */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 min-w-0 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setTodosOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                    <h3 className="text-lg font-semibold text-green-400">To-Do List</h3>
                    <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${todosOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {todosOpen && (
                <div className="p-4 pt-0 space-y-2 min-w-0 overflow-hidden">
                <ol className="list-decimal list-inside space-y-2 min-w-0">
                    {Array.from({ length: todos.length + 1 }, (_, slotIndex) => {
                        const todo = todos[slotIndex];
                        const isAddRow = slotIndex === todos.length;
                        return (
                            <li key={todo?.id ?? `todo-slot-${slotIndex}`} className="flex items-center gap-2 min-w-0">
                                {todo ? (
                                    <input
                                        type="checkbox"
                                        checked={todo.is_done}
                                        onChange={() => handleToggleTodo(todo.id, todo.is_done)}
                                        className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                                    />
                                ) : (
                                    <span className="w-5 shrink-0" aria-hidden />
                                )}
                                <input
                                    type="text"
                                    value={draftTodos[slotIndex] ?? ''}
                                    onChange={(e) =>
                                        setDraftTodos((prev) => {
                                            const next = [...prev];
                                            next[slotIndex] = e.target.value;
                                            return next;
                                        })
                                    }
                                    onBlur={(e) => handleTodoSlotBlur(slotIndex, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                    placeholder={isAddRow ? 'Add to-do' : `To-do ${slotIndex + 1}`}
                                    className={`flex-1 min-w-0 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none ${todo?.is_done ? 'line-through text-slate-500' : ''}`}
                                />
                            </li>
                        );
                    })}
                </ol>
                </div>
                )}
            </div>

            {/* Habits Checklist - collapsible (Morning, Afternoon, Evening, Bad Habits) */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 min-w-0">
                    <h3 className="text-lg font-semibold text-blue-400 min-w-0">Habits Checklist</h3>
                    <button
                        type="button"
                        onClick={() => setHabitsOpen((o) => !o)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-800 transition-colors shrink-0"
                        aria-label={habitsOpen ? 'Collapse' : 'Expand'}
                    >
                        <svg className={`w-5 h-5 transition-transform ${habitsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
                {habitsOpen && (
                <div className="px-4 pb-4 space-y-3 min-w-0 overflow-hidden">
                {/* Category key + Edit habits on same line */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3 min-w-0">
                    <div className="flex flex-wrap gap-3 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500/80 shrink-0" aria-hidden />
                            <span className="text-slate-400">Physical</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500/80 shrink-0" aria-hidden />
                            <span className="text-slate-400">Mental</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shrink-0" aria-hidden />
                            <span className="text-slate-400">Spiritual</span>
                        </span>
                    </div>
                    <Link
                        href="/habit?tab=habits"
                        className="shrink-0 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        Edit habits
                    </Link>
                </div>
                {timeOfDayOrder.map((time) => {
                    const timeHabits = habitsByTimeOfDay(time);
                    if (timeHabits.length === 0) return null;

                    return (
                        <div key={time} className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 min-w-0 overflow-hidden">
                            <h4 className="text-sm font-semibold mb-2 text-slate-200">{timeOfDayLabels[time]}</h4>
                            <div className="space-y-2 min-w-0">
                                {timeHabits.map((habit) => (
                                    <label key={habit.id} className="flex items-center gap-3 cursor-pointer min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={habit.status === 'checked'}
                                            onChange={() => handleHabitToggle(habit.id)}
                                            className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className="text-lg shrink-0">{habit.icon}</span>
                                        <span className={`flex-1 min-w-0 break-words ${habit.status === 'checked' ? 'line-through text-slate-500' : 'text-white'}`}>
                                            {habit.name}
                                        </span>
                                        <span
                                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize border ${categoryColors[habit.category]}`}
                                            title={habit.category}
                                        >
                                            {habit.category}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {badHabits.length > 0 && (
                    <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 min-w-0 overflow-hidden">
                        <h4 className="text-sm font-semibold mb-2 text-red-400">Bad habits</h4>
                        <div className="space-y-2 min-w-0">
                            {badHabits.map((habit) => (
                                <label key={habit.id} className="flex items-center gap-3 cursor-pointer min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={habit.status === 'checked'}
                                        onChange={() => handleHabitToggle(habit.id)}
                                        className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                                    />
                                    <span className="text-lg mr-2 shrink-0">{habit.icon}</span>
                                    <span className={`flex-1 min-w-0 break-words ${habit.status === 'checked' ? 'line-through text-slate-500' : 'text-white'}`}>
                                        {habit.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
                {habitsWithEntries.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No habits for today</p>
                )}
                </div>
                )}
            </div>

            {/* Link to full app */}
            <div className="text-center">
                <Link
                    href="/habit"
                    className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
                >
                    <span>View full Daily Plan</span>
                    <span>→</span>
                </Link>
            </div>
            </div>
            )}
        </div>
    );
}
