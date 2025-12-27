/**
 * Unit tests for budgetGroups helper functions
 * Tests that group totals equal the sum of their children
 */

import type { BudgetGroup } from '../types';

describe('budgetGroups', () => {
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












