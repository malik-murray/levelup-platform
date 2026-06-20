import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    generateFinanceAnswerLocally,
    isOpenAIUnavailableError,
    parseFinanceQueryPlanLocally,
} from './financeChatLocal';
import { DEFAULT_QUERY_PLAN, normalizeQueryPlan, type FinanceQueryPlan } from './financeChatPlan';

export type FinanceChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

export type FinanceTransaction = {
    id: string;
    date: string;
    amount: number;
    name: string | null;
    person: string | null;
    note: string | null;
    category_id: string | null;
    category_name: string | null;
    is_transfer: boolean;
};

export type FinanceChatContext = {
    categories: Array<{ id: string; name: string; type: string | null }>;
    topMerchants: string[];
    accountNames: string[];
};

export type FinanceSpendingStats = {
    total: number;
    monthlyAverage: number;
    transactionCount: number;
    monthsInRange: number;
    byMonth: Array<{ month: string; amount: number }>;
    topMerchants: Array<{ name: string; total: number; count: number }>;
};

export type FinanceChatResult = {
    reply: string;
    plan: FinanceQueryPlan;
    stats: FinanceSpendingStats;
    matchedCount: number;
    usedLocalFallback: boolean;
};

const DEFAULT_PLAN = DEFAULT_QUERY_PLAN;

function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
        throw new Error('OpenAI API key is not configured');
    }
    return new OpenAI({ apiKey });
}

function normalizeText(value: string): string {
    return value.toLowerCase().trim();
}

function merchantText(tx: FinanceTransaction): string {
    return [tx.name, tx.person, tx.note].filter(Boolean).join(' ').toLowerCase();
}

function matchesKeyword(text: string, keyword: string): boolean {
    const normalized = normalizeText(keyword);
    if (!normalized) return false;
    return text.includes(normalized);
}

function categoryMatches(tx: FinanceTransaction, names: string[]): boolean {
    if (!tx.category_name || names.length === 0) return false;
    const categoryName = normalizeText(tx.category_name);
    return names.some(name => {
        const target = normalizeText(name);
        return (
            categoryName === target ||
            categoryName.includes(target) ||
            target.includes(categoryName)
        );
    });
}

export function filterTransactions(
    transactions: FinanceTransaction[],
    plan: FinanceQueryPlan
): FinanceTransaction[] {
    const categoryNames = plan.category_names ?? [];
    const merchantKeywords = plan.merchant_keywords ?? [];
    const excludeCategories = plan.exclude_category_names ?? [];
    const excludeKeywords = plan.exclude_merchant_keywords ?? [];

    return transactions.filter(tx => {
        if (tx.is_transfer) return false;

        const text = merchantText(tx);
        const isExpense = tx.amount < 0;
        const isIncome = tx.amount > 0;

        if (plan.direction === 'expense' && !isExpense) return false;
        if (plan.direction === 'income' && !isIncome) return false;

        if (excludeCategories.length > 0 && categoryMatches(tx, excludeCategories)) {
            return false;
        }
        if (excludeKeywords.length > 0 && excludeKeywords.some(keyword => matchesKeyword(text, keyword))) {
            return false;
        }

        if (categoryNames.length === 0 && merchantKeywords.length === 0) {
            return true;
        }

        const categoryMatch =
            categoryNames.length > 0 && categoryMatches(tx, categoryNames);
        const merchantMatch =
            merchantKeywords.length > 0 &&
            merchantKeywords.some(keyword => matchesKeyword(text, keyword));

        return categoryMatch || merchantMatch;
    });
}

export function computeSpendingStats(
    transactions: FinanceTransaction[],
    monthsInRange: number,
    direction: FinanceQueryPlan['direction']
): FinanceSpendingStats {
    const relevant = transactions.filter(tx =>
        direction === 'income' ? tx.amount > 0 : tx.amount < 0
    );

    const byMonthMap = new Map<string, number>();
    const merchantMap = new Map<string, { total: number; count: number }>();

    for (const tx of relevant) {
        const amount = Math.abs(tx.amount);
        const month = tx.date.slice(0, 7);
        byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + amount);

        const merchant =
            tx.name?.trim() ||
            tx.person?.trim() ||
            tx.note?.trim() ||
            'Unknown';
        const existing = merchantMap.get(merchant) ?? { total: 0, count: 0 };
        existing.total += amount;
        existing.count += 1;
        merchantMap.set(merchant, existing);
    }

    const total = relevant.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const safeMonths = Math.max(monthsInRange, 1);
    const byMonth = [...byMonthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));
    const topMerchants = [...merchantMap.entries()]
        .map(([name, data]) => ({ name, total: data.total, count: data.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

    return {
        total,
        monthlyAverage: total / safeMonths,
        transactionCount: relevant.length,
        monthsInRange: safeMonths,
        byMonth,
        topMerchants,
    };
}

function parseJsonResponse<T>(text: string): T {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
}


export { normalizeQueryPlan } from './financeChatPlan';

export async function loadFinanceChatContext(
    supabase: SupabaseClient,
    userId: string
): Promise<FinanceChatContext> {
    const [categoriesResult, accountsResult, transactionsResult] = await Promise.all([
        supabase
            .from('categories')
            .select('id, name, type')
            .eq('user_id', userId)
            .eq('kind', 'category')
            .eq('is_archived', false)
            .order('name'),
        supabase.from('accounts').select('name').eq('user_id', userId).order('name'),
        supabase
            .from('transactions')
            .select('name, person, note')
            .eq('user_id', userId)
            .gte('date', monthsAgoIso(12))
            .lt('amount', 0)
            .order('date', { ascending: false })
            .limit(500),
    ]);

    const merchantCounts = new Map<string, number>();
    for (const row of transactionsResult.data ?? []) {
        const label = row.name?.trim() || row.person?.trim() || row.note?.trim();
        if (!label) continue;
        merchantCounts.set(label, (merchantCounts.get(label) ?? 0) + 1);
    }

    const topMerchants = [...merchantCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([name]) => name);

    return {
        categories: categoriesResult.data ?? [],
        topMerchants,
        accountNames: (accountsResult.data ?? [])
            .map(row => row.name)
            .filter((name): name is string => Boolean(name)),
    };
}

function monthsAgoIso(months: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString().slice(0, 10);
}

export async function fetchTransactionsForRange(
    supabase: SupabaseClient,
    userId: string,
    monthsBack: number
): Promise<FinanceTransaction[]> {
    const startDate = monthsAgoIso(monthsBack);
    const { data, error } = await supabase
        .from('transactions')
        .select(
            `
            id,
            date,
            amount,
            name,
            person,
            note,
            category_id,
            is_transfer,
            categories ( name )
        `
        )
        .eq('user_id', userId)
        .gte('date', startDate)
        .order('date', { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (data ?? []).map(row => {
        const categories = row.categories as { name: string | null } | { name: string | null }[] | null;
        const categoryName = Array.isArray(categories)
            ? categories[0]?.name ?? null
            : categories?.name ?? null;

        return {
            id: row.id,
            date: row.date,
            amount: Number(row.amount),
            name: row.name,
            person: row.person,
            note: row.note,
            category_id: row.category_id,
            category_name: categoryName,
            is_transfer: Boolean(row.is_transfer),
        };
    });
}

export async function parseFinanceQueryPlan(
    question: string,
    context: FinanceChatContext
): Promise<FinanceQueryPlan> {
    const openai = getOpenAIClient();
    const categoryList = context.categories
        .map(category => `- ${category.name} (${category.type ?? 'unknown'})`)
        .join('\n');
    const merchantSample = context.topMerchants.slice(0, 30).join(', ') || 'None yet';

    const prompt = `Analyze this finance question and return JSON only.

Question: "${question}"

User categories:
${categoryList || '- No categories yet'}

Recent merchant names from this user's transactions:
${merchantSample}

Return JSON with this shape:
{
  "intent": "spending" | "income" | "comparison" | "general",
  "category_names": ["exact or closest user category names"],
  "merchant_keywords": ["keywords to match in transaction name/person/note"],
  "exclude_category_names": [],
  "exclude_merchant_keywords": [],
  "months_back": 12,
  "aggregation": "monthly_average" | "total" | "by_month" | "count" | "top_merchants",
  "direction": "expense" | "income"
}

Rules:
- For grocery questions, include category "Groceries" AND merchant keywords like giant, safeway, whole foods, trader joe, aldi, wegmans, kroger, food lion, costco (when clearly groceries).
- For restaurants, use "Restaurants & Coffee" and restaurant/coffee merchant keywords.
- Match category names to the user's actual category list when possible.
- Use merchant_keywords for stores/payees even if uncategorized.
- Default months_back to 12 for "per month" / average questions, 1 for "last month", 3 for "last quarter".
- Use aggregation "monthly_average" for average monthly spend questions.
- Use direction "expense" for spending questions and "income" for earnings questions.`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 500,
        messages: [
            {
                role: 'system',
                content:
                    'You translate natural-language finance questions into structured query plans. Return valid JSON only.',
            },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
        return DEFAULT_PLAN;
    }

    return normalizeQueryPlan(parseJsonResponse<Partial<FinanceQueryPlan>>(content));
}

export async function generateFinanceAnswer(
    question: string,
    history: FinanceChatMessage[],
    plan: FinanceQueryPlan,
    stats: FinanceSpendingStats,
    sampleTransactions: FinanceTransaction[]
): Promise<string> {
    const openai = getOpenAIClient();
    const sampleLines = sampleTransactions.slice(0, 8).map(tx => {
        const label = tx.name || tx.person || tx.note || 'Transaction';
        return `- ${tx.date}: ${label} ($${Math.abs(tx.amount).toFixed(2)})`;
    });

    const dataContext = JSON.stringify(
        {
            plan,
            stats: {
                total: Number(stats.total.toFixed(2)),
                monthlyAverage: Number(stats.monthlyAverage.toFixed(2)),
                transactionCount: stats.transactionCount,
                monthsInRange: stats.monthsInRange,
                byMonth: stats.byMonth.map(row => ({
                    month: row.month,
                    amount: Number(row.amount.toFixed(2)),
                })),
                topMerchants: stats.topMerchants.map(row => ({
                    name: row.name,
                    total: Number(row.total.toFixed(2)),
                    count: row.count,
                })),
            },
            sampleTransactions: sampleLines,
        },
        null,
        2
    );

    const recentHistory = history.slice(-6).map(message => ({
        role: message.role,
        content: message.content,
    }));

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 500,
        messages: [
            {
                role: 'system',
                content: `You are a helpful personal finance assistant for LevelUp Financial.
Answer using ONLY the computed data provided. Be concise, friendly, and specific with dollar amounts.
If there is no matching data, say so clearly and suggest checking categories or transaction names.
Do not invent numbers. Format currency like $123.45.`,
            },
            ...recentHistory,
            {
                role: 'user',
                content: `Question: ${question}

Computed data:
${dataContext}`,
            },
        ],
    });

    return (
        completion.choices[0]?.message?.content?.trim() ||
        'I could not generate an answer from your transaction data.'
    );
}

function openAIEnabled(): boolean {
    return process.env.FINANCE_CHAT_USE_OPENAI !== 'false';
}

async function resolveQueryPlan(
    question: string,
    context: FinanceChatContext
): Promise<{ plan: FinanceQueryPlan; usedLocalFallback: boolean }> {
    if (!openAIEnabled()) {
        return { plan: parseFinanceQueryPlanLocally(question, context), usedLocalFallback: true };
    }

    try {
        return { plan: await parseFinanceQueryPlan(question, context), usedLocalFallback: false };
    } catch (error) {
        if (!isOpenAIUnavailableError(error)) throw error;
        console.warn('Finance chat: OpenAI unavailable for query plan, using local fallback.', error);
        return { plan: parseFinanceQueryPlanLocally(question, context), usedLocalFallback: true };
    }
}

async function resolveAnswer(
    question: string,
    history: FinanceChatMessage[],
    plan: FinanceQueryPlan,
    stats: FinanceSpendingStats,
    matched: FinanceTransaction[],
    usedLocalFallback: boolean
): Promise<string> {
    if (usedLocalFallback || !openAIEnabled()) {
        return generateFinanceAnswerLocally(question, plan, stats);
    }

    try {
        return await generateFinanceAnswer(question, history, plan, stats, matched);
    } catch (error) {
        if (!isOpenAIUnavailableError(error)) throw error;
        console.warn('Finance chat: OpenAI unavailable for answer, using local fallback.', error);
        return generateFinanceAnswerLocally(question, plan, stats);
    }
}

export async function answerFinanceQuestion(
    supabase: SupabaseClient,
    userId: string,
    question: string,
    history: FinanceChatMessage[] = []
): Promise<FinanceChatResult> {
    const trimmed = question.trim();
    if (!trimmed) {
        throw new Error('Question is required');
    }

    const context = await loadFinanceChatContext(supabase, userId);
    const { plan, usedLocalFallback: planUsedFallback } = await resolveQueryPlan(trimmed, context);
    const transactions = await fetchTransactionsForRange(supabase, userId, plan.months_back);
    const matched = filterTransactions(transactions, plan);
    const stats = computeSpendingStats(matched, plan.months_back, plan.direction);
    const reply = await resolveAnswer(
        trimmed,
        history,
        plan,
        stats,
        matched,
        planUsedFallback
    );

    return {
        reply,
        plan,
        stats,
        matchedCount: matched.length,
        usedLocalFallback: planUsedFallback,
    };
}
