'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, type SyntheticEvent } from 'react';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import WeeklyScoreBars, { type WeeklyScores } from './WeeklyScoreBars';
import { neon } from '@/app/dashboard/neonTheme';

type WeeklyPlan = {
    id: string;
    week_start_date: string;
    focus_intention: string | null;
    notes: string | null;
};

type WeeklyEvent = {
    id: string;
    title: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    sms_notify: boolean;
    todo_id?: string | null;
    is_done?: boolean;
};

type DailyWeekNote = {
    date: string;
    notes: string | null;
    lessons: string | null;
    ideas: string | null;
    feelings: string | null;
    reflection: string | null;
};

export default function WeeklyPlanView() {
    const [loading, setLoading] = useState(true);
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
    const [events, setEvents] = useState<WeeklyEvent[]>([]);
    const [weeklyScores, setWeeklyScores] = useState<WeeklyScores | null>(null);
    const [weeklyDailyNotes, setWeeklyDailyNotes] = useState<DailyWeekNote[]>([]);

    const [focusIntention, setFocusIntention] = useState('');
    const focusIntentionRef = useRef<HTMLTextAreaElement>(null);

    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventStartTime, setNewEventStartTime] = useState('');
    const [newEventEndTime, setNewEventEndTime] = useState('');

    // Selected week (Sunday)
    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };
    const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(new Date()));
    const currentWeekStart = selectedWeekStart;
    const weekStartStr = formatDate(currentWeekStart);

    const handlePrevWeek = () => {
        const prev = new Date(selectedWeekStart);
        prev.setDate(prev.getDate() - 7);
        setSelectedWeekStart(prev);
    };
    const handleNextWeek = () => {
        const next = new Date(selectedWeekStart);
        next.setDate(next.getDate() + 7);
        setSelectedWeekStart(next);
    };
    const handleThisWeek = () => {
        setSelectedWeekStart(getWeekStart(new Date()));
    };

    // Get the 7 days of the week
    const getWeekDays = (): Date[] => {
        const days: Date[] = [];
        const start = new Date(currentWeekStart);
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day);
        }
        return days;
    };

    const weekDays = getWeekDays();

    useEffect(() => {
        loadData();
    }, [weekStartStr]);

    useEffect(() => {
        setNewEventDate(weekStartStr);
    }, [weekStartStr]);

    const syncFocusIntentionHeight = useCallback(() => {
        const el = focusIntentionRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, []);

    useLayoutEffect(() => {
        if (loading) return;
        syncFocusIntentionHeight();
    }, [focusIntention, loading, syncFocusIntentionHeight]);

    const handleFocusDetailsToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
        if (!e.currentTarget.open) return;
        // Content was display:none while closed; measure after layout paints open state.
        requestAnimationFrame(() => {
            requestAnimationFrame(syncFocusIntentionHeight);
        });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load all daily notes-like content for this week
            const weekEndForNotes = new Date(selectedWeekStart);
            weekEndForNotes.setDate(weekEndForNotes.getDate() + 6);
            const weekEndStrForNotes = formatDate(weekEndForNotes);
            const { data: weekNotesData } = await supabase
                .from('habit_daily_content')
                .select('date, notes, lessons, ideas, feelings, reflection')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStrForNotes)
                .order('date', { ascending: true });
            setWeeklyDailyNotes((weekNotesData || []) as DailyWeekNote[]);

            // Load weekly events by date range first (independent of plan so they always persist)
            const weekEndForEvents = new Date(selectedWeekStart);
            weekEndForEvents.setDate(weekEndForEvents.getDate() + 6);
            const weekEndStrForEvents = formatDate(weekEndForEvents);
            const { data: eventsRaw } = await supabase
                .from('habit_weekly_events')
                .select('id, title, date, start_time, end_time, sms_notify, todo_id')
                .eq('user_id', user.id)
                .gte('date', weekStartStr)
                .lte('date', weekEndStrForEvents)
                .order('date')
                .order('start_time');
            const eventIdsWithTodo = (eventsRaw || []).map((e) => (e as { todo_id?: string }).todo_id).filter(Boolean) as string[];
            let todoIsDoneMap: Record<string, boolean> = {};
            if (eventIdsWithTodo.length > 0) {
                const { data: todosData } = await supabase
                    .from('habit_daily_todos')
                    .select('id, is_done')
                    .in('id', eventIdsWithTodo);
                if (todosData) todoIsDoneMap = Object.fromEntries(todosData.map((t) => [t.id, !!t.is_done]));
            }
            const eventsData: WeeklyEvent[] = (eventsRaw || []).map((e: Record<string, unknown>) => {
                const todoId = e.todo_id as string | undefined;
                return {
                    id: e.id,
                    title: e.title,
                    date: e.date,
                    start_time: e.start_time,
                    end_time: e.end_time,
                    sms_notify: e.sms_notify,
                    todo_id: todoId ?? null,
                    is_done: todoId ? todoIsDoneMap[todoId] ?? false : false,
                } as WeeklyEvent;
            });
            setEvents(eventsData);

            // Load or create weekly plan
            let { data: planData, error: planLoadError } = await supabase
                .from('habit_weekly_plans')
                .select('*')
                .eq('user_id', user.id)
                .eq('week_start_date', weekStartStr)
                .maybeSingle();

            if (planLoadError && planLoadError.code !== 'PGRST116') {
                // PGRST116 is "not found" which is expected if no plan exists
                console.error('Error loading weekly plan:', planLoadError);
            }

            if (!planData) {
                // Create new weekly plan
                const { data: newPlan, error: planCreateError } = await supabase
                    .from('habit_weekly_plans')
                    .insert({
                        user_id: user.id,
                        week_start_date: weekStartStr,
                        focus_intention: null,
                        notes: null,
                    })
                    .select()
                    .single();
                
                if (planCreateError) {
                    console.error('Error creating weekly plan:', planCreateError);
                    throw planCreateError;
                }
                
                planData = newPlan;
            }

            if (planData) {
                setWeeklyPlan(planData);
                setFocusIntention(planData.focus_intention || '');

                // Compute weekly scores from habit_daily_scores (events already loaded above)
                const weekEnd = new Date(currentWeekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekEndStr = formatDate(weekEnd);
                const { data: dailyScores } = await supabase
                    .from('habit_daily_scores')
                    .select('date, score_overall, score_habits, score_priorities, score_todos')
                    .eq('user_id', user.id)
                    .gte('date', weekStartStr)
                    .lte('date', weekEndStr);
                const todayStr = formatDate(new Date());
                const scoresUpToToday = (dailyScores || []).filter((d: { date: string }) => d.date <= todayStr);
                if (scoresUpToToday.length > 0) {
                    const avgOverall = Math.round(scoresUpToToday.reduce((s: number, d: { score_overall?: number }) => s + (d.score_overall || 0), 0) / scoresUpToToday.length);
                    const avgHabits = Math.round(scoresUpToToday.reduce((s: number, d: { score_habits?: number }) => s + (d.score_habits || 0), 0) / scoresUpToToday.length);
                    const avgPriorities = Math.round(scoresUpToToday.reduce((s: number, d: { score_priorities?: number }) => s + (d.score_priorities || 0), 0) / scoresUpToToday.length);
                    const avgTodos = Math.round(scoresUpToToday.reduce((s: number, d: { score_todos?: number }) => s + (d.score_todos || 0), 0) / scoresUpToToday.length);
                    const eventsUpToToday = eventsData.filter((e: WeeklyEvent) => e.date <= todayStr);
                    const eventsCompleted = eventsUpToToday.filter((e: WeeklyEvent) => e.is_done).length;
                    const eventsScore = eventsUpToToday.length > 0 ? Math.round((eventsCompleted / eventsUpToToday.length) * 100) : 0;
                    setWeeklyScores({
                        avg_daily_score: avgOverall,
                        weekly_habits_score: avgHabits,
                        weekly_todos_score: avgTodos,
                        weekly_events_score: eventsScore,
                        // Avg Daily is already a composite; keep weights simple and ensure non-future days only.
                        score_overall: Math.round((avgOverall * 0.4 + avgHabits * 0.25 + avgTodos * 0.25 + eventsScore * 0.1)),
                    });
                } else {
                    setWeeklyScores(null);
                }
            }
        } catch (error) {
            console.error('Error loading weekly plan:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveFocus = async () => {
        if (!weeklyPlan) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('habit_weekly_plans')
                .update({
                    focus_intention: focusIntention || null,
                })
                .eq('id', weeklyPlan.id);
        } catch (error) {
            console.error('Error saving focus:', error);
        }
    };

    const formatEventTimeShort = (start: string | null, end: string | null): string => {
        const fmt = (t: string) => {
            const [h, m] = t.slice(0, 5).split(':').map(Number);
            const hour = h % 12 || 12;
            const ampm = h < 12 ? 'am' : 'pm';
            return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`;
        };
        if (start && end) return `${fmt(start)}-${fmt(end)}`;
        if (start) return fmt(start);
        return '';
    };

    const handleAddEvent = async () => {
        if (!newEventTitle.trim() || !weeklyPlan) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const eventDate = newEventDate || weekStartStr;
            const { data: newEvent, error } = await supabase
                .from('habit_weekly_events')
                .insert({
                    user_id: user.id,
                    weekly_plan_id: weeklyPlan.id,
                    title: newEventTitle.trim(),
                    date: eventDate,
                    start_time: newEventStartTime || null,
                    end_time: newEventEndTime || null,
                    sms_notify: false,
                })
                .select()
                .single();
            if (!error && newEvent) {
                setNewEventTitle('');
                setNewEventStartTime('');
                setNewEventEndTime('');
                const timeLabel = formatEventTimeShort(newEvent.start_time, newEvent.end_time);
                const todoTitle = timeLabel ? `(${timeLabel}) ${newEvent.title}` : newEvent.title;
                // Create todo on that day for two-way sync (title includes time for daily list)
                const { data: newTodo } = await supabase
                    .from('habit_daily_todos')
                    .insert({
                        user_id: user.id,
                        date: eventDate,
                        title: todoTitle,
                        is_done: false,
                        weekly_event_id: newEvent.id,
                    })
                    .select('id')
                    .single();
                if (newTodo) {
                    await supabase
                        .from('habit_weekly_events')
                        .update({ todo_id: newTodo.id })
                        .eq('id', newEvent.id);
                }
                const addedEvent = { ...newEvent, todo_id: newTodo?.id ?? null, is_done: false };
                setEvents(prev => {
                    const next = [...prev, addedEvent];
                    setWeeklyScores(s => {
                        if (!s) return s;
                        const todayStr = formatDate(new Date());
                        const eligible = next.filter(e => e.date <= todayStr);
                        const eventsScore = eligible.length > 0 ? Math.round((eligible.filter(e => e.is_done).length / eligible.length) * 100) : 0;
                        return {
                            ...s,
                            weekly_events_score: eventsScore,
                            score_overall: Math.round(s.avg_daily_score * 0.4 + s.weekly_habits_score * 0.25 + s.weekly_todos_score * 0.25 + eventsScore * 0.1),
                        };
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('Error adding event:', error);
        }
    };

    const handleToggleEventCompletion = async (ev: WeeklyEvent, completed: boolean) => {
        if (!ev.todo_id) return;
        try {
            await supabase
                .from('habit_daily_todos')
                .update({ is_done: completed, completed_at: completed ? new Date().toISOString() : null })
                .eq('id', ev.todo_id);
            const nextEvents = events.map(e => e.id === ev.id ? { ...e, is_done: completed } : e);
            setEvents(nextEvents);
            setWeeklyScores(prev => {
                if (!prev) return prev;
                const todayStr = formatDate(new Date());
                const eligible = nextEvents.filter(e => e.date <= todayStr);
                const completedCount = eligible.filter(e => e.is_done).length;
                const eventsScore = eligible.length > 0 ? Math.round((completedCount / eligible.length) * 100) : 0;
                return {
                    ...prev,
                    weekly_events_score: eventsScore,
                    score_overall: Math.round(prev.avg_daily_score * 0.4 + prev.weekly_habits_score * 0.25 + prev.weekly_todos_score * 0.25 + eventsScore * 0.1),
                };
            });
        } catch (err) {
            console.error('Error toggling event completion:', err);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Delete this event?')) return;
        try {
            const ev = events.find(e => e.id === eventId);
            const { data } = await supabase.from('habit_weekly_events').select('todo_id').eq('id', eventId).single();
            if (data?.todo_id) {
                await supabase.from('habit_daily_todos').delete().eq('id', data.todo_id);
            }
            await supabase.from('habit_weekly_events').delete().eq('id', eventId);
            setEvents(prev => {
                const next = prev.filter(e => e.id !== eventId);
                setWeeklyScores(s => {
                    if (!s) return s;
                    const todayStr = formatDate(new Date());
                    const eligible = next.filter(e => e.date <= todayStr);
                    const eventsScore = eligible.length > 0 ? Math.round((eligible.filter(e => e.is_done).length / eligible.length) * 100) : 0;
                    return {
                        ...s,
                        weekly_events_score: eventsScore,
                        score_overall: Math.round(s.avg_daily_score * 0.4 + s.weekly_habits_score * 0.25 + s.weekly_todos_score * 0.25 + eventsScore * 0.1),
                    };
                });
                return next;
            });
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    // Calendar sync placeholder - would need Google Calendar API etc.
    // TODO: Add calendar integration when API is available

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                <p className="text-sm text-slate-400">Loading…</p>
            </div>
        );
    }

    const weekRange = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const notesByDate = new Map(weeklyDailyNotes.map((n) => [n.date, n]));

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
                    <button
                        onClick={handlePrevWeek}
                        className="flex shrink-0 justify-self-start rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 p-2 text-[#ffe066] shadow-[0_0_12px_rgba(255,157,0,0.08)] transition-colors hover:bg-[#0a1020]"
                        aria-label="Previous week"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex min-w-0 flex-col items-center justify-center">
                        <span className="text-sm font-semibold text-white">{weekRange}</span>
                        <button
                            onClick={handleThisWeek}
                            className="mt-1 whitespace-nowrap rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 px-3 py-1 text-xs font-semibold text-[#ffe066] transition-colors hover:bg-[#0a1020]"
                        >
                            This Week
                        </button>
                    </div>
                    <button
                        onClick={handleNextWeek}
                        className="flex shrink-0 justify-self-end rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 p-2 text-[#ffe066] shadow-[0_0_12px_rgba(255,157,0,0.08)] transition-colors hover:bg-[#0a1020]"
                        aria-label="Next week"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Weekly Score */}
            <section className={`${neon.panel} p-4`}>
                <details open className="group">
                    <summary className="mb-3 flex cursor-pointer list-none items-center justify-between text-lg font-bold text-[#ff9d00]/95">
                        <span>Weekly Score</span>
                        <svg className="h-5 w-5 text-[#ff9d00] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3">
                        <WeeklyScoreBars scores={weeklyScores} />
                    </div>
                </details>
            </section>

            {/* This Week's Focus */}
            <section className={`${neon.panel} p-4`}>
                <details open className="group" onToggle={handleFocusDetailsToggle}>
                    <summary className="mb-3 flex cursor-pointer list-none items-center justify-between text-lg font-bold text-[#ff9d00]/95">
                        <span>This Week's Focus</span>
                        <svg className="h-5 w-5 text-[#ff9d00] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="space-y-3 mt-3">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Weekly Intention / Theme</label>
                        <textarea
                            ref={focusIntentionRef}
                            value={focusIntention}
                            onChange={(e) => setFocusIntention(e.target.value)}
                            onBlur={saveFocus}
                            placeholder="What's your focus this week? (one sentence)"
                            rows={1}
                            className="min-h-[3rem] w-full overflow-hidden rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-normal resize-none"
                        />
                    </div>
                    </div>
                </details>
            </section>

            {/* Weekly Events */}
            <section className={`${neon.panel} p-4`}>
                <details open className="group">
                    <summary className="mb-3 flex cursor-pointer list-none items-center justify-between text-lg font-bold text-[#ff9d00]/95">
                        <span>Weekly Events / Meetings / Appointments</span>
                        <svg className="h-5 w-5 text-[#ff9d00] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2 items-end p-3 rounded border border-slate-700 bg-slate-900/50">
                            <input
                                type="text"
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                placeholder="Event title..."
                                className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm flex-1 min-w-[140px]"
                            />
                            <select
                                value={newEventDate}
                                onChange={(e) => setNewEventDate(e.target.value)}
                                className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
                            >
                                {weekDays.map(d => (
                                    <option key={formatDate(d)} value={formatDate(d)}>
                                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="time"
                                value={newEventStartTime}
                                onChange={(e) => setNewEventStartTime(e.target.value)}
                                className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
                            />
                            <input
                                type="time"
                                value={newEventEndTime}
                                onChange={(e) => setNewEventEndTime(e.target.value)}
                                className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
                            />
                            <button
                                onClick={handleAddEvent}
                                className="px-4 py-2 rounded bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400"
                            >
                                Add Event
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {events.map(ev => (
                                <li key={ev.id} className="flex items-center gap-3 p-3 rounded border border-slate-700 bg-slate-900/50 min-h-[44px]">
                                    <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={!!ev.is_done}
                                            onChange={(e) => handleToggleEventCompletion(ev, e.target.checked)}
                                            disabled={!ev.todo_id}
                                            className="h-5 w-5 shrink-0 rounded border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-medium block ${ev.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                                {ev.title}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                {ev.start_time && ` • ${ev.start_time.slice(0, 5)}`}
                                            </span>
                                        </div>
                                    </label>
                                    <button
                                        onClick={() => handleDeleteEvent(ev.id)}
                                        className="text-red-400 hover:text-red-300 text-sm shrink-0"
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                        {events.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-2">No events scheduled.</p>
                        )}
                        <p className="text-xs text-slate-500">
                            Calendar sync: placeholder for future Google Calendar integration.
                        </p>
                    </div>
                </details>
            </section>

            {/* Weekly Notes (aggregated from daily content) */}
            <section className={`${neon.panel} p-4`}>
                <details open className="group">
                    <summary className="mb-3 flex cursor-pointer list-none items-center justify-between text-lg font-bold text-[#ff9d00]/95">
                        <span>Weekly Notes</span>
                        <svg className="h-5 w-5 text-[#ff9d00] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-3 space-y-3">
                        {weekDays.map((day) => {
                            const dateStr = formatDate(day);
                            const entry = notesByDate.get(dateStr);
                            const sections = [
                                { label: 'Notes', value: entry?.notes },
                                { label: 'Lessons', value: entry?.lessons },
                                { label: 'Ideas', value: entry?.ideas },
                                { label: 'Feelings', value: entry?.feelings },
                                { label: 'Reflection', value: entry?.reflection },
                            ].filter((s) => !!s.value && s.value.trim().length > 0);

                            return (
                                <div key={dateStr} className="rounded border border-slate-700 bg-slate-900/50 p-3">
                                    <div className="text-sm font-semibold text-slate-200 mb-2">
                                        {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </div>
                                    {sections.length === 0 ? (
                                        <p className="text-xs text-slate-500">No notes for this day.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {sections.map((s) => (
                                                <div key={`${dateStr}-${s.label}`}>
                                                    <div className="text-xs font-medium text-slate-400">{s.label}</div>
                                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </details>
            </section>
        </div>
    );
}

