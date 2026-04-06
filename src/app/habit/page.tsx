'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function HabitRootRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'weekly-plan') {
            router.replace('/habit/weekly-plan');
        } else {
            router.replace('/dashboard');
        }
    }, [router, searchParams]);

    return (
        <main className="flex min-h-dvh items-center justify-center bg-[#010205] text-white">
            <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                <p className="text-sm text-slate-400">Loading…</p>
            </div>
        </main>
    );
}

export default function HabitPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-dvh items-center justify-center bg-[#010205] text-white">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                        <p className="text-sm text-slate-400">Loading…</p>
                    </div>
                </main>
            }
        >
            <HabitRootRedirect />
        </Suspense>
    );
}
