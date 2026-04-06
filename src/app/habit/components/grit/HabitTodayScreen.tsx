'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { formatDate } from '@/lib/habitHelpers';
import type { GritHabitTemplate, TimeOfDay } from '../../lib/gritTypes';
import { TemplatesModal } from './TemplatesModal';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

type HabitWithStatus = GritHabitTemplate & {
  status: 'checked' | 'half' | 'missed';
  entryId?: string;
  checked_at?: string | null;
};

interface HabitTodayScreenProps {
  selectedDate: Date;
  /** Kept for callers (e.g. future date picker); not used while the list is fixed to `selectedDate`. */
  onDateChange?: (date: Date) => void;
  habits: HabitWithStatus[];
  loading: boolean;
  onToggleHabit: (habitId: string, date: string) => Promise<void>;
  onCreateHabit: (template?: { name: string; icon: string; type: 'good' | 'health' | 'bad' | 'todo' }) => void;
  onEditHabit?: (habit: GritHabitTemplate) => void;
  isPreview?: boolean;
}

const TIME_SECTIONS: { slot: TimeOfDay; title: string }[] = [
  { slot: 'morning', title: 'Morning' },
  { slot: 'afternoon', title: 'Afternoon' },
  { slot: 'evening', title: 'Evening' },
];

function sortHabits(a: HabitWithStatus, b: HabitWithStatus) {
  const ao = a.sort_order ?? 0;
  const bo = b.sort_order ?? 0;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name);
}

function HabitRow({
  habit,
  onToggle,
  onEditHabit,
}: {
  habit: HabitWithStatus;
  onToggle: (id: string) => void;
  onEditHabit?: (h: GritHabitTemplate) => void;
}) {
  return (
    <div
      className={`
        ${neon.section} flex items-center gap-4 p-4 transition-all
        ${habit.status === 'checked' ? 'opacity-90' : ''}
      `}
    >
      <button
        type="button"
        onClick={() => onToggle(habit.id)}
        className={`
          flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-2xl transition-colors
          ${
            habit.status === 'checked'
              ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
              : 'border-[#ff9d00]/35 bg-black/40 text-white'
          }
        `}
        aria-label={habit.status === 'checked' ? 'Mark incomplete' : 'Mark complete'}
      >
        {habit.status === 'checked' ? '✓' : habit.icon}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`break-words font-semibold [overflow-wrap:anywhere] ${habit.status === 'checked' ? 'text-white/55 line-through' : 'text-white'}`}
        >
          {habit.name}
        </p>
      </div>
      {onEditHabit && (
        <button
          type="button"
          onClick={() => onEditHabit(habit)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#ff9d00]/30 text-[#ff9d00]/80 transition hover:border-[#ff9d00]/60 hover:text-[#ffe066]"
          aria-label="Edit habit"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      )}
    </div>
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

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function HabitTodayScreen({
  selectedDate,
  habits,
  loading,
  onToggleHabit,
  onCreateHabit,
  onEditHabit,
  isPreview,
}: HabitTodayScreenProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const dateStr = formatDate(selectedDate);

  const habitsByTime = useMemo(() => {
    const unset: HabitWithStatus[] = [];
    const bySlot: Record<TimeOfDay, HabitWithStatus[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const h of habits) {
      if (h.time_of_day && h.time_of_day in bySlot) {
        bySlot[h.time_of_day].push(h);
      } else {
        unset.push(h);
      }
    }
    for (const slot of Object.keys(bySlot) as TimeOfDay[]) {
      bySlot[slot].sort(sortHabits);
    }
    unset.sort(sortHabits);
    return { bySlot, unset };
  }, [habits]);

  const handleToggle = async (habitId: string) => {
    await onToggleHabit(habitId, dateStr);
  };

  const handleCreateNew = () => {
    setShowTemplates(true);
  };

  const handleSelectTemplate = (
    template: { name: string; icon: string; type: 'good' | 'health' | 'bad' | 'todo' } | null
  ) => {
    setShowTemplates(false);
    if (template) onCreateHabit(template);
    else onCreateHabit();
  };

  const weeklyPlanHref = isPreview ? '/preview/habit/weekly-plan' : '/habit/weekly-plan';

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
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                  <p className="text-sm text-slate-400">Loading…</p>
                </div>
              ) : habits.length === 0 ? (
                <div className={`${neon.panel} p-8 text-center`}>
                  <p className="mb-6 text-slate-300">No habits for this day yet.</p>
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
                  <div className="space-y-8">
                    {TIME_SECTIONS.map(({ slot, title }) => {
                      const list = habitsByTime.bySlot[slot];
                      if (list.length === 0) return null;
                      return (
                        <section key={slot} aria-label={title}>
                          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
                            {title}
                          </h2>
                          <ul className="space-y-3">
                            {list.map((habit) => (
                              <li key={habit.id}>
                                <HabitRow
                                  habit={habit}
                                  onToggle={handleToggle}
                                  onEditHabit={onEditHabit}
                                />
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                    {habitsByTime.unset.length > 0 && (
                      <section aria-label="Anytime">
                        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#ff9d00]/90">
                          Anytime
                        </h2>
                        <ul className="space-y-3">
                          {habitsByTime.unset.map((habit) => (
                            <li key={habit.id}>
                              <HabitRow
                                habit={habit}
                                onToggle={handleToggle}
                                onEditHabit={onEditHabit}
                              />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
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

          {showTemplates && (
            <TemplatesModal
              open={showTemplates}
              onClose={() => setShowTemplates(false)}
              onSelectTemplate={handleSelectTemplate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
