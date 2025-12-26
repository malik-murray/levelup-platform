import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/confirm-category-rule
 * Confirm or reject an auto-detected category rule
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
        const { rule_id, confirmed } = body;

        if (!rule_id || confirmed === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: rule_id, confirmed' },
                { status: 400 }
            );
        }

        // Verify rule belongs to user (or is global)
        const { data: rule, error: ruleError } = await supabase
            .from('category_rules')
            .select('*')
            .eq('id', rule_id)
            .or(`user_id.eq.${user.id},user_id.is.null`)
            .single();

        if (ruleError || !rule) {
            return NextResponse.json(
                { error: 'Category rule not found' },
                { status: 404 }
            );
        }

        // If user confirms, activate the rule; if rejects, deactivate or delete
        if (confirmed) {
            const { error: updateError } = await supabase
                .from('category_rules')
                .update({ active: true })
                .eq('id', rule_id);

            if (updateError) throw updateError;
        } else {
            // If user-specific rule, delete it; if global, just deactivate
            if (rule.user_id === user.id) {
                const { error: deleteError } = await supabase
                    .from('category_rules')
                    .delete()
                    .eq('id', rule_id);

                if (deleteError) throw deleteError;
            } else {
                // Global rule - user can't delete, but can deactivate for themselves
                // For now, we'll just skip it (user can ignore it)
                // In the future, we could create a user override table
            }
        }

        return NextResponse.json({
            success: true,
            message: confirmed ? 'Category rule confirmed' : 'Category rule rejected',
        });
    } catch (error) {
        console.error('Error confirming category rule:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to confirm category rule' },
            { status: 500 }
        );
    }
}

