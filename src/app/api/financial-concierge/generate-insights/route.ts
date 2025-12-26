import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateInsights } from '@/lib/financial-concierge/insightEngine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/generate-insights
 * Generate insights and recommendations for a given month
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

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { month } = body;

        if (!month) {
            return NextResponse.json(
                { error: 'Missing required field: month (YYYY-MM format)' },
                { status: 400 }
            );
        }

        const result = await generateInsights({
            userId: user.id,
            month,
        });

        return NextResponse.json({
            success: true,
            insights: result.insights,
            recommendations: result.recommendations,
            message: `Generated ${result.insights.length} insights and ${result.recommendations.length} recommendations`,
        });
    } catch (error) {
        console.error('Error generating insights:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate insights' },
            { status: 500 }
        );
    }
}


