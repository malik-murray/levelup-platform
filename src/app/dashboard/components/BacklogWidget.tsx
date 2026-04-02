'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';

type BacklogTask = {
    id: string;
    title: string;
    priority_rank: number;
    assigned_date: string | null;
    completed_at: string | null;
};

export default function BacklogWidget({ userId }: { userId: string | null }) {
    const [tasks, setTasks] = useState<BacklogTask[]>([]);

    useEffect(() => {
        if (!userId) return;
        const load = async () => {
            const { data } = await supabase
                .from('habit_backlog_tasks')
                .select('id,title,priority_rank,assigned_date,completed_at')
                .eq('user_id', userId)
                .order('priority_rank', { ascending: true })
                .limit(50);
            setTasks(data || []);
        };
        load();
    }, [userId]);

    const today = formatDate(new Date());
    const open = tasks.filter((task) => !task.completed_at);
    const scheduled = open.filter((task) => task.assigned_date && task.assigned_date >= today).length;
    const unscheduled = open.length - scheduled;
    const topThree = [...open].sort((a, b) => a.priority_rank - b.priority_rank).slice(0, 3);

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Backlog</h3>
                <Link href="/habit/backlog" className="text-xs text-amber-300 hover:text-amber-200">Open</Link>
            </div>
            <div className="mb-3 flex flex-wrap gap-1 text-[11px] text-slate-300">
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">Open {open.length}</span>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">Scheduled {scheduled}</span>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">Unscheduled {unscheduled}</span>
            </div>
            <div className="space-y-1">
                {topThree.map((task) => (
                    <p key={task.id} className="truncate text-xs text-slate-300">#{task.priority_rank} {task.title}</p>
                ))}
                {topThree.length === 0 && <p className="text-xs text-slate-500">No open backlog tasks.</p>}
            </div>
        </div>
    );
}
