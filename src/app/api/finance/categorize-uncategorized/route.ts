import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    categorizeTransaction,
    loadCategorizationContext,
    loadPeerMerchantCategoryMap,
    merchantKeyFromNameNote,
} from '@/lib/financial-concierge/categoryEngine';

/** Allow long batch runs on Vercel (adjust plan limits as needed). */
export const maxDuration = 120;

/**
 * POST /api/finance/categorize-uncategorized
 * Runs the category engine on existing rows that are uncategorized or in Needs Review (backfill).
 * Also uses your already-categorized transactions with the same description (normalized) so a few
 * manual fixes propagate to identical labels in the batch.
 *
 * Body (optional JSON):
 * - limit: max rows to process (default 300, max 2000)
 * - plaid_only: if true, only rows where synced_from_plaid = true
 * - include_needs_review: when true, also recategorize rows currently in Needs Review
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

    let body: {
        limit?: number;
        plaid_only?: boolean;
        fallback_to_needs_review?: boolean;
        include_needs_review?: boolean;
    } = {};
    try {
        body = await request.json();
    } catch {
        body = {};
    }

    const limit = Math.min(Math.max(Number(body.limit) || 300, 1), 2000);
    const plaidOnly = Boolean(body.plaid_only);
    const fallbackToNeedsReview = body.fallback_to_needs_review ?? !plaidOnly;
    const includeNeedsReview = body.include_needs_review ?? !plaidOnly;
    const contextCache = await loadCategorizationContext(supabase, user.id);
    const needsReviewId = contextCache.categoryLeafNameToId.get('needs review');
    const peerMerchantKeyToCategory = await loadPeerMerchantCategoryMap(supabase, user.id, {
        excludeCategoryId: needsReviewId,
        maxRows: 12_000,
    });

    let query = supabase
        .from('transactions')
        .select('id, name, note, amount, date, category_id, plaid_personal_finance_category')
        .eq('user_id', user.id)
        .eq('is_transfer', false)
        .order('date', { ascending: false })
        .limit(limit);

    if (includeNeedsReview && needsReviewId) {
        query = query.or(`category_id.is.null,category_id.eq.${needsReviewId}`);
    } else {
        query = query.is('category_id', null);
    }

    if (plaidOnly) {
        query = query.eq('synced_from_plaid', true);
    }

    const { data: rows, error } = await query;

    if (error) {
        console.error('categorize-uncategorized query:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = rows || [];
    const missingPlaidPfc = plaidOnly
        ? list.filter(r => r.plaid_personal_finance_category == null).length
        : 0;
    let categorized = 0;
    let fallbackCategorized = 0;
    const unresolvedIds: string[] = [];
    const rowsInNeedsReview = needsReviewId
        ? list.filter(r => (r as { category_id?: string | null }).category_id === needsReviewId).length
        : 0;

    for (const row of list) {
        const pfc = row.plaid_personal_finance_category as
            | {
                  primary?: string | null;
                  detailed?: string | null;
                  confidence_level?: string | null;
              }
            | null
            | undefined;

        const result = await categorizeTransaction(
            {
                id: row.id,
                name: row.name,
                note: row.note,
                amount: Number(row.amount),
                date: row.date,
                plaid_personal_finance_category: pfc ?? null,
            },
            {
                supabase,
                userId: user.id,
                persistToTransaction: true,
                enableML: false,
                contextCache,
                peerMerchantKeyToCategory,
            }
        );
        if (result) {
            categorized++;
            const k = merchantKeyFromNameNote(
                row.name as string | null,
                row.note as string | null
            );
            if (k) {
                peerMerchantKeyToCategory.set(k, result.category_id);
            }
        } else {
            unresolvedIds.push(row.id);
        }
    }

    if (fallbackToNeedsReview && unresolvedIds.length > 0) {
        if (needsReviewId) {
            const { error: fallbackError } = await supabase
                .from('transactions')
                .update({
                    category_id: needsReviewId,
                    categorization_method: 'manual',
                    categorization_confidence: 0.4,
                    categorization_rule_id: null,
                    categorization_merchant_mapping_id: null,
                })
                .eq('user_id', user.id)
                .in('id', unresolvedIds);

            if (!fallbackError) {
                fallbackCategorized = unresolvedIds.length;
                categorized += fallbackCategorized;
            } else {
                console.warn('categorize-uncategorized fallback:', fallbackError);
            }
        }
    }

    const hint =
        categorized === 0 && list.length > 0
            ? plaidOnly
                ? missingPlaidPfc === list.length
                    ? 'None of these rows have Plaid category metadata stored yet. Run a bank sync once (connected account → Sync) so we can save Plaid labels, then run this again.'
                    : 'Plaid labels are present but did not match your category list. Ensure seeded financial categories exist, or add merchant/category rules.'
                : 'No rules/mappings/recurring matches were found in this batch. Add a few merchant mappings or run Plaid sync to store labels.'
            : fallbackCategorized > 0
                ? `Auto-routed ${fallbackCategorized} unmatched transactions to Needs Review.`
                : undefined;

    return NextResponse.json({
        scanned: list.length,
        categorized,
        still_uncategorized: list.length - categorized,
        plaid_only: plaidOnly,
        limit,
        include_needs_review: includeNeedsReview,
        fallback_to_needs_review: fallbackToNeedsReview,
        fallback_categorized: fallbackCategorized,
        diagnostics: {
            merchant_mappings: contextCache.merchantMappings.length,
            category_rules: contextCache.categoryRules.length,
            recurring_items_with_category: contextCache.recurringWithCategory.length,
            rows_with_plaid_pfc: list.filter(r => r.plaid_personal_finance_category != null).length,
            rows_in_needs_review: rowsInNeedsReview,
            peer_label_categories: peerMerchantKeyToCategory.size,
        },
        missing_plaid_personal_finance_category: plaidOnly ? missingPlaidPfc : undefined,
        hint,
    });
}
