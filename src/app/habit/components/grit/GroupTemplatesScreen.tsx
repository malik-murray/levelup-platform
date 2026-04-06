'use client';

import { useRouter } from 'next/navigation';
import { HabitFlowShell } from '../HabitFlowShell';
import { neon } from '@/app/dashboard/neonTheme';

const TEMPLATES = [
  { id: 'morning', name: 'Morning', icon: '🌅', description: 'Start your day' },
  { id: 'afternoon', name: 'Afternoon', icon: '☀️', description: 'Midday habits' },
  { id: 'evening', name: 'Evening', icon: '🌆', description: 'Wind down' },
  { id: 'night', name: 'Night', icon: '🌙', description: 'Before bed' },
  { id: 'health', name: 'Health', icon: '💪', description: 'Fitness & wellness' },
  { id: 'mindfulness', name: 'Mindfulness', icon: '🧘', description: 'Meditation & focus' },
  { id: 'work', name: 'Work', icon: '💼', description: 'Professional tasks' },
  { id: 'personal', name: 'Personal', icon: '👤', description: 'Self-care & growth' },
];

export function GroupTemplatesScreen() {
  const router = useRouter();

  return (
    <HabitFlowShell title="Group templates" onBack={() => router.back()}>
      <p className="mb-4 text-sm text-slate-400">
        Pick a template to create a group. (Saving groups is coming soon.)
      </p>

      <ul className="space-y-2">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`${neon.section} flex min-h-[56px] w-full items-center gap-4 p-4 text-left transition hover:border-[#ff9d00]/50 hover:bg-[#ff9d00]/5`}
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{t.name}</p>
                <p className="text-sm text-slate-400">{t.description}</p>
              </div>
              <span className="text-[#ff9d00]/50">›</span>
            </button>
          </li>
        ))}
      </ul>
    </HabitFlowShell>
  );
}
