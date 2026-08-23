'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { formatDate, getWeekDates } from '@/lib/habitHelpers';
import { HabitFlowLoading, HabitFlowShell } from '@/app/habit/components/HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';
import {
    reorderWeeklyTodos,
    syncWeeklyTodoDayAssignment,
} from '@/lib/habit/weeklyPlanActions';

export default function EditWeeklyTodoPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [originalDate, setOriginalDate] = useState<string | null>(null);
    const [weekStartDate, setWeekStartDate] = useState('');
    const [priority, setPriority] = useState(1);
    const [siblingIds, setSiblingIds] = useState<string[]>([]);
    const [itemDayId, setItemDayId] = useState<string | null>(null);
    const [todoId, setTodoId] = useState<string | null>(null);

    const weekDays = useMemo(() => {
        if (!weekStartDate) return [];
        const [y, m, d] = weekStartDate.split('-').map(Number);
        return getWeekDates(new Date(y, m - 1, d));
    }, [weekStartDate]);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            setNotFound(true);
            return;
        }

        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }

                const { data, error } = await supabase
                    .from('habit_weekly_items')
                    .select(`
                        id,
                        title,
                        sort_order,
                        weekly_plan_id,
                        habit_weekly_plans!inner (
                            week_start_date
                        ),
                        habit_weekly_item_days (
                            id,
                            date,
                            todo_id
                        )
                    `)
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (cancelled) return;

                if (error || !data) {
                    setNotFound(true);
                    return;
                }

                const plan = data.habit_weekly_plans as unknown as { week_start_date: string };
                const days = (data.habit_weekly_item_days || []) as Array<{
                    id: string;
                    date: string;
                    todo_id: string | null;
                }>;
                const primaryDay = days[0] ?? null;

                const { data: siblings } = await supabase
                    .from('habit_weekly_items')
                    .select('id, sort_order')
                    .eq('weekly_plan_id', data.weekly_plan_id)
                    .eq('user_id', user.id)
                    .or('item_type.eq.todo,item_type.is.null')
                    .order('sort_order');

                const orderedIds = (siblings || []).map((s) => s.id);
                const currentIndex = orderedIds.indexOf(data.id);

                setTitle(data.title || '');
                setWeekStartDate(plan.week_start_date);
                setDate(primaryDay?.date ?? '');
                setOriginalDate(primaryDay?.date ?? null);
                setItemDayId(primaryDay?.id ?? null);
                setTodoId(primaryDay?.todo_id ?? null);
                setSiblingIds(orderedIds);
                setPriority(currentIndex >= 0 ? currentIndex + 1 : 1);
            } catch (err) {
                console.error('Error loading weekly todo:', err);
                if (!cancelled) setNotFound(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [id, router]);

    const goBack = () => router.push('/habit/weekly-plan');

    const handleSave = async () => {
        if (!id || !title.trim() || saving) return;
        setSaving(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const trimmedTitle = title.trim();
            const assignedDate = date || null;

            const { error } = await supabase
                .from('habit_weekly_items')
                .update({ title: trimmedTitle })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            if (assignedDate === originalDate && todoId) {
                await supabase
                    .from('habit_daily_todos')
                    .update({ title: trimmedTitle })
                    .eq('id', todoId)
                    .eq('user_id', user.id);
            } else {
                await syncWeeklyTodoDayAssignment(
                    user.id,
                    id,
                    trimmedTitle,
                    assignedDate,
                    itemDayId,
                    todoId
                );
            }

            const currentIndex = siblingIds.indexOf(id);
            const targetIndex = Math.max(0, Math.min(siblingIds.length - 1, priority - 1));
            if (currentIndex !== -1 && currentIndex !== targetIndex) {
                const nextIds = [...siblingIds];
                nextIds.splice(currentIndex, 1);
                nextIds.splice(targetIndex, 0, id);
                await reorderWeeklyTodos(nextIds);
            }

            goBack();
        } catch (err) {
            console.error('Error saving weekly todo:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <HabitFlowLoading />;

    if (notFound) {
        return (
            <HabitFlowShell title="Edit to-do" onBack={goBack}>
                <div className={`${neon.panel} p-6 text-center`}>
                    <p className="text-slate-300">To-do not found.</p>
                    <button
                        type="button"
                        onClick={goBack}
                        className="mt-4 rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                    >
                        Back to weekly plan
                    </button>
                </div>
            </HabitFlowShell>
        );
    }

    return (
        <HabitFlowShell title="Edit to-do" onBack={goBack}>
            <section className={`${neon.panel} space-y-4 p-4`}>
                <div>
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="todo-title">
                        Title
                    </label>
                    <input
                        id="todo-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="To-do title..."
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="todo-priority">
                        Priority
                    </label>
                    <select
                        id="todo-priority"
                        value={priority}
                        onChange={(e) => setPriority(Number(e.target.value))}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    >
                        {siblingIds.map((_, index) => (
                            <option key={index + 1} value={index + 1}>
                                {index + 1}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="todo-date">
                        Day
                    </label>
                    <select
                        id="todo-date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    >
                        <option value="">No day</option>
                        {weekDays.map((d) => (
                            <option key={formatDate(d)} value={formatDate(d)}>
                                {d.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                        Assign a day to sync with your daily to-do list.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !title.trim()}
                        className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={goBack}
                        className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                        Cancel
                    </button>
                </div>
            </section>
        </HabitFlowShell>
    );
}
