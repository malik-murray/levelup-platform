import { Suspense } from 'react';
import HabitGroupsClient from './HabitGroupsClient';

export default function HabitGroupsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--lu-bg)] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HabitGroupsClient />
    </Suspense>
  );
}
