import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export async function getUserFromBearer(authHeader: string | null): Promise<User | null> {
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
        data: { user },
        error,
    } = await authClient.auth.getUser(token);

    if (error || !user) return null;
    return user;
}

export function supabaseForUser(token: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
    });
}
