'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PreviewHabitTodayRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/preview/habit');
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </main>
  );
}
