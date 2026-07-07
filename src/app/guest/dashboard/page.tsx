'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import HabitDailyEntrySection from '@/app/dashboard/components/HabitDailyEntrySection';
import DashboardNotesSection from '@/app/dashboard/components/DashboardNotesSection';
import DashboardScoreBars, { type DashboardScores } from '@/app/dashboard/components/DashboardScoreBars';
import CollapsiblePanel from '@/app/dashboard/components/CollapsiblePanel';
import LockedAppPreview from '@/components/access/LockedAppPreview';
import { useGuestSidebar } from '../GuestShellContext';
import { neon } from '@/app/dashboard/neonTheme';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

function DailyScoreGauge({ percent, grade }: { percent: number | null; grade: string | undefined }) {
    const gaugeGradId = useId().replace(/:/g, '');
    const pct = percent === null ? 0 : Math.min(100, Math.max(0, percent));
    const vb = 100;
    const cx = vb / 2;
    const cy = vb / 2;
    const r = 38;
    const stroke = 7;
    const c = 2 * Math.PI * r;
    const dashOffset = c * (1 - pct / 100);

    return (
        <div className="relative mx-auto aspect-square w-[min(100%,9.5rem)] shrink-0 sm:w-40" role="group">
            <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${vb} ${vb}`} aria-hidden>
                <defs>
                    <linearGradient id={gaugeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ff5a00" />
                        <stop offset="55%" stopColor="#ff9d00" />
                        <stop offset="100%" stopColor="#ffea8a" />
                    </linearGradient>
                </defs>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,157,0,0.2)" strokeWidth={stroke} />
                <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={`url(#${gaugeGradId})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={dashOffset}
                    className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
                <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.18em] text-[#ff9d00]/95 sm:text-[11px]">
                    {grade ? `Grade ${grade}` : 'Daily score'}
                </p>
                <p
                    className="text-xl font-extrabold tabular-nums leading-none text-white sm:text-2xl"
                    style={{ textShadow: '0 0 16px rgba(255,157,0,0.35)' }}
                >
                    {percent === null ? '—' : `${Math.round(percent)}%`}
                </p>
            </div>
        </div>
    );
}

export default function GuestDashboardPage() {
    const openSidebar = useGuestSidebar();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [headerScores, setHeaderScores] = useState<DashboardScores | null>(null);
    const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
    const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

    useEffect(() => {
        const timer = window.setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const dateLine = selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const overall = headerScores ? Math.round(headerScores.score_overall) : null;
    const activeDayPart = currentHour < 12 ? 'morning' : currentHour >= 18 ? 'evening' : 'afternoon';
    const morningFocusOn = activeDayPart === 'morning';
    const eveningFocusOn = activeDayPart === 'evening';

    return (
        <div className={`${outfit.className} ${neon.pageBg} relative flex min-w-0 flex-1 flex-col overflow-x-hidden`}>
            <div className="pointer-events-none absolute inset-0 hidden dark:block" aria-hidden>
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(to bottom, #050816 0%, #010205 42%, #010205 100%), radial-gradient(ellipse 120% 80% at 50% -8%, rgba(255,120,40,0.2) 0%, transparent 55%)',
                    }}
                />
            </div>

            <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                <header className="min-w-0 px-4 pb-2 pt-5 sm:px-6">
                    <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 lg:max-w-6xl">
                        <button
                            type="button"
                            onClick={openSidebar}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066]"
                            aria-label="Open menu"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="relative h-16 w-36 sm:h-[4.5rem] sm:w-44">
                            <Image src={LOGO_SRC} alt="Level Up Solutions" fill unoptimized className="object-contain" sizes="176px" priority />
                        </div>
                        <div className="h-11 w-11 shrink-0" aria-hidden />
                    </div>

                    <p
                        className="mx-auto mt-3 text-center text-lg font-bold tracking-tight text-[#ffe066] sm:text-xl"
                        style={{ textShadow: '0 0 18px rgba(255,200,80,0.35)' }}
                    >
                        Welcome, Guest!
                    </p>
                    <p className="mx-auto -mt-1 text-center text-xs uppercase tracking-[0.18em] text-[#ff9d00]/80">
                        Try habits & daily notes — create an account to save
                    </p>

                    <div className="mx-auto mt-5 w-full max-w-2xl lg:max-w-6xl">
                        <div className="flex items-center gap-2 rounded-xl border-2 border-[#ff9d00]/55 bg-black/35 px-2 py-2 sm:px-3">
                            <button
                                type="button"
                                onClick={() => {
                                    const prev = new Date(selectedDate);
                                    prev.setDate(prev.getDate() - 1);
                                    setSelectedDate(prev);
                                }}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 text-[#ffe066]"
                                aria-label="Previous day"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedDate(new Date())}
                                className="min-w-0 flex-1 px-1 text-center text-sm font-semibold text-white sm:text-base"
                            >
                                {dateLine}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = new Date(selectedDate);
                                    next.setDate(next.getDate() + 1);
                                    setSelectedDate(next);
                                }}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 text-[#ffe066]"
                                aria-label="Next day"
                            >
                                ›
                            </button>
                        </div>
                    </div>

                    <div className="mx-auto mt-4 w-full max-w-2xl space-y-3 lg:max-w-6xl">
                        <div className={`${neon.panel} px-4 py-3 sm:px-5 sm:py-3.5`}>
                            <DailyScoreGauge percent={overall} grade={headerScores?.grade} />
                        </div>
                        <div className={`${neon.panel} min-w-0 overflow-hidden`}>
                            <button
                                type="button"
                                onClick={() => setScoreBreakdownOpen((o) => !o)}
                                className="flex w-full items-center justify-between px-4 py-3 text-left"
                            >
                                <span className="text-sm font-bold uppercase tracking-wide text-[#ff9d00]/90">
                                    Score breakdown
                                </span>
                                <span className="text-[#ff9d00]">{scoreBreakdownOpen ? '▲' : '▼'}</span>
                            </button>
                            <CollapsiblePanel open={scoreBreakdownOpen}>
                                <DashboardScoreBars scores={headerScores} />
                            </CollapsiblePanel>
                        </div>
                    </div>
                </header>

                <main className="min-w-0 flex-1 overflow-auto pb-28">
                    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:max-w-6xl">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                            <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
                                <div
                                    className={`rounded-2xl transition-all duration-500 ${
                                        morningFocusOn ? 'border border-[#ffb347]/55 bg-[#ff9d00]/[0.06]' : ''
                                    }`}
                                >
                                    <HabitDailyEntrySection
                                        selectedDate={selectedDate}
                                        timeframe="daily"
                                        customStartDate={null}
                                        customEndDate={null}
                                        userId={null}
                                        onScoresChange={setHeaderScores}
                                    />
                                </div>
                            </div>
                            <div className="min-w-0 space-y-6 lg:col-span-5 xl:col-span-4">
                                <div
                                    className={`rounded-2xl transition-all duration-500 ${
                                        eveningFocusOn ? 'border border-[#818cf8]/45 bg-[#6366f1]/[0.08]' : ''
                                    }`}
                                >
                                    <DashboardNotesSection selectedDate={selectedDate} userId={null} />
                                </div>
                                <LockedAppPreview app="newsfeed" compact />
                                <LockedAppPreview app="finance" compact />
                                <LockedAppPreview app="fitness" compact />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
