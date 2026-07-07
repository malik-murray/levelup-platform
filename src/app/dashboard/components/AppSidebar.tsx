'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@auth/supabaseClient';
import { playUiSound } from '@/lib/soundEffects';
import { useAccess } from '@/lib/access/useAccess';
import type { AppKey } from '@/lib/access/types';
import {
    type ComingSoonAppKey,
    comingSoonMenuHref,
} from '@/lib/comingSoonApps';

type App = {
    name: string;
    href: string;
    icon: string;
    appKey?: AppKey;
    comingSoonKey?: ComingSoonAppKey;
};

const primaryNavApps: App[] = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', appKey: 'dashboard' },
    { name: 'To-Do', href: '/todo', icon: '📝', appKey: 'todo' },
    { name: 'Goals & Vision', href: '/goals', icon: '🎯', appKey: 'goals' },
    { name: 'Trends', href: '/trends', icon: '📉', appKey: 'trends' },
    { name: 'Weekly plan', href: '/habit/weekly-plan', icon: '📅', appKey: 'habit-weekly-plan' },
    { name: 'Settings', href: '/settings', icon: '⚙️', appKey: 'settings' },
];

const otherApps: App[] = [
    { name: 'Habits Tracker', href: '/habit', icon: '✅', appKey: 'habit' },
    { name: 'Finance Tracker', href: '/finance', icon: '💰', appKey: 'finance' },
    { name: 'Newsfeed', href: '/newsfeed', icon: '📰', appKey: 'newsfeed' },
    { name: 'Fitness Tracker', href: '/fitness', icon: '💪', appKey: 'fitness' },
    { name: 'Stock & Crypto Analyzer', href: '/markets', icon: '📈', appKey: 'markets' },
    { name: 'Home Search', href: '/home-search', icon: '🏡', appKey: 'home-search' },
    { name: 'Sports Betting Bot', href: '/sports-betting', icon: '⚽', appKey: 'sports-betting' },
];

function renderAppRow(
    app: App,
    onClose: () => void,
    pathname: string,
    comingSoonActive: string | null,
    canAccessApp: (key: AppKey) => boolean
) {
    const isComingSoon = Boolean(app.comingSoonKey);
    const isLocked = app.appKey ? !canAccessApp(app.appKey) && !isComingSoon : false;
    const href = isComingSoon
        ? comingSoonMenuHref(app.comingSoonKey!)
        : isLocked && app.appKey
          ? `/upgrade?app=${app.appKey}`
          : app.href;
    const isActive = app.comingSoonKey
        ? comingSoonActive === app.comingSoonKey
        : !isLocked &&
          (pathname === app.href || (app.href !== '/dashboard' && pathname.startsWith(`${app.href}/`)));

    const base =
        'flex items-center gap-3 rounded-xl px-4 py-3 transition-colors border-2 border-transparent';
    const activeCls =
        'border-amber-500/60 bg-amber-100/90 text-amber-950 shadow-sm dark:border-[#ff9d00]/50 dark:bg-[#ff9d00]/15 dark:text-[#ffe066] dark:shadow-[0_0_16px_rgba(255,157,0,0.15)]';
    const normalCls =
        'text-slate-700 hover:bg-amber-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#ff9d00]/10 dark:hover:text-white';
    const comingSoonIdleCls =
        'opacity-65 text-slate-500 hover:bg-amber-50/80 hover:text-slate-700 hover:opacity-90 dark:text-slate-500 dark:hover:bg-[#ff9d00]/10 dark:hover:text-slate-200';

    const className = `${base} ${
        isActive ? activeCls : isComingSoon || isLocked ? comingSoonIdleCls : normalCls
    }`;

    return (
        <li key={app.comingSoonKey ?? app.href}>
            <Link
                href={href}
                aria-label={isComingSoon || isLocked ? `${app.name} (premium)` : app.name}
                onClick={() => {
                    playUiSound('tap');
                    onClose();
                }}
                className={className}
            >
                <span className={`text-xl ${(isComingSoon || isLocked) && !isActive ? 'grayscale-[0.35]' : ''}`}>
                    {app.icon}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                    <span className="truncate">{app.name}</span>
                    {isComingSoon ? (
                        <span
                            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
                            aria-hidden
                        >
                            🔒 Soon
                        </span>
                    ) : isLocked ? (
                        <span
                            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
                            aria-hidden
                        >
                            🔒
                        </span>
                    ) : null}
                </span>
            </Link>
        </li>
    );
}

function AppNavLinksCore({
    onClose,
    pathname,
    comingSoonActive,
    canAccessApp,
}: {
    onClose: () => void;
    pathname: string;
    comingSoonActive: string | null;
    canAccessApp: (key: AppKey) => boolean;
}) {
    return (
        <div className="space-y-6">
            <ul className="space-y-2">
                {primaryNavApps.map((app) => renderAppRow(app, onClose, pathname, comingSoonActive, canAccessApp))}
            </ul>

            <section className="space-y-2" aria-labelledby="sidebar-other-apps-heading">
                <h3
                    id="sidebar-other-apps-heading"
                    className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500"
                >
                    Other apps
                </h3>
                <ul className="space-y-2">
                    {otherApps.map((app) => renderAppRow(app, onClose, pathname, comingSoonActive, canAccessApp))}
                </ul>
            </section>
        </div>
    );
}

function AppNavLinksWithSearch({ onClose }: { onClose: () => void }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { canAccessApp } = useAccess();
    const comingSoonActive = pathname === '/coming-soon' ? searchParams.get('app') : null;
    return (
        <AppNavLinksCore
            onClose={onClose}
            pathname={pathname}
            comingSoonActive={comingSoonActive}
            canAccessApp={canAccessApp}
        />
    );
}

function AppNavLinksFallback({ onClose }: { onClose: () => void }) {
    const pathname = usePathname();
    const { canAccessApp } = useAccess();
    return (
        <AppNavLinksCore
            onClose={onClose}
            pathname={pathname}
            comingSoonActive={null}
            canAccessApp={canAccessApp}
        />
    );
}

export default function AppSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 dark:bg-black/50 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    w-64 border-r border-amber-300/40 bg-white shadow-md
                    dark:border-[#ff9d00]/25 dark:bg-[#020408] dark:shadow-[4px_0_24px_rgba(255,157,0,0.08)]
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-amber-200/80 p-4 dark:border-[#ff9d00]/20">
                        <h2 className="text-lg font-bold text-amber-900 dark:text-[#ffe066]">Menu</h2>
                        <button
                            onClick={onClose}
                            className="rounded-md p-1 text-slate-600 hover:bg-amber-100 dark:text-inherit dark:hover:bg-[#ff9d00]/10 lg:hidden"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Menu */}
                    <nav className="flex-1 overflow-y-auto p-4">
                        <Suspense fallback={<AppNavLinksFallback onClose={onClose} />}>
                            <AppNavLinksWithSearch onClose={onClose} />
                        </Suspense>
                    </nav>

                    {/* Log out - bottom of menu */}
                    <div className="border-t border-amber-200/80 p-4 dark:border-[#ff9d00]/20">
                        <button
                            onClick={async () => {
                                playUiSound('tap');
                                onClose();
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-700 transition-colors hover:bg-amber-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#ff9d00]/10 dark:hover:text-white"
                        >
                            <span className="text-xl">🚪</span>
                            <span className="font-medium">Log out</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
