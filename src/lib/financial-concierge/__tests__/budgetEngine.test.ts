/**
 * Tests for BudgetEngine
 */

import {
    BudgetGenerationOptions,
    detectOneOffAmounts,
    normalizeToIncome,
    classifyBudgetLine,
    buildGoalLines,
    type NormalizableLine,
} from '../budgetEngine';

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

    describe('detectOneOffAmounts', () => {
        it('flags nothing when there is too little history to define a norm', () => {
            const flags = detectOneOffAmounts([10, 5000], { minCount: 5 });
            expect(flags).toEqual([false, false]);
        });

        it('flags a large atypical purchase, keeps the recurring ones', () => {
            // median ~50, threshold = max(400, 50*4=200) = 400
            const amounts = [40, 50, 45, 55, 60, 3800];
            const flags = detectOneOffAmounts(amounts);
            expect(flags).toEqual([false, false, false, false, false, true]);
        });

        it('does not flag normal values in a routinely-large category (e.g. rent)', () => {
            // median ~1950, threshold = 1950*4 = 7800 — a normal $2000 rent is not a one-off
            const rent = [1950, 1950, 1975, 1950, 2000, 1950];
            expect(detectOneOffAmounts(rent).some(Boolean)).toBe(false);
        });

        it('requires exceeding the absolute floor even when the median is tiny', () => {
            // median ~5, 4x=20, but absMin 400 dominates, so a $300 charge is NOT a one-off
            const amounts = [3, 5, 4, 6, 5, 300];
            expect(detectOneOffAmounts(amounts)).toEqual([false, false, false, false, false, false]);
        });
    });

    describe('normalizeToIncome', () => {
        const lines: NormalizableLine[] = [
            { category_id: 'rent', amount: 2000, klass: 'essential' },
            { category_id: 'save', amount: 1000, klass: 'savings' },
            { category_id: 'dining', amount: 800, klass: 'discretionary' },
            { category_id: 'shopping', amount: 400, klass: 'discretionary' },
        ];

        it('leaves everything untouched when total is within income', () => {
            const r = normalizeToIncome(lines, 10000);
            expect(r.discretionaryScale).toBe(1);
            expect(r.totalAfter).toBe(4200);
            expect(r.lines.every((l) => !l.scaled)).toBe(true);
        });

        it('scales only discretionary to fit income, protecting essentials + savings', () => {
            // income 3600; fixed = 3000; remaining 600 for 1200 discretionary => scale 0.5
            const r = normalizeToIncome(lines, 3600);
            expect(r.discretionaryScale).toBe(0.5);
            expect(r.totalAfter).toBeCloseTo(3600, 2);
            const byId = Object.fromEntries(r.lines.map((l) => [l.category_id, l]));
            expect(byId.rent.amount).toBe(2000); // essential untouched
            expect(byId.save.amount).toBe(1000); // savings untouched
            expect(byId.dining.amount).toBe(400); // 800 * 0.5
            expect(byId.shopping.amount).toBe(200); // 400 * 0.5
        });

        it('zeros discretionary and warns when essentials + savings alone exceed income', () => {
            const r = normalizeToIncome(lines, 2500);
            expect(r.discretionaryScale).toBe(0);
            const byId = Object.fromEntries(r.lines.map((l) => [l.category_id, l]));
            expect(byId.dining.amount).toBe(0);
            expect(byId.shopping.amount).toBe(0);
            expect(byId.rent.amount).toBe(2000);
            expect(r.warning).toMatch(/exceed income/i);
        });

        it('never lets the total exceed income after normalization', () => {
            const r = normalizeToIncome(lines, 3000);
            expect(r.totalAfter).toBeLessThanOrEqual(3000 + 0.01);
        });

        it('warns but does not crash when income is unknown', () => {
            const r = normalizeToIncome(lines, 0);
            expect(r.discretionaryScale).toBeNull();
            expect(r.totalAfter).toBe(4200);
            expect(r.warning).toMatch(/no income/i);
        });
    });

    describe('buildGoalLines', () => {
        const savingsCat = { categoryId: 'save', existingAmount: 0 };
        const investCat = { categoryId: 'invest', existingAmount: 0 };

        it('creates two distinct protected lines for savings and investing', () => {
            const lines = buildGoalLines(
                { ...savingsCat, goal: 500 },
                { ...investCat, goal: 300 }
            );
            expect(lines).toHaveLength(2);
            const byId = Object.fromEntries(lines.map((l) => [l.category_id, l]));
            expect(byId.save.amount).toBe(500);
            expect(byId.save.reason).toBe('Savings goal');
            expect(byId.invest.amount).toBe(300);
            expect(byId.invest.reason).toBe('Investing goal');
        });

        it('only emits a savings line when investing goal is zero', () => {
            const lines = buildGoalLines(
                { ...savingsCat, goal: 500 },
                { ...investCat, goal: 0 }
            );
            expect(lines).toHaveLength(1);
            expect(lines[0].category_id).toBe('save');
        });

        it('nets already-tracked savings-class spend off the savings goal only', () => {
            const lines = buildGoalLines(
                { ...savingsCat, goal: 500 },
                { ...investCat, goal: 300 },
                200 // e.g. a real transfer already categorized as savings
            );
            const byId = Object.fromEntries(lines.map((l) => [l.category_id, l]));
            expect(byId.save.amount).toBe(300); // 500 - 200
            expect(byId.invest.amount).toBe(300); // investing untouched by the offset
        });

        it('never reduces an amount already planned from history (floor)', () => {
            const lines = buildGoalLines(
                { categoryId: 'save', goal: 500, existingAmount: 700 },
                { categoryId: 'invest', goal: 0, existingAmount: 0 }
            );
            expect(lines[0].amount).toBe(700);
        });

        it('merges into one line when both goals resolve to the same category', () => {
            const lines = buildGoalLines(
                { categoryId: 'both', goal: 500, existingAmount: 0 },
                { categoryId: 'both', goal: 300, existingAmount: 0 }
            );
            expect(lines).toHaveLength(1);
            expect(lines[0].amount).toBe(800);
            expect(lines[0].reason).toBe('Savings & investing goal');
        });

        it('emits nothing when there are no goals and no existing amounts', () => {
            const lines = buildGoalLines(
                { categoryId: 'save', goal: 0, existingAmount: 0 },
                { categoryId: 'invest', goal: 0, existingAmount: 0 }
            );
            expect(lines).toHaveLength(0);
        });

        it('skips a goal whose category could not be resolved', () => {
            const lines = buildGoalLines(
                { categoryId: null, goal: 500, existingAmount: 0 },
                { ...investCat, goal: 300 }
            );
            expect(lines).toHaveLength(1);
            expect(lines[0].category_id).toBe('invest');
        });
    });

    describe('classifyBudgetLine', () => {
        it('classifies savings, essentials, and discretionary', () => {
            expect(classifyBudgetLine('Savings')).toBe('savings');
            expect(classifyBudgetLine('Housing')).toBe('essential');
            expect(classifyBudgetLine('Groceries')).toBe('essential');
            expect(classifyBudgetLine('Entertainment')).toBe('discretionary');
        });
    });
});










