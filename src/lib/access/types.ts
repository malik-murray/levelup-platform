export type AccessTier = 'guest' | 'free' | 'full';

export type AppKey =
    | 'dashboard'
    | 'habit'
    | 'habit-weekly-plan'
    | 'finance'
    | 'fitness'
    | 'newsfeed'
    | 'trends'
    | 'todo'
    | 'goals'
    | 'settings'
    | 'markets'
    | 'home-search';

export type DashboardFeature = 'habits' | 'daily-notes' | 'newsfeed' | 'finance' | 'fitness';

export type UserAccess = {
    tier: AccessTier;
    email: string | null;
    userId: string | null;
};
