import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    learnMerchantMappingFromUserCategory,
    merchantKeyFromNameNote,
} from '@/lib/financial-concierge/categoryEngine';

export const maxDuration = 60;

type Body = {
    category_id?: string;
    name?: string | null;
    note?: string | null;
};

/**
 * POST /api/finance/apply-category-to-matching
 * Sets the same category on all non-transfer transactions for this user whose normalized
 * name+note key matches the anchor (same rule as merchant mappings / peer categorization).
 */
export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` },
        },
        auth: { persistSession: false },
    });

    let body: Body = {};
    try {
        body = await request.json();
    } catch {
        body = {};
    }

    const categoryId = body.category_id;
    if (!categoryId || typeof categoryId !== 'string') {
        return NextResponse.json({ error: 'category_id is required' }, { status: 400 });
    }

    const { data: categoryRow, error: catErr } = await supabase
        .from('categories')
        .select('id, user_id')
        .eq('id', categoryId)
        .eq('kind', 'category')
        .maybeSingle();

    if (catErr || !categoryRow) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    if (categoryRow.user_id != null && categoryRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const anchorKey = merchantKeyFromNameNote(body.name ?? null, body.note ?? null);
    if (!anchorKey) {
        return NextResponse.json(
            { matched: 0, updated: 0, skipped: true, reason: 'empty_description_key' },
            { status: 200 }
        );
    }

    const PAGE = 800;
    const matching: { id: string; category_id: string | null }[] = [];
    let offset = 0;

    for (;;) {
        const { data: page, error: pageErr } = await supabase
            .from('transactions')
            .select('id, name, note, category_id')
            .eq('user_id', user.id)
            .eq('is_transfer', false)
            .order('date', { ascending: false })
            .range(offset, offset + PAGE - 1);

        if (pageErr) {
            console.error('apply-category-to-matching page:', pageErr);
            return NextResponse.json({ error: pageErr.message }, { status: 500 });
        }
        if (!page?.length) break;

        for (const row of page) {
            const k = merchantKeyFromNameNote(row.name as string | null, row.note as string | null);
            if (k === anchorKey) {
                matching.push({ id: row.id as string, category_id: (row.category_id as string | null) ?? null });
            }
        }

        if (page.length < PAGE) break;
        offset += PAGE;
    }

    const idsToTouch = matching.filter(m => m.category_id !== categoryId).map(m => m.id);

    const CHUNK = 150;
    for (let i = 0; i < idsToTouch.length; i += CHUNK) {
        const chunk = idsToTouch.slice(i, i + CHUNK);
        const { error: upErr } = await supabase
            .from('transactions')
            .update({
                category_id: categoryId,
                categorization_method: 'user_override',
                categorization_confidence: 0.95,
                categorization_rule_id: null,
                categorization_merchant_mapping_id: null,
            })
            .eq('user_id', user.id)
            .in('id', chunk);

        if (upErr) {
            console.error('apply-category-to-matching update:', upErr);
            return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
    }

    await learnMerchantMappingFromUserCategory(supabase, {
        userId: user.id,
        categoryId,
        name: body.name ?? null,
        note: body.note ?? null,
    });

    return NextResponse.json({
        matched: matching.length,
        updated: idsToTouch.length,
        anchor_key: anchorKey,
    });
}
