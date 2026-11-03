'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Job = {
    id: string; status: 'queued' | 'running' | 'completed' | 'failed';
    request: string; output: string | null; error: string | null; created_at: number;
};

const sampleJobs: Job[] = [{
    id: 'local-preview', status: 'completed', request: 'Example: 20-minute bodyweight workout',
    output: 'Sample result — no model was called.\n\nWarm-up · 3 minutes\nEasy walking and gentle shoulder circles.\n\nMain session · 14 minutes\nAlternate comfortable walking, chair sit-to-stands, and wall push-ups. Rest as needed.\n\nCool-down · 3 minutes\nSlow walking and relaxed breathing.',
    error: null, created_at: 1793682000,
}];

export default function CommandCenter({ preview = false }: { preview?: boolean }) {
    const [jobs, setJobs] = useState<Job[]>(preview ? sampleJobs : []);
    const [message, setMessage] = useState('Create a 30-minute beginner workout using bodyweight exercises. Include warm-up, rest, and cool-down.');
    const [error, setError] = useState('');
    const [connected, setConnected] = useState(false);
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(!preview);
    // Retain the idempotency key after a network failure so a retry cannot duplicate a charge.
    const pending = useRef<{ message: string; id: string } | null>(null);
    const refresh = useCallback(async () => {
        if (preview) return;
        try {
            const response = await fetch('/api/levelupos/jobs', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? 'Unable to load runs.');
            setJobs(data.jobs); setConnected(true); setError('');
        } catch (err) {
            setConnected(false); setError(err instanceof Error ? err.message : 'Unable to load runs.');
        } finally { setChecking(false); }
    }, [preview]);
    useEffect(() => {
        if (preview) return;
        void refresh();
        const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
        return () => clearInterval(timer);
    }, [refresh, preview]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (preview) return;
        setSending(true); setError('');
        if (!pending.current || pending.current.message !== message) {
            pending.current = { message, id: crypto.randomUUID() };
        }
        try {
            const response = await fetch('/api/levelupos/jobs', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, request_id: pending.current.id }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? 'Unable to start run.');
            pending.current = null;
            await refresh();
        } catch (err) { setError(err instanceof Error ? err.message : 'Unable to start run.'); }
        finally { setSending(false); }
    }

    const active = jobs.some(job => ['queued', 'running'].includes(job.status));
    return <main className="mx-auto max-w-5xl px-5 py-24">
        {preview && <aside className="mb-6 rounded-xl border border-amber-400 bg-amber-100 p-4 text-sm text-amber-950">Local interface preview · Sample data only. Sign-in and model credentials are needed for real agent runs.</aside>}
        <Link href="/dashboard" className="text-sm text-amber-600 dark:text-amber-300">← Dashboard</Link>
        <header className="mb-8 mt-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Your agent command center</p>
            <h1 className="mt-2 text-4xl font-bold">LevelUpOS</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Delegate a workout. Follow its progress. Come back to a saved plan.</p>
            <p className="mt-4 text-sm" role="status">{preview ? 'Preview mode · live runs disabled' : checking ? 'Checking connection…' : connected ? 'Backend connected' : 'Backend unavailable'}</p>
        </header>
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Agent workflow">
            {[
                ['01 · Manager Agent', 'Turns your request into a focused workout brief.'],
                ['02 · Workout Agent', 'Builds your plan from the brief and your requirements.'],
                ['03 · Run history', 'Keeps the result and reports failures for review.'],
            ].map(([title, description]) => <div key={title} className="rounded-2xl border border-amber-500/40 p-5">
                <h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
            </div>)}
        </section>
        <form onSubmit={submit} className="my-8 rounded-2xl border border-amber-500/40 p-6">
            <label htmlFor="agent-request" className="block text-lg font-semibold">What should your workout include?</label>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Include your available time, equipment, goals, and any limitations you want considered.</p>
            <textarea id="agent-request" required minLength={10} maxLength={2000} rows={4} value={message}
                onChange={event => setMessage(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-400 bg-transparent p-3" />
            <button type="submit" disabled={!connected || sending || active || message.trim().length < 10}
                className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-black disabled:opacity-40">
                {sending ? 'Submitting…' : active ? 'Run in progress' : 'Generate workout'}
            </button>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Each submission uses model credits. Only the details entered here are sent. This workflow generates a plan; recurring schedules and external actions are not enabled.</p>
        </form>
        {error && <div role="alert" className="mb-6 rounded-xl border border-red-400 p-4">{error}</div>}
        <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Recent runs</h2>
            <button disabled={preview} onClick={() => void refresh()} className="rounded-lg border border-amber-500/50 px-3 py-2 text-sm disabled:opacity-40">Refresh</button>
        </div>
        {!jobs.length && <p className="mt-5 text-slate-500">Your saved runs will appear here.</p>}
        <div className="mt-5 space-y-4">{jobs.map(job => <article key={job.id} className="rounded-2xl border border-slate-400/40 p-5">
            <div className="flex flex-wrap justify-between gap-3"><span className="font-semibold capitalize">{job.status}</span>
                <time className="text-sm text-slate-500" dateTime={new Date(job.created_at * 1000).toISOString()}>{new Date(job.created_at * 1000).toLocaleString()}</time>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{job.request}</p>
            {job.output && <div className="mt-5 whitespace-pre-wrap border-t border-slate-400/30 pt-4 text-sm leading-7">{job.output}</div>}
            {job.error && <p className="mt-4 text-red-600 dark:text-red-300">{job.error}</p>}
        </article>)}</div>
    </main>;
}
