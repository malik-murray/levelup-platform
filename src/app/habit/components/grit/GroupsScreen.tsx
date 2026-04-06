'use client';

import { useRouter } from 'next/navigation';
import { HabitFlowShell } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

export function GroupsScreen({ returnTo }: { returnTo: string }) {
  const router = useRouter();

  return (
    <HabitFlowShell title="Groups" onBack={() => router.push(returnTo)}>
      <div className={`${neon.panel} p-8 text-center`}>
        <p className="mb-4 text-slate-300">
          No groups yet. Group habits (e.g. Morning routine) to organize your day.
        </p>
        <button
          type="button"
          onClick={() => router.push('/habit/groups/templates')}
          className="min-h-[48px] rounded-xl border-2 border-[#ff9d00]/50 bg-[#ff9d00]/15 px-6 py-3 text-sm font-semibold text-[#ffe066] shadow-[0_0_20px_rgba(255,157,0,0.15)] transition hover:bg-[#ff9d00]/25"
        >
          Create group
        </button>
      </div>
    </HabitFlowShell>
  );
}
