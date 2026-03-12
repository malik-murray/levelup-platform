import { Suspense } from 'react';
import HabitRepeatClient from './HabitRepeatClient';

export default function HabitRepeatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--lu-bg)] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--lu-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HabitRepeatClient />
    </Suspense>
  );
}
