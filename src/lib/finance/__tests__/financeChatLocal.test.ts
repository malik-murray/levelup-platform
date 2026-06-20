import {
    generateFinanceAnswerLocally,
    isOpenAIUnavailableError,
    parseFinanceQueryPlanLocally,
} from '../financeChatLocal';
import {
    computeSpendingStats,
    filterTransactions,
    type FinanceChatContext,
    type FinanceTransaction,
} from '../financeChatService';

const context: FinanceChatContext = {
    categories: [
        { id: '1', name: 'Groceries', type: 'expense' },
        { id: '2', name: 'Restaurants & Coffee', type: 'expense' },
        { id: '3', name: 'Income', type: 'income' },
    ],
    topMerchants: ['GIANT FOOD', 'Starbucks'],
    accountNames: ['Checking'],
};

const sampleTransactions: FinanceTransaction[] = [
    {
        id: '1',
        date: '2025-01-15',
        amount: -82.4,
        name: 'GIANT FOOD',
        person: null,
        note: null,
        category_id: null,
        category_name: null,
        is_transfer: false,
    },
    {
        id: '2',
        date: '2025-02-10',
        amount: -64.2,
        name: 'Whole Foods Market',
        person: null,
        note: null,
        category_id: 'cat-groceries',
        category_name: 'Groceries',
        is_transfer: false,
    },
];

describe('parseFinanceQueryPlanLocally', () => {
    it('maps grocery questions to categories and merchant keywords', () => {
        const plan = parseFinanceQueryPlanLocally(
            'How much do I spend on groceries per month?',
            context
        );

        expect(plan.category_names).toContain('Groceries');
        expect(plan.merchant_keywords).toContain('giant');
        expect(plan.aggregation).toBe('monthly_average');
        expect(plan.direction).toBe('expense');
    });

    it('detects last month time range', () => {
        const plan = parseFinanceQueryPlanLocally(
            'What did I spend on restaurants last month?',
            context
        );

        expect(plan.months_back).toBe(1);
        expect(plan.category_names).toContain('Restaurants & Coffee');
    });
});

describe('generateFinanceAnswerLocally', () => {
    it('returns a formatted monthly average answer', () => {
        const plan = parseFinanceQueryPlanLocally('groceries per month', context);
        const matched = filterTransactions(sampleTransactions, plan);
        const stats = computeSpendingStats(matched, plan.months_back, plan.direction);
        const answer = generateFinanceAnswerLocally('groceries per month', plan, stats);

        expect(answer).toContain('$');
        expect(answer.toLowerCase()).toContain('average monthly');
        expect(answer.toLowerCase()).toContain('groceries');
    });
});

describe('isOpenAIUnavailableError', () => {
    it('detects quota errors', () => {
        expect(
            isOpenAIUnavailableError(new Error('429 You exceeded your current quota'))
        ).toBe(true);
        expect(isOpenAIUnavailableError({ status: 429 })).toBe(true);
    });
});
