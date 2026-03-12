'use client';

import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

const areas = [
  {
    title: 'Habits & Life Tracker',
    description: 'Build routines, track daily habits, priorities, and todos. Score your day across physical, mental, and spiritual dimensions.',
    href: '/preview/habit',
    icon: '📈',
  },
  {
    title: 'Finance & Budget',
    description: 'Track accounts, transactions, and category budgets. Stay on top of spending and plan your money.',
    href: '/preview/finance',
    icon: '💰',
  },
  {
    title: 'Fitness & Goals',
    description: 'Log workouts, meals, and metrics. Set daily and weekly targets for steps, calories, water, and exercise.',
    href: '/preview/fitness',
    icon: '💪',
  },
  {
    title: 'Daily Dashboard',
    description: 'Your daily command center: habits, news, fitness snapshot, and finance summary in one place.',
    href: '/preview/dashboard',
    icon: '📊',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 sm:h-10 sm:w-10">
              <Image src={logo} alt="LevelUpSolutions" className="h-full w-full object-contain" fill priority />
            </div>
            <span className="text-lg font-bold">LevelUpSolutions</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/preview"
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 active:bg-amber-600 transition-colors"
            >
              Try the App
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900 dark:text-white">
            Level up your habits, finances, and fitness in one place
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            LevelUpSolutions brings together daily habits, budgeting, fitness tracking, and a personal dashboard so you can see your progress and stay consistent.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/preview"
              className="w-full sm:w-auto rounded-md bg-amber-500 px-6 py-3 text-base font-semibold text-black hover:bg-amber-400 active:bg-amber-600 transition-colors text-center"
            >
              Try the App — No account needed
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto rounded-md border border-slate-300 dark:border-slate-600 px-6 py-3 text-base font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
            >
              Log in to your account
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 hover:border-amber-500/50 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 transition-colors"
            >
              <span className="text-3xl">{area.icon}</span>
              <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                {area.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {area.description}
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-amber-600 dark:text-amber-400">
                Explore in preview →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 mt-24">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Preview the app without an account. Create an account to save and sync your data.
        </div>
      </footer>
    </main>
  );
}
