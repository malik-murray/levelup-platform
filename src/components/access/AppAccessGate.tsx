'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccess } from '@/lib/access/useAccess';
import { appKeyFromPath } from '@/lib/access/entitlements';
import type { AppKey } from '@/lib/access/types';

export default function AppAccessGate({
    app,
    children,
}: {
    app: AppKey;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { loading, canAccessApp } = useAccess();

    useEffect(() => {
        if (loading) return;
        if (canAccessApp(app)) return;
        const detected = appKeyFromPath(pathname ?? '');
        const upgradeUrl = `/upgrade?app=${detected ?? app}`;
        router.replace(upgradeUrl);
    }, [loading, canAccessApp, app, router, pathname]);

    if (loading) {
        return (
            <main className="flex min-h-dvh items-center justify-center bg-[#010205] text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ff9d00] border-t-transparent" />
                    <p className="text-sm text-slate-400">Loading…</p>
                </div>
            </main>
        );
    }

    if (!canAccessApp(app)) {
        return null;
    }

    return <>{children}</>;
}
