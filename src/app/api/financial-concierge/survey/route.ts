import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { UserSurveyInput, UserSurvey } from '@/lib/financial-concierge/types';
import { createOrUpdateUserProfile } from '@/lib/financial-concierge/userProfileService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/financial-concierge/survey
 * Get user's survey responses
 */
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
            .from('user_survey')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Not found
                return NextResponse.json({ survey: null });
            }
            throw error;
        }

        return NextResponse.json({ survey: data as UserSurvey });
    } catch (error) {
        console.error('Error fetching survey:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch survey' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/financial-concierge/survey
 * Create or update user's survey responses
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        
        // Check for Authorization header as fallback
        const authHeader = request.headers.get('authorization');
        let accessToken: string | null = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.replace('Bearer ', '');
        }
        
        // Create supabase client with cookies
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        });

        // Try to get user and session - prefer token if provided, otherwise use cookies
        let user;
        let authError;
        let sessionToken: string | null = null;
        
        if (accessToken) {
            // Verify the token directly
            const result = await supabase.auth.getUser(accessToken);
            user = result.data.user;
            authError = result.error;
            sessionToken = accessToken;
        } else {
            // Try to get from cookies
            const sessionResult = await supabase.auth.getSession();
            if (sessionResult.data.session) {
                user = sessionResult.data.session.user;
                sessionToken = sessionResult.data.session.access_token;
            } else {
                const userResult = await supabase.auth.getUser();
                user = userResult.data.user;
                authError = userResult.error;
            }
        }

        if (authError || !user || !sessionToken) {
            console.error('Auth error in survey POST:', {
                error: authError,
                hasToken: !!accessToken,
                hasSessionToken: !!sessionToken,
                cookieCount: cookieStore.getAll().length,
            });
            return NextResponse.json(
                { error: 'Unauthorized - please log in to complete the survey' },
                { status: 401 }
            );
        }

        // Create an authenticated client that uses the session token for all requests
        // This ensures RLS policies can see auth.uid() correctly
        const { createClient } = await import('@supabase/supabase-js');
        const authenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${sessionToken}`,
                },
            },
        });

        const body: UserSurveyInput = await request.json();

        // Validate required fields
        if (!body.risk_tolerance || !body.income_stability || !body.household_size) {
            return NextResponse.json(
                { error: 'Missing required fields: risk_tolerance, income_stability, household_size' },
                { status: 400 }
            );
        }

        // Check if survey exists (use authenticated client)
        const { data: existingSurvey, error: checkError } = await authenticatedSupabase
            .from('user_survey')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle instead of single to handle not found gracefully

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 is "not found" which is fine, but other errors are not
            console.error('Error checking for existing survey:', checkError);
            throw checkError;
        }

        const surveyData = {
            user_id: user.id,
            goal_debt_payoff: body.goal_debt_payoff ?? false,
            goal_saving: body.goal_saving ?? false,
            goal_investing: body.goal_investing ?? false,
            goal_spend_control: body.goal_spend_control ?? false,
            goal_rebuild_credit: body.goal_rebuild_credit ?? false,
            goal_buy_house: body.goal_buy_house ?? false,
            goal_buy_car: body.goal_buy_car ?? false,
            risk_tolerance: body.risk_tolerance,
            income_stability: body.income_stability,
            household_size: body.household_size ?? 1,
            target_savings_amount: body.target_savings_amount ?? null,
            target_savings_timeline_months: body.target_savings_timeline_months ?? null,
            debt_details: body.debt_details ?? [],
            debt_payoff_strategy: body.debt_payoff_strategy ?? null,
        };

        let survey: UserSurvey;

        if (existingSurvey) {
            // Update existing survey (use authenticated client)
            const { data, error } = await authenticatedSupabase
                .from('user_survey')
                .update(surveyData)
                .eq('id', existingSurvey.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating survey:', error);
                console.error('Survey data:', surveyData);
                console.error('Using authenticated client:', !!sessionToken);
                throw error;
            }
            survey = data as UserSurvey;
        } else {
            // Create new survey (use authenticated client)
            const { data, error } = await authenticatedSupabase
                .from('user_survey')
                .insert(surveyData)
                .select()
                .single();

            if (error) {
                console.error('Error inserting survey:', error);
                console.error('Survey data:', surveyData);
                console.error('User ID:', user.id);
                console.error('Using authenticated client:', !!sessionToken);
                throw error;
            }
            survey = data as UserSurvey;
        }

        // Create or update user profile based on survey
        // Pass the authenticated supabase client to ensure RLS policies work
        let profile;
        try {
            profile = await createOrUpdateUserProfile(user.id, survey, authenticatedSupabase);
        } catch (profileError) {
            console.error('Error creating/updating profile:', profileError);
            // Don't fail the survey save if profile creation fails
            // The profile can be created later
        }

        return NextResponse.json({
            survey,
            profile,
            message: 'Survey saved successfully',
        });
    } catch (error) {
        console.error('Error saving survey:', error);
        
        // Extract more details from the error
        let errorMessage = 'Failed to save survey';
        let errorDetails: any = {};
        
        if (error instanceof Error) {
            errorMessage = error.message;
            errorDetails.message = error.message;
            errorDetails.stack = error.stack;
        }
        
        // If it's a Supabase error, extract details
        if (error && typeof error === 'object' && 'code' in error) {
            errorDetails.code = (error as any).code;
            errorDetails.details = (error as any).details;
            errorDetails.hint = (error as any).hint;
            errorMessage = `${errorMessage} (${(error as any).code || 'unknown'})`;
        }
        
        console.error('Error details:', errorDetails);
        
        return NextResponse.json(
            { 
                error: errorMessage,
                details: errorDetails,
            },
            { status: 500 }
        );
    }
}

