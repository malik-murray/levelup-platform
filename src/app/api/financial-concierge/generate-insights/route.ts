import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

