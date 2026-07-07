'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Outfit } from 'next/font/google';
import type { GritHabitTemplate, TimeOfDay } from '../../lib/gritTypes';
import { SortableHabitList } from './SortableHabitList';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { useGuestSidebar } from '@/app/guest/GuestShellContext';
import { neon } from '@/app/dashboard/neonTheme';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

interface HabitManageScreenProps {
  habits: GritHabitTemplate[];
  loading: boolean;
  onCreateHabit: () => void;
  onEditHabit: (habit: GritHabitTemplate) => void;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onReorderHabits: (habitIds: string[]) => Promise<void>;
  isPreview?: boolean;
  isGuestRoute?: boolean;
}

const TIME_SECTIONS: { slot: TimeOfDay; title: string }[] = [
  { slot: 'morning', title: 'Morning' },
  { slot: 'afternoon', title: 'Afternoon' },
  { slot: 'evening', title: 'Evening' },
];

function sortHabits(a: GritHabitTemplate, b: GritHabitTemplate) {
  const ao = a.sort_order ?? 0;
  const bo = b.sort_order ?? 0;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name);
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

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function HabitManageScreen({
  habits,
  loading,
  onCreateHabit,
  onEditHabit,
  onDeleteHabit,
  onReorderHabits,
  isPreview,
  isGuestRoute = false,
}: HabitManageScreenProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openGuestSidebar = useGuestSidebar();
  const pathname = usePathname();
  const guestMode = isGuestRoute || pathname?.startsWith('/guest') === true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const habitsByTime = useMemo(() => {
    const unset: GritHabitTemplate[] = [];
    const bySlot: Record<TimeOfDay, GritHabitTemplate[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const habit of habits) {
      if (habit.time_of_day && habit.time_of_day in bySlot) {
        bySlot[habit.time_of_day].push(habit);
      } else {
        unset.push(habit);
      }
    }
    for (const slot of Object.keys(bySlot) as TimeOfDay[]) {
      bySlot[slot].sort(sortHabits);
    }
    unset.sort(sortHabits);
    return { bySlot, unset };
  }, [habits]);

  const handleReorderHabits = async (habitIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      await onReorderHabits(habitIds);
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder habits');
      throw reorderError;
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteHabit = async (habit: GritHabitTemplate) => {
    const confirmed = window.confirm(`Delete "${habit.name}"? Past check-ins will stay in your history.`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await onDeleteHabit(habit.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete habit');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNew = () => {
    onCreateHabit();
  };

  const weeklyPlanHref = guestMode
    ? '/upgrade?app=habit-weekly-plan'
    : isPreview
      ? '/preview/habit/weekly-plan'
      : '/habit/weekly-plan';

  return (
    <div className={`${outfit.className} ${neon.pageBg} flex min-h-dvh min-w-0 overflow-x-hidden`}>
      {!guestMode ? <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} /> : null}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-800/95 via-slate-900 to-slate-950/95 dark:hidden"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 hidden dark:block" aria-hidden>
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
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 pr-28 lg:max-w-6xl">
              <button
                type="button"
                onClick={() => (guestMode ? openGuestSidebar() : setSidebarOpen((o) => !o))}
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

              <Link
                href={weeklyPlanHref}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70"
                aria-label="Weekly plan"
              >
                <IconCalendar />
              </Link>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto px-4 py-6 pb-28 sm:px-6">
            <div className="mx-auto w-full max-w-2xl lg:max-w-6xl">
              <h1 className="mb-2 text-2xl font-bold text-white">Manage Habits</h1>
              <p className="mb-6 text-sm text-slate-400">
                Drag to reorder within each section. Tap edit to change a habit, or delete any you no longer need.
              </p>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                  <p className="text-sm text-slate-400">Loading…</p>
                </div>
              ) : habits.length === 0 ? (
                <div className={`${neon.panel} p-8 text-center`}>
                  <p className="mb-6 text-slate-300">No habits yet.</p>
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="w-full min-h-[48px] rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00]/15 py-4 text-base font-semibold text-[#ffe066] shadow-[0_0_20px_rgba(255,157,0,0.15)] transition hover:bg-[#ff9d00]/25"
                  >
                    Create New Habit
                  </button>
                </div>
              ) : (
                <>
                  {error ? (
                    <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </p>
                  ) : null}
                  <div className="space-y-8">
                    {TIME_SECTIONS.map(({ slot, title }) => {
                      const list = habitsByTime.bySlot[slot];
                      if (list.length === 0) return null;
                      return (
                        <section key={slot} aria-label={title}>
                          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
                            {title}
                          </h2>
                          <SortableHabitList
                            habits={list}
                            busy={busy}
                            onReorder={handleReorderHabits}
                            onDelete={handleDeleteHabit}
                            onEditHabit={onEditHabit}
                          />
                        </section>
                      );
                    })}
                    {habitsByTime.unset.length > 0 ? (
                      <section aria-label="Anytime">
                        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
                          Anytime
                        </h2>
                        <SortableHabitList
                          habits={habitsByTime.unset}
                          busy={busy}
                          onReorder={handleReorderHabits}
                          onDelete={handleDeleteHabit}
                          onEditHabit={onEditHabit}
                        />
                      </section>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="mt-6 w-full min-h-[48px] rounded-xl border-2 border-dashed border-[#ff9d00]/35 py-3 text-sm font-semibold text-slate-300 transition hover:border-[#ff9d00]/60 hover:text-[#ffe066]"
                  >
                    + Add another habit
                  </button>
                </>
              )}
            </div>
          </main>

          <div className="fixed bottom-6 right-4 z-20 safe-area-pb sm:right-6">
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex h-14 w-14 min-h-[56px] min-w-[56px] items-center justify-center rounded-full border-2 border-[#ff9d00]/60 bg-[#ff9d00] text-lg font-bold text-black shadow-[0_0_24px_rgba(255,157,0,0.45)] transition hover:scale-[1.02] active:scale-95"
              aria-label="Create new habit"
            >
              <span className="text-2xl leading-none">+</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
