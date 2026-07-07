'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';

const LOGO_SRC = '/brand/levelup-logo.png';

function IconMenu() {
    return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

type AppShellProps = {
    /** Section label shown in the header, e.g. "Finance", "Fitness" — no separate sub-brand names */
    title: string;
    children: ReactNode;
    /** Optional short description under the title (desktop only) */
    subtitle?: string;
    /** App's own secondary nav (tabs/segmented filters), rendered below the header row */
    subnav?: ReactNode;
};

/**
 * Universal app chrome: sidebar drawer (all apps, reachable in one click from anywhere)
 * + a consistent header. Every route group should wrap its content in this instead of
 * hand-rolling its own header/branding.
 */
export default function AppShell({ title, children, subtitle, subnav }: AppShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className={`${neon.pageBg} flex min-h-dvh min-w-0 overflow-x-hidden`}>
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
                <div
                    className="pointer-events-none absolute inset-0 dark:hidden"
                    style={{ background: 'linear-gradient(to bottom, rgba(30,41,59,0.95), rgba(15,23,42,1))' }}
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-0 hidden dark:block" aria-hidden>
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                'linear-gradient(to bottom, #050816 0%, #010205 42%, #010205 100%), radial-gradient(ellipse 120% 80% at 50% -8%, rgba(255,120,40,0.14) 0%, transparent 55%)',
                        }}
                    />
                </div>

                <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                    <header className="min-w-0 border-b border-[#ff9d00]/15 px-4 py-3 sm:px-6">
                        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(true)}
                                aria-label="Open menu"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70"
                            >
                                <IconMenu />
                            </button>

                            <div className="relative hidden h-9 w-9 shrink-0 sm:block">
                                <Image
                                    src={LOGO_SRC}
                                    alt="Level Up Solutions"
                                    fill
                                    unoptimized
                                    className="object-contain"
                                    sizes="36px"
                                />
                            </div>

                            <div className="min-w-0 flex-1">
                                <h1 className={neon.headingMd}>{title}</h1>
                                {subtitle ? (
                                    <p className="hidden truncate text-xs text-slate-400 sm:block">{subtitle}</p>
                                ) : null}
                            </div>
                        </div>

                        {subnav ? (
                            <div className="mx-auto mt-3 w-full max-w-6xl overflow-x-auto scrollbar-hide">{subnav}</div>
                        ) : null}
                    </header>

                    <main className="relative mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-4 sm:px-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
