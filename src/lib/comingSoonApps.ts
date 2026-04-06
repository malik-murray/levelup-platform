/**
 * Paid apps shown in the sidebar as "coming soon" until checkout is wired.
 * Replace with real entitlements (e.g. Stripe) later.
 */
export const COMING_SOON_APP_KEYS = ['finance', 'newsfeed', 'fitness', 'markets'] as const;

export type ComingSoonAppKey = (typeof COMING_SOON_APP_KEYS)[number];

export const COMING_SOON_APP_LABELS: Record<ComingSoonAppKey, string> = {
    finance: 'Finance Tracker',
    newsfeed: 'Newsfeed',
    fitness: 'Fitness Tracker',
    markets: 'Stock & Crypto Analyzer',
};

export function isComingSoonAppKey(v: string): v is ComingSoonAppKey {
    return (COMING_SOON_APP_KEYS as readonly string[]).includes(v);
}

export function comingSoonMenuHref(key: ComingSoonAppKey): string {
    return `/coming-soon?app=${key}`;
}
