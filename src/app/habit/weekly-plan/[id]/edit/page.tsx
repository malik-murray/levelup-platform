'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { formatDate, getWeekDates, getWeekStart } from '@/lib/habitHelpers';
import { HabitFlowLoading, HabitFlowShell } from '@/app/habit/components/HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

function formatEventTimeShort(start: string | null, end: string | null): string {
    const fmt = (t: string) => {
        const [h, m] = t.slice(0, 5).split(':').map(Number);
        const hour = h % 12 || 12;
        const ampm = h < 12 ? 'am' : 'pm';
        return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`;
    };
    if (start && end) return `${fmt(start)}-${fmt(end)}`;
    if (start) return fmt(start);
    return '';
}

function toTimeInputValue(value: string | null): string {
    return value ? value.slice(0, 5) : '';
}

export default function EditWeeklyEventPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [todoId, setTodoId] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const weekDays = useMemo(() => {
        if (!date) return [];
        const [y, m, d] = date.split('-').map(Number);
        return getWeekDates(getWeekStart(new Date(y, m - 1, d)));
    }, [date]);

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
                    .from('habit_weekly_events')
                    .select('id, title, date, start_time, end_time, todo_id')
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (cancelled) return;

                if (error || !data) {
                    setNotFound(true);
                    return;
                }

                setTitle(data.title || '');
                setDate(data.date);
                setStartTime(toTimeInputValue(data.start_time));
                setEndTime(toTimeInputValue(data.end_time));
                setTodoId(data.todo_id ?? null);
            } catch (err) {
                console.error('Error loading weekly event:', err);
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
        if (!id || !title.trim() || !date || saving) return;
        setSaving(true);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            const nextStart = startTime || null;
            const nextEnd = endTime || null;
            const trimmedTitle = title.trim();

            const { error } = await supabase
                .from('habit_weekly_events')
                .update({
                    title: trimmedTitle,
                    date,
                    start_time: nextStart,
                    end_time: nextEnd,
                })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) throw error;

            if (todoId) {
                const timeLabel = formatEventTimeShort(nextStart, nextEnd);
                const todoTitle = timeLabel ? `(${timeLabel}) ${trimmedTitle}` : trimmedTitle;
                await supabase
                    .from('habit_daily_todos')
                    .update({
                        title: todoTitle,
                        date,
                    })
                    .eq('id', todoId)
                    .eq('user_id', user.id);
            }

            goBack();
        } catch (err) {
            console.error('Error saving weekly event:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <HabitFlowLoading />;

    if (notFound) {
        return (
            <HabitFlowShell title="Edit event" onBack={goBack}>
                <div className={`${neon.panel} p-6 text-center`}>
                    <p className="text-slate-300">Event not found.</p>
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
        <HabitFlowShell title="Edit event" onBack={goBack}>
            <section className={`${neon.panel} space-y-4 p-4`}>
                <div>
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="event-title">
                        Title
                    </label>
                    <input
                        id="event-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Event title..."
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-xs text-slate-400" htmlFor="event-date">
                        Day
                    </label>
                    <select
                        id="event-date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    >
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="mb-1 block text-xs text-slate-400" htmlFor="event-start">
                            Start time
                        </label>
                        <input
                            id="event-start"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-slate-400" htmlFor="event-end">
                            End time
                        </label>
                        <input
                            id="event-end"
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                        />
                    </div>
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
