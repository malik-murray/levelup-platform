'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import { ensureDefaultBacklogCategories, getUncategorizedCategoryId, importMasterBacklogTemplate } from '@/lib/habitBacklog';

type BacklogCategory = { id: string; name: string };
type BacklogTask = {
    id: string;
    title: string;
    category_id: string | null;
    priority_rank: number;
    assigned_date: string | null;
    daily_item_type: 'priority' | 'todo' | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

type FilterMode = 'open' | 'scheduled' | 'unscheduled' | 'completed';

export default function HabitBacklogPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<BacklogTask[]>([]);
    const [categories, setCategories] = useState<BacklogCategory[]>([]);
    const [mode, setMode] = useState<FilterMode>('open');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [newTitle, setNewTitle] = useState('');
    const [newRank, setNewRank] = useState('10');
    const [newCategoryId, setNewCategoryId] = useState<string>('none');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'rank' | 'date' | 'newest'>('default');
    const [importingTemplate, setImportingTemplate] = useState(false);

    const today = formatDate(new Date());

    const loadData = async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
            window.location.href = '/login';
            return;
        }
        setUserId(auth.user.id);
        await ensureDefaultBacklogCategories(auth.user.id);

        const fetchData = async () => {
            const [{ data: categoriesData }, { data: tasksData }] = await Promise.all([
                supabase.from('habit_backlog_categories').select('id,name').eq('user_id', auth.user.id).order('name'),
                supabase
                    .from('habit_backlog_tasks')
                    .select('id,title,category_id,priority_rank,assigned_date,daily_item_type,completed_at,created_at,updated_at')
                    .eq('user_id', auth.user.id),
            ]);
            setCategories(categoriesData || []);
            setTasks(tasksData || []);
            return tasksData || [];
        };

        await fetchData();

        const importKey = `habitBacklogImportedMasterTemplate_${auth.user.id}`;
        const alreadyImported = typeof window !== 'undefined' ? localStorage.getItem(importKey) : 'true';
        if (!alreadyImported || alreadyImported === 'false') {
            // Insert the template for this user (deduped by task title).
            // We only do this once per user per browser to keep it predictable.
            await importMasterBacklogTemplate(auth.user.id);
            await fetchData();
            if (typeof window !== 'undefined') localStorage.setItem(importKey, 'true');
        }
        setLoading(false);
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadData();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    const categoryNameById = useMemo(
        () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
        [categories]
    );

    const openTasks = tasks.filter((task) => !task.completed_at);
    const scheduledCount = openTasks.filter((task) => task.assigned_date && task.assigned_date >= today).length;
    const unscheduledCount = openTasks.length - scheduledCount;

    const priorityBand = (task: BacklogTask) => {
        const ranks = openTasks.map((t) => t.priority_rank).sort((a, b) => a - b);
        if (ranks.length === 0) return 'bg-green-500/20 text-green-300';
        const low = ranks[Math.floor(ranks.length / 3)] ?? ranks[0];
        const mid = ranks[Math.floor((ranks.length * 2) / 3)] ?? ranks[ranks.length - 1];
        if (task.priority_rank <= low) return 'bg-red-500/20 text-red-300 border-red-500/40';
        if (task.priority_rank <= mid) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        return 'bg-green-500/20 text-green-300 border-green-500/40';
    };

    const filtered = useMemo(() => {
        let rows = tasks.filter((task) => {
            const effectiveAssigned = !task.completed_at && task.assigned_date && task.assigned_date < today ? null : task.assigned_date;
            if (mode === 'completed') return !!task.completed_at;
            if (mode === 'scheduled') return !task.completed_at && !!effectiveAssigned;
            if (mode === 'unscheduled') return !task.completed_at && !effectiveAssigned;
            return !task.completed_at;
        });

        rows = rows.filter((task) => task.title.toLowerCase().includes(search.toLowerCase()));
        if (categoryFilter !== 'all') {
            rows = rows.filter((task) => (task.category_id ?? 'none') === categoryFilter);
        }

        return [...rows].sort((a, b) => {
            const aAssigned = !a.completed_at && a.assigned_date && a.assigned_date < today ? null : a.assigned_date;
            const bAssigned = !b.completed_at && b.assigned_date && b.assigned_date < today ? null : b.assigned_date;
            if (sortBy === 'rank') return a.priority_rank - b.priority_rank;
            if (sortBy === 'date') return (aAssigned ?? '9999-12-31').localeCompare(bAssigned ?? '9999-12-31');
            if (sortBy === 'newest') return b.created_at.localeCompare(a.created_at);
            const aCompleted = a.completed_at ? 1 : 0;
            const bCompleted = b.completed_at ? 1 : 0;
            return (
                aCompleted - bCompleted ||
                a.priority_rank - b.priority_rank ||
                (aAssigned ?? '9999-12-31').localeCompare(bAssigned ?? '9999-12-31') ||
                b.created_at.localeCompare(a.created_at)
            );
        });
    }, [tasks, mode, search, categoryFilter, sortBy, today]);

    const syncDailyRows = async (task: BacklogTask, next: Partial<BacklogTask>) => {
        if (!userId) return;
        const nextDate = next.assigned_date === undefined ? task.assigned_date : next.assigned_date;
        const nextType = (next.daily_item_type === undefined ? task.daily_item_type : next.daily_item_type) as 'priority' | 'todo' | null;
        const nextTitle = next.title ?? task.title;
        const nextCompletedAt = next.completed_at === undefined ? task.completed_at : next.completed_at;
        const isCompleted = nextCompletedAt !== null;
        const nextPriorityRank = next.priority_rank === undefined ? task.priority_rank : next.priority_rank;

        // Only delete/move other-date daily placements when the active schedule fields change.
        // This preserves historical daily rows when users edit title/category/rank on a scheduled task.
        const scheduleFieldsChanged = next.assigned_date !== undefined || next.daily_item_type !== undefined;
        const typeChanged = next.daily_item_type !== undefined;

        await supabase
            .from('habit_daily_priorities')
            .update({
                text: nextTitle,
                completed: isCompleted,
                completed_at: nextCompletedAt,
                sort_order: nextPriorityRank,
            })
            .eq('user_id', userId)
            .eq('backlog_task_id', task.id);
        await supabase
            .from('habit_daily_todos')
            .update({ title: nextTitle, is_done: isCompleted, completed_at: nextCompletedAt })
            .eq('user_id', userId)
            .eq('backlog_task_id', task.id);

        if (!nextDate || !nextType) {
            // If a task is unscheduled, remove open linked daily rows so it leaves current daily lists.
            await supabase
                .from('habit_daily_priorities')
                .delete()
                .eq('user_id', userId)
                .eq('backlog_task_id', task.id)
                .eq('completed', false);
            await supabase
                .from('habit_daily_todos')
                .delete()
                .eq('user_id', userId)
                .eq('backlog_task_id', task.id)
                .eq('is_done', false);
            return;
        }

        if (scheduleFieldsChanged) {
            // Preserve completed historical daily rows; only move/remove the open placement.
            await supabase
                .from('habit_daily_priorities')
                .delete()
                .eq('user_id', userId)
                .eq('backlog_task_id', task.id)
                .neq('date', nextDate)
                .eq('completed', false);
            await supabase
                .from('habit_daily_todos')
                .delete()
                .eq('user_id', userId)
                .eq('backlog_task_id', task.id)
                .neq('date', nextDate)
                .eq('is_done', false);

            // Type switching: ensure both tables can't hold an open row for the same active day.
            if (typeChanged) {
                if (nextType === 'priority') {
                    await supabase
                        .from('habit_daily_todos')
                        .delete()
                        .eq('user_id', userId)
                        .eq('date', nextDate)
                        .eq('backlog_task_id', task.id)
                        .eq('is_done', false);
                } else {
                    await supabase
                        .from('habit_daily_priorities')
                        .delete()
                        .eq('user_id', userId)
                        .eq('date', nextDate)
                        .eq('backlog_task_id', task.id)
                        .eq('completed', false);
                }
            }
        }

        if (nextType === 'priority') {
            // Always ensure no open todo exists for the same active day when switching into "priority" mode.
            await supabase
                .from('habit_daily_todos')
                .delete()
                .eq('user_id', userId)
                .eq('date', nextDate)
                .eq('backlog_task_id', task.id)
                .eq('is_done', false);
            const { data: existing } = await supabase
                .from('habit_daily_priorities')
                .select('id')
                .eq('user_id', userId)
                .eq('date', nextDate)
                .eq('backlog_task_id', task.id)
                .maybeSingle();
            if (!existing) {
                await supabase.from('habit_daily_priorities').insert({
                    user_id: userId,
                    date: nextDate,
                    text: nextTitle,
                    completed: isCompleted,
                    completed_at: nextCompletedAt,
                    backlog_task_id: task.id,
                    sort_order: nextPriorityRank,
                });
            }
        } else {
            // Always ensure no open priority exists for the same active day when switching into "todo" mode.
            await supabase
                .from('habit_daily_priorities')
                .delete()
                .eq('user_id', userId)
                .eq('date', nextDate)
                .eq('backlog_task_id', task.id)
                .eq('completed', false);
            const { data: existing } = await supabase
                .from('habit_daily_todos')
                .select('id')
                .eq('user_id', userId)
                .eq('date', nextDate)
                .eq('backlog_task_id', task.id)
                .maybeSingle();
            if (!existing) {
                await supabase.from('habit_daily_todos').insert({
                    user_id: userId,
                    date: nextDate,
                    title: nextTitle,
                    is_done: isCompleted,
                    completed_at: nextCompletedAt,
                    backlog_task_id: task.id,
                });
            }
        }
    };

    const createTask = async () => {
        if (!userId || !newTitle.trim()) return;
        await supabase.from('habit_backlog_tasks').insert({
            user_id: userId,
            title: newTitle.trim(),
            category_id: newCategoryId === 'none' ? null : newCategoryId,
            priority_rank: Math.max(1, parseInt(newRank || '9999', 10) || 9999),
        });
        setNewTitle('');
        await loadData();
    };

    const handleImportTemplate = async () => {
        if (!userId) return;
        setImportingTemplate(true);
        try {
            const res = await importMasterBacklogTemplate(userId);
            // Keep UI consistent after inserts
            await loadData();
            window.alert(`Imported backlog template. Inserted: ${res.inserted}`);
        } catch (e) {
            console.error(e);
            window.alert('Failed to import backlog template. Check console for details.');
        } finally {
            setImportingTemplate(false);
        }
    };

    const toggleComplete = async (task: BacklogTask) => {
        if (!userId) return;
        const completedAt = task.completed_at ? null : new Date().toISOString();
        await supabase.from('habit_backlog_tasks').update({ completed_at: completedAt }).eq('id', task.id).eq('user_id', userId);
        await syncDailyRows(task, { completed_at: completedAt });
        await loadData();
    };

    const updateTask = async (task: BacklogTask, patch: Partial<BacklogTask>) => {
        if (!userId) return;
        await supabase.from('habit_backlog_tasks').update(patch).eq('id', task.id).eq('user_id', userId);
        await syncDailyRows(task, patch);
        await loadData();
    };

    const addCategory = async () => {
        if (!userId || !newCategoryName.trim()) return;
        await supabase.from('habit_backlog_categories').insert({ user_id: userId, name: newCategoryName.trim() });
        setNewCategoryName('');
        await loadData();
    };

    const renameCategory = async (category: BacklogCategory) => {
        const nextName = window.prompt('Rename category', category.name)?.trim();
        if (!nextName || !userId) return;
        await supabase.from('habit_backlog_categories').update({ name: nextName }).eq('id', category.id).eq('user_id', userId);
        await loadData();
    };

    const deleteCategory = async (category: BacklogCategory) => {
        if (!userId) return;
        const uncategorizedId = await getUncategorizedCategoryId(userId);
        const reassignmentName = window.prompt('Reassign tasks to category name (leave blank for Uncategorized)', '');
        let targetCategoryId = uncategorizedId;
        if (reassignmentName?.trim()) {
            const existing = categories.find((c) => c.name.toLowerCase() === reassignmentName.trim().toLowerCase());
            targetCategoryId = existing?.id ?? uncategorizedId;
        }
        await supabase.from('habit_backlog_tasks').update({ category_id: targetCategoryId }).eq('user_id', userId).eq('category_id', category.id);
        await supabase.from('habit_backlog_categories').delete().eq('id', category.id).eq('user_id', userId);
        await loadData();
    };

    if (loading) {
        return <main className="min-h-screen bg-black p-6 text-slate-300">Loading backlog...</main>;
    }

    return (
        <main className="min-h-screen bg-black p-4 text-white sm:p-6">
            <div className="mx-auto max-w-5xl space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h1 className="text-2xl font-bold">Master Backlog</h1>
                        <Link href="/dashboard" className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Back to Dashboard</Link>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1">Open: {openTasks.length}</span>
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1">Scheduled: {scheduledCount}</span>
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1">Unscheduled: {unscheduledCount}</span>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="grid gap-2 sm:grid-cols-4">
                        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Add backlog task..." className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                        <input value={newRank} onChange={(e) => setNewRank(e.target.value)} placeholder="Priority rank" className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                        <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                            <option value="none">Uncategorized</option>
                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                        <button onClick={createTask} className="rounded-md bg-amber-400 px-3 py-2 text-sm font-medium text-black hover:bg-amber-300">Add task</button>
                    </div>
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={handleImportTemplate}
                            disabled={importingTemplate}
                            className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                        >
                            {importingTemplate ? 'Importing...' : 'Import Master Backlog Tasks'}
                        </button>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 flex flex-wrap gap-2">
                        {(['open', 'scheduled', 'unscheduled', 'completed'] as FilterMode[]).map((item) => (
                            <button key={item} onClick={() => setMode(item)} className={`rounded-full border px-3 py-1 text-xs ${mode === item ? 'border-amber-500/50 bg-amber-500/20 text-amber-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>{item}</button>
                        ))}
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs" />
                        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs">
                            <option value="all">All categories</option>
                            <option value="none">Uncategorized</option>
                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs">
                            <option value="default">Default sort</option>
                            <option value="rank">Priority rank</option>
                            <option value="date">Assigned date</option>
                            <option value="newest">Newest</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        {filtered.map((task) => {
                            const effectiveAssigned = !task.completed_at && task.assigned_date && task.assigned_date < today ? null : task.assigned_date;
                            return (
                                <div key={task.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button onClick={() => toggleComplete(task)} className="h-5 w-5 rounded border border-slate-600 text-xs">{task.completed_at ? '✓' : ''}</button>
                                        <input
                                            value={task.title}
                                            onChange={(e) => setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, title: e.target.value } : row)))}
                                            onBlur={(e) => updateTask(task, { title: e.target.value.trim() || task.title })}
                                            className={`min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm ${task.completed_at ? 'line-through text-slate-500' : 'text-white'}`}
                                        />
                                        <span className={`rounded border px-2 py-1 text-xs ${priorityBand(task)}`}>P{task.priority_rank}</span>
                                        <input
                                            type="number"
                                            value={task.priority_rank}
                                            onChange={(e) => setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, priority_rank: Math.max(1, Number(e.target.value) || row.priority_rank) } : row)))}
                                            onBlur={(e) => updateTask(task, { priority_rank: Math.max(1, Number(e.target.value) || task.priority_rank) })}
                                            className="w-20 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                                        />
                                        <select
                                            value={task.category_id ?? 'none'}
                                            onChange={(e) => updateTask(task, { category_id: e.target.value === 'none' ? null : e.target.value })}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                                        >
                                            <option value="none">Uncategorized</option>
                                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                        </select>
                                        <input
                                            type="date"
                                            value={effectiveAssigned ?? ''}
                                            onChange={(e) => updateTask(task, { assigned_date: e.target.value || null, daily_item_type: e.target.value ? (task.daily_item_type ?? 'todo') : null })}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                                        />
                                        <select
                                            value={task.daily_item_type ?? 'todo'}
                                            onChange={(e) => updateTask(task, { daily_item_type: e.target.value as 'priority' | 'todo' })}
                                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                                            disabled={!effectiveAssigned}
                                        >
                                            <option value="priority">Priority</option>
                                            <option value="todo">To-Do</option>
                                        </select>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                        {task.category_id ? categoryNameById[task.category_id] : 'Uncategorized'}
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No tasks in this filter.</p>}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <h2 className="mb-2 text-sm font-semibold text-slate-300">Categories</h2>
                    <div className="mb-2 flex gap-2">
                        <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                        <button onClick={addCategory} className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                            <div key={category.id} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs">
                                <span>{category.name}</span>
                                <button onClick={() => renameCategory(category)} className="text-slate-400 hover:text-white">Edit</button>
                                <button onClick={() => deleteCategory(category)} className="text-red-300 hover:text-red-200">Delete</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
