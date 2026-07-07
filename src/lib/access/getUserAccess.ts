import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isFullAccessEmail } from './config';
import type { AccessTier, UserAccess } from './types';

export async function resolveAccessTierForUser(
    user: Pick<User, 'id' | 'email'> | null,
    supabase?: SupabaseClient
): Promise<AccessTier> {
    if (!user) return 'guest';

    if (isFullAccessEmail(user.email)) {
        return 'full';
    }

    if (!supabase) return 'free';

    const { data, error } = await supabase
        .from('user_app_access')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.warn('[access] failed to load user_app_access:', error.message);
        return 'free';
    }

    if (!data) {
        await supabase.from('user_app_access').upsert(
            { user_id: user.id, tier: 'free' },
            { onConflict: 'user_id' }
        );
        return 'free';
    }

    return data.tier === 'full' ? 'full' : 'free';
}

export async function getUserAccess(
    user: Pick<User, 'id' | 'email'> | null,
    supabase?: SupabaseClient
): Promise<UserAccess> {
    const tier = await resolveAccessTierForUser(user, supabase);
    return {
        tier,
        email: user?.email ?? null,
        userId: user?.id ?? null,
    };
}
