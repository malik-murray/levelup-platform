'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate, getGrade, type Category, type TimeOfDay, type HabitStatus } from '@/lib/habitHelpers';

type HabitTemplate = {
    id: string;
    name: string;
    icon: string;
    category: Category;
    time_of_day: TimeOfDay | null;
    is_active: boolean;
    sort_order: number | null;
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

export default function HabitDailyEntrySection({
    selectedDate,
    timeframe,
    customStartDate,
    customEndDate,
    userId,
}: {
    selectedDate: Date;
    timeframe: 'daily' | 'weekly' | 'custom';
    customStartDate: Date | null;
    customEndDate: Date | null;
    userId: string | null;
}) {
    const [loading, setLoading] = useState(true);
    const [habitTemplates, setHabitTemplates] = useState<HabitTemplate[]>([]);
    const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
    const [priorities, setPriorities] = useState<Priority[]>([]);
    const [todos, setTodos] = useState<Todo[]>([]);
    const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);
    const [newPriority, setNewPriority] = useState('');
    const [newTodo, setNewTodo] = useState('');

    useEffect(() => {
        if (userId) {
            loadData();
            const cleanup = setupRealtime();
            return () => {
                if (cleanup) cleanup();
            };
        }
    }, [selectedDate, userId]);

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
            loadData();
        } catch (error) {
            console.error('Error updating habit:', error);
        }
    };

    const handleAddPriority = async () => {
        if (!newPriority.trim() || !userId || priorities.length >= 5) return;

        const dateStr = formatDate(selectedDate);
        try {
            await supabase
                .from('habit_daily_priorities')
                .insert({
                    user_id: userId,
                    date: dateStr,
                    text: newPriority.trim(),
                    completed: false,
                });
            setNewPriority('');
            loadData();
        } catch (error) {
            console.error('Error adding priority:', error);
        }
    };

    const handleTogglePriority = async (id: string, completed: boolean) => {
        if (!userId) return;

        const completedAt = !completed ? new Date().toISOString() : null;
        try {
            await supabase
                .from('habit_daily_priorities')
                .update({ completed: !completed, completed_at: completedAt })
                .eq('id', id);
            loadData();
        } catch (error) {
            console.error('Error updating priority:', error);
        }
    };

    const handleAddTodo = async () => {
        if (!newTodo.trim() || !userId) return;

        const dateStr = formatDate(selectedDate);
        try {
            await supabase
                .from('habit_daily_todos')
                .insert({
                    user_id: userId,
                    date: dateStr,
                    title: newTodo.trim(),
                    is_done: false,
                });
            setNewTodo('');
            loadData();
        } catch (error) {
            console.error('Error adding todo:', error);
        }
    };

    const handleToggleTodo = async (id: string, isDone: boolean) => {
        if (!userId) return;

        const completedAt = !isDone ? new Date().toISOString() : null;
        try {
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: !isDone, completed_at: completedAt })
                .eq('id', id);
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

    const categoryColors = {
        physical: 'border-blue-500/30 bg-blue-950/20',
        mental: 'border-purple-500/30 bg-purple-950/20',
        spiritual: 'border-amber-500/30 bg-amber-950/20',
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
                <div className="text-center py-8 text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/habit" className="hover:underline">
                    <h2 className="text-2xl font-bold">Habit Tracker</h2>
                </Link>
                {dailyScore && (
                    <div className="text-right">
                        <div className="text-3xl font-bold text-amber-400">{dailyScore.score_overall}%</div>
                        <div className="text-lg font-semibold text-amber-300">Grade: {dailyScore.grade}</div>
                    </div>
                )}
            </div>

            {/* Score Breakdown */}
            {dailyScore && (
                <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">Habits</div>
                        <div className="text-xl font-bold text-blue-400">{dailyScore.score_habits}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">Priorities</div>
                        <div className="text-xl font-bold text-purple-400">{dailyScore.score_priorities}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">Todos</div>
                        <div className="text-xl font-bold text-green-400">{dailyScore.score_todos}%</div>
                    </div>
                </div>
            )}

            {/* Top 3 Priorities */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2">
                <h3 className="text-lg font-semibold text-purple-400 mb-3">Top 3 Priorities</h3>
                {priorities.slice(0, 3).map((priority) => (
                    <label key={priority.id} className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={priority.completed}
                            onChange={() => handleTogglePriority(priority.id, priority.completed)}
                            className="h-5 w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                        />
                        <span className={`flex-1 ${priority.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                            {priority.text}
                        </span>
                    </label>
                ))}
                {priorities.length === 0 && (
                    <p className="text-sm text-slate-400">No priorities yet</p>
                )}
                {priorities.length < 3 && (
                    <div className="flex gap-2 mt-3">
                        <input
                            type="text"
                            placeholder="Add priority"
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddPriority()}
                            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                        />
                        <button
                            onClick={handleAddPriority}
                            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
                        >
                            Add
                        </button>
                    </div>
                )}
            </div>

            {/* To-Do List */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2">
                <h3 className="text-lg font-semibold text-green-400 mb-3">To-Do List</h3>
                {todos.map((todo) => (
                    <label key={todo.id} className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={todo.is_done}
                            onChange={() => handleToggleTodo(todo.id, todo.is_done)}
                            className="h-5 w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                        />
                        <span className={`flex-1 ${todo.is_done ? 'line-through text-slate-500' : 'text-white'}`}>
                            {todo.title}
                        </span>
                    </label>
                ))}
                <div className="flex gap-2 mt-3">
                    <input
                        type="text"
                        placeholder="Add todo"
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                        onClick={handleAddTodo}
                        className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
                    >
                        Add
                    </button>
                </div>
            </div>

            {/* Habits Checklist */}
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
                <h3 className="text-lg font-semibold text-blue-400 mb-3">Habits Checklist</h3>
                {(['physical', 'mental', 'spiritual'] as Category[]).map((category) => {
                    const categoryHabits = habitsWithEntries.filter(h => h.category === category);
                    if (categoryHabits.length === 0) return null;

                    return (
                        <div key={category} className={`rounded-lg border p-3 ${categoryColors[category]}`}>
                            <h4 className="text-sm font-semibold mb-2 capitalize">{category}</h4>
                            <div className="space-y-2">
                                {categoryHabits.map((habit) => (
                                    <label key={habit.id} className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={habit.status === 'checked'}
                                            onChange={() => handleHabitToggle(habit.id)}
                                            className="h-5 w-5 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className="text-lg mr-2">{habit.icon}</span>
                                        <span className={`flex-1 ${habit.status === 'checked' ? 'line-through text-slate-500' : 'text-white'}`}>
                                            {habit.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {habitsWithEntries.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No habits for today</p>
                )}
            </div>

            {/* Link to full app */}
            <div className="text-center">
                <Link
                    href="/habit"
                    className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
                >
                    <span>View full Habit Tracker</span>
                    <span>→</span>
                </Link>
            </div>
        </div>
    );
}
