'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GuestEntryPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/guest/dashboard');
    }, [router]);
    return (
        <main className="flex min-h-dvh items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
        </main>
    );
}
