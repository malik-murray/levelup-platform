'use client';

import AppAccessGate from '@/components/access/AppAccessGate';

export default function TrendsLayout({ children }: { children: React.ReactNode }) {
    return <AppAccessGate app="trends">{children}</AppAccessGate>;
}
