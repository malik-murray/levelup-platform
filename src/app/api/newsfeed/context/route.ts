import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/newsfeed/context
 * Get user's "About Me" context for personal relevance
 */
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch (error) {
                        // Ignore cookie set errors in API routes
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', { ...options, maxAge: 0 });
                    } catch (error) {
                        // Ignore cookie remove errors
                    }
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
            .from('newsfeed_user_context')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found - return defaults
                return NextResponse.json({
                    context: {
                        role_job_context: null,
                        interests: [],
                        goals: [],
                    },
                });
            }
            throw error;
        }

        return NextResponse.json({ context: data });
    } catch (error) {
        console.error('Error fetching context:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch context' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/newsfeed/context
 * Create or update user's "About Me" context
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch (error) {
                        // Ignore cookie set errors in API routes
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', { ...options, maxAge: 0 });
                    } catch (error) {
                        // Ignore cookie remove errors
                    }
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

        const body = await request.json();
        const { role_job_context, interests, goals } = body;

        // Upsert context
        const { data, error } = await supabase
            .from('newsfeed_user_context')
            .upsert({
                user_id: user.id,
                role_job_context: role_job_context || null,
                interests: interests || [],
                goals: goals || [],
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ context: data });
    } catch (error) {
        console.error('Error saving context:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save context' },
            { status: 500 }
        );
    }
}





