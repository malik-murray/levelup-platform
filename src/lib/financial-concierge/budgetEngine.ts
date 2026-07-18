/**
 * BudgetEngine - Generates monthly budgets from 90-day spend history
 * Applies profile-specific guardrails (debt payoff, saving, spend control, etc.)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BudgetPlan, BudgetItem, BudgetPlanStatus, BudgetPlanGeneratedBy } from './types';
import { UserProfile } from './types';
import { getUserProfile } from './userProfileService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Server-only module (cron jobs + already-authorized API routes, no end-user session).
// Service role is required so RLS doesn't block reads/writes, same pattern as
// transactionSyncService.ts.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function getServiceClient() {
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });
}

/**
 * Fetches every row for a query, paging past PostgREST's default 1000-row cap. Without this,
 * budget aggregates over a long history silently drop everything after the first 1000 rows —
 * undercounting categories and skewing the whole plan.
 */
async function fetchAllRows<T>(
    buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
    const pageSize = 1000;
    const all: T[] = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await buildPage(from, from + pageSize - 1);
        if (error) {
            console.error('fetchAllRows error:', (error as { message?: string }).message);
            break;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
    }
    return all;
}

export interface BudgetGenerationOptions {
    userId: string;
    month: string; // YYYY-MM format
    sourceDataDays?: number; // Default: 180 days (~6 months)
    profileType?: string; // Override profile type
}

// Category/group names used to classify spend for guardrail purposes. The live `categories`
// table is mostly flat (few categories actually have a parent group), so this matches on
// whichever name getCategoryGroupNames() resolves to - the group name if the category has
// one, otherwise the category's own name.
const ESSENTIAL_GROUPS = new Set([
    'Housing',
    'Rent/Mortgage',
    'Debt Payment',
    'Loan Payment',
    'Credit Card Payment',
    'Utilities',
    'Insurance',
    'Health Insurance',
    'Healthcare',
    'Pharmacy',
    'Doctor Visits',
    'Transportation',
    'Public Transit',
    'Gas',
    'Car',
    'Parking',
    'Phone Bill',
    'Child Support',
    'Home Maintenance',
    'Fees & Taxes',
    'Food & Dining', // group name for Groceries
    'Groceries', // leaf name — the categories table is mostly flat, so protect it directly too
    // Unknown spend - don't guardrail-cut something we can't classify
    'Needs Review',
    'Uncategorized',
]);
const PROTECTED_GROUPS = new Set(['Savings', 'Savings/Investing']);

// Categories that are not real budget lines — spend that lands here is unclassified, so we
// don't create a budget for it (a "Needs Review: $1,600/mo" line is meaningless).
const NON_BUDGET_CATEGORY_NAMES = new Set(['Needs Review', 'Uncategorized']);

export type BudgetLineClass = 'essential' | 'savings' | 'discretionary';

/** Classify a category (by its resolved group/leaf name) for income-cap normalization. */
export function classifyBudgetLine(groupName: string): BudgetLineClass {
    if (PROTECTED_GROUPS.has(groupName)) return 'savings';
    if (ESSENTIAL_GROUPS.has(groupName)) return 'essential';
    return 'discretionary';
}

export interface OneOffDetectionOptions {
    /** A transaction must exceed this absolute amount to ever be a one-off. */
    absMin?: number;
    /** ...and exceed the category median by this multiple. */
    mult?: number;
    /** Categories with fewer than this many transactions can't establish a norm, so nothing is flagged. */
    minCount?: number;
}

/**
 * Pure: given a category's positive expense amounts, return a boolean[] marking one-off
 * outliers (large, atypical purchases) to exclude from the recurring-spend baseline. A value
 * is a one-off when it exceeds BOTH an absolute floor and a multiple of the category median,
 * and only when the category has enough transactions to define "normal". Median-based so a
 * category that is routinely large (e.g. Rent) has a correspondingly high threshold.
 */
export function detectOneOffAmounts(
    amounts: number[],
    options: OneOffDetectionOptions = {}
): boolean[] {
    const absMin = options.absMin ?? 400;
    const mult = options.mult ?? 4;
    const minCount = options.minCount ?? 5;

    const flags = new Array(amounts.length).fill(false);
    if (amounts.length < minCount) return flags;

    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const threshold = Math.max(absMin, median * mult);

    for (let i = 0; i < amounts.length; i++) {
        if (amounts[i] > threshold) flags[i] = true;
    }
    return flags;
}

/** Median of a numeric list (0 for empty). */
export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Pure: estimate a category's typical monthly spend as the median of its per-month totals,
 * across only the months it was actually active. Robust to capture gaps and partial entries
 * (a bill missing from some months, or logged in pieces) — a recurring ~$1,950 rent lands at
 * ~$1,950 rather than being diluted by empty months, which total ÷ all-months would do.
 */
export function medianMonthlyTotal(txns: { amount: number; date: string | null }[]): number {
    const byMonth = new Map<string, number>();
    for (const t of txns) {
        const month = t.date && /^\d{4}-\d{2}/.test(t.date) ? t.date.slice(0, 7) : 'unknown';
        byMonth.set(month, (byMonth.get(month) || 0) + t.amount);
    }
    return median([...byMonth.values()]);
}

export interface MonthlyEstimate {
    amount: number;
    basis: 'recurring_monthly' | 'annualized';
    activeMonths: number;
}

/**
 * Pure: estimate a category's monthly budget, distinguishing recurring monthly bills from
 * genuinely sporadic costs.
 *
 * - Recurring (rent, phone, insurance, child support): budget the TYPICAL monthly amount
 *   (median of active-month totals), so capture gaps don't dilute it.
 * - Sporadic (taxes, car/home maintenance): spread the cost as a sinking fund
 *   (total ÷ window months), so an occasional big hit isn't budgeted as if it were monthly.
 *
 * A category counts as recurring when it appears in a healthy fraction of all months OR keeps
 * showing up recently — the latter rescues ongoing bills (phone, child support) whose overall
 * ratio is low only because older months were captured on a different account.
 */
export function estimateMonthlyBudget(
    txns: { amount: number; date: string | null }[],
    windowMonths: number,
    recentMonthKeys: string[],
    options: { activeRatioThreshold?: number; recentMinActive?: number } = {}
): MonthlyEstimate {
    const activeRatioThreshold = options.activeRatioThreshold ?? 0.4;
    const recentMinActive = options.recentMinActive ?? 3;

    const byMonth = new Map<string, number>();
    let total = 0;
    for (const t of txns) {
        const month = t.date && /^\d{4}-\d{2}/.test(t.date) ? t.date.slice(0, 7) : 'unknown';
        byMonth.set(month, (byMonth.get(month) || 0) + t.amount);
        total += t.amount;
    }

    const activeMonths = byMonth.size;
    const medianMonthly = median([...byMonth.values()]);
    const annualized = windowMonths > 0 ? total / windowMonths : total;
    const recentActive = recentMonthKeys.filter((k) => byMonth.has(k)).length;

    const isRecurring =
        (windowMonths > 0 && activeMonths / windowMonths >= activeRatioThreshold) ||
        recentActive >= recentMinActive;

    return {
        amount: isRecurring ? medianMonthly : annualized,
        basis: isRecurring ? 'recurring_monthly' : 'annualized',
        activeMonths,
    };
}

/** The last `n` calendar months as YYYY-MM keys, most recent first. */
export function lastNMonthKeys(n: number, from: Date = new Date()): string[] {
    const keys: string[] = [];
    const d = new Date(from.getFullYear(), from.getMonth(), 1);
    for (let i = 0; i < n; i++) {
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        d.setMonth(d.getMonth() - 1);
    }
    return keys;
}

export interface NormalizableLine {
    category_id: string;
    amount: number;
    klass: BudgetLineClass;
}

export interface NormalizedLine extends NormalizableLine {
    scaled: boolean;
}

export interface NormalizationResult {
    lines: NormalizedLine[];
    totalBefore: number;
    totalAfter: number;
    income: number;
    /** Factor applied to discretionary lines (1 = none, 0 = zeroed). null when income unknown. */
    discretionaryScale: number | null;
    warning: string | null;
}

/**
 * Pure: enforce the hard rule that a budget never exceeds income. Essentials and savings are
 * protected (never scaled); only discretionary lines are reduced to make the total fit. If
 * essentials + savings alone already exceed income, discretionary is zeroed and a warning is
 * returned (the user genuinely can't hit that savings target at current fixed costs).
 */
export function normalizeToIncome(lines: NormalizableLine[], income: number): NormalizationResult {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalBefore = round2(lines.reduce((s, l) => s + l.amount, 0));

    if (!income || income <= 0) {
        return {
            lines: lines.map((l) => ({ ...l, scaled: false })),
            totalBefore,
            totalAfter: totalBefore,
            income,
            discretionaryScale: null,
            warning: 'No income figure available — budget not capped to income.',
        };
    }

    if (totalBefore <= income) {
        return {
            lines: lines.map((l) => ({ ...l, scaled: false })),
            totalBefore,
            totalAfter: totalBefore,
            income,
            discretionaryScale: 1,
            warning: null,
        };
    }

    const fixed = lines
        .filter((l) => l.klass !== 'discretionary')
        .reduce((s, l) => s + l.amount, 0);
    const discretionaryTotal = lines
        .filter((l) => l.klass === 'discretionary')
        .reduce((s, l) => s + l.amount, 0);

    const remaining = income - fixed;

    let discretionaryScale: number;
    let warning: string | null = null;

    if (remaining <= 0) {
        discretionaryScale = 0;
        warning = `Essential + savings commitments ($${round2(fixed)}) exceed income ($${income}). Discretionary set to $0; revisit fixed costs or the savings target.`;
    } else if (discretionaryTotal > 0) {
        discretionaryScale = Math.min(1, remaining / discretionaryTotal);
    } else {
        discretionaryScale = 1;
    }

    const outLines: NormalizedLine[] = lines.map((l) => {
        if (l.klass === 'discretionary' && discretionaryScale < 1) {
            return { ...l, amount: round2(l.amount * discretionaryScale), scaled: true };
        }
        return { ...l, scaled: false };
    });

    return {
        lines: outLines,
        totalBefore,
        totalAfter: round2(outLines.reduce((s, l) => s + l.amount, 0)),
        income,
        discretionaryScale,
        warning,
    };
}

/**
 * Finds a leaf category to attach an explicit savings/investing goal budget line to
 * (under a "Savings"/"Savings/Investing" group). Prefers a user-owned category named
 * "Investments" as a general catch-all, falling back to the first leaf under that group.
 */
async function resolveSavingsGoalCategoryId(supabase: any, userId: string): Promise<string | null> {
    const { data: userGroups } = await supabase
        .from('categories')
        .select('id, name')
        .eq('kind', 'group')
        .eq('user_id', userId);

    let group = (userGroups || []).find((g: any) => /saving|invest/i.test(g.name));

    if (!group) {
        const { data: globalGroups } = await supabase
            .from('categories')
            .select('id, name')
            .eq('kind', 'group')
            .is('user_id', null);
        group = (globalGroups || []).find((g: any) => /saving|invest/i.test(g.name));
    }

    if (!group) return null;

    const { data: leaves } = await supabase
        .from('categories')
        .select('id, name')
        .eq('parent_id', group.id)
        .eq('kind', 'category');

    if (!leaves || leaves.length === 0) return null;

    return (leaves.find((c: any) => c.name === 'Investments') || leaves[0]).id;
}

/**
 * Maps category_id -> parent group name for a set of categories, so guardrails can tell
 * essential/protected spend apart from discretionary spend.
 */
async function getCategoryGroupNames(
    supabase: any,
    categoryIds: string[]
): Promise<Map<string, string>> {
    const groupByCategoryId = new Map<string, string>();
    if (categoryIds.length === 0) return groupByCategoryId;

    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .in('id', categoryIds);

    const parentIds = Array.from(
        new Set((categories || []).map((c: any) => c.parent_id).filter(Boolean))
    );

    const { data: parents } = parentIds.length
        ? await supabase.from('categories').select('id, name').in('id', parentIds)
        : { data: [] as any[] };

    const parentNameById = new Map((parents || []).map((p: any) => [p.id, p.name as string]));

    for (const category of (categories || []) as any[]) {
        const groupName = category.parent_id
            ? parentNameById.get(category.parent_id) || category.name
            : category.name;
        groupByCategoryId.set(category.id, groupName);
    }

    return groupByCategoryId;
}

export interface CategorySpendSummary {
    category_id: string;
    category_name: string;
    total_spend: number; // recurring spend only (one-offs excluded)
    transaction_count: number; // recurring transaction count
    avg_monthly_spend: number; // Average over the period, one-offs excluded
}

export interface OneOffTransaction {
    transaction_id: string;
    category_id: string;
    category_name: string;
    amount: number; // positive
    date: string | null;
    name: string | null;
}

export interface CategorySpendResult {
    summaries: CategorySpendSummary[];
    oneOffs: OneOffTransaction[];
}

/**
 * Gets spend summary by category for the last N days, with one-off large purchases detected
 * and excluded from each category's recurring average (returned separately for review), and
 * unclassified "Needs Review"/"Uncategorized" categories left out of the budget entirely.
 */
async function getCategorySpendSummary(
    userId: string,
    days: number = 180
): Promise<CategorySpendResult> {
    const supabase = getServiceClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get transactions with categories (expenses only - negative amounts). Paginated so a long
    // history isn't truncated at PostgREST's 1000-row default.
    const transactions = await fetchAllRows<any>((from, to) =>
        supabase
            .from('transactions')
            .select(`
                id,
                amount,
                category_id,
                date,
                name,
                categories!inner(id, name)
            `)
            .eq('user_id', userId)
            .gte('date', startDate.toISOString().split('T')[0])
            .lt('date', endDate.toISOString().split('T')[0])
            .lt('amount', 0) // Expenses only
            .eq('is_transfer', false) // Exclude money moved between the user's own accounts
            .is('removed_at', null) // Exclude Plaid-removed / retired-item transactions
            .not('category_id', 'is', null)
            .order('id', { ascending: true })
            .range(from, to)
    );

    type TxLite = { id: string; amount: number; date: string | null; name: string | null };
    const categoryMap = new Map<string, { name: string; txns: TxLite[] }>();

    for (const tx of transactions || []) {
        const categoryId = tx.category_id as string;
        const category = (tx.categories as any)?.[0] || tx.categories;
        const categoryName = category?.name || 'Unknown';

        // Skip unclassified buckets — they aren't real budget lines.
        if (NON_BUDGET_CATEGORY_NAMES.has(categoryName)) continue;

        if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, { name: categoryName, txns: [] });
        }
        categoryMap.get(categoryId)!.txns.push({
            id: tx.id as string,
            amount: Math.abs(tx.amount), // positive
            date: (tx.date as string | null) ?? null,
            name: (tx.name as string | null) ?? null,
        });
    }

    const summaries: CategorySpendSummary[] = [];
    const oneOffs: OneOffTransaction[] = [];
    const windowMonths = Math.max(1, Math.round(days / 30.44));
    const recentMonthKeys = lastNMonthKeys(4);

    for (const [categoryId, data] of categoryMap.entries()) {
        const amounts = data.txns.map((t) => t.amount);
        const oneOffFlags = detectOneOffAmounts(amounts);

        let recurringTotal = 0;
        const recurringTxns: { amount: number; date: string | null }[] = [];
        for (let i = 0; i < data.txns.length; i++) {
            if (oneOffFlags[i]) {
                oneOffs.push({
                    transaction_id: data.txns[i].id,
                    category_id: categoryId,
                    category_name: data.name,
                    amount: data.txns[i].amount,
                    date: data.txns[i].date,
                    name: data.txns[i].name,
                });
            } else {
                recurringTotal += data.txns[i].amount;
                recurringTxns.push({ amount: data.txns[i].amount, date: data.txns[i].date });
            }
        }

        summaries.push({
            category_id: categoryId,
            category_name: data.name,
            total_spend: recurringTotal,
            transaction_count: recurringTxns.length,
            // Recurring bills -> typical monthly amount; sporadic costs -> spread as a sinking
            // fund. See estimateMonthlyBudget.
            avg_monthly_spend: estimateMonthlyBudget(recurringTxns, windowMonths, recentMonthKeys)
                .amount,
        });
    }

    summaries.sort((a, b) => b.avg_monthly_spend - a.avg_monthly_spend);
    oneOffs.sort((a, b) => b.amount - a.amount);
    return { summaries, oneOffs };
}

/**
 * Determines how many days of usable (non-transfer, non-removed) history exist, so the budget
 * baselines off all available history ("as far back as possible") rather than a fixed window.
 * The median-of-monthly-totals estimator (see medianMonthlyTotal) keeps a long, uneven history
 * from skewing recurring lines, so there's no upper cap; a 90-day floor covers brand-new users.
 */
async function getSpendHistorySpanDays(userId: string): Promise<number> {
    const supabase = getServiceClient();
    const { data } = await supabase
        .from('transactions')
        .select('date')
        .eq('user_id', userId)
        .eq('is_transfer', false)
        .is('removed_at', null)
        .not('date', 'is', null)
        .order('date', { ascending: true })
        .limit(1);

    const earliest = data?.[0]?.date as string | undefined;
    if (!earliest) return 180;

    const spanDays = Math.ceil((Date.now() - new Date(earliest).getTime()) / 86_400_000);
    return Math.max(90, spanDays);
}

/**
 * Gets income average for the last N days
 */
async function getAverageMonthlyIncome(userId: string, days: number = 180): Promise<number> {
    const supabase = getServiceClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await fetchAllRows<{ amount: number }>((from, to) =>
        supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .gte('date', startDate.toISOString().split('T')[0])
            .lt('date', endDate.toISOString().split('T')[0])
            .gt('amount', 0) // Income only
            .eq('is_transfer', false) // Exclude money moved between the user's own accounts
            .is('removed_at', null) // Exclude Plaid-removed / retired-item transactions
            .order('id', { ascending: true })
            .range(from, to)
    );

    const totalIncome = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const monthsInPeriod = days / 30;
    return totalIncome / monthsInPeriod;
}

/**
 * Applies guardrails to budget amounts based on profile type and the category's group
 * (essential / protected-for-savings / discretionary — see ESSENTIAL_GROUPS/PROTECTED_GROUPS).
 */
function applyGuardrails(
    categorySpend: number,
    totalIncome: number,
    profile: UserProfile | null,
    categoryGroupName: string
): { adjustedAmount: number; guardrailReason: string | null } {
    if (!profile || !profile.guardrails) {
        // No profile or guardrails - use raw spend
        return { adjustedAmount: categorySpend, guardrailReason: null };
    }

    const isEssential = ESSENTIAL_GROUPS.has(categoryGroupName);
    const isProtected = PROTECTED_GROUPS.has(categoryGroupName); // e.g. Savings — never cut

    if (isProtected) {
        // Savings/investing categories are the goal itself - never guardrail them down.
        return { adjustedAmount: categorySpend, guardrailReason: null };
    }

    const guardrails = profile.guardrails;
    let adjustedAmount = categorySpend;
    let reason: string | null = null;

    switch (profile.profile_type) {
        case 'debt_payoff': {
            // Emphasize minimum payments, reduce discretionary spending
            const maxDiscretionary = (guardrails.max_discretionary_spending as number) || 0.3;

            if (!isEssential) {
                adjustedAmount = categorySpend * (maxDiscretionary * 0.8); // Reduce discretionary by 20%
                reason = 'Debt payoff: Reduced discretionary spending';
            }
            break;
        }

        case 'saving_focused':
        case 'investing_focused':
        case 'mixed': {
            // Saving/investing goals: cap non-essential categories so more income is left
            // over for the Savings group. 'mixed' covers users who selected both saving and
            // investing goals (no single-goal profile applies), so it gets the same guardrail.
            const minSavingsRate = (guardrails.minimum_savings_rate as number) || 0.1;
            const capRate = Math.max(0.05, 0.5 - minSavingsRate); // more aggressive savings goal -> tighter cap

            if (!isEssential && adjustedAmount > totalIncome * capRate) {
                adjustedAmount = Math.min(adjustedAmount, totalIncome * capRate);
                reason =
                    profile.profile_type === 'mixed'
                        ? 'Saving & investing goals: capped non-essential spending'
                        : 'Saving focused: capped non-essential spending';
            }
            break;
        }

        case 'spend_control': {
            // Cap at 10% increase from average
            const maxIncrease = categorySpend * 1.1;
            adjustedAmount = Math.min(adjustedAmount, maxIncrease);
            reason = 'Spend control: Limited to 10% increase';
            break;
        }

        case 'rebuild_credit': {
            if (!isEssential) {
                adjustedAmount = categorySpend * 0.9; // Reduce by 10%
                reason = 'Rebuild credit: Reduced non-essential spending';
            }
            break;
        }

        default:
            break;
    }

    return { adjustedAmount, guardrailReason: reason };
}

/**
 * Generates a budget plan for a given month
 */
export async function generateBudgetPlan(
    options: BudgetGenerationOptions
): Promise<BudgetPlan & { items: BudgetItem[] }> {
    const supabase = getServiceClient();
    const userId = options.userId;

    // Baseline off as much history as available (capped at Plaid's 730-day max) unless an
    // explicit window is requested.
    const sourceDataDays = options.sourceDataDays ?? (await getSpendHistorySpanDays(userId));

    const profile = options.profileType
        ? { profile_type: options.profileType, guardrails: {}, preferences: {}, budget_strategy: 'zero_based' } as UserProfile
        : await getUserProfile(userId);

    // Transaction-derived income is unreliable (brokerage transfers, tax refunds, and other
    // one-off inflows all look like "income"), so a user-declared figure takes priority.
    const [spendResult, txAvgIncome, survey] = await Promise.all([
        getCategorySpendSummary(userId, sourceDataDays),
        getAverageMonthlyIncome(userId, sourceDataDays),
        supabase
            .from('user_survey')
            .select('target_savings_amount, target_savings_timeline_months')
            .eq('user_id', userId)
            .maybeSingle()
            .then((r: any) => r.data),
    ]);
    const { summaries: categorySpends, oneOffs } = spendResult;

    const declaredIncome = (profile?.preferences as any)?.declared_monthly_income;
    const avgIncome = declaredIncome && declaredIncome > 0 ? declaredIncome : txAvgIncome;

    const monthlySavingsGoal =
        survey?.target_savings_amount && survey?.target_savings_timeline_months
            ? survey.target_savings_amount / survey.target_savings_timeline_months
            : null;

    const effectiveProfile: UserProfile | null =
        profile && monthlySavingsGoal && avgIncome > 0
            ? {
                  ...profile,
                  guardrails: {
                      ...profile.guardrails,
                      minimum_savings_rate: monthlySavingsGoal / avgIncome,
                  },
              }
            : profile;

    const categoryGroupNames = await getCategoryGroupNames(
        supabase,
        categorySpends.map((c) => c.category_id)
    );

    // --- Build planned lines in memory (guardrails), then a savings line, then income-cap
    // normalization — so the final amounts are known before anything is written. ---
    type PlannedLine = {
        category_id: string;
        base_avg: number; // recurring monthly average before adjustments
        amount: number; // guardrail-adjusted, pre-normalization
        klass: BudgetLineClass;
        guardrail_reason: string | null;
    };

    const plannedLines: PlannedLine[] = categorySpends.map((cs) => {
        const groupName = categoryGroupNames.get(cs.category_id) || cs.category_name;
        const { adjustedAmount, guardrailReason } = applyGuardrails(
            cs.avg_monthly_spend,
            avgIncome,
            effectiveProfile,
            groupName
        );
        return {
            category_id: cs.category_id,
            base_avg: cs.avg_monthly_spend,
            amount: adjustedAmount,
            klass: classifyBudgetLine(groupName),
            guardrail_reason: guardrailReason,
        };
    });

    // Ensure the savings/investing goal is its own line even without spend history (transfers
    // to external, non-Plaid savings/brokerage accounts never show up as categorized spend).
    // Categories already under the Savings group count toward the goal rather than stacking.
    if (monthlySavingsGoal && monthlySavingsGoal > 0) {
        const savingsCategoryId = await resolveSavingsGoalCategoryId(supabase, userId);
        if (savingsCategoryId) {
            const existing = plannedLines.find((l) => l.category_id === savingsCategoryId);
            const otherTrackedSavings = plannedLines
                .filter((l) => l.category_id !== savingsCategoryId && l.klass === 'savings')
                .reduce((sum, l) => sum + l.amount, 0);
            const targetAmount = Math.max(existing?.amount || 0, monthlySavingsGoal - otherTrackedSavings);

            if (existing) {
                existing.amount = targetAmount;
                existing.klass = 'savings';
                existing.guardrail_reason = 'Savings/investing goal';
            } else {
                plannedLines.push({
                    category_id: savingsCategoryId,
                    base_avg: 0,
                    amount: targetAmount,
                    klass: 'savings',
                    guardrail_reason: 'Savings/investing goal',
                });
            }
        }
    }

    // Hard constraint: total budget must not exceed income (protect essentials + savings,
    // scale discretionary).
    const normalization = normalizeToIncome(
        plannedLines.map((l) => ({ category_id: l.category_id, amount: l.amount, klass: l.klass })),
        avgIncome
    );
    const finalAmountByCategory = new Map(normalization.lines.map((l) => [l.category_id, l]));

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - sourceDataDays);
    const oneOffsTotal = oneOffs.reduce((s, o) => s + o.amount, 0);

    // Deactivate existing active budget for this month
    await supabase
        .from('budget_plans')
        .update({ status: 'archived' })
        .eq('user_id', userId)
        .eq('month', options.month)
        .eq('status', 'active');

    const { data: budgetPlan, error: planError } = await supabase
        .from('budget_plans')
        .insert({
            user_id: userId,
            month: options.month,
            generated_by: 'auto' as BudgetPlanGeneratedBy,
            source_data_start_date: startDate.toISOString().split('T')[0],
            source_data_end_date: endDate.toISOString().split('T')[0],
            profile_type: profile?.profile_type || null,
            status: 'active' as BudgetPlanStatus,
            metadata: {
                avg_monthly_income: avgIncome,
                income_source: declaredIncome && declaredIncome > 0 ? 'declared' : 'transaction_derived',
                monthly_savings_goal: monthlySavingsGoal,
                categories_included: plannedLines.length,
                source_data_days: sourceDataDays,
                normalization: {
                    total_before: normalization.totalBefore,
                    total_after: normalization.totalAfter,
                    income: normalization.income,
                    discretionary_scale: normalization.discretionaryScale,
                    warning: normalization.warning,
                },
                one_offs_excluded: {
                    count: oneOffs.length,
                    total: Math.round(oneOffsTotal * 100) / 100,
                    // Kept for the confirm flow — surface these for the user to re-include if wanted.
                    items: oneOffs.slice(0, 50),
                },
            },
        })
        .select()
        .single();

    if (planError) {
        throw new Error(`Failed to create budget plan: ${planError.message}`);
    }

    const budgetItems: BudgetItem[] = [];
    for (const line of plannedLines) {
        const normalized = finalAmountByCategory.get(line.category_id);
        const finalAmount = normalized ? normalized.amount : line.amount;
        const reason =
            normalized?.scaled
                ? [line.guardrail_reason, 'Scaled to fit income'].filter(Boolean).join('; ')
                : line.guardrail_reason;

        const { data: budgetItem, error: itemError } = await supabase
            .from('budget_items')
            .insert({
                budget_plan_id: budgetPlan.id,
                category_id: line.category_id,
                amount: finalAmount,
                guardrail_adjustment: Math.round((finalAmount - line.base_avg) * 100) / 100,
                guardrail_reason: reason,
                user_override_amount: null,
                user_override_reason: null,
            })
            .select()
            .single();

        if (!itemError && budgetItem) {
            budgetItems.push(budgetItem as BudgetItem);
        }
    }

    // Bridge to the YNAB-style /finance/budget page, which reads `category_budgets` rather
    // than the concierge `budget_items`. Without this the generated plan is invisible there.
    await syncBudgetItemsToCategoryBudgets(supabase, userId, options.month, budgetItems);

    return {
        ...(budgetPlan as BudgetPlan),
        items: budgetItems,
    };
}

/**
 * Mirrors a generated plan's amounts into `category_budgets` (the table the main
 * /finance/budget page reads), for the given month, so the generated budget is visible there.
 * Replaces the month's rows so a regeneration reflects the latest plan.
 */
async function syncBudgetItemsToCategoryBudgets(
    supabase: SupabaseClient,
    userId: string,
    month: string, // YYYY-MM
    items: BudgetItem[]
): Promise<void> {
    await supabase.from('category_budgets').delete().eq('user_id', userId).eq('month', month);

    const rows = items.map((item) => ({
        user_id: userId,
        category_id: item.category_id,
        month,
        amount: item.user_override_amount ?? item.amount,
    }));

    if (rows.length > 0) {
        const { error } = await supabase.from('category_budgets').insert(rows);
        if (error) console.error('Failed to sync category_budgets:', error.message);
    }
}

/**
 * Gets active budget plan for a month
 */
export async function getActiveBudgetPlan(
    userId: string,
    month: string
): Promise<(BudgetPlan & { items: BudgetItem[] }) | null> {
    const supabase = getServiceClient();

    const { data: budgetPlan, error } = await supabase
        .from('budget_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('status', 'active')
        .single();

    if (error || !budgetPlan) {
        return null;
    }

    const { data: budgetItems } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_plan_id', budgetPlan.id);

    return {
        ...(budgetPlan as BudgetPlan),
        items: (budgetItems || []) as BudgetItem[],
    };
}

export interface RemainingCategoryBudget {
    categoryName: string;
    budgetAmount: number;
    spent: number;
    remaining: number;
}

/**
 * Looks up how much is left in a category's budget for the given month, including all
 * spend recorded so far (used to annotate spend notifications). Returns null if there's
 * no active budget plan for the month or no budget item for this category yet.
 */
export async function getRemainingBudgetForCategory(
    supabase: SupabaseClient,
    userId: string,
    categoryId: string,
    month: string // YYYY-MM
): Promise<RemainingCategoryBudget | null> {
    const { data: budgetPlan } = await supabase
        .from('budget_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('status', 'active')
        .maybeSingle();

    if (!budgetPlan) return null;

    const { data: budgetItem } = await supabase
        .from('budget_items')
        .select('amount, user_override_amount, category_id')
        .eq('budget_plan_id', budgetPlan.id)
        .eq('category_id', categoryId)
        .maybeSingle();

    if (!budgetItem) return null;

    const budgetAmount = budgetItem.user_override_amount ?? budgetItem.amount;
    if (!budgetAmount || budgetAmount <= 0) return null;

    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const nextMonthStart = new Date(Date.UTC(year, monthNum, 1)).toISOString().split('T')[0];

    const [{ data: category }, { data: transactions }] = await Promise.all([
        supabase.from('categories').select('name').eq('id', categoryId).maybeSingle(),
        supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('category_id', categoryId)
            .gte('date', monthStart)
            .lt('date', nextMonthStart)
            .lt('amount', 0)
            .eq('is_transfer', false)
            .is('removed_at', null),
    ]);

    const spent = (transactions || []).reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

    return {
        categoryName: category?.name || 'this category',
        budgetAmount,
        spent,
        remaining: budgetAmount - spent,
    };
}










