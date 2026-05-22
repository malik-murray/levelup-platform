/**
 * CategoryEngine - Categorizes transactions using rules, merchant mappings, and optional ML
 * Priority: Merchant mappings > same-label peer history > Recurring items (with category) > Category rules > Plaid PFC > ML (if enabled)
 *
 * All DB access uses the caller's `supabase` client (browser session or service role).
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    CategorizationResult,
    MerchantMapping,
    CategoryRule,
} from './types';
import { leafCategoryNameFromPlaidPfc } from './plaidPfcToLeafCategoryName';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface TransactionToCategorize {
    id?: string;
    name: string | null;
    note: string | null;
    amount: number;
    date: string;
    mcc_code?: number | null;
    /** When present (e.g. recurring detection), used to infer recurring_items.category_id */
    category_id?: string | null;
    /** From `transactions.plaid_personal_finance_category` or live Plaid payload */
    plaid_personal_finance_category?: {
        primary?: string | null;
        detailed?: string | null;
        confidence_level?: string | null;
    } | null;
}

export type RecurringItemCategoryRow = {
    id: string;
    merchant_name: string;
    category_id: string;
};

export type CategorizationContextCache = {
    merchantMappings: MerchantMapping[];
    categoryRules: CategoryRule[];
    recurringWithCategory: RecurringItemCategoryRow[];
    /** Lowercased leaf `categories.name` → id (user rows override global for same name). */
    categoryLeafNameToId: Map<string, string>;
};

export interface CategorizationOptions {
    userId: string;
    supabase: SupabaseClient;
    enableML?: boolean;
    /** When true (default), writes category to `transactions` when `transaction.id` is present. */
    persistToTransaction?: boolean;
    /**
     * When set (e.g. bulk backfill), mappings/rules/recurring are read once per batch instead of per transaction.
     * In-memory counters on cached rows are bumped after each match so usage_count / match_count stay consistent.
     */
    contextCache?: CategorizationContextCache;
    /**
     * Optional map: normalized name+note key → category_id from this user's already-categorized rows.
     * Used by backfill so recent manual fixes apply to identical descriptions without relying only on merchant_mappings.
     * The caller may mutate this map between rows (e.g. add entries as the batch categorizes).
     */
    peerMerchantKeyToCategory?: Map<string, string>;
}

/**
 * Load merchant mappings, rules, and recurring items once for batch categorization.
 */
export async function loadCategorizationContext(
    supabase: SupabaseClient,
    userId: string
): Promise<CategorizationContextCache> {
    const [merchantMappings, categoryRules, recurringRes, catRes] = await Promise.all([
        getMerchantMappings(supabase, userId),
        getCategoryRules(supabase, userId),
        supabase
            .from('recurring_items')
            .select('id, merchant_name, category_id')
            .eq('user_id', userId)
            .eq('active', true)
            .not('category_id', 'is', null),
        supabase
            .from('categories')
            .select('id, name, user_id')
            .eq('kind', 'category')
            .eq('is_archived', false)
            .or(`user_id.eq.${userId},user_id.is.null`),
    ]);

    if (recurringRes.error) {
        console.error('loadCategorizationContext recurring_items:', recurringRes.error);
    }
    if (catRes.error) {
        console.error('loadCategorizationContext categories:', catRes.error);
    }

    const categoryLeafNameToId = new Map<string, string>();
    for (const row of catRes.data || []) {
        const name = (row.name as string)?.trim().toLowerCase();
        const id = row.id as string;
        if (!name || !id) continue;
        if (row.user_id == null) {
            categoryLeafNameToId.set(name, id);
        }
    }
    for (const row of catRes.data || []) {
        const name = (row.name as string)?.trim().toLowerCase();
        const id = row.id as string;
        if (!name || !id) continue;
        if (row.user_id != null) {
            categoryLeafNameToId.set(name, id);
        }
    }

    return {
        merchantMappings,
        categoryRules,
        recurringWithCategory: (recurringRes.data || []) as RecurringItemCategoryRow[],
        categoryLeafNameToId,
    };
}

/**
 * Normalizes merchant name for matching (alphanumeric only, lowercased).
 */
export function normalizeMerchantName(name: string | null): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

/** Same key used for merchant mappings, peer history, and learning from user edits. */
export function merchantKeyFromNameNote(name: string | null, note: string | null): string {
    const combined = `${name || ''} ${note || ''}`.trim();
    return normalizeMerchantName(combined);
}

function normalizedMerchantLabel(transaction: TransactionToCategorize): string {
    return merchantKeyFromNameNote(transaction.name, transaction.note);
}

function matchesMerchantPattern(merchantName: string, pattern: string, caseSensitive: boolean = false): boolean {
    const normalizedMerchant = caseSensitive ? merchantName : merchantName.toLowerCase();
    const normalizedPattern = caseSensitive ? pattern : pattern.toLowerCase();

    if (normalizedMerchant === normalizedPattern) return true;
    if (normalizedMerchant.includes(normalizedPattern)) return true;

    const merchantWords = normalizedMerchant.split(/\s+/);
    const patternWords = normalizedPattern.split(/\s+/);
    return patternWords.every(pw => merchantWords.some(mw => mw.includes(pw) || pw.includes(mw)));
}

function matchesKeywords(
    transaction: TransactionToCategorize,
    keywords: string[],
    matchAll: boolean = false
): boolean {
    const searchText = `${transaction.name || ''} ${transaction.note || ''}`.toLowerCase();

    if (matchAll) {
        return keywords.every(keyword => searchText.includes(keyword.toLowerCase()));
    }
    return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
}

function matchesAmountRange(amount: number, min: number, max: number): boolean {
    return amount >= min && amount <= max;
}

function matchesMCCCode(transaction: TransactionToCategorize, mccCodes: number[]): boolean {
    if (!transaction.mcc_code) return false;
    return mccCodes.includes(transaction.mcc_code);
}

async function getMerchantMappings(supabase: SupabaseClient, userId: string): Promise<MerchantMapping[]> {
    const { data, error } = await supabase
        .from('merchant_mappings')
        .select('*')
        .eq('user_id', userId)
        .order('confidence_score', { ascending: false });

    if (error) {
        console.error('Error fetching merchant mappings:', error);
        return [];
    }

    return (data || []) as MerchantMapping[];
}

async function getCategoryRules(supabase: SupabaseClient, userId: string): Promise<CategoryRule[]> {
    const { data, error } = await supabase
        .from('category_rules')
        .select('*')
        .eq('active', true)
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('priority', { ascending: false })
        .order('match_count', { ascending: false });

    if (error) {
        console.error('Error fetching category rules:', error);
        return [];
    }

    return (data || []) as CategoryRule[];
}

async function resolveCategoryIdForLeafName(
    supabase: SupabaseClient,
    userId: string,
    leafName: string
): Promise<string | null> {
    const trimmed = leafName.trim();
    if (!trimmed) return null;

    const { data: userRow } = await supabase
        .from('categories')
        .select('id')
        .eq('kind', 'category')
        .eq('is_archived', false)
        .eq('user_id', userId)
        .eq('name', trimmed)
        .maybeSingle();

    if (userRow?.id) return userRow.id as string;

    const { data: globalRow } = await supabase
        .from('categories')
        .select('id')
        .eq('kind', 'category')
        .eq('is_archived', false)
        .is('user_id', null)
        .eq('name', trimmed)
        .maybeSingle();

    return (globalRow?.id as string) ?? null;
}

function applyRule(rule: CategoryRule, transaction: TransactionToCategorize): boolean {
    const pattern = rule.rule_pattern;

    switch (rule.rule_type) {
        case 'merchant_match': {
            const merchantName = transaction.name || '';
            const patternStr = pattern.pattern as string;
            const caseSensitive = pattern.case_sensitive === true;
            return matchesMerchantPattern(merchantName, patternStr, caseSensitive);
        }

        case 'keyword': {
            const keywords = pattern.keywords as string[];
            const matchAll = pattern.match_all === true;
            return matchesKeywords(transaction, keywords, matchAll);
        }

        case 'mcc_code': {
            const mccCodes = pattern.mcc_codes as number[];
            return matchesMCCCode(transaction, mccCodes);
        }

        case 'amount_range': {
            const min = pattern.min as number;
            const max = pattern.max as number;
            const absAmount = Math.abs(transaction.amount);
            return matchesAmountRange(absAmount, min, max);
        }

        case 'recurring_pattern':
            return false;

        default:
            return false;
    }
}

function matchRecurringFromItems(
    transaction: TransactionToCategorize,
    items: RecurringItemCategoryRow[]
): CategorizationResult | null {
    const txNorm = normalizedMerchantLabel(transaction);
    if (!txNorm || !items.length) return null;

    for (const item of items) {
        if (!item.category_id) continue;
        const rNorm = normalizeMerchantName(item.merchant_name);
        if (!rNorm) continue;
        if (txNorm === rNorm || txNorm.includes(rNorm) || rNorm.includes(txNorm)) {
            return {
                category_id: item.category_id,
                confidence: 0.82,
                method: 'recurring_item',
                explanation: `Recurring bill: ${item.merchant_name}`,
            };
        }
    }
    return null;
}

async function matchRecurringItemCategory(
    supabase: SupabaseClient,
    userId: string,
    transaction: TransactionToCategorize
): Promise<CategorizationResult | null> {
    const { data: items, error } = await supabase
        .from('recurring_items')
        .select('id, merchant_name, category_id')
        .eq('user_id', userId)
        .eq('active', true)
        .not('category_id', 'is', null);

    if (error || !items?.length) return null;

    return matchRecurringFromItems(transaction, items as RecurringItemCategoryRow[]);
}

async function persistCategorizationToTransaction(
    supabase: SupabaseClient,
    userId: string,
    transactionId: string,
    result: CategorizationResult
): Promise<void> {
    const { error } = await supabase
        .from('transactions')
        .update({
            category_id: result.category_id,
            categorization_method: result.method,
            categorization_confidence: result.confidence,
            categorization_rule_id: result.rule_id ?? null,
            categorization_merchant_mapping_id: result.merchant_mapping_id ?? null,
        })
        .eq('id', transactionId)
        .eq('user_id', userId);

    if (error) {
        console.warn('persistCategorizationToTransaction:', error);
    }
}

async function finishWithResult(
    transaction: TransactionToCategorize,
    options: CategorizationOptions,
    result: CategorizationResult | null
): Promise<CategorizationResult | null> {
    const persist =
        result &&
        transaction.id &&
        options.persistToTransaction !== false;
    if (persist && transaction.id) {
        await persistCategorizationToTransaction(options.supabase, options.userId, transaction.id, result);
    }
    return result;
}

/**
 * Upserts a merchant→category mapping from user behavior (normalized key).
 * Call after the user assigns a category so future imports match automatically.
 */
export async function learnMerchantMappingFromUserCategory(
    supabase: SupabaseClient,
    params: { userId: string; categoryId: string; name: string | null; note: string | null }
): Promise<void> {
    const merchantKey = merchantKeyFromNameNote(params.name, params.note);
    if (!merchantKey) return;

    const { data: existing } = await supabase
        .from('merchant_mappings')
        .select('id')
        .eq('user_id', params.userId)
        .eq('merchant_name', merchantKey)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('merchant_mappings')
            .update({
                category_id: params.categoryId,
                confidence_score: 1,
                source: 'user_override',
                last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

        if (error) {
            console.warn('learnMerchantMappingFromUserCategory:', error);
        }
        return;
    }

    const { error } = await supabase.from('merchant_mappings').insert({
        user_id: params.userId,
        merchant_name: merchantKey,
        category_id: params.categoryId,
        confidence_score: 1,
        source: 'user_override',
        usage_count: 0,
        last_used_at: new Date().toISOString(),
    });

    if (error) {
        console.warn('learnMerchantMappingFromUserCategory:', error);
    }
}

/**
 * Builds a map from normalized transaction label → category_id using this user's categorized,
 * non-transfer rows (excluding Needs Review when `excludeCategoryId` is set). When multiple
 * categories exist for the same label, the most frequent category wins.
 */
export async function loadPeerMerchantCategoryMap(
    supabase: SupabaseClient,
    userId: string,
    opts?: { excludeCategoryId?: string; maxRows?: number }
): Promise<Map<string, string>> {
    const maxRows = opts?.maxRows ?? 12_000;
    let q = supabase
        .from('transactions')
        .select('name, note, category_id')
        .eq('user_id', userId)
        .eq('is_transfer', false)
        .not('category_id', 'is', null)
        .order('date', { ascending: false })
        .limit(maxRows);

    if (opts?.excludeCategoryId) {
        q = q.neq('category_id', opts.excludeCategoryId);
    }

    const { data, error } = await q;
    if (error) {
        console.warn('loadPeerMerchantCategoryMap:', error);
        return new Map();
    }

    const votes = new Map<string, Map<string, number>>();
    for (const row of data || []) {
        const cid = row.category_id as string | null;
        if (!cid) continue;
        const k = merchantKeyFromNameNote(row.name as string | null, row.note as string | null);
        if (!k) continue;
        if (!votes.has(k)) votes.set(k, new Map());
        const inner = votes.get(k)!;
        inner.set(cid, (inner.get(cid) || 0) + 1);
    }

    const out = new Map<string, string>();
    for (const [k, inner] of votes) {
        let bestCid = '';
        let bestCount = 0;
        for (const [cid, c] of inner) {
            if (c > bestCount || (c === bestCount && cid < bestCid)) {
                bestCount = c;
                bestCid = cid;
            }
        }
        if (bestCid) out.set(k, bestCid);
    }
    return out;
}

/**
 * Categorizes a single transaction (optionally persists to `transactions` when `transaction.id` is set).
 */
export async function categorizeTransaction(
    transaction: TransactionToCategorize,
    options: CategorizationOptions
): Promise<CategorizationResult | null> {
    const { supabase, userId } = options;
    const txNorm = normalizedMerchantLabel(transaction);

    const merchantMappings =
        options.contextCache?.merchantMappings ?? (await getMerchantMappings(supabase, userId));

    for (const mapping of merchantMappings) {
        const normalizedMappingName = normalizeMerchantName(mapping.merchant_name);
        if (
            txNorm &&
            normalizedMappingName &&
            (txNorm === normalizedMappingName ||
                txNorm.includes(normalizedMappingName) ||
                normalizedMappingName.includes(txNorm))
        ) {
            const nextUsage = (Number(mapping.usage_count) || 0) + 1;
            await supabase
                .from('merchant_mappings')
                .update({
                    usage_count: nextUsage,
                    last_used_at: new Date().toISOString(),
                })
                .eq('id', mapping.id);

            mapping.usage_count = nextUsage;

            return finishWithResult(transaction, options, {
                category_id: mapping.category_id,
                confidence: Number(mapping.confidence_score) || 0.95,
                method: 'merchant_mapping',
                merchant_mapping_id: mapping.id,
                explanation: `Matched merchant mapping: ${mapping.merchant_name}`,
            });
        }
    }

    const peerCategoryId = txNorm ? options.peerMerchantKeyToCategory?.get(txNorm) : undefined;
    if (peerCategoryId) {
        void learnMerchantMappingFromUserCategory(supabase, {
            userId,
            categoryId: peerCategoryId,
            name: transaction.name,
            note: transaction.note,
        });
        return finishWithResult(transaction, options, {
            category_id: peerCategoryId,
            confidence: 0.88,
            method: 'user_override',
            explanation: 'Matched a category you already use for this description.',
        });
    }

    const recurringResult = options.contextCache
        ? matchRecurringFromItems(transaction, options.contextCache.recurringWithCategory)
        : await matchRecurringItemCategory(supabase, userId, transaction);
    if (recurringResult) {
        return finishWithResult(transaction, options, recurringResult);
    }

    const rules = options.contextCache?.categoryRules ?? (await getCategoryRules(supabase, userId));
    for (const rule of rules) {
        if (applyRule(rule, transaction)) {
            const nextMatches = (Number(rule.match_count) || 0) + 1;
            await supabase
                .from('category_rules')
                .update({
                    match_count: nextMatches,
                    last_matched_at: new Date().toISOString(),
                })
                .eq('id', rule.id);

            rule.match_count = nextMatches;

            return finishWithResult(transaction, options, {
                category_id: rule.category_id,
                confidence: 0.85,
                method: 'rule',
                rule_id: rule.id,
                explanation: `Matched rule: ${rule.rule_type}`,
            });
        }
    }

    const pfc = transaction.plaid_personal_finance_category;
    if (pfc?.primary || pfc?.detailed) {
        const leafName = leafCategoryNameFromPlaidPfc(pfc.primary ?? undefined, pfc.detailed ?? undefined);
        if (leafName) {
            const key = leafName.trim().toLowerCase();
            let categoryId = options.contextCache?.categoryLeafNameToId.get(key);
            if (!categoryId) {
                categoryId = (await resolveCategoryIdForLeafName(supabase, userId, leafName)) ?? undefined;
            }
            if (categoryId) {
                const cl = (pfc.confidence_level || '').toUpperCase();
                let confidence = 0.74;
                if (cl === 'VERY_HIGH') confidence = 0.9;
                else if (cl === 'HIGH') confidence = 0.84;
                else if (cl === 'MEDIUM') confidence = 0.76;
                else if (cl === 'LOW') confidence = 0.65;

                return finishWithResult(transaction, options, {
                    category_id: categoryId,
                    confidence,
                    method: 'plaid_personal_finance',
                    explanation: `Plaid: ${pfc.detailed || pfc.primary || ''}`,
                });
            }
        }
    }

    if (options.enableML) {
        try {
            const { categorizeWithML } = await import('./mlCategorizer');

            const { data: categories } = await supabase
                .from('categories')
                .select('id, name')
                .or(`user_id.eq.${userId},user_id.is.null`)
                .eq('kind', 'category')
                .eq('is_archived', false);

            if (categories && categories.length > 0) {
                const mlResult = await categorizeWithML({
                    userId,
                    transaction,
                    categories: categories.map(c => ({ id: c.id, name: c.name })),
                    confidenceThreshold: 0.7,
                });

                if (mlResult) {
                    return finishWithResult(transaction, options, mlResult);
                }
            }
        } catch (error) {
            console.warn('ML categorization error (falling back):', error);
        }
    }

    return finishWithResult(transaction, options, null);
}

/**
 * Categorizes multiple transactions in batch
 */
export async function categorizeTransactionsBatch(
    transactions: TransactionToCategorize[],
    options: CategorizationOptions
): Promise<Map<string, CategorizationResult | null>> {
    const results = new Map<string, CategorizationResult | null>();

    const batchOptions =
        !options.contextCache && transactions.length > 0
            ? {
                  ...options,
                  contextCache: await loadCategorizationContext(options.supabase, options.userId),
              }
            : options;

    for (const transaction of transactions) {
        const result = await categorizeTransaction(transaction, batchOptions);
        results.set(transaction.id || transaction.name || '', result);
    }

    return results;
}

/**
 * Creates a merchant mapping from user override (legacy helper; prefer learnMerchantMappingFromUserCategory).
 */
export async function createMerchantMapping(
    supabase: SupabaseClient,
    userId: string,
    merchantName: string,
    categoryId: string,
    transactionId?: string
): Promise<MerchantMapping> {
    const { data: existing } = await supabase
        .from('merchant_mappings')
        .select('*')
        .eq('user_id', userId)
        .eq('merchant_name', merchantName)
        .maybeSingle();

    if (existing) {
        const { data, error } = await supabase
            .from('merchant_mappings')
            .update({
                category_id: categoryId,
                confidence_score: 1.0,
                source: 'user_override',
                last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        if (transactionId) {
            await supabase
                .from('transactions')
                .update({
                    category_id: categoryId,
                    categorization_method: 'user_override',
                    categorization_confidence: 1.0,
                    categorization_merchant_mapping_id: data.id,
                })
                .eq('id', transactionId);
        }
        return data as MerchantMapping;
    }

    const { data, error } = await supabase
        .from('merchant_mappings')
        .insert({
            user_id: userId,
            merchant_name: merchantName,
            category_id: categoryId,
            confidence_score: 1.0,
            source: 'user_override',
            usage_count: 1,
            last_used_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw error;

    if (transactionId) {
        await supabase
            .from('transactions')
            .update({
                category_id: categoryId,
                categorization_method: 'user_override',
                categorization_confidence: 1.0,
                categorization_merchant_mapping_id: data.id,
            })
            .eq('id', transactionId);
    }

    return data as MerchantMapping;
}

/**
 * Detects recurring items from transactions
 */
export async function detectRecurringItems(
    userId: string,
    transactions: TransactionToCategorize[],
    supabaseClient?: SupabaseClient
): Promise<void> {
    const supabase =
        supabaseClient ||
        createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
        });

    const merchantGroups = new Map<string, TransactionToCategorize[]>();

    for (const tx of transactions) {
        const merchantName = tx.name || 'Unknown';
        if (!merchantGroups.has(merchantName)) {
            merchantGroups.set(merchantName, []);
        }
        merchantGroups.get(merchantName)!.push(tx);
    }

    for (const [merchantName, txs] of merchantGroups.entries()) {
        if (txs.length < 2) continue;

        txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const avgAmount = txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / txs.length;

        const dates = txs.map(tx => new Date(tx.date));
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
            const diff = dates[i].getTime() - dates[i - 1].getTime();
            const days = diff / (1000 * 60 * 60 * 24);
            intervals.push(days);
        }

        const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

        let frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly' | null = null;
        if (avgInterval >= 25 && avgInterval <= 35) {
            frequency = 'monthly';
        } else if (avgInterval >= 6 && avgInterval <= 9) {
            frequency = 'weekly';
        } else if (avgInterval >= 12 && avgInterval <= 16) {
            frequency = 'biweekly';
        } else if (avgInterval >= 85 && avgInterval <= 95) {
            frequency = 'quarterly';
        } else if (avgInterval >= 360 && avgInterval <= 370) {
            frequency = 'yearly';
        }

        if (frequency) {
            const lastDate = dates[dates.length - 1];
            const nextExpectedDate = new Date(lastDate);
            switch (frequency) {
                case 'monthly':
                    nextExpectedDate.setMonth(nextExpectedDate.getMonth() + 1);
                    break;
                case 'weekly':
                    nextExpectedDate.setDate(nextExpectedDate.getDate() + 7);
                    break;
                case 'biweekly':
                    nextExpectedDate.setDate(nextExpectedDate.getDate() + 14);
                    break;
                case 'quarterly':
                    nextExpectedDate.setMonth(nextExpectedDate.getMonth() + 3);
                    break;
                case 'yearly':
                    nextExpectedDate.setFullYear(nextExpectedDate.getFullYear() + 1);
                    break;
            }

            const inferredCategoryId = inferDominantCategoryId(txs);

            const { data: existing } = await supabase
                .from('recurring_items')
                .select('*')
                .eq('user_id', userId)
                .eq('merchant_name', merchantName)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('recurring_items')
                    .update({
                        occurrence_count: existing.occurrence_count + 1,
                        last_occurrence_date: lastDate.toISOString().split('T')[0],
                        next_expected_date: nextExpectedDate.toISOString().split('T')[0],
                        expected_amount: avgAmount,
                        ...(inferredCategoryId && !existing.category_id
                            ? { category_id: inferredCategoryId }
                            : {}),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('recurring_items').insert({
                    user_id: userId,
                    merchant_name: merchantName,
                    category_id: inferredCategoryId,
                    frequency,
                    expected_amount: avgAmount,
                    tolerance_days: 3,
                    next_expected_date: nextExpectedDate.toISOString().split('T')[0],
                    occurrence_count: txs.length,
                    last_occurrence_date: lastDate.toISOString().split('T')[0],
                    active: true,
                    confirmed_by_user: false,
                });
            }
        }
    }
}

function inferDominantCategoryId(transactions: TransactionToCategorize[]): string | null {
    const counts = new Map<string, number>();
    for (const tx of transactions) {
        const id = tx.category_id;
        if (typeof id === 'string' && id) {
            counts.set(id, (counts.get(id) || 0) + 1);
        }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [id, c] of counts) {
        if (c > bestCount) {
            best = id;
            bestCount = c;
        }
    }
    return best;
}