'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { neon } from '@/app/dashboard/neonTheme';
import TrendsSubNav from '@/app/trends/components/TrendsSubNav';

const LOGO_SRC = '/brand/levelup-logo.png';

const headerBtnClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70';

type Props = {
    title: string;
    subtitle?: string;
    sidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
    children: ReactNode;
};

function IconMenu() {
    return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

export default function TrendsLayoutShell({
    title,
    subtitle,
    sidebarOpen,
    setSidebarOpen,
    children,
}: Props) {
    return (
        <div className={`${neon.pageBg} flex min-h-dvh min-w-0 overflow-x-hidden font-sans`}>
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
                    <header className="min-w-0 border-b border-[#ff9d00]/20 bg-black/25 px-4 pb-2 pt-5 backdrop-blur-md sm:px-6">
                        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 lg:max-w-6xl">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className={headerBtnClass}
                                aria-label="Open menu"
                            >
                                <IconMenu />
                            </button>

                            <div className="flex min-w-0 flex-1 justify-center px-2">
                                <div className="relative h-16 w-36 shrink-0 sm:h-[4.5rem] sm:w-44">
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
                                href="/dashboard"
                                className="flex h-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#ff9d00]/60 bg-black/50 px-3 text-xs font-semibold text-[#ffe066] shadow-[0_0_18px_rgba(255,157,0,0.25)] transition hover:border-[#ff9d00] hover:bg-black/70 sm:px-4 sm:text-sm"
                            >
                                Dashboard
                            </Link>
                        </div>

                        <p
                            className="mx-auto mt-3 text-center text-lg font-bold tracking-tight sm:text-xl"
                            style={{ color: '#ffe066', textShadow: '0 0 18px rgba(255,200,80,0.35)' }}
                        >
                            {title}
                        </p>
                        {subtitle?.trim() ? (
                            <p className="mx-auto mt-1 max-w-2xl text-center text-xs text-slate-400 sm:max-w-none">
                                {subtitle}
                            </p>
                        ) : null}
                    </header>

                    <TrendsSubNav />

                    <div className="min-w-0 flex-1">{children}</div>
                </div>
            </div>
        </div>
    );
}
