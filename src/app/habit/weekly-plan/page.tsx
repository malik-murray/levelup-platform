import { Suspense } from 'react';
import HabitWeeklyPlanLayout from '../components/HabitWeeklyPlanLayout';

export default function WeeklyPlanPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </main>
            }
        >
            <HabitWeeklyPlanLayout />
        </Suspense>
    );
}
