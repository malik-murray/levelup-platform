'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, type ComponentType } from 'react';
import type { WorkoutSession } from '@/lib/fitness/workoutSessions';
import logo from '../../logo.png';

function IconClipboard({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconMail({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconDollar({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconCompass({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconDotsVertical({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
    );
}

function IconHome({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
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

function IconList({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
        </svg>
    );
}

function IconPlusCircle({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
        </svg>
    );
}

function IconLayers({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconActivity({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
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

    const topLinks = [
        { href: '/dashboard', label: 'Dashboard', Icon: IconClipboard },
        { href: '/newsfeed', label: 'Newsfeed', Icon: IconMail },
        { href: '/finance', label: 'Finance', Icon: IconDollar },
    ] as const;

    return (
        <div className="flex min-h-[100dvh] flex-col bg-black text-white pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
            <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-zinc-800/80 bg-black/90 px-3 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-black/75">
                <Link href="/fitness" className="flex min-w-0 items-center gap-2 hover:opacity-90">
                    <div className="relative h-9 w-9 shrink-0">
                        <Image src={logo} alt="" className="object-contain" fill sizes="36px" />
                    </div>
                    <span className="truncate text-lg font-semibold tracking-tight text-white">LevelUpSolutions</span>
                </Link>
                <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="App switcher">
                    {topLinks.map(({ href, label, Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            title={label}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                            <Icon className="h-5 w-5" />
                            <span className="sr-only">{label}</span>
                        </Link>
                    ))}
                </nav>
            </header>

            <div className="sticky top-[57px] z-20 border-b border-zinc-900 bg-black/95 py-2 backdrop-blur-sm">
                <div className="flex gap-2 overflow-x-auto px-3 scrollbar-hide pb-0.5">
                    <Link
                        href="/fitness/exercises"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                        title="Explore exercises"
                    >
                        <IconCompass className="h-4 w-4" />
                        <span className="sr-only">Explore exercises</span>
                    </Link>
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

            <nav
                className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-black/95 px-2 pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-black/85 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
                aria-label="Fitness navigation"
            >
                <div className="mx-auto flex max-w-lg items-end justify-between gap-1">
                    <BottomNavItem href="/fitness" active Icon={IconHome} label="Home" />
                    <BottomNavItem href="/fitness/sessions" Icon={IconList} label="Sessions" />
                    <BottomNavItem href="/fitness/workout-generator" Icon={IconPlusCircle} label="Start" prominent />
                    <BottomNavItem href="/fitness/plans" Icon={IconLayers} label="Plans" />
                    <BottomNavItem href="/fitness/progress" Icon={IconActivity} label="Progress" />
                </div>
            </nav>
        </div>
    );
}

function BottomNavItem({
    href,
    label,
    Icon,
    active,
    prominent,
}: {
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    active?: boolean;
    prominent?: boolean;
}) {
    if (prominent) {
        return (
            <Link
                href={href}
                className="flex flex-1 flex-col items-center gap-1 pb-1 text-zinc-400 hover:text-white"
            >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-600 bg-zinc-900 text-white shadow-lg shadow-black/40">
                    <Icon className="h-7 w-7" />
                </span>
                <span className="text-[10px] font-medium">{label}</span>
            </Link>
        );
    }
    return (
        <Link
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-1 ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
            <Icon className="h-6 w-6" />
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
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
