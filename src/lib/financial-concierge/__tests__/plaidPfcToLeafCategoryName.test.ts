import { leafCategoryNameFromPlaidPfc } from '../plaidPfcToLeafCategoryName';

describe('leafCategoryNameFromPlaidPfc', () => {
    it('maps detailed food codes', () => {
        expect(leafCategoryNameFromPlaidPfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES')).toBe('Groceries');
        expect(leafCategoryNameFromPlaidPfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE')).toBe('Coffee Shops');
    });

    it('skips transfers', () => {
        expect(leafCategoryNameFromPlaidPfc('TRANSFER_IN', 'TRANSFER_IN_ACCOUNT_TRANSFER')).toBeNull();
        expect(leafCategoryNameFromPlaidPfc('TRANSFER_OUT', 'TRANSFER_OUT_WITHDRAWAL')).toBeNull();
    });

    it('skips loan disbursements', () => {
        expect(leafCategoryNameFromPlaidPfc('LOAN_DISBURSEMENTS', 'LOAN_DISBURSEMENTS_PERSONAL')).toBeNull();
    });

    it('falls back to primary defaults', () => {
        expect(leafCategoryNameFromPlaidPfc('BANK_FEES', '')).toBe('Bank Fees');
        expect(leafCategoryNameFromPlaidPfc('TRANSPORTATION', '')).toBe('Gas');
    });

    it('maps legacy INCOME_WAGES', () => {
        expect(leafCategoryNameFromPlaidPfc('INCOME', 'INCOME_WAGES')).toBe('Wages & Salary');
    });
});
