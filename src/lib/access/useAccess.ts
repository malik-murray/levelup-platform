'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { canAccessApp, canUseDashboardFeature } from './entitlements';
import type { AccessTier, AppKey, DashboardFeature, UserAccess } from './types';

function isGuestPath(pathname: string | null): boolean {
    return Boolean(pathname?.startsWith('/guest') || pathname?.startsWith('/preview'));
}

export function useAccess(): UserAccess & {
    loading: boolean;
    isGuest: boolean;
    isFull: boolean;
    canAccessApp: (app: AppKey) => boolean;
    canUseDashboardFeature: (feature: DashboardFeature) => boolean;
} {
    const pathname = usePathname();
    const guestRoute = isGuestPath(pathname);
    const [loading, setLoading] = useState(!guestRoute);
    const [access, setAccess] = useState<UserAccess>({
        tier: guestRoute ? 'guest' : 'free',
        email: null,
        userId: null,
    });

    useEffect(() => {
        if (guestRoute) {
            setAccess({ tier: 'guest', email: null, userId: null });
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                const res = await fetch('/api/access/me', { credentials: 'include' });
                if (!res.ok) throw new Error(`access check failed: ${res.status}`);
                const data = (await res.json()) as UserAccess;

                if (!cancelled) {
                    setAccess({
                        tier: data.tier ?? 'guest',
                        email: data.email ?? null,
                        userId: data.userId ?? null,
                    });
                }
            } catch (err) {
                console.error('[useAccess]', err);
                if (!cancelled) {
                    setAccess({ tier: 'guest', email: null, userId: null });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [guestRoute]);

    const tier = access.tier;

    return {
        ...access,
        loading,
        isGuest: tier === 'guest',
        isFull: tier === 'full',
        canAccessApp: (app: AppKey) => canAccessApp(tier, app),
        canUseDashboardFeature: (feature: DashboardFeature) => canUseDashboardFeature(tier, feature),
    };
}
