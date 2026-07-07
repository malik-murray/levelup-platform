'use client';

import Link from 'next/link';

export default function GuestBanner() {
    return (
        <div className="border-b border-[#ff9d00]/30 bg-[#ff9d00]/10 text-[#ffe066]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm sm:gap-4">
                <span className="font-semibold">Guest mode</span>
                <span className="text-[#ffb86b]/90">— Habits & daily notes work here. Data stays in this browser.</span>
                <Link
                    href="/login?redirect=/onboarding/preview&mode=signup"
                    className="rounded-md border border-[#ff9d00]/50 bg-black/40 px-3 py-1 text-xs font-semibold text-[#ffe066] transition hover:bg-black/60"
                >
                    Create account to save & sync
                </Link>
            </div>
        </div>
    );
}
