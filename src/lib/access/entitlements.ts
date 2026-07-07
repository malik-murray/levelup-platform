import type { AccessTier, AppKey, DashboardFeature } from './types';

const FULL_TIER_APPS: AppKey[] = [
    'dashboard',
    'habit',
    'habit-weekly-plan',
    'finance',
    'fitness',
    'newsfeed',
    'trends',
    'todo',
    'goals',
    'settings',
    'markets',
];

const FREE_TIER_APPS: AppKey[] = ['dashboard', 'habit', 'settings'];

const FREE_DASHBOARD_FEATURES: DashboardFeature[] = ['habits', 'daily-notes'];

export function canAccessApp(tier: AccessTier, app: AppKey): boolean {
    if (tier === 'full') return true;
    if (tier === 'guest' || tier === 'free') {
        return FREE_TIER_APPS.includes(app);
    }
    return false;
}

export function canUseDashboardFeature(tier: AccessTier, feature: DashboardFeature): boolean {
    if (tier === 'full') return true;
    if (tier === 'guest' || tier === 'free') {
        return FREE_DASHBOARD_FEATURES.includes(feature);
    }
    return false;
}

export function listAppsForTier(tier: AccessTier): AppKey[] {
    if (tier === 'full') return FULL_TIER_APPS;
    return FREE_TIER_APPS;
}

export function appKeyFromPath(pathname: string): AppKey | null {
    if (pathname === '/dashboard' || pathname.startsWith('/guest/dashboard')) return 'dashboard';
    if (pathname.startsWith('/habit/weekly-plan') || pathname.startsWith('/guest/habit/weekly-plan'))
        return 'habit-weekly-plan';
    if (pathname.startsWith('/habit') || pathname.startsWith('/guest/habit')) return 'habit';
    if (pathname.startsWith('/finance')) return 'finance';
    if (pathname.startsWith('/fitness')) return 'fitness';
    if (pathname.startsWith('/newsfeed')) return 'newsfeed';
    if (pathname.startsWith('/trends')) return 'trends';
    if (pathname.startsWith('/todo')) return 'todo';
    if (pathname.startsWith('/goals')) return 'goals';
    if (pathname.startsWith('/settings')) return 'settings';
    if (pathname.startsWith('/markets')) return 'markets';
    return null;
}

export const LOCKED_APP_LABELS: Record<Exclude<AppKey, 'dashboard' | 'habit' | 'settings'>, string> = {
    'habit-weekly-plan': 'Weekly plan',
    finance: 'Finance Tracker',
    fitness: 'Fitness Tracker',
    newsfeed: 'Newsfeed',
    trends: 'Trends',
    todo: 'To-Do & Masterlog',
    goals: 'Goals & Vision',
    markets: 'Stock & Crypto Analyzer',
};
