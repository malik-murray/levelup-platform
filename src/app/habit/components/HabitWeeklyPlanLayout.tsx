'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import logo from '../../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import WeeklyPlanView from './WeeklyPlanView';

export default function HabitWeeklyPlanLayout() {
    const pathname = usePathname();
    const isPreview = pathname?.startsWith('/preview') === true;
    const dashboardHref = isPreview ? '/preview/dashboard' : '/dashboard';

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors overflow-x-hidden">
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors overflow-x-hidden">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-4 min-w-0">
                    <Link href={dashboardHref} className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 shrink-0">
                        <div className="relative h-8 w-8 shrink-0">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Weekly Plan</h1>
                            <p className="text-xs text-slate-400 mt-0.5">LevelUp Player One</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href={dashboardHref}
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </header>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6 min-w-0 overflow-x-hidden">
                <WeeklyPlanView />
            </div>
        </main>
    );
}
