'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Outfit } from 'next/font/google';
import LockedAppPreview from '@/components/access/LockedAppPreview';
import type { AppKey } from '@/lib/access/types';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '600', '700', '800'] });
const LOGO_SRC = '/brand/levelup-logo.png';

function parseAppParam(value: string | null): Exclude<AppKey, 'dashboard' | 'habit' | 'settings'> | null {
    if (!value) return null;
    const allowed = [
        'habit-weekly-plan',
        'finance',
        'fitness',
        'newsfeed',
        'trends',
        'todo',
        'goals',
        'markets',
    ] as const;
    return (allowed as readonly string[]).includes(value)
        ? (value as Exclude<AppKey, 'dashboard' | 'habit' | 'settings'>)
        : null;
}

export default function UpgradePageClient() {
    const searchParams = useSearchParams();
    const app = parseAppParam(searchParams.get('app'));

    return (
        <main
            className={`${outfit.className} flex min-h-dvh flex-col items-center justify-center bg-[#010205] px-4 py-12 text-white`}
        >
            <Link href="/landing" className="mb-8">
                <div className="relative h-20 w-36">
                    <Image src={LOGO_SRC} alt="Level Up Solutions" fill unoptimized className="object-contain" />
                </div>
            </Link>

            <div className="w-full max-w-lg">
                {app ? (
                    <LockedAppPreview app={app} />
                ) : (
                    <div className="rounded-2xl border-2 border-[#ff9d00]/25 bg-black/35 p-6 text-center">
                        <p className="mb-2 text-4xl" aria-hidden>
                            🔒
                        </p>
                        <h1 className="mb-2 text-2xl font-bold text-[#ffe066]">Premium apps</h1>
                        <p className="text-sm text-slate-400">
                            This feature is part of the full LevelUp experience. Sign up free to keep using habits, or
                            subscribe when checkout launches to unlock everything.
                        </p>
                    </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00]/15 px-5 py-2.5 text-sm font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/25"
                    >
                        Back to dashboard
                    </Link>
                    <Link
                        href="/login?mode=signup"
                        className="inline-flex items-center justify-center rounded-xl border-2 border-[#ff9d00] bg-[#ff9d00]/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff9d00]/30"
                    >
                        Create free account
                    </Link>
                </div>
            </div>
        </main>
    );
}
