/**
 * CategoryEngine - Categorizes transactions using rules, merchant mappings, and optional ML
 * Priority: User overrides > Merchant mappings > Rules > ML (if enabled)
 */

import { createClient } from '@supabase/supabase-js';
import {
    CategorizationResult,
    CategorizationMethod,
    MerchantMapping,
    CategoryRule,
    CategoryRuleType,
} from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface TransactionToCategorize {
    id?: string;
    name: string | null;
    note: string | null;
    amount: number;
    date: string;
    mcc_code?: number | null; // Merchant Category Code
}

export interface CategorizationOptions {
    userId: string;
    enableML?: boolean; // Optional ML/embedding matcher toggle
    transaction?: TransactionToCategorize;
}

/**
 * Normalizes merchant name for matching
 */
function normalizeMerchantName(name: string | null): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

/**
 * Checks if merchant name matches pattern
 */
function matchesMerchantPattern(merchantName: string, pattern: string, caseSensitive: boolean = false): boolean {
    const normalizedMerchant = caseSensitive ? merchantName : merchantName.toLowerCase();
    const normalizedPattern = caseSensitive ? pattern : pattern.toLowerCase();

    // Exact match
    if (normalizedMerchant === normalizedPattern) return true;

    // Contains match
    if (normalizedMerchant.includes(normalizedPattern)) return true;

    // Partial word match (e.g., "amazon" matches "amazon.com")
    const merchantWords = normalizedMerchant.split(/\s+/);
    const patternWords = normalizedPattern.split(/\s+/);
    return patternWords.every(pw => merchantWords.some(mw => mw.includes(pw) || pw.includes(mw)));
}

/**
 * Checks if transaction matches keyword rules
 */
function matchesKeywords(
    transaction: TransactionToCategorize,
    keywords: string[],
    matchAll: boolean = false
): boolean {
    const searchText = `${transaction.name || ''} ${transaction.note || ''}`.toLowerCase();

    if (matchAll) {
        return keywords.every(keyword => searchText.includes(keyword.toLowerCase()));
    } else {
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    }
}

/**
 * Checks if amount matches range rule
 */
function matchesAmountRange(amount: number, min: number, max: number): boolean {
    return amount >= min && amount <= max;
}

/**
 * Checks if transaction matches MCC code rule
 */
function matchesMCCCode(transaction: TransactionToCategorize, mccCodes: number[]): boolean {
    if (!transaction.mcc_code) return false;
    return mccCodes.includes(transaction.mcc_code);
}

/**
 * Gets user merchant mappings
 */
async function getMerchantMappings(userId: string): Promise<MerchantMapping[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

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

/**
 * Gets category rules (both user-specific and global)
 */
async function getCategoryRules(userId: string): Promise<CategoryRule[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const { data, error } = await supabase
        .from('category_rules')
        .select('*')
        .eq('active', true)
        .or(`user_id.eq.${userId},user_id.is.null`) // User rules or global rules
        .order('priority', { ascending: false }) // Higher priority first
        .order('match_count', { ascending: false }); // More matches first

    if (error) {
        console.error('Error fetching category rules:', error);
        return [];
    }

    return (data || []) as CategoryRule[];
}

/**
 * Applies a category rule to a transaction
 */
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

        case 'recurring_pattern': {
            // Recurring patterns are detected separately and stored in recurring_items
            // This rule type is for future use with pattern matching
            return false;
        }

        default:
            return false;
    }
}

/**
 * Categorizes a single transaction
 */
export async function categorizeTransaction(
    transaction: TransactionToCategorize,
    options: CategorizationOptions
): Promise<CategorizationResult | null> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    // 1. Check merchant mappings first (user overrides)
    const merchantMappings = await getMerchantMappings(options.userId);
    const normalizedMerchantName = normalizeMerchantName(transaction.name);

    for (const mapping of merchantMappings) {
        const normalizedMappingName = normalizeMerchantName(mapping.merchant_name);
        if (normalizedMerchantName === normalizedMappingName || 
            normalizedMerchantName.includes(normalizedMappingName) ||
            normalizedMappingName.includes(normalizedMerchantName)) {
            // Update usage count
            await supabase
                .from('merchant_mappings')
                .update({
                    usage_count: mapping.usage_count + 1,
                    last_used_at: new Date().toISOString(),
                })
                .eq('id', mapping.id);

            return {
                category_id: mapping.category_id,
                confidence: mapping.confidence_score,
                method: 'merchant_mapping',
                merchant_mapping_id: mapping.id,
                explanation: `Matched merchant mapping: ${mapping.merchant_name}`,
            };
        }
    }

    // 2. Check category rules
    const rules = await getCategoryRules(options.userId);
    for (const rule of rules) {
        if (applyRule(rule, transaction)) {
            // Update match count
            await supabase
                .from('category_rules')
                .update({
                    match_count: rule.match_count + 1,
                    last_matched_at: new Date().toISOString(),
                })
                .eq('id', rule.id);

            return {
                category_id: rule.category_id,
                confidence: 0.85, // Default confidence for rules
                method: 'rule',
                rule_id: rule.id,
                explanation: `Matched rule: ${rule.rule_type}`,
            };
        }
    }

    // 3. Optional ML/embedding matcher (if enabled)
    if (options.enableML) {
        try {
            // Import dynamically to avoid loading if not needed
            const { categorizeWithML } = await import('./mlCategorizer');
            
            // Get all categories for the user (including global categories)
            const { data: categories } = await supabase
                .from('categories')
                .select('id, name')
                .or(`user_id.eq.${options.userId},user_id.is.null`) // User's categories or global
                .eq('kind', 'category'); // Only match against actual categories, not groups
            
            if (categories && categories.length > 0) {
                const mlResult = await categorizeWithML({
                    userId: options.userId,
                    transaction,
                    categories: categories.map(c => ({ id: c.id, name: c.name })),
                    confidenceThreshold: 0.7,
                });
                
                if (mlResult) {
                    return mlResult;
                }
            }
        } catch (error) {
            // ML categorization failed, fall through to return null
            console.warn('ML categorization error (falling back to other methods):', error);
        }
    }

    // 4. No match found
    return null;
}

/**
 * Categorizes multiple transactions in batch
 */
export async function categorizeTransactionsBatch(
    transactions: TransactionToCategorize[],
    options: CategorizationOptions
): Promise<Map<string, CategorizationResult | null>> {
    const results = new Map<string, CategorizationResult | null>();

    for (const transaction of transactions) {
        const result = await categorizeTransaction(transaction, options);
        results.set(transaction.id || transaction.name || '', result);
    }

    return results;
}

/**
 * Creates a merchant mapping from user override
 */
export async function createMerchantMapping(
    userId: string,
    merchantName: string,
    categoryId: string,
    transactionId?: string
): Promise<MerchantMapping> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    // Check if mapping already exists
    const { data: existing } = await supabase
        .from('merchant_mappings')
        .select('*')
        .eq('user_id', userId)
        .eq('merchant_name', merchantName)
        .single();

    if (existing) {
        // Update existing mapping
        const { data, error } = await supabase
            .from('merchant_mappings')
            .update({
                category_id: categoryId,
                confidence_score: 1.0, // User overrides have max confidence
                source: 'user_override',
                last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        return data as MerchantMapping;
    } else {
        // Create new mapping
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

        // Update the transaction if transactionId provided
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
}

/**
 * Detects recurring items from transactions
 */
export async function detectRecurringItems(
    userId: string,
    transactions: TransactionToCategorize[]
): Promise<void> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    // Group transactions by merchant name
    const merchantGroups = new Map<string, TransactionToCategorize[]>();

    for (const tx of transactions) {
        const merchantName = tx.name || 'Unknown';
        if (!merchantGroups.has(merchantName)) {
            merchantGroups.set(merchantName, []);
        }
        merchantGroups.get(merchantName)!.push(tx);
    }

    // Analyze each merchant group for recurring patterns
    for (const [merchantName, txs] of merchantGroups.entries()) {
        if (txs.length < 2) continue; // Need at least 2 transactions

        // Sort by date
        txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate average amount
        const avgAmount = txs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / txs.length;

        // Check for monthly pattern (most common)
        const dates = txs.map(tx => new Date(tx.date));
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
            const diff = dates[i].getTime() - dates[i - 1].getTime();
            const days = diff / (1000 * 60 * 60 * 24);
            intervals.push(days);
        }

        const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

        // Determine frequency
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
            // Calculate next expected date
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

            // Check if recurring item already exists
            const { data: existing } = await supabase
                .from('recurring_items')
                .select('*')
                .eq('user_id', userId)
                .eq('merchant_name', merchantName)
                .single();

            if (existing) {
                // Update existing
                await supabase
                    .from('recurring_items')
                    .update({
                        occurrence_count: existing.occurrence_count + 1,
                        last_occurrence_date: lastDate.toISOString().split('T')[0],
                        next_expected_date: nextExpectedDate.toISOString().split('T')[0],
                        expected_amount: avgAmount,
                    })
                    .eq('id', existing.id);
            } else {
                // Create new
                await supabase
                    .from('recurring_items')
                    .insert({
                        user_id: userId,
                        merchant_name: merchantName,
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

