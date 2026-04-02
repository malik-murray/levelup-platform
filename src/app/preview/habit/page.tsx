'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PreviewHabitRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'weekly-plan') {
            router.replace('/preview/habit/weekly-plan');
        } else {
            router.replace('/preview/dashboard');
        }
    }, [router, searchParams]);

    return (
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </main>
    );
}

export default function PreviewHabitPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </main>
            }
        >
            <PreviewHabitRedirect />
        </Suspense>
    );
}
