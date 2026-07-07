'use client';

import AppAccessGate from '@/components/access/AppAccessGate';

export default function WeeklyPlanLayout({ children }: { children: React.ReactNode }) {
    return <AppAccessGate app="habit-weekly-plan">{children}</AppAccessGate>;
}
