import { leafCategoryNameFromPlaidPfc } from '../plaidPfcToLeafCategoryName';

describe('leafCategoryNameFromPlaidPfc', () => {
    it('maps detailed food codes to flattened taxonomy', () => {
        expect(leafCategoryNameFromPlaidPfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES')).toBe(
            'Groceries'
        );
        expect(leafCategoryNameFromPlaidPfc('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE')).toBe(
            'Dining Out'
        );
    });

    it('skips transfers', () => {
        expect(leafCategoryNameFromPlaidPfc('TRANSFER_IN', 'TRANSFER_IN_ACCOUNT_TRANSFER')).toBeNull();
        expect(leafCategoryNameFromPlaidPfc('TRANSFER_OUT', 'TRANSFER_OUT_WITHDRAWAL')).toBeNull();
    });

    it('skips loan disbursements', () => {
        expect(leafCategoryNameFromPlaidPfc('LOAN_DISBURSEMENTS', 'LOAN_DISBURSEMENTS_PERSONAL')).toBeNull();
    });

    it('falls back to primary defaults', () => {
        expect(leafCategoryNameFromPlaidPfc('BANK_FEES', '')).toBe('Business');
        expect(leafCategoryNameFromPlaidPfc('TRANSPORTATION', '')).toBe('Transportation');
    });

    it('maps income wages to Job 1', () => {
        expect(leafCategoryNameFromPlaidPfc('INCOME', 'INCOME_WAGES')).toBe('Job 1');
        expect(leafCategoryNameFromPlaidPfc('INCOME', 'INCOME_SALARY')).toBe('Job 1');
        expect(leafCategoryNameFromPlaidPfc('INCOME', 'INCOME_DIVIDENDS')).toBe('Dividend/Interest');
    });

    it('maps rent and wifi utilities', () => {
        expect(leafCategoryNameFromPlaidPfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_RENT')).toBe(
            'Rent'
        );
        expect(
            leafCategoryNameFromPlaidPfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE')
        ).toBe('Wi-Fi');
        expect(leafCategoryNameFromPlaidPfc('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_TELEPHONE')).toBe(
            'Phone'
        );
    });
});
