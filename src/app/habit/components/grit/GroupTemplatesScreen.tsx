'use client';

import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-[var(--lu-bg)] text-[var(--lu-text)] flex flex-col">
      <header className="flex items-center justify-between h-14 px-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => router.back()}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Group templates</h1>
        <div className="w-12" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <p className="text-sm text-white/60 mb-4">Pick a template to create a group. (Saving groups is coming soon.)</p>

        <ul className="space-y-2">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left min-h-[56px]"
              >
                <span className="text-2xl">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-white/60">{t.description}</p>
                </div>
                <span className="text-white/40">›</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
