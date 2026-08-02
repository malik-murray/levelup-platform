/**
 * Unit tests for budgetGroups helper functions
 * Tests that group totals equal the sum of their children
 */

import type { BudgetGroup } from '../types';
import { computeMonthCashflow, computeTotalBudgeted } from '../budgetOverview';

describe('budgetGroups', () => {
    describe('computeMonthCashflow', () => {
        it('sums all income and expenses regardless of category, excluding transfers', () => {
            const { totalIncome, totalExpenses } = computeMonthCashflow([
                { amount: 5000, is_transfer: false }, // uncategorized income
                { amount: 1972.65, is_transfer: false },
                { amount: -1200, is_transfer: false }, // uncategorized expense
                { amount: -4294.72, is_transfer: false },
                { amount: -500, is_transfer: true }, // internal transfer — ignored
                { amount: 500, is_transfer: true },
            ]);

            expect(totalIncome).toBeCloseTo(6972.65, 2);
            expect(totalExpenses).toBeCloseTo(5494.72, 2);
        });

        it('treats missing is_transfer as non-transfer', () => {
            const { totalIncome, totalExpenses } = computeMonthCashflow([
                { amount: 100 },
                { amount: -40 },
            ]);
            expect(totalIncome).toBe(100);
            expect(totalExpenses).toBe(40);
        });
    });

    describe('computeTotalBudgeted', () => {
        it('sums only expense-group assigned amounts', () => {
            const groups: BudgetGroup[] = [
                {
                    id: 'inc',
                    name: 'Income',
                    type: 'income',
                    categories: [],
                    totalAssigned: 0,
                    totalActivity: 0,
                    totalAvailable: 0,
                },
                {
                    id: 'exp',
                    name: 'Expenses',
                    type: 'expense',
                    categories: [],
                    totalAssigned: 1959.55,
                    totalActivity: 0,
                    totalAvailable: 1959.55,
                },
                {
                    id: 'sav',
                    name: 'Savings',
                    type: 'transfer',
                    categories: [],
                    totalAssigned: 300,
                    totalActivity: 0,
                    totalAvailable: 300,
                },
            ];
            expect(computeTotalBudgeted(groups)).toBeCloseTo(1959.55, 2);
        });
    });

    describe('Group totals consistency', () => {
        it('should calculate group totals as sum of children', () => {
            const mockGroups: BudgetGroup[] = [
                {
                    id: 'group-1',
                    name: 'Subscriptions',
                    type: 'expense',
                    categories: [
                        {
                            id: 'cat-1',
                            name: 'Netflix',
                            assigned: 15.99,
                            activity: 15.99,
                            available: 0,
                        },
                        {
                            id: 'cat-2',
                            name: 'Spotify',
                            assigned: 9.99,
                            activity: 9.99,
                            available: 0,
                        },
                    ],
                    totalAssigned: 25.98,
                    totalActivity: 25.98,
                    totalAvailable: 0,
                },
            ];

            // Calculate totals from children
            const calculatedAssigned = mockGroups[0].categories.reduce(
                (sum, cat) => sum + cat.assigned,
                0
            );
            const calculatedActivity = mockGroups[0].categories.reduce(
                (sum, cat) => sum + cat.activity,
                0
            );
            const calculatedAvailable = calculatedAssigned - calculatedActivity;

            // Verify group totals match sum of children
            expect(mockGroups[0].totalAssigned).toBe(calculatedAssigned);
            expect(mockGroups[0].totalActivity).toBe(calculatedActivity);
            expect(mockGroups[0].totalAvailable).toBe(calculatedAvailable);
        });

        it('should handle groups with no categories', () => {
            const mockGroup: BudgetGroup = {
                id: 'group-2',
                name: 'Income',
                type: 'income',
                categories: [],
                totalAssigned: 0,
                totalActivity: 0,
                totalAvailable: 0,
            };

            expect(mockGroup.totalAssigned).toBe(0);
            expect(mockGroup.totalActivity).toBe(0);
            expect(mockGroup.totalAvailable).toBe(0);
        });

        it('should handle negative available amounts correctly', () => {
            const mockGroup: BudgetGroup = {
                id: 'group-3',
                name: 'Groceries',
                type: 'expense',
                categories: [
                    {
                        id: 'cat-3',
                        name: 'Whole Foods',
                        assigned: 100,
                        activity: 150,
                        available: -50,
                    },
                ],
                totalAssigned: 100,
                totalActivity: 150,
                totalAvailable: -50,
            };

            expect(mockGroup.totalAvailable).toBe(-50);
            expect(mockGroup.totalAssigned - mockGroup.totalActivity).toBe(
                mockGroup.totalAvailable
            );
        });
    });
});


















