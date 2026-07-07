'use client';

import React from 'react';
import AppAccessGate from '@/components/access/AppAccessGate';
import AppShell from '@/components/shell/AppShell';
import FitnessBottomNav from './components/FitnessBottomNav';

export default function FitnessLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppAccessGate app="fitness">
            <AppShell title="Fitness" subtitle="Fitness & nutrition tracker" bottomNav={<FitnessBottomNav />}>
                {children}
            </AppShell>
        </AppAccessGate>
    );
}



