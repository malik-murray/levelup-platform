import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/newsfeed/preferences
 * Get user's newsfeed preferences (selected sources and topics)
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

        // Use the standard pattern: call getUser() directly (matches other API routes)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.error('No user found in preferences GET:', {
                authError: authError?.message || 'No auth error',
                authErrorCode: authError?.status,
            });
            return NextResponse.json(
                { 
                    error: 'Unauthorized', 
                    details: authError?.message || 'No user session found',
                },
                { 
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }

        const { data, error } = await supabase
            .from('newsfeed_user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found - return defaults
                return NextResponse.json({
                    preferences: {
                        selected_source_ids: [],
                        selected_topic_ids: [],
                    },
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
            }
            
            console.error('Database error fetching preferences:', {
                errorCode: error.code,
                errorMessage: error.message,
                errorDetails: error.details,
            });
            
            throw error;
        }

        return NextResponse.json({ preferences: data }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        console.error('Error fetching preferences - Unexpected exception:', {
            error: errorMessage,
            stack: errorStack,
            errorType: error?.constructor?.name || typeof error,
        });
        
        return NextResponse.json(
            { 
                error: 'Internal server error',
                details: errorMessage,
            },
            { 
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}

/**
 * POST /api/newsfeed/preferences
 * Create or update user's newsfeed preferences
 */
export async function POST(request: NextRequest) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // COMPREHENSIVE REQUEST LOGGING
    const requestUrl = request.url;
    const method = request.method;
    const host = request.headers.get('host');
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const cookieHeader = request.headers.get('cookie');
    const hasCookieHeader = !!cookieHeader;
    const cookieHeaderLength = cookieHeader?.length || 0;
    
    console.log(`[${requestId}] ===== POST /api/newsfeed/preferences - Request received =====`);
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

        // Use the standard pattern: call getUser() directly (matches other API routes)
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
            
            // Always return JSON error response
            const errorResponse = NextResponse.json(
                { 
                    error: 'Unauthorized',
                    details: authError?.message || 'No user session found',
                    hint: 'Please ensure you are logged in and try again. If the problem persists, try logging out and back in.',
                },
                { 
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
            console.log(`[${requestId}] Returning 401 Unauthorized`);
            return errorResponse;
        }
        
        console.log(`[${requestId}] ===== AUTH SUCCESS =====`);
        console.log(`[${requestId}] User authenticated: ${user.id}`);
        console.log(`[${requestId}] User email: ${user.email}`);

        let body;
        try {
            const bodyText = await request.text();
            if (!bodyText || bodyText.trim() === '') {
                console.error('Empty request body received');
                return NextResponse.json(
                    { 
                        error: 'Invalid request',
                        details: 'Request body is empty',
                    },
                    { 
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }
            
            try {
                body = JSON.parse(bodyText);
            } catch (parseError) {
                console.error('Error parsing JSON request body:', {
                    bodyText,
                    parseError: parseError instanceof Error ? parseError.message : 'Unknown',
                });
                return NextResponse.json(
                    { 
                        error: 'Invalid request',
                        details: 'Request body must be valid JSON',
                    },
                    { 
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }
        } catch (error) {
            console.error('Error reading request body:', {
                error: error instanceof Error ? error.message : 'Unknown',
                errorType: error?.constructor?.name || typeof error,
            });
            return NextResponse.json(
                { 
                    error: 'Invalid request',
                    details: 'Unable to read request body',
                },
                { 
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
        
        const { selected_source_ids, selected_topic_ids } = body;

        // Validate input
        if (!Array.isArray(selected_source_ids) || !Array.isArray(selected_topic_ids)) {
            console.error('Invalid request body:', {
                selected_source_ids: typeof selected_source_ids,
                selected_topic_ids: typeof selected_topic_ids,
                body,
            });
            
            return NextResponse.json(
                { 
                    error: 'Invalid request',
                    details: 'selected_source_ids and selected_topic_ids must be arrays',
                },
                { 
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }

        console.log(`[${requestId}] Saving preferences:`, {
            userId: user.id,
            sourceCount: selected_source_ids?.length || 0,
            topicCount: selected_topic_ids?.length || 0,
        });

        // Upsert preferences
        const { data, error } = await supabase
            .from('newsfeed_user_preferences')
            .upsert({
                user_id: user.id,
                selected_source_ids: selected_source_ids || [],
                selected_topic_ids: selected_topic_ids || [],
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            })
            .select()
            .single();

        if (error) {
            console.error(`[${requestId}] Supabase error saving preferences:`, {
                error,
                errorCode: error.code,
                errorMessage: error.message,
                errorDetails: error.details,
                userId: user.id,
                selectedSourceIds: selected_source_ids,
                selectedTopicIds: selected_topic_ids,
            });
            
            // Return a proper JSON error response
            const errorResponse = NextResponse.json(
                { 
                    error: 'Database error',
                    details: error.message || 'Failed to save preferences to database',
                    code: error.code || 'UNKNOWN',
                },
                { 
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
            console.log(`[${requestId}] Returning 500 Database Error`);
            return errorResponse;
        }

        if (!data) {
            console.error(`[${requestId}] No data returned from upsert operation`);
            const errorResponse = NextResponse.json(
                { 
                    error: 'No data returned',
                    details: 'Preferences were not saved. Please try again.',
                },
                { 
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
            console.log(`[${requestId}] Returning 500 No Data`);
            return errorResponse;
        }

        console.log(`[${requestId}] Preferences saved successfully, returning 200`);
        return NextResponse.json(
            { preferences: data },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        // Catch any unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        console.error(`[${requestId}] Error saving preferences - Unexpected exception:`, {
            error: errorMessage,
            stack: errorStack,
            errorType: error?.constructor?.name || typeof error,
        });
        
        // Always return JSON, never empty or HTML
        const errorResponse = NextResponse.json(
            { 
                error: 'Internal server error',
                details: errorMessage,
            },
            { 
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log(`[${requestId}] Returning 500 Unexpected Error`);
        return errorResponse;
    }
}





