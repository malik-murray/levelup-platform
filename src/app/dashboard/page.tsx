'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import { supabase } from '@auth/supabaseClient';
import HabitDailyEntrySection from './components/HabitDailyEntrySection';
import DashboardNotesSection from './components/DashboardNotesSection';
import AppSidebar from './components/AppSidebar';
import DashboardScoreBars, { type DashboardScores } from './components/DashboardScoreBars';
import DashboardCalendarOverview from './components/DashboardCalendarOverview';
import CollapsiblePanel from './components/CollapsiblePanel';
import { neon } from './neonTheme';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

type Timeframe = 'daily' | 'weekly' | 'custom';

function displayNameFromUser(user: { user_metadata?: Record<string, unknown> }): string | null {
  const m = user.user_metadata;
  if (!m) return null;
  for (const key of ['full_name', 'name', 'given_name', 'preferred_username'] as const) {
    const v = m[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Circular ring fills clockwise from top as overall score increases; grade + % centered inside. */
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
    <div
      className="relative mx-auto aspect-square w-[min(100%,9.5rem)] shrink-0 sm:w-40"
      role="group"
      aria-label={
        percent === null ? 'Daily score' : `Daily score ${percent} percent${grade ? `, grade ${grade}` : ''}`
      }
    >
      <svg
        className="h-full w-full -rotate-90"
        viewBox={`0 0 ${vb} ${vb}`}
        aria-hidden
      >
        <defs>
          <linearGradient id={gaugeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff5a00" />
            <stop offset="55%" stopColor="#ff9d00" />
            <stop offset="100%" stopColor="#ffea8a" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,157,0,0.2)"
          strokeWidth={stroke}
        />
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
        {grade ? (
          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.18em] text-[#ff9d00]/95 sm:text-[11px]">
            Grade {grade}
          </p>
        ) : (
          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.18em] text-[#ff9d00]/95 sm:text-[11px]">
            Daily score
          </p>
        )}
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

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
    const [customStartDate] = useState<Date | null>(null);
    const [customEndDate] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerScores, setHeaderScores] = useState<DashboardScores | null>(null);
  const [showCalendarOverview, setShowCalendarOverview] = useState(false);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.error('Authentication error:', error);
          window.location.href = '/login';
          return;
        }

        setUserId(user.id);
        setUserDisplayName(displayNameFromUser(user));

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.error('No active session found');
          window.location.href = '/login';
          return;
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    setHeaderScores(null);
  }, [selectedDate, timeframe]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setTimeframe('daily');
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    setTimeframe('daily');
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setTimeframe('daily');
  };

  const handleSetupNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
    setTimeframe('daily');
  };

  const dateLine = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const overall = headerScores ? Math.round(headerScores.score_overall) : null;
  const activeDayPart = currentHour < 12 ? 'morning' : currentHour >= 18 ? 'evening' : 'afternoon';
  const morningFocusOn = activeDayPart === 'morning';
  const eveningFocusOn = activeDayPart === 'evening';

  if (loading) {
    return (
      <main
        className={`${outfit.className} flex min-h-dvh items-center justify-center bg-[#010205] text-white`}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <div className={`${outfit.className} ${neon.pageBg} flex min-h-dvh min-w-0 overflow-x-hidden`}>
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, #050816 0%, #010205 42%, #010205 100%), radial-gradient(ellipse 120% 80% at 50% -8%, rgba(255,120,40,0.2) 0%, transparent 55%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35), transparent),
                radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.2), transparent),
                radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.28), transparent)
              `,
              backgroundSize: '100% 100%',
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-40 opacity-30"
            style={{
              background:
                'linear-gradient(to top, rgba(255,100,30,0.15) 0%, transparent 70%), repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(255,157,0,0.06) 12px, rgba(255,157,0,0.06) 14px)',
              maskImage: 'linear-gradient(to top, black, transparent)',
            }}
          />
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="min-w-0 px-4 pb-2 pt-5 sm:px-6">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 lg:max-w-6xl">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70"
                aria-label="Open menu"
              >
                <IconMenu />
              </button>

              <div className="flex flex-1 justify-center">
                <div className="relative h-16 w-36 sm:h-[4.5rem] sm:w-44">
                  <Image
                    src={LOGO_SRC}
                    alt="Level Up Solutions"
                    fill
                    unoptimized
                    className="object-contain object-center"
                    sizes="176px"
                    priority
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCalendarOverview(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70"
                aria-label="Calendar overview"
              >
                <IconCalendar />
              </button>
            </div>

            <p
              className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-lg font-bold tracking-tight sm:text-xl"
              style={{ color: '#ffe066', textShadow: '0 0 18px rgba(255,200,80,0.35)' }}
            >
              <span>Welcome Back</span>
              {userDisplayName ? (
                <>
                  <span>,</span>
                  <span className="max-w-[min(100%,16rem)] truncate" title={userDisplayName}>
                    {userDisplayName}
                  </span>
                  <span>!</span>
                </>
              ) : (
                <span>!</span>
              )}
            </p>
            <p className="mx-auto mt-1 text-center text-xs uppercase tracking-[0.18em] text-[#ff9d00]/80">
              {morningFocusOn
                ? 'Morning focus active'
                : eveningFocusOn
                  ? 'Evening review active'
                  : 'Afternoon momentum active'}
            </p>

            <div className="mx-auto mt-5 w-full max-w-2xl lg:max-w-6xl">
              <div className="flex items-center gap-2 rounded-xl border-2 border-[#ff9d00]/55 bg-black/35 px-2 py-2 shadow-[0_0_20px_rgba(255,157,0,0.12)] backdrop-blur-sm sm:px-3">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 text-[#ffe066] transition hover:bg-[#0a1020]"
                  aria-label="Previous day"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="min-w-0 flex-1 px-1 text-center text-sm font-semibold text-white sm:text-base"
                >
                  {dateLine}
                </button>
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ff9d00]/40 bg-[#060a14]/90 text-[#ffe066] transition hover:bg-[#0a1020]"
                  aria-label="Next day"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

            </div>

            {timeframe === 'daily' && (
              <div className="mx-auto mt-4 w-full max-w-2xl space-y-3 lg:max-w-6xl">
                <div className={neon.panel + ' px-4 py-3 sm:px-5 sm:py-3.5'}>
                  <div className="flex flex-col items-center">
                    <DailyScoreGauge percent={overall} grade={headerScores?.grade} />
                  </div>
                </div>

                <div className={`${neon.panel} min-w-0 overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => setScoreBreakdownOpen((o) => !o)}
                    aria-expanded={scoreBreakdownOpen}
                    className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#ff9d00]/5"
                  >
                    <span className="text-sm font-bold uppercase tracking-wide text-[#ff9d00]/90">
                      Score breakdown
                    </span>
                    <svg
                      className={`h-5 w-5 shrink-0 text-[#ff9d00] transition-transform duration-300 ease-out motion-reduce:transition-none ${scoreBreakdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <CollapsiblePanel open={scoreBreakdownOpen}>
                    <DashboardScoreBars scores={headerScores} />
                  </CollapsiblePanel>
                </div>
              </div>
            )}
          </header>

          {showCalendarOverview && (
            <DashboardCalendarOverview
              userId={userId}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setTimeframe('daily');
              }}
              onClose={() => setShowCalendarOverview(false)}
            />
          )}

          <main className="min-w-0 flex-1 overflow-auto pb-28">
            <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:max-w-6xl">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
                  <div
                    className={`rounded-2xl transition-all duration-500 ${
                      morningFocusOn
                        ? 'border border-[#ffb347]/55 bg-[#ff9d00]/[0.06] shadow-[0_0_32px_rgba(255,157,0,0.15)]'
                        : ''
                    }`}
                  >
                    <HabitDailyEntrySection
                      selectedDate={selectedDate}
                      timeframe={timeframe}
                      customStartDate={customStartDate}
                      customEndDate={customEndDate}
                      userId={userId}
                      onScoresChange={setHeaderScores}
                    />
                  </div>
                </div>

                <div className="min-w-0 lg:col-span-5 xl:col-span-4">
                  {timeframe === 'daily' && (
                    <div
                      className={`rounded-2xl transition-all duration-500 ${
                        eveningFocusOn
                          ? 'border border-[#818cf8]/45 bg-[#6366f1]/[0.08] shadow-[0_0_30px_rgba(129,140,248,0.18)]'
                          : ''
                      }`}
                    >
                      <DashboardNotesSection selectedDate={selectedDate} userId={userId} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10 flex justify-center pb-4">
                <button
                  type="button"
                  onClick={handleSetupNextDay}
                  className="rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00]/10 px-5 py-2.5 text-sm font-semibold text-[#ffe066] shadow-[0_0_20px_rgba(255,157,0,0.15)] transition hover:bg-[#ff9d00]/20"
                >
                  Set up next day
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
