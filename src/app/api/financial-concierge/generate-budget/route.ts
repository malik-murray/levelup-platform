import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateBudgetPlan } from '@/lib/financial-concierge/budgetEngine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/generate-budget
 * Generate a budget plan for a given month
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
        const { month, source_data_days } = body;

        if (!month) {
            return NextResponse.json(
                { error: 'Missing required field: month (YYYY-MM format)' },
                { status: 400 }
            );
        }

        const budgetPlan = await generateBudgetPlan({
            userId: user.id,
            month,
            sourceDataDays: source_data_days || 90,
        });

        return NextResponse.json({
            success: true,
            budget_plan: budgetPlan,
            message: 'Budget plan generated successfully',
        });
    } catch (error) {
        console.error('Error generating budget:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate budget' },
            { status: 500 }
        );
    }
}

