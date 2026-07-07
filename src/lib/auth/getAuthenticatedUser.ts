import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function getAuthenticatedUser(request?: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = request?.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        const {
            data: { user },
            error,
        } = await authClient.auth.getUser(token);

        if (error || !user) return null;

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
        });

        return { user, supabase, accessToken: token };
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: Record<string, unknown>) {
                try {
                    cookieStore.set(name, value, options);
                } catch {
                    // Called from a Server Component — ignore
                }
            },
            remove(name: string, options: Record<string, unknown>) {
                try {
                    cookieStore.set(name, '', options);
                } catch {
                    // Called from a Server Component — ignore
                }
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    return { user, supabase, accessToken: null };
}

export function getServiceRoleSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    return createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });
}
