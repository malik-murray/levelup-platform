import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { learnMerchantMappingFromUserCategory } from '@/lib/financial-concierge/categoryEngine';
import { verifyNotificationActionToken } from '@/lib/push/notificationActionToken';

/**
 * One-tap categorize from a notification action button (service worker, no app UI).
 */
export async function POST(request: NextRequest) {
    const body = (await request.json()) as {
        transactionId?: string;
        categoryId?: string;
        token?: string;
    };

    if (!body.transactionId || !body.categoryId) {
        return NextResponse.json({ error: 'transactionId and categoryId required' }, { status: 400 });
    }

    let userId: string | null = null;

    if (body.token) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set() {},
                    remove() {},
                },
            }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const valid = await verifyNotificationActionToken(body.token, {
                userId: user.id,
                transactionId: body.transactionId,
            });
            if (valid) userId = user.id;
        }
    }

    if (!userId && body.token) {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
            const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
                auth: { persistSession: false },
            });
            const { data: tx } = await admin
                .from('transactions')
                .select('user_id')
                .eq('id', body.transactionId)
                .maybeSingle();
            if (tx?.user_id) {
                const valid = await verifyNotificationActionToken(body.token, {
                    userId: tx.user_id as string,
                    transactionId: body.transactionId,
                });
                if (valid) userId = tx.user_id as string;
            }
        }
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { persistSession: false },
    });

    const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('id, name, note')
        .eq('id', body.transactionId)
        .eq('user_id', userId)
        .maybeSingle();

    if (txError || !tx) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const { data: category } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', body.categoryId)
        .eq('user_id', userId)
        .maybeSingle();

    if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
        .from('transactions')
        .update({
            category_id: body.categoryId,
            categorization_method: 'user_override',
        })
        .eq('id', body.transactionId)
        .eq('user_id', userId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await learnMerchantMappingFromUserCategory(supabase, {
        userId,
        categoryId: body.categoryId,
        name: tx.name,
        note: tx.note,
    });

    return NextResponse.json({
        ok: true,
        categoryName: category.name,
    });
}
