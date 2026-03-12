'use client';

import { useRouter } from 'next/navigation';

export function GroupsScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--lu-bg)] text-[var(--lu-text)] flex flex-col">
      <header className="flex items-center justify-between h-14 px-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Groups</h1>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="rounded-2xl border border-white/10 p-8 text-center">
          <p className="text-white/70 mb-4">No groups yet. Group habits (e.g. Morning routine) to organize your day.</p>
          <button
            type="button"
            onClick={() => router.push('/habit/groups/templates')}
            className="py-3 px-6 rounded-2xl bg-[var(--lu-accent)] text-black font-semibold min-h-[48px]"
          >
            Create group
          </button>
        </div>
      </main>
    </div>
  );
}
