'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { WorkoutSession } from '@/lib/fitness/workoutSessions';
import AITrainerAvatar from '@/components/fitness/AITrainerAvatar';

function IconDotsVertical({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
    );
}

function IconPlay({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
        </svg>
    );
}

function placeholderGradient(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 13) % 360;
    const h2 = (h + 48) % 360;
    return `linear-gradient(160deg, hsl(${h} 42% 28%), hsl(${h2} 48% 14%))`;
}

const FILTER_CHIPS: { id: 'all' | 'in_progress' | 'completed'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'in_progress', label: 'Active' },
    { id: 'completed', label: 'Done' },
];

export type FitnessShortsHomeProps = {
    sessions: WorkoutSession[];
    sessionsLoading: boolean;
    /** Banners / notifications rendered above the feed */
    alertSlot?: React.ReactNode;
};

function isNewSession(startedAt: string): boolean {
    const t = new Date(startedAt).getTime();
    return Date.now() - t < 3 * 24 * 60 * 60 * 1000;
}

export default function FitnessShortsHome({ sessions, sessionsLoading, alertSlot }: FitnessShortsHomeProps) {
    const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

    const filtered = useMemo(() => {
        if (filter === 'all') return sessions;
        return sessions.filter((s) => s.status === filter);
    }, [sessions, filter]);

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <div className="-mx-4 border-b border-zinc-800/60 py-2 sm:-mx-6">
                <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide pb-0.5 sm:px-6">
                    {FILTER_CHIPS.map((chip) => {
                        const active = filter === chip.id;
                        return (
                            <button
                                key={chip.id}
                                type="button"
                                onClick={() => setFilter(chip.id)}
                                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                    active
                                        ? 'bg-white text-black'
                                        : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                                }`}
                            >
                                {chip.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mx-auto w-full max-w-lg flex-1 px-3 pt-3">
                {alertSlot}
                <section className="mb-4 rounded-lg border border-amber-500/40 bg-slate-950/80 p-3">
                    <div className="flex items-center gap-3">
                        <AITrainerAvatar size="md" />
                        <div>
                            <p className="text-sm font-semibold text-amber-300">Your AI personal trainer is ready</p>
                            <p className="text-xs text-slate-300">
                                Get movement coaching, focus cues, and motivation during each session.
                            </p>
                        </div>
                    </div>
                </section>

                <Link
                    href="/fitness/workout-generator"
                    className="mb-4 flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
                >
                    <IconPlay className="h-4 w-4" />
                    Start a workout
                </Link>

                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <IconPlay className="h-5 w-5 text-red-500" />
                        <h2 className="text-base font-semibold tracking-tight">Session workouts</h2>
                    </div>
                    <button
                        type="button"
                        className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                        aria-label="Feed options"
                    >
                        <IconDotsVertical className="h-5 w-5" />
                    </button>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                    Each card is a full session. Demo videos (AI trainer + voice cues) appear here when linked to a session.
                </p>

                {sessionsLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="aspect-[9/16] animate-pulse rounded-xl bg-zinc-900"
                            />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-10 text-center">
                        <p className="text-sm font-medium text-zinc-300">No sessions yet</p>
                        <p className="mt-2 text-xs text-zinc-500">
                            Start a plan or generate a workout—your session demos will show up here.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            <Link
                                href="/fitness/plans"
                                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200"
                            >
                                Browse plans
                            </Link>
                            <Link
                                href="/fitness/workout-generator"
                                className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                            >
                                Workout generator
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {filtered.map((session) => (
                            <SessionVideoCard key={session.id} session={session} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SessionVideoCard({ session }: { session: WorkoutSession }) {
    const title = session.name?.trim() || 'Workout session';
    const thumb = session.demo_thumbnail_url?.trim();
    const video = session.demo_video_url?.trim();
    const showNew = session.status === 'in_progress' || isNewSession(session.started_at);
    const badgeLabel = session.status === 'in_progress' ? 'Live' : 'New';

    return (
        <Link href={`/fitness/sessions/${session.id}`} className="group relative block overflow-hidden rounded-xl bg-zinc-900">
            <div className="relative aspect-[9/16] w-full overflow-hidden">
                {video ? (
                    <video
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        src={video}
                        poster={thumb || undefined}
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        onMouseEnter={(e) => {
                            void e.currentTarget.play().catch(() => {});
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                        }}
                    />
                ) : thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                    <div
                        className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
                        style={{ background: placeholderGradient(session.id) }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                {showNew && (
                    <span className="absolute left-2 top-2 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                        {badgeLabel}
                    </span>
                )}
                <span className="pointer-events-none absolute right-1 top-1 rounded-full p-1.5 text-white/90" aria-hidden>
                    <IconDotsVertical className="h-4 w-4" />
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-8">
                    <p className="line-clamp-2 text-left text-xs font-semibold leading-snug text-white drop-shadow-md">{title}</p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300">
                        {session.status === 'completed' ? 'Completed' : session.status === 'in_progress' ? 'In progress' : 'Session'}
                    </p>
                </div>
            </div>
        </Link>
    );
}
