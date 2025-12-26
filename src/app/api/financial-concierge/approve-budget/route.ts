import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/approve-budget
 * Approve a budget plan (acknowledges user review)
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
        const { budget_plan_id } = body;

        if (!budget_plan_id) {
            return NextResponse.json(
                { error: 'Missing required field: budget_plan_id' },
                { status: 400 }
            );
        }

        // Verify budget plan belongs to user
        const { data: budgetPlan, error: planError } = await supabase
            .from('budget_plans')
            .select('*')
            .eq('id', budget_plan_id)
            .eq('user_id', user.id)
            .single();

        if (planError || !budgetPlan) {
            return NextResponse.json(
                { error: 'Budget plan not found' },
                { status: 404 }
            );
        }

        // For now, we just log the approval in metadata
        // In the future, we could add an approved_at timestamp column
        const { error: updateError } = await supabase
            .from('budget_plans')
            .update({
                metadata: {
                    ...(budgetPlan.metadata || {}),
                    approved_at: new Date().toISOString(),
                    approved_by: user.id,
                },
            })
            .eq('id', budget_plan_id);

        if (updateError) {
            throw updateError;
        }

        // Log audit event
        await supabase.from('financial_audit_log').insert({
            user_id: user.id,
            action_type: 'budget_generation',
            action_details: {
                budget_plan_id,
                action: 'approved',
            },
            resource_type: 'budget_plan',
            resource_id: budget_plan_id,
        });

        return NextResponse.json({
            success: true,
            message: 'Budget plan approved',
        });
    } catch (error) {
        console.error('Error approving budget:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to approve budget' },
            { status: 500 }
        );
    }
}


