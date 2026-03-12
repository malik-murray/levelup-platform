'use client';

import Link from 'next/link';
import Image from 'next/image';
import logo from '../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePreviewSidebar } from '../PreviewShellContext';

const modules = [
  { name: 'Habit Tracker', href: '/preview/habit', icon: '📈', description: 'Track daily habits, priorities, and todos' },
  { name: 'Finance Tracker', href: '/preview/finance', icon: '💰', description: 'Accounts, transactions, and budgets' },
  { name: 'Fitness Tracker', href: '/preview/fitness', icon: '💪', description: 'Workouts, meals, and goals' },
];

export default function PreviewDashboardPage() {
  const openSidebar = usePreviewSidebar();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={openSidebar}
                className="lg:hidden p-2 rounded-md border border-slate-700 hover:bg-slate-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="relative h-8 w-8 sm:h-10 sm:w-10">
                  <Image src={logo} alt="LevelUpSolutions" className="h-full w-full object-contain" fill priority />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold">Preview — Daily Dashboard</h1>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-slate-400 mb-8">
            Welcome to Preview Mode. Your data is saved in this browser only. Try the modules below — then create an account to save and sync.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="block rounded-xl border border-slate-700 bg-slate-900/50 p-6 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
              >
                <span className="text-3xl">{m.icon}</span>
                <h2 className="mt-3 text-lg font-semibold text-white">{m.name}</h2>
                <p className="mt-2 text-sm text-slate-400">{m.description}</p>
                <span className="mt-3 inline-block text-sm font-medium text-amber-400">Open →</span>
              </Link>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-200">
              <strong>Create an account</strong> to save your preview data and sync across devices. You won&apos;t lose anything — we&apos;ll transfer your habits, budget, and fitness data when you sign up.
            </p>
            <Link
              href="/login?redirect=/onboarding/preview"
              className="mt-3 inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              Create Account to Save & Sync
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
