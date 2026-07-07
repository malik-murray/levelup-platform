'use client';

import AppAccessGate from '@/components/access/AppAccessGate';

export default function NewsfeedLayout({ children }: { children: React.ReactNode }) {
    return <AppAccessGate app="newsfeed">{children}</AppAccessGate>;
}
