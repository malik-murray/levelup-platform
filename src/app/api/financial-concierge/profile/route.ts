import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { UserProfile } from '@/lib/financial-concierge/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/financial-concierge/profile
 * Get user's financial profile
 */
export async function GET(request: NextRequest) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // COMPREHENSIVE REQUEST LOGGING (for comparison)
    const requestUrl = request.url;
    const method = request.method;
    const host = request.headers.get('host');
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const cookieHeader = request.headers.get('cookie');
    const hasCookieHeader = !!cookieHeader;
    const cookieHeaderLength = cookieHeader?.length || 0;
    
    console.log(`[${requestId}] ===== GET /api/financial-concierge/profile - Request received =====`);
    console.log(`[${requestId}] Request URL: ${requestUrl}`);
    console.log(`[${requestId}] Method: ${method}`);
    console.log(`[${requestId}] Host: ${host}`);
    console.log(`[${requestId}] Origin: ${origin}`);
    console.log(`[${requestId}] Referer: ${referer}`);
    console.log(`[${requestId}] Cookie header exists: ${hasCookieHeader}`);
    console.log(`[${requestId}] Cookie header length: ${cookieHeaderLength}`);
    
    try {
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const cookieNames = allCookies.map(c => c.name);
        const authCookieNames = allCookies
            .filter(c => 
                c.name.includes('supabase') || 
                c.name.includes('auth') || 
                c.name.includes('sb-') ||
                c.name.startsWith('sb-')
            )
            .map(c => c.name);
        
        console.log(`[${requestId}] Total cookies from cookieStore: ${allCookies.length}`);
        console.log(`[${requestId}] All cookie names: ${cookieNames.join(', ')}`);
        console.log(`[${requestId}] Auth cookie names: ${authCookieNames.join(', ')}`);
        console.log(`[${requestId}] Supabase URL: ${supabaseUrl}`);
        console.log(`[${requestId}] Supabase anon key present: ${!!supabaseAnonKey}`);
        
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch (error) {
                        // The `set` method was called from a Server Component or API route.
                        // This can be ignored if you have middleware refreshing user sessions.
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', { ...options, maxAge: 0 });
                    } catch (error) {
                        // Same as above
                    }
                },
            },
        });

        console.log(`[${requestId}] Calling supabase.auth.getUser()...`);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        console.log(`[${requestId}] getUser() result:`, {
            hasUser: !!user,
            userId: user?.id || null,
            userEmail: user?.email || null,
            hasAuthError: !!authError,
            authErrorMessage: authError?.message || null,
            authErrorStatus: authError?.status || null,
        });
        
        if (authError || !user) {
            console.error(`[${requestId}] ===== AUTH FAILED - Returning 401 =====`);
            console.error(`[${requestId}] Auth error:`, authError);
            console.error(`[${requestId}] User:`, user);
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log(`[${requestId}] ===== AUTH SUCCESS =====`);
        console.log(`[${requestId}] User authenticated: ${user.id}`);
        console.log(`[${requestId}] User email: ${user.email}`);
        
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

        console.log(`[${requestId}] Profile fetched successfully`);
        return NextResponse.json({ profile: data as UserProfile });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch profile' },
            { status: 500 }
        );
    }
}


