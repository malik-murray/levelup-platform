export type FinanceQueryPlan = {
    intent: 'spending' | 'income' | 'comparison' | 'general';
    category_names: string[];
    merchant_keywords: string[];
    exclude_category_names: string[];
    exclude_merchant_keywords: string[];
    months_back: number;
    aggregation: 'monthly_average' | 'total' | 'by_month' | 'count' | 'top_merchants';
    direction: 'expense' | 'income';
};

export const DEFAULT_QUERY_PLAN: FinanceQueryPlan = {
    intent: 'general',
    category_names: [],
    merchant_keywords: [],
    exclude_category_names: [],
    exclude_merchant_keywords: [],
    months_back: 12,
    aggregation: 'monthly_average',
    direction: 'expense',
};

function clampMonths(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return 12;
    return Math.min(36, Math.max(1, Math.round(parsed)));
}

function sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 20);
}

export function normalizeQueryPlan(raw: Partial<FinanceQueryPlan>): FinanceQueryPlan {
    const aggregationValues: FinanceQueryPlan['aggregation'][] = [
        'monthly_average',
        'total',
        'by_month',
        'count',
        'top_merchants',
    ];
    const intentValues: FinanceQueryPlan['intent'][] = [
        'spending',
        'income',
        'comparison',
        'general',
    ];
    const directionValues: FinanceQueryPlan['direction'][] = ['expense', 'income'];

    return {
        intent: intentValues.includes(raw.intent as FinanceQueryPlan['intent'])
            ? (raw.intent as FinanceQueryPlan['intent'])
            : DEFAULT_QUERY_PLAN.intent,
        category_names: sanitizeStringArray(raw.category_names),
        merchant_keywords: sanitizeStringArray(raw.merchant_keywords),
        exclude_category_names: sanitizeStringArray(raw.exclude_category_names),
        exclude_merchant_keywords: sanitizeStringArray(raw.exclude_merchant_keywords),
        months_back: clampMonths(raw.months_back),
        aggregation: aggregationValues.includes(raw.aggregation as FinanceQueryPlan['aggregation'])
            ? (raw.aggregation as FinanceQueryPlan['aggregation'])
            : DEFAULT_QUERY_PLAN.aggregation,
        direction: directionValues.includes(raw.direction as FinanceQueryPlan['direction'])
            ? (raw.direction as FinanceQueryPlan['direction'])
            : DEFAULT_QUERY_PLAN.direction,
    };
}
