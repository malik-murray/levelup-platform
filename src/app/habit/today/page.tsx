'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HabitTodayRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/habit');
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#010205] text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </main>
  );
}
