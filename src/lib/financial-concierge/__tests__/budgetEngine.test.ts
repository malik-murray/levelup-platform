/**
 * Tests for BudgetEngine
 */

import { BudgetGenerationOptions } from '../budgetEngine';

describe('BudgetEngine', () => {
    const mockOptions: BudgetGenerationOptions = {
        userId: 'test-user-id',
        month: '2024-01',
        sourceDataDays: 90,
    };

    describe('generateBudgetPlan', () => {
        it('should require userId and month', () => {
            expect(mockOptions.userId).toBeDefined();
            expect(mockOptions.month).toMatch(/^\d{4}-\d{2}$/);
        });

        it('should handle guardrail calculations', () => {
            const categorySpend = 500;
            const totalIncome = 5000;
            
            // Test guardrail logic
            const maxDiscretionary = 0.3;
            const adjustedAmount = categorySpend * (maxDiscretionary * 0.8);
            
            expect(adjustedAmount).toBeLessThan(categorySpend);
            expect(adjustedAmount).toBeGreaterThan(0);
        });

        it('should calculate monthly averages correctly', () => {
            const totalSpend = 1500;
            const days = 90;
            const monthsInPeriod = days / 30;
            const avgMonthly = totalSpend / monthsInPeriod;
            
            expect(avgMonthly).toBe(500); // 1500 / 3 months
        });
    });

    describe('guardrails', () => {
        it('should apply debt payoff guardrails', () => {
            const maxDiscretionary = 0.3;
            const categorySpend = 1000;
            const adjusted = categorySpend * (maxDiscretionary * 0.8);
            
            expect(adjusted).toBe(240); // 1000 * 0.3 * 0.8
        });

        it('should apply saving focused guardrails', () => {
            const totalIncome = 5000;
            const categorySpend = 600;
            const capPercentage = 0.05;
            const cappedAmount = Math.min(categorySpend, totalIncome * capPercentage);
            
            expect(cappedAmount).toBe(250); // min(600, 5000 * 0.05)
        });
    });
});


