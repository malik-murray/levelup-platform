'use client';

import AppAccessGate from '@/components/access/AppAccessGate';

export default function GoalsLayout({ children }: { children: React.ReactNode }) {
    return <AppAccessGate app="goals">{children}</AppAccessGate>;
}
