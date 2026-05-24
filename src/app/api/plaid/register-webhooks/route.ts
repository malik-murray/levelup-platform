import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registerPlaidItemWebhook } from '@/lib/plaid/registerPlaidItemWebhook';
import { getPlaidWebhookUrl } from '@/lib/plaid/plaidWebhookUrl';

/**
 * POST /api/plaid/register-webhooks
 * Registers the production webhook URL on all of the user's Plaid items.
 * Use once for accounts linked before webhooks were configured.
 */
export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
        data: { user },
        error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookUrl = getPlaidWebhookUrl();
    if (!webhookUrl) {
        return NextResponse.json(
            { error: 'Server missing PLAID_WEBHOOK_URL or NEXT_PUBLIC_APP_URL' },
            { status: 503 }
        );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
    });

    const { data: items, error: itemsError } = await supabase
        .from('plaid_items')
        .select('id, item_id, institution_name, access_token')
        .eq('user_id', user.id);

    if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items?.length) {
        return NextResponse.json({ error: 'No Plaid items found' }, { status: 404 });
    }

    const results: Array<{
        plaid_item_id: string;
        item_id: string;
        institution_name: string | null;
        ok: boolean;
        error?: string;
    }> = [];

    for (const item of items) {
        const reg = await registerPlaidItemWebhook(item.access_token);
        results.push({
            plaid_item_id: item.id,
            item_id: item.item_id,
            institution_name: item.institution_name,
            ok: reg.ok,
            error: reg.error,
        });
    }

    const succeeded = results.filter(r => r.ok).length;

    return NextResponse.json({
        success: succeeded === results.length,
        webhook_url: webhookUrl,
        registered: succeeded,
        total: results.length,
        results,
        message:
            succeeded === results.length
                ? 'Automatic sync enabled for all linked banks. New transactions should sync without manual Sync.'
                : `Registered webhook on ${succeeded} of ${results.length} items. Check errors.`,
    });
}
