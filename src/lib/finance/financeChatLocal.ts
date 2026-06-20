import type { FinanceChatContext, FinanceSpendingStats } from './financeChatService';
import { normalizeQueryPlan, type FinanceQueryPlan } from './financeChatPlan';

type TopicRule = {
    keywords: string[];
    category_names: string[];
    merchant_keywords: string[];
    direction: 'expense' | 'income';
};

const TOPIC_RULES: TopicRule[] = [
    {
        keywords: ['grocery', 'groceries', 'supermarket', 'food store'],
        category_names: ['Groceries'],
        merchant_keywords: [
            'giant',
            'safeway',
            'whole foods',
            'trader joe',
            'aldi',
            'wegmans',
            'kroger',
            'food lion',
            'shoprite',
            'harris teeter',
            'publix',
            'heb',
            'costco',
            'walmart',
            'target',
            'sprouts',
        ],
        direction: 'expense',
    },
    {
        keywords: ['restaurant', 'coffee', 'dining', 'doordash', 'uber eats', 'grubhub'],
        category_names: ['Restaurants & Coffee'],
        merchant_keywords: [
            'starbucks',
            'dunkin',
            'mcdonald',
            'chipotle',
            'doordash',
            'uber eats',
            'grubhub',
            'panera',
        ],
        direction: 'expense',
    },
    {
        keywords: ['subscription', 'subscriptions', 'netflix', 'spotify'],
        category_names: ['Subscriptions'],
        merchant_keywords: ['netflix', 'spotify', 'hulu', 'disney', 'apple.com/bill'],
        direction: 'expense',
    },
    {
        keywords: ['gas', 'fuel', 'transportation', 'uber', 'lyft', 'transit'],
        category_names: ['Transportation', 'Car'],
        merchant_keywords: ['shell', 'exxon', 'bp', 'chevron', 'uber', 'lyft', 'metro'],
        direction: 'expense',
    },
    {
        keywords: ['housing', 'rent', 'mortgage'],
        category_names: ['Housing'],
        merchant_keywords: ['rent', 'mortgage', 'landlord'],
        direction: 'expense',
    },
    {
        keywords: ['utility', 'utilities', 'electric', 'internet', 'phone bill'],
        category_names: ['Utilities'],
        merchant_keywords: ['verizon', 'comcast', 'xfinity', 'at&t', 'dominion', 'pepco'],
        direction: 'expense',
    },
    {
        keywords: ['income', 'salary', 'paycheck', 'earned', 'deposit'],
        category_names: ['Income'],
        merchant_keywords: ['payroll', 'direct dep', 'salary'],
        direction: 'income',
    },
    {
        keywords: ['shopping', 'amazon', 'clothes'],
        category_names: ['Shopping'],
        merchant_keywords: ['amazon', 'target', 'best buy', 'nordstrom'],
        direction: 'expense',
    },
];

function formatUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(amount);
}

function resolveCategoryName(context: FinanceChatContext, preferred: string): string {
    const normalized = preferred.toLowerCase();
    const match = context.categories.find(
        category => category.name.toLowerCase() === normalized
    );
    return match?.name ?? preferred;
}

function inferMonthsBack(question: string): number {
    const q = question.toLowerCase();
    if (q.includes('last month') || q.includes('this month')) return 1;
    if (q.includes('last quarter') || q.includes('past 3 months') || q.includes('last 3 months')) {
        return 3;
    }
    if (q.includes('last 6 months') || q.includes('past 6 months')) return 6;
    if (q.includes('this year') || q.includes('past year') || q.includes('last year')) return 12;
    const monthMatch = q.match(/(?:last|past)\s+(\d+)\s+months?/);
    if (monthMatch) {
        const parsed = Number(monthMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) return Math.min(36, parsed);
    }
    return 12;
}

function inferAggregation(question: string): FinanceQueryPlan['aggregation'] {
    const q = question.toLowerCase();
    if (q.includes('top merchant') || q.includes('biggest merchant')) return 'top_merchants';
    if (q.includes('how many') || q.includes('number of')) return 'count';
    if (q.includes('each month') || q.includes('per month') || q.includes('average') || q.includes('avg')) {
        return 'monthly_average';
    }
    if (q.includes('by month') || q.includes('each month breakdown')) return 'by_month';
    if (q.includes('total') || q.includes('how much')) return 'monthly_average';
    return 'monthly_average';
}

function inferDirection(question: string): FinanceQueryPlan['direction'] {
    const q = question.toLowerCase();
    if (q.includes('income') || q.includes('earn') || q.includes('salary') || q.includes('paycheck')) {
        return 'income';
    }
    return 'expense';
}

export function parseFinanceQueryPlanLocally(
    question: string,
    context: FinanceChatContext
): FinanceQueryPlan {
    const q = question.toLowerCase();
    const months_back = inferMonthsBack(question);
    const aggregation = inferAggregation(question);
    let direction = inferDirection(question);

    for (const rule of TOPIC_RULES) {
        if (rule.keywords.some(keyword => q.includes(keyword))) {
            direction = rule.direction;
            return normalizeQueryPlan({
                intent: direction === 'income' ? 'income' : 'spending',
                category_names: rule.category_names.map(name => resolveCategoryName(context, name)),
                merchant_keywords: rule.merchant_keywords,
                months_back,
                aggregation,
                direction,
            });
        }
    }

    // Match user category names mentioned in the question
    const mentionedCategories = context.categories
        .filter(category => q.includes(category.name.toLowerCase()))
        .map(category => category.name);

    if (mentionedCategories.length > 0) {
        const categoryType = context.categories.find(
            category => category.name === mentionedCategories[0]
        )?.type;
        return normalizeQueryPlan({
            intent: categoryType === 'income' ? 'income' : 'spending',
            category_names: mentionedCategories,
            months_back,
            aggregation,
            direction: categoryType === 'income' ? 'income' : direction,
        });
    }

    if (q.includes('top spending') || q.includes('biggest spending') || q.includes('most spent')) {
        return normalizeQueryPlan({
            intent: 'general',
            months_back,
            aggregation: 'top_merchants',
            direction: 'expense',
        });
    }

    return normalizeQueryPlan({
        intent: 'general',
        months_back,
        aggregation,
        direction,
    });
}

function topicLabel(plan: FinanceQueryPlan): string {
    if (plan.category_names.length > 0) return plan.category_names.join(', ');
    if (plan.merchant_keywords.length > 0) return plan.merchant_keywords[0];
    return plan.direction === 'income' ? 'income' : 'spending';
}

export function generateFinanceAnswerLocally(
    question: string,
    plan: FinanceQueryPlan,
    stats: FinanceSpendingStats
): string {
    const label = topicLabel(plan);
    const spendWord = plan.direction === 'income' ? 'income' : 'spending';
    const rangeLabel =
        stats.monthsInRange === 1 ? 'the last month' : `the last ${stats.monthsInRange} months`;

    if (stats.transactionCount === 0) {
        return `I couldn't find matching transactions in ${rangeLabel}. Check that those purchases are imported and categorized (or include a recognizable store name like Giant).`;
    }

    if (plan.aggregation === 'count') {
        return `I found ${stats.transactionCount} matching transactions in ${rangeLabel} for ${label}.`;
    }

    if (plan.aggregation === 'top_merchants') {
        const lines = stats.topMerchants
            .slice(0, 5)
            .map(row => `${row.name}: ${formatUsd(row.total)} (${row.count} purchases)`);
        return lines.length > 0
            ? `Your top merchants in ${rangeLabel}:\n${lines.join('\n')}`
            : `No merchant totals found in ${rangeLabel}.`;
    }

    if (plan.aggregation === 'by_month') {
        const lines = stats.byMonth.map(row => `${row.month}: ${formatUsd(row.amount)}`);
        return `Your ${label} ${spendWord} by month:\n${lines.join('\n')}\nTotal: ${formatUsd(stats.total)}`;
    }

    const q = question.toLowerCase();
    const wantsTotal = q.includes('total') && !q.includes('per month') && !q.includes('average');

    if (wantsTotal) {
        return `Based on ${stats.transactionCount} transactions in ${rangeLabel}, your total ${label} ${spendWord} is ${formatUsd(stats.total)}.`;
    }

    return `Based on ${stats.transactionCount} transactions in ${rangeLabel}, your average monthly ${label} ${spendWord} is about ${formatUsd(stats.monthlyAverage)} (total ${formatUsd(stats.total)}).`;
}

export function isOpenAIUnavailableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 429 || status === 402 || status === 503) return true;
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('429') ||
            message.includes('quota') ||
            message.includes('rate limit') ||
            message.includes('billing') ||
            message.includes('insufficient') ||
            message.includes('openai api key')
        );
    }
    return false;
}
