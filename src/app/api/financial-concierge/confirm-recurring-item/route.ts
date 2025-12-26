import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/confirm-recurring-item
 * Confirm a detected recurring item (subscription/bill)
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
        const { recurring_item_id, confirmed } = body;

        if (!recurring_item_id || confirmed === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: recurring_item_id, confirmed' },
                { status: 400 }
            );
        }

        // Verify recurring item belongs to user
        const { data: recurringItem, error: itemError } = await supabase
            .from('recurring_items')
            .select('*')
            .eq('id', recurring_item_id)
            .eq('user_id', user.id)
            .single();

        if (itemError || !recurringItem) {
            return NextResponse.json(
                { error: 'Recurring item not found' },
                { status: 404 }
            );
        }

        // Update confirmation status
        const { error: updateError } = await supabase
            .from('recurring_items')
            .update({
                confirmed_by_user: confirmed,
                active: confirmed, // If confirmed, keep active; if rejected, deactivate
            })
            .eq('id', recurring_item_id);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({
            success: true,
            message: confirmed ? 'Recurring item confirmed' : 'Recurring item rejected',
        });
    } catch (error) {
        console.error('Error confirming recurring item:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to confirm recurring item' },
            { status: 500 }
        );
    }
}

