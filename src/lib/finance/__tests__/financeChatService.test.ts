import {
    computeSpendingStats,
    filterTransactions,
    type FinanceChatContext,
    type FinanceTransaction,
} from '../financeChatService';
import { normalizeQueryPlan } from '../financeChatPlan';

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
    {
        id: '3',
        date: '2025-02-12',
        amount: -28.5,
        name: 'Starbucks',
        person: null,
        note: null,
        category_id: 'cat-restaurants',
        category_name: 'Restaurants & Coffee',
        is_transfer: false,
    },
    {
        id: '4',
        date: '2025-03-01',
        amount: -500,
        name: 'Transfer to savings',
        person: null,
        note: null,
        category_id: 'cat-transfer',
        category_name: 'Transfer',
        is_transfer: true,
    },
];

describe('filterTransactions', () => {
    it('matches grocery category and grocery merchant keywords', () => {
        const plan = normalizeQueryPlan({
            category_names: ['Groceries'],
            merchant_keywords: ['giant', 'whole foods'],
            direction: 'expense',
        });

        const matched = filterTransactions(sampleTransactions, plan);
        expect(matched.map(tx => tx.id)).toEqual(['1', '2']);
    });

    it('excludes transfers even when merchant text matches', () => {
        const plan = normalizeQueryPlan({
            merchant_keywords: ['transfer'],
            direction: 'expense',
        });

        const matched = filterTransactions(sampleTransactions, plan);
        expect(matched).toHaveLength(0);
    });
});

describe('computeSpendingStats', () => {
    it('computes monthly average over requested months', () => {
        const plan = normalizeQueryPlan({
            category_names: ['Groceries'],
            merchant_keywords: ['giant'],
            direction: 'expense',
        });
        const matched = filterTransactions(sampleTransactions, plan);
        const stats = computeSpendingStats(matched, 12, plan.direction);

        expect(stats.transactionCount).toBe(2);
        expect(stats.total).toBeCloseTo(146.6, 2);
        expect(stats.monthlyAverage).toBeCloseTo(146.6 / 12, 2);
    });
});

describe('normalizeQueryPlan', () => {
    it('clamps months_back and sanitizes arrays', () => {
        const plan = normalizeQueryPlan({
            months_back: 999,
            category_names: [' Groceries ', '', 123 as unknown as string],
            aggregation: 'invalid' as never,
        });

        expect(plan.months_back).toBe(36);
        expect(plan.category_names).toEqual(['Groceries']);
        expect(plan.aggregation).toBe('monthly_average');
    });
});
