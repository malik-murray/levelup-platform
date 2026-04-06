'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import AppSidebar from '@/app/dashboard/components/AppSidebar';
import { playUiSound } from '@/lib/soundEffects';
import type { ComingSoonAppKey } from '@/lib/comingSoonApps';
import { COMING_SOON_APP_LABELS } from '@/lib/comingSoonApps';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

function IconMenu() {
    return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

export default function ComingSoonPageClient({ appKey }: { appKey: ComingSoonAppKey | null }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const title = appKey ? COMING_SOON_APP_LABELS[appKey] : 'Premium apps';

    return (
        <div
            className={`${outfit.className} flex min-h-dvh min-w-0 overflow-x-hidden bg-slate-100 text-slate-900 antialiased dark:bg-[#010205] dark:text-white`}
        >
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden">
                <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-50/95 via-slate-100 to-slate-200/95 dark:hidden"
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
                        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 lg:max-w-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    playUiSound('tap');
                                    setSidebarOpen((o) => !o);
                                }}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-500/55 bg-white/90 text-amber-800 shadow-md transition hover:border-amber-600 hover:bg-white dark:border-[#ff9d00]/60 dark:bg-black/50 dark:text-[#ffe066] dark:shadow-[0_0_18px_rgba(255,157,0,0.25)] dark:hover:border-[#ff9d00] dark:hover:bg-black/70"
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
                            <div className="h-11 w-11 shrink-0" aria-hidden />
                        </div>
                    </header>

                    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-12 pt-4 sm:px-6 lg:max-w-xl">
                        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-white/85 p-8 text-center shadow-md backdrop-blur-md dark:border-[#ff9d00]/55 dark:bg-black/45 dark:shadow-[0_0_32px_rgba(255,157,0,0.18),inset_0_0_40px_rgba(255,157,0,0.06)]">
                            <div
                                className="pointer-events-none absolute left-1/2 top-0 z-10 h-px w-[min(12rem,70%)] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90 dark:via-[#ffea8a]"
                                aria-hidden
                            />
                            <p className="mb-3 text-4xl" aria-hidden>
                                🔒
                            </p>
                            <h1 className="mb-2 text-2xl font-bold tracking-tight text-amber-900 dark:text-[#ffe066] dark:[text-shadow:0_0_20px_rgba(255,157,0,0.35)] sm:text-3xl">
                                {title}
                            </h1>
                            <p className="mb-6 text-base text-slate-600 dark:text-slate-300">
                                {appKey ? (
                                    <>
                                        Coming soon — we&apos;re finishing this experience. You&apos;ll be able to subscribe
                                        and unlock it here when it launches.
                                    </>
                                ) : (
                                    <>
                                        Choose an app from the menu to see what&apos;s coming. Paid add-ons will be available
                                        here soon.
                                    </>
                                )}
                            </p>
                            <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
                                Paid add-ons per app are on the roadmap; pricing and checkout will appear on this page.
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                                <button
                                    type="button"
                                    disabled
                                    className="cursor-not-allowed rounded-xl border-2 border-amber-400/40 bg-slate-100/90 px-6 py-3 text-sm font-semibold text-slate-500 opacity-80 dark:border-[#ff9d00]/30 dark:bg-white/5 dark:text-slate-500"
                                    aria-disabled
                                >
                                    Subscribe (soon)
                                </button>
                                <Link
                                    href="/dashboard"
                                    onClick={() => playUiSound('tap')}
                                    className="inline-flex items-center justify-center rounded-xl border-2 border-amber-500/60 bg-gradient-to-r from-[#ff7a00] to-[#ff9d00] px-6 py-3 text-sm font-semibold text-black shadow-[0_0_16px_rgba(255,157,0,0.35)] transition hover:border-[#ff9d00] hover:opacity-95"
                                >
                                    Back to dashboard
                                </Link>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
