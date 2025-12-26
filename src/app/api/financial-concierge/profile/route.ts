import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { UserProfile } from '@/lib/financial-concierge/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/financial-concierge/profile
 * Get user's financial profile
 */
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { data, error } = await supabase
            .from('user_profile')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found
                return NextResponse.json({ profile: null });
            }
            throw error;
        }

        return NextResponse.json({ profile: data as UserProfile });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch profile' },
            { status: 500 }
        );
    }
}

