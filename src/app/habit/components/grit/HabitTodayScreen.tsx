'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/habitHelpers';
import type { GritHabitTemplate } from '../../lib/gritTypes';
import { TemplatesModal } from './TemplatesModal';

type HabitWithStatus = GritHabitTemplate & {
  status: 'checked' | 'half' | 'missed';
  entryId?: string;
  checked_at?: string | null;
};

interface HabitTodayScreenProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  habits: HabitWithStatus[];
  loading: boolean;
  onToggleHabit: (habitId: string, date: string) => Promise<void>;
  onCreateHabit: (template?: { name: string; icon: string; type: 'good' | 'health' | 'bad' | 'todo' }) => void;
  onEditHabit?: (habit: GritHabitTemplate) => void;
  isPreview?: boolean;
}

const DATES_TO_SHOW = 14; // 7 past + today + 6 future

export function HabitTodayScreen({
  selectedDate,
  onDateChange,
  habits,
  loading,
  onToggleHabit,
  onCreateHabit,
  onEditHabit,
  isPreview,
}: HabitTodayScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const dateStr = formatDate(selectedDate);
  const todayStr = formatDate(new Date());
  const isToday = dateStr === todayStr;

  // Build horizontal date strip (centered on selected)
  const stripStart = new Date(selectedDate);
  stripStart.setDate(stripStart.getDate() - 7);
  const stripDates: Date[] = [];
  for (let i = 0; i < DATES_TO_SHOW; i++) {
    const d = new Date(stripStart);
    d.setDate(stripStart.getDate() + i);
    stripDates.push(d);
  }

  const handleToggle = async (habitId: string) => {
    await onToggleHabit(habitId, dateStr);
  };

  const handleCreateNew = () => {
    setShowTemplates(true);
  };

  const handleSelectTemplate = (template: { name: string; icon: string; type: 'good' | 'health' | 'bad' | 'todo' } | null) => {
    setShowTemplates(false);
    if (template) onCreateHabit(template);
    else onCreateHabit(); // custom
  };

  return (
    <div className="min-h-screen bg-[var(--lu-bg)] text-[var(--lu-text)] flex flex-col safe-area-pb">
      {/* Top bar: menu + Today */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-[var(--lu-bg)]/95 backdrop-blur border-b border-white/5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Today</h1>
        <div className="w-12" />
      </header>

      {/* Menu drawer (simple overlay; link to full habit app) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}
      {menuOpen && (
        <div className="fixed top-0 left-0 z-50 w-72 max-w-[85vw] h-full bg-zinc-900 border-r border-white/10 shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <span className="font-semibold">Habits</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full active:bg-white/10"
            >
              ✕
            </button>
          </div>
          <nav className="p-2">
            <Link
              href="/habit"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--lu-text)] hover:bg-white/10 active:bg-white/15 min-h-[48px]"
              onClick={() => setMenuOpen(false)}
            >
              <span>📋</span>
              <span>Full habit tracker</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--lu-text)] hover:bg-white/10 active:bg-white/15 min-h-[48px]"
              onClick={() => setMenuOpen(false)}
            >
              <span>🏠</span>
              <span>Dashboard</span>
            </Link>
          </nav>
        </div>
      )}

      {/* Horizontal date strip */}
      <div className="flex overflow-x-auto gap-1 px-4 py-3 border-b border-white/5 scrollbar-hide">
        {stripDates.map((d) => {
          const ds = formatDate(d);
          const selected = ds === dateStr;
          const isTodayDate = ds === todayStr;
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = d.getDate();
          return (
            <button
              key={ds}
              type="button"
              onClick={() => onDateChange(d)}
              className={`
                flex-shrink-0 w-14 py-2 rounded-2xl text-center transition-all
                ${selected ? 'bg-[var(--lu-accent)] text-black font-semibold' : 'bg-white/5 text-[var(--lu-text)]'}
                ${isTodayDate && !selected ? 'ring-1 ring-[var(--lu-accent)]' : ''}
              `}
            >
              <div className="text-xs opacity-80">{dayName}</div>
              <div className="text-base font-medium">{dayNum}</div>
            </button>
          );
        })}
      </div>

      <main className="flex-1 px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : habits.length === 0 ? (
          <>
            {/* Onboarding card: Get ready for Grit */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-6 shadow-lg">
              <h3 className="text-base font-semibold mb-1">Get ready for Grit</h3>
              <p className="text-sm text-white/70 mb-4">Set up your first habits and priorities.</p>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs">1</span>
                  Add a <strong>good habit</strong> you want to build
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-400 text-xs">2</span>
                  Add a <strong>bad habit</strong> you want to break
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-400 text-xs">3</span>
                  Add a <strong>to-do</strong> for today
                </li>
              </ul>
            </div>

            {/* Empty state */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
              <p className="text-white/70 mb-6">No habits for this day yet.</p>
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full py-4 px-6 rounded-2xl bg-[var(--lu-accent)] text-black font-semibold text-base active:opacity-90 min-h-[48px]"
              >
                Create New Habit
              </button>
            </div>
          </>
        ) : (
          <>
            {/* List of habits for the day */}
            <ul className="space-y-3">
              {habits.map((habit) => (
                <li key={habit.id}>
                  <div
                    className={`
                      flex items-center gap-4 p-4 rounded-2xl border transition-all
                      bg-white/5 border-white/10 shadow-sm
                      ${habit.status === 'checked' ? 'opacity-80' : ''}
                    `}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(habit.id)}
                      className={`
                        flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl
                        border-2 min-w-[48px] min-h-[48px]
                        ${habit.status === 'checked'
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-400'
                          : 'bg-white/5 border-white/20'}
                      `}
                      aria-label={habit.status === 'checked' ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {habit.status === 'checked' ? '✓' : habit.icon}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${habit.status === 'checked' ? 'line-through text-white/60' : ''}`}>
                        {habit.name}
                      </p>
                      {habit.time_of_day && (
                        <p className="text-xs text-white/50 capitalize">{habit.time_of_day}</p>
                      )}
                    </div>
                    {onEditHabit && (
                      <button
                        type="button"
                        onClick={() => onEditHabit(habit)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/50 hover:text-white/80"
                        aria-label="Edit habit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-6 w-full py-3 rounded-2xl border border-dashed border-white/20 text-white/70 hover:border-[var(--lu-accent)] hover:text-[var(--lu-accent)] transition-colors min-h-[48px]"
            >
              + Add another habit
            </button>
          </>
        )}
      </main>

      {/* Floating + button */}
      <div className="fixed bottom-6 right-4 z-20 safe-area-pb">
        <button
          type="button"
          onClick={handleCreateNew}
          className="w-14 h-14 rounded-full bg-[var(--lu-accent)] text-black flex items-center justify-center shadow-lg active:scale-95 min-w-[56px] min-h-[56px]"
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
  );
}
